// Hand Orchestra. Camera frames stay in this browser. MediaPipe runs here.
// Nothing from the camera is uploaded.

import {
  AXES, DEFAULT_CC, DEFAULT_CAL, FINGERS, NOTE_NAMES, RACK_TARGETS, VOICE,
  analyzeHand, ccBytes, createSession, degreeFromFingers, knobPlan, landmarksFromPose,
  midiPlan, placeFingerLabels, setPath, spanCal,
} from './theory.js';
import { createOrchestra } from './audio.js';
import { mountUiSize, bindFineControls } from '../desk.js';

const SETTINGS_KEY = 'dxedge_hand_orchestra';
const VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const $ = id => document.getElementById(id);

const ui = {
  play: { thumb: false, index: false, middle: false, ring: false, pinky: false },
  chord: { thumb: false, index: false, middle: false, ring: false, pinky: false },
  height: 0.55,
  pinch: 0.15,
  depth: 0.5,
  tilt: 0.5,
};

let mode = 'orchestra';
let keyRoot = 0;
let channel = 1;
let ccMap = Object.assign({}, DEFAULT_CC);
let targetId = 'filament';
let knobAssign = Object.assign({}, RACK_TARGETS[0].map);
let monitor = true;
let swapHands = false;
let driveRack = false;
let midiOn = false;
let cal = {
  height: Object.assign({}, DEFAULT_CAL.height),
  depth: Object.assign({}, DEFAULT_CAL.depth),
};
let smooth = 0.35;
let margin = 0.08;
let cameraOff = false;
const session = createSession({ key: 0, smooth, cal, chordFrames: 4 });

let audioCtx = null;
let orchestra = null;
let prevNotes = [];
let lastPlan = { notes: [], cc: [] };
let lastKnobs = [];
let camState = 'off';
let stream = null;
let landmarker = null;
let detecting = false;
let lastVideoTime = -1;
let raf = 0;
let midiAccess = null;
let midiOut = null;
let rackFrame = null;
let rackReady = false;
let rackTimer = 0;
let pendingRack = null;
let sentCc = {};
let storageSnap = null;
let lastRaw = null;
let camGen = 0;
let lastLabels = [];

function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return;
    if (Number.isFinite(raw.key)) keyRoot = Math.max(0, Math.min(11, raw.key | 0));
    if (Number.isFinite(raw.channel)) channel = Math.max(1, Math.min(16, raw.channel | 0));
    if (raw.cc) AXES.forEach(a => { if (Number.isFinite(raw.cc[a])) ccMap[a] = raw.cc[a] & 127; });
    if (typeof raw.target === 'string') targetId = raw.target;
    if (raw.knobs) knobAssign = Object.assign(knobAssign, raw.knobs);
    if (typeof raw.monitor === 'boolean') monitor = raw.monitor;
    if (typeof raw.swap === 'boolean') swapHands = raw.swap;
    if (raw.cal && raw.cal.height) cal.height = spanCal(raw.cal.height.low, raw.cal.height.high, 0.05);
    if (raw.cal && raw.cal.depth) cal.depth = spanCal(raw.cal.depth.low, raw.cal.depth.high, 0.03);
    if (Number.isFinite(raw.smooth)) smooth = Math.max(0.05, Math.min(1, raw.smooth));
    if (Number.isFinite(raw.margin)) margin = Math.max(0.02, Math.min(0.35, raw.margin));
    if (raw.mode === 'controller' || raw.mode === 'orchestra') mode = raw.mode;
    if (typeof raw.cameraOff === 'boolean') cameraOff = raw.cameraOff;
  } catch (e) { /* keep defaults */ }
  session.setKey(keyRoot);
  session.setAlpha(smooth);
  session.setMargin(margin);
  session.setCal(cal);
}

function saveSettings() {
  const data = {
    key: keyRoot, channel, cc: ccMap, target: targetId, knobs: knobAssign,
    monitor, swap: swapHands, cal, smooth, margin, mode, cameraOff,
  };
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(data)); } catch (e) { /* private mode */ }
}

