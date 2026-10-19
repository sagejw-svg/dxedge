// Aether gesture math. Pure functions: landmarks in, musical controls out.
// Screen space is the mirrored preview: x = 0 at the left, y = 0 at the top.
// Nothing in this file touches the camera, the network, or the audio graph.

export const SCALES = {
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  pentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  whole: [0, 2, 4, 6, 8, 10],
};

export const SCALE_NAMES = {
  chromatic: 'Chromatic',
  major: 'Major',
  minor: 'Natural minor',
  harmonic: 'Harmonic minor',
  dorian: 'Dorian',
  mixolydian: 'Mixolydian',
  pentatonic: 'Pentatonic',
  minorPentatonic: 'Minor pentatonic',
  blues: 'Blues',
  whole: 'Whole tone',
};

export const ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const PITCH_LOW = 48; // C3
export const PITCH_HIGH = 84; // C6

export const HAND_BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function dist(a, b) {
  const dx = (a.x || 0) - (b.x || 0);
  const dy = (a.y || 0) - (b.y || 0);
  return Math.hypot(dx, dy);
}

export function midiToHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function noteName(midi, withCents) {
  const rounded = Math.round(midi);
  const name = ROOTS[((rounded % 12) + 12) % 12] + (Math.floor(rounded / 12) - 1);
  if (!withCents) return name;
  const cents = Math.round((midi - rounded) * 100);
  if (!cents) return name;
  return name + (cents > 0 ? ' +' : ' ') + cents + '¢';
}

export function snapMidi(midi, root, intervals) {
  const scale = intervals && intervals.length ? intervals : SCALES.chromatic;
  const r = ((root % 12) + 12) % 12;
  let best = Math.round(midi);
  let bestD = 1e9;
  const lo = Math.floor(midi) - 12;
  const hi = Math.ceil(midi) + 12;
  for (let m = lo; m <= hi; m++) {
    const pc = ((m % 12) + 12) % 12;
    const rel = (pc - r + 12) % 12;
    if (scale.indexOf(rel) < 0) continue;
    const d = Math.abs(m - midi);
    if (d < bestD) { bestD = d; best = m; }
  }
  return best;
}

export function defaultCalibration() {
  return {
    x0: 0.16,
    x1: 0.92,
    y0: 0.82,
    y1: 0.12,
    spanFar: 0.07,
    spanNear: 0.30,
    pinchClosed: 0.22,
    pinchOpen: 1.08,
    spreadClosed: 0.78,
    spreadOpen: 1.32,
  };
}

export function sanitizeCalibration(input) {
  const d = defaultCalibration();
  const c = Object.assign({}, d, input || {});
  for (const k of Object.keys(d)) c[k] = Number.isFinite(+c[k]) ? +c[k] : d[k];
  if (!(c.x1 - c.x0 > 0.08)) { c.x0 = d.x0; c.x1 = d.x1; }
  if (c.x1 < c.x0) { const s = c.x0; c.x0 = c.x1; c.x1 = s; }
  if (!(c.y0 - c.y1 > 0.08)) { c.y0 = d.y0; c.y1 = d.y1; }
  if (c.y1 > c.y0) { const s = c.y0; c.y0 = c.y1; c.y1 = s; }
  if (!(c.spanNear - c.spanFar > 0.02)) { c.spanFar = d.spanFar; c.spanNear = d.spanNear; }
  if (c.spanNear < c.spanFar) { const s = c.spanNear; c.spanNear = c.spanFar; c.spanFar = s; }
  if (!(c.pinchOpen - c.pinchClosed > 0.05)) { c.pinchClosed = d.pinchClosed; c.pinchOpen = d.pinchOpen; }
  if (c.pinchOpen < c.pinchClosed) { const s = c.pinchOpen; c.pinchOpen = c.pinchClosed; c.pinchClosed = s; }
  if (!(c.spreadOpen - c.spreadClosed > 0.05)) { c.spreadClosed = d.spreadClosed; c.spreadOpen = d.spreadOpen; }
  if (c.spreadOpen < c.spreadClosed) { const s = c.spreadOpen; c.spreadOpen = c.spreadClosed; c.spreadClosed = s; }
  c.x0 = clamp(c.x0, -0.05, 0.95);
  c.x1 = clamp(c.x1, 0.05, 1.05);
  c.y0 = clamp(c.y0, 0.05, 1.05);
  c.y1 = clamp(c.y1, -0.05, 0.95);
  return c;
}

export function emptyExtents() {
  return {
    minX: null, maxX: null, minY: null, maxY: null,
    minSpan: null, maxSpan: null,
    minPinch: null, maxPinch: null,
    minSpread: null, maxSpread: null,
  };
}

