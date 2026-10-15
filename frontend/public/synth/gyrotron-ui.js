// Gyrotron on the page: the orbit canvas, the tone controls, and the dxrack/1 adapter.
//
// The wells, the bodies and the voices run in the AudioWorklet. This file draws
// what the worklet reports and forwards a route to another rack device.

import { makeKnob } from './knob.js';
import { gyrotronDevice, normalizeGyrotron, GYRO_DEFAULT, midiOf } from './gyrotron.js';
import { voiceForNote } from './drums.js';
import { SCALE_IDS, TOOLS, ROUTES } from './gyrotron-world.js';

const WORKLET = new URL('./gyrotron.worklet.js', import.meta.url).href;

const ROUTE_LABEL = {
  self: 'orbit', filament: 'Filament', cathode: 'Cathode', thyratron: 'Thyratron',
  lattice: 'Lattice', gleam: 'Gleam', dekatron: 'Dekatron', mote: 'Mote', heptode: 'Heptode',
  geissler: 'Geissler', pentagrid: 'Pentagrid', orthicon: 'Orthicon', trochotron: 'Trochotron',
};
const SCALE_LABEL = {
  major: 'major', minor: 'minor', dorian: 'dorian', penta: 'penta',
  whole: 'whole', chroma: 'chroma', free: 'free',
};
const TOOL_LABEL = { well: 'well', body: 'body', fling: 'fling' };

export { midiOf };

export async function createGyrotronNode(ctx, { patch, events, active, destination } = {}) {
  if (!ctx.__gyrotron) { await ctx.audioWorklet.addModule(WORKLET); ctx.__gyrotron = true; }
  const node = new AudioWorkletNode(ctx, 'gyrotron', {
    numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
    processorOptions: {
      patch: normalizeGyrotron(patch || GYRO_DEFAULT),
      events: events || [],
      active: active !== false,
    },
  });
  if (destination) node.connect(destination);
  return node;
}

export async function renderGyrotronBuffer({ patch, events = [], seconds = 1, sampleRate = 48000 } = {}) {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const ev = events.map(e => Object.assign({}, e, { at: e.at == null ? 0 : Math.round(e.at * sampleRate) }));
  const node = await createGyrotronNode(ctx, { patch, events: ev, active: true, destination: ctx.destination });
  const buf = await ctx.startRendering();
  try { node.disconnect(); } catch (e) { /* the context is already closed */ }
  return buf;
}

function isRack(engine) {
  return !!(engine && engine.api === 'dxrack/1' && typeof engine.registerDevice === 'function');
}

