// Heptode voice families. A program number may pick an envelope and a
// slightly different clean wave. Nothing here adds drive, chorus, delay
// or reverb: a file starts uncolored. Channel 10 uses the short drum
// family so percussion reads as ticks rather than drones.

export const CHANNELS = 16;

export const FAMILY_NAMES = [
  'piano', 'perc', 'organ', 'guitar', 'bass', 'strings', 'ensemble',
  'brass', 'reed', 'pipe', 'lead', 'pad', 'fx', 'ethnic', 'drum', 'neutral',
];

// wave 0 is a sine, 0.5 a triangle, 1 a soft three-partial saw.
// Every family stays in the sine-to-triangle region and leaves fm at 0.
export const FAMILIES = {
  neutral:  { wave: 0.12, fm: 0, a: 0.012, d: 0.20, s: 0.84, r: 0.22, cutoff: 9000, res: 0.06, fenv: 0.08 },
  piano:    { wave: 0.20, fm: 0, a: 0.004, d: 0.34, s: 0.18, r: 0.30, cutoff: 8800, res: 0.05, fenv: 0.22 },
  perc:     { wave: 0.24, fm: 0, a: 0.002, d: 0.09, s: 0.00, r: 0.06, cutoff: 8600, res: 0.08, fenv: 0.16 },
  organ:    { wave: 0.34, fm: 0, a: 0.006, d: 0.08, s: 0.92, r: 0.08, cutoff: 7000, res: 0.10, fenv: 0.04 },
  guitar:   { wave: 0.28, fm: 0, a: 0.004, d: 0.22, s: 0.12, r: 0.18, cutoff: 6400, res: 0.08, fenv: 0.28 },
  bass:     { wave: 0.26, fm: 0, a: 0.005, d: 0.12, s: 0.72, r: 0.10, cutoff: 4200, res: 0.06, fenv: 0.12 },
  strings:  { wave: 0.30, fm: 0, a: 0.09,  d: 0.18, s: 0.82, r: 0.34, cutoff: 6200, res: 0.05, fenv: 0.10 },
  ensemble: { wave: 0.32, fm: 0, a: 0.14,  d: 0.20, s: 0.86, r: 0.42, cutoff: 5800, res: 0.05, fenv: 0.08 },
  brass:    { wave: 0.36, fm: 0, a: 0.028, d: 0.12, s: 0.74, r: 0.12, cutoff: 5000, res: 0.08, fenv: 0.30 },
  reed:     { wave: 0.33, fm: 0, a: 0.016, d: 0.10, s: 0.70, r: 0.10, cutoff: 4800, res: 0.10, fenv: 0.18 },
  pipe:     { wave: 0.18, fm: 0, a: 0.030, d: 0.10, s: 0.80, r: 0.16, cutoff: 5400, res: 0.07, fenv: 0.12 },
  lead:     { wave: 0.40, fm: 0, a: 0.010, d: 0.10, s: 0.70, r: 0.14, cutoff: 7200, res: 0.07, fenv: 0.16 },
  pad:      { wave: 0.22, fm: 0, a: 0.20,  d: 0.24, s: 0.80, r: 0.48, cutoff: 4600, res: 0.04, fenv: 0.12 },
  fx:       { wave: 0.16, fm: 0, a: 0.020, d: 0.20, s: 0.40, r: 0.30, cutoff: 6400, res: 0.08, fenv: 0.14 },
  ethnic:   { wave: 0.27, fm: 0, a: 0.008, d: 0.16, s: 0.42, r: 0.16, cutoff: 6000, res: 0.08, fenv: 0.16 },
  drum:     { wave: 0.16, fm: 0, a: 0.002, d: 0.05, s: 0.00, r: 0.04, cutoff: 9000, res: 0.04, fenv: 0.06 },
};

export function familyOf(program) {
  const p = Math.max(0, Math.min(127, program | 0));
  const band = Math.floor(p / 8);
  return FAMILY_NAMES[Math.min(band, 14)] || 'neutral';
}

export function familyFor(program, channel) {
  if ((channel | 0) === 9) return FAMILIES.drum;
  return FAMILIES[familyOf(program)] || FAMILIES.neutral;
}

export const TRACK_HUES = [28, 48, 72, 130, 165, 190, 210, 230, 255, 275, 300, 325, 350, 12, 95, 145];

export function trackColor(i) {
  const h = TRACK_HUES[(i | 0) % TRACK_HUES.length];
  return 'hsl(' + h + ' 62% 62%)';
}
