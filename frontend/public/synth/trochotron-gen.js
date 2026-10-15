// Trochotron score generator. Pure functions: no DOM, no audio, no clock.
//
// A seed and the settings grow one piece. The same inputs always return the
// same notes. Nothing here is copied from another program. The maps are the
// published ones (a Lindenmayer rewrite, the quadratic map z -> z^2 + c,
// the logistic map, the Lorenz equations, the Thue-Morse parity and a base-b
// digit sum). The way those numbers become notes is written for this device.
//
// Self-similarity: one cell sequence is the piece. The lead plays every cell,
// the mid voice every second cell, the bass every fourth. The slower voices
// are the same line heard at a larger time scale, down an octave or two.

import { writeSMF } from './smf.js';

export const GENERATORS = ['lsystem', 'mandelbrot', 'julia', 'logistic', 'lorenz', 'thue'];
export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  whole: [0, 2, 4, 6, 8, 10],
};
export const SCALE_NAMES = Object.keys(SCALES);
export const ROUTES = ['internal', 'filament', 'cathode', 'thyratron', 'gleam', 'dekatron', 'lattice', 'mote', 'heptode', 'geissler', 'pentagrid', 'orthicon'];
export const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

const LAYERS = [
  { name: 'lead', stride: 1, octave: 5, gain: 0.92 },
  { name: 'mid', stride: 2, octave: 4, gain: 0.78 },
  { name: 'bass', stride: 4, octave: 2, gain: 0.88 },
];

function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
function round6(n) { return Math.round(n * 1e6) / 1e6; }

// Marsaglia xorshift32, from the published recurrence. Seed 0 becomes 1.
function xorshift32(seed) {
  let x = (seed >>> 0) || 1;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x / 4294967296;
  };
}

export function logisticR(chaos) {
  return round6(2.8 + clamp(+chaos || 0, 0, 1) * 1.2);
}

function stepCount(depth) {
  return 8 + clamp(depth | 0, 1, 6) * 4;
}

function stepBeats(density) {
  const div = 1 + Math.round(clamp(+density || 0, 0, 1) * 3);
  return 1 / div;
}

function toMidi(degree, scaleName, key, octave) {
  const scale = SCALES[scaleName] || SCALES.dorian;
  const len = scale.length;
  const d = Math.round(degree);
  const oct = Math.floor(d / len);
  const i = ((d % len) + len) % len;
  return clamp((octave + 1) * 12 + (key | 0) + scale[i] + oct * 12, 0, 127);
}

function rulesFor(seed, chaos) {
  const rnd = xorshift32(seed);
  const pick = list => list[Math.floor(rnd() * list.length) % list.length];
  const c = clamp(+chaos || 0, 0, 1);
  const ruleP = c < 0.45 ? pick(['P[UP]D', 'PUPD', 'PDPU']) : pick(['P[UP][DP]', 'PU[DP]U', 'PD[UP]D', 'P[UD]P']);
  const ruleU = c < 0.7 ? 'U' : (rnd() < 0.5 ? 'UD' : 'DU');
  const ruleD = c < 0.7 ? 'D' : (rnd() < 0.5 ? 'DU' : 'UD');
  const axiom = c < 0.5 ? 'P' : 'PUP';
  return { axiom, P: ruleP, U: ruleU, D: ruleD };
}

function expandSystem(rules, depth) {
  let s = rules.axiom;
  const limit = 480;
  const n = clamp(depth | 0, 1, 6);
  for (let d = 0; d < n; d++) {
    let next = '';
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      next += rules[ch] || ch;
      if (next.length > limit) break;
    }
    s = next;
    if (s.length > limit) break;
  }
  return s;
}

