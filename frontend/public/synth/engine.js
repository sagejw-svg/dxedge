// Filament engine: the voice worklet plus the rack, in any BaseAudioContext.
// The page uses it live; the tests use it inside an OfflineAudioContext and measure the result.
import { makeSynthChain, makeEnsemble, tubeData } from './rack.js';
import { normalize } from './patches.js';

const WORKLET = new URL('./voice.worklet.js', import.meta.url).href;

// The rack's state object, in the shape /otr's makeChain expects (its ADV), from a patch.
export function rackState(p) {
  const o = p.out;
  return {
    on: true, eqOn: false, deOn: false, tubeOn: true, spkOn: !!o.spkOn, roomOn: !!o.roomOn, wOn: !!o.wOn,
    bands: 10, gains: new Array(10).fill(0), pre: 0, preset: 'flat',
    tube: o.tube, drive: o.drive, bias: o.bias, sag: o.sag, tone: o.tone, out: o.level, topology: o.topology,
    deFreq: 5, deAmt: 0, deListen: false,
    cab: o.cab, spkInt: o.spkInt, room: o.room, rmDecay: o.rmDecay, rmMix: o.rmMix, rmTone: o.rmTone,
    width: o.width, wChar: o.wChar,
  };
}

export async function createEngine(ctx, opts = {}) {
  if (!ctx.__filament) { await ctx.audioWorklet.addModule(WORKLET); ctx.__filament = true; }
  let patch = normalize(opts.patch);
  const node = new AudioWorkletNode(ctx, 'filament', {
    numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
    processorOptions: { tubes: tubeData(), patch, events: opts.events || [] },
  });
  const E = { ctx, node, C: null, master: ctx.createGain(), meter: { v1: 0, v2: 0, voices: 0, cpu: 0, notes: [] } };
  E.master.gain.value = opts.volume == null ? 1 : opts.volume;
  if (opts.rack === false) {
    node.connect(E.master);
  } else {
    E.C = makeSynthChain(ctx);
    E.ens = makeEnsemble(ctx);
    node.connect(E.ens.input); E.ens.output.connect(E.C.input);
    E.C.out.connect(E.master);
  }
  if (opts.destination !== null) E.master.connect(opts.destination || ctx.destination);
  node.port.onmessage = e => { const m = e.data; if (m && m.t === 'meter') { E.meter = m; if (E.onMeter) E.onMeter(m); } };

  let S = E.C ? rackState(patch) : null;
  if (E.C) { E.C.apply(S); E.ens.set(patch.ens); }
  let ensJ = JSON.stringify(patch.ens);

  E.patch = () => patch;
  // load: true ducks the voices for the swap (a different patch); false smooths (a knob moved).
  E.setPatch = (p, load) => {
    patch = normalize(p);
    node.port.postMessage({ t: 'patch', p: patch, load: !!load });
    if (!E.C) return;
    const ej = JSON.stringify(patch.ens); if (ej !== ensJ) { E.ens.set(patch.ens); ensJ = ej; }
    const N = rackState(patch), C = E.C;
    const tubeKeys = ['tube', 'drive', 'bias', 'sag', 'tone', 'out', 'topology'];
    const roomRegen = N.room !== S.room || N.rmDecay !== S.rmDecay || N.rmTone !== S.rmTone;
    const routeChange = N.spkOn !== S.spkOn || N.roomOn !== S.roomOn || N.wOn !== S.wOn;
    const swap = N.tube !== S.tube || N.topology !== S.topology;     // a new curve: dip around it
    if (swap || routeChange) {
      C.reroute(N, () => { C.setTube(N); C.setSpk(N); C.setRoom(N, roomRegen); C.setWidth(N); });
    } else {
      if (tubeKeys.some(k => N[k] !== S[k])) C.setTube(N);
      if (N.cab !== S.cab || N.spkInt !== S.spkInt) C.setSpk(N);
      if (roomRegen || N.rmMix !== S.rmMix) C.setRoom(N, roomRegen);
      if (N.width !== S.width || N.wChar !== S.wChar) C.setWidth(N);
    }
    S = N;
  };
  E.noteOn = (n, v = 0.8) => node.port.postMessage({ t: 'on', n, v });
  E.noteOff = n => node.port.postMessage({ t: 'off', n });
  E.bend = v => node.port.postMessage({ t: 'bend', v });           // -1..1
  E.modWheel = v => node.port.postMessage({ t: 'mw', v });         // 0..1
  E.aftertouch = v => node.port.postMessage({ t: 'at', v });       // 0..1
  E.sustain = on => node.port.postMessage({ t: 'sus', on: !!on });
  E.panic = () => node.port.postMessage({ t: 'panic' });
  E.mono = on => { if (E.C) E.C.setMono(!!on); };
  return E;
}

// Render a score offline. events: [{at: seconds, t:'on'|'off'|..., ...}], times in seconds.
// Returns the AudioBuffer.
export async function renderOffline({ patch, events = [], seconds = 1, sampleRate = 48000, rack = true, mono = false }) {
  const ctx = new OfflineAudioContext(2, Math.round(seconds * sampleRate), sampleRate);
  const ev = events.map(e => Object.assign({}, e, { at: Math.round((e.at || 0) * sampleRate) }, e.t === 'patch' ? { p: normalize(e.p) } : {}));
  const E = await createEngine(ctx, { patch, events: ev, rack });
  if (mono) E.mono(true);
  return ctx.startRendering();
}

// One MIDI message (status, data1, data2) as an engine event, or null. The page and the tests
// both go through this, so a test that renders MIDI bytes exercises the same mapping as a keyboard.
export function midiEvent(d) {
  if (!d || d.length < 2) return null;
  const st = d[0] & 0xf0, a = d[1] & 0x7f, b = (d[2] || 0) & 0x7f;
  if (st === 0x90 && b > 0) return { t: 'on', n: a, v: b / 127 };
  if (st === 0x80 || (st === 0x90 && b === 0)) return { t: 'off', n: a };
  if (st === 0xE0) return { t: 'bend', v: Math.max(-1, (((b << 7) | a) - 8192) / 8191) };
  if (st === 0xD0) return { t: 'at', v: a / 127 };
  if (st === 0xA0) return { t: 'at', v: b / 127 };          // poly pressure, treated as channel pressure
  if (st === 0xB0) {
    if (a === 1) return { t: 'mw', v: b / 127 };
    if (a === 64) return { t: 'sus', on: b >= 64 };
    if (a === 120 || a === 123) return { t: 'panic' };
    return { t: 'cc', c: a, v: b / 127 };
  }
  return null;
}
