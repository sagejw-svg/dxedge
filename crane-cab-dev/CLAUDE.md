# Crane Cab, working rules for Claude Code

Static browser game. First person tower crane cab. Ground talks first. Read README.md, then
js/state.js, js/events.js, js/main.js before changing anything. Source of truth for design and
phases: the Crane Cab page in James's Notion (Design Prompt, Architecture and build order, Backlog).

## Hard rules (never break these)
1. render.js and audio.js read state and never write it.
2. Systems communicate through ctx.bus events, never by importing each other.
3. Missions and radio scripts are data in data/. New content never goes in js/.
4. The tick order in main.js is fixed: input, crane, pendulum, sensors, missions, radio, scoring.
5. No dependencies beyond Three.js from the CDN. No bundler. One static folder.
6. Do not change the shape of state.js without saying so explicitly in your report.
7. Generic crane. No manufacturer names, logos, or copied art.

## Working in phases
- One phase per session. The phase prompt is docs/PHASE-N-PROMPT.md. Edit only the files it lists.
- Verify every line of the Done checklist yourself before reporting. Start a local server with
  `python3 -m http.server 8080` and check the browser console for errors.
- Finish with a short report: files changed, deviations and why, tuning numbers used.
- Never mark a phase done with known console errors.

## Style
- Plain ES modules, no classes unless the module already uses them.
- Comments explain intent and units. SI inside the sim, conversion only in ui.js.
- No em dashes in comments or docs.
