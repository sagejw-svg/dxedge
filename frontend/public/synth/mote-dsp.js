// Mote grain engine.
//
// A grain is a short windowed read of a stored buffer. Pitch is how fast that
// read moves (a ratio against the buffer's own rate), spread is a pan per grain,
// and density is how often a new grain starts. Written from that description.
// No granular-player source was copied. signalsmith-stretch is not used: a
// grain does not need a time stretcher to change pitch.

const MAX_GRAINS = 32;

export function moteWindow(shape, p) {
  const x = p < 0 ? 0 : p > 1 ? 1 : p;
  if (shape === 'tri') return 1 - Math.abs(2 * x - 1);
  if (shape === 'plank') {
    const e = 0.14;
    if (x < e) return x / e;
    if (x > 1 - e) return (1 - x) / e;
    return 1;
  }
  if (shape === 'gauss') {
    const z = (x - 0.5) * 4.6;
    return Math.exp(-z * z);
  }
  return 0.5 - 0.5 * Math.cos(2 * Math.PI * x);
}

function rand(eng) {
  let x = eng.seed >>> 0;
  x ^= x << 13; x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5; x >>>= 0;
  eng.seed = x || 1;
  return (x & 0xffffff) / 0x1000000;
}

function clamp(n, a, b) { return n < a ? a : n > b ? b : n; }

export function resampleLinear(src, srcSr, dstSr) {
  const input = src instanceof Float32Array ? src : Float32Array.from(src || []);
  if (!input.length) return new Float32Array(0);
  if (!srcSr || !dstSr || srcSr === dstSr) return input;
  const n = Math.max(1, Math.round(input.length * dstSr / srcSr));
  const out = new Float32Array(n);
  const scale = srcSr / dstSr;
  const last = input.length - 1;
  for (let i = 0; i < n; i++) {
    const x = i * scale;
    const i0 = x | 0;
    const f = x - i0;
    const a = input[i0 > last ? last : i0];
    const b = input[i0 + 1 > last ? last : i0 + 1];
    out[i] = a + (b - a) * f;
  }
  return out;
}

function makeLine(samples) {
  const n = Math.max(8, samples | 0);
  return { buf: new Float32Array(n), w: 0, lp: 0 };
}
function readLine(d, delay) {
  const n = d.buf.length;
  let i = d.w - delay;
  while (i < 0) i += n;
  i %= n;
  const i0 = i | 0;
  const f = i - i0;
  const a = d.buf[i0];
  const b = d.buf[i0 + 1 === n ? 0 : i0 + 1];
  return a + (b - a) * f;
}
function writeLine(d, x) {
  d.buf[d.w] = x;
  d.w = d.w + 1 === d.buf.length ? 0 : d.w + 1;
}
function hadamard(a, b, c, d) {
  const s0 = a + b, s1 = a - b, s2 = c + d, s3 = c - d;
  return [0.5 * (s0 + s2), 0.5 * (s1 + s3), 0.5 * (s0 - s2), 0.5 * (s1 - s3)];
}

// A short glassy chord so the device speaks before a file arrives.
export function builtinBuffer(sr) {
  const n = Math.max(8, (sr * 1.5) | 0);
  const L = new Float32Array(n);
  const fs = [523.25, 659.25, 783.99, 1046.5];
  const am = [0.46, 0.3, 0.22, 0.12];
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const e = Math.min(1, t / 0.012) * Math.exp(-t * 1.15);
    let y = 0;
    for (let k = 0; k < fs.length; k++) y += am[k] * Math.sin(2 * Math.PI * fs[k] * t);
    L[i] = y * e * 0.72;
  }
  return { L, R: L, sr };
}

export function createMoteEngine(sampleRate, patch) {
  const sr = sampleRate || 48000;
  const grains = [];
  for (let i = 0; i < MAX_GRAINS; i++) grains.push({ on: false });
  const ms = [23.0, 31.4, 37.8, 47.2];
  const eng = {
    sr,
    P: null,
    bufL: new Float32Array(0),
    bufR: new Float32Array(0),
    seed: 0x6d6f7465,
    grains,
    cloudPhase: 1,
    scan: 0,
    held: new Map(),
    sustain: false,
    bend: 0,
    mw: 0,
    active: true,
    lfo: 0,
    queue: [],
    soon: [],
    delayL: makeLine(sr),
    delayR: makeLine(sr),
    fdn: ms.map(m => makeLine((m / 1000) * sr + 8)),
    meterN: 0,
    cpuMs: 0,
    cpuFrames: 0,
    levelAcc: 0,
    onMeter: null,
    sourceName: 'internal',
  };
  setMotePatch(eng, patch, false);
  const built = builtinBuffer(sr);
  setMoteBuffer(eng, built.L, built.R, sr, 'internal');
  return eng;
}

