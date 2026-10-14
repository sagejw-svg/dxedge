// Lattice voice engine. Original wavetable synthesis.
//
// Two oscillators read mipmapped single-cycle tables so partials that would
// alias are left out before the read. The voice then runs at twice the output
// rate and a half-band decimator folds it back down, which keeps the filters
// (a public trapezoidal state-variable design) honest near the top of the band.
// Warp, unison, the sub, noise, envelopes, drawable LFOs and the mod matrix
// are written here from that description. Nothing is taken from Vital, Surge,
// or any other instrument's source. The factory tables are additive waveforms
// we generate in this file, not a sample library.

export const CYCLE = 256;
export const FRAMES = 16;
export const MIPS = 7;
export const MAX_H = 128;
export const MAX_UNI = 4;
export const VOICE_N = 8;
export const LFO_N = 32;
export const SLOTS = 8;
export const TABLE_IDS = ['glass', 'reed', 'brass', 'vowel', 'edge', 'hollow', 'user'];
export const WARP_IDS = ['off', 'bend', 'sync', 'pwm', 'fm'];
export const MODE_IDS = ['lp', 'hp', 'bp', 'notch'];
export const ROUTE_IDS = ['serial', 'parallel'];
export const SRC_IDS = ['lfo1', 'lfo2', 'lfo3', 'lfo4', 'envA', 'envF', 'envM', 'vel', 'wheel', 'm1', 'm2', 'm3', 'm4'];
export const DEST_IDS = ['osc1.pos', 'osc2.pos', 'osc1.warp', 'osc2.warp', 'cutA', 'cutB', 'amp', 'noise', 'sub', 'detune'];

const SRC = Object.create(null);
SRC_IDS.forEach((id, i) => { SRC[id] = i; });
const DEST = Object.create(null);
DEST_IDS.forEach((id, i) => { DEST[id] = i; });

const TAU = Math.PI * 2;

function clamp(n, a, b) { return n < a ? a : n > b ? b : n; }
function num(v, d) { const n = +v; return Number.isFinite(n) ? n : d; }

export function lfoShape(kind) {
  const y = new Array(LFO_N);
  for (let i = 0; i < LFO_N; i++) {
    const p = i / LFO_N;
    if (kind === 'tri') {
      const x = p < 0.5 ? p * 2 : 2 - p * 2;
      y[i] = x * 2 - 1;
    } else if (kind === 'saw') y[i] = 2 * p - 1;
    else if (kind === 'square') y[i] = p < 0.5 ? 1 : -1;
    else y[i] = Math.sin(TAU * p);
  }
  return y;
}

const SHAPE_KINDS = ['sine', 'tri', 'saw', 'square'];

function copyShape(src, fallback) {
  const y = new Array(LFO_N);
  const list = src && typeof src.length === 'number' ? src : null;
  for (let i = 0; i < LFO_N; i++) {
    const v = list ? num(list[i], fallback[i]) : fallback[i];
    y[i] = clamp(v, -1, 1);
  }
  return y;
}

export function defaultLattice() {
  return {
    v: 1, device: 'lattice', name: 'Init', cat: 'Pad',
    level: 0.5, bandlimit: true,
    osc1: { table: 'glass', pos: 0.15, oct: 0, semi: 0, fine: 0, level: 0.62, warp: 'off', warpAmt: 0 },
    osc2: { table: 'glass', pos: 0.4, oct: 0, semi: 0, fine: 6, level: 0.22, warp: 'off', warpAmt: 0 },
    unison: { count: 1, detune: 10, spread: 0.35 },
    sub: { level: 0 },
    noise: { level: 0, color: 0.55 },
    filt: {
      route: 'serial',
      a: { mode: 'lp', cutoff: 2400, res: 0.12, env: 0.35 },
      b: { mode: 'lp', cutoff: 9000, res: 0.04, env: 0 },
    },
    envA: { a: 0.01, d: 0.3, s: 0.75, r: 0.35 },
    envF: { a: 0.005, d: 0.28, s: 0.2, r: 0.3 },
    envM: { a: 0.2, d: 0.4, s: 0.45, r: 0.5 },
    lfo1: { rate: 0.2 }, lfo2: { rate: 0.45 }, lfo3: { rate: 0.08 }, lfo4: { rate: 2.2 },
    shapes: SHAPE_KINDS.map(lfoShape),
    macros: [0.5, 0.35, 0.6, 0.25],
    matrix: [],
  };
}

function normOsc(src, d) {
  const o = src && typeof src === 'object' ? src : {};
  const table = TABLE_IDS.includes(o.table) ? o.table : d.table;
  const warp = WARP_IDS.includes(o.warp) ? o.warp : d.warp;
  return {
    table, warp,
    pos: clamp(num(o.pos, d.pos), 0, 1),
    oct: clamp(Math.round(num(o.oct, d.oct)), -2, 2),
    semi: clamp(Math.round(num(o.semi, d.semi)), -12, 12),
    fine: clamp(num(o.fine, d.fine), -100, 100),
    level: clamp(num(o.level, d.level), 0, 1),
    warpAmt: clamp(num(o.warpAmt, d.warpAmt), 0, 1),
  };
}
function normEnv(src, d) {
  const o = src && typeof src === 'object' ? src : {};
  return {
    a: clamp(num(o.a, d.a), 0.001, 8),
    d: clamp(num(o.d, d.d), 0.001, 8),
    s: clamp(num(o.s, d.s), 0, 1),
    r: clamp(num(o.r, d.r), 0.001, 12),
  };
}
function normFilt(src, d) {
  const o = src && typeof src === 'object' ? src : {};
  return {
    mode: MODE_IDS.includes(o.mode) ? o.mode : d.mode,
    cutoff: clamp(num(o.cutoff, d.cutoff), 20, 18000),
    res: clamp(num(o.res, d.res), 0, 0.92),
    env: clamp(num(o.env, d.env), 0, 1),
  };
}