function lsystemCells(settings, steps) {
  const rules = rulesFor(settings.seed, settings.chaos);
  const text = expandSystem(rules, settings.depth);
  const plays = [];
  const turtle = [];
  let degree = 0;
  let stack = [];
  let x = 0, y = 0, ang = -Math.PI / 2;
  const turn = 0.62;
  const pushT = () => stack.push({ degree, x, y, ang });
  const popT = () => {
    const s = stack.pop();
    if (!s) return;
    degree = s.degree; x = s.x; y = s.y; ang = s.ang;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === 'P') {
      plays.push(degree);
      x += Math.cos(ang);
      y += Math.sin(ang);
      turtle.push({ x, y });
    } else if (ch === 'U') { degree += 1; ang -= turn; }
    else if (ch === 'D') { degree -= 1; ang += turn; }
    else if (ch === '[') pushT();
    else if (ch === ']') popT();
  }
  if (!plays.length) plays.push(0);
  const cells = [];
  for (let i = 0; i < steps; i++) {
    const phrase = Math.floor(i / plays.length);
    const degreeNow = plays[i % plays.length] + (phrase % 2);
    const at = turtle[i % Math.max(1, turtle.length)] || { x: 0, y: 0 };
    cells.push({
      degree: degreeNow,
      vel: (i % plays.length === 0 ? 0.92 : 0.62),
      gate: 0.82,
      x: at.x, y: at.y,
    });
  }
  const lines = [
    'axiom  ' + rules.axiom,
    'P  ->  ' + rules.P,
    'U  ->  ' + rules.U,
    'D  ->  ' + rules.D,
    '',
    text.slice(0, 180),
  ];
  return { cells, rules: lines.join('\n'), kind: 'lsystem' };
}

function viewSpan(settings) {
  const zoom = clamp(+settings.zoom || 1, 0.25, 64);
  return 3.2 / zoom;
}

function mandelbrotCells(settings, steps) {
  const julia = settings.generator === 'julia';
  const span = viewSpan(settings);
  const seed = settings.seed >>> 0;
  const chaos = clamp(+settings.chaos || 0, 0, 1);
  const sx = (((seed % 997) / 997) - 0.5) * span * 0.5;
  const sy = ((Math.floor(seed / 997) % 991) / 991 - 0.5) * span * 0.5;
  let cr = (+settings.cx || 0) + sx;
  let ci = (+settings.cy || 0) + sy;
  const jr = +settings.jr || -0.8;
  const ji = +settings.ji || 0.156;
  const maxIt = 8 + clamp(settings.depth | 0, 1, 6) * 3;
  const step = span / (5 + clamp(settings.depth | 0, 1, 6)) * (0.45 + chaos * 0.9);
  const hx = span * 0.5;
  const hy = span * 0.5;
  const cells = [];
  for (let i = 0; i < steps; i++) {
    const cR = julia ? jr : cr;
    const cI = julia ? ji : ci;
    let zr = julia ? cr : 0;
    let zi = julia ? ci : 0;
    let pr = zr, pi = zi, n = 0;
    for (; n < maxIt; n++) {
      const rr = zr * zr - zi * zi + cR;
      const ii = 2 * zr * zi + cI;
      if (rr * rr + ii * ii > 4) break;
      pr = rr; pi = ii;
      zr = rr; zi = ii;
    }
    const ang = Math.atan2(pi, pr);
    cr += Math.cos(ang + i * 0.17) * step;
    ci += Math.sin(ang + i * 0.11) * step;
    const cx = +settings.cx || 0;
    const cy = +settings.cy || 0;
    if (cr < cx - hx || cr > cx + hx) cr = cx - (cr - cx);
    if (ci < cy - hy || ci > cy + hy) ci = cy - (ci - cy);
    const dwell = n / maxIt;
    cells.push({
      degree: pr * 3.4 + pi * 2.1 + dwell * 3,
      vel: 0.42 + dwell * 0.5,
      gate: 0.45 + (1 - dwell) * 0.45,
      x: cr, y: ci,
    });
  }
  const rules = julia
    ? 'Julia orbit\nc = ' + jr.toFixed(4) + ' + ' + ji.toFixed(4) + ' i\nzoom ' + (+settings.zoom || 1).toFixed(2)
    : 'Mandelbrot orbit\nwindow centre ' + (+settings.cx || 0).toFixed(4) + ' + ' + (+settings.cy || 0).toFixed(4) + ' i\nzoom ' + (+settings.zoom || 1).toFixed(2);
  return { cells, rules, kind: julia ? 'julia' : 'mandelbrot' };
}

