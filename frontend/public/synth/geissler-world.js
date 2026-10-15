// Geissler world. A deterministic 2D field of creatures.
//
// Plants (Reed) hum, grazers pluck, predators (Stalk) play bass and a short
// noise hit, pollinators (Flicker) chirp a short motif. Notes are scheduled
// only when something happens: a meeting, a meal, a birth, or a death.
// The same seed and the same patch always produce the same world. No clock,
// no Math.random, no DOM. The AudioWorklet and the tests both call this file.

export const SPECIES = ['reed', 'graze', 'stalk', 'flicker'];
export const SPECIES_NAME = { reed: 'Reed', graze: 'Graze', stalk: 'Stalk', flicker: 'Flicker' };
export const SPECIES_ROLE = { reed: 'plant', graze: 'grazer', stalk: 'predator', flicker: 'pollinator' };

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  penta: [0, 2, 4, 7, 9],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  chroma: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};
export const SCALE_IDS = ['major', 'minor', 'penta', 'dorian', 'chroma', 'season', 'free'];
export const GRID_IDS = ['free', '4', '8', '16'];
export const TOOLS = ['food', 'spawn', 'herd'];
export const ROUTES = ['self', 'filament', 'cathode', 'thyratron', 'lattice', 'gleam', 'dekatron', 'mote', 'heptode', 'pentagrid', 'orthicon', 'trochotron', 'gyrotron', 'phantastron'];

export const TICK = 1 / 30;

const SPAN = { reed: 10, graze: 14, stalk: 10, flicker: 16 };
const BASE = { reed: -12, graze: 0, stalk: -24, flicker: 12 };
const SPEED = { reed: 0.045, graze: 0.16, stalk: 0.22, flicker: 0.3 };
const MEET = 0.11;
const BITE = 0.065;
const EAT = 0.07;

export const GEISSLER_CORE = {
  level: 0.82,
  seed: 1701,
  running: true,
  cap: 16,
  capReed: 6,
  capGraze: 6,
  capStalk: 4,
  capFlicker: 6,
  birth: 0.62,
  death: 0.28,
  mutation: 0.16,
  food: 0.7,
  season: 36,
  root: 60,
  scale: 'penta',
  grid: '8',
  tempo: 108,
  follow: true,
  voices: 12,
  tool: 'food',
  spawn: 'graze',
  routeReed: 'self',
  routeGraze: 'self',
  routeStalk: 'self',
  routeFlicker: 'self',
};

export const CORE_RANGE = {
  level: [0, 1],
  seed: [1, 999983],
  cap: [1, 36],
  capReed: [0, 12],
  capGraze: [0, 12],
  capStalk: [0, 12],
  capFlicker: [0, 12],
  birth: [0, 1],
  death: [0, 1],
  mutation: [0, 1],
  food: [0, 1],
  season: [4, 120],
  root: [36, 84],
  tempo: [40, 240],
  voices: [4, 16],
};

function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
function pick(list, value, fallback) { return list.includes(value) ? value : fallback; }

export function normalizeCore(p) {
  const s = p && typeof p === 'object' ? p : {};
  const out = Object.assign({}, GEISSLER_CORE);
  Object.keys(CORE_RANGE).forEach(k => {
    if (s[k] == null || !isFinite(+s[k])) return;
    out[k] = clamp(+s[k], CORE_RANGE[k][0], CORE_RANGE[k][1]);
  });
  out.seed = Math.round(out.seed);
  out.cap = Math.round(out.cap);
  out.capReed = Math.round(out.capReed);
  out.capGraze = Math.round(out.capGraze);
  out.capStalk = Math.round(out.capStalk);
  out.capFlicker = Math.round(out.capFlicker);
  out.root = Math.round(out.root);
  out.tempo = Math.round(out.tempo);
  out.voices = Math.round(out.voices);
  out.season = Math.round(out.season);
  if (s.running != null) out.running = !!s.running;
  if (s.follow != null) out.follow = !!s.follow;
  out.scale = pick(SCALE_IDS, s.scale, out.scale);
  out.grid = pick(GRID_IDS, s.grid, out.grid);
  out.tool = pick(TOOLS, s.tool, out.tool);
  out.spawn = pick(SPECIES, s.spawn, out.spawn);
  out.routeReed = pick(ROUTES, s.routeReed, out.routeReed);
  out.routeGraze = pick(ROUTES, s.routeGraze, out.routeGraze);
  out.routeStalk = pick(ROUTES, s.routeStalk, out.routeStalk);
  out.routeFlicker = pick(ROUTES, s.routeFlicker, out.routeFlicker);
  return out;
}

