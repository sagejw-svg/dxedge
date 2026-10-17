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
| R1017-3 | missing | e | MIDI deck Render WAV ignores the mixer (level, pan, mute, solo, sends) | measured |
| R1017-4 | confusing | e | Deck Render WAV writes 16-bit 48 kHz; the master render and record write 24-bit 44.1 kHz | measured |
| R1017-5 | confusing | d | Three separate tempos: rack transport, master delay tempo knob, deck 50-200% | measured |
| R1017-6 | confusing | d, e | Two buttons both read "● rec" (header records audio, deck records MIDI); two "render wav" buttons render different things | measured |
| R1017-7 | confusing | c | At 1366 px the keyboard sits 4191 px down a 4862 px page, under all 18 mixer strips | measured |
| R1017-8 | confusing | d | Mixer strip meters are pre-fader: a muted strip still shows level | measured |
| R1017-9 | confusing | d | No output protection with the compressor off: delay plus reverb can hard-clip at 0 dBFS | measured |
| R1017-10 | confusing | c | Phone: pitch and mod strips are 22 px wide (target rule is 44 px) | measured |
| R1017-11 | confusing | c | Phone: the octave readout says C3 while the first visible key is C4 | measured, impact inferred |

Fixed tonight: R1017-1 (recorder and wheels threw on 16 devices), R1017-2 (deck Render WAV had no master bus).

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
