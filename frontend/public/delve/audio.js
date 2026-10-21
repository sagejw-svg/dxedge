/* Short tones made in the browser. No samples, no network. */

export function createAudio() {
  let ctx = null;
  let muted = false;

  function ac() {
    if (muted) return null;
    if (!ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, gain, slide) {
    const a = ac();
    if (!a) return;
    const t = a.currentTime;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  return {
    muted() { return muted; },
    toggle() {
      muted = !muted;
      return muted;
    },
    step() { tone(140, 0.04, 'square', 0.025); },
    turn() { tone(220, 0.03, 'triangle', 0.02); },
    hit() { tone(320, 0.07, 'square', 0.04, 90); },
    hurt() { tone(90, 0.16, 'sawtooth', 0.04, 50); },
    spell() { tone(440, 0.18, 'sine', 0.04, 880); },
    pickup() { tone(520, 0.1, 'triangle', 0.04, 780); },
    wall() { tone(70, 0.05, 'square', 0.02); },
    win() { tone(392, 0.4, 'triangle', 0.05, 784); },
  };
}
