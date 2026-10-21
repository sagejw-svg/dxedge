/* Delve engine.
 *
 * A grid dungeon with a party of four. Movement is four-way, like a
 * first-person crawler: forward, back, turn, and strafe. Combat, spells,
 * and monsters run on timers so the crawl is real-time.
 *
 * Maps are built from a 4x4 lattice of rooms. A spanning tree keeps a
 * path from the stairs to the exit. Locked doors and gates sit only on
 * extra corridors, so a key or a lever is never required to go deeper.
 *
 * No third-party code. The page draws its own pictures and makes its own
 * sounds. Nothing here is taken from Dungeon Master.
 */

export const TILE = {
  WALL: 0,
  FLOOR: 1,
  LOCKED: 2,
  GATE: 3,
  STAIRS_UP: 4,
  STAIRS_DOWN: 5,
  GATE_OPEN: 6,
  DOOR_OPEN: 7,
};

export const COLS = 4;
export const ROWS = 4;
export const CELL = 8;
export const MAP = COLS * CELL + 1; // 33
export const FLOORS = 7;
export const SAVE_V = 2;
/** Display floor 5. The Warden stands on the stair and does not end the delve. */
const WARDEN_FLOOR = 4;
export const SAVE_KEY = 'dxedge_delve_save';
export const DIFF_KEY = 'dxedge_delve_difficulty';

export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
export const FACING_NAME = ['north', 'east', 'south', 'west'];

export const FLOOR_NAMES = [
  'The Cinder Gate',
  'Ash Galleries',
  'The Low Vault',
  'Ember Crypt',
  "The Warden's Hall",
  'The Black Stair',
  'The Seal',
];

/** crypt, cave, flooded halls, lava forge. The waystation between floors is camp. */
export const FLOOR_THEMES = ['crypt', 'cave', 'flood', 'crypt', 'forge', 'cave', 'forge'];

export const HUB_ENTRY = { x: 14, y: 16 };
export const HUB_GATE = { x: 20, y: 16 };

const QUEST_DEFS = {
  'story-0': { kind: 'main', title: 'The Cinder Gate', detail: 'Take the first stair. A waystation waits between floors.', xp: 8, gold: 4 },
  'story-1': { kind: 'main', title: 'Through the ash', detail: 'Leave the ash galleries by the stair.', xp: 10, gold: 6 },
  'story-2': { kind: 'main', title: 'The low water', detail: 'Cross the flooded halls and take the stair.', xp: 12, gold: 8 },
  'story-3': { kind: 'main', title: 'Names in the crypt', detail: 'The crypt stair leads toward the warden.', xp: 12, gold: 8 },
  'story-4': { kind: 'main', title: 'The Warden', detail: 'The warden stands on the fifth stair. Fell them.', xp: 24, gold: 0 },
  'story-5': { kind: 'main', title: 'The black stair', detail: 'Descend the black stair. The seal is below.', xp: 14, gold: 10 },
  'story-6': { kind: 'main', title: 'Break the seal', detail: 'The last guardian is the seal.', xp: 30, gold: 0 },
  rescue: { kind: 'side', title: 'A lost lantern', detail: 'Pell is turned around in the ash galleries. Speak with them.', xp: 14, gold: 12, item: { type: 'armor', name: "traveler's wrap", def: 2 } },
  fetch: { kind: 'side', title: "Sable's shard", detail: 'Find the ember shard in the low vault and bring it to Sable at the waystation.', xp: 16, gold: 10, item: { type: 'weapon', name: 'shard knife', atk: 4 } },
  lair: { kind: 'side', title: 'The bone nest', detail: 'A nest holds a side room of the crypt. Clear it.', xp: 18, gold: 14, item: { type: 'weapon', name: 'nest spike', atk: 3 } },
  hidden: { kind: 'side', title: 'The cracked wall', detail: 'A niche is cut into the black stair. Step into it.', xp: 12, gold: 16 },
};

const DIFF = {
  easy:   { hp: 0.75, dmg: 0.7,  count: 0.6,  pace: 1.3,  potions: 0.5,  party: 1.12, startPots: 2 },
  normal: { hp: 1,    dmg: 1,    count: 1,    pace: 1,    potions: 0.32, party: 1,    startPots: 1 },
  hard:   { hp: 1.45, dmg: 1.35, count: 1.4,  pace: 0.75, potions: 0.18, party: 0.9,  startPots: 0 },
};

export const SPELLS = [
  { id: 'kael', name: 'Kael', cost: 8,  blurb: 'Fire along the facing corridor.' },
  { id: 'sera', name: 'Sera', cost: 8,  blurb: 'Mend the most hurt champion, or raise one who has fallen.' },
  { id: 'veth', name: 'Veth', cost: 6,  blurb: 'A ward that dulls the next blows.' },
  { id: 'orin', name: 'Orin', cost: 4,  blurb: 'Gleam. The lantern reaches farther and the map fills in.' },
  { id: 'nim',  name: 'Nim',  cost: 10, blurb: 'Frost. It bites and it slows.' },
];

/** Three groups. A cast is one of each: power, element, form. */
export const RUNE_POWERS = [
  { id: 'spark', name: 'Spark', tier: 1, cost: 4 },
  { id: 'brand', name: 'Brand', tier: 2, cost: 8 },
  { id: 'crown', name: 'Crown', tier: 3, cost: 14 },
];
export const RUNE_ELEMENTS = [
  { id: 'ash', name: 'Ash' },
  { id: 'vita', name: 'Vita' },
  { id: 'glim', name: 'Glim' },
];
export const RUNE_FORMS = [
  { id: 'bolt', name: 'Bolt' },
  { id: 'mend', name: 'Mend' },
  { id: 'shell', name: 'Shell' },
];

const LEGACY_RUNES = {
  kael: ['brand', 'ash', 'bolt'],
  sera: ['spark', 'vita', 'mend'],
  veth: ['spark', 'glim', 'shell'],
  orin: ['spark', 'glim', 'bolt'],
  nim: ['brand', 'vita', 'bolt'],
};

export const SLOT_COUNT = 3;
export const AUTO_KEY = 'dxedge_delve_autosave';
export function slotKey(n) { return 'dxedge_delve_slot_' + n; }

export function makeRng(seed) {
  let a = seed >>> 0;
  return {
    next() {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(n) { return Math.floor(this.next() * n); },
    pick(arr) { return arr[this.int(arr.length)]; },
    state() { return a >>> 0; },
    set(s) { a = s >>> 0; },
  };
}

export function blocksMove(t) {
  return t === TILE.WALL || t === TILE.LOCKED || t === TILE.GATE;
}

export function blocksSight(t) {
  return t === TILE.WALL || t === TILE.LOCKED || t === TILE.GATE;
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function latticeEdges() {
  const edges = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (x + 1 < COLS) edges.push([[x, y], [x + 1, y]]);
      if (y + 1 < ROWS) edges.push([[x, y], [x, y + 1]]);
    }
  }
  return edges;
}

function keyOf(c) { return c[0] + ',' + c[1]; }

function spanningTree(rng) {
  const parent = {};
  function find(k) {
    if (parent[k] !== k) parent[k] = find(parent[k]);
    return parent[k];
  }
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) parent[x + ',' + y] = x + ',' + y;
  }
  const edges = shuffle(latticeEdges(), rng);
  const tree = [];
  const extra = [];
  for (const e of edges) {
    const pa = find(keyOf(e[0]));
    const pb = find(keyOf(e[1]));
    if (pa !== pb) {
      parent[pa] = pb;
      tree.push(e);
    } else {
      extra.push(e);
    }
  }
  return { tree, extra };
}

function carveRoom(tiles, rect) {
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) tiles[y][x] = TILE.FLOOR;
  }
}

function carveLine(tiles, x0, y0, x1, y1) {
  let x = x0;
  let y = y0;
  tiles[y][x] = tiles[y][x] === TILE.WALL ? TILE.FLOOR : tiles[y][x];
  while (x !== x1) {
    x += x < x1 ? 1 : -1;
    if (tiles[y][x] === TILE.WALL) tiles[y][x] = TILE.FLOOR;
  }
  while (y !== y1) {
    y += y < y1 ? 1 : -1;
    if (tiles[y][x] === TILE.WALL) tiles[y][x] = TILE.FLOOR;
  }
}

function roomRect(cx, cy, rng) {
  const ox = 1 + cx * CELL;
  const oy = 1 + cy * CELL;
  const rw = 4 + rng.int(3);
  const rh = 4 + rng.int(3);
  const rx = ox + rng.int(CELL - 1 - rw);
  const ry = oy + rng.int(CELL - 1 - rh);
  return {
    cx, cy, x: rx, y: ry, w: rw, h: rh,
    mx: rx + (rw >> 1),
    my: ry + (rh >> 1),
  };
}

function findGapFloor(tiles, edge) {
  // The gap line between two columns runs the full height of the map, and
  // every row's corridor crosses that same line. A door has to sit in its
  // own row's slot, or it seals a different corridor and cuts the tree.
  const horizontal = edge[0][0] !== edge[1][0];
  if (horizontal) {
    const cx = Math.min(edge[0][0], edge[1][0]);
    const cy = edge[0][1];
    const x = CELL * (cx + 1);
    const y0 = 1 + cy * CELL;
    const y1 = y0 + CELL - 2;
    for (let y = y0; y <= y1; y++) {
      if (tiles[y][x] === TILE.FLOOR) return { x, y };
    }
  } else {
    const cy = Math.min(edge[0][1], edge[1][1]);
    const cx = edge[0][0];
    const y = CELL * (cy + 1);
    const x0 = 1 + cx * CELL;
    const x1 = x0 + CELL - 2;
    for (let x = x0; x <= x1; x++) {
      if (tiles[y][x] === TILE.FLOOR) return { x, y };
    }
  }
  return null;
}

function emptyFloor() {
  const tiles = [];
  for (let y = 0; y < MAP; y++) {
    const row = new Array(MAP);
    for (let x = 0; x < MAP; x++) row[x] = TILE.WALL;
    tiles.push(row);
  }
  return tiles;
}

function monsterKind(floor, rng) {
  const roll = rng.next();
  if (floor >= 3 && roll < 0.14) return 'knight';
  if (floor >= 2 && roll < 0.28) return 'chanter';
  if (floor >= 2 && roll < 0.42) return 'hound';
  if (floor >= 1 && roll < 0.56) return 'moth';
  if (floor >= 2 && roll < 0.70) return 'brute';
  if (floor >= 1 && roll < 0.84) return 'spitter';
  if (floor >= 1 && roll < 0.90) return 'wisp';
  if (floor >= 1 && roll < 0.97) return 'ghost';
  return 'crawler';
}

function makeMonster(kind, x, y, floor, diff, rng) {
  const base = {
    crawler: { name: 'ash crawler', hp: 14, atk: 5, def: 0, speed: 1100, range: 1 },
    spitter: { name: 'crypt spitter', hp: 11, atk: 4, def: 0, speed: 1300, range: 4 },
    brute:   { name: 'vault brute', hp: 28, atk: 8, def: 2, speed: 1500, range: 1 },
    wisp:    { name: 'ember wisp', hp: 8, atk: 4, def: 0, speed: 720, range: 1 },
    moth:    { name: 'grave moth', hp: 9, atk: 3, def: 0, speed: 560, range: 1, drain: 'sta' },
    hound:   { name: 'bone hound', hp: 16, atk: 6, def: 1, speed: 780, range: 1 },
    chanter: { name: 'ash chanter', hp: 13, atk: 5, def: 0, speed: 1400, range: 5, drain: 'mana' },
    knight:  { name: 'cinder knight', hp: 36, atk: 9, def: 3, speed: 1200, range: 1 },
    ghost:   { name: 'crypt ghost', hp: 12, atk: 5, def: 0, speed: 980, range: 1 },
    warden:  { name: 'the Warden', hp: 96, atk: 11, def: 3, speed: 880, range: 2 },
    seal:    { name: 'the Seal', hp: 140, atk: 13, def: 4, speed: 760, range: 2 },
  }[kind];
  const grown = base.hp + floor * (kind === 'wisp' || kind === 'moth' ? 2 : 4);
  const hp = Math.max(1, Math.round(grown * diff.hp));
  return {
    kind: 'monster',
    sub: kind,
    name: base.name,
    x, y,
    hp,
    maxHp: hp,
    atk: Math.max(1, Math.round(base.atk * diff.dmg)),
    def: base.def,
    speed: Math.round(base.speed * diff.pace),
    range: base.range,
    drain: base.drain || null,
    magicOnly: kind === 'ghost',
    cool: 400 + rng.int(600),
    slowMs: 0,
    alertMs: 0,
    alive: true,
    anim: 'idle',
    animMs: 0,
    fromX: x,
    fromY: y,
    moveMs: 0,
  };
}

