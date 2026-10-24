#!/usr/bin/env python3
"""Headless check of Delve (frontend/public/delve/index.html).

Serves frontend/public and drives the game through window.__delve.
Also checks the shell tab, the service-worker bump, the favicon tint,
and the nginx carve-out for the unhashed modules.

Run from the repo root:  python3 scripts/test_delve.py
Needs: pip install playwright && python3 -m playwright install chromium
"""
import os
import re
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
    # At or past the bump that shipped Delve: a later cache bump must not fail this check.
    cache = re.search(r"CACHE_NAME = 'dxedge-v(\d+)'", sw)
    ok(cache is not None and int(cache.group(1)) >= 119, 'service worker cache bumped')
    ok("url.pathname.startsWith('/delve/')" in sw, 'service worker treats /delve/ as mutable')
    ok('location ^~ /delve/' in nginx, 'nginx does not pin the delve modules for a year')
    ok('href="/delve/favicon.svg"' in page_html, 'page uses its own favicon')
    ok('#e7a15a' in fav and '#7affb2' not in fav, 'favicon is the ember tint, not the site green')
    ok('id="credits"' in page_html and 'original code' in page_html, 'page has a credits section')
    ok('Help (H)' in page_html and 'id="help"' in page_html, 'help button and overlay are on the page')
    ok('Quests (J)' in page_html and 'id="quests"' in page_html, 'quest log is on the page')
    ok('waystation' in page_html, 'help mentions the waystation')
    ok('campfire' in page_html and 'tattered banner' in page_html and 'Spark' in page_html, 'help names the camp and the runes')
    ok('character sheet' in page_html and 'backpack' in page_html, 'help names the character sheet')
    ok("Nell's stall" in page_html and 'floor plate' in page_html, 'help names the stall and the plate')
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
        def note_console(m):
            if m.type != 'error':
                return
            # The usage beacon POSTs to /api/stat. This static server has no such route.
            if "Unsupported method ('POST')" in m.text:
                return
            errors.append('console.error: ' + m.text)
        pg.on('console', note_console)
        pg.goto(f'http://127.0.0.1:{PORT}/delve/index.html', wait_until='networkidle')
        pg.wait_for_function('window.__delve && document.getElementById("begin")')
        pg.evaluate('window.__delveHold = true')
        ok(pg.title() == 'Delve · DXEdge', 'title')
        ok('Four champions' in pg.inner_text('#overlay-body'), 'title explains the party')
        ok('Q' in pg.inner_text('#overlay-body') and 'strafe' in pg.inner_text('#overlay-body'), 'controls are on the title')
        ok('H lists every key' in pg.inner_text('#title-hint'), 'title card has a controls hint')
        ok(pg.query_selector('#title-art') is not None, 'title has a rendered scene')
        ok(pg.query_selector('[data-gfx="high"]') and pg.query_selector('[data-motion="step"]'), 'quality and step mode are on the title')
        pg.click('#help-btn')
        ok(pg.evaluate('() => document.getElementById("help").hidden === false'), 'Help (H) opens the overlay')
        help_text = pg.inner_text('#help')
        ok('Z' in help_text and 'Bryn' in help_text and 'Space' in help_text and 'strafe' in help_text, 'help lists the controls')
        pg.keyboard.press('h')
        ok(pg.evaluate('() => document.getElementById("help").hidden === true'), 'H closes the help overlay')

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
        ok(pg.eval_on_selector_all('.portrait', 'els => els.length') == 4, 'each champion has a portrait')
        pg.click('.champ .portrait')
        ok(pg.evaluate('() => document.getElementById("sheet").hidden === false'), 'portrait opens the character sheet')
        sheet_text = pg.inner_text('#sheet')
        ok('Bryn' in sheet_text and 'Backpack' in sheet_text and 'HEAD' in sheet_text and 'OFFHAND' in sheet_text and 'ash knife' in sheet_text, 'sheet shows slots and the pack')
        ok(pg.evaluate('() => __delve.state().paused === true'), 'sheet pauses the delve')
        pg.keyboard.press('2')
        ok('Cara' in pg.inner_text('#sheet'), '2 opens Cara')
        pg.keyboard.press('Escape')
        ok(pg.evaluate('() => document.getElementById("sheet").hidden === true && __delve.state().paused === false'), 'Esc closes the sheet and resumes')
        pg.keyboard.press('1')
        ok(pg.evaluate('() => document.getElementById("sheet").hidden === false'), '1 opens Bryn')
        pg.keyboard.press('g')
        ok(pg.evaluate('__delve.party()[0].row') == 'back', 'G steps the open champion back')
        ok('Step to the front' in pg.inner_text('#sheet'), 'the sheet offers the other rank')
        pg.keyboard.press('Escape')
        ok(pg.evaluate('__delve.party()[0].row') == 'back', 'rank stays after the sheet closes')
        pg.keyboard.press('g')
        ok(pg.evaluate('__delve.party()[0].row') == 'front', 'G steps Bryn forward again')
        pg.keyboard.press('i')
        ok(pg.evaluate('() => document.getElementById("sheet").hidden === false'), 'I opens the selected sheet')
        pg.keyboard.press('Escape')

        pg.evaluate('''() => new Promise(resolve => {
          __delve.newGame(1, "normal");
          __delve.setQuality("high");
          const g = __delve.game;
          const b = g.floors[0].entities.find(e => e.kind === "prop" && e.sub === "bones");
          for (let i = 0; i <= 4; i++) if (b.y + i < 33) g.floors[0].tiles[b.y + i][b.x] = 1;
          g.floors[0].entities = g.floors[0].entities.filter(e => e === b || e.x !== b.x || e.y < b.y || e.y > b.y + 4);
          __delve.setPos(b.x, b.y + 3, 0, 0);
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        })''')
        pg.screenshot(path='/tmp/delve-bones.png', full_page=False)
        bones = pg.evaluate('''() => new Promise(resolve => {
          const g = __delve.game;
          const b = g.floors[0].entities.find(e => e.kind === "prop" && e.sub === "bones" && !e.taken);
          const c = document.getElementById("view");
          const ctx = c.getContext("2d");
          const withBones = ctx.getImageData(0, 0, c.width, c.height).data;
          b.taken = true;
          requestAnimationFrame(() => {
            const bare = ctx.getImageData(0, 0, c.width, c.height).data;
            let n = 0, bright = 0;
            for (let i = 0; i < withBones.length; i += 4) {
              const dr = Math.abs(withBones[i] - bare[i]) + Math.abs(withBones[i + 1] - bare[i + 1]) + Math.abs(withBones[i + 2] - bare[i + 2]);
              if (dr > 30) {
                n++;
                if (withBones[i] > 150 && withBones[i + 1] > 130) bright++;
              }
            }
            b.taken = false;
            resolve({n: n, bright: bright});
          });
        })''')
        ok(bones['n'] > 800 and bones['bright'] > 200, 'bones are visible three steps ahead: ' + str(bones))
        pg.evaluate('''() => {
          const g = __delve.game;
          g.log.length = 0;
          __delve.interact();
          __delve.interact();
          const line = g.log.find(l => l.text.indexOf("Scattered bones") >= 0);
          window.__boneLine = line ? line.n : 0;
        }''')
        ok(pg.evaluate('window.__boneLine') == 1, 'Use does not stack the bones line')

        pg.evaluate('''() => {
          const g = __delve.game;
          g.inHub = true;
          g.gold = 20;
          g.paused = false;
        }''')
        pg.keyboard.press('b')
        stall_text = pg.inner_text('#stall')
        ok('hard biscuit' in stall_text and 'waterskin' in stall_text, stall_text[:240])
        ok(pg.evaluate('() => __delve.state().paused === true'), 'the stall pauses the delve')
        pg.click('[data-buy="biscuit"]')
        ok(pg.evaluate('__delve.state().gold') == 16, 'a biscuit costs 4 coins')
        pg.screenshot(path='/tmp/delve-stall.png', full_page=False)
        pg.keyboard.press('Escape')
        ok(pg.evaluate('() => document.getElementById("stall").hidden === true && __delve.state().paused === false'), 'Esc closes the stall')
        pg.evaluate('__delve.newGame(1, "normal")')

        names = pg.inner_text('#party')
        ok('Bryn' in names and 'Senn' in names, 'party panel is on the page')
        font = pg.evaluate('getComputedStyle(document.querySelector(".name")).fontSize')
        ok(float(font.replace('px', '')) >= 18, 'names are large: ' + font)
        view_w = pg.evaluate('document.getElementById("view").clientWidth')
        ok(view_w > 900, 'view uses the wide screen: ' + str(view_w))

        summary = pg.evaluate('__delve.summary()')
        ok(len(summary) == 7, summary)
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
          const g = __delve.game;
          g.facing = 1;
          const m = __delve.spawn('brute', g.x + 1, g.y);
          m.mark = 'space';
        }''')
        hp = pg.evaluate('__delve.game.floors[__delve.state().floor].entities.find(e => e.mark==="space").hp')
        pg.keyboard.press(' ')
        hp2 = pg.evaluate('__delve.game.floors[__delve.state().floor].entities.find(e => e.mark==="space").hp')
        ok(hp2 < hp, 'space attacks the creature ahead')
        mana = pg.evaluate('__delve.party()[3].mana')
        pg.evaluate('__delve.game.selected = 3')
        pg.keyboard.press('r')
        ok(pg.evaluate('__delve.party()[3].mana') < mana, 'casting the rune spends mana')

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
        ok(pg.evaluate('__delve.state().inHub') is True, 'stairs reach the waystation')
        ok(pg.evaluate('__delve.state().floor') == 0, 'the floor waits while you are in camp')
        pg.evaluate('__delve.setPos(20, 16, 0, 1); __delve.interact()')
        ok(pg.evaluate('__delve.state().floor') == 1 and pg.evaluate('__delve.state().inHub') is False, 'the far stair leaves the waystation')

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
        pg.evaluate('__delve.setPos(__delve.state().x, __delve.state().y, 4, 1); __delve.killAll()')
        ok(pg.evaluate('__delve.state().phase') == 'play', 'the floor 5 warden does not end the delve')
        pg.evaluate('''() => {
          const last = __delve.game.floors.length - 1;
          __delve.setPos(__delve.state().x, __delve.state().y, last, 1);
          __delve.killAll();
        }''')
        ok(pg.evaluate('__delve.state().phase') == 'won', 'felling the Seal wins')
        ok('kept the crypt' in pg.inner_text('#overlay-body').lower() or 'You kept the crypt' in pg.inner_text('#overlay-body'), 'win is on screen')

        pg.evaluate('__delve.newGame(6, "easy"); __delve.wipe()')
        ok(pg.evaluate('__delve.state().phase') == 'lost', 'a fallen party loses')

        pg.evaluate('''() => {
          __delve.newGame(1, "normal");
          const g = __delve.game;
          g.facing = 1;
          __delve.spawn("brute", g.x + 1, g.y);
        }''')
        before = pg.evaluate('''() => {
          const g = __delve.game;
          const m = g.floors[g.floor].entities.find(e => e.alive && e.sub === "brute");
          return {hp: m.hp, s0: g.party[0].sta, s1: g.party[1].sta};
        }''')
        pg.evaluate('__delve.press("KeyZ")')
        after = pg.evaluate('''() => {
          const g = __delve.game;
          const m = g.floors[g.floor].entities.find(e => e.sub === "brute");
          return {hp: m.hp, s0: g.party[0].sta, s1: g.party[1].sta, phase: g.phase};
        }''')
        ok(after['hp'] < before['hp'], 'Z attacks Bryn alone')
        ok(after['s0'] < before['s0'] and after['s1'] == before['s1'], 'Cara keeps her stamina')
        pg.evaluate('__delve.press("Space")')
        swung = pg.evaluate('''() => {
          const g = __delve.game;
          const m = g.floors[g.floor].entities.find(e => e.sub === "brute");
          return {hp: m.hp, s1: g.party[1].sta};
        }''')
        ok(swung['hp'] < after['hp'] and swung['s1'] < before['s1'], 'Space swings the front rank')
        pg.evaluate('__delve.press("KeyM")')
        ok(pg.inner_text('#mute') == 'Sound off', 'M mutes')
        pg.evaluate('__delve.press("KeyM")')
        ok(pg.inner_text('#mute') == 'Sound on', 'M unmutes')

        pg.evaluate('''() => {
          __delve.newGame(1, "normal");
          const g = __delve.game;
          const tiles = g.floors[0].tiles;
          for (let i = 0; i <= 4; i++) tiles[10][8 + i] = 1;
          g.floors[0].entities = g.floors[0].entities.filter(e => e.y !== 10 || e.x < 8 || e.x > 12);
          g.floors[0].entities.push({kind:"chest", x:9, y:10, opened:false, loot:{type:"gold", amount:9}});
          __delve.setPos(8, 10, 0, 1);
        }''')
        gold = pg.evaluate('__delve.state().gold')
        pg.keyboard.press('f')
        pg.wait_for_timeout(80)
        ok(pg.evaluate('__delve.state().gold') == gold + 9, 'F opens the chest in the next tile')
        ok(pg.evaluate('''() => __delve.game.floors[0].entities.some(e => e.kind==="chest" && e.x===9 && e.opened)'''), 'the adjacent chest is open')
        pg.evaluate('''() => {
          const g = __delve.game;
          for (let i = 0; i <= 4; i++) g.floors[0].tiles[12][8 + i] = 1;
          g.floors[0].entities = g.floors[0].entities.filter(e => e.y !== 12 || e.x < 8 || e.x > 12);
          g.floors[0].entities.push({kind:"chest", x:10, y:12, opened:false, loot:{type:"gold", amount:3}});
          __delve.setPos(8, 12, 0, 1);
        }''')
        far_gold = pg.evaluate('__delve.state().gold')
        pg.keyboard.press('f')
        pg.wait_for_timeout(120)
        log_text = pg.inner_text('#log')
        ok('The chest is 2 steps ahead.' in log_text, log_text)
        ok(pg.evaluate('__delve.state().gold') == far_gold, 'a chest two tiles away does not open')
        pg.keyboard.press(' ')
        pg.wait_for_timeout(80)
        ok('The chest is 2 steps ahead.' in pg.inner_text('#log'), 'attack names the chest too')
        pg.evaluate('__delve.press("KeyJ")')
        pg.wait_for_timeout(80)
        quest_text = pg.inner_text('#quests')
        ok('The Cinder Gate' in quest_text and 'A lost lantern' in quest_text, quest_text[:240])
        ok(pg.locator('#quests').is_visible(), 'J opens the quest log')
        pg.screenshot(path='/tmp/delve-quests.png', full_page=False)
        pg.evaluate('__delve.press("KeyJ")')
        pg.evaluate('''() => {
          __delve.newGame(3, "normal");
          const g = __delve.game;
          const tiles = g.floors[4].tiles;
          for (let y = 0; y < tiles.length; y++) {
            for (let x = 0; x < tiles[y].length; x++) if (tiles[y][x] === 4) { __delve.setPos(x, y, 4, 1); return; }
          }
        }''')
        pg.evaluate('__delve.setQuality("high")')
        pg.wait_for_timeout(350)
        pg.screenshot(path='/tmp/delve-forge.png', full_page=False)
        pg.evaluate('''() => {
          const g = __delve.game;
          g.inHub = true;
          const nell = g.hub.entities.find(e => e.id === "nell");
          __delve.setPos(nell.x, nell.y + 1, g.floor, 0);
          __delve.interact();
        }''')
        pg.wait_for_timeout(250)
        ok('Nell' in pg.inner_text('#talk'), 'Nell speaks at the waystation')
        pg.screenshot(path='/tmp/delve-hub.png', full_page=False)
        pg.evaluate('__delve.setQuality("high")')
        pg.wait_for_timeout(400)
        pg.screenshot(path='/tmp/delve-chest-far.png', full_page=False)
        pg.evaluate('__delve.move("forward")')
        pg.wait_for_timeout(350)
        pg.screenshot(path='/tmp/delve-chest-near.png', full_page=False)
        ok(os.path.getsize('/tmp/delve-chest-far.png') > 20000, 'far chest screenshot')
        ok(os.path.getsize('/tmp/delve-chest-near.png') > 20000, 'near chest screenshot')

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
                __delve.spawn('knight', x + 1, y);
                __delve.spawn('moth', x + 2, y);
                __delve.spawn('chanter', x + 3, y);
                g.floaters = [
                  {text: '14', kind: 'hit', life: 900},
                  {text: '9', kind: 'spell', life: 900},
                ];
                g.lights = [{x: x + 2.4, y: y + 0.5, r: 0.45, g: 0.16, b: 0.04, life: 200, radius: 2.2, floor: 0}];
                g.particles = [];
                for (let i = 0; i < 6; i++) {
                  g.particles.push({x: x + 1.05, y: y + 0.42, vx: 0.1 * i, vy: -0.15, life: 360, r: 1, g: 0.72, b: 0.3, floor: 0});
                }
                return;
              }
            }
          }
        }''')
        pg.evaluate('__delve.setQuality("high")')
        pg.wait_for_timeout(500)
        shot = os.path.join('/tmp', 'delve-gameplay.png')
        pg.screenshot(path=shot, full_page=False)
        ok(os.path.getsize(shot) > 20000, 'screenshot written')

        ok(not errors, errors)
        browser.close()
    srv.shutdown()
    print('delve ok', checks, 'checks')


if __name__ == '__main__':
    main()
