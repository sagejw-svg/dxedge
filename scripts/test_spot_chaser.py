#!/usr/bin/env python3
"""Headless check of Spot Chaser (frontend/public/spot-chaser/index.html).

Serves frontend/public on a local port and drives the game through its
window.__sc seam. The audio is not taken on trust: each mode is rendered
through an OfflineAudioContext and measured here, including a real BPSK31
demodulator that has to recover the callsign from the samples the game
would have played.

There is no /api on the local server, so the page's own spot fetch fails
the way it would on a dead backend, and the checks feed it known spots
instead.

Run from the repo root:  python3 scripts/test_spot_chaser.py
Needs: pip install playwright numpy && python3 -m playwright install chromium
"""
import http.server
import json
import os
import socketserver
import sys
import threading

import numpy as np
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend', 'public')
PORT = 8767


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


SPOTS = [
  {'call':'WB0YDF','khz':14060.0,'rawMode':'CW','source':'POTA','park':'US-9387','place':'Luce Line State Trail','dxcc':''},
  {'call':'DF9ZV/P','khz':7031.0,'rawMode':'CW','source':'POTA','park':'DE-0699','place':'Freudenthalweg','dxcc':''},
  {'call':'JA1ABC','khz':14025.0,'rawMode':'CW','source':'cluster','spotter':'K7XX','dxcc':'Japan'},
  {'call':'W9CPL','khz':14336.0,'rawMode':'SSB','source':'cluster','spotter':'K7GPS','dxcc':'United States'},
  {'call':'SV9/S53R','khz':10108.0,'rawMode':'SSB','source':'cluster','spotter':'SE6CW','dxcc':'Greece'},
  {'call':'VK3ABC','khz':14200.0,'rawMode':'SSB','source':'cluster','spotter':'VK2XX','dxcc':'Australia'},
  {'call':'V51MA','khz':18100.0,'rawMode':'FT8','source':'cluster','spotter':'EA2DYB','dxcc':''},
]

VARICODE = {' ':'1','/':'110101111','0':'10110111','1':'10111101','2':'11101101','3':'11111111','4':'101110111','5':'101011011','6':'101101011','7':'110101101','8':'110101011','9':'110110111','A':'1111101','B':'11101011','C':'10101101','D':'10110101','E':'1110111','F':'11011011','G':'11111101','H':'101010101','I':'1111111','J':'111111101','K':'101111101','L':'11010111','M':'10111011','N':'11011101','O':'10101011','P':'11010101','Q':'111011101','R':'10101111','S':'1101111','T':'1101101','U':'101010111','V':'110110101','W':'101011101','X':'101110101','Y':'101111011','Z':'1010101101'}
REV = {v:k for k,v in VARICODE.items()}

def psk_decode(samples, sr, carrier):
    """Demodulate BPSK31: mix to baseband, integrate over each symbol, read the
    phase reversals, split on 00, look the codes up in the varicode table."""
    x = np.asarray(samples, dtype=float)
    t = np.arange(len(x)) / sr
    z = x * np.exp(-2j * np.pi * carrier * t)
    spb = sr / 31.25
    n = int(len(x) / spb)
    syms = np.array([z[int(k*spb):int((k+1)*spb)].sum() for k in range(n)])
    keep = np.abs(syms) > np.abs(syms).max() * 0.25
    bits = ''
    prev = None
    for k in range(n):
        if not keep[k]:
            prev = None
            continue
        ph = np.angle(syms[k])
        if prev is not None:
            d = abs(((ph - prev + np.pi) % (2*np.pi)) - np.pi)
            bits += '0' if d > np.pi/2 else '1'
        prev = ph
    out = ''
    for chunk in bits.split('00'):
        if chunk in REV: out += REV[chunk]
    return out, bits