export function makeRng(seed) {
  let x = (seed >>> 0) || 1;
  return function rng() {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x / 4294967296;
  };
}

export function midiToHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

export function seasonOf(time, seasonSec) {
  const sec = Math.max(2, +seasonSec || 36);
  const phase = ((time % sec) + sec) % sec / sec;
  const mood = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
  const keyShift = Math.round(Math.sin(phase * Math.PI * 2) * 5);
  let name = 'Spring';
  if (phase >= 0.25 && phase < 0.5) name = 'Summer';
  else if (phase >= 0.5 && phase < 0.75) name = 'Autumn';
  else if (phase >= 0.75) name = 'Winter';
  return { phase, mood, keyShift, name };
}

export function scaleNow(patch, mood) {
  if (patch.scale === 'free') return 'free';
  if (patch.scale !== 'season') return patch.scale;
  if (mood < 0.34) return 'minor';
  if (mood < 0.67) return 'dorian';
  return 'major';
}

export function midiOf(gene, species, root, scale, keyShift) {
  const g = clamp(+gene || 0, 0, 1);
  const target = root + keyShift + BASE[species] + g * SPAN[species];
  if (scale === 'free') {
    const exact = clamp(target, 24, 108);
    return { midi: Math.round(exact), hz: midiToHz(exact), snapped: false };
  }
  const steps = SCALES[scale] || SCALES.penta;
  const center = root + keyShift;
  let best = 60;
  let bestD = 1e9;
  for (let oct = -3; oct <= 4; oct++) {
    for (let i = 0; i < steps.length; i++) {
      const m = center + oct * 12 + steps[i];
      const d = Math.abs(m - target);
      if (d < bestD) { bestD = d; best = m; }
    }
  }
  best = clamp(best, 24, 108);
  return { midi: best, hz: midiToHz(best), snapped: true };
}

export function quantizeTime(time, tempo, grid) {
  if (grid === 'free') return time;
  const beat = 60 / clamp(+tempo || 120, 40, 240);
  const div = grid === '4' ? 1 : grid === '16' ? 0.25 : 0.5;
  const step = beat * div;
  if (!(step > 0)) return time;
  return Math.ceil((time - 1e-12) / step) * step;
}

export function durationOf(species, rhythm, tempo, grid, kind) {
  const beat = 60 / clamp(+tempo || 120, 40, 240);
  const r = clamp(+rhythm || 0, 0, 1);
  let beats = 0.4;
  if (kind === 'die') beats = 1.1 + r * 0.6;
  else if (species === 'reed') beats = 1.4 + r * 2.4;
  else if (species === 'graze') beats = 0.2 + r * 0.45;
  else if (species === 'stalk') beats = 0.16 + r * 0.4;
  else beats = 0.45 + r * 0.7;
  if (grid === 'free') return beats * beat;
  const div = grid === '4' ? 1 : grid === '16' ? 0.25 : 0.5;
  const steps = Math.max(1, Math.round(beats / div));
  return steps * div * beat;
}

export function blendGene(a, b, mutation, rng) {
  const span = clamp(+mutation || 0, 0, 1) * 0.5;
  let g = (clamp(a, 0, 1) + clamp(b, 0, 1)) * 0.5;
  if (span > 0) g += (rng() * 2 - 1) * span;
  if (g < 0) g = 0;
  if (g > 1) g = 1;
  return g;
}

function capOf(patch, species) {
  if (species === 'reed') return patch.capReed;
  if (species === 'graze') return patch.capGraze;
  if (species === 'stalk') return patch.capStalk;
  return patch.capFlicker;
}

