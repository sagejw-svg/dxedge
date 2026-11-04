#!/usr/bin/env python3
"""Sci-Fi (Live): schedule-synced station at /otr/live/scifi and in the /otr station list.

Full catalog episodes only (never cut), no repeat inside 48 hours, announcer
clips only in the gaps. Live listen locks the transport. Volume and the sleep
timer stay available.

Run:  python3 scripts/test_otr_scifi_live.py
"""
import http.server
import os
import socketserver
import subprocess
import threading

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public"))
PORT = 8824
TONE = "/tmp/otr-scifi-tone.mp3"
CHROME = os.environ.get("OTR_CHROMIUM", "/opt/google/chrome/chrome")
BASE = f"http://127.0.0.1:{PORT}"
TIP = "Disabled in live listen mode"


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, *a):
        pass

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/otr":
            self.path = "/otr/index.html"
        return super().do_GET()


def fulfill_mp3(route):
    data = open(TONE, "rb").read()
    rng = route.request.headers.get("range")
    common = {"Content-Type": "audio/mpeg", "Accept-Ranges": "bytes"}
    if rng and rng.startswith("bytes="):
        spec = rng.split("=", 1)[1]
        a, _, b = spec.partition("-")
        start = int(a) if a else 0
        end = int(b) if b else len(data) - 1
        end = min(end, len(data) - 1)
        if start >= len(data) or start > end:
            route.fulfill(status=416, body=b"", headers={"Content-Range": f"bytes */{len(data)}"})
            return
        chunk = data[start:end + 1]
        route.fulfill(status=206, body=chunk, headers={
            **common,
            "Content-Range": f"bytes {start}-{end}/{len(data)}",
            "Content-Length": str(len(chunk)),
        })
        return
    route.fulfill(status=200, body=data, headers={**common, "Content-Length": str(len(data))})


def integrated_lufs(path):
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    val = None
    for line in proc.stderr.splitlines():
        parts = line.strip().split()
        if parts and parts[0] == "I:" and len(parts) >= 2:
            try:
                val = float(parts[1])
            except ValueError:
                pass
    return val


