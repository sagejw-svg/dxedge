// Thyratron patches: schema, normalisation, the parameter ranges, and the factory set.
//
// Thyratron is a monophonic ladder-filter synthesizer in the Filament rack. A patch
// is plain JSON with device: 'thyratron'. Oscillators, the mixer, the ladder, the
// two contours and the wheel depths are its own. Nothing here is taken from another
// instrument's panel or preset list.

export const THY_SCHEMA = 1;
export const THY_ID = 'thyratron';

export const THY_CATS = ['Bass', 'Lead', 'Brass', 'FX', 'Halloween'];

const WAVES = ['tri', 'saw', 'mix', 'square', 'wide', 'narrow'];
const RANGES = ['lo', '32', '16', '8', '4', '2'];
const MOD_SRC = ['osc3', 'noise'];

const OSC = {
  wave: WAVES,
  range: RANGES,
};

export const THY_ENUMS = {
  'osc1.wave': WAVES, 'osc1.range': RANGES,
  'osc2.wave': WAVES, 'osc2.range': RANGES,
  'osc3.wave': WAVES, 'osc3.range': RANGES,
  'mod.src': MOD_SRC,
};

export const THY_RANGE = {
  tune: [-100, 100],
  glide: [0, 3],
  bend: [0, 12],
  level: [0, 1],
  'osc1.tune': [-12, 12], 'osc1.level': [0, 1],
  'osc2.tune': [-12, 12], 'osc2.level': [0, 1],
  'osc3.tune': [-12, 12], 'osc3.level': [0, 1], 'osc3.rate': [0.05, 40],
  'mix.noise': [0, 1], 'mix.fb': [0, 1],
  'filt.cutoff': [20, 16000], 'filt.res': [0, 1], 'filt.drive': [0, 1],
  'filt.track': [0, 1], 'filt.env': [0, 1],
  'loud.a': [0.001, 4], 'loud.d': [0.003, 8], 'loud.s': [0, 1],
  'cont.a': [0.001, 4], 'cont.d': [0.003, 8], 'cont.s': [0, 1],
  'mod.pitch': [0, 12], 'mod.cut': [0, 4],
};

export const THY_DEFAULT = {
  v: THY_SCHEMA, device: THY_ID, name: 'Init', cat: 'Bass',
  tune: 0,
  glide: 0,
  bend: 2,
  level: 0.75,
  osc1: { wave: 'saw', range: '16', tune: 0, level: 0.8 },
  osc2: { wave: 'saw', range: '16', tune: 0.06, level: 0 },
  osc3: { wave: 'tri', range: '8', tune: 0, level: 0, lfo: false, rate: 4 },
  mix: { noise: 0, fb: 0 },
  filt: { cutoff: 800, res: 0.22, drive: 0.3, track: 0.35, env: 0.4 },
  loud: { a: 0.005, d: 0.35, s: 0.8 },
  cont: { a: 0.004, d: 0.4, s: 0.25 },
  mod: { src: 'osc3', pitch: 0, cut: 0 },
};

function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
function num(v, d, a, b) {
  const n = v == null ? d : +v;
  return isFinite(n) ? clamp(n, a, b) : d;
}
function choice(v, list, d) { return list.includes(v) ? v : d; }

function normOsc(src, d) {
  const s = src && typeof src === 'object' ? src : {};
  return {
    wave: choice(s.wave, WAVES, d.wave),
    range: choice(s.range, RANGES, d.range),
    tune: num(s.tune, d.tune, -12, 12),
    level: num(s.level, d.level, 0, 1),
  };
}

export function normalizeThy(p) {
  const d = THY_DEFAULT;
  const src = p && typeof p === 'object' ? p : {};
  const o3 = src.osc3 && typeof src.osc3 === 'object' ? src.osc3 : {};
  const mix = src.mix && typeof src.mix === 'object' ? src.mix : {};
  const filt = src.filt && typeof src.filt === 'object' ? src.filt : {};
  const loud = src.loud && typeof src.loud === 'object' ? src.loud : {};
  const cont = src.cont && typeof src.cont === 'object' ? src.cont : {};
  const mod = src.mod && typeof src.mod === 'object' ? src.mod : {};
  const name = typeof src.name === 'string' && src.name.trim() ? src.name.trim().slice(0, 40) : d.name;
  return {
    v: THY_SCHEMA,
    device: THY_ID,
    name,
    cat: THY_CATS.includes(src.cat) ? src.cat : d.cat,
    tune: num(src.tune, d.tune, -100, 100),
    glide: num(src.glide, d.glide, 0, 3),
    bend: Math.round(num(src.bend, d.bend, 0, 12)),
    level: num(src.level, d.level, 0, 1),
    osc1: normOsc(src.osc1, d.osc1),
    osc2: normOsc(src.osc2, d.osc2),
    osc3: Object.assign(normOsc(src.osc3, d.osc3), {
      lfo: !!(o3.lfo),
      rate: num(o3.rate, d.osc3.rate, 0.05, 40),
    }),
    mix: {
      noise: num(mix.noise, d.mix.noise, 0, 1),
      fb: num(mix.fb, d.mix.fb, 0, 1),
    },
    filt: {
      cutoff: num(filt.cutoff, d.filt.cutoff, 20, 16000),
      res: num(filt.res, d.filt.res, 0, 1),
      drive: num(filt.drive, d.filt.drive, 0, 1),
      track: num(filt.track, d.filt.track, 0, 1),
      env: num(filt.env, d.filt.env, 0, 1),
    },
    loud: {
      a: num(loud.a, d.loud.a, 0.001, 4),
      d: num(loud.d, d.loud.d, 0.003, 8),
      s: num(loud.s, d.loud.s, 0, 1),
    },
    cont: {
      a: num(cont.a, d.cont.a, 0.001, 4),
      d: num(cont.d, d.cont.d, 0.003, 8),
      s: num(cont.s, d.cont.s, 0, 1),
    },
    mod: {
      src: choice(mod.src, MOD_SRC, d.mod.src),
      pitch: num(mod.pitch, d.mod.pitch, 0, 12),
      cut: num(mod.cut, d.mod.cut, 0, 4),
    },
  };
}

