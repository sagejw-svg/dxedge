#!/usr/bin/env python3
"""Second row of the Advanced sound rack on /otr/: de-esser, speaker, room, stereo width, scenes.

DSP checks render through a fresh copy of the chain in a stereo OfflineAudioContext
(window.__otr.adv.measure), with tones, multi-tones or a click, and read levels, harmonics,
L/R correlation and reverb tails. One check decodes the start of a real archive.org recording
(network permitting). UI checks drive the modules in a real page at desktop and phone widths.

Run:  python3 scripts/test_otr_rack2.py
"""
import http.server, socketserver, threading, functools, sys, os, math

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public"))
PORT = 8786
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

OFF = {"on": True, "eqOn": False, "tubeOn": False, "deOn": False, "spkOn": False, "roomOn": False, "wOn": False}
TONES = [{"f": f, "a": 0.06} for f in (110, 230, 470, 950, 1900, 3700, 6100)]
RIN = math.sqrt(sum(t["a"] ** 2 / 2 for t in TONES))
PLAYING = "!document.getElementById('audio').paused && document.getElementById('audio').currentTime>0.5"

from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get("OTR_CHROMIUM", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"),
                          args=["--autoplay-policy=no-user-gesture-required"])
    pg = b.new_page(viewport={"width": 1366, "height": 1300}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(BASE); pg.wait_for_function("window.__otr && __otr.ready()", timeout=20000)
    M = lambda st, **kw: pg.evaluate("a => __otr.adv.measure(a)", dict(set=dict(OFF, **st), **kw))

    # ---- de-esser ----
    flat = [M({"deOn": True, "deAmt": 0, "deFreq": 5}, freq=f)["gainDb"] for f in range(3000, 9001, 500)]
    ck("de-esser at amount 0 is flat through the crossover (3-9 kHz)", max(abs(x) for x in flat) < 0.1, flat)
    two = [{"f": 500, "a": 0.2}, {"f": 7000, "a": 0.1}]
    r0 = M({"deOn": True, "deAmt": 0, "deFreq": 5}, tones=two, probe=[500, 7000])["probe"]
    r5 = M({"deOn": True, "deAmt": 5, "deFreq": 5}, tones=two, probe=[500, 7000])["probe"]
    ck("de-esser pulls a loud 7 kHz S down by 6 dB or more", r0[1]["L"] - r5[1]["L"] >= 6, (r0, r5))
    ck("and leaves the 500 Hz voice band alone", abs(r0[0]["L"] - r5[0]["L"]) < 0.2, (r0, r5))
    rl = M({"deOn": True, "deAmt": 5, "deFreq": 5, "deListen": True}, tones=two, probe=[500, 7000])["probe"]
    ck("listen solos the S band (voice band gone)", rl[0]["L"] < r0[0]["L"] - 60 and rl[1]["L"] > -40, rl)
    url = pg.evaluate("(()=>{const c=__otr.catalog(); const s=c.shows.find(x=>x.id==='dragnet'); const e=s.eps[1]; return c.prefix+s.ids[e[3]]+'/'+e[4];})()")
    try:
        a0 = pg.evaluate("a=>__otr.adv.analyzeFile(a.u,a.s,900000,3000)", {"u": url, "s": dict(OFF, deOn=True, deAmt=0, deFreq=5, deListen=True)})
        a10 = pg.evaluate("a=>__otr.adv.analyzeFile(a.u,a.s,900000,3000)", {"u": url, "s": dict(OFF, deOn=True, deAmt=10, deFreq=5, deListen=True)})
        v0 = pg.evaluate("a=>__otr.adv.analyzeFile(a.u,a.s,900000,3000)", {"u": url, "s": dict(OFF, deOn=True, deAmt=0, deFreq=5)})
        v10 = pg.evaluate("a=>__otr.adv.analyzeFile(a.u,a.s,900000,3000)", {"u": url, "s": dict(OFF, deOn=True, deAmt=10, deFreq=5)})
        ck("real recording: amount 10 cuts S-band peaks by 10 dB or more", a0["hi"]["pk"] - a10["hi"]["pk"] >= 10, (a0["hi"], a10["hi"]))
        ck("real recording: voice band (200 Hz-3 kHz) within 0.3 dB", abs(v0["lo"]["rms"] - v10["lo"]["rms"]) < 0.3, (v0["lo"], v10["lo"]))
    except Exception as e:
        print("NOTE real-recording check skipped (network):", str(e)[:100])

    # ---- speaker ----
    for cab in pg.evaluate("__otr.adv.cabs()"):
        for f in (100, 1000, 8000):
            meas = M({"spkOn": True, "cab": cab, "spkInt": 8}, freq=f, amp=0.1)["gainDb"]
            drawn = pg.evaluate(f"__otr.adv.cabResponse({f},'{cab}',8)")
            ck(f"{cab}: drawn response matches the audio at {f} Hz", abs(meas - drawn) < 0.4, (meas, drawn))
    g = lambda cab, f, i=8: M({"spkOn": True, "cab": cab, "spkInt": i}, freq=f, amp=0.1)["gainDb"]
    ck("console radio rolls off the top (8 kHz down 5 dB or more)", g("console", 8000) < -5)
    ck("Bakelite tabletop has no bass (100 Hz down 3 dB or more)", g("bakelite", 100) < -3)
    ck("level trim keeps 1 kHz within 3 dB for every cabinet", all(abs(g(c, 1000)) < 3 for c in pg.evaluate("__otr.adv.cabs()")))
    ck("intensity 0 is effectively flat", all(abs(g("bakelite", f, 0)) < 0.5 for f in (100, 1000, 8000)))

    # ---- room ----
    tails = {}
    for rm, (dec, mix, tone) in {"living": (0.55, 20, 4), "studio": (0.9, 15, 6), "theater": (1.8, 22, 5), "hall": (3.4, 25, 4)}.items():
        st = {"roomOn": True, "room": rm, "rmDecay": dec, "rmMix": mix, "rmTone": tone}
        tails[rm] = M(st, impulse=True, dur=max(1.5, dec * 1.5), tailAfter=0.1)["tailDb"]
        lv = 20 * math.log10(M(st, tones=TONES, dur=max(1.5, dec * 2.2))["rms"] / RIN)
        ck(f"room {rm}: adds a reverb tail", tails[rm] > -35, tails[rm])
        ck(f"room {rm}: overall level within 1.5 dB", abs(lv) < 1.5, lv)
    ck("bigger rooms ring longer (hall > theater > living)", tails["hall"] > tails["theater"] > tails["living"], tails)
    ck("room bypassed adds nothing", M({"roomOn": False}, impulse=True, dur=1, tailAfter=0.1)["tailDb"] < -100)
    rm = M({"roomOn": True, "room": "theater", "rmDecay": 1.8, "rmMix": 22, "rmTone": 5}, impulse=True, dur=2.5)
    ck("room reverb is stereo (left and right decorrelated)", rm["corr"] < 0.995, rm["corr"])

    # ---- width ----
    for wd in (0, 100, 200):
        r = M({"wOn": True, "width": wd, "wChar": 9}, freq=1000, amp=0.25, probe=[1000])
        ck(f"width {wd}%: folding to mono gives the original exactly", abs(r["probe"][0]["M"] - 20 * math.log10(0.25)) < 0.1, r["probe"])
    ck("width 0% is mono", M({"wOn": True, "width": 0}, tones=TONES)["corr"] > 0.999)
    c100 = M({"wOn": True, "width": 100, "wChar": 9}, tones=TONES)["corr"]
    c200 = M({"wOn": True, "width": 200, "wChar": 9}, tones=TONES)["corr"]
    ck("width 100% turns mono into stereo", 0.4 < c100 < 0.95, c100)
    ck("width 200% is wider but never out of phase", 0 < c200 < c100, (c100, c200))
    ck("bass stays centred even at 200%", M({"wOn": True, "width": 200}, freq=100, amp=0.25)["corr"] > 0.98)

    # ---- whole chain ----
    r = pg.evaluate("() => __otr.adv.measure({set:{on:true,eqOn:true,deOn:true,tubeOn:true,spkOn:true,roomOn:true,wOn:true,width:200,tube:'KT88',drive:9,bands:31,gains:new Array(31).fill(12),pre:6,preset:'custom',cab:'horn',room:'hall',rmMix:60}, amp:0.9, dur:2})")
    ck("all seven stages maxed: still nothing over 0 dBFS on either channel", r["peak"] <= 1.0, r["peak"])

    # ---- UI ----
    pg.click("#advBtn"); pg.wait_for_timeout(200)
    ck("four new modules are in the rack", all(pg.is_visible(s) for s in ("#deMod", "#spkMod", "#roomMod", "#wMod")))
    st = pg.evaluate("__otr.adv.state()")
    ck("new stages start bypassed", not any(st[k] for k in ("deOn", "spkOn", "roomOn", "wOn")), st)
    pg.focus("#deKnobs .knob:nth-child(2)"); pg.keyboard.press("ArrowUp")
    st = pg.evaluate("__otr.adv.state()")
    ck("touching a de-esser knob turns it (and processing) on", st["deOn"] and st["on"] and abs(st["deAmt"] - 5.1) < 1e-6, st)
    pg.click("#cabChips .tchip[data-id='bakelite']"); st = pg.evaluate("__otr.adv.state()")
    ck("cabinet chip picks the speaker and switches it on", st["spkOn"] and st["cab"] == "bakelite" and "Bakelite" in pg.inner_text("#cabName"))
    pg.click("#roomChips .tchip[data-id='hall']"); st = pg.evaluate("__otr.adv.state()")
    ck("room chip loads the room's settings", st["roomOn"] and st["room"] == "hall" and st["rmDecay"] == 3.4 and "3.40" in pg.inner_text("#roomKnobs"))
    pg.focus("#wKnobs .knob"); pg.keyboard.press("Home"); st = pg.evaluate("__otr.adv.state()")
    ck("width knob Home gives 0% and reads mono", st["wOn"] and st["width"] == 0 and "mono" in pg.inner_text("#wKnobs"))
    pg.click("#deListen"); ck("listen toggles on", pg.get_attribute("#deListen", "aria-pressed") == "true" and pg.evaluate("__otr.adv.state().deListen"))
    chain = pg.evaluate("Array.from(document.querySelectorAll('#advChain span')).map(s => [s.textContent, s.classList.contains('on')])")
    ck("chain header lights the stages that are on", dict(chain) == {"EQ": True, "DE-ESS": True, "TUBE": True, "SPEAKER": True, "ROOM": True, "WIDTH": True, "LIMIT": True}, chain)
    pg.wait_for_timeout(500); pg.reload(); pg.wait_for_function("window.__otr && __otr.ready()", timeout=20000)
    st = pg.evaluate("__otr.adv.state()")
    ck("new settings survive a reload", st["cab"] == "bakelite" and st["room"] == "hall" and st["width"] == 0 and st["deOn"], st)
    ck("listen does not survive a reload (it is a momentary tool)", not st["deListen"] and pg.get_attribute("#deListen", "aria-pressed") == "false")
    pg.select_option("#advScene", "fireside"); pg.wait_for_timeout(200); st = pg.evaluate("__otr.adv.state()")
    ck("scene sets every stage (Fireside console)", st["cab"] == "console" and st["room"] == "living" and st["width"] == 70 and st["tube"] == "12AX7"
       and all(st[k] for k in ("on", "eqOn", "deOn", "tubeOn", "spkOn", "roomOn", "wOn")), st)
    ck("scene menu returns to its label", pg.evaluate("document.getElementById('advScene').value") == "")
    knobv = pg.evaluate("Array.from(document.querySelectorAll('#wKnobs .kv')).map(e => e.textContent)")
    ck("knobs show the scene's values", knobv[0] == "70%", knobv)
    pg.click("#advReset"); st = pg.evaluate("__otr.adv.state()")
    ck("reset puts the new stages back to bypass", not any(st[k] for k in ("deOn", "spkOn", "roomOn", "wOn")) and st["cab"] == "console", st)

    # live: goniometer and de-esser meter move with real audio
    pg.select_option("#advScene", "palace")
    pg.click('#channelChips .station[data-ch="crime"]')
    try:
        pg.wait_for_function(PLAYING, timeout=45000)
        try: pg.wait_for_function("__otr.adv.corr() < 0.95", timeout=20000)
        except Exception: pass
        ck("goniometer: correlation drops below mono with width on", pg.evaluate("__otr.adv.corr()") < 0.95, pg.evaluate("__otr.adv.corr()"))
        ck("speaker, room and goniometer canvases are drawn", pg.evaluate("['spkCv','roomCv','gonioCv'].every(id => document.getElementById(id).width > 0)"))
        pg.locator("#rack").screenshot(path=f"{SP}/otr_rack2_desktop.png")
    except Exception as e:
        print("NOTE live audio did not start (network):", str(e)[:90])
    ck("no page errors (desktop)", not errs, errs[:3])

    m = b.new_page(viewport={"width": 375, "height": 812}); merrs = []
    m.on("pageerror", lambda e: merrs.append(str(e)))
    m.goto(BASE); m.wait_for_function("window.__otr && __otr.ready()", timeout=20000)
    m.click("#advBtn"); m.select_option("#advScene", "kitchen"); m.wait_for_timeout(300)
    sw = m.evaluate("document.documentElement.scrollWidth")
    ck("375 px: full rack with every stage, no horizontal scroll", sw <= 375, sw)
    ck("no page errors (phone)", not merrs, merrs[:3])
    b.close()
httpd.shutdown()
print("FAILS", F)
sys.exit(1 if F else 0)
