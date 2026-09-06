# Phase 3 handoff prompt

Copied verbatim from the Notion child page "Phase 3 prompt (radio director, missions 0 and 1)"
(written 2026-09-05 in chat). Everything below the line is the code block from that page.

---

You are implementing Phase 3 of Crane Cab, a static browser game. Phases 0, 1, 2 and 2B are live at
dxedge.net/crane-cab. Phase 3 makes the radio the core loop and turns missions 0 and 1 into real
lifts with ground-controlled hook and unhook. Read README.md, CLAUDE.md, js/state.js, js/events.js,
js/main.js, then the header comments in js/radio.js, js/missions.js and js/audio.js, and both data
files data/radio.js and data/missions.js. The header comments and schemas are the contract.

Files you may edit: js/radio.js, js/missions.js, js/audio.js, js/pendulum.js (only to delete the
Phase 2 test load block in init()), js/render.js (only items 8a and 8b), js/ui.js (reply strip
garble, ack bar, end-of-lift card), js/state.js (additive fields listed below), data/radio.js,
data/missions.js, index.html and css/game.css (end-of-lift card only), js/main.js (item 6 only).
Do not touch crane.js, sensors.js, input.js, save.js, scoring.js.

Hard rules, repeated because they matter:
- render.js and audio.js read state and never write it.
- Systems communicate through ctx.bus events, never by importing each other. Data imports from data/
  are fine.
- Hook and unhook are never a grab key. Only the radio director emits hook.attach and hook.release,
  and only missions.js sets state.load.attached.
- Radio scripts are data. If you need a new capability, add a node field and document it in the
  data/radio.js header. Never hardcode a mission inside radio.js.
- Audio never blocks the script. No voice clips exist yet, so everything must work caption-only.

1. Radio director (js/radio.js). Runs the script named by the current mission.
   state.radio adds: prevNode, repeats, groundTimer, ackTimer (exists), playerTimer, guideTimer.
   Node kinds:
   a. Call node (the existing shape). Ground transmits for the clip length, or 1.6 s with no clip,
      with tx = groundTx and the caption shown. Then tx = idle and the ack window runs for
      node.timeout seconds. The reply strip shows node.expect plus Say again, always last. A matching
      intent.reply advances: emit radio.reply {label}, tx = playerTx for 0.8 s, then if node.waitFor
      is set wait for that bus event, then go to node.next. Timeouts: onTimeout repeat means say it
      again with urgency + 1, and a second timeout logs a radio fault and repeats again; onTimeout
      fault logs the fault at the first timeout, then repeats. A fault is state.radio.faults += 1
      and emit radio.fault {node}.
   b. Guide node: { id, guide: pickup | landing, tol, next }. Ground steers the hook onto the
      mission's pickup or landing position. Every 3 s (guideTimer) compute the horizontal offset from
      the hook (crane radius and slew, ignore swing) to the target and say the single largest
      correction as a call: SWING LEFT or SWING RIGHT for the tangential part (sign by the shorter way
      round), TROLLEY OUT or TROLLEY IN for the radial part. Inside 3x tol say HOLD HOLD HOLD once
      (urgency 1). When inside tol and sensors.swayAngle is below 2 degrees, advance to next. Guide
      calls expect no reply and never fault. Captions: Swing left. Swing right. Trolley out.
      Trolley in. Hold, hold, hold. Append the distance in the player's units when it is over 3 m,
      rounded to 5 ft or 2 m (Trolley out, twenty feet.).
   c. Action on any node: action hook emits hook.attach when the node is entered; action unhook
      emits hook.release. The director never touches state.load. A node with action hook does not
      advance until hook.attached arrives; if hook.notReady arrives instead, re-say the node with
      caption Bring the hook over the load first. and try again after 4 s.
   d. Interrupts. On bus collision, or when sensors.swayAngle exceeds 10 degrees, jump to the
      script's allStop node with prevNode recorded. allStop has waitFor estop and timeout 1.5 s. If
      no estop arrives inside the timeout, emit radio.ignoredAllStop and let missions fail the lift.
      When estop arrives, go to allStopClear (All stop received. Recover easy.), then RETURN.
      next RETURN means go back to prevNode.
   e. Half duplex. Any player transmission (intent.ptt held, or a reply press) while tx = groundTx
      is a double: state.radio.garbled = true for 1.2 s, log a fault, emit radio.doubled, jump to
      sayAgain whose next is RETURN. intent.ptt held with no reply is an open carrier: tx = playerTx
      while held, PTT LED on, nothing said.
   f. Script complete (next null) emits radio.complete. Bus radio.start {script} starts a script,
      radio.stop ends it and clears the caption and replies.

2. Missions (js/missions.js). Owns state.load placement and the win and fail rules.
   state.mission adds: pickupPos, landingPos, hooked (bool), everHooked (bool), maxCapacityPct,
   hadCollision.
   - start(ctx, id): reset load (attached false, mass and size from the mission, swing zero), copy
     pickup.pos and landing.pos into state.mission, reset the counters above, emit lift.start {id},
     emit radio.start {script: mission.script}.
   - On hook.attach: if the hook is within 1.0 m horizontally of pickupPos and the hook block bottom
     is within 0.6 m above the load top, set load.attached = true with the mission's mass and size,
     hooked = everHooked = true, and emit hook.attached. Otherwise emit hook.notReady.
   - On hook.release: only if load.onSurface and sensors.slack. Set load.attached false, hooked
     false, emit hook.released.
   - Every tick while a mission runs: horizontal distance d from the load centre (hook plus swing
     offset) to landingPos. Emit load.near once when d is under 2 m and the load bottom is within 3 m
     above the landing height; emit load.inZone once when d is under landing.tol; re-arm both if the
     load leaves. Track maxCapacityPct and hadCollision.
   - Win when: inZone, sensors.slack, released after having been hooked, maxCapacityPct under 90,
     hadCollision false. Fail on: alarm.a2b, lmi.lock, collision, hoist-up before hooked
     (crane.lineVel under -0.05 while not hooked and after the script has passed its check node),
     radio.ignoredAllStop. Emit lift.win {id, time} or lift.fail {id, reason} exactly once, set
     state.mission.result, emit radio.stop.
   - After a win on mission 0 the next lift is mission 1; after mission 1, back to mission 0. Phase 4
     adds the real mission flow.

