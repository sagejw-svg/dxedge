// PHASE 3. Web Audio. READ state, never write it.
//
// Three buses into master:
//   ambience  wind bed. Muted by settings.mute.
//   machine   hoist motor pitch follows crane.lineVel, slew whine follows
//             slewVel. A bed, not an effect. Muted by settings.mute.
//   radio     bandpass 300-3000 Hz, light waveshaper drive, squelch click on
//             transmit, static bed while ground is on the air, squelch tail on
//             release, louder static on a double.
// Alarms sit on their own gain straight into master, because mute quiets cab
// flavour only: LMI lockout and A2B still sound. Pitches are deliberately
// different from each other (Notion "Cab alarms" section).
//
// Phase 3 ships procedural sound only. No files exist yet, so playRadio() tries
// audio/<key>.ogg once per key, caches the miss, and falls back to the squelch
// alone. Audio never blocks the radio script and never throws: if the context
// cannot be created the whole module goes quiet and the game plays on.
//
// This module talks to the radio director only through the bus (radio.say,
// radio.doubled) and reports clip lengths back the same way, so no system
// imports another.

let ac = null;
let master = null;
let buses = { ambience: null, machine: null, radio: null };
let radioIn = null;          // node everything radio-flavoured connects into
let noiseBuf = null;
let staticSrc = null, staticGain = null;
let hoistOsc = null, hoistGain = null;
let slewOsc = null, slewGain = null;
let alarmBus = null;
let lmiOsc = null, lmiGain = null;
let lockOsc = null, lockGain = null;
let a2bOsc = null, a2bGain = null;

let prevTx = 'idle';
let ctxRef = null;
const clips = new Map();     // key -> AudioBuffer | null (null = known missing)

const RADIO_STATIC_GAIN = 0.032;   // about -30 dB
const DOUBLE_STATIC_GAIN = 0.12;
const MACHINE_GAIN = 0.05;         // bed, kept well under the radio
const AMBIENCE_GAIN = 0.02;

export function init(ctx) {
  ctxRef = ctx;
  ctx.bus.on('radio.say', (p) => { if (p && p.key) playRadio(ctx, p.key); });
  ctx.bus.on('radio.doubled', () => doubleBurst());
}

function makeNoiseBuffer() {
  const len = Math.floor(ac.sampleRate * 2);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) d[i] = Math.random() * 2 - 1;
  return buf;
}

// Gentle asymmetric drive so the radio bus sounds like a speaker, not a sine.
function driveCurve() {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 2.2) * 0.85;
  }
  return curve;
}

export function unlock(ctx) {
  if (ac) return;
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
  } catch {
    ac = null;
    return;
  }
  try {
    build();
  } catch (err) {
    console.warn('audio: graph build failed, running silent', err);
  }
}

