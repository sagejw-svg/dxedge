// Thyratron on the page: wood-and-black panel, and the dxrack/1 adapter.
// The adapter does not import Filament's engine. create(ctx, host) returns
// the stereo worklet node.

import { makeKnob } from './knob.js';
import { getDevice } from './device.js';
import { normalizeThy, THY_DEFAULT, THY_WAVES, THY_RANGES } from './thyratron.js';

const WORKLET = new URL('./thyratron.worklet.js', import.meta.url).href;

const WAVE_LABEL = { tri: 'tri', saw: 'saw', mix: 'mix', square: 'sq', wide: 'wide', narrow: 'narr' };
const RANGE_LABEL = { lo: 'LO', '32': "32'", '16': "16'", '8': "8'", '4': "4'", '2': "2'" };

export async function createThyNode(ctx, { patch, events, active, destination } = {}) {
  if (!ctx.__thyratron) { await ctx.audioWorklet.addModule(WORKLET); ctx.__thyratron = true; }
  const node = new AudioWorkletNode(ctx, 'thyratron', {
    numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
    processorOptions: { patch: normalizeThy(patch), events: events || [], active: active !== false },
  });
  if (destination) node.connect(destination);
  return node;
}

export async function renderThyAudio({ patch, events = [], seconds = 1, sampleRate = 48000 }) {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const ev = events.map(e => Object.assign({}, e, { at: Math.round((e.at || 0) * sampleRate) }));
  const node = await createThyNode(ctx, { patch, events: ev, active: true, destination: ctx.destination });
  const buf = await ctx.startRendering();
  try { node.disconnect(); } catch (e) { /* the context already dropped it */ }
  return buf;
}

const desc = getDevice('thyratron');
if (desc) {
  desc.messages = ['patch', 'on', 'off', 'bend', 'mw', 'sus', 'panic', 'active'];
  desc.create = async function create(ctx, host) {
    host = host || {};
    return createThyNode(ctx, {
      patch: host.patch, events: host.events, active: host.active !== false,
      destination: host.destination,
    });
  };
}

function isRack(engine) {
  return !!(engine && engine.api === 'dxrack/1' && typeof engine.addDevice === 'function');
}

export function createThyHost() {
  let node = null;
  let attaching = null;
  const pending = [];
  const meter = { voices: 0, notes: [], cpu: 0, v1: 0 };
  let onMeter = null;
  let patch = normalizeThy(THY_DEFAULT);
  function send(m) { if (node) node.port.postMessage(m); else pending.push(m); }
  return {
    meter: () => meter,
    setMeterListener(fn) { onMeter = fn; },
    node: () => node,
    async attach(audioCtx, destination, engine) {
      if (node) return node;
      if (attaching) return attaching;
      const rack = isRack(engine);
      attaching = createThyNode(audioCtx, { active: true }).then(made => { node = made; return made; });
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
        try { engine.addDevice('thyratron', node, patch); mixed = true; }
        catch (e) { mixed = false; }
      }
      if (!mixed && destination) node.connect(destination);
      pending.splice(0).forEach(m => node.port.postMessage(m));
      return node;
    },
    setPatch(p) { patch = normalizeThy(p); send({ t: 'patch', p: patch }); },
    setActive(on) { send({ t: 'active', on: !!on }); if (!on) { meter.voices = 0; meter.notes = []; } },
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
  s.className = 'mod thy';
  s.dataset.dev = 'thyratron';
  s.dataset.tab = tab;
  s.id = id;
  s.innerHTML = '<h3><span class="pilot"></span>' + title + '</h3>';
  return s;
}

function getPath(p, path) { return path.split('.').reduce((o, k) => (o ? o[k] : undefined), p); }
function setPath(p, path, v) {
  const ks = path.split('.');
  let o = p;
  for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
  o[ks[ks.length - 1]] = v;
}

