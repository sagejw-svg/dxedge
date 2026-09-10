// Console gauges, captions, cards, debug overlay. READ state, never write it.
// Two exceptions, both display choices that touch no simulation state and are
// owned here for that reason: debug.show, toggled by F3, and settings.hud,
// toggled by G. hud hides the screen console; the same gauges are drawn on the
// cab's own instrument panels by render.js, so hiding it puts the operator's
// eyes in the cab rather than taking his instruments away.
// Unit conversion for display lives here and only here.

import { MISSIONS } from '../data/missions.js';
import { buildLabel } from '../data/build.js';
// Reading a number out to the operator is shared with render.js, which draws the
// same gauges on the cab's own instrument panel. See data/units.js.
import {
  fmtMass, massUnit, fmtLenShort, fmtWindShort, fmtClock
} from '../data/units.js';

const $ = (id) => document.getElementById(id);
let el = {};

export function init(ctx) {
  el = {
    load: $('g-load'), rated: $('g-rated'),
    loadUnit: $('g-load-label'), ratedUnit: $('g-rated-label'),
    radiusUnit: $('g-radius-label'), reachUnit: $('g-reach-label'),
    heightUnit: $('g-height-label'), windUnit: $('g-wind-label'), capfill: $('g-capfill'), cappct: $('g-cappct'),
    radius: $('g-radius'), height: $('g-height'), heading: $('g-heading'), wind: $('g-wind'),
    reach: $('g-reach'), reachfill: $('g-reachfill'),
    estop: $('l-estop'), cam: $('l-cam'), a2b: $('l-a2b'), slack: $('l-slack'), lmi: $('l-lmi'), brake: $('l-brake'),
    channel: $('r-channel'), ptt: $('r-ptt'), caption: $('r-caption'), replies: $('r-replies'),
    ackbar: $('r-ackbar'), ackfill: $('r-ackfill'),
    ecTitle: $('ec-title'), ecTime: $('ec-time'), ecSway: $('ec-sway'),
    ecFaults: $('ec-faults'), ecButton: $('btn-endcard'), ecError: $('ec-error'),
    ecGrade: $('ec-grade'), ecGradeLetter: $('ec-grade-letter'), ecPlan: $('ec-plan'),
    ecWhy: $('ec-why'), ecEarned: $('ec-earned'), ecBest: $('ec-best'),
    ecBoard: $('ec-board'), ecBoardCount: $('ec-board-count'), ecBoardList: $('ec-board-list'),
    debug: $('debug'),
    build: $('build-stamp')
  };

  // Written once. It never changes while the page is open, and it is the fastest
  // way to tell a cached copy from a fresh one without reading the gauges.
  if (el.build) el.build.textContent = buildLabel();

  window.addEventListener('keydown', (e) => {
    if (e.key === 'F3') {
      e.preventDefault();
      ctx.state.debug.show = !ctx.state.debug.show;
      el.debug.hidden = !ctx.state.debug.show;
      return;
    }
    // G hides the screen console. Every gauge on it is also on the cab's own
    // instrument panel, on the right hand console where an operator's gauges
    // actually are, so turning this off is not turning the instruments off: it is
    // putting your eyes where they would be. Owned here for the same reason F3 is
    // - it is a display choice, it touches no simulation state, and input.js
    // deals in intents rather than in what is on the screen. Guarded on the phase
    // so it cannot be pressed from a card, and saved with the other settings.
    if (e.code === 'KeyG' && !e.repeat && !isTypingTarget(e) &&
        ctx.state.phase === 'playing') {
      e.preventDefault();
      ctx.state.settings.hud = !ctx.state.settings.hud;
      applyHud(ctx.state);
      ctx.bus.emit('settings.changed', { hud: ctx.state.settings.hud });
    }
  });

  applyHud(ctx.state);
}

// The screen console, shown or not. Kept off aria-hidden as well as hidden so a
// screen reader is not still reading gauges nobody can see.
function applyHud(state) {
  const dock = document.getElementById('console');
  if (!dock) return;
  const on = state.settings.hud !== false;
  dock.hidden = !on;
  dock.setAttribute('aria-hidden', on ? 'false' : 'true');
}

