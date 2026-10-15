// Phantastron on the page: the toy board, the bends, and the dxrack/1 adapter.
// Drag a wire from a source pad (VCC, GND, CLK, NSE, OUT) to a bend
// (RATE, BITS, LOOP, FB, PITCH, FORM). The same pair again lifts it.

import {
  phantastronDevice, normalizePhantastron, PHANTA_DEFAULT, PADS, CARTS, toggleWire,
} from './phantastron.js';

const WORKLET = new URL('./phantastron.worklet.js', import.meta.url).href;
const WIRE_COL = ['#ffb347', '#7dffb3', '#ff6b6b', '#d38cff', '#7ad7ff', '#f2e7c9'];

function isRack(engine) {
  return !!(engine && engine.api === 'dxrack/1' && typeof engine.registerDevice === 'function');
}

export async function createPhantastronNode(ctx, { patch, events, active, destination } = {}) {
  if (!ctx.__phantastron) { await ctx.audioWorklet.addModule(WORKLET); ctx.__phantastron = true; }
  const node = new AudioWorkletNode(ctx, 'phantastron', {
    numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
    processorOptions: {
      patch: normalizePhantastron(patch),
      events: events || [],
      active: active !== false,
    },
  });
  if (destination) node.connect(destination);
  return node;
}

export async function renderPhantastronBuffer({ patch, events = [], seconds = 1, sampleRate = 48000 } = {}) {
  const p = normalizePhantastron(patch);
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const ev = events.map(e => Object.assign({}, e, { at: e.at == null ? 0 : Math.round(e.at * sampleRate) }));
  const node = await createPhantastronNode(ctx, { patch: p, events: ev, active: true, destination: ctx.destination });
  const buf = await ctx.startRendering();
  try { node.disconnect(); } catch (e) { /* already closed */ }
  return buf;
}

