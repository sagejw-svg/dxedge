// Single source of truth. Every system reads and writes here.
// Render and audio READ ONLY. Units inside the sim are SI (m, kg, s, rad).
// Display conversion happens in ui.js based on settings.units.

import { CRANE } from '../data/crane.js';

export function createState() {
  return {
    time: { t: 0, dt: 1 / 120, frame: 0, fps: 0 },

    // title | playing | paused | afteraction
    phase: 'title',

    // Produced by input.js. Consumed by everything else. Device-agnostic.
    intent: {
      slew: 0,        // -1..1  left / right
      trolley: 0,     // -1..1  in / out
      hoist: 0,       // -1..1  down / up
      range: 'I',     // 'micro' | 'I' | 'II'
      brake: false,   // slew brake toggle
      estop: false,   // mushroom E-stop, dogs everything
      ptt: false,
      hookCam: false, // C. render.js shows the inset; missions may forbid it
      reply: null,    // 0..7 or null, one-shot, cleared by radio.js
      look: { dx: 0, dy: 0 }, // drag or arrow-key look delta this frame
      lookAtLoad: false,      // V, a latching toggle: keep the head on the load
      lookAhead: false        // Z, a one-shot: put the head back down the jib
    },

    // Crane kinematics. crane.js owns this.
    crane: {
      slew: 0, slewVel: 0,           // rad, rad/s
      radius: 20, radiusVel: 0,      // trolley distance from mast, m
      // DEFLECTION shape change, declared under hard rule 6. The load bends the
      // jib down and the mast forward toward it, so the rope hangs from further
      // out than the trolley is: the radius the load actually swings on is
      // radius + deflection. crane.js computes both from the tension the rope is
      // really carrying; pendulum.js hangs the load from the deflected point and
      // render.js draws it there. Metres and metres per second, always >= 0.
      deflection: 0, deflectionVel: 0,
      // radius + deflection, published once so every system that asks "where is
      // the load" gets the same answer. Adding the two by hand at each call site
      // is how the drawn load and the scored load came to be a third of a
      // landing tolerance apart.
      hangRadius: 20,
      line: 30, lineVel: 0,          // rope paid out below trolley, m
      jibLength: CRANE.jibLength, minRadius: CRANE.minRadius,
      maxRadius: CRANE.maxRadius,    // trolley stop; data/crane.js is the one place to change it
      minLine: CRANE.minLine, maxLine: CRANE.maxLine,
      cabHeight: CRANE.cabHeight,    // seat height above deck, m
      brakeOn: false, estopped: false
    },

    // Load and pendulum. pendulum.js owns this.
    load: {
      attached: false, mass: 0, size: [1, 1, 1],
      swing: { x: 0, y: 0, vx: 0, vy: 0 }, // tangential / radial angles, rad
      onSurface: false, tension: 0,
      // RESTING shape change, declared under hard rule 6. Where the load came to
      // rest, in the jib frame, latched by pendulum.js the tick it settles and
      // cleared when it lifts again. null while it is in the air. A load on the
      // ground stays where it was put: the crane straightening as the weight
      // comes off it must not walk the crate across the pad.
      restJibX: null, restJibZ: null,
      // PHASE 4. Where the load's underside actually is, clamped at whatever it
      // is resting on. pendulum.js owns it; sensors, missions and render read it
      // instead of deriving a position from the rope length.
      bottomY: 0
    },

    // Derived readings. sensors.js owns this. ui.js displays it.
    sensors: {
      radius: 0, hookHeight: 0, heading: 0,
      actualLoad: 0, ratedLoad: 0, capacityPct: 0,
      lmiLock: false, a2b: false, slack: false, collision: false,
      wind: 0, swayAngle: 0, loadSway: 0, swayAmplitude: 0,
      maxLoadRadius: 0, reachPct: 0  // Phase 2B: how far out this load may go
    },

    // Radio director. radio.js owns this.
    // PHASE 3 additive fields: prevNode, repeats, groundTimer, playerTimer,
    // guideTimer, ackTimeout. Timers are seconds remaining, counted down by
    // radio.js. ackTimeout is the node's full ack window so ui.js can draw the
    // countdown bar without importing the script data.
    // FULL DUPLEX shape change, declared under hard rule 6: `garbled` is gone
    // and `answered` replaces it. Nothing garbles any more, because nothing
    // doubles; what the strip needs to show instead is the answer the operator
    // gave while ground was still talking, which is held until the call ends.
    // null when no answer is banked, otherwise the reply label.
    radio: {
      channel: 'TC-1 GROUND',
      script: null, node: null, prevNode: null,
      tx: 'idle',            // idle | groundTx | playerTx
      caption: '', answered: null,
      replies: [],           // visible reply labels, max 4
      pttLed: false, faults: 0,
      repeats: 0,
      groundTimer: 0, ackTimer: 0, ackTimeout: 0, playerTimer: 0, guideTimer: 0
    },

    // missions.js owns this.
    // PHASE 3 additive fields: pickupPos, landingPos, hooked, everHooked,
    // maxCapacityPct, maxSway, hadCollision, landedAt. Positions are copied out
    // of the mission definition at start() so radio.js and render.js can read
    // them without importing data/missions.js for the active lift.
    mission: {
      id: null, elapsed: 0, result: null, failReason: null,
      pickupPos: null, landingPos: null, landingTol: 0,
      // OBSTRUCTION shape change, declared under hard rule 6. The sector of slew
      // and the band of radius a mission's one un-flyable structure occupies,
      // copied from data/missions.js. radio.js reads it so the guide routes the
      // operator around it instead of straight through it. null on a clear site.
      obstruction: null,
      // PAR shape change, declared under hard rule 6. Seconds the job is
      // expected to take, copied from data/missions.js by missions.js and read
      // by scoring.js for the "On The Clock" award. 0 means the job has no par.
      par: 0,
      hooked: false, everHooked: false,
      maxCapacityPct: 0, maxSway: 0, hadCollision: false,
      // OVERLOAD shape change, declared under hard rule 6. What the lift did to
      // the machine, as three latches missions.js sets and scoring.js reads.
      // overloaded is the only one that loses the lift: it means the needle sat
      // at or above rated for CAP_OVER_FOR seconds, rather than touching it for
      // a tick. touchedLimit is the anti-two-block having stopped the hoist and
      // lmiCutOut the overload cut-out having stopped the trolley; both are the
      // machine's own protection working, so both cost a letter and neither is a
      // lost lift.
      overloaded: false, touchedLimit: false, lmiCutOut: false,
      landedAt: null,
      // PHASE 4. The height of whatever is under the load right now: the deck,
      // the top of a deck volume it is over, or a shaft floor. pendulum.js reads
      // it for contact, one tick stale, the same way it already reads
      // sensors.wind. Before this the world had exactly one floor, at y 0, so
      // the scaffold could not be landed on and the shaft could not be entered.
      surfaceY: 0,
      near: false, inZone: false    // live, so radio.js can gate on them
      // PHASE 4B: mission.furthest is gone. save.js wrote it, nothing read it,
      // and missions.firstUnfinished has always read progress.furthest instead.
      // Two names for one number in two systems' namespaces is how they drift.
    },

    // scoring.js owns this. after-action card reads it.
    scoring: {
      maxSway: 0, collisions: 0, twoBlocks: 0,
      radioFaults: 0, landingError: null, grade: null,
      // PHASE 4 additive: elapsed at resolution, the lines that cost the grade,
      // achievements unlocked this lift, and whether it beat the stored best.
      elapsed: 0, demerits: [], earned: [], personalBest: false,
      // PHASE 4B additive: least rope left above the two-block stop this lift.
      closestBlock: Infinity
    },

    // PHASE 4. What survives a refresh. save.js loads and persists it; scoring
    // and missions read it. New top-level field, declared per hard rule 6.
    // savedOk goes false the first time a write is refused (private browsing, a
    // full quota) so the card can say the run is not being kept, instead of
    // promising unlocks and personal bests that vanish on refresh.
    progress: { achievements: {}, best: {}, hooks: 0, furthest: 0, savedOk: true },

    // save.js loads and persists this.
    settings: { sensitivity: 1, damping: 0.5, units: 'imperial', mute: false },

    // Camera look-around. render.js reads, crane.js integrates it from
    // intent.look. yaw and pitch are relative to the jib, not to the world, so
    // the head stays where it was put while the crane slews under it.
    // HEAD shape change, declared under hard rule 6: `tracking` is new. While it
    // is on, crane.js aims the head at the hook block every tick instead of
    // integrating the drag, which is the operator leaning over the glass floor
    // and keeping his eyes on the load rather than on the jib.
    // LEAN shape change, declared under hard rule 6: leanX and leanY are metres
    // the eye moves forward and down out of the seat, derived from pitch by
    // crane.js. An operator looking steeply down does not do it with his back
    // against the seat: he leans out over the glass. Without it the front bar of
    // the floor frame sits square across the line to the load through a whole
    // band of pitch, and there is nothing the player can do about it.
    look: { yaw: 0, pitch: -0.35, tracking: false, leanX: 0, leanY: 0 },

    debug: { show: false, events: [] }
  };
}
