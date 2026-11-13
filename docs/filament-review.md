# Filament functionality review

A scheduled review (about 4 AM Pacific) uses the rack the way a musician would and writes down what
does not work, is confusing, or is missing. It fixes at most two small defects a night, each with a
test; everything else waits here or under Open items in `docs/filament.md`.

Areas rotate two or three a night: (a) each device's controls, (b) patches, (c) keyboard, computer
keys, sustain, octave, strips and MIDI, (d) mixer, master clock and master bus, (e) MIDI deck,
(f) song library and project save and load, (g) the vendored pages, (h) accessibility.

"Measured" means a script read it from the live page or an offline render. "Inferred" means it
follows from reading the code or from how a first-time user would likely read the page.

## Open findings

Newest severity first. IDs are `R<date>-<n>`.

| ID | Severity | Area | Finding | Basis |
|-|-|-|-|-|
| R1113-4 | confusing | d | Rack tempo 120.5 typed in the box reads "121" while the transport runs at 120.5 (the box rounds; the clock does not) | measured |
| R1113-5 | confusing | e | A failed .mid import replaces the deck's status line with the error, but the previous file stays loaded, listed and playable under it | measured |
| R1113-6 | confusing | e | A .mid cut short says "This MIDI file has data with no status byte", not that the file is incomplete | measured |
| R1113-3 | missing | c | MIDI program change is ignored: a keyboard's patch buttons do nothing (no patch change, no word) | measured (ignored), inferred (expectation) |
| R1113-7 | missing | e | Recording along with a playing file: the take starts at its own first note and plays alone, so a part played over a backing file does not line up with it | inferred (code) |
| R1112-1 | confusing | a, b | Orthicon: a starter picture from the Picture card (Bell Partials, Harmonic Stack ...) is gone after a reload, a link or a saved user patch reopened; the scan plays Ember Ridge's picture while the readout shows the patch's name, and the link's note says only a "painted or dropped" picture is left out | measured |
| R1111-4 | confusing | f | Surprise me drops its draw without a word when the rail moves during the render (about 1.4 s); the toast still holds the previous surprise's text | measured (dropped), inferred (what a user sees) |
| R1110-3 | confusing | d | Master volume jumps in one sample: clicking the slider from 100% to 30% over a held A2 sine steps 12x to 22x the sine's own (an arrow key's 1% step is clean) | measured |
| R1110-4 | confusing | d | Switching the master delay off cuts its echoes and returns the dry level at once (2.7x the held sine's step); the reverb is the same by the code | measured (delay), inferred (reverb) |
| R1103-1 | broken | a, b | A Lattice patch made from an imported WAV comes back on reload without the WAV (plays a factory table, panel still says user); one imported table is shared by every patch | measured (table, sound), inferred (shared) |
| R1109-1 | confusing | a | Theremin: the on and off switch does not stop the pad; with it off, a press switches it on and plays | measured |
| R1109-2 | confusing | a | Theremin: on a mono patch a key takes the pad's voice while the readout and glow still show the pad's note | measured (mono), inferred (full poly pool) |
| R1108-3 | confusing | f | The paper roll's play starts Dekatron's own step pattern too: Blank Roll's play is a drum beat only (Dekatron strip 0.56), Octave Pump on Filament comes with the factory beat under it; same root as R1030-3 | measured |
| R1108-4 | confusing | f | The paper roll offers Heptode as a device chip, but it plays nothing (17 strikes, strip 0); same as R1030-4 for the library | measured |
| R1108-5 | confusing | f | After one press of the roll's play, run stays on across reloads, so every later library song brings the roll in with it (20 roll strikes under Beethoven 5) | measured (run kept, strikes), inferred (surprise) |
| R1104-4 | confusing | c, d | Panic leaves the Mix desk delay and room returns and the patch's own output room ringing; the room's tail then refills the master reverb | measured |
| R1106-2 | confusing | a | LC bank with the stereo offset: at 1 octave the sides differ far more than on the other models (side 1.7 dB over the left channel, Valve 12 -8 dB) and mono loses 0.55 dB; the LC note does not carry the mono warning the Ladder and Poly notes do | measured (width, mono), inferred (impact) |
| R1101-2 | confusing | d | Tape echo feedback runs hotter than its knob: 95% never decays and 100% grows about 12 dB over 30 repeats before the record amp holds it | measured |
| R1101-3 | confusing | d | Moving the rail from Filament to Cathode (or picking a patch with the echo off) cuts the tape echo's tail within 0.1 s: the shared echo follows the lit device's patch (2 Nov: the spring reverb is a patch field too, so it follows the same way) | measured (cut), inferred (impact, spring) |
| R1101-4 | confusing | d, h | Log-scaled knobs show their quantized position, not the patch value: the tape echo's default 375 ms reads "376ms" | measured |
| R1031-3 | confusing | a, b | Picking a patch (or an arrow) switches a running arpeggiator off and resets its settings: the arp lives in the patch | measured |
| R1031-4 | missing | a, e | A MIDI take records the keys, not the arpeggio, so an exported .mid is a held chord elsewhere | measured (take), inferred (impact) |
| R1030-3 | confusing | f | Dekatron's own step pattern plays under every library song (Greensleeves, Beethoven), and on top of a song's own channel 10 part; still open 11 Nov (all 21 songs, Dekatron strip 0.28 to 0.62) | measured |
| R1030-4 | confusing | f | Heptode is offered as a channel target in the library but plays nothing, on or off the rail; still open 2 Nov | measured |
| R1030-5 | confusing | f | Changing a channel's device while a song plays sends Dekatron a panic, which stops its pattern for the rest of the run | inferred (code) |
| R1029-3 | confusing | d | The header's record (and the master strip's) captures after the master volume: at volume 25% the WAV is 11.5 dB quieter | measured |
| R1029-4 | confusing | d | Mixer pan is a balance control: hard left keeps the left side at the centre level and drops the right, so a mono voice panned hard sounds about 3 dB quieter | measured |
| R1028-2 | confusing | a | Klystron gate and focus: most of their travel is silence (gate at 25% silences 4 of 5 factory patches; focus at its top costs 25 to 38 dB even with the gate at 0) | measured |
| R1028-3 | confusing | a | Resnatron has two level controls that do the same thing (Level and the Out module's level multiply) | measured |
| R1028-4 | confusing | a | LP gate in A with B on split or parallel: B's side follows the light cell's level but not its darkening, so the sides decay apart; the panel does not say so | measured |
| R1027-2 | confusing | f | For several seconds after opening (about 8 s on the live site, headless) the Mix desk shows no arms and the default desk bus; the saved ones appear when the boot finishes | measured |
| R1026-3 | confusing | d | Two reverbs and two delays: the strip sends feed the Mix desk's own room and an unsynced delay, not the master bus effects | measured |
| R1026-4 | confusing | d | Master reverb at mix 1 is about 10 dB louder than dry (chord peak 0.57 dry, 1.77 wet; 3.1 at size 1, damp 0) | measured |
| R1026-5 | confusing | c, h | Space on a focused button is the sustain pedal, so Space never presses hold, the deck, or any chip (Enter does); still open 29 Oct | measured |
| R1026-7 | confusing | e | First switch to Trochotron (151 ms) or Lattice (125 ms) blocks the page about as long as the deck's 150 ms lookahead | measured (block), inferred (stutter) |
| R1025-3 | confusing | b | Delete removes a user patch at once: no confirmation; undo gives back its sound as an edited patch, not the list entry, and the toast does not say so (3 Nov); still open 12 Nov (6 devices, no dialog) | measured |
| R1025-4 | confusing | a, h | Cathode pitch mod A and B: an arrow key moves 0.1% of travel; 100 presses reach +24 cents | measured |
| R1025-5 | confusing | h | Phone: the footer links (Tip the developer, Hand Orchestra, Hexode, Anode) are 13 px tall; still open 11 Nov | measured |
| R1024-3 | confusing | g, h | Hexode: the 13 operator On/Off and Fixed toggles have no name and no pressed state; still open 11 Nov (13 unnamed at both sizes) | measured |
| R1023-3 | confusing | c, e | Armed devices other than Filament and Cathode are left out of a MIDI take with no word; with only those armed the deck sits on "armed: play a note"; still open 29 Oct | measured |
| R1023-4 | confusing | c | A pitch bend or mod wheel moved before a strip is armed stays on the old device after arming | inferred (code) |
| R1023-5 | missing | c | Gleam ignores the sustain pedal (CC64) and the keyboard's hold button | measured (CC64), inferred (hold button) |
| R1020-3 | missing | f | A project leaves out the Thyratron, Dekatron, Lattice and Gleam patches and the master bus (and, since 8 Nov, the paper roll, listed as not in its first slice); still open 11 Nov (14 devices) | measured (Gleam inferred) |
| R1017-3 | missing | e | MIDI deck Render WAV ignores the mixer (level, pan, mute, solo, sends); still open 29 Oct | measured |
| R1022-3 | confusing | a, b | Phantastron is 20 to 30 dB quieter than the other devices; its first patch peaks at 0.03; still open 25 Oct | measured |
| R1022-4 | confusing | a | Phantastron's bits slider at 1 to 3 (and a GND to BITS wire) silences the speaking carts | measured |
| R1022-5 | confusing | b | Delete lands on the first patch in list order, not the device's own first sound; still open 12 Nov (Cathode, phone: Grid Bias Bass) | measured |
| R1022-6 | confusing | b | Save over an existing user patch name replaces it with no question | inferred (code) |
| R1020-4 | confusing | f | A Halloween song replaces the lit device's patch, even an edited one, with no notice | measured |
| R1020-5 | confusing | f | A song loaded before every device has attached is routed against the devices present then | inferred |
| R1020-6 | confusing | g | Hexode: Hold and the original panel controls show no focus ring; still open 24 Oct | measured |
| R1020-7 | confusing | g | Anode: the regenerate buttons are named only by the glyph "⟳"; still open 11 Nov (4 buttons, no name or title) | measured (11 Nov) |
| R1020-8 | confusing | h | Desktop rack: 553 tab stops with the paper roll open (8 Nov; 503 on 5 Nov, 426 on 27 Oct) and no skip link; the roll starts at stop 491; 11 Nov: 525 with the roll closed, still no skip link | measured |
| R1020-9 | confusing | h | Control names repeat across sections with no section in the name: "sine" x5, "level", "cutoff", "mix" x4, the tube chips x3 (5 Nov; the on and off switches are fixed by R1105-1) | measured |
| R1017-4 | confusing | e | Deck Render WAV writes 16-bit 48 kHz; the master render and record write 24-bit 44.1 kHz | measured |
| R1017-5 | confusing | d | Separate tempos: rack transport (now also the tape echo's sync), master delay tempo knob, deck 50-200%; still open 10 Nov (rack at 90 BPM, master tempo stays 120) | measured |
| R1017-6 | confusing | d, e | Two buttons both read "● rec" (header records audio, deck records MIDI); two "render wav" buttons render different things | measured |
| R1017-7 | confusing | c | At 1366 px the keyboard sits 4191 px down a 4862 px page, under all 18 mixer strips | measured |
| R1017-8 | confusing | d | Mixer strip meters are pre-fader: a muted strip still shows level; still open 29 Oct | measured |
| R1017-9 | confusing | d | No output protection unless the compressor is on: delay plus reverb can hard-clip at 0 dBFS; still open 7 Nov (226,954 samples at full scale in 4 s); 13 Nov: the master "limit" switch now holds the ceiling (-1.0 dBFS peak with delay feedback 0.95 and reverb size 1), but it is off by default | measured |
| R1017-10 | confusing | c | Phone: pitch and mod strips are 22 px wide (target rule is 44 px); still open 10 Nov | measured |
| R1017-11 | confusing | c | Phone: the octave readout says C3 while the first visible key is C4; still open 10 Nov | measured, impact inferred |

Fixed: R1017-1 and R1017-2 (17 Oct), R1020-1 and R1020-2 (20 Oct), R1022-1 and R1022-2 (22 Oct), R1023-1 and R1023-2 (23 Oct), R1024-1 and R1024-2 (24 Oct; R1024-2 also covers the mute and solo part of R1020-9), R1025-1 and R1025-2 (25 Oct), R1026-1 and R1026-2 (26 Oct), R1027-1 (27 Oct), R1028-1 and R1026-6 (28 Oct), R1029-1 and R1029-2 (29 Oct), R1030-1 and R1030-2 (30 Oct), R1031-1 and R1031-2 (31 Oct), R1101-1 (1 Nov), R1102-1 (also closes R1030-6) and R1102-2 (2 Nov), R1103-2 (3 Nov), R1104-1, R1104-2 and R1104-3 (4 Nov; R1104-2 and R1104-3 are one change), R1105-1 and R1105-2 (5 Nov), R1106-1 and R1103-3 (6 Nov), R1107-1 (7 Nov), R1108-1 and R1108-2 (8 Nov), R1109-3 and R1109-4 (9 Nov), R1110-1 and R1110-2 (10 Nov), R1111-1 and R1111-2 (11 Nov), R1112-2 and R1112-3 (12 Nov), R1113-1 and R1113-2 (13 Nov). R1111-3 (site down) cleared: dxedge.net answered 200 on 12 Nov from 12:20 UTC. Still open from the nightly checks: Hexode scrolls sideways at 375 px (measured again 11 Nov: 1154 px wide).

## 2026-10-17 (review, areas c, d, e)

Live site https://dxedge.net/synth/, page version `0.19-resnatron`, origin/main `12e3dc7`, sw.js
`dxedge-v100`. Chromium headless at 1366 x 900 and 375 x 812 (touch, 2x). No page errors on load at
either size.

### What worked (measured)

- On-screen keys: mouse at 1366 and touch at 375 sound and release (C4 lit, one voice, nothing held after).
- Computer keys: A plays C3, Z and X shift the octave, C and V step velocity (102, 114, 89), the octave
  buttons move C3 to C4 to C2 and the readout follows.
- Sustain: the hold button and CC64 hold a released note and let it go. Panic with hold on clears the
  hold, and the next note rings out normally.
- MIDI through `__synth.midi`: note on and off, CC64, pitch bend and mod reach Filament.
- No stuck notes: switching the rail to Cathode while a key is held, a window blur while a key is held,
  and an octave shift while a key is held all leave no note sounding.
- MIDI deck: a four-note take records with the right order and times (stop with a key down writes its
  note off), exports as `filament-take-YYYYMMDD-HHMM.mid` (format 1, 480 ppq, track named
  "Filament: Wide Novachord Strings"), plays back, loops (position wrapped to 0.97 s of 3.28 s after
  7.2 s), and Stop leaves nothing sounding.
- A three-track .mid built in the test (melody ch 1, bass ch 2, drums ch 10) imports with the
  documented defaults (Filament, Cathode, off), plays, stops cleanly mid-note, and stops by itself
  at the end.
- Deck Render WAV downloads a valid RIFF file, 1.95 s of song plus the 2 s tail, peak 0.70, no NaN,
  no clipped samples.
- Master delay: 1/4 at 120 BPM measured 0.498 s between the note and its echo (expected 0.500).
- Master compressor: threshold -24 dB, ratio 8, limit at -1 dBFS took a six-note chord from a peak of
  0.79 to 0.24. Master render is 24-bit, 44.1 kHz as documented.
- Rack tempo box clamps 300 to 240 and 10 to 40.
- Mixer on the real output (master recorder, 3 s takes): mute, level 0, and another strip soloed each
  bring the output to silence (RMS 1e-5 or 0 against 0.048 normal). Offline renders agree.
- Phone 375: no sideways scroll on Play or Mix, the deck opens inside the width, its buttons are 44 px tall.

### Findings

**R1017-1. Recorder and wheels throw on every device but Filament and Cathode.** Area c, e. Broken.
Measured. Fixed tonight.
- Steps: pick Thyratron (or any of the other 15 non-Filament, non-Cathode devices). Move the pitch strip,
  press hold, or send pitch bend, mod or CC64 over MIDI. Then press the deck's rec and play a note.
- Expected: the wheels and pedal work quietly; the recorder either records or says it cannot.
- Actual: every wheel, pressure or pedal message threw `TypeError: Cannot set properties of undefined
  (setting 'bend')` (or `'sus'`) from `deck.js` `rec()`. Armed, the first note threw after flipping the
  deck to "recording 0:00.3, 0 notes" with a running clock and nothing captured, and the key did not light.
  The sound itself still played, because the call comes after the note is sent.
- Cause: `rec()` looked up per-device controller state that exists only for Filament and Cathode.
- Fix: `rec()` returns early for a device the recorder does not cover and, when armed, says
  "armed: the recorder takes Filament and Cathode only". Test: "M. recorder on a device it cannot record".

**R1017-2. MIDI deck Render WAV leaves out the master bus.** Area e. Broken. Measured. Fixed tonight.
- Steps: switch the master reverb on (mix 0.6, size 0.9), import a .mid, press Render WAV.
- Expected: the file sounds like what plays.
- Actual: the gap after a note had the same level with reverb on and off (RMS 0.0101 against 0.0105 dry;
  the master strip's own render of the same settings measured 0.046 against 0.0019). `deck.js` called
  `renderOffline` without the master state, which defaults to every effect off.
- Fix: the deck passes the master state into the render. After the fix the same gap measured 0.21 wet
  against 0.011 dry. Test: "M. Render WAV carries the master bus".

**R1017-3. Deck Render WAV ignores the mixer.** Area e. Missing. Measured. Not fixed (third defect in the
same area; left for a later night or for James).
- Steps: set Filament's mixer level to 0, Render WAV a file whose melody is on Filament.
- Expected: Filament absent, as it is from the live output.
- Actual: RMS 0.115 at level 0 against 0.112 at full level (renders vary a little run to run).
- Note: `renderOffline` already accepts `mixer`; passing `E.mix.all()` is likely enough, but solo and the
  send returns change what a render contains, so it is worth a decision.

**R1017-4. Two WAV formats.** Area e. Confusing. Measured.
- The deck's Render WAV writes 16-bit 48 kHz (`filament-<file>-<stamp>.wav`). The master strip's render
  wav and the record buttons write 24-bit 44.1 kHz, and the master strip's note says "render save a
  24-bit, 44.1 kHz stereo WAV". The suite pins the deck at 16-bit 48 kHz ("M. Render WAV: ... 48 kHz
  16-bit stereo"), so changing it is a design call, not a fix.

**R1017-5. Three tempos.** Area d. Confusing. Measured.
- The Mix tab's tempo box (the rack transport), the master strip's tempo knob (only the synced delay reads
  it) and the deck's 50-200% slider are independent. Setting the rack tempo to 90 left the master delay at
  120 BPM, so a synced delay drifts against a library song played at 90. Inferred: a user expects one tempo.

**R1017-6. Same label, different jobs.** Area d, e. Confusing. Measured (labels), inferred (impact).
- The header's "● rec" records the master audio to a WAV. The deck's "● rec" arms a MIDI take. The Mix tab
  and the master strip each have a "record" too.
- The master strip's "render wav" renders the held notes (or C4) on the lit patch for N seconds. The deck's
  "Render WAV" renders the imported song or the take. Neither says what it renders on the button.

**R1017-7. Keyboard far down the desktop page.** Area c. Confusing. Measured.
- At 1366 x 900 the page is 4862 px tall and the first key's top is at 4191 px. Every section, including
  the 18-strip mixer and the master strip, sits above the keys. The intro says "Play it with the keys
  below". On a phone the keys are docked at the bottom, so this is desktop only. Computer keys work from
  the top of the page.

**R1017-8. Strip meters read before the fader.** Area d. Confusing. Measured.
- With Filament muted, its strip meter read 0.163 during a note (0.130 unmuted) while the master output was
  silent. `mixer.js` taps the meter from the strip's source. Pre-fader can be deliberate; a muted strip
  that still moves reads as "mute did nothing".

**R1017-9. No safety limiter with the compressor off.** Area d. Confusing. Measured.
- Delay on (feedback 0.95, mix 1), reverb on (size 1, mix 1), compressor off: a 4 s render of a loud chord
  had 187,027 samples at full scale (peak 1.0, RMS 0.79). The ceiling limiter exists but only inside the
  compressor, which is off by default. No NaN.

**R1017-10. Thin strips on a phone.** Area c. Confusing. Measured.
- At 375 px the pitch and mod strips are 22 x 224 px. `docs/filament.md` asks for 44 px targets on phones.

**R1017-11. Octave readout against the visible keys on a phone.** Area c. Confusing. Measured layout,
inferred impact.
- At 375 px the keyboard opens scrolled (scrollLeft 319 of 660) so the first visible white key is C4, while
  the readout says "octave C3" (A on the computer keyboard plays C3). A first-time user may read the label
  as the leftmost visible key.

### Not covered tonight
Areas a, b, f, g, h. Suggested next: f (song library, project save and load), g (Hexode and Anode),
h (accessibility).

## 2026-10-20 (review, areas f, g, h)

Live site https://dxedge.net/synth/, page version `0.19-resnatron`, origin/main `c44ce0a`, sw.js
`dxedge-v110` (live matched the repo). Chromium headless at 1366 x 900 and 375 x 812 (touch). No page
errors or console errors on the rack, Hexode or Anode at either size.

### What worked (measured)

- Song library: all 21 songs load with the right BPM and channel routing (channel 10 to Dekatron), play
  through the Play button once the page has settled (2 to 9 voices within 1.2 s), and Stop leaves 0 voices.
  Loading a song sets the rack tempo to its BPM (rack at 77, Bach loaded, tempo 72). A CC64 pedal in an
  imported .mid holds a released note (1 voice at 0.9 s after a note-off at 0.25 s, pedal up at 2 s).
  Halloween songs apply their named presets and the status line lists them.
- Project: save, change everything, load saved restores Filament, Cathode, tempo (93), the Thyratron
  mixer level (0.3) and the name. Download is `filament-review-night.json` (31.6 kB). A reload boots the
  saved tempo, mixer and name. Uploading the downloaded file applies it.
- Hexode and Anode: load, sound (Hexode peak 0.25, Anode RMS 0.16 at 1366), link back to `/synth/` and to
  each other, no failed requests. Anode has no sideways scroll at 375 px.
- Rack accessibility: `lang="en"`, one h1, 0 unnamed buttons, inputs, selects or sliders at either size.
  Every one of the first 120 tab stops showed a focus outline at both sizes, with no backward jumps.
  Knobs answer the arrow keys and report `aria-valuetext` (semi 0 to 1). With reduced motion the tube show
  reports `reduced: true`, flare and arcs stay 0, and the only running animation is a CSS transition on
  the correlation mark.

### Findings

**R1020-1. The library's first Play does nothing for several seconds after the page loads.** Area f.
Broken. Measured. Fixed tonight.
- Steps: open the rack, pick a song within about 8 s of load, press Play.
- Expected: the song plays.
- Actual: the rack transport starts, the Play button stays unlit, the position stays 0:00.0 and no note
  sounds. A press a few seconds later works. In headless Chromium here the engine existed 2.7 s after
  navigation and the player subscribed to the transport at 10.8 s. Two cold loads reproduced it (Beethoven
  twice in a row, then Bach once).
- Cause: `player.js` subscribed through `withEngine`, which queues until all 16 rack devices have attached,
  while Play called the transport straight away.
- Fix: the player subscribes when Play is pressed and when a song is loaded (the subscribe is idempotent).
  Test: "P. Play before every device has attached starts the song" (holds Resnatron's worklet back).

**R1020-2. Project upload takes any JSON, resets the devices and overwrites the saved project.** Area f.
Broken. Measured. Fixed tonight.
- Steps: on the Mix tab, pick a mix file (`dxmix`), a Filament patch file, or `{"hello": 1}` with
  project "upload".
- Expected: "That file is not a project." and nothing changes.
- Actual: toast `Loaded "Mix".` (or the patch name, or "Untitled"); Filament and Cathode went to Init, the
  tempo to 120, and the project saved in the browser was overwritten. `normalizeProject` turns any object
  into a default project. The mix and project upload buttons sit next to each other.
- Fix: upload requires `kind: "dxrack"` (every project file has carried it since v1). Tests: "R. upload
  refuses a-mix.json and keeps the project", "R. upload refuses patch.json and keeps the project".

**R1020-3. A project leaves out four devices and the master bus.** Area f. Missing. Measured (Thyratron,
Dekatron, Lattice, master reverb), inferred (Gleam, from `collectProject`).
- Steps: set Thyratron Arc Sweep, Dekatron Bones, Lattice Soft Pluck, master reverb on; save project;
  change them; load saved.
- Expected: all of it comes back. The Mix tab note says "The project buttons below keep the patches and
  the tempo as well."
- Actual: Filament, Cathode, tempo, mixer and name came back. Thyratron stayed Walnut Bass, Dekatron Lantern,
  Lattice Choir Wash, reverb off. The downloaded file has 14 devices, not 18, and no master section (the
  master is kept on its own key, `filament_master`).
- Note: adding them is a schema change (new `devices` keys and probably `master`), so it is listed for James.

**R1020-4. A Halloween song replaces an edited patch silently.** Area f. Confusing. Measured for the lit
device, inferred for the others.
- Steps: edit Filament (semi up 3), load Porch Ghost.
- Actual: Filament becomes Theremin Wail with no toast. Undo brings back the edit (measured). For Cathode
  and Dekatron the preset replaces their stored patch without an undo entry (inferred from `applyPresets`).

**R1020-5. Routing is decided against whichever devices are present at load.** Area f. Confusing. Inferred.
- `applySong` builds the default route from the devices registered at that moment. A song picked in the
  first seconds, before Dekatron registers, may send channel 10 elsewhere. Not reproduced tonight.

**R1020-6. Hexode focus is invisible on its own controls.** Area g. Confusing. Measured.
- Tabbing through Hexode: Hold, the Voice select, Viz, Demo 1, Demo 2 and Save had no outline and no box
  shadow when focused (our added controls, S/M/L/XL and the links, do show one).

**R1020-7. Anode's regenerate buttons have no name.** Area g. Confusing. Measured.
- The three `trigger-button` buttons have no `aria-label`; their name is the glyph "⟳".

**R1020-8. Desktop tab order is long, with no skip link.** Area h. Confusing. Measured.
- 408 visible tab stops at 1366 px. The library's songs button is stop 392, the octave buttons 396,
  Panic 399. The phone layout has 91 because the tabs hide the other panels. The piano keys are not
  focusable (the computer keys play from anywhere, so this is a convenience, not a block).

**R1020-9. Repeated control names.** Area h. Confusing. Measured.
- Of 169 visible sliders, 55 share one of 23 names: "level" x4, "mix" x4, "drive", "cutoff", "attack",
  "decay", "release" x3, "oct", "semi", "fine" x2. A screen reader says "oct, slider, 0" without saying
  which oscillator or device.

### Not covered tonight
Areas a, b. Suggested next: a (each device's controls against offline renders) and b (every factory
patch on every device, user patch save, reload and delete).

## 2026-10-22 (review, areas a, b)

Live site https://dxedge.net/synth/, page version `0.19-resnatron`, origin/main `61b1e1b`, sw.js
`dxedge-v122`. Chromium headless at 1366 x 900, plus 375 x 812 (touch, 2x) for the patch bar on every
device. No page errors and no console errors through about 300 patch loads, 36 saves and deletes, and
three reloads. Level figures are the master recorder (24-bit WAV, live audio) for a C4 held 0.7 s,
or C1 (note 36) on Dekatron; generative devices also play on their own, so their figures are not only
the key.

### What worked (measured)

- Patches, all 18 devices: every factory patch in every list (124 in all) loads from the select with the
  right name and has no NaN and no sample at or above 0 dBFS; 122 sound (the other two are R1022-1). Highest peak 0.96 (Geissler, Glass
  Meadow), then Plate Bass 0.94 and Filter Kick 0.93.
- User patches: save ("Review Probe") on each of the 18 devices shows the toast and selects it; after a
  reload all 18 are listed and load, delete is offered on each and removes it; after another reload none
  is left.
- Old patches: a user list holding only `{ name, device }`, or only `{ name }`, loads on every device with
  no errors and sounds on 17 of 18. Resnatron's stub is silent, which is correct: a bay with no cables
  makes no sound.
- Phone 375 px: no sideways scroll on any of the 18 devices; the patch select is 100 px wide at x 56.
- Controls against offline renders. Thyratron, Init patch, 26 panel knobs from min to max: every knob
  changes its own patch field. 20 change the render of one held note. The 6 that do not are the ones a
  single held note cannot show: glide, bend range, osc 2 and osc 3 tune (their levels are 0 at Init),
  osc 3 rate (LFO mode only), and the two mod wheel amounts. Additron, 13 knobs: 12 change the sound
  (perc is R1022-2). Rhumbatron, 6 sliders and Phantastron, 7 sliders: all change their field and the
  sound.

### Findings

**R1022-1. Two Phantastron factory patches make no sound.** Area b. Broken. Measured. Fixed tonight.
- Steps: pick Phantastron, choose Market Bits or Solder Bridge, hold a key.
- Expected: the toy speaks.
- Actual: exact silence, live (master recorder peak 0.0) and offline (RMS 0.0 for 1.2 s). Both patches
  wire VCC to BITS, which took 5 or 6 bits down to 1, and the toy DAC rounds a speaking cart (a signal
  well under 0.5) to zero at 1 bit.
- Fix: a wire into BITS now stops at 3 bits and never adds bits the patch did not have; GND to BITS
  still pins 2. VCC on a 12-bit patch still gives 6 (the existing check). Both patches now speak.
  Check: "Ph. every factory patch speaks when a key is held" and "Ph. a wire into BITS stops at three
  bits and never adds any" (both fail on the live site, `[1, 1]` and RMS 0.0).

**R1022-2. Additron's perc knob does nothing at first.** Area a. Broken. Measured. Fixed tonight.
- Steps: Additron, Init (or any patch on "perc off"), turn perc up to 100%.
- Expected: a percussive attack on the note.
- Actual: the knob reads 100% and the render does not change at all (difference RMS 0.0), because the
  harmonic chips still sit on "perc off". Nothing on the panel says so.
- Fix: turning perc above 0 while the chips read "perc off" picks perc 3 and lights that chip, the same
  way a rotor speed chip turns the rotor on. Check: "Ad. turning the perc knob up from perc off turns
  the percussion on and it sounds".

**R1022-3. Phantastron is very quiet next to the rest of the rack.** Areas a, b. Confusing. Measured.
- Same C4 into the master recorder: Nursery Clock (its first patch) peaks 0.03, Grounded Syllable 0.03,
  Howl Cart 0.17, Slow Drag 0.39. Filament patches peak 0.18 to 0.94 and Cathode 0.28 to 0.93.
  Also quiet: Klystron Buncher Ah (its first patch) 0.08, Filament Horror Pad 0.06, Resnatron Reed
  Drift 0.08. A first-time user on Phantastron hears almost nothing. Inferred cause: the toy DAC sits
  on an absolute -1..1 scale and the speaking carts run far below it. A design call: see Open items.

**R1022-4. Phantastron's bits slider goes silent below 4.** Area a. Confusing. Measured.
- Offline, no wires, RMS by bits (1, 2, 3, 4, 8): Nursery Clock 0, 0, 0, 0.0019, 0.0060; Solder Bridge
  0, 0, 0.074, 0.072, 0.073; Howl Cart 0, 0.0008, 0.042, 0.043, 0.043. Only the tone cart survives 1 bit.
  A GND to BITS wire pins 2 bits, so it silences most carts too. Not fixed: the DAC's shape is pinned by
  a check ("two bits land on five signed steps"), and the cure (gain into the DAC, or a mid-rise step)
  changes how every patch sounds.

**R1022-5. Delete lands on a different patch than the device opens with.** Area b. Confusing. Measured.
- Delete a user patch on Filament: the rack loads Plate Bass (first in list order), not Wide Novachord
  Strings, the device's first sound. Same on Cathode (Grid Bias Bass, not Plate Screamer). There is no
  confirm and no way back to the deleted patch (undo restores its settings but not the list entry).

**R1022-6. Saving under an existing user name overwrites it silently.** Area b. Confusing. Inferred
from `doSave` in `index.html`: a user patch with the same name is filtered out and replaced; the toast
says "Saved" with no mention that one was replaced. Factory names are refused, so factory patches are safe.

### Not covered tonight
Areas c to h. Area a covered Thyratron, Additron, Rhumbatron and Phantastron; the other 14 devices'
controls are still to do. Chips and switches were not swept. Suggested next: c (keyboard and MIDI on the
newer devices), e (the deck), and a on Lattice, Mote and Klystron.

## 2026-10-23 (review, areas c, d, e)

Live site https://dxedge.net/synth/, page version `0.19-resnatron`, origin/main `4b87649` (the new
Mix desk strips had landed about 40 minutes earlier), sw.js `dxedge-v125`. Chromium headless at
1366 x 900 and 375 x 812 (touch, 2x). No page errors or console errors in any run. Focus tonight:
the keyboard and MIDI on all 18 devices, and the arm buttons on the new Mix desk, which change where
the keys, wheels and pedal go.

### What worked (measured)

- MIDI note on and off, pitch bend, CC64 and computer key A on all 18 devices from the rail: every
  device sounds; every one that plays held notes releases (strip meter 0 within 4 s, Lattice's Glass
  Pad within about 11 s, which is its 1.5 s release curve). `__synth.state()` shows nothing held after.
  The generative devices (Mote, Geissler, Pentagrid, Orthicon, Gyrotron) keep playing on their own, as
  designed.
- Arming: Filament and Cathode armed play the note on both; a held note on the rail device released
  after Cathode is armed lets go; arming Cathode, pedal down, then disarming lets go (the strip sleeps).
  Panic with three devices armed clears every voice.
- MIDI deck with Filament and Cathode armed: three notes record on both devices (12 events, "6 notes"),
  play back, and Stop leaves nothing sounding. Render WAV of that take: RIFF, 48 kHz 16-bit stereo,
  peak 0.91, no NaN, no clipped samples.
- Project upload refuses a mix file ("That file is not a project.").
- Phone 375, Mix tab: no sideways scroll (scrollWidth 375), all 18 strips inside the width, no control
  under 44 px.

### Findings

**R1023-1. Pedal down, arm a strip, pedal up: the note rings until Panic.** Area c, d. Broken.
Measured. Fixed tonight.
- Steps: nothing armed, Filament on the rail. Press hold (or send CC64 127), play C4, let go of the key.
  On the Mix tab arm Cathode. Release hold (CC64 0).
- Expected: the C4 on Filament lets go.
- Actual: it rang for the full 12 s watched (strip meter 0.10 to 0.16, one voice) while the hold button
  read off. Disarming Cathode did not stop it either; only Panic did.
- Cause: `setSustain` sends the pedal to whatever the keys play now, so the pedal-up went to Cathode only.
- Fix: the page remembers every device the pedal went down on and sends the pedal-up to those as well.
  Check: "Mx. pedal down on filament, arm cathode, pedal up: the sustained note on filament lets go".

**R1023-2. Upload mix takes any JSON and wipes the desk.** Area d. Broken. Measured. Fixed tonight.
- Steps: set Filament's level to 0.4 and mute Cathode. Press "upload mix" and pick a project file
  (the "download" button two rows up makes one) or any other JSON.
- Expected: "That file is not a mix", nothing changes (project upload already does this the other way).
- Actual: every strip went back to full level, centre, unmuted, no sends; the saved mix in this browser
  was overwritten; the toast said `Loaded mix "Untitled"` (or `"Mix"`).
- Fix: upload mix refuses anything that is not `kind: dxmix`. Check: "Mx. upload mix refuses a file
  that is not a mix (project.json / other.json) and leaves the desk and the saved mix alone".

**R1023-3. The recorder drops armed devices without a word.** Area c, e. Confusing. Measured.
- Arm Filament, Cathode and Thyratron, arm the deck, play three notes: the take holds Filament and
  Cathode only. With only Thyratron armed the deck stays on "armed: play a note" with nothing recorded.
  The "the recorder takes Filament and Cathode only" message added on 17 Oct (R1017-1) only shows for
  the rail device, not for armed strips, because the page passes armed notes to the recorder only for
  Filament and Cathode.

**R1023-4. Wheels moved before arming stay on the old device.** Area c. Confusing. Inferred from
`perf()` in `index.html`: bend and mod go to the current targets only, the same shape as R1023-1. Bend
up on Filament, arm Cathode, let the strip spring back: Filament likely keeps the bend until its next
bend message or Panic. Not measured (no pitch readout on the live meter); lower impact than a stuck note.

**R1023-5. Gleam has no pedal.** Area c. Missing. Measured for CC64: with CC64 down, a released note
on Gleam was silent 1.5 s later while every other held-note device kept it. Inferred for the keyboard's
hold button: `setSustain` has no Gleam branch. Gleam has its own hold (it latches fingers and MIDI
notes), so mapping CC64 and the hold button to it is a design call.

### Still open from earlier runs (re-checked tonight)

- R1017-3: deck Render WAV still leaves out the mixer (`deck.js` `renderArgs` passes the master bus but
  no `mixer`). Inferred from the code tonight; measured on 17 Oct.
- R1017-8: strip meters are still pre-fader: muted Filament read 0.187 during a note.

### Not covered tonight
Areas a, b, f, g, h. Tempo (R1017-5), the keyboard position (R1017-7) and the phone strips (R1017-10,
R1017-11) were not re-measured. Suggested next: a on Lattice, Mote and Klystron; f (does a project
restore the arms?); h on the new Mix desk (the mute and solo chips are named only "mute" and "solo").

## 2026-10-24 (review, areas f, g, h)

Live site https://dxedge.net/synth/, page version `0.19-resnatron`, origin/main `75d8a45` (the slider
fader finish had landed about 1.5 hours earlier), sw.js `dxedge-v133`. Chromium headless at 1366 x 900
and 375 x 812 (touch, 2x), and a reduced-motion context. No page errors or console errors on the rack
or Anode in any run; Hexode logs only the old ScriptProcessorNode and WebGL ReadPixels warnings. The
Chromium path in the task prompt (`chromium-1194`) is gone; the scripts used the default install.

### What worked (measured)

- Project with arms (the 23 Oct suggestion): arm Filament and Thyratron, tempo 97, Lattice level 0.4,
  name "rv night", save project, clear all of it, load saved: both arms (and their chips), tempo, level
  and name come back. A page reload boots the same.
- An older project file (v1, only Filament and a mixer, device Lattice) applies its device, tempo 88
  and Filament level 0.5, and leaves Mote's patch alone.
- Song library: 21 songs in 8 kinds; every song loads and routes channel 10 to Dekatron where it has one.
  Playing Beethoven, a project load mid-song keeps it playing; Stop leaves 0 voices and nothing held.
  Loading another song while one plays stops the first, with 0 voices left 3.5 s later.
- Hexode and Anode at both sizes: no failed requests, both link back to `/synth/` and to each other.
  Anode and the Gleam full-screen page have no sideways scroll at 375 px.
- Rack accessibility: 409 tab stops at 1366 px, every one with a visible focus outline (the only stop
  without one is the document itself); 0 unnamed buttons, inputs, selects or sliders at either size.
  Reduced motion: the tube show reports its reduced set and the only running animation is the
  correlation mark's CSS transition.

### Findings

**R1024-1. Load saved puts the rail device back on an old patch.** Area f. Broken. Measured. Fixed tonight.
- Steps: put Thyratron on the rail (Walnut Bass). Pick Arc Sweep from the patch list. Press save project,
  then load saved.
- Expected: Thyratron stays on Arc Sweep.
- Actual: Thyratron goes back to Walnut Bass, shown as "* Walnut Bass (edited)", and stays there after
  switching away and back. Same on Dekatron (Late Shift back to Relay), Lattice (Root Bass back to Glass
  Pad) and Gleam (Self Orbit back to Amber Field). Cathode kept its pick. A project upload goes
  through the same function (inferred from the code).
- Cause: the page keeps a copy of each device's patch that it writes only when the rail changes device.
  `applyProject` read that copy for the rail device, so for the four devices a project does not carry it
  restored the patch from the moment the device was put on the rail.
- Fix: `applyProject` takes the live patch first, and leaves a rail device the project does not carry
  as it is (name and edited mark too). Check: "R. load saved keeps the patch picked on thyratron (and
  lattice) on the rail".

**R1024-2. The 36 mute and solo chips are all named "mute" and "solo".** Area h. Confusing. Measured.
Fixed tonight.
- Steps: with a screen reader, tab along the Mix desk.
- Actual: each strip reads "mute, toggle button" and "solo, toggle button" with no device, while the
  sliders beside them say "Filament level" and the arm chip "Arm Filament". 18 of each on both layouts.
- Fix: each chip carries `aria-label` "Mute Filament", "Solo Filament" and so on. Check: "Mx. every mute
  and solo chip names its device".

**R1024-3. Hexode's operator toggles have no name.** Area g, h. Confusing. Measured.
- The 13 `dx7-toggle` buttons (each operator's On/Off and Fixed, plus one more) are empty buttons with
  no `aria-label` and no `aria-pressed`; the label sits in a neighbouring div. A screen reader says
  "button". This is vendored Angular code under `/synth/fm/`, so it is left for James (Open items).

### Still open from earlier runs (re-checked tonight)

- R1020-3: a project still carries 14 devices; Thyratron, Dekatron, Lattice and Gleam patches and the
  master bus are not in it (measured from `__synth.project()`).
- R1020-6: Hexode's Hold, Voice, Viz, Demo 1, Demo 2, Save, Reset, Panic and MIDI input show no focus
  ring (9 of the first 40 tab stops, measured).
- R1020-7: Anode's regenerate buttons are still named "⟳" (`acid/js/ui.js`, inferred from the code).
- R1020-8: 409 tab stops at 1366 px, still no skip link.
- Hexode still scrolls sideways at 375 px (1154 px wide).

### Not covered tonight
Areas a, b, c, d, e. Suggested next: a on Lattice, Mote and Klystron (still not done); b (every factory
patch on every device, now that Poly 24 and Velvet Brass are in); a check that the R1024-1 fix holds
for the Halloween presets path (`applyPresets` writes the same stored copies).

## 2026-10-25 (review, areas a, b)

Live site https://dxedge.net/synth/, page version `0.19-resnatron`, origin/main `4fe33df` (the deck and
library faceplate had just landed), sw.js `dxedge-v140`. Chromium headless at 1366 x 900 and 375 x 812
(touch, 2x). No page or console errors in any run. Area a covered the devices the 22 Oct review did not:
Filament (with SVF 12, new yesterday), Cathode, Dekatron and Lattice. Area b covered every factory patch
on all 18 devices and user save, reload and delete on five.

### What worked (measured)

- Every patch-bound control on the four devices moves its own field and only that one when focused and
  stepped with the arrow keys: Filament 76, Cathode 51, Dekatron 11 (the kick page), Lattice 47. Labels
  match the field (for example "stereo off" moves `filt.offset`, "B: EG 2" moves `lpf.b`).
- SVF 12 morph on white noise at 1 kHz, resonance 0 (level relative to the loudest band, 125 Hz to 8 kHz):
  morph 0 is a low-pass (-4.1 dB at 1 kHz, -36.5 at 8 kHz); 1 a band-pass centred on 1 kHz (-14.9 and
  -14.3 dB at 125 Hz and 8 kHz); 2 a high-pass (-35.3 dB at 125 Hz); 3 a notch (-17.7 dB at 1 kHz, within
  3.6 dB elsewhere). The morph knob is hidden on the other five models. At full resonance low-pass,
  band-pass and high-pass self-oscillate (RMS 0.59 to 0.64, peak at most 0.93); the notch does not (0.03),
  as a notch would not.
- An offline sweep of every Filament range and menu value (about 120 renders) found no NaN and no peak
  above 0.95. The sweep could not tell small changes from render-to-render variance (oscillators start at
  a random phase by design), so it is not evidence that every knob is audible; the keyboard check above is.
- All 127 factory patches on the 18 devices load from the patch menu and play C4 plus G4 with a non-zero
  strip meter (0.013 Phantastron to 0.99 Cathode), none above 1.0, except Phantastron, below.
- Save (default name "<patch> 2"), page reload and delete of a user patch on Filament, Cathode, Dekatron,
  Lattice and Phantastron: the patch is listed under Yours, is current after the reload, and is gone after
  delete with a toast.
- Phone 375 px, every tab of Filament, Cathode, Dekatron, Lattice and Phantastron: page width 375, no
  sideways scroll. The rail and the Dekatron step row scroll inside their own strips.

### Findings

**R1025-1. Phantastron dies when a patch is picked while a voice still sounds.** Area b. Broken. Measured.
Fixed tonight.
- Steps: put Phantastron on the rail. Play a key on Nursery Clock and let go. Within about half a second
  pick Market Bits (or hold the key and pick Slow Drag).
- Expected: the new patch plays.
- Actual: Phantastron is silent from then on, on every patch and after Panic, until the page is
  reloaded. Live, picking Market Bits 0.4 s after the key-up broke it in 5 of 23 runs (strip meter 0, the
  device's own meter frozen). Offline (Node, the same engine): 13 of 120 patch pairs broke with the
  switch 0.4 s after the key-up, and 18 of 20 switch times broke going from Nursery Clock to Slow Drag
  with the key held. No page or console error is shown: the error is inside the audio worklet.
- Cause: a voice keeps its index into the old cart's phrase. When the new phrase is shorter (Nursery
  Clock 8 frames, Market Bits 6, Slow Drag 1), the index points past the end, the frame lookup returns
  undefined, and `process()` throws a TypeError, which stops the worklet for good.
- Fix: `phantastron-dsp.js` wraps every voice's index into the new phrase when a patch arrives. Check:
  "Ph. switching to a shorter phrase under a held key keeps the toy speaking" (RMS 0.0 at all three
  switch times on the unfixed code, 0.15 fixed).

**R1025-2. Lattice matrix controls are named by internal ids.** Area a, h. Confusing. Measured. Fixed tonight.
- Steps: Lattice, Mod tab, the matrix rows. Read the controls with a screen reader.
- Expected: the names the row shows ("LFO 1 → Osc A position").
- Actual: the amount slider was "Amount for lfo1 to osc1.pos" and "Amount for lfo2 to cutA", and every
  row's button was just "Remove", so a screen reader could not tell rows apart.
- Fix: "Amount, LFO 1 to Osc A position" and "Remove LFO 1 to Osc A position". Check: "W. matrix amount
  and remove controls name their route in words".

**R1025-3. Delete has no confirmation and no undo.** Area b. Confusing. Measured.
- Steps: pick a patch under Yours, press delete.
- Expected (inferred): a question, or an undo in the toast, since the patch exists only in this browser.
- Actual: one press removes it from storage, shows "Deleted "<name>"." and loads the first factory patch
  (R1022-5). No dialog was raised on any of five devices. Undo restores sounds, not the user list (by
  reading the code). A design call, so left for James.

**R1025-4. Cathode pitch mod A and B barely move from the keyboard.** Area a, h. Confusing. Measured.
- Steps: Cathode, Osc tab, focus "A: MG" (pitch mod depth, plus or minus 24 semitones on a squared
  curve), press the up arrow.
- Actual: each press moves 0.1% of travel. After 1, 10, 20, 50 and 100 presses the readout is +0c, +0c,
  +1c, +6c and +24c. Page Up and End work (End is +24 st). Other knobs step about 1% a press. Likely a
  deliberate fine step near zero; for a keyboard user it reads as a dead knob.

**R1025-5. Phone footer links are 13 px tall.** Area h. Confusing. Measured.
- At 375 px, "Tip the developer" (113 x 13), "Hand Orchestra" (93 x 13), "Hexode" (40 x 13) and "Anode"
  (33 x 13) are text links far under the 44 px target the rest of the phone layout keeps.

Still open, re-measured: R1022-3 (Phantastron strip peaks 0.013 to 0.094 against 0.2 to 0.99 on most
devices), R1022-5 (deleting a Filament user patch lands on Plate Bass, a Cathode one on Grid Bias Bass,
while the devices open on Wide Novachord Strings and Plate Screamer).


## 2026-10-26 (review, areas c, d, e)

Live site https://dxedge.net/synth/, page version `0.19-resnatron`, origin/main `0612588` (the outboard
links finish and the low pass gate had landed overnight), sw.js `dxedge-v145`. Chromium headless at
1366 x 900 and 375 x 812 (touch, 2x). No page or console errors on the live site in any run. The
Chromium path in the task prompt (`chromium-1194`) is still gone; the scripts used `/opt/google/chrome`.
Focus tonight: the master bus at its extremes (offline renders of a six-note chord at velocity 1),
the Mix desk sends, and the deck with a pedal held and a rail switch mid-song.

