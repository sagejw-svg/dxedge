#!/usr/bin/env python3
"""Aether (/synth/hand-aether/) — a two-hand theremin in the browser.

The camera is requested on load. If that is refused, the mouse plays and a
Turn on camera button sits on the picture. Choosing the mouse is remembered.
Mapping, scale snap, calibration, mute, vibrato, reverb and the filter are
measured. A refused camera must not download the hand model.

Run: python3 scripts/test_hand_aether.py
"""
import base64, http.server, math, os, socketserver, threading, functools
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public"))
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PORT = int(os.environ.get("AETHER_PORT", "8798"))
FAVICON = b"<svg xmlns='http://www.w3.org/2000/svg'/>"

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a, **k): pass
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
            if n: self.rfile.read(n)
            self.send_response(204)
            self.end_headers()
            return
        self.send_error(501)

handler = functools.partial(Handler, directory=ROOT)
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{PORT}"

F = []
def ck(name, cond, detail=""):
    print(("PASS" if cond else "FAIL"), name, "" if cond else f"-> {detail}")
    if not cond: F.append(name)

def dec(r):
    L = np.frombuffer(base64.b64decode(r["L"]), dtype=np.float32).astype(np.float64)
    R = np.frombuffer(base64.b64decode(r["R"]), dtype=np.float32).astype(np.float64)
    return L, R

def tone_amp(x, f, sr):
    x = x - np.mean(x)
    t = np.arange(len(x)) / sr
    w = np.hanning(len(x))
    return 2 * abs(np.sum(x * w * np.exp(-2j * np.pi * f * t))) / max(np.sum(w), 1e-12)

def rms(x):
    return float(np.sqrt(np.mean(np.square(x))))

def zc_spread(x):
    x = x - np.mean(x)
    idx = np.where(np.diff(np.signbit(x)))[0]
    if len(idx) < 8: return 0.0
    dt = np.diff(idx).astype(np.float64)
    return float(np.std(dt) / max(np.mean(dt), 1e-9))

from playwright.sync_api import sync_playwright
_CANDIDATES = [
    os.environ.get("SYNTH_CHROMIUM", ""),
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    "/opt/google/chrome/chrome",
    "/usr/local/bin/chrome",
]
CHROME = next(p for p in _CANDIDATES if p and os.path.exists(p))

