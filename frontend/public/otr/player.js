/* Player view. One page: the show, the transport, the lamp, the tube, and the EQ.
 * It uses the controls already on the page. It does not start playback and it
 * does not make another audio element.
 */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function paint() {
    var mode = (window.OTRMode && OTRMode.current()) || document.documentElement.getAttribute('data-otr-mode');
    var btn = $('otrModePlayer');
    if (btn) btn.setAttribute('aria-pressed', mode === 'player' ? 'true' : 'false');
    if (mode === 'player') ensureRack();
  }

  function ensureRack() {
    if (!(window.__otr && __otr.adv && __otr.adv.open)) return;
    if (!__otr.adv.open(true)) return;
    requestAnimationFrame(function () { window.dispatchEvent(new Event('resize')); });
  }

  function wire() {
    var btn = $('otrModePlayer');
    if (btn) btn.addEventListener('click', function () {
      if (window.OTRMode) OTRMode.set('player');
      paint();
    });
    var more = $('playerMoreSound');
    var row = $('rackRow2');
    if (more && row) more.addEventListener('click', function () {
      var on = more.getAttribute('aria-expanded') !== 'true';
      more.setAttribute('aria-expanded', on ? 'true' : 'false');
      row.classList.toggle('is-open', on);
      more.textContent = on ? 'Fewer sound controls' : 'More sound';
    });
    document.addEventListener('otr-mode', paint);
    paint();
    (function wait() {
      if (window.__otr && __otr.adv && __otr.adv.open) { paint(); return; }
      setTimeout(wait, 40);
    })();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
})();
