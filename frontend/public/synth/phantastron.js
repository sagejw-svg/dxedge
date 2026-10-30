// Phantastron patches. Schema v1, device 'phantastron'.
//
// A phantastron is a vacuum-tube timebase: a pentode Miller sweep that holds
// a ramp until something pulls it off. Phantastron is that idea as a toy.
// A made-up speech table (vowels, chirps, a beep) runs on a clock you can
// drag a wire into. Clock, bits, a stuck loop, and feedback are the bends.
// Nothing here is a sample, and no speech-chip ROM was copied.

import { parameterTable, RACK_API, registerDevice } from './device.js';

export { RACK_API };
export const PHANTA_SCHEMA = 1;
export const PHANTA_ID = 'phantastron';

export const CARTS = ['lull', 'count', 'chirp', 'bark', 'tone', 'babble'];
export const CATS = ['Toy', 'Bend', 'Voice'];

export const PADS = [
  { id: 'vcc', kind: 'src', x: 0.12, y: 0.18, label: 'VCC' },
  { id: 'clk', kind: 'src', x: 0.37, y: 0.18, label: 'CLK' },
  { id: 'nse', kind: 'src', x: 0.63, y: 0.18, label: 'NSE' },
  { id: 'out', kind: 'src', x: 0.88, y: 0.18, label: 'OUT' },
  { id: 'rate', kind: 'dst', x: 0.20, y: 0.55, label: 'RATE' },
  { id: 'bits', kind: 'dst', x: 0.50, y: 0.55, label: 'BITS' },
  { id: 'loop', kind: 'dst', x: 0.80, y: 0.55, label: 'LOOP' },
  { id: 'fb', kind: 'dst', x: 0.20, y: 0.84, label: 'FB' },
  { id: 'pitch', kind: 'dst', x: 0.42, y: 0.84, label: 'PITCH' },
  { id: 'form', kind: 'dst', x: 0.64, y: 0.84, label: 'FORM' },
  { id: 'gnd', kind: 'src', x: 0.88, y: 0.84, label: 'GND' },
];

export const SOURCES = PADS.filter(p => p.kind === 'src').map(p => p.id);
export const DESTS = PADS.filter(p => p.kind === 'dst').map(p => p.id);

const CART_SEQ = {
  lull: [0, 0, 2, 1, 3, 2, 0, 4],
  count: [6, 0, 1, 2, 3, 4, 7, 2],
  chirp: [7, 5, 7, 3, 5, 7, 8],
  bark: [4, 5, 6, 5, 4, 5],
  tone: [6],
};

export function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }

function xorshift(seed) {
  let x = (seed >>> 0) || 1;
  return function next() {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5; x >>>= 0;
    return x / 4294967296;
  };
}

export function normalizeWires(list) {
  const out = [];
  const seen = new Set();
  (Array.isArray(list) ? list : []).forEach(w => {
    if (!w || w.length < 2) return;
    const src = String(w[0]);
    const dst = String(w[1]);
    if (SOURCES.indexOf(src) < 0 || DESTS.indexOf(dst) < 0) return;
    if (seen.has(dst)) return;
    seen.add(dst);
    out.push([src, dst]);
  });
  return out.slice(0, DESTS.length);
}

// One wire per destination. Dropping the same pair again lifts it.
export function toggleWire(wires, src, dst) {
  const cur = normalizeWires(wires);
  if (SOURCES.indexOf(src) < 0 || DESTS.indexOf(dst) < 0) return cur;
  const had = cur.some(w => w[0] === src && w[1] === dst);
  const rest = cur.filter(w => w[1] !== dst);
  if (!had) rest.push([src, dst]);
  return normalizeWires(rest);
}

export const PHANTA_DEFAULT = {
  v: PHANTA_SCHEMA,
  device: PHANTA_ID,
  name: 'Nursery Clock',
  cat: 'Toy',
  level: 0.85,
  cart: 'lull',
  seed: 17,
  clock: 1,
  bits: 8,
  loop: 0,
  feedback: 0.12,
  form: 0.4,
  noise: 0.15,
  pitch: 0,
  run: false,
  wires: [],
};