export function createGyrotronHost() {
  let node = null;
  const pending = [];
  const meter = {
    voices: 0, cpu: 0, level: 0, bodies: [], bodyN: 0, wells: 0, wellList: [],
    hits: 0, crosses: 0, running: true,
  };
  const midiLog = [];
  const held = new Map();
  const awake = new Set();
  const wakers = {};
  let drums = null;
  let engine = null;
  let onMeter = null;
  let patch = normalizeGyrotron(GYRO_DEFAULT);
  let rack = false;

  function send(m) {
    if (!m) return;
    if (!node) { pending.push(m); return; }
    node.port.postMessage(m);
  }
  function wakeDev(dev) {
    if (!dev || dev === 'self' || awake.has(dev)) return;
    awake.add(dev);
    if ((dev === 'filament' || dev === 'cathode') && engine && engine.playing) engine.playing(dev, true);
    else if (wakers[dev]) wakers[dev](true);
  }
  function sleepDev(dev) {
    if (!awake.has(dev)) return;
    for (const k of held.keys()) if (k.startsWith(dev + ':')) return;
    awake.delete(dev);
    if ((dev === 'filament' || dev === 'cathode') && engine && engine.playing) engine.playing(dev, false);
    else if (wakers[dev]) wakers[dev](false);
  }
  function sendNote(dev, on, n, v) {
    const note = n & 127;
    const vel = Math.max(0, Math.min(1, v == null ? 0.8 : v));
    if (dev === 'dekatron') {
      if (!on || !drums) return;
      const voice = voiceForNote(note);
      if (voice) drums.trigger(voice, vel);
      return;
    }
    if (dev === 'filament' || dev === 'cathode') {
      if (engine && engine.sendTo) engine.sendTo(dev, { t: on ? 'on' : 'off', n: note, v: vel });
      return;
    }
    const fac = engine && engine.devices && engine.devices[dev];
    if (!fac || !fac.midi) return;
    if (on) fac.midi([0x90, note, Math.max(1, Math.round(vel * 127))]);
    else fac.midi([0x80, note, 0]);
  }
  function forward(msg) {
    if (!msg || msg.dev === 'self' || msg.dev === 'gyrotron') return;
    const dev = msg.dev;
    const key = dev + ':' + (msg.n & 127);
    if (msg.on) {
      wakeDev(dev);
      const n = (held.get(key) || 0) + 1;
      held.set(key, n);
      if (n === 1) sendNote(dev, true, msg.n, msg.v);
      return;
    }
    const n = (held.get(key) || 1) - 1;
    if (n > 0) { held.set(key, n); return; }
    held.delete(key);
    sendNote(dev, false, msg.n, 0);
    sleepDev(dev);
  }

  return {
    meter: () => meter,
    midiLog: () => midiLog.slice(),
    node: () => node,
    rack: () => rack,
    patch: () => patch,
    state: () => ({
      seed: patch.seed, running: !!patch.running, route: patch.route,
      wells: meter.wells, bodies: meter.bodyN, voices: meter.voices,
    }),
    setMeterListener(fn) { onMeter = fn; },
    setDrums(host) { drums = host; },
    setWaker(id, fn) { if (fn) wakers[id] = fn; else delete wakers[id]; },
    async attach(audioCtx, destination, eng) {
      if (node) return node;
      engine = eng || null;
      rack = isRack(eng);
      if (rack) eng.registerDevice(gyrotronDevice);
      node = await createGyrotronNode(audioCtx, { destination: undefined, active: true, patch });
      node.port.onmessage = e => {
        const m = e.data;
        if (!m) return;
        if (m.t === 'midi') {
          if (midiLog.length > 200) midiLog.shift();
          midiLog.push({ on: !!m.on, dev: m.dev, n: m.n, v: m.v });
          forward(m);
          return;
        }
        if (m.t !== 'meter') return;
        Object.assign(meter, m);
        if (onMeter) onMeter(meter);
      };
      let mixed = false;
      if (rack && typeof eng.addDevice === 'function') {
        try { eng.addDevice(gyrotronDevice.id, node, patch); mixed = true; }
        catch (e) { mixed = false; }
      }
      if (!mixed && destination) node.connect(destination);
      pending.splice(0).forEach(m => send(m));
      return node;
    },
    setPatch(p) {
      patch = normalizeGyrotron(p);
      send({ t: 'patch', p: patch });
    },
    setActive(on) {
      const next = !!on;
      if (!next) { meter.voices = 0; meter.level = 0; }
      send({ t: 'active', on: next });
    },
    noteOn(n, vel) { send({ t: 'on', n, v: vel == null ? 0.8 : vel, local: true }); },
    noteOff(n) { send({ t: 'off', n }); },
    panic() { send({ t: 'panic' }); },
    reseed(seed) { send({ t: 'reseed', seed }); },
    gesture(g) { send({ t: 'gesture', g }); },
    bend(v) { send({ t: 'bend', v }); },
    mod(v) { send({ t: 'mw', v }); },
  };
}

function section(tab, id, title) {
  const s = document.createElement('section');
  s.className = 'mod';
  s.dataset.dev = 'gyrotron';
  s.dataset.tab = tab;
  s.id = id;
  const h = document.createElement('h3');
  h.innerHTML = '<span class="pilot"></span>' + title;
  s.appendChild(h);
  return s;
}