function countOf(world, species) {
  let n = 0;
  const list = world.creatures;
  for (let i = 0; i < list.length; i++) if (list[i].species === species) n++;
  return n;
}

function routeOf(patch, species) {
  if (species === 'reed') return patch.routeReed;
  if (species === 'graze') return patch.routeGraze;
  if (species === 'stalk') return patch.routeStalk;
  return patch.routeFlicker;
}

function pushCreature(world, species, x, y, pitch, rhythm, energy, size) {
  const patch = world.patch;
  if (world.creatures.length >= patch.cap || world.creatures.length >= 48) return null;
  if (countOf(world, species) >= capOf(patch, species)) return null;
  const c = {
    id: world.nextId++,
    species,
    x: clamp(x, 0.03, 0.97),
    y: clamp(y, 0.03, 0.97),
    vx: 0,
    vy: 0,
    size: clamp(size, 0.35, 1.15),
    energy: clamp(energy, 0.05, 1),
    pitch: clamp(pitch, 0, 1),
    rhythm: clamp(rhythm, 0, 1),
    coolMeet: 0,
    coolBreed: 0,
    coolEat: 0,
    dead: false,
  };
  world.creatures.push(c);
  if (world.creatures.length > world.popMax) world.popMax = world.creatures.length;
  return c;
}

const HOME = {
  reed: [[0.30, 0.34], [0.37, 0.30], [0.72, 0.70]],
  graze: [[0.50, 0.50], [0.24, 0.60], [0.29, 0.64]],
  stalk: [[0.53, 0.51], [0.78, 0.22]],
  flicker: [[0.34, 0.38], [0.68, 0.42], [0.42, 0.74]],
};

export function createWorld(patch) {
  const p = normalizeCore(patch);
  const rng = makeRng(p.seed);
  const world = {
    patch: p,
    rng,
    tick: 0,
    time: 0,
    nextId: 1,
    creatures: [],
    food: [],
    herd: { on: false, x: 0.5, y: 0.5 },
    popMax: 0,
    events: [],
    seq: 1,
    stats: { meet: 0, eat: 0, breed: 0, die: 0 },
    tempo: p.tempo,
  };
  SPECIES.forEach(species => {
    const homes = HOME[species];
    const want = species === 'stalk' ? 2 : 3;
    for (let i = 0; i < want; i++) {
      const home = homes[i % homes.length];
      const jx = (rng() * 2 - 1) * 0.012;
      const jy = (rng() * 2 - 1) * 0.012;
      pushCreature(world, species, home[0] + jx, home[1] + jy, rng(), rng(), 0.62 + rng() * 0.28, 0.55 + rng() * 0.35);
    }
  });
  const pellets = p.food <= 0.01 ? 0 : 6;
  for (let i = 0; i < pellets; i++) {
    world.food.push({ id: world.nextId++, x: 0.12 + rng() * 0.76, y: 0.12 + rng() * 0.76, amount: 0.55 + rng() * 0.4 });
  }
  // A pellet under the second grazer so a meal is available at once.
  if (pellets) world.food.push({ id: world.nextId++, x: 0.25, y: 0.61, amount: 0.9 });
  world.popMax = world.creatures.length;
  return world;
}

export function setWorldPatch(world, patch, tempo) {
  world.patch = normalizeCore(patch);
  if (tempo != null && isFinite(+tempo)) world.tempo = clamp(Math.round(+tempo), 40, 240);
}

export function applyGesture(world, g) {
  if (!g || !world) return;
  if (g.t === 'food') {
    if (world.food.length >= 24) return;
    world.food.push({
      id: world.nextId++,
      x: clamp(+g.x || 0.5, 0.02, 0.98),
      y: clamp(+g.y || 0.5, 0.02, 0.98),
      amount: 0.85,
    });
    return;
  }
  if (g.t === 'spawn') {
    const species = SPECIES.includes(g.species) ? g.species : world.patch.spawn;
    pushCreature(world, species, +g.x || 0.5, +g.y || 0.5, world.rng(), world.rng(), 0.75, 0.7);
    return;
  }
  if (g.t === 'herd') {
    world.herd.on = !!g.on;
    if (g.x != null) world.herd.x = clamp(+g.x, 0, 1);
    if (g.y != null) world.herd.y = clamp(+g.y, 0, 1);
  }
}

