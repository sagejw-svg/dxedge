// Geissler on the page: the meadow canvas, the life controls, and the dxrack/1 adapter.
//
// The world and the voices run in the AudioWorklet. This file draws what the
// worklet reports, and forwards a species route to another rack device.

import { makeKnob } from './knob.js';
import { geisslerDevice, normalizeGeissler, GEISSLER_DEFAULT } from './geissler.js';
import { voiceForNote } from './drums.js';
import {
  SPECIES, SPECIES_NAME, TOOLS, SCALE_IDS, GRID_IDS, ROUTES,
} from './geissler-world.js';

const WORKLET = new URL('./geissler.worklet.js', import.meta.url).href;

const ROUTE_LABEL = {
  self: 'meadow', filament: 'Filament', cathode: 'Cathode', thyratron: 'Thyratron',
  lattice: 'Lattice', gleam: 'Gleam', dekatron: 'Dekatron', mote: 'Mote', heptode: 'Heptode',
  pentagrid: 'Pentagrid', orthicon: 'Orthicon', trochotron: 'Trochotron', gyrotron: 'Gyrotron',
};
const SCALE_LABEL = { major: 'major', minor: 'minor', penta: 'penta', dorian: 'dorian', chroma: 'chroma', season: 'season', free: 'free' };
const GRID_LABEL = { free: 'free', 4: '1/4', 8: '1/8', 16: '1/16' };

export async function createGeisslerNode(ctx, { patch, events, active, destination } = {}) {
  if (!ctx.__geissler) { await ctx.audioWorklet.addModule(WORKLET); ctx.__geissler = true; }
  const node = new AudioWorkletNode(ctx, 'geissler', {
    numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
    processorOptions: {
      patch: normalizeGeissler(patch || GEISSLER_DEFAULT),
      events: events || [],
      active: active !== false,
    },
  });
  if (destination) node.connect(destination);
  return node;
}

export async function renderGeisslerBuffer({ patch, events = [], seconds = 1, sampleRate = 48000 } = {}) {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const ev = events.map(e => Object.assign({}, e, { at: e.at == null ? 0 : Math.round(e.at * sampleRate) }));
  const node = await createGeisslerNode(ctx, { patch, events: ev, active: true, destination: ctx.destination });
  const buf = await ctx.startRendering();
  try { node.disconnect(); } catch (e) { /* the context is already closed */ }
  return buf;
}

function isRack(engine) {
  return !!(engine && engine.api === 'dxrack/1' && typeof engine.registerDevice === 'function');
}

export function createGeisslerHost() {
  let node = null;
  const pending = [];
  const meter = {
    voices: 0, cpu: 0, level: 0, pop: 0, popMax: 0, cap: 16, food: 0,
    foods: [], creatures: [], season: 'Spring', mood: 0.5, phase: 0, keyShift: 0,
    herd: null, stats: { meet: 0, eat: 0, breed: 0, die: 0 },
  };
  const midiLog = [];
  const held = new Map();
  const awake = new Set();
  const wakers = {};
  let drums = null;
  let engine = null;
  let onMeter = null;
  let patch = normalizeGeissler(GEISSLER_DEFAULT);
  let rack = false;
  let lastTempo = 0;

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
    if (!msg || msg.dev === 'self' || msg.dev === 'geissler') return;
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
    setMeterListener(fn) { onMeter = fn; },
    setDrums(host) { drums = host; },
    setWaker(id, fn) { if (fn) wakers[id] = fn; else delete wakers[id]; },
    async attach(audioCtx, destination, eng) {
      if (node) return node;
      engine = eng || null;
      rack = isRack(eng);
      if (rack) eng.registerDevice(geisslerDevice);
      node = await createGeisslerNode(audioCtx, { destination: undefined, active: true, patch });
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
        try { eng.addDevice(geisslerDevice.id, node, patch); mixed = true; }
        catch (e) { mixed = false; }
      }
      if (!mixed && destination) node.connect(destination);
      if (eng && eng.transport && eng.transport.subscribe) {
        eng.transport.subscribe(st => {
          if (!patch.follow || !st) return;
          const bpm = Math.round(st.tempo);
          if (!bpm || bpm === lastTempo) return;
          lastTempo = bpm;
          send({ t: 'tempo', bpm });
        });
      }
      pending.splice(0).forEach(m => send(m));
      return node;
    },
    setPatch(p) {
      patch = normalizeGeissler(p);
      send({ t: 'patch', p: patch });
      if (patch.follow && engine && engine.transport) {
        const bpm = Math.round(engine.transport.state().tempo);
        if (bpm && bpm !== lastTempo) { lastTempo = bpm; send({ t: 'tempo', bpm }); }
      }
    },
    setActive(on) {
      const next = !!on;
      if (!next) { meter.voices = 0; meter.level = 0; }
      send({ t: 'active', on: next });
    },
    noteOn(n, vel) { send({ t: 'tap', species: patch.spawn, n, v: vel == null ? 0.8 : vel, snap: false }); },
    noteOff() {},
    panic() { send({ t: 'panic' }); },
    reseed(seed) { send({ t: 'reseed', seed }); },
    food(x, y) { send({ t: 'food', x, y }); },
    spawn(x, y, species) { send({ t: 'spawn', x, y, species: species || patch.spawn }); },
    herd(on, x, y) { send({ t: 'herd', on: !!on, x, y }); },
  };
}

