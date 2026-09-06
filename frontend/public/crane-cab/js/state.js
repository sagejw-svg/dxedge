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
      reply: null,    // 0..7 or null, one-shot, cleared by radio.js
      look: { dx: 0, dy: 0 } // drag look-around delta this frame
    },

    // Crane kinematics. crane.js owns this.
    crane: {
      slew: 0, slewVel: 0,           // rad, rad/s
      radius: 20, radiusVel: 0,      // trolley distance from mast, m
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
      onSurface: false, tension: 0
    },

    // Derived readings. sensors.js owns this. ui.js displays it.
    sensors: {
      radius: 0, hookHeight: 0, heading: 0,
      actualLoad: 0, ratedLoad: 0, capacityPct: 0,
      lmiLock: false, a2b: false, slack: false, collision: false,
      wind: 0, swayAngle: 0,
      maxLoadRadius: 0, reachPct: 0  // Phase 2B: how far out this load may go
    },

    // Radio director. radio.js owns this.
    // PHASE 3 additive fields: prevNode, repeats, groundTimer, playerTimer,
    // guideTimer, ackTimeout. Timers are seconds remaining, counted down by
    // radio.js. ackTimeout is the node's full ack window so ui.js can draw the
    // countdown bar without importing the script data.
    radio: {
      channel: 'TC-1 GROUND',
      script: null, node: null, prevNode: null,
      tx: 'idle',            // idle | groundTx | playerTx
      caption: '', garbled: false,
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
      pickupPos: null, landingPos: null,
      hooked: false, everHooked: false,
      maxCapacityPct: 0, maxSway: 0, hadCollision: false,
      landedAt: null
    },

    // scoring.js owns this. after-action card reads it.
    scoring: {
      maxSway: 0, collisions: 0, twoBlocks: 0,
      radioFaults: 0, landingError: null, grade: null
    },

    // save.js loads and persists this.
    settings: { sensitivity: 1, damping: 0.5, units: 'imperial', mute: false },

    // Camera look-around. render.js reads, input.js writes via intent.look.
    look: { yaw: 0, pitch: -0.35 },

    debug: { show: false, events: [] }
  };
}
