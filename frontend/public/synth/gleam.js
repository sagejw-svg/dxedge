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
  };
  Object.keys(RANGE).forEach(k => {
    const n = +p[k];
    const span = RANGE[k];
    out[k] = Number.isFinite(n) ? clamp(n, span[0], span[1]) : d[k];
  });
  if (Number.isInteger(RANGE.root[0]) && Number.isInteger(RANGE.root[1])) out.root = Math.round(out.root);
  out.octaves = Math.round(out.octaves);
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
];

export const GLEAM_CATS = ['Field', 'Room', 'Effect'];

export const gleamDevice = {
  id: GLEAM_ID,
  name: 'Gleam',
  vendor: 'DX Edge',
  version: String(GLEAM_SCHEMA),
  api: RACK_API,
  description: 'Touch field: pitch across, timbre up, a room of orbs',
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
