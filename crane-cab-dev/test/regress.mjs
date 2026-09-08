// Crane Cab regression suite.
//
// Every check here is a bug that was once live. Run it before every deploy:
//   node test/regress.mjs
// It needs nothing but node - no browser, no server, no dependencies.
//
// Browser-only concerns (input.js, ui.js, render.js, the console layout) are in
// test/smoke.mjs, which does need playwright and a local server.
import { makeSim, polarOf } from './harness.mjs';

const results = [];
const rec = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  :: ${detail}` : ''}`);
};

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const MISSIONS = (await import(pathToFileURL(join(HERE, '..', 'data/missions.js')).href)).MISSIONS;
const m0 = MISSIONS[0];
const m1 = MISSIONS[1];

// Tick until pred() or the budget runs out. perTick runs before each tick, which
// is where a one-shot intent has to be set.
function until(sim, pred, seconds = 30, perTick = null) {
  const n = Math.round(seconds / sim.STEP);
  for (let i = 0; i < n; i += 1) {
    if (pred(sim.state)) return true;
    if (perTick) perTick(sim.state, i);
    if (sim.state.phase !== 'playing') return pred(sim.state);
    sim.tick();
  }
  return pred(sim.state);
}
const node = (s) => s.radio.node;
const atNode = (id) => (s) => s.radio.node === id;

// Answer the current call as soon as its window opens.
function answer(sim, idx = 0, seconds = 20) {
  let sent = false;
  return until(sim, (s) => sent && s.radio.ackTimer === 0, seconds, (s) => {
    if (!sent && s.radio.ackTimer > 0) { s.intent.reply = idx; sent = true; }
  });
}

// Park the crane exactly, without touching velocities (no pendulum kick).
function park(sim, { radius, slew, line }) {
  const c = sim.state.crane;
  if (radius !== undefined) { c.radius = radius; c.radiusVel = 0; }
  if (slew !== undefined) { c.slew = slew; c.slewVel = 0; }
  if (line !== undefined) { c.line = line; c.lineVel = 0; }
  const sw = sim.state.load.swing;
  sw.x = 0; sw.y = 0; sw.vx = 0; sw.vy = 0;
}

async function startMission(id) {
  const sim = await makeSim();
  sim.state.phase = 'playing';
  sim.modules.missions.start(sim.ctx, id);
  return sim;
}

// ---------------------------------------------------------------- baseline

async function tBoot() {
  const sim = await startMission(0);
  until(sim, () => false, 2);
  const s = sim.state;
  rec('boot: mission 0, radio check, Copy + Say again',
    s.mission.id === 0 && s.radio.caption === 'TC-1, radio check.' &&
    JSON.stringify(s.radio.replies) === '["Copy","Say again"]' &&
    s.load.attached === false,
    `${JSON.stringify(s.radio.caption)} ${JSON.stringify(s.radio.replies)}`);
  rec('boot: a new lift starts from a known rope length',
    Math.abs(s.crane.line - 30) < 0.001, `line ${s.crane.line.toFixed(2)}`);
}

async function tTimeouts() {
  const sim = await startMission(0);
  until(sim, (s) => s.radio.repeats >= 1, 12);
  const one = sim.state.radio.faults;
  until(sim, (s) => s.radio.repeats >= 2, 12);
  until(sim, () => false, 0.2);
  rec('one lapse repeats free, the second logs a fault',
    one === 0 && sim.state.radio.faults === 1 && node(sim.state) === 'check',
    `faults after 1st ${one}, after 2nd ${sim.state.radio.faults}`);
}

async function tGuideAndHook() {
  const sim = await startMission(0);
  answer(sim);
  const p = polarOf(m0.pickup.pos);
  park(sim, { slew: p.slew, radius: 18 });
  until(sim, atNode('toPickup'), 8);
  // Sit 4.8 m short so the first call is a correction with a distance, and only
  // close to 2.0 m (inside 3x tolerance) once that call has been heard.
  const seen = [];
  let closed = false;
  until(sim, (s) => /Hold, hold, hold/.test(s.radio.caption), 20, (s) => {
    if (s.radio.caption && seen[seen.length - 1] !== s.radio.caption) seen.push(s.radio.caption);
    if (!closed && seen.some((c) => /^Trolley out, /.test(c))) {
      closed = true;
      park(sim, { radius: p.radius - 2.0 });
    }
  });
  rec('guide calls a correction with a distance, then HOLD',
    seen.some((c) => /^Trolley out, /.test(c)) && /Hold, hold, hold/.test(sim.state.radio.caption),
    seen.join(' | '));

  park(sim, { radius: p.radius });
  until(sim, atNode('onHook'), 14);
  rec('inside tolerance with the swing dead, ground calls for the hook',
    node(sim.state) === 'onHook', node(sim.state));

  // Too high: the caption must say which way, not just "over the load".
  until(sim, (s) => /you are high/.test(s.radio.caption), 14);
  rec('a block held high is told to come down, not just repositioned',
    /Come down on it, you are high/.test(sim.state.radio.caption),
    JSON.stringify(sim.state.radio.caption));

  park(sim, { radius: p.radius, line: 42.85 });
  until(sim, (s) => s.load.attached, 14);
  until(sim, () => false, 0.2);
  rec('over the load it hooks on, with the mission mass',
    sim.state.load.attached && sim.state.load.mass === m0.load.mass,
    `attached ${sim.state.load.attached} mass ${sim.state.load.mass}`);
}

async function tFullLift() {
  const sim = await startMission(0);
  answer(sim);
  const p = polarOf(m0.pickup.pos);
  const l = polarOf(m0.landing.pos);
  park(sim, { slew: p.slew, radius: p.radius });
  until(sim, atNode('onHook'), 14);
  park(sim, { slew: p.slew, radius: p.radius, line: 42.85 });
  until(sim, (s) => s.load.attached, 14);
  until(sim, atNode('upEasy'), 10);
  answer(sim);
  park(sim, { line: 38 });
  until(sim, atNode('toLanding'), 14);
  park(sim, { slew: l.slew, radius: l.radius, line: 38 });
  until(sim, atNode('hold'), 20);
  answer(sim);
  until(sim, atNode('downEasy'), 14);
  answer(sim);
  park(sim, { slew: l.slew, radius: l.radius, line: 43.2 });
  until(sim, (s) => s.mission.result !== null, 20);
  const s = sim.state;
  rec('a lift flown as ground called it is a win',
    s.mission.result === 'win' && s.radio.faults === 0,
    `result ${s.mission.result} reason ${s.mission.failReason} faults ${s.radio.faults}`);
  rec('the next lift after a win is mission 1',
    sim.modules.missions.nextMissionId(sim.ctx) === 1,
    String(sim.modules.missions.nextMissionId(sim.ctx)));
}

// ---------------------------------------------------------------- the fixes

// Hooking mission 1 off its own truck bed shares a face with that deck volume.
// The raw sensors collision fires; nothing may act on it.
async function tTruckHookNoAlarm() {
  const sim = await startMission(1);
  answer(sim);                                   // check
  until(sim, atNode('watchTruck'), 10);
  answer(sim);                                   // watchTruck
  const p = polarOf(m1.pickup.pos);
  park(sim, { slew: p.slew, radius: p.radius });
  until(sim, atNode('onHook'), 16);
  // Land the block in the lower half of the window, where the boxes touch.
  park(sim, { slew: p.slew, radius: p.radius, line: 41.6 });
  until(sim, (s) => s.load.attached, 16);
  until(sim, () => false, 3);
  const s = sim.state;
  const raw = sim.log.filter((e) => e.name === 'collision').length;
  const counted = sim.log.filter((e) => e.name === 'collision.counted').length;
  rec('mission 1 hooks on without an alarm, even though the boxes touch',
    s.load.attached && s.mission.result === null && node(s) !== 'allStop' && counted === 0,
    `attached ${s.load.attached} result ${s.mission.result} node ${node(s)} raw collisions ${raw} counted ${counted}`);
}

// A second hook.attach on an already attached load must still be answered.
async function tReHookAnswered() {
  const sim = await startMission(0);
  answer(sim);
  const p = polarOf(m0.pickup.pos);
  park(sim, { slew: p.slew, radius: p.radius });
  until(sim, atNode('onHook'), 14);
  park(sim, { slew: p.slew, radius: p.radius, line: 42.85 });
  until(sim, (s) => s.load.attached, 14);
  until(sim, atNode('upEasy'), 10);
  // Re-enter the hook call with the load already on. This is what an ALL STOP
  // RETURN used to do, and it hung the director forever.
  sim.bus.emit('radio.stop', {});
  sim.bus.emit('radio.start', { script: 'radioCheck' });
  until(sim, atNode('onHook'), 12, (s) => { if (s.radio.ackTimer > 0) s.intent.reply = 0; });
  const moved = until(sim, (s) => node(s) !== 'onHook', 20);
  rec('a hook call with the load already on does not hang the radio',
    moved, `ended on ${node(sim.state)}`);
}

// Overshooting the hook window must be recoverable.
async function tHoistCorrection() {
  const sim = await startMission(0);
  answer(sim);
  const p = polarOf(m0.pickup.pos);
  park(sim, { slew: p.slew, radius: p.radius });
  until(sim, atNode('onHook'), 14);
  park(sim, { slew: p.slew, radius: p.radius, line: 44.2 });   // 1.4 m past it
  until(sim, () => false, 2);
  // Take a little rope back in, the way anyone would, stopping short of the hook
  // window itself: the window is line 42.2 to 43.4 here, ground re-calls for the
  // hook every few seconds while it waits, and a block corrected up into the
  // window gets picked up by one of those retries. That is the system working,
  // and it is not what this check is about, so the correction stops at 43.6.
  until(sim, (s) => s.crane.line < 43.6 || s.mission.result !== null, 12,
    (s) => { s.intent.hoist = 1; s.intent.range = 'I'; });
  sim.state.intent.hoist = 0;
  const corrected = sim.state.mission.result;
  rec('a small correction upward with an empty block is allowed',
    corrected === null, `result ${corrected} line ${sim.state.crane.line.toFixed(2)}`);
  // Hauling away is still a fail. Trolley the block clear of the load first, so
  // that the haul cannot pass through the hook window on its way up and get
  // rigged by a retry: with the block three metres off, nothing can attach, and
  // what is left is exactly the hoist budget this check is here for.
  until(sim, (s) => Math.abs(s.crane.radius - (p.radius + 3)) < 0.05, 20,
    (s) => { s.intent.trolley = s.crane.radius < p.radius + 3 ? 1 : -1; s.intent.range = 'I'; });
  sim.state.intent.trolley = 0;
  until(sim, (s) => s.mission.result !== null, 20,
    (s) => { s.intent.hoist = 1; s.intent.range = 'II'; });
  rec('hauling the empty block away still fails the lift',
    sim.state.mission.result === 'fail' &&
    sim.state.mission.failReason === 'hoist before on the hook',
    `result ${sim.state.mission.result} reason ${sim.state.mission.failReason}`);
}

// Rig a load onto the hook without flying the pickup. The sway interrupt and the
// grade both read sensors.loadSway, which is zero while the block is empty, so a
// swing test that never hooks on is testing nothing.
function rig(sim, id) {
  const m = MISSIONS[id === undefined ? sim.state.mission.id : id];
  sim.state.load.attached = true;
  sim.state.load.mass = m.load.mass;
  sim.state.load.size = [...m.load.size];
}

// Handlers must never land on the return stack.
async function tNoReplayedAlarm() {
  const sim = await startMission(0);
  answer(sim);
  const p = polarOf(m0.pickup.pos);
  park(sim, { slew: p.slew, radius: 18 });
  until(sim, atNode('toPickup'), 8);
  until(sim, () => false, 2);
  rig(sim);
  sim.state.load.swing.x = 0.2;                       // 11.5 deg
  until(sim, atNode('allStop'), 8);
  // Answer the ALL STOP over the top of the call - full duplex, so it is heard
  // and banked, not garbled - then E-stop out of it.
  until(sim, () => false, 0.2, (s) => { s.intent.reply = 0; });
  until(sim, () => false, 1.5);
  sim.state.intent.estop = true;
  until(sim, atNode('allStopClear'), 8);
  sim.state.intent.estop = false;
  park(sim, { slew: p.slew, radius: 18 });            // swing dead again
  const back = until(sim, (s) => node(s) === 'toPickup', 10);
  const quiet = until(sim, (s) => node(s) === 'allStop' || s.mission.result !== null, 12);
  rec('the script returns to the lift and does not replay the alarm',
    back && !quiet && sim.state.mission.result === null,
    `returned ${back}, spurious alarm ${quiet}, node ${node(sim.state)}, result ${sim.state.mission.result}`);
}

// The ALL STOP window cannot be pushed out by talking over it.
async function tAllStopNotPostponable() {
  const sim = await startMission(0);
  answer(sim);
  const p = polarOf(m0.pickup.pos);
  park(sim, { slew: p.slew, radius: 18 });
  until(sim, atNode('toPickup'), 8);
  until(sim, () => false, 2);
  rig(sim);
  sim.state.load.swing.x = 0.2;
  until(sim, atNode('allStop'), 8);
  // Hold the swing up and tap a reply every tick the strip will take one.
  const failed = until(sim, (s) => s.mission.result !== null, 25, (s) => {
    s.load.swing.x = 0.2;
    if (s.radio.tx === 'groundTx') s.intent.reply = 0;
  });
  rec('talking over ALL STOP does not postpone it',
    failed && sim.state.mission.failReason === 'ignored all stop',
    `result ${sim.state.mission.result} reason ${sim.state.mission.failReason}`);
}

// And the mushroom still clears it, mid transmission.
async function tAllStopCleared() {
  const sim = await startMission(0);
  answer(sim);
  const p = polarOf(m0.pickup.pos);
  park(sim, { slew: p.slew, radius: 18 });
  until(sim, atNode('toPickup'), 8);
  until(sim, () => false, 2);
  rig(sim);
  sim.state.load.swing.x = 0.2;
  until(sim, atNode('allStop'), 8);
  sim.state.intent.estop = true;
  const cleared = until(sim, atNode('allStopClear'), 6);
  rec('the E-stop clears an ALL STOP, mid call',
    cleared && sim.state.mission.result === null,
    `node ${node(sim.state)} result ${sim.state.mission.result}`);
}

