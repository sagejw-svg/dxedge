// Dekatron on the page: the panel, and the dxrack/1 adapter.
//
// create(ctx, host) returns the stereo worklet node. If host.transport is the
// rack clock, the pattern follows its play, stop, tempo and 24 ppq pulses.
// If the engine has no transport, the pattern button runs the worklet's own
// clock. The adapter does not import Filament's engine.

import { makeKnob } from './knob.js';
import { drumDevice, normalizeDrum, DRUM_DEFAULT, VOICES, VOICE_LABELS, createHostClock } from './drums.js';
import { createDrumEngine, postDrum, renderDrum } from './drums-dsp.js';

const WORKLET = new URL('./drums.worklet.js', import.meta.url).href;
const KNOBS = [
  ['tune', 'tune', v => v >= 1000 ? (v / 1000).toFixed(2) + 'k' : Math.round(v) + ''],
  ['decay', 'decay', v => v < 1 ? Math.round(v * 1000) + 'ms' : v.toFixed(2) + 's'],
  ['color', 'color', v => Math.round(v * 100) + '%'],
  ['attack', 'attack', v => Math.round(v * 100) + '%'],
  ['level', 'level', v => Math.round(v * 100) + '%'],
  ['pan', 'pan', v => v === 0 ? 'C' : (v < 0 ? 'L' : 'R') + Math.round(Math.abs(v) * 100)],
];

export async function createDrumNode(ctx, { patch, events, active, destination } = {}) {
  if (!ctx.__dekatron) { await ctx.audioWorklet.addModule(WORKLET); ctx.__dekatron = true; }
  const node = new AudioWorkletNode(ctx, 'dekatron', {
    numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
    processorOptions: { patch: normalizeDrum(patch), events: events || [], active: active !== false },
  });
  if (destination) node.connect(destination);
  return node;
}

// Offline render through the real worklet. events use seconds in `at`; this converts
// them to frames. Returns the AudioBuffer (stereo).
export async function renderDrums({ patch, events = [], seconds = 1, sampleRate = 48000 }) {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const ev = events.map(e => Object.assign({}, e, { at: Math.round((e.at || 0) * sampleRate) }));
  const node = await createDrumNode(ctx, { patch, events: ev, active: true, destination: ctx.destination });
  const buf = await ctx.startRendering();
  try { node.disconnect(); } catch (e) { /* already torn down with the context */ }
  return buf;
}

function isRack(engine) {
  return !!(engine && engine.api === 'dxrack/1' && typeof engine.registerDevice === 'function');
}

// Subscribe a node to a dxrack transport. Tempo messages stay on the main
// thread (the worklet's step grid comes from the pulses, not from bpm).
export function followTransport(node, transport, readSeq, onTempo, onMessage) {
  const clock = createHostClock(readSeq);
  const send = m => { if (m && node && node.port) node.port.postMessage(m); };
  return transport.subscribe(ev => {
    clock.push(ev).forEach(m => {
      if (m.t === 'tempo') { if (onTempo) onTempo(m.bpm); return; }
      send(m);
      if (onMessage) onMessage(m);
    });
  });
}

// dxrack/1 entry. A host calls create(ctx, host) and gets the stereo node.
drumDevice.create = async function create(ctx, host) {
  host = host || {};
  const transport = host.transport;
  const hosted = !!(transport && typeof transport.subscribe === 'function');
  const node = await createDrumNode(ctx, {
    patch: host.patch, events: host.events, active: host.active !== false,
    destination: hosted ? undefined : host.destination,
  });
  if (hosted) followTransport(node, transport, () => host.patch || {}, host.onTempo);
  return node;
};

