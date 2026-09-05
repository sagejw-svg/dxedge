// PHASE 1. Crane kinematics. Owns state.crane.
// slew, radius, line each have velocity, an accel cap, and a max speed per range.
// Load mass (state.load.mass) scales slew and trolley accel down.
// E-stop: zero all velocities immediately, set crane.estopped, emit 'estop'.
// Slew brake: holds slew, ignores slew intent while on.
// Clamp radius to [minRadius, jibLength - 1], line to [minLine, maxLine].
// LMI lockout (state.sensors.lmiLock) blocks hoist-up and trolley-out only.
// A2B (state.sensors.a2b) blocks hoist-up only.
//
// Starting numbers to tune in the Sandbox (Phase 2):
//   slew  max 0.12 rad/s (II), accel 0.06 rad/s^2
//   trolley max 1.0 m/s (II), accel 0.6 m/s^2
//   hoist max 1.5 m/s (II), 0.6 (I), 0.15 (micro), accel 1.2 m/s^2

export function init(ctx) {}

export function update(ctx, dt) {}
