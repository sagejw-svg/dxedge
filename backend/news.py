"""
The Edge, the on-demand newspaper at /news.

Nothing is generated on a schedule. A section is written the first time
someone opens it, then stored, so the next visitor gets it immediately.
Fourteen days with no clicks and the desk stops calling the model until
someone opens the paper again.

The model wire is xAI's Responses API with web search when XAI_API_KEY
(or GROK_API_KEY) is set. With no key the desk returns a stub and does
not invent stories and does not cache the stub.

Comics that are still in copyright are links or official frames only.
xkcd, Pepper & Carrot, and pre-1929 public-domain pages may be shown,
with a source and license line.

A seed reorders the boxes and highlights already on the desk. It never
asks for more copy. One seed number, read only from the server
environment or /data/news_owner.json, follows a single reader's votes.
That number is never put in a response.

The HTTP routes that call into this module require basic auth before
they get here. The username is edge. The password is NEWS_PASSWORD.
When that variable is empty, every request is refused.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import re
import sqlite3
import threading
import urllib.parse
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from ratelimit import RateLimiter

logger = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).with_name("news_config.json")
PAPER_TZ = ZoneInfo("America/Los_Angeles")
DORMANT_DAYS = 14
SEED_MAX = 1_000_000_000
USER_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
TARGET_RE = re.compile(r"^[A-Za-z0-9:._-]{1,80}$")
DAY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TOPIC_RE = re.compile(r"^[a-z0-9-]{1,32}$")
SLUG_RE = re.compile(r"^[a-z0-9-]+$")
HAM_RE = re.compile(r"\b(ham radio|amateur radio)\b", re.I)
BIO_BAD = re.compile(
    r"(\b(incubate|transfect|electroporat|pipette|grna|guide rna|plasmid|"
    r"codon[- ]optim|restriction enzyme|pcr mix|synthesis protocol)\b|"
    r"[ACGTUacgtu]{24,})",
    re.I,
)
WEIRD_BAD = re.compile(
    r"\b(overthrow the government|vote for|the election was stolen|"
    r"deep state cabal)\b",
    re.I,
)
EXPLOIT_RE = re.compile(
    r"\b(shellcode|metasploit|proof-of-concept exploit|write an exploit)\b",
    re.I,
)
MONEY_BAD = re.compile(r"\b(you should buy|guaranteed return|wire the funds)\b", re.I)
CANCER_ADVICE = re.compile(
    r"\b(you should (take|start|stop)|recommended dose|"
    r"\d+\s*mg per day|this (cures|will cure)|guaranteed remission)\b",
    re.I,
)
# The lead box is extra. These fourteen are the paper.
REQUIRED_SECTIONS = (
    "comics", "ai-editorial", "biology", "cancer", "education", "sleep",
    "ai-security", "cyber", "company", "money", "life", "space", "weird", "world",
)
PROFILE_RE = re.compile(
    r"\b(sailing|sailors?|ranch|synths?|synthesizers?|recodes?|"
    r"prediction markets?|weekend sailor|from the desk)\b",
    re.I,
)
BIO_SAFE = (
    "Researchers and lawmakers are debating gene editing and synthetic biology "
    "in public. This note stays at that level: what changed, why it matters, "
    "and which rules apply. It does not describe how to build or alter an organism."
)
IMG_HOSTS = {
    "xkcd": ("imgs.xkcd.com",),
    "pepper": ("www.peppercarrot.com", "peppercarrot.com"),
    "commons": ("upload.wikimedia.org",),
}
FETCH_HOSTS = {
    "xkcd.com", "www.xkcd.com", "imgs.xkcd.com",
    "www.peppercarrot.com", "peppercarrot.com",
    "commons.wikimedia.org", "upload.wikimedia.org",
    "www.gocomics.com", "comicskingdom.com",
}
VOTE_KINDS = {"liked", "useful", "hide"}
KIND_WEIGHT = {"liked": 1, "useful": 2, "hide": -2}
# One-shot cache repair. Response-wide citations were stored as untitled
# "Source" links on every highlight. These two sections regenerate; the
# rest of the cache only loses those placeholder links.
SOURCE_LEAK_MIGRATION = "2026-10-20-highlight-source-leak"
SOURCE_LEAK_DAY = "2026-10-20"
SOURCE_LEAK_SECTIONS = ("ai-editorial", "sleep")
LAYOUT_KEYS = {"day", "show", "more", "coming_soon", "order", "shelf", "hidden", "mine"}

_config_cache: dict | None = None
_config_mtime: float | None = None


class NewsError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


class LCG:
    """Small deterministic generator. Same seed, same paper, on any Python."""

    def __init__(self, seed: int):
        self.x = (int(seed) + 1) & 0xFFFFFFFF

    def __call__(self) -> float:
        self.x = (1664525 * self.x + 1013904223) & 0xFFFFFFFF
        return self.x / 4294967296


def load_config(path: Path | None = None) -> dict:
    global _config_cache, _config_mtime
    path = Path(path or CONFIG_PATH)
    mtime = path.stat().st_mtime
    if _config_cache is not None and path == CONFIG_PATH and mtime == _config_mtime:
        return _config_cache
    data = json.loads(path.read_text(encoding="utf-8"))
    _validate_config(data)
    if path == CONFIG_PATH:
        _config_cache = data
        _config_mtime = mtime
    return data


def _validate_config(data: dict) -> None:
    ids = [s["id"] for s in data["sections"]]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate section id")
    if "ai-world" not in ids or "world" not in ids:
        raise ValueError("lead and world sections are required")
    missing = [sid for sid in REQUIRED_SECTIONS if sid not in ids]
    if missing:
        raise ValueError("paper is missing a section")
    if PROFILE_RE.search(json.dumps(data)):
        raise ValueError("paper config profiles a person")
    for s in data["sections"]:
        blob = f"{s['id']} {s.get('title','')} {s.get('brief','')}".lower()
        if "ham radio" in blob or "amateur radio" in blob or "dilbert" in blob:
            raise ValueError("section config crosses a hard rule")
        if s["id"] == "picks":
            raise ValueError("picks is not a section of this paper")
        if s["id"] in REQUIRED_SECTIONS and s.get("coming_soon"):
            raise ValueError(f"section {s['id']} must be open")
        if not s.get("coming_soon") and not s.get("prompt"):
            raise ValueError(f"section {s['id']} needs a prompt")
    examples = data["example_seeds"]
    if not 5 <= len(examples) <= 8:
        raise ValueError("example seeds must be 5 to 8")
    labels, seeds = set(), set()
    for ex in examples:
        label = ex["label"].strip()
        if label.lower() in labels or ex["seed"] in seeds:
            raise ValueError("example seeds must be unique")
        if re.search(r"\b(child|kid|kids|teen|toddler|owner|james)\b", label, re.I):
            raise ValueError("example label is not a general adult persona")
        labels.add(label.lower())
        seeds.add(ex["seed"])
        if not isinstance(ex["seed"], int) or not 0 <= ex["seed"] <= SEED_MAX:
            raise ValueError("example seed out of range")
    strip_ids = []
    for strip in data["strips"]:
        blob = json.dumps(strip).lower()
        if "dilbert" in blob:
            raise ValueError("dilbert is excluded")
        if not SLUG_RE.fullmatch(strip["slug"]):
            raise ValueError("bad strip slug")
        if strip["host"] not in ("gocomics", "comicskingdom"):
            raise ValueError("unknown comic host")
        if strip["frame"] not in ("try", "never"):
            raise ValueError("bad frame mode")
        if strip["host"] == "comicskingdom" and strip["frame"] != "never":
            raise ValueError("Comics Kingdom strips are link only")
        strip_ids.append(strip["id"])
    if len(strip_ids) != len(set(strip_ids)):
        raise ValueError("duplicate strip")
    if "calvin" not in strip_ids or "hagar" not in strip_ids:
        raise ValueError("calvin and hagar are required")
    for classic in data["classics"]:
        if int(classic["year"]) >= 1929:
            raise ValueError("classic is not pre-1929")
    xkcd_skip = data["xkcd"]["skip_title"]
    re.compile(xkcd_skip)


def section_map(config: dict | None = None) -> dict[str, dict]:
    config = config or load_config()
    return {s["id"]: s for s in config["sections"]}


def public_section(sec: dict) -> dict:
    return {
        "id": sec["id"],
        "title": sec["title"],
        "kicker": sec.get("kicker") or "",
        "brief": sec.get("brief") or "",
        "lead": bool(sec.get("lead")),
        "coming_soon": bool(sec.get("coming_soon")),
        "shelf": bool(sec.get("shelf")),
    }


def preamble() -> str:
    return (
        "You write one section of a general-audience daily newspaper for adults. "
        "Nothing aimed at children. No sexual content and no gore. "
        "Be concise and decision-oriented. Two or three highlights. "
        "Each highlight has a title of at most 12 words, a one-sentence dek, "
        "a body of at most 90 words, one to three topic tags, and one or more "
        "https sources that support that highlight alone. "
        "Cite reputable reporting, a paper, or an official page, and use the page title. "
        "Do not attach unrelated pages, search leftovers, or another highlight's sources. "
        "Omit a URL you cannot title. Never title a source \"Source\". "
        "No walls of text. "
        "Where AI progress genuinely changes the story, say so in one clause. "
        "Do not invent an AI connection. "
        "ai_progress is optional: one sentence of at most 25 words when the item "
        "is a real step in what AI can do or a real change in how people use it. "
        "Otherwise leave ai_progress as an empty string. "
        "Never write about amateur radio or ham radio, call signs, or radio contesting. "
        "Never name a site owner, a publisher, a patient, or any employer. "
        "Do not identify a person. No financial advice and no trading instructions. "
        "Conspiracy and mystery items are light curiosity: not anti-government, "
        "not partisan, and not offensive. "
        "Biology, if this section touches it, is an explainer and a legal or ethical "
        "framing only. No protocols, no sequences, no lab steps, no synthesis method, "
        "and no how-to for designing or building an organism. "
        "Security items stay at defender briefing level. No exploit steps and no payloads. "
        "Return JSON only, no markdown, in this shape: "
        '{"highlights":[{"title":"","dek":"","body":"","topics":[""],'
        '"ai_progress":"","sources":[{"title":"Page title","url":"https://"}]}'
    )


def build_prompt(section: dict, day: str, topic_bias: list[tuple[str, int]]) -> tuple[str, str]:
    lines = [
        f"Edition date: {day}.",
        f"Section: {section['title']}.",
        section.get("prompt") or "",
    ]
    liked = [name for name, score in topic_bias if score > 0][:8]
    if liked:
        lines.append(
            "Readers have favored these topics. Prefer them when they genuinely "
            "fit this section: " + ", ".join(liked) + "."
        )
    lines.append(
        "Use recent, real reporting. Every highlight needs its own titled https "
        "sources. Do not add links that are not about that highlight."
    )
    return preamble(), "\n".join(lines)


def clip(text: str, limit: int) -> str:
    text = " ".join((text or "").split())
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0]
    return (cut or text[:limit]).rstrip(".,;:") + "…"


def parse_model_json(text: str) -> dict:
    raw = (text or "").strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    start, end = raw.find("{"), raw.rfind("}")
    if start < 0 or end <= start:
        raise NewsError(502, "The desk returned nothing usable.")
    try:
        data = json.loads(raw[start:end + 1])
    except json.JSONDecodeError as e:
        raise NewsError(502, "The desk returned nothing usable.") from e
    if not isinstance(data, dict) or not isinstance(data.get("highlights"), list):
        raise NewsError(502, "The desk returned nothing usable.")
    return data


def extract_completion(data: dict) -> tuple[str, list[str]]:
    citations: list[str] = []

    def add(url: str | None) -> None:
        if isinstance(url, str) and url.startswith("https://") and url not in citations:
            citations.append(url)

    for c in data.get("citations") or []:
        if isinstance(c, str):
            add(c)
        elif isinstance(c, dict):
            add(c.get("url"))
    texts: list[str] = []
    for item in data.get("output") or []:
        if not isinstance(item, dict):
            continue
        content = item.get("content")
        if isinstance(content, str):
            texts.append(content)
        elif isinstance(content, list):
            for part in content:
                if not isinstance(part, dict):
                    continue
                if part.get("text"):
                    texts.append(part["text"])
                for ann in part.get("annotations") or []:
                    if not isinstance(ann, dict):
                        continue
                    add(ann.get("url"))
                    cited = ann.get("url_citation")
                    if isinstance(cited, dict):
                        add(cited.get("url"))
    if not texts and isinstance(data.get("output_text"), str):
        texts.append(data["output_text"])
    choices = data.get("choices") or []
    if not texts and choices and isinstance(choices[0], dict):
        msg = choices[0].get("message") or {}
        if isinstance(msg.get("content"), str):
            texts.append(msg["content"])
    return "\n".join(texts).strip(), citations


def _source_title(raw) -> str:
    """A link label a reader can use. The placeholder 'Source' is not one."""
    text = " ".join(str(raw or "").split())
    if not text or text.casefold() == "source":
        return ""
    return clip(text, 140)


def _sources(items) -> list[dict]:
    """Sources this highlight named, titled and de-duplicated.

    Response-wide web_search citations are not added here. They are not
    this highlight's sources, and labeling them 'Source' pasted the same
    unrelated links onto every item in the section.
    """
    out = []
    seen = set()
    for item in items or []:
        if not isinstance(item, dict):
            continue
        url = item.get("url")
        if not isinstance(url, str) or not url.startswith("https://") or len(url) > 400:
            continue
        if url in seen:
            continue
        title = _source_title(item.get("title"))
        if not title:
            continue
        seen.add(url)
        out.append({"title": title, "url": url})
        if len(out) >= 4:
            break
    return out


def _clean_cached_payload(payload: dict) -> bool:
    highlights = payload.get("highlights")
    if not isinstance(highlights, list):
        return False
    changed = False
    for item in highlights:
        if not isinstance(item, dict):
            continue
        before = item.get("sources")
        cleaned = _sources(before)
        if cleaned != (before or []):
            item["sources"] = cleaned
            changed = True
    return changed


def scrub_highlight(section_id: str, raw: dict, _citations: list[str] | None = None) -> dict | None:
    # ``_citations`` is every web_search URL on the xAI response. Do not attach
    # them: each highlight keeps only the sources it listed.
    if not isinstance(raw, dict):
        return None
    title = clip(str(raw.get("title") or ""), 140)
    dek = clip(str(raw.get("dek") or ""), 240)
    body = clip(str(raw.get("body") or ""), 800)
    if not title:
        return None
    topics = []
    for topic in raw.get("topics") or []:
        t = str(topic).strip().lower()
        if TOPIC_RE.fullmatch(t) and t not in topics:
            topics.append(t)
        if len(topics) >= 3:
            break
    note = clip(str(raw.get("ai_progress") or ""), 180)
    text = f"{title} {dek} {body} {note}"
    if HAM_RE.search(text) or PROFILE_RE.search(text):
        return None
    if section_id == "weird" and WEIRD_BAD.search(text):
        return None
    if section_id in {"ai-security", "cyber", "company"} and EXPLOIT_RE.search(text):
        return None
    if section_id == "money" and MONEY_BAD.search(text):
        return None
    if section_id == "cancer" and CANCER_ADVICE.search(text):
        return None
    if section_id == "biology" and BIO_BAD.search(text):
        body = BIO_SAFE
        dek = "An explainer, not a procedure."
        note = ""
    sources = _sources(raw.get("sources"))
    if not sources:
        return None
    out = {
        "title": title,
        "dek": dek,
        "body": body,
        "topics": topics,
        "sources": sources,
    }
    if note:
        out["ai_progress"] = note
    return out


def framing_allowed(headers: dict) -> bool:
    lowered = {str(k).lower(): str(v) for k, v in (headers or {}).items()}
    xfo = lowered.get("x-frame-options", "").lower()
    if "deny" in xfo or "sameorigin" in xfo:
        return False
    csp = lowered.get("content-security-policy", "").lower()
    if "frame-ancestors" not in csp:
        return True
    clause = csp.split("frame-ancestors", 1)[1].split(";", 1)[0]
    if "'none'" in clause or re.search(r"(^|\s)none(\s|$)", clause):
        return False
    return "*" in clause or "dxedge.net" in clause


def strip_page_url(strip: dict, day: str) -> str:
    year, month, dom = day.split("-")
    slug = strip["slug"]
    if strip["host"] == "gocomics":
        return f"https://www.gocomics.com/{slug}/{year}/{month}/{dom}"
    return f"https://comicskingdom.com/{slug}/{day}"


def safe_frame_url(strip: dict, url: str, allowed: bool) -> str | None:
    if strip.get("frame") == "never" or not allowed:
        return None
    parts = urllib.parse.urlparse(url)
    if parts.scheme != "https":
        return None
    if strip["host"] == "gocomics" and parts.netloc == "www.gocomics.com":
        return url
    if strip["host"] == "comicskingdom" and parts.netloc == "comicskingdom.com":
        return url
    return None


def accept_image(url: str, kind: str) -> bool:
    if not isinstance(url, str) or not url.startswith("https://"):
        return False
    host = urllib.parse.urlparse(url).netloc.lower()
    if host.endswith("gocomics.com") or "comicskingdom.com" in host:
        return False
    return host in IMG_HOSTS.get(kind, ())


def pepper_image_urls(name: str) -> dict | None:
    match = re.fullmatch(r"ep(\d+)_([A-Za-z0-9-]+)", name or "")
    if not match:
        return None
    num = int(match.group(1))
    base = f"https://www.peppercarrot.com/0_sources/{name}/low-res"
    stem = f"en_Pepper-and-Carrot_by-David-Revoy_E{num:02d}"
    cover = f"{base}/{stem}.jpg"
    page = f"{base}/{stem}P01.jpg"
    if not (accept_image(cover, "pepper") and accept_image(page, "pepper")):
        return None
    return {"cover": cover, "page": page, "episode": num, "name": name}


def xkcd_skipped(comic: dict, pattern: re.Pattern) -> bool:
    if not isinstance(comic, dict):
        return True
    blob = " ".join(str(comic.get(k) or "") for k in ("title", "alt", "transcript", "news"))
    if pattern.search(blob):
        return True
    return not accept_image(str(comic.get("img") or ""), "xkcd")


def commons_api_url(filename: str) -> str:
    query = urllib.parse.urlencode({
        "action": "query",
        "titles": f"File:{filename}",
        "prop": "imageinfo",
        "iiprop": "url|extmetadata",
        "format": "json",
    })
    return "https://commons.wikimedia.org/w/api.php?" + query


def parse_commons(data: dict) -> tuple[str, str] | None:
    pages = ((data or {}).get("query") or {}).get("pages") or {}
    if not isinstance(pages, dict) or not pages:
        return None
    page = next(iter(pages.values()))
    info = (page.get("imageinfo") or [None])[0] or {}
    url = info.get("url") or ""
    license_name = ((info.get("extmetadata") or {}).get("LicenseShortName") or {}).get("value") or ""
    if not url:
        return None
    return url, license_name


def public_domain(license_name: str) -> bool:
    name = (license_name or "").lower()
    return "public domain" in name or name in {"pd", "cc0"}


def classic_for_day(classics: list[dict], day: str) -> dict | None:
    usable = [c for c in classics if int(c["year"]) < 1929]
    if not usable:
        return None
    ordinal = datetime.strptime(day, "%Y-%m-%d").date().toordinal()
    return usable[ordinal % len(usable)]


def host_allowed(url: str) -> bool:
    host = urllib.parse.urlparse(url).netloc.lower()
    return host in FETCH_HOSTS


def parse_seed(value) -> int | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool) or isinstance(value, float):
        raise NewsError(400, "Seed must be a whole number.")
    if isinstance(value, str):
        if not value.isdigit():
            raise NewsError(400, "Seed must be a whole number.")
        value = int(value)
    if not isinstance(value, int) or not 0 <= value <= SEED_MAX:
        raise NewsError(400, "Seed must be a whole number.")
    return value


def parse_user(value) -> str | None:
    if value is None or value == "":
        return None
    if not isinstance(value, str) or not USER_RE.fullmatch(value):
        raise NewsError(400, "Reader id must be an anonymous id.")
    return value


def owner_secret() -> tuple[int | None, str | None]:
    """Server-only. Never copied into a response, a log line, or the page."""
    seed = (os.environ.get("NEWS_OWNER_SEED") or "").strip()
    reader = (os.environ.get("NEWS_OWNER_READER") or "").strip()
    path = os.environ.get("NEWS_OWNER_FILE") or "/data/news_owner.json"
    if (not seed or not reader) and os.path.isfile(path):
        try:
            data = json.loads(Path(path).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            data = {}
        if not seed and data.get("seed") is not None:
            seed = str(data.get("seed")).strip()
        if not reader and data.get("reader"):
            reader = str(data.get("reader")).strip()
    seed_num = None
    if seed.isdigit():
        number = int(seed)
        if 0 <= number <= SEED_MAX:
            seed_num = number
    reader_id = reader if USER_RE.fullmatch(reader or "") else None
    return seed_num, reader_id


def persona_weights(seed: int, section_ids: list[str], topics: list[str]) -> tuple[dict, dict]:
    rng = LCG(seed)
    sections = {sid: rng() for sid in section_ids}
    topic_weights = {topic: rng() for topic in topics}
    return sections, topic_weights


def blend(base: dict, signals: dict, t: float) -> dict:
    """Move weights that have vote signal. Leave the rest on the persona."""
    out = {}
    for key, value in base.items():
        if key in signals:
            out[key] = (1 - t) * value + t * signals[key]
        else:
            out[key] = value
    return out


def vote_mix(n: int) -> float:
    if n <= 0:
        return 0.0
    return min(0.7, n / (n + 24.0))


def shift_unit(scores: dict, keys: list[str]) -> dict:
    if not scores:
        return {}
    vals = [scores.get(k, 0.0) for k in keys]
    lo, hi = min(vals), max(vals)
    span = (hi - lo) or 1.0
    return {k: (scores.get(k, 0.0) - lo) / span for k in keys}


class Store:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self._lock = threading.Lock()

    def connect(self) -> sqlite3.Connection:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(self.path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

    def init(self) -> None:
        with self._lock, self.connect() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS sections (
                    day TEXT NOT NULL,
                    section TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    generated_at TEXT NOT NULL,
                    provider TEXT NOT NULL,
                    PRIMARY KEY (day, section)
                );
                CREATE TABLE IF NOT EXISTS activity (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    last_click TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS readers (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS votes (
                    user_id TEXT NOT NULL,
                    target_id TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    section TEXT,
                    topic TEXT,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (user_id, target_id, kind)
                );
                CREATE TABLE IF NOT EXISTS frames (
                    strip_id TEXT PRIMARY KEY,
                    allowed INTEGER NOT NULL,
                    checked_at TEXT NOT NULL
                );
            """)
            self._repair_source_leak(conn)

    def _repair_source_leak(self, conn) -> None:
        """Clear the edition that repeated unrelated 'Source' links.

        Runs once. Cached highlights elsewhere drop untitled 'Source'
        entries and duplicate URLs. The 2026-10-20 AI editorial and
        narcolepsy sections are deleted so the next open writes them again.
        """
        conn.execute("CREATE TABLE IF NOT EXISTS migrations (id TEXT PRIMARY KEY)")
        if conn.execute(
            "SELECT 1 FROM migrations WHERE id = ?",
            (SOURCE_LEAK_MIGRATION,),
        ).fetchone():
            return
        rows = conn.execute("SELECT day, section, payload FROM sections").fetchall()
        for row in rows:
            if row["day"] == SOURCE_LEAK_DAY and row["section"] in SOURCE_LEAK_SECTIONS:
                continue
            try:
                payload = json.loads(row["payload"])
            except json.JSONDecodeError:
                continue
            if isinstance(payload, dict) and _clean_cached_payload(payload):
                conn.execute(
                    "UPDATE sections SET payload = ? WHERE day = ? AND section = ?",
                    (json.dumps(payload), row["day"], row["section"]),
                )
        conn.execute(
            "DELETE FROM sections WHERE day = ? AND section IN (?, ?)",
            (SOURCE_LEAK_DAY, *SOURCE_LEAK_SECTIONS),
        )
        conn.execute(
            "INSERT INTO migrations (id) VALUES (?)",
            (SOURCE_LEAK_MIGRATION,),
        )

    def last_click(self) -> datetime | None:
        with self.connect() as conn:
            row = conn.execute("SELECT last_click FROM activity WHERE id = 1").fetchone()
        if not row:
            return None
        return datetime.fromisoformat(row["last_click"])

    def touch(self, when: datetime) -> None:
        iso = when.astimezone(timezone.utc).isoformat()
        with self._lock, self.connect() as conn:
            conn.execute(
                "INSERT INTO activity (id, last_click) VALUES (1, ?) "
                "ON CONFLICT(id) DO UPDATE SET last_click = excluded.last_click",
                (iso,),
            )

    def dormant(self, when: datetime) -> bool:
        last = self.last_click()
        if last is None:
            return False
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        return (when - last) >= timedelta(days=DORMANT_DAYS)

    def get_section(self, day: str, section: str) -> dict | None:
        with self.connect() as conn:
            row = conn.execute(
                "SELECT payload, generated_at, provider FROM sections WHERE day = ? AND section = ?",
                (day, section),
            ).fetchone()
        if not row:
            return None
        payload = json.loads(row["payload"])
        payload["generated_at"] = row["generated_at"]
        payload["provider"] = row["provider"]
        return payload

    def put_section(self, day: str, section: str, payload: dict, provider: str, when: datetime) -> None:
        body = json.dumps(payload)
        iso = when.astimezone(timezone.utc).isoformat()
        with self._lock, self.connect() as conn:
            conn.execute(
                "INSERT INTO sections (day, section, payload, generated_at, provider) VALUES (?, ?, ?, ?, ?) "
                "ON CONFLICT(day, section) DO UPDATE SET payload = excluded.payload, "
                "generated_at = excluded.generated_at, provider = excluded.provider",
                (day, section, body, iso, provider),
            )

    def ready_map(self) -> dict[str, list[str]]:
        with self.connect() as conn:
            rows = conn.execute("SELECT day, section FROM sections").fetchall()
        out: dict[str, list[str]] = {}
        for row in rows:
            out.setdefault(row["day"], []).append(row["section"])
        return out

    def ensure_reader(self, user_id: str, when: datetime) -> None:
        iso = when.astimezone(timezone.utc).isoformat()
        with self._lock, self.connect() as conn:
            conn.execute(
                "INSERT INTO readers (id, created_at) VALUES (?, ?) ON CONFLICT(id) DO NOTHING",
                (user_id, iso),
            )

    def toggle_vote(self, user_id: str, target_id: str, kind: str,
                    section: str, topic: str, when: datetime) -> bool:
        iso = when.astimezone(timezone.utc).isoformat()
        with self._lock, self.connect() as conn:
            self._ensure_reader_conn(conn, user_id, iso)
            existing = conn.execute(
                "SELECT 1 FROM votes WHERE user_id = ? AND target_id = ? AND kind = ?",
                (user_id, target_id, kind),
            ).fetchone()
            if existing:
                conn.execute(
                    "DELETE FROM votes WHERE user_id = ? AND target_id = ? AND kind = ?",
                    (user_id, target_id, kind),
                )
                return False
            conn.execute(
                "INSERT INTO votes (user_id, target_id, kind, section, topic, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (user_id, target_id, kind, section, topic, iso),
            )
            return True

    def _ensure_reader_conn(self, conn, user_id: str, iso: str) -> None:
        conn.execute(
            "INSERT INTO readers (id, created_at) VALUES (?, ?) ON CONFLICT(id) DO NOTHING",
            (user_id, iso),
        )

    def counts(self, target_id: str) -> dict:
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT kind, COUNT(*) AS n FROM votes WHERE target_id = ? GROUP BY kind",
                (target_id,),
            ).fetchall()
        out = {"liked": 0, "useful": 0, "hide": 0}
        for row in rows:
            if row["kind"] in out:
                out[row["kind"]] = row["n"]
        return out

    def target_score(self, target_id: str) -> int:
        counts = self.counts(target_id)
        return sum(KIND_WEIGHT[k] * counts[k] for k in KIND_WEIGHT)

    def score_map(self) -> dict[str, int]:
        with self.connect() as conn:
            rows = conn.execute("SELECT target_id, kind FROM votes").fetchall()
        scores: dict[str, int] = {}
        for row in rows:
            scores[row["target_id"]] = scores.get(row["target_id"], 0) + KIND_WEIGHT.get(row["kind"], 0)
        return scores

    def mine(self, user_id: str, target_id: str) -> dict:
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT kind FROM votes WHERE user_id = ? AND target_id = ?",
                (user_id, target_id),
            ).fetchall()
        have = {row["kind"] for row in rows}
        return {kind: kind in have for kind in ("liked", "useful", "hide")}

    def mine_map(self, user_id: str, target_ids: set[str]) -> dict:
        if not user_id or not target_ids:
            return {}
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT target_id, kind FROM votes WHERE user_id = ?",
                (user_id,),
            ).fetchall()
        out: dict[str, dict] = {}
        for row in rows:
            if row["target_id"] not in target_ids:
                continue
            bucket = out.setdefault(row["target_id"], {"liked": False, "useful": False, "hide": False})
            if row["kind"] in bucket:
                bucket[row["kind"]] = True
        return out

    def hides(self, user_id: str) -> set[str]:
        if not user_id:
            return set()
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT target_id FROM votes WHERE user_id = ? AND kind = 'hide'",
                (user_id,),
            ).fetchall()
        return {row["target_id"] for row in rows}

    def topic_scores(self) -> list[tuple[str, int]]:
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT topic, kind FROM votes WHERE topic IS NOT NULL AND topic != ''"
            ).fetchall()
        scores: dict[str, int] = {}
        for row in rows:
            scores[row["topic"]] = scores.get(row["topic"], 0) + KIND_WEIGHT.get(row["kind"], 0)
        return sorted(scores.items(), key=lambda item: (-item[1], item[0]))

    def grouped_scores(self, column: str, user_id: str | None = None) -> dict[str, float]:
        if column not in ("section", "topic"):
            raise ValueError(column)
        sql = f"SELECT {column} AS key, kind FROM votes WHERE {column} IS NOT NULL AND {column} != ''"
        args: tuple = ()
        if user_id:
            sql += " AND user_id = ?"
            args = (user_id,)
        with self.connect() as conn:
            rows = conn.execute(sql, args).fetchall()
        scores: dict[str, float] = {}
        for row in rows:
            scores[row["key"]] = scores.get(row["key"], 0) + KIND_WEIGHT.get(row["kind"], 0)
        return scores

    def vote_volume(self) -> int:
        with self.connect() as conn:
            row = conn.execute("SELECT COUNT(*) AS n FROM votes").fetchone()
        return int(row["n"])

    def forget(self, user_id: str) -> None:
        with self._lock, self.connect() as conn:
            conn.execute("DELETE FROM votes WHERE user_id = ?", (user_id,))
            conn.execute("DELETE FROM readers WHERE id = ?", (user_id,))

    def frame_get(self, strip_id: str, now: datetime) -> bool | None:
        with self.connect() as conn:
            row = conn.execute(
                "SELECT allowed, checked_at FROM frames WHERE strip_id = ?",
                (strip_id,),
            ).fetchone()
        if not row:
            return None
        checked = datetime.fromisoformat(row["checked_at"])
        if checked.tzinfo is None:
            checked = checked.replace(tzinfo=timezone.utc)
        if now - checked > timedelta(days=7):
            return None
        return bool(row["allowed"])

    def frame_put(self, strip_id: str, allowed: bool, now: datetime) -> None:
        iso = now.astimezone(timezone.utc).isoformat()
        with self._lock, self.connect() as conn:
            conn.execute(
                "INSERT INTO frames (strip_id, allowed, checked_at) VALUES (?, ?, ?) "
                "ON CONFLICT(strip_id) DO UPDATE SET allowed = excluded.allowed, "
                "checked_at = excluded.checked_at",
                (strip_id, 1 if allowed else 0, iso),
            )


