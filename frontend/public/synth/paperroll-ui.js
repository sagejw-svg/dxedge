// The paper roll strip: the step editor, the scheduler on the rack transport, and the roll drawn on a
// canvas as punched paper moving past a reader. The pattern schema and the plan are in paperroll.js.
//
// The roll plays when the rack transport plays and its run switch is on (play on the strip turns run
// on and starts the transport from the top). Notes go to the device lit on the rail, or to one device
// picked on the strip, stamped with their AudioContext frame (150 ms lookahead, a 25 ms timer, the same
// idea as the library player). A note's off is kept until it comes inside the lookahead, so a tempo
// change moves it too. Nothing here touches a device's audio path: notes arrive the way the library
// player's do.

import {
  ROLL_KEY, ROLL_STEPS, ROLL_RATES, ROLL_RATE_NAMES, ROLL_RANGE, ROLL_FACTORY,
  normalizeRoll, rollPlan, rollScore, stepBeat, noteName,
} from './paperroll.js';
import { voiceForNote } from './drums.js';

const LOOK = 0.15, TICK = 25, FLARE = 0.15, LATE = 0.06;
const $ = id => document.getElementById(id);
const clone = o => JSON.parse(JSON.stringify(o));
const mod = (a, b) => ((a % b) + b) % b;

