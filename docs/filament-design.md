# Filament: a tube synthesizer for DXEdge

Design brief, v0.5, 14 Oct 2026 (v0.1 was 11 Oct; v0.3 added build status; v0.4 adds Cathode, the second device; v0.5 adds Dekatron, the drum machine). Filament is the name (decision 1). The decisions James answered on 13 Oct are recorded in the Decisions table at the end; the changes they caused are marked **(decision N)** where they land in the text.

## Build status (13 Oct 2026)

Phase 0 and 0.1 are live at dxedge.net/synth and in a new Synth tab group on the main page (commit `69a1385` on main). The repo file `docs/filament.md` is the working status and roadmap checklist; a nightly build task reads it, fixes bugs first, then builds the next 0.2 item. Anything written under "Notes from James" in that file steers the next night's run.

What shipped in 0.1, all measured by `scripts/test_synth.py` (103 checks, all passing):

* Voice engine in one AudioWorklet at 2x oversampling with a half-band decimator on the stereo sum. BLEP/BLAMP oscillators: saws and pulses at 4 kHz keep aliases about 71 dB down.
* Valve 12 and Ladder 24 filters. Cutoff is exact at zero resonance. Self-oscillation tracks the keyboard to within 1.5 cents over 4 octaves for every loop tube; that needed a per-tube calibration table and a coupling cap that sits at a fixed ratio below the cutoff.
* Loop tubes voice the resonance as designed: triodes lead with the 2nd harmonic, EL34, 6L6 and KT88 with the 3rd. To get the power tubes there, full resonance drives the loop 55% past the oscillation point, and the resonance knob follows a curve so oscillation starts around 8.5 on the knob.
* The push-pull output pair cancels even harmonics by more than 60 dB against single ended.
* Patch changes, note on and off, and voice stealing are click-free (duck, swap while silent, ramp back).
* 30 seconds of random patch and controller changes produce no NaN and nothing over 0 dBFS. A final ceiling was added after the copied /otr clipper because its 2x oversampling filter can overshoot it by about 1%.
* CPU: about 20% of real time for 8 voices including the rack, in headless Chrome on the build server. Not yet checked on a real phone.

**Stereo round (13 Oct, late evening, commit `28a975f`)**, chosen by James as the next round: unison 1 to 8 with detune and spread, filter stereo offset (two filters per voice only when used), LFO 2 with an auto-pan destination, stereo phase 0 to 180 degrees on both LFOs, the ensemble (I, II, I+II, strings) before the output tubes, and the /otr goniometer and correlation meter. Two new factory patches (Seven Filaments, Twin Sweep); five revoiced to use the new stereo. Suite: 127 checks, all passing. Found and fixed in the same push: the final ceiling added in 0.1 had 1.9 dB of gain below its knee. Known tradeoff: a wide stereo offset on Ladder 24 can thin out in mono (two 4-pole filters an octave apart); Valve 12 stays within about 2.5 dB, and the correlation meter goes amber below zero.

**Cathode, the second device (13 Oct, just after midnight)**. James asked for "a Korg MS-20 Mini". Claude declined to copy Korg's product (its name, panel and branding) and offered an original semi-modular monosynth in the same family instead; James chose the name Cathode, a second device in the rack at /synth/, and a patch panel with cables (decision 9). What shipped: one voice at 2x with VCO 1 (tri, saw, pulse, noise; 32' to 4'), VCO 2 (saw, square, narrow, ring; semi, fine, sync), V1 drive tube, a high-pass then a low-pass (2-pole state variable filters whose resonance runs through a diode clipper, so a loud input fights the peak; both self-oscillate from about 8 on the knob and track the keys to within a cent), V2 as a cathode follower after the low-pass, and the VCA. Modulation: MG with a shape knob (ramp down, triangle, ramp up), EG 1 (delay, attack, release), EG 2 (hold, ADSR), sample and hold, white and pink noise, glide, multi or single trigger. The patch panel has 18 outputs and 18 inputs; every input prints its normal (the pre-wired source) and a cable overrides it. Patch by click, drag or keyboard; drag a plug to move or pull it; the knobs that scale a jack name what is reaching it. A rail above the chassis picks which device the keyboard, wheels and MIDI play; both devices feed the same ensemble and output tubes, which take their settings from the active device's patch. An inactive or silent device sleeps, so Cathode costs nothing until it is used. 11 factory patches (Grid Bias Bass, Plate Screamer, Bubble Lab, Filter Kick, Ring Bells, Sync Sweep, Night Wind, Growl FM, Trill Gate, Theremin Glide, Hollow Reed), all near -14.5 dB like Filament's. Suite: 190 checks, all passing, including filter cutoff and tuning, normals, cables, feedback patches, fuzz, the panel UI on desktop and phone, and sleep and wake. Not built (offered, not chosen): an external audio input through the filters.

