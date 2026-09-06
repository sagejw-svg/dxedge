// PHASE 3. Radio director. Owns state.radio. Scripts live in data/radio.js.
//
// Ground talks first and ground owns the lift. This module runs one script at a
// time, drives the caption and reply strip, keeps the ack timer and the fault
// count, and turns the two rigging calls into bus events. It never touches
// state.load and it never imports another system: audio is reached by emitting
// radio.say, rigging by emitting hook.attach / hook.release.
//
// Node kinds, node fields and the waitFor gate are documented in the header of
// data/radio.js. That header is the contract; this file is the runner.
//
// Modes (mirrored into state.radio.tx as idle | groundTx | playerTx):
//   groundTx  ground is transmitting a call. groundTimer counts it down.
//   ack       the reply window. ackTimer counts down from node.timeout.
//   playerTx  the operator's answer is on the air, 0.8 s.
//   wait      blocked on node.waitFor.
//   hookWait  ground called for the hook and is waiting on missions.js.
//   unhookWait ground called the unhook and is waiting for the release.
//   guide     between guide calls. guideTimer counts down to the next one.
//   guideTx   a guide call is on the air.
//
// Half duplex: any player transmission on top of a ground transmission is a
// double. Both go garbled, a fault is logged, and the script detours through
// sayAgain and comes back to the same call.
//
// Interrupts: a collision, or sway over 10 degrees, jumps to allStop with the
// current node pushed on the return stack. E-stop inside the window clears it.
//
// Deviation on purpose, flagged in the Phase 3 report: guide captions carry a
// spoken distance, so this file converts metres to the player's units. CLAUDE.md
// keeps unit conversion in ui.js, which is right for gauges; a spoken call is
// content, not a readout, and the alternative was splitting one sentence across
// two modules.

import {
  SCRIPTS, GUIDE_CALLS, NOT_READY_CAPTION, NOT_SLACK_CAPTION,
  TOO_HIGH_CAPTION, TOO_LOW_CAPTION
} from '../data/radio.js';

const DEFAULT_TX = 1.6;                      // s of ground transmission with no clip
const PLAYER_TX = 0.8;                       // s the operator's answer is on the air
const GUIDE_PERIOD = 3.0;                    // s between guide calls
const GARBLE_TIME = 1.2;                     // s the caption stays garbled after a double
const HOOK_RETRY = 4.0;                      // s before ground calls for the hook again
const HOLD_FACTOR = 3;                       // inside this many tolerances, say HOLD
const GUIDE_SETTLE = (2 * Math.PI) / 180;    // rad of sway allowed to leave a guide node
const SWAY_INTERRUPT = (10 * Math.PI) / 180; // rad of sway that triggers ALL STOP
const SAY_DISTANCE_OVER = 3.0;               // m, below this a guide call carries no distance
const G = 9.81;

// Level equivalents for the waitFor gate. See the data/radio.js header.
const TIGHT_FRACTION = 0.95;                 // matches pendulum.js
const SETTLED_ANGLE = (0.5 * Math.PI) / 180; // matches pendulum.js
// Angular rate that still counts as settled. A pendulum on 40 m of rope swinging
// half a degree peaks near 0.004 rad/s, so this passes a genuinely dead load and
// rejects one caught at the bottom of a real swing.
const SETTLED_RATE = 0.005;                  // rad/s
const GUIDE_SETTLE_RATE = 0.010;             // rad/s allowed to leave a guide node

let script = null;        // the SCRIPTS entry being run
let node = null;          // the current node object
let mode = 'off';         // off | groundTx | ack | playerTx | wait | hookWait | guide | guideTx | done
let seen = new Set();     // waitFor events heard since this node was entered
// Where RETURN goes. This used to be a stack, which is how the radio came to be
// killable: handler nodes were kept off it but still popped on the way out, so a
// double during an ALL STOP left the stack one short and the next RETURN popped
// empty, ended the script and left the lift with no way to be won or lost.
// There is nothing a stack was buying. The lift only ever has one place to come
// back to - the script node it was interrupted on - and while an alarm is still
// live the answer is the alarm itself.
let lastScriptNode = null;
let garbleTimer = 0;
let swayArmed = true;     // ALL STOP on sway is edge triggered
let pttLatched = false;   // a held PTT may only double once
let hookResult = null;    // null | 'attached' | 'notReady'
let hookRetry = 0;
let pendingAction = null; // this node's hook / unhook, fired when the call ends
let unhookResult = null;  // null | 'released' | 'refused'
let hookHint = NOT_READY_CAPTION;
let unhookRetry = 0;
let holdSaid = false;     // guide: HOLD is said once per approach
let inAllStop = false;
// ALL STOP is the one deadline nothing may postpone, so it belongs to the
// interrupt rather than to whichever node happens to be current. Hanging it off
// the node let a double carry the script out of allStop before the timer was
// even armed, and the RETURN then re-armed it: tapping a reply once per call
// postponed the deadline forever with the load still swinging.
// It covers the call plus the window, so the operator gets the whole window to
// reach the mushroom after ground stops shouting.
let allStopTimer = 0;
const ALL_STOP_WINDOW = 1.5;   // s to reach the E-stop after the call ends

