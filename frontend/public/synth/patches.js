// Filament patches: the schema (v:1), its defaults, normalisation, and the factory set.
//
// A patch is plain JSON. Every field has a default here, so an old or partial patch (a share
// link, an imported file, a localStorage copy from an earlier version) always loads: missing
// fields take the default and out-of-range numbers are clamped.

export const SCHEMA = 1;

export const DEFAULT = {
  v: SCHEMA, name: 'Init', cat: 'Keys',
  tune: 0,                   // cents, whole instrument
  drift: 1.5,                // cents of slow random pitch wander per voice (0..8)
  osc1: { wave: 'saw', oct: 0, semi: 0, fine: 0, level: 0.8, pw: 0.5, fixed: 0 },
  osc2: { wave: 'saw', oct: 0, semi: 0, fine: 7, level: 0.5, pw: 0.5, sync: false, fm: 0, ring: 0, fixed: 0 },
  sub: { wave: 'square', oct: 1, level: 0 },
  noise: { color: 'white', level: 0 },
  v1: { tube: '12AX7', drive: 3, bias: 0 },
  filt: { model: 'valve12', cutoff: 1800, res: 0.3, drive: 3, keytrack: 0.5, env: 0.3, vel: 0.3, tube: '12AT7', bias: 0, sag: 3 },
  envA: { a: 0.005, d: 0.4, s: 0.8, r: 0.4, vel: 0.5 },
  envF: { a: 0.005, d: 0.5, s: 0.3, r: 0.4 },
  lfo1: { wave: 'sine', rate: 5, delay: 0, mode: 'global', pitch: 0, cutoff: 0, pw: 0, amp: 0 },
  voice: { mode: 'poly', count: 8, glide: 0, bend: 2, level: 0.8 },
  mw: { vib: 30, cut: 0 },   // mod wheel: vibrato depth (cents), cutoff (octaves)
  at: { vib: 0, cut: 1 },    // aftertouch: vibrato depth (cents), cutoff (octaves)
  stereo: { pan: 'alt', spread: 0.5 },
  out: {
    tube: 'EL34', topology: 'pp', drive: 3, bias: 0, sag: 2, tone: 0, level: 0,
    spkOn: false, cab: 'monitor', spkInt: 6,
    roomOn: true, room: 'studio', rmMix: 15, rmDecay: 0.9, rmTone: 6,
    wOn: true, width: 120, wChar: 9,
  },
};

// [min, max] for every numeric field; anything else is an enum or a flag.
const RANGE = {
  tune: [-100, 100], drift: [0, 8],
  'osc1.oct': [-3, 3], 'osc1.semi': [-12, 12], 'osc1.fine': [-50, 50], 'osc1.level': [0, 1], 'osc1.pw': [0.05, 0.95], 'osc1.fixed': [0, 8000],
  'osc2.oct': [-3, 3], 'osc2.semi': [-12, 12], 'osc2.fine': [-50, 50], 'osc2.level': [0, 1], 'osc2.pw': [0.05, 0.95], 'osc2.fm': [0, 1], 'osc2.ring': [0, 1], 'osc2.fixed': [0, 8000],
  'sub.oct': [1, 2], 'sub.level': [0, 1], 'noise.level': [0, 1],
  'v1.drive': [0, 10], 'v1.bias': [-5, 5],
  'filt.cutoff': [20, 20000], 'filt.res': [0, 1], 'filt.drive': [0, 10], 'filt.keytrack': [0, 1], 'filt.env': [-1, 1], 'filt.vel': [0, 1], 'filt.bias': [-5, 5], 'filt.sag': [0, 10],
  'envA.a': [0.001, 10], 'envA.d': [0.001, 10], 'envA.s': [0, 1], 'envA.r': [0.003, 12], 'envA.vel': [0, 1],
  'envF.a': [0.001, 10], 'envF.d': [0.001, 10], 'envF.s': [0, 1], 'envF.r': [0.003, 12],
  'lfo1.rate': [0.02, 30], 'lfo1.delay': [0, 5], 'lfo1.pitch': [0, 100], 'lfo1.cutoff': [0, 4], 'lfo1.pw': [0, 0.9], 'lfo1.amp': [0, 1],
  'voice.count': [1, 16], 'voice.glide': [0, 2], 'voice.bend': [0, 12], 'voice.level': [0, 1],
  'mw.vib': [0, 100], 'mw.cut': [-4, 4], 'at.vib': [0, 100], 'at.cut': [-4, 4],
  'stereo.spread': [0, 1],
  'out.drive': [0, 10], 'out.bias': [-5, 5], 'out.sag': [0, 10], 'out.tone': [-5, 5], 'out.level': [-24, 12],
  'out.spkInt': [0, 10], 'out.rmMix': [0, 100], 'out.rmDecay': [0.2, 6], 'out.rmTone': [0, 10], 'out.width': [0, 200], 'out.wChar': [3, 20],
};
export const ENUMS = {
  'osc1.wave': ['saw', 'pulse', 'tri', 'sine'], 'osc2.wave': ['saw', 'pulse', 'tri', 'sine'],
  'sub.wave': ['square', 'sine'], 'noise.color': ['white', 'pink'],
  'v1.tube': ['12AX7', '12AT7', '12AU7', '300B', 'EL84', '6V6', 'EL34', '6L6', 'KT88'],
  'filt.model': ['valve12', 'ladder24'],
  'filt.tube': ['12AX7', '12AT7', '12AU7', '300B', 'EL84', '6V6', 'EL34', '6L6', 'KT88'],
  'lfo1.wave': ['sine', 'tri', 'saw', 'square', 'sh', 'smooth'], 'lfo1.mode': ['global', 'voice'],
  'voice.mode': ['poly', 'mono', 'legato'],
  'stereo.pan': ['center', 'alt', 'key', 'random'],
  'out.tube': ['12AX7', '12AT7', '12AU7', '300B', 'EL84', '6V6', 'EL34', '6L6', 'KT88'],
  'out.topology': ['se', 'pp'],
  'out.cab': ['console', 'bakelite', 'horn', 'monitor'],
  'out.room': ['living', 'studio', 'theater', 'hall'],
};
export const CATS = ['Bass', 'Lead', 'Pad', 'Keys', 'Pluck', 'FX'];

