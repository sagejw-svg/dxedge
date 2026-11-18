# Sky: family photo-history data for two hidden dxedge pages

This folder holds the data for two unlisted photo-history pages on dxedge.net:
- **`ranch/`**: the Wilson family ranch at Sapaque / Waller Creek, south Monterey County, CA. 18 images, 1919-2026. Pin 35.8426537, -121.1295293, NE1/4 SW1/4 Sec 17 T24S R8E, Mount Diablo Meridian.
- **`ramona/`**: Wilson family, 740 Progress Lane, Ramona, CA (San Diego County). 42 images, 1903-2026. Pin 33.0281264, -116.8547712.

Each page scrolls oldest to newest, with deep zoom and an overlay per photo (year, date, source credit, land owner for that era, location, facts). There is also a map layer of historic post offices, mines and landmarks.

The data was compiled in November 2026 from free, public, no-login sources. The build specs live in James Wilson's Notion workspace ("Ranch Sky" and "Ramona Sky" build briefs).

## Rules for anyone editing this folder

1. **No archaeological sites.** Never include, mention, depict or map any cave, rock shelter, rock-art, midden, milling or other archaeological or cultural site on or near either property. General regional history of the Salinan and Kumeyaay peoples, with no locations, is fine.
2. **No private contact or parcel data.**
   - The ranch has no street address; show only its pin and survey section.
   - Ramona shows its street address: label it "Wilson family, 740 Progress Lane, Ramona, CA" (approved by James Wilson, 2026-11-18).
   - Never add assessor parcel numbers (APNs), phone numbers, emails or owner contact details anywhere.
   - Do not name living people beyond what appears in published obituaries.
3. **Never invent history.** Unknown owners stay "unknown", and guesses are labelled as guesses.
4. Pages using this data must be `noindex` (meta tag plus an `X-Robots-Tag` header), unlinked from navigation, and **not** listed in robots.txt.

## Where things live

The published data moved out of this folder and into the page folders on
2026-11-18, so the pages can serve it directly:

| Path | What |
|---|---|
| `frontend/public/ranch-z4swx8er55/` | Ranch Sky page (`index.html`), its `README.md`, and `data/` |
| `frontend/public/ranch-z4swx8er55/data/` | 18 web JPGs, `manifest.json`, `site.json`, `points.geojson`, `history.md`, `homesteaders.md` |
| `frontend/public/ramona-h0whnlp4/` | Ramona Sky page (`index.html`), its `README.md`, and `data/` |
| `frontend/public/ramona-h0whnlp4/data/` | 42 web JPGs, `manifest.json`, `site.json`, `points.geojson`, `parcel_outline.geojson`, `history.md` (all sanitized) |
| `frontend/public/sky-f1st035d/` | Shared viewer (`sky.js`, `sky.css`), the unlisted index page, and `vendor/` (OpenSeadragon 6.1.1, Leaflet 1.9.4) |
| `scripts/build_sky_tiles.sh` | Builds the deep-zoom pyramids from the hi-res originals (run on the droplet by the deploy) |
| `scripts/sky_geometry.py` | Recomputes pin and lot-outline pixel positions in each `site.json` from the originals |
| `sky/hires_manifest.txt` | Names of the hi-res release assets |
| `sky/fetch_hires.sh` | Downloads the hi-res files into `sky/<site>/hires/` (git-ignored) |

`manifest.json` is the original per-image list from the data drop. `site.json`
is what the pages read: the same images plus the land owner for each era, the
overlay facts, the hi-res file for each slide and its pixel geometry, the
timeline, the owner-by-era table and the credits.

## Hi-res files (not in git)

The full-resolution images live in GitHub release **`sky-assets-v1`** of this repo:
- 23 ranch files, about 366 MB, named `ranch_<file>`;
- 42 Ramona files, about 645 MB, named `ramona_<file>`.

Every file is under 50 MB. Most are Cloud-Optimized GeoTIFFs (JPEG-compressed, with overviews):
- projected images are in UTM (EPSG:32610 for the ranch, 32611 for Ramona) or EPSG:3857 (the Esri images);
- the full-sheet USGS topos keep their native NAD27 projection.

Two ranch aerial scans are also provided as full-frame JPEGs.

```bash
sky/fetch_hires.sh          # both sites -> sky/ranch/hires/, sky/ramona/hires/
sky/fetch_hires.sh ramona   # one site
```

`hires/` folders are git-ignored. The deep-zoom tiles are a derived cache,
not committed (about 900 MB and 46,000 files for both sites). The deploy runs
`scripts/build_sky_tiles.sh` on the droplet, which downloads the originals
if needed and writes the pyramids to `/var/lib/dxedge/sky-tiles/<site>/`,
served by nginx at `/<slug>/tiles/`. To rebuild anywhere:

```bash
scripts/build_sky_tiles.sh all /some/output/dir      # needs vips, python3, curl
```

Esri images are never tiled (see the Esri row below); those slides show the
committed web JPG or stream live Esri tiles with attribution.

## Credits and source licenses

| Source | Used for | License / terms |
|---|---|---|
| USGS Historical Topographic Map Collection / The National Map | Topo maps 1903-1997 | Public domain (US Government). Credit "USGS". |
| USGS/NASA Landsat Collection 2 | Landsat 1972-2008 | Public domain. Credit "USGS/NASA Landsat". |
| USDA FSA National Agriculture Imagery Program (NAIP) | 2012-2024 aerials | Public domain. Credit "USDA FSA NAIP". |
| Copernicus Sentinel-2 (ESA) | 2026 satellite images | Free and open. Credit "Contains modified Copernicus Sentinel data 2026". |
| Microsoft Planetary Computer | Access to Landsat / NAIP / Sentinel-2 | Data keeps the licenses above |
| UCSB Library, Map & Imagery Lab, FrameFinder | Aerial scans 1939-2002 (C-5750, AXN, CAS-SD, AMI-SD, NAPP) | Free download. Credit "UCSB Library Special Research Collections". Federal NAPP frames are public domain. |
| County of San Diego historical orthoimagery | Ramona 1995-2012 orthos | Public county GIS service. Credit "County of San Diego / SanGIS". Check SanGIS terms before redistribution. |
| Esri World Imagery and World Imagery Wayback (Microsoft UltraCam; Maxar GeoEye-1, WorldView-3; Vantor Legion) | Ranch 2010 and 2025; Ramona 2022, 2025 and 2026 | **Esri terms apply.** Display needs attribution ("Esri, Maxar/Vantor, Microsoft, Earthstar Geographics"). Re-hosting downloaded tiles may not be permitted, so check the current Esri terms, or stream the live tiles, or drop these images. |
| USGS MRDS, USGS GNIS, BLM CadNSDI PLSS, BLM GLO Records | Mines, place names, survey sections, land patents | Public domain |
| CAL FIRE FRAP historic fire perimeters | Fire distances | Public data. Credit CAL FIRE FRAP. |
| Frickstad, *A Century of California Post Offices 1848-1954* (1955); Monterey County Historical Society; San Diego History Center *Journal*; UC Berkeley land case files; Smythe, *History of San Diego*; Find a Grave; Wikipedia | History text | Facts with citations. Full URLs are in each `history.md` and `homesteaders.md`. |

Data prepared by Grok Bot for James Wilson, 2026-11-18. Pages and viewer built by Claude, 2026-11-18.
