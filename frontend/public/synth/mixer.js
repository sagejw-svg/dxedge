// Per-device mixer. Each device has level, pan, mute, solo, and two sends.
// The strips sum into one destination: the shared ensemble input, or the
// master when the output rack is bypassed. The sends feed two shared returns
// (a short room and a feedback delay) that join the same destination, so one
// master recording hears the mix.
//
// Pan is a balance: centre is exactly unity on both sides, and a hard pan turns
// one side down without boosting the other. Send returns are built only when a
// send is above zero.
//
// Wiring. On an offline context a strip at its defaults is wired straight to the
// destination with no extra node, and a moved one goes through the least it needs
// (a gain, or the gain, a splitter, a gain per side and a merger for a pan). An
// offline render runs nothing between graph calls made before it, so any wiring
// is safe there.
// On a live context a rewire is two main-thread calls (disconnect, then connect),
// and the audio thread can render a quantum between them: on a busy machine the
// strip went silent for 128 samples at a move, a click (improvement 14 Nov; with
// the main thread held 6 ms after each disconnect, 16 of 24 moves dropped out on
// origin/main; the suite's live "back to unity" check failed once at 43.6x the
// held sine's step). A disconnect cannot be scheduled on the audio clock. So a
// live strip is rewired only while its source is silent (its meter reads exact
// zeros), where a lost quantum is silence anyway. A strip that carries sound and
// has its chain (the gain, splitter, side gains and merger) keeps it, and every
// move is a glide on the audio clock. One rewire with sound is left: the first
// move off the defaults of a sounding strip still on the wire. Keeping every
// strip on its chain all the time removes that too, but measured 14 Nov it costs
// the audio thread about 3.4 points of a core on the idle page (18 strips, 5
// nodes each), so a strip at its defaults goes back to the wire when it is next
// silent at a move. This also keeps R1107-1 fixed (a strip back at unity jumped
// to full in one sample when it was rewired before its glide ended): a sounding
// strip glides back on its chain and is never rewired then, so the 200 ms hold
// that timed that rewire on the audio clock (improvement 9 Nov) is gone with it.

export const STRIP = { level: 1, pan: 0, mute: false, solo: false, sendR: 0, sendD: 0 };

export const BUS_DEFAULT = { delayTime: 0.32, delayFeedback: 0.35, reverbSeconds: 1.1 };

export function normalizeStrip(s) {
  const o = { level: 1, pan: 0, mute: false, solo: false, sendR: 0, sendD: 0 };
  if (!s || typeof s !== 'object') return o;
  const level = +s.level, pan = +s.pan, sendR = +s.sendR, sendD = +s.sendD;
  if (isFinite(level)) o.level = Math.min(1, Math.max(0, level));
  if (isFinite(pan)) o.pan = Math.min(1, Math.max(-1, pan));
  if (isFinite(sendR)) o.sendR = Math.min(1, Math.max(0, sendR));
  if (isFinite(sendD)) o.sendD = Math.min(1, Math.max(0, sendD));
  o.mute = !!s.mute;
  o.solo = !!s.solo;
  return o;
}

export function normalizeBus(b) {
  const o = { delayTime: BUS_DEFAULT.delayTime, delayFeedback: BUS_DEFAULT.delayFeedback, reverbSeconds: BUS_DEFAULT.reverbSeconds };
  if (!b || typeof b !== 'object') return o;
  if (isFinite(+b.delayTime)) o.delayTime = Math.min(1.5, Math.max(0.05, +b.delayTime));
  if (isFinite(+b.delayFeedback)) o.delayFeedback = Math.min(0.85, Math.max(0, +b.delayFeedback));
  if (isFinite(+b.reverbSeconds)) o.reverbSeconds = Math.min(2.5, Math.max(0.2, +b.reverbSeconds));
  return o;
}

// pan is -1 (left) .. 0 (centre) .. +1 (right). Centre returns 1, 1.
export function balanceGains(pan) {
  const p = Math.max(-1, Math.min(1, +pan || 0));
  if (p >= 0) return { l: Math.cos(p * Math.PI / 2), r: 1 };
  return { l: 1, r: Math.cos(-p * Math.PI / 2) };
}

export function audibleGain(strip, anySolo) {
  if (!strip || strip.mute) return 0;
  if (anySolo && !strip.solo) return 0;
  return strip.level;
}

function noiseIR(ctx, seconds) {
  const n = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let s = (0x9e3779b9 + ch * 0x85ebca6b) >>> 0;
    for (let i = 0; i < n; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      const white = (s / 4294967296) * 2 - 1;
      d[i] = white * Math.exp(-3.2 * i / n);
    }
  }
  return buf;
}

