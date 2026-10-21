/* Delve. Wires the engine to the page: keys, buttons, the raycaster, the map. */

import {
  FLOOR_NAMES, FLOORS, FACING_NAME, SPELLS, DIFF_KEY,
  RUNE_POWERS, RUNE_ELEMENTS, RUNE_FORMS,
  createGame, move, attack, attackOne, cast, castRunes, setRunes, runeSkill, interact, tick, useItem,
  EQUIP_SLOTS, moveItem, dropItem, handoffItem, activateItem, itemBlurb, weaponAtk, armorDef, xpNeed, ensureGear,
  saveGame, loadGame, hasSave, clearSave, summarize, tileAt, debug,
  questLog, advanceTalk, listSaves, loadContinue, loadSlot, loadAuto, saveSlot, saveAuto,
} from './engine.js';

const GFX_KEY = 'dxedge_delve_quality';
const MOTION_KEY = 'dxedge_delve_motion';
import { createView } from './render.js';
import { createAudio } from './audio.js';

const view = createView();
const audio = createAudio();

const canvas = document.getElementById('view');
const mapCanvas = document.getElementById('map');
const overlay = document.getElementById('overlay');
const overlayBody = document.getElementById('overlay-body');
const hurt = document.getElementById('hurt');
const partyEl = document.getElementById('party');
const logEl = document.getElementById('log');
const spellEl = document.getElementById('spells');
const floorEl = document.getElementById('floor-label');
const faceEl = document.getElementById('face-label');
const metaEl = document.getElementById('meta-label');
const muteBtn = document.getElementById('mute');
const volInput = document.getElementById('vol');
const helpEl = document.getElementById('help');
const questEl = document.getElementById('quests');
const sheetEl = document.getElementById('sheet');
const talkEl = document.getElementById('talk');
const viewWrap = document.getElementById('view-wrap');
const floatersEl = document.getElementById('floaters');

let game = null;
let reported = false;
let logSeen = -1;
let helpWasPaused = false;
let sheetWasPaused = false;
let sheetSig = '';
let sheetPick = '';
let sheetDrag = false;
let ignoreSheetBackdrop = false;
let cam = { x: 1.5, y: 1.5, ang: 0 };
let nextAct = 0;
const held = new Set();

const KEYS = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'turnLeft', ArrowLeft: 'turnLeft',
  KeyD: 'turnRight', ArrowRight: 'turnRight',
  KeyQ: 'strafeLeft',
  KeyE: 'strafeRight',
};

function snapCam() {
  if (!game) return;
  cam.x = game.x + 0.5;
  cam.y = game.y + 0.5;
  cam.ang = game.facing * Math.PI / 2;
}

function easeCam(dt) {
  if (!game) return;
  if (view.motion() === 'step') { snapCam(); return; }
  const tx = game.x + 0.5;
  const ty = game.y + 0.5;
  let da = game.facing * Math.PI / 2 - cam.ang;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  const k = 1 - Math.pow(0.0015, dt / 160);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  cam.ang += da * k;
}

function diffPref() {
  try { return localStorage.getItem(DIFF_KEY) || 'normal'; } catch (e) { return 'normal'; }
}

function setDiffPref(d) {
  try { localStorage.setItem(DIFF_KEY, d); } catch (e) { /* ignore */ }
}

function gfxPref() {
  try {
    const v = localStorage.getItem(GFX_KEY);
    if (v === 'low' || v === 'medium' || v === 'high') return v;
  } catch (e) { /* ignore */ }
  return 'medium';
}

function setGfxPref(v) {
  const q = v === 'low' || v === 'high' ? v : 'medium';
  try { localStorage.setItem(GFX_KEY, q); } catch (e) { /* ignore */ }
  view.setQuality(q);
  const sel = document.getElementById('gfx');
  if (sel && sel.value !== q) sel.value = q;
}

function motionPref() {
  try { return localStorage.getItem(MOTION_KEY) === 'step' ? 'step' : 'smooth'; }
  catch (e) { return 'smooth'; }
}

function setMotionPref(v) {
  const m = v === 'step' ? 'step' : 'smooth';
  try { localStorage.setItem(MOTION_KEY, m); } catch (e) { /* ignore */ }
  view.setMotion(m);
  const sel = document.getElementById('motion');
  if (sel && sel.value !== m) sel.value = m;
}

function start(seed, difficulty) {
  game = createGame(seed, difficulty || diffPref());
  reported = false;
  logSeen = -1;
  game.paused = false;
  snapCam();
  hideOverlay();
  paintAll();
  try { window.dxstat && window.dxstat.game('delve'); } catch (e) { /* beacon only */ }
}

function resumeLoaded(saved) {
  game = saved;
  reported = game.phase !== 'play';
  logSeen = -1;
  game.paused = false;
  snapCam();
  if (game.phase === 'play') hideOverlay();
  else showEnd();
  paintAll();
}

function hideOverlay() {
  overlay.hidden = true;
}

function showOverlay(html) {
  overlayBody.innerHTML = html;
  overlay.hidden = false;
  overlayBody.querySelectorAll('[data-diff]').forEach(btn => {
    btn.addEventListener('click', () => {
      setDiffPref(btn.getAttribute('data-diff'));
      overlayBody.querySelectorAll('[data-diff]').forEach(b => b.classList.toggle('on', b === btn));
    });
  });
  overlayBody.querySelectorAll('[data-gfx]').forEach(btn => {
    btn.addEventListener('click', () => {
      setGfxPref(btn.getAttribute('data-gfx'));
      overlayBody.querySelectorAll('[data-gfx]').forEach(b => b.classList.toggle('on', b === btn));
    });
  });
  overlayBody.querySelectorAll('[data-motion]').forEach(btn => {
    btn.addEventListener('click', () => {
      setMotionPref(btn.getAttribute('data-motion'));
      overlayBody.querySelectorAll('[data-motion]').forEach(b => b.classList.toggle('on', b === btn));
    });
  });
  const begin = overlayBody.querySelector('#begin');
  if (begin) begin.addEventListener('click', () => {
    const diff = overlayBody.querySelector('[data-diff].on');
    start(null, diff ? diff.getAttribute('data-diff') : diffPref());
  });
  const cont = overlayBody.querySelector('#continue');
  if (cont) cont.addEventListener('click', () => {
    const saved = loadContinue();
    if (saved) resumeLoaded(saved);
  });
  overlayBody.querySelectorAll('[data-load]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-load');
      const saved = id === 'auto' ? loadAuto() : loadSlot(Number(id));
      if (saved) resumeLoaded(saved);
      else note('That slot is empty.');
    });
  });
  overlayBody.querySelectorAll('[data-save]').forEach(btn => {
    btn.addEventListener('click', () => {
      const n = Number(btn.getAttribute('data-save'));
      if (game && saveSlot(game, n)) note('Saved in slot ' + n + '.');
    });
  });
  const again = overlayBody.querySelector('#again');
  if (again) again.addEventListener('click', () => showTitle());
  const resume = overlayBody.querySelector('#resume');
  if (resume) resume.addEventListener('click', () => {
    if (game) game.paused = false;
    hideOverlay();
  });
  const saveBtn = overlayBody.querySelector('#save-now');
  if (saveBtn) saveBtn.addEventListener('click', () => {
    if (game && saveGame(game)) note('Saved in this browser.');
  });
}

