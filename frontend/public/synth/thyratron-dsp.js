// Thyratron voice. One monophonic note at 2x, then a half-band decimator.
//
// The ladder is an original four-pole. Each pole is a trapezoidal integrator
// (the published TPT lowpass), and the resonance loop is a saturating feedback
// around all four, solved with one Newton step. Pitch at full emphasis was
// measured here. Oscillator edges use the published polynomial step correction.
// No third-party synth code is copied here.

import { normalizeThy } from './thyratron.js';

const FOOT = { lo: 1 / 32, '32': 0.25, '16': 0.5, '8': 1, '4': 2, '2': 4 };

function bessel0(x) {
  let sum = 1, term = 1;
  const x2 = x * x;
  for (let k = 1; k <= 18; k++) {
    term *= x2 / (4 * k * k);
    sum += term;
  }
  return sum;
}

// Odd-length lowpass used as a 2x decimator. Unity gain at DC.
function designHalfband(N, beta) {
  const h = new Float64Array(N);
  const M = (N - 1) / 2;
  const i0 = bessel0(beta);
  let sum = 0;
  for (let n = 0; n < N; n++) {
    const k = n - M;
    const sinc = k === 0 ? 0.5 : Math.sin(Math.PI * k * 0.5) / (Math.PI * k);
    const ratio = k / M;
    const w = bessel0(beta * Math.sqrt(Math.max(0, 1 - ratio * ratio))) / i0;
    h[n] = sinc * w;
    sum += h[n];
  }
  for (let n = 0; n < N; n++) h[n] /= sum;
  return h;
}

const TAPS = designHalfband(27, 6.4);

function createHalfband() {
  const N = TAPS.length;
  const buf = new Float64Array(N);
  let w = 0;
  return {
    pair(x0, x1) {
      buf[w] = x0;
      w = w + 1 === N ? 0 : w + 1;
      buf[w] = x1;
      w = w + 1 === N ? 0 : w + 1;
      let acc = 0;
      let j = w;
      for (let k = 0; k < N; k++) {
        acc += TAPS[k] * buf[j];
        j = j + 1 === N ? 0 : j + 1;
      }
      return acc;
    },
  };
}

// Rational saturator. Flat near zero, approaches ±1, and matches the curve the
// ladder's pitch was tuned against.
export function tanhSat(x) {
  if (x >= 4) return 1;
  if (x <= -4) return -1;
  const x2 = x * x;
  return x * (27 + x2) / (27 + 9 * x2);
}

function polyblep(t, dt) {
  if (dt <= 0 || dt >= 0.5) return 0;
  if (t < dt) {
    const x = t / dt;
    return 2 * x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + 2 * x + 1;
  }
  return 0;
}

function saw(ph, dt) {
  return 2 * ph - 1 - polyblep(ph, dt);
}
function pulse(ph, dt, width) {
  let y = ph < width ? 1 : -1;
  y += polyblep(ph, dt);
  let ph2 = ph + 1 - width;
  if (ph2 >= 1) ph2 -= 1;
  y -= polyblep(ph2, dt);
  return y;
}
function tri(ph) {
  const up = ph < 0.5 ? ph * 2 : 2 - ph * 2;
  return up * 2 - 1;
}
function waveOf(kind, ph, dt) {
  if (kind === 'tri') return tri(ph);
  if (kind === 'square') return pulse(ph, dt, 0.5);
  if (kind === 'wide') return pulse(ph, dt, 0.28);
  if (kind === 'narrow') return pulse(ph, dt, 0.12);
  if (kind === 'mix') return 0.62 * saw(ph, dt) + 0.38 * tri(ph);
  return saw(ph, dt);
}

function noise(eng) {
  eng.seed = (Math.imul(eng.seed, 1664525) + 1013904223) >>> 0;
  return ((eng.seed >>> 8) / 8388607.5) - 1;
}

