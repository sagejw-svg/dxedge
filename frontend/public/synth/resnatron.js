// Resnatron patches. Schema v1, device 'resnatron'.
//
// A resnatron is a cavity tetrode: the anode and the grids are resonant cavities
// built into the envelope. Here each cavity is a module, and the beam between
// them is a cable you drag. Oscillators, a filter, a VCA, an envelope, an LFO,
// sample and hold, noise, a delay and a mixer. Nothing is pre-wired: a starter
// patch is just a saved set of cables.
//
// Original. Copyleft modular instruments were looked at only as a reminder of
// what a patch bay is. No code from them is in this file.

import { parameterTable, RACK_API, registerDevice } from './device.js';

export { RACK_API };
export const RN_SCHEMA = 1;
export const RN_ID = 'resnatron';

export function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }

const choice = (choices, def) => ({ type: 'choice', choices, default: def });
const num = (min, max, def, type) => ({ type: type || 'float', min, max, default: def });
const flag = def => ({ type: 'bool', default: def });

// Fixed cavities. The ids are the patch and the cable names.
export const RN_SPEC = {
  keys: { name: 'Keys', params: {}, outs: ['gate', 'vel', 'cv'], ins: [] },
  wheel: { name: 'Wheel', params: {}, outs: ['out'], ins: [] },
  vco1: {
    name: 'VCO 1',
    params: {
      wave: choice(['sine', 'tri', 'saw', 'square'], 'saw'),
      oct: num(-2, 2, 0, 'int'),
      fine: num(-12, 12, 0),
      pw: num(0.05, 0.95, 0.5),
      fm: num(0, 4, 0),
      kbd: flag(true),
    },
    outs: ['out'], ins: ['fm', 'pwm', 'sync'],
  },
  vco2: {
    name: 'VCO 2',
    params: {
      wave: choice(['sine', 'tri', 'saw', 'square'], 'sine'),
      oct: num(-2, 2, -1, 'int'),
      fine: num(-12, 12, 0),
      pw: num(0.05, 0.95, 0.5),
      fm: num(0, 4, 0),
      kbd: flag(true),
    },
    outs: ['out'], ins: ['fm', 'pwm', 'sync'],
  },
  noise: { name: 'Noise', params: { color: choice(['white', 'pink'], 'white') }, outs: ['out'], ins: [] },
  lfo: {
    name: 'LFO',
    params: {
      wave: choice(['sine', 'tri', 'saw', 'square'], 'sine'),
      rate: num(0.05, 30, 2),
    },
    outs: ['out'], ins: ['rate'],
  },
  sh: {
    name: 'S&H',
    params: { rate: num(0.1, 20, 4), glide: num(0, 0.5, 0) },
    outs: ['out'], ins: ['in', 'clk'],
  },
  env: {
    name: 'Envelope',
    params: {
      a: num(0.001, 4, 0.01),
      d: num(0.001, 4, 0.2),
      s: num(0, 1, 0.6),
      r: num(0.001, 4, 0.4),
      kbd: flag(true),
    },
    outs: ['out'], ins: ['gate'],
  },
  mix: {
    name: 'Mixer',
    params: { a: num(0, 1, 1), b: num(0, 1, 1), c: num(0, 1, 0) },
    outs: ['out'], ins: ['a', 'b', 'c'],
  },
  vcf: {
    name: 'Filter',
    params: {
      mode: choice(['lp', 'bp', 'hp'], 'lp'),
      cutoff: num(40, 12000, 1200),
      res: num(0, 0.95, 0.2),
      depth: num(0, 1, 0.5),
    },
    outs: ['out'], ins: ['in', 'cv'],
  },
  vca: { name: 'VCA', params: { level: num(0, 1, 0) }, outs: ['out'], ins: ['in', 'cv'] },
  delay: {
    name: 'Delay',
    params: { time: num(0.02, 0.9, 0.28), fb: num(0, 0.9, 0.35), mix: num(0, 1, 0) },
    outs: ['out'], ins: ['in'],
  },
  out: { name: 'Out', params: { level: num(0, 1, 0.85), pan: num(-1, 1, 0) }, outs: [], ins: ['in', 'inR'] },
};

export const RN_ORDER = Object.keys(RN_SPEC);

const OUTS = new Set();
const INS = new Set();
RN_ORDER.forEach(id => {
  RN_SPEC[id].outs.forEach(p => OUTS.add(id + '.' + p));
  RN_SPEC[id].ins.forEach(p => INS.add(id + '.' + p));
});

export function isOutput(port) { return OUTS.has(port); }
export function isInput(port) { return INS.has(port); }

