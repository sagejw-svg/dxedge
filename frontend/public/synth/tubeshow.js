// Filament tube show: exaggerated tube visuals, on purpose (James, 13 Oct 2026: "I realize it isn't
// realistic, but we are building a tube synth in a web browser").
// Original code. Nothing here touches the audio path: the state below is fed from the meters and the
// output analysers the page already reads, once per chassis frame, and tubepaint.js draws it.
//
//   flare   every note-on flares V1 at once, then V2, then the output pair, scaled by velocity,
//           decaying with a 150 ms time constant
//   heat    drive and the actual signal level push the plates from grey through cherry red to orange
//   arc     a hard clip in a tube stage or at the output ceiling fires a blue-white arc (rate limited)
//   blue    blue fluorescence on the power tubes (V3, V4) that follows the output level
//   res     V2 brightens with resonance and shimmers when the filter self-oscillates
//   lamps   one small lamp per sounding voice, up to 16
// Modes: off, subtle, full (default full, remembered per browser). Reduced motion keeps the steady
// glows (heat, blue, resonance level) and drops everything that flickers or flashes.

export const SHOW_MODES = ['off', 'subtle', 'full'];
export const SHOW_KEY = 'filament_tubeshow';
const SCALE = { off: 0, subtle: 0.45, full: 1 };
const TUBES = ['v1', 'v2', 'v3', 'v4'];
const FLARE_TAU = 0.15;                  // s, note flare decay
const FLARE_LAG = { v1: 0, v2: 0.02, v3: 0.045, v4: 0.045 };   // V1 first, then V2, then the output pair
const ARC_GAP = 0.2;                     // s, at most five arcs a second across the chassis
const ARC_TAU = 0.06;                    // s, an arc's fade
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function makeShow(mode, reduced) {
  const z = () => ({ v1: 0, v2: 0, v3: 0, v4: 0 });
  return {
    mode: SCALE[mode] != null ? mode : 'full', reduced: !!reduced,
    flare: z(), heat: z(), arc: z(), seed: z(), blue: z(), res: 0, shimmer: false,
    pend: [], arcs: 0, lastArc: -1e9, lamps: 0, notes: new Set(), t: 0, drawMs: 0, onsets: 0,
    // the last flare each tube took (its level before any decay) and how long after its note-on, on the
    // show's own clock. For the test hook: unlike the decayed flare, these do not depend on when a
    // starved frame loop happens to run.
    fired: z(), firedLag: { v1: -1, v2: -1, v3: -1, v4: -1 },
  };
}
export const showScale = S => SCALE[S.mode] || 0;
export function setShowMode(S, mode) { if (SCALE[mode] == null) return false; S.mode = mode; if (mode === 'off') clearFlicker(S); return true; }
function clearFlicker(S) {
  TUBES.forEach(k => { S.flare[k] = 0; S.arc[k] = 0; S.heat[k] = 0; S.blue[k] = 0; });
  S.pend.length = 0; S.res = 0; S.shimmer = false;
}

// A note-on, with velocity 0..1. Flicker, so off and reduced motion skip it.
export function showNote(S, vel) {
  if (S.mode === 'off' || S.reduced) return;
  const v = clamp(vel == null ? 0.8 : vel, 0.05, 1);
  S.onsets++;
  TUBES.forEach(k => S.pend.push({ k, t0: S.t, at: S.t + FLARE_LAG[k], v: k === 'v1' ? v : v * 0.85 }));
  if (S.pend.length > 64) S.pend.splice(0, S.pend.length - 64);
}
// Note numbers from a meter; anything new since the last one is a note-on (keys, MIDI, the deck).
export function showNotes(S, notes, velOf, skip) {
  const now = new Set(notes || []);
  now.forEach(n => { if (!S.notes.has(n) && !(skip && skip(n))) showNote(S, velOf ? velOf(n) : 0.8); });
  S.notes = now;
}

