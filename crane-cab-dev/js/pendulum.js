// PHASE 2. Load as a pendulum on line length L. Owns state.load.
// Two DOF: swing.x tangential (across the jib, the direction the trolley sweeps as
// the house slews), swing.y radial (along the jib).
//
// PHASE 4C: the full equation, rather than the small-angle one driven only by the
// two accelerations a control input produces directly. Per axis:
//
//   theta'' = -(g/L) sin(theta) - (2 Ldot / L) theta' - damping theta'
//             - (a_pivot / L) cos(theta) + (a_wind / L) cos(theta)
//
// with the pivot's acceleration taken in full, in the rotating jib frame, as the
// polar acceleration of a point at radius r turning at rate Omega:
//
//   radial      a_r = rddot - r Omega^2            <- centrifugal
//   tangential  a_t = r Omegadot + 2 rdot Omega    <- Euler and Coriolis
//
// The two right-hand terms were previously omitted as "not the full rotating
// frame equations", and they are the ones an operator actually feels: slewing at
// range II at 50 m holds the load about four degrees out from plumb the whole
// time it is turning, and it swings back in when the slew stops. Nothing in the
// old model did that, so a constant slew produced no lean at all.
//
// 2 Ldot / L is the rope length coupling. Angular momentum about the pivot goes
// as L^2 theta', so hauling in on a swinging load feeds it: shortening the rope
// grows the swing (amplitude goes as L^-3/4), paying out kills it. This is why
// "up easy" is said the way it is, and it was missing entirely.
//
// The sin and cos keep it honest past the small-angle range instead of stopping
// being true somewhere around fifteen degrees.
//
// The rope drops L cos(tilt), not L, so the load rises at the ends of its arc and
// the drawn rope is as long as the rope actually is. Hanging the hook a whole
// line length down while also offsetting it sideways by L sin(tilt) drew a rope
// six percent long at the top of the range and held the load at one height right
// across an arc. At the sub-degree swing a landing is made at the correction is
// under a millimetre, so nothing about touchdown moved.
//
// Damping acts on how fast the load is moving through the world, not through the
// turning frame, which is the difference between the swing plane staying where
// the world put it and quietly being dragged round with the house.
//
// Damping around 0.05/s plus settings.damping assist (0 = raw, 1 = heavy).
// Emits: hook.tight (tension rises from 0), load.slack (load rests, tension ~0), sway.settled
// (|swing| below 0.5 deg for 1.5 s). Sets load.onSurface, load.tension.
// Hook / unhook is ground-controlled by radio.js via bus, never by a grab key.
// PHASE 3: init() leaves the hook empty. missions.js owns load.attached.
// PHASE 4: contact is against state.mission.surfaceY, not a hard-coded deck at 0.

import { CRANE } from '../data/crane.js';
import { MISSIONS } from '../data/missions.js';

const G = 9.81;

// A last-resort guard, not a modelling limit. The equation is exact in the angle
// now, so this is only here to stop a pathological input running the state away;
// ground raises ALL STOP at ten degrees, so a lift is long over before it bites.
const MAX_SWING = 0.60;            // rad, ~34 deg

// An E-stop zeroes crane velocities in a single tick, which as a raw finite
// difference reads as several hundred m/s^2 or rad/s^2. Only the finite
// differences are clamped. The centrifugal and Coriolis terms are built from
// velocities, which cannot spike like that, so clamping them would only make
// them wrong.
const DRIVE_ACCEL_CLAMP = 3.0;     // m/s^2, on rddot
const SLEW_ACCEL_CLAMP = 0.5;      // rad/s^2, on Omegadot (the drive is r times this)

// PHASE 2B retune. Amplitude decays as exp(-damping * t / 2), so 0.20/s (the default
// 0.5 slider) takes a 4 deg swing to 0.1 deg in about 37 s. A real crane rings for a
// minute or more, which is what BASE_DAMPING alone gives at slider 0. Feel check pending.
const BASE_DAMPING = 0.05;         // 1/s, rope and air drag
const DAMPING_ASSIST = 0.3;        // 1/s per unit of settings.damping (0..1)
const DECK_DAMPING = 6.0;          // 1/s extra while the load is resting on a surface