function diffButtons(current) {
  return ['easy', 'normal', 'hard'].map(d =>
    '<button type="button" data-diff="' + d + '" class="' + (d === current ? 'on' : '') + '">' + d + '</button>'
  ).join('');
}

function choiceButtons(attr, values, current) {
  return values.map(d =>
    '<button type="button" data-' + attr + '="' + d + '" class="' + (d === current ? 'on' : '') + '">' + d + '</button>'
  ).join('');
}

function saveRows(withSave) {
  return listSaves().map(s => {
    const detail = s.empty ? 'empty' : (s.where + ' · ' + s.gold + ' coin');
    const load = s.empty ? '' : '<button type="button" data-load="' + s.id + '">Load</button>';
    const save = withSave && s.id !== 'auto' ? '<button type="button" data-save="' + s.id + '">Save</button>' : '';
    return '<div class="slot-row"><span>' + s.label + ' · ' + detail + '</span>' + save + load + '</div>';
  }).join('');
}

function showTitle() {
  const saved = hasSave();
  showOverlay(
    '<p class="kicker">dxedge · a grid crypt</p>' +
    '<h1>Delve</h1>' +
    '<canvas id="title-art" width="720" height="180" aria-hidden="true"></canvas>' +
    '<p class="lead">Four champions, one lantern, and seven floors that are never quite the same. Walk the grid, fight what moves, and take the stairs. A warden holds the fifth stair. The seal waits at the bottom. Keys and levers open the side rooms. The way down does not need them.</p>' +
    '<p class="lead" id="title-hint">W S move, A D turn, Q E strafe. Space swings the front rank. J is the quest log. H lists every key.</p>' +
    '<div class="opt"><span>Difficulty</span><div class="diffs" role="group" aria-label="Difficulty">' + diffButtons(diffPref()) + '</div></div>' +
    '<div class="opt"><span>Graphics</span><div class="diffs" role="group" aria-label="Graphics quality">' + choiceButtons('gfx', ['low', 'medium', 'high'], gfxPref()) + '</div></div>' +
    '<div class="opt"><span>Movement</span><div class="diffs" role="group" aria-label="Movement">' + choiceButtons('motion', ['smooth', 'step'], motionPref()) + '</div></div>' +
    '<div class="row">' +
      '<button type="button" id="begin" class="primary">New delve</button>' +
      (saved ? '<button type="button" id="continue">Continue</button>' : '') +
    '</div>' +
    '<div class="saves"><p class="kicker">saves in this browser</p>' + saveRows(false) + '</div>' +
    '<ul class="help">' +
      '<li><b>W</b> forward, <b>S</b> back, <b>A</b> and <b>D</b> turn. Arrow keys do the same.</li>' +
      '<li><b>Q</b> and <b>E</b> strafe. The buttons under the view do all of this by mouse or touch.</li>' +
      '<li><b>Space</b> swings the front rank. <b>Z X C V</b> send Bryn, Cara, Ivo, and Senn alone. <b>F</b> uses and talks. <b>J</b> opens the quest log. <b>1</b>–<b>4</b> or <b>I</b> opens a character sheet. <b>R</b> casts a rune.</li>' +
    '</ul>' +
    '<p class="lead" id="title-credits">Original code. Pictures and the ember favicon are drawn in the page. Sound is synthesized here. Nothing is loaded from another site, and nothing here is taken from another dungeon game.</p>'
  );
}

function showPause() {
  if (!game) return showTitle();
  game.paused = true;
  showOverlay(
    '<p class="kicker">paused</p>' +
    '<h1>' + FLOOR_NAMES[game.floor] + '</h1>' +
    '<p class="lead">Seed ' + game.seed + ' · ' + game.difficulty + ' · ' + game.kills + ' fallen.</p>' +
    '<div class="row">' +
      '<button type="button" id="resume" class="primary">Resume</button>' +
      '<button type="button" id="again">Title</button>' +
    '</div>' +
    '<div class="saves"><p class="kicker">three slots, plus the waystation autosave</p>' + saveRows(true) + '</div>' +
    '<ul class="help">' +
      '<li>W S move, A D turn, Q E strafe. Space swings the front rank. Z X C V attack one champion. F uses. 1–4 or I opens a character sheet. R casts a rune. H lists every key.</li>' +
      '<li>Saves stay in this browser. Reaching the waystation writes the autosave.</li>' +
    '</ul>'
  );
}

function showEnd() {
  if (!game) return;
  const won = game.phase === 'won';
  showOverlay(
    '<p class="kicker">' + (won ? 'the seal breaks' : 'the lantern dies') + '</p>' +
    '<h1>' + (won ? 'You kept the crypt' : 'The crypt kept you') + '</h1>' +
    '<p class="lead">' + game.kills + ' fallen · ' + game.gold + ' coins · floor ' + (game.floor + 1) + ' of ' + FLOORS + '.</p>' +
    '<div class="row"><button type="button" id="again" class="primary">Title</button></div>'
  );
  if (!reported) {
    reported = true;
    try {
      window.dxstat && window.dxstat.gameEnd('delve', game.kills * 100 + game.gold + game.floor * 50);
    } catch (e) { /* beacon only */ }
  }
}

function note(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(note._t);
  note._t = setTimeout(() => { el.hidden = true; }, 1600);
}

function noteLevel(ping) {
  if (game && (game.levelPing || 0) > ping) audio.level();
}

function act(cmd) {
  if (!game || game.phase !== 'play' || game.paused || helpOpen()) return;
  const before = game.hurtMs;
  const ping = game.levelPing || 0;
  const r = move(game, cmd);
  if (!r) return;
  if (r.moved) audio.step();
  else if (r.turned) audio.turn();
  else if (r.bumped) audio.hit();
  else if (r.reason === 'blocked') audio.wall();
  if (game.hurtMs > before) audio.hurt();
  noteLevel(ping);
  if (game.phase !== 'play') showEnd();
}

