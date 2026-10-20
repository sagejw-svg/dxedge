"""The Edge newspaper: on-demand sections, legal comics, votes, seeds."""
import asyncio
import json
import os
import re
import sys
import threading
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from ratelimit import RateLimiter
import news as newsdesk
from news import (
    BIO_SAFE, CONFIG_PATH, LAYOUT_KEYS, LCG, LiveNet, NewsError, Paper, Store, XAIProvider,
    NEWS_AUTH_USER, accept_image, blend, build_prompt, classic_for_day, clip, commons_api_url,
    extract_completion, framing_allowed, is_news_path, load_config, news_basic_ok,
    news_cookie_ok, news_credentials_ok, news_password, news_session_cookie, owner_secret,
    parse_commons, parse_model_json, parse_seed, parse_user, pepper_image_urls,
    persona_weights, preamble, public_domain, public_section, safe_frame_url,
    scrub_highlight, section_map, strip_page_url, vote_mix, xkcd_skipped, PROFILE_RE,
    _validate_config,
)

ROOT = Path(__file__).resolve().parents[2]
DAY = "2026-10-17"


class Clock:
    def __init__(self):
        # 06:00Z on the 18th is still the 17th in Pacific time.
        self.now_dt = datetime(2026, 10, 18, 6, 0, tzinfo=timezone.utc)

    def now(self):
        return self.now_dt


class FakeNet:
    def __init__(self):
        self.json = {}
        self.header_map = {}
        self.calls = []

    async def get_json(self, url):
        self.calls.append(url)
        if url not in self.json:
            raise RuntimeError(url)
        return self.json[url]

    async def headers(self, url):
        self.calls.append("H " + url)
        return self.header_map.get(url, {"x-frame-options": "DENY"})


class FakeProvider:
    name = "fake"

    def __init__(self, highlights=None, ready=True):
        self.ready = ready
        self.calls = 0
        self.last = None
        self.highlights = highlights or [{
            "title": "A real change",
            "dek": "Act on this.",
            "body": "A short decision for the reader.",
            "topics": ["space"],
            "sources": [{"title": "Wire", "url": "https://www.nasa.gov/example"}],
        }]

    async def complete(self, system, user):
        self.calls += 1
        self.last = (system, user)
        return {"output_text": json.dumps({"highlights": self.highlights})}


def uid(n):
    return f"00000000-0000-4000-8000-{n:012d}"


@pytest.fixture
def env(tmp_path, monkeypatch):
    monkeypatch.setenv("DXEDGE_NEWS_DB", str(tmp_path / "news.db"))
    monkeypatch.setenv("NEWS_OWNER_FILE", str(tmp_path / "no-owner.json"))
    monkeypatch.delenv("NEWS_OWNER_SEED", raising=False)
    monkeypatch.delenv("NEWS_OWNER_READER", raising=False)
    monkeypatch.delenv("XAI_API_KEY", raising=False)
    monkeypatch.delenv("GROK_API_KEY", raising=False)
    return tmp_path


@pytest.fixture
def paper(env):
    net = FakeNet()
    config = load_config()
    calvin = next(s for s in config["strips"] if s["id"] == "calvin")
    net.header_map[strip_page_url(calvin, DAY)] = {}
    net.json["https://xkcd.com/info.0.json"] = {
        "num": 100, "title": "Election night",
        "img": "https://imgs.xkcd.com/comics/election.png", "alt": "", "transcript": "",
    }
    net.json["https://xkcd.com/99/info.0.json"] = {
        "num": 99, "title": "Standards",
        "img": "https://imgs.xkcd.com/comics/standards.png", "alt": "fortunately", "transcript": "",
    }
    net.json[config["peppercarrot"]["index"]] = [
        {"name": "ep01_Potion-of-Flight", "translated_languages": ["en"], "total_pages": 8},
        {"name": "ep39_The-Tavern", "translated_languages": ["en"], "total_pages": 6},
    ]
    classic = classic_for_day(config["classics"], DAY)
    net.json[commons_api_url(classic["file"])] = {
        "query": {"pages": {"1": {"imageinfo": [{
            "url": "https://upload.wikimedia.org/wikipedia/commons/1/11/Little_Nemo.jpg",
            "extmetadata": {"LicenseShortName": {"value": "Public domain"}},
        }]}}}
    }
    store = Store(env / "news.db")
    store.init()
    provider = FakeProvider()
    desk = Paper(
        store, provider, net, Clock(),
        gen_limiter=RateLimiter(30, 3600),
        vote_limiter=RateLimiter(80, 3600),
    )
    desk.net = net
    desk.provider = provider
    return desk


REQUIRED = [
    "comics", "ai-editorial", "biology", "cancer", "education", "sleep",
    "ai-security", "cyber", "company", "money", "life", "space", "weird", "world",
]
REQUIRED_TITLES = {
    "comics": "Comics",
    "ai-editorial": "AI editorial",
    "biology": "Biology",
    "cancer": "Cancer",
    "education": "Education",
    "sleep": "Narcolepsy & sleep",
    "ai-security": "AI security",
    "cyber": "Cybersecurity",
    "company": "Protecting your company",
    "money": "AI money-making",
    "life": "Life improvement & thinking tools",
    "space": "Space & aliens",
    "weird": "Weird side",
    "world": "Big World News",
}
PROFILE_WORDS = (
    "from the desk", "weekend sailor", "sailing", "sailor", "ranch",
    "synth", "synthesizer", "recode", "prediction market",
)