function section(tab, id, title) {
  const s = document.createElement('section');
  s.className = 'mod';
  s.dataset.dev = 'geissler';
  s.dataset.tab = tab;
  s.id = id;
  const h = document.createElement('h3');
  h.innerHTML = '<span class="pilot"></span>' + title;
  s.appendChild(h);
  return s;
}

function setPath(obj, path, value) { obj[path] = value; }

export function mountGeisslerPanel(container, hooks) {
  container.innerHTML = '';
  const world = section('play', 'mGeissWorld', 'Meadow');
  world.dataset.full = '';
  const bar = document.createElement('div');
  bar.className = 'row geiss-bar';
  const pop = document.createElement('span');
  pop.id = 'geissPop'; pop.className = 'geiss-read'; pop.textContent = '0';
  const season = document.createElement('span');
  season.id = 'geissSeason'; season.className = 'geiss-read'; season.textContent = 'Spring';
  const food = document.createElement('span');
  food.id = 'geissFood'; food.className = 'geiss-read'; food.dataset.food = '0'; food.textContent = '0';
  const herd = document.createElement('span');
  herd.id = 'geissHerd'; herd.className = 'geiss-read'; herd.textContent = '';
  const run = document.createElement('button');
  run.type = 'button'; run.className = 'chip'; run.id = 'geissRun'; run.textContent = 'run';
  bar.append(labelOf('pop', pop), labelOf('season', season), labelOf('food', food), labelOf('herd', herd), run);
  world.appendChild(bar);

  const canvas = document.createElement('canvas');
  canvas.id = 'geissWorld';
  canvas.setAttribute('aria-label', 'Meadow. Tap to drop food or spawn a creature. Drag to herd.');
  world.appendChild(canvas);

  const tools = document.createElement('div');
  tools.className = 'chips'; tools.id = 'geissTools';
  world.appendChild(tools);
  const spawnRow = document.createElement('div');
  spawnRow.className = 'chips'; spawnRow.id = 'geissSpawn';
  world.appendChild(spawnRow);
  const seedRow = document.createElement('div');
  seedRow.className = 'row geiss-seed';
  const seed = document.createElement('input');
  seed.type = 'number'; seed.id = 'geissSeed'; seed.min = '1'; seed.max = '999983'; seed.step = '1';
  seed.setAttribute('aria-label', 'World seed');
  const reseed = document.createElement('button');
  reseed.type = 'button'; reseed.className = 'btn small'; reseed.id = 'geissReseed'; reseed.textContent = 'reseed';
  seedRow.append(seed, reseed);
  world.appendChild(seedRow);
  const hint = document.createElement('div');
  hint.className = 'note';
  hint.textContent = 'Reeds hum, grazers pluck, stalks hit, flickers chirp. Place maps to pan, size to level, energy to brightness. Food grows a pellet. Spawn adds the chosen creature. Drag herds them. A season walks the key.';
  world.appendChild(hint);

  const life = section('life', 'mGeissLife', 'Life');
  const scales = document.createElement('div');
  scales.className = 'chips'; scales.id = 'geissScale';
  life.appendChild(scales);
  const grids = document.createElement('div');
  grids.className = 'chips'; grids.id = 'geissGrid';
  life.appendChild(grids);
  const knobs = document.createElement('div');
  knobs.className = 'knobs'; knobs.id = 'kGeissLife';
  life.appendChild(knobs);
  const follow = document.createElement('button');
  follow.type = 'button'; follow.className = 'chip'; follow.id = 'geissFollow'; follow.textContent = 'follow tempo';
  life.appendChild(follow);

  const route = section('route', 'mGeissRoute', 'Route');
  const routeNote = document.createElement('div');
  routeNote.className = 'note';
  routeNote.textContent = 'Send a species to another device in this rack. Meadow keeps the voice here.';
  route.appendChild(routeNote);
  const routeGrid = document.createElement('div');
  routeGrid.className = 'geiss-routes';
  routeGrid.id = 'geissRoutes';
  route.appendChild(routeGrid);

  container.appendChild(world);
  container.appendChild(life);
  container.appendChild(route);

  const knobOf = {};
  function readPatch() { return hooks.patch(); }
  function addKnob(path, label, min, max, step, fmt) {
    const k = makeKnob(knobs, {
      label, min, max, step, value: readPatch()[path], def: readPatch()[path], fmt, title: label,
      onChange: v => {
        const p = readPatch();
        setPath(p, path, step >= 1 ? Math.round(v) : v);
        hooks.edited();
      },
    });
    k.el.dataset.path = path;
    knobOf[path] = k;
  }
  const pct = v => Math.round(v * 100) + '%';
  const num = v => String(Math.round(v));
  addKnob('cap', 'cap', 1, 36, 1, num);
  addKnob('birth', 'birth', 0, 1, 0.01, pct);
  addKnob('death', 'death', 0, 1, 0.01, pct);
  addKnob('mutation', 'mutate', 0, 1, 0.01, pct);
  addKnob('food', 'grow', 0, 1, 0.01, pct);
  addKnob('season', 'season', 4, 120, 1, v => Math.round(v) + 's');
  addKnob('tempo', 'tempo', 40, 240, 1, num);
  addKnob('root', 'root', 36, 84, 1, num);
  addKnob('level', 'level', 0, 1, 0.01, pct);
  addKnob('voices', 'voices', 4, 16, 1, num);

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
    spawnRow.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === p.spawn)));
    scales.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === p.scale)));
    grids.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === p.grid)));
    run.setAttribute('aria-pressed', String(!!p.running));
    run.textContent = p.running ? 'running' : 'paused';
    follow.setAttribute('aria-pressed', String(!!p.follow));
    if (document.activeElement !== seed) seed.value = String(p.seed);
    routeGrid.querySelectorAll('select').forEach(sel => { sel.value = p[sel.dataset.path] || 'self'; });
    Object.keys(knobOf).forEach(path => knobOf[path].set(p[path]));
  }
  chips(tools, TOOLS, id => id, () => readPatch().tool, id => { readPatch().tool = id; });
  chips(spawnRow, SPECIES, id => SPECIES_NAME[id], () => readPatch().spawn, id => { readPatch().spawn = id; });
  chips(scales, SCALE_IDS, id => SCALE_LABEL[id] || id, () => readPatch().scale, id => { readPatch().scale = id; });
  chips(grids, GRID_IDS, id => GRID_LABEL[id] || id, () => readPatch().grid, id => { readPatch().grid = id; });

  [['routeReed', 'Reed'], ['routeGraze', 'Graze'], ['routeStalk', 'Stalk'], ['routeFlicker', 'Flicker']].forEach(([path, name]) => {
    const row = document.createElement('label');
    row.className = 'geiss-route';
    const lab = document.createElement('span');
    lab.textContent = name;
    const sel = document.createElement('select');
    sel.id = 'geiss' + path.charAt(0).toUpperCase() + path.slice(1);
    sel.dataset.path = path;
    sel.setAttribute('aria-label', name + ' route');
    ROUTES.forEach(id => {
      const o = document.createElement('option');
      o.value = id; o.textContent = ROUTE_LABEL[id] || id;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => { readPatch()[path] = sel.value; hooks.edited(); });
    row.append(lab, sel);
    routeGrid.appendChild(row);
  });

  run.addEventListener('click', () => {
    if (hooks.wake) hooks.wake();
    readPatch().running = !readPatch().running;
    paintChips();
    hooks.edited();
  });
  follow.addEventListener('click', () => {
    readPatch().follow = !readPatch().follow;
    paintChips();
    hooks.edited();
  });
  reseed.addEventListener('click', () => {
    if (hooks.wake) hooks.wake();
    const n = Math.max(1, Math.min(999983, Math.round(+seed.value || readPatch().seed)));
    readPatch().seed = n;
    seed.value = String(n);
    foodFloor = null;
    hooks.host.reseed(n);
    hooks.edited();
  });

  let foodFloor = null;
  let drag = null;
  const trails = new Map();
  const ripples = [];
  let lastStats = { meet: 0, eat: 0, breed: 0, die: 0 };
  const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function point(ev) {
    const r = canvas.getBoundingClientRect();
    const x = r.width ? (ev.clientX - r.left) / r.width : 0.5;
    const y = r.height ? (ev.clientY - r.top) / r.height : 0.5;
    return {
      x: Math.min(0.98, Math.max(0.02, x)),
      y: Math.min(0.98, Math.max(0.02, y)),
    };
  }
  canvas.addEventListener('pointerdown', ev => {
    if (hooks.wake) hooks.wake();
    canvas.setPointerCapture(ev.pointerId);
    const p = readPatch();
    const pt = point(ev);
    if (p.tool === 'herd') {
      drag = pt;
      hooks.host.herd(true, pt.x, pt.y);
      return;
    }
    if (p.tool === 'spawn') { hooks.host.spawn(pt.x, pt.y, p.spawn); return; }
    const shown = parseInt(food.textContent, 10);
    const next = (isFinite(shown) ? shown : 0) + 1;
    foodFloor = next;
    food.textContent = String(next);
    food.dataset.food = String(next);
    hooks.host.food(pt.x, pt.y);
  });
  canvas.addEventListener('pointermove', ev => {
    if (!drag) return;
    drag = point(ev);
    hooks.host.herd(true, drag.x, drag.y);
  });
  function endDrag(ev) {
    if (!drag) return;
    const pt = point(ev);
    hooks.host.herd(false, pt.x, pt.y);
    herd.textContent = pt.x.toFixed(2) + ',' + pt.y.toFixed(2);
    drag = null;
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  function applyMeter(m) {
    if (!m) return;
    const foodN = m.food | 0;
    if (foodFloor == null || foodN >= foodFloor) {
      food.textContent = String(foodN);
      food.dataset.food = String(foodN);
      if (foodFloor != null && foodN >= foodFloor) foodFloor = null;
    }
    pop.textContent = String(m.pop | 0);
    season.textContent = (m.season || 'Spring') + (m.keyShift ? ' ' + (m.keyShift > 0 ? '+' : '') + m.keyShift : '');
    const st = m.stats || {};
    if (!reduced && (st.meet !== lastStats.meet || st.eat !== lastStats.eat || st.breed !== lastStats.breed || st.die !== lastStats.die)) {
      const list = m.creatures || [];
      const c = list.length ? list[(st.meet + st.eat + st.breed + st.die) % list.length] : null;
      if (c) ripples.push({ x: c[2], y: c[3], age: 0, kind: st.die !== lastStats.die ? 'die' : st.breed !== lastStats.breed ? 'breed' : 'meet' });
      if (ripples.length > 16) ripples.splice(0, ripples.length - 16);
    }
    lastStats = { meet: st.meet || 0, eat: st.eat || 0, breed: st.breed || 0, die: st.die || 0 };
  }
  hooks.host.setMeterListener(m => applyMeter(m));

  const colours = { reed: '#7dcea0', graze: '#e6c07b', stalk: '#e07a5f', flicker: '#8ecae6' };
  function draw() {
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
    const mood = m && isFinite(m.mood) ? m.mood : 0.5;
    const sky = mix('#141a2e', '#24301a', mood);
    const ground = mix('#1a120c', '#3a2a14', mood);
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, sky);
    g.addColorStop(1, ground);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(94, 224, 197, 0.08)';
    c.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      c.beginPath();
      c.moveTo(0, h * i / 4);
      c.lineTo(w, h * i / 4);
      c.stroke();
    }
    const foods = (m && m.foods) || [];
    c.fillStyle = '#f2e8cf';
    foods.forEach(f => {
      c.globalAlpha = 0.85;
      c.beginPath();
      c.ellipse(f[0] * w, f[1] * h, 3.2, 2.2, 0.4, 0, Math.PI * 2);
      c.fill();
    });
    c.globalAlpha = 1;
    const creatures = (m && m.creatures) || [];
    const seen = new Set();
    creatures.forEach(row => {
      const id = row[0];
      const sp = row[1];
      const x = row[2] * w;
      const y = row[3] * h;
      const size = 5 + row[4] * 10;
      seen.add(id);
      if (!reduced && sp === 'flicker') {
        let trail = trails.get(id);
        if (!trail) { trail = []; trails.set(id, trail); }
        trail.push(x, y);
        if (trail.length > 16) trail.splice(0, trail.length - 16);
        c.strokeStyle = colours.flicker;
        c.globalAlpha = 0.35;
        c.beginPath();
        for (let i = 0; i < trail.length; i += 2) {
          if (i === 0) c.moveTo(trail[i], trail[i + 1]);
          else c.lineTo(trail[i], trail[i + 1]);
        }
        c.stroke();
        c.globalAlpha = 1;
      }
      c.fillStyle = colours[sp] || '#ccc';
      c.beginPath();
      if (sp === 'reed') {
        c.moveTo(x, y + size);
        c.quadraticCurveTo(x + size * 0.4, y, x, y - size * 1.3);
        c.quadraticCurveTo(x - size * 0.4, y, x, y + size);
      } else if (sp === 'stalk') {
        c.moveTo(x, y - size);
        c.lineTo(x + size * 0.7, y);
        c.lineTo(x, y + size);
        c.lineTo(x - size * 0.7, y);
      } else if (sp === 'flicker') {
        c.arc(x, y, Math.max(2.5, size * 0.35), 0, Math.PI * 2);
      } else {
        c.ellipse(x, y, size * 0.85, size * 0.55, 0, 0, Math.PI * 2);
      }
      c.fill();
    });
    if (!reduced) {
      trails.forEach((_, id) => { if (!seen.has(id)) trails.delete(id); });
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.age += 0.04;
        if (r.age > 1) { ripples.splice(i, 1); continue; }
        c.strokeStyle = r.kind === 'die' ? '#e07a5f' : r.kind === 'breed' ? '#7dcea0' : '#8ecae6';
        c.globalAlpha = 1 - r.age;
        c.beginPath();
        c.arc(r.x * w, r.y * h, 6 + r.age * 28, 0, Math.PI * 2);
        c.stroke();
        c.globalAlpha = 1;
      }
    }
    const herdPt = drag || (m && m.herd);
    if (herdPt) {
      const hx = (herdPt.x != null ? herdPt.x : herdPt[0]) * w;
      const hy = (herdPt.y != null ? herdPt.y : herdPt[1]) * h;
      c.strokeStyle = 'rgba(240, 194, 122, 0.8)';
      c.setLineDash([3, 3]);
      c.beginPath();
      c.arc(hx, hy, 18, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
    }
    if (raf) requestAnimationFrame(draw);
  }
  let raf = 0;
  function loop() { raf = 1; draw(); }
  loop();

  function sync() {
    foodFloor = null;
    paintChips();
  }
  sync();
  return { sync, canvas };
}

function labelOf(name, el) {
  const s = document.createElement('span');
  s.className = 'geiss-lab';
  s.append(name + ' ', el);
  return s;
}

function mix(a, b, t) {
  const pa = hex(a); const pb = hex(b); const u = Math.max(0, Math.min(1, t));
  const n = i => Math.round(pa[i] + (pb[i] - pa[i]) * u);
  return 'rgb(' + n(0) + ',' + n(1) + ',' + n(2) + ')';
}
function hex(s) {
  const h = s.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
