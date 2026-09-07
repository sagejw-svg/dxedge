// Radio scripts. Data only. radio.js runs them.
//
// Two node kinds share one table.
//
// CALL NODE (ground says something, the operator answers):
//   { id, say, caption, expect, timeout, onTimeout, waitFor, next, urgency, action }
//   say       clip key, audio/<say>.ogg. null = caption only. radio.js emits
//             radio.say {key, urgency}; audio.js is what actually plays it.
//   caption   the line shown on the radio head while ground transmits.
//   expect    reply labels that advance the script, max 3. 'Say again' is added
//             automatically and is always last. Picking 'Say again' re-sends the
//             current call and is never a fault.
//   timeout   seconds after ground finishes before onTimeout runs. null = no ack
//             window at all, the node goes straight to its waitFor gate.
//   onTimeout 'repeat'          first lapse re-sends at urgency + 1, second lapse
//                               logs a radio fault and re-sends again.
//             'fault'           logs the fault on the first lapse, then re-sends.
//             'ignoredAllStop'  the node's timeout becomes an absolute deadline
//                               that runs whatever the director is doing, and
//                               emits radio.ignoredAllStop when it expires.
//                               Only the allStop node uses it; missions.js fails
//                               the lift on that event. Deliberately not
//                               postponable by a reply or a say again.
//   waitFor   bus event that must fire before this node advances. The gate is
//             satisfied by the event OR by the equivalent condition already being
//             true when the gate is reached (hook.tight = line tension at 95% of
//             the hanging weight, load.slack = sensors.slack, sway.settled =
//             sway under 0.5 deg, estop = intent.estop latched). Without that
//             level check a node can wait forever for an edge that fired one node
//             earlier - hooking on with the rope already taut is the real case.
//             (PHASE 3 addition, documented here because it changes script meaning.)
//   next      node id. null = script complete. 'RETURN' = go back to the node the
//             script was interrupted on (sayAgain and allStopClear use this).
//   urgency   0 calm, 1 firm, 2 shouting. Guide HOLD and ALL STOP raise it.
//   action    'hook' | 'unhook' | null. Ground-controlled rigging. radio.js emits
//             hook.attach / hook.release; only missions.js touches state.load.
//             A node with action 'hook' or 'unhook' has no ack timer: it waits
//             for hook.attached / hook.released, and on hook.notReady or
//             hook.notReleased it re-sends with the matching caption and tries
//             again 4 s later. Without that wait the script ran on past a
//             refused unhook and the lift could never be won or lost.
//
// GUIDE NODE (ground talks the hook onto a spot, no reply expected):
//   { id, guide: 'pickup' | 'landing', tol, next }
//   guide     which mission position to steer to. radio.js reads
//             state.mission.pickupPos / landingPos, never the mission data.
//   tol       metres. A landing guide clamps this to the mission's own scoring
//             tolerance, so ground never stops calling corrections while the
//             load is still short of what the lift is graded on. Inside 3x tol
//             ground says HOLD once. The node advances when the load is inside
//             tol and the swing is both small and slow.
//   Guide calls are sent every 3 s, expect no reply and never fault.
//
// Every script must include sayAgain, allStop and allStopClear.

