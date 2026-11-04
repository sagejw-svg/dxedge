/* Listenotr Radio — a schedule-synced virtual live station.
 *
 * One broadcast, heard together. schedule.json is a day of themed blocks on
 * the Eastern clock (8:00 mystery, 8:30 comedy, 9:00 western, and the hours
 * around them). The blocks repeat every civil day; which episode plays is a
 * pure function of that Eastern date and the catalog, so it changes daily and
 * never depends on who is listening. Each client turns the wall clock into
 * "which item, how many seconds in" and seeks there. Pause and volume are
 * local. There is no skip and no seek. Play again rejoins live.
 *
 * This is the stand-in for a real encoder, so a test night can go out before
 * Icecast exists. To move over later:
 *   1. Run Liquidsoap against this same schedule.json: same Eastern blocks,
 *      the same episode pick (the hash in buildDay), and these break clips.
 *   2. Have it write one MP3 or AAC mount on Icecast.
 *   3. Point the audio element at that mount and delete the seek-to-offset
 *      path. Keep this file's clock for Now / Up next / Tonight, or let
 *      Liquidsoap publish those same fields as stream metadata.
 * Listeners then share the encoder's clock. A join is just "play", and a
 * stalled browser can no longer drift off the rest of the audience.
 *
 * Mount: <div id="otr-live"></div> plus this script. The node can already be
 * in the page, or a host (the Basic-mode player) can add it later; either
 * way the station fills #otr-live and nothing else. The standalone page is
 * /otr/live/.
 */
