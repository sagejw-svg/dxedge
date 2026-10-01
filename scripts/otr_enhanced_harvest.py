#!/usr/bin/env python3
"""Build frontend/public/otr/enhanced.json: better copies of /otr catalog episodes on archive.org.

Sources: the "Digitally Restored" collections (processed restorations) and the Ron Bowser-John
Dunning Project (archive.org items BDP_*), lossless FLAC
transfers of John Dunning's collection, which archive.org also serves as VBR MP3. An episode
is mapped only when all of these hold:
  * the catalog show matches a BDP item by name,
  * a BDP file carries the same broadcast date and a similar title,
  * its runtime is within 25% of the catalog copy (guards against partials / wrong programs),
  * its MP3 is at least MIN_GAIN x the catalog file's bitrate.
"Better" here is provenance plus bitrate, not a listening test.

Run:  python3 scripts/otr_enhanced_harvest.py            # write enhanced.json + print report
      python3 scripts/otr_enhanced_harvest.py --dry-run  # report only
Metadata is cached in $IA_CACHE (default /tmp/iacache) so reruns are cheap.
"""
import datetime, difflib, json, os, re, sys, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
OTR = os.path.join(HERE, "..", "frontend", "public", "otr")
CACHE = os.environ.get("IA_CACHE", "/tmp/iacache")
MIN_GAIN = 1.25
CREDIT = "Ron Bowser-John Dunning Project"
STOP = {"the", "a", "an", "of", "and", "to", "in", "on", "for", "at", "is", "with", "by"}
MON = {m: i + 1 for i, m in enumerate("jan feb mar apr may jun jul aug sep oct nov dec".split())}

def get(url, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "dxedge-otr-harvest/1"}), timeout=60) as r:
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

def words(s):
    s = re.sub(r"['\u2018\u2019`]", "", str(s).lower())
    return [w for w in re.split(r"[^a-z0-9]+", s) if w and w not in STOP]

NOISE = {"lq", "afrs", "poss", "possibly", "aka", "dm", "jd", "reel", "track", "audition", "rebroadcast", "version", "vers", "ep", "show"}
DAMAGE = re.compile(r"\b(lq|low quality|poor|partial|incomplete|dropouts?|thumps?|distort\w*|noisy|clipped|bad sound|missing|end cut|cut off|truncated)\b", re.I)

def twords(t):
    t = re.sub(r"\([^)]*\)", " ", str(t))                       # parentheticals are archivist notes
    return [w for w in words(t) if not w.isdigit() and w not in NOISE and not re.fullmatch(r"ep\d+|\d+[a-z]?", w)]

def wmatch(a, b):
    return a == b or (min(len(a), len(b)) >= 4 and difflib.SequenceMatcher(None, a, b).ratio() >= 0.8)

def sim(a, b):
    A, B = list(dict.fromkeys(twords(a))), list(dict.fromkeys(twords(b)))
    if not A or not B: return 0.0
    if len(A) > len(B): A, B = B, A
    return sum(1 for w in A if any(wmatch(w, x) for x in B)) / len(A)   # overlap, tolerant of extra words and spelling

def show_key(s):
    w = [x for x in words(s) if x not in {"adventures", "show", "program", "mysteries", "mystery", "private", "detective", "master", "theater", "theatre", "radio"}]
    return set(w)

def cat_iso(d):
    m = re.match(r"^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$", str(d).strip())
    return f"{m.group(3)}-{MON[m.group(2).lower()]:02d}-{int(m.group(1)):02d}" if m else ""

def file_iso(name):
    d = _file_iso(name)
    try: datetime.date.fromisoformat(d); return d
    except ValueError: return ""

def _file_iso(name):
    n = os.path.basename(name)
    m = re.search(r"(?<!\d)(\d{2})-(\d{2})-(\d{2})(?!\d)", n)
    if m:  # BDP uses both MM-DD-YY and YY-MM-DD; OTR years (13..62) are > 12, so a leading field > 12 is the year
        a, b, c = int(m.group(1)), int(m.group(2)), int(m.group(3))
        yy, mm, dd = (a, b, c) if a > 12 else (c, a, b)
        if 1 <= mm <= 12 and 1 <= dd <= 31: return f"19{yy:02d}-{mm:02d}-{dd:02d}"
    m = re.search(r"(?<!\d)(19[2-6]\d)[-_. ](\d{2})[-_. ](\d{2})(?!\d)", n)  # YYYY-MM-DD
    if m: return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = re.search(r"(?<!\d)([2-6]\d)(\d{2})(\d{2})(?!\d)", n)              # YYMMDD
    if m and 1 <= int(m.group(2)) <= 12 and 1 <= int(m.group(3)) <= 31: return f"19{m.group(1)}-{m.group(2)}-{m.group(3)}"
    return ""

