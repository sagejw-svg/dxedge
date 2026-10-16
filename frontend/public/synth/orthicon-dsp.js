// Orthicon spectral engine.
//
// A log-frequency spectrogram (time across, frequency up) is painted, loaded
// from a picture, or measured from audio. A playhead reads one column at a
// time. Resynthesis is either an additive bank (one partial per row, at that
// row's exact frequency) or an overlap-add inverse FFT. Phase is either held
// coherent, so a painted line stays a tone, or redrawn per column, so the
// same line turns grainy.
//
// Written from the ordinary description of the short-time Fourier transform
// and an oscillator bank. No spectral-paint program was copied or translated.

export const COLS = 96;
export const ROWS = 128;
const FFT_N = 4096;
const HOP = 1024;
const TAU = Math.PI * 2;

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  whole: [0, 2, 4, 6, 8, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

export function rowHz(row, rows, fLo, fHi) {
  const n = Math.max(1, rows - 1);
  const t = Math.max(0, Math.min(1, row / n));
  const lo = Math.max(20, fLo);
  const hi = Math.max(lo * 1.01, fHi);
  return lo * Math.pow(hi / lo, t);
}

export function hzToRow(hz, rows, fLo, fHi) {
  const lo = Math.max(20, fLo);
  const hi = Math.max(lo * 1.01, fHi);
  const f = Math.max(lo, Math.min(hi, hz));
  const t = Math.log(f / lo) / Math.log(hi / lo);
  return t * Math.max(1, rows - 1);
}

export function nearestRowHz(hz, rows, fLo, fHi) {
  const row = Math.round(hzToRow(hz, rows, fLo, fHi));
  const clamped = Math.max(0, Math.min(rows - 1, row));
  return { row: clamped, hz: rowHz(clamped, rows, fLo, fHi) };
}

function hash01(a, b, c) {
  let x = (Math.imul(a + 1, 374761393) ^ Math.imul(b + 3, 668265263) ^ Math.imul(c + 7, 1440670037)) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0;
  return (x >>> 0) / 4294967296;
}

function rand(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function scaleMask(rows, scale, root, fLo, fHi) {
  const mask = new Uint8Array(rows);
  if (!scale || scale === 'off') { mask.fill(1); return mask; }
  const steps = SCALES[scale] || SCALES.major;
  const allowed = new Uint8Array(12);
  const r0 = ((root % 12) + 12) % 12;
  steps.forEach(pc => { allowed[(r0 + pc) % 12] = 1; });
  const lo = Math.max(20, fLo);
  const hi = Math.max(lo * 1.01, fHi);
  const n0 = Math.ceil(69 + 12 * Math.log2(lo / 440));
  const n1 = Math.floor(69 + 12 * Math.log2(hi / 440));
  for (let n = n0; n <= n1; n++) {
    if (!allowed[((n % 12) + 12) % 12]) continue;
    const hz = 440 * Math.pow(2, (n - 69) / 12);
    const row = Math.round(hzToRow(hz, rows, fLo, fHi));
    if (row >= 0 && row < rows) mask[row] = 1;
  }
  return mask;
}

function stampCell(grid, cols, rows, col, row, amp, hard, erase, rad) {
  const r = Math.max(hard ? 0.45 : 0.8, rad);
  const c0 = Math.max(0, Math.floor(col - r - 1));
  const c1 = Math.min(cols - 1, Math.ceil(col + r + 1));
  const r0 = Math.max(0, Math.floor(row - r - 1));
  const r1 = Math.min(rows - 1, Math.ceil(row + r + 1));
  for (let c = c0; c <= c1; c++) {
    for (let rr = r0; rr <= r1; rr++) {
      const d = Math.hypot(c - col, rr - row);
      let w = 0;
      if (hard) w = d <= r ? 1 : 0;
      else w = Math.exp(-0.5 * (d / (r * 0.55)) * (d / (r * 0.55)));
      if (w < 0.03) continue;
      const i = c * rows + rr;
      if (erase) grid[i] = Math.max(0, grid[i] - amp * w);
      else grid[i] = Math.min(1, grid[i] + (1 - grid[i]) * amp * w);
    }
  }
}

// x,y are 0..1. y = 0 is the top of the canvas, the high end of the log scale.
export function paintStroke(grid, cols, rows, stroke, fLo, fHi) {
  const s = stroke || {};
  const brush = s.brush || 'soft';
  const amount = s.amount == null ? 0.9 : Math.max(0, Math.min(1, +s.amount));
  const rad = s.radius == null ? 1.7 : Math.max(0.4, Math.min(12, +s.radius));
  const x0 = Math.max(0, Math.min(1, +s.x0 || 0));
  const y0 = Math.max(0, Math.min(1, +s.y0 || 0));
  const x1 = s.x1 == null ? x0 : Math.max(0, Math.min(1, +s.x1));
  const y1 = s.y1 == null ? y0 : Math.max(0, Math.min(1, +s.y1));
  const hard = brush === 'hard' || brush === 'erase';
  const erase = brush === 'erase';
  const steps = Math.max(1, Math.ceil(Math.hypot((x1 - x0) * cols, (y1 - y0) * rows) * 2));
  const rng = rand((s.seed || 1) >>> 0);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    const col = x * (cols - 1);
    const row = (1 - y) * (rows - 1);
    if (brush === 'noise') {
      const dots = 5;
      for (let k = 0; k < dots; k++) {
        const dc = (rng() - 0.5) * rad * 2.2;
        const dr = (rng() - 0.5) * rad * 2.2;
        stampCell(grid, cols, rows, col + dc, row + dr, amount * (0.35 + 0.65 * rng()), true, false, 0.45);
      }
      continue;
    }
    if (brush === 'harmonic') {
      const hz = rowHz(row, rows, fLo, fHi);
      for (let n = 1; n <= 14; n++) {
        const f = hz * n;
        if (f > fHi) break;
        const rr = hzToRow(f, rows, fLo, fHi);
        stampCell(grid, cols, rows, col, rr, amount / n, hard, false, Math.max(0.7, rad * 0.55));
      }
      continue;
    }
    stampCell(grid, cols, rows, col, row, amount, hard, erase, rad);
  }
  return grid;
}

// A horizontal line at one frequency, hard enough that one row carries it.
export function paintTone(hz, fLo = 80, fHi = 8000, cols = COLS, rows = ROWS) {
  const grid = new Float32Array(cols * rows);
  const hit = nearestRowHz(hz, rows, fLo, fHi);
  const y = 1 - hit.row / Math.max(1, rows - 1);
  paintStroke(grid, cols, rows, {
    brush: 'hard', x0: 0, y0: y, x1: 1, y1: y, radius: 0.45, amount: 1,
  }, fLo, fHi);
  return { grid, hz: hit.hz, row: hit.row };
}

export function imageToGrid(src, width, height, cols = COLS, rows = ROWS) {
  const grid = new Float32Array(cols * rows);
  const w = width | 0;
  const h = height | 0;
  if (!src || w < 1 || h < 1) return grid;
  const rgba = src.length >= w * h * 4;
  for (let c = 0; c < cols; c++) {
    const sx = Math.min(w - 1, Math.floor((c + 0.5) / cols * w));
    for (let r = 0; r < rows; r++) {
      // Row 0 is low frequency, the bottom of the picture.
      const sy = Math.min(h - 1, Math.floor((1 - (r + 0.5) / rows) * h));
      let lum;
      if (rgba) {
        const p = (sy * w + sx) * 4;
        lum = (0.2126 * src[p] + 0.7152 * src[p + 1] + 0.0722 * src[p + 2]) / 255;
      } else {
        lum = src[sy * w + sx];
        if (lum > 1) lum /= 255;
      }
      grid[c * rows + r] = Math.max(0, Math.min(1, lum));
    }
  }
  return grid;
}

function blurH(grid, cols, rows, rad) {
  const next = new Float32Array(grid.length);
  const r = Math.max(1, rad | 0);
  for (let row = 0; row < rows; row++) {
    for (let c = 0; c < cols; c++) {
      let s = 0, w = 0;
      for (let k = -r; k <= r; k++) {
        const cc = Math.max(0, Math.min(cols - 1, c + k));
        const wk = r + 1 - Math.abs(k);
        s += grid[cc * rows + row] * wk;
        w += wk;
      }
      next[c * rows + row] = s / w;
    }
  }
  return next;
}

function blurV(grid, cols, rows, rad) {
  const next = new Float32Array(grid.length);
  const r = Math.max(1, rad | 0);
  for (let c = 0; c < cols; c++) {
    for (let row = 0; row < rows; row++) {
      let s = 0, w = 0;
      for (let k = -r; k <= r; k++) {
        const rr = Math.max(0, Math.min(rows - 1, row + k));
        const wk = r + 1 - Math.abs(k);
        s += grid[c * rows + rr] * wk;
        w += wk;
      }
      next[c * rows + row] = s / w;
    }
  }
  return next;
}

export function smearGrid(grid, cols, rows, amount) {
  const rad = Math.max(1, Math.round(1 + amount * 10));
  const next = blurH(grid, cols, rows, rad);
  grid.set(next);
  return grid;
}

export function blurGrid(grid, cols, rows, amount) {
  const rad = Math.max(1, Math.round(1 + amount * 3));
  let next = blurH(grid, cols, rows, rad);
  next = blurV(next, cols, rows, rad);
  grid.set(next);
  return grid;
}

export function shiftGrid(grid, cols, rows, semitones, fLo, fHi) {
  const next = new Float32Array(grid.length);
  const ratio = Math.pow(2, semitones / 12);
  for (let row = 0; row < rows; row++) {
    const srcHz = rowHz(row, rows, fLo, fHi) / ratio;
    const src = hzToRow(srcHz, rows, fLo, fHi);
    const a = Math.floor(src);
    const b = Math.min(rows - 1, a + 1);
    const f = Math.max(0, Math.min(1, src - a));
    if (a < 0 || a >= rows) continue;
    for (let c = 0; c < cols; c++) {
      const i = c * rows;
      next[i + row] = grid[i + a] * (1 - f) + grid[i + b] * f;
    }
  }
  grid.set(next);
  return grid;
}

export function stretchGrid(grid, cols, rows, factor) {
  const k = Math.max(0.25, Math.min(4, factor || 1));
  const next = new Float32Array(grid.length);
  for (let c = 0; c < cols; c++) {
    const src = c / k;
    const a = Math.max(0, Math.min(cols - 1, Math.floor(src)));
    const b = Math.max(0, Math.min(cols - 1, a + 1));
    const f = Math.max(0, Math.min(1, src - a));
    for (let row = 0; row < rows; row++) {
      next[c * rows + row] = grid[a * rows + row] * (1 - f) + grid[b * rows + row] * f;
    }
  }
  grid.set(next);
  return grid;
}

export function freezeColumn(grid, cols, rows, col) {
  const c = Math.max(0, Math.min(cols - 1, Math.round(col)));
  for (let cc = 0; cc < cols; cc++) {
    if (cc === c) continue;
    for (let row = 0; row < rows; row++) grid[cc * rows + row] = grid[c * rows + row];
  }
  return grid;
}

export function quantizeGrid(grid, cols, rows, scale, root, fLo, fHi) {
  const mask = scaleMask(rows, scale === 'off' ? 'major' : scale, root, fLo, fHi);
  const nearest = new Int16Array(rows);
  for (let row = 0; row < rows; row++) {
    if (mask[row]) { nearest[row] = row; continue; }
    let best = row, dist = 1e9;
    for (let k = 0; k < rows; k++) {
      if (!mask[k]) continue;
      const d = Math.abs(k - row);
      if (d < dist) { dist = d; best = k; }
    }
    nearest[row] = best;
  }
  const next = new Float32Array(grid.length);
  for (let c = 0; c < cols; c++) {
    for (let row = 0; row < rows; row++) {
      const dst = nearest[row];
      const v = grid[c * rows + row];
      if (v > next[c * rows + dst]) next[c * rows + dst] = v;
    }
  }
  grid.set(next);
  return grid;
}

export function pictureGrid(id, fLo = 80, fHi = 8000, cols = COLS, rows = ROWS) {
  const grid = new Float32Array(cols * rows);
  const put = (c, hz, amp, rad) => {
    const row = hzToRow(hz, rows, fLo, fHi);
    stampCell(grid, cols, rows, c, row, amp, false, false, rad == null ? 1.15 : rad);
  };
  if (id === 'lantern') {
    // A quiet stack runs the whole width so the scan is never silent,
    // with three brighter blooms along the way.
    for (let c = 0; c < cols; c++) {
      for (let n = 1; n <= 6; n++) put(c, 196 * n, 0.34 / n, 0.8);
    }
    const times = [0.18, 0.5, 0.78];
    const funds = [196, 247, 165];
    times.forEach((u, i) => {
      const col = u * (cols - 1);
      const f0 = funds[i];
      for (let n = 1; n <= 9; n++) {
        const f = f0 * n;
        if (f >= fHi) break;
        for (let dc = -10; dc <= 10; dc++) {
          const w = Math.exp(-0.5 * (dc / 4.2) * (dc / 4.2));
          put(col + dc, f, (0.95 / n) * w, 0.9);
        }
      }
    });
    return grid;
  }
  if (id === 'veil') {
    const rng = rand(20261015);
    for (let c = 0; c < cols; c++) {
      for (let row = 0; row < rows; row++) {
        const n = rng();
        const high = row / (rows - 1);
        let v = 0;
        if (n > 0.9) v = (0.2 + 0.75 * high) * n;
        if (row < 10) v = Math.max(v, 0.28 * Math.exp(-0.5 * ((row - 6) / 2.2) ** 2));
        grid[c * rows + row] = Math.min(1, v);
      }
    }
    return grid;
  }
  if (id === 'glyph') {
    for (let c = 0; c <= 22; c++) put(c, 262, 0.95, 0.7);
    for (let c = 24; c <= 70; c++) put(c, 392, 0.8, 0.7);
    for (let c = 36; c <= 54; c++) put(c, 523, 0.9, 0.7);
    for (let c = 56; c < cols; c++) {
      const t = (c - 56) / Math.max(1, cols - 57);
      put(c, 180 * Math.pow(8, t), 0.85, 0.8);
    }
    return grid;
  }
  if (id === 'drone') {
    for (let c = 0; c < cols; c++) {
      put(c, 220, 0.95, 0.7);
      put(c, 330, 0.62, 0.7);
      put(c, 440, 0.28, 0.8);
    }
    return grid;
  }
  // ridge: a soft band that climbs the log scale, plus a quiet low line.
  for (let c = 0; c < cols; c++) {
    const t = c / Math.max(1, cols - 1);
    const hz = 140 * Math.pow(12, t);
    put(c, hz, 0.95, 1.5);
    put(c, 110, 0.22, 1.1);
  }
  return grid;
}

// Pre-drawn pictures. Each one is an original procedure in this file: a
// spectrogram written so a left-to-right scan is a musical sound. No image
// was traced from anyone else's art.
export const DRAWN = [
  { id: 'stack', name: 'Harmonic Stack' },
  { id: 'sweep', name: 'Twin Sweep' },
  { id: 'choir', name: 'Formant Choir' },
  { id: 'bell', name: 'Bell Partials' },
  { id: 'shimmer', name: 'Shimmer Pad' },
  { id: 'rain', name: 'Rain' },
  { id: 'spiral', name: 'Spiral' },
  { id: 'stars', name: 'Starfield' },
];

const SHARE_SCALES = ['major', 'minor', 'pentatonic', 'whole', 'chromatic'];

export function normalizeSeed(seed) {
  const n = +seed;
  if (!isFinite(n)) return 1;
  return (n >>> 0) || 1;
}

export function pictureShare(seed, scale) {
  const sc = SHARE_SCALES.includes(scale) ? scale : 'major';
  return normalizeSeed(seed) + '.' + sc;
}

export function parsePictureShare(text) {
  const m = String(text == null ? '' : text).trim().match(/^(\d{1,10})\.(major|minor|pentatonic|whole|chromatic)$/);
  if (!m) return null;
  return { seed: normalizeSeed(m[1]), scale: m[2] };
}

function paintHzSpan(grid, cols, rows, fLo, fHi, c0, c1, hzAt, ampAt, rad) {
  const a = Math.max(0, c0 | 0);
  const b = Math.min(cols - 1, c1 | 0);
  if (b < a) return;
  for (let c = a; c <= b; c++) {
    const t = (c - a) / Math.max(1, b - a);
    const hz = hzAt(t, c);
    if (!(hz >= fLo && hz <= fHi)) continue;
    const amp = ampAt(t, c);
    if (amp <= 0.01) continue;
    stampCell(grid, cols, rows, c, hzToRow(hz, rows, fLo, fHi), amp, false, false, rad);
  }
}

function midiHz(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

// Drawn pictures use the current scan range so a line stays inside the picture.
export function drawnGrid(id, fLo = 80, fHi = 8000, cols = COLS, rows = ROWS) {
  const grid = new Float32Array(cols * rows);
  const span = cols - 1;
  if (id === 'stack') {
    // C major, close position, each note with a falling harmonic series.
    // Snap to a row centre so the partial is one tone, not a split between bins.
    const chord = [130.81, 164.81, 196, 261.63].map(hz => nearestRowHz(hz, rows, fLo, fHi).hz);
    const weight = [1, 0.72, 0.64, 0.5];
    for (let i = 0; i < chord.length; i++) {
      for (let n = 1; n <= 6; n++) {
        const hz = chord[i] * n;
        const amp = weight[i] * 0.92 / n;
        paintHzSpan(grid, cols, rows, fLo, fHi, 0, span, t => hz, t => amp * (0.78 + 0.22 * Math.sin(Math.PI * t)), n === 1 ? 0.72 : 0.55);
      }
    }
    return grid;
  }
  if (id === 'sweep') {
    // A rising line, a falling line, and a quieter fifth above the rise.
    paintHzSpan(grid, cols, rows, fLo, fHi, 0, span, t => 110 * Math.pow(16, t), () => 0.96, 1.15);
    paintHzSpan(grid, cols, rows, fLo, fHi, 0, span, t => 1760 * Math.pow(1 / 12, t), () => 0.5, 1.05);
    paintHzSpan(grid, cols, rows, fLo, fHi, 0, span, t => 165 * Math.pow(16, t), () => 0.34, 0.85);
    return grid;
  }
  if (id === 'choir') {
    // A sung G with the first three formants walking ah → ee → oo → eh.
    // The centres are ordinary vowel measurements, not a copied recording.
    const vowels = [
      [730, 1090, 2440],
      [270, 2290, 3010],
      [300, 870, 2240],
      [530, 1840, 2480],
    ];
    const f0 = 196;
    for (let n = 1; n <= 8; n++) {
      paintHzSpan(grid, cols, rows, fLo, fHi, 0, span, () => f0 * n, () => 0.62 / n, 0.6);
    }
    paintHzSpan(grid, cols, rows, fLo, fHi, 0, span, t => {
      const x = t * (vowels.length - 1);
      const i = Math.min(vowels.length - 2, Math.floor(x));
      const f = x - i;
      return vowels[i][0] * (1 - f) + vowels[i + 1][0] * f;
    }, () => 0.9, 2.4);
    paintHzSpan(grid, cols, rows, fLo, fHi, 0, span, t => {
      const x = t * (vowels.length - 1);
      const i = Math.min(vowels.length - 2, Math.floor(x));
      const f = x - i;
      return vowels[i][1] * (1 - f) + vowels[i + 1][1] * f;
    }, () => 0.72, 2.1);
    paintHzSpan(grid, cols, rows, fLo, fHi, 0, span, t => {
      const x = t * (vowels.length - 1);
      const i = Math.min(vowels.length - 2, Math.floor(x));
      const f = x - i;
      return vowels[i][2] * (1 - f) + vowels[i + 1][2] * f;
    }, () => 0.42, 1.7);
    return grid;
  }
  if (id === 'bell') {
    // Inharmonic partials. Higher ones die first, the way a struck bar does.
    const f0 = 247;
    const partials = [
      [0.5, 0.32, 0.85],
      [1, 1, 1.15],
      [1.19, 0.48, 1.7],
      [1.51, 0.58, 1.45],
      [2, 0.72, 2.05],
      [2.57, 0.34, 2.7],
      [3.02, 0.26, 3.1],
      [4.16, 0.16, 3.7],
      [5.43, 0.1, 4.3],
    ];
    const strike = (c0, scale) => {
      partials.forEach(([ratio, amp, decay]) => {
        const hz = f0 * ratio;
        paintHzSpan(grid, cols, rows, fLo, fHi, c0, span, () => hz, t => {
          const env = Math.exp(-decay * t * 5.2) * scale * amp;
          return env;
        }, 0.7);
      });
    };
    strike(0, 1);
    strike(Math.floor(cols * 0.42), 0.52);
    return grid;
  }
  if (id === 'shimmer') {
    // A G major pad. Each note is a slow detuned pair so the scan beats.
    const tones = [392, 493.88, 587.33, 783.99];
    tones.forEach((hz, i) => {
      paintHzSpan(grid, cols, rows, fLo, fHi, 0, span,
        t => hz * Math.pow(2, Math.sin(t * Math.PI * 2 + i) * 0.018),
        () => 0.58, 0.85);
      paintHzSpan(grid, cols, rows, fLo, fHi, 0, span,
        t => hz * 1.007 * Math.pow(2, Math.sin(t * Math.PI * 2 + i + 1.4) * 0.014),
        () => 0.4, 0.75);
    });
    paintHzSpan(grid, cols, rows, fLo, fHi, 0, span,
      t => 1568 * Math.pow(2, Math.sin(t * Math.PI * 4) * 0.03),
      () => 0.2, 0.65);
    return grid;
  }
  if (id === 'rain') {
    paintHzSpan(grid, cols, rows, fLo, fHi, 0, span, t => 95 + 18 * Math.sin(t * Math.PI * 6), () => 0.28, 2.4);
    const rng = rand(0x0A11);
    for (let i = 0; i < 88; i++) {
      const c = Math.floor(rng() * (cols - 4));
      const hz = 1500 * Math.pow(4.5, rng());
      const dur = 1 + Math.floor(rng() * 3);
      const amp = 0.38 + rng() * 0.55;
      paintHzSpan(grid, cols, rows, fLo, fHi, c, c + dur, () => hz, u => amp * (1 - u), 0.45);
    }
    for (let i = 0; i < 16; i++) {
      const c = Math.floor(rng() * (cols - 6));
      const hz = 420 * Math.pow(2.4, rng());
      const dur = 3 + Math.floor(rng() * 4);
      const amp = 0.45 + rng() * 0.4;
      paintHzSpan(grid, cols, rows, fLo, fHi, c, c + dur, () => hz, u => amp * (1 - u), 0.6);
    }
    return grid;
  }
  if (id === 'spiral') {
    // An Archimedean spiral in the picture, plus a soft octave so the scan
    // has a tone instead of a bare curve. Four slow turns around the middle.
    const turns = 4;
    for (let i = 0; i < cols * 8; i++) {
      const t = i / (cols * 8 - 1);
      const ang = t * turns * TAU;
      const rad = 0.08 + 0.34 * t;
      const x = 0.5 + Math.cos(ang) * rad * 1.35;
      const y = 0.5 + Math.sin(ang) * rad;
      if (x <= 0 || x >= 1 || y <= 0 || y >= 1) continue;
      const col = x * span;
      const row = (1 - y) * (rows - 1);
      stampCell(grid, cols, rows, col, row, 0.9, false, false, 1.15);
      const oct = Math.log(2) / Math.log(fHi / Math.max(fLo, 1)) * (rows - 1);
      stampCell(grid, cols, rows, col, row - oct, 0.28, false, false, 0.8);
    }
    paintHzSpan(grid, cols, rows, fLo, fHi, 0, span, () => 220, () => 0.16, 0.8);
    return grid;
  }
  if (id === 'stars') {
    // A pentatonic phrase, an octave echo, then scattered high sparks.
    const phrase = [60, 64, 67, 72, 74, 72, 67, 64];
    const step = Math.floor((cols - 8) / phrase.length);
    phrase.forEach((note, i) => {
      const c = 2 + i * step;
      const hz = midiHz(note);
      paintHzSpan(grid, cols, rows, fLo, fHi, c, c + 4, () => hz, u => 0.95 * (1 - u * 0.75), 0.65);
      paintHzSpan(grid, cols, rows, fLo, fHi, c + 2, c + 5, () => hz * 2, u => 0.28 * (1 - u), 0.5);
    });
    const rng = rand(0x57A5);
    const pcs = [0, 2, 4, 7, 9];
    for (let i = 0; i < 22; i++) {
      const c = Math.floor(rng() * (cols - 4));
      const oct = 5 + Math.floor(rng() * 3);
      const note = oct * 12 + pcs[Math.floor(rng() * pcs.length)];
      const hz = midiHz(note);
      const dur = 1 + Math.floor(rng() * 3);
      const amp = 0.35 + rng() * 0.5;
      paintHzSpan(grid, cols, rows, fLo, fHi, c, c + dur, () => hz, u => amp * (1 - u), 0.45);
    }
    paintHzSpan(grid, cols, rows, fLo, fHi, cols - 8, cols - 3, () => midiHz(84), u => 0.5 * (1 - u), 0.5);
    return grid;
  }
  return grid;
}

function scaleNotes(scale, root, loHz, hiHz) {
  const steps = SCALES[scale] || SCALES.major;
  const allowed = new Uint8Array(12);
  const r0 = ((root % 12) + 12) % 12;
  steps.forEach(pc => { allowed[(r0 + pc) % 12] = 1; });
  const notes = [];
  const n0 = Math.ceil(69 + 12 * Math.log2(Math.max(20, loHz) / 440));
  const n1 = Math.floor(69 + 12 * Math.log2(Math.max(loHz * 1.01, hiHz) / 440));
  for (let n = n0; n <= n1; n++) {
    if (!allowed[((n % 12) + 12) % 12]) continue;
    notes.push({ n, hz: midiHz(n) });
  }
  return notes;
}

// A seeded picture: scale tones and their harmonics, a stepped glissando,
// a quiet noise band, and a dotted rhythm. The same seed is the same grid.
export function generatePicture(seed, opts) {
  const o = opts || {};
  const cols = o.cols || COLS;
  const rows = o.rows || ROWS;
  const fLo = o.fLo == null ? 80 : o.fLo;
  const fHi = o.fHi == null ? 8000 : o.fHi;
  const scale = SHARE_SCALES.includes(o.scale) ? o.scale : 'major';
  const root = o.root == null ? 60 : (o.root | 0);
  const s = normalizeSeed(seed);
  const rng = rand(s);
  const grid = new Float32Array(cols * rows);
  const notes = scaleNotes(scale, root, Math.max(fLo, 100), Math.min(fHi, 1600));
  const third = 2;
  const start = Math.floor(rng() * Math.max(1, notes.length - third * 3 - 1));
  const degrees = [0, third, third * 2];
  if (rng() > 0.4 && notes.length > start + third * 3) degrees.push(third * 3);
  const chord = degrees.map(k => notes[Math.min(notes.length - 1, start + k)]).filter(Boolean);
  const weights = [1, 0.78, 0.7, 0.55];
  for (let c = 0; c < cols; c++) {
    const t = c / Math.max(1, cols - 1);
    const swell = 0.75 + 0.25 * Math.sin(Math.PI * t);
    for (let i = 0; i < chord.length; i++) {
      const amps = [0.88, 0.46, 0.26, 0.14, 0.08];
      for (let h = 0; h < amps.length; h++) {
        const hz = chord[i].hz * (h + 1);
        if (hz < fLo || hz > fHi) continue;
        stampCell(grid, cols, rows, c, hzToRow(hz, rows, fLo, fHi), amps[h] * swell * weights[i], false, false, h === 0 ? 0.7 : 0.5);
      }
    }
  }
  const walkN = 5 + Math.floor(rng() * 4);
  const walk0 = Math.floor(rng() * Math.max(1, notes.length - walkN));
  const dir = rng() > 0.5 ? 1 : -1;
  const c0 = Math.floor(cols * (0.12 + rng() * 0.18));
  const c1 = Math.min(cols - 1, c0 + Math.floor(cols * (0.38 + rng() * 0.28)));
  for (let c = c0; c <= c1; c++) {
    const u = (c - c0) / Math.max(1, c1 - c0);
    const step = Math.min(walkN - 1, Math.floor(u * walkN));
    const idx = dir > 0 ? walk0 + step : walk0 + (walkN - 1 - step);
    const note = notes[Math.max(0, Math.min(notes.length - 1, idx))];
    const above = notes[Math.max(0, Math.min(notes.length - 1, idx + third))];
    if (note) stampCell(grid, cols, rows, c, hzToRow(note.hz, rows, fLo, fHi), 0.82, false, false, 0.8);
    if (above) stampCell(grid, cols, rows, c, hzToRow(above.hz, rows, fLo, fHi), 0.4, false, false, 0.65);
  }
  const bandHz = Math.max(fLo, Math.min(fHi, fLo * Math.pow(fHi / fLo, 0.18 + rng() * 0.62)));
  const bandRow = hzToRow(bandHz, rows, fLo, fHi);
  const bandAmp = 0.1 + rng() * 0.08;
  for (let c = 0; c < cols; c++) {
    const wob = Math.sin(c * 0.21 + s) * 1.2;
    stampCell(grid, cols, rows, c, bandRow + wob, bandAmp, false, false, 1.8);
  }
  const period = 6 + Math.floor(rng() * 5);
  const dots = [];
  for (let i = 0; i < 4; i++) dots.push(notes[Math.floor(rng() * notes.length)]);
  for (let c = 2; c < cols - 2; c += period) {
    if (rng() < 0.2) continue;
    const note = dots[Math.floor(rng() * dots.length)];
    if (!note) continue;
    const dur = 2 + Math.floor(rng() * 2);
    const amp = 0.5 + rng() * 0.4;
    for (let dc = 0; dc < dur && c + dc < cols; dc++) {
      stampCell(grid, cols, rows, c + dc, hzToRow(note.hz, rows, fLo, fHi), amp * (1 - dc / dur), false, false, 0.55);
    }
  }
  const balance = scaleEnergy(grid, scale, root, fLo, fHi, cols, rows);
  return {
    grid, seed: s, scale, root, share: pictureShare(s, scale),
    onScale: balance.on, offScale: balance.off,
  };
}

export function overGrid(base, add) {
  const n = Math.min(base.length, add.length);
  const out = new Float32Array(base.length);
  out.set(base);
  for (let i = 0; i < n; i++) out[i] = Math.max(base[i], add[i]);
  return out;
}

export function gridDigest(grid) {
  let h = 2166136261;
  for (let i = 0; i < grid.length; i++) {
    h ^= (Math.round(grid[i] * 1000) + i) >>> 0;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function scaleEnergy(grid, scale, root, fLo, fHi, cols = COLS, rows = ROWS) {
  const onMask = scaleMask(rows, scale, root, fLo, fHi);
  const offMask = scaleMask(rows, scale, root + 1, fLo, fHi);
  let on = 0, off = 0;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const v = grid[c * rows + r] || 0;
      if (onMask[r]) on += v;
      if (offMask[r]) off += v;
    }
  }
  return { on, off };
}

export function summarizeGrid(grid, fLo = 80, fHi = 8000, cols = COLS, rows = ROWS) {
  let energy = 0, head = 0, tail = 0, lit = 0;
  const loud = col => {
    let best = 0, mag = 0;
    const c = Math.max(0, Math.min(cols - 1, col | 0));
    for (let r = 0; r < rows; r++) {
      const v = grid[c * rows + r] || 0;
      if (v > mag) { mag = v; best = r; }
    }
    return rowHz(best, rows, fLo, fHi);
  };
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const v = grid[c * rows + r] || 0;
      energy += v;
      if (c < 8) head += v;
      if (c >= cols - 8) tail += v;
      if (v > 0.2) lit++;
    }
  }
  return { energy, head, tail, lit, startHz: loud(0), endHz: loud(cols - 1), digest: gridDigest(grid) };
}

