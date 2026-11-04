#!/usr/bin/env python3
"""One-time Listenotr Radio asset pack.

Produces a 1940s station-ID jingle (ElevenLabs music) and a reusable announcer
set in a single stock ElevenLabs voice: generic station IDs, an "up next" line
for every series in the catalog, and a time-of-night intro for each daypart.
Those files are static. The station plays them forever, so this cost is paid
once.

The voice is chosen from the account's premade voices only (George, then a
short list of other stock narrators). Cloned, professional, and generated
voices are refused, including any voice recorded from a person.

The key is read from the ELEVENLABS_API_KEY environment variable. It is never
printed, never taken from the command line, and never written into the manifest.

  python3 scripts/otr_live_elevenlabs.py --estimate
      Character count and the one-time dollar / credit cost. No key, no files.

  python3 scripts/otr_live_elevenlabs.py --placeholders
      Stock espeak-ng en-us clips plus a simple tone sting, so the station
      has something to play before the produced pack exists.

  python3 scripts/otr_live_elevenlabs.py --generate
      Replace the placeholders with ElevenLabs audio. Requires the key.

Per-episode lines ("Tonight, on Suspense. The title. Tune in.") are not part
of this pack. Those stay on the server, and only when a listener is tuned in.
"""
import argparse
import json
import os
import struct
import subprocess
import sys
import wave

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "backend"))

from otr_live import normalize_spoken, pick_premade_voice  # noqa: E402

CATALOG = os.path.join(ROOT, "frontend", "public", "otr", "catalog.json")
OUT = os.path.join(ROOT, "frontend", "public", "otr", "live", "pack")

# eleven_multilingual_v2, the produced-announcer model. Flash/Turbo is half
# this price and is the wrong trade for a pack that is generated once.
TTS_DOLLARS_PER_1K = 0.08
TTS_TURBO_DOLLARS_PER_1K = 0.04
TTS_CREDITS_PER_CHAR = 1
MUSIC_DOLLARS_PER_MIN = 0.15
MUSIC_CREDITS_PER_MIN = 900
JINGLE_MS = 15000

JINGLE_PROMPT = (
    "A 15-second 1940s American radio station identification jingle for a station "
    "called old time radio. Small live orchestra: warm trumpets, clarinet, and "
    "a bright xylophone sting, then a short male close-harmony group singing the "
    "words old time radio, resolving on a major chord. Mono, a little vinyl "
    "warmth, the sound of a 1947 network ID. No modern drums, no synthesizer, "
    "no electric guitar."
)

IDENTS = [
    ("ident", "You're listening to old time radio."),
    ("ident-stay", "This is old time radio. Stay with us."),
    ("ident-live", "Old time radio. The live broadcast."),
]

# Start second in the Eastern day -> the line that opens that block.
DAYPARTS = [
    (0, "It's the middle of the night on old time radio. Mysteries until dawn."),
    (5 * 3600, "Good morning from old time radio. Comedy to start the day."),
    (8 * 3600, "Daytime on old time radio. Stories through the morning."),
    (12 * 3600, "High noon on old time radio. Westerns through the afternoon."),
    (16 * 3600, "Late afternoon on old time radio. Crime is on the case."),
    (19 * 3600, "Dinner time on old time radio. Comedy at the table."),
    (20 * 3600, "It's eight o'clock. Tonight on old time radio, the mystery hour."),
    (20 * 3600 + 1800, "Eight thirty. Time for comedy on old time radio."),
    (21 * 3600, "Nine o'clock. A western, here on old time radio."),
    (21 * 3600 + 1800, "Nine thirty. Crime drama on old time radio."),
    (22 * 3600, "Ten o'clock. Turn the lights down. Horror, on old time radio."),
    (22 * 3600 + 1800, "Ten thirty. Drama on old time radio."),
    (23 * 3600, "Eleven o'clock. Adventure on old time radio."),
    (23 * 3600 + 1800, "Eleven thirty. Stories of tomorrow, tonight, on old time radio."),
]


