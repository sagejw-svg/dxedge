// Theremin mode (0.3): the pure part. A pad on Filament's Play tab where across is pitch and up is
// volume; the magic eye on the chassis shows how close the sounding pitch is to the nearest note.
// Settings are the page's, not the patch's (kept in localStorage THM_KEY), so no patch changes.
// Our own code.

export const THM_KEY = 'filament_theremin';
export const THM_LOWS = [24, 36, 48, 60];          // the pad's left edge: C1, C2, C3, C4
export const THM_SPANS = [1, 2, 3, 4, 5];          // octaves across the pad
export const THM_FLOOR = 0.03;                     // the bottom 3% of the pad is silence
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Old or partial settings load with defaults: C3 up 3 octaves, no snap, 36 dB of volume range.
export function normalizeThm(o) {
  o = o && typeof o === 'object' ? o : {};
  const low = THM_LOWS.includes(o.low) ? o.low : 48;
  const span = THM_SPANS.includes(o.span) ? o.span : 3;
  return { on: o.on === true, low, span, snap: clamp(num(o.snap, 0), 0, 1), depth: clamp(Math.round(num(o.depth, 36)), 12, 60) };
}

// x across the pad (0 left .. 1 right) to a fractional MIDI pitch. Snap pulls toward the nearest
// note: at 0 the pitch is continuous, at 1 it steps by semitones, between it keeps (1 - snap) of
// the distance from the note.
export function padPitch(x, st) {
  const raw = st.low + clamp(x, 0, 1) * st.span * 12;
  if (!(st.snap > 0)) return raw;
  const n = Math.round(raw);
  return n + (raw - n) * (1 - st.snap);
}
// the inverse of padPitch with no snap: where a pitch sits across the pad
export function pitchX(p, st) { return clamp((p - st.low) / (st.span * 12), 0, 1); }

// y up the pad (0 bottom .. 1 top) to a level 0..1: silence below THM_FLOOR, then depth dB up to 0 dB
// at the top, with the first 5% above the floor faded in so the edge of silence does not click.
export function padLevel(y, st) {
  y = clamp(y, 0, 1);
  if (y <= THM_FLOOR) return 0;
  const u = (y - THM_FLOOR) / (1 - THM_FLOOR);
  return Math.pow(10, -(st ? st.depth : 36) * (1 - u) / 20) * Math.min(1, u / 0.05);
}

// The nearest note to a pitch and how far off it is, in cents (-50 .. 50, + is sharp).
export function tuneOf(p) {
  const n = Math.round(p), c = (p - n) * 100;
  return { n, cents: c, name: noteName(n) };
}
export function noteName(n) { return NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1); }
