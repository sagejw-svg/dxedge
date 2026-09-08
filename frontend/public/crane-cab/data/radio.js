// Radio scripts. Data only. radio.js runs them.
//
// Two node kinds share one table.
//
// CALL NODE (ground says something, the operator answers):
//   { id, say, caption, expect, timeout, onTimeout, waitFor, next, urgency, action }
//   say       clip key, audio/<say>.ogg, recorded in the ground crew voice.
//             A line that states a distance carries { imperial, metric } here
//             and in `caption`, and radio.js resolves the pair against
//             settings.units. Ground is one man on one site: he cannot say
//             "twelve metres" in the brief and "twenty five feet" in a guide
//             call thirty seconds later, which is what he did before the pairs
//             existed, out loud, with the gauges reading feet.
//             null = caption only. radio.js emits radio.say {key, urgency};
//             audio.js is what actually plays it. data/clips.js holds how long
//             every clip runs and is what sizes the transmission, so a node
//             whose caption says more than its clip does needs its own key:
//             UP_EASY and UP_EASY_HIGH are two calls, not one call with two
//             captions.
//   caption   the line shown on the radio head while ground transmits.
//   expect    reply labels that advance the script, max 3. 'Say again' is added
//             automatically and is always last. Picking 'Say again' re-sends the
//             current call and is never a fault.
//             The radio is full duplex: an answer pressed while ground is still
//             talking is banked and lands the moment the call ends. Nobody is
//             garbled and nothing is a fault for being said early.
//   timeout   seconds after ground finishes before onTimeout runs. null = no ack
//             window at all, the node goes straight to its waitFor gate.
//   onTimeout 'repeat'          first lapse re-sends at urgency + 1, second lapse
//                               logs a radio fault and re-sends again.
//             'fault'           logs the fault on the first lapse, then re-sends.
//             Both are capped: ground re-sends a call at most twice, then emits
//             radio.gaveUp and drops to the node's gate rather than repeating
//             himself indefinitely at an operator who is plainly busy. Faults
//             stop with the transmissions. 'ignoredAllStop' is exempt, because
//             an alarm that goes quiet with the load still swinging is not one.
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
//             script was interrupted on (allStopClear uses this).
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
//   A guide call's clip carries the distance in it: the direction key picks up
//   the bucket's tag (SWING_LEFT + F25 = SWING_LEFT_F25). See DISTANCE_BUCKETS.
//
// Every script must include allStop and allStopClear. There is no sayAgain node:
// it existed only for the half-duplex double, and full duplex has no double. A
// 'Say again' press re-sends whatever call is current, which is sayNode's job.

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
      brief:      { id: 'brief',
                    say: { imperial: 'SCAFFOLD_BRIEF_FT', metric: 'SCAFFOLD_BRIEF_M' },
                    caption: { imperial: 'Landing is up on the scaffold deck, forty feet. Keep it high.',
                               metric: 'Landing is up on the scaffold deck, twelve meters. Keep it high.' },
                    expect: ['Copy'], timeout: 4, onTimeout: 'repeat', waitFor: null, next: 'toPickup', urgency: 0 },
      toPickup:   { id: 'toPickup', guide: 'pickup', tol: 1.0, next: 'onHook' },
      onHook:     { id: 'onHook', say: 'ON_THE_HOOK', caption: 'On the hook.', expect: ['Hooked'], timeout: null, onTimeout: null, waitFor: null, next: 'upEasy', urgency: 0, action: 'hook' },
      upEasy:     { id: 'upEasy', say: 'UP_EASY_HIGH', caption: 'Up easy. Well above the deck before you come round.', expect: ['Moving'], timeout: 3, onTimeout: 'fault', waitFor: 'hook.tight', next: 'toLanding', urgency: 0 },
      toLanding:  { id: 'toLanding', guide: 'landing', tol: 1.0, next: 'hold' },
      hold:       { id: 'hold', say: 'HOLD', caption: 'Hold, hold, hold.', expect: ['Stopped'], timeout: 2, onTimeout: 'fault', waitFor: 'sway.settled', next: 'downEasy', urgency: 1 },
      downEasy:   { id: 'downEasy', say: 'DOWN_EASY_DECK', caption: 'Down easy onto the deck.', expect: ['Moving'], timeout: 3, onTimeout: 'fault', waitFor: 'load.near', next: 'lastCall', urgency: 0 },
      lastCall:   { id: 'lastCall',
                    say: { imperial: 'LAST_CALL_FT', metric: 'LAST_CALL_M' },
                    caption: { imperial: 'Ten feet. Micro from here.', metric: 'Three meters. Micro from here.' },
                    expect: ['Copy'], timeout: 3, onTimeout: 'repeat', waitFor: 'load.slack', next: 'good', urgency: 1 },
      good:       { id: 'good', say: 'THATS_GOOD', caption: "That's good. Unhooking.", expect: ['Copy'], timeout: null, onTimeout: null, waitFor: null, next: 'complete', urgency: 0, action: 'unhook' },
      complete:   { id: 'complete', say: 'GOOD_LIFT', caption: 'Good lift. Standing by.', expect: [], timeout: null, onTimeout: null, waitFor: null, next: null, urgency: 0 },

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
      brief:      { id: 'brief',
                    say: { imperial: 'SHAFT_BRIEF_FT', metric: 'SHAFT_BRIEF_M' },
                    caption: { imperial: 'Blind pick. Shaft is thirty feet deep, sixteen across. My eyes only.',
                               metric: 'Blind pick. Shaft is nine meters deep, five across. My eyes only.' },
                    expect: ['Copy'], timeout: 4, onTimeout: 'repeat', waitFor: null, next: 'toPickup', urgency: 0 },
      toPickup:   { id: 'toPickup', guide: 'pickup', tol: 1.0, next: 'onHook' },
      onHook:     { id: 'onHook', say: 'ON_THE_HOOK', caption: 'On the hook.', expect: ['Hooked'], timeout: null, onTimeout: null, waitFor: null, next: 'upEasy', urgency: 0, action: 'hook' },
      upEasy:     { id: 'upEasy', say: 'UP_EASY', caption: 'Up easy.', expect: ['Moving'], timeout: 3, onTimeout: 'fault', waitFor: 'hook.tight', next: 'toLanding', urgency: 0 },
      toLanding:  { id: 'toLanding', guide: 'landing', tol: 1.0, next: 'centred' },
      centred:    { id: 'centred', say: 'CENTRED', caption: 'You are over the hole. Do not let it swing in there.', expect: ['Copy'], timeout: 3, onTimeout: 'repeat', waitFor: 'sway.settled', next: 'downEasy', urgency: 1 },
      downEasy:   { id: 'downEasy', say: 'DOWN_EASY_PLUMB', caption: 'Down easy. Keep her plumb.', expect: ['Moving'], timeout: 3, onTimeout: 'fault', waitFor: 'load.near', next: 'lastCall', urgency: 0 },
      lastCall:   { id: 'lastCall',
                    say: { imperial: 'LAST_CALL_FT', metric: 'LAST_CALL_M' },
                    caption: { imperial: 'Ten feet. Micro from here.', metric: 'Three meters. Micro from here.' },
                    expect: ['Copy'], timeout: 3, onTimeout: 'repeat', waitFor: 'load.slack', next: 'good', urgency: 1 },
      good:       { id: 'good', say: 'THATS_GOOD', caption: "That's good. Unhooking.", expect: ['Copy'], timeout: null, onTimeout: null, waitFor: null, next: 'complete', urgency: 0, action: 'unhook' },
      complete:   { id: 'complete', say: 'GOOD_LIFT', caption: 'Good lift. Standing by.', expect: [], timeout: null, onTimeout: null, waitFor: null, next: null, urgency: 0 },

      allStop:    { id: 'allStop', say: 'ALL_STOP', caption: 'ALL STOP. ALL STOP.', expect: ['Stopped'], timeout: 1.5, onTimeout: 'ignoredAllStop', waitFor: 'estop', next: 'allStopClear', urgency: 2 },
      allStopClear: { id: 'allStopClear', say: 'ALL_STOP_CLEAR', caption: 'All stop received. Recover easy.', expect: [], timeout: null, onTimeout: null, waitFor: null, next: 'RETURN', urgency: 1 }
    }
  }
};

