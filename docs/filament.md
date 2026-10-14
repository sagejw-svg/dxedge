# Filament (/synth/) build status

The single source of truth for where the synth build is. The nightly build task reads this file
first and updates it last. James can write in **Notes from James** and the next run acts on it.

Design brief: the claude.ai project doc `dxedge-synth-design.md` (project "DX Edge Synth").
Decisions in force: name Filament, path `/synth/`, standalone page plus a main-page tab next to OTR,
Ko-fi tip link to https://ko-fi.com/oldtimeradio, /otr code is COPIED into `/synth/` (never edit
/otr for the synth), warm-up off by default, vanity domain later, Web MIDI in 0.1.
Long-term goal: a rack of devices in the spirit of Reason (Propellerhead). Keep the synth a device
with a clean boundary: parameter table, MIDI in, stereo out, versioned patch JSON.

The rack now holds three devices: **Filament** (poly, the tube synth), **Cathode** (mono,
semi-modular, with a patch panel; James asked for it on 13 Oct as "an MS-20 style" synth. It is an
original design: own name, panel, jack names and voicing, not a copy of Korg's), and **Dekatron**
(an original analog-style drum machine: kick, snare, closed hat, open hat, clap, tom and rim, with
a 16-step pattern). The rail above the chassis picks which device the keyboard, wheels and MIDI
play. Filament and Cathode feed the shared ensemble and output rack, which takes its settings from
the active device's patch. Dekatron is a separate worklet summed into that same chain; its own
pattern clock does not move the other devices.

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
| `frontend/public/synth/engine.js` | Builds the devices + rack in any context; `setDevice`; `renderOffline`; `midiEvent` |
| `frontend/public/synth/patches.js` | Filament patch schema v1, defaults, `normalize`, the factory set |
| `frontend/public/synth/cathode.js` | Cathode patch schema v1 (`device: 'cathode'`, `cables: [[source, input]]`), the jack lists and normals, `normalizeC`, its factory set |
| `frontend/public/synth/drums.js` | Dekatron patch schema v1 (`device: 'dekatron'`), the parameter table, `normalizeDrum`, `voiceForNote`, `drumDevice` (the host adapter), six factory patterns |
| `frontend/public/synth/drums-dsp.js` | The drum engine: 2x voices, the half-band decimator, the sample clock (`stepSeconds`) |
| `frontend/public/synth/drums.worklet.js` | AudioWorklet processor `dekatron`. Imports the engine; no DSP of its own |
| `frontend/public/synth/drums-ui.js` | The pattern panel, and `createDrumHost` / `renderDrums` (the page adapter) |
| `frontend/public/synth/rack.js`, `tubepaint.js`, `knob.js` | Copied from /otr at f9f5d2b (decision 5) plus marked "Filament additions" |
| `frontend/src/components/Synth.jsx` | Thin iframe shell; tab group "Synth" in `App.jsx` |
| `scripts/test_synth.py` | The suite. Must print ALL PASS before any push |
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

### 0.2 Character - next, one item per night, in this order
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
- [ ] Host clock and transport (one shared tempo the arp and LFO sync read)
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
- [ ] Dekatron on the shared host clock, once that clock exists. Until then the pattern clock is
      inside the worklet (`stepSeconds`), and a host can drive it with `{t:'tick'}` instead.

The host adapter is `drumDevice` in `drums.js`, plus `createDrumHost` in `drums-ui.js`. A future
rack calls `createDrumNode(ctx, {patch, destination})` and posts the messages below. It does not
import Filament's engine. The page wires the node to the shared ensemble input and sleeps it when
another device is selected.

| | |
|-|-|
| Identity | `id: 'dekatron'`, `processor: 'dekatron'`, `worklet: 'drums.worklet.js'`, `channels: 2`, `oversample: 2` |
| Patch | `normalize(patch)` → schema v1 JSON, `device: 'dekatron'`. `parameters` is the stable knob list (`level`, `seq.*`, `voices.<id>.<knob>`). Steps and the accent lane are pattern data, not knobs. |
| Factory | `factory`, `defaults` |
| Notes | `voiceForNote(midiNote)` → a voice id, or null |
| Messages | `{t:'patch', p}`, `{t:'trig', voice, v}`, `{t:'transport', playing}`, `{t:'tick'}` (external clock only), `{t:'panic'}`, `{t:'active', on}`. Optional `at` is a frame time. |
| Clock | `clock.modes`: `internal` (the worklet fires step i at `clock.stepSeconds(i, bpm, swing)`) and `external` (one `{t:'tick'}` per step after transport starts). |
| Meters | Worklet posts `{t:'meter'}` and `{t:'step', step, length, playing}` |

### MIDI files: recorder and player (James, 13 Oct 2026) - next, ahead of the 0.2 list
James chose: a recorder and player strip with a WAV render button; imported tracks are assigned to
devices (so Filament and Cathode play at once); built by the nightly job. Two slices; if both do not
fit in one night, ship slice 1 and leave slice 2 unchecked here.
- [ ] Slice 1: `smf.js`, the recorder with .mid export, import with the track list, the player
- [ ] Slice 2: Render WAV (imported file or take, both devices, rack included)

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

### 0.3 Delight
- [ ] 1939 mode (divide-down, LC resonators, seven envelope shapes, six-channel vibrato)
- [ ] Punched paper roll step sequencer
- [ ] Theremin mode with the magic eye as tuning indicator
- [ ] Share links (`?p=`), JSON export/import, Surprise me
- [ ] WAV recording (10 minute cap)
- [ ] Tube view, faces (walnut, studio rack black, black light), lava lamp module
- [ ] About 40 factory patches
Done when: share link round trip test passes.

## Open items for James
- Play it on the new keyboard and on a phone: is the Novachord Strings default the right first sound?
- CPU on a real mid-range phone (headless Chrome on the build server: about 20% of real time for
  8 voices including the rack). The budget is 40%. WebAssembly is the fallback if a phone misses it.

- Stereo offset or a stereo-phase cutoff LFO on Ladder 24 can thin out in mono: two 4-pole filters an
  octave apart are up to 180 degrees out of phase between their cutoffs. Valve 12 (2-pole) stays within
  about 2.5 dB. Factory patches are kept within 3 dB (test 7); the correlation meter goes amber below 0.
  A fully mono-safe version would need a third (centre) filter per voice; not done, CPU.

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
- 2026-10-13 (just after midnight PT, interactive): Cathode, the second device, and the rack rail (see the Cathode section above). Suite: ALL PASS (190 checks). CPU: Cathode Plate Screamer about 17% of real time with the rack; Filament 8 voices 27 to 32% (this server varies run to run). No Filament patch changed; Filament now sleeps when silent for 100 ms, which only saves CPU.
- 2026-10-13: Phase 0 and 0.1 shipped from an interactive session. Suite: ALL PASS (103 checks).
