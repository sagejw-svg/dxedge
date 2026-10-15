// Gyrotron voices. Original. A collision is a short folded strike, a crossing
// is a softer bell, and a key holds until it is released.
//
// Each voice is a detuned additive tone, a sine fold, and a one-pole lowpass.
// A short feedback delay sits on the mix (the space control). Pan follows
// where the body was. The pool is capped. Every routed note gets a note-off.
// No third-party synth code.

import {
  TICK, normalizeCore, createWorld, stepWorld, applyGesture, midiToHz,
} from './gyrotron-world.js';

const MAX_V = 16;

function blank() {
  return {
    on: false, held: false, release: false, kind: 'hit',
    ph: 0, ph2: 0, hz: 440, age: 0, relAge: 0, env: 0,
    gain: 0, bright: 0.6, l: 0.7071, r: 0.7071, lp: 0,
    midi: 60, route: 'self', open: false,
  };
}

export function createGyrotronEngine(sampleRate, patch) {
  const sr = sampleRate || 48000;
  const voices = new Array(MAX_V);
  for (let i = 0; i < MAX_V; i++) voices[i] = blank();
  const world = createWorld(patch || {});
  const delayN = Math.ceil(sr * 0.36);
  return {
    sr,
    samples: 0,
    tickAcc: 0,
    world,
    patch: world.patch,
    voices,
    queue: [],
    noteQ: [],
    noteI: 0,
    active: true,
    sounding: 0,
    maxVoices: 0,
    midi: [],
    midiOn: 0,
    midiOff: 0,
    bend: 0,
    level: 0,
    cpu: 0,
    view: null,
    sinceMeter: 0,
    meterEvery: Math.max(64, Math.round(sr / 20)),
    onMidi: null,
    onMeter: null,
    dL: new Float32Array(delayN),
    dR: new Float32Array(delayN),
    dI: 0,
    dN: delayN,
  };
}

function emit(eng, on, route, midi, gain) {
  if (!route || route === 'self') return;
  if (on) eng.midiOn += 1;
  else eng.midiOff += 1;
  const msg = { t: 'midi', on: !!on, dev: route, n: midi & 127, v: Math.max(0, Math.min(1, gain || 0)) };
  if (eng.midi.length < 500) eng.midi.push(msg);
  if (eng.onMidi) eng.onMidi(msg);
}

function endVoice(eng, v) {
  if (!v.on && !v.open) return;
  if (v.open) {
    emit(eng, false, v.route, v.midi, 0);
    v.open = false;
  }
  v.on = false;
  v.held = false;
  v.release = false;
  v.env = 0;
}

function clearDelay(eng) {
  eng.dL.fill(0);
  eng.dR.fill(0);
  eng.dI = 0;
}

function releaseAll(eng) {
  for (let i = 0; i < MAX_V; i++) endVoice(eng, eng.voices[i]);
  eng.noteQ.length = 0;
  eng.noteI = 0;
  eng.sounding = 0;
  clearDelay(eng);
  if (eng.queue.length) eng.queue = eng.queue.filter(m => m && m.t !== 'on' && m.t !== 'gesture');
}

function countOn(eng) {
  const cap = eng.patch.voices;
  let n = 0;
  for (let i = 0; i < cap; i++) if (eng.voices[i].on) n += 1;
  eng.sounding = n;
  if (n > eng.maxVoices) eng.maxVoices = n;
  return n;
}

