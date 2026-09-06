// PHASE 2. Load as a pendulum on line length L. Owns state.load.
// Two small-angle DOF: swing.x tangential (from slew accel), swing.y radial (from trolley accel).
// theta'' = -(g/L) theta - damping theta' + drive / L
//   drive: trolley accel for radial, radius * slew accel for tangential, plus wind force / mass.
// Damping around 0.02/s plus settings.damping assist (0 = raw, 1 = heavy).
// Emits: hook.tight (tension rises from 0), load.slack (load rests, tension ~0), sway.settled
// (|swing| below 0.5 deg for 1.5 s). Sets load.onSurface, load.tension.
// Hook / unhook is ground-controlled by radio.js via bus, never by a grab key.
// PHASE 3: init() leaves the hook empty. missions.js owns load.attached.
// PHASE 4: contact is against state.mission.surfaceY, not a hard-coded deck at 0.

import { CRANE } from '../data/crane.js';
import { MISSIONS } from '../data/missions.js';

const G = 9.81;

// The small-angle model stays honest well below this; clamp rather than let a
// slammed control drive the linearisation somewhere it does not belong.
const MAX_SWING = 0.35;            // rad, ~20 deg

// An E-stop zeroes crane velocities in a single tick, which as a raw finite
// difference reads as several hundred m/s^2. Clamp the pivot drive so a stop
// does not fire the load out of the model.
const DRIVE_ACCEL_CLAMP = 3.0;     // m/s^2

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
let prevRadiusVel = 0;
let wasTight = false;
let wasSlack = false;
let settledFor = 0;
let settledEmitted = false;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

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
  prevRadiusVel = ctx.state.crane.radiusVel;
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

  // Pivot acceleration this tick, as a finite difference of the crane's own
  // velocities. crane.js has already run (fixed tick order), so these are current.
  const slewAccel = dt > 0 ? (c.slewVel - prevSlewVel) / dt : 0;
  const radiusAccel = dt > 0 ? (c.radiusVel - prevRadiusVel) / dt : 0;
  prevSlewVel = c.slewVel;
  prevRadiusVel = c.radiusVel;

  // PHASE 2B: the pendulum plane is fixed in the world, not in the jib frame. The jib
  // turned by slewVel * dt this tick, so every world-fixed vector appears turned the
  // other way in jib coordinates. Rotate the swing angle and velocity vectors to match
  // before integrating. Without this a radial swing reads as radial again after a
  // 90 degree slew, which is not what a hanging load does.
  // Sign: render.js rotates the jib group by -slew about y, and swing.y maps to local
  // +x (along the jib) while swing.x maps to local +z (across it). A world-fixed vector
  // therefore transforms by R_y(+a) in local coordinates: radial' = radial cos a +
  // tangential sin a, tangential' = tangential cos a - radial sin a. Verified in a
  // headless run: after a 45 degree slew a free swing has x and y in anti-phase.
  {
    const a = c.slewVel * dt;
    if (a !== 0) {
      const cs = Math.cos(a), sn = Math.sin(a);
      let x = swing.x, y = swing.y;
      swing.x = x * cs - y * sn;
      swing.y = x * sn + y * cs;
      x = swing.vx; y = swing.vy;
      swing.vx = x * cs - y * sn;
      swing.vy = x * sn + y * cs;
    }
  }

  // Tangential drive is the linear accel of the trolley as the house slews.
  // Coriolis (2 * radiusVel * slewVel) and centripetal (radius * slewVel^2) are
  // deliberately omitted - the header specifies a small-angle two-DOF model driven
  // by pivot acceleration, not the full rotating-frame equations.
  const driveTangential = clamp(c.radius * slewAccel, -DRIVE_ACCEL_CLAMP, DRIVE_ACCEL_CLAMP);
  const driveRadial = clamp(radiusAccel, -DRIVE_ACCEL_CLAMP, DRIVE_ACCEL_CLAMP);

  // --- Deck contact and line tension ---
  // Hook block height above the deck, then the bottom face of what hangs on it.
  const hookY = c.cabHeight + CRANE.hookDrop - c.line;
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

  // A pivot accelerating one way leaves the load behind, so the drive enters
  // with a negative sign. Wind pushes the load the way it blows, so it does not.
  const accelX = -gOverL * swing.x - damping * swing.vx - driveTangential / L + windTangential / L;
  const accelY = -gOverL * swing.y - damping * swing.vy - driveRadial / L + windRadial / L;

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
