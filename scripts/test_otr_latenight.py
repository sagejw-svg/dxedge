#!/usr/bin/env python3
"""Late Night replay (/otr/latenight/).

The finished master is not in this repo. The page keeps chapters and credits,
and it leaves the video without a source until a byte-range probe proves the
file is the real program. The only change on the main radio page is the
Watch later link.

Run: python3 scripts/test_otr_latenight.py
"""
import http.server
import json
import os
import re
import socketserver
import subprocess
import threading

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PUBLIC = os.path.join(ROOT, "frontend", "public")
PORT = 8811
BASE = f"http://127.0.0.1:{PORT}"
MEDIA = "/otr/media/latenight/latenight_master.mp4"
FIXTURE = "/tmp/otr-latenight-fixture.mp4"
CHROME = os.environ.get("OTR_CHROMIUM", "/opt/google/chrome/chrome")
SERVE = {"on": False}
RANGES = []

STARTS = [
    ("open-jingle", 0.0, "0:00:00", "Opening"),
    ("open-intro", 16.351, "0:00:16", "Late-night intro"),
    ("dx-outer-limit", 31.794, "0:00:31", "Outer Limit"),
    ("break-1-id", 1843.655, "0:30:43", "Station break"),
    ("break-1-next", 1855.197, "0:30:55", "Up next"),
    ("x1-tunnel", 1860.981, "0:31:00", "Tunnel Under The World"),
    ("break-2-id", 3607.85, "1:00:07", "Station break"),
    ("break-2-next", 3617.163, "1:00:17", "Up next"),
    ("dx-folded-hands", 3622.807, "1:00:22", "With Folded Hands"),
    ("break-3-id", 5389.241, "1:29:49", "Station break"),
    ("break-3-next", 5398.136, "1:29:58", "Up next"),
    ("x1-surface", 5403.919, "1:30:03", "Surface Tension"),
    ("close-jingle", 7120.957, "1:58:40", "Sign-off"),
]


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=PUBLIC, **k)

    def log_message(self, *a):
        pass

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == MEDIA:
            if not SERVE["on"]:
                self.send_error(404)
                return
            self.serve_media()
            return
        super().do_GET()

    def serve_media(self):
        data = open(FIXTURE, "rb").read()
        rng = self.headers.get("Range")
        RANGES.append(rng or "")
        common = {
            "Content-Type": "video/mp4",
            "Accept-Ranges": "bytes",
        }
        if rng and rng.startswith("bytes="):
            spec = rng.split("=", 1)[1].split(",")[0]
            a, _, b = spec.partition("-")
            start = int(a) if a else 0
            end = int(b) if b else len(data) - 1
            end = min(end, len(data) - 1)
            if start >= len(data) or start > end:
                body = b""
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{len(data)}")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            chunk = data[start:end + 1]
            self.send_response(206)
            for k, v in common.items():
                self.send_header(k, v)
            self.send_header("Content-Range", f"bytes {start}-{end}/{len(data)}")
            self.send_header("Content-Length", str(len(chunk)))
            self.end_headers()
            self.wfile.write(chunk)
            return
        self.send_response(200)
        for k, v in common.items():
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def media_block(nginx):
    part = nginx.split("location ^~ /otr/media/latenight/", 1)[1]
    return part.split("\n        location ", 1)[0]


def short_program(size):
    return {
        "id": "fixture",
        "title": "Fixture replay",
        "station": "Test",
        "duration": 8,
        "durationClock": "0:00:08",
        "poster": "/otr/scenes/space.jpg",
        "media": {
            "status": "pending",
            "placeholder": True,
            "url": MEDIA,
            "bytesApprox": size,
            "tolerance": 0.12,
            "note": "test fixture, not the master",
        },
        "credits": {"line": "Fixture credits.", "sources": []},
        "chapters": [
            {"id": "a", "kind": "open", "label": "Opening", "detail": "Jingle", "start": 0, "clock": "0:00:00"},
            {"id": "b", "kind": "ep", "label": "Middle", "detail": "Episode", "start": 3, "clock": "0:00:03"},
            {"id": "c", "kind": "close", "label": "Sign-off", "start": 6, "clock": "0:00:06"},
        ],
    }


