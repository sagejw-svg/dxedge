#!/usr/bin/env python3
"""Listening-room slideshow on /otr/.

The Slideshow control cycles scene pictures. The lava lamp is a separate
overlay: drag to move, a handle to resize, handles to turn and tilt. Each
room has its own default placement, and a listener's layout is kept in
localStorage. The rack lamp stays sharp.

Run:  python3 scripts/test_otr_slideshow.py
"""
import http.server, json, os, socketserver, threading, functools

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public"))
PORT = 8803
SP = os.environ.get("OTR_SHOTS", "/tmp")
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
handler.log_message = lambda *a, **k: None
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{PORT}"
URL = BASE + "/otr/"
F = []

def ck(name, cond, detail=""):
    print(("PASS" if cond else "FAIL"), name, "" if cond else f"-> {detail}")
    if not cond:
        F.append(name)

pack = json.load(open(os.path.join(ROOT, "otr", "scenes", "scenes.json")))
ids = [s["id"] for s in pack["scenes"]]
ck("scene set includes the listening rooms",
   set(["space", "farm", "bedroom", "kitchen", "living", "porch", "study", "diner", "attic"]) <= set(ids), ids)
ck("rooms change slowly", pack["dwellMs"] >= 12000 and pack["fadeMs"] >= 800, pack)
xs = [s["lamp"]["x"] for s in pack["scenes"]]
ss = [s["lamp"]["s"] for s in pack["scenes"]]
ck("default lamp placements are not one fixed spot",
   max(xs) - min(xs) > 0.5 and max(ss) - min(ss) > 0.1 and len({round(x, 1) for x in xs}) >= 5,
   list(zip(ids, xs, ss)))
for s in pack["scenes"]:
    path = os.path.join(ROOT, "otr", "scenes", s["src"])
    raw = open(path, "rb").read()
    textish = raw[:4] not in (b"\xff\xd8\xff\xe0", b"\xff\xd8\xff\xe1", b"\xff\xd8\xff\xdb", b"\x89PNG") and not raw[:3] == b"\xff\xd8\xff"
    ck(f"{s['id']} picture has no baked-in lamp",
       os.path.getsize(path) > 20000 and (not textish or b"lava" not in raw.lower()), s["src"])

