# Sky: family photo-history data for two hidden dxedge pages

This folder holds the data for two unlisted photo-history pages on dxedge.net:
- **`ranch/`**: the Wilson family ranch at Sapaque / Waller Creek, south Monterey County, CA. 18 images, 1919-2026. Pin 35.8426537, -121.1295293, NE1/4 SW1/4 Sec 17 T24S R8E, Mount Diablo Meridian.
- **`ramona/`**: Wilson family, Ramona, CA (San Diego County). 42 images, 1903-2026.

Each page scrolls oldest to newest, with deep zoom and an overlay per photo (year, date, source credit, land owner for that era, location, facts). There is also a map layer of historic post offices, mines and landmarks.

The data was compiled in November 2026 from free, public, no-login sources. The build specs live in James Wilson's Notion workspace ("Ranch Sky" and "Ramona Sky" build briefs).

## Rules for anyone editing this folder

1. **No archaeological sites.** Never include, mention, depict or map any cave, rock shelter, rock-art, midden, milling or other archaeological or cultural site on or near either property. General regional history of the Salinan and Kumeyaay peoples, with no locations, is fine.
2. **No private contact or parcel data.**
   - Do not add street addresses, house numbers, assessor parcel numbers (APNs), phone numbers, emails or owner contact details.
   - Label the second property only as "Wilson family, Ramona, CA".
   - Do not name living people beyond what appears in published obituaries.
3. **Never invent history.** Unknown owners stay "unknown", and guesses are labelled as guesses.
4. Pages using this data must be `noindex` (meta tag plus an `X-Robots-Tag` header), unlinked from navigation, and **not** listed in robots.txt.

## Contents

| Path | What |
|---|---|
| `ranch/*.jpg` (18) | Web images (1000-1400 px) with a burned-in pin ring and caption, oldest first |
| `ranch/manifest.json` | Per-image `{file, year, date, source, caption}` |
| `ranch/points.geojson` | Pin, 7 post offices (3 unlocated), 10 mercury/gold mine features, with distance and direction from the pin |
| `ranch/history.md` | Timeline, owner by era, BLM GLO land patents, per-photo facts, sources, gaps |
| `ranch/homesteaders.md` | Genealogy notes on the 1883-1931 patentees, with sources and confidence levels |
| `ramona/*.jpg` (42) | Web images with a pin ring, lot box and caption |
| `ramona/manifest.json` | Per-image metadata (sanitized) |
| `ramona/points.geojson` | 24 sites: gem and gold mines, post offices, landmarks, rancho reference, fire edges (sanitized) |
| `ramona/parcel_outline.geojson` | Approximate lot outline (geometry only) |
| `ramona/history.md` | Rancho Santa María, Nuevo/Ramona, build timeline, fires, mines, sources (sanitized) |
| `hires_manifest.txt` | Names of the hi-res release assets |
| `fetch_hires.sh` | Downloads the hi-res files |

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

`hires/` folders are git-ignored. To build deep-zoom tiles:

```bash
vips dzsave sky/ramona/hires/<file>.tif out/<name> --tile-size 256 --overlap 1 --suffix .jpg[Q=85]
```

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

Prepared by Grok Bot for James Wilson, 2026-11-18.
