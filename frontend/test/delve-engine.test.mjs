import assert from 'node:assert/strict';
import {
  TILE, MAP, FLOORS, createGame, move, attack, attackOne, cast, castRunes, interact, tick,
  summarize, saveGame, loadGame, clearSave, debug, living, SPELLS, floodReachable,
  questLog, questMarkers, advanceTalk, HUB_GATE,
  saveAuto, loadAuto, saveSlot, loadSlot, listSaves,
  moveItem, dropItem, activateItem, useItem, weaponAtk, armorDef, handoffItem, SAVE_KEY,
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
const m = debug.spawn(fight, 'brute', fight.x + 1, fight.y);
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
for (let i = 0; i < 20 && m.alive; i++) attack(fight);
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
assert.equal(stairs.inHub, true, 'the stair opens the waystation');
assert.equal(stairs.floor, 0);
debug.setPos(stairs, HUB_GATE.x, HUB_GATE.y, 0, 1);
interact(stairs);
assert.equal(stairs.inHub, false);
assert.equal(stairs.floor, 1);

const gate = createGame(6, 'easy');
const warden = gate.floors[4].entities.find(e => e.sub === 'warden' && e.alive);
assert.ok(warden, 'a warden waits on floor 5');
assert.equal(gate.floors[4].tiles[warden.y][warden.x], TILE.STAIRS_DOWN);
debug.setPos(gate, warden.x, warden.y, 4, 0);
if (warden.y > 0) gate.floors[4].tiles[warden.y - 1][warden.x] = TILE.WALL;
interact(gate);
assert.equal(gate.floor, 4, 'the warden blocks the stair');
debug.killAll(gate);
assert.equal(gate.phase, 'play', 'felling the warden does not end the delve');
assert.equal(gate.quests['story-4'], 'done');
interact(gate);
assert.equal(gate.inHub, true, 'the cleared stair reaches the waystation');
assert.equal(gate.floor, 4);
debug.setPos(gate, HUB_GATE.x, HUB_GATE.y, 4, 1);
interact(gate);
assert.equal(gate.floor, 5, 'the stair opens once the warden falls');

const boss = createGame(6, 'easy');
const last = FLOORS - 1;
const seal = boss.floors[last].entities.find(e => e.sub === 'seal');
assert.ok(seal, 'the seal is the last floor');
debug.setPos(boss, seal.x, seal.y, last, 1);
debug.killAll(boss);
assert.equal(boss.phase, 'won');

const solo = createGame(1, 'normal');
const sm = debug.spawn(solo, 'brute', solo.x + 1, solo.y);
solo.facing = 1;
const staOther = solo.party[1].sta;
const soloHp = sm.hp;
const one = attackOne(solo, 0);
assert.equal(one.ok, true);
assert.ok(sm.hp < soloHp, 'Z-equivalent attack hits');
assert.equal(solo.party[1].sta, staOther, 'one champion spends only their own stamina');
assert.ok(solo.party[0].sta < solo.party[0].maxSta);
assert.ok(solo.floaters.some(f => f.kind === 'hit'));
const both0 = solo.party[0].sta;
const both1 = solo.party[1].sta;
const partySwing = attack(solo);
assert.equal(partySwing.ok, true);
assert.ok(solo.party[0].sta < both0 && solo.party[1].sta < both1, 'space swings the front rank');

const oldBox = memory();
const fresh = createGame(3, 'normal');
saveGame(fresh, oldBox);
const raw = JSON.parse(oldBox.getItem('dxedge_delve_save'));
raw.v = 1;
oldBox.setItem('dxedge_delve_save', JSON.stringify(raw));
assert.equal(loadGame(oldBox), null, 'a five-floor save does not load');

const dead = createGame(6, 'easy');
debug.wipe(dead);
assert.equal(dead.phase, 'lost');
assert.equal(living(dead).length, 0);

const regen = createGame(1, 'normal');
regen.party[0].sta = 0;
tick(regen, 800);
assert.ok(regen.party[0].sta > 0);

const fx = createGame(1, 'normal');
const fm = debug.spawn(fx, 'brute', fx.x + 1, fx.y);
fx.facing = 1;
attackOne(fx, 0);
assert.equal(fm.anim, 'hurt');
assert.ok(fm.animMs > 0);
assert.ok(fx.particles.length >= 4, 'a hit throws sparks');
cast(fx, 'kael');
assert.ok(fx.lights.some(L => L.life > 0 && L.r > 0.5), 'Kael leaves a colored light');
fm.cool = 999999;
tick(fx, 2000);
assert.equal(fm.anim, 'idle');
assert.equal(fx.particles.length, 0);

function clearLane(game, x, y, n) {
  const tiles = game.floors[0].tiles;
  for (let i = 0; i <= n; i++) tiles[y][x + i] = TILE.FLOOR;
  game.floors[0].entities = game.floors[0].entities.filter(e => e.y !== y || e.x < x || e.x > x + n);
  debug.setPos(game, x, y, 0, 1);
}

const near = createGame(1, 'normal');
clearLane(near, 8, 8, 3);
near.floors[0].entities.push({ kind: 'chest', x: 9, y: 8, opened: false, loot: { type: 'gold', amount: 7 } });
const gold0 = near.gold;
const opened = interact(near);
assert.equal(opened.ok, true);
assert.equal(opened.sound, 'chest');
assert.equal(near.gold, gold0 + 7);
assert.equal(near.floors[0].entities.find(e => e.kind === 'chest' && e.x === 9 && e.y === 8).opened, true);
interact(near);
assert.equal(near.gold, gold0 + 7, 'an open chest stays open');

const far = createGame(1, 'normal');
clearLane(far, 8, 10, 4);
far.floors[0].entities.push({ kind: 'chest', x: 10, y: 10, opened: false, loot: { type: 'gold', amount: 4 } });
const farGold = far.gold;
const missed = interact(far);
assert.equal(missed.ok, false);
assert.equal(far.floors[0].entities.find(e => e.kind === 'chest' && e.x === 10 && e.y === 10).opened, false);
assert.equal(far.gold, farGold);
assert.equal(far.log[far.log.length - 1].text, 'The chest is 2 steps ahead.');
attack(far);
assert.equal(far.log[far.log.length - 1].text, 'The chest is 2 steps ahead.');
assert.equal(far.floors[0].entities.find(e => e.kind === 'chest' && e.x === 10 && e.y === 10).opened, false);

const three = createGame(1, 'normal');
clearLane(three, 8, 12, 4);
three.floors[0].entities.push({ kind: 'chest', x: 11, y: 12, opened: false, loot: { type: 'gold', amount: 1 } });
attack(three);
assert.equal(three.log[three.log.length - 1].text, 'The chest is 3 steps ahead.');

const hidden = createGame(1, 'normal');
clearLane(hidden, 8, 14, 3);
hidden.floors[0].tiles[14][9] = TILE.WALL;
hidden.floors[0].entities.push({ kind: 'chest', x: 10, y: 14, opened: false, loot: { type: 'gold', amount: 1 } });
attack(hidden);
assert.equal(hidden.log[hidden.log.length - 1].text, 'Nothing ahead.');
interact(hidden);
assert.equal(hidden.log[hidden.log.length - 1].text, 'Nothing to use.');

const outOfReach = createGame(1, 'normal');
clearLane(outOfReach, 8, 16, 4);
debug.spawn(outOfReach, 'crawler', 11, 16);
attack(outOfReach);
assert.equal(outOfReach.log[outOfReach.log.length - 1].text, 'The ash crawler is 3 steps ahead.');

const log0 = questLog(g);
assert.ok(log0.some(q => q.id === 'story-0' && q.status === 'active'));
assert.ok(log0.some(q => q.kind === 'side' && q.status === 'active'));
assert.equal(log0.some(q => q.id === 'story-1'), false);
assert.ok(questMarkers(g).some(m => m.id === 'rescue' && m.floor === 1));

const rescue = createGame(4, 'normal');
const pell = rescue.floors[1].entities.find(e => e.id === 'pell');
assert.ok(pell, 'Pell waits in the ash galleries');
debug.setPos(rescue, pell.x, pell.y, 1, 0);
const goldBefore = rescue.gold;
interact(rescue);
assert.ok(rescue.talk && rescue.talk.id === 'pell');
advanceTalk(rescue);
advanceTalk(rescue);
assert.equal(rescue.talk, null);
assert.equal(rescue.quests.rescue, 'done');
assert.ok(rescue.gold > goldBefore);
assert.equal(rescue.party[0].armor.name, "traveler's wrap");

const fetchQ = createGame(4, 'normal');
const shard = fetchQ.floors[2].entities.find(e => e.id === 'shard');
assert.ok(shard, 'the ember shard is in the low vault');
debug.setPos(fetchQ, shard.x, shard.y, 2, 1);
interact(fetchQ);
assert.equal(shard.taken, true);
assert.equal(fetchQ.quests.fetch, 'have');
fetchQ.inHub = true;
const sable = fetchQ.hub.entities.find(e => e.id === 'sable');
debug.setPos(fetchQ, sable.x, sable.y, 2, 1);
interact(fetchQ);
advanceTalk(fetchQ);
assert.equal(fetchQ.quests.fetch, 'done');
assert.equal(fetchQ.party[0].weapon.name, 'shard knife');

const nest = createGame(4, 'normal');
assert.ok(nest.floors[3].entities.filter(e => e.lair && e.alive).length >= 3, 'the bone nest is stocked');
debug.setPos(nest, nest.x, nest.y, 3, 1);
debug.killAll(nest);
assert.equal(nest.quests.lair, 'done');

const niche = createGame(4, 'normal');
const crack = niche.floors[5].entities.find(e => e.q === 'hidden');
assert.ok(crack, 'the black stair has a niche');
debug.setPos(niche, crack.x, crack.y, 5, 0);
move(niche, 'forward');
if (niche.quests.hidden !== 'done') {
  debug.setPos(niche, crack.x, crack.y, 5, 0);
  interact(niche);
}
assert.equal(niche.quests.hidden, 'done');

assert.ok(createGame(1, 'normal').log.some(l => /entry stair/i.test(l.text)), 'the entry stair is named');

const runeGame = createGame(1, 'normal');
runeGame.selected = 3;
const runeBefore = runeGame.party[3].rune;
assert.equal(castRunes(runeGame, 'spark', 'glim', 'bolt').ok, true);
assert.ok(runeGame.gleamMs > 0, 'light rune');
assert.ok(runeGame.party[3].rune > runeBefore, 'casting raises skill');
runeGame.selected = 2;
debug.hurt(runeGame, 0, 8);
const mendHp = runeGame.party[0].hp;
assert.equal(castRunes(runeGame, 'spark', 'vita', 'mend').ok, true);
assert.ok(runeGame.party[0].hp > mendHp, 'heal rune');
assert.equal(castRunes(runeGame, 'spark', 'glim', 'shell').ok, true);
assert.ok(runeGame.wardMs > 0, 'shield rune');
const spirit = debug.spawn(runeGame, 'ghost', runeGame.x + 1, runeGame.y);
runeGame.facing = 1;
const ghostHp = spirit.hp;
attack(runeGame);
assert.equal(spirit.hp, ghostHp, 'steel misses a ghost');
assert.equal(castRunes(runeGame, 'brand', 'ash', 'bolt').ok, true);
assert.ok(spirit.hp < ghostHp, 'magic hits a ghost');

const doorAi = createGame(1, 'normal');
for (let y = 8; y <= 12; y++) {
  for (let x = 0; x < 8; x++) doorAi.floors[0].tiles[y][x] = y === 10 ? TILE.FLOOR : TILE.WALL;
}
doorAi.floors[0].tiles[10][3] = TILE.LOCKED;
debug.setPos(doorAi, 1, 10, 0, 1);
const ghostDoor = debug.spawn(doorAi, 'ghost', 5, 10);
ghostDoor.cool = 1;
ghostDoor.alertMs = 9000;
tick(doorAi, 30);
assert.equal(ghostDoor.x, 5, 'a door stops a ghost');
assert.equal(doorAi.floors[0].tiles[10][3], TILE.LOCKED, 'a ghost does not open the door');
ghostDoor.alive = false;
const bruteDoor = debug.spawn(doorAi, 'brute', 4, 10);
bruteDoor.cool = 1;
bruteDoor.alertMs = 9000;
tick(doorAi, 30);
assert.equal(doorAi.floors[0].tiles[10][3], TILE.DOOR_OPEN, 'a brute forces the door');

const runner = createGame(1, 'normal');
for (let x = 0; x < 8; x++) runner.floors[0].tiles[12][x] = TILE.FLOOR;
debug.setPos(runner, 2, 12, 0, 1);
const coward = debug.spawn(runner, 'crawler', 3, 12);
coward.hp = 1;
coward.maxHp = 20;
coward.cool = 1;
coward.alertMs = 9000;
const runnerHp = runner.party[0].hp;
tick(runner, 30);
assert.ok(coward.x !== 3 || coward.y !== 12, 'a hurt crawler runs');
assert.equal(runner.party[0].hp, runnerHp, 'fleeing skips the bite');

const camp = createGame(3, 'normal');
let campDown = null;
for (let y = 0; y < MAP && !campDown; y++) {
  for (let x = 0; x < MAP; x++) if (camp.floors[0].tiles[y][x] === TILE.STAIRS_DOWN) campDown = { x, y };
}
debug.setPos(camp, campDown.x, campDown.y, 0, 0);
interact(camp);
assert.equal(camp.wantAutosave, true, 'the waystation asks for an autosave');
assert.ok(camp.hub.entities.some(e => e.sub === 'fire'), 'the camp has a fire');
const autoBox = memory();
assert.equal(saveAuto(camp, autoBox), true);
assert.equal(loadAuto(autoBox).inHub, true);
camp.gold = 42;
assert.equal(saveSlot(camp, 2, autoBox), true);
assert.equal(loadSlot(2, autoBox).gold, 42);
const listed = listSaves(autoBox);
assert.equal(listed.find(s => s.id === 'auto').empty, false);
assert.equal(listed.find(s => s.id === '2').where, 'The Waystation');
const torch = camp.hub.entities.find(e => e.sub === 'torch');
debug.setPos(camp, torch.x, torch.y + 1, 0, 0);
interact(camp);
assert.equal(camp.torch, true, 'F takes the torch');
assert.equal(torch.taken, true);
assert.equal(camp.log.some(l => l.text.indexOf('1 step ahead') >= 0 && l.text.indexOf('torch') >= 0), false);
interact(camp);
const banner = camp.hub.entities.find(e => e.sub === 'banner');
debug.setPos(camp, banner.x, banner.y + 1, 0, 0);
interact(camp);
interact(camp);
const bannerLine = camp.log.find(l => l.text === 'A tattered banner.');
assert.ok(bannerLine && bannerLine.n >= 2, 'a repeated line collapses');
const fire = camp.hub.entities.find(e => e.sub === 'fire');
debug.hurt(camp, 0, 10);
const restHp = camp.party[0].hp;
debug.setPos(camp, fire.x - 1, fire.y, 0, 1);
interact(camp);
assert.ok(camp.party[0].hp > restHp, 'the campfire heals');

const sheet = createGame(1, 'normal');
const bryn = sheet.party[0];
assert.equal(bryn.equip.weapon.name, 'ash knife');
assert.equal(bryn.equip.body.name, 'quilted coat');
assert.equal(bryn.equip.head.name, 'leather hood');
assert.equal(bryn.pack.length, 16);
assert.equal(bryn.weapon.name, 'ash knife');
assert.equal(armorDef(bryn), bryn.def + 1);
assert.equal(weaponAtk(bryn), bryn.atk + 1);
const packSlot = bryn.pack.findIndex(it => !it);
assert.equal(moveItem(sheet, { champ: 0, where: 'equip', slot: 'body' }, { champ: 0, where: 'pack', index: packSlot }).ok, true);
assert.equal(bryn.equip.body, null);
assert.equal(bryn.armor, null);
assert.equal(bryn.pack[packSlot].name, 'quilted coat');
assert.equal(moveItem(sheet, { champ: 0, where: 'pack', index: packSlot }, { champ: 0, where: 'equip', slot: 'body' }).ok, true);
assert.equal(bryn.armor.name, 'quilted coat');
assert.equal(moveItem(sheet, { champ: 0, where: 'pack', index: 0 }, { champ: 0, where: 'equip', slot: 'weapon' }).ok, false);
debug.hurt(sheet, 0, 8);
const vialHp = bryn.hp;
assert.equal(useItem(sheet, 0, 0).ok, true);
assert.ok(bryn.hp > vialHp, 'a vial drinks from the pack');
debug.hurt(sheet, 1, 6);
const caraHp = sheet.party[1].hp;
assert.equal(useItem(sheet, 1, 0).ok, true);
assert.ok(sheet.party[1].hp > caraHp, 'food is eaten');
sheet.party[2].sta = 1;
assert.equal(useItem(sheet, 2, 0).ok, true);
assert.ok(sheet.party[2].sta > 1, 'a drink restores stamina');
const foodFrom = sheet.party[1].pack.findIndex(it => it && it.type === 'food');
if (foodFrom < 0) {
  const spare = sheet.party[3].pack.findIndex(it => !it);
  assert.equal(handoffItem(sheet, { champ: 0, where: 'equip', slot: 'head' }, 3).ok, true);
  assert.equal(sheet.party[3].pack[spare].name, 'leather hood');
} else {
  const spare = bryn.pack.findIndex(it => !it);
  assert.equal(moveItem(sheet, { champ: 1, where: 'pack', index: foodFrom }, { champ: 0, where: 'pack', index: spare }).ok, true);
  assert.equal(bryn.pack[spare].type, 'food');
}
bryn.equip.offhand = { type: 'weapon', name: 'dagger', slot: 'offhand', atk: 2, def: 0, potion: '', amount: 0 };
assert.equal(weaponAtk(bryn), bryn.atk + (bryn.equip.weapon ? bryn.equip.weapon.atk : 0) + 2);

const bag = createGame(9, 'normal');
clearLane(bag, 8, 6, 3);
assert.equal(dropItem(bag, { champ: 0, where: 'equip', slot: 'weapon' }).ok, true);
assert.equal(bag.party[0].weapon, null);
const lying = bag.floors[0].entities.find(e => e.kind === 'item' && e.name === 'ash knife');
assert.ok(lying && lying.x === 8 && lying.y === 6, 'a drop lands on the floor');
move(bag, 'forward');
move(bag, 'turnLeft');
move(bag, 'turnLeft');
const picked = interact(bag);
assert.equal(picked.ok, true);
assert.equal(lying.taken, true);
assert.ok(bag.party[0].pack.some(it => it && it.name === 'ash knife'), 'F picks the drop back up');

const kept = memory();
const round = createGame(2, 'normal');
assert.equal(saveGame(round, kept), true);
const again = loadGame(kept);
assert.equal(again.party[0].equip.head.name, 'leather hood');
assert.ok(again.party[1].pack.some(it => it && it.type === 'food'));
const stripped = JSON.parse(kept.getItem(SAVE_KEY));
for (const c of stripped.party) {
  delete c.equip;
  delete c.pack;
}
kept.setItem(SAVE_KEY, JSON.stringify(stripped));
const migrated = loadGame(kept);
assert.equal(migrated.party[0].equip.weapon.name, 'ash knife');
assert.equal(migrated.party[0].equip.body.name, 'quilted coat');
assert.equal(migrated.party[0].weapon.name, 'ash knife');
assert.ok(migrated.party[0].pack.some(it => it && it.type === 'potion'), 'an old save still has its vials');

const feet = createGame(5, 'normal');
assert.equal(activateItem(feet, { champ: 0, where: 'equip', slot: 'feet' }).ok, true);
assert.equal(feet.party[0].equip.feet, null);
assert.ok(feet.party[0].pack.some(it => it && it.name === 'road boots'));

const seen = floodReachable(g.floors[0].tiles, g.x, g.y);
assert.ok(seen.size > 20);
assert.ok(walkableCount(g, 0) > 40);

console.log('delve engine ok', {
  easyHp: easy,
  hardHp: hard,
  explored: g.explored.size,
  spells: SPELLS.map(s => s.id).join(','),
});
