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

const DEG = Math.PI / 180;
const SWAY_OK = 3 * DEG;
const SWAY_BAD = 6 * DEG;
const CAP_OK = 90;
const GRADES = ['A', 'B', 'C', 'D'];

// Achievement conditions. The ten names are from the Notion Design Prompt; the
// conditions are invented, because the page names them and defines none.
const ACHIEVEMENTS = [
  { name: 'Radio Check', when: (r) => r.missionId === 0 },
  { name: 'First Hook', when: (r) => r.missionId === 1 },
  { name: 'Scaffold Kiss', when: (r) => r.missionId === 2 },
  { name: 'Blind Trust', when: (r) => r.missionId === 3 },
  { name: 'Zero Swing', when: (r) => r.maxSway < 1 * DEG },
  { name: 'No Two-Block', when: (r) => r.twoBlocks === 0 },
  { name: 'Chart Legal', when: (r) => r.maxCapacityPct < CAP_OK },
  { name: 'Dog Everything', when: (r) => r.allStopsAnswered > 0 },
  { name: 'Clean Sheet', when: (r) => r.grade === 'A' && r.radioFaults === 0 && r.twoBlocks === 0 },
  { name: 'Hundred Hooks', when: (r) => r.hooksEver >= 100 }
];

let allStopsAnswered = 0;   // ALL STOPs this lift that the operator actually answered
let allStopOpen = false;

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
    allStopsAnswered = 0;
    allStopOpen = false;
  });

  bus.on('collision.counted', () => { sc.collisions += 1; });
  bus.on('alarm.a2b', () => { sc.twoBlocks += 1; });
  bus.on('radio.fault', () => { sc.radioFaults += 1; });

  // An ALL STOP that the operator answered with the mushroom, which is the one
  // thing "Dog Everything" can reasonably mean.
  bus.on('radio.allStop', () => { allStopOpen = true; });
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

export function update(ctx) {
  const { state } = ctx;
  if (state.mission.id === null || state.mission.result !== null) return;
  if (state.sensors.swayAngle > state.scoring.maxSway) {
    state.scoring.maxSway = state.sensors.swayAngle;
  }
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
  if (err !== null && err > tol * 2) demerits.push({ cost: 2, why: 'well off the pad' });
  else if (err !== null && err > tol) demerits.push({ cost: 1, why: 'off the pad' });
  if (sc.maxSway > SWAY_BAD) demerits.push({ cost: 2, why: 'swinging hard' });
  else if (sc.maxSway > SWAY_OK) demerits.push({ cost: 1, why: 'swinging' });
  if (sc.radioFaults >= 3) demerits.push({ cost: 2, why: 'radio discipline' });
  else if (sc.radioFaults >= 1) demerits.push({ cost: 1, why: 'a radio fault' });
  if (m.maxCapacityPct >= CAP_OK) demerits.push({ cost: 1, why: 'over ninety percent' });

  const total = demerits.reduce((a, d) => a + d.cost, 0);
  sc.grade = GRADES[Math.min(GRADES.length - 1, total)];
  sc.demerits = demerits;

  // Achievements. The record is everything a condition may look at.
  const hooksEver = (state.progress.hooks || 0) + 1;
  const record = {
    missionId: m.id,
    grade: sc.grade,
    maxSway: sc.maxSway,
    radioFaults: sc.radioFaults,
    twoBlocks: sc.twoBlocks,
    maxCapacityPct: m.maxCapacityPct,
    landingError: sc.landingError,
    elapsed: sc.elapsed,
    allStopsAnswered,
    hooksEver
  };
  bus.emit('lift.hooked.count', { hooks: hooksEver });

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
    missionName: m.name || null,
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
    best: state.progress.best[m.id] || null
  };
}
