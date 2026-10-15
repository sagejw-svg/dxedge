// Pentagrid on the page: a round shortwave dial, and the dxrack/1 adapter.
// The adapter does not import Filament's engine. create() returns the stereo worklet.

import { makeKnob } from './knob.js';
import { getDevice } from './device.js';
import {
  normalizePentagrid, PENTA_DEFAULT, PENTA_BAND, MODES,
  bandOf, condFromSolar, stationNear, makeQso,
} from './pentagrid.js';

const WORKLET = new URL('./pentagrid.worklet.js', import.meta.url).href;
const TUNE_MIN = 3500;
const TUNE_MAX = 30000;

export async function createPentagridNode(ctx, { patch, events, active, destination } = {}) {
  if (!ctx.__pentagrid) { await ctx.audioWorklet.addModule(WORKLET); ctx.__pentagrid = true; }
  const node = new AudioWorkletNode(ctx, 'pentagrid', {
    numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
    processorOptions: { patch: normalizePentagrid(patch), events: events || [], active: active !== false },
  });
  if (destination) node.connect(destination);
  return node;
}

export async function renderPentagridAudio({ patch, events = [], seconds = 1, sampleRate = 48000 }) {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const ev = events.map(e => Object.assign({}, e, { at: Math.round((e.at || 0) * sampleRate) }));
  const node = await createPentagridNode(ctx, { patch, events: ev, active: true, destination: ctx.destination });
  const buf = await ctx.startRendering();
  try { node.disconnect(); } catch (e) { /* the context already dropped it */ }
  return buf;
}

const desc = getDevice('pentagrid');
if (desc) {
  desc.messages = ['patch', 'on', 'off', 'bend', 'mw', 'sus', 'panic', 'active'];
  desc.create = async function create(ctx, host) {
    host = host || {};
    return createPentagridNode(ctx, {
      patch: host.patch, events: host.events, active: host.active !== false,
      destination: host.destination,
    });
  };
}

function isRack(engine) {
  return !!(engine && engine.api === 'dxrack/1' && typeof engine.addDevice === 'function');
}

export function createPentagridHost() {
  let node = null;
  let attaching = null;
  const pending = [];
  const meter = { voices: 0, notes: [], cpu: 0, level: 0, playing: false, tune: PENTA_DEFAULT.tune };
  let onMeter = null;
  let patch = normalizePentagrid(PENTA_DEFAULT);
  function send(m) { if (node) node.port.postMessage(m); else pending.push(m); }
  return {
    meter: () => meter,
    setMeterListener(fn) { onMeter = fn; },
    node: () => node,
    async attach(audioCtx, destination, engine) {
      if (node) return node;
      if (attaching) return attaching;
      const rack = isRack(engine);
      attaching = createPentagridNode(audioCtx, { active: false }).then(made => { node = made; return made; });
      try { node = await attaching; }
      finally { attaching = null; }
      node.port.onmessage = e => {
        const m = e.data;
        if (!m || m.t !== 'meter') return;
        Object.assign(meter, m);
        if (onMeter) onMeter(meter);
      };
      let mixed = false;
      if (rack) {
        try { engine.addDevice('pentagrid', node, patch); mixed = true; }
        catch (e) { mixed = false; }
      }
      if (!mixed && destination) node.connect(destination);
      pending.splice(0).forEach(m => node.port.postMessage(m));
      return node;
    },
    setPatch(p) { patch = normalizePentagrid(p); send({ t: 'patch', p: patch }); },
    setActive(on) { send({ t: 'active', on: !!on }); if (!on) { meter.voices = 0; meter.notes = []; meter.playing = false; } },
    noteOn(n, v) { send({ t: 'on', n, v: v == null ? 0.8 : v }); },
    noteOff(n) { send({ t: 'off', n }); },
    bend(v) { send({ t: 'bend', v }); },
    mod(v) { send({ t: 'mw', v }); },
    sustain(on) { send({ t: 'sus', on: !!on }); },
    panic() { send({ t: 'panic' }); meter.voices = 0; meter.notes = []; },
  };
}

