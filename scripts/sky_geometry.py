#!/usr/bin/env python3
"""Fill pixel geometry into a Sky site.json from the hi-res originals.

For every slide's hi-res image this writes width, height, the pin's pixel
position and, when the site has a parcel outline, the outline's pixel
vertices. The viewer draws the pin ring and the lot outline from these
numbers as HTML/SVG overlays on top of the clean tiles.

Usage:
  scripts/sky_geometry.py ranch   # reads sky/ranch/hires/, edits
                                  # frontend/public/ranch-z4swx8er55/data/site.json
  scripts/sky_geometry.py ramona

Needs GDAL (apt install gdal-bin python3-gdal). Unrectified scans (the
full-frame JPGs) have no georeferencing, so they get width/height only and
no pin. Pins that fall outside an image are stored as null.
"""
import json
import os
import subprocess
import sys

try:
    from osgeo import gdal, osr
    gdal.UseExceptions()
except ImportError:  # pragma: no cover
    gdal = None

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SLUGS = {"ranch": "ranch-z4swx8er55", "ramona": "ramona-h0whnlp4"}


def img_size(path):
    if gdal:
        ds = gdal.Open(path)
        return ds.RasterXSize, ds.RasterYSize
    out = subprocess.check_output(["gdalinfo", "-json", path], text=True)
    sz = json.loads(out)["size"]
    return sz[0], sz[1]


def to_pixel(path, lon, lat):
    """WGS84 lon/lat -> (x, y) pixel in this image, or None if off the image or unreferenced."""
    if gdal:
        ds = gdal.Open(path)
        wkt = ds.GetProjection()
        gt = ds.GetGeoTransform(can_return_null=True)
        if not wkt or gt is None:
            return None
        src = osr.SpatialReference()
        src.ImportFromEPSG(4326)
        src.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
        dst = osr.SpatialReference()
        dst.ImportFromWkt(wkt)
        dst.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
        X, Y, _ = osr.CoordinateTransformation(src, dst).TransformPoint(lon, lat)
        inv = gdal.InvGeoTransform(gt)
        px = inv[0] + inv[1] * X + inv[2] * Y
        py = inv[3] + inv[4] * X + inv[5] * Y
    else:
        out = subprocess.run(["gdallocationinfo", "-xml", "-wgs84", path, str(lon), str(lat)],
                             capture_output=True, text=True).stdout
        if "pixel=" not in out:
            return None
        import re
        m = re.search(r'pixel="(-?\d+)" line="(-?\d+)"', out)
        px, py = float(m.group(1)) + 0.5, float(m.group(2)) + 0.5
    w, h = img_size(path)
    if px < 0 or py < 0 or px > w or py > h:
        return None
    return [round(px, 1), round(py, 1)]


def main(site):
    slug = SLUGS[site]
    data_dir = os.path.join(ROOT, "frontend", "public", slug, "data")
    hires_dir = os.path.join(ROOT, "sky", site, "hires")
    site_path = os.path.join(data_dir, "site.json")
    s = json.load(open(site_path))
    lon, lat = s["pin"]["lon"], s["pin"]["lat"]
    parcel = None
    if s.get("map", {}).get("parcel"):
        g = json.load(open(os.path.join(data_dir, s["map"]["parcel"])))
        feat = g["features"][0] if g.get("type") == "FeatureCollection" else g
        parcel = feat["geometry"]["coordinates"][0]
    missing = 0
    for slide in s["slides"]:
        for h in slide["hires"]:
            path = os.path.join(hires_dir, h["file"])
            if not os.path.exists(path):
                missing += 1
                continue
            w, hh = img_size(path)
            h["width"], h["height"] = w, hh
            h["pin_px"] = to_pixel(path, lon, lat)
            if parcel:
                pts = [to_pixel(path, x, y) for x, y in parcel]
                h["parcel_px"] = pts if all(pts) else None
    json.dump(s, open(site_path, "w"), indent=1, ensure_ascii=False)
    open(site_path, "a").write("\n")
    print(f"{site}: {len(s['slides'])} slides, {missing} hi-res files missing")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "ranch")
