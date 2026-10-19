#!/usr/bin/env python3
"""Hand Orchestra (/synth/hand-orchestra/).

The gestures, chords and MIDI bytes are checked in the page. The camera is not
required: the mouse hand drives the same voices. A rack check loads Filament in
an iframe and confirms a gesture can move a knob without keeping the change in
localStorage.

Run:  python3 scripts/test_hand_orchestra.py
"""
import http.server
import os
import socketserver
import functools
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public"))
PORT = int(os.environ.get("HAND_PORT", "8797"))
SHOTS = os.environ.get("SYNTH_SHOTS", "/tmp")
FAVICON = b"<svg xmlns='http://www.w3.org/2000/svg'/>"

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a, **k):
        pass
    def do_GET(self):
        if self.path.split("?")[0] == "/favicon.svg":
            self.send_response(200)
            self.send_header("Content-Type", "image/svg+xml")
            self.send_header("Content-Length", str(len(FAVICON)))
            self.end_headers()
            self.wfile.write(FAVICON)
            return
        return super().do_GET()
    def do_POST(self):
        if self.path.split("?")[0] == "/api/stat":
            n = int(self.headers.get("Content-Length") or 0)
            if n:
                self.rfile.read(n)
            self.send_response(204)
            self.end_headers()
            return
        self.send_error(501)

socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), functools.partial(Handler, directory=ROOT))
threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{PORT}"

F = []
def ck(name, cond, detail=""):
    print(("PASS" if cond else "FAIL"), name, "" if cond else f"-> {detail}")
    if not cond:
        F.append(name)

_CANDIDATES = [
    os.environ.get("SYNTH_CHROMIUM", ""),
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    "/opt/google/chrome/chrome",
    "/usr/local/bin/chrome",
]
CHROME = next(p for p in _CANDIDATES if p and os.path.exists(p))

