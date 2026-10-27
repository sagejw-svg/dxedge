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
| R1027-2 | confusing | f | For several seconds after opening (about 8 s on the live site, headless) the Mix desk shows no arms and the default desk bus; the saved ones appear when the boot finishes | measured |
| R1026-3 | confusing | d | Two reverbs and two delays: the strip sends feed the Mix desk's own room and an unsynced delay, not the master bus effects | measured |
| R1026-4 | confusing | d | Master reverb at mix 1 is about 10 dB louder than dry (chord peak 0.57 dry, 1.77 wet; 3.1 at size 1, damp 0) | measured |
| R1026-5 | confusing | c, h | Space on a focused button is the sustain pedal, so Space never presses hold, the deck, or any chip (Enter does) | measured |
| R1026-6 | confusing | d | Clearing the tempo box and pressing Enter sets 40 BPM instead of keeping the tempo | measured |
| R1026-7 | confusing | e | First switch to Trochotron (151 ms) or Lattice (125 ms) blocks the page about as long as the deck's 150 ms lookahead | measured (block), inferred (stutter) |
| R1025-3 | confusing | b | Delete removes a user patch at once: no confirmation and no undo | measured |
| R1025-4 | confusing | a, h | Cathode pitch mod A and B: an arrow key moves 0.1% of travel; 100 presses reach +24 cents | measured |
| R1025-5 | confusing | h | Phone: the footer links (Tip the developer, Hand Orchestra, Hexode, Anode) are 13 px tall | measured |
| R1024-3 | confusing | g, h | Hexode: the 13 operator On/Off and Fixed toggles have no name and no pressed state | measured |
| R1023-3 | confusing | c, e | Armed devices other than Filament and Cathode are left out of a MIDI take with no word; with only those armed the deck sits on "armed: play a note" | measured |
| R1023-4 | confusing | c | A pitch bend or mod wheel moved before a strip is armed stays on the old device after arming | inferred (code) |
| R1023-5 | missing | c | Gleam ignores the sustain pedal (CC64) and the keyboard's hold button | measured (CC64), inferred (hold button) |
| R1020-3 | missing | f | A project leaves out the Thyratron, Dekatron, Lattice and Gleam patches and the master bus; still open 24 Oct | measured (Gleam inferred) |
| R1017-3 | missing | e | MIDI deck Render WAV ignores the mixer (level, pan, mute, solo, sends); still open 26 Oct | measured |
| R1022-3 | confusing | a, b | Phantastron is 20 to 30 dB quieter than the other devices; its first patch peaks at 0.03; still open 25 Oct | measured |
| R1022-4 | confusing | a | Phantastron's bits slider at 1 to 3 (and a GND to BITS wire) silences the speaking carts | measured |
| R1022-5 | confusing | b | Delete lands on the first patch in list order, not the device's own first sound; still open 25 Oct | measured |
| R1022-6 | confusing | b | Save over an existing user patch name replaces it with no question | inferred (code) |
| R1020-4 | confusing | f | A Halloween song replaces the lit device's patch, even an edited one, with no notice | measured |
| R1020-5 | confusing | f | A song loaded before every device has attached is routed against the devices present then | inferred |
| R1020-6 | confusing | g | Hexode: Hold and the original panel controls show no focus ring; still open 24 Oct | measured |
| R1020-7 | confusing | g | Anode: the regenerate buttons are named only by the glyph "⟳"; still open 24 Oct | inferred (code, 24 Oct) |
| R1020-8 | confusing | h | Desktop rack: 426 tab stops (27 Oct; 409 on 24 Oct) and no skip link; the library is near the end | measured |
| R1020-9 | confusing | h | 56 control names repeat across sections (27 Oct: "off" x6, "cutoff" x4, "level" x4, the six filter model chips x2 since Filter B) with no section in the name | measured |
| R1017-4 | confusing | e | Deck Render WAV writes 16-bit 48 kHz; the master render and record write 24-bit 44.1 kHz | measured |
| R1017-5 | confusing | d | Three separate tempos: rack transport, master delay tempo knob, deck 50-200%; still open 26 Oct | measured |
| R1017-6 | confusing | d, e | Two buttons both read "● rec" (header records audio, deck records MIDI); two "render wav" buttons render different things | measured |
| R1017-7 | confusing | c | At 1366 px the keyboard sits 4191 px down a 4862 px page, under all 18 mixer strips | measured |
| R1017-8 | confusing | d | Mixer strip meters are pre-fader: a muted strip still shows level; still open 23 Oct | measured |
| R1017-9 | confusing | d | No output protection unless limit is switched on: delay plus reverb can hard-clip at 0 dBFS; still open 26 Oct | measured |
| R1017-10 | confusing | c | Phone: pitch and mod strips are 22 px wide (target rule is 44 px); still open 26 Oct | measured |
| R1017-11 | confusing | c | Phone: the octave readout says C3 while the first visible key is C4; still open 26 Oct | measured, impact inferred |

Fixed: R1017-1 and R1017-2 (17 Oct), R1020-1 and R1020-2 (20 Oct), R1022-1 and R1022-2 (22 Oct), R1023-1 and R1023-2 (23 Oct), R1024-1 and R1024-2 (24 Oct; R1024-2 also covers the mute and solo part of R1020-9), R1025-1 and R1025-2 (25 Oct), R1026-1 and R1026-2 (26 Oct), R1027-1 (27 Oct). Still open from the nightly checks: Hexode scrolls sideways at 375 px (measured again 20 Oct: 1154 px wide).

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

