// PHASE 3 (missions 0, 1) and PHASE 4 (2, 3). Owns state.mission and the one
// thing nothing else may write: state.load.attached.
//
// start(ctx, id) loads the mission, resets the load to detached with the
// mission's mass and size, copies the pickup and landing positions into
// state.mission so radio.js and render.js never import the mission data, and
// asks the radio director for the mission's script.
//
// Rigging is ground controlled. radio.js emits hook.attach and hook.release;
// this module decides whether the hook is actually on the load and answers with
// hook.attached / hook.notReady / hook.released. There is no grab key.
//
// Win  = the load was set down inside the landing tolerance, slack, released,
//        after having been hooked, under 90 percent capacity, no collision.
// Fail = A2B, LMI lockout, collision, hoisting up before the load is on the
//        hook (once the script has passed its radio check), or an ignored ALL
//        STOP. Exactly one of lift.win / lift.fail is emitted per lift.

import { MISSIONS } from '../data/missions.js';
import { CRANE } from '../data/crane.js';

const HOOK_H_TOL = 1.0;      // m, horizontal hook to load
const HOOK_V_TOL = 0.6;      // m, hook block bottom against the load top
const NEAR_DIST = 2.0;       // m, horizontal, for load.near
const NEAR_HEIGHT = 3.0;     // m, load bottom above the landing, for load.near
const LEAVE_FACTOR = 1.5;    // zone events re-arm once the load is this far back out
const HOIST_UP_VEL = -0.05;  // m/s of rope coming in that counts as hoisting up
const HOIST_UP_ALLOWANCE = 2.0;  // m of rope an unhooked block may take back in
const CAP_LIMIT = 90;        // percent of rated the lift must stay under to score
const START_LINE = 30;       // m of rope every lift begins with, the state.js default
const CLEAR_PICKUP = 0.3;    // m the load must rise off its pickup surface before
                             // deck collisions start counting against the lift
const CLEAR_PICKUP_H = 2.0;  // or this far sideways from the pickup, whichever first

let mission = null;
let resolved = false;
let nearEmitted = false;
let zoneEmitted = false;
let hookCalled = false;      // ground has called for the hook
let releasedDown = false;    // the load was set down and unhooked
let collisionArmed = false;  // see the arming rule in update()
let hoistedUp = 0;           // m of rope taken in while unhooked, since the hook call

function hookWorld(state) {
  // Where the hook block actually is, swing included. The guide calls in
  // radio.js deliberately ignore swing; hooking on does not get to.
  const c = state.crane;
  const jibX = c.radius + Math.sin(state.load.swing.y) * c.line;
  const jibZ = Math.sin(state.load.swing.x) * c.line;
  const cos = Math.cos(c.slew);
  const sin = Math.sin(c.slew);
  return { x: jibX * cos - jibZ * sin, z: jibX * sin + jibZ * cos };
}

function hookBottomY(state) {
  return state.crane.cabHeight + CRANE.hookDrop - state.crane.line;
}

function loadBottomY(state) {
  const h = state.load.attached ? (state.load.size[1] || 0) : 0;
  return hookBottomY(state) - h;
}

export function init(ctx) {
  const { state, bus } = ctx;

  bus.on('hook.attach', () => onAttach(ctx));
  bus.on('hook.release', () => onRelease(ctx));

  // Arms when ground actually calls for the hook. Arming on the radio check made
  // every legal upward correction of an empty hook a lost lift, and made mission
  // 1 an instant fail: it starts from wherever the last lift left the rope, and
  // its load sits on a truck bed, so reaching it means hoisting up.
  bus.on('hook.attach', () => { hookCalled = true; });

  bus.on('alarm.a2b', () => fail(ctx, 'anti-two-block'));
  bus.on('lmi.lock', () => fail(ctx, 'LMI lockout'));
  // sensors.js emits the raw contact. This is the only place that knows whether
  // it counts, so it is also the only place that may tell anyone else: radio.js
  // raises its ALL STOP on collision.counted, never on the raw event. Without
  // that split, mission 1 hooking on to its own truck bed raised an alarm for a
  // contact this module had already decided to ignore, and failed the lift.
  // The rising edge, and only the rising edge. Reading the level in update()
  // meant that when arming flipped while the load was still resting on the deck
  // volume it was picked from, hadCollision latched silently: no event, no
  // alarm, nothing on screen, and a flawless lift failed "collision" minutes
  // later at the set-down.
  bus.on('collision', () => {
    if (!collisionArmed || !mission) return;
    state.mission.hadCollision = true;
    bus.emit('collision.counted', {});
    fail(ctx, 'collision');
  });
  bus.on('radio.ignoredAllStop', () => fail(ctx, 'ignored all stop'));
}

