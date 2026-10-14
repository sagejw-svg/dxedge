// Turn a Standard MIDI File into a packed score Heptode can play.
// Times are seconds through the file's own tempo map. Channels share a
// strip (there are sixteen). Performance mode drops notes that cannot be
// heard under the polyphony cap so a very dense file stays responsive.

import { readSMF, tickTimer } from './smf.js';
import { CHANNELS } from './heptode-family.js';

function heapPush(h, x) {
  h.push(x);
  let i = h.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (h[p] <= h[i]) break;
    const s = h[p]; h[p] = h[i]; h[i] = s;
    i = p;
  }
}
function heapPop(h) {
  const top = h[0];
  const last = h.pop();
  if (!h.length) return top;
  h[0] = last;
  let i = 0;
  for (;;) {
    const l = i * 2 + 1, r = l + 1;
    let s = i;
    if (l < h.length && h[l] < h[s]) s = l;
    if (r < h.length && h[r] < h[s]) s = r;
    if (s === i) break;
    const t = h[s]; h[s] = h[i]; h[i] = t;
    i = s;
  }
  return top;
}

export function maxOverlap(t, d) {
  const n = t.length;
  const ev = new Float64Array(n * 2);
  const k = new Int8Array(n * 2);
  for (let i = 0; i < n; i++) {
    ev[i * 2] = t[i]; k[i * 2] = 1;
    ev[i * 2 + 1] = t[i] + d[i]; k[i * 2 + 1] = -1;
  }
  const idx = Array.from({ length: n * 2 }, (_, i) => i);
  idx.sort((a, b) => ev[a] - ev[b] || k[a] - k[b]);
  let c = 0, m = 0;
  for (let i = 0; i < idx.length; i++) {
    c += k[idx[i]];
    if (c > m) m = c;
  }
  return m;
}

// Keep the louder notes when more than `poly` would sound at once.
// Notes shorter than minDur or quieter than minVel (0..127) are dropped.
export function cullPacked(score, opts) {
  const o = opts || {};
  const poly = Math.max(1, o.poly | 0 || 32);
  const minDur = o.minDur == null ? 0 : +o.minDur;
  const minVel = o.minVel == null ? 1 : +o.minVel;
  const n = score.t.length;
  const order = Array.from({ length: n }, (_, i) => i);
  order.sort((a, b) => score.t[a] - score.t[b] || score.v[b] - score.v[a] || a - b);
  const keep = [];
  const heap = [];
  const capNotes = o.maxNotes == null ? 64000 : o.maxNotes | 0;
  for (let k = 0; k < order.length; k++) {
    const i = order[k];
    const dur = score.d[i];
    const vel = score.v[i];
    if (dur < minDur || vel < minVel) continue;
    const start = score.t[i];
    while (heap.length && heap[0] <= start) heapPop(heap);
    if (heap.length >= poly) continue;
    if (keep.length >= capNotes) continue;
    heapPush(heap, start + dur);
    keep.push(i);
  }
  keep.sort((a, b) => a - b);
  const m = keep.length;
  const out = {
    name: score.name, length: score.length, bpm: score.bpm,
    tempos: score.tempos, tracks: score.tracks,
    t: new Float32Array(m), d: new Float32Array(m),
    n: new Uint8Array(m), v: new Uint8Array(m), tr: new Uint8Array(m),
    ct: score.ct, ck: score.ck, cc: score.cc, cv: score.cv, ch: score.ch,
    kept: m, dropped: n - m,
  };
  for (let i = 0; i < m; i++) {
    const s = keep[i];
    out.t[i] = score.t[s]; out.d[i] = score.d[s];
    out.n[i] = score.n[s]; out.v[i] = score.v[s]; out.tr[i] = score.tr[s];
  }
  return out;
}

export function performanceOpts(patch) {
  const poly = patch && patch.performance ? Math.min(16, patch.poly | 0 || 16) : (patch && patch.poly | 0) || 32;
  const many = true;
  return {
    poly,
    minDur: patch && patch.performance ? 0.012 : 0,
    minVel: patch && patch.performance ? 8 : 1,
    maxNotes: patch && patch.performance ? 24000 : 64000,
    many,
  };
}

