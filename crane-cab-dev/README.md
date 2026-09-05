# Crane Cab

Standalone browser game. First person tower crane cab. Ground talks first.

Entertainment only. Not operator training. Generic crane, no manufacturer names or logos.

## Run locally

ES modules need http, not file://. From this folder:

    python3 -m http.server 8080

Open http://localhost:8080. Press F3 for the debug overlay, Escape to pause.

## Deploy

Upload this folder to dxedge.org as `/` or `/crane/`. Nothing to build. Three.js loads from jsdelivr.

## Layout

    index.html         entry, import map, console DOM
    css/game.css       cab palette and console layout
    js/main.js         boot, fixed step loop, tick order
    js/state.js        single GameState. Read the comments before touching anything.
    js/events.js       pub/sub. Systems talk through this.
    js/input.js        devices -> intent            (Phase 1)
    js/crane.js        slew / trolley / hoist        (Phase 1)
    js/pendulum.js     load swing, slack, tension   (Phase 2)
    js/sensors.js      gauges, LMI, A2B, collision  (Phase 2)
    js/radio.js        radio director               (Phase 3)
    js/missions.js     loader and win / fail rules  (Phase 3, 4)
    js/scoring.js      metrics, grade, achievements (Phase 4)
    js/save.js         localStorage                 (Phase 4)
    js/audio.js        Web Audio buses              (Phase 3)
    js/render.js       Three.js scene, read only
    js/ui.js           console, captions, cards, F3 overlay, read only
    data/missions.js   mission definitions
    data/radio.js      radio scripts
    audio/             processed radio clips, one per say key

## Hard rules

1. Render and audio never write state.
2. Systems communicate through the bus, never by calling each other.
3. Missions and radio scripts are data. New content goes in data/, not js/.
4. Tick order in main.js is fixed: input, crane, pendulum, sensors, missions, radio, scoring.
5. No dependencies beyond Three.js.

## Status

Phase 0 complete: scaffold, loop, state, bus, placeholder scene, console DOM, F3 overlay.
Next: Phase 1, see docs/PHASE-1-PROMPT.md.

Claude Code: CLAUDE.md carries the hard rules and is read automatically. `.claude/agents/phase-reviewer.md`
is a reviewer subagent pinned to Opus; ask for it by name after each phase.