export function normalizeLattice(p) {
  const d = defaultLattice();
  const out = defaultLattice();
  const src = p && typeof p === 'object' ? p : {};
  if (typeof src.name === 'string' && src.name.trim()) out.name = src.name.trim().slice(0, 40);
  const cats = ['Pad', 'Pluck', 'Bass', 'Keys', 'Lead', 'Texture'];
  if (cats.includes(src.cat)) out.cat = src.cat;
  out.level = clamp(num(src.level, d.level), 0, 1);
  out.bandlimit = src.bandlimit == null ? true : !!src.bandlimit;
  out.osc1 = normOsc(src.osc1, d.osc1);
  out.osc2 = normOsc(src.osc2, d.osc2);
  const u = src.unison && typeof src.unison === 'object' ? src.unison : {};
  out.unison = {
    count: clamp(Math.round(num(u.count, d.unison.count)), 1, MAX_UNI),
    detune: clamp(num(u.detune, d.unison.detune), 0, 50),
    spread: clamp(num(u.spread, d.unison.spread), 0, 1),
  };
  const sub = src.sub && typeof src.sub === 'object' ? src.sub : {};
  out.sub = { level: clamp(num(sub.level, 0), 0, 1) };
  const nz = src.noise && typeof src.noise === 'object' ? src.noise : {};
  out.noise = { level: clamp(num(nz.level, 0), 0, 1), color: clamp(num(nz.color, d.noise.color), 0, 1) };
  const f = src.filt && typeof src.filt === 'object' ? src.filt : {};
  out.filt = {
    route: ROUTE_IDS.includes(f.route) ? f.route : 'serial',
    a: normFilt(f.a, d.filt.a),
    b: normFilt(f.b, d.filt.b),
  };
  out.envA = normEnv(src.envA, d.envA);
  out.envF = normEnv(src.envF, d.envF);
  out.envM = normEnv(src.envM, d.envM);
  ['lfo1', 'lfo2', 'lfo3', 'lfo4'].forEach(id => {
    const o = src[id] && typeof src[id] === 'object' ? src[id] : {};
    out[id] = { rate: clamp(num(o.rate, d[id].rate), 0.02, 20) };
  });
  out.shapes = [0, 1, 2, 3].map(i => copyShape(src.shapes && src.shapes[i], d.shapes[i]));
  const macros = Array.isArray(src.macros) ? src.macros : [];
  out.macros = [0, 1, 2, 3].map(i => clamp(num(macros[i], d.macros[i]), 0, 1));
  const matrix = Array.isArray(src.matrix) ? src.matrix : [];
  out.matrix = [];
  for (let i = 0; i < matrix.length && out.matrix.length < SLOTS; i++) {
    const s = matrix[i];
    if (!s || !SRC_IDS.includes(s.src) || !DEST_IDS.includes(s.dest)) continue;
    out.matrix.push({ src: s.src, dest: s.dest, amt: clamp(num(s.amt, 0), -1, 1) });
  }
  out.device = 'lattice';
  out.v = 1;
  return out;
}

function besselI0(x) {
  let s = 1, t = 1;
  for (let k = 1; k < 24; k++) { t *= (x / (2 * k)) * (x / (2 * k)); s += t; }
  return s;
}

// Odd-length half-band. Windowed sinc, DC gain 1, so the 2x stream keeps its level.
function halfbandTaps(N, beta) {
  const h = new Float64Array(N), M = (N - 1) / 2;
  let sum = 0;
  for (let n = 0; n < N; n++) {
    const k = n - M;
    const sinc = k === 0 ? 0.5 : Math.sin(Math.PI * k / 2) / (Math.PI * k);
    const w = besselI0(beta * Math.sqrt(Math.max(0, 1 - (k / M) * (k / M)))) / besselI0(beta);
    h[n] = sinc * w; sum += h[n];
  }
  for (let n = 0; n < N; n++) h[n] /= sum;
  return h;
}

function createDecimator(taps) {
  const N = taps.length, buf = new Float64Array(N);
  let w = 0, parity = 0;
  return {
    run(input, output) {
      let o = 0;
      for (let i = 0; i < input.length; i++) {
        buf[w] = input[i];
        w = w + 1 === N ? 0 : w + 1;
        parity ^= 1;
        if (parity) continue;
        let acc = 0, j = w;
        for (let k = 0; k < N; k++) {
          acc += taps[k] * buf[j];
          j = j + 1 === N ? 0 : j + 1;
        }
        output[o++] = acc;
      }
    },
  };
}