def test_config_is_the_paper():
    cfg = load_config()
    ids = [s["id"] for s in cfg["sections"]]
    assert ids[0] == "ai-world"
    assert ids[1:] == REQUIRED
    by_id = {s["id"]: s for s in cfg["sections"]}
    for sid, title in REQUIRED_TITLES.items():
        assert by_id[sid]["title"] == title
        assert not by_id[sid].get("coming_soon")
        assert by_id[sid].get("prompt")
    assert by_id["ai-security"]["id"] != by_id["cyber"]["id"]
    assert "cybersecurity belongs in its own section" in by_id["ai-security"]["prompt"]
    assert "separate from AI-only security" in by_id["cyber"]["prompt"]
    assert "medical advice" in by_id["cancer"]["prompt"].lower()
    assert "teaching and learning" in by_id["education"]["prompt"].lower()
    assert "picks" not in ids
    assert "ham" not in ids
    blob = json.dumps(cfg).lower()
    assert "dilbert" not in blob
    assert "ham radio" not in blob
    assert "james" not in blob
    assert "k6wrj" not in blob
    assert PROFILE_RE.search(blob) is None
    for word in PROFILE_WORDS:
        assert re.search(rf"\b{word}\b", blob, re.I) is None
    for topic in ("sailing", "synth", "games", "ranch", "markets"):
        assert topic not in cfg["topics"]
    hagar = next(s for s in cfg["strips"] if s["id"] == "hagar")
    assert hagar["host"] == "comicskingdom"
    assert hagar["frame"] == "never"
    assert hagar["home"] == "https://comicskingdom.com/hagar-the-horrible"
    calvin = next(s for s in cfg["strips"] if s["id"] == "calvin")
    assert calvin["favorite"] is True
    assert calvin["home"] == "https://www.gocomics.com/calvinandhobbes"
    assert all(c["year"] < 1929 for c in cfg["classics"])
    labels = [e["label"] for e in cfg["example_seeds"]]
    assert 5 <= len(labels) <= 8
    for name in ("Space nerd", "College freshman", "Startup founder",
                 "Biology buff", "Weird-news fan", "Security lead"):
        assert name in labels
    assert "Weekend sailor" not in labels
    assert "Retired tinkerer" not in labels
    bad = json.loads(json.dumps(cfg))
    bad["strips"].append({
        "id": "dilbert", "name": "Dilbert", "host": "gocomics", "slug": "dilbert",
        "home": "https://www.gocomics.com/dilbert", "frame": "never", "base_rank": 0,
    })
    with pytest.raises(ValueError):
        _validate_config(bad)
    profiled = json.loads(json.dumps(cfg))
    profiled["topics"].append("sailing")
    with pytest.raises(ValueError):
        _validate_config(profiled)
    desk = json.loads(json.dumps(cfg))
    desk["sections"].append({
        "id": "picks", "title": "From the desk", "kicker": "Interests",
        "brief": "A mix.", "prompt": "A short mix.",
    })
    with pytest.raises(ValueError):
        _validate_config(desk)


def test_prompts_carry_the_hard_rules():
    head = preamble()
    assert "Where AI progress" in head
    assert "ai_progress" in head
    assert "Two or three highlights" in head
    assert "ham radio" in head.lower()
    assert "protocols" in head.lower()
    assert "employer" in head.lower()
    assert "children" in head.lower()
    for sec in load_config()["sections"]:
        assert not sec.get("coming_soon")
        system, user = build_prompt(sec, DAY, [("space", 3)])
        assert system == head
        assert "space" in user
        assert "18421" not in system + user
        assert PROFILE_RE.search(system + user) is None
    assert "Cybercab" in build_prompt(section_map()["world"], DAY, [])[1]
    assert "Roadster" in build_prompt(section_map()["world"], DAY, [])[1]
    assert "anonymous" in build_prompt(section_map()["sleep"], DAY, [])[1].lower()
    assert "anti-government" in build_prompt(section_map()["weird"], DAY, [])[1].lower()
    assert "employer" in build_prompt(section_map()["company"], DAY, [])[1].lower()
    assert "prompt" not in public_section(section_map()["biology"])


def test_safety_filters():
    clean = scrub_highlight("biology", {
        "title": "A lab recipe",
        "dek": "Incubate the culture overnight.",
        "body": "Transfect the plasmid and pipette the mix.",
        "topics": ["Biology"],
        "sources": [{"title": "Nature", "url": "https://www.nature.com/articles/example"}],
    }, [])
    assert clean["body"] == BIO_SAFE
    assert clean["topics"] == ["biology"]
    assert scrub_highlight("space", {
        "title": "Nets", "dek": "Ham radio contest tips.", "body": "Amateur radio gear.",
        "topics": ["space"], "sources": [],
    }, []) is None
    assert scrub_highlight("weird", {
        "title": "Plot", "dek": "They will overthrow the government.", "body": "Now.",
        "topics": ["weird"], "sources": [],
    }, []) is None
    assert scrub_highlight("ai-security", {
        "title": "Bug", "dek": "Here is shellcode.", "body": "Run it.",
        "topics": ["security"],
        "sources": [{"title": "Wire", "url": "https://www.example.com/sec"}],
    }, []) is None
    assert scrub_highlight("cyber", {
        "title": "Bug", "dek": "Here is shellcode.", "body": "Run it.",
        "topics": ["cyber"],
        "sources": [{"title": "Wire", "url": "https://www.example.com/sec"}],
    }, []) is None
    assert scrub_highlight("cancer", {
        "title": "Take this", "dek": "You should take the new pill.",
        "body": "A recommended dose is 50 mg per day.",
        "topics": ["cancer"],
        "sources": [{"title": "NEJM", "url": "https://www.nejm.org/a"}],
    }, []) is None
    kept = scrub_highlight("cancer", {
        "title": "A trial reported a longer response",
        "dek": "A phase 3 study compared two regimens.",
        "body": "The paper reports a difference. It is not a treatment plan.",
        "topics": ["cancer"],
        "ai_progress": "A model helped screen the trial records.",
        "sources": [{"title": "NEJM", "url": "https://www.nejm.org/a"}],
    }, [])
    assert kept["sources"][0]["url"].startswith("https://")
    assert kept["ai_progress"] == "A model helped screen the trial records."
    assert scrub_highlight("space", {
        "title": "Noted", "dek": "See the link.", "body": "Real.",
        "topics": ["space"], "sources": [],
    }, []) is None
    assert scrub_highlight("life", {
        "title": "A weekend", "dek": "Sailing the bay.", "body": "Bring the boat.",
        "topics": ["life"],
        "sources": [{"title": "Wire", "url": "https://www.example.com/sail"}],
    }, []) is None
    dropped = scrub_highlight("space", {
        "title": "Noted", "dek": "See the link.", "body": "Real.",
        "topics": ["space"],
        "sources": [{"title": "nope", "url": "http://insecure.example/a"},
                    {"title": "ok", "url": "https://www.example.com/a"}],
    }, ["https://www.example.com/a", "javascript:alert(1)"])
    assert [s["url"] for s in dropped["sources"]] == ["https://www.example.com/a"]
    text, cites = extract_completion({
        "citations": ["https://www.example.com/one"],
        "output": [{"type": "message", "content": [
            {"type": "output_text", "text": '{"highlights":[]}',
             "annotations": [{"url": "https://www.example.com/two"}]}
        ]}],
    })
    assert "highlights" in text
    assert cites == ["https://www.example.com/one", "https://www.example.com/two"]
    fenced = parse_model_json("```json\n{\"highlights\": []}\n```")
    assert fenced["highlights"] == []


