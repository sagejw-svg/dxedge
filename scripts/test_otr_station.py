#!/usr/bin/env python3
"""Station mode (network stations, station.js) for the OTR player: the ABC card, the chain scheduler,
determinism across visitors and time zones, slot ownership, time-shift and rejoin, the guide.
Needs network for the two playback checks (real archive.org audio). Run: python3 scripts/test_otr_station.py
Set OTR_OFFLINE=1 to skip playback."""
import http.server, socketserver, threading, os, time, json
ROOT=os.path.abspath('frontend/public')
class H(http.server.SimpleHTTPRequestHandler):
  def __init__(s,*a,**k): super().__init__(*a,directory=ROOT,**k)
  def log_message(s,*a): pass
  def send_head(s):
    path=s.path.split('?')[0]
    if path=='/otr': s.path='/otr/index.html'+(s.path[4:] if '?' in s.path else '')
    elif not os.path.exists(ROOT+path): s.path='/index.html'
    return super().send_head()
socketserver.TCPServer.allow_reuse_address=True
srv=socketserver.ThreadingTCPServer(('127.0.0.1',8797),H); threading.Thread(target=srv.serve_forever,daemon=True).start()
from playwright.sync_api import sync_playwright
F=[]
def ck(n,c,d=''):
  print('PASS' if c else 'FAIL',n,'' if c else d)
  if not c: F.append(n)