function ensureAudio() {
  if (audioCtx) {
    if (audioCtx.state !== 'running') audioCtx.resume().catch(() => {});
    return audioCtx;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  audioCtx = new AC({ latencyHint: 'interactive' });
  orchestra = createOrchestra(audioCtx);
  orchestra.output.connect(audioCtx.destination);
  orchestra.setLevel(monitor || mode === 'orchestra' ? levelValue() : 0);
  return audioCtx;
}

function levelValue() {
  const el = $('level');
  return el ? Number(el.value) : 0.8;
}

function mouseFrame(direct) {
  return {
    direct: !!direct,
    immediate: !!direct,
    play: {
      extended: Object.assign({}, ui.play),
      height: ui.height,
      pinch: ui.pinch,
      depth: ui.depth,
      tilt: ui.tilt,
    },
    chord: { extended: Object.assign({}, ui.chord) },
  };
}

function applyState(state, fromCamera) {
  if (!state) return;
  const sounding = (mode === 'orchestra' || monitor) && orchestra;
  if (sounding) {
    const want = {};
    state.voices.forEach(v => { want[v.finger] = v.note; });
    FINGERS.forEach(id => {
      const have = orchestra.sounding()[id];
      if (want[id] == null) orchestra.noteOff(id);
      else if (have !== want[id]) orchestra.noteOn(id, want[id], 0.85);
    });
  } else if (orchestra) {
    orchestra.panic();
  }
  if (mode === 'controller' && midiOn) sendMidi(state);
  if (mode === 'controller' && driveRack) scheduleRack(state);
  paint(state, fromCamera);
  prevNotes = state.notes.slice();
}

function sendMidi(state) {
  const plan = midiPlan(channel, ccMap, state, prevNotes);
  lastPlan = plan;
  if (!midiOut) return;
  const now = performance.now();
  plan.notes.forEach(bytes => midiOut.send(bytes, now));
  plan.cc.forEach(row => {
    const key = row.cc + ':' + row.bytes[2];
    if (sentCc[row.axis] === key) return;
    sentCc[row.axis] = key;
    midiOut.send(row.bytes, now);
  });
}

function isRackKey(k) {
  return /^(filament_|cathode_|dekatron_|lattice_|thyratron_|gleam_|mote_|heptode_|geissler_|pentagrid_|orthicon_|trochotron_|gyrotron_|klystron_|phantastron_|additron_|rhumbatron_|resnatron_|synth_)/.test(k);
}

function snapRackStorage(win) {
  const ls = win.localStorage;
  const snap = new Map();
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i);
    if (k && isRackKey(k)) snap.set(k, ls.getItem(k));
  }
  return snap;
}

function restoreRackStorage(win, snap) {
  if (!snap) return;
  const ls = win.localStorage;
  const now = [];
  for (let i = 0; i < ls.length; i++) now.push(ls.key(i));
  now.forEach(k => { if (k && isRackKey(k) && !snap.has(k)) ls.removeItem(k); });
  snap.forEach((v, k) => { if (ls.getItem(k) !== v) ls.setItem(k, v); });
}

function rackWindow() {
  if (!rackFrame) return null;
  try { return rackFrame.contentWindow; } catch (e) { return null; }
}

function ensureRack() {
  if (rackFrame) return;
  rackFrame = document.createElement('iframe');
  rackFrame.id = 'rackFrame';
  rackFrame.title = 'Filament rack, driven by Hand Orchestra';
  rackFrame.allow = 'autoplay; microphone; midi';
  rackFrame.src = '/synth/index.html';
  $('rackHost').appendChild(rackFrame);
  rackFrame.addEventListener('load', () => {
    const win = rackWindow();
    if (!win) return;
    const wait = () => {
      if (win.__synth && win.__synth.ready && win.__synth.ready()) {
        rackReady = true;
        setRackStatus('Rack is awake. Gestures move ' + (targetName()) + ' without changing saved patches.');
        return;
      }
      setTimeout(wait, 150);
    };
    wait();
  });
}

function targetName() {
  const t = RACK_TARGETS.find(x => x.id === targetId);
  return t ? t.name : targetId;
}

function setRackStatus(text) { const el = $('rackStatus'); if (el) el.textContent = text; }

function scheduleRack(state) {
  pendingRack = state;
  lastKnobs = knobPlan(targetId, state.axes, knobAssign);
  sendRackNotes(state);
  if (rackTimer) return;
  rackTimer = setTimeout(() => {
    rackTimer = 0;
    const s = pendingRack;
    pendingRack = null;
    if (s) flushKnobs(s);
  }, 90);
}

function withRack(fn) {
  const win = rackWindow();
  if (!win || !win.__synth || !win.__synth.ready || !win.__synth.ready()) return null;
  const snap = snapRackStorage(win);
  storageSnap = snap;
  let result = null;
  try { result = fn(win); }
  catch (e) {
    setRackStatus('The rack did not take that gesture (' + (e && e.message ? e.message : 'error') + ').');
  }
  const restore = () => restoreRackStorage(win, snap);
  if (win.requestAnimationFrame) win.requestAnimationFrame(() => win.requestAnimationFrame(restore));
  else setTimeout(restore, 40);
  return result;
}

