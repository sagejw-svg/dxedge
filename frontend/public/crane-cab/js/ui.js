// Console gauges, captions, cards, debug overlay. READ state, never write it
// (the one exception is debug.show, toggled by F3, which is UI-owned).
// Unit conversion for display lives here and only here.

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
    estop: $('l-estop'), a2b: $('l-a2b'), slack: $('l-slack'), lmi: $('l-lmi'), brake: $('l-brake'),
    channel: $('r-channel'), ptt: $('r-ptt'), caption: $('r-caption'), replies: $('r-replies'),
    ackbar: $('r-ackbar'), ackfill: $('r-ackfill'),
    ecTitle: $('ec-title'), ecTime: $('ec-time'), ecSway: $('ec-sway'),
    ecFaults: $('ec-faults'), ecButton: $('btn-endcard'),
    debug: $('debug')
  };

  window.addEventListener('keydown', (e) => {
    if (e.key === 'F3') {
      e.preventDefault();
      ctx.state.debug.show = !ctx.state.debug.show;
      el.debug.hidden = !ctx.state.debug.show;
    }
  });
}

function fmtLen(m, units) {
  return units === 'imperial' ? `${Math.round(m * 3.28084)} ft` : `${m.toFixed(1)} m`;
}
// PHASE 2B fix: the old imperial branch divided pounds by 1000 (kips) and labelled it "t".
// US cab displays read in pounds. Metric reads kg under a tonne, tonnes above.
// Digits only. The unit goes in the gauge label instead: "4,409 lb" at 22px
// tabular does not fit the cluster column at any realistic desktop width, and
// .gauge .value clips with no ellipsis, so the operator was reading "4,40".
function fmtMass(kg, units) {
  if (units === 'imperial') return Math.round(kg * 2.20462).toLocaleString('en-US');
  return kg < 1000 ? String(Math.round(kg)) : (kg / 1000).toFixed(2);
}
function massUnit(units, kg) {
  if (units === 'imperial') return 'lb';
  return kg < 1000 ? 'kg' : 't';
}
function fmtLenShort(m, units) {
  return units === 'imperial' ? `${Math.round(m * 3.28084)}` : `${m.toFixed(1)}`;
}
function fmtWindShort(mps, units) {
  return String(Math.round(units === 'imperial' ? mps * 2.23694 : mps * 3.6));
}
function fmtClock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
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
  el.a2b.classList.toggle('on', s.a2b);
  el.slack.classList.toggle('on', s.slack);
  el.slack.classList.toggle('ok', s.slack);
  el.lmi.classList.toggle('on', s.lmiLock);
  el.brake.classList.toggle('on', state.crane.brakeOn);
  el.brake.classList.toggle('ok', state.crane.brakeOn);

  el.channel.textContent = state.radio.channel;
  el.ptt.classList.toggle('on', state.radio.pttLed);
  if (el.caption.textContent !== state.radio.caption) el.caption.textContent = state.radio.caption;
  el.caption.classList.toggle('garbled', state.radio.garbled);

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

  // End-of-lift card. main.js decides when it is on screen; this only fills it.
  if (state.phase === 'afteraction' && state.mission.result) {
    const won = state.mission.result === 'win';
    el.ecTitle.textContent = won ? 'Lift complete' : `Lift failed: ${state.mission.failReason || 'unknown'}`;
    el.ecTitle.classList.toggle('failed', !won);
    el.ecTime.textContent = fmtClock(state.mission.elapsed);
    el.ecSway.textContent = `${((state.mission.maxSway * 180) / Math.PI).toFixed(1)}\u00B0`;
    el.ecFaults.textContent = String(state.radio.faults);
    el.ecButton.textContent = won ? 'Next lift' : 'Try again';
  }

  if (state.debug.show) {
    const c = state.crane;
    el.debug.textContent =
`fps ${state.time.fps}  t ${state.time.t.toFixed(1)}  phase ${state.phase}
slew ${(c.slew * 180 / Math.PI).toFixed(1)}deg  vel ${c.slewVel.toFixed(3)}
radius ${c.radius.toFixed(2)}  line ${c.line.toFixed(2)}  reach ${s.maxLoadRadius.toFixed(2)} (${s.reachPct.toFixed(0)}%)
sway ${(s.swayAngle * 180 / Math.PI).toFixed(2)}deg  lmi ${s.capacityPct.toFixed(0)}%
a2b ${s.a2b} slack ${s.slack} lock ${s.lmiLock} hit ${s.collision}
radio ${state.radio.script ?? '-'} / ${state.radio.node ?? '-'}  tx ${state.radio.tx}  faults ${state.radio.faults}
intent slew ${state.intent.slew} trolley ${state.intent.trolley} hoist ${state.intent.hoist} ${state.intent.range}
events
  ${state.debug.events.join('\n  ')}`;
  }
}
