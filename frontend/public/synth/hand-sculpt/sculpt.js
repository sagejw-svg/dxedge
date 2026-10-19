// Sculpt: reach into a field of glowing orbs. Pinch to grab, move in three
// axes, twist for timbre, spread for grains, open both hands for reverb.

import {
  ORBS, freshOrbs, defaultCal, calibrateFromHand, poseFromHand, stepGrab,
  twoHandWidth, synthesizeHand, mapSound, noteName, createHandSmoother,
  pinchAmount, fingerSpread, wristRoll, handSpan, handToScene, createOneEuro,
} from './hands.js';
import { bootVoices, createSculptAudio, renderSculpt } from './audio.js';
import { createScene } from './scene.js';

const SIZES = ['s', 'm', 'l', 'xl'];
const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const canvas = document.getElementById('view');
const stage = document.getElementById('stage');
const gate = document.getElementById('gate');
const calPanel = document.getElementById('cal');
const statusEl = document.getElementById('status');
const video = document.getElementById('cam');
const labelsEl = document.getElementById('labels');
const readout = document.getElementById('readout');
const levelEl = document.getElementById('level');
const depthIn = document.getElementById('depth');
const twistIn = document.getElementById('twist');
const spreadIn = document.getElementById('spread');
const roomIn = document.getElementById('room');
const sizeButtons = [...document.querySelectorAll('[data-size]')];

const scene = createScene(canvas);
let orbs = freshOrbs();
let grab = { held: null, hand: null };
let cal = loadCal() || defaultCal();
let calibrated = !!loadCal();
let mode = 'gate';
let audio = null;
let analyser = null;
let tracker = null;
let stream = null;
let reverb = 0.22;
let reverbFromHands = false;
const smoother = createHandSmoother();
const mouse = { x: 0.5, y: 0.55, z: 0, roll: 0, spread: 0.25, pinch: 0, second: null };
const pointers = new Map();
let particles = [];
let lastHands = [];
let running = true;
const grainAt = new Map();

function status(text) {
  statusEl.textContent = text;
}

function loadCal() {
  try {
    const j = JSON.parse(localStorage.getItem('sculpt-cal') || 'null');
    if (j && typeof j.originX === 'number' && typeof j.span === 'number' && j.span > 0.02) return j;
  } catch (e) { /* private mode */ }
  return null;
}

function saveCal(next) {
  cal = next;
  calibrated = true;
  try { localStorage.setItem('sculpt-cal', JSON.stringify(next)); } catch (e) { /* ignore */ }
}

function setSize(size) {
  const s = SIZES.includes(size) ? size : 'm';
  document.documentElement.dataset.size = s;
  try { localStorage.setItem('sculpt-size', s); } catch (e) { /* ignore */ }
  for (const b of sizeButtons) b.setAttribute('aria-pressed', b.dataset.size === s ? 'true' : 'false');
}

function b64(f32) {
  const u8 = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

function level() {
  if (!analyser) return 0;
  const a = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(a);
  let p = 0;
  for (let i = 0; i < a.length; i++) p = Math.max(p, Math.abs(a[i]));
  return p;
}

async function ensureAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) throw new Error('This browser has no Web Audio.');
  if (!audio) {
    const ctx = new AC({ latencyHint: 'interactive' });
    audio = bootVoices(createSculptAudio(ctx, { bed: true }));
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    audio.master.connect(analyser);
  }
  if (audio.ctx.state !== 'running') await audio.ctx.resume();
}

function showGate() {
  gate.hidden = false;
  calPanel.hidden = true;
}

function hideGate() {
  gate.hidden = true;
}

function showCal(on) {
  calPanel.hidden = !on;
}

function sliderActive(el) {
  return el && document.activeElement === el;
}

function pushSliders() {
  if (!sliderActive(depthIn)) depthIn.value = String(mouse.z);
  if (!sliderActive(twistIn)) twistIn.value = String(mouse.roll / (Math.PI / 2));
  if (!sliderActive(spreadIn)) spreadIn.value = String(mouse.spread);
  if (!sliderActive(roomIn)) roomIn.value = String(reverb);
}

function readSliders() {
  if (sliderActive(depthIn)) mouse.z = Number(depthIn.value);
  if (sliderActive(twistIn)) mouse.roll = Number(twistIn.value) * (Math.PI / 2);
  if (sliderActive(spreadIn)) mouse.spread = Number(spreadIn.value);
  if (sliderActive(roomIn)) {
    reverb = Number(roomIn.value);
    reverbFromHands = false;
  }
}