### What worked (measured)

- MIDI: a note on at velocity 0 is a note off; notes on channel 4 play and release; CC 123 clears a
  three-note chord (0 voices, nothing held); a note retriggered under the pedal holds once and lets go
  when the pedal goes up.
- Computer keys: X twelve times stops at C7 (A plays 96, the quote key 113); Z twelve times stops at
  octave 0 (A plays 12); C and V stop at velocity 13 and 127; a key held through an octave change lets go.
  Typing A in a number box plays nothing.
- Deck: a three-track .mid built in the test (Melody ch 1, Bass ch 2, Drums ch 10) imports with
  Filament, Cathode, off; plays and loops; switching the rail to Thyratron and then Cathode mid-song
  keeps both parts sounding (strip meters 0.07 to 0.42 throughout); Stop leaves 0 voices and no lit
  keys. Render WAV: RIFF, 48 kHz 16-bit stereo, 5.94 s (3.94 s plus the tail), peak 0.78, no NaN, no
  clipped samples.
- Mixer, offline: pan, level (0.5 measured -5.5 dB; renders vary by a few tenths), mute, level 0, another strip soloed, and
  solo plus mute on one strip all behave; level 0, mute and solo-elsewhere are exact silence.
- Master bus, offline: ping-pong with offset, delay at 40 BPM 1/1, and the compressor at attack 0 and
  release 0 give no NaN. Tempo box: 1e3 and 999999 clamp to 240, -5 to 40.
