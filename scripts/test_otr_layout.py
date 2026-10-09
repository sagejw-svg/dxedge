#!/usr/bin/env python3
"""Layout checks for the Old Time Radio player (/otr/): the tab bar under the player
(Channels / The Greats / Search / Build a station / Settings), the docked now-playing
bar, search paging, keyboard access, and the Internet Archive + Ko-fi support links.
Serves frontend/public over HTTP and drives it at phone and desktop widths.

Run:  python3 scripts/test_otr_layout.py
"""
import http.server, socketserver, threading, functools, sys, os
from playwright.sync_api import sync_playwright

pub = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public"))
SP = os.environ.get("OTR_SHOTS", "/tmp")
out = os.path.join(SP, "otr_layout")
PORT = 8798
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=pub)
handler.log_message = lambda *a, **k: None
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
fails = []
def ck(name, cond, detail=""):
    print(("PASS" if cond else "FAIL"), name, "" if cond else f"-> {detail}")
    if not cond: fails.append(name)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get("OTR_CHROMIUM", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"),
                          args=["--autoplay-policy=no-user-gesture-required"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(f"http://127.0.0.1:{PORT}/otr/")
    pg.wait_for_function("window.__otr && window.__otr.ready()", timeout=20000)
    ck("default tab is channels", pg.evaluate("__otr.tab()") == "channels")
    ck("dock hidden with nothing playing", not pg.evaluate("__otr.dockShown()"))
    ck("header has IA donate and Ko-fi tip", pg.evaluate("!!document.querySelector('#supportTop a[href*=\"archive.org/donate\"]') && !!document.querySelector('#supportTop a[href*=\"ko-fi.com/oldtimeradio\"]')"))
    # The support card carries the same tip links as the DXEdge Support tab (frontend/src/components/Support.jsx)
    import re
    sj = open(os.path.join(os.path.dirname(__file__), "..", "frontend", "src", "components", "Support.jsx")).read()
    want = {k: re.search(r"const %s\s*=\s*'([^']+)'" % k, sj).group(1) for k in ("BTC", "ETH", "PP", "KOFI")}
    got = pg.evaluate("({btc: document.getElementById('btcAddr').textContent.trim(), eth: document.getElementById('ethAddr').textContent.trim(), pp: document.getElementById('ppLink').href, kofi: document.getElementById('tipLink').href})")
    ck("support card matches the site Support tab (Ko-fi, PayPal, BTC, ETH)", got["btc"] == want["BTC"] and got["eth"] == want["ETH"] and got["pp"].rstrip("/") == want["PP"] and got["kofi"].rstrip("/") == want["KOFI"], (got, want))
    ck("Ko-fi tip visible above the fold", pg.evaluate("(function(){var r=document.getElementById('tipTop').getBoundingClientRect(); return r.top>=0 && r.bottom<=innerHeight && r.height>20;})()"))
    # tune a channel far down the list: the dock should appear
    pg.locator('#channelChips .station[data-ch="drama"]').scroll_into_view_if_needed()
    pg.click('#channelChips .station[data-ch="drama"]')
    pg.wait_for_timeout(600)
    ck("dock shows after tuning in below the fold", pg.evaluate("__otr.dockShown()"))
    ck("dock names the show", pg.inner_text("#dockShow").strip() != "" and pg.inner_text("#dockShow") == pg.inner_text("#npShow"), pg.inner_text("#dockShow"))
    ck("toast lifts above the dock", pg.evaluate("document.body.classList.contains('docked')"))
    try:
        pg.wait_for_function("!document.getElementById('audio').paused && document.getElementById('audio').currentTime>0.5", timeout=40000)
        ck("dock play button reads pause while playing", pg.inner_text("#dockPlay").strip() == "⏸")
        pg.click("#dockPlay"); pg.wait_for_timeout(400)
        ck("dock play/pause pauses", pg.evaluate("document.getElementById('audio').paused"))
        pg.click("#dockPlay"); pg.wait_for_timeout(1500)
        ck("dock play/pause resumes", not pg.evaluate("document.getElementById('audio').paused"))
    except Exception as e:
        print("NOTE audio did not start (network):", str(e)[:80])
    pg.screenshot(path=f"{out}-phone-docked.png")
    q0 = pg.evaluate("__otr.state.qi"); pg.click("#dockSkip"); pg.wait_for_timeout(500)
    ck("dock skip advances", pg.evaluate("__otr.state.qi") != q0 or not pg.evaluate("__otr.state.live"))
    pg.click("#dockUp"); pg.wait_for_timeout(900)
    ck("dock up returns to the player and hides the dock", not pg.evaluate("__otr.dockShown()"))
    # tabs
    pg.click("#settingsBtn"); pg.wait_for_timeout(200)
    ck("settings tab shows the toggles", pg.is_visible("#enhToggle") and pg.is_visible("#commToggle") and pg.is_visible("#shuffleToggle"))
    ck("channels hidden while settings open", not pg.is_visible("#channelChips"))
    ck("tab remembered", pg.evaluate("localStorage.getItem('otr_tab')") == "settings")
    pg.screenshot(path=f"{out}-phone-settings.png", full_page=True)
    pg.click("#greatsBtn"); pg.wait_for_timeout(200)
    ck("greats tab shows chips", pg.is_visible("#greatChips .chip"))
    pg.click("#builderBtn"); pg.wait_for_timeout(200)
    ck("build tab shows the grid", pg.is_visible("#showGrid .showitem"))
    pg.click("#searchBtn"); pg.wait_for_timeout(200)
    pg.wait_for_function("__otr.search('x')!==null", timeout=20000)
    pg.fill("#searchInput", "murder"); pg.wait_for_timeout(700)
    n = pg.evaluate("document.querySelectorAll('#results .result').length")
    ck("search pages 50 at a time", n == 50, n)
    ck("show more button present", pg.is_visible("#results .moreres"))
    pg.click("#results .moreres"); pg.wait_for_timeout(200)
    ck("show more adds results", pg.evaluate("document.querySelectorAll('#results .result').length") == 100)
    pg.screenshot(path=f"{out}-phone-search.png")
    pg.reload(); pg.wait_for_function("window.__otr && window.__otr.ready()", timeout=20000)
    ck("reload restores the search tab", pg.evaluate("__otr.tab()") == "search")
    sw = pg.evaluate("document.documentElement.scrollWidth")
    ck("no horizontal scroll at 390", sw <= 390, sw)
    ck("no page errors (phone)", not errs, errs[:3])
    ctx.close()

    # desktop: hash deep link and '/' shortcut, 375 check
    ctx = b.new_context(viewport={"width": 1280, "height": 800})
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(f"http://127.0.0.1:{PORT}/otr/#greats")
    pg.wait_for_function("window.__otr && window.__otr.ready()", timeout=20000)
    ck("#greats hash opens The Greats", pg.evaluate("__otr.tab()") == "greats")
    pg.click("body"); pg.keyboard.press("/"); pg.wait_for_timeout(400)
    ck("'/' opens search and focuses the box", pg.evaluate("__otr.tab()") == "search" and pg.evaluate("document.activeElement.id") == "searchInput")
    pg.keyboard.press("Escape"); pg.evaluate("document.activeElement.blur()")
    pg.focus("#searchBtn"); pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(100)
    ck("arrow keys move along the tabs", pg.evaluate("__otr.tab()") == "build" and pg.evaluate("document.activeElement.id") == "builderBtn")
    pg.click("#channelsBtn"); pg.evaluate("scrollTo(0,0)"); pg.wait_for_timeout(200)
    pg.screenshot(path=f"{out}-desk.png")
    ck("no page errors (desktop)", not errs, errs[:3])
    pg.set_viewport_size({"width": 375, "height": 800})
    for t in ["channels", "greats", "search", "build", "settings"]:
        pg.evaluate(f"__otr.tab('{t}')"); pg.wait_for_timeout(100)
        sw = pg.evaluate("document.documentElement.scrollWidth")
        ck(f"375 px no horizontal scroll on {t}", sw <= 375, sw)
    b.close()
httpd.shutdown()
print("FAILS", fails)
sys.exit(1 if fails else 0)
