// Lattice on the page: a flat panel, and the dxrack/1 adapter.
//
// The panel is its own: a wavetable view, sliders, a drawable LFO, and a
// modulation matrix you drag a source onto. It does not use the tube chassis.
// create(ctx, host) returns the stereo worklet node.

import { latticeDevice, normalizeLattice, LATTICE_DEFAULT, SRC_IDS, DEST_IDS, SRC_LABELS, DEST_LABELS, TABLE_IDS, WARP_IDS, MODE_IDS, ROUTE_IDS, LFO_N } from './lattice.js';
import { previewFrame, tableFromMono, FRAMES, CYCLE, MIPS } from './lattice-dsp.js';

const WORKLET = new URL('./lattice.worklet.js', import.meta.url).href;
const TABLE_LEN = MIPS * FRAMES * CYCLE;

export async function createLatticeNode(ctx, { patch, events, active, table, destination } = {}) {
  if (!ctx.__lattice) { await ctx.audioWorklet.addModule(WORKLET); ctx.__lattice = true; }
  const node = new AudioWorkletNode(ctx, 'lattice', {
    numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
    processorOptions: {
      patch: normalizeLattice(patch),
      events: events || [],
      active: active !== false,
      table: table && table.length === TABLE_LEN ? table : null,
    },
  });
  if (destination) node.connect(destination);
  return node;
}

export async function renderLattice({ patch, events = [], seconds = 1, sampleRate = 48000, table } = {}) {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const ev = events.map(e => Object.assign({}, e, { at: Math.round((e.at || 0) * sampleRate) }));
  const node = await createLatticeNode(ctx, { patch, events: ev, active: true, table, destination: ctx.destination });
  const buf = await ctx.startRendering();
  try { node.disconnect(); } catch (e) { /* context is done */ }
  return buf;
}

function isRack(engine) {
  return !!(engine && engine.api === 'dxrack/1' && typeof engine.registerDevice === 'function');
}

latticeDevice.create = async function create(ctx, host) {
  host = host || {};
  return createLatticeNode(ctx, {
    patch: host.patch, events: host.events, active: host.active !== false, table: host.table,
    destination: host.destination,
  });
};

export function createLatticeHost() {
  let node = null;
  const pending = [];
  const meter = { voices: 0, cpu: 0, pos1: 0, pos2: 0, lfo: [0, 0, 0, 0], env: [0, 0, 0], slots: [], peak: 0 };
  let onMeter = null;
  let patch = normalizeLattice(LATTICE_DEFAULT);
  let user = null;
  function send(m) {
    if (!m) return;
    if (node) node.port.postMessage(m);
    else pending.push(m);
  }
  return {
    meter: () => meter,
    userTable: () => user,
    setUser(t) { user = t; if (t) send({ t: 'table', data: t }); },
    setMeterListener(fn) { onMeter = fn; },
    node: () => node,
    async attach(audioCtx, destination, engine) {
      if (node) return node;
      const rack = isRack(engine);
      if (rack) engine.registerDevice(latticeDevice);
      node = await createLatticeNode(audioCtx, {
        patch, active: true, table: user,
        destination: rack ? undefined : destination,
      });
      node.port.onmessage = e => {
        const m = e.data;
        if (!m || m.t !== 'meter') return;
        Object.assign(meter, m);
        if (onMeter) onMeter(meter);
      };
      let mixed = false;
      if (rack && typeof engine.addDevice === 'function') {
        try { engine.addDevice(latticeDevice.id, node, patch); mixed = true; }
        catch (err) { mixed = false; }
      }
      if (!mixed && destination) node.connect(destination);
      pending.splice(0).forEach(m => node.port.postMessage(m));
      return node;
    },
    setPatch(p) { patch = normalizeLattice(p); send({ t: 'patch', p: patch }); },
    setActive(on) { send({ t: 'active', on: !!on }); },
    noteOn(n, v) { send({ t: 'on', n, v: v == null ? 0.8 : v }); },
    noteOff(n) { send({ t: 'off', n }); },
    send,
  };
}

