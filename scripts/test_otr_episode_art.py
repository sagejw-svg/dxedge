#!/usr/bin/env python3
"""Episode-matched slideshow art on /otr/.

episode-art/episode-art.json maps a catalog file name to pictures. While that
episode is the one playing, the slideshow shows those pictures. Every other
episode keeps the rooms in scenes.json, including a season that is in date.
The lava lamp stays on its own canvas.

Dimension X, 15 Apr 1950, "With Folded Hands"
(Dimension_X_1950-04-15__02_WithFoldedHands.mp3) is the first mapped episode.

Run:  python3 scripts/test_otr_episode_art.py
"""
import http.server, json, os, socketserver, threading, functools

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public"))
OTR = os.path.join(ROOT, "otr")
PORT = 8817
SHOTS = os.environ.get("OTR_SHOTS", "/tmp")
ART_FILE = "Dimension_X_1950-04-15__02_WithFoldedHands.mp3"
ART_IDS = ["dx-wfh-town", "dx-wfh-knife", "dx-wfh-bench"]
ART_SRC = [
    "dimension-x/with-folded-hands-1.jpg",
    "dimension-x/with-folded-hands-2.jpg",
    "dimension-x/with-folded-hands-3.jpg",
]

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
handler.log_message = lambda *a, **k: None
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{PORT}"
URL = BASE + "/otr/"
F = []


def ck(name, cond, detail=""):
    print(("PASS" if cond else "FAIL"), name, "" if cond else f"-> {detail}")
    if not cond:
        F.append(name)


def jpeg_size(path):
    data = open(path, "rb").read()
    if data[:3] != b"\xff\xd8\xff":
        return None
    i = 2
    while i + 8 < len(data):
        if data[i] != 0xFF:
            return None
        marker = data[i + 1]
        if marker in (0xC0, 0xC1, 0xC2):
            h = int.from_bytes(data[i + 5:i + 7], "big")
            w = int.from_bytes(data[i + 7:i + 9], "big")
            return w, h
        if marker in (0xD8, 0xD9):
            i += 2
            continue
        seglen = int.from_bytes(data[i + 2:i + 4], "big")
        if seglen < 2:
            return None
        i += 2 + seglen
    return None


scenes = json.load(open(os.path.join(OTR, "scenes", "scenes.json"), encoding="utf-8"))
pack = json.load(open(os.path.join(OTR, "episode-art", "episode-art.json"), encoding="utf-8"))
cat = json.load(open(os.path.join(OTR, "catalog.json"), encoding="utf-8"))
show = next(s for s in cat["shows"] if s["id"] == "dimension-x")
ep_i = next(i for i, e in enumerate(show["eps"]) if e[4] == ART_FILE)
other_i = 0 if ep_i != 0 else 2
year_ids = [s["id"] for s in scenes["scenes"]]
rows = pack["episodes"][ART_FILE]

ck("scenes.json points at the episode-art map", scenes.get("episodeArt") == "episode-art/episode-art.json")
ck("the mapped file is Dimension X ep 02 With Folded Hands",
   show["eps"][ep_i][0] == "With Folded Hands" and show["eps"][ep_i][1] == "15 Apr 1950" and ep_i == 1,
   (ep_i, show["eps"][ep_i][:2]))
ck("the map lists three pictures for that file",
   [r["id"] for r in rows] == ART_IDS and [r["src"] for r in rows] == ART_SRC, rows)
sizes = []
for src in ART_SRC:
    path = os.path.join(OTR, "episode-art", src)
    sizes.append(jpeg_size(path) if os.path.isfile(path) else None)
ck("episode pictures are 1280x720 JPEGs", sizes == [(1280, 720)] * 3 and all(os.path.getsize(os.path.join(OTR, "episode-art", s)) > 20000 for s in ART_SRC), sizes)
page_html = open(os.path.join(OTR, "index.html"), encoding="utf-8").read()
ck("the player loads the slideshow that reads the map", "slideshow.js?v=2" in page_html and "episodeArt" in open(os.path.join(OTR, "slideshow.js"), encoding="utf-8").read())

from playwright.sync_api import sync_playwright
CHROME = os.environ.get("OTR_CHROMIUM", "/opt/google/chrome/chrome")

SETTLED = """() => {
  const on = document.querySelector('#slideFrame .slide-bg.on');
  if (!on) return false;
  const cur = __otr.slideshow.current();
  if (!cur || on.style.backgroundImage.indexOf(cur.src.split('/').pop()) < 0) return false;
  return parseFloat(getComputedStyle(on).opacity) > 0.95;
}"""


