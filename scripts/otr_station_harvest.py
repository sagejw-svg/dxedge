#!/usr/bin/env python3
"""Build frontend/public/otr/stations/shows.json: the station-only shows the network stations (station.js)
need that the /otr catalog does not carry, harvested from archive.org metadata. One shared file serves
every network grid (NBC, CBS, ABC, Mutual); a show harvested for one grid is available to all of them.

The grids themselves are hand-authored in frontend/public/otr/stations/<station>.grid.json. This script only
fetches episode lists (title, date, runtime, file) for the shows listed in HARVEST below, in the same
row shape the catalog uses, so the player resolves and streams them exactly like catalog episodes:
    url = "https://archive.org/download/" + show.ids[ep[3]] + "/" + ep[4]
archive.org download URLs send Access-Control-Allow-Origin: *, so nothing is rehosted.

Run:  python3 scripts/otr_station_harvest.py            # write shows.json and print a report
      python3 scripts/otr_station_harvest.py --check    # validate every grid against catalog + harvested shows, write nothing
      python3 scripts/otr_station_harvest.py --dry-run  # report only
Metadata is cached in $IA_CACHE (default /tmp/iacache) so reruns are cheap.
"""
import datetime, json, os, re, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OTR = os.path.join(HERE, "..", "frontend", "public", "otr")
STATIONS = os.path.join(OTR, "stations")
CACHE = os.environ.get("IA_CACHE", "/tmp/iacache")
MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()

