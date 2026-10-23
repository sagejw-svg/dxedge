// Gleam on the page: the stereo graph, the optional HRTF panners, the effect
// insert, and the glowing pad. The pad uses pointer events on itself only.
// touch-action: none is on the pad, not on the document, so the rest of the
// page can still scroll.

import {
  VOICE_COUNT, normalizeGleam, GLEAM_DEFAULT, gleamDevice, pitchOf, fieldPan, placeOf,
  pressureOf, effectOf, pointersAt, createTape, midiHz, ROOTS, SCALES, MODES,
  GENERATORS, generatorPoint, generatorEvents,
} from './gleam.js';
import { createGleamFx } from './gleam-fx.js';

const WORKLET = new URL('./gleam.worklet.js', import.meta.url).href;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function isRack(engine) {
  return !!(engine && engine.api === 'dxrack/1' && typeof engine.registerDevice === 'function');
}

async function loadWorklet(ctx) {
  if (ctx.__gleamWorklet) return;
  await ctx.audioWorklet.addModule(WORKLET);
  ctx.__gleamWorklet = true;
}

function placePanner(panner, pan, depth) {
  const x = clamp(pan, -1, 1) * 1.6;
  const z = -0.4 - clamp(depth, 0, 1) * 1.6;
  if (panner.positionX) {
    panner.positionX.value = x;
    panner.positionY.value = 0;
    panner.positionZ.value = z;
  } else if (panner.setPosition) panner.setPosition(x, 0, z);
}

function listenAtOrigin(ctx) {
  const ear = ctx.listener;
  if (!ear) return;
  if (ear.positionX) {
    ear.positionX.value = 0;
    ear.positionY.value = 0;
    ear.positionZ.value = 0;
    ear.forwardX.value = 0;
    ear.forwardY.value = 0;
    ear.forwardZ.value = -1;
    ear.upX.value = 0;
    ear.upY.value = 1;
    ear.upZ.value = 0;
  } else if (ear.setPosition) {
    ear.setPosition(0, 0, 0);
    ear.setOrientation(0, 0, -1, 0, 1, 0);
  }
}

// What a finger or an orb becomes, in worklet units.
export function voiceMessage(patch, ev) {
  const p = normalizeGleam(patch);
  const timbre = Number.isFinite(+ev.timbre) ? +ev.timbre : null;
  if (p.mode === 'room' || ev.room) {
    const place = placeOf(ev.x, ev.y);
    const hz = Number.isFinite(+ev.hz) ? +ev.hz : (ev.midi != null ? midiHz(+ev.midi) : pitchOf((place.x + 1) / 2, p).hz);
    const z = ev.z == null ? 0.8 : +ev.z;
    return {
      hz, y: timbre != null ? timbre : (ev.y == null ? p.color : +ev.y),
      pan: place.pan,
      level: clamp(z, 0, 1) * p.level * 0.34,
      gain: place.gain,
      send: p.reverb * place.send,
      depth: place.dist / Math.SQRT2,
    };
  }
  const x = ev.x == null ? 0.5 : +ev.x;
  const y = ev.y == null ? p.color : +ev.y;
  const z = ev.z == null ? 0.75 : +ev.z;
  const pitch = Number.isFinite(+ev.hz) ? { hz: +ev.hz } : pitchOf(x, p);
  return {
    hz: pitch.hz,
    y,
    pan: Number.isFinite(+ev.pan) ? +ev.pan : fieldPan(x, p.space),
    level: clamp(z, 0, 1) * p.level * 0.34,
    gain: 1,
    send: p.reverb * 0.5,
    depth: 0,
  };
}

export async function createGleamNode(ctx, { patch, events, active, destination } = {}) {
  await loadWorklet(ctx);
  const p = normalizeGleam(patch);
  const outputs = VOICE_COUNT + 2;
  const node = new AudioWorkletNode(ctx, 'gleam', {
    numberOfInputs: 0,
    numberOfOutputs: outputs,
    outputChannelCount: new Array(outputs).fill(2),
    processorOptions: { patch: p, events: events || [], active: active !== false },
  });
  const sum = ctx.createGain();
  const direct = ctx.createGain();
  direct.gain.value = p.hrtf ? 0 : 1;
  node.connect(direct, 0);
  direct.connect(sum);
  try { node.connect(sum, VOICE_COUNT + 1); } catch (e) { /* room bus is optional */ }
  const graph = { node, sum, direct, slots: [], hrtf: !!p.hrtf };
  graph.setHrtf = on => {
    graph.hrtf = !!on;
    const now = ctx.currentTime || 0;
    direct.gain.cancelScheduledValues(now);
    direct.gain.setValueAtTime(on ? 0 : 1, now);
    node.port.postMessage({ t: 'patch', hrtf: !!on });
    if (on) ensureSlots();
    graph.slots.forEach(s => {
      s.g.gain.cancelScheduledValues(now);
      s.g.gain.setValueAtTime(on ? 1 : 0, now);
    });
  };
  graph.place = (slot, pan, depth) => {
    const s = graph.slots[slot];
    if (s) placePanner(s.panner, pan, depth);
  };
  function ensureSlots() {
    if (graph.slots.length) return;
    listenAtOrigin(ctx);
    for (let i = 0; i < VOICE_COUNT; i++) {
      const g = ctx.createGain();
      g.gain.value = graph.hrtf ? 1 : 0;
      const panner = ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 1;
      panner.maxDistance = 20;
      panner.rolloffFactor = 0;
      panner.coneInnerAngle = 360;
      panner.coneOuterAngle = 360;
      panner.coneOuterGain = 1;
      placePanner(panner, 0, 0);
      node.connect(g, i + 1);
      g.connect(panner);
      panner.connect(sum);
      graph.slots.push({ g, panner });
    }
  }
  if (p.hrtf) ensureSlots();
  if (destination) sum.connect(destination);
  return graph;
}