function burst(game, x, y, color, count, lightMs) {
  if (!game.particles) game.particles = [];
  const n = count | 0;
  for (let i = 0; i < n; i++) {
    const a = game.rng.next() * Math.PI * 2;
    const sp = 0.55 + game.rng.next() * 1.7;
    game.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 240 + game.rng.int(260),
      r: color[0], g: color[1], b: color[2],
      floor: game.floor,
    });
  }
  if (game.particles.length > 96) game.particles.splice(0, game.particles.length - 96);
  if (lightMs > 0) {
    if (!game.lights) game.lights = [];
    game.lights.push({
      x, y,
      r: color[0], g: color[1], b: color[2],
      life: lightMs,
      radius: 3.8,
      floor: game.floor,
    });
    if (game.lights.length > 12) game.lights.splice(0, game.lights.length - 12);
  }
}

function cellFree(floor, x, y) {
  if (floor.tiles[y][x] === TILE.WALL) return false;
  return !floor.entities.some(e => e.x === x && e.y === y && !(e.kind === 'monster' && !e.alive) && !e.taken);
}

function generateFloor(floorIndex, diff, rng) {
  const tiles = emptyFloor();
  const rooms = [];
  for (let cy = 0; cy < ROWS; cy++) {
    for (let cx = 0; cx < COLS; cx++) rooms.push(roomRect(cx, cy, rng));
  }
  const byCell = {};
  for (const r of rooms) {
    byCell[r.cx + ',' + r.cy] = r;
    carveRoom(tiles, r);
  }
  const { tree, extra } = spanningTree(rng);
  const loops = extra.slice(0, 2);
  for (const e of tree.concat(loops)) {
    const a = byCell[keyOf(e[0])];
    const b = byCell[keyOf(e[1])];
    if (rng.next() < 0.5) carveLine(tiles, a.mx, a.my, b.mx, b.my);
    else carveLine(tiles, a.mx, a.my, a.mx, b.my), carveLine(tiles, a.mx, b.my, b.mx, b.my);
  }

  const entities = [];
  const start = byCell['0,0'];
  tiles[start.my][start.mx] = TILE.STAIRS_UP;

  let far = start;
  let farD = -1;
  for (const r of rooms) {
    const d = Math.abs(r.mx - start.mx) + Math.abs(r.my - start.my);
    if (d > farD) { farD = d; far = r; }
  }
  const last = floorIndex === FLOORS - 1;
  if (!last) tiles[far.my][far.mx] = TILE.STAIRS_DOWN;

  const doorCell = loops[0] ? findGapFloor(tiles, loops[0]) : null;
  if (doorCell) tiles[doorCell.y][doorCell.x] = TILE.LOCKED;
  const gateCell = loops[1] ? findGapFloor(tiles, loops[1]) : null;
  if (gateCell) tiles[gateCell.y][gateCell.x] = TILE.GATE;
  // A misplaced door must not be able to trap the exit. If the check fails,
  // the barriers come back out and the floor stays a plain loop.
  if (!last) {
    const seen = floodReachable(tiles, start.mx, start.my);
    let downOk = false;
    for (let y = 0; y < MAP && !downOk; y++) {
      for (let x = 0; x < MAP; x++) {
        if (tiles[y][x] === TILE.STAIRS_DOWN && seen.has(x + ',' + y)) downOk = true;
      }
    }
    if (!downOk) {
      if (doorCell) tiles[doorCell.y][doorCell.x] = TILE.FLOOR;
      if (gateCell) tiles[gateCell.y][gateCell.x] = TILE.FLOOR;
    }
  }

  if (doorCell) {
    const home = rooms[1 + rng.int(rooms.length - 1)];
    let kx = home.x + 1;
    let ky = home.y + 1;
    if (tiles[ky][kx] !== TILE.FLOOR) { kx = home.mx; ky = home.my; }
    entities.push({ kind: 'key', x: kx, y: ky, taken: false });
  }

  if (gateCell) {
    const home = rooms[2 + rng.int(Math.max(1, rooms.length - 2))];
    let lx = home.x + 1;
    let ly = home.y + home.h - 2;
    if (tiles[ly][lx] !== TILE.FLOOR) { lx = home.mx; ly = home.my; }
    entities.push({ kind: 'lever', x: lx, y: ly, gx: gateCell.x, gy: gateCell.y });
  }

  const chestRooms = shuffle(rooms.filter(r => r !== start && r !== far), rng).slice(0, 3);
  for (const r of chestRooms) {
    const x = r.x + r.w - 2;
    const y = r.y + 1;
    if (tiles[y][x] === TILE.FLOOR && cellFree({ tiles, entities }, x, y)) {
      entities.push({ kind: 'chest', x, y, opened: false, loot: rollLoot(floorIndex, diff, rng) });
    }
  }

  const skip = new Set([start.mx + ',' + start.my, far.mx + ',' + far.my]);
  for (const r of rooms) {
    if (r === start) continue;
    const chance = (0.42 + floorIndex * 0.06) * diff.count;
    if (rng.next() > chance) continue;
    let x = r.mx;
    let y = r.my;
    if (skip.has(x + ',' + y) || tiles[y][x] !== TILE.FLOOR) {
      x = r.x + 1;
      y = r.y + r.h - 2;
    }
    if (!cellFree({ tiles, entities }, x, y)) continue;
    if (blocksMove(tiles[y][x])) continue;
    entities.push(makeMonster(monsterKind(floorIndex, rng), x, y, floorIndex, diff, rng));
    skip.add(x + ',' + y);
  }

  if (floorIndex === WARDEN_FLOOR) {
    entities.push(makeMonster('warden', far.mx, far.my, floorIndex, diff, rng));
  }
  if (last) {
    entities.push(makeMonster('seal', far.mx, far.my, floorIndex, diff, rng));
  }

  // A few loose vials, never on the first step.
  const potionRooms = shuffle(rooms.filter(r => r !== start), rng).slice(0, 2);
  for (const r of potionRooms) {
    if (rng.next() > diff.potions + 0.25) continue;
    const x = r.x + 1;
    const y = r.y + 1;
    if (cellFree({ tiles, entities }, x, y) && tiles[y][x] === TILE.FLOOR) {
      entities.push({
        kind: 'potion',
        potion: rng.pick(['hp', 'sta', 'mana']),
        amount: 14,
        x, y,
        taken: false,
      });
    }
  }

  placeQuests(floorIndex, tiles, entities, rooms, diff, rng);
  placeProps(floorIndex, tiles, entities, rooms, rng);
  return { tiles, entities, theme: FLOOR_THEMES[floorIndex] };
}

function freeSpot(tiles, entities, room) {
  const spots = [
    [room.x + 1, room.y + 1],
    [room.x + 1, room.y + room.h - 2],
    [room.x + room.w - 2, room.y + room.h - 2],
    [room.mx, room.my],
  ];
  for (const [x, y] of spots) {
    if (x < 1 || y < 1 || x >= MAP - 1 || y >= MAP - 1) continue;
    if (tiles[y][x] !== TILE.FLOOR) continue;
    if (!cellFree({ tiles, entities }, x, y)) continue;
    return { x, y };
  }
  return null;
}

function placeQuests(floorIndex, tiles, entities, rooms, diff, rng) {
  const side = rooms.filter(r => !(r.cx === 0 && r.cy === 0));
  if (floorIndex === 1) {
    const spot = freeSpot(tiles, entities, side[0] || rooms[1]);
    if (spot) entities.push({ kind: 'npc', id: 'pell', name: 'Pell', x: spot.x, y: spot.y, q: 'rescue' });
  }
  if (floorIndex === 2) {
    const spot = freeSpot(tiles, entities, side[side.length - 1] || rooms[1]);
    if (spot) entities.push({ kind: 'relic', id: 'shard', name: 'ember shard', x: spot.x, y: spot.y, q: 'fetch', taken: false });
  }
  if (floorIndex === 3) {
    const room = side[1] || side[0] || rooms[1];
    let n = 0;
    for (const e of entities) {
      if (e.kind === 'monster' && e.alive && e.x >= room.x && e.x < room.x + room.w && e.y >= room.y && e.y < room.y + room.h) {
        e.lair = true;
        e.q = 'lair';
        n += 1;
      }
    }
    for (let y = room.y; y < room.y + room.h && n < 3; y++) {
      for (let x = room.x; x < room.x + room.w && n < 3; x++) {
        if (tiles[y][x] !== TILE.FLOOR || !cellFree({ tiles, entities }, x, y)) continue;
        const m = makeMonster('hound', x, y, floorIndex, diff, rng);
        m.lair = true;
        m.q = 'lair';
        entities.push(m);
        n += 1;
      }
    }
  }
  if (floorIndex === 5) {
    const room = side[0] || rooms[1];
    const nx = room.x + room.w;
    const ny = room.my;
    if (nx < MAP - 1 && ny > 0 && tiles[ny][nx] === TILE.WALL && tiles[ny][room.x + room.w - 1] === TILE.FLOOR) {
      tiles[ny][nx] = TILE.FLOOR;
      entities.push({ kind: 'mark', id: 'crack', name: 'cracked niche', x: nx, y: ny, q: 'hidden' });
    } else {
      const spot = freeSpot(tiles, entities, room);
      if (spot) entities.push({ kind: 'mark', id: 'crack', name: 'cracked niche', x: spot.x, y: spot.y, q: 'hidden' });
    }
  }
}

function placeProps(floorIndex, tiles, entities, rooms, rng) {
  const theme = FLOOR_THEMES[floorIndex];
  const kinds = theme === 'forge'
    ? ['torch', 'statue', 'banner', 'torch']
    : theme === 'flood'
      ? ['web', 'bones', 'banner', 'web']
      : theme === 'cave'
        ? ['bones', 'torch', 'web', 'bones']
        : ['bones', 'web', 'statue', 'banner'];
  let n = 0;
  for (const room of rooms) {
    if (n >= 8) break;
    if (rng.next() > 0.7) continue;
    const spot = freeSpot(tiles, entities, room);
    if (!spot) continue;
    entities.push({ kind: 'prop', sub: kinds[n % kinds.length], x: spot.x, y: spot.y });
    n += 1;
  }
}

function buildHub() {
  const tiles = emptyFloor();
  for (let y = 13; y <= 19; y++) {
    for (let x = 12; x <= 21; x++) tiles[y][x] = TILE.FLOOR;
  }
  tiles[16][12] = TILE.STAIRS_UP;
  tiles[HUB_GATE.y][HUB_GATE.x] = TILE.STAIRS_DOWN;
  return {
    tiles,
    theme: 'camp',
    entities: [
      { kind: 'prop', sub: 'fire', x: 18, y: 16 },
      { kind: 'npc', id: 'sable', name: 'Sable', x: 16, y: 15 },
      { kind: 'npc', id: 'nell', name: 'Nell', x: 16, y: 17 },
      { kind: 'prop', sub: 'banner', x: 14, y: 14 },
      { kind: 'prop', sub: 'banner', x: 14, y: 18 },
      { kind: 'prop', sub: 'torch', x: 15, y: 14 },
      { kind: 'prop', sub: 'torch', x: 19, y: 15 },
      { kind: 'prop', sub: 'bones', x: 19, y: 18 },
    ],
  };
}

function freshQuests() {
  const q = {};
  for (const id of Object.keys(QUEST_DEFS)) {
    q[id] = id.startsWith('story-') && id !== 'story-0' ? 'later' : 'active';
  }
  return q;
}

function rollLoot(floor, diff, rng) {
  const roll = rng.next();
  if (roll < 0.34) {
    const potion = rng.pick(['hp', 'sta', 'mana']);
    if (roll < 0.06) return { type: 'food', name: 'hard biscuit', amount: 6 };
    if (roll < 0.10) return { type: 'drink', name: 'waterskin', amount: 8 };
    return { type: 'potion', potion, amount: 16, name: 'vial' };
  }
  if (roll < 0.55) {
    const weapons = [
      { name: 'iron blade', atk: 2 },
      { name: 'ember brand', atk: 3 },
      { name: 'seal shard', atk: 4 },
    ];
    const w = weapons[Math.min(weapons.length - 1, Math.floor(floor / 2) + (rng.next() < 0.4 ? 1 : 0))];
    if (roll >= 0.50) return { type: 'weapon', name: 'buckler', atk: 0, def: 1, slot: 'offhand' };
    return { type: 'weapon', name: w.name, atk: w.atk, slot: 'weapon' };
  }
  if (roll < 0.75) {
    const table = [
      { slot: 'body', names: ['quilted coat', 'mail shirt', 'ward plate'], def: [1, 2, 3] },
      { slot: 'head', names: ['cloth hood', 'iron cap', 'ward helm'], def: [0, 1, 2] },
      { slot: 'legs', names: ['cloth legs', 'mail legs', 'ward legs'], def: [0, 1, 2] },
      { slot: 'feet', names: ['road boots', 'mail boots', 'ward boots'], def: [0, 1, 1] },
      { slot: 'hands', names: ['cloth gloves', 'mail gloves', 'ward gauntlets'], def: [0, 1, 1] },
      { slot: 'neck', names: ['cord', 'ember bead', 'ward amulet'], def: [0, 0, 1] },
    ];
    const which = table[Math.floor(roll * 37) % table.length];
    const tier = Math.min(2, Math.floor(floor / 2));
    return { type: 'armor', name: which.names[tier], def: which.def[tier], slot: which.slot };
  }
  return { type: 'gold', amount: 4 + floor * 3 + rng.int(6) };
}