function consume(landmarkSets, mirror) {
  const poses = landmarkSets.map(lm => poseFromHand(lm, cal, mirror));
  const stepped = stepGrab(grab, poses.map(p => ({
    pinch: p.pinch, point: p.point, roll: p.roll, spread: p.spread,
  })), orbs);
  grab = { held: stepped.held, hand: stepped.hand };
  orbs = stepped.orbs;
  for (const o of orbs) if (!o.grabbed) o.spread *= 0.86;
  const open = poses.filter(p => p.pinch < 0.4);
  if (open.length >= 2) {
    const w = twoHandWidth(open[0], open[1]);
    if (w != null) {
      reverb = w;
      reverbFromHands = true;
    }
  }
  lastHands = poses.map(p => p.points);
  return poses;
}

function decayIdle() {
  lastHands = [];
  for (const o of orbs) {
    o.grabbed = false;
    o.spread *= 0.9;
  }
  grab = { held: null, hand: null };
}

function pumpGrains() {
  if (!audio) return;
  const now = audio.ctx.currentTime;
  const ahead = now + 0.12;
  for (const v of audio.voices) {
    if (!v.grabbed || v.spread < 0.12) {
      grainAt.delete(v.def.id);
      continue;
    }
    let t = grainAt.get(v.def.id) || now;
    if (t < now) t = now;
    const rate = 8 + v.spread * 46;
    const step = 1 / rate;
    const hz = v.sound ? v.sound.hz : 220;
    while (t < ahead) {
      audio.scheduleGrain(v, t, hz, v.spread, Math.random);
      t += step;
    }
    grainAt.set(v.def.id, t);
  }
}

function syncAudio() {
  if (!audio) return;
  const now = audio.ctx.currentTime;
  for (const o of orbs) audio.setVoice(audio.byId[o.id], o, now);
  audio.setReverb(reverb, now);
  pumpGrains();
}

function spawnParticles() {
  if (reduceMotion) return;
  const held = orbs.find(o => o.grabbed);
  if (!held || held.spread < 0.35) return;
  if (Math.random() > held.spread * 0.7) return;
  particles.push({
    x: held.x, y: held.y, z: held.z,
    vx: (Math.random() - 0.5) * 1.6 * held.spread,
    vy: (Math.random() - 0.5) * 1.6 * held.spread,
    vz: (Math.random() - 0.5) * 1.6 * held.spread,
    life: 1,
  });
  if (particles.length > 180) particles = particles.slice(-180);
}

function placeLabels(list) {
  const need = list.length;
  while (labelsEl.children.length < need) {
    const d = document.createElement('div');
    d.className = 'olabel';
    labelsEl.appendChild(d);
  }
  for (let i = 0; i < labelsEl.children.length; i++) {
    const el = labelsEl.children[i];
    const item = list[i];
    if (!item) { el.hidden = true; continue; }
    el.hidden = false;
    el.textContent = item.name;
    el.style.transform = `translate(${item.x}px, ${item.y}px) translate(-50%, -120%)`;
    el.classList.toggle('hot', !!item.grabbed);
  }
}

function updateReadout() {
  const held = orbs.find(o => o.grabbed);
  const o = held || orbs[0];
  const s = mapSound(o, o);
  const pan = s.pan < -0.2 ? 'left' : s.pan > 0.2 ? 'right' : 'center';
  readout.textContent = `${o.name}  ${noteName(s.midi)}   pan ${pan}   ${Math.round(s.cutoff)} Hz   ${s.timbre > 0.55 ? 'bright' : 'soft'}   grains ${Math.round(s.spread * 100)}   room ${Math.round(reverb * 100)}`;
  if (levelEl) levelEl.style.transform = `scaleX(${Math.min(1, level() * 2.4)})`;
}

