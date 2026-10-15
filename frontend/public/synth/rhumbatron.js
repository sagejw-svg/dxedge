// Rhumbatron patches. Schema v1, device 'rhumbatron'.
//
// A rhumbatron is a resonant cavity, the tuned chamber William Hansen named
// in the 1930s for the drift tube that became the klystron. Here the cavity
// is something you can touch: a string, a bore, or a plate. Pluck it, strike
// it, bow it, or blow it. The same idea as a waveguide or a modal bank,
// written for this rack. Nothing here is copied from a library.

import { parameterTable, RACK_API, registerDevice } from './device.js';

export { RACK_API };
export const RHUM_SCHEMA = 1;
export const RHUM_ID = 'rhumbatron';

export const BODIES = ['string', 'tube', 'membrane'];
export const EXCITERS = ['pluck', 'strike', 'bow', 'blow'];
export const RHUM_CATS = ['Wire', 'Bow', 'Bore', 'Plate'];

// A slightly rectangular plate, so the (m, n) modes do not land on each other.
// (1, 1) is the fundamental. (2, 2) falls exactly an octave above it.
export const PLATE_ASPECT = 1.17;
export function plateRatio(m, n) {
  const a = PLATE_ASPECT;
  return Math.sqrt(m * m + (n * a) * (n * a)) / Math.sqrt(1 + a * a);
}

const RANGE = {
  level: [0, 1],
  material: [0, 1],
  size: [0.5, 2],
  damping: [0, 1],
  position: [0.02, 0.98],
  place: [0.02, 0.98],
  coupling: [0, 1],
  pressure: [0, 1],
};

export const RHUM_DEFAULT = {
  v: RHUM_SCHEMA,
  device: RHUM_ID,
  name: 'Copper Wire',
  cat: 'Wire',
  level: 0.8,
  body: 'string',
  exciter: 'pluck',
  material: 0.72,
  size: 1,
  damping: 0.28,
  position: 0.18,
  place: 0.5,
  coupling: 0.22,
  pressure: 0.35,
};

function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
function pick(list, value, fallback) { return list.includes(value) ? value : fallback; }

export function normalizeRhumbatron(p) {
  const out = Object.assign({}, RHUM_DEFAULT);
  if (!p || typeof p !== 'object') return out;
  if (typeof p.name === 'string' && p.name.trim()) out.name = p.name.trim().slice(0, 40);
  if (RHUM_CATS.includes(p.cat)) out.cat = p.cat;
  Object.keys(RANGE).forEach(k => {
    if (p[k] == null || !isFinite(+p[k])) return;
    out[k] = clamp(+p[k], RANGE[k][0], RANGE[k][1]);
  });
  out.body = pick(BODIES, p.body, out.body);
  out.exciter = pick(EXCITERS, p.exciter, out.exciter);
  return out;
}

function patch(name, cat, over) {
  const p = normalizeRhumbatron(Object.assign({ name, cat }, over || {}));
  p.name = name;
  p.cat = cat;
  return p;
}

export const RHUM_FACTORY = [
  patch('Copper Wire', 'Wire', { body: 'string', exciter: 'pluck', material: 0.72, position: 0.18, damping: 0.28, coupling: 0.22 }),
  patch('Bridge Nail', 'Wire', { body: 'string', exciter: 'strike', material: 0.92, position: 0.09, damping: 0.18, pressure: 0.7, coupling: 0.15 }),
  patch('Horsehair', 'Bow', { body: 'string', exciter: 'bow', material: 0.48, position: 0.16, damping: 0.22, pressure: 0.55, coupling: 0.4, level: 0.75 }),
  patch('Chimney Bore', 'Bore', { body: 'tube', exciter: 'blow', material: 0.4, position: 0.22, damping: 0.2, pressure: 0.45, coupling: 0.3, size: 1.15 }),
  patch('Stopped Pipe', 'Bore', { body: 'tube', exciter: 'pluck', material: 0.66, position: 0.3, damping: 0.34, coupling: 0.18 }),
  patch('Drumhead', 'Plate', { body: 'membrane', exciter: 'strike', material: 0.35, position: 0.42, place: 0.38, damping: 0.4, coupling: 0.28, pressure: 0.6 }),
  patch('Plate Bell', 'Plate', { body: 'membrane', exciter: 'strike', material: 0.88, position: 0.27, place: 0.63, damping: 0.12, coupling: 0.12, pressure: 0.4, level: 0.7 }),
];

const ENUMS = {
  body: BODIES.slice(),
  exciter: EXCITERS.slice(),
};

export const RHUM_PARAMETERS = parameterTable(RHUM_DEFAULT, RANGE, ENUMS);

export const rhumbatronDevice = {
  id: RHUM_ID,
  name: 'Rhumbatron',
  vendor: 'DX Edge',
  version: String(RHUM_SCHEMA),
  api: RACK_API,
  description: 'Physical model: strings, bores and plates you can strike',
  instrument: true,
  audioInputs: 0,
  audioOutputs: 1,
  midiInput: true,
  midiOutput: false,
  processor: 'rhumbatron',
  worklet: 'rhumbatron.worklet.js',
  channels: 2,
  oversample: 1,
  parameters: RHUM_PARAMETERS,
  normalize: normalizeRhumbatron,
  factory: RHUM_FACTORY,
  defaults: RHUM_DEFAULT,
  messages: ['patch', 'on', 'off', 'bend', 'mw', 'sus', 'panic', 'active'],
};

registerDevice(rhumbatronDevice);