export function createPhantastronHost() {
  let node = null;
  const pending = [];
  const meter = { voices: 0, peak: 0, cpu: 0 };
  let onMeter = null;
  let patch = normalizePhantastron(PHANTA_DEFAULT);
  let rack = false;
  function send(m) {
    if (!m) return;
    if (!node) { pending.push(m); return; }
    node.port.postMessage(m);
  }
  return {
    meter: () => meter,
    patch: () => patch,
    node: () => node,
    setMeterListener(fn) { onMeter = fn; },
    async attach(audioCtx, destination, engine) {
      if (node) return node;
      rack = isRack(engine);
      if (rack) engine.registerDevice(phantastronDevice);
      node = await createPhantastronNode(audioCtx, { patch, active: false });
      node.port.onmessage = e => {
        const m = e.data;
        if (!m) return;
        if (m.t === 'meter') {
          Object.assign(meter, m);
          if (onMeter) onMeter(meter);
        }
      };
      let mixed = false;
      if (rack && typeof engine.addDevice === 'function') {
        try { engine.addDevice(phantastronDevice.id, node, patch); mixed = true; }
        catch (err) { mixed = false; }
      }
      if (!mixed && destination) node.connect(destination);
      pending.splice(0).forEach(m => send(m));
      send({ t: 'patch', p: patch });
      return node;
    },
    setPatch(p) {
      patch = normalizePhantastron(p);
      send({ t: 'patch', p: patch });
    },
    setActive(on) {
      if (!on) meter.voices = 0;
      send({ t: 'active', on: !!on });
    },
    noteOn(n, vel) { send({ t: 'on', n, v: vel == null ? 0.8 : vel }); },
    noteOff(n) { send({ t: 'off', n }); },
    bend(v) { send({ t: 'bend', v }); },
    mod(v) { send({ t: 'mw', v }); },
    sustain(on) { send({ t: 'sus', on: !!on }); },
    panic() { send({ t: 'panic' }); },
    state() {
      return { wires: patch.wires.map(w => w.slice()), cart: patch.cart, seed: patch.seed, run: !!patch.run };
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
  s.dataset.dev = 'phantastron';
  s.dataset.tab = tab;
  s.id = id;
  const h = document.createElement('h3');
  h.innerHTML = '<span class="pilot"></span>' + title;
  s.appendChild(h);
  return s;
}

function slider(id, label, min, max, step) {
  const wrap = el('label', { class: 'ph-slide' });
  wrap.append(el('span', { class: 'geiss-lab' }, label));
  const input = el('input', { id, type: 'range', min: String(min), max: String(max), step: String(step), 'aria-label': label });
  const val = el('span', { class: 'ph-read' }, '');
  wrap.append(input, val);
  return { wrap, input, val };
}

function padById(id) {
  for (let i = 0; i < PADS.length; i++) if (PADS[i].id === id) return PADS[i];
  return null;
}

function hitPad(canvas, clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  let best = null;
  let bestD = 28;
  for (let i = 0; i < PADS.length; i++) {
    const p = PADS[i];
    const dx = clientX - (r.left + p.x * r.width);
    const dy = clientY - (r.top + p.y * r.height);
    const d = Math.hypot(dx, dy);
    if (d < bestD) { best = p; bestD = d; }
  }
  return best;
}

function drawBoard(canvas, patch, drag, meter) {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(2, Math.round((r.width || 320) * dpr));
  const h = Math.max(2, Math.round((r.height || 200) * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = w / dpr;
  const H = h / dpr;
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#10261c';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(196, 137, 74, 0.35)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(W * 0.08, H * 0.18);
  g.lineTo(W * 0.92, H * 0.18);
  g.moveTo(W * 0.12, H * 0.18);
  g.lineTo(W * 0.12, H * 0.84);
  g.moveTo(W * 0.88, H * 0.18);
  g.lineTo(W * 0.88, H * 0.84);
  g.stroke();
  const chipX = W * 0.34;
  const chipY = H * 0.30;
  const chipW = W * 0.32;
  const chipH = H * 0.16;
  g.fillStyle = '#1c1814';
  g.strokeStyle = '#c4a574';
  g.lineWidth = 1.5;
  g.fillRect(chipX, chipY, chipW, chipH);
  g.strokeRect(chipX, chipY, chipW, chipH);
  g.fillStyle = '#e7d7b0';
  g.font = '600 12px sans-serif';
  g.textAlign = 'center';
  g.fillText('PH-1', chipX + chipW / 2, chipY + chipH * 0.48);
  g.font = '10px sans-serif';
  g.fillStyle = '#a89878';
  g.fillText('ROM', chipX + chipW / 2, chipY + chipH * 0.78);
  const wires = (patch && patch.wires) || [];
  wires.forEach((w, i) => {
    const a = padById(w[0]);
    const b = padById(w[1]);
    if (!a || !b) return;
    const x1 = a.x * W, y1 = a.y * H, x2 = b.x * W, y2 = b.y * H;
    g.strokeStyle = WIRE_COL[i % WIRE_COL.length];
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x1, y1);
    g.quadraticCurveTo((x1 + x2) / 2 + 18, (y1 + y2) / 2, x2, y2);
    g.stroke();
  });
  if (drag && drag.pad) {
    const x1 = drag.pad.x * W, y1 = drag.pad.y * H;
    g.strokeStyle = 'rgba(255, 220, 160, 0.9)';
    g.setLineDash([5, 4]);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(drag.x, drag.y);
    g.stroke();
    g.setLineDash([]);
  }
  PADS.forEach(p => {
    const x = p.x * W, y = p.y * H;
    const linked = wires.some(w => w[0] === p.id || w[1] === p.id);
    g.beginPath();
    g.arc(x, y, 13, 0, Math.PI * 2);
    g.fillStyle = p.kind === 'src' ? '#3a2a14' : '#14261c';
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = linked ? '#f0d7a0' : (p.kind === 'src' ? '#c4894a' : '#7dcea0');
    g.stroke();
    g.beginPath();
    g.arc(x, y, 3.5, 0, Math.PI * 2);
    g.fillStyle = '#1a1208';
    g.fill();
    g.fillStyle = '#e7f0d8';
    g.font = '600 10px sans-serif';
    g.textAlign = 'center';
    g.fillText(p.label, x, y - 18);
  });
  const voices = meter && meter.voices ? meter.voices : 0;
  g.fillStyle = voices ? '#e7c56a' : '#3d5a45';
  g.beginPath();
  g.arc(W - 16, 16, 5, 0, Math.PI * 2);
  g.fill();
}

export function mountPhantastronPanel(container, hooks) {
  const host = hooks.host;
  const play = section('play', 'phPlay', 'Board');
  const canvas = el('canvas', { id: 'phBoard', 'aria-label': 'Circuit board. Drag a wire between bend points.' });
  const bar = el('div', { class: 'ph-bar' });
  const carts = el('div', { class: 'ph-bar', id: 'phCarts' });
  CARTS.forEach(c => carts.append(el('button', { type: 'button', class: 'chip', 'data-cart': c }, c)));
  const lift = el('button', { type: 'button', class: 'chip', id: 'phLift' }, 'lift wires');
  const read = el('span', { id: 'phWires', class: 'ph-read' }, 'no bends');
  bar.append(carts, lift, read);
  const note = el('p', { class: 'note' }, 'Touch a pad and drag to another. VCC pulls the bend high, GND sticks it low, CLK and NSE wobble it, OUT feeds the voice back. Drop the same wire again to lift it. The keys play the toy.');
  play.append(canvas, bar, note);

  const bend = section('bend', 'phBend', 'Bends');
  const clock = slider('phClock', 'clock', 0.25, 4, 0.01);
  const bits = slider('phBits', 'bits', 1, 12, 1);
  const loop = slider('phLoop', 'loop', 0, 1, 0.01);
  const feedback = slider('phFeedback', 'feedback', 0, 0.92, 0.01);
  const form = slider('phForm', 'form', 0, 1, 0.01);
  const noise = slider('phNoise', 'noise', 0, 1, 0.01);
  const pitch = slider('phPitch', 'pitch', -24, 24, 1);
  const grid = el('div', { class: 'ph-grid' });
  grid.append(clock.wrap, bits.wrap, loop.wrap, feedback.wrap, form.wrap, noise.wrap, pitch.wrap);
  const row = el('div', { class: 'ph-bar' });
  const seedLab = el('label', { class: 'ph-slide' });
  seedLab.append(el('span', { class: 'geiss-lab' }, 'seed'));
  const seed = el('input', { id: 'phSeed', type: 'number', min: '0', max: '999999', step: '1', 'aria-label': 'Phrase seed' });
  seedLab.append(seed);
  const run = el('button', { type: 'button', class: 'chip', id: 'phRun', 'aria-pressed': 'false' }, 'run');
  row.append(seedLab, run);
  const bendNote = el('p', { class: 'note' }, 'Clock is the toy\'s timebase: slower is lower and grainier. Bits are the DAC. Loop sticks the phrase. Feedback is the howl. Run leaves the toy talking with no key.');
  bend.append(grid, row, bendNote);
  container.append(play, bend);

  let drag = null;
  function current() { return normalizePhantastron(hooks.patch()); }
  function mutate(partial) {
    const p = hooks.patch();
    Object.keys(partial).forEach(k => { p[k] = partial[k]; });
    const next = normalizePhantastron(p);
    Object.keys(next).forEach(k => { p[k] = next[k]; });
    p.wires = next.wires.map(w => w.slice());
    if (hooks.edited) hooks.edited();
    host.setPatch(p);
    sync();
  }
  function fmtWire(w) { return w[0].toUpperCase() + '→' + w[1].toUpperCase(); }
  function sync() {
    const p = current();
    carts.querySelectorAll('[data-cart]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cart === p.cart)));
    if (document.activeElement !== clock.input) clock.input.value = String(p.clock);
    clock.val.textContent = p.clock.toFixed(2);
    if (document.activeElement !== bits.input) bits.input.value = String(p.bits);
    bits.val.textContent = String(p.bits);
    if (document.activeElement !== loop.input) loop.input.value = String(p.loop);
    loop.val.textContent = p.loop.toFixed(2);
    if (document.activeElement !== feedback.input) feedback.input.value = String(p.feedback);
    feedback.val.textContent = p.feedback.toFixed(2);
    if (document.activeElement !== form.input) form.input.value = String(p.form);
    form.val.textContent = p.form.toFixed(2);
    if (document.activeElement !== noise.input) noise.input.value = String(p.noise);
    noise.val.textContent = p.noise.toFixed(2);
    if (document.activeElement !== pitch.input) pitch.input.value = String(p.pitch);
    pitch.val.textContent = (p.pitch > 0 ? '+' : '') + Math.round(p.pitch);
    if (document.activeElement !== seed) seed.value = String(p.seed);
    run.setAttribute('aria-pressed', String(!!p.run));
    run.textContent = p.run ? 'running' : 'run';
    read.textContent = p.wires.length ? p.wires.map(fmtWire).join('  ') : 'no bends';
    drawBoard(canvas, p, drag, host.meter());
  }
  function paint() { drawBoard(canvas, current(), drag, host.meter()); }

  carts.addEventListener('click', e => {
    const b = e.target.closest('[data-cart]');
    if (!b) return;
    if (hooks.wake) hooks.wake();
    mutate({ cart: b.dataset.cart });
  });
  lift.addEventListener('click', () => {
    if (hooks.wake) hooks.wake();
    mutate({ wires: [] });
  });
  run.addEventListener('click', () => {
    if (hooks.wake) hooks.wake();
    mutate({ run: !current().run });
  });
  function bindSlide(box, key, map) {
    box.input.addEventListener('input', () => {
      const v = map ? map(+box.input.value) : +box.input.value;
      mutate({ [key]: v });
    });
  }
  bindSlide(clock, 'clock');
  bindSlide(bits, 'bits', v => Math.round(v));
  bindSlide(loop, 'loop');
  bindSlide(feedback, 'feedback');
  bindSlide(form, 'form');
  bindSlide(noise, 'noise');
  bindSlide(pitch, 'pitch', v => Math.round(v));
  seed.addEventListener('change', () => mutate({ seed: Math.max(0, Math.floor(+seed.value || 0)) }));
  seed.addEventListener('keydown', e => { if (e.key === 'Enter') seed.blur(); e.stopPropagation(); });

  canvas.addEventListener('pointerdown', e => {
    if (hooks.wake) hooks.wake();
    const pad = hitPad(canvas, e.clientX, e.clientY);
    if (!pad) return;
    const rect = canvas.getBoundingClientRect();
    drag = { pad, x: e.clientX - rect.left, y: e.clientY - rect.top, pointer: e.pointerId };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* already gone */ }
    e.preventDefault();
    paint();
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag || drag.pointer !== e.pointerId) return;
    const rect = canvas.getBoundingClientRect();
    drag.x = e.clientX - rect.left;
    drag.y = e.clientY - rect.top;
    paint();
  });
  function endDrag(e) {
    if (!drag || (e && drag.pointer !== e.pointerId)) return;
    const from = drag.pad;
    const to = e ? hitPad(canvas, e.clientX, e.clientY) : null;
    drag = null;
    if (from && to && from.id !== to.id) {
      const src = from.kind === 'src' ? from : (to.kind === 'src' ? to : null);
      const dst = from.kind === 'dst' ? from : (to.kind === 'dst' ? to : null);
      if (src && dst && src !== dst) mutate({ wires: toggleWire(current().wires, src.id, dst.id) });
      else paint();
    } else paint();
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  let raf = 0;
  function tick() {
    if (canvas.isConnected && canvas.offsetParent) paint();
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
  sync();
  return { sync, stop() { cancelAnimationFrame(raf); } };
}

export { PADS };
