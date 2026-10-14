// Dekatron voice engine. Original analog-style drum synthesis at 2x, with a sample clock
// for the pattern. No library code: the shapes (a pitch that falls, noise through a band,
// a cluster of noise bursts, a short wood block) are the ordinary analog-drum vocabulary,
// written here from that description. PolyBLEP is the published band-limited step correction.
// The half-band is a windowed sinc we design in this file. Not a port of any drum model.

export const VOICES = ['kick', 'snare', 'hatC', 'hatO', 'clap', 'tom', 'rim'];
const HAT = { hatC: 'hatO', hatO: 'hatC' };
const RATIOS = [1, 1.37, 1.63, 1.97, 2.41, 2.93];

// Step i (0-based) lands this many seconds after the pattern starts.
// Straight sixteenths when swing is 0. Swing delays every offbeat (odd i) by swing/3 of
// a sixteenth, so swing 1 is a triplet: the offbeat at 4/3 of a sixteenth, the next
// on-beat still on the grid. The pattern length does not change the loop period.
export function stepSeconds(i, bpm, swing) {
  const sixteenth = 60 / bpm / 4;
  return sixteenth * (i + ((i & 1) ? swing / 3 : 0));
}

function besselI0(x) {
  let s = 1, t = 1;
  for (let k = 1; k < 24; k++) { t *= (x / (2 * k)) * (x / (2 * k)); s += t; }
  return s;
}
// Odd-length half-band lowpass. DC gain is 1 after normalisation, so the decimator
// keeps the level of the 2x stream.
export function halfbandTaps(N, beta) {
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

function noise(v) {
  let x = v.seed >>> 0;
  x ^= x << 13; x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5; x >>>= 0;
  v.seed = x || 1;
  return (x & 65535) / 32768 - 1;
}
function polyblep(t, dt) {
  if (dt <= 0 || dt >= 0.5) return 0;
  if (t < dt) { const x = t / dt; return x + x - x * x - 1; }
  if (t > 1 - dt) { const x = (t - 1) / dt; return x * x + x + x + 1; }
  return 0;
}
function square(ph, dt) {
  let y = ph < 0.5 ? 1 : -1;
  y += polyblep(ph, dt);
  y -= polyblep(ph + 0.5 >= 1 ? ph + 0.5 - 1 : ph + 0.5, dt);
  return y;
}
function tri(ph) { return ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph; }
function wrap(ph) { return ph >= 1 ? ph - 1 : ph < 0 ? ph + 1 : ph; }
function soft(x) { const a = Math.abs(x); return a < 1e-8 ? 0 : x / (1 + a); }
function band(v, x, fc, q, sr) {
  const f = 2 * Math.sin(Math.PI * Math.min(fc, sr * 0.42) / sr);
  const d = Math.min(1.8, 2 * (1 - Math.min(0.96, q)));
  v.lp += f * v.bp;
  const hp = x - v.lp - d * v.bp;
  v.bp += f * hp;
  if (v.bp > 3 || v.bp < -3) { v.bp = Math.max(-3, Math.min(3, v.bp)); v.lp *= 0.5; }
  return v.bp;
}
function hip(v, x, fc, sr) {
  const a = Math.exp(-2 * Math.PI * Math.min(fc, sr * 0.45) / sr);
  const y = a * (v.hy + x - v.hx);
  v.hx = x; v.hy = y;
  return y;
}

function voice() {
  return {
    on: 0, age: 0, vel: 0, dying: 0, choke: 1, seed: 1,
    ph: 0, ph2: 0, phs: new Float64Array(6),
    lp: 0, bp: 0, hx: 0, hy: 0,
  };
}

function killFilters(v) { v.lp = 0; v.bp = 0; v.hx = 0; v.hy = 0; }

function trigger(id, v, vel) {
  v.on = 1; v.age = 0; v.vel = Math.max(0, Math.min(1.5, vel));
  v.dying = 0; v.choke = 1;
  v.ph = 0; v.ph2 = 0;
  if (id === 'hatC' || id === 'hatO') { /* keep the metal's phase: a re-hit shouldn't reset the clang to a click */ }
  else v.phs.fill(0);
  if (id === 'kick' || id === 'tom') killFilters(v);
  v.seed = (v.seed ^ 0x9e3779b9) >>> 0 || 1;
}

function choke(v) { if (v.on) v.dying = 1; }

// One 2x-rate sample. p is the voice's patch object {tune, decay, color, attack, level}.
function sampleVoice(id, v, p, sr) {
  if (!v.on) return 0;
  if (v.dying) {
    v.choke *= Math.exp(-1 / (sr * 0.0016));
    if (v.choke < 0.002) { v.on = 0; v.choke = 0; return 0; }
  }
  const age = v.age++;
  const tune = Math.max(20, p.tune || 100);
  const decay = Math.max(0.008, p.decay || 0.2);
  const color = Math.max(0, Math.min(1, p.color || 0));
  const attack = Math.max(0, Math.min(1, p.attack || 0));
  let y = 0;
  if (id === 'kick' || id === 'tom') {
    const sweep = id === 'kick' ? 1 + attack * 7 : 1 + attack * 4;
    const pt = id === 'kick' ? 0.018 + attack * 0.04 : 0.02 + attack * 0.045;
    const f = tune * (1 + (sweep - 1) * Math.exp(-age / (sr * pt)));
    v.ph = wrap(v.ph + f / sr);
    const body = Math.sin(2 * Math.PI * v.ph) * Math.exp(-age / (sr * decay));
    const click = hip(v, noise(v), 900 + color * 5000, sr) * Math.exp(-age / (sr * (id === 'kick' ? 0.0026 : 0.004))) * (0.15 + color * 0.9);
    y = Math.tanh(body * (id === 'kick' ? 1.55 : 1.35) + click * 0.55);
    if (age > sr * (decay + 0.05) && Math.abs(body) < 1e-4) v.on = 0;
  } else if (id === 'snare') {
    v.ph = wrap(v.ph + tune / sr);
    const body = tri(v.ph) * Math.exp(-age / (sr * (0.018 + attack * 0.14))) * (1.05 - color * 0.7);
    const ns = band(v, noise(v), 900 + color * 5200, 0.55 + color * 0.35, sr);
    const ne = Math.exp(-age / (sr * decay));
    y = body * 0.72 + ns * ne * (0.55 + color * 0.7);
    if (age > sr * (decay + 0.08)) v.on = 0;
  } else if (id === 'hatC' || id === 'hatO') {
    let s = 0;
    for (let i = 0; i < 6; i++) {
      const dt = Math.min(0.45, tune * RATIOS[i] / sr);
      v.phs[i] = wrap(v.phs[i] + dt);
      s += square(v.phs[i], dt);
    }
    s = hip(v, s / 6, 1800 + color * 7000, sr);
    y = s * Math.exp(-age / (sr * decay)) * (0.85 + color * 0.3) * v.choke;
    if (age > sr * (decay + 0.02)) v.on = 0;
  } else if (id === 'clap') {
    const spread = 0.007 + attack * 0.018;
    const t = age / sr;
    let e = 0;
    for (let b = 0; b < 4; b++) {
      const u = t - spread * b * (b === 3 ? 1.35 : 1);
      if (u >= 0) e += Math.exp(-u / 0.0028);
    }
    const tail = t - spread * 3.5;
    if (tail > 0) e += 0.9 * Math.exp(-tail / decay);
    const ns = band(v, noise(v), tune, 0.7 + color * 1.4, sr);
    y = ns * e * 0.42;
    if (t > decay + spread * 4 + 0.05) v.on = 0;
  } else if (id === 'rim') {
    v.ph = wrap(v.ph + tune / sr);
    v.ph2 = wrap(v.ph2 + tune * 1.47 / sr);
    const ae = Math.exp(-age / (sr * decay));
    const wood = tri(v.ph) * 0.62 + tri(v.ph2) * 0.38;
    const tick = noise(v) * Math.exp(-age / (sr * 0.0018)) * (0.25 + color);
    y = wood * ae * 0.9 + tick * 0.45;
    if (age > sr * (decay + 0.02)) v.on = 0;
  }
  if (!isFinite(y)) { v.on = 0; return 0; }
  return y * v.vel;
}

function readSeq(p) {
  const s = (p && p.seq) || {};
  return {
    bpm: Math.max(40, Math.min(240, +s.bpm || 118)),
    swing: Math.max(0, Math.min(1, +s.swing || 0)),
    length: Math.max(1, Math.min(16, (+s.length | 0) || 16)),
    accentAmt: Math.max(0, Math.min(1, +s.accentAmt || 0)),
    clock: s.clock === 'external' ? 'external' : 'internal',
    level: Math.max(0, Math.min(1, p && p.level != null ? +p.level : 0.85)),
  };
}

export function createDrumEngine(sampleRate, patch) {
  const taps = halfbandTaps(31, 7.2);
  const voices = {};
  VOICES.forEach((id, i) => { const v = voice(); v.seed = (0x1234567 + i * 997) >>> 0; voices[id] = v; });
  const eng = {
    sr: sampleRate,
    sr2: sampleRate * 2,
    P: patch || {},
    active: true,
    voices,
    decL: createDecimator(taps),
    decR: createDecimator(taps),
    playing: false,
    armed: false,
    stepCount: 0,
    origin: 0,
    nextFrame: 0,
    queue: [],
    soon: [],
    meterN: 0,
    cpuMs: 0,
    cpuFrames: 0,
    accN: 0,
    lowAcc: 0,
    highAcc: 0,
    onMeter: null,
    dcL: 0, dcLx: 0, dcR: 0, dcRx: 0,
  };
  return eng;
}

function seqOf(eng) { return readSeq(eng.P); }

function fireStep(eng, index) {
  const P = eng.P || {}, seq = seqOf(eng);
  const steps = P.steps || {}, accent = P.accent || [];
  const boosted = accent[index] ? 1 : 0;
  const vel = Math.min(1.4, 0.92 * (1 + boosted * seq.accentAmt));
  // A closed hat and an open hat on the same step: the closed one wins, the way a
  // closed hat cuts the open one when they are asked for together.
  const hatsTogether = steps.hatC && steps.hatC[index] && steps.hatO && steps.hatO[index];
  VOICES.forEach(id => {
    if (hatsTogether && id === 'hatO') return;
    const row = steps[id];
    if (!row || !row[index]) return;
    const vp = (P.voices && P.voices[id]) || {};
    if ((+vp.level || 0) <= 0) return;
    if (HAT[id]) choke(eng.voices[HAT[id]]);
    trigger(id, eng.voices[id], vel);
  });
  if (eng.onStep) eng.onStep(index, seq.length);
}

function handle(eng, m, frame) {
  if (!m || !m.t) return;
  if (m.t === 'patch' && m.p) { eng.P = m.p; return; }
  if (m.t === 'trig') {
    const id = m.voice;
    if (!eng.voices[id]) return;
    if (HAT[id]) choke(eng.voices[HAT[id]]);
    trigger(id, eng.voices[id], m.v == null ? 0.9 : +m.v);
    return;
  }
  if (m.t === 'transport') {
    const seq = seqOf(eng);
    if (m.playing) {
      eng.armed = true;
      eng.stepCount = 0;
      eng.origin = frame;
      eng.nextFrame = frame;
      eng.playing = seq.clock === 'internal';
    } else {
      eng.playing = false; eng.armed = false; eng.stepCount = 0;
      if (eng.onStep) eng.onStep(-1, seq.length);
    }
    return;
  }
  if (m.t === 'tick') {
    const seq = seqOf(eng);
    if (!eng.armed || seq.clock !== 'external') return;
    const index = eng.stepCount % seq.length;
    fireStep(eng, index);
    eng.stepCount++;
    return;
  }
  if (m.t === 'panic') {
    eng.playing = false; eng.armed = false;
    VOICES.forEach(id => { eng.voices[id].on = 0; });
    return;
  }
  if (m.t === 'active') {
    eng.active = !!m.on;
    if (!eng.active) { eng.playing = false; eng.armed = false; if (eng.onStep) eng.onStep(-1, seqOf(eng).length); }
  }
}

// Render n output frames starting at absolute frame `start` into outL/outR (length n).
export function renderDrum(eng, outL, outR, start) {
  const t0 = Date.now();
  const n = outL.length;
  const sr2 = eng.sr2;
  const L2 = eng._L2 && eng._L2.length === n * 2 ? eng._L2 : (eng._L2 = new Float64Array(n * 2));
  const R2 = eng._R2 && eng._R2.length === n * 2 ? eng._R2 : (eng._R2 = new Float64Array(n * 2));
  L2.fill(0); R2.fill(0);
  // Messages posted since the last block land on the first frame of this one.
  if (eng.soon.length) {
    const soon = eng.soon; eng.soon = [];
    soon.forEach(m => handle(eng, m, start));
  }
  const q = eng.queue;
  q.sort((a, b) => (a.at || 0) - (b.at || 0));
  let qi = 0;
  const P = () => eng.P || {};
  const seq = () => seqOf(eng);
  let any = false;
  for (let i = 0; i < n; i++) {
    const frame = start + i;
    while (qi < q.length && (q[qi].at || 0) <= frame) handle(eng, q[qi++], frame);
    if (eng.playing) {
      const s = seq();
      let guard = 0;
      while (frame >= eng.nextFrame && guard++ < 3) {
        fireStep(eng, eng.stepCount % s.length);
        eng.stepCount++;
        const at = eng.origin + stepSeconds(eng.stepCount, s.bpm, s.swing) * eng.sr;
        eng.nextFrame = Math.round(at);
        if (eng.nextFrame <= frame) eng.nextFrame = frame + 1;
      }
    }
    const patch = P();
    const voices = patch.voices || {};
    let l = 0, r = 0;
    for (let k = 0; k < VOICES.length; k++) {
      const id = VOICES[k];
      const vp = voices[id] || {};
      const level = Math.max(0, Math.min(1, +vp.level || 0));
      if (!eng.voices[id].on || level <= 0) continue;
      any = true;
      const pan = Math.max(-1, Math.min(1, +vp.pan || 0));
      const y1 = sampleVoice(id, eng.voices[id], vp, sr2);
      const y2 = sampleVoice(id, eng.voices[id], vp, sr2);
      const gL = Math.cos((pan + 1) * Math.PI * 0.25) * level;
      const gR = Math.sin((pan + 1) * Math.PI * 0.25) * level;
      const o = i * 2;
      L2[o] += y1 * gL; R2[o] += y1 * gR;
      L2[o + 1] += y2 * gL; R2[o + 1] += y2 * gR;
      if (id === 'kick' || id === 'tom') { eng.lowAcc += y1 * y1; }
      else { eng.highAcc += y1 * y1; }
      eng.accN++;
    }
  }
  if (qi) q.splice(0, qi);
  const master = seq().level;
  for (let i = 0; i < n * 2; i++) { L2[i] = soft(L2[i] * master); R2[i] = soft(R2[i] * master); }
  eng.decL.run(L2, outL); eng.decR.run(R2, outR);
  // 15 Hz blocker, after the decimator. Asymmetric clicks otherwise leave a offset.
  const a = Math.exp(-2 * Math.PI * 15 / eng.sr);
  let xl = eng.dcLx, yl = eng.dcL, xr = eng.dcRx, yr = eng.dcR;
  for (let i = 0; i < n; i++) {
    const l = outL[i], r = outR[i];
    yl = l - xl + a * yl; xl = l;
    yr = r - xr + a * yr; xr = r;
    // The half-band can ring a little past the soft clip. Hold the output at full scale.
    outL[i] = yl > 1 ? 1 : yl < -1 ? -1 : yl;
    outR[i] = yr > 1 ? 1 : yr < -1 ? -1 : yr;
  }
  eng.dcLx = xl; eng.dcL = yl; eng.dcRx = xr; eng.dcR = yr;
  if (!any && !eng.playing && !q.length) { /* tails done: the next empty blocks are cheap */ }
  eng.meterN += n; eng.cpuMs += Date.now() - t0; eng.cpuFrames += n;
  if (eng.onMeter && eng.meterN >= eng.sr / 30) {
    let sounding = 0;
    VOICES.forEach(id => { if (eng.voices[id].on) sounding++; });
    const s = seq();
    eng.onMeter({
      t: 'meter', dev: 'dekatron',
      step: eng.armed ? (eng.stepCount - 1) % s.length : -1,
      length: s.length, playing: !!eng.playing || (eng.armed && s.clock === 'external'),
      voices: sounding,
      v1: Math.sqrt(eng.lowAcc / Math.max(1, eng.accN)),
      v2: Math.sqrt(eng.highAcc / Math.max(1, eng.accN)),
      cpu: eng.cpuFrames ? eng.cpuMs / (eng.cpuFrames / eng.sr * 1000) : 0,
    });
    eng.meterN = 0; eng.lowAcc = 0; eng.highAcc = 0; eng.accN = 0;
    if (eng.cpuFrames > eng.sr) { eng.cpuMs *= 0.5; eng.cpuFrames *= 0.5; }
  }
}

export function postDrum(eng, m) {
  if (!m) return;
  if (m.at == null) eng.soon.push(m);
  else eng.queue.push(m);
}
