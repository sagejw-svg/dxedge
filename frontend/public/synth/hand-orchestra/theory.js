// Hand Orchestra music and gesture maths. No audio, no camera, no network.
// A fingertip is a voice. The play hand (usually the right) raises a finger to
// sound that chord tone. The chord hand (usually the left) counts fingers to
// pick a diatonic degree from I through vii. Hand height picks the octave.

export const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];

// MediaPipe hand landmark indexes.
export const JOINT = {
  thumb: { mcp: 2, pip: 3, tip: 4 },
  index: { mcp: 5, pip: 6, tip: 8 },
  middle: { mcp: 9, pip: 10, tip: 12 },
  ring: { mcp: 13, pip: 14, tip: 16 },
  pinky: { mcp: 17, pip: 18, tip: 20 },
};

// Play-hand voices. The thumb is the root an octave under the others.
export const VOICE = {
  thumb: { tone: 0, bass: true, label: 'bass' },
  index: { tone: 0, bass: false, label: 'root' },
  middle: { tone: 1, bass: false, label: '3rd' },
  ring: { tone: 2, bass: false, label: '5th' },
  pinky: { tone: 3, bass: false, label: '7th' },
};

export const DEGREES = [
  { roman: 'I', symbol: 'maj7', offsets: [0, 4, 7, 11] },
  { roman: 'ii', symbol: 'm7', offsets: [0, 3, 7, 10] },
  { roman: 'iii', symbol: 'm7', offsets: [0, 3, 7, 10] },
  { roman: 'IV', symbol: 'maj7', offsets: [0, 4, 7, 11] },
  { roman: 'V', symbol: '7', offsets: [0, 4, 7, 10] },
  { roman: 'vi', symbol: 'm7', offsets: [0, 3, 7, 10] },
  { roman: 'vii', symbol: 'dim', offsets: [0, 3, 6, 10] },
];

// Semitones above the key's tonic for each degree.
export const DEGREE_ROOT = [0, 2, 4, 5, 7, 9, 11];

export const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export const OCTAVE_MIN = 2;
export const OCTAVE_MAX = 6;

export const DEFAULT_CC = { pinch: 1, height: 11, depth: 74, tilt: 16 };

