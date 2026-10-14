// Filament engine: the devices (worklets) plus the rack, in any BaseAudioContext.
// The page uses it live; the tests use it inside an OfflineAudioContext and measure the result.
//
// The rack holds two devices, Filament (poly) and Cathode (mono, semi-modular). Both feed the
// same ensemble and output chain. The keyboard, wheels and MIDI go to the active device, and the
// rack takes its settings (ens, out) from the active device's patch. A device that is not
// active lets go of its keys, finishes its tails and sleeps; Cathode's node is only built the
// first time it is chosen.
import { makeSynthChain, makeEnsemble, tubeData } from './rack.js';
import { normalize, clone, getPath, setPath } from './patches.js';
import { normalizeC } from './cathode.js';
import { createMixer } from './mixer.js';
import { createTransport } from './transport.js';
import { RACK_API, getDevice, listDevices, registerDevice } from './device.js';

export const deviceOf = p => (p && p.device === 'cathode' ? 'cathode' : 'filament');
export const normalizeAny = p => (deviceOf(p) === 'cathode' ? normalizeC(p) : normalize(p));

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
  const E = { ctx, C: null, master: ctx.createGain(), meter: { v1: 0, v2: 0, voices: 0, cpu: 0, notes: [] }, nodes: {}, patches: {}, meters: {} };
  E.master.gain.value = opts.volume == null ? 1 : opts.volume;
  let patch = normalizeAny(opts.patch);
  E.device = deviceOf(patch); E.patches[E.device] = patch;
  if (opts.rack !== false) {
    E.C = makeSynthChain(ctx);
    E.ens = makeEnsemble(ctx);
    E.ens.output.connect(E.C.input);
    E.C.out.connect(E.master);
  }
  if (opts.destination !== null) E.master.connect(opts.destination || ctx.destination);
  // Mixer in front of the shared ensemble (or the master, when the rack is off).
  // Default strips are a straight wire, so a project that never touches them
  // sounds the same as the two devices feeding the ensemble directly.
  E.mix = createMixer(ctx);
  E.mix.connect(E.C ? E.ens.input : E.master);
  E.mix.set('filament', {});
  E.mix.set('cathode', {});
  if (opts.mixer) E.mix.load(opts.mixer);
  E.transport = createTransport(ctx, { tempo: opts.tempo, timeSig: opts.timeSig });
  E.api = RACK_API;
  const ctl = { bend: 0, mw: 0, at: 0 };
  function nodeFor(dev, events, playing) {
    if (E.nodes[dev]) return E.nodes[dev];
    const n = new AudioWorkletNode(ctx, dev, {
      numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
      processorOptions: { tubes: tubeData(), patch: E.patches[dev] || normalizeAny({ device: dev }), events: events || [], active: dev === E.device, playing: !!playing },
    });
    E.mix.attach(dev, n);
    n.port.onmessage = e => {
      const m = e.data; if (!m || m.t !== 'meter') return;
      E.meters[dev] = m;
      if (dev === E.device) {
        let cpu = 0; Object.keys(E.meters).forEach(k => { cpu += E.meters[k].cpu || 0; });
        E.meter = Object.assign({}, m, { cpu });
        if (E.onMeter) E.onMeter(E.meter);
      }
    };
    E.nodes[dev] = n;
    return n;
  }
  nodeFor(E.device, opts.events);
  // Other devices that play a score from the start (the two-device offline render): their
  // patches load, and playback holds them awake although the keyboard is not on them.
  (opts.others || []).forEach(o => { const d = o.dev === 'cathode' ? 'cathode' : 'filament'; if (d === E.device) return;
    E.patches[d] = normalizeAny(Object.assign({}, o.patch, { device: d })); nodeFor(d, o.events, true); });
  Object.defineProperty(E, 'node', { get: () => E.nodes[E.device] });

  let S = E.C ? rackState(patch) : null;
  if (E.C) { E.C.apply(S); E.ens.set(patch.ens); }
  let ensJ = JSON.stringify(patch.ens);

  E.patch = () => patch;
  E.patchOf = dev => E.patches[dev] || null;
  // load: true ducks the voices for the swap (a different patch); false smooths (a knob moved).
  // A patch for the device that is not active is kept (and sent, if its node exists) but leaves the rack alone.
  E.setPatch = (p, load) => {
    const np = normalizeAny(p), dev = deviceOf(np);
    E.patches[dev] = np;
    if (E.nodes[dev]) E.nodes[dev].port.postMessage({ t: 'patch', p: np, load: !!load });
    if (dev !== E.device) return;
    patch = np;
    applyRack();
  };
  // Move the keyboard to another device. Its patch (if given) loads with it, and the rack takes that patch's settings.
  E.setDevice = (dev, p) => {
    dev = dev === 'cathode' ? 'cathode' : 'filament';
    if (p) E.patches[dev] = normalizeAny(Object.assign({}, p, { device: dev }));
    if (dev === E.device) { if (p) E.setPatch(E.patches[dev], true); return; }
    const old = E.nodes[E.device];
    if (old) old.port.postMessage({ t: 'active', on: false });
    E.device = dev;
    const existed = !!E.nodes[dev], n = nodeFor(dev);
    if (existed) { n.port.postMessage({ t: 'active', on: true }); if (p) n.port.postMessage({ t: 'patch', p: E.patches[dev], load: true }); }
    n.port.postMessage({ t: 'bend', v: ctl.bend }); n.port.postMessage({ t: 'mw', v: ctl.mw }); n.port.postMessage({ t: 'at', v: ctl.at });
    patch = E.patches[dev] || normalizeAny({ device: dev }); E.patches[dev] = patch;
    E.meter = Object.assign({}, E.meters[dev] || { v1: 0, v2: 0, voices: 0, notes: [] }, { cpu: E.meter.cpu || 0 });
    applyRack();
  };
  function applyRack() {
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
  }
  const post = m => E.nodes[E.device].port.postMessage(m);
  E.noteOn = (n, v = 0.8) => post({ t: 'on', n, v });
  E.noteOff = n => post({ t: 'off', n });
  E.bend = v => { ctl.bend = v; post({ t: 'bend', v }); };          // -1..1
  E.modWheel = v => { ctl.mw = v; post({ t: 'mw', v }); };          // 0..1
  E.aftertouch = v => { ctl.at = v; post({ t: 'at', v }); };        // 0..1
  E.sustain = on => post({ t: 'sus', on: !!on });
  // The MIDI file player: send to a named device, whether or not the keyboard is on it (its node
  // is built if needed), and hold a device awake while playback runs.
  E.sendTo = (dev, m) => nodeFor(dev === 'cathode' ? 'cathode' : 'filament').port.postMessage(m);
  E.playing = (dev, on) => E.sendTo(dev, { t: 'play', on: !!on });
  E.panic = () => Object.keys(E.nodes).forEach(k => E.nodes[k].port.postMessage({ t: 'panic' }));
  E.mono = on => { if (E.C) E.C.setMono(!!on); };

  // A device the page and other devices talk to. Subscribing does not change
  // the voice: Filament and Cathode ignore the clock until something reads it.
  function facade(id) {
    const desc = getDevice(id);
    return {
      id,
      descriptor: desc,
      get output() { return E.nodes[id] || null; },
      parameterInfo: () => (desc && desc.parameters) || {},
      getPatch: () => (E.patches[id] ? clone(E.patches[id]) : null),
      setPatch: (p, load) => {
        if (id !== 'filament' && id !== 'cathode') { E.patches[id] = clone(p); return E.patches[id]; }
        E.setPatch(Object.assign({}, p, { device: id }), !!load);
        return E.patches[id];
      },
      getParameter: pid => getPath(E.patches[id] || {}, pid),
      setParameter: (pid, value) => {
        if (id !== 'filament' && id !== 'cathode') {
          const base = clone(E.patches[id] || {});
          setPath(base, pid, value);
          E.patches[id] = base;
          return getPath(base, pid);
        }
        const base = clone(E.patches[id] || normalizeAny({ device: id }));
        setPath(base, pid, value);
        if (id === 'cathode') base.device = 'cathode';
        E.setPatch(base, false);
        return getPath(E.patches[id], pid);
      },
      midi: data => {
        const ev = data && data.t ? data : midiEvent(data);
        if (!ev) return null;
        const node = (id === 'filament' || id === 'cathode') ? nodeFor(id) : E.nodes[id];
        if (node && node.port) node.port.postMessage(ev);
        return ev;
      },
      subscribe: fn => E.transport.subscribe(fn),
    };
  }
  E.devices = { filament: facade('filament'), cathode: facade('cathode') };
  E.listDevices = () => listDevices();
  E.registerDevice = desc => registerDevice(desc);
  // Host a device that brought its own node (a sequencer, a drum machine).
  E.addDevice = (id, node, patch) => {
    const desc = getDevice(id);
    if (!desc) throw new Error('unknown device ' + id);
    if (node) E.mix.attach(id, node.output || node);
    if (patch !== undefined) E.patches[id] = patch;
    if (node) E.nodes[id] = node.node || node;
    const inst = facade(id);
    E.devices[id] = inst;
    return inst;
  };
  return E;
}

