// Additron voice. Original additive organ.
//
// Sixteen sines, one envelope each. The 8' stop is the note you play; the 16'
// stop is an octave down, and the higher partials follow. A positive tilt makes
// the upper partials die faster, so a bright attack settles into a darker hold.
// The rotor is a horn and a drum: a crossover, two delay lines whose length
// swings (the Doppler), and a level that turns with them. Chorale, tremolo,
// and brake are speeds of that swing. Nothing here is taken from a named
// instrument or a named speaker.

import { normalizeAdditron, spectrumOf, PARTS } from './additron.js';

export const VOICES = 8;

const SINE_N = 2048;
const SINE = new Float32Array(SINE_N + 1);
for (let i = 0; i <= SINE_N; i++) SINE[i] = Math.sin((i / SINE_N) * Math.PI * 2);

const DELAY_N = 4096;
const PERC_PART = { off: -1, '2': 3, '3': 5, '5': 9 };

function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }

function sine(phase) {
  const x = phase * SINE_N;
  const i = x | 0;
  const f = x - i;
  return SINE[i] + (SINE[i + 1] - SINE[i]) * f;
}

function voice() {
  return {
    on: false,
    pending: false,
    dead: true,
    note: 60,
    vel: 0,
    age: 0,
    phase: new Float64Array(PARTS),
    env: new Float32Array(PARTS),
    atk: new Uint8Array(PARTS),
    perc: 0,
    percIn: 0,
    click: 0,
    rng: 1,
  };
}

function speedTargets(speed, wheel) {
  if (speed === 'brake') return { h: 0, l: 0 };
  if (speed === 'tremolo') return { h: 6.6, l: 5.4 };
  const w = clamp(+wheel || 0, 0, 1);
  return { h: 0.82 + (6.6 - 0.82) * w, l: 0.66 + (5.4 - 0.66) * w };
}

function partialLaw(p, sr) {
  const atkStep = new Float32Array(PARTS);
  const decC = new Float32Array(PARTS);
  const relC = new Float32Array(PARTS);
  const sus = new Float32Array(PARTS);
  const tilt = clamp(p.tilt, -1, 1);
  for (let k = 0; k < PARTS; k++) {
    const atk = Math.max(0.001, p.attack * (1 + k * 0.035));
    const dec = Math.max(0.02, p.decay * Math.exp(-tilt * k * 0.28));
    const rel = Math.max(0.012, p.release * Math.exp(-Math.max(0, tilt) * k * 0.12));
    const bright = Math.exp(-Math.max(0, tilt) * k * 0.22);
    atkStep[k] = 1 / (atk * sr);
    decC[k] = 1 - Math.exp(-1 / (dec * sr));
    relC[k] = Math.exp(-1 / (rel * sr));
    sus[k] = clamp(p.sustain, 0, 1) * bright;
  }
  return { atkStep, decC, relC, sus };
}

function applyPatch(eng, patch, snap) {
  eng.P = normalizeAdditron(patch);
  const spec = spectrumOf(eng.P);
  for (let i = 0; i < PARTS; i++) eng.amp[i] = spec[i];
  const law = partialLaw(eng.P, eng.sr);
  eng.atkStep = law.atkStep;
  eng.decC = law.decC;
  eng.relC = law.relC;
  eng.sus = law.sus;
  eng.percK = PERC_PART[eng.P.percHarm] == null ? -1 : PERC_PART[eng.P.percHarm];
  eng.percC = Math.exp(-1 / (Math.max(0.02, eng.P.percDecay) * eng.sr));
  eng.clickC = Math.exp(-1 / (0.0028 * eng.sr));
  if (snap) {
    const t = speedTargets(eng.P.speed, eng.wheel);
    eng.rateH = t.h;
    eng.rateL = t.l;
  }
}

export function createAdditronEngine(sr, patch) {
  const eng = {
    sr: sr || 48000,
    P: null,
    amp: new Float32Array(PARTS),
    atkStep: null,
    decC: null,
    relC: null,
    sus: null,
    percK: -1,
    percC: 0,
    clickC: 0,
    voices: Array.from({ length: VOICES }, voice),
    active: true,
    susPedal: false,
    bend: 0,
    wheel: 0,
    rateH: 0.82,
    rateL: 0.66,
    hornPh: 0,
    drumPh: 0,
    vibPh: 0,
    low: 0,
    hornBuf: new Float32Array(DELAY_N),
    drumBuf: new Float32Array(DELAY_N),
    dw: 0,
    peak: 0,
    sounding: 0,
    played: 0,
    meterN: 0,
    onMeter: null,
  };
  eng.xA = 1 - Math.exp(-2 * Math.PI * 780 / eng.sr);
  eng.glide = 1 - Math.exp(-1 / (0.18 * eng.sr));
  applyPatch(eng, patch, true);
  return eng;
}