function pack(notes, ctrls, meta) {
  notes.sort((a, b) => a.t - b.t || a.tr - b.tr);
  ctrls.sort((a, b) => a.t - b.t);
  const m = notes.length, c = ctrls.length;
  const score = {
    name: meta.name || 'MIDI file',
    length: meta.length || 0,
    bpm: meta.bpm || 120,
    tempos: meta.tempos || [{ t: 0, bpm: meta.bpm || 120 }],
    tracks: meta.tracks,
    t: new Float32Array(m), d: new Float32Array(m),
    n: new Uint8Array(m), v: new Uint8Array(m), tr: new Uint8Array(m),
    ct: new Float32Array(c), ck: new Uint8Array(c), cc: new Uint8Array(c),
    cv: new Float32Array(c), ch: new Uint8Array(c),
    notes: m, controls: c,
  };
  for (let i = 0; i < m; i++) {
    const e = notes[i];
    score.t[i] = e.t; score.d[i] = e.d;
    score.n[i] = e.n & 127; score.v[i] = e.v & 127; score.tr[i] = e.tr & 15;
    if (e.t + e.d > score.length) score.length = e.t + e.d;
  }
  for (let i = 0; i < c; i++) {
    const e = ctrls[i];
    score.ct[i] = e.t; score.ch[i] = e.ch & 15; score.cv[i] = e.v;
    score.cc[i] = e.cc & 127;
    score.ck[i] = e.kind === 'bend' ? 1 : e.kind === 'cc' ? 2 : 3;
  }
  return score;
}

export function scoreFromSMF(smf, name) {
  const gtime = tickTimer(smf.tempos, smf.ppq);
  const open = Array.from({ length: CHANNELS }, () => Array.from({ length: 128 }, () => []));
  const notes = [];
  const ctrls = [];
  const names = Array.from({ length: CHANNELS }, () => []);
  const counts = new Uint32Array(CHANNELS);
  let offset = 0, length = 0;
  smf.tracks.forEach(tr => {
    const time = smf.format === 2
      ? tickTimer(tr.tempos.slice().sort((a, b) => a.tick - b.tick), smf.ppq)
      : gtime;
    const off = smf.format === 2 ? offset : 0;
    if (tr.name) {
      const label = tr.name.trim();
      tr.events.forEach(e => {
        if ((e.data[0] & 0xf0) === 0x90 && label && names[e.ch].indexOf(label) < 0) names[e.ch].push(label);
      });
    }
    tr.events.forEach(e => {
      const st = e.data[0] & 0xf0;
      const ch = e.ch & 15;
      const sec = off + time(e.tick);
      if (st === 0x90) {
        open[ch][e.data[1] & 127].push({ t: sec, v: e.data[2] & 127 });
        counts[ch]++;
      } else if (st === 0x80) {
        const stack = open[ch][e.data[1] & 127];
        const started = stack.shift();
        if (!started) return;
        const dur = Math.max(0.001, sec - started.t);
        notes.push({ t: started.t, d: dur, n: e.data[1] & 127, v: started.v, tr: ch });
      } else if (st === 0xe0) {
        const raw = ((e.data[2] & 127) << 7) | (e.data[1] & 127);
        ctrls.push({ t: sec, ch, kind: 'bend', cc: 0, v: (raw - 8192) / 8191 });
      } else if (st === 0xb0) {
        ctrls.push({ t: sec, ch, kind: 'cc', cc: e.data[1] & 127, v: (e.data[2] & 127) / 127 });
      } else if (st === 0xc0) {
        ctrls.push({ t: sec, ch, kind: 'pc', cc: 0, v: e.data[1] & 127 });
      }
    });
    const end = off + time(tr.endTick);
    if (end > length) length = end;
    if (smf.format === 2) offset = end;
  });
  for (let ch = 0; ch < CHANNELS; ch++) {
    for (let n = 0; n < 128; n++) {
      open[ch][n].forEach(started => {
        notes.push({ t: started.t, d: 0.2, n, v: started.v, tr: ch });
      });
    }
  }
  const t0 = smf.tempos.find(t => t.tick === 0) || smf.tempos[0];
  const bpm = t0 ? 60e6 / t0.uspq : 120;
  const tempos = [];
  const timer = gtime;
  (smf.tempos.length ? smf.tempos : [{ tick: 0, uspq: 500000 }]).forEach(t => {
    tempos.push({ t: timer(t.tick), bpm: 60e6 / t.uspq });
  });
  const tracks = [];
  for (let ch = 0; ch < CHANNELS; ch++) {
    if (!counts[ch]) continue;
    const pitches = notes.filter(e => e.tr === ch).map(e => e.n);
    tracks.push({
      ch,
      name: names[ch].join(' / ') || ('Channel ' + (ch + 1)),
      notes: counts[ch],
      lo: pitches.length ? Math.min(...pitches) : 0,
      hi: pitches.length ? Math.max(...pitches) : 0,
    });
  }
  const score = pack(notes, ctrls, { name: name || 'MIDI file', length, bpm, tempos, tracks });
  score.counts = Array.from(counts);
  return score;
}

