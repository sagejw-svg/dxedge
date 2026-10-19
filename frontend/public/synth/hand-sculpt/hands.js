// Hand geometry, calibration, smoothing, and grab logic for Sculpt.
// Pure functions: no camera, no audio, no DOM. The page and the tests share them.

export const ORBS = [
  { id: 'ember', name: 'Ember', kind: 'drone', x: -0.72, y: 0.42, z: -0.05, midi: 50, color: [1.00, 0.48, 0.18] },
  { id: 'amber', name: 'Amber', kind: 'drone', x: 0.18, y: 0.78, z: 0.10, midi: 57, color: [1.00, 0.72, 0.28] },
  { id: 'glass', name: 'Glass', kind: 'drone', x: 0.92, y: 0.12, z: -0.28, midi: 64, color: [0.45, 0.72, 1.00] },
  { id: 'violet', name: 'Violet', kind: 'drone', x: -0.28, y: -0.48, z: 0.22, midi: 43, color: [0.62, 0.38, 1.00] },
  { id: 'seed', name: 'Seed', kind: 'grain', x: 0.55, y: -0.22, z: 0.18, midi: 72, color: [0.35, 1.00, 0.62] },
  { id: 'spark', name: 'Spark', kind: 'grain', x: -0.95, y: 0.02, z: 0.42, midi: 79, color: [1.00, 0.38, 0.58] },
];

export const HAND_BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function dist3(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z || 0) - (b.z || 0);
  return Math.hypot(dx, dy, dz);
}

// Wrist to the middle knuckle. Finger curl does not change it, so it is the
// scale we calibrate against.
export function handSpan(lm) {
  return dist3(lm[0], lm[9]);
}

export function pinchAmount(lm) {
  const gap = dist3(lm[4], lm[8]);
  const unit = Math.max(handSpan(lm), 1e-4);
  const ratio = gap / unit;
  // Open thumb sits well clear of the index. A real pinch pulls them together.
  return clamp((0.62 - ratio) / 0.5, 0, 1);
}

// Middle, ring, and pinky only, so a pinch can stay shut while the hand opens.
export function fingerSpread(lm) {
  const pairs = [[12, 9], [16, 13], [20, 17]];
  let sum = 0;
  for (let i = 0; i < pairs.length; i++) sum += dist3(lm[pairs[i][0]], lm[pairs[i][1]]);
  const unit = Math.max(handSpan(lm), 1e-4);
  const avg = (sum / pairs.length) / unit;
  return clamp((avg - 0.42) / 0.85, 0, 1);
}

// Image-plane roll of the knuckle line, -1..1. A flat palm is near 0.
export function wristRoll(lm) {
  const index = lm[5];
  const pinky = lm[17];
  const ang = Math.atan2(index.y - pinky.y, pinky.x - index.x);
  const span = Math.max(handSpan(lm), 1e-4);
  const zTwist = ((index.z || 0) - (pinky.z || 0)) / span;
  return clamp(ang / (Math.PI / 2) + zTwist * 0.2, -1, 1);
}

export function defaultCal() {
  return { originX: 0.5, originY: 0.55, span: 0.16, depthSpan: 0.16 };
}

export function calibrateFromHand(lm, mirror) {
  const palm = lm[9];
  const span = Math.max(handSpan(lm), 0.04);
  const x = mirror ? (1 - palm.x) : palm.x;
  return { originX: x, originY: palm.y, span, depthSpan: span };
}

export function handToScene(lm, cal, mirror) {
  const span = Math.max(handSpan(lm), 1e-4);
  const depth = clamp((span - cal.depthSpan) / (cal.depthSpan * 0.72), -1, 1);
  const zoom = 1 + depth * 0.18;
  const palm = lm[9];
  const px = mirror ? (1 - palm.x) : palm.x;
  const nx = (px - cal.originX) / (cal.span * 1.45);
  const ny = (cal.originY - palm.y) / (cal.span * 1.45);
  const points = lm.map(p => {
    const ix = mirror ? (1 - p.x) : p.x;
    const ox = (ix - px) / cal.span;
    const oy = (palm.y - p.y) / cal.span;
    const oz = ((palm.z || 0) - (p.z || 0)) / cal.span;
    return {
      x: nx * 1.25 + ox * 0.72 * zoom,
      y: ny * 1.05 + oy * 0.72 * zoom,
      z: depth * 0.78 + oz * 0.35,
    };
  });
  return { points, depth, nx: clamp(nx, -1.4, 1.4), ny: clamp(ny, -1.4, 1.4) };
}