function preset(partial) {
  return normalizeThy(partial);
}

export const THY_FACTORY = [
  preset({
    name: 'Walnut Bass', cat: 'Bass', level: 0.7, glide: 0.03,
    osc1: { wave: 'saw', range: '16', tune: 0, level: 0.9 },
    osc2: { wave: 'saw', range: '16', tune: 0.07, level: 0.78 },
    osc3: { wave: 'square', range: '32', tune: -0.05, level: 0.42, lfo: false, rate: 3 },
    mix: { noise: 0.05, fb: 0.16 },
    filt: { cutoff: 180, res: 0.32, drive: 0.62, track: 0.4, env: 0.48 },
    loud: { a: 0.004, d: 0.5, s: 0.9 },
    cont: { a: 0.003, d: 0.22, s: 0.15 },
    mod: { src: 'osc3', pitch: 0.2, cut: 0.15 },
  }),
  preset({
    name: 'Pilot Lead', cat: 'Lead', level: 0.86, glide: 0.08, bend: 2,
    osc1: { wave: 'saw', range: '8', tune: 0, level: 0.82 },
    osc2: { wave: 'square', range: '8', tune: 0.06, level: 0.55 },
    osc3: { wave: 'tri', range: '8', tune: 0, level: 0, lfo: true, rate: 5.2 },
    mix: { noise: 0, fb: 0.08 },
    filt: { cutoff: 720, res: 0.48, drive: 0.34, track: 0.72, env: 0.46 },
    loud: { a: 0.008, d: 0.35, s: 0.82 },
    cont: { a: 0.006, d: 0.32, s: 0.4 },
    mod: { src: 'osc3', pitch: 0.35, cut: 0.45 },
  }),
  preset({
    name: 'Herald Brass', cat: 'Brass', level: 0.66, glide: 0.04, bend: 2,
    osc1: { wave: 'saw', range: '8', tune: 0, level: 0.8 },
    osc2: { wave: 'saw', range: '4', tune: 0.04, level: 0.48 },
    osc3: { wave: 'saw', range: '16', tune: -0.08, level: 0.22, lfo: false, rate: 3 },
    mix: { noise: 0.02, fb: 0.05 },
    filt: { cutoff: 240, res: 0.4, drive: 0.28, track: 0.85, env: 0.72 },
    loud: { a: 0.03, d: 0.4, s: 0.88 },
    cont: { a: 0.045, d: 0.38, s: 0.52 },
    mod: { src: 'osc3', pitch: 0.1, cut: 0.2 },
  }),
  preset({
    name: 'Arc Sweep', cat: 'FX', level: 0.6, glide: 0.12,
    osc1: { wave: 'saw', range: '8', tune: 0, level: 0.7 },
    osc2: { wave: 'mix', range: '8', tune: 0.12, level: 0.4 },
    osc3: { wave: 'tri', range: 'lo', tune: 0, level: 0, lfo: true, rate: 0.18 },
    mix: { noise: 0.12, fb: 0.1 },
    filt: { cutoff: 140, res: 0.72, drive: 0.22, track: 0.25, env: 0.92 },
    loud: { a: 0.08, d: 1.4, s: 0.75 },
    cont: { a: 1.1, d: 1.6, s: 0.15 },
    mod: { src: 'osc3', pitch: 0.25, cut: 0.7 },
  }),
  preset({
    name: 'Crypt Wail', cat: 'Halloween', level: 0.82, glide: 0.45, bend: 5,
    osc1: { wave: 'tri', range: '8', tune: 0, level: 0.75 },
    osc2: { wave: 'saw', range: '4', tune: 0.09, level: 0.22 },
    osc3: { wave: 'tri', range: 'lo', tune: 0, level: 0, lfo: true, rate: 0.35 },
    mix: { noise: 0.08, fb: 0.22 },
    filt: { cutoff: 520, res: 0.86, drive: 0.18, track: 0.55, env: 0.35 },
    loud: { a: 0.2, d: 0.9, s: 0.7 },
    cont: { a: 0.35, d: 1.2, s: 0.4 },
    mod: { src: 'osc3', pitch: 0.7, cut: 0.55 },
  }),
  preset({
    name: 'Bone Rattle', cat: 'Halloween', level: 0.68, glide: 0,
    osc1: { wave: 'narrow', range: '16', tune: 0, level: 0.85 },
    osc2: { wave: 'narrow', range: '8', tune: 0.11, level: 0.55 },
    osc3: { wave: 'square', range: '2', tune: 0, level: 0.15, lfo: true, rate: 7.5 },
    mix: { noise: 0.28, fb: 0.04 },
    filt: { cutoff: 1400, res: 0.58, drive: 0.48, track: 0.3, env: 0.62 },
    loud: { a: 0.001, d: 0.12, s: 0 },
    cont: { a: 0.001, d: 0.08, s: 0 },
    mod: { src: 'noise', pitch: 0.15, cut: 0.35 },
  }),
];

export const THY_WAVES = WAVES;
export const THY_RANGES = RANGES;
export { OSC };
