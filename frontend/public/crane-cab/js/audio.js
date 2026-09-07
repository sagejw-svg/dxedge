// PHASE 3. Web Audio. READ state, never write it.
//
// Three buses into master:
//   ambience  wind bed. Muted by settings.mute.
//   machine   hoist motor pitch follows crane.lineVel, slew whine follows
//             slewVel, plus contact thuds on touchdown, line tight and
//             collision. A bed, not an effect. Muted by settings.mute.
//   radio     bandpass 300-3000 Hz, light waveshaper drive, squelch click on
//             transmit, static bed while ground is on the air, squelch tail on
//             release, a heterodyne beat while both stations are keyed.
// Alarms sit on their own gain straight into master, because mute quiets cab
// flavour only: LMI lockout and A2B still sound. Pitches are deliberately
// different from each other (Notion "Cab alarms" section).
//
// The ground crew's calls are recordings, in audio/<KEY>.ogg, rendered dry on
// purpose: they arrive with no radio colour on them and pick it up here, from
// the same bandpass and drive as everything else on this bus, so a call and the
// squelch that opens it sound like one radio. playRadio() fetches each key once,
// caches the miss, and falls back to the squelch and the caption alone. Audio
// never blocks the radio script and never throws: if the context cannot be
// created the whole module goes quiet and the game plays on.
//
// This module listens to the radio director on the bus (radio.say,
// radio.overlap) and never talks back, so no system imports another and nothing
// audio does can reach state.

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
const OVERLAP_GAIN = 0.05;         // the beat note two open carriers make
// Ground says the same words louder, not different words, so urgency is a level
// and a little more drive rather than three recordings of every line.
const URGENCY_GAIN = [1.0, 1.25, 1.6];
const MACHINE_GAIN = 0.05;         // bed, kept well under the radio
const AMBIENCE_GAIN = 0.02;

export function init(ctx) {
  ctxRef = ctx;
  ctx.bus.on('radio.say', (p) => { if (p && p.key) playRadio(ctx, p.key, p.urgency || 0); });
  ctx.bus.on('radio.overlap', () => heterodyne());
  // The set-down. pendulum.js has emitted these since Phase 2 and nothing has
  // ever listened: putting a load down, the single most delicate thing the
  // operator does, made no sound at all.
  ctx.bus.on('load.slack', () => thud(70, 0.45, 0.5));
  ctx.bus.on('hook.tight', () => thud(120, 0.16, 0.16));
  // collision.counted, not the raw contact. missions.js is the one that knows
  // whether a contact counts, which is why it publishes both, and a load resting
  // on the thing it was picked from used to fire a heavy impact sound with no
  // alarm, no fail and nothing on screen to explain it.
  ctx.bus.on('collision.counted', () => thud(52, 0.7, 0.85));
}

// Everything below reads state and nothing writes it, directly or through the
// bus. An earlier version reported clip lengths back to the director, which set
// a radio timer from an audio callback - a state write with audio as its cause,
// which is exactly what hard rule 1 forbids. Fitting a call to its clip is a
// problem for whenever clips actually exist.

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

// A low body-felt knock on the machine bus. Pitch drops as it decays, which is
// what a mass settling onto a deck sounds like from up in the cab.
function thud(freq, seconds, level) {
  if (!ac || !buses.machine) return;
  try {
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.55, now + seconds);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(level, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    osc.connect(g);
    g.connect(buses.machine);
    osc.start(now);
    osc.stop(now + seconds + 0.02);

    // A little grit on top so it reads as contact, not a tone.
    const n = ac.createBufferSource();
    n.buffer = noiseBuf;
    const nf = ac.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.value = 320;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(level * 0.6, now);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + seconds * 0.5);
    n.connect(nf); nf.connect(ng); ng.connect(buses.machine);
    n.start(now);
    n.stop(now + seconds);
  } catch { /* audio never breaks the frame */ }
}

