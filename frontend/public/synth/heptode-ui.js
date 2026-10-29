// Heptode on the page: the player, the track strips, and the placement field.
//
// The score stays on the main thread as packed arrays. A copy goes to the
// worklet, which is what actually plays it, so a very long file does not
// depend on a timer in the page.

import {
  heptodeDevice, normalizeHeptode, HEPTODE_DEFAULT, applyScoreMeta,
  randomizeGentle, captureSnap, morphTracks,
} from './heptode.js';
import { scoreFromBytes, prepareScore } from './heptode-score.js';
import { trackColor } from './heptode-family.js';
import { createHeptodeEngine, postHeptode, renderHeptode, VOICES } from './heptode-dsp.js';

const WORKLET = new URL('./heptode.worklet.js', import.meta.url).href;

function copyScore(score) {
  if (!score) return null;
  const out = {
    name: score.name, length: score.length, bpm: score.bpm,
    tempos: score.tempos, tracks: score.tracks, counts: score.counts,
    kept: score.kept, dropped: score.dropped, notes: score.notes,
  };
  ['t', 'd', 'ct', 'cv'].forEach(k => { if (score[k]) out[k] = score[k].slice(); });
  ['n', 'v', 'tr', 'ck', 'cc', 'ch'].forEach(k => { if (score[k]) out[k] = score[k].slice(); });
  return out;
}

export async function createHeptodeNode(ctx, { patch, events, active, destination, score, playing } = {}) {
  if (!ctx.__heptode) { await ctx.audioWorklet.addModule(WORKLET); ctx.__heptode = true; }
  const node = new AudioWorkletNode(ctx, 'heptode', {
    numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
    processorOptions: {
      patch: normalizeHeptode(patch),
      events: events || [],
      active: active !== false,
      score: score ? copyScore(score) : null,
      playing: !!playing,
    },
  });
  if (destination) node.connect(destination);
  return node;
}

export async function renderHeptodeBuffer({ patch, events = [], seconds = 1, sampleRate = 48000, score, playing } = {}) {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const ev = events.map(e => Object.assign({}, e, { at: e.at == null ? 0 : Math.round(e.at * sampleRate) }));
  const node = await createHeptodeNode(ctx, {
    patch, events: ev, active: true, destination: ctx.destination, score, playing,
  });
  const buf = await ctx.startRendering();
  try { node.disconnect(); } catch (e) { /* the context is already closed */ }
  return buf;
}

// Count sounding voices after a burst of note-ons. Used by the stress checks
// so the cap is measured without waiting on a meter message.
export function probeHeptode(patch, notes) {
  const eng = createHeptodeEngine(48000, patch || {});
  (notes || []).forEach(n => postHeptode(eng, {
    t: 'on', tr: n.tr || 0, n: n.n, v: n.v == null ? 0.8 : n.v,
  }));
  const L = new Float32Array(256);
  const R = new Float32Array(256);
  renderHeptode(eng, L, R);
  let voices = 0;
  for (let i = 0; i < VOICES; i++) if (eng.voices[i].on) voices++;
  let peak = 0;
  for (let i = 0; i < L.length; i++) {
    const a = L[i] < 0 ? -L[i] : L[i];
    if (a > peak) peak = a;
  }
  return { voices, cap: eng.cap, peak };
}

function isRack(engine) {
  return !!(engine && engine.api === 'dxrack/1' && typeof engine.registerDevice === 'function');
}

