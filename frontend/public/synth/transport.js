// Master clock. One tempo and one play/stop for the whole rack. Devices
// subscribe and receive play, stop, tempo and clock events. A clock event is
// one MIDI-style pulse, 24 per quarter note, stamped with the AudioContext
// time it falls on so a sequencer can schedule a worklet message at that frame.
//
// The musical maths (ticks, bars, seconds) is pure and does not touch the
// audio graph. Filament's LFOs follow it when their sync is set to a note value
// (the engine posts play, stop, tempo and locate to the worklet); with sync off
// nothing moves when it plays.

export const PPQ = 24;
export const TEMPO_MIN = 40;
export const TEMPO_MAX = 240;

export function clampTempo(bpm) {
  const n = +bpm;
  if (!isFinite(n)) return 120;
  return Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, n));
}

export function secondsPerBeat(tempo) { return 60 / clampTempo(tempo); }

export function normalizeSig(sig) {
  const n = sig && +sig[0], d = sig && +sig[1];
  const num = n === 2 || n === 3 || n === 4 || n === 5 || n === 6 || n === 7 ? n : 4;
  const den = d === 2 || d === 4 || d === 8 ? d : 4;
  return [num, den];
}

// Quarter-note beats in one bar. 4/4 is 4, 6/8 is 3, 3/4 is 3.
export function beatsPerBar(timeSig) {
  const sig = normalizeSig(timeSig);
  return sig[0] * (4 / sig[1]);
}

export function describePosition(beat, tempo, timeSig) {
  const sig = normalizeSig(timeSig);
  const bpb = beatsPerBar(sig);
  const b = isFinite(+beat) ? +beat : 0;
  const bar = Math.floor(b / bpb);
  return {
    tempo: clampTempo(tempo), beat: b, bar,
    beatInBar: b - bar * bpb,
    timeSig: sig, ppq: PPQ,
    secondsPerBeat: secondsPerBeat(tempo),
  };
}

// Tick indexes whose beat lies in [fromBeat, toBeat).
export function clockTicks(fromBeat, toBeat, ppq) {
  if (!(toBeat > fromBeat)) return [];
  const p = ppq > 0 ? ppq : PPQ;
  const first = Math.ceil(fromBeat * p - 1e-9);
  const last = Math.floor(toBeat * p - 1e-9);
  const out = [];
  for (let i = first; i <= last; i++) out.push(i);
  return out;
}

// One clock pulse. `originTime` is the context time at which the transport was
// at `originBeat`. `time` is the context time of this pulse.
export function describeTick(tick, tempo, timeSig, originTime, originBeat) {
  const beat = tick / PPQ;
  const pos = describePosition(beat, tempo, timeSig);
  const time = (originTime || 0) + (beat - (originBeat || 0)) * pos.secondsPerBeat;
  return Object.assign(pos, { type: 'clock', playing: true, time, tick, frame: null });
}

export function createTransport(ctx, opts) {
  opts = opts || {};
  let tempo = clampTempo(opts.tempo == null ? 120 : opts.tempo);
  let timeSig = normalizeSig(opts.timeSig);
  let playing = false;
  let beat = 0;
  let origin = 0;
  let lastTick = -1;
  let timer = 0;
  const subs = new Set();

  function position() {
    if (!playing) return beat;
    const now = ctx ? ctx.currentTime : 0;
    return beat + (now - origin) / secondsPerBeat(tempo);
  }
  function snapshot(type) {
    const pos = describePosition(position(), tempo, timeSig);
    return Object.assign(pos, {
      type, playing,
      time: ctx ? ctx.currentTime : 0,
      tick: Math.floor(pos.beat * PPQ + 1e-9),
      frame: ctx ? Math.round((ctx.currentTime || 0) * ctx.sampleRate) : 0,
    });
  }
  function emit(ev) {
    if (ctx && ev.time != null) ev.frame = Math.round(ev.time * ctx.sampleRate);
    subs.forEach(fn => { try { fn(ev); } catch (e) { /* one device must not stop the clock */ } });
  }
  function pump() {
    if (!playing) return;
    const tickNow = Math.floor(position() * PPQ + 1e-9);
    for (let t = lastTick + 1; t <= tickNow; t++) emit(describeTick(t, tempo, timeSig, origin, beat));
    if (tickNow > lastTick) lastTick = tickNow;
  }
  function startTimer() { if (!timer) timer = setInterval(pump, 25); }
  function stopTimer() { if (timer) clearInterval(timer); timer = 0; }

  return {
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    unsubscribe(fn) { subs.delete(fn); },
    state() { return snapshot(playing ? 'clock' : 'stop'); },
    position,
    play() {
      if (playing) return snapshot('play');
      origin = ctx ? ctx.currentTime : 0;
      playing = true;
      lastTick = Math.floor(beat * PPQ + 1e-9) - 1;
      emit(snapshot('play'));
      pump();
      startTimer();
      return snapshot('play');
    },
    // First stop holds the position. A second stop, while already stopped,
    // returns to the start.
    stop() {
      if (playing) {
        beat = position();
        playing = false;
        stopTimer();
        emit(snapshot('stop'));
      } else {
        beat = 0;
        lastTick = -1;
        emit(snapshot('stop'));
      }
      return snapshot('stop');
    },
    locate(b) {
      beat = Math.max(0, +b || 0);
      if (playing) { origin = ctx ? ctx.currentTime : 0; lastTick = Math.floor(beat * PPQ + 1e-9); }
      return beat;
    },
    setTempo(bpm) {
      if (playing) {
        beat = position();
        origin = ctx ? ctx.currentTime : 0;
        lastTick = Math.floor(beat * PPQ + 1e-9);
      }
      tempo = clampTempo(bpm);
      emit(snapshot('tempo'));
      return tempo;
    },
    setTimeSig(sig) {
      timeSig = normalizeSig(sig);
      emit(snapshot('tempo'));
      return timeSig.slice();
    },
    dispose() { stopTimer(); subs.clear(); },
  };
}
