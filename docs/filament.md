# Filament (/synth/) build status

The single source of truth for where the synth build is. The nightly build task reads this file
first and updates it last. James can write in **Notes from James** and the next run acts on it.

Design brief: the claude.ai project doc `dxedge-synth-design.md` (project "DX Edge Synth").
Decisions in force: name Filament, path `/synth/`, standalone page plus a main-page tab next to OTR,
Ko-fi tip link to https://ko-fi.com/oldtimeradio, /otr code is COPIED into `/synth/` (never edit
/otr for the synth), warm-up off by default, vanity domain later, Web MIDI in 0.1.
Long-term goal: a rack of devices in the spirit of Reason (Propellerhead). Keep the synth a device
with a clean boundary: parameter table, MIDI in, stereo out, versioned patch JSON.

The rack now holds two devices: **Filament** (poly, the tube synth) and **Cathode** (mono,
semi-modular, with a patch panel; James asked for it on 13 Oct as "an MS-20 style" synth. It is an
original design: own name, panel, jack names and voicing, not a copy of Korg's). The rail above the
chassis picks which device the keyboard, wheels and MIDI play; both feed the same ensemble and
output rack, which takes its settings from the active device's patch.

The rack framework (14 Oct) is what those two, and the devices after them, plug into. Each device
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
| `frontend/public/synth/engine.js` | Builds the devices + rack in any context; `setDevice`; `renderOffline`; `midiEvent`; hosts the mixer, transport and device facades |
| `frontend/public/synth/patches.js` | Filament patch schema v1, defaults, `normalize`, the factory set |
| `frontend/public/synth/smf.js` | Our own Standard MIDI File reader and writer (pure functions): `readSMF`, `songOf` (tempo map to seconds, multi-channel tracks split per channel, format 2 played in sequence), `writeSMF` (format 1, 480 ppq), `bytesOf` |
| `frontend/public/synth/deck.js` | The MIDI deck above the keys: recorder, import with the track list and device chips, the player (150 ms lookahead, 25 ms timer, frame-exact `at`), Render WAV. Its clock is private; it still uses `smf.js` |
| `frontend/public/synth/player.js` | Song library player. Loads a bundled file, an opened file, or a drop, and plays it on `host.transport` (play, stop, tempo). Each MIDI channel routes to a device |
| `frontend/public/synth/midisong.js` | Pure parse and route helpers for the library player. Parsing is the vendored `@tonejs/midi`. Time is quarter-note beats, so the transport tempo is the playback tempo |
| `frontend/public/synth/vendor/tonejs-midi.js` | `@tonejs/midi` 2.0.28 (MIT) bundled with `midi-file` 1.2.4 and `array-flatten` 3.0.0. See `THIRD_PARTY_NOTICES.md` |
| `frontend/public/synth/midi/` | Bundled `.mid` files and `catalog.json` (title, composer, composition status, CC0 sequence note, and Halloween preset names) |
| `scripts/build_midi_library.mjs` | Regenerates `frontend/public/synth/midi/`. Every file is sequenced here |
| `frontend/public/synth/cathode.js` | Cathode patch schema v1 (`device: 'cathode'`, `cables: [[source, input]]`), the jack lists and normals, `normalizeC`, its factory set |
| `frontend/public/synth/device.js` | Device contract (`dxrack/1`): `registerDevice`, `getDevice`, `listDevices`, `parameterTable`. Filament and Cathode are registered here |
| `frontend/public/synth/mixer.js` | Per-device level, pan, mute and solo into the shared ensemble. Defaults are a straight wire |
| `frontend/public/synth/transport.js` | Master clock: tempo 40–240, play/stop, 24 ppq. `clockTicks` and `describeTick` are pure |
| `frontend/public/synth/project.js` | Project JSON (`kind: 'dxrack'`, `v: 1`): both patches, mixer, tempo, keyboard device. localStorage key `dxrack_project` |
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
  named "Filament: <patch>" or "Cathode: <patch>".
- **Recorder** (a strip next to the keyboard, phone friendly, 44 px targets): Rec arms; the first
  note starts the take; it captures notes and velocities, bend, mod wheel, sustain and aftertouch
  from every input (on-screen keys, computer keys, MIDI keyboard) with the device each event went to.
  Stop, Play (replays through the same devices), Clear, Export .mid (downloads
  `filament-take-YYYYMMDD-HHMM.mid`). Show take length and note count.
- **Import**: a button (file input accepting .mid, .midi, audio/midi) and drag and drop onto the
  strip. Show file name, length and a track list: name, channel(s), note count, and chips per track
  for Filament, Cathode or off. Defaults: channel 10 (drums) off, since there is no drum machine yet;
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
The deck is unchanged (own SMF reader, private tempo). This is a second strip: a sample library, open, and drop. Playback is the rack transport. Channel 10 stays off unless a device named `drums` is registered, then it routes there. The first melodic channel goes to Filament, the second to Cathode, the rest to Filament. A file's own tempo map is not followed; loading a song sets the transport to the file's first tempo.
- [x] `@tonejs/midi` 2.0.28 vendored (MIT, with `midi-file` and `array-flatten`). The deck does not use it
- [x] 12 library files sequenced in `scripts/build_midi_library.mjs`, plus the Halloween set below. MIDI data is CC0. Compositions are public domain or original
- [x] Track list, per-channel device chips, loop, keys light for playback notes
- Known limits: the deck and the library can both be playing; they share note numbers on a device, same as the deck's own limit. A tempo change while playing lands at the schedule horizon (up to 150 ms later). Dekatron is not in this build, so it is not a routing target yet

### Halloween pack - done 14 Oct 2026
Dekatron is not registered in this build, so the pack is Filament and Cathode only. Presets use each device's own patch schema and the category `Halloween`.
- [x] Filament: Haunted Organ, Theremin Wail, Horror Pad, Creaky Drone, Ghost Choir, Sub Heartbeat, Glass Music Box, Eerie Bells
- [x] Cathode: Chapel Organ, Wail Glide, Cellar Drone, Creak Pulse, Choir Breath, Heartbeat, Glass Tine, Bell Jar
- [x] Six public-domain excerpts (Bach toccata, a slow organ reduction; Grieg, In the Hall of the Mountain King; Saint-Saëns, Danse macabre; Mussorgsky, Night on Bald Mountain; Chopin, Funeral March; the Dies irae sequence) and three original tunes (Lantern Walk, Cellar Stairs, Porch Ghost). Each loads its Filament and Cathode preset. Sources are in `docs/filament-licensing.md` and `midi/catalog.json`

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
- 2026-10-14 (interactive): song library and Halloween pack. A second strip plays MIDI on the rack transport (play, stop, tempo) with each channel routed to a device. The deck still uses `smf.js` and its own clock. `@tonejs/midi` 2.0.28 is vendored (MIT, with midi-file and array-flatten); notices are in `THIRD_PARTY_NOTICES.md`. 21 CC0 sequences: 12 library tunes (Beethoven 5, Bach toccata, two Joplin rags, Sousa, Greensleeves, Oh! Susanna, St. Louis Blues, Frankie and Johnny, and three original demos) plus a Halloween set (Bach organ reduction, Grieg Mountain King, Saint-Saëns Danse macabre, Mussorgsky Bald Mountain, Chopin Funeral March, Dies irae, and three original spooky tunes). Halloween songs load matching Filament and Cathode factory presets. Dekatron is not in this build. No Filament or Cathode voice code changed. Suite: ALL PASS (308 checks). CPU (test 9, headless): Cathode 8.9%; Filament 8 voices 12.1% (Ladder 24) and 11.6% (Valve 12); stereo offset 13.2%; 16 voices with ensemble 18.4%.
- 2026-10-14 (interactive): the rack framework. Device contract (`device.js`, dxrack/1), mixer (level, pan, mute, solo; defaults are a straight wire into the shared ensemble), master clock (tempo, play/stop, 24 ppq, devices subscribe), project JSON in localStorage plus download and upload. Filament and Cathode sit on it; their voices were not edited. The 0.2 host-clock item stays open for the arp and LFO sync, which do not read the clock yet. Commit `e367a43`. Suite: ALL PASS (254 checks; 26 new in R. and the phone rack tab). CPU (test 9, headless): Cathode 8.6%; Filament 8 voices 11.3% (Ladder 24) and 10.8% (Valve 12); stereo offset 12.5%; 16 voices with ensemble 17.3%. No factory patch changed and no existing sound changed.
- 2026-10-13 (manual run, Oct 13 afternoon; built about 2:15 to 2:40 PM PT by the scheduled task fired by hand, pushed from the interactive session because the task's own push was refused by its environment): bug check clean (suite ALL PASS 190, live page no errors, sw.js v71 matched). Built MIDI files, both slices, per Notes from James: `smf.js` (our own reader and writer), `deck.js` (recorder, .mid export, import with track list and device chips, player with loop and tempo 50-200%, Render WAV), `E.sendTo` and a playback hold in the engine (`{t:'play'}` keeps an inactive Cathode awake; `{t:'flush'}` drops queued playback events on stop), and a two-device `renderOffline`. Found and fixed during the build: Stop could leave a note stuck when its note off was already scheduled but not yet played (now every note playback touched is released; regression check added). Commit `2b5ed70`. Suite: ALL PASS (228 checks; 38 new in M. and the phone deck). CPU (test 9, headless, final run): Cathode 14.7%; Filament 8 voices 18.9% (Ladder 24) and 20.0% (Valve 12); stereo offset 23.6%; 16 voices with ensemble 30.3%. No patch changed and no existing sound changed; the deck adds no DSP to the voices. Since this ran in the afternoon, tonight's 11:52 PM run should find both slices ticked and resume the 0.2 list at the graphic EQ, as the note says.
- 2026-10-13 (just after midnight PT, interactive): Cathode, the second device, and the rack rail (see the Cathode section above). Suite: ALL PASS (190 checks). CPU: Cathode Plate Screamer about 17% of real time with the rack; Filament 8 voices 27 to 32% (this server varies run to run). No Filament patch changed; Filament now sleeps when silent for 100 ms, which only saves CPU.
- 2026-10-13: Phase 0 and 0.1 shipped from an interactive session. Suite: ALL PASS (103 checks).
