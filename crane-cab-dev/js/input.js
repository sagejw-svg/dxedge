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

const pressed = new Set();

// E-stop and brake are sticky toggles. Track the previous physical key state
// so a held key doesn't spam the toggle every frame.
let estopKeyWasDown = false;
let brakeKeyWasDown = false;

// Mouse-drag look accumulator. Filled by pointer events, flushed into
// intent.look once per tick in update(), then cleared by main.js's endTick.
let lookAccumDx = 0;
let lookAccumDy = 0;
let dragging = false;

// Mouse sensitivity, radians per pixel of drag.
const LOOK_SENS = 0.0035;

function isTypingTarget(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}

export function init(ctx) {
  // Reply strip buttons are an input device. ui.js renders them with data-index.
  document.getElementById('r-replies').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-index]');
    if (b) ctx.state.intent.reply = Number(b.dataset.index);
  });

  const canvas = document.getElementById('glass');

  window.addEventListener('keydown', (e) => {
    if (isTypingTarget(e)) return;
    // Only intercept keys this module owns. Escape and F3 are not our keys.
    if (e.key === 'Escape' || e.key === 'F3') return;

    const k = e.key;
    const digit = /^[1-8]$/.test(k) ? Number(k) - 1 : null;
    if (digit !== null) {
      ctx.state.intent.reply = digit;
      e.preventDefault();
      return;
    }

    const code = e.code;
    const ownedCodes = [
      'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyR', 'KeyF',
      'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight',
      'KeyT', 'KeyH', 'KeyB', 'KeyC', 'Space'
    ];
    if (ownedCodes.includes(code)) e.preventDefault();

    if (code === 'Space') {
      if (!estopKeyWasDown) {
        ctx.state.intent.estop = !ctx.state.intent.estop;
      }
      estopKeyWasDown = true;
      return;
    }
    if (code === 'KeyB') {
      if (!brakeKeyWasDown) {
        ctx.state.intent.brake = !ctx.state.intent.brake;
      }
      brakeKeyWasDown = true;
      return;
    }
    if (code === 'KeyT') {
      ctx.state.intent.ptt = true;
      return;
    }

    pressed.add(code);
  });

  window.addEventListener('keyup', (e) => {
    const code = e.code;
    if (code === 'Space') { estopKeyWasDown = false; return; }
    if (code === 'KeyB') { brakeKeyWasDown = false; return; }
    if (code === 'KeyT') { ctx.state.intent.ptt = false; return; }
    pressed.delete(code);
  });

  // Lose key state on blur so a key doesn't get stuck "held" after alt-tab.
  window.addEventListener('blur', () => {
    pressed.clear();
    estopKeyWasDown = false;
    brakeKeyWasDown = false;
    ctx.state.intent.ptt = false;
  });

  // Mouse-drag look. Left button drag only, so it doesn't fight the reply
  // strip or console buttons.
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointerup', (e) => {
    dragging = false;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointercancel', () => { dragging = false; });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    lookAccumDx += e.movementX || 0;
    lookAccumDy += e.movementY || 0;
  });
}

function axis(negCode, posCode) {
  let v = 0;
  if (pressed.has(posCode)) v += 1;
  if (pressed.has(negCode)) v -= 1;
  return v;
}

export function update(ctx, dt) {
  const intent = ctx.state.intent;

  intent.slew = axis('KeyA', 'KeyD');
  intent.trolley = axis('KeyS', 'KeyW');
  intent.hoist = axis('KeyF', 'KeyR');

  const shift = pressed.has('ShiftLeft') || pressed.has('ShiftRight');
  const ctrl = pressed.has('ControlLeft') || pressed.has('ControlRight');
  intent.range = ctrl ? 'micro' : (shift ? 'II' : 'I');

  // Standard (non-inverted) mouselook: dragging down should pitch the
  // camera down, so screen-down (positive movementY) must decrease pitch.
  intent.look.dx = lookAccumDx * LOOK_SENS;
  intent.look.dy = -lookAccumDy * LOOK_SENS;
  lookAccumDx = 0;
  lookAccumDy = 0;
}

// Clear one-shot intents after every tick.
export function endTick(ctx) {
  ctx.state.intent.reply = null;
  ctx.state.intent.look.dx = 0;
  ctx.state.intent.look.dy = 0;
}
