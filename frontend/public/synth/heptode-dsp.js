// Heptode voice engine. Original. One pool of voices plays every channel.
// The oscillator morphs a sine through a triangle into a three-partial saw.
// FM is a sine modulator at twice the note. The filter is a clamped state
// variable. Delay, chorus and reverb are global buses fed by per-track sends.
//
// The reverb is the published Schroeder layout (parallel damped combs, then
// series allpasses) after Julius O. Smith's description. The delay lengths
// are ours. It is not the Freeverb tuning and it is not a translation of
// that code.

import { FAMILIES, familyFor, familyOf } from './heptode-family.js';
import { normalizeHeptode } from './heptode.js';

export const VOICES = 32;

function blankVoice() {
  return {
    on: false, live: false, stage: 'off', env: 0, relFrom: 0, relT: 0,
    phase: 0, modPhase: 0, note: 60, vel: 0.8, tr: 0,
    endFrame: 1e15, wantOff: false, wait: 0, age: 0, gen: 0,
    low: 0, band: 0, fade: 1,
  };
}

function blankCC() {
  return { vol: 100 / 127, expr: 1, bend: 0, bendRange: 2, sus: false, mod: 0, rpnL: 127, rpnM: 127 };
}

function osc(phase, wave) {
  const s = Math.sin(phase);
  const tri = (2 / Math.PI) * Math.asin(s < -1 ? -1 : s > 1 ? 1 : s);
  const saw = (s + 0.5 * Math.sin(phase * 2) + 0.25 * Math.sin(phase * 3)) * (1 / 1.75);
  if (wave <= 0) return s;
  if (wave >= 1) return saw;
  if (wave < 0.5) {
    const m = wave * 2;
    return s * (1 - m) + tri * m;
  }
  const m = (wave - 0.5) * 2;
  return tri * (1 - m) + saw * m;
}

function softDrive(x, amt) {
  if (amt < 0.001) return x;
  const k = amt * 5;
  const y = x / (1 + k * (x < 0 ? -x : x));
  return y * (1 + k * 0.35);
}

function lim(x) {
  if (!isFinite(x)) return 0;
  const a = x < 0 ? -x : x;
  if (a <= 0.9) return x;
  const s = x < 0 ? -1 : 1;
  return s * (0.9 + 0.1 * Math.tanh((a - 0.9) * 3));
}

function makeLine(n) {
  return { buf: new Float32Array(n), i: 0, z: 0 };
}

export function createHeptodeEngine(sr, patch) {
  const delayN = Math.ceil(sr * 1.4);
  const eng = {
    sr,
    patch: normalizeHeptode(patch),
    voices: Array.from({ length: VOICES }, blankVoice),
    cc: Array.from({ length: 16 }, blankCC),
    held: new Map(),
    gen: 1,
    active: true,
    playing: false,
    pos: 0,
    tempoScale: 1,
    frame: 0,
    queue: [],
    q: 0,
    queueDirty: false,
    score: null,
    cursor: 0,
    ccursor: 0,
    vib: 0,
    delayL: makeLine(delayN),
    delayR: makeLine(delayN),
    chorusL: makeLine(Math.ceil(sr * 0.04)),
    chorusR: makeLine(Math.ceil(sr * 0.04)),
    lfo: 0,
    combsL: [19.7, 23.3, 27.1, 31.9].map(ms => makeLine(Math.max(8, Math.round(sr * ms / 1000)))),
    combsR: [21.1, 25.7, 29.9, 34.3].map(ms => makeLine(Math.max(8, Math.round(sr * ms / 1000)))),
    apL: [5.7, 8.3].map(ms => makeLine(Math.max(8, Math.round(sr * ms / 1000)))),
    apR: [6.4, 9.1].map(ms => makeLine(Math.max(8, Math.round(sr * ms / 1000)))),
    meterN: 0,
    peak: 0,
    onMeter: null,
    cap: 32,
  };
  applyCap(eng);
  refreshSolo(eng);
  return eng;
}