// A digit with no button behind it is not a transmission.
async function tPhantomKey() {
  const sim = await startMission(0);
  until(sim, (s) => s.radio.tx === 'groundTx', 4);
  until(sim, () => false, 0.2, (s) => { s.intent.reply = 5; });   // key 6, 2 buttons on screen
  until(sim, () => false, 0.5);
  rec('a digit with no button on the strip is not a double',
    sim.state.radio.faults === 0 && node(sim.state) === 'check' && !sim.state.radio.garbled,
    `faults ${sim.state.radio.faults} node ${node(sim.state)} garbled ${sim.state.radio.garbled}`);
}
// A real collision must still end the lift, and must be announced. Setting a
// load back down on the truck is no longer one: standing on something is not
// colliding with it. Driving it into the side of the scaffold is.
async function tRealCollisionStillCounts() {
  const m2 = MISSIONS[2];
  const sim = await startMission(2);
  const p = polarOf(m2.pickup.pos);
  park(sim, { slew: p.slew, radius: p.radius, line: 43.8 - (m2.pickup.pos[1] + m2.load.size[1]) });
  sim.bus.emit('hook.attach', {});
  until(sim, (s) => s.load.attached, 4);
  park(sim, { slew: p.slew, radius: p.radius, line: 36 });      // lift clear, collisions arm
  until(sim, () => false, 1.5);
  const cleanSoFar = sim.state.mission.result === null;
  const scaff = polarOf([40, 0, -4]);
  const ended = until(sim, (s) => s.mission.result !== null, 12, () => {
    // bottom at 5 m: inside the scaffold volume (0..12), nowhere near its top
    park(sim, { slew: scaff.slew, radius: scaff.radius, line: 43.8 - (5 + m2.load.size[1]) });
  });
  const counted = sim.log.filter((e) => e.name === 'collision.counted').length;
  rec('driving the load into the side of the scaffold fails the lift',
    cleanSoFar && ended && sim.state.mission.failReason === 'collision' && counted > 0,
    `result ${sim.state.mission.result} reason ${sim.state.mission.failReason} counted ${counted}`);
}

// Alarm, answer it, let the RETURN out of allStopClear run, THEN hit the
// mushroom. RETURN is the one thing in the director that can leave it with no
// node, and the alarm is the only path that uses it.
async function tReturnCannotKillRadio() {
  const sim = await startMission(0);
  answer(sim);
  const p = polarOf(m0.pickup.pos);
  park(sim, { slew: p.slew, radius: 18 });
  until(sim, atNode('toPickup'), 8);
  until(sim, () => false, 2);
  rig(sim);
  sim.state.load.swing.x = 0.2;
  until(sim, atNode('allStop'), 8);
  until(sim, () => false, 0.2, (s) => { s.intent.reply = 0; });   // answer over the alarm
  sim.state.intent.estop = true;
  until(sim, atNode('allStopClear'), 6);
  until(sim, (s) => node(s) !== 'allStopClear', 8);               // let its RETURN run
  sim.state.intent.estop = false;
  until(sim, () => false, 0.5);
  sim.state.intent.estop = true;                                  // the mushroom again
  until(sim, () => false, 4);
  const s = sim.state;
  const alive = s.radio.node !== null && s.radio.script !== null;
  rec('the mushroom after a RETURN out of the alarm does not kill the radio',
    alive, `node ${s.radio.node} script ${s.radio.script} result ${s.mission.result}`);
  // and the lift must still be able to end
  sim.state.intent.estop = false;
  park(sim, { slew: p.slew, radius: p.radius });   // fly to the pickup as told
  const resolves = until(sim, (s2) => s2.mission.result !== null || node(s2) === 'onHook', 25,
    () => park(sim, { slew: p.slew, radius: p.radius }));
  rec('and the lift can still reach an ending',
    resolves, `node ${node(sim.state)} result ${sim.state.mission.result}`);
}

// Mission 1 flown exactly as ground calls it: swing off the truck without
// hoisting clear first. This used to latch a collision silently and fail at the
// set-down, minutes later.
async function tMission1NoSilentCollision() {
  const sim = await startMission(1);
  answer(sim);
  until(sim, atNode('watchTruck'), 10);
  answer(sim);
  const p = polarOf(m1.pickup.pos);
  const l = polarOf(m1.landing.pos);
  park(sim, { slew: p.slew, radius: p.radius });
  until(sim, atNode('onHook'), 16);
  park(sim, { slew: p.slew, radius: p.radius, line: 41.6 });   // low half of the window
  until(sim, (s) => s.load.attached, 16);
  until(sim, atNode('upEasy'), 10);
  answer(sim);
  // Slew away at bed height, no hoist, exactly as told.
  for (let i = 0; i < 40; i += 1) {
    const t = i / 39;
    park(sim, { slew: p.slew + (l.slew - p.slew) * t, radius: p.radius, line: 41.6 });
    until(sim, () => false, 0.15);
  }
  rec('mission 1 does not latch a collision on the bed it was picked from',
    sim.state.mission.hadCollision === false && sim.state.mission.result === null,
    `hadCollision ${sim.state.mission.hadCollision} result ${sim.state.mission.result} reason ${sim.state.mission.failReason}`);
}

// Paying rope back out clears the anti-snatch budget.
async function tHoistBudgetResets() {
  const sim = await startMission(0);
  answer(sim);
  const p = polarOf(m0.pickup.pos);
  park(sim, { slew: p.slew, radius: p.radius });
  until(sim, atNode('onHook'), 14);
  park(sim, { slew: p.slew, radius: p.radius, line: 44.4 });
  until(sim, () => false, 2);
  // Three corrections of the size ground asks for, each followed by lowering
  // again. Under a lifetime budget the second one ended the lift.
  for (let i = 0; i < 3; i += 1) {
    until(sim, (s) => s.crane.line < 42.9 || s.mission.result !== null, 10,
      (s) => { s.intent.hoist = 1; s.intent.range = 'I'; });
    until(sim, (s) => s.crane.line > 44.2 || s.mission.result !== null, 10,
      (s) => { s.intent.hoist = -1; s.intent.range = 'I'; });
    if (sim.state.mission.result !== null) break;
  }
  sim.state.intent.hoist = 0;
  rec('repeated up-and-down corrections do not spend a lifetime budget',
    sim.state.mission.result === null,
    `result ${sim.state.mission.result} reason ${sim.state.mission.failReason}`);
}

// A guide call carries one button and the contract says guide calls never fault.
async function tGuideSayAgainFree() {
  const sim = await startMission(0);
  answer(sim);
  const p = polarOf(m0.pickup.pos);
  park(sim, { slew: p.slew, radius: 14 });
  until(sim, atNode('toPickup'), 8);
  // Press the only button on screen, repeatedly, through several call cycles.
  until(sim, () => false, 10, (s) => {
    park(sim, { slew: p.slew, radius: 14 });
    if (s.time.frame % 30 === 0) s.intent.reply = 0;
  });
  rec('Say again under a guide call is free, on the air or not',
    sim.state.radio.faults === 0 && node(sim.state) === 'toPickup',
    `faults ${sim.state.radio.faults} node ${node(sim.state)}`);
}

// An empty block must fly like an empty block.
async function tEmptyBlockAccel() {
  const a = await startMission(0);
  const b = await makeSim();
  b.state.phase = 'playing';
  const drive = (s) => { s.intent.slew = 1; s.intent.trolley = 1; s.intent.range = 'II'; };
  until(a, () => false, 1, drive);
  until(b, () => false, 1, drive);
  const loaded = a.state.crane.slewVel;
  const empty = b.state.crane.slewVel;
  rec('an empty block flies empty, before anything is hooked on',
    Math.abs(loaded - empty) < 1e-6,
    `mission 0 started ${loaded.toFixed(4)} vs no mission ${empty.toFixed(4)}`);
}


// ------------------------------------------------- phase 4: more than one floor

// Landing on a deck volume is not colliding with it.
async function tRestingIsNotColliding() {
  const m2 = MISSIONS[2];
  const sim = await startMission(2);
  const p = polarOf(m2.pickup.pos);
  park(sim, { slew: p.slew, radius: p.radius, line: 43.8 - (m2.pickup.pos[1] + m2.load.size[1]) });
  sim.bus.emit('hook.attach', {});
  until(sim, (s) => s.load.attached, 4);
  const l = polarOf(m2.landing.pos);
  park(sim, { slew: l.slew, radius: l.radius, line: 26 });       // high and clear
  until(sim, () => false, 1.5);
  // Set it on the scaffold roof and keep paying rope out well past contact.
  until(sim, (s) => s.sensors.slack || s.mission.result !== null, 14, (s) => {
    park(sim, { slew: l.slew, radius: l.radius, line: Math.min(33, s.crane.line + 0.05) });
  });
  const s = sim.state;
  rec('a load set down on the scaffold rests on it and does not collide with it',
    s.sensors.slack && s.mission.result === null &&
    Math.abs(s.load.bottomY - m2.landing.pos[1]) < 0.4,
    `slack ${s.sensors.slack} result ${s.mission.result} reason ${s.mission.failReason} bottom ${s.load.bottomY.toFixed(2)} want ${m2.landing.pos[1]}`);
}

// The shaft is reachable, and cannot be faked from deck level.
async function tShaftReachable() {
  const m3 = MISSIONS[3];
  const sim = await startMission(3);
  const p = polarOf(m3.pickup.pos);
  park(sim, { slew: p.slew, radius: p.radius, line: 43.8 - (m3.pickup.pos[1] + m3.load.size[1]) });
  sim.bus.emit('hook.attach', {});
  until(sim, (s) => s.load.attached, 4);
  const l = polarOf(m3.landing.pos);
  // Hover over the mouth at deck level. Horizontally this is the zone.
  park(sim, { slew: l.slew, radius: l.radius, line: 43.8 - (0 + m3.load.size[1]) });
  until(sim, () => false, 1.5);
  const fakedAtDeck = sim.log.filter((e) => e.name === 'load.inZone').length;
  // Now actually go down the hole.
  until(sim, (s) => s.sensors.slack || s.mission.result !== null, 25, (s) => {
    park(sim, { slew: l.slew, radius: l.radius, line: Math.min(53, s.crane.line + 0.05) });
  });
  const s = sim.state;
  const reached = sim.log.filter((e) => e.name === 'load.inZone').length;
  rec('the shaft cannot be claimed from deck level, and can be reached',
    fakedAtDeck === 0 && reached > 0 && s.mission.result === null &&
    Math.abs(s.load.bottomY - m3.landing.pos[1]) < 0.4,
    `inZone at deck ${fakedAtDeck}, after descent ${reached}, bottom ${s.load.bottomY.toFixed(2)} want ${m3.landing.pos[1]}, result ${s.mission.result}`);
}

// A load flown past a volume at mid height must not be teleported onto its roof.
async function tNoTeleportOntoRoof() {
  const m2 = MISSIONS[2];
  const sim = await startMission(2);
  const p = polarOf(m2.pickup.pos);
  park(sim, { slew: p.slew, radius: p.radius, line: 43.8 - (m2.pickup.pos[1] + m2.load.size[1]) });
  sim.bus.emit('hook.attach', {});
  until(sim, (s) => s.load.attached, 4);
  park(sim, { slew: p.slew, radius: p.radius, line: 36 });
  until(sim, () => false, 1);
  const scaff = polarOf([40, 0, -4]);
  let lifted = false;
  until(sim, (s) => s.mission.result !== null, 6, (s) => {
    park(sim, { slew: scaff.slew, radius: scaff.radius, line: 43.8 - (5 + m2.load.size[1]) });
    if (s.load.bottomY > 8) lifted = true;
  });
  rec('a load at mid height over the scaffold is not lifted onto its roof',
    !lifted, `load bottom ended at ${sim.state.load.bottomY.toFixed(2)}, wanted about 5`);
}


// An autopilot that flies any mission the way ground calls it: answer every
// call, follow every guide, hook when told, lower when told. It knows nothing
// mission-specific beyond the data, so a mission it cannot fly is a real
// finding about that mission and not about the test.
async function flyMission(id, budget = 240, opts = {}) {
  const m = MISSIONS.find((x) => x.id === id);
  const sim = await startMission(id);
  let sayAgainSent = false;
  const pick = polarOf(m.pickup.pos);
  const land = polarOf(m.landing.pos);
  const TOP = 43.8;                                   // cabHeight + hookDrop
  const hookLine = TOP - (m.pickup.pos[1] + m.load.size[1]) + 0.05;
  const restLine = TOP - (m.landing.pos[1] + m.load.size[1]) + 0.30;
  const flyLine = Math.max(6, TOP - (Math.max(m.landing.pos[1], m.pickup.pos[1]) + m.load.size[1]) - 5);
  let answered = null;
  let descending = false;

  until(sim, (s) => s.mission.result !== null, budget, (s) => {
    const n = s.radio.node;
    const nd = n ? null : null;
    // Answer each call once, as soon as its window opens.
    if (s.radio.ackTimer > 0 && answered !== n) { s.intent.reply = 0; answered = n; }
    // Optionally press Say again once, from inside the named node's wait gate:
    // after its window has closed, so this is the gate case and not the ack one.
    else if (opts.sayAgainAt && !sayAgainSent && n === opts.sayAgainAt &&
             s.radio.ackTimer === 0 && s.radio.tx === 'idle' && answered === n) {
      const i = s.radio.replies.indexOf('Say again');
      if (i >= 0) { s.intent.reply = i; sayAgainSent = true; }
    }
    // Key the mic over ground's sign off, which is what a player saying copy does.
    if (opts.keyDuringSignOff && n === 'complete') { s.intent.ptt = true; s.intent.reply = 0; }
    if (n === 'toLanding' || descending) descending = descending || n !== 'toLanding';
    const guide = n && (n === 'toPickup' || n === 'toLanding');
    const target = n === 'toLanding' ? land : pick;
    if (!s.load.attached) {
      // Get over the pickup, then put the block in the hook window.
      park(sim, { slew: pick.slew, radius: pick.radius });
      if (n === 'onHook') park(sim, { slew: pick.slew, radius: pick.radius, line: hookLine });
      return;
    }
    if (n === 'toPickup' || n === 'onHook' || n === 'upEasy') {
      park(sim, { slew: pick.slew, radius: pick.radius, line: Math.min(s.crane.line, flyLine) });
      return;
    }
    // Attached and past the pickup: fly to the landing, then lower onto it.
    if (n === 'toLanding') {
      park(sim, { slew: land.slew, radius: land.radius, line: Math.min(s.crane.line, flyLine) });
      return;
    }
    park(sim, {
      slew: land.slew, radius: land.radius,
      line: Math.min(restLine, s.crane.line + 0.05)
    });
  });
  return sim;
}

