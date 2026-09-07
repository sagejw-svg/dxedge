// PHASE 2. Derived readings. Owns state.sensors. ui.js displays them, crane.js obeys them.
// radius = crane.radius; hookHeight = cabHeight + 1.8 - line - (load half height if attached)
// heading = slew in degrees, 0 = site north, wrapped 0..359
// ratedLoad from a small load chart table by radius (generic, no OEM data):
//   r<=10: 6000 kg, 20: 4000, 30: 2600, 40: 1900, 50: 1400, 55: 1200 (interpolate)
// capacityPct = actualLoad / ratedLoad * 100; lmiLock when >= 100, emit lmi.lock on rising edge
// a2b when line <= minLine + 0.5, emit alarm.a2b on rising edge
// slack mirrors load.onSurface with near-zero tension
// collision: AABB of the load vs mission deck volumes, emit collision on rising edge
// swayAngle = hypot(load.swing.x, load.swing.y), whatever is on the rope
// loadSway = swayAngle while a load is attached, otherwise 0. The gauge reads
//   swayAngle; ground's ALL STOP reads loadSway.
// swayAmplitude = the oscillating part of it, |swing rate| * sqrt(L/g), which a
//   steady lean does not contribute to. What the lift is scored on.
//
// PHASE 1 filled radius, hookHeight and heading. PHASE 2 fills the rest.

import { MISSIONS, SUPPORT_REACH } from '../data/missions.js';
import { CRANE, ratedAtRadius, maxRadiusForLoad } from '../data/crane.js';

const G = 9.81;

// PHASE 2B: the load chart and the A2B / LMI constants live in data/crane.js.
// A2B is predictive: it trips when the rope left above the stop is no more than
// the margin plus the distance the hoist still needs to decelerate, so at range II
// the block comes to rest above the stop instead of on it.
// Reach: maxLoadRadius is the inverse of the chart at the current actual load.
const SLACK_TENSION_FRACTION = 0.05;

let wasLocked = false;
let wasA2b = false;
let wasCollision = false;

function currentMission(state) {
  if (state.mission.id === null || state.mission.id === undefined) return null;
  return MISSIONS.find((m) => m.id === state.mission.id) || null;
}

// World-space AABB of the hanging load. The jib frame has +x out along the jib
// and +z across it; render.js rotates that group by -slew, so this matches what
// is drawn. Load yaw is ignored (the box is treated as axis-aligned), which is
// the conservative reading for a proximity check.

// The vertical part of the rope, L cos(tilt). The hook hangs this far below the
// sheave, not a whole line length: it is offset sideways by L sin of each swing
// angle, and what is left over is the drop. Same three lines as pendulum.js,
// which owns the model; a shared copy would be one system importing another.
function ropeDrop(state) {
  const sx = Math.sin(state.load.swing.x);
  const sy = Math.sin(state.load.swing.y);
  return state.crane.line * Math.sqrt(Math.max(0, 1 - sx * sx - sy * sy));
}

function loadAABB(state) {
  const c = state.crane;
  const load = state.load;
  const [sx, sy, sz] = load.size;

  const jibX = c.radius + Math.sin(load.swing.y) * c.line;
  const jibZ = Math.sin(load.swing.x) * c.line;
  const cos = Math.cos(c.slew);
  const sin = Math.sin(c.slew);

  const cx = jibX * cos - jibZ * sin;
  const cz = jibX * sin + jibZ * cos;
  const cy = state.load.bottomY + sy / 2;

  return {
    min: [cx - sx / 2, cy - sy / 2, cz - sz / 2],
    max: [cx + sx / 2, cy + sy / 2, cz + sz / 2]
  };
}

// A load resting on a deck volume shares that volume's top face, and an AABB
// test calls a shared face a hit. Standing on something is not colliding with
// it: without this the scaffold landing fails the instant it succeeds, and the
// truck pickup fails the instant the load is hooked.
// The band is SUPPORT_REACH, the same number missions.js grants support over, so
// that "standing on it" and "not colliding with it" are the same set. It used to
// be 0.35 here against 0.25 there, which left a tenth of a metre on top of every
// volume where nothing collided and nothing held the load up. The rope pay-out
// this was once widened for cannot reach below the face any more: pendulum.js
// clamps load.bottomY at the surface and crane.js stops the rope there.
// Horizontal overlap is inclusive, matching overlaps() below, so a shared face is
// never a hit on one test and a miss on the other.
function restingOn(box, d) {
  return box.min[1] >= d.max[1] - SUPPORT_REACH && box.min[1] <= d.max[1] + SUPPORT_REACH &&
    box.max[0] >= d.min[0] && box.min[0] <= d.max[0] &&
    box.max[2] >= d.min[2] && box.min[2] <= d.max[2];
}

function overlaps(a, b) {
  return (
    a.min[0] <= b.max[0] && a.max[0] >= b.min[0] &&
    a.min[1] <= b.max[1] && a.max[1] >= b.min[1] &&
    a.min[2] <= b.max[2] && a.max[2] >= b.min[2]
  );
}

export function init(ctx) {
  wasLocked = false;
  wasA2b = false;
  wasCollision = false;
}