function finishStrike(r, before, ping) {
  if (r && r.ok) audio.hit();
  else if (r && r.reason === 'none') audio.miss();
  if (game.hurtMs > before) audio.hurt();
  noteLevel(ping);
  if (game.phase === 'won') audio.win();
  if (game.phase !== 'play') showEnd();
}

function doAttack() {
  if (!game || game.phase !== 'play' || game.paused || helpOpen() || sheetOpen()) return;
  const before = game.hurtMs;
  const ping = game.levelPing || 0;
  finishStrike(attack(game), before, ping);
}

function doAttackOne(index) {
  if (!game || game.phase !== 'play' || game.paused || helpOpen() || sheetOpen()) return;
  const before = game.hurtMs;
  const ping = game.levelPing || 0;
  finishStrike(attackOne(game, index), before, ping);
}

function doCast(id) {
  if (!game || game.phase !== 'play' || game.paused || helpOpen() || sheetOpen()) return;
  const ping = game.levelPing || 0;
  const r = id ? cast(game, id) : castRunes(game, game.runePower, game.runeElement, game.runeForm);
  if (r && r.ok) audio.spell();
  noteLevel(ping);
  paintSpells();
  if (game.phase === 'won') audio.win();
  if (game.phase !== 'play') showEnd();
}

function doUse() {
  if (!game || game.phase !== 'play' || game.paused || helpOpen() || questOpen() || sheetOpen()) return;
  if (game.talk) { advanceTalk(game); paintTalk(); return; }
  const r = interact(game);
  if (game.wantAutosave) {
    game.wantAutosave = false;
    if (saveAuto(game)) note('The waystation keeps a copy.');
  }
  if (r && (r.sound === 'door' || r.sound === 'lever')) audio.door();
  else if (r && r.sound === 'stairs') audio.step();
  else if (r && (r.sound === 'chest' || r.sound === 'locked' || r.sound === 'talk')) audio.pickup();
  paintTalk();
}

function sheetOpen() {
  return !!(sheetEl && !sheetEl.hidden);
}

function parseLoc(s) {
  if (!s) return null;
  if (s === 'floor') return { where: 'floor' };
  const p = String(s).split(':');
  if (p.length < 2) return null;
  const champ = Number(p[0]);
  if (p[1] === 'hand') return { champ, where: 'hand' };
  if (p[1] === 'pack') return { champ, where: 'pack', index: Number(p[2]) };
  if (p[1] === 'equip') return { champ, where: 'equip', slot: p[2] };
  return null;
}

function gearSig() {
  if (!game) return '';
  return game.selected + '|' + sheetPick + '|' + game.party.map(c => {
    ensureGear(c);
    const eq = EQUIP_SLOTS.map(s => {
      const it = c.equip[s];
      return it ? it.name + ':' + it.atk + ':' + it.def : '-';
    }).join(',');
    const pk = c.pack.map(it => it ? it.name + ':' + (it.amount || 0) : '-').join(',');
    return [c.hp, c.sta, c.mana, c.level, c.xp, c.rune || 0, eq, pk].join(':');
  }).join('/');
}

function slotBox(champ, slot, item) {
  const loc = champ + ':equip:' + slot;
  const picked = sheetPick === loc ? ' picked' : '';
  const filled = item ? ' filled' : '';
  const drag = item ? ' data-drag="' + loc + '"' : '';
  const body = '<em>' + slot + '</em>' + (item
    ? '<b>' + escapeHtml(item.name) + '</b>' + itemStat(item) + '<span class="tip">' + escapeHtml(itemBlurb(item)) + '</span>'
    : '');
  return '<div class="slot ' + slot + filled + picked + '"' + drag + ' data-drop="' + loc + '">' + body + '</div>';
}

function cellBox(champ, index, item) {
  const loc = champ + ':pack:' + index;
  const picked = sheetPick === loc ? ' picked' : '';
  const filled = item ? ' filled' : '';
  const drag = item ? ' data-drag="' + loc + '"' : '';
  const body = item
    ? '<b>' + escapeHtml(item.name) + '</b>' + itemStat(item) + '<span class="tip">' + escapeHtml(itemBlurb(item)) + '</span>'
    : '';
  return '<div class="cell' + filled + picked + '"' + drag + ' data-drop="' + loc + '">' + body + '</div>';
}

function itemStat(item) {
  const bits = [];
  if (item.atk) bits.push('+' + item.atk + ' atk');
  if (item.def) bits.push('+' + item.def + ' def');
  if (item.type === 'potion') bits.push((item.potion || 'vial') + ' +' + item.amount);
  else if (item.type === 'food') bits.push('eat +' + (item.amount || 6));
  else if (item.type === 'drink') bits.push('drink +' + (item.amount || 8));
  return bits.length ? '<small>' + escapeHtml(bits.join(' ')) + '</small>' : '';
}

function sheetActions() {
  const loc = parseLoc(sheetPick);
  if (!loc || loc.where === 'floor' || loc.where === 'hand' || !game.party[loc.champ]) {
    return '<p class="sheet-hint">Drag between slots, the backpack, and another champion. Double-click equips, eats, or drinks. Drop on the floor to leave it.</p>';
  }
  const c = game.party[loc.champ];
  const item = loc.where === 'pack' ? c.pack[loc.index] : c.equip[loc.slot];
  if (!item) return '<p class="sheet-hint">Empty square.</p>';
  const acts = [];
  if (loc.where === 'pack' && (item.type === 'potion' || item.type === 'food' || item.type === 'drink')) {
    const word = item.type === 'food' ? 'Eat' : 'Drink';
    acts.push('<button type="button" data-act="use">' + word + '</button>');
  }
  if (loc.where === 'pack' && item.slot) acts.push('<button type="button" data-act="equip">Equip</button>');
  if (loc.where === 'equip') acts.push('<button type="button" data-act="unequip">Unequip</button>');
  acts.push('<button type="button" data-act="drop">Drop</button>');
  return '<div class="sheet-actions">' + acts.join('') + '</div><p class="sheet-hint">' + escapeHtml(itemBlurb(item)) + '</p>';
}

