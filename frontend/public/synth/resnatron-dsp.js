// Resnatron voice. Original. One monophonic patch bay: each cable is a one-sample
// delay, so a loop (delay back into the filter, an oscillator into itself) stays
// finite. The filter is a trapezoidal state-variable. Saw and square use a
// polyBLEP step so the high notes do not fold as hard. No third-party DSP.

import { clamp, normalizeResnatron } from './resnatron.js';

export function createResnatronEngine(sr, patch) {
  return {
    sr,
    patch: normalizeResnatron(patch),
    active: true,
    notes: [],
    pedal: [],
    last: { n: 60, v: 0 },
    sustain: false,
    silent: false,
    retrigger: false,
    bend: 0,
    mw: 0,
    phase1: 0,
    phase2: 0,
    sync1: 0,
    sync2: 0,
    lfoPhase: 0,
    env: 0,
    envStage: 'idle',
    sh: 0,
    shTarget: 0,
    shPhase: 0,
    shPrev: 0,
    p1: 0,
    p2: 0,
    p3: 0,
    vcf: { ic1: 0, ic2: 0 },
    delay: new Float32Array(Math.max(2, sr)),
    dpos: 0,
    bus: {},
    peak: 0,
    voices: 0,
    played: 0,
    meterN: 0,
    cpu: 0,
    onMeter: null,
  };
}

