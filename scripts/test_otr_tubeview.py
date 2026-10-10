#!/usr/bin/env python3
"""Tube view for the Old Time Radio player (/otr/): the tube big, with zoom and pan, seven filters,
and Brightness / Response / Speed / Flicker glow controls.

Filter and brightness checks read pixels back from the canvas. Response and speed checks feed a
fixed level into the glow (window.__otr.adv.tv.level) so they don't depend on what is playing.

Run:  python3 scripts/test_otr_tubeview.py
"""
import http.server, socketserver, threading, functools, sys, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public"))
PORT = 8783
SP = os.environ.get("OTR_SHOTS", "/tmp")
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
handler.log_message = lambda *a, **k: None
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{PORT}/otr/"
F = []
def ck(name, cond, detail=""):
    print(("PASS" if cond else "FAIL"), name, "" if cond else f"-> {detail}")
    if not cond: F.append(name)

from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get("OTR_CHROMIUM", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"))
    pg = b.new_page(viewport={"width": 1280, "height": 820}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(BASE); pg.wait_for_function("window.__otr && __otr.ready()", timeout=20000)
    TV = lambda js: pg.evaluate("__otr.adv.tv." + js)

    # ---- opening and closing ----
    pg.click("#advBtn"); pg.wait_for_timeout(200)
    pg.click("#tubeZoom"); pg.wait_for_timeout(300)
    ck("zoom button opens the tube view", TV("isOpen()") and pg.is_visible("#tvCv"))
    big = pg.evaluate("document.getElementById('tvCv').clientHeight"); small = pg.evaluate("document.getElementById('tubeCv').clientHeight")
    ck("the tube is drawn much larger than in the rack", big > small * 3, (big, small))
    ck("standby notice while processing is off", pg.is_visible("#tvStandby"))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(100)
    ck("Esc closes it", not TV("isOpen()"))
    pg.click("#tubeCv"); pg.wait_for_timeout(200)
    ck("clicking the tube in the rack opens it too", TV("isOpen()"))

    # ---- visual settings never touch the sound ----
    pg.focus("#tvKnobs .knob"); pg.keyboard.press("ArrowDown")
    ck("glow knobs do not turn processing on", not pg.evaluate("__otr.adv.state().on") and pg.evaluate("__otr.adv.state().tvBright") == 99)
    pg.click("#tvLight"); pg.wait_for_timeout(200)
    st = pg.evaluate("__otr.adv.state()")
    ck("Light it up turns processing and the tube stage on", st["on"] and st["tubeOn"] and not pg.is_visible("#tvStandby"), st)
    pg.wait_for_function("__otr.adv.tv.state().heat > 0.95", timeout=8000)
    ck("the tube warms up", TV("state()")["heat"] > 0.95)

    # ---- filters ----
    TV("level(0.5)"); pg.evaluate("__otr.adv.knob('tvBright', 100)")
    col = {}
    for lk in TV("looks()"):
        TV(f"look('{lk}')"); pg.wait_for_timeout(350); col[lk] = TV("sample('big')")
        ck(f"{lk}: filter selected and named in the view", pg.evaluate("__otr.adv.state().tvFilter") == lk and pg.get_attribute(f"#tvLooks .tchip[data-id='{lk}']", "aria-pressed") == "true")
    ck("Natural glows warm (more red than blue)", col["natural"]["r"] > col["natural"]["b"] * 1.3, col["natural"])
    ck("Black light is violet (more blue than red)", col["blacklight"]["b"] > col["blacklight"]["r"] * 1.3, col["blacklight"])
    ck("Thermal runs hot in the middle (red dominant)", col["thermal"]["r"] > col["thermal"]["g"] * 1.5, col["thermal"])
    ck("Neon is blue-magenta", col["neon"]["b"] > col["neon"]["g"] * 1.4, col["neon"])
    ck("X-ray is the brightest, bluish white", col["xray"]["lum"] > col["natural"]["lum"] and col["xray"]["b"] >= col["xray"]["r"], col["xray"])
    ck("Night vision and Vintage photo apply their filter to the canvas", "hue-rotate" in col["night"]["filter"] and "sepia" in col["vintage"]["filter"], (col["night"]["filter"], col["vintage"]["filter"]))
    TV("look('blacklight')"); pg.wait_for_timeout(200)
    ck("the filter also shows on the tube in the rack", TV("sample('rack')")["b"] > TV("sample('rack')")["r"])
    ck("thermal legend only in Thermal", not pg.is_visible("#tvLegend"))
    TV("look('natural')")

    # ---- brightness ----
    pg.evaluate("__otr.adv.knob('tvBright', 20)"); pg.wait_for_timeout(300); lo = TV("sample('big')")["lum"]
    pg.evaluate("__otr.adv.knob('tvBright', 200)"); pg.wait_for_timeout(300); hi = TV("sample('big')")["lum"]
    ck("Brightness 200% is visibly brighter than 20%", hi > lo + 6, (lo, hi))
    pg.evaluate("__otr.adv.knob('tvBright', 100)")

    # ---- response and speed ----
    def settle(level, ms=1500):
        TV(f"level({level})"); pg.wait_for_timeout(ms); return TV("state()")["glow"]
    pg.evaluate("__otr.adv.knob('tvSpeed', 50)")
    pg.evaluate("__otr.adv.knob('tvResp', 0)"); g0 = settle(0.8)
    ck("Response 0% holds a steady glow whatever the music", abs(g0 - 0.3) < 0.05 and abs(settle(0.1) - 0.3) < 0.05, g0)
    pg.evaluate("__otr.adv.knob('tvResp', 100)"); g1 = settle(0.6)
    ck("Response 100% follows the level", abs(g1 - 0.6) < 0.06, g1)
    pg.evaluate("__otr.adv.knob('tvResp', 200)"); g2 = settle(0.3)
    ck("Response 200% exaggerates it", g2 > 0.6, g2)
    pg.evaluate("__otr.adv.knob('tvResp', 100)")
    pg.evaluate("__otr.adv.knob('tvSpeed', 0)"); settle(0, 2500); TV("level(1)"); pg.wait_for_timeout(150); slow = TV("state()")["glow"]
    pg.evaluate("__otr.adv.knob('tvSpeed', 100)"); settle(0, 600); TV("level(1)"); pg.wait_for_timeout(150); fast = TV("state()")["glow"]
    ck("Speed: fast catches up within 150 ms, slow is still rising", fast > 0.9 and slow < 0.45, (slow, fast))
    pg.evaluate("__otr.adv.knob('tvSpeed', 50)"); TV("level(null)")

    # ---- zoom and pan ----
    pg.click("#tvIn"); z = TV("state()")["z"]
    ck("+ zooms in", abs(z - 1.4) < 0.01, z)
    box = pg.locator("#tvCv").bounding_box(); cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    pg.mouse.move(cx, cy); pg.mouse.wheel(0, -400); pg.wait_for_timeout(100)
    ck("scroll wheel zooms in", TV("state()")["z"] > 1.6, TV("state()"))
    before = TV("state()")["x"]; pg.mouse.move(cx, cy); pg.mouse.down(); pg.mouse.move(cx + 120, cy, steps=6); pg.mouse.up()
    ck("dragging pans the view", TV("state()")["x"] < before - 1, (before, TV("state()")))
    for _ in range(12): pg.click("#tvIn")
    ck("zoom tops out at 8x", abs(TV("state()")["z"] - 8) < 1e-6, TV("state()"))
    pg.click("#tvFit"); ck("fit resets zoom and pan", TV("state()") ["z"] == 1 and TV("state()")["x"] == 0)
    pg.mouse.dblclick(cx, cy); ck("double-click jumps in to 3x", abs(TV("state()")["z"] - 3) < 0.01, TV("state()"))
    pg.mouse.dblclick(cx, cy); ck("and double-click again goes back out", TV("state()")["z"] == 1)
    pg.click("#tvClose"); pg.click("#tubeZoom"); pg.keyboard.press("+"); pg.keyboard.press("ArrowRight")
    s = TV("state()"); ck("keyboard + zooms and arrows pan", s["z"] > 1.3 and s["x"] > 0, s)
    pg.keyboard.press("0"); ck("keyboard 0 fits", TV("state()")["z"] == 1)
    pg.locator("#tvStage").screenshot(path=f"{SP}/otr_tubeview_desktop.png")

    # ---- tube chips in the view, persistence ----
    pg.click("#tvTubes .tchip[data-id='EL34']"); pg.wait_for_timeout(100)
    ck("tube chips in the view swap the tube", pg.evaluate("__otr.adv.state().tube") == "EL34" and pg.inner_text("#tvName") == "EL34")
    TV("look('thermal')"); pg.evaluate("__otr.adv.knob('tvFlicker', 80)"); pg.wait_for_timeout(400)
    ck("thermal legend shows in Thermal", pg.is_visible("#tvLegend"))
    pg.reload(); pg.wait_for_function("window.__otr && __otr.ready()", timeout=20000)
    st = pg.evaluate("__otr.adv.state()")
    ck("filter and glow settings survive a reload", st["tvFilter"] == "thermal" and st["tvFlicker"] == 80 and st["tvResp"] == 100, st)
    ck("no page errors (desktop)", not errs, errs[:3])

    m = b.new_page(viewport={"width": 375, "height": 812}, is_mobile=True, has_touch=True); merrs = []
    m.on("pageerror", lambda e: merrs.append(str(e)))
    m.goto(BASE); m.wait_for_function("window.__otr && __otr.ready()", timeout=20000)
    m.click("#advBtn"); m.click("#tubeZoom"); m.wait_for_timeout(300)
    sw = m.evaluate("document.documentElement.scrollWidth")
    ck("375 px: tube view fits, no horizontal scroll", sw <= 375 and m.is_visible("#tvLooks"), sw)
    ck("375 px: the tube gets most of the screen", m.evaluate("document.getElementById('tvCv').clientHeight") > 400)
    ck("no page errors (phone)", not merrs, merrs[:3])
    b.close()
httpd.shutdown()
print("FAILS", F)
sys.exit(1 if F else 0)