function paintSheet(force) {
  if (!sheetOpen() || !game) return;
  if (sheetDrag && !force) return;
  const sig = gearSig();
  const body = sheetEl.querySelector('#sheet-body');
  if (!body) return;
  if (!force && sig === sheetSig && body.querySelector('.sheet-grid')) return;
  sheetSig = sig;
  const c = game.party[game.selected];
  ensureGear(c);
  const lines = [
    ['Health', c.hp + ' / ' + c.maxHp],
    ['Stamina', c.sta + ' / ' + c.maxSta],
    ['Mana', c.mana + ' / ' + c.maxMana],
    ['Level', c.level + ' · ' + c.xp + ' / ' + xpNeed(c.level) + ' xp'],
    ['Fighting', c.atk + ' · blow ' + weaponAtk(c)],
    ['Guard', c.def + ' · worn ' + armorDef(c)],
    ['Casting', runeSkill(c) + ' · ' + (c.rune || 0) + ' uses'],
  ];
  const slots = EQUIP_SLOTS.map(s => slotBox(game.selected, s, c.equip[s])).join('');
  const cells = c.pack.map((it, n) => cellBox(game.selected, n, it)).join('');
  const others = game.party.map((ch, i) => {
    if (i === game.selected) return '';
    ensureGear(ch);
    const chips = [];
    for (const s of EQUIP_SLOTS) {
      if (!ch.equip[s]) continue;
      const loc = i + ':equip:' + s;
      chips.push('<span class="chip" data-drag="' + loc + '" title="' + escapeHtml(itemBlurb(ch.equip[s])) + '">' + escapeHtml(ch.equip[s].name) + '</span>');
    }
    ch.pack.forEach((it, n) => {
      if (!it) return;
      const loc = i + ':pack:' + n;
      chips.push('<span class="chip" data-drag="' + loc + '" title="' + escapeHtml(itemBlurb(it)) + '">' + escapeHtml(it.name) + '</span>');
    });
    return '<div class="other" data-drop="' + i + ':hand" data-open="' + i + '"><b>' + escapeHtml(ch.name) + '</b><div class="chips">' + (chips.join('') || '<em>empty</em>') + '</div></div>';
  }).join('');
  body.innerHTML =
    '<div class="sheet-top"><div><p class="kicker">character sheet</p><h2>' + escapeHtml(c.name) + '</h2>' +
    '<p>' + escapeHtml(c.role) + ' · ' + escapeHtml(c.row) + ' rank · level ' + c.level + '</p></div>' +
    '<button type="button" id="sheet-close">Close</button></div>' +
    '<div class="sheet-grid">' +
      '<ul class="stats">' + lines.map(row => '<li>' + row[0] + ' <b>' + escapeHtml(String(row[1])) + '</b></li>').join('') + '</ul>' +
      '<div class="doll">' + slots + '<div class="doll-face"><canvas id="sheet-portrait" width="84" height="112"></canvas></div></div>' +
      '<div><h3>Backpack</h3><div class="pack" data-drop="pack">' + cells + '</div>' +
      '<div class="drop-floor" data-drop="floor">Drop on the floor</div>' + sheetActions() + '</div>' +
    '</div>' +
    '<h3>Other champions</h3><div class="others">' + others + '</div>' +
    '<p class="lead">1–4 switches champion. I or Esc closes. The delve stays paused.</p>';
  const face = body.querySelector('#sheet-portrait');
  if (face) view.paintPortrait(face, game.selected, c);
  bindSheet(body);
}

function applyDrop(from, to) {
  if (!from || !to || !game) return;
  if (to.where === 'floor') dropItem(game, from);
  else if (to.where === 'hand') handoffItem(game, from, to.champ);
  else moveItem(game, from, to);
  sheetPick = '';
  sheetSig = '';
  paintParty();
  paintSheet(true);
  paintLog();
}

function bindSheet(root) {
  const close = root.querySelector('#sheet-close');
  if (close) close.addEventListener('click', () => closeSheet());
  let pointerFrom = '';
  let pointerMoved = false;
  let pointerX = 0;
  let pointerY = 0;
  let downX = 0;
  let downY = 0;
  let suppressClick = false;
  const zoneAt = (x, y) => {
    const hit = document.elementFromPoint(x, y);
    return hit && hit.closest ? hit.closest('[data-drop]') : null;
  };
  root.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    downX = ev.clientX;
    downY = ev.clientY;
    pointerMoved = false;
    const el = ev.target.closest('[data-drag]');
    if (!el) return;
    pointerFrom = el.getAttribute('data-drag') || '';
    pointerX = ev.clientX;
    pointerY = ev.clientY;
    if (el.setPointerCapture) el.setPointerCapture(ev.pointerId);
  });
  root.addEventListener('pointermove', (ev) => {
    if (!pointerFrom) return;
    if (Math.abs(ev.clientX - pointerX) + Math.abs(ev.clientY - pointerY) > 6) pointerMoved = true;
    root.querySelectorAll('.over').forEach(el => el.classList.remove('over'));
    const zone = zoneAt(ev.clientX, ev.clientY);
    if (zone) zone.classList.add('over');
  });
  root.addEventListener('pointerup', (ev) => {
    if (Math.abs(ev.clientX - downX) + Math.abs(ev.clientY - downY) > 8) ignoreSheetBackdrop = true;
    if (!pointerFrom) return;
    const from = parseLoc(pointerFrom);
    const moved = pointerMoved;
    pointerFrom = '';
    root.querySelectorAll('.over').forEach(el => el.classList.remove('over'));
    if (!moved) return;
    suppressClick = true;
    const zone = zoneAt(ev.clientX, ev.clientY);
    const raw = zone ? zone.getAttribute('data-drop') : '';
    let to = parseLoc(raw);
    if (raw === 'pack' && game) {
      const idx = game.party[game.selected].pack.findIndex(x => !x);
      to = idx < 0 ? null : { champ: game.selected, where: 'pack', index: idx };
    }
    if (!zone || !to) return;
    applyDrop(from, to);
  });
  root.addEventListener('pointercancel', () => { pointerFrom = ''; });
  root.addEventListener('dragstart', (ev) => {
    const el = ev.target.closest('[data-drag]');
    if (!el || !ev.dataTransfer) return;
    ev.dataTransfer.setData('text/plain', el.getAttribute('data-drag'));
    ev.dataTransfer.effectAllowed = 'move';
    sheetDrag = true;
  });
  root.addEventListener('dragend', () => {
    sheetDrag = false;
    root.querySelectorAll('.over').forEach(el => el.classList.remove('over'));
  });
  root.addEventListener('dragover', (ev) => {
    const zone = ev.target.closest('[data-drop]');
    if (!zone) return;
    ev.preventDefault();
    zone.classList.add('over');
  });
  root.addEventListener('dragleave', (ev) => {
    const zone = ev.target.closest('[data-drop]');
    if (zone) zone.classList.remove('over');
  });
  root.addEventListener('drop', (ev) => {
    const zone = ev.target.closest('[data-drop]');
    if (!zone || !game) return;
    ev.preventDefault();
    zone.classList.remove('over');
    sheetDrag = false;
    const from = parseLoc(ev.dataTransfer ? ev.dataTransfer.getData('text/plain') : '');
    const raw = zone.getAttribute('data-drop');
    let to = parseLoc(raw);
    if (raw === 'pack') {
      const idx = game.party[game.selected].pack.findIndex(x => !x);
      to = idx < 0 ? null : { champ: game.selected, where: 'pack', index: idx };
    }
    applyDrop(from, to);
  });
  root.addEventListener('dblclick', (ev) => {
    const el = ev.target.closest('[data-drag]');
    if (!el || !game) return;
    ev.preventDefault();
    activateItem(game, parseLoc(el.getAttribute('data-drag')));
    sheetPick = '';
    sheetSig = '';
    paintParty();
    paintSheet(true);
    paintLog();
  });
  root.addEventListener('click', (ev) => {
    if (suppressClick) { suppressClick = false; return; }
    const act = ev.target.closest('[data-act]');
    if (act && game) {
      const loc = parseLoc(sheetPick);
      if (loc) {
        const kind = act.getAttribute('data-act');
        if (kind === 'drop') dropItem(game, loc);
        else if (kind === 'use' || kind === 'equip' || kind === 'unequip') activateItem(game, loc);
      }
      sheetPick = '';
      sheetSig = '';
      paintParty();
      paintSheet(true);
      paintLog();
      return;
    }
    const drag = ev.target.closest('[data-drag]');
    if (drag) {
      sheetPick = drag.getAttribute('data-drag');
      sheetSig = '';
      paintSheet(true);
      return;
    }
    const open = ev.target.closest('[data-open]');
    if (open && !ev.target.closest('.chip')) openSheet(Number(open.getAttribute('data-open')));
  });
}

