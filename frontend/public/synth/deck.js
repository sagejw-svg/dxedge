// The MIDI deck: a recorder, a MIDI file importer and a player, plus Render WAV.
// It sits in a strip above the keyboard and talks to the page through a small api object, so the
// page keeps owning the keys, the devices and the patches.
//
// Recorder: Rec arms; the first note starts the take. Everything the page plays (on-screen keys,
// computer keys, a MIDI keyboard) reaches rec(dev, msg) with the device it went to.
// Player: schedules ahead from the main thread (150 ms lookahead, a 25 ms timer) and sends each
// event to its device with at: set to its exact frame (pb: true marks it as playback, so Stop can
// flush what has not landed yet). A device that is not on the keyboard is held awake while the
// player runs. Tempo 50 to 200% scales the file's own tempo map; a change lands at the end of
// what is already scheduled, so nothing is ever sent out of order.
import { readSMF, songOf, writeSMF, bytesOf } from './smf.js';
import { midiEvent, renderOffline } from './engine.js';

export const DEVS = ['filament', 'cathode'];
const LOOK = 0.15, TICK = 25, MAX_S = 600;
const NAMEOF = { filament: 'Filament', cathode: 'Cathode' };
const pad = n => String(n).padStart(2, '0');
export const stamp = (d = new Date()) => d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes());
export const fmtT = s => { s = Math.max(0, s || 0); const m = Math.floor(s / 60); return m + ':' + (s - 60 * m).toFixed(1).padStart(4, '0'); };

// Default device for each part of an imported song (see docs/filament.md, MIDI files):
// our own exports name their tracks "Filament: ..." or "Cathode: ..." and go back where they came
// from; channel 10 (drums) is off; one melodic part goes to the selected device; with several, the
// first goes to Filament, the lowest-pitched of the others to Cathode, the rest to Filament.
// A part with no notes follows the note part on its channel, or is off.
export function defaultAssign(parts, selected) {
  const out = parts.map(() => null);
  const named = parts.map(p => /^\s*cathode\s*:/i.test(p.name) ? 'cathode' : /^\s*filament\s*:/i.test(p.name) ? 'filament' : null);
  const mel = [];
  parts.forEach((p, i) => {
    if (p.chans.includes(10) && !named[i]) out[i] = 'off';
    else if (named[i]) out[i] = named[i];
    else if (p.notes) mel.push(i);
  });
  if (mel.length === 1) out[mel[0]] = selected === 'cathode' ? 'cathode' : 'filament';
  else if (mel.length > 1) {
    mel.forEach(i => { out[i] = 'filament'; });
    const rest = mel.slice(1).sort((a, b) => parts[a].mean - parts[b].mean);
    if (!named.includes('cathode')) out[rest[0]] = 'cathode';
  }
  parts.forEach((p, i) => {
    if (out[i]) return;
    const j = parts.findIndex((q, k) => q.notes && out[k] && out[k] !== 'off' && q.chans.some(c => p.chans.includes(c)));
    out[i] = j >= 0 ? out[j] : 'off';
  });
  return out;
}

// A song for the player: [{time, dev, m}] sorted, with m an engine message.
export function scoreOfSong(song, assign) {
  const ev = [];
  song.parts.forEach((p, i) => {
    const d = assign[i]; if (!d || d === 'off') return;
    p.events.forEach(e => { const m = midiEvent(e.data); if (m && m.t !== 'cc' && m.t !== 'panic') ev.push({ time: e.time, dev: d, m }); });
  });
  ev.sort((a, b) => a.time - b.time || (a.m.t === 'off' ? 0 : 1) - (b.m.t === 'off' ? 0 : 1));
  return ev;
}

export function encodeWav(L, R, sr) {
  const n = L.length, buf = new ArrayBuffer(44 + n * 4), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true);
  v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 4, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    const a = Math.max(-1, Math.min(1, L[i])), b = Math.max(-1, Math.min(1, R[i]));
    v.setInt16(o, Math.round(a * 32767), true); v.setInt16(o + 2, Math.round(b * 32767), true); o += 4;
  }
  return new Uint8Array(buf);
}

