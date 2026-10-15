// Additron patches. Schema v1, device 'additron'.
//
// An additron is a vacuum tube that adds: a binary adder from the early
// computer years. This one adds harmonics. Sixteen partials, nine of them
// footage stops, the rest free for a drawn spectrum. Two snapshots morph
// into each other. Each partial keeps its own envelope, and a rotary speaker
// (horn and drum) moves the sound. Original code. Stops and a spinning
// speaker are old ideas; nothing here is copied from a product.

import { clone } from './patches.js';
import { parameterTable, RACK_API, registerDevice } from './device.js';

export { RACK_API };
export const AD_SCHEMA = 1;
export const AD_ID = 'additron';
export const PARTS = 16;

// Partials are harmonics of the 16' stop. The played key is the 8' stop,
// partial 1 (the second harmonic of 16'). Footage marks the nine stops.
export const FOOT = [
  { i: 0, name: "16'" },
  { i: 1, name: "8'" },
  { i: 2, name: "5⅓'" },
  { i: 3, name: "4'" },
  { i: 5, name: "2⅔'" },
  { i: 7, name: "2'" },
  { i: 9, name: "1⅗'" },
  { i: 11, name: "1⅓'" },
  { i: 15, name: "1'" },
];

export const SHAPES = ['hand', 'stops'];
export const SPEEDS = ['chorale', 'tremolo', 'brake'];
export const EDITS = ['a', 'b'];
export const PERC = ['off', '2', '3', '5'];

const RANGE = {
  level: [0, 1],
  morph: [0, 1],
  attack: [0.001, 2],
  decay: [0.02, 6],
  sustain: [0, 1],
  release: [0.01, 6],
  tilt: [-1, 1],
  perc: [0, 1],
  percDecay: [0.02, 1.5],
  click: [0, 1],
  spread: [0, 1],
  drive: [0, 1],
  leak: [0, 1],
  vib: [0, 1],
};

const CATS = ['Stop', 'Draw', 'Morph', 'Reed'];

function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
function pick(list, value, fallback) { return list.includes(value) ? value : fallback; }

export function zeros() {
  const a = new Array(PARTS);
  for (let i = 0; i < PARTS; i++) a[i] = 0;
  return a;
}

function copySpec(src, fallback) {
  const out = (fallback || zeros()).slice();
  if (!Array.isArray(src)) return out;
  for (let i = 0; i < PARTS; i++) {
    const n = +src[i];
    if (Number.isFinite(n)) out[i] = clamp(n, 0, 1);
  }
  return out;
}

function fluteDraw() {
  const d = zeros();
  d[1] = 1;
  d[3] = 0.125;
  return d;
}

function fullDraw() {
  const d = zeros();
  d[0] = 0.5;
  d[1] = 1;
  d[2] = 0.375;
  d[3] = 0.75;
  d[5] = 0.5;
  d[7] = 0.875;
  d[9] = 0.25;
  d[11] = 0.375;
  d[15] = 0.5;
  return d;
}

function quintDraw() {
  const d = zeros();
  d[1] = 1;
  d[5] = 0.75;
  return d;
}

function oddDraw() {
  const d = zeros();
  for (let i = 0; i < PARTS; i += 2) d[i] = clamp(1 - i * 0.07, 0, 1);
  return d;
}

function brightDraw() {
  const d = zeros();
  d[1] = 0.35;
  d[3] = 0.7;
  d[7] = 1;
  d[9] = 0.85;
  d[12] = 0.55;
  d[15] = 0.4;
  return d;
}

export const AD_DEFAULT = {
  v: AD_SCHEMA,
  device: AD_ID,
  name: 'Copper Flute',
  cat: 'Stop',
  level: 0.8,
  shape: 'stops',
  edit: 'a',
  morph: 0,
  draw: fluteDraw(),
  drawB: fullDraw(),
  attack: 0.012,
  decay: 0.45,
  sustain: 0.86,
  release: 0.4,
  tilt: 0.28,
  perc: 0,
  percHarm: 'off',
  percDecay: 0.2,
  click: 0.04,
  rotor: true,
  speed: 'chorale',
  spread: 0.72,
  drive: 0.08,
  leak: 0.22,
  vib: 0,
  voice: { mode: 'poly' },
};

