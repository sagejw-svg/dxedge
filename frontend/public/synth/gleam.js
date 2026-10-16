// Gleam: a touch field for the rack.
//
// Across the pad is pitch, up is timbre, pressure or contact size is level.
// A second view places sounding orbs around a listener. Nothing here is copied
// from another instrument: the scales, the gesture tape and the room geometry
// are plain functions with no DOM and no audio nodes. The name is ours.

export const GLEAM_SCHEMA = 1;
export const GLEAM_ID = 'gleam';
export const RACK_API = 'dxrack/1';
export const VOICE_COUNT = 8;

export const SCALES = ['major', 'minor', 'pentatonic', 'chromatic', 'free'];
export const MODES = ['field', 'room', 'effect'];
export const GENERATORS = ['off', 'walk', 'orbit', 'lissajous', 'drift', 'arp'];
export const ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Semitone offsets from the root. Pentatonic is the five-note major form.
const STEPS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function midiHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export const GLEAM_DEFAULT = {
  v: GLEAM_SCHEMA,
  device: GLEAM_ID,
  name: 'Amber Field',
  cat: 'Field',
  mode: 'field',
  scale: 'major',
  root: 0,
  octaves: 2,
  glide: 0.035,
  level: 0.85,
  space: 0.45,
  reverb: 0.28,
  hrtf: false,
  orbit: 0.15,
  drift: 0.35,
  color: 0.35,
  stutter: false,
  hold: false,
  generator: 'off',
  rate: 0.8,
  depth: 0.75,
  seed: 1,
};

const RANGE = {
  root: [0, 11],
  octaves: [1, 4],
  glide: [0, 0.4],
  level: [0, 1],
  space: [0, 1],
  reverb: [0, 1],
  orbit: [0, 1.5],
  drift: [0, 2],
  color: [0, 1],
  rate: [0.05, 8],
  depth: [0, 1],
  seed: [0, 9999],
};

export function normalizeGleam(src) {
  const d = GLEAM_DEFAULT;
  const p = src && typeof src === 'object' ? src : {};
  const out = {
    v: GLEAM_SCHEMA,
    device: GLEAM_ID,
    name: String(p.name == null ? d.name : p.name).slice(0, 40) || d.name,
    cat: String(p.cat == null ? d.cat : p.cat).slice(0, 24) || d.cat,
    mode: MODES.includes(p.mode) ? p.mode : d.mode,
    scale: SCALES.includes(p.scale) ? p.scale : d.scale,
    root: d.root,
    octaves: d.octaves,
    glide: d.glide,
    level: d.level,
    space: d.space,
    reverb: d.reverb,
    hrtf: p.hrtf == null ? d.hrtf : !!p.hrtf,
    orbit: d.orbit,
    drift: d.drift,
    color: d.color,
    stutter: p.stutter == null ? d.stutter : !!p.stutter,
    hold: p.hold == null ? d.hold : !!p.hold,
    generator: GENERATORS.includes(p.generator) ? p.generator : d.generator,
    rate: d.rate,
    depth: d.depth,
    seed: d.seed,
  };
  Object.keys(RANGE).forEach(k => {
    const n = +p[k];
    const span = RANGE[k];
    out[k] = Number.isFinite(n) ? clamp(n, span[0], span[1]) : d[k];
  });
  if (Number.isInteger(RANGE.root[0]) && Number.isInteger(RANGE.root[1])) out.root = Math.round(out.root);
  out.octaves = Math.round(out.octaves);
  out.seed = Math.round(out.seed);
  return out;
}

function param(id, label, type, def, min, max, extra) {
  return Object.assign({ id, label, type, default: def, min, max }, extra || {});
}