function fftRadix(re, im, inverse) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (inverse ? 2 : -2) * Math.PI / len;
    const wlenRe = Math.cos(ang);
    const wlenIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wRe = 1, wIm = 0;
      const half = len >> 1;
      for (let j = 0; j < half; j++) {
        const uRe = re[i + j];
        const uIm = im[i + j];
        const vRe = re[i + j + half] * wRe - im[i + j + half] * wIm;
        const vIm = re[i + j + half] * wIm + im[i + j + half] * wRe;
        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + half] = uRe - vRe;
        im[i + j + half] = uIm - vIm;
        const nRe = wRe * wlenRe - wIm * wlenIm;
        wIm = wRe * wlenIm + wIm * wlenRe;
        wRe = nRe;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }
}

export function analyzeBuffer(samples, sr, fLo = 80, fHi = 8000, cols = COLS, rows = ROWS) {
  const grid = new Float32Array(cols * rows);
  const L = samples;
  const N = 2048;
  if (!L || L.length < 32 || !sr) return grid;
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  const binRow = new Int16Array(N >> 1);
  binRow.fill(-1);
  for (let k = 1; k < (N >> 1); k++) {
    const f = k * sr / N;
    if (f < fLo || f > fHi) continue;
    const row = Math.round(hzToRow(f, rows, fLo, fHi));
    if (row >= 0 && row < rows) binRow[k] = row;
  }
  const usable = Math.max(1, L.length - N);
  const hop = Math.max(1, Math.floor(usable / Math.max(1, cols - 1)));
  let peak = 1e-8;
  const tmp = new Float32Array(cols * rows);
  for (let c = 0; c < cols; c++) {
    let start = Math.min(Math.max(0, L.length - N), c * hop);
    if (L.length < N) start = 0;
    for (let i = 0; i < N; i++) {
      const w = 0.5 * (1 - Math.cos(TAU * i / (N - 1)));
      re[i] = (L[start + i] || 0) * w;
      im[i] = 0;
    }
    fftRadix(re, im, false);
    for (let k = 1; k < (N >> 1); k++) {
      const row = binRow[k];
      if (row < 0) continue;
      const mag = Math.hypot(re[k], im[k]) / (N * 0.25);
      const i = c * rows + row;
      if (mag > tmp[i]) tmp[i] = mag;
    }
  }
  for (let i = 0; i < tmp.length; i++) if (tmp[i] > peak) peak = tmp[i];
  const norm = peak > 1e-8 ? peak : 1;
  for (let i = 0; i < tmp.length; i++) grid[i] = Math.max(0, Math.min(1, tmp[i] / norm));
  return grid;
}