// Rope paid out past first contact before tension has fully bled off to slack.
const TENSION_BLEED = 0.15;        // m

const TIGHT_FRACTION = 0.95;       // tension fraction that counts as "line tight"
const SLACK_FRACTION = 0.05;       // tension fraction at or below which it is slack

const SETTLED_ANGLE = (0.5 * Math.PI) / 180;   // rad
const SETTLED_HOLD = 1.5;                      // s below SETTLED_ANGLE before emitting

// Air drag on the load face. Generic values, only used for the steady wind lean.
const AIR_DENSITY = 1.225;         // kg/m^3
const DRAG_COEFF = 1.2;            // flat-ish box

let prevSlewVel = 0;
let prevPivotVel = 0;
let wasTight = false;
let wasSlack = false;
let settledFor = 0;
let settledEmitted = false;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// The vertical fraction of the rope. The hook sits at (L sin(radial), -L cos(tilt),
// L sin(tangential)) from the sheave, so the drop is what is left of the length
// once the two sideways offsets are taken out of it.
//
// Deliberately a local function rather than a published state field. It is a pure
// function of the swing, and storing it made it something that could be stale:
// anything that moves the rope without running a tick leaves the stored drop
// describing the previous rope. sensors.js, missions.js and render.js each keep
// their own copy of these three lines, the same way they already each keep their
// own copy of the horizontal offset, because a shared one would mean a system
// importing another system.
function tiltCos(swing) {
  const sx = Math.sin(swing.x);
  const sy = Math.sin(swing.y);
  return Math.sqrt(Math.max(0, 1 - sx * sx - sy * sy));
}

// The pendulum plane is fixed in the world, not in the jib frame, and until now
// that was handled by rotating the stored swing vector by the frame's own turn
// each tick. That is only half right. Rotating (angle, rate) by Omega dt supplies
// one Coriolis term where the rotating frame has two, and supplies no centrifugal
// term on the swing's own offset at all, because that is second order in the
// step. It showed up as a steady centrifugal lean about two percent under the
// closed form. The frame terms are written out explicitly in update() instead,
// which is the standard rotating-frame pendulum and is exactly right.

export function init(ctx) {
  const load = ctx.state.load;

  // PHASE 3: nothing is on the hook at boot. missions.js places the load and the
  // radio director is the only thing that hooks it on. The Phase 2 test load that
  // used to hang here is gone.
  load.swing.x = 0;
  load.swing.y = 0;
  load.swing.vx = 0;
  load.swing.vy = 0;
  load.onSurface = false;
  load.tension = 0;

  prevSlewVel = ctx.state.crane.slewVel;
  prevPivotVel = ctx.state.crane.radiusVel + (ctx.state.crane.deflectionVel || 0);
  wasTight = false;
  wasSlack = false;
  settledFor = 0;
  settledEmitted = false;
}