async function tFlyScaffold() {
  const sim = await flyMission(2);
  const s = sim.state;
  rec('mission 2, the scaffold landing, can be flown to a win',
    s.mission.result === 'win',
    `result ${s.mission.result} reason ${s.mission.failReason} node ${s.radio.node} bottom ${s.load.bottomY.toFixed(2)} faults ${s.radio.faults}`);
}

async function tFlyBlindShaft() {
  const sim = await flyMission(3);
  const s = sim.state;
  rec('mission 3, the blind shaft, can be flown to a win',
    s.mission.result === 'win',
    `result ${s.mission.result} reason ${s.mission.failReason} node ${s.radio.node} bottom ${s.load.bottomY.toFixed(2)} faults ${s.radio.faults}`);
}

async function tFlyTruck() {
  const sim = await flyMission(1);
  const s = sim.state;
  rec('mission 1, the truck unload, can be flown to a win',
    s.mission.result === 'win',
    `result ${s.mission.result} reason ${s.mission.failReason} node ${s.radio.node} faults ${s.radio.faults}`);
}


// ------------------------------------------------------ phase 4: score and save

async function tGradeRubric() {
  // A clean flight of mission 0 should be an A; the scorer is fed the scruffy
  // case directly, because manufacturing three demerits by flying is slow.
  const sim = await flyMission(0);
  const clean = sim.state.scoring.grade;
  const scruffy = await startMission(0);
  scruffy.state.scoring.maxSway = 7 * Math.PI / 180;      // swinging hard: 2
  scruffy.state.scoring.radioFaults = 1;                  // a radio fault:  1
  scruffy.state.mission.maxCapacityPct = 95;              // over ninety:    1
  scruffy.state.mission.landedAt = [0, 0, 0];
  scruffy.state.mission.landingPos = [0, 0, 0];
  scruffy.state.mission.landingTol = 0.4;
  scruffy.state.mission.result = 'win';
  scruffy.bus.emit('lift.win', { id: 0 });
  rec('a clean lift grades A and a scruffy one grades D',
    clean === 'A' && scruffy.state.scoring.grade === 'D',
    `clean ${clean}, scruffy ${scruffy.state.scoring.grade} from ${JSON.stringify(scruffy.state.scoring.demerits.map((d) => d.why))}`);
  rec('the card can say what cost the grade',
    sim.state.scoring.demerits.length === 0 && scruffy.state.scoring.demerits.length === 3,
    `clean ${sim.state.scoring.demerits.length} lines, scruffy ${scruffy.state.scoring.demerits.length}`);
}

async function tFlowAndResume() {
  const sim = await flyMission(0);
  const afterWin = sim.modules.missions.nextMissionId(sim.ctx);
  const f = await startMission(2);
  f.state.mission.result = 'fail';
  const afterFail = f.modules.missions.nextMissionId(f.ctx);
  const last = await startMission(3);
  last.state.mission.result = 'win';
  const afterLast = last.modules.missions.nextMissionId(last.ctx);
  rec('the flow is 0 to 3, a fail retries, and the last mission does not run off the end',
    afterWin === 1 && afterFail === 2 && afterLast === 3,
    `after win on 0 -> ${afterWin}, after fail on 2 -> ${afterFail}, after win on 3 -> ${afterLast}`);
}

async function tRefreshKeepsProgress() {
  // The phase table's own done condition. Win a lift, then boot a fresh sim
  // against the same storage, which is exactly what a refresh is.
  globalThis.localStorage && globalThis.localStorage.clear();
  const first = await flyMission(1);
  const earned = [...(first.state.scoring.earned || [])];
  const wonAt = first.state.scoring.elapsed;

  const second = await makeSim();
  const p = second.state.progress;
  rec('a refresh keeps achievements, the best and the furthest mission',
    earned.length > 0 && Object.keys(p.achievements).length === earned.length &&
    p.best[1] && Math.abs(p.best[1].elapsed - wonAt) < 0.01 && p.furthest >= 1,
    `earned ${JSON.stringify(earned)}, restored ${JSON.stringify(Object.keys(p.achievements))}, best ${JSON.stringify(p.best[1])}, furthest ${p.furthest}`);
  rec('and it resumes at the furthest mission reached',
    second.modules.missions.firstUnfinished(second.ctx) === p.furthest,
    `resume at ${second.modules.missions.firstUnfinished(second.ctx)}, furthest ${p.furthest}`);
}

async function tAchievementOnce() {
  globalThis.localStorage && globalThis.localStorage.clear();
  const a = await flyMission(0);
  const firstRun = [...(a.state.scoring.earned || [])];
  const b = await flyMission(0);
  const secondRun = [...(b.state.scoring.earned || [])];
  rec('an achievement is awarded once and never again',
    firstRun.includes('Radio Check') && !secondRun.includes('Radio Check'),
    `first ${JSON.stringify(firstRun)}, second ${JSON.stringify(secondRun)}`);
  rec('and the hooks counter survives a reload',
    b.state.progress.hooks >= 2, `hooks ${b.state.progress.hooks}`);
}

async function tSaveSurvivesGarbage() {
  const junk = [
    ['no v', '{"data":{"0":{"elapsed":5}}}'],
    ['wrong v', '{"v":99,"data":{"0":{"elapsed":5}}}'],
    ['truncated', '{"v":1,"data":{"0":{"elap'],
    ['null', 'null'],
    ['an array', '[1,2,3]'],
    ['NaN time', '{"v":1,"data":{"0":{"elapsed":null}}}'],
    ['not an object', '"hello"'],
    ['bad key', '{"v":1,"data":{"banana":{"elapsed":5}}}']
  ];
  let survived = 0;
  for (const [label, raw] of junk) {
    globalThis.localStorage.clear();
    globalThis.localStorage.setItem('craneCab_hi', raw);
    globalThis.localStorage.setItem('craneCab_ach', raw);
    globalThis.localStorage.setItem('craneCab_settings', raw);
    try {
      const sim = await makeSim();
      const p = sim.state.progress;
      const ok = p && typeof p.best === 'object' && typeof p.achievements === 'object' &&
        Object.keys(p.best).length === 0 && sim.state.settings.units === 'imperial';
      if (ok) survived += 1; else console.log(`   ${label} loaded something it should not have`);
    } catch (e) { console.log(`   ${label} threw: ${e.message}`); }
  }
  globalThis.localStorage.clear();
  rec('every shape of garbage in localStorage degrades to the defaults',
    survived === junk.length, `${survived} of ${junk.length} handled`);
}


async function tGusts() {
  const gusty = await startMission(2);      // the only mission with a gust
  const steady = await startMission(1);
  const gs = [];
  const ss = [];
  until(gusty, () => false, 0.05);      // one tick, so sensors has run once
  until(steady, () => false, 0.05);
  until(gusty, () => false, 30, (s) => gs.push(s.sensors.wind));
  until(steady, () => false, 30, (s) => ss.push(s.sensors.wind));
  const spread = (a) => Math.max(...a) - Math.min(...a);
  const m2 = MISSIONS[2];
  rec('the gusty mission moves the anemometer and the steady ones do not',
    spread(gs) > 1.0 && spread(gs) <= m2.wind.gust + 0.01 && spread(ss) < 0.001 &&
    Math.min(...gs) >= m2.wind.base - 0.01,
    `mission 2 wind ${Math.min(...gs).toFixed(2)}..${Math.max(...gs).toFixed(2)} m/s (base ${m2.wind.base}, gust ${m2.wind.gust}), mission 1 spread ${spread(ss).toFixed(4)}`);

  // Deterministic: a retry is the same weather, not a different mission. This has
  // to be a retry inside a session that has already been running, which is what
  // the end card's button does. Booting a fresh sim starts the clock at zero and
  // proved nothing: the gust was seeded off session time, so the real retry was a
  // different mission every attempt and the weather was re-rollable by failing.
  const rs = [];
  gusty.modules.missions.start(gusty.ctx, 2);
  gusty.state.phase = 'playing';
  until(gusty, () => false, 0.05);
  until(gusty, () => false, 30, (s) => rs.push(s.sensors.wind));
  const same = rs.every((v, i) => Math.abs(v - gs[i]) < 1e-9);
  rec('and the same mission blows the same way on a retry',
    same, same ? `identical, ${rs.length} samples from t=${gusty.state.time.t.toFixed(1)}` : 'diverged');
}


// ------------------------------------------------ phase 4b: the fourth bug pass

// Fly on the controls, not by teleporting. park() zeroes the swing every tick,
// which is exactly why the suite could not see any of the next three.
function flyControls(sim, seconds, per) {
  return until(sim, () => false, seconds, per);
}

// An empty hook block swings: a pendulum's angle under a horizontal acceleration
// does not care about mass, so slewing out at range II leans it seven to ten
// degrees. Ground does not call ALL STOP on a block with nothing on it, and it
// used to: the first thing a player did on every mission raised a phantom alarm
// and failed the lift in about ten seconds.
async function tEmptySwingIsNotAnAllStop() {
  let worst = 0, failed = null, alarms = 0;
  for (const id of [0, 1, 2, 3]) {
    const sim = await startMission(id);
    sim.bus.on('radio.allStop', () => { alarms += 1; });
    // Trolley out first. The drive on the swing is radius times slew accel, so
    // the block leans hardest at the trolley stop: this is what a player does in
    // the first twenty seconds of every lift, and it used to raise the alarm.
    flyControls(sim, 60, (s) => {
      s.intent.range = 'II';
      s.intent.trolley = s.crane.radius < 50 ? 1 : 0;
      s.intent.slew = s.crane.radius < 50 ? 0 : 1;
      if (s.sensors.swayAngle > worst) worst = s.sensors.swayAngle;
    });
    if (sim.state.mission.result !== null) failed = `${id}: ${sim.state.mission.failReason}`;
  }
  rec('slewing an empty block hard is not an ALL STOP and does not fail the lift',
    alarms === 0 && failed === null && worst > 12 * Math.PI / 180,
    `peak block sway ${(worst * 180 / Math.PI).toFixed(1)} deg, alarms ${alarms}, ${failed || 'no fails'}`);
}

// And the same swing must not be charged to the grade or eat the achievements.
async function tEmptySwingIsNotCharged() {
  const sim = await startMission(0);
  let peak = 0;
  flyControls(sim, 20, (s) => {
    s.intent.range = 'II';
    s.intent.slew = 1;
    if (s.sensors.swayAngle > peak) peak = s.sensors.swayAngle;
  });
  const s = sim.state;
  rec('an empty block swinging does not go on the operator\'s card',
    peak > 3 * Math.PI / 180 && s.scoring.maxSway === 0 && s.mission.maxSway === 0,
    `block peaked at ${(peak * 180 / Math.PI).toFixed(1)} deg, charged ${(s.scoring.maxSway * 180 / Math.PI).toFixed(2)} deg`);
}

// The rope has a stop. Holding "down" after touchdown is what "down easy"
// invites, and the block and rope used to carry on through the landed load,
// through the scaffold and twenty six metres under the deck, with the hook
// height gauge negative the whole way.
async function tRopeStops() {
  const lows = [];
  for (const id of [0, 1, 2, 3]) {
    const sim = await startMission(id);
    flyControls(sim, 90, (s) => { s.intent.range = 'II'; s.intent.hoist = -1; });
    lows.push(+(43.8 - sim.state.crane.line).toFixed(2));
  }
  rec('paying rope out cannot drive the empty block through the deck',
    lows.every((y) => y >= -0.01 && y <= 0.01),
    `block bottom ended at ${JSON.stringify(lows)}, want 0`);
}

async function tRopeStopsOnALandedLoad() {
  const m2 = MISSIONS[2];
  const sim = await startMission(2);
  const s = sim.state;
  rig(sim, 2);
  const land = polarOf(m2.landing.pos);
  park(sim, { slew: land.slew, radius: land.radius, line: 43.8 - (12 + m2.load.size[1]) - 0.05 });
  flyControls(sim, 60, (st) => { st.intent.range = 'II'; st.intent.hoist = -1; });
  const blockBottom = 43.8 - s.crane.line;
  rec('and it cannot drive the block down through a load that is already resting',
    Math.abs(s.load.bottomY - 12) < 0.01 && blockBottom > 12 - 0.5,
    `load bottom ${s.load.bottomY.toFixed(2)} (want 12), block bottom ${blockBottom.toFixed(2)}, hook gauge ${s.sensors.hookHeight.toFixed(2)}`);
}

