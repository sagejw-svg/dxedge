#!/usr/bin/env python3
"""Smoke tests for the two vendored synth pages.

Hexode (/synth/fm/) is the six-operator FM synth. Anode (/synth/acid/) is the
acid bass groovebox. Each page has to load, stay quiet in the console, and
make a sound when a note is played.

Run: python3 scripts/test_synth_imported.py
"""
import http.server, socketserver, threading, functools, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public"))
PORT = int(os.environ.get("SYNTH_PORT", "8797"))
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
handler.log_message = lambda *a, **k: None
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()

F = []
def ck(name, cond, detail=""):
    print(("PASS" if cond else "FAIL"), name, "" if cond else f"-> {detail}")
    if not cond: F.append(name)

MARKS = ("dx7", "yamaha", "roland", "tr-909", "tb-303", "909", "303")

def watch(page):
    """Page errors, console errors, and failed responses other than a favicon."""
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

def forbidden(text):
    low = text.lower()
    return [m for m in MARKS if m in low]

from playwright.sync_api import sync_playwright
_CANDIDATES = [
    os.environ.get("SYNTH_CHROMIUM", ""),
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    "/opt/google/chrome/chrome",
    "/usr/local/bin/chrome",
]
CHROME = next(p for p in _CANDIDATES if p and os.path.exists(p))
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=CHROME, args=["--autoplay-policy=no-user-gesture-required"])

    # ---------------------------------------------------------------- Hexode
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    errs = watch(pg)
    pg.goto(f"http://127.0.0.1:{PORT}/synth/fm/")
    pg.wait_for_function("window.__hexode && __hexode.ready()", timeout=20000)
    pg.wait_for_timeout(300)
    text = pg.locator("body").inner_text()
    ck("Hexode: page shows its name", "hexode" in text.lower() and "six-operator fm" in text.lower(), text[:240])
    ck("Hexode: no trademark names in the UI", not forbidden(text), forbidden(text))
    ck("Hexode: MIDI input select is on the page", pg.locator("#midiIn").count() == 1)
    ck("Hexode: .syx bank input is on the page", pg.locator("#syxIn").count() == 1)
    ck("Hexode: no console errors", quiet(errs), errs)
    pg.evaluate("__hexode.resume()")
    pg.evaluate("__hexode.noteOn(60, 1)")
    pg.wait_for_timeout(500)
    peak = pg.evaluate("__hexode.peak()")
    ck("Hexode: a note is not silent", peak > 0.01, peak)
    pg.evaluate("__hexode.noteOff(60)")
    bank = bytearray(4104)
    bank[0:6] = bytes([0xF0, 0x43, 0x00, 0x09, 0x20, 0x00])
    bank[124:134] = b"HEXODE TST"
    # give the first operator a level so the loaded voice is a real program
    bank[6 + 14] = 99
    loaded = pg.evaluate("(a) => __hexode.loadSysex(a)", list(bank))
    ck("Hexode: a .syx bank loads and names the first voice", isinstance(loaded, str) and loaded.startswith("HEXODE TST"), loaded)
    ck("Hexode: still no console errors after the note and the bank", quiet(errs), errs)
    pg.close()

    # ---------------------------------------------------------------- Anode
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    errs = watch(pg)
    pg.goto(f"http://127.0.0.1:{PORT}/synth/acid/")
    pg.wait_for_selector("#_start_button", timeout=15000)
    intro = pg.locator("body").inner_text()
    ck("Anode: CC BY credit is visible before start", "Vitling" in intro and "David Whiting" in intro and "CC BY 4.0" in intro, intro[:400])
    ck("Anode: no trademark names in the UI", not forbidden(intro), forbidden(intro))
    pg.click("#_start_button")
    pg.wait_for_function("window.__anode && __anode.ready", timeout=15000)
    pg.evaluate("() => __anode.ready()")
    pg.wait_for_timeout(200)
    shown = pg.locator("body").inner_text()
    ck("Anode: credit stays on the page after start", "Vitling" in shown and "CC BY 4.0" in shown and "David Whiting" in shown, shown[:500])
    ck("Anode: the panel names the lines and the kit", "LINE 1" in shown and "LINE 2" in shown and "KIT" in shown, shown[:800])
    pg.evaluate("__anode.noteOn()")
    pg.wait_for_timeout(400)
    rms = pg.evaluate("__anode.rms()")
    ck("Anode: a note is not silent", rms > 0.005, rms)
    pg.evaluate("__anode.noteOff()")
    ck("Anode: no console errors", quiet(errs), errs)
    pg.close()

    b.close()

print("ALL PASS" if not F else f"{len(F)} FAILED")
raise SystemExit(1 if F else 0)