def shows():
    catalog = json.load(open(CATALOG))
    out = []
    for show in catalog["shows"]:
        if show.get("adv") or show.get("id") == "commercials" or not show.get("eps"):
            continue
        out.append(show)
    return out


def up_next_line(name):
    return "Up next on old time radio, " + name + "."


def plan():
    """Every line the pack speaks, in order. The jingle is music, not characters."""
    lines = []
    for name, text in IDENTS:
        lines.append({"kind": "ident", "id": name, "text": text, "file": "idents/" + name + ".mp3"})
    for show in shows():
        lines.append({
            "kind": "up-next", "id": show["id"], "text": up_next_line(show["name"]),
            "file": "up-next/" + show["id"] + ".mp3",
        })
    for start, text in DAYPARTS:
        lines.append({
            "kind": "daypart", "id": str(start), "text": text,
            "file": "daypart/" + str(start) + ".mp3",
        })
    return lines


def estimate():
    lines = plan()
    chars = sum(len(row["text"]) for row in lines)
    jingle_min = JINGLE_MS / 60000
    tts = chars / 1000 * TTS_DOLLARS_PER_1K
    turbo = chars / 1000 * TTS_TURBO_DOLLARS_PER_1K
    music = jingle_min * MUSIC_DOLLARS_PER_MIN
    credits = chars * TTS_CREDITS_PER_CHAR + jingle_min * MUSIC_CREDITS_PER_MIN
    return {
        "lines": len(lines),
        "idents": sum(1 for row in lines if row["kind"] == "ident"),
        "up_next": sum(1 for row in lines if row["kind"] == "up-next"),
        "dayparts": sum(1 for row in lines if row["kind"] == "daypart"),
        "characters": chars,
        "jingle_seconds": JINGLE_MS / 1000,
        "tts_dollars_multilingual_v2": round(tts, 2),
        "tts_dollars_turbo": round(turbo, 2),
        "music_dollars": round(music, 2),
        "pack_dollars": round(tts + music, 2),
        "pack_credits": int(round(credits)),
    }


def print_estimate(est, key_set):
    print("Listenotr Radio asset pack, one time")
    print("  announcer lines: {lines} ({idents} station IDs, {up_next} up-next, {dayparts} time-of-night)".format(**est))
    print("  spoken characters: {characters}".format(**est))
    print("  jingle: {jingle_seconds:.0f}s of ElevenLabs music".format(**est))
    print("  TTS at multilingual v2 ($0.08 / 1,000 characters): ${tts_dollars_multilingual_v2:.2f}".format(**est))
    print("  TTS if Flash/Turbo were used instead ($0.04 / 1,000): ${tts_dollars_turbo:.2f}".format(**est))
    print("  music ($0.15 / minute): ${music_dollars:.2f}".format(**est))
    print("  one-time total, multilingual announcer + jingle: ${pack_dollars:.2f}".format(**est))
    print("  the same pack in subscription credits (1 per character, 900 per music minute): {pack_credits}".format(**est))
    print("  per-episode intros are not in this total; they are generated later, only while someone is listening, and cached")
    if not key_set:
        print("ELEVENLABS_API_KEY is not set. No request was sent.")


def api_key():
    for arg in sys.argv[1:]:
        if "KEY" in arg.upper() or arg.startswith("sk_"):
            sys.exit("The API key must be the ELEVENLABS_API_KEY environment variable, not a command argument.")
    return os.environ.get("ELEVENLABS_API_KEY") or ""


def duration(path):
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=nw=1:nk=1", path,
    ], text=True)
    return round(float(out.strip()), 3)


def speak_espeak(text, dest):
    # espeak-ng's stock American voice. The normalizer is what actually gets
    # spoken, so a template can never come out as the letters OTR.
    spoken = normalize_spoken(text)
    wav = dest + ".wav"
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    subprocess.check_call([
        "espeak-ng", "-v", "en-us", "-s", "132", "-p", "28", "-a", "175", "-w", wav, spoken,
    ], stdout=subprocess.DEVNULL)
    subprocess.check_call([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", wav,
        "-ar", "22050", "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "48k", dest,
    ])
    os.remove(wav)
    return duration(dest)


