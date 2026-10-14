// Master bus on the output: tempo-syncable stereo delay, Freeverb-style reverb,
// bus compressor/limiter. Each one has its own bypass. Settings live here, not in a
// device patch, so Filament, Cathode and whatever else shares the master all pass
// through the same processors. The host clock, when it arrives, can call set({tempo}).
//
// The reverb's structure is the public-domain Freeverb design; the worklet header
// records that. The delay and the compressor are original.

const WORKLET = new URL('./master.worklet.js', import.meta.url).href;

export const DIVS = [
  ['1/1', 4, '1/1'],
  ['1/2', 2, '1/2'],
  ['1/2d', 3, '1/2 dotted'],
  ['1/2t', 4 / 3, '1/2 triplet'],
  ['1/4', 1, '1/4'],
  ['1/4d', 1.5, '1/4 dotted'],
  ['1/4t', 2 / 3, '1/4 triplet'],
  ['1/8', 0.5, '1/8'],
  ['1/8d', 0.75, '1/8 dotted'],
  ['1/8t', 1 / 3, '1/8 triplet'],
  ['1/16', 0.25, '1/16'],
  ['1/16d', 0.375, '1/16 dotted'],
  ['1/16t', 1 / 6, '1/16 triplet'],
];
const DIV_BY = {};
DIVS.forEach(d => { DIV_BY[d[0]] = d[1]; });

export const MASTER_DEFAULT = {
  tempo: 120,
  delay: { on: false, sync: true, div: '1/8', time: 375, feedback: 0.35, mix: 0.35, ping: false, offset: 0 },
  reverb: { on: false, size: 0.55, damp: 0.35, mix: 0.28, width: 1 },
  comp: { on: false, threshold: -18, ratio: 4, attack: 10, release: 120, knee: 6, makeup: 0, limit: true, ceiling: -1 },
};

const RANGE = {
  tempo: [40, 240],
  'delay.time': [1, 2000], 'delay.feedback': [0, 0.95], 'delay.mix': [0, 1], 'delay.offset': [0, 1],
  'reverb.size': [0, 1], 'reverb.damp': [0, 1], 'reverb.mix': [0, 1], 'reverb.width': [0, 1],
  'comp.threshold': [-60, 0], 'comp.ratio': [1, 20], 'comp.attack': [0.1, 200], 'comp.release': [5, 2000],
  'comp.knee': [0, 24], 'comp.makeup': [0, 24], 'comp.ceiling': [-24, 0],
};

function clone(o) { return JSON.parse(JSON.stringify(o)); }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function normalizeMaster(p) {
  const s = clone(MASTER_DEFAULT);
  if (!p || typeof p !== 'object') return s;
  if (p.tempo != null && isFinite(+p.tempo)) s.tempo = +p.tempo;
  ['delay', 'reverb', 'comp'].forEach(group => {
    const src = p[group];
    if (!src || typeof src !== 'object') return;
    Object.keys(s[group]).forEach(k => {
      if (src[k] === undefined || src[k] === null) return;
      const d = s[group][k];
      if (typeof d === 'boolean') s[group][k] = !!src[k];
      else if (typeof d === 'number') { const n = +src[k]; if (isFinite(n)) s[group][k] = n; }
      else s[group][k] = String(src[k]);
    });
  });
  s.tempo = clamp(s.tempo, RANGE.tempo[0], RANGE.tempo[1]);
  if (!Object.prototype.hasOwnProperty.call(DIV_BY, s.delay.div)) s.delay.div = '1/8';
  Object.keys(RANGE).forEach(path => {
    if (path === 'tempo') return;
    const [g, k] = path.split('.');
    s[g][k] = clamp(s[g][k], RANGE[path][0], RANGE[path][1]);
  });
  return s;
}

// Deep-merge a partial edit over a master state, then clamp.
export function mergeMaster(base, partial) {
  const o = clone(normalizeMaster(base));
  if (!partial || typeof partial !== 'object') return o;
  if (partial.tempo != null) o.tempo = partial.tempo;
  ['delay', 'reverb', 'comp'].forEach(g => { if (partial[g] && typeof partial[g] === 'object') Object.assign(o[g], partial[g]); });
  return normalizeMaster(o);
}

// Resolved delay, in seconds. Sync uses the tempo; free time uses the milliseconds knob.
// The right line stretches by the offset, except in ping-pong, where both lines share one time
// and the second echo is the signal coming back from the other side.
export function delaySeconds(state) {
  const s = normalizeMaster(state), d = s.delay;
  const sec = d.sync ? (DIV_BY[d.div] || 0.5) * 60 / s.tempo : d.time / 1000;
  const left = clamp(sec, 0.001, 7.5);
  const right = d.ping ? left : clamp(left * (1 + d.offset), 0.001, 7.5);
  return { left, right };
}

export function masterView(state) {
  const s = normalizeMaster(state);
  const t = delaySeconds(s);
  return Object.assign({}, s, { delaySec: t.left, delaySecR: t.right });
}

