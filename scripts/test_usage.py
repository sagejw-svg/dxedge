#!/usr/bin/env python3
"""
Usage stats tests.

The privacy properties are the point of this file. If someone later
"optimizes" the visitor hash by dropping the daily salt, or starts storing
the User-Agent verbatim, these tests are what should stop it.

Run: python3 scripts/test_usage.py
"""
import os
import sys
import tempfile
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

_tmp = tempfile.mkdtemp()
os.environ["DXEDGE_DB"] = os.path.join(_tmp, "test.db")

import database
database.DB_PATH = Path(_tmp) / "test.db"

import usage

CHROME = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
          "(KHTML, like Gecko) Chrome/129.0 Safari/537.36")
IPHONE = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
          "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")


class Privacy(unittest.TestCase):
    def test_visitor_hash_is_not_reversible_to_ip(self):
        h = usage.visitor_hash("203.0.113.9", CHROME)
        self.assertNotIn("203.0.113.9", h)
        self.assertEqual(len(h), 16)

    def test_same_visitor_same_day_collapses(self):
        a = usage.visitor_hash("203.0.113.9", CHROME)
        b = usage.visitor_hash("203.0.113.9", CHROME)
        self.assertEqual(a, b, "same person same day must count once")

    def test_different_ips_differ(self):
        a = usage.visitor_hash("203.0.113.9", CHROME)
        b = usage.visitor_hash("203.0.113.10", CHROME)
        self.assertNotEqual(a, b)

    def test_salt_rotation_breaks_cross_day_linkage(self):
        before = usage.visitor_hash("203.0.113.9", CHROME)
        usage._salt = None          # simulate the UTC-midnight rotation
        usage._salt_day = None
        after = usage.visitor_hash("203.0.113.9", CHROME)
        self.assertNotEqual(before, after,
                            "yesterday's hash must not match today's")

    def test_no_raw_user_agent_stored(self):
        usage.record([{"k": "session", "t": "/"}], "sess-ua-check", "198.51.100.1", CHROME)
        with database.get_conn() as c:
            rows = c.execute("SELECT ua FROM usage_events WHERE session='sess-ua-check'").fetchall()
        self.assertTrue(rows)
        for r in rows:
            self.assertEqual(r[0], "chrome")
            self.assertNotIn("Mozilla", r[0])

    def test_no_ip_column_exists(self):
        with database.get_conn() as c:
            cols = [r[1] for r in c.execute("PRAGMA table_info(usage_events)").fetchall()]
        for bad in ("ip", "addr", "remote_addr", "ua_raw"):
            self.assertNotIn(bad, cols)


class Ingest(unittest.TestCase):
    def test_bots_are_dropped(self):
        for ua in ["python-requests/2.31", "Mozilla/5.0 (compatible; Googlebot/2.1)",
                   "curl/8.4.0", "HeadlessChrome/120", "", "x"]:
            self.assertEqual(usage.record([{"k": "session"}], "sess-bot-0001", "1.2.3.4", ua), 0, ua)

    def test_unknown_kinds_are_dropped(self):
        n = usage.record([{"k": "evil"}, {"k": "session"}], "sess-kind-001", "1.2.3.4", CHROME)
        self.assertEqual(n, 1)

    def test_short_session_rejected(self):
        self.assertEqual(usage.record([{"k": "session"}], "abc", "1.2.3.4", CHROME), 0)

    def test_batch_is_capped(self):
        many = [{"k": "tab", "t": f"t{i}"} for i in range(200)]
        n = usage.record(many, "sess-cap-0001", "1.2.3.4", CHROME)
        self.assertLessEqual(n, 40)

    def test_strings_are_truncated_and_scrubbed(self):
        usage.record([{"k": "tab", "t": "x" * 200, "d": "<script>alert(1)</script>"}],
                     "sess-trunc-01", "1.2.3.4", CHROME)
        with database.get_conn() as c:
            r = c.execute("SELECT tab, detail FROM usage_events WHERE session='sess-trunc-01'").fetchone()
        self.assertLessEqual(len(r[0]), 24)
        self.assertNotIn("<", r[1])

    def test_bad_values_do_not_poison_the_row(self):
        usage.record([{"k": "game_end", "t": "skip", "v": "not a number"}],
                     "sess-badval-1", "1.2.3.4", CHROME)
        with database.get_conn() as c:
            r = c.execute("SELECT value FROM usage_events WHERE session='sess-badval-1'").fetchone()
        self.assertIsNone(r[0])

    def test_mobile_flag(self):
        usage.record([{"k": "session"}], "sess-mobile-1", "1.2.3.4", IPHONE)
        with database.get_conn() as c:
            r = c.execute("SELECT mobile, ua FROM usage_events WHERE session='sess-mobile-1'").fetchone()
        self.assertEqual(r[0], 1)
        self.assertEqual(r[1], "safari")


