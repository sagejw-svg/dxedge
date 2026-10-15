// Rhumbatron on the page: the cavity you can touch, and the dxrack/1 adapter.

import { rhumbatronDevice, normalizeRhumbatron, RHUM_DEFAULT, BODIES, EXCITERS } from './rhumbatron.js';

const WORKLET = new URL('./rhumbatron.worklet.js', import.meta.url).href;
const BODY_LABEL = { string: 'string', tube: 'bore', membrane: 'plate' };
const EXCITER_LABEL = { pluck: 'pluck', strike: 'strike', bow: 'bow', blow: 'blow' };

function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }

export async function createRhumbatronNode(ctx, { patch, events, active, destination } = {}) {
  if (!ctx.__rhumbatron) { await ctx.audioWorklet.addModule(WORKLET); ctx.__rhumbatron = true; }
  const node = new AudioWorkletNode(ctx, 'rhumbatron', {
    numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
    processorOptions: {
      patch: normalizeRhumbatron(patch),
      events: events || [],
      active: active !== false,
    },
  });
  if (destination) node.connect(destination);
  return node;
}

export async function renderRhumbatronBuffer({ patch, events = [], seconds = 1, sampleRate = 48000 } = {}) {
  const p = normalizeRhumbatron(patch);
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const ev = events.map(e => Object.assign({}, e, { at: e.at == null ? 0 : Math.round(e.at * sampleRate) }));
  const node = await createRhumbatronNode(ctx, { patch: p, events: ev, active: true, destination: ctx.destination });
  const buf = await ctx.startRendering();
  try { node.disconnect(); } catch (e) { /* already closed */ }
  return buf;
}

function isRack(engine) {
  return !!(engine && engine.api === 'dxrack/1' && typeof engine.registerDevice === 'function');
}

export function createRhumbatronHost() {
  let node = null;
  const pending = [];
  const meter = { voices: 0, peak: 0, cpu: 0 };
  let onMeter = null;
  let patch = normalizeRhumbatron(RHUM_DEFAULT);
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
      if (rack) engine.registerDevice(rhumbatronDevice);
      node = await createRhumbatronNode(audioCtx, { active: false, patch });
      node.port.onmessage = e => {
        const m = e.data;
        if (!m || m.t !== 'meter') return;
        Object.assign(meter, m);
        if (onMeter) onMeter(meter);
      };
      let mixed = false;
      if (rack && typeof engine.addDevice === 'function') {
        try { engine.addDevice(rhumbatronDevice.id, node, patch); mixed = true; }
        catch (err) { mixed = false; }
      }
      if (!mixed && destination) node.connect(destination);
      pending.splice(0).forEach(m => send(m));
      send({ t: 'patch', p: patch });
      return node;
    },
    setPatch(p) {
      patch = normalizeRhumbatron(p);
      send({ t: 'patch', p: patch });
    },
    setActive(on) {
      if (!on) { meter.voices = 0; meter.peak = 0; }
      send({ t: 'active', on: !!on });
    },
    noteOn(n, vel) { send({ t: 'on', n, v: vel == null ? 0.8 : vel }); },
    noteOff(n) { send({ t: 'off', n }); },
    bend(v) { send({ t: 'bend', v }); },
    mod(v) { send({ t: 'mw', v }); },
    sustain(on) { send({ t: 'sus', on: !!on }); },
    panic() { meter.voices = 0; meter.peak = 0; send({ t: 'panic' }); },
    state() {
      return { voices: meter.voices || 0, body: patch.body, exciter: patch.exciter, position: patch.position, place: patch.place };
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
  s.dataset.dev = 'rhumbatron';
  s.dataset.tab = tab;
  s.id = id;
  const h = document.createElement('h3');
  h.innerHTML = '<span class="pilot"></span>' + title;
  s.appendChild(h);
  return s;
}

