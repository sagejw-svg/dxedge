// PHASE 2. Derived readings. Owns state.sensors. ui.js displays them, crane.js obeys them.
// radius = crane.radius; hookHeight = cabHeight + 1.8 - line - (load half height if attached)
// heading = slew in degrees, 0 = site north, wrapped 0..359
// ratedLoad from a small load chart table by radius (generic, no OEM data):
//   r<=10: 6000 kg, 20: 4000, 30: 2600, 40: 1900, 50: 1400, 55: 1200 (interpolate)
// capacityPct = actualLoad / ratedLoad * 100; lmiLock when >= 100, emit lmi.lock on rising edge
// a2b when line <= minLine + 0.5, emit alarm.a2b on rising edge
// slack mirrors load.onSurface with near-zero tension
// collision: AABB of the load vs mission deck volumes, emit collision on rising edge
// swayAngle = hypot(load.swing.x, load.swing.y)
//
// PHASE 1 filled radius, hookHeight and heading. PHASE 2 fills the rest.

import { MISSIONS } from '../data/missions.js';

const G = 9.81;

// Generic load chart. Not any manufacturer's data - the shape (capacity falling
// off with radius) is the point. Linear interpolation between points, flat
// outside the ends.
const LOAD_CHART = [
  { r: 10, kg: 6000 },
  { r: 20, kg: 4000 },
  { r: 30, kg: 2600 },
  { r: 40, kg: 1900 },
  { r: 50, kg: 1400 },
  { r: 55, kg: 1200 }
];

const A2B_MARGIN = 0.5;        // m of line above the mechanical stop where A2B trips
const LMI_LOCK_PCT = 100;      // capacity % at which hoist-up and trolley-out cut
const SLACK_TENSION_FRACTION = 0.05;

let wasLocked = false;
let wasA2b = false;
let wasCollision = false;

function ratedAtRadius(r) {
  const first = LOAD_CHART[0];
  const last = LOAD_CHART[LOAD_CHART.length - 1];
  if (r <= first.r) return first.kg;
  if (r >= last.r) return last.kg;
  for (let i = 0; i < LOAD_CHART.length - 1; i += 1) {
    const a = LOAD_CHART[i];
    const b = LOAD_CHART[i + 1];
    if (r <= b.r) {
      const t = (r - a.r) / (b.r - a.r);
      return a.kg + (b.kg - a.kg) * t;
    }
  }
  return last.kg;
}

function currentMission(state) {
  if (state.mission.id === null || state.mission.id === undefined) return null;
  return MISSIONS.find((m) => m.id === state.mission.id) || null;
}

// World-space AABB of the hanging load. The jib frame has +x out along the jib
// and +z across it; render.js rotates that group by -slew, so this matches what
// is drawn. Load yaw is ignored (the box is treated as axis-aligned), which is
// the conservative reading for a proximity check.
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
  const cy = c.cabHeight + 1.8 - c.line - sy / 2;

  return {
    min: [cx - sx / 2, cy - sy / 2, cz - sz / 2],
    max: [cx + sx / 2, cy + sy / 2, cz + sz / 2]
  };
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
  s.hookHeight = c.cabHeight + 1.8 - c.line - loadHalfHeight;

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

  s.lmiLock = s.capacityPct >= LMI_LOCK_PCT;
  if (s.lmiLock && !wasLocked) bus.emit('lmi.lock', { capacityPct: s.capacityPct });
  wasLocked = s.lmiLock;

  // --- Anti-two-block ---
  s.a2b = c.line <= c.minLine + A2B_MARGIN;
  if (s.a2b && !wasA2b) bus.emit('alarm.a2b', { line: c.line });
  wasA2b = s.a2b;

  // --- Slack line ---
  const fullTension = load.attached ? load.mass * G : 0;
  s.slack =
    load.onSurface && (fullTension <= 0 || load.tension <= fullTension * SLACK_TENSION_FRACTION);

  // --- Wind ---
  // Steady wind off the current mission definition. No gust model yet - gusts
  // and any real wind behaviour wait for Phase 3/4, when missions.js drives this.
  const mission = currentMission(state);
  s.wind = mission ? mission.wind.base : 0;

  // --- Collision ---
  // Load AABB against the current mission's deck volumes.
  let hit = false;
  if (load.attached && mission && mission.deck && mission.deck.length) {
    const box = loadAABB(state);
    for (let i = 0; i < mission.deck.length; i += 1) {
      const d = mission.deck[i];
      if (overlaps(box, { min: d.min, max: d.max })) { hit = true; break; }
    }
  }
  s.collision = hit;
  if (hit && !wasCollision) bus.emit('collision', {});
  wasCollision = hit;

  s.swayAngle = Math.hypot(load.swing.x, load.swing.y);
}