export function createHeptodeHost() {
  let node = null;
  const pending = [];
  const meter = { voices: 0, peak: 0, pos: 0, playing: false, cap: 32 };
  let onMeter = null;
  let patch = normalizeHeptode(HEPTODE_DEFAULT);
  let score = null;
  let rack = false;
  function send(m) {
    if (!m) return;
    if (!node) { pending.push(m); return; }
    node.port.postMessage(m);
  }
  function scale() {
    if (!score || !score.bpm) return 1;
    return patch.tempo / score.bpm;
  }
  return {
    meter: () => meter,
    score: () => score,
    setMeterListener(fn) { onMeter = fn; },
    node: () => node,
    rack: () => rack,
    async attach(audioCtx, destination, engine) {
      if (node) return node;
      rack = isRack(engine);
      if (rack) engine.registerDevice(heptodeDevice);
      node = await createHeptodeNode(audioCtx, { active: true, score, playing: meter.playing });
      node.port.onmessage = e => {
        const m = e.data;
        if (!m || m.t !== 'meter') return;
        Object.assign(meter, m);
        if (onMeter) onMeter(meter);
      };
      let mixed = false;
      if (rack && typeof engine.addDevice === 'function') {
        try { engine.addDevice(heptodeDevice.id, node, patch); mixed = true; }
        catch (e) { mixed = false; }
      }
      if (!mixed && destination) node.connect(destination);
      pending.splice(0).forEach(m => send(m));
      if (score) send({ t: 'score', score: copyScore(score), bpm: score.bpm });
      send({ t: 'patch', p: patch, scale: scale() });
      return node;
    },
    setPatch(p) {
      patch = normalizeHeptode(p);
      send({ t: 'patch', p: patch, scale: scale() });
    },
    setActive(on) { send({ t: 'active', on: !!on }); },
    noteOn(n, vel) { send({ t: 'on', tr: patch.live | 0, n, v: vel == null ? 0.8 : vel }); },
    noteOff(n) { send({ t: 'off', tr: patch.live | 0, n }); },
    bend(v) { send({ t: 'bend', tr: patch.live | 0, v }); },
    mod(v) { send({ t: 'mw', v }); },
    sustain(on) { send({ t: 'sus', on: !!on }); },
    panic() { send({ t: 'panic' }); },
    loadScore(next) {
      score = next;
      meter.pos = 0;
      meter.playing = false;
      send({ t: 'score', score: copyScore(next), bpm: next && next.bpm });
      send({ t: 'patch', p: patch, scale: scale() });
    },
    play() { meter.playing = true; send({ t: 'play' }); },
    stop() { meter.playing = false; send({ t: 'stop' }); },
    seek(pos) { send({ t: 'seek', pos: pos || 0 }); },
    state() {
      return {
        name: score ? score.name : '',
        notes: score && score.t ? score.t.length : 0,
        playing: !!meter.playing,
        voices: meter.voices | 0,
        pos: meter.pos || 0,
        bpm: score ? score.bpm : 0,
      };
    },
  };
}

function section(tab, id, title) {
  const s = document.createElement('section');
  s.className = 'mod';
  s.dataset.dev = 'heptode';
  s.dataset.tab = tab;
  s.id = id;
  const h = document.createElement('h3');
  h.innerHTML = '<span class="pilot"></span>' + title;
  s.appendChild(h);
  return s;
}

function btn(id, text, cls) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls || 'btn small';
  b.id = id;
  b.textContent = text;
  return b;
}

const SLIDERS = [
  ['wave', 'wave', 0, 1, 0.01],
  ['fm', 'fm', 0, 1, 0.01],
  ['cutoff', 'cutoff', 80, 14000, 1],
  ['res', 'res', 0, 0.92, 0.01],
  ['drive', 'drive', 0, 1, 0.01],
  ['a', 'attack', 0.001, 2, 0.001],
  ['d', 'decay', 0.001, 2, 0.001],
  ['s', 'sustain', 0, 1, 0.01],
  ['r', 'release', 0.001, 3, 0.001],
  ['fenv', 'filter env', 0, 1, 0.01],
  ['delay', 'delay', 0, 1, 0.01],
  ['reverb', 'reverb', 0, 1, 0.01],
  ['chorus', 'chorus', 0, 1, 0.01],
  ['level', 'level', 0, 1, 0.01],
];