function sendRackNotes(state) {
  if (!rackReady) return;
  const diff = prevHeld(state);
  if (!diff.on.length && !diff.off.length) return;
  withRack(win => {
    if (win.__synth.device() !== targetId) win.__synth.setDevice(targetId);
    diff.off.forEach(n => win.__synth.noteOff(n));
    diff.on.forEach(n => win.__synth.noteOn(n, 0.85));
  });
}

function flushKnobs(state) {
  const plan = knobPlan(targetId, state.axes, knobAssign);
  lastKnobs = plan;
  if (!plan.length || !rackReady) return;
  withRack(win => {
    if (win.__synth.device() !== targetId) win.__synth.setDevice(targetId);
    const patch = win.__synth.patch();
    if (!patch) return;
    plan.forEach(k => setPath(patch, k.id, k.value));
    const engine = win.__synth.engine && win.__synth.engine();
    if (engine && engine.setPatch && (targetId === 'filament' || targetId === 'cathode')) {
      engine.setPatch(Object.assign({}, patch, { device: targetId }), false);
    } else win.__synth.setPatch(patch);
  });
}

const rackNotes = new Set();
function prevHeld(state) {
  const next = new Set(state.notes || []);
  const on = [...next].filter(n => !rackNotes.has(n));
  const off = [...rackNotes].filter(n => !next.has(n));
  on.forEach(n => rackNotes.add(n));
  off.forEach(n => rackNotes.delete(n));
  return { on, off };
}

function releaseRack() {
  const win = rackWindow();
  if (!win || !win.__synth || !win.__synth.noteOff) { rackNotes.clear(); return; }
  const snap = storageSnap;
  [...rackNotes].forEach(n => { try { win.__synth.noteOff(n); } catch (e) { /* rack gone */ } });
  rackNotes.clear();
  if (snap && win.requestAnimationFrame) win.requestAnimationFrame(() => restoreRackStorage(win, snap));
}

function paint(state, fromCamera) {
  const read = $('readout');
  if (read && state) {
    const names = state.voices.map(v => v.label + ' ' + v.name).join(' · ');
    read.textContent = state.roman + '  ' + state.symbol + '   octave ' + state.octave
      + (names ? '   ' + names : '   (no fingers up)');
  }
  FINGERS.forEach(id => {
    const b = document.querySelector('[data-hand="play"][data-finger="' + id + '"]');
    if (b && fromCamera) b.setAttribute('aria-pressed', String(!!state.play[id]));
    const c = document.querySelector('[data-hand="chord"][data-finger="' + id + '"]');
    if (c && fromCamera) c.setAttribute('aria-pressed', String(!!state.chordFingers[id]));
    const m = document.querySelector('[data-meter="' + id + '"]');
    if (m) {
      const on = state.voices.some(v => v.finger === id);
      const lv = on ? 0.85 : 0;
      m.dataset.level = String(lv);
      m.style.setProperty('--lv', String(lv));
      m.querySelector('b').textContent = on ? state.voices.find(v => v.finger === id).name : '—';
    }
  });
  const ax = $('axes');
  if (ax && state) {
    ax.textContent = 'pinch ' + state.axes.pinch.toFixed(2)
      + '   height ' + state.axes.height.toFixed(2)
      + '   depth ' + state.axes.depth.toFixed(2)
      + '   tilt ' + state.axes.tilt.toFixed(2);
  }
  drawOverlay(state, fromCamera);
}

