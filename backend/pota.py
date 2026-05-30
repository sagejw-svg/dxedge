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
                            "time_utc": (s.get("spotTime","") or "")[:5],
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