# id -> (display name, [archive.org identifiers], options)
#   min:   drop files shorter than this many seconds (intros, fragments, excerpts)
#   skip:  regex on the file name; matching files are dropped
#   years: keep only files whose parsed year is in this range (None = keep all, undated kept)
HARVEST = {
    "sky-king":                    ("Sky King",                     ["SkyKing"], {}),
    "the-fat-man":                 ("The Fat Man",                  ["otr_fatman"], {"min": 20*60, "alias": "Fatman"}),
    "jack-armstrong":              ("Jack Armstrong, the All-American Boy", ["jack-armstrong"], {"min": 8*60}),
    "ethel-and-albert":            ("Ethel and Albert",             ["EthelAlbertJHMC"], {"min": 8*60}),
    "theatre-guild-on-the-air":    ("Theatre Guild on the Air",     ["TheaterGuildontheAir"], {"min": 30*60}),
    "philco-radio-time":           ("Philco Radio Time (Bing Crosby)", ["philco-radio-time-02-26-1947-guests-the-andrews-sisters-les-paul-joe-frisco"], {"min": 20*60, "prefix": "Guests: "}),
    "stop-the-music":              ("Stop the Music",               ["StoptheMusicOTR"], {"min": 40*60}),
    "dick-tracy":                  ("Dick Tracy",                   ["Dick_Tracy_20161023"], {"min": 8*60}),
    "terry-and-the-pirates":       ("Terry and the Pirates",        ["TerryAndThePirates"], {"min": 8*60}),
    "the-greatest-story-ever-told":("The Greatest Story Ever Told", ["TheGreatestStoryEverTold"], {"min": 15*60}),
    "breakfast-in-hollywood":      ("Breakfast in Hollywood",       ["BreakfastInHollywood", "BreakfastInHollywoodPage2", "BreakfastInHollywoodPage3"], {"min": 10*60}),
    "ladies-be-seated":            ("Ladies Be Seated",             ["LadiesBeSeatedJHMC"], {"min": 8*60}),
    "big-jon-and-sparkie":         ("Big Jon and Sparkie",          ["Big_Jon_and_Sparkie"], {"min": 6*60}),
    "the-railroad-hour":           ("The Railroad Hour",            ["OTRR_Railroad_Hour_Singles"], {"min": 20*60}),
    "the-henry-morgan-show":       ("The Henry Morgan Show",        ["TheHenryMorganShowPartOne", "TheHenryMorganShowPartTwo", "TheHenryMorganShowPartThree"], {"min": 15*60}),
    "walter-winchell":             ("Walter Winchell",              ["WWII_News_19410518_Walter_Winchell", "WWII_News_19450225_Walter_Winchell", "WWII_News_19450422_Walter_Winchell",
                                                                     "WWII_News_19450506_Walter_Winchell", "WalterWinchellJHMC", "WalterWinchell411207JapaneseNationalsAreToBeInterned"], {"min": 5*60}),
    "drew-pearson":                ("Drew Pearson",                 ["WWII_News_19450422_Drew_Pearson", "WWII_News_19450506_Drew_Pearson"], {"min": 5*60}),
    "hop-harrigan":                ("Hop Harrigan",                 ["otr_hopharrigan"], {"min": 8*60}),
    "paul-whiteman":               ("Paul Whiteman",                ["PaulWhitemanJHMC"], {"min": 15*60}),
    # NBC
    "cavalcade-of-america":        ("Cavalcade of America",         ["OTRR_Cavalcade_of_America_Singles"], {"min": 15*60}),
    "jack-benny-nbc":              ("The Jack Benny Program (NBC years)", ["TheJackBennyProgram"], {"min": 20*60, "years": (1934, 1948)}),
    "fred-allen-1945":             ("The Fred Allen Show (1945-49)", ["FredAllen--theFredAllenShow1945-1949"], {"min": 15*60}),
    "kraft-music-hall":            ("Kraft Music Hall",              ["KraftMusicHallWithBingCrosby441221ChristmasShow", "KraftMusicHallWithAlJolson471127DorothyLamour"], {"min": 15*60}),
    "truth-or-consequences":       ("Truth or Consequences",        ["TruthorConsequences"], {"min": 15*60}),
    "a-date-with-judy":            ("A Date with Judy",             ["A_Date_With_Judy"], {"min": 15*60}),
    "the-judy-canova-show":        ("The Judy Canova Show",         ["The.Judy.Canova.Show"], {"min": 15*60}),
    "people-are-funny":            ("People Are Funny",             ["PeopleAreFunny"], {"min": 15*60}),
    "the-big-story":               ("The Big Story",                ["OTRR_Big_Story_Singles"], {"min": 15*60}),
    "dennis-day":                  ("A Day in the Life of Dennis Day", ["otr_dennisday"], {"min": 15*60}),
    "can-you-top-this":            ("Can You Top This?",            ["Can-You-Top_This"], {"min": 15*60}),
    "grand-ole-opry":              ("Grand Ole Opry",               ["GrandOleOpryOtr"], {"min": 15*60}),
    "your-hit-parade":             ("Your Hit Parade",              ["YourHitParade19440506", "YourHitParadeMarch201948"], {"min": 15*60}),
    "the-roy-rogers-show":         ("The Roy Rogers Show",          ["The_Roy_Rogers_Show"], {"min": 15*60}),
    # CBS
    "beulah":                      ("Beulah",                       ["TheBeulahShow"], {"min": 8*60}),
    "life-with-luigi":             ("Life with Luigi",              ["Life_With_Luigi"], {"min": 15*60}),
    "mr-and-mrs-north":            ("Mr. and Mrs. North",           ["OTRR_Mr_and_Mrs_North_Singles"], {"min": 15*60}),
    "the-fbi-in-peace-and-war":    ("The FBI in Peace and War",     ["FBI_In_Peace_And_War"], {"min": 15*60}),
    "casey-crime-photographer":    ("Casey, Crime Photographer",    ["OTRR_Casey_Crime_Photographer_Singles"], {"min": 15*60}),
    "hallmark-playhouse":          ("Hallmark Playhouse",           ["HallmarkPlayhouse"], {"min": 15*60}),
    "crime-classics":              ("Crime Classics",               ["OTRR_Crime_Classics_Singles"], {"min": 15*60}),
    "romance":                     ("Romance",                      ["OTRR_Certified_Romance_Singles"], {"min": 15*60}),
    "big-town":                    ("Big Town",                     ["BigTown"], {"min": 15*60}),
    "blondie":                     ("Blondie",                      ["OtrBlondie"], {"min": 15*60}),
    "meet-corliss-archer":         ("Meet Corliss Archer",          ["MeetCorlissArcher_14"], {"min": 15*60}),
    "the-thin-man":                ("The Adventures of the Thin Man", ["ThinManOtr"], {"min": 15*60}),
    "kate-smith-hour":             ("The Kate Smith Hour",          ["Kate_Smith_Hour"], {"min": 15*60}),
    "columbia-workshop":           ("Columbia Workshop",            ["ColumbiaWorkshop"], {"min": 10*60}),
    "arthur-godfrey":              ("Arthur Godfrey",               ["Arthur_Godfrey"], {"min": 15*60}),
    "jack-benny-1949":             ("The Jack Benny Program (1949-50)", ["OTRR_Jack_Benny_Singles_1949-1950"], {"min": 20*60}),
    # Mutual
    "captain-midnight":            ("Captain Midnight",             ["Captain_Midnight"], {"min": 8*60}),
    "tom-mix":                     ("Tom Mix Ralston Straight Shooters", ["Tom_Mix"], {"min": 8*60}),
    "bulldog-drummond":            ("Bulldog Drummond",             ["Bulldog_Drummond"], {"min": 15*60}),
    "the-cisco-kid":               ("The Cisco Kid",                ["The-Cisco-Kid-VER.2"], {"min": 15*60}),
    "true-detective-mysteries":    ("True Detective Mysteries",     ["TrueDetectiveMysteries"], {"min": 15*60}),
}
CREDIT = "Episode lists harvested from archive.org item metadata (scripts/otr_station_harvest.py)"