const WAIT_EVENTS = [
  'hook.tight', 'load.slack', 'sway.settled', 'load.inZone', 'load.near', 'estop'
];

export function init(ctx) {
  const { bus } = ctx;

  bus.on('radio.start', (p) => startScript(ctx, p && p.script));
  bus.on('radio.stop', () => stopScript(ctx));

  WAIT_EVENTS.forEach((name) => bus.on(name, () => { seen.add(name); }));

  // NOT the raw 'collision' from sensors.js. A load resting on the thing it is
  // being picked from shares a face with that deck volume, so the raw event
  // fires the moment mission 1 hooks on. missions.js is the one that knows
  // whether a contact counts, and says so with collision.counted.
  bus.on('collision.counted', () => interrupt(ctx));
  bus.on('hook.attached', () => { hookResult = 'attached'; });
  bus.on('hook.notReady', (p) => {
    hookResult = 'notReady';
    // Say which way. dh is the horizontal miss, dy the block against the load
    // top: positive is high, negative is past it with slack rope out.
    if (p && p.dh > 1.0) hookHint = NOT_READY_CAPTION;
    else if (p && p.dy > 0) hookHint = TOO_HIGH_CAPTION;
    else hookHint = TOO_LOW_CAPTION;
  });
  bus.on('hook.released', () => { unhookResult = 'released'; });
  bus.on('hook.notReleased', () => { unhookResult = 'refused'; });
}

// ---------- script lifecycle ----------

function startScript(ctx, name) {
  const r = ctx.state.radio;
  const found = SCRIPTS[name];
  if (!found) {
    console.warn(`radio: no script named ${name}`);
    stopScript(ctx);
    return;
  }
  script = found;
  r.script = name;
  r.faults = 0;
  r.prevNode = null;
  lastScriptNode = null;
  swayArmed = true;
  pttLatched = false;
  inAllStop = false;
  garbleTimer = 0;
  r.garbled = false;
  enterNode(ctx, script.start);
}

function stopScript(ctx) {
  const r = ctx.state.radio;
  script = null;
  node = null;
  mode = 'off';
  seen.clear();
  lastScriptNode = null;
  r.script = null;
  r.node = null;
  r.prevNode = null;
  r.caption = '';
  r.replies = [];
  r.garbled = false;
  r.tx = 'idle';
  r.pttLed = false;
  r.groundTimer = 0;
  r.ackTimer = 0;
  r.ackTimeout = 0;
  r.playerTimer = 0;
  r.guideTimer = 0;
  allStopTimer = 0;
}

function enterNode(ctx, id) {
  const { state, bus } = ctx;
  const r = state.radio;

  if (id === 'RETURN') {
    id = allStopTimer > 0 ? 'allStop' : lastScriptNode;
  }
  if (id === null || id === undefined) {
    node = null;
    mode = 'done';
    r.node = null;
    r.tx = 'idle';
    r.replies = [];
    bus.emit('radio.complete', { script: r.script });
    return;
  }

  const found = script.nodes[id];
  if (!found) {
    console.warn(`radio: script ${r.script} has no node ${id}`);
    stopScript(ctx);
    return;
  }

  node = found;
  r.node = id;
  if (!isHandler(id)) lastScriptNode = id;
  r.prevNode = lastScriptNode;
  r.repeats = 0;
  seen.clear();
  holdSaid = false;
  hookResult = null;
  hookRetry = 0;
  unhookResult = null;
  unhookRetry = 0;
  pendingAction = node.action || null;
  inAllStop = id === 'allStop' || id === 'allStopClear';
  if (id === 'allStopClear') allStopTimer = 0;   // the mushroom is down, stand down the clock
  // A node entered mid ack window inherited the old countdown, which left the
  // bar drawn under a call that has no reply window.
  r.ackTimer = 0;
  r.ackTimeout = 0;


  if (node.guide) {
    mode = 'guide';
    r.guideTimer = 0;          // first correction goes out immediately
    r.caption = '';
    r.replies = ['Say again'];
    return;
  }

  sayNode(ctx, 0);
}