def write_jingle_placeholder(dest):
    """A four-note sting standing in for the orchestra jingle. Not a voice."""
    sr = 22050
    notes = [392.00, 523.25, 659.25, 783.99]
    samples = []
    for index, freq in enumerate(notes):
        dur = 0.42 if index < 3 else 1.15
        count = int(sr * dur)
        for t in range(count):
            attack = min(1.0, t / (sr * 0.02))
            release = min(1.0, (count - t) / (sr * 0.12))
            env = attack * release
            sample = (
                math_sin(2 * 3.14159265 * freq * t / sr) * 0.55
                + math_sin(4 * 3.14159265 * freq * t / sr) * 0.18
            )
            samples.append(int(max(-1.0, min(1.0, sample * env)) * 26000))
    wav = dest + ".wav"
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with wave.open(wav, "w") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(sr)
        handle.writeframes(b"".join(struct.pack("<h", sample) for sample in samples))
    subprocess.check_call([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", wav,
        "-ar", "22050", "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "64k", dest,
    ])
    os.remove(wav)
    return duration(dest)


def math_sin(x):
    import math
    return math.sin(x)


def write_manifest(rows, jingle_dur, placeholder, voice):
    ident = next(row for row in rows if row["id"] == "ident")
    manifest = {
        "placeholder": placeholder,
        "voice": voice,
        "note": (
            "Placeholders are espeak-ng's stock en-us voice plus a tone sting. "
            "Run scripts/otr_live_elevenlabs.py --generate with ELEVENLABS_API_KEY "
            "to replace them. That script uses one premade ElevenLabs voice and "
            "will not use a cloned or custom voice."
            if placeholder else
            "Produced once with ElevenLabs. The voice is a premade library voice, not a clone."
        ),
        "jingle": {"file": "jingle.mp3", "dur": jingle_dur},
        "ident": {"file": ident["file"], "dur": ident["dur"]},
        "idents": [{"file": row["file"], "dur": row["dur"]} for row in rows if row["kind"] == "ident"],
        "upNext": {row["id"]: {"file": row["file"], "dur": row["dur"]} for row in rows if row["kind"] == "up-next"},
        "daypart": {row["id"]: {"file": row["file"], "dur": row["dur"]} for row in rows if row["kind"] == "daypart"},
    }
    with open(os.path.join(OUT, "manifest.json"), "w") as handle:
        json.dump(manifest, handle, indent=2)
        handle.write("\n")


def refresh_placeholders():
    """Re-speak only the espeak stand-ins. The ElevenLabs recordings stay put."""
    manifest_path = os.path.join(OUT, "manifest.json")
    manifest = json.load(open(manifest_path))
    names = {show["id"]: show["name"] for show in shows()}
    daypart_text = {str(start): text for start, text in DAYPARTS}
    done = 0
    for show_id, entry in manifest.get("upNext", {}).items():
        if entry.get("source") != "placeholder":
            continue
        text = normalize_spoken(up_next_line(names[show_id]))
        entry["dur"] = speak_espeak(text, os.path.join(OUT, entry["file"]))
        done += 1
        if done % 25 == 0:
            print("  refreshed", done)
    for key, entry in manifest.get("daypart", {}).items():
        if entry.get("source") != "placeholder":
            continue
        text = daypart_text.get(key)
        if not text:
            continue
        entry["dur"] = speak_espeak(normalize_spoken(text), os.path.join(OUT, entry["file"]))
        done += 1
    with open(manifest_path, "w") as handle:
        json.dump(manifest, handle, indent=2)
        handle.write("\n")
    print("refreshed", done, "placeholder clips")


