#!/usr/bin/env python3
"""Census of curated outbound links in the four Step 4 files.

Exists so the nightly health run stops re-deriving the denominator and
drifting (160 by script on seven nights, 157 by an ad-hoc extraction on
2026-11-17). The rules below are the ones settled on 2026-10-30 and
reproduced by script on 10-31, 11-01, 11-03, 11-14 and 11-15:

  - regex  https?://[^\\s"'<>()`\\\\]+
  - strip trailing  . , ; :
  - drop any match containing  ${   (template interpolation)
  - drop the literal  https://url  and  http://url  placeholders

Usage:  python3 scripts/health/census.py [--list]
Run from the repo root. Prints the URL count, host count and per-file
counts; --list also prints every URL, sorted, for diffing between nights.
"""
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

FILES = [
    "frontend/src/components/Credits.jsx",
    "frontend/src/components/Products.jsx",
    "frontend/public/cyber/index.html",
    "frontend/public/aethersdr/index.html",
]

URL_RE = re.compile(r"https?://[^\s\"'<>()`\\]+")
PLACEHOLDERS = {"https://url", "http://url"}


def extract(path: Path) -> set:
    text = path.read_text(encoding="utf-8", errors="replace")
    found = set()
    for raw in URL_RE.findall(text):
        url = raw.rstrip(".,;:")
        if "${" in url or url in PLACEHOLDERS:
            continue
        found.add(url)
    return found


def main() -> int:
    root = Path(__file__).resolve().parents[2]
    all_urls, per_file = set(), []
    missing = []
    for rel in FILES:
        p = root / rel
        if not p.exists():
            missing.append(rel)
            per_file.append((rel, 0))
            continue
        urls = extract(p)
        per_file.append((rel, len(urls)))
        all_urls |= urls

    hosts = {urlsplit(u).netloc for u in all_urls}
    for rel, n in per_file:
        print(f"{n:4d}  {rel}")
    print(f"{len(all_urls):4d}  DISTINCT URLS")
    print(f"{len(hosts):4d}  DISTINCT HOSTS")
    if missing:
        print("MISSING FILES: " + ", ".join(missing))
    if "--list" in sys.argv:
        print()
        for u in sorted(all_urls):
            print(u)
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