function fft(re, im, inv) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (inv ? 2 : -2) * Math.PI / len;
    const wRe = Math.cos(ang), wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wr = 1, wi = 0;
      const half = len >> 1;
      for (let k = 0; k < half; k++) {
        const j = i + k + half;
        const tr = wr * re[j] - wi * im[j];
        const ti = wr * im[j] + wi * re[j];
        re[j] = re[i + k] - tr;
        im[j] = im[i + k] - ti;
        re[i + k] += tr;
        im[i + k] += ti;
        const nr = wr * wRe - wi * wIm;
        wi = wr * wIm + wi * wRe;
        wr = nr;
      }
    }
  }
  if (inv) { const invN = 1 / n; for (let i = 0; i < n; i++) { re[i] *= invN; im[i] *= invN; } }
}

function waveFromHarmonics(amps) {
  const y = new Float64Array(CYCLE);
  for (let n = 0; n < CYCLE; n++) {
    const p = TAU * n / CYCLE;
    let s = 0;
    for (let h = 1; h <= MAX_H; h++) {
      const a = amps[h];
      if (a) s += a * Math.sin(h * p);
    }
    y[n] = s;
  }
  return y;
}

function peakNormalize(y, peak) {
  let pk = 0;
  for (let i = 0; i < y.length; i++) {
    const a = y[i] < 0 ? -y[i] : y[i];
    if (a > pk) pk = a;
  }
  const g = pk > 1e-8 ? peak / pk : 0;
  const out = new Float32Array(y.length);
  for (let i = 0; i < y.length; i++) out[i] = y[i] * g;
  return out;
}

function mipsFromFrames(frames) {
  const out = new Float32Array(MIPS * FRAMES * CYCLE);
  for (let m = 0; m < MIPS; m++) {
    const maxH = MAX_H >> m;
    for (let f = 0; f < FRAMES; f++) {
      const src = frames[f];
      const amps = src.slice();
      for (let h = maxH + 1; h < amps.length; h++) amps[h] = 0;
      const y = peakNormalize(waveFromHarmonics(amps), 0.9);
      out.set(y, (m * FRAMES + f) * CYCLE);
    }
  }
  return out;
}

function ampsOf(fn) {
  const frames = [];
  for (let f = 0; f < FRAMES; f++) {
    const t = FRAMES === 1 ? 0 : f / (FRAMES - 1);
    const a = new Float64Array(MAX_H + 1);
    fn(a, t);
    frames.push(a);
  }
  return frames;
}

let FACTORY = null;
export function factoryTables() {
  if (FACTORY) return FACTORY;
  const glass = ampsOf((a, t) => {
    a[1] = 1;
    a[2] = 0.04 * t;
    a[3] = 0.55 * t;
    a[4] = 0.08 * t * t;
    a[5] = 0.32 * t * t;
    a[7] = 0.14 * t * t * t;
  });
  const reed = ampsOf((a, t) => {
    for (let h = 1; h <= MAX_H; h++) {
      const odd = h & 1;
      const base = odd ? 1 / h : 0.12 / h;
      a[h] = h === 1 ? 1 : base * (0.05 + 0.95 * t);
    }
  });
  const brass = ampsOf((a, t) => {
    const center = 3 + t * 9;
    for (let h = 1; h <= MAX_H; h++) {
      const bump = 1 + 1.5 * Math.exp(-Math.pow((h - center) / 1.7, 2));
      a[h] = Math.pow(h, -1.15) * (h === 1 ? 1 : 0.2 + 0.8 * t) * bump;
    }
  });
  const vowel = ampsOf((a, t) => {
    const centers = [2 + t * 4, 7 + t * 7, 14 + (1 - t) * 6];
    a[1] = 0.35 + 0.65 * (1 - t * 0.3);
    for (let h = 2; h <= MAX_H; h++) {
      let s = 0;
      for (let c = 0; c < 3; c++) s += Math.exp(-Math.pow((h - centers[c]) / (1.3 + c * 0.4), 2));
      a[h] = (0.15 + 0.85 * t) * s / h;
    }
  });
  const edge = ampsOf((a, t) => {
    for (let h = 1; h <= MAX_H; h++) a[h] = (h === 1 ? 1 : t / h);
  });
  const hollow = ampsOf((a, t) => {
    a[1] = 1 - 0.85 * t;
    a[2] = 0.15 + 0.75 * t;
    a[3] = 0.45 * t;
    a[4] = 0.28 * t;
    a[5] = 0.12 * t;
    a[6] = 0.22 * t * t;
    a[8] = 0.1 * t;
  });
  FACTORY = {
    glass: mipsFromFrames(glass),
    reed: mipsFromFrames(reed),
    brass: mipsFromFrames(brass),
    vowel: mipsFromFrames(vowel),
    edge: mipsFromFrames(edge),
    hollow: mipsFromFrames(hollow),
  };
  return FACTORY;
}

export function previewFrame(name, frame, user) {
  const tables = factoryTables();
  const t = name === 'user' && user && user.length === MIPS * FRAMES * CYCLE ? user : (tables[name] || tables.glass);
  const f = clamp(frame | 0, 0, FRAMES - 1);
  return t.subarray(f * CYCLE, (f + 1) * CYCLE);
}

