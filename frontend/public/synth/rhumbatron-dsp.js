// Rhumbatron voice. Original.
//
// A string or a bore is a circulating waveguide: a fractional delay, a two-point
// average in the loop (the loss of a real termination), and a triangular
// displacement where the energy enters. A bore flips sign at the open end, so
// the round trip takes two passes and the even partials cancel. A plate is a
// bank of modes of a slightly rectangular membrane. A second, lower mode is
// the cavity the resonator is coupled to. Bowing and blowing keep the loop
// fed while the key is held; a pluck or a strike is let go to ring.

import { normalizeRhumbatron, plateRatio } from './rhumbatron.js';

const BUF = 8192;
const MASK = BUF - 1;
export const VOICES = 8;

const PLATE = [];
for (let m = 1; m <= 4; m++) {
  for (let n = 1; n <= 3; n++) PLATE.push({ m, n, ratio: plateRatio(m, n) });
}

function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }

function midiHz(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function makeVoice() {
  return {
    stage: 'off', note: 60, vel: 0.8, age: 0,
    gate: false, muted: false, sus: false,
    buf: new Float32Array(BUF), w: 0, prev: 0, tone: 0,
    pos: 0.18, place: 0.5, material: 0.7, pressure: 0.3,
    body: 'string', exciter: 'pluck',
    modes: [],
    bp1: 0, bp2: 0, seed: 1,
  };
}

export function createRhumbatronEngine(sr, patch) {
  return {
    sr: sr || 48000,
    patch: normalizeRhumbatron(patch),
    voices: Array.from({ length: VOICES }, makeVoice),
    active: true,
    bend: 0,
    bendTarget: 0,
    mod: 0,
    sus: false,
    peak: 0,
    cpu: 0,
    played: 0,
    onMeter: null,
    meterN: 0,
  };
}

function readFrac(buf, write, delay) {
  let x = write - delay;
  x %= BUF;
  if (x < 0) x += BUF;
  const i0 = x | 0;
  const f = x - i0;
  const a = buf[i0 & MASK];
  const b = buf[(i0 + 1) & MASK];
  return a + (b - a) * f;
}

function freqOf(eng, note) {
  const size = clamp(eng.patch.size, 0.5, 2);
  const bend = Math.pow(2, clamp(eng.bend, -1, 1) * 2 / 12);
  const raw = midiHz(note) * bend / size;
  return clamp(raw, eng.sr / 7000, eng.sr / 8);
}

function tripLoss(trip, sr, damping, muted) {
  const T = muted ? 0.04 : (1.7 * Math.exp(-clamp(damping, 0, 1) * 3.6));
  return Math.exp(-(trip / sr) / Math.max(0.02, T));
}

function excite(eng, v) {
  const sr = eng.sr;
  const p = eng.patch;
  v.body = p.body;
  v.exciter = p.exciter;
  v.pos = p.position;
  v.place = p.place;
  v.material = p.material;
  v.pressure = p.pressure;
  v.stage = 'run';
  v.age = 0;
  v.muted = false;
  v.sus = false;
  v.gate = true;
  v.tone = 0;
  v.bp1 = v.vel * 0.08;
  v.bp2 = 0;
  v.buf.fill(0);
  v.prev = 0;
  v.w = 0;
  if (v.body === 'membrane') {
    const bright = v.exciter === 'strike' ? 1 : 0.72;
    v.modes = PLATE.map(md => {
      const shape = Math.sin(md.m * Math.PI * v.pos) * Math.sin(md.n * Math.PI * v.place);
      const slope = Math.pow(md.ratio, 1.7 - v.material * 0.5);
      return {
        m: md.m, n: md.n, ratio: md.ratio, phase: 0,
        amp: shape / slope * v.vel * bright * 0.28,
      };
    });
    return;
  }
  const odd = v.body === 'tube';
  const f0 = freqOf(eng, v.note);
  const period = sr / f0;
  const trip = odd ? period / 2 : period;
  const D = Math.max(6, trip - 0.5);
  const n = Math.max(8, Math.round(D));
  const pos = clamp(v.pos, 0.02, 0.98);
  const hard = v.exciter === 'strike' ? 0.22 + v.pressure * 0.55
    : v.exciter === 'bow' || v.exciter === 'blow' ? v.pressure * 0.12
    : 0.06 + v.pressure * 0.18;
  let seed = (v.seed = (Math.imul((v.seed || 1) + v.note + 1, 1664525) + 1013904223) >>> 0) || 1;
  const start = (BUF - n) & MASK;
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) / n;
    let shape = x < pos ? x / pos : (1 - x) / (1 - pos);
    shape = shape * 2 - 1;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = ((seed >>> 8) / 16777216) * 2 - 1;
    const s = shape * (1 - hard) + noise * hard * Math.sin(Math.PI * x);
    const y = s * (0.35 + v.material * 0.45) + prev * (0.2 + (1 - v.material) * 0.25);
    prev = s;
    v.buf[(start + i) & MASK] = y * v.vel * 0.45;
  }
  v.seed = seed;
  v.prev = v.buf[(BUF - 1) & MASK];
}

