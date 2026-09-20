"""
DXEdge usage stats.

Design constraints, in the order they mattered:

1. No cookies. The client keeps a session id in sessionStorage, which the
   browser drops when the tab closes. Nothing is written to disk on the
   visitor's machine except an opt-out flag, and only if they opt out.

2. No IP addresses on disk, ever. To count "how many different people"
   rather than "how many page loads" you need something stable per person,
   and the honest minimum is a hash. The salt is random, lives only in this
   process's memory, and is thrown away and regenerated at UTC midnight.
   So two visits by the same person on the same day collapse to one
   visitor; the same person tomorrow is a different, unlinkable row; and
   nobody holding the database can work backwards to an address, because
   the salt that made the hash no longer exists anywhere.

3. No raw User-Agent on disk. It is stored as a coarse family
   (chrome / safari / firefox / other) plus a mobile flag. That is enough
   to answer "should I keep testing the phone layout" and not enough to
   fingerprint anyone.

4. Do Not Track and Global Privacy Control are honoured server side as well
   as client side. If either header is set the event is dropped before it
   is written, not filtered out at read time.

Raw events are kept for 90 days, then dropped. A daily rollup written
before the prune keeps the long-term shape of the numbers, so year-over-year
charts survive without the site holding a years-long event log.
"""
import hashlib
import logging
import os
import re
import sqlite3
import threading
import time
from datetime import datetime, timedelta, timezone

from database import get_conn

logger = logging.getLogger(__name__)

RAW_RETENTION_DAYS = 90

# Anything that looks automated. Our own nightly health check and the weekly
# link sweep both land here, which is the point: they would otherwise be a
# large and entirely fictional share of the traffic.
BOT_RE = re.compile(
    r"bot|spider|crawl|slurp|curl|wget|python-requests|httpx|aiohttp|okhttp|"
    r"headless|phantom|puppeteer|playwright|selenium|monitor|uptime|pingdom|"
    r"lighthouse|preview|fetcher|scrapy|postman|insomnia|go-http-client",
    re.I,
)

# Events the client is allowed to send. An unknown kind is dropped rather
# than stored, so a stray call or a bored visitor with a console cannot turn
# this table into a junk drawer.
KINDS = {
    "session",    # one per page session, carries entry path + referrer host
    "tab",        # a tab was opened in the SPA
    "game",       # a game was started
    "game_end",   # a game finished, value = score
    "milestone",  # something worth reaching, detail names it
    "emulator",   # an emulator link was opened, detail = slug
    "heartbeat",  # session still alive, value = seconds so far
}

MAX_STR = 48

_salt_lock = threading.Lock()
_salt = None
_salt_day = None


def _daily_salt() -> bytes:
    """Random per-day salt, memory only. Rotating it is what makes yesterday's
    visitor hashes permanently unlinkable to today's."""
    global _salt, _salt_day
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    with _salt_lock:
        if _salt is None or _salt_day != today:
            _salt = os.urandom(32)
            _salt_day = today
        return _salt


def visitor_hash(ip: str, ua: str) -> str:
    h = hashlib.sha256()
    h.update(_daily_salt())
    h.update((ip or "?").encode())
    h.update((ua or "?").encode())
    return h.hexdigest()[:16]


def ua_family(ua: str) -> str:
    u = (ua or "").lower()
    if "edg/" in u:
        return "edge"
    if "firefox" in u:
        return "firefox"
    if "chrome" in u or "crios" in u:
        return "chrome"
    if "safari" in u:
        return "safari"
    return "other"


def is_mobile(ua: str) -> int:
    u = (ua or "").lower()
    return int(("mobi" in u) or ("android" in u) or ("iphone" in u) or ("ipad" in u))


def is_bot(ua: str) -> bool:
    if not ua or len(ua) < 12:
        return True
    return bool(BOT_RE.search(ua))


def _clean(v, limit: int = MAX_STR) -> str:
    if v is None:
        return ""
    s = str(v).strip()[:limit]
    # Keep it to things that can appear in a chart axis without escaping.
    return re.sub(r"[^\w .:/?&=@+-]", "", s)


