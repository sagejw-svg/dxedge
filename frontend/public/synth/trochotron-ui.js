// Trochotron on the page: the seed, the fractal, and the note strip.
// The score is built on the main thread. The worklet is what plays it.

import { trochotronDevice, normalizeTrochotron, TROCHO_DEFAULT } from './trochotron.js';
import { pieceOf, shareOf, parseShare, midiOf, logisticR, GENERATORS, SCALE_NAMES, KEYS, ROUTES } from './trochotron-gen.js';

const WORKLET = new URL('./trochotron.worklet.js', import.meta.url).href;
const GEN_LABEL = {
  lsystem: 'L-system', mandelbrot: 'Mandelbrot', julia: 'Julia',
  logistic: 'Logistic', lorenz: 'Lorenz', thue: 'Digits',
};

function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }

export async function createTrochotronNode(ctx, { patch, notes, events, active, destination, playing } = {}) {
  if (!ctx.__trochotron) { await ctx.audioWorklet.addModule(WORKLET); ctx.__trochotron = true; }
  const node = new AudioWorkletNode(ctx, 'trochotron', {
    numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
    processorOptions: {
      patch: normalizeTrochotron(patch),
      notes: notes || [],
      events: events || [],
      active: active !== false,
      playing: !!playing,
    },
  });
  if (destination) node.connect(destination);
  return node;
}

export async function renderTrochotronBuffer({ patch, events = [], seconds = 1, sampleRate = 48000, playing, notes } = {}) {
  const p = normalizeTrochotron(patch);
  const piece = notes ? { notes } : pieceOf(p);
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const ev = events.map(e => Object.assign({}, e, { at: e.at == null ? 0 : Math.round(e.at * sampleRate) }));
  const node = await createTrochotronNode(ctx, {
    patch: p, notes: piece.notes, events: ev, active: true, destination: ctx.destination, playing: playing !== false,
  });
  const buf = await ctx.startRendering();
  try { node.disconnect(); } catch (e) { /* already closed */ }
  return buf;
}

function isRack(engine) {
  return !!(engine && engine.api === 'dxrack/1' && typeof engine.registerDevice === 'function');
}

export function createTrochotronHost() {
  let node = null;
  const pending = [];
  const meter = { voices: 0, peak: 0, beat: 0, playing: false, cpu: 0 };
  let onMeter = null;
  let onPiece = null;
  let patch = normalizeTrochotron(TROCHO_DEFAULT);
  let piece = pieceOf(patch);
  let rack = false;
  let hooks = {};
  const routeHolds = new Map();
  function send(m) {
    if (!m) return;
    if (!node) { pending.push(m); return; }
    node.port.postMessage(m);
  }
  function dropRoute() {
    const dest = patch.route;
    routeHolds.forEach((count, n) => { if (count && hooks.route) hooks.route(dest, false, n, 0); });
    routeHolds.clear();
    if (hooks.routeEnd) hooks.routeEnd(dest);
  }
  function takeEdges(edges) {
    if (!edges) return;
    const dest = patch.route;
    edges.forEach(e => {
      if (!e) return;
      if (dest && dest !== 'internal' && hooks.route) {
        const prev = routeHolds.get(e.n) || 0;
        if (e.kind === 'on') {
          routeHolds.set(e.n, prev + 1);
          if (prev === 0) hooks.route(dest, true, e.n, e.v);
        } else {
          const next = prev - 1;
          if (next <= 0) { routeHolds.delete(e.n); hooks.route(dest, false, e.n, 0); }
          else routeHolds.set(e.n, next);
        }
      }
    });
  }
  function pushPiece(restart) {
    piece = pieceOf(patch);
    send({ t: 'piece', notes: piece.notes, bpm: patch.tempo });
    if (restart && meter.playing) send({ t: 'play' });
    if (onPiece) onPiece(piece);
  }
  return {
    meter: () => meter,
    piece: () => piece,
    patch: () => patch,
    setHooks(h) { hooks = h || {}; },
    setMeterListener(fn) { onMeter = fn; },
    setPieceListener(fn) { onPiece = fn; },
    node: () => node,
    async attach(audioCtx, destination, engine) {
      if (node) return node;
      rack = isRack(engine);
      if (rack) engine.registerDevice(trochotronDevice);
      node = await createTrochotronNode(audioCtx, { active: false, notes: piece.notes, playing: false });
      node.port.onmessage = e => {
        const m = e.data;
        if (!m) return;
        if (m.t === 'meter') {
          Object.assign(meter, m);
          if (onMeter) onMeter(meter);
        } else if (m.t === 'edges') takeEdges(m.edges);
      };
      let mixed = false;
      if (rack && typeof engine.addDevice === 'function') {
        try { engine.addDevice(trochotronDevice.id, node, patch); mixed = true; }
        catch (err) { mixed = false; }
      }
      if (!mixed && destination) node.connect(destination);
      pending.splice(0).forEach(m => send(m));
      send({ t: 'piece', notes: piece.notes, bpm: patch.tempo });
      send({ t: 'patch', p: patch });
      return node;
    },
    setPatch(p, restart) {
      const next = normalizeTrochotron(p);
      const routeChanged = next.route !== patch.route;
      if (routeChanged) dropRoute();
      const sameMusic = ['seed', 'generator', 'depth', 'scale', 'key', 'tempo', 'density', 'chaos', 'voices', 'cx', 'cy', 'zoom', 'jr', 'ji']
        .every(k => patch[k] === next[k]);
      patch = next;
      send({ t: 'patch', p: patch });
      if (!sameMusic) pushPiece(restart !== false && meter.playing);
    },
    setActive(on) {
      if (!on) { meter.playing = false; meter.voices = 0; dropRoute(); }
      send({ t: 'active', on: !!on });
    },
    noteOn(n, vel) { send({ t: 'on', n, v: vel == null ? 0.8 : vel }); },
    noteOff(n) { send({ t: 'off', n }); },
    panic() { meter.playing = false; meter.beat = 0; dropRoute(); send({ t: 'panic' }); },
    play() {
      meter.playing = true;
      send({ t: 'piece', notes: piece.notes, bpm: patch.tempo });
      send({ t: 'play' });
      if (hooks.tempo) hooks.tempo(patch.tempo);
    },
    stop() { meter.playing = false; meter.beat = 0; dropRoute(); send({ t: 'stop' }); },
    rebuild() { pushPiece(meter.playing); },
    state() {
      return {
        playing: !!meter.playing,
        notes: piece.notes.length,
        seed: patch.seed,
        generator: patch.generator,
        beat: meter.beat || 0,
        beats: piece.beats,
        route: patch.route,
      };
    },
  };
}

