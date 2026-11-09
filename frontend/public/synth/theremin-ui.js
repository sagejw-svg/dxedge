// Theremin mode (0.3, 9 Nov): the pad (Filament's Pad tab on a phone; with the other sections on a desktop). Across is pitch, up is volume; one
// finger (or the mouse) plays one continuous note, and the magic eye on the chassis closes as the
// sounding pitch reaches a note (frame() in index.html reads eye()). The pad sends {t:'thm',on,p,a}
// to Filament's worklet, which holds one voice (note THN) at that pitch and level. Settings are the
// page's (localStorage THM_KEY), not the patch's. Our own code.

import { THM_KEY, THM_LOWS, THM_SPANS, THM_FLOOR, normalizeThm, padPitch, pitchX, padLevel, tuneOf, noteName } from './theremin.js';

const $ = id => document.getElementById(id);

export function createTheremin(api) {
  let st = normalizeThm(api.store.get(THM_KEY, null));
  let hold = null;                 // { id: pointer id or 'key', x, y } while the pad is played
  let lastSent = null, sent = 0, drawMs = 0, dirty = true, eyeT = 0, eyeSkew = 0;
  const cv = $('thmCv'), read = $('thmRead');

  function save() { api.store.set(THM_KEY, st); }
  function pitch() { return hold ? padPitch(hold.x, st) : null; }
  function level() { return hold ? padLevel(hold.y, st) : 0; }
  // one message to Filament: the pad's pitch and level, and whether it is held
  function send() {
    const m = { t: 'thm', on: !!hold, p: hold ? padPitch(hold.x, st) : (lastSent ? lastSent.p : 60), a: hold ? padLevel(hold.y, st) : 0 };
    lastSent = m; sent++;
    api.withEngine(() => api.engine().sendTo('filament', m));
  }
  function usable() { return api.dev() === 'filament' && !api.era(); }

  function start(id, x, y) {
    if (!usable()) return false;
    if (!st.on) setOn(true);
    api.wake();
    const fresh = !hold;
    hold = { id, x, y };
    send();
    if (fresh) api.flare(Math.max(0.3, level()));
    dirty = true; paintRead();
    return true;
  }
  function move(x, y) { if (!hold) return; hold.x = x; hold.y = y; send(); dirty = true; paintRead(); }
  function stop() { if (!hold) return; hold = null; send(); dirty = true; paintRead(); }

  function setOn(on) {
    st.on = !!on; save();
    if (!st.on) stop();
    const b = $('thmOnBtn'); b.setAttribute('aria-pressed', String(st.on)); b.textContent = st.on ? 'on' : 'off';
    $('thmPilot').classList.toggle('off', !st.on);
    $('mThm').classList.toggle('thm-on', st.on);
    dirty = true; paintRead();
  }
  function refreshChips() {
    document.querySelectorAll('#thmLow .chip').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.v === st.low)));
    document.querySelectorAll('#thmSpan .chip').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.v === st.span)));
  }
  function paintRead() {
    if (!read) return;
    if (api.era()) { read.innerHTML = '<span class="dim">resting: 1939 mode cannot slide a note</span>'; return; }
    if (!hold) { read.innerHTML = '<span class="dim">' + (st.on ? 'touch the pad: across is pitch, up is volume' : 'off: touch the pad to switch it on') + '</span>'; return; }
    const p = padPitch(hold.x, st), t = tuneOf(p), a = padLevel(hold.y, st);
    const c = Math.round(t.cents);
    read.textContent = t.name + ' ' + (c > 0 ? '+' : c < 0 ? '−' : '±') + Math.abs(c) + ' cents, ' + (a > 0 ? Math.round(20 * Math.log10(a)) + ' dB' : 'silent');
  }

  // ------------------------------------------------------------ the panel
  $('thmOnBtn').addEventListener('click', () => setOn(!st.on));
  THM_LOWS.forEach(n => { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dataset.v = n; b.textContent = noteName(n);
    b.title = 'The pad starts at ' + noteName(n) + ' on the left';
    b.addEventListener('click', () => { st.low = n; save(); refreshChips(); if (hold) send(); dirty = true; paintRead(); }); $('thmLow').appendChild(b); });
  THM_SPANS.forEach(n => { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dataset.v = n; b.textContent = n + ' oct';
    b.title = n + (n > 1 ? ' octaves' : ' octave') + ' across the pad (wider is harder to play in tune)';
    b.addEventListener('click', () => { st.span = n; save(); refreshChips(); if (hold) send(); dirty = true; paintRead(); }); $('thmSpan').appendChild(b); });
  api.makeKnob($('kThm'), { label: 'snap', min: 0, max: 1, step: 0.01, value: st.snap, def: 0, title: 'Snap: pulls the pitch toward the nearest note (0 is free, 100% steps by semitones)',
    fmt: v => Math.round(v * 100) + '%', onChange: v => { st.snap = v; save(); if (hold) send(); paintRead(); } }).el.setAttribute('aria-label', 'Theremin snap');
  api.makeKnob($('kThm'), { label: 'range', min: 12, max: 60, step: 1, value: st.depth, def: 36, title: 'Volume range: how many dB lie between the bottom of the pad and the top',
    fmt: v => Math.round(v) + 'dB', onChange: v => { st.depth = Math.round(v); save(); if (hold) send(); paintRead(); } }).el.setAttribute('aria-label', 'Theremin volume range');

  const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / Math.max(1, r.width), 1 - (e.clientY - r.top) / Math.max(1, r.height)]; };
  cv.addEventListener('pointerdown', e => {
    if (hold && hold.id !== e.pointerId && hold.id !== 'key') return;      // one note: a second finger is ignored
    e.preventDefault(); cv.focus({ preventScroll: true });
    const [x, y] = pos(e);
    if (start(e.pointerId, x, y)) { try { cv.setPointerCapture(e.pointerId); } catch (er) {} }
  });
  cv.addEventListener('pointermove', e => { if (!hold || hold.id !== e.pointerId) return; const [x, y] = pos(e); move(x, y); });
  const up = e => { if (hold && hold.id === e.pointerId) stop(); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('lostpointercapture', up);
  // keys: Enter starts and stops the tone; left and right move a semitone (Shift: 10 cents), up and down 5% of
  // the level; Escape stops. The pad keeps its last place for the next Enter.
  let keyPos = { x: pitchX(60, st), y: 0.75 };
  cv.addEventListener('keydown', e => {
    const k = e.key; let done = true;
    if (k === 'Enter') { if (hold) stop(); else start('key', keyPos.x, keyPos.y); }
    else if (k === 'Escape') { if (hold) stop(); else done = false; }
    else if (k === 'ArrowLeft' || k === 'ArrowRight') {
      const d = (k === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 0.1 : 1) / (st.span * 12);
      keyPos.x = Math.min(1, Math.max(0, (hold ? hold.x : keyPos.x) + d)); if (hold) move(keyPos.x, hold.y); else { dirty = true; }
    } else if (k === 'ArrowUp' || k === 'ArrowDown') {
      keyPos.y = Math.min(1, Math.max(0, (hold ? hold.y : keyPos.y) + (k === 'ArrowUp' ? 0.05 : -0.05))); if (hold) move(hold.x, keyPos.y); else { dirty = true; }
    } else done = false;
    if (done) { e.preventDefault(); e.stopPropagation(); }
  });
  cv.addEventListener('blur', () => { if (hold && hold.id === 'key') stop(); });

  // ------------------------------------------------------------ drawing (the page's 30 fps frame loop)
  function draw(now) {
    if (hold && !usable()) { stop(); paintRead(); }   // 1939 mode switched on, or the rail moved, while the pad was held
    if (!cv.offsetParent) return;
    const f = api.fitCanvas(cv); if (!f) return;
    const t0 = performance.now(), c = f.c, w = f.w, h = f.h, live = st.on && usable();
    c.clearRect(0, 0, w, h);
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, live ? '#141009' : '#0d0d0d'); g.addColorStop(1, '#070707');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    // the floor: the strip at the bottom that is silence
    const fy = h * (1 - THM_FLOOR);
    c.fillStyle = 'rgba(255,255,255,0.03)'; c.fillRect(0, fy, w, h - fy);
    // level lines every 6 dB of the range
    c.strokeStyle = 'rgba(255,179,71,0.07)'; c.lineWidth = 1;
    for (let d = 6; d < st.depth; d += 6) { const u = 1 - d / st.depth, y = h * (1 - (THM_FLOOR + u * (1 - THM_FLOOR))); c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(w, y + 0.5); c.stroke(); }
    // one line per semitone: a C bright and named, the other naturals dim, the sharps fainter
    const n0 = st.low, n1 = st.low + st.span * 12, px = w / (n1 - n0);
    const fs = Math.max(9, Math.min(12, h * 0.07));
    c.font = fs + 'px ' + getComputedStyle(document.body).fontFamily; c.textAlign = 'center'; c.textBaseline = 'top';
    for (let n = n0; n <= n1; n++) {
      const x = Math.round((n - n0) * px) + 0.5, pc = ((n % 12) + 12) % 12, sharp = [1, 3, 6, 8, 10].includes(pc);
      c.strokeStyle = pc === 0 ? 'rgba(255,179,71,0.42)' : sharp ? 'rgba(255,179,71,0.07)' : 'rgba(255,179,71,0.16)';
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, fy); c.stroke();
      if (pc === 0 || (px > 22 && !sharp)) { c.fillStyle = pc === 0 ? 'rgba(255,208,138,0.85)' : 'rgba(255,208,138,0.4)'; c.fillText(pc === 0 ? noteName(n) : noteName(n).replace(/-?\d+$/, ''), Math.min(w - 10, Math.max(10, x)), 3); }
    }
    // the antennas, drawn as two rods: pitch at the right edge, volume along the bottom
    c.fillStyle = live ? 'rgba(201,160,90,0.55)' : 'rgba(120,110,90,0.3)';
    c.fillRect(w - 3, 0, 3, fy); c.fillRect(0, h - 3, w, 3);
    if (hold) {
      const x = hold.x * w, y = (1 - hold.y) * h, a = padLevel(hold.y, st), p = padPitch(hold.x, st), sx = pitchX(p, st) * w;
      c.strokeStyle = 'rgba(255,179,71,0.35)'; c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(w, y + 0.5); c.stroke();
      c.strokeStyle = 'rgba(255,208,138,0.8)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(sx, 0); c.lineTo(sx, fy); c.stroke();
      const r = 10 + 18 * a, rg = c.createRadialGradient(x, y, 0, x, y, r * 2.2);
      rg.addColorStop(0, 'rgba(255,230,180,' + (0.55 + 0.45 * a).toFixed(3) + ')'); rg.addColorStop(0.35, 'rgba(255,150,60,' + (0.25 + 0.4 * a).toFixed(3) + ')'); rg.addColorStop(1, 'rgba(255,120,40,0)');
      c.fillStyle = rg; c.beginPath(); c.arc(x, y, r * 2.2, 0, Math.PI * 2); c.fill();
    } else if (live && document.activeElement === cv) {
      const x = keyPos.x * w, y = (1 - keyPos.y) * h;
      c.strokeStyle = 'rgba(255,179,71,0.6)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, 9, 0, Math.PI * 2); c.stroke();
    }
    if (!live) { c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, 0, w, h); }
    drawMs += (performance.now() - t0 - drawMs) * 0.1; dirty = false;
  }

  // The magic eye while the pad is held: how far the sounding pitch (the worklet's meter, smoothed as
  // it sounds) is from the nearest note. lv 1 is closed (on the note), 0 is wide open (50 cents off);
  // skew leans the shadow toward the sharp (+) or flat (-) side. null: the eye shows the level as before.
  function eye(meter, dt) {
    const th = meter && meter.thm;
    if (!st.on || !hold || !th || api.dev() !== 'filament') { eyeT = 0; eyeSkew = 0; return null; }
    const t = tuneOf(th.p + (th.bend || 0)), want = 1 - Math.min(1, Math.abs(t.cents) / 50), k = 1 - Math.exp(-dt / 0.04);
    eyeT += (want - eyeT) * k; eyeSkew += (Math.sign(t.cents) * Math.min(1, Math.abs(t.cents) / 50) - eyeSkew) * k;
    return { lv: eyeT, skew: eyeSkew, cents: t.cents, name: t.name };
  }

  // the device moved off Filament, the pedal page lost focus, Panic: let the note go
  function release() { if (hold) stop(); }
  function onDevice() { release(); dirty = true; paintRead(); $('mThm').classList.toggle('thm-on', st.on); }

  setOn(st.on); refreshChips(); paintRead();
  return {
    frame: draw, eye, release, onDevice, refresh: paintRead,
    test: {
      state: () => ({ ...st, held: !!hold, x: hold ? hold.x : null, y: hold ? hold.y : null, pitch: pitch(), level: level(), sent, last: lastSent, drawMs, eye: { lv: eyeT, skew: eyeSkew } }),
      press: (x, y) => start('test', x, y), move, release: stop, setOn,
      set: o => { st = normalizeThm(Object.assign({}, st, o)); save(); refreshChips(); setOn(st.on); },
      pitchAt: x => padPitch(x, st), levelAt: y => padLevel(y, st),
    },
  };
}
