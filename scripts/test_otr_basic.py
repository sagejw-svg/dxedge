#!/usr/bin/env python3
"""Basic mode on the Old Time Radio player (/otr/).

Basic is the visitor default: a Listen Live mount (#otr-live), a Now playing /
Up next slot, and a short list of popular shows that play in the existing
player. Advanced is the full page. The choice is remembered in localStorage
under otr_mode. Playwright sets navigator.webdriver, and with no saved choice
the page stays on Advanced so the older suites still see the full player.

Run:  python3 scripts/test_otr_basic.py
"""
import http.server, socketserver, threading, functools, sys, os
from playwright.sync_api import sync_playwright

pub = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public"))
PORT = 8788
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=pub)
handler.log_message = lambda *a, **k: None
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
fails = []

def ck(name, cond, detail=""):
    print(("PASS" if cond else "FAIL"), name, "" if cond else f"-> {detail}")
    if not cond:
        fails.append(name)

# Only the first visit of a context. A later choice (and a reload) must stick.
BASIC = "if(!localStorage.getItem('otr_mode')) localStorage.setItem('otr_mode','basic')"
URL = f"http://127.0.0.1:{PORT}/otr/"

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get("OTR_CHROMIUM", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"))

    # Saved choice wins, and the product default (a real visitor, webdriver false) is Basic.
    ctx = b.new_context()
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL)
    pg.wait_for_function("window.__otr && window.__otr.ready() && window.OTRMode", timeout=20000)
    rules = pg.evaluate("""() => ({
        visitor: OTRMode.choose(null, false),
        suite: OTRMode.choose(null, true),
        savedBasic: OTRMode.choose('basic', true),
        savedAdv: OTRMode.choose('advanced', false),
        junk: OTRMode.choose('nope', false),
        here: OTRMode.current()
    })""")
    ck("a visitor with no saved choice gets Basic", rules["visitor"] == "basic", rules)
    ck("an automated run with no saved choice keeps Advanced", rules["suite"] == "advanced" and rules["here"] == "advanced", rules)
    ck("a saved choice wins over the automated fallback", rules["savedBasic"] == "basic" and rules["savedAdv"] == "advanced", rules)
    ck("an unknown saved value falls through to Basic for a visitor", rules["junk"] == "basic", rules)
    ck("Advanced still shows the full player", pg.is_visible("#console") and pg.is_visible("#channelChips") and not pg.is_visible("#otr-basic"))
    ck("no page errors on Advanced", not errs, errs[:3])
    ctx.close()

    # Basic, phone width.
    ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    ctx.add_init_script(BASIC)
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL)
    pg.wait_for_function("window.__otr && __otr.ready() && document.querySelectorAll('#otrPopular .otr-pop').length >= 6", timeout=20000)
    ck("Basic is showing and the full page is not", pg.is_visible("#otr-basic") and pg.is_visible("#otr-live") and not pg.is_visible("#console") and not pg.is_visible("#channelChips"))
    ck("Listen Live mount is the placeholder until a player is added", pg.is_visible("#otrLiveBtn") and pg.evaluate("OTRBasic.placeholderVisible()"))
    box = pg.evaluate("""() => {
        const s = document.getElementById('otrModeSwitch').getBoundingClientRect();
        const live = document.getElementById('otrLiveBtn').getBoundingClientRect();
        const bs = document.getElementById('otrModeBasic').getBoundingClientRect();
        const asw = document.getElementById('otrModeAdvanced').getBoundingClientRect();
        return { sw: document.documentElement.scrollWidth, s, live, bs, asw, iw: innerWidth, ih: innerHeight };
    }""")
    ck("no horizontal scroll at 390", box["sw"] <= 390, box["sw"])
    ck("switch is a short bar at the top right, not a side panel",
       box["s"]["top"] < 40 and box["s"]["right"] <= box["iw"] + 1 and box["s"]["left"] >= 0
       and box["s"]["width"] > box["s"]["height"] and box["s"]["height"] <= 64
       and box["s"]["right"] > box["iw"] - 24, box["s"])
    ck("both mode buttons are tall enough to tap", box["bs"]["height"] >= 40 and box["asw"]["height"] >= 40, (box["bs"], box["asw"]))
    ck("Listen Live is a large button", box["live"]["height"] >= 80 and box["live"]["width"] >= 280, box["live"])
    ck("Basic is the pressed side", pg.get_attribute("#otrModeBasic", "aria-pressed") == "true" and pg.get_attribute("#otrModeAdvanced", "aria-pressed") == "false")
    names = pg.eval_on_selector_all("#otrPopular .otr-pop", "els => els.map(e => e.dataset.id)")
    ck("popular list leads with Suspense, Gunsmoke and The Shadow", names[:3] == ["suspense", "gunsmoke", "the-shadow"], names)
    pg.click("#otrPopular .otr-pop[data-id='suspense']")
    pg.wait_for_function("(__otr.state.stationShowIds||[])[0]==='suspense' && document.getElementById('otrNowShow').textContent.trim()==='Suspense'", timeout=10000)
    now = pg.evaluate("""() => ({
        show: document.getElementById('otrNowShow').textContent.trim(),
        next: document.getElementById('otrNowNext').textContent.trim(),
        n: __otr.state.queue.length
    })""")
    ck("a popular show plays in the existing player and fills Now playing", now["show"] == "Suspense" and now["n"] > 1, now)
    ck("Up next names something after this episode", now["next"] and "Pick a show" not in now["next"] and "Nothing queued" not in now["next"], now["next"])

    pg.evaluate("""() => {
        const n = document.createElement('div');
        n.id = 'otr-live-player';
        n.setAttribute('data-otr-live-player', '');
        n.textContent = 'live player';
        document.getElementById('otr-live').appendChild(n);
    }""")
    pg.wait_for_function("!OTRBasic.placeholderVisible()", timeout=2000)
    ck("a mounted live player replaces the placeholder", pg.is_visible("#otr-live-player") and not pg.is_visible("#otr-live-placeholder"))
    pg.evaluate("document.getElementById('otr-live-player').remove()")
    pg.wait_for_function("OTRBasic.placeholderVisible()", timeout=2000)
    ck("removing the live player brings the placeholder back", pg.is_visible("#otrLiveBtn"))
    pg.evaluate("document.getElementById('otr-live').dataset.otrLive = 'ready'")
    pg.wait_for_function("!OTRBasic.placeholderVisible()", timeout=2000)
    ck("data-otr-live=ready hides the placeholder", not pg.evaluate("OTRBasic.placeholderVisible()"))
    pg.evaluate("document.getElementById('otr-live').removeAttribute('data-otr-live')")

    pg.click("#otrModeAdvanced")
    pg.wait_for_timeout(100)
    ck("Advanced reveals the full page and remembers it",
       pg.is_visible("#console") and pg.is_visible("#greatChips") and not pg.is_visible("#otr-basic")
       and pg.evaluate("localStorage.getItem('otr_mode')") == "advanced")
    pg.reload()
    pg.wait_for_function("window.__otr && __otr.ready()", timeout=20000)
    ck("Advanced survives a reload", pg.evaluate("OTRMode.current()") == "advanced" and pg.is_visible("#console") and not pg.is_visible("#otr-basic"))
    pg.click("#otrModeBasic")
    ck("switching back to Basic is saved", pg.evaluate("localStorage.getItem('otr_mode')") == "basic" and pg.is_visible("#otr-live") and not pg.is_visible("#console"))
    pg.reload()
    pg.wait_for_function("window.__otr && __otr.ready()", timeout=20000)
    ck("Basic survives a reload", pg.evaluate("OTRMode.current()") == "basic" and pg.is_visible("#otrNowShow") and not pg.is_visible("#console"))
    ck("no page errors on Basic", not errs, errs[:3])
    ctx.close()

    # Desktop width, Basic, switch still top-right and the page doesn't scroll sideways.
    ctx = b.new_context(viewport={"width": 1280, "height": 800})
    ctx.add_init_script(BASIC)
    pg = ctx.new_page()
    pg.goto(URL)
    pg.wait_for_function("document.getElementById('otrModeSwitch')", timeout=20000)
    desk = pg.evaluate("""() => {
        const s = document.getElementById('otrModeSwitch').getBoundingClientRect();
        const tip = document.getElementById('tipTop').getBoundingClientRect();
        return { s, tip, sw: document.documentElement.scrollWidth, iw: innerWidth };
    }""")
    ck("desktop switch sits at the top right of the page",
       desk["s"]["top"] < 30 and abs(desk["s"]["right"] - desk["tip"]["right"]) < 2
       and desk["s"]["width"] > desk["s"]["height"] and desk["sw"] <= 1280, desk)
    ck("desktop support link is not covered by the switch", desk["tip"]["top"] >= desk["s"]["bottom"] - 1, (desk["s"], desk["tip"]))
    b.close()

httpd.shutdown()
print("FAILS", fails)
sys.exit(1 if fails else 0)
