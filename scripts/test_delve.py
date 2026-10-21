#!/usr/bin/env python3
"""Headless check of Delve (frontend/public/delve/index.html).

Serves frontend/public and drives the game through window.__delve.
Also checks the shell tab, the service-worker bump, the favicon tint,
and the nginx carve-out for the unhashed modules.

Run from the repo root:  python3 scripts/test_delve.py
Needs: pip install playwright && python3 -m playwright install chromium
"""
import os
import socket
import socketserver
import threading
from http.server import SimpleHTTPRequestHandler

from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PUBLIC = os.path.join(ROOT, 'frontend', 'public')
PORT = 8771


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
    page_html = open(os.path.join(PUBLIC, 'delve', 'index.html'), encoding='utf-8').read()
    fav = open(os.path.join(PUBLIC, 'delve', 'favicon.svg'), encoding='utf-8').read()
    app = open(os.path.join(ROOT, 'frontend', 'src', 'App.jsx'), encoding='utf-8').read()
    shell = open(os.path.join(ROOT, 'frontend', 'src', 'components', 'Delve.jsx'), encoding='utf-8').read()
    sw = open(os.path.join(PUBLIC, 'sw.js'), encoding='utf-8').read()
    nginx = open(os.path.join(ROOT, 'nginx', 'nginx.conf'), encoding='utf-8').read()
    notices = open(os.path.join(ROOT, 'THIRD_PARTY_NOTICES.md'), encoding='utf-8').read()

    checks = 0

    def ok(cond, msg):
        nonlocal checks
        checks += 1
        if not cond:
            raise AssertionError(msg)

    ok('id: \'delve\'' in app and "label: 'Delve'" in app and '<Delve />' in app, 'games nav has a Delve tab')
    ok('href="/delve/"' in shell, 'shell links to the standalone page')
    ok("CACHE_NAME = 'dxedge-v115'" in sw, 'service worker cache bumped')
    ok("url.pathname.startsWith('/delve/')" in sw, 'service worker treats /delve/ as mutable')
    ok('location ^~ /delve/' in nginx, 'nginx does not pin the delve modules for a year')
    ok('href="/delve/favicon.svg"' in page_html, 'page uses its own favicon')
    ok('#e7a15a' in fav and '#7affb2' not in fav, 'favicon is the ember tint, not the site green')
    ok('id="credits"' in page_html and 'original code' in page_html, 'page has a credits section')
    ok('## Delve' in notices and 'original code' in notices, 'third-party notice covers Delve')
    ok('cdn.' not in page_html and 'googletag' not in page_html and 'analytics' not in page_html, 'no third-party tags in the page')

    srv = serve()
    errors = []
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch()
        except Exception:
            browser = p.chromium.launch(executable_path='/usr/bin/google-chrome')
        pg = browser.new_page(viewport={'width': 1920, 'height': 1080})
        pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        pg.on('console', lambda m: errors.append('console.' + m.type + ': ' + m.text) if m.type == 'error' else None)
        pg.goto(f'http://127.0.0.1:{PORT}/delve/index.html', wait_until='networkidle')
        pg.wait_for_function('window.__delve && document.getElementById("begin")')
        pg.evaluate('window.__delveHold = true')
        ok(pg.title() == 'Delve · DXEdge', 'title')
        ok('Four champions' in pg.inner_text('#overlay-body'), 'title explains the party')
        ok('Q' in pg.inner_text('#overlay-body') and 'strafe' in pg.inner_text('#overlay-body'), 'controls are on the title')

        scripts = pg.eval_on_selector_all('script[src]', 'els => els.map(e => e.getAttribute("src"))')
        ok(scripts == ['/lib/stat.js', './main.js'], 'only same-origin scripts: ' + str(scripts))

        pg.evaluate('__delve.newGame(1, "normal")')
        pg.wait_for_function('__delve.state() && __delve.state().phase === "play"')
        st = pg.evaluate('__delve.state()')
        ok(st['seed'] == 1 and st['difficulty'] == 'normal', st)
        party = pg.evaluate('__delve.party().map(c => ({name:c.name, hp:c.hp, sta:c.sta, mana:c.mana, maxHp:c.maxHp, role:c.role, row:c.row}))')
        ok(len(party) == 4, party)
        ok(all(c['hp'] > 0 and c['sta'] > 0 and c['mana'] > 0 and c['maxHp'] >= c['hp'] for c in party), party)
        ok([c['row'] for c in party] == ['front', 'front', 'back', 'back'], party)
        ok(pg.evaluate('__delve.spells.length') == 5, 'five runes')
        ok(pg.evaluate('__delve.explored()') > 8, 'automap starts revealed around the party')

        names = pg.inner_text('#party')
        ok('Bryn' in names and 'Senn' in names, 'party panel is on the page')
        font = pg.evaluate('getComputedStyle(document.querySelector(".name")).fontSize')
        ok(float(font.replace('px', '')) >= 18, 'names are large: ' + font)
        view_w = pg.evaluate('document.getElementById("view").clientWidth')
        ok(view_w > 900, 'view uses the wide screen: ' + str(view_w))

        summary = pg.evaluate('__delve.summary()')
        ok(len(summary) == 5, summary)
        ok(all(s['stairsReachable'] for s in summary), summary)
        ok(all(s['locked'] >= 1 and s['gates'] >= 1 and s['keys'] >= 1 and s['levers'] >= 1 for s in summary), summary)

        easy = pg.evaluate('(() => { __delve.newGame(4, "easy"); return __delve.summary().reduce((n,s)=>n+s.monsterHp,0); })()')
        hard = pg.evaluate('(() => { __delve.newGame(4, "hard"); return __delve.summary().reduce((n,s)=>n+s.monsterHp,0); })()')
        ok(hard > easy, 'hard %s vs easy %s' % (hard, easy))

        pg.evaluate('__delve.newGame(1, "normal")')
        before = pg.evaluate('__delve.state()')
        pg.keyboard.press('a')
        turned = pg.evaluate('__delve.state()')
        ok(turned['facing'] == (before['facing'] + 3) % 4, 'A turns left')
        pg.keyboard.press('ArrowRight')
        back = pg.evaluate('__delve.state().facing')
        ok(back == before['facing'], 'arrow right turns back')

        moved = False
        for _ in range(8):
            pos = pg.evaluate('({x:__delve.state().x, y:__delve.state().y})')
            pg.keyboard.press('w')
            pos2 = pg.evaluate('({x:__delve.state().x, y:__delve.state().y})')
            if pos2 != pos:
                pg.keyboard.press('s')
                pos3 = pg.evaluate('({x:__delve.state().x, y:__delve.state().y})')
                ok(pos3 == pos, 'S steps back')
                moved = True
                break
            pg.keyboard.press('d')
        ok(moved, 'W finds a step')

        pos = pg.evaluate('({x:__delve.state().x, y:__delve.state().y, f:__delve.state().facing})')
        pg.click('#pad [data-cmd="strafeLeft"]')
        slid = pg.evaluate('({x:__delve.state().x, y:__delve.state().y, f:__delve.state().facing})')
        if slid['x'] != pos['x'] or slid['y'] != pos['y']:
            ok(slid['f'] == pos['f'], 'strafe keeps facing')
            pg.click('#pad [data-cmd="strafeRight"]')
            backp = pg.evaluate('({x:__delve.state().x, y:__delve.state().y})')
            ok(backp == {'x': pos['x'], 'y': pos['y']}, 'strafe right returns')
        else:
            # The shoulder was a wall. The button still has to be the strafe control.
            ok(pg.get_attribute('#pad [data-cmd="strafeLeft"]', 'data-cmd') == 'strafeLeft', 'strafe control')

        pg.evaluate('''() => {
          const s = __delve.state();
          __delve.spawn('crawler', s.facing === 1 ? s.x + 1 : s.x, s.facing === 1 ? s.y : s.y + 1);
          if (__delve.state().facing !== 1) {
            const g = __delve.game;
            g.facing = 1;
            const m = g.floors[g.floor].entities.filter(e => e.kind === 'monster' && e.alive).pop();
            m.x = g.x + 1; m.y = g.y;
          }
        }''')
        hp = pg.evaluate('__delve.game.floors[__delve.state().floor].entities.find(e => e.alive && e.kind==="monster" && e.x === __delve.state().x+1).hp')
        pg.keyboard.press(' ')
        hp2 = pg.evaluate('__delve.game.floors[__delve.state().floor].entities.find(e => e.kind==="monster" && e.x === __delve.state().x+1).hp')
        ok(hp2 < hp, 'space attacks the creature ahead')
        mana = pg.evaluate('__delve.party()[3].mana')
        pg.evaluate('__delve.game.selected = 3')
        pg.keyboard.press('1')
        ok(pg.evaluate('__delve.party()[3].mana') < mana, 'rune 1 spends mana')

        pg.evaluate('__delve.hurt(0, 12)')
        hurt = pg.evaluate('__delve.party()[0].hp')
        pg.evaluate('__delve.cast("sera")')
        ok(pg.evaluate('__delve.party()[0].hp') > hurt, 'Sera mends')

        door = pg.evaluate('''() => {
          const g = __delve.game;
          const tiles = g.floors[0].tiles;
          for (let y = 0; y < tiles.length; y++) {
            for (let x = 0; x < tiles[y].length; x++) if (tiles[y][x] === 2) return {x, y};
          }
          return null;
        }''')
        ok(door, 'a locked door exists')
        pg.evaluate('pos => { __delve.game.keys = 0; __delve.setPos(pos.x - 1, pos.y, 0, 1); }', door)
        pg.keyboard.press('f')
        still = pg.evaluate('() => __delve.tile(%d, %d, 0)' % (door['x'], door['y']))
        ok(still == 2, 'use without a key leaves the door locked')
        pg.evaluate('__delve.giveKey(1); __delve.press("KeyF")')
        opened = pg.evaluate('() => __delve.tile(%d, %d, 0)' % (door['x'], door['y']))
        ok(opened == 7, 'a key opens the door')

        lever = pg.evaluate('''() => {
          const e = __delve.game.floors[0].entities.find(e => e.kind === "lever");
          return e ? {x:e.x, y:e.y, gx:e.gx, gy:e.gy} : null;
        }''')
        ok(lever, 'a lever exists')
        pg.evaluate('p => __delve.setPos(p.x, p.y, 0, 0)', lever)
        before_gate = pg.evaluate('() => __delve.tile(%d, %d, 0)' % (lever['gx'], lever['gy']))
        ok(before_gate == 3, before_gate)
        pg.evaluate('__delve.interact()')
        ok(pg.evaluate('() => __delve.tile(%d, %d, 0)' % (lever['gx'], lever['gy'])) == 6, 'lever lifts the gate')

        explored = pg.evaluate('__delve.explored()')
        pg.evaluate('__delve.move("forward"); __delve.move("turnRight"); __delve.move("forward")')
        ok(pg.evaluate('__delve.explored()') >= explored, 'the map remembers')

        pg.evaluate('''() => {
          const g = __delve.game;
          const tiles = g.floors[0].tiles;
          for (let y = 0; y < tiles.length; y++) {
            for (let x = 0; x < tiles[y].length; x++) if (tiles[y][x] === 5) { __delve.setPos(x, y, 0, 0); return; }
          }
        }''')
        pg.evaluate('__delve.interact()')
        ok(pg.evaluate('__delve.state().floor') == 1, 'stairs go down a floor')

        pg.evaluate('localStorage.removeItem("dxedge_delve_save")')
        pg.evaluate('__delve.newGame(8, "normal")')
        pg.evaluate('__delve.game.gold = 17; __delve.move("turnRight")')
        spot = pg.evaluate('__delve.state()')
        ok(pg.evaluate('__delve.save()') is True, 'save writes')
        raw = pg.evaluate('localStorage.getItem("dxedge_delve_save")')
        ok(raw and '"gold":17' in raw, 'save is in localStorage')
        pg.evaluate('__delve.newGame(3, "hard")')
        ok(pg.evaluate('__delve.load()') is True, 'load')
        loaded = pg.evaluate('__delve.state()')
        ok(loaded['seed'] == 8 and loaded['gold'] == 17 and loaded['facing'] == spot['facing'], loaded)
        ok(loaded['difficulty'] == 'normal', loaded)

        pg.evaluate('__delve.newGame(6, "easy"); __delve.killAll()')
        # The warden is on the last floor. killAll on floor 0 does not win.
        pg.evaluate('__delve.setPos(__delve.state().x, __delve.state().y, 4, 1); __delve.killAll()')
        ok(pg.evaluate('__delve.state().phase') == 'won', 'felling the Warden wins')
        ok('kept the crypt' in pg.inner_text('#overlay-body').lower() or 'You kept the crypt' in pg.inner_text('#overlay-body'), 'win is on screen')

        pg.evaluate('__delve.newGame(6, "easy"); __delve.wipe()')
        ok(pg.evaluate('__delve.state().phase') == 'lost', 'a fallen party loses')

        # A gameplay frame for the eye: party, a creature, the map, the runes.
        pg.evaluate('''() => {
          __delve.newGame(2, "normal");
          const g = __delve.game;
          const tiles = g.floors[0].tiles;
          for (let y = 2; y < 30; y++) {
            for (let x = 2; x < 26; x++) {
              const open = [0, 1, 2, 3].every(i => tiles[y][x + i] === 1);
              const wide = tiles[y - 1] && tiles[y - 1][x + 1] === 1 && tiles[y + 1] && tiles[y + 1][x + 1] === 1;
              if (open && wide) {
                __delve.setPos(x, y, 0, 1);
                __delve.spawn('brute', x + 2, y);
                __delve.spawn('crawler', x + 3, y);
                return;
              }
            }
          }
        }''')
        pg.wait_for_timeout(400)
        shot = os.path.join('/tmp', 'delve-gameplay.png')
        pg.screenshot(path=shot, full_page=False)
        ok(os.path.getsize(shot) > 20000, 'screenshot written')

        ok(not errors, errors)
        browser.close()
    srv.shutdown()
    print('delve ok', checks, 'checks')


if __name__ == '__main__':
    main()
