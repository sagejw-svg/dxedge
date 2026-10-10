#!/usr/bin/env python3
"""Lava lamp for the Old Time Radio player (/otr/): a rack module and a big view, driven by a
physics simulation (no animation loops). These checks run the simulation forward through the test
hook (window.__otr.adv.lamp) and look for the behaviour a real lamp shows: a cold solid cake that
warms and sends up a first blob, separate blobs rising and sinking, running hot at high wattage
(wax stays up), lazy at low wattage, settling and setting when switched off, and never the same
twice for different seeds. Then the UI: module, big view, filters, colours, persistence, phone.

Run:  python3 scripts/test_otr_lamp.py
"""
import http.server, socketserver, threading, functools, sys, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public"))
PORT = 8790
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
    pg = b.new_page(viewport={"width": 1280, "height": 860}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(BASE); pg.wait_for_function("window.__otr && __otr.ready()", timeout=20000)
    LA = lambda js: pg.evaluate("__otr.adv.lamp." + js)

    # ---- the module ----
    pg.click("#advBtn"); pg.wait_for_timeout(500)
    ck("lamp module sits in the rack", pg.is_visible("#lampMod") and pg.is_visible("#lampCv"))
    ck("the rack lamp is drawn", pg.evaluate("__otr.adv.tv.sample('lamp')")["lum"] > 4)
    ck("opening the rack never turns the sound processing on", not pg.evaluate("__otr.adv.state().on"))

    # ---- cold start and warm-up ----
    st = LA("reset(4242)")
    ck("a new lamp starts cold: solid wax at room temperature", st["melt"] < 0.05 and st["waxT"] < 25 and st["warming"], st)
    ck("status says it is warming up", "warming" in st["status"], st["status"])
    ck("the wax starts as a cake on the bottom", st["up"] == 0 and st["top"] < 0.3, st)
    st = LA("advance(45)")
    ck("after 45 s the bottom of the cake is melting", 0.05 < st["melt"] < 1 and st["waxT"] > 28, st)
    up_max, blobs_max, first = 0, 0, None
    for i in range(30):
        st = LA("advance(10)")
        if st["up"] > 0.05 and first is None: first = (i + 1) * 10 + 45
        up_max = max(up_max, st["up"]); blobs_max = max(blobs_max, st["blobs"])
    ck("the first wax rises within a few minutes of switching on", first is not None and first <= 200, first)
    ck("then it flows: fully molten, warming is over", st["melt"] > 0.95 and not st["warming"], st)
    ck("separate blobs form (they pinch off and merge on their own)", blobs_max >= 3, blobs_max)
    ck("wax travels the height of the lamp", up_max > 0.4, up_max)
    ck("liquid is hotter at the bottom than the top", st["tBot"] > st["tTop"] + 4, (st["tBot"], st["tTop"]))
    blobs = LA("blobs()")
    ck("blobs are spread through the bottle, not stuck together", len({round(o["y"] / 20) for o in blobs}) >= 2, blobs)

    # ---- determinism and randomness ----
    run = lambda seed: pg.evaluate(f"(() => {{ const L=__otr.adv.lamp; L.reset({seed}); L.advance(150); return L.blobs(); }})()")   # one call: no frames in between
    A = run(77); A2 = run(77); Bb = run(78)
    same = len(A) == len(A2) and all(abs(x["y"] - y["y"]) < 1e-6 for x, y in zip(A, A2))
    ck("one seed replays exactly (it is physics, not a recording)", same)
    diff = len(A) != len(Bb) or any(abs(x["y"] - y["y"]) > 0.5 for x, y in zip(A, Bb))
    ck("another seed gives a different lamp", diff)

    # ---- bulb wattage ----
    LA("set({w:40})"); LA("reset(5)"); st = LA("advance(600)")
    ck("at 40 W the lamp runs hot: the wax stays up", st["up"] > 0.85 and "hot" in st["status"], st)
    LA("set({w:15})"); LA("reset(5)"); ups = []
    for i in range(12): ups.append(LA("advance(50)")["up"])
    LA("set({w:25})"); LA("reset(5)"); ups25 = []
    for i in range(12): ups25.append(LA("advance(50)")["up"])
    ck("at 15 W it is lazier than at 25 W", sum(ups) < sum(ups25), (round(sum(ups), 2), round(sum(ups25), 2)))

    # ---- switching off ----
    st = LA("advance(120)")
    LA("set({on:false})"); st = LA("advance(400)")
    ck("switched off, the wax sinks and sets", st["up"] == 0 and st["melt"] < 0.2 and "off" in st["status"], st)
    ck("the lamp module shows it off", pg.get_attribute("#lampPower", "aria-pressed") == "false")
    LA("set({on:true})")
    ck("switched back on, it warms up again", LA("state()")["warming"])

    # ---- music heat ----
    pg.evaluate("__otr.adv.tv.level(1)"); LA("set({music:true})"); pg.wait_for_timeout(4000)
    ck("with music heat on, loud audio feeds the bulb", LA("state()")["music"] > 0.4, LA("state()"))
    LA("set({music:false})"); pg.evaluate("__otr.adv.tv.level(null)"); pg.wait_for_timeout(300)
    ck("and off again it does not", LA("state()")["music"] == 0)
    ck("still nothing changed the sound", not pg.evaluate("__otr.adv.state().on"))

    # ---- big view ----
    LA("reset(31)"); LA("advance(260)")
    pg.click("#lampZoom"); pg.wait_for_timeout(400)
    ck("zoom opens the lamp in the big view", pg.evaluate("__otr.adv.tv.isOpen()") and pg.evaluate("__otr.adv.tv.subject()") == "lamp")
    ck("big view names the lamp and its colours", pg.inner_text("#tvName").lower() == "lava lamp" and "wax" in pg.inner_text("#tvKind").lower())
    ck("lamp controls show, tube controls hide", pg.is_visible("#tvLampKnobs") and pg.is_visible("#tvLampCols") and not pg.is_visible("#tvTubes") and not pg.is_visible("#tvStandby"))
    ck("the live status shows in the view", len(pg.inner_text("#tvStat")) > 4, pg.inner_text("#tvStat"))
    pg.evaluate("__otr.adv.tv.quality(1)")
    nat = pg.evaluate("__otr.adv.tv.sample('big')")
    ck("classic lamp: warm (red/yellow over blue)", nat["r"] > nat["b"] * 1.3, nat)
    pg.evaluate("__otr.adv.tv.look('blacklight')"); pg.wait_for_timeout(300); uv = pg.evaluate("__otr.adv.tv.sample('big')")
    ck("black light turns it violet", uv["b"] > uv["g"] * 1.3, uv)
    pg.evaluate("__otr.adv.tv.look('thermal')"); pg.wait_for_timeout(300); th = pg.evaluate("__otr.adv.tv.sample('big')")
    ck("thermal shows the heat (warm colours inside the bottle)", th["r"] > th["g"] and th["lum"] > 10, th)
    pg.evaluate("__otr.adv.tv.look('natural')"); pg.wait_for_timeout(200)
    pg.click("#tvLampCols .tchip[data-id='blue']"); pg.wait_for_timeout(300); bl = pg.evaluate("__otr.adv.tv.sample('big')")
    ck("colour chips change the lamp (white wax in blue liquid)", pg.evaluate("__otr.adv.state().lampCol") == "blue" and bl["b"] > bl["r"], bl)
    ck("the module's colour list follows", pg.eval_on_selector("#lampColSel", "e => e.value") == "blue")
    pg.click("#tvLampBases .tchip[data-id='silver']")
    ck("base finish chips", pg.evaluate("__otr.adv.state().lampBase") == "silver")
    pg.focus("#tvLampKnobs .knob"); pg.keyboard.press("ArrowUp")
    ck("bulb knob sets the wattage", pg.evaluate("__otr.adv.state().lampW") == 26)
    pg.click("#tvLampCold"); pg.wait_for_timeout(100)
    ck("start cold makes a new cold lamp", LA("state()")["melt"] < 0.05 and LA("state()")["warming"])
    pg.click("#tvIn"); ck("zoom works on the lamp", pg.evaluate("__otr.adv.tv.state()")["z"] > 1.3)
    pg.click("#tvSubj button[data-s='tube']"); pg.wait_for_timeout(200)
    ck("switching to the tube in the same view", pg.evaluate("__otr.adv.tv.subject()") == "tube" and pg.is_visible("#tvTubes") and not pg.is_visible("#tvLampCols"))
    pg.click("#tvSubj button[data-s='lamp']"); pg.wait_for_timeout(200)
    pg.locator("#tvStage").screenshot(path=f"{SP}/otr_lamp_view.png")
    pg.keyboard.press("Escape"); ck("Esc closes", not pg.evaluate("__otr.adv.tv.isOpen()"))
    pg.click("#lampCv"); pg.wait_for_timeout(200)
    ck("clicking the lamp in the rack opens it too", pg.evaluate("__otr.adv.tv.subject()") == "lamp" and pg.evaluate("__otr.adv.tv.isOpen()"))
    pg.keyboard.press("Escape")
    pg.select_option("#lampColSel", "purple")
    ck("module colour list sets the colours", pg.evaluate("__otr.adv.state().lampCol") == "purple")

    # ---- persistence, cost ----
    LA("set({music:true, w:31})"); pg.wait_for_timeout(400)
    pg.reload(); pg.wait_for_function("window.__otr && __otr.ready()", timeout=20000)
    s = pg.evaluate("__otr.adv.state()")
    ck("lamp settings survive a reload", s["lampCol"] == "purple" and s["lampBase"] == "silver" and s["lampW"] == 31 and s["lampMusic"], s)
    cost = pg.evaluate("__otr.adv.lamp.stepCost(600)")
    ck("a physics step is cheap (under 1 ms headless)", cost < 1.0, cost)
    pg.evaluate("__otr.adv.open(true)"); pg.wait_for_timeout(300); pg.locator("#lampMod").screenshot(path=f"{SP}/otr_lamp_module.png")
    ck("no page errors (desktop)", not errs, errs[:3])

    m = b.new_page(viewport={"width": 375, "height": 812}, is_mobile=True, has_touch=True); merrs = []
    m.on("pageerror", lambda e: merrs.append(str(e)))
    m.goto(BASE); m.wait_for_function("window.__otr && __otr.ready()", timeout=20000)
    m.click("#advBtn"); m.wait_for_timeout(300)
    sw = m.evaluate("document.documentElement.scrollWidth")
    ck("375 px: lamp module fits, no horizontal scroll", sw <= 375 and m.is_visible("#lampCv"), sw)
    m.click("#lampZoom"); m.wait_for_timeout(300)
    ck("375 px: the lamp view opens and its controls are reachable", m.evaluate("__otr.adv.tv.subject()") == "lamp" and m.locator("#tvLampCols").count() == 1)
    ck("no page errors (phone)", not merrs, merrs[:3])
    b.close()
httpd.shutdown()
print("FAILS", F)
sys.exit(1 if F else 0)
