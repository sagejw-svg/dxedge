"""The Edge newspaper: on-demand sections, legal comics, votes, seeds."""
import asyncio
import json
import os
import sys
import threading
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from ratelimit import RateLimiter
from news import (
    BIO_SAFE, CANCER_SAFE, CONFIG_PATH, LAYOUT_KEYS, LCG, LIFE_TITLE, LiveNet,
    NewsError, Paper, REQUIRED_LIVE, Store, XAIProvider, accept_image, blend,
    build_prompt, classic_for_day, clip, commons_api_url, extract_completion,
    framing_allowed, load_config, owner_secret, parse_commons, parse_model_json,
    parse_seed, parse_user, pepper_image_urls, persona_weights, preamble,
    public_domain, public_section, safe_frame_url, scrub_highlight, section_map,
    strip_page_url, vote_mix, xkcd_skipped, _validate_config,
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

    def __init__(self, highlights=None, ready=True, extra=None):
        self.ready = ready
        self.calls = 0
        self.last = None
        self.extra = extra or {}
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
        body = {"highlights": self.highlights}
        body.update(self.extra)
        return {"output_text": json.dumps(body)}


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


def test_config_is_the_paper():
    cfg = load_config()
    ids = [s["id"] for s in cfg["sections"]]
    by_id = {s["id"]: s for s in cfg["sections"]}
    assert ids[0] == "ai-world"
    assert by_id["ai-world"]["lead"] is True
    assert "world" in ids
    assert len(REQUIRED_LIVE) == 14
    for sid in REQUIRED_LIVE:
        assert sid in by_id
        assert not by_id[sid].get("coming_soon")
        assert by_id[sid].get("prompt")
    assert not any(s.get("coming_soon") for s in cfg["sections"])
    assert by_id["life"]["title"] == LIFE_TITLE
    assert by_id["cybersecurity"]["title"] == "Cybersecurity"
    assert by_id["ai-security"]["prompt"] != by_id["cybersecurity"]["prompt"]
    assert "cancer" in ids and "education" in ids and "cybersecurity" in ids
    assert "ham" not in ids
    blob = json.dumps(cfg).lower()
    assert "dilbert" not in blob
    assert "ham radio" not in blob
    assert "james" not in blob
    assert "k6wrj" not in blob
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
                 "Biology buff", "Retired tinkerer", "Weird-news fan"):
        assert name in labels
    bad = json.loads(json.dumps(cfg))
    bad["strips"].append({
        "id": "dilbert", "name": "Dilbert", "host": "gocomics", "slug": "dilbert",
        "home": "https://www.gocomics.com/dilbert", "frame": "never", "base_rank": 0,
    })
    with pytest.raises(ValueError):
        _validate_config(bad)
    stubbed = json.loads(json.dumps(cfg))
    cancer = next(s for s in stubbed["sections"] if s["id"] == "cancer")
    cancer["coming_soon"] = True
    cancer.pop("prompt", None)
    with pytest.raises(ValueError):
        _validate_config(stubbed)