function applyCap(eng) {
  const p = eng.patch;
  eng.cap = p.performance ? Math.min(16, p.poly | 0) : Math.min(VOICES, p.poly | 0);
  if (eng.cap < 4) eng.cap = 4;
}

function refreshSolo(eng) {
  eng.anySolo = false;
  const tracks = eng.patch.tracks;
  for (let i = 0; i < tracks.length; i++) if (tracks[i].solo) { eng.anySolo = true; break; }
}

function audible(eng, tr) {
  const t = eng.patch.tracks[tr];
  if (!t || t.mute) return false;
  if (eng.anySolo && !t.solo) return false;
  return true;
}

// Steal only among voices that are already sounding, so the polyphony cap holds.
function stealIndex(eng) {
  let best = 0, bestScore = 1e9;
  for (let i = 0; i < VOICES; i++) {
    const v = eng.voices[i];
    if (!v.on) continue;
    const rank = (v.stage === 'rel' ? -100 : 0) + v.env * 10 - v.age * 1e-4;
    if (rank < bestScore) { bestScore = rank; best = i; }
  }
  return best;
}

function dropHeld(eng, v) {
  if (!v.live) return;
  const key = v.tr + ':' + v.note;
  if (eng.held.get(key) != null) {
    const idx = eng.held.get(key);
    if (eng.voices[idx] === v) eng.held.delete(key);
  }
}

function startNote(eng, tr, note, vel, offset, live, durSec) {
  if (!audible(eng, tr)) return null;
  let active = 0;
  for (let i = 0; i < VOICES; i++) if (eng.voices[i].on) active++;
  let slot = -1;
  if (live) {
    const prev = eng.held.get(tr + ':' + note);
    if (prev != null && eng.voices[prev].on) slot = prev;
  }
  const retrig = slot >= 0;
  if (!retrig && active < eng.cap) {
    for (let i = 0; i < VOICES; i++) if (!eng.voices[i].on) { slot = i; break; }
  }
  if (slot < 0) slot = stealIndex(eng);
  const v = eng.voices[slot];
  dropHeld(eng, v);
  v.on = true;
  v.live = !!live;
  v.stage = 'atk';
  v.env = 0;
  v.relFrom = 0;
  v.relT = 0;
  v.fast = false;
  v.phase = 0;
  v.modPhase = 0;
  v.note = note & 127;
  v.vel = vel < 0 ? 0 : vel > 1 ? 1 : vel;
  v.tr = tr & 15;
  const scale = eng.tempoScale > 0 ? eng.tempoScale : 1;
  const durSamp = live ? 0 : Math.max(1, Math.round((durSec > 0 ? durSec : 0.2) / scale * eng.sr));
  v.endFrame = live ? 1e15 : eng.frame + (offset > 0 ? offset | 0 : 0) + durSamp;
  v.wantOff = false;
  v.wait = offset > 0 ? offset | 0 : 0;
  v.age = 0;
  v.gen = ++eng.gen;
  v.low = 0;
  v.band = 0;
  v.fade = 0;
  if (live) eng.held.set(v.tr + ':' + v.note, slot);
  return v;
}

function releaseVoice(v, fast) {
  if (!v.on) return;
  if (v.stage === 'rel' && (v.fast || !fast)) return;
  v.stage = 'rel';
  v.relFrom = v.env;
  v.relT = 0;
  v.wantOff = true;
  v.fast = !!fast;
}

function releaseTrackPedal(eng, tr) {
  for (let i = 0; i < VOICES; i++) {
    const v = eng.voices[i];
    if (v.on && v.tr === tr && v.wantOff && v.stage !== 'rel') releaseVoice(v, false);
  }
}

function silence(eng) {
  for (let i = 0; i < VOICES; i++) {
    const v = eng.voices[i];
    if (v.on) releaseVoice(v, true);
  }
  eng.held.clear();
  eng.cc.forEach(c => { c.sus = false; });
}

