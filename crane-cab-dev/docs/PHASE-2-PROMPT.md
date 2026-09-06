# Phase 2 handoff prompt

Paste everything below this line into the coding model, attach or point it at the crane-cab
folder (`crane-cab-dev/` in the dxedge repo, or your own clone).

---

You are implementing Phase 2 of Crane Cab, a static browser game. Phases 0 (scaffold) and 1
(cab + crane controls) are done and live at dxedge.net/crane-cab. Read README.md, CLAUDE.md,
js/state.js, js/events.js, and js/main.js first, plus the header comments already in
js/pendulum.js and js/sensors.js — they carry the exact formulas, don't invent new ones.

Files you may edit: js/pendulum.js, js/sensors.js (only the fields Phase 1 left alone:
actualLoad, ratedLoad, capacityPct, lmiLock, a2b, slack, collision, wind, swayAngle — radius,
hookHeight, and heading are done, leave them).

Hard rules, repeated because they matter:
- render.js and audio.js read state and never write it.
- Systems communicate through ctx.bus events, never by importing each other.
- Hook / unhook is never a grab key. pendulum.js only reacts to state.load.attached; it does not
  set it from input. Real ground-controlled attach/detach over the radio is Phase 3's job.
- Keep everything in one static folder. No bundler, no new dependencies beyond Three.js.

Scope:
1. pendulum.js: implement the swing physics exactly per the file's own header comment (two
   small-angle DOF — tangential from slew accel, radial from trolley accel — light damping, a
   wind drive term, and the hook.tight / load.slack / sway.settled events). Since radio.js
   doesn't exist yet to drive a real pickup, initialize state.load in init() with a fixed test
   load already attached (pick a reasonable mass and size, something in the 1000-1500 kg range
   fits the existing mission data) so the swing can actually be seen and tuned this phase.
   Comment clearly that this is a Phase 2 testing default and that Phase 3 replaces it with a
   real radio-driven pickup.
2. sensors.js: fill in the remaining fields per the file's own header comment — the rated-load
   chart with interpolation, capacityPct, lmiLock (emit lmi.lock on the rising edge), a2b (emit
   alarm.a2b on the rising edge), slack (mirrors load.onSurface), collision (AABB of the load
   against the current mission's deck volumes — mission 0's data in data/missions.js is fine to
   read directly), and swayAngle. Wind: there's no live mission data flowing yet (missions.js is
   still a Phase 3/4 stub), so leave sensors.wind at a simple constant or 0 and say so plainly in
   your report rather than inventing a wind model here.
3. Do not touch missions.js, radio.js, or main.js. You don't need mission switching to test this
   phase — a single always-attached test load is enough.

Done when, and verify each before you stop:
- The page loads with no console errors at http://localhost:8080.
- Slewing or trolleying with the load attached visibly swings it — a small-angle pendulum lag,
  not a rigid stick glued to the hook.
- Sway settles back toward zero over a few seconds once you stop moving (damping works).
- The LMI capacity bar and A2B lamp in the console react correctly at the radius / hook-height
  extremes (drive there with the existing Phase 1 controls).
- Console gauges (load, rated, capacity %, A2B lamp, slack lamp) update from real sensor values,
  not the Phase 0/1 placeholders.
- F3 overlay shows sway angle, capacity %, and the a2b / slack / lock / collision flags actually
  changing as you move.

Report back with: files changed, the test-load numbers you used and why, any deviation from the
header comments and why, and — since this is the physics phase and swing feel is the whole
point — call out anything you're not fully confident about for James's own play-test.
