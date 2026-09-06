# Phase 4 handoff prompt

Drafted 2026-09-06 from the Notion Architecture section, the Design Prompt, the
Gauges and controls section and the Backlog, per AUTOMATION.md step 2. Unlike
Phases 2B and 3 there is no Notion child page for this one: the page never uses
the words "Phase 4" at all. Everything below that the page does not specify is
marked **INVENTED** with the reasoning, so James can overrule it cheaply.

Paste everything below the line into the coding model.

---

You are implementing Phase 4 of Crane Cab, a static browser game. Phases 0 to 3
are live at dxedge.net/crane-cab. Phase 4 is the phase that makes a lift mean
something: two more missions, a real after-action card, achievements, and
persistence. The phase table's done condition is "Refresh keeps progress".

Read README.md, CLAUDE.md, js/state.js, js/events.js, js/main.js, then the
header comments in js/scoring.js and js/save.js, then js/missions.js, js/ui.js
and both data files. The header comments and schemas are the contract.

**Run `node test/regress.mjs` before you touch anything.** It is 24 checks and it
must be 24/24 on a clean tree. Every check in it is a bug that was once live, so
a failure means you have already broken something. Run it again after every
substantial edit, and add checks for the behaviour you add.

Files you may edit: js/scoring.js, js/save.js, js/missions.js (mission flow and
the scoring hand-off), js/ui.js, js/render.js (hook cam and the landing
footprint only), js/input.js (the C hook cam toggle only), js/sensors.js (the
wind field only), js/audio.js (a win and fail sting only), js/state.js (additive
fields), js/main.js (card wiring only), data/missions.js, data/radio.js,
index.html, css/game.css, test/regress.mjs.
Do not touch crane.js, pendulum.js, events.js.

Hard rules, repeated because they matter:
- render.js and audio.js read state and never write it, directly or through a
  bus handler that writes state.
- Systems communicate through ctx.bus events, never by importing each other.
  Data imports from data/ are fine.
- Missions and radio scripts are data. New content never goes in js/.
- The tick order is fixed: input, crane, pendulum, sensors, missions, radio,
  scoring. scoring runs last, so it sees the finished tick.
- Hook and unhook stay ground-controlled. No grab key, on any mission.
- Do not change the shape of an existing state.js field without saying so.

## 1. scoring.js — owns state.scoring

It listens on the bus and never polls another system's internals. Its header
already names the fields; fill them in.

- `maxSway` max sensors.swayAngle during the lift, radians.
- `collisions`, `twoBlocks`, `radioFaults` count `collision.counted`,
  `alarm.a2b` and `radio.fault` between `lift.start` and the resolution.
- `landingError` horizontal distance, metres, from the load centre to
  `mission.landingPos` at the moment of `hook.released`. Null if never released.
- `elapsed` copied from state.mission at resolution.
- `grade` a letter, see below.
- Reset every field on `lift.start`. Phase 3's counters live on state.mission
  and are per-lift; scoring is the one that persists a lift's record.

**INVENTED: the grading rubric.** The page says only "letter grade on
after-action card" and gives no thresholds, no formula and no weighting. This is
the first thing to show James. Proposed, as a straight demerit count so it is
explainable in one line on the card rather than a hidden score:

    Start at A. Drop one letter for each of:
      landingError > tol            (missed the pad, but still inside the zone)
      maxSway      > 3 degrees
      radioFaults  > 0
      maxCapacityPct > 90
    Two or more of any single kind drops two letters. A collision, a two-block,
    an LMI lockout or an ignored ALL STOP is a fail, not a grade, so those never
    appear here. Floor at D.

A perfect lift is an A, a lift that was merely legal is a C or D, and the card
must say which line cost the letter. Do not produce a numeric score: the page
lists leaderboards under Skip, and a number invites one.

`afterAction(ctx)` returns a plain object; ui.js renders it and does no
arithmetic of its own.

## 2. save.js — localStorage

The keys are locked by the Notion Locked decisions: `craneCab_hi`,
`craneCab_ach`, plus `craneCab_settings`. Every value is JSON with a `v` field
and migrates on bump. Nothing here may ever throw: a hand-edited or truncated
value must degrade to the default, not break the boot.

- `craneCab_settings` already loads. Add `saveSettings` calls where settings
  actually change (nothing calls it today, which is a latent Phase 5 bug).