// Knobs the four gestures can drive. Ranges match the rack's own clamps.
export const RACK_TARGETS = [
  {
    id: 'filament', name: 'Filament',
    knobs: [
      { id: 'filt.cutoff', label: 'Filter cutoff', min: 20, max: 20000, curve: 'log' },
      { id: 'filt.res', label: 'Resonance', min: 0, max: 1 },
      { id: 'voice.level', label: 'Level', min: 0, max: 1 },
      { id: 'osc1.pw', label: 'Pulse width', min: 0.05, max: 0.95 },
      { id: 'lfo1.rate', label: 'LFO rate', min: 0.02, max: 30, curve: 'log' },
      { id: 'envA.a', label: 'Attack', min: 0.001, max: 4, curve: 'log' },
      { id: 'stereo.spread', label: 'Spread', min: 0, max: 1 },
      { id: 'out.drive', label: 'Output drive', min: 0, max: 10 },
    ],
    map: { pinch: 'filt.cutoff', height: 'filt.res', depth: 'voice.level', tilt: 'osc1.pw' },
  },
  {
    id: 'cathode', name: 'Cathode',
    knobs: [
      { id: 'lpf.cutoff', label: 'Low-pass cutoff', min: 30, max: 18000, curve: 'log' },
      { id: 'lpf.peak', label: 'Low-pass peak', min: 0, max: 1 },
      { id: 'vca.level', label: 'VCA level', min: 0, max: 1 },
      { id: 'vco1.level', label: 'VCO 1 level', min: 0, max: 1 },
      { id: 'vco1.pw', label: 'Pulse width', min: 0.05, max: 0.95 },
      { id: 'mg.rate', label: 'MG rate', min: 0.05, max: 30, curve: 'log' },
      { id: 'hpf.cutoff', label: 'High-pass cutoff', min: 20, max: 12000, curve: 'log' },
    ],
    map: { pinch: 'lpf.cutoff', height: 'lpf.peak', depth: 'vca.level', tilt: 'vco1.pw' },
  },
  {
    id: 'thyratron', name: 'Thyratron',
    knobs: [
      { id: 'filt.cutoff', label: 'Ladder cutoff', min: 20, max: 16000, curve: 'log' },
      { id: 'filt.res', label: 'Ladder resonance', min: 0, max: 1 },
      { id: 'level', label: 'Level', min: 0, max: 1 },
      { id: 'filt.drive', label: 'Ladder drive', min: 0, max: 1 },
      { id: 'glide', label: 'Glide', min: 0, max: 2 },
      { id: 'osc1.level', label: 'Osc 1 level', min: 0, max: 1 },
    ],
    map: { pinch: 'filt.cutoff', height: 'filt.res', depth: 'level', tilt: 'filt.drive' },
  },
  {
    id: 'gleam', name: 'Gleam',
    knobs: [
      { id: 'color', label: 'Color', min: 0, max: 1 },
      { id: 'space', label: 'Space', min: 0, max: 1 },
      { id: 'reverb', label: 'Reverb', min: 0, max: 1 },
      { id: 'level', label: 'Level', min: 0, max: 1 },
      { id: 'glide', label: 'Glide', min: 0, max: 1 },
    ],
    map: { pinch: 'color', height: 'space', depth: 'level', tilt: 'reverb' },
  },
  {
    id: 'additron', name: 'Additron',
    knobs: [
      { id: 'morph', label: 'Morph', min: 0, max: 1 },
      { id: 'level', label: 'Level', min: 0, max: 1 },
      { id: 'tilt', label: 'Tilt', min: 0, max: 1 },
      { id: 'spread', label: 'Spread', min: 0, max: 1 },
      { id: 'drive', label: 'Drive', min: 0, max: 1 },
      { id: 'vib', label: 'Vibrato', min: 0, max: 1 },
    ],
    map: { pinch: 'morph', height: 'tilt', depth: 'level', tilt: 'spread' },
  },
  {
    id: 'lattice', name: 'Lattice',
    knobs: [
      { id: 'level', label: 'Level', min: 0, max: 1 },
      { id: 'warp', label: 'Warp', min: 0, max: 1 },
      { id: 'cutoff', label: 'Cutoff', min: 40, max: 16000, curve: 'log' },
    ],
    map: { pinch: 'cutoff', height: 'warp', depth: 'level', tilt: 'warp' },
  },
  {
    id: 'mote', name: 'Mote',
    knobs: [
      { id: 'level', label: 'Level', min: 0, max: 1 },
      { id: 'grain.size', label: 'Grain size', min: 20, max: 800, curve: 'log' },
      { id: 'grain.position', label: 'Position', min: 0, max: 1 },
    ],
    map: { pinch: 'grain.position', height: 'grain.size', depth: 'level', tilt: 'grain.position' },
  },
  {
    id: 'rhumbatron', name: 'Rhumbatron',
    knobs: [
      { id: 'level', label: 'Level', min: 0, max: 1 },
      { id: 'strike', label: 'Strike', min: 0, max: 1 },
      { id: 'damp', label: 'Damping', min: 0, max: 1 },
    ],
    map: { pinch: 'strike', height: 'damp', depth: 'level', tilt: 'strike' },
  },
  {
    id: 'resnatron', name: 'Resnatron',
    knobs: [
      { id: 'level', label: 'Level', min: 0, max: 1 },
      { id: 'vcf.cutoff', label: 'Filter cutoff', min: 30, max: 12000, curve: 'log' },
      { id: 'vcf.res', label: 'Resonance', min: 0, max: 1 },
    ],
    map: { pinch: 'vcf.cutoff', height: 'vcf.res', depth: 'level', tilt: 'vcf.res' },
  },
];

export const AXES = ['pinch', 'height', 'depth', 'tilt'];

