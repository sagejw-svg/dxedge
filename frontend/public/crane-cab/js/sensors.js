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
// PHASE 1 SCOPE: only radius, hookHeight, heading are filled here. Everything
// else above (actualLoad, ratedLoad, capacityPct, lmiLock, a2b, slack,
// collision, wind, swayAngle) stays at its state.js default (0 / false) and
// is Phase 2's job. Do not touch it here.

export function init(ctx) {}

export function update(ctx, dt) {
  const { state } = ctx;
  const c = state.crane;
  const s = state.sensors;

  s.radius = c.radius;

  const loadHalfHeight = state.load.attached ? (state.load.size[1] || 0) / 2 : 0;
  s.hookHeight = c.cabHeight + 1.8 - c.line - loadHalfHeight;

  let deg = (c.slew * 180) / Math.PI;
  deg = deg % 360;
  if (deg < 0) deg += 360;
  s.heading = deg;
}
