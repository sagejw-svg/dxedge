/* Sci-Fi (Live): a second schedule-synced station.
 *
 * Same Eastern wall clock as Listenotr Radio. The lineup is only catalog
 * shows on the "future" channel (the science-fiction genre in catalog.json).
 * Every episode plays at its catalog length. A fixed gap sits between
 * episodes, and announcer clips from assets/manifest.json play only inside
 * that gap. A clip that would run into the next episode is left out.
 *
 * The standalone page is /otr/live/scifi/. On /otr the same schedule is a
 * station card, "Sci-Fi (Live)", and the main player locks live controls.
 */
(function () {
  'use strict';
  if (window.__scifiLive) return;
  window.__scifiLive = 1;

  var TIP = 'Disabled in live listen mode';
  var EVENING_H = 19;
  var LATE_H = 22;
  var SILENCE_PAD = 2.5;
  var EPOCH_KEY = '2026-01-01';
  var TZ = 'America/New_York';

  var SRC = (document.currentScript && document.currentScript.src) || '';
  var AT = SRC.indexOf('live/scifi/scifi-live.js');
  var ROOT = AT >= 0 ? SRC.slice(0, AT) : '/otr/';
  var ASSET = ROOT + 'live/scifi/assets/';

  var wallFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  var CAT = null, PACK = null, SHOW_UP = {}, items = [], total = 0, GAP = 8;
  var seriesList = [], byId = {};
  var jingle = null, ids = [], ups = [], evening = null, late = null;
  var booted = false, fail = null, clockMs = null, epoch = 0;
  var armed = false, want = false, mode = null, audioEl = null, bound = null;
  var loadedKey = '', pendingAt = 0, suppressPause = 0, timer = null;
  var savedLabel = null, lastKind = '';
  var SILENCE = 'data:audio/wav;base64,UklGRmQGAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YUAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

  function hashStr(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rnd) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function nowMs() { return clockMs == null ? Date.now() : clockMs; }
  function fmt(sec) {
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + pad(s);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function niceTitle(t) {
    if (!t) return '';
    var x = String(t).trim();
    if (x === x.toUpperCase() && /[A-Z]/.test(x) && x.length > 3)
      x = x.toLowerCase().replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); });
    return x;
  }
  function airTitle(title, date) {
    var nice = niceTitle(title);
    var api = window.OTRAirDate;
    return api ? api.withAirDate(nice, date) : nice;
  }
  function wallClock(unixMs) {
    var d = new Date(unixMs), g = {};
    wallFmt.formatToParts(d).forEach(function (p) { if (p.type !== 'literal') g[p.type] = p.value; });
    var hour = +g.hour;
    if (hour === 24) hour = 0;
    return {
      dateKey: g.year + '-' + g.month + '-' + g.day,
      hour: hour, minute: +g.minute, second: +g.second,
      sod: hour * 3600 + (+g.minute) * 60 + (+g.second) + d.getMilliseconds() / 1000
    };
  }
  function unixFor(dateKey, sod) {
    var y = +dateKey.slice(0, 4), mo = +dateKey.slice(5, 7), da = +dateKey.slice(8, 10);
    var sec = Math.floor(sod), ms = Math.round((sod - sec) * 1000);
    if (ms === 1000) { sec += 1; ms = 0; }
    var h = Math.floor(sec / 3600), mi = Math.floor(sec / 60) % 60, s = sec % 60;
    var guess = Date.UTC(y, mo - 1, da, h, mi, s, ms);
    for (var i = 0; i < 6; i++) {
      var w = wallClock(guess);
      var wantU = Date.UTC(y, mo - 1, da, h, mi, s, ms);
      var got = Date.UTC(+w.dateKey.slice(0, 4), +w.dateKey.slice(5, 7) - 1, +w.dateKey.slice(8, 10), w.hour, w.minute, w.second, Math.round((w.sod % 1) * 1000));
      if (wantU === got) return guess;
      guess += wantU - got;
    }
    return guess;
  }
  function epDur(ep) {
    var d = ep && ep[2];
    return (typeof d === 'number' && d > 0) ? d : 1800;
  }
  function epUrl(show, ep) { return CAT.prefix + show.ids[ep[3]] + '/' + ep[4]; }

  function clipOf(f) {
    return {
      file: f.file, type: f.type, text: f.text || '',
      url: ASSET + f.file,
      dur: (+f.seconds > 0 ? +f.seconds : 6)
    };
  }
  function byType(type) {
    return ((PACK && PACK.files) || []).filter(function (f) { return f.type === type; })
      .map(clipOf)
      .sort(function (a, b) { return a.file < b.file ? -1 : a.file > b.file ? 1 : 0; });
  }
  function maxDur(list) {
    var m = 0;
    for (var i = 0; i < list.length; i++) if (list[i].dur > m) m = list[i].dur;
    return m;
  }
  function loadPack(pack) {
    PACK = pack || { files: [] };
    var jing = byType('jingle');
    jingle = null;
    for (var i = 0; i < jing.length; i++) if (jing[i].file === 'scifi-jingle.mp3') jingle = jing[i];
    if (!jingle && jing.length) jingle = jing[0];
    ids = byType('station_id');
    ups = byType('up_next');
    var intros = byType('time_intro');
    evening = null; late = null;
    intros.forEach(function (c) {
      if (/evening/.test(c.file)) evening = c;
      else if (/late/.test(c.file)) late = c;
    });
    // Generic up-next lines do not name the next series, so they are not used.
    // Each break gets the pack line for the show that actually follows.
  }
  function loadShowUps(pack) {
    SHOW_UP = {};
    var map = (pack && pack.upNext) || {};
    Object.keys(map).forEach(function (id) {
      var e = map[id];
      if (!e || !e.file) return;
      SHOW_UP[id] = {
        file: e.file, type: 'up_next', dur: +e.dur > 0 ? +e.dur : 6,
        url: ROOT + 'live/pack/' + e.file, showId: id
      };
    });
  }

  function isSciFi(s) {
    return !!(s && s.eps && s.eps.length && !s.adv && s.id !== 'commercials' && (s.ch || []).indexOf('future') >= 0);
  }
  function programOrder(shows) {
    var lists = shows.map(function (s) {
      var idx = s.eps.map(function (_, i) { return i; });
      shuffle(idx, mulberry32(hashStr('scifi-live-v1|' + s.id)));
      return { s: s, idx: idx, p: 0, initial: idx.length };
    }).filter(function (x) { return x.initial > 0; });
    var order = [], remaining = lists.reduce(function (a, x) { return a + x.initial; }, 0);
    while (order.length < remaining) {
      var best = null, bestScore = -1;
      for (var i = 0; i < lists.length; i++) {
        var L = lists[i];
        if (L.p >= L.initial) continue;
        var score = (L.initial - L.p) / L.initial;
        if (score > bestScore) { bestScore = score; best = L; }
      }
      if (!best) break;
      order.push({ show: best.s, epIndex: best.idx[best.p] });
      best.p++;
    }
    return order;
  }
  function build(catalog) {
    CAT = catalog;
    seriesList = [];
    byId = {};
    (catalog.shows || []).forEach(function (s) {
      if (!isSciFi(s)) return;
      seriesList.push({ id: s.id, name: s.name, episodes: s.eps.length });
      byId[s.id] = s;
    });
    var order = programOrder(seriesList.map(function (s) { return byId[s.id]; }));
    items = [];
    var t = 0, maxGap = 0;
    order.forEach(function (p, n) {
      var ep = p.show.eps[p.epIndex];
      var dur = epDur(ep);
      var next = order[(n + 1) % order.length];
      var up = SHOW_UP[next.show.id] || null;
      var id = ids.length ? ids[n % ids.length] : null;
      var gap = (jingle ? jingle.dur : 0) + (id ? id.dur : 0) + (up ? up.dur : 0) + SILENCE_PAD;
      if (gap > maxGap) maxGap = gap;
      items.push({
        kind: 'show', start: t, dur: dur, catalogDur: dur, ordinal: n,
        showId: p.show.id, showName: p.show.name, epIndex: p.epIndex,
        title: ep[0] || '', date: ep[1] || '', url: epUrl(p.show, ep)
      });
      t += dur;
      items.push({
        kind: 'break', start: t, dur: gap, ordinal: n, afterShow: dur,
        idClip: id, upClip: up
      });
      t += gap;
    });
    total = t;
    GAP = maxGap || SILENCE_PAD;
    epoch = unixFor(EPOCH_KEY, 0);
  }

  function markInside(prevEndMs, gapEndMs, hour) {
    var keys = {};
    keys[wallClock(prevEndMs).dateKey] = 1;
    keys[wallClock(Math.max(prevEndMs, gapEndMs - 1)).dateKey] = 1;
    for (var dateKey in keys) {
      var m = unixFor(dateKey, hour * 3600);
      if (prevEndMs < m && m < gapEndMs) return true;
    }
    return false;
  }
  function planCues(it, startMs) {
    var slot = jingle ? jingle.dur : 0;
    var open = jingle;
    var prevEnd = startMs - (it.afterShow || 0) * 1000;
    var gapEnd = startMs + it.dur * 1000;
    // The evening and late-night greetings replace the jingle only when the
    // whole file fits in that slot. They do not name an episode.
    if (jingle && late && late.dur <= slot + 0.05 && markInside(prevEnd, gapEnd, LATE_H)) open = late;
    else if (jingle && evening && evening.dur <= slot + 0.05 && markInside(prevEnd, gapEnd, EVENING_H)) open = evening;
    var seq = [];
    if (open) seq.push(open);
    if (it.idClip) seq.push(it.idClip);
    if (it.upClip) seq.push(it.upClip);
    function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i].dur; return s; }
    var room = Math.max(0, it.dur - 0.2);
    while (seq.length > 1 && sum(seq) > room) seq.shift();
    if (seq.length === 1 && seq[0].dur > room) return [];
    var at = 0;
    var out = [];
    if (open && seq.indexOf(open) >= 0) {
      out.push({
        url: open.url, file: open.file, type: open.type, text: open.text || '',
        dur: open.dur, at0: 0, showId: null
      });
      at = slot || open.dur;
    }
    seq.forEach(function (c) {
      if (c === open) return;
      out.push({
        url: c.url, file: c.file, type: c.type, text: c.text || '',
        dur: c.dur, at0: at, showId: c.showId || null
      });
      at += c.dur;
    });
    return out;
  }

  function itemAt(pos) {
    var lo = 0, hi = items.length - 1;
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1;
      if (items[mid].start <= pos) lo = mid; else hi = mid - 1;
    }
    return lo;
  }
  function place(ms) {
    var elapsed = (ms - epoch) / 1000;
    var cycle = Math.floor(elapsed / total);
    var pos = elapsed - cycle * total;
    if (pos < 0) { pos += total; cycle -= 1; }
    if (pos >= total) { pos -= total; cycle += 1; }
    return { cycle: cycle, pos: pos, index: itemAt(pos) };
  }
  function onAir(ms) {
    if (!booted || !items.length) return null;
    ms = ms == null ? nowMs() : ms;
    var p = place(ms);
    var it = items[p.index];
    var offset = p.pos - it.start;
    if (offset < 0) offset = 0;
    if (offset > it.dur) offset = it.dur;
    var startMs = epoch + (p.cycle * total + it.start) * 1000;
    var next = null;
    for (var k = 1; k <= items.length; k++) {
      var nx = items[(p.index + k) % items.length];
      if (nx.kind === 'show') { next = nx; break; }
    }
    var cues = it.kind === 'break' ? planCues(it, startMs) : [];
    var cue = null;
    for (var i = 0; i < cues.length; i++) {
      if (offset >= cues[i].at0 && offset < cues[i].at0 + cues[i].dur - 0.0001) {
        cue = {
          url: cues[i].url, file: cues[i].file, type: cues[i].type, text: cues[i].text,
          dur: cues[i].dur, at0: cues[i].at0, at: offset - cues[i].at0
        };
        break;
      }
    }
    return {
      kind: it.kind, start: it.start, dur: it.dur, offset: offset,
      catalogDur: it.catalogDur == null ? it.dur : it.catalogDur,
      trimmed: it.kind === 'show' ? it.dur + 0.001 < it.catalogDur : false,
      showId: it.kind === 'show' ? it.showId : null,
      show: it.showName || null,
      title: it.title || null,
      date: it.date || null,
      epIndex: it.epIndex == null ? null : it.epIndex,
      url: it.url || null,
      ordinal: it.ordinal,
      cycle: p.cycle,
      startMs: startMs,
      key: it.kind + '|' + p.cycle + '|' + p.index,
      cues: cues,
      cue: cue,
      nextShow: next ? next.showName : null,
      nextTitle: next ? next.title : null,
      nextDate: next ? (next.date || '') : null,
      nextShowId: next ? next.showId : null,
      nextUrl: next ? next.url : null
    };
  }
  function overlaps(ms, seconds, kind) {
    var winEnd = ms + seconds * 1000;
    var elapsed = (ms - epoch) / 1000;
    var cycle0 = Math.floor(elapsed / total);
    var span = Math.ceil(seconds / total) + 1;
    var out = [];
    for (var c = 0; c < span; c++) {
      var cycle = cycle0 + c;
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.kind !== kind) continue;
        var startMs = epoch + (cycle * total + it.start) * 1000;
        var endMs = startMs + it.dur * 1000;
        if (endMs <= ms || startMs >= winEnd) continue;
        if (kind === 'show') {
          out.push({ showId: it.showId, epIndex: it.epIndex, startMs: startMs, dur: it.dur });
        } else {
          var cues = planCues(it, startMs);
          out.push({
            startMs: startMs, dur: it.dur, ordinal: it.ordinal,
            cues: cues.map(function (q) { return { type: q.type, file: q.file, dur: q.dur, at0: q.at0 }; })
          });
        }
      }
    }
    return out;
  }
  function audit() {
    var holes = 0, trimmed = 0, seen = {}, dup = 0, cursor = 0;
    items.forEach(function (it) {
      if (Math.abs(it.start - cursor) > 0.001) holes++;
      cursor = it.start + it.dur;
      if (it.kind === 'show') {
        if (it.dur + 0.001 < it.catalogDur) trimmed++;
        var k = it.showId + ':' + it.epIndex;
        if (seen[k]) dup++;
        seen[k] = 1;
      }
    });
    if (Math.abs(cursor - total) > 0.001) holes++;
    var cueOver = 0;
    items.forEach(function (it) {
      if (it.kind !== 'break') return;
      var cues = planCues(it, epoch + it.start * 1000);
      var end = 0;
      cues.forEach(function (c) { end = Math.max(end, c.at0 + c.dur); });
      if (end > it.dur + 0.001) cueOver++;
    });
    return {
      shows: seriesList.length,
      episodes: seriesList.reduce(function (a, s) { return a + s.episodes; }, 0),
      cycle: total,
      gap: GAP,
      holes: holes,
      trimmed: trimmed,
      duplicateEpisodes: dup,
      cueOverrun: cueOver,
      ids: seriesList.map(function (s) { return s.id; })
    };
  }

  var ready = Promise.all([
    fetch(ROOT + 'catalog.json').then(function (r) { if (!r.ok) throw new Error('catalog HTTP ' + r.status); return r.json(); }),
    fetch(ASSET + 'manifest.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : { files: [] }; }).catch(function () { return { files: [] }; }),
    fetch(ROOT + 'live/pack/manifest.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : { upNext: {} }; }).catch(function () { return { upNext: {} }; })
  ]).then(function (pair) {
    loadPack(pair[1]);
    loadShowUps(pair[2]);
    build(pair[0]);
    booted = true;
  }).catch(function (e) { fail = e; throw e; });

  var clipFails = 0, badClip = '', stallAt = 0;
  function targetFor(air) {
    if (!air) return { url: '', at: 0, token: 'none', loop: false };
    if (air.kind === 'show') return { url: air.url, at: air.offset, token: 'show', loop: false };
    if (air.kind === 'break' && badClip && air.cues && air.cues.length) {
      for (var i = 0; i < air.cues.length; i++) {
        var c = air.cues[i];
        if (badClip.indexOf(c.file) >= 0) continue;
        if (air.offset < c.at0 + c.dur) {
          return { url: c.url, at: Math.max(0, air.offset - c.at0), token: 'next@' + c.file, loop: false };
        }
      }
      if (air.nextUrl) return { url: air.nextUrl, at: 0, token: 'episode-after-break', loop: false };
    }
    if (air.cue && !(badClip && badClip.indexOf(air.cue.file) >= 0)) return { url: air.cue.url, at: air.cue.at, token: air.cue.file + '@' + air.cue.at0, loop: false };
    return { url: SILENCE, at: 0, token: 'hold', loop: true };
  }
  function bumpSuppress() {
    suppressPause++;
    setTimeout(function () { suppressPause = Math.max(0, suppressPause - 1); }, 400);
  }
  function onMeta() {
    if (!armed || !want || !audioEl || audioEl !== bound) return;
    var d = audioEl.duration, t = pendingAt || 0;
    if (isFinite(d) && d > 0.2 && t >= d - 0.05) { return; }
    try {
      var cap = (isFinite(d) && d > 0.2) ? Math.min(t, Math.max(0, d - 0.05)) : t;
      if (Math.abs((audioEl.currentTime || 0) - cap) > 0.3) audioEl.currentTime = cap;
    } catch (e) {}
    forceRate();
    var p = audioEl.play();
    if (p && p.catch) p.catch(function () {});
  }
  var pauseAt = 0;
  function onPause() {
    if (!armed || !audioEl) return;
    pauseAt = Date.now();
    if (suppressPause > 0) return;
    var el = audioEl;
    // ended often fires pause first. Do not treat that as the listener
    // stopping, or the episode after the announcer never starts.
    setTimeout(function () {
      if (!armed || audioEl !== el || suppressPause > 0) return;
      if (el.ended) { onEnded(); return; }
      if (el.paused) {
        want = false;
        paintTransport();
      }
    }, 40);
  }
  function onPlayEv() {
    if (!armed) return;
    var s = window.__otr && __otr.state;
    if (s && mode === 'main') { s.live = true; s.shifted = false; s.network = 'scifi'; s.pausedAt = 0; }
    forceRate();
    paintTransport();
  }
  function onAudioError() {
    if (!armed || !want || !audioEl) return;
    clipFails++;
    var failed = audioEl.currentSrc || audioEl.src || '';
    if (clipFails >= 2 && failed.indexOf('/scifi/assets/') >= 0) badClip = failed;
    loadedKey = '';
    setTimeout(function () { if (armed && want) follow(); }, 250);
  }
  function onEnded() {
    if (!armed || !want || !audioEl) return;
    if (audioEl.loop) return;
    clipFails = 0;
    loadedKey = '';
    follow();
  }
  function onRate() {
    if (armed && audioEl && audioEl.playbackRate !== 1) forceRate();
  }
  function forceRate() {
    if (!audioEl) return;
    if (audioEl.playbackRate !== 1) audioEl.playbackRate = 1;
    if (audioEl.defaultPlaybackRate !== 1) audioEl.defaultPlaybackRate = 1;
    var sel = document.getElementById('rateSel');
    if (mode === 'main' && armed && sel && sel.value !== '1') sel.value = '1';
  }
  function bindAudio(el) {
    if (bound === el) return;
    bound = el;
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('pause', onPause);
    el.addEventListener('play', onPlayEv);
    el.addEventListener('playing', onPlayEv);
    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onAudioError);
    el.addEventListener('ratechange', onRate);
    el.addEventListener('timeupdate', function () { if (armed) paintProgress(); });
  }
  function follow() {
    if (!armed || !want || !audioEl || !booted) return;
    if (pauseAt && audioEl.paused && !audioEl.ended && Date.now() - pauseAt < 80) return;
    forceRate();
    var air = onAir();
    var t = targetFor(air);
    var key = (air ? air.key : '') + '|' + t.token;
    var d = audioEl.duration;
    var srcNow = audioEl.currentSrc || audioEl.src || '';
    var onThis = t.url && (srcNow.indexOf(t.url) >= 0 || (t.url.indexOf('http') !== 0 && srcNow.indexOf(t.url.split('/').pop()) >= 0));
    var announcer = !!(t.url && t.url.indexOf('/scifi/assets/') >= 0);
    var hearingClip = srcNow.indexOf('/scifi/assets/') >= 0 && !audioEl.ended && !audioEl.paused
      && audioEl.currentTime > 0.2 && audioEl.currentTime + 0.25 < (isFinite(d) ? d : 1e9);
    // Finish the announcer file even if the schedule has already reached the
    // episode. Cutting it off is what left the station silent.
    if (air && air.kind === 'break' && hearingClip && (!onThis || (announcer && audioEl.currentTime + 0.4 < t.at))) return;
    var fileDone = isFinite(d) && d > 0.2 && (audioEl.ended || audioEl.currentTime >= d - 0.05);
    if (!t.loop && fileDone && t.at >= d - 0.2) {
      t = { url: SILENCE, at: 0, token: 'hold', loop: true };
      key = (air ? air.key : '') + '|hold';
    }
    if (loadedKey !== key || !(audioEl.currentSrc || audioEl.src)) {
      loadedKey = key;
      pendingAt = t.loop ? 0 : t.at;
      audioEl.loop = !!t.loop;
      var abs = '';
      try { abs = new URL(t.url, location.href).href; } catch (e) { abs = t.url; }
      if (audioEl.src !== abs && audioEl.currentSrc !== abs) {
        bumpSuppress();
        audioEl.src = t.url;
        try { audioEl.load(); } catch (e2) {}
        return;
      }
    }
    pendingAt = t.at;
    if (audioEl.readyState >= 1) {
      if (Math.abs((audioEl.currentTime || 0) - t.at) > 1.25) {
        try { audioEl.currentTime = t.at; } catch (e3) {}
      }
      if (audioEl.paused) {
        var p = audioEl.play();
        if (p && p.catch) p.catch(function () {});
      }
    }
  }

  function claim() {
    var s = window.__otr && __otr.state;
    if (!s) return;
    s.channel = null;
    s.stationShowIds = null;
    s.stationLabel = 'Sci-Fi (Live)';
    s.random = false;
    s.queue = [];
    s.qi = -1;
    s.network = 'scifi';
    s.live = true;
    s.shifted = false;
    try { localStorage.setItem('otr_last', 'net:scifi'); } catch (e) {}
  }
  var LOCKS = ['prevBtn', 'backBtn', 'fwdBtn', 'skipBtn', 'linkBtn', 'randomBtn', 'moreRandom', 'dockSkip'];
  function lock() {
    document.documentElement.setAttribute('data-scifi-live', '1');
    if (document.body) document.body.classList.add('otr-liveclock');
    LOCKS.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (!el.__sfSaved) el.__sfSaved = { title: el.getAttribute('title'), disabled: el.disabled };
      el.disabled = true;
      el.title = TIP;
      el.setAttribute('aria-disabled', 'true');
    });
    var rate = document.getElementById('rateSel');
    if (rate) {
      if (!rate.__sfSaved) rate.__sfSaved = { disabled: rate.disabled };
      rate.disabled = true;
      rate.title = TIP;
      var lab = rate.closest('label');
      if (lab) {
        if (lab.__sfTitle == null) lab.__sfTitle = lab.getAttribute('title');
        lab.title = TIP;
      }
    }
    var bar = document.getElementById('bar');
    if (bar) {
      if (bar.__sfTitle == null) bar.__sfTitle = bar.getAttribute('title');
      bar.title = TIP;
      bar.setAttribute('aria-disabled', 'true');
    }
    var vol = document.getElementById('vol');
    if (vol) vol.disabled = false;
    var sleep = document.getElementById('sleepSel');
    if (sleep) sleep.disabled = false;
  }
  function unlock() {
    document.documentElement.removeAttribute('data-scifi-live');
    if (document.body) document.body.classList.remove('otr-liveclock');
    document.querySelectorAll('.livetip.lock').forEach(function (n) {
      n.classList.remove('lock', 'showtip');
      n.removeAttribute('title');
    });
    LOCKS.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || !el.__sfSaved) return;
      el.disabled = el.__sfSaved.disabled;
      if (el.__sfSaved.title == null) el.removeAttribute('title');
      else el.title = el.__sfSaved.title;
      el.removeAttribute('aria-disabled');
      el.__sfSaved = null;
    });
    var rate = document.getElementById('rateSel');
    if (rate && rate.__sfSaved) {
      rate.disabled = rate.__sfSaved.disabled;
      rate.removeAttribute('title');
      var s = window.__otr && __otr.state;
      if (s && s.rate) rate.value = String(s.rate);
      rate.__sfSaved = null;
      var lab = rate.closest('label');
      if (lab) {
        if (lab.__sfTitle == null) lab.removeAttribute('title');
        else lab.title = lab.__sfTitle;
        lab.__sfTitle = null;
      }
    }
    var bar = document.getElementById('bar');
    if (bar) {
      if (bar.__sfTitle == null) bar.removeAttribute('title');
      else bar.title = bar.__sfTitle;
      bar.__sfTitle = null;
      bar.removeAttribute('aria-disabled');
    }
    var btn = document.getElementById('playBtn');
    if (btn && savedLabel) btn.innerHTML = savedLabel;
  }
  function paintTransport() {
    var label, aria;
    if (!want) { label = 'Listen'; aria = 'Listen live'; }
    else if (audioEl && audioEl.muted) { label = 'Unmute'; aria = 'Unmute'; }
    else { label = 'Mute'; aria = 'Mute'; }
    if (mode === 'page') {
      var b = document.getElementById('sfMute');
      if (b) { b.textContent = label; b.setAttribute('aria-label', aria); b.setAttribute('aria-pressed', want && audioEl && audioEl.muted ? 'true' : 'false'); }
      return;
    }
    var btn = document.getElementById('playBtn');
    var dock = document.getElementById('dockPlay');
    if (btn) {
      if (savedLabel == null) savedLabel = btn.innerHTML;
      btn.disabled = false;
      btn.innerHTML = label === 'Listen' ? '\u25B6 Listen' : label;
      btn.setAttribute('aria-label', aria);
      btn.title = aria;
    }
    if (dock) {
      dock.disabled = false;
      dock.textContent = label === 'Listen' ? '\u25B6' : (audioEl && audioEl.muted ? 'Unmute' : 'Mute');
      dock.setAttribute('aria-label', aria);
      dock.title = aria;
    }
  }
  function paintProgress() {
    var air = onAir();
    if (!air) return;
    var frac = air.dur > 0 ? Math.max(0, Math.min(1, air.offset / air.dur)) : 0;
    if (mode === 'page') {
      var fill = document.getElementById('sfFill');
      if (fill) fill.style.width = (frac * 100).toFixed(1) + '%';
      var left = document.getElementById('sfLeft');
      if (left) left.textContent = fmt(Math.max(0, air.dur - air.offset)) + (air.kind === 'break' ? ' until the next show' : ' left');
      return;
    }
    var f = document.getElementById('fill');
    if (f) f.style.width = (frac * 100).toFixed(1) + '%';
    var cur = document.getElementById('tCur'), dur = document.getElementById('tDur');
    if (cur) cur.textContent = fmt(air.offset);
    if (dur) dur.textContent = fmt(air.dur);
    var df = document.getElementById('dockFill');
    if (df) df.style.width = (frac * 100).toFixed(1) + '%';
  }
  function paintMain() {
    if (mode !== 'main' || !armed) return;
    var air = onAir();
    if (!air) return;
    var showEl = document.getElementById('npShow');
    var epEl = document.getElementById('npEp');
    var dateEl = document.getElementById('npDate');
    var up = document.getElementById('upnext');
    var on = document.getElementById('onairText');
    if (showEl) showEl.textContent = air.kind === 'break' ? 'Sci-Fi (Live)' : (air.show || 'Sci-Fi (Live)');
    if (epEl) epEl.textContent = air.kind === 'break'
      ? (air.cue && air.cue.text ? air.cue.text : 'Station break')
      : airTitle(air.title || '', air.date);
    if (dateEl) dateEl.textContent = air.kind === 'break' ? 'Eastern clock' : '';
    if (up) {
      up.innerHTML = air.nextShow
        ? '<b>up next</b> &nbsp;' + esc(air.nextShow) + (air.nextTitle ? ' - ' + esc(airTitle(air.nextTitle, air.nextDate)) : '')
        : '';
    }
    if (on) on.textContent = (want ? 'on air' : 'on the clock') + ' \u00b7 Sci-Fi (Live)';
    var sum = document.getElementById('npSummary'), more = document.getElementById('npMore'), arch = document.getElementById('npArchive');
    if (sum) sum.style.display = 'none';
    if (more) more.style.display = 'none';
    if (arch) arch.style.display = 'none';
    var idle = document.getElementById('vizIdle');
    if (idle) idle.style.display = 'none';
    paintProgress();
    paintTransport();
    document.querySelectorAll('#networkChips .station').forEach(function (c) {
      c.classList.toggle('on', c.dataset.net === 'scifi');
    });
    lastKind = air.kind || '';
    if (window.__otr && __otr.sleepMode && __otr.sleepMode() === 'end' && audioEl && want) {
      var base = parseFloat((document.getElementById('vol') || {}).value);
      if (isNaN(base)) base = 0.9;
      var leftEl = document.getElementById('sleepLeft');
      if (leftEl) leftEl.textContent = air.kind === 'break' ? 'stops after the next episode' : 'stops after this episode';
      if (air.kind === 'show' && air.dur - air.offset < 15)
        audioEl.volume = Math.max(0, base * (air.dur - air.offset) / 15);
    }
  }
  function paintCard() {
    var card = document.querySelector('#networkChips .station[data-net="scifi"]');
    if (!card || !booted) return;
    var air = onAir();
    if (!air) return;
    var show = air.kind === 'break' ? 'Station break' : (air.show || 'Sci-Fi (Live)');
    var title = air.kind === 'break' ? (air.nextShow || '') : airTitle(air.title || '', air.date);
    var now = card.querySelector('.st-now');
    var html = '<b>' + esc(show) + '</b>' + (title ? '<span class="sep"> \u00b7 </span>' + esc(title) : '');
    if (now && now._h !== html) { now.innerHTML = html; now._h = html; }
    var bar = card.querySelector('.st-bar i');
    if (bar) bar.style.width = (air.dur ? (100 * air.offset / air.dur).toFixed(1) : '0') + '%';
    var left = card.querySelector('.st-left .l');
    if (left) left.textContent = fmt(Math.max(0, air.dur - air.offset)) + ' left';
    var nx = card.querySelector('.st-next');
    var next = air.nextShow ? 'then <b>' + esc(air.nextShow) + '</b>' : '';
    if (nx && nx._h !== next) { nx.innerHTML = next; nx._h = next; }
    if (armed) card.classList.add('on');
  }
  function ensureCard() {
    var el = document.getElementById('networkChips');
    if (!el || el.querySelector('[data-net="scifi"]')) return;
    var lead = el.querySelector('[data-net="listenotr"]');
    if (!lead) return;
    var c = document.createElement('div');
    c.className = 'station network';
    c.dataset.net = 'scifi';
    c.title = 'Sci-Fi (Live). Everyone hears this same moment.';
    c.innerHTML = '<div class="st-head"><span class="st-name">Sci-Fi (Live)<span class="st-season">live</span></span>' +
      '<span class="st-actions"><span class="st-count"></span></span></div>' +
      '<div class="st-now"></div><div class="st-bar"><i></i></div><div class="st-left"><span class="l"></span></div><div class="st-next"></div>';
    c.querySelector('.st-count').textContent = seriesList.length + ' shows';
    c.addEventListener('click', function (ev) { ev.preventDefault(); tuneMain(); });
    if (lead.nextSibling) el.insertBefore(c, lead.nextSibling);
    else el.appendChild(c);
    paintCard();
  }
  function tuneMain() {
    var el = document.getElementById('audio');
    if (!el) return;
    mode = 'main';
    audioEl = el;
    if (window.__listenotr && __listenotr.pause) __listenotr.pause();
    armed = true;
    want = true;
    loadedKey = '';
    if (audioEl.muted) audioEl.muted = false;
    claim();
    lock();
    var cons = document.getElementById('console');
    if (cons) { cons.classList.remove('idle'); cons.classList.remove('cued'); }
    bindAudio(audioEl);
    forceRate();
    follow();
    paintMain();
    paintCard();
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('pause', function () {
          if (audioEl && want) { audioEl.muted = !audioEl.muted; paintTransport(); }
        });
        navigator.mediaSession.setActionHandler('play', function () {
          if (!want) { want = true; follow(); }
          else if (audioEl) { audioEl.muted = false; paintTransport(); }
        });
        ['seekbackward', 'seekforward', 'seekto', 'previoustrack', 'nexttrack'].forEach(function (n) {
          try { navigator.mediaSession.setActionHandler(n, null); } catch (e) {}
        });
      } catch (e2) {}
    }
  }
  function release() {
    if (mode !== 'main' || !armed) return;
    armed = false;
    want = false;
    loadedKey = '';
    unlock();
    var s = window.__otr && __otr.state;
    if (s && s.network === 'scifi') s.network = null;
    if (audioEl) {
      audioEl.loop = false;
      bumpSuppress();
      if (!audioEl.paused) { try { audioEl.pause(); } catch (e) {} }
    }
  }
  function onTransport() {
    if (!audioEl) return;
    if (!want) {
      want = true;
      loadedKey = '';
      if (mode === 'main') claim();
      follow();
      paintTransport();
      if (mode === 'main') paintMain();
      return;
    }
    audioEl.muted = !audioEl.muted;
    paintTransport();
  }

  function watchCards() {
    function arm() {
      var el = document.getElementById('networkChips');
      if (!el) return false;
      ensureCard();
      if (el.__sfWatch) return true;
      el.__sfWatch = 1;
      new MutationObserver(function () { ensureCard(); }).observe(el, { childList: true });
      return true;
    }
    if (arm()) return;
    var obs = new MutationObserver(function () { if (arm()) obs.disconnect(); });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }
  function installGuards() {
    document.addEventListener('click', function (e) {
      if (!armed || mode !== 'main') return;
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('#playBtn, #dockPlay')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        onTransport();
        return;
      }
      if (t.closest('#prevBtn,#backBtn,#fwdBtn,#skipBtn,#linkBtn,#randomBtn,#moreRandom,#dockSkip,#bar,#rateSel')) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);
    document.addEventListener('click', function (e) {
      if (!armed || mode !== 'main') return;
      var t = e.target;
      if (!t || !t.closest) return;
      var card = t.closest('#networkChips .station, #channelChips .station, #greatChips .chip, #savedRow .chip, #savedRow2 .chip');
      if (!card) return;
      if (card.dataset && card.dataset.net === 'scifi') return;
      release();
    }, true);
    document.addEventListener('keydown', function (e) {
      if (!armed || mode !== 'main') return;
      var tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === ' ' || e.key === 'Spacebar') {
        if (tag === 'SELECT') return;
        e.preventDefault();
        e.stopImmediatePropagation();
        onTransport();
        return;
      }
      if (e.key === 'n' || e.key === 'N' || e.key === 'p' || e.key === 'P' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);
    document.addEventListener('change', function (e) {
      if (!armed || mode !== 'main') return;
      if (e.target && e.target.id === 'rateSel') {
        e.target.value = '1';
        e.stopImmediatePropagation();
        forceRate();
      }
    }, true);
  }

  var PAGE_CSS = [
    '#otr-scifi{background:#080808;color:#e2e2e2;font-family:"SF Mono","Fira Code",Consolas,ui-monospace,monospace;}',
    '#otr-scifi *{box-sizing:border-box;}',
    '#otr-scifi .sf{max-width:min(720px,100%);margin:0 auto;padding:22px 18px 32px;}',
    '#otr-scifi h1{font-size:22px;font-weight:600;margin:0;color:#fff;letter-spacing:.4px;}',
    '#otr-scifi h1 span{color:#ffb347;}',
    '#otr-scifi .sf-tag{color:#7c7c7c;font-size:12px;margin-top:4px;}',
    '#otr-scifi .sf-k{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#7c7c7c;margin-top:18px;}',
    '#otr-scifi .sf-show{font-size:22px;color:#fff;font-weight:600;margin-top:4px;}',
    '#otr-scifi .sf-ep{color:#ffd08a;font-size:15px;margin-top:2px;}',
    '#otr-scifi .sf-bar{height:6px;border-radius:3px;background:#1c1c1c;margin-top:12px;pointer-events:none;}',
    '#otr-scifi .sf-bar i{display:block;height:100%;width:0;background:#ffb347;border-radius:3px;}',
    '#otr-scifi .sf-left{color:#a6a6a6;font-size:12px;margin-top:4px;}',
    '#otr-scifi .sf-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:16px;}',
    '#otr-scifi button,#otr-scifi select{font-family:inherit;font-size:13px;}',
    '#otr-scifi .sf-go{background:#ffb347;color:#1a1200;border:1px solid #ffb347;border-radius:8px;font-weight:600;min-height:44px;min-width:112px;padding:8px 16px;cursor:pointer;}',
    '#otr-scifi .sf-dead{background:#161616;color:#8a8a8a;border:1px solid #323232;border-radius:8px;min-height:44px;padding:8px 12px;opacity:.55;cursor:not-allowed;}',
    '#otr-scifi .sf-vol{display:flex;align-items:center;gap:8px;color:#a6a6a6;font-size:12px;flex:1;min-width:180px;}',
    '#otr-scifi .sf-vol input{flex:1;accent-color:#ffb347;min-height:44px;}',
    '#otr-scifi label.sf-sleep{display:flex;align-items:center;gap:8px;color:#a6a6a6;font-size:12px;}',
    '#otr-scifi select{background:#101010;color:#e2e2e2;border:1px solid #323232;border-radius:8px;min-height:44px;padding:6px 8px;}',
    '#otr-scifi .sf-note{color:#7c7c7c;font-size:12px;line-height:1.5;margin-top:16px;}',
    '#otr-scifi a{color:#00ff9d;}'
  ].join('');

  function mountPage() {
    var host = document.getElementById('otr-scifi');
    if (!host || host.__sfMounted) return;
    host.__sfMounted = true;
    mode = 'page';
    armed = true;
    want = false;
    if (!document.getElementById('sf-style')) {
      var st = document.createElement('style');
      st.id = 'sf-style';
      st.textContent = PAGE_CSS;
      document.head.appendChild(st);
    }
    host.innerHTML = [
      '<div class="sf">',
      '<h1>Sci-Fi <span>(Live)</span></h1>',
      '<div class="sf-tag">Science fiction from the catalog, live on the Eastern clock. The show is never cut off.</div>',
      '<div class="sf-k" id="sfKicker">Now playing</div>',
      '<div class="sf-show" id="sfShow">Tuning the lineup...</div>',
      '<div class="sf-ep" id="sfEp"></div>',
      '<div class="sf-bar" id="sfBar" title="' + TIP + '"><i id="sfFill"></i></div>',
      '<div class="sf-left" id="sfLeft"></div>',
      '<div class="sf-k">Up next</div><div class="sf-ep" id="sfNext"></div>',
      '<div class="sf-row">',
      '<button type="button" class="sf-go" id="sfMute">Listen</button>',
      '<label class="sf-vol">Volume <input id="sfVol" type="range" min="0" max="1" step="0.01" value="0.9" aria-label="Volume"></label>',
      '<label class="sf-sleep">Sleep <select id="sfSleep" aria-label="Sleep timer">',
      '<option value="off">off</option><option value="15">15 min</option><option value="30">30 min</option>',
      '<option value="60">60 min</option><option value="end">end of episode</option></select></label>',
      '</div>',
      '<div class="sf-row" aria-label="Live listen locks">',
      '<button type="button" class="sf-dead" id="sfPrev" disabled title="' + TIP + '">Prev</button>',
      '<button type="button" class="sf-dead" id="sfBack" disabled title="' + TIP + '">15 back</button>',
      '<button type="button" class="sf-dead" id="sfFwd" disabled title="' + TIP + '">15 forward</button>',
      '<button type="button" class="sf-dead" id="sfSkip" disabled title="' + TIP + '">Skip</button>',
      '<label class="sf-sleep">Speed <select id="sfRate" disabled title="' + TIP + '"><option>1x</option></select></label>',
      '<button type="button" class="sf-dead" id="sfSurprise" disabled title="' + TIP + '">Surprise me</button>',
      '<button type="button" class="sf-dead" id="sfCopy" disabled title="' + TIP + '">Copy this moment</button>',
      '</div>',
      '<p class="sf-note" id="sfStatus"></p>',
      '<p class="sf-note"><a href="' + ROOT + '">Full player</a> lists this station next to the networks. ',
      '<a href="' + ROOT + 'live/">Listenotr Radio</a> is the other live station.</p>',
      '<audio id="sfAudio" playsinline preload="none"></audio>',
      '</div>'
    ].join('');
    audioEl = document.getElementById('sfAudio');
    bindAudio(audioEl);
    var vol = 0.9;
    try {
      var v = parseFloat(localStorage.getItem('scifi_live_vol'));
      if (!isNaN(v)) vol = Math.max(0, Math.min(1, v));
    } catch (e) {}
    audioEl.volume = vol;
    document.getElementById('sfVol').value = String(vol);
    document.getElementById('sfVol').addEventListener('input', function () {
      audioEl.volume = +this.value;
      try { localStorage.setItem('scifi_live_vol', String(audioEl.volume)); } catch (e) {}
    });
    document.getElementById('sfMute').addEventListener('click', onTransport);
    var sleep = { mode: 'off', until: 0, timer: null };
    function sfBaseVol() {
      var el = document.getElementById('sfVol');
      var v = el ? parseFloat(el.value) : 0.9;
      return isNaN(v) ? 0.9 : v;
    }
    function sfRestoreVol() { if (audioEl) audioEl.volume = sfBaseVol(); }
    function sfStatus(text) {
      var st = document.getElementById('sfStatus');
      if (st) st.textContent = text || '';
    }
    function sfClearTimer() {
      if (sleep.timer) clearInterval(sleep.timer);
      sleep.timer = null;
      sleep.until = 0;
    }
    document.getElementById('sfSleep').addEventListener('change', function () {
      sfClearTimer();
      sfRestoreVol();
      sleep.mode = this.value;
      if (sleep.mode === 'off') { sfStatus(''); return; }
      if (sleep.mode === 'end') {
        var air = onAir();
        sfStatus(air && air.kind === 'break' ? 'Stops at the end of the next episode' : 'Stops at the end of this episode');
        return;
      }
      sleep.until = Date.now() + parseInt(sleep.mode, 10) * 60000;
      sleep.timer = setInterval(function () {
        if (sleep.mode === 'off' || sleep.mode === 'end') return;
        var left = (sleep.until - Date.now()) / 1000;
        if (left <= 0) {
          want = false;
          bumpSuppress();
          audioEl.loop = false;
          try { audioEl.pause(); } catch (e) {}
          sfRestoreVol();
          sfClearTimer();
          sleep.mode = 'off';
          var sel = document.getElementById('sfSleep');
          if (sel) sel.value = 'off';
          sfStatus('Sleep timer stopped. Listen rejoins the broadcast.');
          paintTransport();
          return;
        }
        sfStatus(fmt(left) + ' left on the sleep timer');
        if (left < 30 && want) audioEl.volume = Math.max(0, sfBaseVol() * (left / 30));
      }, 500);
    });
    window.__scifiSleep = sleep;
    paintPage();
  }
  function paintPage() {
    if (mode !== 'page') return;
    var air = onAir();
    if (!air) return;
    var show = document.getElementById('sfShow');
    var ep = document.getElementById('sfEp');
    var next = document.getElementById('sfNext');
    var kick = document.getElementById('sfKicker');
    if (kick) kick.textContent = air.kind === 'break' ? 'Station break' : 'Now playing';
    if (show) show.textContent = air.kind === 'break' ? 'Sci-Fi (Live)' : (air.show || '');
    if (ep) ep.textContent = air.kind === 'break' ? (air.cue && air.cue.text ? air.cue.text : 'Station break') : airTitle(air.title || '', air.date);
    if (next) next.textContent = air.nextShow ? (air.nextShow + (air.nextTitle ? ' - ' + airTitle(air.nextTitle, air.nextDate) : '')) : '';
    paintProgress();
    paintTransport();
    lastKind = air.kind || '';
    var sleep = window.__scifiSleep;
    if (sleep && sleep.mode === 'end' && want && audioEl) {
      var st = document.getElementById('sfStatus');
      if (st) st.textContent = air.kind === 'break' ? 'Stops at the end of the next episode' : 'Stops at the end of this episode';
      if (air.kind === 'show' && air.dur - air.offset < 15) {
        var volEl = document.getElementById('sfVol');
        var base = volEl ? parseFloat(volEl.value) : 0.9;
        if (isNaN(base)) base = 0.9;
        audioEl.volume = Math.max(0, base * ((air.dur - air.offset) / 15));
      }
    }
  }

  // End-of-episode sleep stops on the show -> break boundary, before follow()
  // loads the station break or the next episode. Live locks stay as they are.
  function episodeEndDue(air) {
    if (!air || !want || lastKind !== 'show' || air.kind !== 'break') return false;
    if (mode === 'page') {
      var sleep = window.__scifiSleep;
      return !!(sleep && sleep.mode === 'end');
    }
    return mode === 'main' && !!(window.__otr && __otr.sleepMode && __otr.sleepMode() === 'end');
  }
  function haltIfEpisodeEnded(air) {
    if (!episodeEndDue(air)) return false;
    want = false;
    bumpSuppress();
    if (audioEl) {
      audioEl.loop = false;
      try { audioEl.pause(); } catch (e) {}
    }
    if (mode === 'page') {
      var sleep = window.__scifiSleep;
      if (sleep) {
        if (sleep.timer) clearInterval(sleep.timer);
        sleep.timer = null;
        sleep.until = 0;
        sleep.mode = 'off';
      }
      if (audioEl) {
        var volEl = document.getElementById('sfVol');
        var base = volEl ? parseFloat(volEl.value) : 0.9;
        audioEl.volume = isNaN(base) ? 0.9 : base;
      }
      var sel = document.getElementById('sfSleep');
      if (sel) sel.value = 'off';
      var st = document.getElementById('sfStatus');
      if (st) st.textContent = 'Sleep timer stopped at the end of the episode. Listen rejoins the broadcast.';
    } else {
      if (audioEl) {
        var vol = parseFloat((document.getElementById('vol') || {}).value);
        audioEl.volume = isNaN(vol) ? 0.9 : vol;
      }
      var selm = document.getElementById('sleepSel');
      if (selm) {
        selm.value = 'off';
        try { selm.dispatchEvent(new Event('change')); } catch (e2) {}
      }
      var left = document.getElementById('sleepLeft');
      if (left) left.textContent = 'stopped at end of episode';
      var toast = document.getElementById('toast');
      if (toast) {
        toast.style.pointerEvents = 'none';
        toast.textContent = 'Sleep timer: stopped';
        toast.classList.add('show');
        clearTimeout(haltIfEpisodeEnded._t);
        haltIfEpisodeEnded._t = setTimeout(function () { toast.classList.remove('show'); }, 1900);
      }
    }
    paintTransport();
    return true;
  }

  function tick() {
    if (!booted) return;
    if (armed && want && audioEl && audioEl.paused && suppressPause === 0 && !(pauseAt && Date.now() - pauseAt < 80)) {
      if (!stallAt) stallAt = Date.now();
      else if (Date.now() - stallAt > 4000) {
        stallAt = Date.now();
        loadedKey = '';
        follow();
      }
    } else if (!audioEl || !audioEl.paused) stallAt = 0;
    if (mode === 'main' && armed) {
      var s = window.__otr && __otr.state;
      if (s && s.network && s.network !== 'scifi') { release(); }
      else {
        claim();
        lock();
        if (!haltIfEpisodeEnded(onAir())) follow();
        paintMain();
      }
    } else if (mode === 'page') {
      if (!haltIfEpisodeEnded(onAir())) follow();
      paintPage();
    }
    paintCard();
  }
  function start() {
    ready.then(function () {
      if (document.getElementById('otr-scifi')) mountPage();
      if (document.getElementById('networkChips') || document.getElementById('console')) {
        watchCards();
        installGuards();
        if (!document.getElementById('sf-lock-style')) {
          var st = document.createElement('style');
          st.id = 'sf-lock-style';
          st.textContent = 'html[data-scifi-live="1"] #bar{pointer-events:none;opacity:.45;cursor:default;}';
          document.head.appendChild(st);
        }
      }
      if (!timer) timer = setInterval(tick, 250);
      tick();
    }).catch(function (e) {
      fail = fail || e;
      var show = document.getElementById('sfShow');
      if (show) show.textContent = "The lineup didn't load";
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.__scifi = {
    booted: function () { return booted; },
    failed: function () { return fail ? String(fail.message || fail) : ''; },
    series: function () { return seriesList.map(function (s) { return { id: s.id, name: s.name, episodes: s.episodes }; }); },
    onAir: function (ms) { return onAir(ms); },
    showsIn: function (ms, seconds) { return overlaps(ms, seconds, 'show'); },
    breaksIn: function (ms, seconds) { return overlaps(ms, seconds, 'break'); },
    audit: audit,
    wall: function (ms) { return wallClock(ms == null ? nowMs() : ms); },
    unixFor: unixFor,
    setClock: function (ms) { clockMs = ms; if (booted) tick(); },
    clearClock: function () { clockMs = null; if (booted) tick(); },
    armed: function () { return armed && mode === 'main'; },
    want: function () { return want; },
    gap: function () { return GAP; },
    tip: function () { return TIP; }
  };
})();
