// Surprise me (0.3, 11 Nov 2026): a random patch inside musical limits, for Filament and Cathode.
//
// Our own code. The limits are built in, then measured:
//   in tune     tune 0, no fixed-pitch oscillator, no pitch route in the matrix, the second oscillator
//               only at an interval that lands on a harmonic of the note (unison, octaves, a fifth up,
//               a fourth below), a few cents of detune at most, vibrato under 10 cents, resonance kept
//               below the point where a filter sings at its own pitch.
//   never silent the oscillators are always up, envelopes reach a level a note can be heard at, the
//               cutoff sits above the note's fundamental on every archetype.
//   never loud  the page renders the draw offline (fit below) and sets the output level so a held chord
//               at full velocity peaks at FIT.peak and sits at FIT.rms at most, well under the
//               limiter's -1 dBFS threshold; a draw too quiet to fit is drawn again.
// A draw is a pure function of (device, seed), so the suite can replay any seed.

export const SURPRISE_DEVICES = ['filament', 'cathode'];
// the fit's targets (dBFS), the level the fit render is made at (dB, out.level), and what counts as silent
export const FIT = { peak: -6, rms: -18, probe: -12, silent: -60, tries: 4 };

// A 32-bit xorshift generator (13, 17, 5 shifts). The seed is mixed first so seeds 1, 2, 3 do not start alike.
export function rng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0; s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0; s = (s ^ (s >>> 16)) >>> 0;
  if (!s) s = 0x9e3779b9;
  const next = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  for (let i = 0; i < 4; i++) next();
  const R = {
    u: next,
    r: (a, b) => a + (b - a) * next(),                       // uniform a..b
    lg: (a, b) => a * Math.pow(b / a, next()),               // log-uniform a..b (times, frequencies)
    i: (a, b) => a + Math.floor(next() * (b - a + 1)),       // integer a..b
    pick: list => list[Math.floor(next() * list.length)],
    w: table => { let t = 0; for (const k in table) t += table[k]; let x = next() * t; for (const k in table) { x -= table[k]; if (x < 0) return k; } return Object.keys(table)[0]; },
    chance: p => next() < p,
  };
  return R;
}
const rd = (x, n) => { const m = Math.pow(10, n); return Math.round(x * m) / m; };

const ADJ = ['Amber', 'Copper', 'Smoky', 'Velvet', 'Ember', 'Glass', 'Walnut', 'Static', 'Hollow', 'Brass', 'Mica', 'Cobalt',
  'Dusky', 'Lantern', 'Rusty', 'Silver', 'Ozone', 'Pewter', 'Cinder', 'Honey', 'Iron', 'Linen', 'Midnight', 'Quartz'];
const NOUN = {
  Bass: ['Thump', 'Floor', 'Growl', 'Pulse', 'Cellar', 'Rumble'], Lead: ['Wire', 'Line', 'Whistle', 'Arc', 'Signal', 'Beam'],
  Pad: ['Haze', 'Field', 'Choir', 'Drift', 'Tide', 'Mist'], Keys: ['Bell', 'Tine', 'Parlor', 'Chime', 'Lamp', 'Hammer'],
  Pluck: ['Pick', 'Drop', 'Harp', 'Snap', 'Spark', 'Bead'], Sweep: ['Sweep', 'Glide', 'Swell', 'Tide', 'Turn', 'Orbit'],
};
// a factory name never collides: the number on the end is not in any factory name
export function surpriseName(R, cat, seed) { return R.pick(ADJ) + ' ' + R.pick(NOUN[cat] || NOUN.Lead) + ' ' + String((seed >>> 0) % 10000).padStart(4, '0'); }

// Intervals for the second oscillator, as [octave, semitone]: each lands within 2 cents of a harmonic
// of the note or of a note one or two octaves below it (a fifth is 3:2, a fourth below is 3:4).
const INTERVALS = { unison: [0, 0], up8: [1, 0], down8: [-1, 0], fifth: [0, 7], fifth8: [1, 7], fourthDown: [0, -5] };
const POWER = ['EL34', '6L6', '6V6', 'EL84', 'KT88', '300B'];
const PRE = ['12AX7', '12AT7', '12AU7'];

