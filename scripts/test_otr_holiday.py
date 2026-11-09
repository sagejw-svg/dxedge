#!/usr/bin/env python3
"""Holiday overrides for Listenotr Radio (/otr/live/).

The daily blocks stay schedule.json. holidays.json holds civil-date ranges in
America/Los_Angeles: Thanksgiving Nov 23–29 (heaviest Nov 26), Christmas
Dec 18–26 (heaviest Dec 24–25), and New Year's Dec 30–Jan 1 (heaviest
Dec 31 and Jan 1). Every referenced episode has to be a real catalog row
whose archive URL answers.

Run:  python3 scripts/test_otr_holiday.py
"""
import json, os, ssl, urllib.request
import http.server, socketserver, threading

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public"))
PORT = 8821
CHROME = os.environ.get("OTR_CHROMIUM", "/opt/google/chrome/chrome")
BASE = f"http://127.0.0.1:{PORT}"
OTR = os.path.join(ROOT, "otr")

F = []


def ck(name, cond, detail=""):
    print(("PASS" if cond else "FAIL"), name, ("" if cond else detail))
    if not cond:
        F.append(name)


def load(name):
    with open(os.path.join(OTR, name), encoding="utf-8") as f:
        return json.load(f)


cat = load("catalog.json")
holidays = load("live/holidays.json")
scenes = load("scenes/scenes.json")
by_id = {s["id"]: s for s in cat["shows"]}
ranges = holidays.get("ranges") or []
tg = next((r for r in ranges if r.get("id") == "thanksgiving-2026"), None)

xm = next((r for r in ranges if r.get("id") == "christmas-2026"), None)
ny = next((r for r in ranges if r.get("id") == "newyear-2026"), None)
ck("holiday ranges are a list the player can extend", isinstance(ranges, list) and tg and xm and ny, [r.get("id") for r in ranges])
ck("range is America/Los_Angeles, Nov 23 through Nov 29 2026, centered on the 26th",
   tg and tg.get("tz") == "America/Los_Angeles" and tg.get("from") == "2026-11-23"
   and tg.get("to") == "2026-11-29" and tg.get("center") == "2026-11-26", tg)
ck("Wed–Fri are the heavy days",
   tg and tg.get("peak") == ["2026-11-25", "2026-11-26", "2026-11-27"]
   and tg["counts"]["shoulder"] < tg["counts"]["peak"] < tg["counts"]["center"], tg and tg.get("counts"))
ck("Christmas is Dec 18–26 Pacific, heaviest Dec 24 and 25",
   xm and xm.get("tz") == "America/Los_Angeles" and xm.get("from") == "2026-12-18" and xm.get("to") == "2026-12-26"
   and xm.get("peak") == ["2026-12-24", "2026-12-25"]
   and xm["counts"]["shoulder"] < xm["counts"]["peak"], xm)
ck("New Year's crosses into 2027 and is heaviest Dec 31 and Jan 1",
   ny and ny.get("tz") == "America/Los_Angeles" and ny.get("from") == "2026-12-30" and ny.get("to") == "2027-01-01"
   and ny.get("peak") == ["2026-12-31", "2027-01-01"]
   and ny["counts"]["shoulder"] < ny["counts"]["peak"], ny)

named = {
    "Thanksgiving Dinner": "lum-and-abner",
    "Happy Thanksgiving": "father-knows-best",
    "Thanksgiving Play": "the-harold-peary-show",
    "The Last Turkeyaka The Thanksgiving Turkey": "the-aldrich-family",
    "Thanksgiving Weekend": "our-miss-brooks",
    "Formal ThanksGiving Dinner Party": "abbott-and-costello",
}
listed = {(e["show"], e["title"]) for e in (tg or {}).get("episodes") or []}
ck("the six named episodes are in the override pool",
   all((sid, title) in listed for title, sid in named.items()), sorted(listed))


def catalog_hit(show_id, title):
    show = by_id.get(show_id)
    if not show:
        return None
    for i, ep in enumerate(show.get("eps") or []):
        if ep[0] == title:
            return show, i, ep
    return None