function alloc(eng) {
  let free = -1;
  let oldest = 0;
  for (let i = 0; i < VOICES; i++) {
    const v = eng.voices[i];
    if (v.dead) { free = i; break; }
    if (eng.voices[i].age > eng.voices[oldest].age) oldest = i;
  }
  return eng.voices[free >= 0 ? free : oldest];
}

function noteOn(eng, note, vel) {
  const n = note & 127;
  let v = null;
  for (let i = 0; i < VOICES; i++) {
    if (eng.voices[i].on && eng.voices[i].note === n) { v = eng.voices[i]; break; }
  }
  if (!v) v = alloc(eng);
  v.on = true;
  v.pending = false;
  v.dead = false;
  v.note = n;
  v.vel = clamp(vel == null ? 0.8 : +vel, 0, 1);
  v.age = 0;
  v.perc = 1;
  v.percIn = 0;
  v.click = 1;
  for (let k = 0; k < PARTS; k++) {
    v.env[k] = 0;
    v.atk[k] = 1;
  }
}

function noteOff(eng, note) {
  const n = note & 127;
  for (let i = 0; i < VOICES; i++) {
    const v = eng.voices[i];
    if (v.dead || v.note !== n || !v.on) continue;
    if (eng.susPedal) { v.pending = true; continue; }
    v.on = false;
    v.pending = false;
  }
}

function panic(eng) {
  for (let i = 0; i < VOICES; i++) {
    const v = eng.voices[i];
    v.on = false;
    v.pending = false;
    v.dead = true;
    v.perc = 0;
    v.click = 0;
    v.env.fill(0);
  }
}

function delayRead(buf, write, delay) {
  let x = write - delay;
  const n = buf.length;
  x %= n;
  if (x < 0) x += n;
  const i0 = x | 0;
  let f = x - i0;
  const i1 = i0 + 1 >= n ? 0 : i0 + 1;
  return buf[i0] * (1 - f) + buf[i1] * f;
}

function shapeDrive(x, drive) {
  if (drive < 0.001) return x;
  const g = 1 + drive * 5;
  return Math.tanh(x * g) / Math.tanh(g);
}

function safe(x) {
  const a = x < 0 ? -x : x;
  if (a <= 0.8) return x;
  const s = x < 0 ? -1 : 1;
  return s * (0.8 + 0.18 * (1 - Math.exp(-(a - 0.8) * 3)));
}