function pushMinMax(ext, minK, maxK, value) {
  if (!Number.isFinite(value)) return;
  if (ext[minK] == null || value < ext[minK]) ext[minK] = value;
  if (ext[maxK] == null || value > ext[maxK]) ext[maxK] = value;
}

export function observeExtents(ext, sample) {
  const e = ext || emptyExtents();
  if (!sample) return e;
  if (sample.x != null) { pushMinMax(e, 'minX', 'maxX', sample.x); }
  if (sample.y != null) { pushMinMax(e, 'minY', 'maxY', sample.y); }
  if (sample.span != null) { pushMinMax(e, 'minSpan', 'maxSpan', sample.span); }
  if (sample.pinch != null) { pushMinMax(e, 'minPinch', 'maxPinch', sample.pinch); }
  if (sample.spread != null) { pushMinMax(e, 'minSpread', 'maxSpread', sample.spread); }
  return e;
}

export function calibrationFromExtents(ext) {
  const d = defaultCalibration();
  const c = Object.assign({}, d);
  if (ext && ext.minX != null && ext.maxX - ext.minX > 0.12) {
    const pad = (ext.maxX - ext.minX) * 0.04;
    c.x0 = ext.minX - pad;
    c.x1 = ext.maxX + pad;
  }
  if (ext && ext.minY != null && ext.maxY - ext.minY > 0.12) {
    const pad = (ext.maxY - ext.minY) * 0.04;
    c.y1 = ext.minY - pad;
    c.y0 = ext.maxY + pad;
  }
  if (ext && ext.minSpan != null && ext.maxSpan - ext.minSpan > 0.025) {
    c.spanFar = ext.minSpan;
    c.spanNear = ext.maxSpan;
  }
  if (ext && ext.minPinch != null && ext.maxPinch - ext.minPinch > 0.08) {
    c.pinchClosed = ext.minPinch;
    c.pinchOpen = ext.maxPinch;
  }
  if (ext && ext.minSpread != null && ext.maxSpread - ext.minSpread > 0.08) {
    c.spreadClosed = ext.minSpread;
    c.spreadOpen = ext.maxSpread;
  }
  return sanitizeCalibration(c);
}

export function palmSpan(lm) {
  if (!lm || lm.length < 18) return 0;
  return dist(lm[5], lm[17]);
}

export function palmCenter(lm) {
  const ids = [0, 5, 9, 13, 17];
  let x = 0, y = 0, z = 0, n = 0;
  for (let i = 0; i < ids.length; i++) {
    const p = lm[ids[i]];
    if (!p) continue;
    x += p.x; y += p.y; z += p.z || 0; n++;
  }
  if (!n) return { x: 0.5, y: 0.5, z: 0 };
  return { x: x / n, y: y / n, z: z / n };
}

export function pinchNorm(lm) {
  const span = Math.max(1e-4, palmSpan(lm));
  return dist(lm[4], lm[8]) / span;
}

export function spreadNorm(lm) {
  const tips = [4, 8, 12, 16, 20];
  let s = 0, n = 0;
  for (let i = 0; i < tips.length; i++) {
    for (let j = i + 1; j < tips.length; j++) {
      s += dist(lm[tips[i]], lm[tips[j]]);
      n++;
    }
  }
  return (s / Math.max(1, n)) / Math.max(1e-4, palmSpan(lm));
}

export function isFist(lm) {
  if (!lm || lm.length < 21) return false;
  const wrist = lm[0];
  const tips = [8, 12, 16, 20];
  const mcps = [5, 9, 13, 17];
  let curled = 0;
  for (let i = 0; i < 4; i++) {
    if (dist(lm[tips[i]], wrist) < dist(lm[mcps[i]], wrist) * 1.2) curled++;
  }
  return curled >= 3;
}

export function pinchAmount(lm, cal) {
  const c = cal || defaultCalibration();
  const n = pinchNorm(lm);
  return clamp((c.pinchOpen - n) / (c.pinchOpen - c.pinchClosed || 1), 0, 1);
}

export function spreadAmount(lm, cal) {
  const c = cal || defaultCalibration();
  const n = spreadNorm(lm);
  return clamp((n - c.spreadClosed) / (c.spreadOpen - c.spreadClosed || 1), 0, 1);
}

