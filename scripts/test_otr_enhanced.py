#!/usr/bin/env python3
"""Tests for the /otr "enhanced audio when available" setting (enhanced.json sidecar).

One listener-wide setting: with it on, a mapped episode plays its enhanced file and every
other episode plays the catalog copy. Serves frontend/public/otr at /otr/ from a custom
handler so enhanced.json can be swapped (real file, fixture, 404, invalid), and serves short
WAV fixtures so playback, swaps and fallbacks run for real without touching archive.org.
Run:  python3 scripts/test_otr_enhanced.py
"""
import http.server, socketserver, threading, os, sys, io, json, wave, struct, math, time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "otr"))
PORT = 8797
BASE = f"http://127.0.0.1:{PORT}"
MODE = {"enh": "file", "body": b""}      # file | fixture | 404 | invalid
REQS = []

def wav(seconds, freq):
    buf = io.BytesIO(); w = wave.open(buf, "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(8000)
    w.writeframes(b"".join(struct.pack("<h", int(3000 * math.sin(2 * math.pi * freq * i / 8000))) for i in range(8000 * seconds)))
    w.close(); return buf.getvalue()

ORIG, ENH = wav(30, 440), wav(36, 660)   # different runtimes so ratio resume is observable

class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, code, body, ctype):
        self.send_response(code); self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body))); self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Accept-Ranges", "bytes"); self.end_headers()
        if self.command != "HEAD": self.wfile.write(body)
    def audio(self, data):
        rng = self.headers.get("Range")
        if rng and rng.startswith("bytes="):
            a, _, b = rng[6:].partition("-"); a = int(a or 0); b = int(b) if b else len(data) - 1
            chunk = data[a:b + 1]
            self.send_response(206); self.send_header("Content-Type", "audio/wav"); self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Range", f"bytes {a}-{a+len(chunk)-1}/{len(data)}"); self.send_header("Content-Length", str(len(chunk)))
            self.send_header("Access-Control-Allow-Origin", "*"); self.end_headers(); self.wfile.write(chunk); return
        self.send(200, data, "audio/wav")
    def do_HEAD(self): self.do_GET()
    def do_GET(self):
        path = self.path.split("?")[0]; REQS.append(path)
        if path.startswith("/fx/orig/"): return self.audio(ORIG)
        if path == "/fx/enh.wav": return self.audio(ENH)
        if path.startswith("/fx/"): return self.send(404, b"not found", "text/plain")
        if path in ("/otr", "/otr/"): path = "/otr/index.html"
        if path == "/otr/enhanced.json" and MODE["enh"] != "file":
            if MODE["enh"] == "404": return self.send(404, b"not found", "text/plain")
            if MODE["enh"] == "invalid": return self.send(200, b"{ this is not json", "application/json")
            return self.send(200, MODE["body"], "application/json")
        if path.startswith("/otr/"):
            f = os.path.join(ROOT, path[len("/otr/"):])
            if os.path.isfile(f):
                ct = "text/html" if f.endswith(".html") else "application/json" if f.endswith(".json") else "application/octet-stream"
                return self.send(200, open(f, "rb").read(), ct)
        self.send(404, b"not found", "text/plain")

class TS(socketserver.ThreadingMixIn, socketserver.TCPServer): daemon_threads = True; allow_reuse_address = True