def resolve_range(rng):
    rows = []
    for spec in (rng or {}).get("episodes") or []:
        hit = catalog_hit(spec["show"], spec["title"])
        ck(f"catalog has {spec['show']} / {spec['title']}", hit is not None, spec)
        if not hit:
            continue
        show, idx, ep = hit
        dur = ep[2] if isinstance(ep[2], (int, float)) and ep[2] > 0 else 0
        url = cat["prefix"] + show["ids"][ep[3]] + "/" + ep[4]
        rows.append({"show": show["id"], "index": idx, "title": ep[0], "dur": dur, "url": url, "ch": show.get("ch") or [], "range": rng["id"]})
        ck(f"{rng['id']} {spec['title']} is a full half-hour episode", 8 * 60 <= dur <= 30 * 60, dur)
    return rows

pools = {rng["id"]: resolve_range(rng) for rng in ranges if rng.get("id")}
resolved = pools.get("thanksgiving-2026") or []
for rid, rows in pools.items():
    ck(f"{rid} pool episodes are unique", len({(r['show'], r['index']) for r in rows}) == len(rows) and len(rows) > 0, len(rows))

classics = {(e["show"], e["title"]) for e in (xm or {}).get("episodes") or []}
ck("fitting Christmas Carol adaptations are in the Christmas pool",
   ("burns-and-allen", "Gracie's Christmas Carol") in classics
   and ("the-six-shooter", "Britt Ponsett's Christmas Carol") in classics
   and ("the-new-adventures-of-sherlock-holmes", "The Night Before Christmas") in classics
   and ("the-great-gildersleeve", "Twas the Night Before Christmas") in classics, sorted(classics))

ctx = ssl.create_default_context()

def head_ok(url):
    last = None
    for _ in range(2):
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "dxedge-holiday-check/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=45, context=ctx) as resp:
                length = int(resp.headers.get("Content-Length") or "0")
                if resp.status == 200 and (resp.headers.get("Content-Type") or "").startswith("audio/") and length > 10000:
                    return True, resp.status, length
                last = (resp.status, resp.headers.get("Content-Type"), length)
        except Exception as exc:
            last = exc
    return False, last, 0

for rid, rows in pools.items():
    for row in rows:
        ok, status, length = head_ok(row["url"])
        ck(f"HEAD {rid} {row['title']}", ok, (status, length, row["url"]))

future_hits = []
for show in cat["shows"]:
    if show["id"] not in ("x-minus-one", "dimension-x") and "future" not in (show.get("ch") or []):
        continue
    for ep in show.get("eps") or []:
        title = (ep[0] or "").lower()
        if any(k in title for k in ("thanksgiv", "christmas", "new year", "new year's")):
            future_hits.append((show["id"], ep[0]))
ck("no sci-fi holiday episode in the catalog", not future_hits, future_hits)
scifi_js = open(os.path.join(OTR, "live", "scifi", "scifi-live.js"), encoding="utf-8").read()
ck("Sci-Fi Live does not read the holiday file", "holidays.json" not in scifi_js)

season = next((s for s in scenes.get("seasons") or [] if s.get("id") == "thanksgiving-2026"), None)
ck("slideshow has a Thanksgiving scene hook for the same dates",
   season and season.get("tz") == "America/Los_Angeles" and season.get("from") == "2026-11-23" and season.get("to") == "2026-11-29"
   and season.get("scenes"), season and season.get("id"))
missing_art = []
for sc in (season or {}).get("scenes") or []:
    path = os.path.join(OTR, "scenes", sc.get("src") or "")
    if not os.path.isfile(path):
        missing_art.append(sc.get("src"))
ck("Thanksgiving scene art is not invented; the hook falls back until files arrive",
   missing_art and len(missing_art) == len(season["scenes"]), missing_art)
