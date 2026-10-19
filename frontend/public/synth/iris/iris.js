// Iris patch and picture analysis. Schema v1.
//
// Iris is a camera instrument. The frame in front of the lens is the score:
// a column of brightness becomes a bank of tones, hue picks a chord, motion
// lights notes, and edges stir a noise texture. This file is the part with
// no clock and no audio: the patch, the scales, and the pixel measurements.
//
// The scan is the ordinary photosonic idea (one column, one oscillator per
// row, log-spaced, the way Orthicon's additive bank is one sine per row).
// Nothing here was copied from a spectral-paint program or a camera synth.

export const IRIS_SCHEMA = 1;
export const IRIS_ID = 'iris';

export const MODES = ['scanline', 'color', 'motion', 'edges'];
export const SCALES = ['off', 'major', 'minor', 'pentatonic', 'whole', 'chromatic'];
export const SIZES = ['S', 'M', 'L', 'XL'];
export const BANDS = 32;
export const GRID_COLS = 8;
export const GRID_ROWS = 6;

export const SIZE_PREVIEW = { S: 200, M: 300, L: 420, XL: 560 };

const STEPS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  whole: [0, 2, 4, 6, 8, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

const RANGE = {
  level: [0, 1],
  reverb: [0, 1],
  speed: [0.05, 2],
  root: [36, 84],
  fLo: [40, 800],
  fHi: [400, 12000],
};

export const IRIS_DEFAULT = {
  v: IRIS_SCHEMA,
  device: IRIS_ID,
  name: 'Iris',
  mode: 'scanline',
  scale: 'pentatonic',
  root: 60,
  snap: true,
  speed: 0.28,
  level: 0.8,
  reverb: 0.22,
  freeze: false,
  fLo: 110,
  fHi: 3520,
  size: 'M',
};

export function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }

function pick(list, value, fallback) {
  return list.indexOf(value) >= 0 ? value : fallback;
}

export function normalizeIris(p) {
  const src = p && typeof p === 'object' ? p : {};
  const out = Object.assign({}, IRIS_DEFAULT);
  if (typeof src.name === 'string' && src.name.trim()) out.name = src.name.trim().slice(0, 40);
  out.mode = pick(MODES, src.mode, out.mode);
  out.scale = pick(SCALES, src.scale, out.scale);
  out.size = pick(SIZES, src.size, out.size);
  Object.keys(RANGE).forEach(k => {
    if (src[k] == null || !isFinite(+src[k])) return;
    out[k] = clamp(+src[k], RANGE[k][0], RANGE[k][1]);
  });
  out.root = Math.round(out.root);
  if (src.snap != null) out.snap = !!src.snap;
  if (src.freeze != null) out.freeze = !!src.freeze;
  if (out.fHi < out.fLo * 2) out.fHi = Math.min(RANGE.fHi[1], out.fLo * 2);
  out.v = IRIS_SCHEMA;
  out.device = IRIS_ID;
  return out;
}

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function noteName(midi) {
  const n = Math.round(midi);
  const pc = ((n % 12) + 12) % 12;
  const oct = Math.floor(n / 12) - 1;
  return NOTE_NAMES[pc] + oct;
}

export function midiToHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function hzToMidi(hz) {
  return 69 + 12 * Math.log2(Math.max(1e-6, hz) / 440);
}

export function scaleSteps(scale) {
  if (!scale || scale === 'off') return null;
  return STEPS[scale] || STEPS.major;
}

export function snapMidi(midi, scale, root) {
  const steps = scaleSteps(scale);
  if (!steps) return midi;
  const r = ((Math.round(root) % 12) + 12) % 12;
  const allowed = new Uint8Array(12);
  for (let i = 0; i < steps.length; i++) allowed[(r + steps[i]) % 12] = 1;
  const base = Math.round(midi);
  let best = base;
  let bestD = 99;
  for (let n = base - 7; n <= base + 7; n++) {
    const pc = ((n % 12) + 12) % 12;
    if (!allowed[pc]) continue;
    const d = Math.abs(n - midi);
    if (d < bestD) { bestD = d; best = n; }
  }
  return best;
}