def main():
    from playwright.sync_api import sync_playwright
    httpd = TS(("127.0.0.1", PORT), H); threading.Thread(target=httpd.serve_forever, daemon=True).start()
    fails = []
    def ck(name, cond, detail=""):
        print(("PASS" if cond else "FAIL"), name, ("" if cond else "-> " + str(detail)))
        if not cond: fails.append(name)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=os.environ.get("OTR_CHROMIUM", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"),
                              args=["--autoplay-policy=no-user-gesture-required"])
        pg = b.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        def load(url=f"{BASE}/otr/"):
            pg.goto(url); pg.wait_for_function("window.__otr && window.__otr.ready()", timeout=20000)
            pg.wait_for_timeout(300)
        def local_prefix():  # point catalog URLs at the local 30 s fixture
            pg.evaluate(f"window.__otr.catalog().prefix = '{BASE}/fx/orig/'")
        def wait_src(fragment, t=8000):
            pg.wait_for_function(f"document.getElementById('audio').src.indexOf({json.dumps(fragment)})>=0", timeout=t)
        def wait_meta(t=8000):
            pg.wait_for_function("isFinite(document.getElementById('audio').duration) && document.getElementById('audio').duration>0", timeout=t)

        # --- real (empty) sidecar ---
        pg.goto(BASE + "/otr/"); pg.evaluate("localStorage.clear()"); load()
        ck("real enhanced.json loads with zero entries", pg.evaluate("window.__otr.enhancedCount()") == 0)
        ck("setting is always shown (global, not per episode)", pg.is_visible("#enhToggle"))
        ck("default is original", pg.evaluate("window.__otr.sourceInfo().pref") == "original" and not pg.is_checked("#enhToggle"))
        pg.click("#enhToggle")
        t = pg.inner_text("#toast")
        ck("turning it on with nothing mapped says so", "None mapped yet" in t, t)
        local_prefix(); pg.evaluate("window.__otr.playEpisode('quiet-please', 0)")
        si = pg.evaluate("window.__otr.sourceInfo()")
        ck("setting on + unmapped episode plays the regular copy", "/fx/orig/QuietPlease_806/" in si["src"] and not si["enh"], si)
        ck("no Enhanced line for an unmapped episode", not pg.is_visible("#npSrc"))

        # --- persistence ---
        pg.reload(); pg.wait_for_function("window.__otr.ready()", timeout=20000)
        ck("otr_source persists across reload", pg.evaluate("localStorage.getItem('otr_source')") == "enhanced" and pg.is_checked("#enhToggle"))

        # --- key resolution rules ---
        n = pg.evaluate("""() => window.__otr.setEnhanced({version:1, episodes:{
            "quiet-please|1947-06-08|Nothing Behind the Door": {url:"https://example.org/a.mp3", duration:1747, method:"subtractive", credit:"A"},
            "47-06-15_QUIETPLEASE_002_IHAVEBEENLOOKINGFORYOU": {url:"https://example.org/b.mp3", method:"subtractive"},
            "quiet-please||WE WERE HERE, FIRST!": {url:"https://example.org/c.mp3", method:"subtractive"},
            "quiet-please|1947-06-29|Some Title": {url:"https://example.org/d.mp3", method:"generative"},
            "quiet-please|1947-07-06|Other": {url:null, method:"subtractive"},
            "quiet-please|June 1947|Nothing Behind the Door": {url:"https://example.org/e.mp3", method:"subtractive"},
            "quiet-please|1947-06-08|Nothing Behind the Door x": {url:"youtube.com/watch?v=1", method:"subtractive"}
        }})""")
        ck("only valid entries count (generative, null url, bad date, non-URL dropped)", n == 3, n)
        r = pg.evaluate("[0,1,2,3].map(i => { const e = window.__otr.enhFor('quiet-please', i); return e ? e.url : null; })")
        ck("full key matches date + title", r[0] == "https://example.org/a.mp3", r)
        ck("filename-stem key matches", r[1] == "https://example.org/b.mp3", r)
        ck("dateless key matches a unique title, case and punctuation blind", r[2] == "https://example.org/c.mp3", r)
        ck("unmapped episode resolves to nothing", r[3] is None, r)

        # --- on-demand playback, swap keeps position by ratio ---
        enh_map = lambda url, dur: json.dumps({"version": 1, "episodes": {"quiet-please|1947-06-08|Nothing Behind the Door":
                                               {"url": url, "duration": dur, "method": "subtractive", "credit": "SPERDVAC / Corey Harker"}}})
        pg.evaluate(f"window.__otr.setEnhanced({enh_map(BASE + '/fx/enh.wav', 36)})")
        local_prefix(); pg.evaluate("window.__otr.playEpisode('quiet-please', 0)")
        wait_src("/fx/enh.wav"); wait_meta()
        ck("setting on + mapped episode plays the enhanced file", pg.evaluate("window.__otr.sourceInfo().enh"))
        line = pg.inner_text("#npSrc")
        ck("credit line under the title", "Enhanced" in line and "SPERDVAC / Corey Harker" in line, line)
        alb = pg.evaluate("navigator.mediaSession && navigator.mediaSession.metadata ? navigator.mediaSession.metadata.album : ''")
        ck("Media Session album carries Enhanced", "Enhanced" in alb, alb)
        pg.wait_for_function("!document.getElementById('audio').paused", timeout=8000)
        pg.evaluate("document.getElementById('audio').currentTime = 18")   # 50% of the 36 s enhanced file
        pg.wait_for_timeout(300)
        pg.click("#enhToggle")                                               # off: back to the 30 s original
        wait_src("/fx/orig/"); wait_meta()
        pg.wait_for_function("document.getElementById('audio').currentTime > 10", timeout=8000)
        ct = pg.evaluate("document.getElementById('audio').currentTime")
        ck("switching off mid-episode keeps position as a ratio (~15 s of 30)", 13.5 <= ct <= 17.5, ct)
        ck("Enhanced line hidden when the setting is off", not pg.is_visible("#npSrc"))
        pg.evaluate("document.getElementById('audio').pause()"); pg.wait_for_timeout(200)
        ct0 = pg.evaluate("document.getElementById('audio').currentTime")
        pg.click("#enhToggle")                                               # on again while paused
        wait_src("/fx/enh.wav"); wait_meta()
        pg.wait_for_function("document.getElementById('audio').currentTime > 5", timeout=8000)
        st = pg.evaluate("({t: document.getElementById('audio').currentTime, paused: document.getElementById('audio').paused})")
        ck("switching while paused stays paused", st["paused"], st)
        ck("and lands at the same fraction of the new file", abs(st["t"] - ct0 / 30 * 36) < 2.0, {"was": ct0, "now": st["t"]})

        # --- enhanced 404 falls back to original, no limiter strike ---
        pg.evaluate(f"window.__otr.setEnhanced({enh_map(BASE + '/fx/missing.mp3', 36)})")
        local_prefix(); pg.evaluate("window.__otr.state.errCount = 0; window.__otr.playEpisode('quiet-please', 0)")
        wait_src("/fx/orig/")
        pg.wait_for_function("document.getElementById('toast').textContent.indexOf('Enhanced copy unavailable')>=0", timeout=4000)
        si = pg.evaluate("window.__otr.sourceInfo()")
        ck("enhanced 404 falls back to the original", "/fx/orig/" in si["src"] and not si["enh"] and si["why"] == "failed", si)
        ck("fallback is not a runaway-skip strike", si["errCount"] == 0, si)
        ck("same episode stays on the original for the session", pg.evaluate(
            "window.__otr.playEpisode('quiet-please', 0), window.__otr.sourceInfo().url").find("/fx/orig/") >= 0)

        # --- live broadcast clock ---
        pick = pg.evaluate("""() => { for (const ch of window.__otr.channels()) { const a = window.__otr.onAirNow(ch);
                              if (a && !a.isAd) return Object.assign({ch}, a); } return null; }""")
        if not pick:
            ck("found a live program to test against", False, "every channel on a commercial break")
        else:
            show = pg.evaluate(f"window.__otr.catalog().shows.find(s => s.id === {json.dumps(pick['showId'])})")
            ep = show["eps"][pick["epIndex"]]; stem = ep[4].rsplit(".", 1)[0]
            def live_with(dur):
                m = json.dumps({"version": 1, "episodes": {stem: {"url": BASE + "/fx/enh.wav", "duration": dur, "method": "subtractive"}}})
                return pg.evaluate(f"""() => {{ window.__otr.setEnhanced({m}); window.__otr.catalog().prefix = '{BASE}/fx/orig/';
                    window.__otr.startChannel({json.dumps(pick['ch'])}); const s = window.__otr.sourceInfo();
                    return Object.assign(s, {{total: window.__otr.onAirNow({json.dumps(pick['ch'])}).total, live: window.__otr.state.live}}); }}""")
            a = live_with(pick["dur"] + 60)
            ck("live clock plays original when runtimes differ by > 2 s", a["live"] and not a["enh"] and a["why"] == "clock", a)
            ck("schedule still built from catalog runtimes", a["total"] == pick["total"], {"before": pick["total"], "after": a["total"]})
            ck("reason line shown", "Live clock uses original" in pg.inner_text("#npSrc"))
            a = live_with(pick["dur"] + 1)
            ck("live clock plays enhanced when runtimes match within 2 s", a["live"] and a["enh"], a)
            pg.evaluate("window.__otr.next()")
            ck("skip still follows the schedule, off the clock", not pg.evaluate("window.__otr.state.live"))

        # --- broken / missing sidecar ---
        for mode in ("404", "invalid"):
            MODE["enh"] = mode; load()
            ok = pg.evaluate(f"""() => {{ window.__otr.catalog().prefix = '{BASE}/fx/orig/'; window.__otr.playEpisode('quiet-please', 0);
                                   return window.__otr.enhancedCount() === 0 && window.__otr.sourceInfo().src.indexOf('/fx/orig/') >= 0; }}""")
            ck(f"enhanced.json {mode}: player starts, original only", ok)
        MODE["enh"] = "file"

        # --- /otr and /otr/ both reach the sidecar ---
        for url in (f"{BASE}/otr", f"{BASE}/otr/"):
            REQS.clear(); load(url)
            ck(f"{url[len(BASE):]} fetches /otr/enhanced.json", "/otr/enhanced.json" in REQS, [r for r in REQS if "json" in r])

        # --- 375 px ---
        m = b.new_page(viewport={"width": 375, "height": 800}); m.goto(BASE + "/otr/")
        m.wait_for_function("window.__otr && window.__otr.ready()", timeout=20000)
        w = m.evaluate("({sw: document.documentElement.scrollWidth, vis: !!document.getElementById('enhToggle').offsetParent})")
        ck("375 px: setting visible, no horizontal scroll", w["vis"] and w["sw"] <= 375, w)

        ck("no page errors", not errs, errs)
        b.close()
    httpd.shutdown()
    print("\nALL PASSED" if not fails else f"\n{len(fails)} FAILED: {fails}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