function alloc(eng, note) {
  for (let i = 0; i < VOICES; i++) {
    const v = eng.voices[i];
    if (v.stage !== 'off' && v.note === note && v.gate) return v;
  }
  for (let i = 0; i < VOICES; i++) if (eng.voices[i].stage === 'off') return eng.voices[i];
  let oldest = 0;
  for (let i = 1; i < VOICES; i++) if (eng.voices[i].age > eng.voices[oldest].age) oldest = i;
  return eng.voices[oldest];
}

function trigger(eng, note, vel) {
  if (!eng.active) return;
  const v = alloc(eng, note & 127);
  v.note = note & 127;
  v.vel = clamp(+vel || 0, 0, 1) || 0.8;
  excite(eng, v);
}

function releaseNote(eng, note) {
  const n = note & 127;
  for (let i = 0; i < VOICES; i++) {
    const v = eng.voices[i];
    if (v.stage === 'off' || v.note !== n || !v.gate) continue;
    v.gate = false;
    if (eng.sus) v.sus = true;
    else v.muted = true;
  }
}

function releaseSus(eng) {
  for (let i = 0; i < VOICES; i++) {
    const v = eng.voices[i];
    if (v.sus && !v.gate) { v.sus = false; v.muted = true; }
  }
}

function silence(eng) {
  for (let i = 0; i < VOICES; i++) {
    const v = eng.voices[i];
    v.stage = 'off';
    v.gate = false;
    v.muted = false;
    v.sus = false;
    v.buf.fill(0);
    v.prev = 0;
    v.tone = 0;
    v.bp1 = 0;
    v.bp2 = 0;
    v.modes = [];
  }
}

function sat(x) {
  const a = x < 0 ? -x : x;
  if (a <= 0.92) return x;
  return x * (0.92 + (a - 0.92) * 0.12) / a;
}

