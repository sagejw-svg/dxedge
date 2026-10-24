// Filament voice engine. One AudioWorkletProcessor runs every voice.
//
// Each voice runs at twice the output rate (OS = 2): oscillators, the V1 drive tube,
// the filter and the VCA. The voices are panned and summed at 2x, and one half-band
// FIR per channel brings the stereo sum back down. Oversampling the whole voice costs
// more than oversampling only the nonlinear parts, but it keeps every stage simple and
// the only decimators are the two on the sum.
//
//   osc 1, osc 2 (sync, FM, ring), sub, noise -> mixer -> V1 tube -> coupling cap
//   -> filter (Valve 12, Ladder 24, Diode 18, Sallen-Key 12 or Poly 24) -> VCA -> pan -> L/R (2x) -> half-band -> out
//
// Stereo inside the voice: when the filter has a stereo offset, or an LFO with stereo phase
// moves the cutoff, each voice runs two filters (left and right cutoffs) after the shared
// oscillators and V1. Otherwise one filter feeds both sides. Unison stacks 1-8 voices on a
// note, each a full voice, spread in pitch (detune) and across the field (unison spread).
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
//   Diode 18:  three coupled poles. Each stage is a capacitor charged through a diode pair
//              (a tanh of the voltage across it) that also loads the stage before it by half
//              (DIO_B), with negative feedback from the last pole. Our own formulation: the
//              coupled nodal equations, trapezoidal, solved as one 3x3 tridiagonal system.
//   Sallen-Key 12: a 2-pole lowpass of two RC sections whose gain amplifier (K) feeds back
//              through the first capacitor; it rings as K nears 3 and oscillates past it. The
//              amplifier clips hard and unevenly (a sharp knee, lower on the negative side), so
//              the resonance squares off and snarls. An optional 2-pole high-pass of the same
//              build sits in front (filt.hp), its peak at half the low-pass's. Our own state
//              equations for the two capacitor voltages, trapezoidal, the clip linearised at
//              the last sample (one Newton step), each section solved as a 2x2 system.
//   Poly 24:   four transconductance (OTA) stages in a cascade, each a capacitor charged by a
//              current that saturates on the difference between its input and its own output
//              (a tanh of the voltage across the stage), with the resonance fed back from the last
//              stage through a soft-clipping amplifier. Linearly the same four poles as Ladder 24;
//              the stages bend on loud, fast input (they slew) rather than on their own level, and
//              more of the bass is made up as resonance rises. Our own formulation: each stage's
//              tanh(d)/d taken at the last sample, the loop then solved exactly.
//
// Messages in (port): {t:'patch',p,load}, {t:'on',n,v}, {t:'off',n}, {t:'bend',v},
//   {t:'mw',v}, {t:'at',v}, {t:'sus',on}, {t:'panic'}, {t:'release'}. Any of them may carry
//   at:<frame> (an absolute frame, as currentFrame counts) to land on an exact sample; offline
//   tests pass a whole score that way in processorOptions.events. The MIDI file player sends its
//   events that way with pb:true, plus {t:'play',on} (playback holds the device awake and its
//   notes survive the keyboard moving to the other device) and {t:'flush'} (drop every queued
//   pb event that has not landed yet; sent on stop). {t:'release'} lets go of keys the page was
//   holding (blur, tab hide, device change) and leaves pb notes sounding.
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

// ---------- filters ----------
// Both models keep their state in a Float64Array and read their input from it, for the same
// reason as the oscillators: nothing boxed per sample. A voice has two (left and right).
const F_S1 = 0, F_S2 = 1, F_S3 = 2, F_S4 = 3, F_ZI = 4, F_BP = 5, F_SH = 6, F_SAG = 7, F_IN = 8, F_OUT = 9,
  F_G = 10, F_K = 11, F_COMP = 12, F_GH = 13, F_AH = 14, F_SAGA = 15, F_LG = 16, F_V2 = 17,
  // fcoef() inputs that produced the coefficients now in F_G..F_AH (cutoff Hz, resonance, and
  // the model with the patch epoch). They live in the same array so frs.set(fl) copies them with
  // the coefficients they describe.
  F_MFC = 18, F_MRES = 19, F_MKEY = 20,
  // Sallen-Key 12: the clipped amplifier's last output and slope for the low-pass (F_Y0, F_Y1,
  // with the node voltage in F_BP) and for the high-pass (F_HY0, F_HY1, node in F_SH), and the
  // high-pass's 1/K make-up (F_HIK; its g and K sit in F_GH and F_AH).
  F_Y0 = 21, F_Y1 = 22, F_HY0 = 23, F_HY1 = 24, F_HIK = 25, F_N = 26;
class Filt {
  constructor() { this.s = new Float64Array(F_N); this.s[F_COMP] = 1; this.s[F_AH] = 1; this.s[F_LG] = 1.3; this.s[F_G] = 0.1; this.s[F_MKEY] = -1; }
  reset() { const s = this.s; s[F_S1] = s[F_S2] = s[F_S3] = s[F_S4] = s[F_ZI] = s[F_BP] = s[F_SH] = s[F_SAG] = 0; s[F_Y0] = s[F_Y1] = s[F_HY0] = s[F_HY1] = 0; }
  bad() { const s = this.s; return !(Math.abs(s[F_S1]) < 1e6 && Math.abs(s[F_S2]) < 1e6 && Math.abs(s[F_S3]) < 1e6 && Math.abs(s[F_S4]) < 1e6 && Math.abs(s[F_BP]) < 1e6); }
  flush() { const s = this.s; for (let i = 0; i < 4; i++) if (Math.abs(s[i]) < 1e-20) s[i] = 0; }
  // Ladder 24: the transistor ladder after Teemu Voipio's cheap non-linear ZDF method.
  ladder() {
    const s = this.s, y = s[F_IN], fq = s[F_G], r = s[F_K];
    let s1 = s[F_S1], s2 = s[F_S2], s3 = s[F_S3], s4 = s[F_S4];
    const ih = 0.5 * (y + s[F_ZI]); s[F_ZI] = y;
    let qa = ih - r * s4; qa *= qa;
    const t0 = ((qa + 105) * qa + 945) / ((15 * qa + 420) * qa + 945);
    qa = s1 * s1; const t1 = ((qa + 105) * qa + 945) / ((15 * qa + 420) * qa + 945);
    qa = s2 * s2; const t2 = ((qa + 105) * qa + 945) / ((15 * qa + 420) * qa + 945);
    qa = s3 * s3; const t3 = ((qa + 105) * qa + 945) / ((15 * qa + 420) * qa + 945);
    qa = s4 * s4; const t4 = ((qa + 105) * qa + 945) / ((15 * qa + 420) * qa + 945);
    const g0 = 1 / (1 + fq * t1), g1 = 1 / (1 + fq * t2), g2 = 1 / (1 + fq * t3), g3 = 1 / (1 + fq * t4);
    const f3 = fq * t3 * g3, f2 = fq * t2 * g2 * f3, f1 = fq * t1 * g1 * f2, f0 = fq * t0 * g0 * f1;
    const y3 = (g3 * s4 + f3 * g2 * s3 + f2 * g1 * s2 + f1 * g0 * s1 + f0 * y) / (1 + r * f0);
    const xx = t0 * (y - r * y3);
    const y0 = t1 * g0 * (s1 + fq * xx), yy1 = t2 * g1 * (s2 + fq * y0), yy2 = t3 * g2 * (s3 + fq * yy1);
    s1 += 2 * fq * (xx - y0); s2 += 2 * fq * (y0 - yy1); s3 += 2 * fq * (yy1 - yy2); s4 += 2 * fq * (yy2 - t4 * y3);
    s[F_S1] = s1; s[F_S2] = s2; s[F_S3] = s3; s[F_S4] = s4;
    s[F_OUT] = y3 * s[F_COMP];
  }
  // Diode 18: three capacitor nodes v1..v3. Node i charges from node i-1 through a diode pair,
  // current t_i (v_{i-1} - v_i) with t_i = tanh(d)/d at the last estimate of d, and node i+1's
  // current pulls it back by DIO_B of the same. v0 is the input less k times v3. With the t_i
  // fixed for this sample the trapezoidal equations are linear and tridiagonal (plus the
  // feedback term), solved exactly by elimination: no iteration, no allocation.
  diode() {
    const s = this.s, y = s[F_IN], g = s[F_G], k = s[F_K], B = DIO_B;
    const s1 = s[F_S1], s2 = s[F_S2], s3 = s[F_S3];
    const ih = 0.5 * (y + s[F_ZI]); s[F_ZI] = y;
    const t1 = tdx(ih - k * s3 - s1), t2 = tdx(s1 - s2), t3 = tdx(s2 - s3);
    const a = g * t1, b = g * t2, c = g * t3;
    const d1 = 1 / (1 + a + B * b), r1 = s1 + a * ih;
    const A2 = 1 + b + B * c - B * b * b * d1, B2 = a * b * k * d1 - B * c, R2 = s2 + b * r1 * d1;
    const v3 = (A2 * s3 + c * R2) / (A2 * (1 + c) + c * B2);
    const v2 = (R2 - B2 * v3) / A2;
    const v1 = (r1 + B * b * v2 - a * k * v3) * d1;
    s[F_S1] = 2 * v1 - s1; s[F_S2] = 2 * v2 - s2; s[F_S3] = 2 * v3 - s3;
    s[F_OUT] = v3 * s[F_COMP];
  }
  // Sallen-Key 12. Low-pass, normalised to w0 = 1: u is the voltage across the feedback capacitor,
  // w the node into the amplifier, y = clip(K w) its output. du/dt = x - 2(u + y) + w and
  // dw/dt = u + y - w, which is K / (s^2 + (3 - K) s + 1) when nothing clips. With
  // y = A + Y1 w (the clip's value and slope at the last sample) one trapezoidal step is a
  // linear 2x2 system; the output is then the exact clip of the new w, which is also the next
  // sample's linearisation point. The high-pass (when F_GH > 0) swaps the R and C roles: p and q
  // across its two capacitors, vb = x - p - q into its amplifier, K s^2 / (s^2 + (3 - K) s + 1).
  sk() {
    const s = this.s, g = s[F_G], K = s[F_K];
    let x = s[F_IN];
    const gh = s[F_GH];
    if (gh > 0) {
      const Kh = s[F_AH], Y1 = s[F_HY1], A = s[F_HY0] - Y1 * s[F_SH], s3 = s[F_S3], s4 = s[F_S4];
      const b11 = 1 + gh * (2 - Y1), b12 = gh * (1 - Y1), t1 = s3 + gh * ((2 - Y1) * x - A), t2 = s4 + gh * x;
      const id = 1 / (1 + gh * (3 - Y1) + gh * gh);
      const p = ((1 + gh) * t1 - b12 * t2) * id, q = (b11 * t2 - gh * t1) * id;
      s[F_S3] = 2 * p - s3; s[F_S4] = 2 * q - s4;
      const vb = x - p - q; s[F_SH] = vb;
      let uu = Kh * vb; const r = uu * (uu >= 0 ? SK_IP : SK_IN), r2 = r * r, qq = 1 / Math.sqrt(Math.sqrt(1 + r2 * r2));
      uu *= qq; s[F_HY0] = uu; s[F_HY1] = Kh * qq * qq * qq * qq * qq;
      x = uu * s[F_HIK];
    }
    const Y1 = s[F_Y1], A = s[F_Y0] - Y1 * s[F_BP], s1 = s[F_S1], s2 = s[F_S2];
    const r1 = s1 + g * (x - 2 * A), r2 = s2 + g * A, a1 = 1 + 2 * g;
    const w = (a1 * r2 + g * r1) / (1 + g * (3 - Y1) + g * g);
    const u = (r1 + g * (1 - 2 * Y1) * w) / a1;
    s[F_S1] = 2 * u - s1; s[F_S2] = 2 * w - s2; s[F_BP] = w;
    let y = K * w; const rr = y * (y >= 0 ? SK_IP : SK_IN), rq = rr * rr, qk = 1 / Math.sqrt(Math.sqrt(1 + rq * rq));
    y *= qk; s[F_Y0] = y; s[F_Y1] = K * qk * qk * qk * qk * qk;
    s[F_OUT] = y * s[F_COMP];
  }
  // Poly 24: stage i charges at g * tanh(d_i) with d_i = (its input - its output), the input of
  // stage 1 is x - k * clip(y4) and clip(z) = L tanh(z / L). With t_i = tanh(d_i)/d_i and the
  // clip's tanh(z/L)/(z/L) taken from the state (the last sample's estimate), each stage is a
  // trapezoidal one-pole of gain g t_i, so y4 is linear in the input: y4 = A u + B, solved with
  // the feedback in closed form, then the stages forward. No iteration, no allocation.
  ota() {
    const s = this.s, y = s[F_IN], g = s[F_G], k = s[F_K];
    const s1 = s[F_S1], s2 = s[F_S2], s3 = s[F_S3], s4 = s[F_S4];
    const ih = 0.5 * (y + s[F_ZI]); s[F_ZI] = y;
    // tanh(x)/x as the same Pade approximant as tdx(), written out (as in ladder()) so the five
    // calls cost no function lookups
    let qa = s4 * P24_IL; qa *= qa;
    const kf = k * ((qa + 105) * qa + 945) / ((15 * qa + 420) * qa + 945), SS = P24_SS;
    qa = (ih - kf * s4 - s1) * SS; qa *= qa; const g1 = g * ((qa + 105) * qa + 945) / ((15 * qa + 420) * qa + 945);
    qa = (s1 - s2) * SS; qa *= qa; const g2 = g * ((qa + 105) * qa + 945) / ((15 * qa + 420) * qa + 945);
    qa = (s2 - s3) * SS; qa *= qa; const g3 = g * ((qa + 105) * qa + 945) / ((15 * qa + 420) * qa + 945);
    qa = (s3 - s4) * SS; qa *= qa; const g4 = g * ((qa + 105) * qa + 945) / ((15 * qa + 420) * qa + 945);
    const i1 = 1 / (1 + g1), i2 = 1 / (1 + g2), i3 = 1 / (1 + g3), i4 = 1 / (1 + g4);
    const a1 = g1 * i1, a2 = g2 * i2, a3 = g3 * i3, a4 = g4 * i4;
    const A = a1 * a2 * a3 * a4, B = a4 * (a3 * (a2 * s1 * i1 + s2 * i2) + s3 * i3) + s4 * i4;
    const y4 = (A * ih + B) / (1 + A * kf);
    const y1 = a1 * (ih - kf * y4) + s1 * i1, y2 = a2 * y1 + s2 * i2, y3 = a3 * y2 + s3 * i3;
    s[F_S1] = 2 * y1 - s1; s[F_S2] = 2 * y2 - s2; s[F_S3] = 2 * y3 - s3; s[F_S4] = 2 * y4 - s4;
    s[F_OUT] = y4 * s[F_COMP];
  }
  // Valve 12: a 2-pole SVF lowpass whose resonance is positive feedback of the band-pass through
  // the loop tube's curve, a coupling-cap high-pass and a supply-sag follower, linearised at the
  // previous band-pass value and solved exactly (one Newton step).
  valve(lTab) {
    const s = this.s, y = s[F_IN], g = s[F_G], kq = s[F_K], R = 0.70710678, aH = s[F_AH], gH = s[F_GH];
    let s1 = s[F_S1], s2 = s[F_S2], shh = s[F_SH], sag = s[F_SAG];
    // Supply sag: a loud loop pulls the rail down, so the loop tube runs out of headroom
    // sooner. Small-signal gain is untouched, so it keeps oscillating, just lower.
    const lGe = s[F_LG] * (1 + 2.5 * s[F_SAGA] * sag);
    const v0 = s[F_BP], u0 = lGe * v0;
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
    const vH = (fbRaw - shh) * gH * aH; const lpH = vH + shh; shh = lpH + vH;
    const af = Math.abs(fbRaw);
    sag += (af - sag) * (af > sag ? 0.0005 : 0.000035);
    s[F_S1] = s1; s[F_S2] = s2; s[F_SH] = shh; s[F_SAG] = sag; s[F_BP] = bpn;
    if (kq > 0.05) s[F_V2] += fbRaw * fbRaw;
    s[F_OUT] = lp;
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
const K_OFF = 22;     // filter stereo offset, octaves (-1..1)
const K_DET = 23;     // unison detune, cents
const K_USP = 24;     // unison spread, 0..1
const K_L1PH = 25;    // LFO 1 stereo phase, degrees
const K_L2P = 26;     // LFO 2 amounts: pitch (cents), cutoff (oct), pw, amp, pan
const K_L2C = 27;
const K_L2PW = 28;
const K_L2A = 29;
const K_L2PAN = 30;
const K_L2PH = 31;    // LFO 2 stereo phase, degrees
const NP = 32;

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
    this.held = []; this.kbdHeld = new Set(); this.order = 0; this.altPan = 1;
    this.lfoG = new Float64Array(2);        // global LFO phases
    this.gsh = new Float64Array(10);        // global LFO random state, 5 per LFO: curL, prevL, curR, prevR, lastPhase
    this.lfoRate = new Float64Array(2); this.lfoDelay = new Float64Array(2); this.lfoWave = new Int32Array(2); this.lfoGlob = new Int32Array(2);
    this.lfoG0 = new Float64Array(2); this.LV = new Float64Array(4);   // per tick: LFO1 L, LFO1 R, LFO2 L, LFO2 R
    this.cc = new Float64Array(4);
    this.duck = 1; this.duckDir = 0; this.pendingPatch = null;
    this.events = [];
    this.active = o.active !== false; this.playing = !!o.playing; this.idleN = 0;
    this.meterN = 0; this.v1Acc = 0; this.v2Acc = 0; this.accN = 0; this.cpuMs = 0; this.cpuFrames = 0;
    this.coefEpoch = 0;
    this.P = null; this.S = new Float64Array(NP); this.Sp = new Float64Array(NP); this.T = new Float64Array(NP); this.CT = new Float64Array(NP * (128 / CTRL + 1));
    this.setPatch(o.patch || {}, true);
    this.target(this.S); this.Sp.set(this.S);
    (o.events || []).forEach(e => this.events.push(e));
    this.events.sort((a, b) => (a.at || 0) - (b.at || 0));
    this.port.onmessage = e => this.onMsg(e.data);
  }

