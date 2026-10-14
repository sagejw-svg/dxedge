// Heptode patches. Schema v1, device 'heptode'.
//
// Heptode is a multitimbral MIDI-file instrument. Every channel starts as
// the same clean voice (a sine leaning toward a triangle, a gentle envelope,
// no drive and no effects). A program number may choose a General-MIDI-family
// envelope, still without coloration. The player then morphs that voice.

import { DEFAULT as F_DEFAULT, clone } from './patches.js';
import { parameterTable, RACK_API, registerDevice } from './device.js';
import { CHANNELS, FAMILIES, familyFor, familyOf } from './heptode-family.js';

export { RACK_API, CHANNELS };
export const HEPTODE_SCHEMA = 1;
export const HEPTODE_ID = 'heptode';

const RANGES = {
  wave: [0, 1], fm: [0, 1], cutoff: [80, 14000], res: [0, 0.92],
  drive: [0, 1], a: [0.001, 2], d: [0.001, 2], s: [0, 1], r: [0.001, 3],
  fenv: [0, 1], delay: [0, 1], reverb: [0, 1], chorus: [0, 1],
  pan: [-1, 1], space: [0, 1], level: [0, 1],
};

export function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }

export function neutralTrack(i) {
  const f = FAMILIES.neutral;
  return {
    name: 'Channel ' + ((i | 0) + 1),
    ch: i | 0,
    used: false,
    mute: false,
    solo: false,
    touched: false,
    placed: false,
    level: 0.9,
    program: 0,
    family: 'neutral',
    wave: f.wave, fm: 0, cutoff: f.cutoff, res: f.res, drive: 0,
    a: f.a, d: f.d, s: f.s, r: f.r, fenv: f.fenv,
    delay: 0, reverb: 0, chorus: 0,
    pan: 0, space: 0,
  };
}

function copyTrack(src, fallback) {
  const t = neutralTrack(fallback);
  if (!src || typeof src !== 'object') return t;
  if (typeof src.name === 'string' && src.name.trim()) t.name = src.name.trim().slice(0, 48);
  if (src.ch != null && isFinite(+src.ch)) t.ch = clamp(+src.ch | 0, 0, 15);
  t.used = !!src.used;
  t.mute = !!src.mute;
  t.solo = !!src.solo;
  t.touched = !!src.touched;
  t.placed = !!src.placed;
  if (src.program != null && isFinite(+src.program)) t.program = clamp(+src.program | 0, 0, 127);
  if (typeof src.family === 'string') t.family = src.family;
  Object.keys(RANGES).forEach(k => {
    if (src[k] == null || !isFinite(+src[k])) return;
    t[k] = clamp(+src[k], RANGES[k][0], RANGES[k][1]);
  });
  return t;
}

export const HEPTODE_DEFAULT = {
  v: HEPTODE_SCHEMA,
  device: HEPTODE_ID,
  name: 'Plain Voice',
  cat: 'Play',
  level: 0.85,
  performance: false,
  poly: 32,
  tempo: 120,
  loop: false,
  loop0: 0,
  loop1: 8,
  morph: 0,
  live: 0,
  fx: { delay: 0.32, feedback: 0.32, reverb: 0.55, chorus: 0.35 },
  tracks: Array.from({ length: CHANNELS }, (_, i) => neutralTrack(i)),
  stereo: clone(F_DEFAULT.stereo),
  ens: clone(F_DEFAULT.ens),
  out: clone(F_DEFAULT.out),
  voice: { mode: 'poly' },
};

function copySnap(list) {
  if (!Array.isArray(list)) return null;
  return list.slice(0, CHANNELS).map((row, i) => copyTrack(row, i));
}