// A 21-point hand in screen space. `x` and `y` are the palm center.
// `span` is the index-to-pinky knuckle distance (larger means closer to the camera).
// `pinch` 0 is open, 1 pinches the thumb to the index finger.
// `spread` 0 keeps the fingers together, 1 opens them.
// `fist` curls the fingers into the palm.
export function syntheticHand(opts) {
  const o = opts || {};
  const span = Math.max(0.02, o.span == null ? 0.16 : o.span);
  const pinch = clamp(o.pinch == null ? 0 : o.pinch, 0, 1);
  const spread = clamp(o.spread == null ? 0.75 : o.spread, 0, 1);
  const fist = !!o.fist;
  const lm = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  lm[5] = { x: -span / 2, y: 0, z: 0 };
  lm[17] = { x: span / 2, y: 0, z: 0 };
  lm[9] = { x: -span / 6, y: -span * 0.04, z: 0 };
  lm[13] = { x: span / 6, y: -span * 0.04, z: 0 };
  lm[0] = { x: 0, y: span * 0.72, z: 0 };
  const fingers = [
    { mcp: 5, pip: 6, dip: 7, tip: 8, lean: -0.42 },
    { mcp: 9, pip: 10, dip: 11, tip: 12, lean: -0.12 },
    { mcp: 13, pip: 14, dip: 15, tip: 16, lean: 0.16 },
    { mcp: 17, pip: 18, dip: 19, tip: 20, lean: 0.46 },
  ];
  const fan = 0.22 + spread * 0.95;
  for (let i = 0; i < fingers.length; i++) {
    const f = fingers[i];
    const mcp = lm[f.mcp];
    const angle = -Math.PI / 2 + f.lean * fan;
    const len = fist ? span * 0.22 : span * (1.05 + spread * 0.35);
    const ux = fist ? -Math.sin(angle) * 0.15 : Math.cos(angle);
    const uy = fist ? 0.95 : Math.sin(angle);
    const n = Math.hypot(ux, uy) || 1;
    const dx = ux / n, dy = uy / n;
    lm[f.pip] = { x: mcp.x + dx * len * 0.38, y: mcp.y + dy * len * 0.38, z: 0 };
    lm[f.dip] = { x: mcp.x + dx * len * 0.7, y: mcp.y + dy * len * 0.7, z: 0 };
    lm[f.tip] = { x: mcp.x + dx * len, y: mcp.y + dy * len, z: fist ? 0 : 0 };
  }
  if (fist) {
    for (let i = 0; i < fingers.length; i++) {
      const f = fingers[i];
      const mcp = lm[f.mcp];
      lm[f.tip] = { x: mcp.x * 0.25, y: span * 0.45, z: 0 };
      lm[f.dip] = { x: mcp.x * 0.45, y: span * 0.28, z: 0 };
      lm[f.pip] = { x: mcp.x * 0.75, y: span * 0.1, z: 0 };
    }
  }
  lm[1] = { x: -span * 0.42, y: span * 0.28, z: 0 };
  lm[2] = { x: -span * 0.72, y: span * 0.02, z: 0 };
  lm[3] = { x: -span * 0.62, y: -span * 0.28, z: 0 };
  const openThumb = { x: -span * 0.28, y: -span * (0.15 + spread * 0.55), z: 0 };
  const indexTip = lm[8];
  lm[4] = {
    x: openThumb.x + (indexTip.x - openThumb.x) * pinch,
    y: openThumb.y + (indexTip.y - openThumb.y) * pinch,
    z: 0,
  };
  if (fist) lm[4] = { x: span * 0.05, y: span * 0.4, z: 0 };
  const center = palmCenter(lm);
  const tx = (o.x == null ? 0.5 : o.x) - center.x;
  const ty = (o.y == null ? 0.5 : o.y) - center.y;
  for (let i = 0; i < lm.length; i++) {
    lm[i] = { x: lm[i].x + tx, y: lm[i].y + ty, z: 0 };
  }
  return lm;
}

export function handMetrics(lm, cal) {
  const c = palmCenter(lm);
  return {
    x: c.x,
    y: c.y,
    span: palmSpan(lm),
    pinch: pinchNorm(lm),
    spread: spreadNorm(lm),
    fist: isFist(lm),
    vibrato: pinchAmount(lm, cal),
    reverb: spreadAmount(lm, cal),
  };
}

export function assignHands(list, swap) {
  let right = null;
  let left = null;
  const hands = list || [];
  for (let i = 0; i < hands.length; i++) {
    const label = (hands[i].label || '').toLowerCase();
    const landmarks = hands[i].landmarks;
    if (label !== 'left' && label !== 'right') {
      if (!right) right = landmarks;
      else left = landmarks;
      continue;
    }
    const isRight = swap ? label === 'left' : label === 'right';
    if (isRight) right = landmarks;
    else left = landmarks;
  }
  return { right, left };
}

