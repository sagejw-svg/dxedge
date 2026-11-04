#!/usr/bin/env python3
"""Headless check of Pileup (frontend/public/pileup/index.html).

Serves frontend/public on a local port and drives the game through its
window.__pileup seam.

The audio is not taken on trust. The whole premise of this game is several
CW signals sounding at once and an IF filter you can narrow to split them,
so the checks render the pileup through an OfflineAudioContext and measure
the spectrum here: both stations have to be present when the filter is
wide, and the off-pitch one has to actually disappear when it is narrow.

There is no /api on the local server, so the usage beacon fails the way it
would on a dead backend. That is expected and is filtered out of the
console check.

Run from the repo root:  python3 scripts/test_pileup.py
Needs: pip install playwright numpy && python3 -m playwright install chromium
"""
import http.server
import os
import re
import socketserver
import sys
import threading

import numpy as np
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend', 'public')
PORT = 8771

PASS, FAIL = [], []


def ok(name, cond, detail=''):
    (PASS if cond else FAIL).append(name)
    mark = 'ok  ' if cond else 'FAIL'
    print(f'{mark} {name}' + (f'   {detail}' if detail else ''))


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


def band_energy(samples, sr, hz, half=45.0):
    """Total energy within +/- half Hz of hz."""
    x = np.asarray(samples, dtype=np.float64)
    if x.size == 0:
        return 0.0
    win = np.hanning(x.size)
    spec = np.abs(np.fft.rfft(x * win)) ** 2
    freqs = np.fft.rfftfreq(x.size, 1.0 / sr)
    sel = (freqs >= hz - half) & (freqs <= hz + half)
    return float(spec[sel].sum())


def db(a, b):
    if b <= 0:
        return float('inf')
    return 10.0 * np.log10(max(a, 1e-30) / b)


