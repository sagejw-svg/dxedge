// Flies every job with the controls, start to finish, and prints the card.
//
//   node test/fly.mjs            # all seven
//   node test/fly.mjs 6          # one
//   node test/fly.mjs 6 button   # answer the movement calls with the strip
//
// Slower than test/regress.mjs by a long way - a lift is three to twelve minutes
// of sim - so it is not in the suite. Run it when the missions or the guide
// change. What it is for is the class of thing the suite cannot see: regress.mjs
// park()s the crane onto its marks, so it never occupies the space between two
// points and cannot be misdirected, and mission 6 shipped with a guide that
// called the operator through a building because nothing in the suite ever flew
// the arc. See test/pilot.mjs for what this pilot will and will not do.
import { makeSim } from './harness.mjs';
import { makePilot } from './pilot.mjs';
import { MISSIONS } from '../data/missions.js';

const wanted = process.argv[2] ? [Number(process.argv[2])] : MISSIONS.map((m) => m.id);
const answerWith = process.argv[3] || 'levers';
const BUDGET = Number(process.env.BUDGET || 900);
const DEG = 180 / Math.PI;
let bad = 0;

for (const id of wanted) {
  const m = MISSIONS.find((x) => x.id === id);
  const sim = await makeSim();
  sim.state.phase = 'playing';
  sim.modules.missions.start(sim.ctx, id);
  const step = makePilot(sim, m, { answerWith });
  for (let k = 0; k < Math.round(BUDGET / sim.STEP); k += 1) {
    if (sim.state.mission.result !== null) break;
    step(sim.state);
    sim.tick();
  }
  const s = sim.state;
  const sc = s.scoring;
  const won = s.mission.result === 'win';
  if (!won) bad += 1;
  console.log(
    `${won ? 'WIN ' : 'LOSS'} m${id} ${m.name.padEnd(19)}` +
    ` ${s.mission.failReason ? '(' + s.mission.failReason + ')' : ''}`.padEnd(26) +
    ` t=${s.mission.elapsed.toFixed(0)}s par=${m.par}` +
    ` grade=${sc.grade || '-'}` +
    ` sway=${(sc.maxSway * DEG).toFixed(1)}deg` +
    ` faults=${sc.radioFaults}` +
    ` cap=${s.mission.maxCapacityPct.toFixed(0)}%` +
    ` err=${sc.landingError === null ? '-' : sc.landingError.toFixed(2)}m`
  );
}
console.log(`\n${wanted.length - bad}/${wanted.length} jobs flown to a win`);
process.exit(bad ? 1 : 0);