- Phone 375: deck open with a file listed, page width 375, no deck control under 44 px.
- Note for test writers: Filament's "alt" voice pan starts every offline render on the left, so a
  single note on a stereo patch reads 5 to 12 dB left-heavy; live it alternates per note. Not a defect.

### Findings

**R1026-1. The limiter lets peaks over its ceiling.** Area d. Broken. Measured. Fixed tonight.
- Steps: master strip, switch limit on (the safety limiter, ceiling -1 dB). Delay on, feedback 95%,
  mix 100%. Play a six-note chord hard. Or: compressor on with limit on, makeup 12 dB.
- Expected: nothing above the ceiling (0.89, -1 dBFS).
- Actual (offline, live engine): safety limit with the delay peaked 1.18 to 1.41 (+1.4 to +3 dBFS);
  safety limit with reverb at mix 1 peaked 1.71; compressor limit with makeup 12 dB peaked 1.23 to 2.0;
  makeup 24 dB, 2.45. The existing check passed because it only asked for "near" the ceiling.
- Cause: `master.worklet.js` smoothed the limiter's gain per sample with a 2 ms attack and no hold, so
  the gain rose again between waveform peaks and each peak rode over.
- Fix: a peak envelope that jumps to a new peak at once and falls back over about 80 ms; the gain is
  the ceiling over the envelope. Check: "Desk. no sample passes the limiter's ceiling" (before: 0.258
  at a -18 dB ceiling of 0.126, 1.38 and 2.02 at -1 dB; after: exactly the ceiling in all three).

**R1026-2. Stop with the pedal down leaves the pedal down in the take.** Area e. Broken. Measured.
Fixed tonight.
- Steps: arm the deck, press the pedal (CC 64 or space), play and release a note, press Stop with
  the pedal still down, export.
- Expected: the take ends with the pedal up, as it ends with every held note up.
- Actual: the take held `sus on` at 0 and no `sus off`; the exported .mid has CC 64 = 127 and no 0,
  so in another program the pedal stays down for whatever follows. (The deck's own player sends a
  pedal-up at the end, so it was not heard here.)
- Fix: `stopRec()` adds a pedal-up at the end for each device whose last pedal event is down. Check:
  "M. Stop with the pedal down ends the take with a pedal-up, and the exported .mid lets go of CC 64".

**R1026-3. Two reverbs and two delays.** Area d. Confusing. Measured.
- The Mix desk strips have "reverb" and "delay" sends. They feed the desk's own shared room and a
  feedback delay set in seconds (0.05 to 1.5 s, not tempo synced), not the master strip's reverb and
  synced delay. With the master delay off, a strip's delay send at 1 still echoes (tail RMS 0.10
  against 0.03 dry). A user who turns the master delay on and raises a send gets the other delay.
- Options for James: route the sends into the master effects, or rename the desk returns ("desk room",
  "desk echo") so the two are told apart.

**R1026-4. Master reverb at full mix is much louder than dry.** Area d. Confusing. Measured.
- Six-note chord: dry peak 0.57; reverb on at the default size, mix 1: 1.77 (+9.8 dB); size 1, damp 0,
  mix 1: 3.13 in the first second, decaying (not unstable). At the default mix 0.28: 0.72. With limit
  off this hard-clips at the output (R1017-9). The wet gain is not matched to the dry.

**R1026-5. Space is always the pedal, even on a focused button.** Area c, h. Confusing. Measured.
- Tab to hold, the deck's MIDI button or any chip and press Space: nothing happens (the pedal goes
  down and up). Enter works. Space is the standard key for a button, so a keyboard user will try it
  first. Keeping Space as the pedal after a mouse click on a button is also why it is intercepted,
  so this is a design call (for example: Space presses a focused button only after Tab navigation).

**R1026-6. An empty tempo box means 40 BPM.** Area d. Confusing. Measured.
- Select the tempo, delete it, press Enter (or click away): the rack goes to 40 BPM. Keeping the old
  tempo would be safer. Also, 120.7 shows as 121 while the clock runs at 120.7.

**R1026-7. A first device switch can block the page as long as the deck's lookahead.** Area e.
Confusing. Block measured, impact inferred.
- `setDevice` took 151 ms the first time on Trochotron and 125 ms on Lattice (others 0 to 86 ms). The
  deck schedules 150 ms ahead, so a first switch to those during playback could make notes late. Not
  heard or measured as late notes tonight; a switch to Thyratron and Cathode mid-song played cleanly.

### Still open from earlier runs (re-checked tonight)

- R1017-3: `deck.renderArgs()` still has no `mixer` key (patches, device, master, events, seconds,
  capped, sampleRate).
- R1017-5: setting the rack tempo to 90 leaves the master at 120 BPM and its 1/8 delay at 0.25 s.
- R1017-9: limit is still off by default; R1026-4 shows how far over 0 dBFS the bus can go without it.
- R1017-10 and R1017-11: phone strips 22 x 117 px; readout C3 with the first visible key B3 (59).

### Suite note

A baseline run of the suite on origin/main, started while the review's own browser probes were
running, failed six timing checks and then stopped on a click timeout. Two quiet runs of tonight's tree
then failed "Ob. hover and keyboard focus light the socket's ring amber" (new 26 Oct) both times, and
one also failed the Tv. Cathode flare timing check. The Ob. failure reproduced on its own (3 of 3) and
is the check, not the page: it read the style a fixed 250 ms after the hover, and got the link
mid-transition (rgb(252, 177, 71)) or before the hover style landed. The check now waits up to 3 s
for the hover and focus styles, then asserts exactly what it did before (4 of 4 on its own).

### Not covered tonight
Areas a, b, f, g, h. Suggested next: a on the low pass gate and Hollow Pluck (new 26 Oct); f with the
new limiter (does a project carry `comp.safety`?); h on the outboard tray (new 26 Oct).

## 2026-10-27 (review, areas f, g, h)

Live site https://dxedge.net/synth/, page version `0.19-resnatron`, origin/main `cb10caa` (the desktop
rail bay and Filter B had landed overnight). Chromium headless (Playwright's default install; the
`chromium-1194` path in the task prompt is gone) at 1366 x 900 and 375 x 812 (touch), and a
reduced-motion context. No page or console errors on the rack, Hexode or Anode in any run.
Focus tonight: project and mix save and load around the boot, every library song, the two vendored
pages, and the new desktop rail and outboard tray for keyboard and screen reader use.

### What worked (measured)

- Project: name "rv 1027", tempo 97, Filament level 0.4, Lattice pan -0.5, Cathode armed; save, change
  all of it, load saved: everything comes back. Download (`filament-rv-1027.json`, 30 KB) and upload in
  a fresh browser apply the same. A mix file into the project upload says "That file is not a project",
  a project into the mix upload says "That file is not a mix", broken JSON says "not a project".
- Mix session: save mix, change strips and arms, load mix: strips and arms come back and the tempo is
  left alone, as the Mix tab says.
- Master bus across a reload: limit (`comp.safety`) and reverb on both survive (kept under
  `filament_master`, not in the project; R1020-3 still stands for carrying it in a project file).
- Arms across a reload come back once the boot finishes (see R1027-2 for the gap before that).
- Song library: all 21 songs (8 kinds) load, play 1.8 s with level on the strips (0.01 to 0.49; Lantern
  Walk's quiet opening is the 0.01), route channel 10 to Dekatron where they have one, and stop with
  0 voices and no lit keys. Loading a song sets the rack tempo to the song's tempo.
- Hexode at both sizes: loads with no failed requests, a held A sounds (peak 0.25) and lets go (0 after
  release), links back to `/synth/` and to Anode. Anode at both sizes: the start button plays (peak 0.27
  to 0.30), links back to `/synth/` and to Hexode, no sideways scroll at 375 px.
- Rail and outboard (new 27 Oct): screen reader names read "FILAMENT POLY TUBE SYNTH", "HEXODE
  SIX-OPERATOR FM" and so on (name and role, with a space), the lit device is the only one with
  `aria-pressed="true"` after switching, every plate shows a 2 px focus outline, desktop plates are
  134 x 44 px, phone rail buttons 51 to 84 px wide and 44 px tall, no sideways scroll at 375 px.
- Whole page: 0 unnamed buttons, links, sliders, menus or text boxes at either size; no focus stop on an
  invisible or hidden element (426 stops at 1366 px, 91 at 375 px). Reduced motion: the tube show
  reports its reduced set; the only running animation is one CSS transition on `left`.

### Findings

**R1027-1. Save project in the first seconds after opening drops the saved arms and desk bus.** Area f.
Broken. Measured. Fixed tonight.
- Steps: arm Cathode, set the desk room to 2.5, save project. Reload. Open the Rack tab and press save
  project within the first few seconds.
- Expected: the saved project keeps Cathode armed and the room at 2.5.
- Actual (live site): the stored project now has no arms and room 1.1 (the default). Measured with the
  save pressed 0.3, 1.5 and 4 s after the first click; the boot finished 7.4 to 8.4 s after it. Save mix
  in the same window does the same to the mix session (inferred from the code, then checked locally).
- Cause: the saved arms and desk bus are put back by `restoreMixRouting` when every device has attached.
  Before that the page's live arms are empty and the bus is the default, and `collectProject` and
  `collectSession` saved those.
- Fix: until the boot finishes, a save takes the arms and desk bus from the saved project it booted
  with (`liveArmed`, `liveBus` in `index.html`). Check: "R. save project before the boot finishes keeps
  the saved arms and desk bus (and the mix session sees them)" (holds one worklet back so the page
  stays in that window; before: armed [], room 1.1; after: both kept).

**R1027-2. The Mix desk shows no arms and the default bus until the boot finishes.** Area f. Confusing.
Measured.
- For about 8 s after the first click on the live site (headless; a phone is likely slower), every arm
  chip is off and room, delay and feedback show their defaults; then the saved arms and bus appear.
  A player who arms a strip in that window has it replaced by the saved arms at boot (inferred from
  `restoreMixRouting`). Showing the saved arms from the start, or a "loading devices" note on the desk,
  would make it clear.

### Still open from earlier runs (re-checked tonight)

- R1020-3: a project still carries 14 devices and no master bus (`__synth.project()` keys).
- R1020-7: Anode's four regenerate buttons are named "⟳" (measured tonight, was inferred).
- R1020-8: 426 tab stops at 1366 px (17 more than 24 Oct), still no skip link or in-page link.
- R1020-9: 56 names repeat; Filter B repeats the six filter model chips and "cutoff".
- Hexode still scrolls sideways at 375 px (1154 px wide).

### Not covered tonight
Areas a, b, c, d, e. Suggested next: a and b on Filter B (each route, the A / B knob, old patches with
no `filtB`); a on the low pass gate and Hollow Pluck (still not done); c with the new rail on a phone.


## 2026-10-28 (review, areas a, b)

