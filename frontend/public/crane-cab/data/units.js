// How a number is read out to the operator. Data, not a system: it holds no
// state, emits nothing, and is imported by both ui.js and render.js.
//
// CLAUDE.md says conversion lives in ui.js, and that was right while the gauges
// existed in exactly one place. They exist in two now - the screen console and
// the cab's own instrument panel, which render.js draws in the world - and the
// alternative to this file was two copies of the same arithmetic in two modules
// that are forbidden from importing each other, which is how a cab comes to
// disagree with its own HUD about what is on the hook.
//
// SI still goes in. Only the reading out happens here.

const FT_PER_M = 3.28084;
const LB_PER_KG = 2.20462;
const MPH_PER_MPS = 2.23694;
const KMH_PER_MPS = 3.6;

export function fmtLen(m, units) {
  return units === 'imperial' ? `${Math.round(m * FT_PER_M)} ft` : `${m.toFixed(1)} m`;
}

// Digits only; the unit goes in the label. "4,409 lb" at 22px tabular does not
// fit the cluster column at any realistic desktop width and the value clips with
// no ellipsis, so the operator was reading "4,40".
//
// US cab displays read in pounds. Metric reads kg under a tonne, tonnes above.
// An earlier version divided pounds by a thousand and labelled the result "t",
// which is kips wearing a metric hat.
export function fmtMass(kg, units) {
  if (units === 'imperial') return Math.round(kg * LB_PER_KG).toLocaleString('en-US');
  return kg < 1000 ? String(Math.round(kg)) : (kg / 1000).toFixed(2);
}

export function massUnit(units, kg) {
  if (units === 'imperial') return 'lb';
  return kg < 1000 ? 'kg' : 't';
}

export function lenUnit(units) {
  return units === 'imperial' ? 'ft' : 'm';
}

export function windUnit(units) {
  return units === 'imperial' ? 'mph' : 'km/h';
}

export function fmtLenShort(m, units) {
  return units === 'imperial' ? `${Math.round(m * FT_PER_M)}` : `${m.toFixed(1)}`;
}

export function fmtWindShort(mps, units) {
  return String(Math.round(units === 'imperial' ? mps * MPH_PER_MPS : mps * KMH_PER_MPS));
}

export function fmtClock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