def test_prompts_carry_the_hard_rules():
    head = preamble()
    assert "Where AI progress" in head
    assert "ham radio" in head.lower()
    assert "protocols" in head.lower()
    assert "employer" in head.lower()
    assert "children" in head.lower()
    for sec in load_config()["sections"]:
        if sec.get("coming_soon"):
            assert "prompt" not in public_section(sec)
            continue
        system, user = build_prompt(sec, DAY, [("space", 3)])
        assert system == head
        assert "space" in user
        assert "18421" not in system + user
    assert "Cybercab" in build_prompt(section_map()["world"], DAY, [])[1]
    assert "Roadster" in build_prompt(section_map()["world"], DAY, [])[1]
    assert "anonymous" in build_prompt(section_map()["sleep"], DAY, [])[1].lower()
    assert "anti-government" in build_prompt(section_map()["weird"], DAY, [])[1].lower()
    assert "employer" in build_prompt(section_map()["company"], DAY, [])[1].lower()
    cancer_user = build_prompt(section_map()["cancer"], DAY, [])[1].lower()
    assert "medical advice" in cancer_user and "patient" in cancer_user
    assert "teaching" in build_prompt(section_map()["education"], DAY, [])[1].lower()
    cyber_user = build_prompt(section_map()["cybersecurity"], DAY, [])[1].lower()
    ai_sec_user = build_prompt(section_map()["ai-security"], DAY, [])[1].lower()
    assert "attack" in cyber_user
    assert cyber_user != ai_sec_user
    assert '"progress"' in build_prompt(section_map()["ai-world"], DAY, [])[1]
    assert '"progress"' not in build_prompt(section_map()["space"], DAY, [])[1]
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
        "topics": ["security"], "sources": [],
    }, []) is None
    assert scrub_highlight("cybersecurity", {
        "title": "Bug", "dek": "Here is shellcode.", "body": "Run it.",
        "topics": ["cyber"], "sources": [],
    }, []) is None
    cancer = scrub_highlight("cancer", {
        "title": "This patient got a new dose",
        "dek": "You should take 40 mg.",
        "body": "A treatment protocol, told as a patient story.",
        "topics": ["cancer"],
        "sources": [{"title": "Journal", "url": "https://www.nature.com/articles/example"}],
    }, [])
    assert cancer["body"] == CANCER_SAFE
    assert cancer["title"] == "Cancer research, at explainer level"
    assert "patient" not in cancer["title"].lower()
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
    assert paper.status()["days"][0]["progress"] == ""
    assert paper.provider.calls == 0


def test_ai_progress_is_captured_from_the_lead_call(paper):
    paper.provider.extra = {"progress": "Models took a clearer step on planning."}
    opened = asyncio.run(paper.open_section(DAY, "ai-world", "1.1.1.1", None, False))
    assert paper.provider.calls == 1
    assert opened["ai_progress"] == "Models took a clearer step on planning."
    today = next(d for d in paper.status()["days"] if d["day"] == DAY)
    assert today["progress"] == "Models took a clearer step on planning."
    again = asyncio.run(paper.open_section(DAY, "ai-world", "1.1.1.1", None, False))
    assert again["cached"] is True
    assert again["ai_progress"] == opened["ai_progress"]
    assert paper.provider.calls == 1
    space = asyncio.run(paper.open_section(DAY, "space", "1.1.1.1", None, False))
    assert "ai_progress" not in space
    assert paper.provider.calls == 2


def test_ai_progress_falls_back_inside_the_same_response(paper):
    paper.provider.highlights = [{
        "title": "A planning step",
        "dek": "Models planned a longer task.",
        "body": "Readers can wait for the writeup.",
        "topics": ["ai"],
        "sources": [{"title": "Wire", "url": "https://www.nasa.gov/example"}],
    }]
    opened = asyncio.run(paper.open_section(DAY, "ai-world", "1.1.1.1", None, False))
    assert paper.provider.calls == 1
    assert opened["ai_progress"] == "Models planned a longer task."


def test_ai_progress_drops_a_forbidden_line(paper):
    paper.provider.extra = {"progress": "Ham radio nets got an AI tool."}
    paper.provider.highlights = [{
        "title": "A planning step",
        "dek": "Models planned a longer task.",
        "body": "Readers can wait for the writeup.",
        "topics": ["ai"],
        "sources": [{"title": "Wire", "url": "https://www.nasa.gov/example"}],
    }]
    opened = asyncio.run(paper.open_section(DAY, "ai-world", "1.1.1.1", None, False))
    assert opened["ai_progress"] == "Models planned a longer task."
    assert "ham" not in opened["ai_progress"].lower()
    paper.provider.extra = {"progress": "Here is shellcode for the new model."}
    paper.store.touch(paper.now())
    other = asyncio.run(paper.open_section("2026-10-16", "ai-world", "1.1.1.1", None, False))
    assert other["ai_progress"] == "Models planned a longer task."
    assert paper.provider.calls == 2


def test_dormant_paper_does_not_mint_a_progress_line(paper):
    paper.store.touch(paper.now() - timedelta(days=15))
    paper.provider.extra = {"progress": "Should not be stored."}
    blocked = asyncio.run(paper.open_section(DAY, "ai-world", "1.1.1.1", None, False))
    assert blocked["dormant"] is True
    assert paper.provider.calls == 0
    assert paper.status()["days"][0]["progress"] == ""
    assert paper.provider.calls == 0


