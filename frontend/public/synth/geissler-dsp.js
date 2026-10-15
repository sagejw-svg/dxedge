// Geissler voices. Original oscillators for four creature calls.
//
// Reed is a slow two-partial drone. Graze is a plucked pair of decaying sines.
// Stalk is a falling low sine plus a short noise burst. Flicker is a run of
// bright blips. A death is the same creature with the pitch falling away.
// A one-pole lowpass follows energy (brightness). Pan follows position.
// The voice pool is capped. Every note ends, and a routed note always gets
// a matching note-off. No third-party synth code.

import {
  TICK, SPECIES, createWorld, setWorldPatch, applyGesture, stepWorld, seasonOf, scaleNow, midiOf, midiToHz,
} from './geissler-world.js';

const MAX_V = 16;
const NAME_TO_I = { reed: 0, graze: 1, stalk: 2, flicker: 3 };

function blank() {
  return {
    on: false, sp: 0, die: false, ph: 0, freq: 440, fBase: 440,
    age: 0, dur: 0.2, rel: 0.1, env: 0, gain: 0, bright: 0.5,
    l: 0.7071, r: 0.7071, lp: 0, noise: 1,
    steps: 0, step: 0, stepDur: 0.07, f0: 0, f1: 0, f2: 0, f3: 0,
    midi: 60, route: 'self', open: false,
  };
}

