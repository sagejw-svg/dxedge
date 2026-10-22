// Additron on the page: the spectrum you draw, the stops, the morph, the rotor.

import { makeKnob } from './knob.js';
import {
  additronDevice, normalizeAdditron, AD_DEFAULT, PARTS, FOOT, REG, spectrumOf,
} from './additron.js';

const WORKLET = new URL('./additron.worklet.js', import.meta.url).href;

export async function createAdditronNode(ctx, { patch, events, active, destination } = {}) {
  if (!ctx.__additron) { await ctx.audioWorklet.addModule(WORKLET); ctx.__additron = true; }
  const node = new AudioWorkletNode(ctx, 'additron', {
    numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
    processorOptions: {
      patch: normalizeAdditron(patch),
      events: events || [],
      active: active !== false,
    },
  });
  if (destination) node.connect(destination);
  return node;
}

export async function renderAdditronAudio({ patch, events = [], seconds = 1, sampleRate = 48000 } = {}) {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const ev = events.map(e => Object.assign({}, e, { at: e.at == null ? 0 : Math.round((+e.at || 0) * sampleRate) }));
  const node = await createAdditronNode(ctx, { patch, events: ev, active: true, destination: ctx.destination });
  const buf = await ctx.startRendering();
  try { node.disconnect(); } catch (e) { /* the context is already closed */ }
  return buf;
}

function isRack(engine) {
  return !!(engine && engine.api === 'dxrack/1' && typeof engine.registerDevice === 'function');
}

additronDevice.create = async function create(ctx, host) {
  host = host || {};
  return createAdditronNode(ctx, {
    patch: host.patch, events: host.events, active: host.active !== false,
    destination: host.destination,
  });
};

export function createAdditronHost() {
  let node = null;
  const pending = [];
  const meter = { voices: 0, cpu: 0, peak: 0, level: 0 };
  let onMeter = null;
  let patch = normalizeAdditron(AD_DEFAULT);
  let rack = false;
  function send(m) {
    if (!m) return;
    if (!node) { pending.push(m); return; }
    node.port.postMessage(m);
  }
  return {
    meter: () => meter,
    patch: () => patch,
    setMeterListener(fn) { onMeter = fn; },
    node: () => node,
    rack: () => rack,
    async attach(audioCtx, destination, engine) {
      if (node) return node;
      rack = isRack(engine);
      if (rack) engine.registerDevice(additronDevice);
      node = await createAdditronNode(audioCtx, { destination: undefined, active: true, patch });
      node.port.onmessage = e => {
        const m = e.data;
        if (!m || m.t !== 'meter') return;
        Object.assign(meter, m);
        if (onMeter) onMeter(meter);
      };
      let mixed = false;
      if (rack && typeof engine.addDevice === 'function') {
        try { engine.addDevice(additronDevice.id, node, patch); mixed = true; }
        catch (err) { mixed = false; }
      }
      if (!mixed && destination) node.connect(destination);
      pending.splice(0).forEach(m => send(m));
      return node;
    },
    setPatch(p) {
      patch = normalizeAdditron(p);
      send({ t: 'patch', p: patch });
    },
    setActive(on) { send({ t: 'active', on: !!on }); },
    noteOn(n, vel) { send({ t: 'on', n, v: vel == null ? 0.8 : vel }); },
    noteOff(n) { send({ t: 'off', n }); },
    bend(v) { send({ t: 'bend', v }); },
    mod(v) { send({ t: 'mw', v }); },
    sustain(on) { send({ t: 'sus', on: !!on }); },
    panic() { send({ t: 'panic' }); },
  };
}

function section(tab, id, title) {
  const s = document.createElement('section');
  s.className = 'mod';
  s.dataset.dev = 'additron';
  s.dataset.tab = tab;
  s.id = id;
  const h = document.createElement('h3');
  h.innerHTML = '<span class="pilot"></span>' + title;
  s.appendChild(h);
  return s;
}

function chip(label, id) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip';
  b.id = id;
  b.textContent = label;
  b.setAttribute('aria-pressed', 'false');
  return b;
}

