import asyncio
import re
import logging
from datetime import datetime, timezone
from cache import cache

logger = logging.getLogger(__name__)

# Public DX clusters - tries each in order until one connects
CLUSTERS = [
    ("dxc.ve7cc.net", 23),
    ("cluster.dl9gtb.de", 8000),
    ("dxc.w6yx.stanford.edu", 7300),
    ("w3lpl.net", 7373),
]

POLL_INTERVAL = 60  # seconds between reconnect attempts
MAX_SPOTS = 500
SPOT_TTL = 3600  # keep spots for 1 hour

# DX spot line regex - handles most cluster formats
# DX de K6WRJ:    14025.0  JA1ABC       FT8 -12dB            1234Z
SPOT_RE = re.compile(
    r"DX de\s+(\S+):\s+([\d.]+)\s+(\S+)\s*(.*?)\s+(\d{4}Z)?",
    re.IGNORECASE,
)

FREQ_TO_BAND = [
    (1800, 2000, "160m"), (3500, 4000, "80m"), (7000, 7300, "40m"),
    (10100, 10150, "30m"), (14000, 14350, "20m"), (18068, 18168, "17m"),
    (21000, 21450, "15m"), (24890, 24990, "12m"), (28000, 29700, "10m"),
    (50000, 54000, "6m"), (144000, 148000, "2m"),
]


def freq_to_band(khz: float) -> str:
    for lo, hi, band in FREQ_TO_BAND:
        if lo <= khz <= hi:
            return band
    return "other"


def parse_mode(comment: str) -> str:
    comment_upper = comment.upper()
    for mode in ["FT8", "FT4", "JS8", "RTTY", "PSK31", "SSB", "CW", "AM", "FM"]:
        if mode in comment_upper:
            return mode
    return "SSB"  # default assumption for cluster spots


def parse_spot(line: str) -> dict | None:
    m = SPOT_RE.search(line)
    if not m:
        return None
    spotter, freq_str, callsign, comment, time_str = m.groups()
    try:
        freq = float(freq_str)
    except ValueError:
        return None
    band = freq_to_band(freq)
    mode = parse_mode(comment or "")
    return {
        "spotter": spotter.rstrip(":"),
        "freq": freq,
        "callsign": callsign.upper(),
        "band": band,
        "mode": mode,
        "comment": (comment or "").strip(),
        "time_utc": time_str or datetime.now(timezone.utc).strftime("%H%MZ"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


class ClusterPoller:
    def __init__(self):
        self._spots: list[dict] = []
        self._connected = False

    def _add_spot(self, spot: dict):
        # Deduplicate: same callsign + band within 10 min
        self._spots = [
            s for s in self._spots
            if not (s["callsign"] == spot["callsign"] and s["band"] == spot["band"])
        ]
        self._spots.insert(0, spot)
        if len(self._spots) > MAX_SPOTS:
            self._spots = self._spots[:MAX_SPOTS]
        cache.set("spots", self._spots, ttl=SPOT_TTL)

    async def connect_and_read(self, host: str, port: int):
        logger.info(f"Connecting to DX cluster {host}:{port}")
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port), timeout=10
        )
        self._connected = True
        logger.info(f"Connected to {host}:{port}")

        try:
            # Send callsign to log in
            await asyncio.sleep(2)
            writer.write(b"K6WRJ\r\n")
            await writer.drain()
            await asyncio.sleep(1)
            # Set filter: show all spots
            writer.write(b"set/dx\r\n")
            await writer.drain()

            while True:
                line = await asyncio.wait_for(reader.readline(), timeout=120)
                if not line:
                    break
                text = line.decode("utf-8", errors="ignore").strip()
                if text.upper().startswith("DX DE"):
                    spot = parse_spot(text)
                    if spot:
                        self._add_spot(spot)
                        logger.debug(f"Spot: {spot['callsign']} {spot['band']} {spot['freq']}")
        finally:
            writer.close()
            self._connected = False

    async def run(self):
        cluster_index = 0
        while True:
            host, port = CLUSTERS[cluster_index % len(CLUSTERS)]
            try:
                await self.connect_and_read(host, port)
            except Exception as e:
                logger.warning(f"Cluster {host}:{port} failed: {e}")
                cluster_index += 1
            await asyncio.sleep(POLL_INTERVAL)