**Dekatron, the drum machine (14 Oct)**. An original analog-style drum device on the same rail: kick, snare, closed hat, open hat, clap, tom and rim, synthesized in its own AudioWorklet at 2x with a half-band decimator, plus a 16-step pattern (per-step accent, swing, pattern length 1 to 16). The panel is the site's dark panel with amber steps. The keys play the voices. It does not use DaisySP or any other drum code; the shapes are written from the ordinary drum vocabulary. The device stays behind `drumDevice` / `createDrumHost` so a later rack host can mount it without taking in Filament's engine. Six factory patterns. Measured in the D. section of `scripts/test_synth.py`. The full adapter is written up in `docs/filament.md`.

Calls made during the build that are worth reviewing: the default first patch is Wide Novachord Strings with a 120 ms attack; the main-page tab shipped right away (your answer: live with the tab now); the Diode Squelch and Hollow Pluck patches use Ladder 24 and Valve 12 until Diode 18 and the low pass gate arrive in 0.2.

## The pitch

Filament is a playable polyphonic synthesizer in the browser. It is built around the parts of the /otr Advanced rack you liked best: the lit tubes and the stereo controls.

The tubes do real work here, not just set dressing:

* A tube drives the filters.
* A tube sits inside the resonance loop of the signature filter, so swapping a 12AX7 for an EL34 changes how the filter screams.
* A push-pull pair of tubes runs the output stage.
* Every tube on the panel glows with the signal actually passing through its stage.

It lives at dxedge.net/synth as a standalone full page, the same way /otr does. If it earns it, it can get a short vanity domain later, as listenotr.com does for the radio.

## Goals

1. **It sounds good the moment you touch it.** The first key press makes a warm, wide, musical sound. There are no empty patches and no setup screen.
2. **Filters with character.** Every filter model is nonlinear and has its own personality, and each one self-oscillates where the real circuit would.
3. **Tubes you can see and hear.** The same tube voicings, looks and Tube view as /otr, now as instrument stages.
4. **Stereo as a first-class control.** Voices, filters, LFOs and effects all have stereo controls. The goniometer and correlation meter are always visible. Everything folds to mono without cancelling.
5. **Plays three ways.** On screen (touch or mouse), from the computer keyboard, and from a MIDI keyboard.
6. **House rules.** No ads, no cookies, no accounts. Patches are saved on the device and shared by link.

## Where this is going

James, 13 Oct 2026: "eventually I want this to be a great synth to compete with Propellerhead."

Propellerhead Software became Reason Studios in 2019, and the product is Reason: a virtual rack of instruments and effects that you cable together on the back panel, with a sequencer and a mixer around the rack, sold as a standalone DAW and as the Reason Rack plugin. So the long-term target is not one synth but a rack that holds many devices, and Filament is the first device in it.

That does not change v1. The v1 exclusions below stand, but they are "later", not "never". It does change a few things that are cheap to get right now and expensive to retrofit:

* **Device boundary.** Build the synth as a device with a clean interface: a parameter list with stable ids, MIDI in, stereo out, and the patch as versioned JSON. A second device (a drum machine, a sampler, a second synth) should be able to sit beside it without touching its insides.
* **Clock belongs to the host.** The arpeggiator, LFO sync and the later sequencer read one shared tempo and transport from day one, even while the only host is the page itself.
* **Effects as devices.** The rack row (ensemble, tape echo, spring, EQ, output tubes, speaker, room, width) is a chain of modules with a common in/out shape, which /otr's `makeChain` already nearly is. Keep it that way so the modules can be reordered or cabled later.
* **The rest of Reason stays in Later.** Patterns, an arranger, a mixer, back-panel cables, multitimbral parts. Each is a project of its own and should get its own brief when its turn comes.

## Not in scope for v1

These are v1 exclusions, not permanent ones (see "Where this is going").

* Sampling or sample playback
* Multitimbral parts or a DAW-style arranger
* A plugin version (VST, AU)
* Cloud saving or user accounts
* MPE (a candidate for later)
* Microtuning (a candidate for later)

## Where it lives