OLD_SW = r"""
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (url.origin !== location.origin) return;
  var path = url.pathname;
  var js = path.endsWith('.js');
  var otr = path.indexOf('/otr/') === 0;
  if (!js && !otr) return;
  // The worker that shipped before the media exemption: refetch the URL and
  // drop Range, then the probe sees HTTP 200 for the whole file.
  event.respondWith(fetch(event.request.url, { cache: 'reload', credentials: 'same-origin' }));
});
"""

NEW_SW = r"""
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);
  if (url.pathname.indexOf('/otr/media/') === 0) return;
});
"""


def worker_case(browser, ck, fixture, size):
    """An older controlling worker drops Range. The page must update that
    worker before the GET, or it would download the file and show the
    range error. HEAD is answered wrongly on purpose and must not decide it."""
    port = 8813
    script = {"body": OLD_SW}
    naked = []
    ranged = []

    class W(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=PUBLIC, **k)

        def log_message(self, *a):
            pass

        def do_HEAD(self):
            self._serve(True)

        def do_GET(self):
            self._serve(False)

        def _serve(self, head):
            path = self.path.split("?", 1)[0]
            if path == "/sw-range-test.js":
                body = script["body"].encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/javascript")
                self.send_header("Cache-Control", "no-cache")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                if not head:
                    self.wfile.write(body)
                return
            if path == "/sw-boot.html":
                body = b"<!doctype html><title>boot</title>"
                self.send_response(200)
                self.send_header("Content-Type", "text/html")
                self.send_header("Cache-Control", "no-cache")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                if not head:
                    self.wfile.write(body)
                return
            if path == "/otr/latenight/program.json":
                body = json.dumps(short_program(size)).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Cache-Control", "no-cache")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                if not head:
                    self.wfile.write(body)
                return
            if path == MEDIA:
                self._media(head)
                return
            if head:
                self.send_error(405)
                return
            super().do_GET()

        def _media(self, head):
            data = open(fixture, "rb").read()
            rng = self.headers.get("Range")
            method = "HEAD" if head else "GET"
            if method == "HEAD":
                # A HEAD range response that is not 206 must not unlock playback.
                self.send_response(200)
                self.send_header("Content-Type", "text/html")
                self.send_header("Content-Length", "5")
                self.end_headers()
                return
            if not rng:
                naked.append(len(data))
                chunk = data[:32]
                self.send_response(200)
                self.send_header("Content-Type", "video/mp4")
                self.send_header("Content-Length", str(len(chunk)))
                self.send_header("Accept-Ranges", "bytes")
                self.end_headers()
                self.wfile.write(chunk)
                return
            ranged.append(rng)
            spec = rng.split("=", 1)[1].split(",")[0]
            a, _, b = spec.partition("-")
            start = int(a) if a else 0
            end = int(b) if b else len(data) - 1
            end = min(end, len(data) - 1)
            if start >= len(data) or start > end:
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{len(data)}")
                self.end_headers()
                return
            chunk = data[start:end + 1]
            self.send_response(206)
            self.send_header("Content-Type", "video/mp4")
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Range", f"bytes {start}-{end}/{len(data)}")
            self.send_header("Content-Length", str(len(chunk)))
            self.end_headers()
            self.wfile.write(chunk)

    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", port), W)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{port}"
    try:
        ctx = browser.new_context(service_workers="allow")
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(base + "/sw-boot.html")
        pg.evaluate("""async () => {
          await navigator.serviceWorker.register('/sw-range-test.js', {scope: '/'});
          if (!navigator.serviceWorker.controller) {
            await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, {once: true}));
          }
          await navigator.serviceWorker.ready;
        }""")
        pg.wait_for_function("navigator.serviceWorker.controller", timeout=8000)
        dropped = pg.evaluate("""async () => {
          const res = await fetch('/otr/media/latenight/latenight_master.mp4', {
            method: 'GET', headers: {Range: 'bytes=0-1'}, cache: 'no-store'
          });
          const info = {status: res.status, range: res.headers.get('content-range'), type: res.headers.get('content-type')};
          if (res.body && res.body.cancel) await res.body.cancel();
          return info;
        }""")
        ck("an older worker turns a ranged GET into 200 with no content-range",
           dropped["status"] == 200 and not dropped["range"] and naked, dropped)
        script["body"] = NEW_SW
        naked.clear()
        ranged.clear()
        pg.goto(base + "/otr/latenight/")
        pg.wait_for_function("window.LateNight && LateNight.state() !== 'loading'", timeout=20000)
        pg.wait_for_timeout(800)
        got = pg.evaluate("""() => {
          const v = document.getElementById('lnVideo');
          return {
            state: LateNight.state(),
            status: document.getElementById('lnStatus').textContent,
            hint: document.getElementById('lnHint').textContent,
            src: LateNight.videoSrc(),
            paused: v.paused,
            autoplay: v.autoplay,
            preload: v.preload,
            worker: LateNight.prepareWorker ? true : false
          };
        }""")
        ck("the page updates that worker and then plays from a real range",
           got["state"] == "ready" and got["paused"] and got["autoplay"] is False
           and got["preload"] == "none" and MEDIA in got["src"]
           and "did not return the video in byte ranges" not in got["status"], got)
        ck("that recovery never requests the whole file",
           not naked and any(r.startswith("bytes=0-1") for r in ranged)
           and "bytes=0-" not in ranged, {"naked": naked, "ranged": ranged[:8]})
        ck("no page errors while replacing the older worker", not errs, errs[:4])
        ctx.close()
    finally:
        srv.shutdown()


