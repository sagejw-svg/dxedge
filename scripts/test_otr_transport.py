#!/usr/bin/env python3
"""15 second back/forward, playback speed and sleep timer on the OTR player.
Needs network (plays real archive.org audio). Run: python3 scripts/test_otr_transport.py"""
import http.server, socketserver, threading, os
ROOT = os.path.abspath('frontend/public')
PORT = 8798

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(s, *a): pass
    def do_POST(s):   # swallow /api/stat beacons
        s.rfile.read(int(s.headers.get('Content-Length') or 0)); s.send_response(204); s.end_headers()

socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.ThreadingTCPServer(('127.0.0.1', PORT), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()

from playwright.sync_api import sync_playwright
F = []
def ck(n, c, d=''):
    print('PASS' if c else 'FAIL', n, '' if c else d)
    if not c: F.append(n)

URL = f'http://127.0.0.1:{PORT}/otr/?season=off'
PLAYING = '!document.getElementById("audio").paused && document.getElementById("audio").currentTime>1'
T = 'document.getElementById("audio").currentTime'

with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': 1100, 'height': 900})
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_function('window.__otr&&__otr.ready()', timeout=20000); pg.wait_for_timeout(400)

    ck('seek buttons start disabled', pg.evaluate('document.getElementById("backBtn").disabled && document.getElementById("fwdBtn").disabled'))
    pg.click('#channelChips .station[data-ch="crime"]')
    pg.wait_for_function(PLAYING, timeout=45000); pg.wait_for_timeout(800)
    ck('seek buttons enabled once playing', pg.evaluate('!document.getElementById("backBtn").disabled && !document.getElementById("fwdBtn").disabled'))
    ck('tuned in live', pg.evaluate('__otr.state.live'))

    # forward 15
    t0 = pg.evaluate(T); pg.click('#fwdBtn'); pg.wait_for_timeout(600); t1 = pg.evaluate(T)
    ck('forward moves about 15 s', 13.5 <= t1 - t0 <= 17.5, (t0, t1))
    st = pg.inner_text('#onairText').lower()
    ck('seeking leaves the live clock, says time-shifted', not pg.evaluate('__otr.state.live') and 'time-shifted' in st, st)
    # back 15
    t2 = pg.evaluate(T); pg.click('#backBtn'); pg.wait_for_timeout(600); t3 = pg.evaluate(T)
    ck('back moves about 15 s', 13.5 <= t2 - t3 <= 16.5, (t2, t3))
    # rejoin live by tapping the station
    pg.click('#channelChips .station[data-ch="crime"]'); pg.wait_for_timeout(800)
    ck('tapping the station rejoins live', pg.evaluate('__otr.state.live') and 'live' in pg.inner_text('#onairText').lower())
    # skip still says skipped ahead
    pg.click('#skipBtn'); pg.wait_for_function(PLAYING, timeout=45000); pg.wait_for_timeout(500)
    ck('skip still says skipped ahead', 'skipped ahead' in pg.inner_text('#onairText').lower(), pg.inner_text('#onairText').lower())
    # back near the start clamps at 0
    pg.evaluate('document.getElementById("audio").currentTime=5'); pg.wait_for_timeout(400)
    pg.click('#backBtn'); pg.wait_for_timeout(500)
    ck('back clamps at the start', pg.evaluate(T) < 3, pg.evaluate(T))
    # arrow keys use the same path
    pg.evaluate('document.activeElement && document.activeElement.blur()')
    t4 = pg.evaluate(T); pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(500); t5 = pg.evaluate(T)
    ck('right arrow = forward 15', 13.5 <= t5 - t4 <= 17.5, (t4, t5))
    # forward at the end moves to the next item
    qi = pg.evaluate('__otr.state.qi')
    pg.evaluate('(function(a){a.currentTime=a.duration-6})(document.getElementById("audio"))'); pg.wait_for_timeout(500)
    pg.click('#fwdBtn')
    pg.wait_for_function('__otr.state.qi!==%d' % qi, timeout=15000)
    ck('forward past the end moves on', pg.evaluate('__otr.state.qi') != qi)
    pg.wait_for_function(PLAYING, timeout=45000)

    # speed
    pg.select_option('#rateSel', '1.25'); pg.wait_for_timeout(300)
    ck('speed 1.25x applied', abs(pg.evaluate('document.getElementById("audio").playbackRate') - 1.25) < 1e-6)
    ck('pitch preserved', pg.evaluate('document.getElementById("audio").preservesPitch !== false'))
    pg.click('#skipBtn'); pg.wait_for_function(PLAYING, timeout=45000); pg.wait_for_timeout(500)
    ck('speed survives the next episode', abs(pg.evaluate('document.getElementById("audio").playbackRate') - 1.25) < 1e-6)
    pg.click('#channelChips .station[data-ch="comedy"]'); pg.wait_for_function(PLAYING, timeout=45000); pg.wait_for_timeout(600)
    ck('faster than 1x on a channel is time-shifted', not pg.evaluate('__otr.state.live') and 'time-shifted' in pg.inner_text('#onairText').lower(), pg.inner_text('#onairText').lower())
    pg.reload(); pg.wait_for_function('__otr.ready()')
    ck('speed remembered after reload', pg.input_value('#rateSel') == '1.25')
    pg.select_option('#rateSel', '1')

    # sleep timer, minutes
    pg.click('#channelChips .station[data-ch="western"]'); pg.wait_for_function(PLAYING, timeout=45000)
    base = pg.evaluate('document.getElementById("audio").volume')
    pg.select_option('#sleepSel', '15'); pg.wait_for_timeout(1200)
    left = pg.inner_text('#sleepLeft')
    ck('15 min timer counts down', left.startswith('14:5') or left.startswith('15:00'), left)
    pg.evaluate('__otr.sleepIn(4000)'); pg.wait_for_timeout(1600)
    v = pg.evaluate('document.getElementById("audio").volume')
    ck('fades before stopping', v < base * 0.5, (v, base))
    pg.wait_for_function('document.getElementById("audio").paused', timeout=8000)
    ck('stops when the timer runs out', pg.evaluate('document.getElementById("audio").paused'))
    ck('volume restored and timer cleared', abs(pg.evaluate('document.getElementById("audio").volume') - base) < 0.02 and pg.input_value('#sleepSel') == 'off' and pg.inner_text('#sleepLeft') == '')
    # cancel restores
    pg.click('#playBtn'); pg.wait_for_function(PLAYING, timeout=45000)
    pg.select_option('#sleepSel', '30'); pg.evaluate('__otr.sleepIn(10000)'); pg.wait_for_timeout(1500)
    pg.select_option('#sleepSel', 'off'); pg.wait_for_timeout(300)
    ck('turning it off mid-fade restores volume', abs(pg.evaluate('document.getElementById("audio").volume') - base) < 0.02 and not pg.evaluate('document.getElementById("audio").paused'))

    # sleep at end of episode
    pg.click('#skipBtn'); pg.wait_for_function(PLAYING, timeout=45000)
    while pg.evaluate('__otr.currentInfo().isAd'):
        pg.click('#skipBtn'); pg.wait_for_function(PLAYING, timeout=45000)
    pg.select_option('#sleepSel', 'end')
    ck('end mode labelled', 'after this episode' in pg.inner_text('#sleepLeft'))
    qi = pg.evaluate('__otr.state.qi')
    pg.evaluate('(function(a){a.currentTime=a.duration-8})(document.getElementById("audio"))')
    pg.wait_for_timeout(2500)
    ck('fades in the last seconds', pg.evaluate('document.getElementById("audio").volume') < base * 0.7, pg.evaluate('document.getElementById("audio").volume'))
    pg.wait_for_function('__otr.state.cueNext===true', timeout=20000)
    ck('stops at the end instead of moving on', pg.evaluate('document.getElementById("audio").paused') and pg.evaluate('__otr.state.qi') == qi)
    ck('status shows paused, volume back', pg.inner_text('#onairText').lower() == 'paused' and abs(pg.evaluate('document.getElementById("audio").volume') - base) < 0.02)
    pg.click('#playBtn'); pg.wait_for_function(PLAYING, timeout=45000)
    ck('Play continues with the next item', pg.evaluate('__otr.state.qi') != qi)
    ck('no page errors', not errs, errs)

    # phone width: one transport row, no sideways scroll
    m = b.new_context(viewport={'width': 375, 'height': 800}).new_page()
    m.goto(URL); m.wait_for_function('__otr.ready()'); m.wait_for_timeout(400)
    tops = m.eval_on_selector_all('.transport .btn', 'els=>els.map(e=>Math.round(e.getBoundingClientRect().top))')
    ck('mobile: five transport buttons on one row', len(tops) == 5 and len(set(tops)) == 1, tops)
    ck('mobile: no horizontal scroll', m.evaluate('document.documentElement.scrollWidth') <= 375)
    SP = os.environ.get('SP', '/tmp')
    m.locator('.np').screenshot(path=f'{SP}/otr_transport_mobile.png')
    pg.locator('.np').screenshot(path=f'{SP}/otr_transport_desktop.png')
    b.close()
print('FAILS', F); import sys; sys.exit(1 if F else 0)