function starterParty(diff) {
  const s = diff.party;
  const mk = (name, role, row, hp, sta, mana, atk, def, weapon, armor) => ({
    name,
    role,
    row,
    level: 1,
    xp: 0,
    hp: Math.round(hp * s),
    maxHp: Math.round(hp * s),
    sta: Math.round(sta * s),
    maxSta: Math.round(sta * s),
    mana: Math.round(mana * s),
    maxMana: Math.round(mana * s),
    atk,
    def,
    weapon,
    armor,
    items: [],
    rune: 0,
  });
  const party = [
    mk('Bryn', 'fighter', 'front', 42, 32, 8,  7, 3, { name: 'ash knife', atk: 1 }, { name: 'quilted coat', def: 1 }),
    mk('Cara', 'rogue',   'front', 30, 36, 10, 6, 2, { name: 'ash knife', atk: 1 }, null),
    mk('Ivo',  'priest',  'back',  26, 20, 34, 3, 2, { name: 'oak staff', atk: 0 }, { name: 'robe', def: 0 }),
    mk('Senn', 'mage',    'back',  22, 18, 38, 4, 1, { name: 'oak staff', atk: 1 }, null),
  ];
  const pots = [
    { type: 'potion', potion: 'hp', amount: 18, name: 'red vial' },
    { type: 'potion', potion: 'mana', amount: 16, name: 'blue vial' },
  ];
  for (let i = 0; i < diff.startPots; i++) party[0].items.push({ ...pots[i % pots.length] });
  outfit(party);
  return party;
}

function log(game, text, kind) {
  const k = kind || 'info';
  const last = game.log[game.log.length - 1];
  if (last && last.text === text && last.kind === k) {
    last.n = (last.n || 1) + 1;
    game.logRev++;
    return;
  }
  game.log.push({ text, kind: k, n: 1 });
  if (game.log.length > 40) game.log.splice(0, game.log.length - 40);
  game.logRev++;
}

export function living(game) {
  return game.party.filter(c => c.hp > 0);
}

export const EQUIP_SLOTS = ['head', 'body', 'legs', 'feet', 'hands', 'neck', 'weapon', 'offhand'];
export const PACK_SIZE = 16;

function blankEquip() {
  const equip = {};
  for (const s of EQUIP_SLOTS) equip[s] = null;
  return equip;
}

function emptyPack() {
  const pack = [];
  for (let i = 0; i < PACK_SIZE; i++) pack.push(null);
  return pack;
}

export function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const item = {
    type: raw.type || (raw.slot === 'weapon' || raw.slot === 'offhand' ? 'weapon' : 'armor'),
    name: raw.name || 'item',
    slot: raw.slot || null,
    atk: raw.atk | 0,
    def: raw.def | 0,
    potion: raw.potion || '',
    amount: raw.amount | 0,
  };
  if (item.type === 'potion' || item.type === 'food' || item.type === 'drink') item.slot = null;
  else if (!item.slot) {
    if (item.type === 'weapon') item.slot = 'weapon';
    else if (item.type === 'armor') item.slot = 'body';
  }
  if (item.slot && !EQUIP_SLOTS.includes(item.slot)) item.slot = null;
  return item;
}

function isConsumable(item) {
  return !!item && (item.type === 'potion' || item.type === 'food' || item.type === 'drink');
}

function syncLegacy(c) {
  const w = c.equip && c.equip.weapon;
  c.weapon = w ? { name: w.name, atk: w.atk || 0 } : null;
  const b = c.equip && c.equip.body;
  c.armor = b ? { name: b.name, def: b.def || 0 } : null;
  c.items = (c.pack || []).filter(isConsumable).map(it => ({
    type: it.type,
    potion: it.potion || '',
    amount: it.amount || 0,
    name: it.name,
  }));
}

/** Old saves stored weapon, armor, and a vial list. New games store equip and pack. */
export function ensureGear(c) {
  if (!c) return c;
  const hadPack = Array.isArray(c.pack);
  if (!c.equip || typeof c.equip !== 'object') c.equip = blankEquip();
  else {
    for (const s of EQUIP_SLOTS) c.equip[s] = c.equip[s] ? normalizeItem(c.equip[s]) : null;
  }
  const pack = emptyPack();
  if (hadPack) {
    for (let i = 0; i < PACK_SIZE; i++) pack[i] = c.pack[i] ? normalizeItem(c.pack[i]) : null;
  }
  c.pack = pack;
  if (!hadPack) {
    if (c.weapon && !c.equip.weapon) {
      c.equip.weapon = normalizeItem({ type: 'weapon', name: c.weapon.name, atk: c.weapon.atk, slot: 'weapon' });
    }
    if (c.armor && !c.equip.body) {
      c.equip.body = normalizeItem({ type: 'armor', name: c.armor.name, def: c.armor.def, slot: 'body' });
    }
    if (Array.isArray(c.items)) {
      let i = 0;
      for (const it of c.items) {
        while (i < PACK_SIZE && c.pack[i]) i++;
        if (i >= PACK_SIZE) break;
        c.pack[i] = normalizeItem(it);
        i++;
      }
    }
  }
  syncLegacy(c);
  return c;
}

function outfit(party) {
  for (const c of party) ensureGear(c);
  putPack(party[1], { type: 'food', name: 'hard biscuit', amount: 6 });
  putPack(party[2], { type: 'drink', name: 'waterskin', amount: 8 });
  const wear = (c, item) => {
    const it = normalizeItem(item);
    if (!it || !it.slot) return;
    c.equip[it.slot] = it;
    syncLegacy(c);
  };
  wear(party[0], { type: 'armor', slot: 'head', name: 'leather hood', def: 0 });
  wear(party[0], { type: 'armor', slot: 'feet', name: 'road boots', def: 0 });
  wear(party[1], { type: 'armor', slot: 'feet', name: 'soft boots', def: 0 });
  wear(party[2], { type: 'armor', slot: 'neck', name: 'cord', def: 0 });
  wear(party[2], { type: 'armor', slot: 'hands', name: 'wool gloves', def: 0 });
  wear(party[3], { type: 'armor', slot: 'hands', name: 'cloth gloves', def: 0 });
}

function packRoom(c) {
  ensureGear(c);
  return c.pack.some(x => !x);
}

function putPack(c, item) {
  ensureGear(c);
  const i = c.pack.findIndex(x => !x);
  if (i < 0) return false;
  c.pack[i] = normalizeItem(item);
  syncLegacy(c);
  return true;
}

function dropGear(game, item) {
  const gear = normalizeItem(item);
  if (!gear) return;
  currentFloor(game).entities.push({
    kind: 'item',
    item: gear,
    name: gear.name,
    x: game.x,
    y: game.y,
    taken: false,
  });
}

function canEquip(item, slot) {
  if (!item || !item.slot || !EQUIP_SLOTS.includes(slot)) return false;
  if (item.slot === slot) return true;
  if (item.slot === 'weapon' && slot === 'offhand' && (item.atk || 0) > 0) return true;
  return false;
}

function readLoc(c, loc) {
  ensureGear(c);
  if (!loc) return null;
  if (loc.where === 'pack') return c.pack[loc.index] || null;
  if (loc.where === 'equip') return c.equip[loc.slot] || null;
  return null;
}

function writeLoc(c, loc, item) {
  if (loc.where === 'pack') c.pack[loc.index] = item;
  else if (loc.where === 'equip') c.equip[loc.slot] = item;
}

function sameLoc(a, b) {
  if (!a || !b || a.where === 'floor' || b.where === 'floor') return false;
  if (a.champ !== b.champ || a.where !== b.where) return false;
  if (a.where === 'pack') return a.index === b.index;
  return a.slot === b.slot;
}

export function itemBlurb(item) {
  if (!item) return '';
  const bits = [item.name];
  if (item.slot) bits.push(item.slot);
  if (item.atk) bits.push('+' + item.atk + ' attack');
  if (item.def) bits.push('+' + item.def + ' armor');
  if (item.type === 'potion') {
    const kind = item.potion === 'hp' ? 'health' : item.potion === 'sta' ? 'stamina' : 'mana';
    bits.push('drink, +' + item.amount + ' ' + kind);
  } else if (item.type === 'food') bits.push('eat, +' + (item.amount || 6) + ' health');
  else if (item.type === 'drink') bits.push('drink, +' + (item.amount || 8) + ' stamina');
  return bits.join(' · ');
}

export function weaponAtk(c) {
  ensureGear(c);
  let extra = 0;
  const w = c.equip.weapon;
  const o = c.equip.offhand;
  if (w && w.atk) extra += w.atk;
  if (o && o.atk) extra += o.atk;
  return c.atk + extra;
}

export function armorDef(c) {
  ensureGear(c);
  let extra = 0;
  for (const s of EQUIP_SLOTS) {
    if (s === 'weapon') continue;
    const it = c.equip[s];
    if (it && it.def) extra += it.def;
  }
  return c.def + extra;
}

export function moveItem(game, from, to) {
  if (!game || game.phase !== 'play' || !from) return { ok: false };
  const src = game.party[from.champ];
  if (!src) return { ok: false };
  ensureGear(src);
  const item = readLoc(src, from);
  if (!item) return { ok: false };
  if (to && to.where === 'floor') {
    writeLoc(src, from, null);
    syncLegacy(src);
    dropGear(game, item);
    log(game, src.name + ' drops ' + item.name + '.', 'info');
    return { ok: true };
  }
  if (!to || to.champ == null) return { ok: false };
  const dst = game.party[to.champ];
  if (!dst) return { ok: false };
  ensureGear(dst);
  if (sameLoc(from, to)) return { ok: true };
  if (to.where === 'equip' && !canEquip(item, to.slot)) {
    log(game, item.name + ' does not fit that slot.', 'info');
    return { ok: false, reason: 'slot' };
  }
  if (to.where === 'pack' && (to.index < 0 || to.index >= PACK_SIZE)) return { ok: false };
  const displaced = readLoc(dst, to);
  if (displaced && from.where === 'equip' && !canEquip(displaced, from.slot)) {
    const empty = src.pack.findIndex(x => !x);
    if (empty < 0) {
      log(game, 'The pack is full.', 'info');
      return { ok: false, reason: 'full' };
    }
    writeLoc(src, from, null);
    writeLoc(dst, to, item);
    src.pack[empty] = displaced;
    syncLegacy(src);
    if (dst !== src) syncLegacy(dst);
    return { ok: true };
  }
  writeLoc(src, from, displaced || null);
  writeLoc(dst, to, item);
  syncLegacy(src);
  if (dst !== src) syncLegacy(dst);
  if (to.where === 'equip' && from.where !== 'equip') log(game, dst.name + ' equips ' + item.name + '.', 'good');
  else if (from.where === 'equip' && to.where === 'pack' && from.champ === to.champ) log(game, src.name + ' puts away ' + item.name + '.', 'info');
  else if (from.champ !== to.champ) log(game, src.name + ' hands ' + item.name + ' to ' + dst.name + '.', 'info');
  return { ok: true };
}

export function dropItem(game, from) {
  return moveItem(game, from, { where: 'floor' });
}

export function handoffItem(game, from, champIndex) {
  const dst = game && game.party[champIndex];
  if (!dst) return { ok: false };
  ensureGear(dst);
  const idx = dst.pack.findIndex(x => !x);
  if (idx < 0) {
    log(game, dst.name + ' has no room in the pack.', 'info');
    return { ok: false, reason: 'full' };
  }
  return moveItem(game, from, { champ: champIndex, where: 'pack', index: idx });
}

function consumeAt(game, c, index) {
  const item = c.pack[index];
  if (!isConsumable(item)) return { ok: false };
  if (item.type === 'potion') {
    if (item.potion === 'hp') {
      const before = c.hp;
      c.hp = Math.min(c.maxHp, c.hp + item.amount);
      if (before <= 0) c.hp = Math.min(c.maxHp, item.amount);
      log(game, c.name + ' drinks a red vial.', 'good');
    } else if (item.potion === 'sta') {
      c.sta = Math.min(c.maxSta, c.sta + item.amount);
      log(game, c.name + ' drinks a yellow vial.', 'good');
    } else {
      c.mana = Math.min(c.maxMana, c.mana + item.amount);
      log(game, c.name + ' drinks a blue vial.', 'good');
    }
  } else if (item.type === 'food') {
    const n = item.amount || 6;
    if (c.hp <= 0) c.hp = Math.min(c.maxHp, n);
    else c.hp = Math.min(c.maxHp, c.hp + n);
    c.sta = Math.min(c.maxSta, c.sta + 4);
    log(game, c.name + ' eats ' + item.name + '.', 'good');
  } else {
    const n = item.amount || 8;
    c.sta = Math.min(c.maxSta, c.sta + n);
    log(game, c.name + ' drinks ' + item.name + '.', 'good');
  }
  c.pack[index] = null;
  syncLegacy(c);
  return { ok: true };
}

