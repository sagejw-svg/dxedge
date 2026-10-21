"""Comics that are already on the page open in a lightbox. Link-only strips do not."""
import json
import os
import struct
import subprocess
import threading
import zlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

import pytest

ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "frontend" / "public" / "news" / "index.html"
CHROME = next(
    p for p in (
        os.environ.get("DXEDGE_CHROME", ""),
        "/opt/google/chrome/chrome",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
    ) if p and os.path.exists(p)
)

DAY = "2026-10-17"
MODE = {"solo": False}

XKCD = {
    "id": "xkcd-99",
    "kind": "xkcd",
    "title": "Standards",
    "img": "https://imgs.xkcd.com/comics/standards.png",
    "alt": "fortunately, xkcd's hover text",
    "page": "https://xkcd.com/99/",
    "credit": "xkcd by Randall Munroe",
    "license": "CC BY-NC 2.5",
    "license_url": "https://creativecommons.org/licenses/by-nc/2.5/",
    "source": "https://xkcd.com/",
}
PEPPER = {
    "id": "pepper-1",
    "kind": "peppercarrot",
    "title": "Pepper and Carrot",
    "img": "https://www.peppercarrot.com/ep/cover.png",
    "pages": [
        "https://www.peppercarrot.com/ep/cover.png",
        "https://www.peppercarrot.com/ep/page.png",
    ],
    "page": "https://www.peppercarrot.com/",
    "credit": "David Revoy",
    "license": "CC BY 4.0",
    "license_url": "https://creativecommons.org/licenses/by/4.0/",
    "source": "https://www.peppercarrot.com/",
}
NEMO = {
    "id": "nemo",
    "kind": "commons",
    "title": "Little Nemo",
    "img": "https://upload.wikimedia.org/wikipedia/commons/nemo.png",
    "alt": "",
    "page": "https://commons.wikimedia.org/wiki/File:Nemo",
    "credit": "Winsor McCay",
    "license": "Public domain",
    "license_url": "https://creativecommons.org/publicdomain/mark/1.0/",
    "source": "https://commons.wikimedia.org/wiki/File:Nemo",
}
BLOCKED = {
    "id": "blocked-strip",
    "kind": "xkcd",
    "title": "Not printable",
    "img": "https://featureassets.gocomics.com/strip.png",
    "alt": "should not render",
    "page": "https://www.gocomics.com/peanuts",
    "credit": "nobody",
    "license": "",
    "source": "https://www.gocomics.com/peanuts",
}
CALVIN = {
    "id": "calvin",
    "name": "Calvin and Hobbes",
    "url": "https://www.gocomics.com/calvinandhobbes/2026/10/17",
    "home": "https://www.gocomics.com/calvinandhobbes",
    "host_label": "GoComics",
    "frame": True,
    "frame_url": "https://www.gocomics.com/calvinandhobbes/2026/10/17",
    "favorite": True,
}
PEANUTS = {
    "id": "peanuts",
    "name": "Peanuts",
    "url": "https://www.gocomics.com/peanuts/2026/10/17",
    "home": "https://www.gocomics.com/peanuts",
    "host_label": "GoComics",
    "frame": False,
    "frame_url": None,
}
HAGAR = {
    "id": "hagar",
    "name": "Hagar the Horrible",
    "url": "https://comicskingdom.com/hagar-the-horrible/2026-10-17",
    "home": "https://comicskingdom.com/hagar-the-horrible",
    "host_label": "Comics Kingdom",
    "frame": False,
    "frame_url": None,
}


def _png(width, height, rgb):
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    raw = b"".join(b"\x00" + bytes(rgb) * width for _ in range(height))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


IMAGES = {
    "https://imgs.xkcd.com/comics/standards.png": _png(2400, 400, (30, 30, 30)),
    "https://www.peppercarrot.com/ep/cover.png": _png(800, 1200, (180, 40, 40)),
    "https://www.peppercarrot.com/ep/page.png": _png(900, 1400, (40, 80, 160)),
    "https://upload.wikimedia.org/wikipedia/commons/nemo.png": _png(1000, 800, (20, 90, 40)),
}


def _shelf():
    if MODE["solo"]:
        return [PEANUTS]
    return [CALVIN, PEANUTS, HAGAR]


def _inline():
    if MODE["solo"]:
        return [XKCD]
    return [XKCD, PEPPER, NEMO, BLOCKED]