class XAIProvider:
    name = "xai"

    def __init__(self, key: str | None = None, model: str | None = None, base: str | None = None):
        if key is None:
            key = os.environ.get("XAI_API_KEY") or os.environ.get("GROK_API_KEY") or ""
        self.key = key.strip()
        self.model = model or os.environ.get("XAI_MODEL") or "grok-4.7"
        self.base = (base or os.environ.get("XAI_API_BASE") or "https://api.x.ai/v1").rstrip("/")

    @property
    def ready(self) -> bool:
        return bool(self.key)

    async def complete(self, system: str, user: str) -> dict:
        if not self.ready:
            raise NewsError(503, "XAI_API_KEY")
        import aiohttp
        payload = {
            "model": self.model,
            "input": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "tools": [{"type": "web_search"}],
        }
        timeout = aiohttp.ClientTimeout(total=45)
        url = self.base + "/responses"
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(
                url,
                json=payload,
                headers={"Authorization": f"Bearer {self.key}", "Content-Type": "application/json"},
            ) as resp:
                body = await resp.text()
                if resp.status >= 400:
                    logger.warning("news model http %s", resp.status)
                    raise NewsError(502, "The desk could not reach the wire.")
        try:
            return json.loads(body)
        except json.JSONDecodeError as e:
            raise NewsError(502, "The desk could not reach the wire.") from e