export function poseFromHand(lm, cal, mirror) {
  const scene = handToScene(lm, cal, mirror);
  const a = scene.points[4];
  const b = scene.points[8];
  const palm = lm[9];
  return {
    x: scene.nx,
    y: scene.ny,
    z: scene.depth,
    roll: wristRoll(lm),
    spread: fingerSpread(lm),
    pinch: pinchAmount(lm),
    point: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 },
    palm: { x: mirror ? (1 - palm.x) : palm.x, y: palm.y },
    points: scene.points,
  };
}

// Both palms in the same image. Null when either hand is missing.
export function twoHandWidth(a, b) {
  if (!a || !b) return null;
  const d = Math.hypot(a.palm.x - b.palm.x, a.palm.y - b.palm.y);
  return clamp((d - 0.06) / 0.55, 0, 1);
}

export function mapSound(def, pos) {
  const nx = clamp(pos.x / 1.2, -1, 1);
  const ny = clamp(pos.y / 1.05, -1, 1);
  const nz = clamp(pos.z / 0.8, -1, 1);
  const midi = def.midi + ny * 12;
  const hz = 440 * Math.pow(2, (midi - 69) / 12);
  const timbre = clamp(((pos.roll || 0) + 1) / 2, 0, 1);
  const cutoff = 140 * Math.pow(42, (nz + 1) / 2);
  return {
    hz, midi, pan: nx, elev: ny, cutoff, timbre,
    spread: clamp(pos.spread || 0, 0, 1),
  };
}

export function noteName(midi) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const n = Math.round(midi);
  const oct = Math.floor(n / 12) - 1;
  return names[((n % 12) + 12) % 12] + oct;
}

// One Euro filter. t is seconds. Beta 0 is a steady low-pass, which is what
// the jitter test asks for.
export function createOneEuro(minCutoff = 1.1, beta = 0.035, dCutoff = 1.0) {
  let xPrev = null;
  let dxPrev = 0;
  let tPrev = null;
  function alpha(cutoff, dt) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }
  function filter(x, t) {
    if (xPrev == null || tPrev == null) {
      xPrev = x;
      tPrev = t;
      dxPrev = 0;
      return x;
    }
    const dt = Math.max(1e-4, t - tPrev);
    const dx = (x - xPrev) / dt;
    const aD = alpha(dCutoff, dt);
    const dxHat = aD * dx + (1 - aD) * dxPrev;
    const cutoff = minCutoff + beta * Math.abs(dxHat);
    const a = alpha(cutoff, dt);
    const xHat = a * x + (1 - a) * xPrev;
    xPrev = xHat;
    dxPrev = dxHat;
    tPrev = t;
    return xHat;
  }
  filter.reset = (x, t) => {
    xPrev = x;
    tPrev = t;
    dxPrev = 0;
  };
  return filter;
}

export function createHandSmoother() {
  const slots = [null, null];
  function slotFilters() {
    const axes = [];
    for (let i = 0; i < 21; i++) {
      axes.push([createOneEuro(), createOneEuro(), createOneEuro()]);
    }
    return axes;
  }
  return function smooth(hands, t) {
    return hands.slice(0, 2).map((lm, s) => {
      if (!slots[s]) slots[s] = slotFilters();
      const fil = slots[s];
      if (lm.length !== 21) return lm;
      const prev = fil[9][0];
      if (prev && prev._seen) {
        const jump = Math.hypot((lm[9].x - (fil._px || lm[9].x)), (lm[9].y - (fil._py || lm[9].y)));
        if (jump > 0.45) {
          slots[s] = slotFilters();
        }
      }
      const use = slots[s];
      use._px = lm[9].x;
      use._py = lm[9].y;
      return lm.map((p, i) => {
        use[i][0]._seen = true;
        return {
          x: use[i][0](p.x, t),
          y: use[i][1](p.y, t),
          z: use[i][2](p.z || 0, t),
        };
      });
    });
  };
}

export function freshOrbs() {
  return ORBS.map(o => ({
    id: o.id, name: o.name, kind: o.kind, midi: o.midi, color: o.color.slice(),
    x: o.x, y: o.y, z: o.z, roll: 0, spread: 0, grabbed: false,
  }));
}

