// Lattice patches: schema, parameter table, factory presets, dxrack/1 descriptor.
//
// Lattice is a wavetable instrument in the Filament rack. A patch is plain JSON
// with device: 'lattice'. The factory waveforms are generated in lattice-dsp.js.
// create(ctx, host) is attached in lattice-ui.js, because it builds the worklet.

import {
  normalizeLattice, defaultLattice, TABLE_IDS, WARP_IDS, MODE_IDS, ROUTE_IDS,
  SRC_IDS, DEST_IDS, LFO_N,
} from './lattice-dsp.js';

export {
  normalizeLattice, defaultLattice, TABLE_IDS, WARP_IDS, MODE_IDS, ROUTE_IDS,
  SRC_IDS, DEST_IDS, LFO_N,
};

export const LATTICE_SCHEMA = 1;
export const LATTICE_ID = 'lattice';
export const RACK_API = 'dxrack/1';

const CATS = ['Pad', 'Pluck', 'Bass', 'Keys', 'Lead', 'Texture'];
export const LATTICE_CATS = CATS;

function preset(name, cat, over) {
  return normalizeLattice(Object.assign({ name, cat, device: LATTICE_ID, v: LATTICE_SCHEMA }, over));
}

export const LATTICE_DEFAULT = defaultLattice();