export function mountAdditronPanel(container, hooks) {
  container.innerHTML = '';
  const stage = section('play', 'mAdStage', 'Spectrum');
  stage.dataset.full = '';
  const canvas = document.createElement('canvas');
  canvas.id = 'adCanvas';
  canvas.setAttribute('aria-label', 'Harmonic spectrum. Across is the partial, up is its level. Drag to draw. The marked columns are the stops.');
  stage.appendChild(canvas);
  const tools = document.createElement('div');
  tools.className = 'ad-tools';
  const editA = chip('snapshot A', 'adEditA');
  const editB = chip('snapshot B', 'adEditB');
  const copy = chip('copy across', 'adCopy');
  const stops = chip('stops', 'adStops');
  const hand = chip('hand', 'adHand');
  const flute = chip('flute', 'adFlute');
  const full = chip('full', 'adFull');
  const quint = chip('quint', 'adQuint');
  const odd = chip('odd', 'adOdd');
  [editA, editB, copy, stops, hand, flute, full, quint, odd].forEach(b => tools.appendChild(b));
  stage.appendChild(tools);
  const morphLab = document.createElement('label');
  morphLab.className = 'ad-morph';
  morphLab.appendChild(document.createTextNode('morph'));
  const morph = document.createElement('input');
  morph.type = 'range';
  morph.id = 'adMorph';
  morph.min = '0';
  morph.max = '1';
  morph.step = '0.01';
  morph.setAttribute('aria-label', 'Morph from snapshot A to snapshot B');
  morphLab.appendChild(morph);
  const morphV = document.createElement('span');
  morphV.id = 'adMorphV';
  morphV.textContent = '0';
  morphLab.appendChild(morphV);
  stage.appendChild(morphLab);
  const note = document.createElement('div');
  note.className = 'note';
  note.textContent = 'Draw the spectrum. Across is the harmonic, up is its level. Stops snaps to the nine footage drawbars; hand draws all sixteen. A and B are two pictures, and morph blends them. The red rec button saves what you hear as a WAV.';
  stage.appendChild(note);
  container.appendChild(stage);

  const spin = section('spin', 'mAdSpin', 'Envelope and rotor');
  const spinNote = document.createElement('div');
  spinNote.className = 'note';
  spinNote.textContent = 'Tilt makes the higher partials die sooner, so a bright attack settles darker. Chorale is the slow rotor, tremolo the fast one, brake stops it. The mod wheel pushes chorale toward tremolo.';
  spin.appendChild(spinNote);
  const knobs = document.createElement('div');
  knobs.className = 'knobs';
  knobs.id = 'adKnobs';
  spin.appendChild(knobs);
  const speedRow = document.createElement('div');
  speedRow.className = 'ad-tools';
  const rotor = chip('rotor', 'adRotor');
  const chorale = chip('chorale', 'adChorale');
  const tremolo = chip('tremolo', 'adTremolo');
  const brake = chip('brake', 'adBrake');
  [rotor, chorale, tremolo, brake].forEach(b => speedRow.appendChild(b));
  spin.appendChild(speedRow);
  const percRow = document.createElement('div');
  percRow.className = 'ad-tools';
  const pOff = chip('perc off', 'adPercOff');
  const p2 = chip('perc 2', 'adPerc2');
  const p3 = chip('perc 3', 'adPerc3');
  const p5 = chip('perc 5', 'adPerc5');
  [pOff, p2, p3, p5].forEach(b => percRow.appendChild(b));
  spin.appendChild(percRow);
  container.appendChild(spin);

  const knobOf = {};
  function addKnob(path, label, min, max, step, fmt) {
    const p = hooks.patch();
    const k = makeKnob(knobs, {
      label, min, max, step, value: p[path], def: AD_DEFAULT[path],
      fmt, title: label,
      onChange: v => {
        hooks.patch()[path] = v;
        // The perc knob was silent while the harmonic chips sat on "perc off". Turning it up
        // picks perc 3, the way a speed chip turns the rotor on.
        if (path === 'perc' && v > 0 && hooks.patch().percHarm === 'off') {
          hooks.patch().percHarm = '3';
          sync();
        }
        hooks.edited();
      },
    });
    knobOf[path] = k;
  }
  const pct = v => Math.round(v * 100) + '%';
  const sec = v => v < 1 ? Math.round(v * 1000) + 'ms' : v.toFixed(2) + 's';
  addKnob('attack', 'attack', 0.001, 2, 0.001, sec);
  addKnob('decay', 'decay', 0.02, 6, 0.01, sec);
  addKnob('sustain', 'sustain', 0, 1, 0.01, pct);
  addKnob('release', 'release', 0.01, 6, 0.01, sec);
  addKnob('tilt', 'tilt', -1, 1, 0.01, v => v.toFixed(2));
  addKnob('level', 'level', 0, 1, 0.01, pct);
  addKnob('perc', 'perc', 0, 1, 0.01, pct);
  addKnob('percDecay', 'perc decay', 0.02, 1.5, 0.01, sec);
  addKnob('click', 'click', 0, 1, 0.01, pct);
  addKnob('spread', 'spread', 0, 1, 0.01, pct);
  addKnob('drive', 'drive', 0, 1, 0.01, pct);
  addKnob('leak', 'leak', 0, 1, 0.01, pct);
  addKnob('vib', 'vibrato', 0, 1, 0.01, pct);

  function specOf(which) {
    const p = hooks.patch();
    return which === 'b' ? p.drawB : p.draw;
  }

  function paintAt(x, y, fromK) {
    const p = hooks.patch();
    const spec = specOf(p.edit);
    const amp = Math.max(0, Math.min(1, 1 - y));
    const level = p.shape === 'stops' ? Math.round(amp * 8) / 8 : amp;
    let k;
    if (p.shape === 'stops') {
      const i = Math.round(Math.max(0, Math.min(1, x)) * (FOOT.length - 1));
      k = FOOT[Math.max(0, Math.min(FOOT.length - 1, i))].i;
    } else {
      k = Math.max(0, Math.min(PARTS - 1, Math.floor(Math.max(0, Math.min(1, x)) * PARTS)));
    }
    if (fromK == null || fromK === k) spec[k] = level;
    else if (p.shape === 'stops') {
      const i0 = FOOT.findIndex(f => f.i === fromK);
      const i1 = FOOT.findIndex(f => f.i === k);
      const a = Math.min(i0, i1);
      const b = Math.max(i0, i1);
      for (let i = a; i <= b; i++) spec[FOOT[i].i] = level;
    } else {
      const a = Math.min(fromK, k);
      const b = Math.max(fromK, k);
      for (let i = a; i <= b; i++) {
        const t = b === a ? 1 : (i - fromK) / (k - fromK);
        const raw = (1 - t) * (spec[fromK] == null ? level : lastAmp) + t * level;
        spec[i] = Math.max(0, Math.min(1, raw));
      }
    }
    return k;
  }

  let lastAmp = 0;
  let drawing = null;

  function draw() {
    const p = hooks.patch();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(10, canvas.clientWidth);
    const h = Math.max(10, canvas.clientHeight);
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#140e0c';
    ctx.fillRect(0, 0, w, h);
    const active = specOf(p.edit);
    const other = specOf(p.edit === 'b' ? 'a' : 'b');
    const sounded = spectrumOf(p);
    const col = w / PARTS;
    if (p.shape === 'stops') {
      ctx.strokeStyle = 'rgba(232, 160, 106, 0.12)';
      ctx.lineWidth = 1;
      for (let s = 1; s < 8; s++) {
        const y = h * (1 - s / 8);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    }
    for (let i = 0; i < PARTS; i++) {
      const x = i * col;
      const foot = FOOT.find(f => f.i === i);
      ctx.fillStyle = foot ? 'rgba(232, 160, 106, 0.08)' : 'rgba(255,255,255,0.02)';
      ctx.fillRect(x, 0, col - 1, h);
      const oh = other[i] * (h - 18);
      ctx.fillStyle = 'rgba(90, 58, 40, 0.85)';
      ctx.fillRect(x + 2, h - 16 - oh, Math.max(1, col - 5), oh);
      const ah = active[i] * (h - 18);
      ctx.fillStyle = p.edit === 'b' ? '#f0c09a' : '#e7a06a';
      ctx.fillRect(x + 2, h - 16 - ah, Math.max(1, col - 5), ah);
      if (foot) {
        ctx.fillStyle = '#c8a48a';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(foot.name, x + col / 2, h - 3);
      }
    }
    ctx.beginPath();
    ctx.strokeStyle = '#ffe1c4';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < PARTS; i++) {
      const x = i * col + col / 2;
      const y = h - 16 - sounded[i] * (h - 18);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function sync() {
    const p = hooks.patch();
    Object.keys(knobOf).forEach(path => knobOf[path].set(p[path]));
    editA.setAttribute('aria-pressed', String(p.edit !== 'b'));
    editB.setAttribute('aria-pressed', String(p.edit === 'b'));
    stops.setAttribute('aria-pressed', String(p.shape === 'stops'));
    hand.setAttribute('aria-pressed', String(p.shape === 'hand'));
    rotor.setAttribute('aria-pressed', String(!!p.rotor));
    rotor.textContent = p.rotor ? 'rotor on' : 'rotor off';
    chorale.setAttribute('aria-pressed', String(p.speed === 'chorale'));
    tremolo.setAttribute('aria-pressed', String(p.speed === 'tremolo'));
    brake.setAttribute('aria-pressed', String(p.speed === 'brake'));
    pOff.setAttribute('aria-pressed', String(p.percHarm === 'off'));
    p2.setAttribute('aria-pressed', String(p.percHarm === '2'));
    p3.setAttribute('aria-pressed', String(p.percHarm === '3'));
    p5.setAttribute('aria-pressed', String(p.percHarm === '5'));
    morph.value = String(p.morph);
    morphV.textContent = Number(p.morph).toFixed(2);
    draw();
  }

  function commit() { hooks.edited(); }

  editA.addEventListener('click', () => { hooks.patch().edit = 'a'; commit(); sync(); });
  editB.addEventListener('click', () => { hooks.patch().edit = 'b'; commit(); sync(); });
  copy.addEventListener('click', () => {
    const p = hooks.patch();
    if (p.edit === 'b') p.draw = p.drawB.slice();
    else p.drawB = p.draw.slice();
    commit();
    sync();
  });
  stops.addEventListener('click', () => { hooks.patch().shape = 'stops'; commit(); sync(); });
  hand.addEventListener('click', () => { hooks.patch().shape = 'hand'; commit(); sync(); });
  function loadReg(kind) {
    const p = hooks.patch();
    const src = REG[kind]();
    const spec = specOf(p.edit);
    for (let i = 0; i < PARTS; i++) spec[i] = src[i];
    p.shape = kind === 'odd' ? 'hand' : 'stops';
    commit();
    sync();
  }
  flute.addEventListener('click', () => loadReg('flute'));
  full.addEventListener('click', () => loadReg('full'));
  quint.addEventListener('click', () => loadReg('quint'));
  odd.addEventListener('click', () => loadReg('odd'));
  morph.addEventListener('input', () => {
    hooks.patch().morph = Math.max(0, Math.min(1, +morph.value || 0));
    morphV.textContent = Number(hooks.patch().morph).toFixed(2);
    commit();
    draw();
  });
  rotor.addEventListener('click', () => { const p = hooks.patch(); p.rotor = !p.rotor; commit(); sync(); });
  chorale.addEventListener('click', () => { hooks.patch().speed = 'chorale'; hooks.patch().rotor = true; commit(); sync(); });
  tremolo.addEventListener('click', () => { hooks.patch().speed = 'tremolo'; hooks.patch().rotor = true; commit(); sync(); });
  brake.addEventListener('click', () => { hooks.patch().speed = 'brake'; hooks.patch().rotor = true; commit(); sync(); });
  function setPerc(id) { hooks.patch().percHarm = id; if (id !== 'off' && hooks.patch().perc < 0.2) hooks.patch().perc = 0.45; commit(); sync(); }
  pOff.addEventListener('click', () => setPerc('off'));
  p2.addEventListener('click', () => setPerc('2'));
  p3.addEventListener('click', () => setPerc('3'));
  p5.addEventListener('click', () => setPerc('5'));

  function xy(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / Math.max(1, r.width),
      y: (e.clientY - r.top) / Math.max(1, r.height),
    };
  }
  canvas.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    e.preventDefault();
    hooks.wake();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* already captured */ }
    const p = xy(e);
    lastAmp = Math.max(0, Math.min(1, 1 - p.y));
    const k = paintAt(p.x, p.y, null);
    drawing = { k };
    lastAmp = specOf(hooks.patch().edit)[k];
    commit();
    draw();
  });
  canvas.addEventListener('pointermove', e => {
    if (!drawing || !canvas.hasPointerCapture(e.pointerId)) return;
    const p = xy(e);
    const k = paintAt(p.x, p.y, drawing.k);
    drawing.k = k;
    lastAmp = specOf(hooks.patch().edit)[k];
    commit();
    draw();
  });
  const up = () => { drawing = null; };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  window.addEventListener('resize', () => draw());
  sync();
  return { sync };
}