function nearest(list, x, y, pred) {
  let best = null;
  let bestD = 1e9;
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (pred && !pred(item)) continue;
    const dx = item.x - x;
    const dy = item.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = item; }
  }
  return best;
}

function noteFor(world, creature, kind, extra) {
  const patch = world.patch;
  const season = seasonOf(world.time, patch.season);
  const scale = scaleNow(patch, season.mood);
  const pitch = extra && extra.pitch != null ? extra.pitch : creature.pitch;
  const rhythm = extra && extra.rhythm != null ? extra.rhythm : creature.rhythm;
  const q = midiOf(pitch, creature.species, patch.root, scale, season.keyShift);
  const at = quantizeTime(world.time, world.tempo || patch.tempo, patch.grid);
  const motif = [];
  if (creature.species === 'flicker' && kind !== 'die') {
    const n = 2 + Math.floor(clamp(rhythm, 0, 0.999) * 3);
    for (let i = 0; i < n; i++) {
      const g = (pitch + 0.17 * (i + 1) + rhythm * 0.13) % 1;
      const step = midiOf(g, 'flicker', patch.root, scale, season.keyShift);
      motif.push({ midi: step.midi, hz: step.hz });
    }
  }
  const ev = {
    t: 'note',
    seq: world.seq++,
    kind,
    species: creature.species,
    id: creature.id,
    at,
    midi: q.midi,
    hz: q.hz,
    pan: clamp((creature.x - 0.5) * 2, -1, 1),
    gain: clamp(0.28 + 0.72 * (creature.size / 1.15), 0.15, 1),
    bright: clamp(creature.energy, 0, 1),
    dur: durationOf(creature.species, rhythm, world.tempo || patch.tempo, patch.grid, kind),
    rhythm,
    pitch,
    route: routeOf(patch, creature.species),
    motif,
    season: season.name,
    keyShift: season.keyShift,
    scale,
  };
  if (extra && extra.childPitch != null) {
    ev.childPitch = extra.childPitch;
    ev.childRhythm = extra.childRhythm;
    ev.parentPitch = extra.parentPitch;
    ev.parentRhythm = extra.parentRhythm;
  }
  world.stats[kind] += 1;
  if (world.events.length < 800) world.events.push(ev);
  return ev;
}

function drain(species, death, mood) {
  const base = species === 'reed' ? 0.055 : species === 'graze' ? 0.16 : species === 'stalk' ? 0.2 : 0.15;
  let v = death * base;
  if (species === 'reed') v -= mood * 0.03;
  return v;
}