export function renderAdditron(eng, L, R) {
  const frames = L.length;
  const sr = eng.sr;
  const P = eng.P;
  const nyq = 0.45;
  let peak = 0;
  let sounding = 0;
  const targets = P.rotor ? speedTargets(P.speed, eng.wheel) : { h: 0, l: 0 };
  const spread = clamp(P.spread, 0, 1);
  const ampDepth = (0.15 + 0.85 * spread) * 0.42;
  const delayDepth = (0.00025 + 0.00085 * spread);
  for (let i = 0; i < frames; i++) {
    eng.rateH += (targets.h - eng.rateH) * eng.glide;
    eng.rateL += (targets.l - eng.rateL) * eng.glide;
    if (P.rotor) {
      eng.hornPh += eng.rateH / sr;
      eng.drumPh += eng.rateL / sr;
      if (eng.hornPh >= 1) eng.hornPh -= 1;
      if (eng.drumPh >= 1) eng.drumPh -= 1;
    }
    eng.vibPh += 5.15 / sr;
    if (eng.vibPh >= 1) eng.vibPh -= 1;
    const vib = Math.sin(eng.vibPh * Math.PI * 2) * ((P.rotor ? 0 : eng.wheel * 0.35) + P.vib * 0.4);
    const semi = eng.bend * 2 + vib;
    let mix = 0;
    sounding = 0;
    for (let vi = 0; vi < VOICES; vi++) {
      const v = eng.voices[vi];
      if (v.dead) continue;
      v.age++;
      const hz = 440 * Math.pow(2, (v.note + semi - 69) / 12);
      const base = hz / sr * 0.5;
      let sum = 0;
      let alive = v.on;
      const percOn = P.perc > 0 && eng.percK >= 0;
      const percAdd = percOn ? P.perc * Math.min(1, v.percIn) * v.perc : 0;
      if (percOn) {
        v.percIn += 1 / (sr * 0.003);
        v.perc *= eng.percC;
      } else v.perc = 0;
      for (let k = 0; k < PARTS; k++) {
        let e = v.env[k];
        if (v.atk[k]) {
          e += eng.atkStep[k];
          if (e >= 1) { e = 1; v.atk[k] = 0; }
        } else if (v.on) {
          e += (eng.sus[k] - e) * eng.decC[k];
        } else {
          e *= eng.relC[k];
          if (e < 1e-4) e = 0;
        }
        v.env[k] = e;
        if (e > 1e-4) alive = true;
        const inc = base * (k + 1);
        v.phase[k] += inc;
        if (v.phase[k] >= 1) v.phase[k] -= 1;
        let g = eng.amp[k] * e;
        if (k === eng.percK) g += percAdd;
        if (g < 1e-5 || inc >= nyq || inc < 0) continue;
        sum += sine(v.phase[k]) * g;
      }
      if (P.click > 0 && v.click > 1e-4) {
        v.rng = (Math.imul(v.rng, 1664525) + 1013904223) >>> 0;
        const nz = (v.rng / 4294967296) * 2 - 1;
        sum += nz * v.click * P.click * 0.22;
        v.click *= eng.clickC;
        alive = true;
      } else v.click = 0;
      if (percOn && v.perc > 1e-4) alive = true;
      if (!alive) { v.dead = true; v.on = false; continue; }
      sounding++;
      mix += sum * (0.25 + 0.75 * v.vel);
    }
    mix *= P.level * 0.34;
    eng.hornBuf[eng.dw] = 0;
    eng.drumBuf[eng.dw] = 0;
    let l;
    let r;
    if (!P.rotor) {
      l = mix;
      r = mix;
    } else {
      eng.low += (mix - eng.low) * eng.xA;
      const high = mix - eng.low;
      const leak = P.leak;
      const hornIn = high + eng.low * leak * 0.35;
      const drumIn = eng.low + high * leak * 0.2;
      eng.hornBuf[eng.dw] = hornIn;
      eng.drumBuf[eng.dw] = drumIn;
      const angH = eng.hornPh * Math.PI * 2 + Math.PI / 4;
      const angD = eng.drumPh * Math.PI * 2 + Math.PI / 4;
      const sH = Math.sin(angH);
      const cH = Math.cos(angH);
      const sD = Math.sin(angD);
      const cD = Math.cos(angD);
      const eq = 0.7071067811865476;
      const hDelayL = Math.max(1, (0.0022 + delayDepth * (sH - eq)) * sr);
      const hDelayR = Math.max(1, (0.0022 + delayDepth * (cH - eq)) * sr);
      const dDelayL = Math.max(1, (0.0028 + delayDepth * 1.1 * (sD - eq)) * sr);
      const dDelayR = Math.max(1, (0.0028 + delayDepth * 1.1 * (cD - eq)) * sr);
      const hL = delayRead(eng.hornBuf, eng.dw, hDelayL);
      const hR = delayRead(eng.hornBuf, eng.dw, hDelayR);
      const dL = delayRead(eng.drumBuf, eng.dw, dDelayL);
      const dR = delayRead(eng.drumBuf, eng.dw, dDelayR);
      const gHL = 0.78 + ampDepth * (sH - eq);
      const gHR = 0.78 + ampDepth * (cH - eq);
      const gDL = 0.82 + ampDepth * 0.7 * (sD - eq);
      const gDR = 0.82 + ampDepth * 0.7 * (cD - eq);
      l = hL * gHL + dL * gDL;
      r = hR * gHR + dR * gDR;
    }
    eng.dw++;
    if (eng.dw >= DELAY_N) eng.dw = 0;
    l = safe(shapeDrive(l, P.drive));
    r = safe(shapeDrive(r, P.drive));
    if (!Number.isFinite(l)) l = 0;
    if (!Number.isFinite(r)) r = 0;
    L[i] = l;
    R[i] = r;
    const al = l < 0 ? -l : l;
    const ar = r < 0 ? -r : r;
    if (al > peak) peak = al;
    if (ar > peak) peak = ar;
  }
  eng.peak = peak;
  eng.sounding = sounding;
  eng.played += frames;
  eng.meterN += frames;
}

export function postAdditron(eng, msg) {
  if (!msg || !msg.t) return;
  if (msg.t === 'patch') { applyPatch(eng, msg.p, false); return; }
  if (msg.t === 'on') { noteOn(eng, msg.n | 0, msg.v); return; }
  if (msg.t === 'off') { noteOff(eng, msg.n | 0); return; }
  if (msg.t === 'bend') { eng.bend = clamp(+msg.v || 0, -1, 1); return; }
  if (msg.t === 'mw') { eng.wheel = clamp(+msg.v || 0, 0, 1); return; }
  if (msg.t === 'sus') {
    eng.susPedal = !!msg.on;
    if (!eng.susPedal) {
      for (let i = 0; i < VOICES; i++) {
        const v = eng.voices[i];
        if (!v.pending) continue;
        v.pending = false;
        v.on = false;
      }
    }
    return;
  }
  if (msg.t === 'panic') { panic(eng); eng.sounding = 0; return; }
  if (msg.t === 'active') {
    eng.active = !!msg.on;
    if (!eng.active) panic(eng);
  }
}
