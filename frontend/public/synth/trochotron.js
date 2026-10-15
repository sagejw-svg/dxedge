// Trochotron patches. Schema v1, device 'trochotron'.
//
// Trochotron is named for the beam-switching counter tube: an electron beam
// that walks a ring of targets. Here the walk is a fractal. A seed grows a
// piece; the same seed and the same settings grow it again.

import { parameterTable, RACK_API, registerDevice } from './device.js';
import { GENERATORS, SCALE_NAMES, ROUTES } from './trochotron-gen.js';

export { RACK_API };
export const TROCHO_SCHEMA = 1;
export const TROCHO_ID = 'trochotron';

export function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }

export const TROCHO_DEFAULT = {
  v: TROCHO_SCHEMA,
  device: TROCHO_ID,
  name: 'Amber Dust',
  cat: 'Fractal',
  level: 0.85,
  seed: 42,
  generator: 'mandelbrot',
  depth: 3,
  scale: 'dorian',
  key: 2,
  tempo: 108,
  density: 0.4,
  chaos: 0.35,
  voices: 3,
  timbre: 0.45,
  cx: -0.6,
  cy: 0,
  zoom: 1,
  jr: -0.8,
  ji: 0.156,
  route: 'internal',
};

export function normalizeTrochotron(p) {
  const out = Object.assign({}, TROCHO_DEFAULT);
  if (!p || typeof p !== 'object') return out;
  if (typeof p.name === 'string' && p.name.trim()) out.name = p.name.trim().slice(0, 40);
  if (p.cat === 'Fractal' || p.cat === 'Walk') out.cat = p.cat;
  if (p.level != null && isFinite(+p.level)) out.level = clamp(+p.level, 0, 1);
  if (p.seed != null && isFinite(+p.seed)) out.seed = Math.max(0, Math.floor(+p.seed)) >>> 0;
  if (GENERATORS.indexOf(p.generator) >= 0) out.generator = p.generator;
  if (p.depth != null && isFinite(+p.depth)) out.depth = clamp(+p.depth | 0, 1, 6);
  if (SCALE_NAMES.indexOf(p.scale) >= 0) out.scale = p.scale;
  if (p.key != null && isFinite(+p.key)) out.key = clamp(+p.key | 0, 0, 11);
  if (p.tempo != null && isFinite(+p.tempo)) out.tempo = clamp(+p.tempo, 40, 240);
  if (p.density != null && isFinite(+p.density)) out.density = clamp(+p.density, 0, 1);
  if (p.chaos != null && isFinite(+p.chaos)) out.chaos = clamp(+p.chaos, 0, 1);
  if (p.voices != null && isFinite(+p.voices)) out.voices = clamp(+p.voices | 0, 1, 3);
  if (p.timbre != null && isFinite(+p.timbre)) out.timbre = clamp(+p.timbre, 0, 1);
  if (p.cx != null && isFinite(+p.cx)) out.cx = clamp(+p.cx, -2, 2);
  if (p.cy != null && isFinite(+p.cy)) out.cy = clamp(+p.cy, -2, 2);
  if (p.zoom != null && isFinite(+p.zoom)) out.zoom = clamp(+p.zoom, 0.25, 64);
  if (p.jr != null && isFinite(+p.jr)) out.jr = clamp(+p.jr, -2, 2);
  if (p.ji != null && isFinite(+p.ji)) out.ji = clamp(+p.ji, -2, 2);
  if (ROUTES.indexOf(p.route) >= 0) out.route = p.route;
  return out;
}

export const TROCHO_FACTORY = [
  normalizeTrochotron({ name: 'Amber Dust', cat: 'Fractal', generator: 'mandelbrot', seed: 42, scale: 'dorian', key: 2, depth: 3, chaos: 0.35, cx: -0.6, zoom: 1.1 }),
  normalizeTrochotron({ name: 'Fern Rule', cat: 'Fractal', generator: 'lsystem', seed: 7, scale: 'major', key: 0, depth: 4, chaos: 0.2, tempo: 96 }),
  normalizeTrochotron({ name: 'Window Three', cat: 'Walk', generator: 'logistic', seed: 19, scale: 'minor', key: 9, depth: 3, chaos: 0.62, tempo: 120, density: 0.55 }),
  normalizeTrochotron({ name: 'Wing Curve', cat: 'Walk', generator: 'lorenz', seed: 3, scale: 'pentatonic', key: 7, depth: 3, chaos: 0.5, tempo: 84, voices: 3 }),
  normalizeTrochotron({ name: 'Parity Hymn', cat: 'Fractal', generator: 'thue', seed: 11, scale: 'dorian', key: 5, depth: 4, chaos: 0.15, tempo: 100 }),
  normalizeTrochotron({ name: 'Isle Constant', cat: 'Walk', generator: 'julia', seed: 28, scale: 'whole', key: 4, depth: 3, chaos: 0.4, jr: -0.7269, ji: 0.1889, zoom: 1.4 }),
];

export const TROCHO_CATS = ['Fractal', 'Walk'];

const ENUMS = {
  generator: GENERATORS.slice(),
  scale: SCALE_NAMES.slice(),
  route: ROUTES.slice(),
};

const RANGE = {
  level: [0, 1],
  seed: [0, 999999],
  depth: [1, 6],
  key: [0, 11],
  tempo: [40, 240],
  density: [0, 1],
  chaos: [0, 1],
  voices: [1, 3],
  timbre: [0, 1],
  cx: [-2, 2],
  cy: [-2, 2],
  zoom: [0.25, 64],
  jr: [-2, 2],
  ji: [-2, 2],
};

export const TROCHO_PARAMETERS = parameterTable(TROCHO_DEFAULT, RANGE, ENUMS);

export const trochotronDevice = {
  id: TROCHO_ID,
  name: 'Trochotron',
  vendor: 'DX Edge',
  version: String(TROCHO_SCHEMA),
  api: RACK_API,
  description: 'Fractal seed instrument',
  instrument: true,
  audioInputs: 0,
  audioOutputs: 1,
  midiInput: true,
  midiOutput: true,
  processor: 'trochotron',
  worklet: 'trochotron.worklet.js',
  channels: 2,
  oversample: 1,
  parameters: TROCHO_PARAMETERS,
  normalize: normalizeTrochotron,
  factory: TROCHO_FACTORY,
  defaults: TROCHO_DEFAULT,
  messages: ['patch', 'piece', 'play', 'stop', 'on', 'off', 'panic', 'active'],
};

registerDevice(trochotronDevice);
