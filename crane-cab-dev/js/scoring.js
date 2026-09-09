// PHASE 4. Owns state.scoring. Listens on the bus, never polls other systems'
// internals and never imports one. Persistence goes out as events for save.js.
//
// The grade is a demerit count, not a score. The Notion page asks for "a letter
// grade on the after-action card" and specifies no thresholds, no formula and no
// weighting, so this is invented; it is deliberately the simplest thing that can
// tell the operator in one line what cost them the letter. There is no number,
// because the page lists leaderboards under Skip and a number invites one.
//
//   Start at A. Each of these costs a letter, twice as much if badly missed:
//     landingError over the mission tolerance
//     maxSway over 3 degrees
//     any radio fault
//     over 90 percent of rated at any point
//   Floor at D. A collision, a two-block, an LMI lockout or an ignored ALL STOP
//   is a fail, not a grade, so none of them appears here.

// Hard rule 3: the achievement names, wording and conditions are content and
// live in data/. This file only walks the list.
import { ACHIEVEMENTS } from '../data/achievements.js';
// Data, not a system: how many jobs there are to win, for "Every Job".
import { MISSIONS } from '../data/missions.js';

const DEG = Math.PI / 180;
const SWAY_OK = 3 * DEG;
const SWAY_BAD = 6 * DEG;

// These have to sit INSIDE the winning range, not on its edge. The first version
// charged a demerit for a landing outside the mission tolerance and for going
// over ninety percent of rated, which are the two things missions.js fails the
// lift for, and a fail gets no grade at all. So half the rubric could never fire
// and the letter moved only on sway and radio faults: a lift landed 0.34 m off a
// 0.35 m pad graded A with "Nothing to pick at."
const LANDING_LOOSE = 0.5;       // of the mission tolerance, one demerit past this
const LANDING_SLOPPY = 0.8;      // two past this
const CAP_WATCH = 75;            // percent of rated, one demerit past this
const CAP_HEAVY = 85;            // two past this
const GRADES = ['A', 'B', 'C', 'D'];

let allStopsAnswered = 0;   // ALL STOPs this lift that the operator actually answered
let allStopOpen = false;
let hookedThisLift = false; // one rig per lift, and it counts even if the lift fails
// The calls that went unanswered, in the order they lapsed, so the card can name
// the one that cost the grade instead of saying "a radio fault" and leaving the
// operator to guess which of a dozen calls it meant.
let faultCalls = [];
// Radio conduct this lift, for the achievements that ask how the operator ran
// the channel rather than how he flew. actedCalls is answers given with the
// levers, repliesGiven answers given with a button, sayAgains times ground was
// asked to repeat himself.
let actedCalls = 0;
let repliesGiven = 0;
let sayAgains = 0;

export function init(ctx) {
  const { state, bus } = ctx;
  const sc = state.scoring;

  bus.on('lift.start', () => {
    sc.maxSway = 0;
    sc.collisions = 0;
    sc.twoBlocks = 0;
    sc.radioFaults = 0;
    sc.landingError = null;
    sc.grade = null;
    sc.demerits = [];
    // These three were left over from the previous lift, so every fail card
    // congratulated the player on the achievements and the personal best they
    // had earned on the last lift they won, on every retry, until they won
    // another one.
    sc.earned = [];
    sc.personalBest = false;
    sc.elapsed = 0;
    sc.closestBlock = Infinity;
    allStopsAnswered = 0;
    allStopOpen = false;
    hookedThisLift = false;
    faultCalls = [];
    actedCalls = 0;
    repliesGiven = 0;
    sayAgains = 0;
  });

  bus.on('collision.counted', () => { sc.collisions += 1; });

  // A hook is a hook. This used to be counted on the win, so "Hundred Hooks"
  // wanted a hundred completed lifts and every load the player rigged and then
  // blew counted for nothing. missions.js answers an attach that has already
  // happened with the same event, hence the latch.
  bus.on('hook.attached', () => {
    if (hookedThisLift) return;
    hookedThisLift = true;
    bus.emit('lift.hooked.count', { hooks: (state.progress.hooks || 0) + 1 });
  });
  bus.on('alarm.a2b', () => { sc.twoBlocks += 1; });
  bus.on('radio.acted', () => { actedCalls += 1; });
  bus.on('radio.reply', (p) => {
    if (p && p.label === 'Say again') sayAgains += 1;
    else repliesGiven += 1;
  });
  bus.on('radio.fault', (p) => {
    sc.radioFaults += 1;
    const call = shortCall(p && p.caption);
    if (call) faultCalls.push(call);
  });

  // An ALL STOP that the operator answered with the mushroom, which is the one
  // thing "Dog Everything" can reasonably mean.
  // Credited on the level, not only on the rising edge, because that is how
  // radio.js accepts the answer. The mushroom is a toggle, and the one ALL STOP
  // a winnable lift can raise is the sway interrupt, which an operator who has
  // already stopped the machine to let a big swing settle has answered before
  // ground finished asking. Ground said "all stop received"; the card did not.
  bus.on('radio.allStop', () => {
    if (state.intent.estop) { allStopsAnswered += 1; return; }
    allStopOpen = true;
  });
  bus.on('estop', () => { if (allStopOpen) { allStopsAnswered += 1; allStopOpen = false; } });
  bus.on('radio.ignoredAllStop', () => { allStopOpen = false; });

  bus.on('hook.released', () => {
    const m = state.mission;
    if (!m.landedAt || !m.landingPos) return;
    sc.landingError = Math.hypot(
      m.landedAt[0] - m.landingPos[0],
      m.landedAt[2] - m.landingPos[2]
    );
  });

  bus.on('lift.win', (p) => resolve(ctx, true, p));
  bus.on('lift.fail', (p) => resolve(ctx, false, p));
}

