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
