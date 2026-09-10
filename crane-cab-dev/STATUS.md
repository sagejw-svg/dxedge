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
  test/regress.mjs is now 85 checks and test/smoke.mjs 14.
- **The radio talks, and it is full duplex.** Ground had a script, a caption and
  a squelch and no voice; it now has 111 recorded lines in `audio/`, one voice,
  rendered by `tools/voice.py` from an ElevenLabs voice built for the part
  ("Crane Cab Ground - TC-1 Banksman", voice_id gMNW3FZDVpJ5Afeq0XIK). The clips
  are dry: `js/audio.js` already bandpasses the radio bus 300-3000 Hz, so
  anything pre-filtered would be filtered twice. `data/clips.js` holds their
  measured lengths and `radio.js` sizes each transmission from that instead of
  the flat 1.6 s every call used to get, which was a second of dead air after
  "Up easy." and cut the blind shaft brief off mid-sentence. Guide calls carry
  their distance in the recording, so the caption and the voice can never
  disagree: the direction key picks up the bucket's tag (SWING_LEFT + F25).
  Half duplex is gone with the doubling it existed for - an answer given over
  the top of ground is banked, lights its button, and lands the moment the call
  ends, at no cost. `state.radio.garbled` is replaced by `state.radio.answered`
  (hard rule 6, declared in state.js), the `sayAgain` node is deleted from every
  script, and `radio.doubled` is now `radio.overlap`, a beat note rather than a
  fault.
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
- Then the pendulum, which was a small-angle model driven only by the two
  accelerations a control produces directly. It now carries the full rotating
  frame (centrifugal, Coriolis and Euler, on the pivot and on the swing itself),
  the rope length coupling that makes hauling in feed a swing, sin and cos
  instead of the linearisation, damping on the world velocity rather than the
  rotating-frame velocity, and a rope that drops L cos(tilt) so the load rises at
  the ends of its arc. Checked against closed forms rather than against
  yesterday's behaviour: period, centrifugal lean, Coriolis, the L^-3/4 amplitude
  law, the damping envelope, and that a free swing keeps its plane in the world.
  Because a steady lean is not a swing, sensors.swayAmplitude separates the
  oscillation from the lean and that is what the grade reads.
- Next phase: **5 (Phone + pause)** - touch sticks, pause menu, settings and the
  controls card, per the Notion phase table. No prompt doc yet; draft
  docs/PHASE-5-PROMPT.md first, per AUTOMATION.md step 2. Note that save.js now
  has a settings.changed event and nothing emits it: Phase 5 owns the settings UI
  and should wire it.
- **Jacob's round.** James's son operates cranes for a living and play-tested
  the build. Three things came out of it and all three shipped:
  - He took a radio fault on the blind shaft for something he had not done
    wrong. Ground calls "down easy", the reply window is three seconds, and its
    gate (`load.near`) is nine metres of descent away, so the only way to close
    the window was to take a hand off the levers mid blind set-down and press a
    button. Nodes now carry `ackBy`: the load starting down IS the answer, which
    is how a real operator acknowledges a movement call. `upEasy`, `hold` and
    `downEasy` also drop from `onTimeout: 'fault'` to `'repeat'`, so ground says
    it again before it costs anything, and the fault carries the node's caption
    so the card says "no answer to ..." instead of "a radio fault".
  - Z stopped working after an alt-tab and the head stayed leaned out over the
    glass for the rest of the session. `window.blur` cleared the three key
    latches that existed when it was written and not the two the head controls
    added. It is one `latched` Set now, cleared wholesale, plus a
    `visibilitychange` handler for the focus changes blur does not reach.
  - Three more jobs on the board (4 Out at range, 5 Between the stacks,
    6 Round the core) with their own scripts and nine new voice clips, and the
    achievement table moved from `js/scoring.js` to `data/achievements.js`
    (hard rule 3) and grew from 10 to 19. The after-action card now shows the
    whole board, folded shut, with what was just unlocked marked in place.
    `state.mission.par` is new (hard rule 6, declared in state.js).
  - Suite is 112 headless checks and 24 browser checks.
