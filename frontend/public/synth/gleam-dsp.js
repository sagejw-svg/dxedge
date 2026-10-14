// Gleam voice engine. One band-limited oscillator and a one-pole lowpass per
// finger. The polyBLEP residual is the published polynomial step correction
// (the saw's jump at the wrap), written here from that formula. The lowpass is
// the ordinary one-pole exponential smoother. No sample library and no copied
// oscillator.

import { VOICE_COUNT, midiHz, timbreOf } from './gleam.js';

export { VOICE_COUNT };

function voice() {
  return {
    id: null,
    lock: false,
    on: false,
    alive: false,
    born: 0,
    hz: 440,
    hzT: 440,
    y: 0.4,
    levelT: 0,
    env: 0,
    phase: 0,
    low: 0,
    pan: 0,
    send: 0,
    dry: 1,
  };
}

export function createGleamEngine(sampleRate, patch) {
  const voices = [];
  for (let i = 0; i < VOICE_COUNT; i++) voices.push(voice());
  return {
    sr: sampleRate || 48000,
    voices,
    byId: new Map(),
    glide: patch && Number.isFinite(+patch.glide) ? +patch.glide : 0.035,
    color: patch && Number.isFinite(+patch.color) ? +patch.color : 0.35,
    active: true,
    hrtf: !!(patch && patch.hrtf),
    queue: [],
    soon: [],
    meterN: 0,
    peak: 0,
    seq: 0,
    delayL: new Float32Array(Math.floor((sampleRate || 48000) * 0.19)),
    delayR: new Float32Array(Math.floor((sampleRate || 48000) * 0.23)),
    dIdxL: 0,
    dIdxR: 0,
    dampL: 0,
    dampR: 0,
  };
}

// Published polyBLEP residual for a transition at phase 0. dt is the phase
// step of one sample. Returns 0 away from the wrap.
function stepResidual(phase, dt) {
  if (!(dt > 0) || dt >= 0.45) return 0;
  if (phase < dt) {
    const u = phase / dt;
    return u + u - u * u - 1;
  }
  if (phase > 1 - dt) {
    const u = (phase - 1) / dt;
    return u * u + u + u + 1;
  }
  return 0;
}

function softTop(x) {
  const a = 0.9;
  if (x > a) return a + (1 - a) * Math.tanh((x - a) / (1 - a));
  if (x < -a) return -a - (1 - a) * Math.tanh((-x - a) / (1 - a));
  return x;
}

function dropId(eng, id) {
  if (id == null) return;
  const slot = eng.byId.get(id);
  if (slot == null) return;
  eng.byId.delete(id);
  const v = eng.voices[slot];
  if (v && v.id === id) v.id = null;
}

function takeSlot(eng, slot, id, lock) {
  const v = eng.voices[slot];
  if (!v) return null;
  if (v.id != null && v.id !== id) eng.byId.delete(v.id);
  v.id = id;
  v.lock = !!lock;
  eng.byId.set(id, slot);
  return v;
}

// Host pointers claim the low slots. Notes that arrive without a slot (a MIDI
// file routed here) claim the high slots, so the two allocators meet only when
// every voice is already busy.
function claim(eng, id, slot, lock) {
  if (id == null) return null;
  const have = eng.byId.get(id);
  if (have != null && (slot == null || have === slot)) {
    const v = eng.voices[have];
    if (lock) v.lock = true;
    return v;
  }
  if (slot != null && slot >= 0 && slot < VOICE_COUNT) return takeSlot(eng, slot, id, lock !== false);
  if (have != null) dropId(eng, id);
  for (let i = VOICE_COUNT - 1; i >= 0; i--) {
    const v = eng.voices[i];
    if (!v.id && !v.alive) return takeSlot(eng, i, id, false);
  }
  let oldest = -1;
  let age = Infinity;
  for (let i = VOICE_COUNT - 1; i >= 0; i--) {
    const v = eng.voices[i];
    if (v.lock) continue;
    if (v.born < age) { age = v.born; oldest = i; }
  }
  if (oldest < 0) return null;
  return takeSlot(eng, oldest, id, false);
}

