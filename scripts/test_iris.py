#!/usr/bin/env python3
"""Iris, the camera instrument at /synth/iris/.

The picture never leaves the browser. These checks drive the page and measure
the voice: a bright row lands on its pitch, hue picks the chord, motion lights
the cell it changed, edges are louder than a flat frame, and a recording is a WAV.

Run: python3 scripts/test_iris.py
"""
import base64, functools, http.server, math, os, socketserver, threading
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public"))
PORT = int(os.environ.get("IRIS_PORT", "8798"))
SHOTS = os.environ.get("IRIS_SHOTS", "/tmp")

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a, **k):
        pass
    def do_GET(self):
        if self.path.split("?")[0] == "/favicon.svg":
            body = b"<svg xmlns='http://www.w3.org/2000/svg'/>"
            self.send_response(200)
            self.send_header("Content-Type", "image/svg+xml")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        return http.server.SimpleHTTPRequestHandler.do_GET(self)
    def do_POST(self):
        if self.path.split("?")[0] == "/api/stat":
            n = int(self.headers.get("Content-Length") or 0)
            if n:
                self.rfile.read(n)
            self.send_response(204)
            self.end_headers()
            return
        self.send_error(404)

handler = functools.partial(Handler, directory=ROOT)
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{PORT}"

F = []
def ck(name, cond, detail=""):
    print(("PASS" if cond else "FAIL"), name, "" if cond else f"-> {detail}")
    if not cond:
        F.append(name)

def watch(page):
    out = {"page": [], "console": [], "http": []}
    def take(msg):
        if msg.type != "error":
            return
        text = msg.text or ""
        if "Failed to load resource" in text:
            return
        out["console"].append(text)
    page.on("console", take)
    page.on("pageerror", lambda e: out["page"].append(str(e)))
    page.on("response", lambda r: out["http"].append(f"{r.status} {r.url}") if r.status >= 400 and "favicon" not in r.url else None)
    return out

def quiet(out):
    return not out["page"] and not out["console"] and not out["http"]

def fill(w, h, fn):
    rgba = [0] * (w * h * 4)
    for y in range(h):
        for x in range(w):
            r, g, b = fn(x, y)
            i = (y * w + x) * 4
            rgba[i] = r
            rgba[i + 1] = g
            rgba[i + 2] = b
            rgba[i + 3] = 255
    return rgba

def decode(spec):
    L = np.frombuffer(base64.b64decode(spec["L"]), dtype="<f4").copy()
    R = np.frombuffer(base64.b64decode(spec["R"]), dtype="<f4").copy()
    return spec["sr"], L, R

def rms(x, start=0):
    sl = x[start:]
    if not len(sl):
        return 0.0
    return float(np.sqrt(np.mean(sl * sl)))

def peak_hz(x, sr, start=0, fmin=40, fmax=8000):
    sl = x[start:]
    if len(sl) < 64:
        return 0.0
    window = np.hanning(len(sl))
    spec = np.abs(np.fft.rfft(sl * window))
    freqs = np.fft.rfftfreq(len(sl), 1 / sr)
    band = (freqs >= fmin) & (freqs <= fmax)
    spec = spec.copy()
    spec[~band] = 0
    return float(freqs[int(np.argmax(spec))])

def mag_at(x, sr, hz, start=0):
    sl = x[start:]
    n = np.arange(len(sl))
    w = 2 * math.pi * hz / sr
    re = float(np.sum(sl * np.cos(w * n)))
    im = float(np.sum(sl * -np.sin(w * n)))
    return math.hypot(re, im) / max(1, len(sl))

DENY = """
(() => {
  const deny = () => Promise.reject(new DOMException('A gesture is required', 'NotAllowedError'));
  if (!navigator.mediaDevices) navigator.mediaDevices = {};
  navigator.mediaDevices.getUserMedia = deny;
})();
"""

from playwright.sync_api import sync_playwright
_CANDIDATES = [
    os.environ.get("SYNTH_CHROMIUM", ""),
    "/usr/bin/google-chrome",
    "/opt/google/chrome/chrome",
    "/usr/bin/chromium",
]
CHROME = next(p for p in _CANDIDATES if p and os.path.exists(p))

