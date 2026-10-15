// Klystron on the page: the mouth pad, the modulator, and the dxrack/1 adapter.
// The pad uses pointer events on itself. touch-action: none is on the pad,
// so the rest of the page can still scroll.

import { makeKnob } from './knob.js';
import {
  klystronDevice, normalizeKlystron, KLY_DEFAULT, SOURCES, WAVES, VOWELS, formantsOf,
} from './klystron.js';

const WORKLET = new URL('./klystron.worklet.js', import.meta.url).href;

function isRack(engine) {
  return !!(engine && engine.api === 'dxrack/1' && typeof engine.registerDevice === 'function');
}

export async function createKlystronNode(ctx, { patch, events, active, destination, buffer } = {}) {
  if (!ctx.__klystron) { await ctx.audioWorklet.addModule(WORKLET); ctx.__klystron = true; }
  const node = new AudioWorkletNode(ctx, 'klystron', {
    numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
    processorOptions: {
      patch: normalizeKlystron(patch),
      events: events || [],
      active: active !== false,
      buffer: buffer && buffer.L ? { L: buffer.L, sr: buffer.sr, name: buffer.name || 'buffer' } : null,
    },
  });
  if (destination) node.connect(destination);
  return node;
}

export async function renderKlystronBuffer({ patch, events = [], seconds = 1, sampleRate = 48000, buffer } = {}) {
  const p = normalizeKlystron(patch);
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const ev = events.map(e => Object.assign({}, e, { at: e.at == null ? 0 : Math.round(e.at * sampleRate) }));
  const node = await createKlystronNode(ctx, {
    patch: p, events: ev, active: true, destination: ctx.destination, buffer: buffer || null,
  });
  const buf = await ctx.startRendering();
  try { node.disconnect(); } catch (e) { /* already closed */ }
  return buf;
}

function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!o[keys[i]] || typeof o[keys[i]] !== 'object') o[keys[i]] = {};
    o = o[keys[i]];
  }
  o[keys[keys.length - 1]] = value;
}

export function createKlystronHost() {
  let node = null;
  const pending = [];
  const meter = { voices: 0, notes: [], grains: 0, level: 0, peak: 0, cpu: 0, playing: false };
  let onMeter = null;
  let patch = normalizeKlystron(KLY_DEFAULT);
  let audioCtx = null;
  let stream = null;
  let micNode = null;
  let buffer = null;
  function send(m) {
    if (!m) return;
    if (!node) { pending.push(m); return; }
    node.port.postMessage(m);
  }
  function stopMic() {
    if (micNode) {
      try { micNode.disconnect(); } catch (e) { /* already gone */ }
      micNode = null;
    }
    if (stream) {
      stream.getTracks().forEach(t => { try { t.stop(); } catch (e) { /* already stopped */ } });
      stream = null;
    }
  }
  return {
    meter: () => meter,
    patch: () => patch,
    buffer: () => buffer,
    setMeterListener(fn) { onMeter = fn; },
    node: () => node,
    async attach(ctx, destination, engine) {
      if (node) return node;
      audioCtx = ctx;
      const rack = isRack(engine);
      if (rack) engine.registerDevice(klystronDevice);
      node = await createKlystronNode(ctx, { active: false, buffer });
      node.port.onmessage = e => {
        const m = e.data;
        if (!m || m.t !== 'meter') return;
        Object.assign(meter, m);
        if (onMeter) onMeter(meter);
      };
      let mixed = false;
      if (rack && typeof engine.addDevice === 'function') {
        try { engine.addDevice(klystronDevice.id, node, patch); mixed = true; }
        catch (err) { mixed = false; }
      }
      if (!mixed && destination) node.connect(destination);
      pending.splice(0).forEach(m => send(m));
      send({ t: 'patch', p: patch });
      if (buffer && buffer.L) send({ t: 'buffer', L: buffer.L, sr: buffer.sr, name: buffer.name });
      return node;
    },
    setPatch(p) {
      patch = normalizeKlystron(p);
      send({ t: 'patch', p: patch });
    },
    setActive(on) {
      if (!on) {
        meter.playing = false;
        meter.voices = 0;
        meter.grains = 0;
        meter.notes = [];
      }
      send({ t: 'active', on: !!on });
    },
    noteOn(n, vel) { send({ t: 'on', n, v: vel == null ? 0.8 : vel }); },
    noteOff(n) { send({ t: 'off', n }); },
    bend(v) { send({ t: 'bend', v }); },
    mod(v) { send({ t: 'mw', v }); },
    sustain(on) { send({ t: 'sus', on: !!on }); },
    panic() {
      meter.playing = false;
      meter.voices = 0;
      meter.grains = 0;
      meter.notes = [];
      send({ t: 'panic' });
    },
    loadChannels(L, sr, name) {
      buffer = { L, sr, name: name || 'file' };
      send({ t: 'buffer', L, sr, name: buffer.name });
    },
    async useMic() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('This browser has no microphone.');
      }
      if (!audioCtx) throw new Error('Audio is not ready yet.');
      stopMic();
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micNode = audioCtx.createMediaStreamSource(stream);
      if (node) micNode.connect(node);
      return true;
    },
    stopMic,
    micOn: () => !!stream,
  };
}