export function setMotePatch(eng, patch, keepBuffer) {
  eng.P = patch || {};
  if (!keepBuffer && eng.bufL && !eng.bufL.length) {
    const built = builtinBuffer(eng.sr);
    setMoteBuffer(eng, built.L, built.R, eng.sr, 'internal');
  }
}

export function setMoteBuffer(eng, L, R, srcSr, name) {
  const l = resampleLinear(L, srcSr || eng.sr, eng.sr);
  const rIn = R && R.length ? R : L;
  const r = resampleLinear(rIn, srcSr || eng.sr, eng.sr);
  const n = Math.min(l.length, r.length);
  eng.bufL = n === l.length ? l : l.slice(0, n);
  eng.bufR = n === r.length ? r : r.slice(0, n);
  if (name) eng.sourceName = name;
  eng.scan = 0;
}

function alloc(eng) {
  const g = eng.grains;
  for (let i = 0; i < g.length; i++) if (!g[i].on) return g[i];
  return null;
}

function modulated(eng) {
  const g = (eng.P && eng.P.grain) || {};
  const lfo = (eng.P && eng.P.lfo) || {};
  const depth = +lfo.depth || 0;
  const s = depth > 0 ? Math.sin(eng.lfo) * depth : 0;
  const dest = lfo.dest || 'position';
  let size = +g.size || 80;
  let density = +g.density || 12;
  let position = +g.position || 0;
  let spray = +g.spray || 0;
  let pitch = +g.pitch || 0;
  if (dest === 'size') size *= 1 + s * 0.85;
  if (dest === 'density') density *= 1 + s * 0.9;
  if (dest === 'position') position += s * 0.5;
  if (dest === 'spray') spray += s * 0.5;
  if (dest === 'pitch') pitch += s * 7;
  if (!g.freeze) position += eng.scan;
  if (!g.freeze) {
    if (position < 0 || position >= 1) position -= Math.floor(position);
  } else {
    if (position < 0) position = 0;
    if (position > 1) position = 1;
  }
  // 1 is the last sample. Wrapping it would jump back to the start.
  if (position >= 1) position = 0.999999;
  spray = clamp(spray + (eng.mw || 0) * 0.35, 0, 1);
  return {
    size: clamp(size, 5, 400),
    density: clamp(density, 0.5, 60),
    position,
    spray,
    pitch,
    pitchRand: clamp(+g.pitchRand || 0, 0, 12),
    reverse: clamp(+g.reverse || 0, 0, 1),
    window: g.window || 'hann',
    spread: clamp(+g.spread || 0, 0, 1),
    keyboard: !!g.keyboard,
    level: clamp(eng.P && eng.P.level != null ? +eng.P.level : 0.8, 0, 1),
  };
}

function spawn(eng, m, semis, vel) {
  const N = eng.bufL.length;
  if (N < 8) return;
  const slot = alloc(eng);
  if (!slot) return;
  const len = Math.max(8, (m.size / 1000) * eng.sr);
  const overlap = Math.max(1, m.density * (m.size / 1000));
  const jitter = (rand(eng) * 2 - 1) * m.spray * 0.5;
  let pos01 = m.position + jitter;
  pos01 -= Math.floor(pos01);
  const dir = rand(eng) < m.reverse ? -1 : 1;
  const extra = (rand(eng) * 2 - 1) * m.pitchRand;
  const rate = Math.pow(2, (m.pitch + semis + extra + (eng.bend || 0) * 2) / 12);
  slot.on = true;
  slot.env = 0;
  slot.len = len;
  slot.pos = pos01 * (N - 2);
  slot.inc = dir * rate;
  slot.amp = (0.5 * m.level * clamp(vel, 0, 1)) / Math.sqrt(overlap);
  slot.pan = (rand(eng) * 2 - 1) * m.spread;
  slot.shape = m.window;
}