let lastStatus = 0;
let lastTs = 0;
function cameraHands(t) {
  if (!camMod || !tracker) return [];
  const ts = Math.max(lastTs + 1, Math.round(t));
  lastTs = ts;
  try { return camMod.readHands(tracker, video, ts); } catch (err) { return []; }
}
function tick(t) {
  if (!running) return;
  const now = t * 0.001;
  readSliders();
  if (mode === 'camera' && tracker && video && video.readyState >= 2) {
    const seen = cameraHands(t);
    const raw = seen.length ? smoother(seen, now) : [];
    if (raw.length) {
      const poses = consume(raw, true);
      const lead = poses[grab.hand] || poses[0];
      if (lead && !sliderActive(depthIn)) mouse.z = lead.z;
      if (lead && !sliderActive(twistIn)) mouse.roll = lead.roll * (Math.PI / 2);
      if (lead && !sliderActive(spreadIn)) mouse.spread = lead.spread;
      if (!calibrated) {
        const i = poses.findIndex(p => p.pinch > 0.62);
        if (i >= 0) {
          saveCal(calibrateFromHand(raw[i], true));
          showCal(false);
          status('Calibrated. Pinch an orb and move it.');
        }
      }
    } else {
      decayIdle();
    }
  } else if (mode === 'mouse') {
    const hands = [synthesizeHand(mouse)];
    if (mouse.second) {
      hands.push(synthesizeHand({
        x: mouse.second.x, y: mouse.second.y, z: 0, roll: 0, spread: 0.85, pinch: 0,
      }));
    }
    consume(hands, false);
  } else {
    decayIdle();
  }
  spawnParticles();
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * 0.016;
    p.y += p.vy * 0.016;
    p.z += p.vz * 0.016;
    p.life -= 0.02;
    if (p.life <= 0) particles.splice(i, 1);
  }
  syncAudio();
  pushSliders();
  if (scene.ok) {
    const labels = scene.frame({
      orbs, hands: lastHands, particles, time: reduceMotion ? 0 : now,
    }) || [];
    placeLabels(labels);
  }
  updateReadout();
  if (now - lastStatus > 0.6 && mode !== 'gate') {
    lastStatus = now;
    const held = orbs.find(o => o.grabbed);
    if (held) status(`${held.name} in hand. X pan, Y pitch, depth filter.`);
  }
  requestAnimationFrame(tick);
}

let camMod = null;
async function enterCamera() {
  status('Asking for the camera. The picture stays in this browser. It is not uploaded.');
  try {
    await ensureAudio();
    camMod = await import('./camera.js');
    window.__sculptTracker = camMod;
    stream = await camMod.openCamera(video);
    status('Loading the hand tracker on this device.');
    tracker = await camMod.loadTracker();
    mode = 'camera';
    hideGate();
    video.hidden = false;
    if (!calibrated) {
      showCal(true);
      status('Hold your open hand in the ring, then pinch. That sets your reach.');
    } else {
      showCal(false);
      status('Camera on. The picture stays in this browser. Pinch an orb.');
    }
  } catch (err) {
    mode = 'gate';
    showGate();
    video.hidden = true;
    const why = err && err.message ? err.message : 'permission denied';
    status(`Camera unavailable (${why}). The picture would have stayed in this browser. Play with the mouse instead.`);
  }
}

async function enterMouse() {
  mode = 'mouse';
  mouse.pinch = 0;
  hideGate();
  showCal(false);
  video.hidden = true;
  try { await ensureAudio(); } catch (err) { status(err.message || 'Audio unavailable'); return; }
  status('Mouse. Drag an orb, wheel for depth, right-click plants the other hand.');
}

function normEvent(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (e.clientX - r.left) / Math.max(1, r.width))),
    y: Math.min(1, Math.max(0, (e.clientY - r.top) / Math.max(1, r.height))),
  };
}

function updatePointers(e) {
  if (mode === 'camera') return;
  if (mode === 'gate') return;
  const pts = [...pointers.values()];
  if (!pts.length) {
    mouse.pinch = 0;
    mouse.second = null;
    return;
  }
  if (e && e.altKey) {
    mouse.roll = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, mouse.roll + (e.movementX || 0) * 0.01));
  }
  if (pts.length >= 2) {
    mouse.x = pts[0].x;
    mouse.y = pts[0].y;
    mouse.pinch = 0;
    mouse.second = { x: pts[1].x, y: pts[1].y };
    mouse.spread = Math.min(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) * 1.4);
    return;
  }
  mouse.second = null;
  mouse.x = pts[0].x;
  mouse.y = pts[0].y;
  mouse.pinch = 1;
  if (e && e.shiftKey && pts[0].down) {
    mouse.spread = Math.min(1, Math.hypot(pts[0].x - pts[0].down.x, pts[0].y - pts[0].down.y) * 3);
  }
}

canvas.addEventListener('pointerdown', (e) => {
  if (mode !== 'mouse') return;
  if (e.button === 2) {
    e.preventDefault();
    const p = normEvent(e);
    mouse.second = mouse.second ? null : { x: p.x, y: p.y };
    return;
  }
  if (e.button !== 0) return;
  canvas.setPointerCapture(e.pointerId);
  const p = normEvent(e);
  pointers.set(e.pointerId, { x: p.x, y: p.y, down: { x: p.x, y: p.y } });
  updatePointers(e);
});
canvas.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  const p = normEvent(e);
  const prev = pointers.get(e.pointerId);
  pointers.set(e.pointerId, { x: p.x, y: p.y, down: prev.down });
  updatePointers(e);
});
function forgetPointer(e) {
  pointers.delete(e.pointerId);
  updatePointers(e);
}
canvas.addEventListener('pointerup', forgetPointer);
canvas.addEventListener('pointercancel', forgetPointer);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('wheel', (e) => {
  if (mode !== 'mouse') return;
  e.preventDefault();
  mouse.z = Math.max(-1, Math.min(1, mouse.z + (e.deltaY < 0 ? 0.08 : -0.08)));
}, { passive: false });