function build() {
  master = ac.createGain();
  master.gain.value = 0.9;
  master.connect(ac.destination);

  buses.ambience = ac.createGain();
  buses.machine = ac.createGain();
  buses.radio = ac.createGain();
  buses.ambience.gain.value = AMBIENCE_GAIN;
  buses.machine.gain.value = MACHINE_GAIN;
  buses.radio.gain.value = 1;
  buses.ambience.connect(master);
  buses.machine.connect(master);
  buses.radio.connect(master);

  noiseBuf = makeNoiseBuffer();

  // --- radio chain: everything -> bandpass -> drive -> radio bus ---
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1150;          // centre of 300-3000 Hz
  band.Q.value = 0.7;                   // wide enough to pass the whole band
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 300;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3000;
  const drive = ac.createWaveShaper();
  drive.curve = driveCurve();
  drive.oversample = '2x';

  radioIn = ac.createGain();
  radioIn.connect(hp);
  hp.connect(lp);
  lp.connect(band);
  band.connect(drive);
  drive.connect(buses.radio);

  // Static bed, always running, gated by staticGain.
  staticSrc = ac.createBufferSource();
  staticSrc.buffer = noiseBuf;
  staticSrc.loop = true;
  staticGain = ac.createGain();
  staticGain.gain.value = 0;
  staticSrc.connect(staticGain);
  staticGain.connect(radioIn);
  staticSrc.start();

  // --- ambience: filtered noise standing in for wind over the jib ---
  const amb = ac.createBufferSource();
  amb.buffer = noiseBuf;
  amb.loop = true;
  const ambFilter = ac.createBiquadFilter();
  ambFilter.type = 'lowpass';
  ambFilter.frequency.value = 420;
  amb.connect(ambFilter);
  ambFilter.connect(buses.ambience);
  amb.start();

  // --- machine bed: hoist motor and slew whine ---
  hoistOsc = ac.createOscillator();
  hoistOsc.type = 'sawtooth';
  hoistOsc.frequency.value = 200;
  hoistGain = ac.createGain();
  hoistGain.gain.value = 0;
  const hoistFilter = ac.createBiquadFilter();
  hoistFilter.type = 'lowpass';
  hoistFilter.frequency.value = 900;
  hoistOsc.connect(hoistFilter);
  hoistFilter.connect(hoistGain);
  hoistGain.connect(buses.machine);
  hoistOsc.start();

  slewOsc = ac.createOscillator();
  slewOsc.type = 'triangle';
  slewOsc.frequency.value = 900;
  slewGain = ac.createGain();
  slewGain.gain.value = 0;
  slewOsc.connect(slewGain);
  slewGain.connect(buses.machine);
  slewOsc.start();

  // --- alarms: straight to master, mute does not reach them ---
  alarmBus = ac.createGain();
  alarmBus.gain.value = 0.14;
  alarmBus.connect(master);

  lmiOsc = ac.createOscillator();          // pre-alarm, 2 Hz tick
  lmiOsc.type = 'square';
  lmiOsc.frequency.value = 880;
  lmiGain = ac.createGain();
  lmiGain.gain.value = 0;
  lmiOsc.connect(lmiGain);
  lmiGain.connect(alarmBus);
  lmiOsc.start();

  lockOsc = ac.createOscillator();         // lockout, solid tone
  lockOsc.type = 'sawtooth';
  lockOsc.frequency.value = 440;
  lockGain = ac.createGain();
  lockGain.gain.value = 0;
  lockOsc.connect(lockGain);
  lockGain.connect(alarmBus);
  lockOsc.start();

  a2bOsc = ac.createOscillator();          // anti-two-block, 6 Hz harsh tick
  a2bOsc.type = 'square';
  a2bOsc.frequency.value = 1200;
  a2bGain = ac.createGain();
  a2bGain.gain.value = 0;
  a2bOsc.connect(a2bGain);
  a2bGain.connect(alarmBus);
  a2bOsc.start();
}

