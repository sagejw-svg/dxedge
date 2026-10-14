// Mote patches. Schema v1, device 'mote'.
//
// Mote is a granular instrument in the Filament rack: a buffer (a shipped sound,
// a dropped file, the microphone, or a capture of the rack) read in short grains.
// The page leaves the shared output tubes alone. ens and out are carried so a
// host that expects them still finds the fields.

import { DEFAULT as F_DEFAULT, clone } from './patches.js';
import { parameterTable, RACK_API, registerDevice } from './device.js';

export { RACK_API };
export const MOTE_SCHEMA = 1;
export const MOTE_ID = 'mote';

export const WINDOWS = ['hann', 'tri', 'plank', 'gauss'];
export const LFO_DEST = ['position', 'size', 'density', 'pitch', 'spray'];
export const SOURCES = ['glass', 'air', 'bell', 'file', 'mic', 'rack'];

const GRAIN_RANGE = {
  size: [5, 400],
  density: [0.5, 60],
  position: [0, 1],
  spray: [0, 1],
  pitch: [-24, 24],
  pitchRand: [0, 12],
  reverse: [0, 1],
  spread: [0, 1],
};
const LFO_RANGE = { rate: [0.02, 8], depth: [0, 1] };
const TAIL_RANGE = { delay: [0.02, 0.9], feedback: [0, 0.85], reverb: [0, 1], mix: [0, 1] };

export const MOTE_DEFAULT = {
  v: MOTE_SCHEMA,
  device: MOTE_ID,
  name: 'Drift Glass',
  cat: 'Texture',
  level: 0.8,
  source: 'glass',
  grain: {
    size: 140,
    density: 14,
    position: 0.28,
    spray: 0.16,
    pitch: 0,
    pitchRand: 0.35,
    reverse: 0.08,
    window: 'hann',
    spread: 0.55,
    freeze: true,
    keyboard: false,
  },
  lfo: { rate: 0.12, depth: 0.42, dest: 'position' },
  tail: { delay: 0.32, feedback: 0.38, reverb: 0.55, mix: 0.42 },
  // Present so a host mixer can read them. This page does not apply them.
  stereo: clone(F_DEFAULT.stereo),
  ens: clone(F_DEFAULT.ens),
  out: clone(F_DEFAULT.out),
  // Keeps the on-screen keyboard's slide path from assuming a tube voice.
  voice: { mode: 'poly' },
};

const CATS = ['Texture', 'Keys', 'Air'];

function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }

function pick(list, value, fallback) {
  return list.includes(value) ? value : fallback;
}

export function normalizeMote(p) {
  const out = clone(MOTE_DEFAULT);
  if (!p || typeof p !== 'object') return out;
  if (typeof p.name === 'string' && p.name.trim()) out.name = p.name.trim().slice(0, 40);
  if (CATS.includes(p.cat)) out.cat = p.cat;
  if (p.level != null && isFinite(+p.level)) out.level = clamp(+p.level, 0, 1);
  out.source = pick(SOURCES, p.source, out.source);
  const g = p.grain || {};
  Object.keys(GRAIN_RANGE).forEach(k => {
    if (g[k] == null || !isFinite(+g[k])) return;
    out.grain[k] = clamp(+g[k], GRAIN_RANGE[k][0], GRAIN_RANGE[k][1]);
  });
  out.grain.window = pick(WINDOWS, g.window, out.grain.window);
  if (g.freeze != null) out.grain.freeze = !!g.freeze;
  if (g.keyboard != null) out.grain.keyboard = !!g.keyboard;
  const lfo = p.lfo || {};
  Object.keys(LFO_RANGE).forEach(k => {
    if (lfo[k] == null || !isFinite(+lfo[k])) return;
    out.lfo[k] = clamp(+lfo[k], LFO_RANGE[k][0], LFO_RANGE[k][1]);
  });
  out.lfo.dest = pick(LFO_DEST, lfo.dest, out.lfo.dest);
  const tail = p.tail || {};
  Object.keys(TAIL_RANGE).forEach(k => {
    if (tail[k] == null || !isFinite(+tail[k])) return;
    out.tail[k] = clamp(+tail[k], TAIL_RANGE[k][0], TAIL_RANGE[k][1]);
  });
  return out;
}