export function createRoll(api) {
  const saved = api.store.get(ROLL_KEY, null) || {};
  let pat = normalizeRoll(saved.pat || ROLL_FACTORY[1]);
  let dest = typeof saved.dest === 'string' ? saved.dest : 'lit';
  let run = saved.run === true;          // off until the strip's play (or run) turns it on, so a library song never brings the roll in by surprise
  let edited = !!saved.edited;
  let sel = 0, keyIn = false, open = false;
  // the scheduler
  let playing = false, timer = 0, anchor = null, pendingTempo = null, k = 0, cov = 0, schedBeat = 0, unsub = null;
  const pend = [];                    // notes on, waiting for their off: { n, dev, offBeat, onTime }
  // Offs already sent to Filament or Cathode for a later frame. A stop's flush drops them from the
  // worklet's queue with the strikes, so letGo sends them again now (review R1108-1: a note that had
  // struck and whose off was still queued stayed on after stop).
  const queuedOffs = [];              // { n, dev, at, entry: its log entry }
  const armed = new Set(), woken = new Set();
  const flares = [];                  // { time, n } of notes struck, for the reader lamp
  const log = [];                     // delivered messages, for the test hook
  let drawMs = 0, dirty = true, winLo = 36, winN = 25, skipped = 0;

  function save() { api.store.set(ROLL_KEY, { pat, dest, run, edited }); }

  // ------------------------------------------------------------ delivery (the library player's paths)
  function targets() {
    const list = (api.devices ? api.devices() : []).filter(d => d && d.instrument && d.midiInput);
    return [{ id: 'lit', name: 'lit device' }].concat(list.map(d => ({ id: d.id, name: d.name || d.id })));
  }
  function destDev() {
    if (dest !== 'lit') return dest;
    return api.dev();
  }
  function arm(d) {
    if (armed.has(d)) return;
    const E = api.engine(); if (!E) return;
    armed.add(d);
    if (d === 'filament' || d === 'cathode') {
      if (d !== api.dev()) { const p = api.patchOf(d); if (p) E.setPatch(p, true); }
      E.playing(d, true);
    } else if (d !== 'dekatron' && api.wakeDevice) { api.wakeDevice(d); woken.add(d); }
  }
  function send(d, msg, at, want, entry) {
    const E = api.engine(), c = api.ctx();
    if (!E || !c) return;
    const framed = Object.assign({}, msg, { at: Math.round(at * c.sampleRate), pb: true });
    if (d === 'dekatron') {
      if (msg.t === 'on') {
        const voice = voiceForNote(msg.n), node = E.nodes.dekatron;
        if (voice && node && node.port) node.port.postMessage({ t: 'trig', voice, v: msg.v == null ? 0.9 : msg.v, at: framed.at });
      }
    } else if (d === 'filament' || d === 'cathode') E.sendTo(d, framed);
    else if (E.devices[d]) E.devices[d].midi(framed);
    // a resent off (after a stop's flush) moves its first entry to the time it now goes, so the log keeps one off per strike
    if (entry) { entry.at = at; entry.resent = true; return entry; }
    const e = { t: msg.t, n: msg.n, v: msg.v, dev: d, at, want: want == null ? at : want, now: c.currentTime };
    log.push(e);
    if (log.length > 600) log.splice(0, log.length - 600);
    return e;
  }
  // The transport stopped: Filament and Cathode drop what is still queued (the library player does the
  // same on the same stop), then every note the roll holds goes off now. Another device gets its off
  // just after its own strike, in case that strike is still queued.
  function letGo() {
    const E = api.engine(), c = api.ctx(), now = c ? c.currentTime : 0;
    if (E) armed.forEach(d => { if (d === 'filament' || d === 'cathode') E.sendTo(d, { t: 'flush' }); });
    queuedOffs.forEach(x => { if (x.at > now) send(x.dev, { t: 'off', n: x.n }, now, null, x.entry); });
    queuedOffs.length = 0;
    pend.forEach(x => send(x.dev, { t: 'off', n: x.n }, (x.dev === 'filament' || x.dev === 'cathode') ? now : Math.max(now, x.onTime + 0.002)));
    pend.length = 0;
    if (E) armed.forEach(d => {
      if ((d === 'filament' || d === 'cathode') && !(api.busy && api.busy(d))) E.playing(d, false);
    });
    armed.clear();
    if (api.sleepDevice) woken.forEach(d => api.sleepDevice(d));
    woken.clear();
  }

  // ------------------------------------------------------------ the scheduler
  function beatNow() {
    const c = api.ctx();
    if (!anchor || !c) return 0;
    return anchor.beat + (c.currentTime - anchor.time) / (60 / anchor.tempo);
  }
  // the step under the reader now (the scheduler itself runs up to 150 ms ahead of it)
  function curStep() { return mod(Math.floor(Math.max(0, beatNow()) / ROLL_RATES[pat.rate] + 1e-9), pat.len); }
  function timeAt(b) { return anchor.time + (b - anchor.beat) * (60 / anchor.tempo); }
  function firstStep(b) {
    const sb = ROLL_RATES[pat.rate];
    let j = Math.max(0, Math.ceil(b / sb - 1e-9) - 1);
    while (stepBeat(pat, j) < b - 1e-9) j++;
    return j;
  }
  function flushOffs(upTo) {
    for (let j = 0; j < pend.length;) {
      const x = pend[j];
      if (x.offBeat <= upTo + 1e-9) {
        const at = Math.max(timeAt(x.offBeat) + x.late, x.onTime + 0.001);
        const entry = send(x.dev, { t: 'off', n: x.n }, at);
        if (x.dev === 'filament' || x.dev === 'cathode') queuedOffs.push({ n: x.n, dev: x.dev, at, entry });
        pend.splice(j, 1);
      } else j++;
    }
  }
  function pump() {
    if (!playing || !anchor) return;
    const c = api.ctx(); if (!c) return;
    if (pendingTempo != null) {
      anchor = { time: timeAt(schedBeat), beat: schedBeat, tempo: pendingTempo };
      pendingTempo = null;
    }
    const horizon = beatNow() + LOOK / (60 / anchor.tempo);
    if (run) {
      let guard = 0;
      while (stepBeat(pat, k) <= horizon && guard++ < 256) {
        const b = stepBeat(pat, k);
        flushOffs(b);
        const r = rollPlan(pat, k, k + 1, cov); cov = r.cov;
        r.notes.forEach(x => {
          const d = destDev(); if (!d) return;
          arm(d);
          // A step the timer reached late (a starved page) plays now and keeps its length; one more than
          // 60 ms late is dropped, so a stall never comes out as a burst of notes.
          const want = timeAt(x.on), t = Math.max(c.currentTime, want);
          if (t - want > LATE) { skipped++; log.push({ t: 'skip', n: x.n, dev: d, at: t, want, now: c.currentTime }); return; }
          send(d, { t: 'on', n: x.n, v: x.v }, t, want);
          pend.push({ n: x.n, dev: d, offBeat: x.off, onTime: t, late: t - want });
          flares.push({ time: t, n: x.n, i: x.i });
          if (flares.length > 32) flares.shift();
        });
        schedBeat = b;
        k++;
      }
    }
    flushOffs(horizon);
    { const now = c.currentTime; for (let j = queuedOffs.length - 1; j >= 0; j--) if (queuedOffs[j].at < now - 0.05) queuedOffs.splice(j, 1); }
    paintStat();
  }
  function startFrom(ev) {
    letGo();
    anchor = { time: ev.time, beat: ev.beat, tempo: ev.tempo };
    k = firstStep(ev.beat); cov = k; schedBeat = ev.beat; pendingTempo = null;
    playing = true;
    clearInterval(timer); timer = setInterval(pump, TICK);
    pump(); paintButtons(); dirty = true;
  }
  function halt() {
    playing = false; clearInterval(timer); timer = 0; anchor = null;
    letGo(); paintButtons(); paintStat(); dirty = true;
  }
  function onTransport(ev) {
    if (ev.type === 'play') startFrom(ev);
    else if (ev.type === 'stop') halt();
    else if (ev.type === 'tempo') { if (playing) pendingTempo = ev.tempo; paintStat(); }
  }
  function bind() {
    const E = api.engine(); if (!E || unsub) return;
    unsub = E.transport.subscribe(onTransport);
  }
  // A rate change (or a length change) under a running roll picks the step grid up again from the
  // last beat it scheduled, so the next step lands on the new grid rather than jumping back.
  function regrid() {
    if (!playing || !anchor) return;
    k = firstStep(schedBeat + 1e-6); cov = k;
  }
  // Run off under a playing transport stops new strikes; the notes already struck end on time.
  function setRun(on) {
    run = !!on; save();
    paintButtons(); paintStat(); dirty = true;
  }

  // ------------------------------------------------------------ editing
  function changed(rate) { edited = true; save(); if (rate) regrid(); paintAll(); }
  function step() { return pat.steps[sel]; }
  function setSel(i) { sel = mod(i, pat.len); paintEdit(); dirty = true; }
  function nudge(dn) { const s = step(); s.n = Math.max(0, Math.min(127, s.n + dn)); s.g = 1; changed(); }
  function toggle(f) {
    const s = step(); s[f] = s[f] ? 0 : 1;
    if (f !== 'g' && f !== 't' && s[f]) s.g = 1;   // an accent or a slide needs a hole to mean anything
    changed();
  }
  function setLen(n) { pat.len = Math.max(1, Math.min(ROLL_STEPS, n)); if (sel >= pat.len) sel = pat.len - 1; changed(true); }
  function load(p) {
    pat = normalizeRoll(clone(p)); edited = false; sel = Math.min(sel, pat.len - 1);
    save(); regrid(); paintAll();
  }
  function keyNote(n) {
    if (!keyIn || !open || n < 0 || n > 127) return false;
    const s = step(); s.n = n; s.g = 1; s.t = 0;
    sel = mod(sel + 1, pat.len);
    changed();
    return true;
  }

  // ------------------------------------------------------------ the strip
  function paintButtons() {
    $('rollRun').setAttribute('aria-pressed', String(run));
    $('rollPlay').setAttribute('aria-pressed', String(playing && run));
  }
  function paintStat() {
    const t = targets().find(x => x.id === dest);
    const who = dest === 'lit' ? 'lit device' : (t ? t.name : dest);
    const a = pat.name + (edited ? ' *' : '') + ' · ' + pat.len + ' × ' + ROLL_RATE_NAMES[pat.rate] + ' · ' + who;
    const b = playing && run ? 'step ' + (curStep() + 1) + '/' + pat.len : '';
    if ($('rollStat').textContent !== a) $('rollStat').textContent = a;
    if ($('rollPos').textContent !== b) $('rollPos').textContent = b;
  }
  function paintEdit() {
    const s = step();
    $('rollStep').textContent = 'step ' + (sel + 1) + '/' + pat.len + ' · ' + noteName(s.n + pat.tr);
    [['rollG', 'g'], ['rollA', 'a'], ['rollS', 's'], ['rollT', 't']].forEach(([id, f]) => $(id).setAttribute('aria-pressed', String(!!s[f])));
    $('rollKey').setAttribute('aria-pressed', String(keyIn));
    $('rollLenV').textContent = pat.len;
    document.querySelectorAll('#rollRates .chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === pat.rate)));
    [['rollGate', 'gate', v => Math.round(v * 100) + '%'], ['rollSwing', 'swing', v => Math.round(v * 100) + '%'],
     ['rollVel', 'vel', v => Math.round(v * 100) + '%'], ['rollAcc', 'acc', v => Math.round(v * 100) + '%'],
     ['rollTr', 'tr', v => (v > 0 ? '+' : '') + v]].forEach(([id, f, fmt]) => {
      const el = $(id); const v = pat[f];
      el.value = String(f === 'tr' ? v : Math.round(v * 100));
      $(id + 'V').textContent = fmt(v);
      el.setAttribute('aria-valuetext', fmt(v));
    });
    const sl = $('rollPick'); const fi = ROLL_FACTORY.findIndex(f => f.name === pat.name);
    sl.value = fi >= 0 ? String(fi) : '';
  }
  function paintDest() {
    const box = $('rollDest'); box.querySelectorAll('.chip').forEach(b => b.remove());
    targets().forEach(t => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip';
      b.textContent = t.name; b.dataset.target = t.id;
      b.setAttribute('aria-pressed', String(dest === t.id));
      b.setAttribute('aria-label', 'The roll plays ' + (t.id === 'lit' ? 'the device lit on the rail' : t.name));
      b.addEventListener('click', () => {
        if (t.id === dest) return;
        dest = t.id; save(); paintDest(); paintStat();
      });
      box.appendChild(b);
    });
  }
  function paintAll() { paintButtons(); paintStat(); paintEdit(); dirty = true; }
  function openBody(on) {
    open = !!on; $('rollBody').hidden = !open; $('rollBtn').setAttribute('aria-expanded', String(open));
    // Key in only while the strip is open: closed, the keys would rewrite steps nobody can see (review R1108-2).
    if (!open && keyIn) { keyIn = false; paintEdit(); }
    if (open) { paintDest(); paintEdit(); dirty = true; }
  }

  function userPlay() {
    api.wake();
    if (!run) setRun(true);
    api.withEngine(() => {
      bind();
      const t = api.engine().transport;
      if (t.state().playing) t.stop();
      t.locate(0);
      t.play();
    });
  }
  function userStop() { api.withEngine(() => { api.engine().transport.stop(); }); }

  // the pattern list
  const pick = $('rollPick');
  const blank = document.createElement('option'); blank.value = ''; blank.textContent = 'Rolls…'; pick.appendChild(blank);
  ROLL_FACTORY.forEach((f, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = f.name; pick.appendChild(o); });
  pick.addEventListener('change', () => { const i = pick.value; if (i !== '') load(ROLL_FACTORY[+i]); });
  // the rate chips
  const rates = $('rollRates');
  ['8', '8t', '16', '16t', '32'].forEach(r => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dataset.v = r; b.textContent = ROLL_RATE_NAMES[r];
    b.setAttribute('aria-label', 'Step length ' + ROLL_RATE_NAMES[r]);
    b.addEventListener('click', () => { pat.rate = r; changed(true); });
    rates.appendChild(b);
  });
  [['rollGate', 'gate', 0.01], ['rollSwing', 'swing', 0.01], ['rollVel', 'vel', 0.01], ['rollAcc', 'acc', 0.01], ['rollTr', 'tr', 1]].forEach(([id, f, k_]) => {
    const el = $(id), R = ROLL_RANGE[f];
    el.min = String(Math.round(R[0] / k_)); el.max = String(Math.round(R[1] / k_)); el.step = '1';
    el.addEventListener('input', () => { pat[f] = Math.max(R[0], Math.min(R[1], +el.value * k_)); changed(f === 'swing'); });
  });
  $('rollBtn').addEventListener('click', () => openBody(!open));
  $('rollRun').addEventListener('click', () => setRun(!run));
  $('rollPlay').addEventListener('click', userPlay);
  $('rollStop').addEventListener('click', userStop);
  $('rollPrev').addEventListener('click', () => setSel(sel - 1));
  $('rollNext').addEventListener('click', () => setSel(sel + 1));
  $('rollDn').addEventListener('click', () => nudge(-1));
  $('rollUp').addEventListener('click', () => nudge(1));
  $('rollOctDn').addEventListener('click', () => nudge(-12));
  $('rollOctUp').addEventListener('click', () => nudge(12));
  $('rollG').addEventListener('click', () => toggle('g'));
  $('rollA').addEventListener('click', () => toggle('a'));
  $('rollS').addEventListener('click', () => toggle('s'));
  $('rollT').addEventListener('click', () => toggle('t'));
  $('rollKey').addEventListener('click', () => { keyIn = !keyIn; paintEdit(); });
  $('rollLenDn').addEventListener('click', () => setLen(pat.len - 1));
  $('rollLenUp').addEventListener('click', () => setLen(pat.len + 1));
  $('rollClear').addEventListener('click', () => { pat.steps.forEach(s => { s.g = 0; s.a = 0; s.s = 0; s.t = 0; }); changed(); });

  // ------------------------------------------------------------ the roll on the canvas
  const cv = $('rollCv');
  let geo = null;
  function pos() {
    // paper position in steps: the transport's beat over the step length (swing does not move the paper)
    const E = api.engine();
    if (api.reduceMotion) return 0;
    const sb = ROLL_RATES[pat.rate];
    if (playing && anchor && run) return Math.max(0, beatNow()) / sb;
    const b = E ? E.transport.state().beat : 0;
    return Math.max(0, b) / sb;
  }
  function layout(W, H) {
    const x0 = Math.max(44, Math.min(120, W * 0.11));
    const sw = Math.max(16, Math.min(64, (W - x0 - 10) / ROLL_STEPS));
    return { W, H, x0, sw, py0: 6, py1: H - 6, ny0: 18, ny1: H - 27 };
  }
  // the steady state of the loop: which steps start a note, which are carried by a tie
  function cycle() {
    const L = pat.len;
    const a = rollPlan(pat, 0, L, 0), b = rollPlan(pat, L, 2 * L, a.cov);
    const head = new Array(L).fill(null), carry = new Array(L).fill(null);
    const all = a.notes.filter(x => x.k + x.len > L).concat(b.notes);
    all.forEach(x => {
      if (x.k >= L) head[x.k - L] = x;
      for (let j = 1; j < x.len; j++) { const kk = x.k + j; if (kk >= L && kk < 2 * L) carry[kk - L] = x; }
    });
    return { head, carry };
  }
  function pitchWindow() {
    let lo = 127, hi = 0;
    pat.steps.slice(0, pat.len).forEach(s => { if (s.g) { lo = Math.min(lo, s.n); hi = Math.max(hi, s.n); } });
    if (lo > hi) { lo = winLo; hi = winLo + 24; }
    if (lo < winLo || hi > winLo + winN - 1) {
      winLo = Math.floor(lo / 12) * 12;
      winN = Math.max(25, hi - winLo + 1);
    } else if (hi - lo <= 24 && winN > 25) winN = Math.max(25, hi - winLo + 1);
    return { lo: winLo, n: winN };
  }
  function draw(now) {
    if (!open || !cv.isConnected) return;
    const t0 = performance.now();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const G = geo = layout(W, H);
    const P = pos(), L = pat.len, win = pitchWindow(), cyc = cycle();
    const rowY = n => G.ny1 - (n - win.lo + 0.5) * (G.ny1 - G.ny0) / win.n;
    const rh = (G.ny1 - G.ny0) / win.n;
    const font = (getComputedStyle(document.body).getPropertyValue('--font-mono') || '').trim() || 'monospace';
    // chassis behind the paper
    g.fillStyle = '#0b0a09'; g.fillRect(0, 0, W, H);
    // the paper
    const pg = g.createLinearGradient(0, G.py0, 0, G.py1);
    pg.addColorStop(0, '#d9ccad'); pg.addColorStop(0.5, '#e8dcbd'); pg.addColorStop(1, '#cdbf9e');
    g.fillStyle = pg; g.fillRect(0, G.py0, W, G.py1 - G.py0);
    // columns: from the take-up spool at the left to the supply spool at the right
    const jFirst = Math.floor(P - G.x0 / G.sw) - 1, jLast = Math.ceil(P + (W - G.x0) / G.sw) + 1;
    g.font = '9px ' + font; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let j = jFirst; j <= jLast; j++) {
      const x = G.x0 + (j - P) * G.sw, i = mod(j, L);
      // printed rule, bar marks every 4 steps, the glue seam where the loop joins
      g.fillStyle = i === 0 ? 'rgba(90,60,30,0.38)' : (i % 4 === 0 ? 'rgba(90,60,30,0.2)' : 'rgba(90,60,30,0.08)');
      g.fillRect(x, G.py0, i === 0 ? 2 : 1, G.py1 - G.py0);
      if (i === 0) { g.fillStyle = 'rgba(120,90,50,0.10)'; g.fillRect(x - 3, G.py0, 6, G.py1 - G.py0); }
      g.fillStyle = 'rgba(70,45,20,0.75)';
      if (G.sw >= 18 || i % 2 === 0) g.fillText(String(i + 1), x + G.sw / 2, G.py1 - 8);
      // sprocket holes along both edges
      g.fillStyle = '#16120d';
      g.beginPath(); g.arc(x + G.sw / 2, G.py0 + 6, 2.2, 0, 7); g.fill();
    }
    // the edit cursor
    if (open) {
      for (let j = jFirst; j <= jLast; j++) {
        if (mod(j, L) !== sel) continue;
        const x = G.x0 + (j - P) * G.sw;
        g.strokeStyle = 'rgba(214,120,20,0.85)'; g.lineWidth = 1.5;
        g.strokeRect(x + 1.5, G.ny0 - 6, G.sw - 3, G.ny1 - G.ny0 + 10);
      }
    }
    // pitch rows: a faint line on each C
    for (let n = win.lo; n < win.lo + win.n; n++) {
      if (n % 12) continue;
      const y = rowY(n);
      g.fillStyle = 'rgba(90,60,30,0.12)'; g.fillRect(0, y, W, 1);
    }
    // holes, tie slots and slide channels
    const hr = Math.max(2.5, Math.min(G.sw * 0.26, 7, Math.max(3, rh * 1.4)));
    const hole = (x, y, r, acc) => {
      g.fillStyle = '#100c08'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,248,230,0.55)'; g.lineWidth = 1; g.beginPath(); g.arc(x + 0.5, y + 0.6, r, 0.1, 1.9); g.stroke();
      if (acc) { g.strokeStyle = 'rgba(120,40,20,0.7)'; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, r + 2.6, 0, 7); g.stroke(); }
    };
    for (let j = jFirst; j <= jLast; j++) {
      const i = mod(j, L), x = G.x0 + (j - P) * G.sw + G.sw / 2;
      const c = cyc.carry[i];
      if (c) {
        const y = rowY(c.n);
        g.fillStyle = '#100c08'; g.fillRect(x - G.sw, y - hr * 0.62, G.sw, hr * 1.24);
      }
      const h = cyc.head[i];
      if (h) {
        const y = rowY(h.n);
        hole(x, y, h.accent ? hr * 1.25 : hr, h.accent);
        if (h.slide) {
          const nx = cyc.head[mod(i + h.len, L)];
          if (nx) {
            const x2 = x + h.len * G.sw, x1 = x + (h.len - 1) * G.sw, y2 = rowY(nx.n);
            g.strokeStyle = '#100c08'; g.lineWidth = Math.max(2, hr * 0.7); g.lineCap = 'round';
            g.beginPath(); g.moveTo(x1, y); g.lineTo(x2, y2); g.stroke();
          }
        }
      }
    }
    // the spools: the read paper winds onto the left, fresh paper comes off the right
    const lg = g.createLinearGradient(0, 0, G.x0 * 0.7, 0);
    lg.addColorStop(0, 'rgba(8,6,4,0.92)'); lg.addColorStop(1, 'rgba(8,6,4,0)');
    g.fillStyle = lg; g.fillRect(0, G.py0, G.x0 * 0.7, G.py1 - G.py0);
    g.fillStyle = 'rgba(30,20,10,0.10)'; g.fillRect(0, G.py0, G.x0, G.py1 - G.py0);
    const rg = g.createLinearGradient(W - 26, 0, W, 0);
    rg.addColorStop(0, 'rgba(8,6,4,0)'); rg.addColorStop(1, 'rgba(8,6,4,0.85)');
    g.fillStyle = rg; g.fillRect(W - 26, G.py0, 26, G.py1 - G.py0);
    // the C rows named on the take-up side, in the amber of the readouts
    g.fillStyle = 'rgba(255,190,110,0.75)'; g.textAlign = 'left';
    for (let n = win.lo; n < win.lo + win.n; n++) if (n % 12 === 0) g.fillText(noteName(n), 4, rowY(n));
    g.textAlign = 'center';
    // the reader: a brass bar with a lit slit; a hole under it lights the lamp
    const ctxT = api.ctx() ? api.ctx().currentTime : 0;
    let lamp = 0, lampN = null;
    flares.forEach(f => { const a = ctxT - f.time; if (a >= 0 && a < FLARE) { const v = 1 - a / FLARE; if (v > lamp) { lamp = v; lampN = f.n; } } });
    if (api.reduceMotion && playing && run) {
      // the paper holds still: the column being read is lit instead
      const i = curStep(), x = G.x0 + i * G.sw;
      g.fillStyle = 'rgba(255,170,60,0.22)'; g.fillRect(x, G.py0, G.sw, G.py1 - G.py0);
      lamp = playing ? 0.5 : 0;
    }
    const bg = g.createLinearGradient(G.x0 - 4, 0, G.x0 + 4, 0);
    bg.addColorStop(0, '#5b4520'); bg.addColorStop(0.45, '#d8b56a'); bg.addColorStop(1, '#6a5024');
    g.fillStyle = bg; g.fillRect(G.x0 - 3, 0, 6, H);
    g.fillStyle = 'rgba(255,190,90,' + (0.35 + 0.65 * lamp).toFixed(3) + ')';
    g.fillRect(G.x0 - 0.75, G.ny0 - 4, 1.5, G.ny1 - G.ny0 + 8);
    if (lamp > 0 && lampN != null && !api.reduceMotion) {
      const y = rowY(lampN), gl = g.createRadialGradient(G.x0, y, 0, G.x0, y, 16);
      gl.addColorStop(0, 'rgba(255,200,110,' + (0.9 * lamp).toFixed(3) + ')'); gl.addColorStop(1, 'rgba(255,160,60,0)');
      g.fillStyle = gl; g.fillRect(G.x0 - 16, y - 16, 32, 32);
    }
    g.fillStyle = 'rgba(255,190,90,' + (0.25 + 0.75 * lamp).toFixed(3) + ')';
    g.beginPath(); g.arc(G.x0, 3.5, 2.5, 0, 7); g.fill();
    stats.lamp = lamp; stats.pos = P; stats.drawn++;
    drawMs = performance.now() - t0;
    dirty = false;
  }
  const stats = { lamp: 0, pos: 0, drawn: 0 };
  function hitStep(ev) {
    const r = cv.getBoundingClientRect(); if (!geo) return null;
    const x = ev.clientX - r.left;
    if (x < geo.x0) return null;
    return mod(Math.floor((x - geo.x0) / geo.sw + pos()), pat.len);
  }
  cv.addEventListener('pointerdown', ev => {
    const i = hitStep(ev); if (i == null) return;
    if (i === sel) toggle('g'); else setSel(i);
  });
  cv.addEventListener('keydown', ev => {
    let used = true;
    if (ev.key === 'ArrowLeft') setSel(sel - 1);
    else if (ev.key === 'ArrowRight') setSel(sel + 1);
    else if (ev.key === 'ArrowUp') nudge(ev.shiftKey ? 12 : 1);
    else if (ev.key === 'ArrowDown') nudge(ev.shiftKey ? -12 : -1);
    else if (ev.key === 'Enter') toggle('g');
    else used = false;
    if (used) { ev.preventDefault(); ev.stopPropagation(); }
  });

  api.withEngine(bind);
  paintAll();

  const test = {
    state: () => ({ pat: clone(pat), dest, run, playing, k, sel, keyIn, edited, open, pend: pend.length, armed: [...armed], skipped }),
    set: p => load(p),
    edit: fn => { fn(pat); changed(true); return clone(pat); },
    factory: () => ROLL_FACTORY.map(clone),
    plan: (k0, k1) => rollPlan(pat, k0, k1, k0).notes,
    score: (steps, tempo, dev) => rollScore(pat, steps, tempo, dev),
    dest: id => { if (id != null) { dest = id; save(); paintDest(); paintStat(); } return dest; },
    choices: () => targets().map(t => t.id),
    run: on => { if (on != null) setRun(on); return run; },
    sel: i => { if (i != null) setSel(i); return sel; },
    keyIn: on => { if (on != null) { keyIn = !!on; paintEdit(); } return keyIn; },
    open: on => { if (on != null) openBody(on); return open; },
    log: () => log.slice(),
    clearLog: () => { log.length = 0; },
    play: userPlay, stop: userStop,
    draw: () => { draw(performance.now()); return { ms: drawMs, stats: Object.assign({}, stats) }; },
    stats: () => Object.assign({ ms: drawMs }, stats),
  };
  return {
    frame(now) { if (open && (dirty || playing)) draw(now); },
    keyIn: (n, v) => keyNote(n, v),
    test,
  };
}
