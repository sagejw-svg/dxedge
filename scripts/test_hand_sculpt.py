#!/usr/bin/env python3
"""Sculpt (/synth/hand-sculpt/) — hand tracking instrument.

Gesture math, the offline voices, the page, the size control, the camera
promise, and the mouse fallback. Sound is measured from the real graph.

Run: python3 scripts/test_hand_sculpt.py
"""
import http.server, socketserver, threading, functools, os, base64, math
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public"))
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PORT = int(os.environ.get("SCULPT_PORT", "8798"))

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a, **k):
        pass
    def do_POST(self):
        if self.path.split("?")[0] == "/api/stat":
            n = int(self.headers.get("Content-Length") or 0)
            if n:
                self.rfile.read(n)
            self.send_response(204)
            self.end_headers()
            return
        self.send_error(501)

handler = functools.partial(Handler, directory=ROOT)
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{PORT}/synth/hand-sculpt/"

F = []
def ck(name, cond, detail=""):
    print(("PASS" if cond else "FAIL"), name, "" if cond else f"-> {detail}")
    if not cond:
        F.append(name)

def dec(r):
    L = np.frombuffer(base64.b64decode(r["L"]), dtype=np.float32).astype(np.float64)
    R = np.frombuffer(base64.b64decode(r["R"]), dtype=np.float32).astype(np.float64)
    return L, R

def rms(x):
    return float(np.sqrt(np.mean(x * x)))

def peak_freq(x, sr):
    n = len(x)
    w = np.hanning(n)
    spec = np.abs(np.fft.rfft(x * w))
    f = np.fft.rfftfreq(n, 1 / sr)
    lo = np.searchsorted(f, 40)
    i = lo + int(np.argmax(spec[lo:]))
    return float(f[i])

def hf_energy(x):
    d = np.diff(x)
    return float(np.sqrt(np.mean(d * d)))

def band_ratio(x, sr, lo_hz):
    n = len(x)
    spec = np.abs(np.fft.rfft(x * np.hanning(n))) ** 2
    f = np.fft.rfftfreq(n, 1 / sr)
    hi = spec[f >= lo_hz].sum()
    tot = spec[f >= 40].sum() + 1e-12
    return float(hi / tot)

from playwright.sync_api import sync_playwright
_CANDIDATES = [
    os.environ.get("SYNTH_CHROMIUM", ""),
    "/usr/bin/google-chrome",
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    "/opt/google/chrome/chrome",
    "/usr/local/bin/chrome",
]
CHROME = next(p for p in _CANDIDATES if p and os.path.exists(p))

