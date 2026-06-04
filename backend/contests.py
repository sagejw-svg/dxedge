"""
Contest calendar fetcher.
Primary source: contestcalendar.com weekly calendar.
Supplemented with a curated major-contest reference table for mode/band info.
"""
import asyncio
import aiohttp
import logging
import re
import html
from datetime import datetime, timezone
from cache import cache

logger = logging.getLogger(__name__)

# Major contests with their metadata
# Keyed by lowercase name fragment -> metadata
MAJOR_CONTESTS = {
    "cq ww wpx":    {"mode": "CW/SSB", "bands": "All HF",  "sponsor": "CQ Magazine",    "tier": 1},
    "cq ww dx":     {"mode": "CW/SSB", "bands": "All HF",  "sponsor": "CQ Magazine",    "tier": 1},
    "arrl dx":      {"mode": "CW/SSB", "bands": "HF",      "sponsor": "ARRL",           "tier": 1},
    "arrl sweepstakes": {"mode": "CW/SSB", "bands": "HF",  "sponsor": "ARRL",           "tier": 1},
    "arrl 10m":     {"mode": "CW/SSB/Digital", "bands": "10m", "sponsor": "ARRL",       "tier": 1},
    "arrl 160m":    {"mode": "CW",     "bands": "160m",    "sponsor": "ARRL",           "tier": 1},
    "arrl field day": {"mode": "All", "bands": "All HF/VHF", "sponsor": "ARRL",         "tier": 1},
    "jidx":         {"mode": "CW/Phone", "bands": "HF",    "sponsor": "JARL",           "tier": 1},
    "cqwpx":        {"mode": "CW",     "bands": "All HF",  "sponsor": "CQ Magazine",    "tier": 1},
    "iota":         {"mode": "CW/SSB", "bands": "HF",      "sponsor": "RSGB",           "tier": 1},
    "rsgb iota":    {"mode": "CW/SSB", "bands": "HF",      "sponsor": "RSGB",           "tier": 1},
    "dx contest":   {"mode": "CW",     "bands": "HF",      "sponsor": "Various",        "tier": 2},
    "sprint":       {"mode": "CW",     "bands": "HF",      "sponsor": "Various",        "tier": 3},
    "cwops":        {"mode": "CW",     "bands": "HF",      "sponsor": "CWops",          "tier": 3},
    "cwt":          {"mode": "CW",     "bands": "HF",      "sponsor": "CWops",          "tier": 3},
    "skcc":         {"mode": "CW",     "bands": "HF",      "sponsor": "SKCC",           "tier": 3},
    "ft4":          {"mode": "FT4",    "bands": "HF",      "sponsor": "Various",        "tier": 3},
    "ft8":          {"mode": "FT8",    "bands": "HF",      "sponsor": "Various",        "tier": 3},
    "rtty":         {"mode": "RTTY",   "bands": "HF",      "sponsor": "Various",        "tier": 2},
    "psk":          {"mode": "PSK31",  "bands": "HF",      "sponsor": "Various",        "tier": 3},
    "qrp":          {"mode": "CW",     "bands": "HF",      "sponsor": "QRP ARCI",       "tier": 3},
    "sideband":     {"mode": "SSB",    "bands": "HF",      "sponsor": "Various",        "tier": 3},
    "phone":        {"mode": "SSB",    "bands": "HF",      "sponsor": "Various",        "tier": 3},
    "80m":          {"mode": "Various","bands": "80m",     "sponsor": "Various",        "tier": 3},
    "40m":          {"mode": "Various","bands": "40m",     "sponsor": "Various",        "tier": 3},
    "nccc":         {"mode": "CW/FT4", "bands": "HF",      "sponsor": "NCCC",           "tier": 3},
    "k1usn":        {"mode": "CW",     "bands": "HF",      "sponsor": "K1USN",          "tier": 3},
    "romanian":     {"mode": "SSB",    "bands": "HF",      "sponsor": "Romanian Diaspora", "tier": 3},
    "rsgb":         {"mode": "CW/Data","bands": "80m",     "sponsor": "RSGB",           "tier": 2},
    "worldwide":    {"mode": "SSB",    "bands": "HF",      "sponsor": "Various",        "tier": 2},
    "ok1wc":        {"mode": "CW",     "bands": "HF",      "sponsor": "OK1WC",          "tier": 3},
    "icwc":         {"mode": "CW",     "bands": "HF",      "sponsor": "ICWC",           "tier": 3},
    "qcx":          {"mode": "CW",     "bands": "HF",      "sponsor": "QRP Labs",       "tier": 3},
    "a1club":       {"mode": "CW",     "bands": "HF",      "sponsor": "A1 Club",        "tier": 3},
}

