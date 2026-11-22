#!/usr/bin/env python3
"""Surprise me's fit, measured: how much a seed's fitted level moves between draws, how often the Su. loudness
check's statistic would cross its bound, and how long a draw takes in the page. Our own code. Not part of the suite.

Why: a render is not the same twice (each note starts its oscillators at a random phase, and drift and noise come
from Math.random), and the fit sets a draw's out.level from one render. On a draw whose loudness moves from strike to
strike, the level then depends on which strike the fit heard, and the Su. check (the loudest 100 ms, median of 3
renders, at most -14 dBFS) fails now and then with no code change. This script puts numbers on that.

For each seed the Su. section uses (12 a device, seed = i * 40503 + 11), and each tree given:
  reps times: draw and fit the seed in the page (__synth.surprise.draw), then render the fitted draw's held chord
  --checks times as the suite does (rack on, master effects off) and take the median of the loudest 100 ms.
Prints per seed: the fitted levels' spread (dB), the check statistic's worst and how many reps crossed -14 and -16
dBFS, and the draw's median ms; then each tree's draw ms (median, 90th percentile, worst) and crossings in all.
With two trees the rounds alternate, so a slow patch of the box lands on both.

  python3 scripts/bench_surprise_fit.py                          # this tree, 3 reps a seed, 3 check renders
  python3 scripts/bench_surprise_fit.py --reps 30 --seeds 40514,202526 --devices filament
  python3 scripts/bench_surprise_fit.py --tree /path/to/other/checkout --tree .   # A/B
  --time-only skips the check renders (draw time only); --json FILE writes everything.
"""
import argparse, base64, functools, http.server, json, math, os, socketserver, statistics, sys, threading

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000


class Handler(http.server.SimpleHTTPRequestHandler):
    """Static files, plus the two answers production gives that a tree has no file for (as test_synth.py does)."""
    def log_message(self, *a, **k): pass
    def do_GET(self):
        if self.path.split("?")[0] == "/favicon.svg":
            b = b"<svg xmlns='http://www.w3.org/2000/svg'/>"
            self.send_response(200); self.send_header("Content-Type", "image/svg+xml")
            self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b); return
        return super().do_GET()
    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n: self.rfile.read(n)
        self.send_response(204); self.end_headers()


def serve(tree, port):
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    socketserver.ThreadingTCPServer.daemon_threads = True
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", port), functools.partial(Handler, directory=os.path.join(tree, "frontend", "public")))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{port}/synth/"