// The top of every volume was soft: sensors excluded the collision over a wider
// band than missions granted support over, leaving a strip that was neither
// solid nor standable. A load could be trolleyed straight through a parapet.
async function tNoSoftBandOnTop() {
  const m2 = MISSIONS[2];
  const roof = 12;
  const rows = [];
  for (const drop of [0.05, 0.15, 0.20, 0.30, 0.34]) {
    const sim = await startMission(2);
    const s = sim.state;
    rig(sim, 2);
    s.crane.slew = Math.atan2(-4, 40);
    s.crane.radius = 33;
    s.crane.line = 43.8 - ((roof - drop) + m2.load.size[1]);
    let hit = false;
    let climbed = false;
    flyControls(sim, 0.05);                 // one tick, so bottomY is real and not the default
    const from = s.load.bottomY;
    sim.bus.on('collision', () => { hit = true; });
    flyControls(sim, 40, (st) => {
      st.intent.range = 'II';
      st.intent.trolley = st.crane.radius < 47 ? 1 : 0;
      if (st.load.bottomY > from + 0.02) climbed = true;
    });
    // Either it hit the scaffold or it was picked up onto the roof on the way
    // across. What it may not do is sail through untouched at its own height.
    rows.push({ drop, hit, landed: climbed, end: +s.load.bottomY.toFixed(2) });
  }
  const through = rows.filter((r) => !r.hit && !r.landed);
  rec('the top of a deck volume is solid all the way up, with no soft band',
    through.length === 0,
    through.length ? `passed through at ${JSON.stringify(through)}` : rows.map((r) => `${r.drop}:${r.hit ? 'hit' : 'stood'}`).join(' '));
}

// A load whose centre clears a volume but whose body does not used to hang a
// third of itself inside the parapet, reported as neither a collision nor a
// landing, because the surface test sampled one point.
async function tFootprintNotAPoint() {
  const m2 = MISSIONS[2];
  const sim = await startMission(2);
  const s = sim.state;
  rig(sim, 2);
  // Centre just outside the scaffold's west face (x 37), body lapping over it.
  const x = 37 - 0.4, z = -4;
  s.crane.slew = Math.atan2(z, x);
  s.crane.radius = Math.hypot(x, z);
  s.crane.line = 43.8 - (11.8 + m2.load.size[1]);
  let hit = false;
  sim.bus.on('collision', () => { hit = true; });
  flyControls(sim, 2);
  rec('a load lapping a volume its centre misses is a collision, not a hover',
    hit || Math.abs(s.load.bottomY - 12) < 0.01,
    `centre x ${x}, bottom ${s.load.bottomY.toFixed(2)}, collision ${hit}`);
}

// The anti-snatch budget ratcheted: paying rope out cleared it outright, so haul
// and jog took fifty four metres in with an empty hook and no fail.
async function tHoistBudgetCannotRatchet() {
  const sim = await startMission(0);
  const s = sim.state;
  sim.bus.emit('hook.attach', {});
  flyControls(sim, 0.1);
  const start = s.crane.line;
  for (let c = 0; c < 20 && s.mission.result === null; c += 1) {
    const up = s.crane.line - 1.4;
    flyControls(sim, 20, (st) => { st.intent.range = 'II'; st.intent.hoist = st.crane.line > up ? 1 : 0; });
    const down = s.crane.line + 0.1;
    flyControls(sim, 10, (st) => { st.intent.range = 'micro'; st.intent.hoist = st.crane.line < down ? -1 : 0; });
  }
  rec('the hoist budget cannot be ratcheted by jogging back down',
    s.mission.result === 'fail' && s.mission.failReason === 'hoist before on the hook' &&
    start - s.crane.line < 4,
    `hauled ${(start - s.crane.line).toFixed(2)} m before ${s.mission.failReason || 'nothing'}`);
}

// And it must not fail an honest correction. Releasing the control at the target
// still coasts the drum most of a metre at range II, and charging that made the
// real allowance about 1.06 m of a nominal 2.0.
async function tHoistBudgetAllowsACorrection() {
  const sim = await startMission(0);
  const s = sim.state;
  sim.bus.emit('hook.attach', {});
  flyControls(sim, 0.1);
  const target = s.crane.line - 1.5;
  flyControls(sim, 30, (st) => { st.intent.range = 'II'; st.intent.hoist = st.crane.line > target ? 1 : 0; });
  flyControls(sim, 5, (st) => { st.intent.hoist = 0; });
  rec('and it still allows one honest metre and a half of correction',
    s.mission.result === null,
    `result ${s.mission.result} ${s.mission.failReason || ''}, moved ${(43.8 - s.crane.line).toFixed(2)}`);
}

// Say again is documented as never a fault. Inside a waitFor gate it used to
// re-open the reply window on a node the operator had already answered, and the
// lapsed window charged a fault and re-sent the call, forever.
async function tSayAgainInAGateIsFree() {
  const sim = await flyMission(0, 240, {
    sayAgainAt: 'downEasy'
  });
  const s = sim.state;
  rec('Say again inside a wait gate is free, and does not turn into a fault loop',
    s.radio.faults === 0 && s.mission.result === 'win',
    `faults ${s.radio.faults}, result ${s.mission.result} ${s.mission.failReason || ''}`);
}

// The unhook lands inside radio.update on one tick and missions.update runs
// before radio.update on the next, so winning immediately stopped the script one
// node short and "Good lift. Standing by." was never once spoken.
async function tGroundSignsOff() {
  const missing = [];
  for (const id of [0, 1, 2, 3]) {
    const sim = await flyMission(id);
    const said = sim.log.some((e) => e.name === 'radio.say' && e.payload && e.payload.key === 'GOOD_LIFT');
    if (sim.state.mission.result !== 'win' || !said) missing.push(id);
  }
  rec('ground gets its sign off in before the lift is over',
    missing.length === 0, missing.length ? `no GOOD_LIFT on ${missing}` : 'all four');
}

// The guide gated on the load position, swing included, but corrected the jib.
// Once the jib was parked and only the swing held the gate shut, the swinging
// load crossed the hold band twice a period and ground alternated "Trolley out"
// and "Hold, hold, hold." every three seconds over an eight millimetre error.
async function tGuideDoesNotWhipsaw() {
  const sim = await startMission(0);
  const s = sim.state;
  answer(sim);
  until(sim, atNode('toPickup'), 8);
  const p = polarOf(m0.pickup.pos);
  const calls = [];
  sim.bus.on('radio.say', (e) => { if (s.radio.node === 'toPickup') calls.push(e.key); });
  // Jib exactly on the mark, load swinging enough to hold the gate shut.
  flyControls(sim, 30, (st) => {
    st.crane.slew = p.slew; st.crane.slewVel = 0;
    st.crane.radius = p.radius; st.crane.radiusVel = 0;
    st.load.swing.x = 0.05 * Math.sin(st.time.t * 2);
    st.load.swing.vx = 0.10 * Math.cos(st.time.t * 2);
  });
  const corrections = calls.filter((k) => k && k !== 'HOLD');
  rec('a guide with the jib on the mark says hold once and then stays off the air',
    corrections.length === 0 && calls.filter((k) => k === 'HOLD').length <= 1,
    `calls over 30 s ${JSON.stringify(calls)}`);
}

// The other half of that, and the half the first version of the fix broke. Being
// quiet on the mark is right; being quiet while the operator is short of it is a
// hang, because a guide node has no timeout and nothing else can advance it.
async function tGuideKeepsTalkingWhenShort() {
  const sim = await startMission(0);
  const s = sim.state;
  answer(sim);
  until(sim, atNode('toPickup'), 8);
  const p = polarOf(m0.pickup.pos);
  const calls = [];
  sim.bus.on('radio.say', (e) => { if (s.radio.node === 'toPickup') calls.push(e.key); });
  // Two metres short of a one metre gate: well inside the old silent band.
  flyControls(sim, 30, (st) => {
    st.crane.slew = p.slew; st.crane.slewVel = 0;
    st.crane.radius = p.radius - 2.0; st.crane.radiusVel = 0;
    st.load.swing.x = 0; st.load.swing.y = 0; st.load.swing.vx = 0; st.load.swing.vy = 0;
  });
  const corrections = calls.filter((k) => k && k !== 'HOLD');
  rec('and it keeps talking while the operator is still short of the mark',
    corrections.length >= 5,
    `${corrections.length} corrections in 30 s, calls ${JSON.stringify(calls.slice(0, 6))}`);
}

// A landed load nudged off the volume it is standing on and back onto it must
// not become a collision. The rope stop parks the block so the load's unclamped
// bottom sits its slack below the face; when that slack was wider than the
// support band, leaving the footprint for one tick put the load in a state that
// read as neither standing nor clear, and nothing could haul it back.
async function tLandedLoadCanBeNudged() {
  const m2 = MISSIONS[2];
  const sim = await startMission(2);
  const s = sim.state;
  rig(sim, 2);
  const land = polarOf(m2.landing.pos);
  park(sim, { slew: land.slew, radius: land.radius, line: 43.8 - (12 + m2.load.size[1]) - 0.2 });
  // Settle it onto the roof and pay out until the line reads slack.
  flyControls(sim, 20, (st) => { st.intent.range = 'micro'; st.intent.hoist = -1; });
  const settled = s.load.bottomY;
  const wasSlack = s.sensors.slack;
  let hit = false;
  sim.bus.on('collision', () => { hit = true; });
  // Trolley clear of the 6 m scaffold plan and back again, rope untouched. In
  // towards the mast, because out past the chart is an LMI lockout, which is a
  // different rule and not what this is testing.
  const back = s.crane.radius;
  flyControls(sim, 40, (st) => { st.intent.hoist = 0; st.intent.range = 'I'; st.intent.trolley = st.crane.radius > back - 8 ? -1 : 0; });
  flyControls(sim, 40, (st) => { st.intent.hoist = 0; st.intent.range = 'I'; st.intent.trolley = st.crane.radius < back ? 1 : 0; });
  rec('a load set down on a deck can be nudged off it and back without a collision',
    Math.abs(settled - 12) < 0.01 && wasSlack && !hit && s.mission.result === null,
    `settled ${settled.toFixed(3)} slack ${wasSlack}, collision ${hit}, result ${s.mission.result} ${s.mission.failReason || ''}`);
}

// Ground's sign off asks nothing and waits for nothing, and the lift is already
// won when it goes out. Keying the mic over it used to cost a grade letter.
async function tSignOffIsNotAFaultSurface() {
  const quiet = await flyMission(0);
  const noisy = await flyMission(0, 240, { keyDuringSignOff: true });
  rec('saying copy over ground\'s sign off does not cost a grade',
    quiet.state.mission.result === 'win' && noisy.state.mission.result === 'win' &&
    noisy.state.radio.faults === 0 && noisy.state.scoring.grade === quiet.state.scoring.grade,
    `quiet ${quiet.state.scoring.grade} faults ${quiet.state.radio.faults}, keyed ${noisy.state.scoring.grade} faults ${noisy.state.radio.faults}`);
}

// The retry that ground uses when the hook is not ready is decremented inside a
// transmission but can only be fired outside one, so a retry that expired mid
// call was lost and the lift stranded at "on the hook" with no way out. It was a
// quarter of all fuzzed runs.
async function tHookRetryIsNeverLost() {
  const stranded = [];
  for (const id of [0, 1, 2, 3]) {
    const m = MISSIONS.find((x) => x.id === id);
    const sim = await startMission(id);
    const s = sim.state;
    const pick = polarOf(m.pickup.pos);
    // Sit at the pickup but a long way above the hook window, so every hook
    // call comes back "not ready" and ground has to keep retrying.
    park(sim, { slew: pick.slew, radius: pick.radius, line: 20 });
    let calls = 0;
    sim.bus.on('hook.attach', () => { calls += 1; });
    until(sim, (st) => st.radio.node === 'onHook', 40, (st) => {
      if (st.radio.ackTimer > 0) st.intent.reply = 0;
    });
    const seen = calls;
    // Press Say again while the retry is running. That puts ground back on the
    // air for its full transmission, and a retry with less than that left on it
    // used to expire in there, where nothing can fire it.
    // The retry is 4 s and a transmission is 1.6 s of it, so about a second and a
    // half after ground stops talking there is less than one transmission left on
    // the timer. Press Say again there and the whole remainder used to drain
    // inside the re-say, where nothing can fire it.
    let armed = false;
    let since = 0;
    let pressedAt = -1;
    flyControls(sim, 90, (st) => {
      if (st.radio.ackTimer > 0) st.intent.reply = 0;
      park(sim, { slew: pick.slew, radius: pick.radius, line: 20 });
      if (st.radio.tx === 'groundTx') { armed = true; since = 0; return; }
      if (!armed) return;
      since += sim.STEP;
      if (since < 1.2) return;
      const j = st.radio.replies ? st.radio.replies.indexOf('Say again') : -1;
      if (j >= 0) { st.intent.reply = j; armed = false; if (pressedAt < 0) pressedAt = calls; }
    });
    calls -= pressedAt < 0 ? seen : pressedAt;
    // Ground must still be trying: a stranded script stops calling entirely.
    if (calls < 3) stranded.push(`${id}: ${calls} retries after a say again`);
  }
  rec('a hook retry that expires mid transmission is not lost',
    stranded.length === 0, stranded.length ? stranded.join(', ') : 'ground kept retrying on all four');
}

// Both "never re-award" guards are truthiness tests, so a restored award needs a
// truthy value even when its stored date did not survive inspection.
async function tCorruptAwardStaysAwarded() {
  globalThis.localStorage.clear();
  globalThis.localStorage.setItem('craneCab_ach', JSON.stringify({
    v: 1, data: { awards: { 'Radio Check': 1, 'Zero Swing': null, 'Chart Legal': '2026-01-01' }, hooks: 4, furthest: 1 }
  }));
  const sim = await flyMission(0);
  const again = sim.state.scoring.earned || [];
  globalThis.localStorage.clear();
  rec('an award with a corrupted date is still an award, not one to win again',
    !again.includes('Radio Check') && !again.includes('Zero Swing') && !again.includes('Chart Legal'),
    `re-earned ${JSON.stringify(again)}`);
}


// A mic held across the end card used to arrive in the next lift already down,
// so ground's first word was doubled and the operator started a fault down
// before touching a control.
async function tHeldMicIsNotADouble() {
  const sim = await makeSim();
  sim.state.phase = 'playing';
  sim.state.intent.ptt = true;                 // held from the previous card
  sim.modules.missions.start(sim.ctx, 0);
  flyControls(sim, 3, (s) => { s.intent.ptt = true; });
  rec('a mic already keyed when a lift starts is not a double',
    sim.state.radio.faults === 0 && sim.state.radio.node === 'check',
    `node ${sim.state.radio.node} faults ${sim.state.radio.faults} caption "${sim.state.radio.caption}"`);
}