def _status():
    return {
        "paper": "The Edge",
        "dormant": False,
        "last_click": None,
        "today": DAY,
        "provider": {"name": "test", "ready": True, "needed_secret": None},
        "sections": [{
            "id": "comics",
            "title": "Comics",
            "kicker": "The shelf",
            "brief": "Today's strips.",
            "lead": False,
            "coming_soon": False,
            "shelf": True,
        }],
        "examples": [],
        "personas": [],
        "days": [{"day": DAY, "ready": ["comics"], "lead": ""}],
        "ai_progress": [],
        "generation_seconds": None,
    }


def _day():
    return {
        "day": DAY,
        "dormant": False,
        "sections": {
            "comics": {
                "day": DAY,
                "stub": False,
                "highlights": [],
                "shelf": _shelf(),
                "inline": _inline(),
            }
        },
    }


def _layout():
    return {
        "day": DAY,
        "show": ["comics"],
        "more": [],
        "coming_soon": [],
        "order": {},
        "shelf": [],
        "hidden": [],
        "mine": {},
        "interests": {},
    }


class _Desk(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def _send(self, code, body, content_type):
        data = body if isinstance(body, bytes) else body.encode()
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _json(self, payload):
        self._send(200, json.dumps(payload), "application/json")

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/news/status":
            return self._json(_status())
        if path == "/api/news/day":
            return self._json(_day())
        if path in ("/news", "/news/", "/news/index.html"):
            return self._send(200, PAGE.read_bytes(), "text/html; charset=utf-8")
        self._send(404, "no", "text/plain")

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/news/layout":
            return self._json(_layout())
        self._send(404, "no", "text/plain")


def _serve():
    server = ThreadingHTTPServer(("127.0.0.1", 0), _Desk)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


def _route(route):
    url = route.request.url
    if url.startswith("http://127.0.0.1:"):
        return route.continue_()
    if url in IMAGES:
        return route.fulfill(status=200, content_type="image/png", body=IMAGES[url])
    if url.startswith("https://"):
        return route.fulfill(status=200, content_type="text/html", body="<p>official</p>")
    return route.abort()


def _launch(pw, **context):
    browser = pw.chromium.launch(
        executable_path=CHROME,
        args=["--no-sandbox", "--disable-dev-shm-usage"],
    )
    ctx = browser.new_context(**context)
    ctx.route("**/*", _route)
    page = ctx.new_page()
    page.on("pageerror", lambda err: page.errors.append(str(err)))
    page.errors = []
    return browser, page


def test_lightbox_contract_and_fit_math():
    html = PAGE.read_text(encoding="utf-8")
    sw = (ROOT / "frontend/public/sw.js").read_text(encoding="utf-8")
    nginx = (ROOT / "nginx/nginx.conf").read_text(encoding="utf-8")
    main = (ROOT / "backend/main.py").read_text(encoding="utf-8")
    assert 'role="dialog"' in html
    assert 'aria-modal="true"' in html
    assert 'aria-labelledby="comic-title"' in html
    assert 'id="comic-x"' in html and 'aria-label="Close"' in html
    assert 'id="comic-backdrop"' in html
    assert 'id="comic-prev"' in html and 'id="comic-next"' in html
    assert "Escape" in html
    assert "touch-action: pan-x pan-y" in html
    assert "function fitComicBox" in html
    assert "function openComic" in html
    block = html.split("function fitComicBox", 1)[1].split("function renderComics", 1)[0]
    assert "fetch(" not in block
    assert "getJSON" not in block
    assert "postJSON" not in block
    assert "/api/" not in block
    link = html.split("function linkCard", 1)[1].split("function fitComicBox", 1)[0]
    assert "openComic" not in link
    assert 'target = "_blank"' in link
    assert "class NewsGate" in main
    assert "location ^~ /news/" in nginx
    assert "url.pathname.startsWith('/news/')" in sw
    assert "CACHE_NAME = 'dxedge-v117'" in sw
    script = r"""
const fs = require("fs");
const html = fs.readFileSync(process.argv[1], "utf8");
const fn = html.slice(html.indexOf("function fitComicBox"), html.indexOf("const comicView"));
eval(fn);
function near(a, b) { if (Math.abs(a - b) > 1.01) { console.error(a, b); process.exit(1); } }
const wide = fitComicBox(2400, 400, 390, 500, true, 1);
near(wide.height, 500);
near(wide.width, 3000);
if (!wide.wide) process.exit(2);
const desk = fitComicBox(2400, 400, 1000, 700, false, 1);
near(desk.width, 1000);
near(desk.height, 1000 * 400 / 2400);
if (desk.wide) process.exit(3);
const zoomed = fitComicBox(100, 100, 200, 200, false, 9);
if (zoomed.zoom !== 4 || zoomed.width !== 800) process.exit(4);
const empty = fitComicBox(0, 10, 10, 10, true, 1);
if (empty.width !== 0 || empty.height !== 0) process.exit(5);
const square = fitComicBox(400, 400, 300, 600, true, 1);
near(square.width, 300);
near(square.height, 300);
if (square.wide) process.exit(6);
"""
    subprocess.run(["node", "-e", script, str(PAGE)], check=True)


def _open_standards(page):
    page.goto(page.base, wait_until="networkidle")
    assert page.errors == []
    page.get_by_role("button", name="Expand Standards").wait_for()
    page.get_by_role("button", name="Expand Standards").click()
    page.wait_for_function(
        "() => !document.getElementById('comic-box').hidden && document.querySelector('#comic-stage img')?.naturalWidth === 2400"
    )


def _metrics(page):
    return page.evaluate(
        """() => {
          const stage = document.getElementById('comic-stage');
          const img = stage.querySelector('img');
          const ir = img.getBoundingClientRect();
          const sr = stage.getBoundingClientRect();
          return {
            iw: ir.width, ih: ir.height, sw: sr.width, sh: sr.height,
            scrollX: stage.scrollWidth > stage.clientWidth + 1,
            nw: img.naturalWidth, nh: img.naturalHeight, zoom: comicView.zoom
          };
        }"""
    )


def test_in_page_comics_open_in_a_lightbox():
    pytest.importorskip("playwright.sync_api")
    from playwright.sync_api import sync_playwright

    MODE["solo"] = False
    server = _serve()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    try:
        with sync_playwright() as pw:
            browser, page = _launch(pw, viewport={"width": 1280, "height": 800})
            page.base = base + "/news/"
            api = []
            page.on("request", lambda req: api.append(req.url) if "/api/" in req.url else None)
            try:
                _open_standards(page)
                quiet = len(api)
                assert page.locator("#comic-title").inner_text() == "Standards"
                assert page.locator("#comic-alt").inner_text() == "fortunately, xkcd's hover text"
                credit = page.locator("#comic-credit").inner_text()
                assert "xkcd by Randall Munroe" in credit
                assert "CC BY-NC 2.5" in credit
                assert page.locator("#comic-credit a", has_text="Source").get_attribute("href") == "https://xkcd.com/99/"
                assert page.locator("#comic-prev").is_visible()
                assert page.locator("#comic-next").is_visible()
                assert page.evaluate("() => document.activeElement.id") == "comic-x"
                assert page.evaluate("() => document.querySelector('.sheet').inert === true")
                box = _metrics(page)
                assert abs((box["iw"] / box["ih"]) - (box["nw"] / box["nh"])) < 0.02
                assert box["iw"] <= box["sw"] + 1
                assert box["ih"] <= box["sh"] + 1
                assert abs(box["iw"] - box["sw"]) <= 2 or abs(box["ih"] - box["sh"]) <= 2
                grown = page.evaluate(
                    """() => {
                      const before = document.querySelector('#comic-stage img').getBoundingClientRect().width;
                      onComicTouchStart({ touches: [{clientX: 10, clientY: 40}, {clientX: 110, clientY: 40}] });
                      onComicTouchMove({ touches: [{clientX: 10, clientY: 40}, {clientX: 210, clientY: 40}] });
                      const after = document.querySelector('#comic-stage img').getBoundingClientRect().width;
                      return { before, after, zoom: comicView.zoom };
                    }"""
                )
                assert grown["zoom"] == pytest.approx(2)
                assert grown["after"] == pytest.approx(grown["before"] * 2, rel=0.05)
                wheeled = page.evaluate(
                    """() => {
                      const before = comicView.zoom;
                      document.getElementById('comic-stage').dispatchEvent(
                        new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true })
                      );
                      return { before, after: comicView.zoom };
                    }"""
                )
                assert wheeled["after"] > wheeled["before"]
                page.locator("#comic-next").click()
                page.wait_for_function("() => document.getElementById('comic-title').textContent === 'Pepper and Carrot'")
                assert page.locator("#comic-alt").is_hidden()
                assert "David Revoy" in page.locator("#comic-credit").inner_text()
                assert page.locator("#comic-stage img").count() == 2
                page.keyboard.press("ArrowRight")
                page.wait_for_function("() => document.getElementById('comic-title').textContent === 'Little Nemo'")
                page.keyboard.press("ArrowLeft")
                page.wait_for_function("() => document.getElementById('comic-title').textContent === 'Pepper and Carrot'")
                page.locator("#comic-prev").click()
                page.wait_for_function("() => document.getElementById('comic-title').textContent === 'Standards'")
                dialog = page.locator(".comic-dialog")
                for _ in range(6):
                    page.keyboard.press("Tab")
                    assert page.evaluate("() => document.querySelector('.comic-dialog').contains(document.activeElement)")
                page.keyboard.press("Shift+Tab")
                assert dialog.evaluate("node => node.contains(document.activeElement)")
                page.locator("#comic-x").click()
                assert page.locator("#comic-box").is_hidden()
                assert page.evaluate("() => document.activeElement.getAttribute('aria-label')") == "Expand Standards"
                assert page.evaluate("() => document.querySelector('.sheet').inert === false")
                page.get_by_role("button", name="Expand Standards").click()
                page.wait_for_function("() => !document.getElementById('comic-box').hidden")
                page.keyboard.press("Escape")
                assert page.locator("#comic-box").is_hidden()
                page.get_by_role("button", name="Expand Calvin and Hobbes").click()
                page.wait_for_function(
                    "() => document.querySelector('#comic-stage iframe')?.src.includes('calvinandhobbes')"
                )
                assert page.locator("#comic-title").inner_text() == "Calvin and Hobbes"
                assert "GoComics" in page.locator("#comic-credit").inner_text()
                assert "calvinandhobbes" in page.locator("#comic-credit a", has_text="Source").get_attribute("href")
                page.locator("#comic-backdrop").click(position={"x": 4, "y": 4})
                assert page.locator("#comic-box").is_hidden()
                page.get_by_role("button", name="Expand Pepper and Carrot, page 2").click()
                page.wait_for_function(
                    "() => comicView.page === 1 && document.querySelectorAll('#comic-stage img').length === 2"
                )
                page.keyboard.press("Escape")
                assert page.get_by_role("button", name="Expand Peanuts").count() == 0
                assert page.get_by_role("button", name="Expand Hagar the Horrible").count() == 0
                assert page.get_by_role("button", name="Expand Not printable").count() == 0
                assert page.locator("a.card .comic-open").count() == 0
                peanuts = page.locator("a.card", has_text="Peanuts")
                assert peanuts.get_attribute("target") == "_blank"
                assert "gocomics.com/peanuts" in peanuts.get_attribute("href")
                hagar = page.locator("a.card", has_text="Hagar")
                assert "comicskingdom.com/hagar-the-horrible" in hagar.get_attribute("href")
                with page.expect_popup() as popped:
                    peanuts.click()
                official = popped.value
                assert "gocomics.com/peanuts" in official.url
                assert page.locator("#comic-box").is_hidden()
                official.close()
                keys = page.evaluate(
                    """() => {
                      const sec = state.editions[editionKey()].comics;
                      state.layout.hidden = ['xkcd-99'];
                      return buildComicSlides(sec).map(s => s.key);
                    }"""
                )
                assert "xkcd-99" not in keys
                assert "blocked-strip" not in keys
                assert "peanuts" not in keys and "hagar" not in keys
                assert "calvin" in keys and "pepper-1" in keys
                assert len(api) == quiet
                assert page.errors == []
            finally:
                browser.close()

            MODE["solo"] = True
            browser, page = _launch(pw, viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
            page.base = base + "/news/"
            try:
                _open_standards(page)
                assert page.locator("#comic-prev").is_hidden()
                assert page.locator("#comic-next").is_hidden()
                page.keyboard.press("ArrowRight")
                assert page.locator("#comic-title").inner_text() == "Standards"
                mobile = _metrics(page)
                assert mobile["nw"] == 2400 and mobile["nh"] == 400
                assert abs((mobile["iw"] / mobile["ih"]) - 6) < 0.02
                assert mobile["ih"] == pytest.approx(mobile["sh"], abs=2)
                assert mobile["iw"] > mobile["sw"] + 20
                assert mobile["scrollX"] is True
                assert page.locator("a.card", has_text="Peanuts").get_attribute("target") == "_blank"
                page.keyboard.press("Escape")
                assert page.locator("#comic-box").is_hidden()
                assert page.errors == []
            finally:
                browser.close()
    finally:
        MODE["solo"] = False
        server.shutdown()