function openSheet(index) {
  if (!sheetEl || !game || game.phase !== 'play') return;
  if (index < 0 || index > 3) return;
  if (helpOpen()) {
    helpEl.hidden = true;
    if (!helpWasPaused) game.paused = false;
  }
  if (questOpen()) {
    questEl.hidden = true;
    if (!helpWasPaused) game.paused = false;
  }
  if (!sheetOpen()) sheetWasPaused = !!game.paused;
  game.selected = index;
  game.paused = true;
  held.clear();
  sheetPick = '';
  sheetSig = '';
  sheetEl.hidden = false;
  paintSheet(true);
  paintParty();
}

function closeSheet() {
  if (!sheetOpen()) return;
  sheetEl.hidden = true;
  sheetDrag = false;
  sheetPick = '';
  if (game && game.phase === 'play' && !sheetWasPaused && !helpOpen() && !questOpen()) game.paused = false;
}

function toggleSheet(index) {
  if (!game) return;
  const i = index == null ? game.selected : index;
  if (sheetOpen() && index == null && game.selected === i) closeSheet();
  else openSheet(i);
}

function paintParty() {
  if (!game) return;
  if (partyEl.childElementCount !== game.party.length) {
    partyEl.innerHTML = game.party.map((c, i) => (
      '<button type="button" class="champ" data-champ="' + i + '">' +
        '<canvas class="portrait" width="72" height="96" aria-hidden="true"></canvas>' +
        '<div class="champ-main">' +
          '<div class="champ-top"><span class="name"></span><span class="role"></span></div>' +
          '<div class="bar hp"><i></i><em></em><span>hp</span></div>' +
          '<div class="bar sta"><i></i><em></em><span>sta</span></div>' +
          '<div class="bar mana"><i></i><em></em><span>mana</span></div>' +
          '<div class="gear"></div>' +
          '<div class="items"></div>' +
        '</div>' +
      '</button>'
    )).join('');
    partyEl.querySelectorAll('[data-champ]').forEach(btn => {
      const face = btn.querySelector('.portrait');
      if (face) view.paintPortrait(face, Number(btn.getAttribute('data-champ')), game.party[Number(btn.getAttribute('data-champ'))]);
      btn.addEventListener('click', (ev) => {
        if (ev.target.closest('[data-item]')) return;
        openSheet(Number(btn.getAttribute('data-champ')));
      });
    });
  }
  game.party.forEach((c, i) => {
    const el = partyEl.children[i];
    el.classList.toggle('sel', i === game.selected);
    el.classList.toggle('down', c.hp <= 0);
    el.querySelector('.name').textContent = c.name;
    el.querySelector('.role').textContent = c.role + ' · ' + ['Z', 'X', 'C', 'V'][i] + ' · lv ' + c.level;
    const bars = [['.hp', c.hp, c.maxHp], ['.sta', c.sta, c.maxSta], ['.mana', c.mana, c.maxMana]];
    for (const [sel, v, max] of bars) {
      const bar = el.querySelector(sel);
      bar.querySelector('i').style.width = Math.max(0, Math.min(100, 100 * v / max)) + '%';
      bar.querySelector('em').textContent = v + ' / ' + max;
    }
    ensureGear(c);
    const gear = [];
    if (c.weapon) gear.push(c.weapon.name);
    if (c.armor) gear.push(c.armor.name);
    const worn = EQUIP_SLOTS.filter(s => c.equip[s]).length;
    const extra = worn - (c.weapon ? 1 : 0) - (c.armor ? 1 : 0);
    el.querySelector('.gear').textContent = (gear.join(' · ') || 'unarmed') + (extra > 0 ? ' · +' + extra : '');
    const gearSig = gear.join(' · ');
    if (el.getAttribute('data-gear') !== gearSig) {
      el.setAttribute('data-gear', gearSig);
      const face = el.querySelector('.portrait');
      if (face) view.paintPortrait(face, i, c);
    }
    const items = el.querySelector('.items');
    const sig = c.items.map(it => (it.type || '') + ':' + (it.potion || it.name)).join(',');
    if (items.getAttribute('data-sig') !== sig) {
      items.setAttribute('data-sig', sig);
      items.innerHTML = c.items.map((it, n) => {
        const kind = it.type === 'food' ? 'food' : it.type === 'drink' ? 'drink' : (it.potion || 'hp');
        const label = it.type === 'food' ? 'eat' : it.type === 'drink' ? 'drink' : it.potion;
        return '<button type="button" class="vial vial-' + kind + '" data-item="' + n + '" title="' + escapeHtml(it.name || label) + '"><i></i><b>' + label + '</b></button>';
      }).join('');
      items.querySelectorAll('[data-item]').forEach(b => {
        b.addEventListener('click', (ev) => {
          ev.stopPropagation();
          useItem(game, i, Number(b.getAttribute('data-item')));
          paintParty();
        });
      });
    }
  });
}