// Render a score offline. events: [{at: seconds, t:'on'|'off'|..., ...}], times in seconds.
// Two-device form: patches {filament, cathode} and device (whose patch sets the rack, default
// the patch's device); an event with dev:'cathode' or dev:'filament' goes to that device, one
// without dev to the rack's device. onProgress(fraction) is called as the render runs.
// Returns the AudioBuffer.
export async function renderOffline({ patch, patches, device, events = [], seconds = 1, sampleRate = 48000, rack = true, mono = false, onProgress, mixer, tempo }) {
  const ctx = new OfflineAudioContext(2, Math.round(seconds * sampleRate), sampleRate);
  const frame = e => Object.assign({}, e, { at: Math.round((e.at || 0) * sampleRate) }, e.t === 'patch' ? { p: normalizeAny(e.p) } : {});
  let main = patch, others = [];
  if (patches) {
    const dev0 = device || deviceOf(patch) || 'filament';
    main = Object.assign({}, patches[dev0] || {}, { device: dev0 });
    others = Object.keys(patches).filter(d => d !== dev0 && patches[d])
      .map(d => ({ dev: d, patch: patches[d], events: events.filter(e => e.dev === d).map(frame) }))
      .filter(o => o.events.length);
    events = events.filter(e => !e.dev || e.dev === dev0);
  }
  const E = await createEngine(ctx, { patch: main, events: events.map(frame), rack, others, mixer, tempo });
  if (mono) E.mono(true);
  if (onProgress) {
    const step = Math.max(1, Math.ceil(seconds / 50));
    for (let t = step; t < seconds; t += step) ctx.suspend(t).then(() => { onProgress(t / seconds); ctx.resume(); });
  }
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
