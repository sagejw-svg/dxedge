// The master-bus strip: three bypassable processors and the WAV controls.
// The state lives in localStorage under filament_master, not in a device patch,
// because the bus sits after every device.

import { makeKnob } from './knob.js';
import { DIVS, MASTER_DEFAULT, masterView, mergeMaster, normalizeMaster } from './masterfx.js';
import { bytesToB64, downloadWav, encodeWav24, renderToWav, wavName } from './wav.js';

const KEY = 'filament_master';

function load(store) {
  try { return normalizeMaster(store.get(KEY, null)); } catch (e) { return normalizeMaster(null); }
}

export function mountMaster(api) {
  const host = api.host;
  let state = load(api.store);
  const knobs = {};

  host.innerHTML =
    '<div class="fxrow" id="fxTransport">' +
      '<span class="fxname">tempo</span><span class="knobs" id="fxTempo"></span>' +
      '<button type="button" class="chip" id="fxRec" aria-pressed="false">record</button>' +
      '<input id="wavSecs" type="number" min="0.1" max="600" step="0.1" value="4" aria-label="Render length in seconds">' +
      '<button type="button" class="btn small" id="wavGo">render wav</button>' +
      '<span class="fxstat" id="fxStat" aria-live="polite"></span>' +
    '</div>' +
    '<div class="fxrow" id="fxDelayRow">' +
      '<span class="fxname">delay</span>' +
      '<button type="button" class="chip sw" id="fxDelay" aria-pressed="false">off</button>' +
      '<button type="button" class="chip" id="fxSync" aria-pressed="true">sync</button>' +
      '<select id="fxDiv" class="btn small" aria-label="Delay division"></select>' +
      '<button type="button" class="chip" id="fxPing" aria-pressed="false">ping-pong</button>' +
      '<span class="knobs" id="fxDelayKn"></span>' +
    '</div>' +
    '<div class="fxrow" id="fxRevRow">' +
      '<span class="fxname">reverb</span>' +
      '<button type="button" class="chip sw" id="fxRev" aria-pressed="false">off</button>' +
      '<span class="knobs" id="fxRevKn"></span>' +
    '</div>' +
    '<div class="fxrow" id="fxCompRow">' +
      '<span class="fxname">comp</span>' +
      '<button type="button" class="chip sw" id="fxComp" aria-pressed="false">off</button>' +
      '<button type="button" class="chip" id="fxLim" aria-pressed="true">limit</button>' +
      '<span class="knobs" id="fxCompKn"></span>' +
    '</div>' +
    '<div class="note">Delay, reverb and the bus compressor sit on the master, after both devices. Bypass leaves the sound untouched. Record and render save a 24-bit, 44.1 kHz stereo WAV, up to 10 minutes.</div>';

  const $ = id => host.querySelector('#' + id) || document.getElementById(id);
  const divSel = $('fxDiv');
  DIVS.forEach(d => {
    const o = document.createElement('option');
    o.value = d[0]; o.textContent = d[2];
    divSel.appendChild(o);
  });

  const pct = v => Math.round(v * 100) + '%';
  function addKnob(box, group, key, label, opt) {
    const k = makeKnob($(box), {
      label, min: opt.min, max: opt.max, step: opt.step, value: state[group][key],
      def: MASTER_DEFAULT[group][key], fmt: opt.fmt, title: opt.title || label,
      onChange: v => { state[group][key] = v; commit(); },
    });
    knobs[group + '.' + key] = k;
    return k;
  }
  const tempoK = makeKnob($('fxTempo'), {
    label: 'bpm', min: 40, max: 240, step: 1, value: state.tempo, def: 120,
    fmt: v => Math.round(v) + '', title: 'Tempo for the synced delay. The host clock can drive this later.',
    onChange: v => { state.tempo = Math.round(v); commit(); },
  });

  addKnob('fxDelayKn', 'delay', 'time', 'time', { min: 1, max: 2000, step: 1, fmt: v => Math.round(v) + 'ms', title: 'Delay time when sync is off' });
  addKnob('fxDelayKn', 'delay', 'feedback', 'feedback', { min: 0, max: 0.95, step: 0.01, fmt: pct });
  addKnob('fxDelayKn', 'delay', 'mix', 'mix', { min: 0, max: 1, step: 0.01, fmt: pct });
  addKnob('fxDelayKn', 'delay', 'offset', 'R offset', { min: 0, max: 1, step: 0.01, fmt: v => v < 0.005 ? '0' : '×' + (1 + v).toFixed(2), title: 'Stretches the right delay. Ping-pong ignores it and alternates sides instead.' });
  addKnob('fxRevKn', 'reverb', 'size', 'size', { min: 0, max: 1, step: 0.01, fmt: pct, title: 'Room size: how long the tail rings' });
  addKnob('fxRevKn', 'reverb', 'damp', 'damp', { min: 0, max: 1, step: 0.01, fmt: pct, title: 'Darkens the tail' });
  addKnob('fxRevKn', 'reverb', 'mix', 'mix', { min: 0, max: 1, step: 0.01, fmt: pct });
  addKnob('fxRevKn', 'reverb', 'width', 'width', { min: 0, max: 1, step: 0.01, fmt: pct });
  addKnob('fxCompKn', 'comp', 'threshold', 'thresh', { min: -60, max: 0, step: 0.5, fmt: v => v.toFixed(1) + 'dB' });
  addKnob('fxCompKn', 'comp', 'ratio', 'ratio', { min: 1, max: 20, step: 0.1, fmt: v => v.toFixed(1) + ':1' });
  addKnob('fxCompKn', 'comp', 'attack', 'attack', { min: 0.1, max: 200, step: 0.1, fmt: v => (v < 10 ? v.toFixed(1) : Math.round(v)) + 'ms' });
  addKnob('fxCompKn', 'comp', 'release', 'release', { min: 5, max: 2000, step: 1, fmt: v => Math.round(v) + 'ms' });
  addKnob('fxCompKn', 'comp', 'makeup', 'makeup', { min: 0, max: 24, step: 0.1, fmt: v => (v > 0 ? '+' : '') + v.toFixed(1) + 'dB' });
  addKnob('fxCompKn', 'comp', 'ceiling', 'ceiling', { min: -24, max: 0, step: 0.1, fmt: v => v.toFixed(1) + 'dB', title: 'Limiter ceiling, used when limit is on' });

  function save() { try { api.store.set(KEY, state); } catch (e) {} }
  function push() { api.withEngine(() => { const eng = api.getEngine(); if (eng && eng.fx) eng.fx.set(state); }); }
  function commit() { state = normalizeMaster(state); save(); paint(); push(); }

  function paint() {
    const d = state.delay, r = state.reverb, c = state.comp;
    const set = (id, on, word) => { const b = $(id); b.setAttribute('aria-pressed', String(on)); if (word) b.textContent = word; };
    set('fxDelay', d.on, d.on ? 'on' : 'off');
    set('fxSync', d.sync);
    set('fxPing', d.ping);
    set('fxRev', r.on, r.on ? 'on' : 'off');
    set('fxComp', c.on, c.on ? 'on' : 'off');
    set('fxLim', c.limit);
    divSel.value = d.div;
    divSel.disabled = !d.sync;
    knobs['delay.time'].el.style.opacity = d.sync ? '0.45' : '';
    $('fxDelayRow').classList.toggle('fxoff', !d.on);
    $('fxRevRow').classList.toggle('fxoff', !r.on);
    $('fxCompRow').classList.toggle('fxoff', !c.on);
    const any = d.on || r.on || c.on;
    const pilot = document.getElementById('fxPilot');
    if (pilot) pilot.classList.toggle('off', !any);
    const sec = document.getElementById('mMaster');
    if (sec) sec.classList.toggle('off', !any);
  }

  function toggle(id, apply) {
    $(id).addEventListener('click', () => { apply(); commit(); });
  }
  toggle('fxDelay', () => { state.delay.on = !state.delay.on; });
  toggle('fxSync', () => { state.delay.sync = !state.delay.sync; });
  toggle('fxPing', () => { state.delay.ping = !state.delay.ping; });
  toggle('fxRev', () => { state.reverb.on = !state.reverb.on; });
  toggle('fxComp', () => { state.comp.on = !state.comp.on; });
  toggle('fxLim', () => { state.comp.limit = !state.comp.limit; });
  divSel.addEventListener('change', () => { state.delay.div = divSel.value; commit(); });

  // Touching a bypassed effect's knobs switches it on, same rule as the rest of the rack.
  [['fxDelayKn', 'delay'], ['fxRevKn', 'reverb'], ['fxCompKn', 'comp']].forEach(([id, group]) => {
    $(id).addEventListener('pointerdown', e => {
      if (e.target.closest('.sw')) return;
      if (!state[group].on) { state[group].on = true; commit(); }
    });
  });

  function refreshKnobs() {
    tempoK.set(state.tempo);
    Object.keys(knobs).forEach(path => {
      const [g, k] = path.split('.');
      knobs[path].set(state[g][k]);
    });
    paint();
  }

  function set(partial) {
    state = mergeMaster(state, partial);
    save();
    refreshKnobs();
    push();
    return masterView(state);
  }

  let recTimer = 0;
  function stat(t) { $('fxStat').textContent = t; }
  function engine() { return api.getEngine(); }

  async function recordStart() {
    const E = engine();
    if (!E || !E.fx) { stat('audio is not ready'); return false; }
    if (E.fx.recording()) return true;
    if (E.ctx && E.ctx.state !== 'running') { try { await E.ctx.resume(); } catch (e) {} }
    E.fx.recordStart();
    if (E.fx.onCap) { /* replaced below */ }
    E.fx.onCap = () => { stopRec(true); };
    $('fxRec').setAttribute('aria-pressed', 'true');
    $('fxRec').textContent = 'stop';
    stat('recording');
    clearInterval(recTimer);
    recTimer = setInterval(() => {
      if (!E.fx || !E.fx.recording()) return;
      const s = E.fx.recordedSeconds();
      stat('recording ' + (s < 10 ? s.toFixed(1) : Math.round(s)) + 's');
    }, 200);
    return true;
  }

  async function stopRec(download) {
    const E = engine();
    clearInterval(recTimer);
    $('fxRec').setAttribute('aria-pressed', 'false');
    $('fxRec').textContent = 'record';
    if (!E || !E.fx) return null;
    const was = E.fx.recording() || E.fx.recordedSeconds() > 0;
    const samples = await E.fx.recordStop();
    const bytes = encodeWav24(samples.L, samples.R);
    const name = wavName('filament');
    if (download && samples.L.length) downloadWav(bytes, name);
    stat(samples.L.length ? (was ? 'saved ' + name : name) : 'nothing recorded');
    return { bytes, frames: samples.L.length, sampleRate: 44100, bits: 24, channels: 2, name };
  }

  $('fxRec').addEventListener('click', () => {
    const E = engine();
    if (E && E.fx && E.fx.recording()) stopRec(true);
    else recordStart();
  });

  let rendering = false;
  $('wavGo').addEventListener('click', async () => {
    if (rendering) return;
    rendering = true;
    $('wavGo').disabled = true;
    const seconds = Math.max(0.1, Math.min(600, +$('wavSecs').value || 4));
    $('wavSecs').value = String(seconds);
    stat('rendering ' + seconds + 's…');
    try {
      const notes = api.getNotes();
      const events = (notes.length ? notes : [60]).map(n => ({ at: 0, t: 'on', n, v: 0.8 }));
      const w = await renderToWav({ patch: api.getPatch(), events, seconds, rack: true, master: state });
      const name = downloadWav(w.bytes, wavName('filament'));
      stat('saved ' + name + ' · ' + w.frames + ' frames');
    } catch (e) {
      console.error(e);
      stat('render failed');
      if (api.toast) api.toast('Could not render the WAV.');
    }
    rendering = false;
    $('wavGo').disabled = false;
  });

  refreshKnobs();
  push();

  return {
    get: () => masterView(state),
    set,
    recordStart,
    async recordStop() {
      const w = await stopRec(false);
      if (!w) return null;
      return { b64: bytesToB64(w.bytes), bytes: w.bytes.length, frames: w.frames, sr: 44100, bits: 24, channels: 2, name: w.name };
    },
    async renderWav(opts) {
      const w = await renderToWav(Object.assign({ patch: api.getPatch(), master: state, rack: true }, opts));
      return {
        b64: bytesToB64(w.bytes), bytes: w.bytes.length, frames: w.frames,
        sr: w.sampleRate, bits: w.bits, channels: w.channels, seconds: w.seconds,
      };
    },
  };
}
