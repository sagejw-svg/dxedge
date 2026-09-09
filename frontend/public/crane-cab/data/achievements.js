// Achievement data only. No logic. scoring.js walks this list once at the end of
// a won lift and awards anything not already on the board.
//
// The first ten names are from the Notion Design Prompt, which names them and
// defines no conditions; the conditions here are invented, and so is everything
// after them. Under hard rule 3 this belongs in data/ with the missions and the
// radio script: it is content, and it was in js/scoring.js by mistake.
//
// Each entry:
//   name  what the card and the board call it. Also the save key, so renaming
//         one costs the player the award. Do not rename.
//   how   one line, addressed to the operator, for the board on the title card.
//   when  (record) => boolean. The record is built in scoring.js at the end of a
//         won lift; see RECORD in that file for the fields available. A lift that
//         is lost awards nothing, so no condition needs to check that it was won.
//
// Rule for a new condition: it must ask for something the operator did, not for
// something the game did to him, and it must not restate the win. Two of the
// originals asked for not having two-blocked and not having gone over the chart,
// both of which fail the lift outright, so every winning lift earned them for
// free and a player's first finished flight unlocked half the board.

const DEG = Math.PI / 180;
const CHART_CLEAR = 75;    // percent of rated "Chart Legal" asks you to stay under
const BLOCK_CLEAR = 1.5;   // m of rope above the two-block stop "No Two-Block" wants
const PLUMB_SHARE = 1 / 3; // of the mission tolerance "Dead Plumb" asks for

export const ACHIEVEMENTS = [
  // One per job. These are the map, so they read as a list of what there is to do.
  { name: 'Radio Check', how: 'Finish the tutorial lift.', when: (r) => r.missionId === 0 },
  { name: 'First Hook', how: 'Get the beam off the truck.', when: (r) => r.missionId === 1 },
  { name: 'Scaffold Kiss', how: 'Land on the scaffold deck.', when: (r) => r.missionId === 2 },
  { name: 'Blind Trust', how: 'Put a load down a shaft you cannot see into.', when: (r) => r.missionId === 3 },
  { name: 'Out At Range', how: 'Work a heavy pick at the end of the jib.', when: (r) => r.missionId === 4 },
  { name: 'Threading It', how: 'Set a load down between the stacks.', when: (r) => r.missionId === 5 },
  { name: 'Round The Core', how: 'Get a load past the core without touching it.', when: (r) => r.missionId === 6 },

  // Craft.
  { name: 'Zero Swing', how: 'Win a lift that never swung a full degree.', when: (r) => r.maxSway < 1 * DEG },
  { name: 'Dead Plumb', how: 'Set a load down inside a third of the tolerance.',
    when: (r) => r.landingError !== null && r.landingTol > 0 &&
      r.landingError <= r.landingTol * PLUMB_SHARE },
  { name: 'No Two-Block', how: 'Win with a metre and a half of rope still above the stop.',
    when: (r) => r.closestBlock >= BLOCK_CLEAR },
  { name: 'Chart Legal', how: 'Win without going past seventy five percent of rated.',
    when: (r) => r.maxCapacityPct < CHART_CLEAR },
  { name: 'On The Clock', how: 'Beat the par time for the job.',
    when: (r) => r.par > 0 && r.elapsed > 0 && r.elapsed <= r.par },

  // Radio.
  { name: 'Dog Everything', how: 'Answer an ALL STOP with the mushroom.', when: (r) => r.allStopsAnswered > 0 },
  { name: 'Clean Sheet', how: 'Grade A with no radio faults.', when: (r) => r.grade === 'A' && r.radioFaults === 0 },
  // The one that teaches what ackBy is for: ground called the move, the load
  // moved, and nobody took a hand off the levers to press a button about it.
  { name: 'Hands On', how: 'Answer every movement call with the levers, not the button.',
    when: (r) => r.actedCalls >= 2 && r.repliesGiven === 0 && r.radioFaults === 0 },
  { name: 'Heard You', how: 'Win a lift without once asking ground to say again.',
    when: (r) => r.sayAgains === 0 && r.radioFaults === 0 },

  // The long game.
  { name: 'Ten Hooks', how: 'Rig ten loads.', when: (r) => r.hooksEver >= 10 },
  { name: 'Hundred Hooks', how: 'Rig a hundred loads.', when: (r) => r.hooksEver >= 100 },
  { name: 'Every Job', how: 'Win every lift on the board.',
    when: (r) => r.missionCount > 0 && r.missionsWon >= r.missionCount }
];