class LiveNet:
    async def get_json(self, url: str) -> dict:
        if not host_allowed(url):
            raise NewsError(400, "That source is not on the desk list.")
        import aiohttp
        timeout = aiohttp.ClientTimeout(total=8)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url, headers={"User-Agent": "DXEdgeNews/1.0"}) as resp:
                if resp.status >= 400:
                    raise NewsError(502, "A comic source did not answer.")
                return await resp.json(content_type=None)

    async def headers(self, url: str) -> dict:
        if not host_allowed(url):
            raise NewsError(400, "That source is not on the desk list.")
        import aiohttp
        timeout = aiohttp.ClientTimeout(total=6)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            try:
                async with session.head(url, allow_redirects=True) as resp:
                    if resp.status < 400:
                        return {k.lower(): v for k, v in resp.headers.items()}
            except Exception:
                pass
            async with session.get(url, allow_redirects=True) as resp:
                # A bot wall or error page is not a strip we can frame.
                # The shelf still shows the official link card.
                if resp.status >= 400:
                    raise NewsError(502, "A comic source did not answer.")
                return {k.lower(): v for k, v in resp.headers.items()}


class SystemClock:
    def now(self) -> datetime:
        return datetime.now(timezone.utc)


class Paper:
    def __init__(self, store: Store, provider, net, clock=None,
                 gen_limiter: RateLimiter | None = None,
                 vote_limiter: RateLimiter | None = None):
        self.store = store
        self.provider = provider
        self.net = net
        self.clock = clock or SystemClock()
        self.gen_limiter = gen_limiter or RateLimiter(12, 3600)
        self.vote_limiter = vote_limiter or RateLimiter(40, 3600)

    def now(self) -> datetime:
        current = self.clock.now()
        if current.tzinfo is None:
            current = current.replace(tzinfo=timezone.utc)
        return current

    def today(self) -> str:
        return self.now().astimezone(PAPER_TZ).date().isoformat()

    def _check_day(self, day: str) -> None:
        if not isinstance(day, str) or not DAY_RE.fullmatch(day):
            raise NewsError(400, "Day must look like a date.")
        try:
            parsed = datetime.strptime(day, "%Y-%m-%d").date()
        except ValueError as e:
            raise NewsError(400, "Day must look like a date.") from e
        today = datetime.strptime(self.today(), "%Y-%m-%d").date()
        if parsed > today or (today - parsed).days > 13:
            raise NewsError(400, "That day is outside this paper.")

    def _section(self, sid: str) -> dict:
        sec = section_map().get(sid)
        if not sec:
            raise NewsError(404, "Unknown section.")
        return sec

    def status(self) -> dict:
        self.store.init()
        config = load_config()
        ready = self.ready_days(config)
        secret, _reader = owner_secret()
        examples = [
            {"seed": ex["seed"], "label": ex["label"]}
            for ex in config["example_seeds"]
            if ex["seed"] != secret
        ]
        provider = {
            "name": self.provider.name if self.provider.ready else "unset",
            "ready": bool(self.provider.ready),
            "needed_secret": None if self.provider.ready else "XAI_API_KEY",
        }
        last = self.store.last_click()
        return {
            "paper": config["paper"],
            "dormant": self.store.dormant(self.now()),
            "last_click": last.astimezone(timezone.utc).isoformat() if last else None,
            "today": self.today(),
            "provider": provider,
            "sections": [public_section(s) for s in config["sections"]],
            "examples": examples,
            "days": ready,
            "ai_progress": self.progress_notes(),
        }

    def progress_notes(self) -> list[dict]:
        """Short notes already stored on highlights. Reading them does not generate."""
        config = load_config()
        order = {s["id"]: i for i, s in enumerate(config["sections"])}
        today = datetime.strptime(self.today(), "%Y-%m-%d").date()
        window = {(today - timedelta(days=offset)).isoformat() for offset in range(DORMANT_DAYS)}
        notes = []
        for day, sids in self.store.ready_map().items():
            if day not in window:
                continue
            for sid in sids:
                payload = self.store.get_section(day, sid) or {}
                for h in payload.get("highlights") or []:
                    note = h.get("ai_progress") or ""
                    if not isinstance(note, str) or not note.strip():
                        continue
                    if PROFILE_RE.search(note) or HAM_RE.search(note):
                        continue
                    url = ""
                    sources = h.get("sources") or []
                    if sources and isinstance(sources[0], dict):
                        raw = sources[0].get("url") or ""
                        if isinstance(raw, str) and raw.startswith("https://"):
                            url = raw
                    notes.append({
                        "day": day,
                        "section": sid,
                        "title": h.get("title") or "",
                        "note": note.strip(),
                        "url": url,
                    })
        notes.sort(key=lambda n: (
            -datetime.strptime(n["day"], "%Y-%m-%d").toordinal(),
            order.get(n["section"], 99),
        ))
        return notes

    def ready_days(self, config: dict | None = None) -> list[dict]:
        config = config or load_config()
        today = datetime.strptime(self.today(), "%Y-%m-%d").date()
        have = self.store.ready_map()
        days = []
        for offset in range(14):
            day = (today - timedelta(days=offset)).isoformat()
            lead = ""
            payload = self.store.get_section(day, "ai-world")
            if payload and payload.get("highlights"):
                lead = payload["highlights"][0].get("title") or ""
            days.append({"day": day, "ready": have.get(day, []), "lead": lead})
        return days

    def wake(self) -> dict:
        self.store.init()
        self.store.touch(self.now())
        return self.status()

    def read_day(self, day: str, wake: bool = False) -> dict:
        self.store.init()
        self._check_day(day)
        if self.store.dormant(self.now()) and not wake:
            return {"day": day, "dormant": True, "sections": {}}
        if wake:
            self.store.touch(self.now())
        else:
            self.store.touch(self.now())
        sections = {}
        for sec in load_config()["sections"]:
            if sec.get("coming_soon"):
                continue
            payload = self.store.get_section(day, sec["id"])
            if payload:
                sections[sec["id"]] = self.decorate(sec["id"], payload, None)
        return {"day": day, "dormant": False, "sections": sections}

    def decorate(self, sid: str, payload: dict, user_id: str | None) -> dict:
        config = load_config()
        sec = section_map(config)[sid]
        out = {
            "day": payload.get("day"),
            "section": public_section(sec),
            "cached": True,
            "stub": bool(payload.get("stub")),
            "dormant": False,
            "coming_soon": False,
            "generated_at": payload.get("generated_at"),
            "needed_secret": payload.get("needed_secret"),
            "highlights": [],
        }
        for h in payload.get("highlights") or []:
            item = dict(h)
            note = item.get("ai_progress") or ""
            if not isinstance(note, str) or PROFILE_RE.search(note) or HAM_RE.search(note):
                item.pop("ai_progress", None)
            item["votes"] = self.store.counts(item["id"])
            if user_id:
                item["mine"] = self.store.mine(user_id, item["id"])
            out["highlights"].append(item)
        if sid == "comics":
            scores = self.store.score_map()
            shelf = []
            for strip in payload.get("shelf") or []:
                card = dict(strip)
                card["votes"] = self.store.counts(card["id"])
                card["score"] = card.get("base_rank", 0) + scores.get(card["id"], 0)
                if user_id:
                    card["mine"] = self.store.mine(user_id, card["id"])
                shelf.append(card)
            shelf.sort(key=lambda card: (-card["score"], card.get("order", 0)))
            out["shelf"] = shelf
            inline = []
            for comic in payload.get("inline") or []:
                card = dict(comic)
                card["votes"] = self.store.counts(card["id"])
                if user_id:
                    card["mine"] = self.store.mine(user_id, card["id"])
                inline.append(card)
            out["inline"] = inline
        return out

    async def open_section(self, day: str, sid: str, ip: str, user_id: str | None, wake: bool) -> dict:
        self.store.init()
        sec = self._section(sid)
        self._check_day(day)
        if sec.get("coming_soon"):
            return {
                "day": day,
                "section": public_section(sec),
                "coming_soon": True,
                "dormant": False,
                "cached": False,
                "stub": False,
                "highlights": [],
            }
        if self.store.dormant(self.now()) and not wake:
            return {
                "day": day,
                "section": public_section(sec),
                "dormant": True,
                "cached": False,
                "stub": False,
                "coming_soon": False,
                "highlights": [],
            }
        self.store.touch(self.now())
        cached = self.store.get_section(day, sid)
        if cached:
            return self.decorate(sid, cached, user_id)
        if sid == "comics":
            payload = await self.build_comics(day)
            self.store.put_section(day, sid, payload, "shelf", self.now())
            stored = self.store.get_section(day, sid)
            decorated = self.decorate(sid, stored, user_id)
            decorated["cached"] = False
            return decorated
        if not self.provider.ready:
            return self.stub(day, sec)
        allowed, retry = self.gen_limiter.is_allowed(ip or "unknown")
        if not allowed:
            raise NewsError(429, f"Too many sections. Try again in {retry}s.")
        system, user = build_prompt(sec, day, self.store.topic_scores())
        data = await self.provider.complete(system, user)
        text, citations = extract_completion(data)
        parsed = parse_model_json(text)
        highlights = []
        for raw in parsed["highlights"]:
            if len(highlights) >= 3:
                break
            clean = scrub_highlight(sid, raw, citations)
            if clean:
                highlights.append(clean)
        if not highlights:
            highlights = [{
                "title": "Held at the desk",
                "dek": "This edition did not pass the desk's checks.",
                "body": "Nothing from this pass was published. Open the section again tomorrow.",
                "topics": [],
                "sources": [],
            }]
        for i, item in enumerate(highlights):
            item["id"] = f"{day}:{sid}:{i}"
        payload = {"day": day, "highlights": highlights, "stub": False}
        self.store.put_section(day, sid, payload, self.provider.name, self.now())
        stored = self.store.get_section(day, sid)
        decorated = self.decorate(sid, stored, user_id)
        decorated["cached"] = False
        return decorated

    def stub(self, day: str, sec: dict) -> dict:
        return {
            "day": day,
            "section": public_section(sec),
            "cached": False,
            "stub": True,
            "dormant": False,
            "coming_soon": False,
            "needed_secret": "XAI_API_KEY",
            "highlights": [{
                "id": f"{day}:{sec['id']}:stub",
                "title": "This desk is waiting on a key",
                "dek": "Set XAI_API_KEY on the backend to generate this section.",
                "body": (
                    "Nothing was sent to a model and nothing was invented. "
                    "Add the secret XAI_API_KEY, an xAI Grok API key, to the backend "
                    "environment and open this section again. A finished section is cached "
                    "for the next visitor."
                ),
                "topics": ["setup"],
                "sources": [],
                "votes": {"liked": 0, "useful": 0, "hide": 0},
            }],
        }

    async def build_comics(self, day: str) -> dict:
        config = load_config()
        pattern = re.compile(config["xkcd"]["skip_title"], re.I)
        frames = await self._frames(config["strips"], day)
        shelf = []
        for order, strip in enumerate(config["strips"]):
            url = strip_page_url(strip, day)
            allowed = frames.get(strip["id"], False)
            frame_url = safe_frame_url(strip, url, allowed)
            shelf.append({
                "id": strip["id"],
                "name": strip["name"],
                "url": url,
                "home": strip["home"],
                "host_label": "GoComics" if strip["host"] == "gocomics" else "Comics Kingdom",
                "frame": frame_url is not None,
                "frame_url": frame_url,
                "favorite": bool(strip.get("favorite")),
                "base_rank": int(strip.get("base_rank") or 0),
                "order": order,
            })
        inline = []
        xkcd = await self._xkcd(config, pattern)
        if xkcd:
            inline.append(xkcd)
        pepper = await self._pepper(config)
        if pepper:
            inline.append(pepper)
        classic = await self._classic(config, day)
        if classic:
            inline.append(classic)
        return {"day": day, "highlights": [], "shelf": shelf, "inline": inline, "stub": False}

    async def _frames(self, strips: list[dict], day: str) -> dict[str, bool]:
        out = {}
        for strip in strips:
            if strip.get("frame") == "never":
                out[strip["id"]] = False
                continue
            cached = self.store.frame_get(strip["id"], self.now())
            if cached is not None:
                out[strip["id"]] = cached
                continue
            url = strip_page_url(strip, day)
            try:
                headers = await self.net.headers(url)
                allowed = framing_allowed(headers)
            except Exception:
                allowed = False
            self.store.frame_put(strip["id"], allowed, self.now())
            out[strip["id"]] = allowed
        return out

    async def _xkcd(self, config: dict, pattern: re.Pattern) -> dict | None:
        url = "https://xkcd.com/info.0.json"
        comic = None
        for _ in range(4):
            try:
                comic = await self.net.get_json(url)
            except Exception:
                return None
            if not xkcd_skipped(comic, pattern):
                break
            try:
                num = int(comic.get("num")) - 1
            except (TypeError, ValueError):
                return None
            if num < 1:
                return None
            url = f"https://xkcd.com/{num}/info.0.json"
            comic = None
        if not comic or xkcd_skipped(comic, pattern):
            return None
        num = int(comic["num"])
        meta = config["xkcd"]
        return {
            "id": f"xkcd-{num}",
            "kind": "xkcd",
            "title": clip(str(comic.get("title") or "xkcd"), 140),
            "img": comic["img"],
            "alt": clip(str(comic.get("alt") or ""), 400),
            "page": f"https://xkcd.com/{num}/",
            "credit": meta["credit"],
            "license": meta["license"],
            "license_url": meta["license_url"],
            "source": meta["home"],
        }

    async def _pepper(self, config: dict) -> dict | None:
        meta = config["peppercarrot"]
        try:
            index = await self.net.get_json(meta["index"])
        except Exception:
            return None
        if not isinstance(index, list) or not index:
            return None
        episode = index[-1]
        if not isinstance(episode, dict):
            return None
        languages = episode.get("translated_languages") or []
        if "en" not in languages:
            return None
        urls = pepper_image_urls(episode.get("name") or "")
        if not urls:
            return None
        return {
            "id": f"pepper-{urls['episode']}",
            "kind": "peppercarrot",
            "title": episode["name"].split("_", 1)[-1].replace("-", " "),
            "img": urls["cover"],
            "pages": [urls["cover"], urls["page"]],
            "page": meta["home"],
            "credit": meta["credit"],
            "license": meta["license"],
            "license_url": meta["license_url"],
            "source": meta["home"],
        }

    async def _classic(self, config: dict, day: str) -> dict | None:
        entry = classic_for_day(config["classics"], day)
        if not entry:
            return None
        try:
            data = await self.net.get_json(commons_api_url(entry["file"]))
        except Exception:
            return None
        parsed = parse_commons(data)
        if not parsed:
            return None
        url, license_name = parsed
        if not public_domain(license_name) or not accept_image(url, "commons"):
            return None
        return {
            "id": entry["id"],
            "kind": "commons",
            "title": entry["title"],
            "img": url,
            "page": entry["page"],
            "credit": entry["credit"],
            "license": "Public domain",
            "license_url": "https://creativecommons.org/publicdomain/mark/1.0/",
            "source": entry["page"],
        }

    def layout(self, day: str, seed: int | None, user_id: str | None) -> dict:
        self.store.init()
        self._check_day(day)
        config = load_config()
        sections = [s for s in config["sections"] if not s.get("coming_soon")]
        soon = [s["id"] for s in config["sections"] if s.get("coming_soon")]
        ids = [s["id"] for s in sections]
        index = {s["id"]: i for i, s in enumerate(config["sections"])}
        section_w, topic_w = self._weights(seed, ids, config["topics"])
        ranked = sorted(ids, key=lambda sid: (-section_w.get(sid, 0), index[sid]))
        lead = next((s["id"] for s in sections if s.get("lead")), None)
        rest = [sid for sid in ranked if sid != lead]
        show_n = int(config.get("show_count") or 8)
        body = rest[:show_n]
        show = ([lead] if lead else []) + body
        more = rest[show_n:]
        order = {}
        targets = set()
        for sid in show + more:
            payload = self.store.get_section(day, sid)
            if not payload:
                continue
            highlights = payload.get("highlights") or []
            order[sid] = self._order_highlights(highlights, topic_w, user_id)
            targets.update(h["id"] for h in highlights)
        shelf = []
        comics = self.store.get_section(day, "comics")
        if comics:
            decorated = self.decorate("comics", comics, None)
            hidden = self.store.hides(user_id)
            shelf = [card["id"] for card in decorated["shelf"] if card["id"] not in hidden]
            targets.update(card["id"] for card in decorated["shelf"])
            targets.update(card["id"] for card in decorated.get("inline") or [])
        hidden_ids = sorted(self.store.hides(user_id))
        mine = self.store.mine_map(user_id, targets) if user_id else {}
        return {
            "day": day,
            "show": show,
            "more": more,
            "coming_soon": soon,
            "order": order,
            "shelf": shelf,
            "hidden": hidden_ids,
            "mine": mine,
        }

    def _weights(self, seed: int | None, ids: list[str], topics: list[str]) -> tuple[dict, dict]:
        config = load_config()
        content = [s for s in config["sections"] if not s.get("coming_soon")]
        base = {s["id"]: float(len(content) - i) for i, s in enumerate(content)}
        topic_w = {topic: 0.0 for topic in topics}
        secret, reader = owner_secret()
        if seed is not None and secret is not None and seed == secret and reader:
            owned_s = self.store.grouped_scores("section", reader)
            owned_t = self.store.grouped_scores("topic", reader)
            if owned_s or owned_t:
                base = shift_unit(owned_s, ids) or base
                topic_w = shift_unit(owned_t, topics) or topic_w
        elif seed is not None:
            base, topic_w = persona_weights(seed, ids, topics)
        n = self.store.vote_volume()
        t = vote_mix(n)
        if t:
            agg_s = shift_unit(self.store.grouped_scores("section"), ids)
            agg_t = shift_unit(self.store.grouped_scores("topic"), topics)
            # Only sections and topics that actually have votes should move.
            present_s = self.store.grouped_scores("section")
            present_t = self.store.grouped_scores("topic")
            base = blend(base, {k: agg_s[k] for k in present_s if k in agg_s}, t)
            topic_w = blend(topic_w, {k: agg_t[k] for k in present_t if k in agg_t}, t)
        return base, topic_w

    def _order_highlights(self, highlights: list[dict], topic_w: dict, user_id: str | None) -> list[str]:
        hidden = self.store.hides(user_id)
        scored = []
        for i, h in enumerate(highlights):
            vote = self.store.target_score(h["id"])
            topic_score = sum(topic_w.get(t, 0) for t in h.get("topics") or [])
            scored.append((-(vote + topic_score), i, h["id"]))
        scored.sort()
        return [hid for _score, _i, hid in scored if hid not in hidden]

    def cast_vote(self, user_id: str, target_id: str, kind: str, day: str,
                  section: str, ip: str) -> dict:
        self.store.init()
        user_id = parse_user(user_id)
        if not user_id:
            raise NewsError(400, "Reader id must be an anonymous id.")
        if not isinstance(target_id, str) or not TARGET_RE.fullmatch(target_id):
            raise NewsError(400, "Unknown story.")
        if kind not in VOTE_KINDS:
            raise NewsError(400, "Vote must be liked, useful, or hide.")
        self._check_day(day)
        sec = self._section(section)
        if sec.get("coming_soon"):
            raise NewsError(400, "That section is not open.")
        topic = self._topic_for(day, section, target_id)
        allowed, retry = self.vote_limiter.is_allowed(ip or "unknown")
        if not allowed:
            raise NewsError(429, f"Too many votes. Try again in {retry}s.")
        on = self.store.toggle_vote(user_id, target_id, kind, section, topic, self.now())
        self.store.touch(self.now())
        counts = self.store.counts(target_id)
        return {"target_id": target_id, "on": on, "votes": counts, "mine": self.store.mine(user_id, target_id)}

    def _topic_for(self, day: str, section: str, target_id: str) -> str:
        config = load_config()
        if any(s["id"] == target_id for s in config["strips"]):
            return target_id
        if target_id.startswith("xkcd-") or target_id.startswith("pepper-") or target_id.startswith("nemo-"):
            return "comics"
        payload = self.store.get_section(day, section)
        if payload:
            for h in payload.get("highlights") or []:
                if h.get("id") == target_id and h.get("topics"):
                    return h["topics"][0]
        return section

    def forget_reader(self, user_id: str) -> dict:
        self.store.init()
        user_id = parse_user(user_id)
        if not user_id:
            raise NewsError(400, "Reader id must be an anonymous id.")
        self.store.forget(user_id)
        return {"forgotten": True}


