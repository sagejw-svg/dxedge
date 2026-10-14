// Cathode patches: the schema, the patch panel's jack lists, normalisation and the factory set.
//
// Cathode is the second device in the Filament rack: one voice, semi-modular. A patch is plain
// JSON like Filament's, with device: 'cathode' and a list of cables, each [source, input].
// The rack fields (ens, out) are the same as Filament's and take its defaults.

import { DEFAULT as F_DEFAULT, clone } from './patches.js';

export const C_SCHEMA = 1;

// The jacks. The worklet (voice.worklet.js) carries the same three lists; the suite checks they match.
export const C_SRC = ['kbd', 'gate', 'vel', 'wheel', 'mgTri', 'mgPulse', 'white', 'pink', 'sh', 'eg1', 'eg1i', 'eg2', 'eg2i', 'vco1', 'vco2', 'mix', 'hpf', 'lpf'];
export const C_IN = ['pitch', 'vco2', 'pmA', 'pmB', 'shIn', 'shClk', 'eg1Trig', 'eg2Trig', 'filtIn', 'hpA', 'hpB', 'hpCut', 'lpfIn', 'lpA', 'lpB', 'lpCut', 'vcaIn', 'vca'];
export const C_NORM = { pmA: 'mgTri', pmB: 'eg1', shIn: 'white', shClk: 'mgPulse', eg1Trig: 'gate', eg2Trig: 'gate', filtIn: 'mix',
  hpA: 'mgTri', hpB: 'eg2', lpfIn: 'hpf', lpA: 'mgTri', lpB: 'eg2', vcaIn: 'lpf', vca: 'eg2' };

// How the panel prints them. Groups run left to right in signal order.
export const JACK_LABEL = {
  kbd: 'KBD CV', gate: 'GATE', vel: 'VELOCITY', wheel: 'WHEEL', mgTri: 'MG △', mgPulse: 'MG ⊓', white: 'WHITE', pink: 'PINK',
  sh: 'S&H OUT', eg1: 'EG 1', eg1i: 'EG 1 REV', eg2: 'EG 2', eg2i: 'EG 2 REV', vco1: 'VCO 1', vco2: 'VCO 2', mix: 'MIX', hpf: 'HPF OUT', lpf: 'LPF OUT',
  pitch: 'PITCH', vco2In: 'VCO 2 PITCH', pmA: 'PM A', pmB: 'PM B', shIn: 'S&H IN', shClk: 'S&H CLOCK', eg1Trig: 'EG 1 TRIG', eg2Trig: 'EG 2 TRIG',
  filtIn: 'FILTER IN', hpA: 'HPF A', hpB: 'HPF B', hpCut: 'HPF CV', lpfIn: 'LPF IN', lpA: 'LPF A', lpB: 'LPF B', lpCut: 'LPF CV', vcaIn: 'VCA IN', vca: 'VCA CV',
};
// one short word for a source, used where a knob names what it is listening to
export const SRC_SHORT = { kbd: 'KBD', gate: 'GATE', vel: 'VEL', wheel: 'WHEEL', mgTri: 'MG', mgPulse: 'MG ⊓', white: 'NOISE', pink: 'PINK',
  sh: 'S&H', eg1: 'EG 1', eg1i: 'EG1 REV', eg2: 'EG 2', eg2i: 'EG2 REV', vco1: 'VCO 1', vco2: 'VCO 2', mix: 'MIX', hpf: 'HPF', lpf: 'LPF' };
export const JACK_GROUPS = [
  { name: 'Keyboard', out: ['kbd', 'gate', 'vel', 'wheel'], in: ['pitch', 'vco2'] },
  { name: 'Modulation', out: ['mgTri', 'mgPulse', 'white', 'pink', 'sh'], in: ['pmA', 'pmB', 'shIn', 'shClk'] },
  { name: 'Envelopes', out: ['eg1', 'eg1i', 'eg2', 'eg2i'], in: ['eg1Trig', 'eg2Trig'] },
  { name: 'Audio', out: ['vco1', 'vco2', 'mix', 'hpf', 'lpf'], in: ['filtIn', 'hpA', 'hpB', 'hpCut', 'lpfIn', 'lpA', 'lpB', 'lpCut', 'vcaIn', 'vca'] },
];
// input jack id -> label key (the VCO 2 input shares its id with the VCO 2 output)
export const inLabel = id => JACK_LABEL[id === 'vco2' ? 'vco2In' : id];

