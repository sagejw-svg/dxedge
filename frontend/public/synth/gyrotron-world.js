// Gyrotron world. Bodies fall around gravity wells.
//
// A collision, or a body crossing a well's spoke or ring, is a note in the
// current scale. The same seed and the same patch build the same sky. No
// clock, no Math.random, no DOM. The AudioWorklet and the tests both call
// this file. The motion is original; nothing here is taken from another program.

export const TICK = 1 / 90;
export const MAX_BODIES = 8;
export const MAX_WELLS = 4;

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  penta: [0, 2, 4, 7, 9],
  whole: [0, 2, 4, 6, 8, 10],
  chroma: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};
export const SCALE_IDS = ['major', 'minor', 'dorian', 'penta', 'whole', 'chroma', 'free'];
export const TOOLS = ['well', 'body', 'fling'];
export const ROUTES = ['self', 'filament', 'cathode', 'thyratron', 'lattice', 'gleam', 'dekatron', 'mote', 'heptode', 'geissler', 'pentagrid', 'orthicon', 'trochotron', 'rhumbatron'];

export const GYRO_CORE = {
  level: 0.84,
  seed: 1701,
  running: true,
  gravity: 0.72,
  pull: 0.15,
  drag: 0.06,
  bodyCount: 5,
  wellCount: 2,
  root: 60,
  key: 0,
  scale: 'penta',
  timbre: 0.55,
  fold: 0.28,
  decay: 0.42,
  tone: 0.64,
  space: 0.2,
  drift: 0.14,
  voices: 10,
  tool: 'well',
  route: 'self',
};

export const CORE_RANGE = {
  level: [0, 1],
  seed: [1, 999983],
  gravity: [0, 1],
  pull: [0, 1],
  drag: [0, 1],
  bodyCount: [0, 8],
  wellCount: [0, 4],
  root: [36, 84],
  key: [0, 11],
  timbre: [0, 1],
  fold: [0, 1],
  decay: [0, 1],
  tone: [0, 1],
  space: [0, 1],
  drift: [0, 1],
  voices: [4, 16],
};

const EPS = 0.02;

