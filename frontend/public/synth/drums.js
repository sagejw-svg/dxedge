// Dekatron patches: schema, the parameter table, normalisation, the factory patterns.
//
// Dekatron is a drum device in the Filament rack. A patch is plain JSON with device:
// 'dekatron'. The voices and the 16-step pattern are its own. ens and out use the same
// shape as the other devices so a host mixer can pick them up; this page leaves the shared
// output chain alone (see drums-ui.js).

import { DEFAULT as F_DEFAULT, clone } from './patches.js';
import { VOICES, stepSeconds } from './drums-dsp.js';

export { VOICES, stepSeconds };
export const DRUM_SCHEMA = 1;
export const DRUM_ID = 'dekatron';

// Pitch class on the keyboard: every octave plays the same voice.
// C kick, C# rim, D snare, D# clap, F tom, F# closed hat, A# open hat.
const PITCH_CLASS = { 0: 'kick', 1: 'rim', 2: 'snare', 3: 'clap', 5: 'tom', 6: 'hatC', 10: 'hatO' };
export function voiceForNote(n) {
  if (!isFinite(+n)) return null;
  return PITCH_CLASS[((+n % 12) + 12) % 12] || null;
}

const VOICE_RANGE = {
  kick:  { tune: [32, 140], decay: [0.05, 1.4], color: [0, 1], attack: [0, 1], level: [0, 1], pan: [-1, 1] },
  snare: { tune: [90, 420], decay: [0.04, 0.8], color: [0, 1], attack: [0, 1], level: [0, 1], pan: [-1, 1] },
  hatC:  { tune: [180, 900], decay: [0.008, 0.2], color: [0, 1], attack: [0, 1], level: [0, 1], pan: [-1, 1] },
  hatO:  { tune: [180, 900], decay: [0.08, 1.4], color: [0, 1], attack: [0, 1], level: [0, 1], pan: [-1, 1] },
  clap:  { tune: [400, 2800], decay: [0.06, 0.8], color: [0, 1], attack: [0, 1], level: [0, 1], pan: [-1, 1] },
  tom:   { tune: [55, 280], decay: [0.06, 1.1], color: [0, 1], attack: [0, 1], level: [0, 1], pan: [-1, 1] },
  rim:   { tune: [280, 2400], decay: [0.008, 0.16], color: [0, 1], attack: [0, 1], level: [0, 1], pan: [-1, 1] },
};
const SEQ_RANGE = { bpm: [40, 240], swing: [0, 1], length: [1, 16], accentAmt: [0, 1] };

function voiceDefaults(over) {
  return {
    kick:  { tune: 51, decay: 0.42, color: 0.42, attack: 0.72, level: 0.92, pan: 0 },
    snare: { tune: 188, decay: 0.2, color: 0.64, attack: 0.4, level: 0.78, pan: 0.06 },
    hatC:  { tune: 340, decay: 0.038, color: 0.58, attack: 0, level: 0.36, pan: 0.28 },
    hatO:  { tune: 318, decay: 0.46, color: 0.5, attack: 0, level: 0.34, pan: 0.34 },
    clap:  { tune: 1050, decay: 0.24, color: 0.35, attack: 0.4, level: 0.62, pan: -0.14 },
    tom:   { tune: 118, decay: 0.34, color: 0.22, attack: 0.6, level: 0.74, pan: -0.38 },
    rim:   { tune: 860, decay: 0.03, color: 0.4, attack: 0, level: 0.52, pan: 0.48 },
    ...over,
  };
}

function row(s) {
  const t = String(s || '').padEnd(16, '.').slice(0, 16);
  return Array.from(t, ch => (ch === '.' || ch === '0' || ch === ' ' ? 0 : 1));
}
function stepsFrom(spec) {
  const out = {};
  VOICES.forEach(id => { out[id] = row(spec && spec[id]); });
  return out;
}

const INIT_STEPS = {
  kick:  'x...x...x...x...',
  snare: '....x.......x...',
  hatC:  'x.x.x.x.x.x.x.x.',
  hatO:  '..............x.',
  clap:  '....x.......x...',
  tom:   '..............xx',
  rim:   '..x...x...x.....',
};

export const DRUM_DEFAULT = {
  v: DRUM_SCHEMA, device: DRUM_ID, name: 'Init', cat: 'Groove',
  level: 0.82,
  seq: { bpm: 118, swing: 0, length: 16, accentAmt: 0.55, clock: 'internal' },
  voices: voiceDefaults(),
  steps: stepsFrom(INIT_STEPS),
  accent: row('x...x...x...x...'),
  // Same output fields as the other devices, for a host that applies them. The page
  // currently does not: Dekatron sums into the chain the selected synth already set.
  stereo: clone(F_DEFAULT.stereo),
  ens: clone(F_DEFAULT.ens),
  out: clone(F_DEFAULT.out),
};

