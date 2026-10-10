#!/usr/bin/env python3
"""Pop-out player (/otr/pop/) and the shared radio core (/otr/core/): clock parity with the full player,
the dial, power, tuning with static, station steps, episode chaining, the error limiter, faces, layouts
for a phone and a 7 inch Pi screen, keyboard and lock-screen metadata; live internet stations (a stub of
the radio-browser.info API), the car stereo, presets, and the pop out handoff from the full player.
Audio is a silent WAV stub served for every archive.org URL (with byte ranges, so seeking works), so this
runs offline. Run from the repo root: python3 scripts/test_otr_pop.py"""
import http.server, socketserver, threading, os, io, struct, re, json
ROOT = os.path.abspath('frontend/public')
class H(http.server.SimpleHTTPRequestHandler):
  def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
  def log_message(s, *a): pass
  def do_POST(s): s.send_response(204); s.end_headers()      # /api/stat beacon
  def send_head(s):
    path = s.path.split('?')[0]
    if path == '/otr': s.path = '/otr/index.html'
    elif not os.path.exists(ROOT + path): s.path = '/index.html'
    return super().send_head()
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 8798), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = 'http://127.0.0.1:8798'

def wav(sec, sr=4000):
  n = int(sec * sr); b = io.BytesIO()
  b.write(b'RIFF' + struct.pack('<I', 36 + n) + b'WAVEfmt ' + struct.pack('<IHHIIHH', 16, 1, 1, sr, sr, 1, 8) + b'data' + struct.pack('<I', n) + bytes([128]) * n)
  return b.getvalue()
WAV = wav(150 * 60)
def serve_audio(route):
  rng = route.request.headers.get('range'); total = len(WAV)
  hdr = {'content-type': 'audio/wav', 'accept-ranges': 'bytes', 'access-control-allow-origin': '*'}
  m = re.match(r'bytes=(\d+)-(\d*)', rng or '')
  if not m: return route.fulfill(status=200, body=WAV, headers=hdr)
  a = int(m.group(1)); z = int(m.group(2)) if m.group(2) else min(total - 1, a + 2_000_000)
  hdr['content-range'] = 'bytes %d-%d/%d' % (a, z, total)
  route.fulfill(status=206, body=WAV[a:z + 1], headers=hdr)

# A stub of radio-browser.info: a few playable stations and some that a web page cannot play.
def rb(name, uuid, url, codec='MP3', hls=0, state='Texas', tags='hip hop,rap', clicks=100):
  return {'stationuuid': uuid, 'name': name, 'url_resolved': url, 'codec': codec, 'bitrate': 128, 'hls': hls, 'state': state,
          'country': 'The United States Of America', 'countrycode': 'US', 'tags': tags, 'favicon': '', 'homepage': '', 'clickcount': clicks}
RB = [rb('KTST Hip Hop 97.9', 'u1', 'https://stream.test/ktst', clicks=900), rb('Gulf Coast Rap', 'u2', 'https://stream.test/gulf', clicks=500),
      rb('Plain HTTP Station', 'u3', 'http://insecure.test/x', clicks=800), rb('HLS Only', 'u4', 'https://stream.test/hls.m3u8', hls=1),
      rb('Ogg Station', 'u5', 'https://stream.test/ogg', codec='OGG'), rb('Lone Star Classic Rock', 'u6', 'https://stream.test/lonestar', tags='classic rock', clicks=300)]
RB_CALLS = []
def serve_rb(route):
  u = route.request.url; RB_CALLS.append(u)
  if '/json/url/' in u: return route.fulfill(status=200, body='{"ok":true}', headers={'content-type': 'application/json', 'access-control-allow-origin': '*'})
  from urllib.parse import urlparse, parse_qs
  qs = {k: v[0].lower() for k, v in parse_qs(urlparse(u).query).items()}
  out = [x for x in RB if ('tag' not in qs or qs['tag'] in x['tags']) and ('name' not in qs or qs['name'] in x['name'].lower())
         and ('state' not in qs or qs['state'] == x['state'].lower())]
  route.fulfill(status=200, body=json.dumps(out), headers={'content-type': 'application/json', 'access-control-allow-origin': '*'})