function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function midiToHz(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

// gene is 0..1. A named scale snaps to a degree. free keeps the fraction.
export function pitchOf(gene, root, scale, key) {
  const g = clamp(+gene || 0, 0, 1);
  const base = (root | 0) + (key | 0);
  if (scale === 'free') {
    const midi = clamp(base + (g - 0.5) * 24, 0, 127);
    return { midi, hz: midiToHz(midi), snapped: false };
  }
  const deg = SCALES[scale] || SCALES.major;
  const span = deg.length * 2;
  let idx = Math.floor(g * span);
  if (idx >= span) idx = span - 1;
  if (idx < 0) idx = 0;
  const oct = Math.floor(idx / deg.length);
  const step = deg[idx % deg.length];
  const midi = clamp(base - 12 + oct * 12 + step, 0, 127);
  return { midi, hz: midiToHz(midi), snapped: true };
}

export function GOf(patch) {
  const g = patch && patch.gravity ? +patch.gravity : 0;
  if (g <= 0) return 0;
  return 0.02 + g * 0.055;
}

export function normalizeCore(p) {
  const out = Object.assign({}, GYRO_CORE);
  if (!p || typeof p !== 'object') return out;
  const num = (k, a, b, fn) => {
    if (p[k] == null || !isFinite(+p[k])) return;
    out[k] = fn(clamp(+p[k], a, b));
  };
  num('level', 0, 1, v => v);
  num('seed', 1, 999983, v => Math.round(v));
  num('gravity', 0, 1, v => v);
  num('pull', 0, 1, v => v);
  num('drag', 0, 1, v => v);
  num('bodyCount', 0, MAX_BODIES, v => Math.round(v));
  num('wellCount', 0, MAX_WELLS, v => Math.round(v));
  num('root', 24, 96, v => Math.round(v));
  num('key', 0, 11, v => Math.round(v));
  num('timbre', 0, 1, v => v);
  num('fold', 0, 1, v => v);
  num('decay', 0, 1, v => v);
  num('tone', 0, 1, v => v);
  num('space', 0, 1, v => v);
  num('drift', 0, 1, v => v);
  num('voices', 4, 16, v => Math.round(v));
  if (SCALE_IDS.indexOf(p.scale) >= 0) out.scale = p.scale;
  if (TOOLS.indexOf(p.tool) >= 0) out.tool = p.tool;
  if (ROUTES.indexOf(p.route) >= 0) out.route = p.route;
  if (typeof p.running === 'boolean') out.running = p.running;
  else if (p.running != null) out.running = !!p.running;
  return out;
}

function sectorOf(dx, dy) {
  let s = Math.floor((Math.atan2(dy, dx) + Math.PI) / (Math.PI / 2));
  if (s < 0) s = 0;
  if (s > 3) s = 3;
  return s;
}

function makeNote(w, kind, x, y, gene, gain) {
  const p = w.patch;
  const pitched = pitchOf(gene, p.root, p.scale, p.key);
  return {
    kind,
    at: Math.round(w.time * 1e6) / 1e6,
    gene: Math.round(clamp(gene, 0, 1) * 1e6) / 1e6,
    midi: pitched.midi,
    hz: Math.round(pitched.hz * 1000) / 1000,
    pan: Math.round(clamp((x - 0.5) * 2, -1, 1) * 1000) / 1000,
    gain: Math.round(clamp(gain, 0, 1) * 1000) / 1000,
    bright: Math.round(clamp(0.22 + gene * 0.78, 0, 1) * 1000) / 1000,
    x: Math.round(x * 1000) / 1000,
    y: Math.round(y * 1000) / 1000,
  };
}

function addBody(w, g) {
  if (w.bodies.length >= MAX_BODIES) w.bodies.shift();
  const b = {
    id: w.nextId++,
    x: clamp(g.x == null ? 0.5 : +g.x, 0.04, 0.96),
    y: clamp(g.y == null ? 0.5 : +g.y, 0.04, 0.96),
    vx: clamp(g.vx == null ? 0 : +g.vx, -2.5, 2.5),
    vy: clamp(g.vy == null ? 0 : +g.vy, -2.5, 2.5),
    mass: clamp(g.mass == null ? 1 : +g.mass, 0.3, 3),
    r: clamp(g.r == null ? 0.032 : +g.r, 0.02, 0.06),
    seen: {},
  };
  w.bodies.push(b);
  return b;
}

export function createWorld(patch) {
  const p = normalizeCore(patch);
  const rnd = mulberry32(p.seed || 1);
  const w = {
    patch: p,
    time: 0,
    nextId: 1,
    bodies: [],
    wells: [],
    cool: {},
    stats: { hit: 0, cross: 0 },
    gravMul: 1,
  };
  const nWell = p.wellCount | 0;
  for (let i = 0; i < nWell; i++) {
    const ang = -Math.PI / 2 + (nWell === 1 ? 0 : i * (Math.PI * 2 / nWell)) + (rnd() - 0.5) * 0.25;
    const rad = 0.2 + rnd() * 0.05;
    w.wells.push({
      id: w.nextId++,
      x: clamp(0.5 + Math.cos(ang) * rad, 0.16, 0.84),
      y: clamp(0.48 + Math.sin(ang) * rad, 0.16, 0.84),
      mass: 0.85 + rnd() * 0.45,
      reach: 0.13 + rnd() * 0.07,
    });
  }
  const nBody = p.bodyCount | 0;
  const pair = Math.min(2, nBody);
  if (pair >= 1) {
    const j = (rnd() - 0.5) * 0.016;
    addBody(w, {
      x: 0.43 + j, y: 0.5 + (rnd() - 0.5) * 0.018,
      vx: 0.42, vy: (rnd() - 0.5) * 0.03, mass: 1, r: 0.034,
    });
  }
  if (pair >= 2) {
    const j = (rnd() - 0.5) * 0.016;
    addBody(w, {
      x: 0.57 + j, y: 0.5 + (rnd() - 0.5) * 0.018,
      vx: -0.42, vy: (rnd() - 0.5) * 0.03, mass: 1, r: 0.034,
    });
  }
  for (let i = pair; i < nBody; i++) {
    const well = w.wells.length ? w.wells[i % w.wells.length] : { x: 0.5, y: 0.42, mass: 1, reach: 0.16 };
    const ang = rnd() * Math.PI * 2;
    const rad = 0.11 + rnd() * 0.09;
    const x = clamp(well.x + Math.cos(ang) * rad, 0.08, 0.92);
    const y = clamp(well.y + Math.sin(ang) * rad, 0.08, 0.92);
    const G = GOf(p);
    const speed = G > 0 ? Math.sqrt(G * well.mass / Math.max(0.08, rad)) : 0.22;
    const dir = rnd() < 0.5 ? 1 : -1;
    addBody(w, {
      x, y,
      vx: -Math.sin(ang) * speed * dir,
      vy: Math.cos(ang) * speed * dir,
      mass: 0.7 + rnd() * 0.6,
      r: 0.026 + rnd() * 0.012,
    });
  }
  return w;
}

function resolveHit(a, b) {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  const d2 = dx * dx + dy * dy;
  const min = a.r + b.r;
  if (d2 >= min * min || d2 < 1e-12) return null;
  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  const push = (min - d) * 0.5 + 1e-4;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  if (rel >= 0) return null;
  const e = 0.88;
  const inv = 1 / a.mass + 1 / b.mass;
  const j = -(1 + e) * rel / inv;
  a.vx -= (j / a.mass) * nx;
  a.vy -= (j / a.mass) * ny;
  b.vx += (j / b.mass) * nx;
  b.vy += (j / b.mass) * ny;
  return -rel;
}

export function stepWorld(w) {
  const dt = TICK;
  const p = w.patch;
  const mul = w.gravMul == null ? 1 : w.gravMul;
  const G = GOf(p) * mul;
  const pull = (p.pull || 0) * 0.018 * mul;
  const damp = Math.exp(-(p.drag || 0) * 0.45 * dt);
  w.time += dt;
  const notes = [];
  const bodies = w.bodies;
  const wells = w.wells;
  const n = bodies.length;

  for (let i = 0; i < n; i++) {
    const b = bodies[i];
    let ax = 0;
    let ay = 0;
    for (let k = 0; k < wells.length; k++) {
      const well = wells[k];
      const dx = well.x - b.x;
      const dy = well.y - b.y;
      const d2 = dx * dx + dy * dy + EPS;
      const d = Math.sqrt(d2);
      const inv = G * well.mass / d2;
      ax += inv * dx / d;
      ay += inv * dy / d;
    }
    if (pull > 0) {
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const o = bodies[j];
        const dx = o.x - b.x;
        const dy = o.y - b.y;
        const d2 = dx * dx + dy * dy + EPS;
        const d = Math.sqrt(d2);
        const inv = pull * o.mass / d2;
        ax += inv * dx / d;
        ay += inv * dy / d;
      }
    }
    b.vx = (b.vx + ax * dt) * damp;
    b.vy = (b.vy + ay * dt) * damp;
  }
  for (let i = 0; i < n; i++) {
    const b = bodies[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < b.r) { b.x = b.r; if (b.vx < 0) b.vx *= -0.86; }
    else if (b.x > 1 - b.r) { b.x = 1 - b.r; if (b.vx > 0) b.vx *= -0.86; }
    if (b.y < b.r) { b.y = b.r; if (b.vy < 0) b.vy *= -0.86; }
    else if (b.y > 1 - b.r) { b.y = 1 - b.r; if (b.vy > 0) b.vy *= -0.86; }
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const speed = resolveHit(bodies[i], bodies[j]);
      if (speed == null) continue;
      const key = bodies[i].id + ':' + bodies[j].id;
      if (w.cool[key] && w.time < w.cool[key]) continue;
      w.cool[key] = w.time + 0.09;
      w.stats.hit += 1;
      if (notes.length < 8) {
        notes.push(makeNote(
          w, 'hit',
          (bodies[i].x + bodies[j].x) * 0.5,
          (bodies[i].y + bodies[j].y) * 0.5,
          clamp(speed / 1.15, 0, 1),
          0.58 + Math.min(0.4, speed * 0.28),
        ));
      }
    }
  }

  for (let i = 0; i < n; i++) {
    const b = bodies[i];
    for (let k = 0; k < wells.length; k++) {
      const well = wells[k];
      const dx = b.x - well.x;
      const dy = b.y - well.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const sec = sectorOf(dx, dy);
      const side = dist >= well.reach ? 1 : -1;
      const prev = b.seen[well.id];
      if (!prev) {
        b.seen[well.id] = { sec, side };
        continue;
      }
      const spoke = prev.sec !== sec;
      const ring = prev.side !== side;
      prev.sec = sec;
      prev.side = side;
      if (!spoke && !ring) continue;
      if (!ring && dist > well.reach * 2.5) continue;
      const key = 'c' + b.id + ':' + well.id;
      if (w.cool[key] && w.time < w.cool[key]) continue;
      w.cool[key] = w.time + 0.07;
      w.stats.cross += 1;
      if (notes.length < 8) notes.push(makeNote(w, 'cross', b.x, b.y, clamp(1 - dist / 0.5, 0, 1), 0.4 + clamp(1 - dist / 0.5, 0, 1) * 0.35));
    }
  }
  return notes;
}

