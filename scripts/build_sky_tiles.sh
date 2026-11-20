#!/usr/bin/env bash
# Build the deep-zoom (DZI) tile pyramids for the two hidden Sky pages.
#
#   scripts/build_sky_tiles.sh [ranch|ramona|all] [OUT_DIR]
#
# Reads each site's data/site.json, downloads the hi-res originals from GitHub
# release sky-assets-v1 if they are not already in sky/<site>/hires/, and runs
# `vips dzsave` on every non-Esri hi-res image. Output lands in
#
#   OUT_DIR/<site>/<name>.dzi + OUT_DIR/<site>/<name>_files/   (default OUT_DIR
#   /var/lib/dxedge/sky-tiles), which nginx serves at /<slug>/tiles/.
#
# The tiles are NOT committed: about 60 pyramids, tens of thousands of small
# files, well over a gigabyte. The originals in the release plus this script
# are the durable record; the pyramids are a derived cache that any machine
# with libvips can rebuild in a few minutes.
#
# Esri images (site.json "esri": true) are skipped on purpose. Esri's terms
# allow display with attribution but not re-hosting downloaded tiles, so those
# slides use the committed web JPG or stream live Esri tiles instead.
#
# Idempotent: a pyramid whose .dzi already exists is left alone. Safe to run
# from the deploy (it takes a flock), and from cron. Needs: bash, python3,
# vips (libvips-tools), curl. As root it installs libvips-tools if missing.
set -euo pipefail
# nginx runs as an unprivileged user inside its container and reads the output
# directory through a read-only bind mount, so everything written here must be
# world-readable. The deploy's SSH session has arrived with a restrictive
# umask before, which left the site directories 700 and every tile a 403.
umask 022

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
WHICH="${1:-all}"
OUT="${2:-${SKY_TILES_DIR:-/var/lib/dxedge/sky-tiles}}"
QUALITY="${SKY_TILE_QUALITY:-85}"

declare -A SLUG=([ranch]=ranch-z4swx8er55 [ramona]=ramona-h0whnlp4)

log() { echo "[sky-tiles $(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

if ! command -v vips >/dev/null 2>&1; then
  if [[ "$(id -u)" == "0" ]] && command -v apt-get >/dev/null 2>&1; then
    log "vips not found; installing libvips-tools"
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq libvips-tools >/dev/null
  else
    log "ERROR: vips not found. Install libvips-tools (apt) or libvips (brew)."; exit 1
  fi
fi

mkdir -p "$OUT"
exec 9>"$OUT/.lock"
if ! flock -n 9; then
  log "another build holds $OUT/.lock; exiting"; exit 0
fi

built=0; skipped=0; esri=0
for site in ranch ramona; do
  [[ "$WHICH" == "all" || "$WHICH" == "$site" ]] || continue
  slug="${SLUG[$site]}"
  site_json="$ROOT/frontend/public/$slug/data/site.json"
  hires="$ROOT/sky/$site/hires"
  dest="$OUT/$site"
  mkdir -p "$dest"

  # name<TAB>file<TAB>esri, one line per hi-res image
  mapfile -t rows < <(python3 - "$site_json" <<'PY'
import json, sys
s = json.load(open(sys.argv[1]))
for sl in s["slides"]:
    for h in sl["hires"]:
        print(f'{h["name"]}\t{h["file"]}\t{int(bool(sl.get("esri")))}')
PY
)

  # Fetch the originals only if a pyramid still has to be built and its
  # original is not on disk. Once every pyramid exists this is a no-op, so a
  # deploy never re-downloads a gigabyte for nothing.
  need_fetch=0
  for row in "${rows[@]}"; do
    IFS=$'\t' read -r name file is_esri <<<"$row"
    [[ "$is_esri" == "1" ]] && continue
    [[ -s "$dest/$name.dzi" ]] && continue
    [[ -s "$hires/$file" ]] || need_fetch=1
  done
  if [[ "$need_fetch" == "1" ]]; then
    log "$site: hi-res originals missing; downloading release sky-assets-v1"
    bash "$ROOT/sky/fetch_hires.sh" "$site"
  fi

  for row in "${rows[@]}"; do
    IFS=$'\t' read -r name file is_esri <<<"$row"
    if [[ "$is_esri" == "1" ]]; then esri=$((esri+1)); continue; fi
    if [[ -s "$dest/$name.dzi" ]]; then skipped=$((skipped+1)); continue; fi
    src="$hires/$file"
    if [[ ! -s "$src" ]]; then log "$site: missing $src, skipping"; continue; fi
    log "$site: building $name"
    tmp="$dest/.tmp_$name"
    rm -rf "$tmp.dzi" "${tmp}_files"
    # GeoTIFF tags vips does not know produce harmless warnings; silence them.
    VIPS_WARNING=0 vips dzsave "$src" "$tmp" --tile-size 256 --overlap 1 --suffix ".jpg[Q=$QUALITY]" 2>/dev/null
    # A DZI client derives the tile folder from the .dzi file name, so moving
    # both into place under the final name is all the publish step needs.
    mv "${tmp}_files" "$dest/${name}_files"
    mv "$tmp.dzi" "$dest/$name.dzi"
    built=$((built+1))
  done

  # Availability list the viewer can read in one request.
  python3 - "$dest" <<'PY'
import json, os, sys
d = sys.argv[1]
names = sorted(f[:-4] for f in os.listdir(d) if f.endswith(".dzi"))
json.dump({"tiles": names}, open(os.path.join(d, "index.json"), "w"))
PY
done

# Belt and braces for directories created by an earlier run under a bad umask.
chmod -R u+rwX,go+rX "$OUT" 2>/dev/null || true

# The originals are only an input. They live in the GitHub release and are
# about 1 GB for both sites, which filled the droplet's disk on 2026-11-19
# (every response was cut at 139 KB and deploys failed). Keep them only
# when asked (SKY_KEEP_HIRES=1), and only ever remove them when every
# non-Esri pyramid for that site is in place.
if [[ "${SKY_KEEP_HIRES:-0}" != "1" ]]; then
  for site in ranch ramona; do
    [[ "$WHICH" == "all" || "$WHICH" == "$site" ]] || continue
    dest="$OUT/$site"; hires="$ROOT/sky/$site/hires"
    [[ -d "$hires" ]] || continue
    complete=1
    while IFS=$'\t' read -r name file is_esri; do
      [[ "$is_esri" == "1" ]] && continue
      [[ -s "$dest/$name.dzi" ]] || complete=0
    done < <(python3 - "$ROOT/frontend/public/${SLUG[$site]}/data/site.json" <<'PY'
import json, sys
s = json.load(open(sys.argv[1]))
for sl in s["slides"]:
    for h in sl["hires"]:
        print(f'{h["name"]}\t{h["file"]}\t{int(bool(sl.get("esri")))}')
PY
)
    if [[ "$complete" == "1" ]]; then
      log "$site: all pyramids present; removing originals in $hires ($(du -sh "$hires" 2>/dev/null | cut -f1))"
      rm -rf "$hires"
    fi
  done
fi

log "done: built $built, already present $skipped, esri skipped $esri -> $OUT"
log "size $(du -sh "$OUT" 2>/dev/null | cut -f1)"