function retune(eng) {
  const P = eng.P;
  const rows = eng.rows;
  eng.hz = new Float64Array(rows);
  for (let r = 0; r < rows; r++) eng.hz[r] = rowHz(r, rows, P.fLo, P.fHi);
  eng.mask = scaleMask(rows, P.scale, P.root | 0, P.fLo, P.fHi);
  eng.tuned = P.fLo + ':' + P.fHi + ':' + P.scale + ':' + P.root;
}

function ensureIfft(eng) {
  if (eng.re) return;
  const n = FFT_N;
  eng.re = new Float32Array(n);
  eng.im = new Float32Array(n);
  eng.win = new Float32Array(n);
  eng.ola = new Float32Array(n);
  eng.phaseK = new Float64Array(n >> 1);
  eng.wantF = new Float64Array(n >> 1);
  eng.wantA = new Float32Array(n >> 1);
  for (let i = 0; i < n; i++) eng.win[i] = 0.5 * (1 - Math.cos(TAU * i / n));
  const acc = new Float32Array(HOP);
  for (let k = 0; k < n; k += HOP) {
    for (let i = 0; i < HOP; i++) acc[i] += eng.win[k + i];
  }
  eng.cola = acc[0] || 1;
  eng.olaRead = HOP;
}

function columnMags(eng, out) {
  const P = eng.P;
  const cols = eng.cols;
  const rows = eng.rows;
  const grid = eng.grid;
  let pos = eng.pos;
  if (P.hold) pos = Math.max(0, Math.min(0.9999, P.scan || 0)) * (cols - 1);
  if (P.loop) {
    pos = ((pos % cols) + cols) % cols;
  } else {
    pos = Math.max(0, Math.min(cols - 1, pos));
  }
  const c0 = Math.floor(pos);
  const c1 = P.loop ? (c0 + 1) % cols : Math.min(cols - 1, c0 + 1);
  const fr = pos - c0;
  const curve = P.curve > 0 ? P.curve : 1;
  const mask = eng.mask;
  let sumSq = 0;
  for (let r = 0; r < rows; r++) {
    let m = grid[c0 * rows + r] * (1 - fr) + grid[c1 * rows + r] * fr;
    if (mask && !mask[r]) m = 0;
    if (m < 1e-5) { out[r] = 0; continue; }
    if (curve !== 1) m = Math.pow(m, curve);
    out[r] = m;
    sumSq += m * m;
  }
  eng.col = c0;
  eng.sumSq = sumSq;
  return pos;
}

