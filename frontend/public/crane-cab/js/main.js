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

// Test harness hook. Only present when the page is opened with ?debug, so headless
// verification (mine and the nightly's) can read and poke state without a throwaway
// harness page. Never exposed on a normal load.
if (new URLSearchParams(location.search).has('debug')) window.__cab = ctx;

// Stale cache self-heal.
//
// A browser that visited while nginx was still marking this folder
// `max-age=31536000, immutable` holds entries that stay fresh until 2027, and
// nothing about a later deploy makes it ask again. That produced a genuinely
// confusing failure: a current index.html, with every later feature in its
// markup, running the Phase 0 modules underneath it, because only the navigation
// was being revalidated and the module URLs were not. The operator sees a game
// that is several builds old and the server logs show a healthy deploy. It cost
// two rounds of "it still looks like the old version" to find, and curl could
// never have found it, because curl has no HTTP cache.
//
// So the page checks itself. data/build.js is under a kilobyte; fetching it once
// the normal way and once bypassing the HTTP cache says whether what this page
// loaded is what the server is serving. If they disagree, every module URL is
// re-fetched with the cache bypassed, which rewrites the poisoned entries, and
// the page reloads into them.
//
// sessionStorage guards it to one reload per tab, so a server genuinely serving
// something inconsistent gets one retry and then is left alone rather than
// spinning. The service worker was fixed to bypass the HTTP cache too, and
// between them a client repairs itself on the next visit either way; this half
// is what covers a client whose service worker is not running at all.
const HEAL_KEY = 'craneCab_healedOnce';
async function healStaleCache() {
  try {
    if (sessionStorage.getItem(HEAL_KEY)) return;
    const url = new URL('../data/build.js', import.meta.url).href;
    const [mine, live] = await Promise.all([
      fetch(url).then((r) => r.text()),
      fetch(url, { cache: 'reload' }).then((r) => r.text())
    ]);
    if (mine === live) return;
    sessionStorage.setItem(HEAL_KEY, '1');
    const base = new URL('.', import.meta.url).href;
    const files = [
      '../index.html', '../css/game.css',
      'main.js', 'state.js', 'events.js', 'input.js', 'crane.js', 'pendulum.js',
      'sensors.js', 'missions.js', 'radio.js', 'scoring.js', 'save.js', 'audio.js',
      'render.js', 'ui.js',
      '../data/missions.js', '../data/crane.js', '../data/radio.js', '../data/build.js'
    ];
    await Promise.all(files.map((f) =>
      fetch(new URL(f, base).href, { cache: 'reload' }).catch(() => null)));
    location.reload();
  } catch { /* a self-heal that throws is worse than one that does not run */ }
}
healStaleCache();

save.load(ctx);
save.init(ctx);
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
  // Resume where they got to. save.js restored that before any of this ran.
  missions.start(ctx, missions.firstUnfinished(ctx));
});

// PHASE 3 item 6, the only change this phase makes in this file. A finished lift
// parks the sim in 'afteraction' and puts the end-of-lift card up; the card's one
// button starts the next lift (missions.js decides which) and hands control back.
const endcard = document.getElementById('endcard');
function showEndcard() {
  // main.js is the wiring layer, so it is the one place allowed to take the
  // object scoring.js built and hand it to ui.js. Neither imports the other.
  ui.showAfterAction(ctx, scoring.afterAction(ctx));
  setPhase('afteraction');
  endcard.hidden = false;
}
bus.on('lift.win', showEndcard);
bus.on('lift.fail', showEndcard);

document.getElementById('btn-endcard').addEventListener('click', () => {
  endcard.hidden = true;
  missions.start(ctx, missions.nextMissionId(ctx));
  setPhase('playing');
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