export function clamp(n, a, b) {
  if (!isFinite(n)) return a;
  return Math.min(b, Math.max(a, n));
}

export function clamp01(n) { return clamp(n, 0, 1); }

export function targetById(id) {
  return RACK_TARGETS.find(t => t.id === id) || null;
}

export function knobById(targetId, knobId) {
  const t = targetById(targetId);
  if (!t) return null;
  return t.knobs.find(k => k.id === knobId) || null;
}

export function emptyExtended() {
  return { thumb: false, index: false, middle: false, ring: false, pinky: false };
}

export function longCount(ext) {
  return ['index', 'middle', 'ring', 'pinky'].reduce((n, id) => n + (ext && ext[id] ? 1 : 0), 0);
}

// Count the four long fingers. A tucked thumb is I–IV (one through four).
// The thumb out moves to the upper degrees: thumb+1 is V, +2 is vi, +3 is vii.
// An open hand (thumb and all four) is V, the chord that is easy to hold.
// A fist (nothing up) returns null so the last chord stays.
export function degreeFromFingers(ext) {
  const longs = longCount(ext);
  const thumb = !!(ext && ext.thumb);
  if (!thumb && longs === 0) return null;
  if (!thumb) {
    if (longs >= 1 && longs <= 4) return longs - 1; // I ii iii IV
    return null;
  }
  if (longs <= 1) return 4; // V
  if (longs === 2) return 5; // vi
  if (longs === 3) return 6; // vii
  return 4; // open hand: V
}

export function degreeInfo(index) {
  const i = clamp(index | 0, 0, DEGREES.length - 1);
  return DEGREES[i];
}

export function chordSymbol(keyRoot, degreeIndex) {
  const d = degreeInfo(degreeIndex);
  const pc = ((keyRoot | 0) + DEGREE_ROOT[clamp(degreeIndex | 0, 0, 6)]) % 12;
  return NOTE_NAMES[pc] + d.symbol;
}

export function noteName(midi) {
  const n = clamp(Math.round(midi), 0, 127);
  const name = NOTE_NAMES[n % 12];
  const oct = Math.floor(n / 12) - 1;
  return name + oct;
}

// MIDI note for one chord tone. Octave is the scientific octave of the root
// (4 is the octave that contains middle C). A bass voice sits one octave under.
export function voiceNote(keyRoot, degreeIndex, toneIndex, octave, bass) {
  const deg = clamp(degreeIndex | 0, 0, 6);
  const tone = clamp(toneIndex | 0, 0, 3);
  const rootPc = ((keyRoot | 0) + DEGREE_ROOT[deg]) % 12;
  const base = (clamp(octave | 0, 0, 8) + 1) * 12 + rootPc + DEGREES[deg].offsets[tone];
  return clamp(base - (bass ? 12 : 0), 0, 127);
}

export function voicesFor(ext, keyRoot, degreeIndex, octave) {
  const out = [];
  FINGERS.forEach(id => {
    if (!ext || !ext[id]) return;
    const v = VOICE[id];
    const note = voiceNote(keyRoot, degreeIndex, v.tone, octave, v.bass);
    out.push({ finger: id, note, name: noteName(note), label: v.label, on: true });
  });
  return out;
}

export function octaveZone(height01, octMin = OCTAVE_MIN, octMax = OCTAVE_MAX) {
  const n = octMax - octMin + 1;
  const i = Math.min(n - 1, Math.max(0, Math.floor(clamp01(height01) * n)));
  return octMin + i;
}

// Stay in the current octave until the hand is a little way into the next one.
export function decideOctave(prev, height01, octMin = OCTAVE_MIN, octMax = OCTAVE_MAX, hysteresis = 0.03) {
  const next = octaveZone(height01, octMin, octMax);
  if (prev == null || next === prev) return next;
  const n = octMax - octMin + 1;
  const boundary = (Math.min(prev, next) - octMin + 1) / n;
  const h = clamp(hysteresis, 0, 0.2);
  if (next > prev && height01 < boundary + h) return prev;
  if (next < prev && height01 > boundary - h) return prev;
  return next;
}

