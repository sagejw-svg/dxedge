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
panel, the rack rail), D. (Dekatron, the drum machine: voices, the step clock, the panel), T. (Thyratron, the monophonic ladder: presets, self-oscillation, glide, the note stack), W. (Lattice, the wavetable: mipmaps, warp, filters, the matrix, a WAV import), G. (Gleam, the touch field: scales, voices, pan, room, gestures, the effect pad), Mo. (Mote, the granular instrument), H. (Heptode, the MIDI-file player), Gs. (Geissler, the generative meadow), Pg. (Pentagrid, the shortwave receiver: Morse timing, tuning pitch, presets, notes), Or. (Orthicon, the spectral painter), Fr. (Trochotron, the fractal seed: determinism, zoom, a non-silent take, note release), Gy. (Gyrotron, the gravity sequencer: orbits, collisions, crossings, MIDI, the master recorder), Kl. (Klystron, the granular vocoder: vowels, a file modulator, freeze, the mouth pad), Ph. (Phantastron, the bent toy: clock, bits, a stuck loop, wires, a non-silent take, panic), Ad. (Additron, the additive organ: drawbars, a drawn spectrum, morph, per-partial decay, the rotor), Rh. (Rhumbatron, the physical model: strings, bores, plates, strike point, damping, coupling), Rn. (Resnatron, the patch bay: cables, starters, a share link, filter, delay, panic), M. (MIDI files: the SMF reader and writer, the recorder, import, the player
with both devices at once, Render WAV), the master bus (reverb, tempo-synced delay, compressor/limiter, 24-bit WAV), R. (the rack framework: device contract, mixer, clock,
project), P. (the song library: @tonejs/midi parse, transport playback, channel routing,
Halloween presets), Sv. (SVF 12, the state variable multimode filter: morph, singing, slew), Lg. (the low pass gate: the vactrol's light and lag, filter and level together, the gate modes, Hollow Pluck), Tv. (the tube show: flares, heat, arcs, blue glow, resonance, voice lamps, off/subtle/full, reduced motion), Q. (the graphic EQ: measured curve against the plot, presets, bypass,
level, both devices, the schema, the section in the page), a slashless /synth load through the service worker, and playing-it checks (keys,
computer keyboard, patches, knobs, persistence).

Run:  python3 scripts/test_synth.py          (SYNTH_SHOTS=/dir to keep screenshots)
"""
import http.server, socketserver, threading, functools, sys, os, json, base64, math, random
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public"))
PORT = int(os.environ.get("SYNTH_PORT", "8796"))
SHOTS = os.environ.get("SYNTH_SHOTS", "/tmp")
FAVICON = b"<svg xmlns='http://www.w3.org/2000/svg'/>"
class SynthHandler(http.server.SimpleHTTPRequestHandler):
    """Static files, plus the two answers production gives that this tree has no file for.

    sw.js precaches /favicon.svg; production answers it with the SPA shell (200). A 404 here
    fails cache.addAll, the worker never installs, and navigator.serviceWorker.ready never
    resolves. context.route() does not see service-worker fetches, so the server answers it.
    lib/stat.js POSTs /api/stat; production answers 204."""
    def log_message(self, *a, **k): pass
    def do_GET(self):
        if self.path.split("?")[0] == "/favicon.svg":
            self.send_response(200); self.send_header("Content-Type", "image/svg+xml")
            self.send_header("Content-Length", str(len(FAVICON))); self.end_headers(); self.wfile.write(FAVICON); return
        return super().do_GET()
    def do_POST(self):
        if self.path.split("?")[0] == "/api/stat":
            n = int(self.headers.get("Content-Length") or 0)
            if n: self.rfile.read(n)
            self.send_response(204); self.end_headers(); return
        self.send_error(501)
handler = functools.partial(SynthHandler, directory=ROOT)
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

# Licensing rule 7: no dependency without a register row. Every vendor/ folder under /synth
# must be named in docs/filament-licensing.md, and every npm package a /synth page loads from
# jsDelivr must appear there with its version and the folder that loads it.
def _register_check():
    import re as _re
    repo = os.path.abspath(os.path.join(ROOT, "..", ".."))
    with open(os.path.join(repo, "docs", "filament-licensing.md"), encoding="utf-8") as fh:
        reg = fh.read()
    vend, cdn = [], []
    for d, _subs, files in os.walk(os.path.join(ROOT, "synth")):
        rel = os.path.relpath(d, ROOT).replace(os.sep, "/")
        if os.path.basename(d) == "vendor": vend.append(f"frontend/public/{rel}/")
        if "vendor" in rel.split("/"): continue
        for f in files:
            if not f.endswith((".js", ".mjs", ".html")): continue
            with open(os.path.join(d, f), encoding="utf-8", errors="ignore") as fh:
                for name, ver in _re.findall(r"cdn\.jsdelivr\.net/npm/(@?[\w.-]+(?:/[\w.-]+)?)@([\d.]+)", fh.read()):
                    cdn.append((name, ver, f"frontend/public/{rel}/"))
    miss_v = sorted(set(v for v in vend if v not in reg))
    miss_c = sorted(set(c for c in cdn if not all(x in reg for x in c)))
    ck("licensing: every /synth vendor/ folder has a register row", not miss_v, miss_v)
    ck("licensing: every CDN package a /synth page loads is in the register with its version and folder", not miss_c, miss_c)
_register_check()

# Licensing rule 6: no other company's product names or trademarks in the UI. Scan every quoted
# string on a non-comment line of the /synth rack's own files (vendored pages excluded) for a list
# of names. "Vactrol" (a registered trademark for a lamp and photoresistor in one package) reached
# the LP gate's help text on 26 Oct. 'Wide Novachord Strings' is a factory patch James has not
# ruled on yet (Open items, 15 Oct), so it is allowed here until he does.
def _trademark_check():
    import re as _re
    names = r"vactrol|moog|minimoog|korg|ms-20|roland|tb-303|tr-808|tr-909|juno-\d+|jupiter-8|oberheim|prophet-5|buchla|mutable instruments|plaits|reason studios|propellerhead|rack extension|combinator"
    allow = {"Wide Novachord Strings"}
    pat = _re.compile(r"(['\"`])((?:(?!\1).)*?\b(?:" + names + r")\b(?:(?!\1).)*?)\1", _re.I)
    hits = []
    d = os.path.join(ROOT, "synth")
    for f in sorted(os.listdir(d)):
        if not f.endswith((".js", ".html")): continue
        with open(os.path.join(d, f), encoding="utf-8", errors="ignore") as fh:
            for i, line in enumerate(fh, 1):
                t = line.strip()
                if t.startswith(("//", "*", "/*", "<!--")): continue
                code = _re.sub(r"\s//\s.*$", "", line)
                for m in pat.finditer(code):
                    if m.group(2) not in allow: hits.append(f"{f}:{i}: {m.group(2)[:80]}")
    ck("licensing: no other company's product names or trademarks in a /synth UI string", not hits, hits[:10])
_trademark_check()

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
    cases = [("ladder24", "12AT7"), ("diode18", "12AT7"), ("sk12", "12AT7"), ("poly24", "12AT7"), ("svf12", "12AT7"), ("valve12", "12AX7"), ("valve12", "300B"), ("valve12", "EL34"), ("valve12", "KT88")]
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
    def diode_h(s, b=0.5):
        # Diode 18's linear response: three coupled nodes, each loading the one before by b
        A = np.array([[s + 1 + b, -b, 0], [-1, s + 1 + b, -b], [0, -1, s + 1]], dtype=complex)
        return np.linalg.solve(A, np.array([1, 0, 0], dtype=complex))[2]
    def H(model, f, fc):
        fs = 2 * SR; g = math.tan(math.pi * fc / fs); W = math.tan(math.pi * f / fs) / g
        if model in ("ladder24", "poly24"): return abs(1 / (1 + 1j * W)) ** 4   # Poly 24 is the same four poles, linearly
        if model == "diode18":   # node frequency: the knob x 2.94 (zero resonance) / sqrt(17)/2, clamped like the engine
            gd = math.tan(math.pi * min(fc * 2.94, SR * 0.45) / fs) / 2.0615528128088303
            return abs(diode_h(1j * math.tan(math.pi * f / fs) / gd))
        return abs(1 / (1 - W * W + 2j * 0.70710678 * W))
    for model in ("valve12", "ladder24", "diode18", "sk12", "poly24", "svf12", "lpg"):   # sk12, svf12 (low-pass) and lpg (vactrol fully lit at sustain 1) at zero resonance are the same 2-pole Butterworth as valve12
        for fc in (100, 440, 1000, 4000):
            pt = lambda cut: patch(osc1={"wave": "sine", "level": 0.05, "fixed": fc}, filt={"model": model, "cutoff": cut})
            a = tone_amp(render(pt(fc), note(60), 1.0, rack=False)[0][SR // 2:], fc)
            r = tone_amp(render(pt(20000), note(60), 1.0, rack=False)[0][SR // 2:], fc)
            meas = db(a / r)
            cs = np.linspace(fc * 0.85, fc * 1.15, 3001)
            ce = cs[np.argmin([abs(db(H(model, fc, c) / H(model, fc, 20000)) - meas) for c in cs])]
            ck(f"2. {model} cutoff at {fc} Hz is within 3% (measured {100 * (ce / fc - 1):+.2f}%)", abs(ce / fc - 1) <= 0.03, (meas, ce))

    # ---------------------------------------------------------------- Df. Diode 18 (three coupled poles)
    # Below the threshold (resonance 0.9) it must not ring on its own; past it, test 1 checks the pitch.
    L, _ = render(patch(osc1={"level": 0}, filt={"model": "diode18", "cutoff": 262, "res": 0.85, "keytrack": 1}), note(60), 1.5, rack=False)
    q = float(np.sqrt(np.mean(L[SR // 2:] ** 2)))
    ck(f"Df. Diode 18 at resonance 0.85 stays quiet with no input ({db(q):.1f} dBFS, want below -80)", db(q) < -80, db(q))
    L, _ = render(patch(osc1={"level": 0}, filt={"model": "diode18", "cutoff": 262, "res": 1, "keytrack": 1}), note(60), 1.5, rack=False)
    q = float(np.sqrt(np.mean(L[SR // 2:] ** 2)))
    ck(f"Df. Diode 18 at full resonance sings on its own ({db(q):.1f} dBFS, want -30 to -3)", -30 < db(q) < -3, db(q))
    # The slope: three poles, about 18 dB an octave well past the cutoff (measured 2 to 4 kHz with the knob at 250 Hz)
    def dio_tone(f, cut, lvl=0.05, res=0):
        L, _ = render(patch(osc1={"wave": "sine", "level": lvl, "fixed": f}, filt={"model": "diode18", "cutoff": cut, "res": res}), note(60), 1.0, rack=False)
        return tone_amp(L[SR // 2:], f)
    # The 20 kHz reference is itself a Diode 18 (its node sits near 10 kHz), so both sides divide it out.
    slope = db(dio_tone(6000, 100) / dio_tone(3000, 100)) - db(dio_tone(6000, 20000) / dio_tone(3000, 20000))
    s_model = db(H("diode18", 6000, 100) / H("diode18", 3000, 100)); want = s_model - db(H("diode18", 6000, 20000) / H("diode18", 3000, 20000))
    ck(f"Df. Diode 18 rolls off like three poles: 3 to 6 kHz with the knob at 100 Hz measures {slope:.1f} dB against the model's {want:.1f} (within 1), and the model is {s_model:.1f} dB an octave",
       abs(slope - want) <= 1 and -19 <= s_model <= -17, (slope, want, s_model))
    # Squelch: a loud input fights the resonance. The gain at the peak drops when the input is loud.
    pk_q = dio_tone(500, 500, 0.01, 0.85) / 0.01; pk_l = dio_tone(500, 500, 0.6, 0.85) / 0.6
    ck(f"Df. Diode 18: a loud input fights the peak (peak gain {db(pk_q):.1f} dB quiet, {db(pk_l):.1f} dB loud, want 6 dB or more apart)", db(pk_q) - db(pk_l) >= 6, (db(pk_q), db(pk_l)))
    pk_up = db(pk_q) - db(dio_tone(500, 20000, 0.01) / 0.01)
    ck(f"Df. Diode 18 resonance 0.85 makes a peak at the cutoff ({pk_up:.1f} dB above the open filter, want 10 or more)", pk_up >= 10, pk_up)
    # Passband make-up: a saw at resonance 0.5 and 0.85 stays within 3 dB of resonance 0
    lv = {}
    for rv in (0, 0.5, 0.85):
        L, _ = render(patch(filt={"model": "diode18", "cutoff": 800, "res": rv}), note(36), 1.0, rack=False)
        lv[rv] = db(float(np.sqrt(np.mean(L[SR // 2:] ** 2))))
    ck(f"Df. Diode 18 keeps its level as resonance rises (0.5: {lv[0.5] - lv[0]:+.1f} dB, 0.85: {lv[0.85] - lv[0]:+.1f} dB; within 3)",
       abs(lv[0.5] - lv[0]) <= 3 and abs(lv[0.85] - lv[0]) <= 3, lv)
    # Extremes: full resonance, both ends of the cutoff, full drive, a hot chord: finite and bounded
    worst, bad = 0.0, 0
    for cut in (16, 262, 20000):
        L, R = render(patch(osc1={"wave": "saw", "level": 1}, osc2={"wave": "pulse", "level": 1}, sub={"level": 1}, v1={"drive": 10},
                            filt={"model": "diode18", "cutoff": cut, "res": 1, "drive": 10, "env": 1}), [e for k in (24, 48, 72, 96) for e in note(k, 0.0)], 1.0, rack=False)
        bad += int(np.sum(~np.isfinite(L)) + np.sum(~np.isfinite(R))); worst = max(worst, float(np.max(np.abs(L))))
    ck(f"Df. Diode 18 at full resonance and drive, cutoff 16 Hz to 20 kHz: finite and bounded (peak {worst:.2f}, want under 8)", bad == 0 and worst < 8, (bad, worst))
    # Stereo offset runs two Diode 18 filters per voice
    L, R = render(patch(filt={"model": "diode18", "cutoff": 600, "offset": 1}, stereo={"pan": "center", "spread": 0}), note(45), 1.5, rack=False)
    def _cen(x):
        X = np.abs(np.fft.rfft(x * np.hanning(len(x)))); f_ = np.fft.rfftfreq(len(x), 1 / SR); return float(np.sum(X * f_) / np.sum(X))
    cl, cr = _cen(L[SR // 2:]), _cen(R[SR // 2:])
    ck(f"Df. diode18 stereo offset +1 oct: the right side is brighter (centroid {cl:.0f} -> {cr:.0f} Hz)", cr > cl * 1.25, (cl, cr))
    # The schema: diode18 is a model; an unknown one still falls back; the factory Diode Squelch is on it
    nz = pg.evaluate("""() => { const N = __synth.eq.normalize;
      return { d: N({ filt: { model: 'diode18' } }).filt.model, x: N({ filt: { model: 'diode99' } }).filt.model,
               sq: __synth.factoryPatch('Diode Squelch').filt.model }; }""")
    ck(f"Df. a patch with filt.model diode18 keeps it; an unknown model loads as Valve 12; Diode Squelch is on Diode 18 ({nz})",
       nz == {"d": "diode18", "x": "valve12", "sq": "diode18"}, nz)

    # ---------------------------------------------------------------- Sk. Sallen-Key 12 (2-pole, clipping gain stage, high-pass partner)
    L, _ = render(patch(osc1={"level": 0}, filt={"model": "sk12", "cutoff": 262, "res": 0.85, "keytrack": 1}), note(60), 1.5, rack=False)
    q = float(np.sqrt(np.mean(L[SR // 2:] ** 2)))
    ck(f"Sk. Sallen-Key 12 at resonance 0.85 stays quiet with no input ({db(q):.1f} dBFS, want below -80)", db(q) < -80, db(q))
    L, _ = render(patch(osc1={"level": 0}, filt={"model": "sk12", "cutoff": 262, "res": 1, "keytrack": 1}), note(60), 1.5, rack=False)
    xs = L[SR // 2:]; q = float(np.sqrt(np.mean(xs ** 2)))
    ck(f"Sk. Sallen-Key 12 at full resonance sings on its own ({db(q):.1f} dBFS, want -30 to -3)", -30 < db(q) < -3, db(q))
    f0 = peak_freq(xs); hs = harmonics_db(xs, f0)
    ck(f"Sk. its full-resonance scream is squared off: H3 {hs[1]:.1f} dB and H2 {hs[0]:.1f} dB below the fundamental (want H3 above -25, H2 above -35: the clip is uneven)",
       hs[1] > -25 and hs[0] > -35, hs)
    def sk_tone(f, cut, lvl=0.05, res=0, hp=20, model="sk12"):
        L, _ = render(patch(osc1={"wave": "sine", "level": lvl, "fixed": f}, filt={"model": model, "cutoff": cut, "res": res, "hp": hp}), note(60), 1.0, rack=False)
        return tone_amp(L[SR // 2:], f)
    slope = db(sk_tone(6000, 100) / sk_tone(3000, 100)) - db(sk_tone(6000, 20000) / sk_tone(3000, 20000))
    want = db(H("sk12", 6000, 100) / H("sk12", 3000, 100)) - db(H("sk12", 6000, 20000) / H("sk12", 3000, 20000))
    ck(f"Sk. Sallen-Key 12 rolls off like two poles: 3 to 6 kHz with the knob at 100 Hz measures {slope:.1f} dB against the model's {want:.1f} (within 0.5)",
       abs(slope - want) <= 0.5 and -12.5 <= want <= -11.5, (slope, want))
    pk_q = sk_tone(500, 500, 0.01, 0.85) / 0.01; pk_l = sk_tone(500, 500, 0.6, 0.85) / 0.6; pk_o = sk_tone(500, 20000, 0.01) / 0.01
    ck(f"Sk. resonance 0.85 makes a peak at the cutoff ({db(pk_q) - db(pk_o):.1f} dB above the open filter, want 15 or more)", db(pk_q) - db(pk_o) >= 15, (db(pk_q), db(pk_o)))
    ck(f"Sk. a loud input clips the peak down (peak gain {db(pk_q):.1f} dB quiet, {db(pk_l):.1f} dB loud, want 10 dB or more apart)", db(pk_q) - db(pk_l) >= 10, (db(pk_q), db(pk_l)))
    lv = {}
    for rv in (0, 0.5, 0.85):
        L, _ = render(patch(filt={"model": "sk12", "cutoff": 800, "res": rv}), note(36), 1.0, rack=False)
        lv[rv] = db(float(np.sqrt(np.mean(L[SR // 2:] ** 2))))
    ck(f"Sk. Sallen-Key 12 keeps its level as resonance rises (0.5: {lv[0.5] - lv[0]:+.1f} dB, 0.85: {lv[0.85] - lv[0]:+.1f} dB; within 3)",
       abs(lv[0.5] - lv[0]) <= 3 and abs(lv[0.85] - lv[0]) <= 3, lv)
    # The high-pass partner: a 2-pole high-pass (K s^2 / (s^2 + (3 - K) s + 1), Butterworth at zero resonance) in front
    def H_hp(f, fc):
        fs = 2 * SR; W = math.tan(math.pi * f / fs) / math.tan(math.pi * fc / fs); s_ = 1j * W
        return abs(s_ * s_ / (s_ * s_ + math.sqrt(2) * s_ + 1))
    hd = [(f, db(sk_tone(f, 20000, hp=1000) / sk_tone(f, 20000)), db(H_hp(f, 1000))) for f in (250, 500, 1000, 4000)]
    ck(f"Sk. the high-pass at 1 kHz follows the 2-pole model within 0.5 dB at 250 Hz to 4 kHz ({[(f, round(m, 2), round(w, 2)) for f, m, w in hd]})",
       all(abs(m - w) <= 0.5 for _, m, w in hd), hd)
    a_lo = sk_tone(250, 20000, res=0.95, hp=1000); a_pk = sk_tone(1000, 20000, res=0.95, hp=1000)
    ck(f"Sk. the high-pass takes half the resonance: at 0.95 it peaks at its cutoff ({db(a_pk / sk_tone(1000, 20000, res=0.95)):+.1f} dB) and still cuts 250 Hz ({db(a_lo / sk_tone(250, 20000, res=0.95)):.1f} dB)",
       1 <= db(a_pk / sk_tone(1000, 20000, res=0.95)) <= 9 and db(a_lo / sk_tone(250, 20000, res=0.95)) < -15)
    # (each render starts its oscillators at a random phase, so the two are compared by level, not sample for sample)
    d_hp = db(sk_tone(300, 2000, res=0.3, hp=1000, model="ladder24") / sk_tone(300, 2000, res=0.3, hp=20, model="ladder24"))
    ck(f"Sk. the high-pass knob does nothing on the other models (Ladder 24 at 300 Hz with it at 1 kHz and off: {d_hp:+.3f} dB, want within 0.05; it would cut about 19 dB)", abs(d_hp) <= 0.05, d_hp)
    worst, bad = 0.0, 0
    for cut in (16, 262, 20000):
        for hpv in (20, 4000):
            L, R = render(patch(osc1={"wave": "saw", "level": 1}, osc2={"wave": "pulse", "level": 1}, sub={"level": 1}, v1={"drive": 10},
                                filt={"model": "sk12", "cutoff": cut, "res": 1, "drive": 10, "env": 1, "hp": hpv}), [e for k in (24, 48, 72, 96) for e in note(k, 0.0)], 1.0, rack=False)
            bad += int(np.sum(~np.isfinite(L)) + np.sum(~np.isfinite(R))); worst = max(worst, float(np.max(np.abs(L))))
    ck(f"Sk. Sallen-Key 12 at full resonance and drive, cutoff 16 Hz to 20 kHz, high-pass off and at 4 kHz: finite and bounded (peak {worst:.2f}, want under 8)", bad == 0 and worst < 8, (bad, worst))
    L, R = render(patch(filt={"model": "sk12", "cutoff": 600, "offset": 1}, stereo={"pan": "center", "spread": 0}), note(45), 1.5, rack=False)
    cl, cr = _cen(L[SR // 2:]), _cen(R[SR // 2:])
    ck(f"Sk. sk12 stereo offset +1 oct: the right side is brighter (centroid {cl:.0f} -> {cr:.0f} Hz)", cr > cl * 1.25, (cl, cr))
    nz = pg.evaluate("""() => { const N = __synth.eq.normalize;
      return { m: N({ filt: { model: 'sk12' } }).filt.model, hp0: N({}).filt.hp, lo: N({ filt: { hp: 3 } }).filt.hp, hi: N({ filt: { hp: 99999 } }).filt.hp,
               sn: __synth.factoryPatch('Snarl Lead').filt.model }; }""")
    ck(f"Sk. a patch with filt.model sk12 keeps it; filt.hp defaults to 20 (off) and clamps to 20..4000; Snarl Lead is on Sallen-Key 12 ({nz})",
       nz == {"m": "sk12", "hp0": 20, "lo": 20, "hi": 4000, "sn": "sk12"}, nz)

    # ---------------------------------------------------------------- Po. Poly 24 (four OTA stages in a cascade)
    L, _ = render(patch(osc1={"level": 0}, filt={"model": "poly24", "cutoff": 262, "res": 0.85, "keytrack": 1}), note(60), 1.5, rack=False)
    q = float(np.sqrt(np.mean(L[SR // 2:] ** 2)))
    ck(f"Po. Poly 24 at resonance 0.85 stays quiet with no input ({db(q):.1f} dBFS, want below -80)", db(q) < -80, db(q))
    L, _ = render(patch(osc1={"level": 0}, filt={"model": "poly24", "cutoff": 262, "res": 1, "keytrack": 1}), note(60), 1.5, rack=False)
    xs = L[SR // 2:]; q = float(np.sqrt(np.mean(xs ** 2))); hs = harmonics_db(xs, peak_freq(xs))
    ck(f"Po. Poly 24 at full resonance sings on its own, close to a sine ({db(q):.1f} dBFS, want -30 to -3; H3 {hs[1]:.1f} dB, want below -40)",
       -30 < db(q) < -3 and hs[1] < -40, (db(q), hs))
    def po_tone(f, cut, lvl=0.05, res=0, drive=3, model="poly24"):
        L, _ = render(patch(osc1={"wave": "sine", "level": lvl, "fixed": f}, filt={"model": model, "cutoff": cut, "res": res, "drive": drive}), note(60), 1.0, rack=False)
        return tone_amp(L[SR // 2:], f)
    slope = db(po_tone(6000, 100) / po_tone(3000, 100)) - db(po_tone(6000, 20000) / po_tone(3000, 20000))
    want = db(H("poly24", 6000, 100) / H("poly24", 3000, 100)) - db(H("poly24", 6000, 20000) / H("poly24", 3000, 20000))
    ck(f"Po. Poly 24 rolls off like four poles: 3 to 6 kHz with the knob at 100 Hz measures {slope:.1f} dB against the model's {want:.1f} (within 0.5)",
       abs(slope - want) <= 0.5 and -24.5 <= want <= -23, (slope, want))
    bp = db(po_tone(100, 1000, res=0.85) / po_tone(100, 1000)); bl = db(po_tone(100, 1000, res=0.85, model="ladder24") / po_tone(100, 1000, model="ladder24"))
    ck(f"Po. Poly 24 keeps more of its bass than Ladder 24 as resonance rises (100 Hz under a 1 kHz cutoff at resonance 0.85: {bp:+.1f} dB against {bl:+.1f} dB; want 1 dB or more ahead, and within 4 dB of resonance 0)",
       bp - bl >= 1 and bp >= -4, (bp, bl))
    pk_q = po_tone(500, 500, 0.01, 0.85) / 0.01; pk_l = po_tone(500, 500, 0.6, 0.85) / 0.6; pk_o = po_tone(500, 20000, 0.01) / 0.01
    ck(f"Po. resonance 0.85 makes a peak at the cutoff ({db(pk_q) - db(pk_o):.1f} dB above the open filter, want 15 or more), and a loud input clips it down ({db(pk_l) - db(pk_o):.1f} dB, want 6 dB or more lower)",
       db(pk_q) - db(pk_o) >= 15 and db(pk_q) - db(pk_l) >= 6, (db(pk_q), db(pk_l), db(pk_o)))
    sq, sl3, sl10 = po_tone(2000, 500, 0.01, drive=10) / 0.01, po_tone(2000, 500, 0.8) / 0.8, po_tone(2000, 500, 0.8, drive=10) / 0.8
    sq3 = po_tone(2000, 500, 0.01) / 0.01
    ck(f"Po. the stages slew with drive, not at a normal level (a loud 2 kHz tone over a 500 Hz cutoff loses {db(sl3) - db(sq3):+.2f} dB at drive 3, want within 0.5; {db(sl10) - db(sq):+.2f} dB at drive 10, want 1 dB or more)",
       abs(db(sl3) - db(sq3)) <= 0.5 and db(sl10) - db(sq) <= -1, (db(sl3) - db(sq3), db(sl10) - db(sq)))
    lv = {}
    for rv in (0, 0.5, 0.85):
        L, _ = render(patch(filt={"model": "poly24", "cutoff": 800, "res": rv}), note(36), 1.0, rack=False)
        lv[rv] = db(float(np.sqrt(np.mean(L[SR // 2:] ** 2))))
    ck(f"Po. Poly 24 keeps its level as resonance rises (0.5: {lv[0.5] - lv[0]:+.1f} dB, 0.85: {lv[0.85] - lv[0]:+.1f} dB; within 3)",
       abs(lv[0.5] - lv[0]) <= 3 and abs(lv[0.85] - lv[0]) <= 3, lv)
    worst, bad = 0.0, 0
    for cut in (16, 262, 20000):
        L, R = render(patch(osc1={"wave": "saw", "level": 1}, osc2={"wave": "pulse", "level": 1}, sub={"level": 1}, v1={"drive": 10},
                            filt={"model": "poly24", "cutoff": cut, "res": 1, "drive": 10, "env": 1}), [e for k in (24, 48, 72, 96) for e in note(k, 0.0)], 1.0, rack=False)
        bad += int(np.sum(~np.isfinite(L)) + np.sum(~np.isfinite(R))); worst = max(worst, float(np.max(np.abs(L))))
    ck(f"Po. Poly 24 at full resonance and drive, cutoff 16 Hz to 20 kHz: finite and bounded (peak {worst:.2f}, want under 8)", bad == 0 and worst < 8, (bad, worst))
    L, R = render(patch(filt={"model": "poly24", "cutoff": 600, "offset": 1}, stereo={"pan": "center", "spread": 0}), note(45), 1.5, rack=False)
    cl, cr = _cen(L[SR // 2:]), _cen(R[SR // 2:])
    ck(f"Po. poly24 stereo offset +1 oct: the right side is brighter (centroid {cl:.0f} -> {cr:.0f} Hz)", cr > cl * 1.25, (cl, cr))
    nz = pg.evaluate("""() => { const N = __synth.eq.normalize;
      return { m: N({ filt: { model: 'poly24' } }).filt.model, vb: __synth.factoryPatch('Velvet Brass').filt.model }; }""")
    ck(f"Po. a patch with filt.model poly24 keeps it; Velvet Brass is on Poly 24 ({nz})", nz == {"m": "poly24", "vb": "poly24"}, nz)

    # ---------------------------------------------------------------- Sv. SVF 12 (state variable multimode with morph)
    L, _ = render(patch(osc1={"level": 0}, filt={"model": "svf12", "cutoff": 262, "res": 0.85, "keytrack": 1}), note(60), 1.5, rack=False)
    q = float(np.sqrt(np.mean(L[SR // 2:] ** 2)))
    ck(f"Sv. SVF 12 at resonance 0.85 stays quiet with no input ({db(q):.1f} dBFS, want below -80)", db(q) < -80, db(q))
    sing = {}
    for mo in (0, 1, 2, 3):
        L, _ = render(patch(osc1={"level": 0}, filt={"model": "svf12", "cutoff": 262, "res": 1, "keytrack": 1, "morph": mo}), note(60), 1.5, rack=False)
        xs = L[SR // 2:]; sing[mo] = (db(float(np.sqrt(np.mean(xs ** 2)))), peak_freq(xs) if np.max(np.abs(xs)) > 1e-6 else 0, harmonics_db(xs, 262)[1], db(tone_amp(xs, 262)))
    ck(f"Sv. SVF 12 at full resonance sings on its own at low-pass, band-pass and high-pass, at 262 Hz ({ {k: (round(v[0], 1), round(v[1], 1), round(v[2], 1)) for k, v in sing.items()} }; want -30 to -3 dBFS and within 5 cents; low-pass and band-pass close to a sine, H3 below -35 dB)",
       all(-30 < sing[m][0] < -3 and abs(1200 * math.log2(max(sing[m][1], 1) / 262)) <= 5 for m in (0, 1, 2)) and sing[0][2] < -35 and sing[1][2] < -35, sing)
    ck(f"Sv. at notch the singing fundamental cancels ({sing[3][3]:.1f} dB at 262 Hz against {sing[0][3]:.1f} at low-pass, want 40 dB or more under; what is left is the loop's harmonics, {sing[3][0]:.1f} dBFS)", sing[0][3] - sing[3][3] >= 40, sing[3])
    def sv_tone(f, cut, lvl=0.05, res=0, drive=3, morph=0, model="svf12"):
        L, _ = render(patch(osc1={"wave": "sine", "level": lvl, "fixed": f}, filt={"model": model, "cutoff": cut, "res": res, "drive": drive, "morph": morph}), note(60), 1.0, rack=False)
        return tone_amp(L[SR // 2:], f)
    FQ = (100, 250, 1000, 4000, 10000)
    ref = {f: sv_tone(f, 20000) for f in FQ}
    resp = {mo: [db(sv_tone(f, 1000, morph=mo) / ref[f]) for f in FQ] for mo in (0, 1, 2, 3)}
    info("Sv. response at a 1 kHz cutoff, dB at 100, 250, 1k, 4k, 10k Hz", {k: [round(x, 1) for x in v] for k, v in resp.items()})
    def svh(mo, f, fc=1000):
        fs = 2 * SR; W = math.tan(math.pi * f / fs) / math.tan(math.pi * fc / fs); d = 1 - W * W + 2j * 0.70710678 * W
        return abs([1, 1j * 1.41421356 * W, -W * W, 1 - W * W][mo] / d)
    # 100 Hz to 4 kHz (10 kHz under a 1 kHz knob reads 2 to 4 dB above the model on every filter model, the old ones too: not this filter)
    errs_ = {mo: max(abs(resp[mo][i] - db(svh(mo, f))) for i, f in enumerate(FQ[:4]) if db(svh(mo, f)) > -60) for mo in (0, 1, 2, 3)}
    ck(f"Sv. each morph point is its 2-pole response: low-pass (0), band-pass with a unit peak (1), high-pass (2), notch (3), within 0.5 dB of the model from 100 Hz to 4 kHz wherever it is above -60 dB (worst {max(errs_.values()):.2f} dB)",
       max(errs_.values()) <= 0.5 and resp[3][2] < -40 and abs(resp[1][2]) < 0.5, (errs_, resp))
    mid = [db(sv_tone(f, 1000, morph=0.5) / ref[f]) for f in (100, 4000)]
    ck(f"Sv. morph is continuous: halfway from low-pass to band-pass sits between the two (100 Hz {mid[0]:.1f} dB, 4 kHz {mid[1]:.1f} dB)",
       resp[1][0] < mid[0] < resp[0][0] and resp[0][3] < mid[1] < resp[1][3], (mid, resp[0], resp[1]))
    pk_q = sv_tone(500, 500, 0.01, 0.85) / 0.01; pk_l = sv_tone(500, 500, 0.6, 0.85) / 0.6; pk_o = sv_tone(500, 20000, 0.01) / 0.01
    ck(f"Sv. resonance 0.85 makes a peak at the cutoff ({db(pk_q) - db(pk_o):.1f} dB above the open filter, want 15 or more), and a loud input clips it down ({db(pk_l) - db(pk_o):.1f} dB, want 6 dB or more lower)",
       db(pk_q) - db(pk_o) >= 15 and db(pk_q) - db(pk_l) >= 6, (db(pk_q), db(pk_l), db(pk_o)))
    sq, sl3, sl10 = sv_tone(2000, 500, 0.01, drive=10) / 0.01, sv_tone(2000, 500, 0.8) / 0.8, sv_tone(2000, 500, 0.8, drive=10) / 0.8
    sq3 = sv_tone(2000, 500, 0.01) / 0.01
    ck(f"Sv. the integrators slew with drive, not at a normal level (a loud 2 kHz tone over a 500 Hz cutoff loses {db(sl3) - db(sq3):+.2f} dB at drive 3, want within 0.5; {db(sl10) - db(sq):+.2f} dB at drive 10, want 1 dB or more)",
       abs(db(sl3) - db(sq3)) <= 0.5 and db(sl10) - db(sq) <= -1, (db(sl3) - db(sq3), db(sl10) - db(sq)))
    lv = {}
    for rv in (0, 0.5, 0.85):
        L, _ = render(patch(filt={"model": "svf12", "cutoff": 800, "res": rv}), note(36), 1.0, rack=False)
        lv[rv] = db(float(np.sqrt(np.mean(L[SR // 2:] ** 2))))
    ck(f"Sv. SVF 12 keeps its level as resonance rises (0.5: {lv[0.5] - lv[0]:+.1f} dB, 0.85: {lv[0.85] - lv[0]:+.1f} dB; within 3)",
       abs(lv[0.5] - lv[0]) <= 3 and abs(lv[0.85] - lv[0]) <= 3, lv)
    worst, bad = 0.0, 0
    for cut in (16, 262, 20000):
        for mo in (0, 1.5, 3):
            L, R = render(patch(osc1={"wave": "saw", "level": 1}, osc2={"wave": "pulse", "level": 1}, sub={"level": 1}, v1={"drive": 10},
                                filt={"model": "svf12", "cutoff": cut, "res": 1, "drive": 10, "env": 1, "morph": mo}), [e for k in (24, 48, 72, 96) for e in note(k, 0.0)], 1.0, rack=False)
            bad += int(np.sum(~np.isfinite(L)) + np.sum(~np.isfinite(R))); worst = max(worst, float(np.max(np.abs(L))))
    ck(f"Sv. SVF 12 at full resonance and drive, cutoff 16 Hz to 20 kHz, at low-pass, between band and high, and notch: finite and bounded (peak {worst:.2f}, want under 8)", bad == 0 and worst < 8, (bad, worst))
    srnd = random.Random(11)
    sev, t = note(48, 0.0) + note(60, 0.0), 0.0
    while t < 9.5:
        t += 0.05
        sev.append({"at": t, "t": "patch", "load": False, "p": patch(filt={"model": "svf12", "cutoff": math.exp(srnd.uniform(math.log(20), math.log(20000))), "res": srnd.random(),
                    "drive": srnd.uniform(0, 10), "morph": srnd.uniform(0, 3), "offset": srnd.uniform(-1, 1), "env": srnd.uniform(-1, 1)}, lfo1={"cutoff": srnd.uniform(0, 4), "rate": srnd.uniform(0.1, 30)})})
    L, R = render(patch(filt={"model": "svf12"}), sev, 10.0, rack=False)
    bad = int(np.sum(~np.isfinite(L)) + np.sum(~np.isfinite(R))); pk = float(max(np.max(np.abs(L)), np.max(np.abs(R))))
    ck(f"Sv. 10 s of random cutoff, resonance, drive, morph and offset changes on two notes: finite, bounded and sounding (peak {pk:.2f})", bad == 0 and pk < 8 and float(np.sqrt(np.mean(L ** 2))) > 1e-3, (bad, pk))
    sine_s = patch(osc1={"wave": "sine", "level": 0.8}, envA={"a": 0.005, "s": 1, "r": 0.005}, filt={"model": "svf12", "cutoff": 2500, "res": 0.3})
    L, _ = render(sine_s, note(45, 0.05) + [{"at": 0.4, "t": "patch", "load": False, "p": patch(osc1={"wave": "sine", "level": 0.8}, envA={"a": 0.005, "s": 1, "r": 0.005}, filt={"model": "svf12", "cutoff": 2500, "res": 0.3, "morph": 3})}], 1.2, rack=False)
    s_ = np.abs(np.diff(L)); steady, worstst = float(np.max(s_[int(1.0 * SR):])), float(np.max(s_))
    ck(f"Sv. no click when morph moves from low-pass to notch under a held note (worst step {worstst:.5f}, steady {steady:.5f})", worstst <= 2.0 * steady + 1e-4, (worstst, steady))
    L, R = render(patch(filt={"model": "svf12", "cutoff": 600, "offset": 1}, stereo={"pan": "center", "spread": 0}), note(45), 1.5, rack=False)
    cl, cr = _cen(L[SR // 2:]), _cen(R[SR // 2:])
    ck(f"Sv. svf12 stereo offset +1 oct: the right side is brighter (centroid {cl:.0f} -> {cr:.0f} Hz)", cr > cl * 1.25, (cl, cr))
    md = [abs(db(sv_tone(f, 900, res=0.6, morph=3, model=m_) / sv_tone(f, 900, res=0.6, morph=0, model=m_))) for m_ in ("ladder24", "valve12") for f in (300, 900, 3000)]
    ck(f"Sv. morph does nothing on the other models (Ladder 24 and Valve 12 at morph 3 against 0, 300 Hz to 3 kHz: worst {max(md):.3f} dB, want within 0.01)", max(md) <= 0.01, md)
    nz = pg.evaluate("""() => { const N = __synth.eq.normalize, nd = __synth.factoryPatch('Notch Drift');
      return { m: N({ filt: { model: 'svf12' } }).filt.model, m0: N({}).filt.morph, lo: N({ filt: { morph: -2 } }).filt.morph, hi: N({ filt: { morph: 9 } }).filt.morph,
               nd: nd.filt.model + ':' + nd.filt.morph }; }""")
    ck(f"Sv. a patch with filt.model svf12 keeps it; filt.morph defaults to 0 (low-pass) and clamps to 0..3; Notch Drift is on SVF 12 at notch ({nz})",
       nz == {"m": "svf12", "m0": 0, "lo": 0, "hi": 3, "nd": "svf12:3"}, nz)

    # ---------------------------------------------------------------- Lg. Low pass gate (the vactrol)
    # The vactrol follows the amp envelope: it lights in a few ms and lets go slowly, and its conductance
    # sets both the cutoff and the level. Envelopes here are read off a 2 kHz sine (an analytic-signal
    # magnitude, smoothed over 2 ms), so the cycle does not get in the way.
    def lg_env(x, w=96):
        n_ = len(x); X = np.fft.fft(x); h = np.zeros(n_); h[0] = 1; h[1:(n_ + 1) // 2] = 2
        if n_ % 2 == 0: h[n_ // 2] = 1
        return np.convolve(np.abs(np.fft.ifft(X * h)), np.ones(w) / w, mode="same")
    def lg_times(e, levels):
        ip = int(np.argmax(e)); d_ = 20 * np.log10(np.maximum(e, 1e-12) / e[ip]); out = []
        for lv_ in levels:
            w_ = np.where(d_[ip:] < lv_)[0]; out.append((w_[0] + ip) / SR if len(w_) else None)
        return out
    L, _ = render(patch(osc1={"level": 0}, filt={"model": "lpg", "cutoff": 262, "res": 1, "keytrack": 1}), note(60), 1.5, rack=False)
    q = float(np.sqrt(np.mean(L[SR // 2:] ** 2)))
    ck(f"Lg. the low pass gate never sings: full resonance with no input stays quiet ({db(q):.1f} dBFS, want below -80)", db(q) < -80, db(q))
    def lg_tone(f, cut, lvl=0.05, res=0, drive=3, **fx):
        L, _ = render(patch(osc1={"wave": "sine", "level": lvl, "fixed": f}, filt=dict(model="lpg", cutoff=cut, res=res, drive=drive, **fx)), note(60), 1.0, rack=False)
        return tone_amp(L[SR // 2:], f)
    lo_ = lg_tone(500, 20000); pk1, pk5 = db(lg_tone(500, 500, res=1) / lo_), db(lg_tone(500, 500, res=0.5) / lo_)
    ck(f"Lg. resonance stays gentle: the peak at the cutoff is {pk1:+.1f} dB at full resonance (want +4 to +8; Q 2 is +6.0) and {pk5:+.1f} dB at 0.5 (Butterworth is -3.0 at zero)", 4 <= pk1 <= 8 and -1.5 <= pk5 <= 2, (pk1, pk5))
    lgP = lambda model, **f: patch(osc1={"wave": "sine", "level": 0.3, "fixed": 2000}, filt=dict(model=model, cutoff=20000, **f))
    L, _ = render(lgP("lpg", gate="vca"), note(60), 0.5, rack=False); e_ = lg_env(L); st_ = float(np.median(e_[int(0.2 * SR):int(0.4 * SR)]))
    att = [db(e_[int(ms * SR / 1000)]) - db(st_) for ms in (2, 10)]
    ck(f"Lg. the vactrol lights in a few ms: {att[0]:+.1f} dB at 2 ms (want below -3: it rounds the front off), {att[1]:+.2f} dB at 10 ms (want within 0.5 of steady)", att[0] < -3 and abs(att[1]) <= 0.5, att)
    pl = lambda **f: patch(osc1={"wave": "sine", "level": 0.3, "fixed": 2000}, filt=dict(model="lpg", cutoff=20000, gate="vca", **f), envA={"a": 0.001, "d": 0.03, "s": 0, "r": 0.03})
    tl = {}
    for lag in (0.1, 0.3):
        L, _ = render(pl(lag=lag), note(60), 2.5, rack=False); tl[lag] = lg_times(lg_env(L), (-6, -20, -40))
    r6, r40 = tl[0.3][0] / 6, (tl[0.3][2] - tl[0.3][1]) / 20
    ck(f"Lg. it lets go slowly, and more slowly as it darkens: at lag 0.3 s the first 6 dB take {1000 * r6:.0f} ms a dB and -20 to -40 dB {1000 * r40:.0f} ms a dB (want 1.15x or more)", r40 >= 1.15 * r6 and tl[0.3][2] > 0.8, tl)
    ck(f"Lg. the lag knob sets the release: -40 dB at {tl[0.1][2]:.2f} s with lag 0.1 and {tl[0.3][2]:.2f} s with lag 0.3 (want 2.4x to 3.3x)", 2.4 <= tl[0.3][2] / tl[0.1][2] <= 3.3, tl)
    def lg_cen(x):
        X = np.abs(np.fft.rfft(x * np.hanning(len(x)))); f_ = np.fft.rfftfreq(len(x), 1 / SR); return float(np.sum(X * f_) / max(np.sum(X), 1e-12))
    lgQ = lambda g, **e: patch(filt=dict(model="lpg", cutoff=3000, gate=g, lag=0.3), envA=dict({"a": 0.001, "d": 0.05, "s": 0, "r": 0.05, "vel": 0.6}, **e))
    # The -20 dB times for the comparison below are read through a window of exactly two periods of the note
    # (C3): a 10 ms window leaves the saw's ripple in, and where its peak falls moved the time by up to +/-3 ms
    # with the oscillator's random start phase (measured 29 Oct: lp minus SVF 12 ran -4.1 to +5.5 ms over 11
    # renders, and 5.5 failed the 5 ms bound on main; through the two-period window -0.5 to +3.0 over 10).
    W48 = round(2 * SR / 130.8128)
    gc_ = {}
    for g in ("both", "vca", "lp"):
        L, _ = render(lgQ(g), note(48), 2.0, rack=False); e_ = lg_env(L, 480); ip = int(np.argmax(e_)); t20 = lg_times(e_, (-20,))[0]; i20 = int(t20 * SR)
        gc_[g] = (lg_cen(L[max(0, ip - 1200):ip + 1200]), lg_cen(L[i20 - 1200:i20 + 1200]), lg_times(lg_env(L, W48), (-20,))[0])
    ck(f"Lg. filter + VCA: the note darkens as it fades (centroid {gc_['both'][0]:.0f} Hz at the peak, {gc_['both'][1]:.0f} at -20 dB, want under half); VCA only keeps its colour ({gc_['vca'][0]:.0f} -> {gc_['vca'][1]:.0f}, within 10%)",
       gc_["both"][1] < 0.5 * gc_["both"][0] and abs(gc_["vca"][1] / gc_["vca"][0] - 1) <= 0.1, gc_)
    L, _ = render(patch(filt={"model": "svf12", "cutoff": 3000}, envA={"a": 0.001, "d": 0.05, "s": 0, "r": 0.05, "vel": 0.6}), note(48), 2.0, rack=False)
    t20s = lg_times(lg_env(L, W48), (-20,))[0]
    hs = {}
    for g in ("lp", "vca"):
        L, _ = render(lgQ(g, s=0.25, d=0.02), note(48), 1.0, rack=False); hs[g] = lg_cen(L[SR // 2:])
    ck(f"Lg. filter only: the level follows the envelope (-20 dB at {1000 * gc_['lp'][2]:.1f} ms, SVF 12 with the same envelope {1000 * t20s:.1f} ms, within 5) and a held note at sustain 0.25 is darker than VCA only (centroid {hs['lp']:.0f} against {hs['vca']:.0f} Hz, want 30% lower)",
       abs(gc_["lp"][2] - t20s) <= 0.005 and hs["lp"] < 0.7 * hs["vca"], (gc_["lp"], t20s, hs))
    vv = {}
    for v_ in (0.3, 1.0):
        L, _ = render(lgQ("both"), note(48, v=v_), 1.0, rack=False); vv[v_] = (db(float(np.sqrt(np.mean(L[:4800] ** 2)))), lg_cen(L[:4800]))
    ck(f"Lg. a softer note lights the vactrol less, so it is quieter and darker (velocity 0.3: {vv[0.3][0] - vv[1.0][0]:+.1f} dB, centroid {vv[0.3][1]:.0f} against {vv[1.0][1]:.0f} Hz)",
       vv[0.3][0] - vv[1.0][0] <= -3 and vv[0.3][1] < 0.8 * vv[1.0][1], vv)
    L, _ = render(pl(lag=1.0), note(60, 0.0, 0.05), 1.0, rack=False); e_ = lg_env(L)
    tail = db(float(np.max(e_[int(0.35 * SR):int(0.45 * SR)]))) - db(float(np.max(e_)))
    L, _ = render(pl(lag=0.2), note(60, 0.0, 0.05), 3.0, rack=False); end_ = float(np.max(np.abs(L[-2400:])))
    ck(f"Lg. a released note keeps sounding while the vactrol is lit: 0.3 s after the envelope has gone it is {tail:.1f} dB under its peak (lag 1 s, want above -40); with lag 0.2 s it has ended by 3 s ({db(end_):.0f} dBFS in the last 50 ms, want below -90)",
       tail > -40 and db(end_) < -90, (tail, end_))
    worst, bad = 0.0, 0
    for cut in (16, 262, 20000):
        for g in ("both", "lp", "vca"):
            L, R = render(patch(osc1={"wave": "saw", "level": 1}, osc2={"wave": "pulse", "level": 1}, sub={"level": 1}, v1={"drive": 10},
                                filt={"model": "lpg", "cutoff": cut, "res": 1, "drive": 10, "env": 1, "gate": g, "lag": 3}), [e for k in (24, 48, 72, 96) for e in note(k, 0.0)], 1.0, rack=False)
            bad += int(np.sum(~np.isfinite(L)) + np.sum(~np.isfinite(R))); worst = max(worst, float(np.max(np.abs(L))))
    ck(f"Lg. full resonance and drive, cutoff 16 Hz to 20 kHz, each gate mode: finite and bounded (peak {worst:.2f}, want under 8)", bad == 0 and worst < 8, (bad, worst))
    lrnd = random.Random(23)
    sev, t = note(48, 0.0) + note(60, 0.0), 0.0
    while t < 9.5:
        t += 0.05
        if lrnd.random() < 0.1: sev += note(lrnd.choice((36, 55, 67, 79)), t, t + lrnd.uniform(0.02, 0.4), lrnd.uniform(0.1, 1))
        sev.append({"at": t, "t": "patch", "load": False, "p": patch(filt={"model": "lpg", "cutoff": math.exp(lrnd.uniform(math.log(20), math.log(20000))), "res": lrnd.random(),
                    "drive": lrnd.uniform(0, 10), "lag": lrnd.uniform(0.02, 3), "gate": lrnd.choice(("both", "lp", "vca")), "offset": lrnd.uniform(-1, 1), "env": lrnd.uniform(-1, 1)},
                    envA={"a": 0.001, "d": lrnd.uniform(0.01, 1), "s": lrnd.random(), "r": 0.1}, lfo1={"cutoff": lrnd.uniform(0, 4), "rate": lrnd.uniform(0.1, 30)})})
    L, R = render(patch(filt={"model": "lpg"}), sev, 10.0, rack=False)
    bad = int(np.sum(~np.isfinite(L)) + np.sum(~np.isfinite(R))); pk = float(max(np.max(np.abs(L)), np.max(np.abs(R))))
    ck(f"Lg. 10 s of random cutoff, resonance, drive, lag, gate mode and envelope changes with notes coming and going: finite, bounded and sounding (peak {pk:.2f})", bad == 0 and pk < 8 and float(np.sqrt(np.mean(L ** 2))) > 1e-3, (bad, pk))
    sine_g = lambda g: patch(osc1={"wave": "sine", "level": 0.8}, envA={"a": 0.005, "s": 0.6, "r": 0.005}, filt={"model": "lpg", "cutoff": 2500, "res": 0.3, "gate": g})
    L, _ = render(sine_g("both"), note(45, 0.05) + [{"at": 0.4, "t": "patch", "load": False, "p": sine_g("vca")}], 1.2, rack=False)
    s_ = np.abs(np.diff(L)); steady, worstst = float(np.max(s_[int(1.0 * SR):])), float(np.max(s_))
    ck(f"Lg. no click when the gate mode changes under a held note (worst step {worstst:.5f}, steady {steady:.5f})", worstst <= 2.0 * steady + 1e-4, (worstst, steady))
    # The coefficient memo is keyed on the model and the patch epoch: a change from the gate to Valve 12
    # must not reuse the gate's coefficients (with the key at epoch x 6 + model they collided here: measured
    # 1.03 dB off in Node). VCA only, so the gate's cutoff is exactly the knob and the memo inputs match.
    vp = patch(osc1={"wave": "sine", "level": 0.05, "fixed": 1000}, filt={"model": "valve12", "cutoff": 1000, "res": 0.5})
    gp = patch(osc1={"wave": "sine", "level": 0.05, "fixed": 1000}, filt={"model": "lpg", "cutoff": 1000, "res": 0.5, "gate": "vca"})
    a0 = tone_amp(render(vp, note(60), 1.0, rack=False)[0][int(0.6 * SR):], 1000)
    a1 = tone_amp(render(gp, note(60) + [{"at": 0.3, "t": "patch", "load": False, "p": vp}], 1.0, rack=False)[0][int(0.6 * SR):], 1000)
    ck(f"Lg. a change from the gate to Valve 12 mid-note takes Valve 12's coefficients ({db(a1) - db(a0):+.2f} dB against Valve 12 from the start, want within 0.2)", abs(db(a1) - db(a0)) <= 0.2, (db(a0), db(a1)))
    L, R = render(patch(filt={"model": "lpg", "cutoff": 600, "offset": 1}, stereo={"pan": "center", "spread": 0}), note(45), 1.5, rack=False)
    cl, cr = _cen(L[SR // 2:]), _cen(R[SR // 2:])
    ck(f"Lg. lpg stereo offset +1 oct: the right side is brighter (centroid {cl:.0f} -> {cr:.0f} Hz)", cr > cl * 1.25, (cl, cr))
    nz = pg.evaluate("""() => { const N = __synth.eq.normalize, hp = __synth.factoryPatch('Hollow Pluck');
      return { m: N({ filt: { model: 'lpg' } }).filt.model, l0: N({}).filt.lag, g0: N({}).filt.gate, lo: N({ filt: { lag: 0 } }).filt.lag, hi: N({ filt: { lag: 9 } }).filt.lag,
               bad: N({ filt: { gate: 'loud' } }).filt.gate, vca: N({ filt: { gate: 'vca' } }).filt.gate, hp: hp.filt.model + ':' + hp.filt.gate }; }""")
    ck(f"Lg. a patch with filt.model lpg keeps it; filt.lag defaults to 0.3 s and clamps to 0.02..3; filt.gate defaults to both and keeps only both, lp or vca; Hollow Pluck is on the gate ({nz})",
       nz == {"m": "lpg", "l0": 0.3, "g0": "both", "lo": 0.02, "hi": 3, "bad": "both", "vca": "vca", "hp": "lpg:both"}, nz)
    # Hollow Pluck moved onto the gate: it should keep the level and the length it had on Valve 12.
    hpn = pg.evaluate("__synth.factoryPatch('Hollow Pluck')")
    hpo = json.loads(json.dumps(hpn)); hpo["filt"].update({"model": "valve12", "cutoff": 320, "res": 0.62, "env": 0.7}); hpo["envA"]["d"] = 0.9
    hpm = {}
    for k_, p_ in (("valve12", hpo), ("lpg", hpn)):
        L, _ = render(p_, note(60, 0.0, 0.5), 3.0, rack=False)
        w_ = 480; fr_ = L[:len(L) // w_ * w_].reshape(-1, w_); r_ = np.sqrt(np.mean(fr_ ** 2, axis=1)); ip = int(np.argmax(r_))
        d_ = 20 * np.log10(np.maximum(r_, 1e-12) / r_[ip]); t20_ = (np.where(d_[ip:] < -20)[0][0] + ip) * 0.01
        hpm[k_] = (db(float(np.sqrt(np.mean(L[:int(0.3 * SR)] ** 2)))), t20_)
    ck(f"Lg. Hollow Pluck on the gate keeps its level and length: first 300 ms {hpm['lpg'][0] - hpm['valve12'][0]:+.1f} dB against its Valve 12 version (within 1.5), -20 dB at {hpm['lpg'][1]:.2f} s against {hpm['valve12'][1]:.2f} s (within 0.08)",
       abs(hpm["lpg"][0] - hpm["valve12"][0]) <= 1.5 and abs(hpm["lpg"][1] - hpm["valve12"][1]) <= 0.08, hpm)

    # ---------------------------------------------------------------- Fb. filter slots A and B (serial, parallel, split)
    # Slot B (patch.filtB) is off by default. These measure each route against the 2-pole model, B on every
    # model against the same model in slot A, that B off changes nothing, and the extremes.
    # B off: the same as no filtB at all, whatever B's other fields say. The oscillators start at a random
    # phase, so this compares the first twelve harmonics of one note (the seeded Node bench,
    # scripts/bench_filament_voice.mjs --ref, is the sample-for-sample check against the tree before B).
    base_ = patch(osc1={"wave": "saw", "level": 0.8}, filt={"model": "ladder24", "cutoff": 900, "res": 0.6, "offset": 0.3})
    off_ = json.loads(json.dumps(base_)); off_["filtB"] = {"route": "off", "model": "diode18", "cutoff": 80, "res": 1, "env": 1, "bal": 1}
    f0_ = 440 * 2 ** ((45 - 69) / 12)
    hh = lambda p_: [db(tone_amp(ch[SR // 2:], f0_ * k)) for ch in render(p_, note(45), 1.0, rack=False) for k in range(1, 13)]
    ha, hb = hh(base_), hh(off_)
    dfo = max(abs(x - y) for x, y in zip(ha, hb))
    ck(f"Fb. with slot B off the voice is unchanged, whatever B's other fields say (first 12 harmonics on both sides: worst {dfo:.4f} dB apart, want within 0.02)", dfo <= 0.02, (ha, hb))
    # B on each model, serial behind an open A, matches that model in slot A at the same cutoff
    FQB = (250, 1000, 4000)
    wb = {}
    for m_ in ("valve12", "ladder24", "diode18", "sk12", "poly24", "svf12"):
        a_ = [tone_amp(render(patch(osc1={"wave": "sine", "level": 0.05, "fixed": f}, filt={"model": m_, "cutoff": 1000, "res": 0.3}), note(60), 1.0, rack=False)[0][SR // 2:], f) for f in FQB]
        b_ = [tone_amp(render(patch(osc1={"wave": "sine", "level": 0.05, "fixed": f}, filt={"model": "svf12", "cutoff": 20000},
                                    filtB={"route": "serial", "model": m_, "cutoff": 1000, "res": 0.3, "keytrack": 0}), note(60), 1.0, rack=False)[0][SR // 2:], f) for f in FQB]
        wb[m_] = round(max(abs(db(b_[i] / a_[i])) for i in range(len(FQB))), 3)
    ck(f"Fb. slot B on each model (serial, behind an open A) matches the same model in slot A at 250 Hz, 1 kHz and 4 kHz within 0.3 dB ({wb})", max(wb.values()) <= 0.3, wb)
    # serial: a 1 kHz low-pass (A, SVF 12) into a 1 kHz high-pass (B, SVF 12 at morph 2) is the product: a band
    def h2(mo, f, fc):
        fs = 2 * SR; W = math.tan(math.pi * f / fs) / math.tan(math.pi * fc / fs); d = 1 - W * W + 2j * 0.70710678 * W
        return [1, 1j * 1.41421356 * W, -W * W, 1 - W * W][mo] / d
    FQS = (100, 300, 1000, 2000, 4000)
    ref_ = {f: tone_amp(render(patch(osc1={"wave": "sine", "level": 0.05, "fixed": f}, filt={"model": "svf12", "cutoff": 20000}), note(60), 1.0, rack=False)[0][SR // 2:], f) for f in FQS}
    sr_ = {f: db(tone_amp(render(patch(osc1={"wave": "sine", "level": 0.05, "fixed": f}, filt={"model": "svf12", "cutoff": 1000},
                                       filtB={"route": "serial", "model": "svf12", "morph": 2, "cutoff": 1000, "keytrack": 0}), note(60), 1.0, rack=False)[0][SR // 2:], f) / ref_[f]) for f in FQS}
    se_ = {f: round(sr_[f] - db(abs(h2(0, f, 1000) * h2(2, f, 1000))), 2) for f in FQS}
    ck(f"Fb. serial: a 1 kHz low-pass into a 1 kHz high-pass is the product of the two, within 0.5 dB from 100 Hz to 4 kHz (error {se_}; measured {[round(sr_[f], 1) for f in FQS]} dB)",
       max(abs(x) for x in se_.values()) <= 0.5, (se_, sr_))
    # parallel: a 300 Hz low-pass (A) beside a 3 kHz high-pass (B), equal power: the complex sum at 0.707 each
    pr_ = {f: db(tone_amp(render(patch(osc1={"wave": "sine", "level": 0.05, "fixed": f}, filt={"model": "svf12", "cutoff": 300},
                                       filtB={"route": "parallel", "model": "svf12", "morph": 2, "cutoff": 3000, "keytrack": 0}), note(60), 1.0, rack=False)[0][SR // 2:], f) / ref_[f]) for f in FQS}
    pe_ = {f: round(pr_[f] - db(abs(0.70710678 * h2(0, f, 300) + 0.70710678 * h2(2, f, 3000))), 2) for f in FQS}
    ck(f"Fb. parallel: a 300 Hz low-pass beside a 3 kHz high-pass sums at equal power (-3 dB each), within 0.5 dB of the model from 100 Hz to 4 kHz (error {pe_}; measured {[round(pr_[f], 1) for f in FQS]} dB)",
       max(abs(x) for x in pe_.values()) <= 0.5, (pe_, pr_))
    bl_ = {}
    for bal in (-1, 1):
        bl_[bal] = [db(tone_amp(render(patch(osc1={"wave": "sine", "level": 0.05, "fixed": f}, filt={"model": "svf12", "cutoff": 300},
                                            filtB={"route": "parallel", "model": "svf12", "morph": 2, "cutoff": 3000, "keytrack": 0, "bal": bal}), note(60), 1.0, rack=False)[0][SR // 2:], f) / ref_[f]) for f in (100, 4000)]
    want_ = {-1: [db(abs(h2(0, f, 300))) for f in (100, 4000)], 1: [db(abs(h2(2, f, 3000))) for f in (100, 4000)]}
    be_ = max(abs(bl_[k][i] - want_[k][i]) for k in (-1, 1) for i in (0, 1) if want_[k][i] > -40)
    ck(f"Fb. parallel balance: all the way to A is A alone and all the way to B is B alone (at 100 Hz and 4 kHz: A {[round(x, 1) for x in bl_[-1]]}, B {[round(x, 1) for x in bl_[1]]} dB; worst {be_:.2f} dB off the model where above -40)",
       be_ <= 0.5 and bl_[-1][1] < -25 and bl_[1][0] < -25, (bl_, want_))
    # split: A plays the left side, B the right
    spl = lambda f: patch(osc1={"wave": "sine", "level": 0.05, "fixed": f}, filt={"model": "ladder24", "cutoff": 500}, filtB={"route": "split", "model": "svf12", "cutoff": 4000, "keytrack": 0})
    sl_ = {f: render(spl(f), note(60), 1.0, rack=False) for f in (250, 2000)}
    al_ = {f: tone_amp(render(patch(osc1={"wave": "sine", "level": 0.05, "fixed": f}, filt={"model": "ladder24", "cutoff": 500}), note(60), 1.0, rack=False)[0][SR // 2:], f) for f in (250, 2000)}
    bR_ = {f: tone_amp(render(patch(osc1={"wave": "sine", "level": 0.05, "fixed": f}, filt={"model": "svf12", "cutoff": 4000}), note(60), 1.0, rack=False)[1][SR // 2:], f) for f in (250, 2000)}
    sd_ = [round(db(tone_amp(sl_[f][0][SR // 2:], f) / al_[f]), 2) for f in (250, 2000)] + [round(db(tone_amp(sl_[f][1][SR // 2:], f) / bR_[f]), 2) for f in (250, 2000)]
    ck(f"Fb. split: the left side is A alone (Ladder 24 at 500 Hz) and the right side is B alone (SVF 12 at 4 kHz), within 0.2 dB at 250 Hz and 2 kHz ({sd_})", max(abs(x) for x in sd_) <= 0.2, sd_)
    L, R = render(patch(filt={"model": "svf12", "cutoff": 400}, filtB={"route": "split", "model": "svf12", "cutoff": 400, "keytrack": 0}), note(45), 1.5, rack=False)
    c0 = (_cen(L[SR // 2:]), _cen(R[SR // 2:]))
    L, R = render(patch(filt={"model": "svf12", "cutoff": 400, "offset": 1}, filtB={"route": "split", "model": "svf12", "cutoff": 400, "keytrack": 0}), note(45), 1.5, rack=False)
    c1 = (_cen(L[SR // 2:]), _cen(R[SR // 2:]))
    ck(f"Fb. split with A and B the same is centred (centroids {c0[0]:.0f} / {c0[1]:.0f} Hz, within 1%); a stereo offset of +1 moves A down and B up (left {c1[0]:.0f} Hz, right {c1[1]:.0f} Hz)",
       abs(c0[0] / c0[1] - 1) < 0.01 and c1[0] < c0[0] * 0.9 and c1[1] > c0[1] * 1.1, (c0, c1))
    # mono fold: split with two different low-passes, and parallel with a stereo offset, stay mono-safe
    mfs = {}
    for k_, p_ in (("split Ladder 24 / Diode 18", patch(osc2={"wave": "pulse", "level": 0.5, "fine": 7}, filt={"model": "ladder24", "cutoff": 700, "res": 0.5}, filtB={"route": "split", "model": "diode18", "cutoff": 1400, "res": 0.5})),
                   ("parallel Valve 12 / Poly 24 with offset 0.5", patch(osc2={"wave": "pulse", "level": 0.5, "fine": 7}, filt={"model": "valve12", "cutoff": 700, "res": 0.5, "offset": 0.5}, filtB={"route": "parallel", "model": "poly24", "cutoff": 2500, "res": 0.5})),
                   ("serial Sallen-Key 12 into Ladder 24 with offset 0.5", patch(osc2={"wave": "pulse", "level": 0.5, "fine": 7}, filt={"model": "sk12", "cutoff": 1500, "res": 0.5, "offset": 0.5}, filtB={"route": "serial", "model": "ladder24", "cutoff": 900, "res": 0.4}))):
        L, R = render(p_, [e for k in (48, 55, 60, 64) for e in note(k, 0.05, 1.8)], 2.4)
        seg = slice(int(0.3 * SR), int(1.7 * SR))
        st = math.sqrt((np.mean(L[seg] ** 2) + np.mean(R[seg] ** 2)) / 2); mo = math.sqrt(np.mean(((L[seg] + R[seg]) / 2) ** 2))
        mfs[k_] = round(db(st) - db(mo), 2)
    ck(f"Fb. mono fold with slot B on, through the rack: every route loses 3 dB or less folded to mono ({mfs})", max(mfs.values()) <= 3, mfs)
    # B self-oscillates where its model does, and follows the keys with its own key tracking
    so_ = []
    for n in (48, 72):
        L, _ = render(patch(osc1={"level": 0}, filt={"model": "svf12", "cutoff": 20000}, filtB={"route": "serial", "model": "ladder24", "cutoff": 262, "res": 1, "keytrack": 1}), note(n), 1.5, rack=False)
        so_.append(round(1200 * math.log2(peak_freq(L[SR // 2:]) / (262 * 2 ** ((n - 60) / 12))), 2))
    ck(f"Fb. slot B on Ladder 24 at full resonance sings on its own and tracks the keys within 5 cents ({so_} cents at C3 and C5)", max(abs(x) for x in so_) <= 5, so_)
    # B's own envelope amount and key tracking move B, not A
    def bcen(**fb):
        L, _ = render(patch(filt={"model": "svf12", "cutoff": 20000}, filtB=dict({"route": "serial", "model": "svf12", "cutoff": 300, "keytrack": 0}, **fb), envF={"a": 0.001, "d": 2, "s": 1}), note(45), 1.0, rack=False)
        return _cen(L[SR // 2:])
    ce0, ce1, ck1 = bcen(), bcen(env=0.5), bcen(keytrack=1)
    ck(f"Fb. B's own envelope amount and key tracking open B (centroid {ce0:.0f} Hz; env +50: {ce1:.0f}; key tracking 100% on A2: {ck1:.0f}, which sits below the knob's C4 so it closes)",
       ce1 > ce0 * 1.3 and ck1 < ce0 * 0.9, (ce0, ce1, ck1))
    # extremes: every route on every B model, full resonance and drive, both ends of the cutoff: finite and bounded
    worst, bad = 0.0, 0
    for rt in ("serial", "parallel", "split"):
        for m_ in ("valve12", "ladder24", "diode18", "sk12", "poly24", "svf12"):
            for cut in (16, 20000):
                L, R = render(patch(osc1={"wave": "saw", "level": 1}, osc2={"wave": "pulse", "level": 1}, sub={"level": 1}, v1={"drive": 10},
                                    filt={"model": "sk12" if m_ == "valve12" else "valve12", "cutoff": 262, "res": 1, "drive": 10, "env": 1, "offset": 0.5},
                                    filtB={"route": rt, "model": m_, "cutoff": cut, "res": 1, "env": 1, "morph": 1.5}), [e for k in (24, 60, 96) for e in note(k, 0.0)], 0.6, rack=False)
                bad += int(np.sum(~np.isfinite(L)) + np.sum(~np.isfinite(R))); worst = max(worst, float(np.max(np.abs(L))), float(np.max(np.abs(R))))
    ck(f"Fb. every route on every B model at full resonance, drive and envelope, B's cutoff at 16 Hz and 20 kHz: finite and bounded (peak {worst:.2f}, want under 8)", bad == 0 and worst < 8, (bad, worst))
    brnd = random.Random(31)
    sev, t = note(48, 0.0) + note(60, 0.0), 0.0
    MB = ("valve12", "ladder24", "diode18", "sk12", "poly24", "svf12")
    while t < 9.5:
        t += 0.05
        if brnd.random() < 0.1: sev += note(brnd.choice((36, 55, 67, 79)), t, t + brnd.uniform(0.02, 0.4), brnd.uniform(0.1, 1))
        sev.append({"at": t, "t": "patch", "load": False, "p": patch(
            filt={"model": brnd.choice(MB + ("lpg",)), "cutoff": math.exp(brnd.uniform(math.log(20), math.log(20000))), "res": brnd.random(), "drive": brnd.uniform(0, 10), "offset": brnd.uniform(-1, 1)},
            filtB={"route": brnd.choice(("off", "serial", "parallel", "split")), "model": brnd.choice(MB), "cutoff": math.exp(brnd.uniform(math.log(20), math.log(20000))), "res": brnd.random(),
                   "env": brnd.uniform(-1, 1), "keytrack": brnd.random(), "morph": brnd.uniform(0, 3), "bal": brnd.uniform(-1, 1)},
            lfo1={"cutoff": brnd.uniform(0, 4), "rate": brnd.uniform(0.1, 30), "phase": brnd.choice((0, 90))})})
    L, R = render(patch(filtB={"route": "serial"}), sev, 10.0, rack=False)
    bad = int(np.sum(~np.isfinite(L)) + np.sum(~np.isfinite(R))); pk = float(max(np.max(np.abs(L)), np.max(np.abs(R))))
    ck(f"Fb. 10 s of random routes, models, cutoffs, resonance, offsets and notes coming and going: finite, bounded and sounding (peak {pk:.2f})", bad == 0 and pk < 8 and float(np.sqrt(np.mean(L ** 2))) > 1e-3, (bad, pk))
    # a route change under a held note rides the duck: no click
    sine_b = lambda rt: patch(osc1={"wave": "sine", "level": 0.8}, envA={"a": 0.005, "s": 1, "r": 0.005}, filt={"model": "svf12", "cutoff": 2500, "res": 0.3}, filtB={"route": rt, "model": "ladder24", "cutoff": 6000})
    for rt in ("serial", "split"):
        L, R = render(sine_b("off"), note(45, 0.05) + [{"at": 0.4, "t": "patch", "load": False, "p": sine_b(rt)}], 1.2, rack=False)
        s_ = np.abs(np.diff(L)) + np.abs(np.diff(R)); steady, worstst = float(np.max(s_[int(1.0 * SR):])), float(np.max(s_))
        ck(f"Fb. no click when the route goes from off to {rt} under a held note (worst step {worstst:.5f}, steady {steady:.5f})", worstst <= 2.0 * steady + 1e-4, (worstst, steady))
    # the schema: defaults, ranges, enums; old patches load with B off; no factory patch uses B yet
    nz = pg.evaluate("""() => { const N = __synth.eq.normalize, d = N({}).filtB;
      return { d: [d.route, d.model, d.cutoff, d.res, d.keytrack, d.env, d.morph, d.bal].join(','),
               lpg: N({ filtB: { model: 'lpg' } }).filtB.model, bad: N({ filtB: { route: 'sideways' } }).filtB.route, sp: N({ filtB: { route: 'split' } }).filtB.route,
               lo: [N({ filtB: { cutoff: 1, res: -1, bal: -5, morph: -1 } }).filtB].map(b => [b.cutoff, b.res, b.bal, b.morph].join(','))[0],
               hi: [N({ filtB: { cutoff: 1e6, res: 5, bal: 5, morph: 9 } }).filtB].map(b => [b.cutoff, b.res, b.bal, b.morph].join(','))[0],
               fac: __synth.factory().map(f => __synth.factoryPatch(f.name)).filter(p => p.filtB.route !== 'off').map(p => p.name) }; }""")
    ck(f"Fb. filtB defaults to off (SVF 12, 2 kHz, flat, key tracking 50%); only the four routes and the six models other than the low pass gate load; ranges clamp; no factory patch turns it on ({nz})",
       nz == {"d": "off,svf12,2000,0,0.5,0,0,0", "lpg": "svf12", "bad": "off", "sp": "split", "lo": "20,0,-1,0", "hi": "20000,1,1,3", "fac": []}, nz)

    # ---------------------------------------------------------------- Fp. the filter response plot (28 Oct)
    # The plot comes from the worklet's own filter code run in a worker (filtplot.js), so these check it
    # against the voice as the engine plays it: quiet sine tones through each model, measured against the
    # same filter wide open, and the plot's curve read the same way. Then the routes, a singing filter,
    # the live curve under a note, the throttle, and the canvas.
    pg.evaluate("document.getElementById('mFilt').scrollIntoView()")
    try: pg.wait_for_function("__synth.filterPlot().ready && __synth.filterPlot().knob", timeout=15000); fp_ok = True
    except Exception as e_: fp_ok = False
    ck("Fp. the response plot's lab loads (the worklet's filter code, in a worker) and draws a first curve", fp_ok, pg.evaluate("__synth.filterPlot()"))
    def fp_of(p_, cutA, cutB=None, fq=(250, 1000, 4000), sr=SR):
        # at the renders' rate (48 kHz) unless asked; the page's own plot follows the live context's rate
        return pg.evaluate("a => __synth.filterRespOf(a.p, a.a, a.b, a.f, a.sr)", {"p": p_, "a": cutA, "b": cutB, "f": list(fq), "sr": sr})
    def two_tone(m_, cut, res, extra=None):
        # 250 Hz and 4 kHz in one render (osc 1 and osc 2), 1 kHz in another; quiet (0.02), so every model stays
        # linear and one tone barely moves the other (at 0.05 the 250 Hz tone took 0.4 dB off 4 kHz in Diode 18)
        fl = dict({"model": m_, "cutoff": cut, "res": res}, **(extra or {}))
        L1, _ = render(patch(osc1={"wave": "sine", "level": 0.02, "fixed": 250}, osc2={"wave": "sine", "level": 0.02, "fixed": 4000}, filt=fl), note(60, v=0.79), 1.0, rack=False)
        L2, _ = render(patch(osc1={"wave": "sine", "level": 0.02, "fixed": 1000}, filt=fl), note(60, v=0.79), 1.0, rack=False)
        return {250: tone_amp(L1[SR // 2:], 250), 1000: tone_amp(L2[SR // 2:], 1000), 4000: tone_amp(L1[SR // 2:], 4000)}
    fp_err = {}
    for m_ in ("valve12", "ladder24", "diode18", "sk12", "poly24", "svf12", "lpg"):
        op_ = two_tone(m_, 20000, 0); po_ = fp_of(patch(filt={"model": m_, "cutoff": 20000, "res": 0}), 20000)["a"]
        for res in (0, 0.6):
            ms_ = two_tone(m_, 1000, res); pp_ = fp_of(patch(filt={"model": m_, "cutoff": 1000, "res": res}), 1000)["a"]
            e_ = []
            for i, f in enumerate((250, 1000, 4000)):
                meas = db(ms_[f] / op_[f]); plot = pp_[i] - po_[i]
                if meas > -40: e_.append(round(plot - meas, 2))
            fp_err[f"{m_}/{res}"] = e_
    worst = max(abs(x) for v in fp_err.values() for x in v)
    ck(f"Fp. the plot matches the voice on every model at resonance 0 and 0.6, 1 kHz cutoff, at 250 Hz, 1 kHz and 4 kHz within 0.2 dB where above -40 (worst {worst:.2f} dB)", worst <= 0.2, fp_err)
    info("Fp. plot minus measured, dB, at 250 / 1k / 4k", fp_err)
    # the routes, against the Fb. renders above (serial and parallel, relative to SVF 12 wide open)
    po_ = fp_of(patch(filt={"model": "svf12", "cutoff": 20000}), 20000, fq=FQS)["a"]
    ps_ = fp_of(patch(filt={"model": "svf12", "cutoff": 1000}, filtB={"route": "serial", "model": "svf12", "morph": 2, "cutoff": 1000, "keytrack": 0}), 1000, 1000, fq=FQS)
    pq_ = fp_of(patch(filt={"model": "svf12", "cutoff": 300}, filtB={"route": "parallel", "model": "svf12", "morph": 2, "cutoff": 3000, "keytrack": 0}), 300, 3000, fq=FQS)
    re_ = {"serial": [round(ps_["sum"][i] - po_[i] - sr_[f], 2) for i, f in enumerate(FQS) if sr_[f] > -40],
           "parallel": [round(pq_["sum"][i] - po_[i] - pr_[f], 2) for i, f in enumerate(FQS) if pr_[f] > -40]}
    ck(f"Fp. serial and parallel curves match the voice from 100 Hz to 4 kHz within 0.2 dB ({re_})", ps_["route"] == 1 and pq_["route"] == 2 and max(abs(x) for v in re_.values() for x in v) <= 0.2, (re_, ps_, pq_))
    pa_ = fp_of(patch(filt={"model": "ladder24", "cutoff": 500}), 500, fq=(250, 2000))
    pb_ = fp_of(patch(filt={"model": "svf12", "cutoff": 4000}), 4000, fq=(250, 2000))
    pt_ = fp_of(patch(filt={"model": "ladder24", "cutoff": 500}, filtB={"route": "split", "model": "svf12", "cutoff": 4000, "keytrack": 0}), 500, 4000, fq=(250, 2000))
    ck("Fp. split draws A (left) and B (right) apart: each is the same filter alone, within 0.01 dB",
       pt_["route"] == 3 and max(abs(x - y) for x, y in zip(pt_["a"] + pt_["b"], pa_["a"] + pb_["a"])) <= 0.01, (pt_, pa_, pb_))
    # singing: past the threshold the response does not decay, and its peak sits on the knob
    sg_ = fp_of(patch(filt={"model": "ladder24", "cutoff": 262, "res": 1}), 262, fq=(262,))
    nr_ = fp_of(patch(filt={"model": "ladder24", "cutoff": 262, "res": 0.85}), 262, fq=(262,))
    ck(f"Fp. Ladder 24 at full resonance sings on the plot (peak at {sg_['peak']['f']:.0f} Hz, within 4% of 262, off the top); at 0.85 it rings down (peak {nr_['peak']['db']:+.1f} dB)",
       sg_["ringA"] and abs(sg_["peak"]["f"] / 262 - 1) <= 0.04 and sg_["peak"]["db"] > 24 and not nr_["ringA"] and 6 < nr_["peak"]["db"] < 40, (sg_, nr_))
    # the page: the knob curve follows a patch change, then a note draws the live curve at its own cutoff
    pg.evaluate("p => __synth.setPatch(p)", patch(filt={"model": "ladder24", "cutoff": 300, "res": 0.3, "keytrack": 1, "env": 0, "vel": 0}))
    # (the readout is written by the 30 fps frame loop, a frame or two after the knob curve lands: wait for both)
    try: pg.wait_for_function("(() => { const f = __synth.filterPlot(), k = f.knob; return k && k.cutA === 300 && f.read.includes('300Hz'); })()", timeout=3000); k_ok = True
    except Exception as e_: k_ok = False
    fpk = pg.evaluate("__synth.filterPlot()")
    ck("Fp. a patch change redraws the knob curve (Ladder 24 at 300 Hz) and the readout says so", k_ok and "300Hz" in fpk["read"] and fpk["read"].startswith("knobs at middle C"), fpk)
    pg.evaluate("__synth.noteOn(72, 0.8)")
    try: pg.wait_for_function("(() => { const f = __synth.filterPlot(); return f.live && f.playing && Math.abs(f.playing.cutA / 600 - 1) < 0.01; })()", timeout=3000); l_ok = True
    except Exception as e_: l_ok = False
    fpl = pg.evaluate("__synth.filterPlot()")
    lv_ = pg.evaluate("__synth.filterPlotAt([150, 600, 2400], 'live')"); lc_ = (fpl["playing"] or {}).get("cutA", 0)
    ref_l = fp_of(pg.evaluate("__synth.patch()"), lc_ or 600, fq=(150, 600, 2400), sr=None)["a"]
    ck(f"Fp. a note an octave up (key tracking 1) draws the live curve at 600 Hz within 1% ({lc_:.1f}), the lab's curve at that cutoff, and the readout says playing",
       l_ok and lv_ is not None and max(abs(x - y) for x, y in zip(lv_, ref_l)) <= 0.05 and fpl["read"].startswith("playing"), (fpl, lv_, ref_l))
    pg.evaluate("__synth.noteOff(72)")
    try: pg.wait_for_function("!__synth.filterPlot().live && __synth.filterPlot().read.startsWith('knobs')", timeout=3000); r_ok = True
    except Exception as e_: r_ok = False
    ck("Fp. after the note ends the plot goes back to the knob curve", r_ok, pg.evaluate("__synth.filterPlot()"))
    # review R1028-1: two low-passes in parallel sum to a flat +3 dB passband, and the readout called
    # that a "peak at 20Hz". A peak has to stand above the ends of the plot; the passband gain is named as such.
    pg.evaluate("p => __synth.setPatch(p)", patch(filt={"model": "svf12", "cutoff": 2300, "res": 0, "keytrack": 0}, filtB={"route": "parallel", "model": "svf12", "cutoff": 2000, "res": 0, "keytrack": 0}))
    try: pg.wait_for_function("(() => { const k = __synth.filterPlot().knob; return k && k.cutA === 2300 && k.route === 2 && __synth.filterPlot().read.includes('B 2kHz'); })()", timeout=3000); pp_ok = True
    except Exception as e_: pp_ok = False
    rp_ = pg.evaluate("__synth.filterPlot().read")
    pg.evaluate("p => __synth.setPatch(p)", patch(filt={"model": "ladder24", "cutoff": 1000, "res": 0.8, "keytrack": 0}))
    try: pg.wait_for_function("(() => { const k = __synth.filterPlot().knob; return k && k.cutA === 1000 && !k.route && __synth.filterPlot().read.includes('A 1kHz'); })()", timeout=3000); pr_ok = True
    except Exception as e_: pr_ok = False
    rr_ = pg.evaluate("__synth.filterPlot().read")
    ck(f"Fp. the readout names a flat parallel sum as passband gain, not a peak at 20 Hz ('{rp_}'), and still names a resonant peak ('{rr_}')",
       pp_ok and pr_ok and "peak" not in rp_ and "passband +3" in rp_ and "peak +" in rr_ and "at 20Hz" not in rr_, (rp_, rr_))
    # the envelope sweeps the live cutoff; the plot recomputes at most 15 times a second while it does
    pg.evaluate("p => __synth.setPatch(p)", patch(filt={"model": "svf12", "cutoff": 200, "res": 0.5, "keytrack": 0, "env": 0.8, "vel": 0}, envF={"a": 0.4, "d": 1.5, "s": 0, "r": 0.3}, envA={"a": 0.001, "d": 0.1, "s": 1, "r": 0.2, "vel": 0}))
    pg.wait_for_timeout(200)
    # (the highest live cutoff seen while the note is held: at 1 s the envelope is already back near 400 Hz)
    n0 = pg.evaluate("__synth.filterPlot().n")
    hi_ = pg.evaluate("""async () => { __synth.noteOn(60, 0.8); let hi = 0; const t0 = performance.now();
      while (performance.now() - t0 < 1000) { const p = __synth.filterPlot().playing; if (p && p.cutA > hi) hi = p.cutA; await new Promise(r => setTimeout(r, 40)); } return hi; }""")
    fpe = pg.evaluate("__synth.filterPlot()"); n1 = fpe["n"]; pg.evaluate("__synth.noteOff(60)")
    ck(f"Fp. the filter envelope moves the live curve (up to {hi_:.0f} Hz against the knob's 200) with at most 16 recomputes in a second ({n1 - n0})",
       fpe["live"] and hi_ > 1000 and 1 <= n1 - n0 <= 16, (fpe, hi_, n1 - n0))
    ck(f"Fp. the canvas is painted (mean {fpe['painted']:.1f}) and labelled", fpe["painted"] > 5 and fpe["label"].startswith("Filter response"), fpe)
    info("Fp. cost", f"compute {fpe['ms']:.2f} ms a curve (running mean), draw {fpe['drawMs']:.2f} ms a frame")
    wc_ = [fp_of(patch(filt={"model": m_, "cutoff": 60, "res": 0.85}), 60, fq=(60,))["ms"] for m_ in ("valve12", "ladder24", "poly24")]
    info("Fp. cost, a slow case (60 Hz at resonance 0.85: Valve 12, Ladder 24, Poly 24)", [round(x, 1) for x in wc_])
    pg.evaluate("p => __synth.setPatch(p)", patch())

    # ---------------------------------------------------------------- Mm. the mod matrix (29 Oct)
    # Eight slots of source, destination and amount, per voice at the control rate. Each measured check
    # sets a slot up so it must equal something the voice already does, or a known pitch, level or pan.
    import re as _rem
    _wk = open(os.path.join(ROOT, "synth", "voice.worklet.js")).read(); _pj = open(os.path.join(ROOT, "synth", "patches.js")).read()
    def _jl(src, name):
        m_ = _rem.search(r"const " + name + r" = \[([^\]]*)\]", src); return _rem.findall(r"'([^']*)'", m_.group(1)) if m_ else None
    _ws, _wd = _jl(_wk, "M_SRC"), _jl(_wk, "M_DST")
    _mdc = {k.lower(): int(v) for k, v in _rem.findall(r"MD_([A-Z0-9]+) = (\d+)", _wk)}
    ck(f"Mm. the worklet and patches.js carry the same {len(_ws or [])} sources and {len(_wd or [])} destinations, and every destination number names its own entry",
       bool(_ws) and _ws == _jl(_pj, "MOD_SRC") and _wd == _jl(_pj, "MOD_DST") and len(_mdc) == len(_wd) - 1 and all(_wd[i].lower() == k for k, i in _mdc.items()), (_ws, _wd, _mdc))
    nm_ = pg.evaluate("""async () => { const m = await import('./patches.js'); const d = m.normalize({});
      const j = m.normalize({ mod: { s1: { src: 'lfo1', dst: 'cut', amt: 5 }, s2: { src: 'bogus', dst: 'pitch', amt: -0.5 }, s9: { src: 'vel', dst: 'res', amt: 1 } } });
      return { d: d.mod, j: j.mod, v: j.v, fac: m.FACTORY.every(p => Object.values(m.normalize(p).mod).every(s => s.src === 'off' && s.dst === 'off' && s.amt === 0)) }; }""")
    off8 = all(nm_["d"].get(f"s{i}") == {"src": "off", "dst": "off", "amt": 0} for i in range(1, 9)) and len(nm_["d"]) == 8
    ck("Mm. the schema: a patch with no matrix loads with all eight slots off, every factory patch has them off (no patch sounds different), and a bad slot is clamped or dropped (schema stays v:1)",
       off8 and nm_["fac"] and nm_["v"] == 1 and nm_["j"]["s1"] == {"src": "lfo1", "dst": "cut", "amt": 1} and nm_["j"]["s2"] == {"src": "off", "dst": "pitch", "amt": -0.5} and "s9" not in nm_["j"], nm_)
    def mm(**slots): return {k: dict({"src": "off", "dst": "off", "amt": 0}, **v) for k, v in slots.items()}
    def cents(f, ref): return 1200 * math.log2(f / ref)
    sine = lambda **o: dict({"wave": "sine", "level": 0.5}, **o)
    # key -> pitch: (note - 60) / 60 x 12 semitones a unit; middle C does not move
    L, _ = render(patch(osc1=sine(), mod=mm(s1={"src": "key", "dst": "pitch", "amt": 1})), note(72), 1.0, rack=False); kp72 = cents(peak_freq(L[SR // 2:]), 523.2511 * 2 ** (2.4 / 12))
    L, _ = render(patch(osc1=sine(), mod=mm(s1={"src": "key", "dst": "pitch", "amt": 1})), note(60), 1.0, rack=False); kp60 = cents(peak_freq(L[SR // 2:]), 261.6256)
    ck(f"Mm. key to pitch at +12.0st: C5 plays 2.4 semitones up ({kp72:+.2f} cents off) and middle C stays put ({kp60:+.2f}), want within 3", abs(kp72) <= 3 and abs(kp60) <= 3, (kp72, kp60))
    # LFO 1 (square, 1 Hz, its own pitch depth 0) -> pitch at 1/12: a semitone up for half a second, then down
    L, _ = render(patch(osc1=sine(), lfo1={"wave": "square", "rate": 1, "pitch": 0}, mod=mm(s3={"src": "lfo1", "dst": "pitch", "amt": 1 / 12})), note(60), 1.0, rack=False)
    lu, ld = cents(peak_freq(L[int(0.1 * SR):int(0.4 * SR)]), 261.6256), cents(peak_freq(L[int(0.6 * SR):int(0.9 * SR)]), 261.6256)
    ck(f"Mm. LFO 1 to pitch with LFO 1's own depth at 0: a square at 1 Hz moves middle C up {lu:+.1f} and down {ld:+.1f} cents (want +100 and -100, within 3)", abs(lu - 100) <= 3 and abs(ld + 100) <= 3, (lu, ld))
    # filter envelope -> cutoff at 0.7 (3.5 octaves) is the filter envelope amount at 0.5 (also 3.5 octaves)
    def env_track(env=0, **kw):
        L, _ = render(patch(osc1=sine(fixed=2000, level=0.3), filt={"model": "ladder24", "cutoff": 250, "env": env}, envF={"a": 0.001, "d": 0.4, "s": 0, "r": 0.1}, **kw), note(60), 0.7, rack=False)
        return [db(tone_amp(L[int(t * SR):int(t * SR) + 960], 2000)) for t in (0.03, 0.1, 0.2, 0.35, 0.5)]
    e_k, e_m = env_track(0.5), env_track(mod=mm(s2={"src": "envF", "dst": "cut", "amt": 0.7}))
    ck(f"Mm. filter envelope to cutoff at +3.5oct follows the same sweep as the filter envelope knob at +50 (2 kHz through Ladder 24 at 250 Hz, dB at 30 ms to 0.5 s: {[round(x, 1) for x in e_m]} against {[round(x, 1) for x in e_k]}, want within 0.3)",
       max(abs(a_ - b_) for a_, b_ in zip(e_m, e_k)) <= 0.3 and e_k[0] - e_k[-1] > 20, (e_m, e_k))
    # key -> cutoff at 1 is key tracking at 100%, on slot A and on slot B
    def kt_amp(**kw):
        L, _ = render(patch(osc1=sine(fixed=1000, level=0.3), **kw), note(84), 0.8, rack=False); return db(tone_amp(L[SR // 3:], 1000))
    a_k, a_m = kt_amp(filt={"model": "ladder24", "cutoff": 300, "keytrack": 1}), kt_amp(filt={"model": "ladder24", "cutoff": 300, "keytrack": 0}, mod=mm(s1={"src": "key", "dst": "cut", "amt": 1}))
    b_k = kt_amp(filtB={"route": "serial", "model": "ladder24", "cutoff": 300, "keytrack": 1})
    b_m = kt_amp(filtB={"route": "serial", "model": "ladder24", "cutoff": 300, "keytrack": 0}, mod=mm(s8={"src": "key", "dst": "cutB", "amt": 1}))
    a_0 = kt_amp(filt={"model": "ladder24", "cutoff": 300, "keytrack": 0})
    ck(f"Mm. key to cutoff at +5.0oct is key tracking at 100%: a 1 kHz tone at C7 through Ladder 24 at 300 Hz, slot A {a_m:.2f} against {a_k:.2f} dB, slot B {b_m:.2f} against {b_k:.2f} (want within 0.1; with no tracking {a_0:.1f})",
       abs(a_m - a_k) <= 0.1 and abs(b_m - b_k) <= 0.1 and a_k - a_0 > 20, (a_m, a_k, b_m, b_k, a_0))
    # velocity -> resonance: a hard note takes Ladder 24 to full resonance and it sings with no input; a soft one does not
    vr = {}
    for v_ in (1.0, 0.3):
        L, _ = render(patch(osc1={"level": 0}, filt={"model": "ladder24", "cutoff": 500, "res": 0}, mod=mm(s1={"src": "vel", "dst": "res", "amt": 1})), note(60, v=v_), 1.0, rack=False)
        vr[v_] = db(float(np.sqrt(np.mean(L[SR // 2:] ** 2))))
    ck(f"Mm. velocity to resonance: velocity 1.0 makes Ladder 24 sing with no input ({vr[1.0]:.1f} dBFS, want above -30), velocity 0.3 leaves it quiet ({vr[0.3]:.1f}, want below -80)", vr[1.0] > -30 and vr[0.3] < -80, vr)
    # the mod wheel -> level at -100%: the wheel at half is -6 dB, all the way up is silent
    ev_ = [{"at": 0.0, "t": "mw", "v": 0}] + note(60) + [{"at": 0.5, "t": "mw", "v": 0.5}, {"at": 1.0, "t": "mw", "v": 1}]
    L, _ = render(patch(osc1=sine(), mw={"vib": 0, "cut": 0}, mod=mm(s4={"src": "wheel", "dst": "amp", "amt": -1})), ev_, 1.5, rack=False)
    rms_ = lambda x: float(np.sqrt(np.mean(x ** 2)))
    w1, w2, w3 = (rms_(L[int(a_ * SR):int(b_ * SR)]) for a_, b_ in ((0.25, 0.45), (0.7, 0.95), (1.2, 1.45)))
    ck(f"Mm. mod wheel to level at -100%: the wheel at half takes {db(w2 / w1):+.2f} dB (want -6.02, within 0.3), all the way up {db(w3 / w1):+.1f} dB (want below -60)", abs(db(w2 / w1) + 6.02) <= 0.3 and db(w3 / w1) < -60, (w1, w2, w3))
    # pressure -> pan at +100%: centred with no pressure, all the way right with full pressure
    ev_ = [{"at": 0.0, "t": "at", "v": 0}] + note(60) + [{"at": 0.5, "t": "at", "v": 1}]
    L, R = render(patch(osc1=sine(), at={"cut": 0, "vib": 0}, mod=mm(s5={"src": "at", "dst": "pan", "amt": 1})), ev_, 1.0, rack=False)
    c_ = db(rms_(L[int(0.2 * SR):int(0.45 * SR)]) / rms_(R[int(0.2 * SR):int(0.45 * SR)])); r_ = db(rms_(L[int(0.7 * SR):int(0.95 * SR)]) / rms_(R[int(0.7 * SR):int(0.95 * SR)]))
    ck(f"Mm. pressure to pan: no pressure leaves the note centred (left minus right {c_:+.2f} dB, want within 0.2), full pressure puts it hard right ({r_:+.1f} dB, want below -60)", abs(c_) <= 0.2 and r_ < -60, (c_, r_))
    # amp envelope -> V1 drive at +10: a held note at sustain 0.5 drives V1 like the drive knob at 5 (the make-up included)
    def drv(d0, **kw):
        L, _ = render(patch(osc1=sine(fixed=200, level=0.9), v1={"tube": "12AX7", "drive": d0, "bias": 0}, envA={"a": 0.001, "d": 0.05, "s": 0.5, "r": 0.05, "vel": 0}, **kw), note(60), 1.0, rack=False)
        x_ = L[SR // 2:]; return db(tone_amp(x_, 200)), harmonics_db(x_, 200, 4)
    dk, dm_ = drv(5), drv(0, mod=mm(s6={"src": "envA", "dst": "drive", "amt": 1}))
    d0_ = drv(0)
    ck(f"Mm. amp envelope to V1 drive at +10.0: at sustain 0.5 the fundamental is {dm_[0]:.2f} dB against {dk[0]:.2f} with the drive knob at 5 (want within 0.3), H2..H4 {[round(x, 1) for x in dm_[1]]} against {[round(x, 1) for x in dk[1]]} (within 1 dB; no drive gives H3 {d0_[1][1]:.1f})",
       abs(dm_[0] - dk[0]) <= 0.3 and max(abs(a_ - b_) for a_, b_ in zip(dm_[1], dk[1])) <= 1 and dk[1][1] - d0_[1][1] > 6, (dm_, dk, d0_))
    # amp envelope -> osc 2 level with osc 2's knob at 0: osc 2 wakes up (it is skipped while nothing listens)
    def o2(**kw):
        L, _ = render(patch(osc1=sine(fixed=500, level=0.5), osc2={"wave": "sine", "level": 0, "fixed": 3000}, **kw), note(60), 0.8, rack=False)
        x_ = L[SR // 3:]; return db(tone_amp(x_, 3000) / tone_amp(x_, 500))
    o2m, o2n = o2(mod=mm(s2={"src": "envA", "dst": "lvl2", "amt": 1})), o2()
    ck(f"Mm. amp envelope to osc 2 level at +100% with the osc 2 knob at 0: osc 2 plays at full level ({o2m:+.1f} dB against osc 1 at half, want +6.0 within 0.5); without the slot it is silent ({o2n:.0f} dB)", abs(o2m - 6.02) <= 0.5 and o2n < -90, (o2m, o2n))
    # random -> pitch at 0.5 (+/-6 semitones): a new value on every note, steady through the note
    evr = [e for i in range(8) for e in note(60, i * 0.3, i * 0.3 + 0.25)]
    def rnd_notes(**kw):
        L, _ = render(patch(osc1=sine(), envA={"a": 0.001, "d": 0.1, "s": 1, "r": 0.02, "vel": 0}, **kw), evr, 2.5, rack=False); out = []
        for i in range(8):
            a_ = int((i * 0.3 + 0.04) * SR); m_ = int((i * 0.3 + 0.14) * SR); z_ = int((i * 0.3 + 0.24) * SR)
            out.append((cents(peak_freq(L[a_:m_]), 261.6256), cents(peak_freq(L[m_:z_]), 261.6256)))
        return out
    rn_, r0_ = rnd_notes(mod=mm(s7={"src": "rand", "dst": "pitch", "amt": 0.5})), rnd_notes()
    sp_ = max(a_ for a_, _ in rn_) - min(a_ for a_, _ in rn_)
    ck(f"Mm. random to pitch at +6.0st: eight notes of middle C land on eight pitches (spread {sp_:.0f} cents, want 200 or more, each within 600: {[round(a_) for a_, _ in rn_]}), each steady through its note (halves within 3 cents), and without the slot all sit on C (within 3)",
       sp_ >= 200 and all(abs(a_) <= 603 and abs(a_ - b_) <= 3 for a_, b_ in rn_) and all(abs(a_) <= 3 for a_, _ in r0_), (rn_, r0_))
    # the section on the page
    pg.evaluate("__synth.setDevice('filament')"); pg.evaluate("p => __synth.setPatch(p)", patch()); pg.wait_for_timeout(200)
    ui0 = pg.evaluate("""() => ({ rows: document.querySelectorAll('#mmx .mmrow').length, sel: document.querySelectorAll('#mmx select').length, kn: document.querySelectorAll('#mmx .knob').length,
      off: document.querySelectorAll('#mmx .mmrow.off').length, pilot: document.getElementById('matrixPilot').classList.contains('off'), count: document.getElementById('mmCount').textContent,
      vis: !!document.getElementById('mMatrix').offsetParent })""")
    ck(f"Mm. the Mod matrix section shows eight slots, each a source menu, a destination menu and an amount knob, all off with the pilot dark ({ui0})",
       ui0 == {"rows": 8, "sel": 16, "kn": 8, "off": 8, "pilot": True, "count": "all off", "vis": True}, ui0)
    pg.select_option('#mmx .mmrow[data-slot="s1"] .mms', "lfo1"); pg.select_option('#mmx .mmrow[data-slot="s1"] .mmd', "pitch")
    kk_ = pg.locator("#kMod1 .knob"); kk_.focus()
    for _ in range(10): kk_.press("ArrowUp")
    pg.wait_for_timeout(150)
    ui1 = pg.evaluate("""() => ({ s1: __synth.patch().mod.s1, kv: document.querySelector('#kMod1 .kv').textContent, pilot: document.getElementById('matrixPilot').classList.contains('off'),
      count: document.getElementById('mmCount').textContent, off: document.querySelector('#mmx .mmrow[data-slot="s1"]').classList.contains('off') })""")
    ck(f"Mm. picking LFO 1 to Pitch and turning the amount up ten steps writes the slot, the knob reads semitones and the pilot lights ({ui1})",
       ui1["s1"] == {"src": "lfo1", "dst": "pitch", "amt": 0.1} and ui1["kv"] == "+1.2st" and not ui1["pilot"] and ui1["count"] == "1 of 8 on" and not ui1["off"], ui1)
    L = dec(pg.evaluate("__synth.render({ events: [{ at: 0, t: 'on', n: 60, v: 0.8 }], seconds: 1.0, rack: false })"))[0]
    fr_ = [cents(peak_freq(L[int(t * SR):int(t * SR) + 1200]), 261.6256) for t in np.arange(0.1, 0.9, 0.02)]
    ck(f"Mm. the page's slot reaches the sound: LFO 1 (sine, 5 Hz) at +1.2st swings middle C over {max(fr_) - min(fr_):.0f} cents in 25 ms windows (want 190 to 250; the full swing is 240)", 190 <= max(fr_) - min(fr_) <= 250, [round(x) for x in fr_])
    pg.reload(); pg.wait_for_function("window.__synth && __synth.ready()", timeout=20000); pg.wait_for_timeout(250)
    ui2 = pg.evaluate("""() => ({ s1: __synth.patch().mod.s1, src: document.querySelector('#mmx .mmrow[data-slot="s1"] .mms').value, dst: document.querySelector('#mmx .mmrow[data-slot="s1"] .mmd').value,
      kv: document.querySelector('#kMod1 .kv').textContent })""")
    ck(f"Mm. a reload keeps the slot and the panel shows it ({ui2})", ui2 == {"s1": {"src": "lfo1", "dst": "pitch", "amt": 0.1}, "src": "lfo1", "dst": "pitch", "kv": "+1.2st"}, ui2)
    pg.select_option('#mmx .mmrow[data-slot="s1"] .mmd', "cut"); pg.wait_for_timeout(100)
    kvc = pg.evaluate("document.querySelector('#kMod1 .kv').textContent")
    pg.select_option('#mmx .mmrow[data-slot="s1"] .mmd', "off"); pg.wait_for_timeout(100)
    ui3 = pg.evaluate("""() => ({ off: document.querySelector('#mmx .mmrow[data-slot="s1"]').classList.contains('off'), pilot: document.getElementById('matrixPilot').classList.contains('off') })""")
    ck(f"Mm. the amount's units follow the destination ('{kvc}' on cutoff) and a destination of off darkens the slot and the pilot", kvc == "+0.5oct" and ui3 == {"off": True, "pilot": True}, (kvc, ui3))
    pg.evaluate("p => __synth.setPatch(p)", patch()); pg.wait_for_timeout(100)
    ck("Mm. no page errors", not errs, errs)

    # ---------------------------------------------------------------- Ls. LFO tempo sync (30 Oct)
    # lfo1.sync / lfo2.sync: off, or the note value one cycle lasts at the rack tempo. A square LFO on full
    # tremolo gates a 1 kHz sine, so each half cycle is an on or off stretch whose edges can be timed.
    _sb_w = dict(_rem.findall(r"'([0-9/a-z]+)': ([0-9./ ]+?)(?=\s*,|\s*$)", _rem.search(r"const SYNC_BEATS = \{([^}]*)\}", _wk).group(1)))
    _sb_p = dict(_rem.findall(r"'([0-9/a-z]+)': ([0-9./ ]+?)(?=\s*,|\s*$)", _rem.search(r"const LFO_SYNC_BEATS = \{([^}]*)\}", _pj).group(1)))
    _sb_v = {k: eval(v) for k, v in _sb_w.items()}
    ck(f"Ls. the worklet and patches.js carry the same {len(_sb_w)} sync note values with the same lengths in beats (4/1 is 16 beats, 1/4 is 1, 1/8tr is 1/3)",
       len(_sb_w) == 16 and _sb_w == _sb_p and _sb_v["4/1"] == 16 and _sb_v["1/4"] == 1 and abs(_sb_v["1/8tr"] - 1 / 3) < 1e-12 and _sb_v["1/4d"] == 1.5, (_sb_w, _sb_p))
    ns_ = pg.evaluate("""async () => { const m = await import('./patches.js'); const d = m.normalize({}), j = m.normalize({ lfo1: { sync: '1/8d' }, lfo2: { sync: '3/7' } });
      return { d: [d.lfo1.sync, d.lfo2.sync], j: [j.lfo1.sync, j.lfo2.sync], v: j.v, list: m.LFO_SYNC, fac: m.FACTORY.every(p => { const q = m.normalize(p); return q.lfo1.sync === 'off' && q.lfo2.sync === 'off'; }) }; }""")
    ck("Ls. the schema: a patch with no sync loads with both LFOs off (free), every factory patch is free (no patch sounds different), an unknown value falls back to off (schema stays v:1)",
       ns_["d"] == ["off", "off"] and ns_["j"] == ["1/8d", "off"] and ns_["v"] == 1 and ns_["fac"] and ns_["list"][0] == "off" and len(ns_["list"]) == 17, ns_)
    def lfo_edges(lfo1=None, lfo2=None, events=None, seconds=2.0, tempo=120, n=69):
        p_ = patch(osc1={"wave": "sine", "level": 0.5, "fixed": 1000}, lfo1=lfo1 or {"amp": 0}, lfo2=lfo2 or {"amp": 0})
        ev_ = events if events is not None else note(n)
        L_, _ = dec(pg.evaluate("a => __synth.render(a)", {"patch": p_, "events": ev_, "seconds": seconds, "rack": False, "tempo": tempo, "masterFx": False}))
        w_ = int(SR * 0.0005); env_ = np.abs(L_[:len(L_) // w_ * w_]).reshape(-1, w_).max(axis=1)
        hi_ = env_ > env_.max() * 0.5
        return [round((i + 1) * 0.0005, 4) for i in np.where(np.diff(hi_.astype(int)) != 0)[0]]
    def spacing(e_): return float(np.mean(np.diff(e_))) if len(e_) > 2 else 0.0
    sq_ = lambda **o: dict({"wave": "square", "rate": 5, "amp": 1}, **o)
    e120, e90 = lfo_edges(sq_(sync="1/4")), lfo_edges(sq_(sync="1/4"), tempo=90)
    e2_ = lfo_edges(lfo2=sq_(sync="1/8d"), tempo=100)
    ck(f"Ls. synced, the rate knob (5 Hz) is ignored and a cycle is the note value at the rack tempo: 1/4 at 120 BPM flips every {spacing(e120) * 1000:.1f} ms (want 250), at 90 BPM {spacing(e90) * 1000:.1f} ms (want 333.3); LFO 2 at a dotted 1/8 at 100 BPM {spacing(e2_) * 1000:.1f} ms (want 225); each within 1 ms",
       abs(spacing(e120) - 0.25) < 0.001 and abs(spacing(e90) - 0.25 * 4 / 3) < 0.001 and abs(spacing(e2_) - 0.225) < 0.001 and len(e120) >= 6, (e120, e90, e2_))
    ef_ = lfo_edges(sq_(rate=2))
    ck(f"Ls. sync off still runs at the rate knob: 2 Hz flips every {spacing(ef_) * 1000:.1f} ms (want 250, within 1)", abs(spacing(ef_) - 0.25) < 0.001, ef_)
    # the transport starts at 0.37 s: a global synced LFO jumps to the transport's phase there
    eL0 = lfo_edges(sq_(sync="1/4"), events=note(69) + [{"at": 0.37, "t": "clock", "playing": True, "beat": 0, "tempo": 120}])
    eL5 = lfo_edges(sq_(sync="1/4"), events=note(69) + [{"at": 0.37, "t": "clock", "playing": True, "beat": 2.5, "tempo": 120}])
    aft0, aft5 = [round(x - 0.37, 4) for x in eL0 if x > 0.36][:3], [round(x - 0.37, 4) for x in eL5 if x > 0.36][:3]
    ck(f"Ls. a global synced LFO locks to the transport: started at beat 0 at 0.37 s it turns on there and flips {aft0} s later (want 0, 0.25, 0.5); started at beat 2.5 (half a cycle in) it stays off and flips at {aft5} (want 0.25, 0.5, 0.75); within 2 ms",
       len(aft0) == 3 and len(aft5) == 3 and all(abs(a_ - b_) < 0.002 for a_, b_ in zip(aft0, (0, 0.25, 0.5))) and all(abs(a_ - b_) < 0.002 for a_, b_ in zip(aft5, (0.25, 0.5, 0.75))), (eL0, eL5))
    # a tempo change while playing (120 to 60 BPM at beat 2): the phase carries on, the half cycle doubles
    eT_ = lfo_edges(sq_(sync="1/4"), seconds=2.6, events=note(69) + [{"at": 0, "t": "clock", "playing": True, "beat": 0, "tempo": 120}, {"at": 1.0, "t": "clock", "playing": True, "beat": 2, "tempo": 60}])
    pre_, post_ = [x for x in eT_ if x < 0.99], [x for x in eT_ if x > 0.99]
    ck(f"Ls. a tempo change while playing keeps the phase: 120 BPM flips every {spacing(pre_) * 1000:.0f} ms, then from beat 2 at 1.0 s at 60 BPM at {[round(x, 3) for x in post_]} (want 1.0, 1.5, 2.0, 2.5, within 2 ms)",
       abs(spacing(pre_) - 0.25) < 0.001 and len(post_) == 4 and all(abs(a_ - b_) < 0.002 for a_, b_ in zip(post_, (1.0, 1.5, 2.0, 2.5))), eT_)
    # per voice: restarts at the note, even while the transport plays
    eV_ = lfo_edges(sq_(sync="1/4", mode="voice"), events=[{"at": 0, "t": "clock", "playing": True, "beat": 0.3, "tempo": 120}, {"at": 0.13, "t": "on", "n": 69, "v": 0.8}])
    ck(f"Ls. a per-voice synced LFO restarts at its note (0.13 s), not at the bar: edges at {[round(x, 3) for x in eV_[:3]]} (want 0.13, 0.38, 0.63, within 2 ms)",
       len(eV_) >= 3 and all(abs(a_ - b_) < 0.002 for a_, b_ in zip(eV_[:3], (0.13, 0.38, 0.63))), eV_)
    # the page: the menu writes the patch, the readout follows the rack tempo, the transport reaches the worklet
    ui_ = pg.evaluate("""() => { const s = document.getElementById('lfo1Sync'); return { n: s.options.length, v: s.value, hz: document.getElementById('lfo1Hz').textContent,
      vis: !!s.offsetParent, lab: s.getAttribute('aria-label') }; }""")
    ck(f"Ls. each LFO section has a sync menu (17 choices, off first) reading free ({ui_})", ui_ == {"n": 17, "v": "off", "hz": "free", "vis": True, "lab": "LFO 1 tempo sync"}, ui_)
    pg.select_option("#lfo1Sync", "1/8"); pg.evaluate("__synth.transport().setTempo(90)"); pg.wait_for_timeout(150)
    ui1_ = pg.evaluate("""() => ({ sync: __synth.patch().lfo1.sync, hz: document.getElementById('lfo1Hz').textContent, dim: document.querySelector('#kLfo [data-path="lfo1.rate"]').style.opacity,
      on: document.getElementById('lfo1Sync').parentNode.classList.contains('on') })""")
    ck(f"Ls. picking 1/8 writes the patch, dims the rate knob and reads 3.00 Hz at 90 BPM ({ui1_})", ui1_ == {"sync": "1/8", "hz": "3.00 Hz at 90 BPM", "dim": "0.45", "on": True}, ui1_)
    clk_ = pg.evaluate("""async () => { const T = __synth.transport(), E = __synth.engine(); T.locate(0); T.play();
      await new Promise(r => setTimeout(r, 700)); const m = E.meters.filament, s = T.state();
      const out = { tempo: m.clk.tempo, playing: m.clk.playing, beat: m.clk.beat, lfo: m.lfo[0], tb: s.beat, frame: m.clk.frame, now: Math.round(E.ctx.currentTime * E.ctx.sampleRate), sr: E.ctx.sampleRate };
      T.stop(); await new Promise(r => setTimeout(r, 150)); out.stopped = E.meters.filament.clk.playing;
      T.locate(3); await new Promise(r => setTimeout(r, 150)); out.located = E.meters.filament.clk.beat; T.stop(); T.setTempo(120); return out; }""")
    # the transport's beat at the worklet's meter frame, from the main thread's clock
    tb_at = clk_["tb"] - (clk_["now"] - clk_["frame"]) / clk_["sr"] * 90 / 60
    ck(f"Ls. the rack transport reaches the worklet: playing at 90 BPM, its beat {clk_['beat']:.4f} matches the transport's {tb_at:.4f} at that frame (within 0.01), LFO 1's phase {clk_['lfo']:.5f} is the beat in eighths ({(clk_['beat'] / 0.5) % 1:.5f}, within 1e-6); stop and locate reach it too",
       clk_["tempo"] == 90 and clk_["playing"] and clk_["beat"] > 0.2 and abs(clk_["beat"] - tb_at) < 0.01 and min(abs(clk_["lfo"] - (clk_["beat"] / 0.5) % 1), 1 - abs(clk_["lfo"] - (clk_["beat"] / 0.5) % 1)) < 1e-6
       and clk_["stopped"] is False and abs(clk_["located"] - 3) < 1e-9, clk_)
    pg.reload(); pg.wait_for_function("window.__synth && __synth.ready()", timeout=20000); pg.wait_for_timeout(250)
    ui2_ = pg.evaluate("() => ({ sync: __synth.patch().lfo1.sync, v: document.getElementById('lfo1Sync').value, hz: document.getElementById('lfo1Hz').textContent })")
    ck(f"Ls. a reload keeps the sync and the menu shows it ({ui2_})", ui2_["sync"] == "1/8" and ui2_["v"] == "1/8" and ui2_["hz"].endswith("BPM"), ui2_)
    pg.select_option("#lfo1Sync", "off"); pg.wait_for_timeout(100)
    ui3_ = pg.evaluate("() => ({ sync: __synth.patch().lfo1.sync, hz: document.getElementById('lfo1Hz').textContent, dim: document.querySelector('#kLfo [data-path=\"lfo1.rate\"]').style.opacity })")
    ck(f"Ls. back to off: free, and the rate knob is lit again ({ui3_})", ui3_ == {"sync": "off", "hz": "free", "dim": ""}, ui3_)
    pg.evaluate("p => __synth.setPatch(p)", patch()); pg.wait_for_timeout(100)
    ck("Ls. no page errors", not errs, errs)

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
    # Each voice starts its oscillators at a random phase (on purpose), so one render of this saw chord
    # swings about 1.5 dB from the next. The level comparison averages three renders a side; a single
    # pair drifted past the 2.5 dB bound on 20 Oct with no code change (-2.51 dB).
    def pw_(L, R): return (np.mean(L[seg] ** 2) + np.mean(R[seg] ** 2)) / 2
    padp["ens"] = {"on": False}; L0, R0 = render(padp, chord, 3.0)
    st0 = math.sqrt((pw_(L0, R0) + sum(pw_(*render(padp, chord, 3.0)) for _ in range(2))) / 3)
    ck("S. ensemble off: a centred patch stays identical left and right", float(np.max(np.abs(L0 - R0))) < 1e-6, float(np.max(np.abs(L0 - R0))))
    for mode in ("I", "II", "I+II", "strings"):
        padp["ens"] = {"on": True, "mode": mode, "mix": 60}; L, R = render(padp, chord, 3.0)
        st = math.sqrt((np.mean(L[seg] ** 2) + np.mean(R[seg] ** 2)) / 2); mo = math.sqrt(np.mean(((L[seg] + R[seg]) / 2) ** 2)); c = corr(L[seg], R[seg])
        stv = math.sqrt((pw_(L, R) + sum(pw_(*render(padp, chord, 3.0)) for _ in range(2))) / 3)
        ck(f"S. ensemble {mode}: stereo (corr {c:.2f}), mono fold loses {db(st) - db(mo):.1f} dB, level {db(stv) - db(st0):+.1f} dB (3 renders a side)",
           c < 0.97 and db(st) - db(mo) <= 3 and abs(db(stv) - db(st0)) < 2.5, (c, db(st) - db(mo), db(stv) - db(st0)))
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
    # Cathode's CPU line is logged with the rest of test 9, in its own page (see 9. below)
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
    # Each call is bracketed: [before, after]. The recorder stamps the call somewhere inside that
    # window, so a slow call (a GC pause or a busy core) widens the window instead of counting as
    # recorder error (25 Oct: one run read 10.4 ms when only the first call was slow).
    tt = pg.evaluate("""async () => { const t = [], w = ms => new Promise(r => setTimeout(r, ms)), now = () => performance.now() / 1000;
      const c = f => { const b = now(); f(); t.push([b, now()]); };
      await w(120);
      c(() => __synth.noteOn(60, 0.8)); await w(200); c(() => __synth.noteOn(64, 0.5)); await w(200);
      c(() => __synth.noteOff(60)); c(() => __synth.noteOff(64)); await w(80);
      __synth.setDevice('cathode'); await w(60); c(() => __synth.noteOn(36, 1.0)); await w(150); c(() => __synth.noteOff(36));
      await w(50); __synth.deck().stopRec(); __synth.setDevice('filament'); return t; }""")
    tk = pg.evaluate("__synth.deck().take()")
    ne = [e for e in tk["events"] if e["t"] in ("on", "off")]
    sig = [(e["t"], e["n"], e["dev"]) for e in ne]
    ck("M. recorder: the first note starts the take; notes, offs and devices captured in order",
       sig == [("on", 60, "filament"), ("on", 64, "filament"), ("off", 60, "filament"), ("off", 64, "filament"), ("on", 36, "cathode"), ("off", 36, "cathode")]
       and ne[0]["time"] == 0 and not tk["rec"] and not tk["armed"], sig)
    # event i must land in [b_i - a_0, a_i - b_0]: dt is how far outside that window it falls
    dt = max(max(0.0, (t[0] - tt[0][1]) - e["time"], e["time"] - (t[1] - tt[0][0])) for e, t in zip(ne, tt))
    info("M. recorder: the slowest bracketed call took", f"{1000 * max(t[1] - t[0] for t in tt):.2f} ms")
    ck(f"M. recorder timing matches the calls within 5 ms (worst {1000 * dt:.2f} ms outside the call windows), velocities kept", dt <= 0.005 and [round(e["v"], 2) for e in ne if e["t"] == "on"] == [0.8, 0.5, 1.0], (dt,))
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
    # Measured inside the page: the wall-clock bound (under 0.7 s) failed on a loaded server on
    # 14 Oct because the evaluate calls above add their own round trips before the read.
    pa, pb, el = pg.evaluate("""async () => { const d = __synth.deck(), a = d.position(), t0 = performance.now();
      await new Promise(r => setTimeout(r, 300)); return [a, d.position(), (performance.now() - t0) / 1000]; }""")
    ck(f"M. UI: the position runs ({pa:.2f} s after play, then +{pb - pa:.2f} s in {el:.2f} s)", pa > 0.3 and abs((pb - pa) - el) < 0.1, (pa, pb, el))
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

    # Review 17 Oct: Render WAV went through no master bus, so a reverb you could hear was missing
    # from the file. The deck now hands the master state to the offline render.
    pg.evaluate("a => __synth.deck().importBytes(a, 'melody.mid')", MEL)
    pg.evaluate("__synth.setMaster({delay:{on:false}, reverb:{on:false}, comp:{on:false}})")
    a_dry = pg.evaluate("__synth.deck().renderArgs('file')")
    pg.evaluate("__synth.setMaster({reverb:{on:true, size:0.9, mix:0.6}})")
    a_wet = pg.evaluate("__synth.deck().renderArgs('file')")
    pg.evaluate("__synth.setMaster({reverb:{on:false}})")
    for a_ in (a_dry, a_wet): a_["patches"] = {"filament": sine, "cathode": tri}; a_["seconds"] = 3.0
    Ld, _ = dec(pg.evaluate("a => __synth.render2(a)", a_dry)); Lw, _ = dec(pg.evaluate("a => __synth.render2(a)", a_wet))
    gap = slice(int(0.9 * SR), int(2.4 * SR))     # between the A4 (ends at 0.75 s) and the E5 (starts at 3 s)
    td, tw = float(np.sqrt(np.mean(Ld[gap] ** 2))), float(np.sqrt(np.mean(Lw[gap] ** 2)))
    ck(f"M. Render WAV carries the master bus: reverb on fills the gap after a note ({db(tw):.1f} dBFS against {db(td):.1f} dBFS dry)",
       (a_wet.get("master") or {}).get("reverb", {}).get("on") is True and tw > 10 * max(td, 1e-5), (a_wet.get("master"), td, tw))

    # Review 17 Oct: the recorder only knows Filament and Cathode, and its rec() threw on every note,
    # wheel and pedal from any other device (and, armed, before the key could light).
    n_err = len(errs)
    pg.evaluate("__synth.setDevice('thyratron')"); pg.wait_for_timeout(200)
    pg.evaluate("__synth.deck().arm()")
    thrown = pg.evaluate("""() => { const out = [];
      const tryIt = f => { try { f(); } catch (e) { out.push(String(e.message || e)); } };
      tryIt(() => __synth.midi([0xE0, 0, 96])); tryIt(() => __synth.midi([0xB0, 1, 90])); tryIt(() => __synth.midi([0xB0, 64, 127]));
      tryIt(() => __synth.midi([0xB0, 64, 0])); tryIt(() => __synth.midi([0xE0, 0, 64])); tryIt(() => __synth.noteOn(62, 0.8));
      return out; }""")
    pg.wait_for_timeout(100)
    lit62 = pg.evaluate("!!document.querySelector('#keys .key.down[data-n=\"62\"]')")
    tk_ = pg.evaluate("__synth.deck().take()"); stat_ = pg.inner_text("#takeStat")
    pg.evaluate("__synth.noteOff(62)"); pg.evaluate("__synth.deck().stopRec()"); pg.evaluate("__synth.setDevice('filament')"); pg.wait_for_timeout(100)
    ck("M. recorder on a device it cannot record (Thyratron): wheels, pedal and an armed note throw nothing, the key lights, nothing is recorded and the deck says why",
       not thrown and len(errs) == n_err and lit62 and tk_["armed"] and not tk_["rec"] and not any(e["dev"] == "thyratron" for e in tk_["events"])
       and "Filament and Cathode" in stat_, (thrown, errs[n_err:], lit62, tk_, stat_))
    # Review 26 Oct: Stop with the pedal still down wrote the pedal-down into the take and no pedal-up,
    # so an exported .mid left CC 64 held for whatever followed it in another program.
    pg.evaluate("__synth.setDevice('filament')"); pg.wait_for_timeout(100); pg.evaluate("__synth.deck().arm()")
    pg.evaluate("""async () => { const w = ms => new Promise(r => setTimeout(r, ms));
      __synth.midi([0xB0, 64, 127]); await w(30); __synth.noteOn(60, 0.8); await w(150); __synth.noteOff(60); await w(80);
      __synth.deck().stopRec(); __synth.midi([0xB0, 64, 0]); }""")
    tks = pg.evaluate("__synth.deck().take()")
    sus_ = [(e["time"], e["on"]) for e in tks["events"] if e["t"] == "sus"]
    xs = pg.evaluate("a => __synth.smf.read(a)", pg.evaluate("__synth.deck().exportBytes()"))
    cc64 = [e["data"][2] for p_ in xs["song"]["parts"] for e in p_["events"] if (e["data"][0] & 0xF0) == 0xB0 and e["data"][1] == 64]
    ck("M. Stop with the pedal down ends the take with a pedal-up, and the exported .mid lets go of CC 64",
       len(sus_) == 2 and sus_[0][1] is True and sus_[-1][1] is False and abs(sus_[-1][0] - tks["length"]) < 1e-6
       and cc64 and cc64[0] >= 64 and cc64[-1] < 64, (sus_, tks["length"], cc64))
    pg.evaluate("__synth.panic()")
    # Review 29 Oct: the exported .mid ended at its last event, not where Stop was pressed, so the
    # silence after the last note was lost and the file looped short of the take (measured on the
    # live site: a 1.37 s take exported as 0.62 s).
    pg.evaluate("__synth.deck().arm()")
    pg.evaluate("""async () => { const w = ms => new Promise(r => setTimeout(r, ms));
      __synth.noteOn(60, 0.8); await w(150); __synth.noteOff(60); await w(600); __synth.deck().stopRec(); }""")
    tkl = pg.evaluate("__synth.deck().take()")
    xl = pg.evaluate("a => __synth.smf.read(a)", pg.evaluate("__synth.deck().exportBytes()"))
    ck(f"M. the exported .mid keeps the take's length, silence after the last note included ({xl['song']['length']:.3f} s against the take's {tkl['length']:.3f} s, want within 5 ms)",
       tkl["length"] > 0.6 and abs(xl["song"]["length"] - tkl["length"]) < 0.005, (xl["song"]["length"], tkl["length"]))
    # Review 29 Oct: pressure held when the take starts was left out (the pedal, bend and wheel were
    # written at 0), so the take played back without it.
    pg.evaluate("__synth.midi([0xD0, 100])"); pg.evaluate("__synth.deck().arm()")
    pg.evaluate("""async () => { const w = ms => new Promise(r => setTimeout(r, ms));
      __synth.noteOn(62, 0.8); await w(120); __synth.noteOff(62); await w(50); __synth.deck().stopRec(); __synth.midi([0xD0, 0]); }""")
    ta = pg.evaluate("__synth.deck().take()")
    at0 = [round(e["v"], 3) for e in ta["events"] if e["t"] == "at" and e["time"] == 0]
    xa = pg.evaluate("a => __synth.smf.read(a)", pg.evaluate("__synth.deck().exportBytes()"))
    da = [e["data"][1] for p_ in xa["song"]["parts"] for e in p_["events"] if (e["data"][0] & 0xF0) == 0xD0]
    ck(f"M. pressure held when a take starts is written at its start, and the .mid carries it (take {at0}, file {da})",
       at0 == [round(100 / 127, 3)] and da[:1] == [100], (at0, da, ta["events"][:4]))
    pg.evaluate("__synth.panic()")
    ck("M. no page errors", not errs, errs)

    # ---------------------------------------------------------------- Q. the graphic EQ (rack-wide)
    # A quiet saw at 50 Hz through the rack with the EQ in and out: each harmonic's level ratio is
    # the EQ's response at that frequency, so one pair of renders measures the whole curve. The
    # output tube runs clean, so the stages after the EQ stay linear.
    def eqp(base, **out):
        q = json.loads(json.dumps(base)); q.setdefault("out", {}).update(out); return q
    sawq = patch(osc1={"wave": "saw", "level": 0.12, "fixed": 50}, filt={"model": "valve12", "cutoff": 20000, "res": 0, "drive": 0})
    HARM = [h for h in sorted(set(int(round(50 * 2 ** (k / 3) / 50)) * 50 for k in range(0, 26))) if h <= 15000]
    def harm_amps(x, hs): return np.array([tone_amp(x, h) for h in hs])
    def eq_measure(base, out, hs=HARM, ev=None, ch=0, ref=None):
        ev = ev or note(60, 0.0)
        A = render(eqp(base, **(ref or {"eqOn": False})), ev, 1.4)[ch][int(0.3 * SR):int(1.3 * SR)]
        B = render(eqp(base, **out), ev, 1.4)[ch][int(0.3 * SR):int(1.3 * SR)]
        return 20 * np.log10(harm_amps(B, hs) / harm_amps(A, hs))
    def eq_want(gains, n, hs=HARM): return np.array(pg.evaluate("a => a.hs.map(f => __synth.eq.response(f, a.g, a.n))", {"hs": hs, "g": gains, "n": n}))
    rnd_eq = random.Random(11)
    g31 = [round(rnd_eq.uniform(-12, 12) * 2) / 2 for _ in range(31)]
    for n, gains, label in ((31, g31, "a random 31-band curve"), (10, pg.evaluate("__synth.eq.fit('smile', 10)"), "the smile preset at 10 bands"),
                            (15, pg.evaluate("__synth.eq.fit('radio', 15)"), "the AM radio preset at 15 bands")):
        meas = eq_measure(sawq, {"eqOn": True, "eqBands": n, "eqGains": gains, "eqPreset": "custom"})
        err = float(np.max(np.abs(meas - eq_want(gains, n))))
        ck(f"Q. EQ: {label}, measured at {len(HARM)} harmonics from 50 Hz to 15 kHz, matches the plotted curve within 0.25 dB (worst {err:.2f})", err <= 0.25,
           [(h, round(m, 2), round(w_, 2)) for h, m, w_ in zip(HARM, meas, eq_want(gains, n))])
    # one band alone: +12 dB at its centre, and the neighbours an octave away barely move
    g10 = [0] * 10; g10[5] = 12
    m1 = eq_measure(sawq, {"eqOn": True, "eqBands": 10, "eqGains": g10}, hs=[1000, 500, 2000, 250, 4000])
    ck(f"Q. EQ: the 1 kHz fader at +12 lifts 1 kHz by {m1[0]:.2f} dB and an octave either side by {m1[1]:.1f} and {m1[2]:.1f} dB", abs(m1[0] - 12) <= 0.3 and max(m1[1:3]) < 5 and max(abs(m1[3]), abs(m1[4])) < 1.5, m1)
    # off is off: faders and level set but the EQ bypassed measure the same as no EQ at all
    moff = eq_measure(sawq, {"eqOn": False, "eqBands": 31, "eqGains": g31, "eqPre": 9})
    ck(f"Q. EQ off is out of circuit: its faders and level make no difference (worst {float(np.max(np.abs(moff))):.3f} dB)", float(np.max(np.abs(moff))) <= 0.05, moff)
    # in, flat, at 0 dB: transparent
    m0 = eq_measure(sawq, {"eqOn": True, "eqBands": 31, "eqGains": [0] * 31, "eqPre": 0})
    ck(f"Q. EQ in but flat is transparent (worst {float(np.max(np.abs(m0))):.3f} dB)", float(np.max(np.abs(m0))) <= 0.05, m0)
    # the level knob
    m6 = eq_measure(sawq, {"eqOn": True, "eqPre": 6})
    ck(f"Q. EQ level +6 dB lifts everything by 6 (measured {float(np.mean(m6)):.2f}, spread {float(np.ptp(m6)):.2f})", abs(float(np.mean(m6)) - 6) <= 0.2 and float(np.ptp(m6)) <= 0.2, m6)
    # the presets: the fitted faders land on each preset's shape at every band centre
    worst = {}
    for pid in pg.evaluate("__synth.eq.presets()"):
        for n in (10, 15, 31):
            e = pg.evaluate("""a => { const g = __synth.eq.fit(a.id, a.n), c = __synth.eq.centres(a.n);
              return Math.max(...c.filter(f => f >= 30 && f <= 16000).map(f => Math.abs(__synth.eq.response(f, g, a.n) - __synth.eq.target(a.id, f)))); }""", {"id": pid, "n": n})
            worst[f"{pid}/{n}"] = round(e, 2)
    bad = {k: v for k, v in worst.items() if v > (2.5 if k.endswith("/10") else 1.5)}
    ck(f"Q. EQ presets: {len(worst) // 3} presets x 3 band counts land within 1.5 dB of their shape (2.5 at 10 bands) at every band centre", not bad, bad)
    info("Q. EQ preset fit, worst dB per preset/bands", worst)
    # stereo: both channels get the same EQ (mono-safe by construction), measured on a hard-panned pair of voices
    wide = patch(osc1={"wave": "saw", "level": 0.12, "fixed": 50}, filt={"model": "valve12", "cutoff": 20000, "res": 0, "drive": 0}, stereo={"pan": "alt", "spread": 1})
    sm = pg.evaluate("__synth.eq.fit('smile', 15)")
    two = note(60, 0.0) + note(64, 0.0)
    mL = eq_measure(wide, {"eqOn": True, "eqBands": 15, "eqGains": sm}, ev=two, ch=0)
    mR = eq_measure(wide, {"eqOn": True, "eqBands": 15, "eqGains": sm}, ev=two, ch=1)
    w15 = eq_want(sm, 15)
    ck(f"Q. EQ: left and right get the same curve (worst {float(max(np.max(np.abs(mL - w15)), np.max(np.abs(mR - w15)))):.2f} dB from the plot)", float(max(np.max(np.abs(mL - w15)), np.max(np.abs(mR - w15)))) <= 0.25, (mL, mR))
    P = pg.evaluate("__synth.factoryPatch('Wide Novachord Strings')")
    folds = []
    for on in (False, True):
        q = eqp(P, eqOn=on, eqBands=15, eqGains=sm, eqPreset="smile")
        L, R = render(q, [e for k in (48, 55, 60, 64) for e in note(k, 0.05, 1.8)], 2.4)
        sg = slice(int(0.3 * SR), int(1.7 * SR))
        st = math.sqrt((np.mean(L[sg] ** 2) + np.mean(R[sg] ** 2)) / 2); mo = math.sqrt(np.mean(((L[sg] + R[sg]) / 2) ** 2)); folds.append(db(st) - db(mo))
    # (this patch's voices start at random phases, so its fold varies about 0.3 dB from render to render either way)
    ck(f"Q. EQ on a wide patch keeps its mono fold inside the 3 dB limit ({folds[0]:.2f} dB off, {folds[1]:.2f} dB on)", folds[1] <= 3 and abs(folds[1] - folds[0]) <= 0.75, folds)
    # Cathode carries the same rack fields: its EQ measures the same way (VCO 1 saw at 110 Hz, A2)
    cq = cpatch(vco1={"wave": "saw", "scale": 8, "level": 0.12}, vca={"level": 0.5, "vel": 0, "bias": 0})
    ch_h = [110 * k for k in (1, 2, 3, 4, 6, 9, 14, 23, 36, 55, 90, 130)]
    rc = pg.evaluate("__synth.eq.fit('presence', 31)")
    mc = eq_measure(cq, {"eqOn": True, "eqBands": 31, "eqGains": rc, "eqPreset": "presence"}, hs=ch_h, ev=note(45, 0.0))
    wc = eq_want(rc, 31, ch_h)
    ck(f"Q. EQ is rack-wide: Cathode's own EQ (presence, 31 bands) matches the plot within 0.25 dB (worst {float(np.max(np.abs(mc - wc))):.2f})", float(np.max(np.abs(mc - wc))) <= 0.25, list(zip(ch_h, mc, wc)))
    # headroom: every fader and the level at +12 into a loud chord still never passes 0 dBFS
    hot = patch(osc1={"wave": "saw", "level": 1}, osc2={"wave": "pulse", "level": 1}, sub={"level": 1}, voice={"level": 1},
                out={"tube": "EL34", "topology": "pp", "drive": 8, "level": 12, "roomOn": True, "wOn": True, "width": 200, "eqOn": True, "eqBands": 31, "eqGains": [12] * 31, "eqPre": 12})
    L, R = render(hot, [e for k in (36, 48, 55, 60, 64, 67, 72, 79) for e in note(k, 0.0)], 2.0)
    pk = float(max(np.max(np.abs(L)), np.max(np.abs(R))))
    ck(f"Q. EQ all +12 and level +12 on a full chord: finite and under 0 dBFS (peak {db(pk):.2f} dBFS)", bool(np.all(np.isfinite(L)) and np.all(np.isfinite(R))) and pk <= 1.0, pk)
    # the schema: old patches load; out-of-range and odd values are put right
    nz = pg.evaluate("""() => { const N = __synth.eq.normalize, o = p => N(p).out;
      const old = o({ name: 'old', out: { tube: 'EL34' } });
      const snap = o({ out: { eqBands: 12 } }), snap2 = o({ out: { eqBands: 25 } });
      const clamp = o({ out: { eqBands: 10, eqGains: [20, -30, 'x', null, 1.26, 0, 0, 0, 0, 0], eqPre: 99, eqPreset: 'custom' } });
      const refit = o({ out: { eqBands: 31, eqGains: [1, 2, 3], eqPreset: 'warm' } });
      const bad = o({ out: { eqBands: 15, eqGains: [1, 2], eqPreset: 'custom' } });
      const unk = o({ out: { eqPreset: 'nonsense' } });
      const cath = N({ device: 'cathode', out: { eqOn: true, eqBands: 15, eqGains: new Array(15).fill(3), eqPreset: 'custom' } }).out;
      const cold = N({ device: 'cathode' }).out;
      return { old: [old.eqOn, old.eqBands, old.eqGains.length, old.eqGains.every(g => g === 0), old.eqPre, old.eqPreset],
        snap: [snap.eqBands, snap.eqGains.length, snap2.eqBands], clamp: [clamp.eqGains.slice(0, 5), clamp.eqPre],
        refit: [refit.eqGains.length, JSON.stringify(refit.eqGains) === JSON.stringify(__synth.eq.fit('warm', 31))], bad: [bad.eqGains.length, bad.eqPreset, bad.eqGains.every(g => g === 0)],
        unk: unk.eqPreset, cath: [cath.eqOn, cath.eqBands, cath.eqGains[7]], cold: [cold.eqOn, cold.eqBands, cold.eqGains.length] }; }""")
    ck("Q. schema: a patch from before the EQ loads with it off, 10 flat bands, level 0, preset flat", nz["old"] == [False, 10, 10, True, 0, "flat"], nz["old"])
    ck("Q. schema: a band count snaps to 10, 15 or 31 and the gains follow it", nz["snap"] == [10, 10, 31], nz["snap"])
    ck("Q. schema: fader gains clamp to +/-12 dB in 0.5 dB steps, junk reads 0; level clamps to +12", nz["clamp"] == [[12, -12, 0, 0, 1.5], 12], nz["clamp"])
    ck("Q. schema: gains of the wrong length are fitted again from the preset", nz["refit"] == [31, True], nz["refit"])
    ck("Q. schema: wrong-length custom gains reset flat", nz["bad"] == [15, "flat", True], nz["bad"])
    ck("Q. schema: an unknown preset name falls back to flat", nz["unk"] == "flat", nz["unk"])
    ck("Q. schema: Cathode patches carry the same EQ fields", nz["cath"] == [True, 15, 3] and nz["cold"] == [False, 10, 10], nz)
    # the section, in the page
    pg.evaluate("__synth.load('Wide Novachord Strings')"); pg.wait_for_timeout(150)
    sec = pg.locator("#mEq"); sec.scroll_into_view_if_needed()
    ck("Q. UI: the Graphic EQ section is in the rack, off for a factory patch", pg.is_visible("#mEq") and pg.get_attribute("#eqOnBtn", "aria-pressed") == "false" and pg.evaluate("__synth.engine().C.filters.length") == 10)
    pg.click('#eqPresetChips .chip[data-v="smile"]'); pg.wait_for_timeout(250)
    st = pg.evaluate("[__synth.patch().out, __synth.eq.live()]")
    ck("Q. UI: a preset chip switches the EQ on and the rack runs its faders", st[0]["eqOn"] and st[0]["eqPreset"] == "smile" and st[0]["eqGains"] == pg.evaluate("__synth.eq.fit('smile', 10)")
       and all(abs(a - b_) < 0.05 for a, b_ in zip(st[1]["gains"], st[0]["eqGains"])) and pg.get_attribute("#eqOnBtn", "aria-pressed") == "true", st)
    pg.click('#eqBandChips .chip[data-v="31"]'); pg.wait_for_timeout(300)
    st = pg.evaluate("[__synth.patch().out, __synth.eq.live()]")
    ck("Q. UI: 31 bands rebuilds the rack's EQ (30 peaking filters and a top shelf) and keeps the preset", st[1]["n"] == 31 and st[1]["types"].count("peaking") == 30 and st[1]["types"][-1] == "highshelf"
       and st[0]["eqGains"] == pg.evaluate("__synth.eq.fit('smile', 31)"), st)
    cvb = pg.query_selector("#eqCv").bounding_box()
    # band 20 of 31 (1.6 kHz): the plot's left margin is 28 px, the top 8 px, the bottom 16 px
    bx = cvb["x"] + 28 + (cvb["width"] - 34) / 31 * 20.5
    pg.mouse.move(bx, cvb["y"] + 8 + 2); pg.mouse.down(); pg.mouse.up(); pg.wait_for_timeout(200)
    o = pg.evaluate("__synth.patch().out")
    ck(f"Q. UI: clicking near the top of a fader sets that band near +12 and the preset to custom ({o['eqGains'][20]} dB at 1.6 kHz)", o["eqGains"][20] >= 11 and o["eqPreset"] == "custom"
       and pg.is_visible('#eqPresetChips .chip[data-v="custom"]') and abs(pg.evaluate("__synth.eq.live().gains[20]") - o["eqGains"][20]) < 0.1, o)
    cvb = pg.query_selector("#eqCv").bounding_box()       # the custom chip may have moved it
    bx = cvb["x"] + 28 + (cvb["width"] - 34) / 31 * 20.5
    pg.mouse.move(cvb["x"] + 28 + (cvb["width"] - 34) / 31 * 2.5, cvb["y"] + cvb["height"] - 16 - 2); pg.mouse.down()
    pg.mouse.move(cvb["x"] + 28 + (cvb["width"] - 34) / 31 * 8.5, cvb["y"] + cvb["height"] - 16 - 2, steps=4); pg.mouse.up(); pg.wait_for_timeout(150)
    o = pg.evaluate("__synth.patch().out")
    ck(f"Q. UI: a sweep across the faders draws a curve (bands 2 to 8 all pulled down: {o['eqGains'][2:9]})", all(g <= -10 for g in o["eqGains"][2:9]), o["eqGains"])
    pg.mouse.dblclick(bx, cvb["y"] + cvb["height"] / 2); pg.wait_for_timeout(100)
    ck("Q. UI: double click zeroes a band", pg.evaluate("__synth.patch().out.eqGains[20]") == 0)
    pg.focus("#eqCv"); pg.keyboard.press("ArrowUp"); pg.keyboard.press("ArrowUp"); pg.keyboard.press("Shift+ArrowUp"); pg.wait_for_timeout(100)
    ck("Q. UI: arrow keys move the selected band (0.5 dB, shift 3 dB) and do not play notes", pg.evaluate("__synth.patch().out.eqGains[20]") == 4 and not pg.evaluate("__synth.state()").get("down"), pg.evaluate("__synth.patch().out.eqGains[20]"))
    pg.click("#eqOnBtn"); pg.wait_for_timeout(100)
    ck("Q. UI: the on button bypasses the EQ and keeps the faders", not pg.evaluate("__synth.patch().out.eqOn") and pg.evaluate("__synth.patch().out.eqGains[20]") == 4 and pg.get_attribute("#mEq", "class").find("off") >= 0)
    ck("Q. UI: the plot is painted", pg.evaluate("__synth.eq.painted()") > 5, pg.evaluate("__synth.eq.painted()"))
    # each device keeps its own EQ; the rack follows the lit one
    pg.click("#devC"); pg.wait_for_timeout(250)
    ck("Q. UI: Cathode has its own EQ (its patch's 10 bands, off) and the rack follows it", pg.evaluate("__synth.eq.live().n") == 10 and not pg.evaluate("__synth.patch().out.eqOn") and pg.is_visible("#mEq"))
    pg.click('#eqPresetChips .chip[data-v="air"]'); pg.wait_for_timeout(200)
    pg.click("#devF"); pg.wait_for_timeout(250)
    ck("Q. UI: back on Filament its 31-band custom curve returns", pg.evaluate("__synth.eq.live().n") == 31 and pg.evaluate("__synth.patch().out.eqPreset") == "custom")
    pg.reload(); pg.wait_for_function("window.__synth && __synth.ready()", timeout=20000); pg.wait_for_timeout(200)
    ck("Q. UI: the EQ settings survive a reload", pg.evaluate("__synth.patch().out.eqBands") == 31 and pg.evaluate("__synth.patch().out.eqGains[20]") == 4 and pg.evaluate("__synth.eq.live().n") == 31)
    # the LED ladders read the live signal (the audio context runs after a gesture)
    pg.locator("#mEq").scroll_into_view_if_needed(); pg.click('#eqPresetChips .chip[data-v="flat"]')
    k = pg.query_selector('.key[data-n="60"]'); k.scroll_into_view_if_needed(); kb_ = k.bounding_box()
    pg.mouse.move(kb_["x"] + kb_["width"] / 2, kb_["y"] + kb_["height"] * 0.9); pg.mouse.down(); pg.wait_for_timeout(700)
    lv = pg.evaluate("__synth.eq.levels()"); pg.mouse.up(); pg.wait_for_timeout(100)
    ck(f"Q. UI: the LED ladders read the live spectrum (loudest band {max(lv) if lv else -999:.0f} dBFS)", bool(lv) and max(lv) > -70, lv)
    ck("Q. no page errors", not errs, errs)

    # ---------------------------------------------------------------- Tv. the tube show (James, 13 Oct)
    # Visual state from __synth.tubeShow(), read in the page while the chassis frame loop runs. Peaks are
    # sampled inside the page every 8 ms, so the round trips of evaluate() do not hide a 150 ms flare.
    TV_PEAK = """async (a) => { const S = () => __synth.tubeShow(); await __synth.engine().ctx.resume();
      const s0 = S(), o0 = s0.onsets; let pk = { v1: 0, v3: 0 }, t1 = -1, t3 = -1; const t0 = performance.now();
      a.notes.forEach(n => __synth.noteOn(n, a.v));
      while (performance.now() - t0 < a.ms) { const s = S();
        if (s.flare.v1 > pk.v1) pk.v1 = s.flare.v1; if (s.flare.v3 > pk.v3) pk.v3 = s.flare.v3;
        if (t1 < 0 && s.flare.v1 > 0.05) t1 = performance.now() - t0; if (t3 < 0 && s.flare.v3 > 0.05) t3 = performance.now() - t0;
        await new Promise(r => setTimeout(r, 8)); }
      const s = S(); a.notes.forEach(n => __synth.noteOff(n));
      return { pk, t1, t3, onsets: s.onsets - o0, start: s0, end: s }; }"""
    # fires.v1 went up: V1 flared during this call (fired.v1 alone may still hold an earlier note's flare)
    def tv_fired(r, k="v1"): return r["end"]["fires"][k] > r["start"]["fires"][k]
    pg.evaluate("__synth.setDevice('filament')"); pg.evaluate("__synth.setTubeShow('full')"); pg.wait_for_timeout(100)
    clean = patch(osc1={"wave": "saw", "level": 0.6}, v1={"tube": "12AX7", "drive": 2, "bias": 0}, envA={"a": 0.001, "d": 0.1, "s": 1, "r": 0.05, "vel": 0})
    pg.evaluate("(p) => __synth.setPatch(p)", clean); pg.wait_for_timeout(200)
    st = pg.evaluate("__synth.tubeShow()")
    ck("Tv. the tube show defaults to full, its chip lit", st["mode"] == "full" and not st["reduced"] and pg.get_attribute('#showChips .chip[data-v="full"]', "aria-pressed") == "true", st)
    hi = pg.evaluate(TV_PEAK, {"notes": [60], "v": 1.0, "ms": 260}); pg.wait_for_timeout(700)
    lo = pg.evaluate(TV_PEAK, {"notes": [62], "v": 0.3, "ms": 260}); pg.wait_for_timeout(200)
    # The flare each tube took and its lag after the note-on come from the show itself (its own clock),
    # so a starved page cannot hide them. Sampling from outside every 8 ms missed the 150 ms peak twice on
    # 21 Oct with the box loaded (first sample at 74 and 145 ms); the sampled peaks stay in the names.
    hf, hl = hi["end"]["fired"], hi["end"]["firedLag"]
    ck(f"Tv. a note-on flares V1 ({hf['v1']:.2f}) and then the output pair ({hf['v3']:.2f}), V1 first (lag {hl['v1']:.0f} ms, {hl['v3']:.0f} ms on the show clock; sampled peaks {hi['pk']['v1']:.2f}, {hi['pk']['v3']:.2f})",
       tv_fired(hi) and tv_fired(hi, "v3") and hf["v1"] > 0.5 and hf["v3"] > 0.3 and 0 <= hl["v1"] <= hl["v3"] and hl["v3"] >= 45 and hi["pk"]["v1"] > 0, hi)
    lf = lo["end"]["fired"]
    ck(f"Tv. the flare scales with velocity ({lf['v1']:.2f} at 0.3 against {hf['v1']:.2f} at 1.0; sampled peaks {lo['pk']['v1']:.2f}, {hi['pk']['v1']:.2f})", tv_fired(lo) and lf["v1"] < 0.5 * hf["v1"] and lf["v1"] > 0.05 and lo["pk"]["v1"] > 0, (lo, hi))
    ck(f"Tv. the flare decays (V1 {lo['end']['flare']['v1']:.3f} about 120 ms after a quiet note's peak; {hi['end']['flare']['v1']:.3f} after a loud one)", hi["end"]["flare"]["v1"] < 0.5 * hi["pk"]["v1"], hi)
    ck(f"Tv. one key is one flare (onsets {hi['onsets']}), not one from the key and another from the meter", hi["onsets"] == 1, hi)
    ch = pg.evaluate(TV_PEAK, {"notes": [48, 55, 60, 64], "v": 0.9, "ms": 400})
    ck(f"Tv. a chord flares once per note ({ch['onsets']}) and lights one voice lamp per voice ({ch['end']['lamps']} lamps)",
       ch["onsets"] == 4 and ch["end"]["lamps"] >= 4 and pg.evaluate("document.querySelectorAll('#vLamps i.on').length") == ch["end"]["lamps"], ch)
    pg.wait_for_timeout(400)
    ck("Tv. the voice lamps go dark when the notes end", pg.evaluate("document.querySelectorAll('#vLamps i.on').length") == 0 and pg.evaluate("__synth.tubeShow().lamps") == 0)
    # drive and signal level heat the plates
    HOLD = """async (a) => { await __synth.engine().ctx.resume(); a.notes.forEach(n => __synth.noteOn(n, a.v == null ? 0.9 : a.v));
      await new Promise(r => setTimeout(r, a.ms)); const s = __synth.tubeShow(), m = __synth.meter(); a.notes.forEach(n => __synth.noteOff(n));
      await new Promise(r => setTimeout(r, 250)); return { s, v1: m.v1 }; }"""
    heats = []
    for drv in (1, 9):
        pg.evaluate("(p) => __synth.setPatch(p)", patch(osc1={"wave": "saw", "level": 0.8}, v1={"tube": "12AX7", "drive": drv, "bias": 0}))
        pg.wait_for_timeout(150); heats.append(pg.evaluate(HOLD, {"notes": [48, 55], "ms": 1500}))
    ck(f"Tv. more drive runs V1 hotter (heat {heats[0]['s']['heat']['v1']:.2f} at drive 1, {heats[1]['s']['heat']['v1']:.2f} at drive 9)",
       heats[1]["s"]["heat"]["v1"] > heats[0]["s"]["heat"]["v1"] + 0.25 and heats[1]["s"]["heat"]["v1"] > 0.5, heats)
    idle = pg.evaluate("__synth.tubeShow().heat.v1"); pg.wait_for_timeout(1500); idle2 = pg.evaluate("__synth.tubeShow().heat.v1")
    # (drive alone keeps a little warmth: 0.18 x drive/10, so 0.16 at drive 9)
    ck(f"Tv. the plates cool when the playing stops ({idle:.2f}, then {idle2:.2f} 1.5 s later)", idle2 < 0.5 * idle and idle2 < 0.35, (idle, idle2))
    # clipping fires an arc, rate limited
    hot = patch(osc1={"wave": "saw", "level": 1}, osc2={"wave": "pulse", "level": 1}, sub={"level": 1}, voice={"level": 1},
                v1={"tube": "12AX7", "drive": 10, "bias": 0}, out={"tube": "EL34", "topology": "pp", "drive": 8, "level": 12})
    pg.evaluate("(p) => __synth.setPatch(p)", hot); pg.wait_for_timeout(150)
    a0 = pg.evaluate("__synth.tubeShow().arcs"); hr = pg.evaluate(HOLD, {"notes": [36, 48, 55, 60, 64, 67], "ms": 2000}); arcs = hr["s"]["arcs"] - a0
    ck(f"Tv. a clipping chord fires arcs ({arcs} in 2 s), never more than five a second", 1 <= arcs <= 11, hr)
    fa = []
    for nm in ("Screaming 12AX7", "Black Light Pad", "Theremin Wail"):
        pg.evaluate("n => __synth.load(n)", nm); pg.wait_for_timeout(150); a1 = pg.evaluate("__synth.tubeShow().arcs")
        fa.append((nm, pg.evaluate(HOLD, {"notes": [48, 55, 60, 64], "v": 1.0, "ms": 900})["s"]["arcs"] - a1))
    ck(f"Tv. factory patches played hard do not arc (only real clipping does): {fa}", all(x[1] == 0 for x in fa), fa)
    ck(f"Tv. the power tubes glow blue with the output (V3 {hr['s']['blue']['v3']:.2f}) and V1 plates red (heat {hr['s']['heat']['v1']:.2f})", hr["s"]["blue"]["v3"] > 0.4 and hr["s"]["heat"]["v1"] > 0.6, hr)
    # the canvases are painted: a held hot chord draws a brighter V1 with the show on than off
    # the painter, on its own: the same tube at the same instant, with and without each part of the show
    PAINT = """async () => { const m = await import('./tubepaint.js'); const cv = document.createElement('canvas');
      cv.style.cssText = 'width:78px;height:130px;position:fixed;left:0;top:0;z-index:-1'; document.body.appendChild(cv);
      const st = { shown: '12AX7', heat: 1, glow: 0.6, drive: 5, bias: 0, on: true, tubeOn: true, tvFilter: 'natural', tvBright: 100, tvFlicker: 0 };
      const sum = sh => { m.paintTubeShow(cv, 1000, st, 'rack', sh); const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; } const n = d.length / 4; return [r / n, g / n, b / n]; };
      const z = { k: 1, flare: 0, heat: 0, arc: 0, seed: 1, blue: 0, res: 0, shimmer: false };
      const o = { none: sum(null), off: sum(Object.assign({}, z, { heat: 0.9, k: 0 })), heat: sum(Object.assign({}, z, { heat: 0.9 })), subtle: sum(Object.assign({}, z, { heat: 0.9, k: 0.45 })),
        blue: sum(Object.assign({}, z, { blue: 1 })), flare: sum(Object.assign({}, z, { flare: 1 })), arc: sum(Object.assign({}, z, { arc: 1, seed: 7 })), res: sum(Object.assign({}, z, { res: 1 })) };
      cv.remove(); return o; }"""
    pt = pg.evaluate(PAINT); d_ = lambda k: [round(pt[k][i] - pt["none"][i], 1) for i in range(3)]
    ck(f"Tv. painter: red plating adds mostly red {d_('heat')}, subtle less {d_('subtle')}, off nothing {d_('off')}",
       d_("heat")[0] > 3 and d_("heat")[0] > 2 * d_("heat")[2] and 0 < d_("subtle")[0] < d_("heat")[0] and max(abs(x) for x in d_("off")) < 0.01, pt)
    ck(f"Tv. painter: blue glow adds mostly blue {d_('blue')}; a flare brightens all three {d_('flare')}; an arc adds blue-white {d_('arc')}; resonance adds warm light {d_('res')}",
       d_("blue")[2] > 3 and d_("blue")[2] > 2 * d_("blue")[0] and min(d_("flare")) > 2 and d_("arc")[2] > 1 and d_("res")[0] > 1, pt)
    pg.evaluate("__synth.noteOn(48, 1); __synth.noteOn(55, 1)"); pg.wait_for_timeout(600); pg.evaluate("__synth.setTubeShow('off')"); pg.wait_for_timeout(1200)
    st_off = pg.evaluate("__synth.tubeShow()")
    pg.evaluate("__synth.noteOff(48); __synth.noteOff(55)"); pg.wait_for_timeout(250)
    a0 = pg.evaluate("__synth.tubeShow().arcs"); ho = pg.evaluate(HOLD, {"notes": [36, 48, 55, 60], "ms": 1200})
    ck("Tv. off: no flares, no arcs, no heat or blue glow, and the voice lamps are hidden",
       ho["s"]["arcs"] == a0 and ho["s"]["flare"]["v1"] == 0 and ho["s"]["heat"]["v1"] < 0.02 and ho["s"]["blue"]["v3"] < 0.02 and st_off["lamps"] == 0
       and not pg.is_visible("#vLamps") and pg.get_attribute('#showChips .chip[data-v="off"]', "aria-pressed") == "true", (ho, st_off))
    pg.evaluate("__synth.setTubeShow('subtle')"); hs = pg.evaluate(TV_PEAK, {"notes": [60], "v": 1.0, "ms": 200}); pg.wait_for_timeout(300)
    # As in the Filament checks above: the flare V1 took, from the show's own record, not a peak sampled
    # every 8 ms from outside (a starved frame loop shows it already decayed; see the Improvement backlog, 27 Oct)
    ck(f"Tv. subtle: the same flare state, drawn at a lower scale (V1 took {hs['end']['fired']['v1']:.2f}; sampled peak {hs['pk']['v1']:.2f})",
       tv_fired(hs) and hs["end"]["fired"]["v1"] > 0.5 and hs["pk"]["v1"] > 0 and hs["end"]["mode"] == "subtle", hs)
    pg.evaluate("__synth.setTubeShow('full')")
    # resonance on V2: Valve 12 brightens with resonance and shimmers when it self-oscillates
    res = []
    for rv in (0.2, 0.97):
        pg.evaluate("(p) => __synth.setPatch(p)", patch(filt={"model": "valve12", "cutoff": 800, "res": rv, "keytrack": 0, "env": 0, "vel": 0, "drive": 3, "sag": 3}))
        pg.wait_for_timeout(150); res.append(pg.evaluate(HOLD, {"notes": [57], "ms": 600})["s"])
    ck(f"Tv. V2 shows the resonance ({res[0]['res']:.2f} at 0.2, {res[1]['res']:.2f} at 0.97) and shimmers only when it self-oscillates", res[1]["res"] > 0.85 and res[0]["res"] < 0.3 and res[1]["shimmer"] and not res[0]["shimmer"], res)
    # V2's glow eases off with a 0.12 s time constant on the show's clock, which only moves when the frame loop
    # runs. A fixed 500 ms wait measured 340 to 400 ms needed on origin/main and 425 to 567 ms once one more
    # line of text sat in the Filter section (28 Oct, headless, 6 tries each): a wall-clock race, so wait for
    # it, up to 2 s. A V2 that kept glowing on Ladder 24 still fails.
    pg.evaluate("(p) => __synth.setPatch(p)", patch(filt={"model": "ladder24", "cutoff": 800, "res": 0.97}))
    try: pg.wait_for_function("__synth.tubeShow().res < 0.05 && !__synth.tubeShow().shimmer", timeout=2000); v2_off = True
    except Exception as e_: v2_off = False
    ck("Tv. on Ladder 24, V2 is out of the path and shows nothing", v2_off, pg.evaluate("__synth.tubeShow()"))
    # Cathode: V2, the follower, shows the low-pass peak
    pg.evaluate("__synth.setDevice('cathode')"); pg.evaluate("__synth.load('Plate Screamer')"); pg.wait_for_timeout(200)
    pk_c = pg.evaluate("__synth.patch().lpf.peak"); cs = pg.evaluate(TV_PEAK, {"notes": [48], "v": 0.9, "ms": 700})
    ck(f"Tv. Cathode: a note flares its tubes (V1 took {cs['end']['fired']['v1']:.2f}; sampled peak {cs['pk']['v1']:.2f}) and V2 follows the low-pass peak (peak {pk_c}, shown {cs['end']['res']:.2f})",
       tv_fired(cs) and cs["end"]["fired"]["v1"] > 0.5 and cs["pk"]["v1"] > 0 and abs(cs["end"]["res"] - pk_c) < 0.1 and cs["end"]["shimmer"] == (pk_c >= 0.88), cs)
    pg.evaluate("__synth.setDevice('filament')"); pg.wait_for_timeout(300)
    # the chip, remembered per browser; reduced motion keeps only the steady glow
    tctx = b.new_context(viewport={"width": 1366, "height": 900}); tp = tctx.new_page(); terr = []; tp.on("pageerror", lambda e: terr.append(str(e)))
    tp.goto(BASE); tp.wait_for_function("window.__synth && __synth.ready()", timeout=20000)
    tp.locator("#mShow").scroll_into_view_if_needed(); tp.click('#showChips .chip[data-v="subtle"]'); tp.wait_for_timeout(100)
    tp.reload(); tp.wait_for_function("window.__synth && __synth.ready()", timeout=20000)
    ck("Tv. the show chip is remembered in this browser (subtle after a reload)", tp.evaluate("__synth.tubeShow().mode") == "subtle"
       and tp.get_attribute('#showChips .chip[data-v="subtle"]', "aria-pressed") == "true", tp.evaluate("__synth.tubeShow()"))
    ck("Tv. the show's chips stay put: no page errors", not terr, terr)
    tctx.close()
    rctx = b.new_context(viewport={"width": 1366, "height": 900}, reduced_motion="reduce"); rp = rctx.new_page(); rerr = []; rp.on("pageerror", lambda e: rerr.append(str(e)))
    rp.goto(BASE); rp.wait_for_function("window.__synth && __synth.ready()", timeout=20000)
    rp.evaluate("(p) => __synth.setPatch(p)", hot); rp.wait_for_timeout(150)
    rf = rp.evaluate(TV_PEAK, {"notes": [36, 48, 55, 60, 64], "v": 1.0, "ms": 1800})
    rp.evaluate("(p) => __synth.setPatch(p)", patch(filt={"model": "valve12", "cutoff": 800, "res": 0.97}))
    rr = rp.evaluate(HOLD, {"notes": [57], "ms": 600})["s"]
    ck(f"Tv. reduced motion: no flares and no arcs on a clipping chord (arcs {rf['end']['arcs']}, flare {rf['pk']['v1']})", rf["end"]["reduced"] and rf["end"]["arcs"] == 0 and rf["pk"]["v1"] == 0, rf)
    ck(f"Tv. reduced motion keeps the steady glow (heat {rf['end']['heat']['v1']:.2f}, blue {rf['end']['blue']['v3']:.2f}) and no shimmer (resonance {rr['res']:.2f})",
       rf["end"]["heat"]["v1"] > 0.4 and rf["end"]["blue"]["v3"] > 0.3 and rr["res"] > 0.8 and not rr["shimmer"], (rf, rr))
    ck("Tv. reduced motion: no page errors", not rerr, rerr)
    rctx.close()
    # The draw time is a smoothed wall-clock figure (about 10 frames). Read straight after the two pages
    # above, it timed their load and renders on the same cores as much as the chassis: measured 24 Oct,
    # 5.9 to 11.1 ms on a page that draws a held five-note chord in 5.2 ms (stable) once the others close,
    # and 12.2 ms in the suite on a slow box. So it is read here at the end of a chord this page plays on
    # its own (flares, heat and lamps running), with the other contexts closed.
    dm = pg.evaluate("""async () => { await __synth.engine().ctx.resume(); const ns = [36, 48, 55, 60, 64];
      ns.forEach(n => __synth.noteOn(n, 1)); await new Promise(r => setTimeout(r, 1500));
      const d = __synth.tubeShow().drawMs; ns.forEach(n => __synth.noteOff(n)); await new Promise(r => setTimeout(r, 250)); return d; }""")
    info("Tv. chassis draw time (four tubes with the show, smoothed, desktop)", f"{dm:.2f} ms per frame (the loop runs at 30 fps, 33 ms)")
    ck(f"Tv. the four tubes with the show draw in under 12 ms a frame ({dm:.2f} ms)", 0 < dm < 12, dm)
    ck("Tv. no page errors", not errs, errs)

    # ---------------------------------------------------------------- 9. CPU (logged)
    # Each line is a case's steady cost: the wall time of a CPU_L s offline render minus a CPU_S s one (each the
    # faster of two), over the seconds between, so the fixed cost of every render (a fresh worklet scope, the worklet's JIT warm-up,
    # measured 25 Oct at 0.25 to 0.45 s) drops out. It runs in a page of its own with both pages' live audio
    # suspended: read on the main page after the 1000 checks above, the same patches cost up to twice what
    # they cost in a fresh page, and by an amount that changed run to run (measured 27 and 28 Oct). The whole
    # CPU_L s render is logged beside it. These are INFO lines; nothing here can fail the suite.
    CPU_S, CPU_L = 2.0, 12.0
    cpx = b.new_context(viewport={"width": 1366, "height": 1000}); cp = cpx.new_page(); cperr = []
    cp.on("pageerror", lambda e: cperr.append(str(e)))
    cp.goto(BASE); cp.wait_for_function("window.__synth && __synth.ready()", timeout=20000)
    HUSH = "async () => { const c = __synth.engine().ctx, s = c.state; if (s === 'running') await c.suspend(); return s; }"
    pg_was = pg.evaluate(HUSH); cp.evaluate(HUSH)
    def cpu9(name, P, ev):
        a = {"patch": P, "events": ev}
        ms = lambda sec: min(cp.evaluate("a => __synth.timeRender(a)", dict(a, seconds=sec))["ms"] for _ in range(2))
        ts, tl = ms(CPU_S), ms(CPU_L)
        info(f"9. CPU {name}", f"{100 * (tl - ts) / ((CPU_L - CPU_S) * 1000):.1f}% of real time steady in headless Chrome "
             f"(offline, rack included; {CPU_L:g} s render minus {CPU_S:g} s, best of 2 each, own page); whole {CPU_L:g} s render {100 * tl / (CPU_L * 1000):.1f}%")
    # a throwaway render first: the page's first offline render runs 0.5 s slower than the rest (measured)
    cp.evaluate("a => __synth.timeRender(a)", {"patch": patch(), "events": note(60, 0.0), "seconds": 1.0})
    cpu9("Cathode (Plate Screamer, one voice, both filters screaming)", cp.evaluate("__synth.cathodePatch('Plate Screamer')"), note(60, 0.0))
    big = patch(osc1={"wave": "saw"}, osc2={"wave": "pulse", "level": 0.6, "fine": 7}, sub={"level": 0.3}, filt={"model": "ladder24", "cutoff": 1500, "res": 0.5}, drift=1.5)
    ev8 = [e for n in (48, 52, 55, 59, 60, 64, 67, 71) for e in note(n, 0.0)]
    for model in ("ladder24", "valve12", "diode18", "sk12", "poly24", "svf12", "lpg"):
        big["filt"]["model"] = model
        cpu9(f"{model}, 8 voices", big, ev8)
    big["filt"]["model"] = "valve12"; big["filt"]["offset"] = 0.5
    cpu9("valve12 with stereo offset (two filters per voice), 8 voices", big, ev8)
    big["filt"]["offset"] = 0
    for rt in ("serial", "parallel", "split"):
        big["filtB"] = {"route": rt, "model": "ladder24", "cutoff": 900, "res": 0.5}
        cpu9(f"valve12 with filter B {rt} on Ladder 24, 8 voices", big, ev8)
    big.pop("filtB")
    big["voice"] = {"unison": 2, "count": 8}; big["ens"] = {"on": True, "mode": "strings", "mix": 50}
    cpu9("valve12, 8 notes x unison 2 = 16 voices, ensemble on", big, ev8)
    big["voice"] = {"unison": 1, "count": 8}; big["ens"] = {"on": False}
    big["mod"] = {"s1": {"src": "lfo1", "dst": "cut", "amt": 0.2}, "s2": {"src": "envF", "dst": "cut", "amt": 0.4}, "s3": {"src": "vel", "dst": "res", "amt": 0.3}, "s4": {"src": "lfo2", "dst": "pan", "amt": 0.5},
                  "s5": {"src": "envA", "dst": "drive", "amt": 0.3}, "s6": {"src": "key", "dst": "pw", "amt": 0.5}, "s7": {"src": "rand", "dst": "pitch2", "amt": 0.02}, "s8": {"src": "wheel", "dst": "amp", "amt": -0.5}}
    cpu9("valve12, 8 voices, mod matrix with all 8 slots on", big, ev8)
    big.pop("mod")
    # the EQ case adds the EQ to the same output stage (until 28 Oct it replaced `out`, so the room and the
    # default output tube came back on and the line timed them as well as the EQ)
    big["voice"] = {"unison": 1, "count": 8}; big["ens"] = {"on": False}; big["out"] = dict(big["out"], eqOn=True, eqBands=31, eqGains=[3, -3] * 15 + [3])
    cpu9("valve12, 8 voices, graphic EQ on at 31 bands", big, ev8)
    ck("9. the CPU page: no page errors", not cperr, cperr)
    cpx.close()
    if pg_was == "running": pg.evaluate("() => __synth.engine().ctx.resume()")

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
    # The worklet meters come back about 30 times a second, and in headless Chrome the round trip from a
    # note off to a meter without the note measured 28 to 235 ms on origin/main (28 Oct; 12 keyups each,
    # page idle): a fixed 90 ms wait read a released note as still held ("releasing the key after Ctrl
    # lets go" failed once that way). So quiet() waits up to 1.5 s for the released state; a note that is
    # really stuck never clears, so it still fails.
    def is_quiet(g): return g["down"] == [] and g["keys"] == 0 and g["notes"]["filament"] == [] and g["notes"]["cathode"] == [] and not g["sustain"]
    def quiet(label):
        g = gates(); t_ = 0
        while not is_quiet(g) and t_ < 1500: g = gates(); t_ += 90
        ck(label, is_quiet(g), g)
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
    pg.click('.chip[data-v="diode18"]')
    ck("model chip switches to Diode 18 and hides the Valve-only loop tube row", pg.evaluate("__synth.patch().filt.model") == "diode18" and not pg.is_visible("#loopChips"))
    ck("the filter note names Diode 18", "Diode 18" in pg.inner_text("#filtNote"), pg.inner_text("#filtNote"))
    bb = pg.query_selector('#mFilt .chip[data-v="diode18"]').bounding_box()
    ck(f"the Diode 18 chip is on screen and sits on one row with the others ({bb['height']:.0f} px tall)", bb["width"] > 0 and abs(bb["y"] - pg.query_selector('#mFilt .chip[data-v="valve12"]').bounding_box()["y"]) < 2, bb)
    ck("Diode 18 hides the Sallen-Key high-pass knob", pg.query_selector('#kFilt [data-path="filt.hp"]') is not None and not pg.is_visible('#kFilt [data-path="filt.hp"]'))
    pg.click('.chip[data-v="sk12"]')
    ck("model chip switches to Sallen-Key 12, shows its high-pass knob and hides the loop tube row",
       pg.evaluate("__synth.patch().filt.model") == "sk12" and pg.is_visible('#kFilt [data-path="filt.hp"]') and not pg.is_visible("#loopChips"))
    ck("the filter note names Sallen-Key 12", "Sallen-Key 12" in pg.inner_text("#filtNote"), pg.inner_text("#filtNote"))
    pg.click('.chip[data-v="valve12"]')
    ck("Valve 12 hides the high-pass knob again", not pg.is_visible('#kFilt [data-path="filt.hp"]'))
    pg.click('.chip[data-v="poly24"]')
    ck("model chip switches to Poly 24, which hides the loop tube row and the high-pass knob",
       pg.evaluate("__synth.patch().filt.model") == "poly24" and not pg.is_visible("#loopChips") and not pg.is_visible('#kFilt [data-path="filt.hp"]'))
    ck("the filter note names Poly 24", "Poly 24" in pg.inner_text("#filtNote"), pg.inner_text("#filtNote"))
    ck("Poly 24 hides the SVF 12 morph knob", pg.query_selector('#kFilt [data-path="filt.morph"]') is not None and not pg.is_visible('#kFilt [data-path="filt.morph"]'))
    pg.click('.chip[data-v="svf12"]')
    ck("model chip switches to SVF 12, which shows its morph knob and hides the loop tube row and the high-pass knob",
       pg.evaluate("__synth.patch().filt.model") == "svf12" and pg.is_visible('#kFilt [data-path="filt.morph"]') and not pg.is_visible("#loopChips") and not pg.is_visible('#kFilt [data-path="filt.hp"]'))
    ck("the filter note names SVF 12 and its four modes", all(w in pg.inner_text("#filtNote") for w in ("SVF 12", "low-pass", "band-pass", "high-pass", "notch")), pg.inner_text("#filtNote"))
    mk = pg.query_selector('#kFilt [data-path="filt.morph"]'); mk.focus(); pg.keyboard.press("End"); pg.wait_for_timeout(80)
    mv = pg.evaluate("__synth.patch().filt.morph"); mt = mk.inner_text()
    ck(f"the morph knob goes to notch from the keyboard and says so ({mv}, '{mt.strip()}')", mv == 3 and "notch" in mt, (mv, mt))
    pg.keyboard.press("Home"); pg.wait_for_timeout(80)
    ck("Home takes morph back to low-pass", pg.evaluate("__synth.patch().filt.morph") == 0 and "LP" in mk.inner_text(), mk.inner_text())
    bb = pg.query_selector('#mFilt .chip[data-v="svf12"]').bounding_box()
    ck(f"the SVF 12 chip is on screen ({bb['width']:.0f} x {bb['height']:.0f} px)", bb["width"] > 0 and bb["height"] > 0, bb)
    ck("SVF 12 hides the gate row and the lag knob", not pg.is_visible("#gateChips") and not pg.is_visible('#kFilt [data-path="filt.lag"]'))
    pg.click('#mFilt .chip[data-v="lpg"]')
    ck("model chip switches to the low pass gate, which shows its gate row and lag knob and hides the morph knob, the loop tube row and the high-pass knob",
       pg.evaluate("__synth.patch().filt.model") == "lpg" and pg.is_visible("#gateChips") and pg.is_visible('#kFilt [data-path="filt.lag"]')
       and not pg.is_visible('#kFilt [data-path="filt.morph"]') and not pg.is_visible("#loopChips") and not pg.is_visible('#kFilt [data-path="filt.hp"]'))
    ck("the filter note names the low pass gate, the light cell and lag, and no trademark", all(w in pg.inner_text("#filtNote") for w in ("Low pass gate", "light cell", "Lag")) and "vactrol" not in pg.inner_text("#filtNote").lower(), pg.inner_text("#filtNote"))
    gch = pg.evaluate("""() => [...document.querySelectorAll('#gateChips .chip')].map(b => b.dataset.v + ':' + b.textContent + ':' + b.getAttribute('aria-pressed'))""")
    ck(f"the gate row offers filter + VCA (lit), filter only and VCA only ({gch})", gch == ["both:filter + VCA:true", "lp:filter only:false", "vca:VCA only:false"], gch)
    pg.click('#gateChips .chip[data-v="vca"]'); pg.wait_for_timeout(60)
    ck("a gate chip sets filt.gate", pg.evaluate("__synth.patch().filt.gate") == "vca" and pg.get_attribute('#gateChips .chip[data-v="vca"]', "aria-pressed") == "true")
    pg.click('#gateChips .chip[data-v="both"]')
    lk = pg.query_selector('#kFilt [data-path="filt.lag"]'); lk.focus(); pg.keyboard.press("End"); pg.wait_for_timeout(80)
    lv_, lt_ = pg.evaluate("__synth.patch().filt.lag"), lk.inner_text()
    ck(f"the lag knob goes to 3 s from the keyboard and says so ({lv_}, '{lt_.strip()}')", abs(lv_ - 3) < 1e-6 and "3.00s" in lt_, (lv_, lt_))
    pg.keyboard.press("Home"); pg.wait_for_timeout(80)
    ck("Home takes lag to 20 ms", abs(pg.evaluate("__synth.patch().filt.lag") - 0.02) < 1e-6 and "20ms" in lk.inner_text(), lk.inner_text())
    bb = pg.query_selector('#mFilt .chip[data-v="lpg"]').bounding_box()
    ck(f"the LP gate chip is on screen ({bb['width']:.0f} x {bb['height']:.0f} px)", bb["width"] > 0 and bb["height"] > 0, bb)
    bb = pg.query_selector('#mFilt .chip[data-v="poly24"]').bounding_box()
    ck(f"the Poly 24 chip is on screen ({bb['width']:.0f} x {bb['height']:.0f} px)", bb["width"] > 0 and bb["height"] > 0, bb)
    pg.click('.chip[data-v="valve12"]')
    pg.click('#mFilt .chip[data-v="EL34"]'); ck("loop tube chip sets V2 and the chassis label", pg.evaluate("__synth.patch().filt.tube") == "EL34" and pg.inner_text("#nameV2") == "EL34")
    # filter slot B (27 Oct): the Filter B section on the Filter tab
    rch = pg.evaluate("""() => [...document.querySelectorAll('#routeChips .chip')].map(b => b.dataset.v + ':' + b.textContent + ':' + b.getAttribute('aria-pressed'))""")
    bmc = pg.evaluate("""() => [...document.querySelectorAll('#filtBModel .chip')].map(b => b.dataset.v)""")
    ck(f"Fb. the Filter B section offers A only (lit), serial, parallel and split, and B's six models without the low pass gate; its pilot is dark ({rch}; {bmc})",
       rch == ["off:A only:true", "serial:serial A > B:false", "parallel:parallel:false", "split:split L/R:false"] and bmc == ["valve12", "ladder24", "diode18", "sk12", "poly24", "svf12"]
       and pg.evaluate("document.getElementById('filtBPilot').classList.contains('off')") and pg.is_visible("#mFiltB"), (rch, bmc))
    pg.click('#routeChips .chip[data-v="serial"]'); pg.wait_for_timeout(60)
    ck("Fb. the serial chip sets filtB.route, lights the pilot and says what serial does",
       pg.evaluate("__synth.patch().filtB.route") == "serial" and not pg.evaluate("document.getElementById('filtBPilot').classList.contains('off')") and "Serial" in pg.inner_text("#filtBNote"), pg.inner_text("#filtBNote"))
    ck("Fb. B on SVF 12 shows its morph knob; the balance knob shows only in parallel",
       pg.is_visible('#kFiltB [data-path="filtB.morph"]') and not pg.is_visible('#kFiltB [data-path="filtB.bal"]'))
    pg.click('#filtBModel .chip[data-v="ladder24"]'); pg.click('#routeChips .chip[data-v="parallel"]'); pg.wait_for_timeout(60)
    ck("Fb. B on Ladder 24 hides the morph knob; parallel shows the balance knob and its note",
       pg.evaluate("__synth.patch().filtB.model") == "ladder24" and not pg.is_visible('#kFiltB [data-path="filtB.morph"]') and pg.is_visible('#kFiltB [data-path="filtB.bal"]') and "Parallel" in pg.inner_text("#filtBNote"))
    pg.click('#mFilt .chip[data-v="ladder24"]'); pg.click('#filtBModel .chip[data-v="valve12"]'); pg.wait_for_timeout(60)
    ck("Fb. the loop tube row shows when B is on Valve 12 even with A on Ladder 24", pg.is_visible("#loopChips"))
    pg.click('#filtBModel .chip[data-v="svf12"]'); pg.wait_for_timeout(60)
    ck("Fb. and hides again when neither slot is on Valve 12", not pg.is_visible("#loopChips"))
    pg.click('#routeChips .chip[data-v="split"]'); pg.wait_for_timeout(60)
    bk = pg.query_selector('#kFiltB [data-path="filtB.cutoff"]'); bk.focus(); pg.keyboard.press("Home"); pg.wait_for_timeout(80)
    ck(f"Fb. B's cutoff knob goes to 20 Hz from the keyboard ({pg.evaluate('__synth.patch().filtB.cutoff')})", abs(pg.evaluate("__synth.patch().filtB.cutoff") - 20) < 1e-6)
    sp_ = dec(pg.evaluate("a => __synth.render(a)", {"events": note(57, 0.0, 0.8), "seconds": 1.0, "rack": False}))
    sl_l, sl_r = float(np.sqrt(np.mean(sp_[0][SR // 4:] ** 2))), float(np.sqrt(np.mean(sp_[1][SR // 4:] ** 2)))
    ck(f"Fb. the panel's split reaches the engine: with B's cutoff at 20 Hz the right side is far quieter than the left ({db(sl_l):.1f} / {db(sl_r):.1f} dBFS, want 20 dB apart)", db(sl_l) - db(sl_r) >= 20, (db(sl_l), db(sl_r)))
    pg.keyboard.press("End"); pg.wait_for_timeout(60)
    pg.click('#routeChips .chip[data-v="off"]'); pg.click('#mFilt .chip[data-v="valve12"]'); pg.wait_for_timeout(60)
    ck("Fb. A only turns slot B off again and dims its controls", pg.evaluate("__synth.patch().filtB.route") == "off" and pg.evaluate("document.getElementById('filtBPilot').classList.contains('off')")
       and pg.evaluate("""getComputedStyle(document.querySelector('#kFiltB [data-path="filtB.cutoff"]')).opacity""") == "0.45")
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

    def peak_at(x, sr):
        x = np.asarray(x, np.float64)
        if len(x) < 64 or not sr: return 0.0
        x = x - np.mean(x)
        n = len(x)
        X = np.abs(np.fft.rfft(x * np.hanning(n)))
        f = np.fft.rfftfreq(n, 1.0 / float(sr))
        lo = int(np.searchsorted(f, 30))
        if lo >= len(X) - 1: return 0.0
        i = lo + int(np.argmax(X[lo:]))
        return float(f[i])

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
    wav_label = {"filament": "Filament", "cathode": "Cathode", "thyratron": "Thyratron", "gleam": "Gleam", "dekatron": "Dekatron", "lattice": "Lattice", "mote": "Mote", "heptode": "Heptode", "geissler": "Geissler", "pentagrid": "Pentagrid", "orthicon": "Orthicon", "trochotron": "Trochotron", "gyrotron": "Gyrotron", "klystron": "Klystron", "phantastron": "Phantastron", "additron": "Additron", "rhumbatron": "Rhumbatron", "resnatron": "Resnatron"}.get(pg.evaluate("__synth.device()"), "Filament")
    ck(f"M. render button downloads a WAV ({dl.suggested_filename}, {len(dl_bytes)} bytes)",
       bool(_re2.fullmatch(wav_label + r"-\d{8}-\d{6}\.wav", dl.suggested_filename)) and dl_info and dl_info["rate"] == 44100 and dl_info["bits"] == 24 and len(dl_info["data"]) == 44100 * 6, dl.suggested_filename)
    live_sr = int(pg.evaluate("() => __synth.engine().ctx.sampleRate"))
    pg.evaluate("__synth.noteOn(60, 0.8)")
    pg.evaluate("() => __synth.recordStart()")
    pg.wait_for_timeout(700)
    pg.evaluate("__synth.noteOff(60)")
    rec = pg.evaluate("() => __synth.recordStop()")
    rec_raw = base64.b64decode(rec["b64"]) if rec and rec.get("b64") else b""
    rec_info = parse_wav(rec_raw) if rec_raw else None
    rec_rms = rms(pcm24(rec_info["data"])[0]) if rec_info and len(rec_info["data"]) >= 6 else 0
    ck(f"M. live recording is a non-silent 24-bit WAV at the context rate ({rec['frames'] if rec else 0} frames, {db(rec_rms):.1f} dB, {live_sr} Hz)",
       rec_info and rec_info["fmt"] == 1 and rec_info["rate"] == live_sr and rec["sr"] == live_sr and rec_info["bits"] == 24 and rec_info["ch"] == 2
       and rec["frames"] > live_sr * 0.3 and rec_rms > 1e-3
       and bool(_re2.fullmatch(wav_label + r"-\d{8}-\d{6}\.wav", rec.get("name") or "")), (rec["frames"] if rec else None, rec.get("sr") if rec else None, rec.get("name") if rec else None))
    # A 48 kHz context must not be written as 44.1 kHz. That was the pitch error:
    # the file played slow because the header did not match the samples.
    native = pg.evaluate("""async () => {
      const { makeMasterFx } = await import('./masterfx.js');
      const { encodeWav24 } = await import('./wav.js');
      const ctx = new AudioContext({ sampleRate: 48000 });
      await ctx.resume();
      const fx = await makeMasterFx(ctx, null);
      const oscL = ctx.createOscillator(); oscL.type = 'sine'; oscL.frequency.value = 440;
      const oscR = ctx.createOscillator(); oscR.type = 'sine'; oscR.frequency.value = 660;
      const merge = ctx.createChannelMerger(2);
      const gL = ctx.createGain(); gL.gain.value = 0.45;
      const gR = ctx.createGain(); gR.gain.value = 0.45;
      oscL.connect(gL); oscR.connect(gR);
      gL.connect(merge, 0, 0); gR.connect(merge, 0, 1);
      fx.install(merge, ctx.destination);
      oscL.start(); oscR.start();
      fx.recordStart();
      await new Promise(r => setTimeout(r, 450));
      const samples = await fx.recordStop();
      oscL.stop(); oscR.stop();
      const bytes = encodeWav24(samples.L, samples.R, samples.sampleRate);
      const start = Math.min(2000, samples.L.length);
      const take = Math.min(8192, samples.L.length - start);
      let rs = 0;
      for (let i = 0; i < samples.R.length; i++) rs += samples.R[i] * samples.R[i];
      return {
        ctxRate: ctx.sampleRate, sampleRate: samples.sampleRate, n: samples.L.length,
        header: bytes[24] | (bytes[25] << 8) | (bytes[26] << 16) | (bytes[27] << 24),
        L: Array.from(samples.L.subarray(start, start + take)),
        R: Array.from(samples.R.subarray(start, start + take)),
        rrms: Math.sqrt(rs / Math.max(1, samples.R.length)),
      };
    }""")
    nL = np.asarray(native["L"], np.float64); nR = np.asarray(native["R"], np.float64)
    fL, fR = peak_at(nL, native["sampleRate"]), peak_at(nR, native["sampleRate"])
    ck(f"M. 48 kHz master records both channels at 48 kHz ({fL:.1f} Hz / {fR:.1f} Hz)",
       native["ctxRate"] == 48000 and native["sampleRate"] == 48000 and native["header"] == 48000
       and native["n"] > 48000 * 0.3 and native["rrms"] > 0.05
       and abs(fL - 440) < 4 and abs(fR - 660) < 4,
       (native["header"], native["n"], round(fL, 2), round(fR, 2), round(native["rrms"], 4)))
    pg.evaluate("""() => __synth.setMaster({tempo:120, delay:{on:false}, reverb:{on:false}, comp:{on:false}})""")

    # The header rec button is on every device. Stopping it downloads the same 24-bit master WAV.
    DEVICES = ("filament", "cathode", "thyratron", "gleam", "dekatron", "lattice", "mote", "heptode", "geissler", "pentagrid", "orthicon", "trochotron", "gyrotron", "klystron", "phantastron", "additron", "rhumbatron", "resnatron")
    WAV_LABEL = {"filament": "Filament", "cathode": "Cathode", "thyratron": "Thyratron", "gleam": "Gleam", "dekatron": "Dekatron", "lattice": "Lattice", "mote": "Mote", "heptode": "Heptode", "geissler": "Geissler", "pentagrid": "Pentagrid", "orthicon": "Orthicon", "trochotron": "Trochotron", "gyrotron": "Gyrotron", "klystron": "Klystron", "phantastron": "Phantastron", "additron": "Additron", "rhumbatron": "Rhumbatron", "resnatron": "Resnatron"}
    for dev in DEVICES:
        pg.evaluate("(d) => __synth.setDevice(d)", dev)
        pg.wait_for_timeout(250)
        shown = pg.evaluate("""() => {
          const box = id => { const el = document.getElementById(id); if (!el || !el.offsetParent) return null; const r = el.getBoundingClientRect(); return r.width > 8 && r.height > 8; };
          return box('mastRec') && box('trRec') && box('mMaster') && box('fxRec') && box('wavGo') && box('fxRev');
        }""")
        ck(f"M. {dev}: rec is visible, and the Master panel is on the page", shown)
        if pg.evaluate("() => document.getElementById('fxRec').getAttribute('aria-pressed')") == "true":
            pg.evaluate("() => __synth.recordStop()")
            pg.wait_for_timeout(300)
        pg.evaluate("__synth.noteOn(60, 0.85)")
        pg.click("#mastRec")
        pg.wait_for_function("""() => ['mastRec','trRec','fxRec'].every(id => document.getElementById(id).getAttribute('aria-pressed')==='true')""", timeout=8000)
        pg.wait_for_timeout(550)
        synced = pg.evaluate("""() => ['mastRec','trRec','fxRec'].every(id => document.getElementById(id).getAttribute('aria-pressed')==='true') && /\\d/.test(document.getElementById('mastTime').textContent || '') && document.getElementById('mastTime').textContent === document.getElementById('trTime').textContent""")
        ck(f"M. {dev}: the rec buttons stay in sync and show elapsed time", synced, pg.evaluate("() => [document.getElementById('mastTime').textContent, document.getElementById('trTime').textContent, document.getElementById('fxRec').textContent]"))
        with pg.expect_download(timeout=20000) as di:
            pg.click("#mastRec")
        pg.evaluate("__synth.noteOff(60)")
        dl = di.value
        raw_dl = open(dl.path(), "rb").read()
        info_dl = parse_wav(raw_dl)
        ck(f"M. {dev}: recording downloads a non-empty 24-bit WAV ({dl.suggested_filename}, {len(raw_dl)} bytes)",
           bool(_re2.fullmatch(WAV_LABEL[dev] + r"-\d{8}-\d{6}\.wav", dl.suggested_filename)) and info_dl and info_dl["fmt"] == 1 and info_dl["bits"] == 24 and info_dl["ch"] == 2 and info_dl["rate"] == live_sr and len(info_dl["data"]) > 0,
           (dl.suggested_filename, len(raw_dl), None if not info_dl else {k: info_dl[k] for k in ("fmt", "bits", "ch", "rate")}))
        pg.wait_for_function("() => document.getElementById('mastRec').getAttribute('aria-pressed')==='false' && document.getElementById('fxRec').textContent==='record'", timeout=8000)
    # Each device, played as a known tone, must land in the WAV at the same
    # pitch and level the chain is sending to the speakers.
    def arm_listen():
        pg.evaluate("""() => {
          const E = __synth.engine();
          if (window.__recAn) return;
          const split = E.ctx.createChannelSplitter(2);
          const aL = E.ctx.createAnalyser(); const aR = E.ctx.createAnalyser();
          aL.fftSize = aR.fftSize = 4096;
          E.C.out.connect(split);
          split.connect(aL, 0); split.connect(aR, 1);
          window.__recAn = { aL, aR, bL: new Float32Array(4096), bR: new Float32Array(4096) };
        }""")
    def listen():
        return pg.evaluate("""() => {
          const a = window.__recAn;
          a.aL.getFloatTimeDomainData(a.bL);
          a.aR.getFloatTimeDomainData(a.bR);
          const rms = b => { let s = 0; for (let i = 0; i < b.length; i++) s += b[i] * b[i]; return Math.sqrt(s / b.length); };
          return { sr: __synth.engine().ctx.sampleRate, rmsL: rms(a.bL), rmsR: rms(a.bR), L: Array.from(a.bL) };
        }""")
    quiet = {"ens": {"on": False}, "out": {"tube": "12AU7", "topology": "se", "drive": 0, "bias": 0, "sag": 0, "spkOn": False, "roomOn": False, "wOn": False}}
    tones = [
        ("filament", 69, 440, dict(device="filament", osc1={"wave": "sine", "level": 0.85, "fixed": 440}, osc2={"level": 0}, sub={"level": 0}, noise={"level": 0},
            envA={"a": 0.005, "d": 0.02, "s": 1, "r": 0.05}, filt={"cutoff": 18000, "res": 0, "model": "ladder24"}, v1={"drive": 0}, drift=0,
            voice={"level": 0.8}, stereo={"pan": "center", "spread": 0}, **quiet)),
        ("cathode", 69, 440, dict(device="cathode", vco1={"wave": "tri", "scale": 8, "level": 0.8}, vco2={"level": 0}, **quiet)),
        ("thyratron", 69, 440, dict(device="thyratron", osc1={"wave": "tri", "range": "8", "tune": 0, "level": 0.85}, osc2={"level": 0}, osc3={"level": 0}, **quiet)),
        ("lattice", 69, 440, dict(device="lattice", osc1={"table": "edge", "pos": 0, "oct": 0, "level": 0.9}, osc2={"level": 0},
            filt={"route": "serial", "a": {"mode": "lp", "cutoff": 18000, "res": 0, "env": 0}, "b": {"mode": "lp", "cutoff": 18000, "res": 0, "env": 0}}, **quiet)),
        ("gleam", 69, 440, dict(device="gleam", color=1, space=0, reverb=0, drift=0, glide=0, level=0.9, stutter=False)),
        ("dekatron", 65, 220, dict(device="dekatron", level=1,
            voices={"tom": {"tune": 220, "decay": 0.7, "color": 0, "attack": 0, "level": 1, "pan": 0},
                    "kick": {"level": 0}, "snare": {"level": 0}, "hatC": {"level": 0}, "hatO": {"level": 0}, "clap": {"level": 0}, "rim": {"level": 0}},
            steps={k: [0] * 16 for k in ("kick", "snare", "hatC", "hatO", "clap", "tom", "rim")}, **quiet)),
        ("pentagrid", 69, 440, dict(device="pentagrid", tune=8500, bfo=700, bandwidth=400, air=0, noise=0, crackle=0, fade=0, agc=0, blanker=0, text="", play=True, mode="cw", level=0.9, cond=1)),
        ("mote", None, 440, dict(device="mote", level=1,
            grain={"size": 90, "density": 36, "position": 0.25, "spray": 0, "pitch": 0, "pitchRand": 0, "reverse": 0, "window": "hann", "spread": 0, "freeze": True, "keyboard": False},
            lfo={"depth": 0, "rate": 0.1, "dest": "position"},
            tail={"delay": 0.2, "feedback": 0.2, "reverb": 0, "mix": 0.15}, **quiet)),
        ("orthicon", None, 440, dict(device="orthicon", picture="custom", keyboard=False, hold=True, engine="add",
            phase="coherent", width=0, level=1, curve=1, speed=2, loop=True, scale="off", fLo=80, fHi=8000, **quiet)),
        ("additron", 69, 440, dict(device="additron", level=0.9, shape="hand", morph=0, edit="a",
            draw=[0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            drawB=[0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            rotor=False, click=0, perc=0, percHarm="off", tilt=0, vib=0, drive=0, leak=0, spread=0,
            attack=0.005, decay=0.2, sustain=1, release=0.05, **quiet)),
        ("rhumbatron", 69, 440, dict(device="rhumbatron", body="string", exciter="bow", material=0.9, size=1,
            damping=0.15, position=0.22, place=0.5, coupling=0, pressure=0.35, level=0.8)),
    ]
    for dev, midi_note, expect, body in tones:
        pg.evaluate("__synth.panic()")
        pg.evaluate("(p) => __synth.setPatch(p)", body)
        pg.wait_for_timeout(280)
        if dev == "mote":
            pg.evaluate("() => __synth.moteCaptureProbe(0.2, 440)")
            pg.wait_for_timeout(80)
        if dev == "orthicon":
            pg.evaluate("""async () => { const c = __synth.engine().ctx; if (c.state !== 'running') await c.resume(); return __synth.orthiconPaintLive(440); }""")
            pg.wait_for_timeout(120)
        arm_listen()
        if midi_note is not None:
            pg.evaluate("(n) => __synth.noteOn(n, 0.9)", midi_note)
        pg.wait_for_timeout(220 if dev != "dekatron" else 40)
        pg.evaluate("() => __synth.recordStart()")
        pg.wait_for_timeout(90 if dev == "dekatron" else 180)
        live = listen()
        pg.wait_for_timeout(420 if dev != "dekatron" else 280)
        got = pg.evaluate("() => __synth.recordStop()")
        if midi_note is not None:
            pg.evaluate("(n) => __synth.noteOff(n)", midi_note)
        raw_g = base64.b64decode(got["b64"]) if got and got.get("b64") else b""
        info_g = parse_wav(raw_g) if raw_g else None
        if not info_g:
            ck(f"M. {dev}: recorded tone matches the live output", False, "no wav")
            continue
        gL, gR = pcm24(info_g["data"])
        a0 = min(len(gL) // 5, max(0, len(gL) - 64))
        seg = gL[a0:a0 + min(8192, len(gL) - a0)]
        wf, lf = peak_at(seg, info_g["rate"]), peak_at(live["L"], live["sr"])
        wr, lr = rms(seg), float(live["rmsL"] or 0)
        ratio = wr / lr if lr > 1e-6 else 0
        freq_ok = abs(wf - expect) < (20 if dev == "dekatron" else 12) and abs(wf - lf) < (24 if dev == "dekatron" else 12)
        level_ok = wr > 1e-3 and lr > 1e-3 and (0.55 < ratio < 1.8 if dev == "dekatron" else 0.72 < ratio < 1.35)
        both = rms(gR[a0:a0 + len(seg)]) > 1e-4 if dev != "dekatron" else True
        ck(f"M. {dev}: recorded {wf:.1f} Hz matches live {lf:.1f} Hz (expect {expect}, level x{ratio:.2f})",
           info_g["rate"] == live_sr and freq_ok and level_ok and both,
           (info_g["rate"], round(wf, 2), round(lf, 2), round(wr, 4), round(lr, 4), round(ratio, 3), pg.evaluate("__synth.pentaSent()") if dev == "pentagrid" else ""))

    # A held note on the rail's device must survive the rest of the rack attaching, and a generator
    # (Geissler, Gyrotron) ending its notes on that device must not put it to sleep. Both used to
    # send it 'active: false', which panics it: the cause of "M. pentagrid" failing now and then.
    PG_TONE = dict(device="pentagrid", tune=8500, bfo=700, bandwidth=400, air=0, noise=0, crackle=0, fade=0, agc=0, blanker=0, text="", play=True, mode="cw", level=0.9, cond=1)
    OUT_RMS = """() => { const E = __synth.engine(); if (!window.__outAn) { const a = E.ctx.createAnalyser(); a.fftSize = 4096; E.C.out.connect(a); window.__outAn = { a, b: new Float32Array(4096) }; }
      const x = window.__outAn; x.a.getFloatTimeDomainData(x.b); let q = 0; for (const v of x.b) q += v * v; return Math.sqrt(q / x.b.length); }"""
    bctx = b.new_context(viewport={"width": 1366, "height": 1000}, service_workers="block")
    # Hold back the last device's worklet (Resnatron's addModule waits for __releaseBoot), so the
    # chain of attaches is still running when the note goes down.
    bctx.add_init_script("""(() => { const am = AudioWorklet.prototype.addModule; let rel; const hold = new Promise(r => { rel = r; });
      window.__releaseBoot = () => rel();
      AudioWorklet.prototype.addModule = function (url, o) { return String(url).includes('resnatron.worklet') ? hold.then(() => am.call(this, url, o)) : am.call(this, url, o); }; })()""")
    bp = bctx.new_page(); berr = []
    bp.on("pageerror", lambda e: berr.append(str(e)))
    bp.goto(BASE); bp.wait_for_function("window.__synth && __synth.ready()", timeout=30000)
    early = bp.evaluate("__synth.booted()")
    bp.evaluate(OUT_RMS)    # the analyser needs a moment of audio before it reads anything
    bp.evaluate("(p) => __synth.setPatch(p)", PG_TONE); bp.wait_for_timeout(300)
    bp.evaluate("async () => { const c = __synth.engine().ctx; if (c.state !== 'running') await c.resume(); }")
    bp.evaluate("(n) => __synth.noteOn(n, 0.9)", 69); bp.wait_for_timeout(300)
    before = bp.evaluate(OUT_RMS)
    bp.evaluate("window.__releaseBoot()")
    bp.wait_for_function("__synth.booted()", timeout=30000); bp.wait_for_timeout(350)
    after = bp.evaluate(OUT_RMS)
    bp.evaluate("(n) => __synth.noteOff(n)", 69)
    ck(f"M. a note held on Pentagrid while the rack is still attaching keeps sounding when it finishes (booted at note-on: {early}; output {before:.3f} -> {after:.3f}, want 0.02 or more after)",
       early is False and before > 0.02 and after > 0.02 and not berr, (early, before, after, berr))
    bctx.close()
    pg.evaluate("__synth.panic()"); pg.evaluate(OUT_RMS)
    pg.evaluate("(p) => __synth.setPatch(p)", PG_TONE); pg.wait_for_timeout(300)
    pg.evaluate("(n) => __synth.noteOn(n, 0.9)", 69); pg.wait_for_timeout(250)
    before = pg.evaluate(OUT_RMS)
    pg.evaluate("() => { __synth.routeWaker('pentagrid', true); __synth.routeWaker('pentagrid', false); }"); pg.wait_for_timeout(300)
    after = pg.evaluate(OUT_RMS)
    pg.evaluate("(n) => __synth.noteOff(n)", 69)
    ck(f"M. a generator's notes ending on Pentagrid do not put it to sleep while it is on the rail (output {before:.3f} -> {after:.3f}, want 0.02 or more after)",
       before > 0.02 and after > 0.02, (before, after, pg.evaluate("__synth.pentaSent()")))

    # Mote freeze: stop spawning grains and the delay/reverb tail must still be in the file.
    pg.evaluate("__synth.panic()")
    pg.evaluate("(d) => __synth.setDevice('mote')", "mote")
    pg.wait_for_timeout(200)
    pg.evaluate("() => __synth.moteCaptureProbe(0.25, 440)")
    tail_on = {"device": "mote", "level": 1,
        "grain": {"size": 60, "density": 30, "position": 0.3, "spray": 0, "pitch": 0, "pitchRand": 0, "reverse": 0, "window": "hann", "spread": 0, "freeze": True, "keyboard": False},
        "lfo": {"depth": 0, "rate": 0.1, "dest": "position"},
        "tail": {"delay": 0.2, "feedback": 0.7, "reverb": 0.45, "mix": 0.85},
        "ens": {"on": False}, "out": {"drive": 0, "roomOn": False, "wOn": False, "spkOn": False, "topology": "se", "tube": "12AU7"}}
    pg.evaluate("(p) => __synth.setPatch(p)", tail_on)
    pg.wait_for_timeout(150)
    pg.evaluate("() => __synth.recordStart()")
    pg.wait_for_timeout(220)
    tail_off = dict(tail_on)
    tail_off["grain"] = dict(tail_on["grain"], keyboard=True, density=0.5)
    pg.evaluate("(p) => __synth.setPatch(p)", tail_off)
    pg.wait_for_timeout(520)
    tail_meter = pg.evaluate("__synth.moteMeter()")
    pg.wait_for_timeout(260)
    tail_rec = pg.evaluate("() => __synth.recordStop()")
    tail_raw = base64.b64decode(tail_rec["b64"]) if tail_rec and tail_rec.get("b64") else b""
    tail_info = parse_wav(tail_raw) if tail_raw else None
    if not tail_info:
        ck("M. Mote freeze delay tail is in the recording", False, "no wav")
    else:
        tL, tR = pcm24(tail_info["data"])
        tsr = tail_info["rate"]
        early = tL[int(0.05 * tsr):int(0.18 * tsr)]
        late = tL[int(0.48 * tsr):int(0.82 * tsr)] if len(tL) > int(0.82 * tsr) else tL[len(tL)//2:]
        late_r = tR[int(0.48 * tsr):int(0.82 * tsr)] if len(tR) > int(0.82 * tsr) else tR[len(tR)//2:]
        ef = peak_at(early, tsr) if len(early) > 64 else 0
        # The echo interval, measured on the tail after the grains have stopped.
        lag = 0.0
        if len(late) > int(0.28 * tsr):
            a = late - np.mean(late)
            corr = np.correlate(a, a, mode="full")
            corr = corr[len(corr)//2:]
            lo_i, hi_i = int(0.15 * tsr), min(len(corr) - 2, int(0.27 * tsr))
            best_v = -1.0
            for i in range(lo_i + 1, hi_i):
                if corr[i] >= corr[i - 1] and corr[i] >= corr[i + 1] and corr[i] > best_v:
                    best_v = float(corr[i])
                    lag = i / tsr
        grains_gone = (tail_meter.get("grains") or 0) == 0 and (tail_meter.get("voices") or 0) == 0
        ck(f"M. Mote freeze keeps {ef:.1f} Hz, and the delay tail is still in the file ({rms(late):.4f}, echo {lag:.3f} s)",
           tail_info["rate"] == live_sr and abs(ef - 440) < 15 and rms(early) > 1e-3
           and grains_gone and rms(late) > 1e-3 and rms(late_r) > 5e-4 and 0.15 < lag < 0.26,
           (round(ef, 2), round(rms(early), 4), round(rms(late), 4), round(lag, 3), tail_meter.get("grains"), tail_meter.get("voices"), len(tL)))
    # Leave Mote on its factory grain settings. The panel tests toggle freeze and keys from there.
    pg.evaluate("""() => __synth.setPatch({ device: 'mote', grain: { keyboard: false, freeze: true, density: 14 } })""")
    pg.evaluate("__synth.panic()")

    help_txt = pg.evaluate("""() => [...document.querySelectorAll('#mMoteStage .note, .intro[data-dev="mote"]')].map(n => n.textContent).join(' ')""")
    ck("Mo. help says Capture rack is an input, not an export", "Capture rack is an input, not an export" in help_txt, help_txt)
    pg.evaluate("__synth.panic()")
    pg.evaluate("__synth.setDevice('filament')")
    pg.wait_for_timeout(200)
    pg.evaluate("a => __synth.deck().importBytes(a, 'two.mid')", TWO)
    pg.evaluate("__synth.deck().play('file')")
    pg.wait_for_function("""() => __synth.deck().playing() && Object.keys(__synth.deck().sounding()).length >= 2""", timeout=5000)
    pg.click("#trRec")
    pg.wait_for_function("""() => document.getElementById('trRec').getAttribute('aria-pressed')==='true'""", timeout=8000)
    pg.wait_for_timeout(350)
    with pg.expect_download(timeout=20000) as di:
        pg.click("#trRec")
    rack_dl = di.value
    ck("M. several devices playing: the WAV is named rack",
       bool(_re2.fullmatch(r"rack-\d{8}-\d{6}\.wav", rack_dl.suggested_filename)) and len(open(rack_dl.path(), "rb").read()) > 44,
       rack_dl.suggested_filename)
    pg.evaluate("__synth.deck().stop()")
    pg.wait_for_timeout(200)

    ph = b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    ph.goto(BASE)
    ph.wait_for_function("window.__synth && __synth.ready()", timeout=20000)
    ph.wait_for_timeout(200)
    for dev in DEVICES:
        ph.evaluate("(d) => __synth.setDevice(d)", dev)
        ph.wait_for_timeout(220)
        vis = ph.evaluate("""() => {
          const b = document.getElementById('mastRec');
          const r = b.getBoundingClientRect();
          return !!(b.offsetParent && r.width >= 44 && r.height >= 44 && r.right <= innerWidth + 1);
        }""")
        ck(f"M. {dev} 390px: the header rec button is visible", vis, ph.evaluate("() => { const r = document.getElementById('mastRec').getBoundingClientRect(); return [r.width, r.height, r.right, innerWidth]; }"))
        ck(f"M. {dev} 390px: the rec control does not widen the page",
           ph.evaluate("document.documentElement.scrollWidth <= innerWidth && innerWidth === 390"),
           ph.evaluate("[document.documentElement.scrollWidth, innerWidth]"))
        ph.locator("#mastJump").tap()
        ph.wait_for_timeout(280)
        ck(f"M. {dev} 390px: Master (effects, record, render) opens from the header",
           ph.is_visible("#mMaster") and ph.is_visible("#fxRec") and ph.is_visible("#fxRev") and ph.is_visible("#wavGo")
           and ph.evaluate("document.body.dataset.tab") == "rack"
           and ph.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    ph.close()

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
        ck(f"10. {w}px: the Filter tab shows Filter B with its route chips", ph.is_visible("#mFiltB") and ph.is_visible('#routeChips .chip[data-v="split"]'))
        try: ph.wait_for_function("__synth.filterPlot().ready && __synth.filterPlot().painted > 5", timeout=8000); fpv = True
        except Exception as e_: fpv = False
        fpb = ph.query_selector("#fpCv").bounding_box()
        ck(f"10. {w}px: the Filter tab draws the response plot inside the screen, no horizontal scroll", fpv and fpb["x"] >= 0 and fpb["x"] + fpb["width"] <= w and fpb["height"] >= 100
           and ph.evaluate("document.documentElement.scrollWidth <= innerWidth"), (fpb, ph.evaluate("__synth.filterPlot()")))
        small = ph.evaluate("""() => [...document.querySelectorAll('.tabs button, .key.w, .btn, .chip')].filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map(e => e.id || e.textContent)""")
        ck(f"10. {w}px: touch targets are 44 px or more", not small, small)
        ck(f"10. {w}px: the Filter tab shows the Diode 18, Sallen-Key 12, Poly 24, SVF 12 and LP gate chips with no horizontal scroll",
           ph.is_visible('#mFilt .chip[data-v="diode18"]') and ph.is_visible('#mFilt .chip[data-v="sk12"]') and ph.is_visible('#mFilt .chip[data-v="poly24"]') and ph.is_visible('#mFilt .chip[data-v="svf12"]') and ph.is_visible('#mFilt .chip[data-v="lpg"]') and ph.evaluate("document.documentElement.scrollWidth <= innerWidth"))
        m0_ = ph.evaluate("__synth.patch().filt.model"); ph.click('#mFilt .chip[data-v="lpg"]'); ph.wait_for_timeout(60)
        gs_ = ph.evaluate("""() => [...document.querySelectorAll('#gateChips .chip, #kFilt [data-path="filt.lag"]')].filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })""")
        ck(f"10. {w}px: on the LP gate the gate chips and the lag knob show at 44 px or more, with no horizontal scroll ({gs_})",
           len(gs_) == 4 and all(a_ >= 44 and b_ >= 44 for a_, b_ in gs_) and ph.evaluate("document.documentElement.scrollWidth <= innerWidth"), gs_)
        ph.click(f'#mFilt .chip[data-v="{m0_}"]'); ph.wait_for_timeout(60)
        ph.click(".tabs [data-go=mod]"); ph.wait_for_timeout(150)
        mmv = ph.evaluate("""() => { const s = document.getElementById('mMatrix'), el = [...s.querySelectorAll('select, .knob')];
          return { vis: !!s.offsetParent, rows: s.querySelectorAll('.mmrow').length, n: el.length, small: el.filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).length,
            out: el.filter(e => { const r = e.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth; }).length, sw: document.documentElement.scrollWidth <= innerWidth }; }""")
        ck(f"10. {w}px: the Mod tab shows the mod matrix, eight rows of menus and knobs at 44 px or more inside the screen, with no horizontal scroll ({mmv})",
           mmv == {"vis": True, "rows": 8, "n": 24, "small": 0, "out": 0, "sw": True}, mmv)
        lsv = ph.evaluate("""() => ['lfo1Sync', 'lfo2Sync'].map(id => { const e = document.getElementById(id); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect();
          return { vis: !!e.offsetParent, w: Math.round(r.width), h: Math.round(r.height), inside: r.left >= 0 && r.right <= innerWidth }; }).concat([document.documentElement.scrollWidth <= innerWidth])""")
        ck(f"10. {w}px: the LFO sync menus are 44 px targets inside the screen, with no horizontal scroll ({lsv})",
           all(x["vis"] and x["w"] >= 44 and x["h"] >= 44 and x["inside"] for x in lsv[:2]) and lsv[2] is True, lsv)
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
        ph.locator("#mEq").scroll_into_view_if_needed()
        ck(f"10. {w}px: the Rack tab shows the graphic EQ, no horizontal scroll", ph.is_visible("#eqCv") and not ph.is_visible("#mOsc1")
           and ph.evaluate(f"document.documentElement.scrollWidth <= innerWidth && innerWidth === {w}"), ph.evaluate("[document.documentElement.scrollWidth, innerWidth]"))
        small = ph.evaluate("""() => [...document.querySelectorAll('#mEq .chip')].filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map(e => e.textContent)""")
        ck(f"10. {w}px: the EQ's chips are 44 px or more", not small, small)
        ph.locator('#eqPresetChips .chip[data-v="warm"]').tap(); ph.wait_for_timeout(150)
        cb = ph.query_selector("#eqCv").bounding_box()
        ph.touchscreen.tap(cb["x"] + 28 + (cb["width"] - 34) / 10 * 7.5, cb["y"] + 8 + 3); ph.wait_for_timeout(150)
        o = ph.evaluate("__synth.patch().out")
        ck(f"10. {w}px: a preset tap turns the EQ on; a tap on a fader sets it ({o['eqGains'][7]} dB at 4 kHz)", o["eqOn"] and o["eqGains"][7] >= 10 and o["eqPreset"] == "custom", o)
        ph.locator("#mEq").screenshot(path=os.path.join(SHOTS, f"synth_phone_{w}_eq.png"))
        ph.locator("#mShow").scroll_into_view_if_needed()
        small = ph.evaluate("""() => [...document.querySelectorAll('#showChips .chip')].filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map(e => e.textContent)""")
        vb = ph.evaluate("(() => { const r = document.getElementById('vLamps').getBoundingClientRect(), c = document.getElementById('chassis').getBoundingClientRect(); return [r.left, r.right, c.left, c.right, innerWidth]; })()")
        ck(f"10. {w}px: the tube show chips are 44 px or more and the voice lamps sit inside the chassis", ph.is_visible("#showChips") and not small and vb[0] >= vb[2] and vb[1] <= vb[3] <= vb[4]
           and ph.evaluate(f"document.documentElement.scrollWidth <= innerWidth && innerWidth === {w}"), (small, vb))
        ph.locator('.tabs [data-go="mix"]').scroll_into_view_if_needed(); ph.locator('.tabs [data-go="mix"]').tap(); ph.wait_for_timeout(180)
        ck(f"10. {w}px: the Mix tab is the desk, with letters, arms, meters and sends",
           ph.is_visible("#mHost") and ph.is_visible("#mixFArm") and ph.is_visible("#mixFMeter") and ph.is_visible("#mixFRev")
           and ph.is_visible("#mixCArm") and ph.is_visible("#mixKArm") and not ph.is_visible("#mFilt")
           and ph.evaluate("document.body.dataset.tab") == "mix"
           and ph.evaluate(f"document.documentElement.scrollWidth <= innerWidth && innerWidth === {w}"),
           ph.evaluate("[document.documentElement.scrollWidth, innerWidth]"))
        small = ph.evaluate("""() => [...document.querySelectorAll('#mHost .btn, #mHost .chip, #mHost input')].filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map(e => e.id || e.getAttribute('aria-label') || e.textContent)""")
        ck(f"10. {w}px: the mix desk controls are 44 px or more", not small, small)
        lay = ph.evaluate("""() => { const rows = [...document.querySelectorAll('#mHost .mixrow')].filter(r => r.offsetParent);
          const over = []; rows.forEach((r, i) => { const b = r.getBoundingClientRect();
            if ([...r.children].some(c => { const q = c.getBoundingClientRect(); return q.bottom > b.bottom + 1 || q.right > b.right + 1; })) over.push(r.dataset.mix + ' spills');
            if (i && b.top < rows[i - 1].getBoundingClientRect().bottom - 1) over.push(r.dataset.mix + ' overlaps'); });
          return { n: rows.length, over }; }""")
        ck(f"10. {w}px: the mix strips stack without overlap and keep their controls inside ({lay['n']} strips)", lay["n"] >= 18 and not lay["over"], lay)
        ph.locator("#mixFArm").scroll_into_view_if_needed(); ph.locator("#mixFArm").tap()
        ph.locator("#mixCArm").scroll_into_view_if_needed(); ph.locator("#mixCArm").tap(); ph.wait_for_timeout(80)
        armed = ph.evaluate("__synth.mixTargets()")
        ck(f"10. {w}px: arming two devices routes the keys to both", armed == ["filament", "cathode"], armed)
        ph.locator("#mixClear").scroll_into_view_if_needed(); ph.locator("#mixClear").tap(); ph.wait_for_timeout(40)
        ck(f"10. {w}px: clear arms sends the keys back to the lit device", ph.evaluate("__synth.mixTargets()") == ["filament"])
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

    # ---------------------------------------------------------------- Mo. Mote, the granular instrument
    def mote(patch, events=None, seconds=1.0, tone=None):
        payload = {"patch": patch, "events": events or [], "seconds": seconds}
        if tone: payload["tone"] = tone
        return dec(pg.evaluate("a => __synth.moteRender(a)", payload))
    def gpatch(**over):
        p = {"device": "mote", "level": 1, "source": "glass",
             "grain": {"size": 400, "density": 2, "position": 0.4, "spray": 0, "pitch": 0, "pitchRand": 0,
                       "reverse": 0, "window": "hann", "spread": 0, "freeze": True, "keyboard": False},
             "lfo": {"rate": 0.2, "depth": 0, "dest": "position"},
             "tail": {"delay": 0.2, "feedback": 0, "reverb": 0, "mix": 0}}
        for k, v in over.items():
            if isinstance(v, dict): p.setdefault(k, {}).update(v)
            else: p[k] = v
        return p
    devm = pg.evaluate("""() => { const d = __synth.moteDevice(); const n = d.normalize({ grain: { size: 9999 } }); return {
      id: d.id, api: d.api, inst: d.instrument, outs: d.audioOutputs, midi: d.midiInput, proc: d.processor, worklet: d.worklet,
      size: d.parameters['grain.size'] && d.parameters['grain.size'].type,
      freeze: d.parameters['grain.freeze'] && d.parameters['grain.freeze'].type,
      keys: d.parameters['grain.keyboard'] && d.parameters['grain.keyboard'].type,
      win: d.parameters['grain.window'] && d.parameters['grain.window'].type,
      dest: d.parameters['lfo.dest'] && d.parameters['lfo.dest'].type,
      src: d.parameters['source'] && d.parameters['source'].type,
      has: ['grain.density','grain.position','grain.spray','grain.pitch','grain.pitchRand','grain.reverse','grain.spread','lfo.rate','lfo.depth','tail.delay','tail.feedback','tail.reverb','tail.mix','level'].every(k => !!d.parameters[k]),
      clamped: n.grain.size
    }; }""")
    ck("Mo. adapter: dxrack/1, stereo out, MIDI in, grain parameters",
       devm["id"] == "mote" and devm["api"] == "dxrack/1" and devm["inst"] is True and devm["outs"] == 1 and devm["midi"]
       and devm["proc"] == "mote" and devm["worklet"] == "mote.worklet.js" and devm["size"] == "float"
       and devm["freeze"] == "boolean" and devm["keys"] == "boolean" and devm["win"] == "choice" and devm["dest"] == "choice"
       and devm["src"] == "choice" and devm["has"] and devm["clamped"] == 400, devm)
    tone = {"freq": 440, "seconds": 1.0, "amp": 0.7}
    L, R = mote(gpatch(), seconds=0.8, tone=tone)
    mid = L[len(L)//5:len(L)//5*4]
    f0 = peak_freq(mid)
    ck(f"Mo. a frozen grain of a 440 Hz buffer peaks at 440 ({f0:.1f} Hz)", abs(f0 - 440) < 12 and float(np.max(np.abs(L))) <= 1.0 and bool(np.all(np.isfinite(L))) and bool(np.all(np.isfinite(R))), f0)
    ck("Mo. spread 0 is identical left and right", float(np.max(np.abs(L - R))) < 1e-5, float(np.max(np.abs(L - R))))
    Lp, Rp = mote(gpatch(grain={"pitch": 12}), seconds=0.8, tone=tone)
    fp = peak_freq(Lp[len(Lp)//5:len(Lp)//5*4])
    ck(f"Mo. pitch +12 is an octave ({fp:.1f} Hz)", abs(fp - 880) < 15, fp)
    Lk, Rk = mote(gpatch(grain={"keyboard": True, "pitch": 0}), [{"at": 0.02, "t": "on", "n": 72, "v": 1}], 0.8, tone)
    fk = peak_freq(Lk[len(Lk)//4:])
    ck(f"Mo. keyboard note 72 is an octave up ({fk:.1f} Hz)", abs(fk - 880) < 15, fk)
    Ls, Rs = mote(gpatch(grain={"keyboard": True}), [], 0.5, tone)
    ck("Mo. keyboard mode with no notes is silent", rms(Ls) < 1e-4 and rms(Rs) < 1e-4, (rms(Ls), rms(Rs)))
    burst = {"freq": 440, "seconds": 2000 / SR, "amp": 0.8, "burst": 900}
    fwd, _ = mote(gpatch(grain={"size": 80, "density": 24, "position": 0, "reverse": 0}), seconds=0.35, tone=burst)
    rev0, _ = mote(gpatch(grain={"size": 80, "density": 24, "position": 0, "reverse": 1}), seconds=0.35, tone=burst)
    rev1, _ = mote(gpatch(grain={"size": 80, "density": 24, "position": 1, "reverse": 1}), seconds=0.35, tone=burst)
    ck("Mo. reverse from the start of a front-loaded buffer is much quieter than forward", rms(fwd) > 0.01 and rms(rev0) < rms(fwd) * 0.15, (rms(fwd), rms(rev0)))
    ck("Mo. reverse from the end of that buffer is audible", rms(rev1) > rms(fwd) * 0.15, (rms(rev1), rms(fwd)))
    wide, wideR = mote(gpatch(grain={"size": 120, "density": 16, "spread": 1, "position": 0.5}), seconds=0.6, tone=tone)
    ck("Mo. spread 1 separates the channels", float(np.max(np.abs(wide - wideR))) > 0.02, float(np.max(np.abs(wide - wideR))))
    dryL, _ = mote(gpatch(grain={"keyboard": True, "size": 40, "density": 30, "position": 0.2}),
                   [{"at": 0.02, "t": "on", "n": 60, "v": 1}, {"at": 0.08, "t": "off", "n": 60}], 1.2, tone)
    wetL, _ = mote(gpatch(grain={"keyboard": True, "size": 40, "density": 30, "position": 0.2},
                          tail={"delay": 0.2, "feedback": 0.7, "reverb": 0.8, "mix": 0.85}),
                   [{"at": 0.02, "t": "on", "n": 60, "v": 1}, {"at": 0.08, "t": "off", "n": 60}], 1.2, tone)
    late = slice(int(0.55 * SR), None)
    ck("Mo. the tail keeps sounding after the note", rms(dryL[late]) < 1e-4 and rms(wetL[late]) > 1e-3 and rms(wetL[late]) > rms(dryL[late]) * 20,
       (rms(dryL[late]), rms(wetL[late])))
    half = {"freq": 440, "seconds": 1.0, "amp": 0.8, "silentUntil": 0.5}
    still, _ = mote(gpatch(grain={"size": 40, "density": 20, "position": 0.1, "spray": 0}, lfo={"rate": 6, "depth": 0, "dest": "position"}), seconds=0.7, tone=half)
    moved, _ = mote(gpatch(grain={"size": 40, "density": 20, "position": 0.1, "spray": 0}, lfo={"rate": 6, "depth": 1, "dest": "position"}), seconds=0.7, tone=half)
    ck("Mo. an LFO on position reaches a buffer that is silent at the start", rms(still) < 2e-3 and rms(moved) > rms(still) * 4 and rms(moved) > 0.005,
       (rms(still), rms(moved)))
    rng = random.Random(7)
    fuzz_ok = True
    fuzz_peak = 0.0
    for _ in range(8):
        fpch = gpatch(level=rng.random(), grain={
            "size": rng.uniform(5, 400), "density": rng.uniform(0.5, 60), "position": rng.random(), "spray": rng.random(),
            "pitch": rng.uniform(-24, 24), "pitchRand": rng.uniform(0, 12), "reverse": rng.random(),
            "window": rng.choice(["hann", "tri", "plank", "gauss"]), "spread": rng.random(),
            "freeze": rng.choice([True, False]), "keyboard": rng.choice([True, False])},
            lfo={"rate": rng.uniform(0.05, 8), "depth": rng.random(), "dest": rng.choice(["position", "size", "density", "pitch", "spray"])},
            tail={"delay": rng.uniform(0.05, 0.8), "feedback": rng.uniform(0, 0.8), "reverb": rng.random(), "mix": rng.random()})
        ev = [{"at": 0.01, "t": "on", "n": 60, "v": 0.8}] if fpch["grain"]["keyboard"] else []
        aL, aR = mote(fpch, ev, 0.25, {"freq": 220, "seconds": 0.5, "amp": 0.5})
        fuzz_peak = max(fuzz_peak, float(np.max(np.abs(aL))), float(np.max(np.abs(aR))))
        if not (np.all(np.isfinite(aL)) and np.all(np.isfinite(aR)) and fuzz_peak <= 1.0001):
            fuzz_ok = False
            break
    ck(f"Mo. random patches stay finite and at or under 0 dBFS (peak {fuzz_peak:.3f})", fuzz_ok, fuzz_peak)
    fac_ok = True
    fac_detail = []
    for name in ("Drift Glass", "Keyed Glass", "Air Bed"):
        P = pg.evaluate("n => __synth.motePatch(n)", name)
        ev = [{"at": 0.02, "t": "on", "n": 60, "v": 0.9}]
        aL, aR = mote(P, ev, 0.8)
        level = rms(aL)
        fac_detail.append((name, level))
        if level <= 1e-3 or not np.all(np.isfinite(aL)) or not np.all(np.isfinite(aR)): fac_ok = False
    ck("Mo. the three factory patches sound", fac_ok, fac_detail)
    ms = pg.evaluate("""async () => { const t0 = performance.now(); await __synth.moteRender({patch: __synth.motePatch('Drift Glass'), events: [{at: 0.02, t: 'on', n: 60, v: 0.8}], seconds: 4}); return performance.now() - t0; }""")
    info("Mo. CPU Mote Drift Glass", f"{100 * ms / 4000:.1f}% of real time in headless Chrome (offline render, grains only)")
    files = pg.evaluate("""async () => {
      const out = {};
      for (const n of ['glass', 'air', 'bell']) {
        const r = await fetch('/synth/sources/' + n + '.wav');
        const u = new Uint8Array(await r.arrayBuffer());
        out[n] = { ok: r.ok, n: u.length, riff: String.fromCharCode(u[0], u[1], u[2], u[3]) };
      }
      return out;
    }""")
    ck("Mo. glass, air and bell are RIFF files", all(files[n]["ok"] and files[n]["riff"] == "RIFF" and files[n]["n"] > 1000 for n in ("glass", "air", "bell")), files)
    pg.evaluate("__synth.setDevice('mote')"); pg.wait_for_timeout(300)
    ck("Mo. the rail lights Mote and shows the waveform", pg.evaluate("__synth.device()") == "mote" and pg.locator("#devM").get_attribute("aria-pressed") == "true"
       and pg.is_visible("#moteWave") and not pg.is_visible("#mFilt"), pg.evaluate("__synth.device()"))
    pg.locator("#moteDrop").scroll_into_view_if_needed()
    box = pg.locator("#moteDrop").bounding_box()
    pg.mouse.move(box["x"] + 8, box["y"] + box["height"] / 2)
    pg.mouse.down()
    pg.mouse.move(box["x"] + box["width"] * 0.75, box["y"] + box["height"] / 2, steps=8)
    pg.mouse.up()
    pg.wait_for_timeout(80)
    pos = pg.evaluate("__synth.patch().grain.position")
    ck(f"Mo. dragging the waveform sets the grain position ({pos:.2f})", 0.68 <= pos <= 0.84, pos)
    pg.locator('#moteWin [data-v="tri"]').click(); pg.wait_for_timeout(40)
    ck("Mo. the window chips select a shape", pg.evaluate("__synth.patch().grain.window") == "tri")
    before = pg.evaluate("__synth.patch().grain.freeze")
    pg.locator("#moteFreeze").click(); pg.wait_for_timeout(40)
    ck("Mo. freeze toggles", pg.evaluate("__synth.patch().grain.freeze") != before)
    tiny = pg.evaluate("""() => {
      const sr = 8000, n = 160;
      const data = n * 2;
      const buf = new ArrayBuffer(44 + data);
      const v = new DataView(buf);
      const s = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
      s(0, 'RIFF'); v.setUint32(4, 36 + data, true); s(8, 'WAVE'); s(12, 'fmt '); v.setUint32(16, 16, true);
      v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
      v.setUint16(32, 2, true); v.setUint16(34, 16, true); s(36, 'data'); v.setUint32(40, data, true);
      for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * 440 * i / sr) * 8000), true);
      let bin = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i++) bin += String.fromCharCode(u[i]);
      return btoa(bin);
    }""")
    raw = base64.b64decode(tiny)
    pg.set_input_files("#moteFile", files=[{"name": "taken-grain.wav", "mimeType": "audio/wav", "buffer": raw}])
    pg.wait_for_timeout(400)
    ck("Mo. a chosen file becomes the source", "taken-grain" in (pg.locator("#moteName").inner_text() or ""), pg.locator("#moteName").inner_text())
    dropped = pg.evaluate("""async (b64) => {
      const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const file = new File([bin], 'dropped-grain.wav', { type: 'audio/wav' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const el = document.getElementById('moteDrop');
      el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
      await new Promise(r => setTimeout(r, 250));
      return document.getElementById('moteName').textContent;
    }""", tiny)
    ck("Mo. a dropped file becomes the source", "dropped-grain" in (dropped or ""), dropped)
    pg.locator("#moteKeys").click(); pg.wait_for_timeout(40)
    pg.evaluate("__synth.noteOn(60, 0.9)"); pg.wait_for_timeout(250)
    meter = pg.evaluate("__synth.moteMeter()")
    ck("Mo. keys mode counts a held note", (meter.get("voices") or 0) >= 1 or (meter.get("grains") or 0) >= 1, meter)
    pg.evaluate("__synth.noteOff(60)")
    pg.wait_for_timeout(50)
    pg.reload(); pg.wait_for_function("window.__synth && __synth.ready()", timeout=20000); pg.wait_for_timeout(200)
    ck("Mo. reload keeps the device and the grain position", pg.evaluate("__synth.device()") == "mote" and abs(pg.evaluate("__synth.patch().grain.position") - pos) < 0.02,
       (pg.evaluate("__synth.device()"), pg.evaluate("__synth.patch().grain.position")))
    probe = pg.evaluate("() => __synth.moteCaptureProbe(0.3, 523)")
    ck("Mo. a capture of a tone has samples", probe and probe["n"] > 1000 and probe["rms"] > 1e-3, probe)
    cap = dec(pg.evaluate("""() => __synth.moteRender({
      patch: { device: 'mote', level: 1, grain: { size: 200, density: 8, position: 0.4, spray: 0, pitch: 0, pitchRand: 0, reverse: 0, window: 'hann', spread: 0, freeze: true, keyboard: false }, lfo: { depth: 0 }, tail: { mix: 0 } },
      seconds: 0.5, useHost: true
    })"""))
    fc = peak_freq(cap[0][len(cap[0])//5:])
    ck(f"Mo. grains of a captured 523 Hz tone peak near 523 ({fc:.1f} Hz)", abs(fc - 523) < 20, fc)
    pg.screenshot(path=os.path.join(SHOTS, "synth_mote_desktop.png"), full_page=True)
    pg.evaluate("__synth.setDevice('filament')")
    ck("Mo. no page errors", not errs, errs)

    # Mote on a phone, then back to Filament so later pages still boot on the tube synth.
    ph = b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2); perr = []
    ph.on("pageerror", lambda e: perr.append(str(e)))
    ph.goto(BASE); ph.wait_for_function("window.__synth && __synth.ready()", timeout=20000); ph.wait_for_timeout(200)
    ph.evaluate("__synth.setDevice('mote')"); ph.wait_for_timeout(300)
    ck("Mo. 390px: no horizontal scroll", ph.evaluate("document.documentElement.scrollWidth <= innerWidth && innerWidth === 390"),
       ph.evaluate("[document.documentElement.scrollWidth, innerWidth]"))
    ck("Mo. 390px: the waveform is on screen and the filter is not", ph.is_visible("#moteWave") and not ph.is_visible("#mFilt") and not ph.is_visible("#chassis"))
    ph.tap('.tabs [data-go="grain"]'); ph.wait_for_timeout(200)
    ck("Mo. 390px: the Grain tab shows size and the window shapes", ph.is_visible("#mMoteGrain") and ph.is_visible("#moteWin") and not ph.is_visible("#moteWave"))
    small = ph.evaluate("""() => [...document.querySelectorAll('#moteRoot .chip, #moteRoot .knob, .tabs button, .devbtn')].filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map(e => (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))""")
    ck("Mo. 390px: grain chips, knobs and the rail are 44 px or more", not small, small)
    ph.tap('.tabs [data-go="space"]'); ph.wait_for_timeout(200)
    ck("Mo. 390px: the Space tab shows the tail, still no horizontal scroll", ph.is_visible("#kMoteTail") and not ph.is_visible("#mMoteGrain")
       and ph.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    ph.screenshot(path=os.path.join(SHOTS, "synth_mote_phone.png"))
    ph.evaluate("__synth.setDevice('filament')")
    ck("Mo. 390px: no page errors", not perr, perr)
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
    ck("R. Filament and Cathode publish the device contract", pure["api"] == "dxrack/1" and pure["outs"] == 1 and pure["midi"] and pure["cut"] == 1800 and pure["nParam"] > 40 and pure["catWave"] == "choice" and "saw" in pure["catChoices"] and {"filament", "cathode", "thyratron", "gleam", "dekatron", "lattice", "mote"} <= set(pure["both"]), pure)
    # Parameter types (30 Oct): the int list is explicit per device. Until then parameterTable guessed
    # from the numbers, so a -1..1 amount at 0 read as int and Pentagrid's 5..40 wpm as float.
    ptypes = pg.evaluate("""async () => {
      const d = await import('/synth/device.js');
      const out = {}, bad = [];
      for (const x of d.listDevices()) {
        const P = x.parameters || {};
        out[x.id] = {};
        for (const k of Object.keys(P)) {
          const i = P[k];
          if (i.type === 'int' || i.type === 'float') out[x.id][k] = i.type;
          if (i.type === 'int' && ![i.default, i.min, i.max].every(Number.isInteger)) bad.push(x.id + ':' + k);
        }
      }
      return { out, bad };
    }""")
    PT_WANT = {
      "filament": {"osc1.semi": "int", "osc2.oct": "int", "voice.count": "int", "voice.bend": "int", "out.eqBands": "int",
                   "mod.s1.amt": "float", "filtB.bal": "float", "mw.cut": "float", "osc2.fm": "float", "v1.drive": "float"},
      "cathode": {"vco2.semi": "int", "ctl.bend": "int", "hpf.a": "float", "drift": "float"},
      "thyratron": {"tune": "int", "bend": "int", "osc1.tune": "float", "mod.pitch": "float"},
      "pentagrid": {"wpm": "int", "seed": "int", "air": "float"},
      "resnatron": {"vco1.oct": "int", "vco1.fine": "float", "vca.level": "float"},
      "trochotron": {"depth": "int", "seed": "int", "cy": "float"},
      "geissler": {"capReed": "int", "seed": "int", "birth": "float"},
      "additron": {"morph": "float"},
    }
    pt_miss = [f"{dv}:{k}={ptypes['out'].get(dv, {}).get(k)}" for dv, kv in PT_WANT.items() for k, t in kv.items()
               if ptypes["out"].get(dv, {}).get(k) != t]
    ck("R. parameter tables: whole-number knobs are int, amounts and levels are float, every int is whole at both ends",
       not pt_miss and not ptypes["bad"], {"wrong": pt_miss, "notWhole": ptypes["bad"]})
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

    # Idle rack stages: the ensemble's wet side (off, or mix 0) and the single-ended B side are
    # unplugged so the browser stops running them. A fixed signal through the rack must come out
    # sample for sample the same with them unplugged and plugged back in by hand.
    idle = pg.evaluate("""async () => {
      const eng = await import('/synth/engine.js'); const PM = await import('/synth/patches.js');
      let a = 1; const rnd = () => { a = (a * 1103515245 + 12345) >>> 0; return a / 4294967296; };
      const src = new Float32Array(24000);
      for (let i = 0; i < src.length; i++) src[i] = 0.3 * Math.sin(i * 0.0571) + 0.2 * Math.sin(i * 0.0857) + 0.1 * (rnd() * 2 - 1);
      const pat = (ens, topology) => { const p = PM.normalize({}); p.ens = ens; p.out.topology = topology; return p; };
      const run = async (P, replug) => {
        const ctx = new OfflineAudioContext(2, 48000, 48000);
        const E = await eng.createEngine(ctx, { patch: P, events: [] });
        const st = { fed: E.ens.fed, bFed: E.C.bFed() };
        if (replug) { if (!E.ens.fed) E.ens.mid.connect(E.ens.pre); if (!E.C.bFed()) E.C.tIn.connect(E.C.ppInv); }
        const buf = ctx.createBuffer(2, src.length, 48000); buf.copyToChannel(src, 0); buf.copyToChannel(src.slice().reverse(), 1);
        const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(E.ens.input); s.start(0);
        E.node.disconnect();
        const out = await ctx.startRendering();
        return { st, L: out.getChannelData(0), R: out.getChannelData(1) };
      };
      const cmp = (x, y) => { let d = 0, pk = 0; for (let i = 0; i < x.L.length; i++) {
        d = Math.max(d, Math.abs(x.L[i] - y.L[i]), Math.abs(x.R[i] - y.R[i])); pk = Math.max(pk, Math.abs(x.L[i])); } return { d, pk }; };
      const offSe = pat({ on: false, mode: 'I', mix: 50 }, 'se'), mix0 = pat({ on: true, mode: 'II', mix: 0 }, 'pp');
      const u1 = await run(offSe, false), p1 = await run(offSe, true), u2 = await run(mix0, false), p2 = await run(mix0, true);
      const on = await run(pat({ on: true, mode: 'I', mix: 50 }, 'pp'), false);
      // offline, a patch change replugs and unplugs at once
      const ctx = new OfflineAudioContext(2, 4800, 48000), E = await eng.createEngine(ctx, { patch: offSe, events: [] });
      E.setPatch(pat({ on: true, mode: 'I', mix: 50 }, 'pp'), true); const swOn = { fed: E.ens.fed, bFed: E.C.bFed() };
      E.setPatch(offSe, true); const swOff = { fed: E.ens.fed, bFed: E.C.bFed() };
      // live: off waits for the fade before it unplugs; on replugs at once
      const L = __synth.engine(); await L.ctx.resume();
      L.ens.set({ on: true, mode: 'I', mix: 50 }); const lOn = L.ens.fed;
      L.ens.set({ on: false, mode: 'I', mix: 50 }); const lSoon = L.ens.fed;
      await new Promise(r => setTimeout(r, 600)); const lLater = L.ens.fed;
      L.ens.set({ on: true, mode: 'I', mix: 50 }); const lBack = L.ens.fed;
      L.ens.set(L.patch().ens);
      return { offSe: cmp(u1, p1), mix0: cmp(u2, p2), stOff: u1.st, stMix0: u2.st, stOn: on.st, swOn, swOff, lOn, lSoon, lLater, lBack };
    }""")
    ck("R. idle rack stages: ensemble off and single-ended unplug the wet side and the B side; ensemble on and push-pull keep them",
       idle["stOff"] == {"fed": False, "bFed": False} and idle["stMix0"] == {"fed": False, "bFed": True} and idle["stOn"] == {"fed": True, "bFed": True}, idle)
    ck(f"R. idle rack stages: unplugged is sample for sample the same as plugged (ensemble off, single-ended: max diff {idle['offSe']['d']}; mix 0: {idle['mix0']['d']})",
       idle["offSe"]["d"] == 0 and idle["mix0"]["d"] == 0 and idle["offSe"]["pk"] > 0.05 and idle["mix0"]["pk"] > 0.05, idle)
    ck("R. idle rack stages: a patch change replugs and unplugs them (offline, at once)",
       idle["swOn"] == {"fed": True, "bFed": True} and idle["swOff"] == {"fed": False, "bFed": False}, idle)
    ck("R. idle rack stages: live, switching the ensemble off unplugs only after the fade, and on replugs at once",
       idle["lOn"] and idle["lSoon"] and not idle["lLater"] and idle["lBack"], idle)

    pg.locator("#mHost").scroll_into_view_if_needed()
    pg.fill("#hostTempo", "100"); pg.locator("#hostTempo").press("Tab"); pg.wait_for_timeout(40)
    ck("R. the tempo field sets the clock", pg.evaluate("__synth.transport().state().tempo") == 100, pg.evaluate("__synth.transport().state().tempo"))
    # review R1026-6: an emptied tempo box committed with Enter set 40 BPM (the clamp's floor)
    pg.fill("#hostTempo", ""); pg.locator("#hostTempo").press("Enter"); pg.locator("#hostTempo").press("Tab"); pg.wait_for_timeout(40)
    et_ = (pg.evaluate("__synth.transport().state().tempo"), pg.evaluate("document.getElementById('hostTempo').value"))
    ck(f"R. an emptied tempo box keeps the tempo and shows it again (clock {et_[0]}, box '{et_[1]}', want 100)", et_[0] == 100 and et_[1] == "100", et_)
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
    # Review R1020-2: upload took any JSON (a mix file, a patch) as an empty project, reset the devices and overwrote the saved one.
    for wrong_name, wrong in (("a-mix.json", {"v": 1, "kind": "dxmix", "name": "Mix"}), ("patch.json", {"v": 1, "device": "filament", "name": "Glass Music Box"})):
        pg.set_input_files("#projFile", files=[{"name": wrong_name, "mimeType": "application/json", "buffer": json.dumps(wrong).encode()}])
        pg.wait_for_function("document.getElementById('toast').textContent.length > 0", timeout=3000); pg.wait_for_timeout(150)
        kept = pg.evaluate("""() => ({ toast: document.getElementById('toast').textContent, tempo: __synth.transport().state().tempo, name: document.getElementById('projName').value,
          saved: JSON.parse(localStorage.getItem('dxrack_project') || '{}').name, dev: __synth.device() })""")
        ck(f"R. upload refuses {wrong_name} and keeps the project", "not a project" in kept["toast"] and kept["tempo"] == 88 and kept["name"] == "Uploaded" and kept["saved"] == "Uploaded" and kept["dev"] == "cathode", kept)
    # Review 24 Oct (R1024-1): with Thyratron, Dekatron, Lattice or Gleam on the rail, load saved put the rail
    # device back on the patch it had when it was put on the rail (the page's stored copy was stale), marked edited.
    for rail in ("thyratron", "lattice"):
        rl = pg.evaluate("""async (rail) => {
          const w = ms => new Promise(r => setTimeout(r, ms));
          __synth.setDevice(rail); await w(150);
          const sel = document.getElementById('patchSel');
          const opts = [...sel.options].filter(o => o.value.startsWith('f:'));
          const pick = opts.find(o => o.value !== sel.value && o !== opts[0]) || opts[1];
          sel.value = pick.value; sel.dispatchEvent(new Event('change')); await w(150);
          const picked = __synth.patch().name;
          document.getElementById('projSave').click(); await w(60);
          document.getElementById('projLoad').click(); await w(250);
          const out = { picked, after: __synth.patch().name, label: sel.options[sel.selectedIndex].textContent };
          __synth.setDevice('filament'); await w(100); __synth.setDevice(rail); await w(100);
          out.back = __synth.patch().name;
          __synth.setDevice('cathode'); await w(100);
          return out;
        }""", rail)
        ck(f"R. load saved keeps the patch picked on {rail} on the rail", rl["after"] == rl["picked"] and rl["back"] == rl["picked"] and "(edited)" not in rl["label"], rl)
    # Review 27 Oct (R1027-1): the saved arms and desk bus come back only when the boot finishes (several
    # seconds on a phone or a slow link). Save project or save mix in that window wrote no arms and the
    # default bus over the saved ones. Holding one device's worklet back keeps the page in that window.
    bctx = b.new_context(viewport={"width": 1366, "height": 900}, service_workers="block"); bpg = bctx.new_page()
    bpg.goto(BASE); bpg.wait_for_function("window.__synth && __synth.booted()", timeout=30000)
    bpg.evaluate("""() => { const p = __synth.project(); p.name = 'Early'; p.armed = ['cathode', 'thyratron'];
      p.bus = { reverbSeconds: 2.2, delayTime: 0.5, delayFeedback: 0.6 }; localStorage.setItem('dxrack_project', JSON.stringify(p)); }""")
    bctx.route("**/resnatron.worklet.js", lambda r: r.abort())
    bpg.reload(); bpg.wait_for_function("window.__synth && __synth.ready()", timeout=20000); bpg.wait_for_timeout(400)
    early = bpg.evaluate("""() => { const booted = __synth.booted(); document.getElementById('projSave').click();
      const p = JSON.parse(localStorage.getItem('dxrack_project')); const m = __synth.mixSession();
      return { booted, armed: p.armed, bus: p.bus, name: p.name, mixArmed: m.armed, mixBus: m.bus }; }""")
    ck("R. save project before the boot finishes keeps the saved arms and desk bus (and the mix session sees them)",
       early["booted"] is False and early["name"] == "Early" and early["armed"] == ["cathode", "thyratron"] and early["mixArmed"] == ["cathode", "thyratron"]
       and abs(early["bus"]["reverbSeconds"] - 2.2) < 1e-9 and abs(early["bus"]["delayFeedback"] - 0.6) < 1e-9 and abs(early["mixBus"]["reverbSeconds"] - 2.2) < 1e-9, early)
    bctx.close()
    ck("R. no page errors", not errs, errs)

    # ---------------------------------------------------------------- Mx. the mix desk: arms, sends, one session
    pure_mx = pg.evaluate("""async () => {
      const s = await import('/synth/mixsession.js');
      const m = await import('/synth/mixer.js');
      const none = s.routeTargets('cathode', []);
      const one = s.routeTargets('filament', ['cathode']);
      const many = s.routeTargets('filament', ['klystron', 'filament', 'nope', 'filament']);
      const ses = s.normalizeSession({ name: '  Night ', armed: ['cathode', 'bogus', 'mote'], bus: { delayTime: 9, delayFeedback: -1 }, channels: { filament: { level: 2, sendR: 0.4, sendD: 3 } } });
      const strip = m.normalizeStrip({ sendR: 0.25, sendD: -2 });
      return {
        none, one, many, kind: ses.kind, v: ses.v, name: ses.name, armed: ses.armed,
        delay: ses.bus.delayTime, fb: ses.bus.delayFeedback, sendR: ses.channels.filament.sendR, sendD: ses.channels.filament.sendD,
        nch: Object.keys(ses.channels).length, file: s.sessionFileName(ses),
        zeroR: strip.sendR, zeroD: strip.sendD, letters: s.MIX_CHANNELS.map(c => c.letter),
      };
    }""")
    ck("Mx. no arm follows the lit device, one arm plays that device, several play together",
       pure_mx["none"] == ["cathode"] and pure_mx["one"] == ["cathode"] and pure_mx["many"] == ["klystron", "filament"], pure_mx)
    ck("Mx. a session normalizes the name, the arms, the sends and the shared bus",
       pure_mx["kind"] == "dxmix" and pure_mx["v"] == 1 and pure_mx["name"] == "Night" and pure_mx["armed"] == ["cathode", "mote"]
       and pure_mx["delay"] == 1.5 and pure_mx["fb"] == 0 and abs(pure_mx["sendR"] - 0.4) < 1e-9 and pure_mx["sendD"] == 1
       and pure_mx["nch"] >= 18 and pure_mx["file"] == "mix-night.json" and abs(pure_mx["zeroR"] - 0.25) < 1e-9 and pure_mx["zeroD"] == 0
       and pure_mx["letters"][:4] == ["F", "C", "D", "L"] and pure_mx["letters"][-4:] == ["Q", "N", "R", "S"], pure_mx)

    def seg_rms(x, a, b):
        i, j = int(a * SR), int(b * SR)
        seg = x[i:j]
        return float(np.sqrt(np.mean(seg ** 2))) if len(seg) else 0.0
    mxp = patch(osc1={"wave": "sine", "level": 0.45}, stereo={"pan": "center", "spread": 0}, envA={"a": 0.001, "d": 0.02, "s": 1, "r": 0.004, "vel": 0})
    dryL, dryR = render(mxp, note(69, 0.0, 0.2), 1.5, rack=False, masterFx=False)
    zeroL, zeroR = render(mxp, note(69, 0.0, 0.2), 1.5, rack=False, masterFx=False, mixer={"filament": {"sendR": 0, "sendD": 0}})
    body_d, body_z = seg_rms(dryL, 0.05, 0.15), seg_rms(zeroL, 0.05, 0.15)
    ck("Mx. zero sends leave the dry level alone", body_d > 1e-4 and abs(db(body_z / body_d)) < 0.25, (body_d, body_z))
    revL, revR = render(mxp, note(69, 0.0, 0.2), 1.5, rack=False, masterFx=False, mixer={"filament": {"sendR": 1}})
    dlyL, dlyR = render(mxp, note(69, 0.0, 0.2), 1.5, rack=False, masterFx=False, mixer={"filament": {"sendD": 1}})
    tail_d, tail_r, tail_y = seg_rms(dryL, 0.55, 1.35), seg_rms(revL, 0.55, 1.35), seg_rms(dlyL, 0.45, 1.2)
    ck("Mx. a reverb send rings after the note", tail_r > tail_d * 4 and tail_r > 1e-4, (tail_d, tail_r))
    ck("Mx. a delay send repeats after the note", tail_y > tail_d * 4 and tail_y > 1e-4, (tail_d, tail_y))
    muteL, muteR = render(mxp, note(69, 0.0, 0.2), 1.2, rack=False, masterFx=False, mixer={"filament": {"mute": True, "sendR": 1, "sendD": 1}})
    ck("Mx. mute silences the sends as well as the channel", seg_rms(muteL, 0.05, 1.0) < 1e-5 and seg_rms(muteR, 0.05, 1.0) < 1e-5, (seg_rms(muteL, 0.05, 1.0), seg_rms(muteR, 0.05, 1.0)))

    pg.evaluate("""() => {
      __synth.setMixer('filament', { level: 1, pan: 0, mute: false, solo: false, sendR: 0, sendD: 0 });
      __synth.setMixer('cathode', { level: 1, pan: 0, mute: false, solo: false, sendR: 0, sendD: 0 });
      return __synth.mixArm(['filament', 'cathode']);
    }""")
    pg.evaluate("__synth.noteOn(60, 0.85)")
    pg.wait_for_timeout(280)
    both = pg.evaluate("() => ({ t: __synth.mixTargets(), v: __synth.voiceMeters(), m: __synth.stripMeters() })")
    # The desk's look: every strip a faceplate of the same height, names on one line, an LED ladder that
    # is lit while the note sounds and faintly visible where it is not, amber bus sliders.
    desk = pg.evaluate("""() => {
      const rows = [...document.querySelectorAll('#mHost .mixrow')];
      const hs = rows.map(r => Math.round(r.getBoundingClientRect().height));
      const spill = rows.filter(r => { const b = r.getBoundingClientRect(); return [...r.children].some(c => { const q = c.getBoundingClientRect(); return q.bottom > b.bottom + 1 || q.top < b.top - 1; }); }).map(r => r.dataset.mix);
      const cut = rows.map(r => r.querySelector('.who')).filter(w => w.scrollWidth > w.clientWidth + 1 || w.getBoundingClientRect().height > 22).map(w => w.textContent.trim());
      const c = document.getElementById('mixFMeter'), g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data, mid = Math.floor(c.height / 2) * c.width * 4;
      const px = x => { const i = mid + x * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; };
      let lit = 0, dim = 0, gap = 0;
      for (let x = 0; x < c.width; x++) { const [r, gg, b, a] = px(x); if (a > 200 && r > 120 && gg > 70) lit++; else if (a > 200 && r > 25 && r < 60) dim++; else if (a < 10) gap++; }
      const who = getComputedStyle(rows[2].querySelector('.who')).color, face = getComputedStyle(rows[2]).backgroundImage;
      return { hs, spill, cut, lit, dim, gap, cw: c.width, css: c.clientWidth, keyed: rows.filter(r => r.classList.contains('keyed')).map(r => r.dataset.mix),
        accent: getComputedStyle(document.getElementById('mixRoom')).accentColor, who, face: face.indexOf('gradient') >= 0,
        anim: rows.filter(r => { const s = getComputedStyle(r); return s.animationName !== 'none' || parseFloat(s.transitionDuration) > 0; }).length };
    }""")
    ck(f"Mx. every strip is a faceplate of one height, nothing spills out, names on one line ({min(desk['hs'])} to {max(desk['hs'])} px)",
       desk["face"] and max(desk["hs"]) - min(desk["hs"]) <= 1 and not desk["spill"] and not desk["cut"] and desk["keyed"] == ["filament", "cathode"], desk)
    ck(f"Mx. the strip meter is a crisp LED ladder, lit while the note sounds ({desk['lit']} lit, {desk['dim']} dim, {desk['gap']} gap px)",
       desk["cw"] >= desk["css"] > 100 and desk["lit"] > 4 and desk["dim"] > 20 and desk["gap"] > 8, desk)
    _rgb = [int(v) for v in desk["who"][desk["who"].index("(") + 1:desk["who"].index(")")].split(",")[:3]]
    def _lum(c):
        c = [v / 255 for v in c]; c = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    _con = (_lum(_rgb) + 0.05) / (_lum([25, 25, 25]) + 0.05)
    ck(f"Mx. strip names read on the faceplate (contrast {_con:.1f}:1) and the bus sliders are amber, with no animation on the strips",
       _con >= 4.5 and desk["accent"] in ("rgb(255, 179, 71)",) and desk["anim"] == 0, (desk["who"], desk["accent"], desk["anim"]))
    pg.evaluate("__synth.noteOff(60)")
    pg.wait_for_timeout(80)
    ck("Mx. arming Filament and Cathode plays the note on both",
       both["t"] == ["filament", "cathode"] and both["v"].get("filament", 0) >= 1 and both["v"].get("cathode", 0) >= 1
       and both["m"].get("filament", 0) > 0.01 and both["m"].get("cathode", 0) > 0.01, both)
    pg.evaluate("__synth.setMixer('filament', { sendR: 0.5 })")
    ck("Mx. the reverb send slider follows the strip", abs(float(pg.locator("#mixFRev").input_value()) - 0.5) < 1e-6, pg.locator("#mixFRev").input_value())
    pg.fill("#mixName", "Desk")
    pg.click("#mixSave")
    pg.evaluate("__synth.mixArm([])")
    pg.evaluate("__synth.setMixer('filament', { sendR: 0 })")
    pg.click("#mixLoad")
    pg.wait_for_timeout(80)
    restored = pg.evaluate("""() => ({ armed: __synth.mixTargets(), send: __synth.mixer().filament.sendR, name: document.getElementById('mixName').value })""")
    ck("Mx. save and load restore the arms, the send and the session name",
       restored["armed"] == ["filament", "cathode"] and abs(restored["send"] - 0.5) < 1e-6 and restored["name"] == "Desk", restored)
    with pg.expect_download() as mxdl:
        pg.click("#mixDown")
    mxfile = json.loads(open(mxdl.value.path(), encoding="utf-8").read())
    ck("Mx. download is a dxmix session", mxfile.get("kind") == "dxmix" and mxfile.get("v") == 1 and "filament" in mxfile.get("channels", {}) and mxfile.get("armed") == ["filament", "cathode"], mxfile.get("kind"))
    # Review 23 Oct (R1023-2): upload mix takes only a dxmix file. A project (or any JSON) used to reset
    # every strip to its defaults, overwrite the saved mix, and say "Loaded mix".
    pg.evaluate("__synth.setMixer('filament', { level: 0.4 })")
    mx_before = pg.evaluate("() => localStorage.getItem('dxmix_session')")
    for wrong_name, wrong in (("project.json", pg.evaluate("() => __synth.project()")), ("other.json", {"hello": 1})):
        pg.set_input_files("#mixFile", files=[{"name": wrong_name, "mimeType": "application/json", "buffer": json.dumps(wrong).encode()}])
        pg.wait_for_timeout(250)
        mx_after = pg.evaluate("() => ({ lvl: __synth.mixer().filament.level, saved: localStorage.getItem('dxmix_session'), toast: document.getElementById('toast').textContent, armed: __synth.mixTargets() })")
        ck(f"Mx. upload mix refuses a file that is not a mix ({wrong_name}) and leaves the desk and the saved mix alone",
           abs(mx_after["lvl"] - 0.4) < 1e-6 and mx_after["saved"] == mx_before and "not a mix" in mx_after["toast"] and mx_after["armed"] == ["filament", "cathode"],
           {k: (v if k != "saved" else v == mx_before) for k, v in mx_after.items()})
    # Review 24 Oct (R1024-2): the 18 mute and 18 solo chips were all named just "mute" and "solo".
    chip_names = pg.evaluate("""() => [...document.querySelectorAll('.mixrow[data-mix]')].map(r => {
      const lvl = r.querySelector('input[id$=Lvl]'); const who = (lvl.getAttribute('aria-label') || '').replace(/ level$/, '');
      const m = r.querySelector('button[id$=Mute]'), so = r.querySelector('button[id$=Solo]');
      return { who, mute: m && m.getAttribute('aria-label'), solo: so && so.getAttribute('aria-label') };
    })""")
    ck("Mx. every mute and solo chip names its device (Mute Filament, Solo Filament)",
       len(chip_names) >= 18 and all(c["who"] and c["mute"] == "Mute " + c["who"] and c["solo"] == "Solo " + c["who"] for c in chip_names),
       [c for c in chip_names if not (c["mute"] == "Mute " + c["who"] and c["solo"] == "Solo " + c["who"])][:4])
    pg.evaluate("__synth.setMixer('filament', { level: 1 })")
    # Review 23 Oct (R1023-1): the pedal goes down on the lit device, a strip is armed, the pedal comes up.
    # The pedal-up has to reach the device that got the pedal-down, or its note rings until Panic.
    sus_dev = pg.evaluate("""() => { __synth.panic(); __synth.mixArm([]); return __synth.device(); }""")
    sus_other = "cathode" if sus_dev == "filament" else "filament"
    pg.wait_for_timeout(300)
    pg.evaluate("() => { __synth.midi([0xB0, 64, 127]); __synth.noteOn(60, 0.8); }")
    pg.wait_for_timeout(250)
    pg.evaluate("() => __synth.noteOff(60)")
    pg.wait_for_timeout(150)
    sus_mid = pg.evaluate("() => __synth.voiceMeters()")
    pg.evaluate(f"() => __synth.mixArm(['{sus_other}'])")
    pg.evaluate("() => __synth.midi([0xB0, 64, 0])")
    try:
        pg.wait_for_function(f"() => !__synth.voiceMeters()['{sus_dev}']", timeout=6000); sus_left = 0
    except Exception:
        sus_left = pg.evaluate(f"() => __synth.voiceMeters()['{sus_dev}']")
    ck(f"Mx. pedal down on {sus_dev}, arm {sus_other}, pedal up: the sustained note on {sus_dev} lets go",
       sus_mid.get(sus_dev, 0) >= 1 and sus_left == 0, {"held": sus_mid, "left after 6 s": sus_left})
    pg.evaluate("() => { __synth.panic(); __synth.mixArm(['filament', 'cathode']); }")
    pg.evaluate("""() => {
      __synth.mixArm([]);
      __synth.setMixer('filament', { level: 1, pan: 0, mute: false, solo: false, sendR: 0, sendD: 0 });
      __synth.setMixer('cathode', { level: 0.25, pan: -1, mute: false, solo: true, sendR: 0, sendD: 0 });
      __synth.noteOff(60);
    }""")
    ck("Mx. no page errors", not errs, errs)

    # ---------------------------------------------------------------- Gx. faders: one slider finish across the rack
    # Graphics 24 Oct. Every slider was the browser's own (a bright track and a blue or flat amber thumb), and on a
    # 1366 px desktop Trochotron, Phantastron, Rhumbatron and Heptode squeezed theirs into two columns of a narrow card
    # (6 to 88 px wide). Now each is a recessed slot with a bakelite cap and a lit index line, slider grids take only
    # the columns that fit, and Resnatron's selects are dark. The input boxes are unchanged, so touch targets are too.
    GX_DEVS = ["filament", "cathode", "thyratron", "gleam", "dekatron", "lattice", "mote", "heptode", "geissler", "pentagrid",
               "orthicon", "trochotron", "gyrotron", "klystron", "phantastron", "additron", "rhumbatron", "resnatron"]
    GX_MEAS = """() => [...document.querySelectorAll('input[type=range]')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
      .map(e => { const s = getComputedStyle(e), r = e.getBoundingClientRect();
        return { id: e.id || e.getAttribute('aria-label') || '?', app: s.appearance, acc: s.getPropertyValue('--fader-accent').trim(), w: Math.round(r.width), h: Math.round(r.height),
          strip: !!e.closest('#mHost'), lat: !!e.closest('.lat'), anim: s.animationName !== 'none' || parseFloat(s.transitionDuration) > 0,
          x: r.left, y: r.top, top: r.top + scrollY }; })"""
    GX_PIX = """async ({ b64, lat }) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data;
      let lit = 0, blue = 0, pale = 0;
      for (let i = 0; i < d.length; i += 4) { const r = d[i], gg = d[i + 1], b = d[i + 2];
        if (lat ? (b > 200 && r > 90 && r < 160) : (r > 200 && gg > 130 && b < 120)) lit++;
        if (!lat && b > 180 && r < 90) blue++;
        if (r > 200 && gg > 200 && b > 200) pale++; }
      return { lit, blue, pale };
    }"""
    gctx = b.new_context(viewport={"width": 1366, "height": 1000}, reduced_motion="reduce"); gp = gctx.new_page(); gerr = []
    gp.on("pageerror", lambda e: gerr.append(str(e)))
    gp.goto(BASE); gp.wait_for_function("window.__synth && __synth.ready()", timeout=30000)
    gx_bad, gx_narrow, gx_pix, gx_anim, gx_n = [], [], [], [], 0
    for d in GX_DEVS:
        gp.evaluate(f"document.querySelector('.devbtn[data-d={d}]').click()"); gp.wait_for_timeout(300)
        rows = gp.evaluate(GX_MEAS); gx_n += len(rows)
        gx_bad += [f"{d}:{r['id']}:{r['app']}:{r['acc']}" for r in rows if r["app"] != "none" or r["acc"].lower() != ("#7aa2ff" if r["lat"] else "#ffb347")]
        gx_narrow += [f"{d}:{r['id']}:{r['w']}" for r in rows if not r["strip"] and r["w"] < 80]
        gx_anim += [f"{d}:{r['id']}" for r in rows if r["anim"]]
        # the first slider of the device's own panel (not the header volume or the mix desk), painted
        own = [r for r in rows if not r["strip"] and r["id"] not in ("mastVol", "mixRoom", "mixDelay", "mixFb")]
        if own:
            r0 = own[0]
            gp.evaluate(f"window.scrollTo(0, {max(0, r0['top'] - 300)})"); gp.wait_for_timeout(60)
            box = gp.evaluate(f"(() => {{ const e = [...document.querySelectorAll('input[type=range]')].filter(x => (x.id || x.getAttribute('aria-label')) === {json.dumps(r0['id'])} && x.getBoundingClientRect().width > 0)[0]; const r = e.getBoundingClientRect(); return {{ x: r.left, y: r.top, w: r.width, h: r.height }}; }})()")
            shot = gp.screenshot(clip={"x": box["x"], "y": box["y"], "width": max(box["w"], 1), "height": max(box["h"], 1)})
            px = gp.evaluate(GX_PIX, {"b64": base64.b64encode(shot).decode(), "lat": d == "lattice"})
            if px["lit"] < 6 or px["blue"] > 0 or px["pale"] > 4: gx_pix.append((d, r0["id"], px))
    ck(f"Gx. every slider on all 18 devices has the rack fader finish ({gx_n} sliders; Lattice keeps its blue index)", gx_n > 300 and not gx_bad, gx_bad[:12])
    ck("Gx. each device's first slider is painted: a lit index line, no browser-blue thumb, no pale track", not gx_pix, gx_pix)
    ck("Gx. no device slider on a 1366 px desktop is narrower than 80 px (Trochotron, Phantastron, Rhumbatron were 6 to 56)", not gx_narrow, gx_narrow[:12])
    ck("Gx. sliders carry no animation or transition (reduced motion and otherwise)", not gx_anim, gx_anim[:12])
    gp.evaluate("document.querySelector('.devbtn[data-d=resnatron]').click()"); gp.wait_for_timeout(300)
    sel = gp.evaluate("""() => [...document.querySelectorAll('.rn-field select')].filter(s => s.offsetParent).map(s => { const c = getComputedStyle(s); return [c.backgroundColor, c.color]; })""")
    def _gx_rgb(s): return [int(float(v)) for v in s[s.index("(") + 1:s.index(")")].split(",")[:3]]
    def _gx_lum(c):
        c = [v / 255 for v in c]; c = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    sel_con = [(max(_gx_lum(_gx_rgb(f)), _gx_lum(_gx_rgb(bk))) + 0.05) / (min(_gx_lum(_gx_rgb(f)), _gx_lum(_gx_rgb(bk))) + 0.05) for bk, f in sel]
    ck(f"Gx. Resnatron's selects are dark with readable text ({len(sel)} selects, contrast {min(sel_con or [0]):.1f}:1 or more)",
       len(sel) >= 5 and all(_gx_lum(_gx_rgb(bk)) < 0.05 for bk, _ in sel) and min(sel_con) >= 4.5, sel)
    ck("Gx. no page errors (desktop)", not gerr, gerr)
    gctx.close()
    pctx = b.new_context(viewport={"width": 375, "height": 667}, is_mobile=True, has_touch=True, device_scale_factor=2); pp = pctx.new_page(); perr_g = []
    pp.on("pageerror", lambda e: perr_g.append(str(e)))
    pp.goto(BASE); pp.wait_for_function("window.__synth && __synth.ready()", timeout=30000)
    gx_short, gx_wide, gx_pn = [], [], 0
    for d in ("heptode", "lattice", "trochotron", "phantastron", "rhumbatron", "resnatron"):
        pp.evaluate(f"document.querySelector('.devbtn[data-d={d}]').click()"); pp.wait_for_timeout(300)
        for t in pp.evaluate("[...document.querySelectorAll('[role=tab][data-go]')].filter(t => t.offsetParent).map(t => t.dataset.go)"):
            pp.evaluate(f"document.querySelector('[role=tab][data-go={t}]').click()"); pp.wait_for_timeout(150)
            rows = pp.evaluate(GX_MEAS); gx_pn += len(rows)
            gx_short += [f"{d}:{t}:{r['id']}:{r['h']}" for r in rows if r["h"] < 44]
            gx_wide += [f"{d}:{t}:{r['id']}:{r['w']}" for r in rows if not r["strip"] and r["w"] < 120]
            sw = pp.evaluate("document.documentElement.scrollWidth")
            if sw > 375: gx_wide.append(f"{d}:{t}: page scrolls sideways ({sw} px)")
        pp.evaluate("document.querySelector('[role=tab][data-go=play]').click()")
    ck(f"Gx. on a 375 px phone every slider stays a 44 px target ({gx_pn} sliders across six devices' tabs)", gx_pn > 100 and not gx_short, gx_short[:12])
    ck("Gx. on a phone the device sliders are at least 120 px long and nothing scrolls sideways", not gx_wide, gx_wide[:12])
    ck("Gx. no page errors (phone)", not perr_g, perr_g)
    pctx.close()

    # ---------------------------------------------------------------- Dk. the MIDI deck and song library strips (graphics, 25 Oct)
    # Each strip is a brushed faceplate with two screws, an engraved name and recessed readout windows. The lamp in
    # the first window reads the buttons' own state: dark, amber when there is something to play, red while armed
    # (pulsing once the take runs, steady with reduced motion), green while playing.
    DK_MEAS = """() => {
      const strip = id => { const e = document.getElementById(id), c = getComputedStyle(e), a = getComputedStyle(e, '::before'), z = getComputedStyle(e, '::after');
        return { face: c.backgroundImage.indexOf('gradient') >= 0, rad: parseFloat(c.borderTopLeftRadius), screws: [a.content, a.width, a.display, z.content, z.width, z.display] }; };
      const win = id => { const e = document.getElementById(id), c = getComputedStyle(e);
        return { color: c.color, bg: c.backgroundImage, h: e.getBoundingClientRect().height, shown: !!e.offsetParent }; };
      return { deck: strip('deck'), lib: strip('library'), take: win('takeStat'), stat: win('libStat'), pos: win('libPos'),
        sw: document.documentElement.scrollWidth, iw: innerWidth };
    }"""
    DK_LAMP = "id => { const s = getComputedStyle(document.getElementById(id), '::before'); return { bg: s.backgroundColor, anim: s.animationName, w: s.width }; }"
    def _dk_rgbs(s): return [[int(float(v)) for v in m.split(",")[:3]] for m in __import__("re").findall(r"rgba?\(([^)]*)\)", s)]
    def _dk_lum(c):
        c = [v / 255 for v in c]; c = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    def _dk_con(fg, bgimg):
        # the lightest stop of the window's gradient is the worst case for the amber text
        f = _dk_lum(_dk_rgbs(fg)[0]); bk = max(_dk_lum(c) for c in (_dk_rgbs(bgimg) or [[255, 255, 255]]))
        return (max(f, bk) + 0.05) / (min(f, bk) + 0.05)
    dctx = b.new_context(viewport={"width": 1366, "height": 1000}); dp = dctx.new_page(); derr = []
    dp.on("pageerror", lambda e: derr.append(str(e)))
    dp.goto(BASE); dp.wait_for_function("window.__synth && __synth.ready()", timeout=30000)
    dk = dp.evaluate(DK_MEAS)
    ck("Dk. the MIDI deck and song library are faceplates with two screws each (desktop)",
       all(s["face"] and s["rad"] >= 5 and s["screws"][1] == "9px" and s["screws"][4] == "9px" and s["screws"][2] != "none" and s["screws"][5] != "none"
           for s in (dk["deck"], dk["lib"])), (dk["deck"], dk["lib"]))
    dk_con = [_dk_con(dk[k]["color"], dk[k]["bg"]) for k in ("take", "stat")]
    ck(f"Dk. the take and song readouts are recessed windows with readable amber text (contrast {min(dk_con):.1f}:1 or more)",
       all(dk[k]["shown"] and dk[k]["h"] >= 24 and "gradient" in dk[k]["bg"] for k in ("take", "stat")) and min(dk_con) >= 4.5, (dk["take"], dk["stat"], dk_con))
    ck("Dk. an empty readout (no song position yet) is hidden, not an empty window", not dk["pos"]["shown"], dk["pos"])
    lamp0 = dp.evaluate(f"({DK_LAMP})('takeStat')"); llamp0 = dp.evaluate(f"({DK_LAMP})('libStat')")
    dp.click("#recBtn"); dp.wait_for_timeout(120); armed = dp.evaluate(f"({DK_LAMP})('takeStat')")
    dp.evaluate("__synth.noteOn(60, 0.8)"); dp.wait_for_timeout(400); dp.evaluate("__synth.noteOff(60)"); dp.wait_for_timeout(250)
    live = dp.evaluate(f"({DK_LAMP})('takeStat')"); was_live = dp.evaluate("document.getElementById('recBtn').classList.contains('live')")
    dp.click("#stopBtn"); dp.wait_for_timeout(250); ready = dp.evaluate(f"({DK_LAMP})('takeStat')")
    dp.click("#playTake"); dp.wait_for_timeout(150); playing = dp.evaluate(f"({DK_LAMP})('takeStat')")
    dp.click("#stopBtn"); dp.wait_for_timeout(150)
    ck("Dk. the deck lamp: dark with no take, dim red armed, pulsing red recording, amber with a take, green playing",
       lamp0["w"] == "7px" and _dk_lum(_dk_rgbs(lamp0["bg"])[0]) < 0.05 and armed["bg"] == "rgb(168, 60, 60)" and armed["anim"] == "none"
       and was_live and live["bg"] == "rgb(255, 92, 92)" and live["anim"] == "deckRec" and ready["bg"] == "rgb(255, 179, 71)" and playing["bg"] == "rgb(0, 255, 157)",
       (lamp0, armed, was_live, live, ready, playing))
    dp.wait_for_function("() => __synth.player && __synth.player().ready()", timeout=10000)
    dp.click("#libBtn")
    dp.wait_for_function("() => [...document.querySelectorAll('#libPick option')].some(o => o.value === 'beethoven-sym5-i')")
    dp.select_option("#libPick", "beethoven-sym5-i")
    dp.wait_for_function("() => { const s = __synth.player().song(); return !!(s && s.name.indexOf('Symphony') >= 0); }", timeout=5000)
    lready = dp.evaluate(f"({DK_LAMP})('libStat')")
    dp.click("#libPlay"); dp.wait_for_timeout(300); lplay = dp.evaluate(f"({DK_LAMP})('libStat')"); pos_on = dp.evaluate(DK_MEAS)["pos"]
    dp.click("#libStop"); dp.wait_for_timeout(200)
    ck("Dk. the library lamp: dark with no song, amber with a song loaded, green while it plays; the position window appears",
       _dk_lum(_dk_rgbs(llamp0["bg"])[0]) < 0.05 and lready["bg"] == "rgb(255, 179, 71)" and lplay["bg"] == "rgb(0, 255, 157)" and pos_on["shown"],
       (llamp0, lready, lplay, pos_on))
    dp.locator("#library").screenshot(path=os.path.join(SHOTS, "synth_library_strip.png"))
    ck("Dk. no page errors (desktop strips)", not derr, derr)
    dctx.close()
    rmctx = b.new_context(viewport={"width": 1366, "height": 1000}, reduced_motion="reduce"); rmp = rmctx.new_page()
    rmp.goto(BASE); rmp.wait_for_function("window.__synth && __synth.ready()", timeout=30000)
    rmp.click("#recBtn"); rmp.evaluate("__synth.noteOn(60, 0.8)"); rmp.wait_for_timeout(400); rmp.evaluate("__synth.noteOff(60)"); rmp.wait_for_timeout(200)
    rml = rmp.evaluate(f"({DK_LAMP})('takeStat')"); rm_live = rmp.evaluate("document.getElementById('recBtn').classList.contains('live')")
    rmp.click("#stopBtn")
    ck("Dk. reduced motion: the recording lamp is red and steady, no pulse", rm_live and rml["bg"] == "rgb(255, 92, 92)" and rml["anim"] == "none", (rm_live, rml))
    rmctx.close()
    dpx = b.new_context(viewport={"width": 375, "height": 667}, is_mobile=True, has_touch=True); dpp = dpx.new_page(); dperr = []
    dpp.on("pageerror", lambda e: dperr.append(str(e)))
    dpp.goto(BASE); dpp.wait_for_function("window.__synth && __synth.ready()", timeout=30000)
    dpp.evaluate("document.getElementById('deckBtn').click(); document.getElementById('libBtn').click()"); dpp.wait_for_timeout(300)
    pk = dpp.evaluate(DK_MEAS)
    pk_con = [_dk_con(pk[k]["color"], pk[k]["bg"]) for k in ("take", "stat")]
    ck(f"Dk. on a 375 px phone the strips keep the faceplate and readouts, drop the screws, and nothing scrolls sideways (contrast {min(pk_con):.1f}:1)",
       pk["deck"]["face"] and pk["lib"]["face"] and pk["deck"]["screws"][2] == "none" and pk["lib"]["screws"][5] == "none"
       and pk["take"]["shown"] and pk["stat"]["shown"] and min(pk_con) >= 4.5 and pk["sw"] <= pk["iw"] == 375, pk)
    ck("Dk. no page errors (phone strips)", not dperr, dperr)
    dpx.close()

    # ---------------------------------------------------------------- Ob. the outboard links (graphics, 26 Oct)
    # The devices on their own pages sit in a recessed tray under the rail, each on a warm brushed plate with a cable
    # socket (never a lamp: the keys do not play them) and an arrow that says the link opens a page.
    OB_MEAS = """() => {
      const t = document.querySelector('.racklinks'), tc = getComputedStyle(t), lab = t.querySelector('.label');
      const links = [...t.querySelectorAll('.devlink')].map(a => { const c = getComputedStyle(a), s = getComputedStyle(a, '::before'), z = getComputedStyle(a, '::after'),
          sm = a.querySelector('small'), r = a.getBoundingClientRect();
        return { href: a.getAttribute('href'), title: a.title, top: Math.round(r.top), w: r.width, h: r.height, color: c.color, bg: c.backgroundImage, dur: c.transitionDuration,
          smColor: sm ? getComputedStyle(sm).color : '', smShown: !!(sm && sm.offsetParent), sock: [s.content, s.width, s.height, s.backgroundImage, s.display, s.boxShadow],
          mark: [z.content, z.display, z.transform, z.transitionDuration], radius: parseFloat(c.borderTopLeftRadius) }; });
      const rb = document.querySelector('.rail').getBoundingClientRect(), tb = t.getBoundingClientRect(), cb = document.getElementById('chassis').getBoundingClientRect();
      return { tray: { bg: tc.backgroundImage, shadow: tc.boxShadow, role: t.getAttribute('role'), label: lab ? lab.textContent : '', labelShown: !!(lab && lab.offsetParent) },
        links, railBottom: rb.bottom, trayTop: tb.top, trayBottom: tb.bottom, chassisTop: cb.top, sw: document.documentElement.scrollWidth, iw: innerWidth,
        railLamp: getComputedStyle(document.querySelector('.devbtn i')).width };
    }"""
    def _ob_stops(s):
        # solid colour stops only; the faint brushed stripes (alpha under 0.5) are not the background the text sits on
        out = []
        for m in __import__("re").findall(r"rgba?\(([^)]*)\)", s):
            v = [float(x) for x in m.split(",")]
            if len(v) < 4 or v[3] >= 0.5: out.append([int(x) for x in v[:3]])
        return out
    def _ob_con(fg, bgimg):
        f = _dk_lum(_dk_rgbs(fg)[0]); bk = max(_dk_lum(c) for c in (_ob_stops(bgimg) or [[255, 255, 255]]))
        return (max(f, bk) + 0.05) / (min(f, bk) + 0.05)
    OB_HREFS = ["/synth/fm/", "/synth/acid/", "/synth/hand-sculpt/", "/synth/hand-orchestra/", "/synth/hand-aether/", "/synth/iris/"]
    octx = b.new_context(viewport={"width": 1366, "height": 1000}); op = octx.new_page(); oerr = []
    op.on("pageerror", lambda e: oerr.append(str(e)))
    op.goto(BASE); op.wait_for_function("window.__synth && __synth.ready()", timeout=30000)
    ob = op.evaluate(OB_MEAS); L = ob["links"]
    ck("Ob. six outboard links, same pages as before, each titled as opening its own page",
       [l["href"] for l in L] == OB_HREFS and all("own page" in l["title"] for l in L), [(l["href"], l["title"]) for l in L])
    ck("Ob. the outboard tray is recessed and labelled (desktop)",
       "gradient" in ob["tray"]["bg"] and "inset" in ob["tray"]["shadow"] and ob["tray"]["role"] == "group"
       and ob["tray"]["label"].strip().lower() == "outboard" and ob["tray"]["labelShown"] and ob["trayTop"] >= ob["railBottom"] and ob["trayBottom"] <= ob["chassisTop"], ob["tray"])
    ck("Ob. each outboard link has a cable socket and an opens-a-page arrow, and no lamp; rail buttons keep theirs",
       all(l["sock"][1] == "10px" and l["sock"][2] == "10px" and "radial-gradient" in l["sock"][3] and l["sock"][4] != "none"
           and "↗" in l["mark"][0] and l["mark"][1] != "none" and "gradient" in l["bg"] for l in L) and ob["railLamp"] == "7px",
       [(l["sock"], l["mark"]) for l in L][:2])
    ck("Ob. at 1366 px the six outboard links sit on one row", len({l["top"] for l in L}) == 1, [l["top"] for l in L])
    ob_con = [_ob_con(l["color"], l["bg"]) for l in L] + [_ob_con(l["smColor"], l["bg"]) for l in L]
    ck(f"Ob. outboard names and descriptions are readable on their plates (contrast {min(ob_con):.1f}:1 or more)", min(ob_con) >= 4.5, ob_con)
    op.hover(".racklinks .devlink >> nth=1")
    # Wait for the hover to land and its 120 ms transition to finish rather than a fixed 250 ms: on a
    # busy machine the hover style arrived late or mid-transition (26 Oct: rgb(252, 177, 71) at 250 ms).
    try: op.wait_for_function("() => { const a = document.querySelectorAll('.racklinks .devlink')[1]; return getComputedStyle(a).borderTopColor === 'rgb(255, 179, 71)' && getComputedStyle(a, '::before').boxShadow.indexOf('255, 179, 71, 0.7)') >= 0; }", timeout=3000)
    except Exception: pass
    hov = op.evaluate("() => { const a = document.querySelectorAll('.racklinks .devlink')[1]; return [getComputedStyle(a, '::before').boxShadow, getComputedStyle(a).borderTopColor, getComputedStyle(a, '::after').transform]; }")
    op.mouse.move(5, 995); op.evaluate("document.querySelectorAll('.racklinks .devlink')[2].focus()"); op.keyboard.press("Tab")
    try: op.wait_for_function("() => getComputedStyle(document.activeElement, '::before').boxShadow.indexOf('255, 179, 71, 0.7)') >= 0", timeout=3000)
    except Exception: pass
    foc = op.evaluate("() => { const a = document.activeElement; return [a.getAttribute('href'), a.matches(':focus-visible'), getComputedStyle(a, '::before').boxShadow]; }")
    ck("Ob. hover and keyboard focus light the socket's ring amber and nudge the arrow",
       "255, 179, 71" in hov[0] and hov[1] == "rgb(255, 179, 71)" and hov[2] != "none" and foc[0] == "/synth/hand-orchestra/" and foc[1] and "255, 179, 71" in foc[2], (hov, foc))
    op.locator(".racklinks").screenshot(path=os.path.join(SHOTS, "synth_outboard.png"))
    ck("Ob. no page errors (desktop outboard)", not oerr, oerr)
    octx.close()
    orm = b.new_context(viewport={"width": 1366, "height": 1000}, reduced_motion="reduce"); orp = orm.new_page()
    orp.goto(BASE); orp.wait_for_function("window.__synth && __synth.ready()", timeout=30000)
    orp.hover(".racklinks .devlink >> nth=0"); orp.wait_for_timeout(150); obr = orp.evaluate(OB_MEAS)["links"][0]
    ck("Ob. reduced motion: no transitions on the outboard plates and the arrow stays put on hover",
       all(float(d.rstrip("s")) == 0 for d in obr["dur"].split(",")) and float(obr["mark"][3].split(",")[0].rstrip("s")) == 0 and obr["mark"][2] == "none", obr)
    orm.close()
    opx = b.new_context(viewport={"width": 375, "height": 667}, is_mobile=True, has_touch=True); opp = opx.new_page(); operr = []
    opp.on("pageerror", lambda e: operr.append(str(e)))
    opp.goto(BASE); opp.wait_for_function("window.__synth && __synth.ready()", timeout=30000)
    obp = opp.evaluate(OB_MEAS); LP = obp["links"]
    ck("Ob. on a 375 px phone the outboard links are 44 px targets with socket and arrow, the label and descriptions drop, nothing scrolls sideways",
       all(l["h"] >= 44 and l["w"] >= 44 and l["sock"][4] != "none" and "↗" in l["mark"][0] and not l["smShown"] for l in LP)
       and not obp["tray"]["labelShown"] and obp["sw"] <= obp["iw"] == 375 and obp["trayBottom"] <= obp["chassisTop"], obp)
    ck("Ob. no page errors (phone outboard)", not operr, operr)
    opx.close()

    # ---------------------------------------------------------------- Rl. the desktop rail (graphics, 27 Oct)
    # The rail is a recessed bay with an engraved RACK plate and even module plates: nine across from 1340 px (two rows
    # of nine), six across below (three rows), the role dropped under 960 px. The phone keeps its one-row scrolling strip.
    RL_MEAS = """() => {
      const rail = document.querySelector('.rail'), bay = rail.querySelector('.rail-bay'), lab = rail.querySelector('.label');
      const bs = [...rail.querySelectorAll('.devbtn')].map(b => { const r = b.getBoundingClientRect(), c = getComputedStyle(b), sm = b.querySelector('small');
        return { d: b.dataset.d, left: Math.round(r.left), top: Math.round(r.top), w: r.width, h: r.height, clip: b.scrollWidth > b.clientWidth + 1,
          smClip: !!(sm && sm.offsetParent && sm.scrollWidth > sm.clientWidth + 1), smShown: !!(sm && sm.offsetParent), color: c.color, bg: c.backgroundImage,
          smColor: sm ? getComputedStyle(sm).color : '', pressed: b.getAttribute('aria-pressed'), border: c.borderTopColor, shadow: c.boxShadow,
          lamp: getComputedStyle(b.querySelector('i')).boxShadow, dur: c.transitionDuration }; });
      const rr = rail.getBoundingClientRect(), lr = lab.getBoundingClientRect(), br = bay.getBoundingClientRect(), rc = getComputedStyle(rail);
      return { bs, rail: { h: rr.height, bg: rc.backgroundImage, shadow: rc.boxShadow }, label: { shown: !!lab.offsetParent, h: lr.height, wm: getComputedStyle(lab).writingMode, text: lab.textContent },
        bayH: br.height, bayDisplay: getComputedStyle(bay).display, sw: document.documentElement.scrollWidth, iw: innerWidth,
        chassisTop: document.getElementById('chassis').getBoundingClientRect().top };
    }"""
    def _rl_grid(m):
        bs = m["bs"]; tops = sorted({x["top"] for x in bs}); lefts = sorted({x["left"] for x in bs})
        per_row = [sum(1 for x in bs if x["top"] == t) for t in tops]
        return tops, lefts, per_row, max(x["w"] for x in bs) - min(x["w"] for x in bs)
    rctx = b.new_context(viewport={"width": 1366, "height": 1000}); rp = rctx.new_page(); rerr = []
    rp.on("pageerror", lambda e: rerr.append(str(e)))
    rp.goto(BASE); rp.wait_for_function("window.__synth && __synth.ready()", timeout=30000)
    rl = rp.evaluate(RL_MEAS); tops, lefts, per_row, wspread = _rl_grid(rl)
    info("Rl. 1366 px rail", f"{len(rl['bs'])} plates, rows {per_row}, plate {rl['bs'][0]['w']:.0f}x{rl['bs'][0]['h']:.0f}, rail {rl['rail']['h']:.0f} px tall, chassis top {rl['chassisTop']:.0f}")
    ck("Rl. at 1366 px the rail is two even rows of nine plates, one width, columns in line",
       len(rl["bs"]) == 18 and per_row == [9, 9] and len(lefts) == 9 and wspread <= 1, (per_row, lefts, wspread))
    ck("Rl. every rail plate is a 44 px target and no name or role is clipped (1366 px)",
       all(x["h"] >= 44 and x["w"] >= 44 and not x["clip"] and not x["smClip"] and x["smShown"] for x in rl["bs"]), [(x["d"], x["w"], x["h"], x["clip"], x["smClip"]) for x in rl["bs"] if x["clip"] or x["smClip"] or x["h"] < 44])
    ck("Rl. the rail is a recessed bay with an engraved RACK plate standing the full height of the plates",
       "gradient" in rl["rail"]["bg"] and "inset" in rl["rail"]["shadow"] and rl["label"]["shown"] and rl["label"]["text"].strip().lower() == "rack"
       and rl["label"]["wm"].startswith("vertical") and rl["label"]["h"] >= rl["bayH"] - 1 and rl["rail"]["h"] <= 120, (rl["rail"], rl["label"], rl["bayH"]))
    unlit = [x for x in rl["bs"] if x["pressed"] != "true"]; lit = [x for x in rl["bs"] if x["pressed"] == "true"]
    rl_con = [_ob_con(x["color"], x["bg"]) for x in unlit] + [_ob_con(x["smColor"], x["bg"]) for x in unlit]
    info("Rl. contrast names, roles", [round(min(rl_con[:len(unlit)]),1), round(min(rl_con[len(unlit):]),1)]); ck(f"Rl. unlit plates are brushed faces and their names and roles read on them (contrast {min(rl_con):.1f}:1 or more)",
       all("gradient" in x["bg"] for x in unlit) and min(rl_con) >= 4.5, rl_con)
    ck("Rl. the lit plate keeps its amber border and glowing lamp, with a soft halo", len(lit) == 1 and lit[0]["d"] == "filament"
       and lit[0]["border"] == "rgb(255, 179, 71)" and "255, 179, 71" in lit[0]["lamp"] and lit[0]["shadow"] != "none", lit)
    rp.hover(".rail .devbtn[data-d=klystron]")
    try: rp.wait_for_function("() => getComputedStyle(document.querySelector('.devbtn[data-d=klystron]')).borderTopColor === 'rgb(87, 80, 74)'", timeout=3000)
    except Exception: pass
    hv = rp.evaluate("() => { const b = document.querySelector('.devbtn[data-d=klystron]'); return [getComputedStyle(b).borderTopColor, getComputedStyle(b).color, getComputedStyle(b.querySelector('i')).boxShadow]; }")
    ck("Rl. hover warms an unlit plate's edge, brightens its name and rings its lamp", hv[0] == "rgb(87, 80, 74)" and hv[1] == "rgb(226, 226, 226)" and "255, 179, 71" in hv[2], hv)
    rp.click(".rail .devbtn[data-d=geissler]"); rp.wait_for_timeout(300)
    rg = rp.evaluate(RL_MEAS)
    ck("Rl. picking a device lights its plate and leaves the grid as it was",
       [x["d"] for x in rg["bs"] if x["pressed"] == "true"] == ["geissler"] and _rl_grid(rg)[2] == [9, 9] and rg["bs"][0]["left"] == rl["bs"][0]["left"], [x["d"] for x in rg["bs"] if x["pressed"] == "true"])
    rp.locator(".rail").screenshot(path=os.path.join(SHOTS, "synth_rail.png"))
    for w, want, role in [(1024, [6, 6, 6], True), (800, [6, 6, 6], False), (1920, [9, 9], True)]:
        rp.set_viewport_size({"width": w, "height": 900}); rp.wait_for_timeout(250)
        rw = rp.evaluate(RL_MEAS); g = _rl_grid(rw)
        ck(f"Rl. at {w} px the rail is even rows {want}, no plate clipped, {'roles shown' if role else 'names only'}, no sideways scroll",
           g[2] == want and g[3] <= 1 and all(not x["clip"] and not x["smClip"] and x["smShown"] == role and x["h"] >= 44 for x in rw["bs"]) and rw["sw"] <= rw["iw"],
           (g[2], g[3], [(x["d"], x["w"]) for x in rw["bs"] if x["clip"] or x["smClip"]], rw["sw"]))
    ck("Rl. no page errors (desktop rail)", not rerr, rerr)
    rctx.close()
    rrm = b.new_context(viewport={"width": 1366, "height": 1000}, reduced_motion="reduce"); rrp = rrm.new_page()
    rrp.goto(BASE); rrp.wait_for_function("window.__synth && __synth.ready()", timeout=30000)
    ck("Rl. reduced motion: no transitions on the rail plates", all(float(d.rstrip("s")) == 0 for x in rrp.evaluate(RL_MEAS)["bs"] for d in x["dur"].split(",")))
    rrm.close()
    rpx = b.new_context(viewport={"width": 375, "height": 667}, is_mobile=True, has_touch=True); rpp = rpx.new_page(); rperr = []
    rpp.on("pageerror", lambda e: rperr.append(str(e)))
    rpp.goto(BASE); rpp.wait_for_function("window.__synth && __synth.ready()", timeout=30000)
    rm_ = rpp.evaluate(RL_MEAS)
    ck("Rl. on a 375 px phone the rail stays one scrolling row of 44 px targets, the bay wrapper adds no box, nothing scrolls sideways",
       len({x["top"] for x in rm_["bs"]}) == 1 and all(x["h"] >= 44 and x["w"] >= 44 for x in rm_["bs"]) and rm_["bayDisplay"] == "contents"
       and not rm_["label"]["shown"] and rm_["sw"] <= rm_["iw"] == 375, (rm_["bayDisplay"], rm_["sw"], [(x["d"], x["w"], x["h"]) for x in rm_["bs"]][:4]))
    ck("Rl. no page errors (phone rail)", not rperr, rperr)
    rpx.close()

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
    # Wait for the note rather than a fixed 350 ms: on a quiet page it shows in the meter 20 to 80 ms
    # after play (measured 26 Oct), but on this busy page a fixed wait read it before it landed once.
    hold_ms = pg.evaluate("""() => new Promise(res => { const t0 = performance.now(); __synth.player().play();
      const tick = () => { const m = __synth.engine().meters.filament; if (__synth.player().playing() && (m.notes || []).indexOf(60) >= 0) return res(performance.now() - t0);
        if (performance.now() - t0 > 3000) return res(-1); setTimeout(tick, 10); }; tick(); })""")
    hst = pg.evaluate("() => ({ playing: __synth.player().playing(), notes: __synth.engine().meters.filament.notes, state: __synth.engine().ctx.state })")
    ck(f"library playback is holding its note (in the meter {hold_ms:.0f} ms after play, want within 3 s)", hold_ms >= 0 and hst["playing"] and 60 in (hst["notes"] or []), hst)
    pg.evaluate("__synth.transport().setTempo(90)"); pg.wait_for_timeout(200)
    pg.evaluate("__synth.player().stop()"); pg.wait_for_timeout(200)
    ck("library stop after a tempo change leaves no note",
       not pg.evaluate("__synth.player().playing()") and pg.evaluate("__synth.engine().meters.filament.notes") == [])
    # Review R1020-1: the library bound to the transport only after every rack device attached, so a
    # Play pressed in that window ran the transport and played nothing. Hold the last device's worklet back.
    hctx = b.new_context(viewport={"width": 1366, "height": 900})
    hctx.add_init_script("""(() => {
      const add = AudioWorklet.prototype.addModule; let go; const gate = new Promise(r => { go = r; });
      window.__held = 0; window.__release = () => go();
      AudioWorklet.prototype.addModule = function (url, o) {
        if (String(url).includes('resnatron.worklet')) { window.__held++; return gate.then(() => add.call(this, url, o)); }
        return add.call(this, url, o);
      };
    })()""")
    hp = hctx.new_page(); herr = []; hp.on("pageerror", lambda e: herr.append(str(e)))
    hp.goto(BASE); hp.wait_for_function("window.__synth && __synth.ready() && __synth.player().ready()", timeout=20000)
    hp.wait_for_function("__synth.player().library().length > 0", timeout=5000)
    hp.evaluate("""async () => { await __synth.player().loadId('dx-dock-lamp'); await __synth.engine().ctx.resume(); }""")
    hp.wait_for_function("window.__held >= 1", timeout=20000)
    early = {"held": hp.evaluate("window.__held")}
    hp.click("#libPlay"); hp.wait_for_timeout(500)
    early.update(hp.evaluate("""() => ({ playing: __synth.player().playing(), transport: __synth.transport().state().playing, pressed: document.getElementById('libPlay').getAttribute('aria-pressed') })"""))
    ck("P. Play before every device has attached starts the song", early["held"] >= 1 and early["playing"] and early["pressed"] == "true", early)
    hp.click("#libStop"); hp.wait_for_timeout(100)
    hp.evaluate("window.__release()"); hp.wait_for_timeout(300)
    ck("P. no page errors with a late device", not herr, herr)
    hctx.close()
    # Review R1030-1 and R1030-2, in a fresh page so no device has been on the rail yet.
    # R1030-1: a channel routed to a hosted device off the rail (Lattice, Resnatron) played
    # nothing, because the player woke only Filament and Cathode (strip peak 0 before the fix).
    # R1030-2: after a song with hits on Dekatron, the stop's panic stayed queued for the next
    # play and disarmed the step pattern the same transport event had just armed.
    wctx = b.new_context(viewport={"width": 1366, "height": 900})
    wp = wctx.new_page(); werr = []; wp.on("pageerror", lambda e: werr.append(str(e)))
    wp.goto(BASE); wp.wait_for_function("window.__synth && __synth.ready() && __synth.player().ready()", timeout=20000)
    wp.mouse.click(5, 5)
    wp.wait_for_function("__synth.booted()", timeout=40000)
    wp.evaluate("""async () => { await __synth.player().loadId('dx-dock-lamp'); await __synth.engine().ctx.resume(); }""")
    woke = {}
    for d in ("lattice", "resnatron"):
        wp.evaluate("d => { [1, 2, 3].forEach(c => __synth.player().route(c, d)); __synth.player().play(); }", d)
        woke[d] = wp.evaluate("""async d => { let mx = 0; for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 50));
          mx = Math.max(mx, __synth.stripMeters()[d] || 0); } return mx; }""", d)
        wp.evaluate("__synth.player().stop()"); wp.wait_for_timeout(400)
    woke["rail"] = wp.evaluate("__synth.device()")
    ck("P. a channel routed to Lattice or Resnatron off the rail sounds (review R1030-1)",
       woke["rail"] == "filament" and woke["lattice"] > 0.02 and woke["resnatron"] > 0.02, woke)
    wp.evaluate("""async () => { await __synth.player().loadId('joplin-the-entertainer'); }""")
    drum = {"ch10": wp.evaluate("__synth.player().routing()['10']")}
    wp.evaluate("__synth.player().play()"); wp.wait_for_timeout(1000)
    drum["first"] = wp.evaluate("__synth.drumMeter().playing")
    wp.evaluate("__synth.player().stop()"); wp.wait_for_timeout(300)
    wp.evaluate("__synth.player().play()"); wp.wait_for_timeout(700)
    drum["again"] = wp.evaluate("__synth.drumMeter().playing")
    wp.evaluate("__synth.player().stop()"); wp.wait_for_timeout(200)
    ck("P. Dekatron's pattern still follows the transport after a song with drum hits (review R1030-2)",
       drum["ch10"] == "dekatron" and drum["first"] and drum["again"], drum)
    ck("P. no page errors waking hosted devices from the library", not werr, werr)
    wctx.close()

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
       and {"filament", "cathode", "thyratron", "gleam", "dekatron", "lattice", "mote"} <= set(desc["ids"]), desc)
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
    # Review 25 Oct (R1025-2): the amount slider read "Amount for lfo1 to osc1.pos" and every
    # remove button read "Remove". Both name the route the way the row shows it.
    lat_names = pg.evaluate("""() => [...document.querySelectorAll('.lat-slot')].map(r => [
      r.querySelector('input[type=range]').getAttribute('aria-label'),
      r.querySelector('button').getAttribute('aria-label')])""")
    ck("W. matrix amount and remove controls name their route in words",
       ["Amount, LFO 1 to Osc A position", "Remove LFO 1 to Osc A position"] in lat_names
       and all(a and b and "." not in a and "." not in b for a, b in lat_names)
       and len(set(b for _a, b in lat_names)) == len(lat_names), lat_names)
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
    # Every precache asset must load, or cache.addAll rejects and the worker never installs.
    # (context.route() does not see service-worker fetches, so the test server answers
    # /favicon.svg itself; see SynthHandler.)
    import re as _re, urllib.request as _ur
    with open(os.path.join(ROOT, "sw.js"), encoding="utf-8") as fh:
        _m = _re.search(r"STATIC_ASSETS\s*=\s*\[(.*?)\]", fh.read(), _re.S)
    precache = _re.findall(r"'([^']+)'", _m.group(1)) if _m else []
    bad = []
    for a in precache:
        try:
            with _ur.urlopen(f"http://127.0.0.1:{PORT}{a}", timeout=10) as r:
                if r.status != 200: bad.append((a, r.status))
        except Exception as e:
            bad.append((a, str(e)[:80]))
    ck("slashless /synth: every sw.js precache asset loads (200)", precache and not bad, (precache, bad))
    sctx = b.new_context()
    sp = sctx.new_page(); serr = []
    sp.on("pageerror", lambda e: serr.append(str(e)))
    sp.goto(BASE)
    controlled = sp.evaluate("""async () => {
      await navigator.serviceWorker.register('/sw.js');
      // A failed install leaves ready pending forever; give up after 15 s instead of hanging the suite.
      const ok = await Promise.race([navigator.serviceWorker.ready.then(() => true),
                                     new Promise(r => setTimeout(() => r(false), 15000))]);
      if (!ok) return false;
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
        # A render that never settles (the HRTF load deadlock, see hrtfSettled in gleam-ui.js)
        # fails here after 60 s instead of stalling the suite. NaN output fails every check on it.
        raw = pg.evaluate(
            """async ({patch, events, seconds}) => Promise.race([
                 __synth.gleamRender({patch, events, seconds, sampleRate: 48000}),
                 new Promise(res => setTimeout(() => res(null), 60000))])""",
            {"patch": patch, "events": events, "seconds": seconds},
        )
        if raw is None:
            ck(f"G. an offline render finishes inside 60 s (hrtf {bool(patch.get('hrtf'))}, {seconds} s)", False, "timed out")
            nan = np.full(int(seconds * 48000), np.nan)
            return nan, nan.copy()
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

    gen = pg.evaluate("""async () => {
      const g = await import('/synth/gleam.js');
      const pt = (over, t) => g.generatorPoint(Object.assign({ device: 'gleam', scale: 'major', root: 0, octaves: 1 }, over), t);
      const orbit0 = pt({ generator: 'orbit', rate: 1, depth: 1, seed: 0 }, 0);
      const orbitQ = pt({ generator: 'orbit', rate: 1, depth: 1, seed: 0 }, 0.25);
      const orbitSeed = pt({ generator: 'orbit', rate: 1, depth: 1, seed: 157 }, 0);
      const still = pt({ generator: 'orbit', rate: 1, depth: 0, seed: 4 }, 0.4);
      const walkA = pt({ generator: 'walk', rate: 2, depth: 1, seed: 3 }, 0.4);
      const walkA2 = pt({ generator: 'walk', rate: 2, depth: 1, seed: 3 }, 0.4);
      const walkB = pt({ generator: 'walk', rate: 2, depth: 1, seed: 9 }, 0.4);
      const walk0 = pt({ generator: 'walk', rate: 2, depth: 0, seed: 3 }, 0.4);
      const lis0 = pt({ generator: 'lissajous', rate: 1, depth: 1, seed: 1 }, 0);
      const lisH = pt({ generator: 'lissajous', rate: 1, depth: 1, seed: 1 }, 0.5);
      const drift0 = pt({ generator: 'drift', rate: 1, depth: 0, seed: 2 }, 1.2);
      const drift1 = pt({ generator: 'drift', rate: 1.2, depth: 1, seed: 2 }, 1.2);
      const up = [0, 0.5, 1, 1.5, 2, 2.5, 3].map(t => pt({ generator: 'arp', rate: 2, depth: 1, seed: 0 }, t).midi);
      const down0 = pt({ generator: 'arp', rate: 2, depth: 1, seed: 1 }, 0).midi;
      const off = g.generatorPoint({ generator: 'off' }, 1);
      const norm = g.normalizeGleam({ rate: 99, seed: -4, generator: 'nope', hold: 1, depth: 3 });
      const bare = g.normalizeGleam({});
      const params = g.gleamDevice.parameters;
      return {
        ox: orbit0.x, oy: orbit0.y, qx: orbitQ.x, qy: orbitQ.y, sx: orbitSeed.x, sy: orbitSeed.y,
        stillX: still.x, stillY: still.y,
        wax: walkA.x, way: walkA.y, same: walkA.x === walkA2.x && walkA.y === walkA2.y,
        wbx: walkB.x, wby: walkB.y, w0x: walk0.x, w0y: walk0.y,
        lx0: lis0.x, ly0: lis0.y, lx1: lisH.x, ly1: lisH.y,
        d0x: drift0.x, d0y: drift0.y, d1x: drift1.x, d1y: drift1.y,
        up, down0, off: off == null,
        gen: norm.generator, rate: norm.rate, seed: norm.seed, hold: norm.hold, depth: norm.depth,
        bareGen: bare.generator, bareHold: bare.hold,
        holdType: params.hold.type, choices: params.generator.choices, api: g.gleamDevice.api,
        msgs: g.gleamDevice.messages,
      };
    }""")
    ck("G. orbit, lissajous, drift and a random walk are seeded and stay inside the pad",
       abs(gen["ox"] - 0.98) < 1e-9 and abs(gen["oy"] - 0.5) < 1e-9
       and abs(gen["qx"] - 0.5) < 1e-9 and abs(gen["qy"] - 0.98) < 1e-9
       and abs(gen["sx"] - 0.5) < 0.02 and gen["sy"] > 0.9
       and abs(gen["stillX"] - 0.5) < 1e-9 and abs(gen["stillY"] - 0.5) < 1e-9
       and gen["same"] and (abs(gen["wax"] - gen["wbx"]) > 0.02 or abs(gen["way"] - gen["wby"]) > 0.02)
       and abs(gen["w0x"] - 0.5) < 1e-9 and abs(gen["w0y"] - 0.5) < 1e-9
       and 0 <= gen["wax"] <= 1 and 0 <= gen["way"] <= 1
       and abs(gen["lx0"] - 0.5) < 1e-9 and abs(gen["ly0"] - 0.5) > 0.05
       and abs(gen["lx1"] - 0.5) < 1e-6 and abs(gen["ly1"] - gen["ly0"]) > 0.05
       and abs(gen["d0x"] - 0.5) < 1e-9 and abs(gen["d0y"] - 0.5) < 1e-9
       and (abs(gen["d1x"] - 0.5) > 0.02 or abs(gen["d1y"] - 0.5) > 0.02)
       and gen["off"] is True, gen)
    ck("G. an arpeggio climbs the scale, and a different seed starts at the top",
       gen["up"] == [48, 50, 52, 53, 55, 57, 59] and gen["down0"] == 59, gen)
    ck("G. hold and the generator are patch parameters on the same dxrack/1 device",
       gen["bareGen"] == "off" and gen["bareHold"] is False and gen["gen"] == "off"
       and gen["rate"] == 8 and gen["seed"] == 0 and gen["hold"] is True and gen["depth"] == 1
       and gen["holdType"] == "boolean" and gen["api"] == "dxrack/1"
       and gen["choices"] == ["off", "walk", "orbit", "lissajous", "drift", "arp"]
       and gen["msgs"] == ["patch", "voice", "on", "off", "panic", "active"], gen)

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
    farL, farR = g_render({"device": "gleam", "mode": "room", "reverb": 0, "level": 0.85, "glide": 0}, [
        {"at": 0.02, "type": "on", "id": "o", "x": 0, "y": 1, "z": 1, "hz": 220, "room": True}], 0.6)
    ck("G. a near orb is louder than the same orb farther from the listener",
       g_rms(nearL, 0.2, 0.5) > g_rms(farL, 0.2, 0.5) * 2 and g_rms(farL, 0.2, 0.5) > 1e-3
       and abs(g_rms(farL, 0.2, 0.5) - g_rms(farR, 0.2, 0.5)) / g_rms(farL, 0.2, 0.5) < 0.05,
       (g_rms(nearL, 0.2, 0.5), g_rms(farL, 0.2, 0.5), g_rms(farR, 0.2, 0.5)))
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
    silL, _silR = g_render(dict(base_p), [], 0.4)
    ck("G. a generator that is off stays silent with no fingers", g_rms(silL, 0.05, 0.35) < 1e-4, g_rms(silL, 0.05, 0.35))
    holdL, _holdR = g_render(dict(base_p, hold=True), held + [{"at": 0.2, "type": "off", "id": "a"}], 0.9)
    freeL, _freeR = g_render(dict(base_p, hold=False), held + [{"at": 0.2, "type": "off", "id": "a"}], 0.9)
    ck("G. hold keeps the note after the finger lifts, and hold off lets it go",
       g_rms(holdL, 0.45, 0.8) > 0.02 and g_rms(freeL, 0.45, 0.8) < 1e-4, (g_rms(holdL, 0.45, 0.8), g_rms(freeL, 0.45, 0.8)))
    bothHold, _bhR = g_render(dict(base_p, hold=True), [
        {"at": 0.02, "type": "on", "id": "c", "x": 0, "y": 0, "z": 0.9},
        {"at": 0.02, "type": "on", "id": "e", "x": 0.28, "y": 0.2, "z": 0.9},
        {"at": 0.25, "type": "off", "id": "c"},
        {"at": 0.25, "type": "up", "id": "e"},
    ], 0.8)
    bothSl = bothHold[int(0.4 * SR):int(0.7 * SR)]
    ck("G. hold latches every finger that lifts",
       tone_amp(bothSl, 130.8128) > 0.015 and tone_amp(bothSl, 164.8138) > 0.01, (tone_amp(bothSl, 130.8128), tone_amp(bothSl, 164.8138)))
    panicHold, _phR = g_render(dict(base_p, hold=True), held + [{"at": 0.15, "type": "off", "id": "a"}, {"at": 0.4, "type": "panic"}], 0.9)
    ck("G. panic releases a held note",
       g_rms(panicHold, 0.2, 0.35) > 0.02 and g_rms(panicHold, 0.55, 0.8) < 1e-4,
       (g_rms(panicHold, 0.2, 0.35), g_rms(panicHold, 0.55, 0.8)))
    arp_p = dict(base_p, generator="arp", rate=2, depth=1, seed=0, glide=0, level=0.9)
    arpL, arpR = g_render(arp_p, [], 1.2)
    f_c = peak_freq(arpL[int(0.12 * SR):int(0.4 * SR)])
    f_d = peak_freq(arpL[int(0.62 * SR):int(0.9 * SR)])
    ck(f"G. an arpeggio plays the scale by itself ({f_c:.1f} Hz then {f_d:.1f} Hz)",
       abs(cents(f_c, 130.8128)) < 20 and abs(cents(f_d, 146.8324)) < 20
       and bool(np.isfinite(arpL).all() and np.isfinite(arpR).all()) and float(np.max(np.abs(arpL))) <= 1.001,
       (f_c, f_d))
    mixL, mixR = g_render(arp_p, [{"at": 0.0, "type": "on", "id": "finger", "x": 0, "y": 0.1, "z": 1}], 1.2)
    mixSl = mixL[int(0.62 * SR):int(0.9 * SR)]
    ck("G. the generator and a finger sound together",
       tone_amp(mixSl, 130.8128) > 0.015 and tone_amp(mixSl, 146.8324) > 0.01
       and float(np.max(np.abs(mixL))) <= 1.001 and bool(np.isfinite(mixR).all()),
       (tone_amp(mixSl, 130.8128), tone_amp(mixSl, 146.8324)))
    orbL, _orbR = g_render(dict(base_p, generator="orbit", rate=0.15, depth=1, seed=0, scale="free", octaves=2, glide=0), [], 0.35)
    ck("G. orbit moves the point and is not silent", g_rms(orbL, 0.08, 0.3) > 0.02, g_rms(orbL, 0.08, 0.3))

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
        latch = gp.evaluate("""() => {
          document.getElementById('gleamHold').click();
          const pad = document.getElementById('gleamPad');
          const r = pad.getBoundingClientRect();
          const fire = (type, id, x, y) => pad.dispatchEvent(new PointerEvent(type, {
            pointerId: id, clientX: r.left + x, clientY: r.top + y, bubbles: true, cancelable: true,
            pointerType: 'mouse', pressure: 0.8, buttons: type === 'pointerdown' ? 1 : 0,
          }));
          fire('pointerdown', 11, 40, 50);
          fire('pointerup', 11, 40, 50);
          const held = window.__gleam.voices();
          const on = document.getElementById('gleamHold').getAttribute('aria-pressed');
          document.getElementById('gleamHold').click();
          const released = window.__gleam.voices();
          return { held, on, released, off: document.getElementById('gleamHold').getAttribute('aria-pressed') };
        }""")
        ck(f"G. {gw}px: hold keeps the voice after the pointer lifts, and a second press releases it",
           latch["held"] == 1 and latch["on"] == "true" and latch["released"] == 0 and latch["off"] == "false", latch)
        gp.evaluate("""() => {
          const sel = document.getElementById('gleamGen');
          sel.value = 'orbit';
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }""")
        gp.wait_for_timeout(120)
        gen_voices = gp.evaluate("window.__gleam.voices()")
        with_finger = gp.evaluate("""() => {
          const pad = document.getElementById('gleamPad');
          const r = pad.getBoundingClientRect();
          pad.dispatchEvent(new PointerEvent('pointerdown', {
            pointerId: 12, clientX: r.left + 30, clientY: r.top + 40, bubbles: true, cancelable: true,
            pointerType: 'mouse', pressure: 0.8, buttons: 1,
          }));
          return window.__gleam.voices();
        }""")
        gp.evaluate("document.getElementById('gleamPanic').click()")
        gp.wait_for_timeout(80)
        after_panic = gp.evaluate("""() => ({
          voices: window.__gleam.voices(),
          hold: document.getElementById('gleamHold').getAttribute('aria-pressed'),
          gen: document.getElementById('gleamGen').value,
        })""")
        ck(f"G. {gw}px: the generator plays by itself, a finger joins it, and panic clears hold",
           gen_voices >= 1 and with_finger >= 2 and after_panic["hold"] == "false" and after_panic["gen"] == "orbit"
           and after_panic["voices"] >= 1, (gen_voices, with_finger, after_panic))
        controls = gp.evaluate("""() => ['gleamHold', 'gleamPanic', 'gleamGen', 'gleamRate', 'gleamDepth', 'gleamSeed']
          .map(id => { const e = document.getElementById(id); const r = e.getBoundingClientRect(); return e.id + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); })""")
        ck(f"G. {gw}px: hold, panic and the generator controls are on the bar",
           all(c.split(' ')[0] for c in controls) and len(controls) == 6, controls)
        gp.close()

    rack_before = len(errs)
    pg.evaluate("__synth.setDevice('gleam')")
    pg.wait_for_timeout(250)
    ck("G. the rail shows the pad and hides Filament's filter",
       pg.evaluate("__synth.device()") == "gleam" and pg.is_visible("#gleamPad") and not pg.is_visible("#mFilt"))
    # Empty state (graphics, 29 Oct): an untouched field shows a hint (axis names, a pilot ring and an instruction line).
    # pad.dataset.hint is its opacity: 1 after 1.2 s of quiet, 0 while anything sounds.
    GLEAM_PIX = """(box) => { const c = document.querySelector('#gleamPad canvas'), x = c.getContext('2d');
      const s = c.width / c.clientWidth, r = c.getBoundingClientRect();
      const [bx, by, bw, bh] = box.map(v => Math.round(v * s));
      const d = x.getImageData(bx, by, bw, bh).data; let max = 0, sum = 0, best = [0, 0, 0];
      const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      for (let i = 0; i < d.length; i += 4) { const L = 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]); sum += d[i] + d[i + 1] + d[i + 2]; if (L > max) { max = L; best = [d[i], d[i + 1], d[i + 2]]; } }
      return { max, sum, best, w: c.clientWidth, h: c.clientHeight }; }"""
    pg.evaluate("() => { const h = __synth.gleam(); h.setPatch(Object.assign({}, h.patch(), { mode: 'field', hold: false, generator: 'off' })); __synth.panic(); }")
    try: pg.wait_for_function("() => +document.getElementById('gleamPad').dataset.hint >= 0.95", timeout=6000)
    except Exception: pass
    hint0 = pg.evaluate("document.getElementById('gleamPad').dataset.hint")
    gdim = pg.evaluate("() => { const c = document.querySelector('#gleamPad canvas'); return [c.clientWidth, c.clientHeight]; }")
    gcx, gcy = gdim[0] / 2, gdim[1] / 2
    title_px = pg.evaluate(GLEAM_PIX, [gcx - 90, gcy + 2, 180, 20])
    bgL = 0.2126 * (7 / 255 / 12.92) + 0.7152 * (8 / 255 / 12.92) + 0.0722 * (12 / 255 / 12.92)
    title_cr = (title_px["max"] + 0.05) / (bgL + 0.05)
    ck("G. an untouched field shows its hint, and the TOUCH TO PLAY line is readable (contrast 4.5:1 or more on the field)",
       hint0 is not None and float(hint0) >= 0.95 and title_cr >= 4.5 and title_px["best"][0] > title_px["best"][2] + 60,
       (hint0, round(title_cr, 1), title_px["best"]))
    ring_a = pg.evaluate(GLEAM_PIX, [gcx - 40, gcy - 74, 80, 80])["sum"]
    pg.wait_for_timeout(1500)
    ring_b = pg.evaluate(GLEAM_PIX, [gcx - 40, gcy - 74, 80, 80])["sum"]
    ck("G. the hint's pilot ring breathes (full motion)", ring_a != ring_b, (ring_a, ring_b))
    pg.evaluate("() => __synth.gleam().pointer('down', { id: 71, x: 0.4, y: 0.5, z: 0.8 })")
    try: pg.wait_for_function("() => +document.getElementById('gleamPad').dataset.hint === 0", timeout=3000)
    except Exception: pass
    hint_busy = pg.evaluate("document.getElementById('gleamPad').dataset.hint")
    pg.evaluate("() => { __synth.gleam().pointer('up', { id: 71, x: 0.4, y: 0.5, z: 0.8 }); __synth.panic(); }")
    try: pg.wait_for_function("() => +document.getElementById('gleamPad').dataset.hint >= 0.95", timeout=8000)
    except Exception: pass
    hint_back = pg.evaluate("document.getElementById('gleamPad').dataset.hint")
    ck("G. the hint goes while a voice sounds and comes back after the quiet", hint_busy == "0.00" and float(hint_back or 0) >= 0.95, (hint_busy, hint_back))
    for gmode, gword in (("room", "room"), ("effect", "effect")):
        pg.evaluate(f"() => {{ const h = __synth.gleam(); h.setPatch(Object.assign({{}}, h.patch(), {{ mode: '{gmode}', generator: 'off', hold: false }})); }}")
        pg.wait_for_timeout(250)
        gm = pg.evaluate("() => [document.getElementById('gleamPad').dataset.hint, __synth.gleam().patch().mode, __synth.gleam().voices() + (__synth.gleam().orbs ? __synth.gleam().orbs().length : 0)]")
        mid = pg.evaluate(GLEAM_PIX, [gcx - 110, gcy - 20, 220, 18])
        ck(f"G. {gword} mode: the untouched pad keeps a readable hint line", gm[1] == gmode and (gm[2] > 0 or float(gm[0] or 0) >= 0.95 and (mid["max"] + 0.05) / (bgL + 0.05) >= 4.5),
           (gm, round((mid["max"] + 0.05) / (bgL + 0.05), 1)))
    pg.evaluate("() => { const h = __synth.gleam(); h.setPatch(Object.assign({}, h.patch(), { mode: 'field' })); }")
    grm = b.new_context(viewport={"width": 1366, "height": 1000}, reduced_motion="reduce"); grp = grm.new_page(); grerr = []
    grp.on("pageerror", lambda e: grerr.append(str(e)))
    grp.goto(BASE); grp.wait_for_function("window.__synth && __synth.ready()", timeout=20000)
    grp.evaluate("__synth.setDevice('gleam')")
    try: grp.wait_for_function("() => document.getElementById('gleamPad').dataset.hint === '1.00'", timeout=6000)
    except Exception: pass
    grp.wait_for_timeout(2500)   # the field fades its trails 28% a frame; give it time to settle on a still picture
    rdim = grp.evaluate("() => { const c = document.querySelector('#gleamPad canvas'); return [c.clientWidth, c.clientHeight]; }")
    rr_a = grp.evaluate(GLEAM_PIX, [rdim[0] / 2 - 40, rdim[1] / 2 - 74, 80, 80])["sum"]
    grp.wait_for_timeout(1500)
    rr_b = grp.evaluate(GLEAM_PIX, [rdim[0] / 2 - 40, rdim[1] / 2 - 74, 80, 80])["sum"]
    rvals = grp.evaluate("""() => new Promise(res => { const pad = document.getElementById('gleamPad'), seen = new Set();
      __synth.gleam().pointer('down', { id: 72, x: 0.4, y: 0.5, z: 0.8 });
      setTimeout(() => { __synth.gleam().pointer('up', { id: 72, x: 0.4, y: 0.5, z: 0.8 }); __synth.panic(); }, 400);
      const t0 = performance.now(); (function tick() { seen.add(pad.dataset.hint); if (performance.now() - t0 < 3500) requestAnimationFrame(tick); else res([...seen]); })(); })""")
    ck("G. reduced motion: the hint's ring holds still and the hint switches without a fade",
       rr_a == rr_b and set(rvals) <= {"0.00", "1.00"} and "0.00" in rvals and not grerr, (rr_a, rr_b, rvals, grerr))
    grm.close()
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
    midi_hold = pg.evaluate("""() => {
      const h = __synth.gleam();
      h.setPatch({ device: 'gleam', mode: 'field', hold: true, generator: 'off', scale: 'major', root: 0, octaves: 2, level: 0.85, reverb: 0, glide: 0 });
      __synth.noteOn(64, 0.85);
      __synth.noteOff(64);
      const latched = { voices: h.voices(), n: h.latched().length, ids: h.ids() };
      __synth.panic();
      return { latched, after: { voices: h.voices(), hold: h.patch().hold, n: h.latched().length } };
    }""")
    ck("G. MIDI notes latch while hold is on, and the rack panic releases them",
       midi_hold["latched"]["voices"] == 1 and midi_hold["latched"]["n"] == 1 and "m64" in midi_hold["latched"]["ids"]
       and midi_hold["after"]["voices"] == 0 and midi_hold["after"]["hold"] is False and midi_hold["after"]["n"] == 0, midi_hold)
    pg.evaluate("""() => __synth.setPatch({ device: 'gleam', mode: 'field', hold: true, generator: 'drift', rate: 0.5, depth: 0.8, seed: 5, level: 0.85, reverb: 0, glide: 0 })""")
    # The rack hands a patch to Gleam on the next animation frame and the generator takes its first
    # point on the frame after: measured 24 Oct, 43 to 137 ms and 66 to 398 ms after setPatch. A fixed
    # 100 ms wait lost that race on a slow box (both suite runs that night), so wait for both instead.
    try:
        pg.wait_for_function("""() => { const h = __synth.gleam(), p = h.patch(); return p.hold && p.generator === 'drift' && !!h.generator(); }""", timeout=5000)
    except Exception:
        pass   # the check below fails with what the page shows
    live_mix = pg.evaluate("""() => {
      const h = __synth.gleam();
      h.pointer('down', { id: 4, x: 0.15, y: 0.55, z: 0.9 });
      h.pointer('up', { id: 4, x: 0.22, y: 0.4, z: 0.9 });
      const both = { voices: h.voices(), ids: h.ids().slice(), held: h.latched().length, gen: !!h.generator() };
      h.setPatch(Object.assign({}, h.patch(), { hold: false }));
      const genOnly = { voices: h.voices(), ids: h.ids().slice(), held: h.latched().length };
      h.setPatch(Object.assign({}, h.patch(), { generator: 'off' }));
      return { both, genOnly, off: h.voices() };
    }""")
    ck("G. hold, the generator and a finger combine, and each one can stop on its own",
       live_mix["both"]["voices"] >= 2 and live_mix["both"]["held"] == 1 and "gen" in live_mix["both"]["ids"] and "p4" in live_mix["both"]["ids"]
       and live_mix["both"]["gen"] and live_mix["genOnly"]["voices"] == 1 and "gen" in live_mix["genOnly"]["ids"] and live_mix["genOnly"]["held"] == 0
       and live_mix["off"] == 0, live_mix)
    fx_hold = pg.evaluate("""() => {
      const h = __synth.gleam();
      h.setPatch({ device: 'gleam', mode: 'effect', hold: true, generator: 'off', stutter: false, level: 0.8 });
      h.pointer('down', { id: 8, x: 0.25, y: 0.8, z: 0.6 });
      h.pointer('up', { id: 8, x: 0.25, y: 0.8, z: 0.6 });
      const mid = h.fxProbe();
      h.setPatch(Object.assign({}, h.patch(), { hold: false }));
      return { midOn: mid.on, after: h.fxProbe().on, hold: h.patch().hold };
    }""")
    ck("G. hold keeps the effect insert after the finger lifts",
       fx_hold["midOn"] is True and fx_hold["after"] is False and fx_hold["hold"] is False, fx_hold)
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

    # ---------------------------------------------------------------- H. Heptode, the MIDI-file instrument
    def hrender(patch=None, events=None, seconds=0.6, midi=None, playing=False):
        payload = {"seconds": seconds, "playing": playing, "events": events or []}
        if patch is not None: payload["patch"] = patch
        if midi is not None: payload["midi"] = midi
        return dec(pg.evaluate("a => __synth.heptodeRender(a)", payload))
    def hrms(x, a=0, b=None):
        seg = x[a:b] if b is not None else x[a:]
        if len(seg) == 0: return 0.0
        return float(np.sqrt(np.mean(seg ** 2)))
    devh = pg.evaluate("""() => { const d = __synth.heptodeDevice(); return {
      id: d.id, api: d.api, inst: d.instrument, outs: d.audioOutputs, midi: d.midiInput, proc: d.processor,
      worklet: d.worklet, ch: d.channels, over: d.oversample, level: d.parameters.level && d.parameters.level.type,
      poly: d.parameters.poly && d.parameters.poly.max, name: d.name }; }""")
    ck("H. Heptode publishes a stereo MIDI dxrack/1 device",
       devh["id"] == "heptode" and devh["api"] == "dxrack/1" and devh["inst"] and devh["outs"] == 1 and devh["midi"]
       and devh["proc"] == "heptode" and devh["worklet"] == "heptode.worklet.js" and devh["ch"] == 2 and devh["over"] == 1
       and devh["level"] == "float" and devh["poly"] == 32 and devh["name"] == "Heptode", devh)
    plain = {"device": "heptode", "level": 0.85}
    hL, hR = hrender(plain, [{"t": "on", "tr": 0, "n": 69, "v": 0.8}], 0.8)
    hf = peak_freq(hL[int(0.2 * SR):int(0.7 * SR)])
    hpeak = float(np.max(np.abs(hL)))
    ck(f"H. a neutral A4 peaks near 440 Hz ({hf:.1f} Hz, {db(hpeak):.1f} dBFS)",
       abs(hf - 440) < 8 and np.isfinite(hL).all() and hpeak <= 1.0 and hrms(hL, int(0.15 * SR), int(0.5 * SR)) > 1e-3, (hf, hpeak))
    offL, offR = hrender(plain, [{"t": "on", "tr": 0, "n": 69, "v": 0.8, "at": 0}, {"t": "off", "tr": 0, "n": 69, "at": 0.25}], 1.2)
    tail = hrms(offL, int(0.9 * SR), int(1.15 * SR))
    ck(f"H. note off reaches silence and does not stick ({db(tail):.1f} dB)", tail < 1e-4 and hrms(offL, int(0.1 * SR), int(0.22 * SR)) > 1e-3, tail)
    panL, panR = hrender({"device": "heptode", "level": 1, "tracks": [{"pan": -1, "space": 0, "reverb": 0, "delay": 0, "chorus": 0}]},
                         [{"t": "on", "tr": 0, "n": 60, "v": 0.9}], 0.5)
    ck("H. a hard left track stays on the left", hrms(panR, int(0.1 * SR)) < hrms(panL, int(0.1 * SR)) * 0.05 and hrms(panL, int(0.1 * SR)) > 1e-3,
       (hrms(panL, int(0.1 * SR)), hrms(panR, int(0.1 * SR))))
    muteL, muteR = hrender({"device": "heptode", "tracks": [{"mute": True}]}, [{"t": "on", "tr": 0, "n": 60, "v": 0.9}], 0.4)
    ck("H. mute silences the track", hrms(muteL) < 1e-5 and hrms(muteR) < 1e-5, (hrms(muteL), hrms(muteR)))
    quietL, _ = hrender(plain, [{"t": "cc", "tr": 0, "c": 11, "v": 0, "at": 0}, {"t": "on", "tr": 0, "n": 69, "v": 0.9, "at": 0}], 0.4)
    ck("H. expression at zero is nearly silent", hrms(quietL, int(0.05 * SR)) < 1e-4, hrms(quietL, int(0.05 * SR)))
    pianoL, _ = hrender({"device": "heptode", "tracks": [{"a": 0.004, "d": 0.34, "s": 0.18, "r": 0.3, "wave": 0.2}]}, [{"t": "on", "tr": 0, "n": 69, "v": 0.8}], 0.3)
    strL, _ = hrender({"device": "heptode", "tracks": [{"a": 0.09, "d": 0.18, "s": 0.82, "r": 0.34, "wave": 0.3}]}, [{"t": "on", "tr": 0, "n": 69, "v": 0.8}], 0.3)
    ck("H. a slower family attack is quieter in the first 30 ms",
       hrms(strL, 0, int(0.03 * SR)) < hrms(pianoL, 0, int(0.03 * SR)) * 0.7, (hrms(pianoL, 0, int(0.03 * SR)), hrms(strL, 0, int(0.03 * SR))))
    fix = pg.evaluate("__synth.heptodeFixture()")
    info_s = pg.evaluate("b => __synth.heptodeScore(b)", fix)
    ck("H. the complex fixture has two tracks, a tempo map and several notes",
       info_s["notes"] >= 3 and info_s["tracks"] >= 2 and abs(info_s["bpm"] - 120) < 1, info_s)
    fL, fR = hrender({"device": "heptode", "level": 0.85, "tracks": [{}, {"mute": True}]}, None, 1.0, midi=fix, playing=True)
    bend_f = peak_freq(fL[int(0.55 * SR):int(0.95 * SR)])
    ck(f"H. pitch bend lifts the lead by about two semitones ({bend_f:.1f} Hz)", abs(bend_f - 493.88) < 8 and hrms(fL, int(0.2 * SR), int(0.45 * SR)) > 1e-3, bend_f)
    longL, longR = hrender(plain, None, 5.0, midi=fix, playing=True)
    held = hrms(longL, int(3.4 * SR), int(3.6 * SR))
    gone = hrms(longL, int(4.55 * SR), int(4.9 * SR))
    ck(f"H. sustain holds the note and then lets it go ({db(held):.1f} dB, then {db(gone):.1f} dB)",
       held > 1e-3 and gone < 1e-4, (held, gone))
    cap = pg.evaluate("""() => __synth.heptodeProbe({ device: 'heptode', poly: 32 }, Array.from({length: 40}, (_, i) => ({ n: 48 + (i % 24), v: 0.7, tr: i % 4 })))""")
    perf = pg.evaluate("""() => __synth.heptodeProbe({ device: 'heptode', poly: 32, performance: true }, Array.from({length: 40}, (_, i) => ({ n: 48 + (i % 24), v: 0.7, tr: i % 4 })))""")
    ck("H. voice stealing stays inside the polyphony cap", cap["voices"] <= 32 and cap["voices"] >= 8 and cap["cap"] <= 32, cap)
    ck("H. performance mode caps polyphony at 16", perf["voices"] <= 16 and perf["cap"] <= 16 and perf["peak"] > 0, perf)
    culled = pg.evaluate("() => __synth.heptodeCull(120000, 16)")
    ck(f"H. culling 120k notes stays fast and inside the cap ({culled['ms']:.0f} ms, overlap {culled['overlap']})",
       culled["ms"] < 2000 and culled["kept"] > 0 and culled["overlap"] <= 16, culled)
    lib = pg.evaluate("() => __synth.heptodeLibrary()")
    names = " ".join((row["file"] + " " + row["title"]).lower() for row in lib)
    by = {row["file"]: row for row in lib}
    bee = by.get("rimsky-korsakov-bumblebee.mid") or {}
    arcade = by.get("dx-glass-arcade.mid") or {}
    dense = by.get("black-density.mid") or {}
    ck("H. the library has the showpieces, the original tune, and the stress file",
       len(lib) == 7 and bee.get("notes", 0) > 100 and bee.get("tracks", 0) >= 2
       and arcade.get("tracks", 0) >= 4 and dense.get("notes", 0) >= 100000
       and "axel" not in names and dense.get("ms", 9999) < 3000, (len(lib), bee.get("notes"), arcade.get("tracks"), dense.get("notes"), dense.get("ms")))
    played = hrender({"device": "heptode", "performance": True, "poly": 16}, None, 0.3, midi=fix, playing=True)
    stopL, stopR = hrender(plain, [{"t": "on", "tr": 0, "n": 64, "v": 0.8, "at": 0}, {"t": "stop", "at": 0.2}], 0.8)
    ck("H. a file makes sound, and stop releases it",
       hrms(played[0], int(0.05 * SR)) > 1e-4 and hrms(stopL, int(0.5 * SR)) < 1e-4, (hrms(played[0]), hrms(stopL, int(0.5 * SR))))
    nudged = pg.evaluate("() => __synth.heptodeRandom(3)")
    fm = nudged["tracks"][0]["fm"]
    ck("H. a gentle randomize stays in range and does not slam the sends",
       0 <= fm < 0.25 and all(0 <= nudged["tracks"][i]["delay"] <= 1 for i in range(16)) and nudged["morph"] == 0, fm)
    morphed = pg.evaluate("""() => __synth.heptodeMorph([{ wave: 0, fm: 0 }], [{ wave: 1, fm: 1 }], 0.5)""")
    ck("H. morph halfway sits between the two stored sounds",
       abs(morphed["tracks"][0]["wave"] - 0.5) < 0.02 and abs(morphed["tracks"][0]["fm"] - 0.5) < 0.02, morphed["tracks"][0])

    pg.evaluate("__synth.setDevice('heptode')")
    pg.wait_for_timeout(300)
    ck("H. the player is on screen and Filament's filter is not",
       pg.evaluate("__synth.device()") == "heptode" and pg.is_visible("#hepRoll") and pg.is_visible("#heptodePlace") and not pg.is_visible("#mFilt") and not pg.is_visible("#chassis"))
    # Empty state and roll size (graphics, 29 Oct). The roll canvas had no CSS height, so it took the canvas's 2:1
    # ratio (592 px tall at 1366) inside its 150 px window and a loaded song's notes sat out of sight.
    ROLL = """() => { const c = document.getElementById('hepRoll'), d = document.getElementById('hepDrop'), x = c.getContext('2d');
      const s = c.width / c.clientWidth, cw = c.clientWidth, ch = c.clientHeight;
      const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      const box = x.getImageData(Math.round((cw / 2 - 80) * s), Math.round((ch / 2 - 18) * s), Math.round(160 * s), Math.round(36 * s)).data;
      let max = 0, best = [0, 0, 0]; for (let i = 0; i < box.length; i += 4) { const L = 0.2126 * lin(box[i]) + 0.7152 * lin(box[i + 1]) + 0.0722 * lin(box[i + 2]); if (L > max) { max = L; best = [box[i], box[i + 1], box[i + 2]]; } }
      const all = x.getImageData(0, 0, c.width, c.height).data; let sum = 0, colour = 0;
      for (let i = 0; i < all.length; i += 4) { sum += all[i] + all[i + 1] + all[i + 2]; if (Math.max(all[i], all[i + 1], all[i + 2]) - Math.min(all[i], all[i + 1], all[i + 2]) > 40) colour++; }
      return { empty: c.dataset.empty, ch, dh: d.clientHeight, max, best, mean: sum / (all.length / 4), colour }; }"""
    hep_empty = pg.evaluate(ROLL)
    win_bg = 0.2126 * (11 / 255 / 12.92) + 0.7152 * (9 / 255 / 12.92) + 0.0722 * (7 / 255 / 12.92)
    hep_cr = (hep_empty["max"] + 0.05) / (win_bg + 0.05)
    ck("H. with no song the roll shows its empty state, readable (contrast 4.5:1 or more in the readout window)",
       hep_empty["empty"] == "1" and hep_cr >= 4.5 and hep_empty["best"][0] > hep_empty["best"][2] + 60, (hep_empty, round(hep_cr, 1)))
    ck("H. the roll canvas fills its window instead of overflowing it", abs(hep_empty["ch"] - hep_empty["dh"]) <= 2, (hep_empty["ch"], hep_empty["dh"]))
    pg.evaluate("() => document.getElementById('hepDrop').dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }))")
    pg.wait_for_timeout(150)
    hep_over = pg.evaluate(ROLL)
    pg.evaluate("() => document.getElementById('hepDrop').dispatchEvent(new DragEvent('dragleave', { bubbles: true }))")
    ck("H. a file dragged over the empty roll lights its lanes", hep_over["mean"] > hep_empty["mean"] * 1.3, (round(hep_empty["mean"], 1), round(hep_over["mean"], 1)))
    pg.evaluate("""() => {
      const bytes = new Uint8Array(__synth.heptodeFixture());
      const file = new File([bytes], 'phrase.mid', { type: 'audio/midi' });
      const dt = new DataTransfer();
      dt.items.add(file);
      document.getElementById('hepDrop').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    }""")
    pg.wait_for_function("() => __synth.heptodeState().notes >= 3", timeout=5000)
    ck("H. dropping a .mid file loads its notes", pg.evaluate("__synth.heptodeState().notes") >= 3 and "phrase" in pg.evaluate("__synth.heptodeState().name").lower(), pg.evaluate("__synth.heptodeState()"))
    pg.wait_for_timeout(150)
    hep_full = pg.evaluate(ROLL)
    ck("H. with a song loaded the roll leaves its empty state and its notes are painted in the window",
       hep_full["empty"] == "0" and hep_full["colour"] > 0 and abs(hep_full["ch"] - hep_full["dh"]) <= 2, hep_full)
    pg.click("#hepPlay")
    pg.wait_for_timeout(200)
    ck("H. play starts the file", pg.evaluate("__synth.heptodeState().playing") is True)
    # The wide-screen keyboard is fixed over the bottom of the page. The field
    # already has a scroll margin for that bar; the drag has to land on the
    # canvas, not on the keys.
    # scroll_into_view_if_needed does nothing while the field is partly on screen, and with a file
    # loaded its bottom sits under the keys (the drag then landed on a key). Scroll it clear of the bar.
    pg.evaluate("""() => { const r = document.getElementById('heptodePlace').getBoundingClientRect();
      const kb = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kb-h')) || 0;
      const over = r.bottom - (innerHeight - kb - 28); if (over > 0) window.scrollBy(0, over); }""")
    pg.wait_for_timeout(100)
    box = pg.locator("#heptodePlace").bounding_box()
    hit = pg.evaluate("([x, y]) => (document.elementFromPoint(x, y) || {}).id || ''", [box["x"] + box["width"] / 2, box["y"] + box["height"] - 30])
    ck("H. the drag starts on the field, not on the docked keys", hit == "heptodePlace", hit)
    pg.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] - 30)
    pg.mouse.down()
    pg.mouse.move(box["x"] + 24, box["y"] + box["height"] * 0.75)
    pg.mouse.up()
    placed = pg.evaluate("__synth.patch().tracks[0]")
    ck("H. dragging an orb moves that track in the field", placed["placed"] and placed["pan"] < -0.3, placed)
    pg.click("#hepStop")
    pg.wait_for_timeout(250)
    ck("H. stop ends playback", pg.evaluate("__synth.heptodeState().playing") is False)
    # The rack section leaves Cathode soloed. A soloed strip mutes every other
    # device at the mixer, so the master recorder would hear silence even though
    # Heptode is sounding. Clear that leftover before measuring the master path.
    pg.evaluate("""() => {
      const mix = __synth.mixer() || {};
      Object.keys(mix).forEach(id => __synth.setMixer(id, { mute: false, solo: false, level: mix[id].level, pan: mix[id].pan }));
      __synth.setMixer('heptode', { level: 1, pan: 0, mute: false, solo: false });
    }""")
    hep_sr = int(pg.evaluate("() => __synth.engine().ctx.sampleRate"))
    pg.evaluate("__synth.noteOn(69, 0.8)")
    pg.evaluate("() => __synth.recordStart()")
    pg.wait_for_timeout(700)
    pg.evaluate("__synth.noteOff(69)")
    rec = pg.evaluate("() => __synth.recordStop()")
    rec_raw = base64.b64decode(rec["b64"]) if rec and rec.get("b64") else b""
    rec_info = parse_wav(rec_raw) if rec_raw else None
    rec_rms = hrms(pcm24(rec_info["data"])[0]) if rec_info and len(rec_info["data"]) >= 6 else 0
    ck("H. the master recorder hears Heptode",
       rec_info and rec_info["bits"] == 24 and rec_info["ch"] == 2 and rec_info["rate"] == hep_sr and rec.get("sr") == hep_sr
       and rec_rms > 1e-3 and bool(_re2.fullmatch(r"Heptode-\d{8}-\d{6}\.wav", rec.get("name") or "")),
       (rec_rms, None if not rec else rec.get("sr"), None if not rec else rec.get("name")))
    ph = b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    perr = []
    ph.on("pageerror", lambda e: perr.append(str(e)))
    ph.goto(BASE)
    ph.wait_for_function("window.__synth && __synth.ready()", timeout=20000)
    ph.evaluate("__synth.setDevice('heptode')")
    ph.wait_for_timeout(300)
    ck("H. 390px: no horizontal scroll, the roll is up, one section",
       ph.evaluate("document.documentElement.scrollWidth <= innerWidth && innerWidth === 390")
       and ph.is_visible("#hepRoll") and not ph.is_visible("#mFilt")
       and ph.evaluate("[...document.querySelectorAll('.mod')].filter(m => m.offsetParent).length") <= 4,
       (ph.evaluate("[document.documentElement.scrollWidth, innerWidth]"), perr))
    small = ph.evaluate("""() => [...document.querySelectorAll('.devbtn, .tabs button, #heptodeRoot .chip, #heptodeRoot .btn, #heptodeRoot input')]
      .filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; })
      .map(e => (e.id || e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))""")
    ck("H. 390px: rail, tabs and player controls are 44 px or more", not small, small)
    ph.tap('.tabs [data-go="tracks"]')
    ph.wait_for_timeout(200)
    ck("H. 390px: the Tracks tab shows the channel strips", ph.is_visible("#mHepTracks") and not ph.is_visible("#hepRoll")
       and ph.evaluate("document.documentElement.scrollWidth <= innerWidth && innerWidth === 390"))
    ph.screenshot(path=os.path.join(SHOTS, "synth_heptode_phone.png"))
    ck("H. 390px: no page errors", not perr, perr)
    ph.close()

    # Geissler: a seeded meadow. The world is pure (same seed, same events) and the
    # worklet speaks only when something happens. Population cannot run past the cap.
    devg = pg.evaluate("""() => { const d = __synth.geisslerDevice(); return {
      id: d.id, name: d.name, api: d.api, inst: d.instrument, outs: d.audioOutputs,
      midiIn: d.midiInput, midiOut: d.midiOutput, proc: d.processor, worklet: d.worklet,
      ch: d.channels, over: d.oversample,
      cap: d.parameters.cap && d.parameters.cap.default, birth: d.parameters.birth && d.parameters.birth.type,
      seed: d.parameters.seed && d.parameters.seed.default, scale: d.parameters.scale && d.parameters.scale.choices,
    }; }""")
    ck("Gs. Geissler is a stereo dxrack/1 instrument with MIDI in and out",
       devg["id"] == "geissler" and devg["name"] == "Geissler" and devg["api"] == "dxrack/1" and devg["inst"]
       and devg["outs"] == 1 and devg["midiIn"] and devg["midiOut"] and devg["proc"] == "geissler"
       and devg["worklet"] == "geissler.worklet.js" and devg["ch"] == 2 and devg["over"] == 1
       and devg["cap"] == 16 and devg["birth"] == "float" and devg["seed"] == 1701 and "penta" in (devg["scale"] or []) and "free" in (devg["scale"] or []),
       devg)
    busy = {"device": "geissler", "seed": 1701, "birth": 1, "death": 0.35, "mutation": 0, "food": 1,
            "cap": 24, "capReed": 8, "capGraze": 8, "capStalk": 6, "capFlicker": 8,
            "grid": "8", "tempo": 120, "scale": "major", "running": True}
    sim_a = pg.evaluate("(p) => __synth.geisslerSim(p, 6)", busy)
    sim_b = pg.evaluate("(p) => __synth.geisslerSim(p, 6)", busy)
    kinds = {e["kind"] for e in sim_a["events"]}
    ck("Gs. the same seed builds the same meadow", sim_a == sim_b and sim_a["popMax"] > 0, (sim_a["pop"], sim_a["stats"]))
    other = pg.evaluate("(p) => __synth.geisslerSim(Object.assign({}, p, { seed: 1702 }), 6)", busy)
    ck("Gs. a different seed is a different meadow", other != sim_a, other["stats"])
    ck("Gs. meetings, meals, births and deaths each schedule a note",
       {"meet", "eat", "breed", "die"} <= kinds and sim_a["stats"]["meet"] > 0 and sim_a["stats"]["eat"] > 0
       and sim_a["stats"]["breed"] > 0 and sim_a["stats"]["die"] > 0, sim_a["stats"])
    on_grid = all(abs(e["at"] / 0.25 - round(e["at"] / 0.25)) < 1e-6 for e in sim_a["events"])
    ck("Gs. eighth notes at 120 BPM land on the grid", on_grid and len(sim_a["events"]) > 10, sim_a["events"][:3])
    breed = next(e for e in sim_a["events"] if e["kind"] == "breed")
    mean_p = (breed["parentPitch"][0] + breed["parentPitch"][1]) / 2
    mean_r = (breed["parentRhythm"][0] + breed["parentRhythm"][1]) / 2
    ck("Gs. a child with no mutation is the average of its parents",
       abs(breed["childPitch"] - mean_p) < 1e-9 and abs(breed["childRhythm"] - mean_r) < 1e-9, breed)
    mut = pg.evaluate("(p) => __synth.geisslerSim(Object.assign({}, p, { mutation: 1 }), 6)", busy)
    mut_b = [e for e in mut["events"] if e["kind"] == "breed"]
    drifted = [e for e in mut_b if abs(e["childPitch"] - (e["parentPitch"][0] + e["parentPitch"][1]) / 2) > 1e-6]
    in_range = all(0 <= e["childPitch"] <= 1 and 0 <= e["childRhythm"] <= 1 for e in mut_b)
    ck("Gs. mutation moves a child gene and keeps it inside 0..1", len(drifted) > 0 and in_range, (len(mut_b), len(drifted)))
    capped = pg.evaluate("""() => __synth.geisslerSim({
      device: 'geissler', seed: 1701, birth: 1, death: 0.2, mutation: 0.2, food: 1,
      cap: 4, capReed: 4, capGraze: 4, capStalk: 4, capFlicker: 4, grid: '8', tempo: 120, running: true
    }, 12)""")
    ck("Gs. the population stays inside the cap", capped["popMax"] <= 4 and capped["pop"] <= 4, (capped["pop"], capped["popMax"], capped["stats"]))
    ck("Gs. free time is not quantized", abs(pg.evaluate("() => __synth.geisslerQuant(0.31, 120, 'free')") - 0.31) < 1e-12)
    spring = pg.evaluate("() => __synth.geisslerSeason(0, 8)")
    summer = pg.evaluate("() => __synth.geisslerSeason(2, 8)")
    ck("Gs. a season walks the key from spring to summer",
       spring["name"] == "Spring" and spring["keyShift"] == 0 and abs(spring["mood"] - 0.5) < 1e-9
       and summer["name"] == "Summer" and summer["keyShift"] == 5 and abs(summer["mood"] - 1) < 1e-9, (spring, summer))
    major = pg.evaluate("() => __synth.geisslerNote(0.07, 'graze', 60, 'major', 0)")
    free_n = pg.evaluate("() => __synth.geisslerNote(0.07, 'graze', 60, 'free', 0)")
    ck("Gs. a scale snaps and free keeps the fractional pitch",
       major["midi"] == int(major["midi"]) and abs(major["hz"] - 440 * (2 ** ((major["midi"] - 69) / 12))) < 1e-6
       and abs(free_n["hz"] - major["hz"]) > 0.01, (major, free_n))
    ck("Gs. mutation zero is an exact blend", abs(pg.evaluate("() => __synth.geisslerBlend(0.2, 0.8, 0, 1)") - 0.5) < 1e-12)

    def grender(patch, events, seconds):
        return dec(pg.evaluate("(a) => __synth.geisslerRender(a)", {"patch": patch, "events": events, "seconds": seconds, "sampleRate": 48000}))
    world_patch = {"device": "geissler", "seed": 1701, "running": True, "level": 0.8, "grid": "8", "tempo": 120, "scale": "major"}
    gL, gR = grender(world_patch, [], 1.2)
    gL2, gR2 = grender(world_patch, [], 1.2)
    gpeak = float(max(np.max(np.abs(gL)), np.max(np.abs(gR))))
    ck("Gs. a meadow render is finite, audible and inside 0 dBFS",
       np.isfinite(gL).all() and np.isfinite(gR).all() and hrms(gL) > 1e-3 and gpeak <= 1.0 + 1e-6, (hrms(gL), gpeak))
    ck("Gs. two renders of one seed match", float(np.max(np.abs(gL - gL2))) == 0 and float(np.max(np.abs(gR - gR2))) == 0)

    def zc(x):
        s = np.sign(x)
        s[s == 0] = 1
        return int(np.sum(s[1:] * s[:-1] < 0))
    quiet = {"device": "geissler", "running": False, "grid": "free", "scale": "free", "level": 0.9, "voices": 8,
             "routeReed": "self", "routeGraze": "self", "routeStalk": "self", "routeFlicker": "self"}
    def tap(species, n, **extra):
        ev = {"t": "tap", "species": species, "n": n, "v": 0.9, "snap": False, "at": 0.02}
        ev.update(extra)
        return grender(quiet, [ev], 1.0)
    reedL, _ = tap("reed", 60, pan=0)
    grazeL, _ = tap("graze", 60, pan=0)
    stalkL, _ = tap("stalk", 40, pan=0)
    flickL, _ = tap("flicker", 84, pan=0)
    ck("Gs. a reed holds and a grazer decays",
       hrms(reedL, 20000, 40000) > hrms(reedL, 0, 800) * 0.4 and hrms(grazeL, 0, 8000) > hrms(grazeL, 30000, 40000) * 8,
       (hrms(reedL, 20000, 40000), hrms(grazeL, 0, 8000), hrms(grazeL, 30000, 40000)))
    ck("Gs. a stalk sits lower than a flicker",
       peak_freq(stalkL[1000:8000]) < 220 and zc(flickL[1000:12000]) > zc(stalkL[1000:12000]) * 2,
       (peak_freq(stalkL[1000:8000]), zc(stalkL[1000:12000]), zc(flickL[1000:12000])))
    leftL, leftR = tap("graze", 60, pan=-1)
    rightL, rightR = tap("graze", 60, pan=1)
    ck("Gs. position pans the note",
       hrms(leftL, 0, 8000) > 1e-3 and hrms(leftR, 0, 8000) < 1e-6 and hrms(rightR, 0, 8000) > 1e-3 and hrms(rightL, 0, 8000) < 1e-5,
       (hrms(leftL, 0, 8000), hrms(leftR, 0, 8000), hrms(rightL, 0, 8000), hrms(rightR, 0, 8000)))
    capv = pg.evaluate("""() => __synth.geisslerProbe(
      { device: 'geissler', running: false, voices: 4, level: 0.8, grid: 'free', scale: 'free' },
      Array.from({length: 20}, (_, i) => ({ t: 'tap', species: 'graze', n: 48 + i, v: 0.8, snap: false, at: 0.02 })),
      0.6)""")
    ck("Gs. the voice pool never passes the cap", capv["maxVoices"] <= 4 and capv["maxVoices"] >= 1, capv)
    ended = pg.evaluate("""() => __synth.geisslerProbe(
      { device: 'geissler', running: false, voices: 8, level: 0.8, grid: 'free', scale: 'free', routeGraze: 'filament' },
      [{ t: 'tap', species: 'graze', n: 60, v: 0.8, snap: false, at: 0.02 }, { t: 'panic', at: 0.2 }],
      0.8)""")
    ck("Gs. panic releases the voice and closes the routed note",
       ended["sounding"] == 0 and ended["tail"] < 1e-4 and ended["midiOn"] == ended["midiOff"] and ended["midiOn"] >= 1,
       ended)
    asleep = pg.evaluate("""() => __synth.geisslerProbe(
      { device: 'geissler', running: true, level: 0.9 },
      [{ t: 'active', on: false, at: 0 }, { t: 'tap', species: 'reed', n: 60, v: 0.9, at: 0.05 }],
      0.5)""")
    ck("Gs. a sleeping meadow is silent", asleep["rms"] < 1e-5 and asleep["sounding"] == 0, asleep)

    gerr = []
    pg.on("pageerror", lambda e: gerr.append(str(e)))
    pg.evaluate("__synth.setDevice('geissler')")
    pg.wait_for_timeout(250)
    ck("Gs. the meadow is on screen and the tube chassis is hidden",
       pg.evaluate("__synth.device()") == "geissler" and pg.is_visible("#geissWorld") and pg.is_visible("#mGeissWorld")
       and not pg.is_visible("#chassis") and not pg.is_visible("#mFilt"), gerr)
    pg.evaluate("""() => __synth.setPatch({
      device: 'geissler', seed: 4242, food: 0, running: true, tool: 'food', birth: 0, death: 0,
      cap: 12, capReed: 4, capGraze: 4, capStalk: 2, capFlicker: 4, level: 0.7
    })""")
    pg.wait_for_function("() => document.getElementById('geissSeed').value === '4242'", timeout=4000)
    pg.wait_for_timeout(350)
    pg.wait_for_function("() => document.getElementById('geissFood').textContent === '0'", timeout=4000)
    pg.click("#geissWorld")
    pg.wait_for_function("() => +document.getElementById('geissFood').textContent >= 1", timeout=4000)
    ck("Gs. a tap drops food", int(pg.evaluate("() => document.getElementById('geissFood').textContent")) >= 1)
    pg.click("#geissTools button[data-id='herd']")
    box = pg.locator("#geissWorld").bounding_box()
    pg.mouse.move(box["x"] + box["width"] * 0.3, box["y"] + box["height"] * 0.3)
    pg.mouse.down()
    pg.mouse.move(box["x"] + box["width"] * 0.42, box["y"] + box["height"] * 0.63)
    pg.mouse.up()
    herd = pg.evaluate("() => document.getElementById('geissHerd').textContent")
    hx, hy = [float(v) for v in herd.split(",")] if herd and "," in herd else (0, 0)
    ck("Gs. a drag herds toward the pointer", abs(hx - 0.42) < 0.04 and abs(hy - 0.63) < 0.04, herd)
    pg.evaluate("""() => {
      const mix = __synth.mixer() || {};
      Object.keys(mix).forEach(id => __synth.setMixer(id, { mute: false, solo: false, level: mix[id].level, pan: mix[id].pan }));
      __synth.setMixer('geissler', { level: 1, pan: 0, mute: false, solo: false });
      __synth.setPatch({ device: 'geissler', seed: 1701, running: true, birth: 1, death: 0.3, food: 1, level: 0.85, grid: '8', tempo: 120, scale: 'major',
        routeReed: 'self', routeGraze: 'self', routeStalk: 'self', routeFlicker: 'self' });
    }""")
    pg.wait_for_timeout(80)
    pg.evaluate("__synth.panic()")
    pg.wait_for_timeout(80)
    pg.evaluate("""() => __synth.setPatch({
      device: 'geissler', running: false, spawn: 'graze', routeGraze: 'filament', grid: 'free', scale: 'free', seed: 1701, level: 0.8
    })""")
    pg.wait_for_timeout(80)
    pg.evaluate("__synth.noteOn(60, 0.9)")
    pg.wait_for_function("() => ((__synth.engine().meters.filament || {}).voices || 0) > 0", timeout=4000)
    ck("Gs. a grazer can play Filament", pg.evaluate("() => (__synth.engine().meters.filament || {}).voices") > 0)
    pg.evaluate("__synth.panic()")
    pg.wait_for_function("() => ((__synth.engine().meters.filament || {}).voices || 0) === 0", timeout=4000)
    ck("Gs. the routed note does not stick", pg.evaluate("() => (__synth.engine().meters.filament || {}).voices") == 0)
    pg.evaluate("""() => __synth.setPatch({
      device: 'geissler', seed: 1701, running: true, level: 0.85, birth: 0.8, food: 0.8, grid: '8', tempo: 108, scale: 'penta',
      routeReed: 'self', routeGraze: 'self', routeStalk: 'self', routeFlicker: 'self'
    })""")
    pg.wait_for_timeout(100)
    g_sr = int(pg.evaluate("() => __synth.engine().ctx.sampleRate"))
    pg.evaluate("() => __synth.recordStart()")
    pg.wait_for_timeout(800)
    grec = pg.evaluate("() => __synth.recordStop()")
    grec_raw = base64.b64decode(grec["b64"]) if grec and grec.get("b64") else b""
    grec_info = parse_wav(grec_raw) if grec_raw else None
    grec_rms = hrms(pcm24(grec_info["data"])[0]) if grec_info and len(grec_info["data"]) >= 6 else 0
    ck("Gs. the master recorder hears Geissler",
       grec_info and grec_info["bits"] == 24 and grec_info["ch"] == 2 and grec_info["rate"] == g_sr and grec.get("sr") == g_sr
       and grec_rms > 1e-3 and bool(_re2.fullmatch(r"Geissler-\d{8}-\d{6}\.wav", grec.get("name") or "")),
       (grec_rms, None if not grec else grec.get("sr"), None if not grec else grec.get("name")))
    ck("Gs. the page stayed quiet", not gerr, gerr)

    gp = b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    gperr = []
    gp.on("pageerror", lambda e: gperr.append(str(e)))
    gp.goto(BASE)
    gp.wait_for_function("window.__synth && __synth.ready()", timeout=20000)
    gp.evaluate("__synth.setDevice('geissler')")
    gp.wait_for_timeout(300)
    ck("Gs. 390px: no horizontal scroll, the meadow is up",
       gp.evaluate("document.documentElement.scrollWidth <= innerWidth && innerWidth === 390")
       and gp.is_visible("#geissWorld") and not gp.is_visible("#mFilt") and not gp.is_visible("#chassis"),
       (gp.evaluate("[document.documentElement.scrollWidth, innerWidth]"), gperr))
    gsmall = gp.evaluate("""() => [...document.querySelectorAll('.devbtn, .tabs button, #geisslerRoot .chip, #geisslerRoot .btn, #geisslerRoot input, #geisslerRoot select')]
      .filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; })
      .map(e => (e.id || e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))""")
    ck("Gs. 390px: rail, tabs and meadow controls are 44 px or more", not gsmall, gsmall)
    gp.tap('.tabs [data-go="life"]')
    gp.wait_for_timeout(200)
    ck("Gs. 390px: Life shows birth and the scale",
       gp.is_visible("#mGeissLife") and gp.is_visible("#geissScale") and gp.is_visible("#kGeissLife")
       and not gp.is_visible("#geissWorld")
       and gp.evaluate("document.documentElement.scrollWidth <= innerWidth && innerWidth === 390"))
    gp.screenshot(path=os.path.join(SHOTS, "synth_geissler_phone.png"))
    ck("Gs. 390px: no page errors", not gperr, gperr)
    gp.close()
    # ---------------------------------------------------------------- Pg. Pentagrid, the shortwave receiver
    def prender(patch=None, events=None, seconds=0.6):
        payload = {"seconds": seconds, "events": events or []}
        if patch is not None: payload["patch"] = patch
        return dec(pg.evaluate("a => __synth.pentagridRender(a)", payload))
    def prms(x, a=0, b=None):
        seg = x[a:b] if b is not None else x[a:]
        if len(seg) == 0: return 0.0
        return float(np.sqrt(np.mean(seg ** 2)))
    devp = pg.evaluate("""() => { const d = __synth.pentagridDevice(); return {
      id: d.id, api: d.api, inst: d.instrument, outs: d.audioOutputs, midi: d.midiInput, proc: d.processor,
      worklet: d.worklet, ch: d.channels, over: d.oversample, tune: d.parameters.tune && d.parameters.tune.type,
      play: d.parameters.play && d.parameters.play.type, name: d.name,
      listed: __synth.devices().some(x => x.id === 'pentagrid') }; }""")
    ck("Pg. Pentagrid publishes a stereo MIDI dxrack/1 device",
       devp["id"] == "pentagrid" and devp["api"] == "dxrack/1" and devp["inst"] and devp["outs"] == 1 and devp["midi"]
       and devp["proc"] == "pentagrid" and devp["worklet"] == "pentagrid.worklet.js" and devp["ch"] == 2 and devp["over"] == 1
       and devp["tune"] == "float" and devp["play"] == "boolean" and devp["name"] == "Pentagrid" and devp["listed"], devp)
    plan = pg.evaluate("() => __synth.pentagridPlan('A', 20)")
    eplan = pg.evaluate("() => __synth.pentagridPlan('E', 20)")
    tplan = pg.evaluate("() => __synth.pentagridPlan('T', 20)")
    ck("Pg. Morse A at 20 WPM is a dit, a gap, and a dah",
       len(plan) == 2 and plan[0]["el"] == "." and abs(plan[0]["t0"]) < 1e-9 and abs(plan[0]["t1"] - 0.06) < 1e-9
       and plan[1]["el"] == "-" and abs(plan[1]["t0"] - 0.12) < 1e-9 and abs(plan[1]["t1"] - 0.30) < 1e-9, plan)
    ck("Pg. E is one dit and T is one dah",
       len(eplan) == 1 and abs(eplan[0]["t1"] - 0.06) < 1e-9 and len(tplan) == 1 and abs(tplan[0]["t1"] - 0.18) < 1e-9, (eplan, tplan))
    # The noise blanker's window used to count down only inside the band-noise code, which air 0 skips:
    # a window open when the air went off stayed open, and the receiver was silent until reload, notes
    # too ("M. pentagrid" failing now and then, 26 Oct). Catch a window open, turn the air off, play.
    bl = pg.evaluate("""async () => { const m = await import('/synth/pentagrid-dsp.js');
      const eng = m.createRadioEngine(48000, { tune: 8500, air: 1, noise: 0.6, crackle: 1, blanker: 1, play: true, level: 0.9 });
      const L = new Float32Array(128), R = new Float32Array(128); let f = 0, n = 0;
      while (!(eng.blank > 0) && n < 48000 * 20 / 128) { m.renderRadio(eng, L, R, f); f += 128; n++; }
      const caught = eng.blank;
      m.postRadio(eng, { t: 'patch', p: { tune: 8500, bfo: 700, bandwidth: 400, air: 0, noise: 0, crackle: 0, fade: 0, agc: 0, blanker: 0, text: '', play: true, mode: 'cw', level: 0.9, cond: 1 } });
      m.postRadio(eng, { t: 'on', n: 69, v: 0.9 });
      let s = 0, c = 0;
      for (let k = 0; k < 120; k++) { m.renderRadio(eng, L, R, f); f += 128; if (k > 60) for (const x of L) { s += x * x; c++; } }
      return { caught, rms: Math.sqrt(s / c), left: eng.blank }; }""")
    ck(f"Pg. a blanker window open when the air goes off closes, and a note then sounds (window {bl['caught']:.0f} samples, note {bl['rms']:.3f} RMS, want 0.05 or more)",
       bl["caught"] > 0 and bl["rms"] >= 0.05 and bl["left"] <= 0, bl)
    side = {"device": "pentagrid", "tune": 8500, "air": 0, "noise": 0, "crackle": 0, "fade": 0, "agc": 0, "blanker": 0,
            "text": "A", "wpm": 20, "bfo": 700, "mode": "cw", "play": False, "level": 0.9, "bandwidth": 400, "cond": 1}
    mL, mR = prender(side, [], 0.8)
    dit = prms(mL, int(0.015 * SR), int(0.045 * SR))
    gap = prms(mL, int(0.075 * SR), int(0.105 * SR))
    dah = prms(mL, int(0.15 * SR), int(0.27 * SR))
    after = prms(mL, int(0.36 * SR), int(0.50 * SR))
    ck(f"Pg. the keyed A follows dit, gap, dah, then silence ({dit:.3f} / {gap:.4f} / {dah:.3f} / {after:.4f})",
       dit > 0.05 and gap < 0.01 and dah > 0.05 and after < 0.01 and abs(peak_freq(mL[int(0.16 * SR):int(0.26 * SR)]) - 700) < 12,
       (dit, gap, dah, after))
    carrier = {"device": "pentagrid", "tune": 14000, "bfo": 800, "bandwidth": 4000, "air": 1, "noise": 0, "crackle": 0,
               "fade": 0, "agc": 0, "blanker": 0, "text": "", "cond": 1, "mode": "cw", "play": False, "level": 0.7}
    c1, _ = prender(carrier, [], 0.5)
    c2, _ = prender(dict(carrier, tune=14000.3), [], 0.5)
    f1 = peak_freq(c1[int(0.1 * SR):int(0.45 * SR)])
    f2 = peak_freq(c2[int(0.1 * SR):int(0.45 * SR)])
    ck(f"Pg. tuning the carrier moves the beat from {f1:.1f} Hz to {f2:.1f} Hz",
       abs(f1 - 800) < 8 and abs(f2 - 500) < 8 and prms(c1, int(0.1 * SR)) > 0.05, (f1, f2))
    names = pg.evaluate("__synth.pentagridFactory()")
    floors = []
    for row in names:
        body = pg.evaluate("(n) => __synth.pentagridPatch(n)", row["name"])
        wave, _ = prender(body, [], 0.7)
        floors.append((row["name"], prms(wave, int(0.05 * SR))))
    ck("Pg. every factory preset makes a sound", all(v > 2e-4 for _, v in floors) and len(floors) == 6, floors)
    play = {"device": "pentagrid", "tune": 8500, "air": 0, "noise": 0, "crackle": 0, "fade": 0, "agc": 0, "blanker": 0,
            "text": "", "mode": "cw", "play": True, "level": 0.9, "bandwidth": 400, "cond": 1, "bfo": 0}
    heldL, _ = prender(play, [{"t": "on", "n": 69, "v": 0.9, "at": 0.02}], 0.5)
    offL, _ = prender(play, [{"t": "on", "n": 69, "v": 0.9, "at": 0.02}, {"t": "off", "n": 69, "at": 0.25}], 1.2)
    panL, _ = prender(play, [{"t": "on", "n": 69, "v": 0.9, "at": 0.02}, {"t": "panic", "at": 0.2}], 0.7)
    susL, _ = prender(play, [{"t": "sus", "on": True, "at": 0}, {"t": "on", "n": 69, "v": 0.9, "at": 0.02},
                             {"t": "off", "n": 69, "at": 0.2}, {"t": "sus", "on": False, "at": 0.55}], 1.4)
    twoL, _ = prender(play, [{"t": "on", "n": 60, "v": 0.8, "at": 0.02}, {"t": "on", "n": 64, "v": 0.8, "at": 0.05},
                             {"t": "off", "n": 60, "at": 0.3}, {"t": "off", "n": 64, "at": 0.6}], 1.3)
    strayL, _ = prender(play, [{"t": "on", "n": 69, "v": 0.9, "at": 0.02}, {"t": "off", "n": 70, "at": 0.2},
                               {"t": "off", "n": 69, "at": 0.5}], 1.3)
    muteL, _ = prender(dict(play, play=False), [{"t": "on", "n": 69, "v": 0.9, "at": 0.02}], 0.4)
    ck(f"Pg. a play-mode A4 is near 440 Hz ({peak_freq(heldL[int(0.15 * SR):int(0.45 * SR)]):.1f} Hz)",
       abs(peak_freq(heldL[int(0.15 * SR):int(0.45 * SR)]) - 440) < 8 and prms(heldL, int(0.15 * SR)) > 0.02)
    ck("Pg. note off, panic, and a second off do not leave a stuck note",
       prms(offL, int(0.08 * SR), int(0.2 * SR)) > 0.02 and prms(offL, int(0.9 * SR), int(1.15 * SR)) < 1e-4
       and prms(panL, int(0.08 * SR), int(0.18 * SR)) > 0.02 and prms(panL, int(0.4 * SR), int(0.65 * SR)) < 1e-4
       and prms(strayL, int(0.3 * SR), int(0.45 * SR)) > 0.02 and prms(strayL, int(1.05 * SR), int(1.25 * SR)) < 1e-4
       and prms(muteL) < 1e-5,
       (prms(offL, int(0.9 * SR)), prms(panL, int(0.4 * SR)), prms(strayL, int(1.05 * SR)), prms(muteL)))
    ck("Pg. sustain holds the note until the pedal lifts, and two notes release one at a time",
       prms(susL, int(0.35 * SR), int(0.5 * SR)) > 0.02 and prms(susL, int(1.15 * SR), int(1.35 * SR)) < 1e-4
       and prms(twoL, int(0.4 * SR), int(0.55 * SR)) > 0.02 and prms(twoL, int(1.1 * SR), int(1.25 * SR)) < 1e-4,
       (prms(susL, int(0.35 * SR)), prms(susL, int(1.15 * SR)), prms(twoL, int(0.4 * SR)), prms(twoL, int(1.1 * SR))))
    timeL, _ = prender({"device": "pentagrid", "tune": 10000, "mode": "am", "bfo": 0, "bandwidth": 2000, "noise": 0,
                        "crackle": 0, "fade": 0, "agc": 0, "air": 1, "cond": 1, "text": "", "level": 0.8, "play": False}, [], 0.4)
    ck(f"Pg. the time mark is a 1000 Hz pip ({peak_freq(timeL[int(0.05 * SR):int(0.35 * SR)]):.1f} Hz)",
       abs(peak_freq(timeL[int(0.05 * SR):int(0.35 * SR)]) - 1000) < 8 and prms(timeL, int(0.05 * SR), int(0.35 * SR)) > 0.05)
    figL, _ = prender({"device": "pentagrid", "tune": 6175, "mode": "am", "bfo": 0, "bandwidth": 4000, "noise": 0,
                       "crackle": 0, "fade": 0, "agc": 0, "air": 1, "cond": 1, "text": "", "level": 0.8, "play": False}, [], 0.4)
    chimes = [tone_amp(figL[:int(0.35 * SR)], f) for f in (523.25, 659.25, 783.99)]
    ck("Pg. the figure group opens with three chime tones", all(a > 0.02 for a in chimes), chimes)
    rttyL, _ = prender({"device": "pentagrid", "tune": 14085, "mode": "rtty", "bfo": 0, "bandwidth": 3200, "noise": 0,
                        "crackle": 0, "fade": 0, "agc": 0, "air": 1, "cond": 1, "text": "", "level": 0.8, "play": False}, [], 0.8)
    mark = tone_amp(rttyL[int(0.05 * SR):int(0.7 * SR)], 2125)
    space = tone_amp(rttyL[int(0.05 * SR):int(0.7 * SR)], 2295)
    ck("Pg. the shift pair has both FSK tones", mark > 0.008 and space > 0.008, (mark, space))
    hi, _ = prender(carrier, [], 0.4)
    lo, _ = prender(dict(carrier, cond=0), [], 0.4)
    solar = pg.evaluate("""() => ({
      band: __synth.pentagridBand(14200),
      good: __synth.pentagridCond(14200, [{ band: '20m', condition: 'good' }]),
      none: __synth.pentagridCond(14200, []),
      qso: __synth.pentagridQso(4)
    })""")
    ck("Pg. better conditions raise the carrier, and the solar map reads 20 m",
       prms(hi, int(0.05 * SR)) > prms(lo, int(0.05 * SR)) * 3 and solar["band"] == "20m" and abs(solar["good"] - 0.7) < 1e-9
       and solar["none"] is None and solar["qso"].startswith("CQ CQ DE ") and " 599 " in solar["qso"],
       (prms(hi, int(0.05 * SR)), prms(lo, int(0.05 * SR)), solar))
    open_air = {"device": "pentagrid", "tune": 8500, "air": 1, "noise": 0, "crackle": 1, "bandwidth": 200, "blanker": 0,
                "text": "", "agc": 0, "fade": 0, "play": False, "level": 0.9, "mode": "am", "bfo": 0, "cond": 0.5}
    rawC, _ = prender(open_air, [], 0.8)
    blankC, _ = prender(dict(open_air, blanker=1), [], 0.8)
    ck("Pg. the blanker cuts the crackle", float(np.max(np.abs(rawC))) > 0.05 and float(np.max(np.abs(blankC))) < 0.02,
       (float(np.max(np.abs(rawC))), float(np.max(np.abs(blankC)))))
    cpu = pg.evaluate("""async () => {
      const t0 = performance.now();
      await __synth.pentagridRender({ patch: { device: 'pentagrid', tune: 14000, bfo: 800, bandwidth: 2400, air: 1, noise: 0.3, crackle: 0.2, text: 'CQ DE TEST', wpm: 18, mode: 'cw', level: 0.8, play: true }, events: [{ t: 'on', n: 69, v: 0.8, at: 0.1 }], seconds: 4 });
      return performance.now() - t0;
    }""")
    info("Pg. 4s offline render", f"{cpu:.0f} ms")

    pg_before = len(errs)
    pg.evaluate("__synth.setDevice('pentagrid')")
    pg.wait_for_timeout(300)
    ck("Pg. the dial is on screen and Filament's filter is not",
       pg.evaluate("__synth.device()") == "pentagrid" and pg.is_visible("#pentagridDial") and pg.is_visible("#pentagridText")
       and not pg.is_visible("#mFilt") and not pg.is_visible("#chassis"))
    box = pg.locator("#pentagridDial").bounding_box()
    pg.mouse.click(box["x"] + 12, box["y"] + box["height"] * 0.62)
    left_tune = pg.evaluate("__synth.patch().tune")
    pg.mouse.click(box["x"] + box["width"] - 12, box["y"] + box["height"] * 0.62)
    right_tune = pg.evaluate("__synth.patch().tune")
    ck("Pg. dragging the dial retunes from the low end to the high end", left_tune < 5000 and right_tune > 25000, (left_tune, right_tune))
    before = pg.evaluate("__synth.patch().text")
    pg.click("#pentagridQso")
    qso_text = pg.evaluate("__synth.patch().text")
    ck("Pg. QSO writes a made-up contact into the Morse box", qso_text != before and qso_text.startswith("CQ CQ DE ") and pg.locator("#pentagridText").input_value() == qso_text, qso_text)
    pg.click("#pentagridLive")
    pg.wait_for_function("() => (document.getElementById('pentagridCond').textContent || '').includes('not reachable')", timeout=5000)
    ck("Pg. live conditions fail quietly when the solar route is absent", "not reachable" in pg.locator("#pentagridCond").inner_text())
    ck("Pg. the receiver knobs sit with the dial", pg.is_visible("#kPentaRx") and pg.is_visible("#pentagridDial"))
    saved = pg.evaluate("""() => __synth.applyProject({
      name: 'Dial Test', device: 'pentagrid', tempo: 120,
      devices: { pentagrid: { patch: { tune: 14000, text: 'E', play: true, mode: 'cw', air: 0, noise: 0, crackle: 0 } } }
    })""")
    ck("Pg. a project keeps Pentagrid and its dial", saved["device"] == "pentagrid" and pg.evaluate("__synth.device()") == "pentagrid"
       and abs(pg.evaluate("__synth.patch().tune") - 14000) < 1 and pg.evaluate("__synth.patch().text") == "E" and pg.evaluate("__synth.patch().play") is True, saved["device"])
    pg.evaluate("""() => {
      const mix = __synth.mixer() || {};
      Object.keys(mix).forEach(id => __synth.setMixer(id, { mute: false, solo: false, level: mix[id].level, pan: mix[id].pan }));
      __synth.setMixer('pentagrid', { level: 1, pan: 0, mute: false, solo: false });
    }""")
    pg.evaluate("(p) => __synth.setPatch(p)", play)
    pg.wait_for_timeout(200)
    p_sr = int(pg.evaluate("() => __synth.engine().ctx.sampleRate"))
    pg.evaluate("__synth.noteOn(69, 0.85)")
    pg.evaluate("() => __synth.recordStart()")
    pg.wait_for_timeout(700)
    pg.evaluate("__synth.noteOff(69)")
    rec = pg.evaluate("() => __synth.recordStop()")
    rec_raw = base64.b64decode(rec["b64"]) if rec and rec.get("b64") else b""
    rec_info = parse_wav(rec_raw) if rec_raw else None
    rec_rms = prms(pcm24(rec_info["data"])[0]) if rec_info and len(rec_info["data"]) >= 6 else 0
    ck("Pg. the master recorder hears Pentagrid",
       rec_info and rec_info["bits"] == 24 and rec_info["ch"] == 2 and rec_info["rate"] == p_sr and rec.get("sr") == p_sr
       and rec_rms > 1e-3 and bool(_re2.fullmatch(r"Pentagrid-\d{8}-\d{6}\.wav", rec.get("name") or "")),
       (rec_rms, None if not rec else rec.get("sr"), None if not rec else rec.get("name")))
    ck("Pg. no page errors", len(errs) == pg_before, errs[pg_before:])

    # ---------------------------------------------------------------- Or. Orthicon, the spectral painter
    def orender(patch, events=None, seconds=0.5, **extra):
        payload = {"patch": patch, "events": events or [], "seconds": seconds}
        payload.update(extra)
        return dec(pg.evaluate("a => __synth.orthiconRender(a)", payload))
    def orms(x):
        return float(np.sqrt(np.mean(np.square(x)))) if len(x) else 0.0
    def ofinite(x):
        return bool(np.isfinite(x).all()) and float(np.max(np.abs(x))) <= 1.0
    devo = pg.evaluate("""() => { const d = __synth.orthiconDevice(); return {
      id: d.id, api: d.api, inst: d.instrument, outs: d.audioOutputs, midi: d.midiInput,
      proc: d.processor, worklet: d.worklet, ch: d.channels, over: d.oversample
    }; }""")
    ck("Or. adapter is a dxrack/1 instrument",
       devo["id"] == "orthicon" and devo["api"] == "dxrack/1" and devo["inst"] and devo["outs"] == 1 and devo["midi"]
       and devo["proc"] == "orthicon" and devo["worklet"] == "orthicon.worklet.js" and devo["ch"] == 2 and devo["over"] == 1, devo)
    painted = pg.evaluate("""() => __synth.orthiconRender({
      patch: { device: 'orthicon', picture: 'custom', keyboard: false, hold: true, engine: 'add', phase: 'coherent', width: 0, level: 1, curve: 1, speed: 4, loop: true, scale: 'off', fLo: 80, fHi: 8000 },
      toneHz: 440, seconds: 0.5
    })""")
    pL, pR = dec(painted)
    pmid = pL[len(pL) // 5:]
    fp = peak_freq(pmid)
    expect_hz = painted["expect"]["hz"]
    ck(f"Or. a painted line peaks at the painted frequency ({fp:.2f} Hz, row {expect_hz:.2f})",
       abs(fp - expect_hz) < 8 and abs(fp - 440) < 12 and ofinite(pL) and ofinite(pR) and float(np.max(np.abs(pL - pR))) < 1e-3 and orms(pmid) > 0.05,
       (round(fp, 2), round(expect_hz, 2), round(orms(pmid), 4)))
    ifft = pg.evaluate("""() => __synth.orthiconRender({
      patch: { device: 'orthicon', picture: 'custom', keyboard: false, hold: true, engine: 'ifft', phase: 'coherent', width: 0, level: 1, curve: 1, speed: 4, loop: true, scale: 'off' },
      toneHz: 440, seconds: 0.55
    })""")
    iL, iR = dec(ifft)
    fi = peak_freq(iL[len(iL) // 5:])
    ck(f"Or. inverse FFT peaks at the painted frequency ({fi:.2f} Hz)",
       abs(fi - ifft["expect"]["hz"]) < 12 and abs(fi - 440) < 12 and ofinite(iL) and ofinite(iR) and orms(iL[len(iL) // 5:]) > 0.02,
       (round(fi, 2), ifft["expect"], round(orms(iL), 4)))
    for name in ("Ember Ridge", "Lantern Stack", "Veil", "Fifth Drone"):
        spec = pg.evaluate("(n) => __synth.orthiconPatch(n)", name)
        aL, aR = orender(spec, seconds=0.45)
        ck(f"Or. {name} is not silent", orms(aL) > 0.01 and orms(aR) > 0.01 and ofinite(aL) and ofinite(aR), round(orms(aL), 4))
    glyph = pg.evaluate("() => __synth.orthiconPatch('Glyph Keys')")
    gL, gR = orender(glyph, seconds=0.4)
    ck("Or. Glyph Keys is silent until a note", orms(gL) < 1e-4 and orms(gR) < 1e-4, round(orms(gL), 6))
    held = [{"t": "on", "n": 60, "v": 0.9, "at": 0.04}, {"t": "off", "n": 60, "at": 0.28}]
    kL, kR = orender(glyph, held, 0.85)
    kmid = kL[int(0.1 * SR):int(0.22 * SR)]
    ktail = kL[int(0.55 * SR):]
    ck("Or. a key sounds, then the release goes silent",
       orms(kmid) > 0.02 and orms(ktail) < 1e-4 and ofinite(kL) and ofinite(kR),
       (round(orms(kmid), 4), round(orms(ktail), 6)))
    chord = [{"t": "on", "n": 60, "v": 0.8, "at": 0.02}, {"t": "on", "n": 64, "v": 0.8, "at": 0.04},
             {"t": "off", "n": 60, "at": 0.22}, {"t": "off", "n": 64, "at": 0.42}]
    cL, _cR = orender(glyph, chord, 0.9)
    both = cL[int(0.08 * SR):int(0.18 * SR)]
    one = cL[int(0.28 * SR):int(0.38 * SR)]
    none = cL[int(0.65 * SR):]
    ck("Or. releasing one note leaves the other, then both off is silent",
       orms(both) > 0.02 and orms(one) > 0.01 and orms(none) < 1e-4,
       (round(orms(both), 4), round(orms(one), 4), round(orms(none), 6)))
    panL, _panR = orender(glyph, [{"t": "on", "n": 60, "v": 0.9, "at": 0.02}, {"t": "panic", "at": 0.16}], 0.6)
    ck("Or. panic clears the note",
       orms(panL[int(0.06 * SR):int(0.12 * SR)]) > 0.02 and orms(panL[int(0.35 * SR):]) < 1e-4,
       (round(orms(panL[int(0.06 * SR):int(0.12 * SR)]), 4), round(orms(panL[int(0.35 * SR):]), 6)))
    octave = pg.evaluate("""() => __synth.orthiconRender({
      patch: { device: 'orthicon', picture: 'custom', keyboard: true, hold: true, engine: 'add', phase: 'coherent', width: 0, level: 1, scale: 'off' },
      toneHz: 440, seconds: 0.45, events: [{ t: 'on', n: 72, v: 0.9, at: 0.02 }]
    })""")
    oL, _oR = dec(octave)
    fo = peak_freq(oL[len(oL) // 5:])
    ck(f"Or. keys mode transposes the picture ({fo:.1f} Hz, an octave above {octave['expect']['hz']:.1f})",
       abs(fo - octave["expect"]["hz"] * 2) < 16 and ofinite(oL), (round(fo, 2), octave["expect"]))
    q = pg.evaluate("() => __synth.orthiconQuantize(473, 'major', 60)")
    ck("Or. quantize moves an off-scale tone onto the scale",
       q["toRow"] != q["fromRow"] and abs(q["toHz"] - q["from"]) > 4, q)
    az = pg.evaluate("() => __synth.orthiconAnalyze(440)")
    ck(f"Or. analysing a 440 Hz tone lands on that row ({az['hz']:.1f} Hz)", abs(az["hz"] - 440) < 15, az)
    pg.evaluate("__synth.setDevice('orthicon')")
    pg.wait_for_timeout(300)
    ck("Or. the picture is on screen",
       pg.evaluate("__synth.device()") == "orthicon" and pg.is_visible("#orthiconCanvas") and not pg.is_visible("#mFilt") and not pg.is_visible("#chassis"))
    help_o = pg.evaluate("""() => [...document.querySelectorAll('#mOrthStage .note, .intro[data-dev="orthicon"]')].map(n => n.textContent).join(' ')""")
    ck("Or. help says Capture rack is an input, not an export", "Capture rack is an input, not an export" in help_o, help_o)
    pg.evaluate("""() => __synth.setPatch({ device: 'orthicon', picture: 'custom', brush: 'hard', brushSize: 1.2, keyboard: false, hold: true, engine: 'add', phase: 'coherent', width: 0, level: 1 })""")
    pg.wait_for_timeout(150)
    pg.evaluate("() => __synth.orthiconClear()")
    box = pg.locator("#orthiconCanvas").bounding_box()
    y = box["y"] + box["height"] * 0.62
    pg.mouse.move(box["x"] + 8, y)
    pg.mouse.down()
    pg.mouse.move(box["x"] + box["width"] - 8, y, steps=8)
    pg.mouse.up()
    pg.wait_for_timeout(80)
    energy = pg.evaluate("__synth.orthiconState().energy")
    ck("Or. painting the canvas puts energy in the picture", energy > 1, energy)
    import struct as _st, zlib as _zl
    def _png_chunk(tag, data):
        return _st.pack(">I", len(data)) + tag + data + _st.pack(">I", _zl.crc32(tag + data) & 0xFFFFFFFF)
    w_px, h_px, y_white = 96, 128, 80
    raw = b""
    for yy in range(h_px):
        raw += b"\x00" + (b"\xff\xff\xff" * w_px if yy == y_white else b"\x00\x00\x00" * w_px)
    png = b"\x89PNG\r\n\x1a\n" + _png_chunk(b"IHDR", _st.pack(">IIBBBBB", w_px, h_px, 8, 2, 0, 0, 0)) + _png_chunk(b"IDAT", _zl.compress(raw)) + _png_chunk(b"IEND", b"")
    img_path = os.path.join(SHOTS, "orthicon-line.png")
    open(img_path, "wb").write(png)
    pg.locator("#orthiconImage").set_input_files(img_path)
    pg.wait_for_function("() => __synth.orthiconState().source === 'image' && __synth.orthiconState().energy > 10", timeout=5000)
    img = pg.evaluate("""() => __synth.orthiconRender({
      patch: { device: 'orthicon', picture: 'custom', keyboard: false, hold: true, engine: 'add', phase: 'coherent', width: 0, level: 1, curve: 1, scale: 'off', fLo: 80, fHi: 8000 },
      useHost: true, seconds: 0.45
    })""")
    imL, imR = dec(img)
    fimg = peak_freq(imL[len(imL) // 5:])
    ck(f"Or. a dropped image plays the bright row ({fimg:.1f} Hz)",
       abs(fimg - 440) < 12 and ofinite(imL) and ofinite(imR) and orms(imL) > 0.02, (round(fimg, 2), round(orms(imL), 4), pg.evaluate("__synth.orthiconState().energy")))
    pics = pg.evaluate("__synth.orthiconPictures()")
    pic_ids = [p["id"] for p in pics]
    ck("Or. eight drawn pictures", pic_ids == ["stack", "sweep", "choir", "bell", "shimmer", "rain", "spiral", "stars"]
       and all(p.get("name") for p in pics), pic_ids)
    probes = pg.evaluate("""() => {
      const ids = __synth.orthiconPictures().map(p => p.id);
      const out = {};
      ids.forEach(id => { out[id] = __synth.orthiconProbe(id); });
      return out;
    }""")
    ck("Or. every drawn picture has energy",
       all(probes[i]["energy"] > 20 and probes[i]["digest"] > 0 for i in pic_ids),
       {i: round(probes[i]["energy"], 1) for i in pic_ids})
    ck("Or. the twin sweep rises",
       probes["sweep"]["startHz"] < 140 and probes["sweep"]["endHz"] > 1500, (probes["sweep"]["startHz"], probes["sweep"]["endHz"]))
    ck("Or. the choir walks from ah toward eh",
       abs(probes["choir"]["startHz"] - 730) < 40 and abs(probes["choir"]["endHz"] - 530) < 40,
       (probes["choir"]["startHz"], probes["choir"]["endHz"]))
    ck("Or. the bell is bright at the strike and quiet at the end",
       probes["bell"]["head"] > 12 and probes["bell"]["tail"] < 1 and 220 < probes["bell"]["startHz"] < 280,
       (probes["bell"]["head"], probes["bell"]["tail"], probes["bell"]["startHz"]))
    ck("Or. the stack is a held chord and the starfield is sparse",
       probes["stack"]["energy"] > 400 and probes["stack"]["lit"] > 700
       and probes["stars"]["lit"] < 500 and probes["stars"]["energy"] > 30
       and probes["spiral"]["lit"] > 1000 and probes["shimmer"]["energy"] > 200 and probes["rain"]["energy"] > 100,
       (probes["stack"]["lit"], probes["stars"]["lit"], probes["spiral"]["lit"]))
    same = pg.evaluate("""() => {
      const a = __synth.orthiconGenerate(42, 'major', false);
      const b = __synth.orthiconGenerate(42, 'major', false);
      const c = __synth.orthiconGenerate(99, 'major', false);
      const bad = __synth.orthiconShareParse('nope');
      const ok = __synth.orthiconShareParse('42.major');
      return { a: a.digest, b: b.digest, c: c.digest, share: a.share, on: a.onScale, off: a.offScale, bad, ok };
    }""")
    ck("Or. the same seed draws the same picture, and another seed does not",
       same["a"] == same["b"] and same["a"] != same["c"] and same["share"] == "42.major"
       and same["on"] > same["off"] * 1.3 and same["bad"] is None and same["ok"]["seed"] == 42 and same["ok"]["scale"] == "major",
       same)
    stack = pg.evaluate("""() => __synth.orthiconDraw('stack', false)""")
    stL, stR = orender({"device": "orthicon", "picture": "custom", "keyboard": False, "hold": True, "engine": "add",
                        "phase": "coherent", "width": 0, "level": 1, "curve": 1, "scale": "off", "fLo": 80, "fHi": 8000},
                       seconds=0.4, useHost=True)
    fst = peak_freq(stL[len(stL) // 5:])
    ck(f"Or. the harmonic stack peaks on its root ({fst:.1f} Hz)",
       abs(fst - 132.9) < 12 and ofinite(stL) and ofinite(stR) and orms(stL) > 0.02, (round(fst, 2), round(orms(stL), 4)))
    stars = pg.evaluate("""() => __synth.orthiconDraw('stars', false)""")
    over = pg.evaluate("""() => __synth.orthiconGenerate(7, 'pentatonic', true)""")
    ck("Or. Over keeps the picture underneath",
       over["energy"] + 0.05 >= stars["energy"] and over["digest"] != stars["digest"] and over["source"] == "gen",
       (round(stars["energy"], 1), round(over["energy"], 1)))
    undone = pg.evaluate("""() => __synth.orthiconUndo()""")
    ck("Or. Undo restores the picture under a generate",
       undone and undone["digest"] == stars["digest"] and undone["source"] == "stars",
       None if not undone else (undone["digest"], undone["source"]))
    pg.evaluate("""() => __synth.setPatch({ device: 'orthicon', picture: 'custom', scale: 'major', root: 60, keyboard: false, hold: true })""")
    pg.wait_for_timeout(80)
    pg.fill("#orthiconSeed", "42")
    pg.click("#orthiconGenerate")
    pg.wait_for_timeout(80)
    gen_ui = pg.evaluate("__synth.orthiconState()")
    ck("Or. Generate uses the seed box",
       gen_ui["source"] == "gen" and gen_ui["digest"] == same["a"] and gen_ui["seed"] == 42 and "42" in (gen_ui["label"] or ""),
       gen_ui)
    pg.click("#orthiconLink")
    share_q = pg.evaluate("() => new URL(location.href).searchParams.get('or')")
    ck("Or. Copy link shares the seed", share_q == "42.major", share_q)
    pg.evaluate("""() => { const u = new URL(location.href); u.searchParams.delete('or'); history.replaceState(null, '', u); }""")
    before_clear = pg.evaluate("__synth.orthiconState().digest")
    pg.click("#orthiconClear")
    cleared = pg.evaluate("__synth.orthiconState()")
    ck("Or. Clear wipes the canvas",
       pg.is_visible("#orthiconClear") and cleared["energy"] < 0.01 and cleared["picture"] == "custom" and cleared["canUndo"],
       cleared)
    pg.click("#orthiconUndo")
    restored = pg.evaluate("__synth.orthiconState()")
    ck("Or. Undo puts back the picture Clear removed",
       restored["digest"] == before_clear and restored["energy"] > 10, (restored["digest"], round(restored["energy"], 1)))
    held_stack = pg.evaluate("""() => __synth.orthiconDraw('stack', false)""")
    pg.evaluate("""() => __synth.setPatch({ device: 'orthicon', picture: 'lantern', keyboard: false, hold: true, level: 0.7 })""")
    pg.wait_for_function("() => __synth.orthiconState().source === 'lantern'", timeout=3000)
    pg.click("#orthiconUndo")
    pg.wait_for_timeout(80)
    back = pg.evaluate("__synth.orthiconState()")
    ck("Or. Undo restores the canvas after a preset picture",
       back["digest"] == held_stack["digest"] and back["source"] == "stack" and back["picture"] == "custom",
       (back["source"], back["picture"], back["digest"]))
    share_pg = b.new_page(viewport={"width": 1366, "height": 900})
    share_err = []
    share_pg.on("pageerror", lambda e: share_err.append(str(e)))
    share_pg.goto(BASE + "?or=42.major")
    share_pg.wait_for_function("window.__synth && __synth.ready()", timeout=20000)
    share_pg.wait_for_function("() => __synth.device() === 'orthicon' && __synth.orthiconState().source === 'gen'", timeout=5000)
    shared = share_pg.evaluate("__synth.orthiconState()")
    ck("Or. a shared seed opens the same picture",
       shared["digest"] == same["a"] and shared["seed"] == 42 and not share_err, (shared.get("digest"), shared.get("seed"), share_err))
    share_pg.close()
    ck("Or. Clear, Generate, and the pictures are on the panel",
       pg.is_visible("#orthiconClear") and pg.is_visible("#orthiconUndo") and pg.is_visible("#orthiconGenerate")
       and pg.is_visible("#orthiconOver") and pg.is_visible("#orthiconSeed") and pg.locator("#orthiconPictures button").count() == 8)
    pg.evaluate("""() => __synth.setPatch({ device: 'orthicon', picture: 'glyph', keyboard: true, level: 0.8, engine: 'add', phase: 'coherent' })""")
    pg.wait_for_timeout(120)
    pg.evaluate("__synth.noteOn(60, 0.8)")
    pg.wait_for_timeout(60)
    pg.evaluate("__synth.noteOff(60)")
    pg.wait_for_timeout(40)
    ck("Or. a live note-off leaves no key held", pg.evaluate("__synth.state().down") == [], pg.evaluate("__synth.state()"))
    pg.screenshot(path=os.path.join(SHOTS, "synth_orthicon_desktop.png"), full_page=True)
    ph = b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    perr = []
    ph.on("pageerror", lambda e: perr.append(str(e)))
    ph.goto(BASE)
    ph.wait_for_function("window.__synth && __synth.ready()", timeout=20000)
    ph.evaluate("__synth.setDevice('pentagrid')")
    ph.wait_for_timeout(300)
    ck("Pg. 390px: no horizontal scroll, the dial is up, one section",
       ph.evaluate("document.documentElement.scrollWidth <= innerWidth && innerWidth === 390")
       and ph.is_visible("#pentagridDial") and not ph.is_visible("#mFilt")
       and ph.evaluate("[...document.querySelectorAll('.mod')].filter(m => m.offsetParent).length") <= 4,
       (ph.evaluate("[document.documentElement.scrollWidth, innerWidth]"), perr))
    small = ph.evaluate("""() => [...document.querySelectorAll('.devbtn, .tabs button, #pentagridRoot .chip, #pentagridRoot .btn, #pentagridRoot input')]
      .filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; })
      .map(e => (e.id || e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))""")
    ck("Pg. 390px: rail, tabs and dial controls are 44 px or more", not small, small)
    ph.tap('.tabs [data-go="band"]')
    ph.wait_for_timeout(200)
    ck("Pg. 390px: the Band tab shows the receiver", ph.is_visible("#kPentaRx") and not ph.is_visible("#pentagridDial")
       and ph.evaluate("document.documentElement.scrollWidth <= innerWidth && innerWidth === 390"))
    ph.screenshot(path=os.path.join(SHOTS, "synth_pentagrid_phone.png"))
    ck("Pg. 390px: no page errors", not perr, perr)
    ph.evaluate("__synth.setDevice('orthicon')")
    ph.wait_for_timeout(200)
    ph.tap('.tabs [data-go="play"]')
    ph.wait_for_timeout(200)
    ck("Or. 390px: no horizontal scroll, the picture is up, one section",
       ph.evaluate("document.documentElement.scrollWidth <= innerWidth && innerWidth === 390")
       and ph.is_visible("#orthiconCanvas") and not ph.is_visible("#mFilt") and not ph.is_visible("#chassis")
       and ph.evaluate("[...document.querySelectorAll('.mod')].filter(m => m.offsetParent).length") <= 4,
       (ph.evaluate("[document.documentElement.scrollWidth, innerWidth]"), perr))
    small = ph.evaluate("""() => [...document.querySelectorAll('.devbtn, .tabs button, #orthiconRoot .chip, #orthiconRoot .btn, #orthiconRoot .knob')]
      .filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; })
      .map(e => (e.id || e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))""")
    ck("Or. 390px: rail, tabs, brushes and knobs are 44 px or more", not small, small)
    ph.tap('.tabs [data-go="scan"]')
    ph.wait_for_timeout(200)
    ck("Or. 390px: the Scan tab shows the scan controls",
       ph.is_visible("#mOrthScan") and ph.is_visible("#kOrthScan") and not ph.is_visible("#orthiconCanvas")
       and ph.evaluate("document.documentElement.scrollWidth <= innerWidth && innerWidth === 390"))
    ph.screenshot(path=os.path.join(SHOTS, "synth_orthicon_phone.png"))
    ck("Or. 390px: no page errors", not perr, perr)
    ph.close()
    pg.evaluate("__synth.setDevice('filament')")
    pg.wait_for_timeout(150)

    # ---------------------------------------------------------------- Fr. Trochotron, the fractal seed
    def tr_notes(settings):
        return pg.evaluate("s => __synth.trochotronPiece(s)", settings)
    def tr_render(patch, seconds=1.2):
        return dec(pg.evaluate("a => __synth.trochotronRender(a)", {"patch": patch, "seconds": seconds, "playing": True}))
    def tr_rms(x):
        if len(x) == 0: return 0.0
        return float(np.sqrt(np.mean(np.square(x))))
    devf = pg.evaluate("""() => { const d = __synth.trochotronDevice(); return {
      id: d.id, api: d.api, inst: d.instrument, outs: d.audioOutputs, midi: d.midiInput, proc: d.processor,
      worklet: d.worklet, ch: d.channels, name: d.name, gen: d.parameters.generator && d.parameters.generator.choices,
      seed: d.parameters.seed && d.parameters.seed.type }; }""")
    ck("Fr. Trochotron publishes a stereo MIDI dxrack/1 device",
       devf["id"] == "trochotron" and devf["api"] == "dxrack/1" and devf["inst"] and devf["outs"] == 1 and devf["midi"]
       and devf["proc"] == "trochotron" and devf["worklet"] == "trochotron.worklet.js" and devf["ch"] == 2
       and devf["name"] == "Trochotron" and devf["seed"] == "int"
       and all(g in (devf["gen"] or []) for g in ("lsystem", "mandelbrot", "julia", "logistic", "lorenz", "thue")), devf)
    seed = {"device": "trochotron", "seed": 42, "generator": "mandelbrot", "depth": 3, "scale": "dorian", "key": 2, "tempo": 108, "density": 0.4, "chaos": 0.35, "voices": 3, "zoom": 1, "cx": -0.6, "cy": 0}
    one = tr_notes(seed)
    two = tr_notes(dict(seed))
    ck("Fr. the same seed and settings grow the same notes",
       one["notes"] == two["notes"] and len(one["notes"]) > 8 and one["seed"] == 42, (len(one["notes"]), one["seed"]))
    other = tr_notes(dict(seed, seed=99))
    ck("Fr. a different seed grows a different piece", other["notes"] != one["notes"], len(other["notes"]))
    for gen in ("lsystem", "mandelbrot", "julia", "logistic", "lorenz", "thue"):
        grown = tr_notes(dict(seed, generator=gen, voices=3))
        layers = {row[4] for row in grown["notes"]}
        ck(f"Fr. {gen} grows lead, mid and bass",
           len(grown["notes"]) > 8 and layers == {"lead", "mid", "bass"} and bool(grown["rules"]),
           (len(grown["notes"]), sorted(layers), (grown["rules"] or "")[:80]))
    rules = tr_notes(dict(seed, generator="lsystem", chaos=0.2))
    ck("Fr. the L-system shows an axiom and a rule",
       "axiom" in rules["rules"] and "P  ->" in rules["rules"], rules["rules"])
    calm = tr_notes(dict(seed, generator="logistic", chaos=0))
    wild = tr_notes(dict(seed, generator="logistic", chaos=1))
    ck("Fr. logistic chaos moves r from the ordered side toward 4",
       abs(calm["r"] - 2.8) < 1e-6 and abs(wild["r"] - 4) < 1e-6 and calm["notes"] != wild["notes"],
       (calm["r"], wild["r"]))
    near = tr_notes(dict(seed, generator="julia", zoom=1))
    far = tr_notes(dict(seed, generator="julia", zoom=8, cx=-0.2, cy=0.4))
    ck("Fr. zoom and window change the orbit's notes", near["notes"] != far["notes"], (len(near["notes"]), len(far["notes"])))
    shared = pg.evaluate("""() => {
      const p = { device: 'trochotron', seed: 17, generator: 'thue', depth: 4, scale: 'minor', key: 9, tempo: 96, chaos: 0.2, voices: 2, route: 'lattice' };
      const text = __synth.trochotronShare(p);
      const back = __synth.trochotronParse(text);
      const a = __synth.trochotronPiece(p).notes;
      const b = __synth.trochotronPiece(back).notes;
      return { text, same: JSON.stringify(a) === JSON.stringify(b), notes: a.length };
    }""")
    ck("Fr. a share string round-trips to the same notes", shared["same"] and shared["notes"] > 4 and "~" in shared["text"], shared)
    mid = pg.evaluate("""() => {
      const bytes = __synth.trochotronMidi({ device: 'trochotron', seed: 42, generator: 'mandelbrot', voices: 3, tempo: 108 });
      const f = __synth.smf.read(bytes);
      const notes = f.song.parts.reduce((n, p) => n + (p.notes || 0), 0);
      return { notes, parts: f.song.parts.length, bpm: f.song.bpm };
    }""")
    ck("Fr. export is a MIDI file with the piece on more than one track",
       mid["notes"] > 8 and mid["parts"] >= 2 and abs(mid["bpm"] - 108) < 0.2, mid)
    loudL, loudR = tr_render(dict(seed, generator="thue", voices=2, tempo=132, level=0.9), 1.4)
    ck("Fr. the piece is not silent", tr_rms(loudL) > 1e-3 and tr_rms(loudR) > 1e-3, (tr_rms(loudL), tr_rms(loudR)))
    quietL, quietR = tr_render({"device": "trochotron", "level": 0, "seed": 42, "generator": "thue"}, 0.6)
    ck("Fr. level 0 is silent", tr_rms(quietL) < 1e-5 and tr_rms(quietR) < 1e-5, (tr_rms(quietL), tr_rms(quietR)))
    pg.evaluate("__synth.setDevice('trochotron')")
    pg.wait_for_timeout(250)
    ck("Fr. the seed panel is on screen and Filament's filter is not",
       pg.evaluate("__synth.device()") == "trochotron" and pg.is_visible("#trCanvas") and pg.is_visible("#trSeed")
       and pg.is_visible("#trRules") and not pg.is_visible("#mFilt") and not pg.is_visible("#chassis"))
    before_zoom = pg.evaluate("__synth.trochotronPiece().notes")
    pg.click("#trZoomIn")
    pg.wait_for_timeout(80)
    after_zoom = pg.evaluate("__synth.trochotronPiece().notes")
    ck("Fr. zoom in on the picture changes the notes", before_zoom != after_zoom and pg.evaluate("__synth.patch().zoom") > 1, pg.evaluate("__synth.patch().zoom"))
    pg.evaluate("__synth.noteOn(60, 0.85)")
    pg.wait_for_function("() => (__synth.trochotronMeter().voices || 0) > 0", timeout=2000)
    held = pg.evaluate("__synth.trochotronMeter()")
    pg.evaluate("__synth.noteOff(60)")
    pg.wait_for_function("() => (__synth.trochotronMeter().voices || 0) === 0", timeout=2000)
    released = pg.evaluate("__synth.trochotronMeter()")
    ck("Fr. a key speaks and then lets go", (held.get("voices") or 0) > 0 and (released.get("voices") or 0) == 0, (held, released))
    pg.evaluate("""() => __synth.setPatch({ device: 'trochotron', seed: 42, generator: 'thue', voices: 3, tempo: 140, route: 'internal' })""")
    pg.wait_for_timeout(80)
    pg.evaluate("__synth.trochotronPlay()")
    pg.wait_for_timeout(280)
    playing = pg.evaluate("__synth.trochotronState()")
    pg.evaluate("__synth.trochotronStop()")
    pg.wait_for_function("() => (__synth.trochotronMeter().voices || 0) === 0 && __synth.trochotronState().playing === false", timeout=2000)
    stopped = pg.evaluate("__synth.trochotronMeter()")
    ck("Fr. play starts the piece and stop leaves no stuck notes",
       playing["playing"] is True and playing["notes"] > 8 and (stopped.get("voices") or 0) == 0 and pg.evaluate("__synth.trochotronState().playing") is False,
       (playing, stopped))
    pg.evaluate("""() => __synth.setPatch({ device: 'trochotron', seed: 7, generator: 'thue', voices: 1, tempo: 60, density: 0, route: 'filament', level: 0.2 })""")
    pg.wait_for_timeout(80)
    pg.evaluate("__synth.trochotronPlay()")
    pg.wait_for_function("() => (__synth.engine().meters.filament.voices || 0) > 0", timeout=3000)
    routed = pg.evaluate("() => __synth.engine().meters.filament")
    pg.evaluate("__synth.trochotronStop()")
    pg.wait_for_function("() => (__synth.engine().meters.filament.voices || 0) === 0 && (__synth.trochotronMeter().voices || 0) === 0", timeout=4000)
    routed_off = pg.evaluate("() => ({ fil: __synth.engine().meters.filament, tr: __synth.trochotronMeter() })")
    ck("Fr. routing plays Filament and stop releases both",
       routed and (routed.get("voices") or 0) > 0 and (routed_off["fil"].get("voices") or 0) == 0 and (routed_off["tr"].get("voices") or 0) == 0,
       (routed, routed_off))
    pg.evaluate("__synth.panic()")
    link = pg.evaluate("""() => {
      document.getElementById('trLink').click();
      return location.search;
    }""")
    ck("Fr. copy link writes the share into the page address", "tr=" in link, link)
    ph = b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    perr = []
    ph.on("pageerror", lambda e: perr.append(str(e)))
    ph.goto(BASE + "?tr=" + pg.evaluate("__synth.trochotronShare()"))
    ph.wait_for_function("window.__synth && __synth.ready()", timeout=20000)
    ph.wait_for_function("() => __synth.device()==='trochotron' && __synth.trochotronState().seed === __synth.patch().seed && __synth.trochotronState().generator === __synth.patch().generator", timeout=5000)
    ph.wait_for_timeout(100)
    phone_piece = ph.evaluate("__synth.trochotronPiece().notes")
    desk_piece = pg.evaluate("__synth.trochotronPiece().notes")
    ck("Fr. the share address opens the same piece",
       ph.evaluate("__synth.device()") == "trochotron" and phone_piece == desk_piece and len(phone_piece) > 4,
       (ph.evaluate("__synth.device()"), len(phone_piece), len(desk_piece)))
    ck("Fr. 390px: no horizontal scroll, the picture is up",
       ph.evaluate("document.documentElement.scrollWidth <= innerWidth && innerWidth === 390")
       and ph.is_visible("#trCanvas") and not ph.is_visible("#mFilt"),
       (ph.evaluate("[document.documentElement.scrollWidth, innerWidth]"), perr))
    small = ph.evaluate("""() => [...document.querySelectorAll('.devbtn, .tabs button, #trRoot .chip, #trRoot .btn, #trRoot input, #trRoot select')]
      .filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; })
      .map(e => (e.id || e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))""")
    ck("Fr. 390px: rail, tabs and seed controls are 44 px or more", not small, small)
    ph.tap('.tabs [data-go="shape"]')
    ph.wait_for_timeout(200)
    shape_small = ph.evaluate("""() => [...document.querySelectorAll('#trRoot .chip, #trRoot .btn, #trRoot input, #trRoot select')]
      .filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; })
      .map(e => (e.id || e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))""")
    ck("Fr. 390px: the Shape tab fits and its controls are 44 px or more",
       not shape_small and ph.is_visible("#trDepth") and not ph.is_visible("#trCanvas")
       and ph.evaluate("document.documentElement.scrollWidth <= innerWidth && innerWidth === 390"),
       (shape_small, ph.evaluate("[document.documentElement.scrollWidth, innerWidth]")))
    ph.screenshot(path=os.path.join(SHOTS, "synth_trochotron_phone.png"))
    ck("Fr. 390px: no page errors", not perr, perr)
    ph.close()

    # ---------------------------------------------------------------- Gy. Gyrotron, the gravity sequencer
    devy = pg.evaluate("""() => { const d = __synth.gyrotronDevice(); return {
      id: d.id, name: d.name, api: d.api, inst: d.instrument, outs: d.audioOutputs,
      midiIn: d.midiInput, midiOut: d.midiOutput, proc: d.processor, worklet: d.worklet,
      ch: d.channels, over: d.oversample,
      scale: d.parameters.scale && d.parameters.scale.choices,
      seed: d.parameters.seed && d.parameters.seed.default,
      seedType: d.parameters.seed && d.parameters.seed.type,
      bodies: d.parameters.bodyCount && d.parameters.bodyCount.type,
      gravity: d.parameters.gravity && d.parameters.gravity.type,
    }; }""")
    ck("Gy. Gyrotron is a stereo dxrack/1 instrument with MIDI in and out",
       devy["id"] == "gyrotron" and devy["name"] == "Gyrotron" and devy["api"] == "dxrack/1" and devy["inst"]
       and devy["outs"] == 1 and devy["midiIn"] and devy["midiOut"] and devy["proc"] == "gyrotron"
       and devy["worklet"] == "gyrotron.worklet.js" and devy["ch"] == 2 and devy["over"] == 1
       and devy["seed"] == 1701 and devy["seedType"] == "int" and devy["bodies"] == "int" and devy["gravity"] == "float"
       and "penta" in (devy["scale"] or []) and "free" in (devy["scale"] or []),
       devy)
    sky = {"device": "gyrotron", "seed": 1701, "running": True}
    sim_a = pg.evaluate("(p) => __synth.gyrotronSim(p, 2)", sky)
    sim_b = pg.evaluate("(p) => __synth.gyrotronSim(p, 2)", sky)
    kinds = {e["kind"] for e in sim_a["events"]}
    ck("Gy. the same seed builds the same sky", sim_a == sim_b and sim_a["stats"]["hit"] > 0 and sim_a["stats"]["cross"] > 0, sim_a["stats"])
    other = pg.evaluate("(p) => __synth.gyrotronSim(Object.assign({}, p, { seed: 1702 }), 2)", sky)
    ck("Gy. a different seed is a different sky", other != sim_a and other["stats"]["hit"] > 0, other["stats"])
    ck("Gy. collisions and orbit crossings each schedule a note",
       {"hit", "cross"} <= kinds and len(sim_a["events"]) > 8, sim_a["stats"])
    hit = pg.evaluate("""() => __synth.gyrotronScript(
      { device: 'gyrotron', gravity: 0, pull: 0, drag: 0, root: 60, scale: 'major', key: 0 },
      [{ t: 'body', x: 0.35, y: 0.5, vx: 0.5, vy: 0, r: 0.04 },
       { t: 'body', x: 0.65, y: 0.5, vx: -0.5, vy: 0, r: 0.04 }],
      0.6)""")
    ck("Gy. two bodies on a line collide once",
       hit["stats"]["hit"] == 1 and hit["stats"]["cross"] == 0 and len(hit["events"]) == 1
       and hit["events"][0]["kind"] == "hit" and abs(hit["events"][0]["at"] - 0.222222) < 1e-4
       and hit["events"][0]["pan"] == 0 and hit["events"][0]["midi"] == int(hit["events"][0]["midi"]),
       hit["events"])
    cross = pg.evaluate("""() => __synth.gyrotronScript(
      { device: 'gyrotron', gravity: 0, pull: 0, drag: 0, root: 60, scale: 'major', key: 0 },
      [{ t: 'well', x: 0.5, y: 0.5, reach: 0.2 },
       { t: 'body', x: 0.72, y: 0.48, vx: 0, vy: 0.45, r: 0.02 }],
      0.5)""")
    ck("Gy. a body crossing a well rings one note",
       cross["stats"]["cross"] == 1 and cross["stats"]["hit"] == 0 and len(cross["events"]) == 1
       and cross["events"][0]["kind"] == "cross" and cross["events"][0]["midi"] == 60
       and abs(cross["events"][0]["at"] - 0.044444) < 1e-4,
       cross["events"])
    major = pg.evaluate("() => __synth.gyrotronPitch(0.07, 60, 'major', 0)")
    free_n = pg.evaluate("() => __synth.gyrotronPitch(0.07, 60, 'free', 0)")
    ck("Gy. a scale snaps and free keeps the fractional pitch",
       major["midi"] == 48 and major["snapped"] is True
       and abs(major["hz"] - 440 * (2 ** ((48 - 69) / 12))) < 1e-6
       and free_n["snapped"] is False and abs(free_n["hz"] - major["hz"]) > 0.01,
       (major, free_n))
    def gyrender(patch, seconds):
        return dec(pg.evaluate("(a) => __synth.gyrotronRender(a)", {"patch": patch, "seconds": seconds, "sampleRate": 48000}))
    world_patch = {"device": "gyrotron", "seed": 1701, "running": True, "level": 0.84, "scale": "penta"}
    yL, yR = gyrender(world_patch, 1.2)
    yL2, yR2 = gyrender(world_patch, 1.2)
    ypeak = float(max(np.max(np.abs(yL)), np.max(np.abs(yR))))
    ck("Gy. an orbit render is finite, audible and inside 0 dBFS",
       np.isfinite(yL).all() and np.isfinite(yR).all() and hrms(yL) > 1e-3 and hrms(yR) > 1e-3 and ypeak <= 1.0 + 1e-6,
       (hrms(yL), hrms(yR), ypeak))
    ck("Gy. two renders of one seed match", float(np.max(np.abs(yL - yL2))) == 0 and float(np.max(np.abs(yR - yR2))) == 0)
    quietL, quietR = gyrender({"device": "gyrotron", "seed": 1701, "running": True, "level": 0}, 0.6)
    ck("Gy. level 0 is silent", hrms(quietL) < 1e-5 and hrms(quietR) < 1e-5, (hrms(quietL), hrms(quietR)))
    capv = pg.evaluate("""() => __synth.gyrotronProbe(
      { device: 'gyrotron', running: false, voices: 4, level: 0.8, route: 'self' },
      Array.from({length: 20}, (_, i) => ({ t: 'on', n: 48 + i, v: 0.8, at: 0.02 })),
      0.5)""")
    ck("Gy. the voice pool never passes the cap", capv["maxVoices"] <= 4 and capv["maxVoices"] >= 1, capv)
    ended = pg.evaluate("""() => __synth.gyrotronProbe(
      { device: 'gyrotron', running: false, voices: 8, level: 0.8, route: 'filament' },
      [{ t: 'on', n: 60, v: 0.8, local: true, at: 0.02 }, { t: 'panic', at: 0.2 }],
      0.8)""")
    ck("Gy. panic releases the voice and closes the routed note",
       ended["sounding"] == 0 and ended["tail"] < 1e-4 and ended["midiOn"] == ended["midiOff"] and ended["midiOn"] >= 1,
       ended)
    asleep = pg.evaluate("""() => __synth.gyrotronProbe(
      { device: 'gyrotron', running: true, level: 0.9 },
      [{ t: 'active', on: false, at: 0 }, { t: 'gesture', g: { t: 'well', x: 0.2, y: 0.2 }, at: 0.05 },
       { t: 'on', n: 60, v: 0.9, local: true, at: 0.05 }],
      0.5)""")
    ck("Gy. a sleeping orbit is silent", asleep["rms"] < 1e-5 and asleep["sounding"] == 0, asleep)
    mid = pg.evaluate("""() => {
      const bytes = __synth.gyrotronMidi({ device: 'gyrotron', seed: 1701, running: true }, 2);
      const f = __synth.smf.read(bytes);
      const notes = f.song.parts.reduce((n, p) => n + (p.notes || 0), 0);
      return { notes, parts: f.song.parts.length, bpm: f.song.bpm };
    }""")
    ck("Gy. export is a MIDI file of hits and crossings",
       mid["notes"] > 0 and mid["parts"] >= 2 and abs(mid["bpm"] - 120) < 0.2, mid)

    yerr = []
    pg.on("pageerror", lambda e: yerr.append(str(e)))
    pg.evaluate("__synth.setDevice('gyrotron')")
    pg.wait_for_timeout(250)
    ck("Gy. the orbit is on screen and the tube chassis is hidden",
       pg.evaluate("__synth.device()") == "gyrotron" and pg.is_visible("#gyCanvas") and pg.is_visible("#mGyField")
       and not pg.is_visible("#chassis") and not pg.is_visible("#mFilt"), yerr)
    pg.evaluate("""() => __synth.setPatch({
      device: 'gyrotron', seed: 1701, tool: 'well', wellCount: 2, bodyCount: 5, running: true, level: 0.8, route: 'self'
    })""")
    pg.wait_for_function("() => (__synth.gyrotronMeter().wells || 0) === 2", timeout=4000)
    box = pg.locator("#gyCanvas").bounding_box()
    pg.mouse.click(box["x"] + box["width"] * 0.12, box["y"] + box["height"] * 0.5)
    pg.wait_for_function("() => (__synth.gyrotronMeter().wells || 0) === 3", timeout=4000)
    ck("Gy. a tap places a well", pg.evaluate("() => __synth.gyrotronMeter().wells") == 3)
    pg.evaluate("""() => __synth.setPatch({
      device: 'gyrotron', seed: 1701, tool: 'fling', wellCount: 2, bodyCount: 5, running: false, level: 0.8, route: 'self'
    })""")
    pg.evaluate("__synth.panic()")
    pg.wait_for_function("() => (__synth.gyrotronMeter().voices || 0) === 0 && (__synth.gyrotronMeter().bodies || []).length > 0", timeout=4000)
    body = pg.evaluate("() => __synth.gyrotronMeter().bodies[0]")
    pg.mouse.move(box["x"] + box["width"] * body[1], box["y"] + box["height"] * body[2])
    pg.mouse.down()
    pg.mouse.move(box["x"] + box["width"] * body[1] + box["width"] * 0.22, box["y"] + box["height"] * body[2])
    pg.mouse.up()
    flung = pg.evaluate("() => document.getElementById('gyFling').textContent")
    parts = [float(v) for v in flung.split(",")] if flung and "," in flung else [0, 0]
    ck("Gy. a drag flings a body", len(parts) == 2 and (abs(parts[0]) > 0.05 or abs(parts[1]) > 0.05), flung)
    pg.evaluate("__synth.noteOn(64, 0.85)")
    pg.wait_for_function("() => (__synth.gyrotronMeter().voices || 0) > 0", timeout=4000)
    pg.evaluate("__synth.noteOff(64)")
    pg.wait_for_function("() => (__synth.gyrotronMeter().voices || 0) === 0", timeout=4000)
    ck("Gy. a key speaks and lets go", True)
    pg.evaluate("""() => __synth.setPatch({
      device: 'gyrotron', seed: 1701, running: false, route: 'filament', level: 0.7, bodyCount: 5, wellCount: 2
    })""")
    pg.wait_for_timeout(80)
    pg.evaluate("__synth.noteOn(60, 0.9)")
    pg.wait_for_function("() => ((__synth.engine().meters.filament || {}).voices || 0) > 0", timeout=4000)
    ck("Gy. an orbit note can play Filament", pg.evaluate("() => (__synth.engine().meters.filament || {}).voices") > 0)
    pg.evaluate("__synth.panic()")
    pg.wait_for_function("() => ((__synth.engine().meters.filament || {}).voices || 0) === 0", timeout=4000)
    ck("Gy. the routed note does not stick", pg.evaluate("() => (__synth.engine().meters.filament || {}).voices") == 0)
    pg.evaluate("""() => {
      const mix = __synth.mixer() || {};
      Object.keys(mix).forEach(id => __synth.setMixer(id, { mute: false, solo: false, level: mix[id].level, pan: mix[id].pan }));
      __synth.setMixer('gyrotron', { level: 1, pan: 0, mute: false, solo: false });
      __synth.setPatch({ device: 'gyrotron', seed: 1701, running: true, level: 0.85, route: 'self', bodyCount: 5, wellCount: 2 });
    }""")
    pg.wait_for_timeout(100)
    y_sr = int(pg.evaluate("() => __synth.engine().ctx.sampleRate"))
    pg.evaluate("() => __synth.recordStart()")
    pg.wait_for_timeout(800)
    yrec = pg.evaluate("() => __synth.recordStop()")
    yrec_raw = base64.b64decode(yrec["b64"]) if yrec and yrec.get("b64") else b""
    yrec_info = parse_wav(yrec_raw) if yrec_raw else None
    yrec_rms = hrms(pcm24(yrec_info["data"])[0]) if yrec_info and len(yrec_info["data"]) >= 6 else 0
    ck("Gy. the master recorder hears Gyrotron",
       yrec_info and yrec_info["bits"] == 24 and yrec_info["ch"] == 2 and yrec_info["rate"] == y_sr and yrec.get("sr") == y_sr
       and yrec_rms > 1e-3 and bool(_re2.fullmatch(r"Gyrotron-\d{8}-\d{6}\.wav", yrec.get("name") or "")),
       (yrec_rms, None if not yrec else yrec.get("sr"), None if not yrec else yrec.get("name")))
    ck("Gy. the page stayed quiet", not yerr, yerr)

    yp = b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    yperr = []
    yp.on("pageerror", lambda e: yperr.append(str(e)))
    yp.goto(BASE)
    yp.wait_for_function("window.__synth && __synth.ready()", timeout=20000)
    yp.evaluate("__synth.setDevice('gyrotron')")
    yp.wait_for_timeout(300)
    ck("Gy. 390px: no horizontal scroll, the orbit is up",
       yp.evaluate("document.documentElement.scrollWidth <= innerWidth && innerWidth === 390")
       and yp.is_visible("#gyCanvas") and not yp.is_visible("#mFilt") and not yp.is_visible("#chassis"),
       (yp.evaluate("[document.documentElement.scrollWidth, innerWidth]"), yperr))
    ysmall = yp.evaluate("""() => [...document.querySelectorAll('.devbtn, .tabs button, #gyRoot .chip, #gyRoot .btn, #gyRoot input, #gyRoot select')]
      .filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; })
      .map(e => (e.id || e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))""")
    ck("Gy. 390px: rail, tabs and orbit controls are 44 px or more", not ysmall, ysmall)
    yp.tap('.tabs [data-go="tone"]')
    yp.wait_for_timeout(200)
    ck("Gy. 390px: Tone shows the voice and hides the sky",
       yp.is_visible("#mGyTone") and yp.is_visible("#kGyTone") and yp.is_visible("#gyRoute")
       and not yp.is_visible("#gyCanvas")
       and yp.evaluate("document.documentElement.scrollWidth <= innerWidth && innerWidth === 390"))
    yp.screenshot(path=os.path.join(SHOTS, "synth_gyrotron_phone.png"))
    ck("Gy. 390px: no page errors", not yperr, yperr)
    yp.close()
    pg.evaluate("__synth.setDevice('filament')")
    pg.wait_for_timeout(120)
    ck("Fr. no page errors", not errs, errs)

    # ---------------------------------------------------------------- Kl. Klystron, the granular vocoder
    def kl_band(x, lo, hi):
        if len(x) < 32:
            return 0.0
        n = len(x)
        X = np.abs(np.fft.rfft(x * np.hanning(n))) ** 2
        f = np.fft.rfftfreq(n, 1.0 / SR)
        return float(np.sum(X[(f >= lo) & (f < hi)]))
    def kl_rms(x):
        if len(x) == 0:
            return 0.0
        return float(np.sqrt(np.mean(np.square(x))))
    def kl_render(patch, events=None, seconds=0.8, buffer=None):
        body = {"patch": patch, "events": events or [], "seconds": seconds}
        if buffer is not None:
            body["buffer"] = buffer
        return dec(pg.evaluate("a => __synth.klystronRender(a)", body))
    def klp(**over):
        p = {
            "device": "klystron", "level": 0.85, "source": "vowel",
            "carrier": {"wave": "saw", "tune": 0, "noise": 0, "attack": 0.004, "release": 0.03},
            "mouth": {"x": 0.34, "y": 0.9, "whisper": 0.04, "glottis": 120},
            "bank": {"q": 3.2, "attack": 0.004, "release": 0.02, "gate": 0.01},
            "grain": {"size": 80, "density": 4, "spray": 0, "mix": 0, "spread": 0, "freeze": False},
        }
        for k, v in over.items():
            if isinstance(v, dict) and isinstance(p.get(k), dict):
                p[k] = dict(p[k])
                p[k].update(v)
            else:
                p[k] = v
        return p
    devk = pg.evaluate("""() => { const d = __synth.klystronDevice(); return {
      id: d.id, api: d.api, inst: d.instrument, outs: d.audioOutputs, ins: d.audioInputs, midi: d.midiInput,
      proc: d.processor, worklet: d.worklet, ch: d.channels, name: d.name,
      src: d.parameters.source && d.parameters.source.choices, wave: d.parameters['carrier.wave'] && d.parameters['carrier.wave'].choices,
      freeze: d.parameters['grain.freeze'] && d.parameters['grain.freeze'].type }; }""")
    ck("Kl. Klystron publishes a stereo MIDI dxrack/1 vocoder",
       devk["id"] == "klystron" and devk["api"] == "dxrack/1" and devk["inst"] and devk["outs"] == 1 and devk["ins"] == 1 and devk["midi"]
       and devk["proc"] == "klystron" and devk["worklet"] == "klystron.worklet.js" and devk["ch"] == 2 and devk["name"] == "Klystron"
       and devk["freeze"] == "boolean"
       and all(s in (devk["src"] or []) for s in ("vowel", "file", "mic"))
       and all(w in (devk["wave"] or []) for w in ("saw", "pulse", "sine", "noise")), devk)
    norm = pg.evaluate("""() => __synth.klystronNormalize({ level: 9, source: 'laser', mouth: { x: 4, y: -2 }, grain: { freeze: 1, size: 9000 }, carrier: { wave: 'square' } })""")
    ck("Kl. normalize clamps the mouth, the level and the wave",
       norm["device"] == "klystron" and norm["level"] == 1 and norm["source"] == "vowel"
       and norm["mouth"]["x"] == 1 and norm["mouth"]["y"] == 0 and norm["grain"]["freeze"] is True
       and norm["grain"]["size"] == 500 and norm["carrier"]["wave"] == "saw", norm)
    fm = pg.evaluate("""() => ({ front: __synth.klystronFormants(0.94, 0.08), back: __synth.klystronFormants(0.08, 0.1) })""")
    ck("Kl. the front of the pad raises the second formant",
       fm["front"]["f2"] > fm["back"]["f2"] + 800 and fm["front"]["f1"] < fm["back"]["f1"], fm)
    held = [{"at": 0.02, "t": "on", "n": 69, "v": 0.9}, {"at": 0.7, "t": "off", "n": 69}]
    sineL, sineR = kl_render(klp(carrier={"wave": "sine", "noise": 0, "attack": 0.004, "release": 0.02}), held, 0.85)
    seg = sineL[int(0.22 * SR):int(0.62 * SR)]
    got = peak_freq(seg)
    cents = abs(1200 * math.log2(max(got, 1) / 440.0))
    ck(f"Kl. a sine carrier at A4 peaks at 440 Hz ({got:.2f} Hz, {cents:.1f} cents)",
       cents < 12 and np.max(np.abs(sineL)) < 1 and kl_rms(sineR[int(0.22 * SR):int(0.62 * SR)]) > 1e-3, (got, cents, kl_rms(seg)))
    lowL, _ = kl_render(klp(carrier={"wave": "sine", "noise": 0}), [{"at": 0.02, "t": "on", "n": 57, "v": 0.9}, {"at": 0.7, "t": "off", "n": 57}], 0.85)
    low = peak_freq(lowL[int(0.22 * SR):int(0.62 * SR)])
    ck(f"Kl. a sine carrier at A3 peaks at 220 Hz ({low:.2f} Hz)", abs(1200 * math.log2(max(low, 1) / 220.0)) < 12, low)
    quietL, quietR = kl_render(klp(level=0, carrier={"wave": "saw"}), held, 0.5)
    ck("Kl. level 0 is silent", kl_rms(quietL) < 1e-5 and kl_rms(quietR) < 1e-5, (kl_rms(quietL), kl_rms(quietR)))
    noneL, noneR = kl_render(klp(), [], 0.4)
    ck("Kl. no note is silent", kl_rms(noneL) < 1e-5 and kl_rms(noneR) < 1e-5, (kl_rms(noneL), kl_rms(noneR)))
    sawL, _ = kl_render(klp(carrier={"wave": "saw", "noise": 0.04}, grain={"mix": 0.22}), held, 0.7)
    ck("Kl. the default saw vowel is audible", kl_rms(sawL[int(0.15 * SR):int(0.55 * SR)]) > 1e-3, kl_rms(sawL))
    def vowel_hi(x, y):
        L, _ = kl_render(klp(carrier={"wave": "noise", "noise": 0}, mouth={"x": x, "y": y, "whisper": 0.02}), held, 0.7)
        return kl_band(L[int(0.18 * SR):int(0.55 * SR)], 1800, 3400)
    hi_i, hi_u = vowel_hi(0.94, 0.08), vowel_hi(0.08, 0.1)
    ck("Kl. a bright vowel puts more energy up high than a dark one", hi_i > hi_u * 2, (hi_i, hi_u))
    files = pg.evaluate("""async () => {
      function tone(freq) {
        const sr = 48000, n = sr;
        const L = new Float32Array(n);
        for (let i = 0; i < n; i++) L[i] = Math.sin(2 * Math.PI * freq * i / sr) * 0.8;
        return { L: Array.from(L), sr, name: String(freq) };
      }
      const patch = { device: 'klystron', source: 'file', level: 0.9,
        carrier: { wave: 'saw', tune: 0, noise: 0, attack: 0.004, release: 0.03 },
        mouth: { x: 0.5, y: 0.5, whisper: 0 }, bank: { q: 4, attack: 0.003, release: 0.02, gate: 0.005 },
        grain: { mix: 0, freeze: false, density: 1, size: 40 } };
      const ev = [{ at: 0.02, t: 'on', n: 48, v: 0.9 }, { at: 0.85, t: 'off', n: 48 }];
      const hi = await __synth.klystronRender({ patch, buffer: tone(2000), events: ev, seconds: 0.9 });
      const lo = await __synth.klystronRender({ patch, buffer: tone(280), events: ev, seconds: 0.9 });
      return { hi, lo };
    }""")
    hiL, _ = dec(files["hi"])
    loL, _ = dec(files["lo"])
    hiE = kl_band(hiL[int(0.2 * SR):int(0.75 * SR)], 1400, 3200)
    loE = kl_band(loL[int(0.2 * SR):int(0.75 * SR)], 1400, 3200)
    ck("Kl. a high file modulator opens the high bands", hiE > loE * 8 and hiE > 0, (hiE, loE))
    tail0 = int(0.95 * SR)
    dryL, _ = kl_render(klp(grain={"mix": 0, "freeze": False, "density": 2}, carrier={"release": 0.02}),
                        [{"at": 0.02, "t": "on", "n": 64, "v": 0.9}, {"at": 0.35, "t": "off", "n": 64}], 1.3)
    frostL, _ = kl_render(klp(grain={"mix": 0.9, "freeze": True, "density": 18, "size": 180, "spray": 0.1}, carrier={"release": 0.02}),
                          [{"at": 0.02, "t": "on", "n": 64, "v": 0.9}, {"at": 0.35, "t": "off", "n": 64}], 1.3)
    ck("Kl. freeze holds the cloud after the key is let go",
       kl_rms(frostL[tail0:]) > 1e-3 and kl_rms(frostL[tail0:]) > kl_rms(dryL[tail0:]) * 20,
       (kl_rms(frostL[tail0:]), kl_rms(dryL[tail0:])))
    panL, _ = kl_render(klp(carrier={"wave": "saw"}),
                        [{"at": 0.02, "t": "on", "n": 60, "v": 0.9}, {"at": 0.2, "t": "panic"}], 0.7)
    ck("Kl. panic silences the render", kl_rms(panL[int(0.4 * SR):]) < 1e-5, kl_rms(panL[int(0.4 * SR):]))
    pg.evaluate("__synth.setDevice('klystron')")
    pg.wait_for_timeout(300)
    ck("Kl. the rail lights Klystron and hides Filament's filter",
       pg.evaluate("__synth.device()") == "klystron" and pg.locator("#devK").get_attribute("aria-pressed") == "true"
       and pg.is_visible("#klPad") and pg.is_visible("#klMic") and pg.is_visible("#klFileBtn") and pg.locator("#klFile").count() == 1 and not pg.is_visible("#mFilt")
       and not pg.is_visible("#chassis"))
    pg.locator("#klPad").scroll_into_view_if_needed()
    box = pg.locator("#klPad").bounding_box()
    pg.mouse.move(box["x"] + 16, box["y"] + box["height"] * 0.5)
    pg.mouse.down()
    pg.mouse.move(box["x"] + box["width"] * 0.86, box["y"] + 18, steps=8)
    pg.mouse.up()
    pg.wait_for_timeout(60)
    dragged = pg.evaluate("__synth.patch().mouth")
    ck("Kl. dragging the pad moves the vowel", dragged["x"] > 0.7 and dragged["y"] > 0.7, dragged)
    pg.locator('#klVowels [data-vowel="i"]').click()
    pg.wait_for_timeout(40)
    vowel = pg.evaluate("""() => { const p = __synth.patch(); return { x: p.mouth.x, y: p.mouth.y, source: p.source }; }""")
    ck("Kl. a vowel chip sets the mouth", abs(vowel["x"] - 0.94) < 0.02 and abs(vowel["y"] - 0.08) < 0.02 and vowel["source"] == "vowel", vowel)
    tiny = pg.evaluate("""() => {
      const sr = 8000, n = 160;
      const data = n * 2;
      const buf = new ArrayBuffer(44 + data);
      const v = new DataView(buf);
      const s = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
      s(0, 'RIFF'); v.setUint32(4, 36 + data, true); s(8, 'WAVE'); s(12, 'fmt '); v.setUint32(16, 16, true);
      v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
      v.setUint16(32, 2, true); v.setUint16(34, 16, true); s(36, 'data'); v.setUint32(40, data, true);
      for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * 440 * i / sr) * 8000), true);
      let bin = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i++) bin += String.fromCharCode(u[i]);
      return btoa(bin);
    }""")
    pg.set_input_files("#klFile", files=[{"name": "buncher-ah.wav", "mimeType": "audio/wav", "buffer": base64.b64decode(tiny)}])
    pg.wait_for_timeout(500)
    named = pg.locator("#klName").inner_text()
    ck("Kl. a chosen file becomes the modulator", pg.evaluate("__synth.patch().source") == "file" and "buncher-ah" in (named or ""), named)
    pg.evaluate("""() => {
      window.__micAsked = 0;
      if (!navigator.mediaDevices) navigator.mediaDevices = {};
      navigator.mediaDevices.getUserMedia = () => { window.__micAsked++; return Promise.reject(new DOMException('denied', 'NotAllowedError')); };
    }""")
    pg.locator("#klMic").click()
    pg.wait_for_timeout(200)
    ck("Kl. Mic asks the browser and leaves the vowel if permission is refused",
       pg.evaluate("window.__micAsked") == 1 and pg.evaluate("__synth.patch().source") != "mic",
       (pg.evaluate("window.__micAsked"), pg.evaluate("__synth.patch().source")))
    pg.evaluate("""() => __synth.setPatch({ device: 'klystron', source: 'vowel', carrier: { wave: 'sine', noise: 0 }, grain: { mix: 0, freeze: false } })""")
    pg.wait_for_timeout(80)
    pg.evaluate("__synth.midi([144, 60, 110])")
    pg.wait_for_function("() => (__synth.klystronMeter().voices || 0) > 0", timeout=2500)
    pg.evaluate("__synth.midi([128, 60, 0])")
    pg.wait_for_function("() => (__synth.klystronMeter().voices || 0) === 0", timeout=2500)
    ck("Kl. a MIDI note speaks and lets go", True)
    pg.evaluate("__synth.noteOn(62, 0.8)")
    pg.wait_for_function("() => (__synth.klystronMeter().voices || 0) > 0", timeout=2500)
    pg.evaluate("__synth.panic()")
    pg.wait_for_function("() => (__synth.klystronMeter().voices || 0) === 0 && !(__synth.klystronMeter().playing)", timeout=2500)
    ck("Kl. Panic clears the voices", (pg.evaluate("__synth.klystronMeter().voices") or 0) == 0)
    trip = pg.evaluate("""() => {
      const raw = __synth.project();
      raw.name = 'Mouth';
      raw.device = 'klystron';
      raw.devices.klystron = { patch: { device: 'klystron', name: 'Round', level: 0.4, source: 'vowel', mouth: { x: 0.2, y: 0.3 } } };
      __synth.applyProject(raw);
      const back = __synth.project();
      return { dev: __synth.device(), x: back.devices.klystron.patch.mouth.x, y: back.devices.klystron.patch.mouth.y, level: back.devices.klystron.patch.level, name: back.name };
    }""")
    ck("Kl. a project round-trips the mouth",
       trip["dev"] == "klystron" and abs(trip["x"] - 0.2) < 1e-6 and abs(trip["y"] - 0.3) < 1e-6 and abs(trip["level"] - 0.4) < 1e-6 and trip["name"] == "Mouth", trip)
    # ---------------------------------------------------------------- Ph. Phantastron, the circuit-bent toy
    def ph_render(patch, seconds=1.0, events=None):
        body = {"patch": patch, "seconds": seconds}
        if events is not None:
            body["events"] = events
        return dec(pg.evaluate("a => __synth.phantastronRender(a)", body))
    def ph_rms(x):
        if len(x) == 0: return 0.0
        return float(np.sqrt(np.mean(np.square(x))))
    devp = pg.evaluate("""() => { const d = __synth.phantastronDevice(); return {
      id: d.id, api: d.api, inst: d.instrument, outs: d.audioOutputs, midi: d.midiInput, proc: d.processor,
      worklet: d.worklet, ch: d.channels, name: d.name,
      bits: d.parameters.bits && d.parameters.bits.type,
      cart: d.parameters.cart && d.parameters.cart.choices,
      run: d.parameters.run && d.parameters.run.type }; }""")
    ck("Ph. Phantastron publishes a stereo MIDI dxrack/1 device",
       devp["id"] == "phantastron" and devp["api"] == "dxrack/1" and devp["inst"] and devp["outs"] == 1 and devp["midi"]
       and devp["proc"] == "phantastron" and devp["worklet"] == "phantastron.worklet.js" and devp["ch"] == 2
       and devp["name"] == "Phantastron" and devp["bits"] == "int" and devp["run"] == "boolean"
       and all(c in (devp["cart"] or []) for c in ("lull", "count", "chirp", "bark", "tone", "babble")), devp)
    norm = pg.evaluate("""() => __synth.setPatch({
      device: 'phantastron', bits: 99, clock: 9, cart: 'nope',
      wires: [['bogus', 'rate'], ['vcc', 'bits'], ['gnd', 'bits'], ['clk', 'rate']]
    })""")
    ck("Ph. normalize clamps the knobs and keeps one wire per bend",
       norm["bits"] == 12 and abs(norm["clock"] - 4) < 1e-9 and norm["cart"] == "lull"
       and norm["wires"] == [["vcc", "bits"], ["clk", "rate"]], norm)
    bends = pg.evaluate("""() => ({
      bare: __synth.phantastronBend({ clock: 1, bits: 8, wires: [] }),
      vcc: __synth.phantastronBend({ clock: 1, wires: [['vcc', 'rate']] }),
      gnd: __synth.phantastronBend({ clock: 1, wires: [['gnd', 'rate']] }),
      bits: __synth.phantastronBend({ bits: 12, wires: [['vcc', 'bits']] }),
      loop: __synth.phantastronBend({ wires: [['gnd', 'loop']] }),
      fb: __synth.phantastronBend({ wires: [['vcc', 'fb']] }),
      clk1: __synth.phantastronBend({ clock: 1, wires: [['clk', 'rate']] }, { clk: 1 }),
      clk0: __synth.phantastronBend({ clock: 1, wires: [['clk', 'rate']] }, { clk: 0 }),
    })""")
    ck("Ph. a wire pulls the clock, the bits, the loop and the feedback",
       abs(bends["bare"]["clock"] - 1) < 1e-9 and bends["bare"]["bits"] == 8
       and abs(bends["vcc"]["clock"] - 3.2) < 1e-6 and abs(bends["gnd"]["clock"] - 0.22) < 1e-6
       and bends["bits"]["bits"] == 6 and bends["loop"]["loop"] == 1
       and abs(bends["fb"]["feedback"] - 0.88) < 1e-6
       and abs(bends["clk1"]["clock"] - 2.75) < 1e-6 and abs(bends["clk0"]["clock"] - 0.35) < 1e-6, bends)
    phrases = pg.evaluate("""() => ({
      a: __synth.phantastronPhrase({ cart: 'babble', seed: 17 }),
      b: __synth.phantastronPhrase({ cart: 'babble', seed: 17 }),
      c: __synth.phantastronPhrase({ cart: 'babble', seed: 99 }),
    })""")
    ck("Ph. a babble phrase is the same seed twice and a different seed apart",
       phrases["a"] == phrases["b"] and phrases["a"] != phrases["c"] and 6 <= len(phrases["a"]) <= 11, phrases)
    walked = pg.evaluate("""() => ({
      full: __synth.phantastronWalk({ cart: 'lull', loop: 0, wires: [] }, 24),
      stuck: __synth.phantastronWalk({ cart: 'count', wires: [['gnd', 'loop']] }, 8),
    })""")
    ck("Ph. an open loop walks the phrase and a ground wire sticks one frame",
       walked["full"]["win"] == len(walked["full"]["phrase"]) and walked["full"]["frames"][:len(walked["full"]["phrase"])] == walked["full"]["phrase"]
       and walked["stuck"]["win"] == 1 and len(set(walked["stuck"]["frames"])) == 1, walked)
    crushed = pg.evaluate("""() => {
      const xs = [];
      for (let i = 0; i < 64; i++) xs.push(__synth.phantastronCrush(Math.sin(i), 2));
      return [...new Set(xs.map(v => Math.round(v * 1000) / 1000))].sort((a, b) => a - b);
    }""")
    ck("Ph. two bits land on five signed steps", crushed == [-1, -0.5, 0, 0.5, 1], crushed)
    tone_on = [{"t": "on", "n": 69, "v": 0.9, "at": 0.02}]
    tone_body = {"device": "phantastron", "cart": "tone", "clock": 1, "bits": 12, "feedback": 0, "noise": 0, "level": 1, "run": False, "wires": [], "pitch": 0}
    tL, tR = ph_render(tone_body, 1.0, tone_on)
    sl = tL[int(0.25 * SR):int(0.75 * SR)]
    f_tone = peak_freq(sl)
    ck(f"Ph. the tone cart at clock 1 peaks at A4 ({f_tone:.1f} Hz)",
       abs(f_tone - 440) < 8 and ph_rms(tL) > 1e-3 and ph_rms(tR) > 1e-3, (round(f_tone, 2), round(ph_rms(tL), 4), round(ph_rms(tR), 4)))
    cL, cR = ph_render(dict(tone_body, clock=2), 1.0, tone_on)
    f_clock = peak_freq(cL[int(0.25 * SR):int(0.75 * SR)])
    ck(f"Ph. clock 2 doubles the tone ({f_clock:.1f} Hz)", abs(f_clock - 880) < 12, round(f_clock, 2))
    zL, zR = ph_render(dict(tone_body, level=0), 0.6, tone_on)
    ck("Ph. level 0 is silence", ph_rms(zL) < 1e-5 and ph_rms(zR) < 1e-5, (ph_rms(zL), ph_rms(zR)))
    howl_on = [{"t": "on", "n": 60, "v": 0.9, "at": 0.02}]
    cleanL, _cleanR = ph_render({"device": "phantastron", "cart": "chirp", "feedback": 0, "noise": 0.2, "level": 1, "bits": 8, "wires": []}, 0.8, howl_on)
    howlL, _howlR = ph_render({"device": "phantastron", "cart": "chirp", "feedback": 0.85, "noise": 0.2, "level": 1, "bits": 8, "wires": []}, 0.8, howl_on)
    n = min(len(cleanL), len(howlL))
    diff = ph_rms(cleanL[:n] - howlL[:n])
    ck("Ph. feedback changes the voice",
       ph_rms(cleanL) > 1e-3 and ph_rms(howlL) > 1e-3 and diff > 0.02, (round(ph_rms(cleanL), 4), round(ph_rms(howlL), 4), round(diff, 4)))
    pL, _pR = ph_render(tone_body, 1.0, [{"t": "on", "n": 69, "v": 0.9, "at": 0.02}, {"t": "panic", "at": 0.4}])
    early = ph_rms(pL[int(0.12 * SR):int(0.32 * SR)])
    late = ph_rms(pL[int(0.7 * SR):])
    ck("Ph. panic leaves the tail silent", early > 1e-3 and late < 1e-4, (round(early, 4), round(late, 6)))
    pg.evaluate("__synth.setDevice('phantastron')")
    pg.wait_for_timeout(250)
    # Review 22 Oct (R1022-1): a wire into BITS took Market Bits and Solder Bridge to one bit,
    # and the toy DAC rounds a speaking voice to zero there. Every factory patch must speak.
    ph_fac = {}
    for nm in [f["name"] for f in pg.evaluate("__synth.phantastronFactory()")]:
        pg.evaluate("n => __synth.load(n)", nm)
        pg.wait_for_timeout(30)
        fL, _fR = ph_render(pg.evaluate("__synth.patch()"), 1.2, [{"t": "on", "n": 60, "v": 0.9, "at": 0.02}, {"t": "off", "n": 60, "at": 1.0}])
        ph_fac[nm] = round(ph_rms(fL), 5)
    ck("Ph. every factory patch speaks when a key is held", len(ph_fac) >= 6 and min(ph_fac.values()) > 1e-3, ph_fac)
    # Review 25 Oct (R1025-1): a patch with a shorter phrase picked while a voice still sounds
    # left that voice's frame index past the end, process() threw, and the toy stayed silent
    # until a reload. Hold a key on Nursery Clock, switch to Slow Drag, and keep listening.
    pg.evaluate("__synth.load('Nursery Clock')")
    ph_nc = pg.evaluate("__synth.patch()")
    pg.evaluate("__synth.load('Slow Drag')")
    ph_sd = pg.evaluate("__synth.patch()")
    ph_sw = {}
    for at in (0.3, 0.5, 0.9):
        sL, _sR = ph_render(ph_nc, at + 0.7, [{"t": "on", "n": 60, "v": 0.9, "at": 0.02}, {"t": "patch", "p": ph_sd, "at": at}])
        ph_sw[at] = round(ph_rms(sL[int((at + 0.2) * SR):int((at + 0.6) * SR)]), 5)
    ck("Ph. switching to a shorter phrase under a held key keeps the toy speaking",
       min(ph_sw.values()) > 1e-3, ph_sw)
    wired_bits = pg.evaluate("""() => [5, 2].map(b => __synth.phantastronBend({ bits: b, wires: [['vcc', 'bits']] }).bits)""")
    ck("Ph. a wire into BITS stops at three bits and never adds any", wired_bits == [3, 2], wired_bits)
    pg.evaluate("""() => __synth.setPatch({ device: 'phantastron', cart: 'lull', wires: [], run: false })""")
    pg.wait_for_timeout(80)
    ck("Ph. the board is up and the tube filter is not",
       pg.evaluate("__synth.device()") == "phantastron" and pg.is_visible("#phBoard") and pg.is_visible("#phCarts")
       and not pg.is_visible("#mFilt") and not pg.is_visible("#chassis")
       and pg.evaluate("__synth.patch().wires") == [])
    pg.locator("#phBoard").scroll_into_view_if_needed()
    box = pg.locator("#phBoard").bounding_box()
    def pad_at(pid):
        pad = next(p for p in pg.evaluate("__synth.phantastronPads()") if p["id"] == pid)
        return box["x"] + pad["x"] * box["width"], box["y"] + pad["y"] * box["height"]
    x1, y1 = pad_at("vcc")
    x2, y2 = pad_at("rate")
    pg.mouse.move(x1, y1)
    pg.mouse.down()
    pg.mouse.move(x2, y2, steps=8)
    pg.mouse.up()
    pg.wait_for_timeout(80)
    wired = pg.evaluate("__synth.patch().wires")
    ck("Ph. dragging VCC to RATE lays that wire", wired == [["vcc", "rate"]], wired)
    pg.mouse.move(x1, y1)
    pg.mouse.down()
    pg.mouse.move(x2, y2, steps=8)
    pg.mouse.up()
    pg.wait_for_timeout(80)
    ck("Ph. the same drag lifts the wire", pg.evaluate("__synth.patch().wires") == [], pg.evaluate("__synth.patch().wires"))
    pg.mouse.move(x1, y1)
    pg.mouse.down()
    pg.mouse.move(x2, y2, steps=8)
    pg.mouse.up()
    pg.wait_for_timeout(40)
    pg.click("#phLift")
    pg.wait_for_timeout(40)
    ck("Ph. lift wires clears the board", pg.evaluate("__synth.patch().wires") == [])
    pg.evaluate("__synth.panic()")
    pg.evaluate("""() => __synth.setPatch({ device: 'phantastron', cart: 'tone', clock: 1, bits: 12, feedback: 0, noise: 0, level: 0.8, run: false, wires: [] })""")
    pg.wait_for_timeout(80)
    pg.evaluate("__synth.noteOn(60, 0.85)")
    pg.wait_for_function("() => (__synth.phantastronMeter().voices || 0) > 0", timeout=3000)
    pg.evaluate("__synth.noteOff(60)")
    pg.wait_for_function("() => (__synth.phantastronMeter().voices || 0) === 0", timeout=4000)
    ck("Ph. a key opens a voice and note-off lets it go", True)
    pg.evaluate("__synth.noteOn(64, 0.85)")
    pg.wait_for_function("() => (__synth.phantastronMeter().voices || 0) > 0", timeout=2000)
    pg.evaluate("__synth.panic()")
    pg.wait_for_function("() => (__synth.phantastronMeter().voices || 0) === 0", timeout=2000)
    ck("Ph. Panic clears the voices", True)
    pg.evaluate("""() => __synth.engine().devices.phantastron.midi([0x90, 67, 100])""")
    pg.wait_for_function("() => (__synth.phantastronMeter().voices || 0) > 0", timeout=2000)
    pg.evaluate("""() => __synth.engine().devices.phantastron.midi([0xB0, 123, 0])""")
    pg.wait_for_function("() => (__synth.phantastronMeter().voices || 0) === 0", timeout=2000)
    ck("Ph. MIDI note-on and all-notes-off reach the toy", True)
    pg.evaluate("""() => {
      const mix = __synth.mixer();
      Object.keys(mix).forEach(id => __synth.setMixer(id, { mute: false, solo: false, level: mix[id].level, pan: mix[id].pan }));
      __synth.setMixer('phantastron', { level: 1, pan: 0, mute: false, solo: false });
    }""")
    pg.evaluate("""() => __synth.setPatch({ device: 'phantastron', cart: 'tone', clock: 1, bits: 12, feedback: 0, noise: 0, level: 1, run: false, wires: [] })""")
    pg.evaluate("__synth.noteOn(69, 0.9)")
    pg.evaluate("() => __synth.recordStart()")
    pg.wait_for_timeout(700)
    pg.evaluate("__synth.noteOff(69)")
    recp = pg.evaluate("() => __synth.recordStop()")
    recp_raw = base64.b64decode(recp["b64"]) if recp and recp.get("b64") else b""
    recp_info = parse_wav(recp_raw) if recp_raw else None
    recp_rms = rms(pcm24(recp_info["data"])[0]) if recp_info and len(recp_info["data"]) >= 6 else 0
    ck("Ph. the master recorder names a non-silent Phantastron WAV",
       recp_info and recp_info["fmt"] == 1 and recp_info["bits"] == 24 and recp_info["ch"] == 2
       and recp_info["rate"] == int(pg.evaluate("() => __synth.engine().ctx.sampleRate"))
       and recp_rms > 1e-3 and bool(_re2.fullmatch(r"Phantastron-\d{8}-\d{6}\.wav", recp.get("name") or "")),
       (None if not recp else recp.get("name"), round(recp_rms, 4)))
    # ---------------------------------------------------------------- Rh. Rhumbatron, the physical model
    def rh_render(patch, events, seconds=0.8):
        return dec(pg.evaluate("a => __synth.rhumbatronRender(a)", {"patch": patch, "events": events, "seconds": seconds}))
    def rh_rms(x):
        return float(np.sqrt(np.mean(np.square(x)))) if len(x) else 0.0
    devr = pg.evaluate("""() => { const d = __synth.rhumbatronDevice(); return {
      id: d.id, api: d.api, inst: d.instrument, outs: d.audioOutputs, midi: d.midiInput, proc: d.processor,
      worklet: d.worklet, ch: d.channels, over: d.oversample, name: d.name,
      body: d.parameters.body && d.parameters.body.choices,
      exciter: d.parameters.exciter && d.parameters.exciter.choices,
      pos: d.parameters.position && d.parameters.position.type,
      listed: __synth.devices().some(x => x.id === 'rhumbatron') }; }""")
    ck("Rh. Rhumbatron publishes a stereo MIDI dxrack/1 device",
       devr["id"] == "rhumbatron" and devr["name"] == "Rhumbatron" and devr["api"] == "dxrack/1" and devr["inst"]
       and devr["outs"] == 1 and devr["midi"] and devr["proc"] == "rhumbatron" and devr["worklet"] == "rhumbatron.worklet.js"
       and devr["ch"] == 2 and devr["over"] == 1 and devr["listed"] and devr["pos"] == "float"
       and all(b in (devr["body"] or []) for b in ("string", "tube", "membrane"))
       and all(x in (devr["exciter"] or []) for x in ("pluck", "strike", "bow", "blow")), devr)
    wire = {"device": "rhumbatron", "level": 0.85, "body": "string", "exciter": "pluck", "material": 0.9,
            "size": 1, "damping": 0.15, "position": 0.18, "place": 0.5, "coupling": 0, "pressure": 0.05}
    held = [{"at": 0, "t": "on", "n": 69, "v": 0.85}]
    wL, wR = rh_render(wire, held, 1.0)
    wseg = wL[int(0.12 * SR):int(0.55 * SR)]
    wf = peak_freq(wseg)
    ck(f"Rh. a plucked string at A4 peaks at {wf:.2f} Hz",
       abs(wf - 440) < 8 and rh_rms(wseg) > 0.01 and np.isfinite(wL).all() and np.isfinite(wR).all() and rh_rms(wR[int(0.12 * SR):int(0.55 * SR)]) > 0.005,
       (wf, rh_rms(wseg)))
    sL, _sR = rh_render(dict(wire, size=2), held, 1.0)
    sf = peak_freq(sL[int(0.15 * SR):int(0.6 * SR)])
    ck(f"Rh. size 2 drops the string an octave ({sf:.2f} Hz)", abs(sf - 220) < 8, sf)
    cL, _ = rh_render(dict(wire, position=0.5, material=0.95), held, 0.8)
    bL, _ = rh_render(dict(wire, position=0.12, material=0.95), held, 0.8)
    cs, bs = cL[int(0.08 * SR):int(0.5 * SR)], bL[int(0.08 * SR):int(0.5 * SR)]
    cH = db(tone_amp(cs, 880) / tone_amp(cs, 440))
    bH = db(tone_amp(bs, 880) / tone_amp(bs, 440))
    ck(f"Rh. a center pluck hides the octave ({cH:.0f} dB) and a bridge pluck brings it back ({bH:.0f} dB)",
       cH < bH - 12 and bH > -20, (cH, bH))
    tL, _ = rh_render(dict(wire, body="tube", position=0.22), held, 0.8)
    ts = tL[int(0.08 * SR):int(0.5 * SR)]
    tH = db(tone_amp(ts, 880) / tone_amp(ts, 440))
    tf = peak_freq(ts)
    ck(f"Rh. a bore keeps the odd partials ({tf:.1f} Hz, H2 {tH:.0f} dB)",
       abs(tf - 440) < 8 and tH < -40 and tH < cH - 20, (tf, tH))
    mL, _ = rh_render(dict(wire, body="membrane", exciter="strike", position=0.5, place=0.5, material=0.7, damping=0.2), held, 0.7)
    ms = mL[int(0.05 * SR):int(0.4 * SR)]
    mf = peak_freq(ms)
    mOct = db(tone_amp(ms, 880) / tone_amp(ms, 440))
    ratio = pg.evaluate("__synth.rhumbatronRatio(2, 1)")
    oL, _ = rh_render(dict(wire, body="membrane", exciter="strike", position=0.28, place=0.22, material=0.7, damping=0.15), held, 0.7)
    off_seg = oL[int(0.05 * SR):int(0.4 * SR)]
    a_off = tone_amp(off_seg, ratio * 440)
    a_mid = tone_amp(ms, ratio * 440)
    ck(f"Rh. a plate struck in the middle speaks the fundamental ({mf:.1f} Hz, octave {mOct:.0f} dB)",
       abs(mf - 440) < 12 and mOct < -30 and a_off > a_mid * 4, (mf, mOct, a_off, a_mid, ratio))
    lowL, _ = rh_render(dict(wire, damping=0.02), held, 1.0)
    highL, _ = rh_render(dict(wire, damping=0.95), held, 1.0)
    low_late = rh_rms(lowL[int(0.62 * SR):int(0.9 * SR)])
    high_late = rh_rms(highL[int(0.62 * SR):int(0.9 * SR)])
    ck(f"Rh. damping lets the string go ({low_late:.4f} against {high_late:.6f})",
       low_late > 0.01 and high_late < 1e-4 and low_late > high_late * 20, (low_late, high_late))
    dryL, _ = rh_render(dict(wire, coupling=0, damping=0.2), held, 0.8)
    wetL, _ = rh_render(dict(wire, coupling=1, damping=0.2, material=0.85), held, 0.8)
    dry_s, wet_s = dryL[int(0.05 * SR):int(0.55 * SR)], wetL[int(0.05 * SR):int(0.55 * SR)]
    dry160, wet160 = tone_amp(dry_s, 160), tone_amp(wet_s, 160)
    dryf = peak_freq(dry_s)
    ck(f"Rh. coupling wakes the cavity at 160 Hz and the string is still there",
       abs(dryf - 440) < 8 and wet160 > dry160 * 4 and wet160 > 0.02 and tone_amp(wet_s, 440) > 0.02,
       (dryf, dry160, wet160, tone_amp(wet_s, 440)))
    bowL, _ = rh_render(dict(wire, exciter="bow", damping=0.2, pressure=0.45, material=0.6, position=0.2), held, 1.2)
    pluckL, _ = rh_render(dict(wire, exciter="pluck", damping=0.25), held, 1.2)
    bow_ratio = rh_rms(bowL[int(0.7 * SR):int(1.05 * SR)]) / max(1e-9, rh_rms(bowL[int(0.05 * SR):int(0.2 * SR)]))
    pluck_ratio = rh_rms(pluckL[int(0.7 * SR):int(1.05 * SR)]) / max(1e-9, rh_rms(pluckL[int(0.05 * SR):int(0.2 * SR)]))
    ck(f"Rh. a bow holds ({bow_ratio:.2f}) and a pluck dies away ({pluck_ratio:.2f})",
       bow_ratio > 0.65 and pluck_ratio < 0.5, (bow_ratio, pluck_ratio))
    relL, _ = rh_render(wire, [{"at": 0, "t": "on", "n": 69, "v": 0.9}, {"at": 0.12, "t": "off", "n": 69}], 0.8)
    ck("Rh. letting go of a key leaves the string quiet",
       rh_rms(relL[int(0.02 * SR):int(0.1 * SR)]) > 0.02 and rh_rms(relL[int(0.45 * SR):]) < 1e-3,
       (rh_rms(relL[int(0.02 * SR):int(0.1 * SR)]), rh_rms(relL[int(0.45 * SR):])))
    panL, _ = rh_render(wire, [{"at": 0, "t": "on", "n": 60, "v": 0.9}, {"at": 0.05, "t": "panic"}], 0.4)
    ck("Rh. panic in the render silences the cavity", rh_rms(panL[int(0.16 * SR):]) < 1e-4, rh_rms(panL[int(0.16 * SR):]))
    bendL, _ = rh_render(wire, [{"at": 0, "t": "bend", "v": 1}, {"at": 0, "t": "on", "n": 69, "v": 0.85}], 0.7)
    bf = peak_freq(bendL[int(0.2 * SR):int(0.55 * SR)])
    ck(f"Rh. the pitch wheel lifts A4 by two semitones ({bf:.2f} Hz)", abs(bf - 440 * 2 ** (2 / 12)) < 10, bf)
    susL, _ = rh_render(dict(wire, damping=0.2), [
        {"at": 0, "t": "on", "n": 69, "v": 0.85},
        {"at": 0.02, "t": "sus", "on": True},
        {"at": 0.08, "t": "off", "n": 69},
    ], 0.55)
    freeL, _ = rh_render(dict(wire, damping=0.2), [
        {"at": 0, "t": "on", "n": 69, "v": 0.85},
        {"at": 0.08, "t": "off", "n": 69},
    ], 0.55)
    sus_e, free_e = rh_rms(susL[int(0.25 * SR):int(0.45 * SR)]), rh_rms(freeL[int(0.25 * SR):int(0.45 * SR)])
    ck(f"Rh. the sustain pedal holds a released note ({sus_e:.4f} against {free_e:.6f})",
       sus_e > 0.01 and sus_e > free_e * 8, (sus_e, free_e))
    names = pg.evaluate("__synth.rhumbatronFactory()")
    quiet_factory = []
    for row in names:
        body = pg.evaluate("(n) => __synth.rhumbatronPatch(n)", row["name"])
        fl, _fr = rh_render(body, [{"at": 0, "t": "on", "n": 69, "v": 0.8}], 0.45)
        level = rh_rms(fl[int(0.04 * SR):])
        if level < 1e-3: quiet_factory.append((row["name"], level))
    ck("Rh. every factory patch speaks", not quiet_factory, quiet_factory)
    pg.evaluate("__synth.panic()")
    pg.evaluate("__synth.setDevice('rhumbatron')")
    pg.wait_for_timeout(250)
    help_r = pg.evaluate("""() => [...document.querySelectorAll('#rhumNote, .intro[data-dev="rhumbatron"]')].map(n => n.textContent).join(' ')""")
    ck("Rh. the cavity is on screen, and Filament's filter is not",
       pg.evaluate("__synth.device()") == "rhumbatron" and pg.is_visible("#rhumCanvas") and pg.is_visible("#rhumBodies")
       and not pg.is_visible("#mFilt") and not pg.is_visible("#chassis")
       and "Drag" in help_r and "rec" in help_r, help_r[:180])
    box = pg.locator("#rhumCanvas").bounding_box()
    pg.mouse.move(box["x"] + box["width"] * 0.2, box["y"] + box["height"] * 0.55)
    pg.mouse.down()
    pg.mouse.move(box["x"] + box["width"] * 0.84, box["y"] + box["height"] * 0.4, steps=10)
    pg.mouse.up()
    pg.wait_for_timeout(80)
    dragged = pg.evaluate("__synth.patch().position")
    ck(f"Rh. dragging the string moves the strike point ({dragged:.2f})", dragged > 0.7, dragged)
    pg.evaluate("__synth.noteOn(60, 0.9)")
    pg.wait_for_function("() => (__synth.rhumbatronMeter().voices || 0) > 0", timeout=2000)
    pg.evaluate("__synth.noteOn(64, 0.8)")
    pg.wait_for_function("() => (__synth.rhumbatronMeter().voices || 0) >= 2", timeout=2000)
    pg.evaluate("__synth.noteOff(60)")
    pg.wait_for_function("() => (__synth.rhumbatronMeter().voices || 0) === 1", timeout=2000)
    left = pg.evaluate("__synth.rhumbatronMeter()")
    pg.evaluate("__synth.noteOff(64)")
    pg.wait_for_function("() => (__synth.rhumbatronMeter().voices || 0) === 0", timeout=2000)
    ck("Rh. two keys, then one, then none", (left.get("voices") or 0) == 1, left)
    pg.evaluate("__synth.noteOn(67, 0.85)")
    pg.wait_for_function("() => (__synth.rhumbatronMeter().voices || 0) > 0", timeout=2000)
    pg.evaluate("__synth.panic()")
    pg.wait_for_function("() => (__synth.rhumbatronMeter().voices || 0) === 0", timeout=2000)
    ck("Rh. Panic clears the voices", (pg.evaluate("__synth.rhumbatronMeter()").get("voices") or 0) == 0)
    ph = b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    perr = []
    ph.on("pageerror", lambda e: perr.append(str(e)))
    ph.goto(BASE)
    ph.wait_for_function("window.__synth && __synth.ready()", timeout=20000)
    ph.evaluate("__synth.setDevice('klystron')")
    ph.wait_for_timeout(250)
    ck("Kl. 390px: no horizontal scroll, the pad is up",
       ph.evaluate("document.documentElement.scrollWidth <= innerWidth && innerWidth === 390")
       and ph.is_visible("#klPad") and not ph.is_visible("#mFilt") and not ph.is_visible("#chassis"),
       (ph.evaluate("[document.documentElement.scrollWidth, innerWidth]"), perr))
    small = ph.evaluate("""() => [...document.querySelectorAll('.devbtn, .tabs button, #klRoot .chip, #klRoot .btn, #klRoot .knob')]
      .filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; })
      .map(e => (e.id || e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))""")
    ck("Kl. 390px: rail, tabs and mouth controls are 44 px or more", not small, small)
    ph.tap('.tabs [data-go="mouth"]')
    ph.wait_for_timeout(200)
    mouth_small = ph.evaluate("""() => [...document.querySelectorAll('#klRoot .chip, #klRoot .btn, #klRoot .knob')]
      .filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; })
      .map(e => (e.id || e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))""")
    ck("Kl. 390px: the Mouth tab fits and its controls are 44 px or more",
       not mouth_small and ph.is_visible("#klFreeze") and not ph.is_visible("#klPad")
       and ph.evaluate("document.documentElement.scrollWidth <= innerWidth && innerWidth === 390"),
       (mouth_small, ph.evaluate("[document.documentElement.scrollWidth, innerWidth]")))
    ck("Kl. 390px: no page errors", not perr, perr)
    ph.close()
    pg.evaluate("__synth.setDevice('filament')")
    pg.wait_for_timeout(120)
    ck("Kl. no page errors", not errs, errs)
    ph = b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    perr = []
    ph.on("pageerror", lambda e: perr.append(str(e)))
    ph.goto(BASE)
    ph.wait_for_function("window.__synth && __synth.ready()", timeout=20000)
    ph.evaluate("__synth.setDevice('phantastron')")
    ph.wait_for_timeout(250)
    ck("Ph. 390px: no horizontal scroll, the board is up",
       ph.evaluate("document.documentElement.scrollWidth <= innerWidth && innerWidth === 390")
       and ph.is_visible("#phBoard") and not ph.is_visible("#mFilt"),
       (ph.evaluate("[document.documentElement.scrollWidth, innerWidth]"), perr))
    small = ph.evaluate("""() => [...document.querySelectorAll('.devbtn, .tabs button, #phRoot .chip, #phRoot input')]
      .filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; })
      .map(e => (e.id || e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))""")
    ck("Ph. 390px: rail, tabs and board controls are 44 px or more", not small, small)
    ph.tap('.tabs [data-go="bend"]')
    ph.wait_for_timeout(200)
    bend_small = ph.evaluate("""() => [...document.querySelectorAll('#phRoot .chip, #phRoot input')]
      .filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; })
      .map(e => (e.id || e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))""")
    ck("Ph. 390px: the Bends tab fits and its controls are 44 px or more",
       not bend_small and ph.is_visible("#phClock") and not ph.is_visible("#phBoard")
       and ph.evaluate("document.documentElement.scrollWidth <= innerWidth && innerWidth === 390"),
       (bend_small, ph.evaluate("[document.documentElement.scrollWidth, innerWidth]")))
    ph.screenshot(path=os.path.join(SHOTS, "synth_phantastron_phone.png"))
    ck("Ph. 390px: no page errors", not perr, perr)
    ph.close()
    pg.evaluate("__synth.setDevice('filament')")
    pg.wait_for_timeout(120)
    ck("Ph. no page errors", not errs, errs)
    # ---------------------------------------------------------------- Ad. Additron, the additive organ
    ad_before = len(errs)
    def ad_render(patch, events=None, seconds=0.5):
        payload = {"patch": patch, "events": events if events is not None else [{"t": "on", "n": 69, "v": 0.95, "at": 0}], "seconds": seconds}
        return dec(pg.evaluate("a => __synth.additronRender(a)", payload))
    def ad_rms(x):
        return float(np.sqrt(np.mean(np.square(x)))) if len(x) else 0.0
    z16 = [0.0] * 16
    def draw_at(*pairs):
        d = z16[:]
        for i, v in pairs:
            d[i] = v
        return d
    clean = dict(device="additron", shape="hand", morph=0, edit="a",
        rotor=False, click=0, perc=0, percHarm="off", tilt=0, vib=0, drive=0, leak=0, spread=0,
        attack=0.004, decay=0.3, sustain=1, release=0.05, level=0.9)
    devp = pg.evaluate("""() => { const d = __synth.additronDevice(); return {
      id: d.id, api: d.api, inst: d.instrument, outs: d.audioOutputs, midi: d.midiInput,
      proc: d.processor, worklet: d.worklet, ch: d.channels, over: d.oversample,
      msgs: d.messages, name: d.name }; }""")
    ck("Ad. the device publishes the dxrack/1 contract",
       devp["id"] == "additron" and devp["name"] == "Additron" and devp["api"] == "dxrack/1"
       and devp["inst"] and devp["outs"] == 1 and devp["midi"] and devp["proc"] == "additron"
       and devp["worklet"] == "additron.worklet.js" and devp["ch"] == 2 and devp["over"] == 1
       and {"patch", "on", "off", "bend", "mw", "sus", "panic", "active"} <= set(devp["msgs"]), devp)
    names = pg.evaluate("__synth.additronFactory()")
    ck("Ad. factory presets cover stops, a drawn reed and a morph",
       len(names) >= 4 and any(n["name"] == "Copper Flute" for n in names) and any(n["cat"] == "Morph" for n in names)
       and any(n["cat"] == "Draw" for n in names), names)
    spec = pg.evaluate("""() => __synth.additronSpectrum({
      device: 'additron', shape: 'stops', morph: 0,
      draw: [1, 0.9, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      drawB: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    })""")
    ck("Ad. stops mode keeps footage eighths and drops a free partial",
       abs(spec[0] - 1) < 1e-6 and abs(spec[1] - 0.875) < 1e-6 and spec[4] == 0, spec)
    eight = dict(clean, draw=draw_at((1, 1)), drawB=draw_at((1, 1)))
    eL, eR = ad_render(eight, seconds=0.5)
    seg = eL[len(eL) // 5:]
    f8 = peak_freq(seg)
    a440, a880 = tone_amp(seg, 440), tone_amp(seg, 880)
    ck("Ad. the 8' stop is the note, and it does not invent the octave",
       abs(f8 - 440) < 2 and ad_rms(seg) > 0.02 and float(np.max(np.abs(eL - eR))) < 1e-4
       and bool(np.isfinite(eL).all()) and float(np.max(np.abs(eL))) <= 1.0
       and a440 > 0.05 and a880 < a440 * 0.08,
       (round(f8, 2), round(ad_rms(seg), 4), round(a440, 4), round(a880, 4)))
    fL, _fR = ad_render(dict(clean, draw=draw_at((3, 1)), drawB=draw_at((3, 1))), seconds=0.45)
    f4 = peak_freq(fL[len(fL) // 5:])
    ck("Ad. the 4' stop is an octave up", abs(f4 - 880) < 3, round(f4, 2))
    sL, _sR = ad_render(dict(clean, draw=draw_at((0, 1)), drawB=draw_at((0, 1))), seconds=0.5)
    f16 = peak_freq(sL[len(sL) // 5:])
    ck("Ad. the 16' stop is an octave down", abs(f16 - 220) < 2, round(f16, 2))
    mL, _mR = ad_render(dict(clean, morph=1, draw=draw_at((1, 1)), drawB=draw_at((3, 1))), seconds=0.45)
    fm = peak_freq(mL[len(mL) // 5:])
    ck("Ad. morph 1 sounds snapshot B", abs(fm - 880) < 3, round(fm, 2))
    midL, _midR = ad_render(dict(clean, morph=0.5, draw=draw_at((1, 1)), drawB=draw_at((3, 1))), seconds=0.5)
    mid = midL[len(midL) // 5:]
    b440, b880 = tone_amp(mid, 440), tone_amp(mid, 880)
    ck("Ad. morph halfway keeps both snapshots",
       b440 > 0.02 and b880 > 0.02 and abs(b440 - b880) / max(b440, b880) < 0.55,
       (round(b440, 4), round(b880, 4)))
    both = draw_at((1, 1), (7, 1))
    tL, _tR = ad_render(dict(clean, draw=both, drawB=both[:], tilt=1, attack=0.004, decay=0.8, sustain=0, release=1.2, level=0.85), seconds=0.7)
    early = tL[int(0.05 * SR):int(0.12 * SR)]
    late = tL[int(0.48 * SR):int(0.62 * SR)]
    e_lo, e_hi = tone_amp(early, 440), tone_amp(early, 1760)
    l_lo, l_hi = tone_amp(late, 440), tone_amp(late, 1760)
    e_ratio = e_hi / e_lo if e_lo > 1e-4 else 99
    l_ratio = l_hi / l_lo if l_lo > 1e-4 else 99
    ck("Ad. tilt decays the higher partial faster than the 8'",
       e_lo > 0.02 and l_lo > 0.008 and l_ratio < e_ratio * 0.45,
       (round(e_ratio, 3), round(l_ratio, 3), round(e_lo, 4), round(l_lo, 4), round(e_hi, 4), round(l_hi, 4)))
    spL, spR = ad_render(dict(clean, rotor=True, speed="tremolo", spread=1, leak=0.15, drive=0, draw=draw_at((1, 1)), drawB=draw_at((1, 1))), seconds=0.6)
    dseg = (spL - spR)[int(0.08 * SR):]
    mseg = (spL + spR)[int(0.08 * SR):]
    ck("Ad. the tremolo rotor spreads left and right",
       ad_rms(dseg) > 0.04 * max(ad_rms(mseg), 1e-9) and ad_rms(spL) > 0.01,
       (round(ad_rms(dseg), 4), round(ad_rms(mseg), 4)))
    bL, bR = ad_render(dict(clean, rotor=True, speed="brake", spread=1, leak=0, drive=0, draw=draw_at((1, 1)), drawB=draw_at((1, 1))), seconds=0.4)
    ck("Ad. brake holds the rotor still",
       float(np.max(np.abs(bL - bR))) < 1e-3 and ad_rms(bL) > 0.01,
       round(float(np.max(np.abs(bL - bR))), 6))
    qL, qR = ad_render(dict(clean, level=0), seconds=0.3)
    ck("Ad. level 0 is silent", ad_rms(qL) < 1e-5 and ad_rms(qR) < 1e-5, round(ad_rms(qL), 8))
    pg.evaluate("__synth.setDevice('additron')")
    pg.wait_for_timeout(300)
    ck("Ad. the spectrum is on screen and Filament's filter is not",
       pg.evaluate("__synth.device()") == "additron" and pg.is_visible("#adCanvas") and pg.is_visible("#adMorph")
       and not pg.is_visible("#mFilt") and not pg.is_visible("#chassis"))
    help_p = pg.evaluate("""() => [...document.querySelectorAll('#mAdStage .note, .intro[data-dev="additron"]')].map(n => n.textContent).join(' ')""")
    ck("Ad. the panel explains drawing and the recorder", "Draw" in help_p and "WAV" in help_p, help_p[:160])
    pg.evaluate("""() => __synth.setPatch({ device: 'additron', shape: 'hand', edit: 'a', morph: 0, rotor: false, click: 0, perc: 0,
      draw: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], drawB: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] })""")
    pg.wait_for_timeout(80)
    box = pg.locator("#adCanvas").bounding_box()
    x = box["x"] + (1.5 / 16) * box["width"]
    y = box["y"] + box["height"] * 0.12
    pg.mouse.move(x, y)
    pg.mouse.down()
    pg.mouse.move(x + 3, y + 2)
    pg.mouse.up()
    pg.wait_for_timeout(40)
    drawn = pg.evaluate("__synth.patch().draw")
    ck("Ad. a drag on the spectrum raises that partial", drawn[1] > 0.7 and max(drawn[8:]) < 0.2, [round(v, 3) for v in drawn])
    # Review 22 Oct (R1022-2): the perc knob did nothing while the chips sat on "perc off".
    pg.evaluate("""() => __synth.setPatch({ device: 'additron', shape: 'stops', perc: 0, percHarm: 'off' })""")
    pg.wait_for_timeout(80)
    perc_knob = pg.locator("#mAdStage .knob[aria-label='perc'], .knob[aria-label='perc']").first
    perc_knob.focus()
    pg.keyboard.press("End")
    pg.wait_for_timeout(60)
    pk = pg.evaluate("""() => ({ p: __synth.patch().perc, h: __synth.patch().percHarm,
      chip: (document.getElementById('adPerc3') || {}).getAttribute ? document.getElementById('adPerc3').getAttribute('aria-pressed') : null })""")
    p_on = pg.evaluate("__synth.patch()")
    p_off = dict(p_on, percHarm="off")
    pq_on = ad_render(p_on, [{"t": "on", "n": 60, "v": 0.9, "at": 0}], 0.4)
    pq_off = ad_render(p_off, [{"t": "on", "n": 60, "v": 0.9, "at": 0}], 0.4)
    m = min(len(pq_on[0]), len(pq_off[0]))
    pdiff = float(np.sqrt(np.mean(np.square(pq_on[0][:m] - pq_off[0][:m]))))
    ck("Ad. turning the perc knob up from perc off turns the percussion on and it sounds",
       pk["p"] == 1 and pk["h"] == "3" and pk["chip"] == "true" and pdiff > 1e-3, (pk, round(pdiff, 5)))
    pg.evaluate("""() => __synth.setPatch({ device: 'additron', shape: 'hand', morph: 0, rotor: false, click: 0, perc: 0, vib: 0, tilt: 0,
      attack: 0.005, decay: 0.2, sustain: 1, release: 0.04, level: 0.8,
      draw: [0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0], drawB: [0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0] })""")
    pg.wait_for_timeout(150)
    pg.evaluate("__synth.noteOn(60, 0.85)")
    pg.evaluate("__synth.noteOn(64, 0.85)")
    pg.wait_for_function("() => (__synth.additronMeter().voices || 0) >= 2", timeout=2500)
    held = pg.evaluate("__synth.additronMeter()")
    pg.evaluate("__synth.panic()")
    pg.wait_for_function("() => (__synth.additronMeter().voices || 0) === 0", timeout=2500)
    released = pg.evaluate("__synth.additronMeter()")
    ck("Ad. two keys sound and panic lets them go", (held.get("voices") or 0) >= 2 and (released.get("voices") or 0) == 0, (held, released))
    pg.evaluate("__synth.midi([144, 67, 110])")
    pg.wait_for_function("() => (__synth.additronMeter().voices || 0) >= 1", timeout=2500)
    pg.evaluate("__synth.midi([128, 67, 0])")
    pg.wait_for_function("() => (__synth.additronMeter().voices || 0) === 0", timeout=2500)
    ck("Ad. a MIDI note speaks and then lets go", True)
    saved = pg.evaluate("""() => __synth.applyProject({
      name: 'Organ Bench', device: 'additron', tempo: 96,
      devices: { additron: { patch: { name: 'Kept Flute', shape: 'hand', morph: 0.25,
        draw: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] } } }
    })""")
    kept = pg.evaluate("__synth.patch()")
    ck("Ad. a project keeps the organ and the drawn spectrum",
       saved["device"] == "additron" and pg.evaluate("__synth.device()") == "additron"
       and kept["name"] == "Kept Flute" and abs(kept["morph"] - 0.25) < 1e-6 and abs(kept["draw"][1] - 1) < 1e-6,
       (saved["device"], kept.get("name"), kept.get("morph")))
    pg.screenshot(path=os.path.join(SHOTS, "synth_additron_desktop.png"), full_page=True)
    adn = b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    perr = []
    adn.on("pageerror", lambda e: perr.append(str(e)))
    adn.goto(BASE)
    adn.wait_for_function("window.__synth && __synth.ready()", timeout=20000)
    adn.wait_for_timeout(200)
    adn.evaluate("__synth.setDevice('additron')")
    adn.wait_for_timeout(300)
    ck("Ad. 390px: no horizontal scroll, the spectrum is up",
       adn.evaluate("document.documentElement.scrollWidth <= innerWidth && innerWidth === 390")
       and adn.is_visible("#adCanvas") and not adn.is_visible("#mFilt") and not adn.is_visible("#chassis"),
       (adn.evaluate("[document.documentElement.scrollWidth, innerWidth]"), perr))
    small = adn.evaluate("""() => [...document.querySelectorAll('.devbtn, .tabs button, #adRoot .chip, #adRoot input, #adRoot .knob')]
      .filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; })
      .map(e => (e.id || e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))""")
    ck("Ad. 390px: rail, tabs and spectrum controls are 44 px or more", not small, small)
    adn.tap('.tabs [data-go="spin"]')
    adn.wait_for_timeout(200)
    spin_small = adn.evaluate("""() => [...document.querySelectorAll('#adRoot .chip, #adRoot .knob, #adRoot input')]
      .filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; })
      .map(e => (e.id || e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))""")
    ck("Ad. 390px: the Spin tab fits and its controls are 44 px or more",
       not spin_small and adn.is_visible("#adRotor") and adn.is_visible("#adKnobs") and not adn.is_visible("#adCanvas")
       and adn.evaluate("document.documentElement.scrollWidth <= innerWidth && innerWidth === 390"),
       (spin_small, adn.evaluate("[document.documentElement.scrollWidth, innerWidth]")))
    adn.screenshot(path=os.path.join(SHOTS, "synth_additron_phone.png"))
    ck("Ad. 390px: no page errors", not perr, perr)
    adn.close()
    pg.evaluate("__synth.setDevice('filament')")
    pg.wait_for_timeout(120)
    ck("Ad. no page errors", len(errs) == ad_before, errs[ad_before:])
    ph = b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    perr = []
    ph.on("pageerror", lambda e: perr.append(str(e)))
    ph.goto(BASE)
    ph.wait_for_function("window.__synth && __synth.ready()", timeout=20000)
    ph.evaluate("__synth.setDevice('rhumbatron')")
    ph.wait_for_timeout(250)
    ck("Rh. 390px: no horizontal scroll, the cavity is up",
       ph.evaluate("document.documentElement.scrollWidth <= innerWidth && innerWidth === 390")
       and ph.is_visible("#rhumCanvas") and not ph.is_visible("#mFilt"),
       (ph.evaluate("[document.documentElement.scrollWidth, innerWidth]"), perr))
    small = ph.evaluate("""() => [...document.querySelectorAll('.devbtn, .tabs button, #rhumRoot .chip, #rhumRoot input')]
      .filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; })
      .map(e => (e.id || e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))""")
    ck("Rh. 390px: rail, tabs and cavity controls are 44 px or more", not small, small)
    ph.tap('.tabs [data-go="cavity"]')
    ph.wait_for_timeout(200)
    cav_small = ph.evaluate("""() => [...document.querySelectorAll('#rhumRoot .chip, #rhumRoot input')]
      .filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; })
      .map(e => (e.id || e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))""")
    ck("Rh. 390px: the Cavity tab fits and its controls are 44 px or more",
       not cav_small and ph.is_visible("#rhumDamp") and not ph.is_visible("#rhumCanvas")
       and ph.evaluate("document.documentElement.scrollWidth <= innerWidth && innerWidth === 390"),
       (cav_small, ph.evaluate("[document.documentElement.scrollWidth, innerWidth]")))
    ph.screenshot(path=os.path.join(SHOTS, "synth_rhumbatron_phone.png"))
    ck("Rh. 390px: no page errors", not perr, perr)
    ph.close()
    pg.evaluate("__synth.setDevice('filament')")
    pg.wait_for_timeout(150)
    ck("Rh. no page errors", not errs, errs)
    # ---------------------------------------------------------------- Rn. Resnatron, the patch bay
    def rn_render(patch, events, seconds=1.0):
        return dec(pg.evaluate("a => __synth.resnatronRender(a)", {"patch": patch, "events": events, "seconds": seconds}))
    def rn_rms(x, a, b):
        seg = x[int(a * SR):int(b * SR)]
        return float(np.sqrt(np.mean(np.square(seg)))) if len(seg) else 0.0
    devk = pg.evaluate("""() => { const d = __synth.resnatronDevice(); return {
      id: d.id, name: d.name, api: d.api, inst: d.instrument, outs: d.audioOutputs, midi: d.midiInput,
      proc: d.processor, worklet: d.worklet, ch: d.channels, n: Object.keys(d.parameters).length,
      listed: __synth.devices().some(x => x.id === 'resnatron') }; }""")
    ck("Rn. Resnatron publishes a stereo MIDI dxrack/1 device",
       devk["id"] == "resnatron" and devk["name"] == "Resnatron" and devk["api"] == "dxrack/1" and devk["inst"]
       and devk["outs"] == 1 and devk["midi"] and devk["proc"] == "resnatron" and devk["worklet"] == "resnatron.worklet.js"
       and devk["ch"] == 2 and devk["n"] > 20 and devk["listed"], devk)
    norm = pg.evaluate("""() => {
      const p = __synth.resnatronNormalize({
        name: '  stray  ', level: 4, cat: 'nope',
        vco1: { wave: 'nope', oct: 9, kbd: 0 },
        cables: [
          { from: 'ghost.out', to: 'out.in' },
          { from: 'vco1.out', to: 'out.in' },
          { from: 'noise.out', to: 'out.in' },
          { from: 'vco2.out', to: 'not.an.input' },
        ],
      });
      return { name: p.name, level: p.level, cat: p.cat, wave: p.vco1.wave, oct: p.vco1.oct, kbd: p.vco1.kbd, cables: p.cables };
    }""")
    ck("Rn. normalize clamps a patch and keeps one cable per input",
       norm["name"] == "stray" and norm["level"] == 1 and norm["cat"] == "East" and norm["wave"] == "saw"
       and norm["oct"] == 2 and norm["kbd"] is False and norm["cables"] == [{"from": "noise.out", "to": "out.in"}], norm)
    names = pg.evaluate("""() => __synth.resnatronFactory()""")
    ck("Rn. four starter patches",
       [n["name"] for n in names] == ["Cavity Saw", "Bunch Glass", "Reed Drift", "Twin Cavity"] and len({n["cat"] for n in names}) >= 2, names)
    shared = pg.evaluate("""() => {
      const src = __synth.resnatronPatch('Bunch Glass');
      const text = __synth.resnatronShare(src);
      const back = __synth.resnatronParse(text);
      const junk = __synth.resnatronParse('not a patch!!!');
      return { text, same: JSON.stringify(back) === JSON.stringify(__synth.resnatronNormalize(src)), cables: back.cables.length, junk };
    }""")
    ck("Rn. a share link round-trips the cables",
       shared["same"] and shared["cables"] >= 6 and shared["junk"] is None and len(shared["text"]) > 40, (shared["cables"], shared["junk"], len(shared["text"])))
    quietL, quietR = rn_render({"device": "resnatron", "cables": []}, [{"at": 0, "t": "on", "n": 69, "v": 1}], 0.4)
    ck("Rn. an unpatched bay is silent", rn_rms(quietL, 0.05, 0.35) < 1e-6 and rn_rms(quietR, 0.05, 0.35) < 1e-6, (rn_rms(quietL, 0.05, 0.35), rn_rms(quietR, 0.05, 0.35)))
    sine = {"device": "resnatron", "level": 0.9, "vco1": {"wave": "sine", "oct": 0, "fine": 0, "kbd": True}, "out": {"level": 0.9, "pan": 0},
            "cables": [{"from": "vco1.out", "to": "out.in"}]}
    toneL, toneR = rn_render(sine, [{"at": 0.02, "t": "on", "n": 69, "v": 0.9}], 1.0)
    seg = toneL[int(0.2 * SR):int(0.9 * SR)]
    got = peak_freq(seg)
    cents = abs(1200 * math.log2(got / 440.0))
    ck(f"Rn. a sine patched to Out at A4 is 440 Hz ({got:.2f} Hz, {cents:.1f} cents)",
       cents < 8 and rn_rms(toneL, 0.2, 0.9) > 0.02 and abs(rn_rms(toneL, 0.2, 0.9) - rn_rms(toneR, 0.2, 0.9)) < 0.01,
       (got, cents, rn_rms(toneL, 0.2, 0.9), rn_rms(toneR, 0.2, 0.9)))
    saw = {"device": "resnatron", "vco1": {"wave": "saw", "kbd": True}, "vcf": {"mode": "lp", "res": 0.05, "depth": 0}, "out": {"level": 0.9},
           "cables": [{"from": "vco1.out", "to": "vcf.in"}, {"from": "vcf.out", "to": "out.in"}]}
    openL, _ = rn_render(dict(saw, vcf={"mode": "lp", "cutoff": 10000, "res": 0.05, "depth": 0}), [{"at": 0, "t": "on", "n": 69, "v": 1}], 0.5)
    shutL, _ = rn_render(dict(saw, vcf={"mode": "lp", "cutoff": 80, "res": 0.05, "depth": 0}), [{"at": 0, "t": "on", "n": 69, "v": 1}], 0.5)
    open_e, shut_e = rn_rms(openL, 0.1, 0.45), rn_rms(shutL, 0.1, 0.45)
    ck(f"Rn. an open filter is louder than a closed one ({open_e:.4f} vs {shut_e:.4f})",
       open_e > shut_e * 4 and open_e > 0.02, (open_e, shut_e))
    stackL, _ = rn_render(sine, [{"at": 0, "t": "on", "n": 60, "v": 1}, {"at": 0.35, "t": "on", "n": 72, "v": 1}], 1.0)
    low = peak_freq(stackL[int(0.08 * SR):int(0.28 * SR)])
    high = peak_freq(stackL[int(0.5 * SR):int(0.95 * SR)])
    ck(f"Rn. the last note wins ({low:.1f} Hz then {high:.1f} Hz)",
       abs(1200 * math.log2(low / 261.6256)) < 15 and abs(1200 * math.log2(high / 523.251)) < 15, (low, high))
    gated = {"device": "resnatron", "vco1": {"wave": "sine", "kbd": True}, "env": {"a": 0.005, "d": 0.2, "s": 0.8, "r": 0.4, "kbd": True},
             "vca": {"level": 0}, "out": {"level": 0.9},
             "cables": [{"from": "vco1.out", "to": "vca.in"}, {"from": "env.out", "to": "vca.cv"}, {"from": "vca.out", "to": "out.in"}]}
    liveL, _ = rn_render(gated, [{"at": 0, "t": "on", "n": 69, "v": 1}], 0.5)
    deadL, _ = rn_render(gated, [{"at": 0, "t": "on", "n": 69, "v": 1}, {"at": 0.12, "t": "panic"}], 0.6)
    ck("Rn. panic silences a sounding patch",
       rn_rms(liveL, 0.05, 0.4) > 0.02 and rn_rms(deadL, 0.05, 0.1) > 0.01 and rn_rms(deadL, 0.2, 0.55) < 1e-5,
       (rn_rms(liveL, 0.05, 0.4), rn_rms(deadL, 0.05, 0.1), rn_rms(deadL, 0.2, 0.55)))
    echo = {"device": "resnatron", "level": 0.9, "vco1": {"wave": "sine", "kbd": True},
            "env": {"a": 0.001, "d": 0.05, "s": 1, "r": 0.01, "kbd": True}, "vca": {"level": 0},
            "delay": {"time": 0.3, "fb": 0, "mix": 1}, "out": {"level": 0.9},
            "cables": [{"from": "vco1.out", "to": "vca.in"}, {"from": "env.out", "to": "vca.cv"},
                       {"from": "vca.out", "to": "delay.in"}, {"from": "delay.out", "to": "out.in"}]}
    echoL, _ = rn_render(echo, [{"at": 0, "t": "on", "n": 69, "v": 1}, {"at": 0.06, "t": "off", "n": 69}], 0.7)
    gap_e, tail_e = rn_rms(echoL, 0.12, 0.24), rn_rms(echoL, 0.34, 0.48)
    ck(f"Rn. delay returns the note after the dry gap ({gap_e:.5f} then {tail_e:.4f})",
       gap_e < 1e-4 and tail_e > 0.01, (gap_e, tail_e))
    pg.evaluate("__synth.setDevice('resnatron')")
    pg.wait_for_timeout(200)
    ck("Rn. the bay is on screen",
       pg.evaluate("__synth.device()") == "resnatron" and pg.is_visible("#rnBay") and pg.is_visible("#mRnBay") and not pg.is_visible("#mFilt") and not pg.is_visible("#chassis"))
    pg.evaluate("""() => __synth.setPatch({ device: 'resnatron', name: 'Bare', cables: [] })""")
    pg.click("#rnJ-vco1-out")
    pg.click("#rnJ-out-in")
    pg.wait_for_timeout(80)
    clicked = pg.evaluate("__synth.patch().cables")
    ck("Rn. click an output, click an input: one cable", clicked == [{"from": "vco1.out", "to": "out.in"}], clicked)
    pg.click("#rnUnplug")
    pg.wait_for_timeout(40)
    pulled = pg.evaluate("__synth.patch().cables")
    ck("Rn. unplug all clears the bay", pulled == [], pulled)
    pg.click('[data-rn-factory="Reed Drift"]')
    pg.wait_for_timeout(40)
    reed = pg.evaluate("() => ({ name: __synth.patch().name, n: __synth.patch().cables.length, mode: __synth.patch().vcf.mode })")
    ck("Rn. a starter chip loads that patch", reed["name"] == "Reed Drift" and reed["n"] >= 4 and reed["mode"] == "bp", reed)
    pg.evaluate("__synth.noteOn(60, 0.9)")
    pg.wait_for_function("() => (__synth.resnatronMeter().voices || 0) > 0", timeout=2000)
    pg.evaluate("__synth.panic()")
    pg.wait_for_function("() => (__synth.resnatronMeter().voices || 0) === 0", timeout=2000)
    ck("Rn. Panic clears the held note", (pg.evaluate("__synth.resnatronMeter()").get("voices") or 0) == 0)
    pg.evaluate("""() => {
      const mix = __synth.mixer() || {};
      Object.keys(mix).forEach(id => __synth.setMixer(id, { mute: false, solo: false, level: mix[id].level, pan: mix[id].pan }));
      __synth.setMixer('resnatron', { level: 1, pan: 0, mute: false, solo: false });
    }""")
    pg.evaluate("""() => __synth.setPatch({ device: 'resnatron', level: 0.9, vco1: { wave: 'sine', kbd: true }, out: { level: 0.9, pan: 0 }, cables: [{ from: 'vco1.out', to: 'out.in' }] })""")
    pg.evaluate("__synth.noteOn(69, 0.9)")
    pg.wait_for_timeout(120)
    pg.evaluate("() => __synth.recordStart()")
    pg.wait_for_timeout(500)
    rec = pg.evaluate("() => __synth.recordStop()")
    pg.evaluate("__synth.noteOff(69)")
    rec_raw = base64.b64decode(rec["b64"]) if rec and rec.get("b64") else b""
    import struct as _rn_st
    def rn_parse(b):
        if len(b) < 44 or b[0:4] != b"RIFF": return None
        o, fmt, data = 12, None, None
        while o + 8 <= len(b):
            cid, sz = b[o:o + 4], int.from_bytes(b[o + 4:o + 8], "little")
            body = b[o + 8:o + 8 + sz]
            if cid == b"fmt ": fmt = body
            elif cid == b"data": data = body
            o += 8 + sz + (sz & 1)
        if not fmt or data is None or len(fmt) < 16: return None
        audio_fmt, ch, rate, byterate, align, bits = _rn_st.unpack("<HHIIHH", fmt[:16])
        return {"fmt": audio_fmt, "ch": ch, "rate": rate, "bits": bits, "data": data}
    rec_info = rn_parse(rec_raw) if rec_raw else None
    if rec_info and rec_info["bits"] == 24 and len(rec_info["data"]) >= 6:
        n = len(rec_info["data"]) // 6
        recL = np.empty(n)
        for i in range(n):
            z = rec_info["data"][i * 6:i * 6 + 3]
            v = z[0] | (z[1] << 8) | (z[2] << 16)
            recL[i] = (v - 0x1000000 if v & 0x800000 else v) / 8388607
        rec_rms = float(np.sqrt(np.mean(np.square(recL)))) if n else 0.0
    else:
        rec_rms = 0.0
    ck("Rn. the master recorder hears Resnatron",
       rec_info and rec_info["fmt"] == 1 and rec_info["bits"] == 24 and rec_info["ch"] == 2 and rec_rms > 1e-3
       and bool(_re2.fullmatch(r"Resnatron-\d{8}-\d{6}\.wav", rec.get("name") or "")),
       (None if not rec else rec.get("name"), rec_rms, None if not rec_info else rec_info["bits"]))
    kept = pg.evaluate("""() => {
      __synth.setPatch({ device: 'resnatron', name: 'Kept Bay', cables: [{ from: 'noise.out', to: 'out.in' }] });
      const proj = __synth.project();
      return proj.devices.resnatron.patch;
    }""")
    ck("Rn. a project keeps the bay", kept["name"] == "Kept Bay" and kept["cables"] == [{"from": "noise.out", "to": "out.in"}], kept.get("name"))
    link = pg.evaluate("""() => { document.getElementById('rnLink').click(); return location.search; }""")
    ck("Rn. copy link writes the share into the page address", "rn=" in link, link)
    ph = b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    perr = []
    ph.on("pageerror", lambda e: perr.append(str(e)))
    ph.goto(BASE + "?rn=" + pg.evaluate("__synth.resnatronShare()"))
    ph.wait_for_function("window.__synth && __synth.ready()", timeout=20000)
    ph.wait_for_function("() => __synth.device()==='resnatron' && __synth.patch().name === 'Kept Bay'", timeout=5000)
    ph.wait_for_timeout(150)
    phone_cables = ph.evaluate("__synth.patch().cables")
    ck("Rn. the share address opens the same bay",
       ph.evaluate("__synth.device()") == "resnatron" and phone_cables == [{"from": "noise.out", "to": "out.in"}], phone_cables)
    ck("Rn. 390px: no horizontal scroll, the bay is up",
       ph.evaluate("document.documentElement.scrollWidth <= innerWidth && innerWidth === 390")
       and ph.is_visible("#rnBay") and not ph.is_visible("#mFilt") and not ph.is_visible("#chassis"),
       (ph.evaluate("[document.documentElement.scrollWidth, innerWidth]"), perr))
    small = ph.evaluate("""() => [...document.querySelectorAll('.devbtn, .tabs button, #rnRoot .chip, #rnRoot .btn, #rnRoot input, #rnRoot select, #rnRoot .rn-jack')]
      .filter(e => e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; })
      .map(e => (e.id || e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))""")
    ck("Rn. 390px: rail, tabs, jacks and knobs are 44 px or more", not small, small)
    ph.locator("#rnJ-vco2-out").scroll_into_view_if_needed()
    ph.tap("#rnJ-vco2-out")
    ph.locator("#rnJ-mix-a").scroll_into_view_if_needed()
    ph.tap("#rnJ-mix-a")
    ph.wait_for_timeout(80)
    tapped = ph.evaluate("__synth.patch().cables")
    ck("Rn. 390px: tap an output, tap an input: patched",
       {"from": "vco2.out", "to": "mix.a"} in tapped, tapped)
    ph.screenshot(path=os.path.join(SHOTS, "synth_resnatron_phone.png"))
    ck("Rn. 390px: no page errors", not perr, perr)
    ph.close()

    # Wide desk: remembered control size, undo, init, master volume, safety limiter.
    pg.evaluate("__synth.setDevice('filament')")
    pg.wait_for_timeout(80)
    ck("Desk. 1366 starts at medium when nothing is saved", pg.evaluate("document.documentElement.getAttribute('data-ui')") == "m")
    ck("Desk. undo, init, volume, limiter and size controls are on the page",
       pg.locator("#undoBtn").count() == 1 and pg.locator("#initBtn").count() == 1
       and pg.locator("#mastVol").count() == 1 and pg.locator("#safeLim").count() == 1
       and pg.locator("#uiSize [data-ui-size]").count() == 4)
    moved = pg.evaluate("""() => {
      const k = [...document.querySelectorAll('#kFilt .knob')].find(el => el.getAttribute('aria-label') === 'cutoff');
      k.focus();
      const before = __synth.patch().filt.cutoff;
      k.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      const after = __synth.patch().filt.cutoff;
      __synth.undo();
      const back = __synth.patch().filt.cutoff;
      return { before, after, back };
    }""")
    ck("Desk. arrow-up on cutoff can be undone",
       moved["after"] != moved["before"] and abs(moved["back"] - moved["before"]) < 1e-4, moved)
    pg.evaluate("__synth.resetDevice()")
    pg.wait_for_timeout(40)
    ck("Desk. init loads the plain Init patch", pg.evaluate("__synth.patch().name") == "Init")
    vol = pg.evaluate("""() => {
      const name = __synth.patch().name;
      const g = __synth.setMasterVol(0.5);
      const gain = __synth.engine().master.gain.value;
      __synth.setMasterVol(1);
      return { g, gain, name, restored: __synth.engine().master.gain.value, patch: __synth.patch().name };
    }""")
    ck("Desk. master volume is the output gain and is not a patch",
       abs(vol["g"] - 0.5) < 1e-6 and abs(vol["gain"] - 0.5) < 1e-6 and abs(vol["restored"] - 1) < 1e-6 and vol["patch"] == vol["name"], vol)
    ck("Desk. the safety limiter is off", pg.evaluate("__synth.master().comp.safety") is False)
    loud = patch(osc1={"wave": "sine", "level": 1}, osc2={"wave": "sine", "level": 1}, filt={"model": "ladder24", "cutoff": 18000}, out={"level": 12, "drive": 6})
    safeL, _ = render(loud, note(60, 0.02, v=1), 0.8, rack=False, master={"comp": {"on": False, "safety": True, "ceiling": -18, "limit": False}})
    bareL, _ = render(loud, note(60, 0.02, v=1), 0.8, rack=False, master={"comp": {"on": False, "safety": False}})
    spk, bpk = float(np.max(np.abs(safeL[int(0.2 * SR):]))), float(np.max(np.abs(bareL[int(0.2 * SR):])))
    ck("Desk. the safety limiter holds a loud note near a low ceiling",
       bpk > 0.2 and spk < bpk * 0.85 and spk < 0.2, (spk, bpk))
    # Review 26 Oct: the limiter smoothed its gain per sample (2 ms attack, no hold), so every waveform
    # peak rode over the ceiling: the safety limit let a delay and a chord out at +1.4 dBFS, and the
    # compressor's limit (ceiling -1 dB, makeup 12 dB) at +1.8 dBFS. A ceiling is a ceiling.
    c18 = 10 ** (-18 / 20)
    spk_all = float(max(np.max(np.abs(safeL)), 0))
    chord = [e for n_ in (48, 55, 60, 64, 67, 72) for e in note(n_, 0.05, 1.0, v=1)]
    dlyL, dlyR = render(patch(), chord, 2.5, rack=False, master={"delay": {"on": True, "feedback": 0.95, "mix": 1}, "comp": {"on": False, "safety": True}})
    mkL, mkR = render(patch(), chord, 2.0, rack=False, master={"comp": {"on": True, "makeup": 12, "limit": True, "ceiling": -1}})
    c1 = 10 ** (-1 / 20)
    dpk = float(max(np.max(np.abs(dlyL)), np.max(np.abs(dlyR)))); mpk = float(max(np.max(np.abs(mkL)), np.max(np.abs(mkR))))
    ck(f"Desk. no sample passes the limiter's ceiling (safety at -18 dB: {db(spk_all):.2f} dBFS; safety at -1 dB, delay feedback 95%: {db(dpk):.2f}; limit at -1 dB, makeup 12 dB: {db(mpk):.2f})",
       spk_all <= c18 * 1.0001 and 0.5 < dpk <= c1 * 1.0001 and 0.5 < mpk <= c1 * 1.0001, (spk_all, dpk, mpk))
    pg.evaluate("__synth.setMaster({comp:{safety:false, on:false}})")
    wide = b.new_page(viewport={"width": 1920, "height": 1080})
    wide.add_init_script("try { localStorage.removeItem('dxedge_ui_size'); localStorage.removeItem('dxedge_master_vol'); } catch (e) {}")
    werr = []
    wide.on("pageerror", lambda e: werr.append(str(e)))
    wide.goto(BASE)
    wide.wait_for_function("window.__synth && __synth.ready()", timeout=20000)
    wide.wait_for_timeout(200)
    desk = wide.evaluate("""() => {
      const k = document.getElementById('keybed');
      const s = getComputedStyle(k);
      const r = k.getBoundingClientRect();
      const knob = document.querySelector('.knob');
      return {
        ui: document.documentElement.getAttribute('data-ui'),
        pos: s.position,
        bottom: r.bottom,
        h: innerHeight,
        scroll: document.documentElement.scrollWidth <= innerWidth + 1,
        knob: knob ? knob.getBoundingClientRect().width : 0,
      };
    }""")
    ck("Desk. 1920 starts large, the keys stay on screen, and the page does not scroll sideways",
       desk["ui"] == "l" and desk["pos"] == "fixed" and abs(desk["bottom"] - desk["h"]) < 3
       and desk["scroll"] and desk["knob"] >= 70 and not werr, (desk, werr))
    def key_fill(page):
        return page.evaluate("""() => {
          const wrap = document.getElementById('keyswrap').getBoundingClientRect();
          const keys = document.getElementById('keys').getBoundingClientRect();
          const kb = document.getElementById('keybed').getBoundingClientRect();
          const box = e => { const r = e.getBoundingClientRect(); return { t: (e.innerText || e.textContent || '').replace(/\\s+/g, ' ').trim(), top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };
          const labs = [...document.querySelectorAll('.stripcol .sl')].map(box);
          const lines = [...document.querySelectorAll('.kctl div')].filter(e => e.offsetParent).map(box);
          const inside = rows => rows.every(r => r.top >= kb.top - 1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1 && r.left >= -1);
          const overlap = labs.length >= 2 && labs[0].right > labs[1].left + 0.5;
          const ww = document.querySelector('.key.w');
          return {
            gap: Math.round((wrap.right - keys.right) * 10) / 10,
            fill: keys.width >= wrap.width - 2,
            whites: document.querySelectorAll('.key.w').length,
            keyW: ww ? Math.round(ww.getBoundingClientRect().width * 10) / 10 : 0,
            overlap, labelsIn: inside(labs), linesIn: inside(lines), labs, lines,
          };
        }""")
    fill = key_fill(wide)
    ck("Desk. 1920 keys fill the bar and the bottom labels stay on screen",
       fill["fill"] and fill["gap"] <= 2 and fill["whites"] >= 29 and not fill["overlap"] and fill["labelsIn"] and fill["linesIn"], fill)
    # One extra rack page at a time: with four open beside pg, a 2-core box timed out loading the last (24 Oct)
    wide.close()
    huge = b.new_page(viewport={"width": 2048, "height": 1080})
    huge.add_init_script("try { localStorage.setItem('dxedge_ui_size', 'l'); } catch (e) {}")
    huge.goto(BASE)
    huge.wait_for_function("window.__synth && __synth.ready()", timeout=20000)
    huge.wait_for_timeout(200)
    fill2 = key_fill(huge)
    ck("Desk. 2048 keys fill the bar and the bottom labels stay on screen",
       fill2["fill"] and fill2["gap"] <= 2 and fill2["whites"] >= 36 and fill2["keyW"] >= 28
       and not fill2["overlap"] and fill2["labelsIn"] and fill2["linesIn"], fill2)
    huge.close()
    mid = b.new_page(viewport={"width": 1280, "height": 800})
    mid.add_init_script("try { localStorage.removeItem('dxedge_ui_size'); } catch (e) {}")
    mid.goto(BASE)
    mid.wait_for_function("window.__synth && __synth.ready()", timeout=20000)
    ck("Desk. 1280 stays medium", mid.evaluate("document.documentElement.getAttribute('data-ui')") == "m")
    mid.close()
    ph = b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    ph.add_init_script("try { localStorage.setItem('dxedge_ui_size', 'xl'); } catch (e) {}")
    ph.goto(BASE)
    ph.wait_for_function("window.__synth && __synth.ready()", timeout=20000)
    ph.wait_for_timeout(200)
    phone_fit = ph.evaluate("""() => {
      const small = [...document.querySelectorAll('#undoBtn, #initBtn, #safeLim, #uiSize button, #mastVol')]
        .filter(e => e.offsetParent)
        .filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; })
        .map(e => (e.id || e.textContent || '').trim() + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height));
      return { scroll: document.documentElement.scrollWidth <= innerWidth && innerWidth === 390, small };
    }""")
    ck("Desk. a saved XL size still fits a phone", phone_fit["scroll"] and not phone_fit["small"], phone_fit)
    phone_keys = ph.evaluate("""() => {
      const ww = document.querySelector('.key.w');
      const r = ww ? ww.getBoundingClientRect() : { width: 0, height: 0 };
      return { w: r.width, h: r.height, n: document.querySelectorAll('.key.w').length };
    }""")
    ck("Desk. a phone keeps 44px keys", phone_keys["w"] >= 44 and phone_keys["h"] >= 44 and phone_keys["n"] <= 20, phone_keys)
    ph.close()

    # Hd. the phone header (graphics, 30 Oct): three rows, not four, so the lit panel shows above the keybed on a
    # 375x667 first screen; the size switch is one slot of four joined keys; a running take's time sits over the
    # rec key instead of pushing the row down.
    def _hd_lum(c):
        c = [v / 255 for v in c]; c = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    def _hd_rgb(s):
        return [float(v) for v in s[s.index("(") + 1:s.index(")")].split(",")[:3]]
    HD_JS = """() => {
      const R = s => { const e = document.querySelector(s); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }; };
      const bar = ['#prevP','#patchSel','#nextP','#saveP','#undoBtn','#initBtn','#safeLim','#mastRec','#mastJump','#midiBtn','.top > .sup', ...[...document.querySelectorAll('#uiSize button')].map((_, i) => '#uiSize button:nth-child(' + (i + 1) + ')')];
      const small = bar.map(s => [s, R(s)]).filter(([s, r]) => r && (r.w < 44 || r.h < 44)).map(([s, r]) => s + ' ' + Math.round(r.w) + 'x' + Math.round(r.h));
      const keys = [...document.querySelectorAll('#uiSize button')].map(e => e.getBoundingClientRect());
      const joined = keys.every((k, i) => i === 0 || Math.abs(k.left - keys[i - 1].right) < 0.5);
      const lit = document.querySelector('#uiSize button[aria-pressed="true"]');
      return { rec: R('#mastRec'), midi: R('#midiBtn'), size: R('#uiSize'), vol: R('.volab'), top: R('.top'), panel: R('.panel'), keybed: R('.keybed'), chassis: R('#chassis'),
        small, joined, litBg: lit ? getComputedStyle(lit).backgroundImage : '', sw: document.documentElement.scrollWidth, iw: innerWidth };
    }"""
    for hw in (375, 360):
        hctx = b.new_context(viewport={"width": hw, "height": 667}, is_mobile=True, has_touch=True, device_scale_factor=2)
        hp = hctx.new_page(); herr = []; hp.on("pageerror", lambda e: herr.append(str(e)))
        hp.goto(BASE); hp.wait_for_function("window.__synth && __synth.ready()", timeout=20000); hp.wait_for_timeout(300)
        hd = hp.evaluate(HD_JS)
        one_row = abs(hd["rec"]["y"] - hd["midi"]["y"]) < 1 and abs(hd["rec"]["y"] - hd["size"]["y"]) < 1 and hd["rec"]["y"] > hd["vol"]["y"] + 20
        ck(f"Hd. {hw}px: rec, master, MIDI and the size switch share the third header row (header {hd['top']['h']:.0f} px tall)",
           one_row and hd["top"]["h"] <= 210, hd)
        ck(f"Hd. {hw}px: the lit panel shows above the keybed on the first screen ({hd['keybed']['y'] - hd['panel']['y']:.0f} px)",
           hd["keybed"]["y"] - hd["panel"]["y"] >= 40, (hd["panel"], hd["keybed"]))
        ck(f"Hd. {hw}px: header targets are 44 px, the four size keys are joined, the lit key is amber, no sideways scroll",
           not hd["small"] and hd["joined"] and "255, 197, 108" in hd["litBg"] and hd["sw"] <= hd["iw"], hd)
        if hw == 375:
            hp.evaluate("() => { document.getElementById('mastRec').setAttribute('aria-pressed', 'true'); document.querySelectorAll('[data-rec-time]').forEach(e => { e.textContent = '12:34'; }); }")
            hp.wait_for_timeout(60)
            rt = hp.evaluate("""() => { const t = document.getElementById('mastTime'), k = document.getElementById('mastRec');
              const a = t.getBoundingClientRect(), r = k.getBoundingClientRect(), cs = getComputedStyle(t);
              return { inside: a.left >= r.left - 0.5 && a.right <= r.right + 0.5 && a.top >= r.top - 0.5 && a.bottom <= r.bottom + 0.5,
                fits: t.scrollWidth <= t.clientWidth + 1, color: cs.color, bg: cs.backgroundColor, pe: cs.pointerEvents,
                hit: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === k,
                midiY: document.getElementById('midiBtn').getBoundingClientRect().top, recY: r.top, chassis: document.getElementById('chassis').getBoundingClientRect().top }; }""")
            rcon = (_hd_lum(_hd_rgb(rt["color"])) + 0.05) / (_hd_lum(_hd_rgb(rt["bg"])) + 0.05)
            ck(f"Hd. 375px: a running take's time sits over the rec key, a tap still reaches the key, nothing moves (contrast {rcon:.1f}:1)",
               rt["inside"] and rt["fits"] and rt["hit"] and rt["pe"] == "none" and abs(rt["midiY"] - rt["recY"]) < 1
               and abs(rt["chassis"] - hd["chassis"]["y"]) < 1 and rcon >= 4.5, rt)
            hp.evaluate("() => { document.getElementById('mastRec').setAttribute('aria-pressed', 'false'); document.querySelectorAll('[data-rec-time]').forEach(e => { e.textContent = ''; }); }")
            hp.screenshot(path=os.path.join(SHOTS, "synth_header_phone.png"))
        ck(f"Hd. {hw}px: no page errors", not herr, herr)
        hctx.close()
    dsk = pg.evaluate(HD_JS)
    ck("Hd. 1366px: the size switch is one slot of joined keys on the patch row",
       dsk["joined"] and abs(dsk["size"]["y"] - dsk["midi"]["y"]) < 4 and dsk["size"]["w"] < 200, dsk["size"])

    pg.evaluate("__synth.setDevice('filament')")
    pg.wait_for_timeout(80)
    ck("Rn. no page errors", not errs, errs)

    b.close()

print()
print("ALL PASS" if not F else f"{len(F)} FAILED: " + "; ".join(F))
sys.exit(1 if F else 0)