|Item|Plan|
|-|-|
|URL|`dxedge.net/synth/` **(decision 2)**. The path stays fixed whatever the final name is.|
|Page|`frontend/public/synth/index.html`, self contained like `/otr/`, with an AudioWorklet module beside it (`synth/voice.worklet.js`)|
|Main page link|Standalone page first **(decision 3)**. A thin `Synth.jsx` iframe shell with its own tab next to OTR was the recommendation and is assumed unless James says otherwise; it is a small addition either way.|
|Shared code|**Copied** from /otr into `/synth/` rather than extracted into `/lib/` **(decision 5: "copy it")**. Accepted cost: two copies of the tube code that can drift. Suggested mitigation: a header comment in each copied file naming the /otr source file and the commit it was copied at, so a later extraction is mechanical.|
|Caching|Needs a `location ^\~ /synth/` no-cache carve-out in `nginx/nginx.conf` (like `/crane-cab/`), because the regex rule gives unhashed `.js` files a 1 year immutable cache. Add `/synth/` to the `mutable` list in `sw.js`. Bump `CACHE\_NAME` on every frontend change.|
|Usage stats|Load the existing `/lib/stat.js` beacon. It is anonymous: no cookies, no IP on disk.|
|Support|A tip link in the header and the footer, pointing at the same Ko-fi page as OTR, https://ko-fi.com/oldtimeradio **(decision 4)**: "Tip the developer: Helps cover hosting and development."|
|Later|An optional vanity domain that forwards to /synth, like listenotr.com **(decision 8: later)**|

## What carries over from /otr

These are already built and tested, so the synth reuses them rather than rebuilding them.

* **Tube voicings.** The nine tubes and their fitted voicings: 12AX7, 12AT7, 12AU7, 300B, EL84, 6V6, EL34, 6L6, KT88. The asymmetric soft clipper `g(u) = u / (1 + |k\*u|^h)^(1/h)` uses separate positive and negative knees, and bias sets the even harmonics.
* **Effects chain.** The `makeChain` order is graphic EQ > tube stage > speaker cabinet > room > stereo width > limiter. It includes the click-free rerouting and the auto makeup gain, so knobs change colour, not volume.
* **Width module.** Mid/side with a synthetic side that is band limited to 220 Hz to 7 kHz. Folding to mono gives exactly the mid.
* **Meters.** The goniometer and phase correlation meter.
* **Tube looks.** Natural, Black light, Thermal, Neon, X-ray, Night vision and Vintage photo. Also the Tube view with zoom, pan, brightness, response, speed and flicker.
* **Rotary knob.** Drag up or down (shift for fine), arrow keys, double click to reset, and full keyboard access.
* **Lava lamp.** The lava lamp module, including its "music warms the bulb" switch.
* **iOS handling.** The `navigator.audioSession.type = 'playback'` fix so the iPhone silent switch does not mute it, and unlocking audio on the first gesture.

**Phase 0 step (decision 5):** copy these into `/synth/` with no behaviour change. /otr itself is untouched, so its 14 test suites keep passing by construction. Each copied file gets a header comment naming its /otr source and the commit it came from.

## Signal flow

```
 per voice (inside the AudioWorklet, up to 8 voices, each with up to 8 unison copies)
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │ OSC 1 ─┐                                                                     │
 │ OSC 2 ─┼─ MIXER ── V1 DRIVE TUBE ──┬─ FILTER A ─┬── VCA ── voice pan ──► L/R  │
 │ SUB   ─┤   (ring mod, FM, sync)    └─ FILTER B ─┘   ▲                         │
 │ NOISE ─┘                     serial / parallel /    │ AMP ENV                 │
 │                              split (A left, B right)                         │
 │          FILTER ENV, MOD ENV, LFO 1/2, mod matrix ─► everything above        │
 └──────────────────────────────────────────────────────────────────────────────┘
                                   │ stereo sum
                                   ▼
  ENSEMBLE ─► TAPE ECHO ─► SPRING REVERB ─► GRAPHIC EQ ─► V3/V4 OUTPUT TUBES ─►
  SPEAKER CAB ─► ROOM ─► STEREO WIDTH ─► LIMITER ─► out
                         (goniometer, correlation and stereo VU tap the final output)
```

Each voice is processed inside an AudioWorklet. The effects after the voices are the plain Web Audio rack from /otr, plus three new modules: ensemble, tape echo and spring reverb.

## The voice

### Oscillators

* **OSC 1 and OSC 2.** Saw, pulse with PWM, triangle and sine. All are band limited with PolyBLEP so they do not alias.

  * Controls per oscillator: octave, semitone, fine, level.
  * OSC 2 adds hard sync to OSC 1, linear FM from OSC 1, and ring modulation.
* **Sub.** A square wave or sine, one or two octaves down.
* **Noise.** White or pink.
* **Drift.** A slow random walk per voice, from 0 to about 8 cents. Analog voices never sit exactly in tune, and a little drift is a large part of why old synths sound alive. The default is low.

### The tube before the filters (V1)

The mixer feeds a tube stage before the filters. You pick any of the nine tubes and set drive and bias, using the /otr voicings. Turning up drive into the filter is the classic way to get a fat, saturated tone. It is also the first tube on the panel, and it glows with the mixer level.

### Filters

There are two filter slots, A and B. They can run in three routings:

* **Serial:** A, then B.
* **Parallel:** A and B side by side.
* **Split:** A plays on the left channel and B on the right. This is a stereo filter you can play: give each side a different model and sweep both.

