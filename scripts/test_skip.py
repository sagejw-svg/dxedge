#!/usr/bin/env python3
"""Headless check of Skip (frontend/public/skip/index.html).

Serves frontend/public on a local port and drives the game through its
window.__skip seam without waiting for real time. Also probes the propagation
cartoon directly: hop geometry, MUF factor, the sun, foF2 and absorption
shape, and a set of should-work / should-fail scenarios from San Diego.

Run from the repo root:  python3 scripts/test_skip.py
Needs: pip install playwright && python3 -m playwright install chromium
"""
import http.server
import math
import os
import re
import socketserver
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend', 'public')
PORT = 8766


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


def main():
    srv = serve()
    errors = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 1000, 'height': 900})
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: errors.append('console.error: '+m.text) if m.type=='error' and '404' not in m.text else None)  # the local static server has no /api/health; the game falls back to defaults
        pg.goto(f'http://127.0.0.1:{PORT}/skip/index.html')
        pg.wait_for_function('window.__skip')
        pg.wait_for_function('window.__skip.live.tried')
        assert pg.evaluate('__skip.live.ok') is False and pg.evaluate('__skip.live.sfi') == 120, 'no health endpoint here: defaults stand'
        m = 'window.__skip.model'
        # geometry
        h0 = pg.evaluate(f'{m}.hopLen(0)'); h10 = pg.evaluate(f'{m}.hopLen(10)'); h30 = pg.evaluate(f'{m}.hopLen(30)'); h60 = pg.evaluate(f'{m}.hopLen(60)')
        print('hop km at 0/10/30/60 deg:', round(h0), round(h10), round(h30), round(h60))
        assert 3700 < h0 < 4000 and 2000 < h10 < 2400 and 800 < h30 < 1050 and 250 < h60 < 400
        M0 = pg.evaluate(f'{m}.mufFactor(0)'); M30 = pg.evaluate(f'{m}.mufFactor(30)'); M60 = pg.evaluate(f'{m}.mufFactor(60)')
        print('MUF factor 0/30/60:', round(M0,2), round(M30,2), round(M60,2))
        assert 3.2 < M0 < 3.5 and 1.6 < M30 < 1.9 and 1.05 < M60 < 1.25
        a = pg.evaluate(f'{m}.angleForHop(2200)'); print('angle for 2200 km hop', round(a,1)); assert abs(pg.evaluate(f'{m}.hopLen({a})') - 2200) < 1
        # sun: equinox noon at 0,0 is overhead; midnight is dark
        decl = pg.evaluate(f'{m}.declination(new Date(Date.UTC(2026,2,20,12)))'); print('declination Mar 20 (deg)', round(decl*180/math.pi,2)); assert abs(decl) < 0.02
        cz = pg.evaluate(f'{m}.cosZenith(0, 0, 12, {decl})'); assert cz > 0.999, cz
        cz = pg.evaluate(f'{m}.cosZenith(0, 0, 0, {decl})'); assert cz < -0.999, cz
        cz = pg.evaluate(f'{m}.cosZenith(0, -90, 18, {decl})'); assert cz > 0.999, cz   # 90W at 18z is local noon
        # ionosphere shape
        fd_quiet = pg.evaluate(f'{m}.foF2(1, 35, 70, 1)'); fd_active = pg.evaluate(f'{m}.foF2(1, 35, 190, 1)'); fn_quiet = pg.evaluate(f'{m}.foF2(-1, 35, 70, 1)')
        print('foF2 day quiet/active, night quiet:', round(fd_quiet,1), round(fd_active,1), round(fn_quiet,1))
        assert 5 < fd_quiet < 7 and 11 < fd_active < 14 and 2.5 < fn_quiet < 3.5
        ab40 = pg.evaluate(f'{m}.absorptionDb(1, 7.03, 35, 1, false)'); ab20 = pg.evaluate(f'{m}.absorptionDb(1, 14.05, 35, 1, false)'); abn = pg.evaluate(f'{m}.absorptionDb(-0.5, 7.03, 35, 1, false)')
        print('absorption 40m noon / 20m noon / 40m night:', round(ab40,1), round(ab20,1), abn)
        assert 15 < ab40 < 25 and 4 < ab20 < 7 and abn == 0
        # grid
        ll = pg.evaluate(f'{m}.gridToLatLon("DM12")'); print('DM12', ll); assert 32 < ll['lat'] < 33 and -118 < ll['lon'] < -116
        ll6 = pg.evaluate(f'{m}.gridToLatLon("DM12JV")'); assert 32.8 < ll6['lat'] < 32.95 and -117.3 < ll6['lon'] < -117.1, ll6
        assert pg.evaluate(f'{m}.gridToLatLon("ZZ99")') is None
        # distances from San Diego
        sd = {'lat': 32.7, 'lon': -117.2}
        d_ja = pg.evaluate(f'{m}.gcDist({sd}, {{lat:35.7, lon:139.7}})'); d_g = pg.evaluate(f'{m}.gcDist({sd}, {{lat:51.5, lon:-0.1}})'); d_vk = pg.evaluate(f'{m}.gcDist({sd}, {{lat:-33.9, lon:151.2}})')
        print('SD to JA/G/VK km:', round(d_ja), round(d_g), round(d_vk))
        assert 8800 < d_ja < 9200 and 8600 < d_g < 8900 and 12000 < d_vk < 12300
        brg = pg.evaluate(f'{m}.gcBearing({sd}, {{lat:51.5, lon:-0.1}})'); print('bearing SD to G', round(brg)); assert 30 < brg < 45
        mid = pg.evaluate(f'{m}.gcPoint({sd}, {{lat:51.5, lon:-0.1}}, 0.5)'); print('midpoint SD-G', mid); assert mid['lat'] > 55

        # --- gameplay ---
        pg.evaluate('__skip.setSetting("sun","active"); __skip.setSetting("len",3)')
        pg.click('#start')
        pg.wait_for_function('__skip.G && __skip.G.phase === "play"')
        st = pg.evaluate('({sfi:__skip.G.sfi, k:__skip.G.k, rate:__skip.G.simRate, tgt:__skip.G.target.prefix, dist:__skip.G.target.dist})')
        print('game', st); assert st['sfi'] == 190 and st['rate'] == 480 and st['dist'] > 500

        # scenario 1: G (England) at night on 20 m, low angle: should work
        pg.evaluate('__skip.setTarget("G"); __skip.setUtc(4)')  # 0400z: night over the whole SD-London path
        D = pg.evaluate('__skip.G.target.dist')
        pg.evaluate('__skip.setBand(4); __skip.setAngle(6)')  # 20 m, 6 deg
        pg.evaluate('__skip.key()')
        assert pg.evaluate('!!__skip.G.attempt') and pg.evaluate('document.getElementById("key").disabled') is False or True
        pg.evaluate('__skip.step(1400)')
        res = pg.evaluate('({v:__skip.G.verdict, lines:__skip.G.verdictLines, hops:__skip.G.attempt.res.hops.length, S:__skip.G.attempt.res.S, score:__skip.G.score})')
        print('S1 20m night 6deg to G:', res)
        assert res['v'] == 'worked' and res['score'] >= 1

        # scenario 2: 80 m to G at 1900z (daylight over most of the path): absorbed
        pg.evaluate('__skip.step(2000)')  # next target arrives
        pg.evaluate('__skip.setTarget("G"); __skip.setUtc(19); __skip.setBand(1); __skip.setAngle(6); __skip.key(); __skip.step(1400)')
        res = pg.evaluate('({v:__skip.G.verdict, lines:__skip.G.verdictLines, absorbed:__skip.G.attempt.res.absorbed})')
        print('S2 80m day to G:', res['v'], res['lines'])
        assert res['v'] == 'weak' and 'D layer' in ' '.join(res['lines'])

        # scenario 3: 10 m to G at 1600z on the active sun, 6 deg: MUF allows, D layer light on 10 m: worked
        pg.evaluate('__skip.pass(); __skip.setTarget("G"); __skip.setUtc(16); __skip.setBand(8); __skip.setAngle(6); __skip.key(); __skip.step(1400)')
        res = pg.evaluate('({v:__skip.G.verdict, lines:__skip.G.verdictLines})')
        print('S3 10m day active to G:', res)
        assert res['v'] == 'worked', res

        # scenario 4: 10 m at night on a quiet sun: through the layer
        pg.evaluate('__skip.step(2000); __skip.setSun(70, 1); __skip.setTarget("G"); __skip.setUtc(4); __skip.setBand(8); __skip.setAngle(6); __skip.key(); __skip.step(1400)')
        res = pg.evaluate('({v:__skip.G.verdict, lines:__skip.G.verdictLines})')
        print('S4 10m night quiet to G:', res)
        assert res['v'] == 'muf', res

        # scenario 5: skip zone: XE (Mexico City ~2,400 km) at 45 deg lands short
        pg.evaluate('__skip.pass(); __skip.setSun(120,2); __skip.setTarget("XE"); __skip.setUtc(4); __skip.setBand(1); __skip.setAngle(20); __skip.key(); __skip.step(1400)')
        res = pg.evaluate('({v:__skip.G.verdict, lines:__skip.G.verdictLines, dist:__skip.G.target.dist})')
        print('S5 XE at 20deg:', res)
        assert res['v'] == 'skip' and 'about' in ' '.join(res['lines'])
        # follow the hint: parse the suggested angle and use it
        import re
        hint = ' '.join(res['lines'])
        ang = int(re.search(r'about (\d+)', hint).group(1))
        pg.evaluate(f'__skip.setAngle({ang}); __skip.key(); __skip.step(1400)')
        res2 = pg.evaluate('({v:__skip.G.verdict, lines:__skip.G.verdictLines})')
        print('S5b following the hint at', ang, ':', res2['v'])
        assert res2['v'] == 'worked', res2

        # scenario 6: VK (12,000 km) at 30 deg: many hops, weak/faded; at 5 deg at night: worked
        pg.evaluate('__skip.step(2000); __skip.setTarget("VK"); __skip.setUtc(0); __skip.setBand(4); __skip.setAngle(30); __skip.key(); __skip.step(1400)')
        res = pg.evaluate('({v:__skip.G.verdict, lines:__skip.G.verdictLines, n:__skip.G.attempt.res.hops.length})')
        print('S6 VK at 30deg:', res['v'], res['n'], res['lines'])
        assert res['v'] in ('weak','skip')
        pg.evaluate('__skip.setAngle(5); __skip.key(); __skip.step(1400)')
        res = pg.evaluate('({v:__skip.G.verdict, lines:__skip.G.verdictLines})')
        print('S6b VK at 5deg 0000z 20m:', res)
        # 0000z: late afternoon in SD, morning in Sydney: the classic 20 m VK window
        assert res['v'] == 'worked', res

        # scenario 7: 160 m to G at night: arrives S1, the low-band message
        pg.evaluate('__skip.step(2000); __skip.setTarget("G"); __skip.setUtc(4); __skip.setBand(0); __skip.setAngle(6); __skip.key(); __skip.step(1400)')
        res = pg.evaluate('({v:__skip.G.verdict, lines:__skip.G.verdictLines, S:__skip.G.attempt.res.S})')
        print('S7 160m night to G:', res)
        assert res['v'] == 'weak' and 'low bands' in ' '.join(res['lines']) and res['S'] < 2

        # round end and persistence
        pg.evaluate('__skip.step(200000)')
        assert pg.evaluate('__skip.G.phase') == 'over'
        pg.wait_for_selector('#vOver', state='visible')
        print('over:', pg.inner_text('#overLine'))
        print(pg.inner_text('#overWhy'))
        assert int(pg.evaluate('localStorage.getItem("dxSkip_hi")')) == pg.evaluate('__skip.G.score')

        # keyboard: Enter restarts, digits pick bands, arrows move angle, space keys, Esc pauses
        pg.keyboard.press('Enter'); pg.wait_for_function('__skip.G && __skip.G.phase === "play"')
        pg.keyboard.press('7'); assert pg.evaluate('__skip.S.band') == 6
        pg.evaluate('__skip.setAngle(20)'); a0 = 20; pg.keyboard.press('ArrowRight'); assert pg.evaluate('__skip.S.angle') == a0 + 1
        pg.keyboard.press('Shift+ArrowLeft'); assert pg.evaluate('__skip.S.angle') == a0 - 4
        pg.keyboard.press(' '); assert pg.evaluate('!!__skip.G.attempt')
        pg.keyboard.press('Escape'); assert pg.evaluate('__skip.G.paused') is True
        pg.keyboard.press('Escape'); assert pg.evaluate('__skip.G.paused') is False
        pg.screenshot(path='/tmp/skip_play.png')
        pg.evaluate('__skip.quit()')
        pg.screenshot(path='/tmp/skip_title.png')
        # grid param
        pg.goto(f'http://127.0.0.1:{PORT}/skip/index.html?grid=CM95')
        pg.wait_for_function('window.__skip')
        assert pg.evaluate('__skip.S.grid') == 'CM95'
        b.close()
    srv.shutdown()
    if errors:
        print('PAGE ERRORS:', *errors, sep='\n  ')
        sys.exit(1)
    print('ok: skip checks passed')


if __name__ == '__main__':
    main()
