"""
DXEdge test suite.
Run with: cd /opt/dxedge/backend && python -m pytest tests/ -v
"""
import pytest, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


# ─── DXCC Lookup ─────────────────────────────────────────────────────────────

from dxcc import lookup, enrich_spot

class TestDXCC:
    def test_us_callsign(self):
        r = lookup("K6WRJ")
        assert r["entity"] == "United States"
        assert r["continent"] == "NA"
        assert r["flag"] == "🇺🇸"

    def test_japanese_callsign(self):
        r = lookup("JA1ABC")
        assert r["entity"] == "Japan"
        assert r["continent"] == "AS"

    def test_german_callsign(self):
        r = lookup("DL7GER")
        assert r["entity"] == "Germany"
        assert r["continent"] == "EU"
        assert r["cq_zone"] == 14

    def test_portable_prefix_stripped(self):
        r = lookup("VE3/K6WRJ")
        assert r["entity"] == "United States"

    def test_slash_suffix_stripped(self):
        r = lookup("K6WRJ/P")
        assert r["entity"] == "United States"

    def test_canary_islands(self):
        r = lookup("EA8BYZ")
        assert r["entity"] == "Canary Islands"
        assert r["continent"] == "AF"

    def test_unknown_returns_empty(self):
        assert lookup("ZZZ999") == {}

    def test_enrich_spot_adds_fields(self):
        spot = {"callsign": "JA1ZLO", "band": "20m", "freq": 14074.0}
        enrich_spot(spot)
        assert spot["continent"] == "AS"
        assert spot["flag"] == "🇯🇵"
        assert "cq_zone" in spot

    def test_enrich_unknown_sets_defaults(self):
        spot = {"callsign": "ZZZ999", "band": "20m"}
        enrich_spot(spot)
        assert spot["flag"] == "📡"
        assert spot["dxcc"] == ""


# ─── VOACAP Engine ───────────────────────────────────────────────────────────

from voacap_engine import (maidenhead_to_latlon, great_circle,
                            solar_zenith, estimate_fof2,
                            circuit_reliability, predict_path)

class TestVOACAP:
    def test_maidenhead_cm95(self):
        lat, lon = maidenhead_to_latlon("CM95")
        assert 30 < lat < 38   # CM95 is ~35.5N
        assert -125 < lon < -115  # CM95 is ~-121W

    def test_great_circle_sd_to_london(self):
        dist, az = great_circle(32.7, -117.1, 51.5, -0.1)
        assert 8500 < dist < 9500
        assert 20 < az < 50

    def test_great_circle_sd_to_tokyo(self):
        dist, az = great_circle(32.7, -117.1, 35.7, 139.7)
        assert 8500 < dist < 9800
        assert 280 < az < 330

    def test_solar_zenith_daytime(self):
        # San Diego noon is ~19-20Z
        assert solar_zenith(32.7, -117.1, 19) < 90

    def test_solar_zenith_nighttime(self):
        # San Diego midnight is ~7-8Z
        assert solar_zenith(32.7, -117.1, 7) > 90

    def test_fof2_day_higher_than_night(self):
        assert estimate_fof2(120, 30) > estimate_fof2(120, 105)

    def test_fof2_high_sfi_higher(self):
        # At noon (zenith=20), high SFI should give higher fof2
        assert estimate_fof2(200, 20) > estimate_fof2(70, 20)
        # Values should be physically plausible (3.5-15 MHz range)
        assert 3.5 <= estimate_fof2(120, 30) <= 15

    def test_reliability_above_muf_is_zero(self):
        assert circuit_reliability(28.0, 14.0, 4.0, 9000, 2) == 0.0

    def test_high_kp_lowers_reliability(self):
        lo = circuit_reliability(14.2, 20.0, 5.0, 9000, kp=1)
        hi = circuit_reliability(14.2, 20.0, 5.0, 9000, kp=7)
        assert lo > hi

    def test_predict_path_structure(self):
        r = predict_path("CM95", "EU", sfi=120, kp=2, ssn=80)
        assert r["region"] == "EU"
        assert len(r["hours"]) == 24
        assert r["distance_sp_km"] > 0
        assert 0 <= r["azimuth_sp"] < 360
        # All band values should be 0-1
        for h in r["hours"]:
            for v in h["bands"].values():
                assert 0.0 <= v <= 1.0


