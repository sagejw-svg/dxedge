// Master bus: stereo delay, a Schroeder reverb, and a bus compressor/limiter.
// One processor so the three stay in order and a full bypass is a straight copy.
//
// Delay. Two delay lines. In stereo mode each side repeats itself, and the right
// line can run longer (the offset). In ping-pong mode the input is summed, the
// first repeat comes out of the right line, and that repeat is what the left line
// plays back one delay later, so the echoes alternate sides even from a centred source.
//
// Reverb. The structure and the 44.1 kHz delay lengths follow Jezar's public-domain
// Freeverb (Dreampoint, c. 2000), as described by Julius O. Smith at CCRMA
// (https://ccrma.stanford.edu/~jos/pasp/Freeverb.html): eight parallel combs with a
// one-pole damper in the feedback, then four series allpasses, per channel, the right
// channel 23 samples longer at 44.1 kHz. This file is our own code, written from that
// description. It is not a copy or a line-by-line translation of the Freeverb C++ sources.
// Lengths at 44100 Hz: combs 1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617;
// allpasses 556, 441, 341, 225. They scale with the sample rate.
//
// Compressor. Original feed-forward design: one peak envelope for both channels,
// a soft knee, then an optional ceiling limiter with its own fast envelope.
// Nothing here is taken from Airwindows or any other compressor source.

const COMB = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLP = [556, 441, 341, 225];
const SPREAD = 23;

function lengths(base, spread) {
  const k = sampleRate / 44100, used = new Set();
  return base.map(n => {
    let m = Math.round((n + spread) * k);
    if (m < 8) m = 8;
    while (used.has(m)) m++;
    used.add(m);
    return m;
  });
}

function Comb(n) { this.b = new Float32Array(n); this.i = 0; this.f = 0; this.n = n; }
Comb.prototype.step = function (x, fb, damp) {
  const y = this.b[this.i];
  this.f = y * (1 - damp) + this.f * damp;
  if (this.f > -1e-15 && this.f < 1e-15) this.f = 0;
  let w = x + this.f * fb;
  if (w > 2) w = 2; else if (w < -2) w = -2;
  this.b[this.i] = w;
  if (++this.i >= this.n) this.i = 0;
  return y;
};

function Allpass(n) { this.b = new Float32Array(n); this.i = 0; this.n = n; }
Allpass.prototype.step = function (x) {
  const buf = this.b[this.i];
  const y = buf - x;
  this.b[this.i] = x + buf * 0.5;
  if (++this.i >= this.n) this.i = 0;
  return y;
};

function Line(n) { this.b = new Float32Array(n); this.w = 0; this.n = n; }
Line.prototype.read = function (delay) {
  let d = delay;
  if (d < 1) d = 1;
  if (d > this.n - 2) d = this.n - 2;
  const i = Math.floor(d), f = d - i;
  let p = this.w - i; if (p < 0) p += this.n;
  let q = p - 1; if (q < 0) q += this.n;
  return this.b[p] * (1 - f) + this.b[q] * f;
};
Line.prototype.write = function (x) {
  this.b[this.w] = x;
  if (++this.w >= this.n) this.w = 0;
};

function coef(sec) {
  const t = sec > 0.0001 ? sec : 0.0001;
  return 1 - Math.exp(-1 / (t * sampleRate));
}
// Soft-knee gain reduction in dB (0 or negative). ratio is the compression ratio.
function grDb(levelDb, thresh, ratio, knee) {
  const slope = 1 / ratio - 1;
  if (!(knee > 0)) { const over = levelDb - thresh; return over > 0 ? over * slope : 0; }
  const half = knee * 0.5;
  if (levelDb <= thresh - half) return 0;
  if (levelDb >= thresh + half) return (levelDb - thresh) * slope;
  const x = levelDb - thresh + half;
  return (x * x / (2 * knee)) * slope;
}