// Live node holder. attach() is idempotent per context.
// Pass the engine as the third argument. When it speaks dxrack/1, Dekatron
// registers and follows engine.transport. Otherwise the node connects to
// `destination` and the pattern button is the clock.
export function createDrumHost() {
  let node = null;
  const pending = [];
  const meter = { step: -1, playing: false, voices: 0, cpu: 0, v1: 0, v2: 0, length: 16 };
  let onMeter = null;
  let onTempo = null;
  let patch = normalizeDrum(DRUM_DEFAULT);
  let rackTransport = null;
  let unsub = null;
  function send(m) { if (node) node.port.postMessage(m); else pending.push(m); }
  function bind(n) {
    n.port.onmessage = e => {
      const m = e.data; if (!m) return;
      if (m.t === 'meter' || m.t === 'step') {
        if (m.step != null) meter.step = m.step;
        if (m.length != null) meter.length = m.length;
        if (m.playing != null) meter.playing = !!m.playing;
        if (m.t === 'meter') Object.assign(meter, m);
        if (onMeter) onMeter(meter);
      }
    };
  }
  function useTransport(transport) {
    if (!transport || typeof transport.subscribe !== 'function' || rackTransport === transport) return;
    if (unsub) unsub();
    rackTransport = transport;
    unsub = followTransport(node, transport, () => patch, bpm => { if (onTempo) onTempo(bpm); }, m => {
      if (m.t !== 'transport') return;
      meter.playing = !!m.playing;
      if (!m.playing) meter.step = -1;
      if (onMeter) onMeter(meter);
    });
  }
  return {
    meter: () => meter,
    setMeterListener(fn) { onMeter = fn; },
    setTempoListener(fn) { onTempo = fn; },
    node: () => node,
    rack: () => !!rackTransport,
    async attach(audioCtx, destination, engine) {
      if (node) return node;
      const rack = isRack(engine);
      if (rack) engine.registerDevice(drumDevice);
      const transport = rack && engine.transport;
      node = await createDrumNode(audioCtx, { destination: transport ? undefined : destination, active: true });
      bind(node);
      if (transport) useTransport(transport);
      let mixed = false;
      if (rack && typeof engine.addDevice === 'function') {
        try { engine.addDevice(drumDevice.id, node, patch); mixed = true; }
        catch (e) { mixed = false; }
      }
      if (!mixed && transport && destination) node.connect(destination);
      pending.splice(0).forEach(m => node.port.postMessage(m));
      return node;
    },
    setPatch(p) { patch = normalizeDrum(p); send({ t: 'patch', p: patch }); },
    setActive(on) { send({ t: 'active', on: !!on }); if (!on) { meter.playing = false; meter.step = -1; if (onMeter) onMeter(meter); } },
    trigger(voice, vel) { if (voice) send({ t: 'trig', voice, v: vel == null ? 0.9 : vel }); },
    setTempo(bpm) { if (rackTransport && typeof rackTransport.setTempo === 'function') rackTransport.setTempo(bpm); },
    transport(playing) {
      if (rackTransport) {
        if (playing && typeof rackTransport.play === 'function') rackTransport.play();
        else if (!playing && typeof rackTransport.stop === 'function') rackTransport.stop();
        return;
      }
      send({ t: 'transport', playing: !!playing });
      meter.playing = !!playing;
      if (!playing) meter.step = -1;
    },
  };
}

