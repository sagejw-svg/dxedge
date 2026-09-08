#!/usr/bin/env python3
"""Headless check of Morse Invaders (frontend/public/morse-invaders/index.html).

Serves frontend/public on a local port so the page can import the shared CW
engine from /morse/core.js exactly as it does on dxedge.net, then drives the
game through its window.__mi test seam without waiting for real time.

Run from the repo root:  python3 scripts/test_morse_invaders.py
Needs: pip install playwright && python3 -m playwright install chromium
"""
import http.server
import os
import socketserver
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend', 'public')
PORT = 8765


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):  # keep the check's output to the checks
        pass


def serve():
    handler = lambda *a, **k: Quiet(*a, directory=ROOT, **k)  # noqa: E731
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(('127.0.0.1', PORT), handler)
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def play_wave(pg, limit=600):
    """Copy every glyph as it spawns until the wave ends."""
    steps = 0
    while pg.evaluate('__mi.G.phase') == 'play' and steps < limit:
        pg.evaluate('__mi.copyAll(); __mi.step(200)')
        steps += 1
    return steps


def main():
    srv = serve()
    errors = []
    checks = 0

    def ok(cond, msg):
        nonlocal checks
        checks += 1
        if not cond:
            raise AssertionError(msg)

    with sync_playwright() as p:
        b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = b.new_page(viewport={'width': 1000, 'height': 900})
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: errors.append('console.error: ' + m.text) if m.type == 'error' else None)
        pg.goto(f'http://127.0.0.1:{PORT}/morse-invaders/index.html')
        pg.wait_for_function('window.__mi && document.getElementById("start")')

        ok(pg.evaluate('__mi.pool()') == ['K', 'M'], 'fresh profile starts at Koch 2 (K M)')
        ok(abs(pg.evaluate('__mi.tokensMs(["K"])') - 900) < 1, 'K at 12 wpm is 900 ms')
        ok(abs(pg.evaluate('__mi.tokensMs(["K","M"])') - 1900) < 1, 'KM at 12 wpm with no extra spacing is 1900 ms')
        pg.evaluate('__mi.setWpm(15)')
        ok(pg.evaluate('localStorage.getItem("dxMorseInvaders_wpm")') == '15', 'wpm persists under the planned key')
        ok(pg.evaluate('__mi.toneHz') == 570 and pg.inner_text('#toneV') == '570 Hz', 'tone defaults to 570 Hz')
        pg.evaluate('(() => { const e = document.getElementById("tone"); e.value = 700; e.dispatchEvent(new Event("input")) })()')
        ok(pg.evaluate('__mi.toneHz') == 700 and pg.evaluate('JSON.parse(localStorage.getItem("dxMorseInvaders_settings")).toneHz') == 700, 'tone slider reaches the engine and persists')
        ok(pg.evaluate('document.getElementById("toneP").value') == '700', 'pause menu tone slider mirrors it')
        pg.evaluate('__mi.setSetting("toneHz", 570)')
        pg.evaluate('__mi.setWpm(12)')

        pg.click('#start')
        pg.wait_for_function('__mi.G && __mi.G.phase === "play"')
        ok(not pg.is_visible('#ui'), 'overlay hides during play')
        g = pg.evaluate('({lives:__mi.G.lives, wave:__mi.G.wave, left:__mi.G.left, wpm:__mi.G.wpm})')
        ok(g == {'lives': 3, 'wave': 1, 'left': 8, 'wpm': 12}, f'wave 1 setup {g}')

        pg.evaluate('__mi.step(1000)')
        gl = pg.evaluate('__mi.G.glyphs.map(g=>({tok:g.tokens, vis:g.vis, kind:g.kind, tx:!!g.tx}))')
        ok(len(gl) == 1 and gl[0]['tx'] and gl[0]['kind'] == 'char', f'first glyph is a sent single character {gl}')
        ok(gl[0]['vis'] == [True], 'an uncopied character is shown on screen')

        tok = gl[0]['tok'][0]
        pg.evaluate(f'__mi.key("{"M" if tok == "K" else "K"}")')
        st = pg.evaluate('({lives:__mi.G.lives, q:__mi.G.tx.queue.length, streak:__mi.G.streak})')
        ok(st == {'lives': 2, 'q': 1, 'streak': 0}, f'wrong key costs a life and queues a resend {st}')
        pg.evaluate(f'__mi.key("{tok}")')
        st = pg.evaluate('({copied:__mi.G.copied, streak:__mi.G.streak, states:__mi.G.glyphs.map(g=>g.state)})')
        ok(st == {'copied': 1, 'streak': 1, 'states': ['hit']}, f'right key destroys it {st}')

        pg.evaluate('__mi.step(3000); __mi.step(10000)')
        st = pg.evaluate('({lives:__mi.G.lives, floor:__mi.G.glyphs.filter(g=>g.state==="floor").map(g=>[g.vis, g.resent])})')
        ok(st['lives'] <= 1 and st['floor'] and all(all(v) and r for v, r in st['floor']), f'a glyph reaching the floor costs a life, is revealed and re-sent {st}')

        lives_before = pg.evaluate('__mi.G.lives')
        ok(play_wave(pg) < 600 and pg.evaluate('__mi.G.phase') == 'inter', 'copying the rest clears wave 1')
        inter = pg.evaluate('({tok:__mi.G.inter.tok, held:__mi.G.inter.held, acc:__mi.G.inter.acc, koch:__mi.kochCount, lives:__mi.G.lives})')
        ok(inter['tok'] is None and inter['held'] and inter['acc'] < 0.9 and inter['koch'] == 2, f'a wave with mistakes holds the set at K M {inter}')
        ok(inter['lives'] == min(3, lives_before + 1), 'a cleared wave gives a life back')
        pg.evaluate('__mi.step(3000)')
        st = pg.evaluate('({phase:__mi.G.phase, wave:__mi.G.wave})')
        ok(st == {'phase': 'play', 'wave': 2}, f'held interstitial moves on by itself {st}')

        ok(play_wave(pg) < 600 and pg.evaluate('__mi.G.phase') == 'inter', 'perfect copy clears wave 2')
        inter = pg.evaluate('({tok:__mi.G.inter.tok, koch:__mi.kochCount, pool:__mi.pool()})')
        ok(inter == {'tok': 'R', 'koch': 3, 'pool': ['K', 'M', 'R']}, f'a wave at 90 percent or better adds the next Koch character {inter}')
        ok(pg.evaluate('localStorage.getItem("dxMorseInvaders_koch")') == '3', 'koch count persists under the planned key')
        pg.evaluate('__mi.step(6000)')
        st = pg.evaluate('({phase:__mi.G.phase, wave:__mi.G.wave})')
        ok(st == {'phase': 'play', 'wave': 3}, f'interstitial plays the new character and moves on {st}')

        kinds = set()
        for _ in range(3, 12):
            steps = 0
            while pg.evaluate('__mi.G.phase') == 'play' and steps < 600:
                kinds |= set(pg.evaluate('__mi.G.glyphs.map(g=>g.kind)'))
                pg.evaluate('__mi.copyAll(); __mi.step(200)')
                steps += 1
            ok(pg.evaluate('__mi.G.phase') == 'inter', 'each wave clears')
            pg.evaluate('__mi.key("K")')
        ok(pg.evaluate('__mi.G.lives') == 3, 'perfect copy never loses a life')
        ok(pg.evaluate('__mi.kochCount') == 12, 'pool grew one character per clean wave')
        ok({'char', 'group2', 'group3'} <= kinds, f'groups arrive as the set grows {kinds}')
        ok('call' not in kinds, 'no callsigns while the set has no digit: nothing falls that is not in the set')
        ok(pg.evaluate('__mi.callsOn()') is False, 'auto callsigns are off at Koch 12')
        pg.evaluate('__mi.setSetting("calls", "on")')
        pool = set(pg.evaluate('__mi.pool()'))
        for c in pg.evaluate('Array.from({length:40}, () => __mi.makeCall())'):
            ok(all(t in pool for t in c if t.isalpha()), f'callsign letters come from the set {c}')
            d = [t for t in c if t.isdigit()]
            ok(len(d) == 1 and d[0] in ('0', '5', '9'), f'forced callsigns use one starter digit while the set has none {c}')
        pg.evaluate('__mi.setSetting("calls", "auto")')
        saved = pg.evaluate('__mi.kochCount')
        pg.evaluate('__mi.setKoch(18)')
        ok(pg.evaluate('__mi.callsOn()') is True and '0' in pg.evaluate('__mi.pool()'), 'auto callsigns arrive once 0 joins the set at Koch 18')
        ok(all(c[[i for i, t in enumerate(c) if t.isdigit()][0]] == '0' for c in pg.evaluate('Array.from({length:20}, () => __mi.makeCall())')), 'and their digit is the one in the set')
        pg.evaluate(f'__mi.setKoch({saved})')

        known = pg.evaluate('(() => { const s = __mi.stats(); return Object.fromEntries(Object.entries(s).map(([k,v]) => [k, v.correct])) })()')
        pg.evaluate('__mi.step(1200)')
        for toks, vis in pg.evaluate('__mi.G.glyphs.filter(g=>g.state==="fall").map(g => [g.tokens, g.vis])'):
            for t, shown in zip(toks, vis):
                if t in pool and known.get(t, 0) >= 4:
                    ok(shown is False, f'{t} copied {known[t]} times is audio-only now')
                if t not in pool:
                    ok(shown is True, f'{t} outside the set is always shown')

        before = pg.evaluate('(() => { const g = __mi.G.glyphs.find(x => x.state === "fall"); return g ? g.tx.start : null })()')
        pg.evaluate('__mi.pause()')
        ok(pg.is_visible('#vPause') and pg.evaluate('__mi.G.paused'), 'pause shows the menu')
        pg.evaluate('__mi.resume(); __mi.step(64)')
        after = pg.evaluate('(() => { const g = __mi.G.glyphs.find(x => x.state === "fall"); return g ? g.tx.start : null })()')
        ok(before is not None and after is not None and after > before, 'resume re-sends the lowest glyph')

        guard = 0
        while pg.evaluate('__mi.G.phase') in ('play', 'inter') and guard < 60:
            pg.evaluate('__mi.step(9000)')
            if pg.evaluate('__mi.G.phase') == 'inter':
                pg.evaluate('__mi.key("K")')
            guard += 1
        pg.evaluate('__mi.step(2000)')
        ok(pg.evaluate('__mi.G.phase') == 'over', 'letting everything fall ends the run')
        pg.wait_for_selector('#vOver', state='visible')
        ok(pg.evaluate('localStorage.getItem("dxMorseInvaders_hi")') == str(pg.evaluate('__mi.G.copied')), 'best copied persists under the planned key')

        pg.keyboard.press('Enter')
        pg.wait_for_function('__mi.G && __mi.G.phase === "play" && __mi.G.wave === 1')
        pg.evaluate('__mi.step(1000)')
        t = pg.evaluate('__mi.G.glyphs[0].tokens[0]')
        pg.keyboard.press(t.lower())
        ok(pg.evaluate('__mi.G.copied') == 1, 'a lower-case keyboard letter copies')
        pg.keyboard.press('Escape')
        ok(pg.evaluate('__mi.G.paused') is True, 'Escape pauses')
        pg.keyboard.press('Escape')
        ok(pg.evaluate('__mi.G.paused') is False, 'Escape resumes')

        pg.evaluate('__mi.quit(); __mi.setSetting("mode","custom"); __mi.setSetting("keys","on")')
        ok(pg.evaluate('__mi.pool()') == ['K', 'M', 'R', 'S', 'U', 'A'], 'custom set default')
        ok(pg.evaluate('document.querySelectorAll("#keys button").length') == 8, 'on-screen keys: six characters plus replay and pause')
        pg.evaluate('__mi.setSetting("mode","koch"); __mi.setSetting("keys","auto")')

        pg.reload()
        pg.wait_for_function('window.__mi')
        ok(pg.evaluate('__mi.kochCount') == 12 and pg.evaluate('__mi.hi') > 0, 'progress survives a reload')
        pg.close()

        ctx = b.new_context(viewport={'width': 390, 'height': 700}, device_scale_factor=2, has_touch=True, is_mobile=True)
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(f'http://127.0.0.1:{PORT}/morse-invaders/index.html')
        pg.wait_for_function('window.__mi')
        ok(pg.evaluate('document.getElementById("keys").classList.contains("show")'), 'coarse pointer shows on-screen keys')
        pg.evaluate('__mi.start()')
        pg.wait_for_function('__mi.G && __mi.G.phase === "play"')
        pg.evaluate('__mi.step(1000)')
        t = pg.evaluate('__mi.G.glyphs[0].tokens[0]')
        pg.tap(f'#keys button[data-tok="{t}"]')
        ok(pg.evaluate('__mi.G.copied') == 1, 'a tapped key copies')
        w = int(pg.evaluate('document.getElementById("stage").style.width').replace('px', ''))
        ok(300 < w <= 390, f'portrait phone stage fits ({w}px wide)')
        pg.set_viewport_size({'width': 844, 'height': 390})
        pg.wait_for_timeout(200)
        ok(pg.evaluate('document.getElementById("wrap").classList.contains("land")'), 'landscape phone puts keys beside the stage')
        h = int(pg.evaluate('document.getElementById("stage").style.height').replace('px', ''))
        ok(h >= 360, f'landscape phone stage uses the height ({h}px)')
        b.close()

    srv.shutdown()
    if errors:
        print('PAGE ERRORS:', *errors, sep='\n  ')
        sys.exit(1)
    print(f'ok: {checks} checks passed')


if __name__ == '__main__':
    main()