export function activateItem(game, loc) {
  if (!game || game.phase !== 'play' || !loc) return { ok: false };
  const c = game.party[loc.champ];
  if (!c) return { ok: false };
  ensureGear(c);
  if (loc.where === 'equip') {
    const empty = c.pack.findIndex(x => !x);
    if (empty < 0) {
      log(game, 'The pack is full.', 'info');
      return { ok: false, reason: 'full' };
    }
    return moveItem(game, loc, { champ: loc.champ, where: 'pack', index: empty });
  }
  const item = c.pack[loc.index];
  if (!item) return { ok: false };
  if (isConsumable(item)) return consumeAt(game, c, loc.index);
  if (item.slot) return moveItem(game, loc, { champ: loc.champ, where: 'equip', slot: item.slot });
  return { ok: false };
}

export function xpNeed(level) {
  return 18 + level * 14;
}

function grantXp(game, amount) {
  for (const c of living(game)) {
    c.xp += amount;
    while (c.xp >= xpNeed(c.level)) {
      c.xp -= xpNeed(c.level);
      c.level += 1;
      c.maxHp += 4;
      c.hp = Math.min(c.maxHp, c.hp + 6);
      c.atk += 1;
      c.maxSta += 2;
      c.sta = Math.min(c.maxSta, c.sta + 2);
      if (c.role === 'mage' || c.role === 'priest') c.maxMana += 4;
      else c.maxMana += 1;
      c.mana = Math.min(c.maxMana, c.mana + 2);
      game.levelPing = (game.levelPing || 0) + 1;
      log(game, c.name + ' reaches level ' + c.level + '.', 'good');
    }
  }
}

function floater(game, text, kind) {
  if (!game.floaters) game.floaters = [];
  game.floaters.push({ text: String(text), kind: kind || 'hit', life: 900 });
  if (game.floaters.length > 12) game.floaters.splice(0, game.floaters.length - 12);
}

export function createGame(seed, difficulty) {
  const diffName = DIFF[difficulty] ? difficulty : 'normal';
  const diff = DIFF[diffName];
  const usedSeed = (seed == null ? (Date.now() & 0x7fffffff) : (seed >>> 0)) || 1;
  const rng = makeRng(usedSeed);
  const floors = [];
  for (let i = 0; i < FLOORS; i++) floors.push(generateFloor(i, diff, rng));
  const start = findTile(floors[0].tiles, TILE.STAIRS_UP);
  const game = {
    v: SAVE_V,
    seed: usedSeed,
    difficulty: diffName,
    floors,
    floor: 0,
    x: start.x,
    y: start.y,
    facing: 1,
    party: starterParty(diff),
    selected: 0,
    keys: 0,
    gold: 0,
    kills: 0,
    time: 0,
    phase: 'play',
    paused: false,
    explored: new Set(),
    log: [],
    logRev: 0,
    gleamMs: 0,
    wardMs: 0,
    regenSta: 0,
    regenMana: 0,
    hurtMs: 0,
    shake: 0,
    floaters: [],
    particles: [],
    lights: [],
    levelPing: 0,
    inHub: false,
    hub: buildHub(),
    quests: freshQuests(),
    talk: null,
    nellPaid: false,
    torch: false,
    noise: 0,
    restMs: 0,
    lookKey: '',
    wantAutosave: false,
    runePower: 'spark',
    runeElement: 'ash',
    runeForm: 'bolt',
    packNoted: false,
    rng,
    diff,
  };
  log(game, 'The lantern catches. Four of you, and the stair only goes down.', 'info');
  log(game, FLOOR_NAMES[0] + '.', 'good');
  reveal(game);
  announceLook(game);
  return game;
}

function findTile(tiles, tile) {
  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < tiles[y].length; x++) {
      if (tiles[y][x] === tile) return { x, y };
    }
  }
  return { x: 1, y: 1 };
}

export function currentFloor(game) {
  if (game.inHub && game.hub) return game.hub;
  return game.floors[game.floor];
}

export function exploredKey(game, x, y) {
  return (game.inHub ? 'hub' : game.floor) + ':' + x + ',' + y;
}

export function tileAt(game, x, y, floor) {
  const f = game.floors[floor == null ? game.floor : floor];
  if (!f || y < 0 || x < 0 || y >= MAP || x >= MAP) return TILE.WALL;
  return f.tiles[y][x];
}

export function los(tiles, x0, y0, x1, y1) {
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (x !== x1 || y !== y1) {
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
    if (y < 0 || x < 0 || y >= tiles.length || x >= tiles[0].length) return false;
    const t = tiles[y][x];
    if (x === x1 && y === y1) return true;
    if (blocksSight(t)) return false;
  }
  return true;
}

export function reveal(game) {
  const r = game.gleamMs > 0 ? 8 : 4;
  const tiles = currentFloor(game).tiles;
  for (let y = game.y - r; y <= game.y + r; y++) {
    for (let x = game.x - r; x <= game.x + r; x++) {
      if (x < 0 || y < 0 || y >= MAP || x >= MAP) continue;
      const d2 = (x - game.x) * (x - game.x) + (y - game.y) * (y - game.y);
      if (d2 > (r + 0.2) * (r + 0.2)) continue;
      if (!los(tiles, game.x, game.y, x, y)) continue;
      game.explored.add(exploredKey(game, x, y));
    }
  }
}

function livingMonsterAt(floor, x, y) {
  return floor.entities.find(e => e.kind === 'monster' && e.alive && e.x === x && e.y === y) || null;
}

function firstAlong(game, maxDist) {
  const tiles = currentFloor(game).tiles;
  const floor = currentFloor(game);
  let x = game.x;
  let y = game.y;
  const dx = DX[game.facing];
  const dy = DY[game.facing];
  for (let i = 1; i <= maxDist; i++) {
    x += dx;
    y += dy;
    if (x < 0 || y < 0 || x >= MAP || y >= MAP) return null;
    const m = livingMonsterAt(floor, x, y);
    if (m) return m;
    if (blocksSight(tiles[y][x])) return null;
  }
  return null;
}

function stepWord(d) {
  return d === 1 ? '1 step' : d + ' steps';
}

function feat(id, noun, stand, near, far) {
  return { id, noun, stand, near, far: far || ((d) => near.replace(/\.$/, '') + ', ' + stepWord(d) + ' ahead.') };
}

/** What a cell is, and the line to say when you face it, stand on it, or see it further off. */
function featureAt(game, x, y) {
  if (x < 0 || y < 0 || x >= MAP || y >= MAP) return null;
  const floor = currentFloor(game);
  const tile = floor.tiles[y][x];
  const ents = floor.entities.filter(e => e.x === x && e.y === y && !e.taken && e.kind !== 'monster');
  const npc = ents.find(e => e.kind === 'npc');
  if (npc) {
    const line = npc.name + ' is here. Press F to talk.';
    return feat('npc:' + npc.id, npc.name, line, line, (d) => npc.name + ' is ' + stepWord(d) + ' ahead. Press F to talk.');
  }
  const relic = ents.find(e => e.kind === 'relic');
  if (relic) {
    const line = 'The ember shard glows. Press F to take it.';
    return feat('relic', relic.name || 'ember shard', line, line);
  }
  const mark = ents.find(e => e.kind === 'mark');
  if (mark) {
    const line = 'A cracked niche. Step in, or press F, to search it.';
    return feat('mark', mark.name || 'cracked niche', line, line);
  }
  const chest = ents.find(e => e.kind === 'chest' && !e.opened);
  if (chest) {
    return feat('chest', 'chest', 'A chest. Press F to open it.', 'A chest. Press F to open it.',
      (d) => 'The chest is ' + stepWord(d) + ' ahead.');
  }
  const lever = ents.find(e => e.kind === 'lever');
  if (lever) {
    const line = 'A lever. Press F to throw it.';
    return feat('lever', 'lever', line, line);
  }
  const key = ents.find(e => e.kind === 'key');
  if (key) {
    const line = 'An iron key. Step onto it, or press F, to take it.';
    return feat('key', 'key', line, line);
  }
  const pot = ents.find(e => e.kind === 'potion');
  if (pot) {
    const line = 'A vial. Step onto it, or press F, to take it.';
    return feat('potion', 'vial', line, line);
  }
  const dropped = ents.find(e => e.kind === 'item' && e.item);
  if (dropped) {
    const name = dropped.item.name || 'item';
    const line = name + ' lies here. Press F to take it.';
    return feat('item:' + x + ',' + y, name, line, line, (d) => name + ' is ' + stepWord(d) + ' ahead. Press F to take it.');
  }
  const prop = ents.find(e => e.kind === 'prop');
  if (prop && prop.sub === 'torch') {
    const line = game.torch
      ? 'A wall torch. You already carry one.'
      : 'A wall torch. Press F to take it.';
    return feat('torch', 'torch', line, line, (d) => 'A wall torch is ' + stepWord(d) + ' ahead. Press F when you stand next to it.');
  }
  if (prop && prop.sub === 'fire') {
    const line = 'The campfire. Press F to rest and close a few wounds.';
    return feat('fire', 'campfire', line, line, (d) => 'The campfire is ' + stepWord(d) + ' ahead. Press F to rest.');
  }
  if (prop && prop.sub === 'banner') return feat('banner', 'banner', 'A tattered banner.', 'A tattered banner.');
  if (prop && prop.sub === 'bones') return feat('bones', 'bones', 'Scattered bones.', 'Scattered bones.');
  if (prop && prop.sub === 'web') return feat('web', 'cobweb', 'A cobweb.', 'A cobweb.');
  if (prop && prop.sub === 'statue') return feat('statue', 'statue', 'A stone figure.', 'A stone figure.');
  if (tile === TILE.LOCKED) {
    const line = game.keys ? 'A locked door. Press F to use a key.' : 'A locked door. It wants a key. Press F to try it.';
    return feat('door', 'door', line, line);
  }
  if (tile === TILE.DOOR_OPEN) return feat('door-open', 'door', 'An open door.', 'An open door.');
  if (tile === TILE.GATE) {
    const line = 'An iron gate. A lever nearby lifts it.';
    return feat('gate', 'gate', line, line);
  }
  if (tile === TILE.GATE_OPEN) return feat('gate-open', 'gate', 'The gate is raised.', 'The gate is raised.');
  if (tile === TILE.STAIRS_DOWN) {
    if (game.inHub) {
      const line = 'The far stair. Press F to go deeper.';
      return feat('stairs-down-hub', 'stairs', line, line);
    }
    const line = 'Stairs down. Press F. A waystation waits between floors.';
    return feat('stairs-down', 'stairs', line, line, (d) => 'The stairs are ' + stepWord(d) + ' ahead.');
  }
  if (tile === TILE.STAIRS_UP) {
    if (game.inHub) {
      const line = 'The near stair. Press F to return to the floor you left.';
      return feat('stairs-up-hub', 'stairs', line, line);
    }
    if ((game.floor | 0) <= 0) {
      const line = 'The entry stair is underfoot. The way back is shut.';
      return feat('stairs-entry', 'stairs', line, 'The entry stair. The way back is shut.',
        (d) => 'The entry stair is ' + stepWord(d) + ' ahead. The way back is shut.');
    }
    const line = 'Stairs up. Press F to climb.';
    return feat('stairs-up', 'stairs', line, line, (d) => 'The stairs are ' + stepWord(d) + ' ahead.');
  }
  return null;
}

function labelAt(game, x, y, tile) {
  const floor = currentFloor(game);
  const m = livingMonsterAt(floor, x, y);
  if (m) return m.name;
  const featHit = featureAt(game, x, y);
  if (featHit) return featHit.noun;
  if (tile === TILE.LOCKED) return 'door';
  if (tile === TILE.GATE) return 'gate';
  if (tile === TILE.STAIRS_DOWN || tile === TILE.STAIRS_UP) return 'stairs';
  return null;
}

/** Nearest thing you can see straight ahead, in steps. Walls hide what is past them. */
function seenAhead(game, maxDist) {
  const tiles = currentFloor(game).tiles;
  const floor = currentFloor(game);
  let x = game.x;
  let y = game.y;
  const dx = DX[game.facing];
  const dy = DY[game.facing];
  const reach = maxDist == null ? 6 : maxDist;
  for (let i = 1; i <= reach; i++) {
    x += dx;
    y += dy;
    if (x < 0 || y < 0 || x >= MAP || y >= MAP) return null;
    const tile = tiles[y][x];
    const m = livingMonsterAt(floor, x, y);
    if (m) return { dist: i, label: m.name };
    const found = featureAt(game, x, y);
    if (found) return { dist: i, label: found.noun, feature: found };
    if (blocksSight(tile)) return null;
  }
  return null;
}