// What the worklet reads: the clamped state plus the resolved delay in seconds.
export function forWorklet(state) {
  const s = normalizeMaster(state);
  const t = delaySeconds(s);
  s.delay.seconds = t.left;
  s.delay.secondsR = t.right;
  return s;
}

const CAP_SECONDS = 600;

function growBuf() {
  let a = new Float32Array(8192), n = 0;
  return {
    get n() { return n; },
    push(x) {
      if (n === a.length) { const b = new Float32Array(a.length * 2); b.set(a); a = b; }
      a[n++] = x;
    },
    done() { const o = new Float32Array(n); o.set(a.subarray(0, n)); return o; },
  };
}

// Linear resampler. When the rates match, samples pass through unchanged.
export function makeCapture(srcRate, dstRate) {
  const step = srcRate / dstRate;
  let frac = 0, holdL = 0, holdR = 0;
  const L = growBuf(), R = growBuf();
  return {
    push(inL, inR) {
      const n = inL.length;
      if (!n) return;
      let next = frac;
      while (next < n) {
        const i = Math.floor(next), f = next - i;
        if (f === 0) { L.push(inL[i]); R.push(inR[i]); }
        else {
          const aL = i === 0 ? holdL : inL[i - 1], aR = i === 0 ? holdR : inR[i - 1];
          L.push(aL + (inL[i] - aL) * f);
          R.push(aR + (inR[i] - aR) * f);
        }
        next += step;
      }
      frac = next - n;
      holdL = inL[n - 1]; holdR = inR[n - 1];
    },
    seconds() { return L.n / dstRate; },
    take() { return { L: L.done(), R: R.done() }; },
  };
}

function offlineContext(ctx) {
  return typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
}

export async function makeMasterFx(ctx, initial) {
  let state = normalizeMaster(initial);
  // A bypassed offline render never builds the worklet. Constructing one, even left
  // unplugged, shifts the context against a render that has no master bus at all.
  // The live page still loads the module up front so switching an effect on is synchronous.
  const needNow = state.delay.on || state.reverb.on || state.comp.on;
  if (!offlineContext(ctx) || needNow) {
    if (!ctx.__filamentMaster) { await ctx.audioWorklet.addModule(WORKLET); ctx.__filamentMaster = true; }
  }
  let node = null, source = null, dest = null, viaWorklet = null, force = false;
  let cap = null, waitEnd = null, recording = false;
  function ensureNode() {
    if (node) return node;
    node = new AudioWorkletNode(ctx, 'filament-master', {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
      channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'discrete',
      processorOptions: { master: forWorklet(state) },
    });
    node.port.onmessage = e => {
      const m = e.data;
      if (!m || m.t !== 'rec') return;
      if (m.end) { if (waitEnd) waitEnd(); return; }
      if (!cap || !m.L) return;
      cap.push(m.L, m.R);
      if (cap.seconds() >= CAP_SECONDS && recording) {
        recording = false;
        node.port.postMessage({ t: 'rec', on: false });
        if (fx.onCap) fx.onCap();
      }
    };
    return node;
  }
  // Effects off and not recording: the source connects straight to the destination.
  function route() {
    const want = force || state.delay.on || state.reverb.on || state.comp.on;
    if (!source || want === viaWorklet) return;
    try { source.disconnect(); } catch (e) {}
    if (node) try { node.disconnect(); } catch (e) {}
    if (dest) {
      if (want) { const n = ensureNode(); source.connect(n); n.connect(dest); }
      else source.connect(dest);
    } else if (want) ensureNode();
    viaWorklet = want;
  }
  if (needNow) ensureNode();
  const fx = {
    capSeconds: CAP_SECONDS,
    // Source is the master gain; dest is the context destination (or null to leave it unplugged).
    install(src, dst) { source = src; dest = dst || null; viaWorklet = null; route(); },
    state: () => masterView(state),
    set(partial) {
      state = mergeMaster(state, partial);
      route();
      if (node) node.port.postMessage({ t: 'set', master: forWorklet(state) });
      return masterView(state);
    },
    recording: () => recording,
    recordedSeconds: () => (cap ? cap.seconds() : 0),
    recordStart() {
      cap = makeCapture(ctx.sampleRate, 44100);
      recording = true;
      force = true;
      waitEnd = null;
      route();
      if (node) node.port.postMessage({ t: 'rec', on: true });
    },
    // Resolves with { L, R } Float32Arrays at 44.1 kHz, once the worklet has flushed.
    recordStop() {
      recording = false;
      return new Promise(resolve => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          waitEnd = null;
          const took = cap ? cap.take() : { L: new Float32Array(0), R: new Float32Array(0) };
          cap = null;
          force = false;
          route();
          resolve(took);
        };
        waitEnd = finish;
        if (node) node.port.postMessage({ t: 'rec', on: false });
        else finish();
        setTimeout(finish, offlineContext(ctx) ? 50 : 400);
      });
    },
  };
  return fx;
}

export { CAP_SECONDS };
