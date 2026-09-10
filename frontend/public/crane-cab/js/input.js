// PHASE 1. Turns keyboard, mouse drag, and touch sticks into state.intent.
// Nothing downstream may know which device produced the intent.
//
// Desktop map: A/D slew, W/S trolley, R/F hoist, Shift range II, Ctrl micro,
//   T PTT (hold), H horn, B slew brake, C hook cam, Space E-stop, 1-8 reply,
//   V eyes on the load, Z eyes front. G is ui.js's (it hides the screen console,
//   which is a display choice and touches no simulation state), as F3 is.
//   mouse drag = look. Escape and F3 are handled in main.js / ui.js.
// Phone (Phase 5): left stick slew + trolley, right stick hoist, PTT, E-stop, micro, look-drag.
//
// Rules: intent axes are -1..1 with no inertia (crane.js adds inertia).
// reply is a one-shot: set on key down, cleared in endTick. It is only accepted
// while phase is 'playing', because endTick only runs inside a tick.

const pressed = new Set();

// The sticky toggles - E-stop, brake, hook cam, and the two head keys - fire on
// the edge, not the level, so a held key is one press rather than one per frame.
// This used to be one boolean per key, and adding V and Z I updated the keydown,
// the keyup and the controls card but forgot the blur handler, which reset only
// the three booleans that existed when it was written. Alt-tab with Z held and
// the keyup went to the other window: the latch stayed down and Z was dead for
// the rest of the session, with the head stuck wherever it was leaning. One set
// that blur can clear wholesale cannot be forgotten by the next key I add.
const latched = new Set();

// Fires the first time a key goes down and not again until it comes back up.
function edge(code) {
  if (latched.has(code)) return false;
  latched.add(code);
  return true;
}

// Mouse-drag look accumulator. Filled by pointer events, flushed into
// intent.look once per tick in update(), then cleared by main.js's endTick.
let lookAccumDx = 0;
let lookAccumDy = 0;
let dragging = false;

// Mouse sensitivity, radians per pixel of drag.
const LOOK_SENS = 0.0035;
// Pixels-equivalent per tick for an arrow key, so a held arrow sweeps the head
// at about a radian a second, close to the pace of a comfortable drag.
const LOOK_KEY_STEP = 2.4;

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
      'KeyT', 'KeyH', 'KeyB', 'KeyC', 'Space',
      'KeyV', 'KeyZ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'
    ];
    if (ownedCodes.includes(code)) e.preventDefault();

    // Both of these are latching toggles, and both used to latch from the title,
    // pause and end cards, where the controls list advertises them. A mushroom
    // pressed on the title card dogs the whole first lift with nothing on screen
    // to say why.
    const playing = ctx.state.phase === 'playing';
    if (code === 'Space') {
      const first = edge(code);
      if (first && playing) ctx.state.intent.estop = !ctx.state.intent.estop;
      return;
    }
    if (code === 'KeyB') {
      const first = edge(code);
      if (first && playing) ctx.state.intent.brake = !ctx.state.intent.brake;
      return;
    }
    if (code === 'KeyT') {
      // Phase guarded like the latching toggles above: the mic has no business
      // being keyed on the title, pause or end card. e.repeat matters as much as
      // the guard. A T held across the end card is blocked on its first keydown,
      // but the browser keeps sending auto repeats, and the first one after the
      // next lift starts would key the mic about thirty milliseconds in, on top
      // of ground's first word. A held key is one press, not many.
      if (playing && !e.repeat) ctx.state.intent.ptt = true;
      return;
    }
    if (code === 'KeyC') {
      // A latching toggle like the brake, and phase guarded for the same reason.
      const first = edge(code);
      if (first && playing) ctx.state.intent.hookCam = !ctx.state.intent.hookCam;
      return;
    }
    // The head. V keeps the eyes on the load, Z puts them back down the jib.
    // Both latch like the brake so a held key is one press, and both are phase
    // guarded so neither fires from a card.
    if (code === 'KeyV') {
      if (edge(code) && playing) ctx.state.intent.lookAtLoad = true;
      return;
    }
    if (code === 'KeyZ') {
      if (edge(code) && playing) ctx.state.intent.lookAhead = true;
      return;
    }

    pressed.add(code);
  });

  window.addEventListener('keyup', (e) => {
    const code = e.code;
    latched.delete(code);
    if (code === 'KeyV' || code === 'KeyZ' || code === 'Space' ||
        code === 'KeyB' || code === 'KeyC') return;
    if (code === 'KeyT') { ctx.state.intent.ptt = false; return; }
    pressed.delete(code);
  });

  // Lose key state on blur so a key doesn't get stuck "held" after alt-tab.
  const forgetKeys = () => {
    pressed.clear();
    latched.clear();
    ctx.state.intent.ptt = false;
    // The pointerup that would have ended a look-drag goes to whatever took the
    // focus, so alt-tabbing with the button down left the view dragging.
    dragging = false;
  };
  // Blur covers alt-tab and clicking another window. visibilitychange covers the
  // cases blur does not always reach: switching tabs, and the OS screenshot and
  // search overlays, which is how a key gets held across a focus change without
  // the operator ever meaning to hold it.
  window.addEventListener('blur', forgetKeys);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') forgetKeys();
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

  // Standard (non-inverted) mouselook on BOTH axes. Pitch was already right and
  // yaw was not: dragging right, or holding the right arrow, turned the head
  // left, so the two axes contradicted each other and the arrow keys added
  // yesterday made it undeniable. One negation fixes drag and keys together,
  // since both feed this accumulator, and it puts the head the same way round as
  // the V key's own tracking, which was already correct and used to fight it.
  // Standard (non-inverted) mouselook: dragging down should pitch the
  // camera down, so screen-down (positive movementY) must decrease pitch.
  // The arrow keys are the same head movement as a drag, in fixed steps, for
  // anyone without a mouse to drag with and for fine adjustment with one.
  // Feeding them through the same accumulator means one sensitivity and one
  // clamp serve both, and holding an arrow while dragging simply adds.
  if (pressed.has('ArrowLeft')) lookAccumDx -= LOOK_KEY_STEP;
  if (pressed.has('ArrowRight')) lookAccumDx += LOOK_KEY_STEP;
  if (pressed.has('ArrowUp')) lookAccumDy -= LOOK_KEY_STEP;
  if (pressed.has('ArrowDown')) lookAccumDy += LOOK_KEY_STEP;

  intent.look.dx = -lookAccumDx * LOOK_SENS;
  intent.look.dy = -lookAccumDy * LOOK_SENS;
  lookAccumDx = 0;
  lookAccumDy = 0;
}

// Clear one-shot intents after every tick.
export function endTick(ctx) {
  ctx.state.intent.reply = null;
  ctx.state.intent.look.dx = 0;
  ctx.state.intent.look.dy = 0;
  ctx.state.intent.lookAhead = false;
  ctx.state.intent.lookAtLoad = false;
}