function tick(eng, v) {
  const sr = eng.sr;
  const p = eng.patch;
  v.age++;
  const material = clamp(p.material + eng.mod * 0.35, 0, 1);
  const damping = p.damping;
  const f0 = freqOf(eng, v.note);
  let s = 0;
  if (v.body === 'membrane') {
    const T = v.muted ? 0.045 : (1.5 * Math.exp(-clamp(damping, 0, 1) * 3.3));
    let energy = 0;
    for (let m = 0; m < v.modes.length; m++) {
      const md = v.modes[m];
      const dec = Math.exp(-(1 + (1 - material) * 0.4 * md.ratio) / (T * sr));
      md.amp *= dec;
      md.phase += 2 * Math.PI * f0 * md.ratio / sr;
      if (md.phase > 8192) md.phase -= 8192;
      s += Math.sin(md.phase) * md.amp;
      const a = md.amp < 0 ? -md.amp : md.amp;
      if (a > energy) energy = a;
    }
    if (v.muted && energy < 1e-4) { v.stage = 'off'; return 0; }
  } else {
    const odd = v.body === 'tube';
    const period = sr / f0;
    const trip = odd ? period / 2 : period;
    const D = Math.max(6, trip - 0.5);
    const x = readFrac(v.buf, v.w, D);
    const bow = v.gate && !v.muted && (v.exciter === 'bow' || v.exciter === 'blow');
    let y = 0.5 * (x + v.prev);
    if (odd) y = -y;
    if (bow) {
      y *= 1 + (0.14 + v.pressure * 0.1) / period;
      const lim = 0.14 + v.vel * 0.05 + v.pressure * 0.08;
      const ax = y < 0 ? -y : y;
      if (ax > lim) y *= (lim + (ax - lim) * 0.25) / ax;
    } else {
      y *= tripLoss(trip, sr, damping, v.muted);
    }
    if (!isFinite(y)) y = 0;
    v.prev = x;
    v.buf[v.w] = y;
    v.w = (v.w + 1) & MASK;
    const g = 0.08 + material * 0.9;
    v.tone += (y - v.tone) * g;
    s = material > 0.82 ? y : v.tone * 0.62 + y * 0.38;
    if (bow) {
      const at = readFrac(v.buf, v.w, clamp(p.position, 0.02, 0.98) * D);
      s = y * 0.72 - at * 0.28;
    }
    const energy = y < 0 ? -y : y;
    if (!bow && v.muted && energy < 1e-4 && v.age > 32) {
      v.stage = 'off';
      v.buf.fill(0);
      return 0;
    }
  }
  const bodyHz = clamp(160 / clamp(p.size, 0.5, 2), 40, 420);
  const R = Math.exp(-1 / (0.32 * sr));
  const th = 2 * Math.PI * bodyHz / sr;
  const bp = s * (1 - R) * 6 + (2 * R * Math.cos(th)) * v.bp1 - R * R * v.bp2;
  v.bp2 = v.bp1;
  v.bp1 = isFinite(bp) ? bp : 0;
  return s + p.coupling * v.bp1 * 0.18;
}

function sounding(eng) {
  let n = 0;
  for (let i = 0; i < VOICES; i++) if (eng.voices[i].stage !== 'off') n++;
  return n;
}

function publish(eng) {
  if (!eng.onMeter) return;
  eng.onMeter({ t: 'meter', voices: sounding(eng), peak: eng.peak, cpu: eng.cpu });
}

export function renderRhumbatron(eng, L, R) {
  const frames = L.length;
  const level = clamp(eng.patch.level, 0, 1);
  eng.bend += (eng.bendTarget - eng.bend) * 0.02;
  let peak = 0;
  for (let i = 0; i < frames; i++) {
    let l = 0;
    let r = 0;
    for (let k = 0; k < VOICES; k++) {
      const v = eng.voices[k];
      if (v.stage === 'off') continue;
      const s = tick(eng, v);
      const pan = (v.pos - 0.5) * 0.5;
      l += s * (0.8 - pan);
      r += s * (0.8 + pan);
    }
    l = sat(l * level);
    r = sat(r * level);
    if (!isFinite(l)) l = 0;
    if (!isFinite(r)) r = 0;
    L[i] = l;
    R[i] = r;
    const al = l < 0 ? -l : l;
    const ar = r < 0 ? -r : r;
    if (al > peak) peak = al;
    if (ar > peak) peak = ar;
  }
  eng.peak = peak;
  eng.played += frames;
  eng.meterN += frames;
  if (eng.meterN >= 2048) {
    eng.meterN = 0;
    publish(eng);
  }
}

export function postRhumbatron(eng, msg) {
  if (!msg || !msg.t) return;
  if (msg.t === 'patch') {
    eng.patch = normalizeRhumbatron(msg.p);
    return;
  }
  if (msg.t === 'on') { trigger(eng, msg.n | 0, msg.v == null ? 0.8 : msg.v); return; }
  if (msg.t === 'off') { releaseNote(eng, msg.n | 0); return; }
  if (msg.t === 'bend') { eng.bendTarget = clamp(+msg.v || 0, -1, 1); return; }
  if (msg.t === 'mw') { eng.mod = clamp(+msg.v || 0, 0, 1); return; }
  if (msg.t === 'sus') {
    eng.sus = !!msg.on;
    if (!eng.sus) releaseSus(eng);
    return;
  }
  if (msg.t === 'panic') {
    silence(eng);
    eng.sus = false;
    eng.bendTarget = 0;
    publish(eng);
    return;
  }
  if (msg.t === 'active') {
    eng.active = !!msg.on;
    if (!eng.active) { silence(eng); publish(eng); }
  }
}
