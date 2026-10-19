// Aether on the page: camera or mouse in, smoothed controls out, sound and
// the mirrored preview. The camera path is the only place MediaPipe is loaded.

import * as map from './map.js';
import { createTheremin, renderBuffer, encodeChannel } from './audio.js';
import { createHandLandmarker, mirrorFrame } from './vision.js';

const $ = (id) => document.getElementById(id);
const KEYS = {
  size: 'dxedge-aether-size',
  cal: 'dxedge-aether-cal',
  set: 'dxedge-aether-settings',
};

let mode = 'gate';
let armed = false;
let ctx = null;
let graph = null;
let cal = map.sanitizeCalibration(readJSON(KEYS.cal));
let settings = sanitizeSettings(readJSON(KEYS.set));
let announced = '';
let simTime = 0;
let extents = null;
let calibrating = false;
let mouse = { x: 0.5, y: 0.96, filter: 0.58, vibrato: 0, reverb: 0.12, mute: false, space: false };
let held = null;
let heldUntil = 0;
let tracker = null;
let stream = null;
let lastDetect = null;
let detectAt = 0;
let mirrorCanvas = null;
let smoothers = null;
let smoothed = null;
let raw = null;
let raf = 0;
let viewRect = { x: 0, y: 0, w: 10, h: 10 };
let cssW = 10;
let cssH = 10;
let silent = false;
let booted = false;

function readJSON(key) {
  try {
    const text = localStorage.getItem(key);
    return text ? JSON.parse(text) : null;
  } catch (e) { return null; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
}

function sanitizeSettings(saved) {
  const s = Object.assign({
    snap: true, scale: 'major', root: 0, smooth: 0.55, latency: 36, swap: false,
  }, saved || {});
  s.snap = !!s.snap;
  s.swap = !!s.swap;
  if (!map.SCALES[s.scale]) s.scale = 'major';
  s.root = ((+s.root || 0) % 12 + 12) % 12;
  s.smooth = map.clamp(+s.smooth, 0, 1);
  s.latency = map.clamp(+s.latency || 36, 5, 180);
  return s;
}

function makeSmoothers() {
  const params = map.smoothParams(settings.smooth);
  return {
    pitch: map.createOneEuro(params),
    vol: map.createOneEuro(params),
    filter: map.createOneEuro(params),
    vib: map.createOneEuro(params),
    rev: map.createOneEuro(params),
  };
}

function ensureAudio() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC({ latencyHint: 'interactive' });
  graph = createTheremin(ctx, ctx.destination);
}

function arm() {
  ensureAudio();
  armed = true;
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  Object.keys(smoothers).forEach((k) => smoothers[k].reset());
}

function setStatus(text) { $('status').textContent = text; }

function setSlider(el, value) {
  silent = true;
  el.value = String(value);
  silent = false;
}

function setSize(size) {
  const next = map.SIZES.indexOf(size) >= 0 ? size : 'm';
  document.documentElement.dataset.size = next;
  writeJSON(KEYS.size, next);
  document.querySelectorAll('.sizes button').forEach((btn) => {
    btn.setAttribute('aria-pressed', btn.dataset.size === next ? 'true' : 'false');
  });
  requestAnimationFrame(resize);
}

function fillSelects() {
  const scale = $('scalePick');
  const root = $('rootPick');
  Object.keys(map.SCALE_NAMES).forEach((id) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = map.SCALE_NAMES[id];
    scale.appendChild(opt);
  });
  map.ROOTS.forEach((name, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = name;
    root.appendChild(opt);
  });
  scale.value = map.SCALES[settings.scale] ? settings.scale : 'major';
  root.value = String((settings.root | 0) % 12);
  $('snapBtn').setAttribute('aria-pressed', settings.snap ? 'true' : 'false');
  $('swapBtn').setAttribute('aria-pressed', settings.swap ? 'true' : 'false');
  $('smooth').value = String(settings.smooth);
  $('latency').value = String(settings.latency);
  $('smoothOut').textContent = Math.round(settings.smooth * 100) + '%';
  $('latencyOut').textContent = Math.round(settings.latency) + ' ms';
}

function saveSettings() { writeJSON(KEYS.set, settings); }

