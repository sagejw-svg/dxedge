#!/usr/bin/env python3
"""Filament (/synth/) test suite.

Sound is measured, not listened to: every DSP check renders through the real engine
(voice worklet + rack) in an OfflineAudioContext via window.__synth.render, and reads the
result with an FFT or a DFT at known frequencies. UI checks drive the page in a real
browser at desktop and phone sizes.

Numbered checks follow the design brief's test list (dxedge-synth-design.md):
  1 self oscillation tracks pitch      2 cutoff accuracy          3 Valve 12 loop tube harmonics
  4 push-pull cancels even harmonics   5 fuzz                     6 no clicks
  7 mono fold                          8 aliasing baseline        9 CPU (logged)
  10 layout                            12 MIDI
plus S. (the stereo round), C. (Cathode, the second device: filters, normals, cables, the patch
panel, the rack rail), D. (Dekatron, the drum machine: voices, the step clock, the panel), T. (Thyratron, the monophonic ladder: presets, self-oscillation, glide, the note stack), W. (Lattice, the wavetable: mipmaps, warp, filters, the matrix, a WAV import), G. (Gleam, the touch field: scales, voices, pan, room, gestures, the effect pad), M. (MIDI files: the SMF reader and writer, the recorder, import, the player
with both devices at once, Render WAV), the master bus (reverb, tempo-synced delay, compressor/limiter, 24-bit WAV), R. (the rack framework: device contract, mixer, clock,
project), P. (the song library: @tonejs/midi parse, transport playback, channel routing,
Halloween presets), a slashless /synth load through the service worker, and playing-it checks (keys,
computer keyboard, patches, knobs, persistence).

Run:  python3 scripts/test_synth.py          (SYNTH_SHOTS=/dir to keep screenshots)
"""
import http.server, socketserver, threading, functools, sys, os, json, base64, math, random
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public"))
PORT = int(os.environ.get("SYNTH_PORT", "8796"))
SHOTS = os.environ.get("SYNTH_SHOTS", "/tmp")
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
handler.log_message = lambda *a, **k: None
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{PORT}/synth/"
F = []
def ck(name, cond, detail=""):
    print(("PASS" if cond else "FAIL"), name, "" if cond else f"-> {detail}")
    if not cond: F.append(name)
def info(name, detail): print("INFO", name, detail)

SR = 48000
def dec(r):
    L = np.frombuffer(base64.b64decode(r["L"]), dtype=np.float32).astype(np.float64)
    R = np.frombuffer(base64.b64decode(r["R"]), dtype=np.float32).astype(np.float64)
    return L, R
def db(x): return 20 * math.log10(max(x, 1e-12))
def peak_freq(x):
    n = len(x); X = np.abs(np.fft.rfft(x * np.hanning(n), 8 * n)); f = np.fft.rfftfreq(8 * n, 1 / SR)
    lo = np.searchsorted(f, 20); i = lo + int(np.argmax(X[lo:]))
    a, b, c = np.log(X[i - 1:i + 2] + 1e-30); d = 0.5 * (a - c) / (a - 2 * b + c)
    return (i + d) * SR / (8 * n)
def tone_amp(x, f):
    t = np.arange(len(x)) / SR; w = np.hanning(len(x))
    return 2 * abs(np.sum(x * w * np.exp(-2j * np.pi * f * t))) / np.sum(w)
def harmonics_db(x, f0, k=5):
    a = [tone_amp(x, f0 * i) for i in range(1, k + 1)]
    return [db(a[i] / a[0]) for i in range(1, k)]      # H2..Hk relative to the fundamental

def patch(**over):
    """A clean test patch: the given overrides on a neutral voice (sine-free unless asked)."""
    p = {"osc1": {"wave": "saw", "level": 0.8}, "osc2": {"level": 0}, "sub": {"level": 0}, "noise": {"level": 0},
         "v1": {"tube": "12AU7", "drive": 0, "bias": 0}, "drift": 0,
         "filt": {"model": "valve12", "cutoff": 20000, "res": 0, "keytrack": 0, "env": 0, "vel": 0, "drive": 3, "sag": 3},
         "envA": {"a": 0.001, "d": 0.1, "s": 1, "r": 0.01, "vel": 0}, "envF": {"a": 0.001, "d": 0.1, "s": 0, "r": 0.1},
         "lfo1": {"pitch": 0, "cutoff": 0, "pw": 0, "amp": 0}, "voice": {"mode": "poly", "count": 8, "level": 0.8},
         "stereo": {"pan": "center", "spread": 0},
         "out": {"tube": "12AU7", "topology": "se", "drive": 0, "bias": 0, "sag": 0, "spkOn": False, "roomOn": False, "wOn": False}}
    for k, v in over.items():
        if isinstance(v, dict): p.setdefault(k, {}).update(v)
        else: p[k] = v
    return p

def cpatch(**over):
    """A clean Cathode test patch: VCO 1 saw straight through open filters, EG 2 square, no drift."""
    p = {"device": "cathode", "drift": 0, "vco1": {"wave": "saw", "scale": 8, "level": 0.8}, "vco2": {"level": 0},
         "drive": {"tube": "12AU7", "amount": 0}, "follow": {"tube": "12AU7", "drive": 0},
         "hpf": {"cutoff": 20, "peak": 0, "a": 0, "b": 0, "kt": 0}, "lpf": {"cutoff": 18000, "peak": 0, "a": 0, "b": 0, "kt": 0},
         "eg2": {"hold": 0, "a": 0.001, "d": 0.1, "s": 1, "r": 0.01}, "vca": {"level": 0.8, "vel": 0, "bias": 0}, "cables": [],
         "ens": {"on": False}, "out": {"tube": "12AU7", "topology": "se", "drive": 0, "bias": 0, "sag": 0, "spkOn": False, "roomOn": False, "wOn": False}}
    for k, v in over.items():
        if isinstance(v, dict): p.setdefault(k, {}).update(v)
        else: p[k] = v
    return p