Live site https://dxedge.net/synth/, page version `0.19-resnatron`, origin/main `30005a4` (the filter
response plot and Filter B had landed in the last two nights), sw.js `dxedge-v154`. Chromium headless
(Playwright's own build; the `chromium-1194` path in the task prompt is gone) at 1366 x 900 and
375 x 812 (touch, 2x). No page or console errors in any run but one (below). Focus tonight, from the
27 Oct suggestion: Filter B (every route, the A / B knob, B models, patches carrying it), the low pass
gate and Hollow Pluck, and area a on four devices no review had covered (Klystron, Resnatron,
Gyrotron, Pentagrid).

### What worked (measured)

- Filter B panel at both sizes: the four route chips set `filtB.route` and only the pressed one reads
  `aria-pressed="true"`; A / B shows only on parallel, morph only on SVF 12; the note under the chips
  changes with the route; the readout adds "B 2kHz" when B is on; the six B model chips set
  `filtB.model`. Page width 375 at 375 px on every route.
- Routes, offline (saw C3, A an open SVF 12, B an SVF 12 low-pass at 500 Hz; harmonic 16 relative to
  full scale): off -45.4 dB; serial -70.4 dB; split left -45.4 (A alone, the same as off) and right
  -70.4 (B alone); parallel at A / B -1 equals off and at +1 equals serial, and the fundamental is
  2.8 dB up at the middle. Two identical 500 Hz low-passes in parallel come out 3.1 dB over one, as
  documented.
- B off is a straight wire: B set to Ladder 24, 100 Hz, resonance 1 with the route on "A only" leaves
  the high band within 0.3 dB of B's defaults.
- No clicks on route changes: a sine C3 through A and a Ladder 24 B (600 Hz, resonance 0.5), with the
  route changed mid-note six ways and the B model changed once. The largest sample step near the change
  was 0.0028 against 0.0027 in steady playing.
- Sweep, 114 renders: A on Valve 12, LP gate and Ladder 24, each route, each B model, B resonance 0 and
  1, a four-note chord on Wide Novachord Strings. No NaN and every one sounds. With the output stage
  bypassed the voice bus peaks up to 1.66 at B resonance 1, but A alone at resonance 1 already does the
  same (1.86 on SVF 12), and through the rack the worst case (A and B both singing in serial) peaks 0.983.
- Low pass gate, C4 held 0.5 s at full sustain: "filter + VCA" with lag 0.05, 0.3 and 2 s is at -134,
  -39 and -26 dB 300 ms after the key-up and darkens as it fades (harmonic 8 over the fundamental goes
  from -23.7 dB held to -48.7, -31.7 and -25.3 just after release); "VCA only" fades the same way but
  keeps its brightness (-23.7); "filter only" ends with the amp envelope. Hollow Pluck, a seven-note run:
  no NaN, peak 0.65 through the rack.
- Patches with Filter B: a user patch on split with B on Ladder 24 saves, is still selected and still on
  split after a reload, and the project JSON carries `filtB`. Undo steps back the B model, then the
  route. Picking Hollow Pluck afterwards puts B back to off.
- Area a, four devices, Init or first patch: every visible panel slider, stepped to its end from the
  keyboard, moves its own patch field and renders with no NaN: Klystron 16, Resnatron 28, Gyrotron 15,
  Pentagrid 12. Every Gyrotron and Pentagrid control changes the sound. On Resnatron's Cavity Saw, 13
  controls change nothing because their modules are not cabled (VCO 2, LFO, S&H, mixer, delay, and
  VCO 1 pulse width and FM), which is right for a patch bay.

### Findings

**R1028-1. The filter plot calls a parallel sum a "peak at 20Hz".** Area a. Confusing. Measured. Fixed tonight.
- Steps: Filament, Filter tab, Filter B on "parallel" with the factory defaults (A low-pass 2.3 kHz,
  B low-pass 2 kHz).
- Expected: the readout names a peak only where the curve rises to one.
- Actual: "knobs at middle C: A 2.3kHz · B 2kHz · peak +3.0 dB at 20Hz". The two low-passes sum to a
  flat +3 dB passband, so the highest point is the left edge of the plot, which the readout reported as
  a peak.
- Fix: a peak must stand more than 1 dB above both ends of the plot; otherwise a gain above 1 dB is read
  as "passband +3.0 dB". Resonant peaks read as before ("peak +17.6 dB at 956Hz" on Ladder 24 at 1 kHz,
  resonance 0.8). Check: "Fp. the readout names a flat parallel sum as passband gain, not a peak at
  20 Hz" (failed on the unfixed page: "peak +3.0 dB at 20Hz").

**R1026-6 (from 26 Oct). An emptied tempo box set 40 BPM.** Area d. Fixed tonight.
- Clearing the rack tempo box and pressing Enter (or leaving it) now keeps the tempo and shows it again.
  Check: "R. an emptied tempo box keeps the tempo and shows it again" (before: clock 40, box "40").

**R1028-2. Most of Klystron's gate and focus travel is silence.** Area a. Confusing. Measured.
- Steps: Klystron, any factory patch, hold C4, turn gate (0 to 0.4) or focus (0.6 to 8) up.
- Expected: a usable range across the knob.
- Actual (offline, RMS of a 1 s note): gate at 0.05 (12% of travel) silences Buncher Ah, the first patch;
  gate at 0.1 (25%) silences Buncher Ah, Close Front, Held Frost and Keyed Sine; only Back Cloud lasts
  (-24 dB). Focus at 8 with the gate at 0 costs 25 to 38 dB against each patch's own focus, and with the
  patch's own gate it silences Buncher Ah and Keyed Sine. Bank env a at its top (0.2 s) silences Buncher Ah.
- Inferred cause (code): the gate is an absolute threshold on each band's envelope, and on the pad
  vowels those envelopes run far under 0.1; the band-pass gain also drops as the Q rises. Rescaling the
  gate, or setting it relative to the loudest band, would change how existing patches sound: a call for
  James. Related: R1022-3 (Buncher Ah is quiet to begin with).

**R1028-3. Resnatron has two level controls that do the same thing.** Area a. Confusing. Measured.
- The panel's "Level" slider (patch `level`) and the Out module's "Out level" (`out.level`) are
  multiplied together (`0.45 × out.level × level` in `resnatron-dsp.js`). Each at its end gives the same
  render (difference RMS 0.0107 from the patch, both peaks 0.262). A player turning one up may find the
  other was the one holding it down. One of them could go, or the panel one could be labelled as the
  device trim.

**R1028-4. LP gate in A with B on split or parallel: the sides decay apart.** Area a. Confusing. Measured.
- Steps: Filter A on LP gate (filter + VCA, lag 0.3 s), Filter B on split, hold a note and let go.
- Actual: 1.2 s after the key-up the left side (A, the gate's filter) is at -114.6 dB and the right
  (B) at -64.2 dB; on parallel the sum is at -67.3 dB against -114.6 with B off or serial. B takes the
  light cell's level but not its darkening, so the tail swings right and stays bright. This matches the
  27 Oct note that the gate stays in slot A, but neither note on the panel says so.

- Test timing: the first suite run tonight failed "Fp. a patch change redraws the knob curve (Ladder 24 at
  300 Hz) and the readout says so" once. The readout is written by the 30 fps frame loop, 10 to 70 ms after
  the knob curve lands (measured locally), and the check read it the moment the curve landed. It now waits
  for the readout as well; what it asserts is unchanged.

### Still open, re-measured tonight
- R1025-3: delete removes a user patch with no dialog.
- R1022-5: deleting a Filament user patch lands on Plate Bass, not Wide Novachord Strings.

### Notes
- One offline Klystron render failed once with "AbortError: Failed to load worklet module script:
  https://dxedge.net/synth/klystron.worklet.js", after about 60 renders in one page. The same script run
  again did not see it. Likely a network blip (inferred); worth watching if it comes back.
- An old user patch without `filtB` was not re-tested live tonight (the injection used the wrong storage
  shape); the suite's normalize checks cover it, and the 22 Oct review covered stubs.

### Not covered tonight
Areas c, d, e, f, g, h. Suggested next: c and e (the deck with the new rail on a phone; R1023-3 and
R1023-4), and d with the tempo fix live.

## 2026-10-29 (review, areas c, d, e)

Live site https://dxedge.net/synth/, page version `0.19-resnatron`, origin/main `c319d6d`, sw.js
`dxedge-v157` (live matched the repo). Chromium headless (Playwright's own build; the
`chromium-1194` path in the task prompt is still gone) at 1366 x 900 and 375 x 812 (touch, 2x). No
page or console errors on the live site in any run. Focus tonight: the new mod matrix driven from the
wheel, pressure and bend over MIDI, the master bus knobs measured against their labels, and the deck's
take, export, import and loop round trip.

### What worked (measured)

- Mod matrix from MIDI, live (master recorder): a sine patch with slot 1 wheel to level at -100%
  plays at -16 dB with CC 1 at 0 and -101.5 dB with CC 1 at 127.
- Wheel and bend across a device switch: wheel up on Filament, switch to Cathode, wheel to 0, back to
  Filament: the strip reads 0 and Filament plays at full level. Bend up (493.9 Hz for A4), switch to
  Cathode, bend centred there, back to Filament: 440.0 Hz. Panic leaves the note normal.
- A take with the wheel moving mid-note: live -20.6 / -26.7 / -57.8 dB (wheel 0, half, full); deck
  Render WAV -20.9 / -27.1 / -50.9; the exported .mid carries CC 1 (64, 127, 0) at the right times, and
  the re-imported file renders the same (-20.9 / -27.1 / -50.8). Render: RIFF 48 kHz 16-bit, peak 0.198,
  no NaN.
- Master compressor static curve (A5 sine at -17.3 dBFS peak, knee 0): threshold -24 ratio 8 gives
  -23.0 (peak-detect model -23.2); threshold -30 ratio 2 gives -23.5 (model -23.7).
- Master delay unsynced at 375 ms, feedback 0.35: echoes at 0.375 s spacing, each 9.1 dB down (the
  feedback says 9.1). Reverb width 0 gives identical L and R (-176 dB difference). Reverb or delay
  switched on at mix 0 leaves the level unchanged (0.00 dB).
- Deck stop after a looping take: no voices and a zero strip meter 3 s later. Eight-note chord at
  velocity 1 on Velvet Brass with default master settings peaked 0.705 live.

### Findings

**R1029-1. An exported take loses the silence after its last note, so it loops short.** Area e.
Broken. Measured (lengths and loop positions). Fixed tonight.
- Steps: arm the deck, play a note, wait a second, press stop. Export .mid, import the file, turn loop on
  and play it.
- Expected: the file is as long as the take and loops at the same point.
- Actual: a 1.37 s take exported as a 0.62 s file. Looping, the take wrapped every 1.37 s and the
  re-imported file every 0.62 s. In another program the clip is also short.
- Cause: `writeSMF` put each track's end at its last event; the reader honours the end-of-track time,
  so the file had nothing to say where Stop was pressed.
- Fix: `writeSMF` takes a `length` in seconds and ends every track there (0, the default, keeps the old
  behaviour for Gyrotron and Trochotron); the deck passes the take's length. Check: "M. the exported .mid
  keeps the take's length" (before: 0.196 s against 0.812 s; after: 0.777 against 0.777).

**R1029-2. Pressure held when a take starts is left out of the take.** Area c, e. Broken. Measured.
Fixed tonight.
- Steps: hold channel pressure (or send D0 100), arm the deck, play a note, stop.
- Expected: the take starts with the pressure, as it already does for the pedal, bend and wheel.
- Actual: the take began with the pedal and the note only; no pressure event, so a patch with pressure
  on cutoff or (now) any mod matrix slot plays the take back differently from what was played.
- Fix: `rec()` writes the held pressure at time 0 with the others. Check: "M. pressure held when a take
  starts is written at its start, and the .mid carries it" (before: none; after: 0.787 and D0 100).

**R1029-3. Record captures after the master volume.** Area d. Confusing. Measured; impact inferred.
- Steps: set the master volume to 25%, record a chord with the header's record.
- Actual: the WAV is 11.5 dB quieter than the same chord at 100% (RMS -28.6 against -17.1 dB). A user
  who turns the monitor level down to play quietly gets a quiet file. A design call: record before the
  volume, or say on the control that it is part of the recording.

**R1029-4. Mixer pan is a balance control.** Area d. Confusing. Measured.
- Offline, one sine voice: centre L and R -20.32 dB; pan -1 L -20.32, R silent; pan -0.5 L -20.32,
  R -23.33. A mono voice panned hard sounds about 3 dB quieter than centred (equal-power panning would
  hold it level). Common on stereo sources, so a design call; worth one line in the mixer's help.

### Still open from earlier runs (re-checked tonight)

- R1017-3: `deck.renderArgs()` still has no `mixer` key.
- R1017-5: rack tempo set to 90 in the tempo box leaves the master at 120 BPM and its 1/8 delay at 0.25 s.
- R1017-8: a muted Filament strip still meters 0.12 with a note held.
- R1017-10 and R1017-11: phone strips 22 x 117 px; readout C3, first visible key 60.
- R1023-3: with Filament and Thyratron armed, the take holds Filament only and the deck says nothing.
- R1026-5: Space on the focused rec button does not arm it; Enter does.

### Not covered tonight
Areas a, b, f, g, h. Suggested next: f, g, h (does a project carry the mod matrix and filter B;
the mod matrix panel with a keyboard only).

## 2026-10-30 (review, areas f, g, h)

Live site https://dxedge.net/synth/, page version `0.19-resnatron`, origin/main `07c6a4e` (tempo-synced
LFOs and the three-row phone header had landed overnight). Chromium 1243 headless (the `chromium-1194`
path in the task prompt is gone) at 1366 x 900 and 375 x 812 (touch, 2x), and a reduced-motion
context. No page errors on the rack, Hexode or Anode. Hexode logs the browser's ScriptProcessorNode
deprecation warning (vendored code). Focus tonight: projects carrying the new patch fields, the song
library routed to every device, and keyboard and screen reader use of the new Mod tab and header.
Audio was measured on the live output with the master recorder (`E.fx.recordStart` and `recordStop`)
and the strip meters; levels are peak and RMS of the left channel over 2 to 2.5 s.

### What worked (measured)

- Project with the new fields: LFO 1 sync 1/8, LFO 2 sync 1/4d, mod slot 1 lfo1, slot 2 to pitch at
  -0.3, Filter B serial at 900 Hz. Save project, load Hollow Pluck, load project: all of it comes back,
  and the sync menus and slot menus on the panel show it. Download is `filament-rv-1030.json` and
  carries the same fields; uploading it in a fresh browser applies them and the project name.
- An old project with no `mod`, no `filtB` and no LFO `sync` loads with no error and gets the defaults
  (sync off, slots off, Filter B off).
- Library: switching songs while one plays stops the first (0 voices at once and 2 s later); a key held
  through a library play and stop is still held; a tempo change from 150 to 60 mid-song keeps playing
  and the time readout follows (0:12.1 long becomes 0:30.2); loop at 240 BPM wraps at 0:08.0 twice in
  16 s; loading a project while a song plays keeps it playing; every stop leaves 0 voices.
- Hexode at both sizes: a held A sounds (peak 0.26) and lets go (0), links back to `/synth/` and to
  Anode, no failed requests. Anode at both sizes: start plays (peak 0.55 at 1366, 0.40 at 375), links
  back to `/synth/` and to Hexode, no sideways scroll at 375 px.
- Rack, both sizes: 0 unnamed controls (457 at 1366, 95 at 375); a Tab walk of every stop (452 at
  1366, 91 at 375) shows an outline or ring on each one, the Mod tab's selects and knobs included. The
  new size switch is a named group ("Control size") of four buttons with `aria-pressed` and titles.
  Reduced motion: the tube show reports its reduced set (no flare, no arcs) with a note held; the only
  running animation is the correlation marker's `left` transition.

### Findings

**R1030-1. A library channel routed to most hosted devices plays nothing.** Area f. Broken. Measured.
Fixed tonight.
- Steps: open songs, pick Dock Lamp, set each channel to Lattice (or Mote, Klystron, Rhumbatron,
  Gyrotron, Orthicon, Pentagrid, Geissler, Resnatron) while Filament is on the rail. Press play.
- Expected: the song on that device, as it does on Filament, Cathode, Thyratron, Gleam or Additron.
- Actual (Dekatron muted, so only the routed device is heard): Lattice RMS 0.0002, Mote 0.0002,
  Gyrotron 0.0001, Rhumbatron 0.0012, Klystron, Orthicon, Pentagrid, Geissler and Resnatron 0, against
  Filament 0.14, Cathode 0.17, Thyratron 0.14, Additron 0.23. The strip meters read 0. Visiting the
  device on the rail first, then going back, made Lattice play; Resnatron also needed its patch sent.
- Cause: the player's `arm()` woke Filament and Cathode only. The other hosted devices sleep while off
  the rail and drop or never voice the notes.
- Fix: `arm()` calls the page's `wakeDevice` (the same call the Mix desk's arm uses: active, plus the
  device's current patch) for each hosted device a song routes to, and stop puts them back to sleep
  with `sleepDevice`, which never sleeps the rail device or an armed strip. Check: "P. a channel
  routed to Lattice or Resnatron off the rail sounds (review R1030-1)" (a fresh page; before: strip
  peak 0 and 0; after, local: 0.40 and 0.18).

**R1030-2. After a song with drum hits, Dekatron's pattern no longer plays.** Area f. Broken. Measured.
Fixed tonight.
- Steps: in a fresh page, press Play on the Rack tab: Dekatron's pattern plays (strip peak 0.58). Load
  The Entertainer (channel 10 on Dekatron), play a second, stop. Press Play on the Rack tab, or play
  any song, or press play on Dekatron's own panel.
- Expected: the pattern follows the transport as before.
- Actual: no pattern (strip peak 0.009 on the Rack tab's play; Greensleeves afterwards 0;
  `drumMeter().playing` false) for the rest of the session while a song is loaded.
- Cause: every transport play also runs the player's `startFrom`, whose `silence()` posted a Dekatron
  `panic` for any device it had ever touched. The panic lands after the transport message that armed
  the pattern and disarms it.
- Fix: the panic goes to Dekatron only when this run sent it hits. Check: "P. Dekatron's pattern still
  follows the transport after a song with drum hits (review R1030-2)" (before: false on the second
  play; after: true).

**R1030-3. Dekatron's pattern plays under every library song.** Area f. Confusing. Measured.
- Dock Lamp, Greensleeves and Symphony No. 5 have no channel 10, yet Dekatron's own step pattern runs
  with the transport: Dekatron strip peak 0.51 to 0.57, Dock Lamp RMS 0.256 with it against 0.167 with
  Dekatron muted. A song that does route channel 10 to Dekatron gets the pattern and its own hits at
  once. The build notes list it as a known limit ("Playing a song also starts the rack clock"); the
  page does not say so. Inferred: a first-time user hears a drum loop that is not in the song. Before
  tonight's R1030-2 fix it went away after the first drum song, so it was also inconsistent. Design
  call: hold the pattern while a song plays, or say it on the library strip.

**R1030-4. Heptode is a channel target that plays nothing.** Area f. Confusing. Measured.
- Dock Lamp with every channel on Heptode: RMS 0 off the rail, woken, and with Heptode on the rail.
  Heptode plays its own MIDI file; it is still listed among the channel chips, so the chip silences the
  channel with no word. Either drop it from the chips or have it voice incoming notes.

**R1030-5. Changing a channel's device mid-song stops Dekatron's pattern.** Area f. Confusing.
Inferred (code).
- `setRoute` while playing calls `silence()`, which still panics Dekatron when the run has sent it hits,
  so the pattern disarms until the next play. Same cause as R1030-2; left alone because the panic there
  is also what clears hits already queued for the old route.

**R1030-6. The mod matrix amount knobs share one name.** Area h. Confusing. Measured.
- The eight knobs on the Mod tab have `aria-label="amount"`; the slot number is only in the tooltip
  ("Mod slot 1 amount: ..."). The slot menus next to them are named "Mod slot 1 source" and so on. A
  screen reader hears "amount" eight times. Naming them "Mod slot N amount" would match the menus.

### Still open from earlier runs (re-checked tonight)

- R1020-3: a project still carries 14 devices (no Thyratron, Dekatron, Lattice, Gleam) and no master
  bus (`__synth.project()` keys).
- R1020-7: Anode's regenerate buttons are still the glyph "⟳" (`acid/js/ui.js`).
- R1020-8: 452 tab stops at 1366 px (26 more than 27 Oct, mostly the Mod tab), still no skip link.
- R1020-9: 58 names repeat at 1366 px ("amount" x8 is new; "off" x6, "cutoff" x4, "level" x4).
- R1024-3: Hexode's 13 operator toggles still have no name (both sizes).
- R1025-5: phone footer links still 13 px tall (Tip the developer, Hand Orchestra, Hexode, Anode,
  DXEdge, Old Time Radio).
- R1017-10: phone pitch and mod strips still 22 x 117 px.
- Hexode still scrolls sideways at 375 px (1154 px wide).

### Not covered tonight
Areas a, b, c, d, e. Suggested next: a and b on the tempo-synced LFOs (each note value against the
rack tempo, old patches with no `sync`), and a on the mod matrix destinations.

## 2026-10-31 (review, areas a, b)

Live site https://dxedge.net/synth/, page version `0.19-resnatron`, origin/main `dae7ccf`, sw.js
`dxedge-v164` (live and main agree). Chromium headless (Playwright's chromium-1243; the `chromium-1194`
path in the task prompt is still gone) at 1366 x 900 and 375 x 812 (touch, 2x). No page or console
errors in any run. Focus tonight: the arpeggiator (new on 31 Oct) as a player would use it, the
tempo-synced LFOs against the rack tempo (the 30 Oct suggestion), and area b on every device's patch
menu, the arrows, save, reload and delete.

### What worked (measured)

- Arpeggiator panel at 1366 and 375: the on switch, five mode chips (one pressed), the 11-step menu,
  latch, and the octave, gate and swing knobs all write `patch.arp`; the readout follows the rack
  tempo ("8.00 steps/s at 120 BPM", then "6.00 steps/s at 90 BPM" after a tempo change). Phone: every
  control is 44 px tall, page width 375.
- Live, computer keys (A, D, G held 1.2 s at 90 BPM, 1/16): the meter's step count climbed 2 to 9;
  let go, the arp stopped (keys 0, not running). Latched: two tapped keys kept stepping; switching the
  rail to Cathode and back dropped them (keys 0, voices 0); rack Play and Stop kept a latched arp
  stepping; panic cleared it.
- The song library with the arp on (Greensleeves, all three channels on Filament): the arp took the
  song's notes (1 to 4 keys, step count 1 to 23 over 3 s); Stop left 0 voices and 0 keys, latched or not.
- Offline renders with the arp on: mono, legato with glide, unison 8, 4 octaves from notes 110 and 118
  (wrapped below 128), gate 100% with swing 75% at 1/32, random over 3 octaves. No NaN, peaks 0.29 to
  0.47, no sample step over 0.29 (the high notes; 0.06 to 0.13 elsewhere).
- Tempo-synced LFO 1 on the amp, every note value from 1/1 to 1/32 at 80 and 150 BPM: the measured rate
  is within 0.1% to 2.6% of tempo / 60 / beats; the larger errors are the slow values, where a 2 s render
  holds only two or three cycles (measurement resolution, not the LFO).
- Area b: every factory patch on 17 devices selected from the menu with no error and the menu showing
  it (Filament 25, Cathode 19, Thyratron 6, Gleam 7, Mote 3, Heptode 1, Geissler 3, Pentagrid 6,
  Orthicon 5, Trochotron 6, Gyrotron 3, Klystron 5, Phantastron 6, Additron 5, Rhumbatron 7,
  Resnatron 4, Dekatron 8; Lattice's 8 checked separately). A Filament user patch saved with the arp on
  up-down came back selected and on after a reload; an old user patch with no `arp`, `filtB` or `mod`
  loaded with the arp off and the panel saying so; undo after switching the arp on switched it off.

### Findings

**R1031-1. The master strip's Render WAV ignores the rack tempo.** Area a, d. Broken. Measured. Fixed tonight.
- Steps: set the rack tempo to 80, switch the arp on at 1/8, hold a chord, press the master strip's
  render wav.
- Expected: steps every 0.375 s, as you hear it.
- Actual: steps every 0.2505 s at rack tempos 80, 120 and 160 alike: the render ran at the engine's
  default 120 BPM. The same holds for tempo-synced LFOs (inferred: they read the same clock). The deck's
  Render WAV already passed the tempo; `renderToWav` in `wav.js` did not.
- Fix: `renderToWav` takes `tempo`, and both master render paths pass the rack tempo. After: 0.3755 to
  0.376 s. Check: "M. the master Render WAV steps the arpeggiator at the rack tempo" (before: 0.2505).

**R1031-2. The patch arrows skip around the menu.** Area b. Confusing. Measured. Fixed tonight.
- Steps: Filament, pick Snarl Lead, press the next arrow.
- Expected: Seven Filaments, the next patch shown in the menu.
- Actual: Wide Novachord Strings. The menu groups patches by category, but the arrows walked the
  factory list's own order, so a patch filed out of order in that list (Seven Filaments, Lattice's
  Choir Wash and Drift Cloth, Gleam's Self Orbit, Klystron's Keyed Sine, two of Orthicon's and
  Resnatron's) came up out of turn, and the next arrow from the last patch did not always land on the
  first one shown (Gleam: Master Sweep to Self Orbit).
- Fix: the arrows walk the menu's own options, factory groups then yours. Checks: "Pn. the next arrow
  walks the patch menu in the order it shows" and "Pn. the previous arrow walks back the same way" (both
  failed on the unfixed page).