// The first HRTF panner a page makes at a sample rate starts a thread that loads the head
// responses, and every context at that rate shares the result. In Chromium 153 an offline render
// started within a moment of that start can deadlock: the render thread takes a lock, then waits
// for the load, and the load thread is still waiting for the same lock (seen in gdb; the render
// never returns and its promise never settles). Measured on the rack page, a fresh page each run:
// an HRTF render started at once (this one, or a bare panner) hung in 14 of 70 runs; one started
// 100 ms after a panner had begun the load finished in 30 of 30, and after 1.5 s in 25 of 25, by
// then in 3 to 56 ms because the load was done. So an HRTF render first makes a panner at its rate (once per page, kept so
// the loaded data stays shared) and waits HRTF_SETTLE_MS from then. The output does not change.
const HRTF_SETTLE_MS = 1000;
const hrtfLoads = new Map();          // sample rate -> { panner, settled }
function hrtfSettled(sampleRate) {
  let h = hrtfLoads.get(sampleRate);
  if (!h) {
    const panner = new OfflineAudioContext(1, 128, sampleRate).createPanner();
    panner.panningModel = 'HRTF';
    h = { panner, settled: new Promise(res => setTimeout(res, HRTF_SETTLE_MS)) };
    hrtfLoads.set(sampleRate, h);
  }
  return h.settled;
}

export async function renderGleamBuffer({ patch, events = [], seconds = 1, sampleRate = 48000 } = {}) {
  const p = normalizeGleam(patch);
  if (p.hrtf) await hrtfSettled(sampleRate);
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  // Events go in the processor options. A message posted after the node exists
  // can miss an offline render that finishes before the port delivers it.
  const queued = [];
  const places = [];
  const slots = new Map();
  let n = 0;
  function slotFor(id) {
    if (slots.has(id)) return slots.get(id);
    const s = n < VOICE_COUNT ? n++ : 0;
    slots.set(id, s);
    return s;
  }
  const all = generatorEvents(p, seconds).concat(events);
  all.forEach(ev => {
    const at = Math.round((+ev.at || 0) * sampleRate);
    if (ev.type === 'panic') {
      queued.push({ t: 'panic', at });
      return;
    }
    const id = ev.id == null ? 'v' : String(ev.id);
    if (ev.type === 'off' || ev.type === 'up' || ev.type === 'cancel') {
      if (p.hold && ev.type !== 'cancel') return;
      const slot = slotFor(id);
      queued.push({ t: 'voice', id, slot, on: false, at });
      return;
    }
    const slot = slotFor(id);
    const msg = voiceMessage(p, ev);
    queued.push({
      t: 'voice', id, slot, on: true, at, trig: !!ev.trig,
      hz: msg.hz, y: msg.y, level: msg.level, pan: msg.pan, gain: msg.gain, send: msg.send,
    });
    places.push({ slot, pan: msg.pan, depth: msg.depth });
  });
  const graph = await createGleamNode(ctx, { patch: p, events: queued, active: true, destination: ctx.destination });
  if (graph.hrtf) places.forEach(pl => graph.place(pl.slot, pl.pan, pl.depth));
  const buf = await ctx.startRendering();
  try { graph.node.disconnect(); } catch (e) { /* context is closing */ }
  try { graph.sum.disconnect(); } catch (e) { /* already torn down */ }
  return buf;
}