function releaseId(eng, id) {
  const slot = eng.byId.get(id);
  if (slot == null) return;
  const v = eng.voices[slot];
  v.on = false;
  v.levelT = 0;
  v.lock = false;
}

function handle(eng, m) {
  if (!m || !m.t) return;
  if (m.t === 'patch') {
    if (Number.isFinite(+m.glide)) eng.glide = Math.max(0, Math.min(0.4, +m.glide));
    if (Number.isFinite(+m.color)) eng.color = Math.max(0, Math.min(1, +m.color));
    if (m.hrtf != null) eng.hrtf = !!m.hrtf;
    return;
  }
  if (m.t === 'panic') {
    eng.byId.clear();
    eng.voices.forEach(v => {
      v.id = null; v.lock = false; v.on = false; v.alive = false;
      v.levelT = 0; v.env = 0; v.low = 0;
    });
    eng.delayL.fill(0);
    eng.delayR.fill(0);
    eng.dampL = 0;
    eng.dampR = 0;
    return;
  }
  if (m.t === 'active') {
    eng.active = !!m.on;
    if (!eng.active) handle(eng, { t: 'panic' });
    return;
  }
  if (m.t === 'on' || (m.t === 'voice' && m.on)) {
    const id = m.id != null ? m.id : (m.n != null ? 'm' + m.n : null);
    if (id == null) return;
    const v = claim(eng, id, m.slot, m.slot != null);
    if (!v) return;
    const hz = Number.isFinite(+m.hz) ? +m.hz : (m.n != null ? midiHz(m.n) : v.hzT);
    const fresh = !(v.env > 0.002);
    v.on = true;
    v.alive = true;
    v.born = ++eng.seq;
    v.hzT = Math.max(20, Math.min(8000, hz));
    if (fresh) { v.hz = v.hzT; v.phase = 0; v.low = 0; v.env = 0; }
    const y = Number.isFinite(+m.y) ? +m.y : eng.color;
    v.y = Math.max(0, Math.min(1, y));
    const level = Number.isFinite(+m.level) ? +m.level : (m.v != null ? +m.v : 0.75);
    v.levelT = Math.max(0, Math.min(1, level));
    if (Number.isFinite(+m.pan)) v.pan = Math.max(-1, Math.min(1, +m.pan));
    if (Number.isFinite(+m.send)) v.send = Math.max(0, Math.min(1, +m.send));
    if (Number.isFinite(+m.gain)) v.dry = Math.max(0, Math.min(1.2, +m.gain));
    return;
  }
  if (m.t === 'off' || (m.t === 'voice' && m.on === false)) {
    const id = m.id != null ? m.id : (m.n != null ? 'm' + m.n : null);
    if (id == null) return;
    releaseId(eng, id);
  }
}

export function postGleam(eng, m) {
  if (!m) return;
  if (m.at == null) eng.soon.push(m);
  else eng.queue.push(m);
}