// One chassis frame. inp: {
//   lv:    {v1..v4} 0..1.2, the levels the tubes already glow by
//   drive: {v1..v4} 0..10, the stage's drive knob
//   on:    {v1..v4} whether the stage is in the signal path
//   clip:  {v1..v4} true when that stage is clipping hard (v3/v4 also at the output ceiling)
//   res:   0..1 resonance shown on V2; osc: true when the filter self-oscillates
//   voices: sounding voices }
export function stepShow(S, dt, inp) {
  S.t += dt;
  const k = showScale(S);
  // pending flares
  for (let i = S.pend.length - 1; i >= 0; i--) {
    const p = S.pend[i];
    if (p.at <= S.t) {
      if (inp.on[p.k]) { S.flare[p.k] = Math.max(S.flare[p.k], p.v); S.fired[p.k] = p.v; S.firedLag[p.k] = S.t - p.t0; }
      S.pend.splice(i, 1);
    }
  }
  const fd = Math.exp(-dt / FLARE_TAU), ad = Math.exp(-dt / ARC_TAU);
  let fire = null;
  TUBES.forEach(t => {
    S.flare[t] *= fd; if (S.flare[t] < 0.002) S.flare[t] = 0;
    S.arc[t] *= ad; if (S.arc[t] < 0.01) S.arc[t] = 0;
    // heat: drive alone warms a little; drive with signal plates red, then orange
    const dn = clamp(inp.drive[t] / 10, 0, 1), lv = clamp(inp.lv[t], 0, 1.2);
    const tgt = !inp.on[t] || k === 0 ? 0 : clamp(0.18 * dn + 1.05 * dn * Math.min(1, lv) + 0.3 * Math.max(0, lv - 0.85), 0, 1);
    if (k === 0) S.heat[t] = 0;
    else {
      const tau = tgt > S.heat[t] ? 0.35 : 0.9;
      S.heat[t] += (tgt - S.heat[t]) * (1 - Math.exp(-dt / tau));
    }
    if (inp.clip[t] && inp.on[t] && (!fire || lv > fire.lv)) fire = { t, lv };
  });
  ['v3', 'v4'].forEach(t => {
    const tgt = k === 0 ? 0 : clamp(inp.lv[t] * 1.15, 0, 1);
    if (k === 0) S.blue[t] = 0;
    else S.blue[t] += (tgt - S.blue[t]) * (1 - Math.exp(-dt / (tgt > S.blue[t] ? 0.06 : 0.25)));
  });
  S.blue.v1 = S.blue.v2 = 0;
  const rt = k === 0 || !inp.on.v2 ? 0 : clamp(inp.res, 0, 1);
  S.res += (rt - S.res) * (1 - Math.exp(-dt / 0.12));
  S.shimmer = k > 0 && !S.reduced && !!inp.osc && !!inp.on.v2;
  // arcs: flashes, so not in reduced motion or off, and never more than one per ARC_GAP
  if (fire && k > 0 && !S.reduced && S.t - S.lastArc >= ARC_GAP) {
    S.arc[fire.t] = 1; S.seed[fire.t] = (S.seed[fire.t] * 1103515245 + 12345 + S.arcs) >>> 0; S.arcs++; S.lastArc = S.t;
    if (fire.t === 'v3' || fire.t === 'v4') { S.arc.v3 = S.arc.v4 = 1; }
  }
  S.lamps = k === 0 ? 0 : clamp(Math.round(inp.voices || 0), 0, 16);
  return S;
}

// What one tube's overlay needs, scaled by the mode.
export function showFor(S, t) {
  const k = showScale(S);
  return { k, flare: S.flare[t], heat: S.heat[t], arc: S.arc[t], seed: S.seed[t], blue: S.blue[t] || 0,
    res: t === 'v2' ? S.res : 0, shimmer: t === 'v2' && S.shimmer, reduced: S.reduced };
}

// A snapshot for the test hook.
export function showState(S) {
  const r = o => Object.fromEntries(Object.entries(o).map(([a, b]) => [a, Math.round(b * 1000) / 1000]));
  return { mode: S.mode, reduced: S.reduced, flare: r(S.flare), heat: r(S.heat), arc: r(S.arc), blue: r(S.blue),
    res: Math.round(S.res * 1000) / 1000, shimmer: S.shimmer, arcs: S.arcs, lamps: S.lamps, onsets: S.onsets,
    fired: r(S.fired), firedLag: Object.fromEntries(TUBES.map(k => [k, S.firedLag[k] < 0 ? -1 : Math.round(S.firedLag[k] * 1e4) / 10])),
    drawMs: Math.round(S.drawMs * 1000) / 1000 };
}