// Every fail card used to congratulate the player on the achievements and the
// personal best from the last lift they won, on every retry.
async function tFailCardIsNotAReplay() {
  globalThis.localStorage && globalThis.localStorage.clear();
  const sim = await flyMission(1);
  const won = sim.modules.scoring.afterAction(sim.ctx);
  // Now fail the next lift outright.
  sim.modules.missions.start(sim.ctx, 2);
  sim.state.phase = 'playing';
  rig(sim, 2);
  sim.state.mission.everHooked = true;
  sim.bus.emit('alarm.a2b', {});
  sim.modules.missions.fail ? null : null;
  sim.state.mission.result = 'fail';
  sim.state.mission.failReason = 'anti-two-block';
  sim.bus.emit('lift.fail', { id: 2 });
  const lost = sim.modules.scoring.afterAction(sim.ctx);
  rec('a fail card does not replay the last win\'s unlocks and personal best',
    won.earned.length > 0 && lost.earned.length === 0 && lost.personalBest === false,
    `won ${JSON.stringify(won.earned)}, then fail card ${JSON.stringify(lost.earned)} pb ${lost.personalBest}`);
}

// Two of the four demerit lines used to sit exactly on the fail thresholds, so
// they could never fire on a lift that was still a win, and the letter moved
// only on sway and radio faults.
async function tGradeMovesInsideTheWin() {
  async function graded(mut) {
    const sim = await startMission(1);
    const s = sim.state;
    s.mission.landingTol = 0.35;
    s.mission.landingPos = [0, 0, 0];
    s.mission.landedAt = [0, 0, 0];
    s.mission.result = 'win';
    mut(s, sim);
    sim.bus.emit('lift.win', { id: 1 });
    return { grade: s.scoring.grade, why: s.scoring.demerits.map((d) => d.why) };
  }
  const clean = await graded(() => {});
  const offMark = await graded((s) => { s.scoring.landingError = 0.30; });   // inside 0.35, still a win
  const heavy = await graded((s) => { s.mission.maxCapacityPct = 88; });     // under 90, still a win
  rec('the grade moves on things a winning lift can actually do',
    clean.grade === 'A' && offMark.grade !== 'A' && heavy.grade !== 'A',
    `clean ${clean.grade}, 0.30 m off a 0.35 m pad ${offMark.grade} ${JSON.stringify(offMark.why)}, 88 percent ${heavy.grade} ${JSON.stringify(heavy.why)}`);
}

// 'No Two-Block' was twoBlocks === 0 and 'Chart Legal' was maxCapacityPct < 90,
// and both of those things fail the lift, so every winning lift had them for
// free. What matters is not how many the tutorial hands out but whether they can
// be missed at all by a lift that still wins.
async function tAchievementsAreNotFree() {
  async function earnedOn(mut) {
    globalThis.localStorage && globalThis.localStorage.clear();
    const sim = await startMission(1);
    const s = sim.state;
    s.mission.landingTol = 0.35;
    s.mission.landingPos = [0, 0, 0];
    s.mission.landedAt = [0, 0, 0];
    s.mission.result = 'win';
    mut(s);
    sim.bus.emit('lift.win', { id: 1 });
    return s.scoring.earned || [];
  }
  const roomy = await earnedOn((s) => { s.scoring.closestBlock = 8; s.mission.maxCapacityPct = 40; });
  const tight = await earnedOn((s) => { s.scoring.closestBlock = 0.8; s.mission.maxCapacityPct = 88; });
  rec('the two achievements that used to restate the win predicate can be missed',
    roomy.includes('No Two-Block') && roomy.includes('Chart Legal') &&
    !tight.includes('No Two-Block') && !tight.includes('Chart Legal'),
    `roomy ${JSON.stringify(roomy)}, tight ${JSON.stringify(tight)}`);
}

// The mushroom is a toggle, and radio.js accepts the ALL STOP answer from the
// level. An operator already stopped when ground called it got the credit from
// ground and none from the card.
async function tDogEverythingWithTheMushroomDown() {
  const sim = await startMission(0);
  const s = sim.state;
  answer(sim);
  const p = polarOf(m0.pickup.pos);
  park(sim, { slew: p.slew, radius: 18 });
  until(sim, atNode('toPickup'), 8);
  rig(sim);
  s.intent.estop = true;                        // already dogged
  until(sim, () => false, 0.5);
  s.load.swing.x = 0.2;
  until(sim, atNode('allStop'), 8);
  until(sim, () => false, 3);
  s.mission.result = 'win';
  s.scoring.landingError = 0;
  sim.bus.emit('lift.win', { id: 0 });
  rec('an ALL STOP answered by a mushroom that was already down still counts',
    (sim.state.scoring.earned || []).includes('Dog Everything'),
    `earned ${JSON.stringify(sim.state.scoring.earned)}`);
}

// The hooks counter counted completed lifts, so every load rigged and then blown
// counted for nothing and "Hundred Hooks" wanted a hundred wins.
async function tHooksCountRigs() {
  globalThis.localStorage && globalThis.localStorage.clear();
  const sim = await startMission(1);
  const s = sim.state;
  const p = polarOf(MISSIONS[1].pickup.pos);
  park(sim, { slew: p.slew, radius: p.radius, line: 43.8 - (1.3 + MISSIONS[1].load.size[1]) + 0.05 });
  sim.bus.emit('hook.attach', {});
  until(sim, () => false, 0.2);
  const hooked = s.load.attached;
  s.mission.result = 'fail';
  s.mission.failReason = 'anti-two-block';
  sim.bus.emit('lift.fail', { id: 1 });
  rec('a load rigged and then blown still counts as a hook',
    hooked && s.progress.hooks === 1, `attached ${hooked}, hooks ${s.progress.hooks}`);
}

// A refused write used to be swallowed while the in-memory progress carried on,
// so private browsing got a card full of unlocks and a run that vanished.
async function tBlockedStorageSaysSo() {
  const real = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; },
    removeItem: () => {}, clear: () => {}
  };
  let card = null;
  try {
    const sim = await flyMission(0);
    card = sim.modules.scoring.afterAction(sim.ctx);
  } finally {
    globalThis.localStorage = real;
  }
  rec('a browser that refuses to save says so on the card',
    card && card.savedOk === false, `savedOk ${card && card.savedOk}`);
}


// The deploy workflow rewrites data/build.js in the published mirror with a sed
// that matches these two strings literally. If a field is renamed or the quoting
// changes, the stamp silently stops applying and every deploy ships claiming to
// be a dev build. The workflow step fails loudly on a miss; this fails earlier.
async function tBuildStampIsStampable() {
  const src = readFileSync(join(HERE, '..', 'data/build.js'), 'utf8');
  const wf = readFileSync(join(HERE, '..', '..', '.github/workflows/deploy.yml'), 'utf8');
  const hasPlaceholders = src.includes("sha: 'dev'") && src.includes("date: ''");
  // The exact patterns the workflow greps for, as it writes them.
  const wfMatches = wf.includes("s/sha: 'dev'/sha: '$SHA'/") && wf.includes("s/date: ''/date: '$DATE'/");
  const mod = await import(pathToFileURL(join(HERE, '..', 'data/build.js')).href);
  const devLabel = mod.buildLabel();
  const stamped = { ...mod.BUILD };
  rec('the build stamp placeholders are exactly what the deploy rewrites',
    hasPlaceholders && wfMatches && devLabel === 'dev build',
    `placeholders ${hasPlaceholders}, workflow patterns ${wfMatches}, unstamped label "${devLabel}", BUILD ${JSON.stringify(stamped)}`);

  // And the stamped form has to read as a build, not as an empty string.
  const stampedSrc = src
    .replace("sha: 'dev'", "sha: 'abc1234'")
    .replace("date: ''", "date: '2026-09-07'");
  const dataUrl = `data:text/javascript;base64,${Buffer.from(stampedSrc).toString('base64')}`;
  const stampedMod = await import(dataUrl);
  const label = stampedMod.buildLabel();
  rec('and a stamped build says which commit it is',
    label.includes('abc1234') && label.includes('2026-09-07'),
    `stamped label "${label}"`);
}


// -------------------------------------------------- phase 4c: pendulum physics
//
// These check the model against closed-form answers rather than against
// yesterday's behaviour. A pendulum has a period, a load being turned in a
// circle has a lean, and a rope being hauled in on a swinging load feeds it; all
// three are arithmetic, and if the sim disagrees with the arithmetic the sim is
// wrong. Tolerances are loose enough to absorb the damping the model carries and
// tight enough that a sign error or a missing term cannot hide.

// No mission running: these are physics benches, not lifts. Starting a mission
// puts the radio director and the fail conditions in the loop, and four minutes
// of slewing in a circle is a lift that ends badly, which stops the clock in the
// middle of the measurement. It also removes the mission's wind, which is a real
// force and the wrong one to have in a bench.
async function pendulumRig({ line = 30, radius = 20, damping = 0 } = {}) {
  const sim = await makeSim();
  const s = sim.state;
  s.phase = 'playing';
  s.settings.damping = damping;
  const m = MISSIONS[0];
  s.load.attached = true; s.load.mass = m.load.mass; s.load.size = [...m.load.size];
  s.crane.line = line; s.crane.lineVel = 0;
  s.crane.radius = radius; s.crane.radiusVel = 0;
  s.crane.slew = 0; s.crane.slewVel = 0;
  return sim;
}
const swingAmp = (sim, secs, pick) => {
  let a = 0;
  until(sim, () => false, secs, (s) => { a = Math.max(a, Math.abs(pick(s))); });
  return a;
};
const GRAV = 9.81;

async function tPendulumPeriod() {
  const rows = [];
  for (const L of [10, 25, 40]) {
    const sim = await pendulumRig({ line: L });
    const s = sim.state;
    s.load.swing.x = 0.05;
    const ts = [];
    let last = s.load.swing.x;
    let t = 0;
    const want = 2 * Math.PI * Math.sqrt(L / GRAV);
    until(sim, () => ts.length > 7, want * 9, () => {
      t += sim.STEP;
      if (last > 0 && s.load.swing.x <= 0) ts.push(t);
      last = s.load.swing.x;
    });
    const got = (ts[6] - ts[0]) / 6;
    rows.push({ L, got, want, err: Math.abs(got - want) / want });
  }
  rec('a free swing has the period gravity says it should',
    rows.every((r) => r.err < 0.01),
    rows.map((r) => `L=${r.L}: ${r.got.toFixed(2)}s vs ${r.want.toFixed(2)}s (${(r.err * 100).toFixed(2)}%)`).join(', '));
}

// Turning holds the load out from plumb for as long as the turn lasts. The old
// model had no term that could do this: a constant slew rate produced no lean at
// all, and every bit of swing came from the moments the slew rate was changing.
async function tCentrifugalLean() {
  const rows = [];
  for (const [r, range] of [[50, 'II'], [30, 'II'], [50, 'I']]) {
    const sim = await pendulumRig({ radius: r, damping: 1 });
    const s = sim.state;
    until(sim, () => false, 260, (st) => { st.intent.slew = 1; st.intent.range = range; });
    const om = s.crane.slewVel;
    const L = s.crane.line;
    // The load rides at radius r + L sin(theta), so the closed form is implicit.
    let th = 0;
    for (let k = 0; k < 60; k += 1) th = Math.atan((om * om * (r + L * Math.sin(th))) / GRAV);
    rows.push({ r, range, got: s.load.swing.y, want: th, err: Math.abs(s.load.swing.y - th) / th });
  }
  rec('slewing holds the load out from plumb by as much as the arithmetic says',
    rows.every((x) => x.err < 0.02 && x.got > 0),
    rows.map((x) => `r=${x.r} ${x.range}: ${(x.got * 180 / Math.PI).toFixed(3)} vs ${(x.want * 180 / Math.PI).toFixed(3)} deg`).join(', '));

  // And it is a lean, not a swing: it goes away when the slew stops.
  const sim = await pendulumRig({ radius: 50, damping: 1 });
  const s = sim.state;
  until(sim, () => false, 200, (st) => { st.intent.slew = 1; st.intent.range = 'II'; });
  const held = s.load.swing.y;
  until(sim, () => false, 60, (st) => { st.intent.slew = 0; });
  rec('and lets it go again when the slew stops',
    held > 0.05 && Math.abs(s.load.swing.y) < held * 0.1,
    `${(held * 180 / Math.PI).toFixed(2)} deg while turning, ${(s.load.swing.y * 180 / Math.PI).toFixed(3)} deg a minute after stopping`);
}

// Trolleying out while the house turns throws the load behind the sweep. Sign
// first, magnitude second: a Coriolis term with the sign wrong would swing the
// load the wrong way round the jib and look like nothing in particular.
async function tCoriolis() {
  const spin = (trolley) => (st) => { st.intent.slew = 1; st.intent.range = 'II'; st.intent.trolley = trolley; };
  const still = await pendulumRig({ radius: 20, damping: 1 });
  until(still, () => false, 26, spin(0));
  const moving = await pendulumRig({ radius: 20, damping: 1 });
  until(moving, () => false, 26, spin(1));
  const om = moving.state.crane.slewVel;
  const rdot = moving.state.crane.radiusVel;
  const L = moving.state.crane.line;
  const got = moving.state.load.swing.x - still.state.load.swing.x;
  // Steady state of the tangential equation, keeping the terms that survive:
  //   s_x (g/L - Omega^2) = -c Omega s_y - 2 rdot Omega / L
  // The first right-hand term is drag on the radial offset being carried round,
  // which the bare 2 rdot Omega / g form leaves out; the two runs sit at
  // different radii and so at different leans, so it does not cancel between
  // them. c is BASE_DAMPING plus the assist at settings.damping 1.
  const c = 0.05 + 0.3;
  const dLean = moving.state.load.swing.y - still.state.load.swing.y;
  const want = (-c * om * dLean - (2 * rdot * om) / L) / (GRAV / L - om * om);
  rec('trolleying out while slewing throws the load behind the sweep',
    rdot > 0.5 && got < 0 && Math.abs(got - want) / Math.abs(want) < 0.08,
    `${(got * 180 / Math.PI).toFixed(3)} deg against ${(want * 180 / Math.PI).toFixed(3)} deg from the steady state, at rdot ${rdot.toFixed(2)} Omega ${om.toFixed(3)}`);
}