(function(){
  'use strict';
  if (window.__listenotrLive) return;
  window.__listenotrLive = 1;

  // This file lives at <root>/live/listenotr-radio.js. The catalog is next to
  // live/, whether the site is mounted at /otr/ or a test serves that folder
  // as the whole origin.
  var ASSET = (function () {
    var src = (document.currentScript && document.currentScript.src) || '';
    var at = src.indexOf('live/listenotr-radio.js');
    if (at >= 0) return src.slice(0, at);
    return '/otr/';
  })();
  function asset(rel) { return ASSET + rel; }
  function assetPack(rel) {
    if (!rel) return '';
    if (/^(https?:|\/)/.test(rel)) return rel;
    return asset('live/pack/' + rel);
  }

  var TZ = 'America/New_York';
  var DAY = 86400;
  var BLOCKS = [], byId = {}, byTheme = {}, SCHED = null, CAT = null;
  var BREAK_MIN = 18, IDENT = '', UPNEXT = {}, PACK = null;
  var booted = false, fail = null, clockMs = null, timer = null, obs = null;
  var state = {
    started: false, userPaused: true, loadedKey: null, hold: false,
    err: false, want: 0, lineupKey: '', mediaKey: '',
    intros: {}, introDur: {}, asked: {}, hbAt: 0
  };
  var audio = null;
  var wallFmt = null;
  function setZone(tz){
    TZ = tz || 'America/New_York';
    wallFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }
  setZone(TZ);

  function $(id){ return document.getElementById(id); }
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function nowMs(){ return clockMs == null ? Date.now() : clockMs; }
  function hashStr(str){
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }
  function mulberry32(a){
    return function(){
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hhmm(s){
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(s || ''));
    return m ? (+m[1]) * 3600 + (+m[2]) * 60 : 0;
  }
  function clock12(min){
    min = ((Math.floor(min) % 1440) + 1440) % 1440;
    var h = Math.floor(min / 60), m = min % 60, ap = h < 12 ? 'AM' : 'PM';
    h = h % 12; if (h === 0) h = 12;
    return h + ':' + pad(m) + ' ' + ap;
  }
  function clock12s(sod){
    var sec = Math.floor(sod);
    var h = Math.floor(sec / 3600) % 24, m = Math.floor(sec / 60) % 60, s = sec % 60;
    var ap = h < 12 ? 'AM' : 'PM', hh = h % 12; if (hh === 0) hh = 12;
    return hh + ':' + pad(m) + ':' + pad(s) + ' ' + ap;
  }
  function fmt(sec){
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60), r = sec % 60;
    return m + ':' + pad(r);
  }
  function addDays(dateKey, n){
    var y = +dateKey.slice(0, 4), m = +dateKey.slice(5, 7), d = +dateKey.slice(8, 10);
    var dt = new Date(Date.UTC(y, m - 1, d + n));
    return dt.getUTCFullYear() + '-' + pad(dt.getUTCMonth() + 1) + '-' + pad(dt.getUTCDate());
  }
  function longDate(dateKey){
    var y = +dateKey.slice(0, 4), m = +dateKey.slice(5, 7), d = +dateKey.slice(8, 10);
    return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC'
    });
  }
  var MONS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function niceTitle(t){
    if (!t) return '';
    var x = String(t).trim(), m;
    if ((m = /^(\d{2})(\d{2})(\d{2})$/.exec(x)) && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31)
      return (+m[3]) + ' ' + MONS[+m[2] - 1] + ' 19' + m[1];
    if ((m = /^(19\d{2})-?(\d{2})-?(\d{2})$/.exec(x)) && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31)
      return (+m[3]) + ' ' + MONS[+m[2] - 1] + ' ' + m[1];
    var y = x.replace(/^[A-Za-z]{2,5}\s+\d{4}-\d{2}-\d{2,5}\s+/, '')
      .replace(/^[-–:\s]+/, '').replace(/[\s\-–]+$/, '')
      .replace(/\s*\(?\bpartial\b\)?$/i, '')
      .replace(/\s+aka\s+.+$/i, '');
    if (!y) y = x;
    if (y === y.toUpperCase() && /[A-Z]/.test(y) && y.length > 3)
      y = y.toLowerCase().replace(/\b[a-z]/g, function(c){ return c.toUpperCase(); });
    return y;
  }

  function wallClock(unixMs){
    var d = new Date(unixMs), g = {};
    wallFmt.formatToParts(d).forEach(function(p){ if (p.type !== 'literal') g[p.type] = p.value; });
    var hour = +g.hour;
    if (hour === 24) hour = 0;
    return {
      dateKey: g.year + '-' + g.month + '-' + g.day,
      hour: hour, minute: +g.minute, second: +g.second,
      sod: hour * 3600 + (+g.minute) * 60 + (+g.second) + d.getMilliseconds() / 1000
    };
  }
  // Inverse of wallClock: an Eastern civil date and seconds-since-midnight, as a unix ms.
  function unixFor(dateKey, sod){
    var y = +dateKey.slice(0, 4), mo = +dateKey.slice(5, 7), da = +dateKey.slice(8, 10);
    var sec = Math.floor(sod), ms = Math.round((sod - sec) * 1000);
    if (ms === 1000) { sec += 1; ms = 0; }
    var h = Math.floor(sec / 3600), mi = Math.floor(sec / 60) % 60, s = sec % 60;
    var guess = Date.UTC(y, mo - 1, da, h, mi, s, ms);
    for (var i = 0; i < 6; i++) {
      var w = wallClock(guess);
      var want = Date.UTC(y, mo - 1, da, h, mi, s, ms);
      var got = Date.UTC(+w.dateKey.slice(0, 4), +w.dateKey.slice(5, 7) - 1, +w.dateKey.slice(8, 10), w.hour, w.minute, w.second, Math.round((w.sod % 1) * 1000));
      if (want === got) return guess;
      guess += want - got;
    }
    return guess;
  }

  function expand(spans){
    var blocks = [];
    (spans || []).forEach(function(sp){
      var step = Math.round((+sp.minutes || 30) * 60);
      if (sp.at != null) {
        var start = hhmm(sp.at);
        blocks.push(makeBlock(sp, start, step));
      } else {
        var a = hhmm(sp.from), b = hhmm(sp.to);
        for (var t = a; t < b; t += step) blocks.push(makeBlock(sp, t, Math.min(step, b - t)));
      }
    });
    blocks.sort(function(a, b){ return a.start - b.start; });
    var cursor = 0;
    for (var i = 0; i < blocks.length; i++) {
      if (blocks[i].start !== cursor) throw new Error('Listenotr schedule has a gap at ' + cursor);
      cursor = blocks[i].end;
    }
    if (cursor !== DAY) throw new Error('Listenotr schedule covers ' + cursor + ' seconds, not a day');
    return blocks;
  }
  function makeBlock(sp, start, seconds){
    return {
      id: (sp.night ? 'night-' : 'day-') + start,
      start: start, seconds: seconds, end: start + seconds,
      theme: sp.theme, label: sp.label || sp.theme, show: sp.show || null, night: !!sp.night
    };
  }

  function epUrl(show, ep){ return CAT.prefix + show.ids[ep[3]] + '/' + ep[4]; }
  function choose(list, rnd){
    if (!list.length) return null;
    return list[Math.floor(rnd() * list.length)];
  }
  function pickFromShow(show, rnd, maxDur, used){
    var all = [];
    for (var i = 0; i < show.eps.length; i++) {
      if (used[show.id + ':' + i]) continue;
      var dur = show.eps[i][2] > 0 ? show.eps[i][2] : 1800;
      all.push({ i: i, dur: dur, ep: show.eps[i] });
    }
    if (!all.length) return null;
    var under = all.filter(function(e){ return e.dur <= maxDur && e.dur >= 8 * 60; });
    var tight = under.filter(function(e){ return e.dur >= maxDur - 240; });
    var choice = choose(tight, rnd) || choose(under, rnd);
    var trimmed = false;
    if (!choice) {
      var over = all.filter(function(e){ return e.dur > maxDur; }).sort(function(a, b){ return a.dur - b.dur; });
      choice = over[0] || null;
      trimmed = !!choice;
      if (!choice) {
        var scraps = all.filter(function(e){ return e.dur <= maxDur && e.dur >= 60; }).sort(function(a, b){ return b.dur - a.dur; });
        choice = scraps[0] || null;
      }
    }
    if (!choice) return null;
    return {
      showId: show.id, showName: show.name, epIndex: choice.i,
      title: choice.ep[0], date: choice.ep[1] || '', file: choice.ep[4] || '',
      catalogDur: choice.dur, url: epUrl(show, choice.ep), trimmed: trimmed
    };
  }
  function pickEpisode(block, dateKey, nth, maxDur, used, avoid, ignoreUsed){
    var shows = (block.show && byId[block.show]) ? [byId[block.show]] : (byTheme[block.theme] || []).slice();
    shows = shows.filter(function(s){ return s && s.eps && s.eps.length; });
    if (!shows.length) return null;
    var rnd = mulberry32(hashStr('listenotr|' + dateKey + '|' + block.id + '|' + nth + (ignoreUsed ? '|reuse' : '')));
    var order = shows.slice();
    for (var k = order.length - 1; k > 0; k--) {
      var j = Math.floor(rnd() * (k + 1));
      var tmp = order[k]; order[k] = order[j]; order[j] = tmp;
    }
    if (avoid && order.length > 1) order.sort(function(a, b){ return (a.id === avoid) - (b.id === avoid); });
    var bag = ignoreUsed ? {} : used;
    for (var i = 0; i < order.length; i++) {
      var ep = pickFromShow(order[i], rnd, maxDur, bag);
      if (ep) return ep;
    }
    return null;
  }

  function baseFields(block, start, dur, kind){
    return {
      kind: kind, start: start, dur: dur,
      blockId: block.id, blockStart: block.start, blockEnd: block.end,
      label: block.label, theme: block.theme, night: block.night
    };
  }
  function makeShow(block, start, playDur, pick){
    var it = baseFields(block, start, playDur, 'show');
    it.showId = pick.showId; it.showName = pick.showName; it.epIndex = pick.epIndex;
    it.title = pick.title; it.date = pick.date; it.url = pick.url; it.file = pick.file;
    it.epId = pick.showId + '.' + (hashStr(String(pick.file || pick.epIndex)) >>> 0).toString(16);
    it.trimmed = playDur < pick.catalogDur;
    return it;
  }
  function makeBreak(block, start, dur){
    return baseFields(block, start, dur, 'break');
  }
  function fillBlock(block, dateKey, used){
    var items = [], t = block.start, nth = 0, avoid = null, guard = 0;
    while (t < block.end && guard++ < 8) {
      var remain = block.end - t;
      if (remain < BREAK_MIN + 60) { items.push(makeBreak(block, t, remain)); break; }
      var maxDur = remain - BREAK_MIN;
      var pick = pickEpisode(block, dateKey, nth, maxDur, used, avoid, false);
      if (!pick && block.show) pick = pickEpisode(block, dateKey, nth, maxDur, used, avoid, true);
      nth++;
      if (!pick) { items.push(makeBreak(block, t, remain)); break; }
      var playDur = Math.min(pick.catalogDur, maxDur);
      if (playDur < 60) { items.push(makeBreak(block, t, remain)); break; }
      items.push(makeShow(block, t, playDur, pick));
      used[pick.showId + ':' + pick.epIndex] = 1;
      avoid = pick.showId;
      t += playDur;
      remain = block.end - t;
      var bdur = remain >= BREAK_MIN + 8 * 60 ? BREAK_MIN : remain;
      if (bdur < 1) break;
      items.push(makeBreak(block, t, bdur));
      t += bdur;
    }
    var covered = items.length ? items[items.length - 1].start + items[items.length - 1].dur : block.start;
    if (covered < block.end) {
      var last = items[items.length - 1];
      if (last && last.kind === 'break') last.dur += block.end - covered;
      else items.push(makeBreak(block, covered, block.end - covered));
    }
    return items;
  }
  function buildItems(dateKey){
    var used = {}, items = [];
    BLOCKS.forEach(function(b){ items = items.concat(fillBlock(b, dateKey, used)); });
    return items;
  }
  var linked = {};
  function assemble(dateKey){
    if (linked[dateKey]) return linked[dateKey];
    var items = buildItems(dateKey);
    var tomorrow = buildItems(addDays(dateKey, 1));
    var first = null;
    for (var i = 0; i < tomorrow.length; i++) if (tomorrow[i].kind === 'show') { first = tomorrow[i]; break; }
    var following = first;
    for (var k = items.length - 1; k >= 0; k--) {
      var it = items[k];
      var isTom = following === first && !!first;
      it.nextShowId = following ? following.showId : null;
      it.nextShow = following ? following.showName : null;
      it.nextTitle = following ? following.title : null;
      it.nextStart = following ? following.start : 0;
      it.nextEp = following && following.epId || null;
      it.nextIsTomorrow = isTom;
      if (it.kind === 'break') {
        var cues = cuesFor(it);
        it.cues = cues;
        var spoken = null;
        for (var c = cues.length - 1; c >= 0; c--) {
          if (/\/up-next\/|\/idents\//.test(cues[c].url)) { spoken = cues[c]; break; }
        }
        it.audio = (spoken || cues[cues.length - 1] || {}).url || IDENT || '';
        it.line = following
          ? "You're listening to Listenotr Radio. Up next, " + following.showName + '.'
          : "You're listening to Listenotr Radio.";
      }
      if (it.kind === 'show') following = it;
    }
    // A break at the end of the day points at tomorrow only when `following`
    // was still `first` as we walked onto it. Shows earlier in the day take
    // over `following`, so their breaks name the next show tonight.
    linked[dateKey] = { dateKey: dateKey, items: items };
    return linked[dateKey];
  }

  function plain(it, extra){
    var o = {
      kind: it.kind, start: it.start, dur: it.dur,
      blockId: it.blockId, blockStart: it.blockStart, blockEnd: it.blockEnd,
      label: it.label, theme: it.theme, night: !!it.night,
      showId: it.showId || null, epIndex: it.epIndex == null ? null : it.epIndex,
      show: it.showName || null, title: it.title || null, date: it.date || null,
      trimmed: !!it.trimmed, audio: it.audio || null, url: it.url || null,
      line: it.line || null, nextShowId: it.nextShowId || null, nextShow: it.nextShow || null,
      nextTitle: it.nextTitle || null, nextStart: it.nextStart == null ? null : it.nextStart,
      nextEp: it.nextEp || null, epId: it.epId || null,
      cues: it.cues ? it.cues.map(function (c) { return { url: c.url, dur: c.dur }; }) : null,
      nextIsTomorrow: !!it.nextIsTomorrow
    };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }
  function onAir(ms){
    var stamp = ms == null ? nowMs() : ms;
    var w = wallClock(stamp);
    var items = assemble(w.dateKey).items;
    var sec = Math.floor(w.sod);
    if (sec >= DAY) sec = DAY - 1;
    if (sec < 0) sec = 0;
    var lo = 0, hi = items.length - 1;
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1;
      if (items[mid].start <= sec) lo = mid; else hi = mid - 1;
    }
    var it = items[lo];
    var offset = w.sod - it.start;
    if (offset < 0) offset = 0;
    if (offset > it.dur) offset = it.dur;
    return plain(it, {
      offset: offset, dateKey: w.dateKey, sod: w.sod,
      key: it.kind + '|' + w.dateKey + '|' + it.start + '|' + (it.showId || '') + '|' + (it.epIndex == null ? '' : it.epIndex)
    });
  }
  function lineupRows(dateKey){
    var items = assemble(dateKey).items, map = {}, rows = [];
    items.forEach(function(it){
      if (it.kind !== 'show') return;
      var row = map[it.blockId];
      if (!row) {
        row = {
          id: it.blockId, start: it.blockStart, end: it.blockEnd,
          time: clock12(it.blockStart / 60), label: it.label, theme: it.theme,
          night: !!it.night, shows: []
        };
        map[it.blockId] = row;
        rows.push(row);
      }
      row.shows.push({ showId: it.showId, show: it.showName, title: it.title, epIndex: it.epIndex });
    });
    return rows;
  }

  function packClip(entry) {
    if (!entry) return null;
    if (typeof entry === 'string') return { url: assetPack(entry), dur: 6 };
    if (!entry.file) return null;
    return { url: assetPack(entry.file), dur: +entry.dur || 6 };
  }
  function upNextClip(showId) {
    if (PACK && PACK.upNext && PACK.upNext[showId]) return packClip(PACK.upNext[showId]);
    if (UPNEXT[showId]) return { url: UPNEXT[showId], dur: 6 };
    return null;
  }
  function identClip(salt) {
    var list = (PACK && PACK.idents && PACK.idents.length) ? PACK.idents : (PACK && PACK.ident ? [PACK.ident] : []);
    if (!list.length) return IDENT ? { url: IDENT, dur: 4 } : null;
    var i = salt ? (hashStr(String(salt)) % list.length) : 0;
    return packClip(list[i]);
  }
  // Top of the hour: the big-band sting, then "Listenotr Radio!", then the
  // time-of-night line, then "up next". Drop from the front if the break is
  // too short to hold them; the up-next line always stays.
  function cuesFor(br) {
    var up = upNextClip(br.nextShowId) || identClip(br.start);
    if (!up) return [];
    var seq = [up];
    if (PACK && PACK.daypart && !br.nextIsTomorrow && PACK.daypart[String(br.nextStart)])
      seq.unshift(packClip(PACK.daypart[String(br.nextStart)]));
    var onHour = br.nextIsTomorrow || (br.nextStart != null && br.nextStart % 3600 === 0);
    if (onHour && PACK && PACK.jingleVoice) seq.unshift(packClip(PACK.jingleVoice));
    if (onHour && PACK && PACK.jingle) seq.unshift(packClip(PACK.jingle));
    function total(arr) { var s = 0; for (var i = 0; i < arr.length; i++) s += arr[i].dur || 0; return s; }
    while (seq.length > 1 && total(seq) > br.dur) seq.shift();
    return seq;
  }
  function init(catalog, schedule, pack){
    CAT = catalog;
    SCHED = schedule;
    PACK = pack || null;
    setZone(schedule.tz || TZ);
    catalog.shows.forEach(function(s){
      if (!s || !s.eps || !s.eps.length || s.adv || s.id === 'commercials') return;
      byId[s.id] = s;
      (s.ch || []).forEach(function(ch){
        if (!byTheme[ch]) byTheme[ch] = [];
        byTheme[ch].push(s);
      });
    });
    BREAK_MIN = +schedule.breakMin || 18;
    UPNEXT = schedule.upNext || {};
    IDENT = (PACK && PACK.ident) ? assetPack(PACK.ident.file || PACK.ident) : (schedule.ident || '');
    BLOCKS = expand(schedule.spans || []);
  }

  var ready = Promise.all([
    fetch(asset('catalog.json')).then(function(r){ if (!r.ok) throw new Error('catalog HTTP ' + r.status); return r.json(); }),
    fetch(asset('live/schedule.json'), { cache: 'no-cache' }).then(function(r){ if (!r.ok) throw new Error('schedule HTTP ' + r.status); return r.json(); }),
    fetch(asset('live/pack/manifest.json'), { cache: 'no-cache' }).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; })
  ]).then(function(pair){ init(pair[0], pair[1], pair[2]); }).catch(function(e){ fail = e; throw e; });

  function absUrl(url){ return new URL(url, location.origin).href; }
  function hold(){ state.hold = true; try { audio.pause(); } catch (e) {} }
  function applySeek(){
    var off = state.want || 0, d = audio.duration;
    if (isFinite(d) && d > 0.2 && off >= d - 0.08) { hold(); return; }
    var t = off;
    if (isFinite(d) && d > 0.2) t = Math.min(off, Math.max(0, d - 0.05));
    try { if (Math.abs((audio.currentTime || 0) - t) > 0.25) audio.currentTime = t; } catch (e) {}
  }
  function cueList(a) {
    var cues = (a.cues || []).map(function (c) { return { url: c.url, dur: c.dur || 6 }; });
    if (a.nextEp && state.intros[a.nextEp]) {
      var intro = { url: state.intros[a.nextEp], dur: state.introDur[a.nextEp] || 12 };
      if (cues.length) cues[cues.length - 1] = intro;
      else cues = [intro];
    }
    return cues;
  }
  // A break is several short clips back to back. The offset picks which one,
  // and how far into that file. Past the last clip, the break is silence.
  function seekTarget(a) {
    if (!a || a.kind !== 'break') return { url: a && a.url || '', at: a ? a.offset : 0, token: 'show' };
    var cues = cueList(a), t = 0;
    for (var i = 0; i < cues.length; i++) {
      if (a.offset < t + cues[i].dur) return { url: cues[i].url, at: Math.max(0, a.offset - t), token: cues[i].url };
      t += cues[i].dur;
    }
    return { url: '', at: 0, token: 'hold' };
  }
  function onMeta(){
    if (state.userPaused) return;
    var t = seekTarget(onAir());
    state.want = t.at;
    if (!t.url) { hold(); return; }
    applySeek();
    if (!state.hold) {
      var p = audio.play();
      if (p && p.catch) p.catch(onPlayFail);
    }
    state.err = false;
  }
  function onPlayFail(e){
    if (e && e.name === 'NotAllowedError') { state.userPaused = true; render(); }
  }
  function onErr(){
    if (!audio || !audio.src || state.userPaused) return;
    state.err = true;
    render();
    setTimeout(function(){
      if (state.userPaused) return;
      state.loadedKey = null;
      follow();
    }, 4000);
  }
  function load(a){
    var t = seekTarget(a);
    state.loadedKey = a.key + '|' + t.token;
    state.hold = false;
    state.err = false;
    state.want = t.at;
    var url = t.url;
    if (!url) { hold(); return; }
    var abs = absUrl(url);
    if ((audio.currentSrc === abs || audio.src === abs) && audio.readyState >= 1) {
      applySeek();
      if (!state.hold && !state.userPaused) {
        var p = audio.play();
        if (p && p.catch) p.catch(onPlayFail);
      }
      return;
    }
    audio.src = url;
    try { audio.load(); } catch (e) {}
  }
  function follow(){
    if (!booted || !audio || !state.started || state.userPaused) return;
    var a = onAir();
    var t = seekTarget(a);
    var token = a.key + '|' + t.token;
    if (state.loadedKey !== token) { load(a); setMedia(a); return; }
    if (state.hold || !t.url) return;
    var d = audio.duration;
    if (isFinite(d) && d > 0.2 && t.at >= d - 0.08) { hold(); return; }
    if (Math.abs((audio.currentTime || 0) - t.at) > 2) {
      state.want = t.at;
      applySeek();
    }
  }
  function setMedia(a){
    if (!('mediaSession' in navigator) || !window.MediaMetadata) return;
    try {
      if (state.mediaKey === a.key) return;
      state.mediaKey = a.key;
      var title = a.kind === 'break' ? 'Station break' : (niceTitle(a.title) || a.show || 'Listenotr Radio');
      var artist = a.kind === 'break' ? 'Listenotr Radio' : (a.show || 'Listenotr Radio');
      navigator.mediaSession.metadata = new MediaMetadata({ title: title, artist: artist, album: 'Listenotr Radio' });
      navigator.mediaSession.setActionHandler('play', function(){ userPlay(); });
      navigator.mediaSession.setActionHandler('pause', function(){ userPause(); });
      ['seekbackward', 'seekforward', 'seekto', 'previoustrack', 'nexttrack'].forEach(function(name){
        try { navigator.mediaSession.setActionHandler(name, null); } catch (e) {}
      });
    } catch (e) {}
  }
  function userPlay(){
    if (!booted || !audio) return;
    state.started = true;
    state.userPaused = false;
    state.loadedKey = null;
    state.hold = false;
    follow();
    render();
  }
  function userPause(){
    state.userPaused = true;
    state.hold = false;
    try { if (audio) audio.pause(); } catch (e) {}
    render();
  }
  function setVol(v){
    v = Math.max(0, Math.min(1, +v || 0));
    if (audio) audio.volume = v;
    var slider = $('lrVol');
    if (slider && document.activeElement !== slider) slider.value = String(v);
    try { localStorage.setItem('listenotr_radio_vol', String(v)); } catch (e) {}
  }
  function shareUrl(){ return location.origin + '/otr/live'; }
  function flash(msg){
    var el = $('lrCopied');
    if (!el) return;
    el.hidden = false;
    el.textContent = msg;
    clearTimeout(flash._t);
    flash._t = setTimeout(function(){ el.hidden = true; }, 1800);
  }
  function copyLink(){
    var url = shareUrl();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function(){ flash('Link copied'); }, function(){ fallbackCopy(url); });
    } else fallbackCopy(url);
  }
  function fallbackCopy(url){
    var input = $('lrLink');
    if (!input) return;
    input.value = url;
    input.focus();
    input.select();
    try { document.execCommand('copy'); flash('Link copied'); } catch (e) { flash('Select the link and copy it'); }
  }
  function onShare(){
    var url = shareUrl(), a = booted ? onAir() : null;
    var text = !a ? "You're listening to Listenotr Radio."
      : (a.kind === 'break' ? (a.line || "You're listening to Listenotr Radio.")
        : ('On Listenotr Radio right now: ' + (a.show || 'a show') + (a.title ? ' — ' + niceTitle(a.title) : '') + '.'));
    if (navigator.share) {
      navigator.share({ title: 'Listenotr Radio', text: text, url: url }).catch(function(e){
        if (e && e.name === 'AbortError') return;
        copyLink();
      });
      return;
    }
    copyLink();
  }

  function text(id, value){ var el = $(id); if (el && el.textContent !== value) el.textContent = value; }
  function rowEl(row){
    var li = document.createElement('li');
    li.dataset.start = String(row.start);
    li.dataset.end = String(row.end);
    var when = document.createElement('span');
    when.className = 'lr-when';
    when.textContent = row.time;
    var what = document.createElement('span');
    what.className = 'lr-what';
    var b = document.createElement('b');
    b.textContent = row.label;
    what.appendChild(b);
    what.appendChild(document.createTextNode('  ' + row.shows.map(function(s){ return s.show; }).join(', then ')));
    if (row.shows.length === 1 && row.shows[0].title) {
      var ep = document.createElement('span');
      ep.className = 'lr-epn';
      ep.textContent = niceTitle(row.shows[0].title);
      what.appendChild(ep);
    }
    li.appendChild(when);
    li.appendChild(what);
    return li;
  }
  function paintLineup(dateKey){
    var rows = lineupRows(dateKey);
    text('lrNightDate', longDate(dateKey));
    var night = $('lrLineup'), rest = $('lrRestList');
    if (!night || !rest) return;
    night.innerHTML = '';
    rest.innerHTML = '';
    rows.forEach(function(r){ (r.night ? night : rest).appendChild(rowEl(r)); });
  }
  function markNow(list, sod){
    if (!list) return;
    for (var i = 0; i < list.children.length; i++) {
      var n = list.children[i], s = +n.dataset.start, e = +n.dataset.end;
      n.classList.toggle('now', sod >= s && sod < e);
    }
  }
  function setPlayLabel(){
    var b = $('lrPlay');
    if (!b) return;
    var on = state.started && !state.userPaused;
    var label = on ? 'Pause' : 'Listen';
    if (b.textContent !== label) b.textContent = label;
    b.setAttribute('aria-label', on ? 'Pause' : 'Listen live');
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    var air = $('lrAir');
    if (air) air.classList.toggle('live', on);
    var lamp = $('lrLamp');
    if (lamp) lamp.classList.toggle('on', on);
  }
  function render(){
    if (!$('lrShow')) return;
    if (fail) {
      text('lrShow', "The lineup didn't load");
      text('lrEp', String(fail.message || fail));
      return;
    }
    if (!booted) return;
    var a = onAir(), w = wallClock(nowMs());
    text('lrClock', clock12s(w.sod) + ' ET');
    text('lrKicker', a.kind === 'break' ? 'Station break' : 'Now playing');
    text('lrShow', a.kind === 'break' ? 'Listenotr Radio' : (a.show || ''));
    text('lrEp', a.kind === 'break' ? (a.line || '') : niceTitle(a.title || ''));
    text('lrMeta', a.kind === 'break' ? (a.label || '') : [a.date, a.label].filter(Boolean).join(' · '));
    var frac = a.dur > 0 ? Math.max(0, Math.min(1, a.offset / a.dur)) : 0;
    var fill = $('lrFill');
    if (fill) fill.style.width = (frac * 100).toFixed(1) + '%';
    text('lrLeft', a.kind === 'break' ? (fmt(a.dur - a.offset) + ' until the next show') : (fmt(a.dur - a.offset) + ' left'));
    var when = a.nextShow ? (a.nextIsTomorrow ? '12:00 AM' : clock12((a.nextStart || 0) / 60)) : '';
    text('lrNext', a.nextShow ? (a.nextShow + ' · ' + when) : '—');
    text('lrNextEp', a.nextTitle ? niceTitle(a.nextTitle) : '');
    var st = '';
    if (state.started && state.userPaused) st = 'Paused. Play rejoins the broadcast, live.';
    else if (!state.started) st = 'Press Listen. You join whatever is on at this moment.';
    else if (state.err) st = 'This episode is slow to answer. The clock has not moved.';
    text('lrStatus', st);
    setPlayLabel();
    setMedia(a);
    if (state.lineupKey !== w.dateKey) { state.lineupKey = w.dateKey; paintLineup(w.dateKey); }
    markNow($('lrLineup'), w.sod);
    markNow($('lrRestList'), w.sod);
  }
  function optedOut() {
    try { if (localStorage.getItem('dxedge_stats_opt_out') === '1') return true; } catch (e) {}
    try {
      if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return true;
      if (navigator.globalPrivacyControl === true) return true;
    } catch (e2) {}
    return false;
  }
  function sid() {
    try {
      var s = sessionStorage.getItem('dxedge_sid');
      if (s && s.length >= 8) return s;
      var bytes = new Uint8Array(9), id = '', i;
      (window.crypto || window.msCrypto).getRandomValues(bytes);
      for (i = 0; i < bytes.length; i++) id += (bytes[i] + 256).toString(16).slice(1);
      sessionStorage.setItem('dxedge_sid', id);
      return id;
    } catch (e) {
      if (!sid._mem) sid._mem = 'm' + Math.random().toString(16).slice(2, 12);
      return sid._mem;
    }
  }
  // While the set is actually playing, tell the server someone is here. The
  // episode intro is requested only in the last 90 seconds of the break, and
  // the server still refuses to spend anything if the heartbeat never arrived.
  function pulse() {
    if (!booted || !state.started || state.userPaused || optedOut()) return;
    var now = Date.now();
    if (now - state.hbAt >= 20000) {
      state.hbAt = now;
      fetch('/api/otr/live/heartbeat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ s: sid() })
      }).catch(function () {});
    }
    maybeIntro();
  }
  function maybeIntro() {
    var a = onAir();
    if (!a || a.kind !== 'break' || !a.nextEp || a.nextIsTomorrow) return;
    var lead = a.dur - a.offset;
    if (lead > 90 || lead < 0 || state.asked[a.nextEp] || state.intros[a.nextEp]) return;
    state.asked[a.nextEp] = 1;
    fetch('/api/otr/live/intro', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        s: sid(), ep: a.nextEp, showId: a.nextShowId, show: a.nextShow,
        title: a.nextTitle, start: Math.floor(Date.now() / 1000 + lead)
      })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.play === 'intro' && j.url) {
        state.intros[a.nextEp] = j.url;
        if (j.seconds) state.introDur[a.nextEp] = j.seconds;
        state.loadedKey = null;
        follow();
      }
    }).catch(function () {});
  }
  function tick(){
    pulse();
    if (document.hidden) return;
    render();
    follow();
  }
  function wireAdv() {
    var b = document.getElementById('otrAdvLive');
    if (!b || b.__lrWired) return;
    b.__lrWired = true;
    b.addEventListener('click', function () {
      if (window.OTRMode) OTRMode.set('basic');
      if (booted) userPlay();
      else ready.then(function () { userPlay(); }).catch(function () {});
    });
  }

  var CSS = [
    '#otr-live{background:#080808;color:#e2e2e2;font-family:"SF Mono","Fira Code",Consolas,ui-monospace,monospace;}',
    '#otr-live *{box-sizing:border-box;}',
    '#otr-live .lr{max-width:min(720px,100%);margin:0 auto;padding:22px 18px 32px;background:radial-gradient(120% 80% at 50% -10%,rgba(255,179,71,.08),transparent 55%),#0c0c0c;border:1px solid #2a2418;border-radius:14px;}',
    '#otr-live .lr-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;}',
    '#otr-live .lr-name{font-size:20px;letter-spacing:1px;color:#fff;font-weight:600;margin:0;}',
    '#otr-live .lr-name span{color:#ffb347;}',
    '#otr-live .lr-tag{font-size:11px;color:#7c7c7c;letter-spacing:.4px;margin-top:3px;}',
    '#otr-live .lr-air{text-align:right;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#7c7c7c;white-space:nowrap;}',
    '#otr-live .lr-air.live{color:#ffb347;}',
    '#otr-live .lr-lamp{display:inline-block;width:8px;height:8px;border-radius:50%;background:#3c3c3c;margin-right:6px;vertical-align:0;}',
    '#otr-live .lr-lamp.on{background:#ffb347;box-shadow:0 0 10px #ffb347;animation:lr-pulse 1.6s infinite;}',
    '@keyframes lr-pulse{0%,100%{opacity:1}50%{opacity:.35}}',
    '@media (prefers-reduced-motion:reduce){#otr-live .lr-lamp.on{animation:none}}',
    '#otr-live .lr-clock{display:block;letter-spacing:1px;font-variant-numeric:tabular-nums;margin-top:4px;color:#ffd08a;}',
    '#otr-live .lr-k{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#7c7c7c;margin-top:18px;}',
    '#otr-live .lr-show{font-size:22px;color:#fff;font-weight:600;line-height:1.3;margin-top:4px;}',
    '#otr-live .lr-ep{color:#ffd08a;font-size:15px;line-height:1.4;margin-top:2px;}',
    '#otr-live .lr-meta{color:#7c7c7c;font-size:12px;margin-top:4px;}',
    '#otr-live .lr-bar{height:6px;border-radius:3px;background:#1c1c1c;margin-top:12px;pointer-events:none;}',
    '#otr-live .lr-bar i{display:block;height:100%;width:0;background:#ffb347;border-radius:3px;}',
    '#otr-live .lr-left{color:#a6a6a6;font-size:12px;margin-top:4px;font-variant-numeric:tabular-nums;}',
    '#otr-live .lr-status{color:#ffd08a;font-size:12.5px;margin-top:8px;min-height:1.2em;}',
    '#otr-live .lr-next{color:#fff;font-size:15px;margin-top:3px;}',
    '#otr-live .lr-next-ep{color:#a6a6a6;font-size:12.5px;margin-top:2px;}',
    '#otr-live .lr-transport{display:flex;align-items:center;gap:14px;margin-top:16px;flex-wrap:wrap;}',
    '#otr-live button{font-family:inherit;cursor:pointer;}',
    '#otr-live .lr-play{background:#ffb347;color:#1a1200;border:1px solid #ffb347;border-radius:8px;font-weight:600;font-size:14px;min-width:112px;min-height:44px;padding:8px 18px;}',
    '#otr-live .lr-play:hover{background:#ffd08a;}',
    '#otr-live .lr-vol{display:flex;align-items:center;gap:8px;color:#a6a6a6;font-size:12px;flex:1;min-width:160px;}',
    '#otr-live .lr-vol input{flex:1;accent-color:#ffb347;min-height:44px;}',
    '#otr-live .lr-line{margin-top:8px;border-top:1px solid #232323;}',
    '#otr-live .lr-line ol{list-style:none;margin:0;padding:0;max-height:360px;overflow:auto;}',
    '#otr-live .lr-line li{display:grid;grid-template-columns:92px 1fr;gap:8px;padding:8px;border-bottom:1px solid #1c1c1c;}',
    '#otr-live .lr-line li.now{background:rgba(255,179,71,.08);box-shadow:inset 3px 0 0 #ffb347;}',
    '#otr-live .lr-when{color:#ffd08a;font-variant-numeric:tabular-nums;font-size:13px;}',
    '#otr-live .lr-what{font-size:13.5px;color:#e2e2e2;}',
    '#otr-live .lr-what b{color:#fff;font-weight:600;margin-right:6px;}',
    '#otr-live .lr-epn{display:block;color:#a6a6a6;font-size:12px;margin-top:1px;}',
    '#otr-live details{margin-top:12px;color:#a6a6a6;font-size:12.5px;}',
    '#otr-live summary{cursor:pointer;letter-spacing:1px;text-transform:uppercase;font-size:10px;color:#7c7c7c;}',
    '#otr-live .lr-share{display:flex;gap:8px;align-items:center;margin-top:16px;flex-wrap:wrap;}',
    '#otr-live .lr-share button{background:#161616;color:#e2e2e2;border:1px solid #323232;border-radius:8px;min-height:44px;padding:8px 14px;font-size:13px;}',
    '#otr-live .lr-share button:hover{border-color:#ffb347;color:#fff;}',
    '#otr-live .lr-share input{flex:1;min-width:180px;background:#101010;color:#ffd08a;border:1px solid #323232;border-radius:8px;padding:8px 10px;font:inherit;font-size:12px;min-height:44px;}',
    '#otr-live .lr-copied{color:#00ff9d;font-size:12px;}',
    '#otr-live .lr-foot{color:#7c7c7c;font-size:12px;line-height:1.55;margin:16px 0 0;}',
    '#otr-live .lr-foot a{color:#00ff9d;}',
    '#otr-live #lrAudio{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;}',
    '@media (max-width:520px){#otr-live .lr{padding:16px 12px 24px;border-radius:0;border-left:0;border-right:0;}#otr-live .lr-top{align-items:flex-start;}#otr-live .lr-tag{max-width:190px;}#otr-live .lr-show{font-size:19px;}#otr-live .lr-line li{grid-template-columns:76px 1fr;}#otr-live .lr-air{letter-spacing:1px;}}'
  ].join('');

  var HTML = [
    '<div class="lr">',
    '<header class="lr-top"><div><div class="lr-name" role="heading" aria-level="1">Listen<span>otr</span> Radio</div>',
    '<div class="lr-tag">A live broadcast night. Eastern clock, every set.</div></div>',
    '<div class="lr-air" id="lrAir"><span class="lr-lamp" id="lrLamp"></span>On the air<span class="lr-clock" id="lrClock"></span></div></header>',
    '<div class="lr-k" id="lrKicker">Now playing</div>',
    '<div id="lrLive" aria-live="polite"><div class="lr-show" id="lrShow">Tuning the lineup…</div>',
    '<div class="lr-ep" id="lrEp"></div></div>',
    '<div class="lr-meta" id="lrMeta"></div>',
    '<div class="lr-bar" id="lrBar" aria-hidden="true"><i id="lrFill"></i></div>',
    '<div class="lr-left" id="lrLeft"></div>',
    '<div class="lr-status" id="lrStatus"></div>',
    '<div class="lr-k">Up next</div><div class="lr-next" id="lrNext"></div><div class="lr-next-ep" id="lrNextEp"></div>',
    '<div class="lr-transport"><button type="button" class="lr-play" id="lrPlay" aria-label="Listen live">Listen</button>',
    '<label class="lr-vol">Volume <input id="lrVol" type="range" min="0" max="1" step="0.01" aria-label="Volume"></label></div>',
    '<div class="lr-k">Tonight\'s lineup <span id="lrNightDate"></span></div>',
    '<div class="lr-line"><ol id="lrLineup"></ol></div>',
    '<details id="lrRest"><summary>The rest of the day</summary><div class="lr-line"><ol id="lrRestList"></ol></div></details>',
    '<div class="lr-share"><button type="button" id="lrShare">Share</button>',
    '<input id="lrLink" type="text" readonly aria-label="Share link">',
    '<span class="lr-copied" id="lrCopied" hidden></span></div>',
    '<p class="lr-foot" id="lrFoot"></p>',
    '<audio id="lrAudio" playsinline preload="none"></audio>',
    '</div>'
  ].join('');

  function bind(){
    audio = $('lrAudio');
    audio.controls = false;
    audio.loop = false;
    var saved = 0.9;
    try {
      var v = parseFloat(localStorage.getItem('listenotr_radio_vol'));
      if (!isNaN(v)) saved = Math.max(0, Math.min(1, v));
    } catch (e) {}
    audio.volume = saved;
    $('lrVol').value = String(saved);
    $('lrVol').addEventListener('input', function(){ setVol(+this.value); });
    $('lrPlay').addEventListener('click', function(){
      if (state.started && !state.userPaused) userPause(); else userPlay();
    });
    $('lrShare').addEventListener('click', onShare);
    $('lrLink').value = shareUrl();
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', function(){ if (!state.userPaused) hold(); });
    audio.addEventListener('error', onErr);
    var foot = $('lrFoot');
    foot.appendChild(document.createTextNode('Play and volume only. The clock chooses the show, and there is no way to skip ahead. Everyone listening is on this same moment. '));
    var link = document.createElement('a');
    link.href = '/otr/';
    link.textContent = 'Full player';
    foot.appendChild(link);
    foot.appendChild(document.createTextNode(' for the rest of the dial.'));
  }
  function mount(el){
    if (!el || el.__lrMounted) return;
    // Leave #otr-live-placeholder in place. Basic mode hides it once a child
    // other than the placeholder is here, and brings it back if that child goes.
    if (el.querySelector('[data-otr-live-player]')) { el.__lrMounted = true; return; }
    el.__lrMounted = true;
    if (obs) { obs.disconnect(); obs = null; }
    if (!$('lr-style')) {
      var st = document.createElement('style');
      st.id = 'lr-style';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    var host = document.createElement('div');
    host.id = 'otr-live-player';
    host.setAttribute('data-otr-live-player', '');
    host.innerHTML = HTML;
    el.appendChild(host);
    el.setAttribute('data-otr-live', 'ready');
    bind();
    wireAdv();
    ready.then(function(){
      booted = true;
      render();
      if (!timer) timer = setInterval(tick, 250);
    }).catch(function(e){
      fail = fail || e;
      text('lrShow', "The lineup didn't load");
      text('lrEp', String((fail && fail.message) || fail || 'Reload the page.'));
    });
  }
  function bootMount(){
    var el = document.getElementById('otr-live');
    if (el) mount(el);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { bootMount(); wireAdv(); });
  else { bootMount(); wireAdv(); }
  window.addEventListener('pagehide', function () {
    if (!state.started || state.userPaused || optedOut()) return;
    var payload = JSON.stringify({ s: sid() });
    if (navigator.sendBeacon) {
      try { navigator.sendBeacon('/api/otr/live/heartbeat', new Blob([payload], { type: 'application/json' })); } catch (e) {}
    }
  });
  // A host such as Basic mode can insert #otr-live after this script. Watch
  // only until the first mount; rendering the station would otherwise retrigger it.
  if (!document.getElementById('otr-live') || !document.getElementById('otr-live').__lrMounted) {
    obs = new MutationObserver(bootMount);
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }
  document.addEventListener('visibilitychange', function(){ if (!document.hidden) tick(); });

  window.__listenotr = {
    booted: function(){ return booted; },
    failed: function(){ return fail ? String(fail.message || fail) : ''; },
    onAir: function(ms){ return onAir(ms); },
    day: function(dateKey){ return assemble(dateKey).items.map(function(it){ return plain(it); }); },
    lineup: function(dateKey){ return lineupRows(dateKey); },
    wall: function(ms){ return wallClock(ms == null ? nowMs() : ms); },
    unixFor: function(dateKey, sod){ return unixFor(dateKey, sod); },
    setClock: function(ms){ clockMs = ms; if (booted) { render(); follow(); } },
    clearClock: function(){ clockMs = null; if (booted) { render(); follow(); } },
    play: function(){ userPlay(); },
    pause: function(){ userPause(); },
    paused: function(){ return !state.started || state.userPaused; },
    volume: function(v){ if (arguments.length) setVol(v); return audio ? audio.volume : 0; },
    audio: function(){
      return {
        src: audio ? (audio.currentSrc || audio.src || '') : '',
        time: audio ? audio.currentTime : 0,
        paused: audio ? audio.paused : true,
        controls: audio ? audio.controls : false,
        duration: audio && isFinite(audio.duration) ? audio.duration : null
      };
    },
    shareUrl: function(){ return shareUrl(); },
    blocks: function(){ return BLOCKS.length; }
  };
})();