# HTTP basic auth for /news and /api/news. The username is edge.
# NEWS_PASSWORD empty means locked: strangers and authenticated-looking
# requests are both refused, and nothing below is asked to generate.
NEWS_AUTH_USER = "edge"
_NEWS_COOKIE = "dxedge_news"
_NEWS_COOKIE_PATH = "/api/news"


def news_password() -> str:
    return (os.environ.get("NEWS_PASSWORD") or "").strip()


def is_news_page(path: str) -> bool:
    return path == "/news" or path.startswith("/news/")


def is_news_api(path: str) -> bool:
    return path == "/api/news" or path.startswith("/api/news/")


def is_news_path(path: str) -> bool:
    return is_news_page(path) or is_news_api(path)


def _basic_parts(header: str | None) -> tuple[str, str] | None:
    if not header:
        return None
    scheme, _, param = header.strip().partition(" ")
    if scheme.lower() != "basic" or not param.strip():
        return None
    try:
        decoded = base64.b64decode(param.strip(), validate=True)
    except Exception:
        return None
    try:
        text = decoded.decode("utf-8")
    except UnicodeDecodeError:
        return None
    user, sep, password = text.partition(":")
    if not sep:
        return None
    return user, password


def _password_digest(user: str, password: str) -> bytes:
    return hashlib.sha256(b"\0".join([user.encode("utf-8"), password.encode("utf-8")])).digest()