// The rack fields Filament and Cathode share (ensemble, tape echo, spring, the output stage), drawn once per patch.
function rackFields(R, cat) {
  const lush = cat === 'Pad' || cat === 'Keys' || cat === 'Sweep';
  const ens = { on: R.chance(lush ? 0.6 : 0.2), mode: R.pick(['I', 'II', 'I+II', 'strings']), mix: rd(R.r(30, 60), 0) };
  const echo = { on: R.chance(cat === 'Pad' ? 0.15 : 0.3), mode: R.pick(['mono', 'pingpong', 'offset']), time: rd(R.r(220, 520), 0), sync: R.pick(['off', '1/4', '1/8d', '1/8', '1/4d']),
    fb: rd(R.r(15, 45), 0), mix: rd(R.r(12, 28), 0), wow: rd(R.r(5, 30), 0), flutter: rd(R.r(5, 30), 0), drive: rd(R.r(2, 4), 1), tone: rd(R.r(3, 7), 1) };
  const spring = { on: R.chance(0.2), mix: rd(R.r(10, 28), 0), decay: rd(R.r(1.5, 3.5), 1), tone: rd(R.r(3.5, 7), 1), drip: rd(R.r(15, 60), 0), drive: rd(R.r(2, 4), 1) };
  const out = { tube: R.pick(POWER), topology: R.pick(['pp', 'pp', 'se']), drive: rd(R.r(1.5, 4.5), 1), bias: 0, sag: rd(R.r(1, 4), 1), tone: rd(R.r(-1.5, 1.5), 1), level: 0,
    spkOn: false, roomOn: R.chance(0.85), room: R.pick(['living', 'studio', 'studio', 'theater', 'hall']), rmMix: rd(R.r(8, cat === 'Pad' ? 28 : 20), 0),
    rmDecay: rd(R.r(0.6, cat === 'Pad' ? 3.2 : 2.0), 2), rmTone: rd(R.r(4, 8), 1), wOn: true, width: rd(R.r(90, 120), 0), wChar: 9,
    eqOn: false, eqBands: 10, eqPreset: 'flat', eqPre: 0 };
  return { ens, echo, spring, out };
}

// Envelope times per archetype: [attack, decay, sustain, release] ranges.
const ENV_A = {
  Bass: [[0.002, 0.01], [0.15, 0.6], [0.5, 0.9], [0.06, 0.25]], Lead: [[0.003, 0.05], [0.3, 1.0], [0.6, 0.9], [0.1, 0.45]],
  Pad: [[0.25, 0.9], [1, 3], [0.65, 0.9], [0.8, 2.4]], Keys: [[0.002, 0.01], [0.6, 2], [0.25, 0.5], [0.3, 0.8]],
  Pluck: [[0.001, 0.004], [0.25, 0.8], [0.05, 0.15], [0.2, 0.6]], Sweep: [[0.2, 1.2], [0.8, 3], [0.45, 0.8], [0.6, 2]],
};
const CUT = { Bass: [300, 900], Lead: [900, 4000], Pad: [700, 3000], Keys: [1200, 5000], Pluck: [600, 2500], Sweep: [400, 1500] };