def main():
    speech = [
        "frontend/public/otr/live/scifi/assets/scifi-intro-late-night.mp3",
        "frontend/public/otr/live/scifi/assets/scifi-station-id-1.mp3",
        "frontend/public/otr/live/pack/idents/station-id-1.mp3",
        "frontend/public/otr/live/pack/up-next/suspense.mp3",
        "frontend/public/otr/live/pack/jingle-voice-id.mp3",
    ]
    levels = {os.path.basename(p): integrated_lufs(p) for p in speech}
    quiet = {k: v for k, v in levels.items() if v is None or v < -18.5 or v > -14.5}
    print(("PASS" if not quiet else "FAIL"), "announcer speech is about -16 LUFS", levels if not quiet else quiet)
    if quiet:
        raise SystemExit(1)
    subprocess.check_call([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-f", "lavfi", "-i", "sine=frequency=440:duration=180",
        "-ar", "22050", "-ac", "1", "-b:a", "32k", TONE,
    ])
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", PORT), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    from playwright.sync_api import sync_playwright
    F = []

    def ck(name, cond, detail=""):
        print(("PASS" if cond else "FAIL"), name, ("" if cond else detail))
        if not cond:
            F.append(name)

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROME,
            args=["--autoplay-policy=no-user-gesture-required", "--no-sandbox", "--disable-dev-shm-usage"],
        )

        def open_scifi(tz="America/New_York"):
            ctx = browser.new_context(viewport={"width": 1100, "height": 900}, timezone_id=tz)
            pg = ctx.new_page()
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.route("https://archive.org/**", fulfill_mp3)
            pg.goto(BASE + "/otr/live/scifi/")
            pg.wait_for_function("window.__scifi && __scifi.booted()", timeout=15000)
            return pg, errs, ctx

        pg, errs, ctx = open_scifi()
        ck("standalone /otr/live/scifi boots", not errs and pg.evaluate("__scifi.failed()") == "", (errs, pg.evaluate("__scifi.failed()")))
        audit = pg.evaluate("__scifi.audit()")
        print("   series", audit["shows"], "episodes", audit["episodes"], "cycle_h", round(audit["cycle"] / 3600, 2), "gap", audit["gap"])
        print("   ids", audit["ids"])
        future = pg.evaluate("""() => fetch('/otr/catalog.json').then(r => r.json()).then(c => c.shows.filter(s => (s.ch||[]).indexOf('future')>=0 && !s.adv && s.eps.length).map(s => s.id))""")
        ck("only catalog future-channel series, nothing else", audit["ids"] == future, (audit["ids"], future))
        ck("known science fiction is in, Beyond Tomorrow is not",
           all(x in audit["ids"] for x in ["dimension-x", "x-minus-one", "exploring-tomorrow", "2000-plus", "space-patrol", "tom-corbett-space-cadet"])
           and "beyond-tomorrow" not in audit["ids"] and audit["shows"] >= 6 and audit["episodes"] > 100, audit)
        ck("cycle is one pass, no trimmed episodes, no holes, cues stay inside the gap",
           audit["duplicateEpisodes"] == 0 and audit["trimmed"] == 0 and audit["holes"] == 0 and audit["cueOverrun"] == 0
           and audit["cycle"] > 48 * 3600, audit)
        rt = pg.evaluate("""() => {
          const sod = 20 * 3600 + 125.4;
          const ms = __scifi.unixFor('2026-11-04', sod);
          const w = __scifi.wall(ms);
          return { dateKey: w.dateKey, delta: Math.abs(w.sod - sod) };
        }""")
        ck("Eastern wall clock round-trips", rt["dateKey"] == "2026-11-04" and rt["delta"] < 0.02, rt)
        same = pg.evaluate("""() => {
          const ms = __scifi.unixFor('2026-11-04', 15 * 3600 + 40);
          const a = __scifi.onAir(ms), b = __scifi.onAir(ms);
          return JSON.stringify(a) === JSON.stringify(b) && a.trimmed === false && a.kind === 'show'
            ? a.dur === a.catalogDur : true;
        }""")
        # The instant above might land in a break. Check both cases explicitly.
        spot = pg.evaluate("""() => {
          let ms = __scifi.unixFor('2026-11-04', 12 * 3600);
          let show = null, brk = null;
          for (let i = 0; i < 80 && (!show || !brk); i++) {
            const a = __scifi.onAir(ms);
            const start = ms - a.offset * 1000;
            if (!show && a.kind === 'show' && a.dur > 90) show = start + 20000;
            if (!brk && a.kind === 'break' && a.cues && a.cues[0] && a.cues[0].file === 'scifi-jingle.mp3') brk = start + 400;
            ms = start + a.dur * 1000 + 500;
          }
          const s = __scifi.onAir(show);
          const b = __scifi.onAir(brk);
          const again = __scifi.onAir(show);
          return {
            show: s && s.kind === 'show' && s.trimmed === false && Math.abs(s.dur - s.catalogDur) < 0.01 && Math.abs(s.offset - 20) < 0.05 && !s.cue && !(s.cues && s.cues.length),
            same: JSON.stringify(s) === JSON.stringify(again),
            brk: b && b.kind === 'break' && b.cues && b.cues.length && b.cues[0].file === 'scifi-jingle.mp3' && b.cue && b.cue.file === 'scifi-jingle.mp3',
            parts: b && b.cues.every(c => c.file.indexOf('jingle-music') < 0 && c.file.indexOf('voice-tag') < 0),
            showMs: show, brkMs: brk, showId: s && s.showId, offset: s && s.offset
          };
        }""")
        ck("a show plays its full catalog length and is deterministic", spot["show"] and spot["same"], spot)
        ck("a break opens with the combined jingle, not the separate parts", spot["brk"] and spot["parts"], spot)

        window = pg.evaluate("""() => {
          const start = __scifi.unixFor('2026-06-15', 3 * 3600);
          const shows = __scifi.showsIn(start, 48 * 3600);
          const seen = {};
          let dup = null;
          shows.forEach(s => { const k = s.showId + ':' + s.epIndex; if (seen[k]) dup = k; seen[k] = 1; });
          const breaks = __scifi.breaksIn(start, 36 * 3600);
          const files = {};
          let evening = 0, late = 0, neither = 0, overrun = 0, badPart = 0;
          const ids = [];
          breaks.forEach(b => {
            let end = 0;
            (b.cues || []).forEach(c => {
              files[c.file] = 1;
              end = Math.max(end, c.at0 + c.dur);
              if (c.type === 'time_intro' && c.file.indexOf('evening') >= 0) evening++;
              if (c.type === 'time_intro' && c.file.indexOf('late') >= 0) late++;
              if (/jingle-music|voice-tag/.test(c.file)) badPart++;
              if (c.type === 'station_id') ids.push(c.file);
            });
            if (!(b.cues || []).some(c => c.type === 'time_intro')) neither++;
            if (end > b.dur + 0.001) overrun++;
          });
          const idSet = {};
          ids.slice(0, 8).forEach(f => { idSet[f] = 1; });
          return { n: shows.length, dup, evening, late, neither, overrun, badPart, idKinds: Object.keys(idSet).length, breakN: breaks.length };
        }""")
        ck("no episode repeats inside 48 hours", window["n"] > 20 and not window["dup"], window)
        ck("evening and late-night intros play, and only from the gap",
           window["evening"] >= 1 and window["late"] >= 1 and window["neither"] > 5 and window["overrun"] == 0 and window["badPart"] == 0, window)
        ck("station ids rotate", window["idKinds"] >= 2, window)

        pg2, errs2, ctx2 = open_scifi("America/Los_Angeles")
        ms = spot["showMs"]
        a_ny = pg.evaluate("(ms) => __scifi.onAir(ms)", ms)
        a_la = pg2.evaluate("(ms) => __scifi.onAir(ms)", ms)
        ck("two time zones hear the same episode at the same offset",
           a_ny["showId"] == a_la["showId"] and a_ny["epIndex"] == a_la["epIndex"] and abs(a_ny["offset"] - a_la["offset"]) < 0.05,
           (a_ny["showId"], a_la["showId"], a_ny["offset"], a_la["offset"]))

        pg.evaluate("(ms) => __scifi.setClock(ms)", spot["showMs"])
        pg.click("#sfMute")
        pg.wait_for_function("""() => {
          const a = document.getElementById('sfAudio');
          return a && !a.paused && a.currentTime > 12 && a.currentTime < 32 && (a.currentSrc || a.src).indexOf('archive.org') >= 0;
        }""", timeout=8000)
        heard = pg.evaluate("() => { const a = document.getElementById('sfAudio'); return { t: a.currentTime, src: a.currentSrc || a.src, rate: a.playbackRate, paused: a.paused }; }")
        ck("listen joins the live offset of the episode at 1x", 12 < heard["t"] < 32 and heard["rate"] == 1 and "archive.org" in heard["src"], heard)
        pg.evaluate("(ms) => __scifi.setClock(ms)", spot["brkMs"])
        pg.wait_for_function("""() => {
          const src = document.getElementById('sfAudio').currentSrc || '';
          return src.indexOf('scifi-jingle.mp3') >= 0;
        }""", timeout=8000)
        ck("the break plays an announcer clip and does not keep the episode",
           "scifi-jingle.mp3" in pg.evaluate("document.getElementById('sfAudio').currentSrc"))
        tail = pg.evaluate("""(ms) => {
          const a = __scifi.onAir(ms);
          const cues = (a && a.cues) || [];
          const last = cues[cues.length - 1];
          if (!last) return { at: 0, after: 0 };
          return { at: a.startMs + Math.round(last.at0 * 1000) + 200, after: a.startMs + Math.round(a.dur * 1000) + 400 };
        }""", spot["brkMs"])
        pg.evaluate("(ms) => __scifi.setClock(ms)", tail["at"])
        pg.wait_for_timeout(600)
        # The break is over on the clock while the clip is still speaking.
        # Playback must finish the clip, then start the episode, and not go silent.
        pg.evaluate("(ms) => __scifi.setClock(ms)", tail["after"])
        pg.wait_for_function("""() => {
          const a = document.getElementById('sfAudio');
          const src = a.currentSrc || a.src || '';
          return !a.paused && src.indexOf('archive.org') >= 0;
        }""", timeout=15000)
        ck("when the last announcer clip ends, the episode starts and playback stays up",
           not pg.evaluate("document.getElementById('sfAudio').paused") and "archive.org" in pg.evaluate("document.getElementById('sfAudio').currentSrc"))
        fit = pg.evaluate("""() => {
          const rows = __scifi.breaksIn(__scifi.unixFor('2026-11-04', 0), 36 * 3600);
          const bad = rows.filter(b => (b.cues || []).reduce((s, c) => s + c.dur, 0) > b.dur + 0.05);
          return { n: rows.length, bad: bad.length };
        }""")
        ck("sci-fi cues fit inside the gap and are not scheduled into the episode", fit["n"] > 10 and fit["bad"] == 0, fit)
        morning = pg.evaluate("""() => {
          const start = __scifi.unixFor('2026-11-04', 9 * 3600);
          const end = start + 45 * 60 * 1000;
          const rows = [];
          let ms = start, prev = '', silence = 0, worst = 0, bad = [];
          while (ms < end) {
            const a = __scifi.onAir(ms);
            const w = __scifi.wall(ms);
            const ap = w.hour < 12 ? 'AM' : 'PM';
            let hh = w.hour % 12; if (!hh) hh = 12;
            const p2 = n => (n < 10 ? '0' : '') + n;
            const clock = hh + ':' + p2(w.minute) + ':' + p2(Math.floor(w.second)) + ' ' + ap + ' ET';
            let label;
            if (a.kind === 'show') {
              silence = 0;
              label = 'SHOW ' + a.show + ' | ' + (a.title || '') + ' | ' + (a.date || '');
            } else {
              const cue = a.cue;
              if (!cue) { silence += 1; if (silence > worst) worst = silence; }
              else silence = 0;
              if (cue && cue.type === 'up_next' && cue.showId && cue.showId !== a.nextShowId)
                bad.push(cue.file + ' before ' + a.nextShowId);
              if (cue && /scifi-up-next-/.test(cue.file || '')) bad.push('generic ' + cue.file);
              const name = cue ? cue.file : 'SILENCE';
              label = 'BREAK ' + a.dur.toFixed(0) + 's now=' + name + ' next=' + (a.nextShow || '');
            }
            if (label !== prev) { rows.push(clock + '  ' + label); prev = label; }
            ms += 1000;
          }
          return { rows: rows, worst: worst, bad: bad };
        }""")
        print("   Sci-Fi 6:00-6:45 AM PT:")
        for row in morning["rows"]:
            print("   " + row)
        ck("sci-fi morning gaps stay within a few seconds of silence", morning["worst"] <= 4, morning["worst"])
        ck("sci-fi up-next names the series that plays next, not a generic line", not morning["bad"], morning["bad"])
        pg.evaluate("(ms) => __scifi.setClock(ms)", spot["showMs"])
        pg.wait_for_function("""() => (document.getElementById('sfAudio').currentSrc || '').indexOf('archive.org') >= 0 && document.getElementById('sfAudio').currentTime > 12""", timeout=8000)
        before = pg.evaluate("() => ({ id: __scifi.onAir().showId, t: document.getElementById('sfAudio').currentTime })")
        pg.evaluate("document.getElementById('sfAudio').currentTime = 1")
        pg.wait_for_function("() => document.getElementById('sfAudio').currentTime > 12", timeout=4000)
        after = pg.evaluate("document.getElementById('sfAudio').currentTime")
        ck("a seek is pulled back to the live offset", after > 12, (before, after))
        pg.click("#sfMute")
        muted = pg.evaluate("() => { const a = document.getElementById('sfAudio'); return { muted: a.muted, paused: a.paused, label: document.getElementById('sfMute').textContent }; }")
        ck("Mute silences without pausing", muted["muted"] and not muted["paused"] and muted["label"] == "Unmute", muted)
        pg.fill("#sfVol", "0.3")
        ck("volume stays under the listener's control", abs(pg.evaluate("document.getElementById('sfAudio').volume") - 0.3) < 0.02)
        locks = pg.evaluate("""() => ['sfPrev','sfBack','sfFwd','sfSkip','sfSurprise','sfCopy','sfRate'].map(id => {
          const el = document.getElementById(id);
          return { id, disabled: el.disabled, title: el.title };
        })""")
        ck("skip, seek, speed, surprise and copy are disabled in live listen mode",
           all(x["disabled"] and x["title"] == "Disabled in live listen mode" for x in locks), locks)
        ck("the sleep timer is still there", pg.locator("#sfSleep").is_enabled())
        pg.select_option("#sfSleep", "15")
        pg.wait_for_function("() => (document.getElementById('sfStatus').textContent || '').indexOf('left') >= 0", timeout=3000)
        ck("sleep timer counts down while the broadcast continues",
           "left" in pg.inner_text("#sfStatus") and not pg.evaluate("document.getElementById('sfAudio').paused"))
        text = pg.inner_text("#otr-scifi")
        ck("page copy has no em dash", "\u2014" not in text and "\u2013" not in text)

        live = browser.new_page()
        live.goto(BASE + "/otr/live/")
        live.wait_for_selector("a[href='/otr/live/scifi']", timeout=10000)
        ck("Listenotr Radio links to Sci-Fi (Live)", live.locator("a[href='/otr/live/scifi']").inner_text() == "Sci-Fi (Live)")

        host = browser.new_context(viewport={"width": 1100, "height": 900}, timezone_id="America/New_York")
        host.add_init_script("localStorage.setItem('otr_rate','1.5')")
        main = host.new_page()
        merrs = []
        main.on("pageerror", lambda e: merrs.append(str(e)))
        main.route("https://archive.org/**", fulfill_mp3)
        main.goto(BASE + "/otr/index.html")
        main.wait_for_function("""() => window.__scifi && __scifi.booted() && document.querySelector('#networkChips .station[data-net=scifi] .st-now') && document.querySelector('#networkChips .station[data-net=scifi] .st-now').textContent.trim()""", timeout=20000)
        order = main.eval_on_selector_all("#networkChips .station", "els => els.map(e => e.dataset.net)")
        name = main.eval_on_selector("#networkChips .station[data-net=scifi] .st-name", "e => e.textContent")
        ck("Sci-Fi (Live) sits in the station list after Listenotr Radio",
           order and order[0] == "listenotr" and "scifi" in order and name.startswith("Sci-Fi (Live)"), (order, name))
        main.evaluate("(ms) => __scifi.setClock(ms)", spot["showMs"])
        main.locator("#networkChips .station[data-net=scifi]").click()
        main.wait_for_function("""() => {
          const a = document.getElementById('audio');
          return __otr.state.network === 'scifi' && __scifi.armed() && a && !a.paused && a.playbackRate === 1 && a.currentTime > 8;
        }""", timeout=10000)
        ui = main.evaluate("""() => {
          const ids = ['prevBtn','backBtn','fwdBtn','skipBtn','linkBtn','randomBtn','moreRandom','dockSkip'];
          const locks = ids.map(id => { const el = document.getElementById(id); return { id, disabled: !!el && el.disabled, title: el && el.title }; });
          const rate = document.getElementById('rateSel');
          const bar = document.getElementById('bar');
          const play = document.getElementById('playBtn');
          return {
            locks,
            rateDisabled: rate.disabled, rateTitle: rate.title, rateValue: rate.value,
            barTitle: bar.title,
            vol: !document.getElementById('vol').disabled,
            sleep: !document.getElementById('sleepSel').disabled,
            play: play.textContent, rate: document.getElementById('audio').playbackRate,
            paused: document.getElementById('audio').paused
          };
        }""")
        ck("live locks disable skip, seek, prev, 15s, surprise and copy",
           all(x["disabled"] and x["title"] == TIP for x in ui["locks"]) and ui["barTitle"] == TIP, ui)
        ck("speed is forced to 1 and shown disabled",
           ui["rateDisabled"] and ui["rateTitle"] == TIP and ui["rateValue"] == "1" and ui["rate"] == 1, ui)
        main.wait_for_function("() => document.getElementById('playBtn').textContent.indexOf('Mute') >= 0 && document.getElementById('playBtn').textContent.indexOf('Pause') < 0", timeout=3000)
        ui2 = main.evaluate("() => ({ play: document.getElementById('playBtn').textContent, vol: !document.getElementById('vol').disabled, sleep: !document.getElementById('sleepSel').disabled, paused: document.getElementById('audio').paused })")
        ck("volume and sleep timer stay enabled, and the play control is Mute",
           ui["vol"] and ui["sleep"] and ui2["vol"] and ui2["sleep"] and "Mute" in ui2["play"] and "Pause" not in ui2["play"] and not ui2["paused"], ui2)
        main.evaluate("""() => {
          const s = document.getElementById('rateSel');
          s.disabled = false;
          s.value = '1.5';
          s.dispatchEvent(new Event('change', { bubbles: true }));
        }""")
        main.wait_for_timeout(500)
        ck("choosing another speed does not stick",
           main.evaluate("document.getElementById('audio').playbackRate") == 1 and main.evaluate("document.getElementById('rateSel').value") == "1")
        show_id = main.evaluate("__scifi.onAir().showId")
        main.locator("#skipBtn").click(force=True)
        main.locator("#fwdBtn").click(force=True)
        main.evaluate("document.getElementById('bar').click()")
        ck("skip, 15s and the bar do not leave the episode", main.evaluate("__scifi.onAir().showId") == show_id and main.evaluate("__otr.state.network") == "scifi")
        main.locator("#playBtn").click()
        mute = main.evaluate("() => { const a = document.getElementById('audio'); return { muted: a.muted, paused: a.paused, label: document.getElementById('playBtn').textContent }; }")
        ck("the main play control mutes instead of pausing", mute["muted"] and not mute["paused"] and "Unmute" in mute["label"], mute)
        main.fill("#vol", "0.4")
        ck("main player volume still works", abs(main.evaluate("document.getElementById('audio').volume") - 0.4) < 0.02)
        main.locator("#moreBtn").click()
        main.select_option("#sleepSel", "15")
        main.wait_for_function("() => (document.getElementById('sleepLeft').textContent || '').indexOf('left') >= 0", timeout=3000)
        ck("main sleep timer runs during Sci-Fi (Live)", "left" in main.inner_text("#sleepLeft") and not main.evaluate("document.getElementById('audio').paused"))
        main.evaluate("__otr.sleepIn(800)")
        main.wait_for_function("() => document.getElementById('audio').paused && !__scifi.want()", timeout=4000)
        main.wait_for_timeout(700)
        ck("sleep timer stops playback and the live clock does not restart it",
           main.evaluate("document.getElementById('audio').paused") and not main.evaluate("__scifi.want()"))
        main.locator("#channelChips .station").first.click()
        main.wait_for_function("() => !__scifi.armed() && __otr.state.network !== 'scifi'", timeout=8000)
        ck("leaving the station releases the live locks",
           not main.evaluate("__scifi.armed()") and not main.evaluate("document.getElementById('skipBtn').disabled"))
        ck("no page errors on the player", not merrs, merrs)
        ctx.close()
        ctx2.close()
        host.close()

    print("\n%d failures" % len(F), F)
    raise SystemExit(1 if F else 0)


if __name__ == "__main__":
    main()
