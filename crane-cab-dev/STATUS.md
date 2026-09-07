# Crane Cab build status

Source of truth for design, architecture, and the full phase table is the
"Crane Cab" page in James's Notion (search title "Crane Cab"). This file is
just the machine-readable pointer to where the build actually is, so a
fresh session doesn't have to reverse-engineer it from git history.

## Current state

- Last completed phase: **4 (M2/M3 + scoring)**, plus a fourth bug and
  improvement pass on top of it (Changelog entry "Phase 4B"). That pass fixed
  two things that made the game unplayable on real hardware and real controls.
  The hook camera inset passed drawing buffer pixels to setViewport and
  setScissor, which three multiplies by the pixel ratio itself, so on any Retina
  or scaled display the inset was drawn off screen AND the whole main view was
  left scaled and cropped until a window resize. And sensors.js published one
  sway angle for the empty hook block and for a load alike, so slewing out at
  range II, the first thing a player does on every mission, raised a phantom ALL
  STOP and failed the lift in about ten seconds. It also closed the most common
  hang in the game: a hook retry that expired inside a transmission was lost,
  stranding a quarter of all fuzzed lifts at "on the hook" with no way out.
  test/regress.mjs is now 65 checks and test/smoke.mjs 12.
- Phase 4 itself: the phase table's own done
  condition, "refresh keeps progress", is met and checked. scoring.js grades a
  lift on a demerit count and says which line cost the letter; save.js persists
  achievements, personal bests, a hooks counter and the furthest mission through
  validated localStorage that degrades to defaults on any garbage; the mission
  flow is 0-1-2-3 with a fail retrying; the after-action card shows time, sway,
  faults, landing error, grade and a to-scale footprint-against-pad plan view;
  the hook cam works on C and is refused with a visible reason on the blind
  shaft; mission 2's anemometer gusts. **The real work was underneath: the world
  had exactly one floor, at y 0, so mission 2's load fell through the scaffold
  (colliding on the way) and mission 3 could never reach the shaft at -9 while
  being winnable by hovering over the hole at deck level. Both missions were
  unplayable and had been since the data was written in Phase 0.** state.mission
  .surfaceY now carries what is under the load, support is directional so a
  volume's top only holds a load arriving from above, pendulum clamps the load at
  what it rests on (state.load.bottomY), and resting on a volume is no longer
  counted as colliding with it. Verified by an autopilot that flies each of the
  four missions on the radio alone.
- Phase 4 and 4B are live as of Sep 7 2026 (commit ab52d9c). A build stamp
  followed (aaaf5ce): data/build.js carries a sha and a date, the deploy stamps
  it into the published mirror only, and the title card shows it bottom right.
  Never commit a stamped build.js; the committed value stays sha: 'dev'.
- A graphics pass followed that. The view had no shadows and flat lighting, so a
  twelve metre scaffold seen from a forty two metre cab was a slightly different
  shade of grey on a flat plane and mission 2 looked like it had no scaffold at
  all. There is now a sun that casts, a gradient sky, lattice for the jib,
  counter jib and mast, a counterweight, painted site markings, and a clustered
  yard of containers and material stacks outside the trolley stop. Deck volumes
  get their own value plus hazard-striped edge protection on anything tall
  enough to be a working level. Shadows drop themselves, one way, if the frame
  rate sits under 20 for six seconds; test/smoke.mjs watches that happen on the
  software renderer.
- Next phase: **5 (Phone + pause)** - touch sticks, pause menu, settings and the
  controls card, per the Notion phase table. No prompt doc yet; draft
  docs/PHASE-5-PROMPT.md first, per AUTOMATION.md step 2. Note that save.js now
  has a settings.changed event and nothing emits it: Phase 5 owns the settings UI
  and should wire it.
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
