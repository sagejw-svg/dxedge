# Ramona Sky

An unlisted photo history of the Wilson family's place at 740 Progress Lane,
Ramona, California (San Diego County): 42 images from the 1903 USGS topo to a
Sentinel-2 pass on 2026-11-08, oldest first, with deep zoom, an overlay per
image (year, date, source, land owner for that era, location, caption), the
approximate lot outline, and a map of nearby gem and gold mines, post offices
and landmarks.

Live at `https://dxedge.net/ramona-h0whnlp4/`. The page is not linked from
anywhere on dxedge.net, carries `noindex, nofollow` in its markup and an
`X-Robots-Tag` header from nginx, and is deliberately absent from robots.txt.
Sister page: Ranch Sky at `/ranch-z4swx8er55/`.

## The place

- Label: Wilson family, 740 Progress Lane, Ramona, CA (street address and
  exact pin approved for display by James Wilson, 2026-11-18)
- Pin: 33.0281264, -116.8547712 (WGS84, centroid of the lot)
- T13S R1E, San Bernardino Meridian, inside the former Rancho Santa María
  (Valle de Pamo) grant; never sectioned, so there is no federal homestead
  patent
- Santa Maria Valley, about 2 km SSE of Ramona's historic Main Street, at
  about 1,490 ft

## Rules (also in `sky/README.md`)

1. Never add the assessor parcel number (APN), any phone number, email or
   owner contact detail. The original, unsanitized `history.md`,
   `points.geojson` and `parcel.geojson` are not in this repo and must never
   be committed. Only the sanitized files in `data/` are used.
2. Never include, mention or map any cave, rock-art, milling or other
   archaeological or cultural site on or near the property. General Kumeyaay
   history without locations is fine.
3. Unknown owners stay unknown. The chain of title from the 1872 patent to
   the present is shown as "research in progress". Do not publish names of
   living people.

## Files

| File | What |
|---|---|
| `index.html` | The page. Loads the shared viewer from `../sky-f1st035d/` |
| `data/site.json` | Everything the page shows: slides with owner, hi-res file and pixel geometry (pin and lot outline), location, timeline, owner-by-era table, map legend, credits |
| `data/manifest.json` | The sanitized per-image list from the data drop |
| `data/points.geojson` | 24 sites: gem and gold mines, post offices, landmarks, rancho reference, fire edges (sanitized) |
| `data/parcel_outline.geojson` | Approximate lot outline, geometry only |
| `data/history.md` | Rancho Santa María, Nuevo/Ramona, build timeline, fires, mines, sources (sanitized) |
| `data/*.jpg` (42) | Web images with a pin ring, lot box and caption burned in. Thumbnails and fallbacks |
| `tiles/` (not in git) | Deep-zoom pyramids served by nginx from `/var/lib/dxedge/sky-tiles/ramona/` |

Hi-res originals (42 files, about 645 MB): GitHub release `sky-assets-v1`
of `sagejw-svg/dxedge`, names prefixed `ramona_`. `sky/fetch_hires.sh ramona`
downloads them into `sky/ramona/hires/`.

## How the page works

Same viewer as Ranch Sky (`../sky-f1st035d/sky.js`); see that page's README.
On this page the lot outline from `parcel_outline.geojson` is drawn as an SVG
overlay on the deep-zoom tiles, positioned from `parcel_px` in `site.json`,
and on the map.

## Rebuilding

```bash
sky/fetch_hires.sh ramona                          # originals -> sky/ramona/hires/
python3 scripts/sky_geometry.py ramona             # refresh pin and lot pixel geometry in data/site.json (needs GDAL)
scripts/build_sky_tiles.sh ramona /var/lib/dxedge/sky-tiles  # pyramids (needs libvips-tools)
```

## Credits

Imagery:

- USGS Historical Topographic Map Collection (1903, 1942, 1955, 1971, 1975,
  1982, 1988, 1997). Public domain.
- UCSB Library Map & Imagery Lab FrameFinder: flights C-5750 (1939), AXN
  (1953), CAS-SD (1963), AMI-SD (1974, 1975, 1977, 1980), NAPP (1990, 1994,
  1996, 2002). Credit "UCSB Library Special Research Collections". Federal
  NAPP frames are public domain.
- County of San Diego / SanGIS historical orthoimagery (1995, 1997, 2000,
  2004, 2006, 2008, 2012). Public county GIS service; check SanGIS terms
  before redistribution.
- USGS/NASA Landsat Collection 2 (1972, 1984, 1996, 2003, 2008), via
  Microsoft Planetary Computer. Public domain.
- USDA FSA NAIP (2012, 2014, 2016, 2018, 2020, 2022, 2024), via Microsoft
  Planetary Computer. Public domain.
- Copernicus Sentinel-2B (2026). "Contains modified Copernicus Sentinel data
  2026."
- Esri World Imagery / Wayback (2022 Maxar GeoEye-1; 2025 Vantor
  WorldView-3; 2026 Vantor Legion-06). Credit "Esri, Maxar/Vantor, Earthstar
  Geographics, Microsoft, and the GIS User Community." See the caveat below.

History and map points: UC Berkeley land case 195 SD, Smythe *History of San
Diego*, San Diego History Center *Journal* (Oct 1990), Frickstad *A Century of
California Post Offices*, USGS MRDS, USGS GNIS, CAL FIRE FRAP, Wikipedia
(Ramona, Julian). Full URLs in `data/history.md`.

Viewer: OpenSeadragon 6.1.1 (BSD-3-Clause) and Leaflet 1.9.4 (BSD-2-Clause),
vendored in `../sky-f1st035d/vendor/` with their licenses.

Accuracy: UCSB frames are georeferenced to about 10-20 m. Mine coordinates
are from USGS MRDS.

## Esri and county caveats

- Esri's terms allow display of World Imagery with attribution but do not
  cover re-hosting downloaded tiles. `scripts/build_sky_tiles.sh` never builds
  pyramids for the three Esri images. The 2026-03-23 slide streams the current
  World Imagery tiles live from Esri with attribution. The 2022-12-23 and
  2025-05-01 slides show the committed web JPG only; their Wayback release
  numbers were not recorded. Fill `esri_live.release` in `site.json` (from
  the `#active=<number>` in the livingatlas.arcgis.com/wayback URL) to stream
  them too.
- County of San Diego orthos: credit as above and check SanGIS terms of use
  before mirroring elsewhere.

## Open items

- Wilson purchase year: unknown (shown as unknown).
- Chain of title 1872 to present; exact build year (assessor).
- Esri and county image terms.
- Internet Archive mirror and Wayback Machine capture: not done yet. A
  Wayback capture makes this URL findable in the archive.
