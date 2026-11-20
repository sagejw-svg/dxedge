#!/usr/bin/env python3
"""One-time shrink of dxedge.db after the psk_spots runaway (Nov 2026).

psk_spots grew to 70.9 million rows (about 16 GB) because nothing pruned it.
The backend now keeps a rolling 24 hour window (database.py). This script
clears the backlog once: it keeps the last 24 hours, drops the rest, and
compacts the file.

Run on the droplet, as root, from /opt/dxedge, AFTER the backend fix has
deployed. It stops the backend for the duration and starts it again:

    python3 -I scripts/maintenance/psk_cleanup.py

Copying the recent rows into a fresh table and dropping the old one is much
faster on a 16 GB file than DELETE on 70 million rows. Nothing in the code
reads psk_spots back, so nothing on the site depends on the dropped rows.
"""

import datetime as dt
import os
import sqlite3
import subprocess
import sys
import time

DB = "/var/lib/docker/volumes/dxedge_dxedge-data/_data/dxedge.db"
KEEP_HOURS = 24


def log(msg):
    print(f"[{dt.datetime.now():%H:%M:%S}] {msg}", flush=True)


def size_gb(path):
    total = 0
    for suffix in ("", "-wal", "-shm"):
        if os.path.exists(path + suffix):
            total += os.path.getsize(path + suffix)
    return total / 1e9


def compose(*args):
    subprocess.run(["docker", "compose", *args], cwd="/opt/dxedge", check=True)


def main():
    if os.geteuid() != 0:
        sys.exit("run as root")
    if not os.path.exists(DB):
        sys.exit(f"not found: {DB}")
    st = os.statvfs(os.path.dirname(DB))
    log(f"dxedge.db is {size_gb(DB):.1f} GB; {st.f_bavail * st.f_frsize / 1e9:.1f} GB free on disk")

    log("stopping the backend")
    compose("stop", "backend")
    try:
        t0 = time.time()
        c = sqlite3.connect(DB, timeout=60, isolation_level=None)
        c.execute("PRAGMA busy_timeout=60000")
        (schema,) = c.execute(
            "select sql from sqlite_master where type='table' and name='psk_spots'").fetchone()
        cutoff = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=KEEP_HOURS)).isoformat()
        (before,) = c.execute("select max(rowid) from psk_spots").fetchone()
        log(f"keeping rows newer than {cutoff} (max rowid before: {before:,})")

        c.execute("BEGIN IMMEDIATE")
        c.execute("ALTER TABLE psk_spots RENAME TO psk_spots_old")
        c.execute(schema)  # the original CREATE TABLE psk_spots (...)
        c.execute("""INSERT INTO psk_spots
                     SELECT * FROM psk_spots_old WHERE timestamp >= ?""", (cutoff,))
        (kept,) = c.execute("select count(*) from psk_spots").fetchone()
        log(f"copied {kept:,} recent rows; dropping the old table (reads the whole file, takes a few minutes)")
        c.execute("DROP TABLE psk_spots_old")
        c.execute("CREATE INDEX IF NOT EXISTS idx_psk_band ON psk_spots(band)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_psk_timestamp ON psk_spots(timestamp DESC)")
        c.execute("COMMIT")
        log("compacting (VACUUM)")
        c.execute("VACUUM")
        c.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        (ok,) = c.execute("PRAGMA quick_check").fetchone()
        c.close()
        log(f"integrity: {ok}")
        log(f"dxedge.db is now {size_gb(DB):.2f} GB ({time.time() - t0:.0f} s)")
    finally:
        log("starting the backend")
        compose("start", "backend")
    st = os.statvfs(os.path.dirname(DB))
    log(f"done; {st.f_bavail * st.f_frsize / 1e9:.1f} GB free on disk")


if __name__ == "__main__":
    main()
