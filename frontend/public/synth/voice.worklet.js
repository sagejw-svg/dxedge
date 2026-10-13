// Filament voice engine. One AudioWorkletProcessor runs every voice.
//
// Each voice runs at twice the output rate (OS = 2): oscillators, the V1 drive tube,
// the filter and the VCA. The voices are panned and summed at 2x, and one half-band
// FIR per channel brings the stereo sum back down. Oversampling the whole voice costs
// more than oversampling only the nonlinear parts, but it keeps every stage simple and
// the only decimators are the two on the sum.
//
//   osc 1, osc 2 (sync, FM, ring), sub, noise -> mixer -> V1 tube -> coupling cap
//   -> filter (Valve 12 or Ladder 24) -> VCA -> pan -> L/R (2x) -> half-band -> out
//
// Oscillators are band limited with BLEP (steps) and BLAMP (kinks) residuals applied
// across two samples, so each oscillator runs one sample behind. That delay is what
// lets hard sync, FM and the pulse edge all use the same correction.
//
// Filters are zero-delay-feedback (TPT) designs. The nonlinear parts are linearised at
// the previous sample and the loop is then solved exactly: one Newton step per sample.
//   Ladder 24: the transistor ladder after Teemu Voipio's "cheap non-linear ZDF" method.
//   Valve 12:  a 2-pole state variable lowpass whose resonance is positive feedback of
//              the band-pass through a tube curve (the same g(u) voicings as the rack),
//              a coupling-capacitor high-pass, and a supply-sag follower.
//
// Messages in (port): {t:'patch',p,load}, {t:'on',n,v}, {t:'off',n}, {t:'bend',v},
//   {t:'mw',v}, {t:'at',v}, {t:'sus',on}, {t:'panic'}. Any of them may carry at:<frame>
//   (an absolute frame, as currentFrame counts) to land on an exact sample; offline tests
//   pass a whole score that way in processorOptions.events.
// Messages out: {t:'meter', v1, v2, voices, cpu, notes} about 30 times a second.

const OS = 2;
const NV = 16;                         // voice pool (patch.voice.count picks how many are used)
const CTRL = 8;                        // control rate: every 8 output frames
const TWO_PI = Math.PI * 2;

// ---------- tube curves ----------
// H(u) = (g(u+b) - g(b)) / g'(b): the rack's asymmetric soft clipper re-centred on its bias
// point and normalised to unity slope. A drive gain G goes in front and 1/G after, so the
// small-signal gain stays 1 and drive only changes how early it bends.
const TT_N = 4096, TT_R = 16;          // table over u in [-16, 16]
function tubeTable(t, bias) {
  const b = bias * 0.08 + (t.b0 || 0);
  const g = u => { const k = u >= 0 ? t.kp : t.kn; return u / Math.pow(1 + Math.pow(Math.abs(k * u), t.h), 1 / t.h); };
  const e = 1e-4, sl = (g(b + e) - g(b - e)) / (2 * e), g0 = g(b);
  const tab = new Float32Array(TT_N);
  for (let i = 0; i < TT_N; i++) { const u = (i / (TT_N - 1) * 2 - 1) * TT_R; tab[i] = (g(u + b) - g0) / sl; }
  return tab;
}
const TT_SCALE = (TT_N - 1) / (2 * TT_R);
function tlook(tab, u) {               // value
  let p = (u + TT_R) * TT_SCALE;
  if (p <= 0) return tab[0];
  if (p >= TT_N - 1) return tab[TT_N - 1];
  const i = p | 0, f = p - i;
  return tab[i] + (tab[i + 1] - tab[i]) * f;
}
// RMS makeup for a drive gain: a sine of amplitude A through H(G x)/G, compared with the sine.
function tubeMakeup(tab, G, A) {
  let si = 0, so = 0, dc = 0; const M = 128, ys = new Float32Array(M);
  for (let j = 0; j < M; j++) { const x = A * Math.sin(TWO_PI * j / M); ys[j] = tlook(tab, G * x) / G; dc += ys[j]; }
  dc /= M;
  for (let j = 0; j < M; j++) { const x = A * Math.sin(TWO_PI * j / M); si += x * x; so += (ys[j] - dc) * (ys[j] - dc); }
  return so > 0 ? Math.sqrt(si / so) : 1;
}

// ---------- half-band decimator (2x -> 1x), Kaiser-windowed sinc, 95 taps ----------
function besselI0(x) { let s = 1, t = 1; for (let k = 1; k < 30; k++) { t *= (x / (2 * k)) * (x / (2 * k)); s += t; } return s; }
function halfbandTaps(N, beta) {
  const h = new Float64Array(N), M = (N - 1) / 2; let sum = 0;
  for (let n = 0; n < N; n++) {
    const k = n - M, sinc = k === 0 ? 0.5 : Math.sin(Math.PI * k / 2) / (Math.PI * k);
    const w = besselI0(beta * Math.sqrt(1 - (k / M) * (k / M))) / besselI0(beta);
    h[n] = sinc * w; sum += h[n];
  }
  for (let n = 0; n < N; n++) h[n] /= sum;
  return h;
}
class Decim {
  // Symmetric half-band: every other tap is zero, and h[c-k] = h[c+k], so each output
  // needs (N+1)/4 multiplies. The ring is written twice (at w and w+N) so the window is
  // always contiguous and no index needs a modulo.
  constructor(taps) {
    const N = taps.length, c = (N - 1) / 2;
    this.N = N; this.c = c; this.hc = taps[c];
    const ks = []; for (let k = 1; k <= c; k += 2) ks.push(k);
    this.ks = Int32Array.from(ks); this.hk = Float64Array.from(ks.map(k => taps[c + k]));
    this.buf = new Float64Array(2 * N); this.w = 0;
  }
  run(inp, out, n) {
    const N = this.N, c = this.c, buf = this.buf, ks = this.ks, hk = this.hk, K = hk.length, hc = this.hc;
    let w = this.w;
    for (let i = 0; i < n; i++) {
      let x = inp[2 * i]; buf[w] = x; buf[w + N] = x; w = w + 1 === N ? 0 : w + 1;
      x = inp[2 * i + 1]; buf[w] = x; buf[w + N] = x; w = w + 1 === N ? 0 : w + 1;
      // window: buf[w .. w+N-1], oldest first; centre at w+c
      const m = w + c;
      let acc = hc * buf[m];
      for (let j = 0; j < K; j++) { const k = ks[j]; acc += hk[j] * (buf[m - k] + buf[m + k]); }
      out[i] = acc;
    }
    this.w = w;
  }
}

