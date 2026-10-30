// Klystron patches. Schema v1, device 'klystron'.
//
// A klystron is a velocity-modulation tube: a buncher cavity shapes an electron
// beam and a catcher cavity speaks the result. Here the buncher is a mouth
// (a vowel, a microphone, or a recording) and the catcher is a carrier synth.
// The name is the tube's, not a product.

import { parameterTable, RACK_API, registerDevice } from './device.js';

export { RACK_API };
export const KLY_SCHEMA = 1;
export const KLY_ID = 'klystron';

export const SOURCES = ['vowel', 'file', 'mic'];
export const WAVES = ['saw', 'pulse', 'sine', 'noise'];
export const CATS = ['Voice', 'Cloud', 'Keys'];

// Corners of the mouth pad. x is front (high second formant), y is open
// (high first formant). The numbers are the usual published vowel centres,
// used as targets, not as copied tables from a synthesizer.
export const VOWELS = [
  { id: 'u', label: 'u', x: 0.08, y: 0.1 },
  { id: 'o', label: 'o', x: 0.16, y: 0.55 },
  { id: 'a', label: 'a', x: 0.34, y: 0.9 },
  { id: 'e', label: 'e', x: 0.7, y: 0.46 },
  { id: 'i', label: 'i', x: 0.94, y: 0.08 },
];

export function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }

export function formantsOf(x, y) {
  const fx = clamp(+x || 0, 0, 1);
  const fy = clamp(+y || 0, 0, 1);
  return {
    f1: 280 + fy * 500,
    f2: 700 + fx * 1700,
    f3: 2300 + fx * 700 + (1 - fy) * 120,
  };
}

export const KLY_DEFAULT = {
  v: KLY_SCHEMA,
  device: KLY_ID,
  name: 'Buncher Ah',
  cat: 'Voice',
  level: 0.85,
  source: 'vowel',
  carrier: { wave: 'saw', tune: 0, noise: 0.04, attack: 0.012, release: 0.08 },
  mouth: { x: 0.34, y: 0.9, whisper: 0.12, glottis: 120 },
  bank: { q: 3.1, attack: 0.008, release: 0.045, gate: 0.02 },
  grain: { size: 160, density: 14, spray: 0.22, mix: 0.22, spread: 0.55, freeze: false },
  voice: { mode: 'poly' },
};

const CARRIER_RANGE = { tune: [-24, 24], noise: [0, 1], attack: [0.001, 1.5], release: [0.005, 3] };
const MOUTH_RANGE = { x: [0, 1], y: [0, 1], whisper: [0, 1], glottis: [50, 240] };
const BANK_RANGE = { q: [0.6, 8], attack: [0.001, 0.2], release: [0.005, 0.5], gate: [0, 0.4] };
const GRAIN_RANGE = { size: [8, 500], density: [0.5, 48], spray: [0, 1], mix: [0, 1], spread: [0, 1] };

function pick(list, value, fallback) {
  return list.includes(value) ? value : fallback;
}

function takeRange(src, out, range) {
  Object.keys(range).forEach(k => {
    if (!src || src[k] == null || !isFinite(+src[k])) return;
    out[k] = clamp(+src[k], range[k][0], range[k][1]);
  });
}

export function normalizeKlystron(p) {
  const out = {
    v: KLY_SCHEMA,
    device: KLY_ID,
    name: KLY_DEFAULT.name,
    cat: KLY_DEFAULT.cat,
    level: KLY_DEFAULT.level,
    source: KLY_DEFAULT.source,
    carrier: Object.assign({}, KLY_DEFAULT.carrier),
    mouth: Object.assign({}, KLY_DEFAULT.mouth),
    bank: Object.assign({}, KLY_DEFAULT.bank),
    grain: Object.assign({}, KLY_DEFAULT.grain),
    voice: { mode: 'poly' },
  };
  if (!p || typeof p !== 'object') return out;
  if (typeof p.name === 'string' && p.name.trim()) out.name = p.name.trim().slice(0, 40);
  if (CATS.includes(p.cat)) out.cat = p.cat;
  if (p.level != null && isFinite(+p.level)) out.level = clamp(+p.level, 0, 1);
  out.source = pick(SOURCES, p.source, out.source);
  const c = p.carrier || {};
  takeRange(c, out.carrier, CARRIER_RANGE);
  out.carrier.wave = pick(WAVES, c.wave, out.carrier.wave);
  takeRange(p.mouth, out.mouth, MOUTH_RANGE);
  takeRange(p.bank, out.bank, BANK_RANGE);
  takeRange(p.grain, out.grain, GRAIN_RANGE);
  if (p.grain && p.grain.freeze != null) out.grain.freeze = !!p.grain.freeze;
  return out;
}