function aheadLine(hit) {
  if (hit.feature) return hit.feature.far(hit.dist);
  const steps = hit.dist === 1 ? '1 step' : hit.dist + ' steps';
  if (hit.label === 'stairs') return 'The stairs are ' + steps + ' ahead.';
  if (/^[A-Z]/.test(hit.label)) return hit.label + ' is ' + steps + ' ahead.';
  if (/^the /i.test(hit.label)) {
    const name = hit.label.charAt(0).toUpperCase() + hit.label.slice(1);
    return name + ' is ' + steps + ' ahead.';
  }
  return 'The ' + hit.label + ' is ' + steps + ' ahead.';
}

function announceLook(game) {
  const here = featureAt(game, game.x, game.y);
  const hit = seenAhead(game, 6);
  const ahead = hit && hit.feature;
  const key = (here ? here.id : '') + '>' + (ahead ? ahead.id : '');
  if (key === game.lookKey) return;
  if (!here && !ahead) {
    game.lookKey = key;
    return;
  }
  game.lookKey = key;
  if (here) log(game, here.stand, 'info');
  if (ahead && (!here || ahead.id !== here.id)) {
    log(game, hit.dist <= 1 ? ahead.near : ahead.far(hit.dist), 'info');
  }
}

function noteAhead(game) {
  const hit = seenAhead(game, 6);
  if (!hit) return false;
  log(game, aheadLine(hit), 'info');
  floater(game, hit.dist === 1 ? '1 step' : hit.dist + ' steps', 'miss');
  return true;
}

function selectedChamp(game) {
  const c = game.party[game.selected];
  if (c && c.hp > 0) return c;
  const live = living(game);
  return live[0] || null;
}

function caster(game, cost) {
  const sel = game.party[game.selected];
  if (sel && sel.hp > 0 && sel.mana >= cost) return sel;
  let best = null;
  for (const c of game.party) {
    if (c.hp <= 0 || c.mana < cost) continue;
    if (!best || c.mana > best.mana) best = c;
  }
  return best;
}

function checkDefeat(game) {
  if (living(game).length === 0 && game.phase === 'play') {
    game.phase = 'lost';
    log(game, 'The lantern goes out. The crypt keeps the four of you.', 'bad');
  }
}

function killMonster(game, m, who) {
  if (!m.alive) return;
  m.alive = false;
  m.hp = 0;
  m.anim = 'death';
  m.animMs = 900;
  burst(game, m.x + 0.5, m.y + 0.5, [0.95, 0.55, 0.28], 12, 480);
  game.kills += 1;
  const xp = { seal: 60, warden: 40, knight: 16, brute: 14, chanter: 12, hound: 10 }[m.sub] || 8;
  log(game, (who ? who.name : 'The party') + ' fells ' + m.name + '.', 'good');
  grantXp(game, xp);
  if (m.sub === 'seal') {
    game.phase = 'won';
    game.gold += 80;
    log(game, 'The seal cracks. The last guardian falls, and the crypt exhales.', 'good');
    finishQuest(game, 'story-6');
  } else if (m.sub === 'warden') {
    game.gold += 20;
    log(game, 'The Warden falls. The stair down is clear.', 'good');
    finishQuest(game, 'story-4');
  } else if (game.rng.next() < 0.35) {
    const pot = game.rng.pick(['hp', 'sta', 'mana']);
    const c = who && who.hp > 0 ? who : living(game)[0];
    if (c && packRoom(c)) {
      putPack(c, { type: 'potion', potion: pot, amount: 12, name: 'vial' });
      log(game, c.name + ' pockets a vial.', 'good');
    } else {
      game.gold += 3;
    }
  }
  if (m.lair) checkLair(game);
}

function applyDamageTo(game, c, amount, source) {
  const dmg = Math.max(1, amount);
  c.hp = Math.max(0, c.hp - dmg);
  game.hurtMs = 180;
  game.shake = Math.min(420, (game.shake || 0) + 90 + dmg * 8);
  floater(game, '-' + dmg, 'hurt');
  log(game, source + ' hits ' + c.name + ' for ' + dmg + '.', 'bad');
  if (c.hp <= 0) log(game, c.name + ' drops.', 'bad');
  checkDefeat(game);
}

function sap(m, c) {
  if (!c || c.hp <= 0 || !m.drain) return;
  if (m.drain === 'sta') c.sta = Math.max(0, c.sta - 3);
  if (m.drain === 'mana') c.mana = Math.max(0, c.mana - 4);
}

function frontTargets(game) {
  const front = game.party.filter(c => c.row === 'front' && c.hp > 0);
  if (front.length) return front;
  return living(game);
}

function aggroRange(m) {
  if (m.sub === 'seal') return 12;
  if (m.sub === 'warden') return 10;
  if (m.sub === 'hound') return 8;
  if (m.sub === 'ghost') return 7;
  return 6;
}

function hearsParty(game, m, man, canSee) {
  if (canSee && man <= aggroRange(m)) return true;
  const ear = m.sub === 'hound' ? 8 : m.sub === 'ghost' ? 6 : 4;
  if ((game.noise || 0) >= man && man <= ear && man > 0) return true;
  if (m.sub === 'hound' && man <= 3) return true;
  return false;
}

function allyCalling(floor, m) {
  return floor.entities.some(e => e !== m && e.kind === 'monster' && e.alive && e.alertMs > 0
    && Math.abs(e.x - m.x) + Math.abs(e.y - m.y) <= 3);
}

function fleeStep(tiles, floor, m, px, py) {
  const ghost = m.sub === 'ghost';
  let best = null;
  let bestD = Math.abs(m.x - px) + Math.abs(m.y - py);
  for (let d = 0; d < 4; d++) {
    const nx = m.x + DX[d];
    const ny = m.y + DY[d];
    if (nx < 0 || ny < 0 || nx >= MAP || ny >= MAP) continue;
    if (nx === px && ny === py) continue;
    const t = tiles[ny][nx];
    if (ghost ? blocksMove(t) : (t === TILE.WALL || t === TILE.GATE || t === TILE.LOCKED)) continue;
    if (livingMonsterAt(floor, nx, ny)) continue;
    const dist = Math.abs(nx - px) + Math.abs(ny - py);
    if (dist > bestD) { bestD = dist; best = [nx, ny]; }
  }
  return best;
}

function monsterAct(game, m) {
  const floor = currentFloor(game);
  const man = Math.abs(m.x - game.x) + Math.abs(m.y - game.y);
  const tiles = floor.tiles;
  const canSee = los(tiles, m.x, m.y, game.x, game.y);
  const noticed = hearsParty(game, m, man, canSee) || (m.alertMs > 0 && man <= aggroRange(m) + 3) || allyCalling(floor, m);
  if (!noticed) return;
  m.alertMs = 7000;
  const boss = m.sub === 'warden' || m.sub === 'seal' || m.sub === 'knight' || m.sub === 'brute';
  const fleeing = !boss && m.maxHp > 0 && m.hp / m.maxHp < 0.3;
  if (fleeing) {
    const away = fleeStep(tiles, floor, m, game.x, game.y);
    if (away) {
      m.fromX = m.x;
      m.fromY = m.y;
      m.x = away[0];
      m.y = away[1];
      m.moveMs = 150;
      if (!m.fled) {
        m.fled = true;
        log(game, m.name + ' breaks and runs.', 'info');
      }
      return;
    }
  }
  const pack = floor.entities.filter(e => e.kind === 'monster' && e.alive
    && Math.abs(e.x - game.x) + Math.abs(e.y - game.y) <= 1).length;
  if (man <= 1) {
    const pool = frontTargets(game);
    if (!pool.length) return;
    const c = pool[game.rng.int(pool.length)];
    let dmg = m.atk - armorDef(c);
    if (game.wardMs > 0) dmg -= 4;
    if (pack >= 2) {
      dmg += 3;
      if (!game.packNoted) {
        game.packNoted = true;
        log(game, 'The pack strikes as one.', 'bad');
      }
    }
    m.anim = 'attack';
    m.animMs = 340;
    applyDamageTo(game, c, dmg, m.name);
    sap(m, c);
    return;
  }
  if (!fleeing && m.range > 1 && man <= m.range && canSee) {
    const backs = living(game).filter(c => c.row === 'back');
    const pool = backs.length ? backs : living(game);
    if (!pool.length) return;
    const c = pool[game.rng.int(pool.length)];
    let dmg = m.atk - Math.floor(armorDef(c) / 2);
    if (game.wardMs > 0) dmg -= 3;
    m.anim = 'attack';
    m.animMs = 340;
    applyDamageTo(game, c, dmg, m.name);
    sap(m, c);
    return;
  }
  const ghost = m.sub === 'ghost';
  const step = nextStep(tiles, floor, m.x, m.y, game.x, game.y, ghost);
  if (!step) return;
  if (step[0] === game.x && step[1] === game.y) return;
  const tile = tiles[step[1]][step[0]];
  if (ghost && (tile === TILE.LOCKED || tile === TILE.GATE)) return;
  if (!ghost && tile === TILE.LOCKED) {
    tiles[step[1]][step[0]] = TILE.DOOR_OPEN;
    log(game, m.name + ' forces a door.', 'info');
    return;
  }
  if (livingMonsterAt(floor, step[0], step[1])) return;
  m.fromX = m.x;
  m.fromY = m.y;
  m.x = step[0];
  m.y = step[1];
  m.moveMs = 150;
}

function nextStep(tiles, floor, x, y, tx, ty, ghost) {
  const start = x + ',' + y;
  const goal = tx + ',' + ty;
  const q = [[x, y]];
  const prev = new Map();
  prev.set(start, null);
  while (q.length) {
    const [cx, cy] = q.shift();
    if (cx + ',' + cy === goal) break;
    if (prev.size > 80) break;
    for (let d = 0; d < 4; d++) {
      const nx = cx + DX[d];
      const ny = cy + DY[d];
      const k = nx + ',' + ny;
      if (prev.has(k)) continue;
      if (nx < 0 || ny < 0 || nx >= MAP || ny >= MAP) continue;
      if (nx !== tx || ny !== ty) {
        const t = tiles[ny][nx];
        if (ghost) {
          if (blocksMove(t)) continue;
        } else if (t === TILE.WALL || t === TILE.GATE) continue;
        else if (t !== TILE.LOCKED && blocksMove(t)) continue;
        if (livingMonsterAt(floor, nx, ny)) continue;
      }
      prev.set(k, cx + ',' + cy);
      q.push([nx, ny]);
    }
  }
  if (!prev.has(goal)) return null;
  let cur = goal;
  let before = prev.get(cur);
  while (before && before !== start) {
    cur = before;
    before = prev.get(cur);
  }
  if (!before) return null;
  const [sx, sy] = cur.split(',').map(Number);
  return [sx, sy];
}

function pickupAt(game, x, y) {
  const floor = currentFloor(game);
  for (const e of floor.entities) {
    if (e.x !== x || e.y !== y || e.taken) continue;
    if (e.kind === 'key') {
      e.taken = true;
      game.keys += 1;
      log(game, 'An iron key. You have ' + game.keys + '.', 'good');
      return;
    }
    if (e.kind === 'potion') {
      const c = selectedChamp(game);
      if (!c || !packRoom(c)) {
        log(game, 'A vial, and no free hand.', 'info');
        return;
      }
      e.taken = true;
      putPack(c, { type: 'potion', potion: e.potion, amount: e.amount, name: 'vial' });
      log(game, c.name + ' takes a ' + e.potion + ' vial.', 'good');
      return;
    }
    if (e.kind === 'item' && e.item) {
      const c = selectedChamp(game);
      if (!c || !packRoom(c)) {
        log(game, e.item.name + ' is here, and the pack is full.', 'info');
        return;
      }
      e.taken = true;
      putPack(c, e.item);
      log(game, c.name + ' picks up ' + e.item.name + '.', 'good');
      return;
    }
  }
}

