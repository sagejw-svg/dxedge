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
    pg.keyboard.down("q"); pg.wait_for_timeout(40)
    ck("Hexode: Q holds middle C", pg.evaluate("__hexode.held()") == [60], pg.evaluate("__hexode.held()"))
    pg.evaluate("""() => {
      const ev = new KeyboardEvent('keydown', { key: 'q', code: 'KeyQ', bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'keyCode', { get: () => 81 });
      Object.defineProperty(ev, 'repeat', { get: () => true });
      window.dispatchEvent(ev);
    }""")
    ck("Hexode: key repeat does not stack another voice", pg.evaluate("__hexode.held()") == [60], pg.evaluate("__hexode.held()"))
    pg.keyboard.down("Shift"); pg.keyboard.up("Shift")
    ck("Hexode: Shift while a key is held does not stack it", pg.evaluate("__hexode.held()") == [60], pg.evaluate("__hexode.held()"))
    pg.keyboard.up("q"); pg.wait_for_timeout(30)
    ck("Hexode: keyup releases the note", pg.evaluate("__hexode.held()") == [])
    pg.evaluate("""() => { __hexode.noteOn(60, 0.8); __hexode.noteOn(60, 0.8); __hexode.noteOff(60); }""")
    ck("Hexode: one note-off releases every copy of that note", pg.evaluate("__hexode.held()") == [])
    pg.keyboard.down("q")
    pg.evaluate("window.dispatchEvent(new Event('blur'))")
    pg.keyboard.up("q")
    ck("Hexode: blur releases a held key", pg.evaluate("__hexode.held()") == [])
    pg.keyboard.down("q")
    pg.evaluate("""() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); }""")
    pg.evaluate("""() => { delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); }""")
    pg.keyboard.up("q")
    ck("Hexode: a hidden tab releases a held key", pg.evaluate("__hexode.held()") == [])
    pg.keyboard.down("q"); pg.click("#panicBtn"); pg.keyboard.up("q"); pg.wait_for_timeout(30)
    ck("Hexode: the panic button releases a held key", pg.evaluate("__hexode.held()") == [])
    pg.evaluate("__hexode.midi([0x90, 64, 100])"); pg.wait_for_timeout(30)
    ck("Hexode: a MIDI note on is held", 64 in pg.evaluate("__hexode.held()"))
    pg.evaluate("__hexode.midi([0xB0, 123, 0])")
    ck("Hexode: MIDI all-notes-off releases it", pg.evaluate("__hexode.held()") == [])
    bank = bytearray(4104)
    bank[0:6] = bytes([0xF0, 0x43, 0x00, 0x09, 0x20, 0x00])
    bank[124:134] = b"HEXODE TST"
    # give the first operator a level so the loaded voice is a real program
    bank[6 + 14] = 99
    loaded = pg.evaluate("(a) => __hexode.loadSysex(a)", list(bank))
    ck("Hexode: a .syx bank loads and names the first voice", isinstance(loaded, str) and loaded.startswith("HEXODE TST"), loaded)
    ck("Hexode: still no console errors after the note and the bank", quiet(errs), errs)
    ck("Hexode: volume starts at unity and the limiter is off", pg.evaluate("__hexode.gain()") == 1 and pg.evaluate("__hexode.limit()") is False)
    pg.evaluate("__hexode.noteOn(62, 0.8)")
    pg.evaluate("document.getElementById('holdBtn').click()")
    pg.evaluate("__hexode.noteOff(62)")
    ck("Hexode: hold keeps the note after note-off", 62 in pg.evaluate("__hexode.held()") and pg.evaluate("__hexode.hold()") is True)
    pg.click("#panicBtn")
    ck("Hexode: panic clears hold", pg.evaluate("__hexode.held()") == [] and pg.evaluate("__hexode.hold()") is False)
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
    pg.evaluate("__anode.noteOn()")
    pg.evaluate("window.dispatchEvent(new Event('blur'))")
    pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
    pg.wait_for_timeout(250)
    rms = pg.evaluate("__anode.rms()")
    ck("Anode: blur and a tab hide do not silence the groovebox", rms > 0.005, rms)
    pg.evaluate("__anode.noteOff()")
    home = pg.evaluate("__anode.cutoff()")
    pg.evaluate("() => { const c = document.querySelector('.dial'); c.focus(); c.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); }")
    turned = pg.evaluate("__anode.cutoff()")
    pg.click("#anodeReset")
    ck("Anode: a focused dial moves, and Reset puts it back", turned != home and abs(pg.evaluate("__anode.cutoff()") - home) < 1e-6, (home, turned, pg.evaluate("__anode.cutoff()")))
    ck("Anode: no console errors", quiet(errs), errs)
    pg.close()

    b.close()

print("ALL PASS" if not F else f"{len(F)} FAILED")
raise SystemExit(1 if F else 0)