function drawCavity(canvas, p, down) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(10, canvas.clientWidth);
  const h = Math.max(10, canvas.clientHeight);
  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#24160f');
  g.addColorStop(1, '#100a08');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const px = clamp(p.position, 0.02, 0.98) * w;
  const py = (1 - clamp(p.place, 0.02, 0.98)) * h;
  ctx.lineWidth = 2;
  if (p.body === 'membrane') {
    const cx = w * 0.5, cy = h * 0.52, rx = w * 0.36, ry = h * 0.34;
    ctx.strokeStyle = '#8a5a3a';
    ctx.fillStyle = '#3a2418';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(224, 160, 106, 0.35)';
    ctx.lineWidth = 1;
    for (let k = 1; k <= 3; k++) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * k / 4, ry * k / 4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    const sx = cx + (p.position - 0.5) * rx * 1.7;
    const sy = cy + (0.5 - p.place) * ry * 1.7;
    ctx.fillStyle = down ? '#ffe6c8' : '#e7b089';
    ctx.beginPath();
    ctx.arc(sx, sy, down ? 9 : 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f6e6d4';
    ctx.font = '12px sans-serif';
    ctx.fillText('plate', 12, 20);
    return;
  }
  if (p.body === 'tube') {
    const y0 = h * 0.38, y1 = h * 0.62, x0 = w * 0.08, x1 = w * 0.9;
    ctx.fillStyle = '#5c3a28';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.strokeStyle = '#e0a06a';
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = '#1a0e0a';
    ctx.beginPath();
    ctx.ellipse(x0, (y0 + y1) / 2, 8, (y1 - y0) / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = down ? '#ffe6c8' : '#e7b089';
    ctx.beginPath();
    ctx.arc(x0 + (x1 - x0) * p.position, (y0 + y1) / 2, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f6e6d4';
    ctx.font = '12px sans-serif';
    ctx.fillText('bore', 12, 20);
    return;
  }
  const y = h * 0.55;
  ctx.strokeStyle = '#6b4632';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(w * 0.08, y + 16);
  ctx.lineTo(w * 0.92, y + 16);
  ctx.stroke();
  ctx.strokeStyle = '#f0d2b4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.1, y);
  const pull = (p.pressure - 0.5) * 18;
  ctx.quadraticCurveTo(px, y + pull, w * 0.9, y);
  ctx.stroke();
  ctx.fillStyle = '#c4784a';
  ctx.fillRect(w * 0.08, y - 14, 8, 28);
  ctx.fillRect(w * 0.88, y - 14, 8, 28);
  ctx.fillStyle = down ? '#fff1df' : '#e7b089';
  ctx.beginPath();
  ctx.moveTo(px, y - 16);
  ctx.lineTo(px + 8, y);
  ctx.lineTo(px, y + 16);
  ctx.lineTo(px - 8, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f6e6d4';
  ctx.font = '12px sans-serif';
  ctx.fillText('string', 12, 20);
}

export function mountRhumbatronPanel(container, hooks) {
  container.innerHTML = '';
  const host = hooks.host;
  const play = section('play', 'mRhumPlay', 'Cavity');
  play.dataset.full = '';
  const bodies = el('div', { class: 'chips', id: 'rhumBodies' });
  BODIES.forEach(id => {
    const b = el('button', { class: 'chip', type: 'button', 'data-body': id, 'aria-pressed': 'false' }, BODY_LABEL[id]);
    b.addEventListener('click', () => mutate({ body: id }));
    bodies.appendChild(b);
  });
  const exciters = el('div', { class: 'chips', id: 'rhumExciters' });
  EXCITERS.forEach(id => {
    const b = el('button', { class: 'chip', type: 'button', 'data-exciter': id, 'aria-pressed': 'false' }, EXCITER_LABEL[id]);
    b.addEventListener('click', () => mutate({ exciter: id }));
    exciters.appendChild(b);
  });
  const canvas = el('canvas', { id: 'rhumCanvas', 'aria-label': 'Strike the cavity. Drag along a string or a bore, or across a plate, to move where the energy enters.' });
  const note = el('div', { class: 'note', id: 'rhumNote' }, 'Drag the bright point. Along a string or a bore is where the energy enters; on a plate, up and down crosses the skin. The keys and a MIDI keyboard play the same point. Panic lets every voice go. The red rec button saves what you hear as a WAV.');
  play.append(bodies, exciters, canvas, note);

  const cavity = section('cavity', 'mRhumBody', 'Material');
  function slider(id, label, min, max, step) {
    const wrap = el('label', { class: 'rhum-slide' });
    wrap.append(document.createTextNode(label + ' '));
    const input = el('input', { id, type: 'range', min: String(min), max: String(max), step: String(step), 'aria-label': label });
    const val = el('b', { id: id + 'V' }, '');
    wrap.append(input, val);
    return { wrap, input, val };
  }
  const material = slider('rhumMaterial', 'material', 0, 1, 0.01);
  const size = slider('rhumSize', 'size', 0.5, 2, 0.01);
  const damping = slider('rhumDamp', 'damping', 0, 1, 0.01);
  const coupling = slider('rhumCouple', 'coupling', 0, 1, 0.01);
  const pressure = slider('rhumPressure', 'pressure', 0, 1, 0.01);
  const level = slider('rhumLevel', 'level', 0, 1, 0.01);
  const grid = el('div', { class: 'rhum-grid' });
  grid.append(material.wrap, size.wrap, damping.wrap, coupling.wrap, pressure.wrap, level.wrap);
  const read = el('div', { class: 'note', id: 'rhumRead' }, '');
  cavity.append(grid, read);
  container.append(play, cavity);

  let pointing = false;
  function current() { return normalizeRhumbatron(hooks.patch()); }
  function mutate(partial) {
    const p = hooks.patch();
    Object.keys(partial).forEach(k => { p[k] = partial[k]; });
    const next = normalizeRhumbatron(p);
    Object.keys(next).forEach(k => { p[k] = next[k]; });
    if (hooks.edited) hooks.edited();
    host.setPatch(p);
    sync();
  }
  function fmt(n) { return (Math.round(n * 100) / 100).toFixed(2); }
  function sync() {
    const p = current();
    bodies.querySelectorAll('[data-body]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.body === p.body)));
    exciters.querySelectorAll('[data-exciter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.exciter === p.exciter)));
    material.input.value = String(p.material); material.val.textContent = fmt(p.material);
    size.input.value = String(p.size); size.val.textContent = fmt(p.size);
    damping.input.value = String(p.damping); damping.val.textContent = fmt(p.damping);
    coupling.input.value = String(p.coupling); coupling.val.textContent = fmt(p.coupling);
    pressure.input.value = String(p.pressure); pressure.val.textContent = fmt(p.pressure);
    level.input.value = String(p.level); level.val.textContent = fmt(p.level);
    const where = p.body === 'membrane'
      ? 'strike ' + fmt(p.position) + ', ' + fmt(p.place)
      : 'point ' + fmt(p.position);
    read.textContent = BODY_LABEL[p.body] + ' · ' + EXCITER_LABEL[p.exciter] + ' · ' + where;
    drawCavity(canvas, p, pointing);
  }
  function pointOf(e) {
    const r = canvas.getBoundingClientRect();
    const x = clamp((e.clientX - r.left) / Math.max(1, r.width), 0.02, 0.98);
    const y = clamp(1 - (e.clientY - r.top) / Math.max(1, r.height), 0.02, 0.98);
    return { x, y };
  }
  function applyPoint(e) {
    const pt = pointOf(e);
    const body = current().body;
    if (body === 'membrane') mutate({ position: pt.x, place: pt.y });
    else mutate({ position: pt.x, pressure: pt.y });
  }
  canvas.addEventListener('pointerdown', e => {
    if (hooks.wake) hooks.wake();
    canvas.setPointerCapture(e.pointerId);
    pointing = true;
    applyPoint(e);
    const p = current();
    if (hooks.note) hooks.note(true, 0.55 + p.pressure * 0.4);
  });
  canvas.addEventListener('pointermove', e => {
    if (!pointing) return;
    applyPoint(e);
  });
  function endPoint(e) {
    if (!pointing) return;
    pointing = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ }
    if (hooks.note) hooks.note(false);
    drawCavity(canvas, current(), false);
  }
  canvas.addEventListener('pointerup', endPoint);
  canvas.addEventListener('pointercancel', endPoint);
  function bind(input, key) {
    const apply = () => mutate({ [key]: +input.value });
    input.addEventListener('input', apply);
    input.addEventListener('change', apply);
  }
  bind(material.input, 'material');
  bind(size.input, 'size');
  bind(damping.input, 'damping');
  bind(coupling.input, 'coupling');
  bind(pressure.input, 'pressure');
  bind(level.input, 'level');
  host.setMeterListener(() => { if (pointing) drawCavity(canvas, current(), true); });
  sync();
  return { sync, canvas };
}
