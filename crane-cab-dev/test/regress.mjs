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
  // Take a little rope back in, the way anyone would.
  until(sim, (s) => s.crane.line < 43.0 || s.mission.result !== null, 12,
    (s) => { s.intent.hoist = 1; s.intent.range = 'I'; });
  sim.state.intent.hoist = 0;
  const corrected = sim.state.mission.result;
  rec('a small correction upward with an empty block is allowed',
    corrected === null, `result ${corrected} line ${sim.state.crane.line.toFixed(2)}`);
  // Hauling away is still a fail.
  until(sim, (s) => s.mission.result !== null, 20,
    (s) => { s.intent.hoist = 1; s.intent.range = 'II'; });
  rec('hauling the empty block away still fails the lift',
    sim.state.mission.result === 'fail' &&
    sim.state.mission.failReason === 'hoist before on the hook',
    `result ${sim.state.mission.result} reason ${sim.state.mission.failReason}`);
}

// Handlers must never land on the return stack.
async function tNoReplayedAlarm() {
  const sim = await startMission(0);
  answer(sim);
  const p = polarOf(m0.pickup.pos);
  park(sim, { slew: p.slew, radius: 18 });
  until(sim, atNode('toPickup'), 8);
  until(sim, () => false, 2);
  sim.state.load.swing.x = 0.2;                       // 11.5 deg
  until(sim, atNode('allStop'), 8);
  // Talk over the ALL STOP, then E-stop out of it.
  until(sim, () => false, 0.2, (s) => { s.intent.reply = 0; });
  until(sim, atNode('sayAgain'), 4);
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

// alarm, talk over it, let the say again return, THEN hit the mushroom.
async function tReturnCannotKillRadio() {
  const sim = await startMission(0);
  answer(sim);
  const p = polarOf(m0.pickup.pos);
  park(sim, { slew: p.slew, radius: 18 });
  until(sim, atNode('toPickup'), 8);
  until(sim, () => false, 2);
  sim.state.load.swing.x = 0.2;
  until(sim, atNode('allStop'), 8);
  until(sim, () => false, 0.2, (s) => { s.intent.reply = 0; });   // double on the alarm
  until(sim, atNode('sayAgain'), 4);
  until(sim, (s) => node(s) !== 'sayAgain', 6);                   // let its RETURN run
  sim.state.intent.estop = true;                                  // now the mushroom
  until(sim, () => false, 4);
  const s = sim.state;
  const alive = s.radio.node !== null && s.radio.script !== null;
  rec('the mushroom after a doubled alarm does not kill the radio',
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
async function flyMission(id, budget = 240) {
  const m = MISSIONS.find((x) => x.id === id);
  const sim = await startMission(id);
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

  // Deterministic: a retry is the same weather, not a different mission.
  const again = await startMission(2);
  const rs = [];
  until(again, () => false, 0.05);
  until(again, () => false, 10, (s) => rs.push(s.sensors.wind));
  const same = rs.every((v, i) => Math.abs(v - gs[i]) < 1e-9);
  rec('and the same mission blows the same way on a retry',
    same, same ? 'identical' : 'diverged');
}

// ---------------------------------------------------------------- run

const all = [tBoot, tTimeouts, tGuideAndHook, tFullLift, tTruckHookNoAlarm,
  tReHookAnswered, tHoistCorrection, tNoReplayedAlarm, tAllStopNotPostponable,
  tAllStopCleared, tPhantomKey, tRealCollisionStillCounts,
  tReturnCannotKillRadio, tMission1NoSilentCollision, tHoistBudgetResets,
  tGuideSayAgainFree, tEmptyBlockAccel,
  tRestingIsNotColliding, tShaftReachable, tNoTeleportOntoRoof,
  tFlyTruck, tFlyScaffold, tFlyBlindShaft,
  tGradeRubric, tFlowAndResume, tRefreshKeepsProgress, tAchievementOnce,
  tSaveSurvivesGarbage, tGusts];

for (const t of all) {
  try { await t(); } catch (e) { rec(`${t.name} (crashed)`, false, String(e).split('\n')[0]); }
}
const bad = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - bad}/${results.length} checks passed`);
process.exit(bad ? 1 : 0);