export function mountHeptodePanel(container, hooks) {
  container.innerHTML = '';
  const play = section('play', 'mHepPlay', 'Player');
  play.dataset.full = '';
  const bar = document.createElement('div');
  bar.className = 'row hep-bar';
  const song = document.createElement('select');
  song.id = 'hepSong';
  song.className = 'btn';
  song.setAttribute('aria-label', 'Song');
  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = 'Choose a song';
  song.appendChild(opt0);
  const fileLabel = document.createElement('label');
  fileLabel.className = 'btn small filebtn';
  fileLabel.id = 'hepFileBtn';
  fileLabel.textContent = 'Open MIDI';
  const file = document.createElement('input');
  file.type = 'file';
  file.id = 'hepFile';
  file.accept = '.mid,.midi,audio/midi';
  fileLabel.appendChild(file);
  const playBtn = btn('hepPlay', 'play');
  const stopBtn = btn('hepStop', 'stop');
  const loopBtn = btn('hepLoop', 'loop', 'chip');
  const perfBtn = btn('hepPerf', 'performance', 'chip');
  bar.append(song, fileLabel, playBtn, stopBtn, loopBtn, perfBtn);
  play.appendChild(bar);

  const tempoRow = document.createElement('label');
  tempoRow.className = 'hep-tempo';
  tempoRow.textContent = 'tempo';
  const tempo = document.createElement('input');
  tempo.type = 'range';
  tempo.id = 'hepTempo';
  tempo.min = '40';
  tempo.max = '240';
  tempo.step = '1';
  tempo.value = '120';
  tempo.setAttribute('aria-label', 'Tempo');
  tempoRow.appendChild(tempo);
  play.appendChild(tempoRow);

  const drop = document.createElement('div');
  drop.className = 'hep-roll';
  drop.id = 'hepDrop';
  const roll = document.createElement('canvas');
  roll.id = 'hepRoll';
  roll.setAttribute('aria-label', 'Piano roll. Drop a MIDI file to play it.');
  drop.appendChild(roll);
  play.appendChild(drop);
  const nameEl = document.createElement('div');
  nameEl.className = 'note';
  nameEl.id = 'hepName';
  nameEl.textContent = 'Drop a .mid file, or pick a song. Every channel starts as a plain voice.';
  play.appendChild(nameEl);

  const mut = document.createElement('div');
  mut.className = 'row hep-bar';
  mut.append(
    btn('hepRand', 'gentle', 'chip'),
    btn('hepSnapA', 'store A', 'chip'),
    btn('hepSnapB', 'store B', 'chip'),
  );
  const morphLab = document.createElement('label');
  morphLab.className = 'hep-tempo';
  morphLab.textContent = 'morph';
  const morph = document.createElement('input');
  morph.type = 'range';
  morph.id = 'hepMorph';
  morph.min = '0';
  morph.max = '1';
  morph.step = '0.01';
  morph.value = '0';
  morph.setAttribute('aria-label', 'Morph between stored sounds');
  morphLab.appendChild(morph);
  mut.appendChild(morphLab);
  play.appendChild(mut);

  const tracks = section('tracks', 'mHepTracks', 'Tracks');
  const chips = document.createElement('div');
  chips.className = 'hep-channels';
  chips.id = 'hepChannels';
  tracks.appendChild(chips);
  const flags = document.createElement('div');
  flags.className = 'row';
  const mute = btn('hepMute', 'mute', 'chip');
  const solo = btn('hepSolo', 'solo', 'chip');
  flags.append(mute, solo);
  tracks.appendChild(flags);
  const sliders = document.createElement('div');
  sliders.className = 'hep-sliders';
  sliders.id = 'hepSliders';
  SLIDERS.forEach(([key, label, min, max, step]) => {
    const lab = document.createElement('label');
    lab.textContent = label;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.dataset.k = key;
    input.setAttribute('aria-label', label);
    lab.appendChild(input);
    sliders.appendChild(lab);
  });
  tracks.appendChild(sliders);

  const place = section('place', 'mHepPlace', 'Place');
  const field = document.createElement('canvas');
  field.id = 'heptodePlace';
  field.setAttribute('aria-label', 'Stereo field. Drag a track to place it.');
  place.appendChild(field);
  const hint = document.createElement('div');
  hint.className = 'note';
  hint.textContent = 'Across is pan. Up is nearer, down sits further back in the room.';
  place.appendChild(hint);

  container.append(play, tracks, place);

  const bake = document.createElement('canvas');
  let raf = 0;
  let catalog = [];
  let rawScore = null;

  function patch() { return hooks.patch(); }
  function commit(next) {
    const p = hooks.patch();
    Object.keys(next).forEach(k => { p[k] = next[k]; });
    if (next.tracks) p.tracks = next.tracks;
    hooks.edited();
  }
  function liveTrack() {
    const p = patch();
    return p.tracks[p.live | 0];
  }

  function paintChannels() {
    const p = patch();
    chips.innerHTML = '';
    p.tracks.forEach((t, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.style.borderColor = trackColor(i);
      b.setAttribute('aria-pressed', String(i === (p.live | 0)));
      b.textContent = String(i + 1);
      b.title = t.name;
      b.addEventListener('click', () => {
        p.live = i;
        hooks.edited();
        sync();
      });
      chips.appendChild(b);
    });
  }

  function sync() {
    const p = patch();
    const t = liveTrack();
    tempo.value = String(Math.round(p.tempo));
    morph.value = String(p.morph || 0);
    loopBtn.setAttribute('aria-pressed', String(!!p.loop));
    perfBtn.setAttribute('aria-pressed', String(!!p.performance));
    mute.setAttribute('aria-pressed', String(!!t.mute));
    solo.setAttribute('aria-pressed', String(!!t.solo));
    sliders.querySelectorAll('input').forEach(input => {
      input.value = String(t[input.dataset.k]);
    });
    paintChannels();
    const st = hooks.host.state();
    const bits = [];
    if (st.name) bits.push(st.name);
    if (st.notes) bits.push(st.notes + ' notes');
    if (p.performance) bits.push('performance');
    nameEl.textContent = bits.join(' · ') || 'Drop a .mid file, or pick a song. Every channel starts as a plain voice.';
    drawField();
  }

  function redrawRoll() {
    const canvas = roll;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 320;
    const h = canvas.clientHeight || 150;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#14110e';
    ctx.fillRect(0, 0, w, h);
    const score = hooks.host.score();
    const empty = !(score && score.t && score.t.length);
    const emptyFlag = empty ? '1' : '0';
    if (canvas.dataset.empty !== emptyFlag) canvas.dataset.empty = emptyFlag;
    if (empty) { drawEmptyRoll(ctx, w, h, drop.classList.contains('over')); return; }
    if (bake.width) {
      ctx.drawImage(bake, 0, 0, w, h);
    }
    const st = hooks.host.meter();
    const len = score && score.length ? score.length : 1;
    const x = ((st.pos || 0) / len) * w;
    ctx.strokeStyle = '#f3e6d8';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  // Empty state (graphics, 29 Oct): with no song the roll shows its own lanes, an octave band per C on the same
  // pitch scale the notes will use (MIDI 0 at the bottom, 127 at the top; MIDI 60 is C4 like the keyboard), and an
  // engraved readout window in the middle that says what to do. A file dragged over it lights the lanes.
  let rollFont = '';
  function drawEmptyRoll(ctx, w, h, over) {
    if (!rollFont) rollFont = (getComputedStyle(document.body).getPropertyValue('--font-mono') || '').trim() || 'monospace';
    const y = n => (127 - n) / 128 * h;
    for (let oct = 0; oct < 11; oct++) {
      const top = y(Math.min(127, oct * 12 + 11) + 1);
      const bot = y(oct * 12);
      ctx.fillStyle = oct % 2 ? (over ? 'rgba(255,179,71,0.10)' : 'rgba(231,196,168,0.035)') : (over ? 'rgba(255,179,71,0.05)' : 'rgba(0,0,0,0.18)');
      ctx.fillRect(0, top, w, bot - top);
      ctx.fillStyle = over ? 'rgba(255,179,71,0.45)' : 'rgba(231,196,168,0.14)';
      ctx.fillRect(0, Math.round(bot) - 1, w, 1);
    }
    ctx.font = '9px ' + rollFont;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = over ? 'rgba(255,200,120,0.85)' : 'rgba(231,196,168,0.55)';
    for (let oct = 2; oct <= 8; oct += 2) {
      const n = (oct + 1) * 12;
      ctx.fillText('C' + oct, 4, Math.round(y(n)) - 2);
    }
    const title = over ? 'RELEASE TO LOAD' : 'NO SONG LOADED';
    const sub = over ? 'the file plays on Heptode' : (w < 420 ? 'drop a .mid, or choose a song' : 'drop a .mid file here, or choose a song above');
    ctx.font = 'bold 12px ' + rollFont;
    const tw = ctx.measureText(title).width + 3 * title.length;
    ctx.font = '11px ' + rollFont;
    const sw = ctx.measureText(sub).width;
    const bw = Math.min(w - 16, Math.max(tw, sw) + 36);
    const bh = 50;
    const bx = Math.round((w - bw) / 2);
    const by = Math.round((h - bh) / 2);
    ctx.fillStyle = '#0b0907';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    ctx.strokeStyle = over ? 'rgba(255,179,71,0.75)' : 'rgba(231,196,168,0.22)';
    ctx.strokeRect(bx - 0.5, by - 0.5, bw + 1, bh + 1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffc46e';
    ctx.font = 'bold 12px ' + rollFont;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
    ctx.fillText(title, w / 2, by + 18);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.fillStyle = '#c9b8a6';
    ctx.font = '11px ' + rollFont;
    ctx.fillText(sub, w / 2, by + 35);
  }

  function bakeRoll(score) {
    const w = 1400;
    const h = 128;
    bake.width = w;
    bake.height = h;
    const ctx = bake.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    if (!score || !score.t || !score.t.length) return;
    const len = Math.max(0.001, score.length || 1);
    const n = score.t.length;
    const step = n > 24000 ? Math.ceil(n / 24000) : 1;
    for (let i = 0; i < n; i += step) {
      const x = (score.t[i] / len) * (w - 1);
      const dw = Math.max(1, (score.d[i] / len) * w);
      const y = (127 - score.n[i]);
      ctx.fillStyle = trackColor(score.tr[i]);
      ctx.globalAlpha = 0.35 + (score.v[i] / 127) * 0.65;
      ctx.fillRect(x, y, dw, 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawField() {
    const canvas = field;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 320;
    const h = canvas.clientHeight || 220;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#14110e';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(231,196,168,0.25)';
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.beginPath();
    ctx.moveTo(w / 2, 8);
    ctx.lineTo(w / 2, h - 8);
    ctx.stroke();
    const p = patch();
    p.tracks.forEach((t, i) => {
      const x = (t.pan + 1) * 0.5 * (w - 36) + 18;
      const y = (1 - t.space) * (h - 36) + 18;
      ctx.beginPath();
      ctx.fillStyle = trackColor(i);
      ctx.globalAlpha = t.used ? 0.95 : 0.35;
      ctx.arc(x, y, i === (p.live | 0) ? 14 : 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#1a120c';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), x, y);
    });
  }

  function frame() {
    redrawRoll();
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function publish(raw, name) {
    rawScore = raw;
    if (name) rawScore.name = name;
    const p = applyScoreMeta(patch(), rawScore);
    const cooked = prepareScore(rawScore, p);
    hooks.host.loadScore(cooked);
    commit(p);
    bakeRoll(cooked);
    sync();
    if (hooks.toast) hooks.toast((cooked.name || 'MIDI') + ' · ' + cooked.t.length + ' notes');
  }
  function takeBytes(bytes, name) {
    publish(scoreFromBytes(bytes, name), name);
  }

  file.addEventListener('change', () => {
    const f = file.files && file.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      takeBytes(new Uint8Array(reader.result), f.name.replace(/\.mid$/i, ''));
      file.value = '';
    };
    reader.readAsArrayBuffer(f);
  });

  function onDrop(e) {
    e.preventDefault();
    drop.classList.remove('over');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => takeBytes(new Uint8Array(reader.result), f.name.replace(/\.mid$/i, ''));
    reader.readAsArrayBuffer(f);
  }
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', onDrop);

  playBtn.addEventListener('click', () => { if (hooks.wake) hooks.wake(); hooks.host.play(); sync(); });
  stopBtn.addEventListener('click', () => { hooks.host.stop(); sync(); });
  loopBtn.addEventListener('click', () => {
    const p = patch();
    p.loop = !p.loop;
    hooks.edited();
    sync();
  });
  perfBtn.addEventListener('click', () => {
    const p = patch();
    p.performance = !p.performance;
    if (rawScore) {
      const cooked = prepareScore(rawScore, p);
      hooks.host.loadScore(cooked);
      bakeRoll(cooked);
    }
    hooks.edited();
    sync();
  });
  tempo.addEventListener('input', () => {
    patch().tempo = +tempo.value;
    hooks.edited();
  });
  document.getElementById('hepRand').addEventListener('click', () => {
    const next = randomizeGentle(patch(), (Math.random() * 1e9) | 0);
    commit(next);
    sync();
  });
  document.getElementById('hepSnapA').addEventListener('click', () => {
    patch().snapA = captureSnap(patch());
    hooks.edited();
    if (hooks.toast) hooks.toast('Stored A');
  });
  document.getElementById('hepSnapB').addEventListener('click', () => {
    patch().snapB = captureSnap(patch());
    hooks.edited();
    if (hooks.toast) hooks.toast('Stored B');
  });
  morph.addEventListener('input', () => {
    const next = morphTracks(patch(), +morph.value);
    commit(next);
    sync();
  });
  mute.addEventListener('click', () => {
    const t = liveTrack();
    t.mute = !t.mute;
    t.touched = true;
    hooks.edited();
    sync();
  });
  solo.addEventListener('click', () => {
    const t = liveTrack();
    t.solo = !t.solo;
    t.touched = true;
    hooks.edited();
    sync();
  });
  sliders.addEventListener('input', e => {
    const input = e.target;
    if (!input.dataset || !input.dataset.k) return;
    const t = liveTrack();
    t[input.dataset.k] = +input.value;
    t.touched = true;
    hooks.edited();
  });

  let drag = null;
  function hit(ev) {
    const rect = field.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const p = patch();
    let best = -1;
    let bestRank = 1e9;
    // Empty channels sit on the same point as a file's centered lead.
    // Prefer a channel that is actually in the file, then the orb drawn on top.
    p.tracks.forEach((t, i) => {
      const ox = (t.pan + 1) * 0.5 * (rect.width - 36) + 18;
      const oy = (1 - t.space) * (rect.height - 36) + 18;
      const d = Math.hypot(ox - x, oy - y);
      if (d > 28) return;
      const rank = d - (t.used ? 6 : 0);
      if (rank < bestRank - 0.01 || (Math.abs(rank - bestRank) <= 0.01 && i > best)) {
        bestRank = rank;
        best = i;
      }
    });
    return best;
  }
  function placeAt(i, ev) {
    const rect = field.getBoundingClientRect();
    const x = Math.min(rect.width - 18, Math.max(18, ev.clientX - rect.left));
    const y = Math.min(rect.height - 18, Math.max(18, ev.clientY - rect.top));
    const t = patch().tracks[i];
    t.pan = ((x - 18) / (rect.width - 36)) * 2 - 1;
    t.space = 1 - ((y - 18) / (rect.height - 36));
    t.placed = true;
    t.touched = true;
    hooks.edited();
    drawField();
  }
  field.addEventListener('pointerdown', ev => {
    const i = hit(ev);
    if (i < 0) return;
    drag = i;
    patch().live = i;
    field.setPointerCapture(ev.pointerId);
    placeAt(i, ev);
    sync();
  });
  field.addEventListener('pointermove', ev => { if (drag != null) placeAt(drag, ev); });
  field.addEventListener('pointerup', () => { drag = null; });
  field.addEventListener('pointercancel', () => { drag = null; });

  fetch(new URL('./heptode/midi/catalog.json', import.meta.url).href).then(r => r.json()).then(list => {
    catalog = list || [];
    catalog.forEach(row => {
      const o = document.createElement('option');
      o.value = row.file;
      o.textContent = row.title;
      song.appendChild(o);
    });
  }).catch(() => {});
  song.addEventListener('change', () => {
    const row = catalog.find(r => r.file === song.value);
    if (!row) return;
    fetch(new URL('./heptode/midi/' + row.file, import.meta.url).href).then(r => r.arrayBuffer()).then(buf => {
      takeBytes(new Uint8Array(buf), row.title);
    });
  });

  return { sync, loadBytes: takeBytes };
}
