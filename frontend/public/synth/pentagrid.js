// Pentagrid patches. Schema v1, device 'pentagrid'.
//
// Pentagrid is a shortwave receiver in the Filament rack. The name is the
// converter tube of a superheterodyne (a pentagrid), not another product.
// Every sound is synthesized here: band noise, crackle, fading, heterodynes,
// formant speech, Morse, FSK, chimes, digit tones and time pips. No broadcast
// recording is used, and no station call sign from the air is copied.

import { parameterTable, RACK_API, registerDevice } from './device.js';

export { RACK_API };
export const PENTA_SCHEMA = 1;
export const PENTA_ID = 'pentagrid';

export const MODES = ['am', 'usb', 'lsb', 'cw', 'rtty'];
export const PENTA_CATS = ['CW', 'Voice', 'Figures', 'RTTY', 'Time', 'Play'];

const TUNE = [3500, 30000];
const BFO = [-2500, 2500];
const BANDWIDTH = [80, 8000];

export const PENTA_RANGE = {
  level: [0, 1],
  tune: TUNE,
  bfo: BFO,
  bandwidth: BANDWIDTH,
  agc: [0, 1],
  blanker: [0, 1],
  fade: [0, 1],
  cond: [0, 1],
  noise: [0, 1],
  crackle: [0, 1],
  air: [0, 1],
  wpm: [5, 40],
  seed: [1, 9999],
};

export const PENTA_ENUMS = {
  mode: MODES,
};

// Stations on the dial. Frequencies are round numbers in the shortwave range.
// Names are ours. Nothing here is a broadcast schedule or a recording.
export const PENTA_BAND = [
  { khz: 3560, kind: 'cw', name: 'Night Watch' },
  { khz: 5000, kind: 'time', name: 'Second Marks' },
  { khz: 6175, kind: 'figures', name: 'Glass Count' },
  { khz: 7265, kind: 'ssb', name: 'Round Table' },
  { khz: 10000, kind: 'time', name: 'Long Mark' },
  { khz: 14000, kind: 'carrier', name: 'Bare Carrier' },
  { khz: 14020, kind: 'cw', name: 'Call Exchange' },
  { khz: 14085, kind: 'rtty', name: 'Shift Pair' },
  { khz: 14270, kind: 'ssb', name: 'Off Tune' },
  { khz: 15110, kind: 'whistle', name: 'Twin Beat', split: 0.035 },
  { khz: 17540, kind: 'figures', name: 'Fifth Group' },
  { khz: 21025, kind: 'cw', name: 'High Path' },
  { khz: 21420, kind: 'ssb', name: 'Open Path' },
];

const HAM = [
  [1800, 2000, '160m'],
  [3500, 4000, '80m'],
  [5300, 5450, '60m'],
  [7000, 7300, '40m'],
  [10100, 10150, '30m'],
  [14000, 14350, '20m'],
  [18068, 18168, '17m'],
  [21000, 21450, '15m'],
  [24890, 24990, '12m'],
  [28000, 29700, '10m'],
  [50000, 54000, '6m'],
];

const COND_VALUE = { poor: 0.15, fair: 0.4, good: 0.7, excellent: 0.95 };

export const PENTA_DEFAULT = {
  v: PENTA_SCHEMA,
  device: PENTA_ID,
  name: 'Eighty Night',
  cat: 'CW',
  level: 0.78,
  tune: 3560,
  bfo: 680,
  bandwidth: 480,
  agc: 0.45,
  blanker: 0.4,
  fade: 0.55,
  cond: 0.48,
  noise: 0.38,
  crackle: 0.32,
  air: 1,
  mode: 'cw',
  play: false,
  wpm: 16,
  seed: 4,
  text: 'CQ CQ DE',
};

function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
function num(v, d, a, b) {
  const n = v == null ? d : +v;
  return isFinite(n) ? clamp(n, a, b) : d;
}