function onProgram(eng, tr, program) {
  const t = eng.patch.tracks[tr];
  if (!t) return;
  t.program = program & 127;
  t.family = tr === 9 ? 'drum' : familyOf(t.program);
  if (t.touched) return;
  const fam = familyFor(t.program, tr);
  t.wave = fam.wave;
  t.fm = 0;
  t.drive = 0;
  t.delay = 0;
  t.reverb = 0;
  t.chorus = 0;
  t.a = fam.a; t.d = fam.d; t.s = fam.s; t.r = fam.r;
  t.cutoff = fam.cutoff; t.res = fam.res; t.fenv = fam.fenv;
}

function onCC(eng, tr, cc, v) {
  const c = eng.cc[tr];
  const t = eng.patch.tracks[tr];
  if (cc === 7) c.vol = v;
  else if (cc === 11) c.expr = v;
  else if (cc === 1) c.mod = v;
  else if (cc === 10 && t && !t.placed) t.pan = v * 2 - 1;
  else if (cc === 64) {
    const was = c.sus;
    c.sus = v >= 0.5;
    if (was && !c.sus) releaseTrackPedal(eng, tr);
  } else if (cc === 101) c.rpnM = Math.round(v * 127);
  else if (cc === 100) c.rpnL = Math.round(v * 127);
  else if (cc === 6 && c.rpnM === 0 && c.rpnL === 0) c.bendRange = Math.max(0, Math.min(24, Math.round(v * 127)));
  else if (cc === 120 || cc === 123) {
    for (let i = 0; i < VOICES; i++) if (eng.voices[i].on && eng.voices[i].tr === tr) releaseVoice(eng.voices[i], false);
    c.sus = false;
  }
}

function dispatch(eng, e, offset) {
  if (!e) return;
  if (e.t === 'on') startNote(eng, e.tr | 0, e.n | 0, e.v == null ? 0.8 : e.v, offset, true, 0);
  else if (e.t === 'off') {
    const key = (e.tr | 0) + ':' + (e.n | 0);
    const slot = eng.held.get(key);
    eng.held.delete(key);
    if (slot == null) return;
    const v = eng.voices[slot];
    if (!v.on) return;
    if (eng.cc[v.tr].sus) { v.wantOff = true; return; }
    releaseVoice(v, false);
  } else if (e.t === 'cc') onCC(eng, e.tr | 0, e.c | 0, e.v == null ? 0 : e.v);
  else if (e.t === 'bend') eng.cc[(e.tr | 0) & 15].bend = e.v;
  else if (e.t === 'mw') eng.cc.forEach(c => { c.mod = e.v; });
  else if (e.t === 'sus') {
    eng.cc.forEach((c, tr) => {
      const was = c.sus;
      c.sus = !!e.on;
      if (was && !c.sus) releaseTrackPedal(eng, tr);
    });
  } else if (e.t === 'panic' || e.t === 'stop') {
    if (e.t === 'stop') eng.playing = false;
    silence(eng);
  } else if (e.t === 'play') {
    eng.playing = true;
    if (e.pos != null) { eng.pos = e.pos; seek(eng); }
  } else if (e.t === 'seek') {
    eng.pos = e.pos || 0;
    seek(eng);
    silence(eng);
  }
}

function seek(eng) {
  const s = eng.score;
  if (!s) { eng.cursor = 0; eng.ccursor = 0; return; }
  const t = eng.pos;
  let lo = 0, hi = s.t.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (s.t[mid] < t) lo = mid + 1; else hi = mid;
  }
  eng.cursor = lo;
  lo = 0; hi = s.ct.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (s.ct[mid] < t) lo = mid + 1; else hi = mid;
  }
  eng.ccursor = lo;
}

function applyControl(eng, i) {
  const s = eng.score;
  const kind = s.ck[i];
  const ch = s.ch[i];
  const v = s.cv[i];
  if (kind === 1) eng.cc[ch].bend = v;
  else if (kind === 2) onCC(eng, ch, s.cc[i], v);
  else onProgram(eng, ch, v);
}

