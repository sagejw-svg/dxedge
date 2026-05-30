"""
Band opening and space weather push alerts via ntfy.sh.
Users subscribe to a topic like dxedge-K6WRJ.
Backend checks conditions every 15 min and pushes when thresholds are met.
"""
import asyncio
import aiohttp
import json
import logging
from datetime import datetime, timezone, timedelta
from cache import cache
from database import get_subscriptions, update_last_sent

logger = logging.getLogger(__name__)

NTFY_BASE = "https://ntfy.sh"
CHECK_INTERVAL = 900   # 15 minutes
MIN_ALERT_GAP  = 3600  # don't re-alert same topic within 1 hour


def check_conditions(solar: dict) -> list[dict]:
    """
    Evaluate solar data and return list of triggered alerts.
    Each alert: {type, title, message, priority, tags}
    """
    if not solar:
        return []

    sfi  = solar.get("sfi",  140)
    kp   = solar.get("k_index", 2)
    triggered = []

    # 10m opening - SFI high + quiet geo
    if sfi >= 150 and kp <= 2:
        triggered.append({
            "type":     "10m_open",
            "title":    "10m Band Opening",
            "message":  f"Conditions favor 10m: SFI={sfi}, K={kp}. Check the band!",
            "priority": "high",
            "tags":     ["radio_button", "sunny"],
        })

    # Geomagnetic storm warning
    if kp >= 5:
        level = "severe" if kp >= 7 else "strong" if kp >= 6 else "moderate"
        triggered.append({
            "type":     "k_storm",
            "title":    f"Geomagnetic Storm (K={kp})",
            "message":  f"K-index is {kp} ({level} storm). HF propagation degraded, especially polar paths.",
            "priority": "urgent" if kp >= 6 else "high",
            "tags":     ["warning", "zap"],
        })

    # SFI drop - notable degradation
    prev_sfi = cache.get("prev_sfi_alert")
    if prev_sfi and sfi < 80 and prev_sfi >= 100:
        triggered.append({
            "type":     "sfi_drop",
            "title":    "Solar Flux Drop",
            "message":  f"SFI fell to {sfi} (was {prev_sfi}). HF conditions degrading.",
            "priority": "default",
            "tags":     ["chart_decreasing"],
        })
    cache.set("prev_sfi_alert", sfi, ttl=86400)

    return triggered


async def send_ntfy(topic: str, title: str, message: str,
                    priority: str = "default", tags: list = None) -> bool:
    try:
        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=10)
        ) as session:
            headers = {
                "Title":    title,
                "Priority": priority,
                "Tags":     ",".join(tags or []),
                "Content-Type": "text/plain",
            }
            async with session.post(
                f"{NTFY_BASE}/{topic}",
                data=message.encode(),
                headers=headers,
            ) as r:
                if r.status in (200, 201):
                    logger.info(f"Alert sent to {topic}: {title}")
                    return True
                else:
                    logger.warning(f"ntfy {topic} returned {r.status}")
                    return False
    except Exception as e:
        logger.warning(f"ntfy send failed: {e}")
        return False


async def run_alert_loop():
    """Background task - checks conditions and dispatches alerts."""
    await asyncio.sleep(60)  # Wait for pollers to populate cache
    while True:
        try:
            solar = cache.get("solar")
            triggered = check_conditions(solar)

            if triggered:
                subs = get_subscriptions()
                now = datetime.now(timezone.utc)

                for sub in subs:
                    sub_alerts = json.loads(sub.get("alerts", "[]"))
                    last_sent = sub.get("last_sent")

                    # Rate limit: don't alert more than once per hour per topic
                    if last_sent:
                        try:
                            ls_dt = datetime.fromisoformat(last_sent)
                            if (now - ls_dt).seconds < MIN_ALERT_GAP:
                                continue
                        except Exception:
                            pass

                    for alert in triggered:
                        if alert["type"] in sub_alerts:
                            sent = await send_ntfy(
                                topic    = sub["topic"],
                                title    = alert["title"],
                                message  = alert["message"],
                                priority = alert["priority"],
                                tags     = alert["tags"],
                            )
                            if sent:
                                update_last_sent(sub["topic"])
                                break  # One alert per check per subscriber

        except Exception as e:
            logger.error(f"Alert loop error: {e}")

        await asyncio.sleep(CHECK_INTERVAL)