function filamentPatch(seed) {
  const R = rng(seed);
  const cat = R.w({ Bass: 2, Lead: 2, Pad: 2, Keys: 1.5, Pluck: 1.5 });
  const iv = INTERVALS[R.w(cat === 'Bass' ? { unison: 3, down8: 2, up8: 1, fifth: 1 } : { unison: 3, up8: 2, down8: 1, fifth: 1.5, fifth8: 1, fourthDown: 0.5 })];
  const near = iv[1] === 0;                          // octaves and unison take a chorus detune; fifths stay close to 3:2
  const fine2 = near ? rd((R.chance(0.5) ? 1 : -1) * R.r(3, 10), 1) : rd(R.r(-1.5, 1.5), 1);
  const ea = ENV_A[cat];
  const envA = { a: rd(R.lg(ea[0][0], ea[0][1]), 4), d: rd(R.lg(ea[1][0], ea[1][1]), 3), s: rd(R.r(ea[2][0], ea[2][1]), 2), r: rd(R.lg(ea[3][0], ea[3][1]), 3), vel: rd(R.r(0.2, 0.6), 2) };
  const envF = { a: rd(cat === 'Pad' ? R.lg(0.2, 1.5) : R.lg(0.001, 0.02), 4), d: rd(R.lg(cat === 'Pad' ? 1 : 0.15, cat === 'Pad' ? 3 : 1.2), 3), s: rd(R.r(0.15, 0.6), 2), r: rd(R.lg(0.1, 1.2), 3) };
  const model = R.w({ valve12: 3, ladder24: 2, diode18: 1, sk12: 1, poly24: 1, svf12: 1, lc: 0.6 });
  const envAmt = { Bass: [0.3, 0.7], Lead: [0.1, 0.5], Pad: [0, 0.3], Keys: [0.1, 0.4], Pluck: [0.4, 0.8] }[cat];
  const mono = cat === 'Bass' ? R.w({ mono: 2, legato: 2, poly: 1 }) : cat === 'Lead' ? R.w({ mono: 1, legato: 2, poly: 1 }) : 'poly';
  const unison = cat === 'Pad' ? R.i(1, 3) : cat === 'Lead' && R.chance(0.4) ? 2 : 1;
  // a bass an octave down already sits at 33 Hz on C2, so it takes no sub (the sub would be subsonic) and a bright wave
  const low = cat === 'Bass' && R.chance(0.3);
  const p = {
    name: surpriseName(R, cat, seed), cat, tune: 0, drift: rd(R.r(0.5, 2.5), 1),
    osc1: { wave: low ? R.pick(['saw', 'pulse']) : R.pick(cat === 'Bass' ? ['saw', 'saw', 'pulse', 'tri'] : ['saw', 'saw', 'pulse', 'tri', 'sine']), oct: low ? -1 : 0, semi: 0, fine: rd(R.r(-3, 3), 1), level: rd(R.r(0.6, 0.85), 2), pw: rd(R.r(0.3, 0.7), 2), fixed: 0 },
    osc2: { wave: R.pick(['saw', 'pulse', 'tri', 'sine']), oct: iv[0], semi: iv[1], fine: fine2, level: rd(R.r(0.15, 0.6), 2), pw: rd(R.r(0.3, 0.7), 2),
      sync: cat === 'Lead' && R.chance(0.25), fm: (cat === 'Keys' || cat === 'Pluck') && iv[1] === 0 && R.chance(0.4) ? rd(R.r(0.05, 0.25), 2) : 0, ring: 0, fixed: 0 },
    sub: { wave: R.pick(['square', 'sine']), oct: 1, level: rd(low ? 0 : cat === 'Bass' ? R.r(0.25, 0.6) : R.chance(0.3) ? R.r(0.05, 0.3) : 0, 2) },
    noise: { color: R.pick(['white', 'pink']), level: rd(cat === 'Pad' && R.chance(0.4) ? R.r(0.01, 0.05) : 0, 3) },
    v1: { tube: R.pick(PRE), drive: rd(R.r(1, cat === 'Lead' ? 6 : 4.5), 1), bias: 0 },
    filt: { model, cutoff: rd(R.lg(CUT[cat][0], CUT[cat][1]), 0), res: rd(R.r(0.05, cat === 'Bass' ? 0.75 : 0.65), 2), drive: rd(R.r(1, 5), 1),
      keytrack: rd(R.r(0.3, 0.8), 2), env: rd(R.r(envAmt[0], envAmt[1]), 2), vel: rd(R.r(0.1, 0.5), 2), sag: rd(R.r(1, 4), 1), offset: 0,
      hp: cat === 'Pad' ? rd(R.lg(20, 120), 0) : 20, morph: model === 'svf12' ? rd(R.r(0, 0.8), 2) : 0, lag: 0.3, gate: 'both' },
    filtB: { route: 'off' },
    envA, envF,
    lfo1: cat === 'Lead' || (cat === 'Pad' && R.chance(0.5))
      ? { wave: 'sine', rate: rd(R.r(4.5, 6.5), 2), delay: rd(R.r(0.2, 0.7), 2), mode: R.pick(['global', 'voice']), pitch: rd(R.r(2, 9), 1), cutoff: 0, pw: 0, amp: 0, sync: 'off' }
      : { wave: 'sine', rate: 5, delay: 0, mode: 'global', pitch: 0, cutoff: 0, pw: 0, amp: 0, sync: 'off' },
    lfo2: { wave: R.pick(['tri', 'sine', 'smooth']), rate: rd(R.lg(0.05, 0.6), 3), delay: 0, mode: 'global', phase: rd(R.r(0, 90), 0), pitch: 0,
      cutoff: rd(cat === 'Pad' || cat === 'Keys' ? R.r(0, 0.5) : R.r(0, 0.2), 2), pw: rd(R.r(0, 0.2), 2), amp: 0, pan: rd(R.r(0, 0.4), 2), sync: 'off' },
    voice: { mode: mono, count: 8, glide: mono !== 'poly' && R.chance(0.5) ? rd(R.r(0.02, 0.12), 3) : 0, bend: 2, level: rd(R.r(0.65, 0.8), 2), unison, detune: rd(R.r(6, 16), 1) },
    stereo: { pan: R.pick(['center', 'alt', 'key']), spread: rd(R.r(0.2, 0.5), 2), uspread: rd(R.r(0.3, 0.6), 2) },
    mod: {}, arp: { on: false }, era: { on: false },
  };
  // one matrix slot, sometimes, never on pitch, resonance or level
  if (R.chance(0.5)) p.mod.s1 = { src: R.pick(['lfo2', 'vel', 'key', 'rand', 'envF']), dst: R.pick(model === 'svf12' ? ['cut', 'pw', 'pan', 'morph'] : ['cut', 'pw', 'pan']), amt: rd(R.r(-0.3, 0.3), 2) };
  return Object.assign(p, rackFields(R, cat));
}