// ---------- oscillator with delayed BLEP/BLAMP ----------
// out = the previous sample with its corrections; cur = this sample's naive value plus the
// halves of corrections for discontinuities that fell between the two.
const W_SAW = 0, W_PULSE = 1, W_TRI = 2, W_SINE = 3;
function naive(w, p, pw) {
  switch (w) {
    case W_SAW: return 2 * p - 1;
    case W_PULSE: return p < pw ? 1 : -1;
    case W_TRI: return p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
    default: return Math.sin(TWO_PI * p);
  }
}
// State lives in a Float64Array rather than object fields, and the caller writes dt and pw into
// it instead of passing them: a double passed to (or returned from) a call the JIT did not
// inline is boxed on the heap, and at 2x rate that was millions of allocations a second.
const O_P = 0, O_PREV = 1, O_CUR = 2, O_Y = 3, O_WRAP = 4, O_DT = 5, O_PW = 6, O_X = 7;
class Osc {
  constructor() { this.s = new Float64Array(8); this.s[O_P] = Math.random(); this.s[O_WRAP] = -1; this.s[O_PW] = 0.5; }
  get y() { return this.s[O_Y]; }
  get wrapX() { return this.s[O_WRAP]; }
  // Advance by dt (may be negative under FM). Leaves the delayed, corrected sample in s[O_Y],
  // and in s[O_WRAP] the time since a forward wrap (0..1 samples), or -1, for hard sync.
  step(w) {
    const st = this.s, dt = st[O_DT], pw = st[O_PW], p0 = st[O_P], q = p0 + dt;
    let p1 = q; if (p1 >= 1) p1 -= 1; else if (p1 < 0) p1 += 1;
    let prev = st[O_PREV], cur, x, y;
    switch (w) {
      case W_SAW: cur = 2 * p1 - 1; break;
      case W_PULSE: cur = p1 < pw ? 1 : -1; break;
      case W_TRI: cur = p1 < 0.5 ? 4 * p1 - 1 : 3 - 4 * p1; break;
      default: cur = Math.sin(TWO_PI * p1);
    }
    let wrap = -1;
    // a step of height h, x samples ago: prev += h/2 x^2, cur -= h/2 (1-x)^2
    // a kink of slope change ds, x samples ago: prev += ds x^3/6, cur += ds (1-x)^3/6
    if (dt > 0) {
      if (q >= 1) wrap = (q - 1) / dt;
      if (w === W_SAW) { if (q >= 1) { x = wrap; y = 1 - x; prev -= x * x; cur += y * y; } }
      else if (w === W_PULSE) {
        if (p0 < pw && q >= pw) { x = (q - pw) / dt; y = 1 - x; prev -= x * x; cur += y * y; }
        if (q >= 1) { x = wrap; y = 1 - x; prev += x * x; cur -= y * y;
          if (q - 1 >= pw) { x = (q - 1 - pw) / dt; y = 1 - x; prev -= x * x; cur += y * y; } }
      } else if (w === W_TRI) {
        const ds = 8 * dt / 6;
        if (p0 < 0.5 && q >= 0.5) { x = (q - 0.5) / dt; y = 1 - x; prev -= ds * x * x * x; cur -= ds * y * y * y; }
        if (q >= 1) { x = wrap; y = 1 - x; prev += ds * x * x * x; cur += ds * y * y * y;
          if (q - 1 >= 0.5) { x = (q - 1.5) / dt; y = 1 - x; prev -= ds * x * x * x; cur -= ds * y * y * y; } }
      }
    } else if (dt < 0) {
      const ad = -dt;
      if (w === W_SAW) { if (q < 0) { x = -q / ad; y = 1 - x; prev += x * x; cur -= y * y; } }
      else if (w === W_PULSE) {
        if (q < pw && p0 >= pw) { x = (pw - q) / ad; y = 1 - x; prev += x * x; cur -= y * y; }
        if (q < 0) { x = -q / ad; y = 1 - x; prev -= x * x; cur += y * y;
          if (q + 1 < pw) { x = (pw - q - 1) / ad; y = 1 - x; prev += x * x; cur -= y * y; } }
      } else if (w === W_TRI) {
        const ds = 8 * ad / 6;
        if (q < 0.5 && p0 >= 0.5) { x = (0.5 - q) / ad; y = 1 - x; prev -= ds * x * x * x; cur -= ds * y * y * y; }
        if (q < 0) { x = -q / ad; y = 1 - x; prev += ds * x * x * x; cur += ds * y * y * y; }
      }
    }
    st[O_P] = p1; st[O_WRAP] = wrap; st[O_Y] = prev; st[O_PREV] = cur;
  }
  // Hard sync: the master wrapped x samples ago (0 <= x < 1). Reset this oscillator's phase
  // to where it would be x samples after a reset, with a BLEP for the jump. Call after step().
  sync(w) {
    const st = this.s, dt = st[O_DT], pw = st[O_PW], x = st[O_X];
    if (dt <= 0) return;
    const p = st[O_P];
    const pAt = p - x * dt, pa = pAt < 0 ? pAt + 1 : pAt;      // phase at the reset instant
    const pn = x * dt;
    const h = naive(w, 0, pw) - naive(w, pa, pw);
    // this sample now starts from the reset phase; the step goes across this pair of samples.
    // st[O_Y] already went out, so the "before" half lands on the sample just returned's successor:
    // st[O_PREV] holds this sample (it becomes the next output), and the before-half belongs to it.
    let cur = st[O_PREV] + naive(w, pn, pw) - naive(w, p, pw);
    const y = 1 - x;
    st[O_Y] += h * 0.5 * x * x;          // the sample being output now is the one before the step
    cur -= h * 0.5 * y * y;
    st[O_PREV] = cur; st[O_P] = pn;
  }
}

// smoothed parameter slots
const K_L1 = 0;
const K_L2 = 1;
const K_LS = 2;
const K_LN = 3;
const K_PW1 = 4;
const K_PW2 = 5;
const K_FM = 6;
const K_RING = 7;
const K_CUT = 8;
const K_RES = 9;
const K_FDRV = 10;
const K_KT = 11;
const K_ENV = 12;
const K_VELF = 13;
const K_SAG = 14;
const K_V1G = 15;
const K_V1MK = 16;
const K_LP = 17;
const K_LC = 18;
const K_LPW = 19;
const K_LA = 20;
const K_VOL = 21;
const NP = 22;

// ---------- envelopes ----------
const E_IDLE = 0, E_ATT = 1, E_DEC = 2, E_SUS = 3, E_REL = 4;
function coef(sec, sr) { return 1 - Math.exp(-1 / Math.max(1, sec * sr)); }