// Render `n` frames. L/R are the dry stereo mix (pan and distance). `wetL` and
// `wetR`, when present, receive the room delay only. `slots[i]` is one dry
// voice, written when HRTF panners are in use. `start` is the absolute frame.
export function renderGleam(eng, L, R, slots, start, wetL, wetR) {
  const n = L.length;
  const sr = eng.sr;
  if (eng.soon.length) {
    const soon = eng.soon;
    eng.soon = [];
    for (let i = 0; i < soon.length; i++) handle(eng, soon[i]);
  }
  const q = eng.queue;
  if (q.length > 1) q.sort((a, b) => (a.at || 0) - (b.at || 0));
  let qi = 0;
  const glideK = eng.glide <= 0.0005 ? 1 : 1 - Math.exp(-1 / (sr * eng.glide));
  const att = 1 - Math.exp(-1 / (sr * 0.01));
  const rel = 1 - Math.exp(-1 / (sr * 0.04));
  let peak = 0;
  const hrtf = !!eng.hrtf && slots;
  for (let i = 0; i < n; i++) {
    const frame = start + i;
    while (qi < q.length && (q[qi].at || 0) <= frame) handle(eng, q[qi++]);
    let l = 0;
    let r = 0;
    let sendL = 0;
    let sendR = 0;
    const voices = eng.voices;
    for (let s = 0; s < voices.length; s++) {
      const v = voices[s];
      if (!v.alive) {
        if (hrtf && slots[s]) slots[s][i] = 0;
        continue;
      }
      v.hz += (v.hzT - v.hz) * glideK;
      const k = v.levelT > v.env ? att : rel;
      v.env += (v.levelT - v.env) * k;
      if (!v.on && v.env < 1e-4) {
        v.alive = false;
        v.env = 0;
        v.low = 0;
        if (v.id != null && !v.on) {
          eng.byId.delete(v.id);
          v.id = null;
          v.lock = false;
        }
        if (hrtf && slots[s]) slots[s][i] = 0;
        continue;
      }
      const dt = v.hz / sr;
      v.phase += dt;
      if (v.phase >= 1) v.phase -= 1;
      const sine = Math.sin(v.phase * Math.PI * 2);
      let saw = v.phase * 2 - 1;
      saw -= stepResidual(v.phase, dt);
      const tone = timbreOf(v.y, v.hz);
      const mixed = sine + (saw - sine) * tone.morph;
      const coef = 1 - Math.exp(-2 * Math.PI * Math.min(tone.cutoff, sr * 0.45) / sr);
      v.low += (mixed - v.low) * coef;
      const body = v.low * v.env;
      let y = body * v.dry;
      if (y > 1 || y < -1) y = softTop(y);
      const pan = v.pan;
      const ang = (pan + 1) * 0.7853981633974483;
      const gL = Math.cos(ang);
      const gR = Math.sin(ang);
      l += y * gL;
      r += y * gR;
      sendL += body * v.send * gL;
      sendR += body * v.send * gR;
      if (hrtf && slots[s]) slots[s][i] = y;
    }
    const lenL = eng.delayL.length;
    const lenR = eng.delayR.length;
    const dL = eng.delayL[eng.dIdxL];
    const dR = eng.delayR[eng.dIdxR];
    const fL = eng.dampL = eng.dampL * 0.45 + dL * 0.55;
    const fR = eng.dampR = eng.dampR * 0.45 + dR * 0.55;
    eng.delayL[eng.dIdxL] = sendL + fL * 0.52;
    eng.delayR[eng.dIdxR] = sendR + fR * 0.52;
    eng.dIdxL = eng.dIdxL + 1 === lenL ? 0 : eng.dIdxL + 1;
    eng.dIdxR = eng.dIdxR + 1 === lenR ? 0 : eng.dIdxR + 1;
    l = softTop(l);
    r = softTop(r);
    L[i] = l;
    R[i] = r;
    if (wetL) {
      wetL[i] = fL * 0.55;
      wetR[i] = fR * 0.55;
    }
    const a = Math.abs(l) > Math.abs(r) ? Math.abs(l) : Math.abs(r);
    if (a > peak) peak = a;
  }
  if (qi < q.length) eng.queue = q.slice(qi);
  else eng.queue = [];
  eng.peak = eng.peak * 0.6 + peak * 0.4;
  eng.meterN += n;
  if (eng.meterN >= sr * 0.04) {
    eng.meterN = 0;
    const info = [];
    let sounding = 0;
    for (let s = 0; s < eng.voices.length; s++) {
      const v = eng.voices[s];
      if (!v.alive) continue;
      sounding++;
      info.push({ slot: s, id: v.id, env: v.env, pan: v.pan, y: v.y, on: v.on });
    }
    if (eng.onMeter) eng.onMeter({ t: 'meter', peak: eng.peak, voices: sounding, slots: info });
  }
}
