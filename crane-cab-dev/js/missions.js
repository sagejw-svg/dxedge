// PHASE 3 (missions 0, 1) and PHASE 4 (2, 3). Owns state.mission. Data in data/missions.js.
// start(ctx, id): load mission, place load at pickup, set wind, hookCam flag, start script.
// update: elapsed += dt. Evaluate every tick:
//   win  = load in landing zone (within tol) AND slack AND unhooked AND capacityPct < 90 AND no collision
//   fail = a2b OR lmiLock OR collision OR hoist-up before hook.tight was allowed OR ALL STOP ignored
// Emit lift.win / lift.fail once with { reason }. Set phase to 'afteraction' via bus consumer in main.

export function init(ctx) {}

export function start(ctx, id) {
  ctx.state.mission.id = id;
  ctx.state.mission.elapsed = 0;
  ctx.state.mission.result = null;
}

export function update(ctx, dt) {
  if (ctx.state.mission.id !== null) ctx.state.mission.elapsed += dt;
}
