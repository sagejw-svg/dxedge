/* Basic mode behavior. The markup is #otr-basic in index.html.
 *
 * Live station mount: #otr-live
 *   A parallel change can build the live station player into this element.
 *   The placeholder (#otr-live-placeholder, the Listen Live button) hides when
 *   any of these is true:
 *     - #otr-live has a child that is not the placeholder
 *     - #otr-live has data-otr-live="ready"
 *     - a descendant matches [data-otr-live-player] or <otr-live-player>
 *   window.OTRBasic.liveRoot() returns the mount.
 */
(function () {
  'use strict';

  var POPULAR = [
    'suspense', 'gunsmoke', 'the-shadow', 'the-jack-benny-show',
    'fibber-mcgee-and-molly', 'dragnet', 'x-minus-one', 'lux-radio-theatre'
  ];

  function $(id) { return document.getElementById(id); }

  function liveTaken(root) {
    if (!root) return false;
    if (root.getAttribute('data-otr-live') === 'ready') return true;
    if (root.querySelector('otr-live-player, [data-otr-live-player]')) return true;
    var kids = root.children, i;
    for (i = 0; i < kids.length; i++) {
      if (kids[i].id !== 'otr-live-placeholder') return true;
    }
    return false;
  }

  function refreshLive() {
    var root = $('otr-live'), ph = $('otr-live-placeholder');
    if (!root || !ph) return;
    ph.hidden = liveTaken(root);
  }

  function syncSwitch() {
    var mode = (window.OTRMode && OTRMode.current()) || document.documentElement.getAttribute('data-otr-mode') || 'basic';
    var basic = $('otrModeBasic'), adv = $('otrModeAdvanced');
    if (basic) basic.setAttribute('aria-pressed', mode === 'basic' ? 'true' : 'false');
    if (adv) adv.setAttribute('aria-pressed', mode === 'advanced' ? 'true' : 'false');
  }

  function plain(el) {
    return ((el && el.textContent) || '').replace(/\s+/g, ' ').trim();
  }

  function syncNow() {
    var showEl = $('otrNowShow'), nextEl = $('otrNowNext'), epEl = $('otrNowEp'), play = $('otrBasicPlay');
    if (!showEl) return;
    var consoleEl = $('console');
    var idle = !consoleEl || consoleEl.classList.contains('idle');
    var audio = $('audio');
    if (idle) {
      showEl.textContent = 'Nothing playing yet';
      if (epEl) epEl.textContent = '';
      if (nextEl) nextEl.textContent = 'Pick a show below, or listen live';
      if (play) play.hidden = true;
      return;
    }
    showEl.textContent = plain($('npShow')) || 'Now playing';
    if (epEl) epEl.textContent = plain($('npEp'));
    var next = plain($('upnext')).replace(/^up next\s*/i, '').trim();
    if (nextEl) nextEl.textContent = next || 'Nothing queued after this';
    if (play) {
      play.hidden = false;
      play.textContent = (audio && !audio.paused) ? 'Pause' : 'Play';
    }
  }

  function watchNow() {
    var obs = new MutationObserver(syncNow);
    ['npShow', 'npEp', 'upnext'].forEach(function (id) {
      var el = $(id);
      if (el) obs.observe(el, { childList: true, characterData: true, subtree: true });
    });
    if ($('console')) obs.observe($('console'), { attributes: true, attributeFilter: ['class'] });
    var audio = $('audio');
    if (audio) ['play', 'pause', 'ended'].forEach(function (ev) { audio.addEventListener(ev, syncNow); });
    syncNow();
  }

  function showName(id) {
    var cat = window.__otr && __otr.catalog && __otr.catalog();
    var shows = cat && cat.shows || [];
    var i;
    for (i = 0; i < shows.length; i++) if (shows[i].id === id) return shows[i].name;
    var chip = document.querySelector('#greatChips .chip[data-id="' + id + '"]');
    return chip ? chip.textContent.replace(/\d+\s+enhanced/, '').trim() : id;
  }

  function playShow(id) {
    var chip = document.querySelector('#greatChips .chip[data-id="' + id + '"]');
    if (chip) chip.click();
    else if (window.__otr && __otr.playGreat) __otr.playGreat(id);
    syncNow();
  }

  function renderPopular() {
    var host = $('otrPopular');
    if (!host || host.childElementCount) return;
    if (!(window.__otr && __otr.ready && __otr.ready())) return;
    POPULAR.forEach(function (id) {
      var name = showName(id);
      if (!name) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'otr-pop';
      btn.dataset.id = id;
      btn.innerHTML = '<span></span><small>Play in the radio</small>';
      btn.querySelector('span').textContent = name;
      btn.addEventListener('click', function () { playShow(id); });
      host.appendChild(btn);
    });
  }

  function listenLive() {
    var ph = $('otr-live-placeholder');
    if (ph && ph.hidden) return;
    var net = document.querySelector('#networkChips .station');
    if (net) { net.click(); return; }
    var ch = document.querySelector('#channelChips .station');
    if (ch) ch.click();
  }

  function wire() {
    var basic = $('otrModeBasic'), adv = $('otrModeAdvanced'), live = $('otrLiveBtn'), play = $('otrBasicPlay');
    if (basic) basic.addEventListener('click', function () { if (window.OTRMode) OTRMode.set('basic'); syncSwitch(); });
    if (adv) adv.addEventListener('click', function () { if (window.OTRMode) OTRMode.set('advanced'); syncSwitch(); });
    if (live) live.addEventListener('click', listenLive);
    if (play) play.addEventListener('click', function () {
      var main = $('playBtn');
      if (main && !main.disabled) main.click();
      else {
        var go = $('startGo');
        if (go) go.click();
      }
      syncNow();
    });
    document.addEventListener('otr-mode', function () {
      syncSwitch();
      requestAnimationFrame(function () { window.dispatchEvent(new Event('resize')); });
    });
    var root = $('otr-live');
    if (root && window.MutationObserver) {
      new MutationObserver(refreshLive).observe(root, { childList: true, attributes: true, attributeFilter: ['data-otr-live'] });
    }
    syncSwitch();
    refreshLive();
    watchNow();
    (function wait() {
      if (window.__otr && __otr.ready && __otr.ready()) { renderPopular(); syncNow(); return; }
      setTimeout(wait, 40);
    })();
  }

  window.OTRBasic = {
    liveRoot: function () { return $('otr-live'); },
    placeholderVisible: function () {
      var ph = $('otr-live-placeholder');
      return !!(ph && !ph.hidden);
    },
    refreshLive: refreshLive,
    syncNow: syncNow
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
})();
