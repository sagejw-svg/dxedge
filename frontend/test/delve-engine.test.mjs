import assert from 'node:assert/strict';
import {
  TILE, MAP, FLOORS, createGame, move, attack, cast, interact, tick,
  summarize, saveGame, loadGame, clearSave, debug, living, SPELLS, floodReachable,
} from '../public/delve/engine.js';

const memory = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
};

function walkableCount(game, floor) {
  const tiles = game.floors[floor].tiles;
  let n = 0;
  for (let y = 0; y < MAP; y++) for (let x = 0; x < MAP; x++) {
    if (!blocks(tiles[y][x])) n++;
  }
  return n;
}

function blocks(t) {
  return t === TILE.WALL || t === TILE.LOCKED || t === TILE.GATE;
}

const g = createGame(1, 'normal');
assert.equal(g.party.length, 4);
for (const c of g.party) {
  assert.ok(c.hp > 0 && c.maxHp >= c.hp);
  assert.ok(c.sta > 0 && c.maxSta >= c.sta);
  assert.ok(c.mana > 0 && c.maxMana >= c.mana);
}
assert.equal(g.party[0].row, 'front');
assert.equal(g.party[2].row, 'back');
assert.equal(SPELLS.length, 5);

const summary = summarize(g);
assert.equal(summary.length, FLOORS);
for (const s of summary) {
  assert.equal(s.stairsReachable, true, 'stairs reachable on floor ' + s.floor);
  assert.ok(s.locked >= 1, 'a locked door on floor ' + s.floor);
  assert.ok(s.gates >= 1, 'a gate on floor ' + s.floor);
  assert.ok(s.keys >= 1, 'a key on floor ' + s.floor);
  assert.ok(s.levers >= 1, 'a lever on floor ' + s.floor);
}
assert.ok(summary[4].monsters >= 1);

for (let seed = 1; seed <= 25; seed++) {
  const s = summarize(createGame(seed, 'hard'));
  for (const row of s) assert.equal(row.stairsReachable, true, 'seed ' + seed + ' floor ' + row.floor);
}

const easy = summarize(createGame(4, 'easy')).reduce((n, s) => n + s.monsterHp, 0);
const hard = summarize(createGame(4, 'hard')).reduce((n, s) => n + s.monsterHp, 0);
assert.ok(hard > easy, 'hard monsters are tougher than easy (' + hard + ' vs ' + easy + ')');

const before = { x: g.x, y: g.y, f: g.facing };
const turned = move(g, 'turnLeft');
assert.equal(turned.ok, true);
assert.equal(g.facing, (before.f + 3) & 3);
assert.equal(g.x, before.x);
move(g, 'turnRight');
assert.equal(g.facing, before.f);

let stepped = false;
for (let i = 0; i < 4 && !stepped; i++) {
  const px = g.x;
  const py = g.y;
  const r = move(g, 'forward');
  if (r.moved) {
    assert.ok(g.x !== px || g.y !== py);
    move(g, 'back');
    assert.equal(g.x, px);
    assert.equal(g.y, py);
    stepped = true;
  } else {
    move(g, 'turnRight');
  }
}
assert.equal(stepped, true);

const wall = createGame(1, 'normal');
debug.setPos(wall, 0, 0, 0, 0);
const blocked = move(wall, 'forward');
assert.equal(blocked.ok, false);
assert.equal(wall.x, 0);

const fight = createGame(1, 'normal');
const m = debug.spawn(fight, 'crawler', fight.x + 1, fight.y);
fight.facing = 1;
const hp0 = m.hp;
const atk = attack(fight);
assert.equal(atk.ok, true);
assert.ok(m.hp < hp0);
const mana0 = fight.party[3].mana;
fight.selected = 3;
const casted = cast(fight, 'kael');
assert.equal(casted.ok, true);
assert.ok(fight.party[3].mana < mana0);
while (m.alive) attack(fight);
assert.equal(m.alive, false);
assert.ok(fight.party.some(c => c.xp > 0 || c.level > 1));