export function snapHz(hz, scale, root, snap) {
  if (!snap) return hz;
  const midi = snapMidi(hzToMidi(hz), scale, root);
  return midiToHz(midi);
}

export function bandHz(index, bands, fLo, fHi) {
  const n = Math.max(1, bands - 1);
  const t = clamp(index, 0, n) / n;
  const lo = Math.max(20, fLo);
  const hi = Math.max(lo * 1.01, fHi);
  return lo * Math.pow(hi / lo, t);
}

export function chordOf(hue, scale, root) {
  const r = Math.round(root);
  const h = ((+hue % 1) + 1) % 1;
  const steps = scaleSteps(scale);
  if (!steps) {
    const shift = Math.round(h * 12) % 12;
    const minor = h > 0.45 && h < 0.85;
    const shape = minor ? [0, 3, 7] : [0, 4, 7];
    return shape.map(s => r + shift + s);
  }
  const deg = Math.floor(h * steps.length) % steps.length;
  const notes = [];
  for (let k = 0; k < 3; k++) {
    const pos = deg + k * 2;
    const idx = pos % steps.length;
    const oct = Math.floor(pos / steps.length);
    notes.push(r + steps[idx] + oct * 12);
  }
  return notes;
}

export function chordLabel(notes, scale) {
  if (!notes || !notes.length) return '';
  const name = noteName(notes[0]);
  if (!scale || scale === 'off') {
    const third = notes.length > 1 ? notes[1] - notes[0] : 4;
    return name + (third <= 3 ? ' minor' : ' major');
  }
  return name + ' ' + scale;
}

export function cellMidi(gx, gy, cols, rows, scale, root, snap) {
  const rowFromBottom = (rows - 1 - gy);
  const steps = snap ? scaleSteps(scale) : null;
  if (!steps) return Math.round(root) + rowFromBottom * 5 + gx;
  const deg = gx % steps.length;
  const extra = Math.floor(gx / steps.length);
  return Math.round(root) + rowFromBottom * 12 + steps[deg] + extra * 12;
}

export function lumaOf(r, g, b) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function rgbToHsv(r, g, b) {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const d = max - min;
  let h = 0;
  if (d > 1e-8) {
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    if (h < 0) h += 6;
    h /= 6;
  }
  return { h, s: max < 1e-8 ? 0 : d / max, v: max };
}

function idx(x, y, w) { return (y * w + x) * 4; }

export function columnBands(rgba, w, h, x, bands) {
  const n = bands || BANDS;
  const out = new Float32Array(n);
  const count = new Float32Array(n);
  if (!rgba || w < 1 || h < 1) return out;
  const col = clamp(x | 0, 0, w - 1);
  for (let row = 0; row < h; row++) {
    const slice = Math.min(n - 1, Math.floor(row * n / h));
    const b = n - 1 - slice;
    let acc = 0;
    let k = 0;
    for (let dx = -1; dx <= 1; dx++) {
      const xx = clamp(col + dx, 0, w - 1);
      const i = idx(xx, row, w);
      acc += lumaOf(rgba[i], rgba[i + 1], rgba[i + 2]);
      k++;
    }
    out[b] += acc / k;
    count[b]++;
  }
  for (let b = 0; b < n; b++) if (count[b]) out[b] /= count[b];
  return out;
}

export function dominantColor(rgba, w, h) {
  const blank = { hue: 0, sat: 0, val: 0 };
  if (!rgba || w < 1 || h < 1) return blank;
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 3500)));
  let sx = 0, sy = 0, s = 0, v = 0, n = 0;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = idx(x, y, w);
      const hsv = rgbToHsv(rgba[i], rgba[i + 1], rgba[i + 2]);
      const wgt = Math.max(0.04, hsv.s) * Math.max(0.04, hsv.v);
      const ang = hsv.h * Math.PI * 2;
      sx += Math.cos(ang) * wgt;
      sy += Math.sin(ang) * wgt;
      s += hsv.s;
      v += hsv.v;
      n++;
    }
  }
  if (!n) return blank;
  let hue = Math.atan2(sy, sx) / (Math.PI * 2);
  if (hue < 0) hue += 1;
  return { hue, sat: s / n, val: v / n };
}