export const SCRIPTS = {
  // Mission 0. Radio check, then a full ground-guided lift on an empty deck.
  radioCheck: {
    start: 'check',
    nodes: {
      check:     { id: 'check', say: 'RADIO_CHECK', caption: 'TC-1, radio check.', expect: ['Copy'], timeout: 4, onTimeout: 'repeat', waitFor: null, next: 'toPickup', urgency: 0 },
      toPickup:  { id: 'toPickup', guide: 'pickup', tol: 1.0, next: 'onHook' },
      onHook:    { id: 'onHook', say: 'ON_THE_HOOK', caption: 'On the hook.', expect: ['Hooked'], timeout: null, onTimeout: null, waitFor: null, next: 'upEasy', urgency: 0, action: 'hook' },
      upEasy:    { id: 'upEasy', say: 'UP_EASY', caption: 'Up easy.', expect: ['Moving'], timeout: 3, onTimeout: 'fault', waitFor: 'hook.tight', next: 'toLanding', urgency: 0 },
      toLanding: { id: 'toLanding', guide: 'landing', tol: 1.0, next: 'hold' },
      hold:      { id: 'hold', say: 'HOLD', caption: 'Hold, hold, hold.', expect: ['Stopped'], timeout: 2, onTimeout: 'fault', waitFor: 'sway.settled', next: 'downEasy', urgency: 1 },
      downEasy:  { id: 'downEasy', say: 'DOWN_EASY', caption: 'Down easy.', expect: ['Moving'], timeout: 3, onTimeout: 'fault', waitFor: 'load.slack', next: 'good', urgency: 0 },
      good:      { id: 'good', say: 'THATS_GOOD', caption: "That's good. Unhooking.", expect: ['Copy'], timeout: null, onTimeout: null, waitFor: null, next: 'complete', urgency: 0, action: 'unhook' },
      complete:  { id: 'complete', say: 'GOOD_LIFT', caption: 'Good lift. Standing by.', expect: [], timeout: null, onTimeout: null, waitFor: null, next: null, urgency: 0 },

      sayAgain:  { id: 'sayAgain', say: 'SAY_AGAIN', caption: 'Say again, you doubled me.', expect: [], timeout: null, onTimeout: null, waitFor: null, next: 'RETURN', urgency: 1 },
      allStop:   { id: 'allStop', say: 'ALL_STOP', caption: 'ALL STOP. ALL STOP.', expect: ['Stopped'], timeout: 1.5, onTimeout: 'ignoredAllStop', waitFor: 'estop', next: 'allStopClear', urgency: 2 },
      allStopClear: { id: 'allStopClear', say: 'ALL_STOP_CLEAR', caption: 'All stop received. Recover easy.', expect: [], timeout: null, onTimeout: null, waitFor: null, next: 'RETURN', urgency: 1 }
    }
  },

  // Mission 1. Same skeleton, one extra call before the pickup guide because the
  // load is on a truck bed and the jib has to come round the cab first.
  truckUnload: {
    start: 'check',
    nodes: {
      check:      { id: 'check', say: 'RADIO_CHECK', caption: 'TC-1, radio check.', expect: ['Copy'], timeout: 4, onTimeout: 'repeat', waitFor: null, next: 'watchTruck', urgency: 0 },
      watchTruck: { id: 'watchTruck', say: 'WATCH_TRUCK', caption: 'Watch the truck cab. Swing right first.', expect: ['Copy'], timeout: 4, onTimeout: 'repeat', waitFor: null, next: 'toPickup', urgency: 0 },
      toPickup:   { id: 'toPickup', guide: 'pickup', tol: 1.0, next: 'onHook' },
      onHook:     { id: 'onHook', say: 'ON_THE_HOOK', caption: 'On the hook.', expect: ['Hooked'], timeout: null, onTimeout: null, waitFor: null, next: 'upEasy', urgency: 0, action: 'hook' },
      upEasy:     { id: 'upEasy', say: 'UP_EASY', caption: 'Up easy.', expect: ['Moving'], timeout: 3, onTimeout: 'fault', waitFor: 'hook.tight', next: 'toLanding', urgency: 0 },
      toLanding:  { id: 'toLanding', guide: 'landing', tol: 1.0, next: 'hold' },
      hold:       { id: 'hold', say: 'HOLD', caption: 'Hold, hold, hold.', expect: ['Stopped'], timeout: 2, onTimeout: 'fault', waitFor: 'sway.settled', next: 'downEasy', urgency: 1 },
      downEasy:   { id: 'downEasy', say: 'DOWN_EASY', caption: 'Down easy.', expect: ['Moving'], timeout: 3, onTimeout: 'fault', waitFor: 'load.slack', next: 'good', urgency: 0 },
      good:       { id: 'good', say: 'THATS_GOOD', caption: "That's good. Unhooking.", expect: ['Copy'], timeout: null, onTimeout: null, waitFor: null, next: 'complete', urgency: 0, action: 'unhook' },
      complete:   { id: 'complete', say: 'GOOD_LIFT', caption: 'Good lift. Standing by.', expect: [], timeout: null, onTimeout: null, waitFor: null, next: null, urgency: 0 },

      sayAgain:   { id: 'sayAgain', say: 'SAY_AGAIN', caption: 'Say again, you doubled me.', expect: [], timeout: null, onTimeout: null, waitFor: null, next: 'RETURN', urgency: 1 },
      allStop:    { id: 'allStop', say: 'ALL_STOP', caption: 'ALL STOP. ALL STOP.', expect: ['Stopped'], timeout: 1.5, onTimeout: 'ignoredAllStop', waitFor: 'estop', next: 'allStopClear', urgency: 2 },
      allStopClear: { id: 'allStopClear', say: 'ALL_STOP_CLEAR', caption: 'All stop received. Recover easy.', expect: [], timeout: null, onTimeout: null, waitFor: null, next: 'RETURN', urgency: 1 }
    }
  },

  // Mission 2. The pad is up on the scaffold, twelve metres off the deck, so the
  // set-down is at height and the operator cannot see the surface from the seat.
  scaffold: {
    start: 'check',
    nodes: {
      check:      { id: 'check', say: 'RADIO_CHECK', caption: 'TC-1, radio check.', expect: ['Copy'], timeout: 4, onTimeout: 'repeat', waitFor: null, next: 'brief', urgency: 0 },
      brief:      { id: 'brief', say: 'SCAFFOLD_BRIEF', caption: 'Landing is up on the scaffold deck, twelve metres. Keep it high.', expect: ['Copy'], timeout: 4, onTimeout: 'repeat', waitFor: null, next: 'toPickup', urgency: 0 },
      toPickup:   { id: 'toPickup', guide: 'pickup', tol: 1.0, next: 'onHook' },
      onHook:     { id: 'onHook', say: 'ON_THE_HOOK', caption: 'On the hook.', expect: ['Hooked'], timeout: null, onTimeout: null, waitFor: null, next: 'upEasy', urgency: 0, action: 'hook' },
      upEasy:     { id: 'upEasy', say: 'UP_EASY', caption: 'Up easy. Well above the deck before you come round.', expect: ['Moving'], timeout: 3, onTimeout: 'fault', waitFor: 'hook.tight', next: 'toLanding', urgency: 0 },
      toLanding:  { id: 'toLanding', guide: 'landing', tol: 1.0, next: 'hold' },
      hold:       { id: 'hold', say: 'HOLD', caption: 'Hold, hold, hold.', expect: ['Stopped'], timeout: 2, onTimeout: 'fault', waitFor: 'sway.settled', next: 'downEasy', urgency: 1 },
      downEasy:   { id: 'downEasy', say: 'DOWN_EASY', caption: 'Down easy onto the deck.', expect: ['Moving'], timeout: 3, onTimeout: 'fault', waitFor: 'load.near', next: 'lastFoot', urgency: 0 },
      lastFoot:   { id: 'lastFoot', say: 'LAST_FOOT', caption: 'Last foot. Micro.', expect: ['Copy'], timeout: 3, onTimeout: 'repeat', waitFor: 'load.slack', next: 'good', urgency: 1 },
      good:       { id: 'good', say: 'THATS_GOOD', caption: "That's good. Unhooking.", expect: ['Copy'], timeout: null, onTimeout: null, waitFor: null, next: 'complete', urgency: 0, action: 'unhook' },
      complete:   { id: 'complete', say: 'GOOD_LIFT', caption: 'Good lift. Standing by.', expect: [], timeout: null, onTimeout: null, waitFor: null, next: null, urgency: 0 },

      sayAgain:   { id: 'sayAgain', say: 'SAY_AGAIN', caption: 'Say again, you doubled me.', expect: [], timeout: null, onTimeout: null, waitFor: null, next: 'RETURN', urgency: 1 },
      allStop:    { id: 'allStop', say: 'ALL_STOP', caption: 'ALL STOP. ALL STOP.', expect: ['Stopped'], timeout: 1.5, onTimeout: 'ignoredAllStop', waitFor: 'estop', next: 'allStopClear', urgency: 2 },
      allStopClear: { id: 'allStopClear', say: 'ALL_STOP_CLEAR', caption: 'All stop received. Recover easy.', expect: [], timeout: null, onTimeout: null, waitFor: null, next: 'RETURN', urgency: 1 }
    }
  },

  // Mission 3. Down a shaft, nine metres below the deck, with the hook cam off.
  // The operator genuinely cannot see the load once it is in the hole, so ground
  // talks the whole descent and this script is deliberately wordier than the
  // others rather than shorter.
  blindShaft: {
    start: 'check',
    nodes: {
      check:      { id: 'check', say: 'RADIO_CHECK', caption: 'TC-1, radio check.', expect: ['Copy'], timeout: 4, onTimeout: 'repeat', waitFor: null, next: 'brief', urgency: 0 },
      brief:      { id: 'brief', say: 'SHAFT_BRIEF', caption: 'Blind pick. Shaft is nine metres deep, five across. My eyes only.', expect: ['Copy'], timeout: 4, onTimeout: 'repeat', waitFor: null, next: 'toPickup', urgency: 0 },
      toPickup:   { id: 'toPickup', guide: 'pickup', tol: 1.0, next: 'onHook' },
      onHook:     { id: 'onHook', say: 'ON_THE_HOOK', caption: 'On the hook.', expect: ['Hooked'], timeout: null, onTimeout: null, waitFor: null, next: 'upEasy', urgency: 0, action: 'hook' },
      upEasy:     { id: 'upEasy', say: 'UP_EASY', caption: 'Up easy.', expect: ['Moving'], timeout: 3, onTimeout: 'fault', waitFor: 'hook.tight', next: 'toLanding', urgency: 0 },
      toLanding:  { id: 'toLanding', guide: 'landing', tol: 1.0, next: 'centred' },
      centred:    { id: 'centred', say: 'CENTRED', caption: 'You are over the hole. Do not let it swing in there.', expect: ['Copy'], timeout: 3, onTimeout: 'repeat', waitFor: 'sway.settled', next: 'downEasy', urgency: 1 },
      downEasy:   { id: 'downEasy', say: 'DOWN_EASY', caption: 'Down easy. Keep her plumb.', expect: ['Moving'], timeout: 3, onTimeout: 'fault', waitFor: 'load.near', next: 'lastMetre', urgency: 0 },
      lastMetre:  { id: 'lastMetre', say: 'LAST_METRE', caption: 'Two metres. Micro from here.', expect: ['Copy'], timeout: 3, onTimeout: 'repeat', waitFor: 'load.slack', next: 'good', urgency: 1 },
      good:       { id: 'good', say: 'THATS_GOOD', caption: "That's good. Unhooking.", expect: ['Copy'], timeout: null, onTimeout: null, waitFor: null, next: 'complete', urgency: 0, action: 'unhook' },
      complete:   { id: 'complete', say: 'GOOD_LIFT', caption: 'Good lift. Standing by.', expect: [], timeout: null, onTimeout: null, waitFor: null, next: null, urgency: 0 },

      sayAgain:   { id: 'sayAgain', say: 'SAY_AGAIN', caption: 'Say again, you doubled me.', expect: [], timeout: null, onTimeout: null, waitFor: null, next: 'RETURN', urgency: 1 },
      allStop:    { id: 'allStop', say: 'ALL_STOP', caption: 'ALL STOP. ALL STOP.', expect: ['Stopped'], timeout: 1.5, onTimeout: 'ignoredAllStop', waitFor: 'estop', next: 'allStopClear', urgency: 2 },
      allStopClear: { id: 'allStopClear', say: 'ALL_STOP_CLEAR', caption: 'All stop received. Recover easy.', expect: [], timeout: null, onTimeout: null, waitFor: null, next: 'RETURN', urgency: 1 }
    }
  }
};

