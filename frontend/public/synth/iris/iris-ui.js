// Iris panel. The camera stays in this browser: frames are read from a
// local video element or a local file and never sent anywhere.

import {
  BANDS, GRID_COLS, GRID_ROWS, MODES, SCALES, SIZES,
  bandHz, cellMidi, chordLabel, chordOf, columnBands, dominantColor,
  edgeTexture, encodeWav16, motionGrid, normalizeIris, noteName, snapHz,
  visionFrom, wavName,
} from './iris.js';
import { createIrisEngine, postIris, renderIris } from './iris-dsp.js';

const VIEW_W = 480;
const VIEW_H = 270;
const AW = 160;
const AH = 90;

const MODE_LABEL = {
  scanline: 'Scanline',
  color: 'Color',
  motion: 'Motion',
  edges: 'Edges',
};

function el(tag, attrs) {
  const node = document.createElement(tag);
  if (attrs) {
    Object.keys(attrs).forEach(k => {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
  }
  for (let i = 2; i < arguments.length; i++) {
    const kid = arguments[i];
    if (kid) node.appendChild(kid);
  }
  return node;
}

function b64(f32) {
  const u8 = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, u8.subarray(i, Math.min(u8.length, i + 0x8000)));
  }
  return btoa(s);
}

function cover(g, src, mirror) {
  const sw = src.videoWidth || src.naturalWidth || src.width;
  const sh = src.videoHeight || src.naturalHeight || src.height;
  if (!sw || !sh) return false;
  g.save();
  if (mirror) {
    g.translate(VIEW_W, 0);
    g.scale(-1, 1);
  }
  const scale = Math.max(VIEW_W / sw, VIEW_H / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  g.drawImage(src, (VIEW_W - dw) / 2, (VIEW_H - dh) / 2, dw, dh);
  g.restore();
  return true;
}

export function mountIris(root) {
  let savedSize = 'M';
  try { savedSize = localStorage.getItem('iris_size') || 'M'; } catch (e) { /* private mode */ }
  let patch = normalizeIris({ size: savedSize });

  const canvas = el('canvas', { id: 'irisPreview', width: String(VIEW_W), height: String(VIEW_H), role: 'img', 'aria-label': 'Mirrored camera preview with the scan line, motion grid, and color readout' });
  const g = canvas.getContext('2d', { willReadFrequently: true });
  const small = document.createElement('canvas');
  small.width = AW;
  small.height = AH;
  const sg = small.getContext('2d', { willReadFrequently: true });

  const gate = el('div', { class: 'gate', id: 'irisGate' });
  const camBtn = el('button', { type: 'button', class: 'bigcam', id: 'irisCam', text: 'Turn on camera' });
  const file = el('input', { type: 'file', id: 'irisFile', accept: 'image/*', 'aria-label': 'Use a picture' });
  const fileLabel = el('label', { class: 'bigfile' }, el('span', { text: 'Use a picture' }), file);
  const gateNote = el('p', { text: 'Iris reads the picture here. Nothing is uploaded.' });
  gate.appendChild(camBtn);
  gate.appendChild(fileLabel);
  gate.appendChild(gateNote);

  const stage = el('div', { class: 'stage', id: 'irisStage' }, canvas, gate);

  const lamp = el('i');
  const statusText = el('span', { id: 'irisStatus', text: 'camera starting' });
  const modeText = el('b', { id: 'irisModeRead', text: 'Scanline' });
  const chordText = el('b', { id: 'irisChord', text: '' });
  const hud = el('div', { class: 'hud' },
    el('span', { class: 'lamp' }, lamp, statusText),
    el('span', {}, document.createTextNode('mode '), modeText),
    el('span', {}, document.createTextNode('key '), chordText),
  );

  const modeRow = el('div', { class: 'chips', id: 'irisModes', role: 'group', 'aria-label': 'Sonification mode' });
  MODES.forEach(id => {
    modeRow.appendChild(el('button', {
      type: 'button', class: 'chip', 'data-mode': id, 'aria-pressed': String(id === patch.mode), text: MODE_LABEL[id],
    }));
  });

  const scaleSel = el('select', { class: 'btn', id: 'irisScale', 'aria-label': 'Scale' });
  SCALES.forEach(id => {
    const o = el('option', { value: id, text: id === 'off' ? 'scale off' : id });
    if (id === patch.scale) o.selected = true;
    scaleSel.appendChild(o);
  });
  const rootSel = el('select', { class: 'btn', id: 'irisRootKey', 'aria-label': 'Root key' });
  for (let n = 48; n <= 72; n++) {
    const o = el('option', { value: String(n), text: noteName(n) });
    if (n === patch.root) o.selected = true;
    rootSel.appendChild(o);
  }
  const snapBtn = el('button', { type: 'button', class: 'chip', id: 'irisSnap', 'aria-pressed': String(patch.snap), text: 'snap to scale' });

  const speed = slider('Speed', 'irisSpeed', patch.speed, 0.05, 2, 0.01, v => v.toFixed(2) + ' /s');
  const reverb = slider('Reverb', 'irisReverb', patch.reverb, 0, 1, 0.01, v => Math.round(v * 100) + '%');
  const level = slider('Volume', 'irisLevel', patch.level, 0, 1, 0.01, v => Math.round(v * 100) + '%');

  const freezeBtn = el('button', { type: 'button', class: 'btn', id: 'irisFreeze', 'aria-pressed': 'false', text: 'Freeze' });
  const recBtn = el('button', { type: 'button', class: 'btn rec', id: 'irisRec', 'aria-pressed': 'false', text: '● rec' });
  const recTime = el('span', { id: 'irisRecTime', 'aria-live': 'polite', text: '' });
  const pictureBtn = el('button', { type: 'button', class: 'btn', id: 'irisPicture', text: 'Picture' });
  const backBtn = el('button', { type: 'button', class: 'btn', id: 'irisLive', text: 'Camera' });

  const controls = el('div', { class: 'controls' },
    modeRow,
    el('div', { class: 'row' }, scaleSel, rootSel, snapBtn),
    el('div', { class: 'row' }, speed.wrap, reverb.wrap, level.wrap),
    el('div', { class: 'row' }, freezeBtn, recBtn, recTime, pictureBtn, backBtn),
    el('p', { class: 'note', text: 'Scanline reads brightness up the column into pitches. Color uses the hue as a chord, saturation as the filter, and brightness as loudness. Motion fires a note per grid cell. Edges turn contrast into a noise texture. Freeze holds one frame. Rec writes a WAV of what you hear.' }),
  );

  root.appendChild(stage);
  root.appendChild(hud);
  root.appendChild(controls);

  const video = document.createElement('video');
  video.setAttribute('playsinline', '');
  video.muted = true;
  video.autoplay = true;

  let stream = null;
  let camState = 'starting';
  let source = 'none';
  let preferStill = false;
  let stillImg = null;
  let bitmap = null;
  let frozen = null;
  let scan = 0;
  let lastAt = 0;
  let prevPix = null;
  let lastMotion = new Float32Array(GRID_COLS * GRID_ROWS);
  let hue = 0, sat = 0, val = 0, edge = 0, texture = 0;
  let chord = chordOf(0, patch.scale, patch.root);
  let postedAt = 0;
  let ctx = null;
  let node = null;
  let analyser = null;
  let analyserBuf = null;
  let recording = false;
  let recChunks = [];
  let recStarted = 0;
  let lastWav = null;
  let holdDownload = false;
  let booted = false;
  let audioError = '';

  function slider(name, id, value, min, max, step, fmt) {
    const input = el('input', { type: 'range', id, min: String(min), max: String(max), step: String(step), value: String(value), 'aria-label': name });
    const read = el('b', { text: fmt(value) });
    const wrap = el('label', { class: 'slider' }, el('span', {}, document.createTextNode(name + ' '), read), input);
    input.addEventListener('input', () => {
      const v = +input.value;
      read.textContent = fmt(v);
      if (id === 'irisSpeed') patch.speed = v;
      if (id === 'irisReverb') patch.reverb = v;
      if (id === 'irisLevel') patch.level = v;
      patch = normalizeIris(patch);
      sendPatch();
    });
    return { wrap, input, read };
  }

  function applySize(size) {
    patch.size = size;
    patch = normalizeIris(patch);
    document.documentElement.dataset.size = patch.size;
    try { localStorage.setItem('iris_size', patch.size); } catch (e) { /* ignore */ }
    document.querySelectorAll('#irisSizes button').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.size === patch.size));
    });
  }
  applySize(patch.size);

  function syncGate() {
    const show = camState === 'denied' && source !== 'still';
    gate.hidden = !show;
  }

  function syncHud() {
    modeText.textContent = MODE_LABEL[patch.mode] || patch.mode;
    chordText.textContent = chordLabel(chord, patch.scale);
    let label = 'camera off';
    lamp.className = '';
    if (camState === 'live' && source === 'camera') { label = 'camera live'; lamp.className = 'on'; }
    else if (camState === 'starting') { label = 'camera starting'; lamp.className = 'wait'; }
    else if (source === 'still') { label = patch.freeze ? 'picture held' : 'picture'; lamp.className = 'on'; }
    else if (camState === 'denied') { label = 'camera blocked'; }
    if (patch.freeze && source === 'camera') label = 'frame held';
    if (audioError) label = audioError;
    statusText.textContent = label;
    modeRow.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === patch.mode)));
    snapBtn.setAttribute('aria-pressed', String(!!patch.snap));
    freezeBtn.setAttribute('aria-pressed', String(!!patch.freeze));
    freezeBtn.textContent = patch.freeze ? 'Frozen' : 'Freeze';
    recBtn.setAttribute('aria-pressed', String(recording));
    recBtn.textContent = recording ? '● stop' : '● rec';
  }

  function sendPatch() {
    patch = normalizeIris(patch);
    if (node) node.port.postMessage({ t: 'patch', patch: {
      mode: patch.mode, scale: patch.scale, root: patch.root, snap: patch.snap,
      speed: patch.speed, level: patch.level, reverb: patch.reverb, fLo: patch.fLo, fHi: patch.fHi,
    } });
    syncHud();
  }

  async function resume() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC({ latencyHint: 'interactive' });
      await ctx.audioWorklet.addModule(new URL('./iris.worklet.js', import.meta.url));
      node = new AudioWorkletNode(ctx, 'iris', { outputChannelCount: [2] });
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      node.connect(analyser);
      analyser.connect(ctx.destination);
      analyserBuf = new Float32Array(analyser.fftSize);
      node.port.onmessage = onPort;
      booted = true;
      sendPatch();
    }
    if (ctx.state !== 'running') await ctx.resume();
    if (ctx.state === 'running') audioError = '';
    return ctx;
  }

  function onPort(ev) {
    const m = ev.data || {};
    if (m.t === 'rec' && m.L) recChunks.push(m);
    if (m.t === 'rec-done') finishRec();
  }

  function download(bytes) {
    const blob = new Blob([bytes], { type: 'audio/wav' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = wavName();
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  function finishRec() {
    let n = 0;
    recChunks.forEach(c => { n += c.L.length; });
    if (!n) { lastWav = new Uint8Array(44); return; }
    const L = new Float32Array(n);
    const R = new Float32Array(n);
    let o = 0;
    recChunks.forEach(c => {
      L.set(c.L, o);
      R.set(c.R, o);
      o += c.L.length;
    });
    lastWav = encodeWav16(L, R, ctx ? ctx.sampleRate : 44100);
    recChunks = [];
    if (!holdDownload) download(lastWav);
    syncHud();
  }

  function drawOverlays(motion) {
    const x = Math.min(VIEW_W - 1, Math.max(0, Math.floor(scan * VIEW_W)));
    g.save();
    const emphasis = patch.mode === 'scanline' ? 1 : 0.55;
    g.strokeStyle = 'rgba(255, 179, 71,' + emphasis + ')';
    g.lineWidth = patch.mode === 'scanline' ? 2 : 1;
    g.beginPath();
    g.moveTo(x + 0.5, 0);
    g.lineTo(x + 0.5, VIEW_H);
    g.stroke();
    g.fillStyle = 'rgba(255, 179, 71, 0.18)';
    g.fillRect(Math.max(0, x - 3), 0, 6, VIEW_H);

    const cellW = VIEW_W / GRID_COLS;
    const cellH = VIEW_H / GRID_ROWS;
    for (let gy = 0; gy < GRID_ROWS; gy++) {
      for (let gx = 0; gx < GRID_COLS; gx++) {
        const e = motion ? motion[gy * GRID_COLS + gx] || 0 : 0;
        const px = gx * cellW;
        const py = gy * cellH;
        if (e > 0.05) {
          g.fillStyle = 'rgba(0, 255, 157,' + Math.min(0.55, e * (patch.mode === 'motion' ? 0.7 : 0.35)) + ')';
          g.fillRect(px, py, cellW, cellH);
        }
        g.strokeStyle = patch.mode === 'motion' ? 'rgba(180, 255, 220, 0.45)' : 'rgba(255,255,255,0.16)';
        g.lineWidth = 1;
        g.strokeRect(px + 0.5, py + 0.5, cellW - 1, cellH - 1);
      }
    }

    const swatch = hsvCss(hue, sat, Math.max(val, 0.15));
    g.fillStyle = 'rgba(8, 10, 14, 0.72)';
    g.fillRect(8, 8, 176, 78);
    g.fillStyle = swatch;
    g.fillRect(16, 16, 22, 62);
    g.fillStyle = '#f3f3f3';
    g.font = '12px ui-monospace, SFMono-Regular, monospace';
    g.fillText('H ' + Math.round(hue * 360) + '°', 46, 28);
    g.fillText('S ' + Math.round(sat * 100) + '%', 46, 44);
    g.fillText('V ' + Math.round(val * 100) + '%', 46, 60);
    g.fillText('E ' + Math.round(edge * 100) + '%', 108, 44);
    const label = chordLabel(chord, patch.scale);
    g.fillStyle = '#ffd08a';
    g.fillText(label.slice(0, 16), 46, 76);
    g.restore();
  }

  function hsvCss(h, s, v) {
    const hh = ((h % 1) + 1) % 1;
    const ss = Math.max(0, Math.min(1, s));
    const vv = Math.max(0, Math.min(1, v));
    const c = vv * ss;
    const hp = hh * 6;
    const x = c * (1 - Math.abs(hp % 2 - 1));
    let r = 0, gc = 0, b = 0;
    if (hp < 1) { r = c; gc = x; }
    else if (hp < 2) { r = x; gc = c; }
    else if (hp < 3) { gc = c; b = x; }
    else if (hp < 4) { gc = x; b = c; }
    else if (hp < 5) { r = x; b = c; }
    else { r = c; b = x; }
    const m = vv - c;
    const ch = n => Math.round((n + m) * 255);
    return 'rgb(' + ch(r) + ',' + ch(gc) + ',' + ch(b) + ')';
  }

  function paintSource() {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#07090d';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    if (patch.freeze && frozen) {
      g.putImageData(frozen, 0, 0);
      return true;
    }
    if (source === 'camera' && video.readyState >= 2) return cover(g, video, true);
    if (source === 'still' && bitmap) return cover(g, bitmap, false);
    if (source === 'still' && stillImg) return cover(g, stillImg, false);
    return false;
  }

  function sample(force) {
    const drew = paintSource();
    let motion = lastMotion;
    if (drew && !patch.freeze) {
      sg.setTransform(1, 0, 0, 1, 0, 0);
      sg.drawImage(canvas, 0, 0, AW, AH);
      const frame = sg.getImageData(0, 0, AW, AH);
      const pix = frame.data;
      const x = Math.min(AW - 1, Math.max(0, Math.floor(scan * AW)));
      const prev = prevPix;
      const vision = visionFrom(pix, AW, AH, prev, x);
      prevPix = new Uint8ClampedArray(pix);
      hue = vision.hue;
      sat = vision.sat;
      val = vision.val;
      edge = vision.edge;
      texture = vision.texture;
      lastMotion = vision.motion;
      motion = vision.motion;
      chord = chordOf(hue, patch.scale, patch.root);
      const now = performance.now();
      if (node && (force || now - postedAt > 30)) {
        postedAt = now;
        node.port.postMessage({
          t: 'vision',
          bands: vision.bands,
          hue, sat, val,
          motion: vision.motion,
          edge, texture,
        });
      }
    } else {
      chord = chordOf(hue, patch.scale, patch.root);
    }
    drawOverlays(motion);
    syncHud();
  }

  function loop(t) {
    const dt = lastAt ? Math.min(0.05, (t - lastAt) / 1000) : 0;
    lastAt = t;
    if (!patch.freeze) scan = (scan + patch.speed * dt) % 1;
    if (recording && ctx) {
      const sec = Math.max(0, ctx.currentTime - recStarted);
      recTime.textContent = sec.toFixed(1) + 's';
    } else if (!recording) recTime.textContent = '';
    sample(false);
    requestAnimationFrame(loop);
  }

  async function startCamera() {
    camState = 'starting';
    syncHud();
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('This browser has no camera.');
      }
      const next = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      if (stream) stream.getTracks().forEach(track => track.stop());
      stream = next;
      video.srcObject = stream;
      await video.play();
      camState = 'live';
      if (!preferStill) source = 'camera';
    } catch (err) {
      camState = 'denied';
      if (source !== 'still') source = 'none';
    }
    syncGate();
    syncHud();
  }

  function takeFile(f) {
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      stillImg = img;
      bitmap = null;
      preferStill = true;
      source = 'still';
      patch.freeze = false;
      frozen = null;
      prevPix = null;
      URL.revokeObjectURL(url);
      syncGate();
      sendPatch();
    };
    img.onerror = () => { URL.revokeObjectURL(url); };
    img.src = url;
  }

  camBtn.addEventListener('click', async () => {
    await resume().catch(err => { audioError = 'audio blocked'; console.error(err); });
    preferStill = false;
    patch.freeze = false;
    frozen = null;
    await startCamera();
  });
  backBtn.addEventListener('click', () => camBtn.click());
  file.addEventListener('change', () => takeFile(file.files && file.files[0]));
  pictureBtn.addEventListener('click', () => file.click());

  modeRow.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-mode]');
    if (!b) return;
    patch.mode = b.dataset.mode;
    sendPatch();
    resume().catch(() => {});
  });
  scaleSel.addEventListener('change', () => { patch.scale = scaleSel.value; sendPatch(); });
  rootSel.addEventListener('change', () => { patch.root = +rootSel.value; sendPatch(); });
  snapBtn.addEventListener('click', () => { patch.snap = !patch.snap; sendPatch(); });
  freezeBtn.addEventListener('click', () => {
    if (!patch.freeze) {
      paintSource();
      frozen = g.getImageData(0, 0, VIEW_W, VIEW_H);
      patch.freeze = true;
    } else {
      patch.freeze = false;
      frozen = null;
    }
    sendPatch();
  });
  recBtn.addEventListener('click', async () => {
    try { await resume(); } catch (err) { audioError = 'audio blocked'; console.error(err); return; }
    recording = !recording;
    if (recording) {
      recChunks = [];
      lastWav = null;
      recStarted = ctx.currentTime;
      node.port.postMessage({ t: 'rec', on: true });
    } else {
      node.port.postMessage({ t: 'rec', on: false });
    }
    syncHud();
  });

  document.querySelectorAll('#irisSizes button').forEach(b => {
    b.addEventListener('click', () => applySize(b.dataset.size));
  });

  stage.addEventListener('dragover', (ev) => { ev.preventDefault(); });
  stage.addEventListener('drop', (ev) => {
    ev.preventDefault();
    const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
    if (f && /^image\//.test(f.type)) takeFile(f);
  });

  window.addEventListener('pointerdown', () => { resume().catch(() => {}); }, { passive: true });

  function useFrame(spec) {
    const w = spec.w | 0;
    const h = spec.h | 0;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ictx = c.getContext('2d', { willReadFrequently: true });
    const copy = new Uint8ClampedArray(spec.rgba);
    ictx.putImageData(new ImageData(copy, w, h), 0, 0);
    bitmap = c;
    stillImg = null;
    preferStill = true;
    source = 'still';
    if (spec.prev) prevPix = null;
    syncGate();
    sample(true);
    return state();
  }

  function renderTake(opts) {
    const o = opts || {};
    const sr = o.sampleRate || 44100;
    const eng = createIrisEngine(sr);
    postIris(eng, { t: 'patch', patch: Object.assign({}, patch, o.patch || {}) });
    const frames = o.frames || [o];
    const Ls = [];
    const Rs = [];
    frames.forEach(frame => {
      let vision = frame.vision || null;
      if (!vision && frame.rgba) {
        const x = frame.x == null ? Math.floor(((frame.w | 0) - 1) / 2) : frame.x;
        vision = visionFrom(frame.rgba, frame.w | 0, frame.h | 0, frame.prev || null, x);
      }
      if (vision) {
        postIris(eng, {
          t: 'vision',
          bands: vision.bands,
          hue: vision.hue,
          sat: vision.sat,
          val: vision.val,
          motion: vision.motion,
          edge: vision.edge,
          texture: vision.texture,
        });
      }
      const seconds = frame.seconds || o.seconds || 1;
      const n = Math.max(1, Math.floor(sr * seconds));
      const L = new Float32Array(n);
      const R = new Float32Array(n);
      for (let i = 0; i < n; i += 128) {
        const m = Math.min(128, n - i);
        renderIris(eng, L.subarray(i, i + m), R.subarray(i, i + m));
      }
      Ls.push(L);
      Rs.push(R);
    });
    let n = 0;
    Ls.forEach(a => { n += a.length; });
    const L = new Float32Array(n);
    const R = new Float32Array(n);
    let off = 0;
    for (let i = 0; i < Ls.length; i++) {
      L.set(Ls[i], off);
      R.set(Rs[i], off);
      off += Ls[i].length;
    }
    return { sr, L: b64(L), R: b64(R), n };
  }

  function state() {
    return {
      mode: patch.mode,
      size: patch.size,
      scale: patch.scale,
      root: patch.root,
      snap: patch.snap,
      speed: patch.speed,
      reverb: patch.reverb,
      level: patch.level,
      freeze: !!patch.freeze,
      camera: camState,
      source,
      gate: !gate.hidden,
      scan,
      hue, sat, val, edge, texture,
      chord: chord.slice(),
      chordName: chordLabel(chord, patch.scale),
      mirrored: source === 'camera',
      recording,
      motion: Array.from(lastMotion),
      booted,
      previewH: canvas.getBoundingClientRect().height,
    };
  }

  function peak() {
    if (!analyser || !analyserBuf) return 0;
    analyser.getFloatTimeDomainData(analyserBuf);
    let m = 0;
    for (let i = 0; i < analyserBuf.length; i++) {
      const a = Math.abs(analyserBuf[i]);
      if (a > m) m = a;
    }
    return m;
  }

  syncGate();
  syncHud();
  requestAnimationFrame(loop);
  resume().catch(err => { audioError = 'audio blocked'; console.error(err); syncHud(); });
  startCamera();
  setTimeout(() => {
    if (ctx && ctx.state !== 'running' && !audioError) {
      audioError = 'tap to hear';
      syncHud();
    }
  }, 700);

  return {
    ready: () => !!document.getElementById('irisPreview') && !!document.getElementById('irisCam'),
    state,
    peak,
    resume,
    setMode: (mode) => { patch.mode = mode; sendPatch(); },
    setPatch: (next) => { patch = normalizeIris(Object.assign({}, patch, next || {})); applySize(patch.size); sendPatch(); },
    useFrame,
    render: renderTake,
    lastWav: () => lastWav,
    holdDownload: (on) => { holdDownload = !!on; },
    columnBands, dominantColor, motionGrid, edgeTexture,
    chordOf, chordLabel, snapHz, bandHz, cellMidi, normalizeIris, noteName, visionFrom,
    constants: { BANDS, GRID_COLS, GRID_ROWS, MODES, SCALES, SIZES },
  };
}

const root = document.getElementById('irisRoot');
if (root) window.__iris = mountIris(root);