export function createGeisslerEngine(sampleRate, patch) {
  const voices = new Array(MAX_V);
  for (let i = 0; i < MAX_V; i++) voices[i] = blank();
  const world = createWorld(patch || {});
  return {
    sr: sampleRate || 48000,
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
    level: 0,
    cpu: 0,
    view: null,
    sinceMeter: 0,
    meterEvery: Math.max(64, Math.round((sampleRate || 48000) / 20)),
    onMidi: null,
    onMeter: null,
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
  v.env = 0;
}

function releaseAll(eng) {
  for (let i = 0; i < MAX_V; i++) endVoice(eng, eng.voices[i]);
  eng.noteQ.length = 0;
  eng.noteI = 0;
  eng.sounding = 0;
  if (eng.queue.length) eng.queue = eng.queue.filter(m => m && m.t !== 'tap' && m.t !== 'note');
}

function countOn(eng) {
  const cap = eng.patch.voices;
  let n = 0;
  for (let i = 0; i < cap; i++) if (eng.voices[i].on) n++;
  eng.sounding = n;
  if (n > eng.maxVoices) eng.maxVoices = n;
  return n;
}

function startVoice(eng, note) {
  const cap = eng.patch.voices;
  let slot = -1;
  for (let i = 0; i < cap; i++) if (!eng.voices[i].on) { slot = i; break; }
  if (slot < 0) {
    let best = 0;
    let be = 1e9;
    for (let i = 0; i < cap; i++) {
      const e = eng.voices[i].env;
      if (e < be) { be = e; best = i; }
    }
    // Steal the quietest voice and close its routed note first.
    endVoice(eng, eng.voices[best]);
    slot = best;
  }
  const v = eng.voices[slot];
  const sp = NAME_TO_I[note.species] != null ? NAME_TO_I[note.species] : 0;
  v.on = true;
  v.sp = sp;
  v.die = note.kind === 'die';
  v.ph = 0;
  v.fBase = note.hz > 0 ? note.hz : 440;
  v.freq = v.fBase;
  v.age = 0;
  v.env = 1;
  v.dur = Math.max(0.05, note.dur || 0.3);
  v.rel = v.die ? 0.15 : sp === 0 ? 0.32 : sp === 1 ? 0.06 : sp === 2 ? 0.08 : 0.05;
  v.gain = Math.max(0, Math.min(1, note.gain == null ? 0.6 : note.gain)) * (eng.patch.level == null ? 0.8 : eng.patch.level);
  v.bright = Math.max(0, Math.min(1, note.bright == null ? 0.6 : note.bright));
  const pan = Math.max(-1, Math.min(1, note.pan || 0));
  const ang = (pan + 1) * 0.25 * Math.PI;
  v.l = Math.cos(ang);
  v.r = Math.sin(ang);
  v.lp = 0;
  v.noise = (note.seq || 1) | 1;
  v.midi = note.midi | 0;
  v.route = note.route || 'self';
  v.open = false;
  const motif = note.motif || [];
  v.steps = motif.length;
  v.step = 0;
  v.stepDur = v.steps ? Math.max(0.045, v.dur / v.steps) : 0.08;
  v.f0 = motif[0] ? motif[0].hz : v.fBase;
  v.f1 = motif[1] ? motif[1].hz : v.f0;
  v.f2 = motif[2] ? motif[2].hz : v.f1;
  v.f3 = motif[3] ? motif[3].hz : v.f2;
  if (v.sp === 3 && v.steps) v.freq = v.f0;
  if (v.route !== 'self') {
    emit(eng, true, v.route, v.midi, v.gain);
    v.open = true;
  }
  countOn(eng);
}

function noise(v) {
  let x = v.noise | 0;
  x ^= x << 13; x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5; x >>>= 0;
  v.noise = x || 1;
  return (x / 4294967296) * 2 - 1;
}

function stepFreq(v) {
  const i = v.step;
  if (i <= 0) return v.f0;
  if (i === 1) return v.f1;
  if (i === 2) return v.f2;
  return v.f3;
}

function sampleVoice(eng, v) {
  const sr = eng.sr;
  const dt = 1 / sr;
  v.age += dt;
  let env = 0;
  let x = 0;
  if (v.die) {
    v.freq = v.fBase * Math.exp(-v.age * 1.35);
    env = Math.exp(-v.age * 2.5);
    const p = v.ph + 2 * Math.PI * v.freq * dt;
    v.ph = p - Math.floor(p / (2 * Math.PI)) * 2 * Math.PI;
    x = Math.sin(v.ph) * 0.85 + noise(v) * Math.exp(-v.age * 18) * 0.15;
    if (v.age > v.dur + v.rel) env = 0;
  } else if (v.sp === 0) {
    const atk = 0.09;
    if (v.age < atk) env = v.age / atk;
    else if (v.age < v.dur) env = 1;
    else env = Math.max(0, 1 - (v.age - v.dur) / v.rel);
    v.ph += 2 * Math.PI * v.fBase * dt;
    if (v.ph > 6.283185307179586) v.ph -= 6.283185307179586;
    x = Math.sin(v.ph) + 0.16 * Math.sin(v.ph * 2.003) + 0.05 * Math.sin(v.ph * 3.01);
  } else if (v.sp === 1) {
    env = Math.exp(-v.age * 7.5);
    if (v.age > v.dur + v.rel) env = 0;
    v.ph += 2 * Math.PI * v.fBase * dt;
    if (v.ph > 6.283185307179586) v.ph -= 6.283185307179586;
    x = Math.sin(v.ph) + Math.sin(v.ph * 2.51) * Math.exp(-v.age * 36) * 0.55;
  } else if (v.sp === 2) {
    env = Math.exp(-v.age * 6.2);
    if (v.age > v.dur + v.rel) env = 0;
    v.freq = v.fBase * (1 + 1.7 * Math.exp(-v.age * 28));
    v.ph += 2 * Math.PI * v.freq * dt;
    if (v.ph > 6.283185307179586) v.ph -= 6.283185307179586;
    const burst = v.age < 0.028 ? (1 - v.age / 0.028) : 0;
    x = Math.sin(v.ph) * 0.9 + noise(v) * burst * 0.55;
  } else {
    if (v.steps && v.age > (v.step + 1) * v.stepDur && v.step < v.steps - 1) {
      v.step += 1;
      v.freq = stepFreq(v);
      v.ph = 0;
    } else if (!v.steps) v.freq = v.fBase;
    const local = v.steps ? (v.age - v.step * v.stepDur) / v.stepDur : v.age / Math.max(0.05, v.dur);
    const window = local >= 0 && local < 1 ? Math.sin(local * Math.PI) : 0;
    env = v.age > v.dur + v.rel ? 0 : window;
    v.ph += 2 * Math.PI * (v.freq || v.fBase) * dt;
    if (v.ph > 6.283185307179586) v.ph -= 6.283185307179586;
    x = Math.sin(v.ph);
  }
  v.env = env;
  if (v.age > v.dur + v.rel + 0.01) {
    endVoice(eng, v);
    return;
  }
  const sp = v.sp;
  const hi = sp === 2 ? 700 : sp === 0 ? 2400 : sp === 1 ? 5200 : 6800;
  const lo = sp === 2 ? 90 : sp === 0 ? 280 : 220;
  const cut = lo + v.bright * v.bright * hi;
  const g = 1 - Math.exp(-2 * Math.PI * cut * dt);
  v.lp += (x - v.lp) * g;
  if (v.lp > -1e-12 && v.lp < 1e-12) v.lp = 0;
  const y = v.lp * env * v.gain * 0.34;
  return y;
}

function tapNote(eng, m) {
  const patch = eng.patch;
  const species = SPECIES.includes(m.species) ? m.species : patch.spawn;
  const season = seasonOf(eng.world.time, patch.season);
  const scale = scaleNow(patch, season.mood);
  const gene = m.gene != null ? m.gene : 0.45;
  const q = midiOf(gene, species, patch.root, scale, season.keyShift);
  let midi = q.midi;
  let hz = q.hz;
  if (m.n != null && isFinite(+m.n)) {
    if (scale === 'free') {
      midi = Math.max(0, Math.min(127, Math.round(+m.n)));
      hz = midiToHz(+m.n);
    } else {
      const snapped = midiOf((+m.n - (patch.root + season.keyShift + (species === 'stalk' ? -24 : species === 'reed' ? -12 : species === 'flicker' ? 12 : 0))) / 14, species, patch.root, scale, season.keyShift);
      midi = m.snap === false ? Math.round(+m.n) : snapped.midi;
      hz = midiToHz(m.snap === false ? +m.n : snapped.midi);
    }
  }
  const pan = m.pan != null ? +m.pan : (m.x != null ? (+m.x - 0.5) * 2 : 0);
  return {
    t: 'note', seq: eng.world.seq++, kind: m.kind || 'meet', species,
    at: eng.samples / eng.sr, midi, hz, pan,
    gain: m.v != null ? +m.v : 0.8,
    bright: m.bright != null ? +m.bright : 0.75,
    dur: m.dur || (species === 'reed' ? 0.7 : species === 'flicker' ? 0.42 : 0.28),
    route: m.route || (species === 'reed' ? patch.routeReed : species === 'graze' ? patch.routeGraze : species === 'stalk' ? patch.routeStalk : patch.routeFlicker),
    motif: species === 'flicker' ? [
      { hz },
      { hz: hz * (scale === 'free' ? 1.06 : Math.pow(2, 2 / 12)) },
      { hz: hz * (scale === 'free' ? 1.12 : Math.pow(2, 4 / 12)) },
    ] : [],
  };
}

function applyNow(eng, m) {
  if (!m || !m.t) return;
  if (m.t === 'patch' && m.p) {
    const next = m.p;
    const seed = Math.round(+next.seed || eng.patch.seed);
    if (seed !== eng.world.patch.seed || m.reseed) {
      releaseAll(eng);
      eng.world = createWorld(next);
      eng.patch = eng.world.patch;
    } else {
      setWorldPatch(eng.world, next, eng.world.tempo);
      eng.patch = eng.world.patch;
    }
    return;
  }
  if (m.t === 'reseed') {
    releaseAll(eng);
    const p = Object.assign({}, eng.patch, { seed: m.seed != null ? m.seed : eng.patch.seed });
    eng.world = createWorld(p);
    eng.patch = eng.world.patch;
    return;
  }
  if (m.t === 'active') {
    eng.active = !!m.on;
    if (!eng.active) releaseAll(eng);
    fillView(eng);
    if (eng.onMeter && eng.view) eng.onMeter(eng.view);
    return;
  }
  if (m.t === 'panic') {
    releaseAll(eng);
    fillView(eng);
    if (eng.onMeter && eng.view) eng.onMeter(eng.view);
    return;
  }
  if (m.t === 'tempo') {
    eng.world.tempo = Math.max(40, Math.min(240, Math.round(+m.bpm || eng.world.tempo)));
    return;
  }
  if (m.t === 'food' || m.t === 'spawn' || m.t === 'herd') {
    applyGesture(eng.world, m);
    return;
  }
  if (m.t === 'tap') {
    if (!eng.active) return;
    startVoice(eng, tapNote(eng, m));
    return;
  }
  if (m.t === 'note') {
    if (!eng.active) return;
    startVoice(eng, m);
  }
}

function fillView(eng) {
  const w = eng.world;
  const season = seasonOf(w.time, w.patch.season);
  const creatures = [];
  for (let i = 0; i < w.creatures.length && i < 40; i++) {
    const c = w.creatures[i];
    creatures.push([c.id, c.species, Math.round(c.x * 10000) / 10000, Math.round(c.y * 10000) / 10000, Math.round(c.size * 1000) / 1000, Math.round(c.energy * 1000) / 1000]);
  }
  const foods = [];
  for (let i = 0; i < w.food.length && i < 24; i++) {
    foods.push([Math.round(w.food[i].x * 1000) / 1000, Math.round(w.food[i].y * 1000) / 1000]);
  }
  eng.view = {
    t: 'meter',
    voices: eng.sounding,
    cpu: eng.cpu,
    level: eng.level,
    pop: w.creatures.length,
    popMax: w.popMax,
    cap: w.patch.cap,
    food: w.food.length,
    foods,
    creatures,
    season: season.name,
    mood: season.mood,
    phase: season.phase,
    keyShift: season.keyShift,
    herd: w.herd.on ? [Math.round(w.herd.x * 1000) / 1000, Math.round(w.herd.y * 1000) / 1000] : null,
    stats: { meet: w.stats.meet, eat: w.stats.eat, breed: w.stats.breed, die: w.stats.die },
  };
}

export function postGeissler(eng, m) {
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
  return s * (0.9 + 0.09 * (1 - Math.exp(-(a - 0.9) * 2.5)));
}

export function renderGeissler(eng, L, R) {
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
    while (eng.noteI < eng.noteQ.length && eng.noteQ[eng.noteI].at <= now + 1e-9) {
      startVoice(eng, eng.noteQ[eng.noteI]);
      eng.noteI += 1;
    }
    if (eng.noteI > 48 && eng.noteI === eng.noteQ.length) {
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
  if (t0) {
    const took = performance.now() - t0;
    const budget = n / sr * 1000;
    const load = budget > 0 ? took / budget : 0;
    eng.cpu = eng.cpu * 0.8 + load * 0.2;
  }
  eng.sinceMeter += n;
  if (eng.sinceMeter >= eng.meterEvery) {
    eng.sinceMeter = 0;
    fillView(eng);
    if (eng.onMeter && eng.view) eng.onMeter(eng.view);
  }
}

export function probeGeissler(patch, events, seconds) {
  const sr = 48000;
  const eng = createGeisslerEngine(sr, patch);
  (events || []).forEach(e => {
    const msg = Object.assign({}, e);
    if (msg.at != null) msg.at = Math.round(msg.at * sr);
    postGeissler(eng, msg);
  });
  const total = Math.max(1, Math.round((seconds || 1) * sr));
  const L = new Float32Array(total);
  const R = new Float32Array(total);
  const block = 128;
  for (let i = 0; i < total; i += block) {
    const len = Math.min(block, total - i);
    renderGeissler(eng, L.subarray(i, i + len), R.subarray(i, i + len));
  }
  let sum = 0;
  const tailFrom = Math.max(0, total - Math.round(0.2 * sr));
  let tail = 0;
  let tailN = 0;
  for (let i = 0; i < total; i++) {
    sum += L[i] * L[i] + R[i] * R[i];
    if (i >= tailFrom) { tail += L[i] * L[i] + R[i] * R[i]; tailN++; }
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
  };
}