def welch(x, n=8192):
    w = np.hanning(n); segs = [x[i:i + n] * w for i in range(0, len(x) - n, n // 2)]
    return np.mean([np.abs(np.fft.rfft(sg)) ** 2 for sg in segs], axis=0), np.fft.rfftfreq(n, 1 / SR)

from playwright.sync_api import sync_playwright
_CANDIDATES = [
    os.environ.get("SYNTH_CHROMIUM", ""),
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    "/opt/google/chrome/chrome",
    "/usr/local/bin/chrome",
]
CHROME = next(p for p in _CANDIDATES if p and os.path.exists(p))
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=CHROME, args=["--autoplay-policy=no-user-gesture-required"])
    pg = b.new_page(viewport={"width": 1366, "height": 1000}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(BASE); pg.wait_for_function("window.__synth && __synth.ready()", timeout=20000)
    def render(p, events, seconds, rack=True, mono=False, mixer=None, master=None, masterFx=True):
        body = {"patch": p, "events": events, "seconds": seconds, "rack": rack, "mono": mono, "masterFx": masterFx}
        if mixer is not None: body["mixer"] = mixer
        if master is not None: body["master"] = master
        return dec(pg.evaluate("a => __synth.render(a)", body))
    def note(n, at=0.0, off=None, v=0.8):
        e = [{"at": at, "t": "on", "n": n, "v": v}]
        if off is not None: e.append({"at": off, "t": "off", "n": n})
        return e

    # ---------------------------------------------------------------- 1. self oscillation tracks pitch
    cases = [("ladder24", "12AT7"), ("valve12", "12AX7"), ("valve12", "300B"), ("valve12", "EL34"), ("valve12", "KT88")]
    for model, tube in cases:
        devs = []
        for n in (48, 60, 72, 84, 96):
            p = patch(osc1={"level": 0}, filt={"model": model, "cutoff": 262, "res": 1, "keytrack": 1, "tube": tube})
            L, _ = render(p, note(n), 1.5, rack=False)
            f = peak_freq(L[SR // 2:]); devs.append(1200 * math.log2(f / (262 * 2 ** ((n - 60) / 12))))
        spread = max(devs) - min(devs)
        ck(f"1. {model} ({tube}) self-oscillation tracks the keys within +/-5 cents over 4 octaves", max(abs(d) for d in devs) <= 5,
           [round(d, 2) for d in devs])
        info(f"1. {model} ({tube}) cents from pitch", [round(d, 2) for d in devs])

    # ---------------------------------------------------------------- 2. cutoff accuracy (zero resonance)
    def H(model, f, fc):
        fs = 2 * SR; g = math.tan(math.pi * fc / fs); W = math.tan(math.pi * f / fs) / g
        if model == "ladder24": return abs(1 / (1 + 1j * W)) ** 4
        return abs(1 / (1 - W * W + 2j * 0.70710678 * W))
    for model in ("valve12", "ladder24"):
        for fc in (100, 440, 1000, 4000):
            pt = lambda cut: patch(osc1={"wave": "sine", "level": 0.05, "fixed": fc}, filt={"model": model, "cutoff": cut})
            a = tone_amp(render(pt(fc), note(60), 1.0, rack=False)[0][SR // 2:], fc)
            r = tone_amp(render(pt(20000), note(60), 1.0, rack=False)[0][SR // 2:], fc)
            meas = db(a / r)
            cs = np.linspace(fc * 0.85, fc * 1.15, 3001)
            ce = cs[np.argmin([abs(db(H(model, fc, c) / H(model, fc, 20000)) - meas) for c in cs])]
            ck(f"2. {model} cutoff at {fc} Hz is within 3% (measured {100 * (ce / fc - 1):+.2f}%)", abs(ce / fc - 1) <= 0.03, (meas, ce))

    # ---------------------------------------------------------------- 3. Valve 12: the loop tube voices the resonance
    for tube, lead in (("12AX7", 2), ("12AT7", 2), ("12AU7", 2), ("300B", 2), ("EL34", 3), ("6L6", 3), ("KT88", 3)):
        p = patch(osc1={"level": 0}, filt={"model": "valve12", "cutoff": 262, "res": 1, "keytrack": 1, "tube": tube})
        L, _ = render(p, note(60), 1.5, rack=False); x = L[SR // 2:]; f0 = peak_freq(x); h = harmonics_db(x, f0)
        ck(f"3. Valve 12 with {tube} in the loop: the {'2nd' if lead == 2 else '3rd'} harmonic leads (H2 {h[0]:.1f}, H3 {h[1]:.1f} dB)",
           (h[0] > h[1] + 1) if lead == 2 else (h[1] > h[0] + 1), h)
    h_lo = harmonics_db(render(patch(osc1={"level": 0}, filt={"model": "valve12", "cutoff": 262, "res": 1, "keytrack": 1, "tube": "12AX7", "bias": -4}), note(60), 1.5, rack=False)[0][SR // 2:], 262)
    h_hi = harmonics_db(render(patch(osc1={"level": 0}, filt={"model": "valve12", "cutoff": 262, "res": 1, "keytrack": 1, "tube": "12AX7", "bias": 4}), note(60), 1.5, rack=False)[0][SR // 2:], 262)
    ck("3. loop bias: hot adds even harmonics to the resonance", h_hi[0] > h_lo[0] + 3, (h_lo[:2], h_hi[:2]))

    # ---------------------------------------------------------------- 4. push-pull cancels even harmonics
    for tube in ("EL34", "6V6", "300B"):
        res = {}
        for topo in ("se", "pp"):
            p = patch(osc1={"wave": "sine", "level": 0.8, "fixed": 220}, filt={"cutoff": 20000},
                      v1={"tube": "12AU7", "drive": 0, "bias": -3.75}, out={"tube": tube, "topology": topo, "drive": 7, "bias": 2})
            L, _ = render(p, note(60), 1.0); res[topo] = harmonics_db(L[SR // 2:], 220)
        even = lambda h: 10 * math.log10(10 ** (h[0] / 10) + 10 ** (h[2] / 10))
        ck(f"4. push-pull {tube}: even harmonics at least 20 dB below single ended (SE {even(res['se']):.1f}, PP {even(res['pp']):.1f} dB)",
           even(res["pp"]) <= even(res["se"]) - 20, res)
        ck(f"4. push-pull {tube} keeps its odd harmonics", res["pp"][1] > res["se"][1] - 6, res)

    # ---------------------------------------------------------------- 5. fuzz
    rnd = random.Random(7)
    def rpatch():
        return {"osc1": {"wave": rnd.choice(["saw", "pulse", "tri", "sine"]), "level": rnd.random(), "pw": rnd.uniform(0.05, 0.95), "oct": rnd.randint(-3, 3), "fine": rnd.uniform(-50, 50)},
                "osc2": {"wave": rnd.choice(["saw", "pulse", "tri", "sine"]), "level": rnd.random(), "sync": rnd.random() < 0.3, "fm": rnd.random(), "ring": rnd.random(), "oct": rnd.randint(-3, 3)},
                "sub": {"level": rnd.random(), "oct": rnd.choice([1, 2])}, "noise": {"level": rnd.random() * 0.5, "color": rnd.choice(["white", "pink"])},
                "v1": {"tube": rnd.choice(["12AX7", "EL34", "300B", "KT88"]), "drive": rnd.uniform(0, 10), "bias": rnd.uniform(-5, 5)},
                "filt": {"model": rnd.choice(["valve12", "ladder24"]), "cutoff": math.exp(rnd.uniform(math.log(20), math.log(20000))), "res": rnd.random(),
                         "drive": rnd.uniform(0, 10), "keytrack": rnd.random(), "env": rnd.uniform(-1, 1), "tube": rnd.choice(["12AX7", "6L6", "300B"]),
                         "bias": rnd.uniform(-5, 5), "sag": rnd.uniform(0, 10)},
                "envA": {"a": rnd.uniform(0.001, 0.2), "d": rnd.uniform(0.01, 1), "s": rnd.random(), "r": rnd.uniform(0.003, 0.5)},
                "lfo1": {"wave": rnd.choice(["sine", "tri", "saw", "square", "sh", "smooth"]), "rate": rnd.uniform(0.1, 30), "pitch": rnd.uniform(0, 100),
                         "cutoff": rnd.uniform(0, 4), "pw": rnd.uniform(0, 0.9), "amp": rnd.random(), "mode": rnd.choice(["global", "voice"])},
                "voice": {"mode": rnd.choice(["poly", "poly", "mono", "legato"]), "glide": rnd.uniform(0, 0.3), "count": rnd.randint(1, 16), "level": 1},
                "drift": rnd.uniform(0, 8), "stereo": {"pan": rnd.choice(["center", "alt", "key", "random"]), "spread": rnd.random()},
                "out": {"tube": "EL34", "topology": "pp", "drive": 8, "level": 12, "roomOn": True, "wOn": True, "width": 200}}
    events, t = [], 0.0
    while t < 30:
        t += 0.021
        r = rnd.random()
        if r < 0.15: events.append({"at": t, "t": "on", "n": rnd.randint(12, 115), "v": rnd.random()})
        elif r < 0.27: events.append({"at": t, "t": "off", "n": rnd.randint(12, 115)})
        elif r < 0.30: events.append({"at": t, "t": "bend", "v": rnd.uniform(-1, 1)})
        elif r < 0.33: events.append({"at": t, "t": "mw", "v": rnd.random()})
        elif r < 0.35: events.append({"at": t, "t": "sus", "on": rnd.random() < 0.5})
        elif r < 0.37: events.append({"at": t, "t": "at", "v": rnd.random()})
        else: events.append({"at": t, "t": "patch", "p": rpatch(), "load": rnd.random() < 0.1})
    L, R = render(patch(**rpatch()), events, 30.0)
    bad = int(np.sum(~np.isfinite(L)) + np.sum(~np.isfinite(R)))
    pk = float(max(np.max(np.abs(L)), np.max(np.abs(R))))
    ck(f"5. fuzz: 30 s of random parameter changes, notes and controllers ({len(events)} events): no NaN or Infinity", bad == 0, bad)
    ck(f"5. fuzz: nothing above 0 dBFS after the limiter (peak {db(pk):.2f} dBFS)", pk <= 1.0, pk)
    ck("5. fuzz: it was actually making sound", float(np.sqrt(np.mean(L ** 2))) > 1e-3)

    # ---------------------------------------------------------------- 6. no clicks
    # A low sine through a clean voice: steady state, a sample-to-sample step is at most 2 pi f A / sr.
    # Every transition (note on, note off, voice steal, patch change) must stay under 2x the largest
    # step of the steady part of the same render.
    sine = patch(osc1={"wave": "sine", "level": 0.8}, envA={"a": 0.005, "s": 1, "r": 0.005})
    def steps(x): return np.abs(np.diff(x))
    scen = {
        "note on and off": note(45, 0.1, 0.5) + note(52, 0.3, 0.7),
        "voice steal (9 notes on 8 voices)": [e for i, n in enumerate([33, 35, 36, 38, 40, 41, 43, 45, 47]) for e in note(n, 0.05 + 0.05 * i)],
        "patch change (wave, model, tube)": note(45, 0.05) + [{"at": 0.4, "t": "patch", "p": patch(osc1={"wave": "tri", "level": 0.8}, filt={"model": "ladder24"}, v1={"tube": "EL34"}), "load": False}],
        "patch load": note(45, 0.05) + [{"at": 0.4, "t": "patch", "p": patch(osc1={"wave": "sine", "level": 0.5}), "load": True}],
    }
    for name, ev in scen.items():
        L, _ = render(sine, ev, 1.2, rack=False)
        s_ = steps(L)
        steady = float(np.max(s_[int(1.0 * SR):])) if name != "note on and off" else float(np.max(s_[int(0.32 * SR):int(0.48 * SR)]))
        worst = float(np.max(s_))
        ck(f"6. no clicks: {name} (worst step {worst:.5f}, steady {steady:.5f})", worst <= 2.0 * steady + 1e-4, (worst, steady))

    # ---------------------------------------------------------------- 7. mono fold, every factory patch
    names = [f["name"] for f in pg.evaluate("__synth.factory()")]
    ck(f"{len(names)} factory patches (12 or more)", len(names) >= 12, names)
    for n in names:
        P = pg.evaluate("n => __synth.factoryPatch(n)", n)
        chord = [36] if P["cat"] == "Bass" else ([60] if P["voice"]["mode"] != "poly" else [48, 55, 60, 64])
        ev = [e for k in chord for e in note(k, 0.05, 1.8)]
        L, R = render(P, ev, 2.4)
        seg = slice(int(0.3 * SR), int(1.7 * SR))
        st = math.sqrt((np.mean(L[seg] ** 2) + np.mean(R[seg] ** 2)) / 2); mo = math.sqrt(np.mean(((L[seg] + R[seg]) / 2) ** 2))
        ck(f"7. mono fold: {n} loses {db(st) - db(mo):.1f} dB folded to mono (limit 3)", db(mo) >= db(st) - 3.0, (db(st), db(mo)))
        ck(f"7. {n} sounds, and stays under 0 dBFS", 1e-3 < st and max(np.max(np.abs(L)), np.max(np.abs(R))) <= 1.0, (db(st),))

    # ---------------------------------------------------------------- 8. aliasing baseline
    for wave in ("saw", "pulse"):
        L, _ = render(patch(osc1={"wave": wave, "level": 0.8, "pw": 0.3, "fixed": 4000}), note(60), 1.0, rack=False)
        x = L[SR // 4:SR // 4 + 32768] * np.hanning(32768); X = np.abs(np.fft.rfft(x)); f = np.fft.rfftfreq(32768, 1 / SR)
        harm = np.zeros_like(X, bool)
        for k in range(1, 7): harm |= np.abs(f - 4000 * k) < 15
        al = db(X[(~harm) & (f > 30) & (f < 20000)].max() / X[harm].max())
        ck(f"8. aliasing: a {wave} at 4 kHz keeps aliases {al:.1f} dB below its strongest harmonic (baseline -45)", al <= -45, al)

    # ---------------------------------------------------------------- S. the stereo round
    def corr(a, b): return float(np.sum(a * b) / math.sqrt(np.sum(a * a) * np.sum(b * b) + 1e-30))
    def env(x, w=480): return np.sqrt(np.convolve(x ** 2, np.ones(w) / w, "valid"))
    def centroid(x):
        X = np.abs(np.fft.rfft(x * np.hanning(len(x)))); f = np.fft.rfftfreq(len(x), 1 / SR); return float(np.sum(X * f) / np.sum(X))
    def cents_of_peaks(x, f0, span=30):
        n = len(x); X = np.abs(np.fft.rfft(x * np.hanning(n), 4 * n)); f = np.fft.rfftfreq(4 * n, 1 / SR)
        m = (f > f0 * 2 ** (-span / 1200)) & (f < f0 * 2 ** (span / 1200)); Xm, fm = X[m], f[m]
        pk = [i for i in range(1, len(Xm) - 1) if Xm[i] > Xm[i - 1] and Xm[i] > Xm[i + 1] and Xm[i] > 0.2 * Xm.max()]
        return sorted(1200 * math.log2(fm[i] / f0) for i in pk)
    # unison
    sine1 = patch(osc1={"wave": "sine", "level": 0.8})
    L1, R1 = render(sine1, note(57), 2.0, rack=False)
    L4, R4 = render(patch(osc1={"wave": "sine", "level": 0.8}, voice={"unison": 4, "detune": 20}, stereo={"pan": "center", "spread": 0, "uspread": 1}), note(57), 2.0, rack=False)
    pk = cents_of_peaks(L4[SR // 2:] + R4[SR // 2:], 220)
    want = [-20, -6.67, 6.67, 20]
    ck(f"S. unison 4 at 20 cents: four copies at -20, -6.7, +6.7, +20 cents (found {[round(c, 1) for c in pk]})",
       len(pk) == 4 and all(abs(a - b) < 1.5 for a, b in zip(pk, want)), pk)
    lv = db(np.sqrt(np.mean((L4[SR // 2:] + R4[SR // 2:]) ** 2)) / np.sqrt(np.mean((L1[SR // 2:] + R1[SR // 2:]) ** 2)))
    ck(f"S. unison keeps the level within 3 dB of a single voice ({lv:+.1f} dB)", abs(lv) < 3, lv)
    ck(f"S. unison spread fans the copies across the field (L/R correlation {corr(L4[SR // 2:], R4[SR // 2:]):.2f})", corr(L4[SR // 2:], R4[SR // 2:]) < 0.8)
    pg.evaluate("__synth.setPatch(Object.assign(__synth.factoryPatch('Seven Filaments'), {}))"); pg.wait_for_timeout(150)
    pg.evaluate("__synth.noteOn(60, 0.8)"); pg.wait_for_timeout(300)
    nv = pg.evaluate("__synth.meter().voices"); pg.evaluate("__synth.noteOff(60)")
    ck(f"S. live: one note on Seven Filaments sounds seven voices ({nv})", nv == 7, nv)
    # filter stereo offset
    sp = {"pan": "center", "spread": 0}
    for model in ("ladder24", "valve12"):
        L, R = render(patch(filt={"model": model, "cutoff": 600, "offset": 1}, stereo=sp), note(45), 1.5, rack=False)
        cl, cr = centroid(L[SR // 2:]), centroid(R[SR // 2:])
        ck(f"S. {model} stereo offset +1 oct: the right side is brighter (centroid {cl:.0f} -> {cr:.0f} Hz)", cr > cl * 1.25, (cl, cr))
    L, R = render(patch(filt={"cutoff": 600, "offset": 0}, stereo=sp), note(45), 1.0, rack=False)
    ck("S. offset 0 on a centred voice: left and right identical", float(np.max(np.abs(L - R))) == 0.0, float(np.max(np.abs(L - R))))
    # LFO stereo phase
    for ph, want_neg in ((180, True), (0, False)):
        L, R = render(patch(lfo1={"wave": "sine", "rate": 2, "amp": 1, "phase": ph}, stereo=sp), note(57), 3.0, rack=False)
        el, er = env(L[SR:]), env(R[SR:]); c = corr(el - el.mean(), er - er.mean())
        ck(f"S. LFO 1 tremolo at stereo phase {ph}: envelopes {'opposed, an auto-pan' if want_neg else 'together'} (corr {c:.2f})", c < -0.8 if want_neg else c > 0.95, c)
    L, R = render(patch(filt={"model": "valve12", "cutoff": 500, "res": 0.5}, lfo1={"wave": "tri", "rate": 1, "cutoff": 2, "phase": 180}, stereo=sp), note(45), 3.0, rack=False)
    cl = np.array([centroid(L[i:i + 4800]) for i in range(SR, len(L) - 4800, 2400)]); cr = np.array([centroid(R[i:i + 4800]) for i in range(SR, len(R) - 4800, 2400)])
    c = corr(cl - cl.mean(), cr - cr.mean())
    ck(f"S. LFO 1 cutoff at stereo phase 180: the sweep moves between the speakers (centroid corr {c:.2f})", c < -0.5, c)
    # LFO 2
    L, _ = render(patch(osc1={"wave": "sine", "level": 0.8}, lfo2={"wave": "sine", "rate": 3, "pitch": 50}, stereo=sp), note(57), 3.0, rack=False)
    x = L[SR:]; zc = np.where((x[:-1] < 0) & (x[1:] >= 0))[0]; frc = x[zc] / (x[zc] - x[zc + 1]); tz = (zc + frc) / SR; inst = 1 / np.diff(tz)
    Fq = np.abs(np.fft.rfft(inst - inst.mean(), 8 * len(inst))); ff = np.fft.rfftfreq(8 * len(inst), float(np.mean(np.diff(tz))))
    rate = float(ff[np.argmax(Fq)]); swing = 1200 * math.log2(inst.max() / inst.min())
    ck(f"S. LFO 2 vibrato runs at its own rate ({rate:.2f} Hz, swing {swing:.0f} cents for 50 each way)", abs(rate - 3) < 0.15 and 80 < swing < 120, (rate, swing))
    L, R = render(patch(lfo2={"wave": "sine", "rate": 1.5, "pan": 1}, stereo=sp), note(57), 3.0, rack=False)
    el, er = env(L[SR:]), env(R[SR:]); c = corr(el - el.mean(), er - er.mean())
    ck(f"S. LFO 2 auto-pan swings the voice side to side (corr {c:.2f})", c < -0.7, c)
    # ensemble
    padp = patch(osc1={"wave": "saw", "level": 0.8}, filt={"cutoff": 3000}, envA={"a": 0.01, "s": 1, "r": 0.1}, stereo=sp, out={"tube": "12AU7", "drive": 0})
    chord = [e for n_ in (48, 55, 60, 64) for e in note(n_, 0.02)]
    seg = slice(SR // 2, 3 * SR - 1000)
    padp["ens"] = {"on": False}; L0, R0 = render(padp, chord, 3.0)
    st0 = math.sqrt((np.mean(L0[seg] ** 2) + np.mean(R0[seg] ** 2)) / 2)
    ck("S. ensemble off: a centred patch stays identical left and right", float(np.max(np.abs(L0 - R0))) < 1e-6, float(np.max(np.abs(L0 - R0))))
    for mode in ("I", "II", "I+II", "strings"):
        padp["ens"] = {"on": True, "mode": mode, "mix": 60}; L, R = render(padp, chord, 3.0)
        st = math.sqrt((np.mean(L[seg] ** 2) + np.mean(R[seg] ** 2)) / 2); mo = math.sqrt(np.mean(((L[seg] + R[seg]) / 2) ** 2)); c = corr(L[seg], R[seg])
        ck(f"S. ensemble {mode}: stereo (corr {c:.2f}), mono fold loses {db(st) - db(mo):.1f} dB, level {db(st) - db(st0):+.1f} dB",
           c < 0.97 and db(st) - db(mo) <= 3 and abs(db(st) - db(st0)) < 2.5, (c, db(st) - db(mo), db(st) - db(st0)))
    sn = patch(osc1={"wave": "sine", "level": 0.8, "fixed": 440}, stereo=sp, out={"tube": "12AU7", "drive": 0})
    sb = {}
    for on in (False, True):
        sn["ens"] = {"on": on, "mode": "I+II", "mix": 80}; L, _ = render(sn, note(60), 2.0)
        x = L[SR // 2:]; sb[on] = db(tone_amp(x, 440 + 9.75) / tone_amp(x, 440))
    ck(f"S. ensemble I+II puts sidebands 9.75 Hz either side of a tone ({sb[False]:.0f} -> {sb[True]:.0f} dB)", sb[True] > -45 and sb[True] > sb[False] + 20, sb)
    # the last ceiling is unity gain below its knee (it shipped at +1.9 dB in v0.1)
    g = pg.evaluate("""async () => { const { makeSynthChain } = await import('./rack.js');
      const ctx = new OfflineAudioContext(1, 4800, 48000), C = makeSynthChain(ctx), o = ctx.createOscillator(), a = ctx.createGain();
      o.frequency.value = 1000; a.gain.value = 0.5; o.connect(a); a.connect(C.ceilIn); C.ceil.connect(ctx.destination); o.start();
      const b = await ctx.startRendering(), d = b.getChannelData(0); let m = 0; for (let i = 480; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); return m; }""")
    ck(f"S. the final ceiling is unity gain below its knee (0.5 in, {g:.4f} out)", abs(g - 0.5) < 0.002, g)
    # goniometer and correlation, live
    pg.evaluate("__synth.load('Wide Novachord Strings')"); pg.wait_for_timeout(150)
    for n_ in (48, 55, 60, 64): pg.evaluate(f"__synth.noteOn({n_}, 0.8)")
    pg.wait_for_timeout(1200)
    ct = pg.evaluate("__synth.corrText()"); cv = pg.evaluate("__synth.correlation()")
    painted = pg.evaluate("""() => { const c = document.getElementById('gonioCv'), x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 1; i < x.length; i += 4) s += x[i] > 150 ? 1 : 0; return s; }""")
    ck(f"S. goniometer draws the stereo image and the correlation meter reads it ({ct!r}, {cv:+.2f}, {painted} lit pixels)", painted > 50 and ct not in ("idle", "play to see") and -1 <= cv <= 1, (ct, cv, painted))
    for n_ in (48, 55, 60, 64): pg.evaluate(f"__synth.noteOff({n_})")


    # ---------------------------------------------------------------- C. Cathode, the second device
    src = pg.evaluate("fetch('./voice.worklet.js').then(r => r.text())")
    import re as _re
    def jlist(name): return json.loads(_re.search(r"const " + name + r" = (\[[^\]]*\]);", src).group(1).replace("'", '"'))
    jk = pg.evaluate("__synth.jacks()")
    norm_w = dict(_re.findall(r"(\w+): '(\w+)'", _re.search(r"const C_NORM = \{([^}]*)\}", src).group(1)))
    ck(f"C. the worklet and the panel agree on the jacks ({len(jk['src'])} outputs, {len(jk['inp'])} inputs, {len(jk['norm'])} normals)",
       jlist("C_SRC") == jk["src"] and jlist("C_IN") == jk["inp"] and norm_w == jk["norm"], (jlist("C_SRC"), jlist("C_IN"), norm_w))
    # filters: -3 dB at the cutoff (white noise through VCO 1's noise wave, VCA held open by its bias)
    nz = dict(vco1={"wave": "noise", "level": 0.5}, vca={"bias": 1, "level": 0.8})
    # Noise is noisy, so compare a band around the cutoff (0.8 to 1.25 fc) with what a 2-pole
    # Butterworth at exactly fc would pass over the same band.
    Lr, _ = render(cpatch(**nz), [], 5.0, rack=False); Pr, fq = welch(Lr[SR // 4:])
    for fc in (150, 1000, 5000):
        for kind in ("lpf", "hpf"):
            if kind == "hpf" and fc == 5000: continue
            over = dict(nz); over[kind] = {"cutoff": fc}
            L, _ = render(cpatch(**over), [], 5.0, rack=False); Pf, _ = welch(L[SR // 4:])
            band = (fq > fc * 0.8) & (fq < fc * 1.25); r = (fq[band] / fc) ** 4
            H2 = 1 / (1 + r) if kind == "lpf" else r / (1 + r)
            g = 10 * math.log10(np.mean(Pf[band]) / np.mean(Pr[band])); gt = 10 * math.log10(np.mean(H2))
            ck(f"C. {kind.upper()} at {fc} Hz, peak 0: {g:.2f} dB over the band round the cutoff, a true {fc} Hz filter passes {gt:.2f} (within 1.2 dB)", abs(g - gt) <= 1.2, (g, gt))
    # self oscillation: in tune across the keys, from the threshold up
    for kind in ("lpf", "hpf"):
        devs = []
        for n in (48, 60, 72, 84):
            over = {"vco1": {"level": 0}, "vca": {"bias": 1}, kind: {"cutoff": 262, "peak": 1, "kt": 1}}
            if kind == "hpf": over["lpf"] = {"cutoff": 18000}
            L, _ = render(cpatch(**over), note(n), 1.5, rack=False)
            f = peak_freq(L[SR // 2:]); devs.append(1200 * math.log2(f / (262 * 2 ** ((n - 60) / 12))))
        ck(f"C. {kind.upper()} at full peak self-oscillates in tune over 3 octaves (cents {[round(d, 1) for d in devs]})", max(abs(d) for d in devs) <= 5, devs)
    lv = {}
    for pk in (0.75, 0.86, 0.93):
        L, _ = render(cpatch(vco1={"level": 0}, vca={"bias": 1}, lpf={"cutoff": 440, "peak": pk}), [], 3.0, rack=False)
        lv[pk] = db(np.sqrt(np.mean(L[2 * SR:] ** 2))); f = peak_freq(L[2 * SR:]) if lv[pk] > -60 else 0
        if pk > 0.8: ck(f"C. LPF peak {pk}: oscillates at {f:.1f} Hz for 440 ({1200 * math.log2(f / 440):+.1f} cents)", abs(1200 * math.log2(f / 440)) <= 5, f)
    ck(f"C. the scream starts at peak 8: silent at 7.5, oscillating at 8.6 and louder at 9.3 ({lv[0.75]:.0f}, {lv[0.86]:.0f}, {lv[0.93]:.0f} dB)",
       lv[0.75] < -90 and lv[0.86] > -35 and lv[0.93] > lv[0.86], lv)
    # normals and the VCA: no cables, EG 2 gates the sound
    L, _ = render(cpatch(), note(60, 0.2, 0.6), 1.0, rack=False)
    pre, mid, post = (db(np.sqrt(np.mean(L[a:b] ** 2))) for a, b in ((0, int(0.19 * SR)), (int(0.25 * SR), int(0.55 * SR)), (int(0.7 * SR), SR)))
    ck(f"C. normals: EG 2 opens the VCA only while the key is down ({pre:.0f}, {mid:.0f}, {post:.0f} dB)", pre < -100 and mid > -30 and post < -80, (pre, mid, post))
    L, _ = render(cpatch(lpf={"cutoff": 500, "peak": 0.3, "a": 0.3}, mg={"rate": 3, "shape": 0.5}), note(45), 2.5, rack=False)
    cs = np.array([centroid(L[i:i + 2400]) for i in range(SR // 2, len(L) - 2400, 1200)])
    F_ = np.abs(np.fft.rfft(cs - cs.mean(), 8 * len(cs))); fr_ = np.fft.rfftfreq(8 * len(cs), 1200 / SR)
    ck(f"C. normals: the MG sweeps the LPF through LPF A (centroid moves {cs.min():.0f}-{cs.max():.0f} Hz at {fr_[np.argmax(F_)]:.2f} Hz)",
       cs.max() > 1.5 * cs.min() and abs(fr_[np.argmax(F_)] - 3) < 0.3, (cs.min(), cs.max(), fr_[np.argmax(F_)]))
    # cables
    L, _ = render(cpatch(eg2={"a": 0.3}, cables=[["gate", "vca"]]), note(60, 0.2, 0.6), 1.0, rack=False)
    a_ = db(np.sqrt(np.mean(L[int(0.202 * SR):int(0.212 * SR)] ** 2))); b_ = db(np.sqrt(np.mean(L[int(0.4 * SR):int(0.5 * SR)] ** 2)))
    post = db(np.sqrt(np.mean(L[int(0.62 * SR):] ** 2)))
    ck(f"C. cable GATE -> VCA CV replaces EG 2: full level at once, off at release ({a_:.1f}, {b_:.1f}, {post:.0f} dB)", abs(a_ - b_) < 1.5 and post < -60, (a_, b_, post))
    L, _ = render(cpatch(mg={"rate": 4, "shape": 0.5}, cables=[["sh", "pitch"]]), note(60), 3.2, rack=False)
    fs_ = []
    for k in range(1, 12):
        x = L[int((k * 0.25 + 0.05) * SR):int((k * 0.25 + 0.2) * SR)]; zc = np.where((x[:-1] < 0) & (x[1:] >= 0))[0]
        fs_.append(SR * (len(zc) - 1) / (zc[-1] - zc[0]) if len(zc) > 2 else 0)
    ck(f"C. cable S&H -> PITCH: a new random pitch each MG step ({len(set(round(f) for f in fs_))} distinct of {len(fs_)})", len(set(round(f) for f in fs_)) >= 8, [round(f) for f in fs_])
    L, _ = render(cpatch(mg={"rate": 8, "shape": 0.5}, eg2={"a": 0.002, "d": 0.03, "s": 0, "r": 0.03}, cables=[["mgPulse", "eg2Trig"]]), note(60, 0.1, 1.6), 2.2, rack=False)
    e_ = env(L, 240)[int(0.3 * SR):int(1.5 * SR)]
    E_ = np.abs(np.fft.rfft(e_ - e_.mean(), 4 * len(e_))); fe = np.fft.rfftfreq(4 * len(e_), 1 / SR)
    ck(f"C. cable MG pulse -> EG 2 TRIG: the envelope repeats at the MG rate ({fe[np.argmax(E_[fe < 50])]:.2f} Hz for 8)", abs(fe[np.argmax(E_[fe < 50])] - 8) < 0.3, fe[np.argmax(E_[fe < 50])])
    base_ = cpatch(vco1={"wave": "tri", "level": 0.8}, vco2={"wave": "square", "semi": 7, "level": 0}, lpf={"cutoff": 600, "peak": 0.5, "b": 0.3})
    L0, _ = render(base_, note(48), 1.0, rack=False); base_["cables"] = [["vco2", "lpB"]]; L1_, _ = render(base_, note(48), 1.0, rack=False)
    s0, s1 = tone_amp(L0[SR // 4:], 130.81 * 1.5 + 130.81), tone_amp(L1_[SR // 4:], 130.81 * 1.5 + 130.81)
    ck(f"C. cable VCO 2 -> LPF B: audio-rate filter FM puts a sideband at f1+f2 ({db(s0):.0f} -> {db(s1):.0f} dB)", db(s1) > db(s0) + 15, (db(s0), db(s1)))
    for cab in ([["lpf", "filtIn"]], [["hpf", "pitch"], ["lpf", "lpCut"]], [["vco1", "shClk"], ["vco2", "shIn"], ["sh", "filtIn"]]):
        L, R = render(cpatch(lpf={"cutoff": 900, "peak": 0.97}, hpf={"cutoff": 200, "peak": 0.9}, vca={"bias": 0.5}, cables=cab), note(60), 1.5)
        pk = max(np.max(np.abs(L)), np.max(np.abs(R)))
        ck(f"C. feedback patch {cab}: bounded, under 0 dBFS after the rack (peak {db(pk):.1f} dBFS)", np.all(np.isfinite(L)) and pk <= 1.0 and pk > 1e-3, pk)
    norm_ = pg.evaluate("__synth.setPatch({device:'cathode', cables:[['sh','lpA'],['mgTri','lpA'],['nope','lpA'],['eg1','vca']]}).cables")
    ck(f"C. one cable per input, unknown jacks dropped ({norm_})", norm_ == [["mgTri", "lpA"], ["eg1", "vca"]], norm_)
    # keyboard: trigger modes and glide
    ev2 = [{"at": 0.1, "t": "on", "n": 60, "v": 0.8}, {"at": 0.5, "t": "on", "n": 64, "v": 0.8}, {"at": 0.9, "t": "off", "n": 64}, {"at": 0.95, "t": "off", "n": 60}]
    lv2 = {}
    for trig in ("multi", "single"):
        L, _ = render(cpatch(eg2={"a": 0.002, "d": 0.05, "s": 0, "r": 0.05}, ctl={"trig": trig}), ev2, 1.0, rack=False)
        lv2[trig] = db(np.sqrt(np.mean(L[int(0.505 * SR):int(0.53 * SR)] ** 2)))
    ck(f"C. multi trigger restarts EG 2 on a legato key, single does not ({lv2['multi']:.0f} vs {lv2['single']:.0f} dB)", lv2["multi"] > -30 and lv2["single"] < -60, lv2)
    L, _ = render(cpatch(vco1={"wave": "tri"}, ctl={"glide": 0.08}), ev2, 1.0, rack=False)
    def zf(x):
        zc = np.where((x[:-1] < 0) & (x[1:] >= 0))[0]; return SR * (len(zc) - 1) / (zc[-1] - zc[0])
    fa, fm_, fb = zf(L[int(0.3 * SR):int(0.48 * SR)]), zf(L[int(0.53 * SR):int(0.57 * SR)]), zf(L[int(0.8 * SR):int(0.89 * SR)])
    ck(f"C. glide slides between keys ({fa:.0f} -> {fm_:.0f} -> {fb:.0f} Hz)", abs(fa - 261.6) < 2 and 263 < fm_ < 326 and abs(fb - 329.6) < 3, (fa, fm_, fb))
    # sleep and wake: a note after a long silence plays like the first (both devices)
    for pp_ in (cpatch(), patch()):
        L, _ = render(pp_, note(60, 0.05, 0.3) + note(60, 1.4, 1.65), 2.0, rack=False)
        a1, a2 = (db(np.sqrt(np.mean(L[int(t * SR):int((t + 0.2) * SR)] ** 2))) for t in (0.08, 1.43))
        ck(f"C. {pp_.get('device', 'filament')}: a note after it has gone to sleep plays like the first ({a1:.1f} vs {a2:.1f} dB)", abs(a1 - a2) < 1.0 and a1 > -40, (a1, a2))
    # a cable change mid-note rides the duck: no click
    ev = note(48, 0.05) + [{"at": 0.8, "t": "patch", "p": cpatch(lpf={"cutoff": 600, "peak": 0.5, "b": 0.3}, vco2={"wave": "square", "semi": 7}, cables=[["vco2", "lpB"]])}]
    L, _ = render(cpatch(lpf={"cutoff": 600, "peak": 0.5, "b": 0.3}, vco2={"wave": "square", "semi": 7}), ev, 1.4, rack=False)
    s_ = np.abs(np.diff(L)); worst = float(np.max(s_[int(0.75 * SR):int(0.86 * SR)])); steady = float(max(np.max(s_[int(0.3 * SR):int(0.7 * SR)]), np.max(s_[int(0.95 * SR):])))
    ck(f"C. patching a cable mid-note does not click (worst step {worst:.4f}, steady {steady:.4f})", worst <= 1.5 * steady + 1e-4, (worst, steady))
    # fuzz: random knobs and cables, feedback included
    rng = random.Random(7); pk = 0; bad = 0
    for t in range(16):
        cab = [[rng.choice(jk["src"]), rng.choice(jk["inp"])] for _ in range(rng.randint(1, 6))]
        fp_ = {"device": "cathode", "vco1": {"wave": rng.choice(["tri", "saw", "pulse", "noise"]), "level": rng.random()},
               "vco2": {"wave": rng.choice(["saw", "square", "narrow", "ring"]), "level": rng.random(), "sync": rng.random() < 0.3, "semi": rng.randint(-12, 12)},
               "pm": {"a": rng.uniform(-24, 24), "b": rng.uniform(-24, 24)}, "drive": {"amount": rng.uniform(0, 10)},
               "hpf": {"cutoff": rng.uniform(20, 3000), "peak": rng.random(), "a": rng.uniform(-1, 1), "b": rng.uniform(-1, 1), "kt": rng.random()},
               "lpf": {"cutoff": rng.uniform(30, 12000), "peak": rng.random(), "a": rng.uniform(-1, 1), "b": rng.uniform(-1, 1), "kt": rng.random()},
               "mg": {"rate": rng.uniform(0.1, 40), "shape": rng.random()}, "follow": {"drive": rng.uniform(0, 10)}, "vca": {"bias": rng.choice([0, 0, 1])},
               "out": {"drive": rng.uniform(0, 10), "level": rng.uniform(-6, 12)}, "cables": cab}
        L, R = render(fp_, note(rng.randint(30, 90), 0.0, 0.6), 1.0)
        bad += int(not (np.all(np.isfinite(L)) and np.all(np.isfinite(R)))); pk = max(pk, float(np.max(np.abs(L))), float(np.max(np.abs(R))))
    ck(f"C. fuzz, 16 random patches with random cables: finite and under 0 dBFS (peak {db(pk):.2f} dBFS)", bad == 0 and pk <= 1.0, (bad, pk))
    # factory set: level, mono fold, headroom
    cf = pg.evaluate("__synth.cathodeFactory()")
    ck(f"C. {len(cf)} Cathode factory patches (10 or more)", len(cf) >= 10, cf)
    for f_ in cf:
        P = pg.evaluate("n => __synth.cathodePatch(n)", f_["name"]); n_ = 36 if f_["cat"] == "Bass" or f_["name"] == "Filter Kick" else 60
        L, R = render(P, note(n_, 0.05, 1.8), 2.6)
        x = (L ** 2 + R ** 2) / 2; w = int(0.3 * SR); loud = 10 * math.log10(np.convolve(x, np.ones(w) / w, "valid").max() + 1e-12)
        seg = slice(int(0.3 * SR), int(1.7 * SR)); st = math.sqrt(np.mean(x[seg])); mo = math.sqrt(np.mean(((L[seg] + R[seg]) / 2) ** 2))
        pkf = max(np.max(np.abs(L)), np.max(np.abs(R)))
        ck(f"C. {f_['name']}: loudness {loud:.1f} dB (want -18 to -11), mono fold {db(st) - db(mo):.1f} dB, peak {db(pkf):.1f} dBFS",
           -18 <= loud <= -11 and db(mo) >= db(st) - 3.0 and pkf <= 1.0, (loud, db(st) - db(mo), pkf))
    # CPU, logged
    r = pg.evaluate("a => __synth.timeRender(a)", {"patch": pg.evaluate("__synth.cathodePatch('Plate Screamer')"), "events": note(60, 0.0), "seconds": 6.0})
    info("9. CPU Cathode (Plate Screamer, one voice, both filters screaming)", f"{100 * r['ms'] / 1000 / r['seconds']:.1f}% of real time, rack included")
    # the rack rail, live
    pg.evaluate("__synth.setDevice('cathode')"); pg.wait_for_timeout(200)
    ck("C. rail: Cathode lit, its panel shown, Filament's hidden", pg.evaluate("__synth.device()") == "cathode" and pg.is_visible("#mCLpf") and not pg.is_visible("#mFilt")
       and pg.get_attribute("#devC", "aria-pressed") == "true")
    pg.evaluate("__synth.load('Plate Screamer')"); pg.wait_for_timeout(150)
    pg.evaluate("__synth.noteOn(60, 0.8)"); pg.wait_for_timeout(400); m = pg.evaluate("__synth.meter()")
    ck(f"C. live: the keyboard plays Cathode (meter from {m.get('dev')}, {m.get('voices')} voice, notes {m.get('notes')})", m.get("dev") == "cathode" and m.get("voices") == 1 and m.get("notes") == [60], m)
    ck("C. chassis: V1 and V2 show Cathode's drive and follower tubes", pg.inner_text("#nameV1") == "12AX7" and pg.inner_text("#nameV2") == "12AX7" and "follow" in pg.inner_text("#roleV2").lower())
    pg.evaluate("__synth.setDevice('filament')"); pg.wait_for_timeout(150)
    ck("C. switching devices lets go of the held key", pg.evaluate("__synth.state()")["down"] == [])
    pg.evaluate("__synth.noteOn(64, 0.8)"); pg.wait_for_timeout(1000); m = pg.evaluate("__synth.meter()")
    mc = pg.evaluate("__synth.engine().meters.cathode")
    ck(f"C. back on Filament: it plays, and Cathode has faded out and sleeps (Filament {m.get('voices')} voices; Cathode {mc.get('voices')})",
       m.get("dev") == "filament" and m.get("voices") >= 1 and mc.get("voices") == 0, (m, mc))
    pg.evaluate("__synth.noteOff(64)")
    # the patch panel
    pg.evaluate("__synth.setDevice('cathode')"); pg.evaluate("__synth.load('Plate Screamer')"); pg.wait_for_timeout(150)
    J = lambda kind, id_: f'#jackfield .jack[data-kind="{kind}"][data-id="{id_}"]'
    pg.locator(J("out", "sh")).scroll_into_view_if_needed(); pg.click(J("out", "sh")); pg.click(J("in", "lpA")); pg.wait_for_timeout(100)
    ck("C. panel: click S&H OUT then LPF A patches a cable, drawn on the panel", pg.evaluate("__synth.patch().cables") == [["sh", "lpA"]] and pg.evaluate("__synth.cablePaths()") == 1,
       (pg.evaluate("__synth.patch().cables"), pg.evaluate("__synth.cablePaths()")))
    ck("C. panel: the LPF A knob now says what it is listening to", pg.evaluate("document.querySelector('#kCLpf .knob[data-path=\"lpf.a\"] .kl').textContent") == "A: S&H")
    a = pg.locator(J("out", "vco2") + " i").bounding_box(); c = pg.locator(J("in", "lpB") + " i").bounding_box()
    pg.mouse.move(a["x"] + 13, a["y"] + 13); pg.mouse.down(); pg.mouse.move(a["x"] + 60, a["y"] + 90, steps=6); pg.mouse.move(c["x"] + 13, c["y"] + 13, steps=6); pg.mouse.up(); pg.wait_for_timeout(100)
    ck("C. panel: dragging VCO 2 onto LPF B patches it", ["vco2", "lpB"] in pg.evaluate("__synth.patch().cables") and pg.evaluate("__synth.cablePaths()") == 2)
    a = pg.locator(J("in", "lpB") + " i").bounding_box(); c = pg.locator(J("in", "hpB") + " i").bounding_box()
    pg.mouse.move(a["x"] + 13, a["y"] + 13); pg.mouse.down(); pg.mouse.move(c["x"] + 13, c["y"] + 13, steps=8); pg.mouse.up(); pg.wait_for_timeout(100)
    ck("C. panel: dragging a plug from LPF B to HPF B moves the cable", sorted(map(tuple, pg.evaluate("__synth.patch().cables"))) == [("sh", "lpA"), ("vco2", "hpB")], pg.evaluate("__synth.patch().cables"))
    pg.focus(J("out", "mgPulse")); pg.keyboard.press("Enter"); pg.focus(J("in", "eg2Trig")); pg.keyboard.press("Enter")
    ck("C. panel: keyboard patching (Enter on an output, then an input)", ["mgPulse", "eg2Trig"] in pg.evaluate("__synth.patch().cables"))
    pg.focus(J("out", "white")); pg.keyboard.press("Enter"); pg.keyboard.press("Escape")
    ck("C. panel: Escape cancels a half-made patch", pg.evaluate("document.querySelectorAll('#jackfield .jack.armed').length") == 0)
    pg.click(J("in", "lpA")); pg.wait_for_timeout(50)
    ck("C. panel: clicking a patched input pulls its cable and says what it is back to", ["sh", "lpA"] not in pg.evaluate("__synth.patch().cables")
       and "normal" in pg.inner_text("#patchStat") and pg.evaluate("document.querySelector('#kCLpf .knob[data-path=\"lpf.a\"] .kl').textContent") == "A: MG")
    lab = pg.get_attribute(J("in", "hpB"), "aria-label")
    ck(f"C. panel: jacks say what they are patched to ({lab!r})", "patched from VCO 2" in lab, lab)
    pg.click("#unplugAll"); pg.wait_for_timeout(50)
    ck("C. panel: unplug all", pg.evaluate("__synth.patch().cables") == [] and pg.evaluate("__synth.cablePaths()") == 0)
    pg.click(J("out", "eg1")); pg.click(J("in", "pitch")); pg.wait_for_timeout(300)
    pg.reload(); pg.wait_for_function("window.__synth && __synth.ready()", timeout=20000); pg.wait_for_timeout(200)
    ck("C. a reload brings back Cathode, its edited patch and its cable", pg.evaluate("__synth.device()") == "cathode" and pg.evaluate("__synth.patch().cables") == [["eg1", "pitch"]]
       and pg.evaluate("__synth.cablePaths()") == 1, (pg.evaluate("__synth.device()"), pg.evaluate("__synth.patch().cables")))
    pg.screenshot(path=os.path.join(SHOTS, "synth_cathode_desktop.png"), full_page=True)
    pg.evaluate("__synth.setDevice('filament')"); pg.wait_for_timeout(100)
    ck("C. no page errors", not errs, errs)

    # ---------------------------------------------------------------- D. Dekatron, the drum machine
    # Offline renders go through drums.worklet.js (2x, then the half-band), not a copy of the DSP.
    def drum(patch, events, seconds=1.0):
        return dec(pg.evaluate("a => __synth.drumRender(a)", {"patch": patch, "events": events, "seconds": seconds}))
    def step_sec(i, bpm, swing):
        sixteenth = 60 / bpm / 4
        return sixteenth * (i + ((swing / 3) if (i & 1) else 0))
    def onsets(x, thr=0.04, gap=0.04):
        d = np.abs(np.diff(x)); times = []; last = -1e9
        for i, v in enumerate(d):
            if v >= thr and (i - last) / SR >= gap:
                times.append(i / SR); last = i
        return times
    def near(got, want, tol=0.005):
        if len(got) != len(want): return False
        return all(abs(a - b) <= tol for a, b in zip(got, want))
    VOICE_IDS = ["kick", "snare", "hatC", "hatO", "clap", "tom", "rim"]
    devd = pg.evaluate("""() => { const d = __synth.drumDevice(); return {
      id: d.id, api: d.api, name: d.name, vendor: d.vendor, instrument: d.instrument,
      audioInputs: d.audioInputs, audioOutputs: d.audioOutputs, midiInput: d.midiInput, midiOutput: d.midiOutput,
      channels: d.channels, oversample: d.oversample, processor: d.processor, worklet: d.worklet,
      voices: d.voices, parameters: d.parameters, clock: { modes: d.clock.modes, ppq: d.clock.ppq },
      messages: d.messages, hasCreate: typeof d.create === 'function' }; }""")
    plen = devd["parameters"]
    ck("D. adapter: dxrack/1 device, stereo output, MIDI in, 2x worklet, seven voices",
       devd["id"] == "dekatron" and devd["api"] == "dxrack/1" and devd["instrument"] is True
       and devd["audioInputs"] == 0 and devd["audioOutputs"] == 1 and devd["midiInput"] is True and devd["midiOutput"] is False
       and devd["hasCreate"] is True and devd["channels"] == 2 and devd["oversample"] == 2
       and devd["processor"] == "dekatron" and devd["worklet"] == "drums.worklet.js"
       and devd["voices"] == VOICE_IDS and len(plen) >= 40
       and plen["seq.length"]["type"] == "int" and plen["seq.bpm"]["type"] == "float"
       and devd["clock"]["modes"] == ["internal", "external"] and devd["clock"]["ppq"] == 24
       and devd["messages"] == ["patch", "trig", "transport", "tick", "panic", "active"], devd)
    quiet = {vid: {"level": 0} for vid in VOICE_IDS}
    for vid in VOICE_IDS:
        voices = dict(quiet); voices[vid] = {"level": 1}
        L, R = drum({"device": "dekatron", "level": 1, "voices": voices}, [{"at": 0.02, "t": "trig", "voice": vid, "v": 1}], 0.45)
        pk = float(max(np.max(np.abs(L)), np.max(np.abs(R))))
        ck(f"D. {vid} triggers, stays finite, and stays at or under 0 dBFS (peak {db(pk):.1f} dBFS)",
           pk > 0.05 and pk <= 1.0 and np.all(np.isfinite(L)) and np.all(np.isfinite(R)), pk)
    def rim_score(seq, rim_steps, accent=None):
        steps = {vid: [0] * 16 for vid in VOICE_IDS}; steps["rim"] = rim_steps
        voices = dict(quiet); voices["rim"] = {"tune": 1600, "decay": 0.01, "color": 1, "level": 1, "attack": 0, "pan": 0}
        return {"device": "dekatron", "level": 1, "seq": seq, "voices": voices, "steps": steps,
                "accent": accent if accent is not None else [0] * 16}
    def hit_times(seq, rim_steps, seconds):
        length = int(seq["length"]); out = []; i = 0
        while i < 400:
            t = step_sec(i, seq["bpm"], seq.get("swing", 0))
            if t >= seconds - 0.03: break
            if rim_steps[i % length]: out.append(t)
            i += 1
        return out
    straight = {"bpm": 120, "swing": 0, "length": 8, "accentAmt": 0, "clock": "internal"}
    row = [1] * 16
    L, _ = drum(rim_score(straight, row), [{"at": 0, "t": "transport", "playing": True}], 1.05)
    got, want = onsets(L), hit_times(straight, row, 1.05)
    ck(f"D. internal clock, 120 BPM, straight: {len(got)} steps within 5 ms", near(got, want), (got, want))
    swung = {"bpm": 120, "swing": 1, "length": 8, "accentAmt": 0, "clock": "internal"}
    L, _ = drum(rim_score(swung, row), [{"at": 0, "t": "transport", "playing": True}], 1.2)
    got, want = onsets(L), hit_times(swung, row, 1.2)
    ck(f"D. swing 100% delays the offbeats to a triplet and the on-beats stay put ({len(got)} steps)", near(got, want), (["%.4f" % t for t in got], ["%.4f" % t for t in want]))
    short = {"bpm": 120, "swing": 0, "length": 4, "accentAmt": 0, "clock": "internal"}
    one = [1, 0, 0, 0] + [1] * 12
    L, _ = drum(rim_score(short, one), [{"at": 0, "t": "transport", "playing": True}], 1.6)
    got, want = onsets(L), hit_times(short, one, 1.6)
    ck(f"D. pattern length 4 loops the first step only (hits at {['%.3f' % t for t in got]})", near(got, want) and want == [0.0, 0.5, 1.0, 1.5], (got, want))
    acc_seq = {"bpm": 90, "swing": 0, "length": 4, "accentAmt": 1, "clock": "internal"}
    L, _ = drum(rim_score(acc_seq, row, [1, 0, 1, 0] + [0] * 12), [{"at": 0, "t": "transport", "playing": True}], 0.8)
    def win_peak(x, t, w=0.02):
        a = int(t * SR); b = min(len(x), a + int(w * SR)); return float(np.max(np.abs(x[a:b]))) if b > a else 0.0
    p_acc, p_plain = win_peak(L, step_sec(0, 90, 0)), win_peak(L, step_sec(1, 90, 0))
    ck(f"D. an accented step is louder ({p_acc:.3f} vs {p_plain:.3f})", p_acc > p_plain * 1.15 and p_plain > 0.05, (p_acc, p_plain))
    ext = {"bpm": 100, "swing": 0, "length": 4, "accentAmt": 0, "clock": "external"}
    ticks = [{"at": 0, "t": "transport", "playing": True}] + [{"at": 0.08 + 0.2 * i, "t": "tick"} for i in range(4)]
    L, _ = drum(rim_score(ext, row), ticks, 1.0)
    got = onsets(L); want = [0.08 + 0.2 * i for i in range(4)]
    ck(f"D. external clock fires one step per tick, within 5 ms", near(got, want), (got, want))
    # The rack transport is 24 pulses per quarter. Map those pulses onto the same
    # step grid the internal clock uses, including swing, and render the result.
    def host_events(bpm, n_ticks, sr=SR):
        dt = (60 / bpm) / 24
        ev = [{"type": "play", "tick": 0, "frame": 0, "tempo": bpm}]
        for t in range(n_ticks):
            ev.append({"type": "clock", "tick": t, "frame": int(round(t * dt * sr)), "tempo": bpm})
        return ev
    for swing, label in ((0, "straight"), (1, "triplet swing")):
        seq = {"bpm": 120, "swing": swing, "length": 8, "accentAmt": 0, "clock": "internal"}
        msgs = pg.evaluate("(a) => __synth.drumHostClock(a.ev, a.seq)", {"ev": host_events(120, 56), "seq": {"swing": swing, "length": 8}})
        for m in msgs:
            if m.get("at") is not None: m["at"] = m["at"] / SR
        L, _ = drum(rim_score(seq, row), msgs, 1.05)
        got, want = onsets(L), hit_times(seq, row, 1.05)
        ck(f"D. rack transport at 24 ppq, {label}: steps match the internal grid within 5 ms", near(got, want), (["%.4f" % t for t in got], ["%.4f" % t for t in want]))
    hats = {"device": "dekatron", "level": 1, "voices": dict(quiet, hatO={"decay": 0.9, "level": 1, "tune": 400}, hatC={"decay": 0.03, "level": 1})}
    open_L, _ = drum(hats, [{"at": 0.05, "t": "trig", "voice": "hatO", "v": 1}], 0.4)
    choke_L, _ = drum(hats, [{"at": 0.05, "t": "trig", "voice": "hatO", "v": 1}, {"at": 0.12, "t": "trig", "voice": "hatC", "v": 1}], 0.4)
    sl = slice(int(0.2 * SR), int(0.35 * SR))
    open_rms, choke_rms = float(np.sqrt(np.mean(open_L[sl] ** 2))), float(np.sqrt(np.mean(choke_L[sl] ** 2)))
    ck(f"D. a closed hat cuts the open hat (tail {open_rms:.4f} -> {choke_rms:.4f})", choke_rms < open_rms * 0.25 and open_rms > 0.01, (open_rms, choke_rms))
    df = pg.evaluate("__synth.drumFactory()")
    ck(f"D. {len(df)} factory patterns (8), including Lantern and Bones",
       len(df) == 8 and {f_["name"]: f_["cat"] for f_ in df}.get("Lantern") == "Halloween" and {f_["name"]: f_["cat"] for f_ in df}.get("Bones") == "Halloween", df)
    for f_ in df:
        P = pg.evaluate("n => __synth.drumPatch(n)", f_["name"])
        L, R = drum(P, [{"at": 0, "t": "transport", "playing": True}], 2.0)
        pk = float(max(np.max(np.abs(L)), np.max(np.abs(R)))); rms = float(np.sqrt(np.mean(L ** 2)))
        ck(f"D. {f_['name']}: sounds, finite, peak {db(pk):.1f} dBFS", rms > 1e-3 and pk <= 1.0 and np.all(np.isfinite(L)) and np.all(np.isfinite(R)), (rms, pk))
    rng = random.Random(11); bad = 0; pk = 0.0; loud = 0
    for _ in range(12):
        steps = {vid: [1 if rng.random() < 0.4 else 0 for _s in range(16)] for vid in VOICE_IDS}
        voices = {vid: {"tune": rng.uniform(30, 2400), "decay": rng.uniform(0.01, 1.2), "color": rng.random(),
                        "attack": rng.random(), "level": rng.random(), "pan": rng.uniform(-1, 1)} for vid in VOICE_IDS}
        fp = {"device": "dekatron", "level": rng.random(), "seq": {"bpm": rng.uniform(40, 240), "swing": rng.random(),
              "length": rng.randint(1, 16), "accentAmt": rng.random()}, "steps": steps, "voices": voices,
              "accent": [1 if rng.random() < 0.3 else 0 for _s in range(16)]}
        L, R = drum(fp, [{"at": 0, "t": "transport", "playing": True}], 0.7)
        bad += int(not (np.all(np.isfinite(L)) and np.all(np.isfinite(R))))
        pk = max(pk, float(np.max(np.abs(L))), float(np.max(np.abs(R))))
        loud += int(np.sqrt(np.mean(L ** 2)) > 1e-4)
    ck(f"D. fuzz, 12 random patterns: finite and at or under 0 dBFS (peak {db(pk):.2f} dBFS)", bad == 0 and pk <= 1.0 and loud >= 8, (bad, pk, loud))
    ms = pg.evaluate("""async () => { const t0 = performance.now();
        await __synth.drumRender({patch: __synth.drumPatch('Spark'), events: [{at: 0, t: 'transport', playing: true}], seconds: 4});
        return performance.now() - t0; }""")
    info("D. CPU Dekatron Spark, pattern running", f"{100 * ms / 4000:.1f}% of real time in headless Chrome (offline render, drums only)")
    pg.evaluate("__synth.setDevice('dekatron')"); pg.wait_for_timeout(250)
    ck("D. rail: Dekatron lit, the pattern shown, Filament's filter hidden",
       pg.evaluate("__synth.device()") == "dekatron" and pg.is_visible("#mDrumGrid") and pg.is_visible("#drumPlay")
       and not pg.is_visible("#mFilt") and not pg.is_visible("#mCLpf") and pg.get_attribute("#devD", "aria-pressed") == "true")
    ck("D. the grid is 8 rows of 16 steps", pg.evaluate("document.querySelectorAll('#drumGrid .dstep').length") == 128)
    before = pg.evaluate("__synth.patch().steps.snare[3]")
    pg.locator("#drumGrid .dstep[data-kind='snare'][data-step='3']").click(); pg.wait_for_timeout(50)
    ck("D. clicking a step toggles it in the patch", pg.evaluate("__synth.patch().steps.snare[3]") == (0 if before else 1),
       (before, pg.evaluate("__synth.patch().steps.snare[3]")))
    pg.click("#drumPlay"); pg.wait_for_timeout(350)
    dm = pg.evaluate("__synth.drumMeter()")
    ck(f"D. play runs the pattern (step {dm.get('step')})", dm.get("playing") and dm.get("step", -1) >= 0, dm)
    pg.evaluate("__synth.noteOn(62, 1)"); pg.wait_for_timeout(200)
    ck("D. the keyboard plays a voice (D is the snare)", pg.evaluate("__synth.drumMeter()").get("voices", 0) >= 1)
    pg.evaluate("__synth.noteOff(62)"); pg.click("#drumPlay"); pg.wait_for_timeout(100)
    pg.reload(); pg.wait_for_function("window.__synth && __synth.ready()", timeout=20000); pg.wait_for_timeout(200)
    ck("D. a reload comes back to Dekatron with the edited step",
       pg.evaluate("__synth.device()") == "dekatron" and pg.evaluate("__synth.patch().steps.snare[3]") == (0 if before else 1))
    pg.screenshot(path=os.path.join(SHOTS, "synth_dekatron_desktop.png"), full_page=True)
    pg.evaluate("__synth.setDevice('filament')"); pg.wait_for_timeout(150)
    ck("D. no page errors", not errs, errs)

    # ---------------------------------------------------------------- T. Thyratron, the monophonic ladder
    # Offline renders go through thyratron.worklet.js (2x, then the half-band).
    def thy(patch, events, seconds=1.0):
        return dec(pg.evaluate("a => __synth.thyRender(a)", {"patch": patch, "events": events, "seconds": seconds}))
    def midi_of(x, t, half=0.018):
        a = max(0, int((t - half) * SR)); b = min(len(x), int((t + half) * SR))
        seg = x[a:b] - np.mean(x[a:b])
        zc = np.where((seg[:-1] < 0) & (seg[1:] >= 0))[0]
        if len(zc) < 2: return None
        fr = seg[zc] / (seg[zc] - seg[zc + 1]); tz = (zc + fr) / SR
        inst = 1 / np.diff(tz); f = float(np.median(inst))
        return 69 + 12 * math.log2(f / 440)
    devt = pg.evaluate("""() => { const d = __synth.thyDevice(); const p = d.parameters; return {
      id: d.id, api: d.api, name: d.name, instrument: d.instrument, audioOutputs: d.audioOutputs,
      midiInput: d.midiInput, channels: d.channels, oversample: d.oversample, processor: d.processor,
      worklet: d.worklet, hasCreate: typeof d.create === 'function', messages: d.messages,
      n: Object.keys(p).length, wave: p['osc1.wave'], lfo: p['osc3.lfo'], cut: p['filt.cutoff'] }; }""")
    ck("T. adapter: dxrack/1, stereo, MIDI in, 2x worklet",
       devt["id"] == "thyratron" and devt["name"] == "Thyratron" and devt["api"] == "dxrack/1" and devt["instrument"]
       and devt["audioOutputs"] == 1 and devt["midiInput"] and devt["hasCreate"] and devt["channels"] == 2
       and devt["oversample"] == 2 and devt["processor"] == "thyratron" and devt["worklet"] == "thyratron.worklet.js"
       and devt["messages"] == ["patch", "on", "off", "bend", "mw", "sus", "panic", "active"]
       and devt["n"] > 25 and devt["wave"]["type"] == "choice" and "saw" in devt["wave"]["choices"]
       and devt["lfo"]["type"] == "boolean" and devt["cut"]["min"] == 20 and devt["cut"]["max"] == 16000, devt)
    tf = pg.evaluate("__synth.thyFactory()")
    cats = {f_["name"]: f_["cat"] for f_ in tf}
    ck("T. six factory presets: bass, lead, brass, sweep, and two Halloween",
       len(tf) == 6 and cats.get("Walnut Bass") == "Bass" and cats.get("Pilot Lead") == "Lead"
       and cats.get("Herald Brass") == "Brass" and cats.get("Arc Sweep") == "FX"
       and cats.get("Crypt Wail") == "Halloween" and cats.get("Bone Rattle") == "Halloween", tf)
    for f_ in tf:
        P = pg.evaluate("n => __synth.thyPatch(n)", f_["name"])
        n0 = 40 if f_["cat"] == "Bass" else 60
        L, R = thy(P, [{"at": 0.02, "t": "on", "n": n0, "v": 0.9}], 1.0)
        pk = float(max(np.max(np.abs(L)), np.max(np.abs(R))))
        early = float(np.sqrt(np.mean(L[int(0.02 * SR):int(0.12 * SR)] ** 2)))
        rms = float(np.sqrt(np.mean(L[int(0.25 * SR):] ** 2)))
        loud = early if f_["name"] == "Bone Rattle" else rms
        ck(f"T. {f_['name']}: non-silent, finite, at or under 0 dBFS (peak {db(pk):.1f} dBFS)",
           loud > 0.01 and pk <= 1.0 and pk > 0.05 and np.all(np.isfinite(L)) and np.all(np.isfinite(R))
           and float(np.max(np.abs(L - R))) == 0.0, (loud, pk))
    openf = {"cutoff": 440, "res": 1, "drive": 0.2, "track": 0, "env": 0}
    quiet = {"device": "thyratron", "level": 0.8, "glide": 0, "tune": 0,
             "osc1": {"wave": "tri", "range": "8", "level": 0}, "osc2": {"level": 0}, "osc3": {"level": 0, "lfo": False},
             "mix": {"noise": 0, "fb": 0}, "filt": openf,
             "loud": {"a": 0.001, "d": 0.2, "s": 1}, "cont": {"a": 0.001, "d": 0.05, "s": 0}}
    L, _ = thy(quiet, [{"at": 0.05, "t": "on", "n": 60, "v": 0.8}], 1.5)
    f = peak_freq(L[int(0.8 * SR):])
    ck(f"T. full emphasis self-oscillates at the cutoff ({f:.2f} Hz, {1200 * math.log2(f / 440):+.2f} cents)",
       abs(1200 * math.log2(f / 440)) < 12 and float(np.sqrt(np.mean(L[int(0.8 * SR):] ** 2))) > 0.05, f)
    dead = dict(quiet); dead["filt"] = dict(openf, res=0)
    L, _ = thy(dead, [{"at": 0.05, "t": "on", "n": 60, "v": 0.8}], 1.0)
    ck("T. emphasis at zero, oscillators muted, stays silent", float(np.sqrt(np.mean(L[int(0.4 * SR):] ** 2))) < 1e-4, float(np.max(np.abs(L))))
    tracked = []
    for n, hz in ((48, 220), (60, 440), (72, 880)):
        tp = dict(quiet); tp["filt"] = dict(openf, track=1)
        L, _ = thy(tp, [{"at": 0.05, "t": "on", "n": n, "v": 0.8}], 1.3)
        f = peak_freq(L[int(0.7 * SR):]); tracked.append(1200 * math.log2(f / hz))
    ck(f"T. key tracking puts the singing ladder on the note (cents {[round(c, 2) for c in tracked]})", max(abs(c) for c in tracked) < 12, tracked)
    lead = {"device": "thyratron", "level": 0.8, "glide": 0, "bend": 2, "tune": 0,
            "osc1": {"wave": "tri", "range": "8", "tune": 0, "level": 1}, "osc2": {"level": 0},
            "osc3": {"wave": "tri", "level": 0, "lfo": True, "rate": 5.5},
            "mix": {"noise": 0, "fb": 0}, "filt": {"cutoff": 6000, "res": 0, "drive": 0, "track": 0, "env": 0},
            "loud": {"a": 0.002, "d": 0.3, "s": 1}, "cont": {"a": 0.001, "d": 0.2, "s": 0},
            "mod": {"src": "osc3", "pitch": 0, "cut": 0}}
    L, _ = thy(lead, [{"at": 0.05, "t": "on", "n": 60, "v": 0.8}, {"at": 0.08, "t": "bend", "v": 1}], 1.0)
    got = midi_of(L, 0.55)
    ck(f"T. pitch wheel at full bend range is +2 semitones (MIDI {got:.2f})", got is not None and abs(got - 62) < 0.12, got)
    vib = dict(lead); vib["mod"] = {"src": "osc3", "pitch": 5, "cut": 0}
    L0, _ = thy(vib, [{"at": 0.05, "t": "on", "n": 60, "v": 0.8}], 1.2)
    L1, _ = thy(vib, [{"at": 0.02, "t": "mw", "v": 1}, {"at": 0.05, "t": "on", "n": 60, "v": 0.8}], 1.2)
    def swing(x):
        zc = np.where((x[:-1] < 0) & (x[1:] >= 0))[0]
        fr = x[zc] / (x[zc] - x[zc + 1]); tz = (zc + fr) / SR
        inst = 1 / np.diff(tz); return float(np.max(inst) / np.min(inst))
    d0, d1 = swing(L0[SR // 4:]), swing(L1[SR // 4:])
    ck(f"T. mod wheel opens oscillator 3 onto pitch ({1200 * math.log2(d0):.0f} -> {1200 * math.log2(d1):.0f} cents)",
       1200 * math.log2(d0) < 30 and 1200 * math.log2(d1) > 400, (d0, d1))
    gl = dict(lead); gl["glide"] = 0.5
    L, _ = thy(gl, [{"at": 0.05, "t": "on", "n": 60, "v": 0.8}, {"at": 0.40, "t": "on", "n": 72, "v": 0.8}], 2.2)
    def expect(t, t0=0.40, a=60.0, b=72.0, tau=0.5):
        if t <= t0: return a
        return a + (b - a) * (1 - math.exp(-(t - t0) / tau))
    glide_err = []
    for t in (0.25, 0.55, 0.90, 1.80):
        got = midi_of(L, t)
        glide_err.append(None if got is None else (got - expect(t)) * 100)
    ck(f"T. glide time constant matches the exponential (cents {[None if e is None else round(e, 1) for e in glide_err]})",
       all(e is not None and abs(e) < 25 for e in glide_err) and abs(midi_of(L, 0.50) - 72) > 3, glide_err)
    rel = dict(lead); rel["loud"] = {"a": 0.001, "d": 0.04, "s": 1}
    L, _ = thy(rel, [{"at": 0.05, "t": "on", "n": 60, "v": 0.9}, {"at": 0.25, "t": "off", "n": 60}], 1.0)
    ck("T. note off releases to silence", float(np.max(np.abs(L[int(0.7 * SR):]))) < 1e-3, float(np.max(np.abs(L[int(0.7 * SR):]))))
    L, _ = thy(rel, [{"at": 0.05, "t": "on", "n": 60, "v": 0.9}, {"at": 0.20, "t": "on", "n": 67, "v": 0.9}, {"at": 0.40, "t": "off", "n": 60}], 1.1)
    top = midi_of(L, 0.75)
    ck(f"T. releasing a covered key keeps the latest note (MIDI {None if top is None else round(top, 2)})",
       top is not None and abs(top - 67) < 0.2 and float(np.sqrt(np.mean(L[int(0.6 * SR):int(0.9 * SR)] ** 2))) > 0.02, top)
    L, _ = thy(rel, [{"at": 0.05, "t": "on", "n": 60, "v": 0.9}, {"at": 0.20, "t": "on", "n": 67, "v": 0.9}, {"at": 0.40, "t": "off", "n": 67}], 1.1)
    back = midi_of(L, 0.75)
    ck(f"T. releasing the latest note falls back to the one under it (MIDI {None if back is None else round(back, 2)})",
       back is not None and abs(back - 60) < 0.2, back)
    L, _ = thy(rel, [{"at": 0.05, "t": "on", "n": 60, "v": 0.9}, {"at": 0.30, "t": "off", "n": 61}], 0.8)
    stray = midi_of(L, 0.55)
    ck("T. a note off for a key that is not held does not cut the sounding note",
       stray is not None and abs(stray - 60) < 0.2 and float(np.sqrt(np.mean(L[int(0.4 * SR):] ** 2))) > 0.02, stray)
    L, _ = thy(rel, [{"at": 0.05, "t": "on", "n": 60, "v": 0.9}, {"at": 0.22, "t": "off", "n": 60}, {"at": 0.30, "t": "off", "n": 60}], 0.9)
    ck("T. a second note off stays silent", float(np.max(np.abs(L[int(0.6 * SR):]))) < 1e-3)
    burst = [{"at": 0.05 + 0.03 * i, "t": "on", "n": n, "v": 0.9} for i, n in enumerate((60, 64, 67))]
    burst += [{"at": 0.30 + 0.02 * i, "t": "off", "n": n} for i, n in enumerate((60, 64, 67))]
    L, _ = thy(rel, burst, 1.0)
    ck("T. a burst of notes, then every key up, leaves no stuck note", float(np.max(np.abs(L[int(0.7 * SR):]))) < 1e-3, float(np.max(np.abs(L[int(0.7 * SR):]))))
    L, _ = thy(rel, [{"at": 0.02, "t": "sus", "on": True}, {"at": 0.05, "t": "on", "n": 60, "v": 0.9},
                     {"at": 0.22, "t": "off", "n": 60}, {"at": 0.50, "t": "sus", "on": False}], 1.0)
    held = float(np.max(np.abs(L[int(0.32 * SR):int(0.46 * SR)])))
    tail = float(np.max(np.abs(L[int(0.8 * SR):])))
    ck("T. sustain holds the note until the pedal lifts", held > 0.05 and tail < 1e-3, (held, tail))
    rng = random.Random(4); bad = 0; pk = 0.0
    waves = ["tri", "saw", "mix", "square", "wide", "narrow"]; ranges = ["lo", "32", "16", "8", "4", "2"]
    for _ in range(8):
        fp = {"device": "thyratron", "level": rng.random(), "glide": rng.uniform(0, 0.4), "bend": rng.randint(0, 12),
              "osc1": {"wave": rng.choice(waves), "range": rng.choice(ranges), "tune": rng.uniform(-2, 2), "level": rng.random()},
              "osc2": {"wave": rng.choice(waves), "range": rng.choice(ranges), "tune": rng.uniform(-2, 2), "level": rng.random()},
              "osc3": {"wave": rng.choice(waves), "range": rng.choice(ranges), "level": rng.random(), "lfo": rng.random() < 0.5, "rate": rng.uniform(0.1, 12)},
              "mix": {"noise": rng.random(), "fb": rng.random()},
              "filt": {"cutoff": rng.uniform(40, 8000), "res": rng.random(), "drive": rng.random(), "track": rng.random(), "env": rng.random()},
              "loud": {"a": rng.uniform(0.001, 0.2), "d": rng.uniform(0.05, 0.6), "s": rng.random()},
              "cont": {"a": rng.uniform(0.001, 0.3), "d": rng.uniform(0.05, 0.8), "s": rng.random()},
              "mod": {"src": rng.choice(["osc3", "noise"]), "pitch": rng.uniform(0, 5), "cut": rng.uniform(0, 2)}}
        ev = [{"at": 0.02, "t": "on", "n": rng.randint(36, 84), "v": rng.random()}, {"at": 0.2, "t": "mw", "v": rng.random()}, {"at": 0.25, "t": "bend", "v": rng.uniform(-1, 1)}]
        L, R = thy(fp, ev, 0.55)
        bad += int(not (np.all(np.isfinite(L)) and np.all(np.isfinite(R)) and float(np.max(np.abs(L))) <= 1.0 and float(np.max(np.abs(R))) <= 1.0))
        pk = max(pk, float(np.max(np.abs(L))))
    ck(f"T. fuzz, 8 random patches: finite and at or under 0 dBFS (peak {db(pk):.2f} dBFS)", bad == 0, (bad, pk))
    ms = pg.evaluate("""async () => { const t0 = performance.now();
        await __synth.thyRender({patch: __synth.thyPatch('Walnut Bass'), events: [{at: 0.02, t: 'on', n: 40, v: 0.9}], seconds: 4});
        return performance.now() - t0; }""")
    info("T. CPU Thyratron Walnut Bass, one note", f"{100 * ms / 4000:.1f}% of real time in headless Chrome (offline render, voice only)")
    banned = pg.evaluate("""async () => {
      const files = ['index.html', 'thyratron.js', 'thyratron-dsp.js', 'thyratron-ui.js', 'thyratron.worklet.js', 'device.js'];
      const hits = [];
      for (const f of files) {
        const text = await (await fetch('/synth/' + f)).text();
        for (const w of ['Moog', 'Minimoog', 'Model D']) if (text.includes(w)) hits.push(f + ':' + w);
      }
      return hits;
    }""")
    ck("T. the page and the voice do not use those product names", banned == [], banned)
    pg.evaluate("__synth.setDevice('thyratron')"); pg.wait_for_timeout(250)
    ck("T. rail: Thyratron lit, its ladder shown, Filament's filter hidden",
       pg.evaluate("__synth.device()") == "thyratron" and pg.is_visible("#mThyLad") and pg.is_visible("#mThyOsc")
       and not pg.is_visible("#mFilt") and not pg.is_visible("#mCLpf") and pg.get_attribute("#devT", "aria-pressed") == "true"
       and "THYRA" in pg.inner_text("#devTitle") and pg.inner_text("#nameV1") == "LADDER")
    pg.click('#thyOsc .chip[data-path="osc1.wave"][data-val="square"]')
    pg.click("#thyLfo"); pg.wait_for_timeout(150)
    ck("T. a waveform chip and the low-oscillator switch edit the patch",
       pg.evaluate("__synth.patch().osc1.wave") == "square" and pg.evaluate("__synth.patch().osc3.lfo") is True)
    pg.reload(); pg.wait_for_function("window.__synth && __synth.ready()", timeout=20000); pg.wait_for_timeout(200)
    ck("T. a reload comes back to Thyratron with the edited waveform",
       pg.evaluate("__synth.device()") == "thyratron" and pg.evaluate("__synth.patch().osc1.wave") == "square")
    pg.screenshot(path=os.path.join(SHOTS, "synth_thyratron_desktop.png"), full_page=True)
    pg.evaluate("""async () => { await __synth.engine().ctx.resume(); await __synth.setPatch({device:'thyratron', loud:{a:0.001,d:0.04,s:0.8}, osc1:{wave:'saw', range:'8', level:0.8}, osc2:{level:0}, osc3:{level:0}, filt:{cutoff:4000, res:0.1, env:0, track:0}, glide:0}); }""")
    pg.wait_for_timeout(150)
    pg.evaluate("__synth.noteOn(60, 0.9)"); pg.wait_for_timeout(200)
    pg.evaluate("__synth.noteOn(64, 0.9)"); pg.wait_for_timeout(100)
    pg.evaluate("__synth.noteOff(60)"); pg.wait_for_timeout(120)
    live_m = pg.evaluate("__synth.thyMeter()")
    ck("T. on the page, letting go of a covered key leaves the voice up", (live_m.get("voices") or 0) >= 1, live_m)
    pg.evaluate("__synth.noteOff(64)"); pg.wait_for_timeout(500)
    live_m = pg.evaluate("__synth.thyMeter()")
    ck("T. on the page, the last key up leaves no stuck note", (live_m.get("voices") or 0) == 0, live_m)
    pg.evaluate("__synth.setDevice('filament')"); pg.wait_for_timeout(150)
    ck("T. no page errors", not errs, errs)
    # ---------------------------------------------------------------- M. MIDI files: recorder, import, player, render WAV
    # Fixtures are built byte by byte here (not with smf.js), so the reader is checked against the format itself.
    def vlq(v):
        out = [v & 0x7f]; v >>= 7
        while v: out.insert(0, (v & 0x7f) | 0x80); v >>= 7
        return out
    def mthd(fmt, ntrk, div): return list(b"MThd") + [0, 0, 0, 6, 0, fmt, 0, ntrk, div >> 8, div & 255]
    def mtrk(body): return list(b"MTrk") + [(len(body) >> 24) & 255, (len(body) >> 16) & 255, (len(body) >> 8) & 255, len(body) & 255] + body
    def tempo(us): return [0xFF, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255]
    def tname(s): return [0xFF, 0x03, len(s)] + list(s.encode())
    EOT = [0, 0xFF, 0x2F, 0]
    # format 1, 96 ppq: 120 BPM, then 60 BPM from tick 384 (2.0 s). A4 at 0 to 0.5 s; E5 at tick 480 (3.0 s) to tick 576 (4.0 s).
    # Running status, a velocity-0 note off, a sysex and an unknown meta (both skipped; both cancel running status).
    T0 = [0] + tname("Tempo") + [0] + tempo(500000) + vlq(384) + tempo(1000000) + EOT
    T1 = [0] + tname("Melody") + [0, 0x90, 69, 100] + vlq(96) + [69, 0] + [0, 0xF0, 3, 0x7E, 0x7F, 0xF7] + [0, 0xFF, 0x7F, 2, 1, 2] \
        + vlq(384) + [0x90, 76, 100] + vlq(96) + [76, 0] + EOT
    MEL = mthd(1, 2, 96) + mtrk(T0) + mtrk(T1)
    r = pg.evaluate("a => __synth.smf.read(a)", MEL); s_ = r["song"]
    evs = [(round(e["time"], 4), e["data"]) for e in s_["parts"][0]["events"]]
    ck("M. read format 1: running status, velocity-0 note offs, sysex and an unknown meta skipped, tempo change at 2 s",
       r["format"] == 1 and r["ppq"] == 96 and len(s_["parts"]) == 1 and s_["parts"][0]["name"] == "Melody"
       and evs == [(0, [0x90, 69, 100]), (0.5, [0x80, 69, 0]), (3.0, [0x90, 76, 100]), (4.0, [0x80, 76, 0])] and abs(s_["length"] - 4.0) < 1e-9, (r["format"], evs, s_["length"]))
    # format 0: one track, melody on channel 1 and drums on channel 10, running status across both, tempo change mid-file
    F0 = [0] + tempo(600000) + [0, 0x90, 60, 90] + [0, 0x99, 36, 100] + vlq(48) + [36, 0] + vlq(48) + [0x80, 60, 0] \
        + [0] + tempo(300000) + vlq(96) + [0x90, 62, 90] + vlq(96) + [62, 0] + EOT
    r = pg.evaluate("a => __synth.smf.read(a)", mthd(0, 1, 96) + mtrk(F0)); s_ = r["song"]
    mel = [p for p in s_["parts"] if p["chans"] == [1]]; drm = [p for p in s_["parts"] if p["chans"] == [10]]
    t_ = [round(e["time"], 4) for e in mel[0]["events"]] if mel else []
    ck("M. read format 0: split by channel, running status, tempo 100 then 200 BPM (notes at 0, 0.6 s and 0.9 s)",
       r["format"] == 0 and len(mel) == 1 and len(drm) == 1 and t_ == [0, 0.6, 0.9, 1.2] and drm[0]["notes"] == 1, (r["format"], [(p["name"], p["chans"]) for p in s_["parts"]], t_))
    # format 2: two sequences, played one after another
    F2a = [0, 0x90, 60, 90] + vlq(96) + [0x80, 60, 0] + vlq(96) + [0xFF, 0x2F, 0]
    F2b = [0, 0x90, 67, 90] + vlq(96) + [0x80, 67, 0] + EOT
    r = pg.evaluate("a => __synth.smf.read(a)", mthd(2, 2, 96) + mtrk(F2a) + mtrk(F2b)); s_ = r["song"]
    ck("M. read format 2: the second sequence starts where the first ends (1.0 s)", len(s_["parts"]) == 2 and abs(s_["parts"][1]["events"][0]["time"] - 1.0) < 1e-9
       and abs(s_["length"] - 1.5) < 1e-9, [(p["events"][0]["time"]) for p in s_["parts"]])
    ok = pg.evaluate("a => __synth.deck().importBytes(a, 'smpte.mid')", list(b"MThd") + [0, 0, 0, 6, 0, 0, 0, 1, 0xE7, 0x28] + mtrk(F2b))
    ck("M. a SMPTE-timed file is refused with a clear message", ok is False and "SMPTE" in pg.inner_text("#fileStat"), pg.inner_text("#fileStat"))
    ok = pg.evaluate("a => __synth.deck().importBytes(a, 'junk.mid')", list(b"RIFF....junk"))
    ck("M. a file that is not MIDI is refused with a clear message", ok is False and "not a Standard MIDI File" in pg.inner_text("#fileStat"))

    # round trip: write then read gives the same events, timing within one tick at 480 ppq, 120 BPM (1.04 ms)
    parts = [{"name": "Filament: Test", "ch": 0, "events": [{"time": 0.0, "data": [0x90, 60, 100]}, {"time": 0.1234, "data": [0xE0, 0, 96]}, {"time": 0.3337, "data": [0xB0, 1, 77]},
              {"time": 0.5, "data": [0xB0, 64, 127]}, {"time": 0.75, "data": [0x80, 60, 0]}, {"time": 0.9, "data": [0xD0, 50]}, {"time": 1.25, "data": [0xB0, 64, 0]}]},
             {"name": "Cathode: Bass", "ch": 1, "events": [{"time": 0.2, "data": [0x91, 36, 80]}, {"time": 0.6, "data": [0x81, 36, 0]}, {"time": 0.6, "data": [0x91, 36, 81]}, {"time": 2.0, "data": [0x81, 36, 0]}]}]
    wb = pg.evaluate("a => __synth.smf.write(a)", {"bpm": 120, "parts": parts})
    r = pg.evaluate("a => __synth.smf.read(a)", wb)
    got = [(p["name"], [(e["time"], e["data"]) for e in p["events"]]) for p in r["song"]["parts"]]
    exp = [(p["name"], [(e["time"], e["data"]) for e in p["events"]]) for p in parts]
    same = len(got) == 2 and all(g[0] == x[0] and len(g[1]) == len(x[1]) and all(a[1] == b_[1] and abs(a[0] - b_[0]) <= 1 / 960 + 1e-9 for a, b_ in zip(g[1], x[1])) for g, x in zip(got, exp))
    ck("M. SMF round trip: write then read gives the same events, names and times (within 1.04 ms)", same and r["format"] == 1 and r["ppq"] == 480 and r["timeSig"] == [4, 4], got)

    # an imported melody, rendered through the deck's own score: onsets and pitches, before and after the tempo change
    sine = patch(osc1={"wave": "sine", "level": 0.8}, envA={"a": 0.001, "d": 0.1, "s": 1, "r": 0.01}, ens={"on": False})
    pg.evaluate("__synth.setDevice('filament')")
    ck("M. import: a melodic single track goes to the selected device", pg.evaluate("a => __synth.deck().importBytes(a, 'melody.mid')", MEL)
       and pg.evaluate("__synth.deck().song().assign") == ["filament"])
    def render_deck(fil, cat, seconds=None, rack=True):
        a = pg.evaluate("__synth.deck().renderArgs('file')")
        a["patches"] = {"filament": fil, "cathode": cat}; a["rack"] = rack
        if seconds: a["seconds"] = seconds
        return a, dec(pg.evaluate("a => __synth.render2(a)", a))
    def onset(x, t0, A):
        i0 = int(t0 * SR); k = np.nonzero(np.abs(x[i0:]) > 0.1 * A)[0]
        return (i0 + int(k[0])) / SR if len(k) else None
    a, (L, R) = render_deck(sine, cpatch(), rack=False)
    A1 = float(np.max(np.abs(L[int(0.1 * SR):int(0.4 * SR)]))); A2 = float(np.max(np.abs(L[int(3.1 * SR):int(3.4 * SR)])))
    o1, o2 = onset(L, 0.0, A1), onset(L, 2.5, A2)
    f1, f2 = peak_freq(L[int(0.05 * SR):int(0.45 * SR)]), peak_freq(L[int(3.05 * SR):int(3.45 * SR)])
    c1, c2 = 1200 * math.log2(f1 / 440), 1200 * math.log2(f2 / 659.255)
    ck(f"M. imported melody at 120 BPM: A4 starts at {1000 * o1:.2f} ms and is {c1:+.2f} cents from 440 Hz", o1 is not None and o1 <= 0.005 and abs(c1) < 5, (o1, f1))
    ck(f"M. after the tempo change to 60 BPM: E5 starts at {o2:.4f} s (expected 3.000) and is {c2:+.2f} cents from 659.26 Hz", o2 is not None and abs(o2 - 3.0) <= 0.005 and abs(c2) < 5, (o2, f2))
    ck("M. the note between ends on time (silent at 2.5 s)", float(np.max(np.abs(L[int(0.6 * SR):int(2.9 * SR)]))) < 0.01 * A1)
    pg.evaluate("() => { const t = document.getElementById('tempoIn'); t.value = 200; t.dispatchEvent(new Event('input')); }")
    a = pg.evaluate("__synth.deck().renderArgs('file')")
    ons = [e["at"] for e in a["events"] if e["t"] == "on"]
    ck("M. tempo 200%: the score runs twice as fast (E5 at 1.5 s, render 2 s + 2 s tail)", ons == [0, 1.5] and abs(a["seconds"] - 4.0) < 1e-9, (ons, a["seconds"]))
    pg.evaluate("() => { const t = document.getElementById('tempoIn'); t.value = 100; t.dispatchEvent(new Event('input')); }")

    # two tracks, two devices at once: a chord on Filament, a bass line on Cathode
    T1c = [0] + tname("Chord") + [0, 0x90, 60, 100, 0, 64, 100, 0, 67, 100] + vlq(384) + [0x80, 60, 0, 0, 64, 0, 0, 67, 0] + EOT
    T2b = [0] + tname("Bass") + [0, 0x91, 38, 110] + vlq(192) + [38, 0] + [0, 33, 110] + vlq(192) + [0x81, 33, 0] + EOT
    DRM = [0] + tname("Drums") + [0, 0x99, 36, 100] + vlq(48) + [36, 0] + EOT
    TWO = mthd(1, 4, 96) + mtrk([0] + tempo(500000) + EOT) + mtrk(T1c) + mtrk(T2b) + mtrk(DRM)
    pg.evaluate("a => __synth.deck().importBytes(a, 'two.mid')", TWO)
    sg = pg.evaluate("__synth.deck().song()")
    ck("M. defaults: first melodic track on Filament, the lowest-pitched on Cathode, channel 10 off", sg["assign"] == ["filament", "cathode", "off"], sg)
    tri = cpatch(vco1={"wave": "tri", "scale": 8, "level": 0.8})
    _, (L, R) = render_deck(sine, tri)
    seg = L[int(0.2 * SR):int(0.9 * SR)]; seg2 = L[int(1.2 * SR):int(1.9 * SR)]
    amp = {f: tone_amp(seg, f) for f in (261.63, 329.63, 392.0, 73.42, 480.0)}
    floor_ = max(amp[480.0], 1e-6)
    ck("M. both devices sound at once: the Filament chord (C4 E4 G4) and the Cathode bass (D2) are all present",
       all(amp[f] > 30 * floor_ for f in (261.63, 329.63, 392.0, 73.42)), {k: round(db(v), 1) for k, v in amp.items()})
    ck("M. the bass line moves on Cathode (A1 in the second second)", tone_amp(seg2, 55.0) > 10 * tone_amp(seg2, 73.42), (db(tone_amp(seg2, 55.0)), db(tone_amp(seg2, 73.42))))
    pg.evaluate("__synth.deck().assign(1, 'off')")
    _, (L, R) = render_deck(sine, tri); seg = L[int(0.2 * SR):int(0.9 * SR)]
    ck("M. a track set to off is silent (D2 drops by 30 dB or more), the chord still plays", tone_amp(seg, 73.42) < amp[73.42] / 31.6 and tone_amp(seg, 261.63) > 30 * floor_,
       (db(tone_amp(seg, 73.42)), db(amp[73.42])))
    pg.evaluate("__synth.deck().assign(1, 'cathode')")

    # the recorder, driven through __synth: notes, velocities and the device each went to
    pg.evaluate("__synth.setDevice('filament')"); pg.evaluate("__synth.deck().arm()")
    tt = pg.evaluate("""async () => { const t = [], w = ms => new Promise(r => setTimeout(r, ms)), now = () => performance.now() / 1000;
      await w(120);
      __synth.noteOn(60, 0.8); t.push(now()); await w(200); __synth.noteOn(64, 0.5); t.push(now()); await w(200);
      __synth.noteOff(60); t.push(now()); __synth.noteOff(64); t.push(now()); await w(80);
      __synth.setDevice('cathode'); await w(60); __synth.noteOn(36, 1.0); t.push(now()); await w(150); __synth.noteOff(36); t.push(now());
      await w(50); __synth.deck().stopRec(); __synth.setDevice('filament'); return t; }""")
    tk = pg.evaluate("__synth.deck().take()")
    ne = [e for e in tk["events"] if e["t"] in ("on", "off")]
    sig = [(e["t"], e["n"], e["dev"]) for e in ne]
    ck("M. recorder: the first note starts the take; notes, offs and devices captured in order",
       sig == [("on", 60, "filament"), ("on", 64, "filament"), ("off", 60, "filament"), ("off", 64, "filament"), ("on", 36, "cathode"), ("off", 36, "cathode")]
       and ne[0]["time"] == 0 and not tk["rec"] and not tk["armed"], sig)
    dt = max(abs((e["time"]) - (t - tt[0])) for e, t in zip(ne, tt))
    ck(f"M. recorder timing matches the calls within 5 ms (worst {1000 * dt:.2f} ms), velocities kept", dt <= 0.005 and [round(e["v"], 2) for e in ne if e["t"] == "on"] == [0.8, 0.5, 1.0], (dt,))
    xb = pg.evaluate("__synth.deck().exportBytes()"); r = pg.evaluate("a => __synth.smf.read(a)", xb)
    pp = r["song"]["parts"]
    ex = [(round(e["time"], 4), e["data"][:2]) for p in pp for e in p["events"] if (e["data"][0] & 0xE0) == 0x80]
    exp_ = sorted([(e["time"], [(0x90 if e["t"] == "on" else 0x80) | (1 if e["dev"] == "cathode" else 0), e["n"]]) for e in ne], key=lambda x: (x[1][0] & 15, x[0]))
    tm_ok = len(ex) == len(exp_) and all(a_[1] == b_[1] and abs(a_[0] - b_[0]) <= 0.005 for a_, b_ in zip(ex, exp_))
    ck("M. export: two named tracks (Filament, Cathode), and the take parses back with timing within 5 ms",
       len(pp) == 2 and pp[0]["name"].startswith("Filament: ") and pp[1]["name"].startswith("Cathode: ") and tm_ok, ([p["name"] for p in pp], ex, exp_))
    pg.evaluate("a => __synth.deck().importBytes(a, 'take.mid')", xb)
    ck("M. our own export imports back onto the devices it was played on", pg.evaluate("__synth.deck().song().assign") == ["filament", "cathode"])

    # the strip, in the page: import with the file picker, play lights the keys, stop lets go of everything
    pg.evaluate("__synth.load('Wide Novachord Strings')"); pg.wait_for_timeout(150)
    LONG = mthd(1, 3, 96) + mtrk([0] + tempo(500000) + EOT) \
        + mtrk([0] + tname("Pads") + [0, 0x90, 60, 100, 0, 64, 100] + vlq(960) + [0x80, 60, 0, 0, 64, 0] + EOT) \
        + mtrk([0] + tname("Bass") + [0, 0x91, 36, 110] + vlq(960) + [0x81, 36, 0] + EOT)
    pg.set_input_files("#impIn", files=[{"name": "long.mid", "mimeType": "audio/midi", "buffer": bytes(LONG)}]); pg.wait_for_timeout(150)
    ck("M. UI: the file picker imports a file and lists its tracks with device chips", "long.mid" in pg.inner_text("#fileStat") and pg.is_visible("#trackList")
       and pg.evaluate("document.querySelectorAll('#trackList .trk').length") == 2
       and pg.evaluate("document.querySelector('#trackList .chip[data-trk=\"1\"][data-v=\"cathode\"]').getAttribute('aria-pressed')") == "true", pg.inner_text("#fileStat"))
    pg.click("#playFile"); pg.wait_for_timeout(500)
    keys_lit = pg.evaluate("[...document.querySelectorAll('.key.down')].map(k => +k.dataset.n).sort((a, b) => a - b)")
    mf = pg.evaluate("__synth.engine().meters.filament"); mc = pg.evaluate("__synth.engine().meters.cathode")
    ck("M. UI: play lights the keys for playback notes", {60, 64} <= set(keys_lit) and pg.evaluate("__synth.deck().playing()"), keys_lit)
    ck("M. UI: both devices play while the keyboard stays on Filament (Cathode held awake)", pg.evaluate("__synth.device()") == "filament" and mf["voices"] >= 2
       and mc and mc["voices"] == 1 and mc["notes"] == [36], (mf["voices"], mc))
    p0 = pg.evaluate("__synth.deck().position()")
    ck(f"M. UI: the position runs ({p0:.2f} s after 0.5 s)", 0.3 < p0 < 0.7, p0)
    pg.click("#stopBtn"); pg.wait_for_timeout(250)
    mf = pg.evaluate("__synth.engine().meters.filament"); mc = pg.evaluate("__synth.engine().meters.cathode")
    ck("M. UI: stop releases every playback note and unlights the keys", not pg.evaluate("__synth.deck().playing()") and pg.evaluate("document.querySelectorAll('.key.down').length") == 0
       and mf["notes"] == [] and mc["notes"] == [] and pg.evaluate("__synth.deck().sounding()") == {"filament": [], "cathode": []}, (mf["notes"], mc["notes"]))
    pg.wait_for_timeout(900)
    ck("M. UI: after stop the inactive Cathode fades and sleeps again", pg.evaluate("__synth.engine().meters.cathode.voices") == 0)
    # loop: a 1 s file comes round again
    pg.evaluate("a => __synth.deck().importBytes(a, 'loop.mid')", mthd(2, 2, 96) + mtrk(F2a) + mtrk(F2b))
    pg.click("#loopBtn"); pg.click("#playFile"); pg.wait_for_timeout(1900)
    ck(f"M. UI: loop comes round (still playing after 1.9 s of a 1.5 s file)", pg.evaluate("__synth.deck().playing()") and pg.evaluate("__synth.deck().position()") < 1.5, pg.evaluate("__synth.deck().position()"))
    pg.click("#stopBtn"); pg.click("#loopBtn"); pg.wait_for_timeout(100)
    ck("M. UI: no stuck notes after a looped stop", pg.evaluate("__synth.engine().meters.filament.notes") == [] and pg.evaluate("document.querySelectorAll('.key.down').length") == 0)
    # regression: a stop that lands after a note off was scheduled (150 ms ahead) but before it played
    pg.click("#playFile"); pg.wait_for_function("__synth.deck().position() >= 0.4", timeout=5000); pg.click("#stopBtn"); pg.wait_for_timeout(150)
    ck("M. UI: stop with a note off still in flight leaves no stuck note", pg.evaluate("__synth.engine().meters.filament.notes") == [],
       pg.evaluate("__synth.engine().meters.filament.notes"))
    pg.click("#playFile"); pg.wait_for_timeout(2000)
    ck("M. UI: without loop the player stops by itself at the end", not pg.evaluate("__synth.deck().playing()") and pg.evaluate("__synth.engine().meters.filament.notes") == [])
    # export and render downloads
    with pg.expect_download() as dl:
        pg.click("#expBtn")
    d_ = dl.value; mb = open(d_.path(), "rb").read()
    r = pg.evaluate("a => __synth.smf.read(a)", list(mb))
    import re as _re2
    ck(f"M. UI: export downloads {d_.suggested_filename}, a MIDI file with the take", bool(_re2.fullmatch(r"filament-take-\d{8}-\d{4}\.mid", d_.suggested_filename))
       and sum(p["notes"] for p in r["song"]["parts"]) == 3, d_.suggested_filename)
    pg.evaluate("p => __synth.setPatch(p)", tri); pg.evaluate("p => __synth.setPatch(p)", sine); pg.wait_for_timeout(100)
    pg.evaluate("a => __synth.deck().importBytes(a, 'two.mid')", TWO)
    with pg.expect_download(timeout=60000) as dl:
        pg.click("#wavBtn")
    d_ = dl.value
    import wave as _wave
    with _wave.open(str(d_.path()), "rb") as wv:
        prm = (wv.getnchannels(), wv.getsampwidth(), wv.getframerate(), wv.getnframes())
        pcm = np.frombuffer(wv.readframes(wv.getnframes()), dtype="<i2").astype(np.float64).reshape(-1, 2) / 32768
    wL = pcm[:, 0]; seg = wL[int(0.2 * SR):int(0.9 * SR)]
    ck(f"M. Render WAV: {d_.suggested_filename} is 48 kHz 16-bit stereo, the file's 2 s plus a 2 s tail", prm[:3] == (2, 2, 48000) and abs(prm[3] - 4 * SR) <= 1
       and d_.suggested_filename.startswith("filament-two-") and d_.suggested_filename.endswith(".wav"), (prm, d_.suggested_filename))
    ck("M. Render WAV: both devices are in it (the C4 chord root and the D2 bass)", tone_amp(seg, 261.63) > 30 * tone_amp(seg, 480.0) and tone_amp(seg, 73.42) > 30 * tone_amp(seg, 480.0)
       and float(np.max(np.abs(pcm))) <= 1.0, (db(tone_amp(seg, 261.63)), db(tone_amp(seg, 73.42)), db(tone_amp(seg, 480.0))))
    ck("M. Render WAV: a progress note, then the result", "rendered" in pg.inner_text("#wavStat"), pg.inner_text("#wavStat"))
    ck("M. no page errors", not errs, errs)

    # ---------------------------------------------------------------- 9. CPU (logged)
    big = patch(osc1={"wave": "saw"}, osc2={"wave": "pulse", "level": 0.6, "fine": 7}, sub={"level": 0.3}, filt={"model": "ladder24", "cutoff": 1500, "res": 0.5}, drift=1.5)
    ev8 = [e for n in (48, 52, 55, 59, 60, 64, 67, 71) for e in note(n, 0.0)]
    for model in ("ladder24", "valve12"):
        big["filt"]["model"] = model
        r = pg.evaluate("a => __synth.timeRender(a)", {"patch": big, "events": ev8, "seconds": 6.0})
        info(f"9. CPU {model}, 8 voices", f"{100 * r['ms'] / 1000 / r['seconds']:.1f}% of real time in headless Chrome (offline render, rack included)")
    big["filt"]["model"] = "valve12"; big["filt"]["offset"] = 0.5
    r = pg.evaluate("a => __synth.timeRender(a)", {"patch": big, "events": ev8, "seconds": 6.0})
    info("9. CPU valve12 with stereo offset (two filters per voice), 8 voices", f"{100 * r['ms'] / 1000 / r['seconds']:.1f}% of real time")
    big["filt"]["offset"] = 0; big["voice"] = {"unison": 2, "count": 8}; big["ens"] = {"on": True, "mode": "strings", "mix": 50}
    r = pg.evaluate("a => __synth.timeRender(a)", {"patch": big, "events": ev8, "seconds": 6.0})
    info("9. CPU valve12, 8 notes x unison 2 = 16 voices, ensemble on", f"{100 * r['ms'] / 1000 / r['seconds']:.1f}% of real time")

    # ---------------------------------------------------------------- 12. MIDI
    def rmidi(p, midi, seconds):
        return dec(pg.evaluate("a => __synth.renderMidi(a)", {"patch": p, "midi": midi, "seconds": seconds, "rack": False}))
    sp = patch(osc1={"wave": "sine", "level": 0.8}, envA={"vel": 1})
    L, _ = rmidi(sp, [{"at": 0.0, "data": [0x90, 69, 100]}, {"at": 0.5, "data": [0xE0, 0x7F, 0x7F]}], 1.0)
    f_a, f_b = peak_freq(L[SR // 8:SR // 2 - 1000]), peak_freq(L[SR // 2 + 4000:])
    ck(f"12. MIDI note on plays A4 ({f_a:.1f} Hz)", abs(1200 * math.log2(f_a / 440)) < 3, f_a)
    ck(f"12. MIDI pitch bend up bends +2 semitones ({1200 * math.log2(f_b / f_a):.0f} cents)", abs(1200 * math.log2(f_b / f_a) - 200) < 5, (f_a, f_b))
    L, _ = rmidi(sp, [{"at": 0.0, "data": [0x90, 69, 30]}], 0.5)
    L2, _ = rmidi(sp, [{"at": 0.0, "data": [0x90, 69, 127]}], 0.5)
    ck("12. MIDI velocity: harder is louder", np.sqrt(np.mean(L2[SR // 8:] ** 2)) > 1.3 * np.sqrt(np.mean(L[SR // 8:] ** 2)))
    L, _ = rmidi(sp, [{"at": 0.0, "data": [0x90, 69, 100]}, {"at": 0.3, "data": [0x80, 69, 0]}], 0.6)
    ck("12. MIDI note off releases the note", np.max(np.abs(L[int(0.45 * SR):])) < 1e-3, np.max(np.abs(L[int(0.45 * SR):])))
    L, _ = rmidi(sp, [{"at": 0.0, "data": [0xB0, 64, 127]}, {"at": 0.0, "data": [0x90, 69, 100]}, {"at": 0.2, "data": [0x80, 69, 0]},
                      {"at": 0.5, "data": [0xB0, 64, 0]}], 0.8)
    ck("12. MIDI CC64 sustain holds a released note until the pedal lifts",
       np.max(np.abs(L[int(0.3 * SR):int(0.48 * SR)])) > 0.05 and np.max(np.abs(L[int(0.6 * SR):])) < 1e-3)
    vib = patch(osc1={"wave": "sine", "level": 0.8}, mw={"vib": 100}, lfo1={"rate": 5, "pitch": 0, "wave": "sine"})
    def fm_depth(x):
        # instantaneous frequency from zero crossings
        zc = np.where((x[:-1] < 0) & (x[1:] >= 0))[0]; fr = x[zc] / (x[zc] - x[zc + 1]); tz = (zc + fr) / SR
        inst = 1 / np.diff(tz); return float(np.max(inst) / np.min(inst))
    L0, _ = rmidi(vib, [{"at": 0.0, "data": [0x90, 69, 100]}], 1.2)
    L1, _ = rmidi(vib, [{"at": 0.0, "data": [0xB0, 1, 127]}, {"at": 0.0, "data": [0x90, 69, 100]}], 1.2)
    d0, d1 = fm_depth(L0[SR // 4:]), fm_depth(L1[SR // 4:])
    ck(f"12. MIDI CC1 mod wheel adds vibrato (pitch swing {1200 * math.log2(d0):.0f} -> {1200 * math.log2(d1):.0f} cents)", 1200 * math.log2(d1) > 150 and 1200 * math.log2(d0) < 10, (d0, d1))
    bright = patch(osc1={"wave": "saw", "level": 0.8}, filt={"model": "ladder24", "cutoff": 300}, at={"cut": 2})
    def centroid(x):
        X = np.abs(np.fft.rfft(x * np.hanning(len(x)))); f = np.fft.rfftfreq(len(x), 1 / SR); return float(np.sum(X * f) / np.sum(X))
    La, _ = rmidi(bright, [{"at": 0.0, "data": [0x90, 45, 100]}], 0.6)
    Lb, _ = rmidi(bright, [{"at": 0.0, "data": [0xD0, 127]}, {"at": 0.0, "data": [0x90, 45, 100]}], 0.6)
    ca, cb = centroid(La[SR // 4:]), centroid(Lb[SR // 4:])
    ck(f"12. MIDI channel aftertouch opens the filter (spectral centroid {ca:.0f} -> {cb:.0f} Hz)", cb > ca * 1.5, (ca, cb))
    # live path: bytes into the page's handler light up keys and voices
    pg.evaluate("__synth.load('Filament Lead')"); pg.wait_for_timeout(100)
    pg.evaluate("__synth.midi([0x90, 64, 100])"); pg.wait_for_timeout(250)
    st = pg.evaluate("__synth.state()"); m = pg.evaluate("__synth.meter()")
    ck("12. live MIDI note on reaches the engine and lights the key", 64 in st["down"] and m["voices"] >= 1 and
       pg.evaluate("document.querySelector('.key[data-n=\"64\"]').classList.contains('down')"), (st, m))
    pg.evaluate("__synth.midi([0x80, 64, 0])"); pg.evaluate("__synth.midi([0xB0, 64, 127])"); pg.wait_for_timeout(50)
    ck("12. live MIDI note off and sustain pedal", 64 not in pg.evaluate("__synth.state()")["down"] and pg.evaluate("__synth.state()")["sustain"])
    pg.evaluate("__synth.midi([0xB0, 64, 0])")

    # ---------------------------------------------------------------- playing it (desktop)
    pg.evaluate("__synth.load('Wide Novachord Strings')"); pg.wait_for_timeout(150)
    k = pg.query_selector('.key[data-n="60"]'); k.scroll_into_view_if_needed(); bb = k.bounding_box()
    pg.mouse.move(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] * 0.9); pg.mouse.down(); pg.wait_for_timeout(250)
    ck("on-screen key plays a note", 60 in pg.evaluate("__synth.state()")["down"] and pg.evaluate("__synth.meter()")["voices"] >= 1)
    pg.mouse.up(); pg.wait_for_timeout(50)
    ck("releasing the on-screen key lets go", 60 not in pg.evaluate("__synth.state()")["down"])
    pg.keyboard.down("a"); pg.keyboard.down("g"); pg.wait_for_timeout(120)
    oct_ = pg.evaluate("__synth.state()")["oct"]; base_ = 12 * (oct_ + 1)
    ck("computer keyboard A and G play C and G", {base_, base_ + 7} <= set(pg.evaluate("__synth.state()")["down"]), pg.evaluate("__synth.state()"))
    pg.keyboard.up("a"); pg.keyboard.up("g")
    pg.keyboard.press("x"); ck("X shifts the octave up", pg.evaluate("__synth.state()")["oct"] == oct_ + 1)
    pg.keyboard.press("z")
    pg.keyboard.down(" "); ck("space is the sustain pedal", pg.evaluate("__synth.state()")["sustain"]); pg.keyboard.up(" ")
    ck("sustain pedal up", not pg.evaluate("__synth.state()")["sustain"])

    # ---------------------------------------------------------------- stuck keys
    # A second keydown that is not marked repeat (Shift reissues the key this way) used to
    # bump a refcount. One keyup left the key lit and the gate open.
    def gates():
        pg.wait_for_timeout(90)
        return pg.evaluate("""() => {
          const meters = (__synth.engine() && __synth.engine().meters) || {};
          const notes = {};
          ['filament', 'cathode'].forEach(k => { notes[k] = (meters[k] && meters[k].notes) || []; });
          return { down: __synth.state().down.slice(), keys: document.querySelectorAll('.key.down').length, notes, sustain: __synth.state().sustain, dev: __synth.device() };
        }""")
    def quiet(label):
        g = gates()
        ck(label, g["down"] == [] and g["keys"] == 0 and g["notes"]["filament"] == [] and g["notes"]["cathode"] == [] and not g["sustain"], g)
    pg.keyboard.down("d")
    pg.evaluate("""() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', code: 'KeyD', repeat: true, bubbles: true, cancelable: true }))""")
    ck("key repeat does not stack a second hold", pg.evaluate("__synth.state().down").count(pg.evaluate("12 * (__synth.state().oct + 1) + 4")) == 1)
    pg.keyboard.up("d")
    quiet("key repeat still releases on keyup")
    pg.keyboard.down("d")
    pg.evaluate("""() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', code: 'KeyD', repeat: false, shiftKey: true, bubbles: true, cancelable: true }))""")
    pg.keyboard.up("d")
    quiet("a Shift reissue of a held key does not stick after keyup")
    pg.keyboard.down("Shift"); pg.keyboard.down("a"); pg.keyboard.up("a"); pg.keyboard.up("Shift")
    quiet("real Shift+A presses and releases")
    pg.keyboard.down("Shift"); pg.keyboard.down(";"); pg.keyboard.up(";"); pg.keyboard.up("Shift")
    quiet("real Shift+semicolon presses and releases")
    pg.keyboard.down("f"); pg.keyboard.down("Control"); pg.keyboard.up("Control")
    ck("Ctrl while a key is held does not drop or stick it", len(pg.evaluate("__synth.state().down")) == 1)
    pg.keyboard.up("f")
    quiet("releasing the key after Ctrl lets go")
    k60 = pg.query_selector('.key[data-n="60"]'); k60.scroll_into_view_if_needed(); b60 = k60.bounding_box()
    pg.mouse.move(b60["x"] + b60["width"] / 2, b60["y"] + b60["height"] / 2); pg.mouse.down()
    pg.mouse.move(10, 10); pg.mouse.up(); quiet("drag off a key and release outside lets go")
    k64 = pg.query_selector('.key[data-n="64"]'); k64.scroll_into_view_if_needed(); b64 = k64.bounding_box()
    pg.mouse.move(b60["x"] + b60["width"] / 2, b60["y"] + b60["height"] / 2); pg.mouse.down()
    pg.mouse.move(b64["x"] + b64["width"] / 2, b64["y"] + b64["height"] / 2)
    ck("glissando moves the hold to the new key", 64 in pg.evaluate("__synth.state().down") and 60 not in pg.evaluate("__synth.state().down"))
    pg.mouse.move(12, 12); pg.mouse.up(); quiet("glissando then release outside lets go")
    pg.keyboard.down("g")
    pg.evaluate("window.dispatchEvent(new Event('blur'))")
    ck("blur releases a computer key before keyup", pg.evaluate("__synth.state().down") == [])
    pg.keyboard.up("g"); quiet("keyup after blur does not stick the key")
    pg.mouse.move(b64["x"] + b64["width"] / 2, b64["y"] + b64["height"] / 2); pg.mouse.down()
    pg.evaluate("window.dispatchEvent(new Event('blur'))")
    ck("blur releases a pointer-held key before mouseup", 64 not in pg.evaluate("__synth.state().down"))
    pg.mouse.up(); quiet("mouseup after blur does not stick the key")
    pg.keyboard.down("h")
    pg.evaluate("""() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); }""")
    ck("a hidden tab releases held keys", pg.evaluate("__synth.state().down") == [])
    pg.evaluate("""() => { delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); }""")
    pg.keyboard.up("h"); quiet("keyup after a tab hide does not stick the key")
    pg.evaluate("__synth.midi([0x90, 67, 100])"); pg.wait_for_timeout(40)
    pg.evaluate("window.dispatchEvent(new Event('blur'))")
    quiet("blur releases a Web MIDI note")
    pg.evaluate("__synth.midi([0x90, 60, 100])"); pg.evaluate("__synth.midi([0x90, 64, 110])"); pg.wait_for_timeout(40)
    pg.evaluate("__synth.midi([0xB0, 123, 0])")
    quiet("MIDI all-notes-off (CC 123) releases every note")
    pg.keyboard.down("j"); pg.click("#devC"); pg.wait_for_timeout(120)
    g = gates()
    ck("switching device mid-note releases it on both devices", g["down"] == [] and g["notes"]["filament"] == [] and g["notes"]["cathode"] == [] and g["dev"] == "cathode", g)
    pg.keyboard.up("j"); quiet("keyup after a device switch does not stick")
    pg.keyboard.down("j"); pg.wait_for_timeout(40)
    ck("a new key works on the device switched to", len(pg.evaluate("__synth.state().down")) == 1 and pg.evaluate("__synth.device()") == "cathode")
    pg.keyboard.up("j"); pg.click("#devF"); pg.wait_for_timeout(120)
    quiet("switching back to Filament leaves no note")
    ck("the Filament patch is still the one that was playing", pg.evaluate("__synth.patch().name") == "Wide Novachord Strings")
    pg.keyboard.down("k"); pg.click("#panicBtn"); pg.wait_for_timeout(40)
    ck("panic silences a held key", pg.evaluate("__synth.state().down") == [])
    pg.keyboard.up("k"); quiet("keyup after panic does not stick")
    touch = pg.evaluate("""() => {
      const fire = (el, type, id) => {
        const r = el.getBoundingClientRect();
        el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: id === 1, button: 0, buttons: type === 'pointerdown' ? 1 : 0, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
      };
      const a = document.querySelector('.key[data-n="60"]'), b = document.querySelector('.key[data-n="67"]');
      fire(a, 'pointerdown', 11); fire(b, 'pointerdown', 12);
      const both = __synth.state().down.slice().sort((x, y) => x - y);
      fire(a, 'pointerup', 11);
      const one = __synth.state().down.slice();
      const ids = __synth.state().ptrs.slice();
      return { both, one, ids };
    }""")
    ck("two touches hold two notes, and lifting one leaves the other", touch["both"] == [60, 67] and touch["one"] == [67] and 12 in touch["ids"], touch)
    pg.evaluate("""() => { const id = __synth.state().ptrs[0]; window.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, cancelable: true, pointerId: id })); }""")
    quiet("pointercancel releases the remaining touch")
    pg.evaluate("""() => {
      const el = document.querySelector('.key[data-n="72"]');
      const r = el.getBoundingClientRect();
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 21, pointerType: 'touch', button: 0, buttons: 1, clientX: r.left + 4, clientY: r.top + 4 }));
    }""")
    ck("a touch that cannot capture the pointer still starts the note", 72 in pg.evaluate("__synth.state().down"))
    pg.evaluate("window.dispatchEvent(new Event('blur'))")
    quiet("blur releases that touch")
    HOLD = mthd(0, 1, 96) + mtrk([0] + tempo(500000) + [0, 0x90, 60, 100] + vlq(768) + [0x80, 60, 0] + EOT)
    pg.evaluate("a => __synth.deck().importBytes(a, 'hold.mid')", HOLD)
    pg.evaluate("() => { const t = document.getElementById('tempoIn'); t.value = 100; t.dispatchEvent(new Event('input')); }")
    pg.evaluate("__synth.deck().play('file')"); pg.wait_for_timeout(250)
    ck("deck playback is holding the long note", pg.evaluate("__synth.deck().playing()") and 60 in pg.evaluate("__synth.engine().meters.filament.notes"))
    pg.evaluate("() => { const t = document.getElementById('tempoIn'); t.value = 200; t.dispatchEvent(new Event('input')); }")
    pg.wait_for_timeout(200)
    pg.evaluate("__synth.deck().stop()"); pg.wait_for_timeout(150)
    quiet("deck stop after a tempo change sends all-notes-off")
    pg.evaluate("__synth.deck().play('file')"); pg.wait_for_timeout(200)
    pg.evaluate("() => { const t = document.getElementById('tempoIn'); t.value = 200; t.dispatchEvent(new Event('input')); }")
    pg.wait_for_timeout(2600)
    quiet("a tempo change still delivers the note off")
    pg.evaluate("__synth.deck().stop()")
    pg.evaluate("() => { const t = document.getElementById('tempoIn'); t.value = 100; t.dispatchEvent(new Event('input')); }")
    # knob drag changes the patch
    kn = pg.query_selector('.knob[data-path="filt.cutoff"]'); kn.scroll_into_view_if_needed(); bb = kn.bounding_box(); before = pg.evaluate("__synth.patch().filt.cutoff")
    pg.mouse.move(bb["x"] + bb["width"] / 2, bb["y"] + 20); pg.mouse.down(); pg.mouse.move(bb["x"] + bb["width"] / 2, bb["y"] - 40, steps=6); pg.mouse.up()
    after = pg.evaluate("__synth.patch().filt.cutoff")
    ck(f"dragging the cutoff knob up raises the cutoff ({before:.0f} -> {after:.0f} Hz)", after > before * 1.2, (before, after))
    ck("an edited patch is marked edited in the list", pg.evaluate("document.getElementById('patchSel').value") == "__edit")
    # patch select
    pg.select_option("#patchSel", "f:Plate Bass"); pg.wait_for_timeout(100)
    ck("choosing a patch loads it", pg.evaluate("__synth.patch().name") == "Plate Bass" and pg.evaluate("__synth.patch().filt.model") == "ladder24")
    ck("the Ladder hides the Valve-only loop tube row", not pg.is_visible("#loopChips"))
    pg.click('.chip[data-v="valve12"]'); ck("model chip switches to Valve 12", pg.evaluate("__synth.patch().filt.model") == "valve12" and pg.is_visible("#loopChips"))
    pg.click('#mFilt .chip[data-v="EL34"]'); ck("loop tube chip sets V2 and the chassis label", pg.evaluate("__synth.patch().filt.tube") == "EL34" and pg.inner_text("#nameV2") == "EL34")
    # save a user patch, reload, still there
    pg.click("#saveP"); pg.fill("#saveName", "Test Bass"); pg.click("#saveOk"); pg.wait_for_timeout(100)
    pg.reload(); pg.wait_for_function("window.__synth && __synth.ready()", timeout=20000)
    ck("a saved patch survives a reload and comes back selected", pg.evaluate("document.getElementById('patchSel').value") == "u:Test Bass" and pg.evaluate("__synth.patch().filt.tube") == "EL34")
    pg.click("#delP"); pg.wait_for_timeout(100)
    ck("delete removes the user patch", "u:Test Bass" not in pg.evaluate("[...document.querySelectorAll('#patchSel option')].map(o=>o.value)"))
    # tubes are painted and the chassis is alive
    pg.wait_for_timeout(600)
    lit = pg.evaluate("""() => { const c = document.getElementById('tubeV3'), x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < x.length; i += 4) s += x[i]; return s / (x.length / 4); }""")
    ck(f"the output tube canvas is painted (mean red {lit:.1f})", lit > 5, lit)
    ck("tip link points at the OTR Ko-fi page", pg.get_attribute(".top .sup", "href") == "https://ko-fi.com/oldtimeradio")
    pg.screenshot(path=os.path.join(SHOTS, "synth_desktop.png"), full_page=True)
    ck("desktop: no page errors", not errs, errs)

    # ---------------------------------------------------------------- M. master bus: reverb, delay, compressor, WAV
    import struct
    def rms(x): return float(np.sqrt(np.mean(np.square(x)))) if len(x) else 0.0
    def win(x, a, b): return x[int(a * SR):int(b * SR)]
    tone = patch(osc1={"wave": "sine", "level": 0.9, "fixed": 330}, envA={"a": 0.001, "d": 0.05, "s": 1, "r": 0.004},
                 filt={"cutoff": 12000, "res": 0}, v1={"drive": 0}, out={"level": 0, "drive": 0, "roomOn": False, "wOn": False, "spkOn": False})
    blip = note(60, 0.05, 0.09)
    dryL, dryR = render(tone, blip, 1.2, rack=False)
    bareL, bareR = render(tone, blip, 1.2, rack=False, masterFx=False)
    # Oscillators start at a random phase, so two renders are not sample-identical.
    # A transparent bus still matches the amplitude envelope, the level and the silence after the note.
    def menv(x, n=480):
        return np.array([np.sqrt(np.mean(x[i:i + n] ** 2)) for i in range(0, len(x) - n, n // 2)])
    egap = float(np.max(np.abs(menv(dryL) - menv(bareL))))
    nr = rms(win(dryL, 0.06, 0.09)) / max(rms(win(bareL, 0.06, 0.09)), 1e-12)
    tail_d, tail_b = rms(win(dryL, 0.3, 0.8)), rms(win(bareL, 0.3, 0.8))
    lr = float(np.max(np.abs(dryL - dryR)))
    ck(f"M. bypass is transparent (envelope {egap:.2e}, level {nr:.3f}, tail {tail_d:.2e})",
       egap < 0.02 and 0.97 < nr < 1.03 and tail_d < 1e-5 and tail_b < 1e-5 and lr < 1e-5, (egap, nr, tail_d, lr))
    # delay: full wet, 250 ms, no feedback. The blip leaves the dry window and comes back in the echo window.
    dly = {"delay": {"on": True, "sync": False, "time": 250, "feedback": 0, "mix": 1, "ping": False, "offset": 0}}
    dL, dR = render(tone, blip, 1.2, rack=False, master=dly)
    dry_w, echo_w = rms(win(dL, 0.05, 0.16)), rms(win(dL, 0.28, 0.42))
    bare_echo = rms(win(dryL, 0.28, 0.42))
    ck(f"M. delay moves the blip to 250 ms (echo {db(echo_w):.1f} dB, dry window {db(dry_w):.1f} dB, bypass echo {db(bare_echo):.1f} dB)",
       echo_w > 1e-3 and echo_w > dry_w * 4 and echo_w > bare_echo * 10, (echo_w, dry_w, bare_echo))
    # tempo sync: 120 BPM eighth note is the same 250 ms; a quarter note lands later, not there.
    sync8 = {"tempo": 120, "delay": {"on": True, "sync": True, "div": "1/8", "feedback": 0, "mix": 1, "ping": False}}
    sL, _ = render(tone, blip, 1.2, rack=False, master=sync8)
    ck("M. synced 1/8 at 120 BPM delays by 250 ms", rms(win(sL, 0.28, 0.42)) > rms(win(sL, 0.05, 0.16)) * 4)
    sync4 = {"tempo": 120, "delay": {"on": True, "sync": True, "div": "1/4", "feedback": 0, "mix": 1, "ping": False}}
    qL, _ = render(tone, blip, 1.2, rack=False, master=sync4)
    ck("M. synced 1/4 at 120 BPM delays by 500 ms, not 250",
       rms(win(qL, 0.52, 0.68)) > 1e-3 and rms(win(qL, 0.52, 0.68)) > rms(win(qL, 0.28, 0.42)) * 4)
    st = pg.evaluate("""() => __synth.setMaster({tempo:120, delay:{on:false, sync:true, div:'1/8'}})""")
    ck(f"M. an eighth note at 120 BPM is 250 ms ({st['delaySec']*1000:.1f} ms)", abs(st["delaySec"] - 0.25) < 1e-6, st["delaySec"])
    st = pg.evaluate("""() => __synth.setMaster({tempo:100, delay:{sync:true, div:'1/4', offset:1, ping:false}})""")
    ck("M. right offset doubles the right delay when sync is on", abs(st["delaySec"] - 0.6) < 1e-6 and abs(st["delaySecR"] - 1.2) < 1e-6, st)
    # ping-pong: first repeat on the right, the next one on the left.
    png = {"delay": {"on": True, "sync": False, "time": 200, "feedback": 0, "mix": 1, "ping": True}}
    pL, pR = render(tone, blip, 0.9, rack=False, master=png)
    r1, l1 = rms(win(pR, 0.23, 0.34)), rms(win(pL, 0.23, 0.34))
    l2, r2 = rms(win(pL, 0.43, 0.54)), rms(win(pR, 0.43, 0.54))
    ck(f"M. ping-pong alternates sides (R then L, {db(r1):.1f}/{db(l1):.1f} then {db(l2):.1f}/{db(r2):.1f} dB)",
       r1 > l1 * 3 and l2 > r2 * 3 and r1 > 1e-3, (r1, l1, l2, r2))
    # reverb tail after the note has gone
    held = note(60, 0.05, 0.22)
    rev = {"reverb": {"on": True, "size": 0.85, "damp": 0.15, "mix": 1, "width": 1}}
    rL, rR = render(tone, held, 2.0, rack=False, master=rev)
    bL, bR = render(tone, held, 2.0, rack=False)
    tail, bare = rms(win(rL, 1.0, 1.8)), rms(win(bL, 1.0, 1.8))
    ck(f"M. reverb leaves a tail ({db(tail):.1f} dB, bypass {db(bare):.1f} dB)", tail > 1e-4 and tail > bare * 20, (tail, bare))
    wide = rms(win(rL - rR, 0.4, 1.2)); mid = rms(win((rL + rR) * 0.5, 0.4, 1.2))
    ck(f"M. reverb width is stereo (side {db(wide):.1f} dB, mid {db(mid):.1f} dB)", wide > mid * 0.05 and wide > 1e-4, (wide, mid))
    # compressor pulls a sustained tone down; the limiter holds the peak near its ceiling
    sus = patch(osc1={"wave": "sine", "level": 0.9, "fixed": 220}, envA={"a": 0.002, "d": 0.1, "s": 1, "r": 0.05},
                filt={"cutoff": 12000}, out={"level": 6, "drive": 0})
    hold = note(60, 0.02)
    c0L, _ = render(sus, hold, 1.0, rack=False)
    seg = slice(int(0.35 * SR), int(0.9 * SR))
    c1L, _ = render(sus, hold, 1.0, rack=False, master={"comp": {"on": True, "threshold": -36, "ratio": 10, "attack": 3, "release": 80, "knee": 0, "makeup": 0, "limit": False}})
    ck(f"M. compressor lowers a loud tone ({db(rms(c0L[seg])):.1f} -> {db(rms(c1L[seg])):.1f} dB RMS)",
       rms(c1L[seg]) < rms(c0L[seg]) * 0.5 and rms(c1L[seg]) > 1e-4, (rms(c0L[seg]), rms(c1L[seg])))
    pk = float(np.max(np.abs(c0L[seg])))
    ceil = db(pk) - 12
    limL, _ = render(sus, hold, 1.0, rack=False, master={"comp": {"on": True, "threshold": 0, "ratio": 1, "knee": 0, "makeup": 0, "attack": 1, "release": 40, "limit": True, "ceiling": ceil}})
    pk2 = float(np.max(np.abs(limL[int(0.2 * SR):])))
    ck(f"M. limiter holds the peak near its ceiling ({db(pk):.1f} -> {db(pk2):.1f} dBFS, ceiling {ceil:.1f} dB)",
       pk2 < pk * 0.55 and pk2 > 0, (pk, pk2, ceil))
    # bypass buttons on the strip
    pg.click("#fxRev"); pg.wait_for_timeout(40)
    ck("M. reverb button switches the bus on", pg.get_attribute("#fxRev", "aria-pressed") == "true" and pg.evaluate("__synth.master().reverb.on") is True)
    pg.click("#fxRev"); pg.wait_for_timeout(40)
    ck("M. reverb button bypasses it again", pg.get_attribute("#fxRev", "aria-pressed") == "false" and pg.evaluate("__synth.master().reverb.on") is False)
    pg.click("#fxDelay"); pg.click("#fxComp"); pg.wait_for_timeout(40)
    ck("M. delay and compressor each have their own bypass",
       pg.evaluate("__synth.master().delay.on") is True and pg.evaluate("__synth.master().comp.on") is True and pg.evaluate("__synth.master().reverb.on") is False)
    pg.click("#fxDelay"); pg.click("#fxComp")

    def parse_wav(b):
        if len(b) < 44 or b[0:4] != b"RIFF" or b[8:12] != b"WAVE": return None
        o, fmt, data = 12, None, None
        while o + 8 <= len(b):
            cid, sz = b[o:o + 4], int.from_bytes(b[o + 4:o + 8], "little")
            body = b[o + 8:o + 8 + sz]
            if cid == b"fmt ": fmt = body
            elif cid == b"data": data = body
            o += 8 + sz + (sz & 1)
        if not fmt or data is None or len(fmt) < 16: return None
        audio_fmt, ch, rate, byterate, align, bits = struct.unpack("<HHIIHH", fmt[:16])
        return {"fmt": audio_fmt, "ch": ch, "rate": rate, "align": align, "bits": bits, "data": data, "riff": int.from_bytes(b[4:8], "little"), "size": len(b)}

    def pcm24(data):
        n = len(data) // 6
        L = np.empty(n); R = np.empty(n)
        for i in range(n):
            def s24(z):
                v = z[0] | (z[1] << 8) | (z[2] << 16)
                return v - 0x1000000 if v & 0x800000 else v
            L[i] = s24(data[i * 6:i * 6 + 3]) / 8388607
            R[i] = s24(data[i * 6 + 3:i * 6 + 6]) / 8388607
        return L, R

    wsecs = 1.25
    wav = pg.evaluate("""async a => __synth.renderWav(a)""", {"seconds": wsecs, "rack": False, "patch": tone,
        "events": note(60, 0.0, 0.3), "master": {"reverb": {"on": True, "size": 0.8, "damp": 0.2, "mix": 0.7, "width": 1}}})
    raw = base64.b64decode(wav["b64"])
    info_w = parse_wav(raw)
    frames = int(round(wsecs * 44100))
    ck("M. WAV header is 24-bit 44.1 kHz stereo PCM",
       info_w and info_w["fmt"] == 1 and info_w["ch"] == 2 and info_w["rate"] == 44100 and info_w["bits"] == 24 and info_w["align"] == 6, info_w and {k: info_w[k] for k in ("fmt", "ch", "rate", "bits", "align")})
    ck(f"M. WAV length matches {wsecs} s ({frames} frames, file {len(raw)} bytes)",
       info_w and len(info_w["data"]) == frames * 6 and info_w["riff"] == len(raw) - 8 and wav["frames"] == frames, (len(raw), wav["frames"] if wav else None))
    if info_w:
        wL, wR = pcm24(info_w["data"])
        tail = rms(wL[int(0.9 * 44100):])
        ck(f"M. exported WAV is not silent (RMS {db(rms(wL)):.1f} dB, tail {db(tail):.1f} dB)", rms(wL) > 1e-3 and rms(wR) > 1e-3 and tail > 1e-4, (rms(wL), tail))
    else:
        ck("M. exported WAV is not silent", False, "no header")
    pg.fill("#wavSecs", "1")
    with pg.expect_download(timeout=60000) as di:
        pg.click("#wavGo")
    dl = di.value
    dl_bytes = open(dl.path(), "rb").read()
    dl_info = parse_wav(dl_bytes)
    ck(f"M. render button downloads a WAV ({dl.suggested_filename}, {len(dl_bytes)} bytes)",
       dl.suggested_filename.endswith(".wav") and dl_info and dl_info["rate"] == 44100 and dl_info["bits"] == 24 and len(dl_info["data"]) == 44100 * 6, dl.suggested_filename)
    pg.evaluate("__synth.noteOn(60, 0.8)")
    pg.evaluate("() => __synth.recordStart()")
    pg.wait_for_timeout(700)
    pg.evaluate("__synth.noteOff(60)")
    rec = pg.evaluate("() => __synth.recordStop()")
    rec_raw = base64.b64decode(rec["b64"]) if rec and rec.get("b64") else b""
    rec_info = parse_wav(rec_raw) if rec_raw else None
    rec_rms = rms(pcm24(rec_info["data"])[0]) if rec_info and len(rec_info["data"]) >= 6 else 0
    ck(f"M. live recording is a non-silent 24-bit WAV ({rec['frames'] if rec else 0} frames, {db(rec_rms):.1f} dB)",
       rec_info and rec_info["fmt"] == 1 and rec_info["rate"] == 44100 and rec_info["bits"] == 24 and rec_info["ch"] == 2
       and rec["frames"] > 44100 * 0.3 and rec_rms > 1e-3, rec["frames"] if rec else None)
    pg.evaluate("""() => __synth.setMaster({tempo:120, delay:{on:false}, reverb:{on:false}, comp:{on:false}})""")

    # ---------------------------------------------------------------- 10. layout (phone)
    for w, h in ((375, 667), (390, 844)):
        ph = b.new_page(viewport={"width": w, "height": h}, is_mobile=True, has_touch=True, device_scale_factor=2); perr = []
        ph.on("pageerror", lambda e: perr.append(str(e)))
        ph.goto(BASE); ph.wait_for_function("window.__synth && __synth.ready()", timeout=20000); ph.wait_for_timeout(300)
        # on a phone the layout viewport grows to fit anything too wide, so check it stayed at the device width too
        ck(f"10. {w}px: no horizontal scroll", ph.evaluate(f"document.documentElement.scrollWidth <= innerWidth && innerWidth === {w}"), ph.evaluate("[document.documentElement.scrollWidth, innerWidth]"))
        kb = ph.query_selector("#keybed").bounding_box(); ch = ph.query_selector("#chassis").bounding_box()
        ck(f"10. {w}px: keyboard pinned and visible above the fold", kb["y"] >= 0 and kb["y"] + kb["height"] <= h + 1 and kb["height"] > 100, kb)
        ck(f"10. {w}px: chassis visible above the fold", ch["y"] + ch["height"] <= kb["y"] + 1, (ch, kb))
        ck(f"10. {w}px: one section group at a time", ph.evaluate("[...document.querySelectorAll('.mod')].filter(m => m.offsetParent).length") <= 4)
        ph.click(".tabs [data-go=filter]"); ph.wait_for_timeout(100)
        ck(f"10. {w}px: the Filter tab shows the filter", ph.is_visible("#mFilt") and not ph.is_visible("#mOsc1"))
        small = ph.evaluate("""() => [...document.querySelectorAll('.tabs button, .key.w, .btn, .chip')].filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map(e => e.id || e.textContent)""")
        ck(f"10. {w}px: touch targets are 44 px or more", not small, small)
        kk = ph.query_selector('.key.w'); bb = kk.bounding_box()
        ph.touchscreen.tap(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] - 10); ph.wait_for_timeout(200)
        ck(f"10. {w}px: tapping a key starts the audio", ph.evaluate("__synth.state().ctx") == "running")
        ph.screenshot(path=os.path.join(SHOTS, f"synth_phone_{w}.png"))
        ck(f"10. {w}px: the Patch tab belongs to Cathode only", not ph.is_visible('.tabs [data-go="patch"]'))
        ph.tap("#devC"); ph.wait_for_timeout(150); ph.tap('.tabs [data-go="patch"]'); ph.wait_for_timeout(250)
        ck(f"10. {w}px: Cathode's Patch tab shows the jacks, no horizontal scroll", ph.is_visible("#jackfield") and not ph.is_visible("#mCLpf")
           and ph.evaluate(f"document.documentElement.scrollWidth <= innerWidth && innerWidth === {w}"), ph.evaluate("[document.documentElement.scrollWidth, innerWidth]"))
        small = ph.evaluate("""() => [...document.querySelectorAll('.tabs button, .jack, .devbtn, .chip')].filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map(e => e.dataset.id || e.textContent)""")
        ck(f"10. {w}px: jacks, tabs and the rail are 44 px or more", not small, small)
        a = ph.locator('#jackfield .jack[data-kind="out"][data-id="mgTri"]'); a.scroll_into_view_if_needed(); a.tap()
        c = ph.locator('#jackfield .jack[data-kind="in"][data-id="pmA"]'); c.scroll_into_view_if_needed(); c.tap(); ph.wait_for_timeout(100)
        ck(f"10. {w}px: tap an output, tap an input: patched", ph.evaluate("__synth.patch().cables") == [["mgTri", "pmA"]], ph.evaluate("__synth.patch().cables"))
        ph.screenshot(path=os.path.join(SHOTS, f"synth_phone_{w}_patch.png"))
        ph.tap("#devF"); ph.wait_for_timeout(100); ph.tap('.tabs [data-go="play"]'); ph.wait_for_timeout(100)
        ph.locator("#deckBtn").scroll_into_view_if_needed(); ph.locator("#deckBtn").tap()
        ph.set_input_files("#impIn", files=[{"name": "a-rather-long-file-name-for-a-small-phone.mid", "mimeType": "audio/midi", "buffer": bytes(TWO)}]); ph.wait_for_timeout(150)
        ck(f"10. {w}px: MIDI deck open with a file's tracks listed, no horizontal scroll", ph.is_visible("#trackList") and ph.evaluate("document.querySelectorAll('#trackList .trk').length") == 3
           and ph.evaluate(f"document.documentElement.scrollWidth <= innerWidth && innerWidth === {w}"), ph.evaluate("[document.documentElement.scrollWidth, innerWidth]"))
        small = ph.evaluate("""() => [...document.querySelectorAll('#deck .btn, #deck .chip, #tempoIn')].filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map(e => e.id || e.textContent)""")
        ck(f"10. {w}px: the deck's buttons, chips and tempo slider are 44 px or more", not small, small)
        ph.locator("#deck").screenshot(path=os.path.join(SHOTS, f"synth_phone_{w}_deck.png"))
        ph.wait_for_function("() => __synth.player && __synth.player().ready()", timeout=10000)
        ph.locator("#libBtn").scroll_into_view_if_needed(); ph.locator("#libBtn").tap()
        ck(f"10. {w}px: the song library opens without horizontal scroll", ph.is_visible("#libBody")
           and ph.evaluate(f"document.documentElement.scrollWidth <= innerWidth && innerWidth === {w}"), ph.evaluate("[document.documentElement.scrollWidth, innerWidth]"))
        ph.wait_for_function("() => [...document.querySelectorAll('#libPick option')].some(o => o.value === 'beethoven-sym5-i')")
        ph.locator("#libPick").select_option("beethoven-sym5-i")
        ph.wait_for_function("() => { const s = __synth.player().song(); return !!(s && s.name.indexOf('Symphony') >= 0); }", timeout=5000)
        small = ph.evaluate("""() => [...document.querySelectorAll('#library .btn, #library .chip, #libPick')].filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map(e => e.id || e.textContent)""")
        ck(f"10. {w}px: the library's buttons, chips and song list are 44 px or more", not small, small)
        ck(f"10. {w}px: a library song lists its channels, still no horizontal scroll", ph.evaluate("document.querySelectorAll('#libChannels .trk').length") >= 1
           and ph.evaluate(f"document.documentElement.scrollWidth <= innerWidth && innerWidth === {w}"), ph.evaluate("[document.documentElement.scrollWidth, innerWidth]"))
        ph.tap('.tabs [data-go="rack"]'); ph.wait_for_timeout(150)
        ck(f"10. {w}px: the rack tab shows the mixer without horizontal scroll", ph.is_visible("#mHost") and ph.is_visible("#mixFLvl")
           and ph.evaluate(f"document.documentElement.scrollWidth <= innerWidth && innerWidth === {w}"), ph.evaluate("[document.documentElement.scrollWidth, innerWidth]"))
        small = ph.evaluate("""() => [...document.querySelectorAll('#mHost .btn, #mHost .chip, #mHost input')].filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map(e => e.id || e.getAttribute('aria-label') || e.textContent)""")
        ck(f"10. {w}px: mixer, transport and project controls are 44 px or more", not small, small)
        small = ph.evaluate("""() => [...document.querySelectorAll('#mMaster .chip, #mMaster .btn, #wavSecs')].filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map(e => e.id || e.textContent)""")
        ck(f"10. {w}px: master bus is on the Rack tab, no horizontal scroll, 44 px targets",
           ph.is_visible("#mMaster") and ph.is_visible("#fxRev") and not ph.is_visible("#mFilt")
           and ph.evaluate(f"document.documentElement.scrollWidth <= innerWidth && innerWidth === {w}") and not small,
           (ph.evaluate("[document.documentElement.scrollWidth, innerWidth]"), small))
        ck(f"10. {w}px: no page errors", not perr, perr)
        ph.close()
    # Dekatron on a phone, on its own page so the checks above keep starting from Filament.
    ph = b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2); perr = []
    ph.on("pageerror", lambda e: perr.append(str(e)))
    ph.goto(BASE); ph.wait_for_function("window.__synth && __synth.ready()", timeout=20000); ph.wait_for_timeout(200)
    ph.evaluate("__synth.setDevice('dekatron')"); ph.wait_for_timeout(250)
    ck("D. 390px: no horizontal scroll on the pattern", ph.evaluate("document.documentElement.scrollWidth <= innerWidth && innerWidth === 390"),
       ph.evaluate("[document.documentElement.scrollWidth, innerWidth]"))
    ck("D. 390px: the pattern is on screen and Filament's sections are not", ph.is_visible("#mDrumGrid") and ph.is_visible("#drumPlay") and not ph.is_visible("#mFilt"))
    small = ph.evaluate("""() => [...document.querySelectorAll('#drumRoot .dstep, #drumRoot .dpad, #drumPlay, .devbtn, .tabs button')].filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map(e => (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))""")
    ck("D. 390px: steps, pads, play and the rail are 44 px or more", not small, small)
    ph.tap('.tabs [data-go="voice"]'); ph.wait_for_timeout(200)
    ck("D. 390px: the Voice tab shows the voice knobs, still no horizontal scroll", ph.is_visible("#mDrumVoice") and not ph.is_visible("#mDrumGrid")
       and ph.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    small = ph.evaluate("""() => [...document.querySelectorAll('#drumVoices .chip, .tabs button')].filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map(e => e.textContent.trim())""")
    ck("D. 390px: voice chips are 44 px or more", not small, small)
    ph.screenshot(path=os.path.join(SHOTS, "synth_dekatron_phone.png"))
    ph.evaluate("__synth.setDevice('filament')")
    ck("D. 390px: no page errors", not perr, perr)
    ph.close()
    ph = b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2); perr = []
    ph.on("pageerror", lambda e: perr.append(str(e)))
    ph.goto(BASE); ph.wait_for_function("window.__synth && __synth.ready()", timeout=20000); ph.wait_for_timeout(200)
    ph.evaluate("__synth.setDevice('thyratron')"); ph.wait_for_timeout(250)
    ck("T. 390px: no horizontal scroll", ph.evaluate("document.documentElement.scrollWidth <= innerWidth && innerWidth === 390"),
       ph.evaluate("[document.documentElement.scrollWidth, innerWidth]"))
    ck("T. 390px: the ladder is on screen and Filament's sections are not", ph.is_visible("#mThyLad") and ph.is_visible("#mThyPlay") and not ph.is_visible("#mFilt") and not ph.is_visible("#mStereo"))
    ck("T. 390px: one section group at a time", ph.evaluate("[...document.querySelectorAll('.mod')].filter(m => m.offsetParent).length") <= 4)
    small = ph.evaluate("""() => [...document.querySelectorAll('.devbtn, .tabs button, #mThyPlay .knob')].filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map(e => (e.id || e.textContent || '').trim().slice(0, 24) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))""")
    ck("T. 390px: the rail, tabs and play knobs are 44 px or more", not small, small)
    ph.tap('.tabs [data-go="osc"]'); ph.wait_for_timeout(200)
    ck("T. 390px: the Osc tab shows the oscillators, still no horizontal scroll", ph.is_visible("#mThyOsc") and not ph.is_visible("#mThyPlay")
       and ph.evaluate("document.documentElement.scrollWidth <= innerWidth && innerWidth === 390"))
    small = ph.evaluate("""() => [...document.querySelectorAll('#thyOsc .chip, #thyLfo')].filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map(e => e.textContent.trim() + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))""")
    ck("T. 390px: waveform and footage chips are 44 px or more", not small, small)
    ph.screenshot(path=os.path.join(SHOTS, "synth_thyratron_phone.png"))
    ph.evaluate("__synth.setDevice('filament')")
    ck("T. 390px: no page errors", not perr, perr)
    ph.close()


    # ---------------------------------------------------------------- R. the rack framework
    def rms(x):
        seg = x[len(x) // 2:]
        return float(np.sqrt(np.mean(seg ** 2)))
    pure = pg.evaluate("""async () => {
      const t = await import('/synth/transport.js');
      const m = await import('/synth/mixer.js');
      const d = await import('/synth/device.js');
      const p = await import('/synth/project.js');
      const ticks = t.clockTicks(0, 1);
      const ev = ticks.map(n => t.describeTick(n, 120, [4, 4], 0, 0));
      const gaps = ev.slice(1).map((e, i) => e.time - ev[i].time);
      const proj = p.normalizeProject({ name: ' Night Shift ', tempo: 10, device: 'nope', mixer: { filament: { level: 2, pan: -3, mute: 1 } }, devices: { filament: { patch: { osc1: { wave: 'sine' } } } } });
      const fil = d.getDevice('filament'), cat = d.getDevice('cathode');
      return {
        n: ticks.length, gap: gaps[0], same: gaps.every(g => Math.abs(g - gaps[0]) < 1e-9),
        bar: t.describeTick(96, 120, [4, 4], 0, 0).bar, tempo: t.clampTempo(10),
        balL: m.balanceGains(0).l, balR: m.balanceGains(0).r, hard: m.balanceGains(1).l, half: m.balanceGains(0.5).l,
        api: fil.api, outs: fil.audioOutputs, midi: fil.midiInput, cut: fil.parameters['filt.cutoff'].default,
        nParam: Object.keys(fil.parameters).length, catWave: cat.parameters['vco1.wave'].type,
        catChoices: cat.parameters['vco1.wave'].choices,
        name: proj.name, pTempo: proj.tempo, pDev: proj.device, pMix: proj.mixer.filament,
        wave: proj.devices.filament.patch.osc1.wave, catDev: proj.devices.cathode.patch.device,
        file: p.projectFileName(proj), both: d.listDevices().map(x => x.id),
      };
    }""")
    ck("R. one quarter at 120 BPM is 24 clock pulses, 20.833 ms apart", pure["n"] == 24 and abs(pure["gap"] - 0.5 / 24) < 1e-9 and pure["same"], pure["gap"])
    ck("R. beat 4 is the downbeat of the next bar in 4/4", pure["bar"] == 1, pure["bar"])
    ck("R. tempo clamps to 40..240", pure["tempo"] == 40, pure["tempo"])
    ck("R. centre pan is unity and a hard right pan drops the left", abs(pure["balL"] - 1) < 1e-12 and abs(pure["balR"] - 1) < 1e-12 and abs(pure["hard"]) < 1e-12 and abs(pure["half"] - 0.7071067811865476) < 1e-9, pure)
    ck("R. Filament and Cathode publish the device contract", pure["api"] == "dxrack/1" and pure["outs"] == 1 and pure["midi"] and pure["cut"] == 1800 and pure["nParam"] > 40 and pure["catWave"] == "choice" and "saw" in pure["catChoices"] and pure["both"] == ["filament", "cathode", "thyratron", "gleam", "dekatron", "lattice"], pure)
    ck("R. a project normalizes tempo, mixer, both patches and a file name", pure["name"] == "Night Shift" and pure["pTempo"] == 40 and pure["pDev"] == "filament" and pure["pMix"]["level"] == 1 and pure["pMix"]["pan"] == -1 and pure["pMix"]["mute"] and pure["wave"] == "sine" and pure["catDev"] == "cathode" and pure["file"] == "filament-night-shift.json", pure)

    tone = patch(osc1={"wave": "sine", "level": 0.5}, stereo={"pan": "center", "spread": 0})
    baseL, baseR = render(tone, note(69, 0.0, 1.0), 1.2, rack=False)
    a = rms(baseL)
    halfL, halfR = render(tone, note(69, 0.0, 1.0), 1.2, rack=False, mixer={"filament": {"level": 0.5}})
    ck(f"R. mixer level 0.5 is -6 dB ({db(rms(halfL) / a):+.2f} dB)", abs(db(rms(halfL) / a) + 6) < 0.25 and abs(db(rms(halfR) / a) + 6) < 0.25, (db(rms(halfL) / a), db(rms(halfR) / a)))
    muteL, muteR = render(tone, note(69, 0.0, 1.0), 1.2, rack=False, mixer={"filament": {"mute": True}})
    ck("R. mute silences the device", rms(muteL) < 1e-6 and rms(muteR) < 1e-6, (rms(muteL), rms(muteR)))
    soloL, soloR = render(tone, note(69, 0.0, 1.0), 1.2, rack=False, mixer={"cathode": {"solo": True}})
    ck("R. solo on the other device mutes this one", rms(soloL) < 1e-6 and rms(soloR) < 1e-6, (rms(soloL), rms(soloR)))
    panL, panR = render(tone, note(69, 0.0, 1.0), 1.2, rack=False, mixer={"filament": {"pan": 0.5}})
    ck(f"R. pan 0.5 drops the left by 3 dB and keeps the right ({db(rms(panL) / rms(panR)):.2f} dB)", abs(db(rms(panL) / rms(panR)) + 3.0103) < 0.4 and abs(db(rms(panR) / rms(baseR))) < 0.4, (db(rms(panL) / rms(panR)), db(rms(panR) / rms(baseR))))
    hardL, hardR = render(tone, note(69, 0.0, 1.0), 1.2, rack=False, mixer={"filament": {"pan": 1}})
    ck("R. pan hard right keeps the right and silences the left", rms(hardL) < 1e-4 and rms(hardR) > a * 0.5, (rms(hardL), rms(hardR), a))
    ck("R. a default strip leaves a centred voice identical on left and right", float(np.max(np.abs(baseL - baseR))) == 0.0, float(np.max(np.abs(baseL - baseR))))

    live = pg.evaluate("""async () => {
      await __synth.engine().ctx.resume();
      const got = [];
      const off = __synth.deviceApi('filament').subscribe(e => got.push(e.type));
      __synth.transport().play();
      await new Promise(r => setTimeout(r, 180));
      const mid = __synth.transport().state();
      __synth.transport().stop();
      const held = __synth.transport().state();
      __synth.transport().stop();
      const home = __synth.transport().state();
      off();
      const cut = __synth.deviceApi('filament').setParameter('filt.cutoff', 1234);
      const read = __synth.deviceApi('filament').getParameter('filt.cutoff');
      __synth.registerDevice({ id: 'sequencer', name: 'Step Sequencer', instrument: false, midiInput: false, midiOutput: true, audioOutputs: 0, description: 'A device other code can register.' });
      return { got, playing: mid.playing, beat: mid.beat, heldBeat: held.beat, heldPlaying: held.playing, home: home.beat, cut, read, ids: __synth.devices().map(d => d.id) };
    }""")
    ck("R. play emits clock events a device can subscribe to", live["playing"] and "play" in live["got"] and live["got"].count("clock") >= 2 and 0.1 < live["beat"] < 0.7, live)
    ck("R. stop holds the beat and a second stop returns to the start", (not live["heldPlaying"]) and live["heldBeat"] > 0.1 and live["home"] == 0, live)
    ck("R. a parameter id round-trips, and a new device can register", live["cut"] == 1234 and live["read"] == 1234 and "sequencer" in live["ids"], live)

    pg.locator("#mHost").scroll_into_view_if_needed()
    pg.fill("#hostTempo", "100"); pg.locator("#hostTempo").press("Tab"); pg.wait_for_timeout(40)
    ck("R. the tempo field sets the clock", pg.evaluate("__synth.transport().state().tempo") == 100, pg.evaluate("__synth.transport().state().tempo"))
    pg.click("#mixFMute")
    ck("R. the mute button mutes Filament", pg.evaluate("__synth.mixer().filament.mute") is True)
    pg.click("#projSave"); pg.wait_for_timeout(40)
    pg.fill("#hostTempo", "140"); pg.locator("#hostTempo").press("Tab"); pg.wait_for_timeout(40)
    pg.click("#projLoad"); pg.wait_for_timeout(80)
    ck("R. load saved restores the tempo and the mute", pg.evaluate("__synth.transport().state().tempo") == 100 and pg.evaluate("__synth.mixer().filament.mute") is True, pg.evaluate("__synth.transport().state().tempo"))
    with pg.expect_download() as dlinfo:
        pg.click("#projDown")
    saved = json.loads(dlinfo.value.path() and open(dlinfo.value.path(), encoding="utf-8").read())
    ck("R. download is a dxrack project with both devices", saved.get("kind") == "dxrack" and saved.get("v") == 1 and saved.get("tempo") == 100 and "filament" in saved.get("devices", {}) and "cathode" in saved.get("devices", {}) and saved["devices"]["filament"]["patch"]["v"] == 1, saved.get("kind"))
    up = dict(saved)
    up["name"] = "Uploaded"
    up["tempo"] = 88
    up["device"] = "cathode"
    up["mixer"] = {"filament": {"level": 1, "pan": 0, "mute": False, "solo": False}, "cathode": {"level": 0.25, "pan": -1, "mute": False, "solo": True}}
    pg.set_input_files("#projFile", files=[{"name": "uploaded.json", "mimeType": "application/json", "buffer": json.dumps(up).encode()}])
    pg.wait_for_function("__synth.device() === 'cathode' && __synth.transport().state().tempo === 88", timeout=3000)
    got = pg.evaluate("""() => ({ dev: __synth.device(), tempo: __synth.transport().state().tempo, name: document.getElementById('projName').value, mix: __synth.mixer(), patch: __synth.patch().device })""")
    ck("R. upload applies the device, tempo, name and mixer", got["dev"] == "cathode" and got["tempo"] == 88 and got["name"] == "Uploaded" and got["mix"]["cathode"]["level"] == 0.25 and got["mix"]["cathode"]["solo"] and got["mix"]["cathode"]["pan"] == -1 and got["patch"] == "cathode", got)
    pg.reload(); pg.wait_for_function("window.__synth && __synth.ready()", timeout=20000)
    boot = pg.evaluate("""() => ({ tempo: __synth.transport().state().tempo, mix: __synth.mixer().cathode, name: document.getElementById('projName').value })""")
    ck("R. the saved project restores tempo, mixer and name on reload", boot["tempo"] == 88 and abs(boot["mix"]["level"] - 0.25) < 1e-6 and boot["mix"]["solo"] and boot["name"] == "Uploaded", boot)
    ck("R. no page errors", not errs, errs)

    # ---------------------------------------------------------------- P. song library (tonejs midi, transport, routing, Halloween)
    pg.wait_for_function("() => __synth.player && __synth.player().ready()", timeout=10000)
    WANT = ["beethoven-sym5-i", "bach-toccata-fugue-dm", "joplin-maple-leaf-rag", "joplin-the-entertainer",
            "sousa-stars-and-stripes", "traditional-greensleeves", "foster-oh-susanna", "handy-st-louis-blues",
            "traditional-frankie-and-johnny", "dx-pixel-march", "dx-neon-alley", "dx-dock-lamp",
            "bach-toccata-spooky", "grieg-mountain-king", "saint-saens-danse-macabre", "mussorgsky-bald-mountain",
            "chopin-funeral-march", "traditional-dies-irae", "dx-lantern-walk", "dx-cellar-stairs", "dx-porch-ghost"]
    FIL_H = ["Haunted Organ", "Theremin Wail", "Horror Pad", "Creaky Drone", "Ghost Choir", "Sub Heartbeat", "Glass Music Box", "Eerie Bells"]
    CAT_H = ["Chapel Organ", "Wail Glide", "Cellar Drone", "Creak Pulse", "Choir Breath", "Heartbeat", "Glass Tine", "Bell Jar"]
    lib = pg.evaluate("""async () => {
      const { Midi } = await import('/synth/vendor/tonejs-midi.js');
      const library = __synth.player().library();
      const out = [];
      for (const item of library) {
        const res = await fetch('/synth/midi/' + item.file);
        const bytes = new Uint8Array(await res.arrayBuffer());
        const song = __synth.player().parse([...bytes]);
        const midi = new Midi(bytes);
        const toneNotes = midi.tracks.reduce((n, t) => n + t.notes.length, 0);
        const ours = song.tracks.reduce((n, t) => n + t.notes, 0);
        const ons = song.events.filter(e => e.ch === 1 && (e.data[0] & 0xf0) === 0x90).map(e => e.data[1]);
        out.push({ id: item.id, license: item.license, kind: item.kind, presets: item.presets, bpm: song.bpm, channels: song.channels, toneNotes, ours, ons: ons.slice(0, 4), name: song.name, bytes: bytes.length });
      }
      return {
        n: library.length, ids: library.map(i => i.id), out,
        fil: __synth.factory().filter(p => p.cat === 'Halloween').map(p => p.name),
        cat: __synth.cathodeFactory().filter(p => p.cat === 'Halloween').map(p => p.name),
        devs: __synth.devices().map(d => d.id),
      };
    }""")
    by = {row["id"]: row for row in lib["out"]}
    ck("P. the library has the bundled songs, each CC0, and @tonejs/midi counts the same notes",
       lib["n"] == 21 and lib["ids"] == WANT and all(by[i]["license"] == "CC0 1.0" and by[i]["bytes"] > 40 and by[i]["ours"] == by[i]["toneNotes"] and by[i]["ours"] > 0 for i in WANT),
       (lib["n"], lib["ids"], [(r["id"], r["ours"], r["toneNotes"]) for r in lib["out"] if r["ours"] != r["toneNotes"]]))
    ck("P. Beethoven's opening is G4 G4 G4 Eb4", by["beethoven-sym5-i"]["ons"] == [67, 67, 67, 63] and abs(by["beethoven-sym5-i"]["bpm"] - 108) < 0.02, by["beethoven-sym5-i"])
    ck("P. Bach's toccata opens on A4", by["bach-toccata-fugue-dm"]["ons"][0] == 69, by["bach-toccata-fugue-dm"]["ons"][:2])
    ck("P. Mountain King opens F# F# F# D", by["grieg-mountain-king"]["ons"] == [66, 66, 66, 62], by["grieg-mountain-king"]["ons"])
    ck("P. Halloween presets are factory patches, and Dekatron is in the rack",
       lib["fil"] == FIL_H and lib["cat"] == CAT_H and "dekatron" in lib["devs"], (lib["fil"], lib["cat"], lib["devs"]))
    ck("P. Mountain King, Cellar Stairs and Porch Ghost carry a drum channel",
       10 in by["grieg-mountain-king"]["channels"] and 10 in by["dx-cellar-stairs"]["channels"] and 10 in by["dx-porch-ghost"]["channels"]
       and 10 not in by["saint-saens-danse-macabre"]["channels"] and 10 not in by["dx-lantern-walk"]["channels"]
       and by["grieg-mountain-king"]["presets"].get("dekatron") == "Lantern"
       and by["dx-cellar-stairs"]["presets"].get("dekatron") == "Bones"
       and by["dx-porch-ghost"]["presets"].get("dekatron") == "Lantern",
       [(i, by[i]["channels"], by[i]["presets"]) for i in ("grieg-mountain-king", "dx-cellar-stairs", "dx-porch-ghost", "saint-saens-danse-macabre")])
    spooky = [r for r in lib["out"] if r["kind"] == "halloween"]
    preset_ok = len(spooky) == 9 and all(r["presets"] and r["presets"].get("filament") in FIL_H and r["presets"].get("cathode") in CAT_H for r in spooky)
    ck("P. each Halloween song names a Filament preset and a Cathode preset", preset_ok, [(r["id"], r["presets"]) for r in spooky])
    junk = pg.evaluate("""() => { try { __synth.player().parse([82, 73, 70, 70]); return ''; } catch (e) { return String(e.message || e); } }""")
    ck("P. a file that is not MIDI is refused", "not a MIDI file" in junk, junk)

    route = pg.evaluate("""async () => {
      const { Midi } = await import('/synth/vendor/tonejs-midi.js');
      const m = new Midi();
      m.name = 'route-test';
      m.header.tempos = [{ ticks: 0, bpm: 120 }];
      m.header.timeSignatures = [{ ticks: 0, timeSignature: [4, 4] }];
      m.header.update();
      const lead = m.addTrack(); lead.channel = 0; lead.name = 'Lead';
      lead.addNote({ midi: 69, ticks: 0, durationTicks: 480, velocity: 0.8 });
      lead.addNote({ midi: 76, ticks: 960, durationTicks: 480, velocity: 0.8 });
      const bass = m.addTrack(); bass.channel = 1; bass.name = 'Bass';
      bass.addNote({ midi: 36, ticks: 0, durationTicks: 960, velocity: 0.8 });
      const ok = __synth.player().importBytes([...m.toArray()], 'route-test.mid');
      const ons = __synth.player().score().filter(e => e.t === 'on').map(e => ({ at: e.at, n: e.n, dev: e.dev }));
      __synth.transport().setTempo(60);
      const slow = __synth.player().score().filter(e => e.t === 'on' && e.n === 76)[0];
      __synth.transport().setTempo(120);
      return { ok, name: __synth.player().song().name, route: __synth.player().routing(), ons, slowAt: slow.at, score: __synth.player().score() };
    }""")
    ons = route["ons"]
    ck("P. channel 1 goes to Filament and channel 2 to Cathode",
       route["ok"] and route["name"] == "route-test" and route["route"].get("1") == "filament" and route["route"].get("2") == "cathode", route["route"])
    ck("P. the score follows the transport tempo (E5 at 1 s at 120 BPM, 2 s at 60)",
       any(abs(e["at"] - 0) < 1e-6 and e["n"] == 69 and e["dev"] == "filament" for e in ons)
       and any(abs(e["at"] - 0) < 1e-6 and e["n"] == 36 and e["dev"] == "cathode" for e in ons)
       and any(abs(e["at"] - 1) < 1e-6 and e["n"] == 76 and e["dev"] == "filament" for e in ons)
       and abs(route["slowAt"] - 2) < 1e-6, (ons, route["slowAt"]))
    fast = patch(osc1={"wave": "sine", "level": 0.8}, envA={"a": 0.001, "d": 0.05, "s": 1, "r": 0.02}, ens={"on": False},
                 voice={"mode": "poly", "unison": 1}, stereo={"pan": "center", "spread": 0}, out={"roomOn": False, "wOn": False, "spkOn": False, "drive": 0})
    tri = cpatch(vco1={"wave": "tri", "scale": 8, "level": 0.85}, eg2={"a": 0.001, "d": 0.05, "s": 1, "r": 0.02},
                 out={"roomOn": False, "wOn": False, "spkOn": False, "drive": 0})
    def render_player(events, seconds=2.2):
        body = {"patches": {"filament": fast, "cathode": tri}, "device": "filament", "events": events, "seconds": seconds, "rack": False}
        return dec(pg.evaluate("a => __synth.render2(a)", body))
    L, _R = render_player(route["score"])
    head = L[int(0.08 * SR):int(0.40 * SR)]
    a440, a65, a659 = tone_amp(head, 440.0), tone_amp(head, 65.406), tone_amp(head, 659.255)
    late = L[int(1.12 * SR):int(1.42 * SR)]
    e659, e65 = tone_amp(late, 659.255), tone_amp(late, 65.406)
    oA = onset(L, 0.0, max(a440, 1e-6))
    ck(f"P. playback renders A4 on Filament and C2 on Cathode (A4 onset {None if oA is None else round(1000 * oA, 2)} ms)",
       oA is not None and oA <= 0.005 and a440 > 0.02 and a65 > 0.02 and a440 > 20 * a659, (oA, a440, a65, a659))
    ck(f"P. E5 arrives at 1.000 s ({None if e659 < 0.01 else 'present'})", e659 > 0.02 and e659 > 10 * e65, (e659, e65))
    pg.evaluate("__synth.player().route(2, 'off')")
    off_score = pg.evaluate("__synth.player().score()")
    L, _R = render_player(off_score)
    head = L[int(0.08 * SR):int(0.40 * SR)]
    b440, b65 = tone_amp(head, 440.0), tone_amp(head, 65.406)
    ck("P. routing channel 2 off drops C2 by 30 dB or more and keeps A4", b65 < a65 / 31.6 and b440 > 0.02, (db(b65), db(a65), b440))

    hats_on = pg.evaluate("""async () => {
      await __synth.player().loadId('dx-pixel-march');
      const hats = __synth.player().score().filter(e => e.n === 42);
      return { route: __synth.player().routing(), choices: __synth.player().choices(), hats: hats.length, devs: [...new Set(hats.map(e => e.dev))] };
    }""")
    ck("P. channel 10 goes to Dekatron and the hat notes follow",
       hats_on["route"].get("10") == "dekatron" and "dekatron" in hats_on["choices"] and hats_on["hats"] > 0 and hats_on["devs"] == ["dekatron"], hats_on)

    pg.evaluate("() => { const b = document.getElementById('libBody'); if (b.hidden) document.getElementById('libBtn').click(); }")
    pg.locator("#libPick").select_option("beethoven-sym5-i")
    pg.wait_for_function("() => { const s = __synth.player().song(); return !!(s && s.name.indexOf('Symphony') >= 0); }", timeout=5000)
    ck("P. picking a library song lists its tracks and channel chips",
       pg.locator("#libTracks .trk").count() >= 2 and pg.locator('#libChannels .chip[data-ch="1"][data-dev="filament"]').count() == 1)
    pg.click('#libChannels .chip[data-ch="2"][data-dev="off"]')
    ck("P. a channel chip sets that channel off", pg.evaluate("__synth.player().routing()")["2"] == "off")
    bare = pg.evaluate("""async () => {
      const { Midi } = await import('/synth/vendor/tonejs-midi.js');
      const m = new Midi();
      m.header.tempos = [{ ticks: 0, bpm: 100 }];
      m.header.update();
      const t = m.addTrack(); t.channel = 0;
      t.addNote({ midi: 64, ticks: 0, durationTicks: 480, velocity: 0.8 });
      return [...m.toArray()];
    }""")
    pg.set_input_files("#libIn", files=[{"name": "uploaded.mid", "mimeType": "audio/midi", "buffer": bytes(bare)}])
    pg.wait_for_function("() => { const s = __synth.player().song(); return !!(s && s.name === 'uploaded'); }", timeout=5000)
    ck("P. opening a .mid file loads it under the file name", pg.evaluate("__synth.player().song()")["name"] == "uploaded")
    dropped = pg.evaluate("""async (bytes) => {
      const file = new File([new Uint8Array(bytes)], 'dropped.mid', { type: 'audio/midi' });
      const dt = new DataTransfer();
      dt.items.add(file);
      document.getElementById('library').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
      return true;
    }""", bare)
    pg.wait_for_function("() => { const s = __synth.player().song(); return !!(s && s.name === 'dropped'); }", timeout=5000)
    ck("P. dropping a .mid file on the library loads it", dropped and pg.evaluate("__synth.player().song()")["name"] == "dropped")

    pg.evaluate("""() => __synth.setPatch({
      osc1: { wave: 'sine', level: 0.8 }, osc2: { level: 0 }, sub: { level: 0 }, noise: { level: 0 },
      filt: { cutoff: 8000, res: 0, env: 0, keytrack: 0 },
      envA: { a: 0.001, d: 0.05, s: 1, r: 0.02, vel: 0 }, envF: { a: 0.001, d: 0.1, s: 0, r: 0.1 },
      lfo1: { pitch: 0, cutoff: 0, amp: 0 }, voice: { mode: 'poly', unison: 1, level: 0.8 },
      ens: { on: false }, stereo: { pan: 'center', spread: 0 },
      out: { drive: 0, roomOn: false, wOn: false, spkOn: false }
    })""")
    pg.evaluate("""async () => { await __synth.player().loadId('dx-dock-lamp'); await __synth.engine().ctx.resume(); }""")
    pg.click("#libPlay")
    pg.wait_for_function("""() => {
      const m = __synth.engine().meters.filament;
      return !!(m && m.voices >= 1 && (m.notes || []).indexOf(78) >= 0 && __synth.player().playing());
    }""", timeout=3000)
    heard = pg.evaluate("""() => { const m = __synth.engine().meters.filament; return { voices: m.voices, notes: m.notes, playing: __synth.player().playing(), tempo: __synth.transport().state().tempo }; }""")
    ck("P. play through the transport sounds the Dock Lamp lead (F#5) on Filament",
       heard["playing"] and 78 in heard["notes"] and heard["voices"] >= 1 and abs(heard["tempo"] - 132) < 0.6, heard)
    pg.click("#libStop")
    pg.wait_for_function("""() => { const m = __synth.engine().meters.filament; return !__synth.player().playing() && !!m && (m.notes || []).length === 0; }""", timeout=2000)
    ck("P. stop silences the note and the player", not pg.evaluate("__synth.player().playing()") and pg.evaluate("__synth.engine().meters.filament.notes").__len__() == 0)
    pg.evaluate("""async () => {
      const { Midi } = await import('/synth/vendor/tonejs-midi.js');
      const m = new Midi();
      m.header.tempos = [{ ticks: 0, bpm: 120 }];
      m.header.update();
      const t = m.addTrack(); t.channel = 0;
      t.addNote({ midi: 60, ticks: 0, durationTicks: 960 * 8, velocity: 0.9 });
      __synth.player().importBytes([...m.toArray()], 'stuck-hold.mid');
      __synth.transport().setTempo(120);
      await __synth.engine().ctx.resume();
    }""")
    pg.evaluate("__synth.player().play()"); pg.wait_for_timeout(350)
    ck("library playback is holding its note", pg.evaluate("__synth.player().playing()") and 60 in (pg.evaluate("__synth.engine().meters.filament.notes") or []))
    pg.evaluate("__synth.transport().setTempo(90)"); pg.wait_for_timeout(200)
    pg.evaluate("__synth.player().stop()"); pg.wait_for_timeout(200)
    ck("library stop after a tempo change leaves no note",
       not pg.evaluate("__synth.player().playing()") and pg.evaluate("__synth.engine().meters.filament.notes") == [])

    pg.evaluate("""async () => { await __synth.player().loadId('chopin-funeral-march'); }""")
    pg.wait_for_timeout(40)
    hall = pg.evaluate("""() => ({ song: __synth.player().song(), patch: __synth.patch().name, dev: __synth.device() })""")
    ck("P. the Funeral March loads Haunted Organ and Heartbeat",
       hall["song"] and hall["song"]["name"].find("Funeral") >= 0 and hall["song"]["presets"]
       and hall["song"]["presets"].get("filament") == "Haunted Organ" and hall["song"]["presets"].get("cathode") == "Heartbeat"
       and ((hall["dev"] == "cathode" and hall["patch"] == "Heartbeat") or (hall["dev"] == "filament" and hall["patch"] == "Haunted Organ")), hall)
    other = "filament" if hall["dev"] == "cathode" else "cathode"
    pg.evaluate("d => __synth.setDevice(d)", other)
    other_name = pg.evaluate("__synth.patch().name")
    expect = "Haunted Organ" if other == "filament" else "Heartbeat"
    ck("P. the other device took its Halloween preset too", other_name == expect, (other, other_name))
    pg.evaluate("""async () => { await __synth.player().loadId('dx-cellar-stairs'); }""")
    stairs = pg.evaluate("""() => { const s = __synth.player().song(); return { presets: s && s.presets, fil: __synth.device() === 'filament' ? __synth.patch().name : null }; }""")
    pg.evaluate("__synth.setDevice('filament')")
    stairs_fil = pg.evaluate("__synth.patch().name")
    pg.evaluate("__synth.setDevice('cathode')")
    stairs_cat = pg.evaluate("__synth.patch().name")
    pg.evaluate("__synth.setDevice('dekatron')")
    stairs_drum = pg.evaluate("__synth.patch().name")
    ck("P. Cellar Stairs loads Sub Heartbeat, Creak Pulse and Bones",
       stairs_fil == "Sub Heartbeat" and stairs_cat == "Creak Pulse" and stairs_drum == "Bones", (stairs_fil, stairs_cat, stairs_drum, stairs))
    pg.evaluate("__synth.transport().stop()")
    ck("P. no page errors", not errs, errs)

    # ---------------------------------------------------------------- W. Lattice wavetable
    def fold(freq, sr):
        f = abs(freq) % sr
        return sr - f if f > sr / 2 else f
    def hz(note):
        return 440.0 * (2 ** ((note - 69) / 12))
    def lat(patch, events, seconds=0.5):
        return dec(pg.evaluate("a => __synth.latticeRender(a)", {"patch": patch, "events": events, "seconds": seconds}))
    def lpatch(**over):
        p = {"device": "lattice", "level": 0.55, "bandlimit": True,
             "osc1": {"table": "glass", "pos": 0, "level": 0.7, "warp": "off", "warpAmt": 0, "oct": 0, "semi": 0, "fine": 0},
             "osc2": {"level": 0, "table": "glass", "pos": 0, "warp": "off", "warpAmt": 0},
             "unison": {"count": 1, "detune": 0, "spread": 0},
             "sub": {"level": 0}, "noise": {"level": 0, "color": 0.6},
             "filt": {"route": "serial", "a": {"mode": "lp", "cutoff": 18000, "res": 0, "env": 0}, "b": {"mode": "lp", "cutoff": 18000, "res": 0, "env": 0}},
             "envA": {"a": 0.001, "d": 0.05, "s": 1, "r": 0.02}, "envF": {"a": 0.001, "d": 0.05, "s": 0, "r": 0.05},
             "matrix": []}
        for k, v in over.items():
            if isinstance(v, dict) and isinstance(p.get(k), dict):
                p[k] = dict(p[k]); p[k].update(v)
            else:
                p[k] = v
        return p
    desc = pg.evaluate("""() => {
      const d = __synth.latticeDevice();
      const ids = __synth.devices().map(x => x.id);
      return { id: d.id, api: d.api, instrument: d.instrument, outs: d.audioOutputs, midi: d.midiInput,
        processor: d.processor, worklet: d.worklet, over: d.oversample,
        warp: d.parameters['osc1.warp'].choices, pos: d.parameters['osc1.pos'].type, ids };
    }""")
    ck("W. Lattice publishes the dxrack/1 contract",
       desc["id"] == "lattice" and desc["api"] == "dxrack/1" and desc["instrument"] is True and desc["outs"] == 1 and desc["midi"]
       and desc["processor"] == "lattice" and desc["worklet"] == "lattice.worklet.js" and desc["over"] == 2
       and desc["pos"] == "float" and all(w in desc["warp"] for w in ("bend", "sync", "pwm", "fm"))
       and desc["ids"] == ["filament", "cathode", "thyratron", "gleam", "dekatron", "lattice"], desc)
    L, R = lat(lpatch(), [{"at": 0.02, "t": "on", "n": 69, "v": 0.9}], 0.55)
    seg = L[int(0.12 * SR):int(0.5 * SR)]
    got = peak_freq(seg); cents = abs(1200 * math.log2(got / 440.0))
    ck(f"W. a glass cycle at A4 is 440 Hz ({got:.2f} Hz, {cents:.2f} cents)", cents < 5 and np.max(np.abs(L)) < 1, (got, cents))
    f0 = hz(100); ff = fold(35 * f0, 96000)
    edge = {"osc1": {"table": "edge", "pos": 1, "level": 0.8, "warp": "off"}, "osc2": {"level": 0}}
    Lm, _ = lat(lpatch(bandlimit=True, **edge), [{"at": 0.01, "t": "on", "n": 100, "v": 1}], 0.4)
    Lr, _ = lat(lpatch(bandlimit=False, **edge), [{"at": 0.01, "t": "on", "n": 100, "v": 1}], 0.4)
    sm, sr_ = Lm[int(0.08 * SR):int(0.38 * SR)], Lr[int(0.08 * SR):int(0.38 * SR)]
    mip_db = db(tone_amp(sm, ff) / tone_amp(sm, f0)); raw_db = db(tone_amp(sr_, ff) / tone_amp(sr_, f0))
    ck(f"W. mipmaps drop the folded partial ({mip_db:.0f} dB with, {raw_db:.0f} dB without)", mip_db < -60 and raw_db > -50 and mip_db < raw_db - 40, (mip_db, raw_db, ff))
    f0 = hz(60)
    quiet, bright = [lat(lpatch(osc1={"table": "glass", "pos": pos, "level": 0.7, "warp": "off"}), [{"at": 0.01, "t": "on", "n": 60, "v": 0.9}], 0.4)[0] for pos in (0, 1)]
    h0 = db(tone_amp(quiet[int(0.08 * SR):], 2 * f0) / tone_amp(quiet[int(0.08 * SR):], f0))
    h1 = db(tone_amp(bright[int(0.08 * SR):], 2 * f0) / tone_amp(bright[int(0.08 * SR):], f0))
    ck(f"W. position morphs the cycle (H2 {h0:.0f} dB at the start, {h1:.0f} dB at the end)", h0 < -80 and h1 > -45, (h0, h1))
    f0 = hz(57)
    def upper(x):
        s = x[int(0.08 * SR):]
        return sum(tone_amp(s, h * f0) for h in range(5, 11))
    off = upper(lat(lpatch(osc1={"table": "glass", "pos": 0, "level": 0.7, "warp": "off", "warpAmt": 0}), [{"at": 0.01, "t": "on", "n": 57, "v": 0.9}], 0.45)[0])
    on = upper(lat(lpatch(osc1={"table": "glass", "pos": 0, "level": 0.7, "warp": "sync", "warpAmt": 0.6}), [{"at": 0.01, "t": "on", "n": 57, "v": 0.9}], 0.45)[0])
    ck(f"W. sync warp adds upper harmonics ({on:.3f} vs {off:.3f})", on > 0.05 and off < 0.01, (on, off))
    f0 = hz(69)
    side_off = tone_amp(lat(lpatch(osc1={"table": "glass", "pos": 0, "level": 0.7, "warp": "off", "warpAmt": 0}, osc2={"level": 0, "semi": 7}), [{"at": 0.01, "t": "on", "n": 69, "v": 0.9}], 0.45)[0][int(0.08 * SR):], 2.5 * f0)
    side_on = tone_amp(lat(lpatch(osc1={"table": "glass", "pos": 0, "level": 0.7, "warp": "fm", "warpAmt": 0.65}, osc2={"level": 0, "semi": 7, "table": "glass"}), [{"at": 0.01, "t": "on", "n": 69, "v": 0.9}], 0.45)[0][int(0.08 * SR):], 2.5 * f0)
    ck(f"W. FM from oscillator B makes a sideband ({side_on:.4f} vs {side_off:.4f})", side_on > 0.01 and side_off < 0.002, (side_on, side_off))
    uL, uR = lat(lpatch(unison={"count": 4, "detune": 20, "spread": 1}, osc1={"table": "glass", "pos": 0.4, "level": 0.6}), [{"at": 0.01, "t": "on", "n": 60, "v": 0.8}], 0.4)
    left, right = uL[int(0.1 * SR):], uR[int(0.1 * SR):]
    spread = float(np.sqrt(np.mean((left - right) ** 2)) / max(1e-9, np.sqrt(np.mean(left ** 2))))
    ck(f"W. unison detune and spread separate the channels ({spread:.2f})", spread > 0.4 and float(np.max(np.abs(uL))) <= 1, spread)
    f0 = hz(48)
    def h6(cut):
        x = lat(lpatch(osc1={"table": "edge", "pos": 1, "level": 0.8}, filt={"route": "serial", "a": {"mode": "lp", "cutoff": cut, "res": 0, "env": 0}, "b": {"mode": "lp", "cutoff": 18000, "res": 0, "env": 0}}), [{"at": 0.01, "t": "on", "n": 48, "v": 0.9}], 0.45)[0]
        return tone_amp(x[int(0.1 * SR):], 6 * f0)
    low, high = h6(300), h6(8000)
    ck(f"W. the lowpass moves a high harmonic ({low:.4f} at 300 Hz, {high:.4f} at 8 kHz)", high > low * 3 and low > 0, (low, high))
    f0 = hz(60)
    def fund(route):
        x = lat(lpatch(osc1={"table": "edge", "pos": 1, "level": 0.75}, filt={"route": route, "a": {"mode": "hp", "cutoff": 900, "res": 0, "env": 0}, "b": {"mode": "lp", "cutoff": 400, "res": 0, "env": 0}}), [{"at": 0.01, "t": "on", "n": 60, "v": 0.9}], 0.4)[0]
        return tone_amp(x[int(0.1 * SR):], f0)
    ser, par = fund("serial"), fund("parallel")
    ck(f"W. serial and parallel filters disagree ({ser:.4f} vs {par:.4f})", par > ser * 3, (ser, par))
    half_off = tone_amp(lat(lpatch(osc1={"table": "glass", "pos": 0, "level": 0.35}, sub={"level": 0}), [{"at": 0.01, "t": "on", "n": 60, "v": 0.9}], 0.4)[0][int(0.1 * SR):], f0 / 2)
    half_on = tone_amp(lat(lpatch(osc1={"table": "glass", "pos": 0, "level": 0.35}, sub={"level": 0.8}), [{"at": 0.01, "t": "on", "n": 60, "v": 0.9}], 0.4)[0][int(0.1 * SR):], f0 / 2)
    ck(f"W. the sub adds the octave below ({half_on:.3f} vs {half_off:.3f})", half_on > 0.05 and half_on > half_off * 20, (half_on, half_off))
    nL, nR = lat(lpatch(level=0.6, osc1={"level": 0}, osc2={"level": 0}, noise={"level": 0.7, "color": 0.8}), [{"at": 0.01, "t": "on", "n": 60, "v": 1}], 0.4)
    ns = nL[int(0.08 * SR):]
    nrms = float(np.sqrt(np.mean(ns ** 2)))
    ck(f"W. noise is broadband and inside the ceiling ({db(nrms):.1f} dB)", nrms > 0.02 and float(np.max(np.abs(nL))) <= 1 and np.all(np.isfinite(nL)) and np.all(np.isfinite(nR)) and tone_amp(ns, 440) < nrms * 0.25, nrms)
    pL, _ = lat(lpatch(osc1={"table": "edge", "pos": 0.6, "level": 0.8}, envA={"a": 0.001, "d": 0.04, "s": 0, "r": 0.02}), [{"at": 0.01, "t": "on", "n": 64, "v": 1}, {"at": 0.06, "t": "off", "n": 64}], 0.45)
    head = float(np.sqrt(np.mean(pL[int(0.02 * SR):int(0.07 * SR)] ** 2)))
    tail = float(np.sqrt(np.mean(pL[int(0.28 * SR):] ** 2)))
    ck(f"W. a pluck dies away ({head:.3f} then {tail:.2e})", head > 0.02 and tail < head * 0.05, (head, tail))
    vpatch = lpatch(level=0.4, osc1={"level": 0.6, "table": "glass", "pos": 0}, matrix=[{"src": "vel", "dest": "amp", "amt": 1}])
    soft = float(np.sqrt(np.mean(lat(vpatch, [{"at": 0.01, "t": "on", "n": 60, "v": 0.2}], 0.4)[0][int(0.1 * SR):] ** 2)))
    hard = float(np.sqrt(np.mean(lat(vpatch, [{"at": 0.01, "t": "on", "n": 60, "v": 1}], 0.4)[0][int(0.1 * SR):] ** 2)))
    ck(f"W. velocity through the matrix changes level ({db(hard / soft):+.1f} dB)", db(hard / soft) > 2, (soft, hard))
    wpatch = lpatch(osc1={"table": "edge", "pos": 1, "level": 0.75}, filt={"route": "serial", "a": {"mode": "lp", "cutoff": 280, "res": 0.1, "env": 0}, "b": {"mode": "lp", "cutoff": 18000, "res": 0, "env": 0}}, matrix=[{"src": "wheel", "dest": "cutA", "amt": 1}])
    f0 = hz(72)
    closed = tone_amp(lat(wpatch, [{"at": 0.01, "t": "on", "n": 72, "v": 0.9}], 0.4)[0][int(0.1 * SR):], 8 * f0)
    opened = tone_amp(lat(wpatch, [{"at": 0, "t": "mw", "v": 1}, {"at": 0.01, "t": "on", "n": 72, "v": 0.9}], 0.4)[0][int(0.1 * SR):], 8 * f0)
    ck(f"W. the mod wheel opens the filter ({opened:.4f} vs {closed:.4f})", opened > closed * 4, (opened, closed))
    facts = pg.evaluate("__synth.latticeFactory()")
    cats = {f_["name"]: f_["cat"] for f_ in facts}
    ck("W. eight factory presets cover pads, plucks, basses and textures",
       len(facts) == 8 and cats.get("Glass Pad") == "Pad" and cats.get("Soft Pluck") == "Pluck"
       and cats.get("Root Bass") == "Bass" and cats.get("Drift Cloth") == "Texture" and cats.get("Night Fold") == "Texture", facts)
    for f_ in facts:
        P = pg.evaluate("n => __synth.latticePatch(n)", f_["name"])
        L, R = lat(P, [{"at": 0.01, "t": "on", "n": 60, "v": 0.85}], 1.5)
        pk = float(max(np.max(np.abs(L)), np.max(np.abs(R)))); body = float(np.sqrt(np.mean(L ** 2)))
        ck(f"W. {f_['name']}: sounds, finite, peak {db(pk):.1f} dBFS", body > 1e-3 and pk <= 1.0 and np.all(np.isfinite(L)) and np.all(np.isfinite(R)), (body, pk))
    rng = random.Random(7); bad = 0; pk = 0.0; loud = 0
    tables = ["glass", "reed", "brass", "vowel", "edge", "hollow"]
    warps = ["off", "bend", "sync", "pwm", "fm"]
    modes = ["lp", "hp", "bp", "notch"]
    for i in range(6):
        fp = lpatch(
            level=rng.random(), bandlimit=rng.random() > 0.2,
            osc1={"table": tables[i % 6], "pos": rng.random(), "level": rng.random(), "warp": warps[i % 5], "warpAmt": rng.random(), "oct": rng.randint(-1, 1), "semi": rng.randint(-6, 6)},
            osc2={"table": tables[(i + 2) % 6], "pos": rng.random(), "level": rng.random() * 0.6, "warp": warps[(i + 1) % 5], "warpAmt": rng.random(), "semi": rng.randint(0, 7)},
            unison={"count": rng.randint(1, 4), "detune": rng.random() * 40, "spread": rng.random()},
            sub={"level": rng.random() * 0.5}, noise={"level": rng.random() * 0.3, "color": rng.random()},
            filt={"route": "serial" if rng.random() > 0.5 else "parallel",
                  "a": {"mode": modes[i % 4], "cutoff": 40 + rng.random() * 8000, "res": rng.random() * 0.7, "env": rng.random()},
                  "b": {"mode": modes[(i + 1) % 4], "cutoff": 80 + rng.random() * 10000, "res": rng.random() * 0.5, "env": rng.random() * 0.4}},
            envA={"a": 0.001 + rng.random() * 0.2, "d": 0.05 + rng.random() * 0.4, "s": rng.random(), "r": 0.05 + rng.random() * 0.3},
            matrix=[{"src": "lfo1", "dest": "osc1.pos", "amt": rng.random() * 2 - 1}, {"src": "vel", "dest": "amp", "amt": rng.random() * 2 - 1}],
            lfo1={"rate": 0.05 + rng.random() * 8})
        L, R = lat(fp, [{"at": 0.01, "t": "on", "n": 48 + rng.randint(0, 36), "v": 0.4 + rng.random() * 0.6}], 0.35)
        bad += int(not (np.all(np.isfinite(L)) and np.all(np.isfinite(R))))
        pk = max(pk, float(np.max(np.abs(L))), float(np.max(np.abs(R))))
        loud += int(np.sqrt(np.mean(L ** 2)) > 1e-4)
    ck(f"W. fuzz, 6 random patches: finite and at or under 0 dBFS (peak {db(pk):.2f} dBFS)", bad == 0 and pk <= 1.0 and loud == 6, (bad, pk, loud))
    ms = pg.evaluate("""async () => { const t0 = performance.now();
        await __synth.latticeRender({patch: __synth.latticePatch('Glass Pad'), events: [{at: 0.01, t: 'on', n: 60, v: 0.8}], seconds: 2});
        return performance.now() - t0; }""")
    info("W. CPU Lattice Glass Pad, one note", f"{100 * ms / 2000:.1f}% of real time in headless Chrome (offline render, Lattice only)")

    pg.evaluate("__synth.setDevice('lattice')"); pg.wait_for_timeout(300)
    ck("W. rail: Lattice lit, the wavetable shown, the tube filter hidden",
       pg.evaluate("__synth.device()") == "lattice" and pg.is_visible("#latWave") and not pg.is_visible("#mFilt")
       and not pg.is_visible("#chassis") and pg.get_attribute("#devL", "aria-pressed") == "true")
    before = pg.evaluate("document.getElementById('latWave').toDataURL()")
    pg.wait_for_timeout(280)
    after = pg.evaluate("document.getElementById('latWave').toDataURL()")
    ck("W. the wavetable display is moving", before != after and len(after) > 1000)
    pg.click("#latView")
    ck("W. the view switches between the stack and one cycle",
       pg.get_attribute("#latView", "aria-pressed") == "false" and pg.inner_text("#latView").strip() == "2D")
    pg.evaluate("document.getElementById('mLatMatrix').scrollIntoView()")
    pg.wait_for_timeout(80)
    src = pg.locator("[data-src='lfo1']").bounding_box(); dest = pg.locator("[data-dest='osc1.pos']").bounding_box()
    pg.mouse.move(src["x"] + src["width"] / 2, src["y"] + src["height"] / 2); pg.mouse.down()
    pg.mouse.move(dest["x"] + dest["width"] / 2, dest["y"] + 12, steps=8); pg.mouse.up()
    pg.wait_for_timeout(40)
    routed = pg.evaluate("__synth.patch().matrix.some(s => s.src === 'lfo1' && s.dest === 'osc1.pos')")
    ck("W. dragging a source onto a destination adds a route", routed)
    pg.evaluate("document.getElementById('latLfo0').scrollIntoView()"); pg.wait_for_timeout(40)
    shape0 = pg.evaluate("__synth.patch().shapes[0].slice()")
    box = pg.locator("#latLfo0").bounding_box()
    pg.mouse.move(box["x"] + 8, box["y"] + 6); pg.mouse.down()
    pg.mouse.move(box["x"] + box["width"] * 0.45, box["y"] + 8, steps=6); pg.mouse.up()
    shape1 = pg.evaluate("__synth.patch().shapes[0].slice()")
    ck("W. drawing on an LFO changes its shape", shape0 != shape1 and max(shape1) > 0.5, (max(shape0), max(shape1)))
    n = 256
    samples = [int(max(-32767, min(32767, round(32767 * math.sin(2 * math.pi * i / n))))) for i in range(n * 8)]
    wav = bytearray()
    data = b"".join(int(s).to_bytes(2, "little", signed=True) for s in samples)
    wav += b"RIFF" + (36 + len(data)).to_bytes(4, "little") + b"WAVE"
    wav += b"fmt " + (16).to_bytes(4, "little") + (1).to_bytes(2, "little") + (1).to_bytes(2, "little")
    wav += (48000).to_bytes(4, "little") + (48000 * 2).to_bytes(4, "little") + (2).to_bytes(2, "little") + (16).to_bytes(2, "little")
    wav += b"data" + len(data).to_bytes(4, "little") + data
    pg.set_input_files("#latWav", files=[{"name": "cycle.wav", "mimeType": "audio/wav", "buffer": bytes(wav)}])
    pg.wait_for_function("() => __synth.patch().osc1.table === 'user'", timeout=4000)
    user = pg.evaluate("""async () => {
      const table = __synth.latticeTable();
      return __synth.latticeRender({
        patch: { device: 'lattice', level: 0.55, osc1: { table: 'user', pos: 0, level: 0.7, warp: 'off' }, osc2: { level: 0 },
          sub: { level: 0 }, noise: { level: 0 }, unison: { count: 1, detune: 0, spread: 0 },
          filt: { route: 'serial', a: { mode: 'lp', cutoff: 18000, res: 0, env: 0 }, b: { mode: 'lp', cutoff: 18000, res: 0, env: 0 } },
          envA: { a: 0.001, d: 0.05, s: 1, r: 0.02 } },
        events: [{ at: 0.02, t: 'on', n: 69, v: 0.9 }], seconds: 0.5, table });
    }""")
    uL, _ = dec(user)
    uf = peak_freq(uL[int(0.12 * SR):]); uc = abs(1200 * math.log2(uf / 440.0))
    ck(f"W. a dropped WAV becomes the cycle ({uf:.2f} Hz)", uc < 8 and pg.evaluate("() => __synth.latticeTable() && __synth.latticeTable().length") == 7 * 16 * 256, (uf, uc))
    pg.evaluate("""() => __synth.setPatch({
      device: 'lattice', level: 0.5, osc1: { table: 'glass', pos: 0, level: 0.7, warp: 'off' }, osc2: { level: 0 },
      sub: { level: 0 }, noise: { level: 0 }, unison: { count: 1 },
      filt: { a: { cutoff: 8000, res: 0, env: 0 }, b: { cutoff: 12000, res: 0, env: 0 } },
      envA: { a: 0.001, d: 0.2, s: 1, r: 0.05 },
      matrix: [{ src: 'envA', dest: 'osc1.pos', amt: 1 }]
    })""")
    pg.wait_for_timeout(80)
    pg.evaluate("""async () => { const c = __synth.engine().ctx; if (c.state !== 'running') await c.resume(); __synth.noteOn(64, 0.9); }""")
    pg.wait_for_function("() => +document.getElementById('latPos').dataset.pos > 0.25", timeout=2000)
    moved = float(pg.get_attribute("#latPos", "data-pos") or "0")
    ck(f"W. the position readout follows the envelope ({moved:.2f})", moved > 0.25, moved)
    pg.evaluate("__synth.noteOff(64)")
    pg.screenshot(path=os.path.join(SHOTS, "synth_lattice_desktop.png"), full_page=True)
    pg.evaluate("__synth.setDevice('filament')"); pg.wait_for_timeout(150)
    ck("W. no page errors", not errs, errs)

    ph = b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2); werr = []
    ph.on("pageerror", lambda e: werr.append(str(e)))
    ph.goto(BASE); ph.wait_for_function("window.__synth && __synth.ready()", timeout=20000); ph.wait_for_timeout(200)
    ph.evaluate("__synth.setDevice('lattice')"); ph.wait_for_timeout(250)
    ck("W. 390px: no horizontal scroll", ph.evaluate("document.documentElement.scrollWidth <= innerWidth && innerWidth === 390"),
       ph.evaluate("[document.documentElement.scrollWidth, innerWidth]"))
    ck("W. 390px: the wavetable is on screen", ph.is_visible("#latWave") and not ph.is_visible("#mFilt") and not ph.is_visible("#chassis"))
    small = ph.evaluate("""() => [...document.querySelectorAll('#latticeRoot button, #latticeRoot input[type=range], .devbtn, .tabs button')].filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map(e => (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))""")
    ck("W. 390px: Lattice controls, the rail and the tabs are 44 px or more", not small, small)
    ph.tap('.tabs [data-go="osc"]'); ph.wait_for_timeout(200)
    ck("W. 390px: the Osc tab shows oscillator A, still no horizontal scroll", ph.is_visible("#mLatA") and not ph.is_visible("#mLatFilt")
       and ph.evaluate("document.documentElement.scrollWidth <= innerWidth && innerWidth === 390"))
    small = ph.evaluate("""() => [...document.querySelectorAll('#mLatA button, #mLatA input, .tabs button, .devbtn')].filter(e => e.id !== 'latWav' && e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map(e => (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))""")
    ck("W. 390px: oscillator controls are 44 px or more", not small, small)
    ph.screenshot(path=os.path.join(SHOTS, "synth_lattice_phone.png"))
    ph.evaluate("__synth.setDevice('filament')")
    ck("W. 390px: no page errors", not werr, werr)
    ph.close()

    # ---------------------------------------------------------------- slashless /synth
    # nginx 301s /synth to /synth/ because location ^~ /synth/ ends in a slash and
    # proxy_passes. The site service worker (registered from the main page, scope /)
    # follows that redirect and, if it answers the navigation with the followed
    # response, Chrome fails the load with net::ERR_FAILED. Anyone who has opened
    # dxedge.net has that worker, so /synth without the slash never comes up.
    # This registers the real sw.js and loads the slash-less URL.
    sctx = b.new_context()
    # Precache lists /favicon.svg. Production answers that with the SPA shell (200);
    # this static server would 404 it and the worker would never install.
    sctx.route("**/favicon.svg", lambda route: route.fulfill(
        status=200, content_type="image/svg+xml", body="<svg xmlns='http://www.w3.org/2000/svg'/>"))
    sp = sctx.new_page(); serr = []
    sp.on("pageerror", lambda e: serr.append(str(e)))
    sp.goto(BASE)
    controlled = sp.evaluate("""async () => {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise(resolve => {
          const t = setTimeout(resolve, 3000);
          navigator.serviceWorker.addEventListener('controllerchange', () => { clearTimeout(t); resolve(); }, { once: true });
        });
      }
      return !!navigator.serviceWorker.controller;
    }""")
    ck("slashless /synth: the service worker is in control", controlled)
    noslash = BASE[:-1] if BASE.endswith("/") else BASE
    slash_detail = ""
    try:
        sp.goto(noslash, wait_until="domcontentloaded", timeout=20000)
        sp.wait_for_function("window.__synth && __synth.ready()", timeout=20000)
        slash_ok = sp.url.endswith("/synth/") and sp.evaluate("__synth.ready()") and not serr
        slash_detail = (sp.url, serr)
    except Exception as e:
        slash_ok = False
        slash_detail = (sp.url, str(e).split("\n")[0], serr)
    ck("slashless /synth redirects and the synth initializes", slash_ok, slash_detail)
    sctx.close()
    # ---------------------------------------------------------------- G. Gleam, the touch field
    def g_render(patch, events, seconds=0.8):
        raw = pg.evaluate(
            """async ({patch, events, seconds}) => __synth.gleamRender({patch, events, seconds, sampleRate: 48000})""",
            {"patch": patch, "events": events, "seconds": seconds},
        )
        return dec(raw)
    def g_fx(**kw):
        raw = pg.evaluate("""async (o) => __synth.gleamFxRender(o)""", kw)
        return dec(raw)
    def g_rms(x, a, b):
        i, j = int(a * SR), int(b * SR)
        seg = x[i:j]
        return float(np.sqrt(np.mean(seg * seg))) if len(seg) else 0.0
    def cents(f, target):
        return 1200 * math.log(max(f, 1e-9) / target) / math.log(2)
    src_blob = ""
    for fn in ("gleam.js", "gleam-dsp.js", "gleam.worklet.js", "gleam-fx.js", "gleam-ui.js", "gleam/index.html"):
        with open(os.path.join(ROOT, "synth", fn), encoding="utf-8") as fh:
            src_blob += fh.read().lower()
    ck("G. the sources do not borrow another performance pad's name", "kaoss" not in src_blob)

    pure_g = pg.evaluate("""async () => {
      const g = await import('/synth/gleam.js');
      const opt = (scale, root, x) => g.pitchOf(x, { scale, root, octaves: 1 });
      const tape = { duration: 1, events: [
        { t: 0, type: 'down', id: 1, x: 0.2, y: 0.5, z: 0.8 },
        { t: 0.4, type: 'up', id: 1, x: 0.2, y: 0.5, z: 0.8 },
        { t: 0.7, type: 'down', id: 2, x: 0.8, y: 0.2, z: 0.5 },
      ]};
      const ids = (t, loop) => g.pointersAt(tape, t, loop).map(p => p.id);
      const lo = g.effectOf(0.1, 0, 0, 120), hi = g.effectOf(0.9, 1, 0.5, 120);
      const o0 = g.orbitPosition(0, 0.5, 1, 0), o1 = g.orbitPosition(0.25, 0.5, 1, 0);
      const stay = g.driftPosition(1.2, 0, 3, { x: 0.2, y: -0.3 });
      return {
        c3: opt('major', 0, 0).midi, g3: opt('major', 0, 0.5).midi, c4: opt('major', 0, 1).midi,
        hz: opt('major', 0, 0).hz, minor: opt('minor', 0, 2 / 7).midi, penta: opt('pentatonic', 0, 0.4).midi,
        chrom: opt('chromatic', 0, 0.5).midi, free: opt('free', 0, 0.5).midi, rooted: opt('major', 2, 0).midi,
        near: g.placeOf(0, 0).gain, far: g.placeOf(1, 1).gain, left: g.placeOf(-1, 0).pan,
        ox: o0.x, oy: o0.y, ox1: o1.x, oy1: o1.y, stayX: stay.x, stayY: stay.y,
        midIds: ids(0.2, false), afterUp: ids(0.5, false), endIds: ids(0.8, false), wrapIds: ids(1.05, true),
        cutLo: lo.cutoff, cutHi: hi.cutoff, fb: hi.feedback,
        id: g.gleamDevice.id, api: g.gleamDevice.api, proc: g.gleamDevice.processor, worklet: g.gleamDevice.worklet,
      };
    }""")
    ck("G. major, minor, pentatonic, chromatic and free quantize from the root",
       pure_g["c3"] == 48 and pure_g["g3"] == 55 and pure_g["c4"] == 60 and pure_g["minor"] == 51
       and pure_g["penta"] == 52 and pure_g["chrom"] == 54 and pure_g["free"] == 54 and pure_g["rooted"] == 50
       and abs(pure_g["hz"] - 130.8128) < 0.02, pure_g)
    ck("G. a near orb is louder than a far one, and orbit and drift are deterministic",
       pure_g["near"] > pure_g["far"] * 3 and abs(pure_g["left"] + 1) < 1e-9
       and abs(pure_g["ox"] - 0.5) < 1e-9 and abs(pure_g["oy"]) < 1e-9
       and abs(pure_g["ox1"]) < 1e-6 and abs(pure_g["oy1"] - 0.5) < 1e-6
       and abs(pure_g["stayX"] - 0.2) < 1e-9 and abs(pure_g["stayY"] + 0.3) < 1e-9, pure_g)
    ck("G. a looped gesture does not keep a finger that was only down at the end",
       pure_g["midIds"] == [1] and pure_g["afterUp"] == [] and pure_g["endIds"] == [2] and 2 not in pure_g["wrapIds"], pure_g)
    ck("G. the effect sweep rises with X and full Y is the feedback amount",
       pure_g["cutLo"] < pure_g["cutHi"] and abs(pure_g["fb"] - 0.88) < 1e-9
       and pure_g["id"] == "gleam" and pure_g["api"] == "dxrack/1" and pure_g["proc"] == "gleam"
       and pure_g["worklet"] == "gleam.worklet.js", pure_g)

    base_p = {"device": "gleam", "mode": "field", "scale": "major", "root": 0, "octaves": 1,
              "glide": 0, "level": 0.85, "space": 0, "reverb": 0, "hrtf": False, "color": 0}
    held = [{"at": 0.02, "type": "on", "id": "a", "x": 0, "y": 0, "z": 1}]
    toneL, toneR = g_render(base_p, held, 0.9)
    f0 = peak_freq(toneL[int(0.35 * SR):int(0.8 * SR)])
    ck(f"G. a finger at the left of a one-octave major is C3 ({f0:.2f} Hz)", abs(cents(f0, 130.8128)) < 15
       and g_rms(toneL, 0.3, 0.8) > 0.02, (f0, g_rms(toneL, 0.3, 0.8)))
    brightL, _brightR = g_render(dict(base_p), [{"at": 0.02, "type": "on", "id": "a", "x": 0, "y": 1, "z": 1}], 0.9)
    def harm(x):
        sl = x[int(0.35 * SR):int(0.8 * SR)]
        return sum(tone_amp(sl, 130.8128 * k) for k in (3, 4, 5, 6))
    ck("G. raising Y adds harmonics above the fundamental", harm(brightL) > harm(toneL) * 4, (harm(toneL), harm(brightL)))
    quietL, _qR = g_render(base_p, [{"at": 0.02, "type": "on", "id": "a", "x": 0.25, "y": 0.2, "z": 0.35}], 0.8)
    loudL, _lR = g_render(base_p, [{"at": 0.02, "type": "on", "id": "a", "x": 0.25, "y": 0.2, "z": 1}], 0.8)
    ratio = g_rms(loudL, 0.3, 0.7) / max(g_rms(quietL, 0.3, 0.7), 1e-9)
    ck(f"G. pressure scales the level ({ratio:.2f}x) and a voice stays inside full scale",
       1.8 < ratio < 4 and g_rms(quietL, 0.3, 0.7) > 1e-3 and float(np.max(np.abs(loudL))) <= 1.001, ratio)
    duoL, duoR = g_render(dict(base_p, space=0, reverb=0), [
        {"at": 0.02, "type": "on", "id": "c", "x": 0, "y": 0, "z": 0.8},
        {"at": 0.02, "type": "on", "id": "g", "x": 0.5, "y": 0, "z": 0.8},
    ], 0.8)
    sl = duoL[int(0.3 * SR):int(0.7 * SR)]
    a_c, a_g = tone_amp(sl, 130.8128), tone_amp(sl, 195.9977)
    ck("G. two fingers sound together", a_c > 0.02 and a_g > 0.02 and float(np.max(np.abs(duoL))) <= 1.001
       and bool(np.isfinite(duoL).all() and np.isfinite(duoR).all()), (a_c, a_g))
    relL, relR = g_render(base_p, held + [{"at": 0.15, "type": "off", "id": "a"}], 0.9)
    ck("G. a released finger is silent after the tail", g_rms(relL, 0.05, 0.12) > 0.01 and g_rms(relL, 0.55, 0.75) < 1e-4
       and g_rms(relR, 0.55, 0.75) < 1e-4, (g_rms(relL, 0.05, 0.12), g_rms(relL, 0.55, 0.75)))
    panL, panR = g_render(dict(base_p, space=1, reverb=0), [{"at": 0.02, "type": "on", "id": "a", "x": 0, "y": 0.3, "z": 1}], 0.6)
    panL2, panR2 = g_render(dict(base_p, space=1, reverb=0), [{"at": 0.02, "type": "on", "id": "a", "x": 1, "y": 0.3, "z": 1}], 0.6)
    ck("G. the field pans hard left and hard right",
       g_rms(panL, 0.2, 0.5) > g_rms(panR, 0.2, 0.5) * 8 and g_rms(panR2, 0.2, 0.5) > g_rms(panL2, 0.2, 0.5) * 8,
       (g_rms(panL, 0.2, 0.5), g_rms(panR, 0.2, 0.5), g_rms(panL2, 0.2, 0.5), g_rms(panR2, 0.2, 0.5)))
    nearL, _nR = g_render({"device": "gleam", "mode": "room", "reverb": 0, "level": 0.85, "glide": 0}, [
        {"at": 0.02, "type": "on", "id": "o", "x": 0, "y": 0, "z": 1, "hz": 220, "room": True}], 0.6)
    farL, _fR = g_render({"device": "gleam", "mode": "room", "reverb": 0, "level": 0.85, "glide": 0}, [
        {"at": 0.02, "type": "on", "id": "o", "x": 1, "y": 1, "z": 1, "hz": 220, "room": True}], 0.6)
    ck("G. a near orb is louder than the same orb in the corner",
       g_rms(nearL, 0.2, 0.5) > g_rms(farL, 0.2, 0.5) * 2, (g_rms(nearL, 0.2, 0.5), g_rms(farL, 0.2, 0.5)))
    hL, hR = g_render(dict(base_p, hrtf=True, space=1, reverb=0), [{"at": 0.02, "type": "on", "id": "a", "x": 0, "y": 0.2, "z": 1}], 0.5)
    ck("G. HRTF keeps a left-hand finger on the left and inside full scale",
       g_rms(hL, 0.15, 0.4) > g_rms(hR, 0.15, 0.4) * 1.15 and g_rms(hL, 0.15, 0.4) > 1e-3
       and float(np.max(np.abs(hL))) <= 1.01 and bool(np.isfinite(hL).all() and np.isfinite(hR).all()),
       (g_rms(hL, 0.15, 0.4), g_rms(hR, 0.15, 0.4)))
    rng_g = random.Random(7)
    rnd = []
    for i in range(48):
        rnd.append({"at": i * 0.04, "type": "on" if i % 3 else "off", "id": str(i % 6),
                    "x": rng_g.random(), "y": rng_g.random(), "z": rng_g.random()})
    rnd.append({"at": 1.95, "type": "panic"})
    rL, rR = g_render(dict(base_p, octaves=2, space=0.6, reverb=0.2), rnd, 2.0)
    ck("G. a burst of ons and offs stays finite and inside full scale",
       bool(np.isfinite(rL).all() and np.isfinite(rR).all()) and float(np.max(np.abs(rL))) <= 1.001
       and float(np.max(np.abs(rR))) <= 1.001 and g_rms(rL, 1.7, 1.95) > 1e-4, float(np.max(np.abs(rL))))
    panL, _ = g_render(dict(base_p), held + [{"at": 0.2, "type": "panic"}], 0.7)
    ck("G. panic silences every voice", g_rms(panL, 0.35, 0.6) < 1e-4, g_rms(panL, 0.35, 0.6))

    dullL, _dR = g_fx(hz=3000, x=0.02, y=0, z=0, seconds=0.5, on=True)
    openL, _oR = g_fx(hz=3000, x=0.95, y=0, z=0, seconds=0.5, on=True)
    ck("G. a low X darkens a bright tone and a high X leaves it",
       g_rms(openL, 0.15, 0.4) > g_rms(dullL, 0.15, 0.4) * 4 and g_rms(openL, 0.15, 0.4) > 0.05,
       (g_rms(dullL, 0.15, 0.4), g_rms(openL, 0.15, 0.4)))
    wetL, _wR = g_fx(hz=440, x=0.85, y=0.9, z=0, seconds=1.0, burst=0.08, on=True)
    dryL, _drR = g_fx(hz=440, x=0.85, y=0, z=0, seconds=1.0, burst=0.08, on=True)
    ck("G. delay feedback leaves a tail after the tone stops",
       g_rms(wetL, 0.35, 0.8) > g_rms(dryL, 0.35, 0.8) * 3 and g_rms(wetL, 0.35, 0.8) > 1e-3,
       (g_rms(wetL, 0.35, 0.8), g_rms(dryL, 0.35, 0.8)))
    chopL, _cR = g_fx(hz=220, x=0.9, y=0.05, z=1, seconds=0.6, on=True, tempo=120)
    evenL, _eR = g_fx(hz=220, x=0.9, y=0.05, z=0, seconds=0.6, on=True, tempo=120)
    def window_span(x):
        w = int(0.02 * SR)
        vals = [float(np.max(np.abs(x[i:i + w]))) for i in range(int(0.08 * SR), int(0.45 * SR), w)]
        return (min(vals), max(vals)) if vals else (0, 0)
    chop, even = window_span(chopL), window_span(evenL)
    ck("G. stutter opens and closes the gate", chop[0] < even[0] * 0.35 and chop[1] > chop[0] * 4 and even[0] > 0.05,
       (chop, even))
    byL, _bR = g_fx(hz=3000, x=0.02, y=0.8, z=1, seconds=0.4, on=False)
    ck("G. effect bypass ignores the sweep", g_rms(byL, 0.1, 0.3) > g_rms(dullL, 0.1, 0.3) * 4, (g_rms(byL, 0.1, 0.3), g_rms(dullL, 0.1, 0.3)))

    for gw, gh, mobile in ((1280, 800, False), (390, 844, True)):
        gp = b.new_page(viewport={"width": gw, "height": gh}, is_mobile=mobile, has_touch=mobile)
        gerr = []
        gp.on("pageerror", lambda e, box=gerr: box.append(str(e)))
        gp.goto(BASE + "gleam/")
        gp.wait_for_function("window.__gleam && __gleam.ready()", timeout=20000)
        gp.wait_for_timeout(200)
        ck(f"G. {gw}px standalone: no horizontal scroll and no page errors",
           gp.evaluate("document.documentElement.scrollWidth <= innerWidth") and not gerr,
           (gp.evaluate("[document.documentElement.scrollWidth, innerWidth]"), gerr))
        touch = gp.evaluate("""() => {
          const bar = document.getElementById('gleamBar');
          const ev = new Event('touchmove', { bubbles: true, cancelable: true });
          bar.dispatchEvent(ev);
          return {
            pad: getComputedStyle(document.getElementById('gleamPad')).touchAction,
            bar: getComputedStyle(bar).touchAction,
            prevented: ev.defaultPrevented,
          };
        }""")
        ck(f"G. {gw}px: the pad does not steal scrolling from the controls",
           touch["pad"] == "none" and "pan-y" in touch["bar"] and touch["prevented"] is False, touch)
        ptr = gp.evaluate("""() => {
          const pad = document.getElementById('gleamPad');
          const r = pad.getBoundingClientRect();
          const fire = (type, id, x, y) => pad.dispatchEvent(new PointerEvent(type, {
            pointerId: id, clientX: r.left + x, clientY: r.top + y, bubbles: true, cancelable: true,
            pointerType: 'touch', pressure: 0.7, isPrimary: id === 1, buttons: type === 'pointerdown' ? 1 : 0,
          }));
          fire('pointerdown', 1, 28, 36);
          const one = window.__gleam.voices();
          fire('pointerdown', 2, 70, 48);
          const two = window.__gleam.voices();
          fire('pointerup', 1, 28, 36);
          const left = window.__gleam.voices();
          fire('pointercancel', 2, 70, 48);
          const none = window.__gleam.voices();
          fire('pointerdown', 3, 40, 55);
          fire('pointercancel', 3, 40, 55);
          return { one, two, left, none, cancel: window.__gleam.voices() };
        }""")
        ck(f"G. {gw}px: each pointer is a voice, and up or cancel releases it",
           ptr["one"] == 1 and ptr["two"] == 2 and ptr["left"] == 1 and ptr["none"] == 0 and ptr["cancel"] == 0, ptr)
        gp.evaluate("""() => window.__gleam.playTape({ duration: 1.2, events: [{ t: 0, type: 'down', id: 7, x: 0.3, y: 0.6, z: 0.8 }] })""")
        gp.wait_for_timeout(80)
        playing = gp.evaluate("window.__gleam.voices()")
        gp.evaluate("window.__gleam.stopTape()")
        gp.wait_for_timeout(40)
        ck(f"G. {gw}px: stopping a looped gesture releases its voices", playing >= 1 and gp.evaluate("window.__gleam.voices()") == 0, playing)
        if mobile:
            small = gp.evaluate("""() => [...document.querySelectorAll('#gleamBar .gchip, #gleamBar select, #gleamBar a, #gleamBar input')]
              .filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; })
              .map(e => (e.id || e.textContent || '').trim().slice(0, 16) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))""")
            ck("G. 390px: mode chips are 44 px or more", not small, small)
        box = gp.locator("#gleamPad").bounding_box()
        gp.mouse.move(box["x"] + 36, box["y"] + 48)
        gp.mouse.down()
        gp.wait_for_timeout(520)
        vis = gp.evaluate("""() => {
          const v = window.__gleam.visual();
          const c = document.getElementById('gleamCv');
          const ctx = c.getContext('2d');
          const data = ctx.getImageData(0, 0, c.width, c.height).data;
          let bright = 0;
          for (let i = 0; i < data.length; i += 16) if (data[i] > 40 || data[i + 1] > 30) bright++;
          return { level: v.level, particles: v.particles, bright, voices: window.__gleam.voices() };
        }""")
        gp.mouse.up()
        gp.wait_for_timeout(60)
        after = gp.evaluate("window.__gleam.voices()")
        ck(f"G. {gw}px: a held pointer glows and lets go",
           vis["voices"] >= 1 and vis["level"] > 0 and (vis["particles"] > 0 or vis["bright"] > 0) and after == 0, (vis, after))
        gp.close()

    rack_before = len(errs)
    pg.evaluate("__synth.setDevice('gleam')")
    pg.wait_for_timeout(250)
    ck("G. the rail shows the pad and hides Filament's filter",
       pg.evaluate("__synth.device()") == "gleam" and pg.is_visible("#gleamPad") and not pg.is_visible("#mFilt"))
    fx = pg.evaluate("""() => {
      const h = __synth.gleam();
      const before = h.fxProbe();
      h.effectAt({ x: 0.15, y: 0.85, z: 1 });
      const mid = h.fxProbe();
      h.effectAt(null);
      return { before, mid, after: h.fxProbe(), hasSet: typeof __synth.engine().fx.setInsert === 'function',
               ids: __synth.devices().map(d => d.id) };
    }""")
    ck("G. the effect pad inserts on the master only while a finger is down",
       fx["hasSet"] and fx["before"]["inserted"] and fx["before"]["on"] is False and fx["mid"]["on"] is True and fx["after"]["on"] is False
       and "gleam" in fx["ids"], fx)
    ph = b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    perr = []
    ph.on("pageerror", lambda e: perr.append(str(e)))
    ph.goto(BASE)
    ph.wait_for_function("window.__synth && __synth.ready()", timeout=20000)
    ph.evaluate("__synth.setDevice('gleam')")
    ph.wait_for_timeout(250)
    ck("G. 390px rack: the pad fits, the rail stays 44 px, no page errors",
       ph.evaluate("document.documentElement.scrollWidth <= innerWidth && innerWidth === 390")
       and ph.is_visible("#gleamPad") and not ph.is_visible("#mFilt") and not perr,
       (ph.evaluate("[document.documentElement.scrollWidth, innerWidth]"), perr))
    small = ph.evaluate("""() => [...document.querySelectorAll('.devbtn, #gleamBar .gchip')]
      .filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; })
      .map(e => (e.id || e.textContent || '').trim().slice(0, 16) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))""")
    ck("G. 390px rack: rail and pad chips are 44 px or more", not small, small)
    ph.close()
    pg.evaluate("__synth.setDevice('filament')")
    pg.wait_for_timeout(150)
    ck("G. leaving the pad returns the keyboard to Filament", pg.evaluate("__synth.device()") == "filament" and not pg.is_visible("#gleamPad"))
    ck("G. no page errors", len(errs) == rack_before, errs[rack_before:])
    b.close()

print()
print("ALL PASS" if not F else f"{len(F)} FAILED: " + "; ".join(F))
sys.exit(1 if F else 0)