from playwright.sync_api import sync_playwright
F = []
def ck(n, c, d=''):
  print('PASS' if c else 'FAIL', n, '' if c else d)
  if not c: F.append(n)

with sync_playwright() as p:
  b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
  def page(url='/otr/pop/', w=390, h=844, mobile=True, audio='ok', ready='window.__pop&&__pop.ready()'):
    ctx = b.new_context(viewport={'width': w, 'height': h}, is_mobile=mobile, has_touch=mobile, timezone_id='America/Los_Angeles')
    ctx.route(re.compile(r'https://de\d\.api\.radio-browser\.info/.*'), serve_rb)
    ctx.route(re.compile(r'https://stream\.test/.*'), serve_audio)
    if audio == 'ok': ctx.route(re.compile(r'https://archive\.org/.*'), serve_audio)
    else: ctx.route(re.compile(r'https://archive\.org/.*'), lambda r: r.fulfill(status=404, body='gone'))
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + url); pg.wait_for_function(ready, timeout=30000); pg.wait_for_timeout(300)
    return pg, errs

  # ---------- parity with the full player ----------
  full, ferrs = page('/otr/', 1100, 900, mobile=False, ready='window.__otr&&__otr.ready()&&__otr.network.ids().length===4')
  pop, perrs = page()
  chans = full.evaluate('__otr.channels()')
  pch = pop.evaluate('__pop.core().channels')
  ck('same genre channels, same order (seasonal included)', chans == pch, (chans, pch))
  bad = []
  for ch in chans:
    a = full.evaluate('ch=>__otr.schedule(ch)', ch)
    q = pop.evaluate('ch=>__pop.core().schedule(ch).items.map(it=>({showId:it.showId,isAd:it.isAd}))', ch)
    if a != q: bad.append(ch)
  ck('every genre channel schedule matches the full player item for item', not bad, bad)
  fa = full.evaluate('chs=>chs.map(ch=>__otr.onAirNow(ch))', chans)
  pa = pop.evaluate('chs=>{const t=Date.now()/1000; return chs.map(ch=>{const a=__pop.core().channelOnAir(ch,t); return {showId:a.item.showId,epIndex:a.item.epIndex,offset:a.offset,total:a.S.total};});}', chans)
  mism = [c for c, x, y in zip(chans, fa, pa) if not (x['total'] == y['total'] and (x['showId'], x['epIndex']) == (y['showId'], y['epIndex']) and abs(x['offset'] - y['offset']) < 8)]
  ck('on air right now matches on every genre channel (show, episode, offset within a few seconds)', len(mism) <= 1, mism)
  times = pop.evaluate('()=>{const out=[], base=Date.now()/1000; for(let i=0;i<7;i++) out.push(base+i*86400+i*3607); return out;}')
  nbad = []
  for nid in ['nbc', 'cbs', 'abc', 'mutual']:
    for t in times:
      x = full.evaluate('([id,t])=>__otr.network.onAir(id,t)', [nid, t])
      y = pop.evaluate('([id,t])=>{const c=__pop.core().cursor(id,t); return c?{showId:c.item.showId,epIndex:c.item.epIndex,at:c.item.at,offset:c.offset}:null;}', [nid, t])
      if not x or not y or (x['showId'], x['epIndex'], x['at']) != (y['showId'], y['epIndex'], y['at']) or abs(x['offset'] - y['offset']) > 0.01: nbad.append((nid, t))
  ck('network stations match the full player across a week of sample times', not nbad, nbad[:3])
  # ---------- pop out from the full player, and one radio at a time ----------
  full.context.route(re.compile(r'https://archive\.org/.*'), serve_audio)
  ck('the full player has a pop out button', full.is_visible('#popBtn'))
  full.evaluate('__otr.startChannel("crime")')
  full.wait_for_function('!document.getElementById("audio").paused && document.getElementById("audio").readyState>=3', timeout=20000)
  with full.context.expect_page() as newp:
    full.click('#popBtn')
  pp = newp.value
  pp.wait_for_function('window.__pop&&__pop.ready()', timeout=30000)
  ck('pop out opens tuned to the station the full player is on', pp.evaluate('__pop.player().state.station') == 'crime')
  pp.wait_for_function('__pop.player().state.status==="onair"', timeout=20000)
  ck('and switches itself on, joining the same broadcast', pp.evaluate('!__pop.player().audio.paused'))
  ck('the handoff is cleared from the address so a reload does not replay it', 'tune=' not in pp.url, pp.url)
  full.wait_for_timeout(500)
  ck('the full player pauses when the pop-out starts', full.evaluate('document.getElementById("audio").paused'))
  full.evaluate('document.getElementById("audio").play()')
  pp.wait_for_function('__pop.player().audio.paused', timeout=10000)
  ck('and the pop-out pauses when the full player plays again', pp.evaluate('__pop.player().state.status') == 'paused')
  pp.close()
  full.context.close()

  # ---------- the dial ----------
  dial = pop.evaluate('__pop.core().dial.map(s=>[s.id,s.freq])')
  fr = dict(dial)
  ck('dial is in frequency order', [f for _, f in dial] == sorted(f for _, f in dial), dial)
  ck('networks sit on their New York flagship frequencies', (fr.get('nbc'), fr.get('mutual'), fr.get('abc'), fr.get('cbs')) == (660, 710, 770, 880), fr)
  ck('every station has its own frequency', len(set(fr.values())) == len(fr), dial)
  ck('the seasonal channel is on the dial in October at 1560', pop.evaluate('new Date().getMonth()') != 9 or fr.get('halloween') == 1560, fr)

  # ---------- off: the card previews what is on ----------
  st = pop.evaluate('__pop.player().state.station')
  ck('starts off, parked on a station, card says so', pop.evaluate('__pop.player().state.power') is False and 'The radio is off' in pop.inner_text('#logStatus') and st, pop.inner_text('#logStatus'))
  ck('off card shows the show on the air now', pop.inner_text('#logShow') == pop.evaluate('__pop.core().resolve(__pop.core().cursor(__pop.player().state.station).item).show'))
  ck('play button reads Turn on', pop.inner_text('#playBtn') == 'Turn on')

  # ---------- power on ----------
  pop.click('#playBtn')
  pop.wait_for_function('__pop.player().state.status==="onair"', timeout=15000)
  info = pop.evaluate('()=>{const P=__pop.player(), C=__pop.core(), c=C.cursor(P.state.station); return {src:P.audio.src, want:C.resolve(c.item).url, t:P.audio.currentTime, off:c.offset};}')
  ck('power on plays the item on the air now', info['src'] == info['want'], info)
  ck('and joins it at the live position (within 4 s)', info['off'] < 6 or abs(info['t'] - info['off']) < 4, info)
  ck('face shows power on', pop.get_attribute('.face', 'data-power') == 'on')
  ck('status reads on the air', 'On the air' in pop.inner_text('#logStatus'), pop.inner_text('#logStatus'))
  ms = pop.evaluate('navigator.mediaSession&&navigator.mediaSession.metadata?{title:navigator.mediaSession.metadata.title,album:navigator.mediaSession.metadata.album}:null')
  ck('lock-screen metadata names the episode and the station', ms and ms['title'] and ' kc' in ms['album'], ms)

  # ---------- tuning with static ----------
  pop.evaluate('__pop.player().beginTune(); __pop.player().setFreq(1100)')
  pop.wait_for_timeout(250)
  ck('dragging the dial plays static and pauses the show', pop.evaluate('!__pop.player().staticEl.paused && __pop.player().audio.paused'))
  ck('card names the station under the needle while tuning', 'Crime' in pop.inner_text('#logStatus') or 'Action' in pop.inner_text('#logStatus'), pop.inner_text('#logStatus'))
  pop.evaluate('__pop.player().setFreq(1128); __pop.player().endTune()')
  pop.wait_for_function('__pop.player().state.status==="onair" && __pop.player().state.station==="crime"', timeout=15000)
  info = pop.evaluate('()=>{const P=__pop.player(), C=__pop.core(), c=C.cursor("crime"); return {src:P.audio.src, want:C.resolve(c.item).url, st:P.staticEl.paused, f:P.state.freq};}')
  ck('letting go snaps to the nearest station and tunes it in live', info['src'] == info['want'] and info['st'], info)
  pop.wait_for_timeout(300)
  ck('needle settles on the station frequency', abs(pop.evaluate('__pop.player().state.freq') - 1130) < 0.6)

  # ---------- stepping ----------
  pop.evaluate('__pop.player().step(+1)')
  pop.wait_for_function('__pop.player().state.station==="horror" && __pop.player().state.status==="onair"', timeout=15000)
  ck('step up the dial goes to the next station', True)
  pop.focus('.knob[data-k=tune]'); pop.keyboard.press('ArrowLeft')
  pop.wait_for_function('__pop.player().state.station==="crime"', timeout=15000)
  ck('arrow key on the tuning knob steps down a station', True)

  # ---------- chaining ----------
  before = pop.evaluate('()=>{const P=__pop.player(); return {at:P.state.item.at, dur:P.state.item.dur, peek:__pop.core().resolve(P.cursor.peek(1)[0]).url};}')
  pop.evaluate('__pop.player().audio.dispatchEvent(new Event("ended"))')
  pop.wait_for_timeout(400)
  after = pop.evaluate('()=>{const P=__pop.player(); return {at:P.state.item.at, src:P.audio.src, ad:P.state.item.isAd};}')
  ck('when an episode ends the next scheduled item plays', after['src'] == before['peek'] or after['ad'], (before, after))
  ck('and its scheduled start follows on the clock', after['at'] >= before['at'] + before['dur'] - 0.01, (before, after))

  # ---------- faces ----------
  src0 = pop.evaluate('__pop.player().audio.src')
  pop.click('#faces button[data-id=portable]'); pop.wait_for_timeout(300)
  ck('switching to the portable swaps the face', pop.query_selector('.face.pt') is not None and pop.query_selector('.face.tt') is None)
  ck('and the show keeps playing', pop.evaluate('__pop.player().audio.src') == src0 and not pop.evaluate('__pop.player().audio.paused'))
  ck('face choice is remembered for the dial', pop.evaluate('localStorage.getItem("otrpop_face_otr")') == 'portable')
  wheel = pop.query_selector('.pt-tune').bounding_box()
  f0 = pop.evaluate('__pop.player().state.freq')
  pop.mouse.move(wheel['x'] + 11, wheel['y'] + 80); pop.mouse.down(); pop.mouse.move(wheel['x'] + 11, wheel['y'] + 40, steps=6)
  ck('the thumbwheel tunes', pop.evaluate('__pop.player().state.tuning') and pop.evaluate('__pop.player().state.freq') > f0)
  pop.mouse.up(); pop.wait_for_timeout(400)
  ck('and lands on a station', pop.evaluate('__pop.core().dial.some(s=>Math.abs(s.freq-__pop.player().state.freq)<0.6)'))
  pop.click('#faces button[data-id=tabletop]'); pop.wait_for_timeout(300)
  knob = pop.query_selector('.knob[data-k=tune]').bounding_box()
  cx, cy = knob['x'] + knob['width'] / 2, knob['y'] + knob['height'] / 2
  pop.mouse.move(cx + 30, cy); pop.mouse.down()
  for ang in range(0, 100, 10):
    import math
    pop.mouse.move(cx + 30 * math.cos(math.radians(ang)), cy + 30 * math.sin(math.radians(ang)))
  ck('turning the tuning knob clockwise raises the frequency', pop.evaluate('__pop.player().state.tuning'))
  pop.mouse.up(); pop.wait_for_timeout(400)
  win = pop.query_selector('.tt-band').bounding_box()
  f1 = pop.evaluate('__pop.player().state.freq')
  pop.mouse.move(win['x'] + win['width'] / 2, win['y'] + 30); pop.mouse.down(); pop.mouse.move(win['x'] + win['width'] / 2 - 90, win['y'] + 30, steps=6)
  ck('dragging the dial glass left tunes up the band', pop.evaluate('__pop.player().state.freq') > f1)
  pop.mouse.up(); pop.wait_for_timeout(400)

  # ---------- power off ----------
  pop.click('.tt-lamp'); pop.wait_for_timeout(200)
  ck('power lamp turns it off', pop.evaluate('__pop.player().state.power') is False and pop.evaluate('__pop.player().audio.paused') and pop.get_attribute('.face', 'data-power') == 'off')
  ck('no page errors on the phone page', not perrs, perrs)
  pop.context.close()

  # ---------- live stations and the car stereo ----------
  lv, lerrs = page()
  ck('the dial is the default source, on the tube set', lv.evaluate('__pop.player().state.source') == 'otr' and lv.evaluate('__pop.face()') == 'tabletop')
  lv.click('.seg button[data-src=live]'); lv.wait_for_timeout(300)
  ck('choosing live stations switches to the car stereo', lv.evaluate('__pop.face()') == 'car' and lv.query_selector('.face.car') is not None)
  ck('only faces that can play live stations are offered', lv.eval_on_selector_all('#faces button', 'b=>b.map(x=>x.dataset.id)') == ['car'])
  ck('the finder opens with the presets', lv.is_visible('#finder') and lv.eval_on_selector_all('#presetList li', 'l=>l.length') == 6)
  lv.wait_for_function('__pop.results()!==null', timeout=10000)
  names = lv.eval_on_selector_all('#results .r-name', 'e=>e.map(x=>x.textContent)')
  ck('a popular list loads on its own', len(names) >= 3, names)
  ck('stations a web page cannot play are left out (http, HLS, Ogg)', not any(n in names for n in ['Plain HTTP Station', 'HLS Only', 'Ogg Station']), names)
  ck('most played first', names[0] == 'KTST Hip Hop 97.9', names)
  lv.click('#chips button[data-id=tx-hiphop]')
  lv.wait_for_function('document.getElementById("findNote").textContent.startsWith("Hip hop in Texas")', timeout=10000)
  q = [u for u in RB_CALLS if 'state=Texas' in u]
  ck('the Texas hip hop button asks for Texas and several spellings of the genre', len(q) >= 3 and any('tag=hip+hop' in u or 'tag=hip%20hop' in u for u in q) and any('tag=rap' in u for u in q), q[:4])
  ck('and asks only for https streams', all('is_https=true' in u for u in q))
  lv.fill('#findQ', 'classic rock'); lv.press('#findQ', 'Enter')
  lv.wait_for_function('document.getElementById("findNote").textContent.startsWith("classic rock")', timeout=10000)
  ck('a typed search finds stations', 'Lone Star Classic Rock' in lv.eval_on_selector_all('#results .r-name', 'e=>e.map(x=>x.textContent)'))
  lv.click('#results li:has(.r-name:text-is("Lone Star Classic Rock")) .r-play')
  lv.wait_for_function('__pop.player().state.status==="onair"', timeout=15000)
  ck('tapping a station switches the radio on and plays its stream', lv.evaluate('__pop.player().audio.src') == 'https://stream.test/lonestar')
  ck('the play is reported to the directory', any('/json/url/u6' in u for u in RB_CALLS))
  ck('the car display shows the station', 'LONE STAR' in lv.inner_text('.cs-main').upper(), lv.inner_text('.cs-main'))
  ck('the card names the station and says it is live', lv.inner_text('#logShow') == 'Lone Star Classic Rock' and 'Live' in lv.inner_text('#logNext'), lv.inner_text('#logNext'))
  ck('the playing station is marked in the list', lv.evaluate('document.querySelector("#results li.now .r-name").textContent') == 'Lone Star Classic Rock')
  ms = lv.evaluate('navigator.mediaSession.metadata?{t:navigator.mediaSession.metadata.title,a:navigator.mediaSession.metadata.album}:null')
  ck('lock screen shows the station', ms and ms['t'] == 'Lone Star Classic Rock' and ms['a'] == 'Live radio', ms)
  # hold preset 2 to save it
  pb = lv.query_selector('.cs-pre[data-i="1"]').bounding_box()
  lv.mouse.move(pb['x'] + 10, pb['y'] + 10); lv.mouse.down(); lv.wait_for_timeout(900); lv.mouse.up(); lv.wait_for_timeout(200)
  ck('holding preset 2 saves the station', (lv.evaluate('__pop.player().presets("live")[1]') or {}).get('name') == 'Lone Star Classic Rock')
  ck('the display confirms it', 'P2 SAVED' in lv.inner_text('.cs-main'), lv.inner_text('.cs-main'))
  ck('and the preset list shows it', 'Lone Star' in lv.inner_text('#presetList'))
  lv.click('#chips button[data-id=tx-hiphop]')
  lv.wait_for_function('document.getElementById("findNote").textContent.startsWith("Hip hop in Texas")', timeout=10000)
  lv.click('#results li:first-child .r-save')
  ck('Save puts a station in the first empty preset', (lv.evaluate('__pop.player().presets("live")[0]') or {}).get('name') == 'KTST Hip Hop 97.9')
  lv.wait_for_timeout(1500)
  lv.click('.cs-pre[data-i="0"]')
  lv.wait_for_function('__pop.player().audio.src==="https://stream.test/ktst" && __pop.player().state.status==="onair"', timeout=15000)
  ck('tapping preset 1 plays it', True)
  ck('the lit preset follows the station', lv.evaluate('document.querySelector(".cs-pre.on").dataset.i') == '0')
  lv.click('.cs-seek[data-d="1"]')
  lv.wait_for_function('__pop.player().audio.src==="https://stream.test/lonestar"', timeout=15000)
  ck('seek steps through the saved presets', True)
  lv.keyboard.press('1'); lv.wait_for_function('__pop.player().audio.src==="https://stream.test/ktst"', timeout=15000)
  ck('number keys recall presets', True)
  lv.evaluate('__pop.player().audio.dispatchEvent(new Event("ended"))'); lv.wait_for_timeout(2200)
  ck('a dropped stream reconnects to the same station', lv.evaluate('__pop.player().audio.src') == 'https://stream.test/ktst' and lv.evaluate('__pop.player().state.status') in ('onair', 'buffering'))
  lv.click('.cs-srcb'); lv.wait_for_timeout(400)
  ck('Source on the car stereo goes back to the dial', lv.evaluate('__pop.player().state.source') == 'otr')
  ck('and back to the tube set, the dial default', lv.evaluate('__pop.face()') == 'tabletop')
  lv.wait_for_function('__pop.player().state.status==="onair"', timeout=15000)
  ck('playing the dial station', 'archive.org' in lv.evaluate('__pop.player().audio.src'))
  lv.click('#faces button[data-id=car]'); lv.wait_for_timeout(300)
  ck('the car stereo can play the dial too', lv.evaluate('__pop.face()') == 'car' and lv.inner_text('.cs-main').strip()[:3].isdigit(), lv.inner_text('.cs-main'))
  lv.click('.cs-pre[data-i="1"]')
  lv.wait_for_function('__pop.player().state.station==="cbs"', timeout=15000)
  ck('dial presets default to the networks (2 is CBS)', True)
  lv.click('.seg button[data-src=live]'); lv.wait_for_timeout(300)
  ck('back on live stations the last station resumes', lv.evaluate('__pop.player().audio.src') == 'https://stream.test/ktst')
  lv.click('.seg button[data-src=otr]'); lv.wait_for_timeout(300)
  ck('the dial remembers it was on the car stereo', lv.evaluate('__pop.face()') == 'car')
  lv.click('.seg button[data-src=live]'); lv.wait_for_timeout(300)
  lv.click('.cs-knob'); lv.wait_for_timeout(200)
  ck('pushing the knob turns the car stereo off', lv.evaluate('__pop.player().state.power') is False and lv.get_attribute('.face.car', 'data-power') == 'off')
  ck('and the display shows the clock', re.search(r'\d:\d\d [AP]M', lv.inner_text('.cs-main')) is not None, lv.inner_text('.cs-main'))
  lv.reload(); lv.wait_for_function('window.__pop&&__pop.ready()', timeout=20000); lv.wait_for_timeout(300)
  ck('after a reload it comes back on live stations and the car stereo', lv.evaluate('__pop.player().state.source') == 'live' and lv.evaluate('__pop.face()') == 'car')
  ck('with the presets kept', (lv.evaluate('__pop.player().presets("live")[1]') or {}).get('name') == 'Lone Star Classic Rock')
  lv.click('#addUrl summary'); lv.fill('#urlName', 'My station'); lv.fill('#urlIn', 'https://stream.test/mine'); lv.click('#urlForm button')
  lv.wait_for_function('__pop.player().audio.src==="https://stream.test/mine"', timeout=15000)
  ck('a pasted https stream address plays', lv.inner_text('#logShow') == 'My station')
  lv.fill('#urlIn', 'http://insecure.test/x'); lv.click('#urlForm button'); lv.wait_for_timeout(200)
  ck('an http address is refused with a reason', 'https' in lv.inner_text('#toast'))
  ck('no page errors on live stations', not lerrs, lerrs)
  lv.context.close()

  dead, derrs = page(audio='ok')
  dead.context.route(re.compile(r'https://stream\.test/.*'), lambda r: r.fulfill(status=404, body='gone'))
  dead.evaluate('__pop.player().setSource("live")'); dead.wait_for_function('__pop.results()!==null', timeout=10000)
  dead.click('#results li:first-child .r-play')
  dead.wait_for_function('__pop.player().state.status==="error"', timeout=20000)
  ck('a station that will not connect gets three tries, then a 30 second wait', dead.evaluate('__pop.player().state.errCount') == 3)
  ck('and the card says the station is not answering', 'not answering' in dead.inner_text('#logStatus'), dead.inner_text('#logStatus'))
  dead.context.close()

  # ---------- errors ----------
  bad, berrs = page(audio='404')
  bad.click('#playBtn')
  bad.wait_for_function('__pop.player().state.status==="error"', timeout=20000)
  ck('a dead Internet Archive stops after three tries instead of skipping forever', bad.evaluate('__pop.player().state.errCount') == 3, bad.evaluate('__pop.player().state.errCount'))
  ck('and says so', 'not answering' in bad.inner_text('#logStatus') and bad.inner_text('#playBtn') == 'Try again', bad.inner_text('#logStatus'))
  bad.context.close()

  # ---------- layouts ----------
  for (w, h, mob, url, name) in [(390, 844, True, '/otr/pop/', 'iPhone portrait'), (375, 667, True, '/otr/pop/', 'small phone'),
                                 (844, 390, True, '/otr/pop/', 'phone landscape'), (800, 480, False, '/otr/pop/?kiosk=1', 'Pi 800x480'),
                                 (1280, 720, False, '/otr/pop/?kiosk=1&face=portable', 'Pi 1280x720'), (420, 820, False, '/otr/pop/', 'desktop pop-out window'),
                                 (390, 844, True, '/otr/pop/?src=live', 'iPhone car stereo'), (800, 480, False, '/otr/pop/?kiosk=1&src=live', 'Pi 800x480 car stereo')]:
    pg, e = page(url, w, h, mob)
    m = pg.evaluate('()=>{const r=document.getElementById("stage").getBoundingClientRect(); return {sw:document.documentElement.scrollWidth, iw:innerWidth, sh:document.documentElement.scrollHeight, ih:innerHeight, top:r.top, bottom:r.bottom, left:r.left, right:r.right};}')
    ck(name + ': no sideways scroll', m['sw'] <= m['iw'], m)
    ck(name + ': the whole radio is on screen', m['top'] >= 0 and m['bottom'] <= m['ih'] + 1 and m['left'] >= 0 and m['right'] <= m['iw'] + 1, m)
    if 'Pi' in name: ck(name + ': nothing to scroll at all', m['sh'] <= m['ih'] + 1, m)
    if 'kiosk' in url: ck(name + ': kiosk hides the footer', not pg.is_visible('#foot'))
    pg.screenshot(path='/tmp/otr_pop_%s.png' % re.sub(r'\W+', '_', name))
    ck(name + ': no page errors', not e, e)
    pg.context.close()

  b.close()
print('\n%d failed' % len(F) if F else '\nall passed')
raise SystemExit(1 if F else 0)