export const LATTICE_FACTORY = [
  preset('Glass Pad', 'Pad', {
    level: 0.42,
    osc1: { table: 'glass', pos: 0.22, level: 0.62 },
    osc2: { table: 'vowel', pos: 0.38, fine: 7, level: 0.28 },
    unison: { count: 4, detune: 12, spread: 0.72 },
    filt: { route: 'serial', a: { mode: 'lp', cutoff: 2200, res: 0.16, env: 0.28 }, b: { mode: 'lp', cutoff: 6400, res: 0.05, env: 0 } },
    envA: { a: 0.55, d: 1.1, s: 0.82, r: 1.5 },
    envF: { a: 0.4, d: 0.9, s: 0.35, r: 1.2 },
    lfo1: { rate: 0.07 }, lfo2: { rate: 0.05 },
    matrix: [
      { src: 'lfo1', dest: 'osc1.pos', amt: 0.28 },
      { src: 'lfo2', dest: 'cutA', amt: 0.35 },
    ],
  }),
  preset('Soft Pluck', 'Pluck', {
    level: 0.48,
    osc1: { table: 'edge', pos: 0.62, level: 0.7 },
    osc2: { table: 'glass', pos: 0.1, level: 0.16, fine: -5 },
    unison: { count: 1, detune: 0, spread: 0 },
    filt: { route: 'serial', a: { mode: 'lp', cutoff: 780, res: 0.22, env: 0.72 }, b: { mode: 'hp', cutoff: 90, res: 0, env: 0 } },
    envA: { a: 0.002, d: 0.22, s: 0, r: 0.16 },
    envF: { a: 0.002, d: 0.14, s: 0, r: 0.12 },
    lfo1: { rate: 0.2 },
  }),
  preset('Root Bass', 'Bass', {
    level: 0.5,
    osc1: { table: 'hollow', pos: 0.4, oct: -1, level: 0.72 },
    osc2: { table: 'edge', pos: 0.2, oct: -1, level: 0.18, fine: 4 },
    sub: { level: 0.42 },
    unison: { count: 1, detune: 0, spread: 0 },
    filt: { route: 'serial', a: { mode: 'lp', cutoff: 240, res: 0.2, env: 0.45 }, b: { mode: 'lp', cutoff: 900, res: 0.08, env: 0.15 } },
    envA: { a: 0.004, d: 0.28, s: 0.72, r: 0.18 },
    envF: { a: 0.003, d: 0.18, s: 0.15, r: 0.16 },
  }),
  preset('Drift Cloth', 'Texture', {
    level: 0.36,
    osc1: { table: 'vowel', pos: 0.3, level: 0.55 },
    osc2: { table: 'brass', pos: 0.55, level: 0.32, fine: -8, semi: 0 },
    unison: { count: 3, detune: 9, spread: 0.85 },
    noise: { level: 0.04, color: 0.25 },
    filt: { route: 'parallel', a: { mode: 'lp', cutoff: 1400, res: 0.18, env: 0.2 }, b: { mode: 'bp', cutoff: 1800, res: 0.28, env: 0.1 } },
    envA: { a: 1.1, d: 1.4, s: 0.8, r: 1.8 },
    envM: { a: 0.8, d: 1.2, s: 0.4, r: 1.4 },
    lfo1: { rate: 0.04 }, lfo2: { rate: 0.06 }, lfo3: { rate: 0.03 },
    matrix: [
      { src: 'lfo1', dest: 'osc1.pos', amt: 0.45 },
      { src: 'lfo2', dest: 'osc2.pos', amt: -0.38 },
      { src: 'lfo3', dest: 'cutA', amt: 0.4 },
      { src: 'envM', dest: 'osc1.warp', amt: 0.2 },
    ],
  }),
  preset('Reed Key', 'Keys', {
    level: 0.46,
    osc1: { table: 'reed', pos: 0.58, level: 0.66 },
    osc2: { table: 'glass', pos: 0.2, level: 0.2, warp: 'pwm', warpAmt: 0.32, fine: 3 },
    unison: { count: 2, detune: 6, spread: 0.28 },
    filt: { route: 'serial', a: { mode: 'lp', cutoff: 2800, res: 0.1, env: 0.22 }, b: { mode: 'lp', cutoff: 7000, res: 0, env: 0 } },
    envA: { a: 0.008, d: 0.45, s: 0.55, r: 0.28 },
    envF: { a: 0.006, d: 0.3, s: 0.2, r: 0.25 },
  }),
  preset('Sync Bite', 'Lead', {
    level: 0.4,
    osc1: { table: 'edge', pos: 0.18, level: 0.7, warp: 'sync', warpAmt: 0.42 },
    osc2: { level: 0 },
    unison: { count: 1, detune: 0, spread: 0.15 },
    filt: { route: 'serial', a: { mode: 'lp', cutoff: 1600, res: 0.28, env: 0.55 }, b: { mode: 'hp', cutoff: 140, res: 0, env: 0 } },
    envA: { a: 0.004, d: 0.18, s: 0.45, r: 0.14 },
    envF: { a: 0.003, d: 0.16, s: 0.1, r: 0.12 },
    lfo1: { rate: 5.5 },
    matrix: [{ src: 'lfo1', dest: 'osc1.warp', amt: 0.18 }],
  }),
  preset('Night Fold', 'Texture', {
    level: 0.34,
    osc1: { table: 'glass', pos: 0.1, level: 0.58, warp: 'fm', warpAmt: 0.26 },
    osc2: { table: 'vowel', pos: 0.62, semi: 12, level: 0.22 },
    unison: { count: 2, detune: 8, spread: 0.55 },
    filt: { route: 'serial', a: { mode: 'lp', cutoff: 1900, res: 0.14, env: 0.3 }, b: { mode: 'lp', cutoff: 5200, res: 0.06, env: 0 } },
    envA: { a: 0.7, d: 1.2, s: 0.7, r: 1.6 },
    lfo2: { rate: 0.09 }, lfo4: { rate: 0.15 },
    matrix: [
      { src: 'lfo2', dest: 'osc1.pos', amt: 0.3 },
      { src: 'lfo4', dest: 'osc1.warp', amt: 0.22 },
      { src: 'm1', dest: 'cutA', amt: 0.5 },
    ],
    macros: [0.35, 0.4, 0.5, 0.2],
  }),
  preset('Choir Wash', 'Pad', {
    level: 0.38,
    osc1: { table: 'vowel', pos: 0.48, level: 0.58 },
    osc2: { table: 'vowel', pos: 0.72, level: 0.4, fine: -6, semi: 0 },
    unison: { count: 4, detune: 14, spread: 0.9 },
    filt: { route: 'serial', a: { mode: 'lp', cutoff: 2600, res: 0.12, env: 0.18 }, b: { mode: 'notch', cutoff: 1400, res: 0.2, env: 0 } },
    envA: { a: 0.85, d: 1.3, s: 0.86, r: 2 },
    lfo1: { rate: 0.05 }, lfo3: { rate: 0.08 },
    matrix: [
      { src: 'lfo1', dest: 'osc1.pos', amt: 0.22 },
      { src: 'lfo3', dest: 'osc2.pos', amt: 0.26 },
    ],
  }),
];