export function update(ctx, dt) {
  const { state, bus } = ctx;
  const c = state.crane;
  const load = state.load;
  const swing = load.swing;

  // The rope hangs from where the jib actually is, not where the trolley is
  // commanded to be. Under load the structure bends out toward the load, and
  // that deflected point is the pendulum's pivot. Feeding it in here is what
  // makes a heavy load swing out from under the operator as it breaks the
  // ground, with no special case anywhere for liftoff: the pivot simply moves
  // out as the weight comes on, and the rotating-frame terms below do the rest.
  const pivotRadius = c.radius + (c.deflection || 0);
  const pivotRadiusVel = c.radiusVel + (c.deflectionVel || 0);

  // Pivot acceleration this tick, as a finite difference of the crane's own
  // velocities. crane.js has already run (fixed tick order), so these are
  // current. The difference is taken on the pivot's velocity, not the trolley's,
  // because the structure taking up its deflection accelerates the rope's top
  // end exactly as a trolley movement would, and that acceleration is the whole
  // of the liftoff kick.
  const slewAccel = clamp(dt > 0 ? (c.slewVel - prevSlewVel) / dt : 0,
    -SLEW_ACCEL_CLAMP, SLEW_ACCEL_CLAMP);
  const radiusAccel = clamp(dt > 0 ? (pivotRadiusVel - prevPivotVel) / dt : 0,
    -DRIVE_ACCEL_CLAMP, DRIVE_ACCEL_CLAMP);
  prevSlewVel = c.slewVel;
  prevPivotVel = pivotRadiusVel;

  // The pivot's acceleration, in full, in the jib frame. This is just the polar
  // acceleration of a point at radius r turning at rate Omega, which is what the
  // sheave is:
  //
  //   a_r = rddot - r Omega^2          out along the jib
  //   a_t = r Omegadot + 2 rdot Omega  the way the trolley is sweeping
  //
  // Local +z is the direction of increasing slew (missions.loadCentre maps local
  // (x, z) to world by a rotation of +slew), and swing.x is the angle in that
  // direction, so a_t drives swing.x and a_r drives swing.y with no sign games.
  //
  // -r Omega^2 is the one that changes how the crane feels. Turning at range II
  // at 50 m is 0.72 m/s^2 outward, which holds the load about four degrees off
  // plumb for as long as the slew lasts and lets it go when the slew stops. The
  // old model had no term that could do that: a constant slew rate produced no
  // lean whatsoever, and all the swing came from the brief moments of Omegadot at
  // the start and end of a turn.
  const slewRate = c.slewVel;
  const driveTangential = pivotRadius * slewAccel + 2 * pivotRadiusVel * slewRate;
  const driveRadial = radiusAccel - pivotRadius * slewRate * slewRate;

  // --- Deck contact and line tension ---
  // Hook block height above the deck, then the bottom face of what hangs on it.
  // The rope drops L cos(tilt), not L. Treating the drop as the whole rope length
  // while offsetting the hook sideways by L sin(tilt) makes the drawn rope longer
  // than the rope is - six percent at the top of the model's range - and holds the
  // load at a constant height right through an arc it should be rising and falling
  // across. At the settled sub-degree swing a landing is made at, the correction
  // is under a millimetre, so nothing about touchdown changes.
  const drop = c.line * tiltCos(swing);
  const hookY = c.cabHeight + CRANE.hookDrop - drop;
  const loadHeight = load.attached ? (load.size[1] || 0) : 0;
  const bottomY = hookY - loadHeight;

  // What the load would land on here. missions.js publishes it; 0 is the deck,
  // and it is one tick stale, which at the fastest hoist is about 12 mm.
  const surfaceY = state.mission.surfaceY || 0;

  // Where the load actually ends up. Rope paid out past contact does not push a
  // load through the deck, so the load stops at the surface and the slack goes
  // into the rope. Everything downstream reads load.bottomY rather than deriving
  // it from the line, which is what used to sink a landed crate into the deck.
  load.bottomY = load.attached ? Math.max(bottomY, surfaceY) : bottomY;

  let tensionFraction;
  if (load.attached && bottomY <= surfaceY) {
    load.onSurface = true;
    // Rope keeps paying out after touchdown; tension bleeds off across TENSION_BLEED.
    tensionFraction = clamp(1 - (surfaceY - bottomY) / TENSION_BLEED, 0, 1);
  } else {
    load.onSurface = false;
    tensionFraction = load.attached ? 1 : 0;
  }
  load.tension = load.attached ? load.mass * G * tensionFraction : 0;

  const tight = load.attached && tensionFraction >= TIGHT_FRACTION;
  if (tight && !wasTight) bus.emit('hook.tight', {});
  wasTight = tight;

  const slack = load.attached && load.onSurface && tensionFraction <= SLACK_FRACTION;
  if (slack && !wasSlack) bus.emit('load.slack', {});
  wasSlack = slack;

  // --- Wind drive ---
  // Steady horizontal push on the load face. PHASE 2B: the wind has a world direction
  // (mission.wind.dir, degrees it blows FROM, 0 = site north, same convention as the
  // slew heading), projected onto the jib frame so the lean shifts as the house slews.
  // sensors.js publishes the speed; reading it here is one tick stale, which is fine
  // and keeps the two systems decoupled.
  let windRadial = 0;
  let windTangential = 0;
  if (load.attached && load.mass > 0) {
    const v = state.sensors.wind || 0;
    const area = (load.size[0] || 0) * (load.size[1] || 0);
    const force = 0.5 * AIR_DENSITY * DRAG_COEFF * area * v * v;
    const accel = force / load.mass;
    const mission = MISSIONS.find((m) => m.id === state.mission.id);
    const dirFrom = mission && mission.wind && mission.wind.dir !== undefined ? mission.wind.dir : 0;
    const toward = (dirFrom + 180) * Math.PI / 180;
    const rel = toward - c.slew;
    windRadial = accel * Math.cos(rel);
    windTangential = accel * Math.sin(rel);
  }

  // --- Integrate the two DOF ---
  const L = Math.max(c.line, 0.5);
  const gOverL = G / L;
  const damping =
    BASE_DAMPING +
    (state.settings.damping || 0) * DAMPING_ASSIST +
    (load.onSurface ? DECK_DAMPING : 0);

  // Rope length coupling. Angular momentum about the pivot goes as L^2 theta',
  // so the equation carries a -2 Ldot / L theta' term: paying out slows the
  // swing, hauling in feeds it. c.lineVel is positive paying out, so hauling in
  // makes `pump` positive and it adds energy, which is exactly what happens when
  // you take a swinging load up and exactly why ground says "up easy". At 1.5 m/s
  // on 10 m of rope it is +0.30/s against about 0.20/s of damping, so range II
  // near the deck genuinely loses the argument.
  const pump = -2 * (c.lineVel || 0) / L;

  // A pivot accelerating one way leaves the load behind, so the drive enters
  // with a negative sign. Wind pushes the load the way it blows, so it does not.
  // Both are horizontal, so they act on the load through cos(theta), while
  // gravity's restoring torque goes as sin(theta).
  const sinX = Math.sin(swing.x);
  const cosX = Math.cos(swing.x);
  const sinY = Math.sin(swing.y);
  const cosY = Math.cos(swing.y);

  // The rotating frame's own terms, on the swing itself rather than on the pivot.
  // The load sits at radius r + L sin(radial) turning at Omega, so it carries its
  // own centrifugal force; and it is moving in a turning frame, so it carries
  // Coriolis and, while the slew is changing, Euler. Writing these out is what
  // makes a free swing hold a fixed plane in the world while the house turns
  // under it, and it is the same set of terms as a Foucault pendulum.
  const frameY = slewRate * slewRate * sinY + 2 * slewRate * swing.vx + slewAccel * sinX;
  const frameX = slewRate * slewRate * sinX - 2 * slewRate * swing.vy - slewAccel * sinY;

  // Damping is rope and air drag, and both act on how fast the load is moving
  // through the world, not on how fast it is moving relative to a frame that is
  // itself turning. The difference is Omega cross s, and leaving it out let the
  // damping quietly rotate the swing plane with the house instead of leaving it
  // where the world put it.
  const dragX = swing.vx + slewRate * sinY;
  const dragY = swing.vy - slewRate * sinX;

  const accelX = -gOverL * sinX + pump * swing.vx - damping * dragX
    + (windTangential - driveTangential) * cosX / L + frameX;
  const accelY = -gOverL * sinY + pump * swing.vy - damping * dragY
    + (windRadial - driveRadial) * cosY / L + frameY;

  // Semi-implicit Euler: velocity first, then position. It is symplectic, which
  // is why a free swing here holds its amplitude for minutes instead of quietly
  // gaining or losing energy the way explicit Euler would.
  swing.vx += accelX * dt;
  swing.vy += accelY * dt;
  swing.x += swing.vx * dt;
  swing.y += swing.vy * dt;


  if (swing.x > MAX_SWING) { swing.x = MAX_SWING; if (swing.vx > 0) swing.vx = 0; }
  if (swing.x < -MAX_SWING) { swing.x = -MAX_SWING; if (swing.vx < 0) swing.vx = 0; }
  if (swing.y > MAX_SWING) { swing.y = MAX_SWING; if (swing.vy > 0) swing.vy = 0; }
  if (swing.y < -MAX_SWING) { swing.y = -MAX_SWING; if (swing.vy < 0) swing.vy = 0; }

  // --- sway.settled ---
  const angle = Math.hypot(swing.x, swing.y);
  if (angle < SETTLED_ANGLE) {
    settledFor += dt;
    if (settledFor >= SETTLED_HOLD && !settledEmitted) {
      settledEmitted = true;
      bus.emit('sway.settled', {});
    }
  } else {
    settledFor = 0;
    settledEmitted = false;
  }
}