export function normalizePentagrid(p) {
  const d = PENTA_DEFAULT;
  const src = p && typeof p === 'object' ? p : {};
  const name = typeof src.name === 'string' && src.name.trim() ? src.name.trim().slice(0, 40) : d.name;
  const text = typeof src.text === 'string' ? src.text.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) : d.text;
  return {
    v: PENTA_SCHEMA,
    device: PENTA_ID,
    name,
    cat: PENTA_CATS.includes(src.cat) ? src.cat : d.cat,
    level: num(src.level, d.level, 0, 1),
    tune: num(src.tune, d.tune, TUNE[0], TUNE[1]),
    bfo: num(src.bfo, d.bfo, BFO[0], BFO[1]),
    bandwidth: num(src.bandwidth, d.bandwidth, BANDWIDTH[0], BANDWIDTH[1]),
    agc: num(src.agc, d.agc, 0, 1),
    blanker: num(src.blanker, d.blanker, 0, 1),
    fade: num(src.fade, d.fade, 0, 1),
    cond: num(src.cond, d.cond, 0, 1),
    noise: num(src.noise, d.noise, 0, 1),
    crackle: num(src.crackle, d.crackle, 0, 1),
    air: num(src.air, d.air, 0, 1),
    mode: MODES.includes(src.mode) ? src.mode : d.mode,
    play: src.play == null ? d.play : !!src.play,
    wpm: Math.round(num(src.wpm, d.wpm, 5, 40)),
    seed: Math.round(num(src.seed, d.seed, 1, 9999)),
    text,
  };
}

function preset(partial) { return normalizePentagrid(partial); }

export const PENTA_FACTORY = [
  preset({ name: 'Eighty Night', cat: 'CW' }),
  preset({
    name: 'Off Tune', cat: 'Voice', tune: 14270, mode: 'usb', bfo: 0, bandwidth: 2800,
    agc: 0.35, blanker: 0.2, fade: 0.42, cond: 0.62, noise: 0.22, crackle: 0.12,
    air: 1, play: false, text: '', wpm: 18,
  }),
  preset({
    name: 'Glass Count', cat: 'Figures', tune: 6175, mode: 'am', bfo: 0, bandwidth: 4200,
    agc: 0.3, blanker: 0.25, fade: 0.18, cond: 0.7, noise: 0.14, crackle: 0.08,
    air: 1, play: false, text: '',
  }),
  preset({
    name: 'Shift Pair', cat: 'RTTY', tune: 14085, mode: 'rtty', bfo: 0, bandwidth: 3200,
    agc: 0.25, blanker: 0.15, fade: 0.22, cond: 0.66, noise: 0.12, crackle: 0.05,
    air: 1, play: false, text: '',
  }),
  preset({
    name: 'Second Marks', cat: 'Time', tune: 10000, mode: 'am', bfo: 0, bandwidth: 1800,
    agc: 0.2, blanker: 0.5, fade: 0.08, cond: 0.8, noise: 0.08, crackle: 0.04,
    air: 1, play: false, text: '',
  }),
  preset({
    name: 'Play the Air', cat: 'Play', tune: 14000, mode: 'cw', bfo: 0, bandwidth: 1600,
    agc: 0.15, blanker: 0.2, fade: 0.12, cond: 0.75, noise: 0.1, crackle: 0.06,
    air: 0.4, play: true, text: '', level: 0.8,
  }),
];

// ITU Morse, written out for this device. Timing is the standard element,
// letter and word spacing: a dit is 1.2/WPM seconds, a dah is three dits,
// the gap inside a letter is one dit, between letters three, between words seven.
export const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.',
  G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..',
  M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.',
  S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-',
  5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
};

export function ditSeconds(wpm) {
  return 1.2 / Math.max(1, +wpm || 1);
}

