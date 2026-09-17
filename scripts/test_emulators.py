#!/usr/bin/env python3
"""Headless check of the Emulators catalogue (frontend/public/emulators/).

Validates emulators.json (schema, unique ids and URLs, category keys, rating
ranges), then serves frontend/public locally and drives the page through its
window.__emu seam: it must render every entry, filter by category, flag and
search, sort by stars and ease correctly, and expose only new-tab links.

Run from the repo root:  python3 scripts/test_emulators.py
Needs: pip install playwright && python3 -m playwright install chromium
"""
import http.server
import json
import os
import socketserver
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend', 'public')
PORT = 8769
REQUIRED = {'id': str, 'name': str, 'url': str, 'cat': str, 'systems': list, 'blurb': str, 'why': str,
            'can': list, 'ease': int, 'ease_note': str, 'needs_files': bool, 'offline': bool, 'tags': list,
            'pick': bool, 'checked': str}


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    handler = lambda *a, **k: Quiet(*a, directory=ROOT, **k)  # noqa: E731
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(('127.0.0.1', PORT), handler)
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def check_data():
    with open(os.path.join(ROOT, 'emulators', 'emulators.json'), encoding='utf-8') as f:
        d = json.load(f)
    ems = d['emulators']
    cats = d['categories']
    fails = []
    ids, urls = set(), set()
    for e in ems:
        for k, t in REQUIRED.items():
            if k not in e or not isinstance(e[k], t):
                fails.append(f"{e.get('id')}: field {k} missing or wrong type")
        if e['id'] in ids: fails.append(f"duplicate id {e['id']}")
        if e['url'].lower().rstrip('/') in urls: fails.append(f"duplicate url {e['url']}")
        ids.add(e['id']); urls.add(e['url'].lower().rstrip('/'))
        if e['cat'] not in cats: fails.append(f"{e['id']}: unknown cat {e['cat']}")
        if not 1 <= e['ease'] <= 5: fails.append(f"{e['id']}: ease out of range")
        if not e['url'].startswith(('http://', 'https://')): fails.append(f"{e['id']}: bad url")
        if e.get('stars') is not None and not isinstance(e['stars'], int): fails.append(f"{e['id']}: stars not int")
        if not 3 <= len(e['can']) <= 8: fails.append(f"{e['id']}: {len(e['can'])} capability phrases")
        if e['needs_files'] and e['ease'] > 3: fails.append(f"{e['id']}: needs files but ease {e['ease']}")
        if d['count'] != len(ems): fails.append('count field does not match')
    return d, fails