function mipsFromCycles(cycles) {
  const out = new Float32Array(MIPS * FRAMES * CYCLE);
  const re = new Float64Array(CYCLE);
  const im = new Float64Array(CYCLE);
  for (let f = 0; f < FRAMES; f++) {
    re.set(cycles[f]);
    im.fill(0);
    fft(re, im, false);
    for (let m = 0; m < MIPS; m++) {
      const maxH = Math.max(1, MAX_H >> m);
      const rr = new Float64Array(CYCLE);
      const ii = new Float64Array(CYCLE);
      rr[0] = 0; ii[0] = 0;
      for (let k = 1; k <= maxH && k < CYCLE / 2; k++) {
        rr[k] = re[k]; ii[k] = im[k];
        rr[CYCLE - k] = re[CYCLE - k]; ii[CYCLE - k] = im[CYCLE - k];
      }
      fft(rr, ii, true);
      const y = peakNormalize(rr, 0.9);
      out.set(y, (m * FRAMES + f) * CYCLE);
    }
  }
  return out;
}

function estimatePeriod(x) {
  const n = x.length;
  if (n < 32) return n;
  let energy = 0;
  for (let i = 0; i < n; i++) energy += x[i] * x[i];
  if (energy < 1e-10) return n;
  const minL = 8;
  const maxL = Math.min(n >> 1, 8000);
  let best = 0, bestL = n;
  const skip = n > 12000 ? 2 : 1;
  for (let lag = minL; lag <= maxL; lag++) {
    let c = 0;
    const m = n - lag;
    for (let i = 0; i < m; i += skip) c += x[i] * x[i + lag];
    if (c > best) { best = c; bestL = lag; }
  }
  const compared = (n - bestL) / skip;
  const norm = best / Math.max(1, compared);
  const meanE = energy / n;
  if (norm < meanE * 0.35) return n;
  return bestL;
}

function resampleSpan(src, start, len, nOut) {
  const y = new Float64Array(nOut);
  const last = src.length - 1;
  for (let i = 0; i < nOut; i++) {
    const x = start + (i + 0.5) / nOut * len;
    const i0 = clamp(Math.floor(x), 0, last);
    const i1 = i0 < last ? i0 + 1 : i0;
    const t = clamp(x - i0, 0, 1);
    y[i] = src[i0] * (1 - t) + src[i1] * t;
  }
  let dc = 0;
  for (let i = 0; i < nOut; i++) dc += y[i];
  dc /= nOut;
  for (let i = 0; i < nOut; i++) y[i] -= dc;
  return y;
}

// Turn a mono buffer into a mipmapped wavetable. A repeating period becomes one
// frame; a short one-shot that has no period is one cycle copied across the
// frames. Frames are taken from across the buffer so a long file can morph.
export function tableFromMono(mono) {
  const x = mono instanceof Float64Array ? mono : Float64Array.from(mono || []);
  if (x.length < 8) {
    const amps = new Float64Array(MAX_H + 1);
    amps[1] = 1;
    const one = peakNormalize(waveFromHarmonics(amps), 0.9);
    const cycles = [];
    for (let f = 0; f < FRAMES; f++) cycles.push(one);
    return mipsFromCycles(cycles.map(c => Float64Array.from(c)));
  }
  const period = estimatePeriod(x);
  const cycles = [];
  const usable = Math.max(1, Math.floor(x.length / period));
  for (let f = 0; f < FRAMES; f++) {
    const idx = Math.min(usable - 1, Math.floor(f * usable / FRAMES));
    const start = Math.min(x.length - 1, idx * period);
    const len = Math.min(period, x.length - start);
    cycles.push(resampleSpan(x, start, Math.max(8, len), CYCLE));
  }
  return mipsFromCycles(cycles);
}

function blankFilter() {
  return { ic1: 0, ic2: 0, a1: 1, a2: 0, a3: 0, k: 2 };
}
function blankVoice(i) {
  const uni = [];
  for (let u = 0; u < MAX_UNI; u++) uni.push({ p1: 0, p2: 0 });
  return {
    on: false, held: false, note: 60, vel: 0.8, age: 0, sub: 0, nseed: (i + 1) * 997, nlp: 0,
    envA: { stage: 'off', v: 0 }, envF: { stage: 'off', v: 0 }, envM: { stage: 'off', v: 0 },
    uni,
    faL: blankFilter(), faR: blankFilter(), fbL: blankFilter(), fbR: blankFilter(),
  };
}

function hashSeed() {
  let x = (Math.random() * 1e9) | 0;
  return x || 1;
}

export function createLatticeEngine(sampleRate, patch) {
  const taps = halfbandTaps(31, 7.2);
  const voices = [];
  for (let i = 0; i < VOICE_N; i++) voices.push(blankVoice(i));
  return {
    sr: sampleRate, sr2: sampleRate * 2,
    patch: normalizeLattice(patch),
    voices, age: 1, active: true, sustain: false,
    bend: 0, wheel: 0,
    lfoPhase: [0, 0, 0, 0],
    lfoNow: [0, 0, 0, 0],
    user: null,
    queue: [], soon: [],
    decL: createDecimator(taps), decR: createDecimator(taps),
    dcLx: 0, dcL: 0, dcRx: 0, dcR: 0,
    meterN: 0, cpuMs: 0, cpuFrames: 0, peak: 0,
    vis: { pos1: 0.15, pos2: 0.4, lfo: [0, 0, 0, 0], env: [0, 0, 0], slots: [], voices: 0 },
    onMeter: null,
  };
}