// Rigging calls fire when ground stops talking, not while it is still talking.
// The rigger acts on the call he just heard, and it keeps the call on screen for
// its full length instead of being overwritten by the result in the same tick.
function fireAction(ctx) {
  if (!pendingAction) return;
  const which = pendingAction;
  pendingAction = null;
  if (which === 'hook') ctx.bus.emit('hook.attach', {});
  if (which === 'unhook') ctx.bus.emit('hook.release', {});
}

// Put the current node's call on the air. urgencyBump raises the read urgency
// when ground has to say it again.
function sayNode(ctx, urgencyBump, captionOverride) {
  const { state, bus } = ctx;
  const r = state.radio;
  mode = 'groundTx';
  r.groundTimer = DEFAULT_TX;
  r.caption = captionOverride || node.caption || '';
  r.replies = replyLabels(node);
  if (node.say) bus.emit('radio.say', { key: node.say, urgency: (node.urgency || 0) + (urgencyBump || 0) });
}

function replyLabels(n) {
  const expect = (n && n.expect) || [];
  return expect.slice(0, 3).concat(['Say again']);
}

// The reply strip is drawn in every mode, so its buttons have to mean something
// in every mode. Say again is the one that always applies: ground repeats what
// it last said. Anything else is only live while a reply window is open.
function sayAgainPressed(ctx) {
  const r = ctx.state.radio;
  const pick = ctx.state.intent.reply;
  return pick !== null && pick >= 0 && pick < r.replies.length &&
    r.replies[pick] === 'Say again';
}

let lastGuide = null;   // the guide call on the air, so it can be repeated

function repeatGuide(ctx) {
  if (!lastGuide) return;
  sayGuide(ctx, lastGuide.call, lastGuide.distance, lastGuide.urgency);
}

function advance(ctx) {
  enterNode(ctx, node.next === undefined ? null : node.next);
}

// ---------- faults, doubles, interrupts ----------

function fault(ctx, why) {
  const r = ctx.state.radio;
  r.faults += 1;
  ctx.bus.emit('radio.fault', { node: r.node, why: why || 'timeout' });
}

// allStop, allStopClear and sayAgain are handlers, not places in the script, so
// they are never what RETURN comes back to.
const HANDLER_NODES = ['allStop', 'allStopClear', 'sayAgain'];
const isHandler = (id) => HANDLER_NODES.includes(id);

function double(ctx) {
  const { state, bus } = ctx;
  const r = state.radio;
  // Talking over the "say again" is still a double in real life, but treating it
  // as one here recurses: sayAgain's own strip is a single Say again button, so
  // one more press pushes another return and another fault, and a held key ran
  // that up without limit. Ground just keeps talking instead.
  if (r.node === 'sayAgain') return;
  r.garbled = true;
  garbleTimer = GARBLE_TIME;
  fault(ctx, 'doubled');
  bus.emit('radio.doubled', { node: r.node });
  enterNode(ctx, 'sayAgain');
}

function interrupt(ctx) {
  const r = ctx.state.radio;
  if (!script || mode === 'off' || mode === 'done') return;
  if (allStopTimer > 0 || inAllStop) return;      // one ALL STOP at a time
  const all = script.nodes.allStop;
  if (!all) return;
  // The clock starts here and runs whatever happens to the script afterwards.
  allStopTimer = DEFAULT_TX + (all.timeout || ALL_STOP_WINDOW);
  ctx.bus.emit('radio.allStop', {});
  enterNode(ctx, 'allStop');
}

// ---------- the waitFor gate ----------

function gateSatisfied(ctx) {
  const ev = node.waitFor;
  if (!ev) return true;
  if (seen.has(ev)) return true;
  return levelTrue(ctx, ev);
}

// A swing is settled only if it is both small and slow. Angle alone is true at
// every zero crossing, so a load swinging two degrees reads as dead still twice
// a period, which is how ground came to call "that's good" mid swing and the
// load landed a metre off the pad.
function swaySettled(state, angleLimit, rateLimit) {
  const sw = state.load.swing;
  return state.sensors.swayAngle < angleLimit &&
    Math.hypot(sw.vx, sw.vy) < rateLimit;
}

