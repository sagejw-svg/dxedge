"""
Contest calendar fetcher.
Primary source: contestcalendar.com weekly calendar.
Supplemented with a curated major-contest reference table for mode/band info.
"""
import asyncio
import aiohttp
import logging
import re
from datetime import datetime, timezone
from cache import cache

logger = logging.getLogger(__name__)

# Contest metadata, split into two tables on purpose.
#
# SPECIFIC_CONTESTS holds named events with curated metadata. GENERIC_FRAGMENTS
# holds band, mode and club hints for everything else. Specific is matched
# FIRST, so a broad fragment can never shadow a real event: "dx contest" is a
# substring of "JIDX Contest", and a single flat table resolved that to the
# generic tier-2 CW entry instead of JARL's tier-1 one.
#
# Within each table the LONGEST matching key wins, not the first, so key order
# carries no meaning and adding a key cannot silently re-point an existing one.
#
# Keys must match what contestcalendar.com actually emits, which spells names
# out: "CQ Worldwide DX Contest", not "CQ WW DX". Both spellings are listed,
# because the abbreviated ones are what a human or another source would write.
SPECIFIC_CONTESTS = {
    "cq worldwide wpx":      {"mode": "CW/SSB", "bands": "All HF", "sponsor": "CQ Magazine", "tier": 1},
    "cq ww wpx":             {"mode": "CW/SSB", "bands": "All HF", "sponsor": "CQ Magazine", "tier": 1},
    "cqwpx":                 {"mode": "CW",     "bands": "All HF", "sponsor": "CQ Magazine", "tier": 1},
    "cq worldwide dx":       {"mode": "CW/SSB", "bands": "All HF", "sponsor": "CQ Magazine", "tier": 1},
    "cq ww dx":              {"mode": "CW/SSB", "bands": "All HF", "sponsor": "CQ Magazine", "tier": 1},
    "arrl international dx": {"mode": "CW/SSB", "bands": "HF",     "sponsor": "ARRL",        "tier": 1},
    "arrl dx":               {"mode": "CW/SSB", "bands": "HF",     "sponsor": "ARRL",        "tier": 1},
    "arrl sweepstakes":      {"mode": "CW/SSB", "bands": "HF",     "sponsor": "ARRL",        "tier": 1},
    "arrl 10m":              {"mode": "CW/SSB/Digital", "bands": "10m", "sponsor": "ARRL",   "tier": 1},
    "arrl 160m":             {"mode": "CW",     "bands": "160m",   "sponsor": "ARRL",        "tier": 1},
    "arrl field day":        {"mode": "All",    "bands": "All HF/VHF", "sponsor": "ARRL",    "tier": 1},
    "jidx":                  {"mode": "CW/Phone", "bands": "HF",   "sponsor": "JARL",        "tier": 1},
    "rsgb iota":             {"mode": "CW/SSB", "bands": "HF",     "sponsor": "RSGB",        "tier": 1},
    "iota":                  {"mode": "CW/SSB", "bands": "HF",     "sponsor": "RSGB",        "tier": 1},
}

# Consulted only when nothing in SPECIFIC_CONTESTS matched. These are hints,
# not identities, so their "mode" is a default that MODE_TOKENS may override.
GENERIC_FRAGMENTS = {
    "dx contest": {"mode": "CW",      "bands": "HF",   "sponsor": "Various",           "tier": 2},
    "worldwide":  {"mode": "SSB",     "bands": "HF",   "sponsor": "Various",           "tier": 2},
    "rtty":       {"mode": "RTTY",    "bands": "HF",   "sponsor": "Various",           "tier": 2},
    "rsgb":       {"mode": "CW/Data", "bands": "80m",  "sponsor": "RSGB",              "tier": 2},
    "sprint":     {"mode": "CW",      "bands": "HF",   "sponsor": "Various",           "tier": 3},
    "cwops":      {"mode": "CW",      "bands": "HF",   "sponsor": "CWops",             "tier": 3},
    "cwt":        {"mode": "CW",      "bands": "HF",   "sponsor": "CWops",             "tier": 3},
    "skcc":       {"mode": "CW",      "bands": "HF",   "sponsor": "SKCC",              "tier": 3},
    "ft4":        {"mode": "FT4",     "bands": "HF",   "sponsor": "Various",           "tier": 3},
    "ft8":        {"mode": "FT8",     "bands": "HF",   "sponsor": "Various",           "tier": 3},
    "psk":        {"mode": "PSK31",   "bands": "HF",   "sponsor": "Various",           "tier": 3},
    "qrp":        {"mode": "CW",      "bands": "HF",   "sponsor": "QRP ARCI",          "tier": 3},
    "sideband":   {"mode": "SSB",     "bands": "HF",   "sponsor": "Various",           "tier": 3},
    "phone":      {"mode": "SSB",     "bands": "HF",   "sponsor": "Various",           "tier": 3},
    "80m":        {"mode": "Various", "bands": "80m",  "sponsor": "Various",           "tier": 3},
    "40m":        {"mode": "Various", "bands": "40m",  "sponsor": "Various",           "tier": 3},
    "nccc":       {"mode": "CW/FT4",  "bands": "HF",   "sponsor": "NCCC",              "tier": 3},
    "k1usn":      {"mode": "CW",      "bands": "HF",   "sponsor": "K1USN",             "tier": 3},
    "romanian":   {"mode": "SSB",     "bands": "HF",   "sponsor": "Romanian Diaspora", "tier": 3},
    "ok1wc":      {"mode": "CW",      "bands": "HF",   "sponsor": "OK1WC",             "tier": 3},
    "icwc":       {"mode": "CW",      "bands": "HF",   "sponsor": "ICWC",              "tier": 3},
    "qcx":        {"mode": "CW",      "bands": "HF",   "sponsor": "QRP Labs",          "tier": 3},
    "a1club":     {"mode": "CW",      "bands": "HF",   "sponsor": "A1 Club",           "tier": 3},
}