function drawOverlay(state, fromCamera) {
  const canvas = $('overlay');
  const stage = $('stage');
  if (!canvas || !stage || !state) return;
  const rect = stage.getBoundingClientRect();
  const w = Math.max(2, Math.round(rect.width));
  const h = Math.max(2, Math.round(rect.height));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  lastLabels = [];
  if (!fromCamera) {
    ctx.fillStyle = '#100e0c';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3a2a1c';
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillText('Mouse hand', 12, 22);
  }
  const hands = [
    { lm: state.draw && state.draw.chord, role: 'chord', color: '#7a9fff' },
    { lm: state.draw && state.draw.play, role: 'play', color: '#ffb347' },
  ];
  hands.forEach(hand => {
    if (!hand.lm) return;
    const pt = i => {
      const p = hand.lm[i] || { x: 0.5, y: 0.5 };
      return { x: (1 - p.x) * w, y: p.y * h };
    };
    ctx.strokeStyle = hand.color;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 2;
    const chains = [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [0, 9, 10, 11, 12], [0, 13, 14, 15, 16], [0, 17, 18, 19, 20]];
    chains.forEach(ch => {
      ctx.beginPath();
      ch.forEach((i, n) => {
        const q = pt(i);
        if (n === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
      });
      ctx.stroke();
    });
    const tips = FINGERS.map(id => {
      const tip = pt(VOICE_TIP[id]);
      const on = hand.role === 'play' ? state.play[id] : state.chordFingers[id];
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, on ? 9 : 5, 0, Math.PI * 2);
      ctx.fillStyle = on ? hand.color : 'rgba(226,226,226,0.55)';
      ctx.fill();
      const voice = hand.role === 'play' ? state.voices.find(v => v.finger === id) : null;
      return { id, x: tip.x, y: tip.y, on, voice, text: voice ? voice.name : VOICE[id].label };
    });
    if (hand.role === 'play') {
      ctx.font = '12px ui-monospace, monospace';
      const placed = placeFingerLabels(tips.map(t => ({
        id: t.id, x: t.x, y: t.y, text: t.text, w: ctx.measureText(t.text).width,
      })), { width: w, height: h, font: 12, gap: 8 });
      lastLabels = placed;
      const side = placed.length ? placed[0].side : 'right';
      tips.forEach(t => {
        const lv = t.voice ? 0.9 : 0.08;
        const barX = side === 'right' ? t.x - 16 : t.x + 12;
        ctx.fillStyle = '#00ff9d';
        ctx.fillRect(barX, t.y + 14 - 32 * lv, 4, 32 * lv);
      });
      ctx.strokeStyle = 'rgba(255, 208, 138, 0.7)';
      ctx.lineWidth = 1;
      ctx.fillStyle = '#ffd08a';
      ctx.font = '12px ui-monospace, monospace';
      placed.forEach(lab => {
        const edgeX = lab.side === 'right' ? lab.x : lab.x + lab.w;
        ctx.beginPath();
        ctx.moveTo(lab.tipX, lab.tipY);
        ctx.lineTo(edgeX, lab.top + lab.h * 0.5);
        ctx.stroke();
        ctx.fillText(lab.text, lab.x, lab.y);
      });
    }
    const wrist = pt(0);
    ctx.fillStyle = hand.color;
    ctx.font = '11px ui-monospace, monospace';
    const tag = hand.role === 'chord' ? state.roman : 'play';
    const playSide = hand.role === 'play' && lastLabels.length ? lastLabels[0].side : '';
    const tagX = playSide === 'right' ? Math.max(4, wrist.x - 40) : wrist.x + 8;
    ctx.fillText(tag, tagX, wrist.y + 16);
  });
  ctx.globalAlpha = 1;
}

const VOICE_TIP = { thumb: 4, index: 8, middle: 12, ring: 16, pinky: 20 };

function pushMouse() {
  ensureAudio();
  if (camState === 'live') return;
  const state = session.push(mouseFrame(true));
  applyState(state, false);
}

function setMode(next) {
  mode = next === 'controller' ? 'controller' : 'orchestra';
  document.body.dataset.mode = mode;
  $('modeOrchestra').setAttribute('aria-pressed', String(mode === 'orchestra'));
  $('modeController').setAttribute('aria-pressed', String(mode === 'controller'));
  $('controller').hidden = mode !== 'controller';
  if (mode === 'orchestra') {
    releaseRack();
    if (orchestra) orchestra.setLevel(levelValue());
  } else if (orchestra) {
    orchestra.setLevel(monitor ? levelValue() : 0);
    if (!monitor) orchestra.panic();
  }
  sentCc = {};
  saveSettings();
  pushMouse();
}