All models are built as zero-delay feedback designs, oversampled 2x, with saturation inside the loop. That is what lets them self-oscillate and saturate the way the circuits they are named after do.

|Model (panel name)|What it is|Character|Self-oscillates|
|-|-|-|-|
|**Valve 12** (signature)|2-pole resonant lowpass. The resonance feedback runs through the selected tube's transfer curve, through a coupling capacitor highpass, and through a power supply sag follower.|Changes with the tube. Preamp triodes give a soft, singing whistle. Power pentodes give a gritty, vocal scream. Bias adds even harmonics to the resonance. Sag makes a loud resonant peak bloom and then settle.|Yes, warm and slightly unstable|
|**Ladder 24**|4-pole transistor ladder, the classic 1960s modular filter|Fat and smooth. Bass thins as resonance rises.|Yes, a clean sine|
|**Diode 18**|Diode ladder, three coupled poles|Squelchy, rubbery, the acid bass sound|Yes|
|**Sallen-Key 12**|Aggressive 2-pole lowpass and highpass pair, 1970s semi-modular style|Snarling, screaming resonance that clips hard|Yes, harsh|
|**Poly 24**|OTA cascade, as in early 1980s polysynth chips|Polite, creamy, good for pads|Yes|
|**State variable 12**|Clean multimode: lowpass, bandpass, highpass, notch, with a morph knob|Precise and transparent|Yes|
|**Low pass gate**|A vactrol-style gate: filter and volume move together with a slow optical lag|Plucked, woody, natural decays|No|
|**LC resonators**|A fixed bank of three bandpass resonators plus a lowpass and a highpass, in the style of the 1939 Novachord (see below)|Hollow, vocal, old|No|

Controls per slot:

* **Main:** model, cutoff, resonance, drive, key tracking (0 to 100%), envelope amount, velocity amount.
* **Stereo offset:** moves the left and right cutoffs apart by up to plus or minus one octave, so a sweep travels across the stereo field.

Live response plot: a small screen draws the actual magnitude curve of each filter as you turn the knobs, resonance peak included. This reuses the RBJ and biquad response maths already in /otr for the rack EQ. It needs a new routine for the nonlinear models, plotted from a linearised small-signal response.

### Envelopes, LFOs, modulation

* **Envelopes.** Three ADSR envelopes: amp, filter and a free one. Each has attack, decay and release curve shape, and velocity scaling.
* **LFOs.** Two, with sine, triangle, saw, square, random step and smooth random shapes.

  * Rate is free or synced to the arpeggiator tempo.
  * Each LFO is per voice or global.
  * **Stereo phase** from 0 to 180 degrees offsets the left and right LFO. On amp this gives auto pan. On cutoff it gives a sweep that moves between the speakers.
* **Mod matrix.** Eight slots, each one source to one destination with an amount.

  * Sources: envelopes, LFOs, velocity, key, mod wheel, aftertouch, random per note.
  * Destinations: almost every knob, including tube drive and bias.
* **Voice modes.**

  * Poly, with 8 voices (16 on desktop as an option).
  * Mono and Legato, with glide.
  * Unison: 1 to 8 copies per note, with detune and spread.

### "1939" mode: a tube-era voice

This is an optional voice architecture in the spirit of the Hammond Novachord. That instrument first appeared at the 1939 New York World's Fair, used 163 vacuum tubes, and could play all 72 notes at once ([Wikipedia](https://en.wikipedia.org/wiki/Novachord)). The mode copies the ideas, not the circuit:

* **Divide down.** Twelve top octave oscillators, with every lower octave derived by division, as on the original. Octaves stay phase locked, which gives the fused, organ-like body.
* **LC resonators.** Three parallel bandpass filters plus a lowpass and a highpass, fixed per voice like the original, picked from a tone tab row.
* **Seven envelope shapes** on a rotary switch, with release on the sustain pedal (space bar or MIDI CC64), as on the original.
* **Vibrato.** A six channel vibrato near 7 Hz with each channel at a slightly different rate, which gives an ensemble shimmer.

## Stereo

You said you love the stereo controls, so stereo gets its own section on the panel rather than one knob at the end of the chain.

|Control|What it does|
|-|-|
|**Unison spread**|Spreads unison copies across the field. Detune and spread are separate knobs.|
|**Voice pan mode**|Centre, Alternate (successive notes go left, right, left), Keyboard (low notes left, high notes right, like sitting at a piano), or Random drift|
|**Filter stereo offset**|Separate left and right cutoffs (see Filters)|
|**Split filter routing**|Filter A on the left, Filter B on the right|
|**LFO stereo phase**|Auto pan and stereo sweeps|
|**Ensemble**|A bucket brigade style chorus with modes I, II and I+II, plus a three phase string ensemble|
|**Tape echo**|Mono, ping pong and offset modes. Wow and flutter, and a tube record amp that saturates when you push it.|
|**Spring reverb**|A tube-driven spring tank, with two springs of different lengths for true stereo, and a drip control|
|**Room**|The /otr room, with its generated impulse responses: living room, studio, theater, hall|
|**Width**|The /otr mid/side width, 0 to 200%, which never flips polarity|
|**Mono check**|A momentary button that folds to mono so you can hear what a phone speaker will play|
|**Meters**|Goniometer, correlation meter, and a pair of needle VU meters, always on screen|

