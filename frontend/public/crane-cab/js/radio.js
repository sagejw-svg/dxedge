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

import { SCRIPTS, GUIDE_CALLS, NOT_READY_CAPTION } from '../data/radio.js';

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

let script = null;        // the SCRIPTS entry being run
let node = null;          // the current node object
let mode = 'off';         // off | groundTx | ack | playerTx | wait | hookWait | guide | guideTx | done
let seen = new Set();     // waitFor events heard since this node was entered
let returnStack = [];     // node ids to come back to after sayAgain / allStop
let garbleTimer = 0;
let swayArmed = true;     // ALL STOP on sway is edge triggered
let pttLatched = false;   // a held PTT may only double once
let hookResult = null;    // null | 'attached' | 'notReady'
let hookRetry = 0;
let pendingAction = null; // this node's hook / unhook, fired when the call ends
let holdSaid = false;     // guide: HOLD is said once per approach
let inAllStop = false;

const WAIT_EVENTS = [
  'hook.tight', 'load.slack', 'sway.settled', 'load.inZone', 'load.near', 'estop'
];

export function init(ctx) {
  const { bus } = ctx;

  bus.on('radio.start', (p) => startScript(ctx, p && p.script));
  bus.on('radio.stop', () => stopScript(ctx));

  WAIT_EVENTS.forEach((name) => bus.on(name, () => { seen.add(name); }));

  bus.on('collision', () => interrupt(ctx));
  bus.on('hook.attached', () => { hookResult = 'attached'; });
  bus.on('hook.notReady', () => { hookResult = 'notReady'; });

  // Forward-looking: no voice clips exist yet, so every call is DEFAULT_TX long.
  // When audio/<key>.ogg files land, audio.js reports the real length and the
  // transmission stretches to match rather than cutting the clip off.
  bus.on('radio.clipLength', (p) => {
    if (!p || !node || (mode !== 'groundTx' && mode !== 'guideTx')) return;
    if (p.key !== node.say && p.key !== lastSayKey) return;
    if (p.seconds > ctx.state.radio.groundTimer) ctx.state.radio.groundTimer = p.seconds;
  });
}

let lastSayKey = null;

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
  returnStack = [];
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
  returnStack = [];
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
}

function enterNode(ctx, id) {
  const { state, bus } = ctx;
  const r = state.radio;

  if (id === 'RETURN') {
    id = returnStack.pop() || null;
    r.prevNode = returnStack.length ? returnStack[returnStack.length - 1] : null;
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
  r.repeats = 0;
  seen.clear();
  holdSaid = false;
  hookResult = null;
  hookRetry = 0;
  pendingAction = node.action || null;
  inAllStop = id === 'allStop' || id === 'allStopClear';

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
  lastSayKey = node.say || null;
  if (node.say) bus.emit('radio.say', { key: node.say, urgency: (node.urgency || 0) + (urgencyBump || 0) });
}

function replyLabels(n) {
  const expect = (n && n.expect) || [];
  return expect.slice(0, 3).concat(['Say again']);
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

function double(ctx) {
  const { state, bus } = ctx;
  const r = state.radio;
  r.garbled = true;
  garbleTimer = GARBLE_TIME;
  fault(ctx, 'doubled');
  bus.emit('radio.doubled', { node: r.node });
  returnStack.push(r.node);
  r.prevNode = r.node;
  enterNode(ctx, 'sayAgain');
}

function interrupt(ctx) {
  const r = ctx.state.radio;
  if (!script || mode === 'off' || mode === 'done' || inAllStop) return;
  if (!script.nodes.allStop) return;
  returnStack.push(r.node);
  r.prevNode = r.node;
  enterNode(ctx, 'allStop');
}

// ---------- the waitFor gate ----------

function gateSatisfied(ctx) {
  const ev = node.waitFor;
  if (!ev) return true;
  if (seen.has(ev)) return true;
  return levelTrue(ctx, ev);
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
      return state.sensors.swayAngle < SETTLED_ANGLE;
    case 'estop':
      return state.intent.estop === true;
    default:
      return false;
  }
}

function toGate(ctx) {
  if (node.action === 'hook') { mode = 'hookWait'; return; }
  if (gateSatisfied(ctx)) { advance(ctx); return; }
  mode = 'wait';
}

// ---------- guide geometry ----------

function wrapPi(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Offset from the hook to the guide target, ignoring swing as the phase prompt
// specifies. Tangential is the arc the hook travels at the current radius:
// positive means the jib has to come round to the operator's right (slew up),
// which is the shorter way round by construction. Radial positive = trolley out.
function guideInfo(ctx) {
  const { state } = ctx;
  const c = state.crane;
  const target = node.guide === 'landing' ? state.mission.landingPos : state.mission.pickupPos;
  if (!target) return null;

  const tx = target[0];
  const tz = target[2];
  const targetRadius = Math.hypot(tx, tz);
  const dAngle = wrapPi(Math.atan2(tz, tx) - c.slew);

  const hookX = c.radius * Math.cos(c.slew);
  const hookZ = c.radius * Math.sin(c.slew);

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
  lastSayKey = call.say;
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

  // Interrupts first: a collision arrives on the bus, sway is polled here.
  if (state.sensors.swayAngle > SWAY_INTERRUPT) {
    if (swayArmed) { swayArmed = false; interrupt(ctx); }
  } else {
    swayArmed = true;
  }

  // Half duplex. Talking over ground garbles both ways.
  const transmitting = mode === 'groundTx' || mode === 'guideTx';
  if (transmitting) {
    const pttDouble = state.intent.ptt && !pttLatched;
    if (pttDouble || state.intent.reply !== null) {
      if (pttDouble) pttLatched = true;
      double(ctx);
      setTx(ctx);
      return;
    }
  }

  switch (mode) {
    case 'groundTx': {
      r.groundTimer -= dt;
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
      // A waitFor condition that lands inside the ack window carries the node on
      // its own. ALL STOP depends on this: the E-stop clears it, not a reply.
      if (node.waitFor && gateSatisfied(ctx)) {
        r.ackTimer = 0; r.ackTimeout = 0;
        advance(ctx);
        break;
      }
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
      if (gateSatisfied(ctx)) advance(ctx);
      break;
    }

    case 'hookWait': {
      if (hookResult === 'attached') { hookResult = null; advance(ctx); break; }
      if (hookResult === 'notReady') {
        hookResult = null;
        hookRetry = HOOK_RETRY;
        sayNode(ctx, 1, NOT_READY_CAPTION);
        break;
      }
      if (hookRetry > 0) {
        hookRetry -= dt;
        if (hookRetry <= 0) { hookRetry = 0; ctx.bus.emit('hook.attach', {}); }
      }
      // A 'Say again' press just re-sends the call; nothing else is a fault here.
      if (state.intent.reply !== null && r.replies[state.intent.reply] === 'Say again') {
        sayNode(ctx, 0);
      }
      break;
    }

    case 'guide': {
      const g = guideInfo(ctx);
      if (!g) break;
      if (g.dist <= node.tol && state.sensors.swayAngle < GUIDE_SETTLE) { advance(ctx); break; }
      if (g.dist > node.tol * HOLD_FACTOR) holdSaid = false;

      r.guideTimer -= dt;
      if (r.guideTimer > 0) break;
      r.guideTimer = GUIDE_PERIOD;

      if (g.dist <= node.tol * HOLD_FACTOR && !holdSaid) {
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
    ctx.bus.emit('radio.ignoredAllStop', { node: r.node });
    mode = 'done';
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
