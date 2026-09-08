#!/usr/bin/env python3
"""Render the ground crew's voice for Crane Cab.

The radio used to be captions and a squelch. This renders every call the
director can make as a real recording, in one voice, and writes the lengths of
those recordings into data/clips.js so radio.js can size a transmission from the
thing the operator actually hears instead of a flat 1.6 seconds.

The voice is "Crane Cab Ground - TC-1 Banksman", built on ElevenLabs with the
text-to-voice designer from the description in VOICE_BRIEF below. It is a saved
voice on the account, so re-running this is stable; rebuild it from the brief
only if you want a different reader.

Clips come out DRY. js/audio.js runs its own 300-3000 Hz bandpass and waveshaper
over everything on the radio bus, so anything pre-filtered here would be filtered
twice and end up unintelligible. Silence is trimmed off both ends and every clip
is normalised to the same RMS, so the timing table matches the sound and no one
line jumps out of the static bed.

    export ELEVENLABS_API_KEY=...
    python3 tools/voice.py --all        # everything missing
    python3 tools/voice.py UP_EASY HOLD # just these
    python3 tools/voice.py --check      # transcribe what is on disk, no API

--check needs `pip install vosk` and the small en-us model beside this file; it
is how the clips were verified, and it is what catches a delivery tag being read
out loud instead of acted on.

test/regress.mjs proves that every key this script can be asked for exists on
disk with a length beside it, so a clip added to the tables below and never
rendered fails the suite rather than the lift.
"""
import json, os, subprocess, sys, time, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
AUDIO = os.path.join(ROOT, 'audio')
CLIPS_JS = os.path.join(ROOT, 'data', 'clips.js')

VOICE = 'gMNW3FZDVpJ5Afeq0XIK'        # Crane Cab Ground - TC-1 Banksman
MODEL = 'eleven_v3'                    # the one that acts on [firm] / [shouting]
SEED = 4711                            # same text in, same read out
TARGET_RMS = 0.14                      # about -17 dBFS, well clear of clipping
HEADER = '''// Generated. How long each ground-crew clip runs, in seconds.
//
// tools/voice.py renders audio/<KEY>.ogg with the Crane Cab ground voice and
// writes this table from the encoded files, so the numbers here are the real
// lengths of the real clips, trimmed and normalised, not an estimate.
//
// radio.js reads it to size a transmission. Before this existed every call was
// on the air for a flat 1.6 s, which is fine for a caption and wrong for a
// voice: "Up easy." finished in 0.6 s and left a second of dead air with the
// squelch open, and "Blind pick. Shaft is nine metres deep, five across. My
// eyes only." was cut off at 1.6 s with three seconds left to say. A key with
// no entry falls back to DEFAULT_TX, so a missing clip degrades to the old
// behaviour instead of breaking the director.
//
// Regenerate with:  python3 tools/voice.py --all'''

VOICE_BRIEF = (
    'American man in his mid fifties, a construction site banksman who has spent '
    'thirty years on the ground under tower cranes. Deep chest voice with a dry '
    'gravel rasp, worn down from shouting over diesel engines. Clipped, unhurried, '
    'matter of fact delivery with a flat midwestern accent. Calm authority, never '
    'theatrical, never friendly. Speaks in short economical bursts like a man who '
    'has held a radio in one hand his whole working life.')

