# Anode: what changed from The Endless Acid Banger

Pinned at `bb93d972d9c656fe0acc861c94a492b56634d5e7` (2021-05-28).
License: CC BY 4.0. The upstream repo has no LICENSE file; the README and the file headers state the license. `LICENSE.txt` here is the CC BY 4.0 legal code. The page credits David Whiting (Vitling).

The page is a light reskin (near-black ground, amber type, the site mono stack). The name on the page is Anode. TypeScript is compiled to static JS in `js/` (`tsc`, ES modules, no source maps). The Google Fonts import is gone.

## Not included

`909BD.mp3`, `909SD.mp3`, `909CH.mp3`, `909OH.mp3`. The project is CC BY 4.0, which would cover those files only if the author had the right to license the recordings. Nothing in the repo says that, and the names point at a drum machine, so the recordings are not here.

`src/audio.ts` adds `SynthDrumMachine`: a bass drum (a falling sine), a snare (noise plus a short tone), and two lengths of high-passed noise for the hats, in the same trigger order the sampler used. `src/app.ts` calls that instead of fetching the mp3s.

## Other edits

- Panel labels are "LINE 1", "LINE 2", and "KIT". Mute buttons say bass, open hat, closed hat, and snare.
- Dial and meter text use the site mono stack instead of Orbitron.
- `window.__anode` plays one bass note and reports the output level, for the smoke test.
- Dials take keyboard and mouse-wheel focus, and Shift makes the drag finer. Reset puts every dial back to its starting value and turns off "Twiddle With Knobs". The two lines and the kit sit side by side on a wide screen. S M L XL is the same remembered control size as the rest of the synths.
- The start screen and the paragraph under the title both name Vitling, the original title, and CC BY 4.0, and say that the drums in this copy are synthesized.