function readBuf(buf, pos) {
  const last = buf.length - 1;
  if (pos < 1 || pos >= last) return 0;
  const i = pos | 0;
  const f = pos - i;
  return buf[i] * (1 - f) + buf[i + 1] * f;
}

function tickGrain(eng, g) {
  if (!g.on) return 0;
  const w = moteWindow(g.shape, g.len > 1 ? g.env / (g.len - 1) : 0);
  const y = (readBuf(eng.bufL, g.pos) + readBuf(eng.bufR, g.pos)) * 0.5 * w * g.amp;
  g.pos += g.inc;
  g.env += 1;
  if (g.env >= g.len) g.on = false;
  return y;
}

function tailOf(eng) {
  const t = (eng.P && eng.P.tail) || {};
  return {
    delay: clamp(+t.delay || 0, 0.02, 0.9),
    feedback: clamp(+t.feedback || 0, 0, 0.85),
    reverb: clamp(+t.reverb || 0, 0, 1),
    mix: clamp(+t.mix || 0, 0, 1),
  };
}

function applyTail(eng, dryL, dryR) {
  const t = tailOf(eng);
  if (t.mix <= 0) return [dryL, dryR];
  const dSamp = Math.max(1, Math.round(t.delay * eng.sr));
  const wetL = readLine(eng.delayL, Math.min(dSamp, eng.delayL.buf.length - 2));
  const wetR = readLine(eng.delayR, Math.min(Math.round(dSamp * 1.17), eng.delayR.buf.length - 2));
  eng.delayL.lp = eng.delayL.lp * 0.72 + wetL * 0.28;
  eng.delayR.lp = eng.delayR.lp * 0.72 + wetR * 0.28;
  writeLine(eng.delayL, dryL + t.feedback * eng.delayL.lp);
  writeLine(eng.delayR, dryR + t.feedback * eng.delayR.lp);
  const fb = 0.25 + 0.6 * t.reverb;
  const xs = eng.fdn.map(d => {
    const x = d.buf[d.w];
    d.lp = d.lp * 0.8 + x * 0.2;
    return d.lp;
  });
  const h = hadamard(xs[0], xs[1], xs[2], xs[3]);
  const inj = (dryL + dryR + wetL + wetR) * 0.15 * t.reverb;
  for (let i = 0; i < 4; i++) writeLine(eng.fdn[i], h[i] * fb + inj);
  const revL = xs[0] + 0.65 * xs[2];
  const revR = xs[1] + 0.65 * xs[3];
  const wetOutL = wetL * 0.7 + revL;
  const wetOutR = wetR * 0.7 + revR;
  const dry = 1 - t.mix;
  return [dryL * dry + wetOutL * t.mix, dryR * dry + wetOutR * t.mix];
}

function handle(eng, msg) {
  if (!msg || !msg.t) return;
  if (msg.t === 'patch') setMotePatch(eng, msg.p, true);
  else if (msg.t === 'buffer') setMoteBuffer(eng, msg.L, msg.R || msg.L, msg.sr || eng.sr, msg.name || 'buffer');
  else if (msg.t === 'on') {
    const n = +msg.n;
    if (n >= 0 && n <= 127) eng.held.set(n, { vel: msg.v == null ? 0.8 : +msg.v, phase: 1, held: true });
  } else if (msg.t === 'off') {
    const n = +msg.n;
    const v = eng.held.get(n);
    if (!v) return;
    if (eng.sustain) v.held = false;
    else eng.held.delete(n);
  } else if (msg.t === 'sus') {
    eng.sustain = !!msg.on;
    if (!eng.sustain) {
      [...eng.held.keys()].forEach(n => { if (!eng.held.get(n).held) eng.held.delete(n); });
    }
  } else if (msg.t === 'bend') eng.bend = clamp(+msg.v || 0, -1, 1);
  else if (msg.t === 'mw') eng.mw = clamp(+msg.v || 0, 0, 1);
  else if (msg.t === 'panic') { eng.held.clear(); eng.sustain = false; eng.grains.forEach(g => { g.on = false; }); }
  else if (msg.t === 'active') {
    eng.active = msg.on !== false;
    if (!eng.active) {
      eng.held.clear();
      eng.grains.forEach(g => { g.on = false; });
    }
  }
}