  newVoice(i) {
    return {
      i, on: false, note: 60, vel: 0.8, gate: false, sust: false, pb: false, age: 0, pan: 0, gl: 0.7071, gr: 0.7071,
      pitch: 60, pitchT: 60, o1: new Osc(), o2: new Osc(), sub: new Osc(),
      ae: 0, as: E_IDLE, fe: 0, fs: E_IDLE, pending: null, fade: 1, killing: false,
      fL: new Filt(), fR: new Filt(), st2: false, uPos: 0, lastPan: 9,
      dcx: 0, dcy: 0,
      nb0: 0, nb1: 0, nb2: 0,
      drift: 0, driftT: 0, driftN: 0, drift2: 0, drift2T: 0,
      lp: Float64Array.from([Math.random(), Math.random()]), lsh: new Float64Array(10), lfoAge: 0,
      cm: Float64Array.of(NaN, 1, NaN, 1, NaN, 1, NaN, 1),   // exponent memos for the control tick
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
    this.coefEpoch++;                     // lTube and vComp may change: fcoef() memos are stale
    this.v1Tube = this.tubes[v1.tube] || this.tubes['12AX7'] || { gain: 0.774, hp: 25 };
    this.v1Tab = this.table(v1.tube || '12AX7', +v1.bias || 0);
    this.lTube = this.tubes[f.tube] || this.tubes['12AT7'] || { gain: 0.701, hp: 25 };
    this.lTab = this.table(f.tube || '12AT7', +f.bias || 0);
    // Sallen-Key 12's high-pass partner: off at the bottom of its knob (20 Hz)
    { const hp = num(f.hp, 20); this.skGh = hp > 20.5 ? Math.tan(Math.PI * Math.min(hp, this.sr * 0.2) / this.fs) : 0; }
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
    const vo = P.voice || {}, st = P.stereo || {}, l2 = P.lfo2 || {};
    T[K_OFF] = clamp(num(f.offset, 0), -1, 1); T[K_DET] = num(vo.detune, 12); T[K_USP] = clamp(num(st.uspread, 0.5), 0, 1);
    T[K_L1PH] = clamp(num(l.phase, 0), 0, 180);
    T[K_L2P] = num(l2.pitch, 0); T[K_L2C] = num(l2.cutoff, 0); T[K_L2PW] = num(l2.pw, 0); T[K_L2A] = num(l2.amp, 0);
    T[K_L2PAN] = clamp(num(l2.pan, 0), 0, 1); T[K_L2PH] = clamp(num(l2.phase, 0), 0, 180);
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
      case 'on': this.noteOn(m.n | 0, num(m.v, 0.8), !!m.pb); break;
      case 'off': this.noteOff(m.n | 0); break;
      case 'bend': this.bend = clamp(num(m.v, 0), -1, 1); break;
      case 'mw': this.mw = clamp(num(m.v, 0), 0, 1); break;
      case 'at': this.at = clamp(num(m.v, 0), 0, 1); break;
      case 'sus': this.sus = !!m.on; if (!this.sus) this.releaseSustained(); break;
      case 'panic':
        this.held = []; this.kbdHeld.clear(); this.sus = false;
        this.voices.forEach(v => { v.on = false; v.as = E_IDLE; v.ae = 0; v.gate = false; v.sust = false; v.pb = false; v.pending = null; });
        break;
      case 'release': this.releaseInput(); break;
      case 'play': this.playing = !!m.on; break;
      case 'flush': this.events = this.events.filter(e => !e.pb); break;
      case 'active':      // the rack moved the keyboard to another device: let go of every key, let the tails ring
        this.active = !!m.on;
        if (!this.active && !this.playing) {
          this.held = []; this.kbdHeld.clear(); this.sus = false;
          this.voices.forEach(v => { v.sust = false; v.pb = false; v.pending = null; if (v.on && v.as !== E_IDLE) { v.gate = false; v.as = E_REL; v.fs = E_REL; } });
        } else if (!this.active && this.playing) this.releaseInput();
        break;
    }
  }