// Marks are on-intervals in seconds. Spaces are the gaps between them.
export function morsePlan(text, wpm, t0) {
  const unit = ditSeconds(wpm);
  const marks = [];
  let t = t0 || 0;
  const words = String(text || '').toUpperCase().split(/\s+/).filter(Boolean);
  words.forEach((word, wi) => {
    const letters = [...word].filter(ch => MORSE[ch]);
    letters.forEach((ch, li) => {
      const code = MORSE[ch];
      for (let si = 0; si < code.length; si++) {
        const dur = (code[si] === '-' ? 3 : 1) * unit;
        marks.push({ t0: t, t1: t + dur, el: code[si] });
        t += dur;
        if (si < code.length - 1) t += unit;
      }
      if (li < letters.length - 1) t += 3 * unit;
    });
    if (wi < words.length - 1) t += 7 * unit;
  });
  return marks;
}

export function planSpan(marks, wpm) {
  if (!marks.length) return 0;
  return marks[marks.length - 1].t1 + 7 * ditSeconds(wpm);
}

function mulberry(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s;
  };
}

const ALPH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function makeCall(next) {
  const L = () => ALPH[next() % 26];
  const pre = L() + ((next() % 4) === 0 ? L() : '');
  const num = String(next() % 10);
  let suf = L();
  const extra = next() % 3;
  for (let i = 0; i < extra; i++) suf += L();
  return pre + num + suf;
}

// A made-up contact. The shape is the ordinary ham exchange. The calls are random.
export function makeQso(seed) {
  const next = mulberry(seed);
  const a = makeCall(next);
  const b = makeCall(next);
  return `CQ CQ DE ${a} ${a} K ${b} DE ${a} UR RST 599 BK`;
}

export function bandOf(khz) {
  const f = +khz || 0;
  for (let i = 0; i < HAM.length; i++) {
    if (f >= HAM[i][0] && f <= HAM[i][1]) return HAM[i][2];
  }
  let best = HAM[0][2];
  let dist = 1e9;
  for (let i = 0; i < HAM.length; i++) {
    const mid = (HAM[i][0] + HAM[i][1]) / 2;
    const d = Math.abs(f - mid);
    if (d < dist) { dist = d; best = HAM[i][2]; }
  }
  return best;
}

export function condFromLabel(label) {
  return Object.prototype.hasOwnProperty.call(COND_VALUE, label) ? COND_VALUE[label] : null;
}

// DXEdge /api/solar returns band_conditions: [{ band, condition }].
// This maps the dial to that row. Null when the list has no match.
export function condFromSolar(khz, rows) {
  if (!Array.isArray(rows)) return null;
  const band = bandOf(khz);
  const row = rows.find(r => r && r.band === band);
  if (!row) return null;
  return condFromLabel(row.condition);
}

export function stationNear(khz) {
  let best = null;
  let dist = 1e9;
  for (let i = 0; i < PENTA_BAND.length; i++) {
    const d = Math.abs(PENTA_BAND[i].khz - khz);
    if (d < dist) { dist = d; best = PENTA_BAND[i]; }
  }
  return best && dist < 40 ? best : null;
}

const PENTA_PARAMETERS = parameterTable(PENTA_DEFAULT, PENTA_RANGE, PENTA_ENUMS);

export const pentagridDevice = {
  id: PENTA_ID,
  name: 'Pentagrid',
  vendor: 'DX Edge',
  version: String(PENTA_SCHEMA),
  api: RACK_API,
  description: 'Shortwave receiver and playable heterodynes',
  instrument: true,
  audioInputs: 0,
  audioOutputs: 1,
  midiInput: true,
  midiOutput: false,
  processor: 'pentagrid',
  worklet: 'pentagrid.worklet.js',
  channels: 2,
  oversample: 1,
  parameters: PENTA_PARAMETERS,
  normalize: normalizePentagrid,
  factory: PENTA_FACTORY,
  defaults: PENTA_DEFAULT,
  messages: ['patch', 'on', 'off', 'bend', 'mw', 'sus', 'panic', 'active'],
};

registerDevice(pentagridDevice);