export function normalizeCables(list) {
  const byDest = new Map();
  const src = Array.isArray(list) ? list : [];
  src.forEach(c => {
    if (!c) return;
    const from = typeof c.from === 'string' ? c.from : (Array.isArray(c) ? String(c[0] || '') : '');
    const to = typeof c.to === 'string' ? c.to : (Array.isArray(c) ? String(c[1] || '') : '');
    if (!OUTS.has(from) || !INS.has(to)) return;
    byDest.set(to, from);
  });
  const cables = [];
  [...byDest.keys()].sort().forEach(to => cables.push({ from: byDest.get(to), to }));
  return cables.slice(0, 32);
}

export const RN_CATS = ['East', 'Drift', 'West'];

export function normalizeResnatron(p) {
  const src = p && typeof p === 'object' ? p : {};
  const out = {
    v: RN_SCHEMA,
    device: RN_ID,
    name: 'Open Bay',
    cat: 'East',
    level: 0.85,
  };
  if (typeof src.name === 'string' && src.name.trim()) out.name = src.name.trim().slice(0, 40);
  if (RN_CATS.indexOf(src.cat) >= 0) out.cat = src.cat;
  if (src.level != null && isFinite(+src.level)) out.level = clamp(+src.level, 0, 1);
  RN_ORDER.forEach(id => {
    const spec = RN_SPEC[id];
    const keys = Object.keys(spec.params);
    if (!keys.length) return;
    const raw = src[id] && typeof src[id] === 'object' ? src[id] : {};
    const block = {};
    keys.forEach(k => {
      const meta = spec.params[k];
      const v = raw[k];
      if (meta.type === 'choice') block[k] = meta.choices.indexOf(v) >= 0 ? v : meta.default;
      else if (meta.type === 'bool') block[k] = v == null ? meta.default : !!v;
      else if (meta.type === 'int') block[k] = v == null || !isFinite(+v) ? meta.default : clamp(Math.round(+v), meta.min, meta.max);
      else block[k] = v == null || !isFinite(+v) ? meta.default : clamp(+v, meta.min, meta.max);
    });
    out[id] = block;
  });
  out.cables = normalizeCables(src.cables);
  return out;
}

export const RN_DEFAULT = normalizeResnatron({});

function starter(partial) { return normalizeResnatron(partial); }

export const RN_FACTORY = [
  starter({
    name: 'Cavity Saw', cat: 'East',
    vco1: { wave: 'saw', oct: 0, kbd: true },
    vcf: { mode: 'lp', cutoff: 420, res: 0.28, depth: 0.62 },
    env: { a: 0.008, d: 0.22, s: 0.58, r: 0.35, kbd: true },
    vca: { level: 0 },
    out: { level: 0.85, pan: 0 },
    cables: [
      { from: 'vco1.out', to: 'vcf.in' },
      { from: 'env.out', to: 'vcf.cv' },
      { from: 'vcf.out', to: 'vca.in' },
      { from: 'env.out', to: 'vca.cv' },
      { from: 'vca.out', to: 'out.in' },
    ],
  }),
  starter({
    name: 'Bunch Glass', cat: 'Drift',
    vco1: { wave: 'sine', oct: 0, fm: 1.4, kbd: true },
    vco2: { wave: 'sine', oct: -1, kbd: true },
    lfo: { wave: 'sine', rate: 3 },
    sh: { rate: 5, glide: 0.02 },
    noise: { color: 'white' },
    vcf: { mode: 'lp', cutoff: 1400, res: 0.22, depth: 0.75 },
    env: { a: 0.01, d: 0.3, s: 0.45, r: 0.5, kbd: true },
    vca: { level: 0 },
    delay: { time: 0.22, fb: 0.42, mix: 0.32 },
    out: { level: 0.8, pan: 0 },
    cables: [
      { from: 'vco2.out', to: 'vco1.fm' },
      { from: 'noise.out', to: 'sh.in' },
      { from: 'lfo.out', to: 'sh.clk' },
      { from: 'sh.out', to: 'vcf.cv' },
      { from: 'vco1.out', to: 'vcf.in' },
      { from: 'env.out', to: 'vca.cv' },
      { from: 'vcf.out', to: 'vca.in' },
      { from: 'vca.out', to: 'delay.in' },
      { from: 'delay.out', to: 'out.in' },
    ],
  }),
  starter({
    name: 'Reed Drift', cat: 'West',
    vco1: { wave: 'tri', oct: 0, kbd: true },
    lfo: { wave: 'tri', rate: 0.25 },
    vcf: { mode: 'bp', cutoff: 880, res: 0.55, depth: 0.8 },
    env: { a: 0.004, d: 0.16, s: 0.15, r: 0.45, kbd: true },
    vca: { level: 0 },
    delay: { time: 0.36, fb: 0.48, mix: 0.4 },
    out: { level: 0.8, pan: 0.15 },
    cables: [
      { from: 'lfo.out', to: 'vcf.cv' },
      { from: 'vco1.out', to: 'vcf.in' },
      { from: 'env.out', to: 'vca.cv' },
      { from: 'vcf.out', to: 'vca.in' },
      { from: 'vca.out', to: 'delay.in' },
      { from: 'delay.out', to: 'out.in' },
    ],
  }),
  starter({
    name: 'Twin Cavity', cat: 'East',
    vco1: { wave: 'saw', oct: 0, fine: -0.12, kbd: true },
    vco2: { wave: 'saw', oct: 0, fine: 0.12, kbd: true },
    mix: { a: 0.65, b: 0.65, c: 0 },
    vcf: { mode: 'lp', cutoff: 900, res: 0.18, depth: 0.45 },
    env: { a: 0.02, d: 0.35, s: 0.7, r: 0.4, kbd: true },
    vca: { level: 0 },
    cables: [
      { from: 'vco1.out', to: 'mix.a' },
      { from: 'vco2.out', to: 'mix.b' },
      { from: 'mix.out', to: 'vcf.in' },
      { from: 'env.out', to: 'vcf.cv' },
      { from: 'vcf.out', to: 'vca.in' },
      { from: 'env.out', to: 'vca.cv' },
      { from: 'vca.out', to: 'out.in' },
    ],
  }),
];

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function shareOf(p) {
  const bytes = new TextEncoder().encode(JSON.stringify(normalizeResnatron(p)));
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = ((bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0)) >>> 0;
    out += ALPHA[(n >>> 18) & 63] + ALPHA[(n >>> 12) & 63];
    if (i + 1 < bytes.length) out += ALPHA[(n >>> 6) & 63];
    if (i + 2 < bytes.length) out += ALPHA[n & 63];
  }
  return out;
}

