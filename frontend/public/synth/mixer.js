// Per-device mixer. Each device has level, pan, mute and solo. The strips sum
// into one destination: the shared ensemble input, or the master when the
// output rack is bypassed.
//
// A strip at its defaults (level 1, pan centred, not muted, nobody soloed) is
// wired straight through, with no extra node, so it does not change the sound.
// Pan is a balance: centre is exactly unity on both sides, and a hard pan
// turns one side down without boosting the other.

export const STRIP = { level: 1, pan: 0, mute: false, solo: false };

export function normalizeStrip(s) {
  const o = { level: 1, pan: 0, mute: false, solo: false };
  if (!s || typeof s !== 'object') return o;
  const level = +s.level, pan = +s.pan;
  if (isFinite(level)) o.level = Math.min(1, Math.max(0, level));
  if (isFinite(pan)) o.pan = Math.min(1, Math.max(-1, pan));
  o.mute = !!s.mute;
  o.solo = !!s.solo;
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

export function createMixer(ctx) {
  const live = !(typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext);
  const channels = {};
  let destination = null;

  function setP(param, v) {
    if (live) { try { param.setTargetAtTime(v, ctx.currentTime, 0.02); return; } catch (e) {} }
    param.value = v;
  }
  function make(id) {
    const input = ctx.createGain();
    input.gain.value = 1;
    const ch = { id, input, source: null, strip: normalizeStrip(null), split: null, gL: null, gR: null, merge: null, route: '', inputRoute: '' };
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
      ch.input.connect(destination);
      ch.inputRoute = 'dest';
    } else if (mode === 'pan' && ch.inputRoute !== 'pan') {
      ensurePan(ch);
      try { ch.input.disconnect(); } catch (e) {}
      ch.input.connect(ch.split);
      ch.inputRoute = 'pan';
    }
  }
  function apply() {
    if (!destination) return;
    const list = Object.keys(channels).map(k => channels[k]);
    const anySolo = list.some(c => c.strip.solo);
    list.forEach(ch => {
      const g = audibleGain(ch.strip, anySolo);
      const centered = ch.strip.pan === 0;
      const mode = g === 1 && centered ? 'direct' : centered ? 'gain' : 'pan';
      if (ch.source && ch.route !== mode) {
        try { ch.source.disconnect(); } catch (e) {}
        if (mode === 'direct') ch.source.connect(destination);
        else { arm(ch, mode); ch.source.connect(ch.input); }
        ch.route = mode;
      } else if (ch.source && mode !== 'direct') arm(ch, mode);
      if (mode !== 'direct') {
        // Pan nodes exist even before a device is attached, so a project can
        // set pan and the first note already takes that balance.
        if (mode === 'pan' && destination && !ch.split) ensurePan(ch);
        setP(ch.input.gain, g);
        if (mode === 'pan' && ch.gL) {
          const b = balanceGains(ch.strip.pan);
          setP(ch.gL.gain, b.l);
          setP(ch.gR.gain, b.r);
        }
      }
    });
  }

  return {
    // The node every strip sums into (the ensemble input, or the master).
    connect(dest) { destination = dest; apply(); },
    // Connect a device's stereo output. At the default strip this is a direct
    // connection to the destination, the same wiring the device had before.
    attach(id, node) {
      const ch = channels[id] || make(id);
      if (ch.source && ch.source !== node) { try { ch.source.disconnect(); } catch (e) {} ch.route = ''; }
      ch.source = node;
      ch.route = '';
      apply();
      return ch.input;
    },
    get(id) { return normalizeStrip(channels[id] && channels[id].strip); },
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
  };
}