def loudest_100ms(L, R):
    """The suite's statistic: the loudest 100 ms window (hop 50 ms) of the stereo power, in dBFS."""
    import numpy as np
    w = int(0.1 * SR); e = (L ** 2 + R ** 2) / 2
    best = max(float(np.mean(e[s:s + w])) for s in range(0, len(e) - w, w // 2))
    return 20 * math.log10(max(math.sqrt(best), 1e-12))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--tree", action="append", help="repo checkout to serve (repeat for an A/B); default this one")
    ap.add_argument("--reps", type=int, default=3, help="draws a seed per tree (default 3)")
    ap.add_argument("--checks", type=int, default=3, help="check renders a draw, median taken (default 3, as Su.)")
    ap.add_argument("--devices", default="filament,cathode")
    ap.add_argument("--seeds", default="", help="comma list; default the 12 Su. seeds")
    ap.add_argument("--bound", type=float, default=-14.0, help="the Su. check's upper bound, dBFS (default -14)")
    ap.add_argument("--time-only", action="store_true", help="draw time only, no check renders")
    ap.add_argument("--port", type=int, default=8850)
    ap.add_argument("--json", default="")
    a = ap.parse_args()
    import numpy as np
    sys.path.insert(0, HERE)
    from synth_chromium import find_chromium
    from playwright.sync_api import sync_playwright

    trees = [os.path.abspath(t) for t in (a.tree or [os.path.join(HERE, "..")])]
    devs = [d for d in a.devices.split(",") if d]
    only = {int(x) for x in a.seeds.split(",") if x.strip()}
    seeds = [(d, (i * 40503 + 11) & 0xffffffff) for d in devs for i in range(12)]
    if only: seeds = [(d, s) for d, s in seeds if s in only]
    if not seeds: sys.exit("no seeds to run")
    urls = [serve(t, a.port + k) for k, t in enumerate(trees)]
    res = {t: {f"{d}:{s}": {"levels": [], "stat": [], "ms": [], "name": None} for d, s in seeds} for t in trees}

    def dec(r):
        return [np.frombuffer(base64.b64decode(r[k]), dtype=np.float32).astype(np.float64) for k in ("L", "R")]

    with sync_playwright() as pw:
        b = pw.chromium.launch(executable_path=find_chromium(), args=["--autoplay-policy=no-user-gesture-required"])
        pages = {}
        for t, u in zip(trees, urls):
            pg = b.new_page(); pg.goto(u); pg.wait_for_function("window.__synth && __synth.ready()", timeout=30000)
            pages[t] = (pg, pg.evaluate("__synth.surprise.fit()"))
        for rep in range(a.reps):
            for t in (trees if rep % 2 == 0 else trees[::-1]):
                pg, fit = pages[t]
                for d, s in seeds:
                    r = res[t][f"{d}:{s}"]
                    dr = pg.evaluate("a => __synth.surprise.draw(a[0], a[1])", [d, s])
                    r["ms"].append(dr["ms"])
                    if not dr["patch"]: r["levels"].append(None); continue
                    P = dr["patch"]; r["levels"].append(dr["level"]); r["name"] = P.get("name")
                    if a.time_only: continue
                    root = 36 if P["cat"] == "Bass" else 60
                    ns = [root] if (d == "cathode" or P["cat"] == "Bass") else [root, root + 4, root + 7]
                    ev = [e for n in ns for e in ({"at": 0.02, "t": "on", "n": n, "v": 1.0}, {"at": fit["hold"], "t": "off", "n": n})]
                    got = []
                    for _ in range(a.checks):
                        L, R = dec(pg.evaluate("a => __synth.render(a)", {"patch": P, "events": ev, "seconds": fit["seconds"],
                                                                          "rack": True, "mono": False, "masterFx": False}))
                        got.append(loudest_100ms(L, R))
                    r["stat"].append(round(float(np.median(got)), 2))
            print(f"rep {rep + 1}/{a.reps} done", file=sys.stderr, flush=True)
        b.close()

    for t in trees:
        print(f"\n== {t}")
        allms, cross, n = [], 0, 0
        for key, r in res[t].items():
            lv = [x for x in r["levels"] if x is not None]
            st = r["stat"]; allms += r["ms"]
            c14 = sum(1 for x in st if x > a.bound); c16 = sum(1 for x in st if x > a.bound - 2)
            cross += c14; n += len(st)
            print(f"{key:18s} {str(r['name'])[:22]:22s} level spread {max(lv) - min(lv) if lv else float('nan'):5.1f} dB"
                  + (f"  check worst {max(st):6.2f}  over {a.bound:g}: {c14}/{len(st)}  over {a.bound - 2:g}: {c16}/{len(st)}" if st else "")
                  + f"  draw {statistics.median(r['ms']):.0f} ms" + (f"  ({r['levels'].count(None)} none)" if None in r["levels"] else ""))
        allms.sort()
        print(f"draw ms: median {statistics.median(allms):.0f}, p90 {allms[int(0.9 * (len(allms) - 1))]:.0f}, worst {allms[-1]:.0f}"
              + (f"; check statistic over {a.bound:g} dBFS in {cross} of {n} draws" if n else ""))
    if a.json:
        with open(a.json, "w") as fh: json.dump(res, fh)


if __name__ == "__main__":
    main()
