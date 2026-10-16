// Orthicon on the page: the spectrogram, the brushes, and the dxrack/1 adapter.
//
// create(ctx, host) returns the stereo worklet. The picture is a grid of
// columns by log-frequency rows. It is not stored in the patch. A preset
// rebuilds its picture; a painting, a dropped image, or an analysed sound
// stays for the session.

import { makeKnob } from './knob.js';
import { orthiconDevice, normalizeOrthicon, ORTH_DEFAULT, BRUSHES, PHASES, ENGINES, SCALES } from './orthicon.js';
import {
  COLS, ROWS, pictureGrid, paintStroke, paintTone, imageToGrid, analyzeBuffer,
  smearGrid, blurGrid, shiftGrid, stretchGrid, freezeColumn, quantizeGrid,
  DRAWN, drawnGrid, generatePicture, overGrid, summarizeGrid, pictureShare,
} from './orthicon-dsp.js';

const WORKLET = new URL('./orthicon.worklet.js', import.meta.url).href;

export async function createOrthiconNode(ctx, { patch, events, active, destination, grid } = {}) {
  if (!ctx.__orthicon) { await ctx.audioWorklet.addModule(WORKLET); ctx.__orthicon = true; }
  const node = new AudioWorkletNode(ctx, 'orthicon', {
    numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
    processorOptions: {
      patch: normalizeOrthicon(patch),
      events: events || [],
      active: active !== false,
      grid: grid && grid.length === COLS * ROWS ? grid : null,
    },
  });
  if (destination) node.connect(destination);
  return node;
}

export async function renderOrthiconAudio({ patch, events = [], seconds = 1, sampleRate = 48000, grid } = {}) {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const ev = events.map(e => Object.assign({}, e, { at: e.at == null ? 0 : Math.round(e.at * sampleRate) }));
  const node = await createOrthiconNode(ctx, {
    patch, events: ev, active: true, destination: ctx.destination, grid: grid || null,
  });
  const buf = await ctx.startRendering();
  try { node.disconnect(); } catch (e) { /* the context is already closed */ }
  return buf;
}

function isRack(engine) {
  return !!(engine && engine.api === 'dxrack/1' && typeof engine.registerDevice === 'function');
}

// Record whatever is connected to the capture worklet. Resolves with {L, R, sr, n}.
export async function recordOrthicon(ctx, source, seconds) {
  if (!ctx.__orthicon) { await ctx.audioWorklet.addModule(WORKLET); ctx.__orthicon = true; }
  if (ctx.state !== 'running') await ctx.resume();
  const cap = new AudioWorkletNode(ctx, 'orthicon-capture', {
    numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
    processorOptions: { seconds },
  });
  const sink = ctx.createGain();
  sink.gain.value = 0;
  source.connect(cap);
  cap.connect(sink);
  if (ctx.destination) sink.connect(ctx.destination);
  const data = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('capture timed out')), (seconds + 2) * 1000);
    cap.port.onmessage = e => {
      if (!e.data || e.data.t !== 'done') return;
      clearTimeout(timer);
      resolve(e.data);
    };
  }).finally(() => {
    try { source.disconnect(cap); } catch (e) { /* already disconnected */ }
    try { cap.disconnect(); } catch (e) { /* already disconnected */ }
    try { sink.disconnect(); } catch (e) { /* already disconnected */ }
  });
  return data;
}

orthiconDevice.create = async function create(ctx, host) {
  host = host || {};
  return createOrthiconNode(ctx, {
    patch: host.patch, events: host.events, active: host.active !== false, grid: host.grid,
    destination: host.destination,
  });
};

