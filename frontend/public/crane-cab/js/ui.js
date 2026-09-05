// Console gauges, captions, cards, debug overlay. READ state, never write it
// (the one exception is debug.show, toggled by F3, which is UI-owned).
// Unit conversion for display lives here and only here.

const $ = (id) => document.getElementById(id);
let el = {};

export function init(ctx) {
  el = {
    load: $('g-load'), rated: $('g-rated'), capfill: $('g-capfill'), cappct: $('g-cappct'),
    radius: $('g-radius'), height: $('g-height'), heading: $('g-heading'), wind: $('g-wind'),
    a2b: $('l-a2b'), slack: $('l-slack'), lmi: $('l-lmi'), brake: $('l-brake'),
    channel: $('r-channel'), ptt: $('r-ptt'), caption: $('r-caption'), replies: $('r-replies'),
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
function fmtMass(kg, units) {
  return units === 'imperial' ? `${(kg * 2.20462 / 1000).toFixed(2)} t` : `${(kg / 1000).toFixed(2)} t`;
}
function fmtWind(mps, units) {
  return units === 'imperial' ? `${Math.round(mps * 2.23694)} mph` : `${Math.round(mps * 3.6)} km/h`;
}

export function update(ctx) {
  const { state } = ctx;
  const s = state.sensors;
  const u = state.settings.units;

  el.load.textContent = fmtMass(s.actualLoad, u);
  el.rated.textContent = fmtMass(s.ratedLoad, u);
  el.cappct.textContent = `${Math.round(s.capacityPct)}%`;
  el.capfill.style.width = `${Math.min(100, s.capacityPct)}%`;
  el.capfill.className = 'fill' + (s.capacityPct >= 90 ? ' alarm' : s.capacityPct >= 70 ? ' warn' : '');
  el.radius.textContent = fmtLen(s.radius, u);
  el.height.textContent = fmtLen(s.hookHeight, u);
  el.heading.textContent = String(Math.round(s.heading)).padStart(3, '0') + '\u00B0';
  el.wind.textContent = fmtWind(s.wind, u);

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

  if (state.debug.show) {
    const c = state.crane;
    el.debug.textContent =
`fps ${state.time.fps}  t ${state.time.t.toFixed(1)}  phase ${state.phase}
slew ${(c.slew * 180 / Math.PI).toFixed(1)}deg  vel ${c.slewVel.toFixed(3)}
radius ${c.radius.toFixed(2)}  line ${c.line.toFixed(2)}
sway ${(s.swayAngle * 180 / Math.PI).toFixed(2)}deg  lmi ${s.capacityPct.toFixed(0)}%
a2b ${s.a2b} slack ${s.slack} lock ${s.lmiLock} hit ${s.collision}
radio ${state.radio.script ?? '-'} / ${state.radio.node ?? '-'}  tx ${state.radio.tx}  faults ${state.radio.faults}
intent slew ${state.intent.slew} trolley ${state.intent.trolley} hoist ${state.intent.hoist} ${state.intent.range}
events
  ${state.debug.events.join('\n  ')}`;
  }
}
