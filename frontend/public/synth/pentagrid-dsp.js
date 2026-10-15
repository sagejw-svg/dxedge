// Pentagrid receiver. All of the sound is generated in this file.
//
// The dial is a frequency in kHz. A station is heard when its offset from the
// dial sits inside the bandwidth. CW, a bare carrier and a close pair become
// tones at the beat with the BFO, so tuning moves the pitch. AM audio (pips,
// chimes, digit tones, the FSK warble) keeps its own pitch and fades at the
// skirt. Speech is three formant resonators on a pulse, slid by the tuning
// error, which is the familiar off-tune single-sideband voice.
//
// No recording is read. No other project's DSP is copied.

import {
  normalizePentagrid, PENTA_BAND, morsePlan, planSpan, makeQso, ditSeconds,
} from './pentagrid.js';

const MAX_NOTES = 8;
const CHIME = [523.25, 659.25, 783.99];
const VOWELS = [
  [730, 1090, 2440],
  [390, 1990, 2550],
  [270, 840, 2290],
  [530, 1840, 2480],
];

function rnd(eng) {
  eng.seed = (Math.imul(eng.seed, 1664525) + 1013904223) >>> 0;
  return eng.seed / 4294967296;
}

function soft(x) {
  const a = x < 0 ? -x : x;
  if (a <= 0.85) return x;
  const s = x < 0 ? -1 : 1;
  return s * (0.85 + 0.14 * Math.tanh((a - 0.85) / 0.2));
}

function midiHz(n, bend) {
  return 440 * Math.pow(2, (n - 69 + (bend || 0) * 2) / 12);
}

function rebuildPlans(eng) {
  const P = eng.P;
  const key = P.text + '|' + P.wpm + '|' + P.seed;
  if (eng.planKey === key) return;
  eng.planKey = key;
  eng.userPlan = morsePlan(P.text, P.wpm, 0);
  eng.userSpan = planSpan(eng.userPlan, P.wpm);
  eng.userCursor = { i: 0, u: -1 };
  eng.cw = PENTA_BAND.map((st, i) => {
    if (st.kind !== 'cw') return null;
    const text = makeQso((P.seed + i * 17) >>> 0);
    const plan = morsePlan(text, Math.max(12, P.wpm - 2), 0);
    return { plan, span: planSpan(plan, Math.max(12, P.wpm - 2)), cursor: { i: 0, u: -1 } };
  });
}

function gateAt(cursor, plan, span, t) {
  if (!plan || !plan.length || span <= 0) return 0;
  let u = t % span;
  if (u < 0) u += span;
  if (u < cursor.u) cursor.i = 0;
  cursor.u = u;
  while (cursor.i < plan.length && plan[cursor.i].t1 <= u) cursor.i++;
  const m = plan[cursor.i];
  if (m && u >= m.t0 && u < m.t1) return 1;
  return 0;
}

function skirtOf(delta, half) {
  const x = Math.abs(delta) / Math.max(20, half);
  if (x >= 1) return 0;
  return Math.cos(x * Math.PI * 0.5);
}

function beatHz(delta, bfo, mode) {
  if (mode === 'lsb') return -delta + bfo;
  if (mode === 'am') return delta;
  return delta + bfo;
}

function digitAt(seed, i) {
  let x = (Math.imul(seed, 1000) + Math.imul(i, 17) + 3) >>> 0;
  x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
  return x % 10;
}

function figuresSample(t, seed) {
  const u = t % 8;
  if (u < 0.55) {
    let y = 0;
    for (let i = 0; i < 3; i++) {
      const start = i * 0.035;
      if (u < start) continue;
      const env = Math.exp(-(u - start) * 3.2);
      y += Math.sin(2 * Math.PI * CHIME[i] * t) * env;
    }
    return y * 0.22;
  }
  if (u < 0.75) return 0;
  const slot = 0.16;
  const idx = Math.floor((u - 0.75) / slot);
  const into = (u - 0.75) - idx * slot;
  if (into > 0.1) return 0;
  const digit = digitAt(seed, idx);
  const hz = 420 + digit * 55;
  const env = Math.sin(Math.PI * Math.min(1, into / 0.1));
  return Math.sin(2 * Math.PI * hz * t) * env * 0.34;
}