export function update(ctx, dt) {
  const { state, bus } = ctx;
  const c = state.crane;
  const s = state.sensors;
  const load = state.load;

  s.radius = c.radius;

  const loadHalfHeight = load.attached ? (load.size[1] || 0) / 2 : 0;
  // The drop, not the line: at the ends of an arc the hook is measurably higher
  // than the rope is long, and the gauge is the operator's only altitude read on
  // the blind shaft.
  s.hookHeight = c.cabHeight + CRANE.hookDrop - ropeDrop(state) - loadHalfHeight;

  let deg = (c.slew * 180) / Math.PI;
  deg = deg % 360;
  if (deg < 0) deg += 360;
  s.heading = deg;

  // --- LMI cluster ---
  // Read the weight off line tension, not load.mass, so setting the load down
  // walks the needle to zero the way a real cell would.
  s.actualLoad = Math.max(0, load.tension / G);
  s.ratedLoad = ratedAtRadius(c.radius);
  s.capacityPct = s.ratedLoad > 0 ? (s.actualLoad / s.ratedLoad) * 100 : 0;

  s.lmiLock = s.capacityPct >= CRANE.lmi.lockPct;
  if (s.lmiLock && !wasLocked) bus.emit('lmi.lock', { capacityPct: s.capacityPct });
  wasLocked = s.lmiLock;

  // --- Reach --- how far out this load may go before the chart says no.
  s.maxLoadRadius = load.attached && s.actualLoad > 0 ? maxRadiusForLoad(s.actualLoad) : CRANE.maxRadius;
  s.reachPct = s.maxLoadRadius > 0 ? (c.radius / s.maxLoadRadius) * 100 : 0;

  // --- Anti-two-block (predictive) ---
  const vUp = Math.max(0, -c.lineVel);                       // rope shortening speed
  const stoppingDistance = (vUp * vUp) / (2 * CRANE.hoist.accel);
  s.a2b = (c.line - CRANE.minLine) <= CRANE.a2bMargin + stoppingDistance;
  if (s.a2b && !wasA2b) bus.emit('alarm.a2b', { line: c.line, stoppingDistance });
  wasA2b = s.a2b;

  // --- Slack line ---
  const fullTension = load.attached ? load.mass * G : 0;
  s.slack =
    load.onSurface && (fullTension <= 0 || load.tension <= fullTension * SLACK_TENSION_FRACTION);

  // --- Wind ---
  // Steady wind off the current mission definition. No gust model yet - gusts
  // and any real wind behaviour wait for Phase 3/4, when missions.js drives this.
  const mission = currentMission(state);
  // PHASE 4 gusts. The Notion page says only "gusts on wind missions" and
  // specifies no period, amplitude or shape, so this is invented and
  // deliberately dull: two slow sines of incommensurate period, offset by the
  // mission id so a retry is the same weather rather than a different mission.
  // Mission 2 is the only one carrying a non-zero gust.
  if (!mission) {
    s.wind = 0;
  } else {
    const g = mission.wind.gust || 0;
    if (g <= 0) {
      s.wind = mission.wind.base;
    } else {
      // Time since this lift started, not session time. Seeding off state.time.t
      // meant a retry began at whatever phase the clock happened to be at, so
      // mission 2 was a different difficulty every attempt and the weather was
      // re-rollable by failing on purpose. The comment above always claimed
      // otherwise; now it is true.
      const t = state.mission.elapsed;
      const k = mission.id * 1.7;
      const n = 0.5 + 0.5 * (0.62 * Math.sin(t * 0.62 + k) + 0.38 * Math.sin(t * 0.29 + k * 2.3));
      s.wind = mission.wind.base + g * Math.max(0, Math.min(1, n));
    }
  }

  // --- Collision ---
  // Load AABB against the current mission's deck volumes.
  let hit = false;
  if (load.attached && mission && mission.deck && mission.deck.length) {
    const box = loadAABB(state);
    for (let i = 0; i < mission.deck.length; i += 1) {
      const d = mission.deck[i];
      if (restingOn(box, d)) continue;
      if (overlaps(box, { min: d.min, max: d.max })) { hit = true; break; }
    }
  }
  s.collision = hit;
  if (hit && !wasCollision) bus.emit('collision', {});
  wasCollision = hit;

  s.swayAngle = Math.hypot(load.swing.x, load.swing.y);
  // The empty hook block swings too, and a pendulum's angle under a horizontal
  // acceleration does not care about mass: tan(angle) = a / g. Slewing an empty
  // block out at range II leans it seven to ten degrees, which is real and worth
  // showing on the gauge. It is not a load swinging, so the things that judge a
  // lift read loadSway instead: ground does not call ALL STOP on an empty block,
  // and the after-action card does not charge the operator for a swing that
  // happened before anything was rigged.
  s.loadSway = load.attached ? s.swayAngle : 0;

  // The oscillation, as distinct from the lean, and the one the operator is
  // actually judged on. Since PHASE 4C the model holds a load out from plumb for
  // as long as the house is turning: at range II at 40 m that is three and a half
  // degrees, steady, for the whole slew. It is not a swinging load and charging
  // an operator a grade letter for it would be charging them for slewing.
  //
  // At the bottom of a swing the whole amplitude is in the rate, and for a free
  // swing |thetadot| / omega is exactly the amplitude, with omega = sqrt(g/L). A
  // steady lean has no rate at all, so it contributes nothing. Taken as a maximum
  // over a lift this reads the true swing amplitude and ignores the lean, which
  // is why the thresholds calibrated against the raw angle still mean what they
  // meant.
  const rate = Math.hypot(load.swing.vx, load.swing.vy);
  s.swayAmplitude = load.attached ? rate * Math.sqrt(Math.max(c.line, 0.5) / G) : 0;
}