function logisticCells(settings, steps) {
  const r = logisticR(settings.chaos);
  const seed = settings.seed >>> 0;
  let x = 0.12 + ((seed % 800) / 800) * 0.7;
  const burn = 24;
  for (let i = 0; i < burn; i++) x = r * x * (1 - x);
  const cells = [];
  for (let i = 0; i < steps; i++) {
    const prev = x;
    x = r * x * (1 - x);
    if (!isFinite(x)) x = 0.5;
    const jump = Math.abs(x - prev);
    cells.push({
      degree: (x - 0.35) * 16,
      vel: 0.34 + x * 0.58,
      gate: 0.4 + jump * 0.7,
      x: i / Math.max(1, steps - 1),
      y: x,
    });
  }
  return { cells, rules: 'logistic map\nx -> r x (1 - x)\nr = ' + r.toFixed(4), kind: 'logistic', r };
}

function lorenzCells(settings, steps) {
  const chaos = clamp(+settings.chaos || 0, 0, 1);
  const rho = 18 + chaos * 20;
  const sigma = 10;
  const beta = 8 / 3;
  const seed = settings.seed >>> 0;
  let x = 0.08 + (seed % 500) / 5000;
  let y = 0.04 + (Math.floor(seed / 500) % 500) / 8000;
  let z = 0.02;
  const dt = 0.0075;
  for (let i = 0; i < 280; i++) {
    const dx = sigma * (y - x);
    const dy = x * (rho - z) - y;
    const dz = x * y - beta * z;
    x += dx * dt; y += dy * dt; z += dz * dt;
  }
  const cells = [];
  const sub = 6;
  for (let i = 0; i < steps; i++) {
    for (let k = 0; k < sub; k++) {
      const dx = sigma * (y - x);
      const dy = x * (rho - z) - y;
      const dz = x * y - beta * z;
      x += dx * dt; y += dy * dt; z += dz * dt;
    }
    cells.push({
      degree: x * 0.42,
      vel: clamp(0.3 + Math.abs(y) / 40, 0.2, 0.95),
      gate: 0.55 + clamp(Math.abs(z) / 80, 0, 0.35),
      x, y, z,
    });
  }
  return {
    cells,
    rules: 'Lorenz\nsigma 10   beta 8/3\nrho ' + rho.toFixed(2),
    kind: 'lorenz',
  };
}

function thue(n) {
  let c = 0;
  let x = n >>> 0;
  while (x) { c += x & 1; x >>>= 1; }
  return c & 1;
}

function digitSum(n, base) {
  let s = 0;
  let x = n >>> 0;
  const b = base < 2 ? 2 : base;
  if (!x) return 0;
  while (x) { s += x % b; x = Math.floor(x / b); }
  return s;
}

function thueCells(settings, steps) {
  const chaos = clamp(+settings.chaos || 0, 0, 1);
  const base = 2 + Math.round(chaos * 2);
  const salt = settings.seed >>> 0;
  const cells = [];
  const bits = [];
  for (let i = 0; i < steps; i++) {
    const idx = (i + (salt % 64)) >>> 0;
    const bit = thue(idx);
    const sum = digitSum(idx, base);
    bits.push(bit ? '1' : '0');
    const run = bit === thue((idx + 1) >>> 0);
    cells.push({
      degree: sum + (bit ? 2 : 0),
      vel: bit ? 0.88 : 0.5,
      gate: run ? 0.92 : 0.48,
      x: i / Math.max(1, steps - 1),
      y: bit,
    });
  }
  const lines = [
    'Thue-Morse parity, digit sum base ' + base,
    '0 -> 01    1 -> 10',
    bits.join(''),
  ];
  return { cells, rules: lines.join('\n'), kind: 'thue' };
}

