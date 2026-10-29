// Standard MIDI File reader and writer for Filament. Our own code, written from the published
// SMF 1.0 format description (chunks, variable-length quantities, running status, meta events).
// Pure functions: no DOM, no dependencies. Used by the page (import, export, the player) and by
// the tests.
//
// readSMF(bytes) -> { format, ppq, tracks: [{ name, events, endTick }], tempos, timeSig }
//   events: [{ tick, ch, data: [status, d1, d2] }] - only the channel events Filament plays:
//   note on and off (note on with velocity 0 becomes a note off), pitch bend, CC 1 (mod wheel),
//   CC 64 (sustain), channel pressure and poly pressure. Sysex, unknown metas and other channel
//   messages are skipped. Pass { wide: true } to also keep program change, CC 7 (volume),
//   CC 10 (pan), CC 11 (expression), the pitch-bend-range RPN (CC 101, 100, 6) and the
//   all-notes-off controllers (CC 120, 121, 123). The deck leaves the option off.
//   Throws an Error with a plain message for a file it cannot play.
// songOf(smf) -> { parts: [{ name, chans, notes, lo, hi, mean, events: [{ time, data }] }], length, bpm }
//   Times in seconds through the tempo map. A track that holds notes on several channels is
//   split into one part per channel (format 0 files carry a whole band in one track).
// writeSMF({ bpm, parts: [{ name, ch, events: [{ time, data }] }], length }) -> Uint8Array (length in seconds: where every track ends; 0 = at its last event)
//   Format 1 at 480 ticks per quarter: a tempo track (tempo, 4/4) and one track per part.

export const PPQ_OUT = 480;

function vlq(b, p) {          // -> [value, next position]
  let v = 0;
  for (let i = 0; i < 4; i++) {
    if (p >= b.length) throw new Error('This MIDI file is cut short.');
    const c = b[p++]; v = (v << 7) | (c & 0x7f);
    if (!(c & 0x80)) return [v, p];
  }
  throw new Error('This MIDI file has a bad length field.');
}
const u32 = (b, p) => ((b[p] << 24) >>> 0) + (b[p + 1] << 16) + (b[p + 2] << 8) + b[p + 3];
const u16 = (b, p) => (b[p] << 8) | b[p + 1];
const str = (b, p, n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(b[p + i]); return s; };
const DATA_LEN = { 0x80: 2, 0x90: 2, 0xA0: 2, 0xB0: 2, 0xC0: 1, 0xD0: 1, 0xE0: 2 };

export function readSMF(input, opts) {
  const wide = !!(opts && opts.wide);
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (b.length < 14 || str(b, 0, 4) !== 'MThd') throw new Error('This is not a Standard MIDI File (no MThd header).');
  const hlen = u32(b, 4), format = u16(b, 8), ntrks = u16(b, 10), div = u16(b, 12);
  if (format > 2) throw new Error('Unknown MIDI file format ' + format + '.');
  if (div & 0x8000) throw new Error('This MIDI file uses SMPTE time code timing, which Filament does not read. Re-save it with ticks per quarter note.');
  const ppq = div || 480;
  let p = 8 + hlen;
  const tracks = [], tempos = [];
  let timeSig = null;
  while (p + 8 <= b.length && tracks.length < ntrks) {
    const id = str(b, p, 4), len = u32(b, p + 4); p += 8;
    const end = Math.min(b.length, p + len);
    if (id !== 'MTrk') { p = end; continue; }           // unknown chunk: skip it
    const tr = { name: '', events: [], endTick: 0, tempos: [] };
    let tick = 0, run = 0;
    while (p < end) {
      let d; [d, p] = vlq(b, p); tick += d;
      let st = b[p];
      if (st === 0xFF) {                                  // meta
        const type = b[p + 1]; let n; [n, p] = vlq(b, p + 2);
        if (type === 0x2F) { p += n; break; }
        if (type === 0x51 && n >= 3) { const t = { tick, uspq: (b[p] << 16) | (b[p + 1] << 8) | b[p + 2] }; tempos.push(t); tr.tempos.push(t); }
        else if (type === 0x58 && n >= 2 && !timeSig) timeSig = [b[p], 1 << b[p + 1]];
        else if (type === 0x03 && !tr.name) tr.name = str(b, p, n).replace(/[\x00-\x1f]/g, '').trim();
        p += n; run = 0; continue;
      }
      if (st === 0xF0 || st === 0xF7) { let n; [n, p] = vlq(b, p + 1); p += n; run = 0; continue; }   // sysex: skip
      if (st & 0x80) { p++; if (st < 0xF0) run = st; else continue; }   // system common/realtime bytes in a file: skip
      else { if (!run) throw new Error('This MIDI file has data with no status byte.'); st = run; }
      const hi = st & 0xF0, nd = DATA_LEN[hi];
      const d1 = b[p] & 0x7f, d2 = nd === 2 ? b[p + 1] & 0x7f : 0; p += nd;
      const ch = st & 0x0F;
      let keep = hi === 0x80 || hi === 0x90 || hi === 0xE0 || hi === 0xD0 || hi === 0xA0 || (hi === 0xB0 && (d1 === 1 || d1 === 64));
      if (wide && !keep) {
        keep = hi === 0xC0 || (hi === 0xB0 && (d1 === 7 || d1 === 10 || d1 === 11 || d1 === 6 || d1 === 100 || d1 === 101 || d1 === 120 || d1 === 121 || d1 === 123));
      }
      if (!keep) continue;
      if (hi === 0x90 && d2 === 0) tr.events.push({ tick, ch, data: [0x80 | ch, d1, 0] });
      else tr.events.push({ tick, ch, data: nd === 2 ? [st, d1, d2] : [st, d1] });
    }
    tr.endTick = tick;
    p = end;
    tracks.push(tr);
  }
  if (!tracks.length) throw new Error('This MIDI file has no tracks.');
  tempos.sort((x, y) => x.tick - y.tick);
  return { format, ppq, tracks, tempos, timeSig };
}