export function clone(o) { return JSON.parse(JSON.stringify(o)); }
export function getPath(o, path) { return path.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o); }
export function setPath(o, path, v) { const ks = path.split('.'); let x = o; for (let i = 0; i < ks.length - 1; i++) { if (x[ks[i]] == null || typeof x[ks[i]] !== 'object') x[ks[i]] = {}; x = x[ks[i]]; } x[ks[ks.length - 1]] = v; }

// Merge a partial patch over the defaults, coerce types, clamp ranges.
export function normalize(p) {
  const out = clone(DEFAULT);
  if (!p || typeof p !== 'object') return out;
  (function merge(dst, src, prefix) {
    Object.keys(dst).forEach(k => {
      const path = prefix ? prefix + '.' + k : k, d = dst[k], s = src ? src[k] : undefined;
      if (d && typeof d === 'object') { merge(d, s && typeof s === 'object' ? s : null, path); return; }
      if (s === undefined || s === null) return;
      if (typeof d === 'number') { const n = +s; if (!isFinite(n)) return; const r = RANGE[path]; dst[k] = r ? Math.min(r[1], Math.max(r[0], n)) : n; }
      else if (typeof d === 'boolean') dst[k] = !!s;
      else if (typeof d === 'string') { const e = ENUMS[path]; const v = String(s).slice(0, 60); if (!e || e.includes(v)) dst[k] = v; }
    });
  })(out, p, '');
  if (!CATS.includes(out.cat)) out.cat = 'Keys';
  out.voice.count = Math.round(out.voice.count);
  out.v = SCHEMA;
  return out;
}

