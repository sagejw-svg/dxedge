#!/usr/bin/env python3
"""Headless check of the unlisted Hearthvault game at /crawl/.

The page is a prebuilt static bundle. It must stay out of the site nav,
keep its noindex tag, and show the title screen. The service worker and
nginx treat the directory as mutable, the same way /dm/ is served.

Run from the repo root:  python3 scripts/test_crawl.py
"""
import os
import re
import socketserver
import threading
from http.server import SimpleHTTPRequestHandler

from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PUBLIC = os.path.join(ROOT, 'frontend', 'public')
PORT = 8785


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
    page_html = open(os.path.join(PUBLIC, 'crawl', 'index.html'), encoding='utf-8').read()
    bundle = open(os.path.join(PUBLIC, 'crawl', 'assets', 'index-D7zYPsqB.js'), encoding='utf-8').read()
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
    ok('/crawl/assets/index-D7zYPsqB.js' in page_html, 'the bundle is served from /crawl/')
    ok('/crawl/assets/index-DDj2uQ5E.css' in page_html, 'the stylesheet is served from /crawl/')
    ok('data-testid="title"' in bundle and '>Hearthvault<' in bundle, 'the bundle contains the title screen')
    ok('href="/crawl/"' not in app and "id: 'crawl'" not in app, 'the game is not in the site nav')
    cache = re.search(r"CACHE_NAME = 'dxedge-v(\d+)'", sw)
    ok(cache is not None and int(cache.group(1)) >= 137, 'service worker cache bumped')
    ok("url.pathname.startsWith('/crawl/')" in sw, 'service worker treats /crawl/ as mutable')
    ok('location ^~ /crawl/' in nginx, 'nginx does not pin /crawl/ for a year')

    srv = serve()
    errors = []
    failed = []
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        except Exception:
            browser = p.chromium.launch()
        pg = browser.new_page(viewport={'width': 1280, 'height': 800})
        pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        pg.on('response', lambda r: failed.append(f'{r.status} {r.url}') if r.status >= 400 else None)
        pg.goto(f'http://127.0.0.1:{PORT}/crawl/index.html', wait_until='networkidle')
        pg.wait_for_selector('[data-testid="title"]')
        ok(pg.title() == 'Hearthvault', 'title')
        body = pg.inner_text('body')
        ok('Hearthvault' in body and 'New course' in body, body[:400])
        ok(pg.query_selector('[data-testid="new-game"]') is not None, 'the new-course button is on the title screen')
        ok(not failed, failed)
        pg.screenshot(path='/tmp/crawl-title.png', full_page=False)
        ok(not errors, errors)
        browser.close()
    srv.shutdown()
    print('crawl ok', checks, 'checks')


if __name__ == '__main__':
    main()
