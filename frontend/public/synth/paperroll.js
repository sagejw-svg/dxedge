// The paper roll: a 16-step note sequencer for the whole rack, drawn as a punched paper roll moving
// past a reader. Pure functions only (the pattern schema, the plan of notes, note names); the strip,
// the scheduler and the drawing are in paperroll-ui.js.
//
// A step is a column on the roll: a note (n), a punched hole (g: the step plays), an accent (a: the
// accent velocity instead of the normal one), a slide (s: the note is held into the next punched
// step, so the two overlap and a mono device plays them legato) and a tie (t: the step does not
// strike again; the note before it carries on through it). A tie that has no note before it to
// carry on (the first step after play, or after a rest) plays as an ordinary step if it is punched.
// Our own design and code.

export const ROLL_KEY = 'filament_roll';
export const ROLL_STEPS = 16;
// Step length in quarter-note beats
export const ROLL_RATES = { '8': 0.5, '8t': 1 / 3, '16': 0.25, '16t': 1 / 6, '32': 0.125 };
export const ROLL_RATE_NAMES = { '8': '1/8', '8t': '1/8T', '16': '1/16', '16t': '1/16T', '32': '1/32' };
// How far a slide holds its note past the start of the next one, in steps
export const SLIDE_OVERLAP = 0.08;

export const ROLL_RANGE = {
  len: [1, 16, 16], gate: [0.05, 1, 0.5], swing: [0, 0.6, 0], vel: [0.05, 1, 0.7], acc: [0.05, 1, 1], tr: [-24, 24, 0],
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export function noteName(n) { n = Math.round(+n) || 0; return NOTE_NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1); }

const num = (v, lo, hi, d, int) => {
  let x = +v; if (!isFinite(x)) x = d;
  x = Math.min(hi, Math.max(lo, x));
  return int ? Math.round(x) : x;
};
const bit = v => (v === true || v === 1 || v === '1') ? 1 : 0;

export function blankStep(n) { return { n: n == null ? 48 : n, g: 0, a: 0, s: 0, t: 0 }; }

export function normalizeStep(s) {
  s = s && typeof s === 'object' ? s : {};
  return { n: num(s.n, 0, 127, 48, true), g: bit(s.g), a: bit(s.a), s: bit(s.s), t: bit(s.t) };
}

// Old or partial patterns load: every field has a default and a range. Always 16 steps; `len` says how
// many of them play.
export function normalizeRoll(p) {
  p = p && typeof p === 'object' ? p : {};
  const R = ROLL_RANGE;
  const steps = [];
  const src = Array.isArray(p.steps) ? p.steps : [];
  for (let i = 0; i < ROLL_STEPS; i++) steps.push(normalizeStep(src[i]));
  return {
    kind: 'paperroll', v: 1,
    name: typeof p.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 40) : 'Blank Roll',
    len: num(p.len, R.len[0], R.len[1], R.len[2], true),
    rate: Object.prototype.hasOwnProperty.call(ROLL_RATES, p.rate) ? p.rate : '16',
    gate: num(p.gate, R.gate[0], R.gate[1], R.gate[2]),
    swing: num(p.swing, R.swing[0], R.swing[1], R.swing[2]),
    vel: num(p.vel, R.vel[0], R.vel[1], R.vel[2]),
    acc: num(p.acc, R.acc[0], R.acc[1], R.acc[2]),
    tr: num(p.tr, R.tr[0], R.tr[1], R.tr[2], true),
    steps,
  };
}

// The beat (quarter notes from the roll's step 0) that absolute step k starts on. Swing delays every
// second step by `swing` of a step.
export function stepBeat(p, k) {
  const sb = ROLL_RATES[p.rate] || 0.25;
  return k * sb + ((k & 1) ? p.swing * sb : 0);
}