function floatParam(id, def, min, max) {
  return { id, label: id, type: 'float', default: def, min, max };
}
function intParam(id, def, min, max) {
  return { id, label: id, type: 'int', default: def, min, max };
}
function choiceParam(id, def, choices) {
  return { id, label: id, type: 'choice', choices: choices.slice(), default: def, min: 0, max: choices.length - 1 };
}

const D = LATTICE_DEFAULT;
export const LATTICE_PARAMETERS = {
  level: floatParam('level', D.level, 0, 1),
  bandlimit: { id: 'bandlimit', label: 'bandlimit', type: 'boolean', default: true, min: 0, max: 1 },
  'osc1.table': choiceParam('osc1.table', D.osc1.table, TABLE_IDS),
  'osc1.pos': floatParam('osc1.pos', D.osc1.pos, 0, 1),
  'osc1.oct': intParam('osc1.oct', D.osc1.oct, -2, 2),
  'osc1.semi': intParam('osc1.semi', D.osc1.semi, -12, 12),
  'osc1.fine': floatParam('osc1.fine', D.osc1.fine, -100, 100),
  'osc1.level': floatParam('osc1.level', D.osc1.level, 0, 1),
  'osc1.warp': choiceParam('osc1.warp', D.osc1.warp, WARP_IDS),
  'osc1.warpAmt': floatParam('osc1.warpAmt', D.osc1.warpAmt, 0, 1),
  'osc2.table': choiceParam('osc2.table', D.osc2.table, TABLE_IDS),
  'osc2.pos': floatParam('osc2.pos', D.osc2.pos, 0, 1),
  'osc2.oct': intParam('osc2.oct', D.osc2.oct, -2, 2),
  'osc2.semi': intParam('osc2.semi', D.osc2.semi, -12, 12),
  'osc2.fine': floatParam('osc2.fine', D.osc2.fine, -100, 100),
  'osc2.level': floatParam('osc2.level', D.osc2.level, 0, 1),
  'osc2.warp': choiceParam('osc2.warp', D.osc2.warp, WARP_IDS),
  'osc2.warpAmt': floatParam('osc2.warpAmt', D.osc2.warpAmt, 0, 1),
  'unison.count': intParam('unison.count', D.unison.count, 1, 4),
  'unison.detune': floatParam('unison.detune', D.unison.detune, 0, 50),
  'unison.spread': floatParam('unison.spread', D.unison.spread, 0, 1),
  'sub.level': floatParam('sub.level', D.sub.level, 0, 1),
  'noise.level': floatParam('noise.level', D.noise.level, 0, 1),
  'noise.color': floatParam('noise.color', D.noise.color, 0, 1),
  'filt.route': choiceParam('filt.route', D.filt.route, ROUTE_IDS),
  'filt.a.mode': choiceParam('filt.a.mode', D.filt.a.mode, MODE_IDS),
  'filt.a.cutoff': floatParam('filt.a.cutoff', D.filt.a.cutoff, 20, 18000),
  'filt.a.res': floatParam('filt.a.res', D.filt.a.res, 0, 0.92),
  'filt.a.env': floatParam('filt.a.env', D.filt.a.env, 0, 1),
  'filt.b.mode': choiceParam('filt.b.mode', D.filt.b.mode, MODE_IDS),
  'filt.b.cutoff': floatParam('filt.b.cutoff', D.filt.b.cutoff, 20, 18000),
  'filt.b.res': floatParam('filt.b.res', D.filt.b.res, 0, 0.92),
  'filt.b.env': floatParam('filt.b.env', D.filt.b.env, 0, 1),
  'envA.a': floatParam('envA.a', D.envA.a, 0.001, 8),
  'envA.d': floatParam('envA.d', D.envA.d, 0.001, 8),
  'envA.s': floatParam('envA.s', D.envA.s, 0, 1),
  'envA.r': floatParam('envA.r', D.envA.r, 0.001, 12),
  'envF.a': floatParam('envF.a', D.envF.a, 0.001, 8),
  'envF.d': floatParam('envF.d', D.envF.d, 0.001, 8),
  'envF.s': floatParam('envF.s', D.envF.s, 0, 1),
  'envF.r': floatParam('envF.r', D.envF.r, 0.001, 12),
  'envM.a': floatParam('envM.a', D.envM.a, 0.001, 8),
  'envM.d': floatParam('envM.d', D.envM.d, 0.001, 8),
  'envM.s': floatParam('envM.s', D.envM.s, 0, 1),
  'envM.r': floatParam('envM.r', D.envM.r, 0.001, 12),
  'lfo1.rate': floatParam('lfo1.rate', D.lfo1.rate, 0.02, 20),
  'lfo2.rate': floatParam('lfo2.rate', D.lfo2.rate, 0.02, 20),
  'lfo3.rate': floatParam('lfo3.rate', D.lfo3.rate, 0.02, 20),
  'lfo4.rate': floatParam('lfo4.rate', D.lfo4.rate, 0.02, 20),
  macro1: floatParam('macro1', D.macros[0], 0, 1),
  macro2: floatParam('macro2', D.macros[1], 0, 1),
  macro3: floatParam('macro3', D.macros[2], 0, 1),
  macro4: floatParam('macro4', D.macros[3], 0, 1),
};