export function normalizeAdditron(p) {
  const out = clone(AD_DEFAULT);
  if (!p || typeof p !== 'object') return out;
  if (typeof p.name === 'string' && p.name.trim()) out.name = p.name.trim().slice(0, 40);
  if (CATS.includes(p.cat)) out.cat = p.cat;
  Object.keys(RANGE).forEach(k => {
    if (p[k] == null || !Number.isFinite(+p[k])) return;
    out[k] = clamp(+p[k], RANGE[k][0], RANGE[k][1]);
  });
  out.shape = pick(SHAPES, p.shape, out.shape);
  out.edit = pick(EDITS, p.edit, out.edit);
  out.speed = pick(SPEEDS, p.speed, out.speed);
  out.percHarm = pick(PERC, p.percHarm, out.percHarm);
  if (p.rotor != null) out.rotor = !!p.rotor;
  out.draw = copySpec(p.draw, out.draw);
  out.drawB = copySpec(p.drawB, out.drawB);
  return out;
}

// The spectrum a key actually sounds: morph of the two snapshots, and, in
// stops mode, only the nine footage partials at eighths.
export function spectrumOf(patch) {
  const p = normalizeAdditron(patch);
  const stops = p.shape === 'stops';
  const mark = new Array(PARTS).fill(false);
  if (stops) FOOT.forEach(f => { mark[f.i] = true; });
  const out = new Array(PARTS);
  const m = p.morph;
  for (let i = 0; i < PARTS; i++) {
    let v = (1 - m) * p.draw[i] + m * p.drawB[i];
    if (stops) v = mark[i] ? Math.round(v * 8) / 8 : 0;
    out[i] = v;
  }
  return out;
}

export const REG = {
  flute: fluteDraw,
  full: fullDraw,
  quint: quintDraw,
  odd: oddDraw,
};

function patch(name, cat, over) {
  const p = normalizeAdditron(Object.assign({ name, cat }, over || {}));
  p.name = name;
  p.cat = cat;
  return p;
}

export const AD_FACTORY = [
  patch('Copper Flute', 'Stop', {
    shape: 'stops', morph: 0, draw: fluteDraw(), drawB: fullDraw(),
    tilt: 0.2, rotor: true, speed: 'chorale', click: 0.03, perc: 0,
  }),
  patch('Full Chorus', 'Stop', {
    shape: 'stops', morph: 0, draw: fullDraw(), drawB: brightDraw(),
    tilt: 0.15, rotor: true, speed: 'tremolo', click: 0.05, level: 0.72,
  }),
  patch('Hollow Quint', 'Stop', {
    shape: 'stops', morph: 0, draw: quintDraw(), drawB: fluteDraw(),
    tilt: 0.05, rotor: true, speed: 'chorale', leak: 0.3,
  }),
  patch('Odd Reed', 'Draw', {
    shape: 'hand', morph: 0, draw: oddDraw(), drawB: brightDraw(),
    tilt: 0.55, attack: 0.008, decay: 0.7, sustain: 0.55,
    rotor: true, speed: 'chorale', click: 0.12, perc: 0.35, percHarm: '3', percDecay: 0.16,
  }),
  patch('Morph Bloom', 'Morph', {
    shape: 'hand', morph: 0.35, draw: fluteDraw(), drawB: brightDraw(),
    tilt: 0.7, attack: 0.02, decay: 1.1, sustain: 0.4, release: 0.8,
    rotor: true, speed: 'chorale', spread: 0.85,
  }),
];

export const AD_CATS = CATS;

const ENUMS = {
  shape: SHAPES.slice(),
  speed: SPEEDS.slice(),
  edit: EDITS.slice(),
  percHarm: PERC.slice(),
};

export const AD_PARAMETERS = parameterTable(AD_DEFAULT, RANGE, ENUMS);

export const additronDevice = {
  id: AD_ID,
  name: 'Additron',
  vendor: 'DX Edge',
  version: String(AD_SCHEMA),
  api: RACK_API,
  description: 'Additive organ: drawbars, a drawn spectrum, morphing snapshots, and a rotary speaker',
  instrument: true,
  audioInputs: 0,
  audioOutputs: 1,
  midiInput: true,
  midiOutput: false,
  processor: 'additron',
  worklet: 'additron.worklet.js',
  channels: 2,
  oversample: 1,
  parameters: AD_PARAMETERS,
  normalize: normalizeAdditron,
  factory: AD_FACTORY,
  defaults: AD_DEFAULT,
  messages: ['patch', 'on', 'off', 'bend', 'mw', 'sus', 'panic', 'active'],
};

registerDevice(additronDevice);
