"""POTA and SOTA spot fetchers."""
import asyncio
import aiohttp
import logging
from cache import cache

logger = logging.getLogger(__name__)

POTA_URL = "https://api.pota.app/spot/activator"
SOTA_URL = "https://api2.sota.org.uk/api/spots/50/-1"

FREQ_TO_BAND = [
    (1800,2000,"160m"),(3500,4000,"80m"),(7000,7300,"40m"),
    (10100,10150,"30m"),(14000,14350,"20m"),(18068,18168,"17m"),
    (21000,21450,"15m"),(24890,24990,"12m"),(28000,29700,"10m"),(50000,54000,"6m"),
]

def hz_to_band(khz):
    for lo, hi, band in FREQ_TO_BAND:
        if lo <= khz <= hi:
            return band
    return None


async def fetch_pota() -> list[dict]:
    cached = cache.get("pota_spots")
    if cached:
        return cached
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
            async with session.get(POTA_URL) as r:
                if r.status != 200:
                    return []
                data = await r.json(content_type=None)
                spots = []
                for s in (data if isinstance(data, list) else []):
                    try:
                        freq = float(s.get("frequency") or 0)
                        spots.append({
                            "callsign": s.get("activator","").upper(),
                            "park_ref": s.get("reference",""),
                            "park_name": s.get("name",""),
                            "freq": freq,
                            "band": hz_to_band(freq) or "?",
                            "mode": s.get("mode","").upper(),
                            "spotter": s.get("spotter",""),
                            "comments": s.get("comments",""),
                            # spotTime is a full ISO timestamp ("2026-08-31T10:02:34"),
                            # so slicing the first 5 characters rendered every POTA
                            # spot's UTC column as "2026-". Match the SOTA format so
                            # /api/activations can still sort the two sources against
                            # each other as plain strings.
                            "time_utc": (s.get("spotTime","") or "")[:16].replace("T", " "),
                            "type": "POTA",
                        })
                    except Exception:
                        pass
                cache.set("pota_spots", spots, ttl=120)
                logger.info(f"POTA: {len(spots)} spots")
                return spots
    except Exception as e:
        logger.warning(f"POTA fetch failed: {e}")
        return []


def _is_sota_tombstone(s: dict) -> bool:
    """True for the synthetic row api2.sota.org.uk prepends to every spots response.

    Since 2026-09 the upstream injects a sentinel record (id 9999999999999999,
    every call/summit field literally "DEPRECATED") carrying a deprecation
    notice in `comments`. It has no frequency, so it parsed as a freq-0.0 spot
    and rendered as the top row of the activations panel. It is a notice, not a
    spot, so it is dropped here.

    This filter is NOT the migration. /api/spots/50/-1 is deprecated on both
    api2 and api-db2 and the upstream's stated removal date has already passed;
    moving to the replacement API needs a human, because SOTA's terms of service
    (https://api-db2.sota.org.uk/docs) require a named point of contact
    registered in their "API-consumers" group and give no documented successor
    endpoint. Tracked in scripts/health/state.json under awaiting_james.
    """
    sentinel = {"DEPRECATED", ""}
    return (
        str(s.get("callsign", "")).upper() == "DEPRECATED"
        and str(s.get("activatorCallsign", "")).upper() in sentinel
        and str(s.get("summitCode", "")).upper() in sentinel
    )


async def fetch_sota() -> list[dict]:
    cached = cache.get("sota_spots")
    if cached:
        return cached
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
            async with session.get(SOTA_URL) as r:
                if r.status != 200:
                    return []
                data = await r.json(content_type=None)
                spots = []
                for s in (data if isinstance(data, list) else []):
                    if _is_sota_tombstone(s):
                        continue
                    try:
                        freq = float(s.get("frequency") or 0)
                        spots.append({
                            "callsign": s.get("activatorCallsign","").upper(),
                            "summit_ref": s.get("summitCode",""),
                            "summit_name": s.get("summitDetails",""),
                            "freq": freq,
                            "band": hz_to_band(freq) or "?",
                            "mode": s.get("mode","").upper(),
                            "spotter": s.get("callsign",""),
                            "comments": s.get("comments",""),
                            "time_utc": (s.get("timeStamp","") or "")[:16].replace("T"," "),
                            "type": "SOTA",
                        })
                    except Exception:
                        pass
                cache.set("sota_spots", spots, ttl=120)
                logger.info(f"SOTA: {len(spots)} spots")
                return spots
    except Exception as e:
        logger.warning(f"SOTA fetch failed: {e}")
        return []