// Tick -> seconds through a tempo list (sorted by tick); 120 BPM until the first tempo event.
export function tickTimer(tempos, ppq) {
  const seg = [{ tick: 0, sec: 0, spt: 0.5 / ppq }];
  for (const t of tempos) {
    const last = seg[seg.length - 1], spt = t.uspq / 1e6 / ppq;
    if (t.tick === last.tick) { last.spt = spt; continue; }
    seg.push({ tick: t.tick, sec: last.sec + (t.tick - last.tick) * last.spt, spt });
  }
  return tick => {
    let i = seg.length - 1; while (i > 0 && seg[i].tick > tick) i--;
    return seg[i].sec + (tick - seg[i].tick) * seg[i].spt;
  };
}

export function songOf(smf) {
  const parts = [];
  let offset = 0, length = 0;
  const gtime = tickTimer(smf.tempos, smf.ppq);
  smf.tracks.forEach((tr, ti) => {
    // format 2: each track is its own sequence with its own tempo map, played one after another
    const time = smf.format === 2 ? tickTimer(tr.tempos.slice().sort((x, y) => x.tick - y.tick), smf.ppq) : gtime;
    const off = smf.format === 2 ? offset : 0;
    const noteCh = new Set(tr.events.filter(e => (e.data[0] & 0xF0) === 0x90).map(e => e.ch));
    const chans = noteCh.size ? [...noteCh].sort((x, y) => x - y) : [];
    const split = chans.length > 1;
    const groups = split ? chans.map(c => [c]) : [chans.length ? chans : [...new Set(tr.events.map(e => e.ch))]];
    groups.forEach(g => {
      const evs = tr.events.filter(e => g.includes(e.ch) || (!split && !g.length));
      const notes = evs.filter(e => (e.data[0] & 0xF0) === 0x90).map(e => e.data[1]);
      if (!notes.length && !evs.length) return;
      const name = (tr.name || 'Track ' + (ti + 1)) + (split ? ' ch ' + (g[0] + 1) : '');
      parts.push({
        name, chans: g.map(c => c + 1), track: ti, notes: notes.length,
        lo: notes.length ? Math.min(...notes) : 0, hi: notes.length ? Math.max(...notes) : 0,
        mean: notes.length ? notes.reduce((s, v) => s + v, 0) / notes.length : 0,
        events: evs.map(e => ({ time: off + time(e.tick), data: e.data })),
      });
    });
    const tEnd = off + time(tr.endTick);
    length = Math.max(length, tEnd);
    if (smf.format === 2) offset = tEnd;
  });
  parts.forEach(pt => pt.events.forEach(e => { if (e.time > length) length = e.time; }));
  const t0 = smf.tempos.find(t => t.tick === 0) || smf.tempos[0];
  return { parts: parts.filter(pt => pt.events.length), length, bpm: t0 ? 60e6 / t0.uspq : 120, format: smf.format, timeSig: smf.timeSig };
}