**R1031-3. Picking a patch switches the arpeggiator off.** Area a, b. Confusing. Measured.
- Steps: switch the arp on and latch a chord, then pick any factory patch (or press an arrow).
- Actual: the arp stops and its settings go back to the defaults, because they live in the patch and
  every factory patch has it off. Auditioning sounds under a running arpeggio is a common way to browse
  patches. Whether the arp should be a patch setting or a device setting (or a "keep arp" switch) is a
  design call for James.

**R1031-4. A MIDI take records the keys, not the arpeggio.** Area a, e. Missing. Measured (take), inferred (impact).
- Steps: arp on, arm the deck, hold C3 and G3 for a second, stop.
- Actual: the take holds two notes (on at 0 and 0.03 s, off at 1.09 and 1.13 s). Playback on the rack
  arpeggiates them again, so it sounds right here, but the exported .mid is a held chord in any other
  program, and the arp restarts free-running on playback rather than on the bar it was played on. A
  choice for James: record keys (as now), record the arp's notes, or offer both.

### Still open, re-measured tonight
- R1022-5: deleting a Filament user patch still lands on Plate Bass, not Wide Novachord Strings.
- R1025-3: delete still removes a user patch at once with no question.

### Not covered tonight
Areas c, d (beyond the render tempo), e, f, g, h. Suggested next: c, d and e: the arp with a MIDI
keyboard over `__synth.midi` (CC64, bend while stepping), the deck playing back an arp take with the
rack running, and the master render of a synced LFO patch now that it carries the tempo.

## 2026-11-01 (review, areas c, d, e)

Live site https://dxedge.net/synth/, page version `0.19-resnatron`, origin/main `e9e9244`, sw.js
`dxedge-v168` (live and main agree). Chromium headless (Playwright's chromium-1243; the
`chromium-1194` path in the task prompt is still gone) at 1366 x 900 and 375 x 812 (touch, 2x). No page
or console errors on the live site in any run. Focus tonight: the tape echo (new on 1 Nov) the way a
player meets it (Panic, patch changes, the rail, the renders, the deck's tempo), the arpeggiator over
MIDI with the pedal and bend (the 31 Oct suggestion), and the deck's import, play, stop and Render WAV.

### What worked (measured)

- Tape echo in both renders: the master strip's render wav and the deck's Render WAV of the same note
  both carry the repeats (the gap 0.6 to 1.0 s after the note reads -37.4 dBFS in each; -240 with the
  echo off). The deck's render args carry the Filament patch's echo fields.
- A factory patch picked while a sine echo tail rings: no click (largest sample step 0.0049 against the
  sine's own 0.0051, three tries at different points in the tail).
- Hot echo, offline: a six-note chord at velocity 1 into ping-pong, feedback 100%, mix 100%, drive 10,
  master effects off: peak 0.475, no NaN, nothing above 1.
- Arpeggiator: latched, then Panic: silent, and the next key plays only itself. Computer keys held
  with an octave shift mid-hold leave nothing sounding. Over MIDI: CC64 down keeps it stepping after
  the keys are let go, a full bend while it steps leaves it stepping, CC64 up stops it. A take of an
  arp chord plays back with the transport running and leaves nothing sounding at its end.
- MIDI deck: a .mid with a tempo change (120 to 60 BPM after two beats) reads its notes at 0, 0.5, 1.0
  and 2.0 s and a length of 2.5 s. A format 0 file with channels 1, 2 and 10 splits into three parts
  (Filament, Cathode, off). Moving the rail to Thyratron mid-file keeps Filament's notes sounding, and
  Stop then clears them and the keys. Panic stops playback and resets the play button. Render WAV by
  the button: `filament-tempo-<stamp>.wav`, 48 kHz 16-bit stereo, 4.5 s (2.5 s plus the 2 s tail), peak
  0.34, no clipped samples.
- Phone 375: no sideways scroll on any of the seven tabs; the Tape echo section sits on the Rack tab
  with 44 px chips and 52 x 69 px knobs.

### Findings

**R1101-1. Panic does not stop the tape echo.** Area c, d. Broken. Measured. Fixed tonight.
- Steps: switch the tape echo on with feedback near 100% (95 is enough), play a note, let go, press
  Panic (its tooltip: "Silence every note").
- Expected: silence, as for every voice.
- Actual: the repeats went on at the same level through the whole 3 s recording after the panic (-29
  to -27 dB a repeat, every 250 ms); at 100% they go on until the echo is switched off.
- Fix: the engine's panic empties the tape: the feedback and the wet sides drop to 0 until the tape
  has run past both heads, then the patch's echo comes back. The dry path is untouched, so a note
  played straight after still sounds. Check: "Te. Panic empties the tape" (unfixed: -38 dB before the
  panic and -39 after; fixed: -30 before, -150 or below after, and a new note echoes at -36).

**R1101-2. Tape echo feedback runs hotter than its knob.** Area d. Confusing. Measured.
- Offline, a sine blip, mono, 200 ms, tone 10, drive 0, the level of repeat 30 against repeat 1:
  feedback 90% -13.0 dB (a loop gain of 0.90 would lose 27 dB), 95% 0.0 dB (never decays), 100%
  +12.1 dB (grows until the record amp holds it). Drive 5: -17.2, -0.3, +9.9 dB. The suite's 85% check
  (-1 to -2.5 dB a repeat) passes. Inference: the record amp's small-signal gain is a little above 1,
  so the last 10% of the knob is already runaway. Whether that is the intended feel ("near 100% it keeps
  going") or the knob should be rescaled is a sound call for James.

**R1101-3. The tape echo's tail is cut when the rail moves.** Area d. Confusing. Measured (cut),
inferred (impact).
- Steps: Filament with the echo on (feedback 95%), play a note, let go, pick Cathode on the rail.
- Actual: the repeats fall from -28 dB to silence within 0.1 s, because the one echo follows the lit
  device's patch (Cathode's has it off). Picking a factory patch on Filament does the same. The same
  rule means a Filament part played by the deck while the rail is on Cathode goes through Cathode's
  echo settings. It matches how the EQ and output tubes already work, so it is a design question: let a
  tail ring out across a rail or patch change, or say on the section that the echo belongs to the lit
  device.

**R1101-4. Log knobs show their quantized position, not the patch value.** Area d, h. Confusing.
Measured.
- The tape echo's time is 375 ms in the patch and the engine, but the knob and its aria-valuetext read
  "376ms". Arrow up then down from 1000 ms lands on 999.5 ms. `knob.js` rounds the 0 to 1 position to
  its step and shows the mapped value of that position; every LOG-mapped knob does this (cutoff, lag,
  the echo time). Cosmetic, but it reads as a wrong default.

### Still open, re-measured tonight
- R1017-3: `deck.renderArgs()` still has no `mixer` key.
- R1017-5: now four tempos in play: the tape echo's sync follows the rack tempo, the master delay its
  own knob (120 after the rack moved), and the deck's rate at 50% moves neither (rack 120, master 120),
  so a synced echo runs at double speed against a file played at half rate.
- R1017-9 and R1026-4: the hot echo chord above with the master reverb at mix 1 and limit off peaks
  2.57 with 11,523 samples above 1.0 (offline).
- R1017-10 and R1017-11: phone pitch and mod strips 22 x 117 px; octave readout C3.
- R1026-5: Space on the focused hold button does not press it; Enter does.
- R1031-4: an arp take of a three-note chord held 1 s holds three note-ons.

### Not covered tonight
Areas a, b, f, g, h. Suggested next: f, g, h (does a project carry the tape echo and the arp; the echo
and arp panels with a keyboard only and a screen reader's names).

## 2026-11-02 (review, areas f, g, h)

Live site https://dxedge.net/synth/, origin/main `6035445`, sw.js `dxedge-v172` (the spring reverb and
the fader readout windows had landed overnight). Chromium 1243 headless (the `chromium-1194` path in
the task prompt is gone) at 1366 x 900 and 375 x 812 (touch, 2x), and a reduced-motion context. No
page errors on the rack, Hexode, Anode, Iris or Gleam. Audio was read from the live output with the
master recorder (`__synth.recordStart` and `recordStop`, a 24-bit WAV decoded in the script) and the
strip meters; offline renders went through `__synth.render`. Focus tonight: every library song, a
project carrying the new spring reverb and tape echo, the new fader readouts from the keyboard, and
names and focus for the new sections.

### What worked (measured)

- Library: all 21 songs, played 3 s each on a fresh page at the defaults, sound (peak 0.56 to 0.97,
  RMS 0.06 to 0.34), with no sample at full scale and no NaN. After each stop the output is under
  0.003 peak within 2.5 s, with 0 held notes and 0 voices.
- Project with the new fields: Filament with the spring reverb on (mix 40, decay 3.3, drip 70) and the
  tape echo on. Save project, load another factory patch (spring off), load project: both come back,
  and the spring switch reads "on" with `aria-pressed="true"`. Offline renders of one note through
  that patch (dry, spring, echo, both, and spring at mix 100, decay 6, drip 100, drive 10): no NaN,
  largest sample step 0.02 to 0.10, peak at or under 0.38.
- Fader readouts (new): three Left arrows on Filament level, pan, the desk room and feedback move the
  window and `aria-valuetext` together (-0.3 dB, L3, 1.07 s, 32%); `setMixer` with level 0.5 and pan
  -0.4 shows -6.0 dB and L40. The deck tempo window reads 100%.
- Hexode at both sizes: a held A sounds (peak 0.31 and 0.32) and lets go (0); links back to `/synth/`
  and to Anode. Anode at both sizes: start plays (peak 0.18), links back to `/synth/` and Hexode, no
  sideways scroll at 375 px. Iris and Gleam load at both sizes, link back, no sideways scroll.
- Rack, both sizes: a Tab walk (481 stops at 1366, 102 at 375) finds 0 unnamed stops and an outline or
  ring on every one, the spring reverb's switch and knobs included. Reduced motion: with a note held
  the tube show reports its reduced set (no flare, no arcs); the only running animation is the
  correlation marker's `left` transition.

### Findings

**R1102-1. The tape echo and spring reverb knobs are named "mix", "tone", "drive", "decay".** Area h.
Confusing. Measured. Fixed tonight.
- Steps: Tab through the Rack tab with a screen reader (or read `aria-label` on `#kEcho .knob` and
  `#kSpring .knob`).
- Expected: a name that says which section the knob is in, as the mixer faders do ("Filament level").
- Actual: the two new effects added "mix" x2, "drive" x2, "tone" x2 and "decay" to names that already
  repeat (desktop totals tonight: "mix" x6, "drive" x5, "tone" x4, "decay" x4), on top of the
  eight mod matrix knobs all named "amount" (R1030-6).
- Fix: `K()` takes a `name` option for the screen reader name; the panel label stays short. The
  echo knobs are "Tape echo time" and so on, the spring knobs "Spring reverb mix" and so on, and the
  mod knobs "Mod slot 1 amount" to "Mod slot 8 amount", matching the slot menus. Closes R1030-6.
  Check: "Rv. the 7 tape echo, 5 spring reverb and 8 mod amount knobs carry their section in the
  screen reader name" (fails on `6035445`: "time", "feedback", "mix").

**R1102-2. The footer says a library channel can go to Filament, Cathode, Dekatron or off.** Area f.
Confusing. Measured. Fixed tonight.
- Steps: read "Song library." in the footer, then open songs and look at a channel's chips.
- Expected: the note matches the chips.
- Actual: each channel offers 19 choices (every device on the rack and off). The note predates the
  routing to hosted devices (R1030-1).
- Fix: "Each MIDI channel can go to any device on the rack (its row of chips lists them), or off."
  Check: "Rv. the footer's song library note does not limit a channel to Filament, Cathode and
  Dekatron" (fails on `6035445`).

### Still open from earlier runs (re-checked tonight)

- R1020-3: a project still carries 14 devices (no Thyratron, Dekatron, Lattice, Gleam). Its `bus` is
  the Mix desk bus; the master bus is not in it.
- R1030-3: Greensleeves (no channel 10) still runs Dekatron's pattern: Dekatron strip 0.33 at 2 s,
  `drumMeter().playing` true.
- R1030-4: Dock Lamp with every channel on Heptode and Dekatron muted: Heptode strip 0 over 1.2 s,
  output peak 0. The chips read "Heptode".
- R1020-7: Anode's four regenerate buttons still have no name but the glyph (both sizes).
- R1024-3: Hexode's 13 operator toggles still have no name (both sizes).
- Hexode still scrolls sideways at 375 px (1154 px wide).
- R1025-5: phone footer links still 13 px tall (Tip the developer, Hand Orchestra, Hexode, Anode,
  DXEdge, Old Time Radio); the Sculpt link and the full screen link are 32 px.
- R1017-10: phone pitch and mod strips still 22 x 117 px.
- R1020-8 and R1020-9: see the table (481 stops; names still repeat, "off" x9 now).

### Not reported

- Main-thread gaps of 200 to 2000 ms when a song starts were measured while the test suite ran on
  the same machine. Not repeatable on a quiet machine tonight, so no finding.

### Not covered tonight
Areas a, b, c, d, e. Suggested next: a and b on the spring reverb (each knob against an offline
render, factory patches with it on, old patches with no `spring`), and R1101-3 for the spring.

## 2026-11-03 (review, areas a, b)

Live site https://dxedge.net/synth/, page version `0.19-resnatron`, origin/main `7bce8ab`, sw.js
`dxedge-v176` (live and main agree). Playwright's own Chromium headless (the `chromium-1194` path in
the task prompt is still gone) at 1366 x 900 and 375 x 812 (touch, 2x). No page or console errors in
any run. Focus tonight: area a on six devices with their own panels (Thyratron, Additron, Rhumbatron,
Mote, Orthicon, Gleam), area b on every factory patch on all 18 devices, the tape echo and spring
reverb as patch fields (new since the last area b run), user save, reload, delete and undo on
Filament and Lattice, and the patch bar on a phone.

### What worked (measured)

- Area b, all 127 factory patches on the 18 devices picked from the patch menu at 1366 px (Filament
  25, Cathode 19, Thyratron 6, Gleam 7, Mote 3, Heptode 1, Geissler 3, Pentagrid 6, Orthicon 5,
  Trochotron 6, Gyrotron 3, Klystron 5, Phantastron 6, Additron 5, Rhumbatron 7, Resnatron 4,
  Dekatron 8, Lattice 8): each one becomes the current patch under its own name, no errors.
- Tape echo and spring reverb in a user patch: Plate Bass with the echo on (sync 1/8) and the spring
  on (drip raised to 50 from the keyboard) saved as "Review Echo Spring", selected after the save;
  after a reload it is current, both sections read on, the fields match, and the rack's spring is on.
- Delete, then undo: deleting that patch lands on Plate Bass (R1022-5, below), and undo brings the
  deleted patch's sound back as "* Review Echo Spring (edited)", spring still on, so save puts it
  back. The delete toast does not say this.
- Area a, every visible panel control stepped from the keyboard (arrows, then Home and End) moves its
  own patch field and only that one: Thyratron 26, Additron 14, Rhumbatron 6, Mote 15, Orthicon 7,
  Gleam 4. The one control that moves two is Additron's perc, which also picks perc 3 from "perc off"
  (the documented R1022-2 behaviour). A held C4 afterwards sounds on each device's strip.
- Thyratron, offline (`thyRender`, C3 then G3, 1 s; two renders of the same patch are identical, so
  any spectral difference is the control): each of the 26 controls at Home and at End, 52 renders, no
  NaN, peaks up to 0.82 (silent only with the level at 0). All change the sound except four that should not on their own: bend range
  (no bend sent), oscillator 3 rate (oscillator 3 is not the low oscillator in the default patch), and
  the mod pitch and cutoff depths (they act at full mod wheel).
- Phone 375 px: on all 18 devices the patch bar fits and the page is 375 wide. Arrows, save, undo,
  init and delete are 44 px tall; ok and cancel in the save form are 44 px. Save, the arrows and
  delete work by tap; next from the last user patch wraps to the first factory patch, as the menu
  order says.

### Findings

**R1103-1. A Lattice patch made from an imported WAV loses the WAV on reload.** Area a, b. Broken. Measured (table, sound), inferred (which table plays, shared table).
- Steps: Lattice, load a WAV into oscillator A (the toast says "Wavetable loaded into oscillator A."),
  save the patch, reload the page.
- Expected: the saved patch comes back with its wavetable.
- Actual: the patch comes back current, still named, with `osc1.table` "user", but the imported table
  is gone (`latticeTable()` null after the reload; a Float32Array of 28672 before). The same patch
  rendered offline with the table and without it: RMS 0.113 and 0.078, a different sound. The DSP
  falls back to a factory table when "user" has no data (`lattice-dsp.js` line 356, so Glass), with
  no word on the panel. The table lives only in the page's memory: it is not in the patch, the user
  list or the project (the project JSON was 15.8 KB with the table loaded). From the same code, the
  rack holds one imported table at a time, so two user patches made from two WAVs would both play the
  last one loaded (inferred, not run). A fix means storing the table (or its 16 source frames, 4096
  samples) with the patch, which is a schema and storage call, so it is left for James.

**R1103-2. Save took a factory patch's name in another case.** Area b. Confusing. Measured. Fixed tonight.
- Steps: Filament, save, type "plate bass", ok.
- Expected: refused, like "Plate Bass" ("That name belongs to a factory patch.").
- Actual: saved; the menu then listed "Plate Bass" under Bass and "plate bass" under Yours, two
  entries a reader takes for the same patch.
- Fix: the factory name check ignores case. Check: "Pn. save refuses a factory name in any case"
  (fails on `7bce8ab`: the menu listed both and the form closed).

**R1103-3. Phone: the save name field is 28 px tall.** Area b, h. Confusing. Measured.
- At 375 px the field sits in a 44 px row but the input itself is 170 x 28 px, under the 44 px target
  the rest of the patch bar meets. Left for the graphics backlog: it is layout, not a defect in what
  save does.

### Still open, re-measured tonight
- R1022-5: deleting a Filament user patch still lands on Plate Bass (on the desktop and on a phone).
- R1025-3: delete still removes a user patch at once with no question; undo now gives its sound back
  as an edited patch (above), which the toast does not say.
- Known from the graphics backlog, seen again: the phone patch menu is 100 px wide and shows "Wide Nov".

### Not covered tonight
Areas c to h beyond the phone patch bar. Area a still to do on the newest devices' chips and switches
(only sliders and knobs were swept tonight), and on Cathode's and Dekatron's echo and spring copies.
Suggested next: c, d and e, including whether the tape echo and spring follow a deck take that plays
two devices.

## 2026-11-04 (review, areas c, d, e)

Live site https://dxedge.net/synth/, page version `0.19-resnatron`, origin/main `1556a62`, sw.js
`dxedge-v180` (live and main agree). Playwright's own Chromium 1243 headless (the `chromium-1194` path
in the task prompt is still gone) at 1366 x 900, and 375 x 812 (touch, 2x) for the boot check. No page
or console errors on the live site in any run. Audio was read from the live output with the master
recorder (`__synth.recordStart` and `recordStop`, the 24-bit WAV decoded in the script) and the strip
meters; offline renders went through `__synth.render` with the deck's own `renderArgs`. Focus tonight:
what Panic does and does not stop (the master bus, the Mix desk returns, the output room), effects
switched off and on, the first seconds after the page loads, and a deck file that plays Filament and
Cathode together with the tape echo on (the 3 Nov suggestion).

### What worked (measured)

- Computer keys: a held A with five auto-repeat keydowns makes one onset and one voice; Ctrl+D plays
  nothing. The hold button, a key, then Panic: 2 voices to 0, hold back to unpressed, and the next key
  releases normally (the Wide Novachord release runs about 3 s).
- MIDI via `__synth.midi`: a take of note on and off, CC64 down and up, a bend, CC1 and a closing
  bend records 11 events in order; CC123 leaves 0 voices. Export and import of that take gives one
  part of 3 notes on channel 1, length 2.10 s.
- MIDI deck, an imported two-track file built in the test (channel 1 for Filament with a note-off
  sent as velocity 0 and a repeated, overlapping E4; channel 2 for Cathode): 3 and 1 notes, assigned
  to Filament and Cathode, 2.25 s. Playback follows the score (`sounding` shows 64, then 48, then
  nothing); at the end 0 voices. With loop on it wraps (1.06 s after 5.6 s), and Stop leaves nothing
  sounding, 0 voices and no lit keys. Render WAV by the button: `filament-reimport-<stamp>.wav`,
  48 kHz 16-bit stereo, 4.1 s, peak 0.45, no clipped samples, largest step 0.11.
- Mixer: a mute or a solo is complete (the strip fades on a 20 ms time constant; measured silent
  2 s later, -84 dB with only the floor), level 0 likewise.

### Findings