def news_basic_ok(header: str | None) -> bool:
    """True only for user edge and the current NEWS_PASSWORD.

    An empty password never matches, including a request that sends an
    empty password. The digest compare does not reveal which half failed.
    """
    expected = news_password()
    if not expected:
        return False
    parts = _basic_parts(header)
    if parts is None:
        return False
    user, password = parts
    got = _password_digest(user, password)
    want = _password_digest(NEWS_AUTH_USER, expected)
    return hmac.compare_digest(got, want)


def news_session_token() -> str | None:
    """Proof of the same password, so /api/news requests can proceed after
    the browser has signed in at /news/. Browsers keep basic credentials on
    the /news/ path and do not attach them to /api/news/. The token is not
    a second password and is useless when NEWS_PASSWORD is empty.
    """
    password = news_password()
    if not password:
        return None
    return hmac.new(password.encode("utf-8"), b"dxedge-news-v1", hashlib.sha256).hexdigest()


def news_session_cookie() -> str | None:
    token = news_session_token()
    if not token:
        return None
    return (
        f"{_NEWS_COOKIE}={token}; HttpOnly; Secure; SameSite=Strict; "
        f"Path={_NEWS_COOKIE_PATH}; Max-Age=1209600"
    )


def _cookie_value(header: str | None, name: str) -> str:
    if not header:
        return ""
    for part in header.split(";"):
        key, sep, value = part.strip().partition("=")
        if sep and key == name:
            return value.strip()
    return ""