export function mountThyPanel(container, hooks) {
  container.innerHTML = '';
  const play = section('play', 'mThyPlay', 'Keys');
  const kPlay = document.createElement('div'); kPlay.className = 'knobs'; kPlay.id = 'kThyPlay';
  play.appendChild(kPlay);
  const playNote = document.createElement('div'); playNote.className = 'note';
  playNote.textContent = 'One voice. Glide slews the pitch. The pitch and mod wheels are the strips beside the keys. Release uses the decay time.';
  play.appendChild(playNote);

  const osc = section('osc', 'mThyOsc', 'Oscillators');
  osc.setAttribute('data-wide', '');
  const oscHost = document.createElement('div'); oscHost.id = 'thyOsc';
  osc.appendChild(oscHost);
  const oscNote = document.createElement('div'); oscNote.className = 'note';
  oscNote.textContent = 'Footage sets the octave. Oscillator 3 can leave the keyboard and run as a low oscillator for the mod wheel.';
  osc.appendChild(oscNote);

  const mix = section('filter', 'mThyMix', 'Mixer');
  const kMix = document.createElement('div'); kMix.className = 'knobs'; kMix.id = 'kThyMix';
  mix.appendChild(kMix);
  const mixNote = document.createElement('div'); mixNote.className = 'note';
  mixNote.textContent = 'Noise and a short feedback path from the voice back into the mixer. The feedback soft-clips, so it grits rather than running away.';
  mix.appendChild(mixNote);

  const lad = section('filter play', 'mThyLad', 'Ladder');
  const kLad = document.createElement('div'); kLad.className = 'knobs'; kLad.id = 'kThyLad';
  lad.appendChild(kLad);
  const ladNote = document.createElement('div'); ladNote.className = 'note';
  ladNote.textContent = '24 dB per octave low-pass. Emphasis is the resonance. At the top the ladder sings on its own, and key tracking can put that whistle on the note.';
  lad.appendChild(ladNote);

  const loud = section('mod', 'mThyLoud', 'Loudness');
  const kLoud = document.createElement('div'); kLoud.className = 'knobs'; kLoud.id = 'kThyLoud';
  loud.appendChild(kLoud);
  const loudNote = document.createElement('div'); loudNote.className = 'note';
  loudNote.textContent = 'Attack, decay, sustain. There is no separate release: letting go runs the decay time down to silence.';
  loud.appendChild(loudNote);

  const cont = section('mod', 'mThyCont', 'Filter contour');
  const kCont = document.createElement('div'); kCont.className = 'knobs'; kCont.id = 'kThyCont';
  cont.appendChild(kCont);

  const mod = section('mod', 'mThyMod', 'Wheel');
  const modChips = document.createElement('div'); modChips.className = 'chips'; modChips.id = 'thyModSrc';
  mod.appendChild(modChips);
  const kMod = document.createElement('div'); kMod.className = 'knobs'; kMod.id = 'kThyMod';
  mod.appendChild(kMod);
  const modNote = document.createElement('div'); modNote.className = 'note';
  modNote.textContent = 'The mod wheel scales these depths. The source is oscillator 3, or the noise.';
  mod.appendChild(modNote);

  container.appendChild(play);
  container.appendChild(osc);
  container.appendChild(mix);
  container.appendChild(lad);
  container.appendChild(loud);
  container.appendChild(cont);
  container.appendChild(mod);

  const knobs = {};
  function addKnob(host, path, label, min, max, step, fmt, title) {
    const read = () => getPath(hooks.patch(), path);
    const k = makeKnob(host, {
      label, min, max, step, value: read(), def: read(), fmt, title: title || label,
      onChange: v => { setPath(hooks.patch(), path, step >= 1 ? Math.round(v) : v); hooks.edited(); },
    });
    k.el.dataset.path = path;
    knobs[path] = k;
  }
  function addLog(host, path, label, lo, hi, fmt, title) {
    const read = () => getPath(hooks.patch(), path);
    const from = v => Math.log(Math.max(lo, v) / lo) / Math.log(hi / lo);
    const to = p => lo * Math.pow(hi / lo, Math.max(0, Math.min(1, p)));
    const k = makeKnob(host, {
      label, min: 0, max: 1, step: 0.001, value: from(read()), def: from(read()),
      fmt: p => fmt(to(p)), title: title || label,
      onChange: p => { setPath(hooks.patch(), path, to(p)); hooks.edited(); },
    });
    k.el.dataset.path = path;
    knobs[path] = { set(v) { k.set(from(v)); }, el: k.el };
  }
  const fmtS = v => v < 1 ? Math.round(v * 1000) + 'ms' : v.toFixed(2) + 's';
  const fmtHz = v => v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 1 : 2) + 'k' : Math.round(v) + '';
  const pct = v => Math.round(v * 100) + '%';

  addKnob(kPlay, 'glide', 'glide', 0, 3, 0.001, v => v < 0.001 ? 'off' : fmtS(v), 'Time to glide most of the way to the next note');
  addKnob(kPlay, 'tune', 'tune', -100, 100, 1, v => (v > 0 ? '+' : '') + Math.round(v) + '¢', 'Master tune, in cents');
  addKnob(kPlay, 'bend', 'bend', 0, 12, 1, v => '±' + Math.round(v), 'Pitch wheel range, in semitones');
  addKnob(kPlay, 'level', 'level', 0, 1, 0.01, pct, 'Voice level into the mixer');

  ['osc1', 'osc2', 'osc3'].forEach(id => {
    const box = document.createElement('div');
    box.className = 'thy-osc';
    const lab = document.createElement('div');
    lab.className = 'thy-ol';
    lab.textContent = id === 'osc1' ? 'Osc 1' : id === 'osc2' ? 'Osc 2' : 'Osc 3';
    box.appendChild(lab);
    const waves = document.createElement('div'); waves.className = 'chips';
    THY_WAVES.forEach(w => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.path = id + '.wave'; b.dataset.val = w;
      b.textContent = WAVE_LABEL[w];
      b.title = id + ' waveform ' + w;
      b.addEventListener('click', () => { setPath(hooks.patch(), id + '.wave', w); hooks.edited(); paint(); });
      waves.appendChild(b);
    });
    box.appendChild(waves);
    const ranges = document.createElement('div'); ranges.className = 'chips';
    THY_RANGES.forEach(r => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.path = id + '.range'; b.dataset.val = r;
      b.textContent = RANGE_LABEL[r];
      b.title = id + ' range ' + RANGE_LABEL[r];
      b.addEventListener('click', () => { setPath(hooks.patch(), id + '.range', r); hooks.edited(); paint(); });
      ranges.appendChild(b);
    });
    box.appendChild(ranges);
    if (id === 'osc3') {
      const row = document.createElement('div'); row.className = 'chips';
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.id = 'thyLfo';
      b.textContent = 'lfo';
      b.title = 'Oscillator 3 ignores the keyboard and runs at the rate knob, for the mod wheel';
      b.addEventListener('click', () => { const p = hooks.patch(); p.osc3.lfo = !p.osc3.lfo; hooks.edited(); paint(); });
      row.appendChild(b);
      box.appendChild(row);
    }
    const ks = document.createElement('div'); ks.className = 'knobs';
    box.appendChild(ks);
    oscHost.appendChild(box);
    addKnob(ks, id + '.tune', 'tune', -12, 12, 0.01, v => (v > 0 ? '+' : '') + (Math.round(v * 100) / 100) + ' st', 'Tune, in semitones');
    addKnob(ks, id + '.level', 'level', 0, 1, 0.01, pct);
    if (id === 'osc3') addLog(ks, 'osc3.rate', 'rate', 0.05, 40, fmtHz, 'Rate when oscillator 3 is the low oscillator');
  });

  addKnob(kMix, 'mix.noise', 'noise', 0, 1, 0.01, pct, 'Noise level into the ladder');
  addKnob(kMix, 'mix.fb', 'feedback', 0, 1, 0.01, pct, 'How much of the voice returns to the mixer');

  addLog(kLad, 'filt.cutoff', 'cutoff', 20, 16000, fmtHz, 'Ladder cutoff');
  addKnob(kLad, 'filt.res', 'emphasis', 0, 1, 0.01, pct, 'Resonance. Full emphasis lets the ladder oscillate');
  addKnob(kLad, 'filt.drive', 'drive', 0, 1, 0.01, pct, 'How hard the mixer hits the ladder');
  addKnob(kLad, 'filt.track', 'key trk', 0, 1, 0.01, pct, 'Keyboard tracking. 100% follows the key');
  addKnob(kLad, 'filt.env', 'contour', 0, 1, 0.01, pct, 'How far the filter contour opens the cutoff');

  addLog(kLoud, 'loud.a', 'attack', 0.001, 4, fmtS);
  addLog(kLoud, 'loud.d', 'decay', 0.003, 8, fmtS, 'Decay, and the release');
  addKnob(kLoud, 'loud.s', 'sustain', 0, 1, 0.01, pct);
  addLog(kCont, 'cont.a', 'attack', 0.001, 4, fmtS);
  addLog(kCont, 'cont.d', 'decay', 0.003, 8, fmtS, 'Decay, and the release');
  addKnob(kCont, 'cont.s', 'sustain', 0, 1, 0.01, pct);

  ['osc3', 'noise'].forEach(src => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.path = 'mod.src'; b.dataset.val = src;
    b.textContent = src === 'osc3' ? 'osc 3' : 'noise';
    b.addEventListener('click', () => { setPath(hooks.patch(), 'mod.src', src); hooks.edited(); paint(); });
    modChips.appendChild(b);
  });
  addKnob(kMod, 'mod.pitch', 'pitch', 0, 12, 0.01, v => v < 0.05 ? '0' : v.toFixed(1) + ' st', 'Pitch depth at full mod wheel');
  addKnob(kMod, 'mod.cut', 'cutoff', 0, 4, 0.01, v => v < 0.02 ? '0' : v.toFixed(2) + ' oct', 'Cutoff depth at full mod wheel, in octaves');

  function paint() {
    const p = hooks.patch();
    container.querySelectorAll('.chip[data-path]').forEach(b => {
      const cur = getPath(p, b.dataset.path);
      b.setAttribute('aria-pressed', String(cur === b.dataset.val));
    });
    const lfo = container.querySelector('#thyLfo');
    if (lfo) {
      lfo.setAttribute('aria-pressed', String(!!p.osc3.lfo));
      lfo.textContent = p.osc3.lfo ? 'lfo on' : 'lfo';
    }
    Object.keys(knobs).forEach(path => knobs[path].set(getPath(p, path)));
  }
  paint();
  return { sync: paint };
}