class Summary(unittest.TestCase):
    def test_summary_shape_and_counts(self):
        usage.record([
            {"k": "session", "t": "/", "d": "qrz.com"},
            {"k": "tab", "t": "bands"},
            {"k": "tab", "t": "invaders"},
            {"k": "game", "t": "invaders"},
            {"k": "game_end", "t": "invaders", "v": 42},
            {"k": "milestone", "t": "invaders", "d": "DXCC 100"},
            {"k": "heartbeat", "v": 300},
        ], "sess-summary-a", "198.51.100.77", CHROME)

        s = usage.summary(30)
        for key in ("totals", "today", "daily", "tabs", "games", "milestones",
                    "emulators", "referrers", "entries", "devices", "dwell"):
            self.assertIn(key, s)
        self.assertGreaterEqual(s["totals"]["sessions"], 1)

        inv = [g for g in s["games"] if g["game"] == "invaders"]
        self.assertTrue(inv)
        self.assertGreaterEqual(inv[0]["plays"], 1)
        self.assertGreaterEqual(inv[0]["best"], 42)
        self.assertTrue(any(r["host"] == "qrz.com" for r in s["referrers"]))
        self.assertTrue(any(r["detail"] == "DXCC 100" for r in s["milestones"]))

    def test_summary_days_is_clamped(self):
        self.assertEqual(usage.summary(99999)["window_days"], 365)
        self.assertEqual(usage.summary(0)["window_days"], 1)


class Retention(unittest.TestCase):
    def test_rollup_then_prune_keeps_the_daily_shape(self):
        old_day = (datetime.now(timezone.utc) - timedelta(days=200)).strftime("%Y-%m-%d")
        with database.get_conn() as c:
            c.execute(
                "INSERT INTO usage_events (ts, day, visitor, session, kind, tab, detail, value, ua, mobile)"
                " VALUES (?,?,?,?,?,?,?,?,?,?)",
                (0, old_day, "deadbeefdeadbeef", "sess-ancient-1", "tab", "bands", "", None, "chrome", 0))

        usage.prune_and_rollup()

        with database.get_conn() as c:
            raw = c.execute("SELECT COUNT(*) FROM usage_events WHERE day=?", (old_day,)).fetchone()[0]
            rolled = c.execute("SELECT events FROM usage_daily WHERE day=? AND tab='bands'", (old_day,)).fetchone()
        self.assertEqual(raw, 0, "raw events past retention must be gone")
        self.assertIsNotNone(rolled, "but the daily rollup must survive")
        self.assertEqual(rolled[0], 1)

    def test_rollup_is_idempotent(self):
        usage.prune_and_rollup()
        with database.get_conn() as c:
            a = c.execute("SELECT COUNT(*) FROM usage_daily").fetchone()[0]
        usage.prune_and_rollup()
        with database.get_conn() as c:
            b = c.execute("SELECT COUNT(*) FROM usage_daily").fetchone()[0]
        self.assertEqual(a, b)


if __name__ == "__main__":
    usage.init_usage_db()
    unittest.main(verbosity=2)
