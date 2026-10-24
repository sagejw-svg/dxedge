#!/usr/bin/env python3
"""Headless check of the unlisted Eye of the Beholder II engine at /eob2/.

The page is a prebuilt static bundle. It must stay out of the site nav,
keep its noindex tag, and show the DARKMOON folder picker. The service
worker and nginx treat the directory as mutable, the same way /eob/ is
served. The /eob/ prefix does not cover /eob2/.

Run from the repo root:  python3 scripts/test_eob2.py
"""
import os
import re
import socketserver
import threading
from http.server import SimpleHTTPRequestHandler

from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PUBLIC = os.path.join(ROOT, 'frontend', 'public')
PORT = 8784


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
    page_html = open(os.path.join(PUBLIC, 'eob2', 'index.html'), encoding='utf-8').read()
    bundle = open(os.path.join(PUBLIC, 'eob2', 'assets', 'index-DXq18miT.js'), encoding='utf-8').read()
    app = open(os.path.join(ROOT, 'frontend', 'src', 'App.jsx'), encoding='utf-8').read()
    sw = open(os.path.join(PUBLIC, 'sw.js'), encoding='utf-8').read()
    nginx = open(os.path.join(ROOT, 'nginx', 'nginx.conf'), encoding='utf-8').read()

    checks = 0

    def ok(cond, msg):
        nonlocal checks
        checks += 1
        if not cond:
            raise AssertionError(msg)

    ok('noindex' in page_html, 'the page asks crawlers to skip it')
    ok('/eob2/assets/index-DXq18miT.js' in page_html, 'the bundle is served from /eob2/')
    ok('/eob2/assets/index-DWKjiVi8.css' in page_html, 'the stylesheet is served from /eob2/')
    ok('Drop the DARKMOON folder here' in bundle, 'the bundle contains the folder picker')
    ok('webkitdirectory' in bundle, 'the picker accepts a folder')
    ok('href="/eob2/"' not in app and "id: 'eob2'" not in app, 'the engine is not in the site nav')
    cache = re.search(r"CACHE_NAME = 'dxedge-v(\d+)'", sw)
    ok(cache is not None and int(cache.group(1)) >= 131, 'service worker cache bumped')
    ok("url.pathname.startsWith('/eob2/')" in sw, 'service worker treats /eob2/ as mutable')
    ok('location ^~ /eob2/' in nginx, 'nginx does not pin /eob2/ for a year')

    srv = serve()
    errors = []
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        except Exception:
            browser = p.chromium.launch()
        pg = browser.new_page(viewport={'width': 1280, 'height': 800})
        pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        pg.goto(f'http://127.0.0.1:{PORT}/eob2/index.html', wait_until='networkidle')
        ok(pg.title() == 'Darkmoon — Eye of the Beholder II', 'title')
        body = pg.inner_text('body')
        ok('Drop the DARKMOON folder here' in body, body[:400])
        ok(pg.query_selector('input[type="file"][webkitdirectory]') is not None, 'a folder input is on the page')
        ok(pg.inner_text('button.primary') == 'Choose folder', 'the folder button is labeled')
        pg.screenshot(path='/tmp/eob2-picker.png', full_page=False)
        ok(not errors, errors)
        browser.close()
    srv.shutdown()
    print('eob2 ok', checks, 'checks')


if __name__ == '__main__':
    main()
