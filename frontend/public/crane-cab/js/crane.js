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
//
// I and micro speeds for slew and trolley are not given above (only II is),
// so they're extrapolated using the same I = 0.4x II, micro = 0.1x II ratio
// the hoist numbers already show. Flagging this as a deviation to revisit
// in the Phase 2 sandbox pass if the feel is off.
//
// PHASE 2B: the numbers live in data/crane.js now. LMI approach behaviour added:
// at or above the pre-alarm percent, trolley-out is capped to range I speed; while
// locked, trolley-out brakes at 2x accel instead of coasting on the normal ramp.

import { CRANE } from '../data/crane.js';

const RANGE_SPEED = {
  slew: CRANE.slew.max,
  trolley: CRANE.trolley.max,
  hoist: CRANE.hoist.max
};

const ACCEL = {
  slew: CRANE.slew.accel,        // rad/s^2
  trolley: CRANE.trolley.accel,  // m/s^2
  hoist: CRANE.hoist.accel       // m/s^2
};

const LMI_BRAKE_FACTOR = 2.0;    // trolley-out decel multiplier while locked

const LOOK_PITCH_MIN = -1.2;
const LOOK_PITCH_MAX = 0.6;
const LOOK_YAW_MIN = -1.4;
const LOOK_YAW_MAX = 1.4;

let wasEstopped = false;

function approach(current, target, maxDelta) {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return current;
}

function clampVel(pos, vel, min, max) {
  // Zero the velocity once a clamp boundary is hit so the axis doesn't keep
  // "pushing" against the wall (which would otherwise read as a stuck
  // non-zero velocity in the debug overlay even though position is pinned).
  if (pos <= min && vel < 0) return 0;
  if (pos >= max && vel > 0) return 0;
  return vel;
}

export function init(ctx) {}

export function update(ctx, dt) {
  const { state, bus } = ctx;
  const c = state.crane;
  const intent = state.intent;
  const sensors = state.sensors;

  c.estopped = intent.estop;
  c.brakeOn = intent.brake;

  if (c.estopped) {
    if (!wasEstopped) bus.emit('estop', {});
    c.slewVel = 0;
    c.radiusVel = 0;
    c.lineVel = 0;
    wasEstopped = true;
    return;
  }
  wasEstopped = false;

  const range = RANGE_SPEED.slew[intent.range] !== undefined ? intent.range : 'I';
  const massFactor = 1 / (1 + (state.load.mass || 0) / 2000);

  // --- Slew ---
  let slewIntent = c.brakeOn ? 0 : intent.slew;
  const slewMax = RANGE_SPEED.slew[range];
  const slewTarget = slewIntent * slewMax;
  const slewAccel = ACCEL.slew * massFactor;
  c.slewVel = approach(c.slewVel, slewTarget, slewAccel * dt);
  if (c.brakeOn) c.slewVel = 0;
  c.slew += c.slewVel * dt;

  // --- Trolley (radius) --- positive intent.trolley = out (radius grows).
  let trolleyIntent = intent.trolley;
  if (trolleyIntent > 0 && sensors.lmiLock) trolleyIntent = 0; // LMI blocks out only
  let trolleyMax = RANGE_SPEED.trolley[range];
  // Near the chart limit the real crane slows trolley-out on its own. Cap to range I.
  if (trolleyIntent > 0 && sensors.capacityPct >= CRANE.lmi.preAlarmPct) {
    trolleyMax = Math.min(trolleyMax, RANGE_SPEED.trolley.I);
  }
  const trolleyTarget = trolleyIntent * trolleyMax;
  let trolleyAccel = ACCEL.trolley * massFactor;
  // Locked and still rolling out: brake, do not coast. Unscaled by mass on purpose.
  if (sensors.lmiLock && c.radiusVel > 0) trolleyAccel = ACCEL.trolley * LMI_BRAKE_FACTOR;
  c.radiusVel = approach(c.radiusVel, trolleyTarget, trolleyAccel * dt);
  const radiusMin = c.minRadius;
  const radiusMax = c.maxRadius;
  c.radiusVel = clampVel(c.radius, c.radiusVel, radiusMin, radiusMax);
  c.radius += c.radiusVel * dt;
  if (c.radius < radiusMin) { c.radius = radiusMin; c.radiusVel = 0; }
  if (c.radius > radiusMax) { c.radius = radiusMax; c.radiusVel = 0; }

  // --- Hoist (line) --- positive intent.hoist = up = line shortens.
  // No mass scaling on hoist accel per the header comment (only slew/trolley get it).
  let hoistIntent = intent.hoist;
  if (hoistIntent > 0 && (sensors.a2b || sensors.lmiLock)) hoistIntent = 0; // blocks hoist-up only
  const hoistMax = RANGE_SPEED.hoist[range];
  const lineVelTarget = -hoistIntent * hoistMax;
  c.lineVel = approach(c.lineVel, lineVelTarget, ACCEL.hoist * dt);
  const lineMin = c.minLine;
  const lineMax = c.maxLine;
  c.lineVel = clampVel(c.line, c.lineVel, lineMin, lineMax);
  c.line += c.lineVel * dt;
  if (c.line < lineMin) { c.line = lineMin; c.lineVel = 0; }
  if (c.line > lineMax) { c.line = lineMax; c.lineVel = 0; }

  // --- Look-around --- intent.look.{dx,dy} is a one-shot per-tick delta
  // from input.js (mouse drag), cleared in endTick. Integrated here, read
  // only in render.js.
  state.look.yaw = Math.min(LOOK_YAW_MAX, Math.max(LOOK_YAW_MIN, state.look.yaw + intent.look.dx));
  state.look.pitch = Math.min(LOOK_PITCH_MAX, Math.max(LOOK_PITCH_MIN, state.look.pitch + intent.look.dy));
}