// Guide call captions and clip keys. radio.js picks one of these per correction.
export const GUIDE_CALLS = {
  swingLeft:  { say: 'SWING_LEFT', caption: 'Swing left' },
  swingRight: { say: 'SWING_RIGHT', caption: 'Swing right' },
  trolleyOut: { say: 'TROLLEY_OUT', caption: 'Trolley out' },
  trolleyIn:  { say: 'TROLLEY_IN', caption: 'Trolley in' },
  hold:       { say: 'HOLD', caption: 'Hold, hold, hold.' }
};

// Captions used when ground calls for the hook and the block is not on the load.
// One per reason, because "bring the hook over the load" told an operator whose
// block was three metres too low nothing about which way to go, and the only
// correction available to them failed the lift.
export const NOT_READY_CAPTION = 'Bring the hook over the load first.';
export const TOO_HIGH_CAPTION = 'Come down on it, you are high.';
export const TOO_LOW_CAPTION = 'Take up your slack, you are past it.';

// Caption used when ground calls the unhook and the load is not resting slack.
export const NOT_SLACK_CAPTION = 'Set it down and give me slack first.';

// Player facing wording that is not a script node. Hard rule 3 puts content in
// data/, and these are content: the label on the button the operator presses,
// and the vocabulary ground reads numbers out of. js/radio.js does the rounding
// and the plumbing; the words are here.
export const SAY_AGAIN_LABEL = 'Say again';
export const SPOKEN_ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
  'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen'];
export const SPOKEN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy',
  'eighty', 'ninety'];
export const SPOKEN_HUNDRED = 'hundred';
export const SPOKEN_FEET = 'feet';
export const SPOKEN_METRES = 'meters';