function mtof(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

// Four trapezoidal lowpasses with saturating feedback. `res` is 0..1.
// Full emphasis sits past the linear oscillation point; the saturator holds
// the amplitude, and the pitch stays on the cutoff.
function ladder(st, x, fc, res, drive, sr) {
  const cut = Math.min(Math.max(12, fc), sr * 0.42);
  const g = Math.tan(Math.PI * cut / sr);
  const G = g / (1 + g);
  const k = Math.max(0, Math.min(1, res)) * 4.6;
  const oG = 1 - G;
  let s0 = st[0], s1 = st[1], s2 = st[2], s3 = st[3];
  if (!isFinite(s0 + s1 + s2 + s3)) s0 = s1 = s2 = s3 = 0;
  const G2 = G * G, G3 = G2 * G, G4 = G3 * G;
  const S = G3 * oG * s0 + G2 * oG * s1 + G * oG * s2 + oG * s3;
  const drv = 0.62 + Math.max(0, Math.min(1, drive)) * 2.4;
  const xin = tanhSat(x * drv);
  let y = st[4];
  if (!isFinite(y)) y = 0;
  const th = tanhSat(y);
  const f = y - G4 * (xin - k * th) - S;
  const fp = 1 + G4 * k * (1 - th * th);
  y -= f / (fp > 1e-8 ? fp : 1);
  const u = xin - k * tanhSat(y);
  const y0 = G * u + oG * s0;
  const y1 = G * y0 + oG * s1;
  const y2 = G * y1 + oG * s2;
  const y3 = G * y2 + oG * s3;
  st[0] = 2 * y0 - s0;
  st[1] = 2 * y1 - s1;
  st[2] = 2 * y2 - s2;
  st[3] = 2 * y3 - s3;
  st[4] = y3;
  if (Math.abs(st[0]) < 1e-24) st[0] = 0;
  return y3;
}

function envNew() { return { v: 0, stage: 'off' }; }

function envAttack(e) {
  if (e.stage === 'off') e.v = 0;
  e.stage = 'att';
}
function envRelease(e) {
  if (e.stage === 'off') return;
  e.stage = 'rel';
}
function envRun(e, a, d, s, sr) {
  const atk = Math.max(0.001, a);
  const dec = Math.max(0.003, d);
  if (e.stage === 'att') {
    e.v += 1 / (atk * sr);
    if (e.v >= 1) { e.v = 1; e.stage = s >= 0.999 ? 'sus' : 'dec'; }
  } else if (e.stage === 'dec') {
    const coef = 1 - Math.exp(-1 / (dec * sr));
    e.v += (s - e.v) * coef;
    if (Math.abs(e.v - s) < 0.0008) { e.v = s; e.stage = 'sus'; }
  } else if (e.stage === 'sus') {
    e.v += (s - e.v) * 0.05;
  } else if (e.stage === 'rel') {
    const coef = 1 - Math.exp(-1 / (dec * sr));
    e.v += -e.v * coef;
    if (e.v < 1e-4) { e.v = 0; e.stage = 'off'; }
  } else e.v = 0;
  return e.v < 0 ? 0 : e.v;
}

function release(eng) {
  eng.gate = false;
  envRelease(eng.envA);
  envRelease(eng.envF);
}

function noteOn(eng, n, v) {
  n |= 0;
  if (n < 0 || n > 127) return;
  const vel = Math.max(0, Math.min(1, +v || 0));
  if (vel <= 0) { noteOff(eng, n); return; }
  const st = eng.stack;
  for (let i = st.length - 1; i >= 0; i--) if (st[i].n === n) st.splice(i, 1);
  st.push({ n, v: vel });
  const fresh = eng.envA.stage === 'off' || eng.envA.v < 0.0008;
  eng.target = n;
  eng.vel = vel;
  eng.gate = true;
  if (fresh || eng.P.glide <= 0.0005) eng.pitch = n;
  envAttack(eng.envA);
  envAttack(eng.envF);
  if (Math.abs(eng.f[4]) < 1e-3) eng.f[0] = 1e-4;
}

function noteOff(eng, n) {
  n |= 0;
  const st = eng.stack;
  let idx = -1;
  for (let i = 0; i < st.length; i++) if (st[i].n === n) idx = i;
  if (idx < 0) return;
  const wasTop = idx === st.length - 1;
  st.splice(idx, 1);
  if (!wasTop) return;
  if (st.length) {
    const top = st[st.length - 1];
    eng.target = top.n;
    eng.vel = top.v;
    return;
  }
  eng.gate = false;
  if (!eng.sustain) release(eng);
}

function panic(eng) {
  eng.stack.length = 0;
  eng.sustain = false;
  eng.gate = false;
  eng.envA.v = 0; eng.envA.stage = 'off';
  eng.envF.v = 0; eng.envF.stage = 'off';
  eng.f.fill(0);
  eng.fb.fill(0);
  eng.hpX = 0; eng.hpY = 0;
}

function handle(eng, m) {
  if (!m || !m.t) return;
  if (m.t === 'on') noteOn(eng, m.n, m.v == null ? 0.8 : m.v);
  else if (m.t === 'off') noteOff(eng, m.n);
  else if (m.t === 'bend') eng.bend = Math.max(-1, Math.min(1, +m.v || 0));
  else if (m.t === 'mw') eng.wheel = Math.max(0, Math.min(1, +m.v || 0));
  else if (m.t === 'sus') {
    eng.sustain = !!m.on;
    if (!eng.sustain && !eng.stack.length) release(eng);
  } else if (m.t === 'panic') panic(eng);
  else if (m.t === 'active') {
    eng.active = !!m.on;
    if (!eng.active) panic(eng);
  } else if (m.t === 'patch' && m.p) eng.P = normalizeThy(m.p);
}

export function postThy(eng, m) {
  if (!m) return;
  if (m.at == null) eng.soon.push(m);
  else eng.queue.push(m);
}

function oscHz(note, osc, sr2) {
  const ratio = FOOT[osc.range] || 1;
  const hz = mtof(note + osc.tune) * ratio;
  return Math.min(Math.max(0, hz), sr2 * 0.45);
}

function stepOsc(o, freq, sr2, kind) {
  const dt = freq <= 0 ? 0 : freq / sr2;
  if (dt > 0) {
    o.ph += dt;
    if (o.ph >= 1) o.ph -= 1;
  }
  return waveOf(kind, o.ph, dt);
}

function smooth(cur, target, coef) {
  return cur + (target - cur) * coef;
}

export function createThyEngine(sampleRate, patch) {
  const P = normalizeThy(patch || {});
  return {
    sr: sampleRate,
    sr2: sampleRate * 2,
    P,
    active: true,
    stack: [],
    target: 60,
    pitch: 60,
    vel: 0.8,
    gate: false,
    sustain: false,
    bend: 0,
    wheel: 0,
    seed: 0xA341316C,
    f: new Float64Array(5),
    o1: { ph: 0.17 },
    o2: { ph: 0.41 },
    o3: { ph: 0.05 },
    envA: envNew(),
    envF: envNew(),
    fb: new Float64Array(192),
    fbW: 0,
    hpX: 0,
    hpY: 0,
    decL: createHalfband(),
    decR: createHalfband(),
    cut: P.filt.cutoff,
    res: P.filt.res,
    drive: P.filt.drive,
    track: P.filt.track,
    envAmt: P.filt.env,
    l1: P.osc1.level,
    l2: P.osc2.level,
    l3: P.osc3.level,
    nLvl: P.mix.noise,
    fbLvl: P.mix.fb,
    outLvl: P.level,
    queue: [],
    soon: [],
    meterN: 0,
    cpuMs: 0,
    cpuFrames: 0,
    acc: 0,
    accN: 0,
    onMeter: null,
  };
}

// Render n output frames starting at absolute frame `start`.
export function renderThy(eng, outL, outR, start) {
  const t0 = Date.now();
  const n = outL.length;
  const sr = eng.sr;
  const sr2 = eng.sr2;
  if (eng.soon.length) {
    const soon = eng.soon;
    eng.soon = [];
    soon.forEach(m => handle(eng, m));
  }
  const sleeping = eng.active === false && eng.envA.stage === 'off' && !eng.stack.length && !eng.queue.length;
  if (sleeping) {
    if (!eng.toldSleep && eng.onMeter) {
      eng.toldSleep = true;
      eng.onMeter({ t: 'meter', dev: 'thyratron', voices: 0, notes: [], v1: 0, cpu: 0 });
    }
    for (let i = 0; i < n; i++) { outL[i] = 0; if (outR !== outL) outR[i] = 0; }
    return;
  }
  eng.toldSleep = false;
  const q = eng.queue;
  if (q.length > 1) q.sort((a, b) => (a.at || 0) - (b.at || 0));
  let qi = 0;
  const coef = 1 - Math.exp(-1 / (0.008 * sr));
  const hpA = Math.exp(-2 * Math.PI * 12 / sr2);
  for (let i = 0; i < n; i++) {
    const frame = (start || 0) + i;
    while (qi < q.length && (q[qi].at || 0) <= frame) handle(eng, q[qi++]);
    const P = eng.P;
    eng.cut = smooth(eng.cut, P.filt.cutoff, coef);
    eng.res = smooth(eng.res, P.filt.res, coef);
    eng.drive = smooth(eng.drive, P.filt.drive, coef);
    eng.track = smooth(eng.track, P.filt.track, coef);
    eng.envAmt = smooth(eng.envAmt, P.filt.env, coef);
    eng.l1 = smooth(eng.l1, P.osc1.level, coef);
    eng.l2 = smooth(eng.l2, P.osc2.level, coef);
    eng.l3 = smooth(eng.l3, P.osc3.level, coef);
    eng.nLvl = smooth(eng.nLvl, P.mix.noise, coef);
    eng.fbLvl = smooth(eng.fbLvl, P.mix.fb, coef);
    eng.outLvl = smooth(eng.outLvl, P.level, coef);

    const tau = P.glide;
    if (tau <= 0.0005) eng.pitch = eng.target;
    else eng.pitch += (eng.target - eng.pitch) * (1 - Math.exp(-1 / (tau * sr)));
    const ampEnv = envRun(eng.envA, P.loud.a, P.loud.d, P.loud.s, sr);
    const filtEnv = envRun(eng.envF, P.cont.a, P.cont.d, P.cont.s, sr);

    const key = eng.pitch + P.tune / 100;
    let over = 0;
    for (let k = 0; k < 2; k++) {
      const f3 = P.osc3.lfo ? Math.min(P.osc3.rate, sr2 * 0.2) : oscHz(key, P.osc3, sr2);
      const s3 = stepOsc(eng.o3, f3, sr2, P.osc3.wave);
      const nz = noise(eng);
      const mod = P.mod.src === 'noise' ? nz : s3;
      const played = key + eng.bend * P.bend + mod * eng.wheel * P.mod.pitch;
      const s1 = stepOsc(eng.o1, oscHz(played, P.osc1, sr2), sr2, P.osc1.wave);
      const s2 = stepOsc(eng.o2, oscHz(played, P.osc2, sr2), sr2, P.osc2.wave);
      const fb = eng.fb[eng.fbW];
      const mix = s1 * eng.l1 + s2 * eng.l2 + s3 * eng.l3 + nz * eng.nLvl + fb * eng.fbLvl;
      const cutMod = mod * eng.wheel * P.mod.cut;
      const fc = eng.cut * Math.pow(2, ((key - 60) / 12) * eng.track + filtEnv * eng.envAmt * 4 + cutMod);
      const seed = eng.res > 0.82 ? nz * 1.5e-5 : 0;
      let y = ladder(eng.f, mix + seed, fc, eng.res, eng.drive, sr2);
      const hp = hpA * (eng.hpY + y - eng.hpX);
      eng.hpX = y;
      eng.hpY = hp;
      y = hp * ampEnv * (0.32 + 0.68 * eng.vel);
      eng.fb[eng.fbW] = y;
      eng.fbW = eng.fbW + 1 === eng.fb.length ? 0 : eng.fbW + 1;
      over = k === 0 ? y : over;
      if (k === 1) {
        const scaled = y * eng.outLvl * 0.9;
        const a = over * eng.outLvl * 0.9;
        const b = scaled;
        const dec = eng.decL.pair(a, b);
        const clipped = dec > 1 ? 1 : dec < -1 ? -1 : dec;
        outL[i] = clipped;
        if (outR !== outL) outR[i] = clipped;
        eng.acc += clipped * clipped;
        eng.accN++;
      }
    }
  }
  if (qi) q.splice(0, qi);
  eng.meterN += n;
  eng.cpuMs += Date.now() - t0;
  eng.cpuFrames += n;
  if (eng.onMeter && eng.meterN >= sr / 30) {
    const sounding = eng.envA.v > 0.001 ? 1 : 0;
    eng.onMeter({
      t: 'meter', dev: 'thyratron',
      voices: sounding,
      notes: eng.stack.map(s => s.n),
      v1: Math.sqrt(eng.acc / Math.max(1, eng.accN)),
      cpu: eng.cpuFrames ? eng.cpuMs / (eng.cpuFrames / sr * 1000) : 0,
    });
    eng.meterN = 0; eng.acc = 0; eng.accN = 0;
    if (eng.cpuFrames > sr) { eng.cpuMs *= 0.5; eng.cpuFrames *= 0.5; }
  }
}
