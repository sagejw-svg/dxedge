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
| [Airwindows](https://github.com/airwindows/airwindows) | MIT | Hundreds of small effects: console and tape saturation, reverbs, compressors, EQs | Port individual effects for the rack's effect devices. |
| [STK, Synthesis ToolKit](https://github.com/thestk/stk) | MIT-style (keep the copyright and permission notice) | Physical models: plucked and bowed strings, winds, modal bars, classic FM instruments | Port instrument models for a physical modeling device. |
| [Freeverb](https://ccrma.stanford.edu/~jos/pasp/Freeverb.html) | Public domain (Jezar at Dreampoint) | The classic Schroeder-Moorer reverb | A plain reverb device or a building block. |
| [signalsmith-stretch](https://github.com/Signalsmith-Audio/signalsmith-stretch) | MIT, ships a WASM/AudioWorklet build | Pitch shifting and time stretching (best between about 0.75x and 1.5x) | The sampler's stretch and repitch. Saves weeks. |
| [Elementary Audio](https://github.com/elemaudio/elementary) | MIT | A functional JS audio engine with a web renderer | Reference for graph design; an option for future devices. Not planned as our engine. |
| [Tone.js](https://github.com/Tonejs/Tone.js) | MIT | Transport, scheduling, synths, effects | Reference for the transport and scheduling design; we keep our own sample-accurate worklet clock. |
| [Web Audio Modules 2.0 API](https://github.com/webaudiomodules/api) | MIT (`@webaudiomodules/api`, package.json) | An open plugin standard for the web: parameters, automation, MIDI events, GUI, host groups | Strong candidate for our device contract, so the rack can host third-party WAM plugins and our devices could ship as WAMs. Each WAM plugin has its own license. |
| [@tonejs/midi](https://github.com/Tonejs/Midi) | MIT | Read and write MIDI files | Import and export .mid in the song sequencer. |
| [webaudio-pianoroll](https://github.com/g200kg/webaudio-pianoroll) | Apache-2.0 | A piano roll editor component | Starting point or reference for the piano roll. |
| [Yjs](https://github.com/yjs/yjs) | MIT | CRDT shared data types | Multiplayer and shared projects, much later. |
| [AKWF waveforms](https://www.adventurekid.se/akrt/waveforms/adventure-kid-waveforms/) | CC0 1.0 | Thousands of single-cycle waveforms | Wavetables for a wavetable device. |
| [FluidR3_GM SoundFont](https://github.com/educandu/abcjs-soundfonts) | MIT (per that repository's notes; confirm at the original source before shipping) | A General MIDI instrument set | Default sounds for imported MIDI files and a GM fallback. |
| Salamander Grand Piano | Public domain now (originally CC BY 3.0), per the same repository; confirm at source | A sampled grand piano | A piano preset for the sampler. |

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
