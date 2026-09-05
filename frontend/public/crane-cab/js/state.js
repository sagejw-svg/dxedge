// Single source of truth. Every system reads and writes here.
// Render and audio READ ONLY. Units inside the sim are SI (m, kg, s, rad).
// Display conversion happens in ui.js based on settings.units.

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
      jibLength: 55, minRadius: 3.5,
      minLine: 2.5, maxLine: 70,
      cabHeight: 42,                 // seat height above deck, m
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
      wind: 0, swayAngle: 0
    },

    // Radio director. radio.js owns this.
    radio: {
      channel: 'TC-1 GROUND',
      script: null, node: null,
      tx: 'idle',            // idle | groundTx | playerTx
      caption: '', garbled: false,
      replies: [],           // visible reply labels, max 4
      pttLed: false, faults: 0, ackTimer: 0
    },

    // missions.js owns this.
    mission: { id: null, elapsed: 0, result: null, failReason: null },

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
