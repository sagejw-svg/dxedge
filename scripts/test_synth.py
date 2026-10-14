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
panel, the rack rail), M. (master bus: reverb, tempo-synced delay, compressor/limiter, WAV)
and playing-it checks (keys, computer keyboard, patches, knobs, persistence).

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
CHROME = os.environ.get("SYNTH_CHROMIUM", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=CHROME, args=["--autoplay-policy=no-user-gesture-required"])
    pg = b.new_page(viewport={"width": 1366, "height": 1000}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(BASE); pg.wait_for_function("window.__synth && __synth.ready()", timeout=20000)
    def render(p, events, seconds, rack=True, mono=False, master=None, masterFx=True):
        body = {"patch": p, "events": events, "seconds": seconds, "rack": rack, "mono": mono, "masterFx": masterFx}
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
        ph.click('.tabs [data-go="rack"]'); ph.wait_for_timeout(150)
        small = ph.evaluate("""() => [...document.querySelectorAll('#mMaster .chip, #mMaster .btn, #wavSecs')].filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map(e => e.id || e.textContent)""")
        ck(f"10. {w}px: master bus is on the Rack tab, no horizontal scroll, 44 px targets",
           ph.is_visible("#mMaster") and ph.is_visible("#fxRev") and not ph.is_visible("#mFilt")
           and ph.evaluate(f"document.documentElement.scrollWidth <= innerWidth && innerWidth === {w}") and not small,
           (ph.evaluate("[document.documentElement.scrollWidth, innerWidth]"), small))
        ph.click('.tabs [data-go="play"]')
        ck(f"10. {w}px: no page errors", not perr, perr)
        ph.close()
    b.close()

print()
print("ALL PASS" if not F else f"{len(F)} FAILED: " + "; ".join(F))
sys.exit(1 if F else 0)