export const C_DEFAULT = {
  v: C_SCHEMA, device: 'cathode', name: 'Init', cat: 'Lead',
  tune: 0, drift: 1,
  vco1: { wave: 'saw', scale: 8, pw: 0.5, level: 0.8 },
  vco2: { wave: 'square', scale: 8, semi: 0, fine: 0, level: 0, sync: false },
  pm: { a: 0, b: 0, dest: 'both' },            // pitch mod depths in semitones, from PM A (MG) and PM B (EG 1)
  ctl: { glide: 0, bend: 2, trig: 'multi', wheel: 30 },
  drive: { tube: '12AX7', amount: 3, bias: 0 },
  hpf: { cutoff: 20, peak: 0, a: 0, b: 0, kt: 0 },      // a, b: -1..1, x5 octaves, from HPF A (MG) and HPF B (EG 2)
  lpf: { cutoff: 1600, peak: 0.35, a: 0, b: 0.5, kt: 0.5 },
  follow: { tube: '12AU7', drive: 3 },
  mg: { rate: 4, shape: 0.5 },
  eg1: { delay: 0, a: 0.005, r: 0.3 },
  eg2: { hold: 0, a: 0.004, d: 0.35, s: 0.6, r: 0.25 },
  vca: { level: 0.8, vel: 0.3, bias: 0 },
  cables: [],
  ens: clone(F_DEFAULT.ens),
  out: clone(F_DEFAULT.out),
};

export const RANGE = {
  tune: [-100, 100], drift: [0, 8],
  'vco1.pw': [0.05, 0.95], 'vco1.level': [0, 1], 'vco2.semi': [-12, 12], 'vco2.fine': [-50, 50], 'vco2.level': [0, 1],
  'pm.a': [-24, 24], 'pm.b': [-24, 24],
  'ctl.glide': [0, 2], 'ctl.bend': [0, 12], 'ctl.wheel': [0, 100],
  'drive.amount': [0, 10], 'drive.bias': [-5, 5],
  'hpf.cutoff': [20, 8000], 'hpf.peak': [0, 1], 'hpf.a': [-1, 1], 'hpf.b': [-1, 1], 'hpf.kt': [0, 1],
  'lpf.cutoff': [30, 18000], 'lpf.peak': [0, 1], 'lpf.a': [-1, 1], 'lpf.b': [-1, 1], 'lpf.kt': [0, 1],
  'follow.drive': [0, 10],
  'mg.rate': [0.05, 40], 'mg.shape': [0, 1],
  'eg1.delay': [0, 3], 'eg1.a': [0.001, 10], 'eg1.r': [0.003, 12],
  'eg2.hold': [0, 3], 'eg2.a': [0.001, 10], 'eg2.d': [0.003, 10], 'eg2.s': [0, 1], 'eg2.r': [0.003, 12],
  'vca.level': [0, 1], 'vca.vel': [0, 1], 'vca.bias': [0, 1],
  'ens.mix': [0, 100],
  'out.drive': [0, 10], 'out.bias': [-5, 5], 'out.sag': [0, 10], 'out.tone': [-5, 5], 'out.level': [-24, 12],
  'out.spkInt': [0, 10], 'out.rmMix': [0, 100], 'out.rmDecay': [0.2, 6], 'out.rmTone': [0, 10], 'out.width': [0, 200], 'out.wChar': [3, 20],
};
const TUBES = ['12AX7', '12AT7', '12AU7', '300B', 'EL84', '6V6', 'EL34', '6L6', 'KT88'];
export const C_ENUMS = {
  'vco1.wave': ['tri', 'saw', 'pulse', 'noise'], 'vco1.scale': [32, 16, 8, 4],
  'vco2.wave': ['saw', 'square', 'narrow', 'ring'], 'vco2.scale': [32, 16, 8, 4],
  'pm.dest': ['both', 'vco2'], 'ctl.trig': ['multi', 'single'],
  'drive.tube': TUBES, 'follow.tube': TUBES,
  'ens.mode': ['I', 'II', 'I+II', 'strings'],
  'out.tube': TUBES, 'out.topology': ['se', 'pp'],
  'out.cab': ['console', 'bakelite', 'horn', 'monitor'], 'out.room': ['living', 'studio', 'theater', 'hall'],
};
export const C_CATS = ['Bass', 'Lead', 'Sweep', 'Percussion', 'Effects', 'Halloween'];