export function hypot2(a, b) {
  return Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));
}

export function jointRatio(lm, tipI, pipI) {
  if (!lm || !lm[tipI] || !lm[pipI] || !lm[0]) return 0;
  const dTip = hypot2(lm[tipI], lm[0]);
  const dPip = hypot2(lm[pipI], lm[0]);
  if (dPip < 1e-4) return 0;
  return dTip / dPip;
}

// A finger is up when its tip is farther from the wrist than its middle joint.
export function fingerExtended(lm, finger, margin = 0.08) {
  const j = JOINT[finger];
  if (!j) return false;
  return jointRatio(lm, j.tip, j.pip) > 1 + margin;
}

// Once a finger is up it stays up until it curls past a lower threshold, so a
// hand that hovers on the line does not chatter the note.
export function decideUp(wasUp, ratio, margin = 0.08) {
  const on = 1 + margin;
  const off = 1 + margin * 0.25;
  if (wasUp) return ratio > off;
  return ratio > on;
}

export function analyzeHand(lm) {
  const extended = emptyExtended();
  const ratios = {};
  FINGERS.forEach(id => {
    const j = JOINT[id];
    ratios[id] = jointRatio(lm, j.tip, j.pip);
    extended[id] = ratios[id] > 1.08;
  });
  const wrist = lm && lm[0] ? lm[0] : { x: 0.5, y: 0.8, z: 0 };
  const mid = lm && lm[9] ? lm[9] : wrist;
  const indexM = lm && lm[5] ? lm[5] : wrist;
  const pinkyM = lm && lm[17] ? lm[17] : wrist;
  const palm = hypot2(mid, wrist);
  const pinchRatio = palm > 1e-4 && lm && lm[4] && lm[8] ? hypot2(lm[4], lm[8]) / palm : 1;
  const tilt = Math.atan2((pinkyM.y || 0) - (indexM.y || 0), (pinkyM.x || 0) - (indexM.x || 0));
  const tips = FINGERS.map(id => {
    const p = lm && lm[JOINT[id].tip] ? lm[JOINT[id].tip] : wrist;
    return { finger: id, x: p.x, y: p.y, on: extended[id] };
  });
  return {
    extended,
    ratios,
    height: 1 - (wrist.y || 0),
    palm,
    pinchRatio,
    tilt,
    tips,
    wrist: { x: wrist.x || 0, y: wrist.y || 0 },
  };
}

