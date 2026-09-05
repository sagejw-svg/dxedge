# Crane Cab build status

Source of truth for design, architecture, and the full phase table is the
"Crane Cab" page in James's Notion (search title "Crane Cab"). This file is
just the machine-readable pointer to where the build actually is, so a
fresh session doesn't have to reverse-engineer it from git history.

## Current state

- Last completed phase: **1 (Cab + crane)** — input.js, crane.js, sensors.js
  (radius/hookHeight/heading only), render.js done per docs/PHASE-1-PROMPT.md.
  Plus, ahead of the numbered plan at James's request: procedural canvas
  textures (steel/deck/crate/grandstand, no image files), decorative
  preview crates at every mission's pickup point, and a generic tiered
  stadium backdrop with light towers. See the Notion Changelog for tuning
  numbers and the two deviations (I/micro slew and trolley speeds are
  extrapolated, not given explicitly; a mouselook Y-axis sign bug was
  found and fixed during verification).
- Next phase: **2 (Physics + sensors)** — pendulum.js, plus sensors.js's
  remaining fields (actualLoad, ratedLoad, capacityPct, lmiLock, a2b,
  slack, collision, wind, swayAngle). Real hook-to-load attach and pickup
  physics land here; the crates placed in Phase 1 are visual-only until then.
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
