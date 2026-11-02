// Spring reverb tank, rack-wide (brief: ENSEMBLE > TAPE ECHO > SPRING > EQ > V3/V4).
// Our own model and our own code. The idea that a spring's sound is a dispersive delay (low
// frequencies travel slower than high ones, so every echo is a falling chirp, the "drip") and that a
// chain of allpass filters in a loop can stand in for it is from the published research on spring
// reverberation (Valimaki, Parker and Abel 2010; Parker 2011). Nothing here is taken from any
// implementation of it.
//
// One mono input (the rack's mid), two springs of different lengths, one per side:
//   driver   a tube driver stage in front of the tank: a gain, an asymmetric tanh with slope 1 at
//            rest, and the inverse gain, so a quiet signal goes in clean and drive saturates it
//            (the same curve as the tape echo's record amp). A 4-pole low-pass and a high-pass
//            band-limit what reaches the springs, as a tank's transducers do.
//   spring   a wave runs down the spring (dispersion chain AP1, delay line D1) to the pickup, which
//            is the output; it reflects back (high-pass, the tone low-pass, the decay gain,
//            dispersion chain AP2, delay line D2) and runs down again with the next input. So the
//            first arrival is one transit late and each echo after it one round trip later, and
//            every pass smears it further into a chirp.
//   chain    M stretched first-order allpasses, v[n] = x[n] - a v[n-K], y[n] = a v[n] + v[n-K]
//            (z^-1 stretched to z^-K). With a < 0 the group delay is longest at DC and shortest at
//            sr/(2K), so lows arrive late. K is sr/12 kHz rounded, so the dispersive band runs to
//            about 6 kHz; the images above it are what the band-limit and the tone low-pass take out.
//            The delay lines are shortened by the chain's group delay at 1 kHz, so 1 kHz arrives at
//            the transit time whatever the drip.
// Spring A (left) is 33.1 ms one way, spring B (right) 41.3 ms. The wet sides are never inverted, so
// the mono fold adds two different tanks (mono-safe). Nothing is allocated in process().

const SPR_T = [0.0331, 0.0413];      // one-way transit times, s (A left, B right)
const SPR_M = 24;                    // allpass sections per chain
const SPR_B = 0.15;                  // driver curve asymmetry
const SPR_WET = 0.7;                 // wet output scale
const TB = Math.tanh(SPR_B), TB1 = 1 - TB * TB;

// |H| at w (radians/sample) of a biquad c[0..4], and of the one-pole high-pass y = k (y1 + x - x1)
function magBq(c, w) {
  const cr = Math.cos(w), ci = -Math.sin(w), c2r = Math.cos(2 * w), c2i = -Math.sin(2 * w);
  const nr = c[0] + c[1] * cr + c[2] * c2r, ni = c[1] * ci + c[2] * c2i, dr = 1 + c[3] * cr + c[4] * c2r, di = c[3] * ci + c[4] * c2i;
  return Math.sqrt((nr * nr + ni * ni) / (dr * dr + di * di));
}
function phBq(c, w) {
  const cr = Math.cos(w), ci = -Math.sin(w), c2r = Math.cos(2 * w), c2i = -Math.sin(2 * w);
  return Math.atan2(c[1] * ci + c[2] * c2i, c[0] + c[1] * cr + c[2] * c2r) - Math.atan2(c[3] * ci + c[4] * c2i, 1 + c[3] * cr + c[4] * c2r);
}
function phHp(k, w) { return Math.atan2(Math.sin(w), 1 - Math.cos(w)) - Math.atan2(k * Math.sin(w), 1 - k * Math.cos(w)); }
function magHp(k, w) { const nr = 1 - Math.cos(w), ni = Math.sin(w), dr = 1 - k * Math.cos(w), di = k * Math.sin(w); return k * Math.sqrt((nr * nr + ni * ni) / (dr * dr + di * di)); }
const SPR_F0 = 700;                  // the decay knob is the time to -60 dB here (the loop filters' loss is made up at it)
function dripA(drip) { return -(0.3 + 0.45 * Math.min(1, Math.max(0, drip / 100))); }
// group delay in samples of one stretched section at w (radians/sample)
function gdSec(a, K, w) { const c = Math.cos(K * w); return K * (1 - a * a) / (1 + 2 * a * c + a * a); }
// 2-pole low-pass (bilinear transform of the analog prototype, Q 0.707) into c[0..4] = b0 b1 b2 a1 a2
function lp2(c, f, sr) {
  const k = Math.tan(Math.PI * Math.min(f, sr * 0.45) / sr), q = Math.SQRT1_2, n = 1 / (1 + k / q + k * k);
  c[0] = k * k * n; c[1] = 2 * c[0]; c[2] = c[0]; c[3] = 2 * (k * k - 1) * n; c[4] = (1 - k / q + k * k) * n;
}