# ─── Cluster Parser ──────────────────────────────────────────────────────────

from cluster import parse_spot

class TestCluster:
    def test_ft8_spot(self):
        line = "DX de W6ABC:     14074.0  JA1ZLO       FT8 -12 dB        1823Z"
        s = parse_spot(line)
        assert s is not None
        assert s["callsign"] == "JA1ZLO"
        assert s["band"] == "20m"
        assert abs(s["freq"] - 14074.0) < 0.1

    def test_cw_spot(self):
        line = "DX de DL7GER:    7025.0  PY2ABC       CW 599             1823Z"
        s = parse_spot(line)
        assert s is not None
        assert s["band"] == "40m"

    def test_non_spot_returns_none(self):
        assert parse_spot("Hello de W6ABC") is None
        assert parse_spot("") is None
        assert parse_spot("CC de W6ABC: welcome") is None


# ─── PSK XML Parser ──────────────────────────────────────────────────────────

from pskreporter import parse_psk_xml

SAMPLE_XML = '''<?xml version="1.0"?>
<receptionReports>
  <receptionReport receiverCallsign="K6WRJ" receiverLocator="CM95ku"
    senderCallsign="JA1ABC" senderLocator="PM96"
    frequency="14074000" flowStartSeconds="1780000000"
    mode="FT8" senderDXCC="Japan" sNR="-12" />
  <receptionReport receiverCallsign="W6XYZ" receiverLocator="DM04"
    senderCallsign="DL7GER" senderLocator="JO40FB"
    frequency="7074000" flowStartSeconds="1780000001"
    mode="FT8" senderDXCC="Fed. Rep. of Germany" sNR="-7" />
</receptionReports>'''

class TestPSKParser:
    def test_parses_two_spots(self):
        spots = parse_psk_xml(SAMPLE_XML)
        assert len(spots) == 2

    def test_correct_bands(self):
        spots = {s["callsign"]: s for s in parse_psk_xml(SAMPLE_XML)}
        assert spots["JA1ABC"]["band"] == "20m"
        assert spots["DL7GER"]["band"] == "40m"

    def test_snr_parsed(self):
        spots = {s["callsign"]: s for s in parse_psk_xml(SAMPLE_XML)}
        assert spots["JA1ABC"]["snr"] == -12
        assert spots["DL7GER"]["snr"] == -7

    def test_empty_xml(self):
        assert parse_psk_xml('<?xml version="1.0"?><receptionReports/>') == []

    def test_malformed_xml(self):
        assert parse_psk_xml("not xml") == []


# ─── Rate Limiter ────────────────────────────────────────────────────────────

from ratelimit import RateLimiter

class TestRateLimiter:
    def test_allows_under_limit(self):
        rl = RateLimiter(5, 60)
        for _ in range(5):
            ok, _ = rl.is_allowed("1.2.3.4")
            assert ok

    def test_blocks_over_limit(self):
        rl = RateLimiter(3, 60)
        for _ in range(3):
            rl.is_allowed("1.2.3.4")
        ok, retry = rl.is_allowed("1.2.3.4")
        assert not ok
        assert retry > 0

    def test_ips_are_independent(self):
        rl = RateLimiter(1, 60)
        rl.is_allowed("1.1.1.1")
        ok_a, _ = rl.is_allowed("1.1.1.1")
        ok_b, _ = rl.is_allowed("2.2.2.2")
        assert not ok_a
        assert ok_b