# An explicit mode designator in the name is the most reliable mode signal
# there is: contestcalendar emits one running per row, as in "CQ Worldwide DX
# Contest, SSB" or "NCCC FT4 Sprint". It therefore overrides the table mode,
# including for a specific contest, whose curated mode describes the whole
# family ("CW/SSB") rather than the running in this row.
MODE_TOKENS = (
    ("ft4", "FT4"),
    ("ft8", "FT8"),
    ("rtty", "RTTY"),
    ("psk31", "PSK31"),
    ("psk", "PSK31"),
    ("sideband", "SSB"),
    ("ssb", "SSB"),
    ("phone", "SSB"),
    ("cw", "CW"),
)
_SSB_TOKENS = ("ssb", "sideband", "phone")


def mode_from_name(name_lower: str) -> str | None:
    """Return the mode a contest name states outright, or None if it states none."""
    # A row naming both, e.g. "... Contest, CW/SSB", is both and not whichever
    # token happens to be tested first.
    if "cw" in name_lower and any(t in name_lower for t in _SSB_TOKENS):
        return "CW/SSB"
    for token, mode in MODE_TOKENS:
        if token in name_lower:
            return mode
    return None


def _longest_match(name_lower: str, table: dict) -> dict | None:
    """Return the metadata of the longest key in table contained in name_lower."""
    best_key = None
    best_meta = None
    for key, meta in table.items():
        if key in name_lower and (best_key is None or len(key) > len(best_key)):
            best_key, best_meta = key, meta
    return best_meta


def enrich_contest(name: str) -> dict:
    """Look up metadata for a contest by name.

    Specific contests first, then generic fragments, then an explicit mode
    token in the name overriding whichever mode the table supplied. Always
    returns a fresh dict, so a caller cannot mutate the tables.
    """
    name_lower = name.lower()
    meta = (_longest_match(name_lower, SPECIFIC_CONTESTS)
            or _longest_match(name_lower, GENERIC_FRAGMENTS))
    mode = mode_from_name(name_lower)
    if meta is None:
        return {"mode": mode or "Various", "bands": "HF", "sponsor": "", "tier": 3}
    result = dict(meta)
    if mode:
        result["mode"] = mode
    return result


def parse_date(date_str: str, year: int) -> tuple[str, str]:
    """Parse contestcalendar.com date strings into (start, end) ISO dates.

    Handles formats like:
      '0000Z, Jun 6 to 2359Z, Jun 8'    (range with times)
      '1300Z, June 6 to 0100Z, Jun 7'    (mixed full/short month)
      '0000Z-0100Z, Jun 8'               (single day, time range)
      'May 30-31'                        (legacy short form)
      'May 31-Jun 1'                     (legacy cross-month)
      'Jun 6'                            (single day)
    """
    date_str = date_str.strip()
    months = {"jan":1,"feb":2,"mar":3,"apr":4,"may":5,"jun":6,
              "jul":7,"aug":8,"sep":9,"oct":10,"nov":11,"dec":12,
              "january":1,"february":2,"march":3,"april":4,"june":6,
              "july":7,"august":8,"september":9,"october":10,
              "november":11,"december":12}

    def parse_month_day(s):
        # Find "MonthName DayNumber" anywhere in s, return (month_num, day_num) or None
        m = re.search(r'([A-Za-z]+)\s+(\d+)', s)
        if m:
            mon = months.get(m.group(1).lower())
            if mon:
                return mon, int(m.group(2))
        return None

    try:
        if " to " in date_str.lower():
            # "0000Z, Jun 6 to 2359Z, Jun 8"
            parts = re.split(r'\s+to\s+', date_str, maxsplit=1, flags=re.IGNORECASE)
            sm = parse_month_day(parts[0])
            em = parse_month_day(parts[1]) if len(parts) > 1 else sm
            if not sm: return "", ""
            if not em: em = sm
            return f"{year}-{sm[0]:02d}-{sm[1]:02d}", f"{year}-{em[0]:02d}-{em[1]:02d}"

        # No "to": might be "May 30-31", "0000Z-0100Z, Jun 8", or "Jun 6"
        md = parse_month_day(date_str)
        if md:
            start = end = f"{year}-{md[0]:02d}-{md[1]:02d}"
            # Check for day range like "May 30-31"
            range_m = re.search(r'([A-Za-z]+)\s+(\d+)\s*-\s*(?:([A-Za-z]+)\s+)?(\d+)', date_str)
            if range_m:
                sm_name, sd, em_name, ed = range_m.groups()
                sm = months.get(sm_name.lower()) or md[0]
                em = months.get(em_name.lower()) if em_name else sm
                start = f"{year}-{sm:02d}-{int(sd):02d}"
                end   = f"{year}-{em:02d}-{int(ed):02d}"
            return start, end

        return "", ""
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

        # Parse contest header rows of the form:
        # <a name="ID">CONTEST NAME</a>: 0000Z, Jun 6 to 2359Z, Jun 8</strong>
        # Detail rows (Mode, Bands, etc.) are ignored.
        now = datetime.now(timezone.utc)
        year = now.year
        import html as html_mod

        header_re = re.compile(
            r'<a\s+name="(\d+)">([^<]+)</a>\s*:\s*([^<]+?)\s*</strong>',
            re.DOTALL | re.IGNORECASE
        )

        contests = []
        seen = set()
        for match in header_re.finditer(html):
            name = html_mod.unescape(match.group(2)).strip()
            date_str = html_mod.unescape(match.group(3)).strip()

            if not name or not date_str:
                continue

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