function download(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function createDeck(api) {
  const $ = id => document.getElementById(id);
  const now = () => performance.now() / 1000;
  // ---------------------------------------------------------------- recorder
  let rendering = false;
  const T = { armed: false, rec: false, t0: 0, events: [], length: 0, names: {}, ctl: {}, held: {} };
  DEVS.forEach(d => { T.ctl[d] = { bend: 0, mw: 0, sus: false, at: 0 }; });
  function rec(dev, m) {
    const c = T.ctl[dev];
    if (m.t === 'bend') c.bend = m.v; else if (m.t === 'mw') c.mw = m.v; else if (m.t === 'sus') c.sus = !!m.on; else if (m.t === 'at') c.at = m.v;
    if (!T.armed && !T.rec) return;
    const t = now();
    if (!T.rec) {
      if (m.t !== 'on') return;
      T.rec = true; T.armed = false; T.t0 = t; T.events = []; T.names = {}; T.held = {};
      if (c.sus) T.events.push({ time: 0, dev, m: { t: 'sus', on: true } });
      if (c.bend) T.events.push({ time: 0, dev, m: { t: 'bend', v: c.bend } });
      if (c.mw) T.events.push({ time: 0, dev, m: { t: 'mw', v: c.mw } });
    }
    if (!T.names[dev]) T.names[dev] = api.patchName(dev);
    const h = T.held[dev] || (T.held[dev] = new Set());
    if (m.t === 'on') h.add(m.n); else if (m.t === 'off') h.delete(m.n);
    T.events.push({ time: t - T.t0, dev, m: Object.assign({}, m) });
    showTake();
  }
  function stopRec() {
    if (T.armed) { T.armed = false; showTake(); return; }
    if (!T.rec) return;
    T.rec = false; T.length = now() - T.t0;
    Object.keys(T.held).forEach(d => T.held[d].forEach(n => T.events.push({ time: T.length, dev: d, m: { t: 'off', n } })));
    T.held = {};
    showTake();
  }
  const takeNotes = () => T.events.filter(e => e.m.t === 'on').length;
  function showTake() {
    $('recBtn').setAttribute('aria-pressed', String(T.armed || T.rec));
    $('recBtn').classList.toggle('live', T.rec);
    const has = !T.rec && T.events.length > 0;
    $('wavBtn').disabled = rendering || !(Fi.song || has);
    $('playTake').disabled = !has; $('expBtn').disabled = !has; $('clrBtn').disabled = !(has || T.armed);
    $('takeStat').textContent = T.armed ? 'armed: play a note' : T.rec ? 'recording ' + fmtT(now() - T.t0) + ', ' + takeNotes() + ' notes'
      : T.events.length ? 'take ' + fmtT(T.length) + ', ' + takeNotes() + ' notes' : 'no take';
  }
  function takeParts() {
    return DEVS.filter(d => T.events.some(e => e.dev === d)).map(d => ({
      name: NAMEOF[d] + ': ' + (T.names[d] || api.patchName(d)), ch: d === 'cathode' ? 1 : 0,
      events: T.events.filter(e => e.dev === d).map(e => ({ time: e.time, data: bytesOf(e.m, d === 'cathode' ? 1 : 0) })).filter(e => e.data),
    }));
  }
  const exportBytes = () => writeSMF({ bpm: 120, parts: takeParts() });

  // ---------------------------------------------------------------- import
  const Fi = { name: '', song: null, assign: [] };
  function importBytes(bytes, name) {
    let song;
    try { song = songOf(readSMF(bytes)); }
    catch (e) { $('fileStat').textContent = (name || 'That file') + ': ' + e.message; api.toast(e.message, 5000); return false; }
    if (!song.parts.some(p => p.notes)) { $('fileStat').textContent = (name || 'That file') + ' has no notes to play.'; return false; }
    if (P.playing) stop();
    Fi.name = name || 'file.mid'; Fi.song = song; Fi.assign = defaultAssign(song.parts, api.dev());
    openBody(true); showFile();
    return true;
  }
  async function importFile(f) {
    if (!f) return;
    if (f.size > 4e6) { api.toast('That file is over 4 MB; MIDI files are much smaller. Is it a MIDI file?', 5000); return; }
    importBytes(new Uint8Array(await f.arrayBuffer()), f.name);
  }
  function showFile() {
    const s = Fi.song, host = $('trackList');
    $('playFile').disabled = !s; $('wavBtn').disabled = rendering || !(s || T.events.length);
    if (!s) { $('fileStat').textContent = 'Drop a .mid file here, or press import.'; host.innerHTML = ''; return; }
    if (!P.playing) $('posV').textContent = fmtT(0) + ' / ' + fmtT(s.length);
    $('fileStat').textContent = Fi.name + ' · ' + fmtT(s.length) + ' · ' + Math.round(s.bpm) + ' BPM · ' + s.parts.length + (s.parts.length === 1 ? ' track' : ' tracks');
    host.innerHTML = '';
    s.parts.forEach((p, i) => {
      const row = document.createElement('div'); row.className = 'trk';
      const nm = document.createElement('span'); nm.className = 'tn'; nm.textContent = p.name;
      const meta = document.createElement('span'); meta.className = 'tm'; meta.textContent = 'ch ' + p.chans.join(',') + ' · ' + p.notes + ' notes';
      const ch = document.createElement('span'); ch.className = 'chips';
      ['filament', 'cathode', 'off'].forEach(d => {
        const b = document.createElement('button'); b.className = 'chip'; b.dataset.trk = i; b.dataset.v = d;
        b.textContent = d === 'off' ? 'off' : NAMEOF[d]; b.setAttribute('aria-pressed', String(Fi.assign[i] === d));
        b.setAttribute('aria-label', p.name + ': ' + (d === 'off' ? 'off' : 'play on ' + NAMEOF[d]));
        b.addEventListener('click', () => setAssign(i, d));
        ch.appendChild(b);
      });
      row.append(nm, meta, ch); host.appendChild(row);
    });
  }
  function setAssign(i, d) {
    if (!Fi.song || i < 0 || i >= Fi.assign.length) return;
    Fi.assign[i] = d; showFile();
    if (P.playing && P.src === 'file') { const pos = P.schedPos; stop(); play('file', pos); }
  }

  // ---------------------------------------------------------------- player
  const P = { playing: false, src: null, ev: [], length: 0, idx: 0, rate: 1, newRate: null, loop: false,
    anchorCtx: 0, anchorPos: 0, schedPos: 0, timer: 0, sounding: {}, touched: {}, used: [], lit: new Map(), timeouts: new Set() };
  const ctxAt = pos => P.anchorCtx + (pos - P.anchorPos) / P.rate;
  const posNow = () => { const c = api.ctx(); return c ? P.anchorPos + (c.currentTime - P.anchorCtx) * P.rate : 0; };
  function lightLater(n, on, t) {
    const c = api.ctx(), ms = Math.max(0, (t - c.currentTime) * 1000);
    const id = setTimeout(() => { P.timeouts.delete(id); const k = (P.lit.get(n) || 0) + (on ? 1 : -1); if (k > 0) P.lit.set(n, k); else P.lit.delete(n); api.lit(n); }, ms);
    P.timeouts.add(id);
  }
  function send(e, t) {
    const E = api.engine(), c = api.ctx();
    E.sendTo(e.dev, Object.assign({}, e.m, { at: Math.round(t * c.sampleRate), pb: true }));
    const s = P.sounding[e.dev];
    if (e.m.t === 'on') { s.set(e.m.n, (s.get(e.m.n) || 0) + 1); P.touched[e.dev].add(e.m.n); lightLater(e.m.n, true, t); }
    else if (e.m.t === 'off' && s.has(e.m.n)) { const k = s.get(e.m.n) - 1; if (k > 0) s.set(e.m.n, k); else s.delete(e.m.n); lightLater(e.m.n, false, t); }
  }
  function releaseAt(t) {         // note offs for whatever playback still holds, sustain off
    P.used.forEach(d => {
      P.sounding[d].forEach((k, n) => { for (let i = 0; i < k; i++) send({ dev: d, m: { t: 'off', n } }, t); });
      api.engine().sendTo(d, { t: 'sus', on: false, at: Math.round(t * api.ctx().sampleRate), pb: true });
    });
  }
  function pump() {
    if (!P.playing) return;
    const c = api.ctx();
    for (let guard = 0; guard < 4; guard++) {
      const horizon = P.anchorPos + (c.currentTime + LOOK - P.anchorCtx) * P.rate;
      while (P.idx < P.ev.length && P.ev[P.idx].time <= horizon) { const e = P.ev[P.idx++]; send(e, ctxAt(e.time)); P.schedPos = e.time; }
      if (horizon > P.schedPos) P.schedPos = Math.min(horizon, P.length);
      if (P.newRate) {         // a tempo change lands where scheduling has reached
        P.anchorCtx = ctxAt(P.schedPos); P.anchorPos = P.schedPos; P.rate = P.newRate; P.newRate = null;
      }
      if (P.idx < P.ev.length || horizon < P.length) break;
      const tEnd = ctxAt(P.length);
      if (!P.ended) { releaseAt(tEnd); P.ended = true; }
      if (P.loop && P.length > 0.05) { P.anchorCtx = tEnd; P.anchorPos = 0; P.schedPos = 0; P.idx = 0; P.ended = false; continue; }
      if (c.currentTime >= tEnd) { stop(); return; }
      break;
    }
    $('posV').textContent = fmtT(Math.min(P.length, Math.max(0, posNow()))) + ' / ' + fmtT(P.length);
  }
  function play(src, from = 0) {
    const ev = src === 'take' ? T.events.slice().sort((a, b) => a.time - b.time) : Fi.song ? scoreOfSong(Fi.song, Fi.assign) : [];
    if (!ev.length) { api.toast(src === 'take' ? 'Nothing recorded yet.' : 'Every track is off.'); return false; }
    if (P.playing) stop();
    if (T.rec || T.armed) stopRec();
    api.wake();
    api.withEngine(() => {
      const c = api.ctx(), E = api.engine();
      P.src = src; P.ev = ev; P.length = src === 'take' ? Math.max(T.length, ev[ev.length - 1].time) : Fi.song.length;
      P.used = DEVS.filter(d => ev.some(e => e.dev === d));
      P.used.forEach(d => { P.sounding[d] = new Map(); P.touched[d] = new Set(); if (d !== api.dev()) E.setPatch(api.patchOf(d), true); E.playing(d, true); });
      P.rate = P.newRate || P.rate; P.newRate = null;
      P.idx = ev.findIndex(e => e.time >= from); if (P.idx < 0) P.idx = ev.length;
      P.anchorPos = from; P.schedPos = from; P.anchorCtx = c.currentTime + 0.06;
      P.playing = true; P.ended = false; P.last = src;
      P.timer = setInterval(pump, TICK); pump();
      showPlay();
    });
    return true;
  }
  function stopPlayback() {
    if (!P.playing) return;
    P.playing = false; clearInterval(P.timer); P.timer = 0;
    const E = api.engine();
    P.used.forEach(d => {
      // Flush drops note offs that were scheduled but had not landed. Panic is all-notes-off,
      // so a note the tracker missed still goes silent. It does not stop a take being recorded.
      E.sendTo(d, { t: 'flush' });
      E.sendTo(d, { t: 'panic' });
      P.sounding[d].clear(); P.touched[d].clear();
      ['sus', 'bend', 'mw', 'at'].forEach(t => E.sendTo(d, t === 'sus' ? { t, on: false } : { t, v: 0 }));
      E.playing(d, false);
    });
    P.timeouts.forEach(id => clearTimeout(id)); P.timeouts.clear();
    const lit = [...P.lit.keys()]; P.lit.clear(); lit.forEach(n => api.lit(n));
    $('posV').textContent = fmtT(0) + ' / ' + fmtT(P.length);
    showPlay();
  }
  function stop() {
    if (T.rec || T.armed) stopRec();
    stopPlayback();
  }
  function showPlay() {
    $('playTake').setAttribute('aria-pressed', String(P.playing && P.src === 'take'));
    $('playFile').setAttribute('aria-pressed', String(P.playing && P.src === 'file'));
  }
  function setRate(pctV) {
    const r = Math.max(0.5, Math.min(2, pctV / 100));
    $('tempoV').textContent = Math.round(r * 100) + '%';
    if (P.playing) P.newRate = r; else P.rate = r;
  }

  // ---------------------------------------------------------------- render WAV
  function renderArgs(src) {
    const ev = src === 'take' ? T.events : Fi.song ? scoreOfSong(Fi.song, Fi.assign) : [];
    const rate = P.newRate || P.rate;
    const len = (src === 'take' ? T.length : Fi.song.length) / rate;
    return {
      patches: { filament: api.patchOf('filament'), cathode: api.patchOf('cathode') }, device: api.dev(),
      events: ev.map(e => Object.assign({ at: e.time / rate, dev: e.dev }, e.m)).filter(e => e.at < MAX_S),
      seconds: Math.min(MAX_S, len + 2), capped: len + 2 > MAX_S, sampleRate: 48000,
    };
  }
  async function renderWav() {
    if (rendering) return;
    const src = (P.last === 'take' && T.events.length) || !Fi.song ? 'take' : 'file';
    if (src === 'take' && !T.events.length) return;
    const a = renderArgs(src); rendering = true; $('wavBtn').disabled = true;
    const note = t => { $('wavStat').textContent = t; };
    note('rendering 0%' + (a.capped ? ' (capped at 10 minutes)' : ''));
    try {
      const buf = await renderOffline(Object.assign({}, a, { onProgress: f => note('rendering ' + Math.round(f * 100) + '%') }));
      const wav = encodeWav(buf.getChannelData(0), buf.getChannelData(1), buf.sampleRate);
      const base = src === 'file' ? Fi.name.replace(/\.(mid|midi)$/i, '').replace(/[^\w.-]+/g, '-').slice(0, 40) : 'take';
      download(wav, 'filament-' + base + '-' + stamp() + '.wav', 'audio/wav');
      note('rendered ' + fmtT(buf.duration) + ', ' + (wav.length / 1048576).toFixed(1) + ' MB');
    } catch (e) { note('render failed: ' + e.message); }
    rendering = false; $('wavBtn').disabled = false;
  }

  // ---------------------------------------------------------------- the strip
  function openBody(on) { $('deckBody').hidden = !on; $('deckBtn').setAttribute('aria-expanded', String(on)); }
  $('recBtn').addEventListener('click', () => {
    if (T.armed || T.rec) { stopRec(); return; }
    if (P.playing && P.src === 'take') stop();
    T.armed = true; showTake();
  });
  $('stopBtn').addEventListener('click', () => { stopRec(); stop(); });
  $('playTake').addEventListener('click', () => (P.playing && P.src === 'take' ? stop() : play('take')));
  $('playFile').addEventListener('click', () => (P.playing && P.src === 'file' ? stop() : play('file')));
  $('clrBtn').addEventListener('click', () => { if (P.playing && P.src === 'take') stop(); T.armed = false; T.rec = false; T.events = []; T.length = 0; showTake(); showFile(); });
  $('expBtn').addEventListener('click', () => { if (T.events.length) download(exportBytes(), 'filament-take-' + stamp() + '.mid', 'audio/midi'); });
  $('impBtn').addEventListener('click', () => $('impIn').click());
  $('impIn').addEventListener('change', e => { importFile(e.target.files[0]); e.target.value = ''; });
  $('deckBtn').addEventListener('click', () => openBody($('deckBody').hidden));
  $('loopBtn').addEventListener('click', () => { P.loop = !P.loop; $('loopBtn').setAttribute('aria-pressed', String(P.loop)); });
  $('tempoIn').addEventListener('input', e => setRate(+e.target.value));
  $('wavBtn').addEventListener('click', renderWav);
  const deck = $('deck');
  ['dragenter', 'dragover'].forEach(t => deck.addEventListener(t, e => { e.preventDefault(); deck.classList.add('drop'); }));
  ['dragleave', 'drop'].forEach(t => deck.addEventListener(t, () => deck.classList.remove('drop')));
  deck.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) importFile(f); });
  setInterval(() => { if (T.rec) showTake(); }, 250);
  showTake(); showFile();

  return {
    rec, stop, silence: stopPlayback, lit: n => (P.lit.get(n) || 0) > 0,
    // test hooks
    test: {
      importBytes: (arr, name) => importBytes(Uint8Array.from(arr), name),
      song: () => Fi.song && { name: Fi.name, length: Fi.song.length, bpm: Fi.song.bpm, parts: Fi.song.parts.map(p => ({ name: p.name, chans: p.chans, notes: p.notes, mean: p.mean })), assign: Fi.assign.slice() },
      assign: (i, d) => setAssign(i, d),
      take: () => ({ armed: T.armed, rec: T.rec, length: T.length, events: T.events.map(e => Object.assign({ time: e.time, dev: e.dev }, e.m)) }),
      arm: () => { T.armed = true; showTake(); }, stopRec,
      exportBytes: () => [...exportBytes()],
      play: src => play(src || 'file'), stop, playing: () => P.playing, position: () => posNow(), rate: () => P.rate,
      sounding: () => { const o = {}; P.used.forEach(d => { o[d] = [...(P.sounding[d] || new Map()).keys()]; }); return o; },
      renderArgs: src => { const a = renderArgs(src || (Fi.song ? 'file' : 'take')); return a; },
      encodeWav: (secs, sr) => { const n = Math.round(secs * sr), L = new Float32Array(n), R = new Float32Array(n); for (let i = 0; i < n; i++) { L[i] = Math.sin(i / 10) * 0.5; R[i] = -L[i]; } return [...encodeWav(L, R, sr).slice(0, 48)].concat([encodeWav(L, R, sr).length]); },
    },
  };
}
