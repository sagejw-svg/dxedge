# Nightly automation runbook

This is the exact loop the nightly Crane Cab scheduled task follows. It was
established and verified working on 2026-09-05. Follow it precisely; it's
been tested end to end, not guessed at.

## 0. Orient

- Read `STATUS.md` in this folder for the current/next phase.
- Read the "Crane Cab" Notion page (search title "Crane Cab" in Notion) for
  full Architecture, the phase table, Backlog, and Changelog. That page is
  the design source of truth; this folder is the code source of truth.
- Read `CLAUDE.md` in this folder for the hard rules. They do not change
  phase to phase. Never violate them to make a phase's Done checklist pass.

## 1. Get the repo

```
git clone https://github.com/sagejw-svg/dxedge.git
```

Public repo, no auth needed to clone. Auth is only needed to push (step 5).
The GitHub PAT lives in Mem.ai as the note titled "DXEdge - GitHub &
Credentials" (search Mem for it) — as of 2026-09-05 it has no expiration
despite an old, wrong "~August 27 2026" line in that same note; if it
somehow fails, that note's expiry line is not to be trusted at face value,
treat an actual 401/403 from GitHub as the real signal, not the note.

## 2. Do the work

Work only inside `crane-cab-dev/`. Edit only the files the current phase
prompt allows. If the next phase doesn't have a `docs/PHASE-N-PROMPT.md`
yet, draft one from the Notion Architecture section's file layout and the
phase table row, following the same shape as `docs/PHASE-1-PROMPT.md`
(scope, allowed files, hard rules repeated, a concrete Done checklist).
Save it into `crane-cab-dev/docs/` before implementing against it.

If all numbered phases (0-6) are done, work Notion Backlog items instead —
see the bottom of `STATUS.md` for which list to pull from.

One phase or one backlog item per run. Do not chain multiple in one
session even if there's time left; a fresh run tomorrow is cheaper to
review and revert than a big diff.

## 3. Verify — do not skip this, do not just eyeball the code

**Run the suite first. It is committed, it needs nothing but node, and every
check in it is a bug that was once live:**

```
node test/regress.mjs        # 65 checks, no browser, a few seconds
bash test/run.sh             # the above plus the browser smoke test
```

`test/run.sh` skips the browser half when playwright is not importable from
the repo, and says so. Do not read that SKIP as a pass. If the sandbox has a
global playwright, symlink it in for the run, and if index.html's CDN import
of three.js is blocked, take the copy the smoke test's header describes and
point `PAGE` at a local-import-map copy of index.html. The browser half is
where render.js, ui.js and the console layout are covered, and it is the only
place a device-pixel-ratio bug can be seen at all.

If anything in `test/regress.mjs` fails, stop. Do not deploy, and do not
"fix" the test to make it pass without understanding which real behaviour
changed. When a phase adds behaviour, add checks for it there; when a bug is
found and fixed, add the check that would have caught it. That file is the
cheapest thing in this project and it has already caught regressions that a
careful read of the diff did not.

Then do the browser pass below as well - the suite has no DOM, so it cannot
see rendering, layout or input.

This is a static ES-module site, so `file://` will not work (CORS blocks
the module imports). Serve it and drive a real browser against it:

```
cd crane-cab-dev && python3 -m http.server 8080 &
```