with sync_playwright() as pw:
    b = pw.chromium.launch(
        executable_path=CHROME,
        args=["--autoplay-policy=no-user-gesture-required", "--use-gl=angle", "--use-angle=swiftshader"],
    )
    pg = b.new_page(viewport={"width": 1280, "height": 800})
    errs = {"page": [], "console": []}
    pg.on("pageerror", lambda e: errs["page"].append(str(e)))
    def on_console(msg):
        if msg.type == "error" and "Failed to load resource" not in (msg.text or ""):
            errs["console"].append(msg.text or "")
    pg.on("console", on_console)
    pg.add_init_script("""
      window.__gum = 0;
      const md = navigator.mediaDevices;
      if (md && md.getUserMedia) {
        const orig = md.getUserMedia.bind(md);
        md.getUserMedia = function() {
          window.__gum++;
          return Promise.reject(new DOMException('blocked', 'NotAllowedError'));
        };
      }
    """)
    pg.goto(BASE)
    pg.wait_for_function("window.__sculpt && __sculpt.ready()", timeout=20000)
    text = pg.locator("body").inner_text()
    ck("page names Sculpt", "SCULPT" in text and "hand" in text.lower(), text[:180])
    ck("camera promise is on the page", "not uploaded" in text.lower() and "stays in this browser" in text.lower(), text[:400])
    ck("camera is not requested on load", pg.evaluate("window.__gum") == 0, pg.evaluate("window.__gum"))
    ck("WebGL scene started", pg.evaluate("__sculpt.gl()"))
    ck("no page errors on load", not errs["page"] and not errs["console"], errs)
    ck("size defaults to M", pg.evaluate("__sculpt.size()") == "m")
    pg.click('[data-size="xl"]')
    xl = pg.evaluate("""() => ({
      size: __sculpt.size(),
      pressed: document.querySelector('[data-size="xl"]').getAttribute('aria-pressed'),
      h1: parseFloat(getComputedStyle(document.querySelector('h1')).fontSize)
    })""")
    pg.click('[data-size="s"]')
    sm = pg.evaluate("parseFloat(getComputedStyle(document.querySelector('h1')).fontSize)")
    ck("XL is selected and larger than S", xl["size"] == "xl" and xl["pressed"] == "true" and xl["h1"] > sm + 2, (xl, sm))
    pg.click('[data-size="m"]')

    gestures = pg.evaluate("""() => {
      const a = __sculpt.api;
      const open = a.synthesizeHand({ x: 0.5, y: 0.55, z: 0, roll: 0, spread: 1, pinch: 0 });
      const shut = a.synthesizeHand({ x: 0.5, y: 0.55, z: 0, roll: 0, spread: 0, pinch: 1 });
      const both = a.synthesizeHand({ x: 0.5, y: 0.55, z: 0, roll: 0, spread: 1, pinch: 1 });
      const flat = a.synthesizeHand({ x: 0.5, y: 0.55, roll: 0, spread: 0.4, pinch: 0 });
      const twist = a.synthesizeHand({ x: 0.5, y: 0.55, roll: Math.PI / 2 * 0.85, spread: 0.4, pinch: 0 });
      const cal = a.calibrateFromHand(flat, false);
      const pose = a.poseFromHand(flat, cal, false);
      const near = a.poseFromHand(a.synthesizeHand({ x: 0.3, y: 0.45, z: 1, spread: 0.3, pinch: 0 }), a.defaultCal(), false);
      const far = a.poseFromHand(a.synthesizeHand({ x: 0.3, y: 0.45, z: -1, spread: 0.3, pinch: 0 }), a.defaultCal(), false);
      const f = a.createOneEuro(1, 0, 1);
      f(0, 0);
      const smoothed = f(1, 0.05);
      const left = a.poseFromHand(a.synthesizeHand({ x: 0.25, y: 0.5, pinch: 0, spread: 1 }), a.defaultCal(), false);
      const right = a.poseFromHand(a.synthesizeHand({ x: 0.78, y: 0.5, pinch: 0, spread: 1 }), a.defaultCal(), false);
      let reached = 0;
      for (const orb of a.freshOrbs()) {
        let best = 99;
        for (let px = 0.08; px <= 0.92; px += 0.04) {
          for (let py = 0.08; py <= 0.92; py += 0.04) {
            const p = a.poseFromHand(a.synthesizeHand({ x: px, y: py, z: 0, spread: 0.85, pinch: 1 }), a.defaultCal(), false);
            const d = Math.hypot(p.point.x - orb.x, p.point.y - orb.y, (p.point.z - orb.z) * 0.65);
            if (d < best) best = d;
          }
        }
        if (best < 0.78) reached++;
      }
      const ember = a.freshOrbs().find(o => o.id === 'ember');
      let grab = null;
      for (let px = 0.08; px <= 0.92 && !grab; px += 0.03) {
        for (let py = 0.08; py <= 0.92; py += 0.03) {
          const p = a.poseFromHand(a.synthesizeHand({ x: px, y: py, z: 0.1, spread: 0.9, pinch: 1, roll: 0.4 }), a.defaultCal(), false);
          const d = Math.hypot(p.point.x - ember.x, p.point.y - ember.y, (p.point.z - ember.z) * 0.65);
          if (p.pinch > 0.62 && d < 0.78) { grab = { px, py, spread: p.spread }; break; }
        }
      }
      let held = null, released = false, spreadHeld = 0;
      if (grab) {
        const p = a.poseFromHand(a.synthesizeHand({ x: grab.px, y: grab.py, z: 0.1, spread: 0.9, pinch: 1, roll: 0.4 }), a.defaultCal(), false);
        let st = a.stepGrab({ held: null, hand: null }, [p], a.freshOrbs());
        held = st.held;
        spreadHeld = st.orbs.find(o => o.id === 'ember').spread;
        const letGo = a.poseFromHand(a.synthesizeHand({ x: grab.px, y: grab.py, z: 0.1, spread: 0.9, pinch: 0 }), a.defaultCal(), false);
        st = a.stepGrab(st, [letGo], st.orbs);
        released = !st.held && Math.abs(st.orbs.find(o => o.id === 'ember').x - p.point.x) < 0.05;
      }
      return {
        openPinch: a.pinchAmount(open), shutPinch: a.pinchAmount(shut),
        bothPinch: a.pinchAmount(both), bothSpread: a.fingerSpread(both),
        openSpread: a.fingerSpread(open), shutSpread: a.fingerSpread(shut),
        flatRoll: a.wristRoll(flat), twistRoll: a.wristRoll(twist),
        calX: pose.x, calY: pose.y, calZ: pose.z,
        nearZ: near.z, farZ: far.z, smoothed, reached,
        width: a.twoHandWidth(left, right),
        held, spreadHeld, released,
      };
    }""")
    ck("open hand is not a pinch", gestures["openPinch"] < 0.35, gestures["openPinch"])
    ck("pinch closes thumb and index", gestures["shutPinch"] > 0.7, gestures["shutPinch"])
    ck("pinch and spread can happen together", gestures["bothPinch"] > 0.65 and gestures["bothSpread"] > 0.6, gestures)
    ck("a curled hand is not spread", gestures["shutSpread"] < 0.35, gestures["shutSpread"])
    ck("wrist twist is signed", abs(gestures["flatRoll"]) < 0.2 and gestures["twistRoll"] > 0.55, gestures)
    ck("calibration centers the hand", abs(gestures["calX"]) < 0.08 and abs(gestures["calY"]) < 0.08 and abs(gestures["calZ"]) < 0.15, gestures)
    ck("closer hand reads as positive depth", gestures["nearZ"] > 0.45 and gestures["farZ"] < -0.45, gestures)
    ck("smoothing rejects a one-frame jump", 0.05 < gestures["smoothed"] < 0.55, gestures["smoothed"])
    ck("every orb is inside a pinch", gestures["reached"] == 6, gestures["reached"])
    ck("a pinch grabs and a release keeps the orb", gestures["held"] == "ember" and gestures["released"] and gestures["spreadHeld"] > 0.55, gestures)
    ck("two open hands widen the room", gestures["width"] > 0.65, gestures["width"])

    def render(events, seconds=1.4):
        return pg.evaluate("""async ({events, seconds}) => __sculpt.render({events, seconds, sampleRate: 48000, bed: false, seed: 3})""",
                            {"events": events, "seconds": seconds})

    def tone(y, z=0.35, roll=-1, x=0, spread=0, grab=True, seconds=1.3, extra=None):
        ev = [dict(t=0, id="ember", x=x, y=y, z=z, roll=roll, spread=spread, grab=grab)]
        if extra:
            ev.extend(extra)
        raw = render(ev, seconds)
        L, R = dec(raw)
        n = len(L)
        a = int(0.45 * n)
        return L[a:], R[a:], raw["sr"]

    hiL, hiR, sr = tone(0.85, z=0.45, roll=-1)
    loL, loR, _ = tone(-0.85, z=0.45, roll=-1)
    hiF = peak_freq((hiL + hiR) * 0.5, sr)
    loF = peak_freq((loL + loR) * 0.5, sr)
    ck("higher hand is a higher pitch", hiF > loF * 1.6, (loF, hiF))

    leftL, leftR, _ = tone(0, z=0.2, roll=-1, x=-1.15)
    rightL, rightR, _ = tone(0, z=0.2, roll=-1, x=1.15)
    ck("left of the field is louder on the left", rms(leftL) > rms(leftR) * 1.6, (rms(leftL), rms(leftR)))
    ck("right of the field is louder on the right", rms(rightR) > rms(rightL) * 1.6, (rms(rightL), rms(rightR)))

    darkL, darkR, _ = tone(0, z=-0.85, roll=1)
    brightL, brightR, _ = tone(0, z=0.85, roll=1)
    darkB = band_ratio((darkL + darkR) * 0.5, sr, 1800)
    brightB = band_ratio((brightL + brightR) * 0.5, sr, 1800)
    ck("closer hand opens the filter", brightB > darkB * 1.8 and rms(brightL) > 0.01, (darkB, brightB))

    softL, softR, _ = tone(0, z=0.7, roll=-1)
    hardL, hardR, _ = tone(0, z=0.7, roll=1)
    def harm_ratio(x):
        f0 = peak_freq(x, sr)
        def amp(f):
            t = np.arange(len(x)) / sr
            w = np.hanning(len(x))
            return abs(np.sum(x * w * np.exp(-2j * np.pi * f * t))) / (np.sum(w) + 1e-12)
        return amp(f0 * 2) / (amp(f0) + 1e-12)
    softH = harm_ratio((softL + softR) * 0.5)
    hardH = harm_ratio((hardL + hardR) * 0.5)
    ck("a twisted wrist brightens the timbre", hardH > softH * 2 and softH < 0.2, (softH, hardH))

    grainL, grainR, _ = tone(0, z=0.75, roll=-1, spread=1)
    bareL, bareR, _ = tone(0, z=0.75, roll=-1, spread=0)
    ck("a spread hand explodes into grains", hf_energy(grainL) > hf_energy(bareL) * 1.7, (hf_energy(bareL), hf_energy(grainL)))

    tail_dry = render([
        dict(t=0, id="ember", x=0, y=0, z=0.2, roll=-1, spread=0, grab=True, reverb=0.02),
        dict(t=0.28, id="ember", grab=False, reverb=0.02),
    ], 1.6)
    tail_wet = render([
        dict(t=0, id="ember", x=0, y=0, z=0.2, roll=-1, spread=0, grab=True, reverb=1),
        dict(t=0.28, id="ember", grab=False, reverb=1),
    ], 1.6)
    dL, dR = dec(tail_dry)
    wL, wR = dec(tail_wet)
    n = len(dL)
    sl = slice(int(0.85 * n), int(1.45 * n))
    dry_tail = rms(dL[sl]) + rms(dR[sl])
    wet_tail = rms(wL[sl]) + rms(wR[sl])
    ck("open hands leave a wider reverb tail", wet_tail > dry_tail * 2.2, (dry_tail, wet_tail))

    pg.evaluate("() => __sculpt.useMouse()")
    pg.wait_for_function("() => __sculpt.mode() === 'mouse'")
    pg.evaluate("""() => __sculpt.setControl({ x: 0.5, y: 0.55, z: 0.15, roll: 0.2, spread: 0.9, pinch: 1, second: null })""")
    pg.wait_for_timeout(250)
    snap = pg.evaluate("__sculpt.snapshot()")
    ck("mouse pinch grabs an orb", bool(snap["grabbed"]), snap["grabbed"])
    ck("mouse draws a hand skeleton", snap["hands"] >= 1, snap["hands"])
    pg.evaluate("""() => __sculpt.setControl({ pinch: 0, second: { x: 0.15, y: 0.5 } })""")
    pg.wait_for_timeout(200)
    wide = pg.evaluate("__sculpt.snapshot().reverb")
    pg.evaluate("""() => __sculpt.setControl({ pinch: 0, second: { x: 0.52, y: 0.55 } })""")
    pg.wait_for_timeout(200)
    narrow = pg.evaluate("__sculpt.snapshot().reverb")
    ck("a planted second hand widens the room", wide > narrow + 0.15, (narrow, wide))

    phone = b.new_page(viewport={"width": 375, "height": 700})
    phone.goto(BASE)
    phone.wait_for_function("window.__sculpt && __sculpt.ready()", timeout=20000)
    overflow = phone.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 2")
    ck("phone width does not overflow", overflow, phone.evaluate("document.documentElement.scrollWidth"))
    ck("size control is on the phone page", phone.locator('[data-size="xl"]').count() == 1)

    shots = os.environ.get("SYNTH_SHOTS", "/tmp")
    os.makedirs(shots, exist_ok=True)
    pg.screenshot(path=os.path.join(shots, "sculpt-mouse.png"))
    gate = b.new_page(viewport={"width": 1280, "height": 800})
    gate.goto(BASE)
    gate.wait_for_function("window.__sculpt && __sculpt.ready()", timeout=20000)
    gate.screenshot(path=os.path.join(shots, "sculpt-gate.png"))

    src = pg.evaluate("""async () => {
      const names = ['sculpt.js', 'hands.js', 'audio.js', 'scene.js', 'camera.js'];
      const out = {};
      for (const n of names) out[n] = await (await fetch(n)).text();
      return out;
    }""")
    blob = "\n".join(src.values())
    ck("page code does not upload video", "MediaRecorder" not in blob and "FormData" not in blob and "XMLHttpRequest" not in blob)

    rack = pg.evaluate("""async () => (await fetch('/synth/index.html')).text()""")
    ck("rack links to Sculpt", 'href="/synth/hand-sculpt/"' in rack and "SCULPT" in rack)

    app = open(os.path.join(REPO, "frontend", "src", "App.jsx"), encoding="utf-8").read()
    shell = open(os.path.join(REPO, "frontend", "src", "components", "Sculpt.jsx"), encoding="utf-8").read()
    ck("nav has a Sculpt tab", "label: 'Sculpt'" in app and "tab === 'sculpt'" in app)
    ck("nav frame allows the camera", 'allow="camera; autoplay"' in shell and "/synth/hand-sculpt/" in shell)

    pg.set_default_timeout(90000)
    tracker = pg.evaluate("""async () => {
      try { return await __sculpt.loadTracker(); }
      catch (err) { return String(err && err.message || err); }
    }""")
    ck("MediaPipe hand landmarker loads locally", tracker is True, tracker)

    b.close()

print()
if F:
    print(f"FAILED {len(F)}")
    for name in F:
        print(" -", name)
    raise SystemExit(1)
print("ALL PASS")