class Spring {
  constructor(sr, T, K) {
    this.T = T; this.K = K;
    let n = 1; while (n < T * sr + 64) n <<= 1;
    this.n = n; this.mask = n - 1;
    this.d1 = new Float32Array(n); this.d2 = new Float32Array(n); this.w = 0;
    this.ap1 = new Float32Array(SPR_M * K); this.ap2 = new Float32Array(SPR_M * K); this.p = 0;
    this.len = T * sr;                 // delay line length (s * sr) before the chain's share comes off
    this.lp = new Float32Array(4); this.hp = 0; this.hx = 0;   // loop filters' state
    this.oz = new Float32Array(4);                             // output band-limit state
    this.a = -0.5; this.dly = this.len; this.dly2 = this.len; this.g = 0;
  }
  clear() { this.d1.fill(0); this.d2.fill(0); this.ap1.fill(0); this.ap2.fill(0); this.lp.fill(0); this.oz.fill(0); this.hp = 0; this.hx = 0; }
}

class FilamentSpring extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'drive', defaultValue: 3, minValue: 0, maxValue: 10, automationRate: 'k-rate' },
      { name: 'decay', defaultValue: 2.5, minValue: 0.5, maxValue: 6, automationRate: 'k-rate' },
      { name: 'tone', defaultValue: 5, minValue: 0, maxValue: 10, automationRate: 'k-rate' },
      { name: 'drip', defaultValue: 40, minValue: 0, maxValue: 100, automationRate: 'k-rate' },
    ];
  }
  constructor() {
    super();
    const sr = sampleRate;
    this.K = Math.max(1, Math.round(sr / 12000));
    this.band = Math.min(5000, 0.42 * sr / this.K);
    this.sp = SPR_T.map(T => new Spring(sr, T, this.K));
    this.inC = new Float32Array(5); this.inZ = new Float32Array(8); lp2(this.inC, this.band, sr);
    this.outC = this.inC;                                  // same band-limit on the pickup
    this.tc = new Float32Array(5);                         // the tone low-pass coefficients
    this.hpK = Math.exp(-2 * Math.PI * 100 / sr);          // loop high-pass (one pole, 100 Hz)
    this.ihK = Math.exp(-2 * Math.PI * 60 / sr); this.ih = 0; this.ix = 0;   // input high-pass (60 Hz)
    this.last = { drive: -1, decay: -1, tone: -1, drip: -1 };
    this.gd = 0.25; this.sleep = true; this.quiet = 0; this.blocks = 0;
    this.fade = 0;                                         // > 0 while a clear fades the tank out
    this.port.onmessage = e => {
      const m = e.data || {};
      if (m.t === 'clear') { if (!this.sleep) this.fade = 256; }
      else if (m.t === 'stat') this.port.postMessage({ t: 'stat', sleep: this.sleep, blocks: this.blocks, K: this.K, band: this.band,
        a: this.sp[0].a, dly: this.sp.map(s => s.dly), dly2: this.sp.map(s => s.dly2), g: this.sp.map(s => s.g), id: m.id });
    };
  }
  coeffs(drive, decay, tone, drip) {
    const sr = sampleRate, L = this.last;
    if (drive !== L.drive) { this.gd = 0.25 * Math.pow(10, drive * 2.6 / 20); L.drive = drive; }
    const toneNew = tone !== L.tone;
    if (toneNew) { lp2(this.tc, Math.min(1500 * Math.pow(3, tone / 10), this.band), sr); L.tone = tone; }
    if (toneNew || drip !== L.drip || decay !== L.decay) {
      const w0 = 2 * Math.PI * SPR_F0 / sr, loss = magBq(this.tc, w0) * magHp(this.hpK, w0);
      // the reflection's filters delay it too: their group delay at 1 kHz comes off D2
      const w1k = 2 * Math.PI * 1000 / sr, dw = 1e-4, ph = w => phBq(this.tc, w) + phHp(this.hpK, w);
      const gdF = -(ph(w1k + dw) - ph(w1k - dw)) / (2 * dw);
      const a = dripA(drip), w1 = 2 * Math.PI * 1000 / sr;
      for (const s of this.sp) {
        s.a = a;
        // the chain's share of the transit at 1 kHz comes off the delay line (at least 2 samples left)
        s.dly = Math.max(2, s.len - SPR_M * gdSec(a, s.K, w1)); s.dly2 = Math.max(2, s.dly - gdF);
        // one round trip is two transits; the decay knob is the time to fall 60 dB at SPR_F0, so what the
        // reflection's high-pass and tone low-pass take there is given back (at most 0.999 round the loop)
        s.g = Math.min(0.999, Math.pow(10, -3 * (2 * s.T) / decay) / loss);
      }
      L.drip = drip; L.decay = decay;
    }
  }
  process(inputs, outputs, params) {
    const out = outputs[0], oL = out[0], oR = out[1] || out[0], N = oL.length;
    const inp = inputs[0] && inputs[0].length ? inputs[0][0] : null;
    let live = false;
    if (inp) for (let i = 0; i < N; i++) { if (inp[i] !== 0) { live = true; break; } }
    if (this.sleep) {
      if (!live) { oL.fill(0); if (oR !== oL) oR.fill(0); return true; }
      this.sleep = false; this.quiet = 0;
    }
    this.blocks++;
    this.coeffs(params.drive[0], params.decay[0], params.tone[0], params.drip[0]);
    const gd = this.gd, ic = this.inC, iz = this.inZ, tc = this.tc, hpK = this.hpK, ihK = this.ihK, K = this.K;
    let energy = 0;
    for (let i = 0; i < N; i++) {
      // the driver: input high-pass, the tube curve, then the 4-pole band-limit
      let x = inp ? inp[i] : 0;
      const h = ihK * (this.ih + x - this.ix); this.ix = x; this.ih = h; x = h;
      const u = x * gd; x = ((Math.tanh(u + SPR_B) - TB) / TB1) / gd;
      let y1 = ic[0] * x + iz[0]; iz[0] = ic[1] * x - ic[3] * y1 + iz[1]; iz[1] = ic[2] * x - ic[4] * y1;
      let y2 = ic[0] * y1 + iz[2]; iz[2] = ic[1] * y1 - ic[3] * y2 + iz[3]; iz[3] = ic[2] * y1 - ic[4] * y2;
      x = y2;
      let fadeG = 1;
      if (this.fade > 0) { fadeG = this.fade / 256; this.fade--; if (this.fade === 0) { for (const s of this.sp) s.clear(); this.fade = -1; } }
      for (let k = 0; k < 2; k++) {
        const s = this.sp[k], a = s.a, mask = s.mask, w = s.w, p = s.p;
        // the reflection arriving back at the driver end: D2 read at its delay (linear interpolation)
        const r2 = w - s.dly2, r2i = Math.floor(r2), f2 = r2 - r2i;
        const b = s.d2[r2i & mask] * (1 - f2) + s.d2[(r2i + 1) & mask] * f2;
        const r = w - s.dly, ri = Math.floor(r), fr = r - ri;
        // down the spring: AP1, then into D1
        let v = x + b, j = p;
        const A1 = s.ap1;
        for (let m = 0; m < SPR_M; m++, j += K) { const vk = A1[j], q = v - a * vk; A1[j] = q; v = a * q + vk; }
        s.d1[w & mask] = v;
        // the pickup: D1 read at its delay
        const y = s.d1[ri & mask] * (1 - fr) + s.d1[(ri + 1) & mask] * fr;
        // the reflection: high-pass, the tone low-pass, the decay gain, AP2, into D2
        const hy = hpK * (s.hp + y - s.hx); s.hx = y; s.hp = hy;
        const lz = s.lp, ly = tc[0] * hy + lz[0]; lz[0] = tc[1] * hy - tc[3] * ly + lz[1]; lz[1] = tc[2] * hy - tc[4] * ly;
        let z = ly * s.g * fadeG; j = p;
        const A2 = s.ap2;
        for (let m = 0; m < SPR_M; m++, j += K) { const vk = A2[j], q = z - a * vk; A2[j] = q; z = a * q + vk; }
        s.d2[w & mask] = z;
        s.w = (w + 1) & mask; s.p = p + 1 === K ? 0 : p + 1;
        // the pickup's own band-limit, then out on this spring's side
        const oz = s.oz, o1 = this.outC[0] * y + oz[0]; oz[0] = this.outC[1] * y - this.outC[3] * o1 + oz[1]; oz[1] = this.outC[2] * y - this.outC[4] * o1;
        const o = o1 * SPR_WET * fadeG;
        if (k === 0) oL[i] = o; else oR[i] = o;
        energy += o < 0 ? -o : o;
      }
    }
    // a silent input and a tank under -140 dB for a while: clear it and sleep until the next sound
    if (!live && energy < 1e-7 * N) { if (++this.quiet > 8) { for (const s of this.sp) s.clear(); this.iz_reset(); this.sleep = true; } }
    else this.quiet = 0;
    if (!(energy < 1e9)) { for (const s of this.sp) s.clear(); this.iz_reset(); oL.fill(0); if (oR !== oL) oR.fill(0); }
    return true;
  }
  iz_reset() { this.inZ.fill(0); this.ih = 0; this.ix = 0; }
}

registerProcessor('filament-spring', FilamentSpring);