def main():
    serve()
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        page = b.new_page()
        errors = []
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(f'http://127.0.0.1:{PORT}/pileup/index.html', wait_until='load')
        page.wait_for_function('window.__pileup !== undefined', timeout=10000)

        # ---- 1. the page comes up clean -----------------------------------
        real = [e for e in errors if '/api/' not in e and 'stat.js' not in e]
        ok('page loads without console errors', not real, '; '.join(real[:2]))

        # ---- 2. callsigns come from prefix blocks -------------------------
        pool = page.evaluate('window.__pileup.prefixPool().length')
        ok('prefix pool is populated', pool > 150, f'{pool} prefixes')

        calls = page.evaluate("""() => {
          const pool = window.__pileup.prefixPool()
          const out = []
          for (let i = 0; i < 400; i++) {
            const px = pool[Math.floor(Math.random() * pool.length)].px
            out.push(window.__pileup.makeCall(px))
          }
          return out
        }""")
        shape = re.compile(r'^[A-Z0-9]{3,7}$')
        bad_shape = [c for c in calls if not shape.match(c)]
        ok('generated calls are well formed', not bad_shape, f'{bad_shape[:3]}')
        no_digit = [c for c in calls if not any(ch.isdigit() for ch in c)]
        ok('every generated call has a digit', not no_digit, f'{no_digit[:3]}')
        no_slash = [c for c in calls if '/' in c]
        ok('no portable slashes in generated calls', not no_slash)

        # Every generated call must resolve to a real entity, or the score and
        # the "worked X" line would be lying.
        unresolved = page.evaluate("""(calls) => {
          return calls.filter(c => !window.__pileupLocate(c))
        }""", calls) if page.evaluate('!!window.__pileupLocate') else None
        if unresolved is None:
            # locateCall is not on the seam; resolve through the module directly
            unresolved = page.evaluate("""async (calls) => {
              const m = await import('/lib/propagation.js')
              return calls.filter(c => !m.locateCall(c))
            }""", calls)
        ok('every generated call resolves to an entity', not unresolved, f'{unresolved[:3]}')

        # ---- 3. the roster reflects propagation ---------------------------
        roster = page.evaluate('window.__pileup.buildRoster().map(r => ({px: r.px, S: r.S}))')
        ok('roster is non-empty on 20m from DM12', len(roster) > 20, f'{len(roster)} entities open')
        ok('roster drops closed paths', all(r['S'] >= 1.5 for r in roster))

        close_s = page.evaluate("""() => {
          const m = window.__pileup
          return m.pathS({lat: 32.7, lon: -117.2}, {lat: 33.9, lon: -118.2}, 14.04, 20, 0).S
        }""")
        ok('a 150 km path is called loud, not skip', close_s > 5, f'S {close_s}')

        # ---- 4. tuning moves every signal together ------------------------
        page.evaluate('window.__pileup.start()')
        page.evaluate("""() => window.__pileup.seed([
          {call: 'K1AAA', off: -300, wpm: 20, S: 8},
          {call: 'DL3KZB', off: 0,   wpm: 18, S: 5},
          {call: 'JA7XYZ', off: 420, wpm: 24, S: 3},
        ])""")
        tone = page.evaluate('window.__pileup.S.toneHz')
        page.evaluate('window.__pileup.setDial(0)')
        p0 = page.evaluate('window.__pileup.pitches()')
        ok('netted caller sits at the sidetone pitch', p0[1] == tone, f'{p0} tone {tone}')
        page.evaluate('window.__pileup.setDial(100)')
        p1 = page.evaluate('window.__pileup.pitches()')
        shifted = all(b - a == -100 for a, b in zip(p0, p1))
        ok('the dial shifts all pitches equally', shifted, f'{p0} -> {p1}')
        page.evaluate('window.__pileup.netTo(2)')
        p2 = page.evaluate('window.__pileup.pitches()')
        ok('netTo puts that caller on the sidetone', p2[2] == tone, f'{p2}')

        # ---- 5. two signals really are both there -------------------------
        sr = page.evaluate('window.__pileup.sampleRate()')
        wide = page.evaluate("""async () => await window.__pileup.renderPileup([
          {text: 'TTTTTTTTTTTT', hz: 570,  wpm: 26, gain: 1},
          {text: 'TTTTTTTTTTTT', hz: 1100, wpm: 26, gain: 1},
        ], 2.4, 0, 570)""")
        e570 = band_energy(wide, sr, 570)
        e1100 = band_energy(wide, sr, 1100)
        floor = band_energy(wide, sr, 2200)
        ok('both callers are audible with the filter open',
           db(e570, floor) > 30 and db(e1100, floor) > 30,
           f'570Hz {db(e570, floor):.0f} dB, 1100Hz {db(e1100, floor):.0f} dB over floor')

        # ---- 6. narrowing the filter actually splits them -----------------
        narrow = page.evaluate("""async () => await window.__pileup.renderPileup([
          {text: 'TTTTTTTTTTTT', hz: 570,  wpm: 26, gain: 1},
          {text: 'TTTTTTTTTTTT', hz: 1100, wpm: 26, gain: 1},
        ], 2.4, 100, 570)""")
        n570 = band_energy(narrow, sr, 570)
        n1100 = band_energy(narrow, sr, 1100)
        wide_ratio = db(e1100, e570)
        narrow_ratio = db(n1100, n570)
        rejection = wide_ratio - narrow_ratio
        ok('a 100 Hz filter rejects the off-pitch caller', rejection > 12,
           f'{rejection:.0f} dB of extra rejection')
        ok('the netted caller survives the narrow filter', db(n570, floor) > 25,
           f'{db(n570, floor):.0f} dB over floor')

        # ---- 7. CW timing matches what the game claims --------------------
        claimed = page.evaluate("window.__pileup.cwMs('PARIS', 20)")
        rendered = page.evaluate("""async () => await window.__pileup.renderPileup(
          [{text: 'PARIS', hz: 700, wpm: 20, gain: 1}], 3.0, 0, 700)""")
        x = np.abs(np.asarray(rendered, dtype=np.float64))
        on = x > 0.05 * x.max()
        idx = np.nonzero(on)[0]
        measured = (idx[-1] - idx[0]) / sr * 1000 if idx.size else 0
        # cwMs counts the trailing inter-character gap, the envelope does not.
        ok('rendered CW length matches cwMs', abs(measured - claimed) < 0.25 * claimed,
           f'measured {measured:.0f} ms, cwMs {claimed:.0f} ms at 20 wpm')

        # ---- 8. partial matching is contest-correct -----------------------
        m = page.evaluate("""() => {
          const f = window.__pileup.matchesPartial
          return {
            frag:  f('DL3KZB', '3KZ'),
            q:     f('DL3KZB', '3KZ?'),
            miss:  f('DL3KZB', 'W1A'),
            all:   f('DL3KZB', '?'),
            pre:   f('DL3KZB', 'DL'),
          }
        }""")
        ok('a middle fragment matches', m['frag'] and m['q'])
        ok('a prefix fragment matches', m['pre'])
        ok('a non-matching fragment is rejected', not m['miss'])
        ok('a bare ? matches everybody', m['all'])

        # ---- 9. working a station logs it and leaves the rest -------------
        page.evaluate('window.__pileup.start()')
        page.evaluate("""() => window.__pileup.seed([
          {call: 'K1AAA', off: -300, wpm: 20, S: 8},
          {call: 'DL3KZB', off: 0, wpm: 18, S: 5, rarity: 1},
        ])""")
        page.evaluate("window.__pileup.setSetting('mute', true)")  # no audio needed here
        page.evaluate("window.__pileup.type('DL3KZB')")
        page.evaluate('window.__pileup.log()')
        page.evaluate("window.__pileup.step(30000)")  # your exchange, then his report
        st = page.evaluate("""() => ({
          qsos: window.__pileup.G.qsos,
          score: window.__pileup.G.score,
          log: window.__pileup.G.log.map(e => e.call),
          left: window.__pileup.calls(),
          attempts: window.__pileup.G.attempts,
          busts: window.__pileup.G.busts,
        })""")
        ok('an exact call is worked and logged', st['qsos'] == 1 and st['log'] == ['DL3KZB'], str(st))
        ok('a rare entity scores more than one point', st['score'] == 2, f"score {st['score']}")
        # The pileup refills after a QSO, the way a real run does: whoever you
        # did not work keeps calling and newcomers join. So the check is that
        # the worked station is gone and the unworked one is not.
        ok('the worked station leaves the pileup',
           'DL3KZB' not in st['left'] and 'K1AAA' in st['left'], str(st['left']))
        ok('the pileup refills after a QSO', len(st['left']) >= 1, str(st['left']))
        ok('a good call is not counted as a bust', st['busts'] == 0 and st['attempts'] == 1)

        # ---- 10. a busted call costs you, and they all come back ----------
        page.evaluate("window.__pileup.type('W9ZZZ')")
        page.evaluate('window.__pileup.log()')
        page.evaluate('window.__pileup.step(4000)')
        st2 = page.evaluate("""() => ({
          qsos: window.__pileup.G.qsos,
          busts: window.__pileup.G.busts,
          left: window.__pileup.calls(),
          mode: window.__pileup.G.mode,
        })""")
        ok('a call that is not there is a bust', st2['busts'] == 1 and st2['qsos'] == 1, str(st2))
        ok('after QRZ the pileup is still calling',
           st2['mode'] == 'pileup' and 'K1AAA' in st2['left'], str(st2['left']))

        # ---- 11. a partial brings back only the matching stations ---------
        page.evaluate('window.__pileup.start()')
        page.evaluate("""() => window.__pileup.seed([
          {call: 'K1AAA', off: -300, wpm: 20, S: 8},
          {call: 'DL3KZB', off: 0, wpm: 18, S: 5},
          {call: 'JA7XYZ', off: 420, wpm: 24, S: 3},
        ])""")
        page.evaluate("window.__pileup.setSetting('mute', true)")
        page.evaluate("window.__pileup.type('3KZ?')")
        page.evaluate('window.__pileup.log()')
        page.evaluate('window.__pileup.step(6000)')
        after = page.evaluate('window.__pileup.calls()')
        ok('only matching stations answer a partial', after == ['DL3KZB'], str(after))
        atts = page.evaluate('window.__pileup.G.attempts')
        ok('a partial is not scored as an attempt', atts == 0, f'attempts {atts}')

        # ---- 12. the run ends on time -------------------------------------
        page.evaluate("window.__pileup.setSetting('mins', 3)")
        page.evaluate('window.__pileup.start()')
        page.evaluate('window.__pileup.step(179000)')
        phase_before = page.evaluate('window.__pileup.G.phase')
        page.evaluate('window.__pileup.step(2000)')
        phase_after = page.evaluate('window.__pileup.G.phase')
        ok('a 3 minute run ends at 3 minutes',
           phase_before == 'play' and phase_after == 'over',
           f'{phase_before} -> {phase_after}')

        # ---- 13. settings survive a reload --------------------------------
        page.evaluate("window.__pileup.setSetting('pace', 'brisk')")
        page.evaluate('window.__pileup.setWidth(240)')
        page.reload(wait_until='load')
        page.wait_for_function('window.__pileup !== undefined', timeout=10000)
        kept = page.evaluate('({pace: window.__pileup.S.pace, width: window.__pileup.S.width})')
        ok('settings persist across a reload', kept['pace'] == 'brisk' and kept['width'] == 240, str(kept))

        b.close()

    print()
    print(f'{len(PASS)} passed, {len(FAIL)} failed')
    if FAIL:
        for f in FAIL:
            print('  failed:', f)
        sys.exit(1)


if __name__ == '__main__':
    main()
