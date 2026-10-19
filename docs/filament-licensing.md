# Filament: licensing rules and the resource register

Filament (with Cathode and the devices that follow) may become a commercial product. This file
keeps our rights clean while we borrow every idea we can. Everyone building it follows these rules,
the nightly build task included. Decided by James on 13 Oct 2026: other projects are **reference
only** unless their license is permissive; we read them for ideas and write our own code.

Licenses below were checked on 13 Oct 2026 against each project's own page (links in the tables).
Check again before shipping anything that depends on one: licenses change. None of this is legal
advice; have an IP attorney review before a commercial launch.

## The rules

1. **Write our own code.** Ideas, algorithms, architecture and techniques are free to learn from
   any source. Code is not.
2. **Never copy or line-by-line translate code** from GPL, AGPL, LGPL, MPL or CC BY-SA sources,
   from Stack Overflow answers (CC BY-SA), or from anything with no license at all (no license
   means all rights reserved). The reference-only list below names the big ones.
3. **Reference-only practice.** When an idea comes from a reference-only project, write it down in
   our own words (a design note or a code comment such as "approach after openDAW's timeline
   model"), then write the code from the note, not from their file. Never paste their code into
   our files, a scratch file, or a prompt that writes our code.
4. **Permissive code may be used** (MIT, BSD, Apache-2.0, ISC, zlib, MIT-style STK-4.3, public
   domain), ported or bundled, on three conditions: it has a row in the register below before it
   lands; the ported file's header names the source, its commit or version, and its license; and
   its notice goes into `THIRD_PARTY_NOTICES.md` at the repo root (create it with the first entry).
   Apache-2.0 also asks us to keep its NOTICE file text and to mark files we changed.
5. **Content** (samples, waveforms, impulse responses, SoundFonts) ships only if it is CC0,
   public domain, MIT, or carries an explicit right to redistribute it inside a product. CC BY is
   allowed with the attribution recorded. Never CC BY-NC, never "royalty-free for use in your
   music" packs (those normally forbid redistributing the sounds themselves), never anything
   ripped from another instrument. Synthesizing our own (drums, impulse responses, waveforms) is
   always the safe default.
6. **Names and looks.** No other company's product names or trademarks in device names, patch
   names, the UI or marketing: Korg, MS-20, Reason, Rack Extension, Combinator, Mutable
   Instruments and its module names (Plaits, Rings, Clouds...), Moog, Roland, and so on. Comparing
   in our private notes is fine. Do not copy another product's panel layout or styling.
7. **No new dependency without a register row.** Name, link, license, what we use it for, where
   it lives, date checked.

## Register: approved (permissive, checked 13 Oct 2026)

| Resource | License | What it gives us | How we would use it |
|-|-|-|-|
| [DaisySP](https://github.com/electro-smith/DaisySP) | MIT | Envelopes, analog-style kick, snare and hi-hat models, Karplus-Strong, modal and resonator synthesis, granular player, phaser, wavefolder, overdrive, limiter, noise sources | Port specific modules to JS for the drum machine and effects. **Not** its `DaisySP-LGPL` folder. |
| [Mutable Instruments eurorack](https://github.com/pichenettes/eurorack) | MIT for the STM32 modules (AVR projects are GPL-3.0; hardware CC BY-SA 3.0) | Some of the best open synth DSP there is: macro oscillators, resonators, granular textures | Port STM32-module code only, after checking each file's header. Their page: "Mutable Instruments is a registered trademark"; never use that name, and rename anything derived from a module. |
| [Airwindows](https://github.com/airwindows/airwindows) | MIT | The full open source code of a large collection of small audio effect plugins (the repo page gives no count) | Port individual effects for the rack's effect devices; check each one does what we need first. |
| [STK, Synthesis ToolKit](https://github.com/thestk/stk) | MIT-style (keep the copyright and permission notice) | Physical models: plucked and bowed strings, winds, modal bars, classic FM instruments | Port instrument models for a physical modeling device. |
| [Freeverb](https://ccrma.stanford.edu/~jos/pasp/Freeverb.html) | Public domain (Jezar at Dreampoint) | The classic Schroeder-Moorer reverb | A plain reverb device or a building block. |
| [signalsmith-stretch](https://github.com/Signalsmith-Audio/signalsmith-stretch) | MIT, ships a WASM/AudioWorklet build | Pitch shifting and time stretching (best between about 0.75x and 1.5x) | The sampler's stretch and repitch. Saves weeks. |
| [Elementary Audio](https://github.com/elemaudio/elementary) | MIT | A functional JS audio engine with a web renderer | Reference for graph design; an option for future devices. Not planned as our engine. |
| [Tone.js](https://github.com/Tonejs/Tone.js) | MIT | Transport, scheduling, synths, effects | Reference for the transport and scheduling design; we keep our own sample-accurate worklet clock. |
| [Web Audio Modules 2.0 API](https://github.com/webaudiomodules/api) | MIT (`@webaudiomodules/api`, package.json) | An open plugin standard for the web: parameters, automation, MIDI events, GUI, host groups | 14 Oct 2026: the rack device contract (`device.js`) follows the published ideas (descriptor, parameter info, MIDI, transport) and is our own code. The package was not copied, so there is no notice entry. Each WAM plugin still has its own license before we would host one. |
| [@tonejs/midi](https://github.com/Tonejs/Midi) 2.0.28 | MIT. Copyright (c) 2016 Yotam Mann. Checked 14 Oct 2026 | Read and write MIDI files | Bundled at `frontend/public/synth/vendor/tonejs-midi.js` and used by the song library (`midisong.js`, `player.js`). The MIDI deck still uses our own `smf.js` and does not import this package. Notice in `THIRD_PARTY_NOTICES.md`. |
| [midi-file](https://github.com/carter-thaxton/midi-file) 1.2.4 | MIT. Copyright (c) 2016 Carter Thaxton. Checked 14 Oct 2026 | Low-level MIDI file parser, a dependency of @tonejs/midi | Inside the same bundle. Not imported on its own. Notice in `THIRD_PARTY_NOTICES.md`. |
| [array-flatten](https://github.com/blakeembrey/array-flatten) 3.0.0 | MIT. Copyright (c) 2014 Blake Embrey. Checked 14 Oct 2026 | Flatten nested arrays, a dependency of @tonejs/midi | Inside the same bundle. Notice in `THIRD_PARTY_NOTICES.md`. |
| [webaudio-pianoroll](https://github.com/g200kg/webaudio-pianoroll) | Apache-2.0 | A piano roll editor component | Starting point or reference for the piano roll. |
| [Yjs](https://github.com/yjs/yjs) | MIT | CRDT shared data types | Multiplayer and shared projects, much later. |
| [AKWF waveforms](https://www.adventurekid.se/akrt/waveforms/adventure-kid-waveforms/) | CC0 1.0 | A large set of single-cycle waveforms (the author's page gives no count) | Wavetables for a wavetable device. |
| [FluidR3_GM SoundFont](https://github.com/educandu/abcjs-soundfonts) | MIT (per that repository's notes; confirm at the original source before shipping) | A General MIDI instrument set | Default sounds for imported MIDI files and a GM fallback. |
| Salamander Grand Piano | Public domain now (originally CC BY 3.0), per the same repository; confirm at source | A sampled grand piano | A piano preset for the sampler. |

## Register: desktop app (added 15 Oct 2026 by the nightly check, after the fact)

`desktop/` (commit `6e178d4`) added these two dev dependencies without a row, against rule 7. License fields below are from `desktop/package-lock.json`; the projects' own pages were not re-checked from this environment. Neither is imported by the website.

| Resource | License | What it gives us | Where it lives |
|-|-|-|-|
| [Electron](https://github.com/electron/electron) 44.7.2 | MIT (package-lock). The runtime it ships bundles Chromium and other third-party code under their own licenses | The Windows app shell: Chromium for worklets, Web MIDI and the microphone | `desktop/package.json` devDependency; redistributed inside the installer. Before the first public release, confirm the installer carries Electron's license and Chromium's third-party license file, and add an Electron entry to `THIRD_PARTY_NOTICES.md`. |
| [electron-builder](https://github.com/electron-userland/electron-builder) 26.15.3 | MIT (package-lock) | Builds the NSIS installer | Build tool only, run by `.github/workflows/desktop-release.yml`; not shipped in the app. |

## Register: vendored devices (checked 14 Oct 2026)

These two are in the tree, pinned, and linked from `/synth/` and the Synth tab. Notices are in `THIRD_PARTY_NOTICES.md`. Each page names what was left out.

| Resource | Commit | License | Notices | What shipped |
|-|-|-|-|-|
| [dx7-synth-js](https://github.com/mmontag/dx7-synth-js) by Matt Montag | `f269f0e02fc67b2f824b01a8416339cd5c4829e0` (2025-05-18) | MIT, from `LICENSE.txt` in that commit. `package.json` in the same commit says ISC; the license file is the grant we follow | `frontend/public/synth/fm/LICENSE.txt`, `UPSTREAM-README.md`, `PIN`, `CHANGES.md`, and `THIRD_PARTY_NOTICES.md` | Hexode at `/synth/fm/`. Six-operator FM, Web MIDI in, and 32-voice `.syx` loading. The page starts on the single "Init" voice from `default-presets.js`. |
| [acid-banger](https://github.com/vitling/acid-banger) by David Whiting (Vitling) | `bb93d972d9c656fe0acc861c94a492b56634d5e7` (2021-05-28) | CC BY 4.0. The repo has no LICENSE file; the README and the source headers are the grant. Attribution is on the page | `frontend/public/synth/acid/LICENSE.txt` (the CC BY 4.0 legal code), `UPSTREAM-README.md`, `PIN`, `CHANGES.md`, and the credit on the page | Anode at `/synth/acid/`. Static JS compiled from the TypeScript. Visible credit: Vitling (David Whiting), the work's title, the license, and a note that this copy changed the drums and the skin. |

Left out of Hexode, because the repo does not show a right to redistribute them:

- `roms/ROM1A.SYX`. A 32-voice bulk dump (`F0 43 00 09 20 00`) whose names are the familiar factory set, and the page selected voice 11 of that set. Not included. A player loads their own `.syx`.
- `midi/*.mid`. Files named for particular compositions, with no license of their own. The song-file player is not wired up. Web MIDI input stays.
- `impulses/church-saint-laurentius.wav`. A recorded room, origin and license not stated. The reverb is a short noise tail generated in the page.
- The two bundled fonts (Digital-7, and the 5x8 LCD face marked "Copyright vader381 2010"). No grant in the repo. The page uses the site's mono stack.
- Product photographs and logo images. Not used. The device's name on the page is Hexode.

Left out of Anode: `909BD.mp3`, `909SD.mp3`, `909CH.mp3`, `909OH.mp3`. The project license is CC BY 4.0, but nothing in the repo says those recordings are the author's to license, and the names point at a drum machine. The kit is synthesized in `audio.ts`. The page does not say 303 or 909.

Bundled into `frontend/public/synth/fm/bundle.js` with the FM engine (each is MIT):

| Library | Version we resolved | Role |
|-|-|-|
| [AngularJS](https://github.com/angular/angular.js) | 1.4.14 | The panel |
| [lodash](https://github.com/lodash/lodash) | 4.17.21 | `throttle` on the knobs |
| [ngstorage](https://github.com/gsklee/ngStorage) | 0.3.11 | Saved voices in this browser |
| [mml-emitter](https://github.com/mohayonao/mml-emitter) | commit `edd40ecf42141ca257c6cd8adc5073d570add1ee` (the pin in dx7-synth-js's package.json) | The two demo tunes |
| [pixi.js](https://github.com/pixijs/pixi.js) | 3.0.11, browser build `bin/pixi.min.js` | The little waveform view |

`src/reverb.js` is the upstream helper (CC0, [Reverb.js](https://github.com/andigamesandmusic/Reverb.js) COPYING.md). The page does not call it.

## Bundled MIDI library (content, checked 14 Oct 2026)

Every file under `frontend/public/synth/midi/` was sequenced in `scripts/build_midi_library.mjs` for this project. None was copied from another MIDI file. The MIDI data is dedicated to the public domain under CC0 1.0. A composition is included only when the composition itself is public domain (published 1930 or earlier, or a traditional tune), or when the tune is original to this project. `catalog.json` repeats the source line next to each file. Halloween songs also name a Filament factory preset and a Cathode factory preset; those presets are original patch data in `patches.js` and `cathode.js`, not samples. Mountain King, Cellar Stairs and Porch Ghost also name a Dekatron factory pattern (Lantern or Bones) in `drums.js`, and those three files include a channel-10 closed-hat part. The hat notes are original sequence data, the same as the rest of the file.

| File | Composition | MIDI data |
|-|-|-|
| `beethoven-symphony-5-mvt1.mid` | Public domain. Beethoven, Symphony No. 5, Op. 67, movement 1 (1808). Opening only | CC0 sequence, 14 Oct 2026 |
| `bach-toccata-fugue-dm.mid` | Public domain. Bach, Toccata and Fugue in D minor, BWV 565. Opening toccata | CC0 sequence, 14 Oct 2026 |
| `joplin-maple-leaf-rag.mid` | Public domain. Joplin, Maple Leaf Rag (1899). A strain, short reduction | CC0 sequence, 14 Oct 2026 |
| `joplin-the-entertainer.mid` | Public domain. Joplin, The Entertainer (1902). The famous strain | CC0 sequence, 14 Oct 2026 |
| `sousa-stars-and-stripes.mid` | Public domain. Sousa, The Stars and Stripes Forever (1897). Trio theme. The descant is original to this file, not a copied obbligato | CC0 sequence, 14 Oct 2026 |
| `traditional-greensleeves.mid` | Public domain. Traditional English tune, 16th century | CC0 sequence, 14 Oct 2026 |
| `foster-oh-susanna.mid` | Public domain. Stephen Foster, Oh! Susanna (1848) | CC0 sequence, 14 Oct 2026 |
| `handy-st-louis-blues.mid` | Public domain. W. C. Handy, St. Louis Blues (1914). Chorus only | CC0 sequence, 14 Oct 2026 |
| `traditional-frankie-and-johnny.mid` | Public domain. Traditional American ballad | CC0 sequence, 14 Oct 2026 |
| `dx-pixel-march.mid` | Original chiptune march, DX Edge, 2026 | CC0, original |
| `dx-neon-alley.mid` | Original synth-pop tune, DX Edge, 2026 | CC0, original |
| `dx-dock-lamp.mid` | Original short chiptune, DX Edge, 2026 | CC0, original |
| `bach-toccata-spooky.mid` | Public domain. Bach, BWV 565, a separate slow organ reduction for the Halloween pack | CC0 sequence, 14 Oct 2026. Presets: Haunted Organ, Chapel Organ |
| `grieg-mountain-king.mid` | Public domain. Grieg, Peer Gynt, "In the Hall of the Mountain King" (1875). Opening theme | CC0 sequence, 14 Oct 2026. Presets: Horror Pad, Cellar Drone, Lantern. Channel 10 is a closed hat |
| `saint-saens-danse-macabre.mid` | Public domain. Saint-Saëns, Danse macabre, Op. 40 (1874). Tritone and a short waltz | CC0 sequence, 14 Oct 2026. Presets: Eerie Bells, Bell Jar |
| `mussorgsky-bald-mountain.mid` | Public domain. Mussorgsky, Night on Bald Mountain (1867); the concert shape associated with Rimsky-Korsakov's 1886 arrangement is also public domain. Short opening reduction | CC0 sequence, 14 Oct 2026. Presets: Creaky Drone, Creak Pulse |
| `chopin-funeral-march.mid` | Public domain. Chopin, Piano Sonata No. 2, Op. 35, movement 3 (1839). Bb minor theme | CC0 sequence, 14 Oct 2026. Presets: Haunted Organ, Heartbeat |
| `traditional-dies-irae.mid` | Public domain. Dies irae, 13th-century sequence, set in a steady 4/4 | CC0 sequence, 14 Oct 2026. Presets: Ghost Choir, Choir Breath |
| `dx-lantern-walk.mid` | Original spooky music-box tune, DX Edge, 2026 | CC0, original. Presets: Glass Music Box, Heartbeat |
| `dx-cellar-stairs.mid` | Original, DX Edge, 2026. A lub-dub under a chromatic descent | CC0, original. Presets: Sub Heartbeat, Creak Pulse, Bones. Channel 10 is a closed hat |
| `dx-porch-ghost.mid` | Original, DX Edge, 2026. A slow wail over a two-note pulse | CC0, original. Presets: Theremin Wail, Wail Glide, Lantern. Channel 10 is a closed hat |

Glass Tine is a Cathode Halloween preset with no bundled file pointing at it. It is still a factory patch.

## Use log

| Date | Resource | Where | What we did |
|-|-|-|-|
| 2026-10-14 | [Freeverb](https://ccrma.stanford.edu/~jos/pasp/Freeverb.html) (public domain, Jezar at Dreampoint, c. 2000) | `frontend/public/synth/master.worklet.js` | Original JavaScript for the published structure: eight damped combs into four allpasses per channel, and the published 44.1 kHz delay lengths, scaled with the sample rate. Not a copy or a line-by-line translation of the C++ sources. Notice in `THIRD_PARTY_NOTICES.md`. The delay and the bus compressor next to it are original; Airwindows was not used. |
| 2026-10-14 | Vital and Surge XT (reference only; see the copyleft table) | `frontend/public/synth/lattice-dsp.js`, `lattice-ui.js` | Ideas only: a wavetable position, warp, and a modulation matrix you drag. No source was copied or line-translated. Factory cycles are original additive waveforms generated in the repo. AKWF (CC0) was not vendored. |
| 2026-10-14 | [signalsmith-stretch](https://github.com/Signalsmith-Audio/signalsmith-stretch) (MIT) | not shipped | Considered for Mote's pitch. A grain's pitch is the read rate of a short window, so a time stretcher was not needed and the library was not imported. |
| 2026-10-14 | Original grain engine | `frontend/public/synth/mote-dsp.js`, `mote.worklet.js` | Written for this project from the description of a windowed buffer read. No granular-player source was copied or translated. The tail is a stereo delay plus a four-line mix with delays 23.0, 31.4, 37.8 and 47.2 ms. Those lengths are not the Freeverb set. |
| 2026-10-14 | Generated sources, CC0 | `frontend/public/synth/sources/glass.wav`, `air.wav`, `bell.wav` | Original audio from `scripts/build_mote_sources.py`, dedicated CC0 in `sources/README.md`. Not taken from a sample library. |
| 2026-10-14 | Julius O. Smith, [Schroeder reverberators](https://ccrma.stanford.edu/~jos/pasp/Schroeder_Reverberators.html) (published description) | `frontend/public/synth/heptode-dsp.js` | Original JavaScript for the published layout: parallel damped combs into series allpasses. Delay lengths are 19.7, 23.3, 27.1, 31.9 ms and 21.1, 25.7, 29.9, 34.3 ms, then allpasses at 5.7, 8.3, 6.4 and 9.1 ms. Not the Freeverb tuning and not a translation of that code. |
| 2026-10-14 | webaudio-pianoroll (Apache-2.0) | not shipped | Considered for Heptode's piano roll. The roll is a canvas bitmap, so the library was not imported. |
| 2026-10-14 | Heptode MIDI library, CC0 | `frontend/public/synth/heptode/midi/` | Sequenced in `scripts/build_heptode_library.mjs`. No MIDI file was copied. Glass Arcade is an original tune and does not quote the 1984 film theme. |
| 2026-10-15 | Original meadow | `frontend/public/synth/geissler-world.js`, `geissler-dsp.js` | Written for this project. Four species, a seeded xorshift field, and original oscillators (drone, pluck, bass-plus-noise, chirp). No ecosystem or synth source was copied or line-translated. signalsmith-stretch, DaisySP and STK were not used. |
| 2026-10-15 | Pentagrid receiver, original | `frontend/public/synth/pentagrid.js`, `pentagrid-dsp.js`, `pentagrid.worklet.js`, `pentagrid-ui.js` | Written for this project. Noise, crackle, fading, heterodynes, formants, Morse, FSK, chimes, digit tones and time pips are synthesized here. No recording, numbers-station audio, or third-party DSP was copied or translated. Morse element timing is the published 1.2/WPM standard, not a copy of another implementation. |
| 2026-10-15 | Original spectral painter | `frontend/public/synth/orthicon-dsp.js`, `orthicon.worklet.js` | Written for this project. The scan is an overlap-add inverse transform (Hann window, hop a quarter of the window) and a bank of sines, one per log-frequency row. Phase for the coherent path advances by the partial's own frequency. No spectral-paint program was copied or line-translated, and none was imported. Pictures are generated in `pictureGrid`. |
| 2026-10-15 | Published maps (Lindenmayer systems, the quadratic map, the logistic map, the Lorenz equations, Thue-Morse parity) | `frontend/public/synth/trochotron-gen.js` | Original JavaScript for those published recurrences, and an original mapping from the numbers onto notes. No fractal-music program was imported. MusiNum was not used. |
| 2026-10-15 | Original circuit-bent toy | `frontend/public/synth/phantastron.js`, `phantastron-dsp.js`, `phantastron.worklet.js`, `phantastron-ui.js` | Written for this project. A clocked source-filter voice (impulse or sine, three resonators, a bit crusher, a sample-and-hold, a short feedback comb). Phrases are generated here. No speech ROM, no sample, and no copyleft synth was copied or line-translated. |

### Heptode MIDI library

| File | Composition | Sequence |
|-|-|-|
| `rimsky-korsakov-bumblebee.mid` | Public domain. Rimsky-Korsakov, Flight of the Bumblebee (1900). Chromatic semiquavers in A minor | CC0 sequence, 14 Oct 2026. Original reduction |
| `liszt-la-campanella.mid` | Public domain. Liszt, Grandes études de Paganini No. 3 (1851) | CC0 sequence, 14 Oct 2026. Original reduction: repeated high bells and a short line |
| `bach-fugue-gm.mid` | Public domain. Bach, Little Fugue in G minor, BWV 578 | CC0 sequence, 14 Oct 2026. Original voicing of the subject, the answer, and a third entry |
| `wagner-ride-valkyries.mid` | Public domain. Wagner, Ride of the Valkyries (1856) | CC0 sequence, 14 Oct 2026. Original reduction of the opening call in 9/8 |
| `liszt-hungarian-rhapsody-2.mid` | Public domain. Liszt, Hungarian Rhapsody No. 2 (1847) | CC0 sequence, 14 Oct 2026. Short excerpt. The file changes tempo |
| `dx-glass-arcade.mid` | Original, DX Edge, 2026. A 1980s-style multitrack in D major | CC0, original. Six channels, including a drum kit on channel 10. Not a quotation of any commercial recording |
| `black-density.mid` | Generated density test, DX Edge, 2026 | CC0. Sixteen channels, a tempo change, and more than 100,000 notes |

## Register: use with care (licenses vary inside the project)

| Resource | Why care | Rule |
|-|-|-|
| [Faust](https://faust.grame.fr) and its libraries | Mixed. The compiler is mostly GPL-2.0+ (a build tool; that does not bind our code). Library functions each declare their own license: many are MIT-style STK-4.3, some LGPL with a FAUST exception, some GPL (for example the Greyhole reverb, GPL-2.0+). | Only functions whose declared license is MIT-style STK-4.3 or another permissive one. Record each function used. |
| [Freesound](https://freesound.org/help/faq/) | Each sound carries CC0, CC BY, CC BY-NC or the old Sampling+ | CC0 only, or CC BY with the attribution recorded. Never CC BY-NC or Sampling+. |
| OpenAIR impulse responses | Mostly Creative Commons, license per recording | Per-file check; prefer impulse responses we generate ourselves. |
| WAM community plugins ([wam-community](https://github.com/boourns/wam-community)) | No license shown at the collection level | Check each plugin's own license before hosting or bundling it. |

## Reference only (copyleft or proprietary): read for ideas, never copy

| Project | License | Worth studying for |
|-|-|-|
| [openDAW](https://github.com/andremichelle/openDAW) | AGPL-3.0 or later, or a paid commercial license | Browser DAW architecture: timeline, mixer with sends, recording, device model, a Rust/WASM engine. Built by Audiotool's founder. |
| [VCV Rack](https://github.com/VCVRack/Rack) | GPL-3.0 | Module and cable UX, polyphonic cables, engine threading |
| [Surge XT](https://github.com/surge-synthesizer/surge) | GPL-3.0 | Oscillator and filter catalog, modulation UX |
| [Cmajor](https://github.com/cmajor-lang/cmajor) | GPL-3.0 or commercial | DSP language design; their page says C++ generated from your own Cmajor code is yours, but the engine needs a license |
| Audiotool | Proprietary; its [NEXUS SDK](https://github.com/audiotool/nexus) is Apache-2.0 but only scripts the Audiotool DAW | Product ideas, multiplayer, AI hooks (NEXUS uses MCP) |
| Stack Overflow answers | CC BY-SA (share-alike) | Explanations only; write the code ourselves |

Free knowledge with no code risk (books, papers, articles; learn the technique, write our own):
Zavalishin's *The Art of VA Filter Design* (our filters already use its zero-delay-feedback method),
Julius O. Smith's online books at CCRMA, the DAFX book, published papers on band-limited
oscillators and filter models.

## Our own rights (for the commercial decision)

Facts, checked 13 Oct 2026:
- The US Copyright Office's January 2025 report (Part 2, copyrightability) holds that human
  authorship is required, that prompts alone do not make someone an author, and that AI-assisted
  work is protected where a human selects, arranges or modifies it, case by case.
- *Thaler v. Perlmutter*: the D.C. Circuit held on 18 March 2025 that copyright requires a human
  author; the Supreme Court denied certiorari on 2 March 2026
  ([SCOTUSblog](https://www.scotusblog.com/cases/thaler-v-perlmutter/)).
- The dxedge repository is public and has no LICENSE file, so by default it is all rights reserved:
  anyone can read it, nobody may reuse it.
- A commercial music plugin named **filament** already exists: Forma Labs Audio, a real-time MIDI
  orchestration plugin and plugin host, v1.0 announced 30 June 2026, VST3, AU and standalone,
  GBP 149 ([rekkerd.org](https://rekkerd.org/forma-labs-audio-releases-filament-v1-0-real-time-orchestration-plugin/)).
  A quick search found no music product named Cathode; that is not a trademark search.

Inferences and recommendations (James decides; none are done):
- Code written mostly by Claude may carry thin copyright on its own. What protects the product is
  James's creative direction and selection (the decisions recorded in the design brief), the
  product name and brand (trademark), the curated factory content, the hosted service, and keeping
  the commercial core private if it diverges from the free site.
- Before selling: add a LICENSE ("All rights reserved", or a chosen license) and decide whether the
  repo stays public; run a proper trademark search; choose a product name that does not collide
  with Forma Labs' filament (the device can keep its name inside a differently named product,
  subject to that search); have an IP attorney review this file.

## Register: Hand Orchestra camera model (19 Oct 2026)

Hand Orchestra at `frontend/public/synth/hand-orchestra/` does not vendor MediaPipe. The page loads
[MediaPipe Tasks Vision](https://github.com/google-ai-edge/mediapipe) 0.10.21 and the Hand Landmarker
float16 model in the browser, from jsDelivr and Google storage, only after Use camera. Both are
Apache License 2.0. Camera frames are read locally and are not uploaded. The page names MediaPipe
and links the license. The gesture, chord and voice code in that folder is original.
