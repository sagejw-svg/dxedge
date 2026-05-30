import asyncio
import aiohttp
import logging
from xml.etree import ElementTree as ET
from cache import cache
from database import save_psk_spots, load_psk_spots, prune_old_psk

logger = logging.getLogger(__name__)

PSK_URL = "https://retrieve.pskreporter.info/query"
POLL_INTERVAL = 300  # 5 minutes

# Western US grids - broad coverage so we always find spots
WESTERN_US_GRIDS = ["CM95", "CM96", "CM85", "CM94", "DM04", "DM03",
                    "DM13", "CN87", "DM05", "CM98"]

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
                el = rep.find(tag) if hasattr(rep, 'find') else None
                return rep.get(tag) if rep.get(tag) else (el.text if el is not None else None)

            # Attributes are directly on the element (not child tags)
            sender  = rep.get("senderCallsign")
            freq_str = rep.get("frequency")
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
                snr = int(rep.get("sNR") or -99)
            except ValueError:
                snr = -99

            mode    = rep.get("mode") or "FT8"
            country = rep.get("senderDXCC") or ""
            dxcc_code = rep.get("senderDXCCCode") or ""
            grid    = rep.get("senderLocator") or ""
            receiver = rep.get("receiverCallsign") or ""
            lotw    = rep.get("senderLotwUpload") or ""

            key = f"{sender}-{band}"
            if key not in spots or snr > spots[key]["snr"]:
                spots[key] = {
                    "callsign":   sender.upper(),
                    "freq_hz":    freq_hz,
                    "freq_mhz":   round(freq_hz / 1e6, 4),
                    "band":       band,
                    "snr":        snr,
                    "mode":       mode,
                    "country":    country,
                    "dxcc_code":  dxcc_code,
                    "grid":       grid,
                    "receiver":   receiver,
                    "lotw":       bool(lotw),
                }
    except ET.ParseError as e:
        logger.warning(f"PSK XML parse error: {e}")
    return sorted(spots.values(), key=lambda x: x["snr"], reverse=True)


class PSKPoller:
    async def fetch_grid(self, grid4: str) -> list[dict]:
        url = (f"{PSK_URL}?receiverGrid={grid4}"
               f"&flowStartSeconds=-7200&rronly=1")
        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=15)
        ) as session:
            async with session.get(url) as r:
                if r.status != 200:
                    raise Exception(f"HTTP {r.status}")
                text = await r.text()
                spots = parse_psk_xml(text)
                logger.info(f"PSK {grid4}: {len(spots)} spots")
                # Persist to DB
                if spots:
                    try:
                        save_psk_spots(spots, grid4)
                    except Exception as e:
                        logger.debug(f"DB save PSK failed: {e}")
                return spots

    async def fetch_region(self, grids: list[str]) -> list[dict]:
        """Fetch spots for multiple grids and merge, deduplicating by callsign+band."""
        all_spots = {}
        for grid in grids:
            try:
                spots = await self.fetch_grid(grid)
                for s in spots:
                    key = f"{s['callsign']}-{s['band']}"
                    if key not in all_spots or s['snr'] > all_spots[key]['snr']:
                        all_spots[key] = s
                if len(all_spots) > 20:
                    break  # enough spots found
                await asyncio.sleep(1)  # rate limit
            except Exception as e:
                logger.warning(f"PSK fetch {grid} failed: {e}")
        return sorted(all_spots.values(), key=lambda x: x["snr"], reverse=True)

    async def run(self):
        while True:
            # Poll grids in rotation - try CM95 first, then expand
            for grid in WESTERN_US_GRIDS[:4]:
                try:
                    spots = await self.fetch_grid(grid)
                    ttl = 360
                    cache.set(f"psk_{grid}", spots, ttl=ttl)
                    if spots:
                        logger.info(f"PSK {grid}: {len(spots)} spots cached")
                except Exception as e:
                    logger.warning(f"PSK poller {grid}: {e}")
                await asyncio.sleep(3)
            await asyncio.sleep(POLL_INTERVAL)