function el(tag, attrs, text) {
  const n = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(k => {
    if (k === 'class') n.className = attrs[k];
    else n.setAttribute(k, attrs[k]);
  });
  if (text != null) n.textContent = text;
  return n;
}

function section(tab, id, title) {
  const s = document.createElement('section');
  s.className = 'mod';
  s.dataset.dev = 'trochotron';
  s.dataset.tab = tab;
  s.id = id;
  const h = document.createElement('h3');
  h.innerHTML = '<span class="pilot"></span>' + title;
  s.appendChild(h);
  return s;
}

let fieldCache = { key: '', img: null };

function escapeColor(t) {
  const u = clamp(t, 0, 1);
  return [
    Math.round(8 + u * 232),
    Math.round(6 + u * u * 170),
    Math.round(28 + (1 - u) * 70 + u * 40),
  ];
}

function paintField(patch, w, h) {
  const gen = patch.generator;
  if (gen !== 'mandelbrot' && gen !== 'julia') return null;
  const key = [gen, patch.cx, patch.cy, patch.zoom, patch.jr, patch.ji, patch.depth, w, h].join('|');
  if (fieldCache.key === key && fieldCache.img) return fieldCache.img;
  const img = new ImageData(w, h);
  const data = img.data;
  const span = 3.2 / patch.zoom;
  const maxIt = 20 + patch.depth * 6;
  const julia = gen === 'julia';
  for (let y = 0; y < h; y++) {
    const im = patch.cy + (0.5 - y / h) * span * (h / w);
    for (let x = 0; x < w; x++) {
      const re = patch.cx + (x / w - 0.5) * span;
      let zr = julia ? re : 0;
      let zi = julia ? im : 0;
      const cr = julia ? patch.jr : re;
      const ci = julia ? patch.ji : im;
      let n = 0;
      for (; n < maxIt; n++) {
        const rr = zr * zr - zi * zi + cr;
        const ii = 2 * zr * zi + ci;
        zr = rr; zi = ii;
        if (zr * zr + zi * zi > 4) break;
      }
      const col = escapeColor(n / maxIt);
      const p = (y * w + x) * 4;
      data[p] = col[0]; data[p + 1] = col[1]; data[p + 2] = col[2]; data[p + 3] = 255;
    }
  }
  fieldCache = { key, img, canvas: fieldCache.canvas };
  return img;
}