function setCamStatus(state, detail) {
  camState = state;
  const el = $('camNote');
  const messages = {
    off: 'Camera is off. The mouse hand below plays the same voices. Video never leaves this browser.',
    asking: 'Asking for the camera. Allow it and the picture stays on this machine. Nothing is uploaded.',
    loading: 'Camera is on. Loading the hand model into this browser. Frames are not sent anywhere.',
    live: 'Camera is live in this browser. Frames are not uploaded. Raise a finger to play. Curl it to stop.',
    denied: 'Camera permission was blocked. Allow the camera for this site in the browser bar, then press Turn on camera. The mouse hand still plays.',
    gesture: 'The browser wants a click before it opens the camera. Press Turn on camera. The picture stays in this browser and is not uploaded. The mouse hand plays until then.',
    missing: 'This browser has no camera API. The mouse hand still plays.',
    error: 'The camera or the hand model did not start. The mouse hand still plays. Nothing from the camera is uploaded.',
  };
  const explain = {
    off: 'The picture stays in this browser and is not uploaded. The mouse hand plays until then.',
    denied: 'The browser blocked the camera. Allow it in the address bar, then press this button. The mouse hand plays until then.',
    gesture: 'This browser wants a click before it opens the camera. The picture stays here and is not uploaded. The mouse hand plays until then.',
    missing: 'This browser has no camera. The mouse hand still plays. Nothing is uploaded.',
    error: 'The camera did not start. Press to try again. The picture is not uploaded, and the mouse hand still plays.',
  };
  el.textContent = messages[state] || messages.error;
  if (detail && (state === 'error' || state === 'denied')) el.textContent += ' ' + detail;
  const running = state === 'live' || state === 'loading' || state === 'asking';
  $('camBtn').textContent = running ? 'Stop camera' : 'Use camera';
  $('camBtn').setAttribute('aria-pressed', String(state === 'live'));
  $('stage').dataset.cam = state;
  const prompt = $('camPrompt');
  if (prompt) prompt.hidden = running;
  const line = $('camExplain');
  if (line && explain[state]) line.textContent = explain[state];
}

function cameraPermission() {
  try {
    if (!navigator.permissions || !navigator.permissions.query) return Promise.resolve('unknown');
    return navigator.permissions.query({ name: 'camera' }).then(q => (q && q.state) || 'unknown').catch(() => 'unknown');
  } catch (e) {
    return Promise.resolve('unknown');
  }
}

function dropStream(media) {
  if (media && media.getTracks) media.getTracks().forEach(t => t.stop());
}

async function startCamera(opts) {
  const gen = ++camGen;
  const user = !!(opts && opts.user);
  if (user) {
    cameraOff = false;
    saveSettings();
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setCamStatus('missing');
    pushMouse();
    return;
  }
  setCamStatus('asking');
  ensureAudio();
  let media = null;
  try {
    media = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    });
  } catch (e) {
    if (gen !== camGen) return;
    const blocked = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
    if (!blocked) {
      setCamStatus('error', e && e.message ? e.message : '');
      pushMouse();
      return;
    }
    const perm = await cameraPermission();
    if (gen !== camGen) return;
    setCamStatus(perm === 'denied' ? 'denied' : 'gesture');
    pushMouse();
    return;
  }
  if (gen !== camGen) {
    dropStream(media);
    return;
  }
  stream = media;
  const video = $('cam');
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  try { await video.play(); } catch (e) { /* a later gesture will play it */ }
  if (gen !== camGen) return;
  setCamStatus('loading');
  try {
    landmarker = await loadLandmarker('GPU');
  } catch (e) {
    try { landmarker = await loadLandmarker('CPU'); }
    catch (e2) {
      if (gen !== camGen) return;
      stopCamera({ user: false });
      setCamStatus('error', 'The hand model could not be loaded. Check the network once, then try again. The picture itself is not uploaded.');
      return;
    }
  }
  if (gen !== camGen) {
    if (landmarker && landmarker.close) {
      try { landmarker.close(); } catch (e) { /* already stopped */ }
    }
    landmarker = null;
    return;
  }
  cameraOff = false;
  saveSettings();
  setCamStatus('live');
  track();
}

async function loadLandmarker(delegate) {
  const vision = await import(VISION);
  const files = await vision.FilesetResolver.forVisionTasks(VISION + '/wasm');
  return vision.HandLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: MODEL, delegate },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.55,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

function stopCamera(opts) {
  const user = !!(opts && opts.user);
  camGen += 1;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  dropStream(stream);
  stream = null;
  const video = $('cam');
  if (video) video.srcObject = null;
  if (landmarker && landmarker.close) {
    try { landmarker.close(); } catch (e) { /* already closed */ }
  }
  landmarker = null;
  if (user) {
    cameraOff = true;
    saveSettings();
    setCamStatus('off');
  }
  pushMouse();
}

function bootCamera() {
  if (cameraOff) {
    setCamStatus('off');
    pushMouse();
    return;
  }
  startCamera();
}

function track() {
  const video = $('cam');
  if (!landmarker || !video || video.readyState < 2) {
    if (camState === 'live') raf = requestAnimationFrame(track);
    return;
  }
  if (!detecting && video.currentTime !== lastVideoTime) {
    detecting = true;
    lastVideoTime = video.currentTime;
    let result = null;
    try { result = landmarker.detectForVideo(video, performance.now()); }
    catch (e) { result = null; }
    detecting = false;
    if (result) onHands(result);
  }
  raf = requestAnimationFrame(track);
}