// The notes that start on absolute steps [k0, k1). `cov` is the first absolute step not yet covered by a
// note that started earlier (a tie run); pass the `cov` this returns into the next call. Each note:
// k (absolute step), i (pattern step), len (steps it covers, ties included), n, v, accent, slide,
// on and off (beats from the roll's step 0). Pure: the plan depends only on the pattern.
export function rollPlan(p, k0, k1, cov) {
  const L = p.len, st = p.steps, out = [];
  let c = cov == null ? k0 : cov;
  for (let k = k0; k < k1; k++) {
    if (k < c) continue;
    const i = k % L, s = st[i];
    if (!s.g) { c = k + 1; continue; }
    let len = 1;
    while (len < L && st[(k + len) % L].t) len++;
    c = k + len;
    const last = st[(k + len - 1) % L], next = st[(k + len) % L];
    const on = stepBeat(p, k);
    let off, slide = false;
    if (last.s && next.g && next.n !== s.n) {
      slide = true;
      const sb = ROLL_RATES[p.rate] || 0.25;
      off = stepBeat(p, k + len) + SLIDE_OVERLAP * sb;
    } else if (last.s && next.g) {
      off = stepBeat(p, k + len);          // a slide into the same pitch holds to the next strike, no overlap
    } else {
      const a = stepBeat(p, k + len - 1), b = stepBeat(p, k + len);
      off = a + p.gate * (b - a);
    }
    out.push({
      k, i, len, n: Math.min(127, Math.max(0, s.n + p.tr)), v: s.a ? p.acc : p.vel,
      accent: !!s.a, slide, on, off,
    });
  }
  return { notes: out, cov: c };
}

// Seconds-based score of the first `steps` absolute steps at a tempo, in the same shape as the library
// player's score (at, t, n, v, dev), offs before ons at the same instant. For tests and offline renders.
export function rollScore(p, steps, tempo, dev) {
  const spb = 60 / (tempo || 120);
  const out = [];
  rollPlan(p, 0, steps, 0).notes.forEach(x => {
    out.push({ at: x.on * spb, beat: x.on, dev, t: 'on', n: x.n, v: x.v });
    out.push({ at: x.off * spb, beat: x.off, dev, t: 'off', n: x.n });
  });
  out.sort((a, b) => a.at - b.at || (a.t === 'off' ? 0 : 1) - (b.t === 'off' ? 0 : 1));
  return out;
}

// Factory rolls. Each step is [note, punched, accent, slide, tie]. Original patterns.
const S = (n, g, a, s, t) => ({ n, g: g ? 1 : 0, a: a ? 1 : 0, s: s ? 1 : 0, t: t ? 1 : 0 });
const roll = (name, rest, steps) => normalizeRoll(Object.assign({ name, steps: steps.map(x => S.apply(null, x)) }, rest));
export const ROLL_FACTORY = [
  roll('Blank Roll', {}, Array.from({ length: 16 }, () => [48, 0, 0, 0, 0])),
  roll('Octave Pump', { gate: 0.45, vel: 0.7, acc: 1 }, [
    [36, 1, 1], [48, 1], [36, 1], [36, 1], [48, 1, 1], [36, 1], [39, 1], [36, 1],
    [36, 1, 1], [48, 1], [36, 1], [43, 1], [48, 1, 1], [36, 1], [46, 1], [36, 1]]),
  roll('Walking Tens', { gate: 0.6, swing: 0.16, vel: 0.65, acc: 0.95 }, [
    [45, 1, 1], [45, 0], [48, 1], [50, 1, 0, 1], [52, 1], [52, 0], [55, 1, 1], [52, 1],
    [50, 1, 1], [50, 0, 0, 0, 1], [48, 1], [47, 1, 0, 1], [45, 1], [43, 1], [45, 1, 1, 1], [40, 1]]),
  roll('Tie and Slide', { gate: 0.5, vel: 0.7, acc: 1 }, [
    [38, 1, 1], [38, 0, 0, 0, 1], [38, 0, 0, 0, 1], [45, 1, 0, 1], [50, 1], [50, 0], [48, 1, 1, 1], [45, 1],
    [43, 1, 1], [43, 0, 0, 1, 1], [41, 1, 0, 1], [38, 1], [38, 0], [50, 1, 1, 1], [45, 1, 0, 1], [41, 1]]),
  roll('Arc Arpeggio', { rate: '16', gate: 0.35, vel: 0.6, acc: 0.85 }, [
    [57, 1, 1], [60, 1], [64, 1], [69, 1], [53, 1, 1], [57, 1], [60, 1], [65, 1],
    [48, 1, 1], [52, 1], [55, 1], [60, 1], [55, 1, 1], [59, 1], [62, 1], [67, 1]]),
  roll('Slow Bells', { rate: '8', len: 8, gate: 0.9, vel: 0.55, acc: 0.8 }, [
    [72, 1, 1], [67, 1], [69, 1, 0, 0], [64, 0, 0, 0, 1], [65, 1, 1], [60, 1], [62, 1], [67, 0, 0, 0, 1],
    [48, 0], [48, 0], [48, 0], [48, 0], [48, 0], [48, 0], [48, 0], [48, 0]]),
];