Then use Playwright with the pre-installed Chromium
(`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, headless, launch args
`['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']`) to:

- Load `http://127.0.0.1:8080/index.html`, capture console messages,
  page errors, and failed requests.
- Click `#btn-start` to get past the title card.
- Press F3, then simulate the actual documented key map from
  `js/input.js`'s header comment (A/D/W/S/R/F/Shift/Ctrl/Space/T/H/B/C/1-8) —
  don't guess a key map, read it from the file, it changes as phases add
  controls.
- Read `#debug`'s text content and assert the values that phase's Done
  checklist calls for actually change (e.g. Phase 1: slew/trolley/hook
  height move when you hold the keys — if they don't, the phase failed,
  full stop, do not deploy).
- Take a screenshot for the notification.

Expect one console noise source that is NOT a bug: this sandbox's network
proxy can drop the Three.js CDN fetch from cdn.jsdelivr.net with
`net::ERR_CONNECTION_RESET`. If that happens, download the file with curl
(that path works) into a throwaway `vendor/three.module.js` next to a
*copy* of `index.html` with the import map pointed at it, just for this
local check — never commit that swap, the real `index.html` must keep the
CDN import so it works for actual site visitors.

If verification fails, fix it in this same run before moving on. If you
truly cannot get it working, do not deploy — commit nothing, push nothing,
and say so plainly in the notification with what broke and what you tried.

## 4. Deploy

The published build carries the commit it was built from: the deploy workflow
rewrites `data/build.js` in the mirror only, and the title card shows it in the
bottom right. Never commit a stamped `build.js` back into the repo; the
committed value stays `sha: 'dev'`. If the placeholder strings there ever
change, `test/regress.mjs` fails before the deploy does.

Copy the runtime files only (not `CLAUDE.md`, not `docs/`, not `.claude/`,
not this file, not `STATUS.md`) from `crane-cab-dev/` into
`frontend/public/crane-cab/` at the repo root:

```
cp crane-cab-dev/index.html frontend/public/crane-cab/
cp -r crane-cab-dev/css crane-cab-dev/js crane-cab-dev/data crane-cab-dev/audio \
      frontend/public/crane-cab/
```

`tools/` does not ship. `audio/` does: those are the ground crew's voice
clips, and `data/clips.js` holds their lengths, which is what `radio.js`
sizes a transmission from. Re-record a line with `tools/voice.py` and that
table is rewritten from the encoded files, so the two can never drift; a
clip added to the tables in that script and never rendered fails
`test/regress.mjs` rather than a lift.

Bump `frontend/public/sw.js`'s `CACHE_NAME` by one (e.g. `dxedge-v10` ->
`dxedge-v11`) so returning visitors actually get the new build instead of
the cached one.

Sanity-build before pushing (this repo builds on GitHub Actions the same
way):

```
cd frontend && npm ci && npm run build
```

A clean build is a precondition to push. If it fails, stop, fix it, or
back out and report — do not push a broken build to a live site.

## 5. Commit and push

```
git add crane-cab-dev frontend/public/crane-cab frontend/public/sw.js
git commit -m "..."
git -c http.extraHeader="Authorization: Basic $(printf 'x-access-token:PAT' | base64 -w0)" push origin main
```

(substitute the real PAT for `PAT`). This triggers GitHub Actions
(`.github/workflows/deploy.yml`), which builds again on the runner, SCPs to
the droplet, and restarts nginx — usually live within a few minutes. `api.github.com`
is blocked in this sandbox so there's no way to poll the Actions run status
directly; instead, after pushing, poll `https://dxedge.net/sw.js` for the
new `CACHE_NAME` value with WebFetch (not raw curl to an external host —
that gets blocked by the sandbox's action classifier) until it flips, then
WebFetch `https://dxedge.net/crane-cab/index.html` and `/api/health` to
confirm the live site actually reflects this run's change.

## 6. Update the record

- `crane-cab-dev/STATUS.md`: bump "last completed phase" / note which
  backlog item was taken.
- Notion Crane Cab page Changelog (append, don't rewrite): what shipped,
  any deviation from the phase prompt or backlog item and why, tuning
  numbers used, and anything that needs James to personally play-test
  (physics feel, especially the Phase 2 pendulum and Phase 5 phone
  controls — an automated check can confirm values change and nothing
  crashes, it cannot judge whether swinging a load feels right).

## 7. Notify

Summarize in the session's own response (this is what the push/email
notification surfaces): phase or backlog item done, what changed, the
verification screenshot, the live link, and — loudly, not buried — anything
that needs James's own hands-on check before it should be trusted.
