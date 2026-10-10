/* OTR radio core: the dial, the broadcast clocks and episode lookup. No DOM, no audio.
 *
 * Shared by the pop-out player (/otr/pop/) and meant for any later console: a Raspberry Pi kiosk,
 * a different face, a different screen size. A console only needs three things from here:
 *   core.dial            stations in dial order, each with a frequency on the AM band
 *   core.cursor(id, t)   where that station is at time t, and how to walk forward from there
 *   core.resolve(item)   the archive.org URL and the words to show for an item
 *
 * Genre channels: the broadcast clock is a straight port of buildSchedule() in /otr/index.html (seeded
 * shuffle per show, even interleave, seeded commercial slots, looping from 2026-01-01 UTC), so the
 * pop-out and the full player hear the same show at the same second. scripts/test_otr_pop.py checks
 * the two schedules match item for item; if the clock in index.html changes, change it here too.
 * Network stations: station.js (window.OTRStation) does all the work; load it before this file.
 *
 * Loaded as window.OTRCore.  OTRCore.load({base, season, date}) -> Promise<Core>
 */
(function(){
  'use strict';

  var SCRIPT_BASE = (function(){
    try { var s = document.currentScript && document.currentScript.src; if (s) return new URL('../', s).pathname; } catch (e) {}
    return '/otr/';
  })();

  var EPOCH = Date.UTC(2026, 0, 1) / 1000;
  var NETWORKS = ['nbc', 'cbs', 'abc', 'mutual'];
  // Same list as SEASONS in /otr/index.html (a seasonal channel joins the dial only in its month).
  var SEASONS = [
    { id:'halloween', month:9, tag:'October', until:'October 31',
      shows:['quiet-please','lights-out','inner-sanctum-mysteries','suspense','the-mysterious-traveler'] }
  ];
  // Where each station sits on the dial. The four networks are on their New York flagships' real
  // frequencies (WEAF 660 for NBC, WOR 710 for Mutual, WJZ 770 for ABC/Blue, WABC-WCBS 880 for CBS).
  // Genre channels are spaced up the band; one seasonal slot near the top is shared by every season.
  var FREQ = { nbc:660, mutual:710, abc:770, cbs:880,
    future:1010, action:1070, crime:1130, horror:1190, suspense:1250, western:1310,
    comedy:1370, drama:1430, sports:1490 };
  var SEASON_FREQ = 1560;
  var BAND = { min:530, max:1610 };

  function hashStr(str){ var h=2166136261>>>0; for(var i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return h; }
  function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  function shuffleArr(a, rnd){ for(var i=a.length-1;i>0;i--){ var j=Math.floor(rnd()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
  function titleCase(s){ return s.replace(/(^|[-\s])\w/g, function(m){ return m.toUpperCase(); }).replace(/-/g,' '); }

  function Core(cat, extra, grids, opts){
    var self = this;
    this.prefix = cat.prefix;
    this.source = cat.source;
    this.byId = {};
    cat.shows.forEach(function(s){ self.byId[s.id] = s; });
    this.adPool = this.byId.commercials || null;

    // genre channels, in catalog order, plus any seasonal channel for this month
    var channels = cat.channels.slice(), chanShows = {}, seasonal = {};
    channels.forEach(function(ch){ chanShows[ch] = cat.shows.filter(function(s){ return s.ch.indexOf(ch) >= 0; }); });
    var force = opts.season == null ? null : String(opts.season), month = (opts.date || new Date()).getMonth();
    SEASONS.slice().reverse().forEach(function(se){
      if (!(force !== null ? se.id === force : se.month === month)) return;
      var shows = se.shows.map(function(id){ return self.byId[id]; }).filter(Boolean);
      if (!shows.length || channels.indexOf(se.id) >= 0) return;
      chanShows[se.id] = shows; seasonal[se.id] = se; channels.unshift(se.id);
    });
    this.chanShows = chanShows; this.seasonal = seasonal; this.channels = channels;
    this.sched = {};

    // network stations: station-only shows join byId (never replacing a catalog show), then the grids
    if (extra && extra.shows) extra.shows.forEach(function(s){ if (!self.byId[s.id]) { s.st = true; self.byId[s.id] = s; } });
    this.nets = {};
    if (window.OTRStation) grids.forEach(function(g, i){ if (g) self.nets[NETWORKS[i]] = new window.OTRStation.Station(g, self.byId); });

    // the dial, low to high
    var taken = {}, dial = [];
    NETWORKS.forEach(function(id){ var N = self.nets[id]; if (!N) return;
      dial.push({ id:id, kind:'network', name:N.name, long:N.grid.long || N.name, tagline:N.grid.tagline || '', freq:FREQ[id] }); taken[FREQ[id]] = 1; });
    channels.forEach(function(ch){
      if (!(chanShows[ch] || []).length) return;
      var f = seasonal[ch] ? SEASON_FREQ : FREQ[ch];
      if (!f || taken[f]) { f = 560; while (taken[f] || f % 10) f += 40; }   // an unknown future channel finds a free spot
      taken[f] = 1;
      var se = seasonal[ch];
      dial.push({ id:ch, kind:'channel', name:titleCase(ch), long:titleCase(ch) + (se ? '' : ' channel'), freq:f,
        seasonal: se ? { tag:se.tag, until:se.until } : null, shows:chanShows[ch].length });
    });
    dial.sort(function(a, b){ return a.freq - b.freq; });
    this.dial = dial;
    this.stationById = {}; dial.forEach(function(s){ self.stationById[s.id] = s; });
  }

  Core.prototype.station = function(id){ return this.stationById[id] || null; };
  Core.prototype.nearest = function(freq){
    var best = null, d = Infinity;
    this.dial.forEach(function(s){ var x = Math.abs(s.freq - freq); if (x < d) { d = x; best = s; } });
    return best ? { station:best, distance:d } : null;
  };
  Core.prototype.neighbor = function(id, dir){
    var i = -1; for (var k = 0; k < this.dial.length; k++) if (this.dial[k].id === id) i = k;
    if (i < 0) return this.dial[0];
    var j = Math.max(0, Math.min(this.dial.length - 1, i + (dir > 0 ? 1 : -1)));
    return this.dial[j];
  };

  // ---- genre channel clock (port of buildProgramOrder + buildSchedule in /otr/index.html) ----
  Core.prototype.programOrder = function(shows, rnd){
    var lists = shows.map(function(s){
      var idx = s.eps.map(function(_, i){ return i; });
      shuffleArr(idx, rnd);
      return { s:s, idx:idx, p:0, initial:idx.length };
    }).filter(function(x){ return x.initial > 0; });
    var order = [], remaining = lists.reduce(function(a, x){ return a + x.initial; }, 0);
    while (order.length < remaining) {
      var best = null, bestScore = -1;
      for (var i = 0; i < lists.length; i++) {
        var L = lists[i]; if (L.p >= L.initial) continue;
        var score = (L.initial - L.p) / L.initial;
        if (score > bestScore) { bestScore = score; best = L; }
      }
      if (!best) break;
      order.push({ showId:best.s.id, epIndex:best.idx[best.p], isAd:false });
      best.p++;
    }
    return order;
  };
  Core.prototype.itemDur = function(it){ var s = this.byId[it.showId]; var e = s && s.eps[it.epIndex]; return (e && e[2] > 0) ? e[2] : 1800; };
  Core.prototype.schedule = function(ch){
    if (this.sched[ch]) return this.sched[ch];
    var rnd = mulberry32(hashStr('otr-sched:' + ch)), ad = this.adPool;
    var progs = this.programOrder(this.chanShows[ch] || [], rnd);
    var items = [], since = 0, gap = 2 + Math.floor(rnd() * 2);
    progs.forEach(function(p){
      items.push(p); since++;
      if (ad && ad.eps.length && since >= gap) {
        items.push({ showId:'commercials', epIndex:Math.floor(rnd() * ad.eps.length), isAd:true });
        since = 0; gap = 2 + Math.floor(rnd() * 2);
      }
    });
    var starts = [], t = 0, self = this;
    items.forEach(function(it){ starts.push(t); t += self.itemDur(it); });
    return (this.sched[ch] = { items:items, starts:starts, total:t });
  };
  Core.prototype.channelOnAir = function(ch, t){
    var S = this.schedule(ch); if (!S.items.length) return null;
    var pos = (((t - EPOCH) % S.total) + S.total) % S.total;
    var lo = 0, hi = S.starts.length - 1;
    while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (S.starts[mid] <= pos) lo = mid; else hi = mid - 1; }
    return { idx:lo, item:S.items[lo], offset:pos - S.starts[lo], dur:this.itemDur(S.items[lo]), loopStart:t - pos, S:S };
  };

  // ---- cursors: one interface for both kinds of station ----
  // cursor.item, cursor.offset (seconds into it at time t), cursor.item.at (scheduled start, epoch seconds),
  // cursor.advance() -> the next item, cursor.peek(n) -> the next n programs (no commercials).
  function ChannelCursor(core, ch, a, commercials){
    this.core = core; this.id = ch; this.S = a.S; this.idx = a.idx; this.loopStart = a.loopStart; this.commercials = commercials;
    this.offset = a.offset; this.item = this.wrap(this.idx);
    if (!commercials && this.item.isAd) { this.advance(); this.offset = 0; }   // ad on air: start the next program from the top
  }
  ChannelCursor.prototype.wrap = function(i){
    var it = this.S.items[i];
    return { showId:it.showId, epIndex:it.epIndex, isAd:it.isAd, at:this.loopStart + this.S.starts[i], dur:this.core.itemDur(it) };
  };
  ChannelCursor.prototype.step = function(){
    this.idx++; if (this.idx >= this.S.items.length) { this.idx = 0; this.loopStart += this.S.total; }
  };
  ChannelCursor.prototype.advance = function(){
    var guard = 0;
    do { this.step(); } while (!this.commercials && this.S.items[this.idx].isAd && guard++ < 10);
    this.offset = 0; this.item = this.wrap(this.idx); return this.item;
  };
  ChannelCursor.prototype.peek = function(n){
    var out = [], i = this.idx, ls = this.loopStart, guard = 0;
    while (out.length < n && guard++ < 50) {
      i++; if (i >= this.S.items.length) { i = 0; ls += this.S.total; }
      var it = this.S.items[i]; if (it.isAd) continue;
      out.push({ showId:it.showId, epIndex:it.epIndex, isAd:false, at:ls + this.S.starts[i], dur:this.core.itemDur(it) });
    }
    return out;
  };

  function NetworkCursor(core, id, N, a){
    this.core = core; this.id = id; this.N = N;
    this.list = [a.item].concat(N.upcoming(a.item.at + 1, 6)); this.i = 0;
    this.offset = a.offset; this.item = this.wrap(this.list[0]);
  }
  NetworkCursor.prototype.wrap = function(it){
    return { showId:it.showId, epIndex:it.epIndex, isAd:false, at:it.at, dur:it.dur, own:it.own, fill:it.fill, label:it.label, net:this.id };
  };
  NetworkCursor.prototype.fill = function(){
    while (this.list.length - this.i < 4) {
      var last = this.list[this.list.length - 1], more = this.N.upcoming(last.at + 1, 6);
      if (!more.length) break; this.list = this.list.concat(more);
    }
  };
  NetworkCursor.prototype.advance = function(){ this.i++; this.fill(); this.offset = 0; this.item = this.wrap(this.list[this.i]); return this.item; };
  NetworkCursor.prototype.peek = function(n){ this.fill(); var self = this; return this.list.slice(this.i + 1, this.i + 1 + n).map(function(it){ return self.wrap(it); }); };

  Core.prototype.cursor = function(id, t, opts){
    opts = opts || {}; t = t == null ? Date.now() / 1000 : t;
    var N = this.nets[id];
    if (N) { var a = N.onAir(t); return a ? new NetworkCursor(this, id, N, a) : null; }
    var c = this.channelOnAir(id, t);
    return c ? new ChannelCursor(this, id, c, opts.commercials !== false) : null;
  };

  // ---- words and URLs ----
  Core.prototype.resolve = function(item){
    if (!item) return null;
    var s = this.byId[item.showId], e = s && s.eps[item.epIndex]; if (!e) return null;
    var out = { url:this.prefix + s.ids[e[3]] + '/' + e[4], isAd:!!item.isAd, show:item.isAd ? 'Commercial break' : s.name,
      title:item.isAd ? 'A vintage advertisement' : e[0], date:item.isAd ? '' : e[1], dur:e[2] > 0 ? e[2] : 1800, slot:null };
    if (item.net && this.nets[item.net]) {
      var d = this.nets[item.net].describe(item);
      out.slot = { day:d.day, time:d.slotTime, fill:d.fill, label:d.label, conf:d.slotConf, isDefault:!!(item.own && item.own.isDefault), network:this.nets[item.net].name };
    }
    return out;
  };
  Core.prototype.describeSlot = function(stationId, item){
    var N = this.nets[stationId]; if (!N || !item || !item.own) return null;
    var d = N.describe(item); return { day:d.day, time:d.slotTime, fill:d.fill, label:d.label, conf:d.slotConf };
  };

  function load(opts){
    opts = opts || {};
    var base = opts.base || SCRIPT_BASE;
    function getJSON(p){ return fetch(base + p).then(function(r){ if (!r.ok) throw new Error(p + ' HTTP ' + r.status); return r.json(); }); }
    return Promise.all([getJSON('catalog.json'), getJSON('stations/shows.json').catch(function(){ return null; })]).then(function(r){
      return Promise.all(NETWORKS.map(function(id){ return getJSON('stations/' + id + '.grid.json').catch(function(){ return null; }); }))
        .then(function(grids){ return new Core(r[0], r[1], grids, { base:base, season:opts.season, date:opts.date }); });
    });
  }

  window.OTRCore = { load:load, Core:Core, BAND:BAND, FREQ:FREQ, EPOCH:EPOCH, NETWORKS:NETWORKS, SEASONS:SEASONS, titleCase:titleCase };
})();