def get(url, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "dxedge-otr-harvest/1"}), timeout=90) as r:
                return json.load(r)
        except Exception:
            if i == tries - 1: raise
            time.sleep(2 * (i + 1))


def meta(ident):
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, re.sub(r"[^\w.-]", "_", ident) + ".json")
    if os.path.exists(p): return json.load(open(p))
    d = get("https://archive.org/metadata/" + urllib.parse.quote(ident))
    json.dump(d, open(p, "w")); return d


def secs(x):
    x = str(x or "0").strip()
    try:
        if ":" in x:
            p = [float(t) for t in x.split(":")]
            return p[-1] + 60 * p[-2] + (3600 * p[-3] if len(p) > 2 else 0)
        return float(x)
    except ValueError:
        return 0.0


# Date patterns seen in these items: 1947.06.30 / 47-06-30 / 470630 / 19450422 / 01-01-1947 / 8-4-47 / 45-09-16
DATE_PATS = [
    re.compile(r"(?<!\d)(\d{4})[-_.](\d{2})[-_.](\d{2})(?!\d)"),          # 1947.06.30
    re.compile(r"(?<!\d)(\d{4})(\d{2})(\d{2})(?!\d)"),                       # 19450422
    re.compile(r"(?<!\d)(\d{2})[-_.](\d{2})[-_.](\d{4})(?!\d)"),            # 01-01-1947 (m-d-Y)
    re.compile(r"(?<!\d)(\d{2})[-_.](\d{2})[-_.](\d{2})(?!\d)"),            # 47-06-30 (y-m-d)
    re.compile(r"(?<!\d)(\d{2})(\d{2})(\d{2})(?!\d)"),                       # 470630
    re.compile(r"(?<!\d)(\d{1,2})-(\d{1,2})-(\d{2})(?!\d)"),                 # 8-4-47 (m-d-y)
]

def parse_date(name):
    stem = re.sub(r"\.[a-z0-9]+$", "", name, flags=re.I)
    for i, pat in enumerate(DATE_PATS):
        m = pat.search(stem)
        if not m: continue
        a, b, c = m.groups()
        try:
            if i == 0 or i == 1: y, mo, d = int(a), int(b), int(c)
            elif i == 2: mo, d, y = int(a), int(b), int(c)
            elif i == 5: mo, d, y = int(a), int(b), 1900 + int(c)
            else: y, mo, d = 1900 + int(a), int(b), int(c)
            if y < 100: y += 1900
            if not (1925 <= y <= 1965): continue
            dt = datetime.date(y, mo, d)
            return "%02d %s %d" % (dt.day, MONTHS[dt.month - 1], dt.year), stem[m.end():]
        except ValueError:
            continue
    return "", stem


