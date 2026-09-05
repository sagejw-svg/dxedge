// PHASE 1. Turns keyboard, mouse drag, and touch sticks into state.intent.
// Nothing downstream may know which device produced the intent.
//
// Desktop map: A/D slew, W/S trolley, R/F hoist, Shift range II, Ctrl micro,
//   T PTT (hold), H horn, B slew brake, C hook cam, Space E-stop, 1-8 reply,
//   mouse drag = look. Escape and F3 are handled in main.js / ui.js.
// Phone (Phase 5): left stick slew + trolley, right stick hoist, PTT, E-stop, micro, look-drag.
//
// Rules: intent axes are -1..1 with no inertia (crane.js adds inertia).
// reply is a one-shot: set on key down, cleared in endTick.

export function init(ctx) {
  // Reply strip buttons are an input device. ui.js renders them with data-index.
  document.getElementById('r-replies').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-index]');
    if (b) ctx.state.intent.reply = Number(b.dataset.index);
  });
}

export function update(ctx, dt) {}

// Clear one-shot intents after every tick.
export function endTick(ctx) {
  ctx.state.intent.reply = null;
  ctx.state.intent.look.dx = 0;
  ctx.state.intent.look.dy = 0;
}