// One-shot filtered noise burst on the radio chain: squelch open, squelch tail.
function burst(seconds, level) {
  if (!ac || !radioIn) return;
  try {
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    const g = ac.createGain();
    const now = ac.currentTime;
    g.gain.setValueAtTime(level, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    src.connect(g);
    g.connect(radioIn);
    src.start(now);
    src.stop(now + seconds + 0.02);
  } catch { /* never let a click break the frame */ }
}

function tone(freq, seconds, level) {
  if (!ac || !buses.radio) return;
  try {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    const now = ac.currentTime;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(level, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    osc.connect(g);
    g.connect(buses.radio);
    osc.start(now);
    osc.stop(now + seconds + 0.02);
  } catch { /* ignore */ }
}

function doubleBurst() {
  if (!ac || !staticGain) return;
  try {
    const now = ac.currentTime;
    staticGain.gain.cancelScheduledValues(now);
    staticGain.gain.setValueAtTime(DOUBLE_STATIC_GAIN, now);
    staticGain.gain.setValueAtTime(DOUBLE_STATIC_GAIN, now + 1.2);
    staticGain.gain.linearRampToValueAtTime(0, now + 1.26);
  } catch { /* ignore */ }
}

// Try audio/<key>.ogg once per key. A miss is cached so a script that repeats a
// call does not repeat the 404. Success reports the clip length back on the bus
// so the director can stretch the transmission to fit it.
export function playRadio(ctx, key) {
  if (!key || !ac) return;
  if (clips.has(key)) {
    const buf = clips.get(key);
    if (buf) startClip(ctx, key, buf);
    return;
  }
  clips.set(key, null);                 // pessimistic: never fetch the same key twice
  fetch(`audio/${key}.ogg`)
    .then((res) => {
      if (!res.ok) throw new Error(`no clip ${key}`);
      return res.arrayBuffer();
    })
    .then((data) => ac.decodeAudioData(data))
    .then((buf) => {
      clips.set(key, buf);
      startClip(ctx, key, buf);
    })
    .catch(() => { /* caption only, exactly as designed */ });
}

function startClip(ctx, key, buf) {
  try {
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.connect(radioIn);
    src.start();
    if (ctx && ctx.bus) ctx.bus.emit('radio.clipLength', { key, seconds: buf.duration });
  } catch { /* ignore */ }
}

export function update(ctx, dt) {
  if (!ac || !master) return;
  const { state } = ctx;
  const muted = !!state.settings.mute;

  try {
    // --- radio squelch, driven by the director's tx state ---
    const tx = state.radio.tx;
    if (tx !== prevTx) {
      if (tx === 'groundTx') {
        burst(0.01, 0.5);                                  // squelch open
        staticGain.gain.setTargetAtTime(RADIO_STATIC_GAIN, ac.currentTime, 0.01);
      } else if (prevTx === 'groundTx') {
        staticGain.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        burst(0.06, 0.35);                                 // squelch tail
      }
      if (tx === 'playerTx') tone(1100, 0.05, 0.05);       // sidetone click
      prevTx = tx;
    }

    // --- machine bed ---
    const lineSpeed = Math.min(1, Math.abs(state.crane.lineVel) / 1.5);
    hoistOsc.frequency.setTargetAtTime(200 + 400 * lineSpeed, ac.currentTime, 0.05);
    hoistGain.gain.setTargetAtTime(muted ? 0 : 0.5 * lineSpeed, ac.currentTime, 0.06);

    const slewSpeed = Math.min(1, Math.abs(state.crane.slewVel) / 0.12);
    slewOsc.frequency.setTargetAtTime(700 + 500 * slewSpeed, ac.currentTime, 0.05);
    slewGain.gain.setTargetAtTime(muted ? 0 : 0.18 * slewSpeed, ac.currentTime, 0.06);

    buses.ambience.gain.setTargetAtTime(muted ? 0 : AMBIENCE_GAIN, ac.currentTime, 0.1);

    // --- alarms. Ticks are a square wave cut from the clock, not a timer. ---
    const s = state.sensors;
    const t = ac.currentTime;
    const tick2 = Math.sin(t * Math.PI * 2 * 2) > 0 ? 1 : 0;
    const tick6 = Math.sin(t * Math.PI * 2 * 6) > 0 ? 1 : 0;

    const preAlarm = s.capacityPct >= 90 && !s.lmiLock ? tick2 : 0;
    lmiGain.gain.setTargetAtTime(preAlarm * 0.5, t, 0.005);
    lockGain.gain.setTargetAtTime(s.lmiLock ? 0.5 : 0, t, 0.01);
    a2bGain.gain.setTargetAtTime(s.a2b ? tick6 * 0.6 : 0, t, 0.004);
  } catch { /* audio is never allowed to break the frame */ }
}

// Verification hook. The headless harness imports this module and asks whether
// the graph actually exists after the title tap. Nothing in the game uses it.
export function debugInfo() {
  return {
    hasContext: !!ac,
    contextState: ac ? ac.state : null,
    sampleRate: ac ? ac.sampleRate : null,
    buses: Object.keys(buses).filter((k) => !!buses[k]),
    busesConnectedToMaster: !!(master && buses.ambience && buses.machine && buses.radio),
    alarmBus: !!alarmBus,
    clipsTried: [...clips.keys()],
    clipsLoaded: [...clips.entries()].filter(([, v]) => !!v).map(([k]) => k)
  };
}