function pipSample(t) {
  const intoMin = t % 60;
  if (intoMin < 0.55) {
    let env = 1;
    if (intoMin < 0.012) env = intoMin / 0.012;
    else if (intoMin > 0.52) env = Math.max(0, (0.55 - intoMin) / 0.03);
    return Math.sin(2 * Math.PI * 1000 * t) * env * 0.42;
  }
  const into = t % 1;
  if (into < 0.04) {
    let env = 1;
    if (into < 0.004) env = into / 0.004;
    else if (into > 0.032) env = Math.max(0, (0.04 - into) / 0.008);
    return Math.sin(2 * Math.PI * 1000 * t) * env * 0.36;
  }
  return 0;
}

function rttyBit(t, seed) {
  const n = Math.floor(t * 45.45);
  const pattern = 0b10110010;
  const bit = (pattern >> (n & 7)) & 1;
  const wobble = ((Math.imul(n, 1103515245) + seed) >>> 0) & 1;
  return (n & 15) === 0 ? wobble : bit;
}

function formant(eng, sr, f0, shift, syl) {
  const st = eng.form;
  st.ph += f0 / sr;
  let exc = 0;
  if (st.ph >= 1) { st.ph -= 1; exc = 0.85; }
  exc += (rnd(eng) * 2 - 1) * 0.04;
  let y = 0;
  const gain = [0.55, 0.32, 0.18];
  for (let i = 0; i < 3; i++) {
    const o = exc + st.a1[i] * st.y1[i] + st.a2[i] * st.y2[i];
    st.y2[i] = st.y1[i];
    st.y1[i] = o;
    if (st.y1[i] > 3 || st.y1[i] < -3) { st.y1[i] *= 0.4; st.y2[i] *= 0.4; }
    y += o * gain[i];
  }
  return y * syl * 0.08;
}

function setFormant(eng, sr, shift) {
  const st = eng.form;
  const v = VOWELS[st.vowel];
  const r = 0.986;
  for (let i = 0; i < 3; i++) {
    const f = Math.max(80, Math.min(sr * 0.42, v[i] + shift));
    const w = 2 * Math.PI * f / sr;
    st.a1[i] = 2 * r * Math.cos(w);
    st.a2[i] = -(r * r);
  }
}

function noteOn(eng, n, v) {
  if (!eng.P.play) return;
  const note = n & 127;
  const vel = Math.max(0, Math.min(1, +v || 0));
  let slot = eng.notes.find(s => s.n === note);
  if (!slot) {
    if (eng.notes.length >= MAX_NOTES) {
      let kill = 0;
      for (let i = 1; i < eng.notes.length; i++) if (eng.notes[i].env < eng.notes[kill].env) kill = i;
      eng.notes.splice(kill, 1);
    }
    slot = { n: note, env: 0, vel, down: true, ph: rnd(eng), ph2: rnd(eng) };
    eng.notes.push(slot);
  }
  slot.down = true;
  slot.vel = vel;
  slot.rel = false;
}

function noteOff(eng, n) {
  const note = n & 127;
  const slot = eng.notes.find(s => s.n === note);
  if (!slot) return;
  slot.down = false;
  if (!eng.sustain) slot.rel = true;
}

function releaseHeld(eng) {
  eng.notes.forEach(s => { if (!s.down) s.rel = true; });
}

function panic(eng) {
  eng.notes.length = 0;
  eng.sustain = false;
}

function handle(eng, m) {
  if (!m || !m.t) return;
  if (m.t === 'on') noteOn(eng, m.n, m.v == null ? 0.8 : m.v);
  else if (m.t === 'off') noteOff(eng, m.n);
  else if (m.t === 'bend') eng.bend = Math.max(-1, Math.min(1, +m.v || 0));
  else if (m.t === 'mw') eng.wheel = Math.max(0, Math.min(1, +m.v || 0));
  else if (m.t === 'sus') {
    eng.sustain = !!m.on;
    if (!eng.sustain) releaseHeld(eng);
  } else if (m.t === 'panic') panic(eng);
  else if (m.t === 'active') {
    eng.active = !!m.on;
    if (!eng.active) panic(eng);
  } else if (m.t === 'patch' && m.p) {
    eng.P = normalizePentagrid(m.p);
    rebuildPlans(eng);
  }
}

export function postRadio(eng, m) {
  if (!m) return;
  if (m.at == null) eng.soon.push(m);
  else eng.queue.push(m);
}