function patch(name, cat, over) {
  const p = normalizeKlystron(Object.assign({ name, cat }, over || {}));
  p.name = name;
  p.cat = cat;
  return p;
}

export const KLY_FACTORY = [
  patch('Buncher Ah', 'Voice', {}),
  patch('Close Front', 'Voice', {
    carrier: { wave: 'saw', tune: 0, noise: 0.02, attack: 0.01, release: 0.12 },
    mouth: { x: 0.94, y: 0.08, whisper: 0.06, glottis: 150 },
    grain: { size: 90, density: 10, spray: 0.08, mix: 0.08, spread: 0.3, freeze: false },
  }),
  patch('Back Cloud', 'Cloud', {
    carrier: { wave: 'pulse', tune: -12, noise: 0.18, attack: 0.04, release: 0.4 },
    mouth: { x: 0.08, y: 0.1, whisper: 0.45, glottis: 70 },
    bank: { q: 2.2, attack: 0.02, release: 0.12, gate: 0.01 },
    grain: { size: 280, density: 9, spray: 0.7, mix: 0.72, spread: 0.9, freeze: false },
  }),
  patch('Keyed Sine', 'Keys', {
    level: 0.8,
    carrier: { wave: 'sine', tune: 0, noise: 0, attack: 0.008, release: 0.06 },
    mouth: { x: 0.7, y: 0.46, whisper: 0.04, glottis: 130 },
    grain: { size: 40, density: 4, spray: 0, mix: 0, spread: 0.2, freeze: false },
  }),
  patch('Held Frost', 'Cloud', {
    carrier: { wave: 'saw', tune: 7, noise: 0.08, attack: 0.02, release: 0.2 },
    mouth: { x: 0.16, y: 0.55, whisper: 0.2, glottis: 96 },
    grain: { size: 220, density: 16, spray: 0.35, mix: 0.85, spread: 0.7, freeze: true },
  }),
];

export const KLY_CATS = CATS;

const ENUMS = {
  source: SOURCES.slice(),
  'carrier.wave': WAVES.slice(),
};
const RANGE = {
  level: [0, 1],
  'carrier.tune': CARRIER_RANGE.tune,
  'carrier.noise': CARRIER_RANGE.noise,
  'carrier.attack': CARRIER_RANGE.attack,
  'carrier.release': CARRIER_RANGE.release,
  'mouth.x': MOUTH_RANGE.x,
  'mouth.y': MOUTH_RANGE.y,
  'mouth.whisper': MOUTH_RANGE.whisper,
  'mouth.glottis': MOUTH_RANGE.glottis,
  'bank.q': BANK_RANGE.q,
  'bank.attack': BANK_RANGE.attack,
  'bank.release': BANK_RANGE.release,
  'bank.gate': BANK_RANGE.gate,
  'grain.size': GRAIN_RANGE.size,
  'grain.density': GRAIN_RANGE.density,
  'grain.spray': GRAIN_RANGE.spray,
  'grain.mix': GRAIN_RANGE.mix,
  'grain.spread': GRAIN_RANGE.spread,
};

// no whole-number parameters
export const KLY_PARAMETERS = parameterTable(KLY_DEFAULT, RANGE, ENUMS, []);

export const klystronDevice = {
  id: KLY_ID,
  name: 'Klystron',
  vendor: 'DX Edge',
  version: String(KLY_SCHEMA),
  api: RACK_API,
  description: 'Granular vocoder and talk box',
  instrument: true,
  audioInputs: 1,
  audioOutputs: 1,
  midiInput: true,
  midiOutput: false,
  processor: 'klystron',
  worklet: 'klystron.worklet.js',
  channels: 2,
  oversample: 1,
  parameters: KLY_PARAMETERS,
  normalize: normalizeKlystron,
  factory: KLY_FACTORY,
  defaults: KLY_DEFAULT,
  messages: ['patch', 'on', 'off', 'bend', 'mw', 'sus', 'panic', 'active', 'buffer'],
};

registerDevice(klystronDevice);