**Rule:** every stereo feature has to survive a mono fold. A test renders each factory patch, sums it to mono and fails if the mono level drops more than 3 dB below the stereo level. The correlation meter turns amber below zero.

## The tube chassis

A strip of brushed metal chassis runs across the top of the instrument. It carries the tubes and the meters, and it is the part people will screenshot.

```
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │  (V1)      (V2)       (V3)(V4)       ◉ magic eye    \[ VU L ]\[ VU R ]  ( lamp ) │
 │  drive     loop       output pair       tuning/level    needles        optional│
 │  12AX7     12AT7      EL34 x2 PP                                              │
 └──────────────────────────────────────────────────────────────────────────────┘
```

* **V1, Drive.** The tube before the filters.
* **V2, Loop.** The tube in the Valve 12 resonance loop. It sits dark when no Valve filter is in use.
* **V3 and V4, Output.** The /otr tube stage, built as a pair. A **Topology** switch picks Single ended or Push-pull:

  * Single ended favours even harmonics (the 300B sound).
  * Push-pull drives two shapers in opposite phase and subtracts them, which cancels the even harmonics and leaves the odd ones, as a real push-pull stage does.
* **Supply panel.**

  * Rectifier: tube (sags under load) or solid state (tight).
  * Hum: 50 or 60 Hz, default off.
  * Warm-up: off, quick (about 10 s) or real (about 45 s). This echoes the lava lamp's cold start. Default off **(decision 6)**, so the first key press always sounds.
* **Magic eye.** A tuning indicator in Theremin mode (how close you are to the nearest note). Otherwise it is a level eye that closes as the output reaches full scale.
* **Interaction.** Click any tube to open the full Tube view, with the same looks and controls as /otr. As a later extra, tapping a tube makes it ring, the way a real 12AX7 is microphonic.

## Panel layout

### Desktop (1280 and wider)

```
 ┌ FILAMENT ─── ‹ Wide Novachord Strings › \[save] \[share] \[🎲] ─────── Tip the developer ┐
 │ ═════════════ TUBE CHASSIS (tubes, magic eye, VU pair, optional lava lamp) ═════════ │
 ├──────────────┬──────────────┬──────────────────────┬─────────────┬──────────────────┤
 │ OSC 1        │ OSC 2        │ FILTER A   FILTER B   │ ENVELOPES   │ STEREO           │
 │ wave oct det │ wave sync FM │ model cut res drive   │ amp filt mod│ unison spread    │
 │ SUB / NOISE  │ MIXER + V1   │ \[ response plot ]     │ LFO 1 / 2   │ pan mode, offset │
 │              │ drive bias   │ routing: ser par split│             │ goniometer, corr │
 ├──────────────┴──────────────┴──────────────────────┴─────────────┴──────────────────┤
 │ RACK ▸ Ensemble · Tape echo · Spring · EQ · Output tubes · Speaker · Room · Width     │
 ├─────────────────────────────────────────────────────────────────────────────────────┤
 │ \[pitch]\[mod]  ▓▓ ▓ ▓▓ ▓▓ ▓ ▓▓ ▓ ▓▓ ▓▓ ▓ ▓▓   oct − +  hold  arp  seq  mono-check    │
 └─────────────────────────────────────────────────────────────────────────────────────┘
```

* The rack row works like /otr: modules are collapsed to a lit title strip until opened, and touching a bypassed module's control switches it on.
* The mod matrix is a drawer that opens over the panel.

### Phone (390 wide)

* A small tube strip at the top: four tubes and one meter.
* One section shown at a time, chosen from a segmented control: Play, Osc, Filter, Mod, Stereo, Rack.
* A keyboard pinned to the bottom: one and a half octaves, scrollable, with octave buttons. Velocity comes from where you touch the key (lower is louder). Pitch and mod are vertical strips beside the keys.
* Everything reachable with a thumb, with touch targets of 44 px or more.

### Look

* **House style.** It matches DXEdge: the dark theme, the amber accent and the same fonts.
* **Panel finish.** Walnut end cheeks, brushed aluminium, Bakelite knobs with amber pointer lines, and amber pilot lamps on each module's power switch.
* **Faces.** Skins, like the pop-out radio's faces:

  * Walnut (default)
  * Studio rack black
  * Black light, which pairs with the Black light tube look

## Playing it