function paintLog() {
  if (!game || game.logRev === logSeen) return;
  logSeen = game.logRev;
  const lines = game.log.slice(-8);
  logEl.innerHTML = lines.map(l => '<p class="' + l.kind + '">' + escapeHtml(l.text) + (l.n > 1 ? '  x' + l.n : '') + '</p>').join('');
  logEl.scrollTop = logEl.scrollHeight;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
}

function paintHud() {
  if (!game) return;
  floorEl.textContent = game.inHub
    ? 'The Waystation  ·  between floors'
    : FLOOR_NAMES[game.floor] + '  ·  ' + (game.floor + 1) + ' / ' + FLOORS;
  faceEl.textContent = FACING_NAME[game.facing];
  const ward = game.wardMs > 0 ? '  ·  ward' : '';
  const gleam = game.gleamMs > 0 ? '  ·  gleam' : '';
  metaEl.textContent = game.difficulty + '  ·  ' + game.kills + ' fallen  ·  ' + game.gold + ' coin  ·  ' + game.keys + ' key' + (game.keys === 1 ? '' : 's') + ward + gleam;
  hurt.style.opacity = game.hurtMs > 0 ? '0.45' : '0';
}

function runeReadout() {
  if (!game) return 'Spark + Ash + Bolt';
  const p = RUNE_POWERS.find(r => r.id === game.runePower) || RUNE_POWERS[0];
  const e = RUNE_ELEMENTS.find(r => r.id === game.runeElement) || RUNE_ELEMENTS[0];
  const f = RUNE_FORMS.find(r => r.id === game.runeForm) || RUNE_FORMS[0];
  const who = game.party[game.selected];
  const skill = who ? runeSkill(who) : 0;
  return p.name + ' + ' + e.name + ' + ' + f.name + ' · ' + p.cost + ' mana · casting ' + skill;
}

function paintSpells() {
  const sig = game
    ? game.runePower + '|' + game.runeElement + '|' + game.runeForm + '|' + (game.party[game.selected] && game.party[game.selected].rune)
    : 'none';
  if (spellEl.getAttribute('data-sig') === sig && spellEl.childElementCount) return;
  spellEl.setAttribute('data-sig', sig);
  const row = (group, runes, current) =>
    '<div class="rune-row" role="group" aria-label="' + group + '">' +
    runes.map(r => '<button type="button" class="spell' + (r.id === current ? ' on' : '') + '" data-rune="' + group + ':' + r.id + '"><b>' + r.name + '</b></button>').join('') +
    '</div>';
  const powers = RUNE_POWERS.map(r => ({ ...r, key: '' }));
  const elements = RUNE_ELEMENTS.map(r => ({ ...r, key: '' }));
  const forms = RUNE_FORMS.map(r => ({ ...r, key: '' }));
  const curP = game ? game.runePower : 'spark';
  const curE = game ? game.runeElement : 'ash';
  const curF = game ? game.runeForm : 'bolt';
  spellEl.innerHTML = row('power', powers, curP) + row('element', elements, curE) + row('form', forms, curF) +
    '<button type="button" id="cast-rune" class="spell">Cast (R)</button>' +
    '<p id="rune-readout">' + escapeHtml(runeReadout()) + '</p>';
  spellEl.querySelectorAll('[data-rune]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!game || game.phase !== 'play') return;
      const [group, id] = btn.getAttribute('data-rune').split(':');
      if (group === 'power') setRunes(game, id, null, null);
      else if (group === 'element') setRunes(game, null, id, null);
      else setRunes(game, null, null, id);
      paintSpells();
    });
  });
  const castBtn = spellEl.querySelector('#cast-rune');
  if (castBtn) castBtn.addEventListener('click', () => doCast());
}

function paintFx() {
  if (!viewWrap) return;
  if (!game || !game.shake) viewWrap.style.transform = '';
  else {
    const s = Math.min(1, game.shake / 220);
    const x = (Math.random() - 0.5) * 12 * s;
    const y = (Math.random() - 0.5) * 8 * s;
    viewWrap.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
  }
  if (!floatersEl) return;
  const items = (game && game.floaters) || [];
  floatersEl.innerHTML = items.map((f, i) => {
    const t = 1 - Math.max(0, f.life) / 900;
    const y = 46 - t * 30;
    const x = 50 + ((i % 5) - 2) * 7;
    return '<span class="floater ' + (f.kind || 'hit') + '" style="left:' + x + '%;top:' + y + '%;opacity:' + Math.max(0, 1 - t * 0.85).toFixed(2) + '">' + escapeHtml(f.text) + '</span>';
  }).join('');
}

function paintAll() {
  paintParty();
  paintLog();
  paintHud();
  paintSpells();
  paintFx();
  paintTalk();
  if (sheetOpen()) paintSheet(false);
}

function heldCommand() {
  const order = ['forward', 'back', 'strafeLeft', 'strafeRight', 'turnLeft', 'turnRight'];
  for (const cmd of order) if (held.has(cmd)) return cmd;
  return null;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(100, now - last);
  last = now;
  if (game && game.phase === 'play' && !game.paused && overlay.hidden && !window.__delveHold) {
    tick(game, dt);
    if (now >= nextAct) {
      const cmd = heldCommand();
      if (cmd) {
        act(cmd);
        nextAct = now + (cmd === 'turnLeft' || cmd === 'turnRight' ? 150 : 180);
      }
    }
    if (game.phase !== 'play') showEnd();
  }
  if (game && game.phase === 'play') easeCam(dt);
  if (game && (game.phase === 'play' || game.phase === 'won' || game.phase === 'lost')) {
    const mw = mapCanvas.clientWidth | 0;
    const mh = mapCanvas.clientHeight | 0;
    if (mw > 40 && mh > 40 && (mapCanvas.width !== mw || mapCanvas.height !== mh)) {
      mapCanvas.width = mw;
      mapCanvas.height = mh;
    }
    view.draw(canvas, game, cam);
    view.drawMap(mapCanvas, game);
    paintAll();
  }
  const art = document.getElementById('title-art');
  if (art) view.paintTitle(art);
  requestAnimationFrame(frame);
}

function helpOpen() {
  return !!(helpEl && !helpEl.hidden);
}