// Guide call captions and clip keys. radio.js picks one of these per correction.
// `distance` says whether the call takes a bucket, and so whether clips exist
// for SAY_<tag> variants of it. HOLD is the one that does not: it means stop,
// and there is no such call as "hold, twenty feet".
export const GUIDE_CALLS = {
  swingLeft:  { say: 'SWING_LEFT', caption: 'Swing left', distance: true },
  swingRight: { say: 'SWING_RIGHT', caption: 'Swing right', distance: true },
  trolleyOut: { say: 'TROLLEY_OUT', caption: 'Trolley out', distance: true },
  trolleyIn:  { say: 'TROLLEY_IN', caption: 'Trolley in', distance: true },
  hold:       { say: 'HOLD', caption: 'Hold, hold, hold.', distance: false }
};

// Captions used when ground calls for the hook and the block is not on the load.
// One per reason, because "bring the hook over the load" told an operator whose
// block was three metres too low nothing about which way to go, and the only
// correction available to them failed the lift.
// Each is a clip key and a caption together, because ground says these out loud
// now and a caption that does not match what was just heard is worse than no
// caption at all.
export const NOT_READY_HINT = { say: 'NOT_READY', caption: 'Bring the hook over the load first.' };
export const TOO_HIGH_HINT = { say: 'TOO_HIGH', caption: 'Come down on it, you are high.' };
export const TOO_LOW_HINT = { say: 'TOO_LOW', caption: 'Take up your slack, you are past it.' };

