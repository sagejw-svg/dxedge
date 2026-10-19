"""Tests for contest metadata enrichment.

These guard a specific defect class: a broad substring key in the metadata
tables shadowing a more specific one. Before the two-table split, "dx contest"
matched "CQ Worldwide DX Contest, SSB" and labelled it CW/tier 2, and "sprint"
matched "NCCC FT4 Sprint" and labelled it CW.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from contests import (  # noqa: E402
    GENERIC_FRAGMENTS,
    SPECIFIC_CONTESTS,
    enrich_contest,
    mode_from_name,
)


class TestModeFromName:
    def test_reads_an_explicit_mode_designator(self):
        assert mode_from_name("cq worldwide dx contest, ssb") == "SSB"
        assert mode_from_name("asia-pacific fall sprint, cw") == "CW"
        assert mode_from_name("nccc ft4 sprint") == "FT4"
        assert mode_from_name("vhf-uhf ft8 activity contest") == "FT8"
        assert mode_from_name("weekly rtty test") == "RTTY"

    def test_a_row_naming_both_modes_is_both(self):
        assert mode_from_name("some contest, cw/ssb") == "CW/SSB"

    def test_returns_none_when_the_name_states_no_mode(self):
        assert mode_from_name("new york qso party") is None
        assert mode_from_name("arrl field day") is None


class TestSpecificBeatsGeneric:
    def test_flagship_dx_contests_keep_their_curated_tier(self):
        # "dx contest" is a substring of both of these and must not win.
        for name in ("CQ Worldwide DX Contest, SSB",
                     "ARRL International DX Contest, SSB"):
            meta = enrich_contest(name)
            assert meta["tier"] == 1, name
            assert meta["sponsor"] in ("CQ Magazine", "ARRL"), name

    def test_jidx_is_not_swallowed_by_dx_contest(self):
        # "dx contest" is a substring of "jidx contest".
        meta = enrich_contest("JIDX Contest")
        assert meta["sponsor"] == "JARL"
        assert meta["tier"] == 1

    def test_abbreviated_spellings_still_resolve(self):
        # contestcalendar spells names out, but other sources abbreviate.
        for name in ("CQ WW DX Contest, SSB", "ARRL DX Contest, CW"):
            assert enrich_contest(name)["tier"] == 1, name


class TestModeTokenOverridesTheTable:
    def test_the_running_in_the_row_wins_over_the_family_mode(self):
        assert enrich_contest("CQ Worldwide DX Contest, SSB")["mode"] == "SSB"
        assert enrich_contest("CQ Worldwide DX Contest, CW")["mode"] == "CW"
        assert enrich_contest("CQ Worldwide WPX Contest, RTTY")["mode"] == "RTTY"

    def test_a_digital_sprint_is_not_labelled_cw(self):
        # "sprint" defaults to CW and must not override an explicit FT4.
        meta = enrich_contest("NCCC FT4 Sprint")
        assert meta["mode"] == "FT4"
        # A sprint with no mode token still takes the table default.
        assert enrich_contest("NCCC Sprint")["mode"] == "CW"

    def test_a_band_fragment_does_not_suppress_a_stated_mode(self):
        meta = enrich_contest("RSGB 80m Autumn Series, SSB")
        assert meta["mode"] == "SSB"
        assert meta["bands"] == "80m"

    def test_family_mode_survives_when_the_row_states_nothing(self):
        assert enrich_contest("ARRL Field Day")["mode"] == "All"
        assert enrich_contest("ARRL 10m Contest")["mode"] == "CW/SSB/Digital"


class TestFallback:
    def test_unknown_contest_with_no_mode_token(self):
        meta = enrich_contest("New York QSO Party")
        assert meta == {"mode": "Various", "bands": "HF", "sponsor": "", "tier": 3}

    def test_unknown_contest_infers_mode_from_its_name(self):
        assert enrich_contest("Some Unlisted RTTY Party")["mode"] == "RTTY"


class TestTableHygiene:
    def test_result_is_a_copy_so_callers_cannot_corrupt_the_tables(self):
        before = SPECIFIC_CONTESTS["arrl field day"]["mode"]
        enrich_contest("ARRL Field Day")["mode"] = "MUTATED"
        assert SPECIFIC_CONTESTS["arrl field day"]["mode"] == before

    def test_every_key_is_lowercase_so_substring_matching_works(self):
        for table in (SPECIFIC_CONTESTS, GENERIC_FRAGMENTS):
            for key in table:
                assert key == key.lower(), key

    def test_every_entry_has_the_four_required_fields(self):
        for table in (SPECIFIC_CONTESTS, GENERIC_FRAGMENTS):
            for key, meta in table.items():
                assert set(meta) == {"mode", "bands", "sponsor", "tier"}, key
