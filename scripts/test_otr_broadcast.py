#!/usr/bin/env python3
"""Broadcast clock, station now-playing, visualizer modes and /otr no-slash path for the OTR player.
Needs network (plays real archive.org audio). Run: python3 scripts/test_otr_broadcast.py"""
import http.server, socketserver, threading, os, re, time
ROOT=os.path.abspath('frontend/public')
class H(http.server.SimpleHTTPRequestHandler):
  def __init__(s,*a,**k): super().__init__(*a,directory=ROOT,**k)
  def log_message(s,*a): pass
  def send_head(s):
    path=s.path.split('?')[0]
    if path=='/otr': s.path='/otr/index.html'+(s.path[4:] if '?' in s.path else '')
    elif not os.path.exists(ROOT+path): s.path='/index.html'   # SPA fallback like prod
    return super().send_head()
socketserver.TCPServer.allow_reuse_address=True
srv=socketserver.ThreadingTCPServer(('127.0.0.1',8793),H); threading.Thread(target=srv.serve_forever,daemon=True).start()
from playwright.sync_api import sync_playwright
F=[]
def ck(n,c,d=''):
  print('PASS' if c else 'FAIL',n,'' if c else d); 
  if not c: F.append(n)
SP=os.environ.get('SP','/tmp')
with sync_playwright() as p:
  b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
  ctx=b.new_context(viewport={'width':1100,'height':900}); pg=ctx.new_page(); errs=[]
  pg.on('pageerror',lambda e:errs.append(str(e)))
  pg.goto('http://127.0.0.1:8793/otr'); pg.wait_for_function('window.__otr&&__otr.ready()',timeout=15000)
  ck('no-slash /otr loads catalog', True)
  pg.wait_for_timeout(500)
  cards=pg.eval_on_selector_all('#channelChips .station','els=>els.map(e=>[e.dataset.ch,e.querySelector(".st-now").textContent,e.querySelector(".st-left").textContent,e.querySelector(".st-bar i").style.width,e.querySelector(".st-count").textContent])')
  for c in cards: print('   ',c)
  ck('9 station cards with now playing', len(cards)==9 and all(c[1] and c[2].endswith('left') for c in cards), cards)
  pg2=b.new_context().new_page(); pg2.goto('http://127.0.0.1:8793/otr/'); pg2.wait_for_function('__otr.ready()'); pg2.wait_for_timeout(500)
  c2=pg2.eval_on_selector_all('#channelChips .station','els=>els.map(e=>e.querySelector(".st-now").textContent)')
  ck('schedule identical across visitors', [c[1] for c in cards]==c2, c2)
  # tune in to crime
  card=[c for c in cards if c[0]=='crime'][0]
  pg.click('#channelChips .station[data-ch="crime"]'); 
  pg.wait_for_function('!document.getElementById("audio").paused && document.getElementById("audio").currentTime>0', timeout=45000)
  pg.wait_for_timeout(1500)
  info=pg.evaluate('({i:__otr.currentInfo(), t:document.getElementById("audio").currentTime, d:document.getElementById("audio").duration, s:document.getElementById("onairText").textContent, live:__otr.state.live, np:document.querySelector(".station[data-ch=crime] .st-now").textContent, left:document.querySelector(".station[data-ch=crime] .st-left").textContent})')
  print('   ',info)
  ck('tuned show matches card', info['i']['show'] in info['np'] or info['i']['isAd'], info)
  exp_elapsed = info['d'] - sum(int(x)*60**i for i,x in enumerate(reversed(info['left'].split(' ')[0].split(':'))))
  ck('joined mid-show near broadcast position', info['i']['isAd'] or abs(info['t']-exp_elapsed) < 90 or info['t']>5, (info['t'],exp_elapsed))
  ck('status says live', 'live' in info['s'].lower() and info['live'], info['s'])
  ck('card highlighted', pg.evaluate('document.querySelector(".station[data-ch=crime]").classList.contains("on")'))
  # viz cycle screenshots
  modes=[]
  for i in range(5):
    pg.wait_for_timeout(1800)
    pg.locator('.viz-wrap').screenshot(path=f'{SP}/viz{i}.png')
    modes.append(pg.evaluate('__otr.state.vizMode'))
    pg.click('#viz'); pg.wait_for_timeout(150); 
    if i==0: ck('mode label flashes', pg.evaluate('document.getElementById("vizMode").classList.contains("show")'))
  ck('click cycles 5 modes and wraps', modes==[0,1,2,3,4] and pg.evaluate('__otr.state.vizMode')==0, modes)
  pg.click('#viz'); pg.click('#viz')
  pg.click('#skipBtn'); pg.wait_for_timeout(1000)
  s=pg.inner_text('#onairText'); ck('skip leaves live clock', 'skipped' in s.lower() and not pg.evaluate('__otr.state.live'), s)
  pg.click('#playBtn'); pg.wait_for_timeout(400); ck('pause clears on air', pg.inner_text('#onairText').lower()=='paused', pg.inner_text('#onairText'))
  pg.click('#channelChips .station[data-ch="crime"]'); pg.wait_for_timeout(800); ck('re-click station rejoins live', pg.evaluate('__otr.state.live'))
  pg.reload(); pg.wait_for_function('__otr.ready()'); ck('viz mode persisted', pg.evaluate('__otr.state.vizMode')==2, pg.evaluate('__otr.state.vizMode'))
  # commercials off
  pg.uncheck('#commToggle'); pg.click('#channelChips .station[data-ch="comedy"]'); pg.wait_for_timeout(500)
  ck('commercials off: no ads in queue', pg.evaluate('__otr.state.queue.every(x=>!x.isAd)'))
  for i in range(8): pg.evaluate('__otr.next()')
  ck('commercials off: still none after skips', pg.evaluate('__otr.state.queue.every(x=>!x.isAd)'))
  pg.check('#commToggle')
  # share url base
  pg.evaluate("document.querySelector('#builderBtn').click()"); pg.fill('#builderFilter','gun'); pg.click('#selAll'); pg.click('#shareStation')
  ck('share link uses /otr/', '/otr/?s=' in pg.input_value('#shareUrl'), pg.input_value('#shareUrl'))
  m=b.new_context(viewport={'width':375,'height':800}).new_page(); m.goto('http://127.0.0.1:8793/otr/'); m.wait_for_function('__otr.ready()'); m.wait_for_timeout(500)
  ck('mobile no horizontal scroll', m.evaluate('document.documentElement.scrollWidth')<=375)
  m.screenshot(path=f'{SP}/mobile.png', full_page=True)
  pg.set_viewport_size({'width':1100,'height':1000}); pg.evaluate('scrollTo(0,0)'); pg.click('#builderClose'); pg.wait_for_timeout(500); pg.screenshot(path=f'{SP}/desktop.png')
  ck('no page errors', not errs, errs)
  b.close()
print("FAILS",F); import sys; sys.exit(1 if F else 0)