export const SRC_LABELS = {
  lfo1: 'LFO 1', lfo2: 'LFO 2', lfo3: 'LFO 3', lfo4: 'LFO 4',
  envA: 'Amp env', envF: 'Filter env', envM: 'Mod env',
  vel: 'Velocity', wheel: 'Mod wheel',
  m1: 'Macro 1', m2: 'Macro 2', m3: 'Macro 3', m4: 'Macro 4',
};
export const DEST_LABELS = {
  'osc1.pos': 'Osc A position', 'osc2.pos': 'Osc B position',
  'osc1.warp': 'Osc A warp', 'osc2.warp': 'Osc B warp',
  cutA: 'Filter A cutoff', cutB: 'Filter B cutoff',
  amp: 'Level', noise: 'Noise', sub: 'Sub', detune: 'Detune',
};

export const latticeDevice = {
  id: LATTICE_ID,
  name: 'Lattice',
  vendor: 'DX Edge',
  version: String(LATTICE_SCHEMA),
  api: RACK_API,
  description: 'Wavetable synthesizer',
  instrument: true,
  audioInputs: 0,
  audioOutputs: 1,
  midiInput: true,
  midiOutput: false,
  processor: 'lattice',
  worklet: 'lattice.worklet.js',
  channels: 2,
  oversample: 2,
  parameters: LATTICE_PARAMETERS,
  normalize: normalizeLattice,
  factory: LATTICE_FACTORY,
  defaults: LATTICE_DEFAULT,
  sources: SRC_IDS.slice(),
  destinations: DEST_IDS.slice(),
  messages: ['patch', 'on', 'off', 'bend', 'mw', 'sus', 'panic', 'active', 'table', 'macro'],
};
