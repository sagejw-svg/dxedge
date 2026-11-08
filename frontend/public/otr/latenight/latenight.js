/* Late Night replay.
 *
 * The media URL in program.json is a placeholder until the finished master
 * is actually served from that same-origin path. This file never calls
 * play(), never sets autoplay, and never points the video at a URL that
 * failed the byte-range probe. A missing file stays a pending message.
 * The main radio player, its sleep timer, and the live stations are not
 * on this page.
 */
(function () {
  'use strict';
  if (window.LateNight && window.LateNight._booted) return;

  var COPY = {
    missing: 'The Late Night replay is not on the server yet. Chapters and credits are below. Nothing is playing.',
    range: 'The replay address did not return the video in byte ranges, so it cannot be seeked. Nothing is playing.',
    type: 'The replay address answered, but not with the video file. Nothing is playing.',
    size: 'A file answered, but it is not the finished program. Nothing is playing.',
    guide: 'The program guide did not load. Nothing is playing.'
  };

  var program = null;
  var chapters = [];
  var playable = false;
  var phase = 'loading';
  var currentId = '';
  var cue = null;

  function pad(n, w) {
    n = String(n);
    while (n.length < (w || 2)) n = '0' + n;
    return n;
  }
  function formatClock(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    var whole = Math.floor(sec + 1e-6);
    var h = Math.floor(whole / 3600);
    var m = Math.floor(whole / 60) % 60;
    var s = whole % 60;
    return h + ':' + pad(m) + ':' + pad(s);
  }
  function parseTime(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return null;
    if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
    var p = s.split(':');
    if (p.length < 2 || p.length > 3) return null;
    if (p.some(function (x) { return !/^\d+(\.\d+)?$/.test(x.trim()); })) return null;
    var n = p.map(function (x) { return Number(x); });
    if (n.length === 2) return n[0] * 60 + n[1];
    return n[0] * 3600 + n[1] * 60 + n[2];
  }
  function chapterAt(list, time) {
    var t = Number(time);
    if (!list || !list.length || !isFinite(t)) return null;
    var hit = null;
    for (var i = 0; i < list.length; i++) {
      if (Number(list[i].start) <= t + 0.001) hit = list[i];
      else break;
    }
    return hit;
  }
  function resolveCue(list, raw) {
    var t = parseTime(raw);
    if (t == null || !isFinite(t) || t < 0) return null;
    var best = null;
    var bestD = 1.05;
    for (var i = 0; i < list.length; i++) {
      var d = Math.abs(Number(list[i].start) - t);
      if (d < bestD) { bestD = d; best = list[i]; }
    }
    if (best) return { time: Number(best.start), chapter: best };
    return { time: t, chapter: chapterAt(list, t) };
  }
  function parseContentRange(header) {
    var m = /bytes\s+(\d+)\s*-\s*(\d+)\s*\/\s*(\d+|\*)/i.exec(String(header || ''));
    if (!m) return null;
    return { start: Number(m[1]), end: Number(m[2]), total: m[3] === '*' ? null : Number(m[3]) };
  }
  function decideProbe(res) {
    res = res || {};
    var status = res.status;
    var type = String(res.contentType || '').toLowerCase();
    var range = parseContentRange(res.contentRange);
    var want = Number(res.bytesApprox);
    var tol = Number(res.tolerance);
    if (!(tol >= 0 && tol < 1)) tol = 0.12;
    if (status === 404 || status === 410 || status === 0 || status == null) {
      return { play: false, state: 'pending', reason: 'missing' };
    }
    if (status !== 206 || !range || range.total == null || !(range.end >= range.start)) {
      return { play: false, state: 'unavailable', reason: 'range' };
    }
    if (type.indexOf('video/mp4') < 0) {
      return { play: false, state: 'unavailable', reason: 'type' };
    }
    if (!(range.total > 0) || (want > 0 && (range.total < want * (1 - tol) || range.total > want * (1 + tol)))) {
      return { play: false, state: 'unavailable', reason: 'size' };
    }
    return { play: true, state: 'ready', reason: '', total: range.total };
  }
  function mediaUrl(media) {
    var url = String(media && media.url || '').trim();
    if (!url || /[\s<>]/.test(url)) return '';
    if (url.charAt(0) === '/' && url.charAt(1) !== '/') return url;
    try {
      var u = new URL(url, location.href);
      if (u.origin !== location.origin) return '';
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
      return u.pathname + u.search;
    } catch (e) {
      return '';
    }
  }
  function vttStamp(sec) {
    var ms = Math.max(0, Math.round(Number(sec) * 1000));
    var h = Math.floor(ms / 3600000);
    ms -= h * 3600000;
    var m = Math.floor(ms / 60000);
    ms -= m * 60000;
    var s = Math.floor(ms / 1000);
    ms -= s * 1000;
    return pad(h) + ':' + pad(m) + ':' + pad(s) + '.' + pad(ms, 3);
  }
  function toVtt(list, duration) {
    var lines = ['WEBVTT', ''];
    var endAll = Number(duration);
    if (!(endAll > 0)) endAll = list.length ? Number(list[list.length - 1].start) + 1 : 1;
    for (var i = 0; i < list.length; i++) {
      var a = Number(list[i].start);
      var b = i + 1 < list.length ? Number(list[i + 1].start) : endAll;
      if (!(b > a)) b = a + 0.001;
      lines.push(String(i + 1));
      lines.push(vttStamp(a) + ' --> ' + vttStamp(b));
      lines.push(list[i].label || 'Chapter');
      lines.push('');
    }
    return lines.join('\n');
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function $(id) { return document.getElementById(id); }

  function cueFromLocation() {
    var q = '';
    try { q = new URLSearchParams(location.search).get('t') || ''; } catch (e) {}
    var hm = /^#t=(.+)$/.exec(location.hash || '');
    return resolveCue(chapters, (hm && hm[1]) || q);
  }
  function setStatus(text) {
    var el = $('lnStatus');
    if (el) el.textContent = text || '';
  }
  function setHint(text) {
    var el = $('lnHint');
    if (el) el.textContent = text || '';
  }
  function paintCurrent() {
    var buttons = document.querySelectorAll('#lnChapters button');
    for (var i = 0; i < buttons.length; i++) {
      var on = buttons[i].getAttribute('data-id') === currentId;
      if (on) buttons[i].setAttribute('aria-current', 'true');
      else buttons[i].removeAttribute('aria-current');
    }
  }
  function chapterById(id) {
    for (var i = 0; i < chapters.length; i++) if (chapters[i].id === id) return chapters[i];
    return null;
  }
  function render() {
    var title = program.title || 'Late Night replay';
    var station = $('lnStation');
    if (station) station.textContent = program.station || '';
    var run = $('lnRun');
    if (run) {
      var clock = program.durationClock || formatClock(program.duration);
      var pic = program.picture || {};
      run.innerHTML = 'Running time <b>' + esc(clock) + '</b>'
        + (pic.width ? '. Picture, when the file is hosted: ' + esc(pic.width) + '\u00d7' + esc(pic.height)
          + (pic.fps ? ', ' + esc(pic.fps) + ' fps' : '')
          + (pic.video ? ', ' + esc(pic.video) : '')
          + (pic.audio ? ' and ' + esc(pic.audio) : '') + '.' : '.');
    }
    document.title = title + ' — Old Time Radio';
    var nav = $('lnChapters');
    if (nav) {
      nav.innerHTML = chapters.map(function (ch) {
        var detail = ch.detail ? '<span class="ln-detail">' + esc(ch.detail) + '</span>' : '';
        return '<button type="button" data-id="' + esc(ch.id) + '" data-start="' + esc(ch.start) + '" class="' + esc(ch.kind || '') + '">'
          + '<span class="ln-clock">' + esc(ch.clock || formatClock(ch.start)) + '</span>'
          + '<span class="ln-label">' + esc(ch.label) + '</span>'
          + detail
          + '</button>';
      }).join('');
    }
    var credits = $('lnCredits');
    if (credits) {
      var c = program.credits || {};
      var items = (c.sources || []).map(function (s) {
        return '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label || s.url) + '</a></li>';
      }).join('');
      credits.innerHTML = '<p>' + esc(c.line || '') + '</p>' + (items ? '<ul>' + items + '</ul>' : '');
    }
    var still = $('lnStill');
    if (still && program.poster) still.src = program.poster;
  }
  function seekTo(video, t) {
    function go() {
      try { video.currentTime = t; } catch (e) {}
    }
    if (video.readyState >= 1) go();
    else video.addEventListener('loadedmetadata', go);
  }
  function selectChapter(ch) {
    if (!ch) return;
    currentId = ch.id;
    paintCurrent();
    var video = $('lnVideo');
    if (playable && video && video.getAttribute('src')) {
      seekTo(video, Number(ch.start));
      setStatus(ch.label + ' at ' + (ch.clock || formatClock(ch.start)) + '. Press play when you want sound.');
      return;
    }
    setStatus(ch.label + ' starts at ' + (ch.clock || formatClock(ch.start)) + '. The replay is not available yet, so nothing is playing.');
  }
  function onTime() {
    var video = $('lnVideo');
    if (!video) return;
    var ch = chapterAt(chapters, video.currentTime);
    if (!ch || ch.id === currentId) return;
    currentId = ch.id;
    paintCurrent();
  }
  function attach(url) {
    var video = $('lnVideo');
    if (!video) return;
    video.autoplay = false;
    video.preload = 'metadata';
    video.controls = true;
    video.playsInline = true;
    video.setAttribute('aria-label', program.title || 'Late Night replay');
    if (program.poster) video.poster = program.poster;
    if (window.URL && URL.createObjectURL && !video.querySelector('track')) {
      var blob = new Blob([toVtt(chapters, program.duration)], { type: 'text/vtt' });
      var track = document.createElement('track');
      track.kind = 'chapters';
      track.label = 'Chapters';
      track.srclang = 'en';
      track.src = URL.createObjectURL(blob);
      track.default = true;
      video.appendChild(track);
    }
    video.hidden = false;
    var pending = $('lnPending');
    if (pending) pending.hidden = true;
    video.src = url;
    setStatus('The replay is ready. Press play to start. It does not play by itself.');
    setHint('Nothing plays until you press play.');
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('seeked', onTime);
    if (cue) {
      currentId = cue.chapter ? cue.chapter.id : currentId;
      paintCurrent();
      seekTo(video, cue.time);
    }
  }
  function showGate(decision) {
    playable = false;
    phase = decision.state || 'pending';
    var video = $('lnVideo');
    if (video) {
      video.autoplay = false;
      if (video.getAttribute('src')) {
        video.removeAttribute('src');
        try { video.load(); } catch (e) {}
      }
      video.hidden = true;
    }
    var pending = $('lnPending');
    if (pending) pending.hidden = false;
    var reason = decision.reason || 'missing';
    var text = COPY[reason] || COPY.missing;
    if (cue && cue.chapter) {
      currentId = cue.chapter.id;
      paintCurrent();
      text = cue.chapter.label + ' starts at ' + (cue.chapter.clock || formatClock(cue.chapter.start)) + '. ' + text;
    }
    setStatus(text);
    setHint('This page is the finished program, separate from the live broadcast.');
  }
  function probe(url, media) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
    return fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-1' },
      cache: 'no-store',
      credentials: 'same-origin',
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      clearTimeout(timer);
      var decision = decideProbe({
        status: res.status,
        contentType: res.headers.get('content-type'),
        contentRange: res.headers.get('content-range'),
        bytesApprox: media && media.bytesApprox,
        tolerance: media && media.tolerance
      });
      if (res.body && res.body.cancel) res.body.cancel().catch(function () {});
      return decision;
    }, function () {
      clearTimeout(timer);
      return decideProbe({ status: 0 });
    });
  }
  function boot(data) {
    program = data || {};
    chapters = (program.chapters || []).filter(function (ch) {
      return ch && typeof ch.label === 'string' && isFinite(Number(ch.start));
    }).map(function (ch) {
      ch = Object.assign({}, ch);
      ch.start = Number(ch.start);
      if (!ch.clock) ch.clock = formatClock(ch.start);
      if (!ch.id) ch.id = ch.clock;
      return ch;
    }).sort(function (a, b) { return a.start - b.start; });
    program.chapters = chapters;
    cue = cueFromLocation();
    render();
    var nav = $('lnChapters');
    if (nav && !nav._ln) {
      nav._ln = 1;
      nav.addEventListener('click', function (ev) {
        var btn = ev.target.closest ? ev.target.closest('button') : null;
        if (!btn || !nav.contains(btn)) return;
        selectChapter(chapterById(btn.getAttribute('data-id')));
      });
    }
    var url = mediaUrl(program.media);
    if (!url) {
      showGate({ state: 'pending', reason: 'missing' });
      return Promise.resolve(phase);
    }
    return probe(url, program.media).then(function (decision) {
      if (decision.play) {
        playable = true;
        phase = 'ready';
        attach(url);
        if (cue && cue.chapter) {
          currentId = cue.chapter.id;
          paintCurrent();
        }
      } else {
        showGate(decision);
      }
      return phase;
    });
  }

  window.LateNight = {
    formatClock: formatClock,
    parseTime: parseTime,
    chapterAt: chapterAt,
    resolveCue: resolveCue,
    decideProbe: decideProbe,
    mediaUrl: mediaUrl,
    toVtt: toVtt,
    program: function () { return program; },
    chapters: function () { return chapters; },
    state: function () { return phase; },
    playable: function () { return playable; },
    videoSrc: function () {
      var v = $('lnVideo');
      return v ? (v.getAttribute('src') || '') : '';
    }
  };

  function start() {
    fetch('program.json?v=1', { cache: 'no-store', credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error('guide');
        return res.json();
      })
      .then(boot)
      .catch(function () {
        program = { title: 'Late Night replay', chapters: [], credits: {} };
        chapters = [];
        showGate({ state: 'unavailable', reason: 'guide' });
      });
  }
  if (document.getElementById('lnApp')) {
    window.LateNight._booted = 1;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  }
})();