def clean_title(rest, name, show_name, date="", prefix="", alias=""):
    t = rest or re.sub(r"\.[a-z0-9]+$", "", name, flags=re.I)
    t = re.sub(r"\.(mp3|MP3)$", "", t)
    t = t.replace("_", " ").replace("--", " ").strip(" -_.,")
    if " " not in t:                                                                          # Letters123Digits
        t = re.sub(r"(?<=[A-Za-z])(?=\d)|(?<=\d)(?=[A-Za-z])", " ", t)
    t = " ".join(re.sub(r"(?<=[a-z])(?=[A-Z])", " ", w) if (len(w) >= 10 and not w.startswith("Mc") and re.search(r"[a-z][A-Z][a-z]", w)) else w
                 for w in t.split(" "))                                                       # CamelCaseTitles
    t = re.sub(r"\((?:\d{4}|\d{2}-\d{2}-\d{4}|\d{2}\.\d{2}\.\d{4})\)", "", t)            # stray date in parens
    bare = re.sub(r"^the\s+", "", show_name, flags=re.I)
    if alias: t = re.sub(r"^(?:%s)\b[\s:-]*" % alias, "", t, flags=re.I)
    t = re.sub(r"^(?:the\s+)?(?:%s)\b[\s:-]*" % re.escape(bare), "", t, flags=re.I)         # show name prefix
    t = re.sub(r"^(?:ep|episode)?\s*0*\d{1,4}\s*[-_.)]*\s*", "", t, flags=re.I)              # leading episode numbers
    t = re.sub(r"\b(?:ep|episode)\s*0*\d{1,3}\b", "", t, flags=re.I)
    t = re.sub(r"\(\s*\d{1,4}\s*\)", "", t)
    t = re.sub(r"\s+0\d{2,3}$", "", t)                                                          # trailing chapter numbers
    t = re.sub(r"\b(?:AFRS|sound|xx|xx-xx-xx|19xx\.xx\.xx)\b", "", t, flags=re.I)
    for noise in ("Broadcast of", "Guests -", "Guest -", "pt1 only", "pt2 only", "RAW"):
        t = t.replace(noise, " ")
    t = re.sub(r"\s+", " ", t).strip(" -_.,:()")
    t = re.sub(r"^(?:%s)\b[\s:-]*" % re.escape(bare), "", t, flags=re.I)                     # again, after numbers
    t = t[:1].upper() + t[1:]
    if not t or re.fullmatch(r"[\d\s.\-/]+", t) or t.lower() == bare.lower():
        return ("Broadcast of " + date) if date else show_name
    return prefix + t


def harvest(show_id, spec):
    name, idents, opt = spec
    eps, report = [], []
    for ii, ident in enumerate(idents):
        d = meta(ident)
        files = [f for f in d.get("files", []) if f.get("name", "").lower().endswith(".mp3")]
        orig = [f for f in files if f.get("source", "original") == "original"]
        if orig: files = orig
        kept = 0
        for f in files:
            dur = int(round(secs(f.get("length"))))
            if dur < opt.get("min", 60): continue
            if opt.get("skip") and re.search(opt["skip"], f["name"]): continue
            date, rest = parse_date(f["name"])
            if opt.get("years") and date:
                y = int(date[-4:])
                if not (opt["years"][0] <= y <= opt["years"][1]): continue
            if re.fullmatch(r"[a-z]{2,6}\d+", re.sub(r"\.mp3$", "", f["name"], flags=re.I)) and f.get("title"):
                rest = f["title"]                                                              # bare codes like ftmn6846.mp3 carry a title field
            title = clean_title(rest, f["name"], name, date, opt.get("prefix", ""), opt.get("alias", ""))
            fn = urllib.parse.quote(f["name"], safe="()'!*~-._")
            eps.append([title, date, dur, ii, fn]); kept += 1
        report.append("%s: %d of %d files" % (ident, kept, len(files)))
    # chronological order where dates exist (serials need it); undated keep file order after the dated ones
    def key(e):
        if not e[1]: return (1, 0)
        dt = datetime.datetime.strptime(e[1], "%d %b %Y")
        return (0, dt.toordinal())
    eps.sort(key=key)
    return {"id": show_id, "name": name, "ch": [], "adv": False, "st": True, "ids": list(idents), "eps": eps}, report


