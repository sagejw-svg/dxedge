# Filament (/synth/) build status

The single source of truth for where the synth build is. The nightly build task reads this file
first and updates it last. James can write in **Notes from James** and the next run acts on it.

Design brief: the claude.ai project doc `dxedge-synth-design.md` (project "DX Edge Synth").
Decisions in force: name Filament, path `/synth/`, standalone page plus a main-page tab next to OTR,
Ko-fi tip link to https://ko-fi.com/oldtimeradio, /otr code is COPIED into `/synth/` (never edit
/otr for the synth), warm-up off by default, vanity domain later, Web MIDI in 0.1.
Long-term goal: a rack of devices in the spirit of Reason (Propellerhead). Keep the synth a device
with a clean boundary: parameter table, MIDI in, stereo out, versioned patch JSON.

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

## Files

| File | What it is |
|-|-|
| `frontend/public/synth/index.html` | The page: panel, chassis, keyboard, MIDI, patches, test hook `window.__synth` |
| `frontend/public/synth/voice.worklet.js` | The voice engine (AudioWorklet): oscillators, V1, filters, envelopes, LFO, voices |
| `frontend/public/synth/engine.js` | Builds worklet + rack in any context; `renderOffline`; `midiEvent` |
| `frontend/public/synth/patches.js` | Patch schema v1, defaults, `normalize`, the factory set |
| `frontend/public/synth/rack.js`, `tubepaint.js`, `knob.js` | Copied from /otr at f9f5d2b (decision 5) plus marked "Filament additions" |
| `frontend/src/components/Synth.jsx` | Thin iframe shell; tab group "Synth" in `App.jsx` |
| `scripts/test_synth.py` | The suite. Must print ALL PASS before any push |

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
- [ ] Goniometer and correlation meter (copy the /otr drawing into the Stereo section)
- [ ] LFO 2, and stereo phase (0-180 degrees) for both LFOs
- [ ] Unison 1-8 copies per note with detune and spread
- [ ] Filter stereo offset (left and right cutoffs apart by up to +/-1 octave)
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
- [ ] Ensemble: BBD chorus I, II, I+II, and a three-phase string ensemble
- [ ] Tape echo: mono, ping pong, offset; wow and flutter; tube record amp
- [ ] Spring reverb: two tube-driven springs of different lengths, drip
Done when: every model self-oscillates where it should; mono fold passes for all patches.

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

## Notes from James
(write here; the nightly run reads this first)

## Nightly log
- 2026-10-13: Phase 0 and 0.1 shipped from an interactive session. Suite: ALL PASS (103 checks).