export function createRadioEngine(sampleRate, patch) {
  const P = normalizePentagrid(patch || {});
  const eng = {
    sr: sampleRate,
    P,
    active: true,
    awake: 1,
    bend: 0,
    wheel: 0,
    sustain: false,
    seed: 0x6D2B79F5,
    seedN: 0xA341316C,
    seedC: 0x1B873593,
    time: 0,
    notes: [],
    ph: new Float64Array(PENTA_BAND.length * 2),
    qsb: PENTA_BAND.map(() => 1),
    qsbTarget: PENTA_BAND.map(() => 1),
    qsbNext: 0.2,
    pinkL: 0,
    pinkR: 0,
    crack: 0,
    blank: 0,
    agc: 0,
    lpL: 0,
    lpR: 0,
    hpL: 0,
    hpR: 0,
    hpYL: 0,
    hpYR: 0,
    mGate: 0,
    planKey: '',
    userPlan: [],
    userSpan: 0,
    userCursor: { i: 0, u: -1 },
    cw: [],
    form: {
      ph: 0, vowel: 0, syl: 0.8, sylT: 0, step: 0,
      a1: [0, 0, 0], a2: [0, 0, 0], y1: [0, 0, 0], y2: [0, 0, 0],
    },
    queue: [],
    soon: [],
    meterN: 0,
    cpuMs: 0,
    cpuFrames: 0,
    acc: 0,
    accN: 0,
    onMeter: null,
    toldSleep: false,
  };
  rebuildPlans(eng);
  setFormant(eng, sampleRate, 0);
  return eng;
}