function polyblep(t, dt) {
  if (!(dt > 0)) return 0;
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

function osc(phase, dt, wave, pw) {
  if (wave === 'sine') return Math.sin(phase * 6.283185307179586);
  if (wave === 'tri') return phase < 0.5 ? phase * 4 - 1 : 3 - phase * 4;
  if (wave === 'saw') return (2 * phase - 1) - polyblep(phase, dt);
  const w = pw == null ? 0.5 : pw;
  let s = phase < w ? 1 : -1;
  s += polyblep(phase, dt);
  let t2 = phase - w;
  if (t2 < 0) t2 += 1;
  s -= polyblep(t2, dt);
  return s;
}

function read(eng, port) {
  const cables = eng.patch.cables;
  for (let i = 0; i < cables.length; i++) {
    if (cables[i].to === port) return { value: eng.bus[cables[i].from] || 0, patched: true };
  }
  return { value: 0, patched: false };
}

function top(eng) {
  if (eng.notes.length) return eng.notes[eng.notes.length - 1];
  if (eng.pedal.length) return eng.pedal[eng.pedal.length - 1];
  return eng.last;
}

function gateOn(eng) { return eng.notes.length > 0 || eng.pedal.length > 0; }

function svf(s, x, fc, res, sr) {
  const wd = Math.min(Math.max(fc, 20), sr * 0.45);
  const g = Math.tan(Math.PI * wd / sr);
  const k = 2 * (1 - Math.min(0.98, Math.max(0, res)));
  const a1 = 1 / (1 + g * (g + k));
  const a2 = g * a1;
  const a3 = g * a2;
  const v3 = x - s.ic2;
  const v1 = a1 * s.ic1 + a2 * v3;
  const v2 = s.ic2 + a2 * s.ic1 + a3 * v3;
  s.ic1 = 2 * v1 - s.ic1;
  s.ic2 = 2 * v2 - s.ic2;
  return { lp: v2, bp: v1, hp: x - k * v1 - v2 };
}

function vco(eng, id, phaseKey, syncKey) {
  const p = eng.patch[id];
  const note = p.kbd ? top(eng).n : 60;
  const fm = read(eng, id + '.fm');
  const pwm = read(eng, id + '.pwm');
  const sync = read(eng, id + '.sync');
  const oct = (note - 69) / 12 + p.oct + p.fine / 12 + eng.bend * 2 / 12 + fm.value * p.fm;
  const freq = clamp(440 * Math.pow(2, oct), 1, eng.sr * 0.45);
  const dt = freq / eng.sr;
  let phase = eng[phaseKey] + dt;
  if (sync.patched && eng[syncKey] <= 0 && sync.value > 0) phase = dt;
  if (phase >= 1) phase -= 1;
  eng[phaseKey] = phase;
  eng[syncKey] = sync.value;
  const pw = clamp(p.pw + (pwm.patched ? pwm.value * 0.45 : 0), 0.05, 0.95);
  return osc(phase, dt, p.wave, pw);
}

function envStep(eng, gate) {
  const p = eng.patch.env;
  const sr = eng.sr;
  if (eng.retrigger && gate) { eng.envStage = 'atk'; eng.retrigger = false; }
  if (!gate && (eng.envStage === 'atk' || eng.envStage === 'dec')) eng.envStage = 'rel';
  if (eng.envStage === 'atk') {
    eng.env = Math.min(1, eng.env + 1 / Math.max(1, p.a * sr));
    if (eng.env >= 1) eng.envStage = 'dec';
  } else if (eng.envStage === 'dec') {
    const step = 1 / Math.max(1, p.d * sr);
    if (eng.env > p.s) eng.env = Math.max(p.s, eng.env - step);
  } else if (eng.envStage === 'rel') {
    eng.env = Math.max(0, eng.env - 1 / Math.max(1, p.r * sr));
    if (eng.env <= 0) { eng.env = 0; eng.envStage = 'idle'; }
  }
}

function dread(eng, time) {
  const len = eng.delay.length;
  let d = time * eng.sr;
  if (d < 1) d = 1;
  if (d > len - 2) d = len - 2;
  let pos = eng.dpos - d;
  while (pos < 0) pos += len;
  const i = Math.floor(pos) % len;
  const f = pos - Math.floor(pos);
  const a = eng.delay[i];
  const b = eng.delay[(i + 1) % len];
  return a + (b - a) * f;
}

function step(eng) {
  const sr = eng.sr;
  const held = gateOn(eng) && eng.active;
  const note = top(eng);
  const white = Math.random() * 2 - 1;
  eng.p1 += (white - eng.p1) * 0.02;
  eng.p2 += (white - eng.p2) * 0.09;
  eng.p3 += (white - eng.p3) * 0.35;
  const pink = (eng.p1 + eng.p2 + eng.p3) * 0.55;
  const noise = eng.patch.noise.color === 'pink' ? pink : white;

  const lfoRateIn = read(eng, 'lfo.rate');
  const lfoRate = clamp(eng.patch.lfo.rate * Math.pow(2, lfoRateIn.value), 0.02, 40);
  eng.lfoPhase += lfoRate / sr;
  if (eng.lfoPhase >= 1) eng.lfoPhase -= 1;
  const lfo = osc(eng.lfoPhase, lfoRate / sr, eng.patch.lfo.wave, 0.5);

  const gateJack = read(eng, 'env.gate');
  const gate = gateJack.patched ? gateJack.value > 0.5 : !!(eng.patch.env.kbd && held);
  envStep(eng, gate);

  const sigIn = read(eng, 'sh.in');
  const clkIn = read(eng, 'sh.clk');
  if (clkIn.patched) {
    if (eng.shPrev <= 0 && clkIn.value > 0) eng.shTarget = sigIn.patched ? sigIn.value : noise;
    eng.shPrev = clkIn.value;
  } else {
    eng.shPhase += eng.patch.sh.rate / sr;
    if (eng.shPhase >= 1) {
      eng.shPhase -= 1;
      eng.shTarget = sigIn.patched ? sigIn.value : noise;
    }
    eng.shPrev = 0;
  }
  const glide = eng.patch.sh.glide <= 0.0005 ? 1 : 1 - Math.exp(-1 / (eng.patch.sh.glide * sr));
  eng.sh += (eng.shTarget - eng.sh) * glide;

  const v1 = vco(eng, 'vco1', 'phase1', 'sync1');
  const v2 = vco(eng, 'vco2', 'phase2', 'sync2');

  const mix = read(eng, 'mix.a').value * eng.patch.mix.a
    + read(eng, 'mix.b').value * eng.patch.mix.b
    + read(eng, 'mix.c').value * eng.patch.mix.c;

  const fv = read(eng, 'vcf.in');
  const fc = read(eng, 'vcf.cv');
  const cutoff = clamp(eng.patch.vcf.cutoff * Math.pow(2, fc.value * eng.patch.vcf.depth * 4), 20, sr * 0.45);
  const filt = svf(eng.vcf, fv.value, cutoff, eng.patch.vcf.res, sr);
  const mode = eng.patch.vcf.mode;
  let fOut = mode === 'hp' ? filt.hp : mode === 'bp' ? filt.bp : filt.lp;
  if (!isFinite(fOut)) { fOut = 0; eng.vcf.ic1 = 0; eng.vcf.ic2 = 0; }

  const av = read(eng, 'vca.in');
  const ac = read(eng, 'vca.cv');
  const gain = clamp(eng.patch.vca.level + ac.value, 0, 1);
  const vca = av.value * gain;

  const dIn = read(eng, 'delay.in').value;
  const wet = dread(eng, eng.patch.delay.time);
  let rec = dIn + wet * eng.patch.delay.fb;
  if (rec > 1.4) rec = 1.4;
  else if (rec < -1.4) rec = -1.4;
  eng.delay[eng.dpos] = rec;
  eng.dpos += 1;
  if (eng.dpos >= eng.delay.length) eng.dpos = 0;
  const dm = eng.patch.delay.mix;
  const delayed = dIn * (1 - dm) + wet * dm;

  const inn = read(eng, 'out.in');
  const inR = read(eng, 'out.inR');
  const ang = (clamp(eng.patch.out.pan, -1, 1) + 1) * Math.PI * 0.25;
  const trim = 0.45 * eng.patch.out.level * eng.patch.level;
  let l = inn.value * Math.cos(ang) * trim;
  let r = (inR.patched ? inR.value : inn.value) * Math.sin(ang) * trim;
  if (!eng.active || eng.silent || !isFinite(l)) l = 0;
  if (!eng.active || eng.silent || !isFinite(r)) r = 0;

  eng.bus = {
    'keys.gate': held ? 1 : 0,
    'keys.vel': held ? note.v : 0,
    'keys.cv': (note.n - 60) / 12,
    'wheel.out': eng.mw,
    'vco1.out': v1,
    'vco2.out': v2,
    'noise.out': noise,
    'lfo.out': lfo,
    'sh.out': eng.sh,
    'env.out': eng.env,
    'mix.out': mix,
    'vcf.out': fOut,
    'vca.out': vca,
    'delay.out': delayed,
  };
  eng.voices = eng.active ? eng.notes.length + eng.pedal.length : 0;
  return { l, r };
}

export function renderResnatron(eng, L, R) {
  const frames = L.length;
  let peak = 0;
  for (let i = 0; i < frames; i++) {
    const s = step(eng);
    L[i] = s.l;
    R[i] = s.r;
    const a = s.l < 0 ? -s.l : s.l;
    const b = s.r < 0 ? -s.r : s.r;
    if (a > peak) peak = a;
    if (b > peak) peak = b;
  }
  eng.peak = peak;
  eng.played += frames;
  eng.meterN += frames;
  if (eng.meterN >= 2048 && eng.onMeter) {
    eng.meterN = 0;
    const notes = [];
    for (let i = 0; i < eng.notes.length; i++) notes.push(eng.notes[i].n);
    eng.onMeter({ t: 'meter', voices: eng.voices, cpu: eng.cpu, peak: eng.peak, notes });
  }
}

function dropNote(eng, n) {
  const i = eng.notes.findIndex(x => x.n === n);
  if (i < 0) return;
  const note = eng.notes.splice(i, 1)[0];
  if (eng.sustain) eng.pedal.push(note);
}

export function postResnatron(eng, msg) {
  if (!msg || !msg.t) return;
  if (msg.t === 'patch') {
    eng.patch = normalizeResnatron(msg.p);
    return;
  }
  if (msg.t === 'on') {
    if (!eng.active) return;
    const n = msg.n | 0;
    const v = clamp(msg.v == null ? 0.8 : +msg.v, 0, 1);
    eng.pedal = eng.pedal.filter(x => x.n !== n);
    eng.notes = eng.notes.filter(x => x.n !== n);
    eng.notes.push({ n, v });
    eng.last = { n, v };
    eng.retrigger = true;
    eng.silent = false;
    return;
  }
  if (msg.t === 'off') { dropNote(eng, msg.n | 0); return; }
  if (msg.t === 'bend') { eng.bend = clamp(+msg.v || 0, -1, 1); return; }
  if (msg.t === 'mw') { eng.mw = clamp(+msg.v || 0, 0, 1); return; }
  if (msg.t === 'sus') {
    eng.sustain = !!msg.on;
    if (!eng.sustain) eng.pedal = [];
    return;
  }
  if (msg.t === 'panic' || (msg.t === 'active' && !msg.on)) {
    eng.notes = [];
    eng.pedal = [];
    eng.sustain = msg.t === 'sus' ? eng.sustain : false;
    eng.retrigger = false;
    eng.env = 0;
    eng.envStage = 'idle';
    eng.sh = 0;
    eng.shTarget = 0;
    eng.vcf.ic1 = 0;
    eng.vcf.ic2 = 0;
    eng.delay.fill(0);
    eng.voices = 0;
    if (msg.t === 'panic') eng.silent = true;
    if (msg.t === 'active') eng.active = false;
    return;
  }
  if (msg.t === 'active') eng.active = !!msg.on;
}