- `craneCab_hi` **INVENTED shape**, the page says only "personal best per
  mission in localStorage": `{ v: 1, data: { [missionId]: { time, grade,
  landingError, sway } } }`, best kept by time among lifts of equal or better
  grade. Keep the whole record so the card can say "best 1:42, grade A".
- `craneCab_ach` `{ v: 1, data: { [name]: firstEarnedISODate } }`.
- **Validate on load.** Wrong `v`, wrong type, NaN, a mission id that is not a
  number: drop that entry and keep the rest. Write a regression check that
  feeds it garbage.

## 3. Achievements

The page names ten and defines none of them except by implication. **All ten
definitions below are INVENTED**; the names are not.

    Radio Check    win mission 0
    First Hook     win mission 1
    Scaffold Kiss  win mission 2
    Blind Trust    win mission 3
    Zero Swing     win with maxSway under 1 degree
    No Two-Block   win a lift with zero A2B alarms
    Chart Legal    win a lift that never exceeded 90 percent of rated
    Dog Everything hit the E-stop during a genuine ALL STOP and recover to a win
    Clean Sheet    win with an A grade, no faults and no alarms
    Hundred Hooks  a hundred lifts hooked on across all sessions, ever

Only `Hundred Hooks` needs a counter that survives a lift; keep it in
`craneCab_ach` alongside the awards. Award on `lift.win`, persist immediately,
and never re-award. The card shows only what was unlocked this lift.

## 4. Missions 2 and 3

The data already exists in data/missions.js and the positions, masses and deck
volumes are not to be changed without saying why. What is missing is their radio
scripts and the flow that reaches them.

- `data/radio.js`: write `scaffold` and `blindShaft` on the same node contract
  as `truckUnload`. Both need check, a guide to the pickup, the hook flow, a
  guide to the landing, hold, down easy, unhook, complete, plus sayAgain,
  allStop and allStopClear. Read the header for the field meanings; a landing
  guide clamps to the mission's own tolerance, so nothing extra is needed to
  make them fair.
  - `scaffold` lands at y 12, on a structure. Add one call before the landing
    guide warning that the pad is up on the scaffold, and be aware that
    `load.near` and the win both measure against `landing.pos` at height.
  - `blindShaft` lands at y -9, below the deck, and mission 3 is `hookCam:
    false`. The whole point is that the operator cannot see it. Ground has to
    talk them the whole way down, so this script needs more guide nodes and
    tighter calls than the others, not fewer.
- **Check the shaft geometry works before writing its script.** The four shaft
  walls in data/missions.js are deck volumes, so the load must go down a hole
  between them without touching. Verify in the harness that a centred descent is
  actually possible with the mission's load size, and if it is not, widen the
  hole in data/missions.js and say so in your report.
- Mission flow: `missions.nextMissionId` currently ping-pongs 0 and 1 as a Phase
  3 placeholder. Make it the real progression 0, 1, 2, 3, then stop. A fail
  retries the same mission. Persist the furthest mission reached so a refresh
  resumes there.

## 5. The after-action card

Replace the plain Phase 3 end-of-lift card in index.html and js/ui.js. It shows,
per the Design Prompt: time, max sway, radio faults, landing error. Plus the
grade, what it cost, any achievement unlocked, and the personal best for this
mission. On a fail it shows the reason and no grade.

**INVENTED: the landing error overlay.** The Backlog asks for "landing error
overlay (footprint vs pad)". Draw it in the card as a small top-down 2D figure:
the pad circle at `landing.tol`, the load footprint where it was set down, and
the offset between them. Canvas or inline SVG in ui.js, no new dependency.

Keep the button behaviour: Next lift on a win, Try again on a fail.

## 6. Hook cam

The desktop map has documented C since Phase 1 and it does nothing. Mission 3 is
`hookCam: false` and "cam off" is the phase table's own description of it, which
only means something if the cam exists.

- A small inset in a corner of the glass, looking straight down from the hook
  block. A second Three.js camera and a second `renderer.render` into a viewport
  is the cheap way; do not add a render target or a second renderer.
- `C` toggles it, via `state.intent` and a ui-owned flag, not from input.js
  writing render state directly.
- Forced off when the active mission has `hookCam: false`, and the toggle says
  so rather than silently doing nothing.
- It costs a second scene traversal every frame. Measure the frame time with it
  on and off and report both; if it is worse than about 15 percent on the
  software renderer, make the inset update at half rate and say so.

## 7. Wind and gusts

Mission 2 carries `gust: 3` and every other mission carries `gust: 0`. sensors.js
publishes `sensors.wind` from `mission.wind.base` today and ignores gust.

**INVENTED: the gust model.** The page says only "gusts on wind missions" and
specifies nothing else. Proposed, deliberately dull so it can be tuned by ear:
`wind = base + gust * n(t)`, where `n(t)` is a smooth pseudo-random walk in
0..1 with a period of roughly 6 to 12 seconds, seeded per lift so a retry is not
a different mission. Publish the instantaneous value on `sensors.wind` so the
anemometer moves; pendulum.js already reads it and needs no change.

## 8. main.js, card wiring only

Nothing else in main.js moves. The end card is already wired; it needs to show
the after-action content and its button needs to follow the real mission flow.

## Done when, and verify each before you stop

Run `node test/regress.mjs` and `bash test/run.sh`. Add checks to
test/regress.mjs for each of these; the ones marked (harness) must be a check in
that file, not a thing you observed once.

- 24/24 existing checks still pass, and the suite has grown.
- (harness) A won lift produces a grade, and each demerit in section 1 drops it
  by the stated amount. Feed the scorer a perfect lift and a scruffy one.
- (harness) Missions 2 and 3 can be flown to `lift.win` from a cold start.
  If either cannot, that is the finding, and you stop and report rather than
  loosening the win rule to make it pass.
- (harness) The blind shaft descent clears the four wall volumes.
- (harness) The flow is 0, 1, 2, 3 and a fail retries the same mission.
- (harness) save.js survives garbage: no `v`, wrong `v`, a truncated string,
  `null`, an array where an object belongs, NaN in a time. Nothing throws and
  the defaults come back.
- (harness) An achievement is awarded once and never twice, and the Hundred
  Hooks counter survives a simulated reload.
- Refresh with real localStorage keeps achievements, the personal best and the
  furthest mission. This is the phase table's own done condition.
- The after-action card shows time, max sway, radio faults, landing error,
  grade, the line that cost the grade, and the footprint overlay. On a fail it
  shows the reason and no grade.
- The hook cam opens on C, is forced off on mission 3 with a visible reason, and
  the frame cost is measured and reported.
- Mission 2's anemometer visibly moves; the other three sit still.
- No console errors. Both copies identical. sw.js bumped. A live fetch shows it.

Report: files changed, every INVENTED decision above and whether you kept or
changed it, the grade thresholds you settled on, the hook cam frame cost with
and without, any mission geometry you had to change and why, the new checks you
added, and what needs James's own hands rather than a harness.
