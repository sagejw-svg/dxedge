// Phantastron voice. Original. A clocked source-filter toy: an impulse or a
// sine, three resonators standing in for formants, a short DAC, and a
// sample-and-hold that is the toy's clock. Wires from the board pull the
// clock, the bit width, a stuck phrase loop, and a feedback comb.
// No sample tables and no speech ROM.

import { bendRaw, crush, loopWindow, normalizePhantastron, phraseOf } from './phantastron.js';

export const VOICES = 6;

// Rounded shapes, not a copied formant table. f1, f2, f3, bandwidth, noise, label.
const PHONES = [
  { f: [320, 860, 2300], bw: 90, n: 0.04 },
  { f: [460, 1680, 2500], bw: 110, n: 0.08 },
  { f: [720, 1100, 2460], bw: 120, n: 0.1 },
  { f: [300, 2140, 2920], bw: 100, n: 0.05 },
  { f: [520, 980, 2380], bw: 140, n: 0.22 },
  { f: [240, 1500, 2800], bw: 180, n: 0.85 },
  { f: [190, 640, 1880], bw: 70, n: 0.02 },
  { f: [880, 1720, 3360], bw: 160, n: 0.45 },
  { f: [150, 420, 1400], bw: 60, n: 0.0 },
];

function voice(sr) {
  const n = Math.max(8, Math.round(0.019 * sr));
  return {
    on: false, stage: 'off', note: 60, vel: 0, env: 0, age: 0, fast: false, held: false,
    phase: 0, idx: 0, step: 0, framePhase: 0,
    lfsr: 0x5a17,
    y: [{ y1: 0, y2: 0 }, { y1: 0, y2: 0 }, { y1: 0, y2: 0 }],
    hold: 0, holdPhase: 0,
    fb: new Float32Array(n), fbPos: 0,
    lp: 0,
    pan: 0,
  };
}

export function createPhantastronEngine(sr, patch) {
  const p = normalizePhantastron(patch);
  return {
    sr: sr || 48000,
    patch: p,
    phrase: phraseOf(p),
    voices: Array.from({ length: VOICES }, () => voice(sr || 48000)),
    active: true,
    sus: false,
    killed: false,
    bend: 0,
    mw: 0,
    played: 0,
    peak: 0,
    cpu: 0,
    lfsr: 0xace1,
    nse: 0,
    outEnv: 0,
    clkPhase: 0,
    onMeter: null,
    meterN: 0,
  };
}

function midiHz(n) {
  return 440 * Math.pow(2, (n - 69) / 12);
}

function soft(x) {
  const a = x < 0 ? -x : x;
  return x / (1 + a);
}

function resTick(st, x, freq, bw, sr) {
  const f = Math.min(sr * 0.45, Math.max(40, freq));
  const w = 2 * Math.PI * f / sr;
  const r = Math.exp(-Math.PI * Math.max(30, bw) / sr);
  const c = 2 * r * Math.cos(w);
  const y = x * (1 - r) + c * st.y1 - (r * r) * st.y2;
  st.y2 = st.y1;
  st.y1 = y;
  return y;
}

function alloc(eng) {
  let free = -1;
  let oldest = 0;
  for (let i = 0; i < VOICES; i++) {
    const v = eng.voices[i];
    if (v.stage === 'off') { free = i; break; }
    if (eng.voices[i].age > eng.voices[oldest].age) oldest = i;
  }
  return eng.voices[free >= 0 ? free : oldest];
}

function trigger(eng, note, vel) {
  const v = alloc(eng);
  v.on = true;
  v.held = false;
  v.fast = false;
  v.stage = 'atk';
  v.note = note & 127;
  v.vel = Math.max(0, Math.min(1, +vel || 0.8));
  v.env = 0;
  v.age = 0;
  v.phase = 0;
  v.step = 0;
  v.idx = 0;
  v.framePhase = 0;
  v.hold = 0;
  v.holdPhase = 0;
  v.lp = 0;
  v.fb.fill(0);
  v.fbPos = 0;
  v.y.forEach(s => { s.y1 = 0; s.y2 = 0; });
  v.pan = ((eng.voices.indexOf(v) - 2.5) / 2.5) * 0.4;
}