**R1104-1. A click in the first seconds after load plays four devices at once.** Area c, d. Broken.
Measured. Fixed tonight.
- Steps: open the page, click anywhere (or press a key) while the "audio" lamp is still settling.
- Expected: silence until a note is played.
- Actual: Mote, Geissler, Orthicon and Gyrotron play on their own until the rack finishes attaching:
  about 7 s, measured on the live site with the default autoplay policy and one click 0.5 s after
  the engine came up, at 1366 px and at 375 px (strip meters up to 0.68 for Geissler; output peak
  0.95, RMS -13 dB). With autoplay allowed (a returning visitor in Chrome) it plays without a click.
  The tail then rings through the output room for about 3 s more.
- Cause (code): every hosted device is built awake, and the boot chain put them to sleep only at
  its end.
- Fix: each device goes to sleep as soon as it has attached, unless it is on the rail or armed.
  Check: "M. while the rack is still attaching, no device plays on its own" (fails on the live code
  with the last attach held back: Mote at 0.069).

**R1104-2. Panic does not stop the master bus delay or reverb.** Area c, d. Broken. Measured. Fixed
tonight.
- Steps: master delay on (feedback 0.9, 250 ms, mix 0.5), play a note, let go, press Panic.
- Expected: silence (Panic's tooltip is "Silence every note"; since 1 Nov it empties the tape echo).
- Actual: the repeats went on: -31.5 dB 0.2 to 1.0 s after Panic, -36.5 dB 1.5 to 2.5 s after. The
  master reverb at size 1, damp 0 kept ringing at -15 dB.
- Fix: Panic fades the master delay and reverb returns over 10 ms and then empties both; the dry
  path is untouched. Check: "M. master bus: Panic empties the master delay and reverb" (live code:
  -36.1 dB before, -38.2 after; fixed: -240 after).
- Follow-up (improvement job, 4 Nov): the fix's `clearDelay` and `clearReverb` also set the fade
  counter to 0, so an effect switched on within the 10 ms fade left the returns at a part-faded gain
  until the next Panic (18 dB down in this check, 3 of 15 repeats on main). Fixed in `master.worklet.js`,
  with two block-by-block checks; the live check now reads both channels. See the Improvement backlog.

**R1104-3. An effect switched back on plays what it held when it was switched off.** Area d.
Confusing. Measured. Fixed tonight (same change as R1104-2).
- Steps: master delay on, play a note, switch the delay off, wait 2 s, switch it on with nothing
  playing. Same for the reverb.
- Actual: the old repeats came back, -32.7 dB (delay) and -22.6 dB with a peak of 0.39 (reverb),
  because the lines stop moving while the effect is off.
- Fix: a delay or reverb switched on starts empty. Check: "M. master bus: switched back on, the master
  delay and reverb start empty" (live code: -37.4 and -34.4 dB; fixed: -240).

**R1104-4. Panic leaves the other tails ringing.** Area c, d. Confusing. Measured. Not fixed.
- The Mix desk returns: a strip's delay send at 1 with the desk feedback at 0.85 (its top) read
  -25.7 dB 0.3 to 1.3 s after Panic and -28.6 dB later; the room send -27.2 dB 0.2 to 0.7 s after.
- The patch's own output room: on the default patch (Wide Novachord Strings, hall, decay 3) a note
  then Panic still reads -40.5 dB 0.3 to 0.7 s after (Plate Bass, studio 0.9 s: -69 dB). With the
  master reverb on, that room tail refills the reverb after its flush (-29 dB a second after Panic).
- All of these decay on their own (the desk feedback stops at 0.85), unlike the tape echo and the
  master delay. Whether Panic should cut every tail or only runaway ones is a call for James; a cut
  needs a short dip on the desk returns and on the room's wet gain.

### Still open, re-measured tonight

- R1101-3, now with the deck: in the two-track file above with the tape echo on Filament only and
  the rail on Filament, Cathode's part gets Filament's echo (live -20.9 dB 0.8 s after its note; the
  Render WAV of the same file -18.9 dB). With the rail on Cathode the render drops it (-47.1 dB). The
  live output and the render agree, so the WAV matches what was heard.

### Not reported

- `__synth.cathodePatch()` throws ("undefined" is not valid JSON) on a fresh page before Cathode has
  been shown. It is a test hook, not something a player reaches.
- The deck WAV's name stamp follows the browser's clock zone (UTC in this headless run).

### Not covered tonight

Areas a, b, f, g, h; the phone only for the boot check. Suggested next: f, g, h, including whether a
project restores the master bus effects' on and off state cleanly now that switching on clears them.


## 2026-11-05 (review, areas f, g, h)

Live site https://dxedge.net/synth/, page version `0.19-resnatron`, origin/main `362d38b`, sw.js
`dxedge-v183` (1939 mode and the fixed-width desktop header had landed overnight). Chromium 1243
headless (the `chromium-1194` path in the task prompt is still gone) at 1366 x 900 and 375 x 812
(touch, 2x). No page errors on the rack, Hexode, Anode, Iris or Gleam at either size. Audio was read
from the live output with the master recorder (`engine().fx.recordStart` and `recordStop`), an
analyser tapped on the vendored pages' destination, and offline renders through `__synth.render`.
Focus tonight: projects and the library with the new 1939 mode, and names and focus for its section.

### What worked (measured)

- Project with 1939 mode: Parlor Harp with the staircase at 33% and vibrato at 41c, saved, another
  factory patch loaded (1939 off), load saved: the whole `era` block comes back (on, harp, tabs,
  edited values). The downloaded file (`filament-era-test-1939.json` for the name "Era test / 1939!")
  carries the same block, and uploading it back restores it and the name.
- A malformed project file says "That file is not a project."; load saved with nothing saved says
  "No project saved in this browser."
- Library with Exposition Choir (1939 mode, the pedal lengthens the release): all 21 songs, 3 s each:
  peak 0.92 to 0.98, RMS 0.22 to 0.31, no NaN, no sample at full scale. 2.5 s after stop every song
  reads 0.0013 peak or less, sustain off, no held notes, 0 voices.
- Level of the two 1939 patches against the other 25 Filament factory patches (offline, a four-note
  chord at velocity 0.8): Exposition Choir -15.9 dB RMS, Parlor Harp -22.1 dB, inside the
  -26.8 to -12.2 dB spread of the rest. No NaN.
- Library loop: Oh! Susanna (15.9 s) wraps to 0:00.2 after 0:15.1, stop leaves no held notes.
- Hexode at both sizes: a held A peaks 0.25 and goes to 0 after release; links back to `/synth/` and
  Anode. Anode starts on a click (peak 0.14 desktop, 0.20 phone), links back to `/synth/` and Hexode,
  no sideways scroll at 375 px. Iris and Gleam load at both sizes and link back.
- Rack tab walk: 503 stops at 1366 px, 104 at 375 px, 0 unnamed, an outline or ring on every one,
  nothing zero-sized. The 1939 section's shape and tab chips sit in named groups and its five knobs
  carry "1939 mode ..." names.
- The master bus survives a page reload (delay and reverb on, reverb mix 0.4, switch reads on).

### Findings

**R1105-1. Eleven section switches are named only "on" or "off".** Area h. Confusing. Measured.
Fixed tonight.
- Steps: Tab through the rack with a screen reader, or read the accessible name of `#eraOnBtn`,
  `#arpOnBtn`, `#echoOnBtn`, `#fxDelay` and the rest.
- Expected: a name that says what the switch turns on, with the state in `aria-pressed`.
- Actual: the 1939 mode, arpeggiator, ensemble, tape echo, spring reverb, graphic EQ, speaker, room,
  master delay, master reverb and master compressor switches had no `aria-label`, so each was read
  as its text: "off" x9 and "on" x3 at the defaults on the desktop walk (the 1939 switch is new).
- Fix: each switch carries its section name as `aria-label` ("1939 mode", "Tape echo", "Master
  delay" and so on); the visible text stays on or off. This closes the on and off part of R1020-9.
  Check: "Rv. the 11 section on/off switches carry their section as the screen reader name"
  (fails on the live site: `aria-label` null on all four sampled).

**R1105-2. A blank project or mix name is saved as Untitled or Mix but the field stays blank.**
Area f. Confusing. Measured. Fixed tonight.
- Steps: clear the project name (or type only spaces), press save project. Same for the mix name
  and save mix.
- Expected: the field shows the name that was saved.
- Actual: the toast says Saved "Untitled" and the stored project is "Untitled", but the field stays
  empty (or keeps the spaces), so the next download and the next look at the field disagree with
  what is stored. The mix name does the same with "Mix".
- Fix: save and download write the normalized name back to the field. Check: "Rv. save project and
  save mix show the name they saved" (fails on the live site: fields read "   " and "").

### Still open, re-measured tonight

- R1020-3: a downloaded project still carries 14 devices (no Thyratron, Dekatron, Lattice, Gleam)
  and no master bus. Load saved after switching the master delay and reverb off leaves them off.
- R1030-3: Greensleeves still runs Dekatron's pattern (Dekatron strip 0.49 at 2 s, playing true).
- R1030-4: the channel chips still offer Heptode (sound not re-measured tonight).
- R1020-7: Anode still has four "⟳" buttons with no name or title after start.
- R1024-3: Hexode's 13 operator toggles still have no name.
- Hexode still scrolls sideways at 375 px (1154 px wide).
- R1025-5 and R1017-10: phone footer links still 13 px tall; pitch and mod strips still 22 x 117 px.
- R1020-8: 503 desktop stops now (the 1939 section adds 19); the library is stop 487, save project 451.
- R1020-9, what is left after R1105-1: "sine" x5, "saw" x4, "tri" x4, "level" x4, "cutoff" x4,
  "mix" x4, the tube chips x3, "attack", "decay", "release", "drive" x3.

### Not reported

- Every library song peaks 0.92 to 0.98 at the defaults on the live output. The output stage holds
  it under full scale and no sample clipped, and the 2 Nov run measured the same range with the
  default patch, so this is the rack's level, not 1939 mode.
- With an `aria-label` on a switch inside an `h3`, the heading's computed name repeats the section
  ("Tape echo Tape echo"). Screen readers read the heading and the button separately, so left as is.

### Not covered tonight

Areas a, b, c, d, e. Suggested next: a and b on 1939 mode (each shape, tab and knob against an
offline render, the pedal knob with CC64, old patches with no `era`), and whether the Osc-tab
sections that "rest" in 1939 mode still change the sound.


## 2026-11-06 (review, areas a, b)

Live site https://dxedge.net/synth/, page version `0.19-resnatron`, origin/main `e9277b6`, sw.js
`dxedge-v185`. Playwright's own Chromium headless (the `chromium-1194` path in the task prompt is
still gone) at 1366 x 900 and 375 x 812 (touch, 2x). No page or console errors in any run. Focus
tonight: area a on the two newest Filament parts (1939 mode, 5 Nov, and the LC bank filter model,
6 Nov) and on Cathode's copies of the tape echo and spring reverb (not covered on 3 Nov); area b on
every factory patch on all 18 devices, offline renders of every Filament and Cathode factory patch,
an old user patch, a user patch on the LC bank in both slots, and the new joined patch keys (6 Nov).

### What worked (measured)

- Area b, all 129 factory patches on the 18 devices picked from the patch menu at 1366 px (Filament
  27 with Exposition Choir and Parlor Harp, Cathode 19, Thyratron 6, Gleam 7, Mote 3, Heptode 1,
  Geissler 3, Pentagrid 6, Orthicon 5, Trochotron 6, Gyrotron 3, Klystron 5, Phantastron 6, Additron 5,
  Rhumbatron 7, Resnatron 4, Dekatron 8, Lattice 8): each one shows under its own name, no errors.
- Offline, through the rack (a four-note chord for Filament, A2 for Cathode): all 27 Filament and 19
  Cathode factory patches are finite, peak 0.14 to 0.89 (none over 0 dBFS) and RMS -32 to -16 dBFS
  (Glass Music Box -32.3 and Eerie Bells -31.0 are the quietest; both are short struck sounds).
- An old user patch written the way a pre-November save looks (no `era`, no `tabs`, no echo or
  spring) loads from the menu with 1939 mode off, the default LC tabs (body, voice, mellow), the echo
  off, and its own cutoff; it renders finite at -21 dBFS.
- A user patch on the LC bank in both slots (A voice and edge, B serial with body and thin) saved
  from the save form comes back after a reload as the current patch with both slots' models and tabs
  identical, both tab rows showing and aria-pressed matching. Delete removes it ("Deleted ...").
- Edits mark the patch: the LC bank chip, an LC tab, a 1939 tab, a 1939 shape and the 1939 switch
  each turn the menu entry into "* name (edited)". Undo reverts an LC tab and a 1939 tab, and the
  chip's aria-pressed follows. Init gives 1939 mode off, Valve 12 and the default tabs.
- Area a, 1939 mode: each of the five knobs at Home and at End writes only its own field (stair 0 to
  1, vibrato 0 to 60, rate 4 to 9, pedal 0.3 to 10, velocity 0 to 1), with the readout matching, and
  each changes the sound except pedal, which acts only with the pedal down (as documented). The
  arpeggiator runs in 1939 mode (8 note edges over 2 s of a held triad at 1/8, 120 BPM, against 1
  with it off).
- LC bank on the panel: with it picked, Filter shows the model chips, the tabs row, and cutoff, res,
  drive, key trk, env, velocity and stereo off; the V2 loop and gate rows hide; the note explains the
  bank. The response plot draws it (peak 3.0 dB at 876 Hz on Plate Bass's knobs).
- Cathode's tape echo and spring reverb: every echo knob (7) and spring knob (5) writes only its own
  field in Cathode's patch, and offline each is heard on a short Cathode note (tail 0.5 to 1.5 s:
  -54 dB off, -25 dB with the echo, -34 dB with the spring). Dekatron and Thyratron hide both sections.
- Chips and switches on five of the newest panels (Resnatron 109 buttons, Rhumbatron 69, Additron 84,
  Klystron 69, Phantastron 76) each change the patch or their pressed state, except buttons that act
  only in context: Resnatron's jacks (a click starts a cable), Phantastron's "lift wires" with no
  wires, Additron's "perc off" when already off.
- Patch keys (6 Nov graphics): at 1366 px the stepper and edit switch are one row, the name select
  has a 2 px amber focus ring and ArrowDown on it moves to the next patch. At 375 px on four devices
  every key is 44 px tall, the name window is 137 px, no sideways scroll.

### Findings

**R1106-1. In 1939 mode the glide and unison knobs look live but do nothing.** Area a. Confusing.
Measured. Fixed tonight.
- Steps: Filament, switch on 1939 mode (or load Exposition Choir), voice mode mono, glide 0.3; play
  C3 then G3 legato.
- Expected: the pitch glides, or the glide knob shows that it rests, as the oscillator, filter,
  envelope, LFO and matrix sections do.
- Actual: the pitch jumps straight to G3 (195.8 Hz 20 ms after the key, against a glide through 138,
  151, 163 and 171 Hz with 1939 mode off). The worklet's own comment says glide and unison rest in this
  mode, but the Voice section's unison and glide knobs stayed at full brightness with no word, and
  the 1939 section's note listed unison but not glide.
- Fix: while 1939 mode is on, the unison and glide knobs dim (like detune does with unison off) and
  their title reads "Resting: 1939 mode"; detune and unison spread dim too; the note now lists glide.
  Check: "Er. the unison and glide knobs rest while 1939 mode is on" (fails on the live site: both
  knobs at full opacity with no title, both states).

**R1103-3 (3 Nov). Phone save name field 28 px.** Area b, h. Confusing. Measured. Fixed tonight.
- Still 170 x 28 px tonight beside 44 px ok and cancel. Now 44 px tall in the phone header
  (`.bar .saveform input`, under 761 px). Check: "Pn. 375px: the save form's name field is 44 px tall"
  (fails on the live site: 28).

**R1106-2. LC bank and the stereo offset spread far wider than the other models.** Area a.
Confusing. Measured (width, mono), inferred (impact).
- Steps: Filament, Filter on LC bank (voice tab, cutoff 850, res 0.3), stereo off at +1.00 oct; play
  A2 and A3.
- Measured: the side signal (L minus R) is 1.7 dB louder than the left channel on its own at 1 octave
  (Valve 12 at the same knobs: -8.0 dB), and the mono sum is 0.55 dB under the stereo level (Valve 12
  0.18, Ladder 24 0.43). With narrow band-passes, an octave apart puts each side's peak where the other
  has none, so the offset reads as two different vowels left and right.
- Inference: a player expecting the offset to widen gently will hear a split; the LC note does not
  carry the "a wide stereo offset can thin out in mono" warning the Ladder 24 and Poly 24 notes carry.
  Options for James: the warning in the LC note, or the offset scaled down on this model.

### Still open, re-measured tonight

- R1022-5: deleting a Filament user patch still lands on Plate Bass.
- R1025-3: delete still removes a user patch at once with no question.
- Known from the graphics backlog (6 Nov), seen again: with a user patch loaded on a phone, the delete
  key joins the edit switch and the name window drops to 80 px ("Phone..." for a 28-character name).

### Not covered tonight

Areas c to h. R1103-1 (Lattice WAV) was not re-run. Suggested next: c, d and e, including 1939 mode
with the deck (a take on Exposition Choir, export, play back) and the LC bank in Render WAV.


## 2026-11-07 (review, areas c, d, e)

Live site https://dxedge.net/synth/, page version `0.19-resnatron`, origin/main `f3c2f16`, sw.js
`dxedge-v188` (live and main agree). Playwright's own Chromium 1243 headless (the `chromium-1194` path
in the task prompt is still gone) at 1366 x 900 and 375 x 812 (touch, 2x). No page or console errors
on the live site in any run. Audio was read from the live output with the master recorder
(`__synth.recordStart` and `recordStop`, the 24-bit WAV decoded in the script), from the deck's own
Render WAV download, and from offline renders through `__synth.renderMidi`. Focus tonight: 1939 mode
and the LC bank with the keys, the pedal and the deck (the 6 Nov suggestion), and what the mixer does
to a held note when a strip changes.

### What worked (measured)

- Deck take on Exposition Choir (1939 mode) over `__synth.midi`: a note, CC64 down, two more notes,
  all three keys up, CC64 up 0.6 s later, a last note. The take holds 10 events in order; the export
  is format 1, 480 ppq, one part "Filament: Exposition Choir" with both CC64 messages at 0.30 and
  1.40 s. Played back, its level follows the performance window by window (within 2 dB after the
  first 0.25 s), 0 voices after. Imported back it is assigned to Filament; Stop 0.9 s in leaves
  0 voices and the pedal up.
- Render WAV against the live output for a three-chord file on Exposition Choir, Parlor Harp, Plate
  Bass with the LC bank picked, and Wide Novachord Strings: 48 kHz 16-bit, 5.0 s (3 s of song and the
  2 s tail), RMS over the first 2 s within 0.7 dB of the live output on all four, no NaN, no sample at
  full scale. The LC bank and 1939 mode are both heard in the render.
- A file whose pedal goes down and never comes up, looped six times: Stop leaves silence (-240 dB),
  0 voices, and the next key from the keyboard releases normally. A note with no note-off: the file
  ends by itself and nothing sounds. Deck tempo 200% and 50% on a 2 s note: 1.03 s and 4.02 s of
  sound; Render WAV at 50% writes 8 s plus the tail.
- 1939 mode with the keys: bend at full up and down is +200 and -201 cents on Exposition Choir and
  Parlor Harp (range 2); CC1 changes the sound (difference -25.9 dB against a level of -23.5 dB, and
  two renders without it are identical). The hold button lengthens the release (-44 dB 1.5 s after
  onset, against -62 dB without). A key held through Z, through a rail switch to Cathode, and through
  a window blur leaves 0 voices. Space on the page is the pedal and lets go.
- Phone 375 px with touch: a two-finger hold (a key and the pitch strip) bends, and lifting the strip
  finger returns it to 0.00; keys sound and release under the finger; no sideways scroll.