OFFLINE=os.environ.get('OTR_OFFLINE')=='1'
with sync_playwright() as p:
  b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
  def page(tz='America/Los_Angeles', url='http://127.0.0.1:8797/otr/'):
    ctx=b.new_context(viewport={'width':1100,'height':900}, timezone_id=tz); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.goto(url)
    pg.wait_for_function('window.__otr&&__otr.ready()&&__otr.network.ids().length===4',timeout=20000); pg.wait_for_timeout(400)
    return pg, errs
  pg,errs=page()
  ck('station.js loaded and the four networks registered in order', pg.evaluate('__otr.network.ids()')==['nbc','cbs','abc','mutual'])
  cards4=pg.eval_on_selector_all('#networkChips .station','els=>els.map(e=>[e.dataset.net, e.querySelector(".st-now").textContent, e.querySelector(".st-left .l").textContent])')
  ck('every network card shows something on the air', len(cards4)==4 and all(c[1] and c[2].endswith('left') for c in cards4), cards4)
  def at(dow,h,m): return pg.evaluate('([d,h,m])=>{ const x=new Date(); x.setDate(x.getDate()+((d-x.getDay()+7)%7)); x.setHours(h,m,0,0); return x.getTime()/1000; }',[dow,h,m])
  nbc=pg.evaluate('t=>__otr.network.onAir("nbc",t)', at(2,21,40)); print('   nbc tue 9:40:', nbc)
  ck('NBC Tuesday 9:40 PM is the comedy block (Fibber McGee or a neighbour running over)', nbc and nbc['showId'] in ('fibber-mcgee-and-molly','amos-and-andy','the-bob-hope-show') and nbc['slot'] in (21*60, 21*60+30, 22*60), nbc)
  cbs=pg.evaluate('t=>__otr.network.onAir("cbs",t)', at(1,21,20)); print('   cbs mon 9:20:', cbs)
  ck('CBS Monday 9:20 PM is Lux Radio Theatre (or Talent Scouts fill running over)', cbs and (cbs['showId']=='lux-radio-theatre' or (cbs['fill'] and cbs['slot']==20*60+30)), cbs)
  mut=pg.evaluate('t=>__otr.network.onAir("mutual",t)', at(0,17,10)); print('   mutual sun 5:10:', mut)
  ck('Mutual Sunday 5:10 PM is The Shadow (or True Detective running over)', mut and mut['showId'] in ('the-shadow','true-detective-mysteries'), mut)
  late=pg.evaluate('t=>__otr.network.onAir("cbs",t)', at(3,22,50))
  ck('CBS late every night is the Radio Mystery Theater', late and late['showId'].startswith('cbs-radio-mystery-theater'), late)
  pg.click('#netGuidePick .gchip[data-net="mutual"]'); pg.wait_for_timeout(250)
  ck('guide picker switches the lineup to Mutual', 'Mutual Broadcasting' in pg.inner_text('#netGuideName') and pg.evaluate('document.querySelector("#netGuidePick .gchip.on").dataset.net')=='mutual' and pg.evaluate('document.querySelectorAll("#netGuideBody tr").length')>=10)
  pg.click('#netGuidePick .gchip[data-net="abc"]'); pg.wait_for_timeout(250)
  ck('harvested station-only shows registered (not in catalog)', pg.evaluate('__otr.network.extra().length')>=15 and pg.evaluate('__otr.catalog().shows.some(s=>s.st)')==False)
  ck('footer and builder unaffected by station-only shows', pg.evaluate('document.querySelectorAll("#showGrid .srow, #showGrid .show, #showGrid [data-id]").length')<=pg.evaluate('__otr.catalog().shows.length') and 'shows across' in pg.inner_text('#foot'))
  card=pg.eval_on_selector('#networkChips .station[data-net="abc"]','e=>({now:e.querySelector(".st-now").textContent,left:e.querySelector(".st-left .l").textContent,bar:e.querySelector(".st-bar i").style.width,next:e.querySelector(".st-next").textContent,count:e.querySelector(".st-count").textContent})')
  print('   card:',card)
  ck('ABC card shows now playing, time left, progress and up next', bool(card['now']) and card['left'].endswith('left') and card['bar'].endswith('%') and card['next'].startswith('then') and int(card['count'].split()[0])>=30, card)
  # --- scheduler semantics, evaluated in the page against the real grid ---
  # Friday 8:00 PM local belongs to The Fat Man; the item on air at 8:12 must be the slot owner or the one that
  # started inside it (chain rule: episodes run over), and never a weekday-daytime show.
  fri=pg.evaluate('''()=>{ const d=new Date(); d.setDate(d.getDate()+((5-d.getDay()+7)%7)); d.setHours(20,12,0,0); return d.getTime()/1000; }''')
  a=pg.evaluate('t=>__otr.network.onAir("abc",t)', fri)
  print('   friday 8:12 pm:', a)
  ck('Friday 8:12 PM is owned by a Friday evening slot (Fat Man / Lone Ranger run over)', a and a['showId'] in ('the-fat-man','the-lone-ranger') and a['slot'] in (19*60+30, 20*60), a)
  mon=pg.evaluate('''()=>{ const d=new Date(); d.setDate(d.getDate()+((1-d.getDay()+7)%7)); d.setHours(19,31,0,0); return d.getTime()/1000; }''')
  m=pg.evaluate('t=>__otr.network.onAir("abc",t)', mon)
  ck('Monday 7:31 PM: The Lone Ranger (or the quarter hour that ran over into it)', m and (m['showId']=='the-lone-ranger' or (m['fill'] and m['at']<mon-60 and m['at']>mon-20*60)), m)
  sun=pg.evaluate('''()=>{ const d=new Date(); d.setDate(d.getDate()+((0-d.getDay()+7)%7)); d.setHours(21,2,0,0); return d.getTime()/1000; }''')
  s=pg.evaluate('t=>__otr.network.onAir("abc",t)', sun)
  ck('Sunday 9:02 PM: Walter Winchell or the Stop the Music hour running over', s and s['showId'] in ('walter-winchell','stop-the-music'), s)
  # chain rule: consecutive items are contiguous and the next starts exactly when the previous ends
  up=pg.evaluate('t=>__otr.network.upcoming("abc",t,8)', fri)
  contiguous=all(up[i]['at']+up[i]['dur']==up[i+1]['at'] for i in range(len(up)-1))
  ck('chain is contiguous (next starts when the previous ends, no gaps, no ads)', len(up)==8 and contiguous and up[0]['at']==a['at']+a['dur'], up[:3])
  # a 30 minute slot holding two episodes: somewhere in the week two consecutive items share a 15-minute-serial slot owner
  wk=pg.evaluate('''()=>{ const N=__otr.network.station("abc"); const t=Date.now()/1000; const items=N.upcoming(t,400); let twice=0;
      for(let i=1;i<items.length;i++){ if(items[i].own===items[i-1].own && items[i].showId===items[i-1].showId && items[i].own.show) twice++; } return {n:items.length, twice}; }''')
  ck('a half hour slot sometimes fits two episodes of its show (chain rule)', wk['twice']>=5, wk)
  # determinism: a second visitor in the same zone hears the same thing; a different zone hears its own clock
  pg2,errs2=page()
  a2=pg2.evaluate('t=>__otr.network.onAir("abc",t)', fri)
  ck('same zone, second visitor: identical item at the same second', a2==a, (a,a2))
  pg3,errs3=page('America/New_York')
  ny=pg3.evaluate('''()=>{ const d=new Date(); d.setDate(d.getDate()+((5-d.getDay()+7)%7)); d.setHours(20,12,0,0); return __otr.network.onAir("abc", d.getTime()/1000); }''')
  ck('another zone runs the lineup on its own local clock (Friday 8:12 PM there is also a Friday evening slot)', ny and ny['slot'] in (19*60+30, 20*60), ny)
  # lineup / guide
  lu=pg.evaluate('__otr.network.lineup("abc", 5)')
  names=[r['name'] for r in lu]
  ck('Friday lineup lists the real ABC slots in order', 'The Lone Ranger' in names and 'The Fat Man' in names and 'This Is Your FBI' in names and names.index('The Fat Man')<names.index('This Is Your FBI'), names)
  ck('every lineup row carries a confidence class', all(r['conf'] in ('verified','likely','approx','fill') for r in lu))
  if not pg.evaluate('document.getElementById("netGuide").open'): pg.click('#netGuide summary')
  pg.wait_for_timeout(200)
  rows=pg.evaluate('Array.from(document.querySelectorAll("#netGuideBody tr")).length')
  ck('guide renders today\'s lineup with a highlighted current row', rows>=12 and pg.evaluate('document.querySelectorAll("#netGuideBody tr.now").length')==1, rows)
  # restore: tuning saves otr_last=net:abc; a reload cues the station (no autoplay) and Play tunes it
  if not OFFLINE:
    pg.click('#networkChips .station[data-net="abc"]')
    pg.wait_for_function('!document.getElementById("audio").paused && document.getElementById("audio").currentTime>0', timeout=60000)
    pg.wait_for_timeout(1200)
    st=pg.evaluate('({live:__otr.state.live, net:__otr.state.network, status:document.getElementById("onairText").textContent, cur:__otr.currentInfo(), ct:document.getElementById("audio").currentTime, slot:document.getElementById("npSlot").textContent, q:__otr.network.queue().length})')
    print('   tuned:',st)
    now_air=pg.evaluate('__otr.network.onAir("abc")')
    cur_id=pg.evaluate('__otr.network.queue()[__otr.state.qi].showId')
    ck('tuning in joins the item on air, live, with the slot line shown', st['live'] and st['net']=='abc' and 'ABC live' in st['status'] and cur_id==now_air['showId'] and st['slot'].startswith('ABC'), (st, now_air))
    ck('joined mid-episode near the clock position (within 25 s)', abs(st['ct']-now_air['offset'])<25 or now_air['offset']<=5, (st['ct'], now_air['offset']))
    ck('queue holds the chain ahead (current + upcoming, all network items)', st['q']>=5 and all(q['net'] for q in pg.evaluate('__otr.network.queue()')))
    ck('ABC card is highlighted while tuned', pg.evaluate('document.querySelector("#networkChips .station.on")!==null'))
    ck('otr_last records the network', pg.evaluate('localStorage.getItem("otr_last")')=='net:abc')
    # pause for a while, then resume: time-shifted, card offers rejoin; tapping the card rejoins live
    pg.evaluate('document.getElementById("audio").pause()'); pg.wait_for_timeout(9000)
    pg.evaluate('document.getElementById("audio").play()'); pg.wait_for_timeout(800)
    st2=pg.evaluate('({live:__otr.state.live, shifted:__otr.state.shifted, status:document.getElementById("onairText").textContent})')
    pg.evaluate('__otr.state.pausedAt=0')
    pg.wait_for_timeout(5200)
    rejoin=pg.evaluate('getComputedStyle(document.querySelector("#networkChips .station[data-net=abc] .rejoin")).display')
    ck('a long pause leaves the listener time-shifted, with a rejoin offer on the card', (not st2['live']) and st2['shifted'] and 'time-shifted' in st2['status'] and rejoin!='none', (st2,rejoin))
    pg.evaluate('document.querySelector("#networkChips .station[data-net=abc]").click()')
    pg.wait_for_function('__otr.state.live===true && /ABC live/.test(document.getElementById("onairText").textContent)', timeout=20000)
    ck('tapping the card rejoins live', pg.evaluate('__otr.state.live') and 'abc live' in pg.inner_text('#onairText').lower())
    # skip goes "skipped ahead"; the next item is the chain's next item
    nxt=pg.evaluate('__otr.network.queue()[__otr.state.qi+1]')
    pg.evaluate('__otr.next()'); pg.wait_for_function('/skipped ahead/.test(document.getElementById("onairText").textContent)', timeout=10000)
    cur=pg.evaluate('__otr.network.queue()[__otr.state.qi]')
    ck('skip plays the chain\'s next item and reads skipped ahead', cur['showId']==nxt['showId'] and cur['epIndex']==nxt['epIndex'] and 'skipped ahead' in pg.inner_text('#onairText').lower(), (cur,nxt))
    # the queue extends itself: walk to the end of the queue and one past it
    pg.evaluate('''()=>{ __otr.state.qi=__otr.state.queue.length-1; }''')
    before=pg.evaluate('__otr.state.queue.length')
    pg.evaluate('__otr.next()'); pg.wait_for_timeout(500)
    after=pg.evaluate('({len:__otr.state.queue.length, qi:__otr.state.qi, net:__otr.state.network})')
    ck('reaching the end of the queue extends the chain instead of wrapping', after['len']>before and after['qi']==before and after['net']=='abc', (before,after))
    # reload: the station is cued, not autoplayed; Play tunes in live
    pg.reload(); pg.wait_for_function('window.__otr&&__otr.ready()&&__otr.network.ids().length===4',timeout=20000); pg.wait_for_timeout(500)
    cue=pg.evaluate('({net:__otr.state.network, q:__otr.state.queue.length, paused:document.getElementById("audio").paused, show:document.getElementById("npShow").textContent, status:document.getElementById("onairText").textContent})')
    ck('reload cues the last network without autoplay (leaving and coming back lands on what is on now)', cue['net']=='abc' and cue['q']==0 and cue['paused'] and cue['show'] and 'ready' in cue['status'], cue)
    pg.click('#playBtn'); pg.wait_for_function('__otr.state.live===true && __otr.state.network==="abc"', timeout=20000)
    ck('Play from the cued state tunes in live', True)
    # switching to a genre channel clears the network
    pg.evaluate('__otr.startChannel("crime")'); pg.wait_for_timeout(300)
    ck('tuning a channel clears the network state', pg.evaluate('__otr.state.network')==None and pg.evaluate('document.querySelector("#networkChips .station.on")')==None)
  ck('no page errors', not errs and not errs2 and not errs3, errs+errs2+errs3)
  # phone width: no horizontal scroll with the network row
  pgm=b.new_context(viewport={'width':375,'height':800}, timezone_id='America/Los_Angeles').new_page(); pgm.goto('http://127.0.0.1:8797/otr/')
  pgm.wait_for_function('window.__otr&&__otr.ready()&&__otr.network.ids().length===4',timeout=20000); pgm.wait_for_timeout(300)
  ck('no horizontal scroll at 375px with the network row', pgm.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+1'))
  b.close()
print('\n%d failures' % len(F), F)
raise SystemExit(1 if F else 0)
