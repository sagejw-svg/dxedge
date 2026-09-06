# Crane Cab build status

Source of truth for design, architecture, and the full phase table is the
"Crane Cab" page in James's Notion (search title "Crane Cab"). This file is
just the machine-readable pointer to where the build actually is, so a
fresh session doesn't have to reverse-engineer it from git history.

## Current state

- Last completed phase: **2B (review fixes + reach)** — data/crane.js is the single
  crane spec (jib length, trolley stop, speeds, load chart); Reach gauge and deck rings
  (amber = chart limit for the load on the hook, grey = trolley stop); pendulum plane
  now fixed in the world while the jib slews; wind has a world direction per mission;
  damping retuned (0.05 base + 0.3 x slider); predictive A2B on stopping distance; LMI
  approach caps trolley-out to range I above 90% and brakes at lock; imperial mass in
  pounds; `?debug` URL flag exposes window.__cab for harness verification. Built and
  verified headlessly in chat 2026-09-05, delivered as a patch for James to push.
  Previous: **2 (Physics + sensors)** — pendulum.js (two
  small-angle DOF, damping, deck contact, wind lean) and the remaining
  sensors.js fields (actualLoad, ratedLoad, capacityPct, lmiLock, a2b,
  slack, collision, swayAngle) done per docs/PHASE-2-PROMPT.md. A fixed
  1500 kg test load is hung pre-attached in pendulum.init() as a Phase 2
  testing default; Phase 3 replaces it with a real radio-driven pickup.
  Shipped 2026-09-06 (commit c5f68d5) from an interactive session after
  two nightly runs built and verified it but were blocked on push by the
  sandbox's git proxy authorization check — see the Notion Changelog for
  the full blocker/resolution writeup and the four items needing James's
  own play-test judgment (sway damping decay, control feel at 1500 kg,
  A2B margin, whether LMI lockout should also brake the trolley).
  Phase 1 (Cab + crane — input.js, crane.js, sensors.js radius/hookHeight
  /heading, render.js, plus procedural textures, preview crates, stadium
  backdrop, title-card controls reference, and the reopenable help button)
  shipped 2026-09-05; see the Notion Changelog for its tuning numbers.
- Next phase: **3 (Radio + missions 0/1)** — prompt is docs/PHASE-3-PROMPT.md.
  Covers audio.js buses, radio.js director, reply strip, doubling, ack
  timer, and missions 0/1 as data. This is also where the Phase 2 test
  load gets replaced by a real radio-driven pickup.
- Live at: https://dxedge.net/crane-cab (standalone) and as the first tab
  group on https://dxedge.net/
- Repo: sagejw-svg/dxedge, branch main
- This folder (`crane-cab-dev/`) is the working source. `frontend/public/crane-cab/`
  in the repo root is the published mirror — copy `index.html`, `css/`, `js/`,
  `data/`, `audio/` (not this file, not `CLAUDE.md`, not `docs/`, not `.claude/`)
  into it on every deploy.

## After each automated run, update

1. This file's "Current state" section (last completed phase, next phase).
2. The Changelog section at the bottom of the Notion Crane Cab page (search
   title "Crane Cab") — what shipped, deviations, tuning numbers, and
   anything that needs James's own play-test (physics feel especially).
3. Commit this file alongside the code change so git history and this
   pointer never drift apart.

## When Phase 6 (Ship) is done

The numbered phases (0-6) in the Notion Architecture section are the v0.1
build order. Once Phase 6 ships, there is no more numbered phase — switch
to working the Notion page's Backlog section top to bottom (the "v0.1 ship"
checklist first if anything there is still unchecked, then "v2 later", then
the "To-dos" sections), one item per run, same verify/deploy/changelog loop.
Note which list and item you took in this file so the next run doesn't
duplicate it.
