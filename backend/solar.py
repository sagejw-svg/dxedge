import asyncio
import aiohttp
import logging
from datetime import datetime, timezone
from cache import cache
from database import save_solar, load_latest_solar

logger = logging.getLogger(__name__)

POLL_INTERVAL = 900  # 15 minutes

K_INDEX_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"
SFI_URL     = "https://services.swpc.noaa.gov/json/solar-cycle/observed-solar-cycle-indices.json"
XRAY_URL    = "https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json"


class SolarPoller:
    async def fetch(self):
        sfi, kp, ssn = 140, 2, 120
        x_class = None
        source = "estimated"

        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
            try:
                async with session.get(K_INDEX_URL) as r:
                    data = await r.json(content_type=None)
                    if data and len(data) > 1:
                        kp = float(data[-1][1])
                        source = "NOAA SWPC"
            except Exception as e:
                logger.warning(f"K-index fetch failed: {e}")

            try:
                async with session.get(SFI_URL) as r:
                    data = await r.json(content_type=None)
                    if data:
                        last = data[-1]
                        sfi = round(float(last.get("f10.7") or last.get("f10.7_adj") or sfi))
                        ssn = round(float(last.get("ssn") or ssn))
                        source = "NOAA SWPC"
            except Exception as e:
                logger.warning(f"SFI fetch failed: {e}")

            try:
                async with session.get(XRAY_URL) as r:
                    data = await r.json(content_type=None)
                    if data:
                        last = data[-1]
                        flux = float(last.get("flux") or 0)
                        if flux >= 1e-4:   x_class = "X"
                        elif flux >= 1e-5: x_class = "M"
                        elif flux >= 1e-6: x_class = "C"
            except Exception as e:
                logger.warning(f"X-ray fetch failed: {e}")

        kp_round = round(kp)
        a_index = [0, 3, 7, 15, 27, 48, 80, 132, 207, 400][min(kp_round, 9)]

        result = {
            "sfi": sfi,
            "k_index": round(kp, 1),
            "a_index": a_index,
            "ssn": ssn,
            "x_class": x_class,
            "source": source,
            "updated": datetime.now(timezone.utc).isoformat(),
            "summary": self._summary(sfi, kp, a_index),
            "band_conditions": self._band_conditions(sfi, kp),
        }

        # Read previous BEFORE overwriting - used for VOACAP cache bust
        prev = cache.get("solar")
        cache.set("solar", result, ttl=POLL_INTERVAL + 60)
        # Persist to SQLite
        try:
            save_solar(result)
        except Exception as e:
            logger.debug(f"DB save solar failed: {e}")

        # Invalidate VOACAP caches if conditions changed significantly
        if prev:
            sfi_delta = abs(prev.get("sfi", sfi) - sfi)
            kp_delta  = abs(prev.get("k_index", kp) - kp)
            if sfi_delta >= 10 or kp_delta >= 1:
                # Bust VOACAP caches so predictions regenerate with new data
                for key in cache.keys():
                    if key.startswith("voacap") or key.startswith("rec_") or key.startswith("dashboard"):
                        cache.delete(key)
                logger.info(f"VOACAP cache busted (SFI delta={sfi_delta}, K delta={kp_delta:.1f})")

        logger.info(f"Solar updated: SFI={sfi} K={kp:.1f} SSN={ssn}")
        return result

    def _summary(self, sfi, kp, a_index):
        if kp >= 5:   geo = "Severe geomagnetic storm - expect significant HF degradation."
        elif kp >= 4: geo = "Active geomagnetic conditions - polar paths affected."
        elif kp >= 3: geo = "Unsettled geomagnetic conditions - minor impact on high-lat paths."
        else:          geo = "Quiet geomagnetic conditions."

        if sfi >= 150:   prop = "Excellent solar flux. Upper HF bands wide open."
        elif sfi >= 120: prop = "Good solar flux. 20m-15m strong, check 10m around noon."
        elif sfi >= 90:  prop = "Moderate flux. 20m/40m most reliable for DX."
        else:             prop = "Low solar flux. Focus on 40m/80m for DX."

        return f"{prop} {geo}"

    def _band_conditions(self, sfi, kp):
        """
        Band conditions based on SFI and K-index only.
        Note: Does NOT apply time-of-day adjustments - those are shown
        in the 24h hourly summary which uses proper solar geometry.
        """
        bands = ["160m","80m","40m","30m","20m","17m","15m","12m","10m","6m"]
        thresholds = {
            "160m": [70,90,120], "80m": [70,90,120], "40m": [70,90,120],
            "30m":  [80,100,130], "20m": [90,110,140], "17m": [95,120,150],
            "15m":  [100,130,160], "12m": [110,140,170],
            "10m":  [120,150,180], "6m":  [140,170,200],
        }
        conditions = []
        for band in bands:
            p, f, g = thresholds[band]
            score = 0 if sfi < p else 1 if sfi < f else 2 if sfi < g else 3
            if kp >= 5: score = max(0, score - 2)
            elif kp >= 3: score = max(0, score - 1)
            label = ["poor","fair","good","excellent"][score]
            conditions.append({"band": band, "condition": label})
        return conditions

    async def restore_from_db(self):
        """Load last solar reading from DB so cache is warm on startup."""
        try:
            row = load_latest_solar()
            if row:
                cache.set("solar", {
                    "sfi": row["sfi"], "k_index": row["k_index"],
                    "a_index": row["a_index"], "ssn": row["ssn"],
                    "x_class": row["x_class"], "source": row["source"] + " (cached)",
                    "updated": row["timestamp"],
                    "summary": self._summary(row["sfi"], row["k_index"], row["a_index"]),
                    "band_conditions": self._band_conditions(row["sfi"], row["k_index"]),
                }, ttl=POLL_INTERVAL + 60)
                logger.info(f"Restored solar from DB: SFI={row['sfi']} K={row['k_index']}")
        except Exception as e:
            logger.warning(f"Could not restore solar from DB: {e}")

    async def run(self):
        await self.restore_from_db()
        while True:
            try:
                await self.fetch()
            except Exception as e:
                logger.error(f"Solar poller error: {e}")
            await asyncio.sleep(POLL_INTERVAL)
