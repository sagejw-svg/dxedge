/* OTR radio player: turns a core (radio-core.js) into a radio you can switch on and tune.
 * Owns the <audio> element, the static between stations, the live clock, error recovery and the
 * lock-screen controls. Knows nothing about how the radio looks: a face reads player.state and
 * calls the methods below, so a phone, a desktop pop-out window and a Pi kiosk all share this file.
 *
 *   player.powerOn() / powerOff() / togglePower()     call from a tap; browsers need a gesture to play
 *   player.beginTune(); player.setFreq(khz); player.endTune()   a drag of a knob or the dial
 *   player.tuneTo(id)  player.step(+1|-1)  player.rejoin()      jump to a station, live
 *   player.pause() / resume() / setVolume(0..1)
 *   player.on('change' | 'tick' | 'freq' | 'notice', fn)
 *
 * iPhone notes carried over from /otr: audio plays through the element itself, never Web Audio, so it
 * keeps going on the lock screen; navigator.audioSession.type='playback' lets it sound with the ring
 * switch on silent; iOS ignores element.volume, so canSetVolume is false there.
 *
 * Loaded as window.OTRPlayer.
 */
(function(){
  'use strict';

  var IS_IOS = (function(){ try {
    if (new URLSearchParams(location.search).get('ios') === '1') return true;
    var ua = navigator.userAgent || '', p = navigator.platform || '';
    return /iPhone|iPad|iPod/.test(ua) || /iP(hone|od|ad)/.test(p) || (/Mac/.test(p) && navigator.maxTouchPoints > 1);
  } catch (e) { return false; } })();

  function load(k, d){ try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function save(k, v){ try { localStorage.setItem(k, v); } catch (e) {} }
  function now(){ return Date.now() / 1000; }

  // Two seconds of AM static as a WAV blob: brown noise with a little crackle and a slow swell.
  // A plain <audio> element can loop it on every platform, iPhone included, with no Web Audio.
  function makeStatic(){
    var sr = 16000, n = sr * 2, buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf), i;
    function str(o, s){ for (var k = 0; k < s.length; k++) dv.setUint8(o + k, s.charCodeAt(k)); }
    str(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    str(36, 'data'); dv.setUint32(40, n * 2, true);
    var last = 0, pop = 0, seed = 12345;
    function rnd(){ seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    for (i = 0; i < n; i++) {
      var w = rnd() * 2 - 1; last = (last + 0.03 * w) / 1.03;
      if (rnd() < 0.0009) pop = (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.4);
      var swell = 0.75 + 0.25 * Math.sin(i / sr * Math.PI * 2 * 1.5);
      var v = (last * 3.2 + w * 0.22) * swell + pop; pop *= 0.82;
      var edge = Math.min(1, i / 400, (n - i) / 400);            // soften the loop seam
      v = Math.max(-1, Math.min(1, v * 0.55 * edge));
      dv.setInt16(44 + i * 2, v * 32767, true);
    }
    return URL.createObjectURL(new Blob([buf], { type:'audio/wav' }));
  }

  function Player(core, opts){
    opts = opts || {};
    var self = this;
    this.core = core;
    this.keyPrefix = opts.keyPrefix || 'otrpop_';
    this.isIOS = IS_IOS;
    this.canSetVolume = !IS_IOS;
    this.listeners = {};
    this.audio = opts.audio || document.createElement('audio');
    this.audio.preload = 'auto';
    this.staticEl = document.createElement('audio');
    this.staticEl.loop = true; this.staticEl.preload = 'auto';
    this.staticEl.src = makeStatic();
    this.artwork = opts.artwork || null;

    var savedId = load(this.keyPrefix + 'station', '');
    var start = core.station(savedId) || core.station('nbc') || core.dial[0];
    this.state = {
      power:false,
      station:start ? start.id : null,      // the station the needle is parked on (or was, before a drag)
      freq:start ? start.freq : 660,
      tuning:false,                         // a knob or the dial is being dragged
      status:'off',                         // off | warming | buffering | onair | paused | error
      item:null, res:null, next:[],
      offsetLive:0,                         // how far behind (+) or ahead (-) of the live clock, seconds
      volume:parseFloat(load(this.keyPrefix + 'vol', '0.85')),
      commercials:load('otr_comm', '1') === '1',  // shared with the full player
      errCount:0, warmUntil:0
    };
    if (!(this.state.volume >= 0 && this.state.volume <= 1)) this.state.volume = 0.85;
    this.audio.volume = this.state.volume;
    this.staticEl.volume = Math.min(1, this.state.volume * 0.5);
    this.cursor = null; this.pendingSeek = 0; this.watch = null; this.backoff = null; this.wasPlaying = false; this.snapRAF = 0;

    var a = this.audio;
    a.addEventListener('loadedmetadata', function(){
      if (self.pendingSeek > 0) { try { a.currentTime = Math.min(self.pendingSeek, Math.max(0, (a.duration || 1e9) - 3)); } catch (e) {} self.pendingSeek = 0; }
    });
    a.addEventListener('playing', function(){ self.clearWatch(); self.state.errCount = 0; self.set({ status:'onair' }); self.syncSession(); });
    a.addEventListener('waiting', function(){ if (self.state.power && !self.state.tuning) { self.set({ status:'buffering' }); self.arm(); } });
    a.addEventListener('pause', function(){ if (self.state.power && !self.state.tuning && !a.ended && self.state.status !== 'buffering' && self.state.status !== 'warming' && self.state.status !== 'error') { self.set({ status:'paused' }); self.syncSession(); } });
    a.addEventListener('ended', function(){ if (self.state.power) self.playNext(); });
    a.addEventListener('error', function(){ if (self.state.power && a.getAttribute('src')) self.fail('error'); });

    this.tickTimer = setInterval(function(){ if (!document.hidden) self.tick(); }, 1000);
    this.initSession();
  }

  Player.prototype.on = function(ev, fn){ (this.listeners[ev] = this.listeners[ev] || []).push(fn); return this; };
  Player.prototype.off = function(ev, fn){ var l = this.listeners[ev] || []; var i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); return this; };
  Player.prototype.emit = function(ev, arg){ (this.listeners[ev] || []).forEach(function(fn){ try { fn(arg); } catch (e) { console.error(e); } }); };
  Player.prototype.set = function(patch){ for (var k in patch) this.state[k] = patch[k]; this.emit('change', this.state); };
  Player.prototype.notice = function(msg){ this.emit('notice', msg); };

  // ---- power ----
  Player.prototype.powerOn = function(){
    if (this.state.power) return;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    // iPhone only lets an element play later if it was first played from a tap, and tuning starts on a
    // drag (pointermove), which does not count. So start the static element silently now, while we are
    // still inside the tap that switched the radio on, and stop it again at once.
    var se = this.staticEl;
    if (!this.staticPrimed) { this.staticPrimed = true; se.muted = true;
      var pr = se.play(); if (pr && pr.then) pr.then(function(){ se.pause(); se.muted = false; }, function(){ se.muted = false; }); else { se.pause(); se.muted = false; } }
    this.set({ power:true, status:'warming', warmUntil:Date.now() + 2200, errCount:0 });
    this.tuneTo(this.state.station, { keepStatus:true });
  };
  Player.prototype.powerOff = function(){
    this.clearWatch(); clearTimeout(this.backoff); this.backoff = null;
    this.audio.pause(); this.staticEl.pause();
    this.set({ power:false, status:'off', tuning:false, offsetLive:0 });
    this.syncSession();
  };
  Player.prototype.togglePower = function(){ if (this.state.power) this.powerOff(); else this.powerOn(); };

  // ---- tuning ----
  Player.prototype.tuneTo = function(id, opts){
    opts = opts || {};
    var st = this.core.station(id); if (!st) return;
    save(this.keyPrefix + 'station', id);
    this.animateFreq(st.freq);
    this.cursor = this.core.cursor(id, now(), { commercials:this.state.commercials });
    this.set({ station:id });
    if (!this.cursor) { this.notice('Nothing is on the air there right now.'); return; }
    if (!this.state.power) { this.preview(); return; }       // off: just move the needle and show what's on
    clearTimeout(this.backoff); this.backoff = null;
    this.start(this.cursor.item, this.cursor.offset, opts.keepStatus);
  };
  Player.prototype.preview = function(){
    var c = this.cursor; if (!c) return;
    this.set({ item:c.item, res:this.core.resolve(c.item), next:c.peek(2) });
  };
  Player.prototype.beginTune = function(){
    if (this.state.tuning) return;
    cancelAnimationFrame(this.snapRAF);
    this.wasPlaying = this.state.power && !this.audio.paused;
    this.tuneStartedAt = now();
    if (this.state.power) {
      this.audio.pause(); this.clearWatch();
      try { this.staticEl.currentTime = Math.random() * 1.5; } catch (e) {}
      this.staticEl.play().catch(function(){});
    }
    this.set({ tuning:true });
  };
  Player.prototype.setFreq = function(f){
    var B = window.OTRCore.BAND;
    f = Math.max(B.min, Math.min(B.max, f));
    this.state.freq = f;
    if (this.state.tuning && this.state.power && this.canSetVolume) {
      var near = this.core.nearest(f), d = near ? near.distance : 50;
      this.staticEl.volume = this.state.volume * Math.min(0.75, 0.12 + d / 40);   // louder between stations
    }
    this.emit('freq', f);
  };
  Player.prototype.endTune = function(){
    if (!this.state.tuning) return;
    this.staticEl.pause();
    var near = this.core.nearest(this.state.freq), target = near ? near.station : null;
    this.state.tuning = false;
    if (!target) { this.emit('change', this.state); return; }
    var same = target.id === this.state.station && this.state.power && this.wasPlaying && (now() - this.tuneStartedAt) < 15;
    if (same) {   // a nudge that lands back on the same station: carry on rather than reloading
      this.animateFreq(target.freq); this.audio.play().catch(function(){}); this.emit('change', this.state); return;
    }
    this.tuneTo(target.id);
  };
  // Up or down the dial one station (lock-screen buttons, arrow keys, a tap on a station name).
  Player.prototype.step = function(dir){
    var near = this.core.nearest(this.state.freq);
    var id = this.state.station || (near ? near.station.id : null);
    var nb = this.core.neighbor(id, dir);
    if (nb) this.jump(nb.id);
  };
  // A short burst of static on the way to a station, like spinning the knob past the gap.
  Player.prototype.jump = function(id){
    var self = this;
    if (!this.state.power || document.hidden || id === this.state.station) { this.tuneTo(id); return; }
    this.beginTune();
    var st = this.core.station(id), from = this.state.freq, t0 = performance.now();
    function frame(t){
      var k = Math.min(1, (t - t0) / 380); self.setFreq(from + (st.freq - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) self.snapRAF = requestAnimationFrame(frame); else self.endTune();
    }
    this.snapRAF = requestAnimationFrame(frame);
  };
  Player.prototype.animateFreq = function(target){
    var self = this, from = this.state.freq, t0 = performance.now();
    cancelAnimationFrame(this.snapRAF);
    if (Math.abs(target - from) < 0.5 || document.hidden) { this.setFreq(target); return; }
    function frame(t){
      var k = Math.min(1, (t - t0) / 220); self.setFreq(from + (target - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) self.snapRAF = requestAnimationFrame(frame);
    }
    this.snapRAF = requestAnimationFrame(frame);
  };
  Player.prototype.rejoin = function(){ if (this.state.station) this.tuneTo(this.state.station); };

  // ---- playback ----
  Player.prototype.start = function(item, offset, keepStatus){
    var res = this.core.resolve(item);
    if (!res) { this.playNext(); return; }
    this.pendingSeek = offset > 5 ? offset : 0;
    this.set({ item:item, res:res, next:this.cursor ? this.cursor.peek(2) : [], offsetLive:0,
      status:keepStatus && Date.now() < this.state.warmUntil ? 'warming' : 'buffering' });
    this.audio.src = res.url;
    var p = this.audio.play();
    if (p && p.catch) { var self = this; p.catch(function(e){ if (e && e.name === 'NotAllowedError') { self.set({ status:'paused' }); self.notice('Tap play to start the sound.'); } }); }
    this.arm();
    this.syncSession();
  };
  Player.prototype.playNext = function(){
    if (!this.cursor) return;
    this.start(this.cursor.advance(), 0);
  };
  Player.prototype.pause = function(){ this.audio.pause(); };
  Player.prototype.resume = function(){
    if (!this.state.power) { this.powerOn(); return; }
    if (this.state.status === 'error' || !this.audio.getAttribute('src')) { this.rejoin(); return; }
    this.audio.play().catch(function(){});
  };
  Player.prototype.setVolume = function(v){
    v = Math.max(0, Math.min(1, v)); this.state.volume = v; save(this.keyPrefix + 'vol', String(v));
    this.audio.volume = v; this.staticEl.volume = Math.min(1, v * 0.5);
    this.emit('change', this.state);
  };

  // ---- failures: skip at most twice in a row, then wait 30 s (same limiter as /otr) ----
  Player.prototype.arm = function(){
    var self = this; this.clearWatch();
    this.watch = setTimeout(function(){ if (self.state.power && !self.state.tuning && self.audio.paused === false && self.state.status !== 'onair') self.fail('stall'); }, 18000);
  };
  Player.prototype.clearWatch = function(){ clearTimeout(this.watch); this.watch = null; };
  Player.prototype.fail = function(why){
    var self = this; this.clearWatch();
    this.state.errCount++;
    if (this.state.errCount <= 2) { this.notice(why === 'stall' ? 'That episode is not loading. Moving on.' : 'That episode is unavailable. Moving on.'); this.playNext(); return; }
    this.audio.pause();
    this.set({ status:'error' });
    clearTimeout(this.backoff);
    this.backoff = setTimeout(function(){ if (self.state.power) { self.state.errCount = 0; self.rejoin(); } }, 30000);
  };

  // ---- clock ----
  Player.prototype.tick = function(){
    var s = this.state;
    if (s.status === 'warming' && Date.now() > s.warmUntil) { s.status = this.audio.paused ? 'buffering' : 'onair'; this.emit('change', s); }
    if (s.power && s.item && s.status === 'onair') {
      var behind = (now() - s.item.at) - this.audio.currentTime;
      s.offsetLive = Math.abs(behind) < 45 ? 0 : behind;
    }
    if (!s.power && this.cursor && s.item && now() > s.item.at + s.item.dur) { this.cursor = this.core.cursor(s.station, now(), { commercials:s.commercials }); this.preview(); }
    this.emit('tick', s);
  };
  Player.prototype.position = function(){
    var s = this.state; if (!s.item) return { t:0, dur:0 };
    var dur = (this.audio.duration && isFinite(this.audio.duration)) ? this.audio.duration : s.item.dur;
    if (!s.power) return { t:Math.max(0, now() - s.item.at), dur:s.item.dur };
    return { t:this.audio.currentTime || this.pendingSeek || 0, dur:dur };
  };

  // ---- lock screen, headset buttons, OS media keys ----
  Player.prototype.initSession = function(){
    if (!('mediaSession' in navigator)) return;
    var self = this, ms = navigator.mediaSession;
    function h(a, fn){ try { ms.setActionHandler(a, fn); } catch (e) {} }
    h('play', function(){ self.resume(); });
    h('pause', function(){ self.pause(); });
    h('stop', function(){ self.powerOff(); });
    h('nexttrack', function(){ self.step(+1); });
    h('previoustrack', function(){ self.step(-1); });
  };
  Player.prototype.syncSession = function(){
    if (!('mediaSession' in navigator)) return;
    var ms = navigator.mediaSession, s = this.state, st = this.core.station(s.station);
    try {
      ms.playbackState = !s.power ? 'none' : (this.audio.paused ? 'paused' : 'playing');
      if (s.res && s.power && window.MediaMetadata) {
        ms.metadata = new MediaMetadata({ title:s.res.isAd ? 'Commercial break' : s.res.title, artist:s.res.isAd ? (st ? st.name : '') : s.res.show,
          album:(st ? st.name + ' on ' + (st.freq / 10) + ' kc' : 'Old Time Radio'), artwork:this.artwork ? [{ src:this.artwork, sizes:'512x512', type:'image/png' }] : [] });
      }
    } catch (e) {}
  };

  window.OTRPlayer = { Player:Player, isIOS:IS_IOS };
})();