with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=CHROME, args=[
        "--autoplay-policy=no-user-gesture-required",
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        "--no-sandbox",
    ])

    # ---------------------------------------------------------------- denied camera, controls, voice
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    pg.add_init_script(DENY)
    errs = watch(pg)
    pg.goto(BASE + "/synth/iris/")
    pg.wait_for_function("() => window.__iris && __iris.ready()", timeout=15000)
    pg.wait_for_function("() => __iris.state().camera === 'denied' && __iris.state().gate", timeout=8000)
    text = pg.locator("body").inner_text()
    ck("Iris: page names itself", "IRIS" in text and "camera" in text.lower(), text[:180])
    ck("Iris: how to play is on the page", "Scanline" in text and "Freeze" in text and "WAV" in text)
    ck("Iris: Turn on camera is the preview button", pg.locator("#irisCam").inner_text().strip() == "Turn on camera")
    ck("Iris: the camera button is in the preview", pg.evaluate("""() => {
      const b = document.getElementById('irisCam');
      const s = document.getElementById('irisStage');
      const br = b.getBoundingClientRect(); const sr = s.getBoundingClientRect();
      return br.width > 200 && br.height > 60 && br.top >= sr.top && br.bottom <= sr.bottom + 2;
    }"""))
    ck("Iris: picture fallback is offered", pg.locator("#irisFile").count() == 1 and "Use a picture" in text)
    ck("Iris: four modes", pg.locator("#irisModes button").count() == 4)
    ck("Iris: size control is S M L XL", [pg.locator(f'#irisSizes button[data-size="{s}"]').count() for s in ("S", "M", "L", "XL")] == [1, 1, 1, 1])
    ck("Iris: scale, root, snap, reverb, volume, freeze, rec",
       pg.locator("#irisScale").count() == 1 and pg.locator("#irisRootKey").count() == 1
       and pg.locator("#irisSnap").count() == 1 and pg.locator("#irisReverb").count() == 1
       and pg.locator("#irisLevel").count() == 1 and pg.locator("#irisFreeze").count() == 1
       and pg.locator("#irisRec").count() == 1)
    pg.evaluate("__iris.setPatch({ size: 'S' })")
    pg.wait_for_timeout(40)
    hS = pg.evaluate("__iris.state().previewH")
    pg.evaluate("__iris.setPatch({ size: 'XL' })")
    pg.wait_for_timeout(40)
    hXL = pg.evaluate("__iris.state().previewH")
    ck("Iris: XL preview is taller than S", hXL > hS + 80, (hS, hXL))
    pg.evaluate("__iris.setPatch({ size: 'M' })")
    pg.click('#irisModes button[data-mode="color"]')
    ck("Iris: color mode selects", pg.evaluate("__iris.state().mode") == "color")
    pg.select_option("#irisScale", "minor")
    pg.select_option("#irisRootKey", "62")
    pg.click("#irisSnap")
    ck("Iris: scale, root, and snap stick", pg.evaluate("__iris.state().scale") == "minor" and pg.evaluate("__iris.state().root") == 62 and pg.evaluate("__iris.state().snap") == False)
    pg.click("#irisSnap")

    bottom = fill(32, 32, lambda x, y: (255, 255, 255) if y >= 31 else (0, 0, 0))
    sr, L, R = decode(pg.evaluate("(a) => __iris.render(a)", {
        "patch": {"mode": "scanline", "scale": "off", "snap": False, "reverb": 0, "level": 0.9, "fLo": 220, "fHi": 1760},
        "rgba": bottom, "w": 32, "h": 32, "x": 16, "seconds": 1,
    }))
    f0 = pg.evaluate("() => __iris.bandHz(0, 32, 220, 1760)")
    got = peak_hz(L, sr, start=sr // 5)
    ck("Iris: a bright bottom row is the low partial", abs(got - f0) < 3 and rms(L, sr // 5) > 0.05 and rms(R, sr // 5) > 0.05, (round(got, 2), round(f0, 2), round(rms(L, sr // 5), 4)))

    low = fill(8, 32, lambda x, y: (255, 255, 255) if y >= 31 else (0, 0, 0))
    snap_hz = pg.evaluate("() => __iris.snapHz(100, 'major', 60, true)")
    sr, Ls, _ = decode(pg.evaluate("(a) => __iris.render(a)", {
        "patch": {"mode": "scanline", "scale": "major", "snap": True, "reverb": 0, "level": 0.9, "fLo": 100, "fHi": 1600, "root": 60},
        "rgba": low, "w": 8, "h": 32, "x": 4, "seconds": 1,
    }))
    sr, Lf, _ = decode(pg.evaluate("(a) => __iris.render(a)", {
        "patch": {"mode": "scanline", "scale": "off", "snap": False, "reverb": 0, "level": 0.9, "fLo": 100, "fHi": 1600, "root": 60},
        "rgba": low, "w": 8, "h": 32, "x": 4, "seconds": 1,
    }))
    ck("Iris: snap pulls the partial onto the scale", mag_at(Ls, sr, snap_hz, sr // 5) > mag_at(Ls, sr, 100, sr // 5) * 2, (round(snap_hz, 2), round(mag_at(Ls, sr, snap_hz, sr // 5), 4), round(mag_at(Ls, sr, 100, sr // 5), 4)))
    ck("Iris: with snap off the partial stays on the measured pitch", mag_at(Lf, sr, 100, sr // 5) > mag_at(Lf, sr, snap_hz, sr // 5) * 2)

    red = fill(16, 16, lambda x, y: (220, 10, 10))
    blue = fill(16, 16, lambda x, y: (10, 20, 220))
    black = fill(16, 16, lambda x, y: (0, 0, 0))
    dim = fill(16, 16, lambda x, y: (28, 0, 0))
    color_patch = {"mode": "color", "scale": "off", "snap": False, "reverb": 0, "level": 0.9, "root": 60}
    sr, Lred, _ = decode(pg.evaluate("(a) => __iris.render(a)", {"patch": color_patch, "rgba": red, "w": 16, "h": 16, "seconds": 1}))
    sr, Lblue, _ = decode(pg.evaluate("(a) => __iris.render(a)", {"patch": color_patch, "rgba": blue, "w": 16, "h": 16, "seconds": 1}))
    sr, Lblk, _ = decode(pg.evaluate("(a) => __iris.render(a)", {"patch": color_patch, "rgba": black, "w": 16, "h": 16, "seconds": 1}))
    sr, Ldim, _ = decode(pg.evaluate("(a) => __iris.render(a)", {"patch": color_patch, "rgba": dim, "w": 16, "h": 16, "seconds": 1}))
    hzC = pg.evaluate("() => __iris.chordOf(0, 'off', 60).map(n => 440 * Math.pow(2, (n - 69) / 12))")
    hueB = pg.evaluate("(a) => __iris.dominantColor(a.rgba, a.w, a.h).hue", {"rgba": blue, "w": 16, "h": 16})
    hzB = pg.evaluate("(h) => __iris.chordOf(h, 'off', 60).map(n => 440 * Math.pow(2, (n - 69) / 12))", hueB)
    red_on = sum(mag_at(Lred, sr, hz, sr // 5) for hz in hzC)
    blue_on_red = sum(mag_at(Lblue, sr, hz, sr // 5) for hz in hzC)
    blue_on = sum(mag_at(Lblue, sr, hz, sr // 5) for hz in hzB)
    ck("Iris: red sings its chord and black is silent", red_on > 0.05 and rms(Lblk, sr // 5) < 0.001, (round(red_on, 4), round(rms(Lblk, sr // 5), 6)))
    ck("Iris: a different hue sings a different chord", blue_on > blue_on_red * 1.5, (round(blue_on, 4), round(blue_on_red, 4), [round(h, 1) for h in hzB]))
    ck("Iris: brightness turns the color voice down", rms(Lred, sr // 5) > rms(Ldim, sr // 5) * 2, (round(rms(Lred, sr // 5), 4), round(rms(Ldim, sr // 5), 4)))

    prev = fill(80, 60, lambda x, y: (0, 0, 0))
    curr = fill(80, 60, lambda x, y: (255, 255, 255) if x < 10 and y >= 50 else (0, 0, 0))
    sr, Lm, Rm = decode(pg.evaluate("(a) => __iris.render(a)", {
        "patch": {"mode": "motion", "scale": "major", "snap": True, "reverb": 0, "level": 0.9, "root": 60},
        "rgba": curr, "w": 80, "h": 60, "prev": prev, "seconds": 1,
    }))
    cell = pg.evaluate("() => 440 * Math.pow(2, (__iris.cellMidi(0, 5, 8, 6, 'major', 60, true) - 69) / 12)")
    ck("Iris: motion in the low-left cell is that pitch", abs(peak_hz(Lm, sr, sr // 5) - cell) < 4 and rms(Lm, sr // 5) > 0.04 and rms(Rm, sr // 5) > 0.02, (round(peak_hz(Lm, sr, sr // 5), 2), round(cell, 2)))
    sr, Lstill, _ = decode(pg.evaluate("(a) => __iris.render(a)", {
        "patch": {"mode": "motion", "scale": "major", "snap": True, "reverb": 0, "level": 0.9, "root": 60},
        "rgba": prev, "w": 80, "h": 60, "prev": prev, "seconds": 0.6,
    }))
    ck("Iris: a still frame does not keep triggering motion", rms(Lstill, sr // 8) < 0.01, round(rms(Lstill, sr // 8), 5))

    flat = fill(64, 48, lambda x, y: (40, 40, 40))
    checks = fill(64, 48, lambda x, y: (255, 255, 255) if (x + y) & 1 else (0, 0, 0))
    edge_patch = {"mode": "edges", "reverb": 0, "level": 0.9, "scale": "off", "snap": False}
    sr, Le, _ = decode(pg.evaluate("(a) => __iris.render(a)", {"patch": edge_patch, "rgba": checks, "w": 64, "h": 48, "seconds": 0.8}))
    sr, Lf, _ = decode(pg.evaluate("(a) => __iris.render(a)", {"patch": edge_patch, "rgba": flat, "w": 64, "h": 48, "seconds": 0.8}))
    ck("Iris: edges are louder than a flat frame", rms(Le, sr // 8) > 0.05 and rms(Le, sr // 8) > rms(Lf, sr // 8) * 8, (round(rms(Le, sr // 8), 4), round(rms(Lf, sr // 8), 5)))

    sr, Lwet, _ = decode(pg.evaluate("(a) => __iris.render(a)", {
        "patch": {"mode": "color", "scale": "off", "reverb": 0.85, "level": 0.9, "root": 60},
        "frames": [
            {"rgba": red, "w": 16, "h": 16, "seconds": 0.25},
            {"vision": {"bands": [0] * 32, "hue": 0, "sat": 0, "val": 0, "motion": [0] * 48, "edge": 0, "texture": 0}, "seconds": 0.45},
        ],
    }))
    sr, Ldry, _ = decode(pg.evaluate("(a) => __iris.render(a)", {
        "patch": {"mode": "color", "scale": "off", "reverb": 0, "level": 0.9, "root": 60},
        "frames": [
            {"rgba": red, "w": 16, "h": 16, "seconds": 0.25},
            {"vision": {"bands": [0] * 32, "hue": 0, "sat": 0, "val": 0, "motion": [0] * 48, "edge": 0, "texture": 0}, "seconds": 0.45},
        ],
    }))
    wet_tail = rms(Lwet, int(sr * 0.4))
    dry_tail = rms(Ldry, int(sr * 0.4))
    ck("Iris: reverb leaves a tail after the picture goes dark", wet_tail > dry_tail * 4, (round(wet_tail, 5), round(dry_tail, 5)))

    norm = pg.evaluate("() => __iris.normalizeIris({ mode: 'nope', level: 4, root: 2, speed: 0, size: 'XL', snap: false })")
    ck("Iris: a bad patch normalizes", norm["mode"] == "scanline" and norm["level"] == 1 and norm["root"] == 36 and norm["size"] == "XL" and norm["snap"] == False and norm["device"] == "iris", norm)

    pg.evaluate("__iris.holdDownload(true)")
    pg.evaluate("__iris.setMode('scanline')")
    pg.evaluate("""() => __iris.useFrame({
      w: 32, h: 32,
      rgba: Array.from({ length: 32 * 32 * 4 }, (_, i) => (Math.floor(i / 4) % 32 >= 16 ? 255 : 0))
    })""")
    pg.wait_for_function("() => __iris.state().booted && __iris.state().source === 'still'", timeout=8000)
    pg.wait_for_function("() => __iris.peak() > 0.01", timeout=4000)
    ck("Iris: the live voice follows a fed frame", pg.evaluate("__iris.peak()") > 0.01)
    ck("Iris: a picture hides the camera gate", pg.evaluate("__iris.state().gate") == False and pg.evaluate("__iris.state().source") == "still")
    pg.click("#irisFreeze")
    ck("Iris: freeze holds the frame", pg.evaluate("__iris.state().freeze") == True and pg.locator("#irisFreeze").get_attribute("aria-pressed") == "true")
    pg.click("#irisFreeze")
    ck("Iris: freeze releases", pg.evaluate("__iris.state().freeze") == False)

    pg.evaluate("""async () => {
      const c = document.createElement('canvas'); c.width = 24; c.height = 24;
      const g = c.getContext('2d'); g.fillStyle = '#20c060'; g.fillRect(0, 0, 24, 24);
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      const file = new File([blob], 'leaf.png', { type: 'image/png' });
      const dt = new DataTransfer(); dt.items.add(file);
      const input = document.getElementById('irisFile');
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }""")
    pg.wait_for_function("() => __iris.state().source === 'still'", timeout=4000)
    ck("Iris: an image file is read locally", pg.evaluate("__iris.state().source") == "still")

    hosts = []
    pg.on("request", lambda r: hosts.append(r.url))
    pg.click("#irisRec")
    pg.wait_for_timeout(350)
    pg.click("#irisRec")
    pg.wait_for_function("() => __iris.lastWav() && __iris.lastWav().length > 200", timeout=4000)
    wav = pg.evaluate("""() => {
      const w = __iris.lastWav();
      let nonzero = 0;
      for (let i = 44; i < w.length; i++) if (w[i]) nonzero++;
      return { n: w.length, head: String.fromCharCode(w[0], w[1], w[2], w[3], w[8], w[9], w[10], w[11]), nonzero };
    }""")
    ck("Iris: rec writes a WAV", wav["head"] == "RIFFWAVE" and wav["n"] > 1000 and wav["nonzero"] > 100, wav)
    off = [u for u in hosts if not u.startswith(BASE)]
    ck("Iris: recording and the picture made no outside request", not off, off[:4])
    ck("Iris: no console errors", quiet(errs), errs)
    pg.screenshot(path=os.path.join(SHOTS, "iris-desktop.png"), full_page=True)
    pg.close()

    # ---------------------------------------------------------------- camera on by default
    live = b.new_page(viewport={"width": 1280, "height": 860})
    lerr = watch(live)
    live.goto(BASE + "/synth/iris/")
    live.wait_for_function("() => window.__iris && __iris.ready()", timeout=15000)
    live.wait_for_function("() => __iris.state().camera === 'live' && __iris.state().source === 'camera'", timeout=8000)
    st = live.evaluate("__iris.state()")
    ck("Iris: the camera turns on by itself", st["camera"] == "live" and st["source"] == "camera" and st["gate"] == False and st["mirrored"] == True, st)
    ck("Iris: the prompt button stays hidden once the camera is live", live.locator("#irisCam").is_visible() == False)
    live.wait_for_timeout(400)
    ck("Iris: a live camera is not silent", live.evaluate("__iris.peak()") > 0.005, live.evaluate("__iris.peak()"))
    ck("Iris: live camera, no console errors", quiet(lerr), lerr)
    live.screenshot(path=os.path.join(SHOTS, "iris-live.png"), full_page=True)
    live.close()

    # ---------------------------------------------------------------- phone, denied, the button is still obvious
    ph = b.new_page(viewport={"width": 390, "height": 780})
    ph.add_init_script(DENY)
    ph.goto(BASE + "/synth/iris/")
    ph.wait_for_function("() => __iris && __iris.state().gate", timeout=8000)
    box = ph.locator("#irisCam").bounding_box()
    ck("Iris: the camera button stays large on a phone", box and box["width"] > 180 and box["height"] >= 64, box)
    small = ph.evaluate("""() => [...document.querySelectorAll('#irisSizes button, #irisModes button, #irisFreeze, #irisRec, #irisSnap')]
      .filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 36 || r.width < 28; })
      .map(e => (e.textContent || '').trim() + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))""")
    ck("Iris: controls are tappable on a phone", not small, small)
    ph.screenshot(path=os.path.join(SHOTS, "iris-phone.png"), full_page=True)
    ph.close()

    # ---------------------------------------------------------------- rack and nav link
    rack = b.new_page(viewport={"width": 1280, "height": 800})
    rack.goto(BASE + "/synth/")
    rack.wait_for_selector(".racklinks")
    href = rack.locator('a.devlink[href="/synth/iris/"]').inner_text()
    ck("Iris: the rack links it", "IRIS" in href and "camera" in href.lower(), href)
    rack.close()

    b.close()

print("ALL PASS" if not F else f"{len(F)} FAILED: " + "; ".join(F))
raise SystemExit(1 if F else 0)