function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
function normVoice(id, src) {
  const d = DRUM_DEFAULT.voices[id], r = VOICE_RANGE[id], out = {};
  Object.keys(d).forEach(k => {
    const n = src && src[k] != null ? +src[k] : d[k];
    out[k] = isFinite(n) ? clamp(n, r[k][0], r[k][1]) : d[k];
  });
  return out;
}

const DRUM_CATS_LIST = ['Groove', 'Shuffle', 'Sparse'];
export function normalizeDrum(p) {
  const out = clone(DRUM_DEFAULT);
  if (!p || typeof p !== 'object') return out;
  if (typeof p.name === 'string' && p.name.trim()) out.name = p.name.trim().slice(0, 40);
  if (DRUM_CATS_LIST.includes(p.cat)) out.cat = p.cat;
  if (p.level != null && isFinite(+p.level)) out.level = clamp(+p.level, 0, 1);
  const s = p.seq || {};
  Object.keys(SEQ_RANGE).forEach(k => {
    if (s[k] == null || !isFinite(+s[k])) return;
    out.seq[k] = clamp(+s[k], SEQ_RANGE[k][0], SEQ_RANGE[k][1]);
  });
  out.seq.length = Math.round(out.seq.length);
  out.seq.clock = s.clock === 'external' ? 'external' : 'internal';
  VOICES.forEach(id => { out.voices[id] = normVoice(id, p.voices && p.voices[id]); });
  const steps = p.steps || {};
  VOICES.forEach(id => {
    const rowIn = Array.isArray(steps[id]) ? steps[id] : null;
    if (!rowIn) return;
    out.steps[id] = Array.from({ length: 16 }, (_, i) => (+rowIn[i] > 0 ? 1 : 0));
  });
  if (Array.isArray(p.accent)) out.accent = Array.from({ length: 16 }, (_, i) => (+p.accent[i] > 0 ? 1 : 0));
  ['stereo', 'ens', 'out'].forEach(k => {
    if (!p[k] || typeof p[k] !== 'object') return;
    Object.keys(out[k]).forEach(f => {
      if (p[k][f] == null) return;
      const d = out[k][f];
      if (typeof d === 'number' && isFinite(+p[k][f])) out[k][f] = +p[k][f];
      else if (typeof d === 'boolean') out[k][f] = !!p[k][f];
      else if (typeof d === 'string') out[k][f] = String(p[k][f]).slice(0, 40);
    });
  });
  out.device = DRUM_ID; out.v = DRUM_SCHEMA;
  return out;
}

const VOICE_KNOB = {
  tune: 'Hz', decay: 's', color: '', attack: '', level: '', pan: '',
};
const VOICE_LABEL = {
  kick: 'Kick', snare: 'Snare', hatC: 'Closed hat', hatO: 'Open hat', clap: 'Clap', tom: 'Tom', rim: 'Rim',
};
export const VOICE_LABELS = VOICE_LABEL;

// Stable ids for a host parameter list. Steps and the accent lane are pattern data, not knobs.
export const DRUM_PARAMETERS = [
  { id: 'level', name: 'Level', min: 0, max: 1, default: DRUM_DEFAULT.level, unit: '' },
  { id: 'seq.bpm', name: 'Tempo', min: 40, max: 240, default: DRUM_DEFAULT.seq.bpm, unit: 'bpm' },
  { id: 'seq.swing', name: 'Swing', min: 0, max: 1, default: 0, unit: '' },
  { id: 'seq.length', name: 'Length', min: 1, max: 16, default: 16, unit: 'steps' },
  { id: 'seq.accentAmt', name: 'Accent', min: 0, max: 1, default: DRUM_DEFAULT.seq.accentAmt, unit: '' },
].concat(VOICES.flatMap(id => Object.keys(VOICE_KNOB).map(k => ({
  id: 'voices.' + id + '.' + k,
  name: VOICE_LABEL[id] + ' ' + k,
  min: VOICE_RANGE[id][k][0], max: VOICE_RANGE[id][k][1],
  default: DRUM_DEFAULT.voices[id][k], unit: VOICE_KNOB[k],
}))));

export const DRUM_CATS = DRUM_CATS_LIST;