function sources(now) {
  if (mode === 'camera' && lastDetect && lastDetect.hands && lastDetect.hands.length) return lastDetect;
  if (held && now < heldUntil) return held;
  if (mode === 'mouse' || mode === 'gate') return { mouse: Object.assign({}, mouse, { mute: mouse.mute || mouse.space }) };
  if (lastDetect) return lastDetect;
  return { mouse: null };
}

function observe(src) {
  if (!calibrating || !extents) return;
  const hands = src.hands ? map.assignHands(src.hands, settings.swap) : { right: null, left: null };
  const sample = {};
  if (hands.right) {
    const metrics = map.handMetrics(hands.right, cal);
    sample.x = metrics.x;
    sample.y = metrics.y;
    sample.span = metrics.span;
  } else if (src.mouse) {
    sample.x = src.mouse.x;
    sample.y = src.mouse.y;
  }
  if (hands.left) {
    const metrics = map.handMetrics(hands.left, cal);
    sample.pinch = metrics.pinch;
    sample.spread = metrics.spread;
  }
  map.observeExtents(extents, sample);
}

function smoothPose(pose, nowMs) {
  const t = nowMs / 1000;
  const out = Object.assign({}, pose);
  out.pitch01 = smoothers.pitch.filter(pose.pitch01, t);
  out.vol01 = smoothers.vol.filter(pose.vol01, t);
  out.filter01 = smoothers.filter.filter(pose.filter01, t);
  out.vibrato = smoothers.vib.filter(pose.vibrato, t);
  out.reverb = smoothers.rev.filter(pose.reverb, t);
  const midiCont = map.PITCH_LOW + out.pitch01 * (map.PITCH_HIGH - map.PITCH_LOW);
  const scale = map.SCALES[settings.scale] || map.SCALES.major;
  const midi = settings.snap ? map.snapMidi(midiCont, settings.root | 0, scale) : midiCont;
  out.midi = midi;
  out.hz = map.midiToHz(midi);
  out.note = map.noteName(midi, !settings.snap);
  out.volume = pose.muted ? 0 : Math.pow(map.clamp(out.vol01, 0, 1), 1.35);
  out.cutoff = 180 * Math.pow(7600 / 180, map.clamp(out.filter01, 0, 1));
  out.muted = !!pose.muted;
  return out;
}

function step(now) {
  // Tests step a clock ahead of the display. A late frame holds the pose
  // instead of dragging the smoother backwards.
  if (simTime && now < simTime) return smoothed;
  simTime = now;
  const src = sources(now);
  observe(src);
  let input;
  if (src.hands) input = map.assignHands(src.hands, settings.swap);
  else input = { mouse: src.mouse || null };
  raw = map.poseFromHands(input, cal, settings);
  smoothed = smoothPose(raw, now);
  if (graph && armed) {
    graph.apply(smoothed, ctx.currentTime, (settings.latency || 20) / 1000);
  }
  paintReadout(smoothed);
  return smoothed;
}

function paintReadout(pose) {
  if (!pose) return;
  const playing = armed || mode !== 'gate';
  $('noteName').textContent = playing ? pose.note : '—';
  $('hzRead').textContent = playing
    ? (pose.hz.toFixed(1) + ' Hz' + (pose.muted ? '  muted' : ''))
    : 'move to play';
  const spoken = map.noteName(Math.round(pose.midi), false) + (pose.muted ? ' muted' : '');
  if (playing && spoken !== announced) {
    announced = spoken;
    $('noteLive').textContent = spoken;
  }
  $('volMeter').style.width = (pose.volume * 100) + '%';
  $('cutMeter').style.width = (pose.filter01 * 100) + '%';
  $('vibMeter').style.width = (pose.vibrato * 100) + '%';
  $('revMeter').style.width = (pose.reverb * 100) + '%';
  $('muteLamp').className = pose.muted ? 'hot' : '';
  $('muteState').textContent = pose.muted ? 'muted' : 'open';
  $('audioLamp').className = ctx && ctx.state === 'running' && armed ? 'live' : '';
  $('audioState').textContent = ctx && ctx.state === 'running' && armed ? 'audio on' : 'audio off';
  $('camLamp').className = mode === 'camera' && stream ? 'live' : '';
  $('camState').textContent = mode === 'camera' && stream ? 'camera on' : 'camera off';
  if (raw && raw.hasLeft) {
    setSlider($('vibSlider'), pose.vibrato);
    setSlider($('revSlider'), pose.reverb);
  }
  if (raw && raw.hasRight) setSlider($('filterSlider'), pose.filter01);
}