function releaseVoice(v) {
  if (!v.on) return;
  v.held = false;
  if (v.envA.stage !== 'off') v.envA.stage = 'r';
  if (v.envF.stage !== 'off') v.envF.stage = 'r';
  if (v.envM.stage !== 'off') v.envM.stage = 'r';
}
function noteOn(eng, n, vel) {
  if (!eng.active) return;
  const note = clamp(n | 0, 0, 127);
  let slot = null;
  for (let i = 0; i < eng.voices.length; i++) if (!eng.voices[i].on) { slot = eng.voices[i]; break; }
  if (!slot) {
    slot = eng.voices[0];
    for (let i = 1; i < eng.voices.length; i++) {
      const a = eng.voices[i];
      const aRel = a.envA.stage === 'r' || a.envA.stage === 'off';
      const sRel = slot.envA.stage === 'r' || slot.envA.stage === 'off';
      if (aRel && !sRel) slot = a;
      else if (aRel === sRel && a.envA.v < slot.envA.v) slot = a;
    }
  }
  slot.on = true; slot.held = true; slot.note = note;
  slot.vel = clamp(num(vel, 0.8), 0, 1);
  slot.age = ++eng.age;
  slot.envA.stage = 'a'; slot.envA.v = 0;
  slot.envF.stage = 'a'; slot.envF.v = 0;
  slot.envM.stage = 'a'; slot.envM.v = 0;
  slot.sub = Math.random();
  slot.nseed = hashSeed();
  slot.nlp = 0;
  for (let u = 0; u < MAX_UNI; u++) {
    slot.uni[u].p1 = Math.random();
    slot.uni[u].p2 = Math.random();
  }
  slot.faL = blankFilter(); slot.faR = blankFilter();
  slot.fbL = blankFilter(); slot.fbR = blankFilter();
}
function noteOff(eng, n) {
  const note = n | 0;
  for (let i = 0; i < eng.voices.length; i++) {
    const v = eng.voices[i];
    if (v.on && v.held && v.note === note) {
      if (eng.sustain) v.held = false;
      else releaseVoice(v);
    }
  }
}

function handle(eng, m) {
  if (!m || !m.t) return;
  if (m.t === 'patch') eng.patch = normalizeLattice(m.p || m.patch || {});
  else if (m.t === 'on') noteOn(eng, m.n, m.v);
  else if (m.t === 'off') noteOff(eng, m.n);
  else if (m.t === 'bend') eng.bend = clamp(num(m.v, 0), -1, 1);
  else if (m.t === 'mw') eng.wheel = clamp(num(m.v, 0), 0, 1);
  else if (m.t === 'sus') {
    eng.sustain = !!m.on;
    if (!eng.sustain) {
      for (let i = 0; i < eng.voices.length; i++) if (eng.voices[i].on && !eng.voices[i].held) releaseVoice(eng.voices[i]);
    }
  } else if (m.t === 'panic') {
    eng.sustain = false;
    for (let i = 0; i < eng.voices.length; i++) releaseVoice(eng.voices[i]);
  } else if (m.t === 'active') {
    eng.active = !!m.on;
    if (!eng.active) {
      eng.sustain = false;
      for (let i = 0; i < eng.voices.length; i++) releaseVoice(eng.voices[i]);
    }
  } else if (m.t === 'table' && m.data && m.data.length === MIPS * FRAMES * CYCLE) {
    eng.user = Float32Array.from(m.data);
  } else if (m.t === 'macro') {
    const i = m.i | 0;
    if (i >= 0 && i < 4) eng.patch.macros[i] = clamp(num(m.v, 0), 0, 1);
  }
}

export function postLattice(eng, m) {
  if (!m) return;
  if (m.at == null) eng.soon.push(m);
  else eng.queue.push(m);
}

function envStep(e, p, sr) {
  if (e.stage === 'a') {
    e.v += 1 / Math.max(1, p.a * sr);
    if (e.v >= 1) { e.v = 1; e.stage = p.d <= 0.0015 && p.s >= 0.999 ? 's' : 'd'; }
  } else if (e.stage === 'd') {
    const c = Math.exp(-1 / Math.max(1, p.d * sr));
    e.v = p.s + (e.v - p.s) * c;
    if (e.v < p.s + 0.0008) { e.v = p.s; e.stage = 's'; }
  } else if (e.stage === 's') e.v = p.s;
  else if (e.stage === 'r') {
    const c = Math.exp(-1 / Math.max(1, p.r * sr));
    e.v *= c;
    if (e.v < 0.0006) { e.v = 0; e.stage = 'off'; }
  }
  return e.v;
}

function lfoAt(shape, phase) {
  let p = phase - Math.floor(phase);
  if (p < 0) p += 1;
  const x = p * LFO_N;
  const i0 = x | 0;
  const i1 = i0 + 1 >= LFO_N ? 0 : i0 + 1;
  const t = x - i0;
  return shape[i0] * (1 - t) + shape[i1] * t;
}

function tableOf(eng, name) {
  if (name === 'user' && eng.user) return eng.user;
  const tables = factoryTables();
  return tables[name] || tables.glass;
}