export function stepWorld(world) {
  const patch = world.patch;
  const rng = world.rng;
  const out = [];
  world.tick += 1;
  world.time = world.tick * TICK;
  const season = seasonOf(world.time, patch.season);
  const list = world.creatures;

  if (patch.food > 0.01 && world.food.length < 4 + Math.round(patch.food * 8) && rng() < patch.food * TICK * 1.4) {
    world.food.push({ id: world.nextId++, x: 0.08 + rng() * 0.84, y: 0.08 + rng() * 0.84, amount: 0.35 });
  }
  for (let i = 0; i < world.food.length; i++) {
    const f = world.food[i];
    f.amount = Math.min(1, f.amount + patch.food * TICK * 0.08);
  }

  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    c.coolMeet = Math.max(0, c.coolMeet - TICK);
    c.coolBreed = Math.max(0, c.coolBreed - TICK);
    c.coolEat = Math.max(0, c.coolEat - TICK);
    let ax = (rng() * 2 - 1) * SPEED[c.species] * 0.35;
    let ay = (rng() * 2 - 1) * SPEED[c.species] * 0.35;
    if (c.species === 'graze') {
      const food = nearest(world.food, c.x, c.y, f => f.amount > 0.08);
      if (food) { ax += (food.x - c.x) * 1.4; ay += (food.y - c.y) * 1.4; }
    } else if (c.species === 'stalk') {
      const prey = nearest(list, c.x, c.y, o => o.species === 'graze' && !o.dead && o !== c);
      if (prey) { ax += (prey.x - c.x) * 1.8; ay += (prey.y - c.y) * 1.8; }
    } else if (c.species === 'flicker') {
      const plant = nearest(list, c.x, c.y, o => o.species === 'reed' && !o.dead);
      if (plant) { ax += (plant.x - c.x) * 1.3; ay += (plant.y - c.y) * 1.3; }
    }
    if (world.herd.on) {
      const dx = world.herd.x - c.x;
      const dy = world.herd.y - c.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 0.55) { ax += (dx / d) * 0.85; ay += (dy / d) * 0.85; }
    }
    const spd = SPEED[c.species];
    c.vx = c.vx * 0.82 + ax * 0.18;
    c.vy = c.vy * 0.82 + ay * 0.18;
    const mag = Math.hypot(c.vx, c.vy);
    if (mag > spd) { c.vx = c.vx / mag * spd; c.vy = c.vy / mag * spd; }
    c.x += c.vx * TICK * 3.2;
    c.y += c.vy * TICK * 3.2;
    if (c.x < 0.03) { c.x = 0.03; c.vx = Math.abs(c.vx); }
    if (c.x > 0.97) { c.x = 0.97; c.vx = -Math.abs(c.vx); }
    if (c.y < 0.03) { c.y = 0.03; c.vy = Math.abs(c.vy); }
    if (c.y > 0.97) { c.y = 0.97; c.vy = -Math.abs(c.vy); }
    c.energy -= drain(c.species, patch.death, season.mood) * TICK;
    if (c.energy > 1) c.energy = 1;
  }

  const n0 = list.length;
  for (let i = 0; i < n0; i++) {
    const a = list[i];
    if (a.dead) continue;
    for (let j = i + 1; j < n0; j++) {
      const b = list[j];
      if (b.dead) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist > MEET) continue;
      const same = a.species === b.species;
      const ready = a.coolBreed <= 0 && b.coolBreed <= 0 && a.energy > 0.6 && b.energy > 0.6;
      if (same && ready && rng() < patch.birth * 0.85 && world.creatures.length < patch.cap && countOf(world, a.species) < capOf(patch, a.species)) {
        const childPitch = blendGene(a.pitch, b.pitch, patch.mutation, rng);
        const childRhythm = blendGene(a.rhythm, b.rhythm, patch.mutation, rng);
        const child = pushCreature(world, a.species, (a.x + b.x) / 2, (a.y + b.y) / 2, childPitch, childRhythm, 0.58, (a.size + b.size) / 2);
        a.energy -= 0.12;
        b.energy -= 0.12;
        a.coolBreed = 2.4;
        b.coolBreed = 2.4;
        a.coolMeet = 0.7;
        b.coolMeet = 0.7;
        if (child) {
          out.push(noteFor(world, child, 'breed', {
            pitch: childPitch,
            rhythm: childRhythm,
            childPitch,
            childRhythm,
            parentPitch: [a.pitch, b.pitch],
            parentRhythm: [a.rhythm, b.rhythm],
          }));
        }
        continue;
      }
      if (a.coolMeet <= 0 && b.coolMeet <= 0) {
        a.coolMeet = 0.65;
        b.coolMeet = 0.65;
        if (a.species === 'flicker' && b.species === 'reed') b.energy = Math.min(1, b.energy + 0.05);
        if (b.species === 'flicker' && a.species === 'reed') a.energy = Math.min(1, a.energy + 0.05);
        out.push(noteFor(world, a, 'meet'));
        if (a.species !== b.species) out.push(noteFor(world, b, 'meet'));
      }
    }
  }

  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c.dead || c.coolEat > 0) continue;
    if (c.species === 'graze' || c.species === 'reed' || c.species === 'flicker') {
      let best = -1;
      let bestD = EAT * EAT;
      for (let f = 0; f < world.food.length; f++) {
        const food = world.food[f];
        if (food.amount <= 0.05) continue;
        const d = (food.x - c.x) * (food.x - c.x) + (food.y - c.y) * (food.y - c.y);
        if (d < bestD) { bestD = d; best = f; }
      }
      if (best >= 0) {
        const bite = c.species === 'graze' ? 0.42 : 0.18;
        world.food[best].amount -= bite;
        c.energy = Math.min(1, c.energy + (c.species === 'graze' ? 0.22 : 0.08));
        c.coolEat = c.species === 'graze' ? 0.28 : 0.7;
        out.push(noteFor(world, c, 'eat'));
      }
    }
    if (c.species === 'stalk') {
      let prey = null;
      let bestD = BITE * BITE;
      for (let j = 0; j < list.length; j++) {
        const g = list[j];
        if (g.species !== 'graze' || g.dead) continue;
        const d = (g.x - c.x) * (g.x - c.x) + (g.y - c.y) * (g.y - c.y);
        if (d < bestD) { bestD = d; prey = g; }
      }
      if (prey) {
        prey.energy -= 0.48;
        c.energy = Math.min(1, c.energy + 0.16);
        c.coolEat = 0.34;
        out.push(noteFor(world, c, 'eat'));
      }
    }
  }

  for (let i = world.food.length - 1; i >= 0; i--) if (world.food[i].amount <= 0.05) world.food.splice(i, 1);

  const alive = [];
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c.energy <= 0 || c.dead) {
      c.dead = true;
      out.push(noteFor(world, c, 'die'));
    } else alive.push(c);
  }
  world.creatures = alive;
  if (world.creatures.length > world.popMax) world.popMax = world.creatures.length;
  return out;
}