window.addEventListener('keydown', (e) => {
  if (e.target && e.target.matches && e.target.matches('input, textarea, select')) return;
  if (e.key === '[' || e.key === ']') {
    mouse.spread = Math.max(0, Math.min(1, mouse.spread + (e.key === ']' ? 0.08 : -0.08)));
  } else if (e.key === 'q' || e.key === 'Q') {
    mouse.roll = Math.max(-Math.PI / 2, mouse.roll - 0.08);
  } else if (e.key === 'e' || e.key === 'E') {
    mouse.roll = Math.min(Math.PI / 2, mouse.roll + 0.08);
  } else if (e.key === 'Escape') {
    mouse.pinch = 0;
    pointers.clear();
    mouse.second = null;
  } else if (mode === 'mouse' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    e.preventDefault();
    if (e.key === 'ArrowLeft') mouse.x = Math.max(0, mouse.x - 0.03);
    if (e.key === 'ArrowRight') mouse.x = Math.min(1, mouse.x + 0.03);
    if (e.key === 'ArrowUp') mouse.y = Math.max(0, mouse.y - 0.03);
    if (e.key === 'ArrowDown') mouse.y = Math.min(1, mouse.y + 0.03);
    mouse.pinch = e.shiftKey ? mouse.pinch : 1;
  }
});

document.getElementById('camBtn').addEventListener('click', () => { enterCamera(); });
document.getElementById('mouseBtn').addEventListener('click', () => { enterMouse(); });
document.getElementById('calSkip').addEventListener('click', () => {
  calibrated = true;
  showCal(false);
  status('Using a default reach. Pinch an orb.');
});
document.getElementById('recal').addEventListener('click', () => {
  if (mode !== 'camera') return;
  calibrated = false;
  showCal(true);
  status('Hold your open hand in the ring, then pinch.');
});
for (const b of sizeButtons) b.addEventListener('click', () => setSize(b.dataset.size));

depthIn.addEventListener('input', () => { mouse.z = Number(depthIn.value); });
twistIn.addEventListener('input', () => { mouse.roll = Number(twistIn.value) * (Math.PI / 2); });
spreadIn.addEventListener('input', () => { mouse.spread = Number(spreadIn.value); });
roomIn.addEventListener('input', () => { reverb = Number(roomIn.value); reverbFromHands = false; });

setSize(document.documentElement.dataset.size || 'm');
if (!scene.ok) status('This browser could not start WebGL, so the hand view is unavailable.');
else status('Allow the camera, or play with the mouse. Video is not uploaded.');

window.__sculpt = {
  ready: () => !!(scene.ok && canvas),
  mode: () => mode,
  size: () => document.documentElement.dataset.size || 'm',
  setSize,
  useMouse: () => enterMouse(),
  useCamera: () => enterCamera(),
  setControl: (partial) => { Object.assign(mouse, partial || {}); },
  gl: () => !!scene.ok,
  snapshot: () => ({
    mode,
    gl: !!scene.ok,
    size: document.documentElement.dataset.size || 'm',
    grabbed: grab.held,
    reverb,
    calibrated,
    orbs: orbs.map(o => ({
      id: o.id, x: o.x, y: o.y, z: o.z, spread: o.spread, roll: o.roll, grabbed: o.grabbed,
      sound: mapSound(o, o),
    })),
    level: level(),
    hands: lastHands.length,
  }),
  api: {
    ORBS, synthesizeHand, pinchAmount, fingerSpread, wristRoll, handSpan,
    defaultCal, calibrateFromHand, poseFromHand, handToScene, stepGrab,
    twoHandWidth, mapSound, noteName, createOneEuro, freshOrbs,
  },
  render: async (opts) => {
    const buf = await renderSculpt(opts || {});
    return {
      sr: buf.sampleRate,
      L: b64(buf.getChannelData(0)),
      R: b64(buf.getChannelData(1)),
    };
  },
  loadTracker: async () => {
    const mod = await import('./camera.js');
    const landmarker = await mod.loadTracker();
    return !!landmarker;
  },
};

requestAnimationFrame(tick);