export function createOrthiconHost() {
  let node = null;
  const pending = [];
  const meter = { voices: 0, cpu: 0, level: 0, column: 0, peak: 0 };
  let onMeter = null;
  let onGrid = null;
  let patch = normalizeOrthicon(ORTH_DEFAULT);
  let grid = pictureGrid(patch.picture, patch.fLo, patch.fHi);
  let source = patch.picture;
  let label = '';
  let gen = { seed: 1, scale: 'major' };
  const undo = [];
  let rack = false;
  function remember() {
    undo.push({ grid: new Float32Array(grid), source, label });
    if (undo.length > 24) undo.shift();
  }
  function report() {
    const sum = summarizeGrid(grid, patch.fLo, patch.fHi);
    return {
      source, label, seed: gen.seed, scale: gen.scale,
      share: pictureShare(gen.seed, gen.scale),
      canUndo: undo.length > 0,
      energy: sum.energy, head: sum.head, tail: sum.tail, lit: sum.lit,
      startHz: sum.startHz, endHz: sum.endHz, digest: sum.digest,
    };
  }
  function send(m) {
    if (!m) return;
    let msg = m;
    if (m.t === 'grid' && m.data) msg = Object.assign({}, m, { data: new Float32Array(m.data) });
    if (!node) { pending.push(msg); return; }
    node.port.postMessage(msg);
  }
  function pushGrid() { send({ t: 'grid', data: grid }); }
  function adopt(next, name, caption) {
    // The page owns the patch. Sending one from here would race a knob change.
    // The caller marks the picture custom; the next setPatch keeps this grid.
    grid = next instanceof Float32Array ? next : Float32Array.from(next);
    source = name || 'custom';
    label = caption == null ? '' : caption;
    pushGrid();
    if (onGrid) onGrid();
    return grid;
  }
  function place(next, name, caption, over) {
    remember();
    const drawn = next instanceof Float32Array ? next : Float32Array.from(next);
    const mixed = over ? overGrid(grid, drawn) : drawn;
    adopt(mixed, name, caption);
    return report();
  }
  return {
    meter: () => meter,
    grid: () => grid,
    source: () => source,
    label: () => label,
    patch: () => patch,
    canUndo: () => undo.length > 0,
    setMeterListener(fn) { onMeter = fn; },
    setGridListener(fn) { onGrid = fn; },
    node: () => node,
    rack: () => rack,
    async attach(audioCtx, destination, engine) {
      if (node) return node;
      rack = isRack(engine);
      if (rack) engine.registerDevice(orthiconDevice);
      node = await createOrthiconNode(audioCtx, { destination: undefined, active: true, grid, patch });
      node.port.onmessage = e => {
        const m = e.data;
        if (!m || m.t !== 'meter') return;
        Object.assign(meter, m);
        if (onMeter) onMeter(meter);
      };
      let mixed = false;
      if (rack && typeof engine.addDevice === 'function') {
        try { engine.addDevice(orthiconDevice.id, node, patch); mixed = true; }
        catch (e) { mixed = false; }
      }
      if (!mixed && destination) node.connect(destination);
      pending.splice(0).forEach(m => send(m));
      pushGrid();
      return node;
    },
    setPatch(p) {
      const next = normalizeOrthicon(p);
      const pictureChanged = next.picture !== 'custom' && next.picture !== patch.picture;
      const regen = next.picture !== 'custom' && (
        next.picture !== patch.picture || next.fLo !== patch.fLo || next.fHi !== patch.fHi
      );
      // A factory picture replaces the canvas. Remember the one that was here
      // so Undo can put it back. A frequency tweak of the same picture does not.
      if (pictureChanged) remember();
      patch = next;
      send({ t: 'patch', p: patch });
      if (regen) {
        grid = pictureGrid(patch.picture, patch.fLo, patch.fHi);
        source = patch.picture;
        label = '';
        pushGrid();
        if (onGrid) onGrid();
      }
    },
    setActive(on) { send({ t: 'active', on: !!on }); },
    noteOn(n, vel) { send({ t: 'on', n, v: vel == null ? 0.8 : vel }); },
    noteOff(n) { send({ t: 'off', n }); },
    bend(v) { send({ t: 'bend', v }); },
    mod(v) { send({ t: 'mw', v }); },
    sustain(on) { send({ t: 'sus', on: !!on }); },
    panic() { send({ t: 'panic' }); },
    loadGrid: adopt,
    paintHz(hz) {
      const hit = paintTone(+hz || 440, patch.fLo, patch.fHi);
      adopt(hit.grid, 'paint');
      return { hz: hit.hz, row: hit.row };
    },
    clearGrid() {
      remember();
      adopt(new Float32Array(COLS * ROWS), 'custom', 'Cleared');
      return report();
    },
    pictures: () => DRAWN.map(d => ({ id: d.id, name: d.name })),
    drawPicture(id, opts) {
      const spec = DRAWN.find(d => d.id === id);
      if (!spec) return null;
      const over = !!(opts && opts.over);
      const next = drawnGrid(id, patch.fLo, patch.fHi);
      const caption = spec.name + (over ? ' · over' : '');
      return place(next, id, caption, over);
    },
    generate(seed, opts) {
      const o = opts || {};
      const scale = o.scale && o.scale !== 'off' ? o.scale : 'major';
      const made = generatePicture(seed, {
        scale, root: o.root == null ? patch.root : o.root, fLo: patch.fLo, fHi: patch.fHi,
      });
      gen = { seed: made.seed, scale: made.scale };
      const over = !!o.over;
      const caption = 'Generated ' + made.seed + ' · ' + made.scale + (over ? ' · over' : '');
      const info = place(made.grid, 'gen', caption, over);
      return Object.assign(info, { onScale: made.onScale, offScale: made.offScale });
    },
    undo() {
      const prev = undo.pop();
      if (!prev) return null;
      adopt(prev.grid, prev.source, prev.label);
      return report();
    },
    state: report,
    probe(id) {
      const spec = DRAWN.find(d => d.id === id);
      if (!spec) return null;
      const next = drawnGrid(id, 80, 8000);
      const sum = summarizeGrid(next, 80, 8000);
      return Object.assign({ id, name: spec.name }, sum);
    },
    async capture(audioCtx, sourceNode, seconds) {
      return recordOrthicon(audioCtx, sourceNode, seconds);
    },
  };
}

