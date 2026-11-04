"""Listener-gated Listenotr episode intros. No network, no API key in the logs."""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import otr_live


def setup_function(_):
    otr_live._listeners.clear()
    otr_live._new_today["day"] = ""
    otr_live._new_today["n"] = 0
    os.environ["DXEDGE_OTR_INTRO_DIR"] = os.path.join(
        os.path.dirname(__file__), "_otr_intro_cache")
    folder = otr_live.cache_dir()
    if os.path.isdir(folder):
        for name in os.listdir(folder):
            os.remove(os.path.join(folder, name))


def teardown_function(_):
    folder = otr_live.cache_dir()
    if os.path.isdir(folder):
        for name in os.listdir(folder):
            os.remove(os.path.join(folder, name))
        os.rmdir(folder)


SECRET = "super-secret-test-key-do-not-print"


def test_episode_intros_use_bills_stock_voice():
    assert otr_live.STOCK_VOICE_ID == "pqHfZKP75CvOlQylNhV4"
    assert otr_live._premade_voice_id("not-sent") == "pqHfZKP75CvOlQylNhV4"
    voices = [
        {"name": "Bill", "voice_id": "clone-bill", "category": "cloned"},
        {"name": "George", "voice_id": "premade-george", "category": "premade"},
        {"name": "Bill", "voice_id": "pqHfZKP75CvOlQylNhV4", "category": "premade"},
    ]
    chosen = otr_live.pick_premade_voice(voices)
    assert chosen["voice_id"] == "pqHfZKP75CvOlQylNhV4"
    assert chosen["category"] == "premade"


def test_premade_voice_refuses_clones():
    voices = [
        {"name": "George", "voice_id": "clone-george", "category": "cloned"},
        {"name": "James", "voice_id": "custom-1", "category": "professional"},
        {"name": "Warm Vintage", "voice_id": "designed-1", "category": "generated"},
        {"name": "Brian", "voice_id": "premade-brian", "category": "premade"},
        {"name": "George", "voice_id": "premade-george", "category": "premade"},
    ]
    chosen = otr_live.pick_premade_voice(voices)
    assert chosen["voice_id"] == "premade-george"
    assert chosen["category"] == "premade"


def test_premade_voice_errors_when_only_clones_exist():
    try:
        otr_live.pick_premade_voice([
            {"name": "James", "voice_id": "abc", "category": "cloned"},
        ])
    except RuntimeError as exc:
        assert "cloned" not in str(exc).lower() or "not used" in str(exc).lower()
        assert "abc" not in str(exc)
    else:
        raise AssertionError("expected a refusal")


def test_no_listeners_skips_generation():
    calls = []
    out = otr_live.intro_for(
        {"ep": "suspense.abc123", "show": "Suspense", "title": "Sorry, Wrong Number", "start": 1_000},
        now=1_000 - 30,
        generate=lambda text, ep: calls.append((text, ep)) or b"x" * 400,
    )
    assert out["play"] == "ident" and out["reason"] == "no-listeners"
    assert calls == []


def test_outside_the_lead_window_skips_generation():
    otr_live.note_listener("session-aaaa", now=500)
    calls = []
    out = otr_live.intro_for(
        {"ep": "suspense.abc123", "show": "Suspense", "title": "The Night", "start": 10_000},
        now=500,
        generate=lambda text, ep: calls.append(ep) or b"x" * 400,
    )
    assert out["reason"] == "outside-window"
    assert calls == []


def test_listener_generates_once_then_uses_the_cache(caplog):
    caplog.set_level("WARNING")
    os.environ["ELEVENLABS_API_KEY"] = SECRET
    otr_live.note_listener("session-bbbb", now=1_000)
    calls = []

    def generate(text, ep):
        calls.append(text)
        assert SECRET not in text
        return b"ID3" + b"\x00" * 400

    body = {"ep": "suspense.abc123", "show": "Suspense", "title": "Sorry, Wrong Number", "start": 1_030}
    first = otr_live.intro_for(body, now=1_000, generate=generate)
    second = otr_live.intro_for(body, now=1_005, generate=generate)
    assert first["play"] == "intro" and first["cached"] is False
    assert second["play"] == "intro" and second["cached"] is True
    assert calls == ["Next, on Suspense. Sorry, Wrong Number. Tune in."]
    assert len(calls) == 1
    assert SECRET not in caplog.text
    del os.environ["ELEVENLABS_API_KEY"]


def test_tts_failure_plays_the_station_id_and_hides_the_key(caplog):
    caplog.set_level("WARNING")
    os.environ["ELEVENLABS_API_KEY"] = SECRET
    otr_live.note_listener("session-cccc", now=2_000)

    def generate(text, ep):
        raise RuntimeError("request failed for key " + SECRET)

    out = otr_live.intro_for(
        {"ep": "suspense.abc123", "show": "Suspense", "title": "The Night", "start": 2_000},
        now=2_000,
        generate=generate,
    )
    assert out["play"] == "ident" and out["reason"] == "tts-failed"
    assert SECRET not in caplog.text
    del os.environ["ELEVENLABS_API_KEY"]


def test_heartbeat_expires():
    otr_live.note_listener("session-dddd", now=100)
    assert otr_live.listener_count(now=100) == 1
    assert otr_live.listener_count(now=100 + otr_live.LISTENER_WINDOW + 1) == 0
    otr_live.note_listener("nope", now=100)
    assert otr_live.listener_count(now=100) == 0


def _says_otr(text):
    if re.search(r"listenotr", text, re.IGNORECASE):
        return True
    if re.search(r"\bO\s*\.\s*T\s*\.\s*R\b", text, re.IGNORECASE):
        return True
    if re.search(r"\bOTR\b", text, re.IGNORECASE):
        return True
    return False


def test_spoken_text_names_the_station_and_never_says_otr():
    phrase = otr_live.SPOKEN_STATION
    assert phrase == "Old Time Radio on listen O T R dot com"
    samples = [
        "You're listening to OTR.",
        "This is O.T.R. tonight.",
        "O. T. R. returns at eight.",
        "otr on the hour",
        "You're listening to Listenotr Radio.",
        "Up next on Listenotr Radio, Suspense.",
        "Up next on old time radio, Suspense.",
        "A Listenotr presentation.",
    ]
    for raw in samples:
        spoken = otr_live.normalize_spoken(raw)
        assert not _says_otr(spoken), spoken
        assert phrase in spoken
    # The spelled-out site is the approved form, and a second pass must not
    # turn those letters into another copy of the station name.
    assert otr_live.normalize_spoken(phrase) == phrase
    intro = otr_live.episode_intro_text("OTR Theatre", "The O.T.R. Hour")
    assert intro == "Next, on " + phrase + " Theatre. The " + phrase + " Hour. Tune in."
    assert not _says_otr(intro)
    plain = otr_live.episode_intro_text("Suspense", "Sorry, Wrong Number")
    assert plain == "Next, on Suspense. Sorry, Wrong Number. Tune in."
    assert not _says_otr(plain)


def test_intro_sentence():
    assert otr_live.episode_intro_text("Suspense", "Sorry, Wrong Number") == (
        "Next, on Suspense. Sorry, Wrong Number. Tune in."
    )