// The condition each waitFor event announces, sampled rather than heard. Without
// this a node can wait forever for an edge that fired one node earlier.
function levelTrue(ctx, ev) {
  const { state } = ctx;
  switch (ev) {
    case 'hook.tight':
      return state.load.attached && state.load.mass > 0 &&
        state.load.tension >= TIGHT_FRACTION * state.load.mass * G;
    case 'load.slack':
      return state.sensors.slack;
    case 'sway.settled':
      return swaySettled(state, SETTLED_ANGLE, SETTLED_RATE);
    case 'estop':
      return state.intent.estop === true;
    case 'load.near':
      return state.mission.near === true;
    case 'load.inZone':
      return state.mission.inZone === true;
    default:
      return false;
  }
}

function toGate(ctx) {
  if (node.action === 'hook') { mode = 'hookWait'; return; }
  // missions.js can refuse an unhook (the load is still in the air, or the line
  // is not slack). Without waiting for the answer the script ran on to "good
  // lift, standing by" with the load still on the hook and nothing left able to
  // win or fail the lift.
  if (node.action === 'unhook') { mode = 'unhookWait'; return; }
  if (gateSatisfied(ctx)) { advance(ctx); return; }
  mode = 'wait';
}

// ---------- guide geometry ----------

function wrapPi(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// How far the guide is allowed to hand over. For a landing that is the mission's
// own scoring tolerance, not a fixed metre: ground used to stop calling
// corrections at 1.0 m while the lift was scored at 0.4 m, so a player who flew
// exactly what the radio said was set down outside the zone and failed.
function guideTolerance(ctx) {
  const tol = node.tol || 1.0;
  if (node.guide !== 'landing') return tol;
  const scored = ctx.state.mission.landingTol;
  return scored > 0 ? Math.min(tol, scored) : tol;
}

// Offset from the hook to the guide target. Corrections are the arc and the
// radial gap: tangential positive means the jib has to come round to the
// operator's right (slew up), which is the shorter way round by construction;
// radial positive means trolley out.
//
// Deviation from the phase prompt, which says to ignore swing. The swing offset
// at the end of forty metres of rope is over a metre at the two degrees the
// guide used to accept, and it is the load, not the trolley, that has to end up
// on the pad. Ground calls what it sees hanging, and the settle test below keeps
// the corrections from chasing a swing.
function guideInfo(ctx) {
  const { state } = ctx;
  const c = state.crane;
  const target = node.guide === 'landing' ? state.mission.landingPos : state.mission.pickupPos;
  if (!target) return null;

  const tx = target[0];
  const tz = target[2];

  const jibX = c.radius + Math.sin(state.load.swing.y) * c.line;
  const jibZ = Math.sin(state.load.swing.x) * c.line;
  const cos = Math.cos(c.slew);
  const sin = Math.sin(c.slew);
  const hookX = jibX * cos - jibZ * sin;
  const hookZ = jibX * sin + jibZ * cos;

  const targetRadius = Math.hypot(tx, tz);
  const dAngle = wrapPi(Math.atan2(tz, tx) - c.slew);

  return {
    tangential: dAngle * c.radius,
    radial: targetRadius - c.radius,
    dist: Math.hypot(tx - hookX, tz - hookZ)
  };
}

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function words(n) {
  n = Math.round(n);
  if (n < 0) return words(-n);
  if (n < 20) return ONES[n];
  if (n < 100) {
    const rest = n % 10;
    return TENS[Math.floor(n / 10)] + (rest ? `-${ONES[rest]}` : '');
  }
  const rest = n % 100;
  return `${ONES[Math.floor(n / 100)]} hundred${rest ? ` ${words(rest)}` : ''}`;
}

// Spoken distance for a guide call. Imperial rounds to 5 ft, metric to 2 m,
// because ground does not call a correction to the inch.
function spokenDistance(metres, units) {
  if (units === 'imperial') {
    const ft = Math.max(5, Math.round((metres * 3.28084) / 5) * 5);
    return `${words(ft)} feet`;
  }
  const m = Math.max(2, Math.round(metres / 2) * 2);
  return `${words(m)} meters`;
}

function sayGuide(ctx, call, distance, urgency) {
  const { state, bus } = ctx;
  const r = state.radio;
  lastGuide = { call, distance, urgency };
  let caption = call.caption;
  if (distance !== null && distance > SAY_DISTANCE_OVER) {
    caption += `, ${spokenDistance(distance, state.settings.units)}.`;
  } else if (!caption.endsWith('.')) {
    caption += '.';
  }
  mode = 'guideTx';
  r.groundTimer = DEFAULT_TX;
  r.caption = caption;
  r.replies = ['Say again'];
  bus.emit('radio.say', { key: call.say, urgency: urgency || 0 });
}

// ---------- main loop ----------

export function update(ctx, dt) {
  const { state } = ctx;
  const r = state.radio;

  if (garbleTimer > 0) {
    garbleTimer -= dt;
    if (garbleTimer <= 0) r.garbled = false;
  }

  if (!state.intent.ptt) pttLatched = false;

  if (!script || mode === 'off' || mode === 'done') {
    setTx(ctx);
    return;
  }

  // The ALL STOP clock. It is checked against the E-stop itself, not against
  // whatever node.waitFor happens to be, because a double can carry the script
  // to sayAgain (waitFor null) and a null gate reads as satisfied.
  if (allStopTimer > 0) {
    if (state.intent.estop) {
      allStopTimer = 0;
      enterNode(ctx, 'allStopClear');
      setTx(ctx);
      return;
    }
    allStopTimer -= dt;
    if (allStopTimer <= 0) {
      allStopTimer = 0;
      ctx.bus.emit('radio.ignoredAllStop', { node: r.node });
      mode = 'done';
      setTx(ctx);
      return;
    }
  }

  // Interrupts first: a collision arrives on the bus, sway is polled here.
  if (state.sensors.swayAngle > SWAY_INTERRUPT) {
    if (swayArmed) { swayArmed = false; interrupt(ctx); }
  } else {
    swayArmed = true;
  }

  // Half duplex. Talking over ground garbles both ways.
  const transmitting = mode === 'groundTx' || mode === 'guideTx';
  if (transmitting) {
    // Only a key that maps to a button on the strip is the operator talking.
    // Keys 1-8 always set intent.reply, but the strip never holds more than
    // four, so pressing 6 during a call used to log a fault for a button that
    // was not on screen.
    const pttDouble = state.intent.ptt && !pttLatched;
    const spoke = state.intent.reply !== null &&
      state.intent.reply >= 0 && state.intent.reply < r.replies.length;
    // A guide call carries a single Say again button and the data contract says
    // guide calls never fault. Pressing it while the call was still on the air
    // was costing a fault, and the call is on the air for more than half of
    // every cycle.
    if (mode === 'guideTx' && spoke && r.replies[state.intent.reply] === 'Say again') {
      repeatGuide(ctx);
      setTx(ctx);
      return;
    }
    if (pttDouble || spoke) {
      if (pttDouble) pttLatched = true;
      double(ctx);
      setTx(ctx);
      return;
    }
  }

  switch (mode) {
    case 'groundTx': {
      r.groundTimer -= dt;
      if (hookRetry > 0) hookRetry -= dt;        // the re-say is part of the four seconds
      if (unhookRetry > 0) unhookRetry -= dt;
      if (r.groundTimer <= 0) {
        r.groundTimer = 0;
        fireAction(ctx);
        if (node.timeout !== null && node.timeout !== undefined) {
          mode = 'ack';
          r.ackTimer = node.timeout;
          r.ackTimeout = node.timeout;
        } else {
          r.ackTimer = 0;
          r.ackTimeout = 0;
          toGate(ctx);
        }
      }
      break;
    }

    case 'ack': {
      r.ackTimer -= dt;

      // The operator answers first. Reading the waitFor level here instead let a
      // node that was already satisfied close its own reply window inside one
      // tick, which made "Moving" and "Stopped" unpressable: up easy in
      // particular advanced before the load had left the ground.
      const pick = state.intent.reply;
      if (pick !== null && pick >= 0 && pick < r.replies.length) {
        const label = r.replies[pick];
        r.ackTimer = 0; r.ackTimeout = 0;
        if (label === 'Say again') { sayNode(ctx, 0); break; }
        ctx.bus.emit('radio.reply', { label, node: r.node });
        mode = 'playerTx';
        r.playerTimer = PLAYER_TX;
        break;
      }

      // An event arriving mid window still carries the node, so ALL STOP clears
      // on the E-stop alone. A latched E-stop counts too, since how the mushroom
      // got down does not matter once it is down.
      if (node.waitFor && (seen.has(node.waitFor) ||
          (node.onTimeout === 'ignoredAllStop' && levelTrue(ctx, node.waitFor)))) {
        r.ackTimer = 0; r.ackTimeout = 0;
        advance(ctx);
        break;
      }

      if (r.ackTimer <= 0) {
        r.ackTimer = 0; r.ackTimeout = 0;
        onTimeout(ctx);
      }
      break;
    }

    case 'playerTx': {
      r.playerTimer -= dt;
      if (r.playerTimer <= 0) { r.playerTimer = 0; toGate(ctx); }
      break;
    }

    case 'wait': {
      if (gateSatisfied(ctx)) { advance(ctx); break; }
      if (sayAgainPressed(ctx)) sayNode(ctx, 0);
      break;
    }

    case 'hookWait': {
      if (hookResult === 'attached') { hookResult = null; advance(ctx); break; }
      if (hookResult === 'notReady') {
        hookResult = null;
        hookRetry = HOOK_RETRY;
        sayNode(ctx, 1, hookHint);
        break;
      }
      if (hookRetry > 0) {
        hookRetry -= dt;
        if (hookRetry <= 0) { hookRetry = 0; ctx.bus.emit('hook.attach', {}); }
      }
      if (sayAgainPressed(ctx)) sayNode(ctx, 0);
      break;
    }

    case 'unhookWait': {
      if (unhookResult === 'released') { unhookResult = null; advance(ctx); break; }
      if (unhookResult === 'refused') {
        unhookResult = null;
        unhookRetry = HOOK_RETRY;
        sayNode(ctx, 1, NOT_SLACK_CAPTION);
        break;
      }
      if (unhookRetry > 0) {
        unhookRetry -= dt;
        if (unhookRetry <= 0) { unhookRetry = 0; ctx.bus.emit('hook.release', {}); }
      }
      if (sayAgainPressed(ctx)) sayNode(ctx, 0);
      break;
    }

    case 'guide': {
      const g = guideInfo(ctx);
      if (!g) break;
      const tol = guideTolerance(ctx);
      if (g.dist <= tol && swaySettled(state, GUIDE_SETTLE, GUIDE_SETTLE_RATE)) { advance(ctx); break; }
      if (g.dist > tol * HOLD_FACTOR) holdSaid = false;

      if (sayAgainPressed(ctx)) { repeatGuide(ctx); break; }

      r.guideTimer -= dt;
      if (r.guideTimer > 0) break;
      r.guideTimer = GUIDE_PERIOD;

      if (g.dist <= tol * HOLD_FACTOR && !holdSaid) {
        holdSaid = true;
        sayGuide(ctx, GUIDE_CALLS.hold, null, 1);
        break;
      }
      // Say the single largest correction, never two at once.
      if (Math.abs(g.tangential) >= Math.abs(g.radial)) {
        sayGuide(ctx, g.tangential > 0 ? GUIDE_CALLS.swingRight : GUIDE_CALLS.swingLeft,
          Math.abs(g.tangential), 0);
      } else {
        sayGuide(ctx, g.radial > 0 ? GUIDE_CALLS.trolleyOut : GUIDE_CALLS.trolleyIn,
          Math.abs(g.radial), 0);
      }
      break;
    }

    case 'guideTx': {
      r.groundTimer -= dt;
      if (r.guideTimer > 0) r.guideTimer -= dt;   // the call is part of the three seconds
      if (r.groundTimer <= 0) { r.groundTimer = 0; mode = 'guide'; }
      break;
    }

    default:
      break;
  }

  setTx(ctx);
}

function onTimeout(ctx) {
  const r = ctx.state.radio;
  r.repeats += 1;

  if (node.onTimeout === 'ignoredAllStop') {
    // The hard deadline above owns this; the ack window just keeps repeating the
    // call until it fires, so the caption stays on screen.
    sayNode(ctx, 1);
    return;
  }
  if (node.onTimeout === 'fault') {
    fault(ctx);
    sayNode(ctx, 1);
    return;
  }
  if (node.onTimeout === 'repeat') {
    if (r.repeats >= 2) fault(ctx);
    sayNode(ctx, r.repeats);
    return;
  }
  // No timeout policy: treat the lapse as silence and carry on.
  toGate(ctx);
}

// tx and the PTT lamp are derived, so nothing else has to remember to clear them.
function setTx(ctx) {
  const { state } = ctx;
  const r = state.radio;
  if (mode === 'groundTx' || mode === 'guideTx') r.tx = 'groundTx';
  else if (mode === 'playerTx') r.tx = 'playerTx';
  else r.tx = state.intent.ptt ? 'playerTx' : 'idle';
  r.pttLed = r.tx === 'playerTx';
}