export function createMixer(ctx) {
  const live = !(typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext);
  const channels = {};
  let destination = null;
  let bus = normalizeBus(null);
  let rev = null;
  let dly = null;

  function setP(param, v) {
    if (live) { try { param.setTargetAtTime(v, ctx.currentTime, 0.02); return; } catch (e) {} }
    param.value = v;
  }
  function make(id) {
    // Two channels, speakers: a mono source reaches both sides of the splitter (a mono input to the
    // splitter itself would land on the left only), and a stereo one passes unchanged.
    const input = ctx.createGain();
    input.channelCount = 2;
    input.channelCountMode = 'explicit';
    input.channelInterpretation = 'speakers';
    input.gain.value = 1;
    const ch = {
      id, input, source: null, strip: normalizeStrip(null),
      split: null, gL: null, gR: null, merge: null, route: '', inputRoute: '',
      sendR: null, sendD: null, sendFrom: null, sendRRoute: '', sendDRoute: '',
      an: null, bin: null, meterFrom: null,
    };
    channels[id] = ch;
    return ch;
  }
  function ensurePan(ch) {
    if (ch.split) return;
    ch.split = ctx.createChannelSplitter(2);
    ch.gL = ctx.createGain();
    ch.gR = ctx.createGain();
    ch.gL.gain.value = 1;
    ch.gR.gain.value = 1;
    ch.merge = ctx.createChannelMerger(2);
    ch.split.connect(ch.gL, 0);
    ch.split.connect(ch.gR, 1);
    ch.gL.connect(ch.merge, 0, 0);
    ch.gR.connect(ch.merge, 0, 1);
    ch.merge.connect(destination);
  }
  function arm(ch, mode) {
    if (!destination) return;
    if (mode === 'gain' && ch.inputRoute !== 'dest') {
      try { ch.input.disconnect(); } catch (e) {}
      if (ch.sendFrom === ch.input) ch.sendFrom = null;
      ch.input.connect(destination);
      ch.inputRoute = 'dest';
    } else if ((mode === 'pan' || mode === 'chain') && ch.inputRoute !== 'pan') {
      ensurePan(ch);
      try { ch.input.disconnect(); } catch (e) {}
      if (ch.sendFrom === ch.input) ch.sendFrom = null;
      ch.input.connect(ch.split);
      ch.inputRoute = 'pan';
    }
  }
  function ensureRev() {
    if (rev || !destination) return;
    const inn = ctx.createGain();
    inn.gain.value = 0.85;
    const conv = ctx.createConvolver();
    conv.normalize = true;
    conv.buffer = noiseIR(ctx, bus.reverbSeconds);
    inn.connect(conv);
    conv.connect(destination);
    rev = { inn, conv };
  }
  function ensureDly() {
    if (dly || !destination) return;
    const inn = ctx.createGain();
    inn.gain.value = 1;
    const delay = ctx.createDelay(2);
    delay.delayTime.value = bus.delayTime;
    const fb = ctx.createGain();
    fb.gain.value = bus.delayFeedback;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 3200;
    inn.connect(delay);
    delay.connect(tone);
    tone.connect(destination);
    tone.connect(fb);
    fb.connect(delay);
    dly = { inn, delay, fb };
  }
  function ensureSendGains(ch) {
    if (!ch.sendR) { ch.sendR = ctx.createGain(); ch.sendR.gain.value = 0; }
    if (!ch.sendD) { ch.sendD = ctx.createGain(); ch.sendD.gain.value = 0; }
  }
  function postNode(ch) {
    if (ch.route === 'direct') return ch.source;
    if ((ch.route === 'pan' || ch.route === 'chain') && ch.merge) return ch.merge;
    if (ch.route === 'gain') return ch.input;
    return null;
  }
  function applySends(ch) {
    const r = ch.strip.sendR, d = ch.strip.sendD;
    if ((r <= 0 && d <= 0) || !ch.source) {
      if (ch.sendFrom) {
        try { if (ch.sendR) ch.sendFrom.disconnect(ch.sendR); } catch (e) {}
        try { if (ch.sendD) ch.sendFrom.disconnect(ch.sendD); } catch (e) {}
        ch.sendFrom = null;
      }
      return;
    }
    ensureSendGains(ch);
    const from = postNode(ch);
    if (!from) return;
    if (ch.sendFrom !== from) {
      if (ch.sendFrom) {
        try { ch.sendFrom.disconnect(ch.sendR); } catch (e) {}
        try { ch.sendFrom.disconnect(ch.sendD); } catch (e) {}
      }
      from.connect(ch.sendR);
      from.connect(ch.sendD);
      ch.sendFrom = from;
    }
    if (r > 0) {
      ensureRev();
      if (ch.sendRRoute !== 'rev') {
        try { ch.sendR.disconnect(); } catch (e) {}
        ch.sendR.connect(rev.inn);
        ch.sendRRoute = 'rev';
      }
    } else if (ch.sendRRoute) {
      try { ch.sendR.disconnect(); } catch (e) {}
      ch.sendRRoute = '';
    }
    if (d > 0) {
      ensureDly();
      if (ch.sendDRoute !== 'dly') {
        try { ch.sendD.disconnect(); } catch (e) {}
        ch.sendD.connect(dly.inn);
        ch.sendDRoute = 'dly';
      }
    } else if (ch.sendDRoute) {
      try { ch.sendD.disconnect(); } catch (e) {}
      ch.sendDRoute = '';
    }
    setP(ch.sendR.gain, r);
    setP(ch.sendD.gain, d);
  }
  function hookMeter(ch) {
    if (!live || !ch.source) return;
    if (!ch.an) {
      ch.an = ctx.createAnalyser();
      ch.an.fftSize = 256;
      ch.an.smoothingTimeConstant = 0.35;
      ch.bin = new Float32Array(ch.an.fftSize);
    }
    if (ch.meterFrom === ch.source) return;
    if (ch.meterFrom) { try { ch.meterFrom.disconnect(ch.an); } catch (e) {} }
    try { ch.source.connect(ch.an); ch.meterFrom = ch.source; } catch (e) { ch.meterFrom = null; }
  }
  // A live strip's source has given exact zeros for the meter's last 256 samples (a sleeping device, a
  // finished tail). The meter is the pre-fader analyser on the source.
  function silent(ch) {
    if (!ch.source || !ch.an || ch.meterFrom !== ch.source) return !ch.source;
    ch.an.getFloatTimeDomainData(ch.bin);
    for (let i = 0; i < ch.bin.length; i++) if (ch.bin[i] !== 0) return false;
    return true;
  }
  // Called only when the chain is about to be entered or left, i.e. while nothing sounds through it.
  function restChain(ch) {
    [ch.input, ch.gL, ch.gR].forEach(n => { if (n) { n.gain.cancelScheduledValues(0); n.gain.value = 1; } });
  }
  function apply() {
    if (!destination) return;
    const list = Object.keys(channels).map(k => channels[k]);
    const anySolo = list.some(c => c.strip.solo);
    list.forEach(ch => {
      const g = audibleGain(ch.strip, anySolo);
      const centered = ch.strip.pan === 0;
      // see "Wiring" at the top of this file
      let mode = g === 1 && centered ? 'direct' : centered ? 'gain' : 'pan';
      if (live) {
        if (mode !== 'direct') mode = 'chain';
        if (ch.route === 'chain' && mode === 'direct' && !silent(ch)) mode = 'chain';   // sounding: stay, glide back to unity
      }
      if (ch.source && ch.route !== mode) {
        if (live) restChain(ch);   // a chain not in use rests at unity, so the next entry starts from there
        try { ch.source.disconnect(); } catch (e) {}
        ch.sendFrom = null;
        ch.meterFrom = null;
        if (mode === 'direct') ch.source.connect(destination);
        else { arm(ch, mode); ch.source.connect(ch.input); }
        ch.route = mode;
      } else if (ch.source && mode !== 'direct') arm(ch, mode);
      if (mode !== 'direct') {
        if (mode !== 'gain' && destination && !ch.split) ensurePan(ch);
        setP(ch.input.gain, g);
        if (mode !== 'gain' && ch.gL) {
          const b = balanceGains(ch.strip.pan);   // centred: exactly 1, 1
          setP(ch.gL.gain, b.l);
          setP(ch.gR.gain, b.r);
        }
      }
      applySends(ch);
      hookMeter(ch);
    });
  }

  return {
    connect(dest) { destination = dest; apply(); },
    attach(id, node) {
      const ch = channels[id] || make(id);
      if (ch.source && ch.source !== node) {
        try { ch.source.disconnect(); } catch (e) {}
        ch.route = '';
        ch.sendFrom = null;
        ch.meterFrom = null;
      }
      ch.source = node;
      ch.route = '';
      apply();
      return ch.input;
    },
    get(id) { return normalizeStrip(channels[id] && channels[id].strip); },
    route(id) { return (channels[id] && channels[id].route) || ''; },   // live 'direct' or 'chain'; offline 'direct', 'gain' or 'pan' (read by the suite)
    set(id, partial) {
      const ch = channels[id] || make(id);
      ch.strip = normalizeStrip(Object.assign({}, ch.strip, partial || {}));
      apply();
      return normalizeStrip(ch.strip);
    },
    all() {
      const o = {};
      Object.keys(channels).forEach(k => { o[k] = normalizeStrip(channels[k].strip); });
      return o;
    },
    load(map) {
      Object.keys(map || {}).forEach(id => {
        const ch = channels[id] || make(id);
        ch.strip = normalizeStrip(map[id]);
      });
      apply();
    },
    bus() { return normalizeBus(bus); },
    setBus(partial) {
      bus = normalizeBus(Object.assign({}, bus, partial || {}));
      if (dly) {
        setP(dly.delay.delayTime, bus.delayTime);
        setP(dly.fb.gain, bus.delayFeedback);
      }
      if (rev) rev.conv.buffer = noiseIR(ctx, bus.reverbSeconds);
      return normalizeBus(bus);
    },
    meters() {
      const o = {};
      Object.keys(channels).forEach(id => {
        const ch = channels[id];
        hookMeter(ch);
        if (!ch.an || !ch.bin) { o[id] = 0; return; }
        ch.an.getFloatTimeDomainData(ch.bin);
        let p = 0;
        for (let i = 0; i < ch.bin.length; i++) {
          const a = ch.bin[i] < 0 ? -ch.bin[i] : ch.bin[i];
          if (a > p) p = a;
        }
        o[id] = p;
      });
      return o;
    },
  };
}
