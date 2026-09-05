// Radio scripts. Data only. radio.js runs them.
// Node: { id, say, caption, expect, timeout, onTimeout, waitFor, next, urgency, action }
//   say       clip key, audio/<say>.ogg. null = caption only.
//   expect    reply labels that advance the script. 'Say again' is added automatically.
//   timeout   seconds after ground finishes before onTimeout runs. null = no timer.
//   onTimeout 'repeat' | 'fault'
//   waitFor   bus event that must fire before this node advances (after any expected reply).
//   next      node id. null = script complete.
//   action    'hook' | 'unhook' | null. Ground-controlled rigging.
// Every script must include a sayAgain node.

export const SCRIPTS = {
  radioCheck: {
    start: 'check',
    nodes: {
      check:    { id: 'check', say: 'RADIO_CHECK', caption: 'TC-1, radio check.', expect: ['Copy'], timeout: 4, onTimeout: 'repeat', waitFor: null, next: 'onHook', urgency: 0 },
      onHook:   { id: 'onHook', say: 'ON_THE_HOOK', caption: 'On the hook.', expect: ['Hooked'], timeout: 3, onTimeout: 'repeat', waitFor: null, next: 'upEasy', urgency: 0, action: 'hook' },
      upEasy:   { id: 'upEasy', say: 'UP_EASY', caption: 'Up easy.', expect: ['Moving'], timeout: 3, onTimeout: 'fault', waitFor: 'hook.tight', next: 'trolleyOut', urgency: 0 },
      trolleyOut: { id: 'trolleyOut', say: 'TROLLEY_OUT', caption: 'Trolley out, easy.', expect: ['Moving'], timeout: 3, onTimeout: 'fault', waitFor: 'load.inZone', next: 'hold', urgency: 0 },
      hold:     { id: 'hold', say: 'HOLD', caption: 'Hold, hold, hold.', expect: ['Stopped'], timeout: 2, onTimeout: 'fault', waitFor: 'sway.settled', next: 'downEasy', urgency: 1 },
      downEasy: { id: 'downEasy', say: 'DOWN_EASY', caption: 'Down easy.', expect: ['Moving'], timeout: 3, onTimeout: 'fault', waitFor: 'load.slack', next: 'good', urgency: 0 },
      good:     { id: 'good', say: 'THATS_GOOD', caption: "That's good. Unhooking.", expect: ['Copy'], timeout: 4, onTimeout: 'repeat', waitFor: null, next: null, urgency: 0, action: 'unhook' },
      sayAgain: { id: 'sayAgain', say: 'SAY_AGAIN', caption: 'Say again, you doubled me.', expect: [], timeout: null, onTimeout: null, waitFor: null, next: 'RETURN', urgency: 1 },
      allStop:  { id: 'allStop', say: 'ALL_STOP', caption: 'ALL STOP. ALL STOP.', expect: ['Stopped'], timeout: 1.5, onTimeout: 'fault', waitFor: 'estop', next: 'RETURN', urgency: 2 }
    }
  }
  // truckUnload, scaffold, blindShaft: Phase 3 and 4. Same node shape.
  // 'RETURN' as next means go back to the node that was active before the interrupt.
};
