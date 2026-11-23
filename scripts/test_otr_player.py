#!/usr/bin/env python3
"""Player view: one page for playback, the lamp, and the EQ.

It is optional. Basic and Advanced stay. Switching views does not start
playback and does not add an audio element.

Run: python3 scripts/test_otr_player.py
"""
import http.server
import os
import socketserver
import threading

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public"))
PORT = 8792
SHOTS = os.environ.get("OTR_SHOTS", "/tmp")
os.makedirs(SHOTS, exist_ok=True)

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, *a):
        pass

socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), H)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{PORT}/otr/"
F = []

def ck(name, cond, detail=""):
    print(("PASS" if cond else "FAIL"), name, "" if cond else f"-> {detail}")
    if not cond:
        F.append(name)

def shot(page, name):
    page.screenshot(path=os.path.join(SHOTS, name), full_page=False)

with __import__("playwright.sync_api", fromlist=["sync_playwright"]).sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"])

    def open_player(width, height, label):
        pg = b.new_page(viewport={"width": width, "height": height})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(URL)
        pg.wait_for_function("window.__otr && __otr.ready() && window.OTRMode", timeout=20000)
        audios = pg.evaluate("document.querySelectorAll('audio').length")
        paused = pg.evaluate("document.getElementById('audio').paused")
        pg.click("#otrModePlayer")
        pg.wait_for_timeout(400)
        return pg, errs, audios, paused

    # Landscape, the main arrangement (iPad-sized).
    pg, errs, audios, paused = open_player(1180, 820, "landscape")
    ck("Player is optional and remembered", pg.evaluate("OTRMode.current()") == "player" and pg.evaluate("localStorage.getItem('otr_mode')") == "player")
    ck("Player keeps the existing page, not the Basic card", pg.is_visible("#console") and not pg.is_visible("#otr-basic"))
    ck("Watch later is still in the header", pg.get_attribute("#watchLater", "href") == "/otr/latenight/")
    box = pg.evaluate("""() => {
      const play = document.getElementById('playBtn').getBoundingClientRect();
      const sleep = document.getElementById('sleepSel').getBoundingClientRect();
      const lamp = document.getElementById('lampCv').getBoundingClientRect();
      const eq = document.getElementById('eqCv').getBoundingClientRect();
      const scene = document.getElementById('advScene').getBoundingClientRect();
      const consoleBox = document.getElementById('console').getBoundingClientRect();
      return {
        sw: document.documentElement.scrollWidth, iw: innerWidth, ih: innerHeight,
        playH: play.height, playTop: play.top, sleepH: sleep.height,
        lamp: lamp.width > 40 && lamp.height > 80,
        lampTop: lamp.top, lampBottom: lamp.bottom, lampLeft: lamp.left, consoleRight: consoleBox.right,
        eq: eq.width > 80 && eq.height > 40, eqTop: eq.top, eqBottom: eq.bottom,
        sceneH: scene.height, sceneTop: scene.top,
        tubeBottom: document.getElementById('tubeMod').getBoundingClientRect().bottom,
        moreBottom: document.getElementById('playerMoreSound').getBoundingClientRect().bottom
      };
    }""")
    ck("landscape does not scroll sideways", box["sw"] <= box["iw"] + 1, box)
    ck("play and sleep are large enough to tap", box["playH"] >= 44 and box["sleepH"] >= 44, box)
    ck("lamp, EQ, and scenes are on this page", box["lamp"] and box["eq"] and box["sceneH"] >= 44, box)
    ck("lamp sits beside the player, on the first screen",
       box["lampLeft"] >= box["consoleRight"] - 8 and box["lampTop"] < box["ih"] and box["lampBottom"] <= box["ih"] and box["sceneTop"] < box["ih"] and box["eqBottom"] <= box["ih"] + 2 and box["tubeBottom"] <= box["ih"] + 2 and box["moreBottom"] <= box["ih"] + 2, box)
    ck("opening Player does not start the audio or add a player",
       pg.evaluate("document.querySelectorAll('audio').length") == audios and pg.evaluate("document.getElementById('audio').paused") == paused, audios)
    shot(pg, "otr-player-landscape.png")

    # Change the picture and the EQ while a clip is playing.
    pg.evaluate("""() => {
      const a = document.getElementById('audio');
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const dest = ctx.createMediaStreamDestination();
      osc.connect(dest); osc.start();
      a.srcObject = dest.stream;
      return a.play();
    }""")
    pg.wait_for_timeout(300)
    ck("a clip is playing before the controls move", pg.evaluate("!document.getElementById('audio').paused"))
    pg.select_option("#lampColSel", "bedtime")
    pg.wait_for_timeout(200)
    pg.select_option("#advScene", "fireside")
    pg.select_option("#eqPreset", "voice")
    pg.wait_for_timeout(250)
    state = pg.evaluate("""() => ({
      paused: document.getElementById('audio').paused,
      col: __otr.adv.state().lampCol,
      preset: __otr.adv.state().preset,
      sceneOn: __otr.adv.state().on,
      audios: document.querySelectorAll('audio').length,
      still: document.getElementById('lampStill') && !document.getElementById('lampStill').hidden
    })""")
    ck("colour, EQ, and scene change while the same clip keeps playing",
       state["paused"] is False and state["col"] == "bedtime" and state["preset"] == "voice" and state["sceneOn"] and state["audios"] == audios and state["still"], state)

    # Portrait fallback.
    pg.set_viewport_size({"width": 820, "height": 1180})
    pg.wait_for_timeout(300)
    port = pg.evaluate("""() => ({
      sw: document.documentElement.scrollWidth, iw: innerWidth,
      lamp: document.getElementById('lampCv').getBoundingClientRect().height,
      play: document.getElementById('playBtn').getBoundingClientRect().height
    })""")
    ck("portrait does not scroll sideways and keeps play and the lamp",
       port["sw"] <= port["iw"] + 1 and port["lamp"] > 80 and port["play"] >= 44, port)
    shot(pg, "otr-player-portrait.png")
    ck("no page errors (player)", not errs, errs[:3])

    # Desktop.
    desk = b.new_page(viewport={"width": 1280, "height": 860})
    desk.goto(URL)
    desk.wait_for_function("window.__otr && __otr.ready()", timeout=20000)
    desk.click("#otrModePlayer")
    desk.wait_for_timeout(400)
    dbox = desk.evaluate("({sw: document.documentElement.scrollWidth, iw: innerWidth, lamp: document.getElementById('lampCv').getBoundingClientRect().width})")
    ck("desktop Player fits and shows the lamp", dbox["sw"] <= dbox["iw"] + 1 and dbox["lamp"] > 100, dbox)
    shot(desk, "otr-player-desktop.png")

    # Back to Advanced and Basic: the old pages are still there, and the clip's element is the same one.
    desk.click("#otrModeAdvanced")
    desk.wait_for_timeout(200)
    ck("Advanced is unchanged and still the full page",
       desk.evaluate("OTRMode.current()") == "advanced" and desk.is_visible("#console") and desk.is_visible("#greatChips") and not desk.is_visible("#otr-basic"))
    desk.click("#otrModeBasic")
    ck("Basic still hides the console", desk.evaluate("OTRMode.current()") == "basic" and not desk.is_visible("#console") and desk.is_visible("#otr-basic"))
    ck("dates and bedtime helpers are still on the page",
       desk.evaluate("window.OTRAirDate && window.OTRBedtime && __otr.airTitle('Outer Limit','08 Apr 1950')") == "Outer Limit · 08 Apr 1950")
    b.close()

httpd.shutdown()
print("FAILS", F)
raise SystemExit(1 if F else 0)
