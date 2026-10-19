// Aether's voice: a sine and a quiet saw through a low-pass, with vibrato
// and a short reverberator. The picture never enters this file. Live playback
// and the offline render used by tests share one graph.

const VIB_CENTS = 52;

function makeReverb(ctx) {
  const input = ctx.createGain();
  const merger = ctx.createChannelMerger(2);
  const banks = [
    [0.0297, 0.0371, 0.0411, 0.0437],
    [0.0313, 0.0389, 0.0407, 0.0451],
  ];
  banks.forEach((times, ch) => {
    const bus = ctx.createGain();
    bus.gain.value = 0.33;
    times.forEach((time) => {
      const delay = ctx.createDelay(1);
      delay.delayTime.value = time;
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 3200;
      const back = ctx.createGain();
      back.gain.value = 0.62;
      input.connect(delay);
      delay.connect(tone);
      tone.connect(back);
      back.connect(delay);
      back.connect(bus);
    });
    bus.connect(merger, 0, ch);
  });
  return { input, out: merger };
}

export function buildTheremin(ctx, { tone = 'full' } = {}) {
  const live = typeof OfflineAudioContext !== 'undefined' && !(ctx instanceof OfflineAudioContext);
  const sine = ctx.createOscillator();
  const saw = ctx.createOscillator();
  sine.type = 'sine';
  saw.type = 'sawtooth';
  const sineGain = ctx.createGain();
  const sawGain = ctx.createGain();
  sineGain.gain.value = tone === 'saw' ? 0.06 : 0.62;
  sawGain.gain.value = tone === 'sine' ? 0 : (tone === 'saw' ? 0.42 : 0.16);
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 5.4;
  const vib = ctx.createGain();
  vib.gain.value = 0;
  lfo.connect(vib);
  vib.connect(sine.detune);
  vib.connect(saw.detune);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1200;
  filter.Q.value = 0.75;
  const vca = ctx.createGain();
  vca.gain.value = 0;
  const dry = ctx.createGain();
  dry.gain.value = 1;
  const wet = ctx.createGain();
  wet.gain.value = 0;
  const reverb = makeReverb(ctx);
  const master = ctx.createGain();
  master.gain.value = tone === 'saw' ? 0.32 : 0.5;
  sine.connect(sineGain);
  saw.connect(sawGain);
  sineGain.connect(filter);
  sawGain.connect(filter);
  filter.connect(vca);
  vca.connect(dry);
  vca.connect(reverb.input);
  dry.connect(master);
  reverb.out.connect(wet);
  wet.connect(master);

  function setParam(param, value, when, glideSec) {
    if (!live || !(glideSec > 0)) {
      param.setValueAtTime(value, when);
      return;
    }
    try { param.setTargetAtTime(value, when, Math.max(0.005, glideSec)); }
    catch (e) { param.value = value; }
  }

  return {
    master,
    live,
    start(when = 0) {
      sine.start(when);
      saw.start(when);
      lfo.start(when);
    },
    apply(control, when, glideSec) {
      const c = control || {};
      const hz = Math.max(20, Math.min(4000, +c.hz || 440));
      const volume = Math.max(0, Math.min(1, +c.volume || 0));
      const cutoff = Math.max(50, Math.min(14000, +c.cutoff || 800));
      const depth = Math.max(0, Math.min(1, +c.vibrato || 0)) * VIB_CENTS;
      const room = Math.max(0, Math.min(1, +c.reverb || 0));
      const glide = glideSec > 0 ? glideSec : 0;
      const gainGlide = c.muted ? Math.min(0.012, glide || 0.012) : Math.max(0.02, glide * 0.45);
      setParam(sine.frequency, hz, when, glide);
      setParam(saw.frequency, hz * 1.004, when, glide);
      setParam(vca.gain, volume, when, gainGlide);
      setParam(filter.frequency, cutoff, when, Math.max(0.03, glide || 0));
      setParam(vib.gain, depth, when, live ? 0.05 : 0);
      setParam(wet.gain, room * 0.95, when, live ? 0.06 : 0);
      setParam(dry.gain, 1 - room * 0.3, when, live ? 0.06 : 0);
    },
  };
}

export function createTheremin(ctx, destination) {
  const graph = buildTheremin(ctx, { tone: 'full' });
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.72;
  graph.master.connect(analyser);
  analyser.connect(destination);
  graph.analyser = analyser;
  graph.wave = new Uint8Array(analyser.fftSize);
  graph.start(ctx.currentTime || 0);
  return graph;
}

function copyChannel(data) {
  const out = new Float32Array(data.length);
  out.set(data);
  return out;
}

export async function renderBuffer({ seconds = 1, sampleRate = 48000, frames, tone = 'full' } = {}) {
  const length = Math.max(1, Math.ceil(seconds * sampleRate));
  const ctx = new OfflineAudioContext(2, length, sampleRate);
  const graph = buildTheremin(ctx, { tone });
  graph.master.connect(ctx.destination);
  const list = (frames && frames.length ? frames : [{ t: 0, hz: 440, volume: 0.75, cutoff: 2800, vibrato: 0, reverb: 0 }])
    .slice()
    .sort((a, b) => (a.t || 0) - (b.t || 0));
  let last = -1;
  list.forEach((frame) => {
    let t = Math.max(0, +frame.t || 0);
    if (t <= last) t = last + 1 / sampleRate;
    last = t;
    graph.apply(frame, t, 0);
  });
  graph.start(0);
  const rendered = await ctx.startRendering();
  return {
    sampleRate: rendered.sampleRate,
    left: copyChannel(rendered.getChannelData(0)),
    right: copyChannel(rendered.getChannelData(1)),
  };
}

export function encodeChannel(f32) {
  const u8 = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength);
  let binary = '';
  const size = 8192;
  for (let i = 0; i < u8.length; i += size) {
    binary += String.fromCharCode.apply(null, u8.subarray(i, Math.min(u8.length, i + size)));
  }
  return btoa(binary);
}