export function scoreFromBytes(bytes, name) {
  const smf = readSMF(bytes, { wide: true });
  return scoreFromSMF(smf, name);
}

export function prepareScore(score, patch) {
  const perf = !!(patch && patch.performance);
  const heavy = score.t.length > 8000;
  if (!perf && !heavy) return Object.assign({}, score, { kept: score.t.length, dropped: 0 });
  const poly = perf ? Math.min(16, (patch && patch.poly) || 16) : Math.min(32, (patch && patch.poly) || 32);
  return cullPacked(score, {
    poly,
    minDur: perf ? 0.012 : (heavy ? 0.006 : 0),
    minVel: perf ? 8 : 1,
    maxNotes: perf ? 24000 : 64000,
  });
}

function pushVlq(out, v) {
  v = Math.max(0, v | 0);
  const tmp = [v & 0x7f];
  v >>= 7;
  while (v > 0) { tmp.push((v & 0x7f) | 0x80); v >>= 7; }
  for (let i = tmp.length - 1; i >= 0; i--) out.push(tmp[i]);
}
function pushChunk(out, body) {
  out.push(0x4d, 0x54, 0x72, 0x6b, (body.length >>> 24) & 255, (body.length >>> 16) & 255, (body.length >>> 8) & 255, body.length & 255);
  for (let i = 0; i < body.length; i++) out.push(body[i]);
}

// A small format-1 file used by the tests: two channels, a tempo change,
// program changes, pitch bend, expression, sustain and pan.
export function encodeFixture() {
  const ppq = 480;
  const out = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, 3, ppq >> 8, ppq & 255];
  const tempo = [];
  tempo.push(0, 0xff, 0x03, 4, 0x54, 0x65, 0x6d, 0x70);
  tempo.push(0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20); // 120 bpm
  tempo.push(0, 0xff, 0x58, 4, 4, 2, 24, 8);
  // At tick 960 (two beats, one second at 120) switch to 60 bpm so the next
  // second of score-time is two beats of the clock. 60 bpm = 1000000 us.
  pushVlq(tempo, 960);
  tempo.push(0xff, 0x51, 3, 0x0f, 0x42, 0x40);
  tempo.push(0, 0xff, 0x2f, 0);
  pushChunk(out, tempo);

  function track(name, ch, events) {
    const body = [0, 0xff, 0x03];
    const bytes = [];
    for (let i = 0; i < name.length; i++) bytes.push(name.charCodeAt(i));
    pushVlq(body, bytes.length);
    bytes.forEach(b => body.push(b));
    events.sort((a, b) => a.tick - b.tick || a.ord - b.ord);
    let last = 0;
    events.forEach(e => {
      pushVlq(body, e.tick - last);
      last = e.tick;
      e.bytes.forEach(b => body.push(b));
    });
    body.push(0, 0xff, 0x2f, 0);
    pushChunk(out, body);
  }
  // Channel 1: program 0 (piano family), a held A4, bend up a whole step's
  // worth of the default range, expression, then sustain across a short note.
  track('Lead', 0, [
    { tick: 0, ord: 0, bytes: [0xc0, 0] },
    { tick: 0, ord: 1, bytes: [0xb0, 7, 100] },
    { tick: 0, ord: 2, bytes: [0xb0, 10, 64] },
    { tick: 0, ord: 3, bytes: [0xb0, 11, 127] },
    { tick: 0, ord: 4, bytes: [0x90, 69, 100] },
    { tick: 480, ord: 0, bytes: [0xe0, 0x7f, 0x7f] }, // bend to the top of the default range
    { tick: 960, ord: 1, bytes: [0x80, 69, 0] },
    { tick: 1440, ord: 0, bytes: [0xb0, 64, 127] },
    { tick: 1440, ord: 1, bytes: [0x90, 72, 90] },
    { tick: 1680, ord: 0, bytes: [0x80, 72, 0] },
    { tick: 2400, ord: 0, bytes: [0xb0, 64, 0] },
  ]);
  track('Bass', 1, [
    { tick: 0, ord: 0, bytes: [0xc1, 32] },
    { tick: 0, ord: 1, bytes: [0xb1, 10, 0] },
    { tick: 0, ord: 2, bytes: [0x91, 45, 100] },
    { tick: 1920, ord: 0, bytes: [0x81, 45, 0] },
  ]);
  return Uint8Array.from(out);
}
