# Filament (/synth/) build status

The single source of truth for where the synth build is. The nightly build task reads this file
first and updates it last. James can write in **Notes from James** and the next run acts on it.

Design brief: the claude.ai project doc `dxedge-synth-design.md` (project "DX Edge Synth").
Decisions in force: name Filament, path `/synth/`, standalone page plus a main-page tab next to OTR,
Ko-fi tip link to https://ko-fi.com/oldtimeradio, /otr code is COPIED into `/synth/` (never edit
/otr for the synth), warm-up off by default, vanity domain later, Web MIDI in 0.1.
Long-term goal: a rack of devices in the spirit of Reason (Propellerhead). Keep the synth a device
with a clean boundary: parameter table, MIDI in, stereo out, versioned patch JSON.

The rack now holds twelve devices: **Filament** (poly, the tube synth), **Cathode** (mono,
semi-modular, with a patch panel; James asked for it on 13 Oct as "an MS-20 style" synth. It is an
original design: own name, panel, jack names and voicing, not a copy of Korg's), **Thyratron**
(a monophonic ladder-filter synthesizer: three oscillators, a mixer, a 24 dB/octave ladder that
sings at full emphasis), **Dekatron** (an original analog-style drum machine: kick, snare,
closed hat, open hat, clap, tom and rim, with a 16-step pattern), **Lattice** (an original
wavetable instrument: two morphing oscillators, warp, unison, a sub and noise, two filters, and a
drag-and-drop modulation matrix), **Gleam** (an original touch field: each finger is a voice,
with a room of orbs and a master effect pad), **Mote** (an original granular instrument: a
waveform, grains, and a tail), **Heptode** (a MIDI-file instrument), **Geissler** (a generative
meadow: reeds, grazers, stalks and flickers), **Pentagrid** (an original
shortwave receiver: a tuning dial, band noise, Morse, FSK, formant speech, chimes and time pips,
all synthesized), **Orthicon** (a spectral painter: a log-frequency picture scanned back into
sound), and **Trochotron** (a fractal seed instrument: one seed and one set of settings grow one
piece). The rail above the chassis picks which device the keyboard, wheels and MIDI play. Filament
and Cathode feed the shared ensemble and output rack. Dekatron copies those output fields. Lattice,
Thyratron, Gleam, Mote, Heptode, Geissler, Pentagrid, Orthicon and Trochotron have their own panels
and sleep until the rail selects them; the shared output knobs stay on the Filament patch while one
of those is showing. Mote, Heptode, Geissler, Pentagrid, Orthicon and Trochotron hide the tube
chassis while lit. Dekatron and Lattice register when their nodes are hosted. Thyratron and Gleam
are registered in `device.js`. Mote, Heptode, Geissler, Pentagrid, Orthicon and Trochotron register
when their modules load.
Gleam is also a full-screen page at `/synth/gleam/`.

The rack framework (14 Oct) is what those devices plug into. Each device
has one contract: a descriptor, a parameter table, MIDI in, a stereo output and a versioned patch.
A mixer strip per device (level, pan, mute, solo) sums into the shared ensemble and output tubes.
A master clock (tempo, play/stop, 24 pulses a quarter) is there for anything that wants to subscribe.
A project is one JSON document, kept in this browser and downloadable. A strip at its defaults is a
straight wire, so Filament and Cathode sound the same as they did before the mixer.

Full brief: `docs/filament-design.md` (a copy of the project doc, kept in the repo so the nightly
task can read it).

## Nightly build and bug check (scheduled task, 11:52 PM Pacific)
1. Bugs first: run `python3 scripts/test_synth.py` and load https://dxedge.net/synth/ headless. Anything
   failing or broken is the night's work.
2. Otherwise the next unchecked item below, in order, unless Notes from James says otherwise. One item
   per night; a big item ships as a coherent slice and the rest is written down here.
3. Every new feature gets measured tests in the suite. Push to main only on ALL PASS. Never edit /otr.
4. Tick the item, add a line to the Nightly log (date, what changed, commit, check count, CPU), and
   note anything that changes how an existing patch sounds so James can listen.
5. Licensing (this may become a commercial product): follow `docs/filament-licensing.md`. Write our
   own code. Never copy or line-by-line translate code from GPL, AGPL, LGPL, MPL or CC BY-SA sources,
   Stack Overflow, or unlicensed code (openDAW, VCV Rack, Surge XT and Cmajor are reference only).
   Permissive code and CC0 content need a register row in that file before they land. No other
   company's product names or trademarks in the UI, patches or code.

## Files

| File | What it is |
|-|-|
| `frontend/public/synth/index.html` | The page: panel, chassis, keyboard, MIDI, patches, test hook `window.__synth` |
| `frontend/public/synth/voice.worklet.js` | Both devices' engines (AudioWorklet): processor `filament` (oscillators, V1, filters, envelopes, LFOs, voices) and processor `cathode` (one voice, the patch graph, diode-clipped SVF high-pass and low-pass) |
| `frontend/public/synth/engine.js` | Builds the devices + rack in any context; `setDevice`; `renderOffline`; `midiEvent`; hosts the mixer, transport and device facades. The master gain feeds `makeMasterFx` after the mixer (a bypassed offline render skips the worklet; `masterFx: false` wires the gain straight through) |
| `frontend/public/synth/masterfx.js`, `master.worklet.js`, `masterui.js` | Master bus after the mixer and the output chain: tempo-syncable stereo delay, Freeverb-style reverb, bus compressor/limiter. Each bypasses on its own. State is `filament_master` in localStorage, not a device patch |
| `frontend/public/synth/wav.js` | 24-bit / 44.1 kHz stereo WAV: live record of the master, and offline render of N seconds (10 minute cap) |
| `frontend/public/synth/patches.js` | Filament patch schema v1, defaults, `normalize`, the factory set |
| `frontend/public/synth/smf.js` | Our own Standard MIDI File reader and writer (pure functions): `readSMF`, `songOf` (tempo map to seconds, multi-channel tracks split per channel, format 2 played in sequence), `writeSMF` (format 1, 480 ppq), `bytesOf` |
| `frontend/public/synth/deck.js` | The MIDI deck above the keys: recorder, import with the track list and device chips, the player (150 ms lookahead, 25 ms timer, frame-exact `at`), Render WAV. Its clock is private; it still uses `smf.js` |
| `frontend/public/synth/player.js` | Song library player. Loads a bundled file, an opened file, or a drop, and plays it on `host.transport` (play, stop, tempo). Each MIDI channel routes to a device |
| `frontend/public/synth/midisong.js` | Pure parse and route helpers for the library player. Parsing is the vendored `@tonejs/midi`. Time is quarter-note beats, so the transport tempo is the playback tempo |
| `frontend/public/synth/vendor/tonejs-midi.js` | `@tonejs/midi` 2.0.28 (MIT) bundled with `midi-file` 1.2.4 and `array-flatten` 3.0.0. See `THIRD_PARTY_NOTICES.md` |
| `frontend/public/synth/midi/` | Bundled `.mid` files and `catalog.json` (title, composer, composition status, CC0 sequence note, and Halloween preset names) |
| `scripts/build_midi_library.mjs` | Regenerates `frontend/public/synth/midi/`. Every file is sequenced here |
| `frontend/public/synth/cathode.js` | Cathode patch schema v1 (`device: 'cathode'`, `cables: [[source, input]]`), the jack lists and normals, `normalizeC`, its factory set |
| `frontend/public/synth/drums.js` | Dekatron patch schema v1 (`device: 'dekatron'`), the parameter table, `normalizeDrum`, `voiceForNote`, `drumDevice` (the host adapter), eight factory patterns (Lantern and Bones are Halloween) |
| `frontend/public/synth/drums-dsp.js` | The drum engine: 2x voices, the half-band decimator, the sample clock (`stepSeconds`) |
| `frontend/public/synth/drums.worklet.js` | AudioWorklet processor `dekatron`. Imports the engine; no DSP of its own |
| `frontend/public/synth/drums-ui.js` | The pattern panel, and `createDrumHost` / `renderDrums` (the page adapter). `attach` calls `registerDevice` and `addDevice`, and the pattern follows `host.transport` |
| `frontend/public/synth/lattice.js` | Lattice patch schema v1 (`device: 'lattice'`), the parameter table, eight factory presets, `latticeDevice` |
| `frontend/public/synth/lattice-dsp.js` | The wavetable engine: generated mipmapped tables, 2x with a half-band decimator, warp, unison, filters, envelopes, drawable LFOs, the mod matrix |
| `frontend/public/synth/lattice.worklet.js` | AudioWorklet processor `lattice`. Imports the engine; no DSP of its own |
| `frontend/public/synth/lattice-ui.js` | The flat panel, WAV import, and `createLatticeHost` / `renderLattice`. `attach` calls `registerDevice` and `addDevice` |
| `frontend/public/synth/thyratron.js` | Thyratron patch schema v1 (`device: 'thyratron'`), `normalizeThy`, six factory presets (Walnut Bass, Pilot Lead, Herald Brass, Arc Sweep, Crypt Wail, Bone Rattle) |
| `frontend/public/synth/thyratron-dsp.js` | The monophonic voice: 2x oscillators, the ladder, two contours, glide, the half-band decimator |
| `frontend/public/synth/thyratron.worklet.js` | AudioWorklet processor `thyratron`. Imports the engine; no DSP of its own |
| `frontend/public/synth/thyratron-ui.js` | Wood-and-black panel, and `createThyHost` / `renderThyAudio` (the page adapter). `attach` calls `addDevice` |
| `frontend/public/synth/gleam.js` | Gleam patch schema v1 (`device: 'gleam'`), scales, gesture tape, room geometry, `gleamDevice` |
| `frontend/public/synth/gleam-dsp.js` | Gleam voice engine: one oscillator and a one-pole lowpass per finger, equal-power pan, a short room delay on a wet bus |
| `frontend/public/synth/gleam.worklet.js` | AudioWorklet processor `gleam`. Dry stereo on output 0, optional per-voice outputs for HRTF, wet room on the last output |
| `frontend/public/synth/gleam-fx.js` | Effect pad nodes: lowpass sweep, stutter gate, feedback delay. Bypassed unless a finger is down |
| `frontend/public/synth/gleam-ui.js` | Pad, host, and `renderGleamBuffer`. `attach` calls `addDevice` |
| `frontend/public/synth/gleam/index.html` | Full-screen Gleam. Same modules as the rack |
| `frontend/public/synth/device.js` | Device contract (`dxrack/1`): `registerDevice`, `getDevice`, `listDevices`, `parameterTable`. Filament, Cathode, Thyratron and Gleam are registered here; Dekatron and Lattice register when their nodes are hosted; Mote, Heptode, Geissler, Pentagrid, Orthicon and Trochotron register when their modules load |
| `frontend/public/synth/mote.js` | Mote patch schema v1 (`device: 'mote'`), `normalizeMote`, three factory patches, `moteDevice` |
| `frontend/public/synth/mote-dsp.js` | The grain engine: windowed buffer reads, pitch as a read rate, LFO, delay and a short reverb tail |
| `frontend/public/synth/mote.worklet.js` | AudioWorklet processors `mote` and `mote-capture` |
| `frontend/public/synth/mote-ui.js` | The waveform panel, file / mic / rack capture, and `createMoteHost` |
| `frontend/public/synth/geissler.js` | Geissler patch schema v1 (`device: 'geissler'`), `normalizeGeissler`, three factory meadows, `geisslerDevice` |
| `frontend/public/synth/geissler-world.js` | Deterministic 2D meadow: species, seasons, scale and tempo grid, genes, gestures. No clock and no `Math.random` |
| `frontend/public/synth/geissler-dsp.js` | Original voices for reeds, grazers, stalks and flickers, plus the capped voice pool |
| `frontend/public/synth/geissler.worklet.js` | AudioWorklet processor `geissler` |
| `frontend/public/synth/geissler-ui.js` | Meadow canvas, life and route controls, `createGeisslerHost` |
| `frontend/public/synth/pentagrid.js` | Pentagrid patch schema v1 (`device: 'pentagrid'`), the dial's stations, Morse timing, the call-sign exchange, `pentagridDevice` |
| `frontend/public/synth/pentagrid-dsp.js` | The receiver: noise, crackle, fading, heterodynes, formants, Morse, FSK, chimes, time pips, playable beats |
| `frontend/public/synth/pentagrid.worklet.js` | AudioWorklet processor `pentagrid`. Imports the engine; no DSP of its own |
| `frontend/public/synth/pentagrid-ui.js` | The tuning dial, and `createPentagridHost` / `renderPentagridAudio`. `attach` calls `addDevice` |
| `frontend/public/synth/orthicon.js` | Orthicon patch schema v1 (`device: 'orthicon'`), `normalizeOrthicon`, five factory pictures, `orthiconDevice` |
| `frontend/public/synth/orthicon-dsp.js` | The spectral engine: log-frequency grid, brushes, image and audio analysis, additive resynthesis and overlap-add inverse FFT |
| `frontend/public/synth/orthicon.worklet.js` | AudioWorklet processors `orthicon` and `orthicon-capture` |
| `frontend/public/synth/orthicon-ui.js` | The spectrogram panel, and `createOrthiconHost` / `renderOrthiconAudio`. `attach` calls `addDevice` |
| `frontend/public/synth/sources/` | Glass, air and bell: original CC0 WAVs generated by `scripts/build_mote_sources.py` |
| `frontend/public/synth/trochotron.js` | Trochotron patch schema v1 (`device: 'trochotron'`), `normalizeTrochotron`, six factory patches, `trochotronDevice` |
| `frontend/public/synth/trochotron-gen.js` | Deterministic score: L-system, Mandelbrot, Julia, logistic map, Lorenz, Thue-Morse. `pieceOf`, `shareOf`, `midiOf` |
| `frontend/public/synth/trochotron-dsp.js` | Additive voice, score clock, and note edges for routing |
| `frontend/public/synth/trochotron.worklet.js` | AudioWorklet processor `trochotron` |
| `frontend/public/synth/trochotron-ui.js` | Seed panel, fractal canvas, and `createTrochotronHost`. `attach` calls `addDevice` |
| `frontend/public/synth/mixer.js` | Per-device level, pan, mute and solo into the shared ensemble. Defaults are a straight wire |
| `frontend/public/synth/transport.js` | Master clock: tempo 40–240, play/stop, 24 ppq. `clockTicks` and `describeTick` are pure |
| `frontend/public/synth/project.js` | Project JSON (`kind: 'dxrack'`, `v: 1`): both synth patches, mixer, tempo, keyboard device. localStorage key `dxrack_project` |
| `frontend/public/synth/rack.js`, `tubepaint.js`, `knob.js` | Copied from /otr at f9f5d2b (decision 5) plus marked "Filament additions" |
| `frontend/public/synth/fm/` | Hexode, a vendored six-operator FM page (MIT, Matt Montag). The name on the page is Hexode. See `CHANGES.md` and `THIRD_PARTY_NOTICES.md` |
| `frontend/public/synth/acid/` | Anode, a vendored acid bass groovebox (CC BY 4.0, David Whiting / Vitling). The page credits the author. Drums in this copy are synthesized. See `CHANGES.md` |
| `frontend/src/components/Synth.jsx` | Thin iframe shell; tab group "Synth" in `App.jsx`. Links Hexode and Anode |
| `scripts/test_synth.py` | The suite. Must print ALL PASS before any push |
| `scripts/test_synth_imported.py` | Smoke test for Hexode and Anode: they load, stay quiet, and make a sound |
| `docs/filament-licensing.md` | Licensing rules, the register of approved and reference-only resources, notes on our own rights |

## Roadmap

### 0 Groundwork - done 13 Oct 2026
- [x] Copy rack, tube painter and knob from /otr into /synth/ with source headers
- [x] nginx `^~ /synth/` no-cache carve-out, `/synth/` in the sw.js mutable list, CACHE_NAME bump
- [x] Synth.jsx shell and the Synth tab group

### 0.1 First sound - done 13 Oct 2026
- [x] Worklet engine at 2x, half-band decimation, BLEP/BLAMP oscillators, sync, FM, ring, sub, noise, drift
- [x] V1 drive tube; Valve 12 and Ladder 24 (ZDF, one Newton step, pitch-calibrated self-oscillation)
- [x] Amp and filter envelopes, LFO 1, 8-voice poly (to 16), mono, legato, glide, stealing with fades
- [x] On-screen keyboard, computer keyboard, Web MIDI with MIDI learn, pitch and mod strips, sustain
- [x] Output tube pair (single ended / push-pull), speaker, room, width, limiter, mono check
- [x] Chassis: four lit tubes, magic eye, VU pair, CPU/MIDI/audio lamps
- [x] 12 factory patches, user patches in localStorage
- [x] Tests 1-7, 8, 9 (logged), 10, 12 plus UI checks

### 0.2 Character - next (from the graphic EQ), one item per night, in this order
- [ ] Graphic EQ in the rack row (the chain already has it; needs the UI and patch fields)
- [x] Goniometer and correlation meter (copied from /otr into the Stereo section) - 13 Oct, stereo round
- [x] LFO 2 (adds auto-pan), and stereo phase (0-180 degrees) for both LFOs - 13 Oct, stereo round
- [x] Unison 1-8 copies per note with detune and spread (copies come from the 16-voice pool) - 13 Oct, stereo round
- [x] Filter stereo offset (left and right cutoffs apart by up to +/-1 octave; two filters per voice only when in use) - 13 Oct, stereo round
- [ ] Diode 18 filter model (then move the Diode Squelch patch onto it)
- [ ] Sallen-Key 12 (aggressive LP/HP pair, hard-clipping resonance)
- [ ] Poly 24 (OTA cascade)
- [ ] State variable 12 multimode with morph (LP, BP, HP, notch)
- [ ] Low pass gate (vactrol), then move Hollow Pluck onto it
- [ ] Dual filter slots A and B with serial, parallel and split routing
- [ ] Live filter response plot
- [ ] Mod matrix: 8 slots in a drawer (sources: envs, LFOs, velocity, key, wheel, aftertouch, random)
- [ ] Host clock and transport (one shared tempo the arp and LFO sync read). The clock itself landed with the rack framework on 14 Oct (tempo, play/stop, subscriptions). What remains here is the arp and the LFO sync reading it. Neither reads it yet, so no patch sounds different.
- [ ] Arpeggiator: up, down, up-down, random, as played; 1-4 oct; 40-240 BPM; gate, swing, latch
- [x] Ensemble: BBD chorus I, II, I+II, and a three-phase string ensemble - 13 Oct, stereo round
- [ ] Tape echo: mono, ping pong, offset; wow and flutter; tube record amp
- [ ] Spring reverb: two tube-driven springs of different lengths, drip
Done when: every model self-oscillates where it should; mono fold passes for all patches.

### Cathode (second device) - first version done 13 Oct 2026
- [x] Mono semi-modular voice at 2x: VCO 1 (tri, saw, pulse, noise; 32' to 4'), VCO 2 (saw, square,
      narrow, ring; semi, fine, sync), mixer, V1 drive tube, HPF then LPF (2-pole SVF, diode-clipped
      resonance, self-oscillation calibrated to within 1 cent), V2 cathode follower, VCA
- [x] MG (shape morphs ramp down, triangle, ramp up; pulse width follows), EG 1 (delay, attack,
      release), EG 2 (hold, ADSR), S&H, white and pink noise, glide, multi or single trigger
- [x] Patch panel: 18 outputs, 18 inputs with printed normals; click, drag or keyboard to patch;
      a plug can be moved or pulled; knobs that scale a jack name what reaches it
- [x] Rack rail (device switcher); per-device current and user patches; an inactive device lets go,
      fades and sleeps (so does an idle one), so the second device costs nothing while it waits
- [x] 11 factory patches; tests in the C. section of the suite
- [ ] External audio input (the mic or a line in through the filters) - offered, not chosen yet
- [ ] A second Cathode voice for duophonic play, or a poly-chain mode
- [ ] Cathode on the mod matrix and arpeggiator when those land (they should be rack-wide, not Filament-only)

### Dekatron (drum machine) - first version done 14 Oct 2026
Original analog-style drums, not a port of DaisySP or any other drum model (the register allows a
DaisySP port; this one is written from the ordinary drum vocabulary: a pitch that falls, noise
through a band, a handful of noise bursts, a short wood block). No third-party samples.
- [x] Seven voices in `drums.worklet.js` at 2x with a Kaiser half-band decimator: kick, snare,
      closed hat, open hat, clap, tom, rim. The two hats cut each other.
- [x] 16-step pattern: per-step on/off, an accent lane, swing (full swing is a triplet, and the
      next on-beat stays on the grid), pattern length 1 to 16. Internal clock, or an external tick.
- [x] Its own panel (transport, step grid, voice knobs) in the house style, on the rack rail next
      to Filament and Cathode. The keys play the voices: C kick, C# rim, D snare, D# clap, F tom,
      F# closed hat, A# open hat, in any octave.
- [x] Six factory patterns (Relay, Late Shift, Brush, Spark, Walk, Dozen). Tests in the D. section.
- [x] On the shared host clock. `createDrumHost.attach` calls `registerDevice(drumDevice)` and
      `addDevice('dekatron', node)`, and the pattern follows `engine.transport` (play, stop, tempo,
      24 pulses a quarter). The worklet's own clock remains for a render that has no transport.

The host adapter is `drumDevice` in `drums.js` (the `dxrack/1` descriptor) and `create` in
`drums-ui.js`. It does not import Filament's engine. The page calls `engine.registerDevice(drumDevice)`
and `engine.addDevice('dekatron', node)`, and the pattern follows `engine.transport`.

```js
registerDevice({
  id: 'dekatron', name: 'Dekatron', vendor: 'DX Edge', version: '1',
  api: 'dxrack/1', instrument: true, audioInputs: 0, audioOutputs: 1, midiInput: true,
  parameters: { 'seq.bpm': { id, label, type: 'float', default, min, max }, /* ... */ },
  async create(ctx, host) {
    const output = /* stereo AudioWorkletNode, processor 'dekatron' */;
    host.transport.subscribe(ev => { /* play | stop | tempo | clock (24 ppq) */ });
    return output;
  },
});
```

| | |
|-|-|
| Identity | `id: 'dekatron'`, `api: 'dxrack/1'`, `processor: 'dekatron'`, `worklet: 'drums.worklet.js'`, one stereo output, 2x oversampling |
| Patch | `normalize(patch)` → schema v1 JSON, `device: 'dekatron'`. `parameters` is the dxrack/1 table (`level`, `seq.*`, `voices.<id>.<knob>`). Steps and the accent lane are pattern data, not knobs. |
| Notes | `voiceForNote(midiNote)` → a voice id, or null. `midi([0x90, note, vel])` is how a host plays a pad. |
| Messages | `{t:'patch', p}`, `{t:'trig', voice, v}`, `{t:'transport', playing, clock, step}`, `{t:'tick'}`, `{t:'panic'}`, `{t:'active', on}`. Optional `at` is a frame time. |
| Clock | With `host.transport`: play, stop, tempo, and `clock` pulses at 24 per quarter. A step is 6 pulses; swing delays an odd step by up to 2 pulses, and the next even step stays on the grid. Without a transport, the worklet fires step i at `stepSeconds(i, bpm, swing)`. |
| Meters | Worklet posts `{t:'meter'}` and `{t:'step', step, length, playing}` |

### Lattice (wavetable) - first version done 14 Oct 2026
Original wavetable instrument for sound exploration. The panel is flat (slate, one blue accent),
not the tube chassis. Vital and Surge XT were read for ideas only (wavetable position, warp,
a modulation matrix). No line was copied or translated. The factory cycles are additive waveforms
generated in `lattice-dsp.js`. AKWF (CC0) was not shipped.
- [x] Two wavetable oscillators, position morph, animated 3D stack and 2D cycle
- [x] Warp: bend, sync, PWM-style, FM from oscillator B
- [x] Unison with detune and stereo spread; sub; noise
- [x] Two multi-mode filters (low, high, band, notch), serial or parallel
- [x] Modulation matrix, drag a source onto a destination: 4 drawable LFOs, 3 envelopes, velocity, mod wheel, 4 macros. The route bar shows the live amount
- [x] Import a WAV file as oscillator A's table (period detection, then the same mipmaps)
- [x] Eight factory presets: pads, a pluck, a bass, keys, a lead, evolving textures
- [x] 2x oversampling, mipmapped tables, Kaiser half-band decimator. Tests in the W. section

The host adapter is `latticeDevice` in `lattice.js` and `create` in `lattice-ui.js`. The page calls
`engine.registerDevice(latticeDevice)` and `engine.addDevice('lattice', node)` when the node attaches.
The patch stays on `lattice_cur`. A project may name Lattice as the keyboard device.

| | |
|-|-|
| Identity | `id: 'lattice'`, `api: 'dxrack/1'`, `processor: 'lattice'`, `worklet: 'lattice.worklet.js'`, one stereo output, 2x oversampling |
| Patch | `normalizeLattice(patch)` → schema v1 JSON, `device: 'lattice'`. `parameters` is the dxrack/1 table |
| Messages | `{t:'patch', p}`, `{t:'on', n, v}`, `{t:'off', n}`, `{t:'bend', v}`, `{t:'mw', v}`, `{t:'sus', on}`, `{t:'panic'}`, `{t:'active', on}`, `{t:'table', data}`, `{t:'macro', i, v}`. Optional `at` is a frame time |
| Meters | Worklet posts `{t:'meter'}` with voices, cpu, oscillator positions, LFO values, envelope values, slot amounts, peak |

### Thyratron (monophonic ladder) - first version done 14 Oct 2026
Original monophonic synthesizer. Three oscillators with footage and waveform, oscillator 3 able to
leave the keyboard and run as the mod-wheel source, a mixer with noise and a short feedback path,
and a 24 dB/octave ladder low-pass. Full emphasis lets the ladder sing on the cutoff; keyboard
tracking can put that whistle on the note. Two contours are attack, decay and sustain, and letting
go uses the decay time. Glide is an exponential slew in semitones whose time constant is the glide
knob. The pitch wheel and the mod wheel are applied after the glide, so they move at once. The note
stack is last-note priority: releasing a covered key does not release the voice. No third-party
synth code. The ladder is four trapezoidal integrators with saturating feedback and one Newton step,
written and tuned for this voice.
- [x] `thyratron.worklet.js` at 2x with its own Kaiser half-band (27 taps). Asleep until the rail selects it.
- [x] On the rack rail, with its own wood-and-black panel, patch list and mixer strip. The keys, pitch wheel, mod wheel and sustain pedal play it.
- [x] Six factory presets: Walnut Bass, Pilot Lead, Herald Brass, Arc Sweep, Crypt Wail, Bone Rattle. The last two are Halloween.
- [x] Tests in the T. section: non-silent presets, self-oscillation, glide timing, and no stuck notes.

| | |
|-|-|
| Identity | `id: 'thyratron'`, `api: 'dxrack/1'`, `processor: 'thyratron'`, `worklet: 'thyratron.worklet.js'`, one stereo output, 2x oversampling |
| Patch | `normalizeThy(patch)` → schema v1 JSON, `device: 'thyratron'`. Stored on `thyratron_cur`, the same way Dekatron keeps its pattern. A project may name Thyratron as the keyboard device. |
| Messages | `{t:'patch', p}`, `{t:'on', n, v}`, `{t:'off', n}`, `{t:'bend', v}`, `{t:'mw', v}`, `{t:'sus', on}`, `{t:'panic'}`, `{t:'active', on}`. Optional `at` is a frame time. |

### Gleam (touch field) - done 14 Oct 2026
Original touch instrument. The name, the scales, the gesture tape and the room are ours. It is not
a copy of any performance pad. No third-party DSP and no new dependency.

| | |
|-|-|
| Identity | `id: 'gleam'`, `api: 'dxrack/1'`, `processor: 'gleam'`, `worklet: 'gleam.worklet.js'`, one stereo output into the mixer |
| Patch | `normalizeGleam(patch)` → schema v1 JSON, `device: 'gleam'`. Modes `field`, `room`, `effect`. Scales major, minor, pentatonic, chromatic, free. |
| Field | Each pointer is a voice. X is pitch (root at the left, `octaves` across). Y is timbre (sine toward saw, one-pole lowpass that keeps the fundamental). Pressure or contact size is level. |
| Room | Orbs around a listener at the origin. Pan follows X. Distance lowers the dry gain and raises the room send. Optional HRTF is a `PannerNode` per voice, built only while that switch is on. Orbit and drift are automatic motion. |
| Gestures | A tape of `{t, type, id, x, y, z}`. Looping replays from the start of the take, so a finger still down at the end is up at the top. Stopping the loop releases those voices. |
| Effect | While a finger is down in effect mode, the pad inserts on the rack master: X sweeps a lowpass, Y is delay feedback, Z stutters only if the patch asks for it. Finger up is a straight wire again. The insert is not in the path otherwise, so a bypassed master stays a bypassed master. |
| Page | The rail hosts it. `/synth/gleam/` is the same pad full screen. `touch-action: none` is on the pad only. |
| Messages | `{t:'patch'}`, `{t:'voice', id, slot, on, hz, y, level, pan, gain, send}`, `{t:'on'}`, `{t:'off'}`, `{t:'panic'}`, `{t:'active', on}`. Optional `at` is a frame time. |

### Mote (granular instrument) - first version
Original grains. A stored buffer is read in short windows. Pitch is how fast that read moves.
signalsmith-stretch was considered and not used. No granular-player source was copied. The panel
is a slate and cyan view of the waveform, not the tube chassis.
- [x] Load a WAV or MP3 (file input or drop), record the microphone, or capture the rack output into a new buffer
- [x] Waveform with a draggable grain region and live grain marks
- [x] Size, density, position, spray, pitch, pitch randomness, reverse probability, window, stereo spread, freeze, keyboard mode
- [x] LFO on one of those, plus a delay and a short reverb tail on the device
- [x] Three factory patches (Drift Glass, Keyed Glass, Air Bed) and three generated CC0 sources
- [x] Tests in the Mo. section

`moteDevice` in `mote.js` is the `dxrack/1` descriptor. `mote.js` calls `registerDevice` when the page imports it. `createMoteHost.attach` calls `addDevice('mote', node)`.

```js
registerDevice({
  id: 'mote', name: 'Mote', vendor: 'DX Edge', version: '1',
  api: 'dxrack/1', instrument: true, audioInputs: 0, audioOutputs: 1, midiInput: true,
  processor: 'mote', worklet: 'mote.worklet.js',
  parameters: { 'grain.size': { id, label, type: 'float', default, min, max }, /* ... */ },
  async create(ctx, host) { /* stereo AudioWorkletNode, processor 'mote' */ },
});
```

| | |
|-|-|
| Identity | `id: 'mote'`, `api: 'dxrack/1'`, `processor: 'mote'`, `worklet: 'mote.worklet.js'`, one stereo output |
| Patch | `normalizeMote(patch)` → schema v1 JSON, `device: 'mote'`. `parameters` includes `grain.*`, `lfo.*`, `tail.*`, `level`, `source` |
| Notes | Keyboard mode: MIDI note 60 is the buffer's own pitch. Note 72 is an octave up. With keyboard mode off, notes are ignored and the cloud plays on its own. Loading a buffer stops grains that were reading the previous file and clears the delay and reverb. Stopping the cloud (freeze released into keyboard mode with no notes) still leaves that tail in the output |
| Messages | `{t:'patch', p}`, `{t:'on', n, v}`, `{t:'off', n}`, `{t:'bend', v}`, `{t:'mw', v}`, `{t:'sus', on}`, `{t:'panic'}`, `{t:'active', on}`, `{t:'buffer', L, R, sr, name}` |
| Sources | `glass`, `air`, `bell` are shipped files. `file`, `mic` and `rack` are buffers kept for the session, not in the JSON |
| Meters | Worklet posts `{t:'meter', grains, voices, cpu, level, position, parts}` |

### Heptode (MIDI-file instrument) - first version
Original multitimbral player. A packed score runs inside the AudioWorklet, not on a page timer.
Every channel starts as the same clean voice (a sine leaning toward a triangle, a gentle envelope,
no drive and no effects). A program number may pick a family envelope only. The player then morphs
that voice per channel: wave, FM amount, filter and envelope, drive, and sends into a delay, a chorus,
and a short reverb. An XY field places each channel in the stereo image.
- [x] Drag in any .mid, or pick a bundled file. Tempo, loop, mute, solo, and a performance cap for very dense files
- [x] Piano roll drawn on a canvas, including files with more than 100,000 notes
- [x] Gentle randomize, and a morph between two stored mixes
- [x] Sixteen channels, pitch bend, mod, sustain, expression, pan, volume, program change, and tempo changes
- [x] Voice stealing under a polyphony cap. Performance mode culls notes that cannot be heard
- [x] Tests in the H. section

`heptodeDevice` in `heptode.js` is the `dxrack/1` descriptor. `heptode.js` calls `registerDevice` when the page imports it. `createHeptodeHost.attach` calls `addDevice('heptode', node)`, so the master recorder hears it.

```js
registerDevice({
  id: 'heptode', name: 'Heptode', vendor: 'DX Edge', version: '1',
  api: 'dxrack/1', instrument: true, audioInputs: 0, audioOutputs: 1, midiInput: true,
  processor: 'heptode', worklet: 'heptode.worklet.js',
  parameters: { level: { id, label, type: 'float', default, min, max }, /* poly, tempo, fx.* */ },
  async create(ctx, host) { /* stereo AudioWorkletNode, processor 'heptode' */ },
});
```

| | |
|-|-|
| Identity | `id: 'heptode'`, `api: 'dxrack/1'`, `processor: 'heptode'`, `worklet: 'heptode.worklet.js'`, one stereo output |
| Patch | `normalizeHeptode(patch)` → schema v1 JSON, `device: 'heptode'`. Sixteen `tracks`, each with wave, fm, filter, envelope, drive, sends, pan, space |
| Start | Wave near a sine, fm 0, drive 0, sends 0. A program may change the envelope and the wave only |
| Score | `smf.js` with `{ wide: true }` keeps program change and CC 7, 10, 11, 6, 100, 101, 120, 121, 123. The deck's default read is unchanged |
| Voices | Pool of 32. Performance mode uses at most 16 and drops notes shorter than 12 ms or quieter than velocity 8 |
| Messages | `{t:'patch', p}`, `{t:'score', score, bpm}`, `{t:'play'}`, `{t:'stop'}`, `{t:'seek', pos}`, `{t:'on', tr, n, v}`, `{t:'off', tr, n}`, `{t:'cc', tr, c, v}`, `{t:'bend', tr, v}`, `{t:'panic'}`, `{t:'active', on}` |
| Library | Seven CC0 sequences in `frontend/public/synth/heptode/midi/`. Five are original reductions of public-domain pieces, one is an original tune, one is a generated density test |

### Geissler (generative meadow) - first version
Original ecosystem. Four species share a 2D field and only make a sound when something happens.
Reeds hum a drone, grazers pluck, stalks play a low hit with a short noise burst, flickers chirp a short motif.
A meeting, a meal, a birth and a death each schedule one note. A child blends the parents' pitch and rhythm genes, then mutates.
Position is pan, size is level, energy is brightness. A scale and a tempo grid quantize every note, and free leaves both alone.
A season slowly shifts the key and the mood. The same seed is the same meadow. The voice pool is capped.
Each species can stay in the meadow or play another device in the rack.
- [x] Canvas meadow: tap for food or a creature, drag to herd
- [x] Population cap, birth, death, mutation, food, season, seed
- [x] Rack MIDI routes per species
- [x] Master WAV recorder hears the meadow
- [x] Tests in the Gs. section

`geisslerDevice` in `geissler.js` is the `dxrack/1` descriptor. `geissler.js` calls `registerDevice` when the page imports it. `createGeisslerHost.attach` calls `addDevice('geissler', node)`, so the master recorder hears it.

```js
registerDevice({
  id: 'geissler', name: 'Geissler', vendor: 'DX Edge', version: '1',
  api: 'dxrack/1', instrument: true, audioInputs: 0, audioOutputs: 1,
  midiInput: true, midiOutput: true,
  processor: 'geissler', worklet: 'geissler.worklet.js',
  parameters: { cap: { id, label, type, default, min, max }, /* birth, seed, scale, ... */ },
  async create(ctx, host) { /* stereo AudioWorkletNode, processor 'geissler' */ },
});
```

| | |
|-|-|
| Identity | `id: 'geissler'`, `api: 'dxrack/1'`, `processor: 'geissler'`, `worklet: 'geissler.worklet.js'`, one stereo output, MIDI in and out |
| Patch | `normalizeGeissler(patch)` → schema v1 JSON, `device: 'geissler'`. Caps, rates, scale, grid, seed, and one route per species |
| World | `geissler-world.js`. xorshift32 from the seed. No `Math.random`, no `Date`. A tick is 1/30 s |
| Voices | Pool of at most 16. Reed drone, graze pluck, stalk bass plus a noise burst, flicker motif. A death is a falling decaying tone |
| Messages | `{t:'patch', p}`, `{t:'tap'}`, `{t:'food'}`, `{t:'spawn'}`, `{t:'herd'}`, `{t:'panic'}`, `{t:'active', on}`, `{t:'tempo', bpm}`, `{t:'reseed', seed}` |
| Routes | `self`, or Filament, Cathode, Thyratron, Lattice, Gleam, Dekatron, Mote, Heptode, Pentagrid, Orthicon, Trochotron. Default is the meadow |

### Orthicon (spectral painter) - first version
Original picture-to-sound device. The picture is a grid, time across and log frequency up.
A playhead scans it. Additive resynthesis plays one sine per row. Inverse FFT is an overlap-add
of the same rows, with phase advanced at the partial's own frequency. Brushes are soft, hard,
harmonic (an overtone stack), noise, and eraser. Smear, blur, shift, stretch, freeze and quantize
edit the grid. A dropped image or an analysed recording becomes the picture. The grid is not
stored in the patch; a preset rebuilds its picture.
- [x] Paint, drop a PNG or JPG, and analyse a file, the microphone, or the rack
- [x] Scan speed, loop, hold, frequency range, brightness curve, coherent or random phase
- [x] Keys mode: MIDI note 60 is the picture's own pitch
- [x] Five generated pictures: Ember Ridge, Lantern Stack, Veil, Glyph Keys, Fifth Drone
- [x] Tests in the Or. section. The master recorder names the file Orthicon when it is the device playing

`orthiconDevice` in `orthicon.js` is the `dxrack/1` descriptor. `orthicon.js` calls `registerDevice` when the page imports it. `createOrthiconHost.attach` calls `addDevice('orthicon', node)`, so the master recorder hears it.

```js
registerDevice({
  id: 'orthicon', name: 'Orthicon', vendor: 'DX Edge', version: '1',
  api: 'dxrack/1', instrument: true, audioInputs: 0, audioOutputs: 1, midiInput: true,
  processor: 'orthicon', worklet: 'orthicon.worklet.js',
  parameters: { level: { id, label, type: 'float', default, min, max }, /* speed, fLo, fHi, curve, phase, engine */ },
  async create(ctx, host) { /* stereo AudioWorkletNode, processor 'orthicon' */ },
});
```

| | |
|-|-|
| Identity | `id: 'orthicon'`, `api: 'dxrack/1'`, `processor: 'orthicon'`, `worklet: 'orthicon.worklet.js'`, one stereo output |
| Patch | `normalizeOrthicon(patch)` → schema v1 JSON, `device: 'orthicon'`. The picture id is stored. The grid is not |
| Pictures | `ridge`, `lantern`, `veil`, `glyph`, `drone` are generated. `custom` keeps the session grid |
| Scan | Columns per second, loop, hold (a frozen column). Frequency range is log, default 80 Hz to 8 kHz |
| Resynthesis | `add` is one sine per row. `ifft` is a 4096-point overlap-add, hop 1024. Coherent phase steps at the partial's frequency. Random phase picks a new angle each column or hop |
| Keys | Off: the picture plays itself. On: silent until a note. Note 60 does not transpose. Six voices |
| Messages | `{t:'patch', p}`, `{t:'grid', data}`, `{t:'on', n, v}`, `{t:'off', n}`, `{t:'bend', v}`, `{t:'mw', v}`, `{t:'sus', on}`, `{t:'panic'}`, `{t:'active', on}` |
| Capture | Capture rack is an input. It analyses the rack into the picture. The red rec button is the WAV export |

### Trochotron (fractal seed instrument) - first version
Original instrument. A seed and the settings grow one piece. The same inputs grow it again.
The walk is selectable: an L-system (the axiom and the rules stay on screen), a Mandelbrot or
Julia orbit (the picture is on screen; drag moves the window and the wheel zooms, and the piece
follows), the logistic map (chaos sets r from 2.8 to 4), a Lorenz orbit, or a Thue-Morse parity
with a digit sum. Lead, mid and bass are the same line at three time scales. The built-in voice
plays it, or the notes can be routed to another device on the rack. Export is a `.mid` file.
A link carries the seed and the settings (`?tr=`).
- [x] Seed field and a random seed
- [x] Six walks, depth, scale, key, tempo, density, chaos, three layers, timbre
- [x] Fractal picture in time with the notes
- [x] `.mid` export and a share link
- [x] Master recorder hears it
- [x] Tests in the Fr. section

`trochotronDevice` in `trochotron.js` is the `dxrack/1` descriptor. `trochotron.js` calls `registerDevice` when the page imports it. `createTrochotronHost.attach` calls `addDevice('trochotron', node)`, so the master recorder hears it.

```js
registerDevice({
  id: 'trochotron', name: 'Trochotron', vendor: 'DX Edge', version: '1',
  api: 'dxrack/1', instrument: true, audioInputs: 0, audioOutputs: 1, midiInput: true,
  processor: 'trochotron', worklet: 'trochotron.worklet.js',
  parameters: { seed: { id, label, type: 'float', default, min, max }, /* generator, depth, chaos, zoom */ },
  async create(ctx, host) { /* stereo AudioWorkletNode, processor 'trochotron' */ },
});
```

| | |
|-|-|
| Identity | `id: 'trochotron'`, `api: 'dxrack/1'`, `processor: 'trochotron'`, `worklet: 'trochotron.worklet.js'`, one stereo output |
| Patch | `normalizeTrochotron(patch)` → schema v1 JSON, `device: 'trochotron'` |
| Piece | `pieceOf(patch)` is pure. Same seed and settings, same notes |
| Share | `shareOf` / `parseShare`. The page reads `?tr=` |
| MIDI | `midiOf(piece)` writes a format 1 file through `smf.js`. Bass, mid and lead are separate tracks |
| Route | `internal`, or filament, cathode, thyratron, gleam, dekatron, lattice, mote, heptode, geissler, pentagrid, orthicon |
| Messages | `{t:'patch', p}`, `{t:'piece', notes, bpm}`, `{t:'play'}`, `{t:'stop'}`, `{t:'on', n, v}`, `{t:'off', n}`, `{t:'panic'}`, `{t:'active', on}` |

### Pentagrid (shortwave receiver) - first version
Original receiver. The dial is a frequency in kHz. A station is heard when its offset sits inside
the bandwidth. CW, a bare carrier and a close pair become a tone at the beat with the BFO, so
tuning moves the pitch. AM audio (time pips, chimes, digit tones, the FSK warble) keeps its own
pitch. Speech is three formant resonators on a pulse, slid by the tuning error: the off-tune
single-sideband voice. Every sound is synthesized. No broadcast recording is used, and no station
call from the air is copied. The Morse alphabet and the 1.2/WPM element are the published timing,
written out in this file.
- [x] Tuning dial, BFO, bandwidth, AGC, noise blanker, fading, band conditions
- [x] Band noise, atmospheric crackle, QSB, heterodyne whistles
- [x] User Morse at a set WPM, and a made-up call-sign exchange
- [x] RTTY/FSK warble, original chime-and-digit groups, time pips
- [x] Play mode: the keyboard is a carrier and a close beat
- [x] Live conditions from `GET /api/solar` when that route answers; the knob remains the control
- [x] Tests in the Pg. section

`pentagridDevice` in `pentagrid.js` is the `dxrack/1` descriptor. `pentagrid.js` calls `registerDevice` when the page imports it. `createPentagridHost.attach` calls `addDevice('pentagrid', node)`, so the master recorder hears it.

```js
registerDevice({
  id: 'pentagrid', name: 'Pentagrid', vendor: 'DX Edge', version: '1',
  api: 'dxrack/1', instrument: true, audioInputs: 0, audioOutputs: 1, midiInput: true,
  processor: 'pentagrid', worklet: 'pentagrid.worklet.js',
  parameters: { tune: { id, label, type: 'float', default, min, max }, /* bfo, bandwidth, level */ },
  async create(ctx, host) { /* stereo AudioWorkletNode, processor 'pentagrid' */ },
});
```

| | |
|-|-|
| Identity | `id: 'pentagrid'`, `api: 'dxrack/1'`, `processor: 'pentagrid'`, `worklet: 'pentagrid.worklet.js'`, one stereo output |
| Patch | `normalizePentagrid(patch)` → schema v1 JSON, `device: 'pentagrid'` |
| Dial | 3500–30000 kHz. Stations are round frequencies with names written for this device |
| Morse | Dit is 1.2/WPM seconds, dah three, intra-letter one, letter gap three, word gap seven |
| Conditions | `cond` 0–1. `/api/solar` `band_conditions` maps poor 0.15, fair 0.4, good 0.7, excellent 0.95 |
| Messages | `{t:'patch', p}`, `{t:'on', n, v}`, `{t:'off', n}`, `{t:'bend', v}`, `{t:'mw', v}`, `{t:'sus', on}`, `{t:'panic'}`, `{t:'active', on}` |

### MIDI files: recorder and player (James, 13 Oct 2026) - done 13 Oct 2026
James chose: a recorder and player strip with a WAV render button; imported tracks are assigned to
devices (so Filament and Cathode play at once); built by the nightly job. Two slices; if both do not
fit in one night, ship slice 1 and leave slice 2 unchecked here.
- [x] Slice 1: `smf.js`, the recorder with .mid export, import with the track list, the player - 13 Oct
- [x] Slice 2: Render WAV (imported file or take, both devices, rack included) - 13 Oct, same run

Calls made while building it (James can overrule any of them):
- A track named "Filament: ..." or "Cathode: ..." (our own exports) goes back to that device on import,
  ahead of the other defaults, so a take round-trips.
- A track with notes on several channels (every format 0 file) is split into one row per channel.
- If the first melodic track is also the lowest, the lowest of the other tracks goes to Cathode.
- A track with no notes (only bend or pedal) follows the note track on its channel, or is off.
- Export writes Filament on MIDI channel 1 and Cathode on channel 2, at 120 BPM.
- Render WAV renders whatever was played last (the file or the take); if nothing has been played, the
  file if one is loaded, else the take. It uses the tempo control and the selected device's rack settings,
  adds a 2 s tail, and writes 16-bit without dither.
- A tempo change while playing lands where scheduling has reached (up to 150 ms later), so events are
  never sent out of order.
- APIs added, for whoever builds on this: `smf.js` exports `readSMF`, `songOf`, `tickTimer`,
  `writeSMF`, `bytesOf`; `deck.js` exports `createDeck(api)`, `defaultAssign`, `scoreOfSong`,
  `encodeWav`; the engine has `E.sendTo(dev, msg)`, `E.playing(dev, on)`, and `renderOffline` takes
  `{patches, device, events:[{at, dev, ...}], onProgress}`; the worklets take `{t:'play', on}` and
  `{t:'flush'}`. Test hooks: `__synth.deck()`, `__synth.smf`, `__synth.render2`.
- Both slices landed together: the build fit in one run, and James's note allowed slice 2 the same
  night. Nothing is left on this item beyond the known limits below.
- Known limits: the keyboard and the player share note numbers on a device, so releasing a key the
  player is also holding lets go of the player's note; switching devices while playing turns sustain off
  on the device you leave. Neither seemed worth the extra plumbing yet.

Spec (what "done" means):
- **Our own Standard MIDI File code** in a new `frontend/public/synth/smf.js`: pure functions, no DOM,
  no dependency (licensing rule 1; @tonejs/midi is allowed by the register but we do not need it).
  Read format 0 and 1 (format 2: play its tracks one after another, or refuse with a clear message),
  running status, note on with velocity 0 as note off, tempo meta events including tempo changes
  mid-file, time signature, track names, end of track; skip sysex and unknown metas; ticks per quarter
  division (refuse SMPTE division with a message). Channel events kept: notes, pitch bend, CC 1 (mod
  wheel), CC 64 (sustain), channel and poly pressure (as aftertouch); program changes ignored. Write
  format 1 at 480 ticks per quarter: a tempo track (tempo, 4/4) plus one track per device used, each
  named "Filament: <patch>", "Cathode: <patch>" or "Dekatron: <patch>".
- **Recorder** (a strip next to the keyboard, phone friendly, 44 px targets): Rec arms; the first
  note starts the take; it captures notes and velocities, bend, mod wheel, sustain and aftertouch
  from every input (on-screen keys, computer keys, MIDI keyboard) with the device each event went to.
  Stop, Play (replays through the same devices), Clear, Export .mid (downloads
  `filament-take-YYYYMMDD-HHMM.mid`). Show take length and note count.
- **Import**: a button (file input accepting .mid, .midi, audio/midi) and drag and drop onto the
  strip. Show file name, length and a track list: name, channel(s), note count, and chips per track
  for Filament, Cathode, Dekatron or off. Defaults: channel 10 to Dekatron;
  a single melodic track goes to the selected device; with several, the first goes to Filament, the
  lowest-pitched to Cathode, the rest to Filament. Remember assignments while the file stays loaded.
- **Player**: play, stop, loop, a tempo control (50 to 200% of the file's tempo, the file's own tempo
  map underneath), position readout, and the on-screen keys light for playback notes. Schedule
  ahead from the main thread (about 150 ms lookahead, 25 ms timer) and send each event to the worklet
  with `at` set to its exact frame (the engine already supports timestamped events). Stop sends note
  offs for every sounding playback note, sustain off, bend 0, wheel 0.
- **Both devices at once** (engine): add a way to send events to a named device
  (`E.sendTo(dev, msg)`, creating its node if needed). Today an inactive device lets go of its keys
  and Cathode fades out on `{t:'active', on:false}`; playback notes routed to the inactive device
  must still sound, so the fade and the sleep must respect playback (for example a per-device
  playback flag that holds the device awake while the player runs). The keyboard keeps playing the
  selected device. The shared rack keeps taking its settings from the selected device's patch.
- **Render WAV** (slice 2): `renderOffline` grows a two-device form (both patches, events tagged with
  their device); render the loaded file or the take with the rack, 48 kHz stereo, 16-bit WAV, capped
  at 10 minutes, with a progress note and a download.
- **Tests** (scripts/test_synth.py): SMF round trip (write then read gives the same events and
  timing); hand-built byte fixtures for format 0 and 1 with running status, velocity-0 note offs and a
  mid-file tempo change, read back to the right times; a measured render of an imported two-note
  melody (pitch and onset within 5 ms at 120 BPM and after the tempo change); a two-track file with
  one track on Filament (a chord) and one on Cathode (a bass line) renders both (both sets of
  frequencies present); channel 10 is off by default; the recorder captures notes driven through
  `__synth` and its export parses back with timing within 5 ms; the UI imports a file with
  set_input_files, play lights the keys, stop releases every note, export triggers a download; phone
  widths have no horizontal scroll with the strip open.

### Rack framework - done 14 Oct 2026
The core a step sequencer or a drum machine plugs into, without changing Filament's or Cathode's sound.
- [x] Device contract in `device.js` (descriptor, parameter table, MIDI in, stereo out, versioned patch). Shaped after the published Web Audio Modules 2.0 ideas; our own code, the package was not copied (see `docs/filament-licensing.md`)
- [x] Mixer: per-device level, pan, mute, solo, summed into the shared ensemble and output tubes. Defaults are a straight wire
- [x] Transport and master clock: tempo, play/stop, clock events a device subscribes to (`device.subscribe(fn)`, 24 pulses per quarter, stamped with AudioContext time)
- [x] Project save/load: JSON, localStorage (`dxrack_project`) plus file download and upload. Reopening the page brings the tempo, mixer and name back; Load saved or an upload also brings the patches and which device the keyboard plays
- [x] Filament and Cathode migrated onto it. Tests in the R. section of the suite

Device API, for the next device (a step sequencer, a drum machine):

```js
import { registerDevice, RACK_API } from './device.js';

registerDevice({
  id: 'drums',                 // stable id
  name: 'Drums',               // our own name, no other product's
  vendor: 'DX Edge',
  version: '1',
  api: RACK_API,               // 'dxrack/1'
  description: '',
  instrument: true,            // makes sound from notes
  audioInputs: 0,
  audioOutputs: 1,             // one stereo output
  midiInput: true,
  midiOutput: false,
  parameters: {                // stable ids. See parameterTable() for the shape
    'kick.level': { id: 'kick.level', label: 'kick.level', type: 'float', default: 0.8, min: 0, max: 1 },
  },
  // Optional. If present, the host calls it. Filament and Cathode use `processor` instead
  // (an AudioWorklet name) and the engine builds the node.
  async create(ctx, host) {
    const output = ctx.createGain();           // stereo AudioNode the mixer taps
    host.transport.subscribe(ev => {           // ev.type: 'play' | 'stop' | 'tempo' | 'clock'
      // ev.tempo, ev.playing, ev.beat, ev.bar, ev.beatInBar, ev.timeSig
      // ev.time is AudioContext seconds; ev.tick is the pulse index (24 per quarter)
      // ev.frame is that time in samples, for a worklet message { ..., at: ev.frame }
    });
    return output;                             // or { node, output }
  },
});

// On a running engine (window.__synth.engine(), or createEngine's return):
//   E.devices.filament.parameterInfo()
//   E.devices.filament.getParameter('filt.cutoff')
//   E.devices.filament.setParameter('filt.cutoff', 1200)   // clamped, smoothed
//   E.devices.filament.getPatch() / setPatch(json, load)
//   E.devices.filament.midi([0x90, 60, 100])               // raw bytes, or {t, n, v}
//   E.devices.filament.subscribe(fn)                       // clock events; returns unsubscribe
//   E.mix.set('drums', { level: 0.8, pan: -0.2, mute: false, solo: false })
//   E.mix.attach('drums', outputNode)                      // or E.addDevice(id, node, patch)
//   E.transport.play() / stop() / setTempo(bpm) / state()
// A project is { v:1, kind:'dxrack', name, tempo, timeSig:[4,4], device, mixer, devices:{ id: { patch } } }.
// normalizeProject() fills gaps. Centre pan and level 1 do not change the signal.
```

### Song library - done 14 Oct 2026
The deck is unchanged (own SMF reader, private tempo). This is a second strip: a sample library, open, and drop. Playback is the rack transport. Channel 10 goes to Dekatron when that device is registered (a note-on becomes a `{t:'trig'}` for the voice `voiceForNote` picks). If Dekatron is absent, channel 10 goes to an id named `drums`, otherwise off. The first melodic channel goes to Filament, the second to Cathode, the rest to Filament. A file's own tempo map is not followed; loading a song sets the transport to the file's first tempo.
- [x] `@tonejs/midi` 2.0.28 vendored (MIT, with `midi-file` and `array-flatten`). The deck does not use it
- [x] 12 library files sequenced in `scripts/build_midi_library.mjs`, plus the Halloween set below. MIDI data is CC0. Compositions are public domain or original
- [x] Track list, per-channel device chips, loop, keys light for playback notes
- Known limits: the deck and the library can both be playing; they share note numbers on a device, same as the deck's own limit. A tempo change while playing lands at the schedule horizon (up to 150 ms later). Playing a song also starts the rack clock, so Dekatron's step pattern follows it

### Halloween pack - done 14 Oct 2026
Presets use each device's own patch schema. Filament and Cathode use the category `Halloween`. Dekatron adds two patterns in that category, Lantern and Bones.
- [x] Filament: Haunted Organ, Theremin Wail, Horror Pad, Creaky Drone, Ghost Choir, Sub Heartbeat, Glass Music Box, Eerie Bells
- [x] Cathode: Chapel Organ, Wail Glide, Cellar Drone, Creak Pulse, Choir Breath, Heartbeat, Glass Tine, Bell Jar
- [x] Dekatron: Lantern, Bones
- [x] Six public-domain excerpts (Bach toccata, a slow organ reduction; Grieg, In the Hall of the Mountain King; Saint-Saëns, Danse macabre; Mussorgsky, Night on Bald Mountain; Chopin, Funeral March; the Dies irae sequence) and three original tunes (Lantern Walk, Cellar Stairs, Porch Ghost). Each loads its Filament and Cathode preset. Mountain King and Porch Ghost also load Lantern; Cellar Stairs loads Bones. Those three files have a channel-10 closed-hat part that plays on Dekatron. Sources are in `docs/filament-licensing.md` and `midi/catalog.json`

### 0.3 Delight
- [ ] 1939 mode (divide-down, LC resonators, seven envelope shapes, six-channel vibrato)
- [ ] Punched paper roll step sequencer
- [ ] Theremin mode with the magic eye as tuning indicator
- [ ] Share links (`?p=`), JSON export/import, Surprise me
- [x] WAV recording (10 minute cap) - 14 Oct, master bus: live record and offline render, 24-bit 44.1 kHz stereo. (The MIDI file render in slice 2 is a separate button: 48 kHz 16-bit of a take. Still open.)
- [ ] Tube view, faces (walnut, studio rack black, black light), lava lamp module
- [ ] About 40 factory patches
Done when: share link round trip test passes.

### Master bus (14 Oct 2026)
Delay, reverb and a compressor/limiter on the master, after Filament, Cathode and the rack. Each one bypasses on its own; with all three off the master is a straight wire (the worklet is not in the path). The delay syncs to a tempo on the strip (40–240 BPM, straight, dotted and triplet divisions, or a free time) and can ping-pong. The reverb is our own code for the public-domain Freeverb structure (see `docs/filament-licensing.md`). The compressor is original, with an optional ceiling limiter. Record and Render WAV write a 24-bit, 44.1 kHz stereo file, capped at 10 minutes. Nothing in a device patch changed, so factory patches sound the same until a master effect is switched on.

## Open items for James
- Play it on the new keyboard and on a phone: is the Novachord Strings default the right first sound?
- CPU on a real mid-range phone (headless Chrome on the build server: about 20% of real time for
  8 voices including the rack). The budget is 40%. WebAssembly is the fallback if a phone misses it.

- Stereo offset or a stereo-phase cutoff LFO on Ladder 24 can thin out in mono: two 4-pole filters an
  octave apart are up to 180 degrees out of phase between their cutoffs. Valve 12 (2-pole) stays within
  about 2.5 dB. Factory patches are kept within 3 dB (test 7); the correlation meter goes amber below 0.
  A fully mono-safe version would need a third (centre) filter per voice; not done, CPU.

- Listen to the MIDI deck: record a take across both devices, import a few real .mid files (a GM
  song with drums, a format 0 file), and render one to WAV. The tests check timing, pitch and routing,
  not how a busy GM file sounds on two synth voices. The calls made while building it are listed under
  the MIDI files section; any of them can change.

## Notes from James
(write here; the nightly run reads this first)
- 2026-10-13 (afternoon): **Tonight's run (Oct 13, 11:52 PM) builds MIDI files: recorder and player**,
  per the spec in its roadmap section above (James chose recorder and player with WAV render, tracks
  assigned to devices, built by the nightly job). Slice 1 first; slice 2 (Render WAV) the same night
  if it fits, otherwise the next night. After both slices are ticked, resume the 0.2 list at the
  graphic EQ. Licensing rule 1 applies: write the MIDI file reader and writer ourselves.
- 2026-10-13: Cathode (the second device) shipped from an interactive session just after midnight.
  The nightly list carries on at the graphic EQ. When the EQ lands, make it rack-wide (it sits in the
  shared output chain, so both devices' patches carry the same `out` fields).
- 2026-10-13 (night of Oct 12 PT): the stereo round (unison, filter stereo offset, LFO 2 with stereo
  phase, goniometer and correlation, ensemble) shipped from an interactive session. Tonight's 11:52 PM
  run (Oct 12): bug check only, no roadmap item. From the following night, resume the list from the
  first unchecked item (the graphic EQ).

## Nightly log
- 2026-10-15 (interactive): Orthicon, a spectral painter, on the rack rail beside Geissler and Pentagrid. A log-frequency picture is painted, dropped in as an image, or analysed from a file, the microphone, or the rack, then scanned back into sound. Additive resynthesis and an overlap-add inverse FFT. Brushes are soft, hard, harmonic, noise, and eraser. Smear, blur, shift, stretch, freeze, and quantize edit the picture. Keys mode transposes it, with C4 at the picture's own pitch. Five generated pictures. Capture rack is an input. The red rec button records Orthicon. Geissler can route a species to Orthicon or Pentagrid. Original engine; no spectral-paint source was copied. Rebased onto Pentagrid (model 11, mixer O). Cache `dxedge-v88`. Suite: ALL PASS (731 checks). `scripts/test_synth_imported.py`: ALL PASS. CPU (test 9, headless): Cathode 8.7%; Filament 8 voices 11.4% (Ladder 24) and 11.0% (Valve 12); stereo offset 12.8%; 16 voices with ensemble 17.8%. Dekatron Spark 4.8% (drums only). Thyratron Walnut Bass, one note, 3.0% (voice only). Mote Drift Glass 3.1% (grains only). Lattice Glass Pad, one note, 13.8% (Lattice only). Pentagrid, carrier plus one play note, 4 s offline in 83 ms (2.1% of real time, receiver only). Recorded Orthicon 441.4 Hz matches live 441.4 Hz, level x1.00. No Filament or Cathode voice code changed.
- 2026-10-15 (interactive): Pentagrid, a shortwave receiver, on the rack rail. Original AudioWorklet: dial, band noise, crackle, fading, heterodynes, formant speech, Morse at a set WPM, a made-up call-sign exchange, FSK, chimes, digit tones, and time pips. Play mode turns the keys into those beats. Band conditions can follow `GET /api/solar`. No recordings. Rebased onto main after Geissler and the SOTA/DX Summit removal. The red rec button records Pentagrid. Cache `dxedge-v87`. Suite: ALL PASS (701 checks). `scripts/test_synth_imported.py`: ALL PASS. CPU (test 9, headless): Cathode 10.3%; Filament 8 voices 11.6% (Ladder 24) and 11.0% (Valve 12); stereo offset 12.5%; 16 voices with ensemble 17.3%. Dekatron Spark 6.8% (drums only). Thyratron Walnut Bass, one note, 2.9% (voice only). Mote Drift Glass 2.6% (grains only). Lattice Glass Pad, one note, 13.1% (Lattice only). Pentagrid, carrier plus one play note, 4 s offline in 78 ms (2.0% of real time, receiver only). No Filament or Cathode voice code changed.
- 2026-10-15 (interactive): Geissler, a generative meadow, on the rack rail. Reeds, grazers, stalks and flickers wander a seeded 2D world and play on meetings, meals, births and deaths. A child blends pitch and rhythm genes. Position is pan, size is level, energy is brightness. Scale, tempo grid, and a free mode. Seasons shift the key. Species can route to other rack devices. Voice pool capped at 16. The red rec button records Geissler. Original oscillators; no third-party DSP. Cache `dxedge-v86`. Suite: ALL PASS (668 checks). `scripts/test_synth_imported.py`: ALL PASS. CPU (test 9, headless): Cathode 10.1%; Filament 8 voices 12.4% (Ladder 24) and 12.1% (Valve 12); stereo offset 14.3%; 16 voices with ensemble 18.5%. Dekatron Spark 5.2% (drums only). Thyratron Walnut Bass, one note, 3.1% (voice only). Mote Drift Glass 3.0% (grains only). Lattice Glass Pad, one note, 14.2% (Lattice only). No Filament or Cathode voice code changed.
- 2026-10-15 (interactive): Trochotron, a fractal seed instrument, on the rack rail beside Geissler and Pentagrid. A seed grows a piece (L-system, Mandelbrot, Julia, logistic map, Lorenz, or a digit sequence). The same seed and the same settings are the same notes. Drag and zoom on the Mandelbrot or Julia picture change the piece while it plays. Notes can stay on the built-in voice or go to another rack device, including Pentagrid. Export is a `.mid` file, and `?tr=` is the share link. The red rec button records Trochotron. Plate is model 11; Pentagrid stays model 10. Cache `dxedge-v88`. Suite: ALL PASS (734 checks). `scripts/test_synth_imported.py`: ALL PASS. CPU (test 9, headless): Cathode 9.6%; Filament 8 voices 13.0% (Ladder 24) and 12.4% (Valve 12); stereo offset 14.7%; 16 voices with ensemble 20.2%. Dekatron Spark 5.2% (drums only). Thyratron Walnut Bass, one note, 3.3% (voice only). Mote Drift Glass 3.2% (grains only). Lattice Glass Pad, one note, 15.1% (Lattice only). Pentagrid, carrier plus one play note, 4 s offline in 94 ms (2.4% of real time, receiver only). No Filament or Cathode voice code changed.
- 2026-10-14 (interactive): Heptode, a MIDI-file player, on the rack rail. Every channel starts as one plain voice. Per track: wave and FM, filter and envelope, drive, delay, chorus and reverb sends, and an orb on the stereo field. Packed score playback in the AudioWorklet, with a polyphony cap and a performance cull for files past 100,000 notes. Library is original sequences of public-domain pieces, an original tune (Glass Arcade), and a generated density file. Rebased onto the master-recorder fix. The red rec button records Heptode. Loading a buffer into Mote clears that device's delay and reverb so the new source is not heard through the previous tail. Cache `dxedge-v84`. Suite: ALL PASS (631 checks). `scripts/test_synth_imported.py`: ALL PASS. CPU (test 9, headless): Cathode 8.6%; Filament 8 voices 11.6% (Ladder 24) and 10.8% (Valve 12); stereo offset 12.6%; 16 voices with ensemble 17.5%. Dekatron Spark 4.6% (drums only). Thyratron Walnut Bass, one note, 2.9% (voice only). Mote Drift Glass 2.8% (grains only). Lattice Glass Pad, one note, 13.9% (Lattice only). No Filament or Cathode voice code changed.
- 2026-10-14 (interactive): Mote, a granular instrument, on the rack rail. Original grain engine in an AudioWorklet. File, microphone, and rack-capture sources. Glass, air and bell are generated CC0 sounds. signalsmith-stretch was not used. The keyboard map was not edited. Rebased onto Thyratron and Gleam. Cache `dxedge-v82`. Suite: ALL PASS (545 checks). CPU (test 9, headless): Cathode 9.1%; Filament 8 voices 11.5% (Ladder 24) and 11.0% (Valve 12); stereo offset 12.6%; 16 voices with ensemble 17.3%. Dekatron Spark 4.6% (drums only). Thyratron Walnut Bass, one note, 2.7% (voice only). Mote Drift Glass 2.7% (grains only). Lattice Glass Pad, one note, 13.1% (Lattice only). No Filament or Cathode voice code changed.
- 2026-10-14 (interactive): Gleam, a touch field, on the rack rail and full screen at `/synth/gleam/`. Each pointer is a voice (across is pitch on a chosen scale, up is timbre, pressure is level). A room of orbs sets pan and distance, with optional HRTF, and orbs can orbit or drift. Gestures record and loop. Effect mode inserts a lowpass, stutter and delay on the rack master only while a finger is down. Original code, no third-party DSP. Rebased onto Thyratron and Lattice. Cache `dxedge-v81`. Suite: ALL PASS (514 checks). CPU (test 9, headless): Cathode 9.8%; Filament 8 voices 12.1% (Ladder 24) and 11.0% (Valve 12); stereo offset 13.5%; 16 voices with ensemble 17.9%. Dekatron Spark 4.7% (drums only). Thyratron Walnut Bass, one note, 2.8% (voice only). Lattice Glass Pad, one note, 13.5% (Lattice only). No Filament or Cathode voice code changed.
- 2026-10-14 (interactive): Thyratron, a monophonic ladder-filter device on the rack. Three oscillators (oscillator 3 can run as the mod-wheel source), mixer with noise and feedback, 24 dB/octave ladder that sings at full emphasis, two ADS contours, glide, pitch and mod wheels. Wood-and-black panel and six presets (Walnut Bass, Pilot Lead, Herald Brass, Arc Sweep, Crypt Wail, Bone Rattle). Registered in `device.js`. A reload onto Thyratron or Lattice builds the shared output knobs from the Filament patch. Rebased onto the stuck-key fix and Lattice. Cache `dxedge-v80`. Suite: ALL PASS (478 checks). CPU (test 9, headless): Cathode 9.3%; Filament 8 voices 11.6% (Ladder 24) and 11.5% (Valve 12); stereo offset 12.4%; 16 voices with ensemble 17.4%. Dekatron Spark 4.6% (drums only). Thyratron Walnut Bass, one note, 2.8% (voice only). Lattice Glass Pad, one note, 13.3% (Lattice only). No Filament or Cathode factory patch changed.
- 2026-10-14 (interactive): Lattice, a wavetable device, on the rack rail. Two mipmapped oscillators, warp (bend, sync, PWM-style, FM from oscillator B), unison, sub, noise, two multi-mode filters, a drag-and-drop modulation matrix, and WAV import. The panel is flat. Factory cycles are generated in the repo; Vital and Surge were reference only, and AKWF was not shipped. Cache `dxedge-v79`. Suite: ALL PASS (442 checks, including the stuck-key checks that landed on main the same day). CPU (test 9, headless): Cathode 8.5%; Filament 8 voices 11.7% (Ladder 24) and 11.0% (Valve 12); stereo offset 12.8%; 16 voices with ensemble 17.9%. Dekatron Spark 4.6% (drums only). Lattice Glass Pad, one note, 13.3% (Lattice only). No Filament or Cathode voice code changed.
- 2026-10-14 (interactive): Hexode and Anode on their own pages, linked from the rack. Hexode (`/synth/fm/`) is dx7-synth-js, MIT, Matt Montag, pinned `f269f0e`. Anode (`/synth/acid/`) is The Endless Acid Banger, CC BY 4.0, David Whiting (Vitling), pinned `bb93d97`; the page credits him, and the drums in this copy are synthesized. Cache `dxedge-v78`. Suite: ALL PASS (370 checks). `scripts/test_synth_imported.py`: ALL PASS. CPU (test 9, headless): Cathode 8.4%; Filament 8 voices 12.6% (Ladder 24) and 10.8% (Valve 12); stereo offset 12.9%; 16 voices with ensemble 17.2%. Dekatron Spark 4.6% (drums only).
- 2026-10-14 (interactive): song library merged onto the rack. Channel 10 routes to Dekatron (a note-on becomes a drum trigger). Mountain King, Cellar Stairs and Porch Ghost have a closed-hat part; those songs load Lantern or Bones. Dekatron's factory set is eight patterns, including those two. Cache `dxedge-v77`. Suite: ALL PASS (370 checks). CPU (test 9, headless): Cathode 8.6%; Filament 8 voices 11.6% (Ladder 24) and 11.0% (Valve 12); stereo offset 12.6%; 16 voices with ensemble 18.5%. Dekatron Spark 4.5% (drums only).
- 2026-10-14 (interactive): song library and Halloween pack. A second strip plays MIDI on the rack transport (play, stop, tempo) with each channel routed to a device. The deck still uses `smf.js` and its own clock. `@tonejs/midi` 2.0.28 is vendored (MIT, with midi-file and array-flatten); notices are in `THIRD_PARTY_NOTICES.md`. 21 CC0 sequences: 12 library tunes (Beethoven 5, Bach toccata, two Joplin rags, Sousa, Greensleeves, Oh! Susanna, St. Louis Blues, Frankie and Johnny, and three original demos) plus a Halloween set (Bach organ reduction, Grieg Mountain King, Saint-Saëns Danse macabre, Mussorgsky Bald Mountain, Chopin Funeral March, Dies irae, and three original spooky tunes). Halloween songs load matching Filament and Cathode factory presets. Dekatron is not in this build. No Filament or Cathode voice code changed. Commits `7cd8b0e` and `2890077`. Suite: ALL PASS (308 checks). CPU (test 9, headless): Cathode 8.9%; Filament 8 voices 12.1% (Ladder 24) and 11.6% (Valve 12); stereo offset 13.2%; 16 voices with ensemble 18.4%.
- 2026-10-14 (interactive): the rack framework. Device contract (`device.js`, dxrack/1), mixer (level, pan, mute, solo; defaults are a straight wire into the shared ensemble), master clock (tempo, play/stop, 24 ppq, devices subscribe), project JSON in localStorage plus download and upload. Filament and Cathode sit on it; their voices were not edited. The 0.2 host-clock item stays open for the arp and LFO sync, which do not read the clock yet. Commit `e367a43`. Suite: ALL PASS (254 checks; 26 new in R. and the phone rack tab). CPU (test 9, headless): Cathode 8.6%; Filament 8 voices 11.3% (Ladder 24) and 10.8% (Valve 12); stereo offset 12.5%; 16 voices with ensemble 17.3%. No factory patch changed and no existing sound changed.
- 2026-10-14 (interactive): master delay, reverb and compressor, and 24-bit WAV, landed on the rack. The bus sits after the mixer's master output. Effects off is a straight wire, and a bypassed offline render does not build the worklet. Cache `dxedge-v76`. Suite: ALL PASS (314 checks). CPU (test 9, headless): Cathode 8.5%; Filament 8 voices 11.0% (Valve 12); stereo offset 12.7%; 16 voices with ensemble 17.4%. Ladder 24, 8 voices, measured 12.3% on the same build (the suite's own line was split by a server log). Dekatron Spark 4.9% (drums only). No factory patch changed. With the bus bypassed, Filament and Cathode sound the same.
- 2026-10-14: Master bus (delay, Freeverb-style reverb, compressor/limiter) and 24-bit 44.1 kHz WAV record/render. New modules plus the master-output hook in `engine.js`. Suite: ALL PASS (211 checks), including measurable effect, transparent bypass, and a valid non-silent WAV. Landed later the same day, after the rack and Dekatron, with the bus after the mixer.
- 2026-10-14 (interactive): Dekatron on the rack. The drum machine registers with `registerDevice` and `addDevice`, its pattern follows the master clock, and the mixer has a Dekatron strip. The pattern stays on `dekatron_cur`; a project may name Dekatron as the keyboard device. Cache `dxedge-v75`. The 0.2 host-clock item stays open for the arp and LFO sync. Suite: ALL PASS (293 checks; the D. section, the phone pattern page, and the rack checks). CPU (test 9, headless): Cathode 8.5%; Filament 8 voices 11.5% (Valve 12); stereo offset 12.9%; 16 voices with ensemble 17.6%. Ladder 24, 8 voices, measured 12.4% on the same build (the suite's own line was split by a server log). Dekatron Spark, pattern running, 4.5% (drums only). No factory patch changed and no existing Filament or Cathode sound changed.
- 2026-10-14 (interactive): the rack framework. Device contract (`device.js`, dxrack/1), mixer (level, pan, mute, solo; defaults are a straight wire into the shared ensemble), master clock (tempo, play/stop, 24 ppq, devices subscribe), project JSON in localStorage plus download and upload. Filament and Cathode sit on it; their voices were not edited. The 0.2 host-clock item stays open for the arp and LFO sync, which do not read the clock yet. Rebased onto the slashless `/synth` fix: the worker claims its clients before activate finishes, and the cache is `dxedge-v74` (v73 was already live). Suite: ALL PASS (256 checks; the R. section, the phone rack tab, and the two slashless checks). CPU (test 9, headless): Cathode 9.2%; Filament 8 voices 11.8% (Ladder 24) and 11.0% (Valve 12); stereo offset 13.0%; 16 voices with ensemble 17.3%. No factory patch changed and no existing sound changed.
- 2026-10-13 (manual run, Oct 13 afternoon; built about 2:15 to 2:40 PM PT by the scheduled task fired by hand, pushed from the interactive session because the task's own push was refused by its environment): bug check clean (suite ALL PASS 190, live page no errors, sw.js v71 matched). Built MIDI files, both slices, per Notes from James: `smf.js` (our own reader and writer), `deck.js` (recorder, .mid export, import with track list and device chips, player with loop and tempo 50-200%, Render WAV), `E.sendTo` and a playback hold in the engine (`{t:'play'}` keeps an inactive Cathode awake; `{t:'flush'}` drops queued playback events on stop), and a two-device `renderOffline`. Found and fixed during the build: Stop could leave a note stuck when its note off was already scheduled but not yet played (now every note playback touched is released; regression check added). Commit `2b5ed70`. Suite: ALL PASS (228 checks; 38 new in M. and the phone deck). CPU (test 9, headless, final run): Cathode 14.7%; Filament 8 voices 18.9% (Ladder 24) and 20.0% (Valve 12); stereo offset 23.6%; 16 voices with ensemble 30.3%. No patch changed and no existing sound changed; the deck adds no DSP to the voices. Since this ran in the afternoon, tonight's 11:52 PM run should find both slices ticked and resume the 0.2 list at the graphic EQ, as the note says.
- 2026-10-13 (just after midnight PT, interactive): Cathode, the second device, and the rack rail (see the Cathode section above). Suite: ALL PASS (190 checks). CPU: Cathode Plate Screamer about 17% of real time with the rack; Filament 8 voices 27 to 32% (this server varies run to run). No Filament patch changed; Filament now sleeps when silent for 100 ms, which only saves CPU.
- 2026-10-13: Phase 0 and 0.1 shipped from an interactive session. Suite: ALL PASS (103 checks).
