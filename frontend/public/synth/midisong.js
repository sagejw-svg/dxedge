// A song the library player can route and schedule.
//
// Parsing is @tonejs/midi (MIT, vendored). The musical clock is quarter-note
// beats (ticks / ppq), so the rack transport's tempo is the playback tempo.
// This file does not touch the DOM.

import { Midi } from './vendor/tonejs-midi.js';
import { midiEvent } from './engine.js';
import { clampTempo } from './transport.js';

function fail(msg) { const e = new Error(msg); e.player = true; throw e; }

// bytes (Uint8Array or a number array) -> a plain song.
// tracks: one row per part that has notes. channels: 1-16.
// events: { beat, ch, data } in beat order, note offs before note ons at the same beat.
export function parseMidi(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input || []);
  let midi;
  try { midi = new Midi(bytes); }
  catch (e) {
    const msg = String((e && e.message) || e || '');
    if (/smpte|timecode|division/i.test(msg)) fail('This MIDI file uses SMPTE time code timing, which the player does not read. Re-save it with ticks per quarter note.');
    fail('This is not a MIDI file the player can read.');
  }
  const ppq = midi.header.ppq || 480;
  const tempos = midi.header.tempos || [];
  // MIDI tempo is stored as integer microseconds, so the recovered BPM is a hair off an integer.
  const bpm = tempos.length && tempos[0].bpm > 0 ? Math.round(tempos[0].bpm * 100) / 100 : 120;
  const sigs = midi.header.timeSignatures || [];
  const timeSig = sigs.length ? [sigs[0].timeSignature[0], sigs[0].timeSignature[1]] : [4, 4];
  const tracks = [];
  const events = [];
  (midi.tracks || []).forEach(tr => {
    if (!tr.notes || !tr.notes.length) return;
    const ch = (tr.channel == null ? 0 : tr.channel) + 1;
    if (ch < 1 || ch > 16) return;
    const pitches = tr.notes.map(note => note.midi);
    tracks.push({
      name: (tr.name || '').trim() || ('Channel ' + ch),
      channel: ch,
      notes: tr.notes.length,
      lo: Math.min.apply(null, pitches),
      hi: Math.max.apply(null, pitches),
    });
    tr.notes.forEach(note => {
      const b0 = note.ticks / ppq;
      const b1 = (note.ticks + note.durationTicks) / ppq;
      const vel = Math.max(1, Math.min(127, Math.round((note.velocity || 0) * 127)));
      const n = note.midi & 127;
      events.push({ beat: b0, ch, data: [0x90 | (ch - 1), n, vel] });
      events.push({ beat: b1, ch, data: [0x80 | (ch - 1), n, 0] });
    });
    const ccs = tr.controlChanges || {};
    [1, 64].forEach(num => {
      const list = ccs[num];
      if (!list || !list.length) return;
      list.forEach(cc => {
        const v = Math.max(0, Math.min(127, Math.round((cc.value || 0) * 127)));
        events.push({ beat: cc.ticks / ppq, ch, data: [0xB0 | (ch - 1), num, v] });
      });
    });
    (tr.pitchBends || []).forEach(pb => {
      const scaled = Math.max(-8192, Math.min(8191, Math.round((pb.value || 0) * 8192)));
      const raw = scaled + 8192;
      events.push({ beat: pb.ticks / ppq, ch, data: [0xE0 | (ch - 1), raw & 0x7f, (raw >> 7) & 0x7f] });
    });
  });
  if (!events.length) fail('This MIDI file has no notes to play.');
  events.sort((a, b) => a.beat - b.beat || ((a.data[0] & 0xf0) === 0x80 ? 0 : 1) - ((b.data[0] & 0xf0) === 0x80 ? 0 : 1));
  const channels = [];
  tracks.forEach(t => { if (!channels.includes(t.channel)) channels.push(t.channel); });
  channels.sort((a, b) => a - b);
  const beats = events[events.length - 1].beat;
  return {
    name: (midi.name || '').trim(),
    bpm, ppq, timeSig, beats,
    seconds: beats * 60 / bpm,
    tracks, channels, events,
  };
}

// channels: 1-16 present in the file. ids: instrument ids that can take MIDI
// (filament, cathode, dekatron, ...). Channel 10 goes to Dekatron when that
// device is registered, otherwise to an id named drums, otherwise off. The
// first melodic channel goes to Filament, the second to Cathode when both
// exist, and the rest to Filament.
export function defaultRoute(channels, ids) {
  const have = ids || [];
  const has = id => have.indexOf(id) >= 0;
  const musical = channels.filter(c => c !== 10);
  const route = {};
  const lead = has('filament') ? 'filament' : (have.find(id => id !== 'drums' && id !== 'dekatron') || 'off');
  const second = has('filament') && has('cathode') ? 'cathode' : lead;
  const drums = has('dekatron') ? 'dekatron' : (has('drums') ? 'drums' : 'off');
  channels.forEach(ch => {
    if (ch === 10) route[ch] = drums;
    else route[ch] = musical.indexOf(ch) === 1 ? second : lead;
  });
  return route;
}

// The events renderOffline / the live scheduler play, at the transport tempo.
// Quarter beats become seconds at that tempo. Channels routed off are dropped.
export function scoreOf(song, route, tempo) {
  if (!song) return [];
  const spb = 60 / clampTempo(tempo);
  const out = [];
  song.events.forEach(e => {
    const dest = route[e.ch];
    if (!dest || dest === 'off') return;
    const m = midiEvent(e.data);
    if (!m || m.t === 'cc' || m.t === 'panic') return;
    out.push(Object.assign({ at: e.beat * spb, beat: e.beat, dev: dest }, m));
  });
  out.sort((a, b) => a.at - b.at || (a.t === 'off' ? 0 : 1) - (b.t === 'off' ? 0 : 1));
  return out;
}
