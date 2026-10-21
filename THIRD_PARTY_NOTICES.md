# Third-party notices

Filament may ship code and content from the projects below. The rules and the register are in `docs/filament-licensing.md`. This file is the notice those rules ask for.

## Hexode (`frontend/public/synth/fm/`)

dx7-synth-js, six-operator FM in the browser.
https://github.com/mmontag/dx7-synth-js
Commit `f269f0e02fc67b2f824b01a8416339cd5c4829e0`
Copyright (C) 2014 Matt Montag
MIT License. The full text is `frontend/public/synth/fm/LICENSE.txt`.
`package.json` in that commit says ISC. The license file is the grant this copy follows.

That license file also covers:

- midi.js by Chris Wilson, used with modifications, MIT. Copyright (c) 2014 Chris Wilson. https://github.com/cwilso/midi-synth
- mml-emitter.js by Nao Yonamine, MIT. Copyright (c) 2014 Nao Yonamine. https://github.com/mohayonao/mml-emitter

`bundle.js` also contains:

- AngularJS 1.4.14. Copyright (c) 2010-2016 Google, Inc. MIT. https://github.com/angular/angular.js
- lodash 4.17.21. Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors, and the JS Foundation. MIT. https://github.com/lodash/lodash
- ngStorage 0.3.11. Copyright (c) 2016 Gias Kay Lee. MIT. https://github.com/gsklee/ngStorage
- mml-emitter commit `edd40ecf42141ca257c6cd8adc5073d570add1ee`. Copyright (c) 2014 Nao Yonamine. MIT.
- pixi.js 3.0.11 browser build. Copyright (c) 2013-2015 Mathew Groves. MIT. https://github.com/pixijs/pixi.js

`src/reverb.js` is Reverb.js, CC0 1.0. https://github.com/andigamesandmusic/Reverb.js
The page does not call it. The room tail is generated in the page.

Not shipped, and why, is in `frontend/public/synth/fm/CHANGES.md`: the factory cartridge, the bundled `.mid` files, the recorded impulse, the two fonts, and the logo images.

## Anode (`frontend/public/synth/acid/`)

The Endless Acid Banger, an algorithmic acid bass groovebox.
https://github.com/vitling/acid-banger
Commit `bb93d972d9c656fe0acc861c94a492b56634d5e7`
Copyright 2021 David Whiting (Vitling)
Creative Commons Attribution 4.0 International. The legal code is `frontend/public/synth/acid/LICENSE.txt`.
https://creativecommons.org/licenses/by/4.0/

Changes from that commit: the page is reskinned, the panel names are LINE and KIT, and the four bundled drum recordings are replaced with drums synthesized in the page. See `frontend/public/synth/acid/CHANGES.md`.

The Anode page credits Vitling by name, links the original repository and the license, and says the drums in this copy are synthesized.

Filament bundles the packages below in `frontend/public/synth/vendor/tonejs-midi.js`.
The bundle is one ES module for the static `/synth/` page. The library source was not
modified except for that packaging. Checked 14 Oct 2026. The register is
`docs/filament-licensing.md`.

## @tonejs/midi 2.0.28

https://github.com/Tonejs/Midi

The MIT License (MIT)

Copyright (c) 2016 Yotam Mann

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## midi-file 1.2.4

https://github.com/carter-thaxton/midi-file

Dependency of @tonejs/midi. Bundled in the same file. Not imported on its own.

The MIT License (MIT)

Copyright (c) 2016 Carter Thaxton

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## array-flatten 3.0.0

https://github.com/blakeembrey/array-flatten

Dependency of @tonejs/midi. Bundled in the same file.

The MIT License (MIT)

Copyright (c) 2014 Blake Embrey (hello@blakeembrey.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Freeverb

The master reverb follows the structure of Freeverb by Jezar at Dreampoint (about 2000),
which was placed in the public domain. The design is eight parallel comb filters with a
one-pole damper in the feedback, then four series allpass filters, a second set for the
right channel, and these delay lengths at 44.1 kHz:

- combs: 1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617 samples
- allpasses: 556, 441, 341, 225 samples
- the right channel is 23 samples longer

A description is at <https://ccrma.stanford.edu/~jos/pasp/Freeverb.html>.

The JavaScript in `frontend/public/synth/master.worklet.js` was written for this project
from that published description. It is not a copy of the Freeverb C++ sources.
Public domain does not require attribution; this notice is here because the design is used.

## Delve (`frontend/public/delve/`)

Delve is original code written for this site. It does not ship a third-party engine, tileset, font, or sample.

The pictures (wall, floor, and ceiling textures, monster frames, portraits, particles, rune marks, and the page favicon) are drawn in the browser when the page loads. No tileset or sprite sheet is shipped. The favicon is the DXEdge mark redrawn with an ember stroke (`#e7a15a`) instead of the site green. Sound is synthesized with the Web Audio oscillator. Nothing is fetched from another host.

The game is a grid dungeon in the manner of late-1980s first-person crawlers. It does not use their names, levels, monsters, or art.

## MediaPipe Tasks Vision 0.10.21 (Sculpt, `frontend/public/synth/hand-sculpt/vendor/`)

MediaPipe Tasks Vision and the Hand Landmarker float16 model.
https://github.com/google-ai-edge/mediapipe
Copyright Google LLC
Apache License, Version 2.0. The full text is `frontend/public/synth/hand-sculpt/vendor/LICENSE`,
and the NOTICE text is `frontend/public/synth/hand-sculpt/vendor/NOTICE`.
Changed here: `vision_bundle.mjs` has its `sourceMappingURL` comment removed. The other files are as published.

Hand Orchestra (`/synth/hand-orchestra/`, 0.10.21) and Aether (`/synth/hand-aether/`, 0.10.17)
load the same library and model from jsDelivr and Google storage in the browser; they do not ship it.
