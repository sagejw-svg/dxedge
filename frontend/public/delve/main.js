/* Delve. Wires the engine to the page: keys, buttons, the raycaster, the map. */

import {
  FLOOR_NAMES, FLOORS, FACING_NAME, SPELLS, DIFF_KEY,
  createGame, move, attack, attackOne, cast, interact, tick, useItem,
  saveGame, loadGame, hasSave, clearSave, summarize, tileAt, debug,
  questLog, advanceTalk,
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
const talkEl = document.getElementById('talk');
const viewWrap = document.getElementById('view-wrap');
const floatersEl = document.getElementById('floaters');

let game = null;
let reported = false;
let logSeen = -1;
let helpWasPaused = false;
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
    const saved = loadGame();
    if (saved) resumeLoaded(saved);
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
    '<ul class="help">' +
      '<li><b>W</b> forward, <b>S</b> back, <b>A</b> and <b>D</b> turn. Arrow keys do the same.</li>' +
      '<li><b>Q</b> and <b>E</b> strafe. The buttons under the view do all of this by mouse or touch.</li>' +
      '<li><b>Space</b> swings the front rank. <b>Z X C V</b> send Bryn, Cara, Ivo, and Senn alone. <b>F</b> uses and talks. <b>J</b> opens the quest log. <b>1</b> to <b>5</b> speak the runes.</li>' +
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
      '<button type="button" id="save-now">Save</button>' +
      '<button type="button" id="again">Title</button>' +
    '</div>' +
    '<ul class="help">' +
      '<li>W S move, A D turn, Q E strafe. Space swings the front rank. Z X C V attack one champion. F uses, 1–5 are runes. H lists every key.</li>' +
      '<li>The save is only in this browser. Nothing is sent with it.</li>' +
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
  if (!game || game.phase !== 'play' || game.paused || helpOpen()) return;
  const before = game.hurtMs;
  const ping = game.levelPing || 0;
  finishStrike(attack(game), before, ping);
}

function doAttackOne(index) {
  if (!game || game.phase !== 'play' || game.paused || helpOpen()) return;
  const before = game.hurtMs;
  const ping = game.levelPing || 0;
  finishStrike(attackOne(game, index), before, ping);
}

function doCast(id) {
  if (!game || game.phase !== 'play' || game.paused || helpOpen()) return;
  const ping = game.levelPing || 0;
  const r = cast(game, id);
  if (r && r.ok) audio.spell();
  noteLevel(ping);
  if (game.phase === 'won') audio.win();
  if (game.phase !== 'play') showEnd();
}

function doUse() {
  if (!game || game.phase !== 'play' || game.paused || helpOpen() || questOpen()) return;
  if (game.talk) { advanceTalk(game); paintTalk(); return; }
  const r = interact(game);
  if (r && (r.sound === 'door' || r.sound === 'lever')) audio.door();
  else if (r && r.sound === 'stairs') audio.step();
  else if (r && (r.sound === 'chest' || r.sound === 'locked' || r.sound === 'talk')) audio.pickup();
  paintTalk();
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
        game.selected = Number(btn.getAttribute('data-champ'));
        paintParty();
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
    const gear = [];
    if (c.weapon) gear.push(c.weapon.name);
    if (c.armor) gear.push(c.armor.name);
    el.querySelector('.gear').textContent = gear.join(' · ') || 'unarmed';
    const gearSig = gear.join(' · ');
    if (el.getAttribute('data-gear') !== gearSig) {
      el.setAttribute('data-gear', gearSig);
      const face = el.querySelector('.portrait');
      if (face) view.paintPortrait(face, i, c);
    }
    const items = el.querySelector('.items');
    const sig = c.items.map(it => it.potion).join(',');
    if (items.getAttribute('data-sig') !== sig) {
      items.setAttribute('data-sig', sig);
      items.innerHTML = c.items.map((it, n) =>
        '<button type="button" class="vial vial-' + it.potion + '" data-item="' + n + '"><i></i><b>' + it.potion + '</b></button>'
      ).join('');
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
  logEl.innerHTML = lines.map(l => '<p class="' + l.kind + '">' + escapeHtml(l.text) + '</p>').join('');
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

function paintSpells() {
  if (spellEl.childElementCount) return;
  spellEl.innerHTML = SPELLS.map((s, i) =>
    '<button type="button" class="spell" data-spell="' + s.id + '" title="' + escapeHtml(s.blurb) + '">' +
      '<i class="rune r' + i + '" aria-hidden="true"></i>' +
      '<b>' + (i + 1) + ' ' + s.name + '</b>' +
      '<small>' + s.cost + ' mana</small>' +
    '</button>'
  ).join('');
  spellEl.querySelectorAll('[data-spell]').forEach(btn => {
    btn.addEventListener('click', () => doCast(btn.getAttribute('data-spell')));
  });
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
    if (game && game.phase === 'play' && !helpWasPaused) game.paused = false;
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
    if (game && game.phase === 'play' && !helpWasPaused) game.paused = false;
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
    toggleHelp();
    return;
  }
  if (e.code === 'KeyJ') {
    if (typingTarget(e)) return;
    e.preventDefault();
    audio.start();
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
  } else if (/^Digit[1-5]$/.test(e.code)) {
    const n = Number(e.code.slice(5)) - 1;
    if (SPELLS[n]) { audio.start(); doCast(SPELLS[n].id); }
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
document.getElementById('save').addEventListener('click', () => {
  if (game && saveGame(game)) note('Saved in this browser.');
  else note('Nothing to save yet.');
});
document.getElementById('load').addEventListener('click', () => {
  const saved = loadGame();
  if (!saved) { note('No save in this browser.'); return; }
  resumeLoaded(saved);
  note('Save loaded.');
});
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
    if (code === 'KeyH' || code === 'Slash') { toggleHelp(); return; }
    if (code === 'KeyJ') { toggleQuest(); return; }
    if (code === 'KeyM') { audio.toggle(); syncMute(); return; }
    const solo = { KeyZ: 0, KeyX: 1, KeyC: 2, KeyV: 3 }[code];
    if (solo != null) { doAttackOne(solo); return; }
    const cmd = KEYS[code];
    if (cmd) act(cmd);
    else if (code === 'Space') doAttack();
    else if (code === 'KeyF') doUse();
    else if (/^Digit[1-5]$/.test(code)) {
      const n = Number(code.slice(5)) - 1;
      if (SPELLS[n]) doCast(SPELLS[n].id);
    }
  },
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
showTitle();
requestAnimationFrame(frame);