// Build the panel into `container` (a display:contents wrapper inside the instrument grid).
// hooks.edited() is called after the patch object is mutated in place.
// hooks.trigger(voiceId), hooks.transport(playing), hooks.wake().
export function mountDrumPanel(container, hooks) {
  const selected = { id: 'kick' };
  container.innerHTML = '';

  const transport = section('play', 'mDrumTr', 'Pattern');
  const playBtn = document.createElement('button');
  playBtn.type = 'button'; playBtn.className = 'btn'; playBtn.id = 'drumPlay';
  playBtn.textContent = 'play'; playBtn.setAttribute('aria-pressed', 'false');
  playBtn.title = 'Start or stop the pattern';
  const row = document.createElement('div'); row.className = 'row'; row.appendChild(playBtn);
  transport.appendChild(row);
  const kSeq = document.createElement('div'); kSeq.className = 'knobs'; kSeq.id = 'kDrumSeq'; transport.appendChild(kSeq);
  const note = document.createElement('div'); note.className = 'note';
  note.textContent = 'Sixteen steps. Accent is its own row. Swing delays every offbeat; full swing is a triplet, and the next on-beat stays on the grid. Pattern length cuts the loop short without changing the step size. C kick, D snare, F tom, F# closed hat, A# open hat, C# rim, D# clap, in any octave.';
  transport.appendChild(note);

  const grid = section('play', 'mDrumGrid', 'Steps');
  grid.setAttribute('data-wide', '');
  const gridBody = document.createElement('div'); gridBody.className = 'dgrid'; gridBody.id = 'drumGrid';
  grid.appendChild(gridBody);

  const voiceSec = section('voice', 'mDrumVoice', 'Voice');
  const chips = document.createElement('div'); chips.className = 'chips'; chips.id = 'drumVoices';
  voiceSec.appendChild(chips);
  const kVoice = document.createElement('div'); kVoice.className = 'knobs'; kVoice.id = 'kDrumVoice';
  voiceSec.appendChild(kVoice);
  const vnote = document.createElement('div'); vnote.className = 'note'; vnote.id = 'drumVoiceNote';
  voiceSec.appendChild(vnote);

  container.appendChild(transport); container.appendChild(grid); container.appendChild(voiceSec);

  const knobs = {};
  function addKnob(host, path, label, min, max, step, fmt, title) {
    const read = () => path.split('.').reduce((o, k) => (o ? o[k] : 0), hooks.patch());
    const k = makeKnob(host, {
      label, min, max, step, value: read(), def: read(), fmt, title: title || label,
      onChange: v => {
        const p = hooks.patch();
        const ks = path.split('.'); let o = p;
        for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
        o[ks[ks.length - 1]] = ks[ks.length - 1] === 'length' ? Math.round(v) : v;
        hooks.edited();
        if (path === 'seq.bpm' && hooks.setTempo) hooks.setTempo(v);
      },
    });
    k.el.dataset.path = path;
    knobs[path] = k;
    return k;
  }
  const fmtBpm = v => Math.round(v) + '';
  const fmtSw = v => v < 0.02 ? 'straight' : Math.round(v * 100) + '%';
  addKnob(kSeq, 'seq.bpm', 'tempo', 40, 240, 1, fmtBpm, 'Pattern tempo, in quarter notes per minute');
  addKnob(kSeq, 'seq.swing', 'swing', 0, 1, 0.01, fmtSw, 'Delays the offbeats. 100% is a triplet.');
  addKnob(kSeq, 'seq.length', 'length', 1, 16, 1, v => Math.round(v) + '', 'How many steps play before the pattern loops');
  addKnob(kSeq, 'seq.accentAmt', 'accent', 0, 1, 0.01, v => Math.round(v * 100) + '%', 'How much louder an accented step is');
  addKnob(kSeq, 'level', 'level', 0, 1, 0.01, v => Math.round(v * 100) + '%', 'Overall level');

  VOICES.forEach(id => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.voice = id; b.textContent = VOICE_LABELS[id];
    b.title = 'Edit ' + VOICE_LABELS[id] + '. Click again to play it.';
    b.addEventListener('click', () => {
      if (selected.id === id) { hooks.wake(); hooks.trigger(id); }
      selected.id = id; paint();
    });
    chips.appendChild(b);
  });
  KNOBS.forEach(([key, label, fmt]) => {
    addKnob(kVoice, 'voices.kick.' + key, label, 0, 1, 0.01, fmt);
  });

  function section(tab, id, title) {
    const s = document.createElement('section');
    s.className = 'mod'; s.dataset.tab = tab; s.id = id;
    s.innerHTML = '<h3><span class="pilot"></span>' + title + '</h3>';
    return s;
  }

  let shownStep = -1;
  function paintSteps() {
    const p = hooks.patch();
    const len = p.seq.length | 0;
    const cur = shownStep;
    gridBody.querySelectorAll('.dstep').forEach(b => {
      const i = +b.dataset.step;
      const kind = b.dataset.kind;
      const on = kind === 'accent' ? p.accent[i] : p.steps[kind][i];
      b.classList.toggle('on', !!on);
      b.classList.toggle('past', i >= len);
      b.classList.toggle('now', cur === i && cur >= 0);
      b.disabled = i >= len;
      const name = kind === 'accent' ? 'Accent' : VOICE_LABELS[kind];
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.setAttribute('aria-label', name + ' step ' + (i + 1) + (on ? ', on' : ', off') + (i >= len ? ', past the pattern length' : ''));
    });
  }
  function paint() {
    const p = hooks.patch();
    const id = selected.id;
    chips.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.voice === id)));
    const vp = p.voices[id];
    KNOBS.forEach(([key, , fmt]) => {
      const k = knobs['voices.kick.' + key];
      const range = rangeOf(id, key);
      // The knob's min/max were built for whatever voice was first. Rebuild the displayed
      // value through the knob's own range by rewriting min/max before set, when they differ.
      if (k.el.dataset.vmin !== String(range[0]) || k.el.dataset.vmax !== String(range[1])) retarget(k, range, fmt, vp[key]);
      else k.set(vp[key]);
    });
    const notes = {
      kick: 'Tune is the pitch it falls to. Attack is how far it falls from. Color is the beater click.',
      snare: 'Tune is the body. Color mixes that against the noise. Decay is the noise, attack is the body.',
      hatC: 'A short metal hit. Color opens the high end. The open hat and this one cut each other.',
      hatO: 'The same metal, a longer decay. A closed hat cuts it.',
      clap: 'Tune is the band the noise sits in. Attack spreads the little bursts apart. Decay is the tail.',
      tom: 'A higher, longer kick. Attack is the pitch fall.',
      rim: 'A short wood block, two tones a step and a half apart, plus a tick.',
    };
    vnote.textContent = notes[id] || '';
    playBtn.setAttribute('aria-pressed', String(!!(hooks.playing && hooks.playing())));
    playBtn.textContent = hooks.playing && hooks.playing() ? 'stop' : 'play';
    Object.keys(knobs).forEach(path => {
      if (path.startsWith('voices.')) return;
      const v = path.split('.').reduce((o, k) => (o ? o[k] : 0), p);
      knobs[path].set(v);
    });
    paintSteps();
  }
  function rangeOf(id, key) {
    const table = {
      kick: { tune: [32, 140], decay: [0.05, 1.4] },
      snare: { tune: [90, 420], decay: [0.04, 0.8] },
      hatC: { tune: [180, 900], decay: [0.008, 0.2] },
      hatO: { tune: [180, 900], decay: [0.08, 1.4] },
      clap: { tune: [400, 2800], decay: [0.06, 0.8] },
      tom: { tune: [55, 280], decay: [0.06, 1.1] },
      rim: { tune: [280, 2400], decay: [0.008, 0.16] },
    };
    if (key === 'color' || key === 'attack' || key === 'level') return [0, 1];
    if (key === 'pan') return [-1, 1];
    return (table[id] && table[id][key]) || [0, 1];
  }
  // makeKnob closes over min/max. When the selected voice's range differs, build a fresh knob.
  function retarget(prev, range, fmt, value) {
    const host = prev.el.parentNode, label = prev.el.querySelector('.kl').textContent;
    const path = prev.el.dataset.path;
    prev.el.remove();
    const step = range[1] - range[0] > 20 ? (range[1] > 200 ? 1 : 0.1) : 0.01;
    const key = path.split('.').pop();
    const def = DRUM_DEFAULT.voices[selected.id][key];
    const k = makeKnob(host, {
      label, min: range[0], max: range[1], step, value, def, fmt,
      title: label,
      onChange: v => {
        const p = hooks.patch();
        p.voices[selected.id][key] = v;
        hooks.edited();
      },
    });
    k.el.dataset.path = path;
    k.el.dataset.vmin = String(range[0]);
    k.el.dataset.vmax = String(range[1]);
    knobs[path] = k;
  }

  function buildGrid() {
    gridBody.innerHTML = '';
    const head = document.createElement('div'); head.className = 'drow dhead';
    const spacer = document.createElement('span'); spacer.className = 'dn'; spacer.textContent = '';
    head.appendChild(spacer);
    const stepsHead = document.createElement('div'); stepsHead.className = 'dsteps';
    for (let i = 0; i < 16; i++) {
      const n = document.createElement('span'); n.className = 'dnum'; n.textContent = (i + 1) + '';
      if (i % 4 === 0) n.classList.add('bar');
      stepsHead.appendChild(n);
    }
    head.appendChild(stepsHead); gridBody.appendChild(head);
    const lines = VOICES.map(id => [id, VOICE_LABELS[id]]).concat([['accent', 'Accent']]);
    lines.forEach(([id, label]) => {
      const r = document.createElement('div'); r.className = 'drow';
      const name = document.createElement('button');
      name.type = 'button'; name.className = 'dpad'; name.textContent = label;
      name.title = id === 'accent' ? 'Accent row' : 'Play ' + label;
      if (id !== 'accent') name.addEventListener('click', () => { selected.id = id; hooks.wake(); hooks.trigger(id); paint(); });
      r.appendChild(name);
      const steps = document.createElement('div'); steps.className = 'dsteps';
      for (let i = 0; i < 16; i++) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'dstep' + (id === 'accent' ? ' accent' : '');
        b.dataset.kind = id; b.dataset.step = String(i);
        if (i % 4 === 0) b.classList.add('bar');
        b.addEventListener('click', () => {
          const p = hooks.patch();
          const arr = id === 'accent' ? p.accent : p.steps[id];
          arr[i] = arr[i] ? 0 : 1;
          hooks.edited();
          paintSteps();
        });
        steps.appendChild(b);
      }
      r.appendChild(steps); gridBody.appendChild(r);
    });
    paintSteps();
  }
  buildGrid();

  playBtn.addEventListener('click', () => {
    hooks.wake();
    const on = !(hooks.playing && hooks.playing());
    hooks.transport(on);
    playBtn.setAttribute('aria-pressed', String(on));
    playBtn.textContent = on ? 'stop' : 'play';
  });

  // Give the voice knobs their real ranges once, for the kick, then paint switches voices.
  KNOBS.forEach(([key, , fmt]) => {
    const k = knobs['voices.kick.' + key];
    const range = rangeOf('kick', key);
    retarget(k, range, fmt, hooks.patch().voices.kick[key]);
  });
  paint();
  return {
    sync: paint,
    follow(step, playing) {
      shownStep = step == null ? -1 : step;
      playBtn.setAttribute('aria-pressed', String(!!playing));
      playBtn.textContent = playing ? 'stop' : 'play';
      paintSteps();
    },
  };
}

export { drumDevice, normalizeDrum, renderDrums as renderDrumBuffer };