function questOpen() {
  return !!(questEl && !questEl.hidden);
}

function paintQuest() {
  if (!questEl) return;
  const body = questEl.querySelector('#quest-body');
  if (!body || !game) return;
  const rows = questLog(game);
  const main = rows.filter(q => q.kind === 'main');
  const side = rows.filter(q => q.kind === 'side');
  const line = (q) => '<li class="' + q.status + '"><b>' + escapeHtml(q.title) + '</b> <span>' + q.status + '</span><p>' + escapeHtml(q.detail) + '</p></li>';
  body.innerHTML = '<p class="kicker">quests</p><h2>Quest log</h2>' +
    '<h3>Story</h3><ul class="qlog">' + main.map(line).join('') + '</ul>' +
    '<h3>Side</h3><ul class="qlog">' + side.map(line).join('') + '</ul>' +
    '<p class="lead">J closes this. F talks to someone in the next tile. The waystation sits between floors.</p>';
}

function toggleQuest() {
  if (!questEl) return;
  if (!questEl.hidden) {
    questEl.hidden = true;
    if (game && game.phase === 'play' && !helpWasPaused && !sheetOpen()) game.paused = false;
    return;
  }
  if (helpOpen()) toggleHelp();
  helpWasPaused = !!(game && game.paused);
  if (game && game.phase === 'play') game.paused = true;
  held.clear();
  paintQuest();
  questEl.hidden = false;
}

function paintTalk() {
  if (!talkEl) return;
  if (!game || !game.talk) { talkEl.hidden = true; return; }
  const t = game.talk;
  talkEl.hidden = false;
  talkEl.innerHTML = '<div class="who">' + escapeHtml(t.name || 'Someone') + '</div><p>' + escapeHtml(t.lines[t.i] || '') + '</p><small>F or Space continues</small>';
}

function toggleHelp() {
  if (!helpEl) return;
  if (!helpEl.hidden) {
    helpEl.hidden = true;
    if (game && game.phase === 'play' && !helpWasPaused && !sheetOpen() && !questOpen()) game.paused = false;
    return;
  }
  helpWasPaused = !!(game && game.paused);
  if (game && game.phase === 'play') game.paused = true;
  held.clear();
  helpEl.hidden = false;
}

function typingTarget(e) {
  const t = e.target;
  return !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'));
}

function syncMute() {
  const on = audio.muted();
  muteBtn.textContent = on ? 'Sound off' : 'Sound on';
  muteBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyH' || e.key === '?' || (e.code === 'Slash' && e.shiftKey)) {
    if (typingTarget(e)) return;
    e.preventDefault();
    audio.start();
    if (sheetOpen()) closeSheet();
    toggleHelp();
    return;
  }
  if (e.code === 'KeyJ') {
    if (typingTarget(e)) return;
    e.preventDefault();
    audio.start();
    if (sheetOpen()) closeSheet();
    toggleQuest();
    return;
  }
  if (helpOpen()) {
    if (e.code === 'Escape') { e.preventDefault(); toggleHelp(); }
    return;
  }
  if (questOpen()) {
    if (e.code === 'Escape' || e.code === 'KeyJ') { e.preventDefault(); toggleQuest(); }
    return;
  }
  if (sheetOpen()) {
    if (e.code === 'Escape' || e.code === 'KeyI') { e.preventDefault(); closeSheet(); return; }
    if (!e.altKey && !e.shiftKey && /^Digit[1-4]$/.test(e.code)) {
      e.preventDefault();
      openSheet(Number(e.code.slice(5)) - 1);
      return;
    }
    return;
  }
  if (game && game.talk && (e.code === 'Space' || e.code === 'KeyF' || e.code === 'Enter')) {
    if (typingTarget(e)) return;
    e.preventDefault();
    audio.start();
    advanceTalk(game);
    paintTalk();
    return;
  }
  if (e.code === 'KeyM') {
    if (typingTarget(e)) return;
    e.preventDefault();
    audio.start();
    audio.toggle();
    syncMute();
    return;
  }
  if (e.repeat && (e.code === 'Space' || /^Digit/.test(e.code) || e.code === 'KeyF' || /^Key[ZXCV]$/.test(e.code))) return;
  const cmd = KEYS[e.code];
  if (cmd) {
    if (typingTarget(e)) return;
    e.preventDefault();
    audio.start();
    held.add(cmd);
    if (!e.repeat) {
      act(cmd);
      nextAct = performance.now() + 180;
    }
    return;
  }
  if (typingTarget(e)) return;
  const solo = { KeyZ: 0, KeyX: 1, KeyC: 2, KeyV: 3 }[e.code];
  if (solo != null) { e.preventDefault(); audio.start(); doAttackOne(solo); return; }
  if (e.shiftKey && /^Digit[1-4]$/.test(e.code)) {
    e.preventDefault();
    audio.start();
    doAttackOne(Number(e.code.slice(5)) - 1);
    return;
  }
  if (e.code === 'Space') { e.preventDefault(); audio.start(); doAttack(); }
  else if (e.code === 'KeyF' || e.code === 'Enter') { e.preventDefault(); audio.start(); doUse(); }
  else if (e.code === 'Escape') { e.preventDefault(); if (game && game.phase === 'play' && !game.paused) showPause(); else if (game && game.paused) { game.paused = false; hideOverlay(); } }
  else if (e.code === 'Tab') {
    e.preventDefault();
    if (!game) return;
    const dir = e.shiftKey ? -1 : 1;
    game.selected = (game.selected + dir + game.party.length) % game.party.length;
    paintParty();
  } else if (e.code === 'KeyR') {
    e.preventDefault();
    audio.start();
    doCast();
  } else if (e.code === 'KeyI') {
    e.preventDefault();
    audio.start();
    toggleSheet();
  } else if (e.altKey && /^Digit[1-9]$/.test(e.code)) {
    if (!game || game.phase !== 'play') return;
    e.preventDefault();
    audio.start();
    const n = Number(e.code.slice(5));
    if (n <= 3) setRunes(game, RUNE_POWERS[n - 1].id, null, null);
    else if (n <= 6) setRunes(game, null, RUNE_ELEMENTS[n - 4].id, null);
    else setRunes(game, null, null, RUNE_FORMS[n - 7].id);
    paintSpells();
  } else if (!e.altKey && !e.shiftKey && /^Digit[1-4]$/.test(e.code)) {
    e.preventDefault();
    audio.start();
    openSheet(Number(e.code.slice(5)) - 1);
  }
});

