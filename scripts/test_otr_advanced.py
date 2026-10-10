#!/usr/bin/env python3
"""Advanced sound (EQ -> tube -> limiter) for the Old Time Radio player (/otr/).

DSP checks render sine waves through a fresh copy of the chain in an OfflineAudioContext
(window.__otr.adv.measure) and read the harmonics with a DFT, so they test the same node graph
the listener hears. UI checks drive the rack in a real page: the Advanced button, power switches,
tube chips, knobs, the EQ canvas (drag, sweep, keyboard), band count, presets, persistence,
the iPhone opt-in path (?ios=1) and phone width.

Run:  python3 scripts/test_otr_advanced.py
"""
import http.server, socketserver, threading, functools, sys, os, json

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public"))
PORT = 8794
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
PLAYING = "!document.getElementById('audio').paused && document.getElementById('audio').currentTime>0.5"
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get("OTR_CHROMIUM", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"),
                          args=["--autoplay-policy=no-user-gesture-required"])
    pg = b.new_page(viewport={"width": 1366, "height": 1000}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(BASE); pg.wait_for_function("window.__otr && __otr.ready()", timeout=20000)
    M = lambda st, **kw: pg.evaluate("a => __otr.adv.measure(a)", dict(set=st, **kw))

    # ---- rack UI basics ----
    ck("rack hidden until Advanced is pressed", not pg.is_visible("#rack"))
    pg.click("#advBtn"); pg.wait_for_timeout(300)
    ck("Advanced opens the rack", pg.is_visible("#rack") and pg.get_attribute("#advBtn", "aria-expanded") == "true")
    ck("opening the rack does not change the sound", not pg.evaluate("__otr.adv.state().on"))
    ck("nine tubes to choose from", pg.evaluate("document.querySelectorAll('#tubeChips .tchip').length") == 9)
    ck("five tube knobs and a preamp", pg.evaluate("document.querySelectorAll('#tubeKnobs .knob').length") == 5 and pg.is_visible("#eqKnobs .knob"))
    ck("tube and EQ canvases are drawn", pg.evaluate("document.getElementById('tubeCv').width>0 && document.getElementById('eqCv').width>0"))

    # ---- DSP: bypass and flat are transparent ----
    r = M({"on": False}); ck("bypass is transparent (0 dB, no harmonics)", abs(r["gainDb"]) < 0.05 and max(r["rel"][1:]) < -100, r)
    r = M({"on": True, "tubeOn": False, "eqOn": True, "bands": 31, "gains": [0]*31, "pre": 0, "preset": "flat"})
    ck("processing on with a flat EQ stays at 0 dB", abs(r["gainDb"]) < 0.1 and max(r["rel"][1:]) < -90, r)
    for sag in (0, 3, 10):
        r = M({"on": True, "eqOn": False, "tubeOn": True, "tube": "12AU7", "drive": 0, "bias": -5, "sag": sag}, amp=0.02)
        ck(f"sag {sag}: compressor makeup gain is taken back out", abs(r["gainDb"]) < 0.15, r["gainDb"])

    # ---- DSP: tubes ----
    lv = {}
    for t in pg.evaluate("__otr.adv.tubes()"):
        r3 = M({"on": True, "eqOn": False, "tubeOn": True, "tube": t, "drive": 3, "bias": 0, "sag": 0})
        r7 = M({"on": True, "eqOn": False, "tubeOn": True, "tube": t, "drive": 7, "bias": 0, "sag": 0})
        lv[t] = (r3, r7)
        ck(f"{t}: adds harmonics at drive 3", max(r3["rel"][1:]) > -60, r3["rel"])
        ck(f"{t}: auto makeup keeps level within 2.5 dB at drive 3 and 7", abs(r3["gainDb"]) < 2.5 and abs(r7["gainDb"]) < 2.5, (r3["gainDb"], r7["gainDb"]))
        ck(f"{t}: more drive, more distortion", max(r7["rel"][1:]) > max(r3["rel"][1:]) + 5, (r3["rel"], r7["rel"]))
    for t in ("12AX7", "12AT7", "12AU7", "300B"):
        ck(f"{t}: triode voicing leads with the 2nd harmonic", lv[t][0]["rel"][1] > lv[t][0]["rel"][2] + 10, lv[t][0]["rel"])
    for t in ("EL34", "6L6", "KT88"):
        ck(f"{t}: power tube voicing leads with the 3rd harmonic when driven", lv[t][1]["rel"][2] > lv[t][1]["rel"][1] + 5, lv[t][1]["rel"])
    hot = M({"on": True, "eqOn": False, "tubeOn": True, "tube": "12AX7", "drive": 3, "bias": 4, "sag": 0})
    cold = M({"on": True, "eqOn": False, "tubeOn": True, "tube": "12AX7", "drive": 3, "bias": -4, "sag": 0})
    ck("hot bias raises the 2nd harmonic over cold", hot["rel"][1] > cold["rel"][1] + 6, (hot["rel"], cold["rel"]))
    st = pg.evaluate("__otr.adv.harmonics('12AX7', 3, 0)")
    ck("on-screen harmonic display agrees with the rendered audio (12AX7 H2)", abs(st["db"][0] - lv["12AX7"][0]["rel"][1]) < 1.0, (st, lv["12AX7"][0]["rel"]))

    # ---- DSP: EQ ----
    g = [0]*31; g[17] = 6
    r1 = M({"on": True, "eqOn": True, "tubeOn": False, "bands": 31, "gains": g, "preset": "custom"}, freq=1000)
    r4 = M({"on": True, "eqOn": True, "tubeOn": False, "bands": 31, "gains": g, "preset": "custom"}, freq=4000)
    ck("31-band: +6 dB at the 1 kHz fader measures +6 dB at 1 kHz", abs(r1["gainDb"] - 6) < 0.3, r1["gainDb"])
    ck("31-band: and leaves 4 kHz alone", abs(r4["gainDb"]) < 0.3, r4["gainDb"])
    g = [0]*31; g[30] = 6
    rt = M({"on": True, "eqOn": True, "tubeOn": False, "bands": 31, "gains": g, "preset": "custom"}, freq=19000)
    rl = M({"on": True, "eqOn": True, "tubeOn": False, "bands": 31, "gains": g, "preset": "custom"}, freq=1000)
    ck("top fader is an air shelf (most of +6 by 19 kHz, flat at 1 kHz)", rt["gainDb"] > 3.5 and abs(rl["gainDb"]) < 0.2, (rt["gainDb"], rl["gainDb"]))
    # the drawn curve matches what the chain does
    pg.evaluate("__otr.adv.bands(31)"); gains = pg.evaluate("__otr.adv.preset('voice')")
    for f in (100, 1000, 3150):
        meas = M({"on": True, "eqOn": True, "tubeOn": False, "bands": 31, "gains": gains, "preset": "custom", "pre": 0}, freq=f)["gainDb"]
        drawn = pg.evaluate(f"__otr.adv.response({f})")
        ck(f"drawn EQ curve matches the audio at {f} Hz", abs(meas - drawn) < 0.35, (meas, drawn))
    pres = [pg.evaluate(f"__otr.adv.response({f})") for f in (2500, 3150)]
    ck("presets are fitted so the curve hits the shape (voice: about +3.8 dB at 2.5k and 3.15k)", all(3.0 <= v <= 4.6 for v in pres), pres)
    r = pg.evaluate("() => __otr.adv.measure({set:{on:true,eqOn:true,tubeOn:true,tube:'12AX7',drive:6,bands:31,gains:new Array(31).fill(12),pre:6,preset:'custom'}, amp:0.9})")
    ck("limiter + soft clip: nothing leaves above 0 dBFS even maxed out", r["peak"] <= 1.0, r["peak"])

    # ---- UI: knob turns processing on, EQ canvas edits, band count, persistence ----
    pg.focus("#tubeKnobs .knob"); pg.keyboard.press("ArrowUp")
    ck("touching a control turns processing on", pg.evaluate("__otr.adv.state().on") and pg.get_attribute("#advPower", "aria-pressed") == "true")
    ck("Drive knob moved by one step", abs(pg.evaluate("__otr.adv.state().drive") - 3.1) < 1e-6, pg.evaluate("__otr.adv.state().drive"))
    pg.click("#tubeChips .tchip[data-id='300B']"); pg.wait_for_timeout(100)
    ck("tube chip swaps the tube", pg.evaluate("__otr.adv.state().tube") == "300B" and "300B" in pg.inner_text("#tubeName"))
    pg.click("#eqBands button[data-n='15']"); pg.wait_for_timeout(100)
    ck("band count switches to 15", pg.evaluate("__otr.adv.state().bands") == 15 and len(pg.evaluate("__otr.adv.state().gains")) == 15)
    box = pg.locator("#eqCv").bounding_box()
    L, T, B = 30, 8, 18; cw = (box["width"] - L - 6) / 15; ih = box["height"] - T - B
    x = lambda i: box["x"] + L + cw * (i + 0.5); y = lambda gdb: box["y"] + T + (12 - gdb) / 24 * ih
    pg.mouse.move(x(3), y(9)); pg.mouse.down(); pg.mouse.move(x(9), y(-6), steps=12); pg.mouse.up()
    gs = pg.evaluate("__otr.adv.state().gains")
    ck("dragging sets the fader where you press", abs(gs[3] - 9) <= 1, gs)
    ck("sweeping across draws a sloped curve through every band crossed", gs[3] > gs[5] > gs[7] > gs[9] and abs(gs[9] + 6) <= 1, gs)
    ck("editing marks the preset Custom", pg.evaluate("document.getElementById('eqPreset').value") == "custom")
    pg.mouse.dblclick(x(3), y(0)); gs2 = pg.evaluate("__otr.adv.state().gains")
    ck("double-click zeroes a band", gs2[3] == 0, gs2)
    g0 = pg.evaluate("__otr.adv.state().gains[0]")
    pg.focus("#eqCv"); pg.keyboard.press("Home"); pg.keyboard.press("ArrowUp"); pg.keyboard.press("ArrowUp")
    ck("keyboard: Home then Up twice raises the first band 1 dB", pg.evaluate("__otr.adv.state().gains[0]") == min(12, g0 + 1.0), (g0, pg.evaluate("__otr.adv.state().gains[0]")))
    pg.click("#tubePower"); ck("tube module can be bypassed", not pg.evaluate("__otr.adv.state().tubeOn") and pg.evaluate("document.getElementById('tubeMod').classList.contains('off')"))
    pg.click("#tubePower")
    pg.wait_for_timeout(500)
    saved = pg.evaluate("__otr.adv.state()")
    pg.reload(); pg.wait_for_function("window.__otr && __otr.ready()", timeout=20000); pg.wait_for_timeout(200)
    back = pg.evaluate("__otr.adv.state()")
    ck("settings survive a reload (tube, bands, faders, power, rack open)", all(back[k] == saved[k] for k in ("tube", "bands", "gains", "on", "open", "drive")), (saved, back))
    ck("rack reopens on reload when it was open", pg.is_visible("#rack"))

    # ---- live: the chain is really in the signal path ----
    pg.click('#channelChips .station[data-ch="crime"]')
    try:
        pg.wait_for_function(PLAYING, timeout=45000)
        ch = pg.evaluate("__otr.adv.liveChain()")
        ck("live chain has the 15 EQ filters at ISO centres", ch and ch["n"] == 15 and ch["filters"][8][0] == 1000, ch)
        try: pg.wait_for_function("Math.max.apply(null, __otr.adv.levels().concat([-200])) > -90", timeout=20000)
        except Exception: pass
        lvls = pg.evaluate("__otr.adv.levels()")
        ck("LED ladders follow the live spectrum", len(lvls) == 15 and max(lvls) > -90, lvls)
        ck("output meter reads a level", "pk" in pg.inner_text("#outDb"), pg.inner_text("#outDb"))
        pg.click("#eqBands button[data-n='31']"); pg.wait_for_timeout(200)
        ck("switching to 31 bands rebuilds the live filters", pg.evaluate("__otr.adv.liveChain().n") == 31)
        pg.locator("#rack").screenshot(path=f"{SP}/otr_advanced_desktop.png")
    except Exception as e:
        print("NOTE live audio did not start (network):", str(e)[:90])
    ck("no page errors (desktop)", not errs, errs[:3])

    # ---- iPhone opt-in path and phone width ----
    ctx = b.new_context(viewport={"width": 375, "height": 812}, is_mobile=True, has_touch=True)
    m = ctx.new_page(); merrs = []
    m.on("pageerror", lambda e: merrs.append(str(e)))
    m.goto(BASE + "?ios=1"); m.wait_for_function("window.__otr && __otr.ready()", timeout=20000)
    ck("phone starts with 15 faders", m.evaluate("__otr.adv.state().bands") == 15)
    m.click('#channelChips .station[data-ch="comedy"]'); m.wait_for_timeout(800)
    ck("iPhone: plays natively (no Web Audio) while processing is off", not m.evaluate("__otr.webAudio()"))
    m.evaluate("document.getElementById('console').scrollIntoView()")
    m.click("#advBtn"); m.wait_for_timeout(200)
    ck("iPhone: no warning before processing is turned on", not m.is_visible("#advIosNote"))
    m.click("#advPower"); m.wait_for_timeout(300)
    ck("iPhone: turning processing on builds the audio graph", m.evaluate("__otr.webAudio()") and m.evaluate("__otr.adv.state().on"))
    ck("iPhone: the lock-screen warning shows", m.is_visible("#advIosNote"))
    try:
        m.wait_for_function(PLAYING, timeout=45000)
        try: m.wait_for_function("Math.max.apply(null, __otr.adv.levels().concat([-200])) > -90", timeout=20000); ok = True   # wait out quiet stretches
        except Exception: ok = False
        ck("iPhone: audio keeps flowing through the chain after opting in", ok, m.evaluate("__otr.adv.levels()"))
    except Exception as e:
        print("NOTE iPhone-path audio did not start (network):", str(e)[:90])
    sw = m.evaluate("document.documentElement.scrollWidth")
    ck("375 px: rack open, no horizontal scroll", sw <= 375, sw)
    m.locator("#rack").screenshot(path=f"{SP}/otr_advanced_phone.png")
    ck("no page errors (phone)", not merrs, merrs[:3])
    b.close()
httpd.shutdown()
print("FAILS", F)
sys.exit(1 if F else 0)
