// Mote on the page: the panel, the waveform, and the dxrack/1 adapter.
//
// create(ctx, host) returns the stereo worklet. Sources are buffers: a shipped
// sound, a decoded file, a microphone take, or a capture of another node.
// The adapter does not import Filament's engine.

import { makeKnob } from './knob.js';
import { moteDevice, normalizeMote, MOTE_DEFAULT, MOTE_FILES, WINDOWS, LFO_DEST } from './mote.js';

const WORKLET = new URL('./mote.worklet.js', import.meta.url).href;

export async function createMoteNode(ctx, { patch, events, active, destination, buffer } = {}) {
  if (!ctx.__mote) { await ctx.audioWorklet.addModule(WORKLET); ctx.__mote = true; }
  const node = new AudioWorkletNode(ctx, 'mote', {
    numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
    processorOptions: {
      patch: normalizeMote(patch),
      events: events || [],
      active: active !== false,
      buffer: buffer || null,
    },
  });
  if (destination) node.connect(destination);
  return node;
}

export async function renderMote({ patch, events = [], seconds = 1, sampleRate = 48000, buffer } = {}) {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const ev = events.map(e => Object.assign({}, e, { at: e.at == null ? 0 : Math.round(e.at * sampleRate) }));
  const node = await createMoteNode(ctx, { patch, events: ev, active: true, destination: ctx.destination, buffer });
  const buf = await ctx.startRendering();
  try { node.disconnect(); } catch (e) { /* the context is already closed */ }
  return buf;
}

function isRack(engine) {
  return !!(engine && engine.api === 'dxrack/1' && typeof engine.registerDevice === 'function');
}