// Typing into a field is not a game key. input.js has its own copy of this for
// the same reason the two modules do not import each other.
function isTypingTarget(e) {
  const t = e.target;
  return !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable));
}

// The after-action card. main.js hands over the object scoring.js produced; this
// renders it and does no arithmetic of its own beyond unit conversion, which is
// the one thing that does belong here.
export function showAfterAction(ctx, a) {
  const u = ctx.state.settings.units;
  el.ecTitle.textContent = a.won ? 'Lift complete' : `Lift failed: ${a.reason || 'unknown'}`;
  el.ecTitle.classList.toggle('failed', !a.won);
  el.ecTime.textContent = fmtClock(a.elapsed);
  el.ecSway.textContent = `${((a.maxSway * 180) / Math.PI).toFixed(1)}\u00B0`;
  el.ecFaults.textContent = String(a.radioFaults);
  el.ecError.textContent = a.landingError === null || a.landingError === undefined
    ? '-'
    : (u === 'imperial'
      ? `${(a.landingError * 3.28084).toFixed(1)} ft`
      : `${a.landingError.toFixed(2)} m`);

  el.ecGrade.hidden = !a.won || !a.grade;
  if (a.grade) el.ecGradeLetter.textContent = a.grade;

  el.ecWhy.textContent = !a.won ? ''
    : a.demerits.length === 0
      ? 'Nothing to pick at. Clean lift.'
      : `Cost you the grade: ${a.demerits.map((d) => d.why).join(', ')}.`;

  // Guarded on the win like the two lines around it. Nothing is unlocked by a
  // lift that ended in a fail, and this line used to be the only one on the card
  // without the guard.
  el.ecEarned.textContent = a.won && a.earned && a.earned.length
    ? `Unlocked: ${a.earned.join(', ')}.` : '';

  el.ecBest.textContent = !a.savedOk
    ? 'This browser is not keeping saved progress, so none of this is being kept.'
    : !a.won ? ''
      : a.personalBest ? 'Personal best for this lift.'
        : a.best ? `Your best here: ${fmtClock(a.best.elapsed)}, grade ${a.best.grade || '-'}.` : '';

  drawPlan(a, u);
  drawBoard(a);
  el.ecButton.textContent = a.won ? 'Next lift' : 'Try again';
}

// The board. Rebuilt every card rather than diffed, because it is twenty rows
// once and the card is not a hot path. What was unlocked on this lift is marked,
// so the player can see the new one in its place among the rest rather than only
// as a name in a sentence above.
function drawBoard(a) {
  const board = a.board || [];
  if (!el.ecBoard) return;
  el.ecBoard.hidden = board.length === 0;
  if (!board.length) return;
  const got = board.filter((b) => b.got).length;
  el.ecBoardCount.textContent = `Board: ${got} of ${board.length}`;
  const list = el.ecBoardList;
  while (list.firstChild) list.removeChild(list.firstChild);
  for (let i = 0; i < board.length; i += 1) {
    const b = board[i];
    const li = document.createElement('li');
    li.className = `${b.got ? 'got' : 'locked'}${b.fresh ? ' fresh' : ''}`;
    const name = document.createElement('b');
    name.textContent = b.name;
    const how = document.createElement('span');
    how.textContent = b.how;
    li.appendChild(name);
    li.appendChild(how);
    list.appendChild(li);
  }
}

