import asyncio
import aiohttp
import logging
from xml.etree import ElementTree as ET
from datetime import datetime, timezone
from cache import cache

logger = logging.getLogger(__name__)

PSK_URL = "https://retrieve.pskreporter.info/query"
POLL_INTERVAL = 300  # 5 minutes
DEFAULT_GRIDS = ["CM95", "CM96", "CM85", "DM04"]  # San Diego area + neighbors

FREQ_TO_BAND = [
    (1800, 2000, "160m"), (3500, 4000, "80m"), (7000, 7300, "40m"),
    (10100, 10150, "30m"), (14000, 14350, "20m"), (18068, 18168, "17m"),
    (21000, 21450, "15m"), (24890, 24990, "12m"), (28000, 29700, "10m"),
    (50000, 54000, "6m"),
]


def hz_to_band(hz: int) -> str | None:
    khz = hz / 1000
    for lo, hi, band in FREQ_TO_BAND:
        if lo <= khz <= hi:
            return band
    return None


def parse_psk_xml(xml_text: str) -> list[dict]:
    spots = {}
    try:
        root = ET.fromstring(xml_text)
        for rep in root.findall(".//receptionReport"):
            def g(tag):
                el = rep.find(tag)
                return el.text if el is not None else None

            sender = g("senderCallsign")
            freq_str = g("frequency")
            if not sender or not freq_str:
                continue
            try:
                freq_hz = int(freq_str)
            except ValueError:
                continue
            band = hz_to_band(freq_hz)
            if not band:
                continue
            try:
                snr = int(g("snr") or -99)
            except ValueError:
                snr = -99
            mode = g("mode") or "FT8"
            country = g("senderCountry") or g("senderDXCC") or ""
            grid = g("senderLocator") or ""
            key = f"{sender}-{band}"
            if key not in spots or snr > spots[key]["snr"]:
                spots[key] = {
                    "callsign": sender.upper(),
                    "freq_hz": freq_hz,
                    "freq_mhz": round(freq_hz / 1e6, 4),
                    "band": band,
                    "snr": snr,
                    "mode": mode,
                    "country": country,
                    "grid": grid,
                }
    except ET.ParseError as e:
        logger.warning(f"PSK XML parse error: {e}")
    return sorted(spots.values(), key=lambda x: x["snr"], reverse=True)


class PSKPoller:
    async def fetch_grid(self, grid4: str) -> list[dict]:
        url = f"{PSK_URL}?receiverGrid={grid4}&flowStartSeconds=-7200&rronly=1"
        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=15)
        ) as session:
            async with session.get(url) as r:
                if r.status != 200:
                    raise Exception(f"HTTP {r.status}")
                text = await r.text()
                spots = parse_psk_xml(text)
                logger.info(f"PSK {grid4}: {len(spots)} spots")
                return spots

    async def run(self):
        while True:
            for grid in DEFAULT_GRIDS:
                try:
                    spots = await self.fetch_grid(grid)
                    cache.set(f"psk_{grid}", spots, ttl=POLL_INTERVAL + 60)
                except Exception as e:
                    logger.warning(f"PSK fetch {grid} failed: {e}")
                await asyncio.sleep(5)
            await asyncio.sleep(POLL_INTERVAL)