export function poseFromHands(input, cal, settings) {
  const c = sanitizeCalibration(cal);
  const s = settings || {};
  const snap = !!s.snap;
  const scale = SCALES[s.scale] || SCALES.major;
  const root = s.root | 0;
  const low = Number.isFinite(+s.low) ? +s.low : PITCH_LOW;
  const high = Number.isFinite(+s.high) ? +s.high : PITCH_HIGH;
  const src = input || {};
  const pose = {
    x: 0.5,
    y: 1,
    span: null,
    pinch: null,
    spread: null,
    pitch01: 0,
    vol01: 0,
    filter01: 0.45,
    hz: midiToHz(low),
    midi: low,
    note: noteName(low, false),
    volume: 0,
    cutoff: 800,
    vibrato: clamp(src.mouse && src.mouse.vibrato || 0, 0, 1),
    reverb: clamp(src.mouse && src.mouse.reverb || 0, 0, 1),
    muted: false,
    hasRight: false,
    hasLeft: false,
    fist: false,
  };
  if (src.right && src.right.length >= 21) {
    const center = palmCenter(src.right);
    const span = palmSpan(src.right);
    pose.hasRight = true;
    pose.x = center.x;
    pose.y = center.y;
    pose.span = span;
    pose.pitch01 = clamp((center.x - c.x0) / (c.x1 - c.x0 || 1), 0, 1);
    pose.vol01 = clamp((c.y0 - center.y) / (c.y0 - c.y1 || 1), 0, 1);
    pose.filter01 = clamp((span - c.spanFar) / (c.spanNear - c.spanFar || 1), 0, 1);
    if (isFist(src.right)) pose.fist = true;
  } else if (src.mouse) {
    const m = src.mouse;
    pose.x = clamp(m.x == null ? 0.5 : m.x, 0, 1);
    pose.y = clamp(m.y == null ? 1 : m.y, 0, 1);
    pose.pitch01 = clamp((pose.x - c.x0) / (c.x1 - c.x0 || 1), 0, 1);
    pose.vol01 = clamp((c.y0 - pose.y) / (c.y0 - c.y1 || 1), 0, 1);
    pose.filter01 = clamp(m.filter == null ? 0.55 : m.filter, 0, 1);
    if (m.mute) pose.fist = true;
  }
  if (src.left && src.left.length >= 21) {
    pose.hasLeft = true;
    pose.pinch = pinchNorm(src.left);
    pose.spread = spreadNorm(src.left);
    pose.vibrato = pinchAmount(src.left, c);
    pose.reverb = spreadAmount(src.left, c);
    if (isFist(src.left)) pose.fist = true;
  }
  pose.muted = pose.fist;
  const midiCont = low + pose.pitch01 * (high - low);
  const midi = snap ? snapMidi(midiCont, root, scale) : midiCont;
  pose.midi = midi;
  pose.hz = midiToHz(midi);
  pose.note = noteName(midi, !snap);
  pose.volume = pose.muted ? 0 : Math.pow(clamp(pose.vol01, 0, 1), 1.35);
  const filter01 = clamp(pose.filter01, 0, 1);
  pose.cutoff = 180 * Math.pow(7600 / 180, filter01);
  return pose;
}

export function createOneEuro(options) {
  const o = options || {};
  let minCutoff = o.minCutoff == null ? 1 : o.minCutoff;
  let beta = o.beta == null ? 0 : o.beta;
  let dCutoff = o.dCutoff == null ? 1 : o.dCutoff;
  let xPrev = null;
  let dxPrev = 0;
  let tPrev = null;
  function alpha(cutoff, dt) {
    const tau = 1 / (2 * Math.PI * Math.max(1e-3, cutoff));
    return 1 / (1 + tau / dt);
  }
  return {
    setParams(p) {
      if (p.minCutoff != null) minCutoff = p.minCutoff;
      if (p.beta != null) beta = p.beta;
      if (p.dCutoff != null) dCutoff = p.dCutoff;
    },
    reset() { xPrev = null; dxPrev = 0; tPrev = null; },
    filter(x, t) {
      if (xPrev == null || tPrev == null) {
        xPrev = x; tPrev = t; dxPrev = 0; return x;
      }
      const useT = t <= tPrev ? tPrev + 1e-3 : t;
      const dt = Math.max(1e-3, useT - tPrev);
      const dx = (x - xPrev) / dt;
      const aD = alpha(dCutoff, dt);
      const dxHat = aD * dx + (1 - aD) * dxPrev;
      const cutoff = minCutoff + beta * Math.abs(dxHat);
      const a = alpha(cutoff, dt);
      const xHat = a * x + (1 - a) * xPrev;
      xPrev = xHat; dxPrev = dxHat; tPrev = useT;
      return xHat;
    },
  };
}

export function smoothParams(amount) {
  const t = clamp(amount == null ? 0.45 : amount, 0, 1);
  return {
    minCutoff: 0.3 * Math.pow(40, t),
    beta: 0.002 * Math.pow(350, t),
  };
}

export const SIZES = ['s', 'm', 'l', 'xl'];
