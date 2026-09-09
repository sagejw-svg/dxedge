// A pilot that flies with the controls. No teleporting.
//
// test/regress.mjs's flyMission park()s the crane onto its marks, which proves a
// script can complete and a landing can be scored but says nothing about whether
// a job is flyable: it never occupies the space between the pickup and the
// landing, so it cannot hit anything, and it cannot be misdirected because it
// never listens. Mission 6 put a thirty eight metre core across the short arc and
// park() flew straight through it in one tick.
//
// So this one holds the levers. Radius and rope it works out for itself, the way
// a player reads them off the gauges. SLEW it takes from ground: it swings in the
// direction of the last guide call and no other. That is the whole point. If
// obeying the radio's slew direction puts the load into a building, this fails.
//
// It is a competent operator and not a good one: it works one axis at a time, it
// does not anticipate, and it lets everything settle before it comes down. Times
// out of it are an upper bound on a par, not a target.

import { DISTANCE_BUCKETS } from '../data/radio.js';

const DEG = Math.PI / 180;
const NUDGE_M = 0.8;   // how far a correction with no number on it is worth

// Every bucket tag ground can put on the end of a call, and how far it means.
// The pilot obeys the distance as well as the direction, which is what an
// operator does with "trolley in ten feet": he goes ten feet and waits to be
// told again, rather than running until someone stops him.
const BUCKET_M = new Map();
for (const list of Object.values(DISTANCE_BUCKETS)) {
  for (const b of list) BUCKET_M.set(b.tag, b.value);
}

function parseGuide(key) {
  const k = String(key || '');
  let axis = null;
  let sign = 0;
  if (k.startsWith('SWING_LEFT')) { axis = 'slew'; sign = -1; }
  else if (k.startsWith('SWING_RIGHT')) { axis = 'slew'; sign = 1; }
  else if (k.startsWith('TROLLEY_IN')) { axis = 'trolley'; sign = -1; }
  else if (k.startsWith('TROLLEY_OUT')) { axis = 'trolley'; sign = 1; }
  else return null;
  const tag = k.split('_').pop();
  if (BUCKET_M.has(tag)) return { axis, sign, metres: BUCKET_M.get(tag) };
  // "Keep coming": further than ground's biggest bucket, so run until he speaks
  // again. Anything else is a bare correction with no number on it, which ground
  // only says under three metres - a nudge, not a run. Treating those as "keep
  // coming" is what had this pilot sailing four metres past the mark, hearing
  // the opposite call, sailing back, and doing that for the whole lift.
  if (tag === 'ON') return { axis, sign, metres: Infinity };
  return { axis, sign, metres: NUDGE_M };
}

