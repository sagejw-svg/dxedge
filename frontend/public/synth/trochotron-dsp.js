// Trochotron voice. Original. A short additive tone, a one-pole lowpass, and
// an envelope. Pitch is the note the generator chose. The score plays inside
// the worklet so a take does not depend on a page timer.

import { normalizeTrochotron } from './trochotron.js';

export const VOICES = 16;

function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }

function voice() {
  return {
    on: false, score: false, stage: 'off', note: 60, vel: 0, layer: 'lead',
    phase: 0, env: 0, lp: 0, age: 0, pan: 0, fast: false,
  };
}

export function createTrochotronEngine(sr, patch) {
  return {
    sr: sr || 48000,
    patch: normalizeTrochotron(patch),
    voices: Array.from({ length: VOICES }, voice),
    active: true,
    playing: false,
    killed: false,
    notes: [],
    ons: [],
    offs: [],
    onI: 0,
    offI: 0,
    origin: 0,
    played: 0,
    timbre: 0.45,
    peak: 0,
    cpu: 0,
    beat: 0,
    edges: [],
    onMeter: null,
    meterN: 0,
  };
}

function midiHz(n) {
  return 440 * Math.pow(2, (n - 69) / 12);
}

function alloc(eng) {
  let free = -1;
  let oldest = 0;
  for (let i = 0; i < VOICES; i++) {
    const v = eng.voices[i];
    if (v.stage === 'off') { free = i; break; }
    if (eng.voices[i].age > eng.voices[oldest].age) oldest = i;
  }
  const v = eng.voices[free >= 0 ? free : oldest];
  if (v.stage !== 'off') eng.edges.push({ kind: 'off', n: v.note, v: 0, layer: v.layer });
  return v;
}

function trigger(eng, note, vel, layer, score) {
  const v = alloc(eng);
  v.on = true;
  v.score = !!score;
  v.stage = 'atk';
  v.note = note & 127;
  v.vel = clamp(+vel || 0.8, 0, 1);
  v.layer = layer || 'lead';
  v.env = 0;
  v.age = 0;
    v.pan = layer === 'bass' ? 0 : layer === 'mid' ? -0.32 : 0.32;
    v.fast = false;
  eng.edges.push({ kind: 'on', n: v.note, v: v.vel, layer: v.layer });
}

function releaseNote(eng, note, scoreOnly) {
  for (let i = 0; i < VOICES; i++) {
    const v = eng.voices[i];
    if (!v.on || v.note !== (note & 127)) continue;
    if (scoreOnly && !v.score) continue;
    if (v.stage === 'rel' || v.stage === 'off') continue;
    v.stage = 'rel';
    v.on = false;
    eng.edges.push({ kind: 'off', n: v.note, v: 0, layer: v.layer });
  }
}

function releaseAll(eng, scoreOnly, fast) {
  for (let i = 0; i < VOICES; i++) {
    const v = eng.voices[i];
    if (v.stage === 'off') continue;
    if (scoreOnly && !v.score) continue;
    if (v.stage !== 'rel') eng.edges.push({ kind: 'off', n: v.note, v: 0, layer: v.layer });
    v.stage = 'rel';
    v.on = false;
    if (fast) v.fast = true;
  }
}

export function armScore(eng, notes, restart) {
  const bpm = clamp(eng.patch.tempo, 40, 240);
  const spb = eng.sr * 60 / bpm;
  const ons = [];
  const offs = [];
  (notes || []).forEach(n => {
    const on = Math.max(0, Math.round(n.beat * spb));
    const off = on + Math.max(1, Math.round(n.dur * spb));
    ons.push({ at: on, n: n.n & 127, v: n.v, layer: n.layer });
    offs.push({ at: off, n: n.n & 127 });
  });
  ons.sort((a, b) => a.at - b.at || a.n - b.n);
  offs.sort((a, b) => a.at - b.at || a.n - b.n);
  eng.ons = ons;
  eng.offs = offs;
  eng.onI = 0;
  eng.offI = 0;
  if (restart) {
    releaseAll(eng, true);
    eng.origin = eng.played;
    eng.killed = false;
  }
}

function sounding(eng) {
  let n = 0;
  for (let i = 0; i < VOICES; i++) if (eng.voices[i].stage !== 'off') n++;
  return n;
}

