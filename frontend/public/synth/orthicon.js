// Orthicon patches. Schema v1, device 'orthicon'.
//
// Orthicon is a spectral painter in the Filament rack. An image orthicon was
// a camera tube that scanned a picture into an electrical signal. Here the
// picture is a log-frequency spectrogram: paint it, drop an image, or analyse
// a sound, and a playhead scans it back into audio.
// The page leaves the shared output tubes alone. ens and out are carried so a
// host that expects them still finds the fields.

import { DEFAULT as F_DEFAULT, clone } from './patches.js';
import { parameterTable, RACK_API, registerDevice } from './device.js';

export { RACK_API };
export const ORTH_SCHEMA = 1;
export const ORTH_ID = 'orthicon';

export const PICTURES = ['ridge', 'lantern', 'veil', 'glyph', 'drone', 'custom'];
export const PHASES = ['coherent', 'random'];
export const ENGINES = ['add', 'ifft'];
export const SCALES = ['off', 'major', 'minor', 'pentatonic', 'whole', 'chromatic'];
export const BRUSHES = ['soft', 'hard', 'harmonic', 'noise', 'erase'];

const RANGE = {
  level: [0, 1],
  speed: [0.25, 48],
  scan: [0, 1],
  fLo: [40, 800],
  fHi: [400, 16000],
  curve: [0.3, 3],
  width: [0, 1],
  brushSize: [0.5, 8],
  root: [36, 84],
};

export const ORTH_DEFAULT = {
  v: ORTH_SCHEMA,
  device: ORTH_ID,
  name: 'Ember Ridge',
  cat: 'Scan',
  level: 0.75,
  picture: 'ridge',
  speed: 6,
  loop: true,
  hold: false,
  scan: 0.2,
  fLo: 80,
  fHi: 8000,
  curve: 1,
  phase: 'coherent',
  engine: 'add',
  keyboard: false,
  width: 0.22,
  scale: 'off',
  root: 60,
  brush: 'soft',
  brushSize: 1.8,
  stereo: clone(F_DEFAULT.stereo),
  ens: clone(F_DEFAULT.ens),
  out: clone(F_DEFAULT.out),
  voice: { mode: 'poly' },
};

const CATS = ['Scan', 'Drone', 'Keys', 'Noise'];

function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
function pick(list, value, fallback) { return list.includes(value) ? value : fallback; }

export function normalizeOrthicon(p) {
  const out = clone(ORTH_DEFAULT);
  if (!p || typeof p !== 'object') return out;
  if (typeof p.name === 'string' && p.name.trim()) out.name = p.name.trim().slice(0, 40);
  if (CATS.includes(p.cat)) out.cat = p.cat;
  Object.keys(RANGE).forEach(k => {
    if (p[k] == null || !isFinite(+p[k])) return;
    out[k] = clamp(+p[k], RANGE[k][0], RANGE[k][1]);
  });
  out.root = Math.round(out.root);
  out.picture = pick(PICTURES, p.picture, out.picture);
  out.phase = pick(PHASES, p.phase, out.phase);
  out.engine = pick(ENGINES, p.engine, out.engine);
  out.scale = pick(SCALES, p.scale, out.scale);
  out.brush = pick(BRUSHES, p.brush, out.brush);
  if (p.loop != null) out.loop = !!p.loop;
  if (p.hold != null) out.hold = !!p.hold;
  if (p.keyboard != null) out.keyboard = !!p.keyboard;
  if (out.fHi < out.fLo * 2) out.fHi = Math.min(RANGE.fHi[1], out.fLo * 2);
  return out;
}

function patch(name, cat, over) {
  const p = normalizeOrthicon(Object.assign({ name, cat }, over || {}));
  p.name = name;
  p.cat = cat;
  return p;
}

export const ORTH_FACTORY = [
  patch('Ember Ridge', 'Scan', {}),
  patch('Lantern Stack', 'Scan', {
    picture: 'lantern',
    level: 0.72,
    speed: 3.5,
    phase: 'coherent',
    engine: 'add',
    curve: 0.85,
    width: 0.3,
  }),
  patch('Veil', 'Noise', {
    picture: 'veil',
    level: 0.62,
    speed: 5,
    phase: 'random',
    engine: 'ifft',
    curve: 1.15,
    width: 0.45,
    fLo: 100,
    fHi: 9000,
  }),
  patch('Glyph Keys', 'Keys', {
    picture: 'glyph',
    level: 0.8,
    speed: 2.5,
    keyboard: true,
    phase: 'coherent',
    engine: 'add',
    width: 0.18,
    curve: 1,
  }),
  patch('Fifth Drone', 'Drone', {
    picture: 'drone',
    level: 0.7,
    hold: true,
    scan: 0.4,
    speed: 1,
    phase: 'coherent',
    engine: 'add',
    width: 0.12,
    curve: 0.9,
  }),
];

export const ORTH_CATS = CATS;

const ENUMS = {
  picture: PICTURES.slice(),
  phase: PHASES.slice(),
  engine: ENGINES.slice(),
  scale: SCALES.slice(),
  brush: BRUSHES.slice(),
};

// whole numbers: the root note (normalizeOrthicon rounds it), the EQ's bands
export const ORTH_PARAMETERS = parameterTable(ORTH_DEFAULT, RANGE, ENUMS, ['root', 'out.eqBands']);

export const orthiconDevice = {
  id: ORTH_ID,
  name: 'Orthicon',
  vendor: 'DX Edge',
  version: String(ORTH_SCHEMA),
  api: RACK_API,
  description: 'Spectral painter: a scanned picture resynthesized as sound',
  instrument: true,
  audioInputs: 0,
  audioOutputs: 1,
  midiInput: true,
  midiOutput: false,
  processor: 'orthicon',
  worklet: 'orthicon.worklet.js',
  channels: 2,
  oversample: 1,
  parameters: ORTH_PARAMETERS,
  normalize: normalizeOrthicon,
  factory: ORTH_FACTORY,
  defaults: ORTH_DEFAULT,
  messages: ['patch', 'on', 'off', 'bend', 'mw', 'sus', 'panic', 'active', 'grid'],
};

registerDevice(orthiconDevice);