class FilamentMaster extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opt = (options && options.processorOptions) || {};
    const maxSamp = Math.ceil(sampleRate * 8) + 8;
    this.dL = new Line(maxSamp);
    this.dR = new Line(maxSamp);
    this.cL = lengths(COMB, 0).map(n => new Comb(n));
    this.cR = lengths(COMB, SPREAD).map(n => new Comb(n));
    this.aL = lengths(ALLP, 0).map(n => new Allpass(n));
    this.aR = lengths(ALLP, SPREAD).map(n => new Allpass(n));
    this.env = 0;
    this.lim = 1; this.limEnv = 0;
    this.dcLx = 0; this.dcLy = 0; this.dcRx = 0; this.dcRy = 0;
    this.yL = 0; this.yR = 0;
    this.rec = false; this.recStop = false;
    this.apply(opt.master || {});
    this.port.onmessage = e => {
      const m = e.data;
      if (!m) return;
      if (m.t === 'set') this.apply(m.master || {});
      else if (m.t === 'rec') { if (m.on) { this.rec = true; this.recStop = false; } else this.recStop = true; }
    };
  }

  apply(s) {
    if (s && s.delay && s.reverb && s.comp) this.s = s;
    const c = (this.s && this.s.comp) || {};
    this.att = coef((isFinite(+c.attack) ? +c.attack : 10) / 1000);
    this.rel = coef((isFinite(+c.release) ? +c.release : 120) / 1000);
    this.limRel = coef(0.08);
    const ceilDb = (c.ceiling == null || !isFinite(+c.ceiling)) ? -1 : +c.ceiling;
    this.ceil = Math.pow(10, ceilDb / 20);
    const d = (this.s && this.s.delay) || {};
    const secL = isFinite(+d.seconds) ? +d.seconds : 0.25;
    const secR = isFinite(+d.secondsR) ? +d.secondsR : secL;
    this.dSampL = Math.max(1, secL * sampleRate);
    this.dSampR = Math.max(1, secR * sampleRate);
  }

  delay(l, r) {
    const d = this.s.delay || {};
    if (!d.on) { this.yL = l; this.yR = r; return; }
    const fb = +d.feedback || 0, mix = +d.mix || 0;
    let wetL, wetR;
    if (d.ping) {
      const tapL = this.dL.read(this.dSampL), tapR = this.dR.read(this.dSampR);
      this.dL.write(0.5 * (l + r) + tapR * fb);
      this.dR.write(tapL);
      wetL = tapR; wetR = tapL;
    } else {
      const tapL = this.dL.read(this.dSampL), tapR = this.dR.read(this.dSampR);
      this.dL.write(l + tapL * fb);
      this.dR.write(r + tapR * fb);
      wetL = tapL; wetR = tapR;
    }
    const dry = 1 - mix;
    this.yL = l * dry + wetL * mix;
    this.yR = r * dry + wetR * mix;
  }

  reverb(l, r) {
    const rv = this.s.reverb || {};
    if (!rv.on) { this.yL = l; this.yR = r; return; }
    const fb = 0.28 * (+rv.size || 0) + 0.7;
    const damp = Math.min(0.95, (+rv.damp || 0) * 0.9);
    const ing = 0.12;
    let sl = 0, sr = 0;
    for (let k = 0; k < 8; k++) { sl += this.cL[k].step(l * ing, fb, damp); sr += this.cR[k].step(r * ing, fb, damp); }
    for (let k = 0; k < 4; k++) { sl = this.aL[k].step(sl); sr = this.aR[k].step(sr); }
    const dl = sl - this.dcLx + 0.995 * this.dcLy;
    const dr = sr - this.dcRx + 0.995 * this.dcRy;
    this.dcLx = sl; this.dcLy = dl; this.dcRx = sr; this.dcRy = dr;
    const mix = +rv.mix || 0, width = rv.width == null ? 1 : +rv.width;
    const wet1 = mix * (width * 0.5 + 0.5), wet2 = mix * ((1 - width) * 0.5), dry = 1 - mix;
    this.yL = l * dry + dl * wet1 + dr * wet2;
    this.yR = r * dry + dr * wet1 + dl * wet2;
  }

  comp(l, r) {
    const c = this.s.comp || {};
    const safety = !!c.safety;
    if (!c.on && !safety) { this.yL = l; this.yR = r; return; }
    let ol = l, orr = r;
    if (c.on) {
      const peak = Math.max(Math.abs(l), Math.abs(r));
      this.env += (peak - this.env) * (peak > this.env ? this.att : this.rel);
      const levelDb = 20 * Math.log10(this.env + 1e-12);
      const ratio = c.ratio > 1 ? c.ratio : 1;
      const g = Math.pow(10, (grDb(levelDb, +c.threshold || 0, ratio, +c.knee || 0) + (+c.makeup || 0)) / 20);
      ol = l * g; orr = r * g;
    }
    if ((c.on && c.limit) || safety) {
      // Peak limiter. The envelope jumps to a new peak at once and falls back over about 80 ms, and
      // the gain is the ceiling over that envelope, so no sample leaves above the ceiling. (Until
      // 26 Oct the gain itself was smoothed with a 2 ms attack and no hold: every waveform peak
      // rode over the ceiling, by as much as 7 dB.)
      const pk = Math.max(Math.abs(ol), Math.abs(orr));
      this.limEnv = pk > this.limEnv ? pk : this.limEnv + (pk - this.limEnv) * this.limRel;
      this.lim = this.limEnv > this.ceil ? this.ceil / this.limEnv : 1;
      ol *= this.lim; orr *= this.lim;
    }
    this.yL = ol; this.yR = orr;
  }

  process(inputs, outputs) {
    const input = inputs[0], outCh = outputs[0];
    const outL = outCh[0], outR = outCh[1] || outCh[0];
    const n = outL.length;
    const inL = input && input[0], inR = input && (input[1] || input[0]);
    const s = this.s || {};
    const safety = !!(s.comp && s.comp.safety);
    const bypass = !(s.delay && s.delay.on) && !(s.reverb && s.reverb.on) && !(s.comp && s.comp.on) && !safety;
    for (let i = 0; i < n; i++) {
      let l = inL ? inL[i] : 0, r = inR ? inR[i] : l;
      if (!bypass) {
        this.delay(l, r); l = this.yL; r = this.yR;
        this.reverb(l, r); l = this.yL; r = this.yR;
        this.comp(l, r); l = this.yL; r = this.yR;
      }
      outL[i] = l; outR[i] = r;
    }
    if (this.rec) {
      const L = new Float32Array(n), R = new Float32Array(n);
      L.set(outL); if (outR !== outL) R.set(outR); else R.set(outL);
      this.port.postMessage({ t: 'rec', L, R }, [L.buffer, R.buffer]);
    }
    if (this.recStop) { this.rec = false; this.recStop = false; this.port.postMessage({ t: 'rec', end: 1 }); }
    return true;
  }
}

registerProcessor('filament-master', FilamentMaster);