export function start(ctx, id) {
  const { state, bus } = ctx;
  const found = MISSIONS.find((m) => m.id === id);
  if (!found) {
    console.warn(`missions: no mission ${id}`);
    return;
  }
  mission = found;

  const m = state.mission;
  m.id = id;
  m.elapsed = 0;
  m.result = null;
  m.failReason = null;
  m.pickupPos = [...found.pickup.pos];
  m.landingPos = [...found.landing.pos];
  m.landingTol = found.landing.tol;
  m.hooked = false;
  m.everHooked = false;
  m.maxCapacityPct = 0;
  m.maxSway = 0;
  m.hadCollision = false;
  m.landedAt = null;

  // Reset the rope. Without this a new lift inherits the last one's line, and a
  // lift whose load sits higher than the last landing cannot be reached without
  // hoisting up, which the rule above then fails.
  state.crane.line = START_LINE;
  state.crane.lineVel = 0;

  const load = state.load;
  load.attached = false;
  load.mass = found.load.mass;
  load.size = [...found.load.size];
  load.swing.x = 0; load.swing.y = 0; load.swing.vx = 0; load.swing.vy = 0;
  load.onSurface = false;
  load.tension = 0;

  resolved = false;
  nearEmitted = false;
  zoneEmitted = false;
  hookCalled = false;
  releasedDown = false;
  collisionArmed = false;
  hoistedUp = 0;

  bus.emit('lift.start', { id });
  bus.emit('radio.start', { script: found.script });
}

// Which lift the end-of-lift card starts next. Phase 4 replaces this with the
// real mission flow; for now a win steps 0 -> 1 -> 0 and a fail retries.
export function nextMissionId(ctx) {
  const m = ctx.state.mission;
  if (m.result !== 'win') return m.id === null ? 0 : m.id;
  return m.id === 0 ? 1 : 0;
}

function onAttach(ctx) {
  const { state, bus } = ctx;
  if (!mission || resolved) return;
  // Every hook.attach gets an answer. Returning silently because the load was
  // already on the hook left radio.js waiting in hookWait for a reply that
  // could never arrive, with no way for the player to break out.
  if (state.load.attached) { bus.emit('hook.attached', { id: mission.id }); return; }

  const p = state.mission.pickupPos;
  const hook = hookWorld(state);
  const dh = Math.hypot(hook.x - p[0], hook.z - p[2]);
  const loadTop = p[1] + (mission.load.size[1] || 0);
  const dy = hookBottomY(state) - loadTop;

  // Above the load top by no more than HOOK_V_TOL is the phase prompt's window.
  // The same slop is allowed below it, because rope paid out past first contact
  // is what a real hook-up looks like and is what leaves the line slack for the
  // "up easy" that follows.
  if (dh > HOOK_H_TOL || dy > HOOK_V_TOL || dy < -HOOK_V_TOL) {
    bus.emit('hook.notReady', { dh, dy });
    return;
  }

  const load = state.load;
  load.attached = true;
  load.mass = mission.load.mass;
  load.size = [...mission.load.size];
  state.mission.hooked = true;
  state.mission.everHooked = true;
  bus.emit('hook.attached', { id: mission.id });
}

function onRelease(ctx) {
  const { state, bus } = ctx;
  if (!mission || resolved) return;
  // Same rule as onAttach: never leave the call unanswered. Nothing on the hook
  // already satisfies an unhook.
  if (!state.load.attached) { bus.emit('hook.released', { id: mission.id }); return; }
  // Refusing silently let the script finish with the load still hanging and
  // neither a win nor a fail ever evaluated. Ground needs to hear the no.
  if (!state.load.onSurface || !state.sensors.slack) {
    bus.emit('hook.notReleased', { onSurface: state.load.onSurface, slack: state.sensors.slack });
    return;
  }

  const centre = loadCentre(state);
  state.load.attached = false;
  state.mission.hooked = false;
  state.mission.landedAt = [centre.x, state.mission.landingPos[1], centre.z];
  releasedDown = true;
  bus.emit('hook.released', { id: mission.id });
}

// Where the load itself is, hook plus swing offset.
function loadCentre(state) {
  const c = state.crane;
  const jibX = c.radius + Math.sin(state.load.swing.y) * c.line;
  const jibZ = Math.sin(state.load.swing.x) * c.line;
  const cos = Math.cos(c.slew);
  const sin = Math.sin(c.slew);
  return { x: jibX * cos - jibZ * sin, z: jibX * sin + jibZ * cos };
}