// ---- factory set ----
// Written as differences from DEFAULT; normalize() fills the rest.
const F = [
  { name: 'Plate Bass', cat: 'Bass',
    osc1: { wave: 'saw', level: 0.8 }, osc2: { wave: 'pulse', oct: -1, fine: 0, level: 0.45, pw: 0.4 }, sub: { wave: 'square', oct: 1, level: 0.35 },
    v1: { tube: '12AX7', drive: 5 },
    filt: { model: 'ladder24', cutoff: 320, res: 0.35, drive: 5, keytrack: 0.4, env: 0.42, vel: 0.35 },
    envA: { a: 0.002, d: 0.6, s: 0.75, r: 0.12, vel: 0.4 }, envF: { a: 0.002, d: 0.28, s: 0.12, r: 0.18 },
    voice: { mode: 'mono', glide: 0 }, stereo: { pan: 'center', spread: 0 }, drift: 1,
    out: { level: 7.5,  tube: '6L6', topology: 'pp', drive: 4, roomOn: false, wOn: false } },
  { name: 'Diode Squelch', cat: 'Bass',
    osc1: { wave: 'saw', level: 0.85 }, osc2: { level: 0 },
    v1: { tube: '12AX7', drive: 6 },
    filt: { model: 'ladder24', cutoff: 260, res: 0.88, drive: 6, keytrack: 0.5, env: 0.55, vel: 0.5 },
    envA: { a: 0.001, d: 0.3, s: 1, r: 0.06, vel: 0.3 }, envF: { a: 0.001, d: 0.2, s: 0, r: 0.12 },
    voice: { mode: 'legato', glide: 0.06 }, stereo: { pan: 'center', spread: 0 }, drift: 0.5,
    out: { level: 4.5,  tube: 'EL34', topology: 'pp', drive: 5, roomOn: true, room: 'studio', rmMix: 10, wOn: false } },
  { name: 'Cellar Sub', cat: 'Bass',
    osc1: { wave: 'sine', level: 0.85 }, osc2: { wave: 'tri', oct: 0, fine: 0, level: 0.25 }, sub: { wave: 'sine', oct: 1, level: 0.6 },
    v1: { tube: '12AU7', drive: 3 },
    filt: { model: 'valve12', cutoff: 700, res: 0, keytrack: 0.3, env: 0.05 },
    envA: { a: 0.004, d: 0.8, s: 0.9, r: 0.2, vel: 0.3 },
    voice: { mode: 'mono' }, stereo: { pan: 'center', spread: 0 }, drift: 0.5,
    out: { level: 4.0,  tube: '300B', topology: 'se', drive: 3, roomOn: false, wOn: false } },
  { name: 'Filament Lead', cat: 'Lead',
    osc1: { wave: 'saw', level: 0.8 }, osc2: { wave: 'saw', fine: 9, level: 0.65 },
    v1: { tube: '12AX7', drive: 4.5 },
    filt: { model: 'valve12', cutoff: 1300, res: 0.62, keytrack: 0.7, env: 0.35, vel: 0.35, tube: '12AX7' },
    envA: { a: 0.006, d: 0.5, s: 0.85, r: 0.25 }, envF: { a: 0.01, d: 0.6, s: 0.35, r: 0.3 },
    lfo1: { wave: 'sine', rate: 5.6, delay: 0.5, pitch: 10 }, mw: { vib: 40 },
    voice: { mode: 'legato', glide: 0.04 }, stereo: { pan: 'center', spread: 0 },
    out: { level: 4.5,  tube: 'EL34', topology: 'pp', drive: 4, roomOn: true, room: 'studio', rmMix: 16, wOn: true, width: 120 } },
  { name: 'Screaming 12AX7', cat: 'Lead',
    osc1: { wave: 'pulse', pw: 0.3, level: 0.75 }, osc2: { wave: 'saw', fine: -6, level: 0.6 },
    v1: { tube: 'EL34', drive: 6 },
    filt: { model: 'valve12', cutoff: 950, res: 0.84, drive: 6, keytrack: 0.85, env: 0.4, vel: 0.4, tube: '12AX7', sag: 5 },
    envA: { a: 0.005, d: 0.4, s: 0.9, r: 0.22 }, envF: { a: 0.02, d: 0.7, s: 0.3, r: 0.3 },
    lfo1: { wave: 'sine', rate: 6, delay: 0.6, pitch: 14 }, mw: { vib: 45 }, at: { cut: 1.5 },
    voice: { mode: 'legato', glide: 0.03 }, stereo: { pan: 'center', spread: 0 },
    out: { level: 2.5,  tube: 'EL34', topology: 'pp', drive: 5.5, roomOn: true, room: 'theater', rmMix: 14, wOn: true, width: 120 } },
  { name: 'Wide Novachord Strings', cat: 'Pad',
    osc1: { wave: 'saw', fine: 4, level: 0.7 }, osc2: { wave: 'saw', fine: -11, level: 0.65 },
    v1: { tube: '12AT7', drive: 3 },
    filt: { model: 'valve12', cutoff: 2300, res: 0.25, keytrack: 0.6, env: 0.15, vel: 0.25, tube: '12AT7' },
    envA: { a: 0.12, d: 1.2, s: 0.85, r: 1.3, vel: 0.35 }, envF: { a: 0.4, d: 1.6, s: 0.6, r: 1.2 },
    lfo1: { wave: 'tri', rate: 0.3, pitch: 5 }, drift: 2.5,
    stereo: { pan: 'alt', spread: 0.6 },
    out: { level: 0.5,  tube: '300B', topology: 'se', drive: 3, roomOn: true, room: 'hall', rmMix: 22, rmDecay: 3.0, wOn: true, width: 135 } },
  { name: 'Black Light Pad', cat: 'Pad',
    osc1: { wave: 'pulse', pw: 0.35, level: 0.7 }, osc2: { wave: 'saw', oct: 1, fine: 5, level: 0.32 }, noise: { color: 'pink', level: 0.06 },
    v1: { tube: '12AX7', drive: 3.5 },
    filt: { model: 'valve12', cutoff: 1000, res: 0.5, keytrack: 0.5, env: 0.25, tube: 'EL84' },
    envA: { a: 0.9, d: 1.5, s: 0.85, r: 2.2 }, envF: { a: 1.2, d: 2, s: 0.5, r: 2 },
    lfo1: { wave: 'tri', rate: 0.4, pw: 0.35, cutoff: 0.4 }, drift: 2,
    stereo: { pan: 'random', spread: 0.55 },
    out: { level: -1.5,  tube: 'KT88', topology: 'pp', drive: 3, roomOn: true, room: 'theater', rmMix: 24, rmDecay: 2.2, wOn: true, width: 135 } },
  { name: 'Bakelite Organ', cat: 'Keys',
    osc1: { wave: 'sine', level: 0.7 }, osc2: { wave: 'sine', oct: 1, fine: 0, level: 0.45 }, sub: { wave: 'sine', oct: 1, level: 0.45 },
    v1: { tube: '12AX7', drive: 5.5 },
    filt: { model: 'valve12', cutoff: 7000, res: 0, keytrack: 0, env: 0, vel: 0 },
    envA: { a: 0.004, d: 0.1, s: 1, r: 0.05, vel: 0 },
    lfo1: { wave: 'sine', rate: 6.7, pitch: 6, amp: 0.12 }, drift: 0.3,
    stereo: { pan: 'key', spread: 0.4 },
    out: { level: 0.5,  tube: '6V6', topology: 'se', drive: 5, spkOn: true, cab: 'bakelite', spkInt: 8, roomOn: true, room: 'living', rmMix: 14, wOn: false } },
  { name: 'Hollow Pluck', cat: 'Pluck',
    osc1: { wave: 'tri', level: 0.8 }, osc2: { wave: 'pulse', oct: 1, fine: 0, pw: 0.5, level: 0.3 },
    v1: { tube: '12AT7', drive: 3 },
    filt: { model: 'valve12', cutoff: 320, res: 0.62, keytrack: 0.8, env: 0.7, vel: 0.6, tube: '12AU7' },
    envA: { a: 0.001, d: 0.9, s: 0, r: 0.6, vel: 0.6 }, envF: { a: 0.001, d: 0.28, s: 0, r: 0.3 },
    stereo: { pan: 'key', spread: 0.6 },
    out: { level: 7.0,  tube: 'EL84', topology: 'pp', drive: 3, roomOn: true, room: 'studio', rmMix: 22, wOn: true, width: 130 } },
  { name: 'Magic Eye Sweep', cat: 'FX',
    osc1: { wave: 'saw', level: 0.75 }, osc2: { wave: 'saw', fine: 12, level: 0.6 },
    filt: { model: 'ladder24', cutoff: 550, res: 0.78, keytrack: 0.5, env: 0, vel: 0.2 },
    envA: { a: 0.25, d: 1, s: 1, r: 1.2 },
    lfo1: { wave: 'tri', rate: 0.15, cutoff: 2.5 },
    stereo: { pan: 'alt', spread: 0.55 },
    out: { level: -0.5,  tube: 'KT88', topology: 'pp', drive: 3.5, roomOn: true, room: 'hall', rmMix: 20, rmDecay: 2.6, wOn: true, width: 130 } },
  { name: 'Shortwave Drift', cat: 'FX',
    osc1: { wave: 'sine', level: 0.35 }, osc2: { wave: 'sine', fixed: 1180, level: 0.25, ring: 0.35 }, noise: { color: 'pink', level: 0.4 },
    v1: { tube: '12AX7', drive: 4 },
    filt: { model: 'valve12', cutoff: 1500, res: 0.72, keytrack: 0.4, env: 0, tube: '6V6' },
    envA: { a: 0.4, d: 1, s: 1, r: 1.5 },
    lfo1: { wave: 'smooth', rate: 0.35, cutoff: 1.4, amp: 0.55, pitch: 40 }, drift: 8,
    stereo: { pan: 'random', spread: 0.5 },
    out: { level: 8.5,  tube: '6V6', topology: 'se', drive: 4, spkOn: true, cab: 'bakelite', spkInt: 7, roomOn: true, room: 'living', rmMix: 12, wOn: false } },
  { name: 'CW Practice Tone', cat: 'FX',
    osc1: { wave: 'sine', fixed: 570, level: 0.8 }, osc2: { level: 0 },
    v1: { tube: '12AU7', drive: 0 },
    filt: { model: 'valve12', cutoff: 6000, res: 0, keytrack: 0, env: 0, vel: 0 },
    envA: { a: 0.004, d: 0.05, s: 1, r: 0.005, vel: 0 }, drift: 0,
    voice: { mode: 'mono' }, stereo: { pan: 'center', spread: 0 },
    out: { level: 2.5,  tube: 'EL84', topology: 'se', drive: 2, roomOn: false, wOn: false } },
];
export const FACTORY = F.map(p => normalize(p));