export function motionGrid(prev, curr, w, h, cols, rows) {
  const cx = cols || GRID_COLS;
  const ry = rows || GRID_ROWS;
  const out = new Float32Array(cx * ry);
  if (!prev || !curr || w < 1 || h < 1) return out;
  for (let gy = 0; gy < ry; gy++) {
    const y0 = Math.floor(gy * h / ry);
    const y1 = Math.max(y0 + 1, Math.floor((gy + 1) * h / ry));
    for (let gx = 0; gx < cx; gx++) {
      const x0 = Math.floor(gx * w / cx);
      const x1 = Math.max(x0 + 1, Math.floor((gx + 1) * w / cx));
      const stepX = Math.max(1, Math.floor((x1 - x0) / 6));
      const stepY = Math.max(1, Math.floor((y1 - y0) / 6));
      let acc = 0;
      let n = 0;
      for (let y = y0; y < y1 && y < h; y += stepY) {
        for (let x = x0; x < x1 && x < w; x += stepX) {
          const i = idx(x, y, w);
          const a = lumaOf(prev[i], prev[i + 1], prev[i + 2]);
          const b = lumaOf(curr[i], curr[i + 1], curr[i + 2]);
          acc += Math.abs(a - b);
          n++;
        }
      }
      out[gy * cx + gx] = n ? acc / n : 0;
    }
  }
  return out;
}

export function edgeTexture(rgba, w, h) {
  const blank = { edge: 0, texture: 0 };
  if (!rgba || w < 2 || h < 2) return blank;
  const dw = Math.min(72, w);
  const dh = Math.max(8, Math.min(54, Math.round(dw * h / w)));
  const lum = new Float32Array(dw * dh);
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(h - 1, Math.floor((y + 0.5) * h / dh));
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(w - 1, Math.floor((x + 0.5) * w / dw));
      const i = idx(sx, sy, w);
      lum[y * dw + x] = lumaOf(rgba[i], rgba[i + 1], rgba[i + 2]);
    }
  }
  let mean = 0;
  for (let i = 0; i < lum.length; i++) mean += lum[i];
  mean /= lum.length;
  let varSum = 0;
  for (let i = 0; i < lum.length; i++) {
    const d = lum[i] - mean;
    varSum += d * d;
  }
  let grad = 0;
  let gN = 0;
  for (let y = 1; y < dh; y++) {
    for (let x = 1; x < dw; x++) {
      const i = y * dw + x;
      const gx = lum[i] - lum[i - 1];
      const gy = lum[i] - lum[i - dw];
      grad += Math.hypot(gx, gy);
      gN++;
    }
  }
  const edge = clamp((gN ? grad / gN : 0) / 0.35, 0, 1);
  const texture = clamp(Math.sqrt(varSum / lum.length) / 0.32, 0, 1);
  return { edge, texture };
}

export function visionFrom(rgba, w, h, prev, x) {
  const bands = columnBands(rgba, w, h, x, BANDS);
  const color = dominantColor(rgba, w, h);
  const motion = motionGrid(prev, rgba, w, h, GRID_COLS, GRID_ROWS);
  const tex = edgeTexture(rgba, w, h);
  return {
    bands,
    hue: color.hue,
    sat: color.sat,
    val: color.val,
    motion,
    edge: tex.edge,
    texture: tex.texture,
  };
}

// 16-bit stereo WAV. Live recording uses the context rate.
export function encodeWav16(L, R, sampleRate) {
  const sr = sampleRate > 0 ? sampleRate | 0 : 44100;
  const n = Math.min(L.length, R.length);
  const dataBytes = n * 4;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 2, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * 4, true);
  v.setUint16(32, 4, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, dataBytes, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    const a = clamp(Math.round(clamp(L[i], -1, 1) * 32767), -32768, 32767);
    const b = clamp(Math.round(clamp(R[i], -1, 1) * 32767), -32768, 32767);
    v.setInt16(o, a, true);
    v.setInt16(o + 2, b, true);
    o += 4;
  }
  return new Uint8Array(buf);
}

export function wavName() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return 'iris-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate())
    + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + '.wav';
}