function cathodePatch(seed) {
  const R = rng(seed);
  const cat = R.w({ Bass: 2, Lead: 2, Sweep: 1.5 });
  const s1 = cat === 'Bass' ? R.pick([16, 16, 32]) : R.pick([8, 16]);
  const iv = R.w({ unison: 3, down8: 1.5, up8: 1, fifth: 1.5, fourthDown: 0.5 });
  // VCO 2 a foot setting away for an octave, or the same feet and a semitone offset
  const s2 = iv === 'down8' ? Math.min(32, s1 * 2) : iv === 'up8' ? Math.max(4, s1 / 2) : s1;
  const semi = iv === 'fifth' ? 7 : iv === 'fourthDown' ? -5 : 0;
  const near = semi === 0;
  const ea = ENV_A[cat];
  const p = {
    device: 'cathode', name: surpriseName(R, cat, seed), cat, tune: 0, drift: rd(R.r(0.5, 2), 1),
    vco1: { wave: R.pick(cat === 'Bass' ? ['saw', 'saw', 'pulse'] : ['saw', 'saw', 'pulse', 'tri']), scale: s1, pw: rd(R.r(0.2, 0.8), 2), level: rd(R.r(0.6, 0.85), 2) },
    vco2: { wave: R.pick(['saw', 'square', 'narrow']), scale: s2, semi, fine: near ? rd((R.chance(0.5) ? 1 : -1) * R.r(3, 9), 1) : rd(R.r(-1.5, 1.5), 1),
      level: rd(R.r(0.15, 0.6), 2), sync: cat === 'Lead' && R.chance(0.3) },
    pm: { a: cat === 'Lead' && R.chance(0.6) ? rd(R.r(0.03, 0.08), 3) : 0, b: 0, dest: 'both' },
    ctl: { glide: cat !== 'Sweep' && R.chance(0.5) ? rd(R.r(0.02, 0.1), 3) : 0, bend: 2, trig: R.pick(['multi', 'single']), wheel: 30 },
    drive: { tube: R.pick(PRE), amount: rd(R.r(1.5, cat === 'Lead' ? 6 : 4.5), 1), bias: 0 },
    hpf: { cutoff: rd(R.lg(20, 150), 0), peak: rd(R.r(0, 0.4), 2), a: 0, b: 0, kt: 0 },
    lpf: { cutoff: rd(R.lg(CUT[cat][0], CUT[cat][1]), 0), peak: rd(R.r(0.1, 0.72), 2), a: cat === 'Sweep' ? rd(R.r(0.05, 0.3), 2) : 0,
      b: rd(R.r(cat === 'Lead' ? 0.15 : 0.25, 0.7), 2), kt: rd(R.r(0.3, 0.7), 2) },
    follow: { tube: R.pick(['12AU7', '12AT7', '12AX7']), drive: rd(R.r(1.5, 5), 1) },
    mg: { rate: rd(cat === 'Sweep' ? R.lg(0.1, 1.2) : R.lg(3, 6.5), 2), shape: rd(R.r(0.2, 0.8), 2) },
    eg1: { delay: 0, a: 0.005, r: 0.3 },
    eg2: { hold: 0, a: rd(R.lg(ea[0][0], ea[0][1]), 4), d: rd(R.lg(ea[1][0], ea[1][1]), 3), s: rd(R.r(ea[2][0], ea[2][1]), 2), r: rd(R.lg(ea[3][0], ea[3][1]), 3) },
    vca: { level: rd(R.r(0.65, 0.85), 2), vel: rd(R.r(0.2, 0.5), 2), bias: 0 },
    cables: [],
  };
  return Object.assign(p, rackFields(R, cat));
}