def load_grid(station):
    return json.load(open(os.path.join(STATIONS, station + ".grid.json")))


def check(station, shows):
    """Validate a grid: every show id resolves, pools are non-empty, slots never overlap, times parse."""
    grid = load_grid(station)
    cat = json.load(open(os.path.join(OTR, "catalog.json")))
    ids = {s["id"] for s in cat["shows"] if not s.get("adv")} | {s["id"] for s in shows}
    errs = []
    pre = station + ": "
    def mins(t):
        m = re.fullmatch(r"(\d{2}):(\d{2})", t)
        if not m: errs.append("bad time " + t); return 0
        return int(m.group(1)) * 60 + int(m.group(2))
    for pname, pool in grid["pools"].items():
        if not pool: errs.append(pre + "empty pool " + pname)
        for sid in pool:
            if sid not in ids: errs.append(pre + "pool %s: unknown show %s" % (pname, sid))
    for sid in grid.get("serial", []):
        if sid not in ids: errs.append(pre + "serial: unknown show " + sid)
    for d in grid["defaults"]:
        mins(d["from"]); mins(d["to"])
        if d["pool"] not in grid["pools"]: errs.append(pre + "defaults: unknown pool " + d["pool"])
    for s in grid["slots"]:
        if "show" in s and s["show"] not in ids: errs.append(pre + "slot %s: unknown show %s" % (s["at"], s["show"]))
        if "pool" in s and s["pool"] not in grid["pools"]: errs.append(pre + "slot %s: unknown pool %s" % (s["at"], s["pool"]))
        if "show" not in s and "pool" not in s: errs.append(pre + "slot %s: neither show nor pool" % s["at"])
        if s.get("conf") not in ("verified", "likely", "approx", "fill"): errs.append(pre + "slot %s: bad conf" % s["at"])
    for day in range(7):
        iv = sorted((mins(s["at"]), mins(s["at"]) + s["len"], s.get("show") or s.get("label")) for s in grid["slots"] if day in s["days"])
        for a, b in zip(iv, iv[1:]):
            if b[0] < a[1]: errs.append(pre + "day %d: %s overlaps %s" % (day, a, b))
        if iv and iv[-1][1] > 24 * 60: errs.append(pre + "day %d: %s runs past midnight" % (day, iv[-1]))
    return errs


def stations():
    return sorted(f[:-10] for f in os.listdir(STATIONS) if f.endswith(".grid.json"))


def main():
    dry = "--dry-run" in sys.argv
    only_check = "--check" in sys.argv
    out = os.path.join(STATIONS, "shows.json")
    if only_check and os.path.exists(out):
        shows = json.load(open(out))["shows"]
    else:
        shows = []
        for sid, spec in HARVEST.items():
            show, rep = harvest(sid, spec)
            shows.append(show)
            total = sum(e[2] for e in show["eps"])
            dated = sum(1 for e in show["eps"] if e[1])
            print("%-30s %4d eps  %5.1f h  dated %3d   %s" % (sid, len(show["eps"]), total / 3600, dated, "; ".join(rep)))
            for e in show["eps"][:2]: print("      ", e[1] or "(undated)", "|", e[0], "|", e[2] // 60, "min")
    errs = []
    for st in stations(): errs += check(st, shows)
    for e in errs: print("GRID ERROR:", e)
    if only_check or dry:
        print("check only" if only_check else "dry run", "- grids", ", ".join(stations()), "OK" if not errs else "have %d errors" % len(errs))
        sys.exit(1 if errs else 0)
    data = {"version": 2, "generated": datetime.date.today().isoformat(), "source": CREDIT,
            "prefix": "https://archive.org/download/", "shows": shows}
    os.makedirs(STATIONS, exist_ok=True)
    with open(out, "w") as f:
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
    print("wrote", out, "(%d shows, %d episodes, %.0f kB)" % (len(shows), sum(len(s["eps"]) for s in shows), os.path.getsize(out) / 1024))
    sys.exit(1 if errs else 0)


if __name__ == "__main__":
    main()