function cellsOf(settings, steps) {
  const g = settings.generator;
  if (g === 'lsystem') return lsystemCells(settings, steps);
  if (g === 'julia' || g === 'mandelbrot') return mandelbrotCells(settings, steps);
  if (g === 'logistic') return logisticCells(settings, steps);
  if (g === 'lorenz') return lorenzCells(settings, steps);
  return thueCells(settings, steps);
}

function traceOf(built, kind) {
  const cells = built.cells;
  if (!cells.length) return [];
  if (kind === 'lorenz') {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    cells.forEach(c => {
      if (c.x < minX) minX = c.x;
      if (c.x > maxX) maxX = c.x;
      const z = c.z || 0;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    });
    const sx = maxX - minX || 1;
    const sz = maxZ - minZ || 1;
    return cells.map(c => ({ x: (c.x - minX) / sx, y: ((c.z || 0) - minZ) / sz }));
  }
  if (kind === 'lsystem') {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    cells.forEach(c => {
      if (c.x < minX) minX = c.x;
      if (c.x > maxX) maxX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.y > maxY) maxY = c.y;
    });
    const sx = maxX - minX || 1;
    const sy = maxY - minY || 1;
    return cells.map(c => ({ x: (c.x - minX) / sx, y: (c.y - minY) / sy }));
  }
  if (kind === 'mandelbrot' || kind === 'julia') {
    return cells.map(c => ({ x: c.x, y: c.y }));
  }
  return cells.map(c => ({ x: c.x, y: c.y }));
}

// settings is a normalized Trochotron patch, or a partial one. Missing fields
// use the musical defaults so a seed alone is enough.
export function pieceOf(settings) {
  const s = settings || {};
  const depth = clamp(s.depth == null ? 3 : s.depth | 0, 1, 6);
  const voices = clamp(s.voices == null ? 3 : s.voices | 0, 1, 3);
  const density = clamp(s.density == null ? 0.4 : +s.density, 0, 1);
  const scale = SCALES[s.scale] ? s.scale : 'dorian';
  const key = clamp(s.key == null ? 2 : s.key | 0, 0, 11);
  const tempo = clamp(s.tempo == null ? 108 : +s.tempo, 40, 240);
  const spec = {
    seed: (s.seed == null ? 42 : s.seed) >>> 0,
    generator: GENERATORS.indexOf(s.generator) >= 0 ? s.generator : 'mandelbrot',
    depth, voices, density, scale, key, tempo,
    chaos: clamp(s.chaos == null ? 0.35 : +s.chaos, 0, 1),
    cx: clamp(s.cx == null ? -0.6 : +s.cx, -2, 2),
    cy: clamp(s.cy == null ? 0 : +s.cy, -2, 2),
    zoom: clamp(s.zoom == null ? 1 : +s.zoom, 0.25, 64),
    jr: clamp(s.jr == null ? -0.8 : +s.jr, -2, 2),
    ji: clamp(s.ji == null ? 0.156 : +s.ji, -2, 2),
  };
  const steps = stepCount(spec.depth);
  const step = stepBeats(spec.density);
  const built = cellsOf(spec, steps);
  const notes = [];
  for (let L = 0; L < voices && L < LAYERS.length; L++) {
    const layer = LAYERS[L];
    for (let i = 0; i < steps; i += layer.stride) {
      const cell = built.cells[i];
      const accent = i % 4 === 0 ? 1 : 0.76;
      const beat = i * step;
      const dur = Math.max(0.08, layer.stride * step * clamp(cell.gate, 0.25, 1));
      notes.push({
        beat: round6(beat),
        dur: round6(dur),
        n: toMidi(cell.degree, scale, key, layer.octave),
        v: round6(clamp(cell.vel * layer.gain * accent, 0.08, 1)),
        layer: layer.name,
      });
    }
  }
  notes.sort((a, b) => a.beat - b.beat || a.n - b.n);
  let beats = 0;
  notes.forEach(n => { const end = n.beat + n.dur; if (end > beats) beats = end; });
  return {
    seed: spec.seed,
    generator: spec.generator,
    tempo,
    notes,
    beats: round6(beats),
    rules: built.rules,
    kind: built.kind,
    r: built.r == null ? logisticR(spec.chaos) : built.r,
    trace: traceOf(built, built.kind),
    steps,
  };
}

