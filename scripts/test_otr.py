#!/usr/bin/env python3
"""Headless smoke test for the Old Time Radio player (/otr/).
Serves frontend/public/otr over HTTP and drives it with Playwright + the
window.__otr hook. Verifies the catalog loads, channels build playlists of
real archive.org URLs, skip advances, search returns hits, and station
share codes round-trip. Mirrors scripts/test_emulators.py / test_skip.py.

Run:  python3 scripts/test_otr.py
"""
import http.server, socketserver, threading, os, sys, functools, json

ROOT = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "otr")
ROOT = os.path.abspath(ROOT)
PORT = 8791

def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    httpd.RequestHandlerClass.log_message = lambda *a, **k: None
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd

def main():
    from playwright.sync_api import sync_playwright
    httpd = serve()
    fails = []
    def check(name, cond, detail=""):
        print(("PASS" if cond else "FAIL"), name, ("" if cond else "-> "+str(detail)))
        if not cond: fails.append(name)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("OTR_CHROMIUM", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"))
        page = browser.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
        bad_resp = []
        def on_resp(r):
            if r.status >= 400 and "favicon" not in r.url:  # harness serves no favicon; production does
                bad_resp.append(f"{r.status} {r.url}")
        page.on("response", on_resp)
        page.goto(f"http://127.0.0.1:{PORT}/index.html")
        page.wait_for_function("window.__otr && window.__otr.ready()", timeout=15000)

        chans = page.evaluate("window.__otr.channels()")
        check("catalog + channels loaded", isinstance(chans, list) and len(chans) >= 8, chans)

        cat = page.evaluate("window.__otr.catalog()")
        nshows = len(cat["shows"]) if cat else 0
        check("catalog has shows", nshows >= 150, nshows)

        # start a channel, verify queue of real archive.org urls
        page.evaluate("window.__otr.startChannel('future')")
        urls = page.evaluate("window.__otr.queueUrls()")
        check("channel builds a playlist", isinstance(urls, list) and len(urls) > 5, len(urls) if urls else 0)
        check("urls point at archive.org", all(u and u.startswith("https://archive.org/download/") for u in urls[:20]), urls[:2])
        cur1 = page.evaluate("window.__otr.currentUrl()")
        check("has a current track", bool(cur1), cur1)

        # skip advances to a different track
        page.evaluate("window.__otr.next()")
        cur2 = page.evaluate("window.__otr.currentUrl()")
        check("skip advances the track", bool(cur2) and cur2 != cur1, {"a": cur1, "b": cur2})

        # commercials toggle inserts ads over time
        info = page.evaluate("window.__otr.currentInfo()")
        check("current info resolves", info and info.get("show"), info)

        # search
        page.evaluate("window.__otr.loadSearch()")
        page.wait_for_function("!!window.__otr.catalog() && window.__otr.search('martian') !== null", timeout=15000)
        n = page.evaluate("window.__otr.search('martian')")
        check("search 'martian' returns hits", isinstance(n, int) and n > 0, n)
        n2 = page.evaluate("window.__otr.search('murder detective')")
        check("multi-term search returns hits", isinstance(n2, int) and n2 > 0, n2)

        # station code round-trip
        rt = page.evaluate("""() => {
            const cat = window.__otr.catalog();
            const ids = cat.shows.filter(s=>!s.adv).slice(0,5).map(s=>s.id);
            const code = window.__otr.encodeStation(ids);
            const back = window.__otr.decodeStation(code);
            return {ids, code, back};
        }""")
        check("station code round-trips", rt["ids"] == rt["back"] and len(rt["code"]) > 0, rt)

        # start custom station
        page.evaluate("""() => {
            const cat = window.__otr.catalog();
            const ids = cat.shows.filter(s=>!s.adv).slice(0,3).map(s=>s.id);
            window.__otr.startStation(ids, 'Test');
        }""")
        surls = page.evaluate("window.__otr.queueUrls()")
        check("custom station builds a playlist", isinstance(surls, list) and len(surls) > 3, len(surls) if surls else 0)

        check("no page/JS errors", len(errors) == 0, errors[:5])
        check("no failed resource loads (excl favicon)", len(bad_resp) == 0, bad_resp[:5])
        browser.close()
    httpd.shutdown()
    print("\n" + ("ALL PASSED" if not fails else f"{len(fails)} FAILED: {fails}"))
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
