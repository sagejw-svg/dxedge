/* Delve. Wires the engine to the page: keys, buttons, the raycaster, the map. */

import {
  FLOOR_NAMES, FLOORS, FACING_NAME, SPELLS, DIFF_KEY,
  createGame, move, attack, cast, interact, tick, useItem,
  saveGame, loadGame, hasSave, clearSave, summarize, tileAt, debug,
} from './engine.js';
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

let game = null;
let reported = false;
let logSeen = -1;
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

function showTitle() {
  const saved = hasSave();
  showOverlay(
    '<p class="kicker">dxedge · a grid crypt</p>' +
    '<h1>Delve</h1>' +
    '<p class="lead">Four champions, one lantern, and five floors that are never quite the same. Walk the grid, fight what moves, and take the stairs. Keys and levers open the side rooms. The way down does not need them.</p>' +
    '<div class="diffs" role="group" aria-label="Difficulty">' + diffButtons(diffPref()) + '</div>' +
    '<div class="row">' +
      '<button type="button" id="begin" class="primary">New delve</button>' +
      (saved ? '<button type="button" id="continue">Continue</button>' : '') +
    '</div>' +
    '<ul class="help">' +
      '<li><b>W</b> forward, <b>S</b> back, <b>A</b> and <b>D</b> turn. Arrow keys do the same.</li>' +
      '<li><b>Q</b> and <b>E</b> strafe. The buttons under the view do all of this by mouse or touch.</li>' +
      '<li><b>Space</b> attacks. <b>F</b> uses a door, a chest, a lever, or the stairs. <b>1</b> to <b>5</b> speak the runes.</li>' +
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
      '<li>W S move, A D turn, Q E strafe. Space attacks, F uses, 1–5 are runes.</li>' +
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

function act(cmd) {
  if (!game || game.phase !== 'play' || game.paused) return;
  const before = game.hurtMs;
  const r = move(game, cmd);
  if (!r) return;
  if (r.moved) audio.step();
  else if (r.turned) audio.turn();
  else if (r.bumped) audio.hit();
  else if (r.reason === 'blocked') audio.wall();
  if (game.hurtMs > before) audio.hurt();
  if (game.phase !== 'play') showEnd();
}

function doAttack() {
  if (!game || game.phase !== 'play' || game.paused) return;
  const before = game.hurtMs;
  const r = attack(game);
  if (r && r.ok) audio.hit();
  if (game.hurtMs > before) audio.hurt();
  if (game.phase !== 'play') showEnd();
}

function doCast(id) {
  if (!game || game.phase !== 'play' || game.paused) return;
  const r = cast(game, id);
  if (r && r.ok) audio.spell();
  if (game.phase !== 'play') { audio.win(); showEnd(); }
}

function doUse() {
  if (!game || game.phase !== 'play' || game.paused) return;
  const floorBefore = game.floor;
  interact(game);
  if (game.floor !== floorBefore) audio.spell();
  else audio.pickup();
}

function paintParty() {
  if (!game) return;
  if (partyEl.childElementCount !== game.party.length) {
    partyEl.innerHTML = game.party.map((c, i) => (
      '<button type="button" class="champ" data-champ="' + i + '">' +
        '<div class="champ-top"><span class="name"></span><span class="role"></span></div>' +
        '<div class="bar hp"><i></i><em></em><span>hp</span></div>' +
        '<div class="bar sta"><i></i><em></em><span>sta</span></div>' +
        '<div class="bar mana"><i></i><em></em><span>mana</span></div>' +
        '<div class="gear"></div>' +
        '<div class="items"></div>' +
      '</button>'
    )).join('');
    partyEl.querySelectorAll('[data-champ]').forEach(btn => {
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
    el.querySelector('.role').textContent = c.role + ' · lv ' + c.level;
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
    const items = el.querySelector('.items');
    const sig = c.items.map(it => it.potion).join(',');
    if (items.getAttribute('data-sig') !== sig) {
      items.setAttribute('data-sig', sig);
      items.innerHTML = c.items.map((it, n) =>
        '<button type="button" data-item="' + n + '">' + it.potion + '</button>'
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
  floorEl.textContent = FLOOR_NAMES[game.floor] + '  ·  ' + (game.floor + 1) + ' / ' + FLOORS;
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

function paintAll() {
  paintParty();
  paintLog();
  paintHud();
  paintSpells();
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
  requestAnimationFrame(frame);
}

window.addEventListener('keydown', (e) => {
  if (e.repeat && (e.code === 'Space' || /^Digit/.test(e.code) || e.code === 'KeyF')) return;
  const cmd = KEYS[e.code];
  if (cmd) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    e.preventDefault();
    held.add(cmd);
    if (!e.repeat) {
      act(cmd);
      nextAct = performance.now() + 180;
    }
    return;
  }
  if (e.code === 'Space') { e.preventDefault(); doAttack(); }
  else if (e.code === 'KeyF' || e.code === 'Enter') { e.preventDefault(); doUse(); }
  else if (e.code === 'Escape') { e.preventDefault(); if (game && game.phase === 'play' && !game.paused) showPause(); else if (game && game.paused) { game.paused = false; hideOverlay(); } }
  else if (e.code === 'Tab') {
    e.preventDefault();
    if (!game) return;
    const dir = e.shiftKey ? -1 : 1;
    game.selected = (game.selected + dir + game.party.length) % game.party.length;
    paintParty();
  } else if (/^Digit[1-5]$/.test(e.code)) {
    const n = Number(e.code.slice(5)) - 1;
    if (SPELLS[n]) doCast(SPELLS[n].id);
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
  const on = audio.toggle();
  muteBtn.textContent = on ? 'Sound off' : 'Sound on';
  muteBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
});

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
      gleam: game.gleamMs, ward: game.wardMs,
    };
  },
  party() { return game ? game.party : []; },
  move(cmd) { return game ? move(game, cmd) : null; },
  attack() { return game ? attack(game) : null; },
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
};

paintSpells();
showTitle();
requestAnimationFrame(frame);