export function runWorld(patch, seconds, gestures) {
  const world = createWorld(patch);
  const pending = (gestures || []).slice().sort((a, b) => (a.at || 0) - (b.at || 0));
  let gi = 0;
  const steps = Math.max(0, Math.round((+seconds || 0) / TICK));
  const notes = [];
  for (let i = 0; i < steps; i++) {
    const t = (i + 1) * TICK;
    while (gi < pending.length && (pending[gi].at || 0) <= t) applyGesture(world, pending[gi++]);
    if (world.patch.running !== false) {
      const batch = stepWorld(world);
      for (let k = 0; k < batch.length; k++) notes.push(batch[k]);
    }
  }
  return { world, notes };
}

export function worldSummary(world, notes) {
  const counts = { reed: 0, graze: 0, stalk: 0, flicker: 0 };
  world.creatures.forEach(c => { counts[c.species] += 1; });
  const season = seasonOf(world.time, world.patch.season);
  return {
    time: world.time,
    pop: world.creatures.length,
    popMax: world.popMax,
    counts,
    food: world.food.length,
    stats: Object.assign({}, world.stats),
    herd: { on: world.herd.on, x: world.herd.x, y: world.herd.y },
    season: season.name,
    mood: season.mood,
    keyShift: season.keyShift,
    creatures: world.creatures.map(c => ({
      id: c.id, species: c.species, x: +c.x.toFixed(5), y: +c.y.toFixed(5),
      size: +c.size.toFixed(4), energy: +c.energy.toFixed(4),
      pitch: +c.pitch.toFixed(6), rhythm: +c.rhythm.toFixed(6),
    })),
    events: (notes || world.events).slice(0, 400).map(e => ({
      kind: e.kind, species: e.species, at: +e.at.toFixed(6), midi: e.midi,
      hz: +e.hz.toFixed(3), pan: +e.pan.toFixed(4), gain: +e.gain.toFixed(4),
      bright: +e.bright.toFixed(4), pitch: e.pitch, rhythm: e.rhythm,
      childPitch: e.childPitch, childRhythm: e.childRhythm,
      parentPitch: e.parentPitch, parentRhythm: e.parentRhythm,
      route: e.route, scale: e.scale, keyShift: e.keyShift, dur: +e.dur.toFixed(4),
    })),
  };
}
