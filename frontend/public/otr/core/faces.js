/* Radio faces for the OTR player. A face is only a look and a set of controls: it reads player.state
 * and calls player methods (radio-player.js), so faces can be swapped while a show keeps playing.
 *
 *   OTRFaces.register({ id, name, blurb, sources:['otr'], size:{w,h}, build(root, ctx) -> { update(), destroy() } })
 *   ctx = { player, core, scale() -> current CSS scale of the face, toast(msg) }
 *
 * Each face is drawn at a fixed design size and scaled to fit by the host page, so the same face
 * works on a phone, in a desktop pop-out window and on a 7 inch Pi screen (800x480 or 1280x720).
 * Both designs here are originals in the spirit of their eras, not copies of any real set.
 *
 * Loaded as window.OTRFaces.
 */
(function(){
  'use strict';
  var FACES = [], DEFAULTS = { otr:'tabletop' };
  var REDUCED = (function(){ try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();

  function el(tag, cls, html){ var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]; }); }

  // ---------------------------------------------------------------------------------------------
  // Shared parts
  // ---------------------------------------------------------------------------------------------

  // A slide-rule dial: a long strip of the AM band moving behind a fixed needle in the middle of a
  // window. Drag it to tune; tap a station name to jump there.
  function DialBand(win, ctx, opt){
    var B = window.OTRCore.BAND, pad = opt.pad || 200, k = opt.pxPerK, W = opt.width;
    var strip = el('div', 'band-strip');
    strip.style.width = ((B.max - B.min) * k + pad * 2) + 'px';
    strip.style.setProperty('--tick', (10 * k) + 'px');
    strip.style.setProperty('--pad', pad + 'px');
    var nums = [550, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600];
    nums.forEach(function(f){
      var n = el('span', 'band-num', String(f / 10)); n.style.left = (pad + (f - B.min) * k) + 'px'; strip.appendChild(n);
    });
    var labels = {};
    ctx.core.dial.forEach(function(st){
      var s = el('button', 'band-st', esc(st.name)); s.type = 'button'; s.tabIndex = -1;
      s.style.left = (pad + (st.freq - B.min) * k) + 'px'; s.dataset.id = st.id;
      s.setAttribute('aria-label', st.name + ', ' + (st.freq) + ' kilocycles');
      strip.appendChild(s); labels[st.id] = s;
    });
    var needle = el('div', 'band-needle');
    win.appendChild(strip); win.appendChild(needle);

    var drag = null;
    win.addEventListener('pointerdown', function(e){
      drag = { x:e.clientX, f:ctx.player.state.freq, moved:false, target:e.target, id:e.pointerId };
      try { win.setPointerCapture(e.pointerId); } catch (x) {}
    });
    win.addEventListener('pointermove', function(e){
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) < 5) return;
      if (!drag.moved) { drag.moved = true; ctx.player.beginTune(); }
      ctx.player.setFreq(drag.f - dx / (k * ctx.scale()));
    });
    function up(e){
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag; drag = null;
      if (d.moved) { ctx.player.endTune(); return; }
      var t = d.target && d.target.closest ? d.target.closest('.band-st') : null;
      if (t) ctx.player.jump(t.dataset.id);
    }
    win.addEventListener('pointerup', up); win.addEventListener('pointercancel', up);

    var lastLock = null;
    return {
      update:function(){
        var f = ctx.player.state.freq;
        strip.style.transform = 'translateX(' + (W / 2 - (pad + (f - B.min) * k)).toFixed(1) + 'px)';
        var near = ctx.core.nearest(f), lock = near && near.distance < 9 ? near.station.id : null;
        if (lock !== lastLock) {
          if (lastLock && labels[lastLock]) labels[lastLock].classList.remove('lock');
          if (lock && labels[lock]) labels[lock].classList.add('lock');
          lastLock = lock;
        }
      }
    };
  }

  // A rotary knob. kind 'tune' turns the dial (one turn is about four stations); kind 'volume' turns
  // 0..1 over 270 degrees. Arrow keys work on both; on the tuning knob they hop station to station.
  function Knob(knob, ctx, kind){
    var B = window.OTRCore.BAND, P = ctx.player, KPD = 0.7;   // kHz per degree on the tuning knob
    knob.setAttribute('role', 'slider'); knob.tabIndex = 0;
    var drag = null;
    function angleOf(e){ var r = knob.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI; }
    knob.addEventListener('pointerdown', function(e){
      e.preventDefault();
      if (kind === 'volume' && !P.canSetVolume) { ctx.toast('Use the volume buttons on your phone.'); return; }
      drag = { a:angleOf(e), id:e.pointerId, moved:false };
      try { knob.setPointerCapture(e.pointerId); } catch (x) {}
    });
    knob.addEventListener('pointermove', function(e){
      if (!drag || e.pointerId !== drag.id) return;
      var a = angleOf(e), d = a - drag.a; if (d > 180) d -= 360; if (d < -180) d += 360;
      if (!drag.moved && Math.abs(d) < 3) return;
      drag.a = a;
      if (kind === 'tune') { if (!drag.moved) P.beginTune(); P.setFreq(P.state.freq + d * KPD); }
      else P.setVolume(P.state.volume + d / 270);
      drag.moved = true;
    });
    function up(e){ if (!drag || e.pointerId !== drag.id) return; var d = drag; drag = null; if (kind === 'tune' && d.moved) P.endTune(); }
    knob.addEventListener('pointerup', up); knob.addEventListener('pointercancel', up);
    knob.addEventListener('keydown', function(e){
      var dir = (e.key === 'ArrowRight' || e.key === 'ArrowUp') ? 1 : (e.key === 'ArrowLeft' || e.key === 'ArrowDown') ? -1 : 0;
      if (!dir) return; e.preventDefault();
      if (kind === 'tune') P.step(dir);
      else if (P.canSetVolume) P.setVolume(P.state.volume + dir * 0.05);
      else ctx.toast('Use the volume buttons on your phone.');
    });
    return {
      update:function(){
        var s = P.state, deg;
        if (kind === 'tune') {
          deg = (s.freq - B.min) / KPD;
          var near = ctx.core.nearest(s.freq), st = near && near.station;
          knob.setAttribute('aria-label', 'Tuning'); knob.setAttribute('aria-valuemin', B.min); knob.setAttribute('aria-valuemax', B.max);
          knob.setAttribute('aria-valuenow', Math.round(s.freq)); knob.setAttribute('aria-valuetext', st ? st.name + ', ' + st.freq + ' kilocycles' : Math.round(s.freq) + ' kilocycles');
        } else {
          deg = -135 + s.volume * 270;
          knob.setAttribute('aria-label', 'Volume'); knob.setAttribute('aria-valuemin', 0); knob.setAttribute('aria-valuemax', 100);
          knob.setAttribute('aria-valuenow', Math.round(s.volume * 100)); knob.setAttribute('aria-valuetext', P.canSetVolume ? Math.round(s.volume * 100) + ' percent' : 'Set with the phone volume buttons');
        }
        knob.style.setProperty('--rot', deg.toFixed(1) + 'deg');
      }
    };
  }

  // A thumbwheel on the edge of a portable: drag up or down. Same jobs as Knob.
  function Wheel(wheel, ctx, kind){
    var B = window.OTRCore.BAND, P = ctx.player, KPP = 1.6;   // kHz per design pixel
    wheel.setAttribute('role', 'slider'); wheel.tabIndex = 0;
    var drag = null;
    wheel.addEventListener('pointerdown', function(e){
      e.preventDefault();
      if (kind === 'volume' && !P.canSetVolume) { ctx.toast('Use the volume buttons on your phone.'); return; }
      drag = { y:e.clientY, id:e.pointerId, moved:false };
      try { wheel.setPointerCapture(e.pointerId); } catch (x) {}
    });
    wheel.addEventListener('pointermove', function(e){
      if (!drag || e.pointerId !== drag.id) return;
      var dy = (drag.y - e.clientY) / ctx.scale();
      if (!drag.moved && Math.abs(dy) < 3) return;
      drag.y = e.clientY;
      if (kind === 'tune') { if (!drag.moved) P.beginTune(); P.setFreq(P.state.freq + dy * KPP); }
      else P.setVolume(P.state.volume + dy / 160);
      drag.moved = true;
    });
    function up(e){ if (!drag || e.pointerId !== drag.id) return; var d = drag; drag = null; if (kind === 'tune' && d.moved) P.endTune(); }
    wheel.addEventListener('pointerup', up); wheel.addEventListener('pointercancel', up);
    wheel.addEventListener('keydown', function(e){
      var dir = (e.key === 'ArrowUp' || e.key === 'ArrowRight') ? 1 : (e.key === 'ArrowDown' || e.key === 'ArrowLeft') ? -1 : 0;
      if (!dir) return; e.preventDefault();
      if (kind === 'tune') P.step(dir); else if (P.canSetVolume) P.setVolume(P.state.volume + dir * 0.05); else ctx.toast('Use the volume buttons on your phone.');
    });
    return {
      update:function(){
        var s = P.state, pos = kind === 'tune' ? (s.freq - B.min) / KPP : s.volume * 160;
        wheel.style.setProperty('--roll', (-pos).toFixed(1) + 'px');
        var near = ctx.core.nearest(s.freq), st = near && near.station;
        wheel.setAttribute('aria-label', kind === 'tune' ? 'Tuning' : 'Volume');
        wheel.setAttribute('aria-valuetext', kind === 'tune' ? (st ? st.name + ', ' + st.freq + ' kilocycles' : '') : (P.canSetVolume ? Math.round(s.volume * 100) + ' percent' : 'Set with the phone volume buttons'));
      }
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Tabletop tube set (the default for old time radio)
  // ---------------------------------------------------------------------------------------------
  // The All American Five lineup: converter, IF amp, detector, output, rectifier.
  var TUBES = [ { t:'12SA7', h:96, w:30 }, { t:'12SK7', h:96, w:30 }, { t:'12SQ7', h:84, w:30 }, { t:'50L6', h:110, w:36 }, { t:'35Z5', h:98, w:32 } ];
  function tubeSVG(){
    var W = 292, H = 150, gap = (W - TUBES.reduce(function(a, t){ return a + t.w; }, 0)) / (TUBES.length + 1), x = gap, out = [];
    out.push('<svg class="tt-tubes" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">');
    out.push('<defs><radialGradient id="ttGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd27a"/><stop offset=".35" stop-color="#ff8c2a" stop-opacity=".95"/><stop offset="1" stop-color="#ff5a14" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="ttGlass" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".22" stop-color="#fff" stop-opacity=".05"/><stop offset=".7" stop-color="#fff" stop-opacity=".02"/><stop offset=".86" stop-color="#fff" stop-opacity=".14"/><stop offset="1" stop-color="#fff" stop-opacity=".04"/></linearGradient>' +
      '<linearGradient id="ttPlate" x1="0" x2="1"><stop offset="0" stop-color="#2a2622"/><stop offset=".5" stop-color="#5b544c"/><stop offset="1" stop-color="#26221f"/></linearGradient>' +
      '<linearGradient id="ttChassis" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6d665d"/><stop offset="1" stop-color="#2c2824"/></linearGradient></defs>');
    out.push('<rect class="tt-chassis" x="0" y="' + (H - 16) + '" width="' + W + '" height="16" fill="url(#ttChassis)"/>');
    out.push('<ellipse class="tt-spill" cx="' + W / 2 + '" cy="' + (H - 14) + '" rx="' + (W * 0.48) + '" ry="10" fill="url(#ttGlow)"/>');
    TUBES.forEach(function(t, i){
      var cx = x + t.w / 2, top = H - 16 - t.h, base = H - 16, gy = base - 22;
      out.push('<g class="tt-tube" style="--i:' + i + '">');
      out.push('<rect x="' + (cx - t.w / 2 + 3) + '" y="' + (base - 12) + '" width="' + (t.w - 6) + '" height="12" rx="2" fill="#1b1410"/>');
      out.push('<path d="M' + (cx - t.w / 2) + ' ' + (base - 12) + ' V' + (top + t.w / 2) + ' a' + t.w / 2 + ' ' + t.w / 2.2 + ' 0 0 1 ' + t.w + ' 0 V' + (base - 12) + ' Z" fill="#160f0b" fill-opacity=".55" stroke="#c9b99c" stroke-opacity=".28" stroke-width="1"/>');
      out.push('<rect x="' + (cx - t.w * 0.28) + '" y="' + (top + t.w * 0.55) + '" width="' + (t.w * 0.56) + '" height="' + (t.h - t.w * 0.55 - 22) + '" fill="url(#ttPlate)"/>');
      out.push('<rect x="' + (cx - t.w * 0.34) + '" y="' + (top + t.w * 0.5) + '" width="' + (t.w * 0.68) + '" height="3" fill="#8d8478" opacity=".7"/>');
      out.push('<ellipse class="tt-heat" cx="' + cx + '" cy="' + gy + '" rx="' + (t.w * 0.55) + '" ry="' + (t.h * 0.28) + '" fill="url(#ttGlow)"/>');
      out.push('<rect class="tt-fil" x="' + (cx - 1.2) + '" y="' + (gy - 10) + '" width="2.4" height="20" rx="1" fill="#ffcf6a"/>');
      out.push('<path d="M' + (cx - t.w / 2) + ' ' + (base - 12) + ' V' + (top + t.w / 2) + ' a' + t.w / 2 + ' ' + t.w / 2.2 + ' 0 0 1 ' + t.w + ' 0 V' + (base - 12) + ' Z" fill="url(#ttGlass)"/>');
      out.push('<path d="M' + (cx - 2) + ' ' + (top + 2) + ' q2 -7 4 0" fill="#c9b99c" opacity=".35"/>');
      out.push('<text x="' + cx + '" y="' + (top + t.w * 0.55 + 14) + '" class="tt-type">' + t.t + '</text>');
      out.push('</g>');
      x += t.w + gap;
    });
    out.push('</svg>');
    return out.join('');
  }

  var TABLETOP = {
    id:'tabletop', name:'Tabletop', blurb:'A walnut tube set with the tubes showing', sources:['otr'], size:{ w:360, h:600 },
    build:function(root, ctx){
      var P = ctx.player;
      var face = el('div', 'face tt');
      face.innerHTML =
        '<div class="tt-cab">' +
          '<div class="tt-arch"><div class="tt-chassis-view">' + tubeSVG() + '<div class="tt-sheen"></div></div></div>' +
          '<div class="tt-dial"><div class="band-win tt-band"></div></div>' +
          '<div class="tt-grille"><div class="tt-cloth"></div><div class="tt-frets"><i></i><i></i><i></i><i></i></div>' +
            '<div class="tt-eye" title="Tuning eye: it closes when a station is tuned in"><i></i></div>' +
            '<div class="tt-badge">DXEdge</div></div>' +
          '<div class="tt-controls">' +
            '<div class="tt-ctl"><div class="knob tt-knob" data-k="vol"><i></i></div><span>Volume</span></div>' +
            '<div class="tt-ctl"><button type="button" class="tt-lamp" aria-pressed="false"><i></i></button><span>Power</span></div>' +
            '<div class="tt-ctl"><div class="knob tt-knob" data-k="tune"><i></i></div><span>Tuning</span></div>' +
          '</div>' +
        '</div><div class="tt-feet"><i></i><i></i></div>';
      root.appendChild(face);
      var band = DialBand(face.querySelector('.tt-band'), ctx, { pxPerK:1.35, width:300, pad:220 });
      var vol = Knob(face.querySelector('[data-k=vol]'), ctx, 'volume');
      var tune = Knob(face.querySelector('[data-k=tune]'), ctx, 'tune');
      var lamp = face.querySelector('.tt-lamp'), eye = face.querySelector('.tt-eye');
      lamp.addEventListener('click', function(){ P.togglePower(); });
      function update(){
        var s = P.state;
        face.dataset.power = s.power ? 'on' : 'off';
        lamp.setAttribute('aria-pressed', s.power ? 'true' : 'false');
        lamp.setAttribute('aria-label', s.power ? 'Turn the radio off' : 'Turn the radio on');
        band.update(); vol.update(); tune.update();
        var near = ctx.core.nearest(s.freq), d = near ? near.distance : 60;
        var open = s.power ? (s.tuning ? Math.min(1, d / 30) : (s.status === 'onair' ? 0.06 : 0.35)) : 1;
        eye.style.setProperty('--open', open.toFixed(3));
      }
      P.on('change', update); P.on('freq', update);
      update();
      return { update:update, destroy:function(){ P.off('change', update); P.off('freq', update); face.remove(); } };
    }
  };

  // ---------------------------------------------------------------------------------------------
  // Leather-cased portable (a six transistor set in a stitched case)
  // ---------------------------------------------------------------------------------------------
  var PORTABLE = {
    id:'portable', name:'Portable', blurb:'A leather-cased transistor set', sources:['otr'], size:{ w:340, h:548 },
    build:function(root, ctx){
      var P = ctx.player;
      var face = el('div', 'face pt');
      face.innerHTML =
        '<div class="pt-strap"><i></i></div>' +
        '<div class="pt-wheel pt-vol" data-k="vol"><i></i></div>' +
        '<div class="pt-case">' +
          '<div class="pt-top"><div class="pt-plate">' +
            '<div class="band-win pt-band"></div>' +
            '<div class="pt-name"><b>DXEdge</b><span>Six transistor</span></div>' +
          '</div></div>' +
          '<div class="pt-mouth"><div class="pt-grille"></div><div class="pt-logo">Broadcast band</div></div>' +
          '<div class="pt-foot"><button type="button" class="pt-switch" aria-pressed="false"><span class="pt-slot"><i></i></span><span class="pt-sw-label">Off</span></button>' +
            '<div class="pt-meter" aria-hidden="true"><i></i></div></div>' +
        '</div>' +
        '<div class="pt-wheel pt-tune" data-k="tune"><i></i></div>';
      root.appendChild(face);
      var band = DialBand(face.querySelector('.pt-band'), ctx, { pxPerK:1.1, width:236, pad:200 });
      var vol = Wheel(face.querySelector('[data-k=vol]'), ctx, 'volume');
      var tune = Wheel(face.querySelector('[data-k=tune]'), ctx, 'tune');
      var sw = face.querySelector('.pt-switch'), lab = face.querySelector('.pt-sw-label'), meter = face.querySelector('.pt-meter');
      sw.addEventListener('click', function(){ P.togglePower(); });
      function update(){
        var s = P.state;
        face.dataset.power = s.power ? 'on' : 'off';
        sw.setAttribute('aria-pressed', s.power ? 'true' : 'false');
        sw.setAttribute('aria-label', s.power ? 'Turn the radio off' : 'Turn the radio on');
        lab.textContent = s.power ? 'On' : 'Off';
        band.update(); vol.update(); tune.update();
        var near = ctx.core.nearest(s.freq), d = near ? near.distance : 60;
        var level = !s.power ? 0 : s.tuning ? Math.max(0, 1 - d / 25) : (s.status === 'onair' ? 0.92 : 0.35);
        meter.style.setProperty('--lvl', level.toFixed(3));
      }
      P.on('change', update); P.on('freq', update);
      update();
      return { update:update, destroy:function(){ P.off('change', update); P.off('freq', update); face.remove(); } };
    }
  };

  // ---------------------------------------------------------------------------------------------
  // Styles (injected once, so any host page can use the faces)
  // ---------------------------------------------------------------------------------------------
  var CSS = [
    '.face{position:relative;touch-action:none;user-select:none;-webkit-user-select:none;font-family:Futura,"Futura PT","Avenir Next","Century Gothic","Gill Sans",sans-serif}',
    '.face :focus-visible{outline:2px solid #ffd894;outline-offset:3px}',
    /* dial band, shared */
    '.band-win{position:relative;overflow:hidden;cursor:ew-resize;touch-action:none}',
    '.band-strip{position:absolute;left:0;top:0;bottom:0;will-change:transform;background-repeat:no-repeat}',
    '.band-num{position:absolute;transform:translateX(-50%);font-size:12px;letter-spacing:.04em;pointer-events:none}',
    '.band-num::before{content:"";position:absolute;left:50%;width:1px;height:7px;background:currentColor}',
    '.band-st{position:absolute;transform:translateX(-50%);font:inherit;font-size:12px;background:none;border:0;padding:4px 3px;margin:0;cursor:pointer;white-space:nowrap;color:inherit;transition:color .25s,text-shadow .25s}',
    '.band-needle{position:absolute;left:50%;top:4px;bottom:4px;width:2px;margin-left:-1px;pointer-events:none}',

    /* ---------------- tabletop ---------------- */
    '.tt{width:360px;height:600px}',
    '.tt-cab{position:absolute;inset:0 0 18px 0;border-radius:180px 180px 22px 22px;padding:18px 22px 0;',
      'background:radial-gradient(120% 60% at 30% 12%,rgba(255,214,160,.16),transparent 60%),',
      'repeating-linear-gradient(92deg,rgba(0,0,0,.0) 0 7px,rgba(0,0,0,.09) 7px 9px,rgba(255,220,180,.04) 9px 13px),',
      'linear-gradient(180deg,#6a3d22,#4e2b17 55%,#3b2011);',
      'box-shadow:inset 0 2px 0 rgba(255,220,180,.22),inset 0 -6px 14px rgba(0,0,0,.45),inset 0 0 0 3px #2e180c,0 30px 60px rgba(0,0,0,.55),0 8px 18px rgba(0,0,0,.4)}',
    '.tt-arch{height:186px;border-radius:156px 156px 10px 10px;padding:10px;background:linear-gradient(#2d180c,#4a2814);box-shadow:inset 0 2px 6px rgba(0,0,0,.7),0 1px 0 rgba(255,220,180,.18)}',
    '.tt-chassis-view{position:relative;height:100%;border-radius:146px 146px 6px 6px;overflow:hidden;background:radial-gradient(90% 70% at 50% 100%,#2b211a,#0c0806 70%);display:flex;align-items:flex-end;justify-content:center}',
    '.tt-tubes{width:292px;height:150px;display:block}',
    '.tt-type{font:600 6.5px Futura,"Avenir Next",sans-serif;fill:#e8dcc4;opacity:.42;text-anchor:middle;letter-spacing:.04em}',
    '.tt-heat,.tt-spill{opacity:0;transition:opacity 2.4s cubic-bezier(.5,0,.8,1)}',
    '.tt-fil{opacity:.12;transition:opacity 1.2s ease-in}',
    '.tt[data-power=on] .tt-heat{opacity:.95}',
    '.tt[data-power=on] .tt-spill{opacity:.55}',
    '.tt[data-power=on] .tt-fil{opacity:1}',
    '.tt[data-power=on] .tt-tube:nth-child(3n) .tt-heat{animation:ttFlicker 3.7s infinite steps(1)}',
    '.tt[data-power=on] .tt-tube:nth-child(4n) .tt-heat{animation:ttFlicker 5.3s infinite steps(1)}',
    '@keyframes ttFlicker{0%,100%{opacity:.95}43%{opacity:.86}44%{opacity:.97}71%{opacity:.9}}',
    '.tt-sheen{position:absolute;inset:0;background:linear-gradient(115deg,rgba(255,255,255,.10),rgba(255,255,255,0) 30%,rgba(255,255,255,0) 70%,rgba(255,255,255,.05));pointer-events:none}',
    '.tt-dial{margin:14px 2px 0;height:72px;border-radius:10px;padding:5px;background:linear-gradient(#c9a25a,#7a5a26);box-shadow:inset 0 1px 0 rgba(255,240,200,.6),0 2px 4px rgba(0,0,0,.5)}',
    '.tt-band{width:300px;height:62px;margin:0 auto;border-radius:6px;color:#3a2414;',
      'background:linear-gradient(180deg,#8c7149,#6a5434);box-shadow:inset 0 2px 8px rgba(0,0,0,.6);transition:background 1.4s ease-in}',
    '.tt[data-power=on] .tt-band{background:radial-gradient(70% 120% at 50% 50%,#ffe0a3,#f2b65e 55%,#d48d33);box-shadow:inset 0 2px 8px rgba(80,30,0,.45),0 0 18px rgba(255,170,70,.35)}',
    '.tt-band .band-strip{background-image:repeating-linear-gradient(90deg,rgba(58,36,20,.55) 0 1px,transparent 1px var(--tick));background-size:calc(100% - 2*var(--pad)) 6px;background-position:var(--pad) 0}',
    '.tt-band .band-num{top:8px}',
    '.tt-band .band-num::before{top:-8px}',
    '.tt-band .band-st{top:28px;color:rgba(58,36,20,.78)}',
    '.tt-band .band-st.lock{color:#7a1e0c;text-shadow:0 0 6px rgba(255,240,200,.9)}',
    '.tt[data-power=off] .tt-band .band-st.lock{text-shadow:none}',
    '.tt-band .band-needle{background:#c0301c;box-shadow:0 0 3px rgba(192,48,28,.6)}',
    '.tt-band::after{content:"";position:absolute;inset:0;border-radius:6px;background:linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,0) 40%);pointer-events:none}',
    '.tt-grille{position:relative;margin:14px 2px 0;height:150px;border-radius:8px;overflow:hidden;box-shadow:inset 0 2px 8px rgba(0,0,0,.6),0 1px 0 rgba(255,220,180,.15)}',
    '.tt-cloth{position:absolute;inset:0;background:',
      'repeating-linear-gradient(0deg,rgba(60,40,20,.22) 0 1px,transparent 1px 3px),',
      'repeating-linear-gradient(90deg,rgba(60,40,20,.18) 0 1px,transparent 1px 3px),',
      'linear-gradient(180deg,#b29a72,#8f7650)}',
    '.tt-frets{position:absolute;inset:0;display:flex;justify-content:space-evenly}',
    '.tt-frets i{width:12px;background:linear-gradient(90deg,#3b2011,#6a3d22 45%,#4a2814);box-shadow:2px 0 6px rgba(0,0,0,.45)}',
    '.tt-eye{position:absolute;left:50%;top:18px;width:46px;height:46px;margin-left:-23px;border-radius:50%;background:#0d1a10;box-shadow:0 0 0 4px #2b2b2b,0 0 0 6px #8a8a8a,0 3px 8px rgba(0,0,0,.6)}',
    '.tt-eye i{position:absolute;inset:5px;border-radius:50%;opacity:.15;transition:opacity 1.8s ease-in;',
      'background:conic-gradient(from calc(180deg - var(--open,1)*55deg),#0d1a10 0 calc(var(--open,1)*110deg),#5dff9c calc(var(--open,1)*110deg) 360deg);',
      '-webkit-mask:radial-gradient(circle,transparent 0 6px,#000 7px);mask:radial-gradient(circle,transparent 0 6px,#000 7px)}',
    '.tt[data-power=on] .tt-eye i{opacity:.92;filter:drop-shadow(0 0 4px rgba(93,255,156,.6))}',
    '.tt-badge{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);padding:3px 12px 4px;border-radius:12px;font:italic 600 17px "Snell Roundhand","Brush Script MT","Apple Chancery",cursive,serif;color:#3a2414;',
      'background:linear-gradient(#e7cc8a,#b48a40);box-shadow:inset 0 1px 0 rgba(255,250,220,.8),0 2px 4px rgba(0,0,0,.5);letter-spacing:.02em}',
    '.tt-controls{display:flex;justify-content:space-between;align-items:flex-start;margin:16px 6px 0}',
    '.tt-ctl{display:flex;flex-direction:column;align-items:center;gap:6px}',
    '.tt-ctl span{font-size:11px;font-style:italic;color:#e7cc8a;opacity:.75;letter-spacing:.04em}',
    '.tt-knob{width:74px;height:74px;border-radius:50%;cursor:grab;touch-action:none;',
      'background:radial-gradient(circle at 35% 30%,#6b4a36,#2a1810 60%,#160c07);box-shadow:0 6px 10px rgba(0,0,0,.55),inset 0 1px 1px rgba(255,220,180,.25)}',
    '.tt-knob i{position:absolute;inset:7px;border-radius:50%;transform:rotate(var(--rot,0deg));',
      'background:radial-gradient(circle,#3a2418 0 52%,transparent 53%),repeating-conic-gradient(#3a2418 0 6deg,#22140c 6deg 12deg)}',
    '.tt-knob i::after{content:"";position:absolute;left:50%;top:6px;width:4px;height:13px;margin-left:-2px;border-radius:2px;background:#e7cc8a;opacity:.85}',
    '.knob{position:relative}',
    '.knob:active{cursor:grabbing}',
    '.tt-lamp{width:40px;height:40px;margin-top:16px;border-radius:50%;border:0;padding:0;cursor:pointer;background:radial-gradient(circle at 40% 35%,#d9c08a,#8a6a30 70%);box-shadow:0 3px 6px rgba(0,0,0,.5)}',
    '.tt-lamp i{display:block;margin:7px;width:26px;height:26px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#7a3a2a,#3b120a);transition:background .6s,box-shadow .6s}',
    '.tt[data-power=on] .tt-lamp i{background:radial-gradient(circle at 40% 35%,#ffd0a0,#ff5a2a 55%,#a3200a);box-shadow:0 0 14px rgba(255,100,40,.75)}',
    '.tt-feet{position:absolute;left:0;right:0;bottom:2px;display:flex;justify-content:space-between;padding:0 46px}',
    '.tt-feet i{width:54px;height:18px;border-radius:0 0 8px 8px;background:linear-gradient(#2e180c,#1a0d06)}',

    /* ---------------- portable ---------------- */
    '.pt{width:340px;height:548px}',
    '.pt-case{position:absolute;left:20px;right:20px;top:34px;bottom:8px;border-radius:30px;padding:18px 18px 0;',
      'background:radial-gradient(120% 70% at 25% 10%,rgba(255,200,160,.18),transparent 55%),',
      'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27140%27 height=%27140%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%27.9%27 numOctaves=%272%27/%3E%3CfeColorMatrix values=%270 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .55 0%27/%3E%3C/filter%3E%3Crect width=%27140%27 height=%27140%27 filter=%27url(%23n)%27/%3E%3C/svg%3E"),',
      'linear-gradient(160deg,#8a3b22,#6a2716 55%,#4c1a0e);',
      'box-shadow:inset 0 0 0 6px rgba(0,0,0,.08),inset 0 2px 0 rgba(255,210,180,.25),inset 0 -8px 18px rgba(0,0,0,.4),0 30px 60px rgba(0,0,0,.55),0 8px 18px rgba(0,0,0,.4)}',
    '.pt-case::before{content:"";position:absolute;inset:9px;border-radius:23px;border:1.5px dashed rgba(240,200,160,.55);pointer-events:none}',
    '.pt-strap{position:absolute;left:44px;top:0;width:70px;height:46px}',
    '.pt-strap i{position:absolute;inset:0;border-radius:35px 35px 0 0;border:7px solid #5a2012;border-bottom:0;box-shadow:inset 0 2px 0 rgba(255,210,180,.2)}',
    '.pt-top{border-radius:14px;padding:6px;background:linear-gradient(#3a140a,#2a0d06);box-shadow:inset 0 2px 5px rgba(0,0,0,.7)}',
    '.pt-plate{border-radius:9px;padding:8px 8px 6px;background:linear-gradient(180deg,#eef0f2,#b9bdc2 45%,#e3e6e9 55%,#9ea3a9);box-shadow:inset 0 1px 0 #fff,inset 0 -1px 0 rgba(0,0,0,.25)}',
    '.pt-band{width:236px;height:54px;margin:0 auto;border-radius:5px;color:#1f1f1f;background:linear-gradient(#f4ecd8,#e2d6b8);box-shadow:inset 0 1px 4px rgba(0,0,0,.45)}',
    '.pt-band .band-strip{background-image:repeating-linear-gradient(90deg,rgba(30,30,30,.55) 0 1px,transparent 1px var(--tick));background-size:calc(100% - 2*var(--pad)) 5px;background-position:var(--pad) 0}',
    '.pt-band .band-num{top:6px;font-size:11px}',
    '.pt-band .band-num::before{top:-6px;height:5px}',
    '.pt-band .band-st{top:24px;font-size:11px;color:#5a5249}',
    '.pt-band .band-st.lock{color:#b3261a;font-weight:600}',
    '.pt-band .band-needle{background:#c8261a}',
    '.pt-name{display:flex;justify-content:space-between;align-items:baseline;padding:6px 4px 0;color:#3b3f44}',
    '.pt-name b{font:italic 700 17px "Avenir Next","Futura",sans-serif;letter-spacing:.01em}',
    '.pt-name span{font-size:10px;letter-spacing:.08em}',
    '.pt-mouth{position:relative;margin:18px auto 0;width:226px;height:262px;border-radius:113px;padding:10px;background:linear-gradient(#3a140a,#2a0d06);box-shadow:inset 0 3px 8px rgba(0,0,0,.75)}',
    '.pt-grille{width:100%;height:100%;border-radius:103px;',
      'background:radial-gradient(circle,#1d1f22 0 2.2px,transparent 2.6px) 0 0/9px 9px,radial-gradient(circle,#1d1f22 0 2.2px,transparent 2.6px) 4.5px 4.5px/9px 9px,',
      'linear-gradient(160deg,#f1f3f5,#a9aeb4 50%,#dfe2e5 60%,#8f959b);box-shadow:inset 0 2px 4px rgba(0,0,0,.35)}',
    '.pt-logo{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);padding:2px 10px;border-radius:3px;font-size:10px;letter-spacing:.08em;color:#e9e3d6;background:#2a2a2a;box-shadow:0 1px 2px rgba(0,0,0,.5)}',
    '.pt-foot{display:flex;justify-content:space-between;align-items:center;margin:16px 6px 0}',
    '.pt-switch{display:flex;align-items:center;gap:8px;background:none;border:0;padding:4px;cursor:pointer;font:inherit;color:#f1d9c0}',
    '.pt-slot{position:relative;width:46px;height:20px;border-radius:10px;background:#1d0904;box-shadow:inset 0 2px 4px rgba(0,0,0,.8)}',
    '.pt-slot i{position:absolute;top:2px;left:2px;width:22px;height:16px;border-radius:8px;background:linear-gradient(#f1f3f5,#9ea3a9);transition:left .18s}',
    '.pt[data-power=on] .pt-slot i{left:22px}',
    '.pt-sw-label{font-size:12px;letter-spacing:.06em;min-width:2em;text-align:left}',
    '.pt-meter{position:relative;width:62px;height:30px;border-radius:5px;overflow:hidden;background:linear-gradient(#f4ecd8,#e2d6b8);box-shadow:inset 0 1px 4px rgba(0,0,0,.6),0 0 0 3px #2a0d06}',
    '.pt-meter i{position:absolute;left:50%;bottom:-6px;width:2px;height:32px;margin-left:-1px;background:#c8261a;transform-origin:50% 100%;transform:rotate(calc(-50deg + var(--lvl,0)*100deg));transition:transform .4s cubic-bezier(.3,1.4,.6,1)}',
    '.pt-wheel{position:absolute;width:22px;height:96px;border-radius:9px;overflow:hidden;cursor:ns-resize;touch-action:none;',
      'background:linear-gradient(90deg,#55585c,#d9dce0 40%,#f3f4f5 52%,#8f949a);box-shadow:0 3px 6px rgba(0,0,0,.5)}',
    '.pt-wheel i{position:absolute;inset:0;background:repeating-linear-gradient(180deg,rgba(0,0,0,.42) 0 2px,transparent 2px 6px);background-position:0 var(--roll,0px)}',
    '.pt-tune{right:6px;top:92px}',
    '.pt-vol{left:6px;top:92px}',
    '.pt-wheel:focus-visible{outline:2px solid #ffd894;outline-offset:2px}',
    '@media (prefers-reduced-motion:reduce){.tt-heat,.tt-spill,.tt-fil,.tt-band,.tt-eye i{transition-duration:.2s!important;animation:none!important}.pt-meter i{transition:none}}'
  ].join('\n');

  function injectCSS(){ if (document.getElementById('otr-faces-css')) return; var s = el('style'); s.id = 'otr-faces-css'; s.textContent = CSS; document.head.appendChild(s); }

  function register(f){ FACES.push(f); }
  register(TABLETOP); register(PORTABLE);

  window.OTRFaces = {
    register:register,
    list:function(source){ return FACES.filter(function(f){ return !source || f.sources.indexOf(source) >= 0; }); },
    get:function(id){ for (var i = 0; i < FACES.length; i++) if (FACES[i].id === id) return FACES[i]; return null; },
    defaultFor:function(source){ return DEFAULTS[source] || FACES[0].id; },
    injectCSS:injectCSS, reducedMotion:REDUCED
  };
})();