// One cable per input (a jack takes one plug); an output may feed any number of inputs.
export function normCables(list) {
  const byIn = {};
  (Array.isArray(list) ? list : []).forEach(c => {
    if (!Array.isArray(c) || c.length < 2) return;
    const s = String(c[0]), d = String(c[1]);
    if (C_SRC.includes(s) && C_IN.includes(d)) { delete byIn[d]; byIn[d] = s; }
  });
  return Object.keys(byIn).map(d => [byIn[d], d]);
}

export function normalizeC(p) {
  const out = clone(C_DEFAULT);
  if (!p || typeof p !== 'object') return out;
  (function merge(dst, src, prefix) {
    Object.keys(dst).forEach(k => {
      const path = prefix ? prefix + '.' + k : k, d = dst[k], s = src ? src[k] : undefined;
      if (k === 'cables' && !prefix) return;
      if (d && typeof d === 'object' && !Array.isArray(d)) { merge(d, s && typeof s === 'object' ? s : null, path); return; }
      if (s === undefined || s === null) return;
      const e = C_ENUMS[path];
      if (e && typeof e[0] === 'number') { const n = +s; if (e.includes(n)) dst[k] = n; return; }
      if (typeof d === 'number') { const n = +s; if (!isFinite(n)) return; const r = RANGE[path]; dst[k] = r ? Math.min(r[1], Math.max(r[0], n)) : n; }
      else if (typeof d === 'boolean') dst[k] = !!s;
      else if (typeof d === 'string') { const v = String(s).slice(0, 60); if (!e || e.includes(v)) dst[k] = v; }
    });
  })(out, p, '');
  out.cables = normCables(p.cables);
  if (!C_CATS.includes(out.cat)) out.cat = 'Lead';
  out.device = 'cathode'; out.v = C_SCHEMA;
  return out;
}