def test_required_sections_are_live_and_day_window_holds(paper, monkeypatch):
    opened = asyncio.run(paper.open_section(DAY, "cancer", "1.1.1.1", None, False))
    assert opened["coming_soon"] is False
    assert opened["stub"] is False
    edu = asyncio.run(paper.open_section(DAY, "education", "1.1.1.1", None, False))
    assert edu["section"]["title"] == "Education"
    cyber = asyncio.run(paper.open_section(DAY, "cybersecurity", "1.1.1.1", None, False))
    assert cyber["section"]["title"] == "Cybersecurity"
    assert paper.provider.calls == 3
    with pytest.raises(NewsError):
        asyncio.run(paper.open_section("2026-10-18", "space", "1.1.1.1", None, False))
    with pytest.raises(NewsError):
        asyncio.run(paper.open_section("2026-10-03", "space", "1.1.1.1", None, False))
    assert paper.provider.calls == 3
    real = section_map()
    stub = dict(real)
    stub["later"] = {"id": "later", "title": "Later", "coming_soon": True, "brief": "Later."}
    monkeypatch.setattr("news.section_map", lambda config=None: stub)
    soon = asyncio.run(paper.open_section(DAY, "later", "1.1.1.1", None, False))
    assert soon["coming_soon"] is True
    assert paper.provider.calls == 3


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
    assert plain["show"][1] == "world"
    assert plain["coming_soon"] == []
    for sid in ("cancer", "education", "cybersecurity"):
        assert sid in plain["show"] or sid in plain["more"]
    assert seeded["show"] != other["show"] or seeded["more"] != other["more"]
    assert "owner" not in json.dumps(seeded).lower()
    assert "james" not in json.dumps(seeded).lower()


def test_example_seeds_match_their_labels():
    cfg = load_config()
    ids = [s["id"] for s in cfg["sections"] if not s.get("coming_soon")]
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
    picks, pick_topics = top(by_label["Retired tinkerer"])
    assert picks[0] == "picks" and pick_topics[0] in ("synth", "games")
    security, security_topics = top(by_label["Security lead"])
    assert security[0] == "ai-security" and security_topics[0] == "security"
    sailor, sailor_topics = top(by_label["Weekend sailor"])
    assert sailor[0] == "picks" and sailor_topics[0] == "sailing"


def test_status_publishes_example_personas(paper):
    status = paper.status()
    examples = status["examples"]
    assert 5 <= len(examples) <= 8
    labels = [ex["label"] for ex in examples]
    for name in ("Space nerd", "College freshman", "Startup founder",
                 "Biology buff", "Retired tinkerer", "Weird-news fan"):
        assert name in labels
    blob = json.dumps(examples).lower()
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
    assert 'id="thread"' in html
    assert "AI progress" in html
    assert "day.progress" in html
    assert 'aria-label="Example readers"' in html
    assert 'class: "chip"' in html
    assert "status.examples" in html
    assert "Space nerd" not in html
    assert "CACHE_NAME = 'dxedge-v101'" in sw
    assert "url.pathname.startsWith('/news/')" in sw
    assert "location ^~ /news/" in nginx
    assert "XAI_API_KEY" in compose
    assert "NEWS_OWNER_SEED" in compose
    deploy = (ROOT / ".github/workflows/deploy.yml").read_text(encoding="utf-8")
    assert "secrets.XAI_API_KEY" in deploy
    assert "envs: XAI_API_KEY" in deploy
    assert "unset XAI_API_KEY" in deploy
    assert 'echo "$XAI_API_KEY"' not in deploy
    assert "echo ${XAI_API_KEY}" not in deploy
    for path in ("/api/news/status", "/api/news/day", "/api/news/section",
                 "/api/news/layout", "/api/news/vote", "/api/news/wake", "/api/news/forget"):
        assert path in main
    assert 'Cache-Control": "no-store"' in main or "no-store" in main
    assert "/news/" in app
    assert CONFIG_PATH.is_file()
    assert clip("hello", 10) == "hello"
    assert clip("one two three", 10) == "one two…"