def news_cookie_ok(cookie_header: str | None) -> bool:
    expected = news_session_token()
    if not expected:
        return False
    got = _cookie_value(cookie_header, _NEWS_COOKIE)
    if not got:
        return False
    return hmac.compare_digest(got, expected)


def news_credentials_ok(authorization: str | None, cookie_header: str | None) -> bool:
    if news_basic_ok(authorization):
        return True
    return news_cookie_ok(cookie_header)


_api: Paper | None = None


def db_path() -> str:
    return os.environ.get("DXEDGE_NEWS_DB") or "/data/news.db"


def get_api() -> Paper:
    global _api
    if _api is None:
        _api = Paper(Store(db_path()), XAIProvider(), LiveNet())
    return _api


def init_db() -> None:
    try:
        get_api().store.init()
    except Exception as e:
        logger.warning("news db init failed: %s", e)


def status() -> dict:
    return get_api().status()


def wake() -> dict:
    return get_api().wake()


def read_day(day: str, wake_flag: bool = False) -> dict:
    return get_api().read_day(day, wake_flag)


async def open_section(body: dict, ip: str) -> dict:
    day = body.get("day")
    sid = body.get("id")
    user_id = parse_user(body.get("user_id")) if body.get("user_id") else None
    wake_flag = bool(body.get("wake"))
    if not isinstance(sid, str):
        raise NewsError(404, "Unknown section.")
    return await get_api().open_section(day, sid, ip, user_id, wake_flag)


def layout(body: dict) -> dict:
    day = body.get("day")
    seed = parse_seed(body.get("seed"))
    user_id = parse_user(body.get("user_id")) if body.get("user_id") else None
    result = get_api().layout(day, seed, user_id)
    if set(result) != LAYOUT_KEYS:
        raise NewsError(500, "Layout failed.")
    return result


def cast_vote(body: dict, ip: str) -> dict:
    return get_api().cast_vote(
        body.get("user_id"), body.get("target_id"), body.get("kind"),
        body.get("day"), body.get("section"), ip,
    )


def forget_reader(body: dict) -> dict:
    return get_api().forget_reader(body.get("user_id"))