|Input|Detail|
|-|-|
|On screen keyboard|Multi-touch, velocity by touch height, slide between keys for glide in mono modes|
|Computer keyboard|A W S E D F T G Y H U J K maps to the white and black keys of one octave. Z and X shift the octave, C and V set velocity, space is the sustain pedal. Disabled while a text field has focus.|
|MIDI keyboard|**In phase 0.1 (decision 7: James is buying one).** Web MIDI in Chrome, Edge and Firefox, which all ask permission first. Safari does not support Web MIDI (the [WebKit request](https://bugs.webkit.org/show_bug.cgi?id=107250) has been open since 2013), so iPhone and Mac Safari users get the on screen and computer keyboards. Handles notes, velocity, pitch bend, mod wheel (CC1), sustain (CC64), channel aftertouch, and MIDI learn on any knob. Any class compliant USB keyboard works with no driver. On Windows, legacy MIDI gives one program exclusive use of a device, so a DAW that is open may keep the browser from seeing the keyboard; close it or pick the device in the browser first.|
|Arpeggiator|Up, down, up-down, random and as played. 1 to 4 octaves, tempo 40 to 240 BPM, gate length, swing, latch.|
|Step sequencer (phase 3)|16 steps with note, gate, accent, slide and tie. Drawn as a punched paper roll moving past a reader, a nod to the 1957 RCA Mark II, the tube-era synthesizer that read its music from punched paper ([Wikipedia](https://en.wikipedia.org/wiki/RCA_Mark_II_Sound_Synthesizer)).|
|Theremin mode (phase 3)|A pad where across is pitch and up is volume, with the magic eye showing tuning. The theremin is the original tube instrument, and on a phone this may be the most fun way in.|

## MIDI keyboard shortlist

James does not have a MIDI keyboard yet and wants a small one (13 Oct 2026). What Filament needs from it: class compliant USB (no driver), velocity, pitch bend and mod controls, a sustain pedal input, and ideally channel aftertouch, because aftertouch is a mod matrix source and will otherwise never be exercised. Knobs are useful for testing MIDI learn. 37 keys is the smallest count that plays a pad with two hands; 25 is two octaves.

Prices are US street as of 13 Oct 2026 and will move.

|Model|Price|Keys|Pitch and mod|Key aftertouch|Controls|MIDI out|Notes|
|-|-|-|-|-|-|-|-|
|Akai MPK Mini IV|$99|25 mini|Real wheels (replaced the MK3 joystick)|No (pads only)|8 knobs, 8 MPC pads, colour screen|5-pin DIN and USB-C|Cheapest; backordered at Sweetwater to about 19 Oct|
|Arturia MiniLab 3|$119|25 slim|Capacitive touch strips|No|8 encoders, 4 faders, 8 pads, small display|5-pin DIN and USB-C|1/4 inch pedal input|
|Novation Launchkey Mini 37 MK4|$160 (25 key about $119)|37 mini|Touch strips|No (pads have poly aftertouch)|8 encoders, 16 pads, OLED|3.5 mm jack|1/4 inch sustain input; special order at Adorama to about 26 Oct|
|Arturia KeyStep 37 mk2|$199|37 slim, velocity and aftertouch|Capacitive touch strips|**Yes**|4 encoders, no pads; arpeggiator and step sequencer, 4 CV outs|5-pin DIN and USB-C|Pedal input; the only one here that sends aftertouch from the keys|

Recommendation: the KeyStep 37 mk2 if the point is to exercise everything the synth responds to (37 keys, aftertouch, a real sequencer to drive it hands free while tuning filters). The MPK Mini IV if the point is cheap and compact with real wheels and eight knobs for MIDI learn. Either is fine for v0.1.

Chosen: (pending James)

## Patches

* **Factory patches.** 12 in v0.1, growing to about 40, sorted into Bass, Lead, Pad, Keys, Pluck and FX. Starting list:

  * Plate Bass
  * Diode Squelch
  * Cellar Sub
  * Filament Lead
  * Screaming 12AX7
  * Wide Novachord Strings
  * Black Light Pad
  * Bakelite Organ
  * Hollow Pluck (low pass gate)
  * Magic Eye Sweep
  * Shortwave Drift (heterodyne whistles and fading noise, a nod to the radio side of DXEdge)
  * CW Practice Tone (570 Hz)
* **User patches.** Saved in localStorage on this device. Rename, delete, A/B compare.
* **Share by link.** `?p=` carries a compact encoded patch, so a link is the patch, with no server involved. This is the same idea as the /otr station share links.
* **Export and import.** As a JSON file. The schema is versioned (`v:1`) so old links keep working.
* **Surprise me.** Random patches inside musical limits: always in tune, never silent, never louder than the limiter allows.
* **Record.** A record button captures the output to a WAV file (capped at 10 minutes) for download.

## Engineering notes

* **AudioWorklet engine.**

  * One AudioWorkletProcessor runs every voice. That keeps the node count flat and lets the filters run with saturation inside the loop, which plain BiquadFilter and WaveShaper nodes cannot do.
  * Supported in every current browser (Safari since 14.1).
  * The main thread sends parameter changes over the port. The worklet smooths every parameter, so nothing zips or clicks.
* **Device interface (see "Where this is going").** The synth exposes one parameter table (id, name, range, default, unit), one MIDI input, one stereo output and one patch object. The page talks to it only through that table. This is what lets a second device join later.
* **Filters.**

  * Zero-delay feedback (topology preserving transform) designs.
  * A cheap tanh approximation per stage.
  * Feedback solved with one Newton step.
  * 2x oversampling around the nonlinear parts, with a half band decimator.
* **Valve 12 specifics.**

  * The feedback path calls the same `g(u)` tube function as the rack.
  * Each tube's `hp` value becomes the coupling capacitor highpass in the loop.
  * An envelope follower on the feedback level lowers the loop gain to model supply sag.
* **Oscillators.** PolyBLEP saw and pulse, a leaky integrator for the triangle, and the noise generator.
* **Denormals.** Flushed with a tiny DC offset.
* **CPU budget.** A render block is 128 frames, about 2.7 ms at 48 kHz.

  * Target: 8 voices with no unison under 40% of a block on a mid range phone.
  * An on screen CPU lamp turns amber at 60%.
  * Voice stealing takes the oldest released voice first, then the quietest.
  * If plain JavaScript misses the budget, the fallback is compiling the voice loop to WebAssembly. That is a contingency, not the plan.
* **Latency.** Request `latencyHint: 'interactive'` and show the measured output latency in Settings.
* **Visual cost.**

  * The chassis and meters redraw at most 30 times a second and stop when the tab is hidden.
  * With reduced motion set, the glow follows the level without flicker.
* **Test hook.** `window.\_\_synth`, like `\_\_otr` and `\_\_dx`, exposes note on and off, patch get and set, and offline render for tests.

## Accessibility and privacy

* Every knob is a labelled slider for screen readers with a spoken value, and is fully keyboard operable.
* Colour is never the only signal. Meters have numbers on hover or focus.
* No cookies. Patches and settings live only in this browser. The anonymous `/lib/stat.js` beacon counts visits the same way as the rest of the site. MIDI access is asked for only when you press "Connect MIDI".

## Testing (same pattern as the /otr suites)

`scripts/test\_synth.py` uses Playwright plus OfflineAudioContext renders, measured rather than listened to:

1. **Self oscillation tracks pitch.** At 100% key tracking, the self oscillation frequency is within plus or minus 5 cents across 4 octaves, for each model that oscillates.
2. **Cutoff accuracy.** At zero resonance, the cutoff is within 3% of the set frequency for the linear models.
3. **Valve 12.** Swapping the loop tube changes the harmonic profile of the resonance in the expected direction: the 2nd harmonic leads for triodes, the 3rd for the power tubes.
4. **Push-pull.** Even harmonics are at least 20 dB lower than in single ended at the same drive.
5. **Fuzz.** 30 seconds of random parameter changes at audio rate produce no NaN, no Infinity and no output above 0 dBFS after the limiter.
6. **No clicks.** On note on, note off, voice stealing and patch changes, the peak sample to sample step stays below a set bound.
7. **Mono fold.** For every factory patch, the mono level is within 3 dB of the stereo level.
8. **Aliasing baseline.** A saw at 4 kHz is measured and recorded as a baseline, and any regression fails.
9. **CPU.** Time per render block at 8 voices is logged by headless Chrome and must stay under the budget.
10. **Layout.** No horizontal scroll at 375 px. The keyboard and chassis are visible above the fold on a phone, and there are no page errors.
11. **No regression in /otr.** All 14 /otr suites pass unchanged (trivially so under decision 5, since /otr is not edited).
12. **MIDI.** Synthetic Web MIDI messages through `window.\_\_synth` (note on and off, pitch bend, CC1, CC64, channel aftertouch) produce the expected pitch, level and modulation changes in an offline render.
13. **Dekatron.** Each drum voice renders through its AudioWorklet and is non-silent, finite, and at or under 0 dBFS. The internal clock, swing, pattern length, accents and an external tick land within 5 ms. The rail, the step grid and the phone layout are driven in the browser.

## Roadmap

|Phase|Ships|Done when|
|-|-|-|
|**0. Groundwork**|Copy the rack, tube painter and knob into `/synth/` (decision 5). Scaffold `/synth/` with the nginx carve-out, the `sw.js` entry, `Synth.jsx` and the tab.|/otr unchanged (14 suites pass). /synth loads a blank chassis.|
|**0.1 First sound**|Worklet engine: 2 oscillators, sub and noise, V1 drive. Filters: Valve 12 and Ladder 24. Amp and filter envelopes, LFO 1, 8 voice poly, on screen and computer keyboard. **Web MIDI (notes, velocity, pitch bend, mod wheel, sustain, aftertouch) with MIDI learn (decision 7).** Output tube pair, speaker, room, width, limiter. Chassis with 4 lit tubes and the VU pair. 12 patches.|You can open it on a phone and play a pad that sounds good in 5 seconds, and play it from the new keyboard on the PC. Tests 1 to 7 and 12 pass.|
|**0.2 Character**|Diode 18, Sallen-Key 12, Poly 24, state variable, low pass gate. Dual filter routing including split. Mod matrix, LFO 2, unison, all stereo controls, ensemble, tape echo, spring, response plot, goniometer and correlation. Arpeggiator.|Every model self-oscillates where it should. Mono fold passes for all patches.|
|**0.3 Delight**|1939 mode, punched paper sequencer, Theremin mode, share links, WAV recording, the Tube view, faces, lava lamp module, Surprise me, about 40 patches.|Share link round trip test passes.|
|**Later**|MPE, microtuning, a WebAssembly engine if needed, the vanity domain, microphonic tube taps. Then the road to the rack: host clock and transport, patterns, mixer (each with its own brief). The second device and cables arrived early with Cathode (decision 9). Dekatron, the drum machine, arrived 14 Oct as its own worklet behind `drumDevice`.|When there is a reason|

## Decisions

Answered by James on 13 Oct 2026 in the v0.1 table, recorded here.

|#|Decision|Answer|
|-|-|-|
|1|Name|**Filament**|
|2|Path|`/synth/`|
|3|Where the link sits on DXEdge|Standalone page. A main-page tab next to OTR is assumed as well unless James says otherwise.|
|4|Support link|Same Ko-fi page as OTR (https://ko-fi.com/oldtimeradio)|
|5|Share /otr code through `/lib/` or copy it|**Copy it.** Two copies, drift accepted, header comments record the source commit.|
|6|Warm-up default|Off. Quick and real warm-up available as options.|
|7|MIDI keyboard|James is buying a small one, so Web MIDI moves into 0.1. Shortlist above; model not yet chosen.|
|8|Vanity domain|Later|
|9|An MS-20 style synth (asked 13 Oct)|**Cathode**: an original mono semi-modular, not a copy of Korg's product. Second device in the rack at /synth/, sharing the keyboard, MIDI, meters and output tubes. Patch panel with cables. External audio input not chosen.|
|10|Other projects' code (13 Oct; this may become a commercial product)|**Reference only** unless the license is permissive: read them for ideas, write our own code. Rules, the register of approved and reference-only resources, and notes on our own rights are in `docs/filament-licensing.md`.|

Still open: which keyboard (see shortlist); a commercial product name, since a music plugin called filament (Forma Labs Audio) shipped in June 2026 (see `docs/filament-licensing.md`); whether the repo stays public and gets a LICENSE before any sale. Decision 3 resolved on 13 Oct: the tab went live with the first push.

## Automation

* **Nightly build and bug check**, 11:52 PM Pacific, a scheduled task created 13 Oct 2026 (James chose "nightly build and bug check as the priority" and "live with tab now"). Each run: run the suite and check the live page; fix anything broken first; otherwise build the next unchecked 0.2 item from `docs/filament.md`, add tests for it, and push to main only on ALL PASS. One item per night. It logs what it did in `docs/filament.md` and sends a push and email summary.
* The existing 9 PM DXEdge health check is separate and unchanged.

## Notes for the build session

* **Repo and deploy.** github.com/sagejw-svg/dxedge, branch main. Deploy is GitHub Actions on push. Every frontend change needs a `CACHE\_NAME` bump in `frontend/public/sw.js`.
* **Concurrent pushes.** Other sessions push to main too: fetch, rebase if origin moved, and re-bump the cache name past whatever landed.
* **Commit identity.** Commit as `Claude <noreply@anthropic.com>`, unsigned.
* **Start here.** Read the Notion START HERE page first: https://app.notion.com/p/3de9a5a18b8481e5828ad07d24114e1b Credentials live in the Mem note "DXEdge - GitHub \& Credentials". Never paste the token into a command line.
* **Front end rules.** Standalone pages are self contained HTML with inline CSS and JS. React shells are thin iframes. `index.css` holds tokens only.
* **Shared code.** Under decision 5 the synth carries its own copies of the /otr tube code. Everything else still imports from `/lib/` (`lib/propagation.js` for the ionosphere, `/morse/core.js` for CW, `/lib/stat.js` for the beacon).
* **Verifying.** Check by measurement (OfflineAudioContext renders and headless Playwright), then confirm on the live site by polling `sw.js` and comparing the live page with the repo copy.