export function normalizeHeptode(p) {
  const out = clone(HEPTODE_DEFAULT);
  out.tracks = Array.from({ length: CHANNELS }, (_, i) => neutralTrack(i));
  if (!p || typeof p !== 'object') return out;
  if (typeof p.name === 'string' && p.name.trim()) out.name = p.name.trim().slice(0, 40);
  if (p.cat === 'Play' || p.cat === 'Scene') out.cat = p.cat;
  if (p.level != null && isFinite(+p.level)) out.level = clamp(+p.level, 0, 1);
  out.performance = !!p.performance;
  if (p.poly != null && isFinite(+p.poly)) out.poly = clamp(+p.poly | 0, 4, 32);
  if (p.tempo != null && isFinite(+p.tempo)) out.tempo = clamp(+p.tempo, 40, 240);
  out.loop = !!p.loop;
  if (p.loop0 != null && isFinite(+p.loop0)) out.loop0 = Math.max(0, +p.loop0);
  if (p.loop1 != null && isFinite(+p.loop1)) out.loop1 = Math.max(0, +p.loop1);
  if (out.loop1 < out.loop0) out.loop1 = out.loop0;
  if (p.morph != null && isFinite(+p.morph)) out.morph = clamp(+p.morph, 0, 1);
  if (p.live != null && isFinite(+p.live)) out.live = clamp(+p.live | 0, 0, 15);
  const fx = p.fx || {};
  ['delay', 'feedback', 'reverb', 'chorus'].forEach(k => {
    if (fx[k] == null || !isFinite(+fx[k])) return;
    const max = k === 'feedback' ? 0.85 : 1;
    const min = k === 'delay' ? 0.04 : 0;
    out.fx[k] = clamp(+fx[k], min, max);
  });
  if (Array.isArray(p.tracks)) {
    for (let i = 0; i < CHANNELS; i++) out.tracks[i] = copyTrack(p.tracks[i], i);
  }
  out.snapA = copySnap(p.snapA);
  out.snapB = copySnap(p.snapB);
  return out;
}

const TIMBRE_KEYS = ['wave', 'fm', 'cutoff', 'res', 'drive', 'a', 'd', 's', 'r', 'fenv', 'delay', 'reverb', 'chorus', 'pan', 'space', 'level'];

export function trackParams(track) {
  const o = {};
  TIMBRE_KEYS.forEach(k => { o[k] = track[k]; });
  return o;
}