function releaseOne(eng, note) {
  for (let i = 0; i < VOICES; i++) {
    const v = eng.voices[i];
    if (!v.on || v.note !== (note & 127)) continue;
    if (eng.sus) { v.held = true; v.on = false; continue; }
    if (v.stage === 'rel' || v.stage === 'off') continue;
    v.stage = 'rel';
    v.on = false;
  }
}

function releaseAll(eng, fast) {
  for (let i = 0; i < VOICES; i++) {
    const v = eng.voices[i];
    if (v.stage === 'off') continue;
    v.stage = 'rel';
    v.on = false;
    v.held = false;
    if (fast) v.fast = true;
  }
}

function releaseSus(eng) {
  for (let i = 0; i < VOICES; i++) {
    const v = eng.voices[i];
    if (!v.held) continue;
    v.held = false;
    if (v.stage !== 'off' && v.stage !== 'rel') v.stage = 'rel';
  }
}

function sounding(eng) {
  let n = 0;
  for (let i = 0; i < VOICES; i++) if (eng.voices[i].stage !== 'off') n++;
  return n;
}

function ensureDrone(eng) {
  if (!eng.patch.run || !eng.active || eng.killed) return;
  for (let i = 0; i < VOICES; i++) if (eng.voices[i].stage !== 'off') return;
  trigger(eng, 60, 0.7);
}

export function renderPhantastron(eng, L, R) {
  const frames = L.length;
  const sr = eng.sr;
  const p = eng.patch;
  const level = Math.max(0, Math.min(1, p.level));
  const phrase = eng.phrase;
  const tone = p.cart === 'tone';
  ensureDrone(eng);
  const atk = 1 - Math.exp(-1 / (0.012 * sr));
  const rel = 1 - Math.exp(-1 / (0.07 * sr));
  const relFast = 1 - Math.exp(-1 / (0.012 * sr));
  let peak = 0;
  for (let i = 0; i < frames; i++) {
    eng.lfsr = (eng.lfsr >> 1) | ((((eng.lfsr ^ (eng.lfsr >> 2) ^ (eng.lfsr >> 3) ^ (eng.lfsr >> 5)) & 1) << 15) >>> 0);
    const bit = eng.lfsr & 1;
    eng.nse += (bit - eng.nse) * 0.02;
    eng.clkPhase += 6.5 / sr;
    if (eng.clkPhase >= 1) eng.clkPhase -= 1;
    const bent = bendRaw(p, { clk: eng.clkPhase < 0.5 ? 1 : 0, nse: eng.nse, out: eng.outEnv });
    const mw = eng.mw;
    const clock = Math.max(0.05, Math.min(6, bent.clock * (1 + mw * 0.35)));
    const feedback = Math.max(0, Math.min(0.92, bent.feedback + mw * 0.25));
    const semi = bent.pitch + eng.bend * 2;
    const win = loopWindow(bent.loop, phrase.length);
    let l = 0;
    let r = 0;
    for (let vi = 0; vi < VOICES; vi++) {
      const v = eng.voices[vi];
      if (v.stage === 'off') continue;
      v.age++;
      if (v.stage === 'atk') {
        v.env += (1 - v.env) * atk;
        if (v.env > 0.98) v.stage = 'sus';
      } else if (v.stage === 'rel') {
        v.env += (0 - v.env) * (v.fast ? relFast : rel);
        if (v.env < 1e-4) {
          v.stage = 'off';
          v.env = 0;
          v.fast = false;
          v.lp = 0;
          v.hold = 0;
          continue;
        }
      }
      v.framePhase += (clock * 14) / sr;
      if (v.framePhase >= 1) {
        v.framePhase -= 1;
        v.step++;
        v.idx = bent.loop >= 0.35 ? (v.step % win) : (v.step % phrase.length);
      }
      const phone = PHONES[phrase[v.idx] % PHONES.length];
      const hz = midiHz(v.note + semi) * clock;
      v.phase += hz / sr;
      if (v.phase >= 1) v.phase -= 1;
      v.lfsr = (v.lfsr >> 1) | ((((v.lfsr ^ (v.lfsr >> 1) ^ (v.lfsr >> 4)) & 1) << 15) >>> 0);
      const noise = (v.lfsr & 1) ? 1 : -1;
      const nMix = Math.max(0, Math.min(1, tone ? phone.n * 0.25 : Math.max(phone.n, p.noise * 0.65)));
      let exc;
      if (tone) exc = Math.sin(2 * Math.PI * v.phase);
      else {
        const impulse = v.phase < hz / sr ? 1 : 0;
        exc = impulse * (1 - nMix) + noise * nMix * 0.35;
      }
      const delayed = v.fb[v.fbPos];
      if (feedback > 0.001) exc += delayed * feedback;
      let sig;
      if (tone && feedback < 0.001) {
        sig = exc;
      } else {
        const track = Math.pow(2, (v.note - 60) / 48);
        const open = 0.55 + bent.form * 1.15;
        const a = resTick(v.y[0], exc, phone.f[0] * open * track, phone.bw, sr);
        const b = resTick(v.y[1], exc, phone.f[1] * open * track, phone.bw * 1.3, sr);
        const c = resTick(v.y[2], exc, phone.f[2] * open, phone.bw * 1.6, sr);
        sig = tone ? exc * 0.85 + (a + b * 0.45) * 0.08 : (a + b * 0.62 + c * 0.28) * 0.55;
        if (feedback > 0.001) sig = soft(sig);
      }
      sig = crush(sig, bent.bits);
      v.holdPhase += (7200 * clock) / sr;
      if (v.holdPhase >= 1) {
        v.holdPhase -= Math.floor(v.holdPhase);
        v.hold = sig;
      }
      const cut = 0.18 + 0.55 * Math.min(1, clock / 2);
      v.lp += (v.hold - v.lp) * cut;
      sig = v.lp;
      v.fb[v.fbPos] = feedback > 0.001 ? soft(sig) : sig * 0.2;
      v.fbPos++;
      if (v.fbPos >= v.fb.length) v.fbPos = 0;
      const g = v.env * v.vel * (tone ? 0.42 : 0.34);
      const side = v.pan;
      l += sig * g * (1 - Math.max(0, side));
      r += sig * g * (1 + Math.min(0, side));
    }
    l *= level;
    r *= level;
    l = soft(l * 1.15);
    r = soft(r * 1.15);
    if (!isFinite(l)) l = 0;
    if (!isFinite(r)) r = 0;
    L[i] = l;
    R[i] = r;
    const al = l < 0 ? -l : l;
    const ar = r < 0 ? -r : r;
    if (al > peak) peak = al;
    if (ar > peak) peak = ar;
    const envIn = al > ar ? al : ar;
    eng.outEnv += (envIn - eng.outEnv) * 0.01;
  }
  eng.peak = peak;
  eng.played += frames;
  eng.meterN += frames;
  if (eng.meterN >= 1024 && eng.onMeter) {
    eng.meterN = 0;
    eng.onMeter({ t: 'meter', voices: sounding(eng), peak: eng.peak, cpu: eng.cpu });
  }
}