// The first sentence of a call, which is the part that names it. Captions run to
// two sentences on the briefing nodes and the whole thing would not fit the card.
function shortCall(caption) {
  if (!caption) return '';
  const first = String(caption).split(/(?<=[.?!])\s+/)[0] || String(caption);
  return first.length > 44 ? `${first.slice(0, 41).trimEnd()}...` : first;
}

export function update(ctx) {
  const { state } = ctx;
  if (state.mission.id === null || state.mission.result !== null) return;
  const sc = state.scoring;
  if (state.sensors.swayAmplitude > sc.maxSway) sc.maxSway = state.sensors.swayAmplitude;
  // Rope left above the two-block stop, at its worst. "No Two-Block" asks for
  // headroom rather than for not having failed.
  const head = state.crane.line - state.crane.minLine;
  if (head < sc.closestBlock) sc.closestBlock = head;
}

function resolve(ctx, won, payload) {
  const { state, bus } = ctx;
  const sc = state.scoring;
  const m = state.mission;

  sc.elapsed = m.elapsed;
  if (!won) {
    sc.grade = null;
    sc.demerits = [];
    return;
  }

  const tol = m.landingTol > 0 ? m.landingTol : 0.4;
  const demerits = [];
  const err = sc.landingError;
  if (err !== null && err > tol * LANDING_SLOPPY) demerits.push({ cost: 2, why: 'well off the mark' });
  else if (err !== null && err > tol * LANDING_LOOSE) demerits.push({ cost: 1, why: 'off the mark' });
  if (sc.maxSway > SWAY_BAD) demerits.push({ cost: 2, why: 'swinging hard' });
  else if (sc.maxSway > SWAY_OK) demerits.push({ cost: 1, why: 'swinging' });
  if (sc.radioFaults >= 3) demerits.push({ cost: 2, why: 'radio discipline' });
  else if (sc.radioFaults >= 1) {
    demerits.push({ cost: 1, why: faultCalls.length ? `no answer to "${faultCalls[0]}"` : 'a radio fault' });
  }
  if (m.maxCapacityPct >= CAP_HEAVY) demerits.push({ cost: 2, why: 'heavy on the chart' });
  else if (m.maxCapacityPct >= CAP_WATCH) demerits.push({ cost: 1, why: 'high on the chart' });

  const total = demerits.reduce((a, d) => a + d.cost, 0);
  sc.grade = GRADES[Math.min(GRADES.length - 1, total)];
  sc.demerits = demerits;

  // Achievements. The record is everything a condition may look at.
  const hooksEver = state.progress.hooks || 0;
  // A best is only ever written on a win, so counting them counts lifts won.
  const missionsWon = Object.keys(state.progress.best || {}).length +
    (state.progress.best && state.progress.best[m.id] ? 0 : 1);
  const record = {
    closestBlock: Number.isFinite(sc.closestBlock) ? sc.closestBlock : Infinity,
    missionId: m.id,
    grade: sc.grade,
    maxSway: sc.maxSway,
    radioFaults: sc.radioFaults,
    twoBlocks: sc.twoBlocks,
    maxCapacityPct: m.maxCapacityPct,
    landingError: sc.landingError,
    landingTol: tol,
    elapsed: sc.elapsed,
    par: m.par || 0,
    allStopsAnswered,
    actedCalls,
    repliesGiven,
    sayAgains,
    missionsWon,
    missionCount: MISSIONS.length,
    hooksEver
  };

  sc.earned = [];
  for (let i = 0; i < ACHIEVEMENTS.length; i += 1) {
    const a = ACHIEVEMENTS[i];
    if (state.progress.achievements[a.name]) continue;      // never re-award
    if (!a.when(record)) continue;
    sc.earned.push(a.name);
    bus.emit('achievement.earned', { name: a.name });
  }

  const best = state.progress.best[m.id];
  sc.personalBest = !best || record.elapsed < best.elapsed;
  if (sc.personalBest) bus.emit('lift.best', { id: m.id, record });
}

// The after-action card's content, as a plain object. ui.js renders it and does
// no arithmetic of its own.
export function afterAction(ctx) {
  const { state } = ctx;
  const sc = state.scoring;
  const m = state.mission;
  return {
    won: m.result === 'win',
    reason: m.failReason,
    missionId: m.id,
    elapsed: sc.elapsed || m.elapsed,
    maxSway: sc.maxSway,
    radioFaults: sc.radioFaults,
    landingError: sc.landingError,
    landingTol: m.landingTol,
    landedAt: m.landedAt,
    landingPos: m.landingPos,
    loadSize: state.load.size,
    grade: sc.grade,
    demerits: sc.demerits || [],
    earned: sc.earned || [],
    personalBest: !!sc.personalBest,
    savedOk: state.progress.savedOk !== false,
    best: state.progress.best[m.id] || null,
    // The whole board, in data order, with what is on it. ui.js renders and does
    // no arithmetic of its own, so the counting happens here.
    board: ACHIEVEMENTS.map((a) => ({
      name: a.name,
      how: a.how || '',
      got: !!state.progress.achievements[a.name],
      fresh: (sc.earned || []).includes(a.name)
    }))
  };
}