// Build 21 landmarks that analyzeHand reads back. Used by the mouse hand and
// by tests. `height`, `depth`, `pinch` and `tilt` are 0..1 pose controls.
// `tilt` 0.5 is a flat palm. `pinch` 1 brings the thumb tip onto the index tip.
export function landmarksFromPose(pose) {
  const p = pose || {};
  const ext = Object.assign(emptyExtended(), p.extended || {});
  const height = p.height == null ? 0.5 : clamp01(p.height);
  const depth = p.depth == null ? 0.45 : clamp01(p.depth);
  const pinch = p.pinch == null ? 0 : clamp01(p.pinch);
  const tilt = p.tilt == null ? 0.5 : clamp01(p.tilt);
  const scale = 0.18 + depth * 0.22;
  const wrist = { x: 0.5, y: 0.82 - height * 0.5, z: 0 };
  const lm = Array.from({ length: 21 }, () => ({ x: wrist.x, y: wrist.y, z: 0 }));
  lm[0] = { x: wrist.x, y: wrist.y, z: 0 };
  const placed = new Set([0]);
  const ang = (tilt - 0.5) * 1.6;
  const rot = (x, y) => {
    const dx = x - wrist.x;
    const dy = y - wrist.y;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    return { x: wrist.x + dx * c - dy * s, y: wrist.y + dx * s + dy * c, z: 0 };
  };
  const specs = [
    { id: 'thumb', mcp: 2, pip: 3, tip: 4, x: -0.62 },
    { id: 'index', mcp: 5, pip: 6, tip: 8, x: -0.24 },
    { id: 'middle', mcp: 9, pip: 10, tip: 12, x: 0.02 },
    { id: 'ring', mcp: 13, pip: 14, tip: 16, x: 0.26 },
    { id: 'pinky', mcp: 17, pip: 18, tip: 20, x: 0.48 },
  ];
  specs.forEach(f => {
    const mx = wrist.x + f.x * scale;
    const my = wrist.y - scale * 0.9;
    lm[f.mcp] = rot(mx, my);
    placed.add(f.mcp);
    if (ext[f.id]) {
      lm[f.pip] = rot(mx, my - scale * 0.7);
      lm[f.tip] = rot(mx, my - scale * 1.4);
    } else {
      lm[f.pip] = rot(mx, my - scale * 0.28);
      lm[f.tip] = rot(mx * 0.35 + wrist.x * 0.65, wrist.y - scale * 0.15);
    }
    placed.add(f.pip);
    placed.add(f.tip);
  });
  if (pinch > 0) {
    const it = lm[8];
    const tt = lm[4];
    lm[4] = { x: tt.x + (it.x - tt.x) * pinch, y: tt.y + (it.y - tt.y) * pinch, z: 0 };
  }
  const mids = [[1, 0, 2], [6, 5, 8], [7, 5, 6], [10, 9, 12], [11, 9, 10], [14, 13, 16], [15, 13, 14], [18, 17, 20], [19, 17, 18]];
  mids.forEach(([i, a, b]) => {
    if (placed.has(i)) return;
    lm[i] = { x: (lm[a].x + lm[b].x) / 2, y: (lm[a].y + lm[b].y) / 2, z: 0 };
  });
  return lm;
}

export function pinchAmount(ratio) {
  const open = 1.15;
  const closed = 0.22;
  return clamp01((open - ratio) / (open - closed));
}

export function tiltAmount(radians) {
  return clamp01((radians / 1.2 + 1) / 2);
}

export function applyCal(raw, cal) {
  if (!cal || !(cal.high > cal.low)) return clamp01(raw);
  return clamp01((raw - cal.low) / (cal.high - cal.low));
}

export function spanCal(low, high, minSpan) {
  const a = Math.min(low, high);
  const b = Math.max(low, high);
  const span = Math.max(minSpan || 0.04, b - a);
  return { low: a, high: a + span };
}

export const DEFAULT_CAL = {
  height: { low: 0.15, high: 0.78 },
  depth: { low: 0.1, high: 0.38 },
};

export function createSmoother(alpha) {
  let v = null;
  let a = clamp(alpha == null ? 0.35 : alpha, 0.01, 1);
  return {
    setAlpha(n) { a = clamp(n, 0.01, 1); },
    reset() { v = null; },
    push(x) {
      if (!isFinite(x)) return v == null ? 0 : v;
      if (v == null) { v = x; return v; }
      v = v + (x - v) * a;
      return v;
    },
    value() { return v; },
  };
}

export function createChordHold(frames) {
  let current = 0;
  let pending = null;
  let count = 0;
  const need = Math.max(1, frames || 1);
  return {
    push(degree, immediate) {
      if (degree == null) { pending = null; count = 0; return current; }
      const d = clamp(degree | 0, 0, 6);
      if (immediate || need <= 1 || d === current) {
        current = d; pending = null; count = 0; return current;
      }
      if (d === pending) count += 1;
      else { pending = d; count = 1; }
      if (count >= need) { current = d; pending = null; count = 0; }
      return current;
    },
    value() { return current; },
    reset(v) { current = clamp(v == null ? 0 : v, 0, 6); pending = null; count = 0; },
  };
}

function smoothAxis(smoother, value, direct) {
  if (direct) { smoother.reset(); return smoother.push(value); }
  return smoother.push(value);
}