function resize() {
  const canvas = $('view');
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cssW = Math.max(2, rect.width);
  cssH = Math.max(2, rect.height);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
}

function contain(cw, ch, vw, vh) {
  const s = Math.min(cw / vw, ch / vh);
  const w = vw * s;
  const h = vh * s;
  return { x: (cw - w) / 2, y: (ch - h) / 2, w, h };
}

function point(p, rect) {
  return { x: rect.x + p.x * rect.w, y: rect.y + p.y * rect.h };
}

function drawHand(g, landmarks, color, rect) {
  if (!landmarks || landmarks.length < 21) return;
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = 2;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.beginPath();
  map.HAND_BONES.forEach(([a, b]) => {
    const pa = point(landmarks[a], rect);
    const pb = point(landmarks[b], rect);
    g.moveTo(pa.x, pa.y);
    g.lineTo(pb.x, pb.y);
  });
  g.stroke();
  landmarks.forEach((p) => {
    const q = point(p, rect);
    g.beginPath();
    g.arc(q.x, q.y, 3.2, 0, Math.PI * 2);
    g.fill();
  });
}

function drawGuides(g, rect, pose) {
  const scale = map.SCALES[settings.scale] || map.SCALES.major;
  g.save();
  g.beginPath();
  g.rect(rect.x, rect.y, rect.w, rect.h);
  g.clip();
  g.lineWidth = 1;
  g.font = '11px ui-monospace, SFMono-Regular, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'top';
  const step = settings.snap ? 1 : 12;
  for (let midi = map.PITCH_LOW; midi <= map.PITCH_HIGH; midi += step) {
    const rel = (((midi - (settings.root | 0)) % 12) + 12) % 12;
    if (settings.snap && scale.indexOf(rel) < 0) continue;
    const pitch01 = (midi - map.PITCH_LOW) / (map.PITCH_HIGH - map.PITCH_LOW);
    const xNorm = cal.x0 + pitch01 * (cal.x1 - cal.x0);
    const x = rect.x + xNorm * rect.w;
    g.strokeStyle = 'rgba(255,179,71,0.5)';
    g.beginPath();
    g.moveTo(x, rect.y);
    g.lineTo(x, rect.y + rect.h);
    g.stroke();
    g.fillStyle = 'rgba(255,208,138,0.9)';
    if (midi % 12 === ((settings.root | 0) % 12) || !settings.snap) {
      g.fillText(map.noteName(midi, false), x, rect.y + 8);
    }
  }
  [0, 0.25, 0.5, 0.75, 1].forEach((v) => {
    const yNorm = cal.y0 - v * (cal.y0 - cal.y1);
    const y = rect.y + yNorm * rect.h;
    g.strokeStyle = 'rgba(122,255,178,0.4)';
    g.beginPath();
    g.moveTo(rect.x, y);
    g.lineTo(rect.x + rect.w, y);
    g.stroke();
  });
  g.textAlign = 'left';
  g.fillStyle = 'rgba(122,255,178,0.92)';
  g.fillText('loud', rect.x + 8, rect.y + map.clamp(cal.y1, 0, 1) * rect.h + 4);
  g.fillText('quiet', rect.x + 8, rect.y + map.clamp(cal.y0, 0, 1) * rect.h - 16);
  g.textAlign = 'center';
  g.fillStyle = 'rgba(255,208,138,0.92)';
  g.fillText('pitch', rect.x + rect.w * 0.5, rect.y + rect.h - 18);
  if (pose) {
    const x = rect.x + (cal.x0 + pose.pitch01 * (cal.x1 - cal.x0)) * rect.w;
    const y = rect.y + (cal.y0 - pose.vol01 * (cal.y0 - cal.y1)) * rect.h;
    g.strokeStyle = pose.muted ? '#ff5c5c' : 'rgba(255,179,71,0.95)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x, rect.y);
    g.lineTo(x, rect.y + rect.h);
    g.moveTo(rect.x, y);
    g.lineTo(rect.x + rect.w, y);
    g.stroke();
    g.beginPath();
    g.arc(x, y, 11, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
}

function handsToDraw(now) {
  if (mode === 'camera' && lastDetect && lastDetect.hands && lastDetect.hands.length) return lastDetect.hands;
  if (held && now < heldUntil && held.hands) return held.hands;
  if (mode === 'mouse') {
    return [{
      label: 'Right',
      landmarks: map.syntheticHand({
        x: mouse.x,
        y: mouse.y,
        span: 0.09 + mouse.filter * 0.2,
        pinch: 0,
        spread: 0.8,
        fist: !!(mouse.mute || mouse.space),
      }),
    }];
  }
  return [];
}

function draw(now) {
  const canvas = $('view');
  const g = canvas.getContext('2d');
  const video = $('cam');
  g.clearRect(0, 0, cssW, cssH);
  g.fillStyle = '#090909';
  g.fillRect(0, 0, cssW, cssH);
  const playing = video.videoWidth > 0 && mode === 'camera';
  viewRect = playing ? contain(cssW, cssH, video.videoWidth, video.videoHeight) : { x: 0, y: 0, w: cssW, h: cssH };
  if (playing) {
    g.save();
    g.beginPath();
    g.rect(viewRect.x, viewRect.y, viewRect.w, viewRect.h);
    g.clip();
    g.translate(viewRect.x + viewRect.w, viewRect.y);
    g.scale(-1, 1);
    g.drawImage(video, 0, 0, viewRect.w, viewRect.h);
    g.restore();
  }
  drawGuides(g, viewRect, smoothed);
  handsToDraw(now).forEach((hand) => {
    const right = (hand.label || '').toLowerCase() !== 'left';
    drawHand(g, hand.landmarks, right ? '#ffb347' : '#7affb2', viewRect);
  });
  if (graph && graph.analyser) {
    const scope = $('scope');
    const sg = scope.getContext('2d');
    graph.analyser.getByteTimeDomainData(graph.wave);
    sg.clearRect(0, 0, scope.width, scope.height);
    sg.strokeStyle = '#ffb347';
    sg.lineWidth = 2;
    sg.beginPath();
    const data = graph.wave;
    for (let i = 0; i < data.length; i++) {
      const x = (i / (data.length - 1)) * scope.width;
      const y = (data[i] / 255) * scope.height;
      if (i === 0) sg.moveTo(x, y);
      else sg.lineTo(x, y);
    }
    sg.stroke();
  }
}

async function detect(now) {
  if (!tracker || $('cam').readyState < 2) return;
  if (now - detectAt < 40) return;
  detectAt = now;
  if (!mirrorCanvas) mirrorCanvas = document.createElement('canvas');
  if (!mirrorFrame($('cam'), mirrorCanvas)) return;
  try {
    const result = tracker.detect(mirrorCanvas, now);
    lastDetect = { hands: parseHands(result) };
  } catch (err) {
    setStatus('The hand tracker hit a snag. You can keep playing with the mouse.');
  }
}

function parseHands(result) {
  const landmarks = (result && result.landmarks) || [];
  const labels = (result && (result.handedness || result.handednesses)) || [];
  return landmarks.map((points, i) => {
    const cat = (labels[i] && labels[i][0]) || {};
    return {
      label: cat.categoryName || 'Unknown',
      landmarks: points.map((p) => ({ x: p.x, y: p.y, z: p.z || 0 })),
    };
  });
}

function loop(now) {
  raf = requestAnimationFrame(loop);
  try {
    if (mode === 'camera') detect(now);
    step(now);
    draw(now);
  } catch (err) {
    // One bad frame must not stop the instrument.
    console.error(err);
  }
}

function hideGate() { $('gate').hidden = true; }

function playMouse() {
  mode = 'mouse';
  hideGate();
  arm();
  $('stopCam').hidden = !stream;
  setStatus('Mouse. Left to right is pitch, up is louder. The wheel, or the distance slider, is the filter.');
}

async function useCamera() {
  hideGate();
  mode = 'camera';
  arm();
  $('camState').textContent = 'asking';
  setStatus('Asking the browser for the camera. The picture stays on this device.');
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    const video = $('cam');
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    setStatus('Loading the hand model. Your picture is not uploaded.');
    tracker = await createHandLandmarker();
    $('stopCam').hidden = false;
    setStatus('Camera on. Right hand sets pitch and volume. Left hand sets vibrato and reverb. A fist mutes.');
  } catch (err) {
    stopCamera(false);
    mode = 'gate';
    $('gate').hidden = false;
    const denied = err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
    $('gateText').textContent = denied
      ? 'The browser did not allow the camera. Nothing was recorded. Play with the mouse, or try the camera again.'
      : 'The camera or the hand model did not start. Nothing was uploaded. Play with the mouse, or try the camera again.';
    setStatus($('gateText').textContent);
  }
}

function stopCamera(toMouse) {
  if (tracker) {
    tracker.close();
    tracker = null;
  }
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  $('cam').srcObject = null;
  lastDetect = null;
  $('stopCam').hidden = true;
  if (toMouse !== false && mode === 'camera') {
    mode = 'mouse';
    setStatus('Camera off. The mouse still plays.');
  }
}

function beginCalibration() {
  extents = map.emptyExtents();
  calibrating = true;
  $('calBanner').hidden = false;
  if (mode === 'gate') playMouse();
  setStatus('Calibration is listening. Visit the corners, then press Done.');
}

function endCalibration() {
  if (extents) {
    cal = map.calibrationFromExtents(extents);
    writeJSON(KEYS.cal, cal);
  }
  calibrating = false;
  extents = null;
  $('calBanner').hidden = true;
  setStatus('Calibrated. The pitch and volume zones match that reach.');
  return cal;
}

function cancelCalibration() {
  calibrating = false;
  extents = null;
  $('calBanner').hidden = true;
  setStatus('Calibration cancelled. The previous zones stay.');
}

function pointerNorm(event) {
  const bounds = $('view').getBoundingClientRect();
  if (mode !== 'camera' || !cssW || !cssH) {
    return {
      x: map.clamp((event.clientX - bounds.left) / (bounds.width || 1), 0, 1),
      y: map.clamp((event.clientY - bounds.top) / (bounds.height || 1), 0, 1),
    };
  }
  const scaleX = bounds.width / cssW;
  const scaleY = bounds.height / cssH;
  const rx = viewRect.x * scaleX;
  const ry = viewRect.y * scaleY;
  const rw = viewRect.w * scaleX || bounds.width;
  const rh = viewRect.h * scaleY || bounds.height;
  return {
    x: map.clamp((event.clientX - bounds.left - rx) / rw, 0, 1),
    y: map.clamp((event.clientY - bounds.top - ry) / rh, 0, 1),
  };
}

function hear() {
  // A real pointer can arrive while a stepped clock is ahead of the frame.
  // Advance from that clock so the pose lands immediately.
  step((simTime || clockNow()) + 1);
}

function onPointer(event) {
  if (mode !== 'mouse' && !calibrating) return;
  if (mode === 'gate') playMouse();
  const p = pointerNorm(event);
  mouse.x = p.x;
  mouse.y = p.y;
  hear();
}

function bind() {
  document.querySelectorAll('.sizes button').forEach((btn) => {
    btn.addEventListener('click', () => setSize(btn.dataset.size));
  });
  $('cameraBtn').addEventListener('click', () => { useCamera(); });
  $('cameraLaunch').addEventListener('click', () => { useCamera(); });
  $('mouseBtn').addEventListener('click', playMouse);
  $('stopCam').addEventListener('click', () => stopCamera(true));
  $('calBtn').addEventListener('click', beginCalibration);
  $('calDone').addEventListener('click', endCalibration);
  $('calCancel').addEventListener('click', cancelCalibration);
  $('snapBtn').addEventListener('click', () => {
    settings.snap = !settings.snap;
    $('snapBtn').setAttribute('aria-pressed', settings.snap ? 'true' : 'false');
    saveSettings();
  });
  $('scalePick').addEventListener('change', () => {
    settings.scale = $('scalePick').value;
    saveSettings();
  });
  $('rootPick').addEventListener('change', () => {
    settings.root = parseInt($('rootPick').value, 10) || 0;
    saveSettings();
  });
  $('smooth').addEventListener('input', () => {
    settings.smooth = +$('smooth').value;
    const params = map.smoothParams(settings.smooth);
    Object.keys(smoothers).forEach((k) => smoothers[k].setParams(params));
    $('smoothOut').textContent = Math.round(settings.smooth * 100) + '%';
    saveSettings();
  });
  $('latency').addEventListener('input', () => {
    settings.latency = +$('latency').value;
    $('latencyOut').textContent = Math.round(settings.latency) + ' ms';
    saveSettings();
  });
  $('filterSlider').addEventListener('input', () => {
    if (!silent) mouse.filter = +$('filterSlider').value;
  });
  $('vibSlider').addEventListener('input', () => {
    if (!silent) mouse.vibrato = +$('vibSlider').value;
  });
  $('revSlider').addEventListener('input', () => {
    if (!silent) mouse.reverb = +$('revSlider').value;
  });
  $('swapBtn').addEventListener('click', () => {
    settings.swap = !settings.swap;
    $('swapBtn').setAttribute('aria-pressed', settings.swap ? 'true' : 'false');
    saveSettings();
  });
  $('muteBtn').addEventListener('click', () => {
    mouse.mute = !mouse.mute;
    $('muteBtn').setAttribute('aria-pressed', mouse.mute ? 'true' : 'false');
    if (mode === 'gate') playMouse();
  });
  const stage = $('stage');
  stage.addEventListener('pointerdown', (event) => {
    if (mode === 'camera') return;
    stage.setPointerCapture(event.pointerId);
    onPointer(event);
  });
  stage.addEventListener('pointermove', onPointer);
  stage.addEventListener('wheel', (event) => {
    if (mode === 'camera' && !calibrating) return;
    event.preventDefault();
    mouse.filter = map.clamp(mouse.filter - Math.sign(event.deltaY) * 0.05, 0, 1);
    setSlider($('filterSlider'), mouse.filter);
    if (mode === 'gate') playMouse();
  }, { passive: false });
  document.addEventListener('keydown', (event) => {
    if (event.code !== 'Space') return;
    const tag = event.target && event.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
    if (event.repeat) return;
    event.preventDefault();
    mouse.space = true;
    if (mode === 'gate') playMouse();
  });
  document.addEventListener('keyup', (event) => {
    if (event.code === 'Space') mouse.space = false;
  });
  window.addEventListener('pagehide', () => stopCamera(false));
  new ResizeObserver(resize).observe($('view'));
}

function clockNow() { return performance.now(); }

function boot() {
  smoothers = makeSmoothers();
  const savedSize = readJSON(KEYS.size);
  setSize(typeof savedSize === 'string' ? savedSize : 'm');
  fillSelects();
  bind();
  resize();
  booted = true;
  raf = requestAnimationFrame(loop);
}

boot();

window.__aether = {
  ready: () => booted && !!$('view') && !!$('gate'),
  mode: () => mode,
  size: () => document.documentElement.dataset.size,
  setSize,
  state: () => Object.assign({}, smoothed || {}, { latency: settings.latency, smooth: settings.smooth, size: document.documentElement.dataset.size }),
  raw: () => Object.assign({}, raw || {}),
  calibration: () => Object.assign({}, cal),
  settings: () => Object.assign({}, settings),
  playMouse,
  pointer: (x, y) => {
    if (mode !== 'mouse') playMouse();
    mouse.x = map.clamp(+x || 0, 0, 1);
    mouse.y = map.clamp(+y || 0, 0, 1);
  },
  setMouse: (partial) => { Object.assign(mouse, partial || {}); },
  ingest: (hands) => {
    held = { hands: hands || [] };
    heldUntil = (simTime || clockNow()) + 60000;
  },
  paint: () => { draw(simTime || clockNow()); return { cssW, cssH, width: $('view').width, height: $('view').height }; },
  release: () => { held = null; },
  settle: (n = 8, dt = 0.05) => {
    let t = simTime || clockNow();
    let last = smoothed;
    for (let i = 0; i < n; i++) {
      t += dt * 1000;
      last = step(t);
    }
    return Object.assign({}, last);
  },
  stepOnce: (dt = 0.016) => {
    const t = (simTime || clockNow()) + dt * 1000;
    return Object.assign({}, step(t));
  },
  beginCalibration,
  endCalibration,
  cancelCalibration,
  synthetic: (opts) => map.syntheticHand(opts || {}),
  map,
  render: async (opts) => {
    const buf = await renderBuffer(opts || {});
    return { sr: buf.sampleRate, L: encodeChannel(buf.left), R: encodeChannel(buf.right) };
  },
};