function pullScore(eng, t0, t1, sample0, scale) {
  const s = eng.score;
  if (!s) return;
  const sr = eng.sr;
  while (eng.ccursor < s.ct.length && s.ct[eng.ccursor] < t1) {
    const ct = s.ct[eng.ccursor];
    if (ct >= t0) applyControl(eng, eng.ccursor);
    eng.ccursor++;
  }
  while (eng.cursor < s.t.length && s.t[eng.cursor] < t1) {
    const nt = s.t[eng.cursor];
    if (nt >= t0) {
      const offset = sample0 + Math.round((nt - t0) / scale * sr);
      const tr = s.tr[eng.cursor];
      const vel = s.v[eng.cursor] / 127;
      startNote(eng, tr, s.n[eng.cursor], vel, offset, false, s.d[eng.cursor]);
    }
    eng.cursor++;
  }
}

function advanceScore(eng, n) {
  if (!eng.playing || !eng.score) return;
  const scale = eng.tempoScale > 0 ? eng.tempoScale : 1;
  const span = (n / eng.sr) * scale;
  const loopOn = eng.patch.loop && eng.patch.loop1 > eng.patch.loop0 + 0.01;
  let t0 = eng.pos;
  let left = span;
  let sample = 0;
  while (left > 1e-6) {
    let t1 = t0 + left;
    if (loopOn && t0 < eng.patch.loop1 && t1 >= eng.patch.loop1) {
      const until = eng.patch.loop1;
      const samples = Math.max(0, Math.round((until - t0) / scale * eng.sr));
      pullScore(eng, t0, until, sample, scale);
      sample += samples;
      for (let i = 0; i < VOICES; i++) {
        const v = eng.voices[i];
        if (v.on && !v.live) releaseVoice(v, true);
      }
      eng.pos = eng.patch.loop0;
      seek(eng);
      t0 = eng.pos;
      left -= (until - (t1 - left));
      continue;
    }
    pullScore(eng, t0, t1, sample, scale);
    eng.pos = t1;
    left = 0;
  }
}

function readDelay(line, delay) {
  const n = line.buf.length;
  let p = line.i - delay;
  while (p < 0) p += n;
  const i0 = p | 0;
  const f = p - i0;
  const a = line.buf[i0];
  const b = line.buf[(i0 + 1) % n];
  return a + (b - a) * f;
}

function writeDelay(line, x) {
  line.buf[line.i] = x;
  line.i++;
  if (line.i >= line.buf.length) line.i = 0;
}

function comb(line, x, feed, damp) {
  const y = line.buf[line.i];
  line.z += damp * (y - line.z);
  if (line.z < 1e-12 && line.z > -1e-12) line.z = 0;
  line.buf[line.i] = x + line.z * feed;
  line.i++;
  if (line.i >= line.buf.length) line.i = 0;
  return y;
}

function allpass(line, x) {
  const y = line.buf[line.i];
  const out = -x + y;
  line.buf[line.i] = x + y * 0.5;
  line.i++;
  if (line.i >= line.buf.length) line.i = 0;
  return out;
}

function envStep(v, track, dt) {
  const a = Math.max(0.001, track.a), d = Math.max(0.001, track.d), r = v.fast ? 0.03 : Math.max(0.001, track.r);
  if (v.stage === 'atk') {
    v.env += dt / a;
    if (v.env >= 1) { v.env = 1; v.stage = 'dec'; }
  } else if (v.stage === 'dec') {
    const s = track.s;
    v.env -= (dt / d) * Math.max(0.0001, 1 - s);
    if (v.env <= s) { v.env = s; v.stage = s <= 0.0001 ? 'rel' : 'sus'; if (v.stage === 'rel') { v.relFrom = v.env; v.relT = 0; } }
  } else if (v.stage === 'sus') {
    v.env = track.s;
  } else if (v.stage === 'rel') {
    v.relT += dt;
    const from = v.relFrom || v.env;
    v.env = from * (1 - v.relT / r);
    if (v.env <= 0) { v.env = 0; v.on = false; v.stage = 'off'; }
  }
}