  // ----- notes -----
  mode() { return ((this.P.voice || {}).mode) || 'poly'; }
  count() { return clamp(((this.P.voice || {}).count) | 0 || 8, 1, NV); }
  uni() { return clamp(num((this.P.voice || {}).unison, 1) | 0, 1, 8); }
  // Unison stacks copies from the same pool: polyphony is the voice count, and the pool grows to
  // count x unison (at most 16), so turning unison up costs voices only past 16.
  pool() { return Math.min(NV, this.count() * this.uni()); }
  noteOn(n, vel, pb) {
    pb = !!pb;
    if (pb) this.kbdHeld.delete(n); else this.kbdHeld.add(n);
    this.held = this.held.filter(h => h !== n); this.held.push(n);
    const mode = this.mode(), U = this.uni();
    if (mode !== 'poly') {
      const glideOff = num((this.P.voice || {}).glide, 0) <= 0;
      for (let j = 0; j < NV; j++) {
        const v = this.voices[j];
        if (j >= U) { if (v.on && v.gate) { v.gate = false; v.as = E_REL; v.fs = E_REL; } continue; }
        const legato = mode === 'legato' && v.gate && v.on;
        v.note = n; v.pitchT = n; v.vel = vel; v.gate = true; v.sust = false; v.pb = pb;
        v.uPos = U > 1 ? j / (U - 1) * 2 - 1 : 0;
        if (!v.on) { v.pitch = n; this.startVoice(v, n, vel, true, j, U, pb); }
        else if (!legato) this.trigger(v, vel);
        if (glideOff) v.pitch = n;
      }
      return;
    }
    const N = this.pool(), age0 = this.order;
    let found = 0;
    for (let i = 0; i < NV; i++) { const w = this.voices[i]; if (w.on && w.note === n && !w.killing) { w.gate = true; w.sust = false; w.pb = pb; this.trigger(w, vel); w.age = ++this.order; found++; } }
    if (found) return;
    for (let j = 0; j < U; j++) {
      let v = null;
      for (let i = 0; i < N; i++) { const w = this.voices[i]; if (!w.on && !w.pending) { v = w; break; } }
      if (v) { this.startVoice(v, n, vel, false, j, U, pb); continue; }
      // steal: the oldest released voice, else the quietest, never a copy this note just took
      let best = null;
      for (let i = 0; i < N; i++) { const w = this.voices[i]; if (w.age > age0 || w.pending) continue; if (!w.gate && !w.sust && (!best || w.age < best.age)) best = w; }
      if (!best) for (let i = 0; i < N; i++) { const w = this.voices[i]; if (w.age > age0 || w.pending) continue; if (!best || w.ae < best.ae) best = w; }
      if (!best) break;
      best.pending = { n, vel, j, U, pb }; best.killing = true; best.gate = false; best.age = ++this.order;
    }
  }
  startVoice(v, n, vel, mono, j, U, pb) {
    const P = this.P;
    v.on = true; v.note = n; v.vel = vel; v.gate = true; v.sust = false; v.pb = !!pb; v.killing = false; v.fade = 1; v.pending = null;
    v.age = ++this.order;
    v.uPos = (U || 1) > 1 ? (j || 0) / (U - 1) * 2 - 1 : 0;
    if (!mono || num((P.voice || {}).glide, 0) <= 0) v.pitch = n;
    v.pitchT = n;
    // pan (unison copies share their note's pan and spread around it)
    const st = P.stereo || {}, spread = clamp(num(st.spread, 0.5), 0, 1), pm = st.pan || 'alt';
    let pan = 0;
    if (!j) { if (pm === 'alt') { this.altPan = -this.altPan; pan = this.altPan * spread; }
      else if (pm === 'key') pan = clamp((n - 60) / 30, -1, 1) * spread;
      else if (pm === 'random') pan = (Math.random() * 2 - 1) * spread;
      this.lastPan = pan; }
    else pan = this.lastPan || 0;
    v.pan = pan;
    // per-voice LFOs restart with the note
    if ((P.lfo1 || {}).mode === 'voice') v.lp[0] = 0;
    if ((P.lfo2 || {}).mode === 'voice') v.lp[1] = 0;
    v.lfoAge = 0;
    v.ae = 0; v.fe = 0;
    // a whisper of thermal noise in the filters, so a self-oscillating filter starts on its own
    for (const F of [v.fL, v.fR]) if (F.s[F_S1] === 0 && F.s[F_S2] === 0) { F.s[F_S1] = (Math.random() - 0.5) * 1e-3; F.s[F_BP] = F.s[F_S1]; }
    this.trigger(v, vel);
  }
  trigger(v, vel) { v.as = E_ATT; v.fs = E_ATT; v.vel = vel; v.lfoAge = 0; }
  noteOff(n) {
    this.kbdHeld.delete(n);
    this.held = this.held.filter(h => h !== n);
    const mode = this.mode();
    if (mode !== 'poly') {
      if (this.voices[0].note !== n) return;
      const U = this.uni();
      for (let j = 0; j < U; j++) {
        const v = this.voices[j];
        if (this.held.length) {             // fall back to the previous held note
          const m = this.held[this.held.length - 1];
          v.note = m; v.pitchT = m;
          if (num((this.P.voice || {}).glide, 0) <= 0) v.pitch = m;
          if (mode === 'mono') this.trigger(v, v.vel);
          continue;
        }
        if (this.sus) { v.sust = true; v.gate = false; continue; }
        v.gate = false; if (v.as !== E_IDLE) { v.as = E_REL; v.fs = E_REL; }
      }
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
  // Let go of keys the page is holding. Notes a MIDI file already started (pb) keep sounding,
  // including ones the sustain pedal is holding for the player.
  releaseInput() {
    this.kbdHeld.clear();
    const pbNotes = new Set();
    let pbSus = false;
    for (let i = 0; i < NV; i++) {
      const v = this.voices[i];
      if (v.pending) { if (v.pending.pb) pbNotes.add(v.pending.n); else v.pending = null; }
      if (v.pb) {
        if (v.on && (v.gate || v.sust)) pbNotes.add(v.note);
        if (v.sust) pbSus = true;
        continue;
      }
      v.sust = false;
      if (v.on && v.as !== E_IDLE) { v.gate = false; v.as = E_REL; v.fs = E_REL; }
    }
    this.sus = pbSus;
    this.held = this.held.filter(n => pbNotes.has(n));
  }

  // ----- audio -----
  process(inputs, outputs) {
    const t0 = Date.now();
    const out = outputs[0], L = out[0], R = out[1] || out[0], n = L.length;
    const L2 = this.L2, R2 = this.R2;
    const base = currentFrame;
    // Asleep: no voice has sounded for 100 ms (the decimators and DC blockers have run down) and
    // no note is due in this block. A second device in the rack costs nothing while it waits.
    if (this.idleN >= C_IDLE_FR && !(this.events.length && (this.events[0].at || 0) < base + n)) {
      let any = false; for (let i = 0; i < NV; i++) if (this.voices[i].on) { any = true; break; }
      if (!any) {
        if (this.pendingPatch) {
          const oldModel = (this.P.filt || {}).model;
          this.setPatch(this.pendingPatch); this.pendingPatch = null; this.duck = 1; this.duckDir = 0;
          if ((this.P.filt || {}).model !== oldModel) for (const v of this.voices) { v.fL.reset(); v.fR.reset(); }
        }
        this.target(this.S); this.Sp.set(this.S);
        for (let q = 0; q < 2; q++) this.lfoG[q] = (this.lfoG[q] + clamp(num(((q ? this.P.lfo2 : this.P.lfo1) || {}).rate, q ? 0.2 : 5), 0.01, 40) * n / this.sr) % 1;
        L.fill(0); if (R !== L) R.fill(0);
        this.meterOut(n, t0);
        return true;
      }
    }
    L2.fill(0, 0, n * OS); R2.fill(0, 0, n * OS);
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
    let any = false; for (let i = 0; i < NV; i++) if (this.voices[i].on) { any = true; break; }
    this.idleN = any ? 0 : this.idleN + n;
    this.meterOut(n, t0);
    return true;
  }
  // meters, about 30 a second
  meterOut(n, t0) {
    this.cpuMs += Date.now() - t0; this.cpuFrames += n;
    this.meterN += n;
    if (this.meterN >= this.sr / 30) {
      const act = this.voices.filter(v => v.on);
      this.port.postMessage({
        t: 'meter', dev: 'filament', v1: Math.sqrt(this.v1Acc / Math.max(1, this.accN)), v2: Math.sqrt(this.v2Acc / Math.max(1, this.accN)),
        voices: act.length, notes: act.filter(v => v.gate || v.sust).map(v => v.note),
        cpu: this.cpuMs / (this.cpuFrames / this.sr * 1000),
      });
      this.meterN = 0; this.v1Acc = 0; this.v2Acc = 0; this.accN = 0;
      if (this.cpuFrames > this.sr) { this.cpuMs *= 0.5; this.cpuFrames *= 0.5; }
    }
  }

  // Cutoff calibration and coefficients for one filter, at control rate. fc and res come in
  // through this.cc so nothing is boxed: cc[0] = fc (Hz), cc[1] = resonance 0..1.
  // Skipped when the inputs match the last call for this filter, which is every tick of a held
  // note whose cutoff is not moving: the coefficients already in F.s are the ones it would write.
  fcoef(F, model) {
    const sr = this.sr, fs = this.fs, res = this.cc[1], s = F.s, key = this.coefEpoch * 5 + model;
    if (s[F_MFC] === this.cc[0] && s[F_MRES] === res && s[F_MKEY] === key) return;
    s[F_MFC] = this.cc[0]; s[F_MRES] = res; s[F_MKEY] = key;
    let fc = clamp(this.cc[0], 16, sr * 0.45);
    if (model === 4) {
      // Poly 24: like the ladder, the saturating stages pull a self-oscillating filter flat by an
      // amount set by how far the loop gain is past 4 (P24_CAL, cents per unit over, measured).
      const over = res * P24_KMAX - 4;
      if (over > 0) { const g0 = Math.PI * fc / fs; fc *= Math.pow(2, over * (P24_CAL[0] + P24_CAL[1] * g0) / 1200); }
    } else if (model === 3) {
      // Sallen-Key: K runs from the flat (Butterworth) point at zero resonance to 3, where it
      // oscillates, at SK_RT, then on to SK_KMAX. Past the threshold the clip holds the loop at
      // 3 on average and the waveform squares; SK_CAL raises the cutoff by the cents the clipped
      // loop runs flat ((a + b e + c e^2) e, e running 0..1 from the threshold to full resonance).
      if (res > SK_RT) { const e = (res - SK_RT) / (1 - SK_RT); fc *= Math.pow(2, (SK_CAL[0] + (SK_CAL[1] + SK_CAL[2] * e) * e) * e / 1200); }
    } else if (model === 2) {
      // Diode: below the oscillation point the node frequency is lifted (DIO_LIFT at zero
      // resonance, easing out by the threshold) so the passband sits near Ladder 24's for the same
      // knob; at and past it the loop oscillates at the knob. Past it the diodes pull the pitch
      // flat by a measured amount per unit of loop gain over the threshold (DIO_CAL, cents).
      const u = res * DIO_KMAX / DIO_K0;
      if (u < 1) { const e = 1 - u; fc *= 1 + (DIO_LIFT - 1) * e * e; }
      else {
        const g0 = Math.PI * fc / fs, e = Math.min(1, (u - 1) / (DIO_KMAX / DIO_K0 - 1));
        fc *= Math.pow(2, (DIO_CAL[0] + (DIO_CAL[1] + DIO_CAL[2] * g0) * g0) * (1.47 - 0.47 * e) * e / 1200);
      }
    } else if (model === 1) {
      // Ladder: the tanh stages pull a self-oscillating filter flat, by an amount set by how
      // far the loop gain is past 4 (measured: about 86 cents per unit, a little less up high).
      const over = res * 4.45 - 4;
      if (over > 0) { const g0 = Math.PI * fc / fs; fc *= Math.pow(2, over * (86 - 280 * g0) / 1200); }
    } else if (res > 0.6) {
      // Valve: the coupling cap's phase lead pushes the resonance up; pull the cutoff down to
      // match, fully from the point where the loop can oscillate (RES_T). Past that point
      // the saturating tube pulls it flat again, by a measured amount per tube (VCAL, cents).
      const vCal = VCAL[this.lTube.id] || VCAL0;
      const w = res >= RES_T ? 1 : (res - 0.6) / (RES_T - 0.6), ws = w * w * (3 - 2 * w);
      fc *= 1 + (this.vComp - 1) * ws;
      const e = res > RES_T ? (res - RES_T) / (1 - RES_T) : 0;
      fc *= Math.pow(2, -(vCal[0] * ws + vCal[1] * e + vCal[2] * e * e) / 1200);
    }
    fc = clamp(fc, 16, sr * 0.45);
    s[F_G] = Math.tan(Math.PI * fc / fs);
    if (model === 4) { s[F_K] = res * P24_KMAX; s[F_COMP] = 1 + s[F_K] * P24_COMP; }
    else if (model === 3) {
      const K = res <= SK_RT ? SK_K0 + (3 - SK_K0) * res / SK_RT : 3 + (SK_KMAX - 3) * (res - SK_RT) / (1 - SK_RT);
      s[F_K] = K; s[F_COMP] = 1 / K;
      const Kh = SK_K0 + (K - SK_K0) * SK_HPK;
      s[F_GH] = this.skGh; s[F_AH] = Kh; s[F_HIK] = 1 / Kh;
    } else if (model === 2) { s[F_G] /= DIO_W0; s[F_K] = res * DIO_KMAX; s[F_COMP] = 1 + s[F_K] * DIO_COMP; }
    else if (model === 1) { s[F_K] = res * 4.45; s[F_COMP] = 1 + s[F_K] * 0.45; }
    else {
      // The coupling cap in the Valve loop sits a fixed ratio below the cutoff (each tube's hp/400),
      // so its phase lead, and the pitch shift that comes with it, is the same on every key.
      s[F_K] = KMAX * Math.pow(res, KEXP);
      s[F_GH] = Math.tan(Math.PI * Math.min(fc * (this.lTube.hp || 25) / 400, sr * 0.2) / fs); s[F_AH] = 1 / (1 + s[F_GH]);
    }
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
      if ((this.P.filt || {}).model !== oldModel) for (const v of this.voices) { v.fL.reset(); v.fR.reset(); }
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

    // ---- LFOs (two, each global or per voice, each with a stereo phase) ----
    const LP = [P.lfo1 || {}, P.lfo2 || {}];
    const lRate = this.lfoRate, lDelay = this.lfoDelay, lWave = this.lfoWave, lGlob = this.lfoGlob, lG0 = this.lfoG0;
    for (let q = 0; q < 2; q++) {
      lRate[q] = clamp(num(LP[q].rate, q ? 0.2 : 5), 0.01, 40); lDelay[q] = Math.max(0, num(LP[q].delay, 0));
      lWave[q] = LWAVES[LP[q].wave] ?? 0; lGlob[q] = LP[q].mode === 'voice' ? 0 : 1;
      lG0[q] = this.lfoG[q]; this.lfoG[q] = (this.lfoG[q] + lRate[q] * frames / sr) % 1;
    }
    const LV = this.LV, gsh = this.gsh;
    // An LFO nobody listens to costs nothing: skip it (its phase still runs).
    const lUse0 = S[K_LP] > 0 || this.T[K_LP] > 0 || S[K_LC] > 0 || this.T[K_LC] > 0 || S[K_LPW] > 0 || this.T[K_LPW] > 0 || S[K_LA] > 0 || this.T[K_LA] > 0 || mwvAny(P, this);
    const lUse1 = S[K_L2P] > 0 || this.T[K_L2P] > 0 || S[K_L2C] > 0 || this.T[K_L2C] > 0 || S[K_L2PW] > 0 || this.T[K_L2PW] > 0 || S[K_L2A] > 0 || this.T[K_L2A] > 0 || S[K_L2PAN] > 0 || this.T[K_L2PAN] > 0;
    const sx = num(P.tune, 0) / 100;

    // patch values read once
    const o1 = P.osc1 || {}, o2 = P.osc2 || {}, sb = P.sub || {}, nz = P.noise || {}, f = P.filt || {};
    const w1 = WAVES[o1.wave] ?? W_SAW, w2 = WAVES[o2.wave] ?? W_SAW, ws = sb.wave === 'sine' ? W_SINE : W_PULSE;
    const subDiv = sb.oct === 2 ? 4 : 2;
    const off1 = num(o1.oct, 0) * 12 + num(o1.semi, 0) + num(o1.fine, 0) / 100;
    const off2 = num(o2.oct, 0) * 12 + num(o2.semi, 0) + num(o2.fine, 0) / 100;
    const fix1 = num(o1.fixed, 0), fix2 = num(o2.fixed, 0);
    const sync = !!o2.sync, pink = nz.color === 'pink';
    const model = f.model === 'ladder24' ? 1 : f.model === 'diode18' ? 2 : f.model === 'sk12' ? 3 : f.model === 'poly24' ? 4 : 0;
    const ea = P.envA || {}, ef = P.envF || {};
    const aA = coef(Math.max(0.001, num(ea.a, 0.005)) / 1.466, sr), aD = coef(Math.max(0.001, num(ea.d, 0.3)) / 4.6, sr), aS = clamp(num(ea.s, 0.8), 0, 1), aR = coef(Math.max(0.003, num(ea.r, 0.3)) / 4.6, sr);
    const fA = coef(Math.max(0.001, num(ef.a, 0.005)) / 1.466, sr), fD = coef(Math.max(0.001, num(ef.d, 0.3)) / 4.6, sr), fS = clamp(num(ef.s, 0.5), 0, 1), fR = coef(Math.max(0.003, num(ef.r, 0.3)) / 4.6, sr);
    const velA = clamp(num(ea.vel, 0.5), 0, 1);
    const vo = P.voice || {}, glide = Math.max(0, num(vo.glide, 0)), gk = glide > 0 ? 1 - Math.exp(-CTRL / (glide * sr)) : 1;
    const bendR = num(vo.bend, 2), driftC = clamp(num(P.drift, 1.5), 0, 8);
    const mwv = num((P.mw || {}).vib, 30), mwc = num((P.mw || {}).cut, 0), atc = num((P.at || {}).cut, 1), atv = num((P.at || {}).vib, 0);
    const lG = 1.3 * Math.pow((this.lTube.gain || 0.774) / 0.774, LGX);
    const v1Tab = this.v1Tab, lTab = this.lTab;
    const dcA = 1 - TWO_PI * 15 / fs;
    const L2 = this.L2, R2 = this.R2;
    const N = this.pool(), U = this.uni(), uniG = 1 / Math.sqrt(U);
    const l2Any = S[K_L2] > 1e-4 || this.T[K_L2] > 0 || Sp[K_L2] > 1e-4;
    const lsAny = S[K_LS] > 1e-4 || this.T[K_LS] > 0 || Sp[K_LS] > 1e-4;
    // Two filters per voice only when something makes left and right differ.
    const st2 = Math.abs(S[K_OFF]) > 1e-4 || Math.abs(this.T[K_OFF]) > 0 ||
      (S[K_LC] > 0 && S[K_L1PH] > 0.01) || (S[K_L2C] > 0 && S[K_L2PH] > 0.01);
    const cc = this.cc, isLadder = model === 1, isDiode = model === 2, isSk = model === 3, isOta = model === 4;

    // smoothed parameters at each control tick, shared by every voice
    const CT = this.CT, nt = Math.ceil(frames / CTRL);
    for (let t = 0; t < nt; t++) { const kk = t * CTRL / frames, o = t * NP; for (let j = 0; j < NP; j++) CT[o + j] = Sp[j] + (S[j] - Sp[j]) * kk; }

    let v1Acc = 0, v2Acc = 0;
    let fdK = NaN, fdGk = 1, fdCk = 1;    // filter drive gain is shared by every voice: one pow per change
    for (let vi = 0; vi < NV; vi++) {
      const v = this.voices[vi];
      if (!v.on) continue;
      if (vi >= N && this.mode() === 'poly' && v.as !== E_REL && !v.killing) { v.as = E_REL; v.fs = E_REL; v.gate = false; }
      const o1o = v.o1, o2o = v.o2, so = v.sub, FL = v.fL, FR = v.fR, fl = FL.s, frs = FR.s;
      if (st2 && !v.st2) frs.set(fl);               // the right filter starts where the left one is
      v.st2 = st2;
      FL.s[F_LG] = lG; FR.s[F_LG] = lG;
      let dcx = v.dcx, dcy = v.dcy, nb0 = v.nb0, nb1 = v.nb1, nb2 = v.nb2;
      let ae = v.ae, fe = v.fe, as = v.as, fst = v.fs;
      let dt1 = v.dt1, dt2 = v.dt2, dts = v.dts, pw1 = v.pw1, pw2 = v.pw2, ampL = 1, ampR = 1, gl = 0.7071, gr = 0.7071;
      let fdG = 1, fdC = 1;
      let fade = v.fade;
      let l1 = 0, l2 = 0, ls = 0, ln = 0, fm = 0, ring = 0, G1 = 1, mk1 = 1, vol = 0;
      const use2 = l2Any || sync, useS = lsAny;
      for (let i = a; i < b; i++) {
        const fr = i - a;
        // ---- control tick ----
        if (fr % CTRL === 0) {
          const cb = ((fr / CTRL) | 0) * NP;
          v.lfoAge += CTRL / sr;
          // LFOs: left and right values for each. Random waves take the phase knob as how far
          // the right side wanders on its own (0 = same as left, 180 = independent).
          for (let q = 0; q < 2; q++) {
            if (q ? !lUse1 : !lUse0) { LV[q * 2] = 0; LV[q * 2 + 1] = 0; if (!lGlob[q]) v.lp[q] = (v.lp[q] + lRate[q] * CTRL / sr) % 1; continue; }
            let ph;
            if (lGlob[q]) ph = (lG0[q] + lRate[q] * fr / sr) % 1;
            else { v.lp[q] = (v.lp[q] + lRate[q] * CTRL / sr) % 1; ph = v.lp[q]; }
            const phOff = CT[cb + (q ? K_L2PH : K_L1PH)] / 360;
            let vL = 0, vR = 0;
            const wv = lWave[q];
            if (wv >= 4) {
              const R5 = lGlob[q] ? gsh : v.lsh, o = q * 5;
              if (ph < R5[o + 4] || R5[o + 4] === 0) {
                R5[o + 1] = R5[o]; R5[o] = Math.random() * 2 - 1; R5[o + 3] = R5[o + 2]; R5[o + 2] = Math.random() * 2 - 1;
              }
              R5[o + 4] = ph > 0 ? ph : 1e-9;
              const sm = 0.5 - 0.5 * Math.cos(Math.PI * ph);
              const aL = wv === 4 ? R5[o] : R5[o + 1] + (R5[o] - R5[o + 1]) * sm;
              const aR = wv === 4 ? R5[o + 2] : R5[o + 3] + (R5[o + 2] - R5[o + 3]) * sm;
              const wR = phOff * 2;               // 0..1
              vL = aL; vR = aL * (1 - wR) + aR * wR;
            } else {
              for (let c = 0; c < 2; c++) {
                if (c && phOff === 0) { vR = vL; break; }
                let x = c ? ph + phOff : ph; x -= Math.floor(x);
                let y;
                if (wv === 1) y = x < 0.5 ? 4 * x - 1 : 3 - 4 * x;
                else if (wv === 2) y = 1 - 2 * x;
                else if (wv === 3) y = x < 0.5 ? 1 : -1;
                else y = Math.sin(TWO_PI * x);
                if (c) vR = y; else vL = y;
              }
            }
            const fadeQ = lDelay[q] > 0 ? clamp((v.lfoAge - lDelay[q] * 0.5) / (lDelay[q] * 0.5), 0, 1) : 1;
            LV[q * 2] = vL * fadeQ; LV[q * 2 + 1] = vR * fadeQ;
          }
          const l1L = LV[0], l1R = LV[1], l2L = LV[2], l2R = LV[3];
          // drift: smooth random walk per voice
          if (--v.driftN <= 0) { v.driftT = Math.random() * 2 - 1; v.drift2T = Math.random() * 2 - 1; v.driftN = (0.3 + Math.random() * 0.6) * sr / CTRL; }
          v.drift += (v.driftT - v.drift) * 0.0003; v.drift2 += (v.drift2T - v.drift2) * 0.0003;
          // pitch: LFOs, wheel and pressure, unison detune, drift
          v.pitch += (v.pitchT - v.pitch) * gk;
          const vib = ((CT[cb + K_LP] + this.mw * mwv + this.at * atv) * l1L + CT[cb + K_L2P] * l2L) / 100;
          const det = v.uPos * CT[cb + K_DET] / 100;
          const pn = v.pitch + this.bend * bendR + sx + vib + det + driftC * v.drift / 100;
          // cm[4..7]: the same memo for the two oscillator pitches (they move every tick under drift)
          const cm = v.cm;
          let f1, f2;
          if (fix1 > 0) f1 = fix1 * Math.pow(2, (vib + det + driftC * v.drift / 100) / 12);
          else { const e1 = (pn + off1 - 69) / 12; if (e1 !== cm[4]) { cm[4] = e1; cm[5] = Math.pow(2, e1); } f1 = 440 * cm[5]; }
          if (fix2 > 0) f2 = fix2;
          else { const e2 = (pn + off2 + driftC * 0.5 * v.drift2 / 100 - 69) / 12; if (e2 !== cm[6]) { cm[6] = e2; cm[7] = Math.pow(2, e2); } f2 = 440 * cm[7]; }
          dt1 = Math.min(f1 / fs, 0.45); dt2 = Math.min(f2 / fs, 0.45); dts = dt1 / subDiv;
          const pwm = (CT[cb + K_LPW] * l1L + CT[cb + K_L2PW] * l2L) * 0.5;
          pw1 = clamp(CT[cb + K_PW1] + pwm, 0.03, 0.97); pw2 = clamp(CT[cb + K_PW2] + pwm, 0.03, 0.97);
          // filter cutoffs, left and right
          const oct = CT[cb + K_KT] * (v.pitch - 60) / 12 + CT[cb + K_ENV] * 7 * fe + CT[cb + K_VELF] * (v.vel - 0.79) * 3
            + this.mw * mwc + this.at * atc;
          const res = clamp(CT[cb + K_RES], 0, 1), half = CT[cb + K_OFF] * 0.5;
          cc[1] = res;
          // cm[0..3]: the last cutoff exponent and its power of two for each side: a still cutoff costs no pow
          const eL = oct + CT[cb + K_LC] * l1L + CT[cb + K_L2C] * l2L - (st2 ? half : 0);
          if (eL !== cm[0]) { cm[0] = eL; cm[1] = Math.pow(2, eL); }
          cc[0] = CT[cb + K_CUT] * cm[1];
          this.fcoef(FL, model);
          if (st2) {
            const eR = oct + CT[cb + K_LC] * l1R + CT[cb + K_L2C] * l2R + half;
            if (eR !== cm[2]) { cm[2] = eR; cm[3] = Math.pow(2, eR); }
            cc[0] = CT[cb + K_CUT] * cm[3]; this.fcoef(FR, model);
          }
          const sagA = clamp(CT[cb + K_SAG], 0, 10) / 10; fl[F_SAGA] = sagA; frs[F_SAGA] = sagA;
          const fd = clamp(CT[cb + K_FDRV], 0, 10);
          if (fd !== fdK) { fdK = fd; fdGk = Math.pow(2, (fd - 3) / 3); fdCk = 1 / Math.sqrt(fdGk); }
          fdG = fdGk; fdC = fdCk;
          // amplitude: tremolo per side
          const la1 = clamp(CT[cb + K_LA], 0, 1), la2 = clamp(CT[cb + K_L2A], 0, 1);
          ampL = (1 - la1 * (0.5 - 0.5 * l1L)) * (1 - la2 * (0.5 - 0.5 * l2L));
          ampR = (1 - la1 * (0.5 - 0.5 * l1R)) * (1 - la2 * (0.5 - 0.5 * l2R));
          // pan: the note's pan, its unison place, and LFO 2's auto-pan
          const pan = clamp(v.pan + v.uPos * CT[cb + K_USP] + CT[cb + K_L2PAN] * l2L, -1, 1);
          if (pan !== v.lastPan) { v.lastPan = pan; v.gl = Math.cos((pan + 1) * Math.PI / 4); v.gr = Math.sin((pan + 1) * Math.PI / 4); }
          gl = v.gl; gr = v.gr;
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
        const amp = ae * (1 - velA * (1 - v.vel)) * fade * duck * vol * 0.5 * uniG * fdC;
        const aLg = amp * ampL * gl, aRg = amp * ampR * gr;
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
          const x = (x1 * l1 + x2 * l2 + xs * ls + xn * ln) * 0.6;
          // V1 drive tube, then a coupling cap (15 Hz) to stop its DC reaching the filter
          v1Acc += x * x;
          let y;
          { const tp = (G1 * x + TT_R) * TT_SCALE;
            if (tp <= 0) y = v1Tab[0]; else if (tp >= TT_N - 1) y = v1Tab[TT_N - 1];
            else { const ti = tp | 0; y = v1Tab[ti] + (v1Tab[ti + 1] - v1Tab[ti]) * (tp - ti); }
            y = y / G1 * mk1; }
          dcy = y - dcx + dcA * dcy; dcx = y; y = dcy * fdG;
          // filter(s)
          fl[F_IN] = y;
          if (isLadder) FL.ladder(); else if (isOta) FL.ota(); else if (isDiode) FL.diode(); else if (isSk) FL.sk(); else FL.valve(lTab);
          const yl = fl[F_OUT];
          let yr = yl;
          if (st2) { frs[F_IN] = y; if (isLadder) FR.ladder(); else if (isOta) FR.ota(); else if (isDiode) FR.diode(); else if (isSk) FR.sk(); else FR.valve(lTab); yr = frs[F_OUT]; }
          const idx = i * OS + s;
          L2[idx] += yl * aLg; R2[idx] += yr * aRg;
        }
      }
      // write back
      v.dcx = dcx; v.dcy = dcy; v.nb0 = nb0; v.nb1 = nb1; v.nb2 = nb2;
      v.ae = ae; v.fe = fe; v.as = as; v.fs = fst; v.dt1 = dt1; v.dt2 = dt2; v.dts = dts; v.pw1 = pw1; v.pw2 = pw2;
      v.fade = fade;
      v2Acc += fl[F_V2] + (st2 ? frs[F_V2] : 0); fl[F_V2] = 0; frs[F_V2] = 0;
      // flush denormals / blow-ups
      if (FL.bad() || FR.bad()) { FL.reset(); FR.reset(); } else { FL.flush(); FR.flush(); }
      if (as === E_IDLE || (v.killing && fade <= 0)) {
        v.on = false; v.as = E_IDLE; v.ae = 0; v.killing = false; v.fade = 1; v.st2 = false;
        FL.reset(); FR.reset();
        if (v.pending) { const pnd = v.pending; v.pending = null; this.startVoice(v, pnd.n, pnd.vel, false, pnd.j, pnd.U, pnd.pb); }
      }
    }
    // a stale NaN would poison the decimator forever (written as two compares: same result as
    // !(Math.abs(x) < 1e3) for every x, NaN included, and measurably cheaper here)
    for (let i = a * OS; i < b * OS; i++) { const l = L2[i], r = R2[i]; if (!(l < 1e3 && l > -1e3)) L2[i] = 0; if (!(r < 1e3 && r > -1e3)) R2[i] = 0; }
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
// Diode 18. DIO_B: how hard each stage loads the one before it (0 is three buffered one-poles,
// 1 a plain RC ladder). With 0.5 the linear loop rings at DIO_W0 = sqrt(17)/2 times the node
// frequency and oscillates once k passes DIO_K0 = 16 (worked out from the nodal equations, and
// checked numerically). Full resonance takes k 11% past it. DIO_LIFT puts the zero-resonance
// -3 dB point near Ladder 24's (0.435 of the knob). DIO_COMP makes up most of the passband the
// feedback takes away (1 / (1 + k) at DC). DIO_CAL: the cents the cutoff is raised by past the threshold,
// a + b g0 + c g0^2 with g0 = pi fc / fs at full resonance, shaped by 1.47 e - 0.47 e^2 as e runs
// 0..1 from the threshold to full (measured in Node renders of the voice, 36 to 108, cutoff 262 Hz).
const DIO_B = 0.5, DIO_W0 = 2.0615528128088303, DIO_K0 = 16, DIO_KMAX = 16 / 0.9, DIO_LIFT = 2.94, DIO_COMP = 0.62;
const DIO_CAL = [209, -1209, 2775];
// Sallen-Key 12. SK_K0 = 3 - sqrt(2): equal parts and that gain give a flat (Butterworth)
// response, so the knob is the -3 dB point at zero resonance. K reaches 3 (oscillation) at SK_RT
// and SK_KMAX at full resonance, 20% past, which squares the wave off. The clip: u / (1 + (u/L)^4)^(1/4)
// (slope exactly 1 near zero, then a sharp knee), with L = 1.5 on the positive side and 1.2 on
// the negative (SK_IP, SK_IN are 1/L), so a hard-driven peak carries even harmonics too. SK_HPK:
// the high-pass's share of the resonance. SK_CAL: cents, see fcoef (measured in Node renders of the
// voice, notes 48 to 96 with the knob at 262 Hz and key tracking 1).
const SK_K0 = 3 - Math.SQRT2, SK_RT = 0.9, SK_KMAX = 3.6, SK_IP = 1 / 1.5, SK_IN = 1 / 1.2, SK_HPK = 0.5;
const SK_CAL = [6.67, 92.36, -34.23];   // measured flat: 1.3, 6.9, 22.4, 42.3, 64.9 cents at e = 0.1, 0.25, 0.5, 0.75, 1
// Poly 24. The loop oscillates once k passes 4 (four equal one-poles, each 45 degrees and 1/sqrt 2
// at the cutoff), at 0.9 on the knob; full resonance takes k 11% past it, like Ladder 24.
// P24_IL = 1/L, the feedback amplifier's clip level; P24_SS scales the voltage across each stage
// before its tanh (lower is cleaner: 0.5 keeps a normal note nearly linear, so drive is what
// makes the stages slew), and the two together set the scream at about -12 dBFS. P24_COMP: the share of the passband the
// feedback takes away that is made up (Ladder 24 makes up 0.45). P24_CAL: cents per unit of loop
// gain over 4, a + b g0 with g0 = pi fc / fs (measured in Node renders of the voice).
const P24_KMAX = 4 / 0.9, P24_IL = 1 / 0.5, P24_SS = 0.5, P24_COMP = 0.6;
const P24_CAL = [105, -300];   // measured flat: 18, 28, 37, 47 cents at over 0.18, 0.27, 0.36, 0.44 (C3); 84 cents a unit at C7
const LWAVES = { sine: 0, tri: 1, saw: 2, square: 3, sh: 4, smooth: 5 };
const WAVES = { saw: W_SAW, pulse: W_PULSE, square: W_PULSE, tri: W_TRI, triangle: W_TRI, sine: W_SINE };
// tanh(x)/x, Pade approximant (exact enough for |x| < 3, still monotone and bounded beyond)
function tdx(x) { const a = x * x; return ((a + 105) * a + 945) / ((15 * a + 420) * a + 945); }
function num(v, d) { v = +v; return isFinite(v) ? v : d; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
// the mod wheel and aftertouch can add vibrato through LFO 1 even when its own depth is 0
function mwvAny(P, self) { return (self.mw > 0 && num((P.mw || {}).vib, 30) > 0) || (self.at > 0 && num((P.at || {}).vib, 0) > 0); }
function isStruct(a, b) {
  if (!a) return true;
  return ['osc1.wave', 'osc2.wave', 'osc2.sync', 'sub.wave', 'sub.oct', 'noise.color', 'filt.model', 'filt.tube',
    'v1.tube', 'voice.mode'].some(k => get(a, k) !== get(b, k));
}
function get(o, path) { const ks = path.split('.'); let x = o; for (const k of ks) { if (x == null) return undefined; x = x[k]; } return x; }

registerProcessor('filament', Filament);

// =====================================================================================
// Cathode: the second device in the rack. One voice, semi-modular, with a patch panel.
// =====================================================================================
//
//   VCO 1 (tri, saw, pulse, noise) --\
//                                     mix -> [filter in] -> V1 drive tube -> HPF -> [LPF in] -> LPF
//   VCO 2 (saw, square, narrow, ring)/        -> V2 follower tube -> [VCA in] -> VCA -> out (mono, both sides)
//
// Both filters are 2-pole state variable filters whose resonance is positive feedback of the
// band-pass through a diode clipper, solved like Valve 12 (linearised at the previous sample,
// one Newton step). The clipper is what lets the resonance scream without running away: a
// loud input squeezes the loop, so the peak fights the signal instead of sitting on top of it.
//
// The patch panel. Every jack is a slot in SRC, written once per sample (at 2x) in a fixed
// order: keyboard, MG, noise, S&H, EG 1, EG 2, VCOs, mix, drive, HPF, LPF, VCA. An input
// reads SRC[EFF[i]]: the cable plugged into it, else its normal (the pre-wired source the
// panel prints under the jack), else ZERO. A source computed later in the order reaches an
// earlier input one sample late (about 10 microseconds), which is what lets any cable,
// feedback loops included, be patched without a solver.
//
// Messages in: as Filament, plus {t:'active', on}. An inactive Cathode lets go of its
// gate and fades out over 0.6 s, then sleeps, unless the MIDI file player holds it awake
// ({t:'play', on:true}). An active one sleeps too when its VCA is
// closed by an idle envelope and nothing can open it without a key.

// The panel (cathode.js) carries the same lists; the suite checks they match.
const C_SRC = ['kbd', 'gate', 'vel', 'wheel', 'mgTri', 'mgPulse', 'white', 'pink', 'sh', 'eg1', 'eg1i', 'eg2', 'eg2i', 'vco1', 'vco2', 'mix', 'hpf', 'lpf'];
const C_IN = ['pitch', 'vco2', 'pmA', 'pmB', 'shIn', 'shClk', 'eg1Trig', 'eg2Trig', 'filtIn', 'hpA', 'hpB', 'hpCut', 'lpfIn', 'lpA', 'lpB', 'lpCut', 'vcaIn', 'vca'];
const C_NORM = { pmA: 'mgTri', pmB: 'eg1', shIn: 'white', shClk: 'mgPulse', eg1Trig: 'gate', eg2Trig: 'gate', filtIn: 'mix',
  hpA: 'mgTri', hpB: 'eg2', lpfIn: 'hpf', lpA: 'mgTri', lpB: 'eg2', vcaIn: 'lpf', vca: 'eg2' };
const CS = {}; C_SRC.forEach((k, i) => { CS[k] = i; });
const CI = {}; C_IN.forEach((k, i) => { CI[k] = i; });
const C_ZERO = C_SRC.length;
const CS_KBD = CS.kbd, CS_GATE = CS.gate, CS_VEL = CS.vel, CS_WHEEL = CS.wheel, CS_MGT = CS.mgTri, CS_MGP = CS.mgPulse,
  CS_WHITE = CS.white, CS_PINK = CS.pink, CS_SH = CS.sh, CS_EG1 = CS.eg1, CS_EG1I = CS.eg1i, CS_EG2 = CS.eg2, CS_EG2I = CS.eg2i,
  CS_VCO1 = CS.vco1, CS_VCO2 = CS.vco2, CS_MIX = CS.mix, CS_HPF = CS.hpf, CS_LPF = CS.lpf;
const CI_PITCH = CI.pitch, CI_VCO2 = CI.vco2, CI_PMA = CI.pmA, CI_PMB = CI.pmB, CI_SHIN = CI.shIn, CI_SHCLK = CI.shClk,
  CI_T1 = CI.eg1Trig, CI_T2 = CI.eg2Trig, CI_FIN = CI.filtIn, CI_HPA = CI.hpA, CI_HPB = CI.hpB, CI_HPC = CI.hpCut,
  CI_LIN = CI.lpfIn, CI_LPA = CI.lpA, CI_LPB = CI.lpB, CI_LPC = CI.lpCut, CI_VIN = CI.vcaIn, CI_VCA = CI.vca;

// Diode clipper for the resonance loops: c(u) = u / sqrt(1 + (u/vc)^2), re-centred on a small
// bias (a pair of mismatched diodes) and normalised to unity slope there, like the tube curves.
const D_VC = 0.5, D_B = 0.08;
function diodeTable() {
  const c = u => u / Math.sqrt(1 + (u / D_VC) * (u / D_VC));
  const e = 1e-5, sl = (c(D_B + e) - c(D_B - e)) / (2 * e), c0 = c(D_B);
  const tab = new Float32Array(TT_N);
  for (let i = 0; i < TT_N; i++) { const u = (i / (TT_N - 1) * 2 - 1) * TT_R; tab[i] = (c(u + D_B) - c0) / sl; }
  return tab;
}
// Loop gain KC * peak^KCX: oscillation starts where it passes 2R = 1.414, at peak 0.8 (KC_T).
// Past that the clipped loop runs flat, the same number of cents at every cutoff (measured:
// 3 at 0.81, 28 at 0.9, 64 at full), so the cutoff is raised by CCAL[0] e + CCAL[1] e^2 cents,
// e running 0..1 from the threshold to full peak.
const KC = 2.6, KCX = 2.73, KC_T = Math.pow(1.41421356 / KC, 1 / KCX), CCAL = [50.77, 13.21];
function peakCorr(pk) { if (pk <= KC_T) return 1; const e = (pk - KC_T) / (1 - KC_T); return Math.pow(2, (CCAL[0] * e + CCAL[1] * e * e) / 1200); }
// 2-pole SVF with diode-clipped band-pass feedback. State: Float64Array [s1, s2, bp, g, k, in, lp, hp].
const D_S1 = 0, D_S2 = 1, D_BP = 2, D_G = 3, D_K = 4, D_IN = 5, D_LP = 6, D_HP = 7, D_N = 8;
function svfDiode(s, tab) {
  const y = s[D_IN], g = s[D_G], k = s[D_K], R2 = 1.41421356;
  let s1 = s[D_S1], s2 = s[D_S2];
  const v0 = s[D_BP];
  let T0, T1;
  { const tp = (v0 + TT_R) * TT_SCALE;
    if (tp <= 0) { T0 = tab[0]; T1 = 0; } else if (tp >= TT_N - 1) { T0 = tab[TT_N - 1]; T1 = 0; }
    else { const ti = tp | 0, d = tab[ti + 1] - tab[ti]; T0 = tab[ti] + d * (tp - ti); T1 = d * TT_SCALE; } }
  const c1 = k * T1, c0 = k * (T0 - T1 * v0);
  const hp = (y + c0 + c1 * s1 - (R2 + g) * s1 - s2) / (1 + R2 * g + g * g - c1 * g);
  const bp = g * hp + s1; s1 = g * hp + bp;
  const lp = g * bp + s2; s2 = g * bp + lp;
  s[D_S1] = s1; s[D_S2] = s2; s[D_BP] = bp; s[D_LP] = lp; s[D_HP] = hp;
}

// 2^x for the per-sample pitch and cutoff CVs: a table for the integer part, a polynomial for the
// rest (error about 2e-7, a fraction of a thousandth of a cent).
const P2 = new Float64Array(129); for (let i = 0; i < 129; i++) P2[i] = Math.pow(2, i - 64);
function exp2(x) {
  if (x < -60) x = -60; else if (x > 60) x = 60;
  const i = Math.floor(x), f = x - i;
  return P2[i + 64] * (1 + f * (0.693147 + f * (0.2402265 + f * (0.0555041 + f * (0.0096181 + f * 0.0013334))))) ;
}

// smoothed parameters
const C_L1 = 0, C_L2 = 1, C_PW = 2, C_PMA = 3, C_PMB = 4, C_HCUT = 5, C_HPK = 6, C_HA = 7, C_HB = 8, C_HKT = 9,
  C_LCUT = 10, C_LPK = 11, C_LA = 12, C_LB = 13, C_LKT = 14, C_VLVL = 15, C_VBIAS = 16, C_VVEL = 17, C_G1 = 18, C_MK1 = 19,
  C_G2 = 20, C_MK2 = 21, C_MGR = 22, C_MGS = 23, C_TUNE = 24, C_SEMI2 = 25, C_WHL = 26, C_NP = 27;
const C_IDLE_FR = 4800;               // frames of silence before an idle device sleeps

class Cathode extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.sr = sampleRate; this.fs = sampleRate * OS;
    this.tubes = {}; (o.tubes || []).forEach(t => { this.tubes[t.id] = t; });
    this.tabCache = {};
    this.dTab = diodeTable();
    this.o1 = new Osc(); this.o2 = new Osc();
    this.hpS = new Float64Array(D_N); this.lpS = new Float64Array(D_N);
    this.hpS[D_G] = 0.01; this.lpS[D_G] = 0.1;
    this.SRC = new Float64Array(C_ZERO + 1); this.EFF = new Int32Array(C_IN.length);
    this.L2 = new Float64Array(128 * OS); this.M1 = new Float64Array(128);
    this.dec = new Decim(halfbandTaps(95, 9));
    this.dcO = 0; this.dcxO = 0;
    // keyboard
    this.held = []; this.kbdHeld = new Set(); this.pbHeld = new Set();
    this.note = 60; this.kbdT = 0; this.kbd = 0; this.vel = 0.8; this.gate = false; this.sust = false; this.retrig = 0;
    this.bend = 0; this.mw = 0; this.at = 0; this.sus = false;
    // modulation state
    this.mgPh = 0; this.nb0 = 0; this.nb1 = 0; this.nb2 = 0; this.shV = 0; this.shHi = 0;
    this.e1 = 0; this.e1s = 0; this.e1n = 0; this.t1Hi = 0;
    this.e2 = 0; this.e2s = 0; this.e2h = 0; this.t2Hi = 0;
    this.dcx1 = 0; this.dcy1 = 0; this.dcx2 = 0; this.dcy2 = 0;
    this.drift = 0; this.driftT = 0; this.driftN = 0; this.drift2 = 0; this.drift2T = 0;
    this.active = o.active !== false; this.playing = !!o.playing; this.actFade = this.active || this.playing ? 1 : 0; this.quietN = 0; this.sleeping = false;
    this.duck = 1; this.duckDir = 0; this.pendingPatch = null;
    this.events = [];
    this.meterN = 0; this.v1Acc = 0; this.v2Acc = 0; this.accN = 0; this.cpuMs = 0; this.cpuFrames = 0;
    this.P = null; this.S = new Float64Array(C_NP); this.T = new Float64Array(C_NP);
    this.setPatch(o.patch || {});
    this.target(this.S);
    (o.events || []).forEach(e => this.events.push(e));
    this.events.sort((a, b) => (a.at || 0) - (b.at || 0));
    this.port.onmessage = e => this.onMsg(e.data);
  }

  table(id, bias) {
    const key = id + ':' + bias.toFixed(3);
    let t = this.tabCache[key];
    if (!t) {
      const tube = this.tubes[id] || this.tubes['12AX7'] || { gain: 0.774, b0: 0.25, kp: 1, kn: 0.55, h: 1.8, hp: 25 };
      t = this.tabCache[key] = tubeTable(tube, bias);
      const keys = Object.keys(this.tabCache); if (keys.length > 32) delete this.tabCache[keys[0]];
    }
    return t;
  }
  setPatch(p) {
    this.P = p;
    const dr = p.drive || {}, fo = p.follow || {};
    this.t1 = this.tubes[dr.tube] || this.tubes['12AX7'] || { gain: 0.774 };
    this.tab1 = this.table(dr.tube || '12AX7', num(dr.bias, 0));
    this.t2 = this.tubes[fo.tube] || this.tubes['12AU7'] || { gain: 0.6 };
    this.tab2 = this.table(fo.tube || '12AU7', 0);
    this.g1 = (this.t1.gain || 0.774) * Math.pow(2, (num(dr.amount, 3) - 3) * 0.5);
    this.mk1 = tubeMakeup(this.tab1, this.g1, 0.5);
    this.g2 = (this.t2.gain || 0.6) * Math.pow(2, (num(fo.drive, 3) - 3) * 0.5);
    this.mk2 = tubeMakeup(this.tab2, this.g2, 0.5);
    // the patch panel: one source per input, cable first, then the normal
    const EFF = this.EFF;
    for (let i = 0; i < C_IN.length; i++) { const nm = C_NORM[C_IN[i]]; EFF[i] = nm ? CS[nm] : C_ZERO; }
    (Array.isArray(p.cables) ? p.cables : []).forEach(c => {
      if (!Array.isArray(c)) return;
      const s = CS[c[0]], d = CI[c[1]];
      if (s !== undefined && d !== undefined) EFF[d] = s;
    });
    // Can the VCA open without a key? Only if its CV is an envelope that something other than the
    // keyboard can trigger, or the bias holds it open. If not, a silent idle Cathode may sleep.
    const vs = EFF[CI_VCA];
    this.sleepEg = vs === CS_EG1 && EFF[CI_T1] === CS_GATE ? 1 : vs === CS_EG2 && EFF[CI_T2] === CS_GATE ? 2 : 0;
    this.canSleep = this.sleepEg > 0 && num((p.vca || {}).bias, 0) <= 0;
  }
  target(T) {
    const P = this.P, v1 = P.vco1 || {}, v2 = P.vco2 || {}, pm = P.pm || {}, h = P.hpf || {}, l = P.lpf || {}, va = P.vca || {}, mg = P.mg || {}, c = P.ctl || {};
    T[C_L1] = num(v1.level, 0.8); T[C_L2] = num(v2.level, 0); T[C_PW] = clamp(num(v1.pw, 0.5), 0.05, 0.95);
    T[C_PMA] = num(pm.a, 0); T[C_PMB] = num(pm.b, 0);
    T[C_HCUT] = clamp(num(h.cutoff, 20), 10, 20000); T[C_HPK] = clamp(num(h.peak, 0), 0, 1); T[C_HA] = num(h.a, 0); T[C_HB] = num(h.b, 0); T[C_HKT] = num(h.kt, 0);
    T[C_LCUT] = clamp(num(l.cutoff, 2000), 10, 20000); T[C_LPK] = clamp(num(l.peak, 0), 0, 1); T[C_LA] = num(l.a, 0); T[C_LB] = num(l.b, 0); T[C_LKT] = num(l.kt, 0);
    T[C_VLVL] = num(va.level, 0.8); T[C_VBIAS] = clamp(num(va.bias, 0), 0, 1); T[C_VVEL] = clamp(num(va.vel, 0.3), 0, 1);
    T[C_G1] = this.g1; T[C_MK1] = this.mk1; T[C_G2] = this.g2; T[C_MK2] = this.mk2;
    T[C_MGR] = clamp(num(mg.rate, 4), 0.02, 60); T[C_MGS] = clamp(num(mg.shape, 0.5), 0, 1);
    T[C_TUNE] = num(P.tune, 0); T[C_SEMI2] = num(v2.semi, 0) + num(v2.fine, 0) / 100; T[C_WHL] = num(c.wheel, 30);
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
        if (this.pendingPatch) { this.pendingPatch = m.p; break; }
        if (m.load || isStructC(this.P, m.p)) { this.pendingPatch = m.p; this.duckDir = -1; }
        else this.setPatch(m.p);
        break;
      }
      case 'on': this.noteOn(m.n | 0, num(m.v, 0.8), !!m.pb); break;
      case 'off': this.noteOff(m.n | 0); break;
      case 'bend': this.bend = clamp(num(m.v, 0), -1, 1); break;
      case 'mw': this.mw = clamp(num(m.v, 0), 0, 1); break;
      case 'at': this.at = clamp(num(m.v, 0), 0, 1); break;
      case 'sus': this.sus = !!m.on; if (!this.sus && this.sust) { this.sust = false; if (!this.held.length) this.gate = false; } break;
      case 'panic':
        this.held = []; this.kbdHeld.clear(); this.pbHeld.clear(); this.sus = false;
        this.gate = false; this.sust = false; this.e1 = 0; this.e1s = 0; this.e2 = 0; this.e2s = 0; this.e2h = 0;
        break;
      case 'release': this.releaseInput(); break;
      case 'play': this.playing = !!m.on; break;
      case 'flush': this.events = this.events.filter(e => !e.pb); break;
      case 'active':
        this.active = !!m.on;
        if (!this.active && !this.playing) {
          this.held = []; this.kbdHeld.clear(); this.pbHeld.clear();
          this.gate = false; this.sust = false; this.sus = false;
        } else if (!this.active && this.playing) this.releaseInput();
        break;
    }
  }
  noteOn(n, vel, pb) {
    pb = !!pb;
    if (pb) { this.kbdHeld.delete(n); this.pbHeld.add(n); }
    else { this.pbHeld.delete(n); this.kbdHeld.add(n); }
    this.held = this.held.filter(h => h !== n); this.held.push(n);
    const multi = ((this.P.ctl || {}).trig || 'multi') !== 'single';
    if (this.gate && multi) this.retrig = 2;            // the gate drops for one 2x sample, so both EGs start again
    this.note = n; this.kbdT = (n - 60) / 12; this.vel = vel; this.gate = true; this.sust = false;
    if (num((this.P.ctl || {}).glide, 0) <= 0) this.kbd = this.kbdT;
  }
  noteOff(n) {
    this.kbdHeld.delete(n); this.pbHeld.delete(n);
    const wasTop = this.held.length && this.held[this.held.length - 1] === n;
    this.held = this.held.filter(h => h !== n);
    if (!wasTop) return;
    if (this.held.length) {                   // last-note priority: fall back to the previous key
      const m = this.held[this.held.length - 1];
      this.note = m; this.kbdT = (m - 60) / 12;
      if (num((this.P.ctl || {}).glide, 0) <= 0) this.kbd = this.kbdT;
      if (((this.P.ctl || {}).trig || 'multi') !== 'single') this.retrig = 2;
      return;
    }
    if (this.sus) { this.sust = true; return; }
    this.gate = false;
  }
  // Let go of keys the page is holding. A note the MIDI file is playing (pb) stays,
  // and the sustain pedal stays down if that note still needs it.
  releaseInput() {
    const notes = [...this.kbdHeld];
    this.kbdHeld.clear();
    const wasSus = this.sus;
    this.sus = false;
    for (let i = 0; i < notes.length; i++) this.noteOff(notes[i]);
    if (wasSus && this.pbHeld.has(this.note) && (this.gate || this.sust)) this.sus = true;
  }

  process(inputs, outputs) {
    const t0 = Date.now();
    const out = outputs[0], L = out[0], R = out[1] || out[0], n = L.length;
    const base = currentFrame;
    const due = this.events.length && (this.events[0].at || 0) < base + n;
    // asleep: inactive and faded, or idle with nothing that could open the VCA
    const idle = this.canSleep && !this.gate && !this.retrig && (this.sleepEg === 1 ? this.e1s === 0 : this.e2s === 0) && this.quietN >= C_IDLE_FR;
    if (!due && ((!this.active && !this.playing && this.actFade <= 0) || (idle && this.duckDir === 0 && !this.pendingPatch))) {
      this.sleeping = true;
      L.fill(0); if (R !== L) R.fill(0);
      if (this.pendingPatch) { this.setPatch(this.pendingPatch); this.pendingPatch = null; this.duck = 1; this.duckDir = 0; }
      this.target(this.S);
      this.mgPh = (this.mgPh + this.S[C_MGR] * n / this.sr) % 1;
      this.kbd = this.kbdT;
      this.meter(n, t0);
      return true;
    }
    this.sleeping = false;
    const L2 = this.L2; L2.fill(0, 0, n * OS);
    let pos = 0;
    while (pos < n) {
      while (this.events.length && (this.events[0].at || 0) <= base + pos) this.apply(this.events.shift());
      let end = n;
      if (this.events.length) { const at = this.events[0].at - base; if (at > pos && at < n) end = at; }
      this.render(pos, end);
      pos = end;
    }
    const M = this.M1;
    this.dec.run(L2, M, n);
    const a = 1 - TWO_PI * 8 / this.sr;
    let x = this.dcxO, y = this.dcO, pk = 0;
    for (let i = 0; i < n; i++) { const v = M[i]; y = v - x + a * y; x = v; L[i] = y; const ay = y < 0 ? -y : y; if (ay > pk) pk = ay; }
    this.dcxO = x; this.dcO = y;
    if (R !== L) R.set(L);
    this.quietN = pk < 1e-5 ? this.quietN + n : 0;
    this.meter(n, t0);
    return true;
  }
  meter(n, t0) {
    this.cpuMs += Date.now() - t0; this.cpuFrames += n;
    this.meterN += n;
    if (this.meterN >= this.sr / 30) {
      const on = this.gate || this.e2s !== 0 || this.e1s !== 0;
      this.port.postMessage({
        t: 'meter', dev: 'cathode', v1: Math.sqrt(this.v1Acc / Math.max(1, this.accN)), v2: Math.sqrt(this.v2Acc / Math.max(1, this.accN)),
        voices: on && !this.sleeping ? 1 : 0, notes: this.gate || this.sust ? [this.note] : [],
        cpu: this.cpuMs / (this.cpuFrames / this.sr * 1000),
      });
      this.meterN = 0; this.v1Acc = 0; this.v2Acc = 0; this.accN = 0;
      if (this.cpuFrames > this.sr) { this.cpuMs *= 0.5; this.cpuFrames *= 0.5; }
    }
  }

  render(a, b) {
    if (b <= a) return;
    const sr = this.sr, fs = this.fs, frames = b - a;
    const duck0 = this.duck;
    if (this.duckDir === -1 && duck0 <= 0) {
      if (this.pendingPatch) { this.setPatch(this.pendingPatch); this.pendingPatch = null; }
      this.target(this.S);
      this.duckDir = 1;
    }
    if (this.duckDir !== 0) {
      this.duck = clamp(this.duck + this.duckDir * frames / (0.003 * sr), 0, 1);
      if (this.duckDir === 1 && this.duck >= 1) this.duckDir = 0;
    }
    const act0 = this.actFade;
    this.actFade = this.active || this.playing ? clamp(act0 + frames / (0.005 * sr), 0, 1) : clamp(act0 - frames / (0.6 * sr), 0, 1);
    const P = this.P, T = this.target(this.T), S = this.S;
    const ks = 1 - Math.exp(-CTRL / (0.02 * sr));
    const v1 = P.vco1 || {}, v2 = P.vco2 || {}, c = P.ctl || {}, e1p = P.eg1 || {}, e2p = P.eg2 || {}, pm = P.pm || {};
    const w1 = v1.wave === 'tri' ? W_TRI : v1.wave === 'pulse' ? W_PULSE : v1.wave === 'noise' ? -1 : W_SAW;
    const w2n = v2.wave || 'saw', ring = w2n === 'ring', w2 = w2n === 'saw' ? W_SAW : W_PULSE;
    const pw2 = w2n === 'narrow' ? 0.1 : 0.5, sync = !!v2.sync && w1 >= 0;
    const sc1 = CSCALE[v1.scale] ?? 0, sc2 = CSCALE[v2.scale] ?? 0;
    const both = pm.dest !== 'vco2';
    const glide = Math.max(0, num(c.glide, 0)), gk = glide > 0 ? 1 - Math.exp(-1 / (glide * fs)) : 1;
    const bendR = num(c.bend, 2), driftC = clamp(num(P.drift, 1), 0, 8);
    // envelope coefficients at the 2x rate
    const d1 = Math.max(0, num(e1p.delay, 0)) * fs, a1 = coef(Math.max(0.0005, num(e1p.a, 0.005)) / 1.466, fs), r1 = coef(Math.max(0.002, num(e1p.r, 0.3)) / 4.6, fs);
    const a2 = coef(Math.max(0.0005, num(e2p.a, 0.005)) / 1.466, fs), dd2 = coef(Math.max(0.002, num(e2p.d, 0.3)) / 4.6, fs);
    const s2 = clamp(num(e2p.s, 0.7), 0, 1), r2 = coef(Math.max(0.002, num(e2p.r, 0.3)) / 4.6, fs), h2 = Math.max(0, num(e2p.hold, 0)) * fs;
    const SRC = this.SRC, EFF = this.EFF, o1 = this.o1.s, o2 = this.o2.s, osc1 = this.o1, osc2 = this.o2;
    const hpS = this.hpS, lpS = this.lpS, dTab = this.dTab, tab1 = this.tab1, tab2 = this.tab2;
    const L2 = this.L2, C4 = 261.6255653 / fs, PIfs = Math.PI / fs, fcMax = sr * 0.45;
    const dcA = 1 - TWO_PI * 15 / fs;
    const eP = EFF[CI_PITCH], eV2 = EFF[CI_VCO2], ePA = EFF[CI_PMA], ePB = EFF[CI_PMB], eSI = EFF[CI_SHIN], eSC = EFF[CI_SHCLK],
      eT1 = EFF[CI_T1], eT2 = EFF[CI_T2], eFI = EFF[CI_FIN], eHA = EFF[CI_HPA], eHB = EFF[CI_HPB], eHC = EFF[CI_HPC],
      eLI = EFF[CI_LIN], eLA = EFF[CI_LPA], eLB = EFF[CI_LPB], eLC = EFF[CI_LPC], eVI = EFF[CI_VIN], eVC = EFF[CI_VCA];
    let mgPh = this.mgPh, nb0 = this.nb0, nb1 = this.nb1, nb2 = this.nb2, shV = this.shV, shHi = this.shHi;
    let e1 = this.e1, e1s = this.e1s, e1n = this.e1n, t1Hi = this.t1Hi, e2 = this.e2, e2s = this.e2s, e2h = this.e2h, t2Hi = this.t2Hi;
    let dcx1 = this.dcx1, dcy1 = this.dcy1, dcx2 = this.dcx2, dcy2 = this.dcy2, kbd = this.kbd;
    let v1Acc = 0, v2Acc = 0;
    let basePitch = 0, mgInc = 0, mgS = 0.5, l1 = 0, l2 = 0, pw = 0.5, pmA = 0, pmB = 0, semi2 = 0;
    let hcut = 20, hkt = 0, ha = 0, hb = 0, lcut = 2000, lkt = 0, la = 0, lb = 0, G1 = 1, MK1 = 1, G2 = 1, MK2 = 1, ampK = 0, bias = 0, whl = 0;
    const kbdT = this.kbdT;
    // Memos for the costly maths below (exp2, tan, pow). Each keeps the exact inputs of its last call
    // and reruns only when one of them changes, so the output is bit-identical to computing every
    // time. Most of the time most inputs sit still: an unmodulated HPF, a pitch that moves only at
    // the control tick (drift), a peak knob at rest. They start empty (NaN never matches) in every
    // render() call, so nothing carries over a patch change.
    let kP1 = NaN, kD1 = 0, kP2 = NaN, kD2 = 0;                       // VCO pitch (octaves) -> phase step
    let kHc = NaN, kHx = NaN, kHg = 0, kLc = NaN, kLx = NaN, kLg = 0;  // filter base Hz and CV -> tan(pi fc / fs)
    let kHk = NaN, kHK = 0, kHq = 1, kLk = NaN, kLK = 0, kLq = 1;      // peak knob -> loop gain, cutoff correction
    for (let i = a; i < b; i++) {
      const fr = i - a;
      if (fr % CTRL === 0) {
        for (let j = 0; j < C_NP; j++) S[j] += (T[j] - S[j]) * ks;
        if (--this.driftN <= 0) { this.driftT = Math.random() * 2 - 1; this.drift2T = Math.random() * 2 - 1; this.driftN = (0.3 + Math.random() * 0.6) * sr / CTRL; }
        this.drift += (this.driftT - this.drift) * 0.0003; this.drift2 += (this.drift2T - this.drift2) * 0.0003;
        basePitch = this.bend * bendR / 12 + S[C_TUNE] / 1200 + driftC * this.drift / 1200;
        semi2 = S[C_SEMI2] / 12 + driftC * 0.5 * (this.drift2 - this.drift) / 1200;
        mgInc = S[C_MGR] / fs; mgS = S[C_MGS] < 0.005 ? 0.005 : S[C_MGS] > 0.995 ? 0.995 : S[C_MGS];
        l1 = S[C_L1]; l2 = S[C_L2]; pw = S[C_PW]; pmA = S[C_PMA] / 12; pmB = S[C_PMB] / 12;
        hcut = S[C_HCUT]; hkt = S[C_HKT]; ha = S[C_HA] * 5; hb = S[C_HB] * 5;
        lcut = S[C_LCUT]; lkt = S[C_LKT]; la = S[C_LA] * 5; lb = S[C_LB] * 5;
        if (S[C_HPK] !== kHk) { kHk = S[C_HPK]; kHK = KC * Math.pow(kHk, KCX); kHq = peakCorr(kHk); }
        if (S[C_LPK] !== kLk) { kLk = S[C_LPK]; kLK = KC * Math.pow(kLk, KCX); kLq = peakCorr(kLk); }
        hpS[D_K] = kHK; lpS[D_K] = kLK;
        hcut *= kHq; lcut *= kLq;
        G1 = S[C_G1]; MK1 = S[C_MK1]; G2 = S[C_G2]; MK2 = S[C_MK2];
        ampK = S[C_VLVL] * (1 - S[C_VVEL] * (1 - this.vel)); bias = S[C_VBIAS];
        whl = this.mw * S[C_WHL] / 1200;
      }
      const duck = (duck0 + (this.duck - duck0) * (fr / frames)) * (act0 + (this.actFade - act0) * (fr / frames));
      for (let s = 0; s < OS; s++) {
        // ---- keyboard ----
        kbd += (kbdT - kbd) * gk;
        let gt = this.gate ? 1 : 0;
        if (this.retrig > 0) { this.retrig--; gt = 0; }
        SRC[CS_KBD] = kbd; SRC[CS_GATE] = gt; SRC[CS_VEL] = this.vel; SRC[CS_WHEEL] = this.mw;
        // ---- MG: shape morphs a falling ramp (0) through a triangle (0.5) to a rising ramp (1) ----
        mgPh += mgInc; if (mgPh >= 1) mgPh -= 1;
        SRC[CS_MGT] = mgPh < mgS ? -1 + 2 * mgPh / mgS : 1 - 2 * (mgPh - mgS) / (1 - mgS);
        SRC[CS_MGP] = mgPh < mgS ? 1 : -1;
        // ---- noise ----
        const wn = Math.random() * 2 - 1;
        nb0 = 0.99765 * nb0 + wn * 0.0990460; nb1 = 0.96300 * nb1 + wn * 0.2965164; nb2 = 0.57000 * nb2 + wn * 1.0526913;
        SRC[CS_WHITE] = wn; SRC[CS_PINK] = (nb0 + nb1 + nb2 + wn * 0.1848) * 0.25;
        // ---- sample and hold: on the clock's rising edge ----
        const ck = SRC[eSC];
        if (!shHi) { if (ck > 0.3) { shHi = 1; shV = SRC[eSI]; } } else if (ck < 0.1) shHi = 0;
        SRC[CS_SH] = shV;
        // ---- EG 1: delay, attack, release ----
        const g1 = SRC[eT1];
        if (!t1Hi) { if (g1 > 0.3) { t1Hi = 1; if (d1 > 0) { e1s = 1; e1n = d1; } else e1s = 2; } }
        else if (g1 < 0.1) { t1Hi = 0; if (e1s !== 0) e1s = 4; }
        if (e1s === 1) { if (--e1n <= 0) e1s = 2; }
        else if (e1s === 2) { e1 += (1.3 - e1) * a1; if (e1 >= 1) { e1 = 1; e1s = 3; } }
        else if (e1s === 4) { e1 -= e1 * r1; if (e1 < 1e-5) { e1 = 0; e1s = 0; } }
        SRC[CS_EG1] = e1; SRC[CS_EG1I] = -e1;
        // ---- EG 2: attack, decay, sustain, release; hold keeps it going after the gate falls ----
        const g2 = SRC[eT2];
        if (!t2Hi) { if (g2 > 0.3) { t2Hi = 1; e2s = 2; e2h = 0; } }
        else if (g2 < 0.1) { t2Hi = 0; if (e2s !== 0) { if (h2 > 0) e2h = h2; else e2s = 4; } }
        if (e2h > 0 && !t2Hi) { if (--e2h <= 0) { e2h = 0; e2s = 4; } }
        if (e2s === 2) { e2 += (1.3 - e2) * a2; if (e2 >= 1) { e2 = 1; e2s = 5; } }
        else if (e2s === 5) e2 += (s2 - e2) * dd2;
        else if (e2s === 4) { e2 -= e2 * r2; if (e2 < 1e-5) { e2 = 0; e2s = 0; } }
        SRC[CS_EG2] = e2; SRC[CS_EG2I] = -e2;
        // ---- VCOs (1 V per octave throughout; 0 is middle C) ----
        const pm = pmA * SRC[ePA] + pmB * SRC[ePB] + whl * SRC[CS_MGT];
        const pin = kbd + basePitch + SRC[eP];
        const p1 = pin + sc1 + (both ? pm : 0), p2 = pin + sc2 + semi2 + pm + SRC[eV2];
        let x1;
        if (w1 < 0) { x1 = wn; o1[O_WRAP] = -1; }
        else { if (p1 !== kP1) { kP1 = p1; kD1 = C4 * exp2(p1); if (kD1 > 0.45) kD1 = 0.45; }
          o1[O_DT] = kD1; o1[O_PW] = pw; osc1.step(w1); x1 = o1[O_Y]; }
        let x2;
        { if (p2 !== kP2) { kP2 = p2; kD2 = C4 * exp2(p2); if (kD2 > 0.45) kD2 = 0.45; }
          o2[O_DT] = kD2; o2[O_PW] = pw2; osc2.step(w2);
          if (sync && o1[O_WRAP] >= 0) { o2[O_X] = o1[O_WRAP]; osc2.sync(w2); }
          x2 = o2[O_Y]; if (ring) x2 *= x1; }
        SRC[CS_VCO1] = x1; SRC[CS_VCO2] = x2;
        SRC[CS_MIX] = (x1 * l1 + x2 * l2) * 0.6;
        // ---- V1 drive tube, then a coupling cap ----
        let x = SRC[eFI]; if (!(x > -8 && x < 8)) x = x > 0 ? 8 : x < 0 ? -8 : 0;
        v1Acc += x * x;
        let y;
        { const tp = (G1 * x + TT_R) * TT_SCALE;
          if (tp <= 0) y = tab1[0]; else if (tp >= TT_N - 1) y = tab1[TT_N - 1];
          else { const ti = tp | 0; y = tab1[ti] + (tab1[ti + 1] - tab1[ti]) * (tp - ti); }
          y = y / G1 * MK1; }
        dcy1 = y - dcx1 + dcA * dcy1; dcx1 = y;
        // ---- HPF ----
        { const hx = hkt * kbd + ha * SRC[eHA] + hb * SRC[eHB] + SRC[eHC];
          if (hx !== kHx || hcut !== kHc) {
            kHx = hx; kHc = hcut; let fc = hcut * exp2(hx);
            if (fc < 10) fc = 10; else if (fc > fcMax) fc = fcMax;
            kHg = Math.tan(PIfs * fc);
          }
          hpS[D_G] = kHg; hpS[D_IN] = dcy1; svfDiode(hpS, dTab);
          let hv = hpS[D_HP]; if (!(hv > -8 && hv < 8)) { hv = 0; hpS.fill(0, 0, 3); }
          SRC[CS_HPF] = hv; }
        // ---- LPF, then V2 (a cathode follower) ----
        { const lx = lkt * kbd + la * SRC[eLA] + lb * SRC[eLB] + SRC[eLC];
          if (lx !== kLx || lcut !== kLc) {
            kLx = lx; kLc = lcut; let fc = lcut * exp2(lx);
            if (fc < 10) fc = 10; else if (fc > fcMax) fc = fcMax;
            kLg = Math.tan(PIfs * fc);
          }
          lpS[D_G] = kLg; lpS[D_IN] = SRC[eLI]; svfDiode(lpS, dTab);
          let lv = lpS[D_LP]; if (!(lv > -8 && lv < 8)) { lv = 0; lpS.fill(0, 0, 3); }
          v2Acc += lv * lv;
          let z;
          { const tp = (G2 * lv + TT_R) * TT_SCALE;
            if (tp <= 0) z = tab2[0]; else if (tp >= TT_N - 1) z = tab2[TT_N - 1];
            else { const ti = tp | 0; z = tab2[ti] + (tab2[ti + 1] - tab2[ti]) * (tp - ti); }
            z = z / G2 * MK2; }
          dcy2 = z - dcx2 + dcA * dcy2; dcx2 = z;
          SRC[CS_LPF] = dcy2; }
        // ---- VCA ----
        let cv = SRC[eVC] + bias; if (cv < 0) cv = 0; else if (cv > 1.5) cv = 1.5;
        let vi = SRC[eVI]; if (!(vi > -8 && vi < 8)) vi = 0;
        L2[i * OS + s] = vi * cv * ampK * duck;
      }
    }
    // seed the filters with a whisper of noise, so a self-oscillating one starts on its own
    if (hpS[D_S1] === 0) hpS[D_S1] = (Math.random() - 0.5) * 1e-4;
    if (lpS[D_S1] === 0) lpS[D_S1] = (Math.random() - 0.5) * 1e-4;
    for (let j = 0; j < 3; j++) { if (Math.abs(hpS[j]) < 1e-20) hpS[j] = 0; if (Math.abs(lpS[j]) < 1e-20) lpS[j] = 0; }
    this.kbd = kbd; this.mgPh = mgPh; this.nb0 = nb0; this.nb1 = nb1; this.nb2 = nb2; this.shV = shV; this.shHi = shHi;
    this.e1 = e1; this.e1s = e1s; this.e1n = e1n; this.t1Hi = t1Hi; this.e2 = e2; this.e2s = e2s; this.e2h = e2h; this.t2Hi = t2Hi;
    this.dcx1 = dcx1; this.dcy1 = dcy1; this.dcx2 = dcx2; this.dcy2 = dcy2;
    this.v1Acc += v1Acc; this.v2Acc += v2Acc; this.accN += frames * OS;
  }
}
const CSCALE = { 32: -2, 16: -1, 8: 0, 4: 1 };
function isStructC(a, b) {
  if (!a) return true;
  return ['vco1.wave', 'vco2.wave', 'vco2.sync', 'drive.tube', 'follow.tube', 'ctl.trig'].some(k => get(a, k) !== get(b, k)) ||
    JSON.stringify(a.cables || []) !== JSON.stringify(b.cables || []);
}
Cathode.SRC = C_SRC; Cathode.IN = C_IN; Cathode.NORM = C_NORM;

registerProcessor('cathode', Cathode);