def shoot(page, name, full=False):
    if not full:
        page.locator("#slideFrame").scroll_into_view_if_needed()
    page.wait_for_function(SETTLED, timeout=8000)
    path = os.path.join(SHOTS, name)
    page.screenshot(path=path, full_page=full)
    return path


def lamp_painted(page):
    page.wait_for_function("""() => {
      const cv = document.getElementById('slideLamp');
      if (!cv || cv.width < 20) return false;
      const d = cv.getContext('2d').getImageData(Math.floor(cv.width*0.42), Math.floor(cv.height*0.62), 10, 10).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 30) return true;
      return false;
    }""", timeout=4000)


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox", "--disable-dev-shm-usage"])

    pg = b.new_page(viewport={"width": 1280, "height": 900})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL)
    pg.wait_for_function("window.__otr && __otr.ready() && window.__otr.slideshow && __otr.slideshow.ready()", timeout=20000)
    ck("with nothing selected the rooms are unchanged",
       pg.evaluate("__otr.slideshow.scenes()") == year_ids and pg.evaluate("__otr.slideshow.episode()")["file"] is None)
    pg.click("#slideBtn")
    pg.wait_for_function("() => __otr.slideshow.on() && __otr.slideshow.current() && __otr.slideshow.current().id === 'space'", timeout=5000)
    pg.click("#slideNext")
    pg.wait_for_function("() => __otr.slideshow.current().id === 'farm'")
    pg.evaluate(f"__otr.playEpisode('dimension-x', {ep_i})")
    pg.wait_for_function("""() => {
      const ep = __otr.slideshow.episode();
      const cur = __otr.slideshow.current();
      return ep.file === 'Dimension_X_1950-04-15__02_WithFoldedHands.mp3' && ep.count === 3
        && cur && cur.id === 'dx-wfh-town' && cur.src.indexOf('with-folded-hands-1.jpg') >= 0;
    }""", timeout=8000)
    ids = pg.evaluate("__otr.slideshow.scenes()")
    info = pg.evaluate("__otr.currentInfo()")
    ck("Advanced shows only the three episode pictures",
       ids == ART_IDS and info and "With Folded Hands" in info["title"] and info["show"] == "Dimension X", (ids, info))
    pg.click("#slideNext")
    pg.wait_for_function("() => __otr.slideshow.current().id === 'dx-wfh-knife'")
    pg.click("#slideNext")
    pg.wait_for_function("() => __otr.slideshow.current().id === 'dx-wfh-bench'")
    pg.click("#slideNext")
    pg.wait_for_function("() => __otr.slideshow.current().id === 'dx-wfh-town'")
    ck("Next stays inside the episode pictures", True)
    lamp_painted(pg)
    ck("the lava lamp still paints on the episode picture", True)
    pg.evaluate("__otr.slideshow.go(0)")
    pg.wait_for_function(SETTLED, timeout=8000)
    adv_shot = shoot(pg, "otr_folded_hands_advanced.png")
    saved_i = pg.evaluate("JSON.parse(localStorage.getItem('otr_slide_lamp')).i")
    pg.evaluate(f"__otr.playEpisode('dimension-x', {other_i})")
    pg.wait_for_function("""() => {
      const ep = __otr.slideshow.episode();
      const cur = __otr.slideshow.current();
      return !ep.file && cur && cur.id === 'farm' && cur.src.indexOf('farm.jpg') >= 0;
    }""", timeout=8000)
    back = pg.evaluate("__otr.slideshow.scenes()")
    other = pg.evaluate("__otr.currentInfo()")
    ck("a different episode returns to the room pool, on the room it left",
       back == year_ids and other and "With Folded Hands" not in other["title"] and saved_i == 1, (back, other, saved_i))
    pg.wait_for_function(SETTLED, timeout=8000)
    shoot(pg, "otr_other_episode_advanced.png")
    ck("no page errors in Advanced", not errs, errs[:4])
    pg.close()

    ctx = b.new_context(viewport={"width": 1280, "height": 1280})
    ctx.add_init_script("localStorage.setItem('otr_mode','basic')")
    m = ctx.new_page()
    merrs = []
    m.on("pageerror", lambda e: merrs.append(str(e)))
    m.goto(URL)
    m.wait_for_function("window.__otr && __otr.ready() && __otr.slideshow && __otr.slideshow.ready()", timeout=20000)
    m.click("#slideBtnBasic")
    m.wait_for_function("() => __otr.slideshow.on() && document.getElementById('otr-basic').contains(document.getElementById('slideStage'))")
    m.evaluate(f"__otr.playEpisode('dimension-x', {ep_i})")
    m.wait_for_function("""() => {
      const cur = __otr.slideshow.current();
      const title = (document.getElementById('otrNowEp') || {}).textContent || '';
      return cur && cur.src.indexOf('with-folded-hands-1.jpg') >= 0 && title.indexOf('With Folded Hands') >= 0;
    }""", timeout=8000)
    m.wait_for_function(SETTLED, timeout=8000)
    basic_shot = shoot(m, "otr_folded_hands_basic.png", full=True)
    ck("Basic shows the episode picture while With Folded Hands is selected",
       m.evaluate("__otr.slideshow.episode().count") == 3 and "With Folded Hands" in m.inner_text("#otrNowEp"))
    m.evaluate(f"__otr.playEpisode('x-minus-one', 0)")
    m.wait_for_function("""() => {
      const cur = __otr.slideshow.current();
      const title = (document.getElementById('otrNowEp') || {}).textContent || '';
      return cur && cur.id === 'space' && cur.src.indexOf('space.jpg') >= 0 && title.indexOf('With Folded Hands') < 0;
    }""", timeout=8000)
    m.wait_for_function(SETTLED, timeout=8000)
    other_basic = shoot(m, "otr_other_episode_basic.png", full=True)
    ck("Basic returns to the normal pool for another episode",
       m.evaluate("__otr.slideshow.scenes()") == year_ids and "With Folded Hands" not in m.inner_text("#otrNowEp"))
    ck("no page errors in Basic", not merrs, merrs[:4])
    ctx.close()

    ctx = b.new_context(viewport={"width": 1100, "height": 800})
    h = ctx.new_page()
    herrs = []
    h.on("pageerror", lambda e: herrs.append(str(e)))
    h.goto(URL + "?sceneDate=2026-11-26")
    h.wait_for_function("window.__otr && __otr.slideshow && __otr.slideshow.ready()", timeout=20000)
    h.click("#slideBtn")
    h.wait_for_function("() => __otr.slideshow.on()", timeout=5000)
    before = h.evaluate("__otr.slideshow.scenes()")
    season = h.evaluate("__otr.slideshow.season()")
    ck("Thanksgiving rooms are in the pool before the episode plays",
       before == year_ids + ["thanksgiving-table", "thanksgiving-hearth", "thanksgiving-store"]
       and season["active"] is True and season["id"] == "thanksgiving-2026" and season["art"] == 3, (before, season))
    h.evaluate(f"__otr.playEpisode('dimension-x', {ep_i})")
    h.wait_for_function("() => __otr.slideshow.episode().count === 3", timeout=8000)
    during = h.evaluate("__otr.slideshow.scenes()")
    season2 = h.evaluate("__otr.slideshow.season()")
    ck("the episode pictures replace the rooms, and the Thanksgiving hook stays armed",
       during == ART_IDS and season2["active"] is True and season2["art"] == 3 and season2["id"] == "thanksgiving-2026",
       (during, season2))
    h.evaluate(f"__otr.playEpisode('dimension-x', {other_i})")
    h.wait_for_function("() => !__otr.slideshow.episode().file && __otr.slideshow.scenes().indexOf('thanksgiving-table') >= 0", timeout=8000)
    after = h.evaluate("__otr.slideshow.scenes()")
    ck("leaving the episode puts the Thanksgiving rooms back",
       after == year_ids + ["thanksgiving-table", "thanksgiving-hearth", "thanksgiving-store"] and not herrs, (after, herrs[:3]))
    ctx.close()

    ctx = b.new_context(viewport={"width": 1100, "height": 800})
    live = ctx.new_page()
    lerrs = []
    live.on("pageerror", lambda e: lerrs.append(str(e)))
    live.goto(URL + "?sceneDate=2026-11-22")
    live.wait_for_function("window.__otr && __otr.ready() && __otr.slideshow && __otr.slideshow.ready() && window.__scifi && __scifi.booted() && window.__listenotr && __listenotr.booted()", timeout=20000)
    live.click("#slideBtn")
    live.wait_for_function("() => __otr.slideshow.on()", timeout=5000)
    found = live.evaluate("""(file) => {
      const audit = __scifi.audit();
      const start = __scifi.unixFor('2026-01-01', 0);
      const shows = __scifi.showsIn(start, audit.cycle + 5);
      const hit = shows.find(h => h.showId === 'dimension-x' && h.epIndex === 1);
      const other = shows.find(h => h.showId && !(h.showId === 'dimension-x' && h.epIndex === 1));
      let date = '2026-01-01', lr = null;
      for (let n = 0; n < 500 && !lr; n++) {
        const items = __listenotr.day(date);
        const row = items.find(it => it.kind === 'show' && it.url && decodeURIComponent(it.url.split('?')[0].split('/').pop()) === file);
        if (row) {
          const alt = items.find(it => it.kind === 'show' && it !== row);
          lr = { date: date, start: row.start, other: alt ? alt.start : null };
        }
        const p = date.split('-').map(Number);
        const dt = new Date(Date.UTC(p[0], p[1] - 1, p[2] + 1));
        date = dt.toISOString().slice(0, 10);
      }
      return {
        scifi: hit ? { at: hit.startMs + 30000, other: other ? other.startMs + 30000 : null, title: null } : null,
        listenotr: lr
      };
    }""", ART_FILE)
    ck("Sci-Fi (Live) airs With Folded Hands somewhere in its cycle", bool(found and found["scifi"]), found)
    if found and found["scifi"]:
        live.evaluate("(ms) => __scifi.setClock(ms)", found["scifi"]["at"])
        live.locator("#networkChips .station[data-net=scifi]").click()
        live.wait_for_function("""() => {
          const air = __scifi.onAir();
          const ep = __otr.slideshow.episode();
          return __otr.state.network === 'scifi' && air && air.kind === 'show'
            && ep.file === 'Dimension_X_1950-04-15__02_WithFoldedHands.mp3' && ep.count === 3;
        }""", timeout=8000)
        ck("Sci-Fi (Live) uses the episode pictures while that episode is on",
           live.evaluate("__otr.slideshow.current().id") == "dx-wfh-town")
        live.evaluate("(ms) => __scifi.setClock(ms)", found["scifi"]["other"])
        live.evaluate("__otr.slideshow.sync()")
        live.wait_for_function("""() => {
          const air = __scifi.onAir();
          return air && !(air.showId === 'dimension-x' && air.epIndex === 1) && !__otr.slideshow.episode().file
            && __otr.slideshow.current() && __otr.slideshow.scenes().indexOf('space') === 0;
        }""", timeout=8000)
        ck("Sci-Fi (Live) returns to the room pool for a different episode", True)
    ck("Listenotr Radio airs With Folded Hands on some day", bool(found and found["listenotr"]), found and found.get("listenotr"))
    if found and found["listenotr"]:
        lr = found["listenotr"]
        live.evaluate("""(lr) => __listenotr.setClock(__listenotr.unixFor(lr.date, lr.start + 30))""", lr)
        live.locator("#networkChips .station[data-net=listenotr]").click()
        live.wait_for_function("""() => {
          const air = __listenotr.onAir();
          const ep = __otr.slideshow.episode();
          return __otr.state.network === 'listenotr' && air && air.kind === 'show'
            && ep.file === 'Dimension_X_1950-04-15__02_WithFoldedHands.mp3' && ep.count === 3;
        }""", timeout=8000)
        ck("Listenotr Radio uses the episode pictures while that episode is on",
           "with-folded-hands-1.jpg" in live.evaluate("__otr.slideshow.current().src"))
        if lr.get("other") is not None:
            live.evaluate("""(lr) => __listenotr.setClock(__listenotr.unixFor(lr.date, lr.other + 30))""", lr)
            live.evaluate("__otr.slideshow.sync()")
            live.wait_for_function("""() => {
              const air = __listenotr.onAir();
              const file = air && air.url ? decodeURIComponent(air.url.split('?')[0].split('/').pop()) : '';
              return air && air.kind === 'show' && file !== 'Dimension_X_1950-04-15__02_WithFoldedHands.mp3'
                && !__otr.slideshow.episode().file && __otr.slideshow.scenes().indexOf('space') === 0;
            }""", timeout=8000)
            ck("Listenotr Radio returns to the room pool for a different episode", True)
    ck("no page errors on the live stations", not lerrs, lerrs[:4])
    ctx.close()
    b.close()

print("SHOTS", adv_shot, basic_shot, other_basic)
httpd.shutdown()
print("FAILS", F)
raise SystemExit(1 if F else 0)
