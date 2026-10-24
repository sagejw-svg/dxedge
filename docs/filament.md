# Filament (/synth/) build status

The single source of truth for where the synth build is. The nightly build task reads this file
first and updates it last. James can write in **Notes from James** and the next run acts on it.

Design brief: the claude.ai project doc `dxedge-synth-design.md` (project "DX Edge Synth").
Decisions in force: name Filament, path `/synth/`, standalone page plus a main-page tab next to OTR,
Ko-fi tip link to https://ko-fi.com/oldtimeradio, /otr code is COPIED into `/synth/` (never edit
/otr for the synth), warm-up off by default, vanity domain later, Web MIDI in 0.1.
Long-term goal: a rack of devices in the spirit of Reason (Propellerhead). Keep the synth a device
with a clean boundary: parameter table, MIDI in, stereo out, versioned patch JSON.

The rack now holds eighteen devices: **Filament** (poly, the tube synth), **Cathode** (mono,
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
sound), **Trochotron** (a fractal seed instrument: one seed and one set of settings grow one
piece), **Gyrotron** (a gravity sequencer: bodies orbit wells, and a collision or a crossing
plays a note), **Klystron** (a talk box: a carrier shaped by a vowel, a recording, or the microphone), **Phantastron** (a circuit-bent toy: a clocked voice and an on-screen board you drag
wires across), **Additron** (an additive organ: drawn harmonics, stops, and a rotary speaker), **Rhumbatron** (a physical model: a string, a bore, or a plate), and **Resnatron** (a modular patch bay: modules are cavities, and you drag the cables between them). The rail above the chassis picks which device the keyboard, wheels and MIDI play. Filament
and Cathode feed the shared ensemble and output rack. Dekatron copies those output fields. Lattice,
Thyratron, Gleam, Mote, Heptode, Geissler, Pentagrid, Orthicon, Trochotron, Gyrotron, Klystron, Phantastron, Additron, Rhumbatron and Resnatron have their own panels
and sleep until the rail selects them; the shared output knobs stay on the Filament patch while one
of those is showing. Mote, Heptode, Geissler, Pentagrid, Orthicon, Trochotron, Gyrotron, Klystron, Phantastron, Additron, Rhumbatron and Resnatron hide the tube
chassis while lit. Dekatron and Lattice register when their nodes are hosted. Thyratron and Gleam
are registered in `device.js`. Mote, Heptode, Geissler, Pentagrid, Orthicon, Trochotron, Gyrotron, Klystron, Phantastron, Additron, Rhumbatron and Resnatron register
when their modules load.
Gleam is also a full-screen page at `/synth/gleam/`. Iris is a camera instrument at `/synth/iris/`, linked from the rack the way Hexode and Anode are: the picture stays in the browser, and a scan line, the color, the motion, or the edges become the sound.

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
| `frontend/public/synth/device.js` | Device contract (`dxrack/1`): `registerDevice`, `getDevice`, `listDevices`, `parameterTable`. Filament, Cathode, Thyratron and Gleam are registered here; Dekatron and Lattice register when their nodes are hosted; Mote, Heptode, Geissler, Pentagrid, Orthicon, Trochotron, Gyrotron, Klystron, Phantastron, Additron, Rhumbatron and Resnatron register when their modules load |
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
| `frontend/public/synth/phantastron.js` | Phantastron patch schema v1 (`device: 'phantastron'`), `normalizePhantastron`, six factory patches, the bend pads, `phantastronDevice` |
| `frontend/public/synth/phantastron-dsp.js` | Clocked source-filter toy: three resonators, a short DAC, sample-and-hold, a feedback comb |
| `frontend/public/synth/phantastron.worklet.js` | AudioWorklet processor `phantastron` |
| `frontend/public/synth/phantastron-ui.js` | The bend board and `createPhantastronHost`. `attach` calls `addDevice` |
| `frontend/public/synth/rhumbatron.js` | Rhumbatron patch schema v1 (`device: 'rhumbatron'`), `normalizeRhumbatron`, factory bodies, `rhumbatronDevice` |
| `frontend/public/synth/rhumbatron-dsp.js` | Plucked, struck, bowed, and blown cavities |
| `frontend/public/synth/rhumbatron.worklet.js` | AudioWorklet processor `rhumbatron` |
| `frontend/public/synth/rhumbatron-ui.js` | The cavity panel and `createRhumbatronHost`. `attach` calls `addDevice` |
| `frontend/public/synth/resnatron.js` | Resnatron patch schema v1 (`device: 'resnatron'`), `normalizeResnatron`, four starter patches, `shareOf` / `parseShare`, `resnatronDevice` |
| `frontend/public/synth/resnatron-dsp.js` | The patch bay voice. Each cable is a one-sample delay |
| `frontend/public/synth/resnatron.worklet.js` | AudioWorklet processor `resnatron` |
| `frontend/public/synth/resnatron-ui.js` | The bay, drag cables, and `createResnatronHost`. `attach` calls `addDevice` |
| `frontend/public/synth/iris/` | Iris, a camera instrument on its own page. `iris.js` is the patch and the pixel measurements, `iris-dsp.js` the voice, `iris.worklet.js` the processor, `iris-ui.js` the panel |
| `frontend/public/synth/mixer.js` | Per-device level, pan, mute and solo into the shared ensemble. Defaults are a straight wire |
| `frontend/public/synth/transport.js` | Master clock: tempo 40–240, play/stop, 24 ppq. `clockTicks` and `describeTick` are pure |
| `frontend/public/synth/project.js` | Project JSON (`kind: 'dxrack'`, `v: 1`): both synth patches, mixer, tempo, keyboard device. localStorage key `dxrack_project` |
| `frontend/public/synth/rack.js`, `tubepaint.js`, `knob.js` | Copied from /otr at f9f5d2b (decision 5) plus marked "Filament additions" (in rack.js: the push-pull stage, mono check, ceiling, ensemble, and the graphic EQ's presets, fitting, resampling and live spectrum tap) |
| `frontend/public/synth/fm/` | Hexode, a vendored six-operator FM page (MIT, Matt Montag). The name on the page is Hexode. See `CHANGES.md` and `THIRD_PARTY_NOTICES.md` |
| `frontend/public/synth/acid/` | Anode, a vendored acid bass groovebox (CC BY 4.0, David Whiting / Vitling). The page credits the author. Drums in this copy are synthesized. See `CHANGES.md` |
| `frontend/src/components/Synth.jsx` | Thin iframe shell; tab group "Synth" in `App.jsx`. Links Hexode and Anode |
| `scripts/test_synth.py` | The suite. Must print ALL PASS before any push |
| `scripts/test_synth_imported.py` | Smoke test for Hexode and Anode: they load, stay quiet, and make a sound |
| `scripts/bench_filament_voice.mjs` | Filament voice worklet in Node with a seeded random: CPU per case, and with `--ref <git ref>` an A/B that says whether the output is bit-identical. For CPU work; not part of the suite |
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
- [x] Graphic EQ in the rack row (the chain already has it; needs the UI and patch fields) - built 13 Oct, landed on main 16 Oct (nightly).
      Rack-wide: both devices' patches carry `out.eqOn`, `eqBands` (10, 15 or 31), `eqGains`, `eqPre` (level,
      +/-12 dB) and `eqPreset`; the rack follows the lit device like the rest of `out`. Off by default, so no
      patch changed. Presets: flat, warm, smile, bass lift, presence, air, mid scoop, low cut, AM radio.
- [x] Goniometer and correlation meter (copied from /otr into the Stereo section) - 13 Oct, stereo round
- [x] LFO 2 (adds auto-pan), and stereo phase (0-180 degrees) for both LFOs - 13 Oct, stereo round
- [x] Unison 1-8 copies per note with detune and spread (copies come from the 16-voice pool) - 13 Oct, stereo round
- [x] Filter stereo offset (left and right cutoffs apart by up to +/-1 octave; two filters per voice only when in use) - 13 Oct, stereo round
- [x] Diode 18 filter model (then move the Diode Squelch patch onto it) - 21 Oct 2026 (nightly).
      Three coupled poles: each node charges through a diode pair (tanh of the voltage across it) and
      loads the node before it by half; negative feedback from the last pole. Our own nodal equations,
      trapezoidal, solved per sample as one 3x3 system with the diode slopes taken at the last estimate
      (no iteration, no allocation). Self-oscillates from 0.9 on resonance and tracks the keys (test 1);
      below that the node frequency is lifted so the zero-resonance passband sits near Ladder 24's for the
      same knob. Diode Squelch now uses it (retuned: cutoff 240, resonance 0.86, envelope 0.6, voice
      level 0.5 to keep its level).
- [x] Sallen-Key 12 (aggressive LP/HP pair, hard-clipping resonance) - 23 Oct 2026 (nightly).
      Low-pass: two RC sections and a gain stage K that feeds back through the first capacitor; our own
      state equations for the two capacitor voltages, trapezoidal, solved per sample as a 2x2 system with
      the clip linearised at the last sample (no iteration, no allocation). Zero resonance is the flat
      (Butterworth) point, K = 3 - sqrt(2), so the knob is the -3 dB point; K reaches 3 and it sings at 0.9
      on resonance, and full resonance takes K to 3.6, so the wave squares off. The gain stage clips with a
      sharp knee, at 1.5 on the positive side and 1.2 on the negative, which adds even harmonics. The output
      is divided by K, so the passband keeps its level and the peak and the clip carry the character. The
      high-pass partner (`filt.hp`, 20 Hz to 4 kHz, all the way down is off) is the same build with the R
      and C roles swapped, in front of the low-pass, with half the low-pass's resonance. It only acts on
      Sallen-Key 12. New factory patch Snarl Lead (Lead) uses it. No other patch changed.
- [x] Poly 24 (OTA cascade) - 24 Oct 2026 (nightly).
      Four transconductance stages: each charges its capacitor with a current that saturates on the voltage
      across the stage (input minus its own output, through a tanh), and the resonance comes back from the last
      stage through a soft-clipping amplifier (clip level 0.5). Our own formulation: each stage's tanh(d)/d and
      the feedback clip's are taken at the last sample, so every stage is a trapezoidal one-pole and the loop is
      solved in closed form (no iteration, no allocation). Linearly it is the same four poles as Ladder 24, so
      the cutoff and slope match it exactly; the differences are where it bends. The voltage across each stage is
      scaled by 0.5 before its tanh, so a normal note stays nearly linear and drive is what makes the stages slew
      (a loud 2 kHz tone over a 500 Hz cutoff loses 0.1 dB at drive 3 and 2.5 dB at drive 10; Ladder 24 loses
      6.5 dB at drive 10). 60% of the passband the feedback takes away is made up (Ladder 24: 45%), so it keeps
      more bass as resonance rises (100 Hz under a 1 kHz cutoff at resonance 0.85: -3.1 dB, Ladder 24 -4.7 dB).
      Sings from 0.9 on resonance, a near sine at about -12 dBFS (H3 -53 dB), tuned within 1 cent from C3 to C8
      after a measured flat-pitch correction. New factory patch Velvet Brass (Pad) uses it. No other patch changed.
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
| Hold | `hold` latches the fingers that are down, and any MIDI notes, so the sound stays after the pointer or the key lifts. Toggle hold off, or press Panic (the gleam bar, Escape, or the rack panic), to release those voices. Panic also clears the hold flag. A cancelled pointer still releases. |
| Generator | `generator` is `off`, `walk`, `orbit`, `lissajous`, `drift`, or `arp`. It drives one XY point and a voice on its own. `rate` is cycles or notes per second, `depth` is how far the point travels (or how much of the scale an arpeggio climbs), `seed` repeats the same path. An arpeggio's seed picks up, down, up-down, or a shuffle. The generator keeps its own voice, so it plays together with a finger and with hold. In effect mode it moves the master sweep, and a finger blends with that point. Panic silences it for a moment; if the generator is still on, the next frame starts it again. |
| Room | Orbs around a listener at the origin. Pan follows X. Distance lowers the dry gain and raises the room send. Optional HRTF is a `PannerNode` per voice, built only while that switch is on. Orbit and drift are automatic motion. The generator can also move one orb. |
| Gestures | A tape of `{t, type, id, x, y, z}`. Looping replays from the start of the take, so a finger still down at the end is up at the top. Stopping the loop releases those voices. |
| Effect | While a finger is down in effect mode, the pad inserts on the rack master: X sweeps a lowpass, Y is delay feedback, Z stutters only if the patch asks for it. Finger up is a straight wire again, unless hold is on or the generator is driving the sweep. The insert is not in the path otherwise, so a bypassed master stays a bypassed master. |
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
| Routes | `self`, or Filament, Cathode, Thyratron, Lattice, Gleam, Dekatron, Mote, Heptode, Pentagrid, Orthicon, Trochotron, Gyrotron, Phantastron. Default is the meadow |

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
| Route | `internal`, or filament, cathode, thyratron, gleam, dekatron, lattice, mote, heptode, geissler, pentagrid, orthicon, gyrotron, phantastron |
| Messages | `{t:'patch', p}`, `{t:'piece', notes, bpm}`, `{t:'play'}`, `{t:'stop'}`, `{t:'on', n, v}`, `{t:'off', n}`, `{t:'panic'}`, `{t:'active', on}` |

