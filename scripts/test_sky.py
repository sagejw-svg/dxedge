#!/usr/bin/env python3
"""Headless test for the two unlisted Sky photo-history pages
(/ranch-z4swx8er55/ and /ramona-h0whnlp4/) at desktop and mobile sizes.

Serves frontend/public over HTTP with a stand-in for the droplet's nginx:
directory-index fallthrough, /<slug>/tiles/ aliased to a local tile build,
and X-Robots-Tag on the hidden prefixes. Drives both pages with Playwright
through the window.__sky hook. Mirrors scripts/test_otr.py.

Checks: 200 + noindex (header and markup), one slide per manifest entry,
OpenSeadragon mounts and loads deep-zoom tiles, the pin ring (and the lot
outline on Ramona) is overlaid, explore mode toggles gestures, keyboard
navigation, the Esri slides carry their note, the mobile card collapses, the
points map opens with markers and the location-unknown list, the About
section renders the owner table and the sister link, the shared index lists
both pages, and no console errors or failed same-origin requests.

Run:  python3 scripts/test_sky.py [--tiles DIR] [--base URL]
  --tiles DIR   tile pyramids built by scripts/build_sky_tiles.sh (default
                /var/lib/dxedge/sky-tiles; without one, slides fall back to
                the web JPGs and the tile checks are skipped)
  --base URL    test a live site instead of serving locally
Env: SKY_CHROMIUM=path to a Chromium binary (else Playwright's default).
"""
import argparse, functools, http.server, json, os, posixpath, sys, threading, time, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.abspath(os.path.join(HERE, "..", "frontend", "public"))
SITES = {"ranch-z4swx8er55": ("ranch", 18), "ramona-h0whnlp4": ("ramona", 42)}
HIDDEN = tuple("/%s/" % s for s in SITES) + ("/sky-f1st035d/",)
PORT = 8793


def make_handler(tiles_dir):
    class H(http.server.SimpleHTTPRequestHandler):
        def translate_path(self, path):
            path = urllib.parse.unquote(urllib.parse.urlparse(path).path)
            for slug, (site, _) in SITES.items():
                pre = "/%s/tiles/" % slug
                if tiles_dir and path.startswith(pre):
                    return os.path.join(tiles_dir, site, posixpath.normpath(path[len(pre):]).lstrip("/"))
            p = os.path.join(PUBLIC, posixpath.normpath(path).lstrip("/"))
            if os.path.isdir(p):
                idx = os.path.join(p, "index.html")
                return idx if os.path.exists(idx) else p
            return p
        def end_headers(self):
            if urllib.parse.urlparse(self.path).path.startswith(HIDDEN):
                self.send_header("X-Robots-Tag", "noindex, nofollow")
            super().end_headers()
        def log_message(self, *a):
            pass
    return H