export function postPhantastron(eng, msg) {
  if (!msg || !msg.t) return;
  if (msg.t === 'patch') {
    eng.patch = normalizePhantastron(msg.p);
    eng.phrase = phraseOf(eng.patch);
    if (!eng.patch.run) eng.killed = false;
    return;
  }
  if (msg.t === 'on') {
    eng.killed = false;
    trigger(eng, msg.n | 0, msg.v == null ? 0.8 : msg.v);
    return;
  }
  if (msg.t === 'off') {
    releaseOne(eng, msg.n | 0);
    return;
  }
  if (msg.t === 'bend') {
    eng.bend = Math.max(-1, Math.min(1, +msg.v || 0));
    return;
  }
  if (msg.t === 'mw') {
    eng.mw = Math.max(0, Math.min(1, +msg.v || 0));
    return;
  }
  if (msg.t === 'sus') {
    eng.sus = !!msg.on;
    if (!eng.sus) releaseSus(eng);
    return;
  }
  if (msg.t === 'panic') {
    eng.sus = false;
    eng.killed = true;
    releaseAll(eng, true);
    return;
  }
  if (msg.t === 'active') {
    eng.active = !!msg.on;
    if (!eng.active) {
      eng.sus = false;
      eng.killed = true;
      releaseAll(eng, true);
    } else eng.killed = false;
  }
}
