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
// Full duplex. Ground and the cab are on separate paths, so an answer given
// while ground is still talking reaches ground intact: it is banked and applied
// the instant the call ends, and it is never a fault. Ground is not cut off
// mid-word for it either, which matters now that the calls are recorded speech
// rather than a caption - clipping "Blind pick, shaft is nine metres deep" in
// half is worse radio than letting the sentence finish under the answer.
// state.radio.answered carries the banked label so the strip can show it landed.
//
// Transmission length comes from data/clips.js, the real length of the real
// recording, and falls back to DEFAULT_TX for a key with no clip.
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
  SCRIPTS, GUIDE_CALLS,
  NOT_READY_HINT, NOT_SLACK_HINT, TOO_HIGH_HINT, TOO_LOW_HINT,
  SAY_AGAIN_LABEL, DISTANCE_BUCKETS, DISTANCE_FAR, PLUMB_HINT, DEPTH_CAPTION
} from '../data/radio.js';
import { CLIP_SECONDS } from '../data/clips.js';

const DEFAULT_TX = 1.6;                      // s of ground transmission with no clip
const CLIP_TAIL = 0.25;                      // s of dead air ground leaves before it unkeys
const PLAYER_TX = 0.8;                       // s the operator's answer is on the air
// Ground talked at one rate whatever was happening: a call every 3 s, and the
// call itself runs about 2 of them, so he was on the air two thirds of every
// cycle saying the same thing to an operator forty metres out who could do
// nothing about it yet. He now spaces them by how much room is left. Far out,
// where the correction is obvious and will not change for twenty seconds, he
// says it and lets you fly; on the mark, where a foot matters, he is quick.
const GUIDE_PERIOD_NEAR = 2.2;               // s between calls once it is close
const GUIDE_PERIOD_FAR = 7.0;                // s between calls a long way out
const GUIDE_FAR_ERR = 25;                    // m of error that counts as a long way out
// And he does not say the identical call twice running. If the correction has
// not changed - same direction, same bucket - there is nothing new to tell you,
// so it waits for the beat after. A changed call always goes out on time.
const GUIDE_SAME_HOLDOFF = 2;
// A set-down the operator cannot see. On the blind shaft the load goes nine
// metres into a hole with the hook cam refused, and ground used to say "down
// easy, keep her plumb" once and then nothing at all until the last three
// metres: six metres of a blind descent in silence, from the only man who could
// see it. A node marked `descend` gets a depth countdown on the way down, on the
// same tightening cadence as the guide calls, and a plumb warning if it starts
// to swing in there.
const DESCENT_PERIOD_NEAR = 2.4;             // s between calls in the last few feet
const DESCENT_PERIOD_FAR = 6.0;              // s between calls at the top of the descent
const DESCENT_FAR_DROP = 9;                  // m of remaining drop that counts as the top
const DESCENT_SWAY = (2.5 * Math.PI) / 180;  // rad of load sway that earns a plumb warning
const RETRY_FLOOR = 1e-6;                    // a retry timer never reaches zero mid call
const HOOK_RETRY = 4.0;                      // s before ground calls for the hook again
// How many times ground will say the same thing again before he stops. He is a
// man on a radio, not a klaxon: three transmissions of one call is a lot, and
// past that he was just filling the cab while the operator worked. Stopping is
// safe because every node either has a gate that the operator's own hands open
// or no gate at all, and Say again brings the call straight back.
const MAX_REPEATS = 2;
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
let swayArmed = true;     // ALL STOP on sway is edge triggered
let micLatched = false;   // a held PTT counts as one press, not one per frame
let banked = null;        // an answer given while ground was still talking
let hookResult = null;    // null | 'attached' | 'notReady'
let hookRetry = 0;
let pendingAction = null; // this node's hook / unhook, fired when the call ends
let unhookResult = null;  // null | 'released' | 'refused'
let hookHint = NOT_READY_HINT;
let unhookRetry = 0;
let holdSaid = false;     // guide: HOLD is said once per approach
let lastGuideKey = null;  // the clip the last guide call went out as
let sameCallBeats = 0;    // beats the correction has been the same one
let descentTimer = 0;     // s to the next depth callout on a blind set-down
let lastDepthKey = null;  // the depth clip last called, so it is not repeated
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
    //
    // Horizontally, ground now gives the correction rather than the complaint.
    // "Bring the hook over the load first" is the one call on the radio that
    // named a problem and withheld the answer, from the man standing next to the
    // load who could see it. It goes out as a swing or trolley call with the
    // distance in it, in the same words and the same recording the guide uses,
    // because it is the same instruction. NOT_READY_HINT survives only for a
    // mission with no pickup position to point at.
    if (p && p.dh > 1.0) {
      const at = p.at;
      hookHint = at
        ? (() => {
            const { call, distance } = correctionFor(ctx.state, polarErrorTo(ctx.state, at));
            return callAsHint(ctx.state, call, distance);
          })()
        : NOT_READY_HINT;
    } else if (p && p.dy > 0) hookHint = TOO_HIGH_HINT;
    else hookHint = TOO_LOW_HINT;
  });
  bus.on('hook.released', () => { unhookResult = 'released'; });
  bus.on('hook.notReleased', () => { unhookResult = 'refused'; });
}

