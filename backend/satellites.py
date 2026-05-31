"""
Ham radio satellite tracking.
TLE data from SatNOGS database (backed by Space-Track.org).
Pass prediction uses the sgp4 library.
"""
import asyncio
import aiohttp
import logging
import math
from datetime import datetime, timezone, timedelta
from sgp4.api import Satrec, jday
from cache import cache

logger = logging.getLogger(__name__)

# Key ham radio satellites: NORAD ID -> {name, uplink, downlink, mode, notes}
HAM_SATS = {
    25544: {"name": "ISS",      "up": "145.990", "dn": "145.800", "mode": "FM",     "notes": "ARISS repeater"},
    27607: {"name": "SO-50",    "up": "145.850", "dn": "436.795", "mode": "FM",     "notes": "67Hz CTCSS"},
    43017: {"name": "AO-91",    "up": "435.250", "dn": "145.960", "mode": "FM",     "notes": "Fox-1B"},
    43137: {"name": "AO-92",    "up": "435.350", "dn": "145.880", "mode": "FM",     "notes": "Fox-1D"},
    44830: {"name": "CAS-4A",   "up": "145.855", "dn": "435.180", "mode": "Linear", "notes": "SSB/CW transponder"},
    40931: {"name": "CAS-4B",   "up": "145.925", "dn": "435.280", "mode": "Linear", "notes": "SSB/CW transponder"},
    57166: {"name": "XW-3",     "up": "145.870", "dn": "435.575", "mode": "Linear", "notes": "CAS-9"},
    43678: {"name": "PSAT-2",   "up": "145.825", "dn": "435.350", "mode": "FM",     "notes": "BBS/APRS"},
    46826: {"name": "RS-44",    "up": "435.610", "dn": "145.935", "mode": "Linear", "notes": "SSB/CW"},
    24278: {"name": "FO-29",    "up": "145.900", "dn": "435.800", "mode": "Linear", "notes": "JAS-2"},
    39444: {"name": "LilacSat-2","up": "144.350","dn": "437.200", "mode": "FM",     "notes": "CAS-3H"},
    40057: {"name": "BY70-1",   "up": "145.920", "dn": "436.200", "mode": "FM",     "notes": ""},
}

SATNOGS_URL = "https://db.satnogs.org/api/tle/?format=json"
MIN_ELEVATION = 5.0  # degrees - minimum useful elevation for ham ops


def grid_to_latlon(grid: str) -> tuple[float, float]:
    g = grid.upper().strip()
    if len(g) < 4:
        return 32.7, -117.1
    lon = (ord(g[0]) - 65) * 20 - 180 + int(g[2]) * 2 + 1.0
    lat = (ord(g[1]) - 65) * 10 - 90  + int(g[3]) * 1 + 0.5
    return lat, lon


def eci_to_azel(r_eci: list, obs_lat: float, obs_lon: float,
                obs_alt_km: float, jd: float, fr: float) -> tuple[float, float, float]:
    """
    Convert ECI position vector to azimuth/elevation/range from observer.
    Returns (az_deg, el_deg, range_km)
    """
    # Earth rotation
    theta = _gmst(jd + fr)

    # Observer position in ECI
    lat_r = math.radians(obs_lat)
    lon_r = math.radians(obs_lon)
    R_E   = 6378.137
    obs_r = R_E + obs_alt_km
    obs_eci = [
        obs_r * math.cos(lat_r) * math.cos(theta + lon_r),
        obs_r * math.cos(lat_r) * math.sin(theta + lon_r),
        obs_r * math.sin(lat_r),
    ]

    # Range vector
    rng = [r_eci[i] - obs_eci[i] for i in range(3)]
    rng_mag = math.sqrt(sum(x**2 for x in rng))
    if rng_mag == 0:
        return 0, 0, 0

    # South, East, Zenith unit vectors at observer
    s = [-math.sin(lat_r)*math.cos(theta+lon_r),
         -math.sin(lat_r)*math.sin(theta+lon_r),
          math.cos(lat_r)]
    e = [-math.sin(theta+lon_r), math.cos(theta+lon_r), 0]
    z = [ math.cos(lat_r)*math.cos(theta+lon_r),
          math.cos(lat_r)*math.sin(theta+lon_r),
          math.sin(lat_r)]

    south = sum(rng[i]*s[i] for i in range(3))
    east  = sum(rng[i]*e[i] for i in range(3))
    zen   = sum(rng[i]*z[i] for i in range(3))

    el = math.degrees(math.asin(zen / rng_mag))
    az = math.degrees(math.atan2(east, -south)) % 360

    return az, el, rng_mag


def _gmst(jd_full: float) -> float:
    """Greenwich Mean Sidereal Time in radians"""
    t = (jd_full - 2451545.0) / 36525.0
    gmst = (67310.54841 + t * (876600*3600 + 8640184.812866 +
            t * (0.093104 - t * 6.2e-6)))
    return math.radians(gmst % 86400 / 240)


