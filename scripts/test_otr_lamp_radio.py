#!/usr/bin/env python3
"""The mini radio the lava lamp can stand on (/otr/, big view and the black view): under 2 inches at the
lamp's scale, no words on it, and its dial, sleep moon, transport, five band EQ and volume knob work where
the lamp is shown large. The first half runs offline; the second plays real archive.org audio (network)
and is skipped, not failed, if nothing plays.

Run:  python3 scripts/test_otr_lamp_radio.py
"""
import http.server, socketserver, threading, functools, sys, os, math

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public"))
PORT = 8796
SP = os.environ.get("OTR_SHOTS", "/tmp")
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(s, *a): pass
    def do_POST(s): s.send_response(204); s.end_headers()
socketserver.ThreadingTCPServer.allow_reuse_address = True
httpd = socketserver.ThreadingTCPServer(("127.0.0.1", PORT), H)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{PORT}/otr/?season=off"
F = []
def ck(name, cond, detail=""):
    print(("PASS" if cond else "FAIL"), name, "" if cond else f"-> {detail}")
    if not cond: F.append(name)

from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get("OTR_CHROMIUM", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"), args=["--autoplay-policy=no-user-gesture-required"])
    pg = b.new_page(viewport={"width": 1280, "height": 900}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(BASE); pg.wait_for_function("window.__otr && __otr.ready()", timeout=20000)
    LA = lambda js: pg.evaluate("__otr.adv.lamp." + js)
    def at(id, which="big"): return pg.evaluate(f"__otr.adv.lamp.radioAt('{id}', '{which}')")

    pg.click("#advBtn"); pg.wait_for_timeout(300)
    LA("set({radio:false})"); LA("reset(4242)"); LA("advance(300)")
    h0 = LA("radio()")["sceneH"]
    pg.click("#lampZoom"); pg.wait_for_timeout(400)
    PR = "Array.from(document.querySelectorAll('#tvSubj button')).map(b => b.dataset.s + ':' + b.getAttribute('aria-pressed'))"
    ck("off by default: the top reads Tube, Lava lamp, Lava lamp + radio, with Lava lamp chosen", pg.evaluate(PR) == ["tube:false", "lamp:true", "radio:false"] and pg.inner_text("#tvSubj").split() == ["Tube", "Lava", "lamp", "Lava", "lamp", "+", "radio"], (pg.evaluate(PR), pg.inner_text("#tvSubj")))
    sb, cb = pg.locator("#tvSubj").bounding_box(), pg.locator("#tvClose").bounding_box()
    ck("the three fit on one row beside the close button", sb["height"] < 40 and sb["x"] + sb["width"] <= cb["x"] + 1, (sb, cb))
    pg.click("#tvSubj button[data-s='radio']"); pg.wait_for_timeout(400)
    r = LA("radio()")
    ck("Lava lamp + radio stands the lamp on the radio", r["on"] and pg.evaluate(PR) == ["tube:false", "lamp:false", "radio:true"] and r["sceneH"] > h0 and pg.evaluate("__otr.adv.tv.subject()") == "lamp", (r, h0))
    ck("the display shows the words (nothing playing yet: the player's prompt)", r["shown"] and r["shown"]["name"] == pg.inner_text("#npShow").strip() and r["shown"]["time"] == "--:--", r["shown"])
    ck("the radio is under 2 inches at the lamp's scale (14.5 in lamp, 182 units)", (r["sceneH"] - h0 - 7) / (182 / 14.5) < 2.0, r["sceneH"] - h0)
    pg.click("#tvSubj button[data-s='lamp']"); pg.wait_for_timeout(300)
    ck("Lava lamp takes it off the radio again", not LA("radio()")["on"] and pg.evaluate(PR) == ["tube:false", "lamp:true", "radio:false"])
    pg.click("#tvSubj button[data-s='tube']"); pg.wait_for_timeout(300); pg.click("#tvSubj button[data-s='radio']"); pg.wait_for_timeout(400)
    ck("from the tube straight to the lamp on its radio", LA("radio()")["on"] and pg.evaluate("__otr.adv.tv.subject()") == "lamp")
    pg.locator("#tvStage").screenshot(path=f"{SP}/otr_lamp_radio_big.png")

    # big view: the radio's controls work, and do not pan, zoom or go black
    v0 = LA("radio()")["vol"]; k = at("vol")
    pg.mouse.move(k["x"], k["y"]); pg.mouse.down(); pg.mouse.move(k["x"], k["y"] - 3 * k["s"], steps=4); pg.mouse.up(); pg.wait_for_timeout(400)
    v1 = LA("radio()")["vol"]
    ck("dragging the knob up turns the volume up (the page's own volume)", v1 > v0 - 1e-9 and abs(v1 - float(pg.eval_on_selector("#vol", "e => e.value"))) < 1e-6 and not LA("solo()"), (v0, v1))
    pg.mouse.move(k["x"], k["y"]); pg.mouse.down(); pg.mouse.move(k["x"], k["y"] + 6 * k["s"], steps=4); pg.mouse.up(); pg.wait_for_timeout(300)
    ck("and down turns it down", LA("radio()")["vol"] < v1 - 0.2, LA("radio()")["vol"])
    pg.mouse.move(k["x"], k["y"]); pg.mouse.wheel(0, -200); pg.wait_for_timeout(200)
    ck("the wheel over the knob is volume, not zoom", pg.evaluate("__otr.adv.tv.state()")["z"] < 1.05)
    st = pg.evaluate("__otr.adv.tv.state()")
    ck("working the radio did not pan the view", abs(st.get("x", 0)) < 1e-6 and abs(st.get("y", 0)) < 1e-6, st)

    s0 = pg.eval_on_selector("#sleepSel", "e => e.value"); m = at("sleep")
    seq = []
    for i in range(5):
        pg.mouse.click(m["x"], m["y"]); pg.wait_for_timeout(250); seq.append(pg.eval_on_selector("#sleepSel", "e => e.value"))
    ck("the moon cycles the sleep timer: 15, 30, 60 min, end of episode, off", s0 == "off" and seq == ["15", "30", "60", "end", "off"], seq)
    m = at("sleep"); pg.mouse.dblclick(m["x"], m["y"]); pg.wait_for_timeout(700)
    ck("a double click on the radio does not zoom", pg.evaluate("__otr.adv.tv.state()")["z"] < 1.05 and not LA("solo()"))
    pg.select_option("#sleepSel", "off") if pg.is_visible("#sleepSel") else pg.evaluate("(() => { const s=document.getElementById('sleepSel'); s.value='off'; s.onchange.call(s); })()")

    g0 = pg.evaluate("__otr.adv.state().gains.slice()"); e = at("eq2")
    pg.mouse.move(e["x"], e["y"]); pg.mouse.down(); pg.mouse.move(e["x"], e["y"] - 4 * e["s"], steps=5); pg.mouse.up(); pg.wait_for_timeout(300)
    g1 = pg.evaluate("__otr.adv.state().gains.slice()"); rr = LA("radio()")
    iso = pg.evaluate("(() => { const n=__otr.adv.state().bands; return n; })()")
    near = [i for i, f in enumerate({31: [20,25,31.5,40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,1250,1600,2000,2500,3150,4000,5000,6300,8000,10000,12500,16000,20000], 15: [25,40,63,100,160,250,400,630,1000,1600,2500,4000,6300,10000,16000], 10: [31.5,63,125,250,500,1000,2000,4000,8000,16000]}[iso])]
    freqs = {31: [20,25,31.5,40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,1250,1600,2000,2500,3150,4000,5000,6300,8000,10000,12500,16000,20000], 15: [25,40,63,100,160,250,400,630,1000,1600,2500,4000,6300,10000,16000], 10: [31.5,63,125,250,500,1000,2000,4000,8000,16000]}[iso]
    k1 = min(range(len(freqs)), key=lambda i: abs(math.log(freqs[i] / 1000))); k60 = min(range(len(freqs)), key=lambda i: abs(math.log(freqs[i] / 60)))
    ck("the 1 kHz slider lifts the EQ around 1 kHz", g1[k1] - g0[k1] >= 4 and abs(rr["eq"][2] - g1[k1]) < 0.01, (g0[k1], g1[k1], rr["eq"]))
    ck("and leaves 60 Hz alone", abs(g1[k60] - g0[k60]) < 0.6, (g0[k60], g1[k60]))
    ck("moving it turns the EQ on (the rack's own EQ, now custom)", pg.evaluate("__otr.adv.state().on && __otr.adv.state().eqOn && __otr.adv.state().preset === 'custom'"))
    e = at("eq2"); pg.mouse.move(e["x"], e["y"]); pg.mouse.down(); pg.mouse.move(e["x"], e["y"] + 4 * e["s"], steps=5); pg.mouse.up(); pg.wait_for_timeout(300)
    ck("and back down puts it back", abs(pg.evaluate("__otr.adv.state().gains")[k1] - g0[k1]) <= 0.5, pg.evaluate("__otr.adv.state().gains")[k1])

    # single click on the radio's face is not the lamp: no black view
    d = at("dial"); s0 = pg.eval_on_selector("#sleepSel", "e => e.value")
    pg.mouse.click(d["x"] + 9 * d["s"], d["y"] + 5 * d["s"]); pg.wait_for_timeout(600)   # the grille: no control there
    ck("a click on the radio's face (not a control) does nothing and does not go black", not LA("solo()") and pg.eval_on_selector("#sleepSel", "e => e.value") == s0)

    # the black view: the radio stays, its controls work, a click elsewhere still comes back
    LA("solo(true)"); pg.wait_for_timeout(500)
    ck("on black the radio is there and still nothing but icons", pg.inner_text("#lampSolo").strip() == "")
    m = at("sleep", "solo"); pg.mouse.click(m["x"], m["y"]); pg.wait_for_timeout(300)
    ck("on black the radio's controls work and do not bring the page back", LA("solo()") and pg.eval_on_selector("#sleepSel", "e => e.value") == "15")
    pg.mouse.click(m["x"], m["y"]); pg.mouse.click(m["x"], m["y"]); pg.mouse.click(m["x"], m["y"]); pg.mouse.click(m["x"], m["y"]); pg.wait_for_timeout(300)
    ck("(and the timer is off again)", pg.eval_on_selector("#sleepSel", "e => e.value") == "off")
    k = at("vol", "solo"); vb = LA("radio()")["vol"]; pg.mouse.move(k["x"], k["y"]); pg.mouse.down(); pg.mouse.move(k["x"], k["y"] - 3 * k["s"], steps=4); pg.mouse.up(); pg.wait_for_timeout(300)
    ck("the knob works on black", LA("radio()")["vol"] > vb + 0.15 and LA("solo()"), (vb, LA("radio()")["vol"]))
    px = pg.evaluate("""(() => { const cv=document.getElementById('soloCv'), c=cv.getContext('2d'), W=cv.width, H=cv.height;
        return [[2,2],[W-3,2],[2,H-3],[W-3,H-3],[W*0.08,H*0.5],[W*0.92,H*0.5]].map(q => Array.from(c.getImageData(Math.floor(q[0]),Math.floor(q[1]),1,1).data.slice(0,3))); })()""")
    ck("around the lamp and radio it is still black", all(sum(c) == 0 for c in px), px)
    pg.locator("#lampSolo").screenshot(path=f"{SP}/otr_lamp_radio_solo.png")
    pg.mouse.click(40, 40); pg.wait_for_timeout(300)
    ck("a click away from the radio still comes back", not LA("solo()"))

    # it remembers
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
    pg.reload(); pg.wait_for_function("window.__otr && __otr.ready()", timeout=20000)
    ck("the radio setting survives a reload", pg.evaluate("__otr.adv.state().lampRadio"))

    # ---- with real audio (network) ----
    pg.click("#channelChips .station[data-ch=\"crime\"]")
    try:
        pg.wait_for_function('!document.getElementById("audio").paused && document.getElementById("audio").currentTime>1', timeout=45000); playing = True
    except Exception:
        playing = False; print("SKIP real audio: nothing played within 45 s")
    if playing:
        T = 'document.getElementById("audio").currentTime'
        if not pg.evaluate("__otr.adv.state().open"): pg.click("#advBtn"); pg.wait_for_timeout(300)
        pg.click("#lampZoom"); pg.wait_for_timeout(500)
        t0 = pg.evaluate(T); f = at("fwd"); pg.mouse.click(f["x"], f["y"]); pg.wait_for_timeout(700); t1 = pg.evaluate(T)
        ck("forward 15 on the radio", 12 < t1 - t0 < 20, (t0, t1))
        bk = at("back"); pg.mouse.click(bk["x"], bk["y"]); pg.wait_for_timeout(700); t2 = pg.evaluate(T)
        ck("back 15 on the radio", 10 < t1 - t2 < 18, (t1, t2))
        pl = at("play"); pg.mouse.click(pl["x"], pl["y"]); pg.wait_for_timeout(500)
        ck("play button pauses", pg.evaluate('document.getElementById("audio").paused'))
        pg.mouse.click(pl["x"], pl["y"]); pg.wait_for_timeout(1200)
        ck("and plays again", not pg.evaluate('document.getElementById("audio").paused'))
        dur = pg.evaluate('document.getElementById("audio").duration')
        sh = LA("radio()")["shown"]
        ck("playing, the display shows the show and episode and the time out of the total", sh["name"].startswith(pg.inner_text("#npShow").strip()) and "·" in sh["name"] and " / " in sh["time"], sh)
        dl = at("dial"); pg.mouse.click(dl["x"] + 8.25 * dl["s"], dl["y"]); pg.wait_for_timeout(1200)   # 0.75 of the scale (12.5 to 45.5)
        ck("a tap on the dial seeks (three quarters of the way)", abs(pg.evaluate(T) / dur - 0.75) < 0.05, (pg.evaluate(T), dur))
        pg.wait_for_timeout(1500); lv = LA("radio()")["lvl"]
        ck("the EQ slots light with the music", max(lv) > 0.05, lv)
        t_before = pg.evaluate("document.getElementById('audio').currentSrc"); nx = at("next"); pg.mouse.click(nx["x"], nx["y"])
        try:
            pg.wait_for_function(f"document.getElementById('audio').currentSrc !== {t_before!r}", timeout=20000); skipped = True
        except Exception: skipped = False
        ck("skip moves to the next one", skipped)
        LA("solo(true)"); pg.wait_for_timeout(400)
        pl = at("play", "solo"); pg.mouse.click(pl["x"], pl["y"]); pg.wait_for_timeout(500)
        ck("on black, play pauses and the view stays", pg.evaluate('document.getElementById("audio").paused') and LA("solo()"))
        pg.keyboard.press("Escape")
    ck("no page errors", not errs, errs[:3])

    # phone: every control on the radio is reachable in the big view (not under the zoom buttons)
    m = b.new_page(viewport={"width": 375, "height": 812}, is_mobile=True, has_touch=True); merrs = []
    m.on("pageerror", lambda e: merrs.append(str(e)))
    m.goto(BASE); m.wait_for_function("window.__otr && __otr.ready()", timeout=20000)
    m.click("#advBtn"); m.wait_for_timeout(300); m.click("#lampZoom"); m.wait_for_timeout(300); m.click("#tvSubj button[data-s='radio']"); m.wait_for_timeout(500)
    hidden = []
    for cid in ["dial", "sleep", "prev", "back", "play", "fwd", "next", "eq0", "eq4", "vol"]:
        q = m.evaluate(f"__otr.adv.lamp.radioAt('{cid}', 'big')")
        if m.evaluate(f"(document.elementFromPoint({q['x']}, {q['y']}) || {{}}).id") != "tvCv": hidden.append(cid)
    ck("375 px: no radio control sits under the zoom buttons", not hidden, hidden)
    sw = m.evaluate("document.documentElement.scrollWidth")
    ck("375 px: the top choice fits, no horizontal scroll", sw <= 375 and m.locator("#tvSubj").bounding_box()["height"] < 40, sw)
    ck("no page errors (phone)", not merrs, merrs[:3])
    b.close()
httpd.shutdown()
print("FAILS", F)
sys.exit(1 if F else 0)