// Where it actually landed, against the circle it was graded on. The Backlog
// asks for a footprint-versus-pad overlay; this is it, drawn to scale, with the
// view sized to whichever is bigger so a wild miss still fits on the card.
function drawPlan(a, units) {
  const plan = el.ecPlan;
  while (plan.firstChild) plan.removeChild(plan.firstChild);
  if (!a.landedAt || !a.landingPos || !a.landingTol) { plan.setAttribute('hidden', ''); return; }
  plan.removeAttribute('hidden');

  const dx = a.landedAt[0] - a.landingPos[0];
  const dz = a.landedAt[2] - a.landingPos[2];
  const err = Math.hypot(dx, dz);
  // Metres shown across half the box. Has to hold the pad, the miss and the load
  // itself: a 1.8 m crate on a 0.3 m pad drew a footprint wider than the card.
  const [lx, , lz] = a.loadSize || [1, 1, 1];
  const half = Math.max(a.landingTol * 2.2, err * 1.6, Math.max(lx, lz) * 0.85, 0.6);
  const S = 60 / half;                                          // pixels per metre
  const ns = 'http://www.w3.org/2000/svg';
  const add = (tag, attrs) => {
    const n = document.createElementNS(ns, tag);
    Object.keys(attrs).forEach((k) => n.setAttribute(k, attrs[k]));
    plan.appendChild(n);
    return n;
  };

  add('circle', { cx: 60, cy: 60, r: a.landingTol * S, fill: 'none', stroke: '#e0a83a', 'stroke-width': 1.5 });
  add('circle', { cx: 60, cy: 60, r: 1.5, fill: '#e0a83a' });

  const sx = lx;
  const sz = lz;
  const hit = err <= a.landingTol;
  add('rect', {
    x: 60 + dx * S - (sx * S) / 2,
    y: 60 + dz * S - (sz * S) / 2,
    width: sx * S, height: sz * S,
    fill: hit ? '#6fbf7333' : '#d9482b33',
    stroke: hit ? '#6fbf73' : '#d9482b', 'stroke-width': 1.2
  });
  if (err > 0.02) {
    add('line', {
      x1: 60, y1: 60, x2: 60 + dx * S, y2: 60 + dz * S,
      stroke: '#7d878c', 'stroke-width': 1, 'stroke-dasharray': '2 2'
    });
  }
  const label = units === 'imperial' ? `${(err * 3.28084).toFixed(1)} ft` : `${err.toFixed(2)} m`;
  const t = add('text', { x: 60, y: 114, fill: '#7d878c', 'font-size': 9, 'text-anchor': 'middle' });
  t.textContent = label;
}

