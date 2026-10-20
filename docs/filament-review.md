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
| R1020-3 | missing | f | A project leaves out the Thyratron, Dekatron, Lattice and Gleam patches and the master bus | measured (Gleam inferred) |
| R1017-3 | missing | e | MIDI deck Render WAV ignores the mixer (level, pan, mute, solo, sends) | measured |
| R1020-4 | confusing | f | A Halloween song replaces the lit device's patch, even an edited one, with no notice | measured |
| R1020-5 | confusing | f | A song loaded before every device has attached is routed against the devices present then | inferred |
| R1020-6 | confusing | g | Hexode: Hold and the original panel controls show no focus ring | measured |
| R1020-7 | confusing | g | Anode: the regenerate buttons are named only by the glyph "⟳" | measured |
| R1020-8 | confusing | h | Desktop rack: 408 tab stops and no skip link; the library is stop 392, Panic 399 | measured |
| R1020-9 | confusing | h | 23 control names repeat across sections ("level" x4, "cutoff" x3, "oct" x2) with no section in the name | measured |
| R1017-4 | confusing | e | Deck Render WAV writes 16-bit 48 kHz; the master render and record write 24-bit 44.1 kHz | measured |
| R1017-5 | confusing | d | Three separate tempos: rack transport, master delay tempo knob, deck 50-200% | measured |
| R1017-6 | confusing | d, e | Two buttons both read "● rec" (header records audio, deck records MIDI); two "render wav" buttons render different things | measured |
| R1017-7 | confusing | c | At 1366 px the keyboard sits 4191 px down a 4862 px page, under all 18 mixer strips | measured |
| R1017-8 | confusing | d | Mixer strip meters are pre-fader: a muted strip still shows level | measured |
| R1017-9 | confusing | d | No output protection with the compressor off: delay plus reverb can hard-clip at 0 dBFS | measured |
| R1017-10 | confusing | c | Phone: pitch and mod strips are 22 px wide (target rule is 44 px) | measured |
| R1017-11 | confusing | c | Phone: the octave readout says C3 while the first visible key is C4 | measured, impact inferred |

Fixed: R1017-1 and R1017-2 (17 Oct), R1020-1 and R1020-2 (20 Oct). Still open from the nightly checks: Hexode scrolls sideways at 375 px (measured again 20 Oct: 1154 px wide).

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