// ---- factory set ----
// Differences from C_DEFAULT; normalizeC() fills the rest. Levels sit near -14 dBFS like Filament's.
const F = [
  { name: 'Grid Bias Bass', cat: 'Bass',
    vco1: { wave: 'saw', scale: 16, level: 0.8 }, vco2: { wave: 'square', scale: 32, level: 0.55 },
    drive: { tube: '12AX7', amount: 5 },
    lpf: { cutoff: 260, peak: 0.55, b: 0.62, kt: 0.4 },
    eg2: { a: 0.002, d: 0.22, s: 0.35, r: 0.12 },
    vca: { level: 0.9, vel: 0.4 },
    out: { level: 6, tube: '6L6', topology: 'pp', drive: 3.5, roomOn: true, room: 'studio', rmMix: 8, width: 100 } },
  { name: 'Plate Screamer', cat: 'Lead',
    vco1: { wave: 'saw', scale: 8, level: 0.8 }, vco2: { wave: 'saw', scale: 8, fine: 9, level: 0.6 },
    drive: { tube: '12AX7', amount: 6.5 },
    hpf: { cutoff: 240, peak: 0.62 },
    lpf: { cutoff: 900, peak: 0.84, b: 0.38, kt: 0.6 },
    eg2: { a: 0.01, d: 0.8, s: 0.55, r: 0.35 },
    ctl: { glide: 0.06, trig: 'single', wheel: 35 },
    follow: { tube: '12AX7', drive: 5 },
    vca: { level: 0.62 },
    ens: { on: false },
    out: { level: 1, tube: 'EL34', topology: 'pp', drive: 4, roomOn: true, room: 'theater', rmMix: 14, rmDecay: 1.6 } },
  { name: 'Bubble Lab', cat: 'Effects',
    vco1: { wave: 'pulse', scale: 8, pw: 0.3, level: 0.75 },
    lpf: { cutoff: 700, peak: 0.86, a: 0.42, b: 0.1, kt: 0.5 },
    mg: { rate: 7, shape: 0.5 },
    eg2: { a: 0.003, d: 1.2, s: 0.8, r: 0.6 },
    cables: [['sh', 'lpA']],
    vca: { level: 0.75 },
    out: { level: -3.5, roomOn: true, room: 'hall', rmMix: 20, rmDecay: 2.2 } },
  { name: 'Filter Kick', cat: 'Percussion',
    vco1: { level: 0 }, vco2: { level: 0 },
    lpf: { cutoff: 60, peak: 0.95, b: 0.36, kt: 0.25 },
    eg2: { a: 0.001, d: 0.32, s: 0, r: 0.32 },
    vca: { level: 0.9, vel: 0.6 },
    out: { level: 4.5, tube: '6V6', topology: 'pp', roomOn: true, room: 'studio', rmMix: 6, width: 100 } },
  { name: 'Ring Bells', cat: 'Percussion',
    vco1: { wave: 'tri', scale: 8, level: 0.35 }, vco2: { wave: 'ring', scale: 4, semi: 7, fine: 13, level: 0.8 },
    lpf: { cutoff: 4200, peak: 0.25, b: 0.2, kt: 0.8 },
    eg2: { a: 0.001, d: 1.6, s: 0, r: 1.4 },
    vca: { level: 0.85, vel: 0.5 },
    ens: { on: true, mode: 'I', mix: 30 },
    out: { level: 3.5, roomOn: true, room: 'hall', rmMix: 24, rmDecay: 2.8, width: 130 } },
  { name: 'Sync Sweep', cat: 'Sweep',
    vco1: { wave: 'saw', scale: 8, level: 0 }, vco2: { wave: 'saw', scale: 8, semi: 5, level: 0.85, sync: true },
    pm: { b: 19, dest: 'vco2' },
    eg1: { delay: 0, a: 0.7, r: 0.4 },
    lpf: { cutoff: 3200, peak: 0.3, b: 0.15, kt: 0.5 },
    eg2: { a: 0.004, d: 0.6, s: 0.7, r: 0.3 },
    ctl: { glide: 0.03 },
    vca: { level: 0.7 },
    out: { level: 1.5, tube: 'EL84', roomOn: true, room: 'studio', rmMix: 12 } },
  { name: 'Night Wind', cat: 'Effects',
    vco1: { wave: 'noise', level: 0.8 },
    hpf: { cutoff: 120, peak: 0.4 },
    lpf: { cutoff: 900, peak: 0.78, a: 0.36, b: 0.1, kt: 1 },
    mg: { rate: 0.13, shape: 0.5 },
    eg2: { a: 1.4, d: 1, s: 1, r: 2.5 },
    vca: { level: 0.95, vel: 0.2 },
    ens: { on: true, mode: 'II', mix: 35 },
    out: { level: 3, roomOn: true, room: 'hall', rmMix: 26, rmDecay: 3.5, width: 130 } },
  { name: 'Growl FM', cat: 'Bass',
    vco1: { wave: 'saw', scale: 16, level: 0.8 }, vco2: { wave: 'square', scale: 32, level: 0.2 },
    lpf: { cutoff: 380, peak: 0.6, b: 0.14, kt: 0.5 },
    cables: [['vco2', 'lpB']],
    eg2: { a: 0.004, d: 0.5, s: 0.7, r: 0.2 },
    drive: { amount: 5.5 },
    vca: { level: 0.75 },
    out: { level: 2.5, tube: 'KT88', topology: 'pp', drive: 4, roomOn: true, room: 'studio', rmMix: 8, width: 100 } },
  { name: 'Trill Gate', cat: 'Sweep',
    vco1: { wave: 'pulse', scale: 8, pw: 0.42, level: 0.8 }, vco2: { wave: 'saw', scale: 16, semi: 7, level: 0.4 },
    mg: { rate: 9, shape: 0.5 },
    cables: [['mgPulse', 'eg2Trig'], ['eg1', 'vca']],
    lpf: { cutoff: 700, peak: 0.62, b: 0.5, kt: 0.5 },
    eg1: { a: 0.003, r: 0.18 },
    eg2: { a: 0.002, d: 0.07, s: 0.1, r: 0.05 },
    vca: { level: 0.85 },
    ens: { on: true, mode: 'I+II', mix: 35 },
    out: { level: -5.5, roomOn: true, room: 'studio', rmMix: 16, width: 140 } },
  { name: 'Theremin Glide', cat: 'Lead',
    vco1: { wave: 'tri', scale: 8, level: 0.8 },
    lpf: { cutoff: 2400, peak: 0.2, b: 0.05, kt: 0.8 },
    pm: { a: 0.28 },
    mg: { rate: 5.6, shape: 0.5 },
    ctl: { glide: 0.28, trig: 'single', wheel: 60 },
    eg2: { a: 0.09, d: 0.5, s: 0.95, r: 0.5 },
    vca: { level: 0.9, vel: 0.2 },
    out: { level: -2.5, tube: '300B', topology: 'se', roomOn: true, room: 'theater', rmMix: 20, rmDecay: 1.8 } },
  { name: 'Hollow Reed', cat: 'Lead',
    vco1: { wave: 'pulse', scale: 8, pw: 0.18, level: 0.7 }, vco2: { wave: 'narrow', scale: 16, level: 0.3 },
    hpf: { cutoff: 520, peak: 0.7, kt: 0.7 },
    lpf: { cutoff: 2600, peak: 0.45, b: 0.2, kt: 0.6 },
    eg2: { a: 0.03, d: 0.4, s: 0.85, r: 0.25 },
    pm: { a: 0.12 }, mg: { rate: 5, shape: 0.5 },
    vca: { level: 0.8 },
    out: { level: -1.5, tube: 'EL84', roomOn: true, room: 'studio', rmMix: 14 } },
  { name: 'Chapel Organ', cat: 'Halloween',
    vco1: { wave: 'tri', scale: 8, level: 0.75 }, vco2: { wave: 'square', scale: 8, fine: 4, level: 0.35 },
    lpf: { cutoff: 2800, peak: 0.08, b: 0.05, kt: 0.35 },
    eg2: { a: 0.02, d: 0.3, s: 1, r: 0.7 },
    vca: { level: 0.8, vel: 0.15 },
    ens: { on: true, mode: 'I', mix: 25 },
    out: { level: 0, tube: '6V6', topology: 'se', drive: 3, roomOn: true, room: 'hall', rmMix: 26, rmDecay: 3, width: 110 } },
  { name: 'Wail Glide', cat: 'Halloween',
    vco1: { wave: 'tri', scale: 8, level: 0.85 },
    pm: { a: 2.4 }, mg: { rate: 5.2, shape: 0.5 },
    ctl: { glide: 0.48, trig: 'single', wheel: 70 },
    lpf: { cutoff: 1600, peak: 0.18, b: 0.08, kt: 0.7 },
    eg2: { a: 0.14, d: 0.5, s: 0.95, r: 0.9 },
    vca: { level: 0.85, vel: 0.1 },
    out: { level: -2, tube: '300B', topology: 'se', roomOn: true, room: 'theater', rmMix: 22, rmDecay: 2.2 } },
  { name: 'Cellar Drone', cat: 'Halloween',
    vco1: { wave: 'saw', scale: 16, level: 0.75 }, vco2: { wave: 'saw', scale: 16, fine: -14, level: 0.45 },
    lpf: { cutoff: 260, peak: 0.58, a: 0.34, kt: 0.25 },
    mg: { rate: 0.11, shape: 0.5 },
    eg2: { a: 0.9, d: 1, s: 1, r: 2.2 },
    drive: { amount: 4 },
    vca: { level: 0.8 },
    out: { level: 1, tube: '6L6', topology: 'pp', drive: 3, roomOn: true, room: 'living', rmMix: 14, width: 90 } },
  { name: 'Creak Pulse', cat: 'Halloween',
    vco1: { wave: 'noise', level: 0.55 }, vco2: { wave: 'saw', scale: 16, level: 0.35 },
    hpf: { cutoff: 180, peak: 0.35 },
    lpf: { cutoff: 520, peak: 0.7, a: 0.48, kt: 0.2 },
    mg: { rate: 0.17, shape: 0.2 },
    eg2: { a: 0.4, d: 0.8, s: 0.7, r: 1.2 },
    vca: { level: 0.75 },
    out: { level: -1, tube: 'EL34', topology: 'se', drive: 4, spkOn: true, cab: 'horn', spkInt: 6, roomOn: true, room: 'studio', rmMix: 12, width: 80 } },
  { name: 'Choir Breath', cat: 'Halloween',
    vco1: { wave: 'tri', scale: 8, level: 0.7 }, vco2: { wave: 'square', scale: 8, fine: 9, level: 0.22 },
    lpf: { cutoff: 1400, peak: 0.12, b: 0.1, kt: 0.5 },
    eg2: { a: 0.75, d: 1.1, s: 0.9, r: 1.8 },
    vca: { level: 0.8, vel: 0.15 },
    ens: { on: true, mode: 'strings', mix: 50 },
    out: { level: -1, tube: '300B', topology: 'se', roomOn: true, room: 'hall', rmMix: 30, rmDecay: 3.8, width: 130 } },
  { name: 'Heartbeat', cat: 'Halloween',
    vco1: { wave: 'tri', scale: 32, level: 0.95 }, vco2: { level: 0 },
    lpf: { cutoff: 140, peak: 0.35, b: 0.4, kt: 0.15 },
    eg2: { a: 0.001, d: 0.16, s: 0, r: 0.22 },
    vca: { level: 0.9, vel: 0.75 },
    out: { level: 4, tube: '6L6', topology: 'pp', drive: 3, roomOn: true, room: 'studio', rmMix: 6, width: 70 } },
  { name: 'Glass Tine', cat: 'Halloween',
    vco1: { wave: 'tri', scale: 4, level: 0.8 },
    lpf: { cutoff: 5200, peak: 0.16, b: 0.25, kt: 0.8 },
    eg2: { a: 0.001, d: 0.32, s: 0, r: 0.45 },
    vca: { level: 0.8, vel: 0.6 },
    out: { level: 2, tube: 'EL84', roomOn: true, room: 'hall', rmMix: 18, rmDecay: 2, width: 120 } },
  { name: 'Bell Jar', cat: 'Halloween',
    vco1: { wave: 'tri', scale: 8, level: 0.3 }, vco2: { wave: 'ring', scale: 4, semi: 7, fine: 11, level: 0.8 },
    lpf: { cutoff: 3400, peak: 0.22, b: 0.18, kt: 0.75 },
    eg2: { a: 0.001, d: 1.4, s: 0, r: 1.6 },
    vca: { level: 0.82, vel: 0.5 },
    ens: { on: true, mode: 'II', mix: 22 },
    out: { level: 2, tube: '300B', topology: 'se', roomOn: true, room: 'hall', rmMix: 28, rmDecay: 3.2, width: 125 } },
];
export const C_FACTORY = F.map(p => normalizeC(p));