async def fetch_tles() -> dict:
    """Fetch TLEs for ham sats from SatNOGS."""
    cached = cache.get("sat_tles")
    if cached:
        return cached

    tles = {}
    ids = list(HAM_SATS.keys())

    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=20)) as session:
            # Fetch in batches of 20
            for i in range(0, len(ids), 20):
                batch = ids[i:i+20]
                params = "&".join(f"norad_cat_id={n}" for n in batch)
                async with session.get(f"{SATNOGS_URL}&{params}") as r:
                    if r.status == 200:
                        data = await r.json(content_type=None)
                        for tle in (data if isinstance(data, list) else []):
                            norad = tle.get("norad_cat_id")
                            if norad and tle.get("tle1") and tle.get("tle2"):
                                tles[norad] = {
                                    "tle1": tle["tle1"],
                                    "tle2": tle["tle2"],
                                    "name": HAM_SATS.get(norad, {}).get("name",
                                            tle.get("tle0","").strip().lstrip("0 ")),
                                }
                await asyncio.sleep(0.5)

        logger.info(f"Fetched TLEs for {len(tles)} ham satellites")
        cache.set("sat_tles", tles, ttl=3600 * 6)  # 6hr cache
    except Exception as e:
        logger.warning(f"TLE fetch failed: {e}")

    return tles


def current_positions(tles: dict) -> list[dict]:
    """Compute current positions of all satellites."""
    now = datetime.now(timezone.utc)
    jd, fr = jday(now.year, now.month, now.day,
                  now.hour, now.minute, now.second + now.microsecond/1e6)
    positions = []
    for norad, tle in tles.items():
        try:
            sat = Satrec.twoline2rv(tle["tle1"], tle["tle2"])
            e, r, v = sat.sgp4(jd, fr)
            if e != 0:
                continue
            # Convert ECI to lat/lon
            theta = _gmst(jd + fr)
            lat = math.degrees(math.atan2(r[2], math.sqrt(r[0]**2 + r[1]**2)))
            lon = math.degrees(math.atan2(r[1], r[0]) - theta) 
            # Normalize longitude
            lon = ((lon + 180) % 360) - 180
            alt = math.sqrt(sum(x**2 for x in r)) - 6378.137

            info = HAM_SATS.get(norad, {})
            positions.append({
                "norad":  norad,
                "name":   tle["name"],
                "lat":    round(lat, 2),
                "lon":    round(lon, 2),
                "alt_km": round(alt, 0),
                "up":     info.get("up", ""),
                "dn":     info.get("dn", ""),
                "mode":   info.get("mode", ""),
                "notes":  info.get("notes", ""),
            })
        except Exception:
            pass
    return sorted(positions, key=lambda x: x["name"])


def predict_passes(tles: dict, obs_lat: float, obs_lon: float,
                   hours: int = 24) -> list[dict]:
    """Predict passes for all sats visible from observer over next N hours."""
    now = datetime.now(timezone.utc)
    end = now + timedelta(hours=hours)
    step = timedelta(seconds=30)

    passes = []

    for norad, tle in tles.items():
        try:
            sat = Satrec.twoline2rv(tle["tle1"], tle["tle2"])
            info = HAM_SATS.get(norad, {})

            in_pass = False
            pass_data = {}
            t = now

            while t < end:
                jd, fr = jday(t.year, t.month, t.day,
                              t.hour, t.minute, t.second)
                e, r, _ = sat.sgp4(jd, fr)
                if e != 0:
                    t += step; continue

                az, el, rng = eci_to_azel(r, obs_lat, obs_lon, 0.0, jd, fr)

                if el >= MIN_ELEVATION and not in_pass:
                    in_pass = True
                    pass_data = {
                        "norad":     norad,
                        "name":      tle["name"],
                        "rise_time": t.isoformat(),
                        "rise_az":   round(az, 0),
                        "max_el":    round(el, 1),
                        "max_el_az": round(az, 0),
                        "max_el_time": t.isoformat(),
                        "set_time":  None,
                        "set_az":    0,
                        "up":        info.get("up", ""),
                        "dn":        info.get("dn", ""),
                        "mode":      info.get("mode", ""),
                        "notes":     info.get("notes", ""),
                    }
                elif el >= MIN_ELEVATION and in_pass:
                    if el > pass_data["max_el"]:
                        pass_data["max_el"] = round(el, 1)
                        pass_data["max_el_az"] = round(az, 0)
                        pass_data["max_el_time"] = t.isoformat()
                elif el < MIN_ELEVATION and in_pass:
                    in_pass = False
                    pass_data["set_time"] = t.isoformat()
                    pass_data["set_az"]   = round(az, 0)
                    passes.append(pass_data)
                    pass_data = {}

                t += step

        except Exception as e:
            logger.debug(f"Pass prediction {norad}: {e}")

    # Sort by rise time
    passes.sort(key=lambda x: x["rise_time"])
    return passes[:50]  # top 50 passes
