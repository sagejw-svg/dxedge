#!/usr/bin/env python3
"""Headless check of the unlisted Hearthvault game at /crawl/.

The page is a prebuilt static bundle, an EUPL-1.2 fork of DelveWard. It must
stay out of the site nav, keep its noindex tag, serve LICENSE and NOTICE, and
show the boot screen. The service worker and nginx treat the directory as
mutable, the same way /dm/ is served. Commercial game data files are not
part of this tree.

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
CRAWL = os.path.join(PUBLIC, 'crawl')
PORT = 8785
BUNDLE = 'main-UWuSTqQ6.js'
SKYBOX = 'skybox-D9FOk2IG.js'
BANNED_EXT = ('.dat', '.cps', '.vcn', '.vmp', '.maz', '.exe', '.pak', '.wad')
BANNED_NAMES = {'dungeon.dat', 'graphics.dat', 'item.dat', 'itemtype.dat'}


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
    page_html = open(os.path.join(CRAWL, 'index.html'), encoding='utf-8').read()
    bundle = open(os.path.join(CRAWL, 'assets', BUNDLE), encoding='utf-8').read()
    license_txt = open(os.path.join(CRAWL, 'LICENSE'), encoding='utf-8').read()
    notice = open(os.path.join(CRAWL, 'NOTICE'), encoding='utf-8').read()
    app = open(os.path.join(ROOT, 'frontend', 'src', 'App.jsx'), encoding='utf-8').read()
    sw = open(os.path.join(PUBLIC, 'sw.js'), encoding='utf-8').read()
    nginx = open(os.path.join(ROOT, 'nginx', 'nginx.conf'), encoding='utf-8').read()

    checks = 0

    def ok(cond, msg):
        nonlocal checks
        checks += 1
        if not cond:
            raise AssertionError(msg)

    banned = []
    for dirpath, _, files in os.walk(CRAWL):
        for name in files:
            low = name.lower()
            if low in BANNED_NAMES or low.endswith(BANNED_EXT):
                banned.append(os.path.join(dirpath, name))
    ok(not banned, 'commercial game files: ' + ', '.join(banned))
    ok('noindex, nofollow' in page_html, 'the page asks crawlers to skip it')
    ok(f'/crawl/assets/{BUNDLE}' in page_html, 'the bundle is served from /crawl/')
    ok(f'/crawl/assets/{SKYBOX}' in page_html, 'the skybox chunk is served from /crawl/')
    ok('HEARTHVAULT' in bundle and 'A fork of DelveWard' in bundle and 'EUPL-1.2' in bundle,
       'the bundle contains the Hearthvault boot screen')
    ok('EUROPEAN UNION PUBLIC LICENCE v. 1.2' in license_txt, 'LICENSE is EUPL-1.2')
    ok('fork of DelveWard' in notice and 'EUPL-1.2' in notice, 'NOTICE records the fork')
    ok('href="/crawl/"' not in app and "id: 'crawl'" not in app, 'the game is not in the site nav')
    cache = re.search(r"CACHE_NAME = 'dxedge-v(\d+)'", sw)
    ok(cache is not None and int(cache.group(1)) >= 152, 'service worker cache bumped')
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
        def note(r):
            if r.status < 400:
                return
            # /api/levels/latest is optional. This host has no editor API, and
            # the game falls back to /crawl/levels/ruins.json. A missing
            # favicon is the browser, not the bundle.
            if '/api/' in r.url or r.url.endswith('/favicon.ico'):
                return
            failed.append(f'{r.status} {r.url}')
        pg.on('response', note)
        pg.goto(f'http://127.0.0.1:{PORT}/crawl/index.html', wait_until='domcontentloaded')
        pg.wait_for_selector('text=Enable sound')
        # The loading line flips to "Loaded" once the level is up, and it stays
        # until the player leaves the attribute screen. "Loading" itself is gone
        # by the time the sprites finish.
        pg.wait_for_selector('text=Loaded', timeout=30000)
        ok(pg.title() == 'Hearthvault', 'title')
        ok(pg.query_selector('canvas') is not None, 'the game canvas is on the page')
        body = pg.inner_text('body')
        ok(not body.startswith('Error:'), body[:400])
        ok(not failed, failed)
        pg.screenshot(path='/tmp/crawl-title.png', full_page=False)
        ok(not errors, errors)
        browser.close()
    srv.shutdown()
    print('crawl ok', checks, 'checks')


if __name__ == '__main__':
    main()