def enrich_contest(name: str) -> dict:
    """Look up metadata for a contest by name."""
    name_lower = name.lower()
    for key, meta in MAJOR_CONTESTS.items():
        if key in name_lower:
            return meta
    # Guess mode from name
    mode = "CW" if "cw" in name_lower else \
           "SSB" if any(x in name_lower for x in ["ssb","phone","sideband"]) else \
           "FT8" if "ft8" in name_lower else \
           "FT4" if "ft4" in name_lower else \
           "RTTY" if "rtty" in name_lower else "Various"
    return {"mode": mode, "bands": "HF", "sponsor": "", "tier": 3}


def parse_date(date_str: str, year: int) -> tuple[str, str]:
    """Parse date string like 'May 30', 'May 30-31', 'Jun 1' -> (start, end) ISO dates."""
    date_str = date_str.strip()
    months = {"Jan":1,"Feb":2,"Mar":3,"Apr":4,"May":5,"Jun":6,
              "Jul":7,"Aug":8,"Sep":9,"Oct":10,"Nov":11,"Dec":12}
    try:
        # Range: "May 30-31" or "May 31-Jun 1"
        if "-" in date_str:
            parts = date_str.split("-")
            start_str = parts[0].strip()
            end_str = parts[1].strip()
            # Parse start
            sp = start_str.split()
            sm, sd = months.get(sp[0], 1), int(sp[1]) if len(sp) > 1 else 1
            # Parse end - may have month prefix or not
            ep = end_str.split()
            if len(ep) == 2:
                em, ed = months.get(ep[0], sm), int(ep[1])
            else:
                em, ed = sm, int(ep[0])
            start = f"{year}-{sm:02d}-{sd:02d}"
            end   = f"{year}-{em:02d}-{ed:02d}"
        else:
            parts = date_str.split()
            if len(parts) >= 2:
                m, d = months.get(parts[0], 1), int(parts[1])
                start = end = f"{year}-{m:02d}-{d:02d}"
            else:
                start = end = f"{year}-01-01"
        return start, end
    except Exception:
        return "", ""


async def fetch_contests() -> list[dict]:
    cached = cache.get("contests")
    if cached:
        return cached

    try:
        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=15),
            headers={"User-Agent": "Mozilla/5.0 DXEdge/1.0 ham radio dashboard"}
        ) as session:
            # Fetch weekly calendar
            async with session.get("https://www.contestcalendar.com/weeklycont.php") as r:
                if r.status != 200:
                    return []
                html = await r.text()

        # Parse rows
        now = datetime.now(timezone.utc)
        year = now.year
        rows = re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.DOTALL)

        contests = []
        seen = set()
        for row in rows:
            cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
            clean = [html.unescape(re.sub(r'<[^>]+>', '', c)).strip() for c in cells]
            if len(clean) < 2 or not clean[0] or not clean[1]:
                continue
            name = clean[0]
            date_str = clean[1]

            # Deduplicate
            key = f"{name}|{date_str}"
            if key in seen:
                continue
            seen.add(key)

            start, end = parse_date(date_str, year)
            if not start:
                continue

            meta = enrich_contest(name)

            # Is it active now?
            today = now.strftime("%Y-%m-%d")
            is_active = start <= today <= end

            # Is it upcoming (within 7 days)?
            try:
                start_dt = datetime.strptime(start, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                days_away = (start_dt - now).days
                is_upcoming = 0 < days_away <= 21
            except Exception:
                days_away = 99
                is_upcoming = False

            contests.append({
                "name": name,
                "date_str": date_str,
                "start": start,
                "end": end,
                "mode": meta["mode"],
                "bands": meta["bands"],
                "sponsor": meta["sponsor"],
                "tier": meta["tier"],
                "is_active": is_active,
                "is_upcoming": is_upcoming,
                "days_away": days_away,
            })

        # Sort: active first, then by date
        contests.sort(key=lambda x: (not x["is_active"], x["start"]))
        cache.set("contests", contests, ttl=3600 * 3)  # 3hr cache for multi-week data
        logger.info(f"Fetched {len(contests)} contests")
        return contests

    except Exception as e:
        logger.warning(f"Contest fetch failed: {e}")
        return []