function advancePlayhead(eng, samples) {
  const P = eng.P;
  if (P.hold) {
    eng.pos = Math.max(0, Math.min(0.9999, P.scan || 0)) * (eng.cols - 1);
    return;
  }
  eng.pos += (P.speed || 0) * samples / eng.sr;
  if (P.loop) {
    const c = eng.cols;
    eng.pos = ((eng.pos % c) + c) % c;
  } else if (eng.pos >= eng.cols - 1) eng.pos = eng.cols - 1;
  else if (eng.pos < 0) eng.pos = 0;
}

function clip(x) {
  if (x > 0.98) return 0.98;
  if (x < -0.98) return -0.98;
  return x;
}

function ratioOf(eng, semi) {
  const bend = (eng.bend || 0) * 2;
  const wheel = (eng.mod || 0) * 0.15;
  return Math.pow(2, (semi + bend) / 12) * (1 + wheel);
}

function synthIfftHop(eng) {
  ensureIfft(eng);
  const n = FFT_N;
  const re = eng.re;
  const im = eng.im;
  re.fill(0);
  im.fill(0);
  const P = eng.P;
  const rows = eng.rows;
  const mags = eng.mags;
  columnMags(eng, mags);
  const voices = soundingVoices(eng);
  const gain = 0.55 / Math.max(0.35, Math.sqrt(eng.sumSq || 0));
  const randomPhase = P.phase === 'random';
  const wantF = eng.wantF;
  const wantA = eng.wantA;
  wantF.fill(0);
  wantA.fill(0);
  for (let v = 0; v < voices.length; v++) {
    const voice = voices[v];
    const g = voice.gain;
    if (g < 1e-5) continue;
    const ratio = ratioOf(eng, voice.semi || 0);
    for (let r = 0; r < rows; r++) {
      const amp = mags[r] * gain * g;
      if (amp < 1e-5) continue;
      const f = eng.hz[r] * ratio;
      if (f < 20 || f >= eng.sr * 0.45) continue;
      const k = Math.round(f * n / eng.sr);
      if (k < 1 || k >= (n >> 1)) continue;
      const ph = randomPhase ? hash01(eng.hopIndex, k, v) * TAU : eng.phaseK[k];
      const A = amp * (n >> 1);
      const c = Math.cos(ph);
      const s = Math.sin(ph);
      re[k] += A * c;
      im[k] += A * s;
      re[n - k] += A * c;
      im[n - k] -= A * s;
      // The next hop steps phase at the loudest partial's true frequency,
      // so a painted line is not stuck on the nearest bin centre.
      if (amp >= wantA[k]) { wantA[k] = amp; wantF[k] = f; }
    }
  }
  if (!randomPhase) {
    for (let k = 1; k < (n >> 1); k++) {
      const f = wantF[k] || (k * eng.sr / n);
      eng.phaseK[k] += TAU * f * HOP / eng.sr;
    }
  }
  eng.hopIndex++;
  fftRadix(re, im, true);
  const ola = eng.ola;
  const win = eng.win;
  const cola = eng.cola;
  for (let i = 0; i < n; i++) ola[i] += re[i] * win[i] / cola;
}