def file_title(name):
    n = os.path.splitext(os.path.basename(name))[0]
    n = re.sub(r"^.*?\d{2}-\d{2}-\d{2}", "", n)         # drop show / number / date prefix
    return re.sub(r"[-_ .]+$", "", n).strip(" -_")

# Sources, best first when an episode has more than one. Restorations are processed copies
# (declick, denoise, EQ); transfers are unprocessed but lossless-sourced. Each must still beat the
# circulating copy's bitrate by MIN_GAIN, and none is a listening test.
SOURCES = [
    # (archive.org query, method, credit, how to strip the show name out of the item title)
    ('title:("digitally restored") AND mediatype:audio', "restoration", "Digitally Restored collection",
     r"\s*(\(|;|\bradio\b\s+digitally|\bdigitally\b|\bwith\b).*$"),
    ("identifier:BDP_* OR identifier:bdp_*", "transfer", "Ron Bowser-John Dunning Project", None),
]
EXTRA = [  # single vetted items: identifier, catalog show id, method, credit, date for files that carry none
    # AI restorations made with scripts/otr_restore.py go here once uploaded, e.g.
    # ("lights-out-ai-enhanced-dxedge", "lights-out", "ai-enhanced", "AI restored for dxedge.net", None),
    ("oldtimeradioremastered", "x-minus-one", "remaster", "Old Time Radio Remastered", None),
    ("war-of-the-worlds_mixdown3", "mercury-theatre", "remaster", "War of the Worlds remaster", "1938-10-30"),
]
RANK = {"ai-enhanced": -1, "remaster": 0, "restoration": 0, "transfer": 1}

def show_name(title, strip):
    t = str(title)
    if strip is None: return re.sub(r"^.*?Project[s]?\s*-?\s*", "", t)
    return re.sub(strip, "", t, flags=re.I)