// Angular momentum about the pivot goes as L^2 theta-dot, so shortening the rope
// on a swinging load feeds it and paying out kills it. Amplitude follows L^-3/4.
// Measured against an identical run that does not touch the hoist, so the
// damping is common to both and cancels.
async function tRopeCoupling() {
  async function run(dir, move) {
    const sim = await pendulumRig({ line: dir === 'up' ? 40 : 15, damping: 0 });
    const s = sim.state;
    s.load.swing.x = 0.05;
    until(sim, () => false, 6);
    const L0 = s.crane.line;
    const a0 = swingAmp(sim, 22, (st) => st.load.swing.x);
    const target = dir === 'up' ? L0 / 2 : L0 * 2;
    until(sim, () => false, 40, (st) => {
      st.intent.range = 'I';
      st.intent.hoist = !move ? 0
        : (dir === 'up' ? (st.crane.line > target ? 1 : 0) : (st.crane.line < target ? -1 : 0));
    });
    const a1 = swingAmp(sim, 22, (st) => st.load.swing.x);
    return { L0, L1: s.crane.line, ratio: a1 / a0 };
  }
  const out = [];
  for (const dir of ['up', 'down']) {
    const moved = await run(dir, true);
    const held = await run(dir, false);
    const got = moved.ratio / held.ratio;
    const want = Math.pow(moved.L1 / moved.L0, -0.75);
    out.push({ dir, got, want, ok: Math.abs(got - want) / want < 0.25 });
  }
  rec('hauling in on a swinging load feeds it, and paying out kills it',
    out.every((x) => x.ok) && out[0].got > 1.3 && out[1].got < 0.8,
    out.map((x) => `${x.dir}: ${x.got.toFixed(3)}x against holding, L^-3/4 says ${x.want.toFixed(3)}`).join(', '));
}

// The integrator must not quietly make or destroy energy. Semi-implicit Euler is
// symplectic, so the only thing taking amplitude out should be the damping, at
// the rate the damping says.
async function tSwingDecay() {
  const sim = await pendulumRig({ damping: 0 });
  const s = sim.state;
  s.load.swing.x = 0.06;
  const a0 = swingAmp(sim, 11, (st) => st.load.swing.x);
  until(sim, () => false, 44);
  const a1 = swingAmp(sim, 11, (st) => st.load.swing.x);
  const want = Math.exp((-0.05 * 55) / 2);        // BASE_DAMPING, envelope exp(-c t / 2)
  rec('a free swing loses amplitude at the rate the damping says, and no faster',
    Math.abs(a1 / a0 - want) / want < 0.05,
    `${(a0 * 180 / Math.PI).toFixed(3)} to ${(a1 * 180 / Math.PI).toFixed(3)} deg, ratio ${(a1 / a0).toFixed(4)} against ${want.toFixed(4)}`);
}

// The pendulum plane is fixed in the world, not in the jib. Turn the house under
// a swinging load and the swing must keep pointing the same way across the site.
// Run it at the mast centre, where there is no centrifugal lean to confuse the
// bearing: the crane cannot really put the trolley there, so the stop is moved
// for the test rather than the physics being asked to do something it does not.
async function tSwingKeepsItsPlane() {
  const sim = await pendulumRig({ radius: 0, damping: 0 });
  const s = sim.state;
  s.crane.minRadius = 0;
  s.crane.radius = 0;
  s.load.swing.y = 0.14;
  const bearing = () => {
    const cs = Math.cos(s.crane.slew);
    const sn = Math.sin(s.crane.slew);
    const jx = Math.sin(s.load.swing.y);
    const jz = Math.sin(s.load.swing.x);
    return Math.atan2(jx * sn + jz * cs, jx * cs - jz * sn);
  };
  const seen = [];
  for (let k = 0; k < 12; k += 1) {
    until(sim, () => false, 4, (st) => { st.intent.slew = 1; st.intent.range = 'II'; st.crane.minRadius = 0; });
    if (Math.hypot(s.load.swing.x, s.load.swing.y) > 0.05) seen.push(bearing());
  }
  const wrap = (a) => {
    const b = Math.atan2(Math.sin(a), Math.cos(a));
    return Math.min(Math.abs(b), Math.PI - Math.abs(b));
  };
  const drift = seen.map((a) => wrap(a - seen[0]));
  const worst = Math.max(...drift);
  rec('the swing keeps its plane in the world while the house turns under it',
    seen.length >= 5 && worst < 3 * Math.PI / 180,
    `slewed ${(s.crane.slew * 180 / Math.PI).toFixed(0)} deg over ${seen.length} samples, worst bearing drift ${(worst * 180 / Math.PI).toFixed(2)} deg`);
}


// A load being turned in a circle hangs out from plumb for as long as the turn
// lasts. That is a lean, not a swing, and the grade must not charge for it: since
// the model gained the rotating frame terms, slewing at range II at forty metres
// holds three and a half degrees, which is over the demerit threshold and would
// have cost a letter for flying the crane at the speed the crane has.
async function tLeanIsNotSway() {
  const sim = await pendulumRig({ radius: 45, damping: 1 });
  const s = sim.state;
  let peakAngle = 0;
  let peakAmp = 0;
  until(sim, () => false, 200, (st) => {
    st.intent.slew = 1; st.intent.range = 'II';
    peakAngle = Math.max(peakAngle, st.sensors.loadSway);
    peakAmp = Math.max(peakAmp, st.sensors.swayAmplitude);
  });
  const settledAngle = s.sensors.loadSway;
  const DEGS = 180 / Math.PI;
  // The lean is real and reads on the gauge; the oscillation estimate ignores it
  // once the transient into the lean has died.
  let lateAmp = 0;
  until(sim, () => false, 60, (st) => {
    st.intent.slew = 1; st.intent.range = 'II';
    lateAmp = Math.max(lateAmp, st.sensors.swayAmplitude);
  });
  rec('a steady lean while slewing is not scored as a swing',
    settledAngle > 3.0 / DEGS && lateAmp < 0.4 / DEGS && peakAmp > lateAmp,
    `holding ${(settledAngle * DEGS).toFixed(2)} deg of lean, oscillation reads ${(lateAmp * DEGS).toFixed(3)} deg once settled (transient peaked at ${(peakAmp * DEGS).toFixed(2)})`);

  // But a real swing still reads at its full amplitude.
  // Started at the bottom of its arc, where the whole amplitude is in the rate,
  // so this measures the estimator and not how much the damping took out of the
  // swing on the way down to the first crossing.
  const free = await pendulumRig({ damping: 0 });
  const L = free.state.crane.line;
  free.state.load.swing.x = 0;
  free.state.load.swing.vx = 0.07 * Math.sqrt(GRAV / L);
  let amp = 0;
  until(free, () => false, 30, (st) => { amp = Math.max(amp, st.sensors.swayAmplitude); });
  rec('and a real swing still reads at its full amplitude',
    Math.abs(amp - 0.07) / 0.07 < 0.02,
    `a ${(0.07 * DEGS).toFixed(2)} deg swing reads ${(amp * DEGS).toFixed(2)} deg`);
}


// The rope drops L cos(tilt), not L. The hook used to be hung a whole line length
// down while also being offset sideways by L sin(tilt), which drew a rope longer
// than the rope is and held the load at one height right across an arc it should
// be rising and falling through.
async function tLoadRisesAtTheEndsOfItsArc() {
  const sim = await pendulumRig({ line: 30, damping: 0 });
  const s = sim.state;
  const A = 0.25;                       // rad, big enough to measure
  s.load.swing.x = 0;
  s.load.swing.vx = A * Math.sqrt(GRAV / s.crane.line);
  until(sim, () => false, 0.05);        // one tick, so bottomY is real and not the default
  let lo = Infinity;
  let hi = -Infinity;
  let peakSwing = 0;
  until(sim, () => false, 24, (st) => {
    lo = Math.min(lo, st.load.bottomY);
    hi = Math.max(hi, st.load.bottomY);
    peakSwing = Math.max(peakSwing, Math.abs(st.load.swing.x));
  });
  // Bottom of the arc to the ends of it: L (1 - cos A), using the amplitude the
  // swing actually reached rather than the one it was launched with.
  const want = s.crane.line * (1 - Math.cos(peakSwing));
  const got = hi - lo;
  rec('a swinging load rises at the ends of its arc, by L (1 - cos A)',
    Math.abs(got - want) / want < 0.05 && got > 0.5,
    `${got.toFixed(3)} m of rise against ${want.toFixed(3)} m, at ${(peakSwing * 180 / Math.PI).toFixed(1)} deg on ${s.crane.line} m of rope`);

  // And the rope drawn is the rope paid out, not longer.
  const drop = s.crane.line * Math.sqrt(1 - Math.sin(s.load.swing.x) ** 2 - Math.sin(s.load.swing.y) ** 2);
  const across = s.crane.line * Math.hypot(Math.sin(s.load.swing.x), Math.sin(s.load.swing.y));
  const drawn = Math.hypot(drop, across);
  rec('and the rope is as long as the rope, whatever the swing',
    Math.abs(drawn - s.crane.line) < 1e-9,
    `sheave to hook ${drawn.toFixed(6)} m against ${s.crane.line} m paid out, at ${(Math.abs(s.load.swing.x) * 180 / Math.PI).toFixed(2)} deg`);
}


// The cache poisoning that cost two rounds of "it still looks like the old
// version". A bare fetch() inside a service worker goes through the browser's own
// HTTP cache, so the network-first strategy was network-first only for URLs the
// HTTP cache had nothing fresh for. Clients that visited while nginx was marking
// this folder immutable for a year had entries that stay fresh until 2027, and
// for them the "network" fetch never left the machine: a current index.html
// running Phase 0 modules, 708 bytes of pendulum.js under a page with every later
// feature in its markup. No amount of curl could see it, because curl has no HTTP
// cache, so this is a source check rather than a behaviour one.
async function tServiceWorkerReachesTheNetwork() {
  const sw = readFileSync(join(HERE, '..', '..', 'frontend/public/sw.js'), 'utf8');
  // The later 'Cache-first' comment, not the explanatory one above isVersionedAsset.
  const mutableBranch = sw.slice(sw.indexOf('if (mutable)'), sw.indexOf('// Cache-first for content-hashed'));
  rec('the service worker bypasses the HTTP cache on the network-first path',
    mutableBranch.includes("cache: 'reload'") && !/fetch\(request\)\s*\.then/.test(mutableBranch),
    mutableBranch.includes("cache: 'reload'")
      ? 'reload mode present on the mutable branch'
      : 'the mutable branch fetches without a cache mode, which is not network first');

  // And the page can repair itself even with no service worker running at all.
  const main = readFileSync(join(HERE, '..', 'js/main.js'), 'utf8');
  rec('and the page checks its own build against the server and reloads once if they differ',
    main.includes('healStaleCache') && main.includes("cache: 'reload'") &&
    main.includes('sessionStorage') && main.includes('location.reload'),
    `self-heal ${main.includes('healStaleCache')}, cache bypass ${main.includes("cache: 'reload'")}, one-shot guard ${main.includes('sessionStorage')}`);

  // The nginx side of it, which is what stopped new visitors being poisoned.
  const nginx = readFileSync(join(HERE, '..', '..', 'nginx/nginx.conf'), 'utf8');
  const craneBlock = nginx.slice(nginx.indexOf('location ^~ /crane-cab/'));
  rec('and nginx does not hand out an immutable year on this folder',
    craneBlock.includes('no-cache') && !craneBlock.slice(0, 400).includes('immutable'),
    craneBlock.split('\n').slice(0, 6).map((l) => l.trim()).filter(Boolean).join(' | '));
}

// ---------------------------------------------------------------- run

// ---------- the voice ----------