def test_framing_and_image_rules():
    assert framing_allowed({}) is True
    assert framing_allowed({"X-Frame-Options": "DENY"}) is False
    assert framing_allowed({"x-frame-options": "SAMEORIGIN"}) is False
    assert framing_allowed({"content-security-policy": "frame-ancestors 'none'"}) is False
    assert framing_allowed({"content-security-policy": "frame-ancestors 'self'"}) is False
    assert framing_allowed({"content-security-policy": "frame-ancestors https://dxedge.net"}) is True
    assert framing_allowed({"content-security-policy": "frame-ancestors *"}) is True
    calvin = next(s for s in load_config()["strips"] if s["id"] == "calvin")
    hagar = next(s for s in load_config()["strips"] if s["id"] == "hagar")
    page = strip_page_url(calvin, DAY)
    assert page == "https://www.gocomics.com/calvinandhobbes/2026/10/17"
    assert strip_page_url(hagar, DAY) == "https://comicskingdom.com/hagar-the-horrible/2026-10-17"
    assert safe_frame_url(calvin, page, True) == page
    assert safe_frame_url(calvin, page, False) is None
    assert safe_frame_url(hagar, strip_page_url(hagar, DAY), True) is None
    assert accept_image("https://imgs.xkcd.com/comics/a.png", "xkcd")
    assert accept_image("https://www.peppercarrot.com/0_sources/a.jpg", "pepper")
    assert accept_image("https://upload.wikimedia.org/wikipedia/commons/a.jpg", "commons")
    assert not accept_image("https://featureassets.gocomics.com/strip.png", "xkcd")
    assert not accept_image("https://comicskingdom.com/strip.png", "commons")
    urls = pepper_image_urls("ep39_The-Tavern")
    assert "by-David-Revoy" in urls["cover"] and urls["cover"].endswith("E39.jpg")
    assert urls["page"].endswith("E39P01.jpg")
    assert pepper_image_urls("not-an-episode") is None
    assert public_domain("Public domain")
    assert not public_domain("CC BY-SA 4.0")
    assert classic_for_day([{"year": 1930, "id": "late"}], DAY) is None
    parsed = parse_commons({"query": {"pages": {"1": {"imageinfo": [{
        "url": "https://upload.wikimedia.org/a.jpg",
        "extmetadata": {"LicenseShortName": {"value": "Public domain"}},
    }]}}}})
    assert parsed[0].startswith("https://upload.wikimedia.org/")


def test_bot_wall_is_not_a_frame(paper, monkeypatch):
    monkeypatch.setattr("news.host_allowed", lambda url: True)
    class Wall(BaseHTTPRequestHandler):
        def do_HEAD(self):
            self.send_response(403)
            self.send_header("Content-Type", "text/html")
            self.end_headers()

        def do_GET(self):
            body = b"<!DOCTYPE html><title>Establishing a secure connection ...</title>"
            self.send_response(403)
            self.send_header("Content-Type", "text/html")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, fmt, *args):
            return

    server = ThreadingHTTPServer(("127.0.0.1", 0), Wall)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        url = f"http://127.0.0.1:{server.server_address[1]}/calvinandhobbes/2026/10/17"
        with pytest.raises(NewsError):
            asyncio.run(LiveNet().headers(url))
    finally:
        server.shutdown()
    paper.net = FakeNet()

    class Boom:
        async def headers(self, url):
            raise NewsError(502, "A comic source did not answer.")

    paper.net = Boom()
    frames = asyncio.run(paper._frames([{
        "id": "calvin", "frame": "try", "host": "gocomics", "slug": "calvinandhobbes",
    }], DAY))
    assert frames["calvin"] is False


def test_seed_math_is_stable_and_does_not_touch_prompts():
    ids = ["ai-world", "world", "space"]
    topics = ["space", "money"]
    first = persona_weights(18421, ids, topics)
    assert first == persona_weights(18421, ids, topics)
    assert first != persona_weights(22017, ids, topics)
    assert all(0 <= v < 1 for v in list(first[0].values()) + list(first[1].values()))
    assert LCG(3)() == LCG(3)()
    base = {"a": 0.2, "b": 0.8}
    assert blend(base, {}, 0.5) == base
    mixed = blend(base, {"a": 1.0}, 0.5)
    assert mixed["a"] == pytest.approx(0.6)
    assert mixed["b"] == 0.8
    assert vote_mix(0) == 0
    assert vote_mix(24) == pytest.approx(0.5)
    assert parse_seed(None) is None
    assert parse_seed("12") == 12
    with pytest.raises(NewsError):
        parse_seed(True)
    with pytest.raises(NewsError):
        parse_seed("1.5")
    with pytest.raises(NewsError):
        parse_user("james@example.com")
    assert parse_user(uid(1)) == uid(1)


