"""
SQLite persistence layer for DXEdge.
Stores DX spots and solar readings so data survives container restarts.
"""
import sqlite3
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

DB_PATH = Path("/data/dxedge.db")


def get_conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn


def init_db():
    """Create tables if they don't exist."""
    with get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS spots (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                callsign    TEXT NOT NULL,
                freq        REAL NOT NULL,
                band        TEXT NOT NULL,
                mode        TEXT,
                spotter     TEXT,
                comment     TEXT,
                time_utc    TEXT,
                dxcc        TEXT,
                continent   TEXT,
                timestamp   TEXT NOT NULL,
                UNIQUE(callsign, band, timestamp)
            );

            CREATE INDEX IF NOT EXISTS idx_spots_band      ON spots(band);
            CREATE INDEX IF NOT EXISTS idx_spots_mode      ON spots(mode);
            CREATE INDEX IF NOT EXISTS idx_spots_timestamp ON spots(timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_spots_callsign  ON spots(callsign);

            CREATE TABLE IF NOT EXISTS solar_readings (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                sfi         INTEGER,
                k_index     REAL,
                a_index     INTEGER,
                ssn         INTEGER,
                x_class     TEXT,
                source      TEXT,
                timestamp   TEXT NOT NULL UNIQUE
            );

            CREATE INDEX IF NOT EXISTS idx_solar_timestamp ON solar_readings(timestamp DESC);

            CREATE TABLE IF NOT EXISTS psk_spots (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                callsign    TEXT NOT NULL,
                freq_hz     INTEGER,
                freq_mhz    REAL,
                band        TEXT NOT NULL,
                snr         INTEGER,
                mode        TEXT,
                country     TEXT,
                dxcc_code   TEXT,
                grid        TEXT,
                receiver    TEXT,
                timestamp   TEXT NOT NULL,
                UNIQUE(callsign, band, timestamp)
            );

            CREATE INDEX IF NOT EXISTS idx_psk_band      ON psk_spots(band);
            CREATE INDEX IF NOT EXISTS idx_psk_timestamp ON psk_spots(timestamp DESC);
        """)
    logger.info(f"Database initialized at {DB_PATH}")


# --- Spots ---

def save_spots(spots: list[dict]):
    """Upsert a list of DX cluster spots."""
    if not spots:
        return
    now = datetime.now(timezone.utc).isoformat()
    with get_conn() as conn:
        conn.executemany("""
            INSERT OR IGNORE INTO spots
                (callsign, freq, band, mode, spotter, comment, time_utc, dxcc, continent, timestamp)
            VALUES
                (:callsign, :freq, :band, :mode, :spotter, :comment, :time_utc, :dxcc, :continent, :timestamp)
        """, [
            {
                "callsign":  s.get("callsign", ""),
                "freq":      s.get("freq", 0),
                "band":      s.get("band", ""),
                "mode":      s.get("mode", ""),
                "spotter":   s.get("spotter", ""),
                "comment":   s.get("comment", ""),
                "time_utc":  s.get("time_utc", ""),
                "dxcc":      s.get("dxcc", ""),
                "continent": s.get("continent", ""),
                "timestamp": s.get("timestamp", now),
            }
            for s in spots
        ])


def load_recent_spots(limit: int = 500, band: str = None, mode: str = None) -> list[dict]:
    """Load most recent spots from DB."""
    query = "SELECT * FROM spots"
    params = []
    conditions = []
    if band:
        conditions.append("band = ?")
        params.append(band)
    if mode:
        conditions.append("UPPER(mode) = UPPER(?)")
        params.append(mode)
    # Only spots from last 2 hours
    conditions.append("timestamp >= datetime('now', '-2 hours')")
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += f" ORDER BY timestamp DESC LIMIT {limit}"
    with get_conn() as conn:
        rows = conn.execute(query, params).fetchall()
    return [dict(r) for r in rows]


def prune_old_spots(hours: int = 24):
    """Delete spots older than N hours."""
    with get_conn() as conn:
        result = conn.execute(
            "DELETE FROM spots WHERE timestamp < datetime('now', ? || ' hours')",
            (f"-{hours}",)
        )
        if result.rowcount:
            logger.info(f"Pruned {result.rowcount} old spots")


# --- Solar ---

def save_solar(data: dict):
    """Save a solar reading."""
    with get_conn() as conn:
        conn.execute("""
            INSERT OR IGNORE INTO solar_readings
                (sfi, k_index, a_index, ssn, x_class, source, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get("sfi"),
            data.get("k_index"),
            data.get("a_index"),
            data.get("ssn"),
            data.get("x_class"),
            data.get("source"),
            data.get("updated", datetime.now(timezone.utc).isoformat()),
        ))


def load_solar_history(hours: int = 48) -> list[dict]:
    """Load solar readings for the last N hours."""
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT * FROM solar_readings
            WHERE timestamp >= datetime('now', ? || ' hours')
            ORDER BY timestamp ASC
        """, (f"-{hours}",)).fetchall()
    return [dict(r) for r in rows]


def load_latest_solar() -> dict | None:
    """Load the most recent solar reading."""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM solar_readings ORDER BY timestamp DESC LIMIT 1"
        ).fetchone()
    return dict(row) if row else None


# --- PSK spots ---

def save_psk_spots(spots: list[dict], grid: str):
    """Save PSKReporter spots."""
    if not spots:
        return
    now = datetime.now(timezone.utc).isoformat()
    with get_conn() as conn:
        conn.executemany("""
            INSERT OR IGNORE INTO psk_spots
                (callsign, freq_hz, freq_mhz, band, snr, mode,
                 country, dxcc_code, grid, receiver, timestamp)
            VALUES
                (:callsign, :freq_hz, :freq_mhz, :band, :snr, :mode,
                 :country, :dxcc_code, :grid, :receiver, :timestamp)
        """, [
            {**s, "timestamp": now} for s in spots
        ])


def load_psk_spots(grid4: str, hours: int = 2) -> list[dict]:
    """Load PSK spots for a grid, last N hours."""
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT * FROM psk_spots
            WHERE timestamp >= datetime('now', ? || ' hours')
            ORDER BY snr DESC
        """, (f"-{hours}",)).fetchall()
    return [dict(r) for r in rows]


def prune_old_psk(hours: int = 6):
    with get_conn() as conn:
        conn.execute(
            "DELETE FROM psk_spots WHERE timestamp < datetime('now', ? || ' hours')",
            (f"-{hours}",)
        )