- **Second Jacob round.** Two review agents were run over the build, one against
  real tower crane practice and one adversarially over the previous commit. What
  came out of it and shipped:
  - The fault caption the last round added printed `[object Object]` on five of
    the seven jobs: half the nodes carry their caption as an { imperial, metric }
    pair and an object is truthy, so it won a `||` chain ahead of the resolved
    one. `inUnits` now, not the raw field.
  - `ackBy` no longer closes the reply window early. Closing it the instant the
    level went true made "Stopped" unpressable on `hold`, whose predecessor
    leaves the crane stopped by construction. Being acted on now only means the
    lapse costs nothing.
  - "Heard You" was free (the say-again count was read off a reply event that is
    emitted past the say-again branch, so it was always zero) and "Hands On" was
    impossible (it counted the briefing calls, which have no lever answer). Both
    fixed; both verified earnable by a flight.
  - The ALL STOP wanted the mushroom inside 1.5 s or the lift was lost. It is
    3 s now and either answer counts: the mushroom, or hands off the levers and
    kept off for the length of the alarm. Judged on the levers, not the
    velocities, so the machine's own coasting is not held against the operator.
  - Ground called the operator straight through the core on mission 6. wrapPi
    always answers with the shorter arc and the shorter arc goes through a
    building. He now samples the arc against the structure's footprint and calls
    the operator inside the near face instead. `state.mission.obstruction` is new
    (hard rule 6, declared in state.js).
  - The anti-two-block and the LMI cut-out no longer lose the lift, and neither
    does 91 percent of rated. Those are the machine's own protection working. A
    lift is lost by sitting at or above rated for two seconds, or by hitting
    something; the limits cost a letter each and say so on the card.
  - Rope tension is dynamic: m g cos(theta) + m a + m L omega^2. It was m g and
    nothing else, so the LMI could not be provoked and "watch your chart" was
    advice about a needle that does not move. Mission 4 now reaches 90 percent.
  - The load chart was reshaped. The old points had the load MOMENT rising from
    10 m to 20 m, which no crane's chart does. It is a flat 6 t plateau to 21 m
    and monotonic after it, 126 t.m to 102 at the tip. Mission masses moved with
    it.
  - Radio content: ground says the weight before the operator goes near the load
    (every real pick opens with it and this deck never had it), holds the load a
    few inches off for a trial lift, counts a blind set-down all the way to the
    deck instead of stopping at ten feet, calls the function stop, and tells the
    operator the men are clear before he is released. Thirty one new or
    re-recorded clips, 164 in all.
  - New: `test/pilot.mjs` and `test/fly.mjs`, a pilot that flies with the
    controls and obeys ground's calls, distances included, with no teleporting.
    `test/regress.mjs`'s flyMission park()s the crane onto its marks, so it can
    neither hit anything nor be misdirected, which is how mission 6 shipped with
    a guide that pointed into a building. Run `node test/fly.mjs` before a deploy
    that touches the missions or the guide. All seven jobs fly to a win.
  - Suite is 113 headless checks, 24 browser checks, 7 flown jobs.
- **The cab has its own gauges.** Everything the screen console shows is now also
  drawn in the world, on two instrument panels render.js builds into the cab, and
  G hides the screen console so the operator flies on them alone. Saved with the
  other settings.
  - Two panels, because a cab has two. The gauges are on the right hand console
    at armrest height, which is where you look DOWN for a number; the radio head
    is on the front window frame in the sight line, which is where you must not
    have to look for a call. One panel meant the only way to read a caption with
    the HUD off was a thirty five degree glance away from the load, mid lift.
  - Both are canvases used as textures, on MeshBasicMaterial so a backlit display
    is not lit by the cab lamp, redrawn at 12 Hz and only when a change signature
    moves. Measured: a moving crane uploads about two textures a second, a still
    one uploads none. Cost is 4 draw calls and 28 triangles against a budget of
    90 and 40000.
  - New `data/units.js`. CLAUDE.md puts unit conversion in ui.js, which was right
    while the gauges existed once; the alternative to this file was two copies of
    the same arithmetic in two modules that may not import each other, which is
    how a cab comes to disagree with its own HUD about what is on the hook.
  - `state.settings.hud` is new (hard rule 6, declared in state.js).
  - Suite is 113 headless checks and 30 browser checks.
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