- Mixer moves away from unity on a fresh strip glide with no click: level 1 to 0.5, pan centre to
  hard left, pan hard left to half left, and the room send on and off (largest sample step equal to
  the held sine's own, 0.0048).
- Master bus: with the compressor and limit on (ceiling -1 dBFS) an eight-note Screaming 12AX7 chord
  through reverb at mix 1, size 1 and the delay at feedback 0.95, mix 1 peaks at -2.5 dBFS with no
  clipped sample. The master delay at feedback 0.95 decays about 1.8 dB a second.

### Findings

**R1107-1. A strip going back to unity clicks.** Area d. Broken. Measured. Fixed tonight.
- Steps: hold a note (a sine or a bass shows it best). In the Mix desk press mute and then mute
  again; or pull the level down and back to full; or pan hard left and back to centre; or solo
  another strip and let it go.
- Expected: the sound comes back over the same short glide it went away with.
- Actual: the note jumps from its faded level to full in one sample. On a held A2 sine through the
  live output the largest sample step was 48x the sine's own on unmute, 33x on level back to full,
  25x on pan back to centre and 16x on a solo let go (at A3 about 5x; on Wide Novachord Strings it is
  buried in the saw's own steps). After one of those, the next move away clicks too: mute after a
  level 0.5 and back to full jumped 5x at A3, because the unused gain had stayed at 0.5.
- Cause (code): a strip at unity is wired straight through with no gain node. Going back there
  rerouted at once, so the 20 ms glide the gain had just started never played.
- Fix: going back to a simpler route waits 200 ms for the gains to reach unity (within 5e-5), then
  reroutes, so the gain left behind is at unity for the next move away. A strip at its defaults is still a straight
  wire. Check: "Mx. a strip going back to unity glides there with no click" (fails on the live
  site at 16x to 48x; 1.0x on the fixed tree for all four cases).

### Still open, re-measured tonight

- R1017-9: with the compressor off, reverb at mix 1, size 1 and the delay at feedback 0.95, mix 1,
  the same chord holds 226,954 samples at full scale in 4 s. The limit chip only acts with the
  compressor on.
- R1017-4: deck Render WAV is still 48 kHz 16-bit.

### Not reported

- At deck tempo 50% the position and length read in file time (0:02.5 of 0:04.0 at 5 s). That
  matches the file and the track list, and Render WAV's own status gives the real length.
- On the phone the keyboard's first black key (C#4) sits half under the strip column; touching that
  half reaches the keybed, not the key. Inferred to be part of what R1017-11 describes (the first
  visible key is D4).
- The deck WAV name stamp follows the browser's clock zone (UTC headless), as on 4 Nov.

### Not covered tonight

Areas a, b, f, g, h. R1104-4 (Panic and the other tails) and R1101-2 and R1101-3 (tape echo) were
not re-run. Suggested next: f, g and h, including a project saved with a strip muted or panned and
loaded while a note holds (now that going back to unity waits 200 ms).

## 2026-11-08 (review, areas f, g, h)

Live site https://dxedge.net/synth/, page version `0.19-resnatron`, origin/main `2d404d4`, sw.js
`dxedge-v192` (the paper roll and Klystron's new source row had landed overnight). Chromium 1243
headless (the `chromium-1194` path in the task prompt is still gone) at 1366 x 900 and 375 x 812
(touch, 2x). No page or console errors on the rack, Hexode or Anode at either size. Focus tonight:
the new paper roll as a musician would use it (every device it offers, with the library, the rail,
Panic, tempo and rate changes, key in, a reload, a project), then the vendored pages and a tab walk
with the roll open. Sound was read from the strip meters and the lit device's meter (`notes`,
`voices`) and, on the vendored pages, an analyser tapped on the destination.

### What worked (measured)

- Roll play on Octave Pump at 120 BPM: 26 strikes 0.125 s apart to the ms, none late, none dropped;
  the status reads "Octave Pump · 16 × 1/16 · lit device"; a tempo change to 180 BPM goes to 0.0833 s
  and 1/8 then to 0.1667 s with no burst. At 1/32, 240 BPM, swing 60% and gate 100%: 69 strikes in 2 s,
  none dropped. Length 16 to 1 to 16 under a running roll keeps the grid.
- Every device the roll offers sounds except Heptode (R1108-4): Arc Arpeggio peaks from 0.018
  (Phantastron) to 0.80 (Geissler); after stop each one decays to silence (Thyratron and Lattice
  tails measured over 5 s, nothing held).
- Switching the rail from Filament to Cathode mid-roll moves the strikes to Cathode (10 on Filament,
  12 on Cathode) and stop leaves both silent. Panic stops the transport and the roll.
- The roll's stop also stops a library song (one transport), as its name says.
- Arrow keys on the focused paper pick and move steps (step 1 C2 to C#2, then step 2) without moving
  the octave; a reload keeps the pattern, the edits and the "*" on the name.
- Phone 375: the open strip has no sideways scroll and every button, chip, list and slider is 44 px
  or more. Reduced motion: the paper holds still (position 0) while the roll plays.
- Tab walk with the roll open: 553 stops at 1366 px, 152 at 375 px, 0 unnamed, a ring on every one;
  the roll's 49 stops all carry names ("Step length 1/16", "The roll plays Cathode" and so on).
  Klystron's new rows: the five vowel keys and the three source keys sit in named groups ("Vowel",
  "Mouth source") with `aria-pressed` that follows the pick.
- A project saved with Filament muted and panned L50, loaded while A3 is held, brings back mute and
  pan and keeps the note held; unmuting after it works (the suggestion from 7 Nov).
- Hexode: a held A peaks 0.26 and is silent after release at both sizes; links back to `/synth/` and
  Anode. Anode starts from its start button (peak 0.30 desktop, 0.50 phone), links back to `/synth/` and Hexode,
  no sideways scroll at 375 px.

### Findings

**R1108-1. Stopping the paper roll can leave a note held on Filament or Cathode.** Area f. Broken.
Measured. Fixed tonight.
- Steps: open roll, pick Octave Pump, press play on Filament (or Cathode), press stop a second later.
  Raise the gate to 100% to make it happen every time.
- Expected: stop lets every note go.
- Actual: the note sounding at the stop keeps ringing until Panic (`meter().notes` [36] 3 s after
  stop, strip 0.16 at 4 s). Gate 100% or 90%: 4 of 4 stops on each device. The default gate (45%):
  1 of 4 on Filament, 2 of 4 on Cathode. The roll's own log was balanced (every on has its off), so
  the roll thought it had let go.
- Cause (code): the roll sends each off up to 150 ms early with its frame. Stop sends `flush` to
  Filament and Cathode, which drops every queued library or roll event, those offs included, and
  then sent offs only for notes whose off had not been sent yet.
- Fix: `paperroll-ui.js` keeps the offs it has queued on Filament and Cathode and sends any that
  were still in the future again, now, after the flush (the same way it already treats the notes
  still waiting). Check: "Pr. stop lets go of the note that is sounding" (3 stops each on Filament
  and Cathode at gate 100%; on the unfixed tree [1, 1, 1] on both, fixed [0, 0, 0]).

**R1108-2. Key in stays on with the roll strip closed.** Area f. Confusing. Measured. Fixed tonight.
- Steps: open roll, press key in, close the strip with roll ▾, play a few keys (or MIDI notes).
- Expected: the keys only play; nothing changes out of sight.
- Actual: each key rewrites the picked step and moves on (step 2 became F#4 with the strip closed),
  marks the roll edited, and the lamp that would show it is hidden.
- Fix: closing the strip turns key in off, and key in does nothing while the strip is closed. Check:
  "Pr. closing the roll strip turns key in off" (unfixed: key in still on, step 1 set to 70).

**R1108-3. The roll's play brings Dekatron's own pattern with it.** Area f. Confusing. Measured.
- Steps: fresh page, open roll, pick Blank Roll (or keep Octave Pump), press play.
- Expected (first-time user): the roll plays and nothing else.
- Actual: the transport starts and Dekatron's factory beat plays under it (Dekatron strip peak 0.56
  with Blank Roll, which strikes nothing). The roll's note says it plays "beside Dekatron's pattern",
  so this is stated, but the play button reads as the roll's own. Same root as R1030-3; one answer
  can cover both (hold the pattern unless Dekatron is lit or armed, or say it on the strip).

**R1108-4. Heptode is offered on the roll but plays nothing.** Area f. Confusing. Measured.
- Steps: roll, "plays" chips, pick Heptode, play.
- Actual: 17 strikes sent, Heptode strip 0 throughout. Same as R1030-4 in the library; dropping
  Heptode from both lists, or making it answer notes, is the same decision.

**R1108-5. Run stays on for good after one play, reloads included.** Area f. Confusing. Measured
(run kept, strikes), inferred (surprise).
- Steps: press the roll's play once, stop, reload the page, play a library song.
- Actual: run is still on after the reload (lamp amber), and the song brings the roll in (20 roll
  strikes under Beethoven 5). This follows James's call (1) of 8 Nov ("it then stays on until you
  switch it off"), but the same note says a song should never bring the roll in by surprise, and a
  week later it will. Options: keep run per page (not stored), or store it and show the amber lamp on
  the library strip too.

### Still open, re-measured tonight

- R1020-3: a project still carries 14 devices (no Thyratron, Dekatron, Lattice, Gleam) and no master
  bus, and now no roll either (the roll's roadmap lists that as not in its first slice).
- R1020-7: Anode's four "⟳" buttons still have no name or title, at both sizes.
- R1020-8: 553 desktop stops with the roll open; the roll starts at stop 491.
- Hexode still scrolls sideways at 375 px (1154 px wide).
- R1017-8: the Filament strip meter still read 0.14 while the strip was muted.

### Not reported

- The roll's stop and the header's transport stop share the name "Stop the rack transport"; they do
  the same thing, so the same name is right.
- A computer key on the focused paper still plays (A sounds C3, Z moves the octave): the paper takes
  only the arrows and Enter. Consistent with the rest of the rack.
- The vowel keys are named by their letter ("u", "o") inside the "Vowel" group, which a screen
  reader reads as "u, Vowel"; enough.

### Not covered tonight

Areas a, b, c, d, e. The song library's 21 songs were not replayed one by one (the roll was the
focus). Suggested next: a and b (Klystron's new source row against its sound, the roll's six
factory rolls on Cathode and Thyratron with slides), then c with the roll's key in from MIDI.


## 2026-11-09 (review, areas a, b)

Live site https://dxedge.net/synth/, page version `0.19-resnatron`, origin/main `75f767a`, sw.js
`dxedge-v195` (live and main agree). Playwright's own Chromium 1243 headless (the `chromium-1194`
path in the task prompt is still gone) at 1366 x 900 and 375 x 812 (touch, 2x). No page or console
errors in any run. Focus tonight: area a on Theremin mode (new last night, Filament's Pad section),
Klystron's joined vowel and source rows (graphics, 8 Nov), and a keyboard sweep of every knob on all
18 devices; area b on every factory patch from the menu, offline renders of all 27 Filament factory
patches with the keys and with the pad, user patches saved, reloaded and deleted on Klystron,
Additron and Resnatron, and the save form's edge cases on Filament, Cathode and Lattice.

### What worked (measured)

- Area b, all 129 factory patches on the 18 devices picked from the menu at 1366 px (Filament 27,
  Cathode 19, Thyratron 6, Gleam 7, Mote 3, Heptode 1, Geissler 3, Pentagrid 6, Orthicon 5, Trochotron 6,
  Gyrotron 3, Klystron 5, Phantastron 6, Additron 5, Rhumbatron 7, Resnatron 4, Dekatron 8, Lattice 8):
  each one shows under its own name, not as edited, no errors.
- Offline, through the rack, a four-note chord on all 27 Filament factory patches: finite, peak 0.15 to
  0.90 (none over 0 dBFS), RMS -27.8 to -13.2 dBFS (Eerie Bells and Glass Music Box quietest, as on 6 Nov).
- The same 27 played from the pad (C4 at 0.8, a slide to G4 +30 cents at full level, let go): finite,
  peak 0.12 to 0.60. Exposition Choir and Parlor Harp are silent on the pad because they are 1939 mode
  patches; the readout says "resting: 1939 mode cannot slide a note", as designed.
- Knob sweep, Home and End by keyboard on every visible slider: Filament 113, Cathode 65, Thyratron 28,
  Mote 17, Gyrotron 17, Klystron 18, Additron 15, Pentagrid 14, Dekatron 13, Geissler 12, Orthicon 9, and
  the pitch and mod strips on the rest. Every one changes its device's patch except the two Theremin
  knobs (page settings, by design) and the pitch and mod strips (spring back, by design). No readout
  showed NaN, undefined or Infinity.
- User patches on Klystron, Additron and Resnatron: saved from the form, current after a reload, in the
  menu, delete shown and working (it lands on Buncher Ah, Copper Flute and Cavity Saw).
- Save form: Enter saves, Escape cancels, a factory name is still refused (R1103-2).
- Theremin pad, sound (offline, sine patch): a jump across the whole pad (C3 to C6 in one message), the
  level from the floor to the top, and the release all stay within the steady sine's own sample step
  (0.0184 to 0.0186 against 0.0186), so no clicks; the tail after release is -146 dB. Pitch bend at
  full reaches the pad's note (440 Hz to 494 Hz, +2 semitones).
- Theremin pad, page: a menu pick or the next arrow while the pad is held keeps the note sounding and
  a later move slides it; Panic, the rail and 1939 mode let it go (as the suite checks). A window blur
  ends the note; a mouse still held needs a fresh press. With the pedal down, letting go silences the
  note (its level goes to 0) and keeps one voice until the pedal comes up, then 0 voices: nothing stuck.
  Snap and range knobs reach 0 to 100% and 12 to 60 dB by Home and End, and the map follows (halfway
  is -31 dB at 60 dB of range, -5.9 dB at 12). The pad shows a 2 px amber focus ring.
- Phone 375 px: Filament's tabs are Play, Pad, Osc, Filter, Mod, Stereo, Rack, Mix; the pad is 313 x 240
  px with every chip and the on switch 44 px tall; a touch drag plays and slides (to 76.05) without
  scrolling the page, and lifting ends it. No sideways scroll.
- Klystron: the source switch shows vowel lit, file and mic not; the vowel row's i lights alone after a
  click and marks the patch edited.

### Findings

**R1109-1. The Theremin on and off switch does not stop the pad.** Area a. Confusing. Measured.
- Steps: Filament, Theremin section, switch it off; press the pad.
- Expected: off means the pad rests (a guard against a stray touch), or there is no switch.
- Actual: the press switches the mode back on and plays (state on, note sounding, the switch reads
  "on"). The readout says so ("off: touch the pad to switch it on"), so off only changes the pilot lamp
  and the readout. A design call for James: make off a real rest, or drop the switch and keep the lamp.

**R1109-2. On a mono patch a key takes the pad's voice, and the pad's readout does not say so.** Area a.
Confusing. Measured (mono), inferred (a full poly pool).
- Steps: Filament, voice mode mono, hold the pad at F#4, play C4 on the keys, let it go.
- Actual: while the key is down C4 sounds (the meter's pad note is gone, notes [60]) but the readout keeps
  "F#4 ±0 cents, -7 dB", the pad's glow stays, and the eye drops back to level. Key up: the pad's note
  comes back (mono falls back to the held list). From the code, in poly the same steal happens once
  every voice is in use, and there the pad does not come back until it is moved.
- Options: the pad keeps its voice (keys play around it), or the readout says "a key has the voice".

**R1109-3. Save with an empty name did nothing and left the last toast up.** Area b. Confusing.
Measured. Fixed tonight.
- Steps: save, clear the name (or type only spaces), press ok or Enter.
- Actual: the form stayed open with no word; if a toast was still up it read "Saved ..." from the save
  before, which reads as success.
- Fix: the toast says "Type a name for the patch first." and focus stays in the name.

**R1109-4. Closing the save form dropped keyboard focus to the page.** Area b (and h). Confusing.
Measured. Fixed tonight.
- Steps: Tab to save, Enter, then Escape, cancel, or type a name and Enter.
- Actual: focus went to the page body each time; the next Tab went on from the MIDI button.
- Fix: closing the form hands focus back to save. Enter in the name field now holds back its default,
  because with focus already back on save the same key would have pressed it and opened the form again.
- Check: "Pn. save with an empty name says so ..." and "Pn. closing the save form by Escape, cancel or a
  save hands focus back to save" (both fail on the live tree: toast "", focus BODY three times).

### Still open, re-measured tonight

- R1025-3: delete still removes a user patch at once with no question (Klystron, Additron, Resnatron).
- R1103-1: not re-run; `lattice*.js` is unchanged since 3 Nov, so it stands.

### Notes (not findings)

- The pad keeps its place for Enter as a position, not a pitch: after "from" C1, Enter plays C2 where it
  played C4 before. The code comment says so; a keyboard user may expect the pitch to stay.
- The MIDI deck does not record the pad (listed under the Theremin item's "still open").

### Not covered tonight

Areas c to h. Suggested next: c, d and e, including the pad with the deck armed, the pad under the
master echo, and the pad on a phone with a second finger on the keys.

## 2026-11-10 (review, areas c, d, e)

Live site https://dxedge.net/synth/, page version `0.19-resnatron`, origin/main `2770f23`, sw.js
`dxedge-v199`. Playwright's own Chromium 1243 headless (the `chromium-1194` path is still gone) at
1366 x 900 and 375 x 812 (touch, 2x). No page or console errors on the live site in any run. Audio was
read from the live output with the master recorder (24-bit WAV decoded in the script) and from the deck's
Render WAV downloads. Clicks are the largest sample-to-sample step over the steady signal's own largest
step, on a held A2 sine (Filament, osc 1 sine, osc 2 off). Focus tonight: what a knob move on the master
bus does to a held note, the deck's Render WAV after a mix of takes and files, and the pedal and keys
across a rail switch and a patch link (new on 10 Nov).

### What worked (measured)

- Deck take on Wide Novachord Strings: three notes from the keys, 6 events, "take 0:01.5, 3 notes";
  played back and stopped, 0 voices left.
- A file built in the test with a tempo change (120 BPM for two beats, then 60) reads its notes at 0, 1
  and 2 s and a length of 3 s, as it should. A file with running status and note-on velocity 0 as the
  off reads 2 notes, 1 s, plays to its end and stops by itself with 0 voices.
- Loop on, deck tempo moved to 180% while playing: still looping 3.5 s later; Stop leaves 0 voices and no
  key lit.
- Render WAV files: RIFF size matches the file, 48 kHz 16-bit stereo, no NaN, peaks 0.33 and 0.47.
- Armed on Thyratron, a note: the deck says "armed: the recorder takes Filament and Cathode only".
- Pedal (CC64) down on Filament, a note, key up, rail to Cathode: the pedal state is let go, and after
  the pedal-up 0 voices on both.
- Computer key A held on Filament, a Cathode patch link applied (`__synth.share.apply`), A let go:
  the rail moves to Cathode, 0 voices on both, no key left down, sustain off.
- Master compressor switched on over the held sine: 1.07x (no click). Master volume in 1% steps (an arrow
  key): 1.0x.
- Phone 375 px: a tap on a key sounds and lets go; the deck opens with no sideways scroll and no button
  under 44 px.

### Findings

**R1110-1. Master bus moves click on a held note.** Area d. Broken. Measured. Fixed tonight.
- Steps: hold a note (a sine or a bass shows it best), switch the master delay on, then turn the master
  tempo knob one BPM, or change the delay division, its mix or the reverb's mix, or switch the delay on.
- Expected: the echoes follow the new time and the mix moves without a tick.
- Actual (live): one BPM (120 to 121) with the delay synced at 1/8 was 31x the sine's own step; delay
  time 375 to 376 ms free 4x; 1/8 to 1/4 22x; delay mix 0.35 to 0.37 2x and 0.35 to 0.8 21x; reverb mix
  0.28 to 0.30 4x and 0.28 to 0.8 42x; switching the delay on 9x (the first echo of the held note starts
  at full level, 15x at 0.53 s).
- Cause (code): `master.worklet.js` read the delay at the new length from the next sample and used the
  new mix at once.
- Fix: a new delay time crossfades from the old tap to the new one over 20 ms (a change during a fade
  waits for it to end); the delay and reverb mixes ramp (at most 5 ms for 0 to 1, landing exactly),
  from 0 when the effect is switched on; a delay switched on fills its line over the same glide. All start at their
  targets, so an offline render is unchanged. Measured on a local server, old tree against new, with the
  windows the check uses: tempo 12.7x to 1.0x, division 3.1x to 1.0x, delay mix 77x to 1.12x, reverb mix
  24x to 1.04x, delay on 3.3x to 1.0x, ping-pong tempo 4.2x to 1.22x. A first try with a 10 ms one-pole
  glide failed two Panic checks (a delay switched back on must match a new bus within 4 blocks); the
  ramp lands exactly and passes them. Check: "Mx. a master bus move glides
  with no click" (within 2x).

**R1110-2. Render WAV renders the old take after a file is imported.** Area e. Confusing. Measured.
Fixed tonight.
- Steps: record a take and play it, then import a .mid file (its tracks show, its play key lights), then
  press Render WAV.
- Expected: the file on show.
- Actual: `filament-take-....wav`, 3.5 s (the take's 1.5 s and the tail), not the 4 s file; the file
  renders only after it has been played once. The reverse held too: after playing a file, a new take
  rendered the file.
- Cause (code): `deck.js` chose by the last thing played.
- Fix: an import makes the file the deck's subject and a finished take makes the take; playing either
  still does. Check: "M. Render WAV renders what came in last" (fails on the old tree: both downloads
  were the take).

**R1110-3. Master volume jumps in one sample.** Area d. Confusing. Measured. Not fixed.
- Steps: hold a note, click the vol slider far from its thumb (100% to 30%).
- Actual: 12x to 22x the held sine's step (two runs). An arrow key's 1% step is clean (1.0x).
- Note: `setMasterVol` sets `E.master.gain.value`. A `setTargetAtTime` glide would fix it, but the
  check "Desk. master volume is the output gain and is not a patch" reads the gain straight after the
  set, so it would need to wait for the glide. Left for James (Open items) rather than change that check.

**R1110-4. Switching a master effect off cuts it at once.** Area d. Confusing. Measured (delay), inferred
(reverb).
- Steps: hold a note with the master delay on, switch the delay off.
- Actual: the echoes stop and the dry level returns in one sample: 2.7x the held sine's step. The
  worklet's off branch passes the input straight through, and the reverb's is the same.
- Note: an off that fades would mean the effect keeps running until its tail is gone, which touches the
  "off is a straight wire" rule. A design call; not fixed.

### Still open, re-measured tonight

- R1017-5: the rack transport at 90 BPM leaves the master delay's tempo at 120.
- R1017-10 and R1017-11 (phone): strips 22 px wide; octave readout C3 with C4 the first key.

### Not reported

- The Theremin pad is not recorded by the deck: already listed as still open under the Theremin roadmap
  item.

### Not covered tonight

Areas a, b, f, g, h. R1104-4 (Panic and the other tails) and R1101-2 and R1101-3 (tape echo) were not
re-run. Suggested next: a and b, including the new patch links (`?p=`) for every device's factory patches
from a phone, and Phantastron's new seed stepper.


## 2026-11-11 (review, areas f, g, h)

The live site was down for this run (R1111-3): every dxedge.net URL answered 502 Bad Gateway from nginx
from 12:24 UTC (4:24 AM PT) to at least 12:41 UTC, while other hosts loaded fine from the same box.
So everything below was measured on the repo tree at origin/main `b5596c6` (sw.js `dxedge-v203`, the
same code the 2 AM check found live and matching), served by a local static server the way the suite
serves it, with the service worker blocked. Chromium 1243 headless (the `chromium-1194` path is still
gone) at 1366 x 900 and 375 x 812 (touch, 2x). No page or console errors in any run. Focus tonight:
what landed since the last f, g, h night: patch links and patch files (10 Nov), Surprise me (11 Nov) and
the Rack tab's new project, mix and patch faceplate (11 Nov), then the project round trip, all 21 library
songs, the vendored and linked pages, and a keyboard walk of the faceplate.

### What worked (measured)

- Patch files on all 18 devices: a dxpatch file of each device's second factory patch, uploaded while
  lit on Filament, lands on its own device with the patch identical field for field, menu
  "* name (edited)", toast "Loaded ... on <device>." Thyratron, Lattice, Gleam and the other devices
  that attach late are included.
- Copy link (the key, not the hook): a 1277 character link to Filament Lead, the same text in the box
  and on the clipboard, toast "Link copied: Filament, "Filament Lead"", the window's lamp turns amber.
  Opened in a fresh context: same patch, `?p=` gone from the address, a held C4 sounds, undo is lit;
  undo goes back to that page's own previous patch and a reload keeps it. A Cathode link opened on a
  page lit on Thyratron switches the rail to Cathode with the patch, and undo stays on Cathode.
- Surprise me: the key is disabled with `aria-busy` while it renders (1.4 s here); the patch lands with
  its toast; its link opens the same patch elsewhere; a held A3 keeps sounding through a press and
  releases cleanly after; on Thyratron it says it draws for Filament and Cathode only.
- Project: save, change patch, tempo, mute and name, load saved: 0 differences against the saved
  project. Download (`filament-review-nov11.json`), upload in a fresh context: 0 differences, and 0
  after a reload. A project given to the patch row, and the reverse, are refused and leave everything.
- Library: all 21 songs load, play 2.5 s with their routed devices sounding (Filament 0.09 to 0.44,
  Cathode 0.12 to 0.92 strip peak), stop, and 2.5 s later no strip is above 0.003 and no note is
  held on Filament or Cathode.
- Vendored and linked pages, both sizes: Hexode plays a held key (peak 0.26) and links to /synth/ and
  Anode; Anode starts from its start key (0.48 desktop, 0.65 phone) and links back to /synth/ and
  Hexode; Gleam's full page sounds under a drag (0.04); Iris and Hand Orchestra load with their links
  (camera not tested). No page errors on any of them.
- Phone 375 on the Rack tab: no sideways scroll; every faceplate key and window is 44 px tall
  (project keys 64 to 90 px wide, patch keys 87 to 108 px).

### Findings

**R1111-1. A keyboard cannot upload a project, a mix or a patch.** Area h. Broken. Measured. Fixed tonight.
- Steps: Rack tab, Tab through the faceplate from the project name.
- Expected: save, load, download, upload on each row, each with a ring; Enter on upload opens the picker.
- Actual: Tab went from download straight to the next row's name window (projDown to mixName, mixDown
  to shareUrl, shareDown to surprise me). The three upload keys are labels over a file input set to
  `display: none` (since the rack framework, 13 Oct), so neither is in the tab order. The same rule
  hid Mote's Load file, Heptode's Open MIDI and Orthicon's Image and Audio from the keyboard.
- Fix: `.filebtn input` is transparent instead, laid over its label (same size, no pointer events), so
  it stays in the tab order; the label wears the amber ring while its input has keyboard focus. Mouse
  and touch still open the picker through the label (checked at both sizes); the phone layout is
  unchanged (labels 77 to 87 x 44 px). Mote's and Heptode's file keys are now reached by Tab too.
- Check: "Sh. Tab reaches each upload key ... and Enter clicks it". It reads the click Enter makes on
  the input, not the picker: headless Chrome showed the picker for only 3 of 9 Enter and 4 of 9 Space
  presses on the fixed tree, on any of the three inputs, while the click reached the input every time.
  Unfixed: Tab lands on mixName, shareUrl and surpriseBtn.
- Found on the way: the first version hid the input at 1 px, and the suite's phone checks ("10. 375px" and
  "390px": every mix desk control 44 px or more) read the input itself, so it failed four checks. The
  input now covers its label, border included (a second try at the padding box measured 42 px), which
  passes them without touching the checks.

**R1111-2. A file on the wrong row says only "not a project" or "not a mix".** Area f. Confusing.
Measured. Fixed tonight.
- Steps: Rack tab; upload a patch file with the project row's upload (or a project with the mix row's).
- Expected: the row says which row takes that file, as the patch row already did.
- Actual: "That file is not a project." and "That file is not a mix." With three keys all reading
  "upload" on one faceplate since today's graphics change, the wrong row is an easy pick.
- Fix: one helper names the file's kind (project, mix, patch, or a bare patch that names a device) and
  every row says "That is a patch file, not a project. Upload it on the patch row." and so on; anything
  else still says "That file is not a project." (or mix, or patch). The patch row's two messages
  changed wording to match ("on the project row" instead of "with the project keys above").
- Check: "Sh. an upload key given another row's file names the row that takes it" (6 cases). Unfixed:
  4 of 6 had no row named.

**R1111-3. dxedge.net down.** All areas. Broken. Measured.
- Steps: open https://dxedge.net/synth/ (or /, /sw.js, /otr/, www).
- Actual: 502 Bad Gateway, `server: nginx/1.31.1`, on 4 tries from 12:24 to 12:27 UTC and again at
  12:41 UTC. example.com, ntfy.sh and google.com loaded from the same box, so it is the site, not this
  network (inferred). The last pushes to main were the graphics run's at 12:15 UTC; whether the deploy
  caused it is not known from here. Nothing in this job can reach the droplet. James was paged (the
  ntfy topic answered 429, so the page went by the routine's own notification).

**R1111-4. Surprise me drops its draw without a word when the rail moves.** Area f. Confusing.
Measured (dropped), inferred (what a user sees).
- Steps: Filament, press surprise me, switch the rail to Cathode within the render (about 1.4 s).
- Expected: the patch lands on Filament anyway, or a toast says it was dropped.
- Actual: nothing lands and no new toast; the toast text is still the previous press's
  "Surprise: ... on Filament". The code returns `why: 'moved'` on purpose (leave the new device alone),
  so this is about saying so. A one-line toast ("Surprise for Filament dropped: the rail moved") would do.

### Still open, re-measured tonight

- R1020-3: a project still carries 14 devices (no Thyratron, Dekatron, Lattice, Gleam) and no master bus.
- R1030-3: Dekatron's pattern plays under all 21 library songs (strip peak 0.28 to 0.62), including
  the eight with no channel 10.
- R1020-4: the eight Halloween songs replace the lit Filament patch (Haunted Organ, Horror Pad, Eerie
  Bells and so on).
- R1020-7: Anode's four "⟳" buttons still have no name or title.
- R1020-8: 525 desktop tab stops with the roll closed, no skip link.
- R1024-3: Hexode has 13 unnamed controls at both sizes; Hexode still 1154 px wide at 375 px.
- R1025-5: the phone footer links are still 13 px tall.

### Not reported

- After a patch link, undo goes back to the page's previous patch and shows it as "(edited)" even when
  that was an unedited factory patch. Same family as R1025-3 (undo restores the sound, not the entry).
- Filament Lead reports two voices for one held key (`notes` [60, 60]): its unison, not a stuck note
  (both released).
- Lattice's Import WAV uses its own hidden input (`display: block`, zero width), not `.filebtn`; it was
  not walked tonight.

### Not covered tonight

Areas a, b, c, d, e. Nothing on the live site (down). Iris and Hand Orchestra were not played (camera).
Suggested next: a and b (Surprise me's draws by ear against the factory set, Klystron's source row),
and a recheck of every live page once the site is back.

## 2026-11-12 (review, areas a, b)

Live site https://dxedge.net/synth/, page version `0.19-resnatron`, origin/main `bd6b166`, sw.js
`dxedge-v207` (live and main agree). Playwright's own Chromium 1243 headless (the `chromium-1194` path
in the task prompt is still gone) at 1366 x 900 and 375 x 812 (touch, 2x). No page or console errors in
any run. The site was back (200) after the 11 Nov outage (R1111-3). Focus tonight: what landed since the
last a and b night (9 Nov): patch links and files (10 Nov), Surprise me (11 Nov), faces and Orthicon's
Picture card (12 Nov), Phantastron's seed stepper (10 Nov); plus every factory patch, user patches on five
more devices, and the first day's patches.

### What worked (measured)

- Area b, all 129 factory patches on the 18 devices picked from the menu: each shows under its own name,
  not as edited, no errors.
- Old patches still load: the 12 Filament factory patches from 12 Oct (`69a1385`) and the 11 Cathode ones
  from 13 Oct (`d094c5b`), imported as bare patch files, load on the lit device as "* name (edited)" and
  render finite, none over 0 dBFS. Against today's factory patch of the same name the chord is within
  1 dB on 17 of 23; Diode Squelch (3.9 dB), Magic Eye Sweep (3.3), Bakelite Organ (2.1) and Wide Novachord
  Strings (1.0) differ, which reads as later voicing changes to those factory patches, not a load fault.
- Patch links opened on a fresh page, 11 devices (Thyratron, Lattice, Additron, Rhumbatron, Klystron,
  Cathode, Dekatron, Mote, Gyrotron, Phantastron, Resnatron): the rail moves to the device, the menu reads
  "* Review <device> (edited)", `?p=` leaves the address, the patch equals the normalized original, and a
  held C major chord recorded from the live output sits within 0.7 dB of the same factory patch picked
  from the menu on Thyratron, Lattice, Additron, Rhumbatron and Cathode. Mote, Dekatron, Gyrotron,
  Phantastron and Resnatron land 1.7 to 4.5 dB apart; they run patterns, orbits or random phrases, and
  their own run-to-run spread was not measured. Klystron: see the notes.
- User patches through the form on Lattice, Dekatron, Gyrotron, Pentagrid and Thyratron, and a Surprise me
  draw on Filament: saved, current after a reload, in the menu, deleted with a toast. Phone 375 px, Cathode:
  save name, ok and cancel are 44 px and fit, delete is 57 x 44 px, no sideways scroll.
- Phone 375 px: every tab of all 18 devices (75 tabs) has no sideways scroll.
- Faces: on all 18 devices, at 1366 px, no text that reads at 3:1 or better on walnut drops below 3:1 under
  rack black or black light (a screenshot with text hidden gives each label's real background; 353 to 648
  labels a device). The low-contrast labels that exist are the same on all three faces.
- Phantastron seed: next and previous step by one; 0 is the floor and 4294967295 the ceiling on both keys;
  typed -5 lands on 0, 1e12 on the ceiling, 12.7 on 12.
- Orthicon's Picture card: each starter picture lights its key and names itself in the window; Generate
  with seed 42 reads "Generated 42 · major" and sounds; an empty or negative seed falls back to 1.

### Findings

**R1112-1. Orthicon: a starter picture does not survive a reload, a link or a saved patch.** Area a, b.
Confusing. Measured.
- Steps: Orthicon, Scan tab, pick Bell Partials on the Picture card, play C4 (RMS -21.5 dBFS). Then either
  reload, or copy link and open it, or save as "Bell mine", reload and pick it.
- Expected: the picture comes back, since it is one of the page's own eight, not a painting or a file.
- Actual: the patch's `picture` is `custom` in each case and the scan plays Ember Ridge's picture again
  (RMS -13.3 to -13.7 dBFS, the level of the factory patch). After the reload of the saved patch the
  window reads "Bell mine" over the ridge picture. Copy link and download warn only that "a painted or
  dropped picture is not in it". Switching the rail away and back without a reload keeps it.
- Cause (code): picking a starter picture draws it into the canvas and sets `picture: 'custom'`; the
  patch's picture field only knows the five factory pictures (`PICTURES` in `orthicon.js`).
- Left for James (Open items): carry the starter picture's id in the patch (a schema change), or say so in
  the notes.

**R1112-2. Save offered "<name> 2" for a name nobody had.** Area b. Confusing. Measured. Fixed tonight.
- Steps: Filament, Rack tab, surprise me (seed 12345 gives "Copper Line 2345"), save.
- Expected: the form offers "Copper Line 2345".
- Actual: it offered "Copper Line 2345 2". The same for a patch from a link or a file. And on a factory
  patch it offered "Plate Bass 2" even when a user patch already had that name, so pressing ok replaced it
  with no word (part of R1022-6).
- Fix: a user patch still offers its own name; any other patch offers its name when no factory or user
  patch has it, and otherwise the first free number ("Plate Bass 3"). Check: "Pn. save offers a free name
  as it is and a taken one with the first free number" (fails on the live tree: "Pn Unused Name 4821 2",
  and "Plate Bass 2" with a "Plate Bass 2" saved).

**R1112-3. Download patch did not say what the file leaves out.** Area b. Confusing. Measured. Fixed tonight.
- Steps: Orthicon (or Mote, Klystron, Lattice), Rack tab, download.
- Actual: the toast said "Downloaded orthicon-ember-ridge.json"; copy link on the same patch says "A
  painted or dropped picture is not in it.", and the file carries the same patch.
- Fix: the download toast adds the same sentence on those four devices. Check: "Sh. download patch says
  what the file leaves out where copy link does" (fails on the live tree).

### Still open, re-measured tonight

- R1022-5: deleting a Cathode user patch on a phone lands on Grid Bias Bass, not Plate Screamer.
- R1025-3: delete still removes a user patch at once with no dialog (Lattice, Dekatron, Gyrotron, Pentagrid,
  Thyratron, Cathode).
- R1022-3: Phantastron's Nursery Clock, one C4 held 1.5 s, records at -47 dBFS RMS from the live output.

### Notes (not findings)

- Klystron's Held Frost freezes the grains it has: opened from a link on a fresh page it recorded at
  -28 dBFS, picked from the menu on a page that had played other patches -39 dBFS. Inferred: the freeze
  holds whatever the buffer had, so the same patch sounds different by history. Expected for a freeze.
- Neighbouring Phantastron seeds (7 and 8 on Nursery Clock) correlate at 0.8 over 1.5 s: a step of one
  changes the phrase only a little.
- Surprise me names end in the seed's last four digits, so a saved draw keeps a number in its name.

### Not covered tonight

Areas c to h. Area a by ear on Surprise me draws, and the knob sweep, were not repeated (9 Nov).
Suggested next: c, d and e, including a take on a Surprise me draw and the patch link row with the deck.

## 2026-11-13 (review, areas c, d, e)

Live site https://dxedge.net/synth/, page version `0.19-resnatron`, origin/main `93ebfae`, sw.js
`dxedge-v211` (live matched main). Playwright's own Chromium 1243 headless (the `chromium-1194` path is
still gone) at 1366 x 900 and 375 x 812 (touch, 2x). No page or console errors on the live site in any
run. Audio was read from the live output with the master recorder (24-bit WAV decoded in the script)
and from `__synth.renderWav`. Pitch is the FFT peak over 0.25 s on a sine patch (Filament, osc 1 sine,
ensemble and room off). Focus tonight: what a MIDI keyboard or DAW sends besides notes (CC 121, program
change, repeated note-ons, two sources on one note), the deck's loop with controllers, bad and odd
.mid files, the tempo box, and the master bus at its extremes.