export function normalizePhantastron(p) {
  const out = Object.assign({}, PHANTA_DEFAULT, { wires: [] });
  if (!p || typeof p !== 'object') return out;
  if (typeof p.name === 'string' && p.name.trim()) out.name = p.name.trim().slice(0, 40);
  if (CATS.indexOf(p.cat) >= 0) out.cat = p.cat;
  if (p.level != null && isFinite(+p.level)) out.level = clamp(+p.level, 0, 1);
  if (CARTS.indexOf(p.cart) >= 0) out.cart = p.cart;
  if (p.seed != null && isFinite(+p.seed)) out.seed = Math.max(0, Math.floor(+p.seed)) >>> 0;
  if (p.clock != null && isFinite(+p.clock)) out.clock = clamp(+p.clock, 0.25, 4);
  if (p.bits != null && isFinite(+p.bits)) out.bits = clamp(Math.round(+p.bits), 1, 12);
  if (p.loop != null && isFinite(+p.loop)) out.loop = clamp(+p.loop, 0, 1);
  if (p.feedback != null && isFinite(+p.feedback)) out.feedback = clamp(+p.feedback, 0, 0.92);
  if (p.form != null && isFinite(+p.form)) out.form = clamp(+p.form, 0, 1);
  if (p.noise != null && isFinite(+p.noise)) out.noise = clamp(+p.noise, 0, 1);
  if (p.pitch != null && isFinite(+p.pitch)) out.pitch = clamp(+p.pitch, -24, 24);
  if (p.run != null) out.run = !!p.run;
  out.wires = normalizeWires(p.wires);
  return out;
}

export function phraseOf(patch) {
  const p = normalizePhantastron(patch);
  if (p.cart !== 'babble') return (CART_SEQ[p.cart] || CART_SEQ.lull).slice();
  const rnd = xorshift(p.seed || 1);
  const n = 6 + Math.floor(rnd() * 6);
  const out = [];
  for (let i = 0; i < n; i++) out.push(Math.floor(rnd() * 9));
  return out;
}

// signals: vcc, gnd, clk, nse, out in 0..1. Missing sources use a resting value.
export function bendRaw(p, signals) {
  const s = signals || {};
  const sig = {
    vcc: 1,
    gnd: 0,
    clk: s.clk == null ? 1 : clamp(+s.clk, 0, 1),
    nse: s.nse == null ? 0 : clamp(+s.nse, 0, 1),
    out: s.out == null ? 0 : clamp(+s.out, 0, 1),
  };
  let clock = p.clock;
  let bits = p.bits;
  let loop = p.loop;
  let feedback = p.feedback;
  let pitch = p.pitch;
  let form = p.form;
  (p.wires || []).forEach(w => {
    const src = w[0];
    const dst = w[1];
    const x = sig[src];
    if (dst === 'rate') {
      if (src === 'gnd') clock *= 0.22;
      else if (src === 'vcc') clock *= 3.2;
      else clock *= 0.35 + 2.4 * x;
    } else if (dst === 'bits') {
      // VCC and the moving sources pull the DAC down but stop at 3 bits: below that the
      // toy DAC rounds a speaking cart to silence (Market Bits and Solder Bridge went quiet).
      // A wire never adds bits the patch did not have. GND pins it at 2 on purpose.
      if (src === 'gnd') bits = 2;
      else if (src === 'vcc') bits = Math.min(bits, Math.max(3, bits - 6));
      else bits = Math.min(bits, Math.max(3, Math.round(bits - 5 * x)));
    } else if (dst === 'loop') {
      if (src === 'gnd') loop = 1;
      else if (src === 'vcc') loop = Math.max(loop, 0.92);
      else loop = Math.max(loop, x);
    } else if (dst === 'fb') {
      if (src === 'gnd') feedback = 0;
      else if (src === 'vcc') feedback = Math.max(feedback, 0.88);
      else feedback = Math.max(feedback, 0.25 + 0.65 * x);
    } else if (dst === 'pitch') {
      if (src === 'gnd') pitch -= 12;
      else if (src === 'vcc') pitch += 7;
      else pitch += (x - 0.5) * 14;
    } else if (dst === 'form') {
      if (src === 'gnd') form = 0.05;
      else if (src === 'vcc') form = Math.min(1, form + 0.55);
      else form = clamp(form * 0.4 + x * 0.8, 0, 1);
    }
  });
  return {
    clock: clamp(clock, 0.05, 6),
    bits: clamp(Math.round(bits), 1, 12),
    loop: clamp(loop, 0, 1),
    feedback: clamp(feedback, 0, 0.92),
    pitch: clamp(pitch, -36, 36),
    form: clamp(form, 0, 1),
  };
}