export const GLEAM_PARAMETERS = {
  mode: param('mode', 'Mode', 'choice', 'field', 0, MODES.length - 1, { choices: MODES.slice() }),
  scale: param('scale', 'Scale', 'choice', 'major', 0, SCALES.length - 1, { choices: SCALES.slice() }),
  root: param('root', 'Root', 'int', 0, 0, 11),
  octaves: param('octaves', 'Octaves', 'int', 2, 1, 4),
  glide: param('glide', 'Glide', 'float', 0.035, 0, 0.4),
  level: param('level', 'Level', 'float', 0.85, 0, 1),
  space: param('space', 'Space', 'float', 0.45, 0, 1),
  reverb: param('reverb', 'Room', 'float', 0.28, 0, 1),
  hrtf: param('hrtf', 'HRTF', 'boolean', false, 0, 1),
  orbit: param('orbit', 'Orbit', 'float', 0.15, 0, 1.5),
  drift: param('drift', 'Drift', 'float', 0.35, 0, 2),
  color: param('color', 'Color', 'float', 0.35, 0, 1),
  stutter: param('stutter', 'Stutter', 'boolean', false, 0, 1),
  hold: param('hold', 'Hold', 'boolean', false, 0, 1),
  generator: param('generator', 'Generator', 'choice', 'off', 0, GENERATORS.length - 1, { choices: GENERATORS.slice() }),
  rate: param('rate', 'Rate', 'float', 0.8, 0.05, 8),
  depth: param('depth', 'Depth', 'float', 0.75, 0, 1),
  seed: param('seed', 'Seed', 'int', 1, 0, 9999),
};

// Pitch for a finger. x is 0 at the left and 1 at the right.
// The top of the pad (x = 1) is the root, `octaves` above the bottom.
// `index` is the scale degree, or null when the axis is free.
export function pitchOf(x, patch) {
  const p = normalizeGleam(patch);
  const x1 = clamp(+x || 0, 0, 1);
  const base = 48 + p.root;
  const span = p.octaves * 12;
  if (p.scale === 'free') {
    const midi = base + x1 * span;
    return { midi, hz: midiHz(midi), index: null };
  }
  const steps = STEPS[p.scale];
  const n = steps.length * p.octaves;
  const idx = clamp(Math.round(x1 * n), 0, n);
  const midi = idx === n
    ? base + span
    : base + Math.floor(idx / steps.length) * 12 + steps[idx % steps.length];
  return { midi, hz: midiHz(midi), index: idx };
}

// Y is timbre: 0 is a dark sine, 1 is a bright saw. The fundamental is kept
// above the filter so a low finger does not silence a high note.
export function timbreOf(y, hz) {
  const t = clamp(+y || 0, 0, 1);
  const open = 70 * Math.pow(14000 / 70, t);
  const fund = Math.max(40, +hz || 0) * 1.15;
  return { morph: t, cutoff: Math.max(open, Math.min(fund, 14000)) };
}

// Equal-ish pan from the field. `space` is how far a full left or right travel goes.
export function fieldPan(x, space) {
  return clamp((clamp(+x || 0, 0, 1) * 2 - 1) * clamp(+space || 0, 0, 1), -1, 1);
}

// Room position. The listener sits at the origin. x is left/right, y is back/front.
// Gain falls with distance. The send grows with it, so far orbs sit in the room.
export function placeOf(x, y) {
  const px = clamp(+x || 0, -1, 1);
  const py = clamp(+y || 0, -1, 1);
  const dist = Math.min(Math.SQRT2, Math.hypot(px, py));
  return {
    x: px,
    y: py,
    pan: px,
    dist,
    gain: 1 / (1 + dist * 2.2),
    send: Math.min(1, dist * 0.9),
  };
}