function startVoice(eng, note) {
  const cap = eng.patch.voices;
  let slot = -1;
  const midi = Math.max(0, Math.min(127, Math.round(note.midi == null ? 60 : note.midi)));
  if (note.held) {
    for (let i = 0; i < cap; i++) {
      const v = eng.voices[i];
      if (v.on && v.held && v.midi === midi) { endVoice(eng, v); slot = i; break; }
    }
  }
  if (slot < 0) {
    for (let i = 0; i < cap; i++) if (!eng.voices[i].on) { slot = i; break; }
  }
  if (slot < 0) {
    let best = 0;
    let be = 1e9;
    for (let i = 0; i < cap; i++) {
      const e = eng.voices[i].held && !eng.voices[i].release ? 2 : eng.voices[i].env;
      if (e < be) { be = e; best = i; }
    }
    endVoice(eng, eng.voices[best]);
    slot = best;
  }
  const v = eng.voices[slot];
  const pan = Math.max(-1, Math.min(1, note.pan || 0));
  const ang = (pan + 1) * 0.25 * Math.PI;
  v.on = true;
  v.held = !!note.held;
  v.release = false;
  v.kind = note.kind || 'hit';
  v.ph = 0;
  v.ph2 = 0.4;
  v.hz = note.hz > 0 ? note.hz : midiToHz(midi);
  v.age = 0;
  v.relAge = 0;
  v.env = 0;
  v.gain = Math.max(0, Math.min(1, note.gain == null ? 0.7 : note.gain));
  v.bright = Math.max(0, Math.min(1, note.bright == null ? 0.6 : note.bright));
  v.l = Math.cos(ang);
  v.r = Math.sin(ang);
  v.lp = 0;
  v.midi = midi;
  v.route = note.route || eng.patch.route || 'self';
  v.open = false;
  if (v.route !== 'self' && note.emit !== false) {
    emit(eng, true, v.route, v.midi, v.gain);
    v.open = true;
  }
  countOn(eng);
}

function sampleVoice(eng, v) {
  const p = eng.patch;
  const dt = 1 / eng.sr;
  v.age += dt;
  const dec = 0.09 + (p.decay == null ? 0.42 : p.decay) * 1.15;
  const atk = v.kind === 'cross' ? 0.012 : 0.003;
  let env = 0;
  if (v.held && !v.release) {
    env = v.age < atk ? v.age / atk : 1;
  } else if (v.held && v.release) {
    v.relAge += dt;
    const rel = 0.045;
    env = Math.max(0, 1 - v.relAge / rel);
    if (env <= 0) { endVoice(eng, v); return 0; }
  } else {
    if (v.age < atk) env = v.age / atk;
    else env = Math.exp(-(v.age - atk) / (v.kind === 'cross' ? dec * 1.35 : dec));
    if (v.age > atk + dec * 4.2 || env < 1e-4) { endVoice(eng, v); return 0; }
  }
  v.env = env;
  const glide = v.kind === 'hit' ? Math.exp(-v.age * 7) * 0.035 : v.kind === 'cross' ? Math.exp(-v.age * 2.2) * 0.012 : 0;
  const bend = eng.bend || 0;
  const freq = v.hz * Math.pow(2, (bend * 2) / 12) * (1 + glide);
  const drift = (p.drift || 0) * 0.015;
  const w = 2 * Math.PI * freq * dt;
  v.ph += w;
  v.ph2 += w * (1 + drift);
  if (v.ph > 12.566370614359172) v.ph -= 12.566370614359172;
  if (v.ph2 > 12.566370614359172) v.ph2 -= 12.566370614359172;
  const tim = p.timbre == null ? 0.55 : p.timbre;
  const s1 = Math.sin(v.ph);
  const s1b = Math.sin(v.ph2);
  let x = s1 * (0.7 - tim * 0.25)
    + s1b * 0.16
    + Math.sin(v.ph * 2) * tim * 0.36
    + Math.sin(v.ph * 3) * tim * tim * 0.2
    + Math.sin(v.ph * 5.01) * tim * tim * 0.08
    + Math.sin(v.ph * 0.5) * (1 - tim) * 0.26;
  const fold = p.fold == null ? 0.28 : p.fold;
  const drive = 1 + fold * 5.2;
  const folded = Math.sin(x * drive);
  x = x * (1 - fold) + folded * fold;
  const tone = p.tone == null ? 0.64 : p.tone;
  const fc = 140 * Math.pow(70, tone * 0.7 + v.bright * 0.3);
  const g = 1 - Math.exp(-2 * Math.PI * Math.min(fc, eng.sr * 0.45) * dt);
  v.lp += (x - v.lp) * g;
  const level = p.level == null ? 0.84 : p.level;
  return v.lp * env * v.gain * level * 0.38;
}

