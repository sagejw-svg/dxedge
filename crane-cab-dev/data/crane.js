// Crane spec. Data only, one machine, no OEM numbers.
// Everything that describes the crane itself lives here so that jib length, the
// trolley stop, speeds and the load chart are one edit. crane.js, sensors.js,
// pendulum.js, render.js and state.js import from this file. Nothing imports
// from them to get these numbers.
//
// Units: m, m/s, m/s^2, rad/s, rad/s^2, kg.

export const CRANE = {
  jibLength: 55,
  minRadius: 3.5,
  maxRadius: 54,          // trolley stop. The single knob for "how far out can the trolley go".
  minLine: 2.5,           // rope left when the block is against the trolley
  maxLine: 70,
  cabHeight: 42,          // seat height above the deck
  hookDrop: 1.8,          // trolley sheave sits this far above cabHeight; the rope hangs from there

  slew:    { max: { II: 0.12, I: 0.048, micro: 0.012 }, accel: 0.06 },
  trolley: { max: { II: 1.00, I: 0.40,  micro: 0.10 },  accel: 0.6 },
  hoist:   { max: { II: 1.50, I: 0.60,  micro: 0.15 },  accel: 1.2 },

  a2bMargin: 0.5,         // m of rope above minLine that A2B keeps in hand after the hoist has stopped
  lmi: { preAlarmPct: 90, lockPct: 100 },

  // Generic load chart, not any manufacturer's data. Capacity falls off with radius.
  // Linear between points, flat outside the ends.
  loadChart: [
    { r: 10, kg: 6000 },
    { r: 20, kg: 4000 },
    { r: 30, kg: 2600 },
    { r: 40, kg: 1900 },
    { r: 50, kg: 1400 },
    { r: 55, kg: 1200 }
  ]
};

// Rated load at a radius. Flat outside the chart ends.
export function ratedAtRadius(r) {
  const chart = CRANE.loadChart;
  const first = chart[0];
  const last = chart[chart.length - 1];
  if (r <= first.r) return first.kg;
  if (r >= last.r) return last.kg;
  for (let i = 0; i < chart.length - 1; i += 1) {
    const a = chart[i];
    const b = chart[i + 1];
    if (r <= b.r) {
      const t = (r - a.r) / (b.r - a.r);
      return a.kg + (b.kg - a.kg) * t;
    }
  }
  return last.kg;
}

// Inverse of the chart: the largest radius at which `kg` is still rated. Below the
// lightest chart value the answer is the trolley stop; above the heaviest it is the
// first chart radius. Clamped to the trolley's physical range.
export function maxRadiusForLoad(kg) {
  const chart = CRANE.loadChart;
  const first = chart[0];
  const last = chart[chart.length - 1];
  let r;
  if (kg <= last.kg) r = CRANE.maxRadius;
  else if (kg >= first.kg) r = first.r;
  else {
    r = last.r;
    for (let i = 0; i < chart.length - 1; i += 1) {
      const a = chart[i];
      const b = chart[i + 1];
      if (kg <= a.kg && kg >= b.kg) {
        const t = (a.kg - kg) / (a.kg - b.kg);
        r = a.r + (b.r - a.r) * t;
        break;
      }
    }
  }
  return Math.min(CRANE.maxRadius, Math.max(CRANE.minRadius, r));
}