function section(tab, id, title) {
  const s = document.createElement('section');
  s.className = 'mod';
  s.dataset.dev = 'orthicon';
  s.dataset.tab = tab;
  s.id = id;
  const h = document.createElement('h3');
  h.innerHTML = '<span class="pilot"></span>' + title;
  s.appendChild(h);
  return s;
}

function setPath(obj, path, value) {
  const ks = path.split('.');
  let o = obj;
  for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
  o[ks[ks.length - 1]] = value;
}

export function mountOrthiconPanel(container, hooks) {
  const host = hooks.host;
  container.innerHTML = '';
  const stage = section('play', 'mOrthStage', 'Picture');
  stage.dataset.full = '';
  const canvas = document.createElement('canvas');
  canvas.id = 'orthiconCanvas';
  canvas.setAttribute('aria-label', 'Spectrogram. Time runs across, frequency runs up. Paint with the brushes.');
  stage.appendChild(canvas);
  const tools = document.createElement('div');
  tools.className = 'orth-tools';
  tools.id = 'orthiconBrushes';
  stage.appendChild(tools);
  const edits = document.createElement('div');
  edits.className = 'orth-tools';
  edits.id = 'orthiconEdits';
  stage.appendChild(edits);
  const srcRow = document.createElement('div');
  srcRow.className = 'row orth-tools';
  srcRow.id = 'orthiconSources';
  stage.appendChild(srcRow);
  const imageLabel = document.createElement('label');
  imageLabel.className = 'btn small filebtn';
  imageLabel.id = 'orthiconImageBtn';
  imageLabel.textContent = 'Image';
  const image = document.createElement('input');
  image.type = 'file';
  image.id = 'orthiconImage';
  image.accept = 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg';
  imageLabel.appendChild(image);
  const audioLabel = document.createElement('label');
  audioLabel.className = 'btn small filebtn';
  audioLabel.id = 'orthiconAudioBtn';
  audioLabel.textContent = 'Audio';
  const audio = document.createElement('input');
  audio.type = 'file';
  audio.id = 'orthiconAudio';
  audio.accept = 'audio/*,.wav,.mp3,.ogg,.flac,.aiff,.aif';
  audioLabel.appendChild(audio);
  const mic = document.createElement('button');
  mic.type = 'button'; mic.className = 'btn small'; mic.id = 'orthiconMic'; mic.textContent = 'Mic';
  const rack = document.createElement('button');
  rack.type = 'button'; rack.className = 'btn small'; rack.id = 'orthiconRack'; rack.textContent = 'Capture rack';
  rack.title = 'Record the rack and analyse it into the picture. Capture rack is an input, not an export.';
  srcRow.append(imageLabel, audioLabel, mic, rack);
  const name = document.createElement('div');
  name.className = 'note'; name.id = 'orthiconName';
  stage.appendChild(name);
  const hint = document.createElement('div');
  hint.className = 'note';
  hint.textContent = 'Paint time across and frequency up. The playhead scans the picture and resynthesizes it. Drop a PNG or JPG to play the picture, or load audio, the mic, or the rack. Capture rack is an input, not an export: it analyses the rack into this picture. Clear wipes the canvas. The pictures are drawn to be played: a harmonic stack, rising and falling sweeps, a formant choir, bell partials, a shimmer, rain, a spiral, and a starfield. Generate builds a new one from the seed, and the same seed is the same picture. Over paints on top of the canvas. Undo puts the previous picture back. A painting stays for this session. Keys mode: C4 is the picture\'s own pitch. The red rec button saves what you hear as a WAV.';
  stage.appendChild(hint);

  const scan = section('scan', 'mOrthScan', 'Scan');
  const choiceRow = document.createElement('div');
  choiceRow.className = 'chips'; choiceRow.id = 'orthiconChoices';
  scan.appendChild(choiceRow);
  const toggles = document.createElement('div');
  toggles.className = 'chips'; toggles.id = 'orthiconToggles';
  scan.appendChild(toggles);
  const knobsEl = document.createElement('div');
  knobsEl.className = 'knobs'; knobsEl.id = 'kOrthScan';
  scan.appendChild(knobsEl);
  const scanNote = document.createElement('div');
  scanNote.className = 'note';
  scanNote.textContent = 'Speed is columns per second. Hold freezes the playhead. Loop wraps the picture. The curve bends brightness into amplitude. Coherent phase keeps a steady tone; random phase stirs it. The scale mask silences rows that are off the scale.';
  scan.appendChild(scanNote);

  container.appendChild(stage);
  container.appendChild(scan);

  const knobs = {};
  function addKnob(path, label, min, max, step, fmt) {
    const read = () => path.split('.').reduce((o, k) => (o ? o[k] : 0), hooks.patch());
    const k = makeKnob(knobsEl, {
      label, min, max, step, value: read(), def: read(), fmt, title: label,
      onChange: v => { setPath(hooks.patch(), path, v); hooks.edited(); },
    });
    k.el.dataset.path = path;
    knobs[path] = k;
  }
  const hz = v => v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 1 : 2) + 'k' : Math.round(v) + '';
  addKnob('speed', 'speed', 0.25, 48, 0.01, v => v.toFixed(2));
  addKnob('fLo', 'low', 40, 800, 1, hz);
  addKnob('fHi', 'high', 400, 16000, 1, hz);
  addKnob('curve', 'curve', 0.3, 3, 0.01, v => v.toFixed(2));
  addKnob('width', 'width', 0, 1, 0.01, v => Math.round(v * 100) + '%');
  addKnob('level', 'level', 0, 1, 0.01, v => Math.round(v * 100) + '%');
  addKnob('brushSize', 'brush', 0.5, 8, 0.1, v => v.toFixed(1));

  function chip(parent, label, pressed, onClick) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = label;
    if (pressed) b.setAttribute('aria-pressed', 'true');
    b.addEventListener('click', onClick);
    parent.appendChild(b);
    return b;
  }
  const brushBtns = {};
  BRUSHES.forEach(id => {
    const label = id === 'erase' ? 'eraser' : id;
    brushBtns[id] = chip(tools, label, false, () => {
      hooks.patch().brush = id;
      hooks.edited();
      sync();
    });
    brushBtns[id].dataset.brush = id;
  });

  function edit(label, fn) {
    chip(edits, label, false, () => { fn(); });
  }
  function commit(next) {
    const p = hooks.patch();
    p.picture = 'custom';
    host.loadGrid(next, 'edit');
    hooks.edited();
    sync();
  }
  edit('smear', () => commit(smearGrid(host.grid(), COLS, ROWS, 0.45)));
  edit('blur', () => commit(blurGrid(host.grid(), COLS, ROWS, 0.6)));
  edit('shift −', () => {
    const p = hooks.patch();
    commit(shiftGrid(host.grid(), COLS, ROWS, -2, p.fLo, p.fHi));
  });
  edit('shift +', () => {
    const p = hooks.patch();
    commit(shiftGrid(host.grid(), COLS, ROWS, 2, p.fLo, p.fHi));
  });
  edit('stretch', () => commit(stretchGrid(host.grid(), COLS, ROWS, 1.5)));
  edit('freeze', () => {
    const p = hooks.patch();
    const col = Math.round((host.meter().column || 0) * (COLS - 1));
    freezeColumn(host.grid(), COLS, ROWS, col);
    p.picture = 'custom';
    p.hold = true;
    p.scan = col / Math.max(1, COLS - 1);
    host.loadGrid(host.grid(), 'freeze');
    hooks.edited();
    sync();
  });
  edit('quantize', () => {
    const p = hooks.patch();
    const scale = p.scale === 'off' ? 'major' : p.scale;
    quantizeGrid(host.grid(), COLS, ROWS, scale, p.root, p.fLo, p.fHi);
    p.scale = scale;
    p.picture = 'custom';
    host.loadGrid(host.grid(), 'quantize');
    hooks.edited();
    sync();
  });
  const clearBtn = chip(edits, 'clear', false, () => {
    hooks.wake();
    const p = hooks.patch();
    p.picture = 'custom';
    host.clearGrid();
    hooks.edited();
    sync();
  });
  clearBtn.id = 'orthiconClear';
  clearBtn.title = 'Wipe the canvas';
  const undoBtn = chip(edits, 'undo', false, () => {
    if (!host.canUndo()) return;
    const back = host.undo();
    if (!back) return;
    const p = hooks.patch();
    p.picture = 'custom';
    hooks.edited();
    sync();
  });
  undoBtn.id = 'orthiconUndo';
  undoBtn.title = 'Put back the picture from before the last clear, picture, or generate';

  const pics = document.createElement('div');
  pics.className = 'orth-tools';
  pics.id = 'orthiconPictures';
  stage.insertBefore(pics, hint);
  const picBtns = {};
  host.pictures().forEach(spec => {
    const b = chip(pics, spec.name, false, () => loadDrawn(spec.id));
    b.dataset.picture = spec.id;
    b.title = spec.name;
    picBtns[spec.id] = b;
  });

  const genRow = document.createElement('div');
  genRow.className = 'orth-tools';
  genRow.id = 'orthiconGenerateRow';
  stage.insertBefore(genRow, hint);
  const seedInput = document.createElement('input');
  seedInput.type = 'number';
  seedInput.id = 'orthiconSeed';
  seedInput.min = '1';
  seedInput.step = '1';
  seedInput.value = '1';
  seedInput.setAttribute('aria-label', 'Generate seed');
  seedInput.title = 'Seed. The same seed draws the same picture.';
  const genBtn = document.createElement('button');
  genBtn.type = 'button';
  genBtn.className = 'btn small';
  genBtn.id = 'orthiconGenerate';
  genBtn.textContent = 'Generate';
  genRow.append(seedInput, genBtn);
  let paintOver = false;
  const overBtn = chip(genRow, 'over', false, () => {
    paintOver = !paintOver;
    sync();
  });
  overBtn.id = 'orthiconOver';
  overBtn.title = 'Paint the picture on top of the canvas instead of replacing it';
  const linkBtn = document.createElement('button');
  linkBtn.type = 'button';
  linkBtn.className = 'btn small';
  linkBtn.id = 'orthiconLink';
  linkBtn.textContent = 'Copy link';
  linkBtn.title = 'Copy a link that rebuilds this generated picture';
  genRow.append(linkBtn);

  function loadDrawn(id) {
    hooks.wake();
    const p = hooks.patch();
    const info = host.drawPicture(id, { over: paintOver });
    if (!info) return;
    p.picture = 'custom';
    hooks.edited();
    sync();
  }
  function runGenerate() {
    hooks.wake();
    const p = hooks.patch();
    const scale = p.scale && p.scale !== 'off' ? p.scale : 'major';
    const info = host.generate(seedInput.value, { scale, root: p.root, over: paintOver });
    p.picture = 'custom';
    if (document.activeElement !== seedInput) seedInput.value = String(info.seed);
    hooks.edited();
    sync();
  }
  genBtn.addEventListener('click', runGenerate);
  seedInput.addEventListener('change', () => { seedInput.value = String(Math.max(1, Math.floor(+seedInput.value || 1))); });
  seedInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); runGenerate(); } e.stopPropagation(); });
  linkBtn.addEventListener('click', () => {
    const info = host.state();
    const url = new URL(location.href);
    url.searchParams.set('or', info.share);
    try { history.replaceState(null, '', url); } catch (e) { /* keep the string */ }
    const text = url.toString();
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
    if (hooks.toast) hooks.toast('Link copied. Seed ' + info.share + ' draws the same picture.');
  });

  const choiceBtns = [];
  function choices(path, values, labels) {
    values.forEach(v => {
      const b = chip(choiceRow, (labels && labels[v]) || v, false, () => {
        setPath(hooks.patch(), path, v);
        hooks.edited();
        sync();
      });
      b.dataset.path = path;
      b.dataset.v = v;
      choiceBtns.push(b);
    });
  }
  choices('phase', PHASES, { coherent: 'coherent', random: 'random' });
  choices('engine', ENGINES, { add: 'additive', ifft: 'inverse FFT' });
  choices('scale', SCALES, null);

  const toggleBtns = {};
  [['loop', 'loop'], ['hold', 'hold'], ['keyboard', 'keys']].forEach(([path, label]) => {
    toggleBtns[path] = chip(toggles, label, false, () => {
      const p = hooks.patch();
      p[path] = !p[path];
      hooks.edited();
      sync();
    });
  });

  const off = document.createElement('canvas');
  off.width = COLS; off.height = ROWS;
  const offCtx = off.getContext('2d', { willReadFrequently: true });
  const img = offCtx.createImageData(COLS, ROWS);
  let playCol = 0;

  function draw() {
    const g = host.grid();
    const pix = img.data;
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const mag = g ? g[c * ROWS + r] : 0;
        const y = ROWS - 1 - r;
        const t = r / (ROWS - 1);
        const i = (y * COLS + c) * 4;
        const lit = Math.pow(Math.max(0, Math.min(1, mag)), 0.75);
        pix[i] = (18 + lit * (210 * (1 - t) + 70 * t)) | 0;
        pix[i + 1] = (16 + lit * (90 * (1 - t) + 210 * t)) | 0;
        pix[i + 2] = (22 + lit * (28 * (1 - t) + 80 * t)) | 0;
        pix[i + 3] = 255;
      }
    }
    offCtx.putImageData(img, 0, 0);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(2, Math.round((rect.width || canvas.clientWidth || 640) * dpr));
    const h = Math.max(2, Math.round((rect.height || 280) * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#10141a';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(off, 0, 0, w, h);
    const x = Math.max(0, Math.min(w - 1, playCol * w));
    ctx.strokeStyle = 'rgba(230, 245, 220, 0.85)';
    ctx.lineWidth = Math.max(1, dpr);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  function sync() {
    const p = hooks.patch();
    Object.keys(knobs).forEach(path => {
      const v = path.split('.').reduce((o, k) => (o ? o[k] : 0), p);
      if (knobs[path]) knobs[path].set(v);
    });
    Object.keys(brushBtns).forEach(id => brushBtns[id].setAttribute('aria-pressed', String(p.brush === id)));
    choiceBtns.forEach(b => b.setAttribute('aria-pressed', String(p[b.dataset.path] === b.dataset.v)));
    toggleBtns.loop.setAttribute('aria-pressed', String(!!p.loop));
    toggleBtns.hold.setAttribute('aria-pressed', String(!!p.hold));
    toggleBtns.keyboard.setAttribute('aria-pressed', String(!!p.keyboard));
    toggleBtns.keyboard.textContent = p.keyboard ? 'keys on' : 'keys';
    const src = host.source();
    const caption = host.label();
    name.textContent = caption ? caption : src === 'image' ? 'Image' : src === 'audio' ? 'Analysed audio' : src === 'mic' ? 'Microphone' : src === 'rack' ? 'Rack capture' : src === 'paint' || src === 'edit' || src === 'custom' || src === 'freeze' || src === 'quantize' ? 'Painted picture' : (p.name || 'Orthicon');
    Object.keys(picBtns).forEach(id => picBtns[id].setAttribute('aria-pressed', String(src === id)));
    overBtn.setAttribute('aria-pressed', String(paintOver));
    undoBtn.disabled = !host.canUndo();
    if (document.activeElement !== seedInput) seedInput.value = String(host.state().seed);
    draw();
  }

  let last = null;
  let seed = 1;
  let sendT = 0;
  function xy(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width))),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / Math.max(1, r.height))),
    };
  }
  function stamp(a, b) {
    const p = hooks.patch();
    paintStroke(host.grid(), COLS, ROWS, {
      brush: p.brush || 'soft',
      amount: p.brush === 'erase' ? 0.85 : 0.92,
      radius: p.brushSize || 1.8,
      x0: a.x, y0: a.y, x1: b.x, y1: b.y, seed: seed++,
    }, p.fLo, p.fHi);
    if (p.picture !== 'custom') p.picture = 'custom';
    if (!sendT) {
      sendT = requestAnimationFrame(() => {
        sendT = 0;
        host.loadGrid(host.grid(), p.brush === 'erase' ? 'edit' : 'paint');
        draw();
      });
    } else draw();
  }
  canvas.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    e.preventDefault();
    hooks.wake();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* already captured */ }
    last = xy(e);
    stamp(last, last);
  });
  canvas.addEventListener('pointermove', e => {
    if (!canvas.hasPointerCapture(e.pointerId) || !last) return;
    const p = xy(e);
    stamp(last, p);
    last = p;
  });
  const up = e => {
    if (!last) return;
    last = null;
    if (sendT) { cancelAnimationFrame(sendT); sendT = 0; host.loadGrid(host.grid(), 'paint'); }
    hooks.edited();
    sync();
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  ;['dragenter', 'dragover'].forEach(ev => canvas.addEventListener(ev, e => { e.preventDefault(); canvas.classList.add('over'); }));
  canvas.addEventListener('dragleave', () => canvas.classList.remove('over'));
  canvas.addEventListener('drop', e => {
    e.preventDefault();
    canvas.classList.remove('over');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) takeFile(f);
  });
  image.addEventListener('change', () => { const f = image.files && image.files[0]; if (f) takeImage(f); image.value = ''; });
  audio.addEventListener('change', () => { const f = audio.files && audio.files[0]; if (f) takeAudio(f); audio.value = ''; });

  function isImage(f) {
    const n = (f.name || '').toLowerCase();
    return (f.type || '').startsWith('image/') || /\.(png|jpe?g|gif|webp)$/.test(n);
  }
  function takeFile(f) { if (isImage(f)) takeImage(f); else takeAudio(f); }

  async function takeImage(f) {
    hooks.wake();
    try {
      const bmp = await createImageBitmap(f);
      const cnv = document.createElement('canvas');
      cnv.width = COLS; cnv.height = ROWS;
      const g = cnv.getContext('2d', { willReadFrequently: true });
      g.drawImage(bmp, 0, 0, COLS, ROWS);
      const data = g.getImageData(0, 0, COLS, ROWS).data;
      const next = imageToGrid(data, COLS, ROWS);
      bmp.close && bmp.close();
      const p = hooks.patch();
      p.picture = 'custom';
      host.loadGrid(next, 'image');
      hooks.edited();
      name.textContent = f.name || 'Image';
      sync();
    } catch (e) {
      hooks.toast('That image could not be read.');
    }
  }
  async function takeAudio(f) {
    hooks.wake();
    try {
      const engine = await hooks.whenReady();
      const buf = await f.arrayBuffer();
      const audioBuf = await engine.ctx.decodeAudioData(buf.slice(0));
      const L = audioBuf.getChannelData(0);
      const p = hooks.patch();
      const next = analyzeBuffer(L, audioBuf.sampleRate, p.fLo, p.fHi);
      p.picture = 'custom';
      host.loadGrid(next, 'audio');
      hooks.edited();
      name.textContent = f.name || 'Audio';
      sync();
    } catch (e) {
      hooks.toast('That file could not be read as audio.');
    }
  }
  async function recordMic() {
    hooks.wake();
    let stream = null;
    try {
      const engine = await hooks.whenReady();
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const src = engine.ctx.createMediaStreamSource(stream);
      hooks.toast('Listening…');
      mic.setAttribute('aria-pressed', 'true');
      const rec = await host.capture(engine.ctx, src, 3);
      const p = hooks.patch();
      const next = analyzeBuffer(rec.L, rec.sr, p.fLo, p.fHi);
      p.picture = 'custom';
      host.loadGrid(next, 'mic');
      hooks.edited();
      sync();
      hooks.toast('Microphone take analysed.');
    } catch (e) {
      hooks.toast('Microphone permission was blocked.');
    } finally {
      mic.setAttribute('aria-pressed', 'false');
      if (stream) stream.getTracks().forEach(t => t.stop());
    }
  }
  async function recordRack() {
    hooks.wake();
    try {
      const engine = await hooks.whenReady();
      if (!engine.master) { hooks.toast('The rack output is not ready.'); return; }
      hooks.toast('Capturing the rack…');
      rack.setAttribute('aria-pressed', 'true');
      const rec = await host.capture(engine.ctx, engine.master, 2);
      const p = hooks.patch();
      const next = analyzeBuffer(rec.L, rec.sr, p.fLo, p.fHi);
      p.picture = 'custom';
      host.loadGrid(next, 'rack');
      hooks.edited();
      sync();
      hooks.toast('Rack capture analysed.');
    } catch (e) {
      hooks.toast('The rack capture did not finish.');
    } finally {
      rack.setAttribute('aria-pressed', 'false');
    }
  }
  mic.addEventListener('click', () => recordMic());
  rack.addEventListener('click', () => recordRack());

  host.setMeterListener(m => {
    playCol = m.column || 0;
    if (canvas.offsetParent) draw();
  });
  host.setGridListener(() => { if (!last) sync(); });
  window.addEventListener('resize', draw);
  sync();
  return { sync, draw };
}
