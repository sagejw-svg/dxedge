// PHASE 1. Turns keyboard, mouse drag, and touch sticks into state.intent.
// Nothing downstream may know which device produced the intent.
//
// Desktop map: A/D slew, W/S trolley, R/F hoist, Shift range II, Ctrl micro,
//   T PTT (hold), H horn, B slew brake, C hook cam, Space E-stop, 1-8 reply,
//   mouse drag = look. Escape and F3 are handled in main.js / ui.js.
// Phone (Phase 5): left stick slew + trolley, right stick hoist, PTT, E-stop, micro, look-drag.
//
// Rules: intent axes are -1..1 with no inertia (crane.js adds inertia).
// reply is a one-shot: set on key down, cleared in endTick. It is only accepted
// while phase is 'playing', because endTick only runs inside a tick.

const pressed = new Set();

// E-stop and brake are sticky toggles. Track the previous physical key state
// so a held key doesn't spam the toggle every frame.
let estopKeyWasDown = false;
let brakeKeyWasDown = false;
let camKeyWasDown = false;

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
    if (ctx.state.phase !== 'playing') return;
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
      e.preventDefault();
      // reply is one-shot and is only cleared by endTick, which only runs while
      // the sim ticks. A digit pressed on the title, pause or end card used to
      // sit in the intent and double ground's first call of the next lift.
      // Key auto-repeat is one press held, not many presses.
      if (e.repeat || ctx.state.phase !== 'playing') return;
      ctx.state.intent.reply = digit;
      return;
    }

    const code = e.code;
    const ownedCodes = [
      'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyR', 'KeyF',
      'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight',
      'KeyT', 'KeyH', 'KeyB', 'KeyC', 'Space'
    ];
    if (ownedCodes.includes(code)) e.preventDefault();

    // Both of these are latching toggles, and both used to latch from the title,
    // pause and end cards, where the controls list advertises them. A mushroom
    // pressed on the title card dogs the whole first lift with nothing on screen
    // to say why.
    const playing = ctx.state.phase === 'playing';
    if (code === 'Space') {
      if (!estopKeyWasDown && playing) {
        ctx.state.intent.estop = !ctx.state.intent.estop;
      }
      estopKeyWasDown = true;
      return;
    }
    if (code === 'KeyB') {
      if (!brakeKeyWasDown && playing) {
        ctx.state.intent.brake = !ctx.state.intent.brake;
      }
      brakeKeyWasDown = true;
      return;
    }
    if (code === 'KeyT') {
      ctx.state.intent.ptt = true;
      return;
    }
    if (code === 'KeyC') {
      // A latching toggle like the brake, and phase guarded for the same reason.
      if (!camKeyWasDown && playing) ctx.state.intent.hookCam = !ctx.state.intent.hookCam;
      camKeyWasDown = true;
      return;
    }

    pressed.add(code);
  });

  window.addEventListener('keyup', (e) => {
    const code = e.code;
    if (code === 'Space') { estopKeyWasDown = false; return; }
    if (code === 'KeyB') { brakeKeyWasDown = false; return; }
    if (code === 'KeyC') { camKeyWasDown = false; return; }
    if (code === 'KeyT') { ctx.state.intent.ptt = false; return; }
    pressed.delete(code);
  });

  // Lose key state on blur so a key doesn't get stuck "held" after alt-tab.
  window.addEventListener('blur', () => {
    pressed.clear();
    estopKeyWasDown = false;
    brakeKeyWasDown = false;
    camKeyWasDown = false;
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
