#!/usr/bin/env python3
"""Bedtime Amber lamp and original-airdate labels on /otr/.

The lamp stays optional. Other colours and the sound scenes stay.
Reduced motion holds the picture still, and that choice is saved.
Run: python3 scripts/test_otr_bedtime.py
"""
import http.server
import os
import socketserver
import sys
import threading

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public"))
PORT = 8794
SHOTS = os.environ.get("OTR_SHOTS", "/tmp")
os.makedirs(SHOTS, exist_ok=True)
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, *a):
        pass

socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), H)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{PORT}/otr/"
F = []

def ck(name, cond, detail=""):
    print(("PASS" if cond else "FAIL"), name, "" if cond else f"-> {detail}")
    if not cond:
        F.append(name)

from playwright.sync_api import sync_playwright

ADVANCE = """(ms) => {
  let t = performance.now();
  const n = Math.max(1, Math.round(ms / 16));
  for (let i = 0; i < n; i++) { t += 16; __otr.adv.lamp.render(t); }
  return __otr.adv.lamp.bedtime();
}"""

def boot(page):
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto(BASE)
    page.wait_for_function("window.__otr && __otr.ready() && window.OTRAirDate && window.OTRBedtime", timeout=20000)
    return errs

with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"])
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    errs = boot(pg)
    pg.click("#advBtn")
    pg.wait_for_timeout(400)
    cols = pg.evaluate("__otr.adv.lamp.cols()")
    ck("bedtime is an extra colour, the others remain",
       cols[-1] == "bedtime" and set(["classic", "blue", "orange", "purple", "green", "bclear"]) <= set(cols), cols)
    ck("sound scenes are unchanged",
       pg.evaluate("__otr.adv.scenes()") == ["fireside", "kitchen", "palace", "clear", "night"])
    before = pg.evaluate("({paused: document.getElementById('audio').paused, sleep: document.getElementById('sleepSel').value, rate: document.getElementById('audio').playbackRate})")
    pg.select_option("#lampColSel", "bedtime")
    pg.wait_for_timeout(200)
    st = pg.evaluate("__otr.adv.lamp.bedtime()")
    ck("choosing Bedtime Amber does not force the picture still when motion is allowed",
       st["on"] and st["motion"] == "auto" and not st["held"] and not st["reduce"], st)
    ck("the help text asks to lower the screen and does not promise sleep",
       "lower your screen brightness" in st["note"].lower() and not any(w in st["note"].lower() for w in ("perfect", "insomnia", "treatment", "proven")), st["note"])
    ck("entering bedtime dims the glow, uses the black base, and remembers both",
       pg.evaluate("__otr.adv.state().lampBright") <= 48 and pg.evaluate("__otr.adv.state().lampBrightKeep") == 100 and pg.evaluate("__otr.adv.state().lampBase") == "black" and pg.evaluate("__otr.adv.state().lampBaseKeep") == "gold")
    phys = pg.evaluate("(() => { __otr.adv.lamp.reset(3); const t0 = __otr.adv.lamp.state().t; __otr.adv.lamp.render(performance.now()); return { t0, t1: __otr.adv.lamp.state().t }; })()")
    ck("bedtime does not step the daytime wax physics", phys["t0"] == phys["t1"] == 0, phys)
    moved = pg.evaluate(ADVANCE, 4000)
    ck("slow drift advances on its own clock", moved["t"] > 2, moved["t"])
    pg.click("#lampStill")
    frozen_at = pg.evaluate("__otr.adv.lamp.bedtime().t")
    held = pg.evaluate(ADVANCE, 2000)
    ck("Hold still freezes the picture and is saved as still",
       held["held"] and held["motion"] == "still" and held["t"] == frozen_at, {"at": frozen_at, "after": held["t"], "motion": held["motion"]})
    pg.click("#lampDark")
    pg.wait_for_timeout(400)
    after = pg.evaluate("({paused: document.getElementById('audio').paused, sleep: document.getElementById('sleepSel').value, rate: document.getElementById('audio').playbackRate, solo: __otr.adv.lamp.solo()})")
    ck("dark screen leaves the audio and the sleep timer alone",
       after["solo"] and after["paused"] == before["paused"] and after["sleep"] == before["sleep"] == "off" and after["rate"] == before["rate"], after)
    corner = pg.evaluate("""() => { const cv = document.getElementById('soloCv'); const c = cv.getContext('2d');
      const px = c.getImageData(2, 2, 1, 1).data; return [px[0], px[1], px[2]]; }""")
    ck("the dark screen is the near-black bedtime ground",
       abs(corner[0] - 8) < 8 and abs(corner[1] - 5) < 8 and corner[2] < 16, corner)
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(200)
    pg.click("#lampZoom")
    pg.wait_for_timeout(500)
    pg.locator("#tview").screenshot(path=f"{SHOTS}/otr-bedtime-desktop.png")
    pg.keyboard.press("Escape")
    pg.select_option("#lampColSel", "classic")
    ck("leaving bedtime restores the previous glow, base, and the classic colour",
       pg.evaluate("__otr.adv.state().lampCol") == "classic" and pg.evaluate("__otr.adv.state().lampBright") == 100 and pg.evaluate("__otr.adv.state().lampBase") == "gold")

    # dates from the catalog, including one with no airdate
    dates = pg.evaluate("""() => {
      const find = (id, title) => {
        const show = __otr.catalog().shows.find(s => s.id === id);
        const row = show.eps.find(e => e[0] === title);
        return { title, raw: row[1], label: __otr.airTitle(row[0], row[1]) };
      };
      const blank = __otr.catalog().shows.flatMap(s => s.eps.filter(e => !String(e[1] || '').trim()).map(e => e[0]));
      return {
        outer: find('dimension-x', 'Outer Limit'),
        hands: find('dimension-x', 'With Folded Hands'),
        tunnel: find('x-minus-one', 'Tunnel Under The World'),
        surface: find('x-minus-one', 'Surface Tension'),
        missing: __otr.airTitle(blank[0] || 'Untitled', ''),
        dup: __otr.airTitle('Two Episodes From 1937', '1937'),
        year: __otr.airDate('1947')
      };
    }""")
    ck("Outer Limit shows 08 Apr 1950", dates["outer"]["label"] == "Outer Limit · 08 Apr 1950", dates["outer"])
    ck("With Folded Hands shows 15 Apr 1950", dates["hands"]["label"] == "With Folded Hands · 15 Apr 1950", dates["hands"])
    ck("Tunnel Under The World shows 04 Sep 1956", dates["tunnel"]["label"].endswith("· 04 Sep 1956"), dates["tunnel"])
    ck("Surface Tension shows 28 Aug 1956", dates["surface"]["label"].endswith("· 28 Aug 1956"), dates["surface"])
    ck("a missing airdate is left off", "·" not in dates["missing"], dates["missing"])
    ck("a year already in the title is not repeated", dates["dup"] == "Two Episodes from 1937", dates["dup"])
    ck("a year is not rewritten as 1 January", dates["year"]["precision"] == "year" and dates["year"]["text"] == "1947", dates["year"])

    pg.evaluate("""() => {
      const show = __otr.catalog().shows.find(s => s.id === 'dimension-x');
      const i = show.eps.findIndex(e => e[0] === 'Outer Limit');
      __otr.playEpisode('dimension-x', i);
    }""")
    pg.wait_for_timeout(400)
    shown = pg.inner_text("#npEp")
    ck("now playing appends the airdate once", shown == "Outer Limit · 08 Apr 1950" and pg.inner_text("#npDate").strip() == "", shown)
    pg.locator("#np").screenshot(path=f"{SHOTS}/otr-airdate-desktop.png")
    pg.evaluate("__otr.tab('search')")
    pg.fill("#searchInput", "Outer Limit")
    pg.wait_for_timeout(500)
    titles = pg.evaluate("[...document.querySelectorAll('#results .r-title')].slice(0, 4).map(e => e.textContent)")
    ck("search lists the airdate after the episode name", any("08 Apr 1950" in t and "Outer Limit" in t for t in titles), titles)
    ck("no page errors (desktop)", not errs, errs[:3])

    # persistence
    pg.evaluate("localStorage.setItem('otr_adv', JSON.stringify({lampCol:'bedtime', lampMotion:'still', lampBright:36, lampBase:'black', lampOn:true}))")
    pg.reload()
    pg.wait_for_function("window.__otr && __otr.ready()", timeout=20000)
    saved = pg.evaluate("__otr.adv.state()")
    bed = pg.evaluate("__otr.adv.lamp.bedtime()")
    ck("bedtime colour, still motion, and brightness survive a reload",
       saved["lampCol"] == "bedtime" and saved["lampMotion"] == "still" and saved["lampBright"] == 36 and saved["lampBase"] == "black" and bed["held"], saved)

    m = b.new_page(viewport={"width": 390, "height": 844}, reduced_motion="reduce")
    merrs = boot(m)
    m.click("#advBtn")
    m.wait_for_timeout(300)
    m.select_option("#lampColSel", "bedtime")
    m.wait_for_timeout(200)
    red = m.evaluate("__otr.adv.lamp.bedtime()")
    frozen = m.evaluate(ADVANCE, 1500)
    ck("reduced motion holds Bedtime Amber still until asked",
       red["reduce"] and red["motion"] == "auto" and red["held"] and frozen["t"] == 0, (red, frozen["t"]))
    m.click("#lampStill")
    ck("an explicit slow drift is allowed and remembered",
       m.evaluate("__otr.adv.state().lampMotion") == "slow" and not m.evaluate("__otr.adv.lamp.bedtime().held"))
    m.locator("#lampMod").scroll_into_view_if_needed()
    m.locator("#lampMod").screenshot(path=f"{SHOTS}/otr-bedtime-mobile.png")
    m.evaluate("""() => {
      const show = __otr.catalog().shows.find(s => s.id === 'x-minus-one');
      const i = show.eps.findIndex(e => e[0] === 'Surface Tension');
      __otr.playEpisode('x-minus-one', i);
    }""")
    m.wait_for_timeout(300)
    m.click("#otrModeBasic")
    m.wait_for_timeout(200)
    basic = m.inner_text("#otrNowEp")
    ck("basic now-playing on a phone includes the airdate", "Surface Tension" in basic and "28 Aug 1956" in basic, basic)
    m.locator("#otr-basic-now").screenshot(path=f"{SHOTS}/otr-airdate-mobile.png")
    ck("no page errors (phone)", not merrs, merrs[:3])

    live = b.new_page(viewport={"width": 1100, "height": 800})
    lerrs = []
    live.on("pageerror", lambda e: lerrs.append(str(e)))
    live.goto(f"http://127.0.0.1:{PORT}/otr/live/")
    live.wait_for_function("window.__listenotr && __listenotr.booted() && window.OTRAirDate", timeout=20000)
    live_now = live.evaluate("""() => {
      const a = __listenotr.onAir();
      const ep = document.getElementById('lrEp').textContent;
      const info = a.date ? OTRAirDate.formatAirDate(a.date) : null;
      const ok = a.kind === 'break'
        ? ep === (a.line || '')
        : (!info || ep.indexOf(info.text) >= 0 || OTRAirDate.titleHasDate(ep, info));
      return { ok, kind: a.kind, ep, date: a.date || '' };
    }""")
    ck("live now-playing dates the episode, not a station break", live_now["ok"], live_now)
    ck("live page has no script errors", not lerrs, lerrs[:2])

    # Temporal continuity of the bedtime wax, including a stalled clock and a pause.
    cont = pg.evaluate("""() => {
      __otr.adv.open(true);
      __otr.adv.lamp.set({ col: 'bedtime', motion: 'slow', on: true });
      __otr.adv.tv.open('lamp');
      const cv = document.getElementById('tvCv');
      function shot(t) {
        __otr.adv.lamp.bedtime().clock(t);
        __otr.adv.lamp.render(1);
        const x0 = Math.floor(cv.width * 0.42), y0 = Math.floor(cv.height * 0.18);
        const w = Math.floor(cv.width * 0.16), h = Math.floor(cv.height * 0.46);
        const img = cv.getContext('2d').getImageData(x0, y0, w, h).data;
        const lum = new Uint8Array(img.length / 4);
        for (let i = 0, p = 0; i < img.length; i += 4, p++) lum[p] = img[i];
        return lum;
      }
      let spike = 0, y1 = null, y2 = null;
      for (let t = 0; t <= 120.001; t += 0.05) {
        __otr.adv.lamp.bedtime().clock(t);
        const y = __otr.adv.lamp.bedtime().blobs[0].y;
        if (y1 != null && y2 != null) spike = Math.max(spike, Math.abs((y - y1) - (y1 - y2)));
        y2 = y1; y1 = y;
      }
      let prev2 = null, prev = shot(0), osc = 0, steps = 0;
      for (let t = 0.5; t <= 120.001; t += 0.5) {
        const cur = shot(t);
        if (prev && prev2 && cur.length === prev.length) {
          for (let p = 0; p < cur.length; p += 2) {
            const d1 = prev[p] - prev2[p], d2 = cur[p] - prev[p];
            if (d1 * d2 < 0 && Math.abs(d1) > 28 && Math.abs(d2) > 28) osc++;
          }
          steps++;
        }
        prev2 = prev; prev = cur;
      }
      const gap = (() => {
        const a = __otr.adv.lamp.bedtime().clock(10);
        __otr.adv.lamp.render(5000);
        __otr.adv.lamp.render(5000 + 30000);
        return __otr.adv.lamp.bedtime().t - a;
      })();
      const heldT = __otr.adv.lamp.bedtime().clock(40);
      __otr.adv.lamp.set({ motion: 'still' });
      __otr.adv.lamp.render(8000);
      __otr.adv.lamp.render(8000 + 16);
      __otr.adv.lamp.render(8000 + 4000);
      const afterHold = __otr.adv.lamp.bedtime().t;
      __otr.adv.tv.close();
      return { osc, steps, spike: +spike.toFixed(4), gap, heldT, afterHold };
    }""")
    ck("bedtime wax does not blink or jump across a full two-minute cycle", cont["osc"] == 0 and cont["spike"] < 0.05, cont)
    ck("a 30s stall does not fast-forward the drift", abs(cont["gap"]) < 0.001, cont)
    ck("hold still across frames does not move the clock", abs(cont["afterHold"] - cont["heldT"]) < 0.001, cont)

    # The physics lamp's grid used to follow the wax, so the outline chattered.
    phys = pg.evaluate("""async () => {
      __otr.adv.lamp.set({ col: 'classic', on: true, motion: 'auto' });
      __otr.adv.lamp.reset(4242);
      __otr.adv.lamp.advance(240);
      __otr.adv.tv.open('lamp');
      await new Promise(r => requestAnimationFrame(r));
      const cv = document.getElementById('tvCv');
      const ctx = cv.getContext('2d');
      const x0 = Math.floor(cv.width * 0.40), y0 = Math.floor(cv.height * 0.14);
      const w = Math.floor(cv.width * 0.20), h = Math.floor(cv.height * 0.52);
      const n = w * h;
      const ring = [null, null, null, null, null, null];
      let k = 0, frames = 0, blinks = 0;
      const t0 = performance.now();
      while (performance.now() - t0 < 2500) {
        await new Promise(r => requestAnimationFrame(r));
        const img = ctx.getImageData(x0, y0, w, h).data;
        const lum = new Float32Array(n);
        for (let i = 0, p = 0; i < img.length; i += 4, p++) lum[p] = img[i] * 0.2126 + img[i+1] * 0.7152 + img[i+2] * 0.0722;
        ring[k % 6] = lum; k++; frames++;
        if (k >= 6) {
          const a = ring[(k - 5) % 6], b = ring[(k - 3) % 6], c = ring[(k - 1) % 6];
          for (let p = 0; p < n; p++) {
            const d1 = b[p] - a[p], d2 = c[p] - b[p];
            if (d1 * d2 < 0 && Math.abs(d1) > 22 && Math.abs(d2) > 22) blinks++;
          }
        }
      }
      __otr.adv.tv.close();
      return { frames, perFrame: blinks / Math.max(1, frames), blinks };
    }""")
    ck("physics lamp outline no longer chatters in the big view", phys["perFrame"] < 2.0, phys)
    print("physics blinks/frame", round(phys["perFrame"], 2), "bedtime osc", cont["osc"], "spike", cont["spike"], "gap", cont["gap"])
    pg.evaluate("""() => {
      __otr.adv.lamp.set({ col:'bedtime', motion:'still', on:true });
      __otr.adv.tv.open('lamp');
      __otr.adv.lamp.bedtime().clock(72);
      __otr.adv.lamp.render(1);
    }""")
    pg.wait_for_timeout(250)
    pg.locator("#tvStage").screenshot(path=f"{SHOTS}/otr-bedtime-overlap.png")
    b.close()

httpd.shutdown()
print("FAILS", F)
sys.exit(1 if F else 0)
