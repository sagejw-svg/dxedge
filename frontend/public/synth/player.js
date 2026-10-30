// MIDI library player. A song (a bundled file, or one the user opens or drops)
// plays through the rack transport: play, stop and tempo are the host clock,
// and each MIDI channel goes to a device (Filament, Cathode, Dekatron for
// channel 10 when that device is registered, or off).
//
// Scheduling looks ahead 150 ms, the same idea as the deck, but the clock is
// host.transport rather than a private timer tempo. Events are stamped with
// their AudioContext frame so the worklet plays them on time.

import { parseMidi, defaultRoute, scoreOf } from './midisong.js';
import { midiEvent } from './engine.js';
import { voiceForNote } from './drums.js';

const LOOK = 0.15, TICK = 25;
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
const fmt = s => { s = Math.max(0, s || 0); const m = Math.floor(s / 60); return m + ':' + (s - 60 * m).toFixed(1).padStart(4, '0'); };

export function createPlayer(api) {
  let song = null, route = {}, meta = null, loop = false;
  let catalog = [], catalogReady = false, catalogError = '';
  let loadToken = 0;
  let playing = false, timer = 0, idx = 0, anchor = null, pendingTempo = null, schedBeat = 0;
  let unsub = null;
  const sounding = {}, touched = {}, woken = new Set();
  const lit = new Map(), timeouts = new Set();

  function targets() {
    const list = (api.devices ? api.devices() : []).filter(d => d && d.instrument && d.midiInput);
    return list.concat([{ id: 'off', name: 'off' }]);
  }
  function ids() { return targets().map(t => t.id).filter(id => id !== 'off'); }
  function tempoNow() {
    const E = api.engine();
    return E ? E.transport.state().tempo : (song ? song.bpm : 120);
  }
  function beatNow() {
    if (!anchor || !api.ctx()) return 0;
    const spb = 60 / anchor.tempo;
    return anchor.beat + (api.ctx().currentTime - anchor.time) / spb;
  }
  function timeAt(beat) {
    return anchor.time + (beat - anchor.beat) * (60 / anchor.tempo);
  }
  function routed() {
    if (!song) return [];
    const out = [];
    song.events.forEach(e => {
      const dest = route[e.ch];
      if (!dest || dest === 'off') return;
      const m = midiEvent(e.data);
      if (!m || m.t === 'cc' || m.t === 'panic') return;
      out.push({ beat: e.beat, dev: dest, m });
    });
    return out;
  }
  function lightLater(n, on, t) {
    const c = api.ctx(); if (!c) return;
    const ms = Math.max(0, (t - c.currentTime) * 1000);
    const id = setTimeout(() => {
      timeouts.delete(id);
      const k = (lit.get(n) || 0) + (on ? 1 : -1);
      if (k > 0) lit.set(n, k); else lit.delete(n);
      api.lit(n);
    }, ms);
    timeouts.add(id);
  }
  function deliver(dev, msg, audioTime) {
    const E = api.engine(), c = api.ctx();
    if (!E || !c) return;
    const framed = Object.assign({}, msg, { at: Math.round(audioTime * c.sampleRate), pb: true });
    if (dev === 'dekatron') {
      if (msg.t === 'on') {
        const voice = voiceForNote(msg.n);
        const node = E.nodes.dekatron;
        if (voice && node && node.port) node.port.postMessage({ t: 'trig', voice, v: msg.v == null ? 0.9 : msg.v, at: framed.at });
      }
    } else if (dev === 'filament' || dev === 'cathode') E.sendTo(dev, framed);
    else if (E.devices[dev]) E.devices[dev].midi(framed);
    if (msg.t === 'on') {
      const s = sounding[dev] || (sounding[dev] = new Map());
      s.set(msg.n, (s.get(msg.n) || 0) + 1);
      (touched[dev] || (touched[dev] = new Set())).add(msg.n);
      lightLater(msg.n, true, audioTime);
    } else if (msg.t === 'off') {
      const s = sounding[dev];
      if (s && s.has(msg.n)) { const k = s.get(msg.n) - 1; if (k > 0) s.set(msg.n, k); else s.delete(msg.n); }
      lightLater(msg.n, false, audioTime);
    }
  }
  function silence() {
    const E = api.engine();
    timeouts.forEach(id => clearTimeout(id)); timeouts.clear();
    if (E) Object.keys(touched).forEach(d => {
      if (d === 'filament' || d === 'cathode') {
        E.sendTo(d, { t: 'flush' });
        E.sendTo(d, { t: 'panic' });
        touched[d].forEach(n => E.sendTo(d, { t: 'off', n }));
        E.sendTo(d, { t: 'sus', on: false });
        E.sendTo(d, { t: 'bend', v: 0 });
        E.sendTo(d, { t: 'mw', v: 0 });
        E.sendTo(d, { t: 'at', v: 0 });
        E.playing(d, false);
      } else if (d === 'dekatron') {
        // Only after this player sent it hits. A panic also disarms the step pattern, and at a
        // play the pattern has just been armed by the same transport event (review R1030-2).
        const node = E.nodes.dekatron;
        if (touched[d].size && node && node.port) node.port.postMessage({ t: 'panic' });
      } else if (E.devices[d]) {
        touched[d].forEach(n => E.devices[d].midi({ t: 'off', n }));
        E.devices[d].midi({ t: 'sus', on: false });
      }
      if (sounding[d]) sounding[d].clear();
      touched[d].clear();
    });
    const keys = [...lit.keys()]; lit.clear(); keys.forEach(n => api.lit(n));
  }
  function arm(devs) {
    const E = api.engine(); if (!E) return;
    devs.forEach(d => {
      sounding[d] = sounding[d] || new Map();
      touched[d] = touched[d] || new Set();
      if (d === 'filament' || d === 'cathode') {
        if (d !== api.dev()) { const p = api.patchOf(d); if (p) E.setPatch(p, true); }
        E.playing(d, true);
      } else if (d !== 'dekatron' && api.wakeDevice) {
        // A hosted device off the rail sleeps and drops notes (review R1030-1).
        api.wakeDevice(d); woken.add(d);
      }
    });
  }
  function sleepWoken() {
    if (api.sleepDevice) woken.forEach(d => api.sleepDevice(d));
    woken.clear();
  }
  function show() {
    const on = !!(song && playing);
    $('libPlay').disabled = !song;
    $('libPlay').setAttribute('aria-pressed', String(on));
    $('libLoop').setAttribute('aria-pressed', String(loop));
    if (!song) {
      $('libStat').textContent = catalogError ? 'The sample library did not load.' : (catalogReady ? 'Pick a song, or drop a .mid file.' : 'Loading songs…');
      $('libPos').textContent = '';
      return;
    }
    const tempo = tempoNow();
    const who = meta && meta.composer ? meta.composer + ' · ' : '';
    const presetNames = meta && meta.presets ? Object.keys(meta.presets).map(k => meta.presets[k]).filter(Boolean) : [];
    const pre = presetNames.length ? ' · ' + presetNames.join(' / ') : '';
    $('libStat').textContent = who + (song.name || meta && meta.title || 'MIDI file') + pre + ' · ' + Math.round(tempo) + ' BPM · ' + song.channels.length + (song.channels.length === 1 ? ' channel' : ' channels');
    const beat = playing ? beatNow() : 0;
    const sec = Math.max(0, Math.min(song.beats, beat)) * 60 / tempo;
    const len = song.beats * 60 / tempo;
    $('libPos').textContent = fmt(sec) + ' / ' + fmt(len);
  }
  function paintLists() {
    const tracks = $('libTracks'), chans = $('libChannels');
    tracks.innerHTML = ''; chans.innerHTML = '';
    if (!song) return;
    song.tracks.forEach(t => {
      const row = document.createElement('div'); row.className = 'trk';
      const nm = document.createElement('span'); nm.className = 'tn'; nm.textContent = t.name;
      const metaEl = document.createElement('span'); metaEl.className = 'tm';
      metaEl.textContent = 'track · ch ' + t.channel + ' · ' + t.notes + ' notes';
      row.append(nm, metaEl); tracks.appendChild(row);
    });
    const choices = targets();
    song.channels.forEach(ch => {
      const row = document.createElement('div'); row.className = 'trk';
      const nm = document.createElement('span'); nm.className = 'tn'; nm.textContent = 'Channel ' + ch + (ch === 10 ? ' (drums)' : '');
      const parts = song.tracks.filter(t => t.channel === ch);
      const metaEl = document.createElement('span'); metaEl.className = 'tm';
      metaEl.textContent = parts.map(t => t.name).join(', ') + ' · ' + parts.reduce((n, t) => n + t.notes, 0) + ' notes';
      const chips = document.createElement('span'); chips.className = 'chips';
      choices.forEach(c => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'chip';
        b.textContent = c.name; b.dataset.ch = String(ch); b.dataset.dev = c.id;
        const on = (route[ch] || 'off') === c.id;
        b.setAttribute('aria-pressed', String(on));
        b.setAttribute('aria-label', 'Channel ' + ch + ': ' + (c.id === 'off' ? 'off' : 'play on ' + c.name));
        b.addEventListener('click', () => setRoute(ch, c.id));
        chips.appendChild(b);
      });
      row.append(nm, metaEl, chips); chans.appendChild(row);
    });
  }
  function openBody(on) { $('libBody').hidden = !on; $('libBtn').setAttribute('aria-expanded', String(!!on)); }
  function fillSelect() {
    const sel = $('libPick'); const cur = sel.value;
    sel.replaceChildren();
    const blank = document.createElement('option'); blank.value = ''; blank.textContent = 'Sample library…'; sel.appendChild(blank);
    catalog.forEach(item => {
      const o = document.createElement('option'); o.value = item.id; o.textContent = item.title; sel.appendChild(o);
    });
    sel.value = catalog.some(x => x.id === cur) ? cur : '';
  }
  function applySong(next, fileName, item) {
    if (playing) {
      const E = api.engine();
      if (E && E.transport.state().playing) E.transport.stop();
      else { playing = false; clearInterval(timer); timer = 0; silence(); sleepWoken(); }
    }
    song = next;
    meta = item || { title: fileName || next.name, composer: '' };
    if (item && item.presets && api.applyPresets) meta.presets = api.applyPresets(item.presets) || null;
    if (!song.name) song.name = (fileName || 'MIDI file').replace(/\.(mid|midi)$/i, '');
    route = defaultRoute(song.channels, ids());
    api.withEngine(() => {
      bind();
      api.setClock(song.bpm, song.timeSig);
      show();
    });
    openBody(true);
    paintLists();
    show();
    const sel = $('libPick');
    sel.value = item ? item.id : '';
    return true;
  }
  function loadBytes(bytes, fileName, item) {
    let next;
    try { next = parseMidi(bytes); }
    catch (e) {
      $('libStat').textContent = (fileName || 'That file') + ': ' + e.message;
      api.toast(e.message, 5000);
      return false;
    }
    return applySong(next, fileName, item);
  }
  async function loadId(id) {
    const item = catalog.find(x => x.id === id);
    if (!item) return false;
    const token = ++loadToken;
    $('libStat').textContent = 'Loading ' + item.title + '…';
    try {
      const res = await fetch(new URL('./midi/' + item.file, import.meta.url));
      if (!res.ok) throw new Error('The song file did not load.');
      const buf = new Uint8Array(await res.arrayBuffer());
      if (token !== loadToken) return false;
      return loadBytes(buf, item.file, item);
    } catch (e) {
      if (token !== loadToken) return false;
      const msg = e.message || 'The song file did not load.';
      $('libStat').textContent = msg; api.toast(msg, 5000); return false;
    }
  }
  async function importFile(f) {
    if (!f) return false;
    if (f.size > 4e6) { api.toast('That file is over 4 MB. MIDI files are much smaller.', 5000); return false; }
    try { return loadBytes(new Uint8Array(await f.arrayBuffer()), f.name, null); }
    catch (e) { api.toast('Could not read that file.', 4000); return false; }
  }
  function setRoute(ch, id) {
    if (!song || !song.channels.includes(ch)) return false;
    if (id !== 'off' && !ids().includes(id)) return false;
    route[ch] = id;
    paintLists();
    if (!playing) { show(); return true; }
    const b = Math.max(0, beatNow());
    const tempo = anchor.tempo;
    silence();
    const c = api.ctx();
    api.engine().transport.locate(b);
    anchor = { time: c.currentTime, beat: b, tempo };
    const evs = routed();
    idx = evs.findIndex(e => e.beat >= b - 1e-6);
    if (idx < 0) idx = evs.length;
    schedBeat = b;
    arm([...new Set(evs.map(e => e.dev))]);
    show();
    return true;
  }
  function pump() {
    if (!playing || !song || !anchor) return;
    const c = api.ctx(); if (!c) return;
    if (pendingTempo != null) {
      const b = schedBeat;
      anchor = { time: timeAt(b), beat: b, tempo: pendingTempo };
      pendingTempo = null;
    }
    const evs = routed();
    const spb = 60 / anchor.tempo;
    const horizon = beatNow() + LOOK / spb;
    while (idx < evs.length && evs[idx].beat <= horizon + 1e-9) {
      const e = evs[idx++];
      deliver(e.dev, e.m, timeAt(e.beat));
      schedBeat = e.beat;
    }
    if (horizon > schedBeat) schedBeat = Math.min(horizon, song.beats);
    if (idx >= evs.length && beatNow() >= song.beats - 1e-4) {
      if (loop && song.beats > 0.25) {
        api.engine().transport.locate(0);
        anchor = { time: c.currentTime, beat: 0, tempo: anchor.tempo };
        idx = 0; schedBeat = 0;
      } else if (c.currentTime >= timeAt(song.beats) - 0.02) {
        api.engine().transport.stop();
        return;
      }
    }
    show();
  }
  function startFrom(ev) {
    silence();
    const evs = routed();
    if (!evs.length) {
      api.toast('Every channel is off.');
      if (api.engine().transport.state().playing) api.engine().transport.stop();
      playing = false; show(); return;
    }
    arm([...new Set(evs.map(e => e.dev))]);
    anchor = { time: ev.time, beat: ev.beat, tempo: ev.tempo };
    idx = evs.findIndex(e => e.beat >= ev.beat - 1e-6);
    if (idx < 0) idx = evs.length;
    schedBeat = ev.beat;
    pendingTempo = null;
    playing = true;
    clearInterval(timer);
    timer = setInterval(pump, TICK);
    pump();
    show();
  }
  function onTransport(ev) {
    if (!song) { show(); return; }
    if (ev.type === 'play') startFrom(ev);
    else if (ev.type === 'stop') {
      playing = false; clearInterval(timer); timer = 0; anchor = null; silence(); sleepWoken(); show();
    } else if (ev.type === 'tempo') {
      if (playing) pendingTempo = ev.tempo;
      show();
    }
  }
  function bind() {
    const E = api.engine(); if (!E || unsub) return;
    unsub = E.transport.subscribe(onTransport);
  }
  api.withEngine(bind);

  function userPlay() {
    if (!song) { api.toast('Pick a song, or drop a .mid file.'); return false; }
    api.wake();
    api.withEngine(() => {
      // The engine exists before every rack device has attached, and the queued bind
      // waits for all of them. Subscribe now so the first press is not lost.
      bind();
      const t = api.engine().transport;
      if (t.state().playing) t.stop();
      t.locate(0);
      t.play();
    });
    return true;
  }
  function userStop() {
    api.withEngine(() => { api.engine().transport.stop(); show(); });
  }

  $('libBtn').addEventListener('click', () => openBody($('libBody').hidden));
  $('libPlay').addEventListener('click', userPlay);
  $('libStop').addEventListener('click', userStop);
  $('libLoop').addEventListener('click', () => { loop = !loop; show(); });
  $('libOpen').addEventListener('click', () => $('libIn').click());
  $('libIn').addEventListener('change', e => { importFile(e.target.files && e.target.files[0]); e.target.value = ''; });
  $('libPick').addEventListener('change', () => { const id = $('libPick').value; if (id) loadId(id); });
  const box = $('library');
  ['dragenter', 'dragover'].forEach(type => box.addEventListener(type, e => { e.preventDefault(); box.classList.add('drop'); }));
  ['dragleave', 'drop'].forEach(type => box.addEventListener(type, e => { if (type === 'dragleave' && box.contains(e.relatedTarget)) return; box.classList.remove('drop'); }));
  box.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) importFile(f); });

  const catalogP = fetch(new URL('./midi/catalog.json', import.meta.url))
    .then(r => { if (!r.ok) throw new Error('catalog'); return r.json(); })
    .then(list => { catalog = Array.isArray(list) ? list : []; fillSelect(); })
    .catch(() => { catalogError = 'The sample library did not load.'; })
    .then(() => { catalogReady = true; if (!song) show(); });

  show();

  const test = {
    ready: () => catalogReady,
    library: () => catalog.map(item => ({
      id: item.id, file: item.file, title: item.title, composer: item.composer,
      license: item.license, kind: item.kind || '', presets: item.presets || null,
    })),
    parse: arr => parseMidi(Uint8Array.from(arr)),
    importBytes: (arr, name) => loadBytes(Uint8Array.from(arr), name || 'file.mid', null),
    loadId: id => loadId(id),
    song: () => song && ({
      name: song.name, bpm: song.bpm, beats: song.beats, timeSig: song.timeSig.slice(),
      channels: song.channels.slice(),
      tracks: song.tracks.map(t => ({ name: t.name, channel: t.channel, notes: t.notes })),
      presets: meta && meta.presets || null,
    }),
    routing: () => Object.assign({}, route),
    route: (ch, id) => setRoute(+ch, id),
    choices: () => targets().map(t => t.id),
    score: () => scoreOf(song, route, tempoNow()).map(e => {
      const o = { at: e.at, beat: e.beat, dev: e.dev, t: e.t };
      if (e.n != null) o.n = e.n;
      if (e.v != null) o.v = e.v;
      if (e.on != null) o.on = e.on;
      return o;
    }),
    play: userPlay,
    stop: userStop,
    playing: () => playing,
    devices: () => (playing && song ? [...new Set(routed().map(e => e.dev).filter(d => d && d !== 'off'))] : []),
    loop: on => { if (on != null) { loop = !!on; show(); } return loop; },
  };
  return { lit: n => (lit.get(n) || 0) > 0, test, ready: catalogP };
}