function voiceSample(eng, v) {
  const track = eng.patch.tracks[v.tr];
  const cc = eng.cc[v.tr];
  const dt = 1 / eng.sr;
  if (v.wait > 0) { v.wait--; return 0; }
  if (!v.live && !v.wantOff && (eng.frame + (eng.i | 0)) >= v.endFrame) {
    if (cc.sus) v.wantOff = true;
    else releaseVoice(v, false);
  }
  envStep(v, track, dt);
  if (!v.on) return 0;
  v.fade += (1 - v.fade) * 0.02;
  if (v.fade > 0.999) v.fade = 1;
  const semis = (v.note - 69) + cc.bend * cc.bendRange + Math.sin(eng.vib) * cc.mod * 0.2;
  const freq = 440 * Math.pow(2, semis / 12);
  const inc = 2 * Math.PI * Math.min(freq, eng.sr * 0.45) / eng.sr;
  if (track.fm > 0.001) {
    v.modPhase += inc * 2;
    v.phase += Math.sin(v.modPhase) * track.fm * 3;
  }
  v.phase += inc;
  if (v.phase > 256) v.phase -= 256;
  if (v.modPhase > 256) v.modPhase -= 256;
  let x = osc(v.phase, track.wave);
  const cutoff = track.cutoff * ((1 - track.fenv) + track.fenv * v.env);
  const fc = Math.min(eng.sr * 0.18, Math.max(40, cutoff));
  const f = 2 * Math.sin(Math.PI * fc / eng.sr);
  const q = 1.15 - track.res * 0.7;
  const high = x - v.low - q * v.band;
  v.band += f * high;
  v.low += f * v.band;
  if (v.low > 2) v.low = 2; else if (v.low < -2) v.low = -2;
  if (v.band > 2) v.band = 2; else if (v.band < -2) v.band = -2;
  if (v.low < 1e-15 && v.low > -1e-15) v.low = 0;
  x = v.low;
  x = softDrive(x, track.drive);
  const amp = 0.22 * v.vel * cc.vol * cc.expr * track.level * v.env * v.fade;
  v.age++;
  return x * amp;
}

