/* DXEdge usage beacon.
 *
 * Loaded by the React shell and by every standalone page under /invaders/,
 * /morse-invaders/, /skip/, /spot-chaser/, /crane-cab/ and /emulators/.
 * One file, one session, whichever of those the visitor is looking at.
 *
 * What it does not do, deliberately:
 *   - no cookies
 *   - no localStorage, except one key, and only if the visitor opts out
 *   - no fingerprinting, no canvas, no screen or font probing
 *   - no third party of any kind; the only host it talks to is this one
 *
 * The session id lives in sessionStorage, so the browser throws it away when
 * the tab closes. Same-origin iframes share the tab's sessionStorage, which
 * is why a game iframe and the shell around it report as one session rather
 * than two. Nothing identifies a person across days; see backend/usage.py
 * for what the server keeps, which is less than what arrives here.
 *
 * Every call is wrapped so that a failure here can never break a page. This
 * is instrumentation. If it breaks, it should break silently and alone.
 */
(function () {
  'use strict';

  var ENDPOINT = '/api/stat';
  var OPT_OUT_KEY = 'dxedge_stats_opt_out';
  var SESSION_KEY = 'dxedge_sid';
  var FLUSH_MS = 4000;
  var MAX_QUEUE = 30;

  function optedOut() {
    try {
      if (localStorage.getItem(OPT_OUT_KEY) === '1') return true;
    } catch (e) { /* storage blocked: treat as opted in, we store nothing */ }
    try {
      if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return true;
      if (navigator.globalPrivacyControl === true) return true;
    } catch (e) {}
    return false;
  }

  var off = optedOut();

  function sessionId() {
    try {
      var s = sessionStorage.getItem(SESSION_KEY);
      if (s && s.length >= 8) return s;
      var id = '';
      var bytes = new Uint8Array(9);
      (window.crypto || window.msCrypto).getRandomValues(bytes);
      for (var i = 0; i < bytes.length; i++) id += (bytes[i] + 256).toString(16).slice(1);
      sessionStorage.setItem(SESSION_KEY, id);
      return id;
    } catch (e) {
      // Private mode with storage disabled. Keep an in-memory id so the
      // session still holds together for this page, then let it vanish.
      if (!sessionId._mem) sessionId._mem = 'm' + Math.random().toString(16).slice(2, 12);
      return sessionId._mem;
    }
  }

  var sid = off ? '' : sessionId();
  var queue = [];
  var timer = null;
  var started = Date.now();

  function send(useBeacon) {
    if (off || !queue.length) return;
    var payload = JSON.stringify({ s: sid, e: queue.slice(0, MAX_QUEUE) });
    queue = [];
    try {
      // sendBeacon survives the page going away, which is the only way the
      // final heartbeat of a session ever arrives.
      if (useBeacon && navigator.sendBeacon) {
        var blob = new Blob([payload], { type: 'application/json' });
        if (navigator.sendBeacon(ENDPOINT, blob)) return;
      }
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
  }

  function schedule() {
    if (timer || off) return;
    timer = setTimeout(function () { timer = null; send(false); }, FLUSH_MS);
  }

  function event(kind, tab, detail, value) {
    if (off) return;
    try {
      if (queue.length >= MAX_QUEUE) return;
      var e = { k: String(kind) };
      if (tab != null) e.t = String(tab);
      if (detail != null) e.d = String(detail);
      if (value != null && isFinite(value)) e.v = Number(value);
      queue.push(e);
      schedule();
    } catch (x) {}
  }

  function refHost() {
    try {
      if (!document.referrer) return '';
      var h = new URL(document.referrer).hostname;
      // Internal navigation is not a referrer worth counting.
      if (h === location.hostname) return '';
      return h.replace(/^www\./, '');
    } catch (e) { return ''; }
  }

  function heartbeat() {
    if (off) return;
    event('heartbeat', '', '', Math.round((Date.now() - started) / 1000));
  }

  var api = {
    event: event,
    tab: function (id) { event('tab', id); },
    game: function (name) { event('game', name); },
    gameEnd: function (name, score) { event('game_end', name, '', score); },
    milestone: function (name, what) { event('milestone', name, what); },
    emulator: function (slug) { event('emulator', '', slug); },
    flush: function () { send(true); },
    optOut: function () {
      try { localStorage.setItem(OPT_OUT_KEY, '1'); } catch (e) {}
      off = true; queue = [];
    },
    optIn: function () {
      try { localStorage.removeItem(OPT_OUT_KEY); } catch (e) {}
      off = optedOut();
      if (!off && !sid) sid = sessionId();
    },
    get enabled() { return !off; },
    get sid() { return sid; },
  };

  // The shell and each standalone page both load this file, but only the
  // first one in a given document should open the session.
  if (!window.dxstat) {
    window.dxstat = api;
    if (!off) {
      // Only a top-level document opens a session. A game running in an
      // iframe shares the tab's sessionStorage and so shares the session id,
      // and if it also reported a session the same visit would be counted
      // under two different entry paths.
      var isTop = true;
      try { isTop = window.top === window.self; } catch (e) { isTop = false; }
      if (isTop) {
        // Path, not full URL: no query strings, so a callsign passed to a
        // game as ?call= never reaches the server as part of a stat.
        event('session', location.pathname.slice(0, 24), refHost());
      }

      setInterval(heartbeat, 60000);

      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') { heartbeat(); send(true); }
      });
      window.addEventListener('pagehide', function () { heartbeat(); send(true); });
    }
  }
})();