function fillView(eng) {
  const w = eng.world;
  const bodies = [];
  for (let i = 0; i < w.bodies.length && i < MAX_V; i++) {
    const b = w.bodies[i];
    bodies.push([
      b.id,
      Math.round(b.x * 10000) / 10000,
      Math.round(b.y * 10000) / 10000,
      Math.round(b.vx * 1000) / 1000,
      Math.round(b.vy * 1000) / 1000,
      Math.round(b.r * 1000) / 1000,
    ]);
  }
  const wells = [];
  for (let i = 0; i < w.wells.length; i++) {
    const well = w.wells[i];
    wells.push([
      well.id,
      Math.round(well.x * 1000) / 1000,
      Math.round(well.y * 1000) / 1000,
      Math.round(well.reach * 1000) / 1000,
    ]);
  }
  eng.view = {
    t: 'meter',
    voices: eng.sounding,
    cpu: eng.cpu,
    level: eng.level,
    bodies,
    bodyN: w.bodies.length,
    wells: w.wells.length,
    wellList: wells,
    hits: w.stats.hit,
    crosses: w.stats.cross,
    running: !!w.patch.running,
  };
}

function publish(eng) {
  fillView(eng);
  if (eng.onMeter && eng.view) eng.onMeter(eng.view);
}

function applyNow(eng, m) {
  if (!m || !m.t) return;
  if (m.t === 'patch' && m.p) {
    const next = normalizeCore(m.p);
    const cur = eng.world.patch;
    if (m.reseed || next.seed !== cur.seed || next.bodyCount !== cur.bodyCount || next.wellCount !== cur.wellCount) {
      releaseAll(eng);
      eng.world = createWorld(next);
    } else {
      eng.world.patch = next;
    }
    eng.patch = eng.world.patch;
    publish(eng);
    return;
  }
  if (m.t === 'reseed') {
    releaseAll(eng);
    const p = Object.assign({}, eng.patch, { seed: m.seed != null ? m.seed : eng.patch.seed });
    eng.world = createWorld(p);
    eng.patch = eng.world.patch;
    publish(eng);
    return;
  }
  if (m.t === 'active') {
    eng.active = !!m.on;
    if (!eng.active) releaseAll(eng);
    publish(eng);
    return;
  }
  if (m.t === 'panic') {
    releaseAll(eng);
    publish(eng);
    return;
  }
  if (m.t === 'bend') { eng.bend = Math.max(-1, Math.min(1, +m.v || 0)); return; }
  if (m.t === 'mw') {
    const v = Math.max(0, Math.min(1, +m.v || 0));
    eng.world.gravMul = 0.35 + v * 1.4;
    return;
  }
  if (m.t === 'gesture') {
    applyGesture(eng.world, m.g || m);
    publish(eng);
    return;
  }
  if (m.t === 'on') {
    if (!eng.active) return;
    const midi = Math.max(0, Math.min(127, m.n | 0));
    startVoice(eng, {
      kind: 'key', held: true, midi, hz: midiToHz(midi),
      gain: m.v == null ? 0.8 : +m.v,
      pan: Math.max(-1, Math.min(1, (midi - 60) / 36)),
      bright: 0.72,
      route: eng.patch.route,
      emit: m.local ? true : false,
    });
    if (eng.patch.running && m.local) {
      applyGesture(eng.world, {
        t: 'body',
        x: 0.12 + ((midi % 12) / 11) * 0.76,
        y: 0.28 + Math.max(0, Math.min(1, m.v == null ? 0.7 : +m.v)) * 0.5,
        vx: ((midi % 5) - 2) * 0.08,
        vy: 0.12,
      });
    }
    return;
  }
  if (m.t === 'off') {
    const midi = m.n & 127;
    for (let i = 0; i < eng.patch.voices; i++) {
      const v = eng.voices[i];
      if (v.on && v.held && v.midi === midi) v.release = true;
    }
  }
}

export function postGyrotron(eng, m) {
  if (!m) return;
  if (m.at != null) {
    eng.queue.push(m);
    eng.queue.sort((a, b) => a.at - b.at);
    return;
  }
  applyNow(eng, m);
}

function soft(x) {
  const a = x < 0 ? -x : x;
  if (a <= 0.9) return x;
  const s = x < 0 ? -1 : 1;
  return s * (0.9 + 0.08 * (1 - Math.exp(-(a - 0.9) * 2.6)));
}

function spaceOf(eng, l, r) {
  const p = eng.patch;
  const space = p.space == null ? 0.2 : Math.max(0, Math.min(1, p.space));
  const delay = Math.max(1, Math.min(eng.dN - 1, Math.round(eng.sr * (0.07 + space * 0.16))));
  const fb = space * 0.4;
  const mix = space * 0.58;
  const read = (eng.dI - delay + eng.dN * 4) % eng.dN;
  const wl = l + eng.dL[read] * fb;
  const wr = r + eng.dR[read] * fb;
  eng.dL[eng.dI] = wl;
  eng.dR[eng.dI] = wr;
  eng.dI += 1;
  if (eng.dI >= eng.dN) eng.dI = 0;
  return [l * (1 - mix) + eng.dL[read] * mix, r * (1 - mix) + eng.dR[read] * mix];
}