def test_today_follows_the_paper_clock(paper):
    assert paper.today() == DAY


def test_section_generates_once_then_caches(paper):
    first = asyncio.run(paper.open_section(DAY, "space", "1.1.1.1", uid(1), False))
    assert first["cached"] is False
    assert first["stub"] is False
    assert paper.provider.calls == 1
    assert first["highlights"][0]["sources"][0]["url"].startswith("https://")
    assert "Where AI progress" in paper.provider.last[0]
    second = asyncio.run(paper.open_section(DAY, "space", "1.1.1.1", uid(1), False))
    assert second["cached"] is True
    assert paper.provider.calls == 1
    paper.read_day(DAY)
    assert paper.provider.calls == 1


def test_stub_is_not_cached_and_names_the_secret(paper):
    paper.provider.ready = False
    out = asyncio.run(paper.open_section(DAY, "space", "1.1.1.1", None, False))
    assert out["stub"] is True
    assert out["needed_secret"] == "XAI_API_KEY"
    assert paper.provider.calls == 0
    assert paper.store.get_section(DAY, "space") is None
    again = asyncio.run(paper.open_section(DAY, "space", "1.1.1.1", None, False))
    assert again["stub"] is True
    assert paper.provider.calls == 0


def test_dormant_blocks_generation_until_a_click(paper):
    paper.store.touch(paper.now() - timedelta(days=15))
    blocked = asyncio.run(paper.open_section(DAY, "space", "1.1.1.1", None, False))
    assert blocked["dormant"] is True
    assert paper.provider.calls == 0
    assert paper.status()["dormant"] is True
    paper.wake()
    opened = asyncio.run(paper.open_section(DAY, "space", "1.1.1.1", None, False))
    assert opened["dormant"] is False
    assert paper.provider.calls == 1
    paper.store.touch(paper.now() - timedelta(days=13))
    assert paper.store.dormant(paper.now()) is False


def test_status_does_not_keep_the_paper_awake(paper):
    assert paper.status()["last_click"] is None
    assert paper.status()["last_click"] is None
    assert paper.provider.calls == 0


def test_open_sections_and_day_window(paper):
    opened = asyncio.run(paper.open_section(DAY, "cancer", "1.1.1.1", None, False))
    assert opened["coming_soon"] is False
    assert opened["stub"] is False
    assert paper.provider.calls == 1
    edu = asyncio.run(paper.open_section(DAY, "education", "1.1.1.1", None, False))
    assert edu["coming_soon"] is False
    assert paper.provider.calls == 2
    with pytest.raises(NewsError):
        asyncio.run(paper.open_section("2026-10-18", "space", "1.1.1.1", None, False))
    with pytest.raises(NewsError):
        asyncio.run(paper.open_section("2026-10-03", "space", "1.1.1.1", None, False))
    assert paper.provider.calls == 2


def test_comics_shelf_is_legal(paper):
    out = asyncio.run(paper.open_section(DAY, "comics", "1.1.1.1", uid(1), False))
    assert paper.provider.calls == 0
    assert out["shelf"][0]["id"] == "calvin"
    assert out["shelf"][0]["frame"] is True
    assert out["shelf"][0]["frame_url"].startswith("https://www.gocomics.com/calvinandhobbes/")
    hagar = next(s for s in out["shelf"] if s["id"] == "hagar")
    assert hagar["frame"] is False
    assert hagar["frame_url"] is None
    assert hagar["url"].startswith("https://comicskingdom.com/hagar-the-horrible/")
    peanuts = next(s for s in out["shelf"] if s["id"] == "peanuts")
    assert peanuts["frame"] is False
    for card in out["shelf"]:
        assert "img" not in card
        assert "gocomics.com" in card["url"] or "comicskingdom.com" in card["url"]
    kinds = {item["kind"]: item for item in out["inline"]}
    assert kinds["xkcd"]["id"] == "xkcd-99"
    assert kinds["xkcd"]["license"] == "CC BY-NC 2.5"
    assert kinds["xkcd"]["credit"].startswith("xkcd by Randall Munroe")
    assert kinds["xkcd"]["page"] == "https://xkcd.com/99/"
    assert accept_image(kinds["xkcd"]["img"], "xkcd")
    assert "David Revoy" in kinds["peppercarrot"]["credit"]
    assert kinds["peppercarrot"]["license"] == "CC BY 4.0"
    assert len(kinds["peppercarrot"]["pages"]) == 2
    assert "by-David-Revoy" in kinds["peppercarrot"]["img"]
    assert kinds["commons"]["license"] == "Public domain"
    assert "McCay" in kinds["commons"]["credit"] or "Nemo" in kinds["commons"]["credit"]
    assert accept_image(kinds["commons"]["img"], "commons")
    calls = len(paper.net.calls)
    again = asyncio.run(paper.open_section(DAY, "comics", "1.1.1.1", uid(1), False))
    assert again["cached"] is True
    assert len(paper.net.calls) == calls
    paper.net.json[commons_api_url(classic_for_day(load_config()["classics"], DAY)["file"])] = {
        "query": {"pages": {"1": {"imageinfo": [{
            "url": "https://upload.wikimedia.org/wikipedia/commons/a.jpg",
            "extmetadata": {"LicenseShortName": {"value": "CC BY-SA 4.0"}},
        }]}}}
    }
    assert asyncio.run(paper._classic(load_config(), DAY)) is None


