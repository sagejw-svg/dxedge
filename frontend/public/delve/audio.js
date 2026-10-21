/* Tones and a low hum made in the browser. No samples, no network. */

const VOL_KEY = 'dxedge_delve_volume';
const MUTE_KEY = 'dxedge_delve_mute';

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let volume = 0.7;
  let hum = null;

  try {
    const stored = localStorage.getItem(VOL_KEY);
    if (stored != null && stored !== '') {
      const n = Number(stored);
      if (Number.isFinite(n)) volume = Math.max(0, Math.min(1, n));
    }
    muted = localStorage.getItem(MUTE_KEY) === '1';
  } catch (e) { /* private mode */ }

  function remember() {
    try {
      localStorage.setItem(VOL_KEY, String(volume));
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch (e) { /* ignore */ }
  }

  function ac() {
    try {
      if (!ctx) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return null;
        ctx = new Ctor();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : volume;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) {
      return null;
    }
  }

  function tone(freq, dur, type, gain, slide) {
    const a = ac();
    if (!a || !master) return;
    const t = a.currentTime;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(Math.max(40, freq), t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
    g.gain.setValueAtTime(gain * volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, gain, freq) {
    const a = ac();
    if (!a || !master) return;
    const len = Math.max(1, (a.sampleRate * dur) | 0);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource();
    src.buffer = buf;
    const filter = a.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq || 400;
    const g = a.createGain();
    const t = a.currentTime;
    g.gain.setValueAtTime(gain * volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  function ensureHum() {
    const a = ac();
    if (!a || !master || hum) return;
    try {
      const bed = a.createGain();
      bed.gain.value = 0.22;
      const low = a.createOscillator();
      low.type = 'sine';
      low.frequency.value = 55;
      const mid = a.createOscillator();
      mid.type = 'sine';
      mid.frequency.value = 82;
      mid.detune.value = 7;
      low.connect(bed);
      mid.connect(bed);
      bed.connect(master);
      const buf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = a.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const filter = a.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 220;
      const ng = a.createGain();
      ng.gain.value = 0.045;
      src.connect(filter);
      filter.connect(ng);
      ng.connect(master);
      low.start();
      mid.start();
      src.start();
      hum = true;
    } catch (e) { /* no hum is still a game */ }
  }

  function applyGain() {
    if (master) master.gain.value = muted ? 0 : volume;
  }

  return {
    muted() { return muted; },
    volume() { return volume; },
    setVolume(v) {
      volume = Math.max(0, Math.min(1, Number(v) || 0));
      applyGain();
      remember();
      ensureHum();
    },
    toggle() {
      muted = !muted;
      applyGain();
      remember();
      if (!muted) ensureHum();
      return muted;
    },
    start() { ensureHum(); },
    step() { noise(0.045, 0.09, 280); tone(110, 0.04, 'triangle', 0.03); },
    turn() { tone(220, 0.03, 'triangle', 0.02); },
    hit() { noise(0.06, 0.12, 900); tone(320, 0.07, 'square', 0.045, 90); },
    miss() { tone(180, 0.05, 'square', 0.02, 120); },
    hurt() { tone(90, 0.16, 'sawtooth', 0.05, 48); },
    spell() { tone(440, 0.12, 'sine', 0.04, 880); tone(660, 0.18, 'triangle', 0.025, 990); },
    door() { noise(0.16, 0.1, 180); tone(70, 0.2, 'sawtooth', 0.04, 42); },
    pickup() { tone(520, 0.08, 'triangle', 0.04, 780); },
    level() { tone(392, 0.12, 'triangle', 0.045, 523); tone(659, 0.2, 'sine', 0.03, 784); },
    wall() { tone(70, 0.05, 'square', 0.02); },
    win() { tone(392, 0.22, 'triangle', 0.05, 523); tone(523, 0.34, 'triangle', 0.04, 784); },
  };
}