// Two carriers open at once. On a full duplex set that is not a fault and does
// not garble anyone, so this is a short beat note under the call rather than the
// wall of static a half duplex double used to raise: the operator hears that
// they are on the air over the top of ground, and ground keeps talking.
function heterodyne() {
  if (!ac || !radioIn) return;
  try {
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1180, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.22);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(OVERLAP_GAIN, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    osc.connect(g); g.connect(radioIn);
    osc.start(now); osc.stop(now + 0.26);
  } catch { /* ignore */ }
}

// Try audio/<key>.ogg once per key. A miss is cached so a script that repeats a
// call does not repeat the 404, and a key with no file falls back to the caption
// and the squelch, which is how the whole radio worked before there were voices.
// The director does not wait on any of this: it sizes the call from the length
// in data/clips.js, which was measured off these same files at build time.
export function playRadio(ctx, key, urgency) {
  if (!key || !ac) return;
  if (clips.has(key)) {
    const buf = clips.get(key);
    if (buf) startClip(ctx, buf, urgency);
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
      startClip(ctx, buf, urgency);
    })
    .catch(() => { /* caption only, exactly as designed */ });
}

// Urgency is a level, not a different take. Every clip was normalised to the
// same RMS at build time so this is the only thing separating a calm call from a
// shouted one, and the gain is well under what the waveshaper on this bus will
// take before it turns to mush.
function startClip(ctx, buf, urgency) {
  try {
    const src = ac.createBufferSource();
    src.buffer = buf;
    const g = ac.createGain();
    g.gain.value = URGENCY_GAIN[Math.max(0, Math.min(URGENCY_GAIN.length - 1, urgency | 0))];
    src.connect(g);
    g.connect(radioIn);
    src.start();
  } catch { /* ignore */ }
}

export function update(ctx, dt) {
  if (!ac || !master) return;
  const { state } = ctx;
  const muted = !!state.settings.mute;
  // The tick only runs while playing, so crane velocities and the radio tx state
  // freeze at whatever they were. Driving the beds from frozen values left the
  // hoist motor droning under the pause card and the transmit hiss running under
  // the end card. Nothing is moving and nobody is talking, so nothing sounds.
  const live = state.phase === 'playing';

  try {
    // --- radio squelch, driven by the director's tx state ---
    const tx = live ? state.radio.tx : 'idle';
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
    const lineSpeed = live ? Math.min(1, Math.abs(state.crane.lineVel) / 1.5) : 0;
    hoistOsc.frequency.setTargetAtTime(200 + 400 * lineSpeed, ac.currentTime, 0.05);
    hoistGain.gain.setTargetAtTime(muted ? 0 : 0.5 * lineSpeed, ac.currentTime, 0.06);

    const slewSpeed = live ? Math.min(1, Math.abs(state.crane.slewVel) / 0.12) : 0;
    slewOsc.frequency.setTargetAtTime(700 + 500 * slewSpeed, ac.currentTime, 0.05);
    slewGain.gain.setTargetAtTime(muted ? 0 : 0.18 * slewSpeed, ac.currentTime, 0.06);

    buses.ambience.gain.setTargetAtTime(muted || !live ? 0 : AMBIENCE_GAIN, ac.currentTime, 0.1);

    // --- alarms. Ticks are a square wave cut from the clock, not a timer. ---
    const s = state.sensors;
    const t = ac.currentTime;
    const tick2 = Math.sin(t * Math.PI * 2 * 2) > 0 ? 1 : 0;
    const tick6 = Math.sin(t * Math.PI * 2 * 6) > 0 ? 1 : 0;

    const preAlarm = live && s.capacityPct >= 90 && !s.lmiLock ? tick2 : 0;
    lmiGain.gain.setTargetAtTime(preAlarm * 0.5, t, 0.005);
    lockGain.gain.setTargetAtTime(live && s.lmiLock ? 0.5 : 0, t, 0.01);
    a2bGain.gain.setTargetAtTime(live && s.a2b ? tick6 * 0.6 : 0, t, 0.004);
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