export function applyGesture(w, g) {
  if (!w || !g || !g.t) return null;
  if (g.t === 'well') {
    const x = clamp(+g.x || 0.5, 0.05, 0.95);
    const y = clamp(+g.y || 0.5, 0.05, 0.95);
    for (let i = 0; i < w.wells.length; i++) {
      const well = w.wells[i];
      const dx = well.x - x;
      const dy = well.y - y;
      if (dx * dx + dy * dy < 0.0036) {
        w.wells.splice(i, 1);
        return { op: 'remove', wells: w.wells.length };
      }
    }
    if (w.wells.length >= MAX_WELLS) w.wells.shift();
    w.wells.push({
      id: w.nextId++,
      x, y,
      mass: g.mass == null ? 1 : clamp(+g.mass, 0.2, 3),
      reach: g.reach == null ? 0.18 : clamp(+g.reach, 0.06, 0.4),
    });
    return { op: 'add', wells: w.wells.length };
  }
  if (g.t === 'body') {
    const b = addBody(w, g);
    return { op: 'body', id: b.id, bodies: w.bodies.length };
  }
  if (g.t === 'fling') {
    const x = clamp(g.x == null ? 0.5 : +g.x, 0.02, 0.98);
    const y = clamp(g.y == null ? 0.5 : +g.y, 0.02, 0.98);
    const vx = clamp(g.vx == null ? 0 : +g.vx, -2.5, 2.5);
    const vy = clamp(g.vy == null ? 0 : +g.vy, -2.5, 2.5);
    let best = null;
    let bd = 0.18 * 0.18;
    for (let i = 0; i < w.bodies.length; i++) {
      const b = w.bodies[i];
      const dx = b.x - x;
      const dy = b.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= bd) { bd = d2; best = b; }
    }
    if (!best) best = addBody(w, { x, y, vx: 0, vy: 0 });
    best.vx = vx;
    best.vy = vy;
    return { op: 'fling', id: best.id, vx, vy };
  }
  return null;
}