window.addEventListener('keyup', (e) => {
  const cmd = KEYS[e.code];
  if (cmd) held.delete(cmd);
});

window.addEventListener('blur', () => held.clear());

document.querySelectorAll('#pad [data-cmd]').forEach(btn => {
  const cmd = btn.getAttribute('data-cmd');
  const down = (e) => {
    e.preventDefault();
    btn.setPointerCapture && e.pointerId != null && btn.setPointerCapture(e.pointerId);
    held.add(cmd);
    act(cmd);
    nextAct = performance.now() + 180;
  };
  const up = () => held.delete(cmd);
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('pointerleave', up);
});

document.getElementById('attack').addEventListener('click', doAttack);
document.getElementById('use').addEventListener('click', doUse);
document.getElementById('pause').addEventListener('click', () => {
  if (!game || game.phase !== 'play') showTitle();
  else if (game.paused) { game.paused = false; hideOverlay(); }
  else showPause();
});
function showSaves() {
  if (!game) { showTitle(); return; }
  if (game.phase === 'play') game.paused = true;
  showOverlay(
    '<p class="kicker">this browser only</p>' +
    '<h1>Saves</h1>' +
    '<p class="lead">Three slots. Reaching the waystation writes the autosave.</p>' +
    saveRows(true) +
    '<div class="row"><button type="button" id="resume" class="primary">Back</button></div>'
  );
}
document.getElementById('save').addEventListener('click', showSaves);
document.getElementById('load').addEventListener('click', showSaves);
muteBtn.addEventListener('click', () => {
  audio.start();
  audio.toggle();
  syncMute();
});
if (volInput) {
  volInput.value = String(Math.round(audio.volume() * 100));
  volInput.addEventListener('input', () => {
    audio.setVolume(Number(volInput.value) / 100);
  });
}
syncMute();
const helpBtn = document.getElementById('help-btn');
if (helpBtn) helpBtn.addEventListener('click', () => { audio.start(); toggleHelp(); });
const questBtn = document.getElementById('quest-btn');
if (questBtn) questBtn.addEventListener('click', () => { audio.start(); toggleQuest(); });

mapCanvas.width = 220;
mapCanvas.height = 220;

window.__delve = {
  get game() { return game; },
  newGame(seed, difficulty) { start(seed, difficulty); },
  state() {
    if (!game) return null;
    return {
      x: game.x, y: game.y, facing: game.facing, floor: game.floor,
      phase: game.phase, seed: game.seed, difficulty: game.difficulty,
      kills: game.kills, keys: game.keys, gold: game.gold, paused: !!game.paused,
      inHub: !!game.inHub,
      gleam: game.gleamMs, ward: game.wardMs,
    };
  },
  party() { return game ? game.party : []; },
  move(cmd) { return game ? move(game, cmd) : null; },
  attack() { return game ? attack(game) : null; },
  attackOne(i) { return game ? attackOne(game, i) : null; },
  cast(id) { return game ? cast(game, id) : null; },
  interact() { return game ? interact(game) : null; },
  useItem(i, n) { return game ? useItem(game, i, n) : null; },
  tick(ms) { if (game) tick(game, ms); },
  save() { return game ? saveGame(game) : false; },
  load() {
    const saved = loadGame();
    if (!saved) return false;
    resumeLoaded(saved);
    return true;
  },
  clearSave() { clearSave(); },
  summary() { return game ? summarize(game) : []; },
  explored() { return game ? game.explored.size : 0; },
  spells: SPELLS,
  tile(x, y, f) { return game ? tileAt(game, x, y, f) : null; },
  setPos(x, y, floor, facing) { if (game) { debug.setPos(game, x, y, floor, facing); snapCam(); } },
  spawn(kind, x, y) { return game ? debug.spawn(game, kind, x, y) : null; },
  giveKey(n) { if (game) debug.giveKey(game, n); },
  hurt(i, n) { if (game) debug.hurt(game, i, n); },
  wipe() { if (game) { debug.wipe(game); if (game.phase !== 'play') showEnd(); } },
  killAll() { if (game) { debug.killAll(game); if (game.phase !== 'play') showEnd(); } },
  press(code) {
    if (code === 'KeyH' || code === 'Slash') { if (sheetOpen()) closeSheet(); toggleHelp(); return; }
    if (code === 'KeyJ') { if (sheetOpen()) closeSheet(); toggleQuest(); return; }
    if (code === 'KeyI') { toggleSheet(); return; }
    if (code === 'Escape') {
      if (helpOpen()) toggleHelp();
      else if (questOpen()) toggleQuest();
      else if (sheetOpen()) closeSheet();
      return;
    }
    if (code === 'KeyM') { audio.toggle(); syncMute(); return; }
    const solo = { KeyZ: 0, KeyX: 1, KeyC: 2, KeyV: 3 }[code];
    if (solo != null) { doAttackOne(solo); return; }
    const cmd = KEYS[code];
    if (cmd) act(cmd);
    else if (code === 'Space') doAttack();
    else if (code === 'KeyF') doUse();
    else if (code === 'KeyR') doCast();
    else if (/^Digit[1-4]$/.test(code)) openSheet(Number(code.slice(5)) - 1);
    else if (/^AltDigit[1-9]$/.test(code)) {
      const n = Number(code.slice(8));
      if (!game) return;
      if (n <= 3) setRunes(game, RUNE_POWERS[n - 1].id, null, null);
      else if (n <= 6) setRunes(game, null, RUNE_ELEMENTS[n - 4].id, null);
      else setRunes(game, null, null, RUNE_FORMS[n - 7].id);
      paintSpells();
    }
  },
  moveItem(from, to) { return game ? moveItem(game, from, to) : null; },
  sheetOpen() { return sheetOpen(); },
  showTitle,
  setQuality(q) { setGfxPref(q); },
  setMotion(m) { setMotionPref(m); },
};

view.setQuality(gfxPref());
view.setMotion(motionPref());
const gfxSel = document.getElementById('gfx');
const motionSel = document.getElementById('motion');
if (gfxSel) {
  gfxSel.value = gfxPref();
  gfxSel.addEventListener('change', () => setGfxPref(gfxSel.value));
}
if (motionSel) {
  motionSel.value = motionPref();
  motionSel.addEventListener('change', () => setMotionPref(motionSel.value));
}
paintSpells();
if (sheetEl) sheetEl.addEventListener('click', (ev) => {
  if (ignoreSheetBackdrop) { ignoreSheetBackdrop = false; return; }
  if (ev.target === sheetEl) closeSheet();
});
showTitle();
requestAnimationFrame(frame);
