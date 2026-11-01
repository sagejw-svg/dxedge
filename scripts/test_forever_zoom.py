#!/usr/bin/env python3
"""Headless check of Forever Zoom at /forever-zoom/.

The page is unlisted. It must keep its noindex tag, talk to /api/forever-zoom,
and draw a procedural scene when no fal key is configured. The service worker
and nginx treat the directory as mutable, the same way /delve/ is served.

Run from the repo root:  python3 scripts/test_forever_zoom.py
"""
import os
import re
import socketserver
import threading
from http.server import SimpleHTTPRequestHandler

from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PUBLIC = os.path.join(ROOT, 'frontend', 'public')
PORT = 8791


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    handler = lambda *a, **k: Quiet(*a, directory=PUBLIC, **k)  # noqa: E731
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(('127.0.0.1', PORT), handler)
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def main():
    page_html = open(os.path.join(PUBLIC, 'forever-zoom', 'index.html'), encoding='utf-8').read()
    app_js = open(os.path.join(PUBLIC, 'forever-zoom', 'app.js'), encoding='utf-8').read()
    procedural = open(os.path.join(PUBLIC, 'forever-zoom', 'procedural.js'), encoding='utf-8').read()
    nav = open(os.path.join(ROOT, 'frontend', 'src', 'App.jsx'), encoding='utf-8').read()
    sw = open(os.path.join(PUBLIC, 'sw.js'), encoding='utf-8').read()
    nginx = open(os.path.join(ROOT, 'nginx', 'nginx.conf'), encoding='utf-8').read()

    checks = 0

    def ok(cond, msg):
        nonlocal checks
        checks += 1
        if not cond:
            raise AssertionError(msg)

    ok('noindex, nofollow' in page_html, 'the page asks crawlers to skip it')
    ok('/forever-zoom/app.js' in page_html, 'the script is served from /forever-zoom/')
    ok('/forever-zoom/procedural.js' in page_html, 'the procedural engine is served from /forever-zoom/')
    ok('/forever-zoom/style.css' in page_html, 'the stylesheet is served from /forever-zoom/')
    ok("'/api/forever-zoom'" in app_js, 'API calls use the forever-zoom proxy')
    ok('generateProcedural' in app_js, 'the page can draw without fal')
    ok('ProceduralZoom' in procedural and 'function render' in procedural, 'procedural renderer is present')
    ok('forever-zoom' not in nav, 'the page is not in the site nav')
    cache = re.search(r"CACHE_NAME = 'dxedge-v(\d+)'", sw)
    ok(cache is not None and int(cache.group(1)) >= 170, 'service worker cache bumped')
    ok("url.pathname.startsWith('/forever-zoom/')" in sw, 'service worker treats /forever-zoom/ as mutable')
    ok('location ^~ /forever-zoom/' in nginx, 'nginx does not pin /forever-zoom/ for a year')
    ok('location /api/forever-zoom/' in nginx, 'nginx gives the proxy its own timeout')

    srv = serve()
    errors = []
    failed = []
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(
                executable_path='/usr/bin/google-chrome',
                args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
            )
        except Exception:
            browser = p.chromium.launch()
        pg = browser.new_page(viewport={'width': 1280, 'height': 800})
        pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        pg.on('response', lambda r: failed.append(f'{r.status} {r.url}') if r.status >= 400 and '/api/' not in r.url else None)
        pg.goto(f'http://127.0.0.1:{PORT}/forever-zoom/', wait_until='domcontentloaded')
        pg.wait_for_function(
            "() => document.getElementById('log') && document.getElementById('log').textContent.indexOf('Ready') >= 0",
            timeout=60000,
        )
        ok(pg.title() == 'Forever Zoom', 'title')
        ok('procedural only' in pg.inner_text('#statusBadge') or 'offline' in pg.inner_text('#statusBadge'), pg.inner_text('#statusBadge'))
        pixels = pg.evaluate('''() => {
          const c = document.getElementById('view');
          const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          let n = 0;
          for (let i = 0; i < d.length; i += 16) {
            if (d[i] + d[i + 1] + d[i + 2] > 30) n++;
          }
          return n;
        }''')
        ok(pixels > 1000, 'procedural preview painted the canvas: ' + str(pixels))
        pg.select_option('#modeSelect', 'procedural')
        pg.click('#btnStart')
        pg.wait_for_function(
            "() => document.getElementById('log').textContent.indexOf('via procedural') >= 0",
            timeout=60000,
        )
        ok('procedural' in pg.inner_text('#hudDepth'), pg.inner_text('#hudDepth'))
        journey = pg.evaluate('''() => {
          const c = document.getElementById('view');
          const meta = ProceduralZoom.render(c, 4, 42, {x: 0.5, y: 0.5});
          const d = c.getContext('2d').getImageData(0, 0, 32, 32).data;
          let n = 0;
          for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 0) n++;
          return {theme: meta.theme.id, n: n};
        }''')
        ok(journey['theme'] == 'cosmos' and journey['n'] > 100, journey)
        ok(not failed, failed)
        pg.screenshot(path='/tmp/forever-zoom-procedural.png', full_page=False)
        ok(not errors, errors)
        browser.close()
    srv.shutdown()
    print('forever-zoom ok', checks, 'checks')


if __name__ == '__main__':
    main()
