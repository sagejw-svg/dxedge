# Phase 1 handoff prompt

Paste everything below this line into the coding model, attach or point it at the crane-cab folder,
and paste the Design Prompt block from the Crane Cab Notion page above it.

---

You are implementing Phase 1 of Crane Cab, a static browser game. The folder already contains a
working Phase 0 scaffold. Read README.md, js/state.js, js/events.js, and js/main.js first. Do not
change the tick order, the state shape, or any file outside the ones listed below.

Files you may edit in this phase: js/input.js, js/crane.js, js/render.js, js/sensors.js
(radius, hookHeight, heading only; leave the rest for Phase 2).

Hard rules, repeated because they matter:
- render.js and audio.js read state and never write it.
- Systems communicate through ctx.bus events, never by importing each other.
- intent axes are -1..1 with no inertia. crane.js owns all inertia.
- Keep everything in one static folder. No bundler, no new dependencies beyond Three.js.

Scope:
1. input.js: implement the desktop map documented in the file header. Hold keys for axes,
   Shift for range II, Ctrl for micro, Space E-stop (one press, sticky until Space again),
   B toggles slew brake, T holds PTT, 1-8 sets intent.reply once, mouse drag sets intent.look
   deltas. Do not handle Escape or F3.
2. crane.js: implement kinematics per the header comments. Per-range max speeds, accel caps,
   mass scaling, clamps, E-stop, brake, and obey sensors.lmiLock and sensors.a2b.
3. sensors.js: fill radius, hookHeight, heading only.
4. Look-around: input.js writes intent.look deltas. crane.js applies them to state.look each tick
   with clamps (pitch -1.2..0.6 rad, yaw -1.4..1.4 rad). render.js only reads state.look.
5. render.js: replace the placeholder cab bars with a fuller cab shell: floor glass frame, seat,
   console box under the camera, roof. Add a trolley block and a hook block with a simple sheave.
   Original art only, no logos.

Done when, and verify each before you stop:
- The page loads with no console errors at http://localhost:8080.
- A/D slews with visible inertia, W/S moves the trolley, R/F raises and lowers the hook.
- Shift and Ctrl change speed. Space stops everything and holds until pressed again.
- Radius, hook height, and slew gauges in the console track the motion.
- Mouse drag looks around inside limits and snaps nothing.
- F3 overlay shows intent values changing.

Report back with: files changed, anything you deviated from and why, and the tuning numbers you
ended up with.