function section(tab, id, title) {
  const s = document.createElement('section');
  s.className = 'mod penta';
  s.dataset.dev = 'pentagrid';
  s.dataset.tab = tab;
  s.id = id;
  s.innerHTML = '<h3><span class="pilot"></span>' + title + '</h3>';
  return s;
}

function fmtKhz(khz) {
  const n = Math.round(khz * 10) / 10;
  const mhz = n / 1000;
  const whole = Math.floor(mhz);
  const rest = Math.round((mhz - whole) * 1000);
  return whole + ' ' + String(rest).padStart(3, '0');
}

function drawDial(cv, tune, level) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth || 320;
  const h = cv.clientHeight || 220;
  if (cv.width !== Math.floor(w * dpr) || cv.height !== Math.floor(h * dpr)) {
    cv.width = Math.floor(w * dpr);
    cv.height = Math.floor(h * dpr);
  }
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h * 0.62;
  const R = Math.min(w * 0.46, h * 0.78);
  c.beginPath();
  c.arc(cx, cy, R + 14, Math.PI, 0);
  c.fillStyle = '#1a120c';
  c.fill();
  c.lineWidth = 10;
  c.strokeStyle = '#3a2618';
  c.stroke();
  c.beginPath();
  c.arc(cx, cy, R - 6, Math.PI, 0);
  c.strokeStyle = '#6a4a28';
  c.lineWidth = 2;
  c.stroke();
  c.font = '11px ui-monospace, monospace';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const marks = [3500, 5000, 7000, 10000, 14000, 18000, 21000, 28000];
  marks.forEach(k => {
    const a = dialAngle(k);
    const x0 = cx + Math.cos(a) * (R - 16);
    const y0 = cy + Math.sin(a) * (R - 16);
    const x1 = cx + Math.cos(a) * (R - 2);
    const y1 = cy + Math.sin(a) * (R - 2);
    c.strokeStyle = '#e7c48a';
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
    c.fillStyle = '#f0d7a8';
    c.fillText(String(k / 1000), cx + Math.cos(a) * (R - 30), cy + Math.sin(a) * (R - 30));
  });
  PENTA_BAND.forEach(st => {
    const a = dialAngle(st.khz);
    c.fillStyle = st.kind === 'cw' ? '#ffb347' : '#8fd0ff';
    c.beginPath();
    c.arc(cx + Math.cos(a) * (R - 8), cy + Math.sin(a) * (R - 8), 2.2, 0, Math.PI * 2);
    c.fill();
  });
  const pa = dialAngle(tune);
  c.strokeStyle = '#ffb347';
  c.lineWidth = 2.4;
  c.beginPath();
  c.moveTo(cx + Math.cos(pa) * 18, cy + Math.sin(pa) * 18);
  c.lineTo(cx + Math.cos(pa) * (R - 8), cy + Math.sin(pa) * (R - 8));
  c.stroke();
  c.beginPath();
  c.arc(cx, cy, 16, Math.PI, 0);
  c.fillStyle = '#2a1c12';
  c.fill();
  c.lineWidth = 2;
  c.strokeStyle = '#c9a36a';
  c.stroke();
  const m = Math.max(0, Math.min(1, level || 0));
  c.fillStyle = '#3a2a18';
  c.fillRect(cx - 40, cy + 8, 80, 6);
  c.fillStyle = '#ffb347';
  c.fillRect(cx - 40, cy + 8, 80 * Math.min(1, m * 4), 6);
}

function dialAngle(khz) {
  const t = (Math.min(TUNE_MAX, Math.max(TUNE_MIN, khz)) - TUNE_MIN) / (TUNE_MAX - TUNE_MIN);
  return -Math.PI + t * Math.PI;
}

function tuneFromPointer(cv, clientX, clientY) {
  const r = cv.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height * 0.62;
  let a = Math.atan2(clientY - cy, clientX - cx);
  if (a > Math.PI / 2) a = -Math.PI;
  else if (a > 0) a = 0;
  const t = Math.max(0, Math.min(1, (a + Math.PI) / Math.PI));
  return TUNE_MIN + t * (TUNE_MAX - TUNE_MIN);
}