function onHands(result) {
  const hands = result.landmarks || [];
  const labels = result.handednesses || result.handedness || [];
  let play = null;
  let chord = null;
  if (hands.length) {
    const playLm = hands.find((lm, i) => {
      const cat = labels[i] && (labels[i][0] || labels[i]);
      const name = cat && (cat.categoryName || cat.displayName) || '';
      return swapHands ? name === 'Left' : name === 'Right';
    }) || hands[0];
    lastRaw = analyzeHand(playLm);
  }
  hands.forEach((lm, i) => {
    let name = '';
    const cat = labels[i] && (labels[i][0] || labels[i]);
    if (cat && cat.categoryName) name = cat.categoryName;
    else if (cat && cat.displayName) name = cat.displayName;
    if (swapHands) name = name === 'Left' ? 'Right' : name === 'Right' ? 'Left' : name;
    if (!name) {
      const x = lm[0] ? lm[0].x : 0.5;
      name = x < 0.5 ? 'Right' : 'Left';
    }
    if (name === 'Left') chord = lm;
    else play = lm;
  });
  if (!play && !chord && hands[0]) play = hands[0];
  const state = session.push({
    playLandmarks: play,
    chordLandmarks: chord,
    direct: false,
    immediate: false,
  });
  applyState(state, true);
}

function fillKey() {
  const sel = $('key');
  NOTE_NAMES.forEach((name, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = name + ' major';
    if (i === keyRoot) o.selected = true;
    sel.appendChild(o);
  });
}

function fillTargets() {
  const sel = $('target');
  RACK_TARGETS.forEach(t => {
    const o = document.createElement('option');
    o.value = t.id;
    o.textContent = t.name;
    if (t.id === targetId) o.selected = true;
    sel.appendChild(o);
  });
  fillKnobs();
}

function fillKnobs() {
  const target = RACK_TARGETS.find(t => t.id === targetId) || RACK_TARGETS[0];
  AXES.forEach(axis => {
    const sel = document.querySelector('[data-knob="' + axis + '"]');
    if (!sel) return;
    const current = knobAssign[axis] || target.map[axis];
    sel.innerHTML = '';
    target.knobs.forEach(k => {
      const o = document.createElement('option');
      o.value = k.id;
      o.textContent = k.label;
      if (k.id === current) o.selected = true;
      sel.appendChild(o);
    });
    if (![...sel.options].some(o => o.selected)) sel.selectedIndex = 0;
    knobAssign[axis] = sel.value;
  });
}

function fillCc() {
  AXES.forEach(axis => {
    const input = document.querySelector('[data-cc="' + axis + '"]');
    if (input) input.value = String(ccMap[axis]);
  });
  $('channel').value = String(channel);
  $('monitor').checked = monitor;
  $('swap').checked = swapHands;
  $('drive').checked = driveRack;
  $('smooth').value = String(smooth);
  $('margin').value = String(margin);
  $('level').value = '0.8';
}