export function bendOf(patch, signals) {
  return bendRaw(normalizePhantastron(patch), signals);
}

export function loopWindow(loop, length) {
  const n = Math.max(1, length | 0);
  if (loop >= 0.85) return 1;
  if (loop >= 0.6) return Math.min(2, n);
  if (loop >= 0.35) return Math.min(4, n);
  return n;
}

export function walkFrames(patch, steps, signals) {
  const p = normalizePhantastron(patch);
  const bent = bendRaw(p, signals);
  const phrase = phraseOf(p);
  const win = loopWindow(bent.loop, phrase.length);
  const n = Math.max(0, steps | 0);
  const frames = [];
  for (let i = 0; i < n; i++) {
    const at = bent.loop >= 0.35 ? (i % win) : (i % phrase.length);
    frames.push(phrase[at]);
  }
  return {
    frames,
    win,
    phrase: phrase.slice(),
    loop: bent.loop,
    clock: bent.clock,
    bits: bent.bits,
    feedback: bent.feedback,
    pitch: bent.pitch,
    form: bent.form,
  };
}

// Toy DAC. `bits` is the width; the result sits on those steps.
export function crush(x, bits) {
  const b = clamp(Math.round(+bits || 1), 1, 12);
  const steps = Math.pow(2, b);
  const y = clamp(+x || 0, -1, 1);
  const half = steps / 2;
  return Math.round(y * half) / half;
}

function factory(name, cat, over) {
  const p = normalizePhantastron(Object.assign({ name, cat }, over || {}));
  p.name = name;
  p.cat = cat;
  return p;
}

export const PHANTA_FACTORY = [
  factory('Nursery Clock', 'Toy', { cart: 'lull', seed: 17, clock: 0.9, bits: 8, feedback: 0.08, form: 0.42 }),
  factory('Solder Bridge', 'Bend', {
    cart: 'babble', seed: 41, clock: 1.15, bits: 6, loop: 0.2, feedback: 0.28, noise: 0.35,
    wires: [['clk', 'rate'], ['vcc', 'bits']],
  }),
  factory('Grounded Syllable', 'Bend', {
    cart: 'count', seed: 9, clock: 1, bits: 7, form: 0.55,
    wires: [['gnd', 'loop']],
  }),
  factory('Howl Cart', 'Voice', {
    cart: 'chirp', seed: 23, clock: 1.3, bits: 7, feedback: 0.35, noise: 0.45,
    wires: [['out', 'fb']],
  }),
  factory('Market Bits', 'Toy', {
    cart: 'bark', seed: 5, clock: 0.8, bits: 5, noise: 0.55, form: 0.25,
    wires: [['vcc', 'bits']],
  }),
  factory('Slow Drag', 'Voice', {
    cart: 'tone', seed: 2, clock: 0.7, bits: 9, feedback: 0.05, noise: 0.02, form: 0.3,
    wires: [['gnd', 'rate']],
  }),
];

export const PHANTA_CATS = CATS.slice();

const ENUMS = { cart: CARTS.slice() };
const RANGE = {
  level: [0, 1],
  seed: [0, 999999],
  clock: [0.25, 4],
  bits: [1, 12],
  loop: [0, 1],
  feedback: [0, 0.92],
  form: [0, 1],
  noise: [0, 1],
  pitch: [-24, 24],
};

// whole numbers: the seed and the bit depth (the normalizer floors and rounds them); loop is 0..1
export const PHANTA_PARAMETERS = parameterTable(PHANTA_DEFAULT, RANGE, ENUMS, ['seed', 'bits']);

export const phantastronDevice = {
  id: PHANTA_ID,
  name: 'Phantastron',
  vendor: 'DX Edge',
  version: String(PHANTA_SCHEMA),
  api: RACK_API,
  description: 'Circuit-bent toy voice',
  instrument: true,
  audioInputs: 0,
  audioOutputs: 1,
  midiInput: true,
  midiOutput: false,
  processor: 'phantastron',
  worklet: 'phantastron.worklet.js',
  channels: 2,
  oversample: 1,
  parameters: PHANTA_PARAMETERS,
  normalize: normalizePhantastron,
  factory: PHANTA_FACTORY,
  defaults: PHANTA_DEFAULT,
  messages: ['patch', 'on', 'off', 'bend', 'mw', 'sus', 'panic', 'active'],
};

registerDevice(phantastronDevice);