from playwright.sync_api import sync_playwright
CHROME = os.environ.get("OTR_CHROMIUM", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")

def pose(pg):
    return pg.evaluate("__otr.slideshow.pose()")

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME)
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL)
    pg.wait_for_function("window.__otr && __otr.ready() && window.__otr.slideshow && __otr.slideshow.ready()", timeout=20000)
    ck("Slideshow sits with the player controls", pg.is_visible("#slideBtn") and pg.inner_text("#slideBtn").strip() == "Slideshow")
    ck("the stage stays closed until it is asked for", not pg.is_visible("#slideStage"))
    pg.click("#slideBtn")
    pg.wait_for_function("() => __otr.slideshow.on() && document.getElementById('slideFrame').dataset.scene", timeout=5000)
    pg.locator("#slideFrame").scroll_into_view_if_needed()
    first = pg.evaluate("""() => {
      const on = document.querySelector('#slideFrame .slide-bg.on');
      return { id: __otr.slideshow.current().id, name: document.getElementById('slideCap').textContent, bg: on ? on.style.backgroundImage : '' };
    }""")
    ck("the first room is a scene picture, not an empty frame",
       first["id"] == "space" and "Stars" in first["name"] and "space.jpg" in first["bg"], first)
    pg.wait_for_timeout(1500)
    ck("it does not flash to the next room", pg.evaluate("__otr.slideshow.current().id") == "space")
    pg.click("#slideNext")
    pg.wait_for_function("() => __otr.slideshow.current().id === 'farm'")
    farm = pg.evaluate("document.querySelector('#slideFrame .slide-bg.on').style.backgroundImage")
    ck("Next room advances the picture", "farm.jpg" in farm, farm)
    defs = pg.evaluate("__otr.slideshow.defaults()")
    by = {d["id"]: d for d in defs}
    got = pose(pg)
    ck("the farm lamp uses that room's own spot, size, and angle",
       abs(got["x"] - by["farm"]["x"]) < 0.001 and abs(got["s"] - by["farm"]["s"]) < 0.001
       and abs(got["rot"] - by["farm"]["rot"]) < 0.001 and abs(got["tilt"] - by["farm"]["tilt"]) < 0.001
       and abs(got["x"] - by["space"]["x"]) > 0.3, got)

    pg.evaluate("__otr.slideshow.go(0)")
    pg.locator("#slideLamp").scroll_into_view_if_needed()
    pg.wait_for_function("""() => {
      const cv = document.getElementById('slideLamp');
      if (!cv || cv.width < 20) return false;
      const d = cv.getContext('2d').getImageData(Math.floor(cv.width*0.42), Math.floor(cv.height*0.62), 10, 10).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 30) return true;
      return false;
    }""", timeout=4000)
    ck("the lamp is painted on its own canvas over the picture", True)
    before = pg.locator("#slideLamp").bounding_box()
    x0, y0 = before["x"] + before["width"] * 0.5, before["y"] + before["height"] * 0.45
    pg.mouse.move(x0, y0)
    pg.mouse.down()
    pg.mouse.move(x0 - 160, y0 + 24, steps=10)
    pg.mouse.up()
    moved = pose(pg)
    box2 = pg.locator("#slideLamp").bounding_box()
    ck("dragging the lamp moves it", moved["x"] < by["space"]["x"] - 0.05 and box2["x"] < before["x"] - 20, (moved, before, box2))

    h = pg.locator("#slideLampWrap .slide-hnd.s").bounding_box()
    s0 = pose(pg)["s"]
    pg.mouse.move(h["x"] + h["width"] / 2, h["y"] + h["height"] / 2)
    pg.mouse.down()
    pg.mouse.move(h["x"] + h["width"] / 2, h["y"] + 70, steps=8)
    pg.mouse.up()
    ck("the corner handle resizes it", pose(pg)["s"] > s0 + 0.04, (s0, pose(pg)["s"]))

    pg.locator("#slideLampWrap").focus()
    pg.keyboard.press("]")
    pg.keyboard.press("]")
    ck("brackets turn the lamp", pose(pg)["rot"] > moved["rot"] + 5, pose(pg))
    t = pg.locator("#slideLampWrap .slide-hnd.t").bounding_box()
    t0 = pose(pg)["tilt"]
    pg.mouse.move(t["x"] + 8, t["y"] + 8)
    pg.mouse.down()
    pg.mouse.move(t["x"] + 8, t["y"] - 50, steps=6)
    pg.mouse.up()
    tilted = pose(pg)
    ck("the side handle tilts it back", tilted["tilt"] > t0 + 3, (t0, tilted))

    saved = pg.evaluate("JSON.parse(localStorage.getItem('otr_slide_lamp'))")
    ck("the layout is written to localStorage",
       saved["on"] and saved["custom"]["space"]["x"] == tilted["x"] and "rot" in saved["custom"]["space"], saved)
    pg.reload()
    pg.wait_for_function("window.__otr && __otr.slideshow && __otr.slideshow.ready() && __otr.slideshow.on()", timeout=20000)
    again = pose(pg)
    ck("a refresh keeps the lamp where they put it",
       pg.evaluate("__otr.slideshow.current().id") == "space"
       and abs(again["x"] - tilted["x"]) < 0.001 and abs(again["s"] - tilted["s"]) < 0.001
       and abs(again["rot"] - tilted["rot"]) < 0.001 and abs(again["tilt"] - tilted["tilt"]) < 0.001, again)
    pg.click("#slideReset")
    reset = pose(pg)
    ck("reset puts the lamp back on that room's own spot",
       abs(reset["x"] - by["space"]["x"]) < 0.001 and abs(reset["s"] - by["space"]["s"]) < 0.001, reset)

    pg.click("#advBtn")
    pg.wait_for_timeout(400)
    ck("Slideshow is also next to the lava lamp", pg.is_visible("#slideBtnLamp") and pg.locator("#lampMod").locator("#slideBtnLamp").count() == 1)
    crisp = pg.evaluate("__otr.adv.lamp.crisp()")
    slide = pg.evaluate("__otr.adv.lamp.slideCrisp()")
    ck("the rack lamp is still one device pixel per cell", 0.4 <= crisp["pxPerCell"] <= 1.35 and crisp["bloom"] <= 0.8, crisp)
    ck("the overlay lamp stays sharp too",
       slide["cw"] > 0 and 0.4 <= slide["pxPerCell"] <= 1.35 and slide["bloom"] <= 0.8 and slide["ratio"] + 0.05 >= slide["dpr"], slide)
    ck("the overlay is not blurred with a CSS filter", pg.evaluate("getComputedStyle(document.getElementById('slideLamp')).filter") in ("none", ""))

    pg.locator("#networkChips .station[data-net=listenotr]").click()
    pg.wait_for_function("document.body.classList.contains('otr-liveclock')", timeout=15000)
    ck("live listen still locks skip and leaves Slideshow working",
       pg.evaluate("document.getElementById('prevBtn').disabled && !document.getElementById('slideBtn').disabled && __otr.slideshow.on()"))
    pg.screenshot(path=f"{SP}/otr_slideshow.png")
    ck("no page errors", not errs, errs[:4])
    pg.close()

    ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    ctx.add_init_script("localStorage.setItem('otr_mode','basic')")
    m = ctx.new_page()
    merrs = []
    m.on("pageerror", lambda e: merrs.append(str(e)))
    m.goto(URL)
    m.wait_for_function("window.__otr && __otr.slideshow && __otr.slideshow.ready()", timeout=20000)
    ck("Basic shows Slideshow and not the full rack",
       m.is_visible("#slideBtnBasic") and not m.is_visible("#console") and not m.is_visible("#slideBtn"))
    m.click("#slideBtnBasic")
    m.wait_for_function("() => __otr.slideshow.on() && document.getElementById('otr-basic').contains(document.getElementById('slideStage'))")
    m.locator("#slideFrame").scroll_into_view_if_needed()
    bp = m.evaluate("__otr.slideshow.pose()")
    sw = m.evaluate("document.documentElement.scrollWidth")
    ck("Basic uses that room's default placement",
       abs(bp["x"] - by["space"]["x"]) < 0.001 and abs(bp["s"] - by["space"]["s"]) < 0.001, bp)
    ck("Basic stays within the phone width", sw <= 390, sw)
    m.screenshot(path=f"{SP}/otr_slideshow_basic.png")
    ck("no page errors on Basic", not merrs, merrs[:4])
    ctx.close()

    ctx = b.new_context(viewport={"width": 1100, "height": 800})
    ctx.add_init_script("localStorage.setItem('otr_slide_lamp', JSON.stringify({on:true,i:0,custom:{space:{x:0.5,y:0.5,s:0.3,rot:0,tilt:0,skew:0}}}))")
    st = ctx.new_page()
    st.goto(BASE + "/otr/?slideshow=stream")
    st.wait_for_function("window.__otr && __otr.slideshow && __otr.slideshow.ready() && __otr.slideshow.stream()", timeout=20000)
    sp = st.evaluate("__otr.slideshow.pose()")
    ck("the stream capture uses the varied default, not a saved layout",
       st.evaluate("__otr.slideshow.on()") and abs(sp["x"] - by["space"]["x"]) < 0.001 and abs(sp["x"] - 0.5) > 0.2, sp)
    ck("stream capture does not offer drag handles",
       st.evaluate("getComputedStyle(document.querySelector('#slideStage .slide-hnd')).display") == "none")
    ctx.close()
    b.close()

httpd.shutdown()
print("FAILS", F)
raise SystemExit(1 if F else 0)