// ---------- the processor ----------
class Filament extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.sr = sampleRate; this.fs = sampleRate * OS;
    this.tubes = {}; (o.tubes || []).forEach(t => { this.tubes[t.id] = t; });
    this.tabCache = {};
    this.voices = []; for (let i = 0; i < NV; i++) this.voices.push(this.newVoice(i));
    this.L2 = new Float64Array(128 * OS); this.R2 = new Float64Array(128 * OS);
    const taps = halfbandTaps(95, 9);
    this.decL = new Decim(taps); this.decR = new Decim(taps);
    this.dcL = 0; this.dcR = 0; this.dcxL = 0; this.dcxR = 0;
    this.bend = 0; this.mw = 0; this.at = 0; this.sus = false;
    this.held = []; this.order = 0; this.altPan = 1;
    this.lfoG = 0; this.lfoGv = 0; this.lfoGt = 0; this.shG = 0; this.shPrevG = 0;
    this.duck = 1; this.duckDir = 0; this.pendingPatch = null;
    this.events = [];
    this.meterN = 0; this.v1Acc = 0; this.v2Acc = 0; this.accN = 0; this.cpuMs = 0; this.cpuFrames = 0;
    this.P = null; this.S = new Float64Array(NP); this.Sp = new Float64Array(NP); this.T = new Float64Array(NP); this.CT = new Float64Array(NP * (128 / CTRL + 1));
    this.setPatch(o.patch || {}, true);
    this.target(this.S); this.Sp.set(this.S);
    (o.events || []).forEach(e => this.events.push(e));
    this.events.sort((a, b) => (a.at || 0) - (b.at || 0));
    this.port.onmessage = e => this.onMsg(e.data);
  }

  newVoice(i) {
    return {
      i, on: false, note: 60, vel: 0.8, gate: false, sust: false, age: 0, pan: 0, gl: 0.7071, gr: 0.7071,
      pitch: 60, pitchT: 60, o1: new Osc(), o2: new Osc(), sub: new Osc(),
      ae: 0, as: E_IDLE, fe: 0, fs: E_IDLE, pending: null, fade: 1, killing: false,
      // filter states
      s1: 0, s2: 0, s3: 0, s4: 0, zi: 0, bp: 0, sh: 0, sag: 0,
      dcx: 0, dcy: 0,
      nb0: 0, nb1: 0, nb2: 0,
      drift: 0, driftT: 0, driftN: 0, drift2: 0, drift2T: 0,
      lfoP: Math.random(), lfoV: 0, lfoT: 0, sh: 0, shPrev: 0, lfoAge: 0,
      // control-rate values
      dt1: 0, dt2: 0, dts: 0, fg: 0, kres: 0, lvl: 0, lvlT: 0, pw1: 0.5, pw2: 0.5,
    };
  }

  // ----- patch handling -----
  setPatch(p) { this.P = p; this.buildTables(); }
  table(id, bias) {
    const key = id + ':' + bias.toFixed(3);
    let t = this.tabCache[key];
    if (!t) {
      const tube = this.tubes[id] || this.tubes['12AX7'] || { gain: 0.774, b0: 0.25, kp: 1, kn: 0.55, h: 1.8, hp: 25 };
      t = this.tabCache[key] = tubeTable(tube, bias);
      const keys = Object.keys(this.tabCache); if (keys.length > 64) delete this.tabCache[keys[0]];
    }
    return t;
  }
  buildTables() {
    const P = this.P, v1 = P.v1 || {}, f = P.filt || {};
    this.v1Tube = this.tubes[v1.tube] || this.tubes['12AX7'] || { gain: 0.774, hp: 25 };
    this.v1Tab = this.table(v1.tube || '12AX7', +v1.bias || 0);
    this.lTube = this.tubes[f.tube] || this.tubes['12AT7'] || { gain: 0.701, hp: 25 };
    this.lTab = this.table(f.tube || '12AT7', +f.bias || 0);
    {   // oscillation where the coupling-cap lead atan(rho/w) equals the band-pass lag past 90 degrees
      const rho = (this.lTube.hp || 25) / 400, R = 0.70710678;
      let w = 1;
      for (let it = 0; it < 30; it++) {
        const ph = Math.atan(rho / w) + Math.PI / 2 - Math.atan2(2 * R * w, 1 - w * w);
        const w2 = w * 1.0001, ph2 = Math.atan(rho / w2) + Math.PI / 2 - Math.atan2(2 * R * w2, 1 - w2 * w2);
        const d = (ph2 - ph) / (w2 - w); if (!d) break; w -= ph / d;
      }
      this.vComp = 1 / w;
    }
    // makeup for the drive tube at the patch's drive (re-done when drive moves)
    this.v1G = (this.v1Tube.gain || 0.774) * Math.pow(2, ((+v1.drive || 0) - 3) * 0.5);
    this.v1Mk = tubeMakeup(this.v1Tab, this.v1G, 0.5);
  }
  // Continuous parameters, flattened, so they can be smoothed.
  target(T) {
    const P = this.P, o1 = P.osc1 || {}, o2 = P.osc2 || {}, sb = P.sub || {}, nz = P.noise || {}, f = P.filt || {};
    const l = P.lfo1 || {};
    T[K_L1] = num(o1.level, 0.8); T[K_L2] = num(o2.level, 0); T[K_LS] = num(sb.level, 0); T[K_LN] = num(nz.level, 0);
    T[K_PW1] = num(o1.pw, 0.5); T[K_PW2] = num(o2.pw, 0.5); T[K_FM] = num(o2.fm, 0); T[K_RING] = num(o2.ring, 0);
    T[K_CUT] = num(f.cutoff, 2000); T[K_RES] = num(f.res, 0); T[K_FDRV] = num(f.drive, 3); T[K_KT] = num(f.keytrack, 0.5);
    T[K_ENV] = num(f.env, 0); T[K_VELF] = num(f.vel, 0); T[K_SAG] = num(f.sag, 3);
    T[K_V1G] = this.v1G; T[K_V1MK] = this.v1Mk;
    T[K_LP] = num(l.pitch, 0); T[K_LC] = num(l.cutoff, 0); T[K_LPW] = num(l.pw, 0); T[K_LA] = num(l.amp, 0);
    T[K_VOL] = num((P.voice || {}).level, 0.8);
    return T;
  }

  onMsg(m) {
    if (!m) return;
    if (m.at != null) { this.events.push(m); this.events.sort((a, b) => a.at - b.at); return; }
    this.apply(m);
  }
  apply(m) {
    switch (m.t) {
      case 'patch': {
        // A change of wave, model, tube or voice mode would click, so those ride a 6 ms duck:
        // down, swap while silent, back up. Everything else is smoothed in render().
        if (this.pendingPatch) { this.pendingPatch = m.p; break; }
        if (m.load || isStruct(this.P, m.p)) { this.pendingPatch = m.p; this.duckDir = -1; }
        else this.setPatch(m.p);
        break;
      }
      case 'on': this.noteOn(m.n | 0, num(m.v, 0.8)); break;
      case 'off': this.noteOff(m.n | 0); break;
      case 'bend': this.bend = clamp(num(m.v, 0), -1, 1); break;
      case 'mw': this.mw = clamp(num(m.v, 0), 0, 1); break;
      case 'at': this.at = clamp(num(m.v, 0), 0, 1); break;
      case 'sus': this.sus = !!m.on; if (!this.sus) this.releaseSustained(); break;
      case 'panic': this.held = []; this.voices.forEach(v => { v.on = false; v.as = E_IDLE; v.ae = 0; v.gate = false; v.pending = null; }); break;
    }
  }

  // ----- notes -----
  mode() { return ((this.P.voice || {}).mode) || 'poly'; }
  count() { return clamp(((this.P.voice || {}).count) | 0 || 8, 1, NV); }
  noteOn(n, vel) {
    this.held = this.held.filter(h => h !== n); this.held.push(n);
    const mode = this.mode();
    if (mode !== 'poly') {
      const v = this.voices[0];
      const legato = mode === 'legato' && v.gate && v.on;
      v.note = n; v.pitchT = n; v.vel = vel; v.gate = true; v.sust = false;
      if (!v.on) { v.pitch = n; this.startVoice(v, n, vel, true); }
      else if (!legato) { this.trigger(v, vel); }
      if (num((this.P.voice || {}).glide, 0) <= 0) v.pitch = n;
      return;
    }
    const N = this.count();
    let v = null;
    for (let i = 0; i < N; i++) { const w = this.voices[i]; if (w.on && w.note === n && !w.killing) { v = w; break; } }
    if (v) { v.gate = true; v.sust = false; v.vel = vel; this.trigger(v, vel); v.age = ++this.order; return; }
    for (let i = 0; i < N; i++) { const w = this.voices[i]; if (!w.on && !w.pending) { v = w; break; } }
    if (!v) {          // steal: oldest released voice, else the quietest
      let best = null;
      for (let i = 0; i < N; i++) { const w = this.voices[i]; if (!w.gate && !w.sust && !w.pending && (!best || w.age < best.age)) best = w; }
      if (!best) for (let i = 0; i < N; i++) { const w = this.voices[i]; if (!w.pending && (!best || w.ae < best.ae)) best = w; }
      if (!best) best = this.voices[0];
      best.pending = { n, vel }; best.killing = true; best.gate = false;
      return;
    }
    this.startVoice(v, n, vel, false);
  }
  startVoice(v, n, vel, mono) {
    const P = this.P;
    v.on = true; v.note = n; v.vel = vel; v.gate = true; v.sust = false; v.killing = false; v.fade = 1; v.pending = null;
    v.age = ++this.order;
    if (!mono || num((P.voice || {}).glide, 0) <= 0) v.pitch = n;
    v.pitchT = n;
    // pan
    const st = P.stereo || {}, spread = clamp(num(st.spread, 0.5), 0, 1), pm = st.pan || 'alt';
    let pan = 0;
    if (pm === 'alt') { this.altPan = -this.altPan; pan = this.altPan * spread; }
    else if (pm === 'key') pan = clamp((n - 60) / 30, -1, 1) * spread;
    else if (pm === 'random') pan = (Math.random() * 2 - 1) * spread;
    v.pan = pan; v.gl = Math.cos((pan + 1) * Math.PI / 4); v.gr = Math.sin((pan + 1) * Math.PI / 4);
    // per-voice LFO restarts with the note
    const l = P.lfo1 || {};
    if (l.mode === 'voice') v.lfoP = 0;
    v.lfoAge = 0;
    v.ae = 0; v.fe = 0;
    // a whisper of thermal noise in the filter, so a self-oscillating filter starts on its own
    if (v.s1 === 0 && v.s2 === 0) { v.s1 = (Math.random() - 0.5) * 1e-3; v.bp = v.s1; }
    this.trigger(v, vel);
  }
  trigger(v, vel) { v.as = E_ATT; v.fs = E_ATT; v.vel = vel; v.lfoAge = 0; }
  noteOff(n) {
    this.held = this.held.filter(h => h !== n);
    const mode = this.mode();
    if (mode !== 'poly') {
      const v = this.voices[0];
      if (v.note !== n) return;
      if (this.held.length) {             // fall back to the previous held note
        const m = this.held[this.held.length - 1];
        v.note = m; v.pitchT = m;
        if (num((this.P.voice || {}).glide, 0) <= 0) v.pitch = m;
        if (mode === 'mono') this.trigger(v, v.vel);
        return;
      }
      if (this.sus) { v.sust = true; v.gate = false; return; }
      v.gate = false; if (v.as !== E_IDLE) { v.as = E_REL; v.fs = E_REL; }
      return;
    }
    for (let i = 0; i < NV; i++) {
      const v = this.voices[i];
      if (v.on && v.note === n && v.gate) {
        v.gate = false;
        if (this.sus) v.sust = true; else { v.as = E_REL; v.fs = E_REL; }
      }
      if (v.pending && v.pending.n === n) v.pending = null;
    }
  }
  releaseSustained() {
    for (let i = 0; i < NV; i++) { const v = this.voices[i]; if (v.sust) { v.sust = false; if (!v.gate) { v.as = E_REL; v.fs = E_REL; } } }
  }

  // ----- audio -----
  process(inputs, outputs) {
    const t0 = Date.now();
    const out = outputs[0], L = out[0], R = out[1] || out[0], n = L.length;
    const L2 = this.L2, R2 = this.R2;
    L2.fill(0, 0, n * OS); R2.fill(0, 0, n * OS);
    const base = currentFrame;
    let pos = 0;
    while (pos < n) {
      while (this.events.length && (this.events[0].at || 0) <= base + pos) this.apply(this.events.shift());
      let end = n;
      if (this.events.length) { const at = this.events[0].at - base; if (at > pos && at < n) end = at; }
      this.render(pos, end);
      pos = end;
    }
    this.decL.run(L2, L, n); this.decR.run(R2, R, n);
    // DC blocker on the sum (the asymmetric tubes make some), about 8 Hz
    const a = 1 - TWO_PI * 8 / this.sr;
    let xl = this.dcxL, yl = this.dcL, xr = this.dcxR, yr = this.dcR;
    for (let i = 0; i < n; i++) {
      const l = L[i], r = R[i];
      yl = l - xl + a * yl; xl = l; yr = r - xr + a * yr; xr = r;
      L[i] = yl; if (R !== L) R[i] = yr;
    }
    this.dcxL = xl; this.dcL = yl; this.dcxR = xr; this.dcR = yr;
    // meters, about 30 a second
    this.cpuMs += Date.now() - t0; this.cpuFrames += n;
    this.meterN += n;
    if (this.meterN >= this.sr / 30) {
      const act = this.voices.filter(v => v.on);
      this.port.postMessage({
        t: 'meter', v1: Math.sqrt(this.v1Acc / Math.max(1, this.accN)), v2: Math.sqrt(this.v2Acc / Math.max(1, this.accN)),
        voices: act.length, notes: act.filter(v => v.gate || v.sust).map(v => v.note),
        cpu: this.cpuMs / (this.cpuFrames / this.sr * 1000),
      });
      this.meterN = 0; this.v1Acc = 0; this.v2Acc = 0; this.accN = 0;
      if (this.cpuFrames > this.sr) { this.cpuMs *= 0.5; this.cpuFrames *= 0.5; }
    }
    return true;
  }

  render(a, b) {
    if (b <= a) return;
    const sr = this.sr, fs = this.fs, frames = b - a;
    // ---- patch change duck: down 3 ms, swap, up 3 ms ----
    // The swap happens at the start of a block that begins silent, so nothing old and new
    // ever overlap at a non-zero gain; amp ramps from duck0 to this.duck across each block.
    const duck0 = this.duck;
    if (this.duckDir === -1 && duck0 <= 0) {
      const oldModel = (this.P.filt || {}).model;
      if (this.pendingPatch) { this.setPatch(this.pendingPatch); this.pendingPatch = null; }
      this.target(this.S); this.Sp.set(this.S);
      if ((this.P.filt || {}).model !== oldModel)
        for (const v of this.voices) { v.s1 = v.s2 = v.s3 = v.s4 = v.bp = v.sh = v.zi = v.sag = 0; }
      this.duckDir = 1;
    }
    if (this.duckDir !== 0) {
      this.duck = clamp(this.duck + this.duckDir * frames / (0.003 * sr), 0, 1);
      if (this.duckDir === 1 && this.duck >= 1) this.duckDir = 0;
    }
    const P = this.P;          // read after the swap: this block plays the patch it ramps up with
    // ---- smoothing of continuous parameters (20 ms) ----
    const T = this.target(this.T), S = this.S, Sp = this.Sp;
    const k = 1 - Math.exp(-frames / (0.02 * sr));
    for (let j = 0; j < NP; j++) { Sp[j] = S[j]; S[j] += (T[j] - S[j]) * k; }

    // ---- global LFO ----
    const l = P.lfo1 || {}, lrate = clamp(num(l.rate, 5), 0.01, 40), lwave = l.wave || 'sine', lglobal = l.mode !== 'voice';
    const ldelay = Math.max(0, num(l.delay, 0));
    const lfoG0 = this.lfoG;
    this.lfoG = (this.lfoG + lrate * frames / sr) % 1;
    const sx = num(P.tune, 0) / 100;

    // patch values read once
    const o1 = P.osc1 || {}, o2 = P.osc2 || {}, sb = P.sub || {}, nz = P.noise || {}, f = P.filt || {};
    const w1 = WAVES[o1.wave] ?? W_SAW, w2 = WAVES[o2.wave] ?? W_SAW, ws = sb.wave === 'sine' ? W_SINE : W_PULSE;
    const subDiv = sb.oct === 2 ? 4 : 2;
    const off1 = num(o1.oct, 0) * 12 + num(o1.semi, 0) + num(o1.fine, 0) / 100;
    const off2 = num(o2.oct, 0) * 12 + num(o2.semi, 0) + num(o2.fine, 0) / 100;
    const fix1 = num(o1.fixed, 0), fix2 = num(o2.fixed, 0);
    const sync = !!o2.sync, pink = nz.color === 'pink';
    const model = f.model === 'ladder24' ? 1 : 0;
    const ea = P.envA || {}, ef = P.envF || {};
    const aA = coef(Math.max(0.001, num(ea.a, 0.005)) / 1.466, sr), aD = coef(Math.max(0.001, num(ea.d, 0.3)) / 4.6, sr), aS = clamp(num(ea.s, 0.8), 0, 1), aR = coef(Math.max(0.003, num(ea.r, 0.3)) / 4.6, sr);
    const fA = coef(Math.max(0.001, num(ef.a, 0.005)) / 1.466, sr), fD = coef(Math.max(0.001, num(ef.d, 0.3)) / 4.6, sr), fS = clamp(num(ef.s, 0.5), 0, 1), fR = coef(Math.max(0.003, num(ef.r, 0.3)) / 4.6, sr);
    const velA = clamp(num(ea.vel, 0.5), 0, 1);
    const vo = P.voice || {}, glide = Math.max(0, num(vo.glide, 0)), gk = glide > 0 ? 1 - Math.exp(-CTRL / (glide * sr)) : 1;
    const bendR = num(vo.bend, 2), driftC = clamp(num(P.drift, 1.5), 0, 8);
    const mwv = num((P.mw || {}).vib, 30), mwc = num((P.mw || {}).cut, 0), atc = num((P.at || {}).cut, 1), atv = num((P.at || {}).vib, 0);
    // The coupling cap in the Valve loop sits a fixed ratio below the cutoff (each tube's hp/400),
    // so its phase lead, and the pitch shift that comes with it, is the same on every key.
    const hpRatio = (this.lTube.hp || 25) / 400, vComp = this.vComp, vCal = VCAL[this.lTube.id] || VCAL0;
    let gH = 0, aH = 1;
    const lG = 1.3 * Math.pow((this.lTube.gain || 0.774) / 0.774, LGX);
    const v1Tab = this.v1Tab, lTab = this.lTab;
    const dcA = 1 - TWO_PI * 15 / fs;
    const L2 = this.L2, R2 = this.R2;
    const N = this.count();
    const l2Any = S[K_L2] > 1e-4 || this.T[K_L2] > 0 || Sp[K_L2] > 1e-4;
    const lsAny = S[K_LS] > 1e-4 || this.T[K_LS] > 0 || Sp[K_LS] > 1e-4;

    // smoothed parameters at each control tick, shared by every voice
    const CT = this.CT, nt = Math.ceil(frames / CTRL);
    for (let t = 0; t < nt; t++) { const kk = t * CTRL / frames, o = t * NP; for (let j = 0; j < NP; j++) CT[o + j] = Sp[j] + (S[j] - Sp[j]) * kk; }

    let v1Acc = 0, v2Acc = 0;
    for (let vi = 0; vi < NV; vi++) {
      const v = this.voices[vi];
      if (!v.on) continue;
      if (vi >= N && this.mode() === 'poly' && v.as !== E_REL && !v.killing) { v.as = E_REL; v.fs = E_REL; v.gate = false; }
      const o1o = v.o1, o2o = v.o2, so = v.sub;
      let s1 = v.s1, s2 = v.s2, s3 = v.s3, s4 = v.s4, zi = v.zi, bp = v.bp, shh = v.sh, sag = v.sag;
      let dcx = v.dcx, dcy = v.dcy, nb0 = v.nb0, nb1 = v.nb1, nb2 = v.nb2;
      let ae = v.ae, fe = v.fe, as = v.as, fst = v.fs;
      let fg = v.fg, kres = v.kres, dt1 = v.dt1, dt2 = v.dt2, dts = v.dts, pw1 = v.pw1, pw2 = v.pw2, lfoAmp = 1, cutMul = 1;
      let fdG = 1, fdC = 1, ladK = 0, ladComp = 1, valK = 0, valR = 0.7071, sagAmt = 0;
      let fade = v.fade;
      let t1 = 1, t2 = 1, t3 = 1, t4 = 1, g0 = 1, g1 = 1, g2 = 1, g3 = 1;
      let l1 = 0, l2 = 0, ls = 0, ln = 0, fm = 0, ring = 0, G1 = 1, mk1 = 1, vol = 0;
      const use2 = l2Any || sync, useS = lsAny;
      for (let i = a; i < b; i++) {
        const fr = i - a;
        // ---- control tick ----
        if (fr % CTRL === 0) {
          const cb = ((fr / CTRL) | 0) * NP;
          // LFO
          let lph;
          if (lglobal) lph = (lfoG0 + lrate * fr / sr) % 1;
          else { v.lfoP = (v.lfoP + lrate * CTRL / sr) % 1; lph = v.lfoP; }
          let lv;
          switch (lwave) {
            case 'tri': lv = lph < 0.5 ? 4 * lph - 1 : 3 - 4 * lph; break;
            case 'saw': lv = 1 - 2 * lph; break;
            case 'square': lv = lph < 0.5 ? 1 : -1; break;
            case 'sh': case 'smooth': {
              const last = lglobal ? this.shPhase : v.shPhase;
              if (last == null || lph < last) { if (lglobal) { this.shPrevG = this.shG; this.shG = Math.random() * 2 - 1; } else { v.shPrev = v.sh2 || 0; v.sh2 = Math.random() * 2 - 1; } }
              if (lglobal) this.shPhase = lph; else v.shPhase = lph;
              const cur = lglobal ? this.shG : v.sh2, prv = lglobal ? this.shPrevG : (v.shPrev || 0);
              lv = lwave === 'sh' ? cur : prv + (cur - prv) * (0.5 - 0.5 * Math.cos(Math.PI * lph));
              break;
            }
            default: lv = Math.sin(TWO_PI * lph);
          }
          v.lfoAge += CTRL / sr;
          const lfoFade = ldelay > 0 ? clamp((v.lfoAge - ldelay * 0.5) / (ldelay * 0.5), 0, 1) : 1;
          lv *= lfoFade;
          // drift: smooth random walk per voice
          if (--v.driftN <= 0) { v.driftT = Math.random() * 2 - 1; v.drift2T = Math.random() * 2 - 1; v.driftN = (0.3 + Math.random() * 0.6) * sr / CTRL; }
          v.drift += (v.driftT - v.drift) * 0.0003; v.drift2 += (v.drift2T - v.drift2) * 0.0003;
          // pitch
          v.pitch += (v.pitchT - v.pitch) * gk;
          const vib = (CT[cb + K_LP] + this.mw * mwv + this.at * atv) * lv / 100;
          const pn = v.pitch + this.bend * bendR + sx + vib + driftC * v.drift / 100;
          const f1 = fix1 > 0 ? fix1 * Math.pow(2, (vib + driftC * v.drift / 100) / 12) : 440 * Math.pow(2, (pn + off1 - 69) / 12);
          const f2 = fix2 > 0 ? fix2 : 440 * Math.pow(2, (pn + off2 + driftC * 0.5 * v.drift2 / 100 - 69) / 12);
          dt1 = Math.min(f1 / fs, 0.45); dt2 = Math.min(f2 / fs, 0.45); dts = dt1 / subDiv;
          pw1 = clamp(CT[cb + K_PW1] + CT[cb + K_LPW] * lv * 0.5, 0.03, 0.97); pw2 = clamp(CT[cb + K_PW2] + CT[cb + K_LPW] * lv * 0.5, 0.03, 0.97);
          // filter cutoff
          const oct = CT[cb + K_KT] * (v.pitch - 60) / 12 + CT[cb + K_ENV] * 7 * fe + CT[cb + K_VELF] * (v.vel - 0.79) * 3
            + CT[cb + K_LC] * lv + this.mw * mwc + this.at * atc;
          let fc = CT[cb + K_CUT] * Math.pow(2, oct);
          fc = clamp(fc, 16, sr * 0.45);
          const res = clamp(CT[cb + K_RES], 0, 1);
          if (model === 1) {
            // Ladder: the tanh stages pull a self-oscillating filter flat, by an amount set by how
            // far the loop gain is past 4 (measured: about 86 cents per unit, a little less up high).
            const over = res * 4.45 - 4;
            if (over > 0) { const g0 = Math.PI * fc / fs; fc *= Math.pow(2, over * (86 - 280 * g0) / 1200); }
          } else if (res > 0.6) {
            // Valve: the coupling cap's phase lead pushes the resonance up; pull the cutoff down to
            // match, fully from the point where the loop can oscillate (RES_T). Past that point
            // the saturating tube pulls it flat again, by a measured amount per tube (vCal, cents).
            const w = res >= RES_T ? 1 : (res - 0.6) / (RES_T - 0.6), ws = w * w * (3 - 2 * w);
            fc *= 1 + (vComp - 1) * ws;
            const e = res > RES_T ? (res - RES_T) / (1 - RES_T) : 0;
            fc *= Math.pow(2, -(vCal[0] * ws + vCal[1] * e + vCal[2] * e * e) / 1200);
          }
          fc = clamp(fc, 16, sr * 0.45);
          fg = Math.tan(Math.PI * fc / fs);
          gH = Math.tan(Math.PI * Math.min(fc * hpRatio, sr * 0.2) / fs); aH = 1 / (1 + gH);
          const fd = clamp(CT[cb + K_FDRV], 0, 10);
          fdG = Math.pow(2, (fd - 3) / 3); fdC = 1 / Math.sqrt(fdG);
          if (model === 1) { ladK = res * 4.45; ladComp = 1 + ladK * 0.45; }
          else { valK = KMAX * Math.pow(res, KEXP); sagAmt = clamp(CT[cb + K_SAG], 0, 10) / 10; }
          lfoAmp = 1 - clamp(CT[cb + K_LA], 0, 1) * (0.5 - 0.5 * lv);
          l1 = CT[cb + K_L1]; l2 = CT[cb + K_L2]; ls = CT[cb + K_LS]; ln = CT[cb + K_LN];
          fm = CT[cb + K_FM] * 0.25; ring = CT[cb + K_RING]; G1 = CT[cb + K_V1G]; mk1 = CT[cb + K_V1MK]; vol = CT[cb + K_VOL];
        }
        // ---- envelopes (output rate) ----
        if (as === E_ATT) { ae += (1.3 - ae) * aA; if (ae >= 1) { ae = 1; as = E_DEC; } }
        else if (as === E_DEC) { ae += (aS - ae) * aD; if (Math.abs(ae - aS) < 1e-4) as = E_SUS; }
        else if (as === E_SUS) { ae += (aS - ae) * 0.01; }
        else if (as === E_REL) { ae += (0 - ae) * aR; if (ae < 1e-5) { ae = 0; as = E_IDLE; } }
        if (fst === E_ATT) { fe += (1.3 - fe) * fA; if (fe >= 1) { fe = 1; fst = E_DEC; } }
        else if (fst === E_DEC) { fe += (fS - fe) * fD; if (Math.abs(fe - fS) < 1e-4) fst = E_SUS; }
        else if (fst === E_SUS) { fe += (fS - fe) * 0.01; }
        else if (fst === E_REL) { fe += (0 - fe) * fR; }
        if (v.killing) { fade -= 1 / (0.002 * sr); if (fade <= 0) { fade = 0; } }
        const duck = duck0 + (this.duck - duck0) * (fr / frames);
        const amp = ae * (1 - velA * (1 - v.vel)) * lfoAmp * fade * duck * vol * 0.5;
        // ---- 2x inner loop ----
        for (let s = 0; s < OS; s++) {
          // oscillators
          const q1 = o1o.s; q1[O_DT] = dt1; q1[O_PW] = pw1; o1o.step(w1); const x1 = q1[O_Y];
          let x2 = 0;
          if (use2) {
            const q2 = o2o.s; q2[O_DT] = fm > 0 ? dt2 * (1 + fm * 4 * x1) : dt2; q2[O_PW] = pw2;
            o2o.step(w2);
            if (sync && q1[O_WRAP] >= 0) { q2[O_DT] = dt2; q2[O_X] = q1[O_WRAP]; o2o.sync(w2); }
            x2 = q2[O_Y];
            if (ring > 0) x2 = x2 * (1 - ring) + x1 * x2 * ring;
          }
          let xs = 0;
          if (useS) { const q3 = so.s; q3[O_DT] = dts; q3[O_PW] = 0.5; so.step(ws); xs = q3[O_Y]; }
          let xn = 0;
          if (ln > 0) {
            const wn = Math.random() * 2 - 1;
            if (pink) { nb0 = 0.99765 * nb0 + wn * 0.0990460; nb1 = 0.96300 * nb1 + wn * 0.2965164; nb2 = 0.57000 * nb2 + wn * 1.0526913; xn = (nb0 + nb1 + nb2 + wn * 0.1848) * 0.25; }
            else xn = wn;
          }
          let x = (x1 * l1 + x2 * l2 + xs * ls + xn * ln) * 0.6;
          // V1 drive tube, then a coupling cap (15 Hz) to stop its DC reaching the filter
          v1Acc += x * x;
          let y;
          { let tp = (G1 * x + TT_R) * TT_SCALE;
            if (tp <= 0) y = v1Tab[0]; else if (tp >= TT_N - 1) y = v1Tab[TT_N - 1];
            else { const ti = tp | 0; y = v1Tab[ti] + (v1Tab[ti + 1] - v1Tab[ti]) * (tp - ti); }
            y = y / G1 * mk1; }
          dcy = y - dcx + dcA * dcy; dcx = y; y = dcy;
          y *= fdG;
          // filter
          if (model === 1) {
            // ---- Ladder 24 ----
            const fq = fg, r = ladK, ih = 0.5 * (y + zi); zi = y;
            let q = ih - r * s4, qa = q * q;
            const t0 = ((qa + 105) * qa + 945) / ((15 * qa + 420) * qa + 945);
            if (true) {
              qa = s1 * s1; t1 = ((qa + 105) * qa + 945) / ((15 * qa + 420) * qa + 945);
              qa = s2 * s2; t2 = ((qa + 105) * qa + 945) / ((15 * qa + 420) * qa + 945);
              qa = s3 * s3; t3 = ((qa + 105) * qa + 945) / ((15 * qa + 420) * qa + 945);
              qa = s4 * s4; t4 = ((qa + 105) * qa + 945) / ((15 * qa + 420) * qa + 945);
              g0 = 1 / (1 + fq * t1); g1 = 1 / (1 + fq * t2); g2 = 1 / (1 + fq * t3); g3 = 1 / (1 + fq * t4);
            }
            const f3 = fq * t3 * g3, f2 = fq * t2 * g2 * f3, f1 = fq * t1 * g1 * f2, f0 = fq * t0 * g0 * f1;
            const y3 = (g3 * s4 + f3 * g2 * s3 + f2 * g1 * s2 + f1 * g0 * s1 + f0 * y) / (1 + r * f0);
            const xx = t0 * (y - r * y3);
            const y0 = t1 * g0 * (s1 + fq * xx), yy1 = t2 * g1 * (s2 + fq * y0), yy2 = t3 * g2 * (s3 + fq * yy1);
            s1 += 2 * fq * (xx - y0); s2 += 2 * fq * (y0 - yy1); s3 += 2 * fq * (yy1 - yy2); s4 += 2 * fq * (yy2 - t4 * y3);
            y = y3 * ladComp;
            v2Acc += 0;
          } else {
            // ---- Valve 12 ----
            const g = fg, R = 0.70710678;
            const kq = valK;
            // Supply sag: a loud loop pulls the rail down, so the loop tube runs out of headroom
            // sooner. Small-signal gain is untouched, so it keeps oscillating, just lower.
            const lGe = lG * (1 + 2.5 * sagAmt * sag);
            // linearise the loop tube at the last band-pass value
            const v0 = bp, u0 = lGe * v0;
            let T0, T1;
            { const tp = (u0 + TT_R) * TT_SCALE;
              if (tp <= 0) { T0 = lTab[0]; T1 = 0; } else if (tp >= TT_N - 1) { T0 = lTab[TT_N - 1]; T1 = 0; }
              else { const ti = tp | 0, d = lTab[ti + 1] - lTab[ti]; T0 = lTab[ti] + d * (tp - ti); T1 = d * TT_SCALE; }
              T0 /= lGe; }
            const bh = -shh * aH;                     // coupling-cap high-pass: out = aH*in + bh
            const c1 = kq * aH * T1, c0 = kq * (aH * (T0 - T1 * v0) + bh);
            const hp = (y + c0 + c1 * s1 - (2 * R + g) * s1 - s2) / (1 + 2 * R * g + g * g - c1 * g);
            const bpn = g * hp + s1; s1 = g * hp + bpn;
            const lp = g * bpn + s2; s2 = g * bpn + lp;
            const fbRaw = T0 + T1 * (bpn - v0);
            // high-pass state update (TPT one-pole lowpass inside it)
            const vH = (fbRaw - shh) * gH * aH; const lpH = vH + shh; shh = lpH + vH;
            // sag follower on the loop level: fast attack, slow release
            const af = Math.abs(fbRaw);
            sag += (af - sag) * (af > sag ? 0.0005 : 0.000035);
            bp = bpn;
            v2Acc += fbRaw * fbRaw * (kq > 0.05 ? 1 : 0);
            y = lp;
          }
          y *= fdC * amp;
          const idx = i * OS + s;
          L2[idx] += y * v.gl; R2[idx] += y * v.gr;
        }
      }
      // write back
      v.s1 = s1; v.s2 = s2; v.s3 = s3; v.s4 = s4; v.zi = zi; v.bp = bp; v.sh = shh; v.sag = sag;
      v.dcx = dcx; v.dcy = dcy; v.nb0 = nb0; v.nb1 = nb1; v.nb2 = nb2;
      v.ae = ae; v.fe = fe; v.as = as; v.fs = fst; v.fg = fg; v.kres = kres; v.dt1 = dt1; v.dt2 = dt2; v.dts = dts; v.pw1 = pw1; v.pw2 = pw2;
      v.fade = fade;
      // flush denormals / blow-ups
      if (!(Math.abs(s1) < 1e6) || !(Math.abs(s2) < 1e6) || !(Math.abs(s3) < 1e6) || !(Math.abs(s4) < 1e6) || !(Math.abs(bp) < 1e6)) {
        v.s1 = v.s2 = v.s3 = v.s4 = v.bp = v.sh = v.zi = 0;
      } else {
        if (Math.abs(v.s1) < 1e-20) v.s1 = 0; if (Math.abs(v.s2) < 1e-20) v.s2 = 0;
        if (Math.abs(v.s3) < 1e-20) v.s3 = 0; if (Math.abs(v.s4) < 1e-20) v.s4 = 0;
      }
      if (as === E_IDLE || (v.killing && fade <= 0)) {
        v.on = false; v.as = E_IDLE; v.ae = 0; v.killing = false; v.fade = 1;
        v.s1 = v.s2 = v.s3 = v.s4 = v.bp = v.sh = v.zi = v.sag = 0;
        if (v.pending) { const pnd = v.pending; v.pending = null; this.startVoice(v, pnd.n, pnd.vel, false); }
      }
    }
    // a stale NaN would poison the decimator forever
    for (let i = a * OS; i < b * OS; i++) { if (!(Math.abs(L2[i]) < 1e3)) L2[i] = 0; if (!(Math.abs(R2[i]) < 1e3)) R2[i] = 0; }
    this.v1Acc += v1Acc; this.v2Acc += v2Acc; this.accN += frames * OS;
  }
}

