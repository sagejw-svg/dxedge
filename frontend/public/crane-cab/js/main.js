// Boot, fixed-step loop, system wiring. Nothing else lives here.
// Tick order is a contract: input, crane, pendulum, sensors, missions, radio, scoring.
// Render and audio run after the tick and never write state.

import { createState } from './state.js';
import { createBus } from './events.js';
import * as input from './input.js';
import * as crane from './crane.js';
import * as pendulum from './pendulum.js';
import * as sensors from './sensors.js';
import * as missions from './missions.js';
import * as radio from './radio.js';
import * as scoring from './scoring.js';
import * as save from './save.js';
import * as audio from './audio.js';
import * as render from './render.js';
import * as ui from './ui.js';

const state = createState();
const bus = createBus(state);
const ctx = { state, bus };

save.load(ctx);
input.init(ctx);
crane.init(ctx);
pendulum.init(ctx);
sensors.init(ctx);
missions.init(ctx);
radio.init(ctx);
scoring.init(ctx);
audio.init(ctx);
render.init(ctx, document.getElementById('glass'));
ui.init(ctx);

function setPhase(next) {
  if (state.phase === next) return;
  state.phase = next;
  bus.emit('phase.change', next);
}

document.getElementById('btn-start').addEventListener('click', () => {
  audio.unlock(ctx);          // first tap unlocks Web Audio
  document.getElementById('title').hidden = true;
  setPhase('playing');
  missions.start(ctx, 0);     // Phase 3 gives this a real script
});

document.getElementById('btn-resume').addEventListener('click', () => {
  document.getElementById('pause').hidden = true;
  setPhase('playing');
});

// Help card: recall the controls list without restarting. Only the sim
// (not any other state) is paused while it's open, and only resumed on
// close if opening help was what paused it (so it behaves if it's ever
// reachable while already paused for another reason).
function openHelp() {
  const help = document.getElementById('help');
  if (state.phase === 'playing') {
    help.dataset.resume = '1';
    setPhase('paused');
  }
  help.hidden = false;
}
function closeHelp() {
  const help = document.getElementById('help');
  help.hidden = true;
  if (help.dataset.resume === '1') {
    delete help.dataset.resume;
    setPhase('playing');
  }
}
document.getElementById('btn-help').addEventListener('click', openHelp);
document.getElementById('btn-help-close').addEventListener('click', closeHelp);

window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const help = document.getElementById('help');
  if (!help.hidden) {
    closeHelp();
  } else if (state.phase === 'playing') {
    document.getElementById('pause').hidden = false;
    setPhase('paused');
  } else if (state.phase === 'paused') {
    document.getElementById('pause').hidden = true;
    setPhase('playing');
  }
});

function tick(dt) {
  state.time.t += dt;
  state.time.frame += 1;
  input.update(ctx, dt);
  crane.update(ctx, dt);
  pendulum.update(ctx, dt);
  sensors.update(ctx, dt);
  missions.update(ctx, dt);
  radio.update(ctx, dt);
  scoring.update(ctx, dt);
  input.endTick(ctx);         // clear one-shot intents (reply, look deltas)
}

// Fixed step with accumulator. Cap catch-up so a background tab does not explode.
const STEP = state.time.dt;
let last = performance.now();
let acc = 0;
let fpsAcc = 0, fpsCount = 0;

function frame(now) {
  let elapsed = (now - last) / 1000;
  last = now;
  if (elapsed > 0.25) elapsed = 0.25;

  fpsAcc += elapsed; fpsCount += 1;
  if (fpsAcc >= 0.5) { state.time.fps = Math.round(fpsCount / fpsAcc); fpsAcc = 0; fpsCount = 0; }

  if (state.phase === 'playing') {
    acc += elapsed;
    while (acc >= STEP) { tick(STEP); acc -= STEP; }
  }

  render.update(ctx, elapsed);
  audio.update(ctx, elapsed);
  ui.update(ctx, elapsed);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
