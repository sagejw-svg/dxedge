#!/usr/bin/env python3
"""End-of-episode sleep on the OTR player.

The sleep menu keeps off / 15 / 30 / 60. "end of episode" stops when the
current episode finishes and does not start the next one. A duration or Off
cancels it, and choosing it cancels a running duration. Sci-Fi (Live) uses the
same choice without unlocking live controls.

Run: python3 scripts/test_otr_sleep_end.py
"""
import http.server
import os
import socketserver
import subprocess
import threading

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public"))
PORT = 8799
TONE = "/tmp/otr-sleep-end-tone.mp3"
CHROME = os.environ.get("OTR_CHROMIUM", "/opt/google/chrome/chrome")
BASE = f"http://127.0.0.1:{PORT}"
TIP = "Disabled in live listen mode"
SHOT = os.environ.get("OTR_SLEEP_SHOT", "/tmp/otr_sleep_end_mobile.png")


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, *a):
        pass

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n:
            self.rfile.read(n)
        self.send_response(204)
        self.end_headers()


def fulfill_mp3(route):
    data = open(TONE, "rb").read()
    rng = route.request.headers.get("range")
    common = {
        "Content-Type": "audio/mpeg",
        "Accept-Ranges": "bytes",
        "Access-Control-Allow-Origin": "*",
    }
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