rack = open(os.path.join(ROOT, "synth", "index.html"), encoding="utf-8").read()
ck("rack lists Aether", 'href="/synth/hand-aether/"' in rack and "AETHER" in rack)
app = open(os.path.join(REPO, "frontend", "src", "App.jsx"), encoding="utf-8").read()
ck("nav has an Aether tab", "id: 'aether'" in app and "label: 'Aether'" in app and "<Aether />" in app)
sw = open(os.path.join(ROOT, "sw.js"), encoding="utf-8").read()
ck("service worker still treats /synth/ as mutable", "url.pathname.startsWith('/synth/')" in sw)
ck("service worker cache bumped for this frontend change", "dxedge-v116" in sw)

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=CHROME, args=["--autoplay-policy=no-user-gesture-required"])
    context = browser.new_context(viewport={"width": 1280, "height": 900})
    context.add_init_script("""
      window.__camCalls = 0;
      const md = navigator.mediaDevices || (navigator.mediaDevices = {});
      md.getUserMedia = () => {
        window.__camCalls = (window.__camCalls || 0) + 1;
        return Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
      };
    """)
    pg = context.new_page()
    errors = []
    requests = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" and "Failed to load resource" not in (m.text or "") else None)
    pg.on("request", lambda r: requests.append(r.url))
    pg.goto(BASE + "/synth/hand-aether/")
    pg.wait_for_function("window.__aether && __aether.ready()", timeout=20000)
    body = pg.locator("body").inner_text()
    ck("page names Aether and says the picture stays here", "Aether" in body and "not recorded" in body and "not uploaded" in body)
    ck("how to play is on the page", "Right hand" in body and "vibrato" in body.lower() and "reverb" in body.lower() and "fist" in body.lower())
    ck("mouse fallback is offered", pg.locator("#mouseBtn").count() == 1 and "Play with the mouse" in body)
    ck("size control is S M L XL", [pg.locator(f'.sizes button[data-size="{s}"]').count() for s in "s m l xl".split()] == [1, 1, 1, 1])
    ck("page load asks for the camera", pg.evaluate("() => window.__camCalls === 1"))
    ck("a refused camera falls back to the mouse", pg.evaluate("() => __aether.mode() === 'mouse'") and "did not allow" in pg.locator("#status").inner_text())
    stage_box = pg.locator("#stage").bounding_box()
    cam_box = pg.locator("#stageCam").bounding_box()
    ck("Turn on camera sits on the picture",
       pg.locator("#stageCam").inner_text().strip() == "Turn on camera" and cam_box and stage_box
       and cam_box["width"] >= 160 and cam_box["height"] >= 64
       and cam_box["x"] >= stage_box["x"] - 1 and cam_box["y"] >= stage_box["y"] - 1
       and cam_box["x"] + cam_box["width"] <= stage_box["x"] + stage_box["width"] + 1
       and cam_box["y"] + cam_box["height"] <= stage_box["y"] + stage_box["height"] + 1,
       (cam_box, stage_box))
    leaked = [u for u in requests if "mediapipe" in u or "googleapis" in u or "jsdelivr" in u]
    ck("a refused camera does not fetch the hand model", not leaked, leaked)
    ck("no page errors on load", not errors, errors)

    pg.evaluate("() => { window.__camCalls = 0 }")
    pg.click("#mouseBtn")
    pg.wait_for_function("() => __aether.mode() === 'mouse'")
    ck("choosing the mouse leaves the camera alone", pg.evaluate("() => window.__camCalls === 0"))
    ck("choosing the mouse is remembered", pg.evaluate("""() => localStorage.getItem('dxedge-aether-input') === '"mouse"'"""))
    pg.reload()
    pg.wait_for_function("window.__aether && __aether.ready()", timeout=20000)
    ck("a remembered mouse choice does not ask again", pg.evaluate("() => !window.__camCalls && __aether.mode() === 'mouse' && !document.getElementById('stageCam').hidden"))
    ck("the video element has no uploaded source", pg.evaluate("() => !document.getElementById('cam').srcObject && !document.getElementById('cam').getAttribute('src')"))

    pg.evaluate("""() => {
      __aether.setMouse({ filter: 0.55, vibrato: 0, reverb: 0, mute: false, space: false });
      const smooth = document.getElementById('smooth');
      smooth.value = '1';
      smooth.dispatchEvent(new Event('input', { bubbles: true }));
      const latency = document.getElementById('latency');
      latency.value = '8';
      latency.dispatchEvent(new Event('input', { bubbles: true }));
    }""")
    low = pg.evaluate("""() => { __aether.pointer(0.22, 0.8); return __aether.settle(10, 0.05); }""")
    high = pg.evaluate("""() => { __aether.pointer(0.86, 0.18); return __aether.settle(10, 0.05); }""")
    ck("right-hand X raises the pitch", high["hz"] > low["hz"] * 1.4, (low["hz"], high["hz"], low["note"], high["note"]))
    ck("right-hand Y raises the volume", high["volume"] > low["volume"] + 0.35, (low["volume"], high["volume"]))
    pg.locator("#view").scroll_into_view_if_needed()
    box = pg.locator("#view").bounding_box()
    pg.mouse.move(box["x"] + box["width"] * 0.22, box["y"] + box["height"] * 0.82)
    pg.wait_for_timeout(120)
    edge_low = pg.evaluate("() => __aether.raw()")
    pg.mouse.move(box["x"] + box["width"] * 0.84, box["y"] + box["height"] * 0.16)
    pg.wait_for_timeout(120)
    edge_high = pg.evaluate("() => __aether.raw()")
    ck("the picture tracks the mouse", edge_high["x"] > edge_low["x"] + 0.4 and edge_high["y"] < edge_low["y"] - 0.4, (edge_low["x"], edge_low["y"], edge_high["x"], edge_high["y"]))

    pg.evaluate("""() => { document.getElementById('snapBtn').click(); }""")
    # snap starts on; one click turns it off
    cont = pg.evaluate("""() => {
      __aether.pointer(0.40, 0.4); const a = __aether.settle(8, 0.05);
      __aether.pointer(0.414, 0.4); const b = __aether.settle(8, 0.05);
      return { a: a.hz, b: b.hz, snap: __aether.settings().snap };
    }""")
    semis = abs(12 * math.log2(cont["b"] / cont["a"])) if cont["a"] and cont["b"] else 99
    ck("snap off glides by less than a semitone", cont["snap"] is False and 0.05 < semis < 1.0, (cont, semis))
    pg.evaluate("""() => { document.getElementById('snapBtn').click(); document.getElementById('scalePick').value = 'major'; document.getElementById('scalePick').dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('rootPick').value = '0'; document.getElementById('rootPick').dispatchEvent(new Event('change', { bubbles: true })); }""")
    notes = pg.evaluate("""() => {
      const major = new Set([0, 2, 4, 5, 7, 9, 11]);
      const out = [];
      for (let x = 0.18; x <= 0.9; x += 0.07) {
        __aether.pointer(x, 0.35);
        const s = __aether.settle(8, 0.04);
        out.push(Math.round(s.midi));
      }
      return { midi: out, snap: __aether.settings().snap, bad: out.filter(m => !major.has(((m % 12) + 12) % 12)) };
    }""")
    ck("snap to C major lands on scale tones", notes["snap"] is True and not notes["bad"] and len(set(notes["midi"])) >= 4, notes)

    pg.select_option("#scalePick", "pentatonic")
    penta = pg.evaluate("""() => {
      const scale = new Set([0, 2, 4, 7, 9]);
      __aether.pointer(0.55, 0.3);
      const s = __aether.settle(8, 0.04);
      const pc = ((Math.round(s.midi) % 12) + 12) % 12;
      return { pc, ok: scale.has(pc), scale: __aether.settings().scale };
    }""")
    ck("the scale picker changes the snap", penta["scale"] == "pentatonic" and penta["ok"], penta)

    filt = pg.evaluate("""() => {
      const el = document.getElementById('filterSlider');
      el.value = '0.08'; el.dispatchEvent(new Event('input', { bubbles: true }));
      const dark = __aether.settle(6, 0.04).cutoff;
      el.value = '0.95'; el.dispatchEvent(new Event('input', { bubbles: true }));
      const bright = __aether.settle(6, 0.04).cutoff;
      return { dark, bright };
    }""")
    ck("distance slider opens the filter", filt["bright"] > filt["dark"] * 3, filt)

    pg.evaluate("""() => { const el = document.getElementById('latency'); el.value = '140'; el.dispatchEvent(new Event('input', { bubbles: true })); }""")
    ck("latency tuning is wired", pg.evaluate("() => __aether.state().latency") == 140)
    slow = pg.evaluate("""() => {
      const el = document.getElementById('smooth');
      el.value = '1'; el.dispatchEvent(new Event('input', { bubbles: true }));
      __aether.pointer(0.2, 0.4); __aether.settle(8, 0.05);
      el.value = '0'; el.dispatchEvent(new Event('input', { bubbles: true }));
      __aether.pointer(0.9, 0.4);
      const mid = __aether.stepOnce(0.02);
      el.value = '1'; el.dispatchEvent(new Event('input', { bubbles: true }));
      return mid.pitch01;
    }""")
    ck("heavy smoothing does not jump to the new pitch", slow < 0.55, slow)

    pg.evaluate("""() => { __aether.setSize('s'); }""")
    h_s = pg.evaluate("() => document.getElementById('stage').getBoundingClientRect().height")
    pg.evaluate("""() => { __aether.setSize('xl'); }""")
    pg.wait_for_timeout(50)
    h_xl = pg.evaluate("() => document.getElementById('stage').getBoundingClientRect().height")
    ck("XL is a larger stage than S", h_xl > h_s + 80, (h_s, h_xl))
    pg.evaluate("""() => { __aether.setSize('m'); }""")

    pg.evaluate("""() => { __aether.beginCalibration(); __aether.pointer(0.12, 0.9); __aether.settle(2, 0.02); __aether.pointer(0.9, 0.1); __aether.settle(2, 0.02); }""")
    calibrated = pg.evaluate("""() => __aether.endCalibration()""")
    ck("calibration learns the pitch and volume corners", calibrated["x0"] < 0.2 and calibrated["x1"] > 0.8 and calibrated["y0"] > calibrated["y1"], calibrated)
    pg.evaluate("""() => { __aether.beginCalibration(); }""")
    span_cal = pg.evaluate("""() => {
      const near = __aether.synthetic({ x: 0.5, y: 0.4, span: 0.30, spread: 0.8 });
      const far = __aether.synthetic({ x: 0.5, y: 0.4, span: 0.06, spread: 0.8 });
      __aether.ingest([{ label: 'Right', landmarks: near }]); __aether.settle(2, 0.02);
      __aether.ingest([{ label: 'Right', landmarks: far }]); __aether.settle(2, 0.02);
      return __aether.endCalibration();
    }""")
    ck("calibration learns near and far", span_cal["spanNear"] > span_cal["spanFar"] + 0.05, span_cal)

    gesture = pg.evaluate("""() => {
      __aether.release();
      const right = __aether.synthetic({ x: 0.7, y: 0.22, span: 0.24, spread: 0.8 });
      const pinching = __aether.synthetic({ x: 0.28, y: 0.5, pinch: 1, spread: 0.15 });
      const open = __aether.synthetic({ x: 0.28, y: 0.5, pinch: 0, spread: 1 });
      const fist = __aether.synthetic({ x: 0.7, y: 0.22, fist: true });
      __aether.ingest([{ label: 'Right', landmarks: right }, { label: 'Left', landmarks: pinching }]);
      const pinched = __aether.settle(8, 0.04);
      __aether.ingest([{ label: 'Right', landmarks: right }, { label: 'Left', landmarks: open }]);
      const spread = __aether.settle(8, 0.04);
      __aether.ingest([{ label: 'Right', landmarks: fist }]);
      const muted = __aether.settle(4, 0.04);
      return { pinched, spread, muted };
    }""")
    ck("a left-hand pinch raises vibrato", gesture["pinched"]["vibrato"] > 0.75, gesture["pinched"]["vibrato"])
    ck("spread fingers raise reverb", gesture["spread"]["reverb"] > gesture["pinched"]["reverb"] + 0.4, (gesture["spread"]["reverb"], gesture["pinched"]["reverb"]))
    ck("a fist mutes", gesture["muted"]["muted"] is True and gesture["muted"]["volume"] == 0, gesture["muted"])

    swapped = pg.evaluate("""() => {
      const right = __aether.synthetic({ x: 0.82, y: 0.3, span: 0.2 });
      const left = __aether.synthetic({ x: 0.22, y: 0.6, span: 0.14 });
      document.getElementById('swapBtn').setAttribute('aria-pressed', 'false');
      __aether.settings().swap = false;
      __aether.ingest([{ label: 'Right', landmarks: right }, { label: 'Left', landmarks: left }]);
      const normal = __aether.settle(4, 0.03);
      document.getElementById('swapBtn').click();
      __aether.ingest([{ label: 'Right', landmarks: right }, { label: 'Left', landmarks: left }]);
      const flipped = __aether.settle(4, 0.03);
      document.getElementById('swapBtn').click();
      return { normal: normal.x, flipped: flipped.x, swap: __aether.settings().swap };
    }""")
    # raw x is on state via the smoothed pose's x, which is the unsmoothed palm x copied through
    ck("swap hands exchanges which hand plays pitch", swapped["normal"] > 0.7 and swapped["flipped"] < 0.4, swapped)

    ink = pg.evaluate("""() => {
      __aether.paint();
      const c = document.getElementById('view');
      const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < data.length; i += 32) if (data[i] > 16) n++;
      return n;
    }""")
    ck("the preview draws guides and a skeleton", ink > 40, ink)
    ck("still no outside model fetch after playing", not [u for u in requests if "mediapipe" in u or "googleapis" in u], requests)

    loud = dec(pg.evaluate("""() => __aether.render({ seconds: 0.6, tone: 'sine', frames: [{ t: 0, hz: 330, volume: 0.8, cutoff: 5000, vibrato: 0, reverb: 0 }] })"""))
    quiet = dec(pg.evaluate("""() => __aether.render({ seconds: 0.6, tone: 'sine', frames: [{ t: 0, hz: 330, volume: 0, cutoff: 5000, vibrato: 0, reverb: 0, muted: true }] })"""))
    ck("a sounding note is not silent", rms(loud[0][8000:24000]) > 0.02, rms(loud[0]))
    ck("mute renders silence", rms(quiet[0]) < 1e-4, rms(quiet[0]))

    def band(cutoff):
        buf = dec(pg.evaluate("""(cutoff) => __aether.render({ seconds: 0.7, tone: 'saw', frames: [{ t: 0, hz: 196, volume: 0.85, cutoff, vibrato: 0, reverb: 0 }] })""", cutoff))
        seg = buf[0][12000:28000]
        return tone_amp(seg, 196 * 3, 48000) / max(tone_amp(seg, 196, 48000), 1e-12)
    open_h = band(7000)
    closed_h = band(240)
    ck("a closer hand (open filter) keeps more of the harmonic", open_h > closed_h * 2, (open_h, closed_h))

    def tail(reverb):
        buf = dec(pg.evaluate("""(reverb) => __aether.render({
          seconds: 1.3, tone: 'sine',
          frames: [
            { t: 0, hz: 330, volume: 0.85, cutoff: 4000, vibrato: 0, reverb },
            { t: 0.28, hz: 330, volume: 0, cutoff: 4000, vibrato: 0, reverb },
          ],
        })""", reverb))
        return rms(buf[0][32000:52000])
    wet = tail(1)
    dry = tail(0)
    ck("spread-finger reverb leaves a tail", wet > dry * 4 and wet > 1e-4, (wet, dry))

    plain = dec(pg.evaluate("""() => __aether.render({ seconds: 0.8, tone: 'sine', frames: [{ t: 0, hz: 330, volume: 0.8, cutoff: 6000, vibrato: 0, reverb: 0 }] })"""))
    wide = dec(pg.evaluate("""() => __aether.render({ seconds: 0.8, tone: 'sine', frames: [{ t: 0, hz: 330, volume: 0.8, cutoff: 6000, vibrato: 1, reverb: 0 }] })"""))
    ck("pinch vibrato moves the pitch", zc_spread(wide[0][4000:]) > zc_spread(plain[0][4000:]) * 2, (zc_spread(plain[0][4000:]), zc_spread(wide[0][4000:])))

    ck("no page errors after playing", not errors, errors)
    pg.screenshot(path="/tmp/aether-desktop.png")

    phone = context.new_page()
    phone.set_viewport_size({"width": 390, "height": 844})
    perr = []
    phone.on("pageerror", lambda e: perr.append(str(e)))
    phone.goto(BASE + "/synth/hand-aether/")
    phone.wait_for_function("window.__aether && __aether.ready()", timeout=20000)
    phone.click("#mouseBtn")
    overflow = phone.evaluate("() => document.documentElement.scrollWidth <= innerWidth + 1")
    small = phone.evaluate("""() => [...document.querySelectorAll('button, select, input[type="range"]')]
      .filter(e => e.offsetParent)
      .filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; })
      .map(e => (e.id || e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))""")
    ck("390px: no horizontal scroll", overflow, phone.evaluate("[document.documentElement.scrollWidth, innerWidth]"))
    ck("390px: controls are at least 44px", not small, small)
    ck("390px: no page errors", not perr, perr)
    phone.screenshot(path="/tmp/aether-phone.png")

    pg.evaluate("() => { window.__camCalls = 0 }")
    pg.click("#stageCam")
    pg.wait_for_function("() => window.__camCalls === 1 && document.getElementById('status').textContent.includes('did not allow')")
    ck("Turn on camera asks again and stays on the mouse if refused", pg.evaluate("() => window.__camCalls === 1 && __aether.mode() === 'mouse'") and pg.locator("#stageCam").is_visible() and "did not allow" in pg.locator("#status").inner_text())
    leaked = [u for u in requests if "mediapipe" in u or "googleapis" in u]
    ck("a denied camera does not upload video", not leaked, leaked)

    browser.close()

print()
print("ALL PASS" if not F else f"{len(F)} FAILED: " + "; ".join(F))
raise SystemExit(1 if F else 0)