export function shareOf(patch) {
  const p = patch || {};
  const fields = [
    String((p.seed == null ? 42 : p.seed) >>> 0),
    GENERATORS.indexOf(p.generator) >= 0 ? p.generator : 'mandelbrot',
    String(clamp(p.depth == null ? 3 : p.depth | 0, 1, 6)),
    SCALES[p.scale] ? p.scale : 'dorian',
    String(clamp(p.key == null ? 2 : p.key | 0, 0, 11)),
    String(Math.round(clamp(p.tempo == null ? 108 : +p.tempo, 40, 240))),
    clamp(p.density == null ? 0.4 : +p.density, 0, 1).toFixed(3),
    clamp(p.chaos == null ? 0.35 : +p.chaos, 0, 1).toFixed(3),
    String(clamp(p.voices == null ? 3 : p.voices | 0, 1, 3)),
    clamp(p.timbre == null ? 0.45 : +p.timbre, 0, 1).toFixed(3),
    clamp(p.cx == null ? -0.6 : +p.cx, -2, 2).toFixed(5),
    clamp(p.cy == null ? 0 : +p.cy, -2, 2).toFixed(5),
    clamp(p.zoom == null ? 1 : +p.zoom, 0.25, 64).toFixed(4),
    clamp(p.jr == null ? -0.8 : +p.jr, -2, 2).toFixed(5),
    clamp(p.ji == null ? 0.156 : +p.ji, -2, 2).toFixed(5),
    ROUTES.indexOf(p.route) >= 0 ? p.route : 'internal',
  ];
  return fields.join('~');
}

export function parseShare(text) {
  if (text == null) return null;
  const raw = String(text).trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return { seed: Number(raw) };
  const p = raw.split('~');
  if (p.length < 6) return null;
  const out = {
    seed: Number(p[0]),
    generator: p[1],
    depth: Number(p[2]),
    scale: p[3],
    key: Number(p[4]),
    tempo: Number(p[5]),
  };
  if (p.length > 6) out.density = Number(p[6]);
  if (p.length > 7) out.chaos = Number(p[7]);
  if (p.length > 8) out.voices = Number(p[8]);
  if (p.length > 9) out.timbre = Number(p[9]);
  if (p.length > 10) out.cx = Number(p[10]);
  if (p.length > 11) out.cy = Number(p[11]);
  if (p.length > 12) out.zoom = Number(p[12]);
  if (p.length > 13) out.jr = Number(p[13]);
  if (p.length > 14) out.ji = Number(p[14]);
  if (p.length > 15) out.route = p[15];
  return out;
}

// One Standard MIDI File, format 1. Bass, mid and lead are separate channels.
export function midiOf(piece) {
  const src = piece && piece.notes ? piece : pieceOf(piece || {});
  const bpm = clamp(src.tempo || 120, 40, 240);
  const names = { bass: 0, mid: 1, lead: 2 };
  const buckets = [[], [], []];
  src.notes.forEach(n => {
    const ch = names[n.layer] == null ? 2 : names[n.layer];
    const t = n.beat * 60 / bpm;
    const dur = Math.max(0.02, n.dur * 60 / bpm);
    const vel = clamp(Math.round(n.v * 127), 1, 127);
    buckets[ch].push({ time: t, data: [0x90, n.n & 127, vel] });
    buckets[ch].push({ time: t + dur, data: [0x80, n.n & 127, 0] });
  });
  const labels = ['bass', 'mid', 'lead'];
  const parts = [];
  buckets.forEach((events, ch) => {
    if (!events.length) return;
    parts.push({ name: 'Trochotron: ' + labels[ch], ch, events });
  });
  return writeSMF({ bpm, parts });
}
