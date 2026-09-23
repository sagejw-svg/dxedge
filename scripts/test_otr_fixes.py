#!/usr/bin/env python3
"""Regression tests for the OTR bug-fix pass (bugs #2,#3,#4,#6,#7,#8,#9 + enhancements).
Serves frontend/public/otr and drives it with the window.__otr hook.
Run:  python3 scripts/test_otr_fixes.py
"""
import http.server, socketserver, threading, os, functools, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "otr"))
PORT = 8793

def serve():
    socketserver.TCPServer.allow_reuse_address = True
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), h)
    httpd.RequestHandlerClass.log_message = lambda *a, **k: None
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd

def main():
    from playwright.sync_api import sync_playwright
    httpd = serve(); fails=[]
    def ck(name, cond, detail=""):
        print(("PASS" if cond else "FAIL"), name, ("" if cond else "-> "+str(detail)))
        if not cond: fails.append(name)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=os.environ.get("OTR_CHROMIUM","/opt/pw-browsers/chromium-1194/chrome-linux/chrome"))
        pg = b.new_page()
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(f"http://127.0.0.1:{PORT}/index.html")
        pg.wait_for_function("window.__otr && window.__otr.ready()", timeout=15000)

        # #9 no orphan shows (every non-ad show is on at least one channel)
        orphans = pg.evaluate("window.__otr.catalog().shows.filter(s=>!s.adv && (!s.ch||!s.ch.length)).map(s=>s.id)")
        ck("#9 no shows off every channel", orphans==[], orphans)

        # #8 share codes are slugs and round-trip; legacy numeric still decodes
        rt = pg.evaluate("""() => {
            const ids=['x-minus-one','the-clock'];
            const code=window.__otr.encodeStation(ids);
            return {code, decoded:atob(code), back:window.__otr.decodeStation(code),
                    legacy:window.__otr.decodeStation(btoa('1,2'))};
        }""")
        ck("#8 share code uses slugs", "x-minus-one" in rt["decoded"], rt["decoded"])
        ck("#8 share code round-trips", rt["back"]==["x-minus-one","the-clock"], rt["back"])
        ck("#8 legacy numeric code still decodes", isinstance(rt["legacy"],list) and len(rt["legacy"])==2, rt["legacy"])

        # #4 status is 'tuning', not 'on air', before audio actually plays
        pg.evaluate("window.__otr.startChannel('future')")
        immediate = pg.inner_text("#onairText").lower()
        ck("#4 not 'on air' before playback", "on air" not in immediate and ("tuning" in immediate or "ready" in immediate or "buffering" in immediate), immediate)

        # #2 runaway-skip limiter: many failures cause at most 2 advances then back off
        st = pg.evaluate("""() => {
            const before = window.__otr.state.qi, hb = window.__otr.state.history.length, ql = window.__otr.state.queue.length;
            for (let i=0;i<15;i++) window.__otr.simulateFail();
            return {before, after: window.__otr.state.qi, hb, ha: window.__otr.state.history.length,
                    err: window.__otr.state.errCount, ql, qlAfter: window.__otr.state.queue.length};
        }""")
        advanced = st["after"] - st["before"]
        ck("#2 error limiter caps advances at 2", 0 <= advanced <= 2, st)
        ck("#2 queue does not balloon", st["qlAfter"] - st["ql"] <= 2, st)
        ck("#2 backoff engaged (errCount>=3)", st["err"] >= 3, st)

        # #7 commercials pre-interleaved into custom stations (up-next stays accurate)
        pg.evaluate("""() => { const ids=window.__otr.catalog().shows.filter(s=>!s.adv).slice(0,4).map(s=>s.id);
                               window.__otr.state.commercials=true; window.__otr.startStation(ids,'Test'); }""")
        cs = pg.evaluate("({ads: window.__otr.state.queue.some(x=>x.isAd), sched: window.__otr.state.schedAds})")
        ck("#7 custom station has ads pre-interleaved", cs["ads"] and cs["sched"], cs)

        # enhancement: stopwords dropped ('the martian' == 'martian')
        n_the = pg.evaluate("window.__otr.search('the martian')")
        n_plain = pg.evaluate("window.__otr.search('martian')")
        ck("stopwords: 'the martian' == 'martian'", n_the==n_plain and n_the>0, {"the":n_the,"plain":n_plain})

        # #6 restore last channel across reload (cued, not autoplaying)
        pg.evaluate("window.__otr.startChannel('crime')")   # writes otr_last
        pg.reload(); pg.wait_for_function("window.__otr.ready()", timeout=15000)
        restored = pg.evaluate("({ch: window.__otr.state.channel, q: window.__otr.state.queue.length, chip: !!document.querySelector('#channelChips .station.on')})")
        ck("#6 last channel cued after reload", restored["ch"]=="crime" and restored["q"]==0 and restored["chip"], restored)

        # keyboard: 'n' skips
        pg.evaluate("window.__otr.startChannel('comedy')")
        u1 = pg.evaluate("window.__otr.currentUrl()")
        pg.evaluate("document.body.focus()"); pg.keyboard.press("n"); pg.wait_for_timeout(200)
        u2 = pg.evaluate("window.__otr.currentUrl()")
        ck("keyboard 'n' skips", bool(u2) and u2!=u1, {"a":u1,"b":u2})

        # iOS background-audio path (?ios=1): native playback, no Web Audio graph, viz locked
        pg.goto(f"http://127.0.0.1:{PORT}/index.html?ios=1")
        pg.wait_for_function("window.__otr && window.__otr.ready()", timeout=15000)
        ck("iOS: detected via ?ios=1", pg.evaluate("window.__otr.isIOS()")==True)
        pg.evaluate("window.__otr.startChannel('future')"); pg.wait_for_timeout(300)
        ios = pg.evaluate("({wa: window.__otr.webAudio(), src: !!document.getElementById('audio').src, viz: window.__otr.state.vizMode})")
        ck("iOS: no Web Audio graph built (native playback survives lock)", ios["wa"]==False, ios)
        ck("iOS: audio element has a source", ios["src"]==True, ios)
        ck("iOS: visualizer locked to phonograph", ios["viz"]==0, ios)

        ck("no page errors", errs==[], errs[:3])
        b.close()
    httpd.shutdown()
    print("\n" + ("ALL PASSED" if not fails else f"{len(fails)} FAILED: {fails}"))
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