export function mountGyrotronPanel(container, hooks) {
  container.innerHTML = '';
  const field = section('play', 'mGyField', 'Orbit');
  field.dataset.full = '';

  const bar = document.createElement('div');
  bar.className = 'row gy-bar';
  const wells = document.createElement('span');
  wells.id = 'gyWells'; wells.className = 'gy-read'; wells.textContent = '0';
  const bodies = document.createElement('span');
  bodies.id = 'gyBodies'; bodies.className = 'gy-read'; bodies.textContent = '0';
  const hits = document.createElement('span');
  hits.id = 'gyHits'; hits.className = 'gy-read'; hits.textContent = '0';
  const crosses = document.createElement('span');
  crosses.id = 'gyCross'; crosses.className = 'gy-read'; crosses.textContent = '0';
  const fling = document.createElement('span');
  fling.id = 'gyFling'; fling.className = 'gy-read'; fling.textContent = '';
  const run = document.createElement('button');
  run.type = 'button'; run.className = 'chip'; run.id = 'gyRun'; run.textContent = 'run';
  bar.append(labelOf('wells', wells), labelOf('bodies', bodies), labelOf('hits', hits), labelOf('cross', crosses), labelOf('fling', fling), run);
  field.appendChild(bar);

  const canvas = document.createElement('canvas');
  canvas.id = 'gyCanvas';
  canvas.setAttribute('aria-label', 'Orbits. Tap to place a well or a body. Drag to fling.');
  field.appendChild(canvas);

  const tools = document.createElement('div');
  tools.className = 'chips'; tools.id = 'gyTools';
  field.appendChild(tools);

  const seedRow = document.createElement('div');
  seedRow.className = 'row gy-seed';
  const seed = document.createElement('input');
  seed.type = 'number'; seed.id = 'gySeed'; seed.min = '1'; seed.max = '999983'; seed.step = '1';
  seed.setAttribute('aria-label', 'Orbit seed');
  const reseed = document.createElement('button');
  reseed.type = 'button'; reseed.className = 'btn small'; reseed.id = 'gyReseed'; reseed.textContent = 'reseed';
  seedRow.append(seed, reseed);
  field.appendChild(seedRow);

  const hint = document.createElement('div');
  hint.className = 'note';
  hint.textContent = 'Wells pull. Bodies orbit and collide. A collision or an orbit crossing rings a note in the chosen scale. Fling sets a body moving. The red rec button saves what you hear as a WAV.';
  field.appendChild(hint);

  const orbit = section('orbit', 'mGyOrbit', 'Scale');
  const scales = document.createElement('div');
  scales.className = 'chips'; scales.id = 'gyScale';
  orbit.appendChild(scales);
  const kOrbit = document.createElement('div');
  kOrbit.className = 'knobs'; kOrbit.id = 'kGyOrbit';
  orbit.appendChild(kOrbit);

  const tone = section('tone', 'mGyTone', 'Tone');
  const kTone = document.createElement('div');
  kTone.className = 'knobs'; kTone.id = 'kGyTone';
  tone.appendChild(kTone);
  const routeRow = document.createElement('label');
  routeRow.className = 'gy-route';
  const routeLab = document.createElement('span');
  routeLab.textContent = 'route';
  const route = document.createElement('select');
  route.id = 'gyRoute';
  route.setAttribute('aria-label', 'Route notes to');
  ROUTES.forEach(id => {
    const o = document.createElement('option');
    o.value = id; o.textContent = ROUTE_LABEL[id] || id;
    route.appendChild(o);
  });
  routeRow.append(routeLab, route);
  tone.appendChild(routeRow);

  container.appendChild(field);
  container.appendChild(orbit);
  container.appendChild(tone);

  const knobOf = {};
  function readPatch() { return hooks.patch(); }
  function addKnob(host, path, label, min, max, step, fmt) {
    const k = makeKnob(host, {
      label, min, max, step, value: readPatch()[path], def: readPatch()[path], fmt, title: label,
      onChange: v => {
        const p = readPatch();
        p[path] = step >= 1 ? Math.round(v) : v;
        hooks.edited();
      },
    });
    k.el.dataset.path = path;
    knobOf[path] = k;
  }
  const pct = v => Math.round(v * 100) + '%';
  const num = v => String(Math.round(v));
  addKnob(kOrbit, 'gravity', 'gravity', 0, 1, 0.01, pct);
  addKnob(kOrbit, 'pull', 'pull', 0, 1, 0.01, pct);
  addKnob(kOrbit, 'drag', 'drag', 0, 1, 0.01, pct);
  addKnob(kOrbit, 'key', 'key', 0, 11, 1, num);
  addKnob(kOrbit, 'root', 'root', 36, 84, 1, num);
  addKnob(kOrbit, 'bodyCount', 'bodies', 0, 8, 1, num);
  addKnob(kOrbit, 'wellCount', 'wells', 0, 4, 1, num);
  addKnob(kTone, 'timbre', 'timbre', 0, 1, 0.01, pct);
  addKnob(kTone, 'fold', 'fold', 0, 1, 0.01, pct);
  addKnob(kTone, 'decay', 'decay', 0, 1, 0.01, pct);
  addKnob(kTone, 'tone', 'tone', 0, 1, 0.01, pct);
  addKnob(kTone, 'space', 'space', 0, 1, 0.01, pct);
  addKnob(kTone, 'drift', 'drift', 0, 1, 0.01, pct);
  addKnob(kTone, 'level', 'level', 0, 1, 0.01, pct);
  addKnob(kTone, 'voices', 'voices', 4, 16, 1, num);

  function chips(host, list, labelOfChip, current, apply) {
    host.innerHTML = '';
    list.forEach(id => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = labelOfChip(id);
      b.dataset.id = id;
      b.setAttribute('aria-pressed', String(current() === id));
      b.addEventListener('click', () => { apply(id); paintChips(); hooks.edited(); });
      host.appendChild(b);
    });
  }
  function paintChips() {
    const p = readPatch();
    tools.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === p.tool)));
    scales.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === p.scale)));
    run.setAttribute('aria-pressed', String(!!p.running));
    run.textContent = p.running ? 'running' : 'paused';
    if (document.activeElement !== seed) seed.value = String(p.seed);
    route.value = p.route || 'self';
    Object.keys(knobOf).forEach(path => knobOf[path].set(p[path]));
  }
  chips(tools, TOOLS, id => TOOL_LABEL[id] || id, () => readPatch().tool, id => { readPatch().tool = id; });
  chips(scales, SCALE_IDS, id => SCALE_LABEL[id] || id, () => readPatch().scale, id => { readPatch().scale = id; });

  route.addEventListener('change', () => { readPatch().route = route.value; hooks.edited(); });
  run.addEventListener('click', () => {
    if (hooks.wake) hooks.wake();
    readPatch().running = !readPatch().running;
    paintChips();
    hooks.edited();
  });
  reseed.addEventListener('click', () => {
    if (hooks.wake) hooks.wake();
    const n = Math.max(1, Math.min(999983, Math.round(+seed.value || readPatch().seed)));
    readPatch().seed = n;
    seed.value = String(n);
    hooks.host.reseed(n);
    hooks.edited();
  });

  function point(ev) {
    const r = canvas.getBoundingClientRect();
    const x = r.width ? (ev.clientX - r.left) / r.width : 0.5;
    const y = r.height ? (ev.clientY - r.top) / r.height : 0.5;
    return {
      x: Math.min(0.98, Math.max(0.02, x)),
      y: Math.min(0.98, Math.max(0.02, y)),
    };
  }

  let drag = null;
  canvas.addEventListener('pointerdown', ev => {
    if (hooks.wake) hooks.wake();
    canvas.setPointerCapture(ev.pointerId);
    const p = readPatch();
    const pt = point(ev);
    if (p.tool === 'fling') {
      drag = { x: pt.x, y: pt.y, cx: ev.clientX, cy: ev.clientY };
      return;
    }
    if (p.tool === 'body') {
      hooks.host.gesture({ t: 'body', x: pt.x, y: pt.y, vx: 0.05, vy: -0.04 });
      return;
    }
    const shown = parseInt(wells.textContent, 10);
    const next = (isFinite(shown) ? shown : 0);
    wells.textContent = String(Math.min(4, next + 1));
    hooks.host.gesture({ t: 'well', x: pt.x, y: pt.y });
  });
  canvas.addEventListener('pointermove', ev => {
    if (!drag) return;
    drag.last = point(ev);
  });
  function endDrag(ev) {
    if (!drag) return;
    const r = canvas.getBoundingClientRect();
    const dx = r.width ? (ev.clientX - drag.cx) / r.width : 0;
    const dy = r.height ? (ev.clientY - drag.cy) / r.height : 0;
    const vx = Math.max(-2.5, Math.min(2.5, dx * 2.2));
    const vy = Math.max(-2.5, Math.min(2.5, dy * 2.2));
    fling.textContent = vx.toFixed(2) + ',' + vy.toFixed(2);
    hooks.host.gesture({ t: 'fling', x: drag.x, y: drag.y, vx, vy });
    drag = null;
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  function applyMeter(m) {
    if (!m) return;
    wells.textContent = String(m.wells | 0);
    bodies.textContent = String(m.bodyN != null ? m.bodyN : (m.bodies || []).length);
    hits.textContent = String(m.hits | 0);
    crosses.textContent = String(m.crosses | 0);
  }
  hooks.host.setMeterListener(applyMeter);

  const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function draw() {
    if (!canvas.offsetParent) { if (raf) requestAnimationFrame(draw); return; }
    const m = hooks.host.meter();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 320;
    const h = canvas.clientHeight || 220;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#140e0c');
    g.addColorStop(1, '#1c1410');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    const wellsNow = (m && m.wellList) || [];
    wellsNow.forEach(well => {
      const x = well[1] * w;
      const y = well[2] * h;
      const reach = (well[3] || 0.16) * Math.min(w, h);
      c.strokeStyle = 'rgba(255, 176, 138, 0.55)';
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(x, y, Math.max(8, reach), 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = 'rgba(255, 176, 138, 0.18)';
      c.beginPath();
      c.arc(x, y, 5, 0, Math.PI * 2);
      c.fill();
    });
    const list = (m && m.bodies) || [];
    list.forEach(b => {
      const x = b[1] * w;
      const y = b[2] * h;
      const rad = Math.max(3, (b[5] || 0.03) * Math.min(w, h));
      c.fillStyle = '#ffd7c2';
      c.beginPath();
      c.arc(x, y, rad, 0, Math.PI * 2);
      c.fill();
      if (!reduced) {
        c.strokeStyle = 'rgba(255, 176, 138, 0.35)';
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + (b[3] || 0) * 28, y + (b[4] || 0) * 28);
        c.stroke();
      }
    });
    if (raf) requestAnimationFrame(draw);
  }
  let raf = 0;
  function loop() { raf = 1; draw(); }
  loop();

  function sync() { paintChips(); }
  sync();
  return { sync, canvas };
}

function labelOf(name, el) {
  const s = document.createElement('span');
  s.className = 'gy-lab';
  s.append(name + ' ', el);
  return s;
}