def main():
    dry = "--dry-run" in sys.argv
    cat = json.load(open(os.path.join(OTR, "catalog.json")))
    shows = [s for s in cat["shows"] if not s.get("adv")]
    byid = {s["id"]: s for s in shows}
    items = []
    for q, method, credit, strip in SOURCES:
        docs = get("https://archive.org/advancedsearch.php?q=" + urllib.parse.quote(q) + "&fl%5B%5D=identifier&fl%5B%5D=title&rows=500&output=json")["response"]["docs"]
        if method == "transfer": docs = [d for d in docs if "Dunning" in str(d.get("title", ""))]
        for d in docs:
            items.append({"identifier": d["identifier"], "method": method, "credit": credit, "date": None,
                          "key": show_key(show_name(d.get("title", ""), strip)), "show": None})
    for ident, sid, method, credit, date in EXTRA:
        items.append({"identifier": ident, "method": method, "credit": credit, "date": date, "key": set(), "show": sid})

    pairs = []
    for s in shows:
        k = show_key(s["name"]); mine = [it for it in items if it["show"] == s["id"]]
        best = {}
        for it in items:
            if it["show"] or not k or not it["key"]: continue
            j = len(k & it["key"]) / len(k | it["key"])
            if j >= 0.6 and j >= best.get(it["method"], (0,))[0]:
                if j > best.get(it["method"], (0,))[0]: best[it["method"]] = (j, [])
                best[it["method"]][1].append(it)                    # keep re-uploads of the same collection
        for m in best.values(): mine += m[1]
        if mine: pairs.append((s, mine))
    print(f"{len(pairs)} catalog shows have a better source:")
    for s, its in pairs: print(f"  {s['name']:45s} <- {', '.join(i['identifier'] for i in its)}")

    idents = sorted({i for s, _ in pairs for i in s["ids"]} | {it["identifier"] for _, its in pairs for it in its})
    with ThreadPoolExecutor(8) as ex: M = dict(zip(idents, ex.map(meta, idents)))

    out, report = {}, []
    for s, its in pairs:
        cand = {}
        for it in its:
            for f in M[it["identifier"]].get("files", []):
                if "MP3" not in str(f.get("format", "")) or not f["name"].lower().endswith(".mp3"): continue
                src = f.get("original") or f["name"]
                iso = file_iso(src) or it["date"] or ""
                L = secs(f.get("length"))
                if not iso or L < 60 or DAMAGE.search(src): continue
                ttl = file_title(src) if file_iso(src) else (M[it["identifier"]].get("metadata", {}).get("title") or "")
                cand.setdefault(iso, []).append({"iso": iso, "ident": it["identifier"], "name": f["name"], "len": L, "method": it["method"],
                                                 "credit": it["credit"], "kbps": int(f.get("size") or 0) * 8 / L / 1000, "title": ttl})
        orig = {}
        for ident in s["ids"]:
            for f in M[ident].get("files", []):
                L = secs(f.get("length"))
                if L > 0 and f.get("size"): orig[(ident, f["name"])] = int(f["size"]) * 8 / L / 1000
        n_map = n_date = 0; why = {}
        for e in s["eps"]:
            iso = cat_iso(e[1]); undated = not iso
            if undated: iso = file_iso(urllib.parse.unquote(e[4]))   # e.g. Gunsmoke: no catalog date, dated filenames
            if not iso: continue
            ob = orig.get((s["ids"][e[3]], urllib.parse.unquote(e[4])))
            def ok(x): return 0.75 <= x["len"] / max(e[2], 1) <= 1.35 and ob and x["kbps"] >= MIN_GAIN * ob
            c = None
            if iso in cand:
                n_date += 1
                good = [x for x in cand[iso] if sim(e[0], x["title"]) >= 0.5 and twords(x["title"]) and twords(e[0])]
                if len(cand[iso]) > 1 and not good: why["ambiguous"] = why.get("ambiguous", 0) + 1
                fits = [x for x in good if ok(x)]
                if good and not fits: why["no gain/length"] = why.get("no gain/length", 0) + 1; continue
                if fits: c = min(fits, key=lambda x: (RANK[x["method"]], -sim(e[0], x["title"]), -x["kbps"]))
            if c is None:   # same story filed under a nearby date: needs a strong, multi-word title match
                d0 = datetime.date.fromisoformat(iso); near = []
                for k in range(-10, 11):
                    for x in cand.get((d0 + datetime.timedelta(days=k)).isoformat(), []):
                        if min(len(twords(e[0])), len(twords(x["title"]))) >= 2 and sim(e[0], x["title"]) >= 0.75 and ok(x): near.append(x)
                if near and len({x["iso"] for x in near}) == 1:          # one episode, possibly in more than one source
                    c = min(near, key=lambda x: (RANK[x["method"]], -x["kbps"])); why["date shifted"] = why.get("date shifted", 0) + 1
                else:
                    if iso in cand: why["title"] = why.get("title", 0) + 1
                    continue
            key = (fileStem(e[4]) if undated else f"{s['id']}|{iso}|{e[0]}")
            out[key] = {"url": "https://archive.org/download/" + urllib.parse.quote(c["ident"]) + "/" + urllib.parse.quote(c["name"]),
                        "duration": round(c["len"]), "credit": c["credit"], "method": c["method"],
                        "notes": f"{round(c['kbps'])} kbps vs {round(ob)} kbps circulating", "_score": sim(e[0], c["title"])}
            n_map += 1
        report.append((s["name"], len(s["eps"]), n_date, n_map, why))

    print("\nshow, catalog eps, same-date candidates, mapped")
    for r in sorted(report, key=lambda r: -r[3]): print(f"  {r[0]:45s} {r[1]:4d} {r[2]:4d} {r[3]:4d}  {r[4] or ''}")
    meth = {}
    for v in out.values(): meth[v["method"]] = meth.get(v["method"], 0) + 1
    print(f"\n{len(out)} episodes mapped {meth}")
    if "--audit" in sys.argv:
        for k, v in sorted(out.items(), key=lambda kv: kv[1]["_score"])[:30]: print(f"  {v['_score']:.2f} {k[:70]:70s} <- {urllib.parse.unquote(v['url'].rsplit('/',1)[1])[:70]}")
    for v in out.values(): v.pop("_score", None)
    if not dry:
        doc = {"version": 1, "policy": "any-better", "generated": time.strftime("%Y-%m-%d"),
               "source": "scripts/otr_enhanced_harvest.py", "episodes": dict(sorted(out.items()))}
        json.dump(doc, open(os.path.join(OTR, "enhanced.json"), "w"), indent=1, ensure_ascii=False)
        print("wrote enhanced.json", os.path.getsize(os.path.join(OTR, "enhanced.json")), "bytes")

def fileStem(f):  # must match fileStem() in otr/index.html: last path part, no extension, lower case
    return re.sub(r"\.[a-z0-9]+$", "", re.sub(r"^.*/", "", str(f)), flags=re.I).lower()

if __name__ == "__main__":
    main()