with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=CHROME, args=["--autoplay-policy=no-user-gesture-required"])
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.add_init_script("try { localStorage.removeItem('dxedge_ui_size'); localStorage.removeItem('dxedge_hand_orchestra'); } catch (e) {}")
    pg.goto(BASE + "/synth/hand-orchestra/")
    pg.wait_for_function("window.__handOrchestra && __handOrchestra.ready()", timeout=15000)
    pg.wait_for_timeout(80)

    ck("Ho. title", "Hand Orchestra" in pg.title())
    body = pg.inner_text("body")
    ck("Ho. privacy copy says the camera is not uploaded",
       "not uploaded" in body.lower() or "are not uploaded" in body.lower())
    ck("Ho. camera permission is a button, and the note says the picture stays here",
       pg.locator("#camBtn").inner_text().lower().find("camera") >= 0
       and "browser" in pg.locator("#camNote").inner_text().lower())
    src = open(os.path.join(ROOT, "synth", "hand-orchestra", "app.js"), encoding="utf-8").read()
    ck("Ho. the page does not upload a frame",
       "FormData" not in src and "upload(" not in src and "video/webm" not in src)

    pg.locator("#uiSize [data-ui-size='xl']").click()
    ck("Ho. XL sets the shared size",
       pg.evaluate("document.documentElement.getAttribute('data-ui')") == "xl"
       and pg.evaluate("localStorage.getItem('dxedge_ui_size')") == "xl"
       and pg.locator("#uiSize [data-ui-size='xl']").get_attribute("aria-pressed") == "true")
    pg.locator("#uiSize [data-ui-size='s']").click()
    ck("Ho. S sets the shared size",
       pg.evaluate("document.documentElement.getAttribute('data-ui')") == "s"
       and pg.locator("#uiSize [data-ui-size]").count() == 4)
    pg.locator("#uiSize [data-ui-size='m']").click()

    # Chord hand: count fingers. Buttons toggle, so click each new finger once.
    def roman():
        return pg.evaluate("() => __handOrchestra.state().roman")
    pg.locator("[data-hand='chord'][data-finger='index']").click()
    ck("Ho. one finger is I", roman() == "I", roman())
    pg.locator("[data-hand='chord'][data-finger='middle']").click()
    ck("Ho. two fingers is ii", roman() == "ii", roman())
    pg.locator("[data-hand='chord'][data-finger='ring']").click()
    ck("Ho. three fingers is iii", roman() == "iii", roman())
    pg.locator("[data-hand='chord'][data-finger='pinky']").click()
    ck("Ho. four fingers is IV", roman() == "IV", roman())
    pg.locator("[data-hand='chord'][data-finger='thumb']").click()
    ck("Ho. an open hand is V", roman() == "V", roman())
    # Leave thumb + index + middle + ring: release pinky.
    pg.locator("[data-hand='chord'][data-finger='pinky']").click()
    ck("Ho. thumb and three fingers is vii", roman() == "vii", roman())
    pg.locator("[data-hand='chord'][data-finger='ring']").click()
    ck("Ho. thumb and two fingers is vi", roman() == "vi", roman())

    # Back to I (index only) so the play-hand notes are C major.
    for finger in ("thumb", "middle"):
        pg.locator(f"[data-hand='chord'][data-finger='{finger}']").click()
    ck("Ho. back to one finger, I", roman() == "I", roman())

    pg.locator("[data-hand='play'][data-finger='index']").click()
    pg.wait_for_timeout(60)
    played = pg.evaluate("() => __handOrchestra.state()")
    ck("Ho. index plays the root, C4 at the middle height",
       played["notes"] == [60] and played["octave"] == 4 and played["symbol"] == "Cmaj7", played)
    heard = pg.evaluate("() => __handOrchestra.audio() && __handOrchestra.audio().sounding")
    ck("Ho. the index voice is sounding", heard and heard.get("index") == 60, heard)
    meter = pg.locator("[data-meter='index']").get_attribute("data-level")
    ck("Ho. the index level meter is up", meter == "0.85", meter)
    pixels = pg.evaluate("""() => {
      const c = document.getElementById('overlay');
      const x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < x.length; i += 16) if (x[i] > 0) n++;
      return n;
    }""")
    ck("Ho. the mirrored preview draws fingertip dots", pixels > 20, pixels)

    pg.locator("[data-hand='play'][data-finger='middle']").click()
    both = pg.evaluate("() => __handOrchestra.state().notes.slice()")
    ck("Ho. middle adds the third, E4", both == [60, 64], both)
    pg.locator("[data-hand='play'][data-finger='index']").click()
    pg.locator("[data-hand='play'][data-finger='middle']").click()
    quiet = pg.evaluate("() => __handOrchestra.state().notes.slice()")
    ck("Ho. curling both fingers releases the notes", quiet == [], quiet)

    pg.locator("#height").fill("0.96")
    pg.locator("[data-hand='play'][data-finger='index']").click()
    high = pg.evaluate("() => __handOrchestra.state()")
    ck("Ho. a high hand is octave 6", high["octave"] == 6 and 84 in high["notes"], high)
    pg.locator("[data-hand='play'][data-finger='index']").click()

    smooth = pg.evaluate("""() => {
      const s = __handOrchestra.session();
      s.setAlpha(0.5);
      __handOrchestra.feedPose({ extended: {}, height: 0, pinch: 0, depth: 0.5, tilt: 0.5 }, { extended: { index: true } });
      const mid = __handOrchestra.feedPose(
        { extended: {}, height: 1, pinch: 0, depth: 0.5, tilt: 0.5 },
        { extended: { index: true } },
        { smooth: true });
      return mid.axes.height;
    }""")
    ck("Ho. smoothing moves part of the way", 0.45 < smooth < 0.55, smooth)

    posed = pg.evaluate("""() => {
      const lm = __handOrchestra.landmarks({ extended: { thumb: true, index: true, middle: false, ring: false, pinky: true }, height: 0.3, pinch: 0, depth: 0.5, tilt: 0.5 });
      const a = __handOrchestra.analyze(lm);
      const deg = __handOrchestra.degree(a.extended);
      return { ext: a.extended, deg };
    }""")
    ck("Ho. landmarks round-trip the raised fingers",
       posed["ext"]["thumb"] and posed["ext"]["index"] and posed["ext"]["pinky"]
       and not posed["ext"]["middle"] and not posed["ext"]["ring"] and posed["deg"] == 5, posed)

    pg.locator("#modeController").click()
    pg.wait_for_timeout(40)
    ck("Ho. controller mode shows MIDI and the rack target",
       pg.locator("#controller").is_visible() and pg.locator("#target").is_visible()
       and pg.locator("[data-cc='pinch']").input_value() == "1"
       and pg.locator("[data-cc='height']").input_value() == "11")
    plan = pg.evaluate("""() => {
      const st = __handOrchestra.feedPose(
        { extended: { index: true }, height: 0.55, pinch: 1, depth: 0, tilt: 0.5 },
        { extended: { index: true } });
      const midi = __handOrchestra.planNow();
      const knobs = __handOrchestra.planKnobs(st.axes);
      return { note: midi.notes[0], cc: midi.cc[0].bytes, cutoff: knobs.find(k => k.axis === 'pinch').value };
    }""")
    ck("Ho. a raised finger is a MIDI note-on", plan["note"][:2] == [144, 60], plan["note"])
    ck("Ho. a full pinch is CC 1 at 127", plan["cc"] == [176, 1, 127], plan["cc"])
    ck("Ho. pinch maps to the filter cutoff", plan["cutoff"] > 15000, plan["cutoff"])

    # Drive Filament. Saved patches must come back.
    pg.locator("#drive").check()
    pg.wait_for_function("() => __handOrchestra.rack().frame", timeout=5000)
    frame = pg.frame_locator("#rackFrame")
    pg.wait_for_function("""() => {
      const f = document.getElementById('rackFrame');
      return f && f.contentWindow && f.contentWindow.__synth && f.contentWindow.__synth.ready && f.contentWindow.__synth.ready();
    }""", timeout=30000)
    pg.evaluate("""() => {
      const w = document.getElementById('rackFrame').contentWindow;
      w.localStorage.setItem('filament_cur', 'SENTINEL');
    }""")
    pg.locator("#pinch").fill("1")
    pg.wait_for_timeout(400)
    kept = pg.evaluate("() => localStorage.getItem('filament_cur')")
    driven = pg.evaluate("""() => {
      const w = document.getElementById('rackFrame').contentWindow;
      const p = w.__synth.engine() && w.__synth.engine().patch && w.__synth.engine().patch();
      return { device: w.__synth.device(), cutoff: p && p.filt && p.filt.cutoff, kept: w.localStorage.getItem('filament_cur') };
    }""")
    ck("Ho. driving Filament does not keep the knob in saved patches",
       kept == "SENTINEL" and driven["kept"] == "SENTINEL", (kept, driven))
    ck("Ho. pinch opens Filament's filter",
       driven["device"] == "filament" and driven["cutoff"] and driven["cutoff"] > 8000, driven)

    pg.screenshot(path=os.path.join(SHOTS, "hand_orchestra.png"), full_page=True)
    ck("Ho. no page errors", not errs, errs)

    phone = b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    perr = []
    phone.on("pageerror", lambda e: perr.append(str(e)))
    phone.goto(BASE + "/synth/hand-orchestra/")
    phone.wait_for_function("window.__handOrchestra && __handOrchestra.ready()", timeout=15000)
    phone.wait_for_timeout(60)
    small = phone.evaluate("""() => [...document.querySelectorAll('.btn, .uisize button')]
      .filter(e => e.offsetParent)
      .filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; })
      .map(e => (e.id || e.textContent || '').trim().slice(0, 24) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))""")
    ck("Ho. 390px: no horizontal scroll",
       phone.evaluate("document.documentElement.scrollWidth <= innerWidth + 1 && innerWidth === 390"),
       phone.evaluate("[document.documentElement.scrollWidth, innerWidth]"))
    ck("Ho. 390px: buttons are at least 44px", not small, small)
    phone.locator("[data-hand='play'][data-finger='ring']").tap()
    phone.wait_for_timeout(40)
    tapped = phone.evaluate("() => __handOrchestra.state().notes.slice()")
    ck("Ho. 390px: a tap plays the fifth", tapped == [67], tapped)
    ck("Ho. 390px: no page errors", not perr, perr)
    phone.screenshot(path=os.path.join(SHOTS, "hand_orchestra_phone.png"), full_page=True)
    phone.close()

    rack = b.new_page(viewport={"width": 1280, "height": 900})
    rack.goto(BASE + "/synth/")
    rack.wait_for_selector("a[href='/synth/hand-orchestra/']", timeout=15000)
    ck("Ho. the rack nav links to Hand Orchestra",
       rack.locator("a[href='/synth/hand-orchestra/']").count() >= 1)
    rack.close()
    b.close()

print()
print("ALL PASS" if not F else f"{len(F)} FAILED: " + "; ".join(F))
raise SystemExit(1 if F else 0)