// Record whatever is connected to a capture worklet. Resolves with {L, R, sr, n}.
export async function recordNode(ctx, source, seconds) {
  if (!ctx.__mote) { await ctx.audioWorklet.addModule(WORKLET); ctx.__mote = true; }
  if (ctx.state !== 'running') await ctx.resume();
  const cap = new AudioWorkletNode(ctx, 'mote-capture', {
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

moteDevice.create = async function create(ctx, host) {
  host = host || {};
  return createMoteNode(ctx, {
    patch: host.patch, events: host.events, active: host.active !== false, buffer: host.buffer,
    destination: host.destination,
  });
};

export function createMoteHost() {
  let node = null;
  const pending = [];
  const meter = { grains: 0, voices: 0, cpu: 0, level: 0, position: 0, parts: [], source: '' };
  let onMeter = null;
  let onBuffer = null;
  let patch = normalizeMote(MOTE_DEFAULT);
  let buffer = null;
  let rack = false;
  function send(m) {
    if (!m) return;
    let msg = m;
    if (m.L) msg = Object.assign({}, m, { L: new Float32Array(m.L), R: new Float32Array(m.R || m.L) });
    if (!node) { pending.push(msg); return; }
    const transfer = [];
    if (msg.L && msg.L.buffer) transfer.push(msg.L.buffer);
    if (msg.R && msg.R.buffer && msg.R.buffer !== msg.L.buffer) transfer.push(msg.R.buffer);
    if (transfer.length) node.port.postMessage(msg, transfer);
    else node.port.postMessage(msg);
  }
  function loadChannels(L, R, sr, name) {
    const left = L instanceof Float32Array ? L : Float32Array.from(L || []);
    const right = R ? (R instanceof Float32Array ? R : Float32Array.from(R)) : left;
    buffer = { L: left, R: right, sr: sr || 48000, name: name || 'buffer' };
    send({ t: 'buffer', L: buffer.L, R: buffer.R, sr: buffer.sr, name: buffer.name });
    if (onBuffer) onBuffer(buffer);
    return buffer;
  }
  return {
    meter: () => meter,
    buffer: () => buffer,
    setMeterListener(fn) { onMeter = fn; },
    setBufferListener(fn) { onBuffer = fn; },
    node: () => node,
    rack: () => rack,
    async attach(audioCtx, destination, engine) {
      if (node) return node;
      rack = isRack(engine);
      if (rack) engine.registerDevice(moteDevice);
      node = await createMoteNode(audioCtx, { destination: undefined, active: true, buffer });
      node.port.onmessage = e => {
        const m = e.data;
        if (!m || m.t !== 'meter') return;
        Object.assign(meter, m);
        if (onMeter) onMeter(meter);
      };
      let mixed = false;
      if (rack && typeof engine.addDevice === 'function') {
        try { engine.addDevice(moteDevice.id, node, patch); mixed = true; }
        catch (e) { mixed = false; }
      }
      if (!mixed && destination) node.connect(destination);
      pending.splice(0).forEach(m => send(m));
      return node;
    },
    setPatch(p) { patch = normalizeMote(p); send({ t: 'patch', p: patch }); },
    setActive(on) { send({ t: 'active', on: !!on }); },
    noteOn(n, vel) { send({ t: 'on', n, v: vel == null ? 0.8 : vel }); },
    noteOff(n) { send({ t: 'off', n }); },
    bend(v) { send({ t: 'bend', v }); },
    mod(v) { send({ t: 'mw', v }); },
    sustain(on) { send({ t: 'sus', on: !!on }); },
    panic() { send({ t: 'panic' }); },
    loadChannels,
    async capture(audioCtx, source, seconds, name) {
      const rec = await recordNode(audioCtx, source, seconds);
      return loadChannels(rec.L, rec.R, rec.sr, name || 'capture');
    },
  };
}

function section(tab, id, title) {
  const s = document.createElement('section');
  s.className = 'mod';
  s.dataset.dev = 'mote';
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

export function mountMotePanel(container, hooks) {
  container.innerHTML = '';
  const stage = section('play', 'mMoteStage', 'Grains');
  stage.dataset.full = '';
  const drop = document.createElement('div');
  drop.className = 'mote-drop';
  drop.id = 'moteDrop';
  const wave = document.createElement('canvas');
  wave.id = 'moteWave';
  wave.setAttribute('aria-label', 'Waveform. Drag to move the grain position.');
  const parts = document.createElement('canvas');
  parts.id = 'moteParts';
  parts.setAttribute('aria-hidden', 'true');
  drop.appendChild(wave);
  drop.appendChild(parts);
  stage.appendChild(drop);
  const srcRow = document.createElement('div');
  srcRow.className = 'row mote-src';
  srcRow.id = 'moteSources';
  stage.appendChild(srcRow);
  const fileLabel = document.createElement('label');
  fileLabel.className = 'btn small filebtn';
  fileLabel.id = 'moteFileBtn';
  fileLabel.textContent = 'Load file';
  const file = document.createElement('input');
  file.type = 'file';
  file.id = 'moteFile';
  file.accept = 'audio/*,.wav,.mp3,.ogg,.flac,.aiff,.aif';
  fileLabel.appendChild(file);
  const mic = document.createElement('button');
  mic.type = 'button'; mic.className = 'btn small'; mic.id = 'moteMic'; mic.textContent = 'Mic';
  const rack = document.createElement('button');
  rack.type = 'button'; rack.className = 'btn small'; rack.id = 'moteRack'; rack.textContent = 'Capture rack';
  const freeze = document.createElement('button');
  freeze.type = 'button'; freeze.className = 'chip'; freeze.id = 'moteFreeze'; freeze.textContent = 'freeze';
  const keys = document.createElement('button');
  keys.type = 'button'; keys.className = 'chip'; keys.id = 'moteKeys'; keys.textContent = 'keys';
  srcRow.appendChild(fileLabel); srcRow.appendChild(mic); srcRow.appendChild(rack);
  srcRow.appendChild(freeze); srcRow.appendChild(keys);
  const name = document.createElement('div');
  name.className = 'note'; name.id = 'moteName';
  stage.appendChild(name);
  const hint = document.createElement('div');
  hint.className = 'note';
  hint.textContent = 'Drag the highlighted region to move the grains. Drop a WAV or MP3, record the mic, or capture whatever the rack is playing. A loaded file stays for this session. Keys mode plays pitch from the keyboard, with C4 at the sample pitch.';
  stage.appendChild(hint);

  const grain = section('grain', 'mMoteGrain', 'Shape');
  const win = document.createElement('div');
  win.className = 'chips'; win.id = 'moteWin';
  grain.appendChild(win);
  const kGrain = document.createElement('div');
  kGrain.className = 'knobs'; kGrain.id = 'kMoteGrain';
  grain.appendChild(kGrain);

  const space = section('space', 'mMoteSpace', 'Space');
  const lfo = document.createElement('div');
  lfo.className = 'chips'; lfo.id = 'moteLfo';
  space.appendChild(lfo);
  const kLfo = document.createElement('div');
  kLfo.className = 'knobs'; kLfo.id = 'kMoteLfo';
  space.appendChild(kLfo);
  const kTail = document.createElement('div');
  kTail.className = 'knobs'; kTail.id = 'kMoteTail';
  space.appendChild(kTail);
  const spaceNote = document.createElement('div');
  spaceNote.className = 'note';
  spaceNote.textContent = 'The LFO moves one control. Delay and reverb are a tail on this device, for long textures.';
  space.appendChild(spaceNote);

  container.appendChild(stage); container.appendChild(grain); container.appendChild(space);

  const knobs = {};
  function addKnob(host, path, label, min, max, step, fmt) {
    const read = () => path.split('.').reduce((o, k) => (o ? o[k] : 0), hooks.patch());
    const k = makeKnob(host, {
      label, min, max, step, value: read(), def: read(), fmt, title: label,
      onChange: v => { setPath(hooks.patch(), path, v); hooks.edited(); draw(); },
    });
    k.el.dataset.path = path;
    knobs[path] = k;
  }
  const ms = v => (v < 100 ? v.toFixed(0) : Math.round(v)) + ' ms';
  const pct = v => Math.round(v * 100) + '%';
  addKnob(kGrain, 'grain.size', 'size', 5, 400, 1, ms);
  addKnob(kGrain, 'grain.density', 'density', 0.5, 60, 0.1, v => v.toFixed(1) + '/s');
  addKnob(kGrain, 'grain.position', 'position', 0, 1, 0.001, v => Math.round(v * 100) + '%');
  addKnob(kGrain, 'grain.spray', 'spray', 0, 1, 0.001, pct);
  addKnob(kGrain, 'grain.pitch', 'pitch', -24, 24, 0.01, v => (v > 0 ? '+' : '') + v.toFixed(1));
  addKnob(kGrain, 'grain.pitchRand', 'pitch ±', 0, 12, 0.01, v => v.toFixed(1));
  addKnob(kGrain, 'grain.reverse', 'reverse', 0, 1, 0.001, pct);
  addKnob(kGrain, 'grain.spread', 'spread', 0, 1, 0.001, pct);
  addKnob(kGrain, 'level', 'level', 0, 1, 0.001, pct);
  addKnob(kLfo, 'lfo.rate', 'lfo', 0.02, 8, 0.01, v => v.toFixed(2) + ' Hz');
  addKnob(kLfo, 'lfo.depth', 'depth', 0, 1, 0.001, pct);
  addKnob(kTail, 'tail.delay', 'delay', 0.02, 0.9, 0.001, v => Math.round(v * 1000) + ' ms');
  addKnob(kTail, 'tail.feedback', 'feedback', 0, 0.85, 0.001, pct);
  addKnob(kTail, 'tail.reverb', 'reverb', 0, 1, 0.001, pct);
  addKnob(kTail, 'tail.mix', 'tail', 0, 1, 0.001, pct);

  function chips(host, path, values, labels) {
    host.innerHTML = '';
    values.forEach(v => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.v = v;
      b.textContent = (labels && labels[v]) || v;
      b.addEventListener('click', () => { setPath(hooks.patch(), path, v); hooks.edited(); sync(); });
      host.appendChild(b);
    });
  }
  chips(win, 'grain.window', WINDOWS, { hann: 'hann', tri: 'triangle', plank: 'plank', gauss: 'gauss' });
  chips(lfo, 'lfo.dest', LFO_DEST, { position: 'position', size: 'size', density: 'density', pitch: 'pitch', spray: 'spray' });

  MOTE_FILES.forEach(s => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.src = s.id; b.textContent = s.label;
    b.addEventListener('click', () => { hooks.patch().source = s.id; hooks.edited(); loadShipped(s.id); sync(); });
    srcRow.insertBefore(b, fileLabel);
  });

  let peaks = null;
  let peakN = 0;
  let particles = [];
  let reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduced = false; }

  function fit(canvas) {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(10, Math.round(r.width * dpr));
    const h = Math.max(10, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return { c: canvas.getContext('2d'), w, h, dpr };
  }
  function rebuildPeaks() {
    const buf = hooks.buffer && hooks.buffer();
    const L = buf && buf.L;
    if (!L || !L.length) { peaks = null; peakN = 0; return; }
    const cols = 480;
    peaks = new Float32Array(cols);
    const step = L.length / cols;
    for (let i = 0; i < cols; i++) {
      const a = (i * step) | 0;
      const b = Math.min(L.length, ((i + 1) * step) | 0);
      let m = 0;
      for (let j = a; j < b; j += 4) { const v = Math.abs(L[j]); if (v > m) m = v; }
      peaks[i] = m;
    }
    peakN = L.length;
  }
  function draw() {
    const f = fit(wave); if (!f) return;
    const { c, w, h } = f;
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#0c1218';
    c.fillRect(0, 0, w, h);
    const p = hooks.patch();
    const pos = p.grain.position;
    const spray = p.grain.spray;
    const x0 = Math.max(0, (pos - spray * 0.5) * w);
    const x1 = Math.min(w, (pos + spray * 0.5) * w);
    c.fillStyle = 'rgba(126, 224, 255, 0.16)';
    c.fillRect(x0, 0, Math.max(2, x1 - x0), h);
    c.fillStyle = 'rgba(126, 224, 255, 0.9)';
    c.fillRect(pos * w - 1, 0, 2, h);
    c.strokeStyle = 'rgba(180, 210, 230, 0.85)';
    c.beginPath();
    const mid = h * 0.55;
    if (peaks) {
      for (let i = 0; i < peaks.length; i++) {
        const x = (i / peaks.length) * w;
        const amp = peaks[i] * (h * 0.42);
        c.moveTo(x, mid - amp);
        c.lineTo(x, mid + amp);
      }
    }
    c.stroke();
  }
  function drawParts() {
    const f = fit(parts); if (!f) return;
    const { c, w, h } = f;
    c.clearRect(0, 0, w, h);
    particles.forEach(pt => {
      const x = pt.u * w;
      const y = h * (0.72 - pt.rise) + pt.pan * h * 0.18;
      c.fillStyle = pt.rev ? 'rgba(255, 196, 120, ' + pt.a + ')' : 'rgba(190, 245, 255, ' + pt.a + ')';
      c.fillRect(x, y, Math.max(1.5, 3 * f.dpr), Math.max(1.5, 3 * f.dpr));
    });
  }
  function ingestParts(list) {
    (list || []).forEach(g => {
      particles.push({ u: g.u, pan: g.pan || 0, a: 0.35 + 0.65 * Math.max(0, g.life || 0), rise: 0, rev: !!g.rev });
    });
    if (particles.length > 80) particles.splice(0, particles.length - 80);
  }
  let raf = 0;
  function tick() {
    raf = requestAnimationFrame(tick);
    if (document.hidden) return;
    if (!reduced) particles.forEach(pt => { pt.rise += 0.004; pt.a *= 0.985; });
    particles = particles.filter(pt => pt.a > 0.05 && pt.rise < 0.8);
    if (stage.offsetParent) { drawParts(); }
  }
  raf = requestAnimationFrame(tick);

  function sync() {
    const p = hooks.patch();
    Object.keys(knobs).forEach(path => {
      const v = path.split('.').reduce((o, k) => (o ? o[k] : 0), p);
      knobs[path].set(v);
    });
    win.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === p.grain.window)));
    lfo.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === p.lfo.dest)));
    srcRow.querySelectorAll('[data-src]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.src === p.source)));
    freeze.setAttribute('aria-pressed', String(!!p.grain.freeze));
    freeze.textContent = p.grain.freeze ? 'frozen' : 'freeze';
    keys.setAttribute('aria-pressed', String(!!p.grain.keyboard));
    keys.textContent = p.grain.keyboard ? 'keys on' : 'keys';
    const buf = hooks.buffer && hooks.buffer();
    name.textContent = (buf && buf.name) ? buf.name : (p.source || 'Mote');
    draw();
  }
  function setPosition(clientX) {
    const r = wave.getBoundingClientRect();
    if (!r.width) return;
    const v = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    hooks.patch().grain.position = v;
    hooks.edited();
    if (knobs['grain.position']) knobs['grain.position'].set(v);
    draw();
  }
  drop.addEventListener('pointerdown', e => {
    if (e.target.closest('button, label, input')) return;
    e.preventDefault();
    drop.setPointerCapture(e.pointerId);
    setPosition(e.clientX);
  });
  drop.addEventListener('pointermove', e => {
    if (!drop.hasPointerCapture(e.pointerId)) return;
    setPosition(e.clientX);
  });
  ;['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    drop.classList.remove('over');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) takeFile(f);
  });
  file.addEventListener('change', () => { const f = file.files && file.files[0]; if (f) takeFile(f); file.value = ''; });
  freeze.addEventListener('click', () => {
    const p = hooks.patch();
    p.grain.freeze = !p.grain.freeze;
    hooks.edited();
    sync();
  });
  keys.addEventListener('click', () => {
    const p = hooks.patch();
    p.grain.keyboard = !p.grain.keyboard;
    hooks.edited();
    sync();
  });
  mic.addEventListener('click', () => recordMic());
  rack.addEventListener('click', () => recordRack());

  let loaded = '';
  async function decodeToHost(arr, label) {
    hooks.wake();
    const engine = await hooks.whenReady();
    const ctx = engine.ctx;
    if (ctx.state !== 'running') { try { await ctx.resume(); } catch (e) { /* decode still works suspended */ } }
    const audio = await ctx.decodeAudioData(arr.slice(0));
    const L = audio.getChannelData(0);
    const R = audio.numberOfChannels > 1 ? audio.getChannelData(1) : L;
    hooks.load(L, R, audio.sampleRate, label);
    rebuildPeaks();
    name.textContent = label;
    draw();
  }
  async function loadShipped(id) {
    const spec = MOTE_FILES.find(s => s.id === id);
    if (!spec) return;
    loaded = id;
    try {
      const res = await fetch(new URL('./sources/' + id + '.wav', import.meta.url));
      if (!res.ok) throw new Error('missing ' + id);
      await decodeToHost(await res.arrayBuffer(), spec.label);
    } catch (e) {
      hooks.toast('Could not load the ' + spec.label + ' sound.');
    }
  }
  async function takeFile(f) {
    hooks.wake();
    try {
      const arr = await f.arrayBuffer();
      hooks.patch().source = 'file';
      hooks.edited();
      loaded = 'file:' + f.name;
      await decodeToHost(arr, f.name);
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
      const rec = await recordNode(engine.ctx, src, 4);
      hooks.patch().source = 'mic';
      hooks.edited();
      loaded = 'mic';
      hooks.load(rec.L, rec.R, rec.sr, 'Microphone');
      rebuildPeaks();
      sync();
      hooks.toast('Microphone take loaded.');
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
      const rec = await recordNode(engine.ctx, engine.master, 3);
      hooks.patch().source = 'rack';
      hooks.edited();
      loaded = 'rack';
      hooks.load(rec.L, rec.R, rec.sr, 'Rack');
      rebuildPeaks();
      sync();
      hooks.toast('Rack capture loaded.');
    } catch (e) {
      hooks.toast('The rack capture did not finish.');
    } finally {
      rack.setAttribute('aria-pressed', 'false');
    }
  }

  hooks.onParts = ingestParts;
  hooks.onBuffer = () => { rebuildPeaks(); draw(); };
  window.addEventListener('resize', draw);
  sync();
  const boot = hooks.patch().source;
  if (MOTE_FILES.some(s => s.id === boot)) {
    hooks.whenReady().then(() => { if (loaded !== boot && hooks.patch().source === boot) loadShipped(boot); });
  }
  return {
    sync() {
      const p = hooks.patch();
      if (MOTE_FILES.some(s => s.id === p.source) && loaded !== p.source) loadShipped(p.source);
      sync();
    },
    stop() { cancelAnimationFrame(raf); },
  };
}