function pullIfft(eng, count, L, R, offset, voices) {
  ensureIfft(eng);
  // Keep voice gains fresh for this hop. The additive path updates per sample;
  // here one hop shares the gains at the start of the hop, which is fine.
  for (let i = 0; i < count; i++) {
    if (eng.olaRead >= HOP) {
      eng.ola.copyWithin(0, HOP);
      eng.ola.fill(0, FFT_N - HOP);
      eng.olaRead = 0;
      synthIfftHop(eng);
    }
    const s = clip(eng.ola[eng.olaRead++] * (eng.P.level || 0));
    L[offset + i] = s;
    R[offset + i] = s;
  }
}

function soundingVoices(eng) {
  if (!eng.P.keyboard) {
    eng.free.gain = 1;
    eng.free.semi = 0;
    return [eng.free];
  }
  return eng.voices;
}

function renderAdditive(eng, L, R) {
  const n = L.length;
  const rows = eng.rows;
  const P = eng.P;
  const mags = eng.mags;
  const sr = eng.sr;
  const att = 1 - Math.exp(-1 / (0.004 * sr));
  const rel = 1 - Math.exp(-1 / (0.010 * sr));
  const width = P.width || 0;
  for (let i = 0; i < n; i++) {
    advancePlayhead(eng, 1);
    columnMags(eng, mags);
    const voices = soundingVoices(eng);
    let sL = 0, sR = 0;
    const norm = 0.5 / Math.max(0.35, Math.sqrt(eng.sumSq || 0));
    for (let v = 0; v < voices.length; v++) {
      const voice = voices[v];
      const target = voice.target == null ? voice.gain : voice.target;
      const k = target > voice.gain ? att : rel;
      voice.gain += (target - voice.gain) * k;
      if (voice.gain < 1e-5) continue;
      const ratio = ratioOf(eng, voice.semi || 0);
      const phase = voice.phase;
      for (let r = 0; r < rows; r++) {
        const amp = mags[r];
        if (amp < 1e-4) continue;
        const f = eng.hz[r] * ratio;
        if (f >= sr * 0.45) continue;
        phase[r] += TAU * f / sr;
        if (phase[r] >= TAU) phase[r] -= TAU;
        if (P.phase === 'random' && eng.col !== voice.col) {
          phase[r] = hash01(eng.col + 1, r, v + 1) * TAU;
        }
        const s = Math.sin(phase[r]) * amp * norm * voice.gain;
        if (width < 1e-4) { sL += s; sR += s; }
        else {
          const pan = (r / (rows - 1)) * 2 - 1;
          const ang = pan * width * 0.6;
          sL += s * Math.cos(Math.PI / 4 + ang);
          sR += s * Math.sin(Math.PI / 4 + ang);
        }
      }
      voice.col = eng.col;
    }
    const level = P.level || 0;
    L[i] = clip(sL * level);
    R[i] = clip(sR * level);
  }
  if (P.keyboard) {
    for (let v = eng.voices.length - 1; v >= 0; v--) {
      const voice = eng.voices[v];
      if (!voice.down && voice.gain < 1e-4 && (voice.target || 0) === 0) eng.voices.splice(v, 1);
    }
  }
}

