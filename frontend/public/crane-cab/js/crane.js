// PHASE 1. Crane kinematics. Owns state.crane.
// slew, radius, line each have velocity, an accel cap, and a max speed per range.
// Load mass scales slew and trolley accel down, but only while it is attached.
// E-stop: zero all velocities immediately, set crane.estopped, emit 'estop'.
// Slew brake: holds slew, ignores slew intent while on.
// Clamp radius to [minRadius, jibLength - 1], line to [minLine, maxLine].
// PHASE 4B: and a rope stop, so paying out cannot drive the block through the
// deck or through a load that is already sitting on something.
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

import { CRANE, ratedAtRadius } from '../data/crane.js';
import { SUPPORT_REACH } from '../data/missions.js';

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

// Straight down is -pi/2. The cab has a glass floor built into it precisely so
// the operator can look through it at the load, and the old -1.2 stopped the
// head 21 degrees short of ever using it: a block at 5 m radius on 20 m of rope
// sits at -76 degrees, below anything the neck could reach.
const LOOK_PITCH_MIN = -1.50;
const LOOK_PITCH_MAX = 0.6;
const LOOK_YAW_MIN = -1.4;
const LOOK_YAW_MAX = 1.4;
const LOOK_HOME_PITCH = -0.35;   // the seated default, matching state.js

// Structural deflection. A load bends the jib downward and, on a tower crane,
// bends the mast forward toward the load, so the point the rope hangs from is
// further out than the trolley is and the radius grows as the weight comes on.
// The operator feels it as the load swinging out from under him at the moment it
// breaks the ground, and the trained answer on a saddle jib is to trolley in
// while taking the weight, holding the radius where it was.
//
// Scaled off the load chart rather than any maker's deflection figures, which
// hard rule 7 would not allow anyway: a load chart is a curve of constant design
// moment, so tension as a fraction of what is rated at this radius is a fair
// stand-in for fraction of design moment, which is what actually sets how far a
// structure bends. Tuned for feel, like the chart itself.
const G = 9.81;
const MAX_DEFLECTION = 0.45;     // m the radius grows at the rated load
const DEFLECTION_TAU = 0.35;     // s for the structure to take up; it is stiff, not instant
// The eye, in the cab, in the slewed frame: cabGroup sits at (1.6, cabHeight,
// 1.9) and render.js puts the eye at (0.2, 1.35, 0) inside it.
const EYE_X = 1.8;
const EYE_Y = 1.35;
const EYE_Z = 1.9;

let wasEstopped = false;

function approach(current, target, maxDelta) {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return current;
}

// How much rope can be out before the thing on the hook is on the ground. Reads
// state.mission.surfaceY, which missions.js publishes one tick stale: at the
// fastest hoist that is 12 mm.
// Derived, so it cannot drift away from the band missions.js grants support over
// and sensors.js suppresses the collision over. A load standing on a face has its
// unclamped bottom this far below that face, and if that ever fell outside
// SUPPORT_REACH, trolleying a landed load off the volume and back on would leave
// it in a collision nothing could resolve. It also has to be more than the 0.15 m
// pendulum.js bleeds tension over, or the line would never read slack and the
// load could never be unhooked. 0.7 of 0.25 is 0.175, which is both.
const ROPE_SLACK = SUPPORT_REACH * 0.7;  // m of pay-out allowed after contact