def test_votes_rank_and_stay_private(paper):
    asyncio.run(paper.open_section(DAY, "comics", "1.1.1.1", None, False))
    calvin_base = next(s for s in load_config()["strips"] if s["id"] == "calvin")["base_rank"]
    for n in range(calvin_base + 1):
        paper.cast_vote(uid(10 + n), "peanuts", "liked", DAY, "comics", f"10.0.0.{n}")
    ranked = asyncio.run(paper.open_section(DAY, "comics", "1.1.1.1", uid(1), False))
    assert ranked["shelf"][0]["id"] == "peanuts"
    first = paper.cast_vote(uid(1), "peanuts", "hide", DAY, "comics", "1.1.1.1")
    assert first["on"] is True
    second = paper.cast_vote(uid(1), "peanuts", "hide", DAY, "comics", "1.1.1.1")
    assert second["on"] is False
    other = uid(99)
    paper.cast_vote(other, "calvin", "useful", DAY, "comics", "9.9.9.9")
    mine = paper.cast_vote(uid(1), "calvin", "liked", DAY, "comics", "1.1.1.1")
    blob = json.dumps(mine)
    assert other not in blob
    assert mine["mine"]["useful"] is False
    assert mine["votes"]["useful"] == 1
    paper.forget_reader(uid(1))
    assert paper.store.mine(uid(1), "calvin")["liked"] is False
    assert paper.store.counts("calvin")["useful"] == 1
    paper.store.put_section(DAY, "space", {
        "day": DAY,
        "highlights": [
            {"id": f"{DAY}:space:0", "title": "First", "dek": "a", "body": "a",
             "topics": ["space"], "sources": []},
            {"id": f"{DAY}:space:1", "title": "Second", "dek": "b", "body": "b",
             "topics": ["money"], "sources": []},
        ],
    }, "fake", paper.now())
    for n in range(3):
        paper.cast_vote(uid(40 + n), f"{DAY}:space:1", "useful", DAY, "space", f"4.0.0.{n}")
    order = paper.layout(DAY, None, None)["order"]["space"]
    assert order[0].endswith(":1")
    paper.cast_vote(uid(1), f"{DAY}:space:0", "hide", DAY, "space", "1.1.1.1")
    lay = paper.layout(DAY, None, uid(1))
    assert f"{DAY}:space:0" not in lay["order"]["space"]
    assert f"{DAY}:space:0" in lay["hidden"]
    assert uid(1) not in json.dumps(lay)
    assert set(lay) == LAYOUT_KEYS


def test_seed_reorders_without_generation(paper):
    before = paper.provider.calls
    plain = paper.layout(DAY, None, None)
    seeded = paper.layout(DAY, 18421, None)
    other = paper.layout(DAY, 22017, None)
    assert paper.provider.calls == before
    assert plain["show"][0] == "ai-world"
    assert seeded["show"][0] == "ai-world"
    assert plain["show"][1:] == REQUIRED
    assert plain["coming_soon"] == []
    assert plain["more"] == []
    assert "picks" not in plain["show"]
    assert seeded["show"] != other["show"] or seeded["more"] != other["more"]
    dumped = json.dumps(seeded).lower()
    assert "owner" not in dumped
    assert "james" not in dumped
    assert PROFILE_RE.search(dumped) is None


def test_example_seeds_match_their_labels():
    cfg = load_config()
    ids = [s["id"] for s in cfg["sections"]]
    topics = cfg["topics"]
    by_label = {ex["label"]: ex["seed"] for ex in cfg["example_seeds"]}

    def top(seed):
        sections, weights = persona_weights(seed, ids, topics)
        order = sorted([sid for sid in ids if sid != "ai-world"], key=lambda sid: -sections[sid])
        topic_order = sorted(topics, key=lambda topic: -weights[topic])
        return order, topic_order

    space, space_topics = top(by_label["Space nerd"])
    assert space[0] == "space" and space_topics[0] == "space"
    bio, bio_topics = top(by_label["Biology buff"])
    assert bio[0] == "biology" and bio_topics[0] == "biology"
    weird, weird_topics = top(by_label["Weird-news fan"])
    assert weird[0] == "weird" and weird_topics[0] == "weird"
    money, money_topics = top(by_label["Startup founder"])
    assert money[0] == "money" and "company" in money[:4] and money_topics[0] == "money"
    life, life_topics = top(by_label["College freshman"])
    assert life[0] == "life" and "comics" in life[:4] and "world" in life[:4]
    assert life_topics[0] == "life"
    security, security_topics = top(by_label["Security lead"])
    assert security[0] == "ai-security" and security_topics[0] == "security"
    assert "Weekend sailor" not in by_label
    assert "Retired tinkerer" not in by_label


def test_status_publishes_example_personas(paper):
    status = paper.status()
    examples = status["examples"]
    assert 5 <= len(examples) <= 8
    labels = [ex["label"] for ex in examples]
    for name in ("Space nerd", "College freshman", "Startup founder",
                 "Biology buff", "Weird-news fan", "Security lead"):
        assert name in labels
    assert "Weekend sailor" not in labels
    assert "Retired tinkerer" not in labels
    ids = [s["id"] for s in status["sections"]]
    assert ids[0] == "ai-world"
    assert ids[1:] == REQUIRED
    assert all(not s["coming_soon"] for s in status["sections"])
    assert status["ai_progress"] == []
    blob = json.dumps(examples).lower()
    assert PROFILE_RE.search(blob) is None
    assert "owner" not in blob
    assert "james" not in blob
    assert "child" not in blob
    assert len({ex["seed"] for ex in examples}) == len(examples)
    assert "prompt" not in json.dumps(status["sections"])