export function applyTrackParams(track, params) {
  if (!params) return track;
  TIMBRE_KEYS.forEach(k => {
    if (params[k] == null || !isFinite(+params[k])) return;
    track[k] = clamp(+params[k], RANGES[k][0], RANGES[k][1]);
  });
  return track;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Nudge every used channel a short way. Sends can appear, but only as a hint.
export function randomizeGentle(patch, seed) {
  const out = normalizeHeptode(patch);
  const rnd = mulberry32((seed == null ? (Math.random() * 1e9) | 0 : seed) >>> 0);
  const span = (k, frac) => {
    const lo = RANGES[k][0], hi = RANGES[k][1];
    return (hi - lo) * frac;
  };
  const used = out.tracks.some(t => t.used);
  out.tracks.forEach(t => {
    if (used && !t.used) return;
    const nudge = (k, frac) => {
      t[k] = clamp(t[k] + (rnd() * 2 - 1) * span(k, frac), RANGES[k][0], RANGES[k][1]);
    };
    nudge('wave', 0.12);
    nudge('fm', 0.08);
    nudge('cutoff', 0.08);
    nudge('res', 0.1);
    nudge('drive', 0.08);
    nudge('a', 0.06);
    nudge('d', 0.06);
    nudge('s', 0.08);
    nudge('r', 0.06);
    nudge('fenv', 0.1);
    nudge('delay', 0.08);
    nudge('reverb', 0.1);
    nudge('chorus', 0.08);
    nudge('pan', 0.12);
    nudge('space', 0.1);
    t.touched = true;
  });
  out.morph = 0;
  return out;
}

export function captureSnap(patch) {
  return normalizeHeptode(patch).tracks.map(t => copyTrack(t, t.ch));
}

export function morphTracks(patch, morph) {
  const out = normalizeHeptode(patch);
  const t = clamp(morph == null ? out.morph : +morph, 0, 1);
  out.morph = t;
  if (!out.snapA || !out.snapB) return out;
  for (let i = 0; i < CHANNELS; i++) {
    const a = out.snapA[i], b = out.snapB[i], dst = out.tracks[i];
    if (!a || !b) continue;
    TIMBRE_KEYS.forEach(k => {
      dst[k] = clamp(a[k] + (b[k] - a[k]) * t, RANGES[k][0], RANGES[k][1]);
    });
  }
  return out;
}

export function anySolo(tracks) {
  return tracks.some(t => t && t.solo);
}

// A new file names the channels that contain notes and, unless the player
// has already edited a channel, copies that channel's first program into
// the uncolored family defaults. Placement from a previous file is cleared
// so the file's own pan can show up.
export function applyScoreMeta(patch, score) {
  const out = normalizeHeptode(patch);
  out.tracks.forEach(t => { t.used = false; t.placed = false; });
  const rows = (score && score.tracks) || [];
  rows.forEach(row => {
    const t = out.tracks[row.ch & 15];
    if (!t) return;
    t.used = true;
    if (row.name) t.name = String(row.name).slice(0, 48);
  });
  const seen = new Set();
  const ck = score && score.ck;
  if (ck) {
    for (let i = 0; i < ck.length; i++) {
      if (ck[i] !== 3) continue;
      const ch = score.ch[i] & 15;
      if (seen.has(ch)) continue;
      seen.add(ch);
      const t = out.tracks[ch];
      if (!t || t.touched) continue;
      const program = score.cv[i] | 0;
      const picked = familyFor(program, ch);
      t.program = program & 127;
      t.family = ch === 9 ? 'drum' : familyOf(program);
      t.wave = picked.wave;
      t.fm = 0;
      t.drive = 0;
      t.delay = 0;
      t.reverb = 0;
      t.chorus = 0;
      t.a = picked.a; t.d = picked.d; t.s = picked.s; t.r = picked.r;
      t.cutoff = picked.cutoff; t.res = picked.res; t.fenv = picked.fenv;
    }
  }
  const seenPan = new Set();
  if (ck) {
    for (let i = 0; i < ck.length; i++) {
      if (ck[i] !== 2 || score.cc[i] !== 10) continue;
      const ch = score.ch[i] & 15;
      if (seenPan.has(ch)) continue;
      seenPan.add(ch);
      const t = out.tracks[ch];
      if (!t || t.placed) continue;
      t.pan = clamp(score.cv[i] * 2 - 1, -1, 1);
    }
  }
  if (score && score.bpm) out.tempo = clamp(score.bpm, 40, 240);
  if (score && score.length) {
    out.loop0 = 0;
    out.loop1 = score.length;
  }
  return out;
}

export const HEPTODE_FACTORY = [
  normalizeHeptode({ name: 'Plain Voice', cat: 'Play' }),
];

export const HEPTODE_CATS = ['Play'];

const ENUMS = {};
const RANGE = {
  level: [0, 1],
  poly: [4, 32],
  tempo: [40, 240],
  morph: [0, 1],
  'fx.delay': [0.04, 1],
  'fx.feedback': [0, 0.85],
  'fx.reverb': [0, 1],
  'fx.chorus': [0, 1],
};

export const HEPTODE_PARAMETERS = parameterTable(HEPTODE_DEFAULT, RANGE, ENUMS);

export const heptodeDevice = {
  id: HEPTODE_ID,
  name: 'Heptode',
  vendor: 'DX Edge',
  version: String(HEPTODE_SCHEMA),
  api: RACK_API,
  description: 'Multitimbral MIDI-file instrument',
  instrument: true,
  audioInputs: 0,
  audioOutputs: 1,
  midiInput: true,
  midiOutput: false,
  processor: 'heptode',
  worklet: 'heptode.worklet.js',
  channels: 2,
  oversample: 1,
  parameters: HEPTODE_PARAMETERS,
  normalize: normalizeHeptode,
  factory: HEPTODE_FACTORY,
  defaults: HEPTODE_DEFAULT,
  messages: ['patch', 'on', 'off', 'bend', 'mw', 'sus', 'panic', 'active', 'score', 'play', 'stop'],
};

registerDevice(heptodeDevice);
