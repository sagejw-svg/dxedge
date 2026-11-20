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
  ROLLS_KEY, ROLL_USER_MAX, CHAIN_MAX, CHAIN_REPS, rollName, isFactoryName, normalizeUserRolls, normalizeChain,
  resolveChainRoll, chainSegments, chainAt, segPlan, chainScore,
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
  // named user rolls (their own key) and the chain (song mode), 18 Nov
  let users = normalizeUserRolls(api.store.get(ROLLS_KEY, []));
  let chain = normalizeChain(saved.chain);
  let seg = null, j = 0;              // the chain segment being scheduled and its next local step
  const segQ = [];                    // segments scheduled, for the reader: { start, idx, pass, name, pat, steps }
  let heard = null;                   // the segment under the reader now
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

  function save() { api.store.set(ROLL_KEY, { pat, dest, run, edited, chain }); }
  function saveUsers() { api.store.set(ROLLS_KEY, users); }
  function chainOn() { return chain.on && chain.items.length > 0; }

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
    // the MIDI deck's recorder takes the note at the time it sounds (it keeps Filament and Cathode only)
    if (api.rec && (msg.t === 'on' || msg.t === 'off')) api.rec(d, msg, at);
    // the on-screen keys light as the note sounds and go out with its off (a resent off already has its own)
    if (!entry && (msg.t === 'on' || msg.t === 'off')) lightAt(msg.n, msg.t === 'on', at);
    // a resent off (after a stop's flush) moves its first entry to the time it now goes, so the log keeps one off per strike
    if (entry) { entry.at = at; entry.resent = true; return entry; }
    const e = { t: msg.t, n: msg.n, v: msg.v, dev: d, at, want: want == null ? at : want, now: c.currentTime };
    log.push(e);
    if (log.length > 600) log.splice(0, log.length - 600);
    return e;
  }
  // ------------------------------------------------------------ the on-screen keys (20 Nov)
  // A note the roll sends lights its key on the keybed at the time it sounds and lets it go at the time its
  // off does, the way the library player and the MIDI deck light theirs. Counted per pitch, so a pitch struck
  // twice before its first off (a slide into itself, a tie run's seam) goes out only with its last off.
  // Display only: the page asks lit(n) when it paints a key.
  const lit = new Map(), lightT = new Map();
  function lightAt(n, on, at) {
    const c = api.ctx(); if (!c || !api.lit) return;
    const id = setTimeout(() => {
      lightT.delete(id);
      const k = (lit.get(n) || 0) + (on ? 1 : -1);
      if (k > 0) lit.set(n, k); else lit.delete(n);
      api.lit(n);
    }, Math.max(0, (at - c.currentTime) * 1000));
    lightT.set(id, { n, on, at });
  }
  function unlightAll() {
    lightT.forEach((x, id) => clearTimeout(id)); lightT.clear();
    const ns = [...lit.keys()]; lit.clear();
    if (api.lit) ns.forEach(n => api.lit(n));
  }

  // The transport stopped: Filament and Cathode drop what is still queued (the library player does the
  // same on the same stop), then every note the roll holds goes off now. Another device gets its off
  // just after its own strike, in case that strike is still queued.
  function letGo() {
    const E = api.engine(), c = api.ctx(), now = c ? c.currentTime : 0;
    if (E) armed.forEach(d => { if (d === 'filament' || d === 'cathode') { E.sendTo(d, { t: 'flush' }); if (api.recFlush) api.recFlush(d, now); } });
    queuedOffs.forEach(x => { if (x.at > now) send(x.dev, { t: 'off', n: x.n }, now, null, x.entry); });
    queuedOffs.length = 0;
    pend.forEach(x => send(x.dev, { t: 'off', n: x.n }, (x.dev === 'filament' || x.dev === 'cathode') ? now : Math.max(now, x.onTime + 0.002)));
    pend.length = 0;
    unlightAll();   // what was queued no longer sounds, and every note the roll held is off now
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
  function curStep() {
    const lb = chainLocal();
    if (lb != null) return mod(Math.floor(lb / ROLL_RATES[heard.pat.rate] + 1e-9), heard.pat.len);
    return mod(Math.floor(Math.max(0, beatNow()) / ROLL_RATES[pat.rate] + 1e-9), pat.len);
  }
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
    if (run && chainOn()) pumpChain(horizon, c);
    else if (run) {
      let guard = 0;
      while (stepBeat(pat, k) <= horizon && guard++ < 256) {
        const b = stepBeat(pat, k);
        flushOffs(b);
        const r = rollPlan(pat, k, k + 1, cov); cov = r.cov;
        r.notes.forEach(x => strike(x, 0, c));
        schedBeat = b;
        k++;
      }
    }
    flushOffs(horizon);
    { const now = c.currentTime; for (let j = queuedOffs.length - 1; j >= 0; j--) if (queuedOffs[j].at < now - 0.05) queuedOffs.splice(j, 1); }
    paintStat();
  }
  // A note from the plan, struck `base` beats after the roll's (or the segment's) step 0.
  function strike(x, base, c, segIdx) {
    const d = destDev(); if (!d) return;
    arm(d);
    // A step the timer reached late (a starved page) plays now and keeps its length; one more than
    // 60 ms late is dropped, so a stall never comes out as a burst of notes.
    const want = timeAt(base + x.on), t = Math.max(c.currentTime, want);
    if (t - want > LATE) {
      skipped++;
      const sk = { t: 'skip', n: x.n, dev: d, at: t, want, now: c.currentTime };
      if (segIdx != null) sk.seg = segIdx;
      log.push(sk); return;
    }
    const e = send(d, { t: 'on', n: x.n, v: x.v }, t, want);
    if (e && segIdx != null) e.seg = segIdx;
    pend.push({ n: x.n, dev: d, offBeat: base + x.off, onTime: t, late: t - want });
    flares.push({ time: t, n: x.n, i: x.i });
    if (flares.length > 32) flares.shift();
  }

  // ------------------------------------------------------------ the chain (song mode, 18 Nov)
  // The chain plays its rolls one after another from the transport's beat 0, each `reps` times, and comes
  // round again. The segments are read again at every change of roll, so a roll saved under its name while
  // the chain plays is heard the next time its turn comes. Nothing crosses a segment's end (segPlan).
  function setSeg(sg, at) {
    seg = { idx: at.idx, pass: at.pass, start: at.start, name: sg.name, pat: clone(sg.pat), steps: sg.steps, beats: sg.beats };
    segQ.push({ start: seg.start, idx: seg.idx, pass: seg.pass, name: seg.name, pat: seg.pat, steps: seg.steps });
    if (segQ.length > 8) segQ.shift();
  }
  // the segment holding beat b, and its first local step at or after b
  function chainSeek(b) {
    seg = null; segQ.length = 0; heard = null;
    const segs = chainSegments(chain, users), at = chainAt(segs, b);
    if (!at) return;
    setSeg(segs[at.idx], at);
    j = 0;
    while (j < seg.steps && seg.start + stepBeat(seg.pat, j) < b - 1e-9) j++;
    cov = j;
  }
  function nextSeg() {
    const segs = chainSegments(chain, users);
    if (!segs.length) { seg = null; return; }
    let idx = seg.idx + 1, pass = seg.pass;
    if (idx >= segs.length) { idx = 0; pass++; }
    setSeg(segs[idx], { idx, pass, start: seg.start + seg.beats });
    j = 0; cov = 0;
  }
  function pumpChain(horizon, c) {
    if (!seg) chainSeek(Math.max(schedBeat, beatNow()));
    let guard = 0;
    while (seg && guard++ < 256) {
      if (j >= seg.steps) { nextSeg(); continue; }
      const b = seg.start + stepBeat(seg.pat, j);
      if (b > horizon) break;
      flushOffs(b);
      const r = segPlan(seg.pat, seg.steps, j, j + 1, cov); cov = r.cov;
      r.notes.forEach(x => strike(x, seg.start, c, seg.idx));
      schedBeat = b;
      j++;
    }
    hear();
  }
  // The reader shows the roll it is reading: when the segment under it changes, the paper (and the editor)
  // take that roll. Its edits stay on the paper only until the chain moves on, unless saved by name.
  function hear() {
    if (!playing || !anchor || !chainOn()) return;
    const bn = beatNow();
    let h = null;
    segQ.forEach(q => { if (q.start <= bn + 1e-9) h = q; });
    if (!h || h === heard) return;
    heard = h;
    pat = clone(h.pat); edited = false; sel = Math.min(sel, pat.len - 1);
    save(); paintAll();
  }
  function chainLocal() {
    if (!(playing && anchor && run && chainOn() && heard)) return null;
    return Math.max(0, beatNow() - heard.start);
  }

  function startFrom(ev) {
    letGo();
    anchor = { time: ev.time, beat: ev.beat, tempo: ev.tempo };
    k = firstStep(ev.beat); cov = k; schedBeat = ev.beat; pendingTempo = null;
    seg = null; segQ.length = 0; heard = null;
    if (chainOn()) chainSeek(ev.beat);
    playing = true;
    clearInterval(timer); timer = setInterval(pump, TICK);
    pump(); paintButtons(); dirty = true;
  }
  function halt() {
    playing = false; clearInterval(timer); timer = 0; anchor = null;
    seg = null; segQ.length = 0; heard = null;
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
    if (!playing || !anchor || chainOn()) return;   // the chain plays its own copies; edits on the paper do not move it
    k = firstStep(schedBeat + 1e-6); cov = k;
  }
  // Run off under a playing transport stops new strikes; the notes already struck end on time. Run on under a
  // playing transport starts on the grid from the beat now: before 17 Nov it caught up on every step that passed
  // while it was off (12 to 14 logged as skipped after 1.5 s at 120 BPM, and a strike up to 21 ms late, measured).
  function setRun(on) {
    const was = run;
    run = !!on;
    if (run && !was) resync();
    save();
    paintButtons(); paintStat(); dirty = true;
  }

  // ------------------------------------------------------------ the master Render WAV (19 Nov)
  // The roll as it plays from the transport's beat 0 for `seconds` at `tempo` on its device: the plain
  // roll (rollScore) or the chain (chainScore), the same plans the live scheduler and the suite read.
  // null while run is off, so a render with the roll switched off is what it was before.
  function renderScore(seconds, tempo) {
    if (!run) return null;
    const d = destDev(), spb = 60 / (tempo || 120), beats = Math.max(0, +seconds || 0) / spb;
    let ev = [];
    if (chainOn()) {
      const total = chainSegments(chain, users).reduce((a, s) => a + s.beats, 0);
      if (total > 0) ev = chainScore(chain, users, Math.min(100000, Math.ceil(beats / total) + 1), tempo, d);
    } else {
      ev = rollScore(pat, Math.min(100000, Math.ceil(beats / (ROLL_RATES[pat.rate] || 0.25)) + 1), tempo, d);
    }
    const out = [];
    ev.forEach(e => { if (e.at < seconds) out.push(e.t === 'on' ? { at: e.at, dev: d, t: 'on', n: e.n, v: e.v } : { at: e.at, dev: d, t: 'off', n: e.n }); });
    return { dev: d, chain: chainOn(), events: out };
  }

  // ------------------------------------------------------------ the project file (17 Nov)
  // A project carries the pattern, the device the roll plays and the run switch (project.js). Applying one
  // leaves the transport alone. A dest this rack does not have plays the lit device. The edit mark is on
  // unless the pattern is one of the factory rolls as shipped. Under a playing transport the new pattern
  // picks the grid up after the last step already scheduled, as a factory roll picked from the list does;
  // if run comes on, setRun picks it up from the beat now.
  // the chain goes with it, each entry carrying the roll it plays now, so the file plays the same elsewhere
  function chainForProject() {
    return { on: chain.on, items: chain.items.map(it => ({ name: it.name, reps: it.reps, pat: clone(resolveChainRoll(it, users)) })) };
  }
  function toProject() { return { pat: clone(pat), dest, run, chain: chainForProject() }; }
  function fromProject(r) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return false;
    const p = normalizeRoll(clone(r.pat));
    const ids = targets().map(t => t.id);
    pat = p; sel = Math.min(sel, pat.len - 1);
    edited = !ROLL_FACTORY.concat(users).some(f => JSON.stringify(normalizeRoll(clone(f))) === JSON.stringify(p));
    // a project saved before 18 Nov has no chain and leaves the chain as it is
    if (r.chain && typeof r.chain === 'object' && !Array.isArray(r.chain)) { chain = normalizeChain(clone(r.chain)); paintChain(); }
    dest = typeof r.dest === 'string' && ids.includes(r.dest) ? r.dest : 'lit';
    regrid();
    if ((r.run === true) !== run) setRun(r.run === true);
    else if (r.chain) resync();
    save(); paintAll();
    if (open) paintDest();
    return true;
  }
  function resync() {
    if (!playing || !anchor) return;
    const b = Math.max(schedBeat, beatNow());
    k = firstStep(b + 1e-6); cov = k; schedBeat = b;
    if (chainOn()) chainSeek(b + 1e-6); else { seg = null; segQ.length = 0; heard = null; }
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
    const a = (chainOn() ? 'chain · ' : '') + pat.name + (edited ? ' *' : '') + ' · ' + pat.len + ' × ' + ROLL_RATE_NAMES[pat.rate] + ' · ' + who;
    let b = playing && run ? 'step ' + (curStep() + 1) + '/' + pat.len : '';
    if (b && chainOn() && heard) b = (heard.idx + 1) + '/' + chain.items.length + ' · ' + 'step ' + (curStep() + 1) + '/' + heard.pat.len;
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
    const sl = $('rollPick'); const fi = ROLL_FACTORY.findIndex(f => f.name === pat.name), ui = users.findIndex(u => u.name === pat.name);
    sl.value = edited ? '' : (fi >= 0 ? String(fi) : (ui >= 0 ? 'u' + ui : ''));
    $('rollDel').disabled = !(ui >= 0);
    $('rollDel').setAttribute('aria-label', ui >= 0 ? 'Delete your roll ' + pat.name : 'Delete: load one of your rolls first');
    if (document.activeElement !== $('rollName')) $('rollName').value = isFactoryName(pat.name) ? '' : pat.name;
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
  function say(msg) { const m = $('rollMsg'); if (m) m.textContent = msg; }
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
  // Factory rolls keep their plain index as the value; the user's are 'u' and an index, in a group of their own.
  const pick = $('rollPick');
  function fillPick() {
    pick.textContent = '';
    const blank = document.createElement('option'); blank.value = ''; blank.textContent = 'Rolls…'; pick.appendChild(blank);
    const fg = document.createElement('optgroup'); fg.label = 'Factory';
    ROLL_FACTORY.forEach((f, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = f.name; fg.appendChild(o); });
    pick.appendChild(fg);
    if (users.length) {
      const ug = document.createElement('optgroup'); ug.label = 'Your rolls';
      users.forEach((u, i) => { const o = document.createElement('option'); o.value = 'u' + i; o.textContent = u.name; ug.appendChild(o); });
      pick.appendChild(ug);
    }
  }
  fillPick();
  pick.addEventListener('change', () => {
    const v = pick.value; if (v === '') return;
    if (v[0] === 'u') { const u = users[+v.slice(1)]; if (u) { load(u); say('Loaded ' + u.name + '.'); } }
    else load(ROLL_FACTORY[+v]);
  });

  // ------------------------------------------------------------ named user rolls (18 Nov)
  // Save keeps the paper under the name in the box (the roll's own name when the box is empty); the same
  // name again replaces that roll. Factory names are taken. Delete removes the loaded user roll from the
  // list; the paper keeps it, marked edited, and a chain entry naming it plays its own copy.
  function saveUser(nameIn) {
    const name = rollName(nameIn == null ? $('rollName').value : nameIn) || rollName(pat.name);
    if (!name) { say('Name the roll first.'); return false; }
    if (isFactoryName(name)) { say('"' + name + '" is a factory roll; pick another name.'); return false; }
    const at = users.findIndex(u => u.name.toLowerCase() === name.toLowerCase());
    if (at < 0 && users.length >= ROLL_USER_MAX) { say('You have ' + ROLL_USER_MAX + ' rolls; delete one first.'); return false; }
    pat.name = name;
    const copy = normalizeRoll(clone(pat));
    if (at >= 0) users[at] = copy; else users.push(copy);
    chain.items.forEach(it => { if (it.name.toLowerCase() === name.toLowerCase()) { it.name = name; it.pat = clone(copy); } });
    edited = false;
    saveUsers(); save(); fillPick(); paintAll(); paintChain();
    say((at >= 0 ? 'Saved over ' : 'Saved ') + name + '.');
    return true;
  }
  function deleteUser() {
    const at = users.findIndex(u => u.name === pat.name);
    if (at < 0) { say('Load one of your rolls to delete it.'); return false; }
    const name = users[at].name;
    users.splice(at, 1);
    edited = true;
    saveUsers(); save(); fillPick(); paintAll(); paintChain();
    say('Deleted ' + name + '. It stays on the paper until you load another roll.');
    return true;
  }
  $('rollSave').addEventListener('click', () => saveUser());
  // the page's own key handler leaves text boxes alone (and still sees a Space let go here), so only Enter is taken
  $('rollName').addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); saveUser(); } });
  $('rollDel').addEventListener('click', () => deleteUser());

  // ------------------------------------------------------------ the chain row (18 Nov)
  function chainChanged() {
    save(); paintChain(); paintStat();
    if (playing && run) resync();
  }
  function chainAdd() {
    if (chain.items.length >= CHAIN_MAX) { say('The chain holds ' + CHAIN_MAX + ' rolls.'); return false; }
    const known = !edited && (ROLL_FACTORY.some(f => f.name === pat.name) || users.some(u => u.name === pat.name));
    if (!known) { say('Save this roll by name first, so the chain can find it.'); return false; }
    chain.items.push({ name: pat.name, reps: 1, pat: normalizeRoll(clone(pat)) });
    say('Added ' + pat.name + ' to the chain (' + chain.items.length + ').');
    chainChanged();
    return true;
  }
  function chainSet(i, f) { const it = chain.items[i]; if (!it) return; f(it); chainChanged(); }
  function paintChain() {
    const on = $('rollChainOn'); if (!on) return;
    on.setAttribute('aria-pressed', String(chain.on));
    const ol = $('rollChain'); ol.textContent = '';
    $('rollChainN').textContent = chain.items.length ? chain.items.length + ' ' + (chain.items.length === 1 ? 'roll' : 'rolls') : 'empty';
    chain.items.forEach((it, i) => {
      const li = document.createElement('li'); li.className = 'rchain';
      const nm = document.createElement('span'); nm.className = 'dstat rcname';
      nm.textContent = (i + 1) + '. ' + it.name + ' × ' + it.reps;
      li.appendChild(nm);
      const btn = (txt, label, fn, dis) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small'; b.textContent = txt;
        b.setAttribute('aria-label', label); b.disabled = !!dis; b.addEventListener('click', fn); li.appendChild(b); return b;
      };
      btn('\u2212', 'Play ' + it.name + ' fewer times (' + it.reps + ')', () => chainSet(i, x => { x.reps = Math.max(1, x.reps - 1); }), it.reps <= 1);
      btn('+', 'Play ' + it.name + ' more times (' + it.reps + ')', () => chainSet(i, x => { x.reps = Math.min(CHAIN_REPS, x.reps + 1); }), it.reps >= CHAIN_REPS);
      btn('\u25B2', 'Move ' + it.name + ' earlier', () => { if (i > 0) { const t = chain.items[i - 1]; chain.items[i - 1] = chain.items[i]; chain.items[i] = t; chainChanged(); } }, i === 0);
      btn('\u2715', 'Take ' + it.name + ' out of the chain', () => { chain.items.splice(i, 1); chainChanged(); });
      ol.appendChild(li);
    });
  }
  $('rollChainOn').addEventListener('click', () => {
    if (!chain.on && !chain.items.length) { say('Add a roll to the chain first.'); return; }
    chain.on = !chain.on; chainChanged();
  });
  $('rollChainAdd').addEventListener('click', () => chainAdd());
  $('rollChainClear').addEventListener('click', () => { chain.items = []; chain.on = false; chainChanged(); say('The chain is empty.'); });
  paintChain();
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
    const lb = chainLocal();
    if (lb != null) return lb / ROLL_RATES[heard.pat.rate];
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
    state: () => ({ pat: clone(pat), dest, run, playing, k, sel, keyIn, edited, open, pend: pend.length, armed: [...armed], skipped,
      chain: clone(chain), users: users.map(u => u.name), seg: seg ? { idx: seg.idx, pass: seg.pass, start: seg.start, j } : null,
      heard: heard ? { idx: heard.idx, pass: heard.pass, start: heard.start, name: heard.name } : null }),
    users: () => users.map(clone),
    saveAs: name => saveUser(name),
    remove: () => deleteUser(),
    chainAdd: () => chainAdd(),
    chain: c => { if (c != null) { chain = normalizeChain(clone(c)); chainChanged(); } return clone(chain); },
    chainOn: on => { if (on != null) { chain.on = !!on; chainChanged(); } return chain.on; },
    chainScore: (passes, tempo, dev) => chainScore(chain, users, passes, tempo, dev),
    msg: () => ($('rollMsg') ? $('rollMsg').textContent : ''),
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
    lit: () => [...lit.entries()].filter(e => e[1] > 0).map(e => e[0]).sort((a, b) => a - b),
    lightsPending: () => lightT.size,
  };
  test.renderScore = (seconds, tempo) => renderScore(seconds, tempo);
  test.project = () => toProject();
  test.applyProject = r => fromProject(r);
  return {
    project: toProject,
    applyProject: fromProject,
    renderScore,
    frame(now) { if (playing) hear(); if (open && (dirty || playing)) draw(now); },
    keyIn: (n, v) => keyNote(n, v),
    lit: n => (lit.get(n) || 0) > 0,
    test,
  };
}