def test_reserved_seed_never_leaves_the_server(paper, monkeypatch):
    reader = uid(7)
    reserved = next(ex for ex in load_config()["example_seeds"] if ex["label"] == "Space nerd")
    monkeypatch.setenv("NEWS_OWNER_SEED", str(reserved["seed"]))
    monkeypatch.setenv("NEWS_OWNER_READER", reader)
    secret, who = owner_secret()
    assert secret == reserved["seed"] and who == reader
    status = paper.status()
    blob = json.dumps(status)
    assert str(reserved["seed"]) not in blob
    assert reader not in blob
    assert "owner" not in blob.lower()
    assert all(ex["seed"] != reserved["seed"] for ex in status["examples"])
    assert any(ex["label"] == reserved["label"] for ex in status["examples"]) is False
    lay = paper.layout(DAY, reserved["seed"], uid(3))
    dumped = json.dumps(lay)
    assert reader not in dumped
    assert str(reserved["seed"]) not in dumped
    assert "owner" not in dumped.lower()
    system, user = build_prompt(section_map()["sleep"], DAY, [])
    assert "18421" not in system + user
    assert reader not in system + user


def test_vote_rate_limit(paper):
    paper.vote_limiter = RateLimiter(2, 60)
    paper.cast_vote(uid(1), "calvin", "liked", DAY, "comics", "1.2.3.4")
    paper.cast_vote(uid(1), "calvin", "useful", DAY, "comics", "1.2.3.4")
    with pytest.raises(NewsError) as caught:
        paper.cast_vote(uid(1), "calvin", "hide", DAY, "comics", "1.2.3.4")
    assert caught.value.status == 429


def test_provider_reports_the_missing_key(monkeypatch):
    monkeypatch.delenv("XAI_API_KEY", raising=False)
    monkeypatch.delenv("GROK_API_KEY", raising=False)
    provider = XAIProvider(key="")
    assert provider.ready is False
    provider = XAIProvider(key="test-key")
    assert provider.ready is True
    assert provider.model


def test_generated_section_keeps_two_or_three_sourced_notes(paper):
    paper.provider.highlights = [
        {"title": "One", "dek": "d", "body": "b", "topics": ["ai"],
         "ai_progress": "A model beat the previous benchmark.",
         "sources": [{"title": "Wire", "url": "https://www.example.com/a"}]},
        {"title": "Two", "dek": "d", "body": "b", "topics": ["ai"],
         "ai_progress": "",
         "sources": [{"title": "Wire", "url": "https://www.example.com/b"}]},
        {"title": "No source", "dek": "d", "body": "b", "topics": ["ai"],
         "sources": [{"title": "bad", "url": "http://nope.example/a"}]},
        {"title": "Ham note", "dek": "d", "body": "b", "topics": ["ai"],
         "ai_progress": "Ham radio nets now use a model.",
         "sources": [{"title": "Wire", "url": "https://www.example.com/c"}]},
        {"title": "Four", "dek": "d", "body": "b", "topics": ["ai"],
         "sources": [{"title": "Wire", "url": "https://www.example.com/d"}]},
    ]
    out = asyncio.run(paper.open_section(DAY, "cyber", "1.1.1.1", None, False))
    assert [h["title"] for h in out["highlights"]] == ["One", "Two", "Four"]
    assert out["highlights"][0]["ai_progress"] == "A model beat the previous benchmark."
    assert "ai_progress" not in out["highlights"][1]
    assert all(h["sources"][0]["url"].startswith("https://") for h in out["highlights"])
    assert paper.provider.calls == 1
    again = asyncio.run(paper.open_section(DAY, "cyber", "1.1.1.1", None, False))
    assert again["cached"] is True
    assert paper.provider.calls == 1


def test_ai_progress_thread_reads_cached_notes_only(paper):
    paper.store.put_section(DAY, "space", {
        "day": DAY,
        "highlights": [
            {"id": f"{DAY}:space:0", "title": "A step", "dek": "d", "body": "b",
             "topics": ["space"], "ai_progress": "Models planned a rover route.",
             "sources": [{"title": "NASA", "url": "https://www.nasa.gov/a"}]},
            {"id": f"{DAY}:space:1", "title": "No note", "dek": "d", "body": "b",
             "topics": ["space"],
             "sources": [{"title": "NASA", "url": "https://www.nasa.gov/b"}]},
        ],
    }, "fake", paper.now())
    paper.store.put_section("2026-10-16", "biology", {
        "day": "2026-10-16",
        "highlights": [{
            "id": "2026-10-16:biology:0", "title": "Earlier", "dek": "d", "body": "b",
            "topics": ["biology"], "ai_progress": "A model read a genome paper.",
            "sources": [{"title": "Nature", "url": "https://www.nature.com/a"}],
        }],
    }, "fake", paper.now())
    paper.store.put_section("2026-10-01", "money", {
        "day": "2026-10-01",
        "highlights": [{
            "id": "2026-10-01:money:0", "title": "Old", "dek": "d", "body": "b",
            "topics": ["money"], "ai_progress": "Too old to show.",
            "sources": [{"title": "Wire", "url": "https://www.example.com/old"}],
        }],
    }, "fake", paper.now())
    paper.store.put_section("2026-10-15", "sleep", {
        "day": "2026-10-15",
        "highlights": [{
            "id": "2026-10-15:sleep:0", "title": "Skip", "dek": "d", "body": "b",
            "topics": ["sleep"], "ai_progress": "Sailing is not a progress note.",
            "sources": [{"title": "Wire", "url": "https://www.example.com/sail"}],
        }],
    }, "fake", paper.now())
    before = paper.provider.calls
    status = paper.status()
    notes = status["ai_progress"]
    assert paper.provider.calls == before
    assert status["last_click"] is None
    assert [n["day"] for n in notes] == [DAY, "2026-10-16"]
    assert notes[0]["section"] == "space"
    assert notes[0]["note"] == "Models planned a rover route."
    assert notes[0]["url"] == "https://www.nasa.gov/a"
    assert notes[1]["note"] == "A model read a genome paper."
    blob = json.dumps(notes).lower()
    assert PROFILE_RE.search(blob) is None
    assert "james" not in blob
    assert "ham radio" not in blob