const heal = createGame(2, 'normal');
debug.hurt(heal, 0, 10);
const hurt = heal.party[0].hp;
heal.selected = 2;
const sera = cast(heal, 'sera');
assert.equal(sera.ok, true);
assert.ok(heal.party[0].hp > hurt);

const gleamBefore = heal.explored.size;
cast(heal, 'orin');
assert.ok(heal.gleamMs > 0);
assert.ok(heal.explored.size >= gleamBefore);

const doorGame = createGame(3, 'normal');
let door = null;
const tiles = doorGame.floors[0].tiles;
for (let y = 0; y < MAP && !door; y++) {
  for (let x = 0; x < MAP; x++) if (tiles[y][x] === TILE.LOCKED) { door = { x, y }; break; }
}
assert.ok(door);
debug.setPos(doorGame, door.x - 1, door.y, 0, 1);
debug.giveKey(doorGame, 0);
doorGame.keys = 0;
const denied = interact(doorGame);
assert.equal(tiles[door.y][door.x], TILE.LOCKED);
assert.equal(denied.ok, true);
debug.giveKey(doorGame, 1);
interact(doorGame);
assert.equal(tiles[door.y][door.x], TILE.DOOR_OPEN);
assert.equal(doorGame.keys, 0);

const leverGame = createGame(3, 'normal');
const lever = leverGame.floors[0].entities.find(e => e.kind === 'lever');
assert.ok(lever);
assert.equal(leverGame.floors[0].tiles[lever.gy][lever.gx], TILE.GATE);
debug.setPos(leverGame, lever.x, lever.y, 0, 0);
interact(leverGame);
assert.equal(leverGame.floors[0].tiles[lever.gy][lever.gx], TILE.GATE_OPEN);

const box = memory();
const saveMe = createGame(8, 'normal');
move(saveMe, 'turnRight');
const spot = { x: saveMe.x, y: saveMe.y, f: saveMe.facing, floor: saveMe.floor };
saveMe.gold = 17;
assert.equal(saveGame(saveMe, box), true);
const other = createGame(99, 'hard');
assert.equal(other.seed, 99);
const loaded = loadGame(box);
assert.equal(loaded.seed, 8);
assert.equal(loaded.x, spot.x);
assert.equal(loaded.y, spot.y);
assert.equal(loaded.facing, spot.f);
assert.equal(loaded.gold, 17);
assert.equal(loaded.difficulty, 'normal');
clearSave(box);
assert.equal(loadGame(box), null);

const stairs = createGame(5, 'easy');
let down = null;
const t0 = stairs.floors[0].tiles;
for (let y = 0; y < MAP && !down; y++) {
  for (let x = 0; x < MAP; x++) if (t0[y][x] === TILE.STAIRS_DOWN) { down = { x, y }; break; }
}
debug.setPos(stairs, down.x, down.y, 0, 0);
interact(stairs);
assert.equal(stairs.floor, 1);

const boss = createGame(6, 'easy');
debug.setPos(boss, boss.x, boss.y, 4, 1);
debug.killAll(boss);
assert.equal(boss.phase, 'won');

const dead = createGame(6, 'easy');
debug.wipe(dead);
assert.equal(dead.phase, 'lost');
assert.equal(living(dead).length, 0);

const regen = createGame(1, 'normal');
regen.party[0].sta = 0;
tick(regen, 800);
assert.ok(regen.party[0].sta > 0);

const seen = floodReachable(g.floors[0].tiles, g.x, g.y);
assert.ok(seen.size > 20);
assert.ok(walkableCount(g, 0) > 40);

console.log('delve engine ok', {
  easyHp: easy,
  hardHp: hard,
  explored: g.explored.size,
  spells: SPELLS.map(s => s.id).join(','),
});
