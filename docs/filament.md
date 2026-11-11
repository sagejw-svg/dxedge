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
| `frontend/public/synth/voice.worklet.js` | Both devices' engines (AudioWorklet): processor `filament` (oscillators, V1, filter slots A and B, envelopes, LFOs, the mod matrix, the arpeggiator (class `Arp`), voices, 1939 mode (`render39`: divide-down masters, the fixed resonator bank, the seven shapes, six-channel vibrato); `fresp()` for the response plot, and `frun39()` for 1939 mode's bank on it, never called on the audio thread) and processor `cathode` (one voice, the patch graph, diode-clipped SVF high-pass and low-pass) |
| `frontend/public/synth/filtplot.js`, `filtplot.worker.js` | The filter response plot: a worker runs a silent copy of the `filament` processor (the worklet file evaluated with stand-ins for the AudioWorklet globals), rings its filters with a small impulse through `fresp()` and reads the response with a Goertzel pass; the page draws it. In 1939 mode the curve is the fixed resonator bank (`bank` on the response) and the plot sits in the 1939 mode section |
| `frontend/public/synth/engine.js` | Builds the devices + rack in any context; `setDevice`; `renderOffline`; `midiEvent`; hosts the mixer, transport and device facades. The master gain feeds `makeMasterFx` after the mixer (a bypassed offline render skips the worklet; `masterFx: false` wires the gain straight through) |
| `frontend/public/synth/masterfx.js`, `master.worklet.js`, `masterui.js` | Master bus after the mixer and the output chain: tempo-syncable stereo delay, Freeverb-style reverb, bus compressor/limiter. Each bypasses on its own. State is `filament_master` in localStorage, not a device patch |
| `frontend/public/synth/fread.js` | Fader readouts (display only): `hookFader` (hooks an input's value setter so every write repaints its window and aria-valuetext), `addFread` (makes the window after a fader) and the formats `FREAD_FMT`. Used by the mix desk, the deck tempo, the header VOL, Heptode, Gleam and Resnatron; the `.fread` window style is in `desk.css` |
| `frontend/public/synth/wav.js` | 24-bit / 44.1 kHz stereo WAV: live record of the master, and offline render of N seconds (10 minute cap) |
| `frontend/public/synth/patches.js` | Filament patch schema v1, defaults, `normalize`, the factory set, the mod matrix's source and destination lists (`MOD_SRC`, `MOD_DST`; the worklet carries the same lists and the suite checks they match) |
| `frontend/public/synth/smf.js` | Our own Standard MIDI File reader and writer (pure functions): `readSMF`, `songOf` (tempo map to seconds, multi-channel tracks split per channel, format 2 played in sequence), `writeSMF` (format 1, 480 ppq), `bytesOf` |
| `frontend/public/synth/deck.js` | The MIDI deck above the keys: recorder, import with the track list and device chips, the player (150 ms lookahead, 25 ms timer, frame-exact `at`), Render WAV. Its clock is private; it still uses `smf.js` |
| `frontend/public/synth/player.js` | Song library player. Loads a bundled file, an opened file, or a drop, and plays it on `host.transport` (play, stop, tempo). Each MIDI channel routes to a device |
| `frontend/public/synth/paperroll.js` | The paper roll's pure part: the pattern schema (`kind: 'paperroll'`, `v: 1`; 16 steps of note, punch, accent, slide, tie; length, step rate, gate, swing, velocity, accent velocity, transpose), `normalizeRoll`, `rollPlan` (the notes that start on a run of steps, ties and slides resolved), `rollScore`, six factory rolls |
| `frontend/public/synth/paperroll-ui.js` | The paper roll strip under the song library: the step editor, the scheduler on `host.transport` (150 ms lookahead, a 25 ms timer, frame stamps, the library player's delivery paths; a strike more than 60 ms late is dropped), the canvas of punched paper moving past a brass reader. State in localStorage `filament_roll` |
| `frontend/public/synth/theremin.js` | Theremin mode's pure part: the page settings (`filament_theremin`: on, the pad's left note C1 to C4, 1 to 5 octaves across, snap, volume range 12 to 60 dB), `normalizeThm`, `padPitch` (across to a fractional MIDI pitch, snap pulling toward the nearest note), `padLevel` (up to a level: the bottom 3% is silence, then the range in dB to 0 dB at the top), `tuneOf` (nearest note and cents). Our own code. |
| `frontend/public/synth/theremin-ui.js` | The Theremin section (Filament's Pad tab on a phone): the pad (pointer, one note at a time, and keys: Enter, arrows, Escape), the chips and knobs, the readout, the pad drawn in the page's frame loop, and `eye()`, which the frame loop asks for the magic eye's tuning while the pad is held. Sends `{t:'thm',on,p,a}` to Filament's worklet. Our own code. |
| `frontend/public/synth/share.js` | Patch links and patch files (10 Nov 2026), our own code: the `dxpatch` document (`kind: 'dxpatch'`, `v: 1`, `device`, `name`, `patch`, the whole normalized patch, not a difference from today's defaults), `encodePatch` (the `?p=` text: `1z` + base64url of the JSON deflated with CompressionStream 'deflate-raw', or `1j` + base64url of the plain JSON where a browser has no CompressionStream), `decodePatch` (reads at most 65536 characters and inflates at most 262144 bytes), `readDoc` (a dxpatch, or a bare patch on the device it names or the lit one; never a project or a mix), `safeJSON` (drops `__proto__`, `constructor` and `prototype` keys), `patchFileName`. index.html applies a document through the device's own normalizer (`applyPatchDoc`, the menu's path, so undo goes back) and reads `?p=` once at boot, then takes it off the address |
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
| `frontend/public/synth/transport.js` | Master clock: tempo 40–240, play/stop, 24 ppq. `clockTicks` and `describeTick` are pure. `engine.js` posts its state (`{t:'clock'}`) to the Filament and Cathode worklets on play, stop, tempo and locate, for tempo-synced LFOs |
| `frontend/public/synth/project.js` | Project JSON (`kind: 'dxrack'`, `v: 1`): both synth patches, mixer, tempo, keyboard device. localStorage key `dxrack_project` |
| `frontend/public/synth/rack.js`, `tubepaint.js`, `knob.js` | Copied from /otr at f9f5d2b (decision 5) plus marked "Filament additions" (in rack.js: the push-pull stage, mono check, ceiling, ensemble, the tape echo, the spring reverb's mix around its worklet, and the graphic EQ's presets, fitting, resampling and live spectrum tap; in tubepaint.js: the four-tube state, the tube show overlay, and the big tube view's zoom, pan, quality and wide chassis) |
| `frontend/public/synth/spring.worklet.js` | AudioWorklet processor `filament-spring`: the spring reverb tank (a tube driver, two dispersive allpass loops, one per side). Our own model; `makeSpring` in rack.js wraps it |
| `frontend/public/synth/fm/` | Hexode, a vendored six-operator FM page (MIT, Matt Montag). The name on the page is Hexode. See `CHANGES.md` and `THIRD_PARTY_NOTICES.md` |
| `frontend/public/synth/acid/` | Anode, a vendored acid bass groovebox (CC BY 4.0, David Whiting / Vitling). The page credits the author. Drums in this copy are synthesized. See `CHANGES.md` |
| `frontend/src/components/Synth.jsx` | Thin iframe shell; tab group "Synth" in `App.jsx`. Links Hexode and Anode |
| `scripts/test_synth.py` | The suite. Must print ALL PASS before any push |
| `scripts/test_synth_imported.py` | Smoke test for Hexode and Anode: they load, stay quiet, and make a sound |
| `scripts/bench_filament_voice.mjs` | Filament voice worklet in Node with a seeded random: CPU per case, with `--ref <git ref>` an A/B that says whether the output is bit-identical, with `--profile <case>` self time per function, and with `--subnormals` the state fields that end a block holding a subnormal number (exit 3 if any). `--seconds N` sets the render length (default 6). For CPU work; not part of the suite |
| `scripts/bench_spring.mjs` | The spring reverb tank (`spring.worklet.js`) in Node on a fixed input of our own (test 9's chord, a noise burst, silence, knob moves and clears): CPU per case, and with `--ref <git ref>` an A/B that says whether the output is bit-identical (exit 1 if not). `--seconds`, `--rounds`, `--sr`, `--cases`. For CPU work; not part of the suite |
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
- [x] State variable 12 multimode with morph (LP, BP, HP, notch) - 25 Oct 2026 (nightly). Chip "SVF 12".
      A 2-pole state variable loop (high-pass into two integrators, band-pass and low-pass after them), trapezoidal.
      A new patch field `filt.morph` (0 to 3, default 0) slides the output from low-pass (0) through band-pass (1,
      scaled by sqrt 2 so it peaks at unity at zero resonance) and high-pass (2) to notch (3, high-pass plus low-pass);
      its knob shows only on SVF 12, it is smoothed, and it does nothing on the other models. Zero resonance is the flat
      (Butterworth) point, so the knob is the -3 dB point. Resonance is the damping taken down by positive feedback of the
      band-pass through a soft clip (level 1.8); the damping crosses zero at 0.9 on the knob and full resonance goes 11%
      past, so it sings from about 0.92 (a near sine at low-pass and band-pass, about -12 dBFS at the voice). At notch
      the singing fundamental cancels (measured 51 dB under low-pass); what is left is the loop's harmonics, about -39 dBFS.
      Both integrators are OTA-style: each one's gain is tanh(u x 0.35)/(u x 0.35) of its input, so drive makes them slew
      (a loud 2 kHz tone over a 500 Hz cutoff: -0.07 dB at drive 3, -1.4 dB at drive 10). Every ratio is taken at the last
      sample and the loop is then solved in closed form (no iteration, no allocation). The low-pass passes DC at unity at
      any resonance, so no make-up. Self-oscillation pitch corrected by a measured amount (77.8 - 230 g0 cents at full,
      scaled from the 0.9 threshold): within 0.6 cents from C3 to C7. New factory patch Notch Drift (Pad): two saws through
      the notch, swept slowly by LFO 1. No other patch changed.
- [x] Low pass gate (vactrol), then move Hollow Pluck onto it - 26 Oct 2026 (nightly). Chip "LP gate", id `lpg`.
      A vactrol per voice follows the amp envelope (with velocity): it lights with a 2.5 ms time constant and lets go
      with one of `filt.lag` x (0.25 + 0.75 (1 - c)) for conductance c, so it drops quickly from fully lit and the dark
      tail takes the whole lag (new field `filt.lag`, 0.02 to 3 s, default 0.3). Its conductance sets the cutoff
      (proportional to it, as an RC's is) and the voice level together, so a note darkens as it fades. New field
      `filt.gate` picks what it drives: `both` (default), `lp` (the filter only; the level follows the envelope) or `vca`
      (the level only). The filter is the SVF 12 loop at low-pass with full resonance taking the damping only to 0.5
      (Q 2, +6 dB at the cutoff), so it never sings. A released voice stays on until the vactrol is dark (-80 dB) when the
      vactrol drives the level. Our own model, no iteration or allocation; the vactrol is a few operations a sample.
      Measured: at full sustain the knob is the -3 dB point (test 2); 2 ms after a note it is about 9 dB under steady and
      within 0.3 dB by 10 ms; at lag 0.3 s the first 6 dB take about 25 ms a dB and -20 to -40 dB about 34 ms a dB.
      Hollow Pluck now uses it (retuned, see the 26 Oct log line). Schema stays v:1; old patches load with the defaults.
- [x] Dual filter slots A and B with serial, parallel and split routing - 27 Oct 2026 (nightly), first slice. Section "Filter B" on
      the Filter tab. New patch object `filtB`: `route` (`off` default, `serial`, `parallel`, `split`), `model` (every model but the
      low pass gate; default SVF 12), `cutoff` (20 Hz to 20 kHz, default 2 kHz), `res`, `keytrack` (default 0.5), `env` (-1 to 1, the
      shared filter envelope), `morph` (SVF 12 only) and `bal` (parallel only, -1 all A to +1 all B). Schema stays v:1; a patch with no
      `filtB` loads with B off. Serial feeds A's output into B. Parallel feeds both from V1 and sums them at equal power (0.707 each at
      `bal` 0, so two identical filters come out 3 dB up and two filters on separate bands 3 dB down each). Split plays A on the left
      and B on the right; the stereo offset then moves A down and B up by half the offset each. B shares A's drive (and its make-up),
      velocity amount, loop tube (Valve 12 in B uses the V2 loop tube and its sag), and the LFO, wheel and pressure moves on cutoff.
      B runs a second filter per voice for the right side in serial and parallel when the sides differ (stereo offset, or an LFO with
      stereo phase on cutoff), like A. Sallen-Key 12 in B has no high-pass partner. A route or B-model change rides the 6 ms duck and
      starts B's filters from rest. With B off the engine is unchanged: the seeded Node bench says the output is bit-identical to
      origin/main on all 27 earlier cases, and B's filters draw no random numbers while it is off. No factory patch uses B yet.
      Measured (test section Fb.): B on each of the six models, behind an open A, matches the same model in slot A within 0.004 dB
      at 250 Hz, 1 kHz and 4 kHz; serial low-pass into high-pass, and parallel low-pass beside high-pass, match the 2-pole models
      within 0.01 dB from 100 Hz to 4 kHz; split's left side is A alone and its right side B alone within 0.01 dB; B on Ladder 24
      sings and tracks the keys within 1 cent.
      Still open from this item (follow-ups, not ahead of the next item below): B's own drive and velocity amount (the design doc
      lists them per slot; tonight they are shared); the low pass gate in slot B (it gates the whole voice, so it stays in A for now);
      the tube show reading B (V2's resonance glow follows A only); and a factory patch or two on the routes, once James has listened.
- [x] Live filter response plot - 28 Oct 2026 (nightly). In the Filter section on the Filter tab, under the chips: a log plot
      from 20 Hz to 20 kHz and +24 to -48 dB, with a readout above it. Not a separate model of the filters: `filtplot.js`,
      in a worker (`filtplot.worker.js`), evaluates `voice.worklet.js` and keeps one silent Filament processor, and its new `fresp()` rings slot A, and
      slot B when it is on, with an impulse of 1e-4 through fresh filters at the 2x rate, using the same `fcoef()` and filter
      code the voices run (Valve 12's filter drifts on its own from rest because its loop tube has an offset, so a run with no
      input is taken off first). A Goertzel pass reads each response at 160 log-spaced points. Serial multiplies A and B,
      parallel sums them with their phases at the route's gains, split draws A (amber, left) and B (blue, right). The amber
      curve is the knobs at middle C (no key tracking, envelope or velocity offset). While a note plays, the worklet's meter
      now carries the newest voice's two cutoffs (after key tracking, envelope, velocity, LFOs, wheel, pressure and the
      vactrol) and a live curve rides over a dimmed knob curve, with a line at each live cutoff. A filter that does not decay
      reads "sings near <f>" (it is off the top of the plot); otherwise the readout gives the peak above +1 dB. Nothing in the
      audio path changed: the seeded Node bench says every case is bit-identical to origin/main. Measured (test section Fp.):
      the plot against quiet sine tones through the voice, relative to the same model wide open, at 250 Hz, 1 kHz and 4 kHz,
      on all seven models at resonance 0 and 0.6: worst 0.04 dB; serial and parallel from 100 Hz to 4 kHz: worst 0.02 dB.
      Cost on this box, in the worker: a curve takes 0.3 to 1.6 ms on average and 3 to 9 ms in the slow case (60 Hz at
      resonance 0.85, the response is long); drawing on the page takes 0.1 to 0.6 ms a frame. One request is in flight at a
      time; live curves come at most 15 times a second, only when a cutoff moved by more than 1/48 octave. The worker starts
      the first time the Filter section is on screen. (A first build computed on the page's main thread; moved to the worker
      because a ringing filter took 10 ms or more there.)
      Still open from this item (follow-ups): the stereo offset (the plot draws the centre, not the left and right filters);
      drive and loud notes (the plot is the small-signal response, what a quiet note hears; drive bends the real one);
      dragging on the plot to set cutoff and resonance; a plot for Cathode's two filters.
- [x] Mod matrix: 8 slots (sources: envs, LFOs, velocity, key, wheel, aftertouch, random) - 29 Oct 2026 (nightly), first slice.
      Section "Mod matrix" on the Mod tab (the full row on a wide screen, two columns on a laptop, one on a phone): eight rows,
      each a source menu, a destination menu and an amount knob. New patch object `mod` with slots `s1` to `s8`, each `src`,
      `dst` (both `off` by default) and `amt` (-1 to 1, default 0). Schema stays v:1; a patch with no `mod` loads with every slot
      off, and no factory patch uses it, so nothing you have sounds different. The amount knobs take MIDI learn like any knob, and
      the slots are in the device parameter table (24 entries; see the Improvement backlog on how that table types the amounts). Sources, per voice at the control rate (every 8 samples): amp envelope and filter
      envelope (0 to 1), LFO 1 and LFO 2 (-1 to 1, after their delay; the left side), velocity (0 to 1), key ((pitch - 60) / 60:
      middle C is 0), mod wheel and pressure (0 to 1), and random (-1 to 1, a new value at every note on, drawn only when a slot
      uses it). Destinations and what amount 1 means: pitch and osc 2 pitch 12 semitones, pulse width 0.45, FM and ring 100%, the
      four mixer levels 100%, V1 drive 10 drive units (the gain and its make-up, from a 41-point table built with the patch),
      cutoff and B cutoff 5 octaves (so Key at 1 is exactly 100% key tracking), resonance and B resonance 1, morph 3, level a
      gain of 1 + amount x source (0 to 2), pan 1. The knob shows the amount in those units. Slots on one destination add up,
      and the mixer levels, FM, ring, drive, resonance, morph, level and pan are clamped to their ranges after the sum. The amounts are smoothed like any knob; a change of source or destination rides the
      6 ms duck. With every slot off the engine is unchanged: the seeded Node bench says all 30 earlier cases are bit-identical
      to origin/main, and the matrix draws no random numbers. Measured (test section Mm.): key to pitch at C5 0.0 cents off,
      a square LFO 1 to pitch +100.0 and -100.0 cents at 1/12, filter envelope to cutoff at 0.7 against the envelope knob at 0.5
      and key to cutoff at 1 against key tracking 100% (slots A and B) match within 0.01 dB, velocity to resonance makes Ladder 24
      sing on a hard note only, wheel to level at -1 is -6.02 dB at half wheel, pressure to pan reaches hard right, amp envelope
      to V1 drive at sustain 0.5 matches the drive knob at 5 within 0.01 dB (fundamental and H2 to H4), and random to pitch gives
      each note its own steady pitch.
      Still open from this item (follow-ups): a third, free envelope as a source (the design doc lists one; tonight the
      sources are the amp and filter envelopes); tube bias as a destination (it changes the tube's table, not a gain); the LFO
      rates and depths, envelope times, glide, detune, filter drive, B balance and the stereo offset as destinations; the right
      side of an LFO for stereo moves (the matrix uses the left side on both); the drawer over the panel the design doc
      describes (tonight it is a section on the Mod tab, like the other modules); and lamps that show each slot moving.
- [x] Host clock and transport (one shared tempo the arp and LFO sync read) - 30 Oct 2026 (nightly). The clock itself landed with the
      rack framework on 14 Oct (tempo, play/stop, subscriptions); tonight Filament's two LFOs read it, and the arpeggiator (the next
      item) will read the same clock message when it is built. New patch fields `lfo1.sync` and `lfo2.sync`: `off` (default, the rate
      knob as before) or a note value one LFO cycle lasts: 4/1, 2/1, 1/1, 1/2d, 1/2, 1/2tr, 1/4d, 1/4, 1/4tr, 1/8d, 1/8, 1/8tr, 1/16d,
      1/16, 1/16tr, 1/32 (d dotted, tr triplet; lengths in quarter-note beats in `LFO_SYNC_BEATS`, the worklet's `SYNC_BEATS` matches).
      Synced, the rate is tempo / 60 / beats (1/4 at 120 BPM is 2 Hz) and the rate knob is ignored and dimmed. A global synced LFO,
      while the rack transport plays, takes its phase from the transport position (beat / beats), so its cycle starts on the bar;
      stopped, it runs on at the synced rate from where it was. A per-voice synced LFO restarts at each note, as before, at the synced
      rate. How it gets there: the engine posts `{t:'clock', tempo, playing, beat, frame}` to the Filament and Cathode nodes on play,
      stop, tempo and locate (and in `processorOptions` when a node is built); the worklet extrapolates the beat from the frame, so
      there is one message per change, not per pulse, and no drift (both count the same sample clock). An offline render takes the
      `tempo` it is given, and a scheduled `clock` event (`at`) can start the transport inside a render (the tests do). The deck's
      Render WAV now passes the rack tempo. UI: a sync menu in each LFO section (Mod tab) with a readout ("3.00 Hz at 90 BPM", or
      "free"). The meter message now carries the worklet's clock and both global LFO phases (`clk`, `lfo`), which the tests read.
      Schema stays v:1; no factory patch uses sync, so nothing sounds different: the seeded Node bench says all 31 earlier cases are
      bit-identical to origin/main (new case `lfosync`). Measured (test section Ls.): a square tremolo flips every 250.0 ms at 1/4 and
      120 BPM, 333.3 ms at 90 BPM, 225.0 ms for LFO 2 at a dotted 1/8 and 100 BPM (each within 1 ms; the rate knob sat at 5 Hz);
      started at beat 0 at 0.37 s the LFO turns on there and flips 0.25 and 0.5 s later, started half a cycle in it flips 0.25 s later;
      a change from 120 to 60 BPM at beat 2 keeps the phase; a per-voice LFO starts at its note, not the bar; live, the worklet's beat
      matches the transport's within 0.01 beat and LFO 1's phase is the beat in eighths within 1e-6.
      Still open from this item (follow-ups): Cathode's MG sync (Cathode gets the clock message but does not read it yet); the song
      library and file render follow the rack tempo (the deck's file render does not yet scale the tempo by its 50-200% rate); a
      "retrigger on play" choice for per-voice LFOs; a phase knob so a global synced LFO can start its cycle off the bar.
- [x] Arpeggiator: up, down, up-down, random, as played; 1-4 oct; 40-240 BPM; gate, swing, latch - 31 Oct 2026 (nightly), Filament.
      Section "Arpeggiator" on the Play and Mod tabs: an on switch, five mode chips, a step menu with a readout ("8.00 steps/s at
      120 BPM"), a latch switch, and octave, gate and swing knobs. New patch object `arp`: `on` (false), `mode` (`up`, `down`, `updown`,
      `random`, `played`), `div` (the note value one step lasts: 1/2, 1/4d, 1/4, 1/4tr, 1/8d, 1/8, 1/8tr, 1/16d, 1/16, 1/16tr, 1/32;
      default 1/16; lengths from the LFO sync table), `oct` (1 to 4), `gate` (0.05 to 1, default 0.5), `swing` (0 to 0.5, shown as
      50% to 75%) and `latch` (false). Schema stays v:1; a patch with no `arp` loads with it off, and no factory patch turns it on.
      It runs in the worklet (class `Arp` in `voice.worklet.js`), so steps are sample-exact and an offline render plays it. While on,
      note on and off messages go to it instead of the voices; it plays one note a step through the ordinary note on and off, so
      unison, mono and legato, glide and the mod matrix treat its notes like keys. The tempo is the rack's (40 to 240 BPM, from the
      clock message the LFO sync item added). While the rack transport plays, steps sit on the transport's beat, so they land on the
      bar and a key pressed between steps waits for the next one; stopped, the first note plays with the key and the grid runs from
      there. When Play lands within 0.4 of a step of the last note, the arp skips to the step after, so pressing Play does not flam.
      Up and down sort the keys by pitch, as played keeps the order they went down, up-down plays the ends once each, random picks
      from the same notes each step; the octaves repeat the pattern 12 semitones higher each time. Each note plays at its key's
      velocity. Swing delays every second step by that share of a step (0.5 is 3:1, 1/3 the triplet shuffle). Gate is the share of
      its step a note holds; at 1 it lets go on the next step's frame. Latch keeps let-go keys; the next key pressed with none down
      starts a new chord. The sustain pedal holds let-go keys until it rises, but never holds the arp's own notes. Switched on over
      held keys it takes them; switched off, the keys still down (or on the pedal) play as a chord again. Keys from the song library
      or the MIDI deck are arpeggiated too; the page letting go of its keys (blur, tab hide, device change) leaves the file's keys.
      Nothing is allocated while it plays, and with it off the engine is unchanged: the seeded Node bench says all 32 earlier cases
      are bit-identical to origin/main (new case `arp`). Measured (test section Ar.): every mode and 2 and 3 octaves play the expected
      notes; a step every 125.0 ms at 1/16 and 120 BPM, 333.3 at 1/8 and 90, 83.3 for a 1/16 triplet (within 1 ms); swing 75% puts
      the off steps at 187.5 and 437.5 ms; gate 25% against 75% holds each note 62.5 ms longer (within 1.5); keys at 0.2 s with the
      rack playing wait for 0.25 s; Play at 0.37 s after keys at 0.1 s gives 0.1, 0.35, 0.62, 0.87 (no flam).
      Still open from this item (follow-ups): Cathode (the arp class takes any host with note on and off and the clock; Cathode needs
      the clock message read, a patch field and its panel section); a hold or arp button by the keys, as the design doc sketches;
      the MIDI deck records the keys, not the arp's notes (a take plays back through the arp, so it sounds the same only while the
      arp settings and tempo are unchanged); the tube show flares on key presses, not on each arp step; a chord mode (all keys
      every step) and a pattern restart on Play.
- [x] Ensemble: BBD chorus I, II, I+II, and a three-phase string ensemble - 13 Oct, stereo round
- [x] Tape echo: mono, ping pong, offset; wow and flutter; tube record amp - 1 Nov 2026 (nightly).
      Rack-wide, after the ensemble (ensemble > tape echo > EQ > output tubes), `makeTapeEcho` in rack.js below the additions
      line, plain Web Audio nodes like the ensemble. Patch fields `echo.on`, `mode` (mono, pingpong, offset), `time` (40 to
      1500 ms), `sync` (off or a note value from 1/2 to 1/16 at the rack tempo), `fb`, `mix`, `wow`, `flutter` (0 to 100%),
      `drive` (0 to 10), `tone` (0 to 10, a 1.8 to 9 kHz low-pass); Filament, Cathode and Dekatron carry the same fields.
      Off by default and no factory patch switches it on, so nothing sounds different. The record path: the mid plus the
      feedback through the record amp (an asymmetric tanh, 2x oversampled, slope 1 at rest; drive pushes up to 26 dB into
      it, so it saturates with H2 above H3 and keeps a runaway loop bounded), then a 100 Hz high-pass and the tone low-pass,
      both inside the loop, so each pass is darker. Two heads read the tape: mono plays head A on both sides; ping-pong
      plays head A on the right and head B at 2x on the left with feedback from B (R, L, R, L); offset plays head A left
      (feedback) and head B at 1.5x right. Wow (0.53 and 0.87 Hz, about 0.8% peak at 100%) and flutter (6.7 and 11.1 Hz,
      about 0.3%) move both heads. Mix keeps the dry at full level to 50% and brings the wet to full at 50%. A synced echo
      follows a tempo change (the tape glides to the new time). Timing: Chromium delays a 2x WaveShaper by 128 frames and
      closes a feedback loop one render quantum late; both are measured once per sample rate (`probeEchoLatency`) and
      taken off the heads, the input enters brk late, and the wiring is rebuilt per mode so the feedback head is the only
      delay line in the loop and the first input the merger pulls (a loop entered at a tap off the filter put the other
      head 128 frames late). Measured (section Te.): head times and every pass round the loop within 1 ms of the knob,
      sync and ping-pong and offset; 50% feedback steps -5.9 dB a repeat, 85% -1.3 dB; wow 100% 1.20% peak, flutter
      0.40%; off and mix 0 are sample for sample the stage taken out of the graph. Still open: a tape hiss or age control,
      a spring reverb after it (the next item), and factory patches that use it (a call for James).
- [x] Spring reverb: two tube-driven springs of different lengths, drip - 2 Nov 2026 (nightly).
      Rack-wide, after the tape echo (ensemble > tape echo > spring > EQ > output tubes). The tank is a worklet of its own,
      `spring.worklet.js` (processor `filament-spring`); `makeSpring` in rack.js below the additions line puts the mix around it in
      plain Web Audio nodes, like the echo. Patch fields `spring.on`, `mix` (0 to 100%, the echo's law: dry full to 50%, wet full
      at 50%), `decay` (0.5 to 6 s to -60 dB), `tone` (0 to 10, the reflections' low-pass, 1.5 to 4.5 kHz), `drip` (0 to 100%) and
      `drive` (0 to 10); Filament, Cathode and Dekatron carry the same fields. Off by default and no factory patch switches it on,
      so nothing sounds different. The tank hears the mid. A tube driver (the echo's record amp curve: slope 1 at rest, drive
      pushes up to 26 dB into it) and a 4-pole band-limit at 5 kHz feed two springs: A, 33.1 ms one way, on the left; B, 41.3 ms,
      on the right. Each spring is a loop: down the spring through a dispersion chain (24 stretched first-order allpasses, z^-1
      stretched to z^-K with K = sample rate / 12 kHz rounded, coefficient -0.3 to -0.75 from the drip knob) and a delay line to
      the pickup, back through a 100 Hz high-pass, the tone low-pass, the decay gain and a second chain. So the first arrival is
      one transit late, each echo after it one round trip later, lows arrive after highs (a falling chirp), and each pass smears
      it further. The delay lines are shortened by the chains' group delay at 1 kHz, so 1 kHz keeps the transit time at any drip;
      the decay gain makes up what the loop filters take at 700 Hz, so the knob is the decay there. Idle: off or mix 0 unplugs the
      feed (offline at once, live after the 0.3 s fade), the tank clears and sleeps until it hears a sound. Panic fades the tank
      out over 256 samples and clears it. Mono-safe: the sides are two different tanks, never inverted.
      Measured (section Sp., drip 0 for the times): 1 kHz arrives at 33.19 and 41.40 ms and again one round trip later (99.62 and
      124.23 ms; want 99.3 and 123.9); 300 Hz after 3 kHz by 2.2 ms at drip 0 and 11.2 ms at drip 100, and 30.5 ms on the next
      pass; decay at 500 Hz to 1 kHz 0.62, 2.61 and 6.17 s for the knob at 0.6, 2.5 and 6; 2 to 3 kHz rings 0.50 s at tone 0
      against 1.99 s at tone 10; the driver's H3 -74 dB at drive 0, -35 dB at drive 10; the wet sides correlate at +0.01 and the
      mono fold loses 1.1 dB; off and mix 0 are sample for sample the stage taken out of the graph. With more drip a short burst's
      envelope lands a little after 1 kHz's group delay (about +1 ms on the second arrival at drip 100), as a dispersive line does.
      Still open: a spring "crash" when the tank is knocked (a transient control or a button), a second, denser chirp band above
      the dispersive one (real tanks have one), and factory patches that use it (a call for James).
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
- [ ] 1939 mode (divide-down, LC resonators, seven envelope shapes, six-channel vibrato) - first slice 5 Nov 2026 (nightly).
      A second voice architecture for Filament's own voices (patch `era`, off by default; `render39` in
      voice.worklet.js). Our own design from the idea in the brief; no circuit or code copied.
  - [x] Divide down: twelve masters, one per pitch class at MIDI 108 to 119, run for the whole instrument; each
        counts its cycles (mod 1024) and a note is its master divided by 2 per octave down, its phase taken again
        from the master at every control tick, so octaves stay phase locked and land on equal temperament. Bend
        and tune move the masters. The wave is the divided square blended toward a four-octave staircase (`tone`).
  - [x] Fixed resonators after V1, one bank per voice that does not follow the key: body (300 Hz), voice
        (850 Hz) and edge (2.5 kHz) band-passes, mellow (1.1 kHz low-pass), thin (700 Hz high-pass) and open,
        picked by a row of six tone tabs and summed in parallel (the last tab out brings open in)
  - [x] Seven envelope shapes on one switch (organ, accent, bowed, swell, piano, harp, chime); the sustain pedal
        lengthens the release (`pedal`, 0.3 to 10 s) instead of holding notes
  - [x] Six-channel vibrato (`vib` cents, `rate` 4 to 9 Hz), channels at 94% to 109% of the rate, two pitch
        classes a channel, so a chord shimmers; the mod wheel and pressure add their vibrato depth
  - [x] Section "1939 mode" on the Osc tab (switch, shape chips, tabs, five knobs); the oscillators, both filters,
        the envelopes, the LFOs and the matrix show "resting" while it is on. Factory patches Exposition Choir (Pad)
        and Parlor Harp (Pluck)
  - [x] LC resonators as a filter model in slots A and B for the ordinary voice (the design's filter table) - 6 Nov 2026 (nightly).
        Model `lc` ("LC bank") in `filt.model` and `filtB.model`; render()'s model 7, `Filt.lc()` in voice.worklet.js. The same
        five sections as 1939 mode's bank (`E_LC`), each a trapezoidal state variable section, summed in parallel with the
        straight path by the slot's own tabs (`filt.tabs`, `filtB.tabs`, the six 1939 tab names; default body, voice and
        mellow; none in reads as open), then a soft clip (tanh) that the filter drive pushes. The cutoff moves the whole
        bank (`LC_REF` 850 Hz puts it where 1939 mode has it), so key tracking, the envelope, the LFOs, the wheel and the
        matrix's cut and res move it like a vowel; the resonance scales the Q by 10^(res - 0.3) (half at 0, 1939 mode's at
        0.3, five times at 1), the band-passes with sqrt(Q) of make-up so a broad sound keeps its level. Linear up to the
        clip, so it rings but never sings. A tab change on a slot running it rides the patch duck and restarts that slot's
        filters. The response plot draws it (fresp runs the same code). Panel: an "LC bank" chip in Filter and Filter B
        and a tabs row under each that shows only on that model. No factory patch uses it, so nothing sounds different.
  - [x] The filter response plot draws the resonator bank while 1939 mode is on - 7 Nov 2026 (nightly).
        `fresp()` in voice.worklet.js checks `e39` first: in 1939 mode it returns route 0 and fills slot A's response from
        `frun39()`, a unit impulse through the five sections as `render39` runs them (`lcK`, the tabs' `E_LC` gains, open as
        the straight path, all over the square root of the tabs in). The bank is fixed, so the curve ignores the cutoff, the
        key and slot B, and a note draws no live curve. The lab tags the response `bank`; the page then reads "1939 bank:"
        and the tabs that are in, with the peak, and draws no cutoff mark. The plot itself (readout and canvas, one element
        each) moves under the tone tabs in the 1939 mode section while the mode is on (Osc tab, phones too) and back into
        Filter above its knobs when it is off, so it is never shown dimmed under "resting". Measured: the plot against the
        voice (a C2 staircase's harmonics, each against open alone) within 0.06 dB on five tab sets, 65 Hz to 3.6 kHz.
        Display only: nothing in the audio path changed.
  - [ ] 1939 mode as a mod matrix destination set (tone, tab levels), if wanted
- [ ] Punched paper roll step sequencer - first slice 8 Nov 2026 (nightly). A strip under the song library ("roll"), rack-wide.
  - [x] The pattern: 16 steps, each a note, a punched hole (plays), accent (the accent velocity), slide (held 0.08 step into the
        next strike so a one-voice device plays them legato; into the same pitch it holds to the strike without overlap) and tie
        (the step does not strike; the note before carries on through it, across the loop seam too; a tie with nothing before it
        strikes if punched). Length 1 to 16, step 1/8, 1/8T, 1/16, 1/16T or 1/32, gate 5 to 100%, swing 0 to 60% (every second step
        late), velocity, accent velocity, transpose +/-24. `paperroll.js`, pure; old or partial patterns load with defaults.
  - [x] The scheduler on the rack transport: run on and the roll plays whenever the transport does, beside a library song and
        Dekatron's pattern; play on the strip turns run on and starts the transport from the top. Run is off on a fresh page, so
        a song never brings the roll in by surprise. Plays the device lit on the rail, or any rack device picked on the strip
        (the library player's delivery paths, frame-stamped, 150 ms ahead). A note's off waits until it is inside the lookahead,
        so a tempo change moves it; a rate or length change picks the grid up from the last scheduled beat. Stop flushes what
        Filament and Cathode still hold queued and lets every note go.
  - [x] The roll drawn as punched paper passing a brass reader: holes by pitch (a C row named on the take-up side), accents
        ringed, ties as slots, slides as channels to the next hole, a glue seam where the loop joins, sprocket holes, step numbers,
        spools at both ends; the reader's slit and lamp light as a hole passes. Reduced motion: the paper holds still and the
        column being read is lit. Drawn in the page's 30 fps frame loop only while the strip is open.
  - [x] Editing: tap a step on the paper to pick it, tap again to punch or close it; arrow keys and Enter on the paper; step
        arrows, note -/+ and octave -/+, punch, accent, slide, tie, key in (each key or MIDI note sets the picked step and moves on),
        length, step chips, clear, five sliders, the device chips, six factory rolls (Blank Roll, Octave Pump, Walking Tens, Tie and
        Slide, Arc Arpeggio, Slow Bells). Kept in localStorage `filament_roll`. Phones: every target 44 px, no sideways scroll.
  - [ ] Still open: the roll in the project file (`project.js`); several named user rolls and a chain of rolls (song mode); the
        MIDI deck recording the roll's notes, and the master Render WAV including it; the on-screen keys lighting with the roll's
        notes; per-step velocity or probability, if wanted.
- [ ] Theremin mode with the magic eye as tuning indicator - first slice 9 Nov 2026 (nightly). Filament only.
  - [x] The pad: a Theremin section on Filament's panel (a full row on a desktop; on a phone its own Pad tab after Play, the pad
        240 px tall, since the Play tab already shows four sections). Across is
        pitch, up is volume, one finger or the mouse plays one continuous note; a second finger is ignored. The pad starts at
        C1, C2, C3 or C4 (default C3) and spans 1 to 5 octaves (default 3); snap (0 to 100%) pulls the pitch toward the nearest
        note; range (12 to 60 dB, default 36) is how many dB lie between the bottom and the top; the bottom 3% is silence. Lines
        mark each semitone (a C named and bright). The readout names the note, the cents and the level. A press on the pad
        while the mode is off switches it on. Keys on the focused pad: Enter starts and stops, left and right move a semitone
        (Shift: 10 cents), up and down 5% of the level, Escape stops. The settings are the page's (localStorage
        `filament_theremin`), not the patch's, so no patch field and no schema change. One flare on the tubes per press.
  - [x] The voice: the worklet takes `{t:'thm',on,p,a}` and holds one note numbered 128 (outside MIDI, so no key's off ends
        it) at the fractional pitch p, smoothed over about 20 ms whatever the glide knob says, and scales its level by a,
        smoothed over about 12 ms. It is the patch's ordinary voice: envelopes, both filters, unison, the LFOs, bend, the
        wheel and the rack apply; in mono and legato modes it takes the voice like a key. The meter's note list leaves it
        out and posts its sounding pitch and level (`thm`). The rail moving off Filament, Panic, the page letting go of keys
        (blur, tab hidden) and 1939 mode switching on each end it. In 1939 mode the pad rests (the divided masters cannot
        slide). Nothing else in the voice changed: all bench cases are bit-identical with the pad unused.
  - [x] The magic eye as tuning indicator: while the pad is held, the chassis eye reads "tune" and closes as the sounding
        pitch (the meter's, plus bend and tune) reaches the nearest note, wide open at 50 cents off, its shadow leaning to the
        sharp or flat side; let go and it is the level eye again. Smoothed over 40 ms in the frame loop.
  - [ ] Still open: Theremin mode on Cathode (and the other rack devices); the MIDI deck recording the pad (a pitch and level
        lane, not notes); vibrato from the pad (a wobble of the finger already works); a factory patch or two voiced for it
        (a sine with slow attack and a little vibrato is the classic sound); the big tube view showing the eye.
- [ ] Share links (`?p=`), JSON export/import, Surprise me - first slice 10 Nov 2026 (nightly). Rack-wide: every one of the 18 devices.
  - [x] Share links: copy patch link (Rack tab, Mix section, a row under the mix files) makes `/synth/?p=...` for the lit
        device's patch, puts it in a box beside the keys and on the clipboard. The link is the patch: the whole normalized patch
        in a `dxpatch` document, deflated and base64url (`share.js`), nothing on a server. Opening it loads the patch on its own
        device the way a pick from the menu does (the rail moves if it must, the menu reads "* name (edited)", undo goes back),
        then `?p=` comes off the address so a reload keeps what was played since; other parameters on the address stay. Every
        field goes through the device's own normalizer, so an old, damaged or hand-edited link loads in range. Reading is capped
        (65536 characters, 262144 bytes inflated), and `__proto__`, `constructor` and `prototype` keys are dropped. A link that
        cannot be read says so and leaves the lit patch alone. Measured: all 129 factory patches round-trip on all 18 devices;
        the longest link is Filament's, about 1300 characters (the plain form would be about 3400).
  - [x] JSON export/import: download patch saves the same document as `<device>-<patch>.json`; upload patch loads a dxpatch
        file on the device it was made for, or a bare patch on the device it names or the lit one. A project file, a mix file,
        broken JSON or anything over 256 kB is refused with a reason.
  - [x] The round trip test (the 0.3 "done when"): Sh. in the suite.
  - [x] Surprise me on Filament and Cathode - 11 Nov 2026 (nightly). A "surprise me" key in the same row (Rack tab, Mix
        section). `surprise.js` (our own code) draws a patch from a 32-bit seed: an archetype first (Filament: bass, lead, pad,
        keys, pluck; Cathode: bass, lead, sweep), then every field inside that archetype's ranges. The limits are built in:
        tune 0, no fixed-pitch oscillator, the second oscillator only at unison, an octave, a fifth up or a fourth below (each
        within 2 cents of a harmonic), detune 10 cents at most, vibrato under 10 cents, no pitch, resonance or level route in
        the matrix, resonance under the singing point (Filament 0.75, Cathode 0.72), no low pass gate, Filter B, arpeggiator,
        1939 mode, EQ or patch cables, the oscillators always up, a bass an octave down takes no sub. Then the page renders the
        draw offline at out.level -12 dB (a C major chord at full velocity, or one note on Cathode and on a bass, through the
        rack, no master effects) and sets out.level so that chord peaks at -6 dBFS at most and its loudest 100 ms sits at
        -18 dBFS at most; a draw that would need more than +12 dB is drawn again with the next seed (up to 4 tries). It loads
        like a patch link: undo goes back, the menu reads "* name (edited)", save keeps it. Names are an adjective, a noun for
        the archetype and the seed's last four digits ("Copper Haze 4821"). On the other 16 devices the key says it draws for
        Filament and Cathode. No schema change and no factory patch touched. Measured (Su.): 200 seeds a device keep every
        limit and come through the normalizer unchanged; on 12 fitted draws a device the chord peaks at -5.6 dBFS at worst, the
        loudest 100 ms sits at -22 to -16 dBFS, the strongest partials sit within 14 cents of a harmonic, the mono fold is
        2.1 dB at worst; the draw and fit take 0.35 to 2.5 s on this box.
  - [ ] Still open: Surprise me on the other 16 devices (each needs its own limits); a "how wild" setting, if wanted; a
        "keep the rack" option (draw the voice and leave the echo, spring, room and output as they are); what a patch does
        not carry (Mote's loaded sound, Klystron's recording, Lattice's dropped WAV, Orthicon's painted picture; Orthicon keeps
        its own picture link, and Trochotron and Resnatron their own links); a key for the link in the header's patch row, if
        wanted (it would cost the patch name window about 44 px on a phone).
- [x] WAV recording (10 minute cap) - 14 Oct, master bus: live record and offline render, 24-bit 44.1 kHz stereo. (The MIDI file render in slice 2 is a separate button: 48 kHz 16-bit of a take. Still open.)
- [ ] Tube view, faces (walnut, studio rack black, black light), lava lamp module (the tube view landed 4 Nov under the Tube show item; faces and the lava lamp module are still open)
- Tube show (James, 13 Oct note) - first slice 16 Oct, nightly. Exaggerated on purpose. State in `tubeshow.js`,
  drawing in `tubepaint.js` (below the additions line), inputs from the meters and analysers the page already reads.
  - [x] Note flares: V1 at once, V2 20 ms later, the output pair 45 ms later, scaled by velocity, 150 ms decay
  - [x] Red plating: drive and signal level take the plates from grey through cherry red to orange, with a halo and a pool on the chassis
  - [x] Arcs on hard clipping (V1 above 0.7 RMS per voice, or the output peak at 0.95 or more), at most five a second
  - [x] Blue glow on V3 and V4 that follows the output level
  - [x] Visible resonance: Valve 12 V2 brightens with resonance and shimmers from 0.92 up; Cathode V2 follows the low-pass peak and shimmers from 0.88 up
  - [x] Voice lamps: 16 on the chassis, one per sounding voice
  - [x] Tube show section on the Rack tab: off, subtle, full (default full, kept in localStorage); reduced motion keeps steady glows only
  - [x] Flares for the other rack devices that use the chassis (Thyratron, Dekatron, Lattice, Gleam) - 3 Nov 2026 (nightly).
        Each of the four engines counts its note-ons (`ons`) and keeps the last one's velocity (`onv`), and posts both
        with the meter it already sends (Dekatron counts every hit, its own pattern's and the ones it is sent; Gleam
        counts a new touch, a new note or a retrigger, not a finger sliding, and its velocity is the touch's pressure).
        While one of them is lit, the frame loop takes each new count since the last frame as a flare (at most six a
        frame); a device change or a count that goes back only resyncs. The page's keys no longer flare those four
        themselves, so a key is still one flare. So Dekatron's own pattern, Gleam's fingers and a library song routed
        to any of the four now flare the chassis; before, only the page's keys and MIDI did. Nothing in the audio path
        changed: the counters are two numbers on a message that was already posted. Also: a Filament or Cathode note
        the page's keys still hold no longer flares a second time from the meter when the frame loop is starved for
        more than 250 ms (seen once tonight with two suites running on one box). Measured (Tv.): one flare per key and
        per routed note on each of the four, 0.30 against 1.00 on V1 for a routed Thyratron note at 0.3 and 1.0, one
        flare for a sliding Gleam finger, 22 flares for 22 Dekatron hits in 2 s and none after stop (origin/main: 0 flares for the same pattern), none in reduced motion.
  - [x] Big tube view with the show at full size - 4 Nov 2026 (nightly). Opened from a small button at the chassis's
        top right (44 px on a phone), a "tube view" button in the Tube show section, or a double click on a chassis tube.
        A modal over the page: one tube at full size, painted by the same `tubepaint.js` painter from the same tube and
        show state as the chassis, so flares, red plating, arcs, blue glow and the V2 resonance draw at full size at the
        show's own setting. V1 to V4 chips (keys 1 to 4), the seven tube looks (natural, black light, thermal, neon, X-ray,
        night vision, vintage photo), brightness and flicker sliders; the look, brightness and flicker are for this
        picture only (the chassis stays natural) and are kept in localStorage `filament_tubeview`. Zoom 1x to 8x with the
        wheel or a pinch about the pointer, + and -, 0 to fit, double click to jump to 3x and back; drag or arrows to pan.
        Esc or the close button closes it and gives focus back; Tab stays inside it. The computer keyboard and MIDI still
        play. The chassis tubes, VU, eye, goniometer, EQ and filter plot rest while it is open (they are under it); the
        frame loop is unchanged. The backing store is capped at 2.4 million device pixels. Reduced motion: no flicker,
        and a fixed clock and grain, so the X-ray band, the black light dust and the photo looks' grain hold still.
        It is our own code, not the /otr Tube view's; only the painter is the copied /otr block, and its new arguments
        (zoom, pan, quality) and a wider brushed chassis for wide views are below its additions line. Nothing in the
        audio path changed. Not in this slice: the /otr view's Response and Speed knobs and its lava lamp subject.
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

- Done 10 Nov (improvement, robustness, MIDI file import on the deck and Heptode): a file the reader refuses no
  longer throws out of Heptode's file callback, a dense one-channel file loads, and a tempo of 0 is skipped. Why this
  item: R1103-1 still waits on James; CPU: test 9 still moves several points between runs with no voice change
  (ladder24 29.3% on main tonight, 19.7% on this tree; Cathode 23.1% and 17.7%; this tree touches no DSP), so a
  sub-noise gain cannot be shown; test health: main passed (1785 checks) with no flaky check tonight. Measured before, in headless Chrome on
  origin/main `a75a630` (a probe page, files built byte by byte), and in Node with 3000 mutated copies of the 28 .mid
  files in the tree:
  (1) Spreading a list into `Math.min` / `Math.max` overflows the stack past about 124000 items in Chrome (123984 by
  bisection; about 125000 in Node). `songOf` (smf.js) and `scoreFromSMF` (heptode-score.js) took each part's or
  channel's lowest and highest note that way, so a one-track file of 130000 notes (1.04 MB, under the deck's 4 MB
  gate) was refused on the deck with "dense.mid: Maximum call stack size exceeded", and on Heptode threw (200000
  notes too). Heptode's library stress file (122880 notes) loads only because it spreads them over 16 channels of
  7680. Fix: `noteRange()` in smf.js, a loop, used by both. After: the 130000 and 200000 note files load on both
  (Heptode thins them to its 64000 note cap, as it did for any heavy file).
  (2) A tempo meta of 0 microseconds a quarter put every later note at the same instant: the deck read "0:00.0 ·
  Infinity BPM" and Heptode's score bpm was Infinity. `readSMF` now skips a 0 tempo, so the tempo before it holds
  (120 BPM if it is the first). After: the same file reads "0:02.0 · 120 BPM".
  (3) Heptode's `takeBytes` had no catch: a dropped or picked file that is not MIDI (or cut short, or SMPTE timed)
  threw out of the FileReader callback, a page error, with the toast still showing the last file's line ("f · 64000
  notes"). From the code: the throw also skipped `file.value = ''`, so picking the same file again fired no change.
  Now the toast carries the reader's own message ("junk: This is not a Standard MIDI File (no MThd header).") and the
  loaded score stays; the picker is cleared before the read.
  Output unchanged for every file that loaded before (measured): `songOf(readSMF())`, `scoreFromBytes()` and
  `readSMF(.., {wide: true})` on the 28 .mid files in the tree and 3000 mutated copies give the same JSON on main and
  on this tree, 9084 of 9084. No DSP, worklet, normalizer or patch touched, so no patch sounds different; the
  library songs (factory files) read the same. New checks, all four fail on main: "M. a dense one-track file (130000
  notes, about 1 MB) loads", "M. a tempo of 0 in a file is skipped", "H. a dropped file that is not MIDI says so",
  "H. a dense one-channel file (130000 notes) loads".
  Found on the way (measured, not changed): the suite on main tonight ran 1517 s (25.3 min, with two probe pages
  beside it on the 2-core box; this tree's run, alone, 1232 s). Test 9 alone was 221 s of that (80 offline renders: 20 cases, 2 s and 12 s, best of
  2), then M. 121 s, Cf. 65 s, 10. 63 s, Tv. 50 s, Pr. 48 s. The scheduled jobs' 25 minute budget is now about the
  suite's own length; test 9 is INFO only, so it is the first place to look if the suite has to get shorter (fewer
  rounds or shorter renders would change what its lines can resolve, which is already poor; a call, not a fix).
  Also read, not changed (inferred from the code): `readSMF` takes a time signature's denominator as `1 << b`, which
  wraps for an exponent of 31 or more; nothing in the deck or Heptode reads it, the library player uses its own
  reader.

- Done 9 Nov (improvement, test health and robustness, the 8 Nov "Mx. unity click" watch item): a strip going back
  to the wire (unmute, level back to full, pan back to centre, a solo let go) now waits for the gain glide on the
  audio clock. The 200 ms settle in `holdRoute` (mixer.js) was a wall-clock `setTimeout`, while the glide runs on
  `ctx.currentTime`. Measured on origin/main `4b7d9d9` with an instrumented copy of mixer.js, 92 runs of the four
  Mx. cases (two probes beside the full suite on the 2-core box): no failure reproduced (largest 1.03x), but the
  audio clock did fall behind the timer, by up to 99 ms (177 ms of audio when the 200 ms timer fired 276 ms of
  wall time later). Inferred, not proven: the 42x and 37x misses of 8 Nov were the same lag, larger (a 42x step on
  the held A2 sine needs the timer to fire after roughly 10 ms of audio). Proven by forcing it: a mixer on its own
  context with a stereo DC source, the context suspended right after the move back and held 450 ms, then resumed.
  On main the reroute lands with the gain where it stopped and the whole jump plays: 960x the glide's own first
  step (672x for level 0.3 back to 1), every run. Fix: the timer only polls; `settleWait` re-arms for what is left
  until `ctx.currentTime` has passed the glide's start plus 200 ms (`settleAt`, reset on every `apply()` because
  `setP` restarts each glide there), then reroutes. A closed context reroutes at once. With the audio clock in
  step the reroute lands as before; no DSP, normalizer or patch changed, and offline renders never took this path,
  so no patch sounds different. After the fix the forced case reads 1.0x (0.7x for level), held on `gain` or `pan`
  while stopped and on the wire after, 9 of 9 runs (8 probe runs and the suite's). `mixer.route(id)` is a new read-only accessor the check uses.
  New check: "Mx. with the audio clock stopped right after a strip goes back to unity, ..." (fails on main at
  672x to 960x). The old wall-clock Mx. check is kept as it was.
  Why not a higher item: R1103-1 still waits on James. CPU: test 9 on this box still moves 2 to 5 points between runs
  of the same tree (valve12 8 voices 14.8% on main, 16.9% on this tree; sk12 15.3% and 19.3%), so a sub-noise gain
  cannot be shown; the 5 Nov and 3 Nov attempts found the same. This item was the one the 8 Nov run named next.
  Found on the way (inferred from the spec, not a defect today): the pan route splits its input with a
  ChannelSplitter, which reads a mono input as left only, so a mono source panned would lose its right side. Every
  device's node has a stereo output (`outputChannelCount: [2]`, read in all 21 places), so nothing hits it now; a
  future mono device should upmix before the strip.

- Done 8 Nov (improvement, code health and robustness, the 6 Nov "tables narrower than the normalizer" item): every
  number row's ends are now what its device's normalizer keeps. Measured before, in the page on origin/main `2d404d4`,
  by loading each row's default patch with the value set far past each end and at each end: 3 rows let the
  normalizer keep values outside the table. Phantastron and Trochotron `seed` read 0..999999 while the normalizer keeps
  any uint32 (`>>> 0`; Trochotron's random button picks up to 1e9, so about 999 in 1000 random seeds sat outside the
  table, inferred from the code), and Gyrotron `root` read 36..84 (as did its knob) while `normalizeCore` keeps
  24..96. 478 other number rows and all 115 checked choice rows were clean. Fix: the two seed rows read 0..4294967295
  (`SEED_MAX` in phantastron.js and trochotron.js); Gyrotron's `root` row reads 24..96 and the root knob reads that
  row. On the panels (measured): a typed seed of 5000000000 loaded as 705032704 on both devices (the normalizer
  wrapped it); it is now held at 4294967295, and both seed fields carry that max (Trochotron's had none, Phantastron's
  said 999999). A Gyrotron patch with root 30 showed 36 on the knob (and a touch would have moved the root there, inferred); it
  reads 30. No normalizer, worklet or DSP file changed, so no patch sounds different; the root knob's pointer sits at a
  different angle for the same root (its travel now covers 72 semitones, not 48). New checks: "R. table against
  normalizer" (all 18 devices; fails on main with the 3 rows), "R. a typed seed of 5000000000 is held" and "R.
  Gyrotron's root knob spans its table row" (both fail on main).
  Found on the way (measured, not fixed): Mote, Heptode and Orthicon pin the 16 stereo, ens and out number rows and 7
  choice rows they carry (the 6 Nov `SHARED_RANGE` rows) to Filament's defaults, so a host that sets one gets the
  default back; the new check excuses exactly those 69 rows. Inferred from the code and the rack notes: the fields do
  nothing on these devices (the shared output knobs stay on Filament's patch while one of them is lit). Whether the
  table should call them fixed, or the devices should drop them, is a design call, not a bug fix.
  Test health, not changed (inferred from reading the code): the 7 Nov "Ls. the rack transport reaches the worklet"
  miss (transport 1.39 against the worklet's 1.0057) is not a wall-clock read. Both sides take the beat from the same
  context frame count (the posted frame and `currentFrame`), so a slow main thread alone cannot open that gap. Next
  time it fails, the detail line (frame, now, tb) says which side moved.
  Why not a higher item: R1103-1 still waits on James. CPU: the last two attempts measured noise, and tonight's test 9
  lines on main ran beside other browser work on the 2-core box, so they cannot show a change. Test health: main
  passed tonight (1714 checks) and the 7 Nov watch items did not recur.
  Test health, watch, next for this job (measured tonight): "Mx. a strip going back to unity glides there with no
  click" failed 1 of 3 full runs here (unmute read 42.4x the sine's own step; the other three cases 1.0 to 1.18), on a
  tree with no mixer change, and the 4 AM review saw it once (pan back to centre, 37x). Inferred, not proven: the
  mixer's 200 ms settle before it reroutes to the wire (`holdRoute` in mixer.js) is a `setTimeout`, so it counts
  wall-clock time while the glide (`setP`) runs on audio time; if headless Chrome's audio clock falls behind under
  the suite's load, the reroute lands before the gain has reached unity and the jump is the click the check looks
  for. A fix would wait for 200 ms of `ctx.currentTime` since the last move (re-arm the timer for what is left);
  that leaves the normal case unchanged. Measure it first: run the Mx. block repeatedly with the box loaded and log
  the context time elapsed when the timer fires.

- Done 7 Nov (improvement, test health, forced: main failed it): "Eb. 375px: the Osc tab shows the bank's plot" waits
  for the fresh phone page's boot before it starts, and keeps a timeline. Measured: origin/main `f3c2f16` ran 1674 PASS,
  1 FAIL, that check, state `n 1, busy false, read 'response'` after the 15 s wait (the same state the graphics job
  logged twice in four full runs tonight, and the nightly's first run missed the 8 s wait the same way). That state
  means the curve had just landed and no frame had drawn it yet. The plot's first curve on a fresh page is asked for
  while the page is still booting: `__synth.booted()` read false through every passing timeline (14 runs of the
  block outside the full suite, 1 in a full run; all passed, curve 0.15 to 2.7 s after the tap, also with the phone
  page's CPU throttled 10x and with three suites on the 2-core box). A fresh phone page's boot measured 3 to 7 s
  after load with long tasks up to 0.6 s. Not reproduced outside the full suite, so the cause is inferred: the boot's
  main-thread work under the full suite's load. Change (test only, no site code): the check waits for `booted()`
  (30 s, the R. section's cold-boot allowance) before it sets the patch and taps Osc, then waits up to 15 s for the
  same end state as before plus the readout, polled on a 100 ms timer instead of animation frames; a page that never
  boots now fails the check. The detail on a miss carries a timeline (plot count, busy, readout, booted, canvas
  shown, visibility, frame count, every 100 ms) and the page's long tasks over 200 ms, so the next miss says whether
  the curve came late, frames stalled, or the boot ran long. The end assertions are unchanged (nothing weakened).
  Seen under three concurrent suites, not on a normal run: "Ls. the rack transport reaches the worklet" (transport
  beat 1.39 against the worklet's 1.0057; a wall-clock read like the 5 Nov R. clock check). Candidate for this job if
  it shows up in a normal run.
  Why not a higher item: R1103-1 still waits on James. CPU and the parameter-table item (the 6 Nov finding) wait;
  main failing comes first.
- Done 6 Nov (improvement, code health, the 30 Oct parameter ranges item): every number row in every device's parameter
  table now has a real range. Measured before, in Node and in the page, on origin/main `c86f17e`: 51 rows had min = max
  = the default (16 each on Mote and Orthicon, 19 on Heptode): the `stereo.*`, `ens.mix` and `out.*` fields these
  devices carry from Filament's defaults, and Heptode's `loop0`, `loop1` and `live`. Fix: `patches.js` exports
  `SHARED_RANGE` and `SHARED_ENUMS` (copies of Filament's rows under `stereo.`, `ens.` and `out.`), and the three
  devices pass them merged into a copy of their own tables (Orthicon's normalizer clamps every key of its RANGE at the
  top level, so its RANGE stays its own). The same merge gives these devices the 7 choice rows they carry and their
  tables left out (`stereo.pan`, `ens.mode`, `out.tube`, `out.topology`, `out.cab`, `out.room`, `out.eqPreset`):
  41 to 48 rows on Mote, 38 to 45 on Orthicon, 34 to 41 on Heptode. Heptode: `live` is 0..15 (its normalizer's clamp),
  and the loop points (seconds of score time, no ceiling until now) are clamped to 0..86400 s in `normalizeHeptode`
  and on a score load, so the table can state a range. Output (measured): every other device's table is identical to
  main's, Filament's RANGE and ENUMS are unchanged, and the three normalizers give the same JSON as main's on 1218
  inputs (factory, defaults, and 400 seeded random patches each, values to 2 past each end; Heptode loop points to
  600 s). No patch sound changes; a loop point past 24 hours would now be clamped (none of the library songs is
  longer than a few minutes; inferred). New check "R. parameter ranges": every int and float row on all 18 devices
  has min < max around its default, every choice default is one of its choices, and every factory patch value
  (7144 values across 18 devices, Filament, Cathode and Thyratron from their FACTORY lists) lies inside its table;
  it fails on main (51 flat rows).
  Found on the way (measured, not fixed): three tables are narrower than what the normalizer keeps. Phantastron and
  Trochotron `seed` read 0..999999 but the normalizer keeps any whole number up to 2^32 - 1 (Phantastron's seed
  field says max 999999 but a typed value is not clamped); Gyrotron `root` reads 36..84 but the normalizer keeps 24..96.
  Clamping in the normalizers would change user patches outside the table (a seed is the sound), so the fix is
  likely the table, after checking each control. Done 8 Nov, see above.
  Why not a higher item: R1103-1 still waits on James (schema and storage). CPU: the last two CPU attempts (5 Nov,
  1939 voice; 3 Nov note) measured noise or had no bit-exact hot spot left, and tonight's test 9 lines on main sit
  in the usual range (below). Test health: nothing failed or flaked on main tonight.
- Done 5 Nov (improvement, test health): "R. play emits clock events a device can subscribe to" reads the transport against
  the AudioContext clock, not the wall clock. It failed on main in the 5 Nov nightly run (beat 1.84 after a nominal
  180 ms wait; that run read it as load). The beat is the context time since play over the beat length, so a fixed
  `setTimeout(180)` on a busy main thread let the beat run past the 0.7 bound. Now the check polls (20 ms, 5 s cap)
  until two pulses have come and a tenth of a beat has passed, then checks the beat against the context time elapsed
  since play at the tempo (within 0.01 beat), that the pulses are consecutive ticks at beat tick/24, each stamped
  that many beats after the first (within 1e-9 s), and that the first is stamped at play (within 10 ms). "R. stop
  holds the beat" also checks the held beat is at least the beat read while playing. Measured in a separate script
  on this tree (fresh 1366 px page, 5 runs each): idle, the old check passed 4 of 5 (one read 0.749 at 180 ms), the
  new one 5 of 5; with an 800 ms long task on the main thread, old 0 of 5 (beat 1.68 to 1.71), new 5 of 5 (errors
  read 0 in every run). Stronger, measured by mutating transport.js through a route: the beat at 1.1x the tempo,
  pulses stamped 1.1x apart, and one pulse dropped each fail the new check (beat error 0.030, stamp error 4.2 ms,
  tick gap) and all three passed the old one. No product code changed.
  Also tonight, tooling: `scripts/bench_filament_voice.mjs` has three more 1939 mode cases for the equivalence check
  (`era39sq` the plain square on two tabs with no vibrato and the pedal; `era39steal` 4 voices stealing, so the kill
  fade, notes up to MIDI 115, velocity, bend, the wheel, pressure; `era39chg` patch changes mid-note: tabs in and
  out, tone, shape, the mode off and on). All four 1939 cases hash equal to origin/main; no subnormals in any.
  CPU, 1939 mode (measured tonight, tried and not shipped): `render39` keeps the five resonators' states in a
  Float64Array and calls `e39sq` four times a 2x sample, each calling `e39blep` twice. Moving the states into locals
  for the block, hoisting the per-block reads, and calling `e39blep` only within a step of an edge left the output
  bit-identical (Node bench, 4 cases; headless Chrome, the worklet alone in an OfflineAudioContext with Math.random
  seeded, hashes equal). Node read -10 to -14% on era39 at 20 s; Chrome, the voice alone, steady cost of a 40 s
  render minus 2 s, best of 3, 6 alternating rounds: 6.74% before, 6.95% after (+3.1%, noise; an unchanged case,
  valve12, moved +5.3% the same way), so it was reverted (inferred: Chrome's compiler already keeps those in
  registers and inlines the calls). The voice alone read about a quarter of test 9's 1939 line (27.3% on main
  tonight, rack included; two different measurements, so a rough share); the rest is the rack stages all lines share. Read the Node bench's CPU figures with the 27 Oct note in mind.
  Watch (not reproduced): "Rd. a value set with no input event shows too" also failed in the 5 Nov nightly run under
  load ("an empty read 120 ms after a click"). The paths it reads are synchronous (read: the chip's click handler
  calls `sync()`, which sets each slider's value, and `fread.js` paints on the value setter), so the fixed waits
  are not the cause. The Rd. block run alone 6 times (CPU throttled 6x, and 12x with two busy loops on the 2-core
  box) passed every time. If it fails again, keep the failing detail line.
- Done 4 Nov (improvement, test health, forced: main failed it; a master bus bug under it): (1) origin/main `3dae34f`
  ran 1555 PASS, 1 FAIL: "M. master bus: Panic empties the master delay" read the delay tail at -50.1 dBFS against
  a bound of -50 (a check the 4 AM review added an hour before). That check alone, repeated on main: 3 of 15 rounds
  failed (tail -69.0, -59.9, -64.9). Two causes, measured with 50 ms envelopes of the whole bus. (a) A worklet bug:
  `clearDelay` and `clearReverb` set `fadeN` to 0, so an effect switched on inside Panic's 10 ms fade (or every
  effect switched off, which froze the fade under bypass, then one switched on) stopped the fade part way and left
  the return gain `wg` there until the next Panic. Each round of the check ends in `panic()` then `setMaster(m0)`;
  when 3 render blocks ran between the two messages, `wg` stuck at 57/441 and the next round's repeats came back
  18 dB under the dry note (3 of 6 rounds in one run). Fix (master.worklet.js): the clears no longer touch the fade,
  so it runs to its end, empties both lines and puts `wg` back to 1; a fade cut short by a full bypass ends at once
  (nothing of either effect is heard while bypassed). Measured block by block (the worklet's class with a stand-in
  port, 44.1 kHz): the old code left `wg` at 0.42 (first repeat 0.210 against 0.500 from a fresh bus) and at 0.71
  in the reverb case; the new code is sample for sample a fresh bus. Who meets it live (inferred from the code):
  any master change within 10 ms of a Panic; `setDevice` sends a Panic on every rail switch, and a project load
  switches the device and then sets the master. Sound: only the delay and reverb returns after such a Panic change
  (they no longer stay quieter); no patch sounds different. (b) Noise in the check itself: it read the left channel
  only, on a patch that pans its voices alternately (6 to 9 dB note to note), and two detuned saws in a 60 ms blip
  add or cancel by their free-running phases. It now reads both channels' power with one oscillator and no drift:
  tail -44.2 to -45.7 dBFS in 10 runs (before: -38 to -48 when not stuck, -60 to -69 when stuck). Bounds unchanged.
  Two new M. checks (the two fade sequences, run block by block); both fail on main (difference 0.29 and 0.088).
  (2) The goniometer watch item (30 Oct), done the same night because it is the same kind of fault. Measured: the
  scale moves 8% a drawn frame toward 0.42 of the canvas over the peak, and a quiet stretch (a release tail, the
  strings' slow attack) sends it far above that, so at the fixed 1.2 s the cloud was drawn about 6x too wide
  (fit 5.8 to 7.5, 100 to 202 lit pixels in 8 fresh pages after a loud chord, CPU at 1x and 4x) against 600 to 830
  once it has come in; main's suite tonight read 79 against the bound of 50. A test hook outside the copied
  `drawGonio` (`__synth.gonio()`: drawn frames and `fit`, the drawn scale over its target) lets the check wait,
  after the same 1.2 s, for at least 10 drawn frames and a fit of 0.5 to 2 (10 s cap; logged as INFO "S. goniometer
  settle"); the assertion is unchanged. Nothing drawn changes.
- Done 3 Nov (improvement, load time and memory, the room's impulse response): an engine whose patch has the room
  off no longer builds the room. The copied `setRoom` (rack.js, /otr block) made a new IR and ConvolverNode on every
  `apply`, room on or off: a seeded noise tail of up to 6.5 s a channel and the convolver's setup, on the main thread,
  for a node `route()` leaves unplugged. `makeSynthChain` now wraps `setRoom` and `route` (additions, the copied block is
  untouched): with the room off it sets only the pre-delay and the dry and wet gains and marks the IR due; the IR is
  built when the room goes in. The IR is seeded by the room id and shaped by decay and tone only, so one built later is
  the one the old code built. Measured, headless Chrome 153, `C.apply` alone on a fresh chain, median of 4 rounds of
  25: room off at the default fields (studio, 0.9 s) 15.5 to 0.75 ms; off at a 3.4 s hall 54.4 to 0.70 ms; off at a
  6 s hall 78.1 to 0.70 ms; room on, studio 15.4 to 16.2 ms and 6 s hall 80.8 to 77.8 ms (unchanged, noise). Who
  pays it (inferred from the code): every offline render of a room-off patch (the suite's `patch()` and `cpatch()`,
  test 9's cases, 3 Filament factory patches), the live engine on such a patch, and every room knob step taken while
  the room is off (each one rebuilt the IR). A whole 0.25 s render showed no difference (room off, median of 15:
  327 to 336 ms; this box moves 80 ms render to render), and test 9 subtracts fixed costs, so its lines cannot show
  it. Memory (inferred, not measured): an off room no longer holds a stereo IR of up to 2.5 MB and the convolver's
  own copy of it. Output (measured): a fixed signal through the chain, 6 cases (room on at 0.9 s and 6 s, off, off
  then on, room, decay and tone changed while off then on, on then off with a new decay then on), hashes equal old
  and new and repeatable. Two new checks (R. room off builds no IR until it goes in; switched on later is sample for
  sample a room on from the start, also after changes made while off); the first fails on origin/main.
  Why not a higher item: R1103-1 (broken, Lattice WAV tables lost on reload) needs a patch schema and storage call
  and the review left it for James. CPU: test 9 is all Filament; the voice has no bit-exact hot spot left (27 Oct
  profile), and the rack stages test 9 routes through (the 4x tube shaper, its filters, the sag and limiter
  compressors, the clipper, the ceiling) all shape the sound; the one exact-zero branch left, the mono check's four
  nodes at gain 0, looks too small to measure (inferred). Test health: the goniometer watch item has not failed again.
  Still open: the 30 Oct parameter ranges item below.
- Done 2 Nov (improvement, CPU, the spring reverb tank): the same arithmetic, scheduled better, and no subnormals. Test
  9's newest line, the spring (`b843849`, 2 Nov nightly), was the one unprofiled DSP in it: it read 1.8 to 4.5 points
  over Valve 12 alone in the 2 Nov nightly and check runs. Inside each sample the tank ran its four 24-section allpass chains
  (AP1 and AP2 on each spring) one after another, each a serial chain of multiply-adds, although none of the four
  reads anything another writes in that sample (every delay-line read is at least 2 samples old); `process()` now
  runs the four chains interleaved in one loop and keeps the per-sample state in locals, so the CPU overlaps them.
  Same operations in the same order per chain, every Float32Array store rounding where it did. Second, with the
  input silent while the tank rings (a released chord, up to 14 s at decay 6), the input high-pass state shrinks
  by 0.992 a sample and is a subnormal double from about 1.9 s on, stuck near 5e-324 (measured in Node: 1564 of
  7500 blocks in a 20 s render of the bench's input); it now stops at exactly 0 below `SPR_FLOOR` (1e-150) at the end
  of a block. That cannot change a sample: the driver adds 0.15 to u = x gd, and any |u| under about 1e-17 already
  gave exactly 0. Measured, output: bit-identical against origin/main in Node (`scripts/bench_spring.mjs`, new, 5 cases
  at 20 s and 40 s, and `moves` and `rel6` at 22.05, 44.1 and 96 kHz) and in headless Chrome (the tank alone in an
  OfflineAudioContext, 4 cases at 20 s, hashes equal). Measured, CPU, headless Chrome 153, the tank alone, steady cost
  (22 s render minus 2 s, best of 2, median of 6 alternating rounds): test 9's settings, chord held, 2.80 to 1.86%
  of real time (-34%); a 1 s chord left to ring, 1.85 to 1.18% (-36%). The interleave alone (4 rounds): 2.89 to
  1.95% and 1.93 to 1.48%, so the floor is the rest of the release case. Rack included (test 9's spring line in its
  own page, median of 3, noisy box): held 84.3 to 73.0%, released after 1 s 33.7 to 26.9%. A full rack render in
  Chrome is not repeatable sample for sample (two renders of the old tree differ), so equality was proven on the tank
  alone. One new check (Sp. silence after a note: the input stage stops at 0), read through a new test hook `ih` on the
  tank's stat reply, 3.5 s into a full offline rack render of one 0.3 s note at decay 6: the old tank with only the
  hook added held 3.1e-322 there (subnormal, measured twice), the new one 0.
  Not done: `Math.tanh` in the driver is about 0.5 points of the Node figure; a cheaper curve would change the sound.
- Done 31 Oct (improvement, test health, forced: main failed it): two wall-clock checks made to wait for the state
  they assert on. (1) "Sc. scrolled part way, both edges show a cue" failed on origin/main `fcd38ce` tonight (1422
  PASS, 1 FAIL): the left cue read opacity 0.95, not 1. Each Sc. step waited a fixed 250 ms after a scroll, and the cue
  shows only after the scroll event sets `data-more` and a 160 ms opacity transition runs, so a late scroll event leaves
  it mid-fade. Measured in a separate script, fresh 375 px phone pages, the old step against the new one on the same
  page: no throttle 0 of 5 fail either way; CPU throttled 4x the old step failed 2 of 5 (opacity 0.98 and 0.997), the
  new 0 of 5; 6x the old failed 4 of 10 (down to 0.71), the new 0 of 10. Each Sc. step now waits for `data-more` to
  reach the value it expects (3 s cap) and then for every CSS transition on the two strips to finish (2 s cap), then
  asserts the same things; the waits ran 25 to 189 ms in tonight's suite (140 to 300 ms throttled) and are logged (INFO "Sc. settle"). (2) "Tv. the flare scales
  with velocity" failed once in the 31 Oct graphics run (sampled peak 0.00 while the show had recorded the flare). The
  call held the note a fixed 260 ms and sampled the flare from outside, so a frame loop that had not run by then left
  nothing to see. The show now also keeps, for the test hook only, the show clock at each tube's last flare (`firedAt`)
  and the highest flare `showFor()` handed the painter since then (`drawn`), plus its clock `t`; nothing drawn changes.
  TV_PEAK holds the notes for the same time and then, only if the frame loop is behind, until the tubes it needs have
  fired and been drawn and the show clock has run 0.12 s past V1's flare (4 s cap). The four checks that required a
  sampled peak above 0 (note-on, velocity, subtle, Cathode) now require `drawn` above 0; the decay check compares the
  end flare with `drawn` and requires the 0.12 s; the reduced motion check also requires that V1 never fired and nothing
  was drawn. Measured with the frame loop slowed to one frame per 300 ms, 8 rounds: old conditions failed velocity 3,
  decay 8, note-on 1; new 0, 0, 0 (the call waited about 0.8 s). Unslowed, 8 rounds: 0 failures either way, the call
  260 ms before and 264 to 291 ms now. Sampled peaks stay in the check names. Still open: the goniometer watch item
  below, not touched tonight.
- Done 4 Nov, see above. Test health, watch (measured 30 Oct): "S. goniometer draws the stereo image and the correlation meter reads it" failed
  once (44 lit pixels, bound 50; main 147 and the rerun 105 the same night). It counts bright pixels in whatever the frame
  loop drew last, after a fixed 1.2 s of live audio, and `GON.scale` adapts 8% a frame from wherever the last live
  signal left it (inferred from `drawGonio`), so a slow frame loop can leave the cloud squeezed. If it fails again,
  read the count after the scale settles rather than at a fixed time.
- Found 30 Oct (improvement; done 6 Nov, see above): some parameter table rows carry no range, so min and max both equal the
  default. Measured in Node from each device's table: on Mote, Orthicon and Heptode every `stereo.*`, `ens.mix` and `out.*`
  row (for example `out.drive` 3..3, `out.eqBands` 10..10), and Heptode's `live` (0..0, a channel 0 to 15), `loop0` and
  `loop1`. Nothing in the repo reads those ranges today (inferred: `engine.js` only hands the table out). A fix is ranges
  for those paths (the shared output stage's from `patches.js` RANGE), checked per device.
- Done 30 Oct (improvement, code health): parameter types are an explicit list per device. `parameterTable()` in
  `device.js` took `int` from the numbers (a whole default and ends, span 32 or less); it now takes a fourth argument,
  the paths whose value is always whole, and every other number is `float`. Each list comes from the device's own code:
  a normalizer that rounds or truncates the value, or a control that rounds it (Filament and Cathode knobs with
  `round: true`, Thyratron knobs that step by 1, Resnatron's own `int` spec rows). Measured in Node, every device's table
  before and after, 18 devices: 106 rows changed type and nothing else changed (ids, defaults, ranges, choices the
  same); `int` rows 121 to 49. Int to float (wrong before): 41 on Filament (the 8 matrix amounts, `filtB.env`, `filtB.bal`,
  `mw.cut`, `at.cut`, as the 29 Oct note said, and also `osc2.fm`, `sub.level`, `noise.level`, the drive, bias and sag
  knobs, LFO depths and delays, `voice.glide` and the output stage's 0..10 knobs), 22 on Cathode, 9 on Thyratron
  (`osc1.tune` and `osc3.tune` step by 0.01), 10 on Resnatron (`vco1.fine`, `vca.level`, the mixer), and Additron's
  morph, perc and vib, Pentagrid's air, Phantastron's loop, Heptode's morph, Trochotron's cy. Float to int (wrong
  before, all rounded by their normalizers): Pentagrid `wpm` and `seed`, the seeds of Geissler, Gyrotron, Phantastron
  and Trochotron, Geissler `cap`, `season`, `root`, `tempo`, Gyrotron `root`, Orthicon `root`, Thyratron `tune`,
  Heptode `live`, and `out.eqBands` on Heptode, Mote and Orthicon. Nothing in the repo rounds by this type (Resnatron's
  panel reads its own spec), so no knob, patch or sound changes. One new check (R. parameter tables: spot types on 8
  devices, and every `int` row whole at the default and both ends); the Gyrotron and Trochotron adapter checks asserted
  `seed` as float and now assert int.
- Done 28 Oct (improvement, test health): test 9's CPU lines are now a steady cost read in a page of their own. Each
  line is the wall time of a 12 s offline render minus a 2 s one (each the faster of two) over the 10 s between, so the
  fixed cost of a render drops out, measured in a new context with both pages' live audio suspended and one throwaway
  render first; the whole 12 s figure is logged beside it. The Cathode line moved from section C into the same block.
  The EQ line replaced `out` with only the EQ fields, so the normalizer put the room (default on) and the default output
  stage back and the line timed them too (inferred from `patches.js`); it now adds the EQ to the case's own output
  stage. One new check (the CPU page has no page errors). INFO lines still; nothing in test 9 can fail the suite.
  Measured tonight, headless Chrome 153 on the 2-core box, no voice code changed:
  the old 6 s whole-render figure in a fresh browser, 3 rounds: Ladder 24 21.8 to 56.0% (56.0 was the page's first
  render), Valve 12 18.8 to 21.0%, low pass gate 16.9 to 25.4%, Cathode 14.7 to 20.6%. The new figure, same setup, 3
  rounds: Ladder 24 13.4 to 16.1%, Valve 12 12.7 to 16.3%, Sallen-Key 12 12.4 to 14.4%, low pass gate 11.0 to 11.7%,
  split 15.7 to 17.1%, 16 voices 22.1 to 26.0%, Cathode 11.8 to 13.1%. A second page left with its live audio running
  (devices woken, a chord played and released) raised the figure: Valve 12 25.0 and 32.7% against 15.1 and 23.9% with
  that page suspended, Cathode 22.3 and 24.7% against 18.4 and 14.3%. Freezing that page (CDP lifecycle state) as well
  read 19.9 and 21.2%, 15.7 and 11.2%: not clearly better than suspending, so not used. In the suite on main
  `30005a4` (old method) tonight: Cathode 13.8%, Ladder 24 28.3%, Valve 12 19.4%, split 28.5%, 16 voices 33.6%, EQ
  28.5% (the 12:28 AM nightly read 25.7, 48.6, 43.7, 64.7, 71.3 and 51.2% on the same audio code). In the suite on the
  new tree: Cathode 20.3%, Ladder 24 20.8%, Valve 12 17.7%, split 23.5%, 16 voices 29.2%, EQ 25.6%. Not solved:
  inside the suite the new figure still reads above a separate browser (Valve 12 17.7% against 12.7 to 16.3%,
  Cathode 20.3% against 11.8 to 13.1%); cause not found (inference: the main page's frame loop and timers share the
  two cores). Cost: test 9 now renders about 390 s of audio where it rendered 84 s, about 1.5 min more wall time
  (estimated from the per-render figures); suite wall time about 10 min on main and 12 min 54 s on the new tree, one
  run each.
- Done 27 Oct (improvement, test health): the tube show checks that still read a wall-clock sample. "Tv. Cathode: a
  note flares its tubes" (failed 1 of 3 full runs on 26 Oct and once in the 26 Oct review) and "Tv. subtle" asserted on
  V1's flare as sampled from outside every 8 ms, so a frame loop that runs late shows the flare already decayed. Measured
  tonight in a standalone page with the suite's own TV_PEAK, Plate Screamer, one note at velocity 0.9: with no throttle
  the sampled peak is 0.64 to 0.72 (the flare is 0.9) and the first sample above 0.05 lands 25 to 47 ms after the note;
  with the CPU throttled 8x the sampled peak was 0.24 to 0.52 and the old condition (above 0.3) failed 1 of 10 runs,
  while the show's own record said V1 took 0.9 every time (0.8 once, a second flare from the meter). The show now also
  counts the flares each tube has taken (`fires` in `__synth.tubeShow()`, test hook only, nothing drawn changes), and
  TV_PEAK returns the state at its start, so a check can tell a flare from this note from one an earlier note left at
  the same velocity (the Cathode note is 0.9, the same as the last Filament note before it). The Cathode and subtle
  checks now assert that V1 fired during the call and took more than 0.5, with the sampled peak still in the name and
  required above 0; the first two Filament flare checks also require that a flare fired during their call. Same
  conditions on what the show did; the 8x run above fails the new conditions 0 of 10. The flare decay check still
  compares against the sampled peak (not seen failing, left alone).
- CPU, Cathode (measured 27 Oct, tried and not shipped): the Node bench's heap sampler shows Cathode allocating 3 to 6
  MB/s in steady state on every c_ case, all of it boxed doubles at the four `exp2()` calls (argument and return, the
  call not inlined into `render`). Passing x and 2^x through a Float64Array cut that to 0.14 MB/s with the output
  identical, but Node CPU did not move (within noise on all 8 cases at 20 s) and Chrome does not have the problem: the
  same processor run on a Chrome 153 page's main thread allocates 19 KB/s at `exp2` (inlined there) and 1.2 MB/s at
  `Math.random` (the noise source, every 2x sample), and Chrome timing old against new was within noise. Reverted. The
  Node bench overstates call overhead in large functions; read its allocation figures with that in mind.
- Test health, test 9 (measured 27 Oct; done 28 Oct, see above): inside the suite, test 9's later lines can read up to twice what
  the same patches cost in a fresh page, and how much varies run to run. Suite on origin/main `a53fa42` tonight:
  Valve 12 19.9%, filter B serial 42.3%, parallel 44.7%, split 57.9%, 16 voices with ensemble 63.5%, EQ 31 bands 50.8%;
  the build run an hour later (no voice code changed) read 22.5, 34.9, 31.2, 29.0, 34.6 and 32.3%. The same patches in a fresh page,
  same browser, two rounds, 6 s render: Valve 12 18.8 to 25.4%, serial 25.9 to 26.4%, split 25.7 to 28.0%, 16 voices
  26.8 to 31.6%, EQ 31.8 to 36.0%; marginal cost (12 s minus 2 s) 14.2 to 14.5%, 17.7 to 19.9%, 16.4 to 19.4%, 26.5 to
  29.0%, 23.6 to 24.3%. In the first run the gap grew through the case order. Cause not found (candidates: worklet scopes or offline
  contexts the suite page has not released, the 18 devices' live nodes); running test 9 in its own page and logging
  the marginal cost would make the lines comparable night to night.
- CPU, Filament (measured 27 Oct, line profile in the Node bench, Valve 12 at 20 s): no single bit-exact hot spot left.
  The two oscillator pitch `Math.pow` calls per control tick are 6 to 8% of the worklet on every model (drift moves the
  exponent every tick, so the memo never hits); the V1 tube table read 6%, its `y / G1 * mk1` 3%; the output decimator
  5%. A cheaper pitch power changes low bits, the same tolerance question as the items below.
- Tooling note (27 Oct): `/opt/pw-browsers/chromium-1194` is not on the build box any more; the suite falls back to
  `/opt/google/chrome/chrome` (Chrome for Testing 153.0.8010.12), which is what tonight's numbers come from.
- Done 26 Oct (improvement, CPU, Filament voice): envelopes and the output DC blocker no longer sink into subnormal
  numbers. Found with a line profile of test 9's Valve 12 case in the Node bench: the filter envelope's sustain line
  alone was 7% of the worklet's samples. Test 9's patch has a filter sustain of 0, so once the decay hands over
  (at 1e-4) the sustain stage shrinks `fe` by 0.99 a sample, and after about 1.5 s it is below the smallest normal
  double (2.2e-308) and stays there, stuck at a few times 5e-324. Arithmetic on subnormals is slow, and measured
  tonight in a headless Chrome AudioWorklet (offline and live) nothing flushes them: a loop on 1e-310 ran 19x slower
  than the same loop on 1e-200. A new bench mode lists every state field that ends a block subnormal: on origin/main
  every 8-voice case has `fe` there for 73% of a 6 s render; an amp sustain of 0 (Hollow Pluck, Glass Music Box,
  Eerie Bells) adds `ae`, the cutoff memo, both decimators and, after about 14 s, the output DC blocker.
  `voice.worklet.js` now sets the two envelopes to exactly 0 below `ENV_FLOOR` (1e-150) in sustain and the filter
  envelope's release, and the output DC blocker at the end of a block. 1e-150 is below float32's smallest value, so
  nothing at that level could reach the output. Output (measured, Node bench, seeded, all 27 cases at 6 s and at
  40 s): equal sample for sample against origin/main. At 40 s two cases (lpgmodes, pluck) had samples that were -0
  before and +0 now, the same value; the bench hash now counts -0 and +0 as one. CPU, Node bench, 40 s steady
  state, one round, old to new: Ladder 24 13.3 to 9.9%, Valve 12 13.3 to 9.7%, SVF 12 11.7 to 9.2%, low pass gate
  13.1 to 9.0%, 16 voices 24.1 to 18.1%, LFOs 17.9 to 16.3%, low pass gate held at sustain 0 44.5 to 10.1%, plucks
  at sustain 0 with steals 32.9 to 6.9%; the unchanged Cathode cases moved -15 to +8% (that is the noise). Headless
  Chrome, rack included, marginal cost (12 s render minus 2 s), median of 4, old to new: Valve 12 26.4 to 18.6%,
  Ladder 24 26.6 to 18.5%, low pass gate 23.5 to 15.0%, a held 8-note pluck at sustain 0 97.7 to 23.3% (on this
  2-core box the old code could not keep up with a held chord on those patches). Not changed (inferred): voice
  stealing picks the quietest voice by `ae`; two held voices both below 1e-150 now compare equal (first slot wins)
  where before the smaller subnormal won. Both are silent, so which one is cut is inaudible.
- Test health (measured 26 Oct; done 27 Oct, see above): "Tv. Cathode: a note flares its tubes" failed 1 of 3 full runs
  (sampled V1 peak 0.296 against 0.3, first frame 90 ms after the note, while `fired.v1` recorded 0.9; the other two
  runs 0.46 and a pass). It is the wall-clock sampling the 21 Oct fix removed from the Filament flare checks. The same
  fix fits (assert on `fired` and `firedLag`), but `fired` is shared with the Filament notes played just before, so
  TV_PEAK should record it at the start and require it to change.
- Robustness, Cathode (measured 26 Oct, not fixed): with a still input (Filter Kick after it decays) Cathode's first
  DC blocker `dcy1` sinks into subnormals and the high-pass filter reads it every sample (`hpS`, `dcy1` subnormal
  in 30% of a 40 s render). Setting it to 0 the same way is not output neutral: the "whisper of noise" seed fires
  when `hpS[D_S1]` is exactly 0 at the end of a block, and a subnormal input keeps it from ever being 0, so the
  seed never fires there today; at 0 it fires and the output changes (Filter Kick at 6 s, measured). Whether the
  seed should fire there is a sound question, so it waits. Other devices' worklets were not scanned
  (`--subnormals` covers Filament and Cathode only); most snap their envelopes at a threshold already (read).
- Done 26 Oct (nightly, a broken finding): Pentagrid could go silent until reload. "M. pentagrid: recorded ... matches
  live" and the next Pentagrid check both read silence (output 0.000) in 2 of 5 full suite runs that night, one of them
  on a clean origin/main `37175c4`. A log of what the page sent Pentagrid (new test hook `__synth.pentaSent()`) showed
  it active, with the note held and its meter counting a voice, but its output level 0. Cause, from the code and then
  reproduced in Node every time: the noise blanker's window (1 to 4 ms of zeros after a crackle spike) counted down only
  inside the band-noise code, which air 0 skips; so if the air went off while a window was open (the suite moves from
  Pentagrid's own patch, crackle and blanker on, to an air-0 tone), the window never closed and every sample after it
  was zeroed, notes included. Fixed in `pentagrid-dsp.js`: with the air off the window runs down on its own. With the air
  on nothing changed (the new line only runs when air is off). New check Pg. "a blanker window open when the air goes
  off closes", which fails on the old code (note RMS 3e-28) and passes on the new (0.22). The two failing checks now
  print that log in their detail.
- Done 25 Oct (CPU, the rack): idle rack stages are unplugged. Measured first, in headless Chrome, as
  the marginal cost of a render (a 22 s render minus a 2 s one, so the fixed setup cost drops out):
  Cathode Plate Screamer, one note, is 17.5% of real time in steady state; with the room off 10%;
  without the rack 3.5%; without the rack and the master bus 3%. So in Chrome the shared rack, not the
  voice, is most of the steady cost, and every device pays it. Two parts of it ran with their output
  multiplied by exactly 0: the ensemble's wet side when the ensemble is off or at mix 0 (7 LFOs, 5
  swept delay lines, 3 lowpasses; off in 28 of 44 factory patches and on every device but Filament
  and Cathode), and the push-pull B side's 4x oversampled shaper on a single-ended patch (16 of 44).
  `rack.js` now unplugs their feed while they are not wanted (offline at once; live after the wet
  gain's fade, 0.3 s, and the B side's, 0.2 s) and plugs it back before a fade-in, so the browser
  skips them. Output: a fixed signal through the rack hashes the same on the old and new tree in all 6
  repeatable cases (ensemble off, on, mix 0; push-pull and single-ended; measured), and the suite now checks unplugged against replugged
  sample for sample. Rack-only CPU, fixed input, renderer process CPU time, median of 8, old to new:
  Filament default 10.75 to 9.05%, Plate Screamer 13.35 to 11.80%, Plate Screamer single-ended 12.70
  to 9.80%, a device with no ensemble (Dekatron's rack settings) 10.40 to 9.30%. Runs vary by about
  1.5 points, so read these as 1 to 3 points, not to the decimal. Not bit-for-bit the same, by
  design, and inferred inaudible: live, an ensemble switched back on starts from empty delay lines
  (they fill in 6 ms while the wet fades in from 0) and its LFOs resume where they paused.
- CPU, the rack (measured 25 Oct, as above): the room convolver is about 7 points of Plate Screamer's
  17.5% and is on in 41 of 44 factory patches. Any cheaper reverb changes the sound, so it is a call
  for James. Building it costs 30 to 75 ms of main thread per engine (the IR and the convolver's own
  setup), which a live patch change with a new room also pays Since 3 Nov an engine with the room off does not
  build it (see above); with the room on it still does.
- Test health, test 9 (measured 25 Oct; done 28 Oct, see above): each offline render has a fixed cost of about 0.25 to 0.45 s
  in headless Chrome (a 0.25 s render takes 250 to 650 ms): a fresh worklet scope (addModule of an
  empty module alone takes 40 to 130 ms), the room's IR and convolver, and the worklet's JIT warm-up.
  Test 9's 6 s renders carry all of it, so its percentages overstate steady CPU and blur changes in the
  voice. Reading the marginal cost (two lengths, take the difference) would fix that.
- CPU tooling, correction (measured 25 Oct): the 24 Oct note that "something in Cathode allocates per
  block" is JIT warm-up, not a steady allocation. In the Node bench `render` allocates 245 MB in the
  first 6 s and 25 MB in the next 6; c_plate is 16.4% of real time over 6 s and 4.7% over 30 s
  (steady about 2.4%). `render` deoptimizes 6 times on the way (new event paths, and a map change as
  about 20 fields go from small integer to double). The bench's 6 s cases mostly time warm-up for
  Cathode; use 20 s or more for steady-state A/B work.
- Test health (measured 25 Oct): with the ensemble in strings mode, a fixed signal through the rack
  gives a different output on some runs in headless Chrome (3 hashes in 4 runs on the old tree, mode I
  is stable). Cause not found; worth a look before any check relies on a strings render being
  repeatable.

- Done 24 Oct (test health, forced: main failed it): two wall-clock checks. The suite on origin/main
  `a257110` failed 2 checks on both runs tonight, once beside a Node bench and once with nothing else
  running (this box ran slow: test 9's Ladder 24 at 48% against 25 to 37% on most nights).
  "Tv. the four tubes with the show draw in under 12 ms a frame" read 15.8 and 12.2 ms. Cause, measured
  in a separate script: the figure is a smoothed wall-clock time and was read straight after two other
  pages loaded the rack and rendered on the same 2 cores; read there it gave 5.9 to 11.1 ms on a page
  that draws a held five-note chord in 5.2 ms, stable, once they close. The check now reads it at the
  end of a 1.5 s chord its own page plays (flares, heat and lamps running) with the other contexts
  closed: 2.79 ms in the suite. Same 12 ms limit; the show is busier while measured than before (it
  was read idle). "G. hold, the generator and a finger combine" read 0 voices and no generator. Cause,
  measured: the rack hands a patch to Gleam on the next animation frame and the generator takes its
  first point a frame later, 43 to 137 ms and 66 to 398 ms after `setPatch` (5 runs), and the check
  waited a fixed 100 ms. It now waits for the patch and the generator point (5 s cap), then asserts the
  same things. No product code changed.
- Done 24 Oct (CPU tooling): `scripts/bench_filament_voice.mjs` blamed the wrong code. It ran the
  worklet as a top-level script in a Node vm context, whose global object sits behind an interceptor,
  so every read of a top-level function or const (`tdx`, `DIO_B`, `exp2`) and of `Math` was a slow
  lookup V8 could not inline. Chrome's worklet scope has no interceptor. Measured, filter call alone:
  Diode 18 650 to 900 ns and Sallen-Key 12 880 to 970 ns against Ladder 24's 80 to 130 ns (Ladder
  reads no globals); about 80 to 135 ns for all four once wrapped. The bench now runs the worklet
  inside a function with the builtins passed in, and the seeded random takes `imul` the same way.
  Output hash identical on all 22 cases. Bench CPU on a quiet box, old to new: Ladder 24 40.5 to 24.5%,
  Valve 12 61.4 to 23.4%, Diode 18 72.9 to 24.7%, Sallen-Key 12 80.7 to 24.1%, Poly 24 43.9 to 33.8%,
  LFO case 169 to 34%, Plate Screamer 41.3 to 14.6%. Test 9 in Chrome on the same box: 49.8, 44.4,
  42.1, 39.0, 47.3%, so the models now rank about as Chrome ranks them (old bench: Diode and Sallen-Key
  at 1.8x and 2x Ladder; Chrome 0.85x and 0.78x). New `--profile <case>` prints self time per function.
  Rechecked with the fixed bench: the 21 Oct Cathode memo is -13% on Plate Screamer and within noise
  on Init and Night Wind (it was reported as -13% to -31%).
- CPU, after the bench fix (measured 24 Oct, `--profile`): Valve 12 is `render`'s own body 44%,
  `valve()` 16%, `process` 13%, the oscillator `step` 11%, GC 4%. The LFO case is `render` 37%,
  `valve()` 21%, `fcoef` 4%. Plate Screamer (Cathode) is `process` 33%, `render` 30% and GC 12%:
  something in Cathode allocates per block, worth finding first (garbage on the audio thread costs in
  Chrome too, inferred). The items below that quote profile shares were measured with the old bench:
  their shares for anything that calls a top-level function or `Math` are overstated.
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
  worklet's self time in the Node profile, measured with the old bench; 16% with the fixed one). Anything there changes the output in the last
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
- Test health (test 9 reads a steady cost in its own page since 28 Oct, see above): test 9's CPU lines are wall clock in headless Chrome. On the 2-core build box they moved
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
Rank of the open items (10 Nov): 1. the Rack tab's project, mix and patch link rows (loose keys and plain boxes); 2. Orthicon's picture list;
3. a user patch's name window on a phone; 4. Phantastron's cartridge row on a phone; 5. rail plate titles at 761 to 959 px; 6. the phone first screen's slimmer chassis (once the Tube show item closes); then the rest as listed. The wide-cards item for the three slider devices is mostly answered by the row fill (see 1 Nov). The Lattice and Mote palette item waits on James.

- [x] 23 Oct: Mix desk strips. Measured before: the strip the keys play carried the class `keys`, which is
  also the keyboard's class (`height: var(--kb-h)`, `touch-action: none`, `user-select: none`), so that strip
  was forced to 150 px on desktop (a gap inside Filament's strip, the strips out of line) and 128 px on a phone
  while its controls needed 239 px (Cathode's strip drew over Filament's). Inferred from the CSS: a
  finger on that strip could not scroll the page (`touch-action: none` on an ancestor). Seen: strips were loose rows with no faceplate, names wrapped onto two lines
  (Thyratron, Pentagrid, Trochotron, Phantastron, Rhumbatron, Resnatron), the meters were a flat bar on a
  160 px canvas stretched to 600, and the room, delay and feedback sliders were the browser's blue.
  Now: the class is `keyed`; each strip is a brushed faceplate with a lamp (green for the keys, amber when
  armed), names on one line, an LED ladder meter drawn at the canvas's real size, and amber bus sliders.
- [x] 24 Oct: faders, rack-wide. Measured before: 63 sliders on six devices (Additron, Heptode, Phantastron, Resnatron,
  Rhumbatron, Trochotron) had no accent at all (browser blue), and every other slider was the browser's own control with a
  pale grey track on the dark chassis (seen). At 1366 px the slider grids of Trochotron, Phantastron and Rhumbatron split a
  228 px card into two columns, so their sliders were 6 to 56 px wide (Trochotron density 6 px, Phantastron feedback 7 px),
  and Heptode's track sliders were 55 to 88 px. Resnatron's five selects were the browser's white. Now: every slider is a
  recessed slot with a bakelite cap and a lit index line (the pitch and mod strips' finish; Lattice keeps a blue line),
  slider grids take only the columns that fit (one column in a narrow card), names and readouts sit in fixed columns,
  and Resnatron's selects are dark. No input box changed size except the widened ones (4,395 slider boxes compared).
- [x] 25 Oct: MIDI deck and SONGS strips. Seen before: two flat full-width rows on a near-black band, the
  status texts ("no take", "Pick a song, or drop a .mid file.", the position counters) as bare amber text, a dashed
  rule under each, and nothing that showed whether the recorder was armed or a song was playing apart from the
  button outline. Now: each strip is a brushed faceplate (the Mix desk strip finish) with two screws, the name on an
  engraved plate, and every status in a recessed amber readout window (contrast 13.8:1 measured); empty readouts
  hide instead of leaving an empty window. A lamp in the first window reads the buttons' own state (CSS `:has`, no
  script change): dark with nothing to play, amber with a take or a song loaded, dim red when armed, red and
  pulsing while a take runs (steady with reduced motion), green while playing. On a phone the screws and name
  plate drop and the faceplate and windows stay; 44 px targets and no sideways scroll unchanged (measured).
- [x] 26 Oct: outboard links (Hexode, Anode, Sculpt, Hand Orchestra, Aether, Iris). Seen before: the same dark
  button as the rail with no lamp, so they read as rail devices that do not light; measured before: the descriptions
  were 4.2:1 against the button's lightest stop. Now: a recessed tray under the rail with an engraved OUTBOARD
  plate (desktop), each link a warm brushed plate with squarer corners, a cable socket where a rail button has its
  lamp, and an amber arrow (an "opens a page" mark, hidden from screen readers); hover and keyboard focus light
  the socket's ring and nudge the arrow (no transition and no nudge with reduced motion). Each link has a title
  ("Hexode opens on its own page") and the tray is a named group. Measured after: names and descriptions 5.8:1 or
  more, all six on one row at 1366 px, 44 px targets and no sideways page scroll at 375 px. Cost: the chassis sits
  17 px lower at 1366 px (392 to 409) and 7 px lower at 375 px (365 to 372); on a phone the tray shows three
  links and part of the fourth (four before), the rest scroll inside the tray.
- [x] 27 Oct: desktop rail. Measured before: the 18 device buttons wrapped into ragged rows of 5, 6, 5 and 2 at 1366 px
  (button widths 144 to 245 px, 36 px tall, the rail 170 px tall), five rows at 1024 px and six at 800 px; seen: loose
  buttons straight on the panel with no bay, the RACK label a word in the first row. Now: the rail is a recessed bay (the
  outboard tray's finish) with an engraved RACK plate standing upright at its left, and the devices sit on even brushed
  module plates in a grid, the name over its role beside the lamp: nine across from 1340 px (two rows of nine), six
  across below (three rows), and under 960 px the plates keep the name and drop the role. Hover warms an unlit plate's
  edge and rings its lamp (no transition with reduced motion); the lit plate keeps each device's colour and gains a soft
  halo. Measured after: at 1366 px two rows of nine, every plate 134x44, the rail 105 px tall, no name or role clipped
  from 800 to 1920 px, names 6.9:1 and roles 5.7:1 on the lightest stop of the plate. The chassis sits higher: 409 to
  352 px at 1366, 571 to 521 at 1024, 613 to 521 at 800, 343 to 328 at 1920. The phone strip is unchanged (measured:
  one row, 44 px targets, no sideways scroll, chassis at 372 px). A 19th device starts a new row (the grid does not
  rebalance itself); the Rl. checks will say so, and the fix is a column count that divides the new total.
- [x] 29 Oct: empty states, Heptode's roll and Gleam's field. Measured before: Heptode's roll canvas had no CSS height, so
  it took the canvas's 2:1 ratio and stood 592 px tall inside its 148 px window at 1366 px; a loaded song's notes were
  drawn below the window and the roll looked empty on a desktop even while a song played (seen: a blank box with
  Ripple Bells loaded). On a 375 px phone it was 146 px, so phones were fine. Seen before: with no song it was a blank
  box with a cream line at its left edge; Gleam's field was an unlabelled grid. Now: the roll fills its window (148 px
  at both sizes); with no song it shows octave lanes on the pitch scale the notes will use (C2, C4, C6, C8 marked, MIDI
  60 is C4 like the keyboard) and an engraved readout window, NO SONG LOADED over "drop a .mid file here, or choose a
  song above" (shorter on a phone); a file dragged over it lights the lanes amber and the window says RELEASE TO LOAD.
  Gleam's untouched field names its axes on the edges (low, pitch, high along the bottom; soft to bright up the left),
  with a breathing pilot ring and TOUCH TO PLAY, "each finger is a voice; slide to bend" in the middle; room and effect
  modes get their own line. The hint fades out as soon as any voice sounds and back after 1.2 s of quiet; with reduced
  motion the ring holds still and the hint switches without a fade. Also on the standalone /synth/gleam/ page. Text
  contrast checked by the suite at 4.5:1 or more (amber title on the readout window and on the field).
- [x] 30 Oct: phone header, first slice of the phone first screen item. Measured before at 375x667: the header was four
  rows (patches; volume and limit; rec and master alone on a row, forced by `flex: 1 1 100%`; MIDI and the size keys), 250 px
  tall, so the lit panel started at 523 px and the keybed at 524 px: 1 px of panel on the first screen. The tip link was
  34 px tall. Seen: S, M, L and XL were four loose buttons. Now: three rows (patches; volume and limit; rec, master, MIDI and
  the size switch), 200 px tall; the panel starts at 473 px, so 51 px of it (the first section's name and the top of its
  controls) shows above the keybed at 375 and 360 px. The size switch is one recessed slot of four joined keys, the lit key
  amber with a soft glow, on desktop too (148 px wide at 1366, was 188). A running take's time sits over the rec key on a phone
  (a red lamp and the time, contrast 16.3:1, taps pass through to the key), so starting a take no longer pushes the rack down;
  the desktop keeps the time beside the key. The tip link is 44 px tall on a phone. Below 354 px the size switch wraps to a
  fourth row as before. All targets 44 px, no sideways scroll (measured at 320, 360, 375 and 390 px). No audio change.
- [x] 31 Oct: phone rail and outboard tray scroll cues, with the phone rail in a bay (the 26 and 27 Oct phone items). Seen before
  at 375x667: the rail was loose buttons straight on the panel (lamp low at the left, name pushed right) under the desktop's
  recessed bays, and the only sign either strip scrolled was a plate clipped at the right edge. Seen and measured before: a
  device picked from the far end (Resnatron, from a song or a saved project) left the rail at the start, so its lit plate was
  off screen and nothing on the first screen showed which device the keys played except the title. Now: on a phone the rail
  sits in the outboard tray's recessed bay, its unlit buttons on the desktop's brushed module plates with the lamp centred
  (names 6.9:1 measured); both strips draw a fade with a small amber chevron at whichever edge has more (`data-more`, set from
  the scroll position by a passive scroll listener and a ResizeObserver), and the cue goes at that end. The fades are sticky
  flex items with negative margins: they take no room (the last plate ends at the bay's inner edge, measured) and catch no
  taps (`pointer-events: none`; a tap under a fade reaches the plate, measured). Picking a device scrolls the rail just enough
  to show its lit plate (an instant scroll, no animation). Reduced motion: the cue switches without its 160 ms fade. Desktop
  unchanged (the rail and tray regions are pixel-identical on all 18 devices, compared). Cost: the chassis and panel sit 4 px
  lower at 375 px (the lit panel shows 47 px above the keybed, was 51). New checks: Sc. (9).
- [x] 1 Nov: desktop panel rows fill the width, and Pentagrid's dial fits its window. Measured before: the panel is an auto-fill
  grid (5 columns at 1366 px), and a row whose next card did not fit ended in an empty well. 15 of 18 devices had one at 1366 px
  (all but Lattice, Dekatron and Resnatron: Filament, Cathode, Gleam, Orthicon, Trochotron, Additron and Rhumbatron each left
  a last card alone with 4 empty columns; Pentagrid's Dial and Receiver used 3 of 5; Heptode, Mote, Geissler, Gyrotron and
  Phantastron used 2 of 5), every device had at least one at 1024 px (3 columns; the Mix and Master cards spanned 2 of 3) and
  17 of 18 at 1920 px. Pentagrid's dial bezel ran 52 px off the top of its 240 px window (seen: the 14 mark cut). Now: after the
  grid places the cards, each row's empty columns go to that row's cards, the last card first, one column each in turn (a
  script in index.html, `panelFill`; it runs when the device, tab, mix view, the cards or the panel width change, never on a
  timer, and a phone keeps one column). Rows never change, only widths, so no card moves. The panels got shorter: at 1366 px
  Additron 2,659 to 2,219 px, Orthicon 2,711 to 2,393, Heptode 2,443 to 2,187, Filament 4,307 to 4,201. Heptode's Place
  field now redraws when its card widens (its bitmap was stretched 3x, the track tokens drawn as flat ovals; caught by the new
  canvas shape check). Slider grids get a 26 px gutter on desktop so one column's readout does not run into the next one's name
  in a widened card (seen on Phantastron's Bends: "0.90 BITS"). The dial's hub sits at 80% of the window and the radius leaves
  the bezel inside it, with a warm lamp glow behind the scale (no motion, so nothing to reduce). New checks: Pf. (10).
- [x] 2 Nov: fader readouts on the mix desk and the MIDI deck's tempo (the top two items of 1 Nov). Seen before: the 75 mix
  faders (18 strips of level, pan, reverb and delay sends, and the bus room, delay and feedback) showed their value only by the
  cap's position, and the deck's "100%" was bare text beside its fader. Measured before at 1366 px: each strip's reverb send sat
  in the 118 px name column, so that fader was about 60 px while delay's was 130. Now: every one of those faders reads its value in
  a small recessed amber window (the deck's readout finish): level in dB (off at zero), pan as C, L40 or R50, sends and feedback
  in percent, room in seconds, delay in ms. A hook on each input's own value setter repaints the window on every write (a drag,
  a project, a song, the engine's sync), so no caller changes and patches need no event; the same text goes to aria-valuetext
  and the window is aria-hidden. In a strip the window sits under the fader's name, so the fader keeps most of its length; on
  desktop the sends now line up under level and pan and arm spans mute and solo. The deck tempo window matches the position
  readout beside it. Measured after: text 13.8:1 on the window; level faders 139 to 124 px at 1366, 176 to 161 at 800, 97 to 82
  on a 375 px phone; reverb sends about 60 to 124 px at 1366; desktop strips 89 to 97 px tall (Mix card 1,162 to 1,234 px at
  1366); phone strips unchanged at 256 px; 44 px targets and no sideways scroll unchanged. Display only, no audio change.
  New checks: Fd. (9).
- [x] 3 Nov: phone mix strips (the Mix tab on a phone). Measured before at 375x667: each of the 18 strips was six rows (the name; level and
  pan; mute and solo; the meter; the two sends; arm alone), 256 px tall, so the Mix section was 5,458 px; the bus faders started at 67, 74
  and 95 px (their names set the start), and "tempo" was 13 px lower case beside the 10 px upper-case bus names. Now: four rows, nothing
  hidden: the name with mute, solo and arm at its right (48 px chips), level and pan, the LED ladder, then the two sends. Strips 181 px at
  360 to 760 px, the Mix section 4,117 px at 375 (3,872 at 760); under 360 px the name takes its own line and the chips share the next
  (204 px at 320, was 256). The bus faders all start at 103 px; TEMPO matches the bus names (also on desktop, the only desktop change;
  contrast 4.6:1 on the panel, measured). Flex order moves only the chips, so the tab order is still level, pan, mute, solo, sends, arm
  (the chips now sit above the faders they follow in that order). Desktop strips unchanged (97 px, grid; the 1366 px page differs from
  main only at the tempo label, compared). 44 px targets, no sideways scroll at 320, 360, 375, 390, 600 and 760 px. New checks: Ms. (8).
- [x] 4 Nov: fader readouts, the rest of the rack (the top item of 3 Nov). Measured before at 1366 px: 21 panel faders on three
  devices had no number anywhere in their label and no aria-valuetext (Heptode 16: tempo, morph and the 14 track faders; Gleam 4:
  rate, depth, seed, level; Resnatron's level), and the header VOL "100%" was bare amber text. Seen: Heptode's Tracks card was two
  columns of bare caps. Now: every one of them reads its value in the mix desk's recessed amber window (tempo in BPM, morph as
  A, B or "40% B", cutoff in Hz or kHz, envelope times in ms or s, levels in dB, the rest in percent, Gleam's rate per second and
  its seed as a number); the header VOL is the same window. The hook and formats moved from index.html into `fread.js` and the
  window style into `desk.css`, so Gleam's own page (/synth/gleam/) draws it too. Heptode's track faders and Gleam's four keep
  their length: the window sits under the name, as in a mix strip (Heptode track faders 155 px at 1366 before and after, measured
  in the screenshot run; a first try with the window at the right cut them to 92 px). Measured after: text 13.8:1 on the window;
  on all 18 devices no panel fader is left without a number beside it; 375 px: all 22 faders 44 px tall and 100 px or wider,
  header 200 px (unchanged), no sideways scroll on the rack or on Gleam's page at 320 and 375 px. Costs: Heptode's Tracks card
  is about 45 px taller at 1366 px (289 to 334); on a 375 px phone Gleam's faders are 104 to 110 px (were 119 to 126) and
  Heptode's track rows a few px taller. Display only, no audio change. New checks: Rd. (11).
- [x] 5 Nov: desktop header, the same on every device. Measured before at 1366 px: the patch select sized itself to the
  device's longest patch name (144 to 230 px), so on 16 of 18 devices the patch bar fitted beside the title and squeezed the
  description into a 312 to 341 px column of 5 to 9 lines, the tip link fell onto a row of its own under it, and the rack's top
  moved between 186 and 294 px as the device changed (Filament and Phantastron, whose wider selects pushed the bar under the
  description, were the only two laid out like that). Also measured: 230 to 282 px at 1024, 264 to 300 at 800, 142 to 198 at
  1920. Seen: a ragged header that jumped on every rail click. Now: title and description on the left with the tip link at the
  top right, and under them the patch bar as one control strip across the width in the recessed tray finish of the rail and
  the outboard tray, with three engraved separators (patches; volume and limit; rec and master; MIDI) and the size switch at
  the right end. The select is one width (240 px; 200 px from 1020 to 1199 px, where VOL's slot narrows and MIDI drops
  "Connect" so the strip keeps one row); the description is up to 960 px wide and its area keeps the height of the longest
  description at the current width (`fitIntro`, one hidden measuring line, run on resize and after fonts load; a new device's
  description is included without a code change). While a patch name is being typed the MIDI key steps aside, so the strip
  stays one row at 1366 px. Measured after: the rack's top is the same on all 18 devices at each width (196 px at 1366, 214 at
  1024, 266 at 800, 196 at 1920); the strip is one row from 1020 px up and two rows from 761 to 1019; no sideways scroll; the
  description 8.2:1 on the page. Costs: Filament's description leaves its third reserved line empty at 1366 px (the rack 10 px
  lower than before for Filament: 186 to 196), long patch names are clipped in the 200 px select at 1020 to 1199 px; on 1920 px
  the rack sits up to 54 px lower than before for the devices that had the shortest header (142 to 196 for Filament, Cathode, Thyratron). The phone header (760 px and under) is unchanged
  (screenshots identical above the chassis on all 18 devices and 7 tabs). Display only, no audio change. Commit `a5cf40f`. New checks: 18 desktop Hd. checks.
- [x] 6 Nov: patch keys, phone and desktop. Measured before: the patch row was six loose keys with 6 px gaps (previous,
  the select, next, save, undo, init), so the select was 100 px on a 375 px phone (85 at 360, 115 at 390, 45 at 320) and showed
  "Wide Nov" for Wide Novachord Strings, with the browser's own arrow taking part of that. Seen: the select was drawn as a plain
  key, the same as save and init, so the patch name did not read as the instrument's display. Now: previous, the name and next
  are one joined stepper, and save, undo and init (and delete on a user patch) one joined switch, both in the size switch's
  recessed finish; the name sits in a recessed amber readout window (the fader readouts' finish, 13.8:1) with a small engraved
  caret instead of the browser arrow. Measured after: the name window is 137 px at 375 (shows "Wide Novachor..."), 152 at 390,
  122 at 360, 82 at 320; every key still 44 px on a phone; no sideways scroll; desktop keeps its 240 px window and the
  strip stays one row from 1020 px up with the rack's top where it was (the Hd. checks pass unchanged). Static, so nothing for reduced motion. Display only,
  no audio change. Commit `a602932`. New checks: Pk. (13).
- [x] 7 Nov: canvas lettering in the house face, rack-wide (grew out of the 3 Nov Rhumbatron caption item). Measured before (a
  probe on the canvas font setter, every device at 1366 and 375 px): six font strings on five canvases were the browser's
  sans-serif: Klystron's mouth pad (the vowel letters and the formant line), Phantastron's board (the chip and the pad names),
  Additron's spectrum (the footage names), Rhumbatron's cavity (its caption) and Heptode's place field (the track numbers);
  Gleam's effect-mode edge labels too (read in the code). Seen: Rhumbatron's caption was a bare lower-case "string" at the top
  left; Klystron's "730 / 1278 Hz" was bare text; measured: on a 375 px phone Phantastron's chip (ROM) ran about 1 px into the
  BITS pad's label. Now: every canvas font on the rack is the --font-mono stack (`houseFont()` in `fread.js`, looked up once);
  Rhumbatron's caption is an engraved tag on a small recessed plate naming the body and the exciter (STRING · PLUCK), with a
  lamp that lights while a finger is on the cavity (10.8:1 measured on its plate); Klystron's formants read F1 730 F2 1278 Hz in
  a recessed amber readout window drawn on the pad (`canvasReadout`, the `.fread` finish, 13.2:1 measured), at the bottom centre
  where no vowel letter sits; Phantastron's chip lettering is spaced capitals and a short chip (a phone's board) puts PH-1 ROM
  on one line, 10 px clear of BITS; Additron's footage names step down from 10 px until each fits its column (no change seen at
  375 or 1366 px). Static, so nothing for reduced motion. Display only, no audio change. Commit `f33b0fa`. New checks: Cf. (18).
- [x] 8 Nov: Klystron's source row (the top item of 7 Nov). Seen before at 1366 px: the vowel, file and mic chips sat beside Load
  and Mic, drawn as header buttons, that did the same two things (file and Load both opened the picker; mic and Mic both asked for
  the microphone), and the source's name ("Vowel") was bare grey text at the end of the row; at 375 px Load's word sat at the top
  of its key and "Vowel" hung above the row's middle. The five vowel chips were 26 px loose keys. Now: two rows with engraved tags
  (VOWEL, SOURCE; the tags drop on a phone): the vowels u o a e i as one joined switch, and vowel, file and mic as one joined
  switch, both in the patch keys' recessed finish with the lit key in Klystron's peach. One control per source: the file key is a
  real button (it opens the picker, so it is now reachable by keyboard; the old Load was a label around a hidden input) and the
  mic key is the old Mic button (same id). The name sits in a recessed readout window with a lamp: peach on the vowel pad, amber
  with a file loaded, red while the microphone is live (pulsing; steady with reduced motion), dark grey text when a saved patch
  names a file or mic that is not loaded ("Microphone (off)"). A long file name is clipped with an ellipsis inside the window.
  Measured after: text 13.8:1 on the window; at 1366 px keys 30 px tall, the row 488 px inside its card; at 375 px every key
  44 px, the source row one line, the window 153 px, no sideways scroll. Display only, no audio change. New checks: Ks. (13).
- [x] 10 Nov: Phantastron's seed row and bends readout (the top item of 8 Nov). Seen before at 1366 px: the SEED box in Bends was
  the browser's white number box with black text and its own spin arrows, the only white control on the rack, beside a loose run
  chip; the board's bar ended in bare "no bends" text after the chips (wired bends were bare text too, their double spaces kept).
  Now: the seed sits in a recessed amber readout window (the patch name window's finish, 13.8:1 measured) between previous and
  next keys, one joined stepper in the board's green; the window is still the number field (type a seed, Enter; the R. check for a
  typed 5000000000 passes unchanged) and the keys step it by one. Run is a key with a lamp, dark at rest and lit while the toy runs
  (steady). The bends sit in a recessed readout window with a lamp: dark lamp and dim text "no bends" (8.9:1), gold lamp and amber
  text once a wire is in (13.8:1); six bends are clipped with an ellipsis inside the window and listed whole in its title. Static,
  so nothing for reduced motion (lamps checked as not animated with reduce on). Measured after: seed window 90 px (ten digits fit),
  keys 30 px tall at 1366 and 44 px at 375, no sideways scroll at 375. Cost: the readout takes its own line under the chips, so the
  Board card is 32 px taller at 1366 px (438 to 470) and 38 px on a 375 px phone (491 to 529). UI only: no DSP, worklet,
  normalizer or patch touched. New checks: Ps. (13).
- [ ] A user patch's name window on a phone (6 Nov, measured): the delete key (57 px) joins the edit keys on a user
  patch, so the name window drops to 80 px at 375 ("My Te..."). At 320 the edit keys wrap to a row of their own instead
  (name 220 px, the header one row taller while a user patch is loaded). Options: delete inside the save form, or a
  shorter key.
- [ ] Orthicon's picture list (5 Nov, seen at 1366 px): the starter pictures under the paint tools (Harmonic Stack, Twin Sweep
  and the rest) read dimmer than the tool chips above them (not measured).
- [ ] Lattice and Mote use their own chip palettes (blue and cyan) beside the amber elsewhere (seen). A call
  for James whether that is per-device character or drift.
- [ ] Rhumbatron, Trochotron and Phantastron slider cards are 228 px wide at 1366 px, so their faders are 81 to 100 px.
  A wide card (`data-wide`) for those sections would double them (measured). 1 Nov: the row fill now widens the card that ends
  each of those devices' rows (Rhumbatron's Body, Trochotron's Shape, Phantastron's Bends); the cards mid-row are unchanged.
- [ ] Phone first screen (25 Oct, seen at 375x667 on every device; partly done 30 Oct): after the header slice the panel
  shows 51 px above the keybed. The rest of the first screen is the rail (48 px), the outboard tray (52 px), the chassis
  (99 px) and the tabs (52 px). A slimmer phone chassis (tubes and VU at about 80% height) would give the panel another
  20 to 30 px; it touches the tube canvases, so it waits for the Tube show item. The patch menu part (100 px on a 375 px
  phone, "Wide Nov") is done 6 Nov (see below).
- [ ] The Rack tab's project, mix and patch link rows (10 Nov, seen at 1366 and 375 px on every device): "Untitled" with save project,
  load saved, download and upload; "Mix" with save mix, load mix, download mix and upload mix; and the patch link box (10 Nov) with
  copy patch link, download patch and upload patch are loose keys beside plain dark text boxes, under a mix desk that is all
  faceplates and readout windows. Joined switches in the patch keys' finish, with each name in a recessed readout window, would match.
- [ ] Phantastron's cartridge row on a phone (10 Nov, seen at 375 px): the six cartridge chips and lift wires take three rows
  (babble alone on the second, lift wires alone on the third) above the bends readout. A joined cartridge switch with lift wires
  beside the readout would save a row.
- [ ] Rail plates on a 761 to 959 px window (27 Oct, measured): the role drops because the plates are 103 to 136 px; a
  title on each plate (the role) would keep it reachable by hover there.

## Open items for James
- Nightly 11 Nov, Surprise me: please press it a few times on Filament and on Cathode and listen (Rack tab, Mix section, the patch link row, "surprise me"). Calls I made that you may want changed: (1) the key sits in the patch link row, not the header, for the same 44 px reason as the link; say if you want it up by init; (2) one strength only (no "how wild" switch); the draws stay fairly tame: no arpeggiator, 1939 mode, Filter B, low pass gate, EQ, patch cables or pitch routes, and resonance stays under the singing point; (3) the level is set by measuring, so every draw lands at about the same loudness (a held chord peaking near -6 dBFS), which may sit a little under the loudest factory patches; (4) the rack effects (ensemble, tape echo, spring, room, output tubes) are drawn too, so a press also changes the room and echo; (5) it draws for Filament and Cathode only; the other 16 devices say so. Nothing I can hear: the in-tune and loudness checks are measurements, so whether the draws are musical is your call.
- Review 10 Nov (`docs/filament-review.md`), two master bus calls: (1) R1110-3, the master vol slider jumps in one sample (100% to 30% on a held sine clicks, 12x to 22x the sine's own step). A 10 ms `setTargetAtTime` glide in `setMasterVol` fixes it, but the check "Desk. master volume is the output gain and is not a patch" reads the gain straight after the set; it would have to wait about 60 ms for the glide. Your call whether that change to the check is fine. (2) R1110-4, switching the master delay (or reverb) off cuts its echoes and steps the dry level back in one sample (2.7x). A fade would keep the effect running until its tail dies, which bends "off is a straight wire". Fade, or keep the hard cut? Tonight's fix (R1110-1) glides the delay time and both mixes and fades the delay in when switched on; worth a listen: turn the master tempo knob or the delay division while echoes ring, which now crossfades instead of ticking.
- Nightly 10 Nov, patch links and patch files: please try them. Rack tab, Mix section, the row under the mix files: copy patch link, then open the link in another tab or on your phone; download patch and upload patch do the same with a file. Calls I made that you may want changed: (1) the row sits on the Rack tab beside the project and mix files, not in the header's patch row, because a fifth key there would cost the patch name window about 44 px on a phone (say if you want a key up there anyway); (2) one device's patch per link, the lit one, not the whole rack (a project carries 14 patches, so its link would be roughly 8000 characters, estimated by adding the per-device lengths measured tonight); (3) `?p=` comes off the address once it has loaded, so a reload keeps your edits instead of loading the link again (Trochotron's, Resnatron's and Orthicon's own links stay on the address, as before); (4) a linked patch shows as "* name (edited)" and is not saved under Yours until you press save; (5) a browser without CompressionStream (Safari before 16.4, Firefox before 113) writes a longer plain link that every browser reads, but cannot open the short form; (6) Mote's loaded sound, Klystron's recording, Lattice's dropped WAV and Orthicon's painted picture are not part of a patch, so they are not in the link; the toast says so on those four. Next in this item: Surprise me. Say if you want it shaped a particular way (which devices, how wild); otherwise the next nightly builds it for Filament and Cathode first.
- Review 9 Nov (`docs/filament-review.md`), two Theremin calls: (1) R1109-1, the on and off switch does not stop the pad: with it off, a press switches it back on and plays, so off only changes the pilot lamp and the readout. Make off a real rest (the pad ignores touches until switched on), or drop the switch and keep the lamp. (2) R1109-2, on a mono patch a key played while the pad is held takes the voice, but the pad's readout and glow still show the pad's note; the note comes back when the key goes up. In poly the same happens once every voice is in use, and there the pad stays silent until it is moved. Options: the pad keeps its own voice, or the readout says a key has it.
- Nightly 9 Nov, Theremin mode: please play it. On Filament, the Theremin section (a full row on a computer, the Pad tab on a phone): touch and slide; watch the magic eye on the chassis, which reads tune while you play and closes on a note. Calls I made that you may want changed: (1) the settings (from, across, snap, range) are the page's, kept in this browser, not part of the patch, so a patch change does not move the pad; (2) it plays the patch you have, envelopes and filters included, so a slow-attack sine patch sounds most like a theremin and a pluck sounds like a pluck; there is no factory theremin patch yet; (3) a press on the pad while the mode is off switches it on; (4) the pitch slides over about 20 ms whatever the glide knob says, so a fast move is a quick swoop, not a jump; (5) Filament only tonight, and the MIDI deck does not record the pad. Tell me which of the open slices matter (Cathode, deck recording, a factory patch or two, the eye in the big tube view); otherwise the next nightly moves on to the next 0.3 item, share links.
- Review 8 Nov (`docs/filament-review.md`), three paper roll calls: (1) R1108-3, the roll's play starts the transport, so Dekatron's own pattern plays under every roll (Blank Roll's play is a drum beat only); it shares R1030-3's answer: hold Dekatron's pattern unless Dekatron is lit or armed, or say so on the strip. (2) R1108-4, Heptode is a device chip on the roll, as in the library, and plays nothing; drop it from both lists or make it answer notes (R1030-4). (3) R1108-5, run is stored, so after one press of play every library song brings the roll in, also after a reload; keep run per page, or keep it stored and show the lamp on the library strip too. Fixed tonight, nothing to decide: a stop could leave the sounding note held on Filament or Cathode (R1108-1), and key in now turns off when the strip closes (R1108-2).
- Graphics 8 Nov, Klystron's source row: please look (Mouth card, under the pad). Before: vowel, file and mic chips, then Load and Mic drawn as header buttons that did the same two things, then the source's name as bare grey text. After: a VOWEL row (u o a e i as one joined switch) and a SOURCE row (vowel, file, mic as one joined switch, lit key peach), with the source's name in a dark recessed window with a lamp (peach vowel, amber file, red pulsing while the mic is live). Load and Mic are gone as separate buttons: file opens the picker every time you press it, mic toggles the microphone, and dropping a file on the pad still works. Say if you want a separate "load another" key back, or the tags off on desktop.
- Nightly 8 Nov, the paper roll: please try it. Under the song library, open roll, press play: Octave Pump plays the lit device at the rack tempo. Try Tie and Slide on Cathode or Thyratron (the slides should glide; I can only measure the overlap, 0.08 step, not hear the glide). Calls I made that you may want changed: (1) run is off on a fresh page, so a library song never brings the roll in; play on the roll strip turns it on and it then stays on (lamp amber) until you switch it off; (2) a step the timer reaches more than 60 ms late is dropped instead of played late; (3) a tie with nothing before it strikes if punched. Not in this slice: the roll in the project file, named user rolls and chains, the deck recording it, the master Render WAV including it. Say which matter most and the next nightly picks it up; otherwise it moves on to the next 0.3 item. The 7 Nov 1939 mode question is still open.
- Nightly 7 Nov, 1939 mode's plot: please look. On Filament, Osc tab, switch 1939 mode on: the filter response plot now sits under the tone tabs and draws the bank they make ("1939 bank: body + voice + mellow", peak near 880 Hz on the defaults); a tab redraws it. With the mode off it goes back to the Filter section as before. Call I made that you may want changed: the plot moves between sections (one plot, so the Filter tab has none while 1939 mode is on) rather than showing twice. The next open 1939 mode item is the mod matrix destination set (tone, tab levels), marked "if wanted": say if you want it, otherwise the next nightly moves on to the punched paper roll step sequencer.
- Review 6 Nov (`docs/filament-review.md`): (1) R1106-2, confusing: the LC bank with the stereo offset splits much wider than the other models (at 1 octave the side signal is 1.7 dB over the left channel; Valve 12 -8 dB) and mono loses 0.55 dB, because each side's narrow peaks land where the other side has none. Options: add the mono warning the Ladder 24 and Poly 24 notes carry to the LC note, or scale the offset down on this model. Your call on the sound. (2) Fixed tonight: in 1939 mode the unison and glide knobs now rest (dimmed, titled "Resting: 1939 mode"), since the mode ignores both (R1106-1); and the phone save name field is 44 px tall (R1103-3). Still open and yours: R1103-1 (Lattice WAV not kept), R1022-5 and R1025-3 (delete).
- Graphics 6 Nov, patch keys: the patch row looks different on both a phone and a computer. Before: six separate keys with gaps (previous, the patch menu, next, save, undo, init), the patch menu drawn like any other grey key with the browser's arrow, 100 px wide on a 375 px phone so it read "Wide Nov". After: previous, the patch name and next are one joined stepper, and save, undo and init are one joined switch, both in the same recessed finish as the S, M, L, XL switch; the patch name is amber text in a dark recessed window like the fader readouts, with a small caret. On a 375 px phone the name window is 137 px ("Wide Novachor..."). On a user patch at 320 px the edit keys take a row of their own. Say if you want the name in the house grey instead of amber, or the keys left loose on the desktop.
- Nightly 6 Nov, the LC bank: please listen. On Filament, Filter tab, pick "LC bank" in Filter (or in Filter B with a route on) and play a chord; move the cutoff, the resonance and the tabs. Calls I made that you may want changed: (1) the cutoff moves the whole bank together (at 850 Hz it sits where 1939 mode has it), so key tracking and the filter envelope make a moving vowel; with key tracking and envelope at 0 it is fixed per voice like 1939 mode; (2) resonance scales the Q from half of 1939 mode's (0) to five times (1), with 0.3 being 1939 mode's own voicing; it rings but never self-oscillates, as the design table says; (3) a soft clip after the bank takes the filter drive, so a loud single note is slightly coloured even at the default drive (H3 -33 dB on a loud sine at drive 3); (4) each slot has its own tabs, defaulting to 1939 mode's (body, voice, mellow); (5) its level is set by measurement to sit within 1 dB of Valve 12 on a chord. No factory patch uses it; name one or two to move onto it if you want. Still open under 1939 mode: the response plot for the bank while 1939 mode is on, and matrix destinations. Unless you say otherwise, the next nightly builds the plot for the bank.
- Graphics 5 Nov, desktop header: the top of the page looks different on a computer. Before, the header changed shape with the device: on 16 of the 18 the patch bar sat to the right of a narrow 5 to 9 line description, the tip link dropped onto its own row, and the rack jumped up or down by as much as 108 px when you clicked another device on the rail (only Filament and Phantastron had the bar under the description). After, every device has the same header: the title and a wider description at the left, the tip link at the top right, and under them the patch bar as one recessed control strip across the page (the rail's finish) with thin engraved dividers and the S, M, L, XL switch at its right end. The rack no longer moves when you change device. Calls you may want changed: the description area is as tall as the longest description (Gleam's), so Filament shows a blank third line; on a very wide screen the rack sits up to 54 px lower than it did for Filament; from 1020 to 1199 px the MIDI key reads just MIDI and long patch names are clipped. Phones are unchanged.
- Nightly 5 Nov, 1939 mode (first slice): please listen. On Filament, Osc tab, switch on 1939 mode (or load Exposition Choir or Parlor Harp). Hold a chord, try each shape and the tabs, then hold the sustain pedal (space) and let go of the keys. Calls I made that you may want changed: (1) the pedal lengthens the release (0.3 to 10 s, "pedal" knob) instead of holding notes, which is how I read "release on the sustain pedal" in the brief; (2) the resonators are fixed at 300 Hz, 850 Hz and 2.5 kHz band-passes, a 1.1 kHz low-pass and a 700 Hz high-pass, picked by six tabs (body, voice, edge, mellow, thin, open), my own voicing by measurement, not by ear; (3) while it is on, the oscillators, filters, envelopes, LFOs, unison and the mod matrix rest and say so in their titles; V1, the voice count, tune, bend, wheel, pressure and the rack still apply; (4) the masters sit at MIDI 108 to 119, so notes 120 to 127 are a master multiplied, not divided; (5) the two new patch names. Still open under the item: LC resonators as a filter model in the ordinary voice, the response plot for the bank, and matrix destinations. Unless you say otherwise in Notes from James, the next nightly builds the next part of this item (the LC filter model) before moving on.
- Review 4 Nov (`docs/filament-review.md`): R1104-4, a design call. Panic now empties the tape echo (1 Nov) and the master delay and reverb (tonight), but the Mix desk's delay and room returns and the patch's own output room still ring out after it (default patch: its hall room reads -40 dB half a second after Panic, and with the master reverb on that tail refills the reverb). All of them decay on their own. Options: Panic cuts every tail (a short dip on the desk returns and the room's wet gain), or only the ones that can run away, as now. Say which you want.
- Nightly 4 Nov, the big tube view: please look at it (the small arrow button at the top right of the chassis, or double click a tube). Play a chord with it open on V1, then V3 with the output pushed, and try the looks. Calls I made that you may want changed: a single click on a tube still jumps to its tab as before, so the view opens on a double click or the button; the look applies to the big view only, not the chassis (in /otr the filter also changes the rack's tube); the chassis rests while the view is open. With this, the Tube show item is done except the '73-style monosynth's tubes, which wait for that synth and its name. Unless you say otherwise in Notes from James, the next nightly moves on to the next unchecked 0.3 item, 1939 mode.
- Review 3 Nov (`docs/filament-review.md`): (1) R1103-1, broken: a Lattice patch made from an imported WAV comes back after a reload without the WAV. The patch still says "user" for oscillator A but plays a factory table, with no word, because the table lives only in the page's memory (not in the patch, the user list or the project), and the rack holds one imported table at a time, so two patches made from two WAVs would share the last one. Options: store the table's 16 source frames (4096 samples, about 11 KB as 16-bit) in the patch and its project entry; or keep it out of the patch and say on load that the WAV needs loading again. Your call, it is a schema change. (2) R1103-3: on a phone the save name field is 28 px tall; for the graphics backlog. Fixed tonight: save now refuses a factory name in any case ("plate bass" used to sit in the menu beside Plate Bass, R1103-2). Still open and yours: R1022-5 (delete lands on Plate Bass) and R1025-3 (no confirm on delete; undo does give the sound back as an edited patch).
- Graphics 3 Nov, phone Mix tab: before, each device's strip on a phone was six rows (name; level and pan; big mute and solo keys; the meter; the sends; arm alone on its own row), about 256 px each, so the Mix tab was a long scroll. Now each strip is four rows: the name with small mute, solo and arm keys at its right, then level and pan, the meter, and the two sends, 181 px each (about a quarter shorter overall). Nothing moved behind a toggle. The TEMPO label now matches the small upper-case bus labels (desktop too). Say if you would rather have the sends behind a toggle to shorten it further.
- Nightly 3 Nov, tube show: Dekatron's own pattern, Gleam's fingers and library songs routed to Dekatron, Thyratron, Lattice or Gleam now flare the chassis (before, only the keys and MIDI did). A running pattern now flickers the tubes on every hit, about 11 flares a second on the factory pattern measured. Please look at it on a drum pattern: if it is too busy, say so (options: flare only on accents, or only on the kick and snare). The last open slice of the Tube show item is the big tube view; the next nightly builds it unless you say otherwise.
- Review 2 Nov (`docs/filament-review.md`): nothing new for you to decide. Two older library calls were re-measured and are still open: R1030-3 (Dekatron's own pattern plays under every song, Greensleeves included) and R1030-4 (Heptode is a channel chip that plays nothing). Pick one each: hold the pattern while a song plays or say so on the strip; drop Heptode from the chips or have it voice notes.
- Graphics 2 Nov, fader readouts: before, the 75 mix faders showed their value only by where the cap sat, and the MIDI deck's tempo "100%" was loose text. Now each one reads its value in a small amber window like the deck's status windows (level in dB, pan as C, L40 or R50, sends in percent, room in seconds, delay in ms), and it follows patches, projects and songs as well as drags. On a desktop each strip is 8 px taller (the window sits under the fader's name) and its second row is rearranged: reverb under level, delay under pan, arm under mute and solo (before, the reverb fader was squeezed into the name column, about 60 px). Phone strips keep their height; the faders there are 15 px shorter. If you want level in percent instead of dB, say so.
- Nightly 2 Nov, spring reverb (Rack tab, after the tape echo): it is in and off everywhere, so nothing sounds different. Please listen: turn it on over a pluck or a lead and try drip 0, 40 and 100. Two calls: (1) are the defaults (mix 25%, decay 2.5 s, tone 5, drip 40%, drive 3) a good first sound, and (2) do you want a few factory patches retuned to use it (the tape echo has the same question open)?
- Review 1 Nov (`docs/filament-review.md`), three tape echo calls: (1) the feedback knob runs hot: at 95% the repeats never fade and at 100% they grow about 12 dB before the record amp holds them, so the top tenth of the knob is runaway (R1101-2, measured). Rescale it so 100% is the edge, or keep the feel? (2) The one echo follows the lit device's patch, so moving the rail to Cathode or picking a patch cuts a ringing tail within 0.1 s, and a deck part on Filament plays through Cathode's echo while Cathode is lit (R1101-3). Let tails ring across a change, or say so on the section? (3) Log knobs read their rounded position, so the default 375 ms shows as 376ms (R1101-4); show the patch value instead? Fixed tonight, no patch sounds different: Panic now empties the tape (R1101-1); before, repeats near full feedback went on after it.
- Graphics 1 Nov, desktop panel rows: before, a panel row whose next card did not fit stopped short and left a dark empty well at the right (Pentagrid's Dial and Receiver used 60% of the width; Additron's Envelope card stood alone, one column wide and 1,000 px tall). Now the cards in that row widen to fill it, so most devices' last rows are wider and shorter (Additron's panel 2,659 to 2,219 px at 1366). Pentagrid's dial is a little smaller, fully inside its window, with a warm glow behind the scale. Phones are unchanged. If you prefer a card to keep its width, say which and it can opt out.
- Tape echo, 1 Nov (nightly): new section on the Rack tab, off in every patch, so nothing you know sounds different. Worth a listen: drive 7 to 10 with feedback 80 to 100% (the record amp holds the runaway), wow and flutter at 50%+, and sync on with the tempo changed while it repeats (the tape glides). Two calls: (1) should a few factory patches use it (a dub bass, a slapback lead, a ping-pong pluck), and which? I left every patch alone. (2) Ping-pong starts on the right, not the left: the browser only times the loop exactly when the feedback head feeds the left side (details in the roadmap line). If you would rather hear it start on the left, I can swap the sides by building the loop differently; say so. Note the master bus still has its own clean delay; the tape echo is per patch and sits before the EQ and output tubes.
- Review 31 Oct, two arpeggiator calls (details in `docs/filament-review.md`): (1) R1031-3, the arp lives in the patch, so picking any factory patch, or pressing an arrow, switches a running arpeggio off and resets its settings; keep it per patch, make it a device setting, or add a "keep arp" switch? (2) R1031-4, the deck records the keys you hold, not the arp's notes, so an exported .mid is a held chord in a DAW; record keys (now), the arp's notes, or offer both? Also fixed tonight, no sound change to any patch: the master strip's render wav now follows the rack tempo (it rendered the arp and synced LFOs at 120 BPM), and the patch arrows walk the menu in the order it shows.
- Graphics 31 Oct: the device strips on a phone look different. Before: the rail was a row of loose dark buttons on the panel, and neither it nor the outboard row under it showed that it scrolls, except a button cut off at the right edge; a device picked from the far end (Resnatron, say) stayed off screen. After: the rail sits in the same sunken tray as the outboard row, on the brushed plates the desktop uses, and both rows show a dark fade with a small amber chevron at the edge that has more (left, right or both), gone at the end; picking a device slides the rail to show its lit plate. The panel sits 4 px lower on a phone. Desktop unchanged. If the chevrons read as buttons to you, they can go and leave only the fade.
- Nightly 31 Oct: the arpeggiator (Play tab, Arpeggiator section; off until you switch it on, so nothing sounds different). Calls made, any of which can change: (1) it follows the rack tempo, with no BPM knob of its own; (2) the step menu runs 1/2 to 1/32 with dotted and triplet values (11); (3) with the rack playing, a key waits for the next step on the grid, and stopped, the first note plays with the key; (4) Play does not restart the pattern, it carries on from the note it was on; (5) latch replaces the chord when you press a key with none down; (6) the sustain pedal holds keys you let go; (7) it is Filament only tonight (Cathode is a follow-up). Try a three-note chord at 1/16, up-down over 2 octaves, gate 30%, swing 60%, with the song library playing.
- Nightly 31 Oct, please listen: Horror Pad and Ghost Choir are slightly narrower. Their mono fold sat at the edge of the 3 dB limit and moved with each render's random phases (measured on main: Horror Pad 2.5 to 2.9 dB over 16 renders, and 3.1 dB in tonight's suite, which failed it; Ghost Choir 2.3 to 3.0 over 10). Stereo width 130 to 115 (Horror Pad) and 140 to 120 (Ghost Choir) brings them to 1.9 to 2.4 and 1.8 to 2.3 dB. Nothing else in either patch changed. Say if you would rather keep the width and trim the ensemble or unison spread instead.
- Graphics 30 Oct: the header on a phone looks different. Before: four rows of buttons (patches; volume; rec and master alone on a row; MIDI and four loose S, M, L, XL buttons), so at 375x667 the device's own panel did not show at all above the keyboard. After: three rows, with rec, master, MIDI and the size keys on one row, and 51 px of the panel (its first section's name) showing above the keyboard. S, M, L and XL are one dark switch of four joined keys with the lit one amber (desktop too). While recording on a phone, the rec key shows a red lamp and the elapsed time instead of the word rec. Say if you would rather keep the time beside the key, or want the next step (a slimmer phone chassis) after the Tube show closes.
- Nightly 30 Oct: tempo-synced LFOs (Mod tab, a sync menu in each LFO section; nothing sounds different until you pick a note value). Calls made, any of which can change: (1) the menu runs 4/1 down to 1/32 with dotted and triplet values from 1/2 to 1/16 (16 values); (2) a global synced LFO jumps to the bar's phase when the rack transport starts, so a slow sweep can step at Play (a per-voice one restarts at each note instead); (3) stopped, a synced LFO keeps running at the synced rate rather than freezing; (4) Cathode's MG does not sync yet. Try LFO 1 at 1/8 on tremolo or cutoff with the song library playing.
- Graphics 29 Oct: Heptode's piano roll and Gleam's touch field look different when idle. Before: Heptode's roll was a blank dark box with no song, and on a desktop it stayed blank even with a song playing (the canvas was four times taller than its window, so the notes were out of sight; phones were fine). Gleam's field was a bare grid. After: the roll shows its notes on a desktop; with no song it shows faint octave lanes and a small dark window reading NO SONG LOADED, drop a .mid file here, or choose a song above, and dragging a file over it lights the lanes amber (RELEASE TO LOAD). Gleam's untouched field shows a slowly breathing amber ring with TOUCH TO PLAY and "each finger is a voice; slide to bend", and names its axes on the edges (low, pitch, high; soft to bright); it fades the moment anything sounds and returns after 1.2 s of quiet (room and effect modes say what they do instead). Say if the Gleam hint should be smaller, shorter, or only shown once per visit. No audio change.
- Nightly 29 Oct: the mod matrix is on the Mod tab (8 slots, all off; nothing sounds different). Two calls: (1) the design doc puts it in a drawer that opens over the panel; tonight it is a section like the others (the full row on a wide screen). Say if you want the drawer. (2) The design doc lists a third, free envelope as a source; the matrix has the amp and filter envelopes only for now. Say if you want the free envelope next, ahead of the host clock item.
- Nightly 28 Oct: the live filter response plot is in the Filter section (Filter tab). Nothing sounds different. Two calls: (1) the curve is the small-signal response (what a quiet note hears); drive and loud notes bend the real filter, and the plot does not show that yet. Say if you want a drive-aware curve, at the cost of more CPU per redraw. (2) With a stereo offset the plot draws the centre, not the two sides; say if you want the left and right curves drawn faintly. Also open as a follow-up: dragging on the plot to set cutoff and resonance.
- Graphics 27 Oct: the rack rail (the device buttons above the tubes) looks different on a desktop. Before: 18 loose dark buttons of uneven widths wrapping into four ragged rows at 1366 px (5, 6, 5, then 2), with RACK as a word at the start of the first row. After: a dark recessed bay like the outboard tray, an engraved RACK plate standing upright at its left, and every device on a same-size brushed plate with the name above its role, two even rows of nine (three rows of six on a narrower window). The tubes sit 57 px higher at 1366 px. The order, the colours each device lights in, and the phone strip are unchanged; nothing in the audio path changed. Say if you want a different count per row, the role hidden, or the RACK plate horizontal.
- Nightly 27 Oct: listen to Filter B (Filter tab, the new section under Filter; pick serial, parallel or split). Nothing you already have sounds different: B is off in every patch. Three calls: (1) parallel sums A and B at equal power (each at -3 dB in the middle of the A / B knob), so two identical filters come out 3 dB louder than one; say if you would rather it kept unity for identical filters (each at -6 dB, so two separate bands come out 6 dB down). (2) B shares A's drive and velocity amount tonight; say if you want them per slot, as the design doc lists. (3) Should a factory patch or two move onto the routes (a split pad, a serial band-pass lead)? Name them and the next run will retune and log it.
- Graphics 26 Oct: the outboard links under the rail (Hexode, Anode, Sculpt, Hand Orchestra, Aether, Iris) look different. Before: the same dark buttons as the rack rail, minus the lamp, so they looked like rail devices that never light. After: they sit in a dark recessed tray with a small engraved OUTBOARD plate at its left (desktop only), and each is a warm brown brushed plate with a small cable socket on the left and an amber arrow on the right that says it opens a page; hover or keyboard focus lights the socket's ring amber. Same links, same pages, nothing in the audio path changed. The chassis sits 17 px lower on a desktop and 7 px lower on a phone. Say if the plate colour, the socket or the arrow should change.
- Check and debug 26 Oct: the low pass gate's UI text said "vactrol", a registered trademark; it now says "light cell (a lamp and a photoresistor)". Say if you prefer another word (photocell, low pass gate cell). The new trademark scan allows only Wide Novachord Strings, still waiting on your 15 Oct call.
- Nightly 26 Oct: listen to the Low pass gate (Filter section, seventh chip, "LP gate") and Hollow Pluck, which moved onto it. Hollow Pluck sounds different: before, a Valve 12 with a big filter envelope (cutoff 320, resonance 0.62, envelope 0.7, amp decay 0.9 s); now the gate in filter + VCA mode (cutoff 1100, resonance 0.45, envelope 0.5, lag 0.4 s, amp decay 0.15 s, so the vactrol carries the tail). Measured against its old self (voice only, note 60): the same level over the first 300 ms (within 0.5 dB) and the same -20 dB time (0.47 to 0.48 s); it opens about as bright and stays brighter through the middle of the note, then darkens with the level. Calls made, any of which can change: the vactrol lights from the amp envelope (with velocity), not from a separate strike; the cutoff is proportional to the vactrol's light (half the light, an octave down), so it closes fully as a note dies; turn-on is a fixed 2.5 ms; lag (0.02 to 3 s, default 0.3) is the dark tail's time constant and the top falls four times faster; full resonance is a gentle +6 dB bump that never sings; three modes (filter + VCA, filter only, VCA only).
- Graphics 25 Oct: the MIDI deck and song library strips under the panel look different. Before: two flat dark rows of buttons with the status as bare amber text and a dashed line under each. After: each is a brushed metal strip with a screw at each end and its name on a small engraved plate, every status and time counter sits in a dark recessed amber window, and the first window has a lamp: dark with nothing loaded, amber when a take or song is ready, dim red when the recorder is armed, red and pulsing while recording (steady if the system asks for reduced motion), green while playing. No button moved and nothing in the audio path changed. Say if the lamp colours, the pulse or the screws should change.
- Nightly 25 Oct: listen to SVF 12 (Filter section, sixth chip) with its morph knob, and the new factory patch Notch Drift (Pad). Calls made, any of which can change: morph is one knob from low-pass through band-pass and high-pass to notch, with straight crossfades between neighbours (halfway from low-pass to band-pass is 6 dB down at 100 Hz); the band-pass is scaled to a unit peak at zero resonance, so at a given resonance it sits 3 dB above the low-pass peak; it sings from about 9 on the resonance knob, at low-pass, band-pass and high-pass (high-pass carries more of the loop's harmonics: H3 about -25 dB against -43 at low-pass); at notch the singing pitch cancels but a quieter buzz of its harmonics is left (about -39 dBFS), which is how a real notch output of a self-oscillating state variable behaves; drive bends the two integrators (gentler than Poly 24); morph is not on an LFO or the mod wheel yet (the mod matrix item is the place for that).
- Graphics 24 Oct: every slider in the rack looks different. Before: the browser's own sliders, a pale grey track with a blue
  thumb on six devices and a flat amber one elsewhere; on a 1366 px desktop Trochotron, Phantastron and Rhumbatron squeezed theirs to
  stubs (6 to 56 px) and Resnatron's wave and mode menus were white. After: a dark recessed slot with a small brown cap and an amber
  index line, like the pitch and mod strips (Lattice's line is blue), one column of sliders in a narrow card with the names and
  values lined up, dark menus on Resnatron. The cap glows a little more on hover and focus. There is no coloured fill along the
  slot any more (the amber accent used to fill on the mix desk and the volume); the cap position is the readout. Say if you want
  the fill back, a different cap colour, or longer faders on those three devices. No audio change.
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
- Review 24 Oct (`docs/filament-review.md`): (1) Hexode's 13 operator toggles (On/Off, Fixed) have no name or pressed state for a screen reader, on top of its missing focus ring; both are in the vendored Angular code under `/synth/fm/` (R1024-3, R1020-6). Patch our copy, or leave the vendored page as it came? (2) R1020-3 still stands: a project does not carry Thyratron, Dekatron, Lattice, Gleam or the master bus. Tonight's fix (R1024-1) only stops load saved from rolling those devices back; it does not save them.
- Review 25 Oct (`docs/filament-review.md`): (1) Delete removes a user patch with one press, no question and no undo, and the patch lives only in this browser (R1025-3). A confirm, or an undo in the toast? (2) Cathode's pitch mod A and B step 0.1% of travel per arrow key, so 100 presses reach +24 cents; a coarser arrow step with Shift for fine, like the strips, would match the other knobs (R1025-4). (3) The phone footer links are 13 px tall (R1025-5). Fixed tonight: Phantastron no longer dies when a patch with a shorter phrase is picked while a voice sounds (R1025-1, a stuck-silent device until reload), and the Lattice matrix controls are named in words (R1025-2).
- Review 26 Oct (`docs/filament-review.md`): (1) The Mix desk's reverb and delay sends feed the desk's own room and an unsynced delay, not the master reverb and synced delay; route them to the master effects, or rename them so the two are told apart? (R1026-3) (2) The master reverb at mix 1 is about 10 dB louder than dry and hard-clips with limit off; match the wet gain to the dry, or turn limit on by default? (R1026-4, R1017-9) (3) Space is always the pedal, so Space never presses a focused button; let Space press a button reached by Tab? (R1026-5) (4) The limiter is now a true peak limiter (no sample above the ceiling); it only sounds different where it used to overshoot, which was any time it was working hard. Listen with limit on and the delay at high feedback (R1026-1, fixed).
- Review 27 Oct (`docs/filament-review.md`): (1) For about 8 s after opening (live, headless; likely longer on a phone) the Mix desk shows no arms and the default room and delay, then the saved ones appear, and an arm set in that window is replaced at boot. Show the saved arms from the start, or a "loading devices" note on the desk? (R1027-2) (2) Fixed tonight: save project or save mix pressed in that window used to write no arms and the default desk bus over the saved ones (R1027-1). (3) Still standing and worth a decision together: a project does not carry Thyratron, Dekatron, Lattice, Gleam or the master bus (R1020-3), and the desktop rack now has 426 tab stops with no skip link (R1020-8).
- Review 28 Oct (`docs/filament-review.md`): (1) Klystron's gate (0 to 0.4) silences four of the five factory patches by a quarter of its travel, and focus at its top costs 25 to 38 dB. The gate is an absolute threshold on each band's envelope. Rescale it, or make it relative to the loudest band? Either changes how existing patches respond to the knob (R1028-2). (2) Resnatron has two level controls that multiply (the panel's Level and the Out module's level). Keep both, drop one, or label the panel one as the device trim? (R1028-3) (3) With the LP gate in A and Filter B on split or parallel, B's side takes the light cell's level but not its darkening, so the tail swings to one side and stays bright. Say so in the Filter B note, or bring B under the gate's darkening? (R1028-4) Fixed tonight: the plot readout's "peak at 20Hz" on a parallel sum (now "passband +3.0 dB", R1028-1) and the emptied tempo box falling to 40 BPM (R1026-6).
- Review 29 Oct (`docs/filament-review.md`): (1) The header's record and the master strip's record capture after the master volume, so a take made with the volume at 25% is 11.5 dB quieter (R1029-3). Record before the volume, or say on the control that it is recorded? (2) Mixer pan is a balance control: a mono voice panned hard keeps its level on one side and loses the other, about 3 dB quieter overall than centred (R1029-4). Keep it, switch to equal-power panning, or note it in the mixer help?
- Review 30 Oct (`docs/filament-review.md`): (1) Dekatron's own step pattern plays under every library song, even ones with no drum channel, and on top of a song's channel 10 hits (R1030-3). It is listed as a known limit; hold the pattern while a song plays, or say so on the library strip? Fixed tonight: it also stopped for good after the first song with drum hits (R1030-2), so until now most people heard it only once. (2) Heptode is offered as a library channel target but plays nothing (R1030-4): drop it from the chips, or have it voice incoming notes? (3) Fixed tonight: library channels routed to Lattice, Mote, Klystron, Rhumbatron, Gyrotron, Orthicon, Pentagrid, Geissler or Resnatron were silent unless that device had been on the rail (R1030-1). Those songs now sound on those devices; listen to a few, since nobody has heard the library through them before.
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
- 2026-11-11 (check and debug, scheduled task, about 2:08 to 2:35 AM PT): reviewed 2 commits since 10 Nov 6 PM PT on origin/main `6e517a4`: Claude's 12:28 AM nightly `f91a591` (Surprise me on Filament and Cathode, surprise.js) and its log line `6e517a4`. Read `f91a591`: no test removed or loosened (the only removed lines are the suite docstring and the Mix note, both rewritten), 22 new Su. check calls; surprise.js is our own code, no new license or vendor folder, no trademark name, nothing under /otr, no factory patch touched. Suite on origin/main ALL PASS (1819 checks, about 22 minutes, no hang; the chromium-1194 path is still missing, it ran on its fallback); `scripts/test_synth_imported.py` ALL PASS. Live (cache-busted): /synth/ ready at 1366 and 375 px, no page errors, no console errors, no sideways scroll; the only failed request was the `/api/stat` beacon aborted as the page closed; /synth/fm/ and /synth/acid/ no errors (Hexode still scrolls sideways at 375, known). Offline renders on the live page: Filament, Cathode and Dekatron all sound (RMS -21.7, -17.6, -12.3 dBFS; no NaN). Live surprise.js, index.html and sw.js match the repo; sw.js `dxedge-v202` matches. Defects: none. Fixes: none.
- 2026-11-11 (nightly, scheduled task, about 12:20 to 1:45 AM PT): main first: origin/main `4df0477` (new since the last log line: Claude's 10 Nov check `c4d2c53`, graphics `864c61a` `d64703e` `2770f23`, review `a75a630` and improvement `4df0477`; read, nothing to undo, nothing under /otr). Suite on origin/main in a clean worktree ALL PASS (1789 checks); `scripts/test_synth_imported.py` ALL PASS (29). Live /synth/ ready at 1366 and 375 px with no page errors, no failed requests and no sideways scroll; /synth/fm/ and /synth/acid/ no page errors; live sw.js `dxedge-v201` matched main. The graphic EQ landed long ago, so step 3 was skipped. No answer on the 10 Nov patch link item, so per its last line the next slice of the share links item: Surprise me on Filament and Cathode (see the roadmap item). `surprise.js` (our own code: a seeded 32-bit xorshift, archetypes, limits) and a surprise me key in the patch link row; the page renders each draw offline at out.level -12 dB and sets out.level from the measured peak and loudest 100 ms. No DSP, worklet, normalizer, schema or factory patch touched, so no existing patch sounds different. Measured (Su.): 200 seeds a device keep every limit and pass the normalizer unchanged; 12 fitted draws a device: chord peak -6.7 dBFS worst on Filament, -5.1 on Cathode (limiter threshold -1); loudest 100 ms -20.4 to -15.4 dBFS; strongest partials within 11.2 cents (Filament) and 8.7 cents (Cathode) of a harmonic; mono fold 1.8 dB worst; draw and fit 0.4 to 1.6 s on this box. Found on the way (test design): an FFT peak picks one unison voice or one side of a detuned pair (16 cents flat on a 3-voice pad), so the tuning check reads each partial's power-weighted middle within 40 cents; and a C2 bass an octave down with a sub put the sub at 16 Hz (too quiet to fit, redrawn), so such a bass now takes no sub. Cache `dxedge-v202`. New checks: Su. (30). CPU (test 9, this box, noisy tonight on both runs; no worklet changed): Cathode 24.7%; valve12 8 voices 26.5%; ladder24 35.6%; LC bank 34.4%; 16 voices with ensemble 55.0%; tape echo on 35.7%; spring on 23.0%; 1939 mode 31.3% (the same cases on origin/main an hour earlier: 16.1, 19.7, 18.2, 19.3, 36.8, 25.9, 19.0, 17.4). Suite: ALL PASS (1819 checks) on the work commit; this docs commit changes only this file, which the suite does not read; `scripts/test_synth_imported.py` ALL PASS. Listen and try: Surprise me (Open items). Commit: the work commit `f91a591` plus this docs commit.
- 2026-11-10 (improvement, scheduled task, about 5:28 to 6:25 AM PT): robustness, MIDI file import. Main first: origin/main `a75a630` ALL PASS (1785 checks, 1517 s), `scripts/test_synth_imported.py` ALL PASS; the chromium-1194 path is still missing, both ran on the fallback. No review finding marked broken is open except R1103-1 (waits on James). Fixed three import faults on the deck and Heptode (see Improvement backlog, 10 Nov). (1) A one-track file of 130000 notes (1.04 MB) was refused with "Maximum call stack size exceeded" on the deck and threw on Heptode: each part's lowest and highest note was `Math.min(...notes)`, which overflows past about 124000 items in Chrome; `noteRange()` in smf.js is a loop, and 130000 and 200000 note files now load on both. (2) A tempo of 0 read "0:00.0 · Infinity BPM" with every later note at the same instant; `readSMF` skips it, and the same file reads "0:02.0 · 120 BPM". (3) A file that is not MIDI dropped on Heptode's roll was a page error with a stale toast; the toast now says "junk: This is not a Standard MIDI File (no MThd header)." and the loaded score stays. Output unchanged for every file that loaded before: the three reader paths give the same JSON on main and this tree for the 28 .mid files in the tree and 3000 mutated copies (9084 of 9084). No DSP, worklet, normalizer or patch touched, so no patch sounds different. Cache `dxedge-v201`. New checks: M. (2) and H. (2), all four fail on main. CPU (test 9, this tree): Cathode 17.7%; valve12 8 voices 15.1%; ladder24 19.7%; LC bank 12.7%; 16 voices with ensemble 22.8%; tape echo on 20.3%; spring on 16.7%; 1939 mode 11.8%. Suite: ALL PASS (1789 checks, 1232 s) on the work tree; `scripts/test_synth_imported.py` ALL PASS. Commit: this one.
- 2026-11-10 (review, scheduled task, about 4:22 to 5:30 AM PT): areas c (the pedal and a computer key across a rail switch and a patch link, MIDI on four other devices, phone keys and strips), d (master bus moves over a held A2 sine: tempo, delay division, time, mix, reverb mix, delay on and off, compressor on, master volume; rack tempo against the master tempo) and e (a take, export, a file with a tempo change, running status, loop with a tempo change, stop, Render WAV after takes and files) on the live site at origin/main `2770f23`, sw.js `dxedge-v199`. Findings: 1 broken (fixed), 3 confusing (1 fixed), 0 missing; R1017-5, R1017-10 and R1017-11 still open. Fixes: R1110-1, master bus moves clicked on a held note (one BPM with the delay synced 31x the sine's step, reverb mix 42x); `master.worklet.js` now crossfades a new delay time over 20 ms, ramps both wet mixes (5 ms at most, landing exactly) and fills the delay in when switched on, all starting at their targets so renders are unchanged; R1110-2, Render WAV rendered the old take after a file was imported, and the file after a new take; `deck.js` now renders what came in last. Two checks (Mx. and M.), each failing on the old tree. R1110-3 (master volume jump) and R1110-4 (effect off cuts at once) are under Open items. Cache `dxedge-v200`. No patch sound changed. Suite: ALL PASS on this tree (count in the commit message). Commit: this one.
- 2026-11-10 (graphics, scheduled task, about 3:15 to 4:10 AM PT): suite on origin/main `c4d2c53` ALL PASS (1770 checks) before any change. Screenshots at 1366x1000 (all 18 devices) and 375x667 (every tab of every device) read; the Graphics backlog re-ranked and two items added (the Rack tab's project, mix and patch link rows; Phantastron's cartridge row on a phone). Built the top item: Phantastron's seed row and bends readout (the seed in a recessed amber window between previous and next keys, run a key with a lamp, the wired bends in a readout window with a lamp; see Graphics backlog, 10 Nov). UI only, no DSP, worklet, normalizer or patch touched. Cache `dxedge-v199`. New checks: Ps. (13). Suite: ALL PASS (1783 checks) on the work commit `864c61a`; the docs commits change only this file. Pushed `d64703e`; live (cache-busted, service worker blocked): phantastron-ui.js, index.html and sw.js match the repo, /synth/ ready at 1366 and 375 px on Phantastron with the new stepper and readout, no page or console errors, no sideways scroll.
- 2026-11-10 (check and debug, scheduled task, about 2:08 to 2:40 AM PT): reviewed 5 commits since 9 Nov 6 PM PT on origin/main `4c22ced`: Claude's 12:28 AM nightly `fe78777` (patch links and patch files, share.js) and its log line `4c22ced`; James's lava lamp wax `573e0dd` (PR #97, under /otr and its own lamp test, nothing under /synth); the health bot's state `e232f31` and `616dbe8`. Read `fe78777`: no test removed or loosened (the only removed test line is the suite's docstring, rewritten to add Sh.), 19 new Sh. checks; share.js is our own code, no new license or vendor folder, no trademark name, nothing under /otr, no factory patch, normalizer or DSP changed; reading is capped and prototype keys are dropped. Suite on origin/main ALL PASS (1770 checks, about 31 minutes, no hang; the chromium-1194 path is still missing, it ran on its fallback); `scripts/test_synth_imported.py` ALL PASS (29). Live (cache-busted, service worker blocked): /synth/ ready at 1366 and 375 px, no page errors, no console errors, no sideways scroll; the only failed request was the `/api/stat` beacon aborted as the page closed; /synth/fm/ and /synth/acid/ no errors (Hexode still 1154 px wide at 375, known). Offline renders on the live page: Filament, Cathode and Dekatron all sound (RMS 0.084, 0.152, 0.059; peaks under 0.52; no NaN). Live share.js matches the repo; a Cathode patch link (838 characters) opened in a fresh context loads on Cathode with the same patch and leaves the address. Live sw.js `dxedge-v198` matches. Defects: none. Fixes: none.
- 2026-11-10 (nightly, scheduled task, about 12:30 to 2:35 AM PT): main first: origin/main `616dbe8` (new since the last log line: James's three /otr commits, the Thanksgiving and Christmas Listenotr overrides #95 and #96 and the lava lamp wax #97, and the health bot's two 10 Nov state commits; read, nothing under /synth). Suite on origin/main in a clean worktree ALL PASS (1751 checks); `scripts/test_synth_imported.py` ALL PASS. Live /synth/ ready at 1366 and 375 px with no page errors, no failed requests and no sideways scroll; /synth/fm/ and /synth/acid/ no page errors; live sw.js `dxedge-v197` matched main. The graphic EQ landed long ago, so step 3 was skipped. No answer on the 9 Nov Theremin question, so per that open item the next 0.3 item: share links, JSON export/import and Surprise me, first slice (share links and patch files, rack-wide; Surprise me is the next slice). `share.js` (the dxpatch document, deflate-raw and base64url, capped reading, a JSON reader that drops prototype keys) and a row in the Rack tab's Mix section: copy patch link, download patch, upload patch. `?p=` loads on its own device through the device's normalizer and comes off the address. No DSP, worklet, normalizer or patch touched, so no patch sounds different. Measured (Sh.): all 129 factory patches on 18 devices round-trip, deflated and plain; the longest link is Filament's at 1273 characters (Thyratron 389, Resnatron 513); a deflate bomb of 1456 characters (1 MB inflated), a 70000 character link, a cut-off link, an unknown tag or version and devices named constructor, __proto__ or toString read as no patch; a link carrying `__proto__` and a cutoff of 1e9 loads with the cutoff at 20000 and no prototype touched. Found on the way: an offline render is not sample-identical even twice in a row (free-running phases start at random; Filament measured 0.5 to 1.7 dB apart in level between two renders of one patch), so the suite's sound check after the link is a level bound (3 dB, or twice the gap between two renders of the original) and the proof is the field-for-field patch comparison; the first full run had a tighter spectral check that failed on that variation alone and was replaced (test only). Cache `dxedge-v198`. New checks: Sh. (19). CPU (test 9, this box): Cathode 12.4%; valve12 8 voices 13.6%; ladder24 18.5%; LC bank 13.7%; 16 voices with ensemble 32.6%; tape echo on 20.0%; spring on 19.3%; 1939 mode 12.9%. Suite: ALL PASS (1770 checks) on the work commit; this docs commit changes only this file, which the suite does not read; `scripts/test_synth_imported.py` ALL PASS. Listen and try: patch links (Open items). Commit: the work commit `fe78777` plus this docs commit.
- 2026-11-09 (improvement, scheduled task, about 5:30 to 6:50 AM PT): test health and robustness, the 8 Nov watch item. Main first: origin/main `4b7d9d9` ALL PASS (1750 checks), `scripts/test_synth_imported.py` ALL PASS; the chromium-1194 path is still missing, both suites ran on their fallback. A strip going back to the wire (unmute, level back to full, pan back to centre, a solo let go) now waits for its gain glide on the audio clock instead of a 200 ms wall-clock timer (`holdRoute` and `settleWait` in mixer.js; `mixer.route(id)` added for the suite). Measured on main: under load the audio clock fell up to 99 ms behind the timer (177 ms of audio at a 276 ms timer); with the context suspended right after the move back, main jumps the whole gain, 960x the glide's own first step (672x for level), every run; this tree 1.0x (0.7x), held while stopped and on the wire after. Inferred: the 8 Nov 42x and 37x misses were that lag. No patch sounds different (no DSP, normalizer or patch touched; offline renders never take this path). Cache `dxedge-v197`. New check: Mx. audio clock stopped (1, fails on main). CPU (test 9, this box): Cathode 13.2%; valve12 8 voices 16.9%; ladder24 17.9%; LC bank 15.7%; 16 voices with ensemble 32.8%; tape echo on 15.5%; spring on 21.9%; 1939 mode 16.2%. Suite: ALL PASS (1751 checks) on the work commit; this docs commit changes only this file, which the suite does not read; `scripts/test_synth_imported.py` ALL PASS. Commit: the work commit `97ac9b2` (hash before any rebase) plus this docs commit.
- 2026-11-09 (review, scheduled task, about 4:25 to 6:00 AM PT): areas a (Theremin mode: the pad's sound, slides, level, release, bend, a patch pick, Panic, a blur and the pedal under it, the snap and range knobs, the phone Pad tab with touch; Klystron's vowel and source rows; Home and End on every knob of all 18 devices) and b (all 129 factory patches from the menu; all 27 Filament factory patches rendered from the keys and from the pad, none over 0 dBFS, no NaN; user patches saved, reloaded and deleted on Klystron, Additron and Resnatron; the save form's edge cases on Filament, Cathode and Lattice) on the live site at origin/main `75f767a`, sw.js `dxedge-v195`. Findings: 0 broken, 4 confusing (R1109-3 and R1109-4 fixed; R1109-1 and R1109-2 open for James), 0 missing; R1025-3 still open. Fixes: R1109-3, save with an empty name now says "Type a name for the patch first." instead of nothing under a stale "Saved" toast; R1109-4, closing the save form (Escape, cancel, a save) hands focus back to save, and Enter in the name no longer presses save again. Two Pn. checks, each failing on the live tree. Cache `dxedge-v196`. No patch sound changed. Suite: ALL PASS (1750 checks). Commit: this one.
- 2026-11-09 (check and debug, scheduled task, about 2:08 to 3:10 AM PT): reviewed 4 commits since 8 Nov 6 PM PT on origin/main `42d3d81`: Claude's 12:28 AM nightly `603a166` (Theremin mode, first slice) and its log line `42d3d81`, and the health bot's state `34eabf2` and `2d7dbd2` (scripts/health only). Read `603a166`: no test removed or loosened (the only removed lines are the ticked roadmap box and the eye markup and drawEye it extends), 29 new Th. checks; no new license or vendor folder, no trademark name, nothing under /otr, no factory patch changed; the theremin note (128) is kept out of the meter's notes, the arpeggiator's capture, Panic and 1939 mode. Suite on origin/main ALL PASS (1748 checks, about 27 minutes, no hang); `scripts/test_synth_imported.py` ALL PASS (29). Live (cache-busted): /synth/ ready at 1366 and 375 px, no page errors, no console errors, no sideways scroll; the only failed request was the `/api/stat` beacon aborted as the page closed; /synth/fm/ and /synth/acid/ no errors (Hexode still 1154 px wide at 375, known). Offline renders on the live page: Filament, Cathode and Dekatron all sound (RMS 0.09, 0.13, 0.10; no NaN); a {t:'thm'} note renders (RMS 0.09). Probe (offline, live page): pad held, a key pressed and released under it, the pad moved and let go, in poly, mono and legato: no hung note (tail 2.5 to 3 s at about -74 dBFS, the patch's room). Live sw.js `dxedge-v195` matched main; live index.html, voice.worklet.js, theremin.js and theremin-ui.js match the repo byte for byte. The chromium-1194 path is still missing; the suites ran on their fallback. Defects found: none. Fixes: none. Commit: this docs line only.
- 2026-11-09 (nightly, scheduled task, about 12:00 to 2:05 AM PT): main first: origin/main `2d7dbd2` (new since the last log line: the 8 Nov check `63a5cf6`, suite fix `ccce5fd`, graphics `5318d04` `2d404d4`, review `6639417`, improvement `a12f80f`, Cursor Agent's Late Night range probe under /otr (PR #93), and the health bot's two 9 Nov state commits; read, nothing to undo). Suite on origin/main in a clean worktree ALL PASS (1719 checks); `scripts/test_synth_imported.py` ALL PASS. Live /synth/ ready at 1366 and 375 px with no page errors (only the known `api/stat` beacon abort) and no sideways scroll; /synth/fm/ and /synth/acid/ no page errors; live sw.js `dxedge-v194` matched main. The graphic EQ landed long ago, so step 3 was skipped. No answer on the 8 Nov paper roll question (which remaining slice matters most), so per that open item the next 0.3 item: Theremin mode with the magic eye as tuning indicator, first slice (see its roadmap entry). A pad on Filament's panel (its own Pad tab on a phone: the Play tab already shows four sections, and the suite's one-section-group check failed with a fifth, so it moved): across is pitch, up is volume; the worklet holds one note (128) at the fractional pitch and level the pad sends. While the pad is held the chassis eye reads tune. No existing sound changed: all 37 cases of `scripts/bench_filament_voice.mjs --ref origin/main` are bit-identical with the pad unused; no patch field, no factory patch touched. Measured (Th.): pitch at 57, 57.5 and 69 within 0.5 cent (0.000); a level of 0.5 and 0.1 reads -6.02 and -20.00 dB; a move from 226 to 440 Hz slides over about 60 ms; the eye closes on a note (lv above 0.95), reads 25 cents sharp as about half open leaning sharp; pad draw 0.09 ms a frame at 744 px. Cache `dxedge-v195`. New checks: Th. (29). CPU (test 9, this box): Cathode 32.9%; valve12 8 voices 22.5%; ladder24 25.7%; LC bank 24.1%; 16 voices with ensemble 38.7%; tape echo on 23.8%; spring on 30.3%; 1939 mode 23.7%; chassis draw 2.06 ms a frame. Suite: ALL PASS (1748 checks) on the work commit; this docs commit changes only this file, which the suite does not read; `scripts/test_synth_imported.py` ALL PASS. Listen and play: Theremin mode (Open items). Commit: the work commit plus this docs commit.
- 2026-11-08 (improvement, scheduled task, about 5:25 to 7:15 AM PT): code health and robustness, the 6 Nov item. Main first: suite on origin/main `2d404d4` in a clean worktree ALL PASS (1714 checks); `scripts/test_synth_imported.py` ALL PASS. Fixed: three parameter table rows were narrower than what their normalizers keep (measured on main: Phantastron and Trochotron `seed` 0..999999 against any uint32; Gyrotron `root` 36..84 against 24..96). The seed rows now read 0..4294967295, Gyrotron's root row reads 24..96 and its knob reads the row. On the panels (measured): a typed seed of 5000000000 loaded as 705032704 (wrapped) and is now held at 4294967295; a Gyrotron patch with root 30 read 36 on its knob and now reads 30. No normalizer, worklet or DSP changed, so no patch sounds different; the root knob's pointer sits at a different angle for the same root. New checks: R. table against normalizer (481 number rows and 115 choice rows on 18 devices; the 69 carried stereo, ens and out rows Mote, Heptode and Orthicon pin to Filament's defaults are excused and written up in the backlog), R. typed seed, R. Gyrotron root knob; all three fail on main. Rebased onto the review's `6639417`; cache `dxedge-v194`. Suite: ALL PASS (1719 checks) on the pushed tree; one earlier full run of the same tree failed the old Mx. unity click check once (backlog: a wall-clock settle timer, inferred). `scripts/test_synth_imported.py` ALL PASS. CPU (test 9, this box): Cathode 17.5%; valve12 8 voices 13.0%; ladder24 13.3%; LC bank 9.5%; 16 voices with ensemble 23.8%; tape echo on 11.4%; spring on 15.3%; 1939 mode 11.0%. Commit: this one.
- 2026-11-08 (review, scheduled task, about 4:20 to 5:35 AM PT): areas f (the new paper roll on all 17 devices it offers, with a library song, a rail switch, Panic, tempo, rate and length changes under it, key in, a reload; a project saved with a muted, panned strip and loaded under a held note), g (Hexode and Anode at 1366 and 375 px) and h (tab walks with the roll open, names and rings, phone targets, reduced motion, Klystron's new rows) on the live site at origin/main `2d404d4`, sw.js `dxedge-v192`. Findings: 1 broken (fixed), 4 confusing (1 fixed), 0 missing; R1020-3, R1020-7, R1020-8, R1017-8 and Hexode's 1154 px at 375 re-measured, still open. Fixes: R1108-1, stopping the roll could leave the sounding note held on Filament or Cathode (every stop at gate 100%, 1 to 2 of 4 at the default gate), because the stop's flush dropped offs already queued; `paperroll-ui.js` now sends those again after the flush (its test log keeps one off per strike, moved to the time it goes). The first suite run on this tree failed the old check "Pr. live: ... stop let every note go" because the resent off was logged twice; fixed in the code, not the check. R1108-2, key in stayed on with the strip closed, so the keys rewrote steps out of sight; closing the strip turns it off. Two Pr. checks, both failing on the unfixed tree (measured). Cache `dxedge-v193`. No patch sound changed. Suite: ALL PASS on this tree (count in the commit message). Commit: this one.
- 2026-11-08 (graphics, scheduled task, about 3:00 to 4:30 AM PT): main first: origin/main `63a5cf6`, suite in a clean worktree ALL PASS (1701 checks). Screenshots at 1366x1000 (every rail device) and 375x667 (every device and tab), no page errors, no sideways scroll. Built the top backlog item, Klystron's source row: the vowels and the sources (vowel, file, mic) as joined switches in the patch keys' recessed finish, the duplicate Load and Mic buttons folded into the file and mic keys, and the source's name in a recessed readout window with a lamp (peach vowel, amber file, red pulsing mic; steady with reduced motion). Text 13.8:1; phone keys 44 px. Display only, no audio change. Commit `5318d04`. Suite ALL PASS (1714 checks; 13 new Ks.). Next: Phantastron's seed field and its "no bends" status, Orthicon's picture list, a user patch's name window on a phone.
- 2026-11-08 (check and debug, scheduled task, about 2:07 to 3:00 AM PT): reviewed 7 commits since 7 Nov 6 PM PT on origin/main `ccce5fd`: Claude's 12:28 AM nightly `5e87eef` (the paper roll, first slice), its log line `727f986` and the R. clock pulse check `ccce5fd`; the Late Night replay page `d8a973b` (Cursor Agent, merged by James as PR #91 `6b4d64c`; under /otr, nginx and the backend, nothing under /synth); the health bot's state `6c82390` and `62cdfce` (scripts/health only). Read the diffs: no test removed; `ccce5fd` changes one check with a stated reason (the first pulse is checked at its own tick's place, plus a new condition that it is the tick at or before play), a corrected expectation, not a loosened one; no new license or vendor folder, no trademark name, no factory patch changed; the /otr edit is James's own merged PR, not a synth edit. Suite on origin/main in a clean worktree ALL PASS (1701 checks, about 25 minutes, no hang); `scripts/test_synth_imported.py` ALL PASS. Live (cache-busted): /synth/ ready at 1366 and 375 px, no page errors, no console errors, no sideways scroll; the only failed request was the `/api/stat` beacon aborted as the page closed; /synth/fm/ and /synth/acid/ no errors (Hexode still 1154 px wide at 375, known). Offline renders of middle C on the live page: Filament, Cathode and Dekatron all sound (RMS 0.40, 0.29, 0.29; peaks up to 0.996; no NaN). These are louder than the 7 Nov line's figures, so the same script was run on `6b4d64c` (before the paper roll) and on `ccce5fd`: within 0.01 RMS of each other, so the difference is the render settings (velocity 100, 1.2 s), not a regression (inferred from that comparison). Live sw.js `dxedge-v192` matched main. Defects found: none. Fixes: none. Suite again on the pushed tree: ALL PASS (1701 checks). Commit: this docs line only.
- 2026-11-08 (nightly, scheduled task, about 12:30 to 1:20 AM PT): main first: origin/main `6b4d64c` (new since the last log line: the health bot's two 8 Nov commits and the Late Night replay page, PR #91, under /otr, nginx and the backend; read, nothing under /synth). Suite on origin/main in a clean worktree ALL PASS (1676 checks); `scripts/test_synth_imported.py` ALL PASS. Live /synth/ ready at 1366 and 375 px with no page errors and no failed requests; /synth/fm/ and /synth/acid/ no page errors (Hexode still 1154 px wide at 375, known); live sw.js `dxedge-v191` matched main. The graphic EQ landed long ago, so step 3 was skipped. No answer yet on the 1939 mode matrix destinations ("if wanted"), so per the 7 Nov open item the next 0.3 item: the punched paper roll step sequencer, first slice (see its roadmap entry): `paperroll.js` (schema, plan, factory rolls) and `paperroll-ui.js` (strip, scheduler on the rack transport, the canvas), a roll strip under the song library. Run is off on a fresh page. Nothing in any device's audio path changed; no patch sounds different; no factory patch touched. Measured (Pr.): steps planned 0.125 s apart at 120 BPM within 1 ms, each strike held 62.5 ms at gate 50%; a tempo change to 60 BPM and a rate change to 1/8 under a running roll keep the grid with no burst; the offline render of the score puts each step's pitch in its own window, under 0.01 RMS between strikes; draw 0.30 ms a frame at 1232x132. Found on the way: with another suite running on the same box the 25 ms timer starved and 17 of 48 steps arrived more than 60 ms late (now dropped rather than played as a burst); alone, 0 of 22 were late. Cache `dxedge-v192`. New checks: Pr. (25). CPU (test 9, this box): Cathode 15.5%; valve12 8 voices 12.5%; ladder24 16.5%; LC bank 14.3%; 16 voices with ensemble 22.5%; tape echo on 10.7%; spring on 14.4%; 1939 mode 10.1%; chassis draw 1.04 ms a frame. Suite: ALL PASS (1701 checks) on the work commit. The re-run on the tree with this line failed one old check, "R. play emits clock events": the transport was held at beat 0.023 (between ticks) by an earlier check, and the first pulse, the tick at or before the play position, is stamped 11.6 ms before play, where the check wanted it at play (a test bug, timing-dependent; not reproduced on main tonight). Fix, test only: the check wants the first pulse at its own tick's place (0 ms off at beat 0, 0.023 and 1.51, measured) and that tick to be the one at or before play. Then ALL PASS (1701 checks) on the pushed tree. Listen: Open items. Commit: the work commit plus this docs commit.
- 2026-11-07 (improvement, scheduled task, about 5:25 to 7:50 AM PT): test health, forced: main failed. The suite on origin/main `f3c2f16` ran 1674 PASS, 1 FAIL, "Eb. 375px" (the fresh phone page's first bank curve; state n 1, busy false, readout 'response' after 15 s, as the graphics job logged twice tonight). Not reproduced in 14 runs of the block outside the full suite (curve 0.15 to 2.7 s after the tap, booted() false through all of them; also with the phone page throttled 10x and three suites at once). Fix, test only: the check waits for the page's boot (30 s cap) before it sets the 1939 patch, waits for the same end state plus the readout on a 100 ms timer instead of animation frames, and logs a timeline and long tasks on a miss; end assertions unchanged. Cause inferred (boot work under full-suite load), not proven. Rebased onto the review's `004ebd1`; cache `dxedge-v190`. No site code changed, no sound changed. Seen under three concurrent suites only: "Ls. the rack transport reaches the worklet" (backlog). Suite: ALL PASS (1676 checks) on the pushed tree; `scripts/test_synth_imported.py` ALL PASS. CPU (test 9, this box): Cathode 20.2%; valve12 8 voices 21.6%; ladder24 18.4%; LC bank 18.7%; 16 voices with ensemble 34.6%; tape echo on 18.8%; spring on 20.0%; 1939 mode 13.0%. Commit: this one.
- 2026-11-07 (review, scheduled task, about 4:20 to 5:30 AM PT): areas c (1939 mode and the LC bank with the keys: bend, CC1, the hold button's longer release, keys held through Z, a rail switch and a blur; phone touch keys and the pitch strip springing back with two fingers down) and d (the mixer's moves on a held sine; the master compressor and limit under a hot chord through the master delay and reverb; the master delay at feedback 0.95) and e (a take on Exposition Choir with the pedal, export, play back, import, stop; Render WAV against the live output on Exposition Choir, Parlor Harp, an LC bank Plate Bass and Wide Novachord Strings; a looped file with the pedal never let up; a note with no note-off; deck tempo 50 and 200%) on the live site at origin/main `f3c2f16`, sw.js `dxedge-v188`. Findings: 1 broken (R1107-1, fixed), 0 confusing, 0 missing; R1017-9 and R1017-4 re-measured, still open. Fix: R1107-1, a mixer strip going back to unity (unmute, level back to full, pan back to centre, a solo let go) jumped to full level in one sample, a click of 16x to 48x the held A2 sine's own step; it now waits 200 ms for the gains to glide to unity before rerouting (`mixer.js`). A strip at its defaults is still a straight wire. One check (Mx.), failing on the live site. Cache `dxedge-v189`. No patch sound changed. Suite: ALL PASS on this tree. Commit: this one.
- 2026-11-07 (graphics, scheduled task, about 3 AM PT): canvas lettering in the house face, rack-wide: six sans-serif canvas font strings on five devices (Klystron, Phantastron, Additron, Rhumbatron, Heptode) and Gleam's effect labels now use --font-mono; Rhumbatron's cavity caption is an engraved STRING · PLUCK tag with a lamp; Klystron's formants sit in a recessed amber readout window; Phantastron's chip no longer runs into the BITS label on a phone. Display only, no audio change. Commit `f33b0fa`. Suite: ALL PASS (1675 checks; 18 new in Cf.). Baseline on origin/main `d1bf70f`: ALL PASS (1657). Seen: the Eb. 375px first-curve check failed in two of four full runs tonight (once on unmodified main under screenshot load, once on this tree with nothing else running), state logged as read 'response', n 1, busy false; it passed on the run that shipped. Not touched here.
- 2026-11-07 (check and debug, scheduled task, about 2:07 to 2:55 AM PT): reviewed 4 commits since 6 Nov 6 PM PT on origin/main `6cf478c`: Claude's 12:28 AM nightly `a09ece1` (the response plot draws 1939 mode's bank), its log line `8ff4b7c` and the Eb. phone wait `6cf478c`, and the health bot's state `11163a8` (scripts/health only). Read the diffs: no test removed; `6cf478c` raises one phone wait from 8 to 15 s with a stated reason (a first-load allowance the suite already uses) and logs more state, not a loosened assertion; no new license or vendor folder, no trademark name, nothing under /otr, no factory patch changed; the audio path is unchanged (frun39 runs only in the plot's lab). Suite on origin/main ALL PASS (1657 checks, about 23 minutes); `scripts/test_synth_imported.py` ALL PASS. Live (cache-busted): /synth/ ready at 1366 and 375 px, no page errors, no console errors, no sideways scroll; the only failed request was the page-view beacon `/api/stat` aborted as the page closed; /synth/fm/ and /synth/acid/ clean at both widths. Offline renders on the live page: Filament, Cathode and Dekatron all sound (RMS 0.08, 0.11, 0.17; peaks under 0.5; no NaN). Live sw.js `dxedge-v188` matched main; live index.html, voice.worklet.js and filtplot.js match the repo byte for byte. Re-ran the Eb. phone case 16 times on the live site: the bank curve painted every time within 1 s; in 4 of 16 the readout still said 'response' at the moment the curve first painted and caught up within a second (inference: the text follows a frame later; the suite's check waits for both, so not a defect). Defects: none. Fixes: none. Log line only. The Chromium path the task names (chromium-1194) is gone from this container; the suites found chromium-1243 through /opt/google/chrome/chrome.
- 2026-11-07 (nightly, scheduled task, early morning PT, done about 1:45 AM): main first: origin/main `11163a8` (new since the last log line: the health bot's state `11163a8` and James's sleep timer `b9a5f7e` under /otr; read, nothing under /synth, nothing to undo). Suite on origin/main in a clean worktree ALL PASS (1648 checks); `scripts/test_synth_imported.py` ALL PASS. Live /synth/ ready with no page errors (only the `/api/stat` beacon aborted as the page closed), /synth/fm/ and /synth/acid/ no page errors; live sw.js `dxedge-v187` matched main. The graphic EQ landed long ago, so step 3 was skipped; the Tube show is done except the '73-style monosynth's tubes (still no name), so the next open 0.3 item: the response plot draws 1939 mode's resonator bank (see its roadmap entry). The plot moves under the tone tabs while the mode is on. No sound changed: all 37 cases of `scripts/bench_filament_voice.mjs --ref origin/main` are bit-identical (display only). Measured: plot against the voice within 0.06 dB on five tab sets (a C2 staircase, 65 Hz to 3.6 kHz); the curve does not move with the cutoff (0.0000 dB from 200 Hz to 8 kHz). Cache `dxedge-v188`. New checks: Eb. (9; they fail on main, which has no bank curve). CPU (test 9, this box): Cathode 15.0%; valve12 8 voices 18.5%; LC bank 17.5%; ladder24 21.7%; 16 voices with ensemble 32.5%; tape echo on 20.3%; spring on 21.6%; 1939 mode 13.2%; chassis draw 1.69 ms a frame. Suite: ALL PASS (1657 checks) on the work commit `a09ece1`. The first run on the tree with this line failed one new check, "Eb. 375px": the fresh phone page had no curve after 8 s (readout still "response"); not reproduced in 14 runs of the phone path alone, 5 of them with the CPU saturated (about 1 s each), so the cause is not known. That check now waits 15 s, the suite's first-load allowance, and logs the plot's state (error, busy, count, device) if it misses again; the suite was then re-run on the pushed tree (see the commit). Look: Open items. Commit: `a09ece1` plus this docs commit.
- 2026-11-06 (improvement, scheduled task, about 5:25 to 6:30 AM PT): code health, the 30 Oct parameter ranges item. Main first: the suite on origin/main `c86f17e` ALL PASS (1647 checks, about 22 minutes, in a clean worktree); `scripts/test_synth_imported.py` ALL PASS. No review finding marked broken that this job can fix (R1103-1 still waits on James). Fixed: 51 parameter table rows on Mote (16), Orthicon (16) and Heptode (19) had min = max = the default; they now take Filament's ranges for the carried stereo, ens and out fields (`SHARED_RANGE`, `SHARED_ENUMS` in `patches.js`), plus 7 choice rows each that the tables had left out; Heptode's live channel is 0..15 and its loop points 0..86400 s (now clamped there). Measured: 0 flat rows on 18 devices (51 before); every other device's table identical to main's; the three normalizers give main's JSON on 1218 inputs; 7144 factory values inside their tables. New check "R. parameter ranges" (fails on main). Found, not fixed: Phantastron and Trochotron seed and Gyrotron root tables are narrower than their normalizers (backlog). Cache `dxedge-v187`. No patch sound changed. Suite: ALL PASS (1648 checks). CPU (test 9, main tonight, steady): Cathode 17.6%; Valve 12 16.2%, Ladder 24 18.8%, 16 voices with ensemble 28.4%, 1939 mode 11.3%. Commit: this one.
- 2026-11-06 (review, scheduled task, about 4:20 to 5:45 AM PT): areas a (1939 mode's five knobs, shapes and arp; the LC bank panel, plot, stereo offset; Cathode's tape echo and spring copies; chips and switches on Resnatron, Rhumbatron, Additron, Klystron and Phantastron) and b (all 129 factory patches on 18 devices from the menu; offline renders of all 27 Filament and 19 Cathode factory patches, none over 0 dBFS, no NaN; an old user patch with no era or tabs; an LC user patch saved, reloaded, deleted; the joined patch keys at 1366 and 375 px) on the live site at origin/main `e9277b6`, sw.js `dxedge-v185`. Findings: 0 broken, 2 confusing (R1106-1 fixed, R1106-2 open for James), 0 missing; R1103-3 re-measured and fixed; R1022-5 and R1025-3 still open. Fixes: R1106-1, the unison and glide knobs rest in 1939 mode, and the 1939 note lists glide; R1103-3, the phone save name field is 44 px. Two checks (Er. and Pn.), each failing on the live site. Cache `dxedge-v186`. No patch sound changed. Suite: ALL PASS (1647 checks). Commit: this one.
- 2026-11-06 (graphics, scheduled task, about 3:14 to 4:30 AM PT): main first: suite on origin/main `4a6ec99` ALL PASS (1632 checks; a first run was discarded because it served the working tree while this job edited it, so the baseline was re-run in a clean worktree). Screenshots at 1366x1000 (every rail device, full page) and 375x667 (every device, every Filament tab). Built the top open phone item, the patch menu: joined patch stepper and edit keys, the name in an amber readout window (desktop too). Found and fixed on the way: a zero flex basis let the volume slot join the first row at 390 px and squeeze the name to 33 px (caught by check 10). Commit `a602932`, ALL PASS (1645 checks, 13 new Pk.). Backlog re-ranked; new item for a user patch's name window on a phone.
- 2026-11-06 (check and debug, scheduled task, about 2:08 to 2:50 AM PT): reviewed 4 commits since 5 Nov 6 PM PT on origin/main `66daf05`: Claude's 12:28 AM nightly `ebd8d8a` (the LC bank as a filter model in slots A and B) and its log line `66daf05`, and the health bot's state `b3e7f20` and `04d0b18` (scripts/health only). Read `ebd8d8a`: no test removed (the Fb. and model loops were widened to take LC, not loosened), no new license or vendor folder, no trademark name, nothing under /otr, no factory patch changed; a tab change cannot reuse stale bank coefficients (setPatch bumps the coefficient epoch). Suite on origin/main ALL PASS (1632 checks, about 22 minutes); `scripts/test_synth_imported.py` ALL PASS. Live (cache-busted): /synth/ ready at 1366 and 375 px, no page errors, no console errors, no sideways scroll; the only failed request was the page-view beacon `/api/stat` aborted as the 375 px page closed (the test closing the tab, not a fault). /synth/fm/ and /synth/acid/ no errors; Hexode still scrolls sideways at 375 px (779 px, the known vendored item from 15 Oct). An offline render of middle C through __synth.render was non-silent on all 18 rack devices (about -20 to -23 dBFS RMS). Live sw.js `dxedge-v185` matched main. No defects; nothing fixed. Measured: this environment has no `/opt/pw-browsers/chromium-1194`, so the suites ran on their `/opt/google/chrome` fallback.
- 2026-11-06 (nightly, scheduled task, about 12:29 to 2:45 AM PT): main first: origin/main `04d0b18` (new since the last log line: the health bot's state `b3e7f20` and `04d0b18`; nothing under /synth) ALL PASS (1617 checks); `scripts/test_synth_imported.py` ALL PASS; live /synth/ ready at 1366 and 375 px with no page errors and no failed requests, /synth/fm/ and /synth/acid/ no page errors; live sw.js `dxedge-v184` matched main. The graphic EQ landed long ago, so step 3 was skipped. Built the next part of 1939 mode, per the 5 Nov open item: the LC bank as a filter model in slots A and B (see its roadmap entry). No existing sound changed: all 37 cases of `scripts/bench_filament_voice.mjs --ref origin/main` are bit-identical, and no factory patch uses the new model. Measured: the voice's response matches the bank's model within 0.04 dB (5 tabs alone at 3 cutoff and resonance settings, two mixes, 150 Hz to 5 kHz); the plot matches the voice; full resonance with no input stays at -140 dBFS; a saw chord on the default tabs sits within 1 dB of Valve 12 at the same knobs. Cache `dxedge-v185`. New checks: Lc. (15); the LC bank joins the Fp. plot check and test 9; the Fb. check that pins slot B's model list now lists seven (it failed on this tree's first run, as it should). CPU (test 9, this box, noisy): Cathode 15.3%; valve12 8 voices 19.6%; LC bank 8 voices 19.9%; ladder24 21.6%; 16 voices with ensemble 38.8%; tape echo on 21.0%; spring on 18.5%; 1939 mode 13.2%; chassis draw 1.68 ms a frame. Suite on the pushed tree: ALL PASS (1632 checks; this docs commit sits on the tested commit `ebd8d8a` and changes only this file, which the suite does not read); `scripts/test_synth_imported.py` ALL PASS. Listen: the LC bank (Open items).
- 2026-11-05 (improvement, scheduled task, about 5:25 to 6:50 AM PT): test suite health. Main first: the suite on origin/main `d6e8713` ALL PASS (1617 checks, run in a clean worktree after a first run was stopped because this job's bench edit landed in the same tree mid-run); `scripts/test_synth_imported.py` ALL PASS. No review finding marked broken that this job can fix (R1103-1 still waits on James). CPU tried first: the 1939 voice (`render39`, new last night) with its resonator states in locals and fewer `e39blep` calls was bit-identical but read +3.1% in Chrome (noise; Node -10 to -14%), so it was reverted (see the backlog entry). Shipped: "R. play emits clock events" reads the transport against the AudioContext clock instead of a fixed 180 ms wall-clock wait (it failed in last night's nightly run at beat 1.84). Separate script, 5 runs each: with an 800 ms long task on the main thread the old check passed 0 of 5, the new 5 of 5; idle, old 4 of 5, new 5 of 5. The new check also fails three transport faults the old one passed (beat at 1.1x tempo, pulses stamped 1.1x apart, a dropped pulse). The bench gains three 1939 mode cases; all four hash equal to origin/main. "Rd. a value set with no input event" (also failed last night) was not reproduced in 6 throttled runs and is a watch item. No product code changed, no sound changed, sw.js unchanged (main had not moved; no served file changed). Suite on the pushed tree: ALL PASS (1617 checks; the two R. checks rewritten, none added); `scripts/test_synth_imported.py` ALL PASS. CPU (test 9, this box, noisy): Cathode 32.1%; valve12 8 voices 34.3%; ladder24 38.4%; 16 voices with ensemble 58.1%; tape echo on 37.6%; spring on 39.9%; 1939 mode 33.6%. Commit: this one.
- 2026-11-05 (review, scheduled task, about 4:20 to 5:30 AM PT): areas f (projects with 1939 mode, save, download, upload, a bad file; all 21 library songs on Exposition Choir; loop), g (Hexode, Anode, Iris, Gleam at both sizes) and h (tab walks at 1366 and 375 px, the new 1939 section) on the live site at origin/main `362d38b`, sw.js `dxedge-v183`. Findings: 0 broken, 2 confusing (both fixed), 0 missing; R1020-3, R1030-3, R1020-7, R1024-3, R1020-8 and R1020-9 re-measured (details in `docs/filament-review.md`). Fixes: R1105-1, the 11 section on/off switches (1939 mode, arpeggiator, ensemble, tape echo, spring reverb, graphic EQ, speaker, room, master delay, reverb, compressor) carry their section as the screen reader name; R1105-2, save and download write the normalized project and mix name back to the field. Two Rv. checks, each failing on the live site. Cache `dxedge-v184`. No patch sound changed. Suite: ALL PASS (1617 checks).
- 2026-11-05 (graphics, scheduled task, about 3:14 to 4:10 AM PT): main first: suite on origin/main `d0a78bd` ALL PASS (1597 checks). Screenshots at 1366x1000 (every rail device, full page; headers also at 800, 1024 and 1920) and 375x667 (every rail device's first screen, every Filament phone tab); no page errors, no sideways scroll. The Tube show item is still unchecked in 0.3 (its last slice waits on the '73-style monosynth, and the 4 Nov tube view waits on James), so tube visuals and the phone chassis were left alone. Built a new top item found tonight, the desktop header: measured before, the rack's top moved between 186 and 294 px at 1366 px as the device changed, because the patch select sized itself to the longest patch name and squeezed the description into a 5 to 9 line column on 16 of 18 devices. Now one layout on every device (title and description left, tip link top right, the patch bar as a recessed control strip across the width, one select width, the description area as tall as the longest description via `fitIntro`); the rack's top is the same on all 18 devices at 800, 1024, 1366 and 1920 px. Phone header unchanged (screenshots identical above the chassis). Display only, no audio change; sw.js unchanged (main had not moved, and /synth/ is network-first). Commit `a5cf40f`, suite on the pushed tree ALL PASS (1615 checks, 18 new Hd. for the desktop header, beside the existing phone Hd. checks). Look: Open items.
- 2026-11-05 (check and debug, scheduled task, about 2:08 to 3:10 AM PT): reviewed 5 commits since 4 Nov 6 PM PT on origin/main `5047eca`: Claude's 12:28 AM nightly `5047eca` (1939 mode, first slice; read, no defect found: no test removed, no loosened check, no new license or trademark), James's slideshow and lava lamp `2e6f4c2` and `79a724e` (under /otr, not touched; its own test was retuned for the smaller lamps, with a reason), and two health bot state commits. Suite on origin/main, first run: stopped after 1020 PASS, 0 FAIL, when a cold boot in the R. section ("save project before the boot finishes") timed out at 30 s waiting for booted(); second run ALL PASS (1596). Cause, measured: the suite's file server was single-threaded, and one idle open connection (Chrome opens speculative ones) blocks every other request (a GET timed out at 5 s with one idle socket open); that the browser did this in the failed run is inference. Fix: the server is threaded, plus a harness check that a page load is served while another connection sits idle (fails on the old server). `scripts/test_synth_imported.py` ALL PASS (29). Live (`5047eca`, sw.js `dxedge-v183` matched the repo, index.html, voice.worklet.js and patches.js byte-identical): /synth/ ready at 1366 and 375 px, no page or console errors, no horizontal scroll, only /api/stat aborted (beacon); all 18 rack instruments rendered a note offline with sound and no NaN (peaks 0.19 to 0.52); /synth/fm/ and /synth/acid/ no errors; /synth/fm/ still scrolls sideways at 375 px (779 px, known since 15 Oct). No cache bump (no frontend change, main did not move). Suite on the pushed tree: ALL PASS (1597 checks). Commit: this one.
- 2026-11-05 (nightly, scheduled task, about 12:28 to 2:15 AM PT): main first: origin/main `79a724e` (new since the last log line: Claude's improvement `ba8c7df` (Panic fade, two live checks), Cursor Agent's live-radio work under /otr and backend, James's listening-room slideshow and lava lamp under /otr, the health bot's state; read, nothing to undo). Suite on origin/main: 1554 pass, 2 fail (R. "play emits clock events", whose 180 ms wait read beat 1.84, and Rd. "a value set with no input event", an empty read 120 ms after a click), both timing reads taken while this job ran benches and a second browser on the 2-core box; both pass on the pushed tree run alone, and neither touches code changed since the last ALL PASS, so read as load, not a defect. Live /synth/ ready at 1366 and 375 px with no page or console errors and no failed requests; /synth/fm/ and /synth/acid/ no page errors; live sw.js `dxedge-v182` matched main. The graphic EQ landed long ago, so step 3 was skipped. The Tube show is done except the '73-style monosynth's tubes (blocked on a name), so per the 4 Nov open item the next 0.3 item: built the first slice of 1939 mode (see its roadmap entry). No existing sound changed: with `era` off the Filament worklet's output is bit-identical to origin/main on all 33 bench cases (`scripts/bench_filament_voice.mjs --ref origin/main`), and no existing factory patch turns it on. New factory patches Exposition Choir (Pad) and Parlor Harp (Pluck). Cache `dxedge-v183`. New checks: Er. (34), plus a test 9 line. CPU (test 9, this box, noisy): Cathode 30.5%; valve12 8 voices 34.9%; ladder24 23.7%; 16 voices with ensemble 65.3%; tape echo on 37.6%; spring on 40.0%; 1939 mode 8 voices with every tab and the staircase 31.7%; chassis draw 1.81 ms a frame. Suite on the pushed tree: ALL PASS (1596 checks); `scripts/test_synth_imported.py` ALL PASS. Commit: this one. Listen: the two new patches, and 1939 mode on a held chord with the pedal (Open items).
- 2026-11-04 (improvement, scheduled task, about 5:25 to 7:20 AM PT): test health, forced: main failed it. The suite on origin/main `3dae34f` ran 1555 PASS, 1 FAIL ("M. master bus: Panic empties the master delay", tail -50.1 dBFS against -50, added by the 4 AM review); repeated alone on main it failed 3 of 15. Causes and fixes (details in the Improvement backlog): a master bus worklet bug, a Panic fade cut short by an effect switching on (or a full bypass) left the delay and reverb returns at the part-faded gain until the next Panic (18 dB down in that check), now the fade always finishes; and the check read the left channel of an alternately panned two-saw blip, now both channels, one oscillator, no drift (tail -44.2 to -45.7 dBFS in 10 runs, was -38 to -69). Also the goniometer watch item: the check now waits for the adaptive scale to come in after the same 1.2 s (830 and 663 lit pixels in tonight's two runs against 79 on main; bound 50). Sound: only the master returns after a Panic in that 10 ms window; no patch changed. New checks: 2 M. (block by block, both fail on main). Main moved during the run (Cursor Agent's Listenotr announcer level under /otr, `c4c728a`): rebased, cache `dxedge-v182`, suite re-run. Suite on the pushed tree: ALL PASS (1558 checks); `scripts/test_synth_imported.py` ALL PASS. CPU (test 9, this box, the pushed tree): Cathode 22.8%; valve12 8 voices 18.0%; ladder24 20.3%; 16 voices with ensemble 33.1%; tape echo on 18.8%; spring on 21.3%. (Chromium 1194 is not on this box; the suite ran on /opt/google/chrome.) Commit: this one.
- 2026-11-04 (review, scheduled task, about 4:20 to 5:50 AM PT): areas c (keys, MIDI, Panic), d (master bus, Mix desk returns, mute and solo) and e (MIDI deck: a two-track import, loop, stop, a MIDI take, export and reimport, Render WAV) on the live site at origin/main `1556a62`, sw.js `dxedge-v180`. Findings: 2 broken (both fixed), 2 confusing (1 fixed with the second broken one), 0 missing; R1101-3 re-measured with the deck. Fixes: R1104-1, each hosted device now sleeps as soon as it attaches, so a click in the first seconds after load no longer plays Mote, Geissler, Orthicon and Gyrotron for about 7 s (measured peak 0.95 on the live site); R1104-2 and R1104-3, Panic fades and empties the master delay and reverb, and either effect switched back on starts empty. Three new M. checks, each failing on the live code (measured). Left for James: R1104-4 (Panic and the other tails). Cache `dxedge-v181`. Suite: ALL PASS (see the commit). Commit: the review commit that carries this line.
- 2026-11-04 (graphics, scheduled task, about 3:14 to 4:10 AM PT): main first: suite on origin/main `dc5a5f1` ALL PASS (1542 checks, run in a clean worktree). Screenshots at 1366x1000 and 375x667 (the header, Heptode's Player and Tracks cards and phone tabs, Gleam's bar on the rack and on its own page, Resnatron's patch bay bar); no page errors, no sideways scroll. The Tube show item is still open (the 4 Nov tube view is waiting on James), so tube visuals were left alone. Built the top Graphics backlog item, fader readouts on the rest of the rack: the 21 panel faders that had no number (Heptode 16, Gleam 4, Resnatron's level, found by a rack-wide audit of all 18 devices) and the header VOL now read their value in the mix desk's amber window; the hook moved into `fread.js` and the window style into `desk.css`. A first layout with the window at the right cut Heptode's track faders from 155 to 92 px, so the window sits under the name instead (155 px kept). Commit `8635077`, suite ALL PASS (1553 checks, 11 new Rd.). Display only, no audio change; sw.js unchanged (main had not moved, and /synth/ is network-first).
- 2026-11-04 (check and debug, scheduled task, about 2:08 to 2:26 AM PT): reviewed 14 commits since 3 Nov 6 PM PT on origin/main `ef621e8` (plus their merges): 1 touches /synth, Claude's 12:28 AM nightly `ef621e8` (the big tube view); the rest are Cursor Agent's Listenotr Radio, Sci-Fi (Live), lamp and Old Time Radio work under /otr (outside this job, not Filament's), Claude's Pileup `79bf2c5` (sw.js v179, a /pileup/ route), James's `5ead4a3` (Old Time Radio Basic mode) and the health bot's state `a945c01`. Read the tube view diff: no test removed or loosened (the one removed suite line is its docstring, rewritten to add Tb.), no factory patch touched, no new vendored code or CDN package, no product names, no edit under /otr; the painter change sits below tubepaint.js's additions line; its keys (1 to 4, +, -, 0, arrows) do not collide with the computer keyboard's note and octave keys. Suite on origin/main `ef621e8` ALL PASS (1542 checks, about 22 min, Chrome at /opt/google/chrome since Chromium 1194 is not on this box); `scripts/test_synth_imported.py` ALL PASS (29). Live /synth/ ready at 1366 and 375 px, no page or console errors, no sideways scroll (only the known `api/stat` beacon abort); /synth/fm/ and /synth/acid/ no page errors, Hexode still 779 px wide at 375 (known since 15 Oct). Live tube view opened on V3 at both widths: painting, no error, no sideways scroll (draw 0.5 ms desktop, 0.9 ms phone). Offline renders on the live page: Filament -23.0 dB, Cathode Grid Bias Bass -12.7 dB, Dekatron Relay kick -16.6 dB, Thyratron Walnut Bass -14.8 dB, Lattice Glass Pad -17.5 dB RMS, all finite. Live sw.js `dxedge-v180` matched main. No defects, no fix; this line only (docs, which the suite does not read).
- 2026-11-04 (nightly, scheduled task, about 11:55 PM 3 Nov to 2 AM PT): main first: origin/main `003e42c` (new since the last log line: the lava lamp and lamp radio work on /otr, Listenotr Radio and Sci-Fi (Live), Pileup, the Old Time Radio Basic mode, and the health bot's state; none touch /synth; read, nothing to undo) ALL PASS (1515 checks); `scripts/test_synth_imported.py` ALL PASS; live /synth/ ready at 1366 and 375 px with no page or console errors and no sideways scroll (only the known `api/stat` beacon abort), /synth/fm/ and /synth/acid/ no page errors; live sw.js `dxedge-v179` matched main. The graphic EQ patch landed long ago, so step 3 was skipped. Built the Tube show slice "big tube view with the show at full size" (see its entry under Tube show). No sound changed: nothing in the audio path, no patch field, no factory patch touched. Cache `dxedge-v180`. New checks: Tb. (27). CPU (test 9, this box): Cathode 18.4%; valve12 8 voices 16.6%; ladder24 16.9%; 16 voices with ensemble 26.1%; tape echo on 18.4%; spring on 16.5%; chassis draw 1.31 ms a frame; big tube view draw 0.61 ms a frame (1066x1000 canvas). Suite on the pushed tree: ALL PASS (1542 checks). Commit: this one. Look: the tube view (Open items). (Chromium 1194 is not on this box; the suite ran on Playwright's Chromium 1243 via `SYNTH_CHROMIUM`.)
- 2026-11-03 (improvement, scheduled task, about 5:24 to 6:45 AM PT): load time and memory, the room's impulse response. Main first: the suite on origin/main `7bce8ab` ran 945 checks with 0 failures before this job's edit landed in the same working tree mid-run, so it was stopped there (the 3 AM graphics job had ALL PASS 1512 on that commit); the 4 AM review `f90f642` landed meanwhile and the tree was rebased onto it. No review finding marked broken that this job can fix: R1103-1 (Lattice WAV tables lost on reload) needs a schema and storage call and is left for James. Test 9 has no sound-identical hot spot left (see the backlog entry). Shipped: with the room off, the rack no longer builds the room's IR and convolver; it builds them when the room goes in. `C.apply` with the room off, headless Chrome, median of 100: 15.5 to 0.75 ms at the default fields, 78.1 to 0.70 ms at a 6 s hall; room on unchanged. Output unchanged: 6 fixed-signal cases hash equal old and new. No sound changed. Cache `dxedge-v178`. New checks: R. (2). Suite on the pushed tree: ALL PASS (1515 checks; one BrokenPipe traceback from the suite's own file server, not a check); `scripts/test_synth_imported.py` ALL PASS. CPU (test 9, this box, noisy): Cathode 25.3%; valve12 8 voices 29.2%; ladder24 36.0%; 16 voices with ensemble 43.9%; tape echo on 30.8%; spring on 32.1%. Commit: this one.
- 2026-11-03 (review, scheduled task, about 4:05 to 5:30 AM PT): areas a (every panel slider and knob on Thyratron 26, Additron 14, Rhumbatron 6, Mote 15, Orthicon 7 and Gleam 4 moves its own field; Thyratron's 26 at both ends rendered offline, no NaN) and b (all 127 factory patches on 18 devices from the menu; tape echo and spring in a saved user patch across a reload; delete and undo; a Lattice WAV patch across a reload; the patch bar at 375 px on all 18 devices) on the live site at origin/main `7bce8ab`, sw.js `dxedge-v176`. Findings: 1 broken (R1103-1, Lattice imported WAV lost on reload, left for James), 2 confusing (R1103-2 fixed: save refuses a factory name in any case; R1103-3 left), 0 missing; re-measured and still open R1022-5, R1025-3. Cache `dxedge-v177`. Suite: ALL PASS (1513 checks, the new Pn. case included; it fails on `7bce8ab`). Commit: the one that carries this line.
- 2026-11-03 (graphics, scheduled task, about 3:14 to 4:30 AM PT): main first: suite on origin/main `ef12996` ALL PASS (1504 checks). Screenshots at 1366x1000 (every rail device) and 375x667 (every phone tab, every device's first screen, the Mix tab top and middle); no page errors, no sideways scroll. The Tube show item is still open (the big tube view), so tube visuals were left alone. Built the top Graphics backlog item, the Mix tab on a phone: each strip is four rows instead of six (name with mute, solo and arm; level and pan; the LED ladder; the sends), nothing hidden, 256 to 181 px a strip at 375 px, the Mix section 5,458 to 4,117 px; under 360 px the name takes its own line (204 px at 320). The phone bus faders start on one line, and the tempo label matches the bus names (the only desktop change). CSS only, no script or audio change; tab order unchanged. Cache `dxedge-v176`. New checks: Ms. (8). Suite on the pushed tree: ALL PASS (1512 checks). Commit: this one. (Chromium 1194 is not on this box; the suite ran on /opt/google/chrome.)
- 2026-11-03 (check and debug, scheduled task, about 2:00 to 2:40 AM PT): reviewed 1 commit since 2 Nov 6 PM PT on origin/main `1a65a41`, by Claude (the 12:28 AM nightly): the tube show's flares from the meters of Dekatron, Thyratron, Lattice and Gleam. No edit under `/otr`, no factory patch removed or renamed, no new vendored code or CDN package (no register row needed), no product names, no test removed or loosened (the only removed suite line is its docstring, rewritten to add the meter flares; 6 checks added). Read the four engines' `ons`/`onv` counters, the host meter copies (Dekatron, Lattice and Thyratron already copy the whole meter; Gleam's copies the two new fields), Thyratron's sleep meter, Gleam's slide test, the frame loop's resync on a device change or a count that goes back, and the held-key guard on Filament and Cathode: no defects found. Suite on origin/main: ALL PASS (1504 checks; one BrokenPipe traceback from the suite's own file server, a closed request, not a check); `scripts/test_synth_imported.py` ALL PASS. CPU (test 9) on this box: Cathode 16.2%, Valve 12 8 voices 19.0%, Ladder 24 19.9%. Live: /synth/ ready at 1366 and 375 px, no page or console errors, no failed requests, no sideways scroll; /synth/fm/ and /synth/acid/ no page or console errors (Hexode still scrolls 779 px sideways at 375, known since 15 Oct). Offline renders on the live page: Filament -20.3 dB, Cathode -16.7 dB, Dekatron kick -14.4 dB, Thyratron -17.1 dB, Lattice -17.3 dB RMS; a key on Dekatron gave exactly 1 meter flare live. Live sw.js `dxedge-v175` and the commit's served files matched main. (Chromium 1194 is not on this box; the suite ran on Playwright's Chromium 1243 via `SYNTH_CHROMIUM`.) No defects, no fix; this line only (docs, which the suite does not read).
- 2026-11-03 (nightly, scheduled task, about 11:55 PM 2 Nov to 1:40 AM PT): main first: origin/main `7a2ed93` (new since the last log line: the 2 Nov graphics `98ba87e` `6035445` and review `394c613`, and the spring tank's parallel allpass chains `7a2ed93`; read, nothing to undo) ALL PASS (1498 checks); `scripts/test_synth_imported.py` ALL PASS; live /synth/ ready at 1366 and 375 px with no page or console errors (only the known `api/stat` beacon abort), /synth/fm/ and /synth/acid/ no page errors; live sw.js `dxedge-v174` matched main. The graphic EQ patch landed long ago, so step 3 was skipped. The 0.2 list is done, so the next item is the 0.3 Tube show (also what Notes from James asks for): built the slice "flares for the other rack devices" (see its entry under Tube show). Also fixed a double flare a starved frame loop could cause on Filament (a held key's note flared again from the meter after 250 ms; seen once tonight, "the flare scales with velocity" with two suites on one box). No sound changed: the engines only count note-ons on a message they already post. Cache `dxedge-v175`. CPU (test 9, this box): Cathode 12.5%; valve12 8 voices 12.1%; ladder24 12.5%; 16 voices with ensemble 17.6%; tape echo on 12.0%; spring on 10.8%; chassis draw 1.23 ms a frame. Suite on the pushed tree: ALL PASS (1504 checks, 6 new Tv.). Commit: this one. Look: a Dekatron pattern with the tube show on full (Open items).
- 2026-11-02 (improvement, scheduled task, about 5:29 to 7:20 AM PT): CPU, the spring reverb tank. Main first: the first suite run on origin/main `6035445` stopped with an exception (a 390 px Mote page took over 20 s to boot while this job ran Node benches beside it on the 2-core box); a quiet run on origin/main `394c613` (the 2 Nov review landed meanwhile): ALL PASS (1497 checks), `scripts/test_synth_imported.py` ALL PASS. No review finding marked broken is open, so CPU. Test 9's newest and unprofiled line, the spring: `spring.worklet.js` now runs its four allpass chains (24 sections each) interleaved in one loop with the per-sample state in locals, and stops the input high-pass state at exactly 0 below 1e-150, where with a silent input it used to sit in subnormals from about 1.9 s after a note until the tank slept (3.1e-322 at 3.5 s, measured in a rack render). Sound unchanged: output bit-identical to origin/main in Node (new `scripts/bench_spring.mjs`, 5 cases at 20 and 40 s, and at 22.05, 44.1 and 96 kHz) and in headless Chrome (the tank alone, 4 cases). CPU, headless Chrome, the tank alone, steady, median of 6: test 9's settings 2.80 to 1.86% of real time (-34%), a released chord ringing 1.85 to 1.18% (-36%). Details in the Improvement backlog. One new check (Sp. silence after a note). Cache `dxedge-v174`. Suite on the pushed tree: ALL PASS (1498 checks); `scripts/test_synth_imported.py` ALL PASS. CPU (test 9, this box ran slow, main's quiet run in brackets): Cathode 50.2% (44.4), Ladder 24 49.7% (53.6), Valve 12 48.1% (46.6), 16 voices with ensemble 91.1% (98.1), tape echo on 56.5% (49.0), spring on 48.7% (55.5). Read these as noise except the spring line, which moved the way the tank-alone measurement did. (Chromium 1194 is not on this box; the suite ran on /opt/google/chrome, Chrome for Testing 153.)
- 2026-11-02 (review, scheduled task, about 4:35 to 5:40 AM PT): areas f (all 21 library songs played and stopped, a project carrying the new spring reverb and tape echo, the footer against the channel chips), g (Hexode, Anode, Iris and Gleam at 1366 and 375 px) and h (Tab walks at both sizes, names on the new effect knobs, the new fader readouts from the keyboard, reduced motion) on the live site at origin/main `6035445`, sw.js `dxedge-v172`. Findings: 0 broken, 2 confusing (both fixed), 0 missing; re-measured and still open R1020-3, R1020-7, R1020-8 (481 tab stops), R1020-9, R1024-3, R1025-5, R1030-3, R1030-4, R1017-10, Hexode at 1154 px on a phone. Fixed: R1102-1, the tape echo, spring reverb and mod amount knobs now carry their section in the screen reader name (a `name` option on `K()`; closes R1030-6), and R1102-2, the footer's song library note no longer limits a channel to Filament, Cathode and Dekatron. Checks "Rv. ... (review R1102-1)" and "Rv. ... (review R1102-2)", both failing on `6035445`. Display text and names only; no sound changed. Cache `dxedge-v173`. Suite on the pushed tree: ALL PASS (1497 checks). Commit: this one.
- 2026-11-02 (graphics, scheduled task, about 3:20 to 4:15 AM PT): main first: suite on origin/main `c062120` ALL PASS (1486 checks, run in a clean worktree). Screenshots at 1366x1000 (every rail device, the deck and library strips opened) and 375x667 (Filament's seven phone tabs, every device's first screen, the deck); no page errors, no sideways scroll. Built the top two Graphics backlog items together, fader readouts on the mix desk and the deck tempo window: 75 mix faders and the deck tempo fader read their value in recessed amber windows through a hook on the input's value setter (also aria-valuetext); desktop strips line their sends up under level and pan. Display only, no audio change. Cache `dxedge-v172`. Suite on the pushed tree: ALL PASS (1495 checks; new Fd. 9). Commit `98ba87e`.
- 2026-11-02 (check and debug, scheduled task, about 2:10 to 2:45 AM PT): reviewed 4 commits since 1 Nov 6 PM PT on origin/main `f715989`: the health bot's state commits `196aadf` and `fbd67cf` (scripts/health only) and, by Claude (the 12:28 AM nightly), the spring reverb `b843849` and its log line `f715989`. No edit under `/otr`, no factory patch removed or renamed (none switches the spring on), the new research row is in the licensing register, no product names, no test removed or loosened (the suite's only removed lines are its docstring, rewritten to add Sp., and the CPU case's `big.pop("echo")`, extended to add the spring case). Read the tank worklet and makeSpring for defects (feed unplug and replug, Panic fade and clear, sleep, delay lengths against the buffer, the rack-off path): none found. Suite on origin/main: ALL PASS (1486 checks, Sp. included); `scripts/test_synth_imported.py` ALL PASS (29). CPU (test 9) on this box: Valve 12 8 voices 23.0%, spring on 27.5%, tape echo on 29.3%, 16 voices 32.2%. Live: /synth/ ready at 1366 and 375 px, no page or console errors, no sideways scroll, only the known `api/stat` beacon abort; /synth/fm/ and /synth/acid/ no page or console errors (Hexode still scrolls 779 px sideways at 375, known since 15 Oct). Offline renders on the live page: Filament -22.6 dB, Cathode -19.7 dB, Dekatron kick -13.8 dB RMS; Filament with the spring on rings -38.3 dB from 1 to 1.5 s against -44.7 dB with it off. Live sw.js `dxedge-v171` matched main. No defects, no fix; this line only (docs, which the suite does not read).
- 2026-11-02 (nightly, scheduled task, about 12:36 to 1:40 AM PT): main first: origin/main `fbd67cf` (new since the last log line: the health bot's state commits `196aadf` and `fbd67cf`, scripts/health only, and James's Forever Zoom page `b12af93`, outside /synth) ALL PASS (1465 checks); `scripts/test_synth_imported.py` ALL PASS; live /synth/ ready at 1366 and 375 px with no page or console errors and no failed requests, /synth/fm/ and /synth/acid/ no page errors (Hexode still scrolls sideways at 375 px, known since 15 Oct); live sw.js `dxedge-v170` matched main. The graphic EQ patch landed long ago (eqGains is on main), so step 3 was skipped. Built the next 0.2 item, the spring reverb (`b843849`): see its roadmap entry. Found and fixed during the build: a first cut made the worklet's URL at the top of rack.js, and rack.js is imported inside worklet scopes (heptode-dsp.js reaches it through patches.js), which have no URL, so Heptode's worklet stopped registering and every device hosted after it never attached; now the URL is made when the tank loads, with the check "Sp. rack.js and patches.js load inside a worklet scope". No factory patch changed and no existing sound changed (the spring is off by default; off is sample for sample a straight wire). Cache `dxedge-v171`. CPU (test 9, this box, noisy run to run): valve12 8 voices 20.9%; the same with the spring on at decay 6 s and drip 100% 22.7%; tape echo on 24.1%; 16 voices with ensemble 33.5%. Suite on the pushed tree: ALL PASS (1486 checks, Sp. 21 new). (Chromium 1194 is not on this box; the suite ran on chromium-1243 through `SYNTH_CHROMIUM`.) Listen: the spring itself, per Open items.
- 2026-11-01 (review, scheduled task, about 4:20 to 5:30 AM PT): areas c (the arpeggiator over MIDI with CC64 and bend, latched arp and Panic, computer keys with an octave shift, Space on a focused button), d (the new tape echo against Panic, patch and rail changes, both renders, feedback per repeat, the knobs at 375 px; the master bus against the echo) and e (a tempo-change and a format 0 .mid, play with a rail change, Panic, Render WAV by the button) on the live site at origin/main `e9e9244`, sw.js `dxedge-v168`. Findings: 1 broken (fixed), 3 confusing, 0 missing; re-measured and still open R1017-3, R1017-5, R1017-9, R1017-10, R1017-11, R1026-5, R1031-4. Fixed: R1101-1, Panic now empties the tape echo (the feedback and wet sides drop to 0 until the tape passes both heads; the dry path stays), with the check "Te. Panic empties the tape" (fails on the unfixed tree: -39 dB after the panic against -38 before). No patch sounds different. Left for James: R1101-2 (feedback runs hot), R1101-3 (the echo follows the lit device), R1101-4 (log knobs read 376ms for 375). Cache `dxedge-v169`. Suite on the pushed tree: ALL PASS (1465 checks). Commit: this one.
- 2026-11-01 (graphics, scheduled task, about 3:14 to 4:45 AM PT): main first: suite on origin/main `47f6e5e` ALL PASS (1454 checks). Screenshots at 1366x1000 (every rail device) and 375x667 (every device's phone tabs, 85 shots); no page errors, no sideways scroll. Built the top Graphics backlog item, desktop panel blanks and Pentagrid's dial (`5acabc3`): each panel row's empty columns now go to that row's cards (15 of 18 devices had an empty well at 1366 px, all 18 at 1024, 17 at 1920; none now), Heptode's Place field redraws at its new width (it was stretched), slider grids get a wider desktop gutter, and Pentagrid's dial bezel stays inside its window with a lamp glow behind the scale. Desktop only; phones unchanged. No audio change. sw `dxedge-v168`. Suite on the pushed tree ALL PASS (1464 checks, Pf. new). (Chromium 1194 is not on this box; the suite ran on chromium-1243 through `SYNTH_CHROMIUM`.)
- 2026-11-01 (check and debug, scheduled task, about 2:08 to 3:05 AM PT): reviewed 4 commits since 31 Oct 6 PM PT on origin/main `d8d9c9c`: the health bot's state commits `eb018e9` and `7eb509f` (scripts/health only) and, by Claude (the 12:28 AM nightly), the tape echo `26f1d68` and its log line `d8d9c9c`. No edit under `/otr`, no factory patch removed or renamed (no patch switches the echo on), no new third-party code or product names, no test lines removed (the only removed line in the suite is its docstring, rewritten to add Te.). Read the echo code for defects (wiring per mode, latency probe and fallback, idle unplug, live rewire under the dip, sync on tempo, schema clamps): none found. Suite on origin/main: ALL PASS (1454 checks, Te. 31 included); `scripts/test_synth_imported.py` ALL PASS (29). CPU (test 9) read higher than the nightly's on this box (Valve 12 29.4%, 16 voices 55.0%, tape echo on 27.3%); no audio code changed since that run, so read it as box load, not a regression. (Chromium 1194 is not on this box; the suite ran on /opt/google/chrome, Chrome for Testing 153, as did the live checks.) Live (`?v=d8d9c9c`): index.html, rack.js, engine.js, patches.js, cathode.js, drums.js, voice.worklet.js and sw.js match the repo byte for byte; sw.js `dxedge-v167` live and on main; /synth/ ready at 1366 and 375 px with no page or console errors and no failed requests, no sideways scroll at 375 px; every rack device sounds in an offline render (Filament, Cathode, Dekatron's Spark pattern, Resnatron's Cavity Saw, and the 15 others on defaults; RMS 0.008 to 0.25); /synth/fm/ and /synth/acid/ no errors, Hexode still scrolls sideways at 375 px (779 px, known, vendored). Defects: none. Fixes: none. Doc-only commit, so no cache bump.
- 2026-11-01 (nightly, scheduled task, about 11:55 PM 31 Oct to 1:55 AM PT): main first. origin/main `7eb509f` (since the last log line: the 31 Oct graphics, review and improvement runs `66bdf5c` to `0319b45`, and two health-bot state commits `eb018e9` `7eb509f`; read, nothing to undo). The suite on a clean origin/main: ALL PASS (1423 checks); `scripts/test_synth_imported.py` ALL PASS. Live: /synth/ ready with no page errors (only the known `api/stat` beacon abort), /synth/fm/ and /synth/acid/ no page errors, sw.js `dxedge-v166` live and on main. No bug, so the next 0.2 item: **tape echo** (`26f1d68`; details under the roadmap item). Off by default and in every factory patch, so nothing sounds different; listen to it with drive 7 to 10 and feedback near 100%, wow and flutter at 50% or more, and sync on while the tempo changes. Found while building it, measured: in Chromium a 2x WaveShaper delays by 128 frames and a feedback loop closes one render quantum late, and a loop entered at a tap off the filter put the other head 128 frames late; all three are handled (probe, offsets, per-mode wiring), and Te. checks each head and each pass to 1 ms. Also caught by the suite on my first tree: the new section showed on every device and pushed Pentagrid's dial off screen (Pg. dial drag failed); it now shows for Filament and Cathode only, like the EQ, with a check. New checks: Te. (31) and a test 9 line. Cache `dxedge-v167`. Suite on the pushed tree: ALL PASS (1454 checks); `scripts/test_synth_imported.py` ALL PASS. CPU (test 9, steady, on the pushed tree): Cathode 21.1%, Ladder 24 19.2%, Valve 12 20.4%, 16 voices with the ensemble 32.3%, Valve 12 with the tape echo on (ping-pong, wow and flutter) 19.4%; the run before the CSS fix read 16.2% without the echo and 21.1% with it, so the echo's cost is inside the run to run noise (a few points at most). (Chromium 1194 is not on this box; the suite ran on chromium-1243 through `SYNTH_CHROMIUM`.)
- 2026-10-31 (improvement, scheduled task, about 5:25 to 6:15 AM PT): test health, forced: main failed it. The suite on origin/main `fcd38ce` ran 1422 PASS and 1 FAIL, "Sc. scrolled part way, both edges show a cue" (the left cue at opacity 0.95, mid-fade after a fixed 250 ms wait); `scripts/test_synth_imported.py` on main ALL PASS. No review finding marked broken is open. Shipped: the Sc. steps wait for `data-more` and the strips' CSS transitions before measuring, and the tube show flare checks assert on what the show drew (`drawn`, `firedAt`, new test hook fields in `tubeshow.js`, nothing drawn changes) instead of a peak sampled from outside, with TV_PEAK waiting for the frame loop only when it is behind (the 31 Oct graphics run's "flare scales with velocity" flake). Measured in separate scripts, old against new: the Sc. step with the CPU throttled 4x failed 2 of 5 old, 0 of 5 new, 6x 4 of 10 old, 0 of 10 new; the flare checks with the frame loop slowed to one frame per 300 ms failed 3 (velocity), 8 (decay) and 1 (note-on) of 8 old, 0 new; unslowed 0 either way. Same assertions, no check removed, the reduced motion check stricter. No product or sound change. Cache `dxedge-v166`. Suite on the pushed tree: ALL PASS (1423 checks); `scripts/test_synth_imported.py` ALL PASS. CPU (test 9, steady, in the suite): Cathode 27.0%, Ladder 24 16.1%, Valve 12 15.7%, 16 voices 36.0% (no audio code changed; read these as noise against main's 22.5, 16.5, 16.9 and 33.3% tonight). (Chromium 1194 is not on this box; the suite ran on chromium-1243 through `SYNTH_CHROMIUM`.)
- 2026-10-31 (review, scheduled task, about 4:20 to 5:30 AM PT): areas a (the arpeggiator live and offline: panel, computer keys, latch, rail switch, transport, panic, the song library, mono, legato, unison, 4 octaves, gate and swing extremes; tempo-synced LFO 1 at every note value at 80 and 150 BPM) and b (every factory patch on all 18 devices, the arrows, save with the arp on, reload, an old patch with no arp, delete, undo) on the live site against origin/main `dae7ccf`. Findings: 1 broken (fixed), 1 missing, 2 confusing (1 fixed). Fixed: R1031-1, the master strip's Render WAV ignored the rack tempo (the arp stepped at 120 BPM at any tempo; `renderToWav` now takes `tempo`), and R1031-2, the patch arrows walked the factory list's order instead of the menu's. Left for James: R1031-3 (a patch change switches the arp off) and R1031-4 (a take records keys, not the arp). Cache `dxedge-v165`. New checks: "M. the master Render WAV steps the arpeggiator at the rack tempo", two "Pn." arrow checks (all three failed on the unfixed tree). Suite: ALL PASS (1423 checks).
- 2026-10-31 (graphics, scheduled task, about 3:14 to 4:20 AM PT): main first: suite on origin/main `236abd0` ran 1409 PASS and 1 FAIL, "Ar. the step follows the rack tempo ... a 1/16 triplet at 120 every 66.8 ms". Cause, measured: `arp_run` reads the level from an unpadded FFT, so a note still sounding at the end wraps onto time 0, and with the oscillator's random start phase the first bin read 0.12 to 0.52 of full level over 12 renders of the same input (0.5 counts as an edge); zero-padded it read under 0.16. A test bug, not a main defect, so the run went on and fixed it (test only). Screenshots at 1366x1000 and 375x667, every rail device and phone tab; no page errors, no sideways scroll. Shipped: the phone rail in the outboard tray's bay on brushed plates, a fade and chevron at whichever edge of the rail and the tray has more to scroll, and the rail scrolled to show the lit plate when a device is picked. Desktop rail and tray pixel-identical on all 18 devices. Panel 4 px lower on a phone (47 px above the keybed). Cache `dxedge-v164`. No audio change. New checks: Sc. (9). Also seen: "Tv. the flare scales with velocity" failed once on this tree late in a suite run (sampled peak 0.00; the show's own record had 0.30) and passed the next two runs; 8 standalone tries on main and on this tree sampled 0.19 to 0.24 every time, so it is the wall-clock sample, still a condition in that check, left for the test-health job. Suite on the pushed tree ALL PASS (1419). Commit `66bdf5c` and this one.
- 2026-10-31 (check and debug, scheduled task, about 2:08 to 2:40 AM PT): reviewed 3 commits since 30 Oct 6 PM PT on origin/main `38114bb`: the health bot's state commits `40c83ec` and `ff70365` (scripts/health only) and, by Claude (the 12:28 AM nightly, pushed 1:12 AM PT), the arpeggiator `38114bb`. No edit under `/otr`, no factory patch removed or renamed (Horror Pad and Ghost Choir keep their names; only their stereo width moved, already listed for James), no new third-party code or product names, no test lines removed: test 7 now takes the worse of two renders per patch with the same 3 dB limit, so it is stricter, not looser. Suite on origin/main: ALL PASS (1410 checks, Ar. section included; Horror Pad folds 2.2 dB, Ghost Choir 2.4); `scripts/test_synth_imported.py` ALL PASS (29). (Chromium 1194 is not on this box; the suite ran on /opt/google/chrome, Chrome for Testing 153, and the live checks on chromium-1243.) Live (`?v=38114bb`): index.html, voice.worklet.js, patches.js, device.js and sw.js match the repo byte for byte; sw.js `dxedge-v163` live and on main; /synth/ ready at 1366 and 375 px with no page or console errors (only the known `api/stat` beacon abort), no sideways scroll at 375 px; all 18 rail devices sound in an offline render on their default patches (peaks 0.20 to 0.52, all finite); /synth/fm/ and /synth/acid/ no errors, Hexode still scrolls sideways at 375 px (779 px, known, vendored). Defects: none. Fixes: none. Doc-only commit, so no cache bump.
- 2026-10-31 (nightly, scheduled task, about 12:20 to 1:20 AM PT): main first. origin/main `ff70365` (since the last log line: the 30 Oct improvement run `caff068` and two health-bot state commits `40c83ec` `ff70365`; nothing else under /synth). The suite on a clean origin/main: 1383 PASS, 1 FAIL, "7. mono fold: Horror Pad loses 3.1 dB folded to mono (limit 3)". `scripts/test_synth_imported.py` on main ALL PASS (29). Live: /synth/ ready with no page errors and no failed requests, /synth/fm/ and /synth/acid/ no page errors, sw.js `dxedge-v162` live and on main. (Chromium 1194 is not on this box; the suite ran on chromium-1243 through `SYNTH_CHROMIUM`.) The failure, measured on main: Horror Pad's fold is 2.5 to 2.9 dB over 16 renders (mean 2.6), so one render with unlucky random phases crosses 3; Ghost Choir read 2.3 to 3.0 over 10, the same problem not yet seen in the suite. Not a code defect: two wide Halloween pads sat at the limit. Fixed by retuning both (stereo width only: Horror Pad 130 to 115, Ghost Choir 140 to 120; now 1.9 to 2.4 and 1.8 to 2.3 dB), and test 7 now takes the worse of two renders per factory patch, which tightens it (a patch has to hold its margin twice). Listen to both. The graphic EQ is on main, so no patch to land. Notes from James has nothing newer and the '73-style monosynth still has no name, so the next unchecked 0.2 item: the arpeggiator, Filament (see its entry above). Nothing you already have sounds different except the two retuned pads: no factory patch turns the arp on, and the seeded Node bench says all 32 earlier cases are bit-identical to origin/main (new case `arp`). New checks: test section Ar. (24) and a phone check at each of two widths; test 7 now renders each patch twice. Cache `dxedge-v163`. Suite on this tree: ALL PASS (1410 checks); `scripts/test_synth_imported.py` ALL PASS (29). This line was written after that run; the suite does not read this file. CPU (test 9, steady, in the suite): Cathode 22.3%; Filament 8 voices Ladder 24 16.8%, Valve 12 15.9%, Diode 18 22.2%, Sallen-Key 12 19.0%, Poly 24 18.5%, SVF 12 14.5%, low pass gate 16.7%; stereo offset 16.4%; filter B serial 15.6%, parallel 23.9%, split 24.4%; 16 voices with ensemble 35.6%; mod matrix 21.4%; EQ at 31 bands 22.6%. The arp adds a few operations per step and none per sample.
- 2026-10-30 (improvement, scheduled task, about 5:55 to 7:05 AM PT): code health, the parameter types. Main first: the suite on origin/main `33a9ee4` ran 1381 PASS and 2 FAIL, both caused by this run (I edited the served device files while that run was going, and the two Gy./Fr. checks still asserted the old `seed` type); no other check failed, and the 4 AM review had ALL PASS (1383) on the same tree. No review finding marked broken is open. CPU not attempted: a Node profile of Valve 12 at 20 s (`render` 46%, `valve` 23%, `process` 10%, `step` 10%) shows the same picture as the 27 Oct line profile, no bit-exact hot spot. Shipped: `parameterTable()` takes an explicit list of whole-number paths per device instead of guessing from the numbers (details in the Improvement backlog). Measured in Node over all 18 devices' tables: 106 rows changed type and nothing else; `int` rows 121 to 49 (Filament 50 to 9, Cathode 25 to 3, Thyratron 10 to 2); Pentagrid `wpm` and every seed are int now. No patch, knob or sound changes (nothing reads the type for rounding). One new check (R. parameter tables), two adapter checks corrected from float to int. Cache `dxedge-v162`. Suite on the pushed tree: first run 1383 of 1384, "S. goniometer draws the stereo image" read 44 lit pixels against more than 50 (main read 147, the rerun 105; a live wall-clock check this change does not touch, not seen failing before, logged here as a watch item); second run ALL PASS (1384); `scripts/test_synth_imported.py` ALL PASS (29). Test 9 read high tonight with no voice code changed: Cathode 17.4%, Ladder 24 34.1%, Valve 12 33.5%, 16 voices 77.0%, mod matrix 40.1%. Commit: this one.
- 2026-10-30 (review, scheduled task, about 4:20 to 6:00 AM PT): areas f (project save, load, download and upload with the LFO sync, mod matrix and Filter B fields; an old project without them; the song library routed to every device, switching, loop, tempo, stop), g (Hexode and Anode at both sizes) and h (names, a full Tab walk with focus rings, the size switch, the Mod tab, reduced motion) on the live site against origin/main `07c6a4e`. Findings: 2 broken (both fixed), 0 missing, 4 confusing. Fixed in `ceb3482`: library channels routed to Lattice, Mote, Klystron, Rhumbatron, Gyrotron, Orthicon, Pentagrid, Geissler or Resnatron were silent off the rail (R1030-1), and Dekatron's pattern stopped following the transport after a song with drum hits (R1030-2); two P. checks, sw.js `dxedge-v161`. Suite ALL PASS (1383 checks).
- 2026-10-30 (graphics, scheduled task, about 3:14 to 4:05 AM PT): main first: suite on origin/main `a00616d` ALL PASS (1370). Screenshots at 1366x1000 and 375x667, every rail device and phone tab; no page errors, no sideways scroll. Shipped: the phone header in three rows, not four (250 to 200 px at 375 px; the lit panel now shows 51 px above the keybed, was 1 px), the size keys joined into one recessed switch (desktop too), a running take's time over the rec key on a phone, the tip link 44 px tall on a phone. Graphics backlog re-ranked. Cache `dxedge-v160`. No audio change. New checks: Hd. (10). Suite on the pushed tree ALL PASS (1380). Commit `fe88405` and this one.
- 2026-10-30 (nightly, scheduled task, about 12:05 to 1:50 AM PT): main first. origin/main `32e306b` (since the last log line, the 29 Oct review `27dfc06`: two DXEdge commits outside /synth, `eda55f9` (a product link and the health state) and `32e306b` (the health state); nothing under /synth changed). The suite on main: ALL PASS (1355 checks); `scripts/test_synth_imported.py` ALL PASS (29). Live: /synth/ ready with no page errors and no failed requests, /synth/fm/ and /synth/acid/ no page errors, sw.js `dxedge-v158` live and on main. Defects: none. (The Chromium path in the task prompt, chromium-1194, is not on this box; the suite ran on chromium-1243 through `SYNTH_CHROMIUM`.) The graphic EQ is on main, so no patch to land. Notes from James has nothing newer and the '73-style monosynth still has no name, so the next unchecked 0.2 item: the host clock, as tempo-synced LFOs (see its entry above). New: `lfo1.sync` and `lfo2.sync`, the engine's clock message, the worklet's clock and synced phase, a sync menu and readout in each LFO section, the deck's Render WAV passing the rack tempo, an `lfosync` case in the Node bench. Nothing you already have sounds different: no factory patch uses sync, and the seeded Node bench says every earlier case is bit-identical to origin/main (all 31 on the first build; the 23 Filament cases again on the final tree; Cathode's code did not change). New checks: test section Ls. (13) and a phone check at each of two widths. Cache `dxedge-v159`. Suite: ALL PASS (1370 checks). CPU (test 9, steady, in the suite): Cathode 23.0%; Filament 8 voices Ladder 24 26.9%, Valve 12 22.5%, Diode 18 18.3%, Sallen-Key 12 22.2%, Poly 24 22.5%, SVF 12 18.8%, low pass gate 18.3%; stereo offset 23.2%; filter B serial 26.2%, parallel 25.1%, split 31.5%; 16 voices with ensemble 34.1%; mod matrix 8 slots 28.2%; EQ 31 bands 27.7% (higher than last night across the board, including paths this change cannot reach with sync off; read as box load, not a regression: the Node bench shows the same output and no consistent CPU change). Commit: this one and the feature commit before it. To listen for: nothing changed; try LFO 1 at 1/8 on tremolo or cutoff with the song library playing.
- 2026-10-29 (review, scheduled task, about 4:30 to 5:30 AM PT): areas c (the mod matrix from the wheel, pressure and bend over MIDI, wheel and bend across device switches, phone strips), d (master compressor, delay and reverb measured against their knobs, mixer pan, tempo, meters, master volume) and e (take, export, import, loop and Render WAV with the wheel moving) on the live site at origin/main `c319d6d`, sw.js `dxedge-v157`. Findings: 2 broken (both fixed), 2 confusing, 0 missing; R1017-3, R1017-5, R1017-8, R1017-10, R1017-11, R1023-3 and R1026-5 re-measured and still open. Fixes: R1029-1, an exported take now ends where Stop was pressed (`writeSMF` takes a length), so the file loops like the take (live: a 1.37 s take exported as 0.62 s); R1029-2, pressure held when a take starts is written at its start. Two new M. checks, both failing on the unfixed tree (measured). Cache `dxedge-v158`. Suite: ALL PASS on this tree (count in the commit message). Commit: this one.
- 2026-10-29 (graphics, scheduled task, about 3:15 to 4:45 AM PT): main first: suite on origin/main `b105b25` ALL PASS (1343). Screenshots at 1366x1000 and 375x667, every rail device and phone tab; no page errors, no sideways scroll. Shipped: empty states for Heptode's roll and Gleam's field, and a fix for Heptode's roll on a desktop (the canvas had no CSS height, stood 592 px tall in a 148 px window, and hid a loaded song's notes). Graphics backlog re-ranked; new item for desktop panel blanks and Pentagrid's dial clipping. Cache `dxedge-v157`. No audio change. Suite on the pushed tree ALL PASS (1353, 10 new checks under G. and H.); this line was added after that run and the suite does not read this file.
- 2026-10-29 (check and debug, scheduled task, about 2:08 to 2:35 AM PT): reviewed 3 commits since 28 Oct 6 PM PT on origin/main `c4e4c1d`: the health bot's state commit `2899d06` (scripts/health only) and, by Claude (the 12:28 AM nightly), the Lg. two-period window `0892374` (same condition and 5 ms bound, measured reason in the commit, so not a loosening) and the mod matrix `c4e4c1d`. No edit under `/otr`, no factory patch removed or renamed, no test lines removed, no new third-party code or product names. Suite on origin/main: ALL PASS (1343 checks, Mm. section included); `scripts/test_synth_imported.py` ALL PASS (29). Live at 1366 and 375 px: /synth/ ready with no page or console errors (only the known `api/stat` beacon abort), no sideways scroll at 375 px; all 18 rail devices sound in an offline render (Resnatron on its factory Cavity Saw; its default bay has no cables and is silent by design); /synth/fm/ and /synth/acid/ no errors, Hexode still scrolls sideways at 375 px (known, vendored); sw.js `dxedge-v156` live and on main; index.html, voice.worklet.js and patches.js live match the repo. Defects: none. Fixes: none. Noted, not a defect: a slot switched to Random while a note is held reads 0 for that note until the next note-on (the value is drawn at trigger only when a slot already uses it).
- 2026-10-29 (nightly, scheduled task, run from about 11:55 PM PT on 28 Oct to about 1:45 AM): main first. origin/main `2899d06` (since the last log line: the 28 Oct review fix `745c9f0`, the improvement job's test 9 change `5068d52`, and the health bot's state commit; none changed the audio path). Live: /synth/ ready with no page errors and no failed requests, /synth/fm/ and /synth/acid/ no page errors, sw.js `dxedge-v155` live and on main. `scripts/test_synth_imported.py` on main: ALL PASS. The suite on main: 1 of 1323 failed, "Lg. filter only: the level follows the envelope" (lp 34.9 ms against SVF 12 29.4 ms, bound 5). Measured on main: over 11 renders the difference ran -4.1 to +5.5 ms with the oscillator's random start phase (a 10 ms envelope window leaves the saw's ripple in); read through a window of two periods of the note it ran -0.5 to +3.0 over 10. The check now reads those two times through that window, same condition and bound (`0892374`). Not a defect in the low pass gate. Then the roadmap: Notes from James has nothing newer, the '73-style monosynth still has no name, so the next unchecked 0.2 item: the mod matrix, first slice (see its entry above). New: patch object `mod` (`s1` to `s8`), the matrix in `voice.worklet.js` (control rate, no allocation in the sample loop; V1 drive's make-up table is built with the patch), the Mod matrix section on the Mod tab, a `matrix` case in the Node bench. Nothing you already have sounds different: no factory patch uses the matrix, and the seeded Node bench says all 30 earlier cases are bit-identical to origin/main. Cost: in the Node bench the `matrix` case (all 8 slots on, 8 voices on Valve 12) costs about 25% more than the same patch with no slots (17.3% against 21.7% of real time); test 9 below has it at 20.4% against 17.6%. New checks: test section Mm. (18) and a phone check at each of two widths. Cache `dxedge-v156`. Suite: ALL PASS (1343 checks). CPU (test 9, steady, in the suite): Cathode 16.8%; Filament 8 voices Ladder 24 23.5%, Valve 12 17.6%, Diode 18 19.1%, Sallen-Key 12 18.1%, Poly 24 19.9%, SVF 12 13.7%, low pass gate 11.4%; stereo offset 29.3%; filter B serial 23.0%, parallel 24.7%, split 22.0%; 16 voices with ensemble 30.6%; mod matrix 8 slots 20.4%; EQ 31 bands 23.6%. Commit: this one. Nothing to listen for: no patch changed.
- 2026-10-28 (improvement, scheduled task, about 5:30 to 6:40 AM PT): test health, test 9. Main first: suite on origin/main `30005a4` ALL PASS (1320 checks), `scripts/test_synth_imported.py` ALL PASS (29). No review finding marked broken is open. CPU not attempted: the 27 Oct line profile found no bit-exact hot spot left in the Filament voice, and the remaining candidates change low bits (a tolerance call). Shipped: test 9's CPU lines are a steady cost read in a page of their own (12 s render minus 2 s, each the faster of two, live audio in both pages suspended, one throwaway render first); the Cathode line joins them; the EQ line no longer times the room the normalizer put back. Measured in a fresh browser, 3 rounds, old 6 s figure against new: Ladder 24 21.8 to 56.0% against 13.4 to 16.1%, low pass gate 16.9 to 25.4% against 11.0 to 11.7%, Cathode 14.7 to 20.6% against 11.8 to 13.1%; a second page with live audio running raised the figure by about half. In the suite it still reads above a separate browser (details in the Improvement backlog). Test 9 costs about 1.5 min more. No served file changed (scripts and docs only), so no cache bump. One new check. Suite on the rebased tree (origin/main `745c9f0`): ALL PASS (1323 checks). CPU (test 9, new method, steady, in the suite): Cathode 20.3%; Filament 8 voices Ladder 24 20.8%, Valve 12 17.7%, Diode 18 22.7%, Sallen-Key 12 22.5%, Poly 24 20.1%, SVF 12 13.1%, low pass gate 21.1%; stereo offset 22.1%; filter B serial 25.2%, parallel 23.1%, split 23.5%; 16 voices with ensemble 29.2%; EQ 31 bands 25.6%. Commit: this one.
- 2026-10-28 (review, scheduled task, about 4:25 to 5:30 AM PT): areas a (Filter B on every route and model, the low pass gate and Hollow Pluck, and every panel control on Klystron, Resnatron, Gyrotron and Pentagrid) and b (Filter B in user patches, reload, undo, project, factory reload), live at 1366 and 375 px against origin/main `30005a4`. Findings: 0 broken, 0 missing, 4 confusing (1 fixed); 2 earlier findings re-measured and still open; details in `docs/filament-review.md`. Fixes: the filter plot readout no longer calls a flat parallel sum a "peak at 20Hz" (it reads "passband +3.0 dB", R1028-1), and an emptied rack tempo box keeps the tempo instead of setting 40 BPM (R1026-6). Two new checks. Cache `dxedge-v155`. Suite: ALL PASS on the pushed tree (count in the commit message).
- 2026-10-28 (check and debug, scheduled task, about 2:10 to 3:30 AM PT): reviewed 2 commits since 27 Oct 6 PM PT on origin/main `8f9f07a`: the health bot's state commit `0671ea3` (scripts/health only) and, by Claude (the 12:28 AM nightly, pushed 2:00 AM PT), the filter response plot `8f9f07a`. No edit under `/otr`, no factory patch removed or renamed, no new third-party code or product names in UI text. Two checks changed from fixed waits to polling (the stuck-keys quiet check, up to 1.5 s with a 90 ms step; the Tv. Ladder 24 V2 check, up to 2 s); both keep the same condition and the commit gives measured reasons, so not a loosening. Audio path: `voice.worklet.js` only records `fcA`/`fcB` per voice and adds `fresp()`, which the audio thread never calls. Suite on origin/main: ALL PASS (1320 checks, 11 in the new Fp. section; 1308 on `0671ea3` before the nightly landed); `scripts/test_synth_imported.py` ALL PASS (29). Live (`?v=8f9f07a`): filtplot.js, its worker, voice.worklet.js and index.html match the repo byte for byte; /synth/ ready at 1366 and 375 px with no page or console errors (only the known `api/stat` beacon abort), no sideways scroll at 375 px, the response plot paints; Filament, Cathode and Dekatron sound in an offline render (peaks 0.45, 0.52, 0.39, all finite); /synth/fm/ and /synth/acid/ no errors, Hexode still scrolls sideways at 375 px (known, vendored); sw.js `dxedge-v154` live and on main. No defects, no fixes. Doc-only commit, so no cache bump.
- 2026-10-28 (nightly, scheduled task, run about 12:35 to 3 AM PT): main first. origin/main `0671ea3` (since the last log line: Cursor Agent's Hearthvault redeploys at /crawl/ `6748ee4` `9f3d014` `810413b` and the health bot's state commit; none touch /synth). Live: /synth/ ready with no page errors and no failed requests, /synth/fm/ and /synth/acid/ no page errors, sw.js `dxedge-v153` live and on main. `scripts/test_synth_imported.py` on main: ALL PASS (29). The suite on main, run while I was also loading test pages on the same two cores, failed one check and then stopped: "releasing the key after Ctrl lets go" read note 53 still in the Filament meter 90 ms after the keyup (the page had let go: no key down, no key lit), and the Dk. section's click on the deck's stop button timed out after 30 s, which ended the run at check 835 of about 1300. The first is a wall-clock race in the check, measured: on origin/main with the page idle, 12 keyups took 28 to 235 ms to reach a meter without the note, against the check's fixed 90 ms. `quiet()` in the stuck-keys checks now waits up to 1.5 s for the released state (a stuck note never clears, so it still fails). The second did not happen on the two quiet full runs below (inference: load on the box, not a defect; left as it is and noted here). Then the roadmap: the graphic EQ landed on 16 Oct and the tube show's first slice on 16 Oct, Notes from James has nothing newer, and the '73-style monosynth still has no name, so the next unchecked 0.2 item: the live filter response plot (see its entry above). New: `filtplot.js` and `filtplot.worker.js`; `fresp()` and `frun()` in `voice.worklet.js` (not called on the audio thread), the newest voice's cutoffs in the Filament meter (`fcA`, `fcB`), the plot and readout in the Filter section, `__synth.filterPlot`, `filterPlotAt`, `filterRespOf`. Nothing you already have sounds different: the seeded Node bench says every Filament and Cathode case is bit-identical to origin/main. New checks: test section Fp. (10) and a phone check at each of two widths. Cache `dxedge-v154`. Suite: ALL PASS (1320 checks) on the build, where the plot still computed on the main thread. The second full run then failed two checks: "Tv. on Ladder 24, V2 is out of the path and shows nothing" and the new Fp. envelope check. The Fp. one was my check (it read the live cutoff at 1 s, when the envelope is already back near 400 Hz; it now takes the highest cutoff seen while the note is held). The Tv. one is a wall-clock race the new section exposed, measured (6 tries each, headless): V2's glow needs 340 to 400 ms to fall under 0.05 on origin/main and 425 to 567 ms with just one more line of text in the Filter section (a plain div, no script), against the check's fixed 500 ms; the glow eases on the show's clock, which only moves when the frame loop runs. It now waits for the glow to go, up to 2 s. The plot's compute also moved to a worker. Same count, ALL PASS (1320 checks) on the pushed tree. Plot cost: 0.3 to 1.6 ms a curve, 5 to 9 ms in the slow case, 0.1 to 0.6 ms a frame to draw. CPU (test 9, headless, the build run, wall clock on this box; read high inside the suite, as noted on 27 Oct, and the audio path is unchanged): Cathode 25.7%; Filament 8 voices Ladder 24 48.6%, Valve 12 43.7%, Diode 18 47.0%, Sallen-Key 12 46.7%, Poly 24 42.9%, SVF 12 38.1%, low pass gate 45.4%; stereo offset 51.1%; filter B serial 54.5%, parallel 54.4%, split 64.7%; 16 voices with ensemble 71.3%; EQ 31 bands 51.2%. Look at: the plot in the Filter section with a note held, on a phone too (see Open items). Commit: this one.
- 2026-10-27 (improvement, scheduled task, about 5:25 to 6:15 AM PT): test health. Main first: suite on origin/main `a53fa42` ALL PASS (1308 checks), `scripts/test_synth_imported.py` ALL PASS (29). No review finding marked broken is open. CPU looked at first and nothing shipped: a line profile shows no single bit-exact hot spot left in the Filament voice, and a Cathode allocation fix (boxed doubles at `exp2`, 6.3 to 0.14 MB/s in Node, output identical) did not change CPU in Node or Chrome and Chrome inlines that call anyway, so it was reverted (both in the Improvement backlog). Shipped: the tube show checks that still read a flare sampled from outside every 8 ms ("Tv. Cathode: a note flares its tubes", which failed twice on 26 Oct, and "Tv. subtle") now assert on the show's own record, with a new per-tube flare count (`fires` in `__synth.tubeShow()`, test hook only) so a check knows the flare came from its own note. Measured with the CPU throttled 8x: old condition failed 1 of 10 runs (sampled peak 0.24 against 0.3, the show recorded 0.9), new condition 0 of 10. No audio or visual change. Also logged: test 9 inside the suite read up to 2x a fresh page tonight (split B 57.9% against 26 to 28%). Cache `dxedge-v151`. Suite: ALL PASS (1308 checks, the same count: no check added or removed, five tightened). CPU (test 9, the build run): Cathode 21.0%; Filament 8 voices Ladder 24 30.6%, Valve 12 22.5%, Diode 18 23.8%, Sallen-Key 12 27.6%, Poly 24 24.9%, SVF 12 25.2%, low pass gate 24.9%; stereo offset 35.0%; filter B serial 34.9%, parallel 31.2%, split 29.0%; 16 voices with ensemble 34.6%; EQ 31 bands 32.3%. Commit: this one.
- 2026-10-27 (review, scheduled task, about 4:25 to 5:30 AM PT): areas f (project and mix save and load, song library), g (Hexode, Anode) and h (accessibility, with the new desktop rail and outboard tray), live at 1366 and 375 px against origin/main `cb10caa`. Findings: 1 broken (fixed), 0 missing, 1 confusing; 5 earlier findings re-measured and still open; details in `docs/filament-review.md`. Fix: save project and save mix in the seconds before the boot finishes now keep the saved arms and desk bus instead of writing none and the default (R1027-1). One new check. Cache `dxedge-v150`. Suite: ALL PASS on the pushed tree (count in the commit message).
- 2026-10-27 (graphics, scheduled task, about 3:15 to 4:30 AM PT): the desktop rail. On origin/main `841a6ec` the suite was ALL PASS (1293). The 18 device buttons now sit on even brushed module plates in a recessed bay with an upright engraved RACK plate: two rows of nine from 1340 px, three rows of six below, names only under 960 px; the phone strip is unchanged. Measured at 1366 px: rows 5, 6, 5, 2 before, 9 and 9 after; rail 170 to 105 px tall; plates 134x44; chassis 409 to 352 px. New Rl. section (14 checks: grid at 800, 1024, 1366 and 1920 px, no clipped text, contrast 6.9:1 names and 5.7:1 roles, hover, lit plate, reduced motion, phone strip, no page errors). Cache `dxedge-v149`. Suite: ALL PASS (1307). No audio or DSP change.
- 2026-10-27 (check and debug, scheduled task, about 2:10 to 2:30 AM PT): reviewed 2 commits since 26 Oct 6 PM PT on origin/main `48d46c6`: the health bot's state commit `63ebb64` (scripts/health only) and, by Claude (the 12:28 AM nightly), filter slot B `48d46c6`. No edit under `/otr`, no test removed or loosened (the diff only adds checks), no factory patch removed or renamed, no new third-party code or product names; patches without `filtB` normalize to B off. Suite on origin/main: ALL PASS (1293 checks, 24 in the new Fb. section); `scripts/test_synth_imported.py` ALL PASS (29). Live: /synth/ ready at 1366 and 375 px with no page or console errors (only the known `api/stat` beacon abort), no sideways scroll at 375 px; Filament, Cathode and Dekatron sound in an offline render (RMS 0.072, 0.143, 0.080); /synth/fm/ and /synth/acid/ no errors, Hexode still scrolls sideways at 375 px (known, vendored); sw.js `dxedge-v148` live and on main. No defects, no fixes. One doc nit, not changed: the Filter B notes say the tube show follows A only, but the V2 meter also adds B's loop when B is Valve 12.
- 2026-10-27 (nightly, scheduled task, run about 12:30 to 2:30 AM PT): main first. origin/main `63ebb64` (since the last log line: the 26 Oct improvement `f8211e3` and the health bot's state commit; read both). Suite on a clean origin/main: ALL PASS (1267 checks); `scripts/test_synth_imported.py` ALL PASS (29). Live: /synth/ ready with no page errors and no failed requests, /synth/fm/ and /synth/acid/ no page errors, sw.js `dxedge-v147` live and on main. Nothing broken, so the roadmap: the graphic EQ landed on 16 Oct and the tube show's first slice on 16 Oct, and Notes from James has nothing newer, so the next unchecked 0.2 item, dual filter slots A and B with serial, parallel and split routing (first slice; see its entry above). New: `filtB` in `patches.js` (schema stays v:1), slot B in `voice.worklet.js` (two more filters per voice, run only when B is on; `fcoef` takes the Sallen-Key high-pass as an argument so B gets none), the Filter B section on the Filter tab in `index.html`, three bench cases, and test section Fb. (24 checks) plus two phone checks and three test 9 lines. Nothing you already have sounds different: B is off in every patch, and the seeded Node bench says the output is bit-identical to origin/main on all 27 earlier cases (Filament and Cathode). Node bench, B's cost (best of 3, noisy by about 2 points): serial with B on SVF 12 behind Ladder 24 16.1 to 20.3%; parallel with a stereo offset (four filters a voice, Valve 12 and Poly 24) 17.9 to 27.2%; split (Sallen-Key 12 left, Diode 18 right) 17.5 to 19.8%. Cache `dxedge-v148`. Suite: ALL PASS (1293 checks). CPU (test 9, headless, the build run; wall clock on a busy box, main's run tonight in brackets): Cathode 20.5% (18.1); Filament 8 voices Ladder 24 40.2% (33.0), Valve 12 31.5% (22.7), Diode 18 30.9% (25.8), Sallen-Key 12 28.4% (28.3), Poly 24 26.9% (26.2), SVF 12 22.8% (25.5), low pass gate 29.1% (23.8); stereo offset 31.2% (28.0); 16 voices with ensemble 40.5% (57.0); EQ 31 bands 38.9% (77.7). The three new filter B lines are in the final run's output. Listen: Filter B in each route (see Open items). Commit: this one.
- 2026-10-26 (improvement, scheduled task, about 5:28 to 6:40 AM PT): CPU, the Filament voice. Main first: suite on origin/main `0612588` ALL PASS (1265 checks), `scripts/test_synth_imported.py` ALL PASS. No review finding marked broken is open, so CPU. A line profile of test 9's Valve 12 case showed the filter envelope's sustain line at 7% of the worklet's samples: at a sustain of 0 the envelope sinks below the smallest normal double after about 1.5 s and stays there, and subnormal arithmetic runs 19x slower in a headless Chrome AudioWorklet (measured; nothing flushes it). Both envelopes and the output DC blocker now stop at exactly 0 below `ENV_FLOOR` (1e-150). Sound unchanged: output equal sample for sample on all 27 bench cases at 6 s and 40 s (two 40 s cases wrote -0 where they now write +0). Chrome, rack included, marginal cost, median of 4: Valve 12 26.4 to 18.6%, Ladder 24 26.6 to 18.5%, low pass gate 23.5 to 15.0%, a held pluck chord at sustain 0 97.7 to 23.3%. Bench: `--subnormals`, `--seconds`, a `pluck` case. Found, not changed: the same in Cathode's first DC blocker, where a fix changes when the noise seed fires (backlog). Rebased onto the 26 Oct review `1881d30`; cache `dxedge-v147`. Suite: ALL PASS (1267 checks; one earlier run on the pre-rebase tree failed only the Tv. Cathode flare check, a wall-clock flake, backlog). `scripts/test_synth_imported.py`: ALL PASS. CPU (test 9, headless; main earlier tonight in brackets): Cathode 18.1% (16.7); Filament 8 voices Ladder 24 27.3% (26.0), Valve 12 22.7% (23.2), Diode 18 22.5% (28.6), Sallen-Key 12 23.4% (25.9), Poly 24 23.1% (32.1), SVF 12 20.4% (24.6), low pass gate 19.8% (24.2); stereo offset 20.7% (28.6); 16 voices with ensemble 33.3% (40.5); EQ 31 bands 30.0% (36.2). Test 9 still times whole 6 s renders, so its fixed setup blurs these; the marginal figures above are the measurement. This line was added after that suite run (docs only; the suite does not read this file). Commit: this one.
- 2026-10-26 (review, scheduled task, about 4:25 to 6:00 AM PT): areas c (keys, computer keys, pedal, octave, strips, MIDI), d (mixer, master clock, master bus) and e (MIDI deck), live at 1366 and 375 px against origin/main `0612588`. Findings: 2 broken (both fixed), 0 missing, 5 confusing; 5 earlier findings re-measured and still open; details in `docs/filament-review.md`. Fixes: the master limiter (the safety limit and the compressor's limit) is now a true peak limiter, where it used to let waveform peaks out up to 7 dB over its ceiling (R1026-1); Stop with the pedal down now ends the take with a pedal-up, so an exported .mid does not leave CC 64 held (R1026-2). Two new checks. The new Ob. hover check read a CSS transition at a fixed 250 ms and failed on every quiet run here; it now waits for the style and asserts the same thing. Cache `dxedge-v146`. Suite: ALL PASS (1267 checks). Commit: this one.
- 2026-10-26 (graphics, scheduled task, about 3:15 to 3:45 AM PT): main first: suite on origin/main `8966bfd` ALL PASS (1255 checks). Screenshots at 1366x1000 (every rail device) and 375x667 (every device's phone tabs, 85 shots); no page errors, no horizontal scroll. Built the top Graphics backlog item, the outboard links: a recessed tray under the rail with an engraved OUTBOARD plate, each link a warm brushed plate with a cable socket instead of a lamp and an amber opens-a-page arrow; hover and keyboard focus light the socket ring; reduced motion drops the transitions and the arrow nudge; titles on each link and the tray is a named group. Measured: text contrast 5.8:1 or more (the old descriptions were 4.2:1), one row at 1366 px, 44 px targets and no sideways scroll at 375 px; the chassis moves down 17 px on a desktop and 7 px on a phone. CSS and markup only, no script or audio change. Added one backlog item (phone tray scroll cue). 10 new Ob. checks (6 fail on the old tree, measured). Cache `dxedge-v145`. Suite: ALL PASS (1265 checks). Commit: the graphics commit of 26 Oct.
- 2026-10-26 (check and debug, scheduled task, about 2:10 to 3:00 AM PT): reviewed 3 commits since 25 Oct 6 PM PT on origin/main `38a1521`: the health bot's state commit `37175c4` (scripts/health only); by Claude (the 12:28 AM nightly) the low pass gate and Hollow Pluck `6d18dae` and the Pentagrid blanker fix `38a1521`. No edit under `/otr`, no test removed, no factory patch removed or renamed (Hollow Pluck retuned, logged for James), no new third-party code. The one loosened check (library playback waits up to 3 s for its note instead of a fixed 350 ms) is sound. `38a1521` did not bump the cache; the worker fetches with `cache: 'reload'` and the live files matched main, so no harm. Suite on origin/main ALL PASS (1254 checks), `scripts/test_synth_imported.py` ALL PASS (29). Live: /synth/ ready at 1366 and 375 px with no page or console errors and no horizontal scroll (only the `/api/stat` beacon aborts, as before), all 18 rail devices sound on a held note, /synth/fm/ and /synth/acid/ no errors, Hexode still scrolls sideways at 375 px (known, vendored), sw.js `dxedge-v143` matched. Defect: the LP gate's lag knob title and filter note named the vactrol, a registered trademark (licensing rule 6), and one check required the word. Fixed: both strings now say light cell; that check now wants "light cell" and no trademark; new licensing check scans every quoted string in the rack's own /synth files for a list of product names (fails on the old index.html; Wide Novachord Strings allowed until James rules). Internal names (`juno` keys in `rack.js`, comments, test names) left alone. Cache `dxedge-v144`. Suite: ALL PASS (1255 checks), imported ALL PASS (29). Commit: the check-and-debug commit of 26 Oct.
- 2026-10-26 (nightly, scheduled task, run about 12:00 to 2:00 AM PT): main first. origin/main `37175c4` (since the 25 Oct nightly: the recorder timing check `2e7cea1`, the 25 Oct check-and-debug log `74095d7`, the MIDI deck and song library faceplates `4fe33df`, the 25 Oct review fixes `03ce826`, the idle rack stages unplugged `966ee63`, and the health bot's state commit; read through their log lines and diffs, none of them conflict with tonight's files). Suite on a clean origin/main: 2 FAILED of 1223, both Pentagrid reading silence on the main test page ("M. pentagrid: recorded ... matches live" and "a generator's notes ending on Pentagrid ..."). It came back on a quiet run of the build (2 of 5 full runs failed); a message log showed Pentagrid active with the note held but its output at 0. Cause: the noise blanker's window only counted down while the air was on, so a window open when the air went off silenced Pentagrid until reload (see the Improvement backlog, 26 Oct). Fixed in `pentagrid-dsp.js`, with a check that fails on the old code; no Pentagrid sound changes with the air on. `scripts/test_synth_imported.py` ALL PASS (29). Live: /synth/ ready with no page errors (the only failed request the `/api/stat` beacon aborted on close), /synth/fm/ and /synth/acid/ no page errors, sw.js `dxedge-v142` live and on main. Fixed in the suite: "library playback is holding its note" failed once on the build run with a fixed 350 ms wait (the note reaches the meter 20 to 80 ms after play on a quiet page, measured); it now waits up to 3 s for the note and prints how long it took. Roadmap: the next unchecked 0.2 item, the Low pass gate, then Hollow Pluck moved onto it (see its entry above). New: the vactrol and the `lpg` model in `voice.worklet.js` (it reuses the SVF 12 loop at low-pass), `filt.lag` and `filt.gate` (schema stays v:1), the chip, the gate row, the lag knob and the note in `index.html`, two bench cases. Also fixed while building: the coefficient memo key was epoch x 6 + model, which with a seventh model would collide between the gate at one patch and Valve 12 at the next (measured 1.03 dB wrong in Node with the old key); it is now epoch x 7 + model, and a check covers it. The Node bench against origin/main: every existing case bit-identical (all six older filter models, stereo offset, unison, LFO, sync, FM, still, patch changes and all eight Cathode cases), so only Hollow Pluck sounds different. New checks (31): the Pentagrid blanker check, test 2 on the gate, an Lg. section (never sings, gentle peak, turn-on time, the slow and slowing release, lag, filter and level together, each gate mode, velocity, the released tail and its end, bounds, a 10 s random sweep, no click on a mode change, the memo key, stereo offset, the schema, Hollow Pluck against its Valve 12 self), the chip, row, knob and note, and the phone sizes. Cache `dxedge-v143`. Suite: ALL PASS (1254 checks) required on the pushed tree. CPU (test 9, headless, the build run, a 2-core box, numbers move run to run): Cathode 16.4%; Filament 8 voices Ladder 24 25.2%, Valve 12 16.4%, Diode 18 19.8%, Sallen-Key 12 18.7%, Poly 24 16.8%, SVF 12 16.7%, Low pass gate 19.8%; stereo offset 23.7%; 16 voices with ensemble 29.7%; EQ at 31 bands 30.9%. Listen: the Low pass gate and Hollow Pluck (see Open items). Commit: this one.
- 2026-10-25 (improvement, scheduled task, about 5:24 to 6:20 AM PT): CPU, the rack. Main first: suite on origin/main `03ce826` ALL PASS (1219 checks), `scripts/test_synth_imported.py` ALL PASS (29). No review finding marked broken is open, so CPU. Measured in headless Chrome as the marginal cost of a render (22 s minus 2 s): Plate Screamer is 17.5% of real time steady, 3.5% without the rack, so the shared rack is most of the cost. Two rack stages ran with their output multiplied by exactly 0: the ensemble's wet side when off or at mix 0, and the push-pull B side's 4x shaper on single-ended patches. `rack.js` now unplugs their feed while idle (offline at once, live after the fade) and plugs it back before a fade-in. Output bit-identical on all 6 repeatable rack cases, old tree against new (measured). Rack-only CPU, median of 8, old to new: Filament default 10.75 to 9.05%, Plate Screamer 13.35 to 11.80%, single-ended 12.70 to 9.80%, no ensemble 10.40 to 9.30% (run to run spread about 1.5 points). Also measured and logged in the backlog: test 9 carries a fixed 0.25 to 0.45 s per render; the Node bench's Cathode "GC per block" was JIT warm-up. 4 new R. checks (they need the new code). Cache `dxedge-v142`. Suite: ALL PASS (1223 checks); imported ALL PASS (29). CPU (test 9, headless, this run): Cathode 17.7%; Filament 8 voices Ladder 24 40.4%, Valve 12 33.5%, Diode 18 32.5%, Sallen-Key 12 33.5%, Poly 24 29.6%, SVF 12 25.6% (wall clock, noisy). Commit: this one.
- 2026-10-25 (graphics, scheduled task, about 2:55 to 3:55 AM PT): main first: suite on origin/main `74095d7` ALL PASS (1208 checks). Screenshots at 1366x1000 (every rail device) and 375x667 (every device's phone tabs, 50 shots); no page errors, no horizontal scroll. Built the top Graphics backlog item, the MIDI deck and SONGS strips: brushed faceplates with screws and engraved name plates, every status in a recessed amber readout window (13.8:1), empty readouts hidden, and a state lamp (dark, amber ready, red armed, pulsing red recording, green playing) read from the buttons' own state with CSS `:has`; reduced motion keeps it steady. CSS only, no script or audio change. Added two backlog items (phone first screen, deck tempo readout). 9 new Dk. checks. Cache `dxedge-v140`. Suite: ALL PASS (1217 checks). Commit: the graphics commit of 25 Oct.
- 2026-10-25 (check and debug, scheduled task, about 2:08 to 2:30 AM PT): reviewed 6 commits since 24 Oct 6 PM PT on origin/main `2e7cea1`: by Cursor Agent the unlisted Deadweight game at /salvage/ `7012fe1`, its title check `b6aab39` (now case-insensitive, matching the rendered label) and merge `1830134` (none under /synth/); the health bot's state commit `ae6bd6a`; by Claude (the 12:28 AM nightly) SVF 12 `9a36435` and the recorder timing check `2e7cea1`. No edit under `/otr`, no test removed, no trademark name, no new third-party code. `2e7cea1` loosens the recorder timing check from per-call stamps to a [before, after] window per call; read the math and it is sound (each event must land in [b_i - a_0, a_i - b_0], still within 5 ms). Read the SVF 12 diff: the coefficient memo key moved from epoch x 5 to x 6, both filters dispatch to `svf()`, `F_HL` is cleared on reset, the morph weights are set on both filters. Suite: ALL PASS (1208 checks). `scripts/test_synth_imported.py`: ALL PASS (29). Live `/synth/`, `/synth/fm/`, `/synth/acid/` at 1366 and 375 px: no page or console errors, `__synth.ready()` true, the only failed request the `/api/stat` beacon aborted on close; no horizontal scroll at 375 px except Hexode (1154 px, open since 15 Oct). A live note on each of the 18 rack devices moved its own strip meter (measured peak 0.013 Phantastron to 0.62 Geissler; Lattice 0.28 once selected); offline renders of Notch Drift at morph 0, 1, 1.5, 2 and 3 peaked 0.23 to 0.34 with no non-finite samples. Live `sw.js` `dxedge-v139` matches the repo, and the live `index.html`, `voice.worklet.js` and `patches.js` match byte for byte. Defects found: none in /synth. Seen, not fixed (not this job's area): /salvage/assets carries a second, unreferenced build (`index-D5NeaYaj.js`, `index-BYwRJq56.css`, about 4,200 lines) beside the one `index.html` loads. Environment note: `/opt/pw-browsers/chromium-1194` is gone on this box; the suite fell through to `/opt/google/chrome/chrome` (chromium-1243). Docs only, no cache bump. Commit: this one.
- 2026-10-25 (nightly, scheduled task, run about 12:20 to 1:40 AM PT): main first. origin/main `ae6bd6a` (since the 24 Oct improvement run: Cursor Agent's Dungeon Master redeploys at /dm/, Hearthvault at /crawl/ and Deadweight at /salvage/, with their merges, and the health bot's state commit; none of them touch /synth). Suite on a clean origin/main: ALL PASS (1181 checks); `scripts/test_synth_imported.py` ALL PASS (29). Live: /synth/ ready with no page errors and no failed requests, /synth/fm/ and /synth/acid/ no page errors, sw.js `dxedge-v138` on both. Nothing broken, so tonight is the roadmap: the graphic EQ landed 16 Oct and the tube show's first slice 16 Oct, so the next unchecked 0.2 item, State variable 12 multimode with morph (see its entry above). New: the SVF 12 model in `voice.worklet.js` (`Filt.svf`, a smoothed `K_MOR` slot, morph weights set at control rate), `filt.morph` (0 to 3, default 0, schema stays v:1), the chip, the morph knob and the note in `index.html`, factory patch Notch Drift (Pad), two bench cases. The Node bench against origin/main: every existing case bit-identical (Valve 12, Ladder 24, Diode 18, Sallen-Key 12 and its high-pass, Poly 24, the stereo, LFO, sync, FM, patch-change cases and all eight Cathode cases), so no existing patch sounds different. New checks (27): test 1 and 2 cases, an Sv. section (silence at 0.85, singing at three modes and the notch cancelling, each morph point against its 2-pole model, continuity, peak and clip-down, slew with drive, level against resonance, bounds at extremes, a 10 s random sweep, no click when morph moves, stereo offset, morph inert on other models, normalisation), the chip, knob and note, the keyboard on the knob, and the phone chip row. Cache `dxedge-v139`. Suite: ALL PASS (1208 checks) on the build; the gating run on the committed tree then failed one check that had passed on main and on the build: "M. recorder timing matches the calls within 5 ms" read 10.40 ms. Cause, measured: the check timed each call after it returned, so a slow call counted as recorder error; one `noteOn` took 7.7 ms on a quiet page here, and the first call sets the reference for all six. The check now brackets each call (before and after) and allows the 5 ms outside that window, and logs the slowest call; the 5 ms bound on the recorder itself is unchanged. No product code changed for it. The tree pushed is the one that passed the full suite after this fix (1208 checks, ALL PASS required before the push). CPU (test 9, headless, a 2-core box, numbers move run to run): Cathode 26.6%; Filament 8 voices Ladder 24 30.5%, Valve 12 22.1%, Diode 18 25.9%, Sallen-Key 12 26.1%, Poly 24 24.5%, SVF 12 22.7%; stereo offset 25.4%; 16 voices with ensemble 33.5%; EQ at 31 bands 28.9%. Listen: SVF 12 and Notch Drift (see Open items).
- 2026-10-24 (improvement, scheduled task, about 5:25 to 6:45 AM PT): test health, forced, plus CPU tooling. Main first: the suite on origin/main `a257110` failed 2 checks on both runs (once beside a Node bench, once quiet): the tube show draw time (15.8, 12.2 ms against 12) and "G. hold, the generator and a finger combine" (0 voices). Both were wall-clock races, measured: the draw time was read straight after two other pages loaded and rendered on the same cores (5.9 to 11.1 ms there against 5.2 ms stable on a quiet page), and the Gleam check waited 100 ms for a patch that lands on the next frame and a generator point a frame after (43 to 137 ms and 66 to 398 ms). The draw time is now read at the end of a chord its own page plays with the other contexts closed (2.79 ms in the suite); the Gleam check waits for the patch and the point. Then the Node bench: it ran the worklet as a top-level script in a vm context, where every global read is a slow uninlined lookup, so it overstated any path that calls a top-level function or `Math` (Diode 18 and Sallen-Key 12 filter calls 7x to 10x Ladder 24's; equal once wrapped). It now runs the worklet in a function with the builtins passed in; output hashes identical on all 22 cases; bench CPU old to new on a quiet box: Valve 12 61.4 to 23.4%, Diode 18 72.9 to 24.7%, Sallen-Key 12 80.7 to 24.1%, Plate Screamer 41.3 to 14.6%; new `--profile`. No product code and no sound changed. Cache unchanged (no served file changed). Suite: ALL PASS (1181 checks); `scripts/test_synth_imported.py` ALL PASS (29). CPU (test 9, headless, slow box): Cathode 34.4%; Filament 8 voices Ladder 24 49.8%, Valve 12 44.4%, Diode 18 42.1%, Sallen-Key 12 39.0%, Poly 24 47.3%; stereo offset 58.7%; 16 voices with ensemble 72.8%; EQ at 31 bands 69.5%. Commit: the improvement commit of 24 Oct.
- 2026-10-25 (review, scheduled task, about 4:20 to 6:00 AM PT): areas a (every control on Filament with SVF 12, Cathode, Dekatron and Lattice) and b (all 127 factory patches on 18 devices from the patch menu; user save, reload and delete on five devices) on the live site at origin/main `4fe33df`, sw.js `dxedge-v140`. Findings: 1 broken (fixed), 4 confusing (1 fixed); R1022-3 and R1022-5 still open (details in `docs/filament-review.md`, 25 Oct). Fixed: R1025-1, picking a Phantastron patch with a shorter phrase while a voice still sounded threw inside the worklet and left the device silent until reload (measured live 5 of 23 runs; 18 of 20 held switches in Node); R1025-2, the Lattice matrix amount and remove controls are named by route in words. Two new checks, both failing on the unfixed tree (measured). Cache `dxedge-v141`. Suite: ALL PASS (1219 checks). Commit: this one.
- 2026-10-24 (review, scheduled task, about 4:20 to 5:30 AM PT): areas f (song library, project save and load), g (Hexode, Anode, Gleam full screen) and h (accessibility) on the live site at origin/main `75d8a45`, sw.js `dxedge-v133`. Findings: 1 broken, 2 confusing (details in `docs/filament-review.md`, 24 Oct). Fixed: R1024-1, load saved put Thyratron, Dekatron, Lattice or Gleam on the rail back on the patch it had when it was put there (measured on all four); R1024-2, the 36 mute and solo chips now name their device. Three new checks, all three failing on the unfixed tree (measured). Still open and re-measured: R1020-3, R1020-6, R1020-8, Hexode 1154 px at 375. Cache `dxedge-v134`. Suite: ALL PASS (1181 checks). Commit: this one.
- 2026-10-24 (graphics, scheduled task, about 3:15 to 4:40 AM PT): main first: suite on origin/main `9f43e94` ALL PASS (1169 checks; the run
  started on a clean tree, but the CSS edits below landed in the working tree while it ran, so its later sections saw them). Screenshots at
  1366x1000 and 375x667, every rail device and every phone tab; no page errors, no horizontal scroll. Built the top backlog item, faders
  rack-wide: one slider finish (slot, cap, index line) in index.html, Lattice's index blue, slider grids that only take columns that fit,
  aligned name and readout columns on Trochotron, Phantastron, Rhumbatron and Heptode, dark Resnatron selects. CSS only; no audio change.
  9 new Gx. checks (4 fail on origin/main as expected: finish, paint, width, select contrast). Cache `dxedge-v133`. Suite: ALL PASS (1178 checks). Commit: the graphics commit of 24 Oct.
- 2026-10-24 (check and debug, scheduled task, about 2:09 to 2:50 AM PT): reviewed the commits since 23 Oct 6 PM PT on origin/main `830182e`: by Claude (the 12:28 AM nightly) the Desk page close fix `81cedae` and Poly 24 `830182e`; by Cursor Agent Delve `044b086` and the unlisted /dm/, /eob/ and /eob2/ engines (merges #65 to #68, none under /synth/); the health bot's state commit `ad30b95`. No edit under `/otr`, no test removed or loosened (`81cedae` only closes each Desk page sooner; `830182e` adds Poly 24 to tests 1, 2, 9 and 10 and adds the Po. section), no trademark name, no new third-party code. Read the Poly 24 diff: the coefficient memo key moved from epoch x 4 to epoch x 5 for the fifth model, and the left and right filters both dispatch to `ota()`. Suite: ALL PASS (1169 checks). `scripts/test_synth_imported.py`: ALL PASS (29). Live `/synth/`, `/synth/fm/`, `/synth/acid/` at 1366 and 375 px: no page or console errors, `__synth.ready()` true, the only failed request the `/api/stat` beacon aborted on close; no horizontal scroll at 375 px except Hexode (1154 px, open since 15 Oct). A live note on each of the 18 rack devices moved its own strip meter (measured peak 0.014 Phantastron to 0.66 Geissler); an offline render of Velvet Brass peaked at 0.31. Live `sw.js` `dxedge-v132` matches the repo, and the live `index.html`, `voice.worklet.js` and `patches.js` match byte for byte. Defects found: none. Docs only, no cache bump. Commit: this one.
- 2026-10-24 (nightly, scheduled task, run about 12:30 to 1:35 AM PT): main first. origin/main `0d2c531` (since the 23 Oct improvement run: the health bot's state commit `ad30b95` and Cursor Agent's Delve, /dm/ and /eob/ work, then /eob2/ `6faa308` during the run; none under /synth/). The suite on a clean origin/main stopped with an exception after 1146 passes and no fails: the last Desk. section had four extra rack pages open beside the main one, and the fourth (390 px phone) timed out loading after 30 s on this 2-core box (load average about 6). Fixed in the suite: each Desk. page now closes before the next opens; no check changed. `scripts/test_synth_imported.py` ALL PASS. Live `/synth/`, `/synth/fm/`, `/synth/acid/`: no page errors and no failed requests, `__synth.ready()` true; live `sw.js` `dxedge-v131` matched origin/main, and the live `index.html`, `voice.worklet.js` and `patches.js` matched byte for byte. Then the first unchecked 0.2 item, Poly 24 (see its roadmap entry), and the factory patch Velvet Brass (Pad; listen to both). Measured in the suite: self-oscillation within 0.8 cents of pitch from C3 to C7 (Node: within 0.8 to C8, +4.8 at C2); cutoff exact (0.00%) at 100 Hz to 4 kHz; slope -23.6 dB against the 4-pole model's -23.6; level within 2.4 dB from resonance 0 to 0.85. Velvet Brass measured -16.9 dBFS RMS on the test 7 chord (Black Light Pad -16.2, Filament Lead -16.6), 1.3 dB mono fold. Valve 12, Ladder 24, Diode 18, Sallen-Key 12 and Cathode output bit-identical to main on every bench case (`scripts/bench_filament_voice.mjs --ref origin/main`); Poly 24 costs the same as Ladder 24 in the Node bench (38.2% against 38.7%) once its tanh approximant was written out. No other patch changed. Cache `dxedge-v132`. Suite: ALL PASS (1169 checks). `scripts/test_synth_imported.py`: ALL PASS. CPU (test 9, headless; this box ran slow again tonight): Cathode 33.0%; Filament 8 voices Ladder 24 51.0%, Valve 12 49.8%, Diode 18 65.0%, Sallen-Key 12 57.9%, Poly 24 52.2%; stereo offset 52.2%; 16 voices 68.5%; EQ 31 bands 84.3%. Chassis draw 7.07 ms a frame. Commits: the suite fix and the Poly 24 commit that carries this line.
- 2026-10-23 (improvement, scheduled task, about 5:26 to 6:45 AM PT): test health, forced: main hung. The suite on origin/main `b93422e` stalled more than 5 minutes in "G. HRTF keeps a left-hand finger on the left" (the 18 Oct hang again) and was stopped. Cause, measured: in Chromium 153 an HRTF offline render started straight after the page's first HRTF panner deadlocks about one run in five (gdb: the HRTF loader thread waits on a mutex the offline render thread owns, and that thread waits for the loader). `renderGleamBuffer` now makes one HRTF panner per sample rate per page and waits 1 s before an HRTF render; the suite's Gleam renders now fail one check after 60 s instead of stalling. Before and after on the same fresh-page repro: 3 of 15 renders hung, then 40 of 40 finished; the first HRTF render of a page takes 1.13 to 1.39 s (was 0.65 to 0.96 s when it did not hang), later ones unchanged. Sound unchanged (a warmed render matches a cold one within 3e-8, the jitter between two warmed renders); no patch changes. Sculpt's offline HRTF render can hang the same way (inferred, not changed; see the Improvement backlog). Cache `dxedge-v127`. Suite: ALL PASS (1149 checks, 536 s). `scripts/test_synth_imported.py`: ALL PASS (29). CPU (test 9, headless): Cathode 20.8%; Filament 8 voices Ladder 24 25.4%, Valve 12 21.6%, Diode 18 28.6%, Sallen-Key 12 27.0%; stereo offset 25.7%; 16 voices 34.6%; EQ 31 bands 30.5%. Chassis draw 5.68 ms a frame. Commit: this one.
- 2026-10-23 (review, scheduled task, about 4:25 to 5:15 AM PT): areas c (keyboard, computer keys, pedal, wheels and MIDI on all 18 devices), d (the new Mix desk: arms, session save, load and upload) and e (MIDI deck takes with armed strips, Render WAV), live `0.19-resnatron`, origin/main `4b87649`. Findings: 2 broken (both fixed), 2 confusing, 1 missing; R1017-3 and R1017-8 still open. Fixes: the pedal-up now reaches every device the pedal went down on, so arming a strip while holding no longer leaves a note ringing until Panic; upload mix refuses a file that is not `kind: dxmix` instead of resetting every strip and overwriting the saved mix. Each with a check that fails on the live code. Cache `dxedge-v126`. Suite: ALL PASS (1150 checks). Commit: the review commit of 23 Oct.
- 2026-10-23 (graphics, scheduled task, about 3:15 to 4:15 AM PT): main first: suite on origin/main `72b3780` ALL PASS (1141 checks). Screenshots at 1366x1000 and 375x667, every rail device and every phone tab; no page errors, no horizontal scroll. Started the Graphics backlog (8 items, ranked). Built the top one, the Mix desk strips: fixed the `keys` class collision that stretched the keyed strip (desktop gap, phone overlap), a faceplate and lamp per strip, names on one line, an LED ladder meter at the canvas's real size, amber bus sliders. CSS and the meter painter only; no audio change. 5 new checks (3 Mx., 2 phone). Cache `dxedge-v125`. Suite: ALL PASS (1146 checks). Commit: the graphics commit of 23 Oct.
- 2026-10-23 (check and debug, scheduled task, about 2:10 to 2:55 AM PT): reviewed 2 commits since 22 Oct 6 PM PT on origin/main `9a411cf`, both by Claude (the 12:28 AM nightly): the boot and router sleep fix `811b4c4` and Sallen-Key 12 `9a411cf`; also the health bot's state commit `720041a`. No edit under `/otr`, no test removed or loosened (the one changed check, the phone Filter tab, now also requires the Sallen-Key 12 chip), no trademark name, no new third-party code. Read the diffs: `routeWaker` and the boot `sleep` both skip the rail's device as intended; the new filter's coefficient memo is keyed on model and patch epoch, and Valve 12 rewrites the slots it shares with Sallen-Key 12, so switching models does not leak state (by reading the code). Suite: ALL PASS (1141 checks), including `M. pentagrid: recorded matches live`. `scripts/test_synth_imported.py`: ALL PASS (29). Live `/synth/`, `/synth/fm/`, `/synth/acid/` at 1366 and 375 px: no page or console errors, `__synth.ready()` and `booted()` true, the only failed request the `/api/stat` beacon aborted on close; no horizontal scroll at 375 px except Hexode (1154 px, open since 15 Oct). A live note on each of the 18 rack devices moved its own strip meter (measured, 0.014 Phantastron to 0.92 Geissler peak); an offline Filament render peaked at 0.35. Live `sw.js` `dxedge-v124` and the live `index.html`, `voice.worklet.js` and `patches.js` match the repo byte for byte. Defects found: none. Note for the task prompt: the Chromium path it names (`chromium-1194`) no longer exists; the suite falls back to `/opt/pw-browsers/chromium`. CPU (test 9, headless): Cathode 22.7%; Filament 8 voices Ladder 24 37.5%, Valve 12 29.1%, Diode 18 30.3%, Sallen-Key 12 31.9%; stereo offset 32.8%; 16 voices 42.6%. Chassis draw 4.75 ms a frame. Docs only, no cache bump. Commit: this one.
- 2026-10-23 (nightly, scheduled task, run about 12:30 to 2:45 AM PT): main first. origin/main `720041a` (since the 22 Oct check: the 22 Oct review `7df0d35` by Claude and the health bot's state commit `720041a`; no /synth change by others). The first suite run on it was invalid (this job ran Node renders beside it on a 2-core box: one draw-time fail, then a page load timeout). A quiet re-run: 1114 pass, 1 FAIL, `M. pentagrid: recorded matches live`, both sides silent, the flake the 21 Oct check saw under load; this time with nothing else running. `scripts/test_synth_imported.py` ALL PASS. Live `/synth/`, `/synth/fm/`, `/synth/acid/` at 1366 and 375 px: no page or console errors, no failed requests, `__synth.ready()` true; Hexode still 1154 px wide at 375 (open since 15 Oct). Live `sw.js` `dxedge-v123` matched. Cause found and fixed (`811b4c4`, see its message): the end of the boot chain put the rail's device to sleep, which panics it and cut a held note (measured: Pentagrid 0.165 to 0.0003 RMS on main, 0.131 to 0.176 fixed), and Geissler and Gyrotron did the same when their routed notes ended (by reading the code). Two new checks. Inference: one of those two caused the flake; if `M. pentagrid` fails again, it is something else. Then the first unchecked 0.2 item, Sallen-Key 12 (see its roadmap entry) and the factory patch Snarl Lead (listen to both). Measured in the suite: self-oscillation within 0.4 cents of pitch from C3 to C7; cutoff exact (0.00%) at 100 Hz to 4 kHz; slope -12.2 dB against the model's -12.2; high-pass within 0.01 dB of the 2-pole model; level within 0.7 dB from resonance 0 to 0.85. Valve 12, Ladder 24 and Diode 18 output bit-identical to main on all bench cases (`scripts/bench_filament_voice.mjs --ref origin/main`); no other patch changed. Found on the way (measured, not fixed): the Node bench runs the worklet in a `vm` context where each global lookup (`Math`, or a top-level function such as Diode 18's `tdx`) costs about 100 ns, so it overstates Diode 18 and Sallen-Key 12 about 2x against Ladder 24; headless Chrome does not. Cache `dxedge-v124`. Suite: ALL PASS (1141 checks). CPU (test 9, headless, the full run on this code before a test-only tolerance fix): Cathode 34.4%; Filament 8 voices Ladder 24 49.4%, Valve 12 41.3%, Diode 18 42.0%, Sallen-Key 12 41.6%; stereo offset 47.2%; 16 voices 62.9%; EQ 31 bands 62.7% (this box ran slow tonight). Chassis draw 7.78 ms a frame. Commits: `811b4c4` and the Sallen-Key commit that carries this line.
- 2026-10-22 (review, scheduled task, about 4:20 to 5:40 AM PT): areas a (controls on Thyratron, Additron, Rhumbatron, Phantastron) and b (all 124 factory patches on 18 devices, user save, reload and delete, old stub patches), live `0.19-resnatron`, origin/main `61b1e1b`. Findings: 2 broken (both fixed), 4 confusing, 0 missing. Fixes: two silent Phantastron factory patches (a wire into BITS stops at 3 bits) and Additron's inert perc knob (it now picks perc 3 from "perc off"), each with a check that fails on the live site. Cache `dxedge-v123`. Commit: the review commit of 22 Oct.
- 2026-10-22 (check and debug, scheduled task, about 2:08 to 2:26 AM PT): no commits since 21 Oct 6 PM PT; origin/main `a2bf9c3`. The 12:28 AM nightly did not push or log tonight (last commit 12:04 PM PT on 21 Oct). Also read the two commits no check had seen: Cathode memoize `bf4a4b4` (Claude, 21 Oct morning) and Delve sheets and runes `3aec759` with merge #64 (Cursor Agent). No edit under `/otr`, no test removed or loosened, no trademark name, no new third-party code. Suite: ALL PASS (1112 checks). `scripts/test_synth_imported.py`: ALL PASS (29). Live `/synth/`, `/synth/fm/`, `/synth/acid/` at 1366 and 375 px: no page or console errors, `__synth.ready()` true, the only failed request the `/api/stat` beacon aborted on close; no horizontal scroll at 375 px except Hexode (1154 px, open since 15 Oct). A live note on each of the 18 rack devices moved its own strip meter (measured, 0.026 Phantastron to 0.77 Geissler peak); an offline Filament render peaked at 0.33. Live `sw.js` `dxedge-v122` matched the repo. Defect found: `3aec759` moved `backend/tests/test_news.py` and `test_news_lightbox.py` to pin the exact cache `dxedge-v122`, the same pattern fixed in the Delve and hand tests last night, so the next bump fails them. Fixed: both check v122 or later (measured: pass at v122 and v123, fail at v121). Tests only; nothing served changed, so no cache bump. 9 other errors in those files are this container lacking `httpx`, the same before and after. CPU (test 9, headless): Cathode 16.6%; Filament 8 voices Ladder 24 28.8%, Valve 12 28.3%, Diode 18 29.0%; stereo offset 30.3%; 16 voices 32.7%; EQ 31 bands 41.8%. Commit: this one.
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