function snapshot(w, events) {
  return {
    bodies: w.bodies.map(b => [
      Math.round(b.x * 1e6) / 1e6,
      Math.round(b.y * 1e6) / 1e6,
      Math.round(b.vx * 1e6) / 1e6,
      Math.round(b.vy * 1e6) / 1e6,
    ]),
    wells: w.wells.map(well => [Math.round(well.x * 1e6) / 1e6, Math.round(well.y * 1e6) / 1e6]),
    events,
    stats: { hit: w.stats.hit, cross: w.stats.cross },
    time: Math.round(w.time * 1e6) / 1e6,
  };
}

export function runWorld(patch, seconds) {
  const w = createWorld(patch);
  const events = [];
  const steps = Math.max(1, Math.round((seconds || 1) / TICK));
  for (let i = 0; i < steps; i++) {
    const batch = stepWorld(w);
    for (let k = 0; k < batch.length; k++) events.push(batch[k]);
  }
  return snapshot(w, events);
}

export function runScript(patch, gestures, seconds) {
  const base = normalizeCore(Object.assign({}, patch, { bodyCount: 0, wellCount: 0 }));
  const w = createWorld(base);
  w.bodies.length = 0;
  w.wells.length = 0;
  (gestures || []).forEach(g => applyGesture(w, g));
  const events = [];
  const steps = Math.max(1, Math.round((seconds || 1) / TICK));
  for (let i = 0; i < steps; i++) {
    const batch = stepWorld(w);
    for (let k = 0; k < batch.length; k++) events.push(batch[k]);
  }
  return snapshot(w, events);
}