def main():
    fails = []

    def ck(name, cond, detail=""):
        print(("PASS" if cond else "FAIL"), name, ("" if cond else detail))
        if not cond:
            fails.append(name)

    page_html = open(os.path.join(PUBLIC, "otr", "index.html"), encoding="utf-8").read()
    replay_html = open(os.path.join(PUBLIC, "otr", "latenight", "index.html"), encoding="utf-8").read()
    program_text = open(os.path.join(PUBLIC, "otr", "latenight", "program.json"), encoding="utf-8").read()
    program = json.loads(program_text)
    nginx = open(os.path.join(ROOT, "nginx", "nginx.conf"), encoding="utf-8").read()
    compose = open(os.path.join(ROOT, "docker-compose.yml"), encoding="utf-8").read()
    sw = open(os.path.join(PUBLIC, "sw.js"), encoding="utf-8").read()
    backend = open(os.path.join(ROOT, "backend", "main.py"), encoding="utf-8").read()
    block = media_block(nginx)

    ck("main page has one Watch later link and does not retitle the player",
       page_html.count('id="watchLater"') == 1
       and 'href="/otr/latenight/"' in page_html
       and "Watch later" in page_html
       and "Late Night replay" in page_html
       and page_html.count("<h1>") == 1)
    ck("main page still has sleep, dates, slideshow, basic mode, and the live script",
       'id="npDate"' in page_html
       and 'id="sleepSel"' in page_html
       and 'value="end">end of episode' in page_html
       and "slideshow.js?v=1" in page_html
       and "basic.js?v=1" in page_html
       and "scifi-live.js?v=3" in page_html
       and "mode.js?v=1" in page_html)
    ck("replay page does not autoplay and has no baked video source",
       "autoplay" not in replay_html
       and "latenight_master.mp4" not in replay_html
       and 'preload="none"' in replay_html
       and "controls" in replay_html
       and 'role="status"' in replay_html
       and 'aria-label="Chapters"' in replay_html)
    for token in (
        '"start": 0.0', '"start": 16.351', '"start": 31.794', '"start": 1843.655',
        '"start": 1855.197', '"start": 1860.981', '"start": 3607.85', '"start": 3617.163',
        '"start": 3622.807', '"start": 5389.241', '"start": 5398.136', '"start": 5403.919',
        '"start": 7120.957', '"duration": 7136.308', '"durationClock": "1:58:56"',
        '"placeholder": true', '"status": "pending"',
        "/otr/media/latenight/latenight_master.mp4",
        '"bytesApprox": 982996026',
    ):
        ck(f"program.json keeps {token}", token in program_text)
    chapters = program["chapters"]
    ck("thirteen chapters match the master timeline",
       len(chapters) == 13
       and [(c["id"], c["start"], c["clock"]) for c in chapters] == [(a, b, c) for a, b, c, _ in STARTS]
       and all(label in chapters[i]["label"] for i, (*_, label) in enumerate(STARTS)))
    ck("credits name the four archive.org episodes",
       len(program["credits"]["sources"]) == 4
       and all(s["url"].startswith("https://archive.org/download/") for s in program["credits"]["sources"])
       and "Rob Dawson" in program["credits"]["line"])
    ck("poster is an existing scene, not a new image",
       program["poster"] == "/otr/scenes/space.jpg"
       and os.path.isfile(os.path.join(PUBLIC, "otr", "scenes", "space.jpg")))
    ck("nginx serves the master from the host directory with ranges and without a year pin",
       "proxy_pass" not in block
       and not re.search(r"(?m)^\s*mp4\s*;", block)
       and "immutable" not in block
       and "gzip off" in block
       and "max_ranges 1" in block
       and "alias /var/lib/dxedge/otr-media/" in block
       and 'Cache-Control "public, max-age=86400"' in block
       and "default_type video/mp4" in block
       and "sendfile on" in nginx)
    ck("replay page is not pinned for a year",
       "location ^~ /otr/latenight/" in nginx
       and 'Cache-Control "no-cache, must-revalidate"' in nginx)
    ck("compose mounts that directory read-only into nginx",
       "/var/lib/dxedge/otr-media:/var/lib/dxedge/otr-media:ro" in compose)
    ck("service worker does not cache the master",
       "url.pathname.startsWith('/otr/media/')" in sw
       and "dxedge-v191" in sw)
    ck("the app does not answer the media path with the site shell",
       'full_path.startswith("otr/media/")' in backend)

    subprocess.check_call([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-f", "lavfi", "-i", "color=c=0x102030:s=320x180:r=30:d=8",
        "-f", "lavfi", "-i", "sine=frequency=440:duration=8",
        "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart", FIXTURE,
    ])
    size = os.path.getsize(FIXTURE)
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", PORT), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    from playwright.sync_api import sync_playwright

    def fulfill_json(route, obj):
        route.fulfill(status=200, content_type="application/json", body=json.dumps(obj))

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROME,
            args=["--autoplay-policy=no-user-gesture-required", "--no-sandbox", "--disable-dev-shm-usage"],
        )

        def open_replay(route_json=None, route_media=None, mobile=False, hash_=""):
            ctx = browser.new_context(
                viewport={"width": 390, "height": 844} if mobile else {"width": 1100, "height": 900},
                is_mobile=mobile,
                has_touch=mobile,
            )
            pg = ctx.new_page()
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            if route_json is not None:
                pg.route("**/latenight/program.json*", lambda route: fulfill_json(route, route_json))
            if route_media is not None:
                pg.route("**/otr/media/latenight/latenight_master.mp4*", route_media)
            pg.goto(BASE + "/otr/latenight/" + hash_)
            pg.wait_for_function("window.LateNight && LateNight.state() !== 'loading'", timeout=15000)
            return ctx, pg, errs

        ctx, pg, errs = open_replay(mobile=True)
        meta = pg.evaluate("""() => {
          const p = LateNight.program();
          return {
            state: LateNight.state(),
            src: LateNight.videoSrc(),
            autoplay: document.getElementById('lnVideo').autoplay,
            preload: document.getElementById('lnVideo').getAttribute('preload'),
            hidden: document.getElementById('lnVideo').hidden,
            controls: document.getElementById('lnVideo').controls,
            status: document.getElementById('lnStatus').textContent,
            run: document.getElementById('lnRun').textContent,
            n: document.querySelectorAll('#lnChapters button').length,
            names: [...document.querySelectorAll('#lnChapters button')].map(b => b.innerText),
            clocks: p.chapters.map(c => LateNight.formatClock(c.start)),
            dur: LateNight.formatClock(p.duration),
            placeholder: p.media.placeholder,
            cross: LateNight.mediaUrl({url: 'https://evil.example/a.mp4'}),
            vtt: LateNight.toVtt(p.chapters, p.duration).includes('Dimension X')
          };
        }""")
        ck("a missing file stays pending and does not attach a video",
           meta["state"] == "pending" and meta["src"] == "" and meta["hidden"]
           and "not on the server yet" in meta["status"].lower() and "nothing is playing" in meta["status"].lower()
           and meta["placeholder"] is True, meta)
        ck("it does not autoplay", meta["autoplay"] is False and meta["preload"] == "none" and meta["controls"] is True, meta)
        ck("chapter clocks and the 1:58:56 running time are on the page",
           meta["clocks"] == [c for _, _, c, _ in STARTS]
           and meta["dur"] == "1:58:56"
           and "1:58:56" in meta["run"]
           and meta["n"] == 13
           and meta["vtt"] is True, meta)
        names = " | ".join(meta["names"])
        ck("chapter buttons name the time and the segment",
           "0:00:31" in names and "Outer Limit" in names and "1:58:40" in names and "Sign-off" in names, names[:400])
        pg.click("#lnChapters button[data-id='dx-outer-limit']")
        after = pg.evaluate("""() => ({
          src: LateNight.videoSrc(),
          current: document.querySelector('#lnChapters button[aria-current="true"]').dataset.id,
          status: document.getElementById('lnStatus').textContent,
          paused: document.getElementById('lnVideo').paused
        })""")
        ck("a chapter while the file is missing seeks nothing",
           after["src"] == "" and after["current"] == "dx-outer-limit" and after["paused"]
           and "0:00:31" in after["status"] and "nothing is playing" in after["status"].lower(), after)
        probes = pg.evaluate("""() => ({
          missing: LateNight.decideProbe({status:404, bytesApprox:983000000}),
          html: LateNight.decideProbe({status:200, contentType:'text/html', contentRange:'bytes 0-0/20', bytesApprox:983000000}),
          tiny: LateNight.decideProbe({status:206, contentType:'video/mp4', contentRange:'bytes 0-1/100', bytesApprox:983000000}),
          ok: LateNight.decideProbe({status:206, contentType:'video/mp4', contentRange:'bytes 0-1/983000000', bytesApprox:983000000, tolerance:0.12}),
          mib: LateNight.decideProbe({status:206, contentType:'video/mp4', contentRange:'bytes 0-1/1030750208', bytesApprox:983000000, tolerance:0.12}),
          published: LateNight.decideProbe({status:206, contentType:'video/mp4', contentRange:'bytes 0-1/982996026', bytesApprox:982996026, tolerance:0.12}),
          full: LateNight.decideProbe({status:200, contentType:'video/mp4', contentRange:null, bytesApprox:982996026}),
          rangedBut200: LateNight.decideProbe({status:200, contentType:'video/mp4', contentRange:'bytes 0-1/982996026', bytesApprox:982996026}),
          msg: LateNight.message('range'),
          cue: LateNight.resolveCue(LateNight.chapters(), '0:00:31').time,
          cue2: LateNight.resolveCue(LateNight.chapters(), '1:58:40').time,
          at: LateNight.chapterAt(LateNight.chapters(), 1861).id
        })""")
        ck("probe rules reject html, a full 200, and the wrong size",
           probes["missing"]["play"] is False and probes["missing"]["reason"] == "missing"
           and probes["html"]["play"] is False and probes["html"]["reason"] == "range"
           and probes["tiny"]["play"] is False and probes["tiny"]["reason"] == "size"
           and probes["ok"]["play"] is True and probes["mib"]["play"] is True
           and probes["published"]["play"] is True
           and probes["full"]["play"] is False and probes["full"]["reason"] == "range"
           and probes["rangedBut200"]["play"] is False and probes["rangedBut200"]["reason"] == "range"
           and probes["msg"] == "The replay address did not return the video in byte ranges, so it cannot be seeked. Nothing is playing."
           and abs(probes["cue"] - 31.794) < 0.001
           and abs(probes["cue2"] - 7120.957) < 0.001
           and probes["at"] == "x1-tunnel", probes)
        ck("a cross-origin media URL is refused", meta["cross"] == "", meta["cross"])
        box = pg.evaluate("""() => {
          const b = document.querySelector('#lnChapters button');
          const r = b.getBoundingClientRect();
          const img = document.getElementById('lnStill').getBoundingClientRect();
          return {
            scroll: document.documentElement.scrollWidth,
            iw: innerWidth,
            h: r.height,
            w: r.width,
            img: img.width,
            status: document.getElementById('lnStatus').getAttribute('role')
          };
        }""")
        ck("mobile pending page fits and the chapter control is tappable",
           box["scroll"] <= 390 and box["h"] >= 44 and box["w"] <= 390 and box["img"] <= 390
           and box["status"] == "status", box)
        ck("no page errors while the file is missing", not errs, errs)
        ctx.close()

        def html_body(route):
            route.fulfill(status=200, content_type="text/html", body="<!doctype html><title>nope</title>")

        ctx, pg, errs = open_replay(route_media=html_body)
        refused = pg.evaluate("""() => ({
          state: LateNight.state(),
          src: LateNight.videoSrc(),
          status: document.getElementById('lnStatus').textContent
        })""")
        ck("an HTML answer is not treated as the video",
           refused["state"] == "unavailable" and refused["src"] == ""
           and "nothing is playing" in refused["status"].lower(), refused)
        ck("no page errors on a bad media response", not errs, errs)
        ctx.close()

        ready_flag = json.loads(program_text)
        ready_flag["media"] = dict(ready_flag["media"], status="ready", placeholder=False)
        ctx, pg, errs = open_replay(route_json=ready_flag)
        flagged = pg.evaluate("() => ({ state: LateNight.state(), src: LateNight.videoSrc() })")
        ck("a ready flag without the file still does not play",
           flagged["state"] == "pending" and flagged["src"] == "", flagged)
        ctx.close()

        SERVE["on"] = True
        RANGES.clear()
        ctx, pg, errs = open_replay(route_json=short_program(size), hash_="#t=0:00:03")
        pg.wait_for_function(
            """() => {
              const v = document.getElementById('lnVideo');
              return LateNight.state()==='ready' && v && !v.hidden && v.paused && v.currentTime >= 2.5 && v.currentTime < 4;
            }""",
            timeout=15000)
        ready = pg.evaluate("""() => {
          const v = document.getElementById('lnVideo');
          return {
            src: v.currentSrc || v.src,
            autoplay: v.autoplay,
            attr: v.hasAttribute('autoplay'),
            paused: v.paused,
            preload: v.preload,
            controls: v.controls,
            label: v.getAttribute('aria-label'),
            track: !!v.querySelector('track[kind="chapters"]'),
            current: document.querySelector('#lnChapters button[aria-current="true"]').dataset.id,
            time: v.currentTime
          };
        }""")
        ck("a proved file can be seeked from a timestamp and does not autoplay",
           MEDIA in ready["src"] and ready["autoplay"] is False and ready["attr"] is False
           and ready["paused"] is True and ready["preload"] in ("none", "metadata") and ready["controls"] is True
           and ready["label"] == "Fixture replay" and ready["track"] is True
           and ready["current"] == "b" and 2.5 <= ready["time"] < 4, ready)
        ck("the probe asked for a byte range", any(r.startswith("bytes=0-1") for r in RANGES), RANGES[:6])
        pg.click("#lnChapters button[data-id='c']")
        pg.wait_for_function(
            """() => {
              const v = document.getElementById('lnVideo');
              return v.paused && v.currentTime >= 5.5 && v.currentTime < 7;
            }""",
            timeout=8000)
        pg.focus("#lnChapters button[data-id='a']")
        pg.keyboard.press("Enter")
        pg.wait_for_function(
            """() => document.getElementById('lnVideo').paused && document.getElementById('lnVideo').currentTime < 0.6
              && document.querySelector('#lnChapters button[aria-current="true"]').dataset.id === 'a'""",
            timeout=8000)
        ck("chapter buttons seek, including from the keyboard, and stay paused", True)
        desk = pg.evaluate("""() => ({
          scroll: document.documentElement.scrollWidth,
          video: document.getElementById('lnVideo').getBoundingClientRect().width
        })""")
        ck("desktop player stays inside the viewport", desk["scroll"] <= 1100 and 200 < desk["video"] <= 880, desk)
        pg.set_viewport_size({"width": 390, "height": 844})
        phone = pg.evaluate("""() => {
          const b = document.querySelector('#lnChapters button');
          const v = document.getElementById('lnVideo').getBoundingClientRect();
          return { scroll: document.documentElement.scrollWidth, h: b.getBoundingClientRect().height, vw: v.width };
        }""")
        ck("mobile player fits and the chapter control stays tappable",
           phone["scroll"] <= 390 and phone["h"] >= 44 and phone["vw"] <= 390, phone)
        ck("no page errors once the fixture is playing", not errs, errs)
        os.makedirs("/tmp/otr-latenight-shots", exist_ok=True)
        pg.screenshot(path="/tmp/otr-latenight-shots/mobile-ready.png")
        ctx.close()

        ctx = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        ctx.add_init_script("localStorage.setItem('otr_mode','basic')")
        home = ctx.new_page()
        herrs = []
        home.on("pageerror", lambda e: herrs.append(str(e)))
        home.goto(BASE + "/otr/")
        home.wait_for_function("window.OTRMode && document.getElementById('watchLater')", timeout=20000)
        basic = home.evaluate("""() => {
          const a = document.getElementById('watchLater');
          const r = a.getBoundingClientRect();
          return {
            mode: OTRMode.current(),
            href: a.getAttribute('href'),
            text: a.innerText,
            visible: r.width > 0 && r.height >= 40,
            scroll: document.documentElement.scrollWidth,
            inPlayer: !!a.closest('#console, #rack, #otr-basic, #sleepSel, #npDate')
          };
        }""")
        ck("basic mode shows Watch later outside the player",
           basic["mode"] == "basic" and basic["href"] == "/otr/latenight/"
           and "Watch later" in basic["text"] and "Late Night replay" in basic["text"]
           and basic["visible"] and basic["scroll"] <= 390 and not basic["inPlayer"], basic)
        home.click("#otrModeAdvanced")
        home.wait_for_function("OTRMode.current()==='advanced'", timeout=5000)
        adv = home.evaluate("""() => {
          const a = document.getElementById('watchLater');
          const opts = [...document.querySelectorAll('#sleepSel option')].map(o => o.value);
          return {
            visible: a.getBoundingClientRect().height >= 40,
            href: a.getAttribute('href'),
            opts: opts,
            date: !!document.getElementById('npDate'),
            scroll: document.documentElement.scrollWidth
          };
        }""")
        ck("advanced mode keeps the link, the sleep menu, and the date line",
           adv["visible"] and adv["href"] == "/otr/latenight/" and adv["scroll"] <= 390
           and adv["opts"] == ["off", "15", "30", "60", "end"] and adv["date"], adv)
        ck("no page errors on the radio page", not herrs, herrs[:4])
        home.screenshot(path="/tmp/otr-latenight-shots/radio-link-mobile.png")
        ctx.close()
        worker_case(browser, ck, FIXTURE, size)
        browser.close()

    srv.shutdown()
    print("FAILS", fails)
    raise SystemExit(1 if fails else 0)


if __name__ == "__main__":
    main()