function wire() {
  mountUiSize($('uiSize'));
  bindFineControls(document);
  fillKey();
  fillTargets();
  fillCc();
  setMode(mode);

  $('modeOrchestra').addEventListener('click', () => setMode('orchestra'));
  $('modeController').addEventListener('click', () => setMode('controller'));

  document.querySelectorAll('[data-hand]').forEach(btn => {
    btn.addEventListener('click', () => {
      const hand = btn.getAttribute('data-hand');
      const finger = btn.getAttribute('data-finger');
      ui[hand][finger] = !ui[hand][finger];
      btn.setAttribute('aria-pressed', String(ui[hand][finger]));
      pushMouse();
    });
  });

  $('height').addEventListener('input', () => {
    ui.height = Number($('height').value);
    $('heightV').textContent = ui.height.toFixed(2);
    pushMouse();
  });
  $('pinch').addEventListener('input', () => { ui.pinch = Number($('pinch').value); pushMouse(); });
  $('depth').addEventListener('input', () => { ui.depth = Number($('depth').value); pushMouse(); });
  $('tilt').addEventListener('input', () => { ui.tilt = Number($('tilt').value); pushMouse(); });

  $('key').addEventListener('change', () => {
    keyRoot = Number($('key').value) | 0;
    session.setKey(keyRoot);
    saveSettings();
    pushMouse();
  });
  $('level').addEventListener('input', () => {
    if (orchestra && (mode === 'orchestra' || monitor)) orchestra.setLevel(levelValue());
    $('levelV').textContent = Math.round(levelValue() * 100) + '%';
  });
  $('smooth').addEventListener('input', () => {
    smooth = Number($('smooth').value);
    session.setAlpha(smooth);
    saveSettings();
  });
  $('margin').addEventListener('input', () => {
    margin = Number($('margin').value);
    session.setMargin(margin);
    saveSettings();
  });

  $('camBtn').addEventListener('click', () => {
    if (camState === 'live' || camState === 'loading' || camState === 'asking') stopCamera({ user: true });
    else startCamera({ user: true });
  });
  $('turnOnCamera').addEventListener('click', () => startCamera({ user: true }));

  $('markLow').addEventListener('click', () => markCal('low'));
  $('markHigh').addEventListener('click', () => markCal('high'));
  $('calReset').addEventListener('click', () => {
    cal = { height: Object.assign({}, DEFAULT_CAL.height), depth: Object.assign({}, DEFAULT_CAL.depth) };
    session.setCal(cal);
    saveSettings();
    toast('Calibration reset.');
  });

  $('panic').addEventListener('click', panic);
  $('swap').addEventListener('change', () => { swapHands = $('swap').checked; saveSettings(); });
  $('monitor').addEventListener('change', () => {
    monitor = $('monitor').checked;
    if (orchestra) {
      orchestra.setLevel(monitor ? levelValue() : 0);
      if (!monitor) orchestra.panic();
    }
    saveSettings();
    pushMouse();
  });
  $('drive').addEventListener('change', () => {
    driveRack = $('drive').checked;
    $('rackHost').hidden = !driveRack;
    if (driveRack) {
      ensureAudio();
      ensureRack();
      setRackStatus('Loading the rack…');
    } else releaseRack();
    saveSettings();
  });
  $('target').addEventListener('change', () => {
    targetId = $('target').value;
    const t = RACK_TARGETS.find(x => x.id === targetId);
    if (t) knobAssign = Object.assign({}, t.map);
    fillKnobs();
    releaseRack();
    saveSettings();
  });
  document.querySelectorAll('[data-knob]').forEach(sel => {
    sel.addEventListener('change', () => {
      knobAssign[sel.getAttribute('data-knob')] = sel.value;
      saveSettings();
    });
  });
  document.querySelectorAll('[data-cc]').forEach(input => {
    input.addEventListener('change', () => {
      const n = Number(input.value);
      if (Number.isFinite(n)) ccMap[input.getAttribute('data-cc')] = Math.max(0, Math.min(127, n | 0));
      input.value = String(ccMap[input.getAttribute('data-cc')]);
      sentCc = {};
      saveSettings();
    });
  });
  $('channel').addEventListener('change', () => {
    channel = Math.max(1, Math.min(16, Number($('channel').value) | 0));
    $('channel').value = String(channel);
    saveSettings();
  });
  $('midiBtn').addEventListener('click', openMidi);

  window.addEventListener('keydown', onKey);
  window.addEventListener('pointerdown', () => ensureAudio(), { capture: true });
  pushMouse();
  bootCamera();
}

function markCal(which) {
  const raw = lastRaw || {
    height: 0.2 + ui.height * 0.55,
    palm: 0.12 + ui.depth * 0.22,
  };
  if (which === 'low') {
    cal.height = spanCal(raw.height, cal.height.high, 0.06);
    cal.depth = spanCal(raw.palm, cal.depth.high, 0.04);
    toast('Low mark stored. Raise the hand and mark the high point.');
  } else {
    cal.height = spanCal(cal.height.low, raw.height, 0.06);
    cal.depth = spanCal(cal.depth.low, raw.palm, 0.04);
    toast('High mark stored. Octave and distance now use that span.');
  }
  session.setCal(cal);
  saveSettings();
}

function panic() {
  FINGERS.forEach(id => { ui.play[id] = false; });
  document.querySelectorAll('[data-hand="play"]').forEach(b => b.setAttribute('aria-pressed', 'false'));
  if (orchestra) orchestra.panic();
  if (midiOut) {
    const ch = (channel - 1) & 15;
    prevNotes.forEach(n => midiOut.send([0x80 | ch, n & 127, 0]));
    midiOut.send(ccBytes(channel, 123, 0));
  }
  releaseRack();
  prevNotes = [];
  pushMouse();
  toast('Silent.');
}