### Phantastron (circuit-bent toy) - first version
Original instrument. A phantastron is a vacuum-tube Miller timebase: a ramp that holds until
something pulls it off. Here that ramp is the clock of a cheap talking toy. The voice is a
made-up phrase (vowels, chirps, a beep, or a sine) through three resonators, a short DAC, and a
sample-and-hold. Nothing is a sample and no speech ROM was copied. The board on screen is the
bend: drag a wire from VCC, GND, CLK, NSE or OUT onto RATE, BITS, LOOP, FB, PITCH or FORM.
One wire per bend. The same pair again lifts it.
- [x] Six carts, clock, bits, loop, feedback, form, noise, pitch, seed, run
- [x] On-screen board: touch and drag wires between bend points
- [x] Clock speed, bit crush, a stuck loop, and feedback
- [x] Keys, pitch and mod wheels, sustain, Panic
- [x] Master recorder hears it
- [x] Tests in the Ph. section

`phantastronDevice` in `phantastron.js` is the `dxrack/1` descriptor. `phantastron.js` calls `registerDevice` when the page imports it. `createPhantastronHost.attach` calls `addDevice('phantastron', node)`, so the master recorder hears it.

```js
registerDevice({
  id: 'phantastron', name: 'Phantastron', vendor: 'DX Edge', version: '1',
  api: 'dxrack/1', instrument: true, audioInputs: 0, audioOutputs: 1, midiInput: true,
  processor: 'phantastron', worklet: 'phantastron.worklet.js',
  parameters: { bits: { id, label, type: 'int', default, min, max }, /* clock, cart, loop, feedback, run */ },
  async create(ctx, host) { /* stereo AudioWorkletNode, processor 'phantastron' */ },
});
```

| | |
|-|-|
| Identity | `id: 'phantastron'`, `api: 'dxrack/1'`, `processor: 'phantastron'`, `worklet: 'phantastron.worklet.js'`, one stereo output |
| Patch | `normalizePhantastron(patch)` → schema v1 JSON, `device: 'phantastron'` |
| Carts | `lull`, `count`, `chirp`, `bark`, `tone`, `babble`. Babble is a seeded phrase. Tone is a sine at the note times the clock |
| Bends | `bendOf(patch, signals)`. VCC pulls a bend high, GND sticks it low, CLK and NSE and OUT follow the signal |
| Board | Pads in `PADS`. `toggleWire` keeps one wire per destination |
| Messages | `{t:'patch', p}`, `{t:'on', n, v}`, `{t:'off', n}`, `{t:'bend', v}`, `{t:'mw', v}`, `{t:'sus', on}`, `{t:'panic'}`, `{t:'active', on}` |
| Plate | Model 15. Klystron stays model 14. Gyrotron stays model 13. Trochotron stays model 12 |

### Resnatron (modular patch bay) - first version
Original instrument. A resnatron is a cavity tetrode: the anode and the grids are resonant cavities.
Here each cavity is a module, and a cable is the beam between them. Nothing is pre-wired. Drag a
gold output onto a silver input, or tap one and then the other. One cable per input. Starters:
Cavity Saw, Bunch Glass, Reed Drift, Twin Cavity. Copy link writes `?rn=`. Monophonic, last note
wins, and every cable is a one-sample delay so a feedback loop stays finite. Panic clears the
notes, the envelope and the delay, and holds the output quiet until the next note. The red rec
button records it. Copyleft modular instruments were reference only; no code from them is here.
- [x] Oscillators, noise, LFO, sample and hold, envelope, mixer, filter, VCA, delay, out
- [x] Drag and click cables, touch and mouse
- [x] Four starter patches and a share link
- [x] Keys, pitch and mod wheels, sustain, Panic
- [x] Master recorder hears it
- [x] Tests in the Rn. section

`resnatronDevice` in `resnatron.js` is the `dxrack/1` descriptor. `resnatron.js` calls `registerDevice` when the page imports it. `createResnatronHost.attach` calls `addDevice('resnatron', node)`, so the master recorder hears it.

```js
registerDevice({
  id: 'resnatron', name: 'Resnatron', vendor: 'DX Edge', version: '1',
  api: 'dxrack/1', instrument: true, audioInputs: 0, audioOutputs: 1, midiInput: true,
  processor: 'resnatron', worklet: 'resnatron.worklet.js',
  parameters: { 'vco1.wave': { id, label, type: 'choice', default }, /* cables, cutoff, delay */ },
  async create(ctx, host) { /* stereo AudioWorkletNode, processor 'resnatron' */ },
});
```

| | |
|-|-|
| Identity | `id: 'resnatron'`, `api: 'dxrack/1'`, `processor: 'resnatron'`, `worklet: 'resnatron.worklet.js'`, stereo, mixer letter S, plate model 18 |
| Patch | `normalizeResnatron(patch)` → schema v1 JSON, `device: 'resnatron'` |
| Cables | One per input. The last cable to a destination wins. Invalid ports are dropped |
| Share | `shareOf` / `parseShare`. The page reads `?rn=` |
| Voice | Last note. The envelope follows the keyboard gate when its gate jack is empty. A VCO with kbd off holds middle C |
| Messages | `{t:'patch', p}`, `{t:'on', n, v}`, `{t:'off', n}`, `{t:'bend', v}`, `{t:'mw', v}`, `{t:'sus', on}`, `{t:'panic'}`, `{t:'active', on}` |
| Plate | Model 18. Rhumbatron stays model 17. Additron stays model 16. Phantastron stays model 15. Klystron stays model 14. Cache `dxedge-v95` |

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