def main():
    d, fails = check_data()
    n = len(d['emulators'])
    print(f"data: {n} entries, {len(d['categories'])} categories, {len(fails)} problems")
    for f in fails: print('  FAIL', f)

    srv = serve()
    results = []
    def check(name, ok, note=''):
        results.append(ok)
        print(('ok   ' if ok else 'FAIL '), name, note)

    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 1200, 'height': 900})
        errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(f'http://127.0.0.1:{PORT}/emulators/index.html')
        pg.wait_for_function('window.__emu && window.__emu.ready', timeout=15000)
        check('page loads without JS errors', not errors, '; '.join(errors)[:200])
        check('renders every entry', pg.locator('.card').count() == n, str(pg.locator('.card').count()))
        check('count label', pg.locator('#count').inner_text().startswith(str(n)))
        check('category chips', pg.locator('#cats .chip').count() == len(d['categories']) + 1)

        # Every outbound link opens in a new tab with noopener.
        bad = pg.evaluate("""() => [...document.querySelectorAll('.card a')].filter(a =>
            a.target !== '_blank' || !/noopener/.test(a.rel)).length""")
        check('all card links are new-tab noopener', bad == 0, str(bad))

        # Category filter.
        cat = next(iter(d['categories']))
        want = sum(1 for e in d['emulators'] if e['cat'] == cat)
        pg.evaluate(f"window.__emu.set({{cat: '{cat}'}})")
        check(f'filter cat={cat}', pg.locator('.card').count() == want, f"{pg.locator('.card').count()} vs {want}")

        # Flags.
        pg.evaluate("window.__emu.set({cat: 'all', flags: ['nofiles']})")
        want = sum(1 for e in d['emulators'] if not e['needs_files'])
        check('flag no files', pg.locator('.card').count() == want)
        pg.evaluate("window.__emu.set({flags: ['open']})")
        want = sum(1 for e in d['emulators'] if e['repo'])
        check('flag open source', pg.locator('.card').count() == want)
        pg.evaluate("window.__emu.set({flags: ['easy']})")
        want = sum(1 for e in d['emulators'] if e['ease'] >= 4)
        check('flag easy', pg.locator('.card').count() == want)

        # Search.
        pg.evaluate("window.__emu.set({flags: [], q: 'picocalc'})")
        ids = pg.evaluate('window.__emu.visible')
        check('search picocalc finds MMBasic Anywhere', any('mmbasic' in i for i in ids), str(ids))
        pg.evaluate("window.__emu.set({q: 'zzzz-nothing'})")
        check('empty search shows notice', pg.locator('.empty').count() == 1)

        # Sorts.
        pg.evaluate("window.__emu.set({q: '', sort: 'stars'})")
        ids = pg.evaluate('window.__emu.visible')
        by_id = {e['id']: e for e in d['emulators']}
        stars = [by_id[i]['stars'] if by_id[i]['stars'] is not None else -1 for i in ids]
        check('sort by stars descending', stars == sorted(stars, reverse=True))
        pg.evaluate("window.__emu.set({sort: 'ease'})")
        ids = pg.evaluate('window.__emu.visible')
        ease = [by_id[i]['ease'] for i in ids]
        check('sort by ease descending', ease == sorted(ease, reverse=True))
        pg.evaluate("window.__emu.set({sort: 'old'})")
        ids = pg.evaluate('window.__emu.visible')
        yrs = [by_id[i]['year'] for i in ids if by_id[i]['year']]
        check('sort oldest first', yrs == sorted(yrs))
        pg.evaluate("window.__emu.set({sort: 'pick'})")
        ids = pg.evaluate('window.__emu.visible')
        picks = [by_id[i]['pick'] for i in ids]
        check('picks first', picks == sorted(picks, reverse=True))

        # Hash round-trip.
        pg.evaluate("window.__emu.set({cat: 'calc', q: 'hp', sort: 'name'})")
        h = pg.evaluate('location.hash')
        check('state in hash', 'cat=calc' in h and 'q=hp' in h and 'sort=name' in h, h)
        pg.goto(f'http://127.0.0.1:{PORT}/emulators/index.html{h}')
        pg.wait_for_function('window.__emu && window.__emu.ready', timeout=15000)
        want = sum(1 for e in d['emulators'] if e['cat'] == 'calc' and 'hp' in
                   ' '.join([e['name'], e['blurb'], e['why'], *e['systems'], *e['tags'], *e['can']]).lower())
        check('hash restores filters', pg.locator('.card').count() == want, f"{pg.locator('.card').count()} vs {want}")

        # Phone width renders one column and no horizontal scroll.
        pg.set_viewport_size({'width': 390, 'height': 800})
        pg.goto(f'http://127.0.0.1:{PORT}/emulators/index.html')
        pg.wait_for_function('window.__emu && window.__emu.ready', timeout=15000)
        sw = pg.evaluate('document.documentElement.scrollWidth')
        check('no horizontal scroll at 390px', sw <= 390, str(sw))
        pg.screenshot(path='/tmp/emulators_phone.png', full_page=False)
        pg.set_viewport_size({'width': 1200, 'height': 900})
        pg.screenshot(path='/tmp/emulators_desktop.png', full_page=False)
        b.close()
    srv.shutdown()
    ok = all(results) and not fails
    print('PASS' if ok else 'FAIL', f"{sum(results)}/{len(results)} checks")
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