def main():
    srv = serve()
    checks = 0
    errors = []

    def ok(cond, msg):
        nonlocal checks
        checks += 1
        if not cond:
            raise AssertionError(msg)

    with sync_playwright() as p:
        b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = b.new_page(viewport={'width':1000,'height':950})
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: errors.append('console.error: '+m.text) if m.type=='error' and '404' not in m.text and 'Failed to load resource' not in m.text else None)
        pg.goto(f'http://127.0.0.1:{PORT}/spot-chaser/index.html')
        pg.wait_for_function('window.__sc')

        # --- varicode ---
        ok(pg.evaluate('__sc.varicodeBits("E")').count('1110111') == 1, 'E encodes to its varicode')
        bits = pg.evaluate('__sc.varicodeBits("K6WRJ")')
        for code in ['101111101','101101011','101011101','10101111','111111101']:
            ok(code in bits, f'{code} present in the K6WRJ bitstream')
        ok(bits.startswith('0'*20) and bits.endswith('1'*12), 'preamble of reversals and postamble of steady carrier')

        # --- mode/band mapping ---
        ok(pg.evaluate('__sc.normMode("USB")') == 'ssb' and pg.evaluate('__sc.normMode("FT8")') == 'data'
           and pg.evaluate('__sc.normMode("BPSK31")') == 'psk31', 'spot modes map to game modes')
        ok(pg.evaluate('__sc.bandFor({khz:14060})') == '20m' and pg.evaluate('__sc.bandFor({khz:7031})') == '40m', 'frequency to band')

        pg.wait_for_function('__sc.feed.at > 0')   # let the page's own (failing) fetch settle first
        ok(pg.evaluate('__sc.feed.ok') is False, 'no /api here, so the page says the feeds are not answering')
        pg.evaluate('__sc.seedSpots(%s)' % json.dumps(SPOTS))
        ok(len(pg.evaluate('__sc.playable("cw")')) == 3, 'three CW spots playable')
        ok(len(pg.evaluate('__sc.playable("ssb")')) == 3, 'three phone spots playable')
        ok(len(pg.evaluate('__sc.playable("mixed")')) == 6, 'mixed takes CW and phone, not the FT8 spot')
        ok(len(pg.evaluate('__sc.playable("psk31")')) == 7, 'PSK31 practice can use any real call')

        sr = pg.evaluate('__sc.sampleRate()')
        print('sample rate', sr, 'clips loaded', pg.evaluate('__sc.clips'))

        # --- the PSK31 is real: decode the rendered audio ---
        samples = pg.evaluate('__sc.renderTx("psk31", "CQ DE K6WRJ K", 1000, 12)')
        got, raw = psk_decode(samples, sr, 1000)
        print('PSK31 decoded:', repr(got))
        ok('K6WRJ' in got, f'a BPSK31 demodulator recovers the call from the rendered audio, got {got!r}')
        ok(got.startswith('CQ DE'), f'and the rest of the transmission, got {got!r}')

        # off-frequency by 200 Hz, decoding at the marker, should fail: that is the game
        got2, _ = psk_decode(pg.evaluate('__sc.renderTx("psk31", "CQ DE K6WRJ K", 1200, 12)'), sr, 1000)
        ok('K6WRJ' not in got2, 'a station 200 Hz off the decoder marker does not print')

        # --- CW pitch follows the dial, timing follows the wpm ---
        for hz in (400, 570, 800):
            s = np.asarray(pg.evaluate(f'__sc.renderTx("cw", "E", {hz}, 1.0)'), dtype=float)
            sp = np.abs(np.fft.rfft(s * np.hanning(len(s))))
            peak = np.fft.rfftfreq(len(s), 1/sr)[sp.argmax()]
            ok(abs(peak - hz) < 12, f'CW tone sits at the dial pitch: asked {hz}, got {peak:.0f}')
        s = np.asarray(pg.evaluate('__sc.renderTx("cw", "T", 570, 1.2)'), dtype=float)
        # peak envelope over 1 ms windows: |sine| dips through zero every cycle,
        # so a bare threshold on the samples measures the waveform, not the key
        win = int(sr / 1000)
        env = np.array([np.abs(s[i:i+win]).max() for i in range(0, len(s) - win, win)])
        on = (env > 0.5).sum() * win / sr
        wpm = pg.evaluate('__sc.S.wpm')
        want = 3 * 1.2 / wpm
        ok(abs(on - want) < 0.02, f'a dah is three dits at {wpm} wpm: {on*1000:.0f} ms against {want*1000:.0f}')

        # --- SSB mistuning shifts, it does not scale ---
        def spectrum(sig):
            x = np.asarray(sig, dtype=float)
            sp = np.abs(np.fft.rfft(x * np.hanning(len(x)), n=1 << 17))
            f = np.fft.rfftfreq(1 << 17, 1 / sr)
            return f, sp

        def shift_between(a, b):
            """How far the whole spectrum moved, by cross-correlating the two
            magnitude spectra. A frequency shift slides the spectrum bodily,
            which is the thing to measure; an energy-weighted centroid is
            pulled around by content folding through zero."""
            f, sa = spectrum(a)
            _, sb = spectrum(b)
            m = (f > 60) & (f < 5000)
            sa, sb = sa[m], sb[m]
            sa = (sa - sa.mean()) / (sa.std() + 1e-12)
            sb = (sb - sb.mean()) / (sb.std() + 1e-12)
            binhz = f[1] - f[0]
            lags = np.arange(-int(800 / binhz), int(800 / binhz))
            best, bestv = 0, -1e18
            for L in lags:
                v = float(np.dot(sa, np.roll(sb, -L)))
                if v > bestv: bestv, best = v, L
            return best * binhz

        n = pg.evaluate('__sc.loadClips()')
        print('phonetic clips loaded:', n)
        ok(n == 37, f'all 37 phonetic clips load and decode, got {n}')
        base = pg.evaluate('__sc.renderTx("ssb", "K", 0, 1.2)')
        up = pg.evaluate('__sc.renderTx("ssb", "K", 300, 1.2)')
        dn = pg.evaluate('__sc.renderTx("ssb", "K", -200, 1.2)')
        su, sd = shift_between(base, up), shift_between(base, dn)
        print(f'SSB spectrum moved: +300 asked -> {su:+.0f} Hz, -200 asked -> {sd:+.0f} Hz')
        ok(abs(su - 300) < 40, f'a +300 Hz mistune moves the whole voice up 300, got {su:+.0f}')
        ok(abs(sd + 200) < 40, f'a -200 Hz mistune moves it down 200, got {sd:+.0f}')
        # and it is a shift, not a speed change: the clip is the same length either way
        ok(abs(len(base) - len(up)) == 0, 'mistuning does not change the length of the audio')

        # --- a round, played through ---
        pg.evaluate('__sc.setSetting("mode","cw"); __sc.setSetting("len",3); __sc.setSetting("qrn","quiet")')
        pg.evaluate('__sc.start()')
        pg.wait_for_function('__sc.G && __sc.G.st')
        st = pg.evaluate('({call:__sc.G.st.spot.call, mode:__sc.G.st.mode, dial:__sc.G.st.dial, spot:__sc.G.st.spot.khz, target:__sc.G.st.target, path:!!__sc.G.st.path})')
        print('station', st)
        ok(st['mode'] == 'cw' and st['path'], 'a CW station with a path worked out')
        ok(abs(st['dial'] - st['spot']) < 1e-9, 'you start on the spotted frequency')
        ok(abs(pg.evaluate('__sc.tuningErr()')) > 8, 'and it is not netted for you')

        pg.evaluate('__sc.net()')
        ok(abs(pg.evaluate('__sc.tuningErr()')) < 1, 'netting puts the note on the sidetone')
        ok(pg.evaluate('__sc.G.st.netted') is True, 'and the station reads as netted')
        before = pg.evaluate('__sc.G.score')
        pg.evaluate(f'__sc.type(__sc.G.st.spot.call); __sc.log()')
        res = pg.evaluate('({done:__sc.G.st.done, correct:__sc.G.st.result.correct, pts:__sc.G.st.result.pts, score:__sc.G.score, worked:__sc.G.worked.length})')
        print('after logging', res)
        ok(res['correct'] and res['score'] > before and res['worked'] == 1, 'a correct call scores and counts as worked')

        pg.evaluate('__sc.step(4000)')
        ok(pg.evaluate('__sc.G.n') == 2, 'the next station calls')
        pg.evaluate('__sc.type("W1XYZ"); __sc.log()')
        ok(pg.evaluate('__sc.G.st.result.wrong') == 'W1XYZ' and not pg.evaluate('__sc.G.st.done'), 'a first wrong guess gets a second try')
        pg.evaluate('__sc.type("W1XYZ"); __sc.log()')
        ok(pg.evaluate('__sc.G.st.done') and not pg.evaluate('__sc.G.st.result.correct'), 'the second wrong guess ends it')

        pg.evaluate('__sc.step(4000)')
        pg.evaluate('__sc.pass(); __sc.step(4000)')
        pg.wait_for_selector('#vOver', state='visible')
        print('over:', pg.inner_text('#overLine'))
        ok(pg.evaluate('int' if False else 'Number(localStorage.getItem("dxSpotChaser_hi"))') == pg.evaluate('__sc.G.score'), 'the score persists')
        ok(len(pg.evaluate('Object.keys(JSON.parse(localStorage.getItem("dxSpotChaser_worked")))')) >= 1, 'worked entities persist')

        # --- SSB and PSK31 rounds start and are tunable ---
        for mode in ('ssb','psk31'):
            pg.evaluate('__sc.quit()')
            pg.evaluate(f'__sc.setSetting("mode","{mode}"); __sc.setSetting("len",2)')
            pg.evaluate('__sc.start()')
            pg.wait_for_function('__sc.G && __sc.G.st')
            ok(pg.evaluate('__sc.G.st.mode') == mode, f'{mode} round starts')
            pg.evaluate('__sc.net()')
            ok(abs(pg.evaluate('__sc.tuningErr()')) < 1, f'{mode} nets')
            tol = pg.evaluate('__sc.G.st.tol')
            print(f'  {mode}: tolerance {tol} Hz, target {pg.evaluate("__sc.G.st.target")} Hz')

        pg.evaluate('__sc.quit()')
        pg.screenshot(path='/tmp/sc_title.png')
        b.close()

    srv.shutdown()
    if errors:
        print('PAGE ERRORS:', *errors, sep='\n  ')
        sys.exit(1)
    print(f'ok: {checks} checks passed')


if __name__ == '__main__':
    main()