export function createSession(opts) {
  const o = opts || {};
  let keyRoot = clamp(o.key == null ? 0 : o.key, 0, 11) | 0;
  let margin = o.margin == null ? 0.08 : o.margin;
  let octave = null;
  const playUp = emptyExtended();
  const chordUp = emptyExtended();
  const chord = createChordHold(o.chordFrames == null ? 4 : o.chordFrames);
  const axes = {
    pinch: createSmoother(o.smooth == null ? 0.35 : o.smooth),
    height: createSmoother(o.smooth == null ? 0.35 : o.smooth),
    depth: createSmoother(o.smooth == null ? 0.35 : o.smooth),
    tilt: createSmoother(o.smooth == null ? 0.35 : o.smooth),
  };
  let cal = {
    height: Object.assign({}, DEFAULT_CAL.height, o.cal && o.cal.height),
    depth: Object.assign({}, DEFAULT_CAL.depth, o.cal && o.cal.depth),
  };
  let last = null;

  function setAlpha(a) {
    AXES.forEach(id => axes[id].setAlpha(a));
  }

  function consider(ext, ratios, into, useRatio) {
    const next = emptyExtended();
    FINGERS.forEach(id => {
      if (useRatio && ratios) next[id] = decideUp(!!into[id], ratios[id], margin);
      else next[id] = !!(ext && ext[id]);
      into[id] = next[id];
    });
    return next;
  }

  function push(frame) {
    const f = frame || {};
    const direct = !!f.direct;
    let playExt = emptyExtended();
    let chordExt = emptyExtended();
    let raw = { pinch: 0, height: 0.5, depth: 0.45, tilt: 0.5 };
    let draw = { play: null, chord: null };

    if (f.playLandmarks) {
      const a = analyzeHand(f.playLandmarks);
      playExt = consider(a.extended, a.ratios, playUp, true);
      raw = {
        pinch: pinchAmount(a.pinchRatio),
        height: applyCal(a.height, cal.height),
        depth: applyCal(a.palm, cal.depth),
        tilt: tiltAmount(a.tilt),
      };
      draw.play = f.playLandmarks;
    } else if (f.play) {
      playExt = consider(f.play.extended, null, playUp, false);
      raw = {
        pinch: f.play.pinch == null ? 0 : clamp01(f.play.pinch),
        height: f.play.height == null ? 0.5 : clamp01(f.play.height),
        depth: f.play.depth == null ? 0.45 : clamp01(f.play.depth),
        tilt: f.play.tilt == null ? 0.5 : clamp01(f.play.tilt),
      };
      draw.play = landmarksFromPose({
        extended: playExt, height: raw.height, depth: raw.depth, pinch: raw.pinch, tilt: raw.tilt,
      }).map(p => ({ x: p.x * 0.42, y: p.y, z: p.z || 0 }));
    } else {
      FINGERS.forEach(id => { playUp[id] = false; });
    }

    if (f.chordLandmarks) {
      const a = analyzeHand(f.chordLandmarks);
      chordExt = consider(a.extended, a.ratios, chordUp, true);
      draw.chord = f.chordLandmarks;
    } else if (f.chord) {
      chordExt = consider(f.chord.extended, null, chordUp, false);
      draw.chord = landmarksFromPose({ extended: chordExt, height: 0.45, depth: 0.4, pinch: 0, tilt: 0.5 })
        .map(p => ({ x: 0.58 + p.x * 0.4, y: p.y, z: p.z || 0 }));
    }

    const degree = chord.push(degreeFromFingers(chordExt), direct || !!f.immediate);
    const height = smoothAxis(axes.height, raw.height, direct);
    const pinch = smoothAxis(axes.pinch, raw.pinch, direct);
    const depth = smoothAxis(axes.depth, raw.depth, direct);
    const tilt = smoothAxis(axes.tilt, raw.tilt, direct);
    octave = decideOctave(octave, height);
    const voices = voicesFor(playExt, keyRoot, degree, octave);
    const info = degreeInfo(degree);
    last = {
      degree,
      roman: info.roman,
      symbol: chordSymbol(keyRoot, degree),
      quality: info.symbol,
      octave,
      key: keyRoot,
      keyName: NOTE_NAMES[keyRoot],
      voices,
      notes: voices.map(v => v.note),
      play: playExt,
      chordFingers: chordExt,
      axes: { pinch, height, depth, tilt },
      draw,
    };
    return last;
  }

  return {
    push,
    state() { return last; },
    setKey(k) { keyRoot = clamp(k | 0, 0, 11); },
    setMargin(m) { margin = clamp(m, 0.02, 0.4); },
    setAlpha,
    setCal(next) {
      if (!next) return cal;
      if (next.height) cal.height = spanCal(next.height.low, next.height.high, 0.05);
      if (next.depth) cal.depth = spanCal(next.depth.low, next.depth.high, 0.03);
      return cal;
    },
    cal() { return { height: Object.assign({}, cal.height), depth: Object.assign({}, cal.depth) }; },
    resetChord(v) { chord.reset(v); octave = null; },
  };
}