def test_page_wires_match_the_desk():
    html = (ROOT / "frontend/public/news/index.html").read_text(encoding="utf-8")
    sw = (ROOT / "frontend/public/sw.js").read_text(encoding="utf-8")
    nginx = (ROOT / "nginx/nginx.conf").read_text(encoding="utf-8")
    compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
    main = (ROOT / "backend/main.py").read_text(encoding="utf-8")
    app = (ROOT / "frontend/src/App.jsx").read_text(encoding="utf-8")
    assert "Would you like to set up a persistent cookie on your machine to remember your news preferences?" in html
    assert "No thanks" in html
    assert "Forget me" in html
    assert "Liked it" in html and "Useful" in html
    assert "IMAGE_HOSTS" in html
    assert "imgs.xkcd.com" in html
    assert "gocomics.com" not in html.split("IMAGE_HOSTS", 1)[1].split("]", 1)[0]
    assert "location.search" not in html
    assert "pushState" not in html
    assert "mailto:" not in html
    assert "dilbert" not in html.lower()
    assert "ham radio" not in html.lower()
    assert "james" not in html.lower()
    assert "k6wrj" not in html.lower()
    assert 'id="seed-examples"' in html
    assert 'aria-label="Example readers"' in html
    assert 'class: "chip"' in html
    assert "status.examples" in html
    assert "Space nerd" not in html
    assert "CACHE_NAME = 'dxedge-v112'" in sw
    assert "url.pathname.startsWith('/news/')" in sw
    # The paper is not intercepted. A service worker response hides the dialog.
    before_mutable, _, after_mutable = sw.partition("const mutable")
    assert "url.pathname.startsWith('/news/')" in before_mutable
    assert "url.pathname.startsWith('/news/')" not in after_mutable
    assert "location ^~ /news/" in nginx
    assert 'add_header Cache-Control "no-cache, must-revalidate" always;' in nginx
    assert "location = /news" in nginx
    assert "XAI_API_KEY" in compose
    assert "GROK_API_KEY" in compose
    assert "NEWS_OWNER_SEED" in compose
    assert "NEWS_PASSWORD" in compose
    assert "username is edge" in compose
    deploy = (ROOT / ".github/workflows/deploy.yml").read_text(encoding="utf-8")
    assert "secrets.XAI_API_KEY" in deploy
    assert "secrets.GROK_API_KEY" in deploy
    assert "secrets.NEWS_PASSWORD" in deploy
    assert "unset XAI_API_KEY" in deploy
    assert "unset NEWS_PASSWORD" in deploy
    assert "news model key is unset" in deploy
    assert "/opt/dxedge/.env" in deploy
    assert 'echo "$XAI_API_KEY"' not in deploy
    assert "echo ${XAI_API_KEY}" not in deploy
    assert 'echo "$NEWS_PASSWORD"' not in deploy
    assert "echo ${NEWS_PASSWORD}" not in deploy
    assert "Droplet value left unchanged" in deploy
    assert "write_secret NEWS_PASSWORD" in deploy
    assert "openssl rand -hex 24" in deploy
    assert "keeping the existing droplet password" in deploy
    assert "generated a droplet password without logging it" in deploy
    assert "Basic auth user is edge" in deploy
    assert "Fail closed" in deploy
    assert 'envs: XAI_API_KEY,GROK_API_KEY,NEWS_PASSWORD' in deploy
    assert "--force-recreate --no-deps backend" in deploy
    assert NEWS_AUTH_USER == "edge"
    for path in ("/api/news/status", "/api/news/day", "/api/news/section",
                 "/api/news/layout", "/api/news/vote", "/api/news/wake", "/api/news/forget"):
        assert path in main
    assert "class NewsGate" in main
    assert "_require_news" in main
    assert "news_credentials_ok" in main
    assert 'Cache-Control": "no-store"' in main or "no-store" in main
    assert "/news/" not in app
    assert "THE EDGE" not in app
    assert 'id="ai-progress"' in html
    assert 'aria-label="AI progress"' in html
    assert "status.ai_progress" in html
    assert 'href="/"' not in html
    assert PROFILE_RE.search(html) is None
    for word in PROFILE_WORDS:
        assert re.search(rf"\b{word}\b", html, re.I) is None
    assert CONFIG_PATH.is_file()
    assert clip("hello", 10) == "hello"
    assert clip("one two three", 10) == "one two…"


NEWS_PATHS = (
    "/news",
    "/news/",
    "/api/news",
    "/api/news/status",
    "/api/news/day",
    "/api/news/section",
    "/api/news/layout",
    "/api/news/vote",
    "/api/news/wake",
    "/api/news/forget",
)


def test_news_paths_are_only_the_paper():
    assert is_news_path("/news")
    assert is_news_path("/news/")
    assert is_news_path("/news/index.html")
    assert is_news_path("/api/news")
    assert is_news_path("/api/news/status")
    assert not is_news_path("/")
    assert not is_news_path("/api/health")
    assert not is_news_path("/api/solar")
    assert not is_news_path("/api/feed")
    assert not is_news_path("/synth/")
    assert not is_news_path("/crane-cab/")


def test_basic_auth_fails_closed_and_accepts_edge(monkeypatch):
    monkeypatch.delenv("NEWS_PASSWORD", raising=False)
    assert news_password() == ""
    assert news_basic_ok("Basic ZWRnZTpzZWNyZXQ=") is False  # edge:secret
    assert news_session_cookie() is None
    assert news_cookie_ok("dxedge_news=abc") is False
    monkeypatch.setenv("NEWS_PASSWORD", "secret")
    assert news_basic_ok(None) is False
    assert news_basic_ok("Basic bm9ib2R5OnNlY3JldA==") is False  # nobody:secret
    assert news_basic_ok("Basic ZWRnZTp3cm9uZw==") is False  # edge:wrong
    assert news_basic_ok("Bearer ZWRnZTpzZWNyZXQ=") is False
    token = news_session_cookie()
    assert token.startswith("dxedge_news=")
    assert "HttpOnly" in token and "Secure" in token and "Path=/api/news" in token
    assert news_credentials_ok(_basic("edge", "secret"), None)
    assert news_cookie_ok(token.split(";", 1)[0])
    assert news_cookie_ok("dxn=1; " + token.split(";", 1)[0])
    assert not news_cookie_ok("dxedge_news=nope")
    monkeypatch.setenv("NEWS_PASSWORD", "other")
    assert not news_cookie_ok(token.split(";", 1)[0])
    assert not news_basic_ok(_basic("edge", "secret"))


