// PHASE 2. Load as a pendulum on line length L. Owns state.load.
// Two small-angle DOF: swing.x tangential (from slew accel), swing.y radial (from trolley accel).
// theta'' = -(g/L) theta - damping theta' + drive / L
//   drive: trolley accel for radial, radius * slew accel for tangential, plus wind force / mass.
// Damping around 0.02/s plus settings.damping assist (0 = raw, 1 = heavy).
// Emits: hook.tight (tension rises from 0), load.slack (load rests, tension ~0), sway.settled
// (|swing| below 0.5 deg for 1.5 s). Sets load.onSurface, load.tension.
// Hook / unhook is ground-controlled by radio.js via bus, never by a grab key.

export function init(ctx) {}

export function update(ctx, dt) {}
