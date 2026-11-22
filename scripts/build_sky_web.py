#!/usr/bin/env python3
"""Regenerate the web JPGs for a Sky site from the hi-res originals.

Each slide gets one 1400 x 1400 JPEG: a north-up square window in the site's
UTM zone, centred on the pin, cut and resampled from the slide's hi-res
GeoTIFF(s) with gdalwarp. Nothing is drawn on the image: no pin, no lot
outline, no caption. The page draws the location marker itself (edge ticks)
and the card carries the text, so the picture stays clean and nothing that
should not be public can end up burned into a pixel.

The window width in km comes from site.json ("web.km" per slide), which this
script fills in on first run from the caption ("~N km square") or a default
by image type. Because the window is centred on the pin, the pin is always
at the image centre, and that is what gets written to "web.pin_px".

Usage:
  scripts/build_sky_web.py ranch
  scripts/build_sky_web.py ramona [--only 2024-05-06_usda-naip.jpg]

Needs GDAL (gdalwarp, gdal_translate) and the originals in sky/<site>/hires/
(run sky/fetch_hires.sh <site> first).
"""
import json
import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SITES = {"ranch": ("ranch-z4swx8er55", "EPSG:32610"), "ramona": ("ramona-h0whnlp4", "EPSG:32611")}
SIZE = 1400
QUALITY = 88


def default_km(slide):
    cap = re.search(r"~\s*([\d.]+)\s*km square", slide.get("caption", ""))
    if cap:
        return float(cap.group(1))
    name = slide["hires"][0]["file"].lower()
    if "landsat" in name:
        return 10.0
    if "sentinel" in name:
        return 4.0
    if "topo" in name:
        return 8.0 if "30_" in name else 5.0 if "15_" in name else 2.4
    return 2.0


def pin_utm(lon, lat, srs):
    out = subprocess.run(["gdaltransform", "-s_srs", "EPSG:4326", "-t_srs", srs, "-output_xy"],
                         input=f"{lon} {lat}\n", capture_output=True, text=True, check=True).stdout
    x, y = out.split()[:2]
    return float(x), float(y)


def bands(path):
    info = json.loads(subprocess.check_output(["gdalinfo", "-json", path], text=True))
    return len(info["bands"])


def build(site, only=None):
    slug, srs = SITES[site]
    data_dir = os.path.join(ROOT, "frontend", "public", slug, "data")
    hires_dir = os.path.join(ROOT, "sky", site, "hires")
    site_path = os.path.join(data_dir, "site.json")
    s = json.load(open(site_path))
    cx, cy = pin_utm(s["pin"]["lon"], s["pin"]["lat"], srs)
    done = 0
    for slide in s["slides"]:
        if only and slide["file"] != only:
            continue
        web = slide.setdefault("web", {})
        km = web.get("km") or default_km(slide)
        half = km * 1000 / 2
        # Every georeferenced hi-res for the slide, east sheet first so the
        # west (primary) sheet is drawn on top where two sheets overlap.
        srcs = [os.path.join(hires_dir, h["file"]) for h in slide["hires"] if "fullframe" not in h["file"]]
        srcs = [p for p in srcs if os.path.exists(p)]
        if not srcs:
            print(f"  skip {slide['file']}: no hi-res on disk")
            continue
        srcs = list(reversed(srcs))
        out = os.path.join(data_dir, slide["file"])
        with tempfile.TemporaryDirectory() as td:
            tif = os.path.join(td, "w.tif")
            nb = bands(srcs[0])
            cmd = ["gdalwarp", "-q", "-overwrite", "-t_srs", srs,
                   "-te", str(cx - half), str(cy - half), str(cx + half), str(cy + half),
                   "-ts", str(SIZE), str(SIZE), "-r", "cubic", "-of", "GTiff", "-co", "TILED=NO"]
            cmd += srcs + [tif]
            subprocess.run(cmd, check=True, stderr=subprocess.DEVNULL)
            tr = ["gdal_translate", "-q", "-of", "JPEG", "-co", f"QUALITY={QUALITY}"]
            if nb >= 3:
                tr += ["-b", "1", "-b", "2", "-b", "3"]
            tr += [tif, out]
            subprocess.run(tr, check=True, stderr=subprocess.DEVNULL)
        for side in (".aux.xml",):
            if os.path.exists(out + side):
                os.remove(out + side)
        web.update({"km": km, "width": SIZE, "height": SIZE, "pin_px": [SIZE / 2, SIZE / 2]})
        done += 1
        print(f"  {slide['file']}  {km} km from {len(srcs)} source(s)")
    json.dump(s, open(site_path, "w"), indent=1, ensure_ascii=False)
    open(site_path, "a").write("\n")
    print(f"{site}: {done} web JPGs written")


if __name__ == "__main__":
    args = sys.argv[1:]
    only = None
    if "--only" in args:
        i = args.index("--only")
        only = args[i + 1]
        del args[i:i + 2]
    build(args[0] if args else "ranch", only)
