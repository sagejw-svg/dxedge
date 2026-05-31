import asyncio
import re
import logging
from datetime import datetime, timezone
from cache import cache
from database import save_spots, load_recent_spots, prune_old_spots
from dxcc import enrich_spot

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
        # Deduplicate in memory: same callsign + band
        self._spots = [
            s for s in self._spots
            if not (s["callsign"] == spot["callsign"] and s["band"] == spot["band"])
        ]
        self._spots.insert(0, spot)
        if len(self._spots) > MAX_SPOTS:
            self._spots = self._spots[:MAX_SPOTS]
        cache.set("spots", self._spots, ttl=SPOT_TTL)
        # Persist to SQLite
        try:
            save_spots([spot])
        except Exception as e:
            logger.debug(f"DB save spot failed: {e}")
        # Broadcast to WebSocket clients
        try:
            import asyncio
            from main import broadcaster
            asyncio.create_task(broadcaster.broadcast(spot))
        except Exception:
            pass

    async def load_from_db(self):
        """Restore spots from DB on startup so we have data immediately."""
        try:
            db_spots = load_recent_spots(limit=MAX_SPOTS)
            if db_spots:
                # Re-enrich DXCC data in case it was missing when stored
                enriched = 0
                for s in db_spots:
                    if not s.get("flag") or not s.get("dxcc"):
                        enrich_spot(s)
                        enriched += 1
                self._spots = db_spots
                cache.set("spots", self._spots, ttl=SPOT_TTL)
                logger.info(f"Restored {len(db_spots)} spots from DB ({enriched} re-enriched)")
        except Exception as e:
            logger.warning(f"Could not restore spots from DB: {e}")

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
                        enrich_spot(spot)
                        self._add_spot(spot)
                        logger.debug(f"Spot: {spot['callsign']} {spot['band']} {spot['freq']}")
        finally:
            writer.close()
            self._connected = False

    async def run(self):
        await self.load_from_db()

        cluster_index   = 0
        prune_counter   = 0
        fail_count      = 0          # consecutive failures
        BACKOFF_BASE    = 10         # seconds
        BACKOFF_MAX     = 600        # 10 minutes ceiling
        BACKOFF_RESET   = 300        # reset fail count after 5 min of success

        last_success = asyncio.get_event_loop().time()

        while True:
            host, port = CLUSTERS[cluster_index % len(CLUSTERS)]
            try:
                await self.connect_and_read(host, port)
                # Successful connection (ran for a while)
                fail_count   = 0
                last_success = asyncio.get_event_loop().time()
                # Small pause before reconnecting to same/next cluster
                await asyncio.sleep(5)

            except asyncio.CancelledError:
                raise

            except Exception as e:
                fail_count += 1
                cluster_index += 1  # try next cluster on next attempt

                # Exponential backoff: 10s, 20s, 40s, 80s, ... capped at 10min
                delay = min(BACKOFF_BASE * (2 ** (fail_count - 1)), BACKOFF_MAX)

                logger.warning(
                    f"Cluster {host}:{port} failed (attempt {fail_count}): {e}. "
                    f"Retrying in {delay}s..."
                )
                await asyncio.sleep(delay)

            # Prune old spots from DB approximately hourly
            prune_counter += 1
            if prune_counter >= 20:
                try:
                    prune_old_spots(hours=24)
                except Exception:
                    pass
                prune_counter = 0