3. Audio (js/audio.js). Three buses into master as the header says. Phase 3 ships procedural sound
   only, no files.
   - radio bus: bandpass 300 to 3000 Hz, light waveshaper drive, then master. On groundTx start, a
     10 ms noise click (squelch open), a static bed at about -30 dB for the transmit duration, and a
     60 ms noise burst on end (squelch tail). On playerTx, a sidetone click only. Doubled: 1.2 s of
     louder static. playRadio(ctx, key) tries audio/KEY.ogg once per key, caches the result, and on
     404 plays nothing beyond the squelch. Never throw, never block.
   - machine bus: a hoist motor oscillator whose pitch follows the magnitude of crane.lineVel (200 to
     600 Hz, gain tracks speed) and a slew whine following the magnitude of slewVel. Keep gains low.
     This is a bed, not an effect.
   - alarm tones per the Notion Cab alarms section: LMI pre-alarm 2 Hz tick at about 880 Hz above
     90 percent, lockout a solid tone near 440 Hz, A2B a 6 Hz harsh tick near 1200 Hz. Mute silences
     ambience and machine only; LMI lockout and A2B still sound.
   - The unlock on the title card tap already exists. Keep it.

4. Data.
   - data/radio.js: rewrite radioCheck to use guide nodes and the hook flow:
       check, toPickup (guide pickup, tol 1.0), onHook (action hook), upEasy (waitFor hook.tight),
       toLanding (guide landing, tol 1.0), hold (waitFor sway.settled), downEasy (waitFor load.slack),
       good (action unhook), complete.
     Add truckUnload with the same skeleton plus one extra call before toPickup: Watch the truck
     cab. Swing right first. Add allStopClear. Keep sayAgain and allStop. Document every node field
     in the file header.
   - data/missions.js: move mission 0's pickup to [22, 0, 6] so the guide node has something to say
     from the starting trolley position. Everything else stays.

5. UI (js/ui.js, index.html, css/game.css).
   - Reply strip already renders and input.js already maps clicks to intent.reply. Add the garbled
     class to the caption while radio.garbled, and draw the ack countdown as a thin bar under the
     caption that empties over node.timeout.
   - End-of-lift card (#endcard): Lift complete or Lift failed: reason, elapsed time, max sway,
     radio faults, and one button, Next lift on a win or Try again on a fail. Phase 4 replaces this
     with the full after-action card. Keep it plain.

6. main.js, one change only: on lift.win or lift.fail set phase afteraction and show #endcard. The
   card button starts the next mission and sets phase playing. Nothing else in main.js moves.

7. pendulum.js: delete the Phase 2 test load block in init() (the TEST_LOAD constant and the lines
   that hang it). init() resets swing and tension to zero and leaves attached false. Nothing else.

8. render.js, two things only:
   a. Draw the hanging load as a box of load.size under the hook block when load.attached is true.
      Hide it when false.
   b. Hide the decorative preview crate at the active mission's pickup while load.attached is true,
      and show a crate at the landing position once the load has been released there. Read
      state.mission for positions. Do not add fields to state from render.js.

Deploy: work in crane-cab-dev/, copy to frontend/public/crane-cab/, confirm a recursive diff is
empty, bump sw.js CACHE_NAME from dxedge-v15 to dxedge-v16, commit, push. If the push is refused,
stop per the runbook and save the commit as a patch plus a short handoff in the Claude Project so
nothing is lost.

Done when, and verify each headlessly before you stop. Drive intent from a harness and never depend
on audio for a check.
- No console errors. The title tap starts mission 0. The first caption is TC-1, radio check. and the
  reply strip shows Copy and Say again only.
- Reply inside the window: the caption advances to a guide call. Let the window lapse twice: one radio
  fault logged and the call repeats.
- Guide: move the hook toward the pickup. Calls change from TROLLEY OUT to HOLD as you close. Inside
  tol with sway settled, ground says On the hook. Hoisting up before that fails the lift with reason
  hoist before on the hook.
- Hook: with the hook 3 m off the pickup, the hook call repeats with the not-ready caption. Move it
  over the load: load.attached becomes true, load.mass equals the mission mass, and the LMI reads it.
- Doubling: press a reply during groundTx. The caption garbles, faults go up by one, ground says
  Say again and then repeats the original call.
- ALL STOP: force swayAngle over 10 degrees in the harness. Caption is ALL STOP. E-stop inside 1.5 s
  clears it and the script returns to where it was. Not E-stopping fails the lift with reason
  ignored all stop.
- Full lift: guide to the landing, HOLD arrives near the pad, sway settles, DOWN EASY, slack, THAT'S
  GOOD, unhook, lift.win, end card, Next lift starts mission 1 and the hanging load box disappears
  from the hook.
- Audio graph exists after the tap (AudioContext, three gains into master) and there are no
  exceptions when audio/KEY.ogg is missing.
- Both copies identical. sw.js v16. A live fetch shows v16.

Report: files changed, node fields added, every check above with what you observed, deviations and
why, and what needs James's ear rather than a harness: radio pacing, squelch loudness, machine bed
level.