def _basic(user, password):
    import base64
    raw = base64.b64encode(f"{user}:{password}".encode()).decode()
    return f"Basic {raw}"


@pytest.fixture
def http(tmp_path, monkeypatch):
    dist = tmp_path / "dist"
    (dist / "news").mkdir(parents=True)
    (dist / "news" / "index.html").write_text("<!doctype html><title>The Edge</title><p>edition</p>", encoding="utf-8")
    (dist / "index.html").write_text("<!doctype html><title>DXEdge</title>", encoding="utf-8")
    monkeypatch.setenv("DXEDGE_DIST", str(dist))
    monkeypatch.setenv("DXEDGE_NEWS_DB", str(tmp_path / "news.db"))
    monkeypatch.setenv("NEWS_OWNER_FILE", str(tmp_path / "no-owner.json"))
    monkeypatch.setenv("NEWS_PASSWORD", "test-news-password")
    monkeypatch.delenv("XAI_API_KEY", raising=False)
    monkeypatch.delenv("GROK_API_KEY", raising=False)
    monkeypatch.delenv("NEWS_OWNER_SEED", raising=False)
    monkeypatch.delenv("NEWS_OWNER_READER", raising=False)
    newsdesk._api = None
    import main
    from fastapi.testclient import TestClient
    client = TestClient(main.app)
    yield client
    client.close()
    newsdesk._api = None


def _auth():
    return ("edge", "test-news-password")


def test_news_rejects_strangers(http):
    for path in NEWS_PATHS:
        res = http.get(path, follow_redirects=False)
        assert res.status_code in (401, 403), path
        assert "www-authenticate" in {k.lower() for k in res.headers}
        assert "cache-control" in {k.lower() for k in res.headers}
        assert "immutable" not in res.headers.get("cache-control", "").lower()
    for path, method in (
        ("/api/news/section", "post"),
        ("/api/news/layout", "post"),
        ("/api/news/vote", "post"),
        ("/api/news/wake", "post"),
        ("/api/news/forget", "post"),
    ):
        res = getattr(http, method)(path, json={})
        assert res.status_code in (401, 403), path
    page = http.get("/news/")
    assert "This paper is private." in page.text
    assert page.status_code == 401


def test_generation_does_not_run_without_auth(http, monkeypatch):
    calls = []

    async def fake(body, ip):
        calls.append((body, ip))
        return {"ok": True}

    monkeypatch.setattr(newsdesk, "open_section", fake)
    res = http.post("/api/news/section", json={"day": DAY, "id": "space", "wake": 1})
    assert res.status_code in (401, 403)
    assert calls == []
    bad = http.post(
        "/api/news/section",
        json={"day": DAY, "id": "space"},
        headers={"Authorization": _basic("edge", "nope")},
    )
    assert bad.status_code in (401, 403)
    assert calls == []
    minted = news_session_cookie()
    assert minted is not None
    stale = http.post(
        "/api/news/section",
        json={"day": DAY, "id": "space"},
        headers={"Cookie": "dxedge_news=not-the-token"},
    )
    assert stale.status_code in (401, 403)
    assert calls == []


def test_authenticated_requests_work_and_can_generate(http, monkeypatch):
    calls = []

    async def fake(body, ip):
        calls.append((body, ip))
        return {"ok": True, "highlights": []}

    monkeypatch.setattr(newsdesk, "open_section", fake)
    status = http.get("/api/news/status", auth=_auth())
    assert status.status_code == 200
    assert status.json()["paper"]
    assert status.headers["cache-control"] == "no-store"
    page = http.get("/news/", auth=_auth())
    assert page.status_code == 200
    assert "edition" in page.text
    cookie = page.headers.get("set-cookie", "")
    assert cookie.startswith("dxedge_news=")
    assert "HttpOnly" in cookie
    generated = http.post(
        "/api/news/section",
        json={"day": DAY, "id": "space", "wake": 1},
        auth=_auth(),
    )
    assert generated.status_code == 200
    assert generated.json()["ok"] is True
    assert len(calls) == 1
    via_cookie = http.get("/api/news/status", headers={"Cookie": cookie.split(";", 1)[0]})
    assert via_cookie.status_code == 200
    # An unknown path under the paper is still gated. It must not be a way
    # around the password, whatever the router would answer once signed in.
    missing = http.get("/api/news/does-not-exist", auth=_auth())
    assert missing.status_code != 401
    stranger = http.get("/api/news/does-not-exist")
    assert stranger.status_code in (401, 403)


def test_empty_password_locks_even_with_credentials(http, monkeypatch):
    monkeypatch.setenv("NEWS_PASSWORD", "")
    res = http.get("/api/news/status", auth=_auth())
    assert res.status_code in (401, 403)
    page = http.get("/news/", auth=("edge", "test-news-password"))
    assert page.status_code in (401, 403)
    assert "set-cookie" not in {k.lower() for k in page.headers}


def test_rest_of_the_site_stays_open(http):
    home = http.get("/")
    assert home.status_code == 200
    assert "DXEdge" in home.text
    assert "www-authenticate" not in {k.lower() for k in home.headers}
    health = http.get("/api/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"
    solar = http.get("/api/solar")
    assert solar.status_code != 401