// A circle around the listener. `speed` is revolutions per second. t is seconds.
export function orbitPosition(t, radius, speed, phase) {
  const a = (+phase || 0) + (+t || 0) * (+speed || 0) * Math.PI * 2;
  const r = clamp(+radius || 0, 0, 1);
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

// A slow wander around an origin. Speed 0 stays put. The path is a sum of
// sines so it is continuous and the same time always gives the same point.
export function driftPosition(t, speed, seed, origin) {
  const ox = origin && Number.isFinite(+origin.x) ? +origin.x : 0;
  const oy = origin && Number.isFinite(+origin.y) ? +origin.y : 0;
  const s = +speed || 0;
  if (!(s > 0)) return { x: clamp(ox, -1, 1), y: clamp(oy, -1, 1) };
  const k = +seed || 0;
  const tt = +t || 0;
  const x = ox + Math.sin(tt * s * 0.7 + k) * 0.22 + Math.sin(tt * s * 0.19 + k * 1.7) * 0.1;
  const y = oy + Math.cos(tt * s * 0.53 + k * 0.6) * 0.22 + Math.sin(tt * s * 0.13 + k) * 0.08;
  return { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
}

// Pressure, or the contact size when a pointer has no pressure (a mouse).
// A mouse with no size reports a steady 0.75 so a click is audible.
export function pressureOf(pointer) {
  const src = pointer || {};
  const pr = +src.pressure;
  if (pr > 0) return clamp(pr, 0, 1);
  const w = +src.width || 0;
  const h = +src.height || 0;
  if (w > 0 && h > 0) return clamp((w * h) / 1600, 0.15, 1);
  return src.pointerType === 'touch' ? 0.55 : 0.75;
}

// Effect pad. X sweeps a lowpass, Y is delay feedback, Z is stutter depth.
export function effectOf(x, y, z, tempo) {
  const X = clamp(+x || 0, 0, 1);
  const Y = clamp(+y || 0, 0, 1);
  const Z = z == null || !Number.isFinite(+z) ? 0 : clamp(+z, 0, 1);
  const bpm = clamp(+tempo || 120, 40, 240);
  return {
    cutoff: 90 * Math.pow(16000 / 90, X),
    q: 0.7 + Y * 4.5,
    feedback: Y * 0.88,
    wet: Y * 0.72,
    delaySec: Math.min(0.7, (60 / bpm) * 0.25),
    stutterHz: (bpm / 60) * 4,
    stutterDepth: Z,
    on: true,
  };
}

// Gesture tape. Events are { t, type, id, x, y, z } with t in seconds from the
// start of the take. `pointersAt` is who is down at a given time. Looping wraps
// into the take, so a finger that was still down at the end is up again at the top.
export function pointersAt(tape, time, loop) {
  if (!tape || !tape.events || !tape.events.length) return [];
  const dur = +tape.duration || 0;
  let t = +time || 0;
  const wrap = loop == null ? !!tape.loop : !!loop;
  if (wrap && dur > 0) t = ((t % dur) + dur) % dur;
  else if (dur > 0 && t > dur) return [];
  const state = new Map();
  const evs = tape.events;
  for (let i = 0; i < evs.length; i++) {
    const e = evs[i];
    if ((+e.t || 0) > t + 1e-9) break;
    if (e.type === 'down' || e.type === 'move') state.set(e.id, e);
    else if (e.type === 'up' || e.type === 'cancel') state.delete(e.id);
  }
  return [...state.values()];
}

export function createTape() {
  let recording = false;
  let t0 = 0;
  let events = [];
  let duration = 0;
  return {
    get recording() { return recording; },
    get duration() { return duration; },
    get events() { return events; },
    snapshot() { return { duration, loop: false, events: events.map(e => Object.assign({}, e)) }; },
    start(now) {
      recording = true;
      t0 = +now || 0;
      events = [];
      duration = 0;
    },
    push(now, ev) {
      if (!recording || !ev) return;
      const t = Math.max(0, (+now || 0) - t0);
      events.push({
        t, type: ev.type, id: ev.id,
        x: ev.x, y: ev.y, z: ev.z,
      });
      duration = t;
    },
    stop(now) {
      if (!recording) return this.snapshot();
      recording = false;
      duration = Math.max(duration, Math.max(0, (+now || 0) - t0));
      return this.snapshot();
    },
  };
}

// mulberry32. Seed 0 is a real sequence, not a stand-in for "unset".
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function walkCorner(seed, k) {
  const rng = mulberry32((Math.imul(seed | 0, 10007) + Math.imul(k | 0, 97) + 0x9e3779b9) >>> 0);
  return { x: rng(), y: rng() };
}

function scaleCount(p) {
  if (p.scale === 'free') return p.octaves * 12;
  return STEPS[p.scale].length * p.octaves;
}

function degreePitch(p, idx) {
  const base = 48 + p.root;
  const span = p.octaves * 12;
  if (p.scale === 'free') {
    const n = Math.max(1, p.octaves * 12);
    const midi = base + (clamp(idx, 0, n - 1) / n) * span;
    return { midi, hz: midiHz(midi), index: idx };
  }
  const steps = STEPS[p.scale];
  const n = steps.length * p.octaves;
  const i = clamp(Math.round(idx), 0, n);
  const midi = i === n
    ? base + span
    : base + Math.floor(i / steps.length) * 12 + steps[i % steps.length];
  return { midi, hz: midiHz(midi), index: i };
}

function arpOrder(count, seed) {
  const n = Math.max(1, count | 0);
  const order = [];
  for (let i = 0; i < n; i++) order.push(i);
  const rng = mulberry32((seed | 0) + 0xA5A5);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  return order;
}

function arpIndex(step, count, seed) {
  const n = Math.max(1, count | 0);
  const s = Math.max(0, step | 0);
  const kind = Math.abs(seed | 0) % 4;
  if (kind === 1) return (n - 1) - (s % n);
  if (kind === 2) {
    const period = n < 2 ? 1 : n * 2 - 2;
    const i = s % period;
    return i < n ? i : period - i;
  }
  if (kind === 3) return arpOrder(n, seed)[s % n];
  return s % n;
}

// Where the generator sits at time t (seconds). x and y are pad units, 0 to 1:
// across is pitch, up is timbre, the same axes a finger uses. Null when the
// generator is off. The same patch and the same time always return the same point.
// Orbit: x = 0.5 + cos(2π rate t + seed/100) * 0.48 depth, y the sine of that angle.
// Lissajous uses a y frequency of 2..5 from the seed. Arpeggio seed % 4 picks
// up, down, up-down, or a shuffled order, and depth is how much of the scale it climbs.
export function generatorPoint(patch, time) {
  const p = normalizeGleam(patch);
  if (p.generator === 'off') return null;
  const t = Math.max(0, +time || 0);
  const depth = p.depth;
  const rate = p.rate;
  const seed = p.seed | 0;
  if (p.generator === 'arp') {
    const span = scaleCount(p);
    const count = Math.max(1, Math.round(depth * span));
    const step = Math.floor(t * rate);
    const idx = arpIndex(step, count, seed);
    const pitch = degreePitch(p, idx);
    const x = span <= 0 ? 0 : clamp((idx + 0.15) / span, 0, 1);
    const y = clamp(0.2 + (count < 2 ? 0.3 : idx / (count - 1)) * 0.6, 0, 1);
    return { x, y, z: 0.84, hz: pitch.hz, midi: pitch.midi, index: pitch.index, step, trig: true, on: true };
  }
  let x = 0.5;
  let y = 0.5;
  const amp = 0.48 * depth;
  if (p.generator === 'orbit') {
    const a = t * rate * Math.PI * 2 + (seed % 628) / 100;
    x = 0.5 + Math.cos(a) * amp;
    y = 0.5 + Math.sin(a) * amp;
  } else if (p.generator === 'lissajous') {
    const ratio = 2 + (Math.abs(seed) % 4);
    const phase = ((Math.abs(seed) * 17) % 100) / 100 * Math.PI;
    x = 0.5 + Math.sin(t * rate * Math.PI * 2) * amp;
    y = 0.5 + Math.sin(t * rate * ratio * Math.PI * 2 + phase) * amp;
  } else if (p.generator === 'drift') {
    const s = Math.max(0.15, rate);
    const k = seed * 0.17;
    x = 0.5 + (Math.sin(t * s * 0.7 + k) * 0.62 + Math.sin(t * s * 0.19 + k * 1.7) * 0.38) * amp;
    y = 0.5 + (Math.cos(t * s * 0.53 + k * 0.6) * 0.62 + Math.sin(t * s * 0.13 + k) * 0.38) * amp;
  } else {
    const hop = 1 / rate;
    const k = Math.floor(t / hop);
    const u = t / hop - k;
    const smooth = u * u * (3 - 2 * u);
    const a = walkCorner(seed, k);
    const b = walkCorner(seed, k + 1);
    const sx = a.x + (b.x - a.x) * smooth;
    const sy = a.y + (b.y - a.y) * smooth;
    x = 0.5 + (sx - 0.5) * depth;
    y = 0.5 + (sy - 0.5) * depth;
  }
  x = clamp(x, 0, 1);
  y = clamp(y, 0, 1);
  const pitch = pitchOf(x, p);
  return { x, y, z: 0.8, hz: pitch.hz, midi: pitch.midi, index: pitch.index, step: 0, trig: false, on: true };
}

// Voice events for an offline render. An arpeggio is one event per step.
// Continuous motion is sampled often enough that the glide follows the path.
export function generatorEvents(patch, seconds) {
  const p = normalizeGleam(patch);
  if (p.generator === 'off') return [];
  const dur = Math.max(0, +seconds || 0);
  const dt = p.generator === 'arp' ? 1 / p.rate : 1 / 40;
  const events = [];
  let prev = -1;
  for (let t = 0; t < dur + 1e-9; t += dt) {
    const at = Math.min(t, dur);
    const g = generatorPoint(p, at);
    if (!g) break;
    const trig = p.generator === 'arp' && g.step !== prev;
    prev = g.step;
    events.push({
      at, type: 'on', id: 'gen', x: g.x, y: g.y, z: g.z, hz: g.hz, trig,
    });
    if (at >= dur) break;
  }
  return events;
}

function factory(name, cat, over) {
  return normalizeGleam(Object.assign({ name, cat }, over));
}

export const GLEAM_FACTORY = [
  factory('Amber Field', 'Field', { mode: 'field', scale: 'major', root: 0, octaves: 2, space: 0.4, color: 0.3, reverb: 0.25 }),
  factory('Dusk Minor', 'Field', { mode: 'field', scale: 'minor', root: 2, octaves: 2, space: 0.55, color: 0.55, reverb: 0.4, glide: 0.06 }),
  factory('Five Note', 'Field', { mode: 'field', scale: 'pentatonic', root: 0, octaves: 2, space: 0.35, color: 0.22, reverb: 0.2 }),
  factory('Open Room', 'Room', { mode: 'room', scale: 'pentatonic', root: 5, octaves: 2, reverb: 0.62, orbit: 0.12, drift: 0.4, color: 0.4 }),
  factory('Slow Orbit', 'Room', { mode: 'room', scale: 'major', root: 7, octaves: 1, reverb: 0.7, orbit: 0.22, drift: 0, color: 0.48, hrtf: false }),
  factory('Master Sweep', 'Effect', { mode: 'effect', stutter: true, scale: 'chromatic', color: 0.5 }),
  factory('Self Orbit', 'Field', { mode: 'field', scale: 'pentatonic', root: 0, octaves: 2, generator: 'orbit', rate: 0.18, depth: 0.85, seed: 4, space: 0.7, reverb: 0.45, color: 0.4 }),
];

export const GLEAM_CATS = ['Field', 'Room', 'Effect'];

export const gleamDevice = {
  id: GLEAM_ID,
  name: 'Gleam',
  vendor: 'DX Edge',
  version: String(GLEAM_SCHEMA),
  api: RACK_API,
  description: 'Touch field: pitch across, timbre up, a room of orbs, hold, and a generator',
  instrument: true,
  audioInputs: 0,
  audioOutputs: 1,
  midiInput: true,
  midiOutput: false,
  processor: 'gleam',
  worklet: 'gleam.worklet.js',
  channels: 2,
  parameters: GLEAM_PARAMETERS,
  normalize: normalizeGleam,
  factory: GLEAM_FACTORY,
  defaults: GLEAM_DEFAULT,
  modes: MODES.slice(),
  scales: SCALES.slice(),
  messages: ['patch', 'voice', 'on', 'off', 'panic', 'active'],
};
