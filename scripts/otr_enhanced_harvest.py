#!/usr/bin/env python3
"""Build frontend/public/otr/enhanced.json: better copies of /otr catalog episodes on archive.org.

Source so far: the Ron Bowser-John Dunning Project (archive.org items BDP_*), lossless FLAC
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

def main():
    dry = "--dry-run" in sys.argv
    cat = json.load(open(os.path.join(OTR, "catalog.json")))
    shows = [s for s in cat["shows"] if not s.get("adv")]
    bdp = get("https://archive.org/advancedsearch.php?q=identifier%3ABDP_*+OR+identifier%3Abdp_*&fl%5B%5D=identifier&fl%5B%5D=title&rows=500&output=json")["response"]["docs"]
    bdp = [d for d in bdp if "Dunning" in str(d.get("title", ""))]
    for d in bdp: d["key"] = show_key(re.sub(r"^.*?Project[s]?\s*-?\s*", "", str(d["title"])))

    pairs = []
    for s in shows:
        k = show_key(s["name"]); best = None
        for d in bdp:
            if not k or not d["key"]: continue
            j = len(k & d["key"]) / len(k | d["key"])
            if j >= 0.6 and (best is None or j > best[0]): best = (j, d)
        if best: pairs.append((s, [x for x in bdp if x["key"] == best[1]["key"]]))   # include re-uploads (bdp_*_2025xx)
    print(f"{len(pairs)} catalog shows have a Dunning collection:")
    for s, ds in pairs: print(f"  {s['name']:45s} <- {', '.join(d['identifier'] for d in ds)}")

    idents = sorted({i for s, _ in pairs for i in s["ids"]} | {d["identifier"] for _, ds in pairs for d in ds})
    with ThreadPoolExecutor(8) as ex: M = dict(zip(idents, ex.map(meta, idents)))

    out, report = {}, []
    for s, ds in pairs:
        cand = {}
        for d in ds:
            for f in M[d["identifier"]].get("files", []):
                if f.get("format") not in ("VBR MP3", "MP3") or not f["name"].lower().endswith(".mp3"): continue
                iso = file_iso(f.get("original") or f["name"])
                L = secs(f.get("length"))
                if not iso or L < 60 or DAMAGE.search(f.get("original") or f["name"]): continue
                cand.setdefault(iso, []).append({"ident": d["identifier"], "name": f["name"], "len": L,
                                                 "kbps": int(f.get("size") or 0) * 8 / L / 1000, "title": file_title(f.get("original") or f["name"])})
        orig = {}
        for ident in s["ids"]:
            for f in M[ident].get("files", []):
                L = secs(f.get("length"))
                if L > 0 and f.get("size"): orig[(ident, f["name"])] = int(f["size"]) * 8 / L / 1000
        n_map = n_date = 0; why = {}
        for e in s["eps"]:
            iso = cat_iso(e[1])
            if not iso: continue
            c = None
            if iso in cand:
                n_date += 1
                c = max(cand[iso], key=lambda x: (sim(e[0], x["title"]), x["kbps"]))
                t = sim(e[0], c["title"])
                if len(cand[iso]) > 1 and t < 0.5: c = None; why["ambiguous"] = why.get("ambiguous", 0) + 1   # several shows that day
                elif t < 0.5 or not twords(c["title"]) or not twords(e[0]): c = None                           # titles disagree
            if c is None:   # same story filed under a nearby date: needs a strong, multi-word title match
                d0 = datetime.date.fromisoformat(iso); near = []
                for k in range(-10, 11):
                    for x in cand.get((d0 + datetime.timedelta(days=k)).isoformat(), []):
                        if min(len(twords(e[0])), len(twords(x["title"]))) >= 2 and sim(e[0], x["title"]) >= 0.75: near.append(x)
                if len(near) == 1: c = near[0]; why["date shifted"] = why.get("date shifted", 0) + 1
                else:
                    if iso in cand: why["title"] = why.get("title", 0) + 1
                    continue
            if not (0.75 <= c["len"] / max(e[2], 1) <= 1.35): why["length"]=why.get("length",0)+1; continue
            ob = orig.get((s["ids"][e[3]], urllib.parse.unquote(e[4])))
            if not ob or c["kbps"] < MIN_GAIN * ob: why["no gain" if ob else "no orig size"]=why.get("no gain" if ob else "no orig size",0)+1; continue
            key = f"{s['id']}|{iso}|{e[0]}"
            out[key] = {"url": "https://archive.org/download/" + urllib.parse.quote(c["ident"]) + "/" + urllib.parse.quote(c["name"]),
                        "duration": round(c["len"]), "credit": CREDIT, "method": "transfer",
                        "notes": f"lossless-sourced transfer, {round(c['kbps'])} kbps vs {round(ob)} kbps circulating", "_score": sim(e[0], c["title"])}
            n_map += 1
        report.append((s["name"], len(s["eps"]), n_date, n_map, why))

    print("\nshow, catalog eps, same-date BDP files, mapped")
    for r in sorted(report, key=lambda r: -r[3]): print(f"  {r[0]:45s} {r[1]:4d} {r[2]:4d} {r[3]:4d}  {r[4] or ''}")
    print(f"\n{len(out)} episodes mapped")
    if "--audit" in sys.argv:
        for k, v in sorted(out.items(), key=lambda kv: kv[1]["_score"])[:30]: print(f"  {v['_score']:.2f} {k[:70]:70s} <- {urllib.parse.unquote(v['url'].rsplit('/',1)[1])[:70]}")
    for v in out.values(): v.pop("_score", None)
    if not dry:
        doc = {"version": 1, "policy": "any-better", "generated": time.strftime("%Y-%m-%d"),
               "source": "scripts/otr_enhanced_harvest.py", "episodes": dict(sorted(out.items()))}
        json.dump(doc, open(os.path.join(OTR, "enhanced.json"), "w"), indent=1, ensure_ascii=False)
        print("wrote enhanced.json", os.path.getsize(os.path.join(OTR, "enhanced.json")), "bytes")

if __name__ == "__main__":
    main()
