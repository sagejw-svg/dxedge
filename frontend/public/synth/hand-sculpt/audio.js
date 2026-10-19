// Sculpt's voices. Each orb is a drone. A spread hand turns that drone into grains.
// X is pan and an HRTF position, Y is pitch, Z is the low-pass, wrist roll is timbre,
// and the gap between two open hands is the reverb width.

import { mapSound, ORBS } from './hands.js';

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function noiseBuffer(ctx) {
  const n = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let s = 0x1234567;
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    d[i] = ((s >>> 0) / 4294967296) * 2 - 1;
  }
  return buf;
}

function impulse(ctx, seconds, decay) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  let s = 0x51A7;
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      s = (Math.imul(s, 1103515245) + 12345) | 0;
      const white = ((s >>> 0) / 4294967296) * 2 - 1;
      const t = i / len;
      d[i] = white * Math.pow(1 - t, decay);
    }
  }
  return buf;
}

function panGains(pan) {
  const theta = (clamp(pan, -1, 1) + 1) * Math.PI * 0.25;
  return [Math.cos(theta), Math.sin(theta)];
}

export function createSculptAudio(ctx, { bed = true } = {}) {
  const master = ctx.createGain();
  master.gain.value = 0.85;
  const dry = ctx.createGain();
  dry.gain.value = 1;
  const wet = ctx.createGain();
  wet.gain.value = 0.08;

  const conv = ctx.createConvolver();
  conv.buffer = impulse(ctx, 2.2, 2.4);

  // A short cross-delay whose feedback and time open with the two-hand gap.
  const split = ctx.createChannelSplitter(2);
  const merge = ctx.createChannelMerger(2);
  const delayL = ctx.createDelay(0.5);
  const delayR = ctx.createDelay(0.5);
  const fb = ctx.createGain();
  fb.gain.value = 0.2;
  const damp = ctx.createBiquadFilter();
  damp.type = 'lowpass';
  damp.frequency.value = 4200;
  const width = ctx.createGain();
  width.gain.value = 0.12;
  delayL.delayTime.value = 0.07;
  delayR.delayTime.value = 0.09;

  master.connect(dry);
  dry.connect(ctx.destination);
  master.connect(conv);
  conv.connect(wet);
  wet.connect(ctx.destination);

  master.connect(split);
  split.connect(delayL, 0);
  split.connect(delayR, 1);
  delayL.connect(merge, 0, 1);
  delayR.connect(merge, 0, 0);
  merge.connect(damp);
  damp.connect(fb);
  fb.connect(delayL);
  fb.connect(delayR);
  damp.connect(width);
  width.connect(ctx.destination);

  if (ctx.listener.forwardX) {
    ctx.listener.positionX.setValueAtTime(0, 0);
    ctx.listener.positionY.setValueAtTime(0, 0);
    ctx.listener.positionZ.setValueAtTime(0, 0);
    ctx.listener.forwardX.setValueAtTime(0, 0);
    ctx.listener.forwardY.setValueAtTime(0, 0);
    ctx.listener.forwardZ.setValueAtTime(-1, 0);
    ctx.listener.upX.setValueAtTime(0, 0);
    ctx.listener.upY.setValueAtTime(1, 0);
    ctx.listener.upZ.setValueAtTime(0, 0);
  }

  const noise = noiseBuffer(ctx);
  const voices = [];
  const byId = {};

  function makeVoice(def) {
    const sine = ctx.createOscillator();
    const saw = ctx.createOscillator();
    sine.type = 'sine';
    saw.type = 'sawtooth';
    const gSine = ctx.createGain();
    const gSaw = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.85;
    const vca = ctx.createGain();
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 2;
    panner.maxDistance = 24;
    panner.rolloffFactor = 0.25;
    panner.coneInnerAngle = 360;
    panner.coneOuterAngle = 360;
    panner.coneOuterGain = 1;
    const splitter = ctx.createChannelSplitter(2);
    const merger = ctx.createChannelMerger(2);
    const gL = ctx.createGain();
    const gR = ctx.createGain();

    sine.connect(gSine);
    saw.connect(gSaw);
    gSine.connect(filter);
    gSaw.connect(filter);
    filter.connect(vca);
    vca.connect(panner);
    panner.connect(splitter);
    splitter.connect(gL, 0);
    splitter.connect(gR, 1);
    gL.connect(merger, 0, 0);
    gR.connect(merger, 0, 1);
    merger.connect(master);

    const t0 = ctx.currentTime || 0;
    const home = mapSound(def, def);
    sine.frequency.setValueAtTime(home.hz, t0);
    saw.frequency.setValueAtTime(home.hz, t0);
    gSine.gain.setValueAtTime(1, t0);
    gSaw.gain.setValueAtTime(0, t0);
    filter.frequency.setValueAtTime(home.cutoff, t0);
    vca.gain.setValueAtTime(bed && def.kind === 'drone' ? 0.045 : 0, t0);
    panner.positionX.setValueAtTime(home.pan * 4.2, t0);
    panner.positionY.setValueAtTime(home.elev * 1.6, t0);
    panner.positionZ.setValueAtTime(-2.1, t0);
    const [pl, pr] = panGains(home.pan);
    gL.gain.setValueAtTime(pl, t0);
    gR.gain.setValueAtTime(pr, t0);
    sine.start(t0);
    saw.start(t0);

    const voice = {
      def, sine, saw, gSine, gSaw, filter, vca, panner, gL, gR,
      x: def.x, y: def.y, z: def.z, roll: 0, spread: 0, grabbed: false,
    };
    voices.push(voice);
    byId[def.id] = voice;
    return voice;
  }

  function at(when) {
    return Math.max(ctx.currentTime || 0, when || 0);
  }

  function setVoice(voice, pos, when) {
    const s = mapSound(voice.def, pos);
    const tau = 0.02;
    when = at(when);
    voice.sine.frequency.setTargetAtTime(s.hz, when, tau);
    voice.saw.frequency.setTargetAtTime(s.hz * 1.003, when, tau);
    voice.gSine.gain.setTargetAtTime(1 - s.timbre, when, tau);
    voice.gSaw.gain.setTargetAtTime(s.timbre * 0.26, when, tau);
    voice.filter.frequency.setTargetAtTime(clamp(s.cutoff, 80, 14000), when, tau);
    voice.filter.Q.setTargetAtTime(0.6 + s.timbre * 1.4, when, tau);
    let level = 0;
    if (pos.grab || pos.grabbed) level = 0.24 * (1 - s.spread * 0.82);
    else if (bed) level = voice.def.kind === 'drone' ? 0.048 : 0.016;
    voice.vca.gain.setTargetAtTime(level, when, 0.03);
    const pan = s.pan;
    if (voice.panner.positionX) {
      voice.panner.positionX.setTargetAtTime(pan * 4.2, when, tau);
      voice.panner.positionY.setTargetAtTime(s.elev * 1.6, when, tau);
      voice.panner.positionZ.setTargetAtTime(-2.1 + (1 - s.spread) * 0.0, when, tau);
    }
    const [pl, pr] = panGains(pan);
    voice.gL.gain.setTargetAtTime(pl, when, tau);
    voice.gR.gain.setTargetAtTime(pr, when, tau);
    voice.x = pos.x;
    voice.y = pos.y;
    voice.z = pos.z;
    voice.roll = pos.roll || 0;
    voice.spread = s.spread;
    voice.grabbed = !!(pos.grab || pos.grabbed);
    voice.sound = s;
    return s;
  }

  function setReverb(amount, when) {
    const a = clamp(amount, 0, 1);
    when = at(when);
    wet.gain.setTargetAtTime(0.02 + a * 0.62, when, 0.05);
    fb.gain.setTargetAtTime(0.08 + a * 0.7, when, 0.05);
    width.gain.setTargetAtTime(0.04 + a * 0.55, when, 0.05);
    const tL = 0.045 + a * 0.16;
    const tR = 0.06 + a * 0.2;
    delayL.delayTime.setTargetAtTime(tL, when, 0.05);
    delayR.delayTime.setTargetAtTime(tR, when, 0.05);
  }

  function scheduleGrain(voice, t, hz, spread, rnd) {
    const dur = 0.018 + rnd() * 0.04;
    const osc = ctx.createOscillator();
    osc.type = rnd() > 0.5 ? 'triangle' : 'sine';
    const semi = (rnd() * 2 - 1) * 10 * spread;
    osc.frequency.setValueAtTime(hz * Math.pow(2, semi / 12) * (rnd() > 0.72 ? 2 : 1), t);
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const oGain = ctx.createGain();
    const nGain = ctx.createGain();
    oGain.gain.setValueAtTime(0.4, t);
    nGain.gain.setValueAtTime(0.75, t);
    const env = ctx.createGain();
    const peak = 0.04 + spread * 0.22;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(oGain);
    oGain.connect(env);
    src.connect(nGain);
    nGain.connect(env);
    // Past the drone's VCA, so a spread hand can duck the tone and still spray grains.
    env.connect(voice.panner);
    osc.start(t);
    src.start(t);
    osc.stop(t + dur + 0.02);
    src.stop(t + dur + 0.02);
  }

  setReverb(0.2, 0);

  return { ctx, master, voices, byId, makeVoice, setVoice, setReverb, scheduleGrain, noise };
}

