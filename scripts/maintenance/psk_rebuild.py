#!/usr/bin/env python3
"""One-time rebuild of dxedge.db without the psk_spots backlog (Nov 2026).

psk_spots grew to about 70.9 million rows (20 GB on disk) because nothing
pruned it. A DROP TABLE or DELETE needs scratch space the droplet does not
have (the first attempt, psk_cleanup.py, failed with "database or disk is
full" and rolled back). This script needs only enough space for the small
result:

  1. stop the backend
  2. build dxedge.db.new: every table, index and trigger from the old file,
     every row of every table except psk_spots, and only the last 24 hours
     of psk_spots
  3. verify: quick_check ok, and row counts match for every copied table
  4. move the old files aside, move the new file into place, start the
     backend, wait for /api/health
  5. delete the old files only after all of that succeeded

If anything fails before step 4 the old database is untouched and the
backend is restarted on it. Run on the droplet as root from /opt/dxedge:

    python3 -I scripts/maintenance/psk_rebuild.py
"""

import datetime as dt
import json
import os
import sqlite3
import subprocess
import sys
import time
import urllib.request

DIR = "/var/lib/docker/volumes/dxedge_dxedge-data/_data"
DB = os.path.join(DIR, "dxedge.db")
NEW = DB + ".new"
OLD = DB + ".old"
KEEP_HOURS = 24
SIDECARS = ("", "-wal", "-shm")


def log(msg):
    print(f"[{dt.datetime.now():%H:%M:%S}] {msg}", flush=True)


def gb(path):
    return sum(os.path.getsize(path + s) for s in SIDECARS if os.path.exists(path + s)) / 1e9


def free_gb():
    st = os.statvfs(DIR)
    return st.f_bavail * st.f_frsize / 1e9


def compose(*args):
    subprocess.run(["docker", "compose", *args], cwd="/opt/dxedge", check=True)


def wait_healthy(timeout=120):
    end = time.time() + timeout
    while time.time() < end:
        try:
            with urllib.request.urlopen("https://dxedge.net/api/health", timeout=10) as r:
                if json.load(r).get("status") == "ok":
                    return True
        except Exception:
            pass
        time.sleep(5)
    return False


def build():
    for s in SIDECARS:
        if os.path.exists(NEW + s):
            os.remove(NEW + s)
    src = sqlite3.connect(f"file:{DB}?mode=ro", uri=True, isolation_level=None)
    objs = src.execute(
        "select type, name, tbl_name, sql from sqlite_master "
        "where sql is not null and name not like 'sqlite_%'").fetchall()
    tables = [o for o in objs if o[0] == "table"]
    others = [o for o in objs if o[0] != "table"]  # indexes, triggers, views
    src.close()

    dst = sqlite3.connect(f"file:{NEW}", uri=True, isolation_level=None)
    dst.execute("PRAGMA journal_mode=DELETE")
    dst.execute(f"ATTACH DATABASE 'file:{DB}?mode=ro' AS old")
    dst.execute("BEGIN")
    for _, name, _, sql in tables:
        dst.execute(sql)
    cutoff = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=KEEP_HOURS)).isoformat()
    expected = {}
    for _, name, _, _ in tables:
        if name == "psk_spots":
            dst.execute(f'INSERT INTO main."{name}" SELECT * FROM old."{name}" WHERE timestamp >= ?',
                        (cutoff,))
        else:
            dst.execute(f'INSERT INTO main."{name}" SELECT * FROM old."{name}"')
            (expected[name],) = dst.execute(f'select count(*) from old."{name}"').fetchone()
    # AUTOINCREMENT high-water marks, so new ids never reuse old ones.
    has_seq = dst.execute(
        "select 1 from old.sqlite_master where name='sqlite_sequence'").fetchone()
    if has_seq:
        dst.execute("DELETE FROM main.sqlite_sequence")
        dst.execute("INSERT INTO main.sqlite_sequence SELECT * FROM old.sqlite_sequence")
    for _, name, _, sql in others:
        dst.execute(sql)
    (uv,) = dst.execute("PRAGMA old.user_version").fetchone()
    dst.execute("COMMIT")
    dst.execute(f"PRAGMA user_version={int(uv)}")
    dst.execute("DETACH DATABASE old")

    # Verify before anything touches the old file.
    (ok,) = dst.execute("PRAGMA quick_check").fetchone()
    if ok != "ok":
        raise RuntimeError(f"quick_check on the new file: {ok}")
    for name, n in expected.items():
        (m,) = dst.execute(f'select count(*) from "{name}"').fetchone()
        if m != n:
            raise RuntimeError(f"{name}: {m} rows copied, {n} expected")
        log(f"  {name}: {m:,} rows")
    (kept,) = dst.execute("select count(*) from psk_spots").fetchone()
    log(f"  psk_spots: {kept:,} rows kept (last {KEEP_HOURS} h)")
    dst.execute("PRAGMA journal_mode=WAL")  # what the backend uses
    dst.close()


def main():
    if os.geteuid() != 0:
        sys.exit("run as root")
    log(f"dxedge.db is {gb(DB):.1f} GB; {free_gb():.1f} GB free")
    log("stopping the backend")
    compose("stop", "backend")
    swapped = False
    try:
        log("building a fresh database without the backlog")
        build()
        log(f"new file is {gb(NEW) * 1000:.0f} MB; swapping it in")
        for s in SIDECARS:
            if os.path.exists(DB + s):
                os.replace(DB + s, OLD + s)
        os.replace(NEW, DB)
        swapped = True
    except Exception as e:
        log(f"FAILED before the swap, old database untouched: {e}")
        for s in SIDECARS:
            if os.path.exists(NEW + s):
                os.remove(NEW + s)
    finally:
        log("starting the backend")
        compose("start", "backend")

    if not swapped:
        sys.exit(1)
    if not wait_healthy():
        log("backend did not report healthy within 2 minutes. Old files kept as dxedge.db.old*.")
        log("To roll back: docker compose stop backend; then move dxedge.db.old* back over dxedge.db*; docker compose start backend")
        sys.exit(1)
    log("backend healthy on the new database; deleting the old files")
    for s in SIDECARS:
        if os.path.exists(OLD + s):
            os.remove(OLD + s)
    log(f"done; dxedge.db is {gb(DB) * 1000:.0f} MB, {free_gb():.1f} GB free")


if __name__ == "__main__":
    main()
