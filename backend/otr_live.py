"""Listenotr Radio listener heartbeat and optional per-episode intros.

The produced station-ID pack (jingle, generic IDs, "up next" lines, time-of-night
intros) is static and already on disk. This module is only the extra: a
"Tonight, on Suspense. {title}. Tune in." line for the episode that is about
to start.

That line is generated only when someone is tuned in during the short window
before the episode, and only if that episode has never been generated before.
The cache key is the episode id, so a repeat airing is free. With no
ELEVENLABS_API_KEY, or with nobody listening, the caller is told to play the
generic station ID instead. The key is read from the environment and is never
logged, interpolated into an error, or returned.
"""
import os
import re
import time
import logging
import threading

logger = logging.getLogger(__name__)

# How recently a heartbeat must have arrived to count as "tuned in".
LISTENER_WINDOW = 45
# Generate only in this many seconds before the scheduled start (and a few after).
LEAD_SECONDS = 90
GRACE_SECONDS = 15
# A listener who is on all day is about 48 new episodes. Cap new synthesis so a
# client cannot walk the catalog and run up a bill.
MAX_NEW_PER_DAY = 60

# Bill, the premade voice on the committed station pack. Episode intros use
# this id so they match the jingle and the up-next lines. It is a stock
# library voice, not a clone.
STOCK_VOICE_ID = "pqHfZKP75CvOlQylNhV4"
PREFERRED_PREMADE = ("Bill", "George", "Brian", "Daniel", "Clyde", "Charlie", "Callum", "Chris")

_lock = threading.Lock()
_listeners = {}  # session id -> last seen unix seconds
_new_today = {"day": "", "n": 0}


def pick_premade_voice(voices):
    """Choose one stock ElevenLabs voice. Cloned, professional, and generated
    voices are the caller's own and are never eligible. Bill's premade id wins
    when it is in the list, so a clone that happens to be named Bill does not."""
    premade = [v for v in (voices or []) if (v.get("category") or "") == "premade" and v.get("voice_id")]
    for voice in premade:
        if voice.get("voice_id") == STOCK_VOICE_ID:
            return voice
    by_name = {}
    for voice in premade:
        by_name.setdefault(voice.get("name") or "", voice)
    for name in PREFERRED_PREMADE:
        if name in by_name:
            return by_name[name]
    if premade:
        return premade[0]
    raise RuntimeError("No premade ElevenLabs voice is available. Cloned and custom voices are not used.")


# How a voice names this station. "O T R" is the spelled-out site
# (listen O T R dot com), not the abbreviation OTR.
SPOKEN_STATION = "Old Time Radio on listen O T R dot com"
_STATION_MARK = "\u0000"
_LISTENO_RADIO = re.compile(r"\bListenotr\s+Radio\b", re.IGNORECASE)
_LISTENO = re.compile(r"\bListenotr\b", re.IGNORECASE)
_OTR_DOTS = re.compile(r"\bO\s*\.\s*T\s*\.\s*R\b\.?", re.IGNORECASE)
_OTR_WORD = re.compile(r"\bOTR\b", re.IGNORECASE)
_SHORT_STATION = re.compile(r"\bold time radio\b", re.IGNORECASE)


def normalize_spoken(text):
    """Text about to be spoken. The station is SPOKEN_STATION.

    A phrase that already uses that form is left as-is, so the spaced
    letters in "listen O T R dot com" are not rewritten. Bare OTR, O.T.R.,
    Listenotr, and the short "old time radio" become the full form.
    """
    spoken = str(text or "")
    spoken = re.sub(re.escape(SPOKEN_STATION), _STATION_MARK, spoken, flags=re.IGNORECASE)
    spoken = _LISTENO_RADIO.sub(_STATION_MARK, spoken)
    spoken = _LISTENO.sub(_STATION_MARK, spoken)
    spoken = _OTR_DOTS.sub(_STATION_MARK, spoken)
    spoken = _OTR_WORD.sub(_STATION_MARK, spoken)
    spoken = _SHORT_STATION.sub(_STATION_MARK, spoken)
    spoken = spoken.replace(_STATION_MARK, SPOKEN_STATION)
    spoken = re.sub(r"[ \t]{2,}", " ", spoken)
    return spoken.strip()


def episode_intro_text(show, title):
    show = _clip(show, 80) or "the next show"
    title = _clip(title, 90)
    if title:
        line = "Tonight, on " + show + ". " + title + ". Tune in."
    else:
        line = "Tonight, on " + show + ". Tune in."
    return normalize_spoken(line)


def _clip(value, limit):
    text = re.sub(r"[\x00-\x1f]+", " ", str(value or ""))
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit]


def _session_ok(session):
    return isinstance(session, str) and 8 <= len(session) <= 64 and re.fullmatch(r"[A-Za-z0-9_-]+", session)


def note_listener(session, now=None):
    if not _session_ok(session):
        return
    now = time.time() if now is None else now
    with _lock:
        _listeners[session] = now
        _prune(now)


def listener_count(now=None):
    now = time.time() if now is None else now
    with _lock:
        _prune(now)
        return len(_listeners)


def _prune(now):
    dead = [sid for sid, seen in _listeners.items() if now - seen > LISTENER_WINDOW]
    for sid in dead:
        del _listeners[sid]


