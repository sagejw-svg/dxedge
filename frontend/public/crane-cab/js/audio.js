// PHASE 3. Web Audio. READ state, never write it.
// Buses into master: ambience (wind, creak, distant site), machine (hoist pitch follows
// crane.lineVel, slew whine, brake), radio (clip -> bandpass 300-3000 Hz -> light drive ->
// static bed, squelch tail). unlock() creates the context on first tap. Mute = master gain 0.
// playRadio(ctx, key) looks up audio/<key>.ogg; missing file resolves silently.

let ac = null;

export function init(ctx) {}

export function unlock(ctx) {
  if (ac) return;
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
  } catch { ac = null; }
}

export function playRadio(ctx, key) {}

export function update(ctx, dt) {}