export function renderRadio(eng, outL, outR, start) {
  const t0 = Date.now();
  const n = outL.length;
  const sr = eng.sr;
  if (eng.soon.length) {
    const soon = eng.soon;
    eng.soon = [];
    soon.forEach(m => handle(eng, m));
  }
  const sleeping = eng.active === false && eng.awake < 1e-4 && !eng.notes.length && !eng.queue.length;
  if (sleeping) {
    if (!eng.toldSleep && eng.onMeter) {
      eng.toldSleep = true;
      eng.onMeter({ t: 'meter', dev: 'pentagrid', voices: 0, notes: [], playing: false, level: 0, cpu: 0 });
    }
    for (let i = 0; i < n; i++) { outL[i] = 0; if (outR !== outL) outR[i] = 0; }
    return;
  }
  eng.toldSleep = false;
  const q = eng.queue;
  if (q.length > 1) q.sort((a, b) => (a.at || 0) - (b.at || 0));
  let qi = 0;
  const gateCoef = 1 - Math.exp(-1 / (0.0025 * sr));
  const envAtk = 1 - Math.exp(-1 / (0.006 * sr));
  const envRel = 1 - Math.exp(-1 / (0.055 * sr));
  const awakeCoef = 1 - Math.exp(-1 / (0.02 * sr));
  for (let i = 0; i < n; i++) {
    const frame = (start || 0) + i;
    while (qi < q.length && (q[qi].at || 0) <= frame) handle(eng, q[qi++]);
    const P = eng.P;
    const tune = P.tune;
    const bfo = P.bfo;
    const half = P.bandwidth * 0.5;
    const prop = 0.22 + 0.78 * P.cond;
    const fade = Math.min(1, P.fade + eng.wheel * 0.35);
    eng.awake += ((eng.active ? 1 : 0) - eng.awake) * awakeCoef;

    if ((i & 63) === 0) {
      if (eng.time >= eng.qsbNext) {
        eng.qsbNext = eng.time + 0.28 + rnd(eng) * 0.55;
        for (let s = 0; s < eng.qsbTarget.length; s++) eng.qsbTarget[s] = 1 - fade * rnd(eng);
      }
      for (let s = 0; s < eng.qsb.length; s++) eng.qsb[s] += (eng.qsbTarget[s] - eng.qsb[s]) * 0.08;
      eng.form.step++;
      if (eng.form.step >= 32) {
        eng.form.step = 0;
        const cycle = (eng.time * 0.35) % VOWELS.length;
        eng.form.vowel = Math.floor(cycle) % VOWELS.length;
        eng.form.sylT += 0.064 * 32;
        if (eng.form.sylT > 0.22) {
          eng.form.sylT = 0;
          eng.form.syl = rnd(eng) > 0.35 ? 0.4 + rnd(eng) * 0.6 : 0.05;
        }
      }
    }

    let L = 0;
    let R = 0;
    const air = P.air;
    if (air > 0.0001) {
      const nL = rnd(eng) * 2 - 1;
      const nR = rnd(eng) * 2 - 1;
      eng.pinkL += (nL - eng.pinkL) * 0.08;
      eng.pinkR += (nR - eng.pinkR) * 0.08;
      const nGain = P.noise * (1.05 - 0.8 * P.cond) * (0.35 + half / 4000) * 0.22 * air;
      L += eng.pinkL * nGain;
      R += eng.pinkR * nGain;

      if (rnd(eng) < P.crackle * 0.0016) eng.crack = (rnd(eng) * 2 - 1) * (0.35 + P.crackle * 0.6);
      const spike = eng.crack;
      eng.crack *= 0.9;
      if (P.blanker > 0.02 && Math.abs(spike) > (1.05 - P.blanker) * 0.28) eng.blank = Math.max(eng.blank, (0.001 + P.blanker * 0.003) * sr);
      else {
        L += spike * air * 0.8;
        R += spike * 0.65 * air * 0.8;
      }
      if (eng.blank > 0) eng.blank--;

      for (let s = 0; s < PENTA_BAND.length; s++) {
        const st = PENTA_BAND[s];
        const delta = (st.khz - tune) * 1000;
        const sk = skirtOf(delta, half);
        if (sk <= 0) continue;
        const q = eng.qsb[s];
        const g = sk * q * prop * air;
        if (st.kind === 'carrier' || st.kind === 'whistle' || st.kind === 'cw') {
          let key = 1;
          if (st.kind === 'cw' && eng.cw[s]) key = gateAt(eng.cw[s].cursor, eng.cw[s].plan, eng.cw[s].span, eng.time + s * 0.17);
          const hz = Math.abs(beatHz(delta, bfo, P.mode));
          if (hz > 20 && hz < sr * 0.45 && key > 0) {
            const amp = (st.kind === 'whistle' ? 0.26 : 0.42) * g * key;
            eng.ph[s * 2] += hz / sr;
            if (eng.ph[s * 2] >= 1) eng.ph[s * 2] -= 1;
            const y = Math.sin(2 * Math.PI * eng.ph[s * 2]) * amp;
            L += y;
            R += y;
          }
          if (st.kind === 'whistle') {
            const hz2 = Math.abs(beatHz(delta + st.split * 1000, bfo, P.mode));
            if (hz2 > 20 && hz2 < sr * 0.45) {
              eng.ph[s * 2 + 1] += hz2 / sr;
              if (eng.ph[s * 2 + 1] >= 1) eng.ph[s * 2 + 1] -= 1;
              const y2 = Math.sin(2 * Math.PI * eng.ph[s * 2 + 1]) * 0.24 * g;
              L += y2;
              R += y2;
            }
          }
        } else if (st.kind === 'time') {
          const y = pipSample(eng.time) * g;
          L += y;
          R += y;
        } else if (st.kind === 'figures') {
          const y = figuresSample(eng.time, P.seed + s * 13) * g * 1.15;
          L += y;
          R += y;
        } else if (st.kind === 'rtty') {
          const bit = rttyBit(eng.time, P.seed + s);
          const hz = (bit ? 2125 : 2295) + (P.mode === 'am' ? 0 : delta);
          const ahz = Math.abs(hz);
          if (ahz > 40 && ahz < sr * 0.45) {
            eng.ph[s * 2] += ahz / sr;
            if (eng.ph[s * 2] >= 1) eng.ph[s * 2] -= 1;
            const y = Math.sin(2 * Math.PI * eng.ph[s * 2]) * 0.3 * g;
            L += y;
            R += y * 0.92;
          }
        } else if (st.kind === 'ssb') {
          const shift = P.mode === 'lsb' ? -delta : delta;
          if ((i & 63) === 0) setFormant(eng, sr, shift * 0.15);
          const f0 = Math.max(70, Math.min(280, 128 + shift * 0.04));
          const y = formant(eng, sr, f0, shift * 0.15, eng.form.syl) * g * 1.4;
          L += y;
          R += y * 0.9;
        }
      }
    }

    const userTarget = P.text ? gateAt(eng.userCursor, eng.userPlan, eng.userSpan, eng.time) : 0;
    eng.mGate += (userTarget - eng.mGate) * gateCoef;
    if (eng.mGate > 0.0008) {
      const tone = Math.abs(bfo) >= 200 ? Math.abs(bfo) : 600;
      eng.ph[0] += 0; // carrier phase slot 0 is the 3560 station; keep a private phase
      eng.sidePh = (eng.sidePh || 0) + tone / sr;
      if (eng.sidePh >= 1) eng.sidePh -= 1;
      const y = Math.sin(2 * Math.PI * eng.sidePh) * eng.mGate * 0.46 * (0.55 + 0.45 * P.level);
      L += y;
      R += y;
    }

    for (let k = eng.notes.length - 1; k >= 0; k--) {
      const slot = eng.notes[k];
      const target = slot.rel ? 0 : slot.vel;
      const coef = slot.rel || slot.env > target ? envRel : envAtk;
      slot.env += (target - slot.env) * coef;
      if (slot.rel && slot.env < 0.0008) { eng.notes.splice(k, 1); continue; }
      const hz = midiHz(slot.n, eng.bend);
      slot.ph += hz / sr;
      if (slot.ph >= 1) slot.ph -= 1;
      slot.ph2 += (hz * 1.004) / sr;
      if (slot.ph2 >= 1) slot.ph2 -= 1;
      const y = (Math.sin(2 * Math.PI * slot.ph) * 0.72 + Math.sin(2 * Math.PI * slot.ph2) * 0.28) * slot.env * 0.4;
      L += y;
      R += y;
    }

    if (eng.blank > 0) { L = 0; R = 0; }
    const fc = Math.max(1800, Math.min(7000, P.bandwidth * 1.6));
    const gl = 1 - Math.exp(-2 * Math.PI * fc / sr);
    const gh = 1 - Math.exp(-2 * Math.PI * 55 / sr);
    eng.lpL += (L - eng.lpL) * gl;
    eng.lpR += (R - eng.lpR) * gl;
    eng.hpYL += (eng.lpL - eng.hpYL) * gh;
    eng.hpYR += (eng.lpR - eng.hpYR) * gh;
    let oL = (eng.lpL - eng.hpYL) * P.level;
    let oR = (eng.lpR - eng.hpYR) * P.level;
    const envIn = Math.max(Math.abs(oL), Math.abs(oR));
    const agcCoef = envIn > eng.agc ? 0.02 : 0.0004;
    eng.agc += (envIn - eng.agc) * agcCoef;
    const agcGain = 1 / (1 + P.agc * eng.agc * 6);
    oL = soft(oL * agcGain * eng.awake);
    oR = soft(oR * agcGain * eng.awake);
    if (oL > 1) oL = 1; else if (oL < -1) oL = -1;
    if (oR > 1) oR = 1; else if (oR < -1) oR = -1;
    if (Math.abs(eng.lpL) < 1e-20) eng.lpL = 0;
    if (Math.abs(eng.lpR) < 1e-20) eng.lpR = 0;
    outL[i] = oL;
    if (outR !== outL) outR[i] = oR;
    eng.acc += oL * oL;
    eng.accN++;
    eng.time += 1 / sr;
  }
  if (qi) q.splice(0, qi);
  eng.meterN += n;
  eng.cpuMs += Date.now() - t0;
  eng.cpuFrames += n;
  if (eng.onMeter && eng.meterN >= sr / 30) {
    const notes = [];
    let voices = 0;
    for (let k = 0; k < eng.notes.length; k++) {
      if (eng.notes[k].env > 0.01) { voices++; notes.push(eng.notes[k].n); }
    }
    const playing = !!(eng.active && (eng.P.air > 0.001 || voices > 0 || eng.mGate > 0.05));
    eng.onMeter({
      t: 'meter', dev: 'pentagrid',
      voices, notes, playing,
      level: Math.sqrt(eng.acc / Math.max(1, eng.accN)),
      tune: eng.P.tune,
      cpu: eng.cpuFrames ? eng.cpuMs / (eng.cpuFrames / sr * 1000) : 0,
    });
    eng.meterN = 0; eng.acc = 0; eng.accN = 0;
    if (eng.cpuFrames > sr) { eng.cpuMs *= 0.5; eng.cpuFrames *= 0.5; }
  }
}

export { ditSeconds };