export function renderGyrotron(eng, L, R) {
  const n = L.length;
  const sr = eng.sr;
  const tickSamples = sr * TICK;
  const t0 = globalThis.performance ? performance.now() : 0;
  let peak = 0;
  const cap = eng.patch.voices;
  for (let i = cap; i < MAX_V; i++) if (eng.voices[i].on) endVoice(eng, eng.voices[i]);

  for (let i = 0; i < n; i++) {
    const sample = eng.samples + i;
    const now = sample / sr;
    while (eng.queue.length && eng.queue[0].at <= sample) applyNow(eng, eng.queue.shift());
    if (eng.active && eng.patch.running) {
      eng.tickAcc += 1;
      if (eng.tickAcc + 1e-6 >= tickSamples) {
        eng.tickAcc -= tickSamples;
        const batch = stepWorld(eng.world);
        for (let k = 0; k < batch.length; k++) eng.noteQ.push(batch[k]);
      }
    }
    while (eng.noteI < eng.noteQ.length && eng.noteQ[eng.noteI].at <= now + 1e-4) {
      const note = eng.noteQ[eng.noteI];
      note.route = eng.patch.route;
      startVoice(eng, note);
      eng.noteI += 1;
    }
    if (eng.noteI > 64 && eng.noteI === eng.noteQ.length) {
      eng.noteQ.length = 0;
      eng.noteI = 0;
    }
    let l = 0;
    let r = 0;
    if (eng.active) {
      for (let v = 0; v < cap; v++) {
        const voice = eng.voices[v];
        if (!voice.on) continue;
        const y = sampleVoice(eng, voice);
        if (y) { l += y * voice.l; r += y * voice.r; }
      }
      const wet = spaceOf(eng, l, r);
      l = wet[0];
      r = wet[1];
    }
    l = soft(l);
    r = soft(r);
    L[i] = l;
    R[i] = r;
    const a = l < 0 ? -l : l;
    const b = r < 0 ? -r : r;
    if (a > peak) peak = a;
    if (b > peak) peak = b;
  }
  eng.samples += n;
  eng.level = peak;
  countOn(eng);
  if (eng.sounding === 0 && eng.view && eng.view.voices) publish(eng);
  if (t0) {
    const took = performance.now() - t0;
    const budget = n / sr * 1000;
    eng.cpu = eng.cpu * 0.8 + (budget > 0 ? took / budget : 0) * 0.2;
  }
  eng.sinceMeter += n;
  if (eng.sinceMeter >= eng.meterEvery) {
    eng.sinceMeter = 0;
    publish(eng);
  }
}

export function probeGyrotron(patch, events, seconds) {
  const sr = 48000;
  const eng = createGyrotronEngine(sr, patch);
  (events || []).forEach(e => {
    const msg = Object.assign({}, e);
    if (msg.at != null) msg.at = Math.round(msg.at * sr);
    postGyrotron(eng, msg);
  });
  const total = Math.max(1, Math.round((seconds || 1) * sr));
  const L = new Float32Array(total);
  const R = new Float32Array(total);
  const block = 128;
  for (let i = 0; i < total; i += block) {
    const len = Math.min(block, total - i);
    renderGyrotron(eng, L.subarray(i, i + len), R.subarray(i, i + len));
  }
  let sum = 0;
  const tailFrom = Math.max(0, total - Math.round(0.15 * sr));
  let tail = 0;
  let tailN = 0;
  for (let i = 0; i < total; i++) {
    sum += L[i] * L[i] + R[i] * R[i];
    if (i >= tailFrom) { tail += L[i] * L[i] + R[i] * R[i]; tailN += 1; }
  }
  return {
    rms: Math.sqrt(sum / (total * 2)),
    tail: Math.sqrt(tail / Math.max(1, tailN * 2)),
    maxVoices: eng.maxVoices,
    sounding: eng.sounding,
    midiOn: eng.midiOn,
    midiOff: eng.midiOff,
    midi: eng.midi.slice(),
    peak: eng.level,
    hits: eng.world.stats.hit,
    crosses: eng.world.stats.cross,
  };
}
