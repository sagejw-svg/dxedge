// Gleam's effect pad, in ordinary Web Audio nodes: a lowpass sweep, a
// tempo-ish stutter gate, and a feedback delay. It sits on the rack master
// only while a finger is down. Bypassed, the input is wired straight to the
// output and the filter is not in the path.
//
// The delay is a single feedback loop of our own, not the master bus delay
// and not a copy of any published reverb.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createGleamFx(ctx) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 16000;
  filter.Q.value = 0.7;
  const gate = ctx.createGain();
  gate.gain.value = 1;
  const delay = ctx.createDelay(1.5);
  delay.delayTime.value = 0.18;
  const feedback = ctx.createGain();
  feedback.gain.value = 0;
  const wet = ctx.createGain();
  wet.gain.value = 0;
  const dry = ctx.createGain();
  dry.gain.value = 1;

  filter.connect(gate);
  gate.connect(dry);
  gate.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(wet);

  let on = false;
  let timer = 0;
  let last = null;

  function hardWire(bypass) {
    try { input.disconnect(); } catch (e) { /* not connected yet */ }
    try { dry.disconnect(); } catch (e) { /* not in the chain */ }
    try { wet.disconnect(); } catch (e) { /* not in the chain */ }
    if (bypass) input.connect(output);
    else {
      input.connect(filter);
      dry.connect(output);
      wet.connect(output);
    }
    on = !bypass;
  }
  hardWire(true);

  function clearStutter() {
    if (timer) { clearInterval(timer); timer = 0; }
    const t = ctx.currentTime || 0;
    try { gate.gain.cancelScheduledValues(t); } catch (e) { /* offline clock */ }
    gate.gain.setValueAtTime(1, t);
  }

  // Square stutter with 4 ms ramps so the gate does not click. `seconds` is
  // how far ahead to write; a live finger refreshes that window on a timer.
  function scheduleStutter(depth, hz, seconds) {
    const t0 = ctx.currentTime || 0;
    try { gate.gain.cancelScheduledValues(t0); } catch (e) { /* already clear */ }
    if (!(depth > 0.02) || !(hz > 0)) {
      gate.gain.setValueAtTime(1, t0);
      return;
    }
    const period = 1 / hz;
    const off = clamp(1 - depth, 0, 1);
    const dur = seconds == null ? 1.25 : seconds;
    const edge = Math.min(0.004, period * 0.2);
    for (let t = 0; t < dur; t += period) {
      const a = t0 + t;
      gate.gain.setValueAtTime(1, a);
      gate.gain.linearRampToValueAtTime(off, a + edge);
      const back = a + period * 0.5;
      gate.gain.setValueAtTime(off, Math.max(a + edge, back - edge));
      gate.gain.linearRampToValueAtTime(1, back);
    }
  }

  function apply(spec, seconds) {
    last = spec;
    const bypass = !spec || spec.on === false;
    if (bypass !== !on) hardWire(bypass);
    if (bypass) { clearStutter(); return last; }
    const now = ctx.currentTime || 0;
    filter.frequency.setValueAtTime(clamp(spec.cutoff, 40, 18000), now);
    filter.Q.setValueAtTime(clamp(spec.q, 0.1, 12), now);
    delay.delayTime.setValueAtTime(clamp(spec.delaySec, 0.02, 0.7), now);
    feedback.gain.setValueAtTime(clamp(spec.feedback, 0, 0.9), now);
    wet.gain.setValueAtTime(clamp(spec.wet, 0, 1), now);
    if (timer) { clearInterval(timer); timer = 0; }
    scheduleStutter(spec.stutterDepth, spec.stutterHz, seconds);
    if (seconds == null && spec.stutterDepth > 0.02) {
      timer = setInterval(() => scheduleStutter(spec.stutterDepth, spec.stutterHz, 1.25), 400);
    }
    return spec;
  }

  return {
    input,
    output,
    get on() { return on; },
    get last() { return last; },
    filter,
    feedback,
    set(spec, seconds) { return apply(spec, seconds); },
    bypass() { return apply({ on: false }); },
    stop() { clearStutter(); },
  };
}

// Offline render of the effect on a short tone, so a test can measure the
// sweep, the repeats and the stutter without the rest of the rack.
export async function renderGleamFx({ hz = 3000, x = 0.5, y = 0.2, z = 0, seconds = 1, sampleRate = 48000, on = true, tempo = 120, burst = 0 }) {
  const { effectOf } = await import('./gleam.js');
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = hz;
  const fx = createGleamFx(ctx);
  const spec = effectOf(x, y, z, tempo);
  spec.on = on !== false;
  fx.set(spec, seconds + 0.05);
  osc.connect(fx.input);
  fx.output.connect(ctx.destination);
  osc.start(0);
  if (burst > 0) osc.stop(Math.min(seconds, burst));
  const buf = await ctx.startRendering();
  fx.stop();
  return buf;
}