PHRASES = {
  'RADIO_CHECK':     ('Tee Cee One, radio check.', ''),
  'WATCH_TRUCK':     ('Watch the truck cab. Swing right first.', ''),
  # Anything with a distance in it exists twice, once per unit system. The
  # operator's gauges, the guide calls and the briefs all have to agree: a
  # banksman who says "twelve metres" and then "twenty five feet" on the same
  # lift is two different people, and a real operator hears it immediately.
  # Numbers are the true site geometry, rounded the way a banksman rounds:
  # landing 12 m = 39.4 ft, shaft 9 m deep by 5 across = 29.5 by 16.4 ft.
  'SCAFFOLD_BRIEF_FT': ('Landing is up on the scaffold deck, forty feet. Keep it high.', ''),
  'SCAFFOLD_BRIEF_M':  ('Landing is up on the scaffold deck, twelve meters. Keep it high.', ''),
  'SHAFT_BRIEF_FT':    ('Blind pick. Shaft is thirty feet deep, sixteen across. My eyes only.', ''),
  'SHAFT_BRIEF_M':     ('Blind pick. Shaft is nine meters deep, five across. My eyes only.', ''),
  'ON_THE_HOOK':     ('On the hook.', ''),
  'UP_EASY':         ('Up easy.', ''),
  'UP_EASY_HIGH':    ('Up easy. Well above the deck before you come round.', ''),
  'HOLD':            ('Hold, hold, hold.', '[firm]'),
  'DOWN_EASY':       ('Down easy.', ''),
  'DOWN_EASY_DECK':  ('Down easy onto the deck.', ''),
  'DOWN_EASY_PLUMB': ('Down easy. Keep her plumb.', ''),
  # Fires on load.near, which missions.js sets at NEAR_HEIGHT = 3.0 m above the
  # landing. It used to say "Last foot" on the scaffold and "Two metres" down
  # the shaft, for the same 3 m. "Last foot" is a real call with a real meaning
  # - micro speed, hands near the load - and hearing it ten feet up is how an
  # operator learns not to trust the voice.
  'LAST_CALL_FT':      ('Ten feet. Micro from here.', '[firm]'),
  'LAST_CALL_M':       ('Three meters. Micro from here.', '[firm]'),
  'CENTRED':         ('You are over the hole. Do not let it swing in there.', '[firm]'),
  'THATS_GOOD':      ("That's good. Unhooking.", ''),
  'GOOD_LIFT':       ('Good lift. Standing by.', ''),
  'ALL_STOP':        ('ALL STOP. ALL STOP.', '[shouting]'),
  'ALL_STOP_CLEAR':  ('All stop received. Recover easy.', '[firm]'),
  'NOT_READY':       ('Bring the hook over the load first.', ''),
  'TOO_HIGH':        ('Come down on it, you are high.', ''),
  'TOO_LOW':         ('Take up your slack, you are past it.', ''),
  'NOT_SLACK':       ('Set it down and give me slack first.', ''),
}

# Guide directions. Ground says the direction, then how far, in one breath.
DIRECTIONS = {
  'SWING_LEFT':  'Swing left',
  'SWING_RIGHT': 'Swing right',
  'TROLLEY_IN':  'Trolley in',
  'TROLLEY_OUT': 'Trolley out',
}

# Distance buckets a banksman actually calls. Snapped to the largest bucket at or
# below the true error; past the top bucket it is "keep coming", not a number.
FEET   = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100]
METRES = [2, 3, 5, 6, 8, 10, 15, 20, 25, 30]
WORDS = {5:'five', 10:'ten', 15:'fifteen', 20:'twenty', 25:'twenty five', 30:'thirty',
         40:'forty', 50:'fifty', 75:'seventy five', 100:'one hundred',
         2:'two', 3:'three', 6:'six', 8:'eight'}

def build():
    out = dict(PHRASES)
    for dkey, dtext in DIRECTIONS.items():
        out[dkey] = (dtext + '.', '')
        out[dkey + '_ON'] = (dtext + ', keep coming.', '')
        for n in FEET:
            out[f'{dkey}_F{n}'] = (f'{dtext}, {WORDS[n]} feet.', '')
        for n in METRES:
            out[f'{dkey}_M{n}'] = (f'{dtext}, {WORDS[n]} meters.', '')
    return out

def tts(text, tag):
    key = os.environ.get('ELEVENLABS_API_KEY')
    if not key:
        sys.exit('set ELEVENLABS_API_KEY')
    payload = json.dumps({
        'text': (tag + ' ' + text).strip(),
        'model_id': MODEL,
        'seed': SEED,
        'voice_settings': {'stability': 0.45, 'similarity_boost': 0.85,
                           'style': 0.35, 'use_speaker_boost': True},
    }).encode()
    req = urllib.request.Request(
        f'https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128',
        data=payload, headers={'xi-api-key': key, 'Content-Type': 'application/json'})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and attempt < 3:
                time.sleep(2 ** attempt * 2)
                continue
            raise RuntimeError(f'{e.code} {e.read()[:300]!r}')
        except Exception:
            if attempt < 3:
                time.sleep(2 ** attempt)
                continue
            raise


def run(args):
    p = subprocess.run(args, capture_output=True)
    if p.returncode:
        raise RuntimeError(' '.join(args[:6]) + chr(10) + p.stderr.decode()[-500:])
    return p.stdout


