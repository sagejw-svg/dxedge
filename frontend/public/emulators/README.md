# Emulators catalogue

`index.html` is a self-contained page (no build step) that renders `emulators.json`.
It is iframed by `frontend/src/components/Emulators.jsx` and served standalone at
`dxedge.net/emulators/`.

## Adding an entry

Append an object to `emulators` in `emulators.json`:

| field | meaning |
|---|---|
| `id` | unique slug |
| `name`, `url` | display name and the page where it runs, browser only, no plugins |
| `cat` | one of the keys in `categories` |
| `systems` | machines emulated |
| `blurb` | one sentence, what it is |
| `why` | why someone would open it |
| `can` | 3 to 6 short capability phrases |
| `repo` | source repo URL or `null` |
| `stars` | GitHub star count at `checked` date, or `null` (fact, snapshot) |
| `license` | short license string or `null` |
| `ease`, `ease_note` | 1 to 5 rating (our judgement) and the reason |
| `needs_files` | true when it does nothing useful without your own ROMs or images |
| `offline` | true when it is a PWA or explicitly works offline |
| `year` | approximate release year of the emulated hardware, or `null` |
| `tags` | lowercase search tags |
| `pick` | true for the handful shown first |
| `checked`, `confidence` | date the link was opened and `verified` or `likely` |

Categories: the eight machine categories plus fractals, Fourier/waves/signals, cellular automata and
chaos, and physics and science sims (keys in `categories`).

Rules: no game console cores that need copyrighted ROMs, no ROM archives, no Java or Flash.
The weekly link-rot job (`scripts/health/linkcheck.py`) sweeps every URL in this file.