export function update(ctx) {
  const { state } = ctx;
  const s = state.sensors;
  const u = state.settings.units;

  el.load.textContent = fmtMass(s.actualLoad, u);
  el.rated.textContent = fmtMass(s.ratedLoad, u);
  // Units live in the labels. Every value in the cluster is digits, because
  // .gauge .value clips with no ellipsis and the column is ~90px: "98 / 138 ft"
  // and "17 ft" were both being cut off on any screen under 1366px.
  const lenU = u === 'imperial' ? 'ft' : 'm';
  el.loadUnit.textContent = `Load ${massUnit(u, s.actualLoad)}`;
  el.ratedUnit.textContent = `Rated ${massUnit(u, s.ratedLoad)}`;
  el.radiusUnit.textContent = `Radius ${lenU}`;
  el.reachUnit.textContent = `Reach ${lenU}`;
  el.heightUnit.textContent = `Hook ht ${lenU}`;
  el.windUnit.textContent = u === 'imperial' ? 'Wind mph' : 'Wind km/h';
  el.cappct.textContent = `${Math.round(s.capacityPct)}%`;
  el.capfill.style.width = `${Math.min(100, s.capacityPct)}%`;
  el.capfill.className = 'fill' + (s.capacityPct >= 90 ? ' alarm' : s.capacityPct >= 70 ? ' warn' : '');
  el.radius.textContent = fmtLenShort(s.radius, u);
  // Reach: how far out this load may go before the chart says no. The bar shows
  // how close the trolley is to it and the Radius gauge right next door already
  // reads the current radius, so printing both here was duplicated information
  // in the one string too long for the column.
  el.reach.textContent = fmtLenShort(s.maxLoadRadius, u);
  el.reachfill.style.width = `${Math.min(100, s.reachPct)}%`;
  el.reachfill.className = 'fill' + (s.reachPct >= 90 ? ' alarm' : s.reachPct >= 70 ? ' warn' : '');
  el.height.textContent = fmtLenShort(s.hookHeight, u);
  el.heading.textContent = String(Math.round(s.heading)).padStart(3, '0') + '\u00B0';
  el.wind.textContent = fmtWindShort(s.wind, u);

  // E-stop first: while it is latched nothing else on the console explains why
  // the crane will not move.
  el.estop.classList.toggle('on', state.crane.estopped);

  // Hook cam lamp. render.js makes the same allowed/wanted decision from the
  // same state; ui does not reach across to tell it, because systems do not
  // import each other.
  const mission = MISSIONS.find((m) => m.id === state.mission.id);
  const camAllowed = !mission || mission.hookCam !== false;
  const camWanted = !!state.intent.hookCam;
  el.cam.classList.toggle('on', camAllowed && camWanted);
  el.cam.classList.toggle('denied', camWanted && !camAllowed);
  el.cam.textContent = camWanted && !camAllowed ? 'Cam off' : 'Cam';
  el.a2b.classList.toggle('on', s.a2b);
  el.slack.classList.toggle('on', s.slack);
  el.slack.classList.toggle('ok', s.slack);
  el.lmi.classList.toggle('on', s.lmiLock);
  el.brake.classList.toggle('on', state.crane.brakeOn);
  el.brake.classList.toggle('ok', state.crane.brakeOn);

  el.channel.textContent = state.radio.channel;
  el.ptt.classList.toggle('on', state.radio.pttLed);
  if (el.caption.textContent !== state.radio.caption) el.caption.textContent = state.radio.caption;
  el.caption.classList.toggle('answered', state.radio.answered !== null);

  // Ack countdown. Only shown while a node's reply window is actually running.
  const ackOn = state.radio.ackTimeout > 0 && state.radio.ackTimer > 0;
  el.ackbar.hidden = !ackOn;
  if (ackOn) {
    el.ackfill.style.width = `${Math.max(0, Math.min(100, (state.radio.ackTimer / state.radio.ackTimeout) * 100))}%`;
  }

  // Reply strip. Rebuild only when labels change. Phase 3 wires clicks to intent.reply.
  const labels = state.radio.replies.join('|');
  if (el.replies.dataset.labels !== labels) {
    el.replies.dataset.labels = labels;
    el.replies.replaceChildren(...state.radio.replies.map((label, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `${i + 1}  ${label}`;
      b.dataset.index = String(i);   // input.js delegates clicks to intent.reply
      return b;
    }));
  }
  // Full duplex: an answer given over the top of ground is held until the call
  // ends, so the button that was pressed stays lit until it lands. Without this
  // the press vanished with no acknowledgement and read as a dropped input.
  const held = state.radio.answered;
  for (const b of el.replies.children) {
    b.classList.toggle('banked', held !== null && b.textContent.endsWith(held));
  }


  if (state.debug.show) {
    const c = state.crane;
    el.debug.textContent =
`${buildLabel()}
fps ${state.time.fps}  t ${state.time.t.toFixed(1)}  phase ${state.phase}
slew ${(c.slew * 180 / Math.PI).toFixed(1)}deg  vel ${c.slewVel.toFixed(3)}
radius ${c.radius.toFixed(2)}  line ${c.line.toFixed(2)}  reach ${s.maxLoadRadius.toFixed(2)} (${s.reachPct.toFixed(0)}%)
sway ${(s.swayAngle * 180 / Math.PI).toFixed(2)}deg (load ${(s.loadSway * 180 / Math.PI).toFixed(2)}deg)  lmi ${s.capacityPct.toFixed(0)}%
a2b ${s.a2b} slack ${s.slack} lock ${s.lmiLock} hit ${s.collision}
radio ${state.radio.script ?? '-'} / ${state.radio.node ?? '-'}  tx ${state.radio.tx}  faults ${state.radio.faults}
intent slew ${state.intent.slew} trolley ${state.intent.trolley} hoist ${state.intent.hoist} ${state.intent.range}
events
  ${state.debug.events.join('\n  ')}`;
  }
}
