/* Listening-room slideshow for the Old Time Radio player.
 *
 * Scene pictures live in scenes/ and are listed in scenes/scenes.json. None of
 * them contain the lava lamp. This file lays the picture down and draws the
 * existing lamp (the same painter as the rack) on a separate canvas, then
 * moves, sizes, and tilts that canvas with CSS. A listener's layout is kept
 * per room in localStorage under otr_slide_lamp.
 *
 * The Hetzner Sci-Fi YouTube encoder is not in this repo. For that stream,
 * open /otr/?slideshow=stream (or capture #slideFrame while this page cycles).
 * That mode ignores a saved layout and uses each room's own pose from
 * scenes.json, so the lamp is not stuck in one spot. Offline, composite the
 * same files: the picture URL plus the lamp object (x, y, s, rot, tilt, skew).
 *
 * seasons in scenes.json is a civil-date hook. While today (in that season's
 * zone) falls inside from..to, rooms whose picture files exist join the end of
 * the rotation. Missing files are left out, and if none exist the year-round
 * rooms stay exactly as they are. ?sceneDate=YYYY-MM-DD pretends that civil date.
 */
(function () {
  'use strict';
  if (window.__otrSlideshow) return;
  window.__otrSlideshow = 1;

  var KEY = 'otr_slide_lamp';
  var BASE = window.__OTR_ASSET_BASE || '/otr/';
  if (BASE.slice(-1) !== '/') BASE += '/';
  var ROOT = BASE + 'scenes/';

  var pack = null, scenes = [], index = 0, on = false, stream = false, slidesReady = false;
  var seasonInfo = { id: null, active: false, art: 0, fallback: true, date: null };
  var custom = {}, shownAt = 0, timer = 0, raf = 0, drag = null, front = 0;
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var stage, frame, wrap, cv, cap, resetBtn, bgs, buttons = [];

  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function copy(p) { return { x: +p.x, y: +p.y, s: +p.s, rot: +p.rot, tilt: +p.tilt, skew: +p.skew }; }
  function mode() {
    return (window.OTRMode && OTRMode.current()) || document.documentElement.getAttribute('data-otr-mode') || 'advanced';
  }
  function qsFlag() {
    var q = location.search || '';
    if (/[?&]slideshow=stream\b/.test(q)) return 'stream';
    if (/[?&]slideshow=1\b/.test(q)) return 'on';
    return '';
  }

  function readSaved() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!raw || typeof raw !== 'object') return;
      if (raw.custom && typeof raw.custom === 'object') custom = raw.custom;
      if (typeof raw.i === 'number') index = raw.i;
    } catch (e) {}
  }
  function writeSaved() {
    if (stream) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ on: on, i: index, custom: custom }));
    } catch (e) {}
  }
  function readOn() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      return !!(raw && raw.on);
    } catch (e) { return false; }
  }

  function scene() { return scenes[index] || null; }
  function poseFor(sc) {
    if (!sc) return { x: 0.5, y: 0.8, s: 0.36, rot: 0, tilt: 8, skew: 0 };
    if (!stream && custom[sc.id]) return copy(custom[sc.id]);
    return copy(sc.lamp);
  }
  function paintPose(p, glide) {
    if (!wrap) return;
    wrap.classList.toggle('glide', !!glide && !reduce);
    wrap.style.setProperty('--x', String(p.x));
    wrap.style.setProperty('--y', String(p.y));
    wrap.style.setProperty('--s', String(p.s));
    wrap.style.setProperty('--rot', p.rot + 'deg');
    wrap.style.setProperty('--tilt', p.tilt + 'deg');
    wrap.style.setProperty('--skew', p.skew + 'deg');
    if (resetBtn) resetBtn.hidden = stream || !scene() || !custom[scene().id];
  }
  function applyScenePose(glide) {
    paintPose(poseFor(scene()), glide);
    var sc = scene();
    if (cap) cap.textContent = sc ? sc.name : '';
    if (frame && sc) frame.setAttribute('data-scene', sc.id);
  }

  function url(src) {
    if (!src) return '';
    if (/^(https?:|\/)/.test(src)) return src;
    return ROOT + src;
  }

  function show(i, fade) {
    if (!scenes.length) return;
    index = ((i % scenes.length) + scenes.length) % scenes.length;
    var sc = scene();
    var incoming = bgs[1 - front];
    var outgoing = bgs[front];
    incoming.style.backgroundImage = 'url("' + url(sc.src) + '")';
    if (fade && !reduce) {
      incoming.classList.remove('on');
      void incoming.offsetWidth;
    }
    incoming.classList.add('on');
    outgoing.classList.remove('on');
    front = 1 - front;
    applyScenePose(!!fade && !reduce);
    shownAt = performance.now();
    writeSaved();
  }

  function arm() {
    clearTimeout(timer);
    if (!on || !scenes.length) return;
    var dwell = (pack && pack.dwellMs) || 18000;
    var wait = Math.max(400, dwell - (performance.now() - shownAt));
    timer = setTimeout(function () {
      if (drag) { arm(); return; }
      show(index + 1, true);
      arm();
    }, wait);
  }

  function loop(now) {
    if (!on || !stage || stage.hidden) { raf = 0; return; }
    raf = requestAnimationFrame(loop);
    var lamp = window.__otr && __otr.adv && __otr.adv.lamp;
    if (lamp && lamp.slide && cv && cv.clientWidth) {
      try { lamp.slide(cv, now); } catch (e) {}
    }
  }
  function ensureLoop() {
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function setOn(v) {
    on = !!v;
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    if (stage) stage.hidden = !on;
    place();
    if (on) {
      if (scenes.length) show(index, false);
      ensureLoop();
      arm();
    } else {
      clearTimeout(timer);
    }
    writeSaved();
    return on;
  }

  function place() {
    if (!stage) return;
    var basic = $('otr-basic');
    var consoleEl = $('console');
    var row = $('slideBasicRow');
    if (mode() === 'basic' && basic) {
      if (row && row.nextSibling !== stage) basic.insertBefore(stage, row.nextSibling);
      else if (!row) basic.insertBefore(stage, basic.firstChild);
    } else if (consoleEl && consoleEl.parentNode) {
      consoleEl.parentNode.insertBefore(stage, consoleEl.nextSibling);
    }
  }

  function btn(id, label) {
    var b = document.createElement('button');
    b.type = 'button';
    b.id = id;
    b.className = 'slide-btn';
    b.setAttribute('aria-pressed', 'false');
    b.title = 'Cycle through listening rooms. The lava lamp sits on top of the picture, and you can move it.';
    b.textContent = label;
    b.addEventListener('click', function () { setOn(!on); });
    buttons.push(b);
    return b;
  }

  function build() {
    var css = document.createElement('style');
    css.id = 'otr-slideshow-css';
    css.textContent = [
      '.slide-basic-row{display:flex;align-items:center;gap:10px;margin:0 0 8px;max-width:100%;}',
      '.slide-btn{border:1px solid var(--border2,#323232);background:var(--bg2,#161616);color:var(--text,#e2e2e2);border-radius:8px;',
      'font-family:inherit;font-size:12px;min-height:40px;padding:7px 12px;cursor:pointer;}',
      '.slide-btn:hover{border-color:var(--amber,#ffb347);color:#fff;}',
      '.slide-btn[aria-pressed="true"]{border-color:var(--amber,#ffb347);color:var(--amber,#ffb347);background:rgba(255,179,71,.1);}',
      '#lampMod .slide-btn{padding:3px 8px;min-height:0;font-size:11px;}',
      '.slide-stage{display:flex;flex-direction:column;gap:8px;margin:12px 0 4px;max-width:100%;}',
      '.slide-stage[hidden]{display:none !important;}',
      '.slide-h{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;}',
      '.slide-cap{color:var(--amber2,#ffd08a);font-size:13px;letter-spacing:.4px;}',
      '.slide-hint{margin:0;color:var(--dim,#7c7c7c);font-size:11.5px;line-height:1.45;max-width:70ch;}',
      'html[data-otr-mode="basic"] .slide-hint{display:none;}',
      '.slide-frame{position:relative;width:100%;aspect-ratio:16/9;border-radius:12px;overflow:hidden;background:#14110e;',
      'border:1px solid var(--border,#2a2418);}',
      '.slide-bg{position:absolute;inset:0;background-size:cover;background-position:center;opacity:0;transition:opacity 1.4s ease;}',
      '.slide-bg.on{opacity:1;}',
      '@media (prefers-reduced-motion:reduce){.slide-bg{transition:none}.slide-lamp.glide{transition:none !important}}',
      '.slide-lamp{position:absolute;left:calc(var(--x,0.5) * 100%);top:calc(var(--y,0.8) * 100%);height:calc(var(--s,0.36) * 100%);',
      'aspect-ratio:120/200;transform:translate(-50%,-100%) perspective(720px) rotateX(var(--tilt,8deg)) rotateZ(var(--rot,0deg)) skewX(var(--skew,0deg));',
      'transform-origin:50% 100%;touch-action:none;z-index:2;}',
      '.slide-lamp.glide{transition:left .7s ease,top .7s ease,height .7s ease,transform .7s ease;}',
      '.slide-lamp canvas{width:100%;height:100%;display:block;background:transparent;}',
      '.slide-lamp:focus{outline:none}.slide-lamp:focus-visible{outline:2px solid #ffb347;outline-offset:3px;}',
      '.slide-hnd{position:absolute;width:18px;height:18px;margin:0;padding:0;border:0;border-radius:0;background:transparent;color:transparent;opacity:0;z-index:3;}',
      '.slide-hnd.s{right:0;bottom:0;cursor:nwse-resize;}',
      '.slide-hnd.r{left:50%;top:0;transform:translate(-50%,-100%);cursor:grab;}',
      '.slide-hnd.t{right:0;top:30%;cursor:ns-resize;}',
      '.slide-stage.is-stream .slide-hnd,.slide-stage.is-stream .slide-hint,.slide-stage.is-stream #slideReset{display:none;}',
      '.slide-stage.is-stream .slide-lamp{pointer-events:none;}'
    ].join('');
    document.head.appendChild(css);

    var row = document.createElement('div');
    row.id = 'slideBasicRow';
    row.className = 'slide-basic-row';
    row.appendChild(btn('slideBtnBasic', 'Slideshow'));
    var basic = $('otr-basic');
    if (basic) basic.insertBefore(row, basic.firstChild);

    var tools = document.querySelector('.tools2');
    var adv = $('advBtn');
    var mainBtn = btn('slideBtn', 'Slideshow');
    if (tools) {
      if (adv) tools.insertBefore(mainBtn, adv);
      else tools.appendChild(mainBtn);
    }
    var lampH = document.querySelector('#lampMod .mod-h .sp');
    var lampBtn = btn('slideBtnLamp', 'Slideshow');
    if (lampH && lampH.parentNode) lampH.parentNode.insertBefore(lampBtn, lampH.nextSibling);

    stage = document.createElement('section');
    stage.id = 'slideStage';
    stage.className = 'slide-stage';
    stage.hidden = true;
    stage.setAttribute('aria-label', 'Listening room slideshow');
    stage.innerHTML = [
      '<div class="slide-h">',
      '<span class="slide-cap" id="slideCap" aria-live="polite"></span>',
      '<button type="button" class="slide-btn" id="slideNext">Next room</button>',
      '<button type="button" class="slide-btn" id="slideReset" hidden>Reset lamp</button>',
      '</div>',
      '<p class="slide-hint" id="slideHint">The picture changes on its own. Drag the lamp to move it, the lower handle to resize it, the top handle to turn it, and the side handle to tilt it onto a table, shelf, or floor. The layout stays after a refresh.</p>',
      '<div class="slide-frame" id="slideFrame">',
      '<div class="slide-bg" id="slideBgA"></div>',
      '<div class="slide-bg on" id="slideBgB"></div>',
      '<div class="slide-lamp" id="slideLampWrap" tabindex="0" role="group" aria-label="Lava lamp. Drag to move. Arrow keys nudge it. Plus and minus change the size. Brackets turn it. Comma and period tilt it.">',
      '<canvas id="slideLamp" aria-hidden="true"></canvas>',
      '<button type="button" class="slide-hnd r" data-hnd="rot" aria-label="Turn the lamp"></button>',
      '<button type="button" class="slide-hnd t" data-hnd="tilt" aria-label="Tilt the lamp"></button>',
      '<button type="button" class="slide-hnd s" data-hnd="size" aria-label="Resize the lamp"></button>',
      '</div></div>'
    ].join('');
    cap = stage.querySelector('#slideCap');
    resetBtn = stage.querySelector('#slideReset');
    frame = stage.querySelector('#slideFrame');
    wrap = stage.querySelector('#slideLampWrap');
    cv = stage.querySelector('#slideLamp');
    bgs = [stage.querySelector('#slideBgA'), stage.querySelector('#slideBgB')];
    front = 1;
    place();

    stage.querySelector('#slideNext').addEventListener('click', function () {
      show(index + 1, true);
      arm();
    });
    resetBtn.addEventListener('click', function () {
      var sc = scene();
      if (!sc) return;
      delete custom[sc.id];
      applyScenePose(true);
      writeSaved();
    });

    wrap.addEventListener('pointerdown', onDown);
    wrap.addEventListener('pointermove', onMove);
    wrap.addEventListener('pointerup', onUp);
    wrap.addEventListener('pointercancel', onUp);
    wrap.addEventListener('keydown', onKey);
    document.addEventListener('otr-mode', function () { place(); if (on) ensureLoop(); });
    window.__otr = window.__otr || {};
    window.__otr.slideshow = api;
  }

  function onDown(e) {
    if (stream || !on) return;
    var h = e.target.getAttribute && e.target.getAttribute('data-hnd');
    if (!h) {
      if (e.target === cv || e.target === wrap) h = 'move';
      else return;
    }
    e.preventDefault();
    drag = {
      h: h, id: e.pointerId, x: e.clientX, y: e.clientY,
      p: poseFor(scene()), box: frame.getBoundingClientRect()
    };
    wrap.classList.remove('glide');
    try { wrap.setPointerCapture(e.pointerId); } catch (err) {}
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var b = drag.box;
    if (!b.width || !b.height) return;
    var dx = (e.clientX - drag.x) / b.width;
    var dy = (e.clientY - drag.y) / b.height;
    var p = copy(drag.p);
    if (drag.h === 'move') {
      p.x = clamp(drag.p.x + dx, 0.05, 0.95);
      p.y = clamp(drag.p.y + dy, 0.22, 0.98);
    } else if (drag.h === 'size') {
      p.s = clamp(drag.p.s + (e.clientY - drag.y) / b.height, 0.16, 0.64);
    } else if (drag.h === 'rot') {
      var rect = wrap.getBoundingClientRect();
      var ang = Math.atan2(e.clientX - (rect.left + rect.width / 2), (rect.bottom) - e.clientY);
      p.rot = clamp(ang * 180 / Math.PI, -36, 36);
    } else if (drag.h === 'tilt') {
      p.tilt = clamp(drag.p.tilt - dy * 90, 0, 38);
      p.skew = clamp(drag.p.skew + dx * 36, -18, 18);
    }
    paintPose(p, false);
    drag.live = p;
  }
  function onUp(e) {
    if (!drag || (e && e.pointerId != null && e.pointerId !== drag.id)) return;
    var sc = scene();
    var p = drag.live || poseFor(sc);
    drag = null;
    if (sc && !stream) {
      custom[sc.id] = copy(p);
      paintPose(custom[sc.id], false);
      writeSaved();
    }
  }
  function onKey(e) {
    if (stream) return;
    var p = poseFor(scene()), step = e.shiftKey ? 0.04 : 0.02, n = null;
    if (e.key === 'ArrowLeft') n = { x: clamp(p.x - step, 0.05, 0.95) };
    else if (e.key === 'ArrowRight') n = { x: clamp(p.x + step, 0.05, 0.95) };
    else if (e.key === 'ArrowUp') n = { y: clamp(p.y - step, 0.22, 0.98) };
    else if (e.key === 'ArrowDown') n = { y: clamp(p.y + step, 0.22, 0.98) };
    else if (e.key === '+' || e.key === '=') n = { s: clamp(p.s + 0.03, 0.16, 0.64) };
    else if (e.key === '-' || e.key === '_') n = { s: clamp(p.s - 0.03, 0.16, 0.64) };
    else if (e.key === '[') n = { rot: clamp(p.rot - 4, -36, 36) };
    else if (e.key === ']') n = { rot: clamp(p.rot + 4, -36, 36) };
    else if (e.key === ',') n = { tilt: clamp(p.tilt - 3, 0, 38) };
    else if (e.key === '.') n = { tilt: clamp(p.tilt + 3, 0, 38) };
    else return;
    e.preventDefault();
    var next = copy(p);
    Object.keys(n).forEach(function (k) { next[k] = n[k]; });
    var sc = scene();
    if (sc) custom[sc.id] = next;
    paintPose(next, false);
    writeSaved();
  }

  function civilToday(tz) {
    var fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz || 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit'
    });
    var g = {};
    fmt.formatToParts(new Date()).forEach(function (p) { if (p.type !== 'literal') g[p.type] = p.value; });
    return g.year + '-' + g.month + '-' + g.day;
  }
  function askedDate() {
    var m = /[?&]sceneDate=(\d{4}-\d{2}-\d{2})/.exec(location.search || '');
    return m ? m[1] : '';
  }
  function seasonFor(data, dateKey) {
    var list = (data && data.seasons) || [];
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (!s || !s.from || !s.to) continue;
      var d = dateKey || civilToday(s.tz || 'America/Los_Angeles');
      if (d >= s.from && d <= s.to) return { season: s, date: d };
    }
    return null;
  }
  function probe(src) {
    var u = url(src);
    return fetch(u, { method: 'HEAD', cache: 'no-cache' }).then(function (r) {
      if (r.ok) return true;
      if (r.status !== 405 && r.status !== 501) return false;
      return fetch(u, { headers: { Range: 'bytes=0-0' }, cache: 'no-cache' }).then(function (g) {
        return g.ok;
      }, function () { return false; });
    }, function () { return false; });
  }
  function finishBoot(list) {
    scenes = list;
    var fade = reduce ? 0 : (pack.fadeMs || 1400);
    if (bgs && bgs[0]) {
      bgs[0].style.transitionDuration = fade + 'ms';
      bgs[1].style.transitionDuration = fade + 'ms';
    }
    if (index >= scenes.length) index = 0;
    var flag = qsFlag();
    if (flag === 'stream') {
      stream = true;
      custom = {};
      if (stage) stage.classList.add('is-stream');
      setOn(true);
    } else if (flag === 'on' || readOn()) {
      setOn(true);
    }
    slidesReady = true;
    window.__otr = window.__otr || {};
    window.__otr.slideshow = api;
  }
  function boot(data) {
    pack = data || {};
    var base = (pack.scenes || []).filter(function (s) { return s && s.src && s.lamp; });
    var hit = seasonFor(pack, askedDate());
    seasonInfo = {
      id: hit ? hit.season.id : null,
      active: !!hit,
      art: 0,
      fallback: true,
      date: hit ? hit.date : (askedDate() || civilToday('America/Los_Angeles'))
    };
    if (!hit) {
      finishBoot(base);
      return;
    }
    var specs = (hit.season.scenes || []).filter(function (s) { return s && s.src && s.lamp; });
    Promise.all(specs.map(function (s) {
      return probe(s.src).then(function (ok) { return ok ? s : null; });
    })).then(function (rows) {
      var extra = rows.filter(Boolean);
      seasonInfo.art = extra.length;
      seasonInfo.fallback = extra.length === 0;
      // Year-round rooms stay first, so a missing set does not change the opener.
      finishBoot(base.concat(extra));
    });
  }

  var api = {
    ready: function () { return slidesReady; },
    season: function () {
      return {
        id: seasonInfo.id, active: !!seasonInfo.active, art: seasonInfo.art,
        fallback: !!seasonInfo.fallback, date: seasonInfo.date
      };
    },
    on: function (v) { if (v == null) return on; return setOn(!!v); },
    stream: function () { return stream; },
    scenes: function () { return scenes.map(function (s) { return s.id; }); },
    current: function () {
      var sc = scene();
      if (!sc) return null;
      return { id: sc.id, name: sc.name, src: url(sc.src), index: index };
    },
    go: function (i) { show(i, false); arm(); return api.current(); },
    next: function () { show(index + 1, true); arm(); return api.current(); },
    pose: function () { return poseFor(scene()); },
    defaults: function () {
      return scenes.map(function (s) {
        var lamp = copy(s.lamp);
        lamp.id = s.id;
        return lamp;
      });
    },
    setPose: function (p) {
      var sc = scene();
      if (!sc || stream) return api.pose();
      var base = poseFor(sc);
      ['x', 'y', 's', 'rot', 'tilt', 'skew'].forEach(function (k) { if (p && p[k] != null) base[k] = +p[k]; });
      custom[sc.id] = base;
      paintPose(base, false);
      writeSaved();
      return copy(base);
    },
    reset: function () {
      var sc = scene();
      if (sc) delete custom[sc.id];
      applyScenePose(false);
      writeSaved();
      return api.pose();
    },
    saved: function () { return JSON.parse(JSON.stringify(custom)); }
  };

  function start() {
    if (!$('console') && !$('otr-basic')) return;
    readSaved();
    build();
    fetch(ROOT + 'scenes.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('scenes ' + r.status);
      return r.json();
    }).then(boot).catch(function (e) {
      if (cap) cap.textContent = 'Rooms did not load';
      window.__otr = window.__otr || {};
      window.__otr.slideshow = api;
      api.error = String(e && e.message || e);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
