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
plus playing-it checks (keys, computer keyboard, patches, knobs, persistence).

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

from playwright.sync_api import sync_playwright
CHROME = os.environ.get("SYNTH_CHROMIUM", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=CHROME, args=["--autoplay-policy=no-user-gesture-required"])
    pg = b.new_page(viewport={"width": 1366, "height": 1000}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(BASE); pg.wait_for_function("window.__synth && __synth.ready()", timeout=20000)
    def render(p, events, seconds, rack=True, mono=False):
        return dec(pg.evaluate("a => __synth.render(a)", {"patch": p, "events": events, "seconds": seconds, "rack": rack, "mono": mono}))
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
        ck(f"10. {w}px: no page errors", not perr, perr)
        ph.close()
    b.close()

print()
print("ALL PASS" if not F else f"{len(F)} FAILED: " + "; ".join(F))
sys.exit(1 if F else 0)