def _safe_ep(ep):
    ep = str(ep or "")
    if not re.fullmatch(r"[A-Za-z0-9._-]{3,80}", ep):
        return None
    if ".." in ep:
        return None
    return ep


def cache_dir():
    return os.environ.get("DXEDGE_OTR_INTRO_DIR") or os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "data", "otr-intros")


def cached_file(ep):
    ep = _safe_ep(ep)
    if not ep:
        return None
    path = os.path.join(cache_dir(), ep + ".mp3")
    root = os.path.realpath(cache_dir())
    real = os.path.realpath(path)
    if not real.startswith(root + os.sep):
        return None
    if os.path.isfile(real) and os.path.getsize(real) > 200:
        return real
    return None


def _budget_ok(now):
    day = time.strftime("%Y-%m-%d", time.gmtime(now))
    with _lock:
        if _new_today["day"] != day:
            _new_today["day"] = day
            _new_today["n"] = 0
        return _new_today["n"] < MAX_NEW_PER_DAY


def _budget_take(now):
    day = time.strftime("%Y-%m-%d", time.gmtime(now))
    with _lock:
        if _new_today["day"] != day:
            _new_today["day"] = day
            _new_today["n"] = 0
        _new_today["n"] += 1


def intro_for(body, now=None, generate=None):
    """Decide what the break should play.

    generate(text, ep) -> mp3 bytes, or None when synthesis is unavailable.
    It must not raise with the API key in the message; failures are counted
    by exception type only.
    """
    now = time.time() if now is None else now
    body = body or {}
    ep = _safe_ep(body.get("ep"))
    if not ep:
        return {"play": "ident", "reason": "bad-episode"}
    try:
        start = float(body.get("start"))
    except (TypeError, ValueError):
        return {"play": "ident", "reason": "bad-start"}
    if not (start - LEAD_SECONDS <= now <= start + GRACE_SECONDS):
        return {"play": "ident", "reason": "outside-window"}
    hit = cached_file(ep)
    if hit:
        return {"play": "intro", "url": "/api/otr/live/intro/" + ep, "cached": True}
    if listener_count(now) < 1:
        return {"play": "ident", "reason": "no-listeners"}
    if not _budget_ok(now):
        return {"play": "ident", "reason": "daily-cap"}
    if generate is None:
        generate = _generate_with_elevenlabs
    text = normalize_spoken(episode_intro_text(body.get("show"), body.get("title")))
    try:
        audio = generate(text, ep)
    except Exception as exc:
        logger.warning("otr live intro not generated (%s)", type(exc).__name__)
        return {"play": "ident", "reason": "tts-failed"}
    if not audio or len(audio) < 200:
        return {"play": "ident", "reason": "tts-empty"}
    _write_cache(ep, _normalize_level(audio))
    _budget_take(now)
    return {"play": "intro", "url": "/api/otr/live/intro/" + ep, "cached": False}


def _normalize_level(audio):
    """Raise a generated intro toward -16 LUFS, matching the shows.

    The static announcer pack is already leveled on disk. A fresh ElevenLabs
    file is not. If ffmpeg cannot read the bytes, they are stored unchanged.
    """
    if not audio or len(audio) < 200:
        return audio
    import subprocess
    import tempfile
    src = dst = None
    try:
        fd, src = tempfile.mkstemp(suffix=".mp3")
        os.close(fd)
        dst = src + ".norm.mp3"
        with open(src, "wb") as fh:
            fh.write(audio)
        subprocess.run(
            ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", src,
             "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
             "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "128k", dst],
            check=True, timeout=30,
        )
        with open(dst, "rb") as fh:
            out = fh.read()
        if len(out) > 200:
            return out
    except Exception:
        return audio
    finally:
        for path in (src, dst):
            if path:
                try:
                    os.remove(path)
                except OSError:
                    pass
    return audio


def _write_cache(ep, audio):
    folder = cache_dir()
    os.makedirs(folder, exist_ok=True)
    final = os.path.join(folder, ep + ".mp3")
    tmp = final + ".tmp"
    with open(tmp, "wb") as fh:
        fh.write(audio)
    os.replace(tmp, final)


def _generate_with_elevenlabs(text, ep):
    key = os.environ.get("ELEVENLABS_API_KEY") or ""
    if not key:
        return None
    import json
    import urllib.request
    voice = _premade_voice_id(key)
    payload = json.dumps({
        "text": normalize_spoken(text),
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {"stability": 0.45, "similarity_boost": 0.75},
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.elevenlabs.io/v1/text-to-speech/" + voice + "?output_format=mp3_44100_128",
        data=payload, method="POST",
        headers={"Content-Type": "application/json", "xi-api-key": key, "Accept": "audio/mpeg"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.read()
    except Exception as exc:
        # The status is useful. The exception text is not: some clients echo headers.
        status = getattr(exc, "code", None)
        logger.warning("otr live intro request failed (http %s)", status or type(exc).__name__)
        return None


def _premade_voice_id(key):
    # The pack was recorded with Bill. Intros stay on that same premade id
    # instead of asking the account which voice to use.
    del key
    return STOCK_VOICE_ID