export function renderTrochotron(eng, L, R) {
  const frames = L.length;
  const sr = eng.sr;
  const timbreTarget = clamp(eng.patch.timbre, 0, 1);
  const level = clamp(eng.patch.level, 0, 1);
  const t0 = eng.played - eng.origin;
  const t1 = t0 + frames;
  if (eng.playing && eng.active && !eng.killed) {
    while (eng.offI < eng.offs.length && eng.offs[eng.offI].at < t1) {
      const ev = eng.offs[eng.offI++];
      if (ev.at >= t0 - 1) releaseNote(eng, ev.n, true);
    }
    while (eng.onI < eng.ons.length && eng.ons[eng.onI].at < t1) {
      const ev = eng.ons[eng.onI++];
      if (ev.at >= t0 - 1) trigger(eng, ev.n, ev.v, ev.layer, true);
    }
    const spb = sr * 60 / clamp(eng.patch.tempo, 40, 240);
    eng.beat = t1 / spb;
  }
  let peak = 0;
  const atk = 1 - Math.exp(-1 / (0.01 * sr));
  const dec = 1 - Math.exp(-1 / (0.08 * sr));
  const rel = 1 - Math.exp(-1 / (0.055 * sr));
  const relFast = 1 - Math.exp(-1 / (0.012 * sr));
  for (let i = 0; i < frames; i++) {
    eng.timbre += (timbreTarget - eng.timbre) * 0.002;
    let l = 0, r = 0;
    const bright = eng.timbre;
    for (let v = 0; v < VOICES; v++) {
      const voice = eng.voices[v];
      if (voice.stage === 'off') continue;
      voice.age++;
      if (voice.stage === 'atk') {
        voice.env += (1 - voice.env) * atk;
        if (voice.env > 0.98) voice.stage = 'dec';
      } else if (voice.stage === 'dec') {
        voice.env += (0.62 - voice.env) * dec;
      } else if (voice.stage === 'rel') {
        voice.env += (0 - voice.env) * (voice.fast ? relFast : rel);
        if (voice.env < 1e-4) { voice.stage = 'off'; voice.env = 0; voice.lp = 0; voice.fast = false; continue; }
      }
      const hz = midiHz(voice.note);
      const harm = voice.layer === 'bass' ? bright * 0.35 : voice.layer === 'mid' ? bright * 0.7 : bright;
      voice.phase += 2 * Math.PI * hz / sr;
      if (voice.phase > 1e6) voice.phase -= 1e6;
      const p = voice.phase;
      let s = Math.sin(p) + harm * 0.42 * Math.sin(2 * p) + harm * harm * 0.16 * Math.sin(3 * p);
      const cut = voice.layer === 'bass' ? 0.08 + bright * 0.12 : voice.layer === 'mid' ? 0.12 + bright * 0.28 : 0.18 + bright * 0.45;
      voice.lp += (s - voice.lp) * cut;
      s = voice.lp;
      const g = voice.env * voice.vel * 0.22;
      const side = voice.pan;
      l += s * g * (1 - Math.max(0, side));
      r += s * g * (1 + Math.min(0, side));
    }
    l *= level;
    r *= level;
    const al = l < 0 ? -l : l;
    const ar = r < 0 ? -r : r;
    if (al > 0.9) l = l / (1 + (al - 0.9));
    if (ar > 0.9) r = r / (1 + (ar - 0.9));
    if (!isFinite(l)) l = 0;
    if (!isFinite(r)) r = 0;
    L[i] = l;
    R[i] = r;
    if (al > peak) peak = al;
    if (ar > peak) peak = ar;
  }
  eng.peak = peak;
  eng.played += frames;
  eng.meterN += frames;
  if (eng.meterN >= 2048 && eng.onMeter) {
    eng.meterN = 0;
    eng.onMeter({
      t: 'meter',
      voices: sounding(eng),
      cpu: eng.cpu,
      peak: eng.peak,
      beat: eng.beat,
      playing: !!eng.playing,
    });
  }
}

export function postTrochotron(eng, msg) {
  if (!msg || !msg.t) return;
  if (msg.t === 'patch') {
    eng.patch = normalizeTrochotron(msg.p);
    return;
  }
  if (msg.t === 'piece') {
    eng.notes = msg.notes || [];
    if (msg.bpm) eng.patch.tempo = msg.bpm;
    armScore(eng, eng.notes, !!eng.playing);
    return;
  }
  if (msg.t === 'play') {
    eng.playing = true;
    eng.killed = false;
    eng.active = true;
    armScore(eng, eng.notes, true);
    return;
  }
  if (msg.t === 'stop') {
    eng.playing = false;
    eng.beat = 0;
    releaseAll(eng, false, false);
    return;
  }
  if (msg.t === 'on') {
    trigger(eng, msg.n | 0, msg.v == null ? 0.8 : msg.v, 'lead', false);
    return;
  }
  if (msg.t === 'off') {
    releaseNote(eng, msg.n | 0, false);
    return;
  }
  if (msg.t === 'panic') {
    eng.playing = false;
    eng.killed = true;
    eng.beat = 0;
    releaseAll(eng, false, true);
    return;
  }
  if (msg.t === 'active') {
    eng.active = !!msg.on;
    if (!eng.active) {
      eng.playing = false;
      eng.beat = 0;
      releaseAll(eng, false, true);
    }
  }
}

export function takeEdges(eng) {
  if (!eng.edges.length) return null;
  const edges = eng.edges;
  eng.edges = [];
  return edges;
}