export function parseShare(text) {
  if (!text || typeof text !== 'string') return null;
  const s = text.trim();
  if (!s || /[^A-Za-z0-9\-_]/.test(s)) return null;
  const bytes = [];
  for (let i = 0; i < s.length; ) {
    const c0 = ALPHA.indexOf(s[i]);
    const c1 = i + 1 < s.length ? ALPHA.indexOf(s[i + 1]) : -1;
    if (c0 < 0 || c1 < 0) return null;
    const c2 = i + 2 < s.length ? ALPHA.indexOf(s[i + 2]) : -2;
    const c3 = i + 3 < s.length ? ALPHA.indexOf(s[i + 3]) : -2;
    if (c2 === -1 || c3 === -1) return null;
    const n = (c0 << 18) | (c1 << 12) | ((c2 < 0 ? 0 : c2) << 6) | (c3 < 0 ? 0 : c3);
    bytes.push((n >>> 16) & 255);
    if (c2 >= 0) bytes.push((n >>> 8) & 255);
    if (c3 >= 0) bytes.push(n & 255);
    i += 2 + (c2 >= 0 ? 1 : 0) + (c3 >= 0 ? 1 : 0);
  }
  try {
    const raw = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes)));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    return normalizeResnatron(raw);
  } catch (e) { return null; }
}

const ENUMS = {};
const RANGE = { level: [0, 1] };
RN_ORDER.forEach(id => {
  Object.keys(RN_SPEC[id].params).forEach(k => {
    const meta = RN_SPEC[id].params[k];
    const path = id + '.' + k;
    if (meta.type === 'choice') ENUMS[path] = meta.choices.slice();
    else if (meta.type !== 'bool') RANGE[path] = [meta.min, meta.max];
  });
});

export const RN_PARAMETERS = parameterTable(RN_DEFAULT, RANGE, ENUMS);

export const resnatronDevice = {
  id: RN_ID,
  name: 'Resnatron',
  vendor: 'DX Edge',
  version: String(RN_SCHEMA),
  api: RACK_API,
  description: 'Modular patch bay',
  instrument: true,
  audioInputs: 0,
  audioOutputs: 1,
  midiInput: true,
  midiOutput: false,
  processor: 'resnatron',
  worklet: 'resnatron.worklet.js',
  channels: 2,
  oversample: 1,
  parameters: RN_PARAMETERS,
  normalize: normalizeResnatron,
  factory: RN_FACTORY,
  defaults: RN_DEFAULT,
  messages: ['patch', 'on', 'off', 'bend', 'mw', 'sus', 'panic', 'active'],
};

registerDevice(resnatronDevice);