function patch(name, cat, over) {
  const p = normalizeMote(Object.assign({ name, cat }, over || {}));
  p.name = name;
  p.cat = cat;
  return p;
}

export const MOTE_FACTORY = [
  patch('Drift Glass', 'Texture', {}),
  patch('Keyed Glass', 'Keys', {
    source: 'glass',
    level: 0.75,
    grain: {
      size: 90, density: 18, position: 0.22, spray: 0.04, pitch: 0, pitchRand: 0.05,
      reverse: 0, window: 'hann', spread: 0.35, freeze: true, keyboard: true,
    },
    lfo: { rate: 0.2, depth: 0.15, dest: 'position' },
    tail: { delay: 0.24, feedback: 0.28, reverb: 0.35, mix: 0.28 },
  }),
  patch('Air Bed', 'Air', {
    source: 'air',
    level: 0.7,
    grain: {
      size: 220, density: 9, position: 0.45, spray: 0.62, pitch: -5, pitchRand: 1.2,
      reverse: 0.35, window: 'gauss', spread: 0.8, freeze: true, keyboard: false,
    },
    lfo: { rate: 0.07, depth: 0.55, dest: 'spray' },
    tail: { delay: 0.48, feedback: 0.46, reverb: 0.7, mix: 0.55 },
  }),
];

export const MOTE_CATS = CATS;

const ENUMS = {
  source: SOURCES.slice(),
  'grain.window': WINDOWS.slice(),
  'lfo.dest': LFO_DEST.slice(),
};
const RANGE = {
  level: [0, 1],
  'grain.size': GRAIN_RANGE.size,
  'grain.density': GRAIN_RANGE.density,
  'grain.position': GRAIN_RANGE.position,
  'grain.spray': GRAIN_RANGE.spray,
  'grain.pitch': GRAIN_RANGE.pitch,
  'grain.pitchRand': GRAIN_RANGE.pitchRand,
  'grain.reverse': GRAIN_RANGE.reverse,
  'grain.spread': GRAIN_RANGE.spread,
  'lfo.rate': LFO_RANGE.rate,
  'lfo.depth': LFO_RANGE.depth,
  'tail.delay': TAIL_RANGE.delay,
  'tail.feedback': TAIL_RANGE.feedback,
  'tail.reverb': TAIL_RANGE.reverb,
  'tail.mix': TAIL_RANGE.mix,
};

export const MOTE_PARAMETERS = parameterTable(MOTE_DEFAULT, RANGE, ENUMS);

// Shipped sources. Generated for this project and dedicated CC0. See sources/README.md.
export const MOTE_FILES = [
  { id: 'glass', file: 'sources/glass.wav', label: 'Glass' },
  { id: 'air', file: 'sources/air.wav', label: 'Air' },
  { id: 'bell', file: 'sources/bell.wav', label: 'Bell' },
];

export const moteDevice = {
  id: MOTE_ID,
  name: 'Mote',
  vendor: 'DX Edge',
  version: String(MOTE_SCHEMA),
  api: RACK_API,
  description: 'Granular texture instrument',
  instrument: true,
  audioInputs: 0,
  audioOutputs: 1,
  midiInput: true,
  midiOutput: false,
  processor: 'mote',
  worklet: 'mote.worklet.js',
  channels: 2,
  oversample: 1,
  parameters: MOTE_PARAMETERS,
  normalize: normalizeMote,
  factory: MOTE_FACTORY,
  defaults: MOTE_DEFAULT,
  sources: MOTE_FILES.map(s => s.id),
  messages: ['patch', 'on', 'off', 'bend', 'mw', 'sus', 'panic', 'active', 'buffer'],
};

registerDevice(moteDevice);