// Pinch hysteresis: grab above 0.62, release below 0.38.
export function stepGrab(state, hands, orbs, radius = 0.78) {
  const next = {
    held: state && state.held || null,
    hand: state && state.hand != null ? state.hand : null,
    orbs: orbs.map(o => Object.assign({}, o, { grabbed: false })),
  };
  if (next.held) {
    const h = hands[next.hand];
    const orb = next.orbs.find(o => o.id === next.held);
    if (!h || !orb || h.pinch < 0.38) {
      next.held = null;
      next.hand = null;
    } else {
      orb.x = h.point.x;
      orb.y = h.point.y;
      orb.z = h.point.z;
      orb.roll = h.roll;
      orb.spread = h.spread;
      orb.grabbed = true;
    }
  }
  if (!next.held) {
    let best = null;
    let bestD = radius;
    let bestI = -1;
    for (let i = 0; i < hands.length; i++) {
      const h = hands[i];
      if (!h || h.pinch < 0.62) continue;
      for (let k = 0; k < next.orbs.length; k++) {
        const o = next.orbs[k];
        const d = Math.hypot(o.x - h.point.x, o.y - h.point.y, (o.z - h.point.z) * 0.65);
        if (d < bestD) { best = o; bestD = d; bestI = i; }
      }
    }
    if (best) {
      const h = hands[bestI];
      next.held = best.id;
      next.hand = bestI;
      best.x = h.point.x;
      best.y = h.point.y;
      best.z = h.point.z;
      best.roll = h.roll;
      best.spread = h.spread;
      best.grabbed = true;
    }
  }
  return next;
}

// A 21-point hand in image space. x,y is the palm. z is depth, -1 far to 1 near.
// roll is radians. spread and pinch are 0..1 and do not fight each other.
export function synthesizeHand({ x = 0.5, y = 0.55, z = 0, roll = 0, spread = 0.2, pinch = 0 } = {}) {
  const ext = 0.25 + clamp(spread, 0, 1) * 0.75;
  const depth = clamp(z, -1, 1);
  const sc = 0.32 * (1 + depth * 0.85);
  const local = Array.from({ length: 21 }, () => [0, 0, 0]);
  local[0] = [0, -0.50, 0];
  const fingers = [
    { ids: [5, 6, 7, 8], ang: -0.46 },
    { ids: [9, 10, 11, 12], ang: -0.06 },
    { ids: [13, 14, 15, 16], ang: 0.24 },
    { ids: [17, 18, 19, 20], ang: 0.50 },
  ];
  const fan = (clamp(spread, 0, 1) - 0.25) * 0.42;
  for (let f = 0; f < fingers.length; f++) {
    const finger = fingers[f];
    const ang = finger.ang + fan * (finger.ang < 0 ? -1 : 1);
    const len = 0.195 * ext;
    for (let k = 0; k < 4; k++) {
      const along = k * len;
      const curl = (1 - ext) * 0.05 * k;
      local[finger.ids[k]] = [
        Math.sin(ang) * (0.18 + along),
        0.02 + Math.cos(ang) * along,
        -curl,
      ];
    }
  }
  const thumb = [
    [-0.20, -0.30, 0.05],
    [-0.44, -0.40, 0.06],
    [-0.64, -0.32, 0.05],
    [-0.80, -0.10, 0.03],
  ];
  const indexTip = local[8];
  const p = clamp(pinch, 0, 1);
  for (let k = 0; k < 4; k++) {
    const o = thumb[k];
    const pull = p * (0.25 + 0.75 * (k / 3));
    local[k + 1] = [
      o[0] * (1 - pull) + indexTip[0] * pull,
      o[1] * (1 - pull) + indexTip[1] * pull,
      o[2] * (1 - pull) + indexTip[2] * pull,
    ];
  }
  const cx = local[9][0];
  const cy = local[9][1];
  const c = Math.cos(roll);
  const s = Math.sin(roll);
  const out = [];
  for (let i = 0; i < 21; i++) {
    const px = local[i][0] - cx;
    const py = local[i][1] - cy;
    const rx = px * c - py * s;
    const ry = px * s + py * c;
    out.push({
      x: x + rx * sc,
      y: y - ry * sc,
      z: local[i][2] * sc - depth * 0.03,
    });
  }
  return out;
}