def init_usage_db():
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS usage_events (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                ts       INTEGER NOT NULL,
                day      TEXT    NOT NULL,
                visitor  TEXT    NOT NULL,
                session  TEXT    NOT NULL,
                kind     TEXT    NOT NULL,
                tab      TEXT    DEFAULT '',
                detail   TEXT    DEFAULT '',
                value    REAL,
                ua       TEXT    DEFAULT '',
                mobile   INTEGER DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_usage_day  ON usage_events(day);
            CREATE INDEX IF NOT EXISTS idx_usage_kind ON usage_events(day, kind);
            CREATE INDEX IF NOT EXISTS idx_usage_sess ON usage_events(session);

            CREATE TABLE IF NOT EXISTS usage_daily (
                day      TEXT NOT NULL,
                kind     TEXT NOT NULL,
                tab      TEXT DEFAULT '',
                detail   TEXT DEFAULT '',
                events   INTEGER DEFAULT 0,
                sessions INTEGER DEFAULT 0,
                visitors INTEGER DEFAULT 0,
                value_sum REAL DEFAULT 0,
                value_max REAL,
                PRIMARY KEY (day, kind, tab, detail)
            );
            """
        )
    logger.info("usage tables ready")


def record(events: list[dict], session: str, ip: str, ua: str) -> int:
    """Write a batch. Returns the number stored. Callers have already checked
    DNT/GPC; this still drops bots and anything not on the whitelist."""
    if is_bot(ua):
        return 0
    sess = _clean(session, 24)
    if len(sess) < 8:
        return 0

    vis = visitor_hash(ip, ua)
    fam = ua_family(ua)
    mob = is_mobile(ua)
    now = int(time.time())
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    rows = []
    for e in events[:40]:          # a batch is a page session, not a firehose
        if not isinstance(e, dict):
            continue
        kind = _clean(e.get("k"), 16)
        if kind not in KINDS:
            continue
        val = e.get("v")
        try:
            val = float(val) if val is not None else None
            if val is not None and (val != val or abs(val) > 1e9):
                val = None
        except (TypeError, ValueError):
            val = None
        rows.append(
            (now, day, vis, sess, kind, _clean(e.get("t"), 24),
             _clean(e.get("d")), val, fam, mob)
        )

    if not rows:
        return 0
    with get_conn() as conn:
        conn.executemany(
            "INSERT INTO usage_events (ts, day, visitor, session, kind, tab,"
            " detail, value, ua, mobile) VALUES (?,?,?,?,?,?,?,?,?,?)",
            rows,
        )
    return len(rows)


def rollup_day(day: str):
    """Collapse one day's raw events into usage_daily. Idempotent."""
    with get_conn() as conn:
        conn.execute("DELETE FROM usage_daily WHERE day = ?", (day,))
        conn.execute(
            """
            INSERT INTO usage_daily
                (day, kind, tab, detail, events, sessions, visitors,
                 value_sum, value_max)
            SELECT day, kind, tab, detail,
                   COUNT(*), COUNT(DISTINCT session), COUNT(DISTINCT visitor),
                   COALESCE(SUM(value), 0), MAX(value)
            FROM usage_events
            WHERE day = ?
            GROUP BY day, kind, tab, detail
            """,
            (day,),
        )


def prune_and_rollup():
    """Roll up every day that has raw events, then drop raw rows past the
    retention window. Safe to run repeatedly."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=RAW_RETENTION_DAYS)).strftime("%Y-%m-%d")
    with get_conn() as conn:
        days = [r[0] for r in conn.execute(
            "SELECT DISTINCT day FROM usage_events ORDER BY day"
        ).fetchall()]
    for d in days:
        rollup_day(d)
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM usage_events WHERE day < ?", (cutoff,))
        if cur.rowcount:
            logger.info(f"usage: pruned {cur.rowcount} raw events older than {cutoff}")


# --- queries for the Stats tab -------------------------------------------

def _rows(conn, sql, args=()):
    return [dict(r) for r in conn.execute(sql, args).fetchall()]


def summary(days: int = 30) -> dict:
    days = max(1, min(int(days), 365))
    since = (datetime.now(timezone.utc) - timedelta(days=days - 1)).strftime("%Y-%m-%d")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    with get_conn() as conn:
        totals = dict(conn.execute(
            """
            SELECT COUNT(DISTINCT visitor) AS visitors,
                   COUNT(DISTINCT session) AS sessions,
                   COUNT(*)                AS events
            FROM usage_events WHERE day >= ?
            """, (since,)).fetchone())

        today_row = dict(conn.execute(
            """
            SELECT COUNT(DISTINCT visitor) AS visitors,
                   COUNT(DISTINCT session) AS sessions
            FROM usage_events WHERE day = ?
            """, (today,)).fetchone())

        daily = _rows(conn, """
            SELECT day,
                   COUNT(DISTINCT visitor) AS visitors,
                   COUNT(DISTINCT session) AS sessions
            FROM usage_events WHERE day >= ?
            GROUP BY day ORDER BY day
        """, (since,))

        tabs = _rows(conn, """
            SELECT tab,
                   COUNT(*)                AS opens,
                   COUNT(DISTINCT session) AS sessions
            FROM usage_events
            WHERE day >= ? AND kind = 'tab' AND tab != ''
            GROUP BY tab ORDER BY sessions DESC, opens DESC
        """, (since,))

        games = _rows(conn, """
            SELECT tab AS game,
                   SUM(CASE WHEN kind = 'game'     THEN 1 ELSE 0 END) AS plays,
                   SUM(CASE WHEN kind = 'game_end' THEN 1 ELSE 0 END) AS finished,
                   COUNT(DISTINCT session)                            AS sessions,
                   MAX(CASE WHEN kind = 'game_end' THEN value END)    AS best,
                   AVG(CASE WHEN kind = 'game_end' THEN value END)    AS avg_score
            FROM usage_events
            WHERE day >= ? AND kind IN ('game','game_end') AND tab != ''
            GROUP BY tab ORDER BY plays DESC
        """, (since,))

        milestones = _rows(conn, """
            SELECT tab AS game, detail, COUNT(*) AS hits
            FROM usage_events
            WHERE day >= ? AND kind = 'milestone'
            GROUP BY tab, detail ORDER BY hits DESC LIMIT 25
        """, (since,))

        emulators = _rows(conn, """
            SELECT detail AS slug, COUNT(*) AS opens
            FROM usage_events
            WHERE day >= ? AND kind = 'emulator' AND detail != ''
            GROUP BY detail ORDER BY opens DESC LIMIT 25
        """, (since,))

        referrers = _rows(conn, """
            SELECT detail AS host, COUNT(DISTINCT session) AS sessions
            FROM usage_events
            WHERE day >= ? AND kind = 'session' AND detail != ''
            GROUP BY detail ORDER BY sessions DESC LIMIT 20
        """, (since,))

        entries = _rows(conn, """
            SELECT tab AS path, COUNT(DISTINCT session) AS sessions
            FROM usage_events
            WHERE day >= ? AND kind = 'session' AND tab != ''
            GROUP BY tab ORDER BY sessions DESC LIMIT 20
        """, (since,))

        devices = _rows(conn, """
            SELECT ua, mobile, COUNT(DISTINCT session) AS sessions
            FROM usage_events WHERE day >= ?
            GROUP BY ua, mobile ORDER BY sessions DESC
        """, (since,))

        # Session length from the last heartbeat each session reported.
        dwell = _rows(conn, """
            SELECT AVG(secs) AS avg_secs, MAX(secs) AS max_secs, COUNT(*) AS n
            FROM (SELECT session, MAX(value) AS secs
                  FROM usage_events
                  WHERE day >= ? AND kind = 'heartbeat' AND value IS NOT NULL
                  GROUP BY session)
        """, (since,))

    return {
        "window_days": days,
        "since": since,
        "totals": totals,
        "today": today_row,
        "daily": daily,
        "tabs": tabs,
        "games": games,
        "milestones": milestones,
        "emulators": emulators,
        "referrers": referrers,
        "entries": entries,
        "devices": devices,
        "dwell": dwell[0] if dwell else {},
    }
