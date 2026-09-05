// PHASE 4. Owns state.scoring. Listens on the bus, never polls other systems' internals.
// maxSway = max sensors.swayAngle during the lift. collisions, twoBlocks, radioFaults count events.
// landingError = horizontal distance load center to landing.pos at win.
// grade: A if maxSway < 2deg and no faults and landingError < tol/2; B, C, D by thresholds.
// After-action card content is produced here as a plain object; ui.js renders it.
// Achievements: check on lift.win, persist via save.js.

export function init(ctx) {}

export function update(ctx, dt) {}