export function diffNotes(prev, next) {
  const a = new Set(prev || []);
  const b = new Set(next || []);
  return {
    on: [...b].filter(n => !a.has(n)),
    off: [...a].filter(n => !b.has(n)),
  };
}

export function noteOnBytes(channel, note, vel) {
  const ch = clamp((channel || 1) - 1, 0, 15) | 0;
  return [0x90 | ch, clamp(Math.round(note), 0, 127), clamp(Math.round(clamp01(vel == null ? 0.85 : vel) * 127), 1, 127)];
}

export function noteOffBytes(channel, note) {
  const ch = clamp((channel || 1) - 1, 0, 15) | 0;
  return [0x80 | ch, clamp(Math.round(note), 0, 127), 0];
}

export function ccBytes(channel, cc, value01) {
  const ch = clamp((channel || 1) - 1, 0, 15) | 0;
  return [0xB0 | ch, clamp(cc | 0, 0, 127), clamp(Math.round(clamp01(value01) * 127), 0, 127)];
}

export function mapKnob(knob, value01) {
  if (!knob) return null;
  const t = clamp01(value01);
  const min = Number(knob.min);
  const max = Number(knob.max);
  if (!(max > min)) return min;
  if (knob.curve === 'log' && min > 0 && max > 0) {
    const lo = Math.log(min);
    const hi = Math.log(max);
    return Math.exp(lo + (hi - lo) * t);
  }
  return min + (max - min) * t;
}

export function knobPlan(targetId, axes, assign) {
  const target = targetById(targetId);
  if (!target) return [];
  const map = Object.assign({}, target.map, assign || {});
  return AXES.map(axis => {
    const knob = knobById(targetId, map[axis]);
    if (!knob || !axes) return null;
    return { axis, id: knob.id, label: knob.label, value: mapKnob(knob, axes[axis]) };
  }).filter(Boolean);
}

export function setPath(obj, path, value) {
  const ks = String(path || '').split('.').filter(Boolean);
  if (!ks.length || !obj) return obj;
  let x = obj;
  for (let i = 0; i < ks.length - 1; i++) {
    if (x[ks[i]] == null || typeof x[ks[i]] !== 'object') x[ks[i]] = {};
    x = x[ks[i]];
  }
  x[ks[ks.length - 1]] = value;
  return obj;
}

export function midiPlan(channel, ccMap, state, prevNotes) {
  const s = state || { notes: [], axes: {} };
  const diff = diffNotes(prevNotes, s.notes);
  const notes = []
    .concat(diff.off.map(n => noteOffBytes(channel, n)))
    .concat(diff.on.map(n => noteOnBytes(channel, n, 0.85)));
  const cc = AXES.map(axis => {
    const num = ccMap && ccMap[axis] != null ? ccMap[axis] : DEFAULT_CC[axis];
    return { axis, cc: num | 0, bytes: ccBytes(channel, num, s.axes ? s.axes[axis] : 0) };
  });
  return { notes, cc, diff };
}