def serve(tiles_dir):
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), make_handler(tiles_dir))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tiles", default="/var/lib/dxedge/sky-tiles")
    ap.add_argument("--base", default=None)
    ap.add_argument("--shots", default=None, help="directory for screenshots")
    args = ap.parse_args()
    from playwright.sync_api import sync_playwright

    tiles_dir = args.tiles if os.path.isdir(args.tiles) else None
    base = args.base or "http://127.0.0.1:%d" % PORT
    if not args.base:
        serve(tiles_dir)
    if args.shots:
        os.makedirs(args.shots, exist_ok=True)
    fails = []

    def check(cond, msg):
        print(("PASS " if cond else "FAIL ") + msg)
        if not cond:
            fails.append(msg)

    def shot(page, name):
        if args.shots:
            page.screenshot(path=os.path.join(args.shots, name + ".png"))

    def run(pw, label, viewport, mobile):
        launch = {"args": ["--no-sandbox"]}
        if os.environ.get("SKY_CHROMIUM"):
            launch["executable_path"] = os.environ["SKY_CHROMIUM"]
        browser = pw.chromium.launch(**launch)
        ctx = browser.new_context(viewport=viewport, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile)
        page = ctx.new_page()
        errors, failed = [], []
        external = ("arcgis", "nationalmap")
        page.on("pageerror", lambda e: errors.append(str(e)))
        # Without a tile build, tiles/index.json 404s by design (the page falls back).
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" and not (tiles_dir is None and "404" in m.text) else None)
        page.on("requestfailed", lambda r: failed.append(r.url) if not any(x in r.url for x in external) else None)
        page.on("response", lambda r: failed.append("%d %s" % (r.status, r.url)) if r.status >= 400 and not any(x in r.url for x in external) and not r.url.endswith("tiles/index.json") else None)

        for slug, (site, n) in SITES.items():
            print("\n== %s %s" % (label, slug))
            r = page.goto("%s/%s/" % (base, slug), wait_until="networkidle")
            check(r.status == 200, "200")
            check("noindex" in (r.headers.get("x-robots-tag") or ""), "X-Robots-Tag noindex header")
            check('name="robots" content="noindex, nofollow"' in page.content(), "meta robots noindex")
            page.wait_for_selector(".sky-slide", timeout=15000)
            check(page.locator(".sky-slide").count() == n, "%d slides rendered" % n)
            check(page.locator(".sky-scrub .dot").count() == n, "scrubber has one dot per slide")
            shot(page, "%s-%s-title" % (label, slug))

            page.evaluate("window.__sky.goTo(0, true)")
            page.wait_for_function("window.__sky.current() === 0", timeout=10000)
            page.wait_for_selector("#view-0 canvas", timeout=15000)
            time.sleep(1.5)
            check(page.locator("#view-0 canvas").count() >= 1, "slide 0 viewer mounted")
            check(page.locator(".sky-slide.current .sky-card .year").inner_text().strip().isdigit(), "card shows the year")
            shot(page, "%s-%s-slide0" % (label, slug))

            tile_slide = page.evaluate("() => { const s = window.__sky.site.slides; for (let i = 1; i < s.length; i++) { if (!s[i].esri && window.__sky.hasTiles(s[i].hires[0].name)) return i; } return -1; }")
            if tile_slide >= 0:
                tile_urls = []
                page.on("response", lambda r: tile_urls.append(r.url) if "/tiles/" in r.url and r.url.endswith(".jpg") and r.status == 200 else None)
                page.evaluate("window.__sky.goTo(%d, true)" % tile_slide)
                page.wait_for_function("window.__sky.current() === %d" % tile_slide, timeout=10000)
                page.wait_for_selector("#view-%d canvas" % tile_slide, timeout=15000)
                time.sleep(2.5)
                check(len(tile_urls) > 0, "deep-zoom tiles loaded for slide %d (%d tiles)" % (tile_slide, len(tile_urls)))
                vis = page.evaluate("() => Array.from(document.querySelector('.sky-slide.current').querySelectorAll('.sky-ticks .tick')).map(t => t.style.display !== 'none' && t.getBoundingClientRect().width > 0)")
                check(len(vis) == 4 and all(vis), "four edge ticks visible with the pin on screen (%s)" % vis)
                # ticks follow the viewport: pan the pin off the left edge, left/right ticks stay, top/bottom hide
                page.evaluate("() => { const v = window.__sky.slides[%d].osd; const b = v.viewport.getBounds(); v.viewport.panBy(new OpenSeadragon.Point(b.width * 2, 0), true); }" % tile_slide)
                time.sleep(0.5)
                vis2 = page.evaluate("() => Array.from(document.querySelector('.sky-slide.current').querySelectorAll('.sky-ticks .tick')).map(t => t.style.display !== 'none')")
                check(vis2 == [False, False, True, True], "top/bottom ticks hide when the pin leaves the frame horizontally (%s)" % vis2)
                page.evaluate("() => window.__sky.slides[%d].osd.viewport.goHome(true)" % tile_slide)
                time.sleep(0.5)
                check(page.locator("#view-%d svg.sky-parcel" % tile_slide).count() == 0, "no lot outline drawn on the tiled slide")
                shot(page, "%s-%s-tiles" % (label, slug))
            else:
                print("skip  no tile pyramids available; fallback JPGs in use")
                tile_slide = 1
                page.evaluate("window.__sky.goTo(1, true)")
                page.wait_for_function("window.__sky.current() === 1", timeout=10000)
                page.wait_for_selector("#view-1 canvas", timeout=15000)
                time.sleep(1.5)
                vis = page.evaluate("() => Array.from(document.querySelector('.sky-slide.current').querySelectorAll('.sky-ticks .tick')).map(t => t.style.display !== 'none' && t.getBoundingClientRect().width > 0)")
                check(len(vis) == 4 and all(vis), "four edge ticks visible on the web-copy fallback (%s)" % vis)

            page.evaluate("window.__sky.setExplore(%d, true)" % tile_slide)
            check(page.locator(".sky-slide.explore").count() == 1, "explore mode on")
            check(page.evaluate("window.__sky.slides[%d].osd.innerTracker.isTracking()" % tile_slide) is True, "OpenSeadragon gestures enabled in explore mode")
            page.keyboard.press("Escape")
            check(page.locator(".sky-slide.explore").count() == 0, "Escape leaves explore mode")

            page.keyboard.press("ArrowDown")
            page.wait_for_function("window.__sky.current() === %d" % (tile_slide + 1), timeout=10000)
            check(True, "ArrowDown advances a slide")
            page.keyboard.press("PageUp")
            page.wait_for_function("window.__sky.current() === %d" % tile_slide, timeout=10000)
            check(True, "PageUp goes back")

            page.keyboard.press("End")
            page.wait_for_function("window.__sky.current() === %d" % (n - 1), timeout=10000)
            time.sleep(1.5)
            shot(page, "%s-%s-last" % (label, slug))

            esri_idx = page.evaluate("() => window.__sky.site.slides.findIndex(s => s.esri)")
            page.evaluate("window.__sky.goTo(%d, true)" % esri_idx)
            page.wait_for_function("window.__sky.current() === %d" % esri_idx, timeout=10000)
            time.sleep(2)
            note = page.locator("#note-%d" % esri_idx).inner_text()
            check("Esri" in note, "Esri slide %d carries an Esri note" % esri_idx)
            check(page.locator("#view-%d canvas" % esri_idx).count() >= 1, "Esri slide shows the web copy while browsing")
            shot(page, "%s-%s-esri" % (label, slug))
            live_idx = page.evaluate("() => window.__sky.site.slides.findIndex(s => s.esri && s.esri_live && s.esri_live.kind === 'current')")
            if live_idx >= 0:
                page.evaluate("window.__sky.goTo(%d, true)" % live_idx)
                page.wait_for_function("window.__sky.current() === %d" % live_idx, timeout=10000)
                time.sleep(1.5)
                check(page.locator("#view-%d.leaflet-container" % live_idx).count() == 0 and page.locator("#view-%d canvas" % live_idx).count() >= 1, "live Esri slide is a plain picture while browsing")
                page.evaluate("window.__sky.setExplore(%d, true)" % live_idx)
                page.wait_for_selector("#view-%d.leaflet-container" % live_idx, timeout=10000)
                time.sleep(1)
                check(page.evaluate("window.__sky.slides[%d].leaflet.dragging.enabled()" % live_idx) is True, "live Esri map mounts with gestures in explore mode")
                vis = page.evaluate("() => Array.from(document.querySelector('.sky-slide.current').querySelectorAll('.sky-ticks .tick')).map(t => t.style.display !== 'none')")
                check(len(vis) == 4 and all(vis), "edge ticks on the live Esri map (%s)" % vis)
                page.keyboard.press("Escape")
                time.sleep(1)
                check(page.locator("#view-%d.leaflet-container" % live_idx).count() == 0 and page.evaluate("window.__sky.slides[%d].leaflet" % live_idx) is None, "live map is torn down on Done")

            if mobile:
                card = page.locator(".sky-slide.current .sky-card")
                check("collapsed" in (card.get_attribute("class") or ""), "card starts collapsed on mobile")
                card.locator(".head").click()
                check("collapsed" not in (card.get_attribute("class") or ""), "card expands on tap")
                shot(page, "%s-%s-card-open" % (label, slug))

            page.keyboard.press("m")
            page.wait_for_selector(".sky-mappanel.open .leaflet-marker-icon", timeout=15000)
            time.sleep(2)
            markers = page.locator(".sky-mappanel .leaflet-marker-icon").count()
            check(markers >= 10, "map shows %d markers" % markers)
            check("not on the map" in page.locator(".sky-mappanel .unknown").inner_text().lower(), "location-unknown list rendered")
            shot(page, "%s-%s-map" % (label, slug))
            page.keyboard.press("Escape")
            check(page.locator(".sky-mappanel.open").count() == 0, "Escape closes the map")

            page.evaluate("document.querySelector('.sky-about').scrollIntoView()")
            time.sleep(0.8)
            sister = page.locator(".sky-about .sister a").first.get_attribute("href")
            check(bool(sister) and sister.startswith("/") and sister != "/%s/" % slug, "sister link -> %s" % sister)
            check(page.locator(".sky-about table tbody tr").count() >= 5, "owner-by-era table rendered")
            shot(page, "%s-%s-about" % (label, slug))

        r = page.goto("%s/sky-f1st035d/" % base, wait_until="load")
        check(r.status == 200 and "noindex" in page.content(), "shared index loads with noindex")
        check(page.locator(".idx a.card").count() == 2, "shared index lists both pages")

        bad = [e for e in errors if "favicon" not in e]
        check(not bad, "no console or page errors (%s)" % label + ("" if not bad else ": " + " | ".join(bad)[:400]))
        badreq = [u for u in failed if "favicon" not in u]
        check(not badreq, "no failed same-origin requests (%s)" % label + ("" if not badreq else ": " + " | ".join(badreq)[:400]))
        browser.close()

    with sync_playwright() as pw:
        run(pw, "desktop", {"width": 1440, "height": 900}, False)
        run(pw, "mobile", {"width": 390, "height": 844}, True)

    print("\n%d failures" % len(fails))
    for f in fails:
        print(" -", f)
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