// Every clip key the data can produce has to exist as a file, and every file has
// to have a length in data/clips.js, because radio.js sizes a transmission from
// that table. A key with no file degrades to a caption and a flat 1.6 s, which
// is survivable and silent; a file with no length is a call that gets cut off
// mid-word, which is not. The guide keys are generated by combining a direction
// with a bucket tag, so they are the ones that can go missing without anyone
// noticing until a lift is running.
async function tEveryClipExists() {
  const { CLIP_SECONDS } = await import(pathToFileURL(join(HERE, '..', 'data/clips.js')).href);
  const R = await import(pathToFileURL(join(HERE, '..', 'data/radio.js')).href);
  const wanted = new Set();
  const bothUnits = (v) => (v && typeof v === 'object' && ('imperial' in v || 'metric' in v))
    ? [v.imperial, v.metric] : [v];
  for (const script of Object.values(R.SCRIPTS)) {
    for (const n of Object.values(script.nodes)) {
      for (const k of bothUnits(n.say)) if (k) wanted.add(k);
    }
  }
  for (const hint of [R.NOT_READY_HINT, R.TOO_HIGH_HINT, R.TOO_LOW_HINT, R.NOT_SLACK_HINT]) {
    wanted.add(hint.say);
  }
  // A node the operator cannot see the bottom of gets a depth countdown, which
  // is one clip per bucket per unit system, plus the plumb warning it swaps in.
  const anyDescent = Object.values(R.SCRIPTS)
    .some((sc) => Object.values(sc.nodes).some((n) => n.descend));
  if (anyDescent) {
    for (const units of ['imperial', 'metric']) {
      for (const b of R.DISTANCE_BUCKETS[units]) wanted.add(`TOGO_${b.tag}`);
    }
    wanted.add('CENTRED');
  }
  for (const call of Object.values(R.GUIDE_CALLS)) {
    wanted.add(call.say);
    if (!call.distance) continue;
    for (const units of ['imperial', 'metric']) {
      for (const b of R.DISTANCE_BUCKETS[units]) wanted.add(`${call.say}_${b.tag}`);
    }
    wanted.add(`${call.say}_${R.DISTANCE_FAR.tag}`);
  }
  const dir = join(HERE, '..', 'audio');
  const onDisk = new Set(readdirSync(dir).filter((f) => f.endsWith('.ogg'))
    .map((f) => f.slice(0, -4)));
  const noFile = [...wanted].filter((k) => !onDisk.has(k));
  const noLength = [...onDisk].filter((k) => !(k in CLIP_SECONDS));
  const noAudio = Object.keys(CLIP_SECONDS).filter((k) => !onDisk.has(k));
  // And the other direction. A clip nobody can ask for is a line that was cut
  // from the script and left in the folder: dead weight in the repo and in the
  // mirror, and a reader's first guess that the radio still says it.
  const unwanted = [...onDisk].filter((k) => !wanted.has(k));
  rec('every clip the radio can ask for is on disk, with a length beside it, and nothing else is',
    noFile.length === 0 && noLength.length === 0 && noAudio.length === 0 && unwanted.length === 0,
    `${wanted.size} keys wanted, ${onDisk.size} files; missing files ${JSON.stringify(noFile)}, ` +
    `missing lengths ${JSON.stringify(noLength)}, orphan lengths ${JSON.stringify(noAudio)}, ` +
    `clips nothing asks for ${JSON.stringify(unwanted)}`);
  // And the server has to name them as audio. python:3.12-slim ships no
  // /etc/mime.types, so Python's built-in table is all the backend has, and it
  // has no .ogg; Starlette then labels every clip "text/plain". decodeAudioData
  // ignores the label, which is exactly why this went out unnoticed, but an
  // <audio> element or a CDN would not.
  const backend = readFileSync(join(HERE, '..', '..', 'backend/main.py'), 'utf8');
  rec('the server calls the voice clips audio',
    /mimetypes\.add_type/.test(backend) && backend.includes('"audio/ogg"') &&
    backend.includes('".ogg"'),
    backend.includes('mimetypes.add_type') ? 'audio/ogg registered for .ogg'
      : 'no mimetypes.add_type in backend/main.py: OGG will go out as text/plain');

  // And no clip may be silent or absurdly long: a zero would make a call land in
  // the same tick it went out, and thirty seconds would hang the script.
  const odd = Object.entries(CLIP_SECONDS).filter(([, v]) => !(v > 0.3 && v < 8));
  rec('no clip is empty or runs away with the script',
    odd.length === 0, `out of range ${JSON.stringify(odd)}`);
}

// A call used to be on the air for a flat 1.6 s whatever it said. With voices
// that is both too long for "Up easy." and half of what the shaft brief needs,
// and the second half of the brief was simply cut off.
async function tTransmissionMatchesTheClip() {
  const { CLIP_SECONDS } = await import(pathToFileURL(join(HERE, '..', 'data/clips.js')).href);
  const sim = await startMission(3);                       // blindShaft: the long brief
  until(sim, (s) => s.radio.tx === 'groundTx', 4);
  const shortCall = sim.state.radio.groundTimer;           // RADIO_CHECK
  answer(sim);
  until(sim, atNode('brief'), 8);
  until(sim, (s) => s.radio.tx === 'groundTx' && s.radio.caption.startsWith('Blind pick'), 8);
  const longCall = sim.state.radio.groundTimer;
  // Each within a tick of its clip plus the unkey beat, and the brief has to be
  // materially longer than the check rather than both landing on 1.6.
  const wantShort = CLIP_SECONDS.RADIO_CHECK + 0.25;
  const wantLong = CLIP_SECONDS.SHAFT_BRIEF_FT + 0.25;   // default units are imperial
  rec('a call is as long as the recording, not a flat second and a half',
    Math.abs(shortCall - wantShort) < 0.05 && Math.abs(longCall - wantLong) < 0.05 &&
    longCall > shortCall + 1.5,
    `check ${shortCall.toFixed(2)} want ${wantShort.toFixed(2)}, ` +
    `brief ${longCall.toFixed(2)} want ${wantLong.toFixed(2)}`);
}

// Full duplex. Answering over the top of ground is the point: the answer is
// heard, it lands the moment the call ends, and it costs nothing. Under half
// duplex this exact input garbled both stations, logged a fault and sent the
// script off to sayAgain.
async function tAnswerOverGroundIsFree() {
  const sim = await startMission(0);
  // Press Copy while ground is still saying the radio check.
  until(sim, (s) => s.radio.tx === 'groundTx', 4);
  const early = sim.state.radio.groundTimer;
  until(sim, () => false, 0.15, (s) => { s.intent.reply = 0; });
  const banked = sim.state.radio.answered;
  const stillTalking = sim.state.radio.groundTimer > 0 && node(sim.state) === 'check';
  // It lands when the call ends, and the reply window never has to open.
  const replied = until(sim, () => sim.log.some((e) => e.name === 'radio.reply'), 4);
  const moved = until(sim, (s) => node(s) !== 'check', 6);
  rec('an answer given over ground is heard, lands when the call ends, and is not a fault',
    early > 0.5 && banked === 'Copy' && stillTalking && replied && moved &&
    sim.state.radio.faults === 0,
    `banked ${banked} talking ${stillTalking} replied ${replied} moved ${moved} ` +
    `faults ${sim.state.radio.faults} node ${node(sim.state)}`);
}

// And the mic itself. Keying over ground used to be a fault on its own, with no
// button pressed at all.
async function tKeyingOverGroundIsFree() {
  const sim = await startMission(0);
  until(sim, (s) => s.radio.tx === 'groundTx', 4);
  until(sim, () => false, 1.0, (s) => { s.intent.ptt = true; });
  sim.state.intent.ptt = false;
  const overlaps = sim.log.filter((e) => e.name === 'radio.overlap').length;
  rec('keying the mic over ground is heard on both sets and costs nothing',
    sim.state.radio.faults === 0 && node(sim.state) === 'check' && overlaps > 0,
    `faults ${sim.state.radio.faults} node ${node(sim.state)} overlaps ${overlaps}`);
}

// A guide call says how far, and the clip has to be the one that says that far.
// The caption and the recording are built from the same bucket for exactly this
// reason: the operator reads one while hearing the other.
async function tGuideDistanceMatchesItsClip() {
  const R = await import(pathToFileURL(join(HERE, '..', 'data/radio.js')).href);
  const sim = await startMission(0);
  answer(sim);
  const p = polarOf(m0.pickup.pos);
  park(sim, { slew: p.slew, radius: 8 });                  // a long way in from the mark
  until(sim, atNode('toPickup'), 8);
  const said = [];
  until(sim, () => said.length >= 3, 20, (s) => {
    park(sim, { slew: p.slew, radius: 8 });
    const last = sim.log.filter((e) => e.name === 'radio.say').pop();
    if (last && (!said.length || said[said.length - 1] !== last.payload.key)) {
      said.push(last.payload.key);
    }
  });
  const cap = sim.state.radio.caption;
  const key = said[said.length - 1] || '';
  // The tag on the key has to be a real bucket, and its words have to be the
  // ones in the caption the operator is reading.
  const tag = key.split('_').pop();
  const all = [...R.DISTANCE_BUCKETS.imperial, ...R.DISTANCE_BUCKETS.metric, R.DISTANCE_FAR];
  const bucket = all.find((b) => b.tag === tag);
  rec('a guide call plays the clip that says the distance its caption says',
    !!bucket && cap.includes(bucket.words),
    `key ${key} tag ${tag} caption "${cap}"`);
}

// One banksman, one site, one set of units. The briefs used to be hardcoded
// metric while the default is imperial and every guide call says feet, so on
// mission 2 ground said "twelve metres" and then "trolley out, twenty five
// feet" half a minute later, in the same voice. This walks every line the
// player can hear or read, in both unit settings, and fails on any that carries
// the wrong system's words.
async function tGroundKeepsOneSetOfUnits() {
  const R = await import(pathToFileURL(join(HERE, '..', 'data/radio.js')).href);
  const IMPERIAL = /\b(feet|foot|inch|inches|yard)\b/i;
  const METRIC = /\b(met(re|er)s?|centimet|kilomet)\b/i;
  const pick = (v, u) => (v && typeof v === 'object' && ('imperial' in v || 'metric' in v))
    ? (u === 'imperial' ? v.imperial : v.metric) : v;

  const bad = [];
  for (const units of ['imperial', 'metric']) {
    const wrong = units === 'imperial' ? METRIC : IMPERIAL;
    for (const [name, script] of Object.entries(R.SCRIPTS)) {
      for (const n of Object.values(script.nodes)) {
        const cap = pick(n.caption, units);
        if (typeof cap === 'string' && wrong.test(cap)) bad.push(`${units} ${name}.${n.id}: "${cap}"`);
      }
    }
    // Guide distances come from the bucket table, which is picked by unit too.
    for (const b of R.DISTANCE_BUCKETS[units === 'imperial' ? 'imperial' : 'metric']) {
      if (wrong.test(b.words)) bad.push(`${units} bucket: "${b.words}"`);
    }
    for (const h of [R.NOT_READY_HINT, R.TOO_HIGH_HINT, R.TOO_LOW_HINT, R.NOT_SLACK_HINT]) {
      if (wrong.test(h.caption)) bad.push(`${units} hint: "${h.caption}"`);
    }
  }
  rec('ground never mixes feet and metres on one lift',
    bad.length === 0, bad.length ? JSON.stringify(bad, null, 1) : 'both unit settings are internally consistent');
}

// And the distance a call states has to be the distance it fires at. "Last
// foot. Micro." went out on load.near, which missions.js sets three metres -
// nearly ten feet - above the landing. On a real site that call means micro
// speed with hands near the load, and being nine feet out is how an operator
// learns the voice is decorative.
async function tCloseInCallSaysTheRealDistance() {
  const R = await import(pathToFileURL(join(HERE, '..', 'data/radio.js')).href);
  const src = readFileSync(join(HERE, '..', 'js/missions.js'), 'utf8');
  const near = Number((src.match(/const NEAR_HEIGHT = ([\d.]+)/) || [])[1]);
  const ft = near * 3.28084;
  const say = (u) => {
    const n = R.SCRIPTS.scaffold.nodes.lastCall;
    return u === 'imperial' ? n.caption.imperial : n.caption.metric;
  };
  // Ground speaks numbers, he does not read digits out.
  const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
                  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20 };
  const spoken = (text, unit) => {
    const m = text.match(new RegExp(`(\\w+)\\s+${unit}`, 'i'));
    return m ? WORDS[m[1].toLowerCase()] : NaN;
  };
  const statedFt = spoken(say('imperial'), '(?:feet|foot)');
  const statedM = spoken(say('metric'), 'met');
  rec('the close-in call states the height it actually fires at',
    Number.isFinite(near) && Math.abs(statedFt - ft) <= 1.5 && Math.abs(statedM - near) <= 0.5,
    `fires at ${near} m (${ft.toFixed(1)} ft); says ${statedFt} ft / ${statedM} m`);
  // Both scripts fire it on the same event, so they must make the same call.
  rec('and both jobs make the same call at the same point',
    JSON.stringify(R.SCRIPTS.scaffold.nodes.lastCall.caption) ===
    JSON.stringify(R.SCRIPTS.blindShaft.nodes.lastCall.caption),
    `scaffold ${JSON.stringify(R.SCRIPTS.scaffold.nodes.lastCall.caption)} vs shaft ${JSON.stringify(R.SCRIPTS.blindShaft.nodes.lastCall.caption)}`);
}

// ---------- ground stops repeating himself ----------

// He used to re-send an unanswered call forever, once every few seconds, with a
// fault each time. Now he says it at most twice more and then lets the gate
// decide. The count is what matters and so is what happens after: a call that
// stops has to leave the script somewhere it can still finish from.
async function tGroundSaysItAtMostTwiceMore() {
  const sim = await startMission(0);           // check: onTimeout 'repeat', no gate
  const said = () => sim.log.filter((e) => e.name === 'radio.say' &&
    e.payload && e.payload.key === 'RADIO_CHECK').length;
  // Never touch a control or a reply. Ground gets the whole ack window each time.
  until(sim, (s) => s.radio.node !== 'check', 40);
  const total = said();
  const gaveUp = sim.log.filter((e) => e.name === 'radio.gaveUp').length;
  rec('ground says a call three times at most, then stops',
    total <= 3 && total >= 1 && gaveUp === 1,
    `RADIO_CHECK went out ${total} times, gaveUp fired ${gaveUp}`);
  // And the script is not stranded on the node he gave up on.
  rec('and the lift moves on rather than stalling on the call he dropped',
    node(sim.state) !== 'check' && sim.state.radio.script !== null,
    `node ${node(sim.state)} script ${sim.state.radio.script}`);
  // The faults stop with the transmissions instead of accruing forever.
  const before = sim.state.radio.faults;
  until(sim, () => false, 15);
  rec('and the faults stop when the transmissions do',
    sim.state.radio.faults === before,
    `faults ${before} then ${sim.state.radio.faults} fifteen seconds later`);
}