### What worked (measured)

- Pitch bend range: full up and down on A3 read 246.6 Hz and 196.2 Hz (2 semitones, as the patch says).
- Two MIDI note-ons on A3 with one note-off: silent after the off, nothing held.
- A3 from MIDI and the same on-screen key held with the mouse: the MIDI off leaves the mouse's note
  sounding (1 voice); mouse up leaves 0 voices.
- Computer keys do not play while typing in the tempo, project name, mix name, patch link or render
  length boxes.
- 30 fast retriggers of C4 with the pedal down: 1 voice, not 30.
- Master bus extremes on Screaming 12AX7 with a 7-note chord at full velocity: no NaN in any render.
  Compressor at threshold -60, ratio 20, attack 0.1 ms, release 5 ms, knee 0, makeup 24: peak -29.9 dBFS
  with or without its limiter. The master "limit" switch alone holds -1.0 dBFS with delay feedback 0.95,
  mix 1 and reverb size 1, damp 0, mix 1, and -6.0 dBFS with the ceiling at -6.
- Deck import messages: a non-MIDI file says "not a Standard MIDI File (no MThd header)", a header with
  no tracks says "no tracks". A format 0 file with channels 1, 2 and 10 in one track splits into three
  parts, assigned Filament, Cathode and off.
- Phone 375 px: the deck opens with no sideways scroll and no control under 44 px; armed, two taps on
  a key record a two-note take.

### Findings

**R1113-1. A looping file or take that ends bent comes round out of tune.** Area e. Broken. Measured.
Fixed tonight.
- Steps: import (or record) something whose last controller move leaves the pitch bend up (or the
  wheel up), switch loop on, play.
- Expected: every pass sounds like the first.
- Actual (live): a 1 s file, A3 from 0 to 0.4 s and a full bend up at 0.45 s: the first pass at 220.0 Hz,
  every later pass at 247 Hz (2 semitones sharp) until Stop.
- Cause (code): at the loop's end `deck.js` sent note offs and a pedal-up, but left bend, wheel and
  pressure where the file had put them; Stop resets them, the loop did not.
- Fix: the end of each pass now also sends bend, wheel and pressure back to rest at the same sample.
  Measured on a local server, old tree against new: passes 220.0, 247.0, 247.0 Hz against 220.0, 220.0,
  220.0 Hz. Check: "M. loop: a file that ends with the bend up comes round in tune".

**R1113-2. MIDI CC 121 (Reset All Controllers) is ignored.** Area c. Broken. Measured. Fixed tonight.
- Steps: hold a note from a MIDI keyboard, bend up (and push the wheel, press the pedal), then send CC 121
  (many keyboards and DAWs send it on stop or on a reset button).
- Expected: bend to centre, wheel and pressure to 0, pedal up, as the MIDI spec asks.
- Actual (live): the note stayed at 247.6 Hz after CC 121 (A3 bent 2 semitones); the strips stayed up
  and sustain stayed on. Only CC 120 and 123 were handled (as Panic).
- Fix: the page's MIDI input resets bend, wheel and pressure (and their strips) and lets go of the pedal
  on CC 121, unless the user has mapped CC 121 to a knob with Learn. Files are unchanged (the player
  already drops CCs it does not use). Measured on a local server: after CC 121 the note read 247.6 Hz
  (old) and 220.0 Hz (new); strips 1 and 1 against 0 and 0; sustain on against off. Check: "M. CC 121
  resets the controllers".

**R1113-3. Program change does nothing.** Area c. Missing. Measured (ignored), inferred (expectation).
- Steps: send a program change (0xC0, 5) over MIDI, as a keyboard's patch buttons do.
- Actual: the patch stays; nothing says the message was seen. `midiEvent` returns nothing for 0xC0.
- Note: which list a program number picks (the lit device's factory list, the menu order, user patches
  too) is a design call. Left for James (Open items).

**R1113-4. The tempo box rounds what it shows, not what it sets.** Area d. Confusing. Measured.
- Steps: type 120.5 in the rack's tempo box, press Enter.
- Expected: the box and the clock agree.
- Actual: the box reads 121, the transport runs at 120.5 (and the master delay's own tempo stays 120,
  R1017-5). `commitTempo` passes the raw value to `setTempo` and shows `Math.round` of it.
- Note: either round the value set (the box's step is 1) or show the decimal. Not fixed tonight (two
  fixes already).

**R1113-5. A failed import leaves the old file behind a new error.** Area e. Confusing. Measured.
- Steps: import a good .mid (three tracks show), then import a file that is not MIDI.
- Actual: the status line reads "bad.mid: This is not a Standard MIDI File (no MThd header)." while
  good.mid's three tracks stay listed and its play key stays enabled and plays good.mid.
- Expected: the error, plus a word that the previous file is still loaded (or its name back in the
  status line after the error).

**R1113-6. A file cut short gives a puzzling message.** Area e. Confusing. Measured.
- Steps: import a .mid truncated in the middle of its track (a broken download).
- Actual: "This MIDI file has data with no status byte." Expected: that the file ends early or is
  damaged.

**R1113-7. Recording along with a file does not line up.** Area e. Missing. Inferred (code).
- Steps: import a backing file, press its play, arm rec and play along.
- Actual (code): the take's zero is its own first note, the file's notes are not recorded, and play
  take plays the take alone (play stops any other playback). So an overdub is not possible, and an
  exported take does not line up with the file it was played over.
- Note: a feature (record from the file's start, or merge the take into the file), not a defect. Open
  items.

### Still open, re-measured tonight

- R1017-5: the rack transport at 100 BPM leaves the master's tempo at 120.
- R1017-9: see the table; the "limit" switch protects the output, but it is off by default.

### Not covered tonight

Areas a, b, f, g, h. R1110-3, R1110-4, R1104-4, R1101-2 and R1101-3 were not re-run. Suggested next:
f, g and h, including the paper roll's play with a song (R1108-3 to R1108-5) and focus order on the
deck after an import.