export function createOrthiconEngine(sr, patch) {
  const eng = {
    sr: sr || 48000,
    cols: COLS,
    rows: ROWS,
    P: patch || {},
    grid: new Float32Array(COLS * ROWS),
    pos: 0,
    col: -1,
    voices: [],
    free: { gain: 1, target: 1, semi: 0, phase: new Float64Array(ROWS), col: -1 },
    mags: new Float32Array(ROWS),
    bend: 0,
    mod: 0,
    sustain: false,
    active: true,
    soon: [],
    now: 0,
    cpu: 0,
    level: 0,
    voicesN: 0,
    hopIndex: 1,
    onMeter: null,
    lastMeter: -1e9,
  };
  const picture = (patch && patch.picture) || 'ridge';
  if (picture !== 'custom') {
    eng.grid = pictureGrid(picture, patch && patch.fLo, patch && patch.fHi);
  }
  retune(eng);
  return eng;
}

export function setOrthiconGrid(eng, data) {
  if (!data || data.length !== eng.grid.length) return;
  eng.grid.set(data);
}

function applyOrthicon(eng, msg) {
  if (!msg || !msg.t) return;
  if (msg.t === 'patch') {
    const prev = eng.P && eng.P.picture;
    eng.P = msg.p || eng.P;
    retune(eng);
    if (eng.P.picture && eng.P.picture !== 'custom' && eng.P.picture !== prev) {
      eng.grid = pictureGrid(eng.P.picture, eng.P.fLo, eng.P.fHi);
    }
    return;
  }
  if (msg.t === 'grid') { setOrthiconGrid(eng, msg.data || msg.grid); return; }
  if (msg.t === 'active') { eng.active = msg.on !== false; if (!eng.active) silence(eng); return; }
  if (msg.t === 'bend') { eng.bend = +msg.v || 0; return; }
  if (msg.t === 'mw') { eng.mod = +msg.v || 0; return; }
  if (msg.t === 'sus') {
    eng.sustain = !!msg.on;
    if (!eng.sustain) eng.voices.forEach(v => { if (!v.down) v.target = 0; });
    return;
  }
  if (msg.t === 'panic') { silence(eng); return; }
  if (msg.t === 'on') {
    const n = msg.n | 0;
    let voice = null;
    for (let i = 0; i < eng.voices.length; i++) if (eng.voices[i].n === n) voice = eng.voices[i];
    const vel = Math.max(0.15, Math.min(1, msg.v == null ? 0.8 : +msg.v));
    if (voice) { voice.down = true; voice.target = vel; return; }
    if (eng.voices.length >= 6) {
      let quiet = 0;
      for (let i = 1; i < eng.voices.length; i++) if (eng.voices[i].gain < eng.voices[quiet].gain) quiet = i;
      eng.voices.splice(quiet, 1);
    }
    eng.voices.push({
      n, down: true, target: vel, gain: 0, semi: n - 60,
      phase: new Float64Array(eng.rows), col: -1,
    });
    return;
  }
  if (msg.t === 'off') {
    const n = msg.n | 0;
    for (let i = 0; i < eng.voices.length; i++) {
      const voice = eng.voices[i];
      if (voice.n !== n) continue;
      voice.down = false;
      if (!eng.sustain) voice.target = 0;
    }
  }
}