// A gated call is the case that must not hang. Ground stops asking, but the node
// still waits for the thing the operator was told to do, and doing it late still
// works.
async function tACappedCallStillOpensItsGate() {
  const sim = await startMission(0);
  answer(sim);
  const p = polarOf(m0.pickup.pos);
  park(sim, { slew: p.slew, radius: p.radius });
  until(sim, atNode('onHook'), 14);
  rig(sim);
  until(sim, atNode('upEasy'), 10);            // waitFor 'hook.tight', onTimeout 'fault'
  // Sit on our hands well past the cap, then fly the rest of the lift.
  until(sim, () => false, 20);
  const saidUp = sim.log.filter((e) => e.name === 'radio.say' &&
    e.payload && /UP_EASY/.test(e.payload.key)).length;
  const gaveUp = sim.log.some((e) => e.name === 'radio.gaveUp');
  // The gate is the point, and it is a level, not an edge. Ground stops asking
  // after the cap and drops to the gate; the gate reads the rope as already
  // tight and the script carries on by itself. That is the no-strand property:
  // giving up on a call never leaves the lift sitting on it.
  rec('a call ground gave up on does not strand the lift',
    saidUp <= 3 && gaveUp && node(sim.state) !== 'upEasy' &&
    sim.state.radio.script !== null && sim.state.mission.result === null,
    `up easy went out ${saidUp} times, gaveUp ${gaveUp}, script moved on to ` +
    `${node(sim.state)} with the lift still live (${sim.state.mission.result})`);
}

// The alarm is the exemption. Capping it would mean ground going quiet with the
// load swinging, which is the one place repetition is the point.
async function tTheAlarmIsNotCapped() {
  const sim = await startMission(0);
  answer(sim);
  const p = polarOf(m0.pickup.pos);
  park(sim, { slew: p.slew, radius: 18 });
  until(sim, atNode('toPickup'), 8);
  until(sim, () => false, 2);
  rig(sim);
  sim.state.load.swing.x = 0.2;
  until(sim, atNode('allStop'), 8);
  const gaveUpOnAlarm = sim.log.some((e) => e.name === 'radio.gaveUp' && e.node === 'allStop');
  // It ends on its own deadline, not by being capped.
  const ended = until(sim, (s) => s.mission.result !== null ||
    sim.log.some((x) => x.name === 'radio.ignoredAllStop'), 12);
  rec('the ALL STOP is never capped, it runs to its own deadline',
    !gaveUpOnAlarm && ended,
    `gaveUp on allStop ${gaveUpOnAlarm}, reached its deadline ${ended}`);
}

// Capping the voice must not cap the retry. Ground calling for the hook is how
// the load actually gets rigged, and dropping that is how the lift used to
// strand at "on the hook" with nothing able to win or fail it.
async function tTheHookRetryOutlivesTheVoice() {
  const sim = await startMission(0);
  answer(sim);
  const p = polarOf(m0.pickup.pos);
  // Over the load but a metre and a half below the hook window (exact line here
  // is 42.8, the window is 42.2 to 43.4), so every retry answers notReady and
  // ground has something to keep saying.
  park(sim, { slew: p.slew, radius: p.radius });
  until(sim, atNode('onHook'), 14);
  park(sim, { slew: p.slew, radius: p.radius, line: 44.2 });
  const hookKeys = ['ON_THE_HOOK', 'NOT_READY', 'TOO_HIGH', 'TOO_LOW'];
  const spokenNow = () => sim.log.filter((e) => e.name === 'radio.say' &&
    e.payload && hookKeys.includes(e.payload.key)).length;
  until(sim, () => false, 25, () => park(sim, { slew: p.slew, radius: p.radius, line: 44.2 }));
  const spoken = spokenNow();
  const stillHinting = (sim.state.radio.caption || '').length > 0;
  // Now correct into the window. Only a retry that is still running can rig it.
  const rigged = until(sim, (s) => s.load.attached, 20,
    () => park(sim, { slew: p.slew, radius: p.radius, line: 42.8 }));
  rec('ground stops saying it but never stops trying the hook',
    spoken <= 3 && stillHinting && rigged && spokenNow() <= 3,
    `spoke ${spoken} times over 25 s, caption "${sim.state.radio.caption}", rigged after going quiet: ${rigged}`);
}

// Say again is the operator's own escape valve and the cap must not close it.
async function tSayAgainStillWorksAfterTheCap() {
  const sim = await startMission(0);
  until(sim, (s) => s.radio.node !== 'check', 40);   // let him give up
  const before = sim.log.filter((e) => e.name === 'radio.say').length;
  until(sim, () => false, 6, (s) => {
    const i = s.radio.replies ? s.radio.replies.indexOf('Say again') : -1;
    if (i >= 0 && s.time.frame % 240 === 0) s.intent.reply = i;
  });
  rec('Say again still brings the call back after ground has given up on it',
    sim.log.filter((e) => e.name === 'radio.say').length > before,
    `${before} calls before, ${sim.log.filter((e) => e.name === 'radio.say').length} after asking`);
}

// Ground is standing next to the load. "Bring the hook over the load first" was
// the one call that named a problem and withheld the answer, from the only man
// on site who could see it. He gives the correction now, in the same words and
// the same recording as a guide call, because it is the same instruction.
async function tTheHookCallSaysWhichWay() {
  const sim = await startMission(0);
  answer(sim);
  const p = polarOf(m0.pickup.pos);
  park(sim, { slew: p.slew, radius: p.radius });
  until(sim, atNode('onHook'), 14);

  const cases = [
    ['block inboard of the load', { slew: p.slew, radius: p.radius - 12 }, /Trolley out/i],
    ['block outboard of the load', { slew: p.slew, radius: p.radius + 12 }, /Trolley in/i],
    ['jib swung past it', { slew: p.slew + 0.35, radius: p.radius }, /Swing left/i],
    ['jib swung short of it', { slew: p.slew - 0.35, radius: p.radius }, /Swing right/i]
  ];
  const wrong = [];
  for (const [label, parkTo, want] of cases) {
    park(sim, parkTo);
    sim.bus.emit('hook.attach', {});
    until(sim, () => false, 2.5);
    const cap = sim.state.radio.caption || '';
    if (!want.test(cap)) wrong.push(`${label}: "${cap}"`);
  }
  rec('ground says which way to bring the hook, not just that it is not there',
    wrong.length === 0, wrong.length ? JSON.stringify(wrong, null, 1)
      : 'all four misses named the correction the operator has a control for');

  // And it carries a distance, from the same buckets the guide calls use, so the
  // clip that plays is one that exists.
  const { CLIP_SECONDS } = await import(pathToFileURL(join(HERE, '..', 'data/clips.js')).href);
  park(sim, { slew: p.slew, radius: p.radius - 12 });
  sim.bus.emit('hook.attach', {});
  until(sim, () => false, 2.5);
  const said = sim.log.filter((e) => e.name === 'radio.say').map((e) => e.payload.key);
  const directed = said.filter((k) => /^(SWING|TROLLEY)_/.test(k));
  rec('and every hook correction it plays is a clip that exists',
    directed.length > 0 && directed.every((k) => k in CLIP_SECONDS),
    `played ${JSON.stringify([...new Set(directed)])}`);
}

// ---------- how often ground talks ----------

// One rate for everything meant a call every 3 s, each running about 2 of them,
// so ground was on the air two thirds of every cycle telling an operator forty
// metres out something he could not act on yet. The pace now follows how much
// room is left.
async function tGroundTalksLessWhenThereIsRoom() {
  const count = async (radius) => {
    const sim = await startMission(0);
    answer(sim);
    const p = polarOf(m0.pickup.pos);
    park(sim, { slew: p.slew, radius });
    until(sim, atNode('toPickup'), 8);
    const before = sim.log.filter((e) => e.name === 'radio.say').length;
    until(sim, () => false, 30, () => park(sim, { slew: p.slew, radius }));
    return sim.log.filter((e) => e.name === 'radio.say').length - before;
  };
  const far = await count(8);      // a long way in from the mark
  const near = await count(20);    // just short of it
  rec('ground talks less when the operator has room, and more as it closes',
    far < near && far <= 6 && near >= far + 2,
    `${far} calls in 30 s a long way out, ${near} close in`);
}

// And he does not say the identical sentence twice running. Same direction, same
// bucket, is the same words; the operator heard them and nothing has changed.
async function tGroundDoesNotRepeatTheSameCall() {
  const sim = await startMission(0);
  answer(sim);
  const p = polarOf(m0.pickup.pos);
  park(sim, { slew: p.slew, radius: 8 });
  until(sim, atNode('toPickup'), 8);
  const before = sim.log.filter((e) => e.name === 'radio.say').length;
  // Park still, so the correction never changes. Worst case for repetition.
  until(sim, () => false, 40, () => park(sim, { slew: p.slew, radius: 8 }));
  const calls = sim.log.filter((e) => e.name === 'radio.say').slice(before);
  const keys = calls.map((e) => e.payload.key);
  // Every call here is the same key by construction, so counting list positions
  // proves nothing: what matters is the wall clock between them. Parked at this
  // error the cadence alone would put a call out roughly every 5 s, so a gap
  // that never drops near that is the holdoff doing its job.
  const gaps = calls.slice(1).map((e, i) => +(e.t - calls[i].t).toFixed(2));
  const tightest = gaps.length ? Math.min(...gaps) : Infinity;
  rec('ground does not say the same correction on consecutive breaths',
    keys.length > 1 && new Set(keys).size === 1 && tightest >= 8,
    `${keys.length} calls parked still over 40 s, all "${keys[0]}", gaps ${JSON.stringify(gaps)}`);
}

// The blind shaft. Nine metres into a hole with the hook cam refused, and ground
// used to say "down easy, keep her plumb" and then nothing at all until the last
// three metres. He was the only one who could see it.
async function tGroundTalksTheBlindLoadDown() {
  const m3 = MISSIONS[3];
  const sim = await startMission(3);
  answer(sim);
  const pk = polarOf(m3.pickup.pos);
  park(sim, { slew: pk.slew, radius: pk.radius });
  until(sim, atNode('onHook'), 16);
  rig(sim, 3);
  until(sim, (s) => s.load.attached, 6);
  until(sim, atNode('upEasy'), 10);
  park(sim, { slew: pk.slew, radius: pk.radius, line: 30 });
  const ld = polarOf(m3.landing.pos);
  until(sim, atNode('toLanding'), 20);
  until(sim, (s) => ['centred', 'downEasy'].includes(node(s)), 60,
    () => park(sim, { slew: ld.slew, radius: ld.radius, line: 30 }));
  until(sim, atNode('downEasy'), 30,
    () => park(sim, { slew: ld.slew, radius: ld.radius, line: 30 }));

  const before = sim.log.filter((e) => e.name === 'radio.say').length;
  // Lower it the way a person lowers it, on the control, not by teleport.
  until(sim, (s) => node(s) !== 'downEasy' || s.mission.result !== null, 90,
    (s) => { s.intent.hoist = -1; s.intent.range = 'I'; });
  const said = sim.log.filter((e) => e.name === 'radio.say').slice(before)
    .map((e) => e.payload.key);
  const counted = said.filter((k) => k.startsWith('TOGO_'));
  // Monotonic: a countdown that goes back up is worse than no countdown.
  const R = await import(pathToFileURL(join(HERE, '..', 'data/radio.js')).href);
  const order = new Map(R.DISTANCE_BUCKETS.imperial.map((b, i) => [`TOGO_${b.tag}`, i]));
  let descending = true;
  for (let i = 1; i < counted.length; i += 1) {
    if ((order.get(counted[i]) ?? -1) >= (order.get(counted[i - 1]) ?? -1)) descending = false;
  }
  rec('ground counts a blind load down instead of watching it in silence',
    counted.length >= 2 && descending,
    `during the descent he said ${JSON.stringify(said)}`);
}

const all = [tBoot, tTimeouts, tGuideAndHook, tFullLift, tTruckHookNoAlarm,
  tReHookAnswered, tHoistCorrection, tNoReplayedAlarm, tAllStopNotPostponable,
  tAllStopCleared, tPhantomKey, tRealCollisionStillCounts,
  tReturnCannotKillRadio, tMission1NoSilentCollision, tHoistBudgetResets,
  tGuideSayAgainFree, tEmptyBlockAccel,
  tRestingIsNotColliding, tShaftReachable, tNoTeleportOntoRoof,
  tFlyTruck, tFlyScaffold, tFlyBlindShaft,
  tGradeRubric, tFlowAndResume, tRefreshKeepsProgress, tAchievementOnce,
  tSaveSurvivesGarbage, tGusts,
  tEmptySwingIsNotAnAllStop, tEmptySwingIsNotCharged,
  tRopeStops, tRopeStopsOnALandedLoad, tNoSoftBandOnTop, tFootprintNotAPoint,
  tHoistBudgetCannotRatchet, tHoistBudgetAllowsACorrection,
  tSayAgainInAGateIsFree, tGroundSignsOff, tGuideDoesNotWhipsaw, tHeldMicIsNotADouble,
  tFailCardIsNotAReplay, tGradeMovesInsideTheWin, tAchievementsAreNotFree,
  tDogEverythingWithTheMushroomDown, tHooksCountRigs, tBlockedStorageSaysSo,
  tGuideKeepsTalkingWhenShort, tLandedLoadCanBeNudged, tSignOffIsNotAFaultSurface,
  tHookRetryIsNeverLost, tCorruptAwardStaysAwarded, tBuildStampIsStampable,
  tPendulumPeriod, tCentrifugalLean, tCoriolis, tRopeCoupling, tSwingDecay,
  tSwingKeepsItsPlane, tLeanIsNotSway, tLoadRisesAtTheEndsOfItsArc,
  tServiceWorkerReachesTheNetwork,
  tEveryClipExists, tTransmissionMatchesTheClip, tAnswerOverGroundIsFree,
  tKeyingOverGroundIsFree, tGuideDistanceMatchesItsClip,
  tGroundKeepsOneSetOfUnits, tCloseInCallSaysTheRealDistance,
  tGroundSaysItAtMostTwiceMore, tACappedCallStillOpensItsGate, tTheAlarmIsNotCapped,
  tTheHookRetryOutlivesTheVoice, tSayAgainStillWorksAfterTheCap,
  tTheHookCallSaysWhichWay,
  tGroundTalksLessWhenThereIsRoom, tGroundDoesNotRepeatTheSameCall,
  tGroundTalksTheBlindLoadDown];

for (const t of all) {
  try { await t(); } catch (e) { rec(`${t.name} (crashed)`, false, String(e).split('\n')[0]); }
}
const bad = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - bad}/${results.length} checks passed`);
process.exit(bad ? 1 : 0);
