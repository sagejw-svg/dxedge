# Hexode: what changed from dx7-synth-js

Pinned at `f269f0e02fc67b2f824b01a8416339cd5c4829e0` (2025-05-18).
License: MIT, `LICENSE.txt`. The `package.json` in that commit says `"license": "ISC"`; the license file is the grant this copy follows.

The page is a light reskin (near-black ground, amber type, the site mono stack) of the upstream panel. The name on the page is Hexode. Web MIDI input and 32-voice `.syx` loading are kept.

## Not included

- `roms/ROM1A.SYX`. Header `F0 43 00 09 20 00`, 4104 bytes, 32 voices named BRASS 1, STRINGS 1, E.PIANO 1, and the rest of that factory set. The upstream page fetched this file and selected voice 11. No license for the bank is in the repo, so it is not here. The page opens on the single "Init" voice in `src/default-presets.js`, which is part of the MIT source. A file input reads a 32-voice `.syx` the player supplies.
- `midi/*.mid` (rachmaninoff-op39-no6, minute_waltz, bluebossa, cantaloup, chameleon, tunisia, sowhat, got-a-match, hip). Named for particular works, no separate license. The song-file player is not wired up.
- `impulses/church-saint-laurentius.wav`. A recorded room with no stated origin. `setupAudioGraph` builds a short decaying-noise tail instead. `src/reverb.js` (CC0) stays in the tree and is not called.
- Fonts `digital-7` and `5x8_lcd_hd44780u_a02` (the SVG says "Copyright vader381 2010" and names a FontStruct face). No grant in the repo.
- `images/dx7-logo.png`, `images/yamaha-dx-7.png`, `images/13460FD783A2087D.png` (a logo image), and `algorithms.png`.

## Code edits

- `src/app.js`: no cartridge fetch, no song-file player, generated reverb tail, `.syx` file input, test hook `window.__hexode`.
- `src/visualizer.js`: defines `global` for the browser bundle.
- `synth.css`: the `@font-face` rules and the logo image are gone.
- `index.html`, `skin.css`: the DXEdge frame and the name Hexode.

## How bundle.js was built

From the patched `src/`, with esbuild 0.25.0 (`--format=iife --platform=browser`), a `var global = window` banner, and `pixi.js` aliased to `node_modules/pixi.js/bin/pixi.min.js`. Runtime packages resolved: angular 1.4.14, lodash 4.17.21, ngstorage 0.3.11, pixi.js 3.0.11, mml-emitter at `edd40ecf42141ca257c6cd8adc5073d570add1ee`. Not bundled, because nothing requires them anymore: axios, midifile, midiplayer.