async function openMidi() {
  if (!navigator.requestMIDIAccess) {
    $('midiState').textContent = 'This browser has no Web MIDI. Chrome, Edge and Firefox can open an output. Safari cannot.';
    return;
  }
  try {
    midiAccess = await navigator.requestMIDIAccess({ sysex: false });
  } catch (e) {
    $('midiState').textContent = 'MIDI permission was refused.';
    return;
  }
  const sel = $('midiOut');
  sel.innerHTML = '';
  const outs = [...midiAccess.outputs.values()];
  if (!outs.length) {
    $('midiState').textContent = 'MIDI is allowed, but no output is connected.';
    midiOn = false;
    return;
  }
  outs.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o.id;
    opt.textContent = o.name || o.id;
    sel.appendChild(opt);
  });
  sel.hidden = false;
  midiOut = outs[0];
  midiOn = true;
  $('midiState').textContent = 'Sending notes and CC to ' + (midiOut.name || 'output') + '.';
  sel.onchange = () => {
    midiOut = midiAccess.outputs.get(sel.value) || null;
    midiOn = !!midiOut;
    sentCc = {};
    $('midiState').textContent = midiOut ? 'Sending to ' + midiOut.name + '.' : 'No output selected.';
  };
  sentCc = {};
  if (session.state()) sendMidi(session.state());
}

function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  const playKeys = { Digit1: 'thumb', Digit2: 'index', Digit3: 'middle', Digit4: 'ring', Digit5: 'pinky' };
  const chordKeys = { KeyQ: 'thumb', KeyW: 'index', KeyE: 'middle', KeyR: 'ring', KeyT: 'pinky' };
  if (e.code === 'Space') { e.preventDefault(); panic(); return; }
  if (e.code === 'ArrowUp' || e.code === 'BracketRight') {
    ui.height = Math.min(1, ui.height + 0.05);
    $('height').value = String(ui.height);
    $('heightV').textContent = ui.height.toFixed(2);
    pushMouse();
    return;
  }
  if (e.code === 'ArrowDown' || e.code === 'BracketLeft') {
    ui.height = Math.max(0, ui.height - 0.05);
    $('height').value = String(ui.height);
    $('heightV').textContent = ui.height.toFixed(2);
    pushMouse();
    return;
  }
  const pf = playKeys[e.code];
  const cf = chordKeys[e.code];
  if (!pf && !cf) return;
  e.preventDefault();
  const hand = pf ? 'play' : 'chord';
  const finger = pf || cf;
  ui[hand][finger] = !ui[hand][finger];
  const btn = document.querySelector('[data-hand="' + hand + '"][data-finger="' + finger + '"]');
  if (btn) btn.setAttribute('aria-pressed', String(ui[hand][finger]));
  pushMouse();
}

let toastTimer = 0;
function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.dataset.show = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.dataset.show = '0'; }, 2400);
}

loadSettings();
wire();

window.__handOrchestra = {
  ready: () => !!$('stage') && !!$('overlay'),
  theory: () => import('./theory.js'),
  state: () => session.state(),
  session: () => session,
  feed: frame => {
    ensureAudio();
    const state = session.push(frame);
    applyState(state, !!(frame && (frame.playLandmarks || frame.chordLandmarks)));
    return state;
  },
  feedPose: (play, chord, opts) => {
    ensureAudio();
    const state = session.push(Object.assign({
      direct: !(opts && opts.smooth),
      immediate: !(opts && opts.hold),
      play, chord,
    }, opts || {}));
    applyState(state, false);
    return state;
  },
  landmarks: pose => landmarksFromPose(pose),
  analyze: lm => analyzeHand(lm),
  degree: degreeFromFingers,
  midiPlan: () => lastPlan,
  planNow: () => midiPlan(channel, ccMap, session.state(), []),
  knobs: () => lastKnobs.slice(),
  planKnobs: axes => knobPlan(targetId, axes || (session.state() && session.state().axes), knobAssign),
  mode: () => mode,
  setMode,
  size: () => document.documentElement.getAttribute('data-ui'),
  cam: () => camState,
  labels: () => lastLabels.map(l => Object.assign({}, l)),
  cameraOff: () => cameraOff,
  audio: () => orchestra ? { sounding: orchestra.sounding(), meters: orchestra.tick() } : null,
  panic,
  rack: () => ({ ready: rackReady, target: targetId, driving: driveRack, frame: rackFrame }),
  wakeRack: () => { driveRack = true; $('drive').checked = true; $('rackHost').hidden = false; ensureRack(); },
  settingsKey: SETTINGS_KEY,
};
