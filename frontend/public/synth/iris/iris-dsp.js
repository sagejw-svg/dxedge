// Iris voice. Original.
//
// Four ways of reading one picture, sharing one reverb and one level:
//   scanline  a bank of sines, one per log-frequency row, amplitude from
//             the brightness of that row in the column under the line
//   color     three notes from the hue, a low-pass opened by saturation,
//             loudness from overall brightness
//   motion    one sine per grid cell, following the frame difference,
//             plus a short noise hit when a cell wakes up
//   edges     filtered noise and a handful of short grains, driven by
//             edge density and local contrast
//
// The reverb is the published Schroeder layout (parallel damped combs,
// then a pair of allpasses) after the description in Julius O. Smith's
// writings. The delay times below are this instrument's, not the Freeverb
// set and not the lengths used by the other rack devices.

import {
  BANDS, GRID_COLS, GRID_ROWS, bandHz, cellMidi, chordOf, midiToHz, normalizeIris, snapHz,
} from './iris.js';

const TAU = Math.PI * 2;
const CELLS = GRID_COLS * GRID_ROWS;
const MODE_NAMES = ['scanline', 'color', 'motion', 'edges'];

function makeLine(sr, ms) {
  const n = Math.max(8, Math.round(sr * ms / 1000));
  return { buf: new Float32Array(n), i: 0, z: 0 };
}

function comb(line, x, feed, damp) {
  const y = line.buf[line.i];
  line.z += damp * (y - line.z);
  if (line.z < 1e-12 && line.z > -1e-12) line.z = 0;
  line.buf[line.i] = x + line.z * feed;
  line.i++;
  if (line.i >= line.buf.length) line.i = 0;
  return y;
}

function allpass(line, x) {
  const y = line.buf[line.i];
  const out = y - 0.5 * x;
  line.buf[line.i] = x + 0.5 * y;
  line.i++;
  if (line.i >= line.buf.length) line.i = 0;
  return out;
}

function tuneKey(p) {
  return [p.scale, p.root, p.snap ? 1 : 0, p.fLo, p.fHi].join(':');
}

function noise(eng) {
  eng.ns = (Math.imul(eng.ns, 1664525) + 1013904223) >>> 0;
  return eng.ns / 2147483648 - 1;
}

export function createIrisEngine(sr) {
  return {
    sr: sr || 44100,
    P: normalizeIris({}),
    tuneKey: '',
    freq: new Float32Array(BANDS),
    amp: new Float32Array(BANDS),
    phase: new Float64Array(BANDS),
    cellHz: new Float32Array(CELLS),
    cellGain: new Float32Array(CELLS),
    cellTarget: new Float32Array(CELLS),
    cellPhase: new Float64Array(CELLS),
    motion: new Float32Array(CELLS),
    hue: 0,
    sat: 0,
    val: 0,
    edge: 0,
    texture: 0,
    satSm: 0,
    valSm: 0,
    edgeSm: 0,
    texSm: 0,
    have: false,
    frame: 0,
    ns: 0x1a2b3c4d,
    gates: { scanline: 0, color: 0, motion: 0, edges: 0 },
    chordPhase: new Float64Array(9),
    low: 0,
    band: 0,
    grainPhase: 0,
    grainEnv: 0,
    grainHz: 220,
    grainOsc: 0,
    noiseLp: 0,
    percEnv: 0,
    percPan: 0,
    combsL: [29.3, 37.1, 43.7, 53.9].map(ms => makeLine(sr || 44100, ms)),
    combsR: [31.7, 39.4, 46.5, 58.3].map(ms => makeLine(sr || 44100, ms)),
    apL: [7.3, 12.4].map(ms => makeLine(sr || 44100, ms)),
    apR: [8.8, 14.1].map(ms => makeLine(sr || 44100, ms)),
  };
}