function decodeWav(buf) {
  const v = new DataView(buf);
  if (v.byteLength < 44 || v.getUint32(0, false) !== 0x52494646) throw new Error('That file is not a WAV.');
  let fmt = null, dataOff = 0, dataLen = 0, o = 12;
  while (o + 8 <= v.byteLength) {
    const id = v.getUint32(o, false);
    const sz = v.getUint32(o + 4, true);
    if (id === 0x666d7420) {
      fmt = {
        format: v.getUint16(o + 8, true),
        ch: v.getUint16(o + 10, true),
        bits: v.getUint16(o + 22, true),
      };
    } else if (id === 0x64617461) { dataOff = o + 8; dataLen = sz; }
    const step = 8 + sz + (sz & 1);
    if (step <= 0) break;
    o += step;
  }
  if (!fmt || !dataLen || dataOff + 4 > v.byteLength) throw new Error('That WAV has no sample data.');
  const bytes = Math.max(1, Math.ceil(fmt.bits / 8));
  const ch = Math.max(1, fmt.ch || 1);
  const frames = Math.floor(Math.min(dataLen, v.byteLength - dataOff) / (bytes * ch));
  const mono = new Float64Array(frames);
  for (let i = 0; i < frames; i++) {
    let s = 0;
    for (let c = 0; c < ch; c++) {
      const p = dataOff + (i * ch + c) * bytes;
      if (fmt.format === 3 && fmt.bits === 32) s += v.getFloat32(p, true);
      else if (fmt.bits === 24) {
        const n = v.getUint8(p) | (v.getUint8(p + 1) << 8) | (v.getUint8(p + 2) << 16);
        s += (n & 0x800000 ? n - 0x1000000 : n) / 8388608;
      } else if (fmt.bits === 8) s += (v.getUint8(p) - 128) / 128;
      else s += v.getInt16(p, true) / 32768;
    }
    mono[i] = s / ch;
  }
  return mono;
}

function getPath(obj, path) {
  return String(path).split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}
function setPath(obj, path, value) {
  const ks = String(path).split('.');
  let o = obj;
  for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
  o[ks[ks.length - 1]] = value;
}

const STYLE = `
.lat { background: #12141a !important; border: 1px solid #2c3344 !important; border-radius: 2px !important; color: #d7deea; }
.lat h3 { color: #8b93a7 !important; letter-spacing: 0.14em !important; }
.lat h3 .pilot { display: none; }
.lat-note { color: #8b93a7; font-size: 12px; line-height: 1.45; margin-top: 8px; }
.lat-canvas { width: 100%; height: 168px; display: block; background: #0c0e14; border: 1px solid #2c3344; touch-action: none; cursor: crosshair; }
.lat-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 8px 0; }
.lat-btn, .lat-file, .lat-chip, .lat-src, .lat-drop button { min-height: 44px; min-width: 44px; border: 1px solid #3a4256; background: #1a1e2a; color: #d7deea; border-radius: 2px; padding: 8px 12px; font: inherit; font-size: 13px; cursor: pointer; }
.lat-btn[aria-pressed="true"], .lat-chip[aria-pressed="true"], .lat-src.arm { background: #243044; color: #e8eefc; border-color: #7aa2ff; }
.lat-file input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.lat-file { position: relative; display: inline-flex; align-items: center; }
.lat-sliders { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px 12px; }
.lat-sl { display: flex; flex-direction: column; gap: 4px; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: #8b93a7; min-width: 0; }
.lat input[type="range"] { width: 100%; min-height: 44px; height: 44px; accent-color: #7aa2ff; --fader-accent: #7aa2ff; }
.lat-val { color: #e8eefc; font-size: 13px; letter-spacing: 0; text-transform: none; }
.lat-pos { font-variant-numeric: tabular-nums; color: #e8eefc; font-size: 13px; min-height: 44px; display: inline-flex; align-items: center; }
.lat-meter { flex: 1 1 80px; height: 8px; background: #1a1e2a; border: 1px solid #2c3344; min-width: 80px; }
.lat-meter b { display: block; height: 100%; width: 0; background: #7aa2ff; }
.lat-src { cursor: grab; }
.lat-drops, .lat-slots { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.lat-drop { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; padding: 4px 10px; border: 1px dashed #3a4256; color: #8b93a7; font-size: 13px; }
.lat-drop.over { border-color: #7aa2ff; color: #e8eefc; background: #1a2233; }
.lat-slot { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(80px, 1fr) auto; gap: 8px; align-items: center; min-height: 44px; }
.lat-slot .who { font-size: 13px; color: #d7deea; min-width: 0; }
.lat-livebar { height: 6px; background: #1a1e2a; margin-top: 4px; }
.lat-live { display: block; height: 100%; width: 0; background: #9eb6ff; }
.lat-lfos { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.lat-lfo { min-width: 0; }
.lat-lfo canvas { width: 100%; height: 72px; background: #0c0e14; border: 1px solid #2c3344; touch-action: none; cursor: crosshair; display: block; }
.lat-lfo span { display: block; margin-top: 4px; color: #8b93a7; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; }
@media (max-width: 760px) {
  .lat-lfos { grid-template-columns: 1fr; }
  .lat-slot { grid-template-columns: 1fr; }
  .lat-canvas { height: 140px; }
}
`;