def encode(mp3, key):
    """Trim, level, encode. Returns the finished clip's length in seconds."""
    raw = os.path.join(AUDIO, key + '.mp3')
    tmp = os.path.join(AUDIO, key + '.trim.wav')
    ogg = os.path.join(AUDIO, key + '.ogg')
    open(raw, 'wb').write(mp3)
    # v3 pads a tagged line at both ends. That pad is dead air with the squelch
    # open, and it is counted in the transmission length, so it goes.
    run(['ffmpeg', '-v', 'error', '-y', '-i', raw,
         '-af', 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,'
                'areverse,'
                'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,'
                'areverse',
         '-ar', '24000', '-ac', '1', tmp])
    import numpy as np
    from scipy.io import wavfile
    sr, x = wavfile.read(tmp)
    x = x.astype('float64') / 32768.0
    rms = float((x ** 2).mean() ** 0.5)
    gain = TARGET_RMS / rms if rms > 1e-6 else 1.0
    peak = float(abs(x).max()) * gain
    if peak > 0.97:
        gain *= 0.97 / peak            # normalise by level, never clip
    wavfile.write(tmp, sr, (x * gain * 32767).clip(-32767, 32767).astype('int16'))
    run(['ffmpeg', '-v', 'error', '-y', '-i', tmp,
         '-c:a', 'libvorbis', '-q:a', '1', '-ac', '1', ogg])
    dur = float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                     '-of', 'csv=p=0', ogg]).decode().strip())
    os.remove(raw)
    os.remove(tmp)
    return dur


def measure_all():
    """Every clip on disk, by length. This is what data/clips.js is written from."""
    out = {}
    for f in sorted(os.listdir(AUDIO)):
        if not f.endswith('.ogg'):
            continue
        p = os.path.join(AUDIO, f)
        out[f[:-4]] = round(float(run(['ffprobe', '-v', 'error', '-show_entries',
                                       'format=duration', '-of', 'csv=p=0', p]).decode()), 2)
    return out


def write_clips_js(durations):
    rows = '\n'.join(f'  {k}: {v:.2f},' for k, v in sorted(durations.items()))
    open(CLIPS_JS, 'w').write(HEADER + '\n\nexport const CLIP_SECONDS = {\n' + rows + '\n};\n')


def check():
    """Transcribe what is on disk and compare it to what it was meant to say."""
    import re, wave
    from difflib import SequenceMatcher
    os.environ.setdefault('VOSK_LOG_LEVEL', '-1')
    from vosk import Model, KaldiRecognizer
    # A 40 MB recogniser drops a leading h and hears "all" as "oh", so this
    # compares phonetically flattened strings rather than demanding an exact
    # transcript. It is looking for a clip that says something else.
    flat = [('metres', 'meters'), ('ph', 'f'), ('ck', 'k'), ('c', 'k'), ('qu', 'kw'),
            ('x', 'ks'), ('z', 's'), ('wr', 'r'), ('kn', 'n'), ('gh', ''), ('h', ''),
            ('ee', 'i'), ('ea', 'i'), ('oo', 'u'), ('ou', 'u'), ('y', 'i'), ('e ', ' ')]

    def norm(s):
        s = ' '.join(re.findall(r'[a-z]+', s.lower().replace(chr(39), '')))
        for a, b in flat:
            s = s.replace(a, b)
        return re.sub(r'(.)\1+', r'\1', s)

    model = Model(os.path.join(HERE, 'vosk-model-small-en-us-0.15'))
    clips, bad = build(), []
    for key in sorted(clips):
        path = os.path.join(AUDIO, key + '.ogg')
        if not os.path.exists(path):
            continue
        run(['ffmpeg', '-v', 'error', '-y', '-i', path, '-ar', '16000', '-ac', '1', '/tmp/qc.wav'])
        wf = wave.open('/tmp/qc.wav')
        rec = KaldiRecognizer(model, wf.getframerate())
        while True:
            d = wf.readframes(4000)
            if not d:
                break
            rec.AcceptWaveform(d)
        heard = json.loads(rec.FinalResult()).get('text', '')
        r = SequenceMatcher(None, norm(clips[key][0]), norm(heard)).ratio()
        if r < 0.75:
            bad.append((r, key, clips[key][0], heard))
    print(f'{len(bad)} of {len(clips)} clips below 0.75 similarity')
    for r, key, want, heard in sorted(bad):
        print(f'{r:.2f}  {key:24} want: {want}')
        print(f'{"":30} hear: {heard or "(nothing)"}')
    print('\nA short line can read low here and still be correct: re-run the one clip '
          'with a constrained grammar, or listen to it, before regenerating.')


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = {a for a in sys.argv[1:] if a.startswith('--')}
    if '--check' in flags:
        check()
        return
    os.makedirs(AUDIO, exist_ok=True)
    clips = build()
    todo = args or sorted(clips)
    for key in todo:
        if key not in clips:
            sys.exit(f'no such clip: {key}')
        if not args and os.path.exists(os.path.join(AUDIO, key + '.ogg')):
            continue
        text, tag = clips[key]
        dur = encode(tts(text, tag), key)
        print(f'{key:24} {dur:5.2f}s  {text}', flush=True)
    write_clips_js(measure_all())
    print(f'data/clips.js written from {len(os.listdir(AUDIO))} files in audio/')


if __name__ == '__main__':
    main()
