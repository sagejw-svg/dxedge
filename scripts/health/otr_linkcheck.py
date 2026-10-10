#!/usr/bin/env python3
"""Dead-link watch for the /otr player's audio: every station-only episode in
frontend/public/otr/stations/shows.json, plus a rotating sample of the
catalog and the enhanced copies, HEAD-checked against archive.org.

Why: archive.org items get darkened or re-uploaded now and then, and the
player can only skip a dead file at play time. This runs weekly beside the
site link-rot check (.github/workflows/linkcheck.yml) and publishes

    https://dxedge.net/health/otr-links.json

for the nightly health check to read (parse the body as JSON; a missing file
falls through to the SPA's index.html with HTTP 200). The report lists dead
station-only files by show id and file name, and scripts/otr_station_harvest.py
--prune reads it to drop them from shows.json (and rebuilds the search lines).

archive.org answers a download URL with a 302 to a storage node and the node
with 200 (or 206). We follow redirects and treat any 2xx/3xx final answer as
alive. 404 and 410 are dead. Anything else (timeouts, 5xx, 429) is "unsure"
and is never pruned: it is almost always a node hiccup.

Usage: python3 scripts/health/otr_linkcheck.py [-o out/otr-links.json] [--sample N] [--workers N]
Exits 0 unless the checker itself fails.
"""
import argparse, concurrent.futures, hashlib, json, random, sys, time, urllib.error, urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
OTR = REPO / "frontend" / "public" / "otr"
UA = "dxedge-otr-linkcheck/1 (+https://dxedge.net/otr)"


class Head(urllib.request.HTTPRedirectHandler):
    pass


def check(url, timeout=30):
    """Return ('ok'|'dead'|'unsure', status, note)."""
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": UA})
    for attempt in range(2):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return ("ok", r.status, "")
        except urllib.error.HTTPError as e:
            if e.code in (404, 410): return ("dead", e.code, "")
            if e.code in (403, 401, 405):   # some nodes refuse HEAD: try a 1-byte GET
                try:
                    g = urllib.request.Request(url, headers={"User-Agent": UA, "Range": "bytes=0-0"})
                    with urllib.request.urlopen(g, timeout=timeout) as r:
                        return ("ok", r.status, "range get")
                except urllib.error.HTTPError as e2:
                    if e2.code in (404, 410): return ("dead", e2.code, "")
                    return ("unsure", e2.code, "")
                except Exception as e2:
                    return ("unsure", 0, type(e2).__name__)
            if e.code in (429, 503) and attempt == 0:
                time.sleep(8); continue
            return ("unsure", e.code, "")
        except Exception as e:
            if attempt == 0: time.sleep(3); continue
            return ("unsure", 0, type(e).__name__)
    return ("unsure", 0, "retries")


def url_for(prefix, show, ep):
    return prefix + show["ids"][ep[3]] + "/" + ep[4]


def week_key():
    return datetime.now(timezone.utc).strftime("%G-%V")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-o", "--out", default="out/otr-links.json")
    ap.add_argument("--sample", type=int, default=400, help="catalog + enhanced URLs to sample this week (rotates weekly)")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--limit", type=int, default=0, help="debug: check at most this many URLs")
    a = ap.parse_args()

    stations = json.load(open(OTR / "stations" / "shows.json"))
    catalog = json.load(open(OTR / "catalog.json"))
    try:
        enhanced = json.load(open(OTR / "enhanced.json")).get("episodes", {})
    except Exception:
        enhanced = {}

    targets = []   # (group, show_id, name, url)
    for s in stations["shows"]:
        for e in s["eps"]:
            targets.append(("station", s["id"], e[4], url_for(stations["prefix"], s, e)))
    pool = []
    for s in catalog["shows"]:
        for e in s["eps"]:
            pool.append(("catalog", s["id"], e[4], url_for(catalog["prefix"], s, e)))
    for k, v in enhanced.items():
        if isinstance(v, dict) and isinstance(v.get("url"), str):
            pool.append(("enhanced", k.split("|")[0], v["url"].rsplit("/", 1)[-1], v["url"]))
    # a different slice every week, the same slice within a week (re-runs are reproducible)
    rnd = random.Random(int(hashlib.sha1(week_key().encode()).hexdigest()[:8], 16))
    rnd.shuffle(pool)
    targets += pool[:a.sample]
    if a.limit: targets = targets[:a.limit]

    started = time.time()
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=a.workers) as ex:
        for t, (state, status, note) in zip(targets, ex.map(lambda t: check(t[3]), targets)):
            results.append((t, state, status, note))

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "week": week_key(),
        "seconds": round(time.time() - started),
        "checked": {"station": 0, "catalog": 0, "enhanced": 0},
        "ok": 0, "unsure": 0,
        "dead": [],      # every dead URL, with group, show and file
        "unsure_list": [],
        "note": "dead = archive.org answered 404/410 for the file. unsure = timeout, 5xx or 429, usually a storage-node hiccup; never pruned. "
                "scripts/otr_station_harvest.py --prune drops the station entries listed under dead.",
    }
    for (group, sid, name, url), state, status, note in results:
        report["checked"][group] += 1
        if state == "ok": report["ok"] += 1
        elif state == "dead": report["dead"].append({"group": group, "show": sid, "file": name, "url": url, "status": status})
        else:
            report["unsure"] += 1
            report["unsure_list"].append({"group": group, "show": sid, "file": name, "status": status, "note": note})
    report["total"] = sum(report["checked"].values())
    out = Path(a.out); out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=1))
    print("%d checked (%s), %d ok, %d dead, %d unsure, %ds" % (report["total"], report["checked"], report["ok"], len(report["dead"]), report["unsure"], report["seconds"]))
    for d in report["dead"][:40]: print("  DEAD", d["group"], d["show"], d["file"], d["status"])


if __name__ == "__main__":
    main()