function ensureStyle() {
  if (document.getElementById('latticeStyle')) return;
  const s = document.createElement('style');
  s.id = 'latticeStyle';
  s.textContent = STYLE;
  document.head.appendChild(s);
}

function section(tab, id, title) {
  const el = document.createElement('section');
  el.className = 'mod lat';
  el.dataset.dev = 'lattice';
  el.dataset.tab = tab;
  el.id = id;
  const h = document.createElement('h3');
  h.innerHTML = '<span class="pilot"></span>' + title;
  el.appendChild(h);
  return el;
}

export function mountLatticePanel(container, hooks) {
  ensureStyle();
  container.innerHTML = '';
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let view3d = true;
  let scan = 0;
  let lastMeter = null;
  let writing = false;
  let drag = null;
  const sliders = [];

  const vis = section('play osc', 'mLatVis', 'Wavetable');
  const canvas = document.createElement('canvas');
  canvas.id = 'latWave';
  canvas.className = 'lat-canvas';
  canvas.setAttribute('aria-label', 'Wavetable. Drag a WAV file here to import it. The bright line is the position you hear.');
  vis.appendChild(canvas);
  const row = document.createElement('div');
  row.className = 'lat-row';
  const viewBtn = document.createElement('button');
  viewBtn.type = 'button'; viewBtn.className = 'lat-btn'; viewBtn.id = 'latView';
  viewBtn.setAttribute('aria-pressed', 'true');
  viewBtn.textContent = '3D';
  viewBtn.title = 'Switch the wavetable between a stack and a single cycle';
  const fileLab = document.createElement('label');
  fileLab.className = 'lat-file';
  fileLab.textContent = 'Import WAV';
  const file = document.createElement('input');
  file.type = 'file'; file.id = 'latWav'; file.accept = '.wav,audio/wav,audio/wave,audio/x-wav';
  file.setAttribute('aria-label', 'Import a WAV file as a wavetable');
  fileLab.appendChild(file);
  const pos = document.createElement('span');
  pos.id = 'latPos'; pos.className = 'lat-pos'; pos.textContent = 'A 0.00  ·  B 0.00';
  const meter = document.createElement('span');
  meter.className = 'lat-meter'; meter.setAttribute('aria-hidden', 'true');
  const meterBar = document.createElement('b');
  meter.appendChild(meterBar);
  row.appendChild(viewBtn); row.appendChild(fileLab); row.appendChild(pos); row.appendChild(meter);
  vis.appendChild(row);
  const note = document.createElement('div');
  note.className = 'lat-note';
  note.textContent = 'Two oscillators morph through a stack of cycles. Position, warp and the filters take modulation. Drop a WAV to use it as Osc A: a repeating period becomes the cycle.';
  vis.appendChild(note);

  const oscA = section('osc', 'mLatA', 'Oscillator A');
  const oscB = section('osc', 'mLatB', 'Oscillator B');
  const mix = section('osc play', 'mLatMix', 'Unison, sub, noise');
  const filt = section('filter', 'mLatFilt', 'Filters');
  const env = section('mod', 'mLatEnv', 'Envelopes');
  const lfoSec = section('mod', 'mLatLfo', 'LFOs');
  const matrix = section('mod', 'mLatMatrix', 'Modulation');
  matrix.dataset.wide = '';
  const macros = section('play mod', 'mLatMac', 'Macros');

  container.appendChild(vis);
  container.appendChild(oscA);
  container.appendChild(oscB);
  container.appendChild(mix);
  container.appendChild(filt);
  container.appendChild(env);
  container.appendChild(lfoSec);
  container.appendChild(matrix);
  container.appendChild(macros);

  function patch() { return hooks.patch(); }
  function edited() { hooks.edited(); }

  function addSlider(host, label, path, min, max, step, fmt) {
    const lab = document.createElement('label');
    lab.className = 'lat-sl';
    const name = document.createElement('span');
    name.textContent = label;
    const input = document.createElement('input');
    input.type = 'range'; input.min = String(min); input.max = String(max); input.step = String(step);
    input.setAttribute('aria-label', label);
    const val = document.createElement('span');
    val.className = 'lat-val';
    const read = () => {
      const v = getPath(patch(), path);
      return Number.isFinite(+v) ? +v : min;
    };
    const show = v => { val.textContent = fmt ? fmt(v) : String(v); };
    input.value = String(read());
    show(read());
    input.addEventListener('input', () => {
      if (writing) return;
      const v = +input.value;
      setPath(patch(), path, v);
      show(v);
      edited();
    });
    lab.appendChild(name); lab.appendChild(input); lab.appendChild(val);
    host.appendChild(lab);
    sliders.push({ input, read, show, path });
  }
  function sliderGrid(host) {
    const g = document.createElement('div');
    g.className = 'lat-sliders';
    host.appendChild(g);
    return g;
  }
  function chips(host, path, ids, labels) {
    const wrap = document.createElement('div');
    wrap.className = 'lat-row';
    ids.forEach(id => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'lat-chip'; b.textContent = labels && labels[id] ? labels[id] : id;
      b.dataset.path = path; b.dataset.val = id;
      b.addEventListener('click', () => { setPath(patch(), path, id); edited(); sync(); });
      wrap.appendChild(b);
    });
    host.appendChild(wrap);
    return wrap;
  }

  const pct = v => Math.round(v * 100) + '%';
  const hz = v => (v < 1 ? v.toFixed(2) : v.toFixed(1)) + ' Hz';
  const ms = v => v < 1 ? Math.round(v * 1000) + ' ms' : v.toFixed(2) + ' s';
  const cut = v => v >= 1000 ? (v / 1000).toFixed(2) + ' kHz' : Math.round(v) + ' Hz';

  chips(oscA, 'osc1.table', TABLE_IDS);
  chips(oscA, 'osc1.warp', WARP_IDS, { off: 'off', bend: 'bend', sync: 'sync', pwm: 'pwm', fm: 'FM from B' });
  const gA = sliderGrid(oscA);
  addSlider(gA, 'Position', 'osc1.pos', 0, 1, 0.001, pct);
  addSlider(gA, 'Level', 'osc1.level', 0, 1, 0.001, pct);
  addSlider(gA, 'Warp', 'osc1.warpAmt', 0, 1, 0.001, pct);
  addSlider(gA, 'Octave', 'osc1.oct', -2, 2, 1, v => (v > 0 ? '+' : '') + Math.round(v));
  addSlider(gA, 'Semi', 'osc1.semi', -12, 12, 1, v => (v > 0 ? '+' : '') + Math.round(v));
  addSlider(gA, 'Fine', 'osc1.fine', -100, 100, 1, v => Math.round(v) + ' ct');

  chips(oscB, 'osc2.table', TABLE_IDS);
  chips(oscB, 'osc2.warp', WARP_IDS, { off: 'off', bend: 'bend', sync: 'sync', pwm: 'pwm', fm: 'self' });
  const gB = sliderGrid(oscB);
  addSlider(gB, 'Position', 'osc2.pos', 0, 1, 0.001, pct);
  addSlider(gB, 'Level', 'osc2.level', 0, 1, 0.001, pct);
  addSlider(gB, 'Warp', 'osc2.warpAmt', 0, 1, 0.001, pct);
  addSlider(gB, 'Octave', 'osc2.oct', -2, 2, 1, v => (v > 0 ? '+' : '') + Math.round(v));
  addSlider(gB, 'Semi', 'osc2.semi', -12, 12, 1, v => (v > 0 ? '+' : '') + Math.round(v));
  addSlider(gB, 'Fine', 'osc2.fine', -100, 100, 1, v => Math.round(v) + ' ct');

  const gM = sliderGrid(mix);
  addSlider(gM, 'Unison', 'unison.count', 1, 4, 1, v => String(Math.round(v)));
  addSlider(gM, 'Detune', 'unison.detune', 0, 50, 0.1, v => Math.round(v) + ' ct');
  addSlider(gM, 'Spread', 'unison.spread', 0, 1, 0.001, pct);
  addSlider(gM, 'Sub', 'sub.level', 0, 1, 0.001, pct);
  addSlider(gM, 'Noise', 'noise.level', 0, 1, 0.001, pct);
  addSlider(gM, 'Noise color', 'noise.color', 0, 1, 0.001, pct);

  chips(filt, 'filt.route', ROUTE_IDS, { serial: 'serial', parallel: 'parallel' });
  chips(filt, 'filt.a.mode', MODE_IDS, { lp: 'A low', hp: 'A high', bp: 'A band', notch: 'A notch' });
  chips(filt, 'filt.b.mode', MODE_IDS, { lp: 'B low', hp: 'B high', bp: 'B band', notch: 'B notch' });
  const gF = sliderGrid(filt);
  addSlider(gF, 'A cutoff', 'filt.a.cutoff', 20, 18000, 1, cut);
  addSlider(gF, 'A res', 'filt.a.res', 0, 0.92, 0.001, pct);
  addSlider(gF, 'A env', 'filt.a.env', 0, 1, 0.001, pct);
  addSlider(gF, 'B cutoff', 'filt.b.cutoff', 20, 18000, 1, cut);
  addSlider(gF, 'B res', 'filt.b.res', 0, 0.92, 0.001, pct);
  addSlider(gF, 'B env', 'filt.b.env', 0, 1, 0.001, pct);
  addSlider(gF, 'Level', 'level', 0, 1, 0.001, pct);

  const gE = sliderGrid(env);
  [['envA', 'Amp'], ['envF', 'Filter'], ['envM', 'Mod']].forEach(([id, name]) => {
    addSlider(gE, name + ' attack', id + '.a', 0.001, 8, 0.001, ms);
    addSlider(gE, name + ' decay', id + '.d', 0.001, 8, 0.001, ms);
    addSlider(gE, name + ' sustain', id + '.s', 0, 1, 0.001, pct);
    addSlider(gE, name + ' release', id + '.r', 0.001, 12, 0.001, ms);
  });

  const lfoGrid = document.createElement('div');
  lfoGrid.className = 'lat-lfos';
  lfoSec.appendChild(lfoGrid);
  const lfoCanvas = [];
  for (let i = 0; i < 4; i++) {
    const box = document.createElement('div');
    box.className = 'lat-lfo';
    const c = document.createElement('canvas');
    c.id = 'latLfo' + i;
    c.setAttribute('aria-label', 'Draw LFO ' + (i + 1) + ' shape');
    box.appendChild(c);
    const cap = document.createElement('span');
    cap.textContent = 'LFO ' + (i + 1);
    box.appendChild(cap);
    lfoGrid.appendChild(box);
    lfoCanvas.push(c);
    let last = -1;
    const paint = ev => {
      const r = c.getBoundingClientRect();
      if (!r.width) return;
      const x = Math.max(0, Math.min(0.999, (ev.clientX - r.left) / r.width));
      const y = Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height));
      const idx = Math.min(LFO_N - 1, Math.floor(x * LFO_N));
      const val = (1 - y) * 2 - 1;
      const shape = patch().shapes[i];
      const from = last < 0 ? idx : last;
      const lo = Math.min(from, idx), hi = Math.max(from, idx);
      for (let k = lo; k <= hi; k++) shape[k] = val;
      last = idx;
      edited();
      drawLfo(c, shape, i);
    };
    c.addEventListener('pointerdown', e => {
      last = -1;
      try { c.setPointerCapture(e.pointerId); } catch (err) { /* already gone */ }
      paint(e);
    });
    c.addEventListener('pointermove', e => { if (e.buttons) paint(e); });
    c.addEventListener('pointerup', () => { last = -1; });
  }
  const gL = sliderGrid(lfoSec);
  for (let i = 1; i <= 4; i++) addSlider(gL, 'LFO ' + i + ' rate', 'lfo' + i + '.rate', 0.02, 20, 0.01, hz);
  const lfoNote = document.createElement('div');
  lfoNote.className = 'lat-note';
  lfoNote.textContent = 'Draw in the box. Up is positive. The shape loops, and the rate is free, from a slow drift to audio-range wobble.';
  lfoSec.appendChild(lfoNote);

  const srcRow = document.createElement('div');
  srcRow.className = 'lat-row'; srcRow.id = 'latSources';
  SRC_IDS.forEach(id => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'lat-src'; b.dataset.src = id; b.textContent = SRC_LABELS[id];
    b.title = 'Drag onto a destination';
    srcRow.appendChild(b);
  });
  matrix.appendChild(srcRow);
  const slotsEl = document.createElement('div');
  slotsEl.className = 'lat-slots'; slotsEl.id = 'latSlots';
  matrix.appendChild(slotsEl);
  const drops = document.createElement('div');
  drops.className = 'lat-drops'; drops.id = 'latDests';
  DEST_IDS.forEach(id => {
    const d = document.createElement('div');
    d.className = 'lat-drop'; d.dataset.dest = id; d.textContent = DEST_LABELS[id];
    drops.appendChild(d);
  });
  matrix.appendChild(drops);
  const mNote = document.createElement('div');
  mNote.className = 'lat-note';
  mNote.textContent = 'Drag a source onto a destination. Eight routes. The bar on a route is that modulation, live. Velocity, the mod wheel and the macros are sources too.';
  matrix.appendChild(mNote);

  const gMac = sliderGrid(macros);
  for (let i = 0; i < 4; i++) {
    addSlider(gMac, 'Macro ' + (i + 1), 'macros.' + i, 0, 1, 0.001, pct);
  }

  function paintSlots() {
    const list = patch().matrix || [];
    slotsEl.innerHTML = '';
    list.forEach((slot, i) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'lat-slot';
      const who = document.createElement('div');
      who.className = 'who';
      const route = (SRC_LABELS[slot.src] || slot.src) + ' to ' + (DEST_LABELS[slot.dest] || slot.dest);
      who.textContent = (SRC_LABELS[slot.src] || slot.src) + ' → ' + (DEST_LABELS[slot.dest] || slot.dest);
      const bar = document.createElement('div');
      bar.className = 'lat-livebar';
      const live = document.createElement('i');
      live.className = 'lat-live';
      live.dataset.slot = String(i);
      bar.appendChild(live);
      who.appendChild(bar);
      const amt = document.createElement('input');
      amt.type = 'range'; amt.min = '-1'; amt.max = '1'; amt.step = '0.01'; amt.value = String(slot.amt);
      // Named the way the row reads (review 25 Oct, R1025-2): not the internal ids such as osc1.pos.
      amt.setAttribute('aria-label', 'Amount, ' + route);
      amt.addEventListener('input', () => {
        patch().matrix[i].amt = +amt.value;
        edited();
      });
      const rm = document.createElement('button');
      rm.type = 'button'; rm.className = 'lat-btn'; rm.textContent = 'Remove';
      rm.setAttribute('aria-label', 'Remove ' + route);
      rm.addEventListener('click', () => { patch().matrix.splice(i, 1); edited(); sync(); });
      rowEl.appendChild(who); rowEl.appendChild(amt); rowEl.appendChild(rm);
      slotsEl.appendChild(rowEl);
    });
    if (lastMeter) follow(lastMeter);
  }
  function addRoute(src, dest) {
    const p = patch();
    if (!p.matrix) p.matrix = [];
    const hit = p.matrix.find(s => s.src === src && s.dest === dest);
    if (hit) return;
    if (p.matrix.length >= 8) p.matrix.shift();
    p.matrix.push({ src, dest, amt: 0.35 });
    edited();
    sync();
  }

  srcRow.addEventListener('pointerdown', e => {
    const b = e.target.closest('[data-src]');
    if (!b) return;
    drag = { src: b.dataset.src, pid: e.pointerId };
    b.classList.add('arm');
    try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  srcRow.addEventListener('pointermove', e => {
    if (!drag || drag.pid !== e.pointerId) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const drop = el && el.closest ? el.closest('.lat-drop') : null;
    drops.querySelectorAll('.lat-drop').forEach(d => d.classList.toggle('over', d === drop));
  });
  function endDrag(e) {
    if (!drag || drag.pid !== e.pointerId) return;
    const src = drag.src;
    drag = null;
    srcRow.querySelectorAll('.arm').forEach(b => b.classList.remove('arm'));
    drops.querySelectorAll('.over').forEach(d => d.classList.remove('over'));
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const drop = el && el.closest ? el.closest('.lat-drop') : null;
    if (drop && drop.dataset.dest) addRoute(src, drop.dataset.dest);
  }
  srcRow.addEventListener('pointerup', endDrag);
  srcRow.addEventListener('pointercancel', endDrag);

  function sync() {
    writing = true;
    sliders.forEach(s => {
      const v = s.read();
      s.input.value = String(v);
      s.show(v);
    });
    container.querySelectorAll('.lat-chip').forEach(b => {
      b.setAttribute('aria-pressed', String(getPath(patch(), b.dataset.path) === b.dataset.val));
    });
    writing = false;
    paintSlots();
    drawAllLfos();
  }

  function fit(c, h) {
    const r = c.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(2, Math.round(r.width * dpr));
    const hh = Math.max(2, Math.round(h * dpr));
    if (c.width !== w || c.height !== hh) { c.width = w; c.height = hh; }
    return { c: c.getContext('2d'), w, h: hh };
  }
  function strokeWave(ctx, wave, x0, x1, yBase, amp, step) {
    ctx.beginPath();
    for (let i = 0; i < wave.length; i += step) {
      const x = x0 + (x1 - x0) * (i / (wave.length - 1));
      const y = yBase - wave[i] * amp;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  function drawWave() {
    const box = fit(canvas, view3d ? 168 : 168);
    const ctx = box.c, w = box.w, h = box.h;
    ctx.fillStyle = '#0c0e14';
    ctx.fillRect(0, 0, w, h);
    const p = patch();
    const name = p.osc1.table;
    const user = hooks.userTable ? hooks.userTable() : null;
    const heard = lastMeter && lastMeter.pos1 != null ? lastMeter.pos1 : p.osc1.pos;
    canvas.dataset.pos = Number(heard).toFixed(3);
    if (!reduced) scan = (scan + 0.008) % 1;
    if (view3d) {
      for (let f = 0; f < FRAMES; f++) {
        const z = f / (FRAMES - 1);
        const wave = previewFrame(name, f, user);
        const yBase = h * (0.16 + 0.66 * z);
        const inset = w * 0.08 * (1 - z);
        const amp = h * (0.035 + 0.055 * z);
        const near = Math.abs(f / (FRAMES - 1) - heard) < 0.08;
        ctx.strokeStyle = near ? '#e7eeff' : 'rgba(130, 164, 230, ' + (0.2 + 0.55 * z) + ')';
        ctx.lineWidth = near ? 2.2 : 1;
        strokeWave(ctx, wave, inset + w * 0.04, w - inset - w * 0.04, yBase, amp, 2);
      }
      const mx = w * (0.06 + 0.88 * ((heard * 0.15 + scan) % 1));
      ctx.strokeStyle = 'rgba(122, 162, 255, 0.85)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(mx, h * 0.08); ctx.lineTo(mx, h * 0.92); ctx.stroke();
    } else {
      const f = heard * (FRAMES - 1);
      const f0 = Math.max(0, Math.min(FRAMES - 1, Math.floor(f)));
      const f1 = Math.min(FRAMES - 1, f0 + 1);
      const a = previewFrame(name, f0, user);
      const b = previewFrame(name, f1, user);
      const t = f - f0;
      const wave = new Float32Array(CYCLE);
      for (let i = 0; i < CYCLE; i++) wave[i] = a[i] * (1 - t) + b[i] * t;
      ctx.strokeStyle = '#d5def2';
      ctx.lineWidth = 1.6;
      strokeWave(ctx, wave, w * 0.04, w * 0.96, h * 0.55, h * 0.36, 1);
      const px = w * (0.04 + 0.92 * scan);
      ctx.strokeStyle = '#7aa2ff';
      ctx.beginPath(); ctx.moveTo(px, h * 0.12); ctx.lineTo(px, h * 0.88); ctx.stroke();
    }
  }
  function drawLfo(c, shape, index) {
    const box = fit(c, 72);
    const ctx = box.c, w = box.w, h = box.h;
    ctx.fillStyle = '#0c0e14';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#243044';
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
    const phase = lastMeter && lastMeter.lfo ? (index) : 0;
    ctx.beginPath();
    ctx.strokeStyle = '#9eb6ff';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < shape.length; i++) {
      const x = (i / (shape.length - 1)) * w;
      const y = h * (0.5 - shape[i] * 0.42);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (lastMeter && lastMeter.lfo && lastMeter.lfo[index] != null && !reduced) {
      const v = lastMeter.lfo[index];
      ctx.fillStyle = '#e7eeff';
      ctx.fillRect(w * (0.5 + 0.42 * Math.sin(phase + v)) * 0 + (index * 0), h * (0.5 - v * 0.42) - 2, 4, 4);
    }
  }
  function drawAllLfos() {
    for (let i = 0; i < 4; i++) drawLfo(lfoCanvas[i], patch().shapes[i], i);
  }
  function frame() {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    if (document.body.dataset.dev !== 'lattice') return;
    if (!canvas.offsetParent && window.matchMedia('(max-width: 760px)').matches) {
      /* a hidden phone tab still owns the canvas; skip the big view */
    }
    drawWave();
    if (!reduced) drawAllLfos();
  }
  viewBtn.addEventListener('click', () => {
    view3d = !view3d;
    viewBtn.setAttribute('aria-pressed', String(view3d));
    viewBtn.textContent = view3d ? '3D' : '2D';
  });

  function takeFile(f) {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const table = tableFromMono(decodeWav(reader.result));
        if (hooks.setUser) hooks.setUser(table);
        patch().osc1.table = 'user';
        edited();
        sync();
        if (hooks.toast) hooks.toast('Wavetable loaded into oscillator A.');
      } catch (err) {
        if (hooks.toast) hooks.toast(err.message || 'Could not read that WAV.');
      }
    };
    reader.readAsArrayBuffer(f);
  }
  file.addEventListener('change', () => { const f = file.files && file.files[0]; takeFile(f); file.value = ''; });
  canvas.addEventListener('dragover', e => { e.preventDefault(); });
  canvas.addEventListener('drop', e => {
    e.preventDefault();
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    takeFile(f);
  });

  function follow(m) {
    lastMeter = m || lastMeter;
    if (!m) return;
    if (m.pos1 != null) {
      pos.textContent = 'A ' + m.pos1.toFixed(2) + '  ·  B ' + (m.pos2 == null ? '—' : m.pos2.toFixed(2));
      pos.dataset.pos = Number(m.pos1).toFixed(3);
      canvas.dataset.pos = Number(m.pos1).toFixed(3);
    }
    const pk = Math.max(0, Math.min(1, m.peak || 0));
    meterBar.style.width = (pk * 100) + '%';
    slotsEl.querySelectorAll('.lat-live').forEach(el => {
      const v = (m.slots && m.slots[+el.dataset.slot]) || 0;
      el.style.width = Math.min(100, Math.abs(v) * 100) + '%';
    });
  }

  sync();
  requestAnimationFrame(frame);
  return { sync, follow };
}