for sid, start, end in (
    ("christmas-2026", "2026-12-18", "2026-12-26"),
    ("newyear-2026", "2026-12-30", "2027-01-01"),
):
    hook = next((s for s in scenes.get("seasons") or [] if s.get("id") == sid), None)
    absent = [sc.get("src") for sc in (hook or {}).get("scenes") or []
              if not os.path.isfile(os.path.join(OTR, "scenes", sc.get("src") or ""))]
    ck(f"{sid} scene hook matches the broadcast dates and has no generated art",
       hook and hook.get("tz") == "America/Los_Angeles" and hook.get("from") == start and hook.get("to") == end
       and hook.get("scenes") and len(absent) == len(hook["scenes"]), (hook and hook.get("id"), absent))
year_round = [s["id"] for s in scenes["scenes"]]
ck("year-round rooms are still the scene list", year_round[0] == "space" and "farm" in year_round, year_round)


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.ThreadingTCPServer(("127.0.0.1", PORT), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()

from playwright.sync_api import sync_playwright

# date -> (range id, episode count), or None when the normal grid is on.
EXPECT = {
    "2026-11-22": None,
    "2026-11-23": ("thanksgiving-2026", 4),
    "2026-11-25": ("thanksgiving-2026", 8),
    "2026-11-26": ("thanksgiving-2026", 10),
    "2026-11-27": ("thanksgiving-2026", 8),
    "2026-11-29": ("thanksgiving-2026", 4),
    "2026-11-30": None,
    "2026-12-17": None,
    "2026-12-18": ("christmas-2026", 4),
    "2026-12-24": ("christmas-2026", 10),
    "2026-12-25": ("christmas-2026", 10),
    "2026-12-26": ("christmas-2026", 4),
    "2026-12-27": None,
    "2026-12-29": None,
    "2026-12-30": ("newyear-2026", 4),
    "2026-12-31": ("newyear-2026", 8),
    "2027-01-01": ("newyear-2026", 8),
    "2027-01-02": None,
}

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=CHROME,
        args=["--autoplay-policy=no-user-gesture-required", "--no-sandbox", "--disable-dev-shm-usage"],
    )

    def open_live(tz="America/New_York"):
        ctx = browser.new_context(viewport={"width": 1100, "height": 900}, timezone_id=tz)
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(BASE + "/otr/live/")
        pg.wait_for_function("window.__listenotr && __listenotr.booted()", timeout=20000)
        return pg, errs, ctx

    pg, errs, ctx = open_live()
    ck("live page boots with the holiday file", not errs and pg.evaluate("__listenotr.failed()") == "", (errs, pg.evaluate("__listenotr.failed()")))

    plans = pg.evaluate("""(dates) => {
      const out = {};
      dates.forEach(function (d) { out[d] = __listenotr.holidayOn(d); });
      return out;
    }""", list(EXPECT))

    for date, want in EXPECT.items():
        got = plans[date]
        if want is None:
            ck(f"{date} override is off", got is None, got)
        else:
            rid, n = want
            keys = [(e["showId"], e["epIndex"]) for e in (got or {}).get("episodes") or []]
            ck(f"{date} override is {rid} with {n} episodes",
               got and got["id"] == rid and got["tz"] == "America/Los_Angeles"
               and got["count"] == n and len(got["episodes"]) == n and len(set(keys)) == n, got)

    center = plans["2026-11-26"]
    ck("Nov 26 is the center day", center and center["center"] is True and center["peak"] is True, center)
    ck("Nov 23 is a shoulder, not the center",
       plans["2026-11-23"] and plans["2026-11-23"]["center"] is False and plans["2026-11-23"]["peak"] is False,
       plans["2026-11-23"])
    pool_keys = {(r["show"], r["index"]) for r in resolved}
    center_keys = {(e["showId"], e["epIndex"]) for e in center["episodes"]} if center else set()
    ck("Thanksgiving Day places every pool episode once", center_keys == pool_keys, (sorted(center_keys), sorted(pool_keys)))
    nov24 = pg.evaluate("__listenotr.holidayOn('2026-11-24')")
    shoulder_a = {(e["showId"], e["epIndex"]) for e in plans["2026-11-23"]["episodes"]}
    shoulder_b = {(e["showId"], e["epIndex"]) for e in (nov24 or {}).get("episodes") or []}
    ck("Nov 24 is on and does not repeat Nov 23's set",
       nov24 and nov24["count"] == 4 and shoulder_a.isdisjoint(shoulder_b), (sorted(shoulder_a), sorted(shoulder_b)))
    eve = {(e["showId"], e["epIndex"]) for e in plans["2026-12-24"]["episodes"]}
    day = {(e["showId"], e["epIndex"]) for e in plans["2026-12-25"]["episodes"]}
    ck("Dec 24 and Dec 25 are the heavy Christmas days and are not the same lineup",
       plans["2026-12-24"]["peak"] and plans["2026-12-25"]["peak"]
       and plans["2026-12-24"]["count"] > plans["2026-12-18"]["count"]
       and eve != day, (len(eve), len(day)))
    nye = {(e["showId"], e["epIndex"]) for e in plans["2026-12-31"]["episodes"]}
    nyd = {(e["showId"], e["epIndex"]) for e in plans["2027-01-01"]["episodes"]}
    ck("New Year's Eve and New Year's Day stay on across the year and are not the same lineup",
       plans["2026-12-31"]["id"] == "newyear-2026" and plans["2027-01-01"]["id"] == "newyear-2026"
       and plans["2026-12-31"]["count"] > plans["2026-12-30"]["count"] and nye != nyd, (len(nye), len(nyd)))

    aired = pg.evaluate("""() => {
      const dates = ['2026-11-22','2026-11-23','2026-11-26','2026-11-29','2026-11-30','2026-12-17','2026-12-18','2026-12-24','2026-12-25','2026-12-26','2026-12-27','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02'];
      const out = {};
      dates.forEach(function (d) {
        const day = __listenotr.day(d);
        const hol = day.filter(function (it) { return it.holiday; });
        const keys = hol.map(function (it) { return it.showId + ':' + it.epIndex; });
        const dup = keys.filter(function (k, i) { return keys.indexOf(k) !== i; });
        let worstGap = 0;
        day.forEach(function (it) {
          if (it.kind !== 'break') return;
          const segs = (it.cues || []).map(function (c) { return [c.at0 || 0, (c.at0 || 0) + (c.dur || 0)]; });
          segs.sort(function (a, b) { return a[0] - b[0]; });
          let cursor = 0, gap = 0;
          segs.forEach(function (s) { gap = Math.max(gap, s[0] - cursor); cursor = Math.max(cursor, s[1]); });
          gap = Math.max(gap, it.dur - cursor);
          if (gap > worstGap) worstGap = gap;
        });
        const badFollow = [];
        const mid = [];
        day.forEach(function (it, i) {
          if (!it.holiday) return;
          const nxt = day[i + 1];
          if (!nxt || nxt.kind !== 'break') badFollow.push(it.start);
          if (it.cues && it.cues.length) mid.push(it.start);
          if (it.kind !== 'show') mid.push(it.start);
        });
        out[d] = { n: hol.length, dup: dup, badFollow: badFollow, mid: mid, worstGap: worstGap, hol: hol.map(function (it) {
          return { showId: it.showId, epIndex: it.epIndex, title: it.title, theme: it.theme, url: it.url, start: it.start, dur: it.dur, trimmed: it.trimmed };
        })};
      });
      return out;
    }""")
    ck("Nov 22 and Nov 30 Eastern days carry no holiday pins",
       aired["2026-11-22"]["n"] == 0 and aired["2026-11-30"]["n"] == 0, aired)
    ck("the aired days get heavier toward Thanksgiving",
       aired["2026-11-23"]["n"] == 4 and aired["2026-11-29"]["n"] == 4 and aired["2026-11-26"]["n"] == 10
       and aired["2026-11-26"]["n"] > aired["2026-11-23"]["n"], {d: aired[d]["n"] for d in aired})
    ck("Christmas and New Year's air on the heavy days and are off on the days around them",
       aired["2026-12-17"]["n"] == 0 and aired["2026-12-18"]["n"] == 4
       and aired["2026-12-24"]["n"] == 10 and aired["2026-12-25"]["n"] == 10 and aired["2026-12-26"]["n"] == 4
       and aired["2026-12-27"]["n"] == 0 and aired["2026-12-29"]["n"] == 0
       and aired["2026-12-30"]["n"] == 4 and aired["2026-12-31"]["n"] == 8
       and aired["2027-01-01"]["n"] == 8 and aired["2027-01-02"]["n"] == 0,
       {d: aired[d]["n"] for d in aired})
    for date, info in aired.items():
        ck(f"{date} does not repeat a holiday episode", not info["dup"], info["dup"])
        ck(f"{date} breaks stay filled", info["worstGap"] <= 4, info["worstGap"])
        ck(f"{date} holiday episodes are full shows with a break after them",
           not info["badFollow"] and not info["mid"], info)
        for ep in info["hol"]:
            hit = catalog_hit(ep["showId"], ep["title"])
            show = by_id.get(ep["showId"])
            url = ""
            if hit:
                _s, idx, row = hit
                url = cat["prefix"] + show["ids"][row[3]] + "/" + row[4]
            ck(f"{date} {ep['title']} is the catalog episode",
               hit is not None and hit[1] == ep["epIndex"] and url == ep["url"] and ep["theme"] in (show.get("ch") or [])
               and ep["trimmed"] is False and ep["dur"] == hit[2][2],
               ep)

    edge = pg.evaluate("""() => {
      function at(date, sod) {
        const ms = __listenotr.unixFor(date, sod);
        return { civil: __listenotr.civil(ms, 'America/Los_Angeles'), on: __listenotr.holidayAt(ms), ms: ms };
      }
      return {
        before: at('2026-11-23', 2 * 3600 + 30 * 60),
        start: at('2026-11-23', 3 * 3600 + 30 * 60),
        still: at('2026-11-30', 2 * 3600 + 30 * 60),
        after: at('2026-11-30', 3 * 3600 + 30 * 60),
        noon26: at('2026-11-26', 15 * 3600),
        xmasBefore: at('2026-12-18', 2 * 3600 + 30 * 60),
        xmasStart: at('2026-12-18', 3 * 3600 + 30 * 60),
        xmasStill: at('2026-12-27', 2 * 3600 + 30 * 60),
        xmasAfter: at('2026-12-27', 3 * 3600 + 30 * 60),
        yearBefore: at('2027-01-01', 2 * 3600 + 30 * 60),
        yearOn: at('2027-01-01', 3 * 3600 + 30 * 60),
        yearStill: at('2027-01-02', 2 * 3600 + 30 * 60),
        yearAfter: at('2027-01-02', 3 * 3600 + 30 * 60)
      };
    }""")
    ck("2:30am Eastern Nov 23 is still Nov 22 Pacific, override off",
       edge["before"]["civil"] == "2026-11-22" and edge["before"]["on"] is None, edge["before"])
    ck("3:30am Eastern Nov 23 is Nov 23 Pacific, override on",
       edge["start"]["civil"] == "2026-11-23" and edge["start"]["on"] and edge["start"]["on"]["id"] == "thanksgiving-2026",
       edge["start"])
    ck("2:30am Eastern Nov 30 is still Nov 29 Pacific, override on",
       edge["still"]["civil"] == "2026-11-29" and edge["still"]["on"] and edge["still"]["on"]["date"] == "2026-11-29",
       edge["still"])
    ck("3:30am Eastern Nov 30 is Nov 30 Pacific, override off",
       edge["after"]["civil"] == "2026-11-30" and edge["after"]["on"] is None, edge["after"])
    ck("Pacific noon on Thanksgiving is the center date",
       edge["noon26"]["civil"] == "2026-11-26" and edge["noon26"]["on"] and edge["noon26"]["on"]["date"] == "2026-11-26",
       edge["noon26"])
    ck("Christmas turns on at Pacific midnight Dec 18",
       edge["xmasBefore"]["civil"] == "2026-12-17" and edge["xmasBefore"]["on"] is None
       and edge["xmasStart"]["civil"] == "2026-12-18" and edge["xmasStart"]["on"]["id"] == "christmas-2026",
       (edge["xmasBefore"], edge["xmasStart"]))
    ck("Christmas turns off at Pacific midnight Dec 27",
       edge["xmasStill"]["civil"] == "2026-12-26" and edge["xmasStill"]["on"]["id"] == "christmas-2026"
       and edge["xmasAfter"]["civil"] == "2026-12-27" and edge["xmasAfter"]["on"] is None,
       (edge["xmasStill"], edge["xmasAfter"]))
    ck("New Year's stays on across midnight into 2027 and turns off Jan 2",
       edge["yearBefore"]["civil"] == "2026-12-31" and edge["yearBefore"]["on"]["id"] == "newyear-2026"
       and edge["yearOn"]["civil"] == "2027-01-01" and edge["yearOn"]["on"]["date"] == "2027-01-01"
       and edge["yearStill"]["civil"] == "2027-01-01" and edge["yearStill"]["on"]["id"] == "newyear-2026"
       and edge["yearAfter"]["civil"] == "2027-01-02" and edge["yearAfter"]["on"] is None,
       (edge["yearBefore"], edge["yearOn"], edge["yearStill"], edge["yearAfter"]))

    la, errs_la, ctx_la = open_live("America/Los_Angeles")
    same = la.evaluate("""(ms) => __listenotr.holidayAt(ms)""", edge["noon26"]["ms"])
    ck("Los Angeles and New York agree on the holiday instant",
       same == edge["noon26"]["on"] and not errs_la, (same, errs_la))
    ctx.close()
    ctx_la.close()

    def open_otr(query):
        c = browser.new_context(viewport={"width": 1280, "height": 900})
        page = c.new_page()
        err = []
        page.on("pageerror", lambda e: err.append(str(e)))
        page.goto(BASE + "/otr/" + query)
        page.wait_for_function("window.__otr && __otr.slideshow && __otr.slideshow.ready()", timeout=20000)
        return page, err, c

    sp, serr, sc = open_otr("?sceneDate=2026-11-26")
    season_on = sp.evaluate("__otr.slideshow.season()")
    ids_on = sp.evaluate("__otr.slideshow.scenes()")
    ck("Thanksgiving scene hook is active with no art, so the rooms stay the year-round set",
       season_on["active"] is True and season_on["id"] == "thanksgiving-2026" and season_on["art"] == 0
       and season_on["fallback"] is True and ids_on[0] == "space" and ids_on[1] == "farm"
       and "thanksgiving-table" not in ids_on and not serr, (season_on, ids_on, serr[:3]))
    sc.close()

    sp2, serr2, sc2 = open_otr("?sceneDate=2026-11-22")
    season_off = sp2.evaluate("__otr.slideshow.season()")
    ck("Nov 22 does not turn the scene hook on", season_off["active"] is False and not serr2, (season_off, serr2[:3]))
    sc2.close()

    def scene_ck(query, sid, label):
        page, err, c = open_otr(query)
        info = page.evaluate("__otr.slideshow.season()")
        ids = page.evaluate("__otr.slideshow.scenes()")
        ck(label,
           info["active"] is True and info["id"] == sid and info["art"] == 0 and info["fallback"] is True
           and ids[0] == "space" and ids[1] == "farm" and sid.split("-")[0] not in " ".join(ids) and not err,
           (info, ids, err[:3]))
        c.close()

    scene_ck("?sceneDate=2026-12-25", "christmas-2026", "Christmas scene hook falls back to the year-round rooms")
    scene_ck("?sceneDate=2027-01-01", "newyear-2026", "New Year's scene hook crosses the year and falls back")
    sp3, serr3, sc3 = open_otr("?sceneDate=2026-12-17")
    ck("Dec 17 does not turn a scene hook on", sp3.evaluate("__otr.slideshow.season()")["active"] is False and not serr3, serr3[:3])
    sc3.close()
    browser.close()

srv.shutdown()
print("FAILS", F)
raise SystemExit(1 if F else 0)