function mipFor(freq, sr, limit) {
  if (!limit) return 0;
  const allow = (sr * 0.45) / Math.max(20, freq);
  let m = 0;
  let kept = MAX_H;
  while (kept > allow && m < MIPS - 1) { m++; kept >>= 1; }
  return m;
}

function readTable(table, mip, frame, phase) {
  let f = frame;
  if (f < 0) f = 0;
  const fMax = FRAMES - 1;
  if (f > fMax) f = fMax;
  const f0 = f | 0;
  const f1 = f0 >= fMax ? fMax : f0 + 1;
  const ft = f - f0;
  let p = phase - Math.floor(phase);
  if (p < 0) p += 1;
  const x = p * CYCLE;
  let i0 = x | 0;
  if (i0 >= CYCLE) i0 = 0;
  const i1 = i0 + 1 >= CYCLE ? 0 : i0 + 1;
  const xt = x - Math.floor(x);
  const b0 = (mip * FRAMES + f0) * CYCLE;
  const b1 = (mip * FRAMES + f1) * CYCLE;
  const a = table[b0 + i0] * (1 - xt) + table[b0 + i1] * xt;
  const c = table[b1 + i0] * (1 - xt) + table[b1 + i1] * xt;
  return a * (1 - ft) + c * ft;
}

function warpPhase(mode, phase, amt, dt, osc2) {
  if (mode === 'bend') {
    let q = phase + amt * 0.45 * Math.sin(TAU * phase);
    q -= Math.floor(q);
    if (q < 0) q += 1;
    return q;
  }
  if (mode === 'pwm') return phase;
  if (mode === 'fm') {
    let q = phase + (osc2 || 0) * amt * 2.4;
    q -= Math.floor(q);
    if (q < 0) q += 1;
    return q;
  }
  if (mode === 'sync') return phase;
  return phase - Math.floor(phase);
}

function readWarped(table, mip, frame, phase, mode, amt) {
  const p = phase - Math.floor(phase);
  if (mode === 'pwm') {
    const w = 0.12 + amt * 0.76;
    return readTable(table, mip, frame, p) - readTable(table, mip, frame, p + w);
  }
  if (mode === 'sync') {
    const ratio = 1 + amt * 6;
    let s = (p * ratio) % 1;
    if (s < 0) s += 1;
    return readTable(table, mip, frame, s);
  }
  return readTable(table, mip, frame, warpPhase(mode, p, amt, 0, 0));
}

function noteHz(note, oct, semi, fine, bend) {
  const semis = (note - 69) + oct * 12 + semi + fine / 100 + bend * 2;
  return 440 * Math.pow(2, semis / 12);
}

function prep(st, fc, res, sr) {
  const f = clamp(fc, 20, sr * 0.45);
  const g = Math.tan(Math.PI * f / sr);
  const k = 2 * (1 - clamp(res, 0, 0.92));
  const a1 = 1 / (1 + g * (g + k));
  st.k = k; st.a1 = a1; st.a2 = g * a1; st.a3 = g * st.a2;
}
function svf(st, x, mode) {
  const v3 = x - st.ic2 + 1e-20;
  const v1 = st.a1 * st.ic1 + st.a2 * v3;
  const v2 = st.ic2 + st.a2 * st.ic1 + st.a3 * v3;
  st.ic1 = 2 * v1 - st.ic1;
  st.ic2 = 2 * v2 - st.ic2;
  if (!Number.isFinite(st.ic1) || !Number.isFinite(st.ic2)) { st.ic1 = 0; st.ic2 = 0; return 0; }
  let y;
  if (mode === 'hp') y = x - st.k * v1 - v2;
  else if (mode === 'bp') y = v1;
  else if (mode === 'notch') y = x - st.k * v1;
  else y = v2;
  if (y > 4) return 4;
  if (y < -4) return -4;
  return y;
}
function filterPair(aSt, bSt, x, aMode, bMode, serial) {
  const yA = svf(aSt, x, aMode);
  if (!serial) return 0.5 * (yA + svf(bSt, x, bMode));
  return svf(bSt, yA, bMode);
}

function xorshift(v) {
  let x = v.nseed >>> 0;
  x ^= x << 13; x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5; x >>>= 0;
  v.nseed = x || 1;
  return (x & 65535) / 32768 - 1;
}

function srcValue(id, lfo, voice, eng) {
  if (id < 4) return lfo[id];
  if (id === 4) return voice.envA.v;
  if (id === 5) return voice.envF.v;
  if (id === 6) return voice.envM.v;
  if (id === 7) return voice.vel;
  if (id === 8) return eng.wheel;
  return eng.patch.macros[id - 9] || 0;
}

function soft(x) {
  const a = x < 0 ? -x : x;
  if (a <= 0.85) return x;
  const s = x < 0 ? -1 : 1;
  return s * (0.85 + 0.14 * Math.tanh((a - 0.85) / 0.14));
}