function drawPiece(canvas, piece, patch, beat) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 640;
  const h = canvas.clientHeight || 260;
  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const strip = 64;
  const plotH = h - strip;
  const fieldW = 160;
  const fieldH = Math.max(40, Math.round(fieldW * plotH / Math.max(1, w)));
  const field = paintField(patch, fieldW, fieldH);
  if (field) {
    if (!fieldCache.canvas) fieldCache.canvas = document.createElement('canvas');
    const off = fieldCache.canvas;
    if (off.width !== field.width || off.height !== field.height) {
      off.width = field.width; off.height = field.height;
    }
    off.getContext('2d').putImageData(field, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, w, plotH);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, plotH);
    g.addColorStop(0, '#141022');
    g.addColorStop(1, '#07060d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, plotH);
  }
  const trace = piece.trace || [];
  if (trace.length) {
    ctx.beginPath();
    const fractal = patch.generator === 'mandelbrot' || patch.generator === 'julia';
    const span = 3.2 / patch.zoom;
    trace.forEach((pt, i) => {
      let x, y;
      if (fractal) {
        x = ((pt.x - patch.cx) / span + 0.5) * w;
        y = (0.5 - (pt.y - patch.cy) / span) * plotH;
      } else {
        x = pt.x * w;
        y = (1 - pt.y) * (plotH - 16) + 8;
      }
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = 'rgba(255, 196, 120, 0.9)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    const head = Math.max(0, Math.min(trace.length - 1, Math.floor((beat / Math.max(0.001, piece.beats)) * trace.length)));
    const pt = trace[head];
    if (pt) {
      let x, y;
      if (fractal) {
        x = ((pt.x - patch.cx) / span + 0.5) * w;
        y = (0.5 - (pt.y - patch.cy) / span) * plotH;
      } else {
        x = pt.x * w;
        y = (1 - pt.y) * (plotH - 16) + 8;
      }
      ctx.fillStyle = '#ffe7c2';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = '#0c0a12';
  ctx.fillRect(0, plotH, w, strip);
  const notes = piece.notes || [];
  const beats = Math.max(0.001, piece.beats);
  notes.forEach(n => {
    const x = (n.beat / beats) * w;
    const dw = Math.max(2, (n.dur / beats) * w - 1);
    const y = plotH + 6 + (127 - n.n) * ((strip - 12) / 80);
    const col = n.layer === 'bass' ? '#7ee0ff' : n.layer === 'mid' ? '#e7c4ff' : '#ffb347';
    ctx.globalAlpha = 0.35 + n.v * 0.65;
    ctx.fillStyle = col;
    ctx.fillRect(x, y, dw, 4);
  });
  ctx.globalAlpha = 1;
  const px = clamp(beat / beats, 0, 1) * w;
  ctx.fillStyle = '#fff6ea';
  ctx.fillRect(px, plotH, 1.5, strip);
}

export function mountTrochotronPanel(container, hooks) {
  container.innerHTML = '';
  const host = hooks.host;
  host.setHooks(hooks);
  const play = section('play', 'mTrPlay', 'Seed');
  play.dataset.full = '';
  const bar = el('div', { class: 'tr-bar' });
  const seed = el('input', { id: 'trSeed', type: 'number', min: '0', step: '1', 'aria-label': 'Seed' });
  const random = el('button', { id: 'trRandom', class: 'btn small', type: 'button' }, 'random');
  const playBtn = el('button', { id: 'trPlayBtn', class: 'btn small', type: 'button' }, 'play');
  const stopBtn = el('button', { id: 'trStopBtn', class: 'btn small', type: 'button' }, 'stop');
  const linkBtn = el('button', { id: 'trLink', class: 'btn small', type: 'button' }, 'copy link');
  const midiBtn = el('button', { id: 'trMidi', class: 'btn small', type: 'button' }, 'export .mid');
  bar.append(seed, random, playBtn, stopBtn, linkBtn, midiBtn);
  const gens = el('div', { class: 'chips', id: 'trGens' });
  GENERATORS.forEach(id => {
    const b = el('button', { class: 'chip', type: 'button', 'data-gen': id, 'aria-pressed': 'false' }, GEN_LABEL[id]);
    b.addEventListener('click', () => { mutate({ generator: id }); });
    gens.appendChild(b);
  });
  const viewRow = el('div', { class: 'tr-bar' });
  const zoomIn = el('button', { id: 'trZoomIn', class: 'btn small', type: 'button' }, 'zoom in');
  const zoomOut = el('button', { id: 'trZoomOut', class: 'btn small', type: 'button' }, 'zoom out');
  const reset = el('button', { id: 'trReset', class: 'btn small', type: 'button' }, 'reset view');
  const read = el('span', { id: 'trRead', class: 'tr-read' }, '');
  viewRow.append(zoomIn, zoomOut, reset, read);
  const canvas = el('canvas', { id: 'trCanvas', 'aria-label': 'Fractal and notes. Drag to move the view. The wheel zooms.' });
  const rules = el('pre', { id: 'trRules' });
  play.append(bar, gens, viewRow, canvas, rules);

  const shape = section('shape', 'mTrShape', 'Shape');
  const scales = el('div', { class: 'chips', id: 'trScales' });
  SCALE_NAMES.forEach(id => {
    const b = el('button', { class: 'chip', type: 'button', 'data-scale': id, 'aria-pressed': 'false' }, id);
    b.addEventListener('click', () => mutate({ scale: id }));
    scales.appendChild(b);
  });
  const key = el('select', { id: 'trKey', class: 'btn', 'aria-label': 'Key' });
  KEYS.forEach((name, i) => {
    const o = el('option', { value: String(i) }, name);
    key.appendChild(o);
  });
  const voices = el('div', { class: 'chips', id: 'trVoices' });
  [['1', 'lead'], ['2', 'mid + lead'], ['3', 'bass mid lead']].forEach(([n, label]) => {
    const b = el('button', { class: 'chip', type: 'button', 'data-voices': n, 'aria-pressed': 'false' }, label);
    b.addEventListener('click', () => mutate({ voices: +n }));
    voices.appendChild(b);
  });
  const route = el('select', { id: 'trRoute', class: 'btn', 'aria-label': 'Route notes to' });
  ROUTES.forEach(id => {
    const o = el('option', { value: id }, id === 'internal' ? 'built-in voice' : id);
    route.appendChild(o);
  });
  function slider(id, label, min, max, step) {
    const wrap = el('label', { class: 'tr-slide' });
    wrap.append(document.createTextNode(label + ' '));
    const input = el('input', { id, type: 'range', min: String(min), max: String(max), step: String(step), 'aria-label': label });
    const val = el('b', { id: id + 'V' }, '');
    wrap.append(input, val);
    return { wrap, input, val };
  }
  const depth = slider('trDepth', 'depth', 1, 6, 1);
  const tempo = slider('trTempo', 'tempo', 40, 240, 1);
  const density = slider('trDensity', 'density', 0, 1, 0.01);
  const chaos = slider('trChaos', 'chaos', 0, 1, 0.01);
  const timbre = slider('trTimbre', 'timbre', 0, 1, 0.01);
  const grid = el('div', { class: 'tr-grid' });
  grid.append(depth.wrap, tempo.wrap, density.wrap, chaos.wrap, timbre.wrap);
  const row2 = el('div', { class: 'tr-bar' });
  row2.append(key, route);
  shape.append(scales, voices, row2, grid);

  container.append(play, shape);

  let drag = null;
  function current() { return normalizeTrochotron(hooks.patch()); }
  function mutate(partial, opts) {
    const p = hooks.patch();
    Object.keys(partial).forEach(k => { p[k] = partial[k]; });
    const next = normalizeTrochotron(p);
    Object.keys(next).forEach(k => { p[k] = next[k]; });
    if (hooks.edited) hooks.edited();
    host.setPatch(p, !(opts && opts.live === false));
    sync();
  }
  function sync() {
    const p = current();
    const piece = host.piece();
    if (document.activeElement !== seed) seed.value = String(p.seed);
    gens.querySelectorAll('[data-gen]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.gen === p.generator)));
    scales.querySelectorAll('[data-scale]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.scale === p.scale)));
    voices.querySelectorAll('[data-voices]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.voices === p.voices)));
    key.value = String(p.key);
    route.value = p.route;
    depth.input.value = String(p.depth); depth.val.textContent = String(p.depth);
    tempo.input.value = String(Math.round(p.tempo)); tempo.val.textContent = String(Math.round(p.tempo));
    density.input.value = String(p.density); density.val.textContent = p.density.toFixed(2);
    chaos.input.value = String(p.chaos);
    chaos.val.textContent = p.generator === 'logistic' ? 'r ' + logisticR(p.chaos).toFixed(3) : p.chaos.toFixed(2);
    timbre.input.value = String(p.timbre); timbre.val.textContent = p.timbre.toFixed(2);
    rules.textContent = piece.rules || '';
    const g = p.generator === 'julia' ? 'Julia' : p.generator === 'mandelbrot' ? 'Mandelbrot' : GEN_LABEL[p.generator];
    read.textContent = g + ' · ' + piece.notes.length + ' notes · ' + KEYS[p.key] + ' ' + p.scale;
    playBtn.textContent = host.meter().playing ? 'playing' : 'play';
    drawPiece(canvas, piece, p, host.meter().beat || 0);
  }
  function commitSeed() {
    const n = Math.max(0, Math.floor(+seed.value || 0));
    if (n !== current().seed) mutate({ seed: n });
  }
  seed.addEventListener('change', commitSeed);
  seed.addEventListener('keydown', e => { if (e.key === 'Enter') commitSeed(); e.stopPropagation(); });
  random.addEventListener('click', () => {
    if (hooks.wake) hooks.wake();
    mutate({ seed: (Math.random() * 1e9) >>> 0 });
  });
  playBtn.addEventListener('click', () => { if (hooks.wake) hooks.wake(); host.play(); sync(); });
  stopBtn.addEventListener('click', () => { host.stop(); sync(); });
  linkBtn.addEventListener('click', () => {
    const share = shareOf(current());
    const url = new URL(location.href);
    url.searchParams.set('tr', share);
    try { history.replaceState(null, '', url); } catch (e) { /* keep the string */ }
    const text = url.toString();
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
    if (hooks.toast) hooks.toast('Link copied. Same seed, same piece.');
  });
  midiBtn.addEventListener('click', () => {
    const piece = host.piece();
    const bytes = midiOf(piece);
    const blob = new Blob([bytes], { type: 'audio/midi' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'trochotron-' + current().seed + '.mid';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    if (hooks.toast) hooks.toast('Saved ' + a.download);
  });
  zoomIn.addEventListener('click', () => mutate({ zoom: current().zoom * 1.35 }));
  zoomOut.addEventListener('click', () => mutate({ zoom: current().zoom / 1.35 }));
  reset.addEventListener('click', () => mutate({ cx: -0.6, cy: 0, zoom: 1, jr: -0.8, ji: 0.156 }));
  key.addEventListener('change', () => mutate({ key: +key.value }));
  route.addEventListener('change', () => mutate({ route: route.value }));
  function bindSlide(input, keyName, live) {
    const apply = () => mutate({ [keyName]: +input.value }, { live: live !== false });
    input.addEventListener('input', apply);
    input.addEventListener('change', apply);
  }
  bindSlide(depth.input, 'depth');
  bindSlide(tempo.input, 'tempo');
  bindSlide(density.input, 'density');
  bindSlide(chaos.input, 'chaos');
  bindSlide(timbre.input, 'timbre', false);
  canvas.addEventListener('pointerdown', e => {
    if (hooks.wake) hooks.wake();
    canvas.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, cx: current().cx, cy: current().cy, chaos: current().chaos };
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const p = current();
    const rect = canvas.getBoundingClientRect();
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (p.generator === 'mandelbrot' || p.generator === 'julia') {
      const span = 3.2 / p.zoom;
      const cx = clamp(drag.cx - dx / Math.max(1, rect.width) * span, -2, 2);
      const cy = clamp(drag.cy + dy / Math.max(1, rect.height) * span, -2, 2);
      mutate({ cx, cy });
    } else {
      const chaos = clamp(drag.chaos + dx / Math.max(1, rect.width), 0, 1);
      mutate({ chaos });
    }
  });
  function endDrag(e) {
    if (!drag) return;
    drag = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ }
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const p = current();
    const factor = e.deltaY > 0 ? 1 / 1.12 : 1.12;
    if (p.generator === 'mandelbrot' || p.generator === 'julia') mutate({ zoom: p.zoom * factor });
    else mutate({ chaos: clamp(p.chaos + (e.deltaY > 0 ? -0.04 : 0.04), 0, 1) });
  }, { passive: false });
  host.setPieceListener(() => sync());
  host.setMeterListener(() => {
    if (host.meter().playing) drawPiece(canvas, host.piece(), current(), host.meter().beat || 0);
    else playBtn.textContent = 'play';
  });
  sync();
  return { sync, canvas };
}

export { pieceOf, shareOf, parseShare, midiOf, normalizeTrochotron };