function win(ctx) {
  const { state, bus } = ctx;
  if (resolved) return;
  resolved = true;
  state.mission.result = 'win';
  state.mission.failReason = null;
  bus.emit('lift.win', { id: state.mission.id, time: state.mission.elapsed });
  bus.emit('radio.stop', {});
}

function fail(ctx, reason) {
  const { state, bus } = ctx;
  if (!mission || resolved) return;
  resolved = true;
  state.mission.result = 'fail';
  state.mission.failReason = reason;
  bus.emit('lift.fail', { id: state.mission.id, reason, time: state.mission.elapsed });
  bus.emit('radio.stop', {});
}

export function update(ctx, dt) {
  const { state, bus } = ctx;
  if (!mission || state.mission.id === null) return;

  const m = state.mission;
  m.elapsed += dt;

  if (resolved) return;

  if (state.sensors.capacityPct > m.maxCapacityPct) m.maxCapacityPct = state.sensors.capacityPct;
  if (state.sensors.swayAngle > m.maxSway) m.maxSway = state.sensors.swayAngle;

  // A load sitting on the thing it is picked from shares a face with that deck
  // volume, and an AABB test counts a shared face as a hit - mission 1's load
  // rests on the truck bed, which is also its only deck volume. So collisions
  // only count once the load has actually been picked clear of its pickup
  // surface. Nothing else changes: swing back into the truck later and it hits.
  // Collisions start counting once the load is clear of what it was picked from,
  // by height or by carrying it away. The !sensors.collision term matters: arming
  // while the boxes are still touching turns the contact the load started in
  // into a hit it never made.
  if (!collisionArmed && state.load.attached && !state.sensors.collision) {
    const lifted = loadBottomY(state) > m.pickupPos[1] + CLEAR_PICKUP;
    const centreNow = loadCentre(state);
    const away = Math.hypot(centreNow.x - m.pickupPos[0], centreNow.z - m.pickupPos[2]);
    if (lifted || away > CLEAR_PICKUP_H) collisionArmed = true;
  }

  // Hauling away once ground has called for the hook, with nothing on it, is the
  // classic way to snatch a load that is not rigged. But an operator who has
  // lowered a metre past the block's window has to take some rope back in to
  // correct, and failing that made overshooting the window unrecoverable: the
  // only input that fixed it was the one that ended the lift. So it is a budget,
  // not a tripwire. Small corrections are free; hauling up is not.
  if (hookCalled && !m.hooked && !releasedDown) {
    if (state.crane.lineVel < HOIST_UP_VEL) {
      hoistedUp += -state.crane.lineVel * dt;
      if (hoistedUp > HOIST_UP_ALLOWANCE) {
        fail(ctx, 'hoist before on the hook');
        return;
      }
    } else if (state.crane.lineVel > -HOIST_UP_VEL) {
      // Paying rope back out is the opposite of snatching, so it clears the
      // budget. Without this the allowance was a per-lift lifetime total, and
      // two corrections of the size ground itself asks for spent it: the player
      // was failed for snatching an unrigged load while doing what they were
      // told, with the block two metres off the deck.
      hoistedUp = 0;
    }
  }

  const landing = m.landingPos;
  const centre = loadCentre(state);
  const d = Math.hypot(centre.x - landing[0], centre.z - landing[2]);
  const aboveLanding = loadBottomY(state) - landing[1];
  const tol = mission.landing.tol;

  if (!nearEmitted && d < NEAR_DIST && aboveLanding <= NEAR_HEIGHT) {
    nearEmitted = true;
    bus.emit('load.near', { d });
  } else if (nearEmitted && (d > NEAR_DIST * LEAVE_FACTOR || aboveLanding > NEAR_HEIGHT * LEAVE_FACTOR)) {
    nearEmitted = false;
  }

  const inZone = d < tol;
  if (!zoneEmitted && inZone) {
    zoneEmitted = true;
    bus.emit('load.inZone', { d });
  } else if (zoneEmitted && d > tol * LEAVE_FACTOR) {
    zoneEmitted = false;
  }

  // The win is read one tick after the release: unhooking clears load.attached,
  // which clears onSurface and sensors.slack with it, so the slack that the
  // release already required is latched in releasedDown rather than re-read.
  if (releasedDown && m.everHooked) {
    if (inZone && m.maxCapacityPct < CAP_LIMIT && !m.hadCollision) {
      win(ctx);
    } else if (!inZone) {
      // Set down somewhere else. Without this the lift never resolves and the
      // end-of-lift card never appears. Added in Phase 3, flagged in the report.
      fail(ctx, 'set down outside the zone');
    } else {
      fail(ctx, m.hadCollision ? 'collision' : 'over 90 percent of rated');
    }
  }
}