export function makePilot(sim, mission, opts = {}) {
  const answerWith = opts.answerWith || 'levers';   // 'levers' | 'button'
  const pick = mission.pickup.pos;
  const land = mission.landing.pos;
  const TOP = 43.8;                                  // cabHeight + hookDrop
  // Rope that puts the block in the hook window, and rope that puts the load on
  // the pad. Both from the mission's own geometry, the way the gauges read.
  const hookLine = TOP - (pick[1] + mission.load.size[1]) + 0.05;
  const restLine = TOP - (land[1] + mission.load.size[1]) + 0.30;
  // Fly high enough to clear the tallest thing it will actually pass over. A
  // structure taller than this is one you go round, not over, and treating a
  // thirty eight metre core as something to clear put this pilot at four metres
  // of rope, hard against the two-block, for a whole lift.
  const OVER_MAX = 20;
  const tallest = (mission.deck || [])
    .filter((d) => d.max[1] <= OVER_MAX)
    .reduce((h, d) => Math.max(h, d.max[1]), 0);
  const flyBottom = Math.max(pick[1], land[1], tallest) + 4;
  const flyLine = Math.max(4, TOP - (flyBottom + mission.load.size[1]));

  let order = null;          // ground's last correction, and what is left of it
  let settling = false;      // hands off until she stops swinging
  const log = [];

  sim.bus.on('radio.say', (p) => {
    const g = parseGuide(p.key);
    if (!g) return;
    const c = sim.state.crane;
    order = {
      axis: g.axis,
      sign: g.sign,
      metres: g.metres,
      fromSlew: c.slew,
      fromRadius: c.hangRadius,
      hang: Math.max(1, c.hangRadius)
    };
    log.push({ t: +sim.state.time.t.toFixed(1), key: p.key });
  });

  // How much of the last order is still outstanding, in metres of load. null
  // when ground gave no number, which means keep going until he says otherwise.
  function leftToRun(c) {
    if (!order) return 0;
    if (order.metres === null) return Infinity;
    const gone = order.axis === 'slew'
      ? Math.abs(c.slew - order.fromSlew) * order.hang
      : Math.abs(c.hangRadius - order.fromRadius);
    return order.metres - gone;
  }

  let answered = null;

  return function step(s) {
    const n = s.radio.node;
    const c = s.crane;
    const i = s.intent;
    i.slew = 0; i.trolley = 0; i.hoist = 0; i.range = 'I';

    // The briefing calls have no lever answer, so they always take a button.
    // Movement calls take one only if this pilot was asked to fly that way.
    if (s.radio.ackTimer > 0 && answered !== n) {
      const movement = ['upEasy', 'checkLift', 'hold', 'downEasy', 'centred'].includes(n);
      if (!movement || answerWith === 'button') { i.reply = 0; answered = n; }
    }

    // ALL STOP. Everything to neutral and left there until ground stands it
    // down. Freezing the horizontal axes and leaving the rope running is not an
    // answer, and it is exactly what this pilot used to do.
    if (n === 'allStop') { i.slew = 0; i.trolley = 0; i.hoist = 0; return; }

    // A stop call is a stop call. The trial lift and the two hold calls all ask
    // for everything still, and the operator answers them by taking his hands
    // off rather than by pressing anything, so this pilot does the same.
    if (n === 'checkLift' || n === 'hold' || n === 'centred') {
      i.slew = 0; i.trolley = 0; i.hoist = 0;
      return;
    }

    const toPickup = !s.load.attached || n === 'toPickup' || n === 'onHook' || n === 'upEasy';
    const target = toPickup ? pick : land;
    const targetRadius = Math.hypot(target[0], target[2]);
    const hang = c.hangRadius;
    const dRadius = targetRadius - hang;
    const bearing = Math.atan2(target[2], target[0]);
    const dAngleShort = Math.atan2(Math.sin(bearing - c.slew), Math.cos(bearing - c.slew));

    // A swinging load is flown by not flying it. This is the one thing a pilot
    // made of arithmetic gets wrong without being told: it chases the mark with
    // the load already going the other way and pumps the swing until ground
    // calls an ALL STOP on it. Hands off at a degree and a half, back on at half
    // of one, which is roughly how long a human waits.
    if (s.load.attached) {
      if (s.sensors.swayAmplitude > 1.5 * DEG) settling = true;
      else if (s.sensors.swayAmplitude < 0.5 * DEG) settling = false;
    } else {
      settling = false;
    }

    // --- slew: ground's direction, this pilot's throttle -------------------
    // Braking distance from the current rate, so it stops on the mark rather
    // than sailing past it and asking ground to turn it round.
    // Obeying the radio. Inside a guide node this pilot flies the axis, the
    // direction AND the distance ground gave it, and nothing else: that is the
    // whole point of it existing. It used to take only the slew direction and
    // work the trolley out from the mission geometry, which meant it quietly
    // ignored "trolley in ten feet" whenever its own arithmetic wanted out - and
    // on the core job its own arithmetic wanted out, straight through a
    // building, while ground said come in for eight minutes.
    const guiding = n === 'toPickup' || n === 'toLanding';
    const stopIn = (c.slewVel * c.slewVel) / (2 * 0.06);
    const remaining = Math.abs(dAngleShort);
    const remainingM = remaining * Math.max(1, hang);

    if (guiding) {
      const left = order ? leftToRun(c) : 0;
      if (order && !settling && left > 0.08) {
        // Range II only on a dead load and a long way to run. Whipping a range
        // II slew into a load that is already moving builds the swing you then
        // cannot lose.
        const quiet = s.sensors.swayAmplitude < 0.8 * DEG;
        const far = left === Infinity ? 99 : left;
        if (order.axis === 'slew') {
          const brakeM = stopIn * Math.max(1, hang);
          if (far > brakeM + 0.06) {
            i.slew = order.sign;
            i.range = (quiet && far > 30) ? 'II' : far > 2.5 ? 'I' : 'micro';
          }
        } else {
          const brakeR = (c.radiusVel * c.radiusVel) / (2 * 0.6);
          if (far > brakeR + 0.05) {
            i.trolley = order.sign;
            i.range = (quiet && far > 12) ? 'II' : far > 2.0 ? 'I' : 'micro';
          }
        }
      }
    } else {
      // Off the guide, fly the geometry: ground is calling movements, not
      // positions, and the pilot has to hold its own station.
      if (!settling && remainingM > 0.08 && remaining > stopIn + 0.06 / Math.max(1, hang)) {
        i.slew = Math.sign(dAngleShort);
        i.range = remainingM > 2.5 ? 'I' : 'micro';
      }
      const stopR = (c.radiusVel * c.radiusVel) / (2 * 0.6);
      if (!settling && Math.abs(dRadius) > stopR + 0.05) {
        i.trolley = Math.sign(dRadius);
        i.range = Math.abs(dRadius) > 12 ? 'II' : Math.abs(dRadius) < 2.0 ? 'micro' : 'I';
      }
    }

    // --- rope --------------------------------------------------------------
    let wantLine = flyLine;
    if (!s.load.attached) wantLine = n === 'onHook' ? hookLine : flyLine;
    else if (n === 'upEasy') wantLine = flyLine;
    else if (n === 'downEasy' || n === 'lastCall' || n === 'good') wantLine = restLine;
    // Hands off and let her die: the trial lift and the two hold calls.
    else if (n === 'checkLift' || n === 'hold' || n === 'centred') wantLine = c.line;

    const dLine = wantLine - c.line;
    if (Math.abs(dLine) > 0.05) {
      // hoist is +1 up, and up shortens the rope.
      i.hoist = dLine > 0 ? -1 : 1;
      const far = Math.abs(dLine);
      i.range = far > 10 ? 'II' : far < 1.0 ? 'micro' : 'I';
      // Never come down on the pad at speed, and never move the rope while the
      // load is still swinging on a set-down.
      if (dLine > 0 && (n === 'downEasy' || n === 'lastCall')) {
        if (s.sensors.swayAmplitude > 1.0 * DEG) i.hoist = 0;
        else i.range = far > 6 ? 'I' : 'micro';
      }
    }

    log.length = Math.min(log.length, 400);
  };
}

export function guideLog(pilotLog) { return pilotLog; }