export function move(game, cmd) {
  if (!game || game.phase !== 'play' || game.paused) return { ok: false, reason: 'busy' };
  if (cmd === 'turnLeft') {
    game.facing = (game.facing + 3) & 3;
    reveal(game);
    announceLook(game);
    return { ok: true, turned: true };
  }
  if (cmd === 'turnRight') {
    game.facing = (game.facing + 1) & 3;
    reveal(game);
    announceLook(game);
    return { ok: true, turned: true };
  }
  let face = game.facing;
  if (cmd === 'back') face = (game.facing + 2) & 3;
  else if (cmd === 'strafeLeft') face = (game.facing + 3) & 3;
  else if (cmd === 'strafeRight') face = (game.facing + 1) & 3;
  else if (cmd !== 'forward') return { ok: false, reason: 'bad' };
  const nx = game.x + DX[face];
  const ny = game.y + DY[face];
  const floor = currentFloor(game);
  const m = livingMonsterAt(floor, nx, ny);
  if (m && (cmd === 'forward' || cmd === 'back')) {
    attackMonster(game, m);
    return { ok: true, bumped: true, sound: 'hit' };
  }
  if (ny < 0 || nx < 0 || ny >= MAP || nx >= MAP || blocksMove(floor.tiles[ny][nx]) || m) {
    const t = ny >= 0 && nx >= 0 && ny < MAP && nx < MAP ? floor.tiles[ny][nx] : TILE.WALL;
    if (m) log(game, m.name + ' is in the way.', 'info');
    else if (t === TILE.LOCKED) log(game, game.keys ? 'A locked door. Use it with a key.' : 'A locked door. It wants a key.', 'info');
    else if (t === TILE.GATE) log(game, 'An iron gate. A lever nearby may lift it.', 'info');
    else log(game, 'Stone.', 'info');
    return { ok: false, reason: 'blocked' };
  }
  game.x = nx;
  game.y = ny;
  game.noise = Math.max(game.noise || 0, 5);
  pickupAt(game, nx, ny);
  const stepped = currentFloor(game).entities.find(e => e.kind === 'mark' && e.x === nx && e.y === ny);
  if (stepped) finishQuest(game, stepped.q || 'hidden');
  reveal(game);
  announceLook(game);
  return { ok: true, moved: true };
}

function swingOrder(game) {
  const out = [];
  for (const c of game.party) if (c.hp > 0 && c.row === 'front') out.push(c);
  const sel = game.party[game.selected];
  if (sel && sel.hp > 0 && !out.includes(sel)) out.push(sel);
  if (!out.length) {
    const c = selectedChamp(game);
    if (c) out.push(c);
  }
  return out;
}

function champAttack(game, c, m) {
  if (!c || c.hp <= 0) return { ok: false, reason: 'down' };
  const melee = c.row === 'front';
  const cost = melee ? 3 : 4;
  if (c.sta < cost) return { ok: false, reason: 'stamina' };
  c.sta -= cost;
  game.noise = Math.max(game.noise || 0, 8);
  if (m.sub === 'ghost' || m.magicOnly) {
    log(game, c.name + ' swings through ' + m.name + '. Only magic bites.', 'info');
    floater(game, 'pass', 'miss');
    return { ok: true, dmg: 0 };
  }
  let dmg = weaponAtk(c) - m.def;
  if (!melee) dmg -= 1;
  if (game.rng.next() < 0.18) dmg += 2;
  dmg = Math.max(1, dmg);
  m.hp -= dmg;
  log(game, c.name + ' hits ' + m.name + ' for ' + dmg + '.', 'info');
  floater(game, String(dmg), 'hit');
  if (m.hp <= 0) killMonster(game, m, c);
  else {
    m.anim = 'hurt';
    m.animMs = 240;
    burst(game, m.x + 0.5, m.y + 0.5, [1, 0.84, 0.5], 7, 180);
  }
  return { ok: true, dmg };
}

function attackMonster(game, m) {
  const champs = swingOrder(game);
  if (!champs.length) return { ok: false, reason: 'down' };
  let any = false;
  let total = 0;
  const breath = [];
  for (const c of champs) {
    if (!m.alive) break;
    const r = champAttack(game, c, m);
    if (r.reason === 'stamina') breath.push(c.name);
    else if (r.ok) {
      any = true;
      total += r.dmg || 0;
    }
  }
  if (!any && breath.length) {
    log(game, breath.join(' and ') + (breath.length > 1 ? ' are' : ' is') + ' out of breath.', 'info');
    return { ok: false, reason: 'stamina' };
  }
  return { ok: any, dmg: total };
}

export function attack(game) {
  if (!game || game.phase !== 'play' || game.paused) return { ok: false, reason: 'busy' };
  const champs = swingOrder(game);
  if (!champs.length) return { ok: false, reason: 'down' };
  const max = champs.some(c => c.row === 'front') ? 1 : 5;
  const m = firstAlong(game, max);
  if (!m) {
    if (!noteAhead(game)) {
      log(game, 'Nothing ahead.', 'info');
      floater(game, 'miss', 'miss');
    }
    return { ok: false, reason: 'none' };
  }
  return attackMonster(game, m);
}

export function attackOne(game, index) {
  if (!game || game.phase !== 'play' || game.paused) return { ok: false, reason: 'busy' };
  const c = game.party[index];
  if (!c || c.hp <= 0) return { ok: false, reason: 'down' };
  const max = c.row === 'front' ? 1 : 5;
  const m = firstAlong(game, max);
  if (!m) {
    if (!noteAhead(game)) {
      log(game, 'Nothing ahead.', 'info');
      floater(game, 'miss', 'miss');
    }
    return { ok: false, reason: 'none' };
  }
  const r = champAttack(game, c, m);
  if (r.reason === 'stamina') log(game, c.name + ' is out of breath.', 'info');
  return r;
}

function applyLoot(game, loot, who) {
  if (!loot) return;
  if (loot.type === 'gold') {
    game.gold += loot.amount;
    log(game, loot.amount + ' coins in the dust.', 'good');
    return;
  }
  if (loot.type === 'potion' || loot.type === 'food' || loot.type === 'drink') {
    const c = who && packRoom(who) ? who : living(game).find(ch => packRoom(ch));
    if (!c) {
      game.gold += 2;
      log(game, 'A find, and no one can carry it.', 'info');
      return;
    }
    putPack(c, loot);
    if (loot.type === 'potion') log(game, c.name + ' takes a ' + loot.potion + ' vial.', 'good');
    else log(game, c.name + ' takes ' + (loot.name || 'a ration') + '.', 'good');
    return;
  }
  if (loot.type === 'weapon' || loot.type === 'armor') {
    const c = who || selectedChamp(game);
    if (!c) return;
    ensureGear(c);
    const gear = normalizeItem(loot);
    const cur = gear && gear.slot ? c.equip[gear.slot] : null;
    const score = (it) => (it ? (it.atk || 0) * 10 + (it.def || 0) : -1);
    if (gear && gear.slot && score(gear) > score(cur)) {
      c.equip[gear.slot] = gear;
      if (cur && !putPack(c, cur)) dropGear(game, cur);
      syncLegacy(c);
      log(game, c.name + ' equips ' + gear.name + '.', 'good');
    } else if (loot.type === 'weapon') {
      game.gold += 4;
      log(game, loot.name + ' is no improvement. You take the coins instead.', 'info');
    } else {
      game.gold += 4;
      log(game, loot.name + ' is no improvement.', 'info');
    }
  }
}

export function useItem(game, champIndex, itemIndex) {
  if (!game || game.phase !== 'play') return { ok: false };
  const c = game.party[champIndex];
  if (!c) return { ok: false };
  ensureGear(c);
  let seen = -1;
  for (let i = 0; i < c.pack.length; i++) {
    if (!isConsumable(c.pack[i])) continue;
    seen++;
    if (seen === itemIndex) {
      const r = consumeAt(game, c, i);
      checkDefeat(game);
      return r;
    }
  }
  return { ok: false };
}

export function runeSkill(c) {
  if (!c) return 0;
  const base = c.role === 'mage' ? 2 : c.role === 'priest' ? 1 : 0;
  return Math.min(6, base + Math.floor((c.rune || 0) / 4));
}

function runeRecipe(element, form) {
  const key = element + '+' + form;
  const table = {
    'ash+bolt': { name: 'Fireball', kind: 'bolt', hue: [1, 0.38, 0.06], dmg: 8 },
    'vita+mend': { name: 'Heal', kind: 'heal', hue: [0.45, 0.95, 0.55], heal: 10 },
    'glim+shell': { name: 'Shield', kind: 'ward', hue: [0.4, 0.85, 0.5] },
    'glim+bolt': { name: 'Light', kind: 'light', hue: [0.85, 0.9, 1] },
    'vita+bolt': { name: 'Spirit', kind: 'bolt', hue: [0.55, 0.72, 1], dmg: 6, ghost: 8, slow: 4000 },
    'ash+mend': { name: 'Cauterize', kind: 'heal', hue: [1, 0.55, 0.2], heal: 6 },
    'ash+shell': { name: 'Ember ward', kind: 'ward', hue: [1, 0.45, 0.12] },
    'vita+shell': { name: 'Mend ward', kind: 'heal', hue: [0.5, 0.9, 0.55], heal: 6, ward: true },
    'glim+mend': { name: 'Calm', kind: 'light', hue: [0.8, 0.88, 1] },
  };
  return table[key] || null;
}

export function setRunes(game, power, element, form) {
  if (!game) return;
  if (power) game.runePower = power;
  if (element) game.runeElement = element;
  if (form) game.runeForm = form;
}

export function castRunes(game, powerId, elementId, formId) {
  if (!game || game.phase !== 'play' || game.paused) return { ok: false, reason: 'busy' };
  const power = RUNE_POWERS.find(r => r.id === powerId);
  const element = RUNE_ELEMENTS.find(r => r.id === elementId);
  const form = RUNE_FORMS.find(r => r.id === formId);
  if (!power || !element || !form) return { ok: false, reason: 'bad' };
  const recipe = runeRecipe(element.id, form.id);
  const cost = power.cost;
  const c = caster(game, recipe ? Math.max(2, cost - Math.floor(runeSkill(caster(game, cost) || { role: '', rune: 0 }) / 3)) : 1);
  if (!c) {
    log(game, 'No one has the mana.', 'info');
    return { ok: false, reason: 'mana' };
  }
  const skill = runeSkill(c);
  const pay = Math.max(2, cost - Math.floor(skill / 3));
  if (c.mana < pay) {
    log(game, 'No one has the mana for ' + (recipe ? recipe.name : 'that casting') + '.', 'info');
    return { ok: false, reason: 'mana' };
  }
  if (!recipe) {
    c.mana -= 1;
    c.rune = (c.rune || 0) + 1;
    log(game, c.name + ' speaks the runes. They do not bind.', 'info');
    return { ok: false, reason: 'fizzle' };
  }
  const gap = power.tier - (skill + 1);
  if (gap > 0 && game.rng.next() < gap * 0.22) {
    c.mana -= Math.max(1, Math.floor(pay / 2));
    c.rune = (c.rune || 0) + 1;
    log(game, c.name + ' fumbles the runes.', 'info');
    return { ok: false, reason: 'fizzle' };
  }
  if (recipe.kind === 'bolt') {
    const m = firstAlong(game, 4);
    if (!m) {
      log(game, recipe.name + ' finds nothing to strike.', 'info');
      return { ok: false, reason: 'none' };
    }
    c.mana -= pay;
    c.rune = (c.rune || 0) + power.tier;
    const bonus = (c.role === 'mage' ? c.level : 0) + Math.floor(skill / 2) + (power.tier - 1) * 4;
    let dmg = recipe.dmg + bonus - Math.floor(m.def / 2);
    if (m.sub === 'ghost' || m.magicOnly) dmg += recipe.ghost || 4;
    dmg = Math.max(1, dmg);
    m.hp -= dmg;
    if (recipe.slow) m.slowMs = recipe.slow;
    floater(game, String(dmg), 'spell');
    burst(game, m.x + 0.5, m.y + 0.5, recipe.hue, 16, 640);
    game.noise = Math.max(game.noise || 0, 7);
    log(game, c.name + ' casts ' + recipe.name + '. ' + m.name + ' takes ' + dmg + '.', 'good');
    if (m.hp <= 0) killMonster(game, m, c);
    else { m.anim = 'hurt'; m.animMs = 280; }
    return { ok: true, name: recipe.name };
  }
  if (recipe.kind === 'heal') {
    const hurt = game.party.filter(ch => ch.hp < ch.maxHp).sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
    if (!hurt && !recipe.ward) {
      log(game, 'No one is hurt.', 'info');
      return { ok: false, reason: 'none' };
    }
    c.mana -= pay;
    c.rune = (c.rune || 0) + power.tier;
    if (hurt) {
      const amount = recipe.heal + (power.tier - 1) * 6 + (c.role === 'priest' ? c.level * 2 : 0) + skill;
      if (hurt.hp <= 0) hurt.hp = Math.min(hurt.maxHp, amount);
      else hurt.hp = Math.min(hurt.maxHp, hurt.hp + amount);
      log(game, c.name + ' casts ' + recipe.name + '. ' + hurt.name + ' steadies.', 'good');
    }
    if (recipe.ward) {
      game.wardMs = Math.max(game.wardMs || 0, 6000 * power.tier);
      if (!hurt) log(game, c.name + ' casts ' + recipe.name + '.', 'good');
    }
    burst(game, game.x + 0.5, game.y + 0.5, recipe.hue, 10, 420);
    return { ok: true, name: recipe.name };
  }
  c.mana -= pay;
  c.rune = (c.rune || 0) + power.tier;
  game.noise = Math.max(game.noise || 0, 4);
  if (recipe.kind === 'ward') {
    game.wardMs = Math.max(game.wardMs || 0, 7000 * power.tier);
    burst(game, game.x + 0.5, game.y + 0.5, recipe.hue, 8, 900);
    log(game, c.name + ' casts ' + recipe.name + '. A ward settles on the party.', 'good');
    return { ok: true, name: recipe.name };
  }
  game.gleamMs = Math.max(game.gleamMs || 0, 8000 * power.tier);
  burst(game, game.x + 0.5, game.y + 0.5, recipe.hue, 12, 700);
  reveal(game);
  log(game, c.name + ' casts ' + recipe.name + '. The dark pulls back.', 'good');
  return { ok: true, name: recipe.name };
}