// ---------------------------------------------------------------- writer
function pushVlq(out, v) {
  v = Math.max(0, Math.round(v));
  const tmp = [v & 0x7f]; v >>= 7;
  while (v > 0) { tmp.push((v & 0x7f) | 0x80); v >>= 7; }
  for (let i = tmp.length - 1; i >= 0; i--) out.push(tmp[i]);
}
function chunk(out, body) {
  out.push(0x4D, 0x54, 0x72, 0x6B, (body.length >>> 24) & 255, (body.length >>> 16) & 255, (body.length >>> 8) & 255, body.length & 255);
  for (let i = 0; i < body.length; i++) out.push(body[i]);
}
function metaText(body, type, s) {
  const bytes = [...new TextEncoder().encode(s)].slice(0, 120);
  body.push(0, 0xFF, type); pushVlq(body, bytes.length); bytes.forEach(x => body.push(x));
}

export function writeSMF({ bpm = 120, parts = [], length = 0 }) {
  const out = [0x4D, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, 0, PPQ_OUT >> 8, PPQ_OUT & 255];
  const uspq = Math.round(60e6 / bpm), tps = PPQ_OUT * bpm / 60;
  // length (seconds): every track ends there, not at its last event, so silence after the last
  // note survives the round trip and the file loops at the same point as what was recorded
  const endTick = Math.max(0, Math.round((+length || 0) * tps));
  const t0 = [];
  metaText(t0, 0x03, 'Tempo');
  t0.push(0, 0xFF, 0x51, 3, (uspq >> 16) & 255, (uspq >> 8) & 255, uspq & 255);
  t0.push(0, 0xFF, 0x58, 4, 4, 2, 24, 8);
  pushVlq(t0, endTick); t0.push(0xFF, 0x2F, 0);
  chunk(out, t0);
  let n = 1;
  for (const pt of parts) {
    const body = [], ch = (pt.ch | 0) & 15;
    metaText(body, 0x03, pt.name || 'Track ' + n);
    // stable order: at the same tick, note offs before note ons, so a repeated note retriggers
    const evs = pt.events.map((e, i) => ({ tick: Math.max(0, Math.round(e.time * tps)), d: e.data, i }))
      .sort((a, b) => a.tick - b.tick || ((a.d[0] & 0xF0) === 0x80 ? 0 : 1) - ((b.d[0] & 0xF0) === 0x80 ? 0 : 1) || a.i - b.i);
    let last = 0;
    for (const e of evs) {
      pushVlq(body, e.tick - last); last = e.tick;
      const hi = e.d[0] & 0xF0;
      body.push(hi | ch, e.d[1] & 0x7f); if (DATA_LEN[hi] === 2) body.push((e.d[2] || 0) & 0x7f);
    }
    pushVlq(body, Math.max(0, endTick - last)); body.push(0xFF, 0x2F, 0);
    chunk(out, body); n++;
  }
  out[10] = n >> 8; out[11] = n & 255;
  return Uint8Array.from(out);
}

// Engine-side values (velocity 0..1, bend -1..1, wheel and pressure 0..1) as MIDI bytes. The
// inverse of engine.js midiEvent(), so a take written to a file plays back the same.
export function bytesOf(ev, ch = 0) {
  const c = ch & 15, q = v => Math.max(0, Math.min(127, Math.round(v * 127)));
  switch (ev.t) {
    case 'on': return [0x90 | c, ev.n & 127, Math.max(1, q(ev.v == null ? 0.8 : ev.v))];
    case 'off': return [0x80 | c, ev.n & 127, 0];
    case 'bend': { const x = Math.max(0, Math.min(16383, Math.round(Math.max(-1, Math.min(1, ev.v)) * 8191) + 8192)); return [0xE0 | c, x & 127, x >> 7]; }
    case 'mw': return [0xB0 | c, 1, q(ev.v)];
    case 'sus': return [0xB0 | c, 64, ev.on ? 127 : 0];
    case 'at': return [0xD0 | c, q(ev.v)];
  }
  return null;
}