export function renderBlock(eng, outL, outR, start) {
  const t0 = Date.now();
  const n = outL.length;
  const sr = eng.sr, sr2 = eng.sr2;
  if (eng.soon.length) {
    const soon = eng.soon; eng.soon = [];
    for (let i = 0; i < soon.length; i++) handle(eng, soon[i]);
  }
  const q = eng.queue;
  if (q.length > 1) q.sort((a, b) => (a.at || 0) - (b.at || 0));
  let qi = 0;
  const L2 = eng._L2 && eng._L2.length === n * 2 ? eng._L2 : (eng._L2 = new Float64Array(n * 2));
  const R2 = eng._R2 && eng._R2.length === n * 2 ? eng._R2 : (eng._R2 = new Float64Array(n * 2));
  L2.fill(0); R2.fill(0);
  const P = eng.patch;
  const t1 = tableOf(eng, P.osc1.table);
  const t2 = tableOf(eng, P.osc2.table);
  const uniN = P.unison.count;
  const uniGain = 1 / Math.sqrt(uniN);
  const spread = P.unison.spread;
  const det = P.unison.detune;
  const serial = P.filt.route !== 'parallel';
  const rates = [P.lfo1.rate, P.lfo2.rate, P.lfo3.rate, P.lfo4.rate];
  const shapes = P.shapes;
  const matrix = P.matrix;
  const cents = new Float64Array(uniN);
  const pans = new Float64Array(uniN);
  for (let u = 0; u < uniN; u++) {
    const mid = (uniN - 1) / 2;
    cents[u] = uniN === 1 ? 0 : ((u - mid) / mid) * det;
    const pan = uniN === 1 ? 0 : ((u - mid) / mid) * spread;
    pans[u] = pan;
  }
  let sounding = 0;
  let visVoice = null;
  let live = 0;
  const offs = new Float64Array(DEST_IDS.length);
  const slotVis = new Float64Array(matrix.length);

  for (let i = 0; i < n; i++) {
    const frame = start + i;
    while (qi < q.length && (q[qi].at || 0) <= frame) handle(eng, q[qi++]);
    for (let k = 0; k < 4; k++) {
      eng.lfoPhase[k] += rates[k] / sr;
      if (eng.lfoPhase[k] >= 1) eng.lfoPhase[k] -= Math.floor(eng.lfoPhase[k]);
      eng.lfoNow[k] = lfoAt(shapes[k], eng.lfoPhase[k]);
    }
    const lfo = eng.lfoNow;
    for (let vi = 0; vi < VOICE_N; vi++) {
      const voice = eng.voices[vi];
      if (!voice.on) continue;
      envStep(voice.envA, P.envA, sr);
      envStep(voice.envF, P.envF, sr);
      envStep(voice.envM, P.envM, sr);
      if (voice.envA.stage === 'off' && voice.envA.v <= 0) { voice.on = false; continue; }
      live++;
      visVoice = voice;
      offs.fill(0);
      for (let s = 0; s < matrix.length; s++) {
        const slot = matrix[s];
        const sv = srcValue(SRC[slot.src], lfo, voice, eng) * slot.amt;
        slotVis[s] = sv;
        offs[DEST[slot.dest]] += sv;
      }
      const pos1 = clamp(P.osc1.pos + offs[0], 0, 0.9999);
      const pos2 = clamp(P.osc2.pos + offs[1], 0, 0.9999);
      const frame1 = pos1 * (FRAMES - 1);
      const frame2 = pos2 * (FRAMES - 1);
      const w1 = clamp(P.osc1.warpAmt + offs[2], 0, 1);
      const w2 = clamp(P.osc2.warpAmt + offs[3], 0, 1);
      const mode1 = P.osc1.warp;
      const mode2 = P.osc2.warp;
      const base1 = noteHz(voice.note, P.osc1.oct, P.osc1.semi, P.osc1.fine, eng.bend);
      const base2 = noteHz(voice.note, P.osc2.oct, P.osc2.semi, P.osc2.fine, eng.bend);
      const detCents = offs[9] * 18;
      const cutA = P.filt.a.cutoff * Math.pow(2, voice.envF.v * P.filt.a.env * 4 + offs[4] * 2);
      const cutB = P.filt.b.cutoff * Math.pow(2, voice.envF.v * P.filt.b.env * 2 + offs[5] * 2);
      const resA = clamp(P.filt.a.res, 0, 0.92);
      const resB = clamp(P.filt.b.res, 0, 0.92);
      const lv1 = P.osc1.level;
      const lv2 = P.osc2.level;
      const need2 = lv2 > 0.0004 || mode1 === 'fm';
      const mipScale1 = mode1 === 'sync' ? (1 + w1 * 6) : mode1 === 'fm' ? (1 + w1 * 3) : mode1 === 'pwm' ? (1 + w1) : mode1 === 'bend' ? (1 + w1 * 0.5) : 1;
      const mipScale2 = mode2 === 'sync' ? (1 + w2 * 6) : mode2 === 'pwm' ? (1 + w2) : 1;
      const nColor = clamp(P.noise.color, 0.02, 1);
      const nLv = clamp(P.noise.level + offs[7] * 0.5, 0, 1);
      const sLv = clamp(P.sub.level + offs[8] * 0.5, 0, 1);
      const amp = voice.envA.v * Math.max(0, 1 + offs[6]) * P.level;
      eng.vis.pos1 = pos1; eng.vis.pos2 = pos2;
      eng.vis.env[0] = voice.envA.v; eng.vis.env[1] = voice.envF.v; eng.vis.env[2] = voice.envM.v;

      const accL = [0, 0], accR = [0, 0];
      for (let u = 0; u < uniN; u++) {
        const f1 = base1 * Math.pow(2, (cents[u] + detCents) / 1200);
        const f2 = base2 * Math.pow(2, (cents[u] * 0.65 + detCents) / 1200);
        const dt1 = f1 / sr2;
        const dt2 = f2 / sr2;
        const mip1 = mipFor(f1 * mipScale1, sr2, P.bandlimit);
        const mip2 = mipFor(f2 * mipScale2, sr2, P.bandlimit);
        const pan = pans[u];
        const ang = (pan + 1) * Math.PI * 0.25;
        const gL = Math.cos(ang) * uniGain;
        const gR = Math.sin(ang) * uniGain;
        const ph = voice.uni[u];
        for (let k = 0; k < 2; k++) {
          let o2 = 0;
          if (need2) {
            ph.p2 += dt2;
            if (ph.p2 >= 1) ph.p2 -= Math.floor(ph.p2);
            if (mode2 === 'fm') o2 = readWarped(t2, mip2, frame2, warpPhase('fm', ph.p2, w2, dt2, Math.sin(TAU * ph.p2)), 'off', 0);
            else o2 = readWarped(t2, mip2, frame2, ph.p2, mode2, w2);
          }
          ph.p1 += dt1;
          if (ph.p1 >= 1) ph.p1 -= Math.floor(ph.p1);
          let pRead = ph.p1;
          if (mode1 === 'fm') pRead = warpPhase('fm', ph.p1, w1, dt1, o2);
          const o1 = mode1 === 'fm'
            ? readTable(t1, mip1, frame1, pRead)
            : readWarped(t1, mip1, frame1, pRead, mode1, w1);
          const y = o1 * lv1 + o2 * lv2;
          accL[k] += y * gL;
          accR[k] += y * gR;
        }
      }
      for (let k = 0; k < 2; k++) {
        voice.sub += (base1 * 0.5) / sr2;
        if (voice.sub >= 1) voice.sub -= Math.floor(voice.sub);
        const sub = Math.sin(TAU * voice.sub) * sLv;
        const white = xorshift(voice);
        voice.nlp += (white - voice.nlp) * nColor;
        const nz = voice.nlp * nLv * 0.8;
        let l = accL[k] + sub + nz;
        let r = accR[k] + sub + nz;
        prep(voice.faL, cutA, resA, sr2); prep(voice.fbL, cutB, resB, sr2);
        prep(voice.faR, cutA, resA, sr2); prep(voice.fbR, cutB, resB, sr2);
        l = filterPair(voice.faL, voice.fbL, l, P.filt.a.mode, P.filt.b.mode, serial);
        r = filterPair(voice.faR, voice.fbR, r, P.filt.a.mode, P.filt.b.mode, serial);
        l *= amp; r *= amp;
        const o = i * 2 + k;
        L2[o] += l; R2[o] += r;
      }
    }
    sounding = live;
    live = 0;
  }
  if (qi) q.splice(0, qi);
  for (let i = 0; i < n * 2; i++) { L2[i] = soft(L2[i]); R2[i] = soft(R2[i]); }
  eng.decL.run(L2, outL); eng.decR.run(R2, outR);
  const a = Math.exp(-TAU * 12 / sr);
  let xl = eng.dcLx, yl = eng.dcL, xr = eng.dcRx, yr = eng.dcR;
  for (let i = 0; i < n; i++) {
    const l = outL[i], r = outR[i];
    yl = l - xl + a * yl; xl = l;
    yr = r - xr + a * yr; xr = r;
    const lc = yl > 1 ? 1 : yl < -1 ? -1 : yl;
    const rc = yr > 1 ? 1 : yr < -1 ? -1 : yr;
    outL[i] = lc; outR[i] = rc;
    const pk = lc < 0 ? -lc : lc;
    const pkR = rc < 0 ? -rc : rc;
    if (pk > eng.peak) eng.peak = pk;
    if (pkR > eng.peak) eng.peak = pkR;
  }
  eng.dcLx = xl; eng.dcL = yl; eng.dcRx = xr; eng.dcR = yr;
  eng.vis.lfo = [lfoAt(shapes[0], eng.lfoPhase[0]), lfoAt(shapes[1], eng.lfoPhase[1]), lfoAt(shapes[2], eng.lfoPhase[2]), lfoAt(shapes[3], eng.lfoPhase[3])];
  eng.vis.slots = Array.from(slotVis);
  eng.vis.voices = sounding;
  if (!visVoice) {
    eng.vis.pos1 = P.osc1.pos;
    eng.vis.pos2 = P.osc2.pos;
    eng.vis.env = [0, 0, 0];
  }
  eng.meterN += n; eng.cpuMs += Date.now() - t0; eng.cpuFrames += n;
  if (eng.onMeter && eng.meterN >= sr / 30) {
    eng.onMeter({
      t: 'meter', dev: 'lattice',
      voices: sounding, cpu: eng.cpuFrames ? eng.cpuMs / (eng.cpuFrames / sr * 1000) : 0,
      pos1: eng.vis.pos1, pos2: eng.vis.pos2,
      lfo: eng.vis.lfo.slice(), env: eng.vis.env.slice(), slots: eng.vis.slots.slice(),
      peak: eng.peak,
    });
    eng.meterN = 0; eng.peak = 0;
    if (eng.cpuFrames > sr) { eng.cpuMs *= 0.5; eng.cpuFrames *= 0.5; }
  }
}
