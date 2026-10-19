// Five local voices, one per fingertip. Triangle plus a quiet octave,
// a short attack and a release ramp so a curl does not click.

const PAN = { thumb: -0.55, index: -0.28, middle: 0, ring: 0.28, pinky: 0.55 };

export function createOrchestra(ctx) {
  const master = ctx.createGain();
  master.gain.value = 0.8;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2800;
  tone.Q.value = 0.6;
  master.connect(tone);
  const voices = new Map();
  const meters = { thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0 };

  function stop(id, time) {
    const v = voices.get(id);
    if (!v) return;
    const now = time == null ? ctx.currentTime : time;
    const g = v.g.gain;
    g.cancelScheduledValues(now);
    const cur = Math.max(0.0001, g.value);
    g.setValueAtTime(cur, now);
    g.exponentialRampToValueAtTime(0.0001, now + 0.09);
    try { v.osc.stop(now + 0.12); } catch (e) { /* already stopped */ }
    try { v.osc2.stop(now + 0.12); } catch (e) { /* already stopped */ }
    voices.delete(id);
    meters[id] = 0;
  }

  function noteOn(id, note, vel) {
    if (!voices.has(id) && voices.size >= 8) return;
    const held = voices.get(id);
    if (held && held.note === note) {
      meters[id] = vel == null ? 0.85 : vel;
      return;
    }
    stop(id);
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const g = ctx.createGain();
    const g2 = ctx.createGain();
    const p = ctx.createStereoPanner();
    const freq = 440 * Math.pow(2, (note - 69) / 12);
    osc.type = 'triangle';
    osc.frequency.value = freq;
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2;
    g2.gain.value = 0.18;
    p.pan.value = PAN[id] == null ? 0 : PAN[id];
    osc.connect(g);
    osc2.connect(g2);
    g2.connect(g);
    g.connect(p);
    p.connect(master);
    const now = ctx.currentTime;
    const level = Math.max(0.05, Math.min(0.28, (vel == null ? 0.85 : vel) * 0.22));
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(level, now + 0.018);
    osc.start(now);
    osc2.start(now);
    voices.set(id, { osc, osc2, g, note });
    meters[id] = vel == null ? 0.85 : vel;
  }

  function noteOff(id) { stop(id); }

  function panic() {
    [...voices.keys()].forEach(id => stop(id));
  }

  function setLevel(v) {
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), now, 0.02);
  }

  function tick() {
    FINGER_IDS.forEach(id => {
      if (!voices.has(id)) meters[id] = meters[id] * 0.6;
    });
    return Object.assign({}, meters);
  }

  function sounding() {
    const out = {};
    voices.forEach((v, id) => { out[id] = v.note; });
    return out;
  }

  return { output: tone, noteOn, noteOff, panic, setLevel, tick, sounding, meters: () => Object.assign({}, meters) };
}

const FINGER_IDS = ['thumb', 'index', 'middle', 'ring', 'pinky'];