export function bootVoices(audio, defs = ORBS) {
  for (let i = 0; i < defs.length; i++) audio.makeVoice(defs[i]);
  return audio;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rnd() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function renderSculpt({
  seconds = 1.5,
  sampleRate = 48000,
  events = [],
  bed = false,
  seed = 1,
} = {}) {
  const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(seconds * sampleRate)), sampleRate);
  const audio = bootVoices(createSculptAudio(ctx, { bed }));
  const rnd = mulberry32(seed);
  const states = {};
  for (const v of audio.voices) {
    states[v.def.id] = { x: v.def.x, y: v.def.y, z: v.def.z, roll: 0, spread: 0, grab: false };
  }
  let reverb = 0.15;
  const ev = events.slice().sort((a, b) => a.t - b.t);
  function apply(id, when) {
    const st = states[id];
    audio.setVoice(audio.byId[id], {
      x: st.x, y: st.y, z: st.z, roll: st.roll, spread: st.spread, grab: st.grab,
    }, when);
  }
  function snap() {
    const o = {};
    for (const id of Object.keys(states)) o[id] = Object.assign({}, states[id]);
    return o;
  }
  for (const id of Object.keys(states)) apply(id, 0);
  audio.setReverb(reverb, 0);
  const stamps = [{ t: 0, states: snap() }];
  for (const e of ev) {
    const when = Math.max(0, e.t || 0);
    if (e.reverb != null) {
      reverb = e.reverb;
      audio.setReverb(reverb, when);
    }
    if (e.id && states[e.id]) {
      const st = states[e.id];
      if (e.x != null) st.x = e.x;
      if (e.y != null) st.y = e.y;
      if (e.z != null) st.z = e.z;
      if (e.roll != null) st.roll = e.roll;
      if (e.spread != null) st.spread = e.spread;
      if (e.grab != null) st.grab = e.grab;
      apply(e.id, when);
    }
    stamps.push({ t: when, states: snap() });
  }
  stamps.push({ t: seconds, states: snap() });
  for (let i = 0; i < stamps.length - 1; i++) {
    const t0 = stamps[i].t;
    const t1 = stamps[i + 1].t;
    const held = stamps[i].states;
    for (const id of Object.keys(held)) {
      const st = held[id];
      if (!st.grab || st.spread < 0.08) continue;
      const s = mapSound(audio.byId[id].def, st);
      const rate = 8 + st.spread * 48;
      const step = 1 / rate;
      for (let t = t0; t < t1 - 0.01; t += step) {
        audio.scheduleGrain(audio.byId[id], t, s.hz, st.spread, rnd);
      }
    }
  }
  return ctx.startRendering();
}
