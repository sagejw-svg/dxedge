// PHASE 3. Radio director. Owns state.radio. Scripts live in data/radio.js.
// Node shape: { id, say, caption, expect, timeout, onTimeout, waitFor, next, urgency }
// States: idle | groundTx | playerTx.
//   groundTx lasts the clip length (or 1.6 s if no clip), then caption stays.
//   player PTT (intent.ptt) during groundTx = DOUBLED: both garbled, faults++, emit radio.doubled,
//   jump to the script's sayAgain node.
//   ackTimer counts from end of groundTx; at timeout run onTimeout ('repeat' or 'fault').
// Reply strip = node.expect (max 3) plus 'Say again' always. intent.reply indexes it.
// waitFor blocks advance until that bus event fires.
// Voice clip by say key via audio.playRadio(ctx, key). Missing clip = caption only.
// Hook / unhook: nodes may carry { action: 'hook' | 'unhook' }; emit hook.attach / hook.release.

export function init(ctx) {}

export function update(ctx, dt) {}