export function cast(game, spellId) {
  if (spellId && LEGACY_RUNES[spellId]) {
    const [p, e, f] = LEGACY_RUNES[spellId];
    return castRunes(game, p, e, f);
  }
  if (!game) return { ok: false, reason: 'bad' };
  return castRunes(game, game.runePower || 'spark', game.runeElement || 'ash', game.runeForm || 'bolt');
}

function giveUnique(game, item) {
  const c = selectedChamp(game);
  if (!c || !item) return;
  ensureGear(c);
  const gear = normalizeItem(item);
  if (!gear || !gear.slot) return;
  const prev = c.equip[gear.slot];
  c.equip[gear.slot] = gear;
  if (prev && !putPack(c, prev)) dropGear(game, prev);
  syncLegacy(c);
  log(game, c.name + ' equips ' + gear.name + '.', 'good');
}

function finishQuest(game, id) {
  if (!game.quests || !QUEST_DEFS[id] || game.quests[id] === 'done') return;
  const def = QUEST_DEFS[id];
  game.quests[id] = 'done';
  if (def.xp) grantXp(game, def.xp);
  if (def.gold) {
    game.gold += def.gold;
    log(game, def.title + ' is done. ' + def.gold + ' coins.', 'good');
  } else {
    log(game, def.title + ' is done.', 'good');
  }
  if (def.item) giveUnique(game, def.item);
  const n = Number(id.slice(6));
  if (id.startsWith('story-') && QUEST_DEFS['story-' + (n + 1)] && game.quests['story-' + (n + 1)] === 'later') {
    game.quests['story-' + (n + 1)] = 'active';
  }
}

function checkLair(game) {
  if (!game.quests || game.quests.lair === 'done') return;
  const floor = game.floors[3];
  if (!floor) return;
  if (floor.entities.some(e => e.lair && e.alive)) return;
  if (!floor.entities.some(e => e.lair)) return;
  finishQuest(game, 'lair');
}

function revealHub(game) {
  for (let y = 13; y <= 19; y++) {
    for (let x = 12; x <= 21; x++) game.explored.add('hub:' + x + ',' + y);
  }
}

function enterHub(game) {
  game.inHub = true;
  game.x = HUB_ENTRY.x;
  game.y = HUB_ENTRY.y;
  game.facing = 1;
  game.talk = null;
  game.lookKey = '';
  log(game, 'The waystation. A fire between floors, and the next stair ahead.', 'good');
  revealHub(game);
  game.wantAutosave = true;
  saveAuto(game);
  announceLook(game);
  return 'stairs';
}

function leaveHub(game) {
  if (game.floor >= FLOORS - 1) {
    log(game, 'There is no floor below the seal.', 'info');
    return 'blocked';
  }
  const left = game.floor;
  if (left !== WARDEN_FLOOR && left !== FLOORS - 1) finishQuest(game, 'story-' + left);
  game.inHub = false;
  game.talk = null;
  game.floor += 1;
  const up = findTile(currentFloor(game).tiles, TILE.STAIRS_UP);
  game.x = up.x;
  game.y = up.y;
  log(game, FLOOR_NAMES[game.floor] + '.', 'good');
  reveal(game);
  return 'stairs';
}

function linesFor(game, id) {
  if (id === 'sable') {
    if (game.quests.fetch === 'have') return ['Sable catches the shard light. "That is the one. The fire keeps its bargains."'];
    if (game.quests.fetch === 'done') return ['Sable nods at the shard by the fire.'];
    return ['Sable turns a coin. "An ember shard sits in the low vault. Bring it back here."'];
  }
  if (id === 'pell') {
    if (game.quests.rescue === 'done') return ['Pell is by the fire. "The wrap is yours. I can find my own stair from here."'];
    return [
      'Pell is on the floor, soot on their face. "The ash galleries turned me around."',
      '"Get me out of this room and I can reach the waystation."',
    ];
  }
  if (id === 'nell') {
    if (game.quests.hidden === 'done' && !game.nellPaid) return ['Nell listens. "You found the niche. Take the cloak. The fire is for anyone who comes back."'];
    if (game.nellPaid) return ['Nell tends the pots. "The black stair is still on the map."'];
    return ['Nell keeps the waystation. "A cracked niche opens on the black stair. Find it, so we know the deep is open."'];
  }
  return ['The fire pops.'];
}

function openTalk(game, id) {
  const lines = linesFor(game, id);
  game.talk = { id, i: 0, lines, name: id === 'pell' ? 'Pell' : id === 'sable' ? 'Sable' : 'Nell' };
  log(game, lines[0], 'info');
}

function applyTalk(game, id) {
  if (id === 'pell' && game.quests.rescue !== 'done') {
    for (const f of game.floors) {
      const e = f.entities.find(x => x.kind === 'npc' && x.id === 'pell');
      if (e) e.taken = true;
    }
    if (!game.hub.entities.some(e => e.id === 'pell')) {
      game.hub.entities.push({ kind: 'npc', id: 'pell', name: 'Pell', x: 18, y: 18 });
    }
    finishQuest(game, 'rescue');
  }
  if (id === 'sable' && game.quests.fetch === 'have') finishQuest(game, 'fetch');
  if (id === 'nell' && game.quests.hidden === 'done' && !game.nellPaid) {
    game.nellPaid = true;
    giveUnique(game, { type: 'armor', name: 'waystation cloak', def: 2 });
    game.gold += 6;
    log(game, 'Nell folds a cloak into your hands.', 'good');
  }
}

export function advanceTalk(game) {
  if (!game || !game.talk) return { ok: false };
  const talk = game.talk;
  if (talk.i >= talk.lines.length - 1) {
    applyTalk(game, talk.id);
    game.talk = null;
    return { ok: true, closed: true };
  }
  talk.i += 1;
  log(game, talk.lines[talk.i], 'info');
  return { ok: true };
}

export function questLog(game) {
  if (!game || !game.quests) return [];
  return Object.keys(QUEST_DEFS).map(id => {
    const d = QUEST_DEFS[id];
    return { id, kind: d.kind, title: d.title, detail: d.detail, status: game.quests[id] || 'later' };
  }).filter(q => q.status !== 'later');
}

export function questMarkers(game) {
  const out = [];
  if (!game || !game.quests) return out;
  const show = (id) => game.quests[id] === 'active' || game.quests[id] === 'have';
  for (let fi = 0; fi < game.floors.length; fi++) {
    for (const e of game.floors[fi].entities) {
      if (!e.q || e.taken) continue;
      if (e.kind === 'relic' && game.quests.fetch === 'have') continue;
      if (!show(e.q)) continue;
      out.push({ floor: fi, x: e.x, y: e.y, id: e.q });
    }
  }
  for (let fi = 0; fi < FLOORS; fi++) {
    const id = 'story-' + fi;
    if (!show(id)) continue;
    if (fi === FLOORS - 1) {
      const seal = game.floors[fi].entities.find(e => e.sub === 'seal' && e.alive);
      if (seal) out.push({ floor: fi, x: seal.x, y: seal.y, id });
      continue;
    }
    if (fi === WARDEN_FLOOR) {
      const warden = game.floors[fi].entities.find(e => e.sub === 'warden' && e.alive);
      if (warden) out.push({ floor: fi, x: warden.x, y: warden.y, id });
      continue;
    }
    const down = findTile(game.floors[fi].tiles, TILE.STAIRS_DOWN);
    out.push({ floor: fi, x: down.x, y: down.y, id });
  }
  if (game.inHub && game.quests.fetch === 'have') {
    const sable = game.hub.entities.find(e => e.id === 'sable');
    if (sable) out.push({ floor: -1, hub: true, x: sable.x, y: sable.y, id: 'fetch' });
  }
  return out;
}

export function interact(game) {
  if (!game || game.phase !== 'play' || game.paused) return { ok: false, reason: 'busy' };
  const fx = game.x + DX[game.facing];
  const fy = game.y + DY[game.facing];
  const ahead = useCell(game, fx, fy);
  if (ahead) return { ok: true, sound: ahead };
  const here = useCell(game, game.x, game.y);
  if (here) return { ok: true, sound: here };
  if (noteAhead(game)) return { ok: false, reason: 'far' };
  log(game, 'Nothing to use.', 'info');
  return { ok: false, reason: 'none' };
}

function takeTorch(game, prop) {
  if (game.torch) {
    log(game, 'You already carry a torch. This one stays on the wall.', 'info');
    return 'info';
  }
  prop.taken = true;
  game.torch = true;
  game.lookKey = '';
  log(game, 'You take the torch. It burns in the dark ahead of you.', 'good');
  return 'chest';
}

function restAtFire(game) {
  if ((game.restMs || 0) > 0) {
    log(game, 'The fire is warm. Rest again in a moment.', 'info');
    return 'info';
  }
  game.restMs = 14000;
  let any = false;
  for (const c of game.party) {
    if (c.hp <= 0) continue;
    const before = c.hp;
    c.hp = Math.min(c.maxHp, c.hp + 8);
    c.sta = Math.min(c.maxSta, c.sta + 6);
    c.mana = Math.min(c.maxMana, c.mana + 4);
    if (c.hp > before || c.sta < c.maxSta) any = true;
  }
  log(game, any ? 'The party rests at the campfire. A few wounds close.' : 'The party rests at the campfire.', 'good');
  return 'chest';
}

function useCell(game, x, y) {
  if (x < 0 || y < 0 || x >= MAP || y >= MAP) return false;
  const floor = currentFloor(game);
  const t = floor.tiles[y][x];
  if (t === TILE.LOCKED) {
    if (game.keys <= 0) {
      log(game, 'The lock holds. You need a key.', 'info');
      return 'locked';
    }
    game.keys -= 1;
    floor.tiles[y][x] = TILE.DOOR_OPEN;
    log(game, 'The key turns. The door opens.', 'good');
    reveal(game);
    return 'door';
  }
  if (t === TILE.STAIRS_DOWN) {
    if (livingMonsterAt(floor, x, y)) {
      log(game, 'Something stands on the stair.', 'info');
      return 'blocked';
    }
    if (game.inHub) return leaveHub(game);
    if (game.floor >= FLOORS - 1) return false;
    return enterHub(game);
  }
  if (t === TILE.STAIRS_UP) {
    if (game.inHub) {
      game.inHub = false;
      const down = findTile(currentFloor(game).tiles, TILE.STAIRS_DOWN);
      game.x = down.x;
      game.y = down.y;
      log(game, 'Back into ' + FLOOR_NAMES[game.floor] + '.', 'info');
      reveal(game);
      return 'stairs';
    }
    if (game.floor <= 0) {
      log(game, 'The way you came in is shut.', 'info');
      return 'blocked';
    }
    game.floor -= 1;
    const down = findTile(currentFloor(game).tiles, TILE.STAIRS_DOWN);
    game.x = down.x;
    game.y = down.y;
    log(game, FLOOR_NAMES[game.floor] + '.', 'info');
    reveal(game);
    return 'stairs';
  }
  const npc = floor.entities.find(e => e.kind === 'npc' && !e.taken && e.x === x && e.y === y);
  if (npc) {
    openTalk(game, npc.id);
    return 'talk';
  }
  const relic = floor.entities.find(e => e.kind === 'relic' && !e.taken && e.x === x && e.y === y);
  if (relic) {
    relic.taken = true;
    if (game.quests && game.quests.fetch === 'active') game.quests.fetch = 'have';
    log(game, 'The ember shard is warm. Sable keeps a fire at the waystation.', 'good');
    return 'chest';
  }
  const mark = floor.entities.find(e => e.kind === 'mark' && e.x === x && e.y === y);
  if (mark) {
    finishQuest(game, mark.q || 'hidden');
    return 'chest';
  }
  const prop = floor.entities.find(e => e.kind === 'prop' && !e.taken && e.x === x && e.y === y);
  if (prop && prop.sub === 'torch') return takeTorch(game, prop);
  if (prop && prop.sub === 'fire') return restAtFire(game);
  if (prop) {
    const found = featureAt(game, x, y);
    if (found) log(game, found.near, 'info');
    return 'info';
  }
  const loose = floor.entities.find(e => (e.kind === 'key' || e.kind === 'potion' || e.kind === 'item') && !e.taken && e.x === x && e.y === y);
  if (loose) {
    pickupAt(game, x, y);
    return 'chest';
  }
  const lever = floor.entities.find(e => e.kind === 'lever' && e.x === x && e.y === y);
  if (lever) {
    const gt = floor.tiles[lever.gy][lever.gx];
    if (gt === TILE.GATE) {
      floor.tiles[lever.gy][lever.gx] = TILE.GATE_OPEN;
      log(game, 'The lever clanks. A gate lifts.', 'good');
    } else if (gt === TILE.GATE_OPEN) {
      floor.tiles[lever.gy][lever.gx] = TILE.GATE;
      log(game, 'The lever clanks. A gate drops.', 'info');
    }
    reveal(game);
    return 'lever';
  }
  const chest = floor.entities.find(e => e.kind === 'chest' && e.x === x && e.y === y && !e.opened);
  if (chest) {
    chest.opened = true;
    applyLoot(game, chest.loot, selectedChamp(game));
    return 'chest';
  }
  return false;
}