### '73-style monosynth (fourth synth device) - queued 13 Oct 2026, after the tube show; NAME NEEDED
James asked for "a mini moog 73". Like Cathode, this is an original device in that family, not a copy:
own name (James chose **Anode** on 13 Oct, but the vendored acid page at /synth/acid/ took that name the same night, so James picks another before slice 1; the nightly job must not start it without a name), own panel, labels and voicing. Never use the
other company's names (the product, the company or its model letters) in the UI, patches or code, and do
not copy its panel layout or wood-cheek styling; the rack's look applies. The circuit ideas are fair game.
Build it as two or three nightly slices, one per night, in this order:
- [ ] Slice 1: processor `<name>` in voice.worklet.js (mono, 2x like the others): three oscillators (tri,
      tri-saw, saw, square, wide and narrow pulse; 32' to 2' ranges; osc 2 and 3 detune; osc 3 can leave the
      keyboard and run slow as a modulation source), white and pink noise, a mixer that can be driven into
      soft saturation, a feedback loop knob (output back into the mixer, the classic overdrive trick, made
      a knob of its own), our own 4-pole ladder (reuse Filament's Ladder 24 code; it is ours) with emphasis
      to self-oscillation and keyboard tracking off, 1/3 or 2/3, two envelopes (attack, decay, sustain, and a
      release switch that copies the decay), glide, a modulation mix (osc 3 against noise) on the wheel to
      pitch and cutoff, a 440 Hz reference tone. `<name>.js` with schema v:1 (`device: '<name>'`), defaults and
      ranges; the rail gets a third button; sections carry `data-dev="<name>"`.
- [ ] Slice 2: about 10 factory patches (bass, leads, a sync-free lead from detuned saws, a feedback growl,
      a self-oscillating filter whistle), levels near -14.5 dB like the others; the A. section of the suite
      (ladder cutoff and self-oscillation tuning, osc ranges and detune, the feedback loop's harmonics, the
      release switch, mono fold, fuzz); phone layout checks.
- [ ] Slice 3 (if needed): the MIDI deck learns a third device (import chips, export track names), and the
      tube show covers its tubes.

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
- [ ] Tube show: exaggerated tube visuals (note flares, red-plating heat, arcs on clipping, blue glow,
      visible resonance, voice lamps, off/subtle/full). Requested by James 13 Oct; see Notes from James.
- [ ] 1939 mode (divide-down, LC resonators, seven envelope shapes, six-channel vibrato)
- [ ] Punched paper roll step sequencer
- [ ] Theremin mode with the magic eye as tuning indicator
- [ ] Share links (`?p=`), JSON export/import, Surprise me
- [x] WAV recording (10 minute cap) - 14 Oct, master bus: live record and offline render, 24-bit 44.1 kHz stereo. (The MIDI file render in slice 2 is a separate button: 48 kHz 16-bit of a take. Still open.)
- [ ] Tube view, faces (walnut, studio rack black, black light), lava lamp module
- Tube show (James, 13 Oct note) - first slice 16 Oct, nightly. Exaggerated on purpose. State in `tubeshow.js`,
  drawing in `tubepaint.js` (below the additions line), inputs from the meters and analysers the page already reads.
  - [x] Note flares: V1 at once, V2 20 ms later, the output pair 45 ms later, scaled by velocity, 150 ms decay
  - [x] Red plating: drive and signal level take the plates from grey through cherry red to orange, with a halo and a pool on the chassis
  - [x] Arcs on hard clipping (V1 above 0.7 RMS per voice, or the output peak at 0.95 or more), at most five a second
  - [x] Blue glow on V3 and V4 that follows the output level
  - [x] Visible resonance: Valve 12 V2 brightens with resonance and shimmers from 0.92 up; Cathode V2 follows the low-pass peak and shimmers from 0.88 up
  - [x] Voice lamps: 16 on the chassis, one per sounding voice
  - [x] Tube show section on the Rack tab: off, subtle, full (default full, kept in localStorage); reduced motion keeps steady glows only
  - [ ] Flares for the other rack devices that use the chassis (Thyratron, Dekatron, Lattice, Gleam) come only from the on-screen keys and MIDI through the page; their own sequencers and generators do not flare yet (their meters carry no note numbers)
  - [ ] Big tube view (the /otr Tube view) with the show at full size
  - [ ] The '73-style monosynth's tubes, once it exists
- [ ] About 40 factory patches
Done when: share link round trip test passes.

### Master bus (14 Oct 2026)
Delay, reverb and a compressor/limiter on the master, after Filament, Cathode and the rack. Each one bypasses on its own; with all three off the master is a straight wire (the worklet is not in the path). The delay syncs to a tempo on the strip (40–240 BPM, straight, dotted and triplet divisions, or a free time) and can ping-pong. The reverb is our own code for the public-domain Freeverb structure (see `docs/filament-licensing.md`). The compressor is original, with an optional ceiling limiter. Record and Render WAV write a 24-bit, 44.1 kHz stereo file, capped at 10 minutes. Nothing in a device patch changed, so factory patches sound the same until a master effect is switched on.

## Improvement backlog
The 5:30 AM improvement job (scheduled task) ships one engineering improvement a night, no new
features, in this order: a review finding marked broken, CPU (test 9's hottest path, sound unchanged
and proven by measurement), test suite health, load time and memory, code health, robustness.
"Measured" means a script read it; "inferred" means it comes from reading the code. Newest first.

- Done 23 Oct (test health, forced: main hung on it): the Gleam HRTF render deadlock. The suite on
  origin/main `b93422e` stalled for more than 5 minutes in "G. HRTF keeps a left-hand finger on the
  left" (the 18 Oct hang again). Measured cause, outside the suite, a fresh page each run in Chromium
  153: an HRTF offline render started straight after the page's first HRTF panner hangs about one run
  in five (Gleam's render 3 of 15; a bare oscillator and panner on the rack page 11 of 80; a bare
  worklet and 8 panners on an empty page 1 of 15). In gdb the HRTF loader thread waits on a mutex
  owned by the offline render thread, which waits on a condition for the loader: a deadlock inside
  the browser, so the promise never settles. Starting the render 100 ms after a panner has begun the
  load finished 30 of 30; after 1.5 s, 25 of 25. `renderGleamBuffer` now makes one HRTF panner per
  sample rate per page (kept, so the loaded data stays shared) and waits 1 s from then before an HRTF
  render: the same Gleam repro 40 of 40, first HRTF render 1.13 to 1.39 s (before: 0.65 to 0.96 s
  when it did not hang), later ones unchanged. Output unchanged: a cold render and a warmed one
  differ by at most 3e-8, the same as two warmed renders. `g_render` in the suite now gives up after
  60 s with a failing check and NaN output instead of stalling. Not changed (inferred, same cause):
  Sculpt's `renderSculpt` (`synth/hand-sculpt/audio.js`) renders HRTF panners offline straight
  after making them, so it can hang the same way; it would need the same wait.
- Done 21 Oct: Cathode's per-sample filter and pitch maths. Profiled Plate Screamer in Node: `exp2`
  was 19.6% of the worklet's self time and the two `Math.tan` sat inside `render` (41%), each run at
  the 2x rate for both filters and both VCOs even when their inputs sat still. `render` now keeps the
  exact inputs of the last call for each (VCO pitch, each filter's base cutoff and CV, each peak knob)
  and reruns `exp2`, `tan`, `pow` and `peakCorr` only when one changes. Output bit-identical on 8
  Cathode cases (measured, `scripts/bench_filament_voice.mjs --ref origin/main --cases cathode`, new
  `c_` cases). Node CPU time, best of 4: Plate Screamer -16%, the other patches -13% to -31%.
- Done 21 Oct (test health, forced: main failed it): "Tv. a note-on flares V1 ... V1 first" and "Tv. the
  flare scales with velocity" failed 2 of 3 suite runs tonight, once on main and once on a quiet box
  (first in-page sample at 74 and 145 ms, sampled V1 peak 0.46 and 0.26 against the 0.5 floor). Cause,
  measured in Node: `stepShow` applies a flare and decays it by the whole frame in the same step, so a
  145 ms frame shows a 1.0 flare as 0.38. The show now records the level each tube's last flare took and
  its lag after the note-on on its own clock (`fired`, `firedLag` in `__synth.tubeShow()`), and the two
  checks assert on those: V1 above 0.5, the output pair above 0.3, V1 no later than the pair and the
  pair at least 45 ms after the note, velocity 0.3 under half of velocity 1. The sampled peaks stay in
  the check names and must be above 0. No visual change.
- Done 18 Oct: Filament voice control tick. Profiled test 9's patches in Node: `fcoef()` (two `tan`, a
  `pow`) was 13.5% of the worklet's self time, rerun every 8 frames per voice even with the cutoff
  still. Now it returns early when its inputs match the last call; the cutoff, oscillator pitch and
  filter-drive `pow`s are memoized the same way; the NaN scrub on the 2x sum uses two compares instead
  of `Math.abs`. Output bit-identical on 9 cases (measured, `scripts/bench_filament_voice.mjs --ref`).
- CPU, Filament: the Valve 12 per-sample solve is now the largest single cost (about 36% of the
  worklet's self time in the Node profile, measured). Anything there changes the output in the last
  bits, so it needs a tolerance check (for example null depth against the old render) instead of a hash.
- CPU, Filament: LFO-heavy patches gained nothing tonight (every input moves every tick, measured
  -0.4% to -5%). A table `exp2` like Cathode's would help them but changes low bits: same tolerance
  question as above.
- CPU, Cathode, after 21 Oct: what remains is inputs that really move. A glide keeps `kbd` creeping
  toward its target for seconds (toward 0 V on middle C it never settles), and an EG or MG on a filter
  moves its cutoff every sample, so those paths still pay `exp2` and `tan` per 2x sample (measured,
  Plate Screamer still spends about a quarter of `render` on the LPF's `exp2` and `tan`). A cheaper `tan` changes
  low bits: same tolerance question as the Filament items above. The noise source draws
  `Math.random()` every 2x sample even when nothing is patched from it (18% of `render` in the Node
  profile, overstated there because the bench seeds a JS PRNG); skipping it shifts the random stream
  that drift also uses, so a bench hash cannot prove it and it would need a statistical check.
- Test health: test 9's CPU lines are wall clock in headless Chrome. On the 2-core build box they moved
  from 20% (in the suite) to 30-44% (a separate bench under load) for the same tree tonight, measured.
  They are INFO lines and cannot fail the suite, but they cannot show a 10% change either. Use the Node
  bench (CPU time, seeded) for A/B work. Suite wall time on main tonight: 8 min 11 s.
- Load time: `synth/index.html` is one 316 KB file (measured). Worth checking which device panels could
  load on first use instead of at first paint.
- Robustness: R1017-9 (no output protection with the compressor off) changes the sound, so it is a call
  for James, not this job.

## Graphics backlog
The 3 AM graphics job (scheduled task) ships one visual improvement a night, no audio or DSP changes.
Ranked from screenshots at 1366x1000 and 375x667 (every rail device, every phone tab). It leaves the tube
visuals alone while the Tube show item in 0.3 is open. Measured means a script read it; seen means a screenshot.

- [x] 23 Oct: Mix desk strips. Measured before: the strip the keys play carried the class `keys`, which is
  also the keyboard's class (`height: var(--kb-h)`, `touch-action: none`, `user-select: none`), so that strip
  was forced to 150 px on desktop (a gap inside Filament's strip, the strips out of line) and 128 px on a phone
  while its controls needed 239 px (Cathode's strip drew over Filament's). Inferred from the CSS: a
  finger on that strip could not scroll the page (`touch-action: none` on an ancestor). Seen: strips were loose rows with no faceplate, names wrapped onto two lines
  (Thyratron, Pentagrid, Trochotron, Phantastron, Rhumbatron, Resnatron), the meters were a flat bar on a
  160 px canvas stretched to 600, and the room, delay and feedback sliders were the browser's blue.
  Now: the class is `keyed`; each strip is a brushed faceplate with a lamp (green for the keys, amber when
  armed), names on one line, an LED ladder meter drawn at the canvas's real size, and amber bus sliders.
- [ ] Browser-blue sliders elsewhere: Heptode's tempo and morph, Lattice's position, unison and filter sliders
  (seen). Same fix as the mix bus (`accent-color: var(--amber)`), or a shared slider style.
- [ ] MIDI deck and SONGS strips under the panel: flat rows of buttons, the status ("no take", "Pick a song")
  as plain amber text with no readout window (seen). A strip faceplate and a small recessed display would match
  the chassis.
- [ ] Outboard links (Hexode, Anode, Sculpt, Hand Orchestra, Aether, Iris) look like rail buttons without a
  lamp, so they read as devices that do not light (seen). Give them their own finish and an "opens a page" mark.
- [ ] Desktop rail: 18 devices wrap into four ragged rows at 1366 px (seen). Even columns or two size classes.
- [ ] Empty states: Heptode's player box is empty until a song loads, Gleam's field is an empty grid, and
  Pentagrid's receiver panel leaves a wide blank to its right (seen).
- [ ] Lattice and Mote use their own chip palettes (blue and cyan) beside the amber elsewhere (seen). A call
  for James whether that is per-device character or drift.
- [ ] Mix tab on a phone: "tempo" is lower case beside the upper-case bus labels, and each strip is about
  256 px tall, so the Mix section is about 5,460 px long (measured after tonight's change). A compact phone strip (level and pan on one row,
  sends behind a toggle) would halve it.

## Open items for James
- Nightly 24 Oct: listen to Poly 24 (Filter section, fifth chip) and the new factory patch Velvet Brass (Pad). Calls made, any of which can change: it sings from 0.9 on resonance like the other models, a near sine (H3 -53 dB); the feedback amplifier clips at 0.5, so a loud note pulls the resonant peak down (by about 13 dB at 0.6 input against 0.01); each stage's tanh sees half the voltage across it, so it stays clean at normal levels and only slews with drive (Ladder 24 bends sooner); 60% of the bass the resonance takes is made up (Ladder 24 45%), which keeps the bass but makes a resonant patch about 2.4 dB louder at 0.85 on a low saw. The design brief calls it 'polite, creamy, good for pads'; say if you want it dirtier.
- Graphics 23 Oct: the Mix desk looks different. Before: loose rows on the panel, the Filament row stretched with a gap in it (on a phone, Cathode's row drawn over it), names wrapping, a flat orange bar for a meter, blue browser sliders for room, delay and feedback. After: every device is its own brushed strip with a lamp by its name (green for the strip the keys play, amber when armed), all strips the same height, an LED ladder meter (amber, pale amber from 72%, red from 92%, unlit segments faintly visible), amber bus sliders. No control moved and nothing in the audio path changed. Say if the lamp colours or the ladder should change.
- Nightly 23 Oct: listen to Sallen-Key 12 (Filter section, fourth chip) and the new factory patch Snarl Lead. Calls made, any of which can change: it sings from 0.9 on resonance like Ladder 24 and Diode 18; full resonance takes the gain 20% past the oscillation point (K 3.6), so the wave squares off (measured H3 about 19 dB under the fundamental, H2 about 23 dB); the clip is uneven (1.5 up, 1.2 down) for even harmonics; the output is divided by K, so the passband holds its level (measured within 0.7 dB from resonance 0 to 0.85) and loud input clips the peak down instead of getting louder; the high-pass takes half the low-pass's resonance, is not key tracked or swept by the envelope, and is off at the bottom of its knob. Snarl Lead's output level (8.5) was set from a Node render to sit near Screaming 12AX7; the suite checks only that it sounds and stays under 0 dBFS, so check it by ear against the other leads.
- Nightly 21 Oct: listen to Diode 18, and to Diode Squelch, which moved onto it (its sound changed on purpose; level matched to within 0.2 dB in a Node render of a bass riff). Calls made, any of which can change: each stage loads the one before by half (0 would be three buffered poles, 1 a plain RC ladder); it sings from 0.9 on resonance like Ladder 24; at low resonance the cutoff is lifted (2.94x at zero, easing out by 0.9) so switching a patch from Ladder 24 to Diode 18 keeps roughly the same brightness, which means the resonant peak moves up a little as resonance comes down; passband make-up 1 + 0.62k, so a saw loses about 2 dB at resonance 0.3 to 0.5 (Ladder 24 loses about 2.5).
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

- Nightly check, 15 Oct 2026 (night): the Windows app (`desktop/`, commit `6e178d4`) packs all of `frontend/public` into the installer, including `/otr` (4.6 MB), Crane Cab and the emulators, not only `/synth`. Decide what the installer should carry before the first `desktop-v*` tag. Electron and electron-builder now have register rows in `docs/filament-licensing.md`; `THIRD_PARTY_NOTICES.md` still needs an Electron entry before a public release.
- Nightly check, 15 Oct 2026 (night): the factory patch "Wide Novachord Strings" uses a historic Hammond product name (rule 6 of the licensing file). Trademark status not checked; renaming a factory patch is your call, so it was left alone.
- Nightly check, 15 Oct 2026 (night): Hexode (`/synth/fm/`, vendored) scrolls sideways at 375 px on the live site. Not new tonight (the page has not changed since 14 Oct).
- Graphic EQ (13 Oct nightly): listen to the presets on a few patches. The EQ sits before the output tubes,
  so a boost also drives them harder (more colour, by design); the level knob trims that. Calls made, any of
  which can change: each device's patch carries its own EQ (the rack follows the lit device, like the room and
  tubes); new patches start with it off at 10 bands; no factory patch uses it yet (say if you want some
  retuned to show it off); the preset list (flat, warm, smile, bass lift, presence, air, mid scoop, low cut,
  AM radio) is new, voiced for a synth, with warm, smile, bass lift and AM radio taken from /otr's shapes.
- /otr bug seen while porting (not fixed: /otr is off limits to this job): in /otr's graphic EQ, Arrow Up or
  Down on a band at 0 dB does nothing without Shift. Its `setBandGain` snaps anything under 0.6 dB to 0, so a
  0.5 dB key step from 0 lands back on 0. Found by reading the code; the synth's copy failed a test the same
  way before it was fixed here (the snap now applies to the pointer only). A one-line fix in /otr if you want it.

- Nightly 16 Oct: the '73-style monosynth (queued in its section above) needs a name before the nightly job starts it. Anode is taken by the acid page.
- Nightly 16 Oct: tube show calls, any of which can change: default full; arcs fire when V1 runs above 0.7 RMS per voice or the output peak reaches 0.95 (factory patches measured 0.19 to 0.46 per voice, Screaming 12AX7 up to 0.62, so none of them arc in the checks); at most five arcs a second; Valve 12 shimmers from resonance 0.92 and Cathode from peak 0.88 (visual thresholds, not measured self-oscillation points); subtle draws at 45%.

- Review 17 Oct (`docs/filament-review.md`): decisions the review left alone. (1) Should the deck's Render WAV also follow the mixer (level, mute, solo, sends), the way it now follows the master bus? (R1017-3) (2) One WAV format: the deck writes 16-bit 48 kHz and the suite pins it; the master writes 24-bit 44.1 kHz. (R1017-4) (3) One tempo: the rack transport, the master delay's tempo knob and the deck's 50-200% slider are separate. (R1017-5) (4) Button names: two "● rec" buttons (audio in the header, MIDI in the deck) and two "render wav" buttons that render different things. (R1017-6) (5) Desktop layout: the keys sit 4191 px down at 1366 px, under all 18 mixer strips. (R1017-7)

- Check and debug 18 Oct: the 12:28 AM nightly build has not pushed or logged since 16 Oct (its last line is the 16 Oct 12:30 to 2 AM run). If it is meant to run every night, its own run history will say why; this job cannot see it.
- Check and debug 19 Oct: Aether loads MediaPipe 0.10.17 from jsDelivr while Hand Orchestra and Sculpt use 0.10.21. Not a defect; aligning them is optional. The four new test scripts (`test_hand_aether.py`, `test_hand_orchestra.py`, `test_hand_sculpt.py`, `test_iris.py`) are not run by `test_synth.py`, and three of them default to port 8798, so they collide if run in parallel. Say if this job should run them every night (it did tonight, one at a time).
- Review 20 Oct (`docs/filament-review.md`): (1) Should a project carry Thyratron, Dekatron, Lattice and Gleam patches and the master bus? Today it keeps 14 of 18 devices and no master, while the Mix tab note says it keeps "the patches". It is a schema addition (R1020-3). (2) Should a library song's Halloween presets ask before replacing an edited patch, or at least say so in a toast? (R1020-4) (3) Accessibility calls: a skip link to the keyboard and library on the desktop rack (408 tab stops, R1020-8), and section names in knob labels such as "Osc 1 octave" instead of "oct" (R1020-9). (4) Hexode's original panel has no focus ring and Anode's regenerate buttons have no name; both are in vendored code (R1020-6, R1020-7).
- Review 22 Oct (`docs/filament-review.md`): (1) Phantastron runs 20 to 30 dB under the other devices (Nursery Clock, its first patch, peaks 0.03 at the master against 0.2 to 0.9 elsewhere), and its bits slider at 1 to 3, or a GND to BITS wire, silences the speaking carts. Both come from the toy DAC quantizing on an absolute -1..1 scale while the carts run far below it. A gain into the DAC (and back out), or a mid-rise step, would fix both but changes how every Phantastron patch sounds, and a check pins the current two-bit steps; your call (R1022-3, R1022-4). Fixed tonight without that: a wire into BITS now stops at 3 bits, so Market Bits and Solder Bridge speak again (their sound is new, since they were silent). (2) Additron: turning perc up while the chips read "perc off" now picks perc 3; say if you would rather it pick 2 or dim the knob instead (R1022-2). (3) Should delete ask first, and land on the device's own first sound rather than the first patch in the list (R1022-5)? Should saving over an existing user patch name ask (R1022-6)?
- Review 23 Oct (`docs/filament-review.md`): (1) Should the MIDI recorder take every armed device, or at least say which armed devices it is leaving out? Today a take keeps Filament and Cathode only, silently (R1023-3). (2) Should Gleam answer the sustain pedal and the keyboard's hold button, and if so as its own hold latch? (R1023-5) (3) Bend and mod moved before arming a strip stay on the old device (R1023-4, inferred); the pedal case was a stuck note and is fixed, the wheels were left alone.
- Check and debug 22 Oct: the 12:28 AM nightly build did not push or log tonight (no commit after 12:04 PM PT on 21 Oct; it last ran 21 Oct). If it was meant to run, its own run history will say why; this job cannot see it.

## Notes from James
(write here; the nightly run reads this first)
- 2026-10-13 (evening): **Next nightly run: build "more visual feedback on the tubes" instead of the next 0.2
  item.** James: "I realize it isn't realistic, but we are building a tube synth in a web browser." So
  exaggerate on purpose; it is a show. One night's slice, both devices (the chassis is shared). Ideas, in
  priority order; ship what fits and list the rest under the new roadmap item "Tube show" in 0.3:
  1. Every note-on flares the tubes it passes through (V1 first, then the output pair), scaled by velocity,
     decaying over about 150 ms. Chords and fast runs should visibly flicker.
  2. Drive shows as heat: as V1, V2 or the output drive and the actual signal level rise, the plates go
     from dull grey through cherry red to orange ("red plating"), with a glow halo that spills onto the
     chassis around the bulb.
  3. Clipping shows as arcs: when a tube stage or the final ceiling is clipping hard, brief blue-white
     sparks or flashes inside the glass (rate-limited so it never strobes).
  4. Blue fluorescence on the power tubes (V3/V4) that follows the output level, the way real power tubes
     glow blue, turned up well past real life.
  5. Resonance you can see: on Valve 12, V2 brightens with resonance and shimmers when the filter
     self-oscillates; on Cathode, V2 (the follower) does the same for the low-pass peak.
  6. A row of small voice lamps (one per active voice, up to 16) on the chassis.
  Rules: honour prefers-reduced-motion (no flicker, flashes or sparks; steady glow only) and add a
  three-way "tube show" chip (off, subtle, full) remembered in localStorage, default full; keep drawing
  inside the existing 30 fps frame loop; nothing new in the audio path (visuals read the meters and
  analysers that already exist, or new meter fields the worklets post with the existing meter message);
  phones keep no horizontal scroll and 44 px targets. Tests: expose the visual state on `__synth` and
  check that a note-on raises the flare, more drive raises the heat, a clipping render triggers a flash,
  reduced motion and "off" suppress flicker and sparks, the canvases are painted, and no page errors; log
  the frame draw time.
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
- 2026-10-24 (check and debug, scheduled task, about 2:09 to 2:50 AM PT): reviewed the commits since 23 Oct 6 PM PT on origin/main `830182e`: by Claude (the 12:28 AM nightly) the Desk page close fix `81cedae` and Poly 24 `830182e`; by Cursor Agent Delve `044b086` and the unlisted /dm/, /eob/ and /eob2/ engines (merges #65 to #68, none under /synth/); the health bot's state commit `ad30b95`. No edit under `/otr`, no test removed or loosened (`81cedae` only closes each Desk page sooner; `830182e` adds Poly 24 to tests 1, 2, 9 and 10 and adds the Po. section), no trademark name, no new third-party code. Read the Poly 24 diff: the coefficient memo key moved from epoch x 4 to epoch x 5 for the fifth model, and the left and right filters both dispatch to `ota()`. Suite: ALL PASS (1169 checks). `scripts/test_synth_imported.py`: ALL PASS (29). Live `/synth/`, `/synth/fm/`, `/synth/acid/` at 1366 and 375 px: no page or console errors, `__synth.ready()` true, the only failed request the `/api/stat` beacon aborted on close; no horizontal scroll at 375 px except Hexode (1154 px, open since 15 Oct). A live note on each of the 18 rack devices moved its own strip meter (measured peak 0.014 Phantastron to 0.66 Geissler); an offline render of Velvet Brass peaked at 0.31. Live `sw.js` `dxedge-v132` matches the repo, and the live `index.html`, `voice.worklet.js` and `patches.js` match byte for byte. Defects found: none. Docs only, no cache bump. Commit: this one.
- 2026-10-24 (nightly, scheduled task, run about 12:30 to 1:35 AM PT): main first. origin/main `0d2c531` (since the 23 Oct improvement run: the health bot's state commit `ad30b95` and Cursor Agent's Delve, /dm/ and /eob/ work, then /eob2/ `6faa308` during the run; none under /synth/). The suite on a clean origin/main stopped with an exception after 1146 passes and no fails: the last Desk. section had four extra rack pages open beside the main one, and the fourth (390 px phone) timed out loading after 30 s on this 2-core box (load average about 6). Fixed in the suite: each Desk. page now closes before the next opens; no check changed. `scripts/test_synth_imported.py` ALL PASS. Live `/synth/`, `/synth/fm/`, `/synth/acid/`: no page errors and no failed requests, `__synth.ready()` true; live `sw.js` `dxedge-v131` matched origin/main, and the live `index.html`, `voice.worklet.js` and `patches.js` matched byte for byte. Then the first unchecked 0.2 item, Poly 24 (see its roadmap entry), and the factory patch Velvet Brass (Pad; listen to both). Measured in the suite: self-oscillation within 0.8 cents of pitch from C3 to C7 (Node: within 0.8 to C8, +4.8 at C2); cutoff exact (0.00%) at 100 Hz to 4 kHz; slope -23.6 dB against the 4-pole model's -23.6; level within 2.4 dB from resonance 0 to 0.85. Velvet Brass measured -16.9 dBFS RMS on the test 7 chord (Black Light Pad -16.2, Filament Lead -16.6), 1.3 dB mono fold. Valve 12, Ladder 24, Diode 18, Sallen-Key 12 and Cathode output bit-identical to main on every bench case (`scripts/bench_filament_voice.mjs --ref origin/main`); Poly 24 costs the same as Ladder 24 in the Node bench (38.2% against 38.7%) once its tanh approximant was written out. No other patch changed. Cache `dxedge-v132`. Suite: ALL PASS (1169 checks). `scripts/test_synth_imported.py`: ALL PASS. CPU (test 9, headless; this box ran slow again tonight): Cathode 33.0%; Filament 8 voices Ladder 24 51.0%, Valve 12 49.8%, Diode 18 65.0%, Sallen-Key 12 57.9%, Poly 24 52.2%; stereo offset 52.2%; 16 voices 68.5%; EQ 31 bands 84.3%. Chassis draw 7.07 ms a frame. Commits: the suite fix and the Poly 24 commit that carries this line.
- 2026-10-23 (improvement, scheduled task, about 5:26 to 6:45 AM PT): test health, forced: main hung. The suite on origin/main `b93422e` stalled more than 5 minutes in "G. HRTF keeps a left-hand finger on the left" (the 18 Oct hang again) and was stopped. Cause, measured: in Chromium 153 an HRTF offline render started straight after the page's first HRTF panner deadlocks about one run in five (gdb: the HRTF loader thread waits on a mutex the offline render thread owns, and that thread waits for the loader). `renderGleamBuffer` now makes one HRTF panner per sample rate per page and waits 1 s before an HRTF render; the suite's Gleam renders now fail one check after 60 s instead of stalling. Before and after on the same fresh-page repro: 3 of 15 renders hung, then 40 of 40 finished; the first HRTF render of a page takes 1.13 to 1.39 s (was 0.65 to 0.96 s when it did not hang), later ones unchanged. Sound unchanged (a warmed render matches a cold one within 3e-8, the jitter between two warmed renders); no patch changes. Sculpt's offline HRTF render can hang the same way (inferred, not changed; see the Improvement backlog). Cache `dxedge-v127`. Suite: ALL PASS (1149 checks, 536 s). `scripts/test_synth_imported.py`: ALL PASS (29). CPU (test 9, headless): Cathode 20.8%; Filament 8 voices Ladder 24 25.4%, Valve 12 21.6%, Diode 18 28.6%, Sallen-Key 12 27.0%; stereo offset 25.7%; 16 voices 34.6%; EQ 31 bands 30.5%. Chassis draw 5.68 ms a frame. Commit: this one.
- 2026-10-23 (review, scheduled task, about 4:25 to 5:15 AM PT): areas c (keyboard, computer keys, pedal, wheels and MIDI on all 18 devices), d (the new Mix desk: arms, session save, load and upload) and e (MIDI deck takes with armed strips, Render WAV), live `0.19-resnatron`, origin/main `4b87649`. Findings: 2 broken (both fixed), 2 confusing, 1 missing; R1017-3 and R1017-8 still open. Fixes: the pedal-up now reaches every device the pedal went down on, so arming a strip while holding no longer leaves a note ringing until Panic; upload mix refuses a file that is not `kind: dxmix` instead of resetting every strip and overwriting the saved mix. Each with a check that fails on the live code. Cache `dxedge-v126`. Suite: ALL PASS (1150 checks). Commit: the review commit of 23 Oct.
- 2026-10-23 (graphics, scheduled task, about 3:15 to 4:15 AM PT): main first: suite on origin/main `72b3780` ALL PASS (1141 checks). Screenshots at 1366x1000 and 375x667, every rail device and every phone tab; no page errors, no horizontal scroll. Started the Graphics backlog (8 items, ranked). Built the top one, the Mix desk strips: fixed the `keys` class collision that stretched the keyed strip (desktop gap, phone overlap), a faceplate and lamp per strip, names on one line, an LED ladder meter at the canvas's real size, amber bus sliders. CSS and the meter painter only; no audio change. 5 new checks (3 Mx., 2 phone). Cache `dxedge-v125`. Suite: ALL PASS (1146 checks). Commit: the graphics commit of 23 Oct.
- 2026-10-23 (check and debug, scheduled task, about 2:10 to 2:55 AM PT): reviewed 2 commits since 22 Oct 6 PM PT on origin/main `9a411cf`, both by Claude (the 12:28 AM nightly): the boot and router sleep fix `811b4c4` and Sallen-Key 12 `9a411cf`; also the health bot's state commit `720041a`. No edit under `/otr`, no test removed or loosened (the one changed check, the phone Filter tab, now also requires the Sallen-Key 12 chip), no trademark name, no new third-party code. Read the diffs: `routeWaker` and the boot `sleep` both skip the rail's device as intended; the new filter's coefficient memo is keyed on model and patch epoch, and Valve 12 rewrites the slots it shares with Sallen-Key 12, so switching models does not leak state (by reading the code). Suite: ALL PASS (1141 checks), including `M. pentagrid: recorded matches live`. `scripts/test_synth_imported.py`: ALL PASS (29). Live `/synth/`, `/synth/fm/`, `/synth/acid/` at 1366 and 375 px: no page or console errors, `__synth.ready()` and `booted()` true, the only failed request the `/api/stat` beacon aborted on close; no horizontal scroll at 375 px except Hexode (1154 px, open since 15 Oct). A live note on each of the 18 rack devices moved its own strip meter (measured, 0.014 Phantastron to 0.92 Geissler peak); an offline Filament render peaked at 0.35. Live `sw.js` `dxedge-v124` and the live `index.html`, `voice.worklet.js` and `patches.js` match the repo byte for byte. Defects found: none. Note for the task prompt: the Chromium path it names (`chromium-1194`) no longer exists; the suite falls back to `/opt/pw-browsers/chromium`. CPU (test 9, headless): Cathode 22.7%; Filament 8 voices Ladder 24 37.5%, Valve 12 29.1%, Diode 18 30.3%, Sallen-Key 12 31.9%; stereo offset 32.8%; 16 voices 42.6%. Chassis draw 4.75 ms a frame. Docs only, no cache bump. Commit: this one.
- 2026-10-23 (nightly, scheduled task, run about 12:30 to 2:45 AM PT): main first. origin/main `720041a` (since the 22 Oct check: the 22 Oct review `7df0d35` by Claude and the health bot's state commit `720041a`; no /synth change by others). The first suite run on it was invalid (this job ran Node renders beside it on a 2-core box: one draw-time fail, then a page load timeout). A quiet re-run: 1114 pass, 1 FAIL, `M. pentagrid: recorded matches live`, both sides silent, the flake the 21 Oct check saw under load; this time with nothing else running. `scripts/test_synth_imported.py` ALL PASS. Live `/synth/`, `/synth/fm/`, `/synth/acid/` at 1366 and 375 px: no page or console errors, no failed requests, `__synth.ready()` true; Hexode still 1154 px wide at 375 (open since 15 Oct). Live `sw.js` `dxedge-v123` matched. Cause found and fixed (`811b4c4`, see its message): the end of the boot chain put the rail's device to sleep, which panics it and cut a held note (measured: Pentagrid 0.165 to 0.0003 RMS on main, 0.131 to 0.176 fixed), and Geissler and Gyrotron did the same when their routed notes ended (by reading the code). Two new checks. Inference: one of those two caused the flake; if `M. pentagrid` fails again, it is something else. Then the first unchecked 0.2 item, Sallen-Key 12 (see its roadmap entry) and the factory patch Snarl Lead (listen to both). Measured in the suite: self-oscillation within 0.4 cents of pitch from C3 to C7; cutoff exact (0.00%) at 100 Hz to 4 kHz; slope -12.2 dB against the model's -12.2; high-pass within 0.01 dB of the 2-pole model; level within 0.7 dB from resonance 0 to 0.85. Valve 12, Ladder 24 and Diode 18 output bit-identical to main on all bench cases (`scripts/bench_filament_voice.mjs --ref origin/main`); no other patch changed. Found on the way (measured, not fixed): the Node bench runs the worklet in a `vm` context where each global lookup (`Math`, or a top-level function such as Diode 18's `tdx`) costs about 100 ns, so it overstates Diode 18 and Sallen-Key 12 about 2x against Ladder 24; headless Chrome does not. Cache `dxedge-v124`. Suite: ALL PASS (1141 checks). CPU (test 9, headless, the full run on this code before a test-only tolerance fix): Cathode 34.4%; Filament 8 voices Ladder 24 49.4%, Valve 12 41.3%, Diode 18 42.0%, Sallen-Key 12 41.6%; stereo offset 47.2%; 16 voices 62.9%; EQ 31 bands 62.7% (this box ran slow tonight). Chassis draw 7.78 ms a frame. Commits: `811b4c4` and the Sallen-Key commit that carries this line.
- 2026-10-22 (review, scheduled task, about 4:20 to 5:40 AM PT): areas a (controls on Thyratron, Additron, Rhumbatron, Phantastron) and b (all 124 factory patches on 18 devices, user save, reload and delete, old stub patches), live `0.19-resnatron`, origin/main `61b1e1b`. Findings: 2 broken (both fixed), 4 confusing, 0 missing. Fixes: two silent Phantastron factory patches (a wire into BITS stops at 3 bits) and Additron's inert perc knob (it now picks perc 3 from "perc off"), each with a check that fails on the live site. Cache `dxedge-v123`. Commit: the review commit of 22 Oct.
- 2026-10-22 (check and debug, scheduled task, about 2:08 to 2:55 AM PT): no commits since 21 Oct 6 PM PT; origin/main `a2bf9c3`. The 12:28 AM nightly did not push or log tonight (last commit 12:04 PM PT on 21 Oct). Also read the two commits no check had seen: Cathode memoize `bf4a4b4` (Claude, 21 Oct morning) and Delve sheets and runes `3aec759` with merge #64 (Cursor Agent). No edit under `/otr`, no test removed or loosened, no trademark name, no new third-party code. Suite: ALL PASS (1112 checks). `scripts/test_synth_imported.py`: ALL PASS (29). Live `/synth/`, `/synth/fm/`, `/synth/acid/` at 1366 and 375 px: no page or console errors, `__synth.ready()` true, the only failed request the `/api/stat` beacon aborted on close; no horizontal scroll at 375 px except Hexode (1154 px, open since 15 Oct). A live note on each of the 18 rack devices moved its own strip meter (measured, 0.026 Phantastron to 0.77 Geissler peak); an offline Filament render peaked at 0.33. Live `sw.js` `dxedge-v122` matched the repo. Defect found: `3aec759` moved `backend/tests/test_news.py` and `test_news_lightbox.py` to pin the exact cache `dxedge-v122`, the same pattern fixed in the Delve and hand tests last night, so the next bump fails them. Fixed: both check v122 or later (measured: pass at v122 and v123, fail at v121). Tests only; nothing served changed, so no cache bump. 9 other errors in those files are this container lacking `httpx`, the same before and after. CPU (test 9, headless): Cathode 16.6%; Filament 8 voices Ladder 24 28.8%, Valve 12 28.3%, Diode 18 29.0%; stereo offset 30.3%; 16 voices 32.7%; EQ 31 bands 41.8%. Commit: this one.
- 2026-10-21 (improvement, scheduled task, about 5:25 to 7:45 AM PT): CPU, Cathode's per-sample maths. Main first: the suite on origin/main `c6befe1` failed 2 checks, the Tv. flare checks, while a Node profile ran beside it; they passed on the next run and failed again on the run after with nothing else running, so main was flaky and that came first: the checks now read the flare level and lag the tube show records on its own clock (`tubeshow.js` `fired`, `firedLag`; no visual change; details in the Improvement backlog). Profiled test 9's Cathode patch (Plate Screamer) in Node with `scripts/bench_filament_voice.mjs`, which now has 8 Cathode cases (`c_plate`, `c_init`, `c_wind`, `c_growl`, `c_reed`, `c_trill`, `c_kick`, `c_change`) and a `--cases` filter: `exp2` was 19.6% of the worklet's self time and the two `Math.tan` sat inside `render` (41%), all at the 2x rate. `render` now memoizes the VCO pitch to phase step, each filter's `exp2` and `tan` (keyed on base cutoff and CV), and the peak knob's `pow` and `peakCorr`, recomputing only when an exact input changes. Sound unchanged: bit-identical output on all 8 Cathode cases against origin/main, measured. Node CPU time, best of 4, before and after: Plate Screamer 47.4 to 39.8% (-16%), Init 44.6 to 34.7% (-22%), Night Wind -18%, Growl FM -31%, Hollow Reed -13%, Trill Gate -20%, Filter Kick -20%, patch changes mid-note -17%. Filament code untouched. Headless Chrome wall clock did not resolve it: an alternating A/B of 4 Cathode patches spread up to 2x within one tree (Plate Screamer best 67.8% main, 60.0% this tree), and this box ran slow all night (test 9 on this tree: Cathode 52.2%, Ladder 24 61.6%, Valve 12 53.8%, Diode 18 64.0%, stereo offset 83.3%, 16 voices with ensemble 89.6%, EQ 31 bands 81.9%, against 17.6 to 34.3% on 18 Oct; Lattice read 120%). Inference: noise, not a regression. Cache `dxedge-v121`. Suite: ALL PASS (1112 checks). `scripts/test_synth_imported.py`: ALL PASS (29). Commit: this one.
- 2026-10-21 (check and debug, scheduled task, about 2:10 to 3:15 AM PT): reviewed 15 commits since 20 Oct 6 PM PT on origin/main `79657f9`: Diode 18 `22316fd`, its log `2e67d18` and the cache bump `79657f9` (Claude, the 12:28 AM nightly), and Delve `cdab5e4` `3f38523` `c387be5` `7b543cf` `2c03869` `fef052d` with merges #58 to #63 (Cursor Agent). No edit under `/otr`, no test removed or loosened (the test_synth.py diff only adds diode18 cases), no trademark name, Delve has a THIRD_PARTY_NOTICES entry and ships no third-party code. Live `/synth/`, `/synth/fm/`, `/synth/acid/` at 1366 and 375 px: no page or console errors, `__synth.ready()` true, the only failed request the `/api/stat` beacon aborted on close; no horizontal scroll at 375 px except Hexode (1154 px, the open item since 15 Oct). A live note on each of the 18 rack devices moved its own mixer strip meter (measured, 0.014 to 0.73 peak). Live `sw.js` `dxedge-v120` matched the repo. `scripts/test_synth_imported.py` ALL PASS (30). First suite run: 1111 pass, 1 FAIL, `M. pentagrid: recorded matches live` (both live and recorded silent); it ran while this job's live checks and the imported suite shared the CPU, and a clean re-run on the same tree passed it at x1.07 (inference: a timing flake under load, the 280 ms wait after `setPatch`; not changed tonight, watch for a repeat). Defect found: `scripts/test_delve.py`, `test_hand_aether.py` and `test_hand_orchestra.py` pinned the exact cache name `dxedge-v119`, so every later bump fails them (all three failed on main at v120, measured). Fixed: each checks the cache is v119 or later. The tests were wrong, not the site; nothing served changed, so no cache bump. Suite: ALL PASS (1112 checks); test_delve 82 ok, test_hand_aether and test_hand_orchestra ALL PASS. CPU (test 9, headless): Cathode 19.6%; Filament 8 voices Ladder 24 26.1%, Valve 12 23.0%, Diode 18 21.2%; stereo offset 24.9%; 16 voices 33.8%; EQ 31 bands 28.3%. Commit: the test fix before this line's.
- 2026-10-21 (nightly, scheduled task, run about 12:30 to 1:10 AM PT): bug check clean on origin/main `b70d788` (39 commits since the 20 Oct review, all by Cursor Agent on /news, Delve, the reader and site favicons; the favicon commit `6f97bc2` added icon links to the /synth pages and also to `/otr/index.html`, not by this job): suite ALL PASS (1093 checks), `scripts/test_synth_imported.py` ALL PASS (29), live `/synth/`, `/synth/fm/`, `/synth/acid/` at 1366 and 375 px no page or console errors, `__synth.ready()` true, the only failed request the `/api/stat` beacon aborted on close (inference: not a fault); live `sw.js` `dxedge-v117` matched the repo. Hexode at 375 px now measures 1154 px wide (open item since 15 Oct; it was 779). The graphic EQ was already on main (16 Oct), so no patch drop to land. Built the first unchecked 0.2 item, Diode 18 (see its roadmap entry), and moved Diode Squelch onto it: that patch sounds different on purpose (level matched within 0.2 dB in a Node render), so listen to it. Valve 12 and Ladder 24 output is bit-identical to main on all nine bench cases (measured, `scripts/bench_filament_voice.mjs --ref origin/main`); no other patch changed. Measured: self-oscillation within 2.3 cents of pitch from C3 to C7; cutoff within 0.01% of the model at 100 Hz to 4 kHz; slope matches the three-pole model within 0.1 dB. 19 new checks (test 1 and 2 cases, Df., the chip, phones, a test 9 line). Rebased onto the Delve chest and quest commits; cache `dxedge-v120` (main reached v119 during the run). Suite: ALL PASS (1112 checks). CPU (test 9, headless, this container): Cathode 21.0%; Filament 8 voices Ladder 24 28.7%, Valve 12 24.0%, Diode 18 24.4%; stereo offset 26.4%; 16 voices with ensemble 35.6%; EQ at 31 bands 29.9% (main earlier tonight: 21.4, 27.7, 25.0, 37.5, 36.5, 35.3; inference: run to run noise). Chassis draw 2.98 ms a frame. Commit: the Diode 18 commit before this line's.
- 2026-10-20 (review, scheduled task, about 4:05 to 5:30 AM PT): areas f (song library, project save and load), g (Hexode and Anode) and h (accessibility), live at 1366 and 375 px against origin/main `c44ce0a`. Findings: 2 broken (both fixed), 1 missing, 6 confusing; details in `docs/filament-review.md`. Fixes: the library's first Play no longer runs the transport silently while the rack devices are still attaching (`player.js` subscribes on Play and on load); project upload refuses a file that is not `kind: dxrack` instead of resetting every device and overwriting the saved project. Tests: "P. Play before every device has attached starts the song", "R. upload refuses a-mix.json / patch.json and keeps the project". Cache `dxedge-v111`. Suite: ALL PASS (1093 checks; one earlier run on the same code failed "T. on the page, letting go of a covered key leaves the voice up" once, a live-meter timing check this change does not touch, and passed on the rerun). Commit: the review commit that carries this line.
- 2026-10-20 (check and debug, scheduled task, about 2:10 to 3:30 AM PT): reviewed 2 commits since the 19 Oct check on origin/main `e0147a5`: the MediaPipe register fix `8f29b81` (Claude, 19 Oct morning) and the health state `e0147a5` (Claude dxedge nightly, the only commit since 19 Oct 6 PM PT). No edit under `/otr`, no test removed or loosened, no trademark name, no unregistered license. No commit from the 12:28 AM nightly build again. First suite run on origin/main: 1087 pass, 1 FAIL, `H. dragging an orb moves that track in the field`. Cause (measured): with a file loaded the field's bottom sits under the docked keyboard, `scroll_into_view_if_needed` does nothing while the field is partly on screen, and the drag started on a key (`elementFromPoint` = `key w`, 4 of 4 repros on the live page). Test-only defect; the field works once scrolled clear. Fixed: the test scrolls the field clear of `--kb-h` and a new check requires the drag to start on the field. Second run: `S. ensemble II` level -2.51 dB against a 2.5 dB bound (first run -2.4). Measured over 6 renders: the ensemble-off reference alone moves 1.5 dB render to render (oscillators start at a random phase by design), and single-pair level differences ranged -2.3 to +0.7 dB. Fixed: the level comparison averages three renders a side; the bound stays 2.5 dB (now -0.1 to -0.7 dB). No served file changed, so the cache stays at `dxedge-v110`. Suite: ALL PASS (1089). `test_synth_imported.py` ALL PASS (29). Live at 1366 and 375 px: `/synth/`, `/synth/fm/`, `/synth/acid/` no page or console errors, `__synth.ready()` true; all 18 rack devices played a note live with a non-zero strip meter (Thyratron needed a longer load wait and Dekatron a drum note); the only failed request was the `/api/stat` beacon aborted on close (inference: not a fault); Hexode still scrolls sideways at 375 px (open item since 15 Oct). Live `sw.js` `dxedge-v110` matched the repo. Commit: this one.
- 2026-10-19 (check and debug, scheduled task, about 2:08 to 2:50 AM PT): reviewed 22 commits since 18 Oct 6 PM PT on origin/main `00aeef8`: health state `154a9f6` `7855e09` `3324cdc` and the contests fix `b373059` (health bots); the wide-screen desk `30958c5` `e45fba0` `1abc560`, the mouse-move fix `ff18561`, Aether `3f74a4c` `7373a0d` `f8e2f7d` `821a953`, Sculpt `953006d` `00aeef8` and the merges and cache bumps (Cursor Agent); Hand Orchestra `ea6d46f` `d17f88d` and Iris `b217805` (sagejw-svg). No edit under `/otr`, no test removed or loosened (the one changed H. check now scrolls the Heptode field into view above the docked keyboard), no trademark name added. Found one defect: licensing rule 7. Sculpt vendors MediaPipe Tasks Vision 0.10.21 and the hand model in `hand-sculpt/vendor/` (Apache 2.0, LICENSE and NOTICE in the folder) and Aether loads MediaPipe 0.10.17 from jsDelivr, with no register row for either and no `THIRD_PARTY_NOTICES.md` entry for the shipped copy. Fixed: register table for the three hand pages, a notice entry, and two new suite checks (every `/synth` vendor folder and every jsDelivr package a `/synth` page loads must be in the register with version and folder). Measured: the vendored SIMD wasm, its loader and the model match the published files by sha256; `vision_bundle.mjs` differs only by a removed sourceMappingURL line. Suite before the fix: ALL PASS (1086); after: ALL PASS (1088). `test_synth_imported.py` ALL PASS (29); the new page suites (Aether 46, Hand Orchestra 43, Sculpt 42, Iris 37) ALL PASS. Live at 1366 and 375 px: `/synth/`, `/synth/fm/`, `/synth/acid/`, `/synth/iris/`, `/synth/hand-aether/`, `/synth/hand-sculpt/`, `/synth/hand-orchestra/` no page or console errors; `__synth.ready()` true; all 18 rack devices render a non-silent note offline, no NaN; the only failed request was the `/api/stat` beacon aborted on close (inference: not a fault); Hexode still scrolls sideways at 375 px (open item since 15 Oct). Live `sw.js` `dxedge-v110` matched the repo. CPU lines in test 9 ran high (Valve 12, 8 voices, 21.5%) because five suites ran in parallel on this server (inference). Commit: this one.
- 2026-10-19 (interactive): The docked keyboard fills the width. On a wide screen it adds octaves and stretches the keys out to the octave controls. Pitch and mod names sit inside the bar, and the octave and velocity lines stay readable. A phone still scrolls two octaves of 44 px keys. Cache `dxedge-v105`.
- 2026-10-19 (interactive): Wide-screen desk. Controls grow with a remembered S/M/L/XL (a screen 1600 or wider starts on L; a phone keeps its 44 px targets). On a wide rack the keyboard stays along the bottom and the mixer uses the width. Undo, Init, a master volume at unity, and a safety limiter that stays off until it is switched on. Hexode, Anode and Gleam share the size control. Hexode gained hold, a unity volume and an off-by-default limiter. Anode dials take keys and the wheel, and Reset returns them to the start. The desktop window opens at 1680 by 1000 and remembers its size. Sound is unchanged unless the limiter is on or the volume is not 100%. Cache `dxedge-v104`.
- 2026-10-18 (improvement, scheduled task, about 5:25 to 6:30 AM PT): CPU, the Filament voice's control tick. Profiled test 9's patches in Node: `fcoef()` was 13.5% of the worklet's self time, recomputing two `tan` and a `pow` every 8 frames per voice with the cutoff still. It now returns early when its inputs (cutoff, resonance, model, a patch epoch) match the last call; the cutoff, oscillator pitch and filter-drive `pow`s are memoized; the NaN scrub on the 2x sum uses two compares. Sound unchanged: bit-identical output on 9 cases (test 9's four plus LFOs, sync, FM and ring, a still note, and patch changes mid-note), measured with the new `scripts/bench_filament_voice.mjs --ref origin/main`. Worklet CPU time in Node, best of 4, before and after: Ladder 24 30.6 to 25.7% (-16%), Valve 12 47.6 to 36.0% (-24%), stereo offset 65.8 to 50.5% (-23%), 16 voices 80.0 to 63.0% (-21%), a still note -35%, LFO-heavy -7%. Test 9 in headless Chrome (wall clock, rack included) did not resolve it: this run read Ladder 24 24.9%, Valve 12 21.1%, stereo offset 21.1%, 16 voices with ensemble 34.3%, EQ 31 bands 26.7%, Cathode 17.6%, against 20.2, 19.5, 22.8, 28.2, 23.3 and 13.7% on main earlier, while the untouched Dekatron and Thyratron lines also rose 26 to 62%, so the box was slower (inference: noise, not a regression). Cache `dxedge-v103`. Suite: ALL PASS (1073 checks; one earlier run hung in the Gleam HRTF check, see the Improvement backlog). `scripts/test_synth_imported.py`: ALL PASS (25). Commit: this one.
- 2026-10-18 (check and debug, scheduled task, about 2:10 to 2:45 AM PT): reviewed 6 commits since 17 Oct 6 PM PT on origin/main `f2c2a31`: health state `867f6eb` and `26c813e` (DXEdge Health Bot), and the /news basic-auth work `c746042`, `998cc80`, `c5294a7`, `f2c2a31` (Cursor Agent). None touch `/synth`, `/otr` or the licensing file; `sw.js` went to `dxedge-v102` and stops caching `/news` (no effect on `/synth`); no test removed (the news test's import list was reshaped, not cut). No commit from the 12:28 AM nightly build tonight, and no nightly build line since 16 Oct. Suite: ALL PASS (1073 checks). `scripts/test_synth_imported.py`: ALL PASS (25). Live `/synth/`, `/synth/fm/`, `/synth/acid/` at 1366 and 375 px: no page errors, no console errors, `__synth.ready()` true; the only failed request was the `/api/stat` beacon aborted on page close (it answers 204 to a direct POST; inference: not a fault). Offline renders on the live page: Filament peak 0.25, Cathode 0.73, Dekatron 0.35 (one kick) and 0.57 (pattern). Live `sw.js` `dxedge-v102` and `synth/index.html`, `engine.js`, `deck.js`, `drums-ui.js` match the repo byte for byte. Hexode still scrolls sideways at 375 px (779 px, already an open item). CPU (test 9, headless, this container): Cathode 13.9%; Filament 8 voices 21.2% (Ladder 24) and 22.0% (Valve 12). Defects found: none. Fixes: none; this log line is the only change.
- 2026-10-17 (review, scheduled task, about 4:20 AM PT): areas c (keys, computer keys, sustain, octave, strips, MIDI), d (mixer, master clock, master bus) and e (MIDI deck), live at 1366 and 375 px against origin/main `12e3dc7`. Findings: 2 broken (both fixed), 1 missing, 8 confusing; details in `docs/filament-review.md`. Fixes: the deck recorder no longer throws on the 16 devices it does not record (wheels, pedal and an armed note threw from `deck.js` `rec()`), and the deck's Render WAV now carries the master bus. Two new M. checks. Commit: this one.
- 2026-10-16 (check and debug, scheduled task, about 2:10 AM PT): reviewed 12 commits since 15 Oct 6 PM PT on origin/main `0bcc921` (health state `b55da75`; Orthicon pictures `37f8bf3` and Gleam hold `7fc9e47` by sagejw-svg; the rest by the Claude nightly: `2883b84`, the EQ landing `a6fb7d0` `a741882` `1b18825` `85d3b73` `c61a717`, the tube show `65b0ed8` `77b74e0` `0bcc921`). Diff read: no edit under `/otr`, no new vendored code or licence, no trademark names added, no test removed; two Tv. checks were changed with stated reasons (the cooling bound now allows drive warmth; the live V1 brightness check became a painter-only check, and the real tube canvas paint check at the end of the suite still runs). Suite: ALL PASS (1071 checks). `scripts/test_synth_imported.py`: ALL PASS. Live `/synth/`, `/synth/fm/`, `/synth/acid/` at 1366 and 375 px: no page errors, no console errors, `__synth.ready()` true; the only failed request was the `/api/stat` beacon aborted on page close (inference: not a fault). All 18 rack devices played a note live with a non-zero strip meter, and an offline Filament render peaked at 0.36. Live `sw.js` `dxedge-v100` matches the repo. Hexode still scrolls sideways at 375 px (already an open item). Defects found: none. Fixes: none; this log line is the only change.
- 2026-10-16 (nightly, scheduled task, run about 12:30 to 2 AM PT): bug check clean on origin/main `2883b84` (34 commits since the EQ patch's base, the last nightly line was the 15 Oct manual run): suite ALL PASS (1004 checks), `scripts/test_synth_imported.py` ALL PASS (25), live `/synth/`, `/synth/fm/` and `/synth/acid/` loaded with no page errors, `sw.js` live `dxedge-v99` matched the repo. The one failed request on the live page was the `/api/stat` beacon (ERR_ABORTED when the headless page closed; inference: not a fault). Landed the graphic EQ from the 14 Oct patch drop (sha256 checked; commits `a6fb7d0`, `a741882`, `1b18825`, `85d3b73`, `c61a717`). Patch 5 (the service worker check) was skipped because main already had the same fix (`2883b84`). Conflicts in `index.html`, `test_synth.py`, `sw.js` and this file were resolved by keeping both sides; the EQ's phone check now runs before the Mix tab checks. Found after the merge: the EQ section stayed visible on the 16 devices added since 14 Oct, and its draw threw on every frame for any patch without `out.eq*` (page errors in T., W., Mo., R., P. and others). Fixed: the section shows only for Filament and Cathode and its code returns early on other patches. Built the tube show (Notes from James, 13 Oct): note flares, red plating, arcs on hard clipping, blue glow on V3 and V4, V2 resonance and shimmer, 16 voice lamps, and a Tube show section on the Rack tab (off, subtle, full; default full). Reduced motion keeps the steady glows only. New `tubeshow.js`; the overlay is in `tubepaint.js` below the additions line; nothing in the audio path. 26 new Tv. checks and 2 phone checks. Cache `dxedge-v100`. Suite: ALL PASS (1071 checks). `scripts/test_synth_imported.py`: ALL PASS. CPU (test 9, headless, this container, from the full run before the last threshold change; this container runs about twice the build server): Cathode 22.9%; Filament 8 voices 37.5% (Ladder 24) and 31.9% (Valve 12); stereo offset 34.1%; 16 voices with ensemble 41.2%; 8 voices with the EQ on at 31 bands 36.9%. Chassis draw with the show: 5.5 ms a frame (30 fps loop). No factory patch changed and no sound changed: the EQ is off unless a patch turns it on, and the show is visual. Worth a look and a listen: the EQ presets, and the tube show on a hot patch, on Screaming 12AX7 and on a phone.
- 2026-10-15 (check and debug, manual verification run about 10 PM): reviewed 9 commits since 14 Oct 6 PM (Gyrotron, Klystron, Phantastron, Additron, Rhumbatron, Resnatron, the mix desk, the Windows app, the health-check state). Live `/synth/`, `/synth/fm/`, `/synth/acid/` at 1366 and 375 px: no page errors, no console errors, no failed requests, `__synth.ready()` true, all 18 rack devices render a non-silent note; `sw.js` live `dxedge-v96` matches the repo. Found: the suite hung at the slashless `/synth` service-worker check (sw.js precaches `/favicon.svg`, the test server 404ed it, `context.route` does not see worker fetches, so `serviceWorker.ready` never resolved). Fixed in `scripts/test_synth.py` only: the test server answers `/favicon.svg` 200 and `POST /api/stat` 204, the ready wait times out at 15 s, and a new check requires every precache asset to load. Also found: the Windows app added Electron and electron-builder with no register rows; rows added to `docs/filament-licensing.md`. No site code changed; rebased onto the Orthicon pictures (`37f8bf3`) and Gleam hold (`7fc9e47`) commits and bumped the cache to `dxedge-v99` per the rebase rule. Suite: ALL PASS (1004 checks, on the rebased tree). `scripts/test_synth_imported.py`: ALL PASS. CPU lines from this container ran about twice the build server's (for example Filament 8 voices Ladder 24 at 24.9%); not comparable.
- 2026-10-16 (interactive): Gleam hold and a generator. Hold latches the current fingers and MIDI notes until hold is toggled off or Panic. The generator (`walk`, `orbit`, `lissajous`, `drift`, `arp`) moves the XY point and plays on its own, with rate, depth and seed, and it mixes with a finger and with hold. Cache `dxedge-v98`.
- 2026-10-15 (interactive): Resnatron, a modular patch bay, on the rack rail beside Rhumbatron. Modules are cavities (two oscillators, noise, an LFO, sample and hold, an envelope, a mixer, a filter, a VCA, a delay, and the output). Nothing is pre-wired. Drag a gold jack onto a silver one, or tap one and then the other. One cable per input. Starters are Cavity Saw, Bunch Glass, Reed Drift, and Twin Cavity. Copy link writes `?rn=`. Monophonic, last note wins, and every cable is a one-sample delay. Panic clears the notes, the envelope and the delay, and holds the output quiet until the next note. The red rec button records Resnatron. Original engine; copyleft modular instruments were reference only. Rebased onto Rhumbatron. Plate is model 18; Rhumbatron stays model 17; Additron stays model 16; Phantastron stays model 15. Mixer letter S. Cache `dxedge-v95`. Suite: ALL PASS (948 checks). `scripts/test_synth_imported.py`: ALL PASS. CPU (test 9, headless): Cathode 9.4%; Filament 8 voices 11.2% (Ladder 24) and 10.7% (Valve 12); stereo offset 12.3%; 16 voices with ensemble 17.0%. Dekatron Spark 4.9% (drums only). Thyratron Walnut Bass, one note, 2.9% (voice only). Mote Drift Glass 2.7% (grains only). Lattice Glass Pad, one note, 13.8% (Lattice only). Pentagrid, carrier plus one play note, 4 s offline in 82 ms (2.1% of real time, receiver only). No Filament or Cathode voice code changed.
- 2026-10-15 (interactive): Phantastron, a circuit-bent toy, on the rack rail beside Gyrotron and Klystron. A clocked voice (made-up phrases, three resonators, a short DAC, a sample-and-hold) and an on-screen board: drag a wire to change clock speed, bit depth, a stuck loop, or feedback. Keys, wheels, sustain, and Panic. The red rec button records Phantastron. Rebased onto Klystron. Plate is model 15; Klystron stays model 14; Gyrotron stays model 13. Cache `dxedge-v92`. Suite: ALL PASS (857 checks). `scripts/test_synth_imported.py`: ALL PASS. CPU (test 9, headless): Cathode 8.6%; Filament 8 voices 12.4% (Ladder 24) and 11.9% (Valve 12); stereo offset 12.7%; 16 voices with ensemble 17.7%. Dekatron Spark 4.7% (drums only). Thyratron Walnut Bass, one note, 2.9% (voice only). Mote Drift Glass 2.7% (grains only). Lattice Glass Pad, one note, 13.5% (Lattice only). No speech ROM and no sample.
- 2026-10-15 (interactive): Trochotron, a fractal seed instrument, on the rack rail beside Geissler, Pentagrid, and Orthicon. A seed grows a piece (L-system, Mandelbrot, Julia, logistic map, Lorenz, or a digit sequence). The same seed and the same settings are the same notes. Drag and zoom on the Mandelbrot or Julia picture change the piece while it plays. Notes can stay on the built-in voice or go to another rack device, including Pentagrid and Orthicon. Export is a `.mid` file, and `?tr=` is the share link. The red rec button records Trochotron. Plate is model 12; Orthicon stays model 11; Pentagrid stays model 10. Rebased onto Orthicon. Cache `dxedge-v89`. Suite: ALL PASS (765 checks). `scripts/test_synth_imported.py`: ALL PASS. CPU (test 9, headless): Cathode 9.7%; Filament 8 voices 14.2% (Ladder 24) and 14.5% (Valve 12); stereo offset 15.8%; 16 voices with ensemble 21.3%. Dekatron Spark 5.1% (drums only). Thyratron Walnut Bass, one note, 3.3% (voice only). Mote Drift Glass 3.4% (grains only). Lattice Glass Pad, one note, 16.7% (Lattice only). Pentagrid, carrier plus one play note, 4 s offline in 99 ms (2.5% of real time, receiver only). Recorded Orthicon 441.4 Hz matches live 441.4 Hz, level x1.00. No Filament or Cathode voice code changed.
- 2026-10-15 (interactive): Orthicon, a spectral painter, on the rack rail beside Geissler and Pentagrid. A log-frequency picture is painted, dropped in as an image, or analysed from a file, the microphone, or the rack, then scanned back into sound. Additive resynthesis and an overlap-add inverse FFT. Brushes are soft, hard, harmonic, noise, and eraser. Smear, blur, shift, stretch, freeze, and quantize edit the picture. Keys mode transposes it, with C4 at the picture's own pitch. Five generated pictures. Capture rack is an input. The red rec button records Orthicon. Geissler can route a species to Orthicon or Pentagrid. Original engine; no spectral-paint source was copied. Rebased onto Pentagrid (model 11, mixer O). Cache `dxedge-v88`. Suite: ALL PASS (731 checks). `scripts/test_synth_imported.py`: ALL PASS. CPU (test 9, headless): Cathode 8.7%; Filament 8 voices 11.4% (Ladder 24) and 11.0% (Valve 12); stereo offset 12.8%; 16 voices with ensemble 17.8%. Dekatron Spark 4.8% (drums only). Thyratron Walnut Bass, one note, 3.0% (voice only). Mote Drift Glass 3.1% (grains only). Lattice Glass Pad, one note, 13.8% (Lattice only). Pentagrid, carrier plus one play note, 4 s offline in 83 ms (2.1% of real time, receiver only). Recorded Orthicon 441.4 Hz matches live 441.4 Hz, level x1.00. No Filament or Cathode voice code changed.
- 2026-10-15 (interactive): Pentagrid, a shortwave receiver, on the rack rail. Original AudioWorklet: dial, band noise, crackle, fading, heterodynes, formant speech, Morse at a set WPM, a made-up call-sign exchange, FSK, chimes, digit tones, and time pips. Play mode turns the keys into those beats. Band conditions can follow `GET /api/solar`. No recordings. Rebased onto main after Geissler and the SOTA/DX Summit removal. The red rec button records Pentagrid. Cache `dxedge-v87`. Suite: ALL PASS (701 checks). `scripts/test_synth_imported.py`: ALL PASS. CPU (test 9, headless): Cathode 10.3%; Filament 8 voices 11.6% (Ladder 24) and 11.0% (Valve 12); stereo offset 12.5%; 16 voices with ensemble 17.3%. Dekatron Spark 6.8% (drums only). Thyratron Walnut Bass, one note, 2.9% (voice only). Mote Drift Glass 2.6% (grains only). Lattice Glass Pad, one note, 13.1% (Lattice only). Pentagrid, carrier plus one play note, 4 s offline in 78 ms (2.0% of real time, receiver only). No Filament or Cathode voice code changed.
- 2026-10-15 (interactive): Geissler, a generative meadow, on the rack rail. Reeds, grazers, stalks and flickers wander a seeded 2D world and play on meetings, meals, births and deaths. A child blends pitch and rhythm genes. Position is pan, size is level, energy is brightness. Scale, tempo grid, and a free mode. Seasons shift the key. Species can route to other rack devices. Voice pool capped at 16. The red rec button records Geissler. Original oscillators; no third-party DSP. Cache `dxedge-v86`. Suite: ALL PASS (668 checks). `scripts/test_synth_imported.py`: ALL PASS. CPU (test 9, headless): Cathode 10.1%; Filament 8 voices 12.4% (Ladder 24) and 12.1% (Valve 12); stereo offset 14.3%; 16 voices with ensemble 18.5%. Dekatron Spark 5.2% (drums only). Thyratron Walnut Bass, one note, 3.1% (voice only). Mote Drift Glass 3.0% (grains only). Lattice Glass Pad, one note, 14.2% (Lattice only). No Filament or Cathode voice code changed.
- 2026-10-14 (interactive): Heptode, a MIDI-file player, on the rack rail. Every channel starts as one plain voice. Per track: wave and FM, filter and envelope, drive, delay, chorus and reverb sends, and an orb on the stereo field. Packed score playback in the AudioWorklet, with a polyphony cap and a performance cull for files past 100,000 notes. Library is original sequences of public-domain pieces, an original tune (Glass Arcade), and a generated density file. Rebased onto the master-recorder fix. The red rec button records Heptode. Loading a buffer into Mote clears that device's delay and reverb so the new source is not heard through the previous tail. Cache `dxedge-v84`. Suite: ALL PASS (631 checks). `scripts/test_synth_imported.py`: ALL PASS. CPU (test 9, headless): Cathode 8.6%; Filament 8 voices 11.6% (Ladder 24) and 10.8% (Valve 12); stereo offset 12.6%; 16 voices with ensemble 17.5%. Dekatron Spark 4.6% (drums only). Thyratron Walnut Bass, one note, 2.9% (voice only). Mote Drift Glass 2.8% (grains only). Lattice Glass Pad, one note, 13.9% (Lattice only). No Filament or Cathode voice code changed.
- 2026-10-14 (interactive): Mote, a granular instrument, on the rack rail. Original grain engine in an AudioWorklet. File, microphone, and rack-capture sources. Glass, air and bell are generated CC0 sounds. signalsmith-stretch was not used. The keyboard map was not edited. Rebased onto Thyratron and Gleam. Cache `dxedge-v82`. Suite: ALL PASS (545 checks). CPU (test 9, headless): Cathode 9.1%; Filament 8 voices 11.5% (Ladder 24) and 11.0% (Valve 12); stereo offset 12.6%; 16 voices with ensemble 17.3%. Dekatron Spark 4.6% (drums only). Thyratron Walnut Bass, one note, 2.7% (voice only). Mote Drift Glass 2.7% (grains only). Lattice Glass Pad, one note, 13.1% (Lattice only). No Filament or Cathode voice code changed.
- 2026-10-14 (interactive): Gleam, a touch field, on the rack rail and full screen at `/synth/gleam/`. Each pointer is a voice (across is pitch on a chosen scale, up is timbre, pressure is level). A room of orbs sets pan and distance, with optional HRTF, and orbs can orbit or drift. Gestures record and loop. Effect mode inserts a lowpass, stutter and delay on the rack master only while a finger is down. Original code, no third-party DSP. Rebased onto Thyratron and Lattice. Cache `dxedge-v81`. Suite: ALL PASS (514 checks). CPU (test 9, headless): Cathode 9.8%; Filament 8 voices 12.1% (Ladder 24) and 11.0% (Valve 12); stereo offset 13.5%; 16 voices with ensemble 17.9%. Dekatron Spark 4.7% (drums only). Thyratron Walnut Bass, one note, 2.8% (voice only). Lattice Glass Pad, one note, 13.5% (Lattice only). No Filament or Cathode voice code changed.
- 2026-10-14 (interactive): Thyratron, a monophonic ladder-filter device on the rack. Three oscillators (oscillator 3 can run as the mod-wheel source), mixer with noise and feedback, 24 dB/octave ladder that sings at full emphasis, two ADS contours, glide, pitch and mod wheels. Wood-and-black panel and six presets (Walnut Bass, Pilot Lead, Herald Brass, Arc Sweep, Crypt Wail, Bone Rattle). Registered in `device.js`. A reload onto Thyratron or Lattice builds the shared output knobs from the Filament patch. Rebased onto the stuck-key fix and Lattice. Cache `dxedge-v80`. Suite: ALL PASS (478 checks). CPU (test 9, headless): Cathode 9.3%; Filament 8 voices 11.6% (Ladder 24) and 11.5% (Valve 12); stereo offset 12.4%; 16 voices with ensemble 17.4%. Dekatron Spark 4.6% (drums only). Thyratron Walnut Bass, one note, 2.8% (voice only). Lattice Glass Pad, one note, 13.3% (Lattice only). No Filament or Cathode factory patch changed.
- 2026-10-14 (interactive): Lattice, a wavetable device, on the rack rail. Two mipmapped oscillators, warp (bend, sync, PWM-style, FM from oscillator B), unison, sub, noise, two multi-mode filters, a drag-and-drop modulation matrix, and WAV import. The panel is flat. Factory cycles are generated in the repo; Vital and Surge were reference only, and AKWF was not shipped. Cache `dxedge-v79`. Suite: ALL PASS (442 checks, including the stuck-key checks that landed on main the same day). CPU (test 9, headless): Cathode 8.5%; Filament 8 voices 11.7% (Ladder 24) and 11.0% (Valve 12); stereo offset 12.8%; 16 voices with ensemble 17.9%. Dekatron Spark 4.6% (drums only). Lattice Glass Pad, one note, 13.3% (Lattice only). No Filament or Cathode voice code changed.
- 2026-10-13 (scheduled task, run at about 5 PM PT): bug check clean (suite ALL PASS 228 on origin/main, live page loaded with no page errors or failed requests, live sw.js matched the repo at v72). The one-time MIDI deck catch-up was already on main (`2b5ed70`), so nothing to apply. Built the first unchecked item, the graphic EQ, rack-wide: patch fields `out.eqOn`, `eqBands`, `eqGains`, `eqPre`, `eqPreset` on both devices (shared `normEq`, old patches load with it off), the engine applies them (band count changes inside the click-free reroute), presets and fitting in rack.js, a Graphic EQ section in the Rack tab with a live spectrum. Fixed while porting: a key step of 0.5 dB from 0 was swallowed by the pointer's snap to zero. Built as `97cc184`; not pushed that night (the job's push was refused). Landed on main by the 16 Oct nightly; see that line for the hash and the suite count. Suite: ALL PASS (267 checks; 33 new in Q. and 6 new phone checks). CPU (test 9, headless): Cathode 28.0%; Filament 8 voices 52.9% (Ladder 24) and 57.8% (Valve 12); stereo offset 51.7%; 16 voices with ensemble 58.1%; 8 voices with the EQ on at 31 bands 53.7%. Those are well above the afternoon's numbers because this server was busy: an interleaved A/B of origin/main against this build in the same window measured the build no slower (base 71 to 88%, build 63 to 82%, 8 voices Ladder 24). No patch changed and no existing sound changed (the EQ is off unless a patch turns it on). Worth a listen: the EQ presets, and a boost driving the output tubes.
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