// A draw before the fit (out.level 0). The device's normalizer still has the last word.
export function surprisePatch(device, seed) {
  if (device === 'filament') return filamentPatch(seed >>> 0);
  if (device === 'cathode') return cathodePatch(seed >>> 0);
  return null;
}

// What the fit plays: Filament a three-note chord, Cathode one note (it is mono), at full velocity,
// in the archetype's own register; held through `hold` seconds.
export function fitNotes(device, cat) {
  const root = cat === 'Bass' ? 36 : 60;
  return device === 'filament' && cat !== 'Bass' ? [root, root + 4, root + 7] : [root];
}
export const FIT_HOLD = 1.4, FIT_SECONDS = 1.6;

// Stats of a fit render made at out.level = FIT.probe: { peak, rms } in dBFS (rms over the loudest
// 100 ms window). Returns the out.level to use, or null when the draw is too quiet to fit.
export function fitLevel(stats) {
  if (!stats || !isFinite(stats.rms) || stats.rms < FIT.silent) return null;
  const lift = Math.min(FIT.rms - stats.rms, FIT.peak - stats.peak);
  const lvl = FIT.probe + lift;
  if (lvl > 12) return null;                         // past the level knob's top: too quiet to call a sound
  return Math.max(-24, Math.round(lvl * 10) / 10);
}
// The two numbers fitLevel reads, from a stereo render.
export function fitStats(L, R, sr) {
  let pk = 0; for (let i = 0; i < L.length; i++) { const a = Math.abs(L[i]), b = Math.abs(R[i]); if (a > pk) pk = a; if (b > pk) pk = b; }
  const w = Math.max(1, Math.round(sr * 0.1)); let best = 0;
  for (let s = 0; s + w <= L.length; s += Math.round(w / 2)) {
    let e = 0; for (let i = s; i < s + w; i++) e += L[i] * L[i] + R[i] * R[i];
    e /= 2 * w; if (e > best) best = e;
  }
  const dbf = x => (x > 0 ? 20 * Math.log10(x) : -200);
  return { peak: dbf(pk), rms: dbf(Math.sqrt(best)) };
}