export function mountPentagridPanel(container, hooks) {
  container.innerHTML = '';
  const dial = section('play', 'mPentaDial', 'Dial');
  dial.setAttribute('data-wide', '');
  const cv = document.createElement('canvas');
  cv.id = 'pentagridDial';
  cv.setAttribute('aria-label', 'Tuning dial. Drag around the scale to change frequency.');
  dial.appendChild(cv);
  const read = document.createElement('div');
  read.className = 'penta-read';
  read.id = 'pentagridRead';
  dial.appendChild(read);
  const sub = document.createElement('div');
  sub.className = 'note';
  sub.id = 'pentagridSub';
  dial.appendChild(sub);
  const modes = document.createElement('div');
  modes.className = 'chips';
  modes.id = 'pentagridModes';
  MODES.forEach(m => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.mode = m;
    b.textContent = m.toUpperCase();
    b.addEventListener('click', () => {
      hooks.patch().mode = m;
      hooks.edited();
      paint();
    });
    modes.appendChild(b);
  });
  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'chip';
  play.id = 'pentagridPlay';
  play.textContent = 'play';
  play.addEventListener('click', () => {
    const p = hooks.patch();
    p.play = !p.play;
    hooks.edited();
    paint();
  });
  modes.appendChild(play);
  dial.appendChild(modes);
  const textRow = document.createElement('div');
  textRow.className = 'penta-row';
  const text = document.createElement('input');
  text.type = 'text';
  text.id = 'pentagridText';
  text.maxLength = 80;
  text.spellcheck = false;
  text.setAttribute('aria-label', 'Morse text');
  text.placeholder = 'Morse text';
  text.addEventListener('input', () => {
    hooks.patch().text = text.value;
    hooks.edited();
  });
  const qso = document.createElement('button');
  qso.type = 'button';
  qso.className = 'btn small';
  qso.id = 'pentagridQso';
  qso.textContent = 'QSO';
  qso.title = 'Write a random call-sign exchange into the Morse text';
  qso.addEventListener('click', () => {
    const p = hooks.patch();
    p.seed = (p.seed % 9000) + 1;
    p.text = makeQso(p.seed);
    text.value = p.text;
    hooks.edited();
    paint();
  });
  textRow.appendChild(text);
  textRow.appendChild(qso);
  dial.appendChild(textRow);
  const dialNote = document.createElement('div');
  dialNote.className = 'note';
  dialNote.textContent = 'Drag the dial. CW, carriers and close pairs become a tone at the BFO, so the pitch follows the tuning. Play mode turns the keys into those beats. The Morse box is keyed at the WPM on the Band tab. QSO fills it with a made-up contact.';
  dial.appendChild(dialNote);

  const rx = section('band', 'mPentaRx', 'Receiver');
  const knobs = document.createElement('div');
  knobs.className = 'knobs';
  knobs.id = 'kPentaRx';
  rx.appendChild(knobs);
  const liveRow = document.createElement('div');
  liveRow.className = 'penta-row';
  const live = document.createElement('button');
  live.type = 'button';
  live.className = 'btn small';
  live.id = 'pentagridLive';
  live.textContent = 'live conditions';
  const condNote = document.createElement('div');
  condNote.className = 'note';
  condNote.id = 'pentagridCond';
  live.addEventListener('click', () => {
    const p = hooks.patch();
    fetch('/api/solar').then(r => {
      if (!r.ok) throw new Error('status ' + r.status);
      return r.json();
    }).then(data => {
      const v = condFromSolar(p.tune, data && data.band_conditions);
      if (v == null) {
        condNote.textContent = 'No condition row for ' + bandOf(p.tune) + '. The knob still sets it.';
        return;
      }
      p.cond = v;
      hooks.edited();
      paint();
      const row = (data.band_conditions || []).find(x => x.band === bandOf(p.tune));
      condNote.textContent = bandOf(p.tune) + ' is ' + (row ? row.condition : '') + ' on the live report.';
    }).catch(() => {
      condNote.textContent = 'Live conditions are not reachable from here. The knob still sets them.';
    });
  });
  liveRow.appendChild(live);
  rx.appendChild(liveRow);
  rx.appendChild(condNote);
  const rxNote = document.createElement('div');
  rxNote.className = 'note';
  rxNote.textContent = 'Bandwidth is the passband around the dial. AGC evens the level. The blanker mutes a click. Fade is the slow up and down. Conditions raise the stations and lower the noise. Live conditions reads this site’s solar report when it is available.';
  rx.appendChild(rxNote);

  container.appendChild(dial);
  container.appendChild(rx);

  const knobOf = {};
  function addKnob(path, label, min, max, step, fmt, title) {
    const read = () => hooks.patch()[path];
    const k = makeKnob(knobs, {
      label, min, max, step, value: read(), def: PENTA_DEFAULT[path], fmt, title: title || label,
      onChange: v => {
        hooks.patch()[path] = step >= 1 ? Math.round(v) : v;
        hooks.edited();
        paint();
      },
    });
    k.el.dataset.path = path;
    knobOf[path] = k;
  }
  const pct = v => Math.round(v * 100) + '%';
  addKnob('tune', 'tune', TUNE_MIN, TUNE_MAX, 1, v => Math.round(v) + '', 'Dial frequency in kHz');
  addKnob('bfo', 'bfo', -2500, 2500, 1, v => Math.round(v) + '', 'Beat offset in Hz. This is also the Morse pitch when it is above 200 Hz.');
  addKnob('bandwidth', 'width', 80, 8000, 1, v => Math.round(v) + '', 'Passband width in Hz');
  addKnob('agc', 'agc', 0, 1, 0.01, pct, 'Automatic gain');
  addKnob('blanker', 'blank', 0, 1, 0.01, pct, 'Noise blanker');
  addKnob('fade', 'fade', 0, 1, 0.01, pct, 'Fading depth');
  addKnob('cond', 'cond', 0, 1, 0.01, pct, 'Band conditions');
  addKnob('noise', 'noise', 0, 1, 0.01, pct, 'Band noise');
  addKnob('crackle', 'crackle', 0, 1, 0.01, pct, 'Atmospheric crackle');
  addKnob('air', 'air', 0, 1, 0.01, pct, 'How much of the band is in the speaker');
  addKnob('level', 'level', 0, 1, 0.01, pct, 'Level into the mixer');
  addKnob('wpm', 'wpm', 5, 40, 1, v => Math.round(v) + '', 'Morse speed in words per minute');

  let drag = false;
  function setTune(khz) {
    hooks.patch().tune = Math.max(TUNE_MIN, Math.min(TUNE_MAX, khz));
    hooks.edited();
    paint();
  }
  cv.addEventListener('pointerdown', e => {
    drag = true;
    cv.setPointerCapture(e.pointerId);
    setTune(tuneFromPointer(cv, e.clientX, e.clientY));
  });
  cv.addEventListener('pointermove', e => {
    if (!drag) return;
    setTune(tuneFromPointer(cv, e.clientX, e.clientY));
  });
  const end = () => { drag = false; };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const p = hooks.patch();
    const step = e.shiftKey ? 1 : 5;
    setTune(p.tune + (e.deltaY > 0 ? -step : step));
  }, { passive: false });

  let level = 0;
  function paint() {
    const p = hooks.patch();
    Object.keys(knobOf).forEach(path => knobOf[path].set(p[path]));
    modes.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === p.mode)));
    play.setAttribute('aria-pressed', String(!!p.play));
    play.textContent = p.play ? 'play on' : 'play';
    if (document.activeElement !== text) text.value = p.text || '';
    const near = stationNear(p.tune);
    read.textContent = fmtKhz(p.tune) + '  ' + bandOf(p.tune);
    sub.textContent = near ? near.name + '  ·  ' + near.kind : 'open dial';
    drawDial(cv, p.tune, level);
  }
  function follow(m) {
    level = m && m.level || 0;
    if (cv.offsetParent) drawDial(cv, hooks.patch().tune, level);
  }
  paint();
  return { sync: paint, follow };
}