export function tick(game, ms) {
  if (!game || game.phase !== 'play' || game.paused) return;
  const dt = Math.max(0, Math.min(4000, ms | 0));
  game.time += dt;
  if (game.hurtMs > 0) game.hurtMs = Math.max(0, game.hurtMs - dt);
  if (game.shake > 0) game.shake = Math.max(0, game.shake - dt);
  if (game.floaters && game.floaters.length) {
    for (const f of game.floaters) f.life -= dt;
    if (game.floaters.some(f => f.life <= 0)) game.floaters = game.floaters.filter(f => f.life > 0);
  }
  if (game.particles && game.particles.length) {
    for (const p of game.particles) {
      p.life -= dt;
      p.x += p.vx * dt * 0.001;
      p.y += p.vy * dt * 0.001;
    }
    if (game.particles.some(p => p.life <= 0)) game.particles = game.particles.filter(p => p.life > 0);
  }
  if (game.lights && game.lights.length) {
    for (const L of game.lights) L.life -= dt;
    if (game.lights.some(L => L.life <= 0)) game.lights = game.lights.filter(L => L.life > 0);
  }
  if (game.gleamMs > 0) {
    const before = game.gleamMs;
    game.gleamMs = Math.max(0, game.gleamMs - dt);
    if (before > 0 && game.gleamMs === 0) log(game, 'The gleam fades.', 'info');
  }
  if (game.wardMs > 0) game.wardMs = Math.max(0, game.wardMs - dt);
  if (game.restMs > 0) game.restMs = Math.max(0, game.restMs - dt);
  if (game.noise > 0) game.noise = Math.max(0, game.noise - dt / 450);
  game.packNoted = false;
  game.regenSta += dt;
  game.regenMana += dt;
  while (game.regenSta >= 800) {
    game.regenSta -= 800;
    for (const c of living(game)) if (c.sta < c.maxSta) c.sta += 1;
  }
  while (game.regenMana >= 1200) {
    game.regenMana -= 1200;
    for (const c of living(game)) if (c.mana < c.maxMana) c.mana += 1;
  }
  const floor = currentFloor(game);
  for (const e of floor.entities) {
    if (e.kind !== 'monster') continue;
    if (e.animMs > 0) {
      e.animMs = Math.max(0, e.animMs - dt);
      if (e.animMs === 0 && e.alive) e.anim = 'idle';
    }
    if (e.moveMs > 0) e.moveMs = Math.max(0, e.moveMs - dt);
    if (e.alertMs > 0) e.alertMs = Math.max(0, e.alertMs - dt);
    if (!e.alive) continue;
    if (e.slowMs > 0) e.slowMs = Math.max(0, e.slowMs - dt);
    e.cool -= dt;
    if (e.cool > 0) continue;
    e.cool = e.speed * (e.slowMs > 0 ? 1.8 : 1);
    if (game.phase !== 'play') return;
    monsterAct(game, e);
  }
}

export function floodReachable(tiles, sx, sy) {
  const seen = new Set();
  const q = [[sx, sy]];
  seen.add(sx + ',' + sy);
  while (q.length) {
    const [x, y] = q.shift();
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d];
      const ny = y + DY[d];
      const k = nx + ',' + ny;
      if (seen.has(k)) continue;
      if (nx < 0 || ny < 0 || nx >= MAP || ny >= MAP) continue;
      if (blocksMove(tiles[ny][nx])) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return seen;
}

export function summarize(game) {
  const out = [];
  for (let i = 0; i < game.floors.length; i++) {
    const f = game.floors[i];
    const up = findTile(f.tiles, TILE.STAIRS_UP);
    const seen = floodReachable(f.tiles, up.x, up.y);
    let stairs = false;
    let locked = 0;
    let gates = 0;
    for (let y = 0; y < MAP; y++) {
      for (let x = 0; x < MAP; x++) {
        const t = f.tiles[y][x];
        if (t === TILE.STAIRS_DOWN && seen.has(x + ',' + y)) stairs = true;
        if (t === TILE.LOCKED) locked += 1;
        if (t === TILE.GATE) gates += 1;
      }
    }
    const monsters = f.entities.filter(e => e.kind === 'monster').length;
    const keys = f.entities.filter(e => e.kind === 'key').length;
    const levers = f.entities.filter(e => e.kind === 'lever').length;
    out.push({
      floor: i,
      stairsReachable: i === FLOORS - 1 ? true : stairs,
      locked,
      gates,
      monsters,
      keys,
      levers,
      monsterHp: f.entities.filter(e => e.kind === 'monster').reduce((s, e) => s + e.maxHp, 0),
    });
  }
  return out;
}

export function serialize(game) {
  return {
    v: SAVE_V,
    seed: game.seed,
    difficulty: game.difficulty,
    floor: game.floor,
    x: game.x,
    y: game.y,
    facing: game.facing,
    party: game.party,
    selected: game.selected,
    keys: game.keys,
    gold: game.gold,
    kills: game.kills,
    time: game.time,
    phase: game.phase,
    gleamMs: game.gleamMs,
    wardMs: game.wardMs,
    inHub: !!game.inHub,
    quests: game.quests,
    nellPaid: !!game.nellPaid,
    torch: !!game.torch,
    explored: [...game.explored],
    log: game.log.slice(-20),
    rng: game.rng.state(),
    floors: game.floors.map(f => ({
      tiles: f.tiles,
      entities: f.entities,
    })),
  };
}

export function hydrate(data) {
  if (!data || data.v !== SAVE_V || !Array.isArray(data.party) || data.party.length !== 4) return null;
  if (!Array.isArray(data.floors) || data.floors.length !== FLOORS) return null;
  const diffName = DIFF[data.difficulty] ? data.difficulty : 'normal';
  const game = {
    v: SAVE_V,
    seed: data.seed >>> 0,
    difficulty: diffName,
    floors: data.floors.map(f => ({
      tiles: f.tiles,
      entities: f.entities,
    })),
    floor: data.floor | 0,
    x: data.x | 0,
    y: data.y | 0,
    facing: data.facing & 3,
    party: data.party,
    selected: data.selected | 0,
    keys: data.keys | 0,
    gold: data.gold | 0,
    kills: data.kills | 0,
    time: data.time | 0,
    phase: data.phase === 'won' || data.phase === 'lost' ? data.phase : 'play',
    paused: false,
    explored: new Set(data.explored || []),
    log: data.log || [],
    logRev: 1,
    gleamMs: data.gleamMs | 0,
    wardMs: data.wardMs | 0,
    regenSta: 0,
    regenMana: 0,
    hurtMs: 0,
    shake: 0,
    floaters: [],
    particles: [],
    lights: [],
    levelPing: 0,
    inHub: !!data.inHub,
    hub: buildHub(),
    quests: data.quests && data.quests['story-0'] ? data.quests : freshQuests(),
    talk: null,
    nellPaid: !!data.nellPaid,
    torch: !!data.torch,
    noise: 0,
    restMs: 0,
    lookKey: '',
    wantAutosave: false,
    runePower: 'spark',
    runeElement: 'ash',
    runeForm: 'bolt',
    packNoted: false,
    rng: makeRng(1),
    diff: DIFF[diffName],
  };
  game.rng.set(data.rng >>> 0);
  for (const c of game.party) ensureGear(c);
  if (game.quests.rescue === 'done' && !game.hub.entities.some(e => e.id === 'pell')) {
    game.hub.entities.push({ kind: 'npc', id: 'pell', name: 'Pell', x: 18, y: 18 });
  }
  return game;
}

function saveBox(storage) {
  return storage || (typeof localStorage !== 'undefined' ? localStorage : null);
}

function readSave(box, key) {
  if (!box) return null;
  try {
    const raw = box.getItem(key);
    if (!raw) return null;
    return hydrate(JSON.parse(raw));
  } catch (e) {
    return null;
  }
}

function peekSave(box, key) {
  if (!box) return { empty: true };
  try {
    const raw = box.getItem(key);
    if (!raw) return { empty: true };
    const data = JSON.parse(raw);
    if (!data || data.v !== SAVE_V || !Array.isArray(data.party)) return { empty: true };
    const floor = data.floor | 0;
    return {
      empty: false,
      floor,
      gold: data.gold | 0,
      inHub: !!data.inHub,
      where: data.inHub ? 'The Waystation' : (FLOOR_NAMES[floor] || 'A floor'),
    };
  } catch (e) {
    return { empty: true };
  }
}

export function saveSlot(game, slot, storage) {
  const box = saveBox(storage);
  const n = slot | 0;
  if (!box || n < 1 || n > SLOT_COUNT) return false;
  try {
    const raw = JSON.stringify(serialize(game));
    box.setItem(slotKey(n), raw);
    if (n === 1) box.setItem(SAVE_KEY, raw);
    return true;
  } catch (e) {
    return false;
  }
}

export function loadSlot(slot, storage) {
  const box = saveBox(storage);
  const n = slot | 0;
  if (!box || n < 1 || n > SLOT_COUNT) return null;
  return readSave(box, slotKey(n)) || (n === 1 ? readSave(box, SAVE_KEY) : null);
}

export function saveAuto(game, storage) {
  const box = saveBox(storage);
  if (!box) return false;
  try {
    box.setItem(AUTO_KEY, JSON.stringify(serialize(game)));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadAuto(storage) {
  return readSave(saveBox(storage), AUTO_KEY);
}

export function listSaves(storage) {
  const box = saveBox(storage);
  const out = [];
  const auto = peekSave(box, AUTO_KEY);
  out.push({ id: 'auto', label: 'Autosave', ...auto });
  for (let n = 1; n <= SLOT_COUNT; n++) {
    let row = peekSave(box, slotKey(n));
    if (row.empty && n === 1) row = peekSave(box, SAVE_KEY);
    out.push({ id: String(n), label: 'Slot ' + n, ...row });
  }
  return out;
}

export function loadContinue(storage) {
  return loadAuto(storage) || loadSlot(1, storage) || loadSlot(2, storage) || loadSlot(3, storage);
}

export function saveGame(game, storage) {
  return saveSlot(game, 1, storage);
}

export function loadGame(storage) {
  return readSave(saveBox(storage), SAVE_KEY);
}

export function hasSave(storage) {
  return loadContinue(storage) != null;
}

export function clearSave(storage) {
  const box = saveBox(storage);
  if (!box) return;
  try {
    box.removeItem(SAVE_KEY);
    box.removeItem(AUTO_KEY);
    for (let n = 1; n <= SLOT_COUNT; n++) box.removeItem(slotKey(n));
  } catch (e) { /* ignore */ }
}

/** Test and debug helpers. They mutate a live game and are not shown as buttons. */
export const debug = {
  setPos(game, x, y, floor, facing) {
    if (floor != null) game.floor = floor;
    game.x = x;
    game.y = y;
    if (facing != null) game.facing = facing & 3;
    reveal(game);
  },
  spawn(game, kind, x, y) {
    const m = makeMonster(kind || 'crawler', x, y, game.floor, game.diff, game.rng);
    currentFloor(game).entities.push(m);
    return m;
  },
  giveKey(game, n) {
    game.keys += n == null ? 1 : n;
  },
  hurt(game, index, amount) {
    const c = game.party[index];
    c.hp = Math.max(0, c.hp - amount);
  },
  wipe(game) {
    for (const c of game.party) c.hp = 0;
    checkDefeat(game);
  },
  killAll(game) {
    const floor = currentFloor(game);
    for (const e of floor.entities) {
      if (e.kind === 'monster' && e.alive) killMonster(game, e, living(game)[0] || game.party[0]);
    }
  },
};
