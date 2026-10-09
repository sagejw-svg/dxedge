#!/usr/bin/env python3
"""Seasonal stations (Halloween in October) and the usage beacon on the OTR player.
Needs network for the tune-in check (plays real archive.org audio). Run: python3 scripts/test_otr_seasonal.py"""
import http.server, socketserver, threading, os, datetime
ROOT = os.path.abspath('frontend/public')
PORT = 8797
HALLOWEEN = ['quiet-please', 'lights-out', 'inner-sanctum-mysteries', 'suspense', 'the-mysterious-traveler']

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(s, *a): pass
    def send_head(s):
        path = s.path.split('?')[0]
        if path == '/otr': s.path = '/otr/index.html' + (s.path[4:] if '?' in s.path else '')
        elif not os.path.exists(ROOT + path): s.path = '/index.html'   # SPA fallback like prod
        return super().send_head()
    def do_POST(s):   # swallow /api/stat beacons, record that one arrived
        n = int(s.headers.get('Content-Length') or 0); body = s.rfile.read(n)
        BEACONS.append((s.path, body[:200])); s.send_response(204); s.end_headers()

BEACONS = []
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.ThreadingTCPServer(('127.0.0.1', PORT), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()

from playwright.sync_api import sync_playwright
F = []
def ck(n, c, d=''):
    print('PASS' if c else 'FAIL', n, '' if c else d)
    if not c: F.append(n)

URL = f'http://127.0.0.1:{PORT}/otr/'
CARDS = 'els=>els.map(e=>[e.dataset.ch,!!e.querySelector(".st-season"),(e.querySelector(".st-season")||{}).textContent||"",e.querySelector(".st-count").textContent,e.querySelector(".st-now").textContent,e.title])'

def open_at(b, when=None, query='', storage=None):
    ctx = b.new_context(viewport={'width': 1100, 'height': 900})
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    if when: pg.clock.set_fixed_time(when)
    if storage:
        pg.add_init_script('(function(){var d=%s;for(var k in d)localStorage.setItem(k,d[k]);})()' % storage)
    pg.goto(URL + query); pg.wait_for_function('window.__otr&&__otr.ready()', timeout=20000)
    pg.wait_for_timeout(600)
    return pg, errs

with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])

    # October: Halloween is first on the dial, tagged, with James's five shows
    oct15 = datetime.datetime(2026, 10, 15, 20, 0)
    pg, errs = open_at(b, when=oct15)
    cards = pg.eval_on_selector_all('#channelChips .station', CARDS)
    ck('october: halloween card is first', cards and cards[0][0] == 'halloween', [c[0] for c in cards])
    ck('october: 10 stations (9 regular + halloween)', len(cards) == 10, len(cards))
    h = cards[0] if cards else None
    ck('october: tagged October', h and h[1] and h[2] == 'October', h)
    ck('october: 5 shows in rotation', h and h[3] == '5 shows', h)
    ck('october: tooltip says seasonal', h and 'through October 31' in h[5], h)
    ck('october: now playing filled', h and len(h[4]) > 3, h)
    shows = pg.evaluate("__otr.channels().indexOf('halloween')>=0")
    ck('october: channel exposed to test hook', shows)
    sched = pg.evaluate("__otr.schedule('halloween').filter(function(x){return !x.isAd}).map(function(x){return x.showId})")
    ck('october: schedule only uses the five shows', sched and set(sched) == set(HALLOWEEN), sorted(set(sched or [])))
    ck('october: schedule covers every episode of the five', len(sched) == pg.evaluate("__otr.catalog().shows.filter(function(s){return %s.indexOf(s.id)>=0}).reduce(function(n,s){return n+s.eps.length},0)" % HALLOWEEN))
    ck('october: no page errors', not errs, errs)

    # Same clock time, second visitor: identical broadcast
    pg2, _ = open_at(b, when=oct15)
    c2 = pg2.eval_on_selector_all('#channelChips .station', CARDS)
    ck('october: same on-air show for every visitor', c2 and cards and c2[0][4] == cards[0][4], (c2[0][4] if c2 else None, h[4] if h else None))

    # November: gone, and a remembered halloween channel does not break the page
    nov2 = datetime.datetime(2026, 11, 2, 20, 0)
    pg3, errs3 = open_at(b, when=nov2, storage='{"otr_last":"ch:halloween"}')
    c3 = pg3.eval_on_selector_all('#channelChips .station', CARDS)
    ck('november: no seasonal station', len(c3) == 9 and not any(c[1] for c in c3), [c[0] for c in c3])
    ck('november: stale otr_last ignored cleanly', not errs3 and pg3.evaluate('!__otr.state.channel'), (errs3, pg3.evaluate('__otr.state.channel')))
    ck('november: regular order unchanged', c3 and c3[0][0] == 'future', [c[0] for c in c3])

    # Test overrides
    pg4, _ = open_at(b, when=nov2, query='?season=halloween')
    ck('?season=halloween forces it on in November', pg4.eval_on_selector_all('#channelChips .station', 'els=>els[0].dataset.ch') == 'halloween')
    pg5, _ = open_at(b, when=oct15, query='?season=off')
    ck('?season=off hides it in October', pg5.eval_on_selector_all('#channelChips .station', 'els=>els.length') == 9)

    # Restored on reload during October
    pg6, errs6 = open_at(b, when=oct15, storage='{"otr_last":"ch:halloween"}')
    ck('october: last channel halloween is cued on load', pg6.evaluate('__otr.state.channel') == 'halloween' and
       pg6.evaluate('document.querySelector(".station[data-ch=halloween]").classList.contains("on")'))

    # Tune in for real (real time, forced on), audio from archive.org
    pg7, errs7 = open_at(b, query='?season=halloween')
    pg7.click('#channelChips .station[data-ch="halloween"]')
    try:
        pg7.wait_for_function('!document.getElementById("audio").paused && document.getElementById("audio").currentTime>0', timeout=45000)
        ok = True
    except Exception as e:
        ok = False
    info = pg7.evaluate('({i:__otr.currentInfo(), live:__otr.state.live, ch:__otr.state.channel})')
    print('   ', info)
    ck('tune in plays live from the halloween clock', ok and info['live'] and info['ch'] == 'halloween', info)
    ck('playing show is one of the five (or a commercial)', info['i'] and (info['i'].get('isAd') or info['i'].get('show') in
       ['Quiet, Please', 'Lights Out', 'Inner Sanctum Mysteries', 'Suspense', 'The Mysterious Traveler']), info['i'])
    ck('lock screen album names the station', 'Halloween' in (pg7.evaluate('navigator.mediaSession && navigator.mediaSession.metadata ? navigator.mediaSession.metadata.album : "Halloween"') or ''))
    ck('tune-in: no page errors', not errs7, errs7)

    # Support links: Internet Archive donate and the Ko-fi tip jar, side by side in the header and again in the support card
    sup = pg7.evaluate('(function(){ function order(id){ var f=document.getElementById(id), a=f.querySelectorAll("a"), ia=-1, kf=-1; a.forEach(function(x,i){ if(/archive.org\\/donate/.test(x.href)) ia=i; if(/ko-fi.com\\/oldtimeradio/.test(x.href)) kf=i; }); var r=f.getBoundingClientRect(); return {ia:ia, kf:kf, vis: r.height>0}; } return {top: order("supportTop"), card: order("support"), txt: document.getElementById("support").innerText}; })()')
    ck('header: Internet Archive donate and Ko-fi tip both shown', sup['top']['ia'] >= 0 and sup['top']['kf'] > sup['top']['ia'] and sup['top']['vis'], sup)
    ck('support card: both links, Ko-fi after the Archive', sup['card']['ia'] >= 0 and sup['card']['kf'] > sup['card']['ia'] and sup['card']['vis'], sup)
    ck("support card: tips say not tax deductible", "aren't tax deductible" in sup['txt'], sup['txt'][-200:])
    # Usage beacon is loaded and reports
    ck('stat.js loaded on /otr/', pg7.evaluate('!!document.querySelector(\'script[src="/lib/stat.js"]\')'))
    pg7.wait_for_timeout(5000)
    pg7.evaluate('document.dispatchEvent(new Event("visibilitychange"))')
    pg7.wait_for_timeout(1000)
    ck('beacon posted to /api/stat', any(path.startswith('/api/stat') for path, _ in BEACONS), BEACONS[:3])

    # Phone width
    m = b.new_context(viewport={'width': 375, 'height': 800}).new_page()
    m.clock.set_fixed_time(oct15); m.goto(URL); m.wait_for_function('__otr.ready()'); m.wait_for_timeout(500)
    ck('mobile: no horizontal scroll with the tag', m.evaluate('document.documentElement.scrollWidth') <= 375)
    SP = os.environ.get('SP', '/tmp')
    m.locator('#channelChips').screenshot(path=f'{SP}/otr_halloween_mobile.png')
    pg.locator('#channelChips').screenshot(path=f'{SP}/otr_halloween_desktop.png')
    b.close()
print('FAILS', F); import sys; sys.exit(1 if F else 0)