function pat(partial) {
  const p = normalizeDrum({
    name: partial.name, cat: partial.cat, level: partial.level,
    seq: partial.seq,
    voices: partial.voices,
    steps: partial.steps ? stepsFrom(partial.steps) : undefined,
    accent: partial.accent ? row(partial.accent) : undefined,
    ens: partial.ens, out: partial.out,
  });
  // stepsFrom already returns 0/1 arrays; normalizeDrum accepts those.
  return p;
}

export const DRUM_FACTORY = [
  pat({
    name: 'Relay', cat: 'Groove',
    seq: { bpm: 118, swing: 0, length: 16, accentAmt: 0.6 },
    steps: INIT_STEPS, accent: 'x...x...x...x...',
    out: { level: -1, roomOn: false, wOn: true, width: 110 },
  }),
  pat({
    name: 'Late Shift', cat: 'Shuffle',
    seq: { bpm: 104, swing: 0.92, length: 16, accentAmt: 0.45 },
    steps: {
      kick: 'x...x...x...x...', snare: '....x.......x...', hatC: 'x.x.x.x.x.x.x.x.',
      hatO: '........x.......', clap: '....x.......x...', rim: '..x.....x...x...', tom: '............x.x.',
    },
    accent: 'x...x...x.......',
    voices: { hatC: { level: 0.3 }, hatO: { decay: 0.32, level: 0.3 } },
  }),
  pat({
    name: 'Brush', cat: 'Sparse',
    seq: { bpm: 92, swing: 0.28, length: 16, accentAmt: 0.3 },
    level: 0.7,
    steps: {
      kick: 'x.......x.......', snare: '....x.......x..x', hatC: 'x.x.x.x.x.x.x.x.',
      rim: 'x.x.x.x.x.x.x.x.', tom: '............x.xx', clap: '....x.......x...', hatO: '..............x.',
    },
    accent: 'x.......x.......',
    voices: { kick: { level: 0.7, decay: 0.3 }, snare: { color: 0.35, level: 0.55 }, hatC: { level: 0.22 }, rim: { level: 0.4 } },
  }),
  pat({
    name: 'Spark', cat: 'Groove',
    seq: { bpm: 132, swing: 0.12, length: 16, accentAmt: 0.7 },
    steps: {
      kick: 'x..x..x.x...x...', snare: '....x..x....x...', hatC: 'xxxxxxxxxxxxxxxx',
      hatO: '..x...x...x...x.', clap: '....x.......x...', tom: '..............xx', rim: 'x...x...x...x...',
    },
    accent: 'x...x...x...x...',
    voices: { hatC: { decay: 0.028, level: 0.26 }, kick: { decay: 0.28, attack: 0.8 } },
  }),
  pat({
    name: 'Walk', cat: 'Groove',
    seq: { bpm: 100, swing: 0, length: 16, accentAmt: 0.4 },
    steps: {
      kick: 'x.......x....x..', tom: '..x.x.....x.x.xx', snare: '....x.......x...',
      hatC: 'x.x.x.x.x.x.x.x.', rim: '........x.......', clap: '....x.......x...', hatO: '..............x.',
    },
    accent: 'x...x...x...x...',
    voices: { tom: { tune: 96, decay: 0.42, level: 0.8, pan: -0.2 } },
  }),
  pat({
    name: 'Dozen', cat: 'Sparse',
    seq: { bpm: 120, swing: 0, length: 12, accentAmt: 0.5 },
    steps: {
      kick: 'x..x..x..x......', snare: '...x.....x....', hatC: 'xxxxxxxxxxxx....',
      clap: '...x.....x....', rim: 'x..x..x..x..x...', tom: '..........x.x...', hatO: '...........x....',
    },
    accent: 'x..x..x..x......',
  }),
];

// What a host (this page today, the rack framework later) can call.
export const drumDevice = {
  id: DRUM_ID,
  name: 'Dekatron',
  version: DRUM_SCHEMA,
  processor: 'dekatron',
  worklet: 'drums.worklet.js',
  channels: 2,
  oversample: 2,
  voices: VOICES.slice(),
  parameters: DRUM_PARAMETERS,
  voiceForNote,
  normalize: normalizeDrum,
  factory: DRUM_FACTORY,
  defaults: DRUM_DEFAULT,
  // Internal clock fires step i at stepSeconds(i). External clock waits for {t:'tick'}
  // (optional `at` frame) after {t:'transport', playing:true}, one tick per step.
  clock: { modes: ['internal', 'external'], stepSeconds },
  messages: ['patch', 'trig', 'transport', 'tick', 'panic', 'active'],
};
