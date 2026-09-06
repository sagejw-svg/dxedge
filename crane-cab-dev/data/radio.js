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
//             'ignoredAllStop'  emits radio.ignoredAllStop and stops the script.
//                               Only the allStop node uses it; missions.js fails
//                               the lift on that event. (PHASE 3 addition.)
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
//             A node with action 'hook' has no ack timer: it waits for
//             hook.attached, and on hook.notReady it re-sends with the
//             not-ready caption and tries again 4 s later.
//
// GUIDE NODE (ground talks the hook onto a spot, no reply expected):
//   { id, guide: 'pickup' | 'landing', tol, next }
//   guide     which mission position to steer to. radio.js reads
//             state.mission.pickupPos / landingPos, never the mission data.
//   tol       metres. Inside 3x tol ground says HOLD once. The node advances
//             when the hook is inside tol and sway is under 2 deg.
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
      good:      { id: 'good', say: 'THATS_GOOD', caption: "That's good. Unhooking.", expect: ['Copy'], timeout: 4, onTimeout: 'repeat', waitFor: null, next: 'complete', urgency: 0, action: 'unhook' },
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
      good:       { id: 'good', say: 'THATS_GOOD', caption: "That's good. Unhooking.", expect: ['Copy'], timeout: 4, onTimeout: 'repeat', waitFor: null, next: 'complete', urgency: 0, action: 'unhook' },
      complete:   { id: 'complete', say: 'GOOD_LIFT', caption: 'Good lift. Standing by.', expect: [], timeout: null, onTimeout: null, waitFor: null, next: null, urgency: 0 },

      sayAgain:   { id: 'sayAgain', say: 'SAY_AGAIN', caption: 'Say again, you doubled me.', expect: [], timeout: null, onTimeout: null, waitFor: null, next: 'RETURN', urgency: 1 },
      allStop:    { id: 'allStop', say: 'ALL_STOP', caption: 'ALL STOP. ALL STOP.', expect: ['Stopped'], timeout: 1.5, onTimeout: 'ignoredAllStop', waitFor: 'estop', next: 'allStopClear', urgency: 2 },
      allStopClear: { id: 'allStopClear', say: 'ALL_STOP_CLEAR', caption: 'All stop received. Recover easy.', expect: [], timeout: null, onTimeout: null, waitFor: null, next: 'RETURN', urgency: 1 }
    }
  }
  // scaffold, blindShaft: Phase 4. Same node shapes.
};

// Guide call captions and clip keys. radio.js picks one of these per correction.
export const GUIDE_CALLS = {
  swingLeft:  { say: 'SWING_LEFT', caption: 'Swing left' },
  swingRight: { say: 'SWING_RIGHT', caption: 'Swing right' },
  trolleyOut: { say: 'TROLLEY_OUT', caption: 'Trolley out' },
  trolleyIn:  { say: 'TROLLEY_IN', caption: 'Trolley in' },
  hold:       { say: 'HOLD', caption: 'Hold, hold, hold.' }
};

// Caption used when ground calls for the hook and the hook is not on the load.
export const NOT_READY_CAPTION = 'Bring the hook over the load first.';