export function postMote(eng, msg) {
  if (!msg || !msg.t) return;
  if (msg.at != null) eng.queue.push(msg);
  else eng.soon.push(msg);
}

function advanceVoice(eng, m, phase, semis, vel) {
  let p = phase + m.density / eng.sr;
  if (p >= 1) {
    p -= 1;
    spawn(eng, m, semis, vel);
  }
  return p;
}

export function renderMote(eng, outL, outR, start) {
  const t0 = Date.now();
  const n = outL.length;
  if (eng.soon.length) {
    const soon = eng.soon;
    eng.soon = [];
    soon.forEach(m => handle(eng, m));
  }
  const q = eng.queue;
  if (q.length > 1) q.sort((a, b) => (a.at || 0) - (b.at || 0));
  let qi = 0;
  const lfoRate = ((eng.P && eng.P.lfo && +eng.P.lfo.rate) || 0.2);
  for (let i = 0; i < n; i++) {
    const frame = (start || 0) + i;
    while (qi < q.length && (q[qi].at || 0) <= frame) handle(eng, q[qi++]);
    eng.lfo += 2 * Math.PI * lfoRate / eng.sr;
    if (eng.lfo > Math.PI * 2) eng.lfo -= Math.PI * 2;
    const freeze = eng.P && eng.P.grain && eng.P.grain.freeze;
    if (!freeze) eng.scan += 1 / (8 * eng.sr);
    const m = modulated(eng);
    if (eng.active !== false) {
      if (m.keyboard) {
        eng.held.forEach((v, note) => {
          v.phase = advanceVoice(eng, m, v.phase, note - 60, v.vel);
        });
      } else {
        eng.cloudPhase = advanceVoice(eng, m, eng.cloudPhase, 0, 1);
      }
    }
    let l = 0, r = 0;
    const gs = eng.grains;
    for (let k = 0; k < gs.length; k++) {
      const g = gs[k];
      if (!g.on) continue;
      const y = tickGrain(eng, g);
      if (g.pan === 0) { l += y; r += y; }
      else {
        const ang = (g.pan + 1) * Math.PI * 0.25;
        l += y * Math.cos(ang) * 1.4142;
        r += y * Math.sin(ang) * 1.4142;
      }
    }
    const mixed = applyTail(eng, l, r);
    let ol = mixed[0], orr = mixed[1];
    if (ol > 1) ol = 1; else if (ol < -1) ol = -1;
    if (orr > 1) orr = 1; else if (orr < -1) orr = -1;
    if (ol !== ol) ol = 0;
    if (orr !== orr) orr = 0;
    outL[i] = ol;
    outR[i] = orr;
    eng.levelAcc += ol * ol + orr * orr;
  }
  if (qi) q.splice(0, qi);
  eng.meterN += n;
  eng.cpuMs += Date.now() - t0;
  eng.cpuFrames += n;
  if (eng.onMeter && eng.meterN >= eng.sr / 30) {
    const parts = [];
    let sounding = 0;
    const N = eng.bufL.length || 1;
    for (let k = 0; k < eng.grains.length; k++) {
      const g = eng.grains[k];
      if (!g.on) continue;
      sounding++;
      if (parts.length < 16) {
        parts.push({
          u: clamp(g.pos / N, 0, 1),
          life: g.len ? 1 - g.env / g.len : 0,
          pan: g.pan || 0,
          rev: g.inc < 0,
        });
      }
    }
    const m = modulated(eng);
    eng.onMeter({
      t: 'meter',
      dev: 'mote',
      grains: sounding,
      voices: m.keyboard ? eng.held.size : (sounding ? 1 : 0),
      cpu: eng.cpuFrames ? eng.cpuMs / (eng.cpuFrames / eng.sr * 1000) : 0,
      level: Math.sqrt(eng.levelAcc / Math.max(1, eng.meterN * 2)),
      position: m.position,
      parts,
      source: eng.sourceName,
    });
    eng.meterN = 0;
    eng.levelAcc = 0;
    if (eng.cpuFrames > eng.sr) { eng.cpuMs *= 0.5; eng.cpuFrames *= 0.5; }
  }
}
