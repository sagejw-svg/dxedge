// Klystron voice. Original.
//
// A channel vocoder, written from the idea: split a modulator into bands,
// follow each band's loudness, and use that loudness to open the same band
// on a carrier. The vowel path is three resonators on a pulse, placed by the
// mouth pad. After the vocoder, short grains can smear or freeze the result.
// No vocoder, talk-box, or granular source was copied.

import { normalizeKlystron, formantsOf } from './klystron.js';

export const BANDS = 12;
const VOICES = 6;
const MAX_GRAINS = 24;

export function bandFreq(i) {
  const lo = 160;
  const hi = 5800;
  return lo * Math.pow(hi / lo, i / (BANDS - 1));
}

function clamp(n, a, b) { return n < a ? a : n > b ? b : n; }

function coef(seconds, sr) {
  const t = seconds > 0.0005 ? seconds : 0.0005;
  return 1 - Math.exp(-1 / (t * sr));
}

function rand(eng) {
  let x = eng.seed >>> 0;
  x ^= x << 13; x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5; x >>>= 0;
  eng.seed = x || 1;
  return (x & 0xffffff) / 0x1000000;
}

function noise(eng) {
  return rand(eng) * 2 - 1;
}

function polyBlep(t, dt) {
  if (dt <= 0) return 0;
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

function saw(ph, dt) {
  return (2 * ph - 1) - polyBlep(ph, dt);
}

function pulse(ph, dt, width) {
  const w = width < 0.05 ? 0.05 : width > 0.95 ? 0.95 : width;
  let v = ph < w ? 1 : -1;
  v += polyBlep(ph, dt);
  let t2 = ph - w;
  if (t2 < 0) t2 += 1;
  v -= polyBlep(t2, dt);
  return v;
}

function waveOf(kind, ph, dt, nse) {
  if (kind === 'sine') return Math.sin(2 * Math.PI * ph);
  if (kind === 'pulse') return pulse(ph, dt, 0.32);
  if (kind === 'noise') return nse;
  return saw(ph, dt);
}

function makeBP(f, q, sr) {
  const w0 = 2 * Math.PI * clamp(f, 30, sr * 0.45) / sr;
  const Q = clamp(q, 0.4, 12);
  const alpha = Math.sin(w0) / (2 * Q);
  const a0 = 1 + alpha;
  const peak = Q;
  return {
    b0: alpha / a0 / peak,
    b1: 0,
    b2: -alpha / a0 / peak,
    a1: (-2 * Math.cos(w0)) / a0,
    a2: (1 - alpha) / a0,
    x1: 0, x2: 0, y1: 0, y2: 0,
  };
}

function tickBP(s, x) {
  const y = s.b0 * x + s.b1 * s.x1 + s.b2 * s.x2 - s.a1 * s.y1 - s.a2 * s.y2;
  s.x2 = s.x1;
  s.x1 = x;
  s.y2 = s.y1;
  s.y1 = Math.abs(y) < 1e-20 ? 0 : y;
  return s.y1;
}

function makeRes() {
  return { a1: 0, a2: 0, g: 0, y1: 0, y2: 0, f: 0 };
}

function setRes(s, f, bw, sr) {
  const freq = clamp(f, 40, sr * 0.45);
  const r = Math.exp(-Math.PI * clamp(bw, 20, 800) / sr);
  const w = 2 * Math.PI * freq / sr;
  s.a1 = -2 * r * Math.cos(w);
  s.a2 = r * r;
  s.g = 1 - r;
  s.f = freq;
}

function tickRes(s, x) {
  const y = s.g * x - s.a1 * s.y1 - s.a2 * s.y2;
  s.y2 = s.y1;
  s.y1 = Math.abs(y) < 1e-20 ? 0 : y;
  if (Math.abs(s.y1) > 8) { s.y1 = 0; s.y2 = 0; return 0; }
  return s.y1;
}

function tuneBank(eng) {
  const q = eng.P.bank.q;
  for (let i = 0; i < BANDS; i++) {
    const f = bandFreq(i);
    const a = eng.ana[i];
    const s = eng.syn[i];
    const na = makeBP(f, q, eng.sr);
    const ns = makeBP(f, q, eng.sr);
    na.x1 = a.x1; na.x2 = a.x2; na.y1 = a.y1; na.y2 = a.y2;
    ns.x1 = s.x1; ns.x2 = s.x2; ns.y1 = s.y1; ns.y2 = s.y2;
    eng.ana[i] = na;
    eng.syn[i] = ns;
  }
  eng.bankQ = q;
}

function tuneMouth(eng) {
  const f = formantsOf(eng.P.mouth.x, eng.P.mouth.y);
  setRes(eng.r1, f.f1, 70, eng.sr);
  setRes(eng.r2, f.f2, 90, eng.sr);
  setRes(eng.r3, f.f3, 140, eng.sr);
  eng.mouthX = eng.P.mouth.x;
  eng.mouthY = eng.P.mouth.y;
}

export function resampleLinear(src, srcSr, dstSr) {
  const input = src instanceof Float32Array ? src : Float32Array.from(src || []);
  if (!input.length) return new Float32Array(0);
  if (!srcSr || !dstSr || srcSr === dstSr) return input.slice();
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

export function setKlystronBuffer(eng, L, sr, name) {
  eng.buf = resampleLinear(L, sr || eng.sr, eng.sr);
  eng.bufPos = 0;
  eng.bufName = name || 'file';
}

function blankVoice() {
  return { on: false, n: 60, vel: 0, phase: 0, env: 0, stage: 'off', held: false };
}

export function createKlystronEngine(sr, patch) {
  const eng = {
    sr,
    P: normalizeKlystron(patch),
    active: true,
    seed: 0x4b1,
    voices: Array.from({ length: VOICES }, blankVoice),
    bend: 0,
    mw: 0,
    sus: false,
    ana: [],
    syn: [],
    env: new Float32Array(BANDS),
    r1: makeRes(),
    r2: makeRes(),
    r3: makeRes(),
    gPhase: 0,
    modEnv: 0.05,
    buf: null,
    bufPos: 0,
    bufName: '',
    ringL: new Float32Array(Math.max(256, (sr * 1.6) | 0)),
    ringR: new Float32Array(Math.max(256, (sr * 1.6) | 0)),
    write: 0,
    freezePos: 0,
    wasFreeze: false,
    locked: false,
    arm: 0,
    loud: 0,
    grains: Array.from({ length: MAX_GRAINS }, () => ({ on: false, pos: 0, i: 0, len: 32, inc: 1, pan: 0 })),
    spawn: 0,
    queue: [],
    frame: 0,
    acc: 0,
    accN: 0,
    meterN: 0,
    cpuMs: 0,
    cpuFrames: 0,
    onMeter: null,
  };
  for (let i = 0; i < BANDS; i++) {
    eng.ana.push(makeBP(bandFreq(i), eng.P.bank.q, sr));
    eng.syn.push(makeBP(bandFreq(i), eng.P.bank.q, sr));
  }
  tuneMouth(eng);
  eng.wasFreeze = !!eng.P.grain.freeze;
  eng.locked = false;
  return eng;
}

function noteHz(n, bend, tune) {
  return 440 * Math.pow(2, (n - 69 + bend * 2 + tune) / 12);
}

function voiceOn(eng, n, vel) {
  let slot = null;
  for (let i = 0; i < eng.voices.length; i++) {
    const v = eng.voices[i];
    if (v.on && v.n === n) { slot = v; break; }
  }
  if (!slot) {
    for (let i = 0; i < eng.voices.length; i++) if (!eng.voices[i].on) { slot = eng.voices[i]; break; }
  }
  if (!slot) {
    slot = eng.voices[0];
    for (let i = 1; i < eng.voices.length; i++) if (eng.voices[i].env < slot.env) slot = eng.voices[i];
  }
  slot.on = true;
  slot.n = n;
  slot.vel = vel;
  slot.held = true;
  slot.stage = 'a';
  if (slot.env < 0.001) slot.phase = 0;
}

function voiceOff(eng, n) {
  for (let i = 0; i < eng.voices.length; i++) {
    const v = eng.voices[i];
    if (!v.on || v.n !== n) continue;
    v.held = false;
    if (!eng.sus) v.stage = 'r';
  }
}

function releaseSustain(eng) {
  if (eng.sus) return;
  for (let i = 0; i < eng.voices.length; i++) {
    const v = eng.voices[i];
    if (v.on && !v.held) v.stage = 'r';
  }
}

export function silenceKlystron(eng) {
  for (let i = 0; i < eng.voices.length; i++) {
    const v = eng.voices[i];
    v.on = false;
    v.held = false;
    v.env = 0;
    v.stage = 'off';
  }
  eng.sus = false;
  eng.env.fill(0);
  eng.ringL.fill(0);
  eng.ringR.fill(0);
  eng.write = 0;
  eng.freezePos = 0;
  eng.locked = false;
  eng.arm = 0;
  eng.loud = 0;
  eng.spawn = 0;
  for (let i = 0; i < eng.grains.length; i++) eng.grains[i].on = false;
  eng.r1.y1 = eng.r1.y2 = eng.r2.y1 = eng.r2.y2 = eng.r3.y1 = eng.r3.y2 = 0;
}

function applyPatch(eng, p) {
  const prev = !!(eng.P && eng.P.grain && eng.P.grain.freeze);
  eng.P = normalizeKlystron(p);
  const freeze = !!eng.P.grain.freeze;
  if (freeze && !prev) {
    eng.freezePos = eng.write;
    eng.locked = true;
  }
  if (!freeze) {
    eng.locked = false;
    eng.arm = 0;
  }
  eng.wasFreeze = freeze;
  if (eng.bankQ !== eng.P.bank.q) tuneBank(eng);
  if (eng.mouthX !== eng.P.mouth.x || eng.mouthY !== eng.P.mouth.y) tuneMouth(eng);
}

function apply(eng, msg) {
  if (!msg || !msg.t) return;
  if (msg.t === 'patch') applyPatch(eng, msg.p);
  else if (msg.t === 'on') voiceOn(eng, msg.n | 0, clamp(+msg.v || 0, 0, 1));
  else if (msg.t === 'off') voiceOff(eng, msg.n | 0);
  else if (msg.t === 'bend') eng.bend = clamp(+msg.v || 0, -1, 1);
  else if (msg.t === 'mw') eng.mw = clamp(+msg.v || 0, 0, 1);
  else if (msg.t === 'sus') { eng.sus = !!msg.on; releaseSustain(eng); }
  else if (msg.t === 'panic') silenceKlystron(eng);
  else if (msg.t === 'active') {
    eng.active = !!msg.on;
    if (!eng.active) silenceKlystron(eng);
  } else if (msg.t === 'buffer' && msg.L) setKlystronBuffer(eng, msg.L, msg.sr || eng.sr, msg.name);
}

export function postKlystron(eng, msg) {
  if (!msg) return;
  if (msg.at != null && msg.at > eng.frame) {
    eng.queue.push(msg);
    eng.queue.sort((a, b) => a.at - b.at);
    return;
  }
  apply(eng, msg);
}

function readRing(buf, pos) {
  const n = buf.length;
  let i = pos % n;
  if (i < 0) i += n;
  const i0 = i | 0;
  const f = i - i0;
  const i1 = i0 + 1 >= n ? 0 : i0 + 1;
  return buf[i0] + (buf[i1] - buf[i0]) * f;
}

function fileSample(eng) {
  const b = eng.buf;
  if (!b || b.length < 2) return 0;
  const n = b.length;
  let i = eng.bufPos % n;
  if (i < 0) i += n;
  const i0 = i | 0;
  const f = i - i0;
  const i1 = i0 + 1 >= n ? 0 : i0 + 1;
  eng.bufPos += 1;
  if (eng.bufPos >= n) eng.bufPos -= n;
  return b[i0] + (b[i1] - b[i0]) * f;
}

function vowelSample(eng) {
  const g = eng.P.mouth.glottis / eng.sr;
  eng.gPhase += g;
  let e = 0;
  if (eng.gPhase >= 1) {
    eng.gPhase -= 1;
    e = 1;
  }
  const wh = eng.P.mouth.whisper;
  if (wh > 0.001) e += noise(eng) * wh * 0.35;
  const a = tickRes(eng.r1, e);
  const b = tickRes(eng.r2, e);
  const c = tickRes(eng.r3, e);
  // A difference on the higher formants keeps a bright vowel from collapsing
  // into the first peak. The low formant stays in the mix so "u" and "o" stay dark.
  const y = a * 0.55 + b * 1.45 + c * 1.05;
  const d = y - (eng.pre || 0);
  eng.pre = y;
  return a * 0.85 + d * 1.6;
}

function modulator(eng, input) {
  const src = eng.P.source;
  let m = 0;
  if (src === 'mic') m = input || 0;
  else if (src === 'file') m = fileSample(eng);
  else m = vowelSample(eng);
  const ax = m < 0 ? -m : m;
  eng.modEnv += (ax - eng.modEnv) * 0.0015;
  if (eng.modEnv < 1e-5) eng.modEnv = 1e-5;
  const norm = 0.22 / eng.modEnv;
  return m * (norm > 6 ? 6 : norm);
}

function carrierSample(eng) {
  const P = eng.P.carrier;
  const aC = coef(P.attack, eng.sr);
  const rC = coef(P.release, eng.sr);
  let sum = 0;
  const tune = P.tune;
  const nseMix = clamp(P.noise + eng.mw * 0.45, 0, 1);
  for (let i = 0; i < eng.voices.length; i++) {
    const v = eng.voices[i];
    if (!v.on) continue;
    if (v.stage === 'a') {
      v.env += (1 - v.env) * aC;
      if (v.env > 0.98) v.stage = 's';
    } else if (v.stage === 'r') {
      v.env += (0 - v.env) * rC;
      if (v.env < 0.0008) {
        v.env = 0;
        v.on = false;
        v.stage = 'off';
        continue;
      }
    }
    const hz = noteHz(v.n, eng.bend, tune);
    const dt = hz / eng.sr;
    v.phase += dt;
    if (v.phase >= 1) v.phase -= 1;
    const nse = noise(eng);
    const w = waveOf(P.wave, v.phase, dt, nse);
    sum += (w * (1 - nseMix) + nse * nseMix) * v.env * (0.35 + 0.65 * v.vel);
  }
  return sum;
}

function bandTilt(eng, i) {
  if (eng.P.source === 'vowel') return 1;
  const x = eng.P.mouth.x;
  const y = eng.P.mouth.y;
  const center = x * (BANDS - 1);
  const d = (i - center) / 2.4;
  const bump = Math.exp(-d * d);
  const tilt = Math.exp((y - 0.5) * 1.4 * (i / (BANDS - 1) - 0.5));
  return (0.25 + 0.75 * bump) * tilt;
}

function spawnGrain(eng) {
  let g = null;
  for (let i = 0; i < eng.grains.length; i++) if (!eng.grains[i].on) { g = eng.grains[i]; break; }
  if (!g) return;
  const len = Math.max(8, (eng.P.grain.size / 1000) * eng.sr);
  const spray = eng.P.grain.spray;
  const base = eng.locked ? eng.freezePos : eng.write;
  const back = len * (0.35 + spray * rand(eng));
  g.on = true;
  g.pos = base - back;
  g.i = 0;
  g.len = len;
  g.inc = 1 + (rand(eng) - 0.5) * spray * 0.2;
  g.pan = (rand(eng) * 2 - 1) * eng.P.grain.spread;
}

function anyVoice(eng) {
  for (let i = 0; i < eng.voices.length; i++) if (eng.voices[i].on) return true;
  return false;
}

function grainsOn(eng) {
  for (let i = 0; i < eng.grains.length; i++) if (eng.grains[i].on) return true;
  return false;
}

function publish(eng) {
  const notes = [];
  let voices = 0;
  let grains = 0;
  for (let i = 0; i < eng.voices.length; i++) {
    const v = eng.voices[i];
    if (v.on && v.env > 0.02) { voices++; notes.push(v.n); }
  }
  for (let i = 0; i < eng.grains.length; i++) if (eng.grains[i].on) grains++;
  const level = Math.sqrt(eng.acc / Math.max(1, eng.accN));
  if (eng.onMeter) {
    eng.onMeter({
      t: 'meter',
      dev: 'klystron',
      voices,
      notes,
      grains,
      playing: voices > 0 || (eng.P.grain.freeze && grains > 0),
      level,
      peak: level,
      cpu: eng.cpuFrames ? eng.cpuMs / (eng.cpuFrames / eng.sr * 1000) : 0,
    });
  }
  eng.acc = 0;
  eng.accN = 0;
  eng.meterN = 0;
  eng.cpuMs = 0;
  eng.cpuFrames = 0;
}

export function renderKlystron(eng, outL, outR, input, frame0) {
  const n = outL.length;
  const stereo = outR && outR !== outL;
  const t0 = Date.now();
  if (!eng.active) {
    outL.fill(0);
    if (stereo) outR.fill(0);
    return;
  }
  const P = eng.P;
  if (eng.bankQ !== P.bank.q) tuneBank(eng);
  if (eng.mouthX !== P.mouth.x || eng.mouthY !== P.mouth.y) tuneMouth(eng);
  const aE = coef(P.bank.attack, eng.sr);
  const rE = coef(P.bank.release, eng.sr);
  const gate = P.bank.gate;
  const ringN = eng.ringL.length;
  let qi = 0;
  const q = eng.queue;
  if (!anyVoice(eng) && !grainsOn(eng) && !q.length) {
    outL.fill(0);
    if (stereo) outR.fill(0);
    eng.meterN += n;
    eng.cpuMs += Date.now() - t0;
    eng.cpuFrames += n;
    if (eng.meterN >= eng.sr / 30) publish(eng);
    return;
  }
  for (let i = 0; i < n; i++) {
    const frame = (frame0 || 0) + i;
    while (qi < q.length && q[qi].at <= frame) {
      apply(eng, q[qi]);
      qi++;
    }
    const inS = input && i < input.length ? input[i] : 0;
    const mod = modulator(eng, inS);
    const car = carrierSample(eng);
    let dry = 0;
    for (let b = 0; b < BANDS; b++) {
      const mb = tickBP(eng.ana[b], mod);
      const ax = mb < 0 ? -mb : mb;
      const env = eng.env[b];
      const c = ax > env ? aE : rE;
      const next = env + (ax - env) * c;
      eng.env[b] = next < 1e-8 ? 0 : next;
      const open = next > gate ? next * 2.6 : 0;
      const sb = tickBP(eng.syn[b], car);
      dry += sb * open * bandTilt(eng, b);
    }
    dry *= 3.4;
    if (dry > 1.4) dry = 1.4;
    else if (dry < -1.4) dry = -1.4;

    const freeze = eng.P.grain.freeze;
    if (freeze && !eng.wasFreeze) {
      eng.freezePos = eng.write;
      eng.locked = true;
    }
    if (!freeze) {
      eng.locked = false;
      eng.arm = 0;
      eng.loud = 0;
    }
    eng.wasFreeze = freeze;
    if (!eng.locked) {
      eng.ringL[eng.write] = dry;
      eng.ringR[eng.write] = dry;
      eng.write++;
      if (eng.write >= ringN) eng.write = 0;
      if (freeze) {
        eng.arm++;
        if (dry > 0.02 || dry < -0.02) eng.loud++;
        const need = Math.max(8, (eng.P.grain.size / 1000) * eng.sr);
        // A note shorter than the grain still freezes what was heard.
        const heard = eng.loud > Math.min(need * 0.25, eng.sr * 0.03);
        if (eng.arm >= need || (heard && !anyVoice(eng))) {
          eng.locked = true;
          eng.freezePos = eng.write;
        }
      }
    }
    let wetL = 0;
    let wetR = 0;
    const smear = eng.P.grain.mix;
    const speaking = anyVoice(eng);
    if (smear > 0.001 && (speaking || eng.locked)) {
      eng.spawn += eng.P.grain.density / eng.sr;
      while (eng.spawn >= 1) {
        eng.spawn -= 1;
        spawnGrain(eng);
      }
    } else eng.spawn = 0;
    for (let g = 0; g < eng.grains.length; g++) {
      const gr = eng.grains[g];
      if (!gr.on) continue;
      const p = gr.len > 1 ? gr.i / (gr.len - 1) : 1;
      const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * (p < 0 ? 0 : p > 1 ? 1 : p));
      const sL = readRing(eng.ringL, gr.pos);
      const sR = readRing(eng.ringR, gr.pos);
      const pan = gr.pan;
      wetL += sL * w * (pan < 0 ? 1 : 1 - pan);
      wetR += sR * w * (pan > 0 ? 1 : 1 + pan);
      gr.pos += gr.inc;
      gr.i += 1;
      if (gr.i >= gr.len) gr.on = false;
    }
    const m = eng.P.grain.mix;
    let oL = dry * (1 - m) + wetL * m * 0.65;
    let oR = dry * (1 - m) + wetR * m * 0.65;
    const spread = eng.P.grain.spread;
    if (spread > 0.001) {
      const mid = 0.5 * (oL + oR);
      const side = 0.5 * (oL - oR);
      oL = mid + side * (1 + spread);
      oR = mid - side * (1 + spread);
    }
    const level = eng.P.level;
    oL *= level;
    oR *= level;
    if (oL > 1) oL = 1;
    else if (oL < -1) oL = -1;
    if (oR > 1) oR = 1;
    else if (oR < -1) oR = -1;
    outL[i] = oL;
    if (stereo) outR[i] = oR;
    eng.acc += oL * oL;
    eng.accN++;
  }
  if (qi) q.splice(0, qi);
  eng.frame = (frame0 || 0) + n;
  eng.meterN += n;
  eng.cpuMs += Date.now() - t0;
  eng.cpuFrames += n;
  if (eng.meterN >= eng.sr / 30) publish(eng);
}
