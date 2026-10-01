#!/usr/bin/env python3
"""Episode keys, resume and history, continue listening, heard marks, Surprise Me skipping heard
episodes, and episode links (?e=&t=) on the OTR player.
Needs network (plays real archive.org audio). Run: python3 scripts/test_otr_history.py"""
import http.server, socketserver, threading, os, json, re
ROOT = os.path.abspath('frontend/public')
PORT = 8799

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(s, *a): pass
    def do_POST(s):
        s.rfile.read(int(s.headers.get('Content-Length') or 0)); s.send_response(204); s.end_headers()

socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.ThreadingTCPServer(('127.0.0.1', PORT), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()

from playwright.sync_api import sync_playwright
F = []
def ck(n, c, d=''):
    print('PASS' if c else 'FAIL', n, '' if c else d)
    if not c: F.append(n)

BASE = f'http://127.0.0.1:{PORT}/otr/'
URL = BASE + '?season=off'
A = 'document.getElementById("audio")'
PLAYING = f'!{A}.paused && {A}.currentTime>0.5'

def ready(pg):
    pg.wait_for_function('window.__otr&&__otr.ready()', timeout=20000); pg.wait_for_timeout(300)

with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': 1100, 'height': 900})
    ctx.grant_permissions(['clipboard-read', 'clipboard-write'], origin=BASE.rstrip('/').rsplit('/otr', 1)[0])
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); ready(pg)

    # --- keys: unique, stable, round-trip
    r = pg.evaluate('''(function(){ var c=__otr.catalog(), n=0, dup=0, bad=0, seen={};
      c.shows.forEach(function(s){ s.eps.forEach(function(_,i){ var k=__otr.epKey(s.id,i); n++;
        if(seen[k]) dup++; seen[k]=1; var f=__otr.findEp(k); if(!f||f.showId!==s.id||f.epIndex!==i) bad++; }); });
      return {n:n, dup:dup, bad:bad, sample:__otr.epKey(c.shows[0].id,0)}; })()''')
    ck('every episode has a unique key', r['n'] > 8000 and r['dup'] == 0, r)
    ck('keys round-trip to the same episode', r['bad'] == 0, r)
    ck('key format is show slug + 8 hex', re.fullmatch(r'[a-z0-9-]+\.[0-9a-f]{8}', r['sample']) is not None, r['sample'])
    ck('junk keys rejected', pg.evaluate('__otr.findEp("nope")===null && __otr.findEp("quiet-please.zzzzzzzz")===null'))

    # pick an episode with no enhanced copy so seconds map 1:1, and a long enough runtime
    pick = pg.evaluate('''(function(){ var c=__otr.catalog();
      for(var s of c.shows){ if(s.adv) continue; for(var i=0;i<s.eps.length;i++){ var e=s.eps[i];
        if(e[2]>1200 && !__otr.hasEnh({showId:s.id,epIndex:i,isAd:false})) return {sid:s.id, i:i, name:s.name, title:e[0], key:__otr.epKey(s.id,i)}; } } })()''')
    print('   episode:', pick)

    # --- a quick sample does not land in continue listening
    pg.evaluate(f'__otr.playEpisode("{pick["sid"]}", {pick["i"]})'); pg.wait_for_function(PLAYING, timeout=45000)
    pg.evaluate(f'{A}.currentTime = {A}.duration*0.4'); pg.wait_for_timeout(2500)
    pg.evaluate(f'{A}.pause()'); pg.wait_for_timeout(300)
    ck('a short listen is not saved', pick['key'] not in pg.evaluate('__otr.prog()'))

    # --- real listening (simulated 2+ minutes) is saved and resumes
    pg.evaluate('__otr.state.hListen = 130'); pg.evaluate(f'{A}.play()'); pg.wait_for_timeout(1500)
    pg.evaluate(f'{A}.pause()'); pg.wait_for_timeout(300)
    prog = pg.evaluate('__otr.prog()')
    ck('pausing after a real listen saves the spot', pick['key'] in prog and 0.38 < prog[pick['key']][0] < 0.45, prog.get(pick['key']))
    pg.reload(); ready(pg)
    chips = pg.eval_on_selector_all('#contRow .chip.cont', 'els=>els.map(e=>[e.dataset.key, e.querySelector(".c-left").textContent])')
    ck('continue listening row shows it after reload', any(c[0] == pick['key'] and c[1].endswith('left') for c in chips), chips)
    ck('continue row visible', pg.evaluate('!document.getElementById("contWrap").hidden'))
    pg.click(f'#contRow .chip.cont[data-key="{pick["key"]}"]'); pg.wait_for_function(PLAYING, timeout=45000); pg.wait_for_timeout(800)
    frac = pg.evaluate(f'{A}.currentTime/{A}.duration')
    ck('tapping it resumes at the saved spot', 0.37 < frac < 0.47, frac)
    ck('resume toast explains how to start over', 'Prev starts it over' in pg.inner_text('#toast'), pg.inner_text('#toast'))
    pg.click('#prevBtn'); pg.wait_for_timeout(600)
    ck('Prev restarts from the top', pg.evaluate(f'{A}.currentTime') < 3)

    # --- heard: play through the end from a resumed spot
    pg.evaluate('__otr.state.hResumed = true')
    pg.evaluate(f'{A}.currentTime = {A}.duration-4'); pg.wait_for_function(f'__otr.heard()["{pick["key"]}"]', timeout=20000)
    ck('finishing marks it heard', bool(pg.evaluate(f'__otr.heard()["{pick["key"]}"]')))
    ck('heard episode leaves continue listening', pick['key'] not in pg.evaluate('__otr.prog()'))

    # --- joining a live channel near the end does not mark heard
    a = pg.evaluate('__otr.onAirNow("crime")')
    ckey = pg.evaluate(f'__otr.epKey("{a["showId"]}", {a["epIndex"]})') if a and not a['isAd'] else None
    pg.click('#channelChips .station[data-ch="crime"]'); pg.wait_for_function(PLAYING, timeout=45000); pg.wait_for_timeout(1500)
    ck('live channel joins at the clock, not a saved spot', pg.evaluate('__otr.state.live'))
    pg.evaluate('__otr.state.hStart = 0.8; __otr.state.hResumed = false')
    k_now = pg.evaluate('(function(){var i=__otr.state.queue[__otr.state.qi]; return i.isAd?null:__otr.epKey(i.showId,i.epIndex)})()')
    if k_now:
        pg.evaluate(f'{A}.currentTime = {A}.duration-3'); pg.wait_for_function(f'__otr.state.hk!=="{k_now}"', timeout=20000)
        ck('catching only the last part of a live show is not "heard"', not pg.evaluate(f'!!__otr.heard()["{k_now}"]'))

    # --- search shows the heard mark
    pg.click('#searchBtn'); pg.wait_for_timeout(300)
    pg.wait_for_function('__otr.searchResults("x")!==null', timeout=20000)
    word = re.sub(r'[^A-Za-z ]', ' ', pick['title']).split()
    word = max(word, key=len) if word else pick['title']
    pg.evaluate(f'__otr.searchResults({json.dumps(word)})'); pg.wait_for_timeout(300)
    marks = pg.eval_on_selector_all('#results .result', 'els=>els.map(e=>e.innerText)')
    ck('search results mark the heard episode', any('heard' in m and pick['title'][:20].lower() in m.lower() for m in marks), marks[:3])
    pg.keyboard.press('Escape'); pg.evaluate('document.getElementById("searchPanel").classList.remove("open")')

    # --- Surprise me skips heard episodes
    small = pg.evaluate('''(function(){ var c=__otr.catalog(); var s=c.shows.filter(function(s){return !s.adv && s.eps.length>=8 && s.eps.length<=30;})[0];
      return {sid:s.id, n:s.eps.length}; })()''')
    pg.evaluate(f'''(function(){{ var s=__otr.catalog().shows.filter(function(x){{return x.id=="{small["sid"]}"}})[0];
      for(var i=2;i<s.eps.length;i++) __otr.markHeard(__otr.epKey(s.id,i)); }})()''')
    q = pg.evaluate(f'''(function(){{ __otr.startRandom(["{small["sid"]}"], "test"); return __otr.state.queue.filter(function(x){{return !x.isAd}}).map(function(x){{return x.epIndex}}); }})()''')
    ck('Surprise me prefers unheard episodes', len(q) >= 2 and set(q[:2]) <= {0, 1}, q[:6])
    ck('Surprise me does not repeat within a shuffle', len(q) == len(set(q)), q)

    # --- episode link
    pg.evaluate(f'__otr.playEpisode("{pick["sid"]}", {pick["i"]}, 300)'); pg.wait_for_function(PLAYING, timeout=45000); pg.wait_for_timeout(800)
    ck('playEpisode with a start second seeks there', 295 <= pg.evaluate(f'{A}.currentTime') <= 315, pg.evaluate(f'{A}.currentTime'))
    pg.click('#linkBtn'); pg.wait_for_timeout(500)
    link = pg.evaluate('__otr.state.lastLink')
    ck('link has the episode key and time', link and f'?e={pick["key"]}&t=' in link, link)
    clip = pg.evaluate('navigator.clipboard.readText()')
    ck('link copied to the clipboard', clip == link, (clip, link))
    t = int(re.search(r't=(\d+)', link).group(1))
    p2 = ctx.new_page(); e2 = []; p2.on('pageerror', lambda e: e2.append(str(e)))
    p2.goto(link); ready(p2)
    info = p2.evaluate('__otr.currentInfo()')
    ck('opening the link cues that episode', info and info['title'] == pick['title'], info)
    p2.wait_for_function(f'{A}.currentTime>0', timeout=45000); p2.wait_for_timeout(800)
    ck('and starts at the linked moment', t - 3 <= p2.evaluate(f'{A}.currentTime') <= t + 20, (t, p2.evaluate(f'{A}.currentTime')))
    p3 = ctx.new_page(); p3.goto(BASE + '?e=quiet-please.00000000'); ready(p3)
    ck('a stale link says so instead of failing silently', 'no longer matches' in p3.inner_text('#toast'), p3.inner_text('#toast'))

    # --- clear history with undo
    pg.click('#histClear'); pg.wait_for_timeout(200)
    ck('clear history empties both stores', not pg.evaluate('Object.keys(__otr.prog()).length+Object.keys(__otr.heard()).length'))
    ck('no page errors', not errs and not e2, errs + e2)

    m = b.new_context(viewport={'width': 375, 'height': 800}).new_page()
    m.add_init_script('localStorage.setItem("otr_prog", JSON.stringify({"%s":[0.5, 1790000000]}))' % pick['key'])
    m.goto(URL); ready(m)
    ck('mobile: continue chip renders', m.eval_on_selector_all('#contRow .chip.cont', 'els=>els.length') == 1)
    ck('mobile: no horizontal scroll', m.evaluate('document.documentElement.scrollWidth') <= 375)
    SP = os.environ.get('SP', '/tmp')
    m.screenshot(path=f'{SP}/otr_history_mobile.png')
    b.close()
print('FAILS', F); import sys; sys.exit(1 if F else 0)