function el(tag, attrs, text) {
  const n = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(k => {
    if (k === 'class') n.className = attrs[k];
    else n.setAttribute(k, attrs[k]);
  });
  if (text != null) n.textContent = text;
  return n;
}

function section(tab, id, title) {
  const s = document.createElement('section');
  s.className = 'mod';
  s.dataset.dev = 'klystron';
  s.dataset.tab = tab;
  s.id = id;
  s.appendChild(el('h3', null, title));
  return s;
}

export function mountKlystronPanel(container, hooks) {
  container.innerHTML = '';
  const stage = section('play', 'mKlyStage', 'Mouth');
  stage.dataset.wide = '1';
  const pad = el('canvas', { id: 'klPad', 'aria-label': 'Vowel pad. Across is front to back, up is open to close.' });
  const vowels = el('div', { class: 'chips', id: 'klVowels' });
  const srcRow = el('div', { class: 'chips', id: 'klSources' });
  const fileLabel = el('label', { class: 'btn small filebtn', id: 'klFileBtn' }, 'Load');
  const file = el('input', { type: 'file', id: 'klFile', accept: 'audio/*,.wav,.mp3,.ogg,.flac' });
  fileLabel.appendChild(file);
  const mic = el('button', { type: 'button', class: 'btn small', id: 'klMic' }, 'Mic');
  const name = el('span', { class: 'note', id: 'klName' }, 'Vowel');
  srcRow.appendChild(fileLabel);
  srcRow.appendChild(mic);
  srcRow.appendChild(name);
  const hint = el('p', { class: 'note' });
  hint.textContent = 'Drag the pad to move the vowel. Load a recording or press Mic (the browser asks permission) and the same pad tilts that sound. Freeze holds a grain cloud. The red rec button saves what you hear as a WAV.';
  stage.appendChild(pad);
  stage.appendChild(vowels);
  stage.appendChild(srcRow);
  stage.appendChild(hint);

  const carrier = section('play', 'mKlyCarrier', 'Carrier');
  const waves = el('div', { class: 'chips', id: 'klWaves' });
  const kCar = el('div', { class: 'knobs', id: 'kKlyCar' });
  carrier.appendChild(waves);
  carrier.appendChild(kCar);

  const mouth = section('mouth', 'mKlyMouth', 'Smear');
  const freeze = el('button', { type: 'button', class: 'chip', id: 'klFreeze' }, 'freeze');
  const kGrain = el('div', { class: 'knobs', id: 'kKlyGrain' });
  const kBank = el('div', { class: 'knobs', id: 'kKlyBank' });
  mouth.appendChild(freeze);
  mouth.appendChild(kGrain);
  mouth.appendChild(kBank);

  container.appendChild(stage);
  container.appendChild(carrier);
  container.appendChild(mouth);

  const knobs = {};
  function read(path) {
    return path.split('.').reduce((o, k) => (o ? o[k] : 0), hooks.patch());
  }
  function addKnob(host, path, label, min, max, step, fmt) {
    const k = makeKnob(host, {
      label, min, max, step, value: read(path), def: read(path), fmt, title: label,
      onChange: v => { setPath(hooks.patch(), path, v); hooks.edited(); draw(); },
    });
    k.el.dataset.path = path;
    knobs[path] = k;
  }
  const pct = v => Math.round(v * 100) + '%';
  const ms = v => (v < 0.1 ? Math.round(v * 1000) + 'ms' : v.toFixed(2) + 's');
  addKnob(kCar, 'level', 'level', 0, 1, 0.001, pct);
  addKnob(kCar, 'carrier.tune', 'tune', -24, 24, 0.01, v => (v > 0 ? '+' : '') + v.toFixed(1));
  addKnob(kCar, 'carrier.noise', 'noise', 0, 1, 0.001, pct);
  addKnob(kCar, 'carrier.attack', 'attack', 0.001, 1.5, 0.001, ms);
  addKnob(kCar, 'carrier.release', 'release', 0.005, 3, 0.001, ms);
  addKnob(kCar, 'mouth.whisper', 'whisper', 0, 1, 0.001, pct);
  addKnob(kCar, 'mouth.glottis', 'glottis', 50, 240, 0.1, v => Math.round(v) + ' Hz');
  addKnob(kGrain, 'grain.size', 'size', 8, 500, 1, v => Math.round(v) + ' ms');
  addKnob(kGrain, 'grain.density', 'density', 0.5, 48, 0.1, v => v.toFixed(1) + '/s');
  addKnob(kGrain, 'grain.spray', 'spray', 0, 1, 0.001, pct);
  addKnob(kGrain, 'grain.mix', 'smear', 0, 1, 0.001, pct);
  addKnob(kGrain, 'grain.spread', 'spread', 0, 1, 0.001, pct);
  addKnob(kBank, 'bank.q', 'focus', 0.6, 8, 0.01, v => v.toFixed(1));
  addKnob(kBank, 'bank.attack', 'env a', 0.001, 0.2, 0.001, ms);
  addKnob(kBank, 'bank.release', 'env r', 0.005, 0.5, 0.001, ms);
  addKnob(kBank, 'bank.gate', 'gate', 0, 0.4, 0.001, pct);

  function chips(host, path, values, labels) {
    host.innerHTML = '';
    values.forEach(v => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.dataset.v = v;
      b.textContent = (labels && labels[v]) || v;
      b.addEventListener('click', () => { setPath(hooks.patch(), path, v); hooks.edited(); sync(); });
      host.appendChild(b);
    });
  }
  chips(waves, 'carrier.wave', WAVES, { saw: 'saw', pulse: 'pulse', sine: 'sine', noise: 'noise' });

  VOWELS.forEach(v => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.vowel = v.id;
    b.textContent = v.label;
    b.addEventListener('click', () => {
      const p = hooks.patch();
      p.mouth.x = v.x;
      p.mouth.y = v.y;
      p.source = 'vowel';
      hooks.edited();
      sync();
    });
    vowels.appendChild(b);
  });

  SOURCES.forEach(id => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.src = id;
    b.textContent = id === 'vowel' ? 'vowel' : id === 'file' ? 'file' : 'mic';
    b.addEventListener('click', () => {
      if (id === 'mic') { mic.click(); return; }
      if (id === 'file') { file.click(); return; }
      hooks.host.stopMic();
      hooks.patch().source = 'vowel';
      hooks.edited();
      sync();
    });
    srcRow.insertBefore(b, fileLabel);
  });

  function fit() {
    const r = pad.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(10, Math.round(r.width * dpr));
    const h = Math.max(10, Math.round(r.height * dpr));
    if (pad.width !== w || pad.height !== h) { pad.width = w; pad.height = h; }
    return { c: pad.getContext('2d'), w, h };
  }
  function draw() {
    const f = fit();
    if (!f) return;
    const { c, w, h } = f;
    const p = hooks.patch();
    c.clearRect(0, 0, w, h);
    const g = c.createLinearGradient(0, h, w, 0);
    g.addColorStop(0, '#2a140e');
    g.addColorStop(0.5, '#4a2418');
    g.addColorStop(1, '#7a3b28');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255, 196, 160, 0.18)';
    c.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      c.beginPath();
      c.moveTo(w * i / 4, 0); c.lineTo(w * i / 4, h); c.stroke();
      c.beginPath();
      c.moveTo(0, h * i / 4); c.lineTo(w, h * i / 4); c.stroke();
    }
    c.fillStyle = 'rgba(255, 220, 196, 0.7)';
    c.font = Math.max(11, Math.round(w * 0.035)) + 'px sans-serif';
    VOWELS.forEach(v => {
      c.fillText(v.label, v.x * w * 0.86 + w * 0.05, (1 - v.y) * h * 0.82 + h * 0.12);
    });
    const x = p.mouth.x * w;
    const y = (1 - p.mouth.y) * h;
    c.beginPath();
    c.arc(x, y, Math.max(8, w * 0.03), 0, Math.PI * 2);
    c.fillStyle = '#ffb089';
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = '#fff4ea';
    c.stroke();
    const fm = formantsOf(p.mouth.x, p.mouth.y);
    c.fillStyle = '#ffe8d6';
    c.font = Math.max(11, Math.round(w * 0.032)) + 'px sans-serif';
    c.fillText(Math.round(fm.f1) + ' / ' + Math.round(fm.f2) + ' Hz', 10, h - 12);
  }

  function place(clientX, clientY) {
    const r = pad.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const x = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, 1 - (clientY - r.top) / r.height));
    const p = hooks.patch();
    p.mouth.x = x;
    p.mouth.y = y;
    hooks.edited();
    draw();
  }
  pad.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    try { pad.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (hooks.wake) hooks.wake();
    place(e.clientX, e.clientY);
  });
  pad.addEventListener('pointermove', e => {
    if (!pad.hasPointerCapture(e.pointerId)) return;
    place(e.clientX, e.clientY);
  });

  freeze.addEventListener('click', () => {
    const p = hooks.patch();
    p.grain.freeze = !p.grain.freeze;
    hooks.edited();
    sync();
  });

  async function takeFile(f) {
    if (!f) return;
    if (hooks.wake) hooks.wake();
    const ctx = hooks.audio && hooks.audio();
    if (!ctx) { if (hooks.toast) hooks.toast('Audio is not ready yet.'); return; }
    try {
      const raw = await f.arrayBuffer();
      const audio = await ctx.decodeAudioData(raw.slice(0));
      const L = audio.getChannelData(0).slice();
      hooks.host.stopMic();
      hooks.host.loadChannels(L, audio.sampleRate, f.name.replace(/\.[^.]+$/, ''));
      const p = hooks.patch();
      p.source = 'file';
      hooks.edited();
      sync();
    } catch (err) {
      if (hooks.toast) hooks.toast('Could not read that audio file.');
    }
  }
  file.addEventListener('change', () => { const f = file.files && file.files[0]; takeFile(f); file.value = ''; });
  pad.addEventListener('dragover', e => { e.preventDefault(); pad.classList.add('over'); });
  pad.addEventListener('dragleave', () => pad.classList.remove('over'));
  pad.addEventListener('drop', e => {
    e.preventDefault();
    pad.classList.remove('over');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    takeFile(f);
  });

  mic.addEventListener('click', async () => {
    if (hooks.wake) hooks.wake();
    if (hooks.host.micOn()) {
      hooks.host.stopMic();
      hooks.patch().source = 'vowel';
      hooks.edited();
      sync();
      return;
    }
    try {
      await hooks.host.useMic();
      hooks.patch().source = 'mic';
      hooks.edited();
      sync();
    } catch (err) {
      hooks.host.stopMic();
      if (hooks.toast) hooks.toast(err && err.message ? err.message : 'Microphone permission was denied.');
      sync();
    }
  });

  function sync() {
    const p = hooks.patch();
    Object.keys(knobs).forEach(path => {
      const k = knobs[path];
      if (k && k.set) k.set(read(path));
    });
    waves.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === p.carrier.wave)));
    srcRow.querySelectorAll('.chip[data-src]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.src === p.source)));
    vowels.querySelectorAll('.chip').forEach(b => {
      const v = VOWELS.find(x => x.id === b.dataset.vowel);
      const on = p.source === 'vowel' && v && Math.abs(p.mouth.x - v.x) < 0.02 && Math.abs(p.mouth.y - v.y) < 0.02;
      b.setAttribute('aria-pressed', String(!!on));
    });
    freeze.setAttribute('aria-pressed', String(!!p.grain.freeze));
    mic.setAttribute('aria-pressed', String(p.source === 'mic' && hooks.host.micOn()));
    const buf = hooks.host.buffer();
    name.textContent = p.source === 'mic' ? 'Microphone' : p.source === 'file' ? (buf && buf.name ? buf.name : 'File') : 'Vowel';
    draw();
  }

  if (window.ResizeObserver) new ResizeObserver(() => draw()).observe(pad);
  sync();
  return { sync, draw };
}
