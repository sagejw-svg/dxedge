#!/usr/bin/env bash
# Download the hi-res COGs / scans for the Sky pages from GitHub release sky-assets-v1.
# Usage: sky/fetch_hires.sh [ranch|ramona|all]   (default: all)
# Files land in sky/<site>/hires/ with the ranch_/ramona_ prefix removed.
# Uses `gh release download` when gh is available, otherwise plain curl (public repo, no login needed).
set -euo pipefail
REPO="sagejw-svg/dxedge"
TAG="sky-assets-v1"
HERE="$(cd "$(dirname "$0")" && pwd)"
WHICH="${1:-all}"
for site in ranch ramona; do
  [[ "$WHICH" == "all" || "$WHICH" == "$site" ]] || continue
  dest="$HERE/$site/hires"; mkdir -p "$dest"
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    tmp="$(mktemp -d)"
    gh release download "$TAG" --repo "$REPO" --pattern "${site}_*" --dir "$tmp" --clobber
    for f in "$tmp"/${site}_*; do mv -f "$f" "$dest/$(basename "$f" | sed "s/^${site}_//")"; done
    rmdir "$tmp"
  else
    grep "^${site}_" "$HERE/hires_manifest.txt" | while read -r name; do
      out="$dest/${name#${site}_}"
      [[ -s "$out" ]] && continue
      echo "fetching $name"
      curl -fL --retry 3 -o "$out" "https://github.com/$REPO/releases/download/$TAG/$name"
    done
  fi
done
echo "done: $(ls "$HERE"/*/hires 2>/dev/null | wc -l) entries"