export function createGleamHost() {
  let node = null;
  let graph = null;
  let fx = null;
  let patch = normalizeGleam(GLEAM_DEFAULT);
  let engine = null;
  let standalone = false;
  let ctx = null;
  const pending = [];
  const fingers = new Map();
  const latched = new Map();
  const midiHeld = new Set();
  let genPoint = null;
  let genLive = false;
  let genStep = -1;
  let onListen = null;
  const orbs = [];
  let orbSeq = 1;
  let selected = null;
  const meter = { peak: 0, voices: 0, slots: [] };
  let onMeter = null;
  let active = false;
  const tape = createTape();
  let loop = null;
  let loopOn = false;
  let raf = 0;
  let drone = null;
  let droneGain = null;
  let t0 = 0;

  function send(m) {
    if (node) node.port.postMessage(m);
    else pending.push(m);
  }
  function postPatch() {
    send({ t: 'patch', glide: patch.glide, color: patch.color, hrtf: patch.hrtf });
    if (graph) graph.setHrtf(!!patch.hrtf);
  }
  function slotOf(id) {
    if (!node) return 0;
    if (!slotOf.map) slotOf.map = new Map();
    const map = slotOf.map;
    if (map.has(id)) return map.get(id);
    const used = new Set(map.values());
    for (let i = 0; i < VOICE_COUNT; i++) if (!used.has(i)) { map.set(id, i); return i; }
    const first = map.keys().next().value;
    const slot = map.get(first);
    map.delete(first);
    map.set(id, slot);
    return slot;
  }
  function freeSlot(id) {
    if (slotOf.map) slotOf.map.delete(id);
  }
  function sound(id, ev, on, trig) {
    const slot = slotOf(id);
    if (!on) {
      send({ t: 'voice', id, slot, on: false });
      freeSlot(id);
      return;
    }
    const msg = voiceMessage(patch.mode === 'room' || ev.room ? Object.assign({}, patch, { mode: 'room' }) : patch, ev);
    send({
      t: 'voice', id, slot, on: true, trig: !!trig,
      hz: msg.hz, y: msg.y, level: msg.level, pan: msg.pan, gain: msg.gain, send: msg.send,
    });
    if (graph) graph.place(slot, msg.pan, msg.depth);
  }
  function effectTarget() {
    let pt = null;
    fingers.forEach(p => { pt = p; });
    if (!pt && patch.hold) latched.forEach(p => { pt = p; });
    return pt;
  }
  function liveEffectPoint() {
    const finger = effectTarget();
    if (patch.generator === 'off' || !genPoint) return finger;
    if (!finger) return { x: genPoint.x, y: genPoint.y, z: genPoint.z };
    return {
      x: (finger.x + genPoint.x) * 0.5,
      y: (finger.y + genPoint.y) * 0.5,
      z: Math.max(+finger.z || 0, +genPoint.z || 0),
    };
  }
  function applyEffect(pt) {
    if (!fx) return;
    if (!pt || patch.mode !== 'effect') {
      fx.bypass();
      if (droneGain) droneGain.gain.value = 0;
      if (engine && engine.fx && engine.fx.setInsert) engine.fx.setInsert({ input: fx.input, output: fx.output, on: false });
      return;
    }
    const tempo = engine && engine.transport ? engine.transport.state().tempo : 120;
    const z = patch.stutter ? pt.z : 0;
    const spec = effectOf(pt.x, pt.y, z, tempo);
    fx.set(spec);
    if (droneGain) droneGain.gain.value = standalone ? 0.12 : 0;
    if (engine && engine.fx && engine.fx.setInsert) engine.fx.setInsert({ input: fx.input, output: fx.output, on: true });
  }
  function ensureDrone() {
    if (!standalone || !ctx || drone) return;
    drone = ctx.createOscillator();
    drone.type = 'sawtooth';
    drone.frequency.value = 110;
    droneGain = ctx.createGain();
    droneGain.gain.value = 0;
    drone.connect(droneGain);
    droneGain.connect(fx.input);
    drone.start();
  }
  function releaseFingers() {
    fingers.forEach((p, id) => sound('p' + id, p, false));
    fingers.clear();
    if (patch.mode === 'effect') applyEffect(null);
  }
  function releaseLatched() {
    latched.forEach((p, id) => sound('p' + id, p, false));
    latched.clear();
    midiHeld.forEach(n => sound('m' + n, {}, false));
    midiHeld.clear();
    if (patch.mode === 'effect') applyEffect(liveEffectPoint());
  }
  function releaseGen() {
    if (!genLive) return;
    sound('gen', {}, false);
    genLive = false;
    genStep = -1;
  }
  function releaseTape() {
    if (!loop) return;
    const ids = [];
    (slotOf.map ? [...slotOf.map.keys()] : []).forEach(id => { if (String(id).startsWith('t')) ids.push(id); });
    ids.forEach(id => sound(id, {}, false));
  }
  function stepLoop(now) {
    if (!loopOn || !loop || !(loop.duration > 0)) return;
    const t = (now - (loop.t0 || now)) / 1000;
    const want = pointersAt(loop, t, true);
    const keep = new Set();
    want.forEach(p => {
      const id = 't' + p.id;
      keep.add(id);
      const ev = patch.mode === 'room'
        ? { x: p.x * 2 - 1, y: p.y * 2 - 1, z: p.z, yTimbre: patch.color, room: true, hz: p.hz }
        : { x: p.x, y: p.y, z: p.z };
      if (patch.mode === 'room') ev.y = p.y * 2 - 1;
      sound(id, ev, true);
    });
    (slotOf.map ? [...slotOf.map.keys()] : []).forEach(id => {
      if (String(id).startsWith('t') && !keep.has(id)) sound(id, {}, false);
    });
  }
  function stepOrbs(now) {
    if (patch.mode !== 'room') return;
    const t = (now - t0) / 1000;
    orbs.forEach(orb => {
      let pos = { x: orb.x, y: orb.y };
      if (orb.orbit && patch.orbit > 0) pos = orbitPoint(orb, t);
      else if (orb.drift && patch.drift > 0) pos = driftPoint(orb, t);
      orb.x = pos.x;
      orb.y = pos.y;
      sound(orb.id, { x: orb.x, y: orb.y, z: orb.z, hz: orb.hz, y: orb.timbre, room: true }, true);
    });
  }
  function orbitPoint(orb, t) {
    const a = orb.phase + t * patch.orbit * Math.PI * 2;
    return { x: Math.cos(a) * orb.radius, y: Math.sin(a) * orb.radius };
  }
  function driftPoint(orb, t) {
    const s = patch.drift;
    const x = orb.ox + Math.sin(t * s * 0.7 + orb.phase) * 0.18;
    const y = orb.oy + Math.cos(t * s * 0.5 + orb.phase) * 0.18;
    return { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
  }
  function stepGenerator(now) {
    if (!active || patch.generator === 'off') {
      if (genPoint || genLive) {
        genPoint = null;
        releaseGen();
      }
      return;
    }
    const g = generatorPoint(patch, (now - t0) / 1000);
    if (!g) {
      genPoint = null;
      releaseGen();
      return;
    }
    const trig = patch.generator === 'arp' && g.step !== genStep;
    genStep = g.step;
    genPoint = g;
    if (patch.mode === 'effect') {
      releaseGen();
      ensureDrone();
      applyEffect(liveEffectPoint());
      return;
    }
    const ev = patch.mode === 'room'
      ? { x: g.x * 2 - 1, y: g.y * 2 - 1, z: g.z, hz: g.hz, timbre: g.y, room: true }
      : { x: g.x, y: g.y, z: g.z, hz: g.hz };
    sound('gen', ev, true, trig);
    genLive = true;
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    stepLoop(now);
    stepOrbs(now);
    stepGenerator(now);
    if (onMeter) onMeter(meter);
  }

  const api = {
    patch: () => patch,
    setPatch(p) {
      const prev = patch;
      patch = normalizeGleam(p);
      postPatch();
      if (prev.hold && !patch.hold) releaseLatched();
      if (patch.generator !== prev.generator) genStep = -1;
      if (patch.generator === 'off') genPoint = null;
      if (patch.generator === 'off' || patch.mode === 'effect') releaseGen();
      if (patch.mode !== 'effect') applyEffect(null);
      if (patch.mode !== 'room') orbs.forEach(o => sound(o.id, o, false));
      return patch;
    },
    setActive(on) {
      active = !!on;
      send({ t: 'active', on: active });
      if (!active) {
        genPoint = null;
        releaseFingers();
        releaseLatched();
        releaseGen();
        applyEffect(null);
        orbs.forEach(o => sound(o.id, o, false));
      }
    },
    listen(fn) { onListen = fn; },
    generator: () => genPoint ? Object.assign({}, genPoint) : null,
    latched() {
      const out = [];
      latched.forEach((p, id) => out.push({ id, x: p.x, y: p.y, z: p.z }));
      midiHeld.forEach(n => out.push({ id: 'm' + n, midi: n }));
      return out;
    },
    ids() { return slotOf.map ? [...slotOf.map.keys()] : []; },
    meter: () => meter,
    setMeterListener(fn) { onMeter = fn; },
    node: () => node,
    voices() {
      return slotOf.map ? slotOf.map.size : 0;
    },
    noteOn(n, v) {
      midiHeld.delete(n);
      const hz = midiHz(n);
      const x = clamp((n - 48) / 24, 0, 1);
      sound('m' + n, { x, y: patch.color, z: v == null ? 0.8 : v, hz }, true);
    },
    noteOff(n) {
      if (patch.hold) { midiHeld.add(n); return; }
      midiHeld.delete(n);
      sound('m' + n, {}, false);
    },
    panic() {
      patch = normalizeGleam(Object.assign({}, patch, { hold: false }));
      genPoint = null;
      genStep = -1;
      releaseFingers();
      releaseLatched();
      releaseTape();
      releaseGen();
      orbs.splice(0, orbs.length);
      if (slotOf.map) slotOf.map.clear();
      send({ t: 'panic' });
      applyEffect(null);
      if (onListen) onListen(patch);
    },
    pointer(type, pt) {
      const id = pt.id;
      if (patch.mode === 'effect') {
        if (type === 'up' && patch.hold) {
          fingers.delete(id);
          latched.set(id, pt);
        } else if (type === 'up' || type === 'cancel') {
          fingers.delete(id);
          latched.delete(id);
        } else {
          latched.delete(id);
          fingers.set(id, pt);
        }
        ensureDrone();
        applyEffect(liveEffectPoint());
        return;
      }
      if (patch.mode === 'room') return;
      if (type === 'down' || type === 'move') {
        latched.delete(id);
        fingers.set(id, pt);
        sound('p' + id, pt, true);
      } else if (type === 'up' && patch.hold) {
        fingers.delete(id);
        latched.set(id, pt);
        sound('p' + id, pt, true);
      } else {
        fingers.delete(id);
        latched.delete(id);
        sound('p' + id, pt, false);
      }
    },
    orbs: () => orbs.map(o => Object.assign({}, o)),
    spawn(at) {
      if (orbs.length >= VOICE_COUNT) return null;
      const x = at && Number.isFinite(+at.x) ? +at.x : 0.3;
      const y = at && Number.isFinite(+at.y) ? +at.y : 0.2;
      const pitch = pitchOf((x + 1) / 2, patch);
      const orb = {
        id: 'o' + (orbSeq++),
        x, y, ox: x, oy: y,
        z: at && at.z != null ? at.z : 0.85,
        hz: pitch.hz,
        timbre: patch.color,
        radius: Math.max(0.18, Math.min(0.9, Math.hypot(x, y) || 0.45)),
        phase: Math.atan2(y, x),
        orbit: !!(at && at.orbit),
        drift: !!(at && at.drift),
      };
      orbs.push(orb);
      selected = orb.id;
      sound(orb.id, { x, y, z: orb.z, hz: orb.hz, y: orb.timbre, room: true }, true);
      return orb;
    },
    moveOrb(id, x, y) {
      const orb = orbs.find(o => o.id === id);
      if (!orb) return null;
      orb.x = clamp(x, -1, 1);
      orb.y = clamp(y, -1, 1);
      orb.ox = orb.x;
      orb.oy = orb.y;
      orb.radius = Math.max(0.15, Math.min(0.95, Math.hypot(orb.x, orb.y) || orb.radius));
      orb.phase = Math.atan2(orb.y, orb.x);
      sound(orb.id, { x: orb.x, y: orb.y, z: orb.z, hz: orb.hz, y: orb.timbre, room: true }, true);
      return orb;
    },
    selectOrb(id) { selected = id; },
    selected: () => selected,
    removeOrb(id) {
      const i = orbs.findIndex(o => o.id === (id || selected));
      if (i < 0) return;
      const orb = orbs[i];
      sound(orb.id, {}, false);
      orbs.splice(i, 1);
      if (selected === orb.id) selected = orbs.length ? orbs[orbs.length - 1].id : null;
    },
    setAutos(orbit, drift) {
      orbs.forEach(o => { o.orbit = !!orbit; o.drift = !!drift && !orbit; });
    },
    tape() { return { recording: tape.recording, duration: tape.duration, events: tape.events.length, loop: loopOn }; },
    record(on, now) {
      if (on) tape.start(now == null ? performance.now() : now);
      else loop = tape.stop(now == null ? performance.now() : now);
      return api.tape();
    },
    pushTape(now, ev) { tape.push(now, ev); },
    playTape(snapshot) {
      releaseTape();
      loop = snapshot || tape.snapshot();
      if (!loop.events) loop = { duration: 0, events: [] };
      loopOn = true;
      loop.t0 = performance.now();
      return { duration: loop.duration, n: loop.events.length };
    },
    stopTape() {
      loopOn = false;
      releaseTape();
    },
    loopOn: () => loopOn,
    effectAt(pt) {
      if (!pt) { fingers.clear(); latched.clear(); applyEffect(null); return fx ? fx.last : null; }
      patch = normalizeGleam(Object.assign({}, patch, { mode: 'effect' }));
      fingers.set('probe', pt);
      ensureDrone();
      applyEffect(pt);
      return fx ? fx.last : null;
    },
    fxProbe() {
      return {
        inserted: !!(engine && engine.fx && fx),
        on: !!(fx && fx.on),
        cutoff: fx && fx.filter ? fx.filter.frequency.value : 0,
        feedback: fx && fx.feedback ? fx.feedback.gain.value : 0,
        last: fx ? fx.last : null,
      };
    },
    async attach(audioCtx, destination, eng, opts) {
      if (node) return node;
      ctx = audioCtx;
      engine = eng || null;
      standalone = !!(opts && opts.standalone);
      t0 = performance.now();
      const rack = isRack(engine);
      if (rack) engine.registerDevice(gleamDevice);
      graph = await createGleamNode(audioCtx, { patch, active: false });
      node = graph.node;
      node.port.onmessage = e => {
        const m = e.data;
        if (!m || m.t !== 'meter') return;
        meter.peak = m.peak || 0;
        meter.voices = m.voices || 0;
        meter.slots = m.slots || [];
      };
      fx = createGleamFx(audioCtx);
      if (standalone) {
        graph.sum.connect(fx.input);
        if (destination) fx.output.connect(destination);
      } else if (rack && typeof engine.addDevice === 'function') {
        try { engine.addDevice(gleamDevice.id, { node, output: graph.sum }, patch); }
        catch (e) { if (destination) graph.sum.connect(destination); }
        if (engine.fx && engine.fx.setInsert) engine.fx.setInsert({ input: fx.input, output: fx.output, on: false });
      } else if (destination) graph.sum.connect(destination);
      pending.splice(0).forEach(m => node.port.postMessage(m));
      postPatch();
      if (!raf) raf = requestAnimationFrame(frame);
      return node;
    },
  };
  return api;
}

const CSS = `
.gleam-app { display: flex; flex-direction: column; gap: 8px; min-width: 0; min-height: 0; grid-column: 1 / -1; }
.gleam-app.alone { height: 100%; }
.gleam-pad { position: relative; min-height: 280px; height: min(62vh, 680px); border-radius: 12px; overflow: hidden; touch-action: none; overscroll-behavior: contain; user-select: none; -webkit-user-select: none; background: #07080c; border: 1px solid #2a2418; }
.gleam-app.alone .gleam-pad { flex: 1 1 auto; height: auto; min-height: 0; }
.gleam-pad canvas { display: block; width: 100%; height: 100%; touch-action: none; }
.gleam-pad:focus { outline: 1px solid #ffb347; outline-offset: 2px; }
.gleam-bar { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; min-width: 0; touch-action: pan-y; }
.gleam-bar .gchip, .gleam-bar button, .gleam-bar select, .gleam-bar a.gleam-link { font: inherit; color: #b7b7b7; background: #121212; border: 1px solid #2c2c2c; border-radius: 6px; padding: 4px 8px; min-height: 32px; }
.gleam-bar .gchip[aria-pressed="true"] { color: #1a1206; background: #ffb347; border-color: #ffb347; font-weight: 600; }
.gleam-bar select { max-width: 100%; }
.gleam-bar label.grow { display: inline-flex; align-items: center; gap: 6px; color: #8a8a8a; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; flex: 1 1 140px; min-width: 0; }
.gleam-bar input[type="range"] { flex: 1; min-width: 0; accent-color: #ffb347; }
.gleam-read { font-size: 11px; color: #ffb347; font-variant-numeric: tabular-nums; min-height: 1.2em; }
.gleam-link { text-decoration: none; display: inline-flex; align-items: center; }
@media (max-width: 760px) {
  .gleam-pad { min-height: 46vh; }
  .gleam-bar .gchip, .gleam-bar button, .gleam-bar select, .gleam-bar a.gleam-link, .gleam-bar input[type="range"] { min-height: 44px; min-width: 44px; }
}
`;

function styleOnce() {
  if (document.getElementById('gleamStyle')) return;
  const s = document.createElement('style');
  s.id = 'gleamStyle';
  s.textContent = CSS;
  document.head.appendChild(s);
}

export function mountGleamPad(container, host, opts) {
  styleOnce();
  const standalone = !!(opts && opts.standalone);
  container.innerHTML = '';
  const app = document.createElement('div');
  app.className = 'gleam-app' + (standalone ? ' alone' : '');
  const pad = document.createElement('div');
  pad.className = 'gleam-pad';
  pad.id = 'gleamPad';
  pad.tabIndex = 0;
  pad.setAttribute('role', 'application');
  pad.setAttribute('aria-label', 'Gleam touch field. Across is pitch, up is timbre, pressure is level. Hold latches a finger or a note. The generator moves the point and can play a scale by itself.');
  const canvas = document.createElement('canvas');
  canvas.id = 'gleamCv';
  pad.appendChild(canvas);
  const bar = document.createElement('div');
  bar.className = 'gleam-bar';
  bar.id = 'gleamBar';
  const read = document.createElement('div');
  read.className = 'gleam-read';
  read.id = 'gleamRead';
  app.append(pad, bar, read);
  container.appendChild(app);

  const buttons = {};
  function chip(id, label, pressed, title) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'gchip';
    b.id = id;
    b.textContent = label;
    b.title = title || label;
    b.setAttribute('aria-pressed', String(!!pressed));
    bar.appendChild(b);
    buttons[id] = b;
    return b;
  }
  MODES.forEach(m => chip('gleamMode-' + m, m, false, m === 'field' ? 'Fingers are voices' : m === 'room' ? 'Orbs around a listener' : 'Effect on the master'));
  SCALES.forEach(s => chip('gleamScale-' + s, s === 'pentatonic' ? 'penta' : s, false));
  const root = document.createElement('select');
  root.id = 'gleamKey';
  root.setAttribute('aria-label', 'Root key');
  ROOTS.forEach((name, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = name;
    root.appendChild(o);
  });
  bar.appendChild(root);
  chip('gleamHrtf', 'HRTF', false, 'Per-orb head response, otherwise stereo pan');
  chip('gleamOrbit', 'orbit', false, 'Orbs circle the listener');
  chip('gleamDrift', 'drift', false, 'Orbs wander');
  chip('gleamAdd', 'add orb', false, 'Drop a sound in the room');
  chip('gleamRemove', 'remove', false, 'Remove the selected orb');
  chip('gleamStutter', 'stutter', false, 'Pressure chops the master while the effect pad is touched');
  chip('gleamHold', 'hold', false, 'Latch the current fingers and notes. They keep sounding after you let go. Toggle off, or press panic, to release them.');
  chip('gleamPanic', 'panic', false, 'Silence every Gleam voice and release hold');
  chip('gleamRec', 'rec', false, 'Record the gesture');
  chip('gleamLoop', 'loop', false, 'Play the gesture again');
  chip('gleamClear', 'clear', false, 'Forget the gesture');
  const link = document.createElement('a');
  link.className = 'gleam-link';
  link.id = 'gleamFull';
  link.href = standalone ? '/synth/' : '/synth/gleam/';
  link.textContent = standalone ? 'Rack' : 'Full screen';
  bar.appendChild(link);
  const gen = document.createElement('select');
  gen.id = 'gleamGen';
  gen.setAttribute('aria-label', 'Generator');
  GENERATORS.forEach(name => {
    const o = document.createElement('option');
    o.value = name;
    o.textContent = name === 'off' ? 'generator off' : name;
    gen.appendChild(o);
  });
  bar.appendChild(gen);
  function slider(id, label, min, max, step, value) {
    const lab = document.createElement('label');
    lab.className = 'grow';
    lab.innerHTML = label + ' <input id="' + id + '" type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '" aria-label="Generator ' + label + '">';
    bar.appendChild(lab);
    return lab;
  }
  slider('gleamRate', 'rate', '0.05', '8', '0.01', '0.8');
  slider('gleamDepth', 'depth', '0', '1', '0.01', '0.75');
  slider('gleamSeed', 'seed', '0', '9999', '1', '1');
  const levelLab = document.createElement('label');
  levelLab.className = 'grow';
  levelLab.innerHTML = 'level <input id="gleamLevel" type="range" min="0" max="1" step="0.01" value="0.85" aria-label="Gleam level">';
  bar.appendChild(levelLab);

  const pointers = new Map();
  const trails = new Map();
  const particles = [];
  let audioLevel = 0;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let dragOrb = null;

  function patch() { return host.patch(); }
  function edit(partial) {
    const next = normalizeGleam(Object.assign({}, patch(), partial));
    host.setPatch(next);
    if (opts && opts.edited) opts.edited(next);
    sync();
  }
  function sync() {
    const p = patch();
    MODES.forEach(m => { const b = buttons['gleamMode-' + m]; if (b) b.setAttribute('aria-pressed', String(p.mode === m)); });
    SCALES.forEach(s => { const b = buttons['gleamScale-' + s]; if (b) b.setAttribute('aria-pressed', String(p.scale === s)); });
    root.value = String(p.root);
    buttons.gleamHrtf.setAttribute('aria-pressed', String(!!p.hrtf));
    buttons.gleamStutter.setAttribute('aria-pressed', String(!!p.stutter));
    buttons.gleamHold.setAttribute('aria-pressed', String(!!p.hold));
    if (gen && document.activeElement !== gen) gen.value = p.generator;
    ['gleamLevel', 'gleamRate', 'gleamDepth', 'gleamSeed'].forEach(id => {
      const el = document.getElementById(id);
      if (!el || document.activeElement === el) return;
      const key = id === 'gleamLevel' ? 'level' : id === 'gleamRate' ? 'rate' : id === 'gleamDepth' ? 'depth' : 'seed';
      el.value = String(p[key]);
    });
    const info = host.tape();
    buttons.gleamRec.setAttribute('aria-pressed', String(!!info.recording));
    buttons.gleamLoop.setAttribute('aria-pressed', String(!!host.loopOn()));
    const g = host.generator();
    const note = p.mode === 'effect'
      ? 'Effect. Across sweeps the filter, up raises delay feedback' + (p.stutter ? ', pressure stutters.' : '.')
      : p.mode === 'room'
        ? 'Room. Drag an orb around the listener. Farther is quieter and wetter.'
        : 'Field. Each finger is a voice. Across is pitch, up is timbre.';
    const heldN = host.latched().length;
    const genNote = g && Number.isFinite(g.midi) ? ' ' + noteName(g.midi) : '';
    const extra = (p.hold ? '  HOLD' + (heldN ? ' ' + heldN : '') : '')
      + (p.generator === 'off' ? '' : '  ' + p.generator + genNote)
      + (info.duration ? '  take ' + info.duration.toFixed(1) + 's' : '');
    read.textContent = note + extra;
  }
  function noteName(midi) {
    const n = Math.round(midi);
    return ROOTS[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);
  }
  MODES.forEach(m => buttons['gleamMode-' + m].addEventListener('click', () => edit({ mode: m })));
  SCALES.forEach(s => buttons['gleamScale-' + s].addEventListener('click', () => edit({ scale: s })));
  root.addEventListener('change', () => edit({ root: +root.value }));
  buttons.gleamHrtf.addEventListener('click', () => edit({ hrtf: !patch().hrtf }));
  buttons.gleamStutter.addEventListener('click', () => edit({ stutter: !patch().stutter }));
  buttons.gleamHold.addEventListener('click', () => edit({ hold: !patch().hold }));
  buttons.gleamPanic.addEventListener('click', () => {
    if (opts && opts.panic) opts.panic();
    else host.panic();
  });
  gen.addEventListener('change', () => edit({ generator: gen.value }));
  document.getElementById('gleamRate').addEventListener('input', e => edit({ rate: +e.target.value }));
  document.getElementById('gleamDepth').addEventListener('input', e => edit({ depth: +e.target.value }));
  document.getElementById('gleamSeed').addEventListener('input', e => edit({ seed: +e.target.value }));
  host.listen(next => {
    sync();
    if (opts && opts.edited) opts.edited(next);
  });
  buttons.gleamOrbit.addEventListener('click', () => {
    const on = buttons.gleamOrbit.getAttribute('aria-pressed') !== 'true';
    buttons.gleamOrbit.setAttribute('aria-pressed', String(on));
    if (on) buttons.gleamDrift.setAttribute('aria-pressed', 'false');
    host.setAutos(on, false);
  });
  buttons.gleamDrift.addEventListener('click', () => {
    const on = buttons.gleamDrift.getAttribute('aria-pressed') !== 'true';
    buttons.gleamDrift.setAttribute('aria-pressed', String(on));
    if (on) buttons.gleamOrbit.setAttribute('aria-pressed', 'false');
    host.setAutos(false, on);
  });
  buttons.gleamAdd.addEventListener('click', () => {
    edit({ mode: 'room' });
    host.spawn({ x: (Math.random() * 1.2 - 0.6), y: (Math.random() * 1.2 - 0.6), z: 0.85 });
  });
  buttons.gleamRemove.addEventListener('click', () => host.removeOrb());
  buttons.gleamRec.addEventListener('click', () => {
    const info = host.tape();
    host.record(!info.recording);
    sync();
  });
  buttons.gleamLoop.addEventListener('click', () => {
    if (host.loopOn()) host.stopTape();
    else host.playTape();
    sync();
  });
  buttons.gleamClear.addEventListener('click', () => {
    host.stopTape();
    host.record(false);
    host.playTape({ duration: 0, events: [] });
    host.stopTape();
    sync();
  });
  document.getElementById('gleamLevel').addEventListener('input', e => edit({ level: +e.target.value }));

  function ptOf(e) {
    const r = pad.getBoundingClientRect();
    const x = r.width ? (e.clientX - r.left) / r.width : 0;
    const y = r.height ? 1 - (e.clientY - r.top) / r.height : 0;
    return { id: e.pointerId, x: clamp(x, 0, 1), y: clamp(y, 0, 1), z: pressureOf(e), pointerType: e.pointerType, width: e.width, height: e.height };
  }
  function roomPt(p) { return { id: p.id, x: p.x * 2 - 1, y: p.y * 2 - 1, z: p.z }; }
  function hitOrb(p) {
    const r = pad.getBoundingClientRect();
    const list = host.orbs();
    let best = null;
    let bestD = 36;
    list.forEach(o => {
      const sx = (o.x + 1) / 2 * r.width;
      const sy = (1 - (o.y + 1) / 2) * r.height;
      const px = p.x * r.width;
      const py = (1 - p.y) * r.height;
      const d = Math.hypot(sx - px, sy - py);
      if (d < bestD) { bestD = d; best = o; }
    });
    return best;
  }
  function remember(p, type) {
    const info = host.tape();
    if (!info.recording) return;
    host.pushTape(performance.now(), { type, id: p.id, x: p.x, y: p.y, z: p.z });
  }
  function down(e) {
    if (opts && opts.wake) opts.wake();
    if (e.cancelable) e.preventDefault();
    pad.focus({ preventScroll: true });
    try { pad.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events may not capture */ }
    const p = ptOf(e);
    pointers.set(e.pointerId, p);
    if (!trails.has(e.pointerId)) trails.set(e.pointerId, []);
    if (patch().mode === 'room') {
      const hit = hitOrb(p);
      if (hit) { dragOrb = hit.id; host.selectOrb(hit.id); host.moveOrb(hit.id, p.x * 2 - 1, p.y * 2 - 1); }
      else {
        const orb = host.spawn(roomPt(p));
        dragOrb = orb ? orb.id : null;
      }
    } else host.pointer('down', patch().mode === 'room' ? roomPt(p) : p);
    remember(p, 'down');
  }
  function move(e) {
    if (!pointers.has(e.pointerId)) return;
    if (e.cancelable) e.preventDefault();
    const p = ptOf(e);
    pointers.set(e.pointerId, p);
    const trail = trails.get(e.pointerId);
    if (trail) {
      trail.push({ x: p.x, y: p.y, n: audioLevel });
      if (trail.length > 48) trail.shift();
    }
    if (patch().mode === 'room' && dragOrb) host.moveOrb(dragOrb, p.x * 2 - 1, p.y * 2 - 1);
    else if (patch().mode !== 'room') host.pointer('move', p);
    remember(p, 'move');
  }
  function up(e) {
    if (!pointers.has(e.pointerId)) return;
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (patch().mode === 'room') dragOrb = null;
    else host.pointer(e.type === 'pointercancel' ? 'cancel' : 'up', p);
    remember(p, e.type === 'pointercancel' ? 'cancel' : 'up');
    trails.delete(e.pointerId);
  }
  pad.addEventListener('pointerdown', down);
  pad.addEventListener('pointermove', move);
  pad.addEventListener('pointerup', up);
  pad.addEventListener('pointercancel', up);
  window.addEventListener('pointerup', e => { if (pointers.has(e.pointerId)) up(e); });
  window.addEventListener('pointercancel', e => { if (pointers.has(e.pointerId)) up(e); });
  window.addEventListener('blur', () => { pointers.clear(); host.panic(); trails.clear(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { pointers.clear(); host.panic(); } });

  pad.addEventListener('keydown', e => {
    const k = e.key;
    if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'ArrowUp' && k !== 'ArrowDown' && k !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    if (k === 'Escape') {
      if (opts && opts.panic) opts.panic();
      else host.panic();
      return;
    }
    const id = 'key';
    const cur = pointers.get(id) || { id, x: 0.5, y: 0.4, z: 0.8 };
    const step = e.shiftKey ? 0.02 : 0.06;
    if (k === 'ArrowLeft') cur.x = clamp(cur.x - step, 0, 1);
    if (k === 'ArrowRight') cur.x = clamp(cur.x + step, 0, 1);
    if (k === 'ArrowUp') cur.y = clamp(cur.y + step, 0, 1);
    if (k === 'ArrowDown') cur.y = clamp(cur.y - step, 0, 1);
    pointers.set(id, cur);
    if (patch().mode === 'room') {
      if (!host.orbs().length) host.spawn(roomPt(cur));
      const id0 = host.selected() || (host.orbs()[0] && host.orbs()[0].id);
      if (id0) host.moveOrb(id0, cur.x * 2 - 1, cur.y * 2 - 1);
    } else host.pointer('move', cur);
  });

  host.setMeterListener(m => { audioLevel = m.peak || 0; });

  const ctx2 = canvas.getContext('2d', { alpha: false });
  function fit() {
    const r = pad.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(2, Math.floor(r.width * dpr));
    const h = Math.max(2, Math.floor(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }
  function spawnBits(x, y, level) {
    if (reduce) return;
    const n = 1 + Math.floor(clamp(level, 0, 1) * 3);
    for (let i = 0; i < n && particles.length < 160; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.15 + level * 1.4;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, boost: level });
    }
  }
  function draw(now) {
    requestAnimationFrame(draw);
    sync();
    if (document.hidden) return;
    fit();
    const w = canvas.width;
    const h = canvas.height;
    if (w < 2 || h < 2) return;
    ctx2.fillStyle = 'rgba(7, 8, 12, 0.28)';
    ctx2.fillRect(0, 0, w, h);
    const p = patch();
    ctx2.strokeStyle = 'rgba(255, 179, 71, 0.08)';
    ctx2.lineWidth = 1;
    ctx2.beginPath();
    for (let i = 1; i < 8; i++) {
      ctx2.moveTo(w * i / 8, 0); ctx2.lineTo(w * i / 8, h);
      ctx2.moveTo(0, h * i / 8); ctx2.lineTo(w, h * i / 8);
    }
    ctx2.stroke();
    if (p.mode === 'room') {
      ctx2.strokeStyle = 'rgba(255, 179, 71, 0.35)';
      ctx2.strokeRect(w * 0.08, h * 0.08, w * 0.84, h * 0.84);
      ctx2.beginPath();
      ctx2.arc(w / 2, h / 2, Math.min(w, h) * 0.03, 0, Math.PI * 2);
      ctx2.strokeStyle = 'rgba(0, 255, 157, 0.8)';
      ctx2.stroke();
      host.orbs().forEach(o => {
        const x = (o.x + 1) / 2 * w;
        const y = (1 - (o.y + 1) / 2) * h;
        const g = ctx2.createRadialGradient(x, y, 2, x, y, 36 + audioLevel * 80);
        g.addColorStop(0, 'rgba(255, 196, 110, 0.95)');
        g.addColorStop(1, 'rgba(255, 140, 40, 0)');
        ctx2.fillStyle = g;
        ctx2.beginPath();
        ctx2.arc(x, y, 34 + audioLevel * 70, 0, Math.PI * 2);
        ctx2.fill();
        if (audioLevel > 0.02) spawnBits(x / w, 1 - y / h, audioLevel);
      });
    }
    function glow(pt, held) {
      const x = pt.x * w;
      const y = (1 - pt.y) * h;
      const rad = 30 + (pt.z || 0.7) * 40 + audioLevel * 90;
      const g = ctx2.createRadialGradient(x, y, 2, x, y, rad);
      g.addColorStop(0, held ? 'rgba(255, 214, 150, 0.45)' : 'rgba(255, 214, 150, 0.9)');
      g.addColorStop(0.45, 'rgba(255, 140, 40, 0.25)');
      g.addColorStop(1, 'rgba(255, 120, 20, 0)');
      ctx2.fillStyle = g;
      ctx2.beginPath();
      ctx2.arc(x, y, rad, 0, Math.PI * 2);
      ctx2.fill();
      if (held) {
        ctx2.strokeStyle = 'rgba(255, 179, 71, 0.9)';
        ctx2.lineWidth = 2;
        ctx2.stroke();
      }
    }
    pointers.forEach(pt => {
      glow(pt, false);
      spawnBits(pt.x, pt.y, Math.max(audioLevel, pt.z * 0.35));
    });
    host.latched().forEach(pt => {
      if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return;
      glow(pt, true);
    });
    const moving = host.generator();
    if (moving && Number.isFinite(moving.x)) {
      const x = moving.x * w;
      const y = (1 - moving.y) * h;
      const rad = 26 + audioLevel * 70;
      const g = ctx2.createRadialGradient(x, y, 2, x, y, rad);
      g.addColorStop(0, 'rgba(0, 255, 157, 0.85)');
      g.addColorStop(1, 'rgba(0, 255, 157, 0)');
      ctx2.fillStyle = g;
      ctx2.beginPath();
      ctx2.arc(x, y, rad, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.strokeStyle = 'rgba(0, 255, 157, 0.95)';
      ctx2.lineWidth = 2;
      ctx2.beginPath();
      ctx2.arc(x, y, 10, 0, Math.PI * 2);
      ctx2.stroke();
      spawnBits(moving.x, moving.y, Math.max(audioLevel, 0.25));
    }
    trails.forEach(trail => {
      if (trail.length < 2) return;
      ctx2.beginPath();
      trail.forEach((pt, i) => {
        const x = pt.x * w;
        const y = (1 - pt.y) * h;
        if (i === 0) ctx2.moveTo(x, y); else ctx2.lineTo(x, y);
      });
      ctx2.strokeStyle = 'rgba(255, 179, 71,' + (0.25 + audioLevel * 0.6) + ')';
      ctx2.lineWidth = 2 + audioLevel * 8;
      ctx2.stroke();
    });
    for (let i = particles.length - 1; i >= 0; i--) {
      const bit = particles[i];
      bit.x += bit.vx * 0.008;
      bit.y += bit.vy * 0.008;
      bit.life -= 0.02;
      if (bit.life <= 0) { particles.splice(i, 1); continue; }
      ctx2.fillStyle = 'rgba(0, 255, 157,' + (bit.life * (0.35 + bit.boost)) + ')';
      ctx2.fillRect(bit.x * w, (1 - bit.y) * h, 2 + bit.boost * 3, 2 + bit.boost * 3);
    }
    if (p.mode === 'effect') {
      ctx2.fillStyle = 'rgba(255, 179, 71, 0.55)';
      ctx2.font = (12 * (window.devicePixelRatio || 1)) + 'px sans-serif';
      ctx2.fillText('filter', 12, h - 16);
      ctx2.fillText('feedback', 12, 22);
    }
  }
  requestAnimationFrame(draw);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(pad);
  sync();

  const view = {
    sync,
    visual: () => ({ level: audioLevel, particles: particles.length, pointers: pointers.size }),
    pad: () => pad,
  };
  return view;
}
