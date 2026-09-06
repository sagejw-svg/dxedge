// Headless harness. Wires the real modules in main.js's exact tick order with no
// DOM, so the game's logic can be tested in seconds without a browser. render.js,
// ui.js and audio.js are deliberately absent: they are read-only consumers of
// state, and what they draw is checked by test/smoke.mjs and by screenshots.
//
// Usage: see test/regress.mjs. Run both with test/run.sh.
import { pathToFileURL } from 'node:url';

// Resolve against this file, so the suite runs from anywhere in a fresh clone.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (p) => import(pathToFileURL(join(ROOT, p)).href);

export async function makeSim() {
  const [stateM, eventsM, crane, pendulum, sensors, missions, radio, scoring] = await Promise.all([
    load('js/state.js'), load('js/events.js'), load('js/crane.js'), load('js/pendulum.js'),
    load('js/sensors.js'), load('js/missions.js'), load('js/radio.js'), load('js/scoring.js')
  ]);

  const state = stateM.createState();
  const bus = eventsM.createBus(state);
  const ctx = { state, bus };
  const log = [];
  const origEmit = bus.emit;
  bus.emit = (name, payload) => { log.push({ t: +state.time.t.toFixed(3), name, payload, node: state.radio.node }); return origEmit(name, payload); };

  crane.init(ctx); pendulum.init(ctx); sensors.init(ctx); missions.init(ctx); radio.init(ctx); scoring.init(ctx);

  // main.js item 6 equivalent
  bus.on('lift.win', () => { state.phase = 'afteraction'; });
  bus.on('lift.fail', () => { state.phase = 'afteraction'; });

  const STEP = state.time.dt;
  function tick() {
    state.time.t += STEP;
    state.time.frame += 1;
    // input.update: axes are set directly by the test, nothing to do
    crane.update(ctx, STEP);
    pendulum.update(ctx, STEP);
    sensors.update(ctx, STEP);
    missions.update(ctx, STEP);
    radio.update(ctx, STEP);
    scoring.update(ctx, STEP);
    state.intent.reply = null;          // input.endTick
    state.intent.look.dx = 0; state.intent.look.dy = 0;
  }
  function run(seconds, perTick) {
    const n = Math.round(seconds / STEP);
    for (let i = 0; i < n; i += 1) {
      if (perTick) perTick(state, i);
      if (state.phase !== 'playing') return false;   // sim only ticks while playing
      tick();
    }
    return true;
  }
  return { ctx, state, bus, log, tick, run, modules: { crane, pendulum, sensors, missions, radio }, STEP };
}

// --- simple autopilots -------------------------------------------------
export function driveTo(state, { radius, slew, line }, dead = { r: 0.05, s: 0.002, l: 0.05 }) {
  const i = state.intent;
  i.range = 'I';
  i.trolley = radius === undefined ? 0 : (radius - state.crane.radius > dead.r ? 1 : (state.crane.radius - radius > dead.r ? -1 : 0));
  i.slew = slew === undefined ? 0 : (slew - state.crane.slew > dead.s ? 1 : (state.crane.slew - slew > dead.s ? -1 : 0));
  // hoist positive = up = line shortens
  i.hoist = line === undefined ? 0 : (state.crane.line - line > dead.l ? 1 : (line - state.crane.line > dead.l ? -1 : 0));
}
export function polarOf(pos) {
  return { radius: Math.hypot(pos[0], pos[2]), slew: Math.atan2(pos[2], pos[0]) };
}