export function renderHeptode(eng, L, R) {
  const n = L.length;
  if (eng.active === false) {
    let busy = eng.playing;
    if (!busy) for (let i = 0; i < VOICES; i++) if (eng.voices[i].on) { busy = true; break; }
    if (!busy) {
      for (let i = 0; i < n; i++) { L[i] = 0; R[i] = 0; }
      return;
    }
  }
  const end = eng.frame + n;
  refreshSolo(eng);
  if (eng.queueDirty) {
    const head = eng.queue.slice(0, eng.q);
    const tail = eng.queue.slice(eng.q);
    tail.sort((a, b) => (a.at || 0) - (b.at || 0));
    eng.queue = head.concat(tail);
    eng.queueDirty = false;
  }
  while (eng.q < eng.queue.length && eng.queue[eng.q].at < end) {
    const e = eng.queue[eng.q++];
    dispatch(eng, e, Math.max(0, (e.at | 0) - eng.frame));
  }
  advanceScore(eng, n);
  const fx = eng.patch.fx;
  const level = eng.patch.level;
  const delaySamp = Math.max(1, Math.min(eng.delayL.buf.length - 2, Math.round(eng.sr * fx.delay)));
  const delaySampR = Math.max(1, Math.min(eng.delayR.buf.length - 2, Math.round(delaySamp * 1.13)));
  let peak = 0;
  const dt = 1 / eng.sr;
  for (let i = 0; i < n; i++) {
    eng.vib += 2 * Math.PI * 5.2 * dt;
    eng.lfo += 2 * Math.PI * 0.55 * dt;
    let dryL = 0, dryR = 0, sD = 0, sR = 0, sC = 0;
    for (let vi = 0; vi < VOICES; vi++) {
      const v = eng.voices[vi];
      if (!v.on && v.stage === 'off') continue;
      if (!audible(eng, v.tr)) { if (v.on && v.stage !== 'rel') releaseVoice(v, true); }
      const x = voiceSample(eng, v);
      if (!x) continue;
      const track = eng.patch.tracks[v.tr];
      const p = track.pan < -1 ? -1 : track.pan > 1 ? 1 : track.pan;
      const ang = (p + 1) * Math.PI * 0.25;
      const panL = Math.cos(ang);
      const panR = Math.sin(ang);
      const dist = 1 - track.space * 0.35;
      dryL += x * panL * dist;
      dryR += x * panR * dist;
      sD += x * track.delay;
      sC += x * track.chorus;
      const rev = track.reverb + track.space * 0.8;
      sR += x * (rev > 1 ? 1 : rev);
    }
    const dl = readDelay(eng.delayL, delaySamp);
    const dr = readDelay(eng.delayR, delaySampR);
    writeDelay(eng.delayL, sD + dr * fx.feedback);
    writeDelay(eng.delayR, sD + dl * fx.feedback);
    const cDepth = eng.sr * 0.004 * fx.chorus;
    const cBase = eng.sr * 0.014;
    const cl = readDelay(eng.chorusL, cBase + cDepth * Math.sin(eng.lfo));
    const cr = readDelay(eng.chorusR, cBase + cDepth * Math.sin(eng.lfo + 2.1));
    writeDelay(eng.chorusL, sC);
    writeDelay(eng.chorusR, sC);
    let rl = 0, rr = 0;
    const feed = 0.62 + fx.reverb * 0.2;
    const damp = 0.35;
    for (let k = 0; k < 4; k++) {
      rl += comb(eng.combsL[k], sR, feed, damp);
      rr += comb(eng.combsR[k], sR, feed, damp);
    }
    rl *= 0.25; rr *= 0.25;
    for (let k = 0; k < 2; k++) {
      rl = allpass(eng.apL[k], rl);
      rr = allpass(eng.apR[k], rr);
    }
    let oL = lim((dryL + dl * 0.85 + cl * 0.6 + rl) * level);
    let oR = lim((dryR + dr * 0.85 + cr * 0.6 + rr) * level);
    L[i] = oL; R[i] = oR;
    const a = oL < 0 ? -oL : oL;
    const b = oR < 0 ? -oR : oR;
    if (a > peak) peak = a;
    if (b > peak) peak = b;
  }
  eng.frame = end;
  eng.peak = peak;
  eng.meterN += n;
  if (eng.onMeter && eng.meterN > eng.sr * 0.05) {
    eng.meterN = 0;
    let voices = 0;
    for (let i = 0; i < VOICES; i++) if (eng.voices[i].on) voices++;
    eng.onMeter({ t: 'meter', voices, peak, pos: eng.pos, playing: eng.playing, cap: eng.cap });
  }
}

export function postHeptode(eng, msg) {
  if (!msg || !msg.t) return;
  if (msg.t === 'patch') {
    const live = eng.pos;
    eng.patch = normalizeHeptode(msg.p);
    refreshSolo(eng);
    applyCap(eng);
    if (msg.scale != null && isFinite(+msg.scale)) eng.tempoScale = +msg.scale;
    return live;
  }
  if (msg.t === 'score') {
    eng.score = msg.score;
    eng.pos = 0;
    eng.cursor = 0;
    eng.ccursor = 0;
    eng.cc = Array.from({ length: 16 }, blankCC);
    if (msg.bpm && eng.patch.tempo) eng.tempoScale = eng.patch.tempo / msg.bpm;
    return;
  }
  if (msg.t === 'active') {
    eng.active = !!msg.on;
    if (!msg.on) silence(eng);
    return;
  }
  if (msg.t === 'scale') { eng.tempoScale = msg.v > 0 ? msg.v : 1; return; }
  if (msg.at != null) {
    eng.queue.push(msg);
    eng.queueDirty = true;
    return;
  }
  dispatch(eng, msg, 0);
}

export { FAMILIES };