function silence(eng) {
  eng.voices.forEach(v => { v.down = false; v.target = 0; v.gain = 0; });
  eng.voices.length = 0;
  if (eng.ola) eng.ola.fill(0);
  eng.olaRead = HOP;
}

export function postOrthicon(eng, msg) {
  if (!msg) return;
  if (msg.at != null && msg.at > eng.now) {
    eng.soon.push(msg);
    return;
  }
  applyOrthicon(eng, msg);
}

function flush(eng, frame) {
  eng.now = frame;
  if (!eng.soon.length) return;
  let i = 0;
  for (; i < eng.soon.length; i++) if (eng.soon[i].at > frame) break;
  if (!i) return;
  const due = eng.soon.splice(0, i);
  for (let k = 0; k < due.length; k++) applyOrthicon(eng, due[k]);
}

export function renderOrthicon(eng, L, R, frame) {
  const n = L.length;
  const t0 = globalThis.performance && performance.now ? performance.now() : Date.now();
  if (!R) R = L;
  if (eng.active === false) {
    L.fill(0);
    if (R !== L) R.fill(0);
    eng.voicesN = 0;
    eng.level = 0;
    return;
  }
  if (eng.tuned !== (eng.P.fLo + ':' + eng.P.fHi + ':' + eng.P.scale + ':' + eng.P.root)) retune(eng);
  // Events stamped inside this block are applied on the sample they name.
  const keyboard = !!eng.P.keyboard;
  if ((eng.P.engine || 'add') === 'ifft') {
    let i = 0;
    while (i < n) {
      flush(eng, frame + i);
      const nextAt = eng.soon.length ? eng.soon[0].at : frame + n;
      const run = Math.max(1, Math.min(n - i, nextAt - (frame + i)));
      // Update keyboard envelopes once per slice so a note-off takes effect.
      if (keyboard) {
        const att = 1 - Math.exp(-run / (0.004 * eng.sr));
        const rel = 1 - Math.exp(-run / (0.010 * eng.sr));
        for (let v = 0; v < eng.voices.length; v++) {
          const voice = eng.voices[v];
          const target = voice.target || 0;
          voice.gain += (target - voice.gain) * (target > voice.gain ? att : rel);
        }
      }
      pullIfft(eng, run, L, R, i);
      if (!eng.P.hold) advancePlayhead(eng, run);
      i += run;
    }
    if (keyboard) {
      for (let v = eng.voices.length - 1; v >= 0; v--) {
        const voice = eng.voices[v];
        if (!voice.down && voice.gain < 1e-4) eng.voices.splice(v, 1);
      }
    }
  } else {
    // Sample loop flushes its own events by splitting on timestamps.
    let i = 0;
    while (i < n) {
      flush(eng, frame + i);
      const nextAt = eng.soon.length ? eng.soon[0].at : frame + n;
      const run = Math.max(1, Math.min(n - i, nextAt - (frame + i)));
      const l = L.subarray(i, i + run);
      const r = R.subarray(i, i + run);
      renderAdditive(eng, l, r);
      i += run;
    }
  }
  eng.now = frame + n - 1;
  let peak = 0;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.abs(L[i]);
    if (a > peak) peak = a;
    acc += L[i] * L[i];
  }
  eng.level = Math.sqrt(acc / n);
  eng.voicesN = keyboard ? eng.voices.filter(v => v.down || v.gain > 0.02).length : (eng.level > 1e-5 ? 1 : 0);
  const dt = (globalThis.performance && performance.now ? performance.now() : Date.now()) - t0;
  const block = n / eng.sr * 1000;
  const cpu = block > 0 ? dt / block : 0;
  eng.cpu += (cpu - eng.cpu) * 0.3;
  if (eng.onMeter && frame - eng.lastMeter > eng.sr * 0.05) {
    eng.lastMeter = frame;
    eng.onMeter({
      t: 'meter', voices: eng.voicesN, cpu: eng.cpu, level: eng.level,
      column: eng.cols ? eng.pos / eng.cols : 0, peak,
    });
  }
}