// Said when ground calls the unhook and the load is not resting slack.
export const NOT_SLACK_HINT = { say: 'NOT_SLACK', caption: 'Set it down and give me slack first.' };

// Player facing wording that is not a script node. Hard rule 3 puts content in
// data/, and these are content: the label on the button the operator presses,
// and the vocabulary ground reads numbers out of. js/radio.js does the rounding
// and the plumbing; the words are here.
export const SAY_AGAIN_LABEL = 'Say again';

// How far, as ground actually says it. A banksman does not call a correction to
// the nearest five feet across a hundred and forty of them; he calls a bucket
// and then "keep coming" until it is worth a number again. Each bucket is one
// recorded clip per direction (SWING_LEFT_F25, TROLLEY_IN_M6), so the spoken
// distance and the caption can never drift apart, and the top of the list is
// where numbers stop being useful rather than an arbitrary cap.
//
// value  metres of error at or above which this bucket is the call
// words  what ground says
// tag    the suffix on the direction's clip key
export const DISTANCE_BUCKETS = {
  imperial: [
    { value: 1.524,  words: 'five feet', tag: 'F5' },
    { value: 3.048,  words: 'ten feet', tag: 'F10' },
    { value: 4.572,  words: 'fifteen feet', tag: 'F15' },
    { value: 6.096,  words: 'twenty feet', tag: 'F20' },
    { value: 7.620,  words: 'twenty five feet', tag: 'F25' },
    { value: 9.144,  words: 'thirty feet', tag: 'F30' },
    { value: 12.192, words: 'forty feet', tag: 'F40' },
    { value: 15.240, words: 'fifty feet', tag: 'F50' },
    { value: 22.860, words: 'seventy five feet', tag: 'F75' },
    { value: 30.480, words: 'one hundred feet', tag: 'F100' }
  ],
  metric: [
    { value: 2,  words: 'two meters', tag: 'M2' },
    { value: 3,  words: 'three meters', tag: 'M3' },
    { value: 5,  words: 'five meters', tag: 'M5' },
    { value: 6,  words: 'six meters', tag: 'M6' },
    { value: 8,  words: 'eight meters', tag: 'M8' },
    { value: 10, words: 'ten meters', tag: 'M10' },
    { value: 15, words: 'fifteen meters', tag: 'M15' },
    { value: 20, words: 'twenty meters', tag: 'M20' },
    { value: 25, words: 'twenty five meters', tag: 'M25' },
    { value: 30, words: 'thirty meters', tag: 'M30' }
  ]
};

// Past the last bucket the number stops helping. Ground says this instead.
export const DISTANCE_FAR = { words: 'keep coming', tag: 'ON' };