def write_placeholders():
    manifest_path = os.path.join(OUT, "manifest.json")
    if os.path.exists(manifest_path):
        current = json.load(open(manifest_path))
        engine = (current.get("voice") or {}).get("engine")
        if engine == "elevenlabs":
            sys.exit(
                "The pack on disk is the ElevenLabs recording (Bill). "
                "Refusing to overwrite it with espeak placeholders."
            )
    rows = plan()
    for index, row in enumerate(rows, 1):
        dest = os.path.join(OUT, row["file"])
        row["dur"] = speak_espeak(row["text"], dest)
        if index % 25 == 0 or index == len(rows):
            print("  placeholder", index, "of", len(rows))
    jingle_dur = write_jingle_placeholder(os.path.join(OUT, "jingle.mp3"))
    write_manifest(rows, jingle_dur, True, {
        "engine": "espeak-ng",
        "voice": "en-us",
        "category": "stock-system",
        "elevenlabs": False,
    })
    print("wrote placeholders to", OUT)


def eleven_request(url, key, payload=None):
    import urllib.request
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, method="GET" if payload is None else "POST",
        headers={
            "xi-api-key": key,
            "Accept": "application/json" if payload is None else "audio/mpeg",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.read()
    except Exception as exc:
        status = getattr(exc, "code", None)
        sys.exit("ElevenLabs request failed (http %s). The key was not printed." % (status or type(exc).__name__))


def write_mp3(dest, audio):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "wb") as handle:
        handle.write(audio)
    return duration(dest)


def generate(key):
    raw = eleven_request("https://api.elevenlabs.io/v1/voices", key)
    voices = json.loads(raw.decode("utf-8")).get("voices") or []
    voice = pick_premade_voice(voices)
    print("premade voice:", voice.get("name"), "(category premade)")
    voice_id = voice["voice_id"]
    rows = plan()
    for index, row in enumerate(rows, 1):
        audio = eleven_request(
            "https://api.elevenlabs.io/v1/text-to-speech/%s?output_format=mp3_44100_128" % voice_id,
            key,
            {
                "text": normalize_spoken(row["text"]),
                "model_id": "eleven_multilingual_v2",
                "voice_settings": {"stability": 0.42, "similarity_boost": 0.8},
            },
        )
        row["dur"] = write_mp3(os.path.join(OUT, row["file"]), audio)
        if index % 10 == 0 or index == len(rows):
            print("  announcer", index, "of", len(rows))
    jingle = eleven_request(
        "https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128",
        key,
        {"prompt": JINGLE_PROMPT, "music_length_ms": JINGLE_MS},
    )
    jingle_dur = write_mp3(os.path.join(OUT, "jingle.mp3"), jingle)
    write_manifest(rows, jingle_dur, False, {
        "engine": "elevenlabs",
        "name": voice.get("name"),
        "voice_id": voice_id,
        "category": "premade",
        "model": "eleven_multilingual_v2",
        "music": "elevenlabs-music",
    })
    print("wrote the produced pack to", OUT)


def main():
    parser = argparse.ArgumentParser(description="Build the Listenotr Radio asset pack.")
    parser.add_argument("--estimate", action="store_true")
    parser.add_argument("--placeholders", action="store_true")
    parser.add_argument("--refresh-placeholders", action="store_true",
                        help="re-speak espeak stand-ins only; leave ElevenLabs files alone")
    parser.add_argument("--generate", action="store_true")
    args = parser.parse_args()
    if not (args.estimate or args.placeholders or args.refresh_placeholders or args.generate):
        parser.print_help()
        return 2
    key = api_key()
    est = estimate()
    if args.estimate or args.generate:
        print_estimate(est, bool(key))
    if args.refresh_placeholders:
        refresh_placeholders()
    if args.placeholders:
        write_placeholders()
    if args.generate:
        if not key:
            print("Set ELEVENLABS_API_KEY and run --generate again. Placeholders were left as they are.")
            return 2
        generate(key)
    return 0


if __name__ == "__main__":
    sys.exit(main())
