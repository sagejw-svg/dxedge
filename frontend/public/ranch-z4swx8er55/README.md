# Ranch Sky

An unlisted photo history of the Wilson family ranch at Sapaque / Waller Creek,
south Monterey County, California: 18 images from the 1919 USGS topo to a
Sentinel-2 pass on 2026-11-11, oldest first, with deep zoom, an overlay per
image (year, date, source, land owner for that era, exact location, facts) and
a map of nearby historic post offices and mercury and gold mines.

Live at `https://dxedge.net/ranch-z4swx8er55/`. The page is not linked from
anywhere on dxedge.net, carries `noindex, nofollow` in its markup and an
`X-Robots-Tag` header from nginx, and is deliberately absent from robots.txt.
Sister page: Ramona Sky at `/ramona-h0whnlp4/`.

## The place

- Pin: 35.8426537, -121.1295293 (WGS84)
- NE1/4 SW1/4 Section 17, T24S R8E, Mount Diablo Meridian
- Monterey County, CA, Burnett Peak 7.5' quad
- North side of the Waller Creek drainage, about 150 m outside the present
  Fort Hunter Liggett boundary
- The ranch has no street address and none is shown.

## Rules (also in `sky/README.md`)

1. Never include, mention, depict or map any cave, rock shelter or other
   archaeological or cultural site on or near the property. Regional Salinan
   and mission history without locations is fine.
2. No private contact details: no addresses, phone numbers or emails, and no
   people's names beyond the historical ones already in the data.
3. Unknown owners stay unknown. Inferences are labelled as inferences.

## Files

| File | What |
|---|---|
| `index.html` | The page. Loads the shared viewer from `../sky-f1st035d/` |
| `data/site.json` | Everything the page shows: slides with owner, facts, hi-res file and pixel geometry, location, timeline, owner-by-era table, map legend, credits |
| `data/manifest.json` | The original per-image list from the data drop (`file, year, date, source, caption`) |
| `data/points.geojson` | The pin, 7 post offices (3 unlocated), 10 mercury and gold mine features |
| `data/history.md` | Timeline, owner by era, BLM GLO land patents, per-photo facts, full source URLs, gaps |
| `data/homesteaders.md` | Genealogy notes on the 1883-1931 patentees with sources and confidence levels |
| `data/*.jpg` (18) | Web images (1000-1400 px) with a pin ring and caption burned in. Thumbnails and fallbacks |
| `tiles/` (not in git) | Deep-zoom pyramids served by nginx from `/var/lib/dxedge/sky-tiles/ranch/` |

Hi-res originals (23 files, about 366 MB): GitHub release `sky-assets-v1`
of `sagejw-svg/dxedge`, names prefixed `ranch_`. `sky/fetch_hires.sh ranch`
downloads them into `sky/ranch/hires/`.

## How the page works

- `../sky-f1st035d/sky.js` reads `data/site.json`, `data/points.geojson` and
  `tiles/index.json`, builds one full-screen slide per image, and mounts an
  OpenSeadragon viewer for the current slide and its neighbours.
- A slide uses `tiles/<name>.dzi` when the pyramid exists, else the web JPG.
  The pin ring is an HTML overlay placed from `pin_px` in `site.json`.
- Images are pictures until tapped or clicked; then the gestures turn on
  (pinch, drag, scroll-zoom) and "Done zooming" hands scrolling back to the
  page. Keys: arrows, PgUp/PgDn, Home/End, M for the map, Esc.
- Slides with two sheets (1949, 1979, 1995 Burnett Peak and Bryson; 1994 and
  2002 georeferenced frame and full scan) have a switch in the card.
- The map (Leaflet) shows the pin and `points.geojson` on USGS National Map
  tiles. Points without coordinates are listed under the map.
- The service worker (`/sw.js`) leaves this path to the browser entirely.

## Rebuilding

```bash
sky/fetch_hires.sh ranch                           # originals -> sky/ranch/hires/
python3 scripts/sky_geometry.py ranch              # refresh pixel geometry in data/site.json (needs GDAL)
scripts/build_sky_tiles.sh ranch /var/lib/dxedge/sky-tiles   # pyramids (needs libvips-tools)
```

The deploy workflow runs the tile build on the droplet in the background
after every deploy; it skips pyramids that already exist.

## Credits

Imagery:

- USGS Historical Topographic Map Collection / The National Map (1919, 1949,
  1961, 1979, 1995). Public domain.
- USGS/NASA Landsat Collection 2 (1973, 1984, 1996, 2005), via Microsoft
  Planetary Computer. Public domain.
- USGS NAPP aerial photos (1994, 2002), scans from UCSB Library Map & Imagery
  Lab FrameFinder. Public domain; credit UCSB Library Special Research
  Collections.
- USDA FSA NAIP (2012, 2016, 2020, 2024), via Microsoft Planetary Computer.
  Public domain.
- Copernicus Sentinel-2B (2026). "Contains modified Copernicus Sentinel data
  2026."
- Esri World Imagery and World Imagery Wayback (2010 Microsoft UltraCam-G;
  2025 Vantor/Maxar Legion-02). Credit "Esri, Maxar/Vantor, Earthstar
  Geographics, Microsoft, and the GIS User Community." See the caveat below.

History and map points: USGS MRDS, USGS GNIS, BLM GLO Records and CadNSDI
PLSS, Frickstad *A Century of California Post Offices* (1955), Monterey County
Historical Society, CAL FIRE FRAP fire perimeters, Wikipedia (ranchos, Jolon,
Hunter Liggett), militarymuseum.org, Find a Grave. Full URLs in
`data/history.md` and `data/homesteaders.md`.

Viewer: OpenSeadragon 6.1.1 (BSD-3-Clause) and Leaflet 1.9.4 (BSD-2-Clause),
vendored in `../sky-f1st035d/vendor/` with their licenses.

Accuracy: the 1994 and 2002 aerials were registered to NAIP imagery and may
be off by tens of metres. Mine coordinates are from USGS MRDS (about 0.5-1
km). There is no free aerial coverage of the pin before 1994.

## Esri caveat

Esri's terms allow display of World Imagery with attribution but do not
cover re-hosting downloaded tiles as static files. So:

- `scripts/build_sky_tiles.sh` never builds pyramids for the two Esri images
  (`"esri": true` in `site.json`).
- The 2025 slide streams the current World Imagery tiles live from Esri with
  attribution. The 2010 slide (Wayback release 2014-02-20) shows the committed
  web JPG only until a Wayback release number is filled into
  `esri_live.release` in `site.json`; find it in the URL of
  livingatlas.arcgis.com/wayback (`#active=<number>`).
- The hi-res Esri GeoTIFFs stay in the release only. Do not copy them to any
  public mirror unless Esri's terms allow it.

## Open items

- Owners from 1926 to about 1976 are unknown (Monterey County Recorder deed
  research would fill this).
- GLO patent images were not pulled.
- Internet Archive mirror and Wayback Machine capture: not done yet. A Wayback
  capture makes this URL findable in the archive.