function ropeStop(state) {
  const c = state.crane;
  if (state.mission.id === null) return c.maxLine;
  const surfaceY = state.mission.surfaceY || 0;
  // hookBottomY is cabHeight + hookDrop - line, so what hangs below the block is
  // the load's height while one is rigged and nothing while the block is empty.
  // An empty block gets no slack allowance: there is nothing to unhook, so it
  // stops on the surface rather than a third of a metre inside it.
  if (!state.load.attached) {
    return Math.min(c.maxLine, Math.max(c.minLine, c.cabHeight + CRANE.hookDrop - surfaceY));
  }
  const out = c.cabHeight + CRANE.hookDrop - surfaceY - (state.load.size[1] || 0) + ROPE_SLACK;
  return Math.min(c.maxLine, Math.max(c.minLine, out));
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
  // Only what is actually hanging on the rope slows the machine down.
  // missions.start sets load.mass from the mission while attached is still
  // false, so an empty block was being flown at 53-69% of its real response -
  // and the two missions felt different before either had a load on.
  const carried = state.load.attached ? (state.load.mass || 0) : 0;
  const massFactor = 1 / (1 + carried / 2000);

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
  const lineWas = c.line;
  c.line += c.lineVel * dt;
  if (c.line < lineMin) { c.line = lineMin; c.lineVel = 0; }
  if (c.line > lineMax) { c.line = lineMax; c.lineVel = 0; }

  // The rope stop. Paying out past the point where whatever hangs on the hook is
  // sitting on something just piles rope on the deck. Without this the block and
  // the rope carried on down through a landed load, through the scaffold and 26 m
  // under the deck, with the hook height gauge reading negative all the way, and
  // holding "down" after touchdown is exactly what "down easy" invites.
  //
  // ROPE_SLACK is what is left to pay out after contact. See its definition for
  // the two numbers it has to sit between.
  //
  // Only ever a limit on paying out. If the surface rises under a swinging block
  // the stop moves up, and hauling the line in to meet it would snatch the load
  // off the deck, so a line already past the stop is left where it is.
  const stop = ropeStop(state);
  if (c.line > stop && c.lineVel > 0) {
    c.line = Math.max(stop, lineWas);
    c.lineVel = 0;
  }

  // --- Structural deflection ---
  // Driven by the tension the rope is actually carrying, not by whether a load
  // is attached, so it comes on as the weight transfers rather than stepping the
  // instant the shackle closes. load.tension is a tick old here, which is the
  // same one-tick staleness pendulum.js already accepts for sensors.wind, and at
  // 1/120 s it is nothing against a 0.35 s time constant.
  const rated = ratedAtRadius(c.radius);
  const moment = rated > 0 ? (state.load.tension || 0) / (rated * G) : 0;
  const target = MAX_DEFLECTION * Math.min(1.5, Math.max(0, moment));
  const wasDeflection = c.deflection;
  c.deflection += (target - c.deflection) * (1 - Math.exp(-dt / DEFLECTION_TAU));
  c.deflectionVel = dt > 0 ? (c.deflection - wasDeflection) / dt : 0;

  // --- Look-around --- intent.look.{dx,dy} is a one-shot per-tick delta from
  // input.js (mouse drag or the arrow keys), cleared in endTick. Integrated
  // here, read only in render.js.
  //
  // Any deliberate head movement drops the tracking, the way looking somewhere
  // else does. Otherwise the head fought the hand.
  const look = state.look;
  // input.js asks; crane.js owns state.look, so the flip happens here.
  if (intent.lookAtLoad) look.tracking = !look.tracking;
  if (intent.lookAhead) {
    look.tracking = false;
    look.yaw = 0;
    look.pitch = LOOK_HOME_PITCH;
  }
  if (intent.look.dx || intent.look.dy) look.tracking = false;

  if (look.tracking) {
    aimAtLoad(state);
  } else {
    look.yaw = Math.min(LOOK_YAW_MAX, Math.max(LOOK_YAW_MIN, look.yaw + intent.look.dx));
    look.pitch = Math.min(LOOK_PITCH_MAX, Math.max(LOOK_PITCH_MIN, look.pitch + intent.look.dy));
  }
}

// Put the head on the hook block. Everything here is in the slewed frame, which
// is the frame state.look is already expressed in, so nothing needs to know the
// crane's bearing: the jib runs along +x, the block hangs off it, and the eye is
// in the cab beside the mast.
//
// The block's position is the same three lines render.js draws it from, and the
// drop is L cos(tilt) for the same reason it is there: hanging it a whole line
// length down while also offsetting it sideways would put it below where it is.
function aimAtLoad(state) {
  const c = state.crane;
  const sx = Math.sin(state.load.swing.x);
  const sy = Math.sin(state.load.swing.y);
  const drop = c.line * Math.sqrt(Math.max(0, 1 - sx * sx - sy * sy));

  const forward = (c.radius + sy * c.line) - EYE_X;
  const lateral = (sx * c.line) - EYE_Z;
  const below = (c.cabHeight + EYE_Y) - (c.cabHeight + CRANE.hookDrop - drop);
  const flat = Math.hypot(forward, lateral);

  // render.js turns yaw into a direction as (cos p cos y, sin p, -cos p sin y),
  // so a positive yaw swings the head toward -z and reaching +z takes a negative
  // one. Verified in the browser rather than reasoned about: smoke.mjs checks the
  // camera's own forward vector actually points at the block.
  const yaw = -Math.atan2(lateral, Math.max(0.001, forward));
  const pitch = -Math.atan2(below, Math.max(0.001, flat));
  state.look.yaw = Math.min(LOOK_YAW_MAX, Math.max(LOOK_YAW_MIN, yaw));
  state.look.pitch = Math.min(LOOK_PITCH_MAX, Math.max(LOOK_PITCH_MIN, pitch));
}