function retune(eng) {
  const p = eng.P;
  for (let i = 0; i < BANDS; i++) {
    const raw = bandHz(i, BANDS, p.fLo, p.fHi);
    eng.freq[i] = snapHz(raw, p.scale, p.root, p.snap);
  }
  for (let gy = 0; gy < GRID_ROWS; gy++) {
    for (let gx = 0; gx < GRID_COLS; gx++) {
      const m = cellMidi(gx, gy, GRID_COLS, GRID_ROWS, p.scale, p.root, p.snap);
      eng.cellHz[gy * GRID_COLS + gx] = midiToHz(m);
    }
  }
  eng.tuneKey = tuneKey(p);
}

function applyVision(eng, msg) {
  const bands = msg.bands;
  if (bands && bands.length) {
    const n = Math.min(BANDS, bands.length);
    for (let i = 0; i < n; i++) {
      const v = +bands[i] || 0;
      eng.ampTarget = eng.ampTarget || new Float32Array(BANDS);
      eng.ampTarget[i] = v < 0.035 ? 0 : v;
    }
  }
  if (!eng.ampTarget) eng.ampTarget = new Float32Array(BANDS);
  if (msg.hue != null) eng.hue = +msg.hue || 0;
  if (msg.sat != null) eng.sat = Math.max(0, Math.min(1, +msg.sat || 0));
  if (msg.val != null) eng.val = Math.max(0, Math.min(1, +msg.val || 0));
  if (msg.edge != null) eng.edge = Math.max(0, Math.min(1, +msg.edge || 0));
  if (msg.texture != null) eng.texture = Math.max(0, Math.min(1, +msg.texture || 0));
  const motion = msg.motion;
  if (motion && motion.length) {
    const n = Math.min(CELLS, motion.length);
    for (let i = 0; i < n; i++) {
      const e = Math.max(0, Math.min(1, +motion[i] || 0));
      const rise = e - eng.motion[i];
      eng.motion[i] = e;
      eng.cellTarget[i] = e < 0.08 ? 0 : e;
      if (rise > 0.22 && e > 0.2) {
        eng.percEnv = Math.min(1, eng.percEnv + 0.85 * e);
        const gx = i % GRID_COLS;
        eng.percPan = GRID_COLS <= 1 ? 0 : (gx / (GRID_COLS - 1)) * 2 - 1;
      }
    }
  }
  eng.have = true;
}

export function postIris(eng, msg) {
  if (!msg) return;
  if (msg.t === 'patch') {
    eng.P = normalizeIris(Object.assign({}, eng.P, msg.patch || {}));
    if (eng.tuneKey !== tuneKey(eng.P)) retune(eng);
    return;
  }
  if (msg.t === 'vision') applyVision(eng, msg);
  if (msg.t === 'panic') {
    eng.amp.fill(0);
    if (eng.ampTarget) eng.ampTarget.fill(0);
    eng.cellGain.fill(0);
    eng.cellTarget.fill(0);
    eng.motion.fill(0);
    eng.percEnv = 0;
    eng.val = 0;
    eng.edge = 0;
    eng.have = false;
  }
}

function svfLow(eng, x, cutoff, q) {
  const f = 2 * Math.sin(Math.PI * Math.min(eng.sr * 0.22, Math.max(40, cutoff)) / eng.sr);
  const high = x - eng.low - q * eng.band;
  eng.band += f * high;
  eng.low += f * eng.band;
  if (eng.low > 3) eng.low = 3;
  else if (eng.low < -3) eng.low = -3;
  if (eng.band > 3) eng.band = 3;
  else if (eng.band < -3) eng.band = -3;
  return eng.low;
}

function pan(x, p) {
  const a = (Math.max(-1, Math.min(1, p)) + 1) * 0.5;
  const l = Math.cos(a * Math.PI * 0.5);
  const r = Math.sin(a * Math.PI * 0.5);
  return [x * l, x * r];
}

function shape(x) {
  return x / (1 + Math.abs(x));
}

