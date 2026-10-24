#!/usr/bin/env python3
"""Headless check of the unlisted Dungeon Master engine at /dm/.

The page is a prebuilt static bundle. It must stay out of the site nav,
keep its noindex tag, and show the DAT file picker. The service worker
and nginx treat the directory as mutable, the same way /delve/ is served.

Run from the repo root:  python3 scripts/test_dm.py
"""
import os
import re
import socketserver
import threading
from http.server import SimpleHTTPRequestHandler

from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PUBLIC = os.path.join(ROOT, 'frontend', 'public')
PORT = 8782


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
    page_html = open(os.path.join(PUBLIC, 'dm', 'index.html'), encoding='utf-8').read()
    bundle = open(os.path.join(PUBLIC, 'dm', 'assets', 'index-CvLHDx8C.js'), encoding='utf-8').read()
    app = open(os.path.join(ROOT, 'frontend', 'src', 'App.jsx'), encoding='utf-8').read()
    sw = open(os.path.join(PUBLIC, 'sw.js'), encoding='utf-8').read()
    nginx = open(os.path.join(ROOT, 'nginx', 'nginx.conf'), encoding='utf-8').read()

    checks = 0

    def ok(cond, msg):
        nonlocal checks
        checks += 1
        if not cond:
            raise AssertionError(msg)

    ok('noindex, nofollow' in page_html, 'the page asks crawlers to skip it')
    ok('/dm/assets/index-CvLHDx8C.js' in page_html, 'the bundle is served from /dm/')
    ok('/dm/assets/index-Ds76-2F7.css' in page_html, 'the stylesheet is served from /dm/')
    ok('Drop DUNGEON.DAT and GRAPHICS.DAT here' in bundle, 'the bundle contains the file picker')
    ok('index-lcuHWnZP.js' not in page_html and 'index-DOoxH7BZ.css' not in page_html, 'the previous build is gone')
    ok('href="/dm/"' not in app and "id: 'dm'" not in app, 'the engine is not in the site nav')
    cache = re.search(r"CACHE_NAME = 'dxedge-v(\d+)'", sw)
    ok(cache is not None and int(cache.group(1)) >= 136, 'service worker cache bumped')
    ok("url.pathname.startsWith('/dm/')" in sw, 'service worker treats /dm/ as mutable')
    ok('location ^~ /dm/' in nginx, 'nginx does not pin /dm/ for a year')

    srv = serve()
    errors = []
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        except Exception:
            browser = p.chromium.launch()
        pg = browser.new_page(viewport={'width': 1280, 'height': 800})
        pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        pg.goto(f'http://127.0.0.1:{PORT}/dm/index.html', wait_until='networkidle')
        ok(pg.title() == 'Dungeon Master', 'title')
        body = pg.inner_text('body')
        ok('Drop DUNGEON.DAT and GRAPHICS.DAT here' in body, body[:400])
        ok(pg.query_selector('input[type="file"]') is not None, 'a file input is on the page')
        pg.screenshot(path='/tmp/dm-picker.png', full_page=False)
        ok(not errors, errors)
        browser.close()
    srv.shutdown()
    print('dm ok', checks, 'checks')


if __name__ == '__main__':
    main()