// ---------- script lifecycle ----------

function startScript(ctx, name) {
  repeating = false;
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
  // A mic that is already keyed when the lift starts counts as already used, not
  // as the operator keying over ground's first word. Holding T on the end card
  // and clicking through to the next lift used to replace the radio check with
  // "Say again, you doubled me." and start the operator a fault down before they
  // had touched a control. Full duplex retired the fault, but a mic that keys
  // itself is still wrong, so it still has to be released and pressed again.
  micLatched = !!ctx.state.intent.ptt;
  banked = null;
  r.answered = null;
  inAllStop = false;
  enterNode(ctx, script.start);
}

function stopScript(ctx) {
  repeating = false;
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
  r.answered = null;
  r.tx = 'idle';
  r.pttLed = false;
  r.groundTimer = 0;
  r.ackTimer = 0;
  r.ackTimeout = 0;
  r.playerTimer = 0;
  r.guideTimer = 0;
  banked = null;
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
  lastGuideKey = null;
  sameCallBeats = 0;
  descentTimer = 0;
  lastDepthKey = null;
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
    r.replies = [SAY_AGAIN_LABEL];
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

// A node field that states a distance is a { imperial, metric } pair. Anything
// else is used as it stands, so only the handful of lines carrying a number pay
// for this. state.settings.units is the same setting the gauges read, which is
// the whole point: the voice, the caption and the readout agree or the operator
// stops believing any of them.
function inUnits(value, units) {
  if (value && typeof value === 'object' && ('imperial' in value || 'metric' in value)) {
    return units === 'imperial' ? value.imperial : value.metric;
  }
  return value;
}

// How long a call is on the air. The recording's own length plus the beat ground
// leaves before it unkeys, or DEFAULT_TX for a key with no clip, which is what
// every call used to get whether it needed 0.6 s or 4.
function txLength(key) {
  const clip = key ? CLIP_SECONDS[key] : 0;
  return clip ? clip + CLIP_TAIL : DEFAULT_TX;
}

// Put the current node's call on the air. urgencyBump raises the read urgency
// when ground has to say it again. `hint` replaces both the caption and the clip
// for the rigging re-calls, which say something the node itself does not.
function sayNode(ctx, urgencyBump, hint, isRepeat) {
  const { state, bus } = ctx;
  const r = state.radio;
  // A repeat asked for from a gate the operator is already standing in. When the
  // transmission ends it goes back to that gate. Without this, "Say again" inside
  // a waitFor re-opened the reply window on a node that had already been
  // answered, the window lapsed into a fault, the fault re-sent the call, and the
  // node turned into a fault generator: one every 4.6 s for as long as the gate
  // stayed shut, while the operator did exactly what ground had asked.
  repeating = !!isRepeat;
  const units = state.settings.units;
  const key = inUnits((hint && hint.say) || node.say || null, units);
  mode = 'groundTx';
  r.groundTimer = txLength(key);
  r.caption = inUnits((hint && hint.caption) || node.caption || '', units);
  r.replies = replyLabels(node);
  r.answered = null;
  banked = null;
  if (key) bus.emit('radio.say', { key, urgency: (node.urgency || 0) + (urgencyBump || 0) });
}

function replyLabels(n) {
  const expect = (n && n.expect) || [];
  return expect.slice(0, 3).concat([SAY_AGAIN_LABEL]);
}

// The reply strip is drawn in every mode, so its buttons have to mean something
// in every mode. Say again is the one that always applies: ground repeats what
// it last said. Anything else is only live while a reply window is open.
function sayAgainPressed(ctx) {
  const r = ctx.state.radio;
  const pick = ctx.state.intent.reply;
  return pick !== null && pick >= 0 && pick < r.replies.length &&
    r.replies[pick] === SAY_AGAIN_LABEL;
}

let repeating = false;  // the transmission on the air is a repeat from a gate
let lastGuide = null;   // the guide call on the air, so it can be repeated

function repeatGuide(ctx) {
  if (!lastGuide) return;
  sayGuide(ctx, lastGuide.call, lastGuide.distance, lastGuide.urgency);
}

function advance(ctx) {
  enterNode(ctx, node.next === undefined ? null : node.next);
}

// ---------- faults, overlap, interrupts ----------

function fault(ctx, why) {
  const r = ctx.state.radio;
  r.faults += 1;
  ctx.bus.emit('radio.fault', { node: r.node, why: why || 'timeout' });
}

// allStop and allStopClear are handlers, not places in the script, so they are
// never what RETURN comes back to.
const HANDLER_NODES = ['allStop', 'allStopClear'];
const isHandler = (id) => HANDLER_NODES.includes(id);

// Both stations on the air at once. On a full duplex set that is not an error
// and costs nothing: it is announced only so audio.js can put the two carriers
// against each other and the operator can hear that they are talking over the
// top of ground.
function overlap(ctx) {
  ctx.bus.emit('radio.overlap', { node: ctx.state.radio.node });
}

function interrupt(ctx) {
  const r = ctx.state.radio;
  if (!script || mode === 'off' || mode === 'done') return;
  if (allStopTimer > 0 || inAllStop) return;      // one ALL STOP at a time
  const all = script.nodes.allStop;
  if (!all) return;
  // The clock starts here and runs whatever happens to the script afterwards.
  allStopTimer = txLength(all.say) + (all.timeout || ALL_STOP_WINDOW);
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
// Where a spot is, in the only terms the operator has controls for: metres of
// slew arc and metres of trolley travel. Shared by the guide calls and by
// ground's call for the hook, because "over the load" and "on the mark" are the
// same problem and he should say them the same way.
function polarErrorTo(state, target) {
  const c = state.crane;
  const hang = c.hangRadius !== undefined ? c.hangRadius : c.radius;
  const targetRadius = Math.hypot(target[0], target[2]);
  const dAngle = wrapPi(Math.atan2(target[2], target[0]) - c.slew);
  // Measured from where the rope hangs, so "trolley in two feet" is two feet of
  // load rather than two feet of trolley. Under load those differ by the bend.
  return { tangential: dAngle * hang, radial: targetRadius - hang };
}

// The single largest correction, as a call. Ground never says two at once.
function correctionFor(state, err) {
  const swing = Math.abs(err.tangential) >= Math.abs(err.radial);
  const call = swing
    ? (err.tangential > 0 ? GUIDE_CALLS.swingRight : GUIDE_CALLS.swingLeft)
    : (err.radial > 0 ? GUIDE_CALLS.trolleyOut : GUIDE_CALLS.trolleyIn);
  return { call, distance: Math.abs(swing ? err.tangential : err.radial) };
}

// A guide call rendered to the clip key and caption it will go out as. sayGuide
// does this inline for the guide nodes; the hook call needs the same thing as a
// { say, caption } hint it can hand to sayNode.
function callAsHint(state, call, distance) {
  let caption = call.caption;
  let key = call.say;
  if (call.distance && distance !== null && distance > SAY_DISTANCE_OVER) {
    const b = distanceBucket(distance, state.settings.units);
    caption += `, ${b.words}.`;
    key = `${call.say}_${b.tag}`;
  } else if (!caption.endsWith('.')) {
    caption += '.';
  }
  return { say: key, caption };
}

function guideInfo(ctx) {
  const { state } = ctx;
  const c = state.crane;
  const target = node.guide === 'landing' ? state.mission.landingPos : state.mission.pickupPos;
  if (!target) return null;

  const tx = target[0];
  const tz = target[2];

  const jibX = (c.hangRadius !== undefined ? c.hangRadius : c.radius) +
    Math.sin(state.load.swing.y) * c.line;
  const jibZ = Math.sin(state.load.swing.x) * c.line;
  const cos = Math.cos(c.slew);
  const sin = Math.sin(c.slew);
  const hookX = jibX * cos - jibZ * sin;
  const hookZ = jibX * sin + jibZ * cos;

  const err = polarErrorTo(state, target);
  return {
    tangential: err.tangential,
    radial: err.radial,
    dist: Math.hypot(tx - hookX, tz - hookZ)
  };
}


// Which bucket ground calls this error as. Buckets run smallest first, so the
// answer is the last one the distance clears; past the top of the list a number
// stops being useful and ground says "keep coming" instead. Returns the words
// for the caption and the tag that names the clip, together, because they have
// to agree: the operator reads the caption while hearing the recording.
function distanceBucket(metres, units) {
  const table = DISTANCE_BUCKETS[units === 'imperial' ? 'imperial' : 'metric'];
  let pick = null;
  for (const b of table) {
    if (metres >= b.value) pick = b; else break;
  }
  if (!pick) return table[0];
  if (pick === table[table.length - 1] && metres >= table[table.length - 1].value * 1.5) {
    return DISTANCE_FAR;
  }
  return pick;
}

function sayGuide(ctx, call, distance, urgency) {
  const { state, bus } = ctx;
  const r = state.radio;
  lastGuide = { call, distance, urgency };
  let caption = call.caption;
  let key = call.say;
  if (call.distance && distance !== null && distance > SAY_DISTANCE_OVER) {
    const b = distanceBucket(distance, state.settings.units);
    caption += `, ${b.words}.`;
    key = `${call.say}_${b.tag}`;
  } else if (!caption.endsWith('.')) {
    caption += '.';
  }
  mode = 'guideTx';
  r.groundTimer = txLength(key);
  r.caption = caption;
  r.replies = [SAY_AGAIN_LABEL];
  r.answered = null;
  banked = null;
  bus.emit('radio.say', { key, urgency: urgency || 0 });
}

// How long to wait before the next guide call. Near the mark that is quick, a
// long way out it is not: the two are blended on how far the jib still has to
// travel, so the pace tightens as the operator closes rather than stepping.
function guidePeriod(err, tol) {
  const span = Math.max(0.001, GUIDE_FAR_ERR - tol);
  const t = Math.min(1, Math.max(0, (err - tol) / span));
  return GUIDE_PERIOD_NEAR + (GUIDE_PERIOD_FAR - GUIDE_PERIOD_NEAR) * t;
}

// How far the load still has to fall to reach what it is being set down on.
// sensors.hookHeight is the load's CENTRE, not its bottom: sensors.js subtracts
// half the load height from the block, and its own header says so. Counting down
// to the centre told the operator he had half a load height more room than he
// had, which is the wrong direction to be wrong in on a blind set-down - it was
// 0.70 m out on the shaft and 0.50 m on the scaffold.
function dropRemaining(state) {
  const landing = state.mission.landingPos;
  if (!landing) return null;
  const load = state.load;
  const halfHeight = load.attached ? (load.size[1] || 0) / 2 : 0;
  return (state.sensors.hookHeight - halfHeight) - landing[1];
}

// The countdown call for a remaining drop, as a clip key and a caption. Same
// buckets and the same words as a horizontal correction, so the two never sound
// like different men reading off different tapes.
function depthCall(state, drop) {
  const b = distanceBucket(drop, state.settings.units);
  if (b === DISTANCE_FAR) return null;      // too far out for a number to help
  const words = `${b.words[0].toUpperCase()}${b.words.slice(1)}`;
  return { say: `TOGO_${b.tag}`, caption: DEPTH_CAPTION.replace('{n}', words) };
}

// ---------- main loop ----------

export function update(ctx, dt) {
  const { state } = ctx;
  const r = state.radio;

  if (!state.intent.ptt) micLatched = false;

  if (!script || mode === 'off' || mode === 'done') {
    setTx(ctx);
    return;
  }

  // The ALL STOP clock. It is checked against the E-stop itself, not against
  // whatever node.waitFor happens to be: a "say again" on the alarm re-sends the
  // call, and nothing about the operator asking for it again may buy them time.
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
  if (state.sensors.loadSway > SWAY_INTERRUPT) {
    if (swayArmed) { swayArmed = false; interrupt(ctx); }
  } else {
    swayArmed = true;
  }

  // Full duplex. The operator may answer over the top of ground, and nothing
  // about doing so is a fault: the answer is banked and lands the moment the
  // call ends, and ground finishes its sentence underneath it.
  const transmitting = mode === 'groundTx' || mode === 'guideTx';
  if (transmitting) {
    // Only a key that maps to a button on the strip is the operator talking.
    // Keys 1-8 always set intent.reply, but the strip never holds more than
    // four, so pressing 6 during a call is a key with nothing behind it.
    const spoke = state.intent.reply !== null &&
      state.intent.reply >= 0 && state.intent.reply < r.replies.length;
    const label = spoke ? r.replies[state.intent.reply] : null;
    if (state.intent.ptt && !micLatched) { micLatched = true; overlap(ctx); }
    if (spoke) {
      overlap(ctx);
      if (label === SAY_AGAIN_LABEL) {
        // Ground heard it and starts the call over, from the top.
        if (mode === 'guideTx') repeatGuide(ctx);
        else sayNode(ctx, 0, null, repeating);
        setTx(ctx);
        return;
      }
      // Bank it. A node with no reply window has nothing to bank it against, so
      // the press is just the operator talking and the script is unmoved.
      if (mode === 'groundTx' && node.timeout !== null && node.timeout !== undefined) {
        banked = label;
        r.answered = label;
      }
    }
  }

  switch (mode) {
    case 'groundTx': {
      r.groundTimer -= dt;
      // The re-say is part of the four seconds, but the timer may not be allowed
      // to reach zero in here: only the hookWait and unhookWait cases can fire
      // the retry, and both are guarded on the timer still being positive. A
      // retry that expired inside a transmission was simply lost, and the lift
      // stranded at "on the hook" with nothing able to win or fail it. That was
      // a quarter of all fuzzed runs, and by some distance the most common hang
      // in the game.
      if (hookRetry > 0) hookRetry = Math.max(RETRY_FLOOR, hookRetry - dt);
      if (unhookRetry > 0) unhookRetry = Math.max(RETRY_FLOOR, unhookRetry - dt);
      if (r.groundTimer <= 0) {
        r.groundTimer = 0;
        const wasRepeat = repeating;
        repeating = false;
        fireAction(ctx);
        // An answer given while ground was still talking lands here, with the
        // reply window never opening. That is the whole of what full duplex buys
        // the operator: say "moving" the instant you know, not after sitting
        // through the rest of the call waiting for a window to open.
        if (!wasRepeat && banked !== null &&
            node.timeout !== null && node.timeout !== undefined) {
          const label = banked;
          banked = null;
          r.answered = null;
          r.ackTimer = 0;
          r.ackTimeout = 0;
          ctx.bus.emit('radio.reply', { label, node: r.node });
          mode = 'playerTx';
          r.playerTimer = PLAYER_TX;
          break;
        }
        banked = null;
        r.answered = null;
        if (!wasRepeat && node.timeout !== null && node.timeout !== undefined) {
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
        if (label === SAY_AGAIN_LABEL) { sayNode(ctx, 0); break; }
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
      if (sayAgainPressed(ctx)) { sayNode(ctx, 0, null, true); break; }
      // A set-down the operator cannot see. Ground talks the load down instead
      // of standing there watching it. This is not the repeat machinery and is
      // not capped by it: a countdown is new information every time it changes,
      // which is the opposite of repeating yourself.
      if (node.descend) descend(ctx, dt);
      break;
    }

    case 'hookWait': {
      if (hookResult === 'attached') { hookResult = null; advance(ctx); break; }
      if (hookResult === 'notReady') {
        hookResult = null;
        hookRetry = HOOK_RETRY;
        // The retry itself is never capped - it is what eventually rigs the load
        // and dropping it is how the lift used to strand at "on the hook" with
        // nothing able to win or fail it. Only the voice stops. The hint stays on
        // the caption and keeps updating, so an operator who is still hunting for
        // the window can read which way to go without being told every 4 s.
        r.repeats += 1;
        if (r.repeats <= MAX_REPEATS) sayNode(ctx, 1, hookHint, true);
        else r.caption = hookHint.caption;
        break;
      }
      if (hookRetry > 0) {
        hookRetry -= dt;
        if (hookRetry <= 0) { hookRetry = 0; ctx.bus.emit('hook.attach', {}); }
      }
      if (sayAgainPressed(ctx)) sayNode(ctx, 0, null, true);
      break;
    }

    case 'unhookWait': {
      if (unhookResult === 'released') { unhookResult = null; advance(ctx); break; }
      if (unhookResult === 'refused') {
        unhookResult = null;
        unhookRetry = HOOK_RETRY;
        // Same as the hook: the retry keeps running, only the voice stops.
        r.repeats += 1;
        if (r.repeats <= MAX_REPEATS) sayNode(ctx, 1, NOT_SLACK_HINT, true);
        else r.caption = NOT_SLACK_HINT.caption;
        break;
      }
      if (unhookRetry > 0) {
        unhookRetry -= dt;
        if (unhookRetry <= 0) { unhookRetry = 0; ctx.bus.emit('hook.release', {}); }
      }
      if (sayAgainPressed(ctx)) sayNode(ctx, 0, null, true);
      break;
    }

    case 'guide': {
      const g = guideInfo(ctx);
      if (!g) break;
      const tol = guideTolerance(ctx);
      if (g.dist <= tol && swaySettled(state, GUIDE_SETTLE, GUIDE_SETTLE_RATE)) { advance(ctx); break; }

      // Two different quantities, and mixing them is what made ground unusable
      // on a real approach. g.dist is where the load is, swing included, and it
      // is the right thing to gate on: the lift does not go on until the load is
      // over the mark and still. jibErr is where the jib is, and it is the only
      // thing a correction can address, because "trolley out" moves the jib, not
      // the swing.
      //
      // Holding and correcting used to be decided on g.dist, so once the jib was
      // parked on the mark and only the swing was holding the gate shut, the
      // swinging load crossed the hold band twice a period and ground alternated
      // "Trolley out" and "Hold, hold, hold." every three seconds over an eight
      // millimetre jib error, whipsawing anyone who obeyed into pumping the
      // swing. Both now read jibErr, so ground says hold once and then lets the
      // operator do exactly that.
      const jibErr = Math.hypot(g.tangential, g.radial);
      if (jibErr > tol * HOLD_FACTOR) holdSaid = false;

      if (sayAgainPressed(ctx)) { repeatGuide(ctx); break; }

      r.guideTimer -= dt;
      if (r.guideTimer > 0) break;
      r.guideTimer = guidePeriod(jibErr, tol);

      if (jibErr <= tol * HOLD_FACTOR && !holdSaid) {
        holdSaid = true;
        lastGuideKey = null;
        sameCallBeats = 0;
        sayGuide(ctx, GUIDE_CALLS.hold, null, 1);
        break;
      }
      // Off the air only when the jib is actually inside the gate and the wait is
      // for the swing to die. Anywhere short of that, corrections keep coming:
      // holding once and then going silent for the whole band out to three
      // tolerances left the operator up to three tolerances short, told to hold,
      // with no further word and no way for the node to advance. On the blind
      // shaft, where the hook cam is refused, there was nothing to tell them.
      if (jibErr <= tol) break;
      // Say the single largest correction, never two at once.
      const { call, distance } = correctionFor(state, g);
      // What that call will actually go out as, so an unchanged one can be
      // recognised before it is said rather than after. Same direction and same
      // bucket is the same sentence, and saying it again tells the operator
      // nothing he did not hear ten seconds ago.
      const key = callAsHint(state, call, distance).say;
      if (key === lastGuideKey) {
        sameCallBeats += 1;
        if (sameCallBeats < GUIDE_SAME_HOLDOFF) break;
      }
      sameCallBeats = 0;
      lastGuideKey = key;
      sayGuide(ctx, call, distance, 0);
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

// Talk a blind load down. Called every tick from the wait gate of a node marked
// `descend`, and it says one of two things: how far there is to go, or, if the
// load has started to swing where it cannot afford to, to get it plumb.
function descend(ctx, dt) {
  const { state } = ctx;
  const drop = dropRemaining(state);
  if (drop === null || drop <= 0) return;

  descentTimer -= dt;
  if (descentTimer > 0) return;

  // Same shape as the guide cadence: sparse at the top, quick at the bottom.
  const t = Math.min(1, Math.max(0, drop / DESCENT_FAR_DROP));
  descentTimer = DESCENT_PERIOD_NEAR + (DESCENT_PERIOD_FAR - DESCENT_PERIOD_NEAR) * t;

  // A load swinging into the side of a shaft is worth more than a number.
  if (state.sensors.loadSway > DESCENT_SWAY) {
    lastDepthKey = null;
    sayNode(ctx, 1, PLUMB_HINT, true);
    return;
  }

  const call = depthCall(state, drop);
  if (!call || call.say === lastDepthKey) return;   // nothing new to say yet
  lastDepthKey = call.say;
  sayNode(ctx, 0, call, true);
}

function onTimeout(ctx) {
  const r = ctx.state.radio;
  r.repeats += 1;

  if (node.onTimeout === 'ignoredAllStop') {
    // The one call that is not capped. The hard deadline above owns this and it
    // is measured in seconds, so it cannot run long; and an alarm that stops
    // shouting while the load is still swinging is not an alarm. The ack window
    // keeps repeating until the deadline fires, so the caption stays on screen.
    sayNode(ctx, 1);
    return;
  }
  // Said enough. Ground stops asking and lets the gate decide, rather than
  // standing there repeating himself into a cab that is clearly busy. Nothing
  // hangs: a node with no gate advances from here, and a node with one waits for
  // the thing the operator was told to do. Faults stop with the transmissions,
  // so an unanswered call now costs a bounded number rather than one every few
  // seconds for as long as the operator ignores it.
  if (r.repeats > MAX_REPEATS) {
    ctx.bus.emit('radio.gaveUp', { node: r.node, said: r.repeats });
    toGate(ctx);
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