def main():
    subprocess.check_call([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-f", "lavfi", "-i", "sine=frequency=440:duration=25",
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

    def choose(pg, value):
        if pg.locator("#moreBtn").count() and not pg.is_visible("#morePanel"):
            pg.click("#moreBtn")
        pg.select_option("#sleepSel", value)

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROME,
            args=["--autoplay-policy=no-user-gesture-required", "--no-sandbox", "--disable-dev-shm-usage"],
        )
        ctx = browser.new_context(viewport={"width": 1100, "height": 900})
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.route("https://archive.org/**", fulfill_mp3)
        pg.goto(BASE + "/otr/?season=off")
        pg.wait_for_function("window.__otr && __otr.ready()", timeout=20000)
        opts = pg.eval_on_selector_all("#sleepSel option", "els => els.map(e => e.value + '=' + e.textContent)")
        ck("sleep menu keeps off, 15, 30, 60 and adds end of episode",
           opts == ["off=off", "15=15 min", "30=30 min", "60=60 min", "end=end of episode"], opts)

        pg.evaluate("__otr.playEpisode('x-minus-one', 0)")
        pg.wait_for_function(
            """() => { const a = document.getElementById('audio');
              return a && !a.paused && a.currentTime > 0.3 && isFinite(a.duration) && a.duration > 5; }""",
            timeout=20000)
        base = pg.evaluate("document.getElementById('audio').volume")
        qi = pg.evaluate("__otr.state.qi")

        choose(pg, "15")
        pg.wait_for_timeout(1100)
        left = pg.inner_text("#sleepLeft")
        ck("timed sleep still counts down", left.startswith("14:") or left.startswith("15:"), left)
        pg.evaluate("__otr.sleepIn(3500)")
        pg.wait_for_timeout(400)
        faded = pg.evaluate("document.getElementById('audio').volume")
        ck("timed sleep still fades", faded < base * 0.5, (faded, base))
        pg.wait_for_function("document.getElementById('audio').paused", timeout=8000)
        ck("timed sleep still stops and clears",
           pg.evaluate("document.getElementById('audio').paused")
           and pg.evaluate("__otr.sleepMode()") == "off"
           and pg.input_value("#sleepSel") == "off"
           and pg.inner_text("#sleepLeft") == ""
           and abs(pg.evaluate("document.getElementById('audio').volume") - base) < 0.05)
        pg.wait_for_timeout(1200)
        ck("timed sleep does not start playback again", pg.evaluate("document.getElementById('audio').paused"))
        pg.click("#playBtn")
        pg.wait_for_function("!document.getElementById('audio').paused && document.getElementById('audio').currentTime > 0.2", timeout=8000)

        choose(pg, "15")
        pg.evaluate("__otr.sleepIn(1200)")
        choose(pg, "end")
        label = pg.inner_text("#sleepLeft")
        ck("end of episode cancels the duration and says so",
           pg.evaluate("__otr.sleepMode()") == "end"
           and "after this episode" in label and "left" not in label
           and abs(pg.evaluate("document.getElementById('audio').volume") - base) < 0.05, label)
        pg.wait_for_timeout(2500)
        ck("the cancelled duration does not stop playback",
           not pg.evaluate("document.getElementById('audio').paused") and pg.evaluate("__otr.sleepMode()") == "end")

        choose(pg, "60")
        pg.wait_for_function("() => (__otr.sleepMode()==='60') && (document.getElementById('sleepLeft').textContent||'').indexOf('left')>=0", timeout=3000)
        ck("a duration cancels end of episode",
           pg.evaluate("__otr.sleepMode()") == "60" and "left" in pg.inner_text("#sleepLeft"))
        choose(pg, "off")
        ck("off cancels the timer",
           pg.evaluate("__otr.sleepMode()") == "off" and pg.inner_text("#sleepLeft") == ""
           and not pg.evaluate("document.getElementById('audio').paused"))

        choose(pg, "end")
        choose(pg, "off")
        qi = pg.evaluate("__otr.state.qi")
        pg.evaluate("(a => { a.currentTime = Math.max(0, a.duration - 0.4); })(document.getElementById('audio'))")
        pg.wait_for_function("__otr.state.qi !== %d" % qi, timeout=10000)
        ck("off really leaves end mode, so the episode can advance", pg.evaluate("__otr.state.qi") != qi)
        pg.wait_for_function(
            """() => { const a = document.getElementById('audio');
              return a && !a.paused && a.currentTime > 0.2 && isFinite(a.duration) && a.duration > 5; }""",
            timeout=15000)

        choose(pg, "end")
        qi = pg.evaluate("__otr.state.qi")
        title = pg.evaluate("__otr.currentInfo().title")
        pg.evaluate("(a => { a.currentTime = Math.max(0, a.duration - 4); })(document.getElementById('audio'))")
        pg.wait_for_function("__otr.state.cueNext === true && document.getElementById('audio').paused", timeout=12000)
        stopped = pg.evaluate("""() => ({
          paused: document.getElementById('audio').paused,
          qi: __otr.state.qi,
          title: __otr.currentInfo().title,
          mode: __otr.sleepMode(),
          sel: document.getElementById('sleepSel').value,
          status: document.getElementById('onairText').textContent.toLowerCase(),
          vol: document.getElementById('audio').volume
        })""")
        ck("end of episode stops on this episode",
           stopped["paused"] and stopped["qi"] == qi and stopped["title"] == title
           and stopped["mode"] == "off" and stopped["sel"] == "off" and stopped["status"] == "paused"
           and abs(stopped["vol"] - base) < 0.05, stopped)
        pg.wait_for_timeout(2000)
        held = pg.evaluate("""() => ({
          paused: document.getElementById('audio').paused,
          qi: __otr.state.qi,
          title: __otr.currentInfo().title
        })""")
        ck("it does not autoplay the next episode",
           held["paused"] and held["qi"] == qi and held["title"] == title, held)
        pg.click("#playBtn")
        pg.wait_for_function("__otr.state.qi !== %d && !document.getElementById('audio').paused" % qi, timeout=15000)
        ck("play is what moves on after end-of-episode sleep", pg.evaluate("__otr.state.qi") != qi)
        ck("no page errors on the main player", not errs, errs)

        pg.set_viewport_size({"width": 390, "height": 844})
        if not pg.is_visible("#morePanel"):
            pg.click("#moreBtn")
        pg.select_option("#sleepSel", "end")
        lay = pg.evaluate("""() => {
          const panel = document.getElementById('morePanel');
          const sel = document.getElementById('sleepSel');
          const row = sel.closest('.mrow');
          const pr = panel.getBoundingClientRect();
          const sr = sel.getBoundingClientRect();
          const rr = row.getBoundingClientRect();
          const cs = getComputedStyle(panel);
          return {
            scroll: document.documentElement.scrollWidth,
            fixed: cs.position,
            panelLeft: pr.left, panelRight: pr.right,
            selLeft: sr.left, selRight: sr.right, selW: sr.width,
            rowH: rr.height,
            value: sel.value,
            text: document.getElementById('sleepLeft').textContent
          };
        }""")
        ck("mobile sheet still fits, with end of episode selected",
           lay["scroll"] <= 390 and lay["fixed"] == "fixed" and lay["panelLeft"] <= 1
           and lay["selRight"] <= 391 and lay["selLeft"] >= 0 and lay["selW"] > 40
           and 40 <= lay["rowH"] <= 80 and lay["value"] == "end"
           and "after this episode" in lay["text"], lay)
        os.makedirs(os.path.dirname(SHOT), exist_ok=True)
        pg.locator("#morePanel").screenshot(path=SHOT)

        # Sci-Fi (Live), standalone page: end of episode and a timed-sleep regression.
        sp = ctx.new_page()
        serrs = []
        sp.on("pageerror", lambda e: serrs.append(str(e)))
        sp.route("https://archive.org/**", fulfill_mp3)
        sp.goto(BASE + "/otr/live/scifi/")
        sp.wait_for_function("window.__scifi && __scifi.booted()", timeout=20000)
        spot = sp.evaluate("""() => {
          let ms = __scifi.unixFor('2026-11-04', 15 * 3600);
          for (let i = 0; i < 80; i++) {
            const a = __scifi.onAir(ms);
            const start = a.startMs, end = start + a.dur * 1000;
            if (a.kind === 'show' && a.dur > 120) {
              const into = start + 12000, brk = end + 300;
              if (__scifi.onAir(brk).kind === 'break') return { into: into, brk: brk };
            }
            ms = end + 50;
          }
          return null;
        }""")
        ck("sci-fi page found a show with a break after it", bool(spot), spot)
        sp.evaluate("(ms) => __scifi.setClock(ms)", spot["into"])
        sp.click("#sfMute")
        sp.wait_for_function("() => __scifi.want() && !document.getElementById('sfAudio').paused", timeout=8000)
        sp.select_option("#sfSleep", "15")
        sp.wait_for_function("() => (document.getElementById('sfStatus').textContent || '').indexOf('left') >= 0", timeout=3000)
        sp.evaluate("() => { window.__scifiSleep.until = Date.now() + 700 }")
        sp.select_option("#sfSleep", "end")
        end_label = sp.inner_text("#sfStatus")
        ck("sci-fi page: end cancels the countdown",
           sp.evaluate("window.__scifiSleep.mode") == "end" and "end of this episode" in end_label.lower() and "left" not in end_label.lower(),
           end_label)
        sp.wait_for_timeout(1500)
        ck("sci-fi page: cancelled duration does not stop the broadcast",
           sp.evaluate("__scifi.want()") and not sp.evaluate("document.getElementById('sfAudio').paused"))
        sp.select_option("#sfSleep", "30")
        sp.wait_for_function("() => (document.getElementById('sfStatus').textContent || '').indexOf('left') >= 0", timeout=3000)
        ck("sci-fi page: a duration replaces end of episode", sp.evaluate("window.__scifiSleep.mode") == "30")
        sp.select_option("#sfSleep", "end")
        sp.evaluate("(ms) => __scifi.setClock(ms)", spot["brk"])
        sp.wait_for_function("() => !__scifi.want() && document.getElementById('sfAudio').paused", timeout=4000)
        sp.wait_for_timeout(1500)
        locks = sp.evaluate("""() => ['sfPrev','sfBack','sfFwd','sfSkip','sfSurprise','sfCopy','sfRate'].map(id => {
          const el = document.getElementById(id); return el.disabled && el.title === 'Disabled in live listen mode';
        })""")
        ck("sci-fi page: stops at the end and does not play on",
           not sp.evaluate("__scifi.want()") and sp.evaluate("document.getElementById('sfAudio').paused")
           and sp.input_value("#sfSleep") == "off"
           and "stopped at the end of the episode" in sp.inner_text("#sfStatus").lower(),
           sp.inner_text("#sfStatus"))
        ck("sci-fi page: live locks stay disabled", all(locks), locks)
        sp.click("#sfMute")
        sp.wait_for_function("() => __scifi.want() && !document.getElementById('sfAudio').paused", timeout=8000)
        sp.select_option("#sfSleep", "15")
        sp.wait_for_function("() => (document.getElementById('sfStatus').textContent || '').indexOf('left') >= 0", timeout=3000)
        sp.evaluate("() => { window.__scifiSleep.until = Date.now() + 500 }")
        sp.wait_for_function("() => !__scifi.want() && document.getElementById('sfAudio').paused", timeout=4000)
        sp.wait_for_timeout(1200)
        ck("sci-fi page: timed sleep still stops and stays stopped",
           not sp.evaluate("__scifi.want()") and sp.evaluate("document.getElementById('sfAudio').paused")
           and "sleep timer stopped" in sp.inner_text("#sfStatus").lower())
        ck("no page errors on sci-fi page", not serrs, serrs)

        # Sci-Fi (Live) inside the main player.
        main = ctx.new_page()
        merrs = []
        main.on("pageerror", lambda e: merrs.append(str(e)))
        main.route("https://archive.org/**", fulfill_mp3)
        main.goto(BASE + "/otr/?season=off")
        main.wait_for_function("""() => window.__scifi && __scifi.booted() && window.__otr && __otr.ready()
          && document.querySelector('#networkChips .station[data-net=scifi]')""", timeout=20000)
        main.evaluate("(ms) => __scifi.setClock(ms)", spot["into"])
        main.locator("#networkChips .station[data-net=scifi]").click()
        main.wait_for_function("""() => __otr.state.network === 'scifi' && __scifi.armed() && __scifi.want()
          && !document.getElementById('audio').paused""", timeout=10000)
        main.locator("#moreBtn").click()
        main.select_option("#sleepSel", "15")
        main.evaluate("__otr.sleepIn(1200)")
        main.select_option("#sleepSel", "end")
        main.wait_for_timeout(2500)
        live_locks = main.evaluate("""() => {
          const ids = ['prevBtn','backBtn','fwdBtn','skipBtn'];
          return {
            locks: ids.every(id => document.getElementById(id).disabled),
            rate: document.getElementById('rateSel').disabled,
            sleep: !document.getElementById('sleepSel').disabled,
            mode: __otr.sleepMode(),
            paused: document.getElementById('audio').paused,
            label: document.getElementById('sleepLeft').textContent
          };
        }""")
        ck("main sci-fi: end cancels a duration without unlocking live controls",
           live_locks["locks"] and live_locks["rate"] and live_locks["sleep"]
           and live_locks["mode"] == "end" and not live_locks["paused"]
           and "after this episode" in live_locks["label"] and "left" not in live_locks["label"], live_locks)
        main.select_option("#sleepSel", "30")
        main.wait_for_function("() => __otr.sleepMode()==='30' && (document.getElementById('sleepLeft').textContent||'').indexOf('left')>=0", timeout=3000)
        ck("main sci-fi: a duration cancels end of episode", main.evaluate("__otr.sleepMode()") == "30")
        main.select_option("#sleepSel", "end")
        main.evaluate("(ms) => __scifi.setClock(ms)", spot["brk"])
        main.wait_for_function("() => !__scifi.want() && document.getElementById('audio').paused", timeout=4000)
        main.wait_for_timeout(1500)
        done = main.evaluate("""() => ({
          want: __scifi.want(), paused: document.getElementById('audio').paused,
          mode: __otr.sleepMode(), sel: document.getElementById('sleepSel').value,
          label: document.getElementById('sleepLeft').textContent,
          skip: document.getElementById('skipBtn').disabled,
          rate: document.getElementById('rateSel').disabled,
          sleep: !document.getElementById('sleepSel').disabled,
          play: document.getElementById('playBtn').textContent
        })""")
        ck("main sci-fi: stops at the end of the episode and does not rejoin by itself",
           not done["want"] and done["paused"] and done["mode"] == "off" and done["sel"] == "off"
           and "stopped at end of episode" in done["label"] and done["skip"] and done["rate"] and done["sleep"]
           and "Listen" in done["play"], done)
        main.click("#playBtn")
        main.wait_for_function("() => __scifi.want() && !document.getElementById('audio').paused", timeout=8000)
        main.select_option("#sleepSel", "15")
        main.wait_for_function("() => (document.getElementById('sleepLeft').textContent||'').indexOf('left')>=0", timeout=3000)
        main.evaluate("__otr.sleepIn(700)")
        main.wait_for_function("() => !__scifi.want() && document.getElementById('audio').paused", timeout=4000)
        main.wait_for_timeout(1000)
        ck("main sci-fi: timed sleep still stops and the clock does not restart it",
           not main.evaluate("__scifi.want()") and main.evaluate("document.getElementById('audio').paused"))
        ck("no page errors on main sci-fi", not merrs, merrs)

        # Listenotr mutes at the end of the episode, including when armed during a break.
        live = ctx.new_page()
        lerrs = []
        live.on("pageerror", lambda e: lerrs.append(str(e)))
        live.route("https://archive.org/**", fulfill_mp3)
        live.goto(BASE + "/otr/?season=off")
        live.wait_for_function("""() => window.__listenotr && __listenotr.booted() && window.__otr && __otr.ready()
          && document.querySelector('#networkChips .station[data-net=listenotr]')""", timeout=20000)
        marks = live.evaluate("""() => {
          let ms = __listenotr.unixFor('2026-11-04', 20 * 3600);
          for (let i = 0; i < 80; i++) {
            const a = __listenotr.onAir(ms);
            const start = ms - a.offset * 1000;
            const end = start + a.dur * 1000;
            if (a.kind === 'show' && a.dur > 90) {
              const into = start + 6000;
              const brkAt = end + 400;
              const br = __listenotr.onAir(brkAt);
              if (br.kind === 'break' && br.dur > 2) {
                const showAt = brkAt - br.offset * 1000 + br.dur * 1000 + 800;
                const nx = __listenotr.onAir(showAt);
                if (nx.kind === 'show') {
                  const nxEnd = showAt - nx.offset * 1000 + nx.dur * 1000 + 400;
                  return { into: into, brkAt: brkAt, showAt: showAt, nxEnd: nxEnd };
                }
              }
            }
            ms = end + 200;
          }
          return null;
        }""")
        ck("listenotr found a show, a break, and the show after it", bool(marks), marks)
        live.evaluate("(ms) => __listenotr.setClock(ms)", marks["brkAt"])
        live.locator("#networkChips .station[data-net=listenotr]").click()
        live.wait_for_function("() => __otr.state.network === 'listenotr' && !__listenotr.paused()", timeout=8000)
        if not live.is_visible("#morePanel"):
            live.click("#moreBtn")
        live.select_option("#sleepSel", "end")
        armed = live.inner_text("#sleepLeft")
        ck("listenotr: armed during a break waits for the next episode",
           "next episode" in armed and live.evaluate("__otr.sleepMode()") == "end" and not live.evaluate("__listenotr.muted()"),
           armed)
        live.evaluate("(ms) => __listenotr.setClock(ms)", marks["showAt"])
        live.wait_for_timeout(600)
        ck("listenotr: the episode itself is not muted as it starts",
           live.evaluate("__otr.sleepMode()") == "end" and not live.evaluate("__listenotr.muted()")
           and "this episode" in live.inner_text("#sleepLeft"), live.inner_text("#sleepLeft"))
        live.evaluate("(ms) => __listenotr.setClock(ms)", marks["nxEnd"])
        live.wait_for_function("() => __listenotr.muted() && __otr.sleepMode() === 'off'", timeout=4000)
        live.wait_for_timeout(1000)
        after = live.evaluate("""() => ({
          muted: __listenotr.muted(), mode: __otr.sleepMode(),
          skip: document.getElementById('skipBtn').disabled,
          sleep: !document.getElementById('sleepSel').disabled,
          play: document.getElementById('playBtn').textContent
        })""")
        ck("listenotr: mutes when that episode ends and keeps the live locks",
           after["muted"] and after["mode"] == "off" and after["skip"] and after["sleep"] and "Unmute" in after["play"], after)
        ck("no page errors on listenotr", not lerrs, lerrs)

        browser.close()

    print("FAILS", F)
    raise SystemExit(1 if F else 0)


if __name__ == "__main__":
    main()