export function renderIris(eng, L, R) {
  const n = L.length;
  if (!R || R === L) R = L;
  if (!eng.tuneKey) retune(eng);
  if (!eng.ampTarget) eng.ampTarget = new Float32Array(BANDS);
  const p = eng.P;
  const sr = eng.sr;
  const kAmp = 1 - Math.exp(-1 / (0.025 * sr));
  const kSlow = 1 - Math.exp(-1 / (0.04 * sr));
  const kGate = 1 - Math.exp(-1 / (0.03 * sr));
  const kPerc = Math.exp(-1 / (0.07 * sr));
  const level = p.level;
  const want = p.mode;
  const nyquist = sr * 0.45;

  for (let i = 0; i < n; i++) {
    eng.frame++;
    for (let m = 0; m < 4; m++) {
      const name = MODE_NAMES[m];
      const target = name === want ? 1 : 0;
      eng.gates[name] += (target - eng.gates[name]) * kGate;
    }
    eng.satSm += (eng.sat - eng.satSm) * kSlow;
    eng.valSm += (eng.val - eng.valSm) * kSlow;
    eng.edgeSm += (eng.edge - eng.edgeSm) * kSlow;
    eng.texSm += (eng.texture - eng.texSm) * kSlow;

    let sL = 0, sR = 0, cL = 0, cR = 0, mL = 0, mR = 0, eL = 0, eR = 0;

    if (eng.gates.scanline > 0.0008) {
      let busL = 0;
      let busR = 0;
      for (let b = 0; b < BANDS; b++) {
        const target = eng.have ? eng.ampTarget[b] : 0;
        eng.amp[b] += (target - eng.amp[b]) * kAmp;
        const hz = eng.freq[b];
        eng.phase[b] += TAU * Math.min(hz, nyquist) / sr;
        if (eng.phase[b] > TAU * 64) eng.phase[b] -= TAU * 64;
        if (hz < 20 || hz > nyquist || eng.amp[b] < 0.0008) continue;
        const s = Math.sin(eng.phase[b]) * eng.amp[b];
        if (b & 1) { busL += s * 0.72; busR += s; }
        else { busL += s; busR += s * 0.72; }
      }
      const g = 0.55 * level * eng.gates.scanline;
      sL = shape(busL) * g;
      sR = shape(busR) * g;
    } else {
      for (let b = 0; b < BANDS; b++) eng.amp[b] += (0 - eng.amp[b]) * kAmp;
    }

    if (eng.gates.color > 0.0008) {
      const notes = chordOf(eng.hue, p.scale, p.root);
      const harm = eng.satSm;
      let bus = 0;
      for (let k = 0; k < 3; k++) {
        const f = midiToHz(notes[k]);
        for (let h = 1; h <= 3; h++) {
          const ph = k * 3 + (h - 1);
          const freq = Math.min(nyquist, f * h);
          eng.chordPhase[ph] += TAU * freq / sr;
          if (eng.chordPhase[ph] > TAU * 64) eng.chordPhase[ph] -= TAU * 64;
          const w = h === 1 ? 1 : h === 2 ? 0.45 * harm : 0.22 * harm * harm;
          bus += Math.sin(eng.chordPhase[ph]) * w;
        }
      }
      const cutoff = 900 + Math.pow(eng.satSm, 0.85) * 6400;
      const q = 1.15 - eng.satSm * 0.45;
      const filtered = svfLow(eng, bus * 0.34, cutoff, q);
      const mono = filtered * eng.valSm * level * 1.35 * eng.gates.color;
      const spread = (notes[2] ? 0.18 : 0);
      cL = mono * (1 - spread);
      cR = mono * (1 + spread);
    }

    if (eng.gates.motion > 0.0008) {
      let busL = 0, busR = 0;
      for (let c = 0; c < CELLS; c++) {
        const target = eng.have ? eng.cellTarget[c] : 0;
        eng.cellGain[c] += (target - eng.cellGain[c]) * kAmp;
        if (eng.cellGain[c] < 0.0006) continue;
        const hz = Math.min(nyquist, eng.cellHz[c]);
        eng.cellPhase[c] += TAU * hz / sr;
        if (eng.cellPhase[c] > TAU * 64) eng.cellPhase[c] -= TAU * 64;
        const gx = c % GRID_COLS;
        const panPos = GRID_COLS <= 1 ? 0 : (gx / (GRID_COLS - 1)) * 2 - 1;
        const s = Math.sin(eng.cellPhase[c]) * eng.cellGain[c] * 0.55;
        const pr = pan(s, panPos * 0.8);
        busL += pr[0];
        busR += pr[1];
      }
      eng.percEnv *= kPerc;
      if (eng.percEnv > 0.001) {
        const hit = noise(eng) * eng.percEnv * 0.55;
        const pr = pan(hit, eng.percPan);
        busL += pr[0];
        busR += pr[1];
      }
      const g = level * eng.gates.motion;
      mL = shape(busL) * g;
      mR = shape(busR) * g;
    } else {
      for (let c = 0; c < CELLS; c++) eng.cellGain[c] += (0 - eng.cellGain[c]) * kAmp;
      eng.percEnv *= kPerc;
    }

    if (eng.gates.edges > 0.0008) {
      const drive = Math.max(eng.edgeSm, eng.texSm * 0.65);
      const white = noise(eng);
      const cut = 180 + eng.texSm * 7400;
      const coeff = 1 - Math.exp(-TAU * Math.min(cut, nyquist) / sr);
      eng.noiseLp += (white - eng.noiseLp) * coeff;
      const bp = (white - eng.noiseLp) * 0.5 + eng.noiseLp * (0.25 + eng.texSm);
      eng.grainPhase += (2.5 + eng.edgeSm * 26) / sr;
      if (eng.grainPhase >= 1) {
        eng.grainPhase -= 1;
        eng.grainEnv = 1;
        const t = eng.texSm;
        const raw = bandHz(Math.floor(t * (BANDS - 1)), BANDS, p.fLo, p.fHi);
        eng.grainHz = snapHz(raw, p.scale, p.root, p.snap);
      }
      eng.grainEnv *= Math.exp(-1 / (0.045 * sr));
      eng.grainOsc += TAU * Math.min(nyquist, eng.grainHz) / sr;
      if (eng.grainOsc > TAU * 64) eng.grainOsc -= TAU * 64;
      const grain = Math.sin(eng.grainOsc) * eng.grainEnv * eng.edgeSm;
      const nse = bp * drive;
      const mono = (nse * 0.55 + grain * 0.4) * level * eng.gates.edges;
      const side = noise(eng) * drive * 0.08 * level * eng.gates.edges;
      eL = mono + side;
      eR = mono - side;
    }

    let dryL = sL + cL + mL + eL;
    let dryR = sR + cR + mR + eR;
    const wet = p.reverb;
    if (wet > 0.001) {
      const feed = 0.48 + wet * 0.28;
      const damp = 0.28 + wet * 0.25;
      const inL = dryL * 0.5;
      const inR = dryR * 0.5;
      let rl = 0, rr = 0;
      for (let k = 0; k < 4; k++) {
        rl += comb(eng.combsL[k], inL, feed, damp);
        rr += comb(eng.combsR[k], inR, feed, damp);
      }
      rl *= 0.28;
      rr *= 0.28;
      for (let k = 0; k < 2; k++) {
        rl = allpass(eng.apL[k], rl);
        rr = allpass(eng.apR[k], rr);
      }
      dryL = dryL * (1 - wet * 0.65) + rl * wet;
      dryR = dryR * (1 - wet * 0.65) + rr * wet;
    }

    if (dryL > 1) dryL = 1;
    else if (dryL < -1) dryL = -1;
    if (dryR > 1) dryR = 1;
    else if (dryR < -1) dryR = -1;
    L[i] = dryL;
    if (R !== L) R[i] = dryR;
  }
}
