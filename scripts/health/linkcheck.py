#!/usr/bin/env python3
"""Outbound link-rot checker for DXEdge.

Why this exists: the nightly automated health check runs in a sandbox where
each new outbound domain needs a human to approve the fetch, so it cannot
crawl the ~150 external links on the site. This script runs where egress is
normal (a weekly GitHub Actions job, or by hand) and publishes its results as
a static JSON the nightly check reads from the site itself:

    https://dxedge.net/health/linkcheck.json

The weekly workflow (.github/workflows/linkcheck.yml) SCPs the output to
/opt/dxedge/frontend/dist/health/linkcheck.json on the droplet, which the
backend's static-file handler serves at /health/linkcheck.json. deploy.yml's
SCP step copies files over dist/ without deleting extras, so the file
survives normal deploys.

Reader beware: if the file is ever missing, the SPA catch-all answers the URL
with index.html and HTTP 200 - the same trap as /api/feed. Check that the
body parses as JSON, not just the status code.

Classification is deliberately three-way to keep false alarms out of the
nightly report:
  ok      - final response 2xx
  blocked - 401/403/405/429, or a bot-wall page: the link very likely works
            in a real browser (The Register did exactly this), so it is
            reported separately, not as rot
  broken  - 404/410, other 4xx/5xx, DNS failure, timeout, TLS error

Usage: python3 scripts/health/linkcheck.py [-o out/linkcheck.json]
Exits 0 unless the checker itself fails; broken links are data, not a
build failure.
"""
import argparse
import concurrent.futures
import json
import re
import socket
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]

# The four files with outbound links, repo-relative.
SOURCE_FILES = [
    "frontend/src/components/Credits.jsx",
    "frontend/src/components/Products.jsx",
    "frontend/public/cyber/index.html",
    "frontend/public/aethersdr/index.html",
]

URL_RE = re.compile(r"https?://[^\s\"'<>()\\\]\}]+")

# Availability check only, so present as a browser: many sites (correctly)
# 403 obvious bots, and a false "broken" here wastes a nightly escalation.
HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) "
                   "Chrome/128.0.0.0 Safari/537.36"),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

TIMEOUT_S = 20
BLOCKED_STATUSES = {401, 403, 405, 429}
# Hosts that are templates/placeholders, not real endpoints to probe.
SKIP_SUBSTRINGS = ("localhost", "127.0.0.1", "example.com", "{", "%s")

# Not outbound links, so not link rot. These are matched as whole URLs.
#   fonts.googleapis.com / fonts.gstatic.com are <link rel="preconnect">
#   origin hints; the bare origins legitimately 404 and are never navigated to.
#   "https://url" is a fragment of prose inside a script block that URL_RE
#   picks up. All three were reported BROKEN on 2026-09-03 and are noise.
SKIP_EXACT = frozenset({
    "https://fonts.googleapis.com",
    "https://fonts.gstatic.com",
    "https://url",
})

# Client-rendered sites that answer every deep route with HTTP 404 while still
# serving the app shell, so the route renders correctly in a real browser.
# Verified 2026-09-03: https://atlas.mitre.org/techniques/AML.T0020 returns 404
# but renders as "Training Data Poisoning | MITRE ATLAS", and both AML.T0020 and
# AML.T0024 are present in the current mitre-atlas/atlas-data ATLAS.yaml.
# A future run must NOT "repair" these by deleting them.
SPA_404_HOSTS = frozenset({"atlas.mitre.org"})

# Retail and CDN endpoints that answer bots with 503/502 rather than 403.
# Same meaning as BLOCKED_STATUSES: says nothing about the link's health.
BOT_WALL_HOSTS = frozenset({"www.amazon.com"})


def collect_urls():
    """Return {url: [files it appears in]}."""
    found = {}
    for rel in SOURCE_FILES:
        path = REPO / rel
        if not path.is_file():
            print(f"WARNING: missing source file {rel}", file=sys.stderr)
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for m in URL_RE.finditer(text):
            url = m.group(0).rstrip(".,;:!?`&")
            if any(s in url for s in SKIP_SUBSTRINGS) or url in SKIP_EXACT:
                continue
            found.setdefault(url, [])
            if rel not in found[url]:
                found[url].append(rel)
    return found


def check_one(url):
    """Return (status_label, http_status_or_None, note)."""
    last_note = ""
    host = (urllib.parse.urlsplit(url).hostname or "").lower()
    for attempt in (1, 2):
        req = urllib.request.Request(url, headers=HEADERS, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
                resp.read(2048)  # touch the body, don't download it
                return ("ok", resp.status, "")
        except urllib.error.HTTPError as e:
            if e.code in BLOCKED_STATUSES:
                return ("blocked", e.code, "bot-blocked or auth-gated; likely fine in a browser")
            if e.code == 404 and host in SPA_404_HOSTS:
                return ("blocked", e.code,
                        "client-rendered site: 404 status but the route renders in a browser")
            if e.code in (502, 503) and host in BOT_WALL_HOSTS:
                return ("blocked", e.code, "bot-walled with 5xx; likely fine in a browser")
            return ("broken", e.code, "")
        except urllib.error.URLError as e:
            reason = getattr(e, "reason", e)
            if isinstance(reason, socket.gaierror):
                return ("broken", None, f"DNS failure: {reason}")
            if isinstance(reason, ssl.SSLError):
                return ("broken", None, f"TLS error: {reason}")
            last_note = f"connection error: {reason}"
        except (socket.timeout, TimeoutError):
            last_note = f"timeout after {TIMEOUT_S}s"
        except Exception as e:  # noqa: BLE001 - report, never crash the sweep
            last_note = f"{type(e).__name__}: {e}"
        if attempt == 1:
            time.sleep(3)
    return ("broken", None, last_note)


def git_commit():
    try:
        return subprocess.run(
            ["git", "-C", str(REPO), "rev-parse", "--short", "HEAD"],
            capture_output=True, text=True, timeout=10,
        ).stdout.strip() or None
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-o", "--out", default="out/linkcheck.json")
    ap.add_argument("--workers", type=int, default=12)
    args = ap.parse_args()

    urls = collect_urls()
    print(f"Checking {len(urls)} distinct URLs from {len(SOURCE_FILES)} files")

    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(check_one, u): u for u in urls}
        for fut in concurrent.futures.as_completed(futures):
            u = futures[fut]
            label, status, note = fut.result()
            results[u] = {"status": label, "http_status": status,
                          "note": note, "files": urls[u]}
            if label != "ok":
                print(f"  {label.upper():7} {status or '-':>4} {u} {note}")

    def bucket(name):
        return sorted(
            ({"url": u, **r} for u, r in results.items() if r["status"] == name),
            key=lambda d: d["url"],
        )

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "commit": git_commit(),
        "source_files": SOURCE_FILES,
        "total": len(results),
        "ok": sum(1 for r in results.values() if r["status"] == "ok"),
        "blocked": bucket("blocked"),
        "broken": bucket("broken"),
    }

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"\n{report['ok']} ok, {len(report['blocked'])} blocked, "
          f"{len(report['broken'])} broken -> {out}")


if __name__ == "__main__":
    main()