// Valve 12 self-oscillation pitch calibration: cents to add at full resonance, per loop tube,
// measured with the test renders (see scripts/test_synth.py, "self oscillation tracks pitch").
// Each entry is [a, b, c] for a + b e + c e^2, where e runs 0..1 from the oscillation threshold
// (RES_T) to full resonance; the cutoff is moved by minus that many cents.
const VCAL = {
  '12AX7': [-3.9, -114.3, 40.9], '12AT7': [0.2, -87.5, 23.9], '12AU7': [0.4, -77.0, 19.0], '300B': [-86.2, -54.6, 19.8],
  'EL84': [2.1, -30.6, -11.6], '6V6': [2.4, -41.9, -4.4], 'EL34': [1.5, -18.7, -23.4], '6L6': [1.5, -18.6, -25.7], 'KT88': [1.8, -21.7, -27.3],
};
const VCAL0 = [0, 0, 0];
// Valve loop gain: KMAX * res^KEXP. The loop oscillates once that passes 2R = 1.414, at RES_T
// (about 0.85 on the knob), and full resonance drives it 55% past that, far enough into the tube
// that the power tubes' odd harmonics come through.
const KMAX = 2.2, KEXP = 2.7, RES_T = Math.pow(1.41421356 / KMAX, 1 / KEXP);
const LGX = 0.3;   // how much of each tube's own gain reaches the Valve loop (0 = all the same)
const WAVES = { saw: W_SAW, pulse: W_PULSE, square: W_PULSE, tri: W_TRI, triangle: W_TRI, sine: W_SINE };
// tanh(x)/x, Pade approximant (exact enough for |x| < 3, still monotone and bounded beyond)
function tdx(x) { const a = x * x; return ((a + 105) * a + 945) / ((15 * a + 420) * a + 945); }
function num(v, d) { v = +v; return isFinite(v) ? v : d; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function isStruct(a, b) {
  if (!a) return true;
  return ['osc1.wave', 'osc2.wave', 'osc2.sync', 'sub.wave', 'sub.oct', 'noise.color', 'filt.model', 'filt.tube',
    'v1.tube', 'voice.mode'].some(k => get(a, k) !== get(b, k));
}
function get(o, path) { const ks = path.split('.'); let x = o; for (const k of ks) { if (x == null) return undefined; x = x[k]; } return x; }

registerProcessor('filament', Filament);
