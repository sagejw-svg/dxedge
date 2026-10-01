#!/usr/bin/env python3
"""AI restoration pipeline for /otr episodes (first target: Lights Out).

For each catalog episode:
  1. source  - find every copy on archive.org, measure real bandwidth and noise on a sample of
               each (bitrate lies: upsampled transcodes look big), keep the best
  2. split   - Demucs separates dialogue from music + sound effects
  3. voice   - AI denoise (MossFormer2) then AI bandwidth extension (AP-BWE) on dialogue only
  4. rest    - music/effects get declick + light hiss reduction, nothing generative
  5. mix     - dialogue back at its original level, loudness -18 LUFS, mono MP3 128 kbps
  6. QA      - envelope check (catches broken model output), transcript diff between the
               source and the result (flags words the AI may have changed), metrics, 60 s A/B clips
All models are MIT / Apache-2.0 (no non-commercial weights). Nothing is published by this script.

  pip install demucs audiosronnx faster-whisper soundfile numpy   (+ onnxruntime-gpu, CUDA torch on a GPU box)
  python scripts/otr_restore.py --show lights-out --episodes 1            # episode index in catalog.json
  python scripts/otr_restore.py --show lights-out --episodes all --out D:/otr_restore
  python scripts/otr_restore.py --show lights-out --episodes 1 --clip 10:90   # quick 90 s trial
"""
import argparse, difflib, hashlib, json, os, re, subprocess, sys, tempfile, time, urllib.parse, urllib.request
import numpy as np, soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
CATALOG = os.path.join(HERE, "..", "frontend", "public", "otr", "catalog.json")
MON = {m: i + 1 for i, m in enumerate("jan feb mar apr may jun jul aug sep oct nov dec".split())}
UA = {"User-Agent": "dxedge-otr-restore/1"}

def log(*a): print(time.strftime("%H:%M:%S"), *a, flush=True)
def get_json(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r: return json.load(r)
def ff(*args): subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)
def decode(p, rate, t0=None, dur=None):
    a = ["ffmpeg", "-v", "error"] + (["-ss", str(t0)] if t0 else []) + ["-i", p] + (["-t", str(dur)] if dur else []) + ["-ac", "1", "-ar", str(rate), "-f", "f32le", "-"]
    return np.frombuffer(subprocess.run(a, capture_output=True, check=True).stdout, dtype=np.float32).copy()
def secs(x):
    x = str(x or "0")
    if ":" in x:
        p = [float(t) for t in x.split(":")]; return p[-1] + 60 * p[-2] + (3600 * p[-3] if len(p) > 2 else 0)
    try: return float(x)
    except ValueError: return 0.0
def cat_iso(d):
    m = re.match(r"^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$", str(d).strip())
    return f"{m.group(3)}-{MON[m.group(2).lower()]:02d}-{int(m.group(1)):02d}" if m else ""
def file_iso(n):
    n = os.path.basename(n)
    for rx, order in [(r"(?<!\d)(19[2-6]\d)[-_. ]?(\d{2})[-_. ]?(\d{2})(?!\d)", "ymd"), (r"(?<!\d)(\d{2})[-_ ]?(\d{2})[-_ ]?(\d{2})(?!\d)", "auto")]:
        m = re.search(rx, n)
        if not m: continue
        a, b, c = (int(g) for g in m.groups())
        if order == "ymd": y, mo, d = a, b, c
        else: y, mo, d = (1900 + a, b, c) if a > 12 else (1900 + c, a, b)
        if 1 <= mo <= 12 and 1 <= d <= 31 and 1925 <= y <= 1965: return f"{y}-{mo:02d}-{d:02d}"
    return ""

# ---------- 1. sources ----------
def find_sources(show, ep, cache):
    iso, rt = cat_iso(ep[1]), ep[2]
    name = show["name"]; flat = re.sub(r"[^a-z0-9]", "", name.lower())
    qs = [f'title:("{name}") AND mediatype:audio', f"identifier:*{flat}* AND mediatype:audio"]
    ids = set()
    for q in qs:
        u = "https://archive.org/advancedsearch.php?q=" + urllib.parse.quote(q) + "&fl%5B%5D=identifier&rows=400&output=json"
        ids |= {d["identifier"] for d in get_json(u)["response"]["docs"]}
    cands = [{"url": "https://archive.org/download/" + show["ids"][ep[3]] + "/" + ep[4], "item": show["ids"][ep[3]], "file": urllib.parse.unquote(ep[4]), "catalog": True}]
    def meta(ident):
        p = os.path.join(cache, "meta_" + re.sub(r"[^\w.-]", "_", ident) + ".json")
        try:
            if os.path.exists(p): return ident, json.load(open(p))
            md = get_json("https://archive.org/metadata/" + urllib.parse.quote(ident)); json.dump(md, open(p, "w")); return ident, md
        except Exception: return ident, {}
    from concurrent.futures import ThreadPoolExecutor, as_completed
    ex = ThreadPoolExecutor(6); futs = [ex.submit(meta, i) for i in sorted(ids)]
    for fu in as_completed(futs):
        ident, md = fu.result(); files = md.get("files", []); md = None
        for f in files:
            n = f["name"]; L = secs(f.get("length"))
            if not n.lower().endswith((".mp3", ".flac", ".wav", ".ogg")) or L < 120: continue
            if (file_iso(n) or file_iso(ident)) != iso or not (0.8 <= L / max(rt, 1) <= 1.25): continue
            u = "https://archive.org/download/" + urllib.parse.quote(ident) + "/" + urllib.parse.quote(n)
            if u.lower() != cands[0]["url"].lower(): cands.append({"url": u, "item": ident, "file": n, "kbps": round(int(f.get("size") or 0) * 8 / L / 1000)})
        fu._result = None; files = None
    ex.shutdown()
    cands[1:] = sorted(cands[1:], key=lambda c: -c.get("kbps", 0))[:8]     # measure at most 8 alternates
    return cands

def measure(url, cache):
    """Real bandwidth (kHz) and quiet-floor depth (dB) from ~45 s in the middle of the file."""
    p = os.path.join(cache, "seg_" + hashlib.md5(url.encode()).hexdigest())
    if not os.path.exists(p):
        req = urllib.request.Request(url, headers={**UA, "Range": "bytes=800000-3299999"})
        open(p, "wb").write(urllib.request.urlopen(req, timeout=90).read())
    x = decode(p, 44100, dur=45)
    if len(x) < 44100 * 10: return 0.0, 0.0
    n = 4096; w = np.hanning(n)
    P = 10 * np.log10(np.mean([np.abs(np.fft.rfft(x[i:i + n] * w)) ** 2 for i in range(0, len(x) - n, n // 2)], axis=0) + 1e-12)
    f = np.fft.rfftfreq(n, 1 / 44100); ref = np.mean(P[(f > 300) & (f < 3000)])
    bw = f[np.where(P > ref - 45)[0].max()] / 1000
    e = np.array([10 * np.log10(np.mean(x[i:i + 2048] ** 2) + 1e-12) for i in range(0, len(x) - 2048, 2048)])
    return round(float(bw), 1), round(float(np.median(e) - np.percentile(e, 5)), 1)

def pick_source(cands, cache):
    for c in cands:
        try: c["bw_khz"], c["floor_db"] = measure(c["url"], cache)
        except Exception as ex: c["bw_khz"], c["floor_db"], c["error"] = 0.0, 0.0, str(ex)[:80]
    ok = [c for c in cands if c["bw_khz"] > 0]
    return max(ok, key=lambda c: (round(c["bw_khz"] * 2) / 2, c["floor_db"])), cands   # bandwidth first (0.5 kHz steps), then quieter floor

# ---------- model helpers ----------
def chunked(fn, x, rate, win_s, ov_s=1.0):
    """Run fn(chunk)->(y, out_rate) over x in windows with a linear crossfade; keeps memory flat."""
    win, hop = int(win_s * rate), int((win_s - ov_s) * rate); out = None; ro = None; pos = 0
    for s in range(0, max(1, len(x)), hop):
        y, ro = fn(x[s:s + win], rate)
        if out is None: out = np.zeros(int(len(x) * ro / rate) + ro, np.float32); ov = int(ov_s * ro); fade = np.linspace(0, 1, ov, dtype=np.float32)
        o = int(s * ro / rate)
        if s > 0: y = y.copy(); y[:ov] *= fade; out[o:o + ov] *= (1 - fade)
        out[o:o + len(y)] += y[: len(out) - o]
        if s + win >= len(x): break
    return out[: int(len(x) * ro / rate)], ro

def via_file(model_call):
    def run(seg, rate):
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f: sf.write(f.name, seg, rate); p = f.name
        try: y, r = model_call(p)
        finally: os.unlink(p)
        y = np.asarray(y, np.float32); return (y.mean(axis=1) if y.ndim > 1 else y), r
    return run

def envelope(x, rate):
    h = rate // 10; return np.array([np.sqrt(np.mean(x[i:i + h] ** 2)) for i in range(0, len(x) - h, h)])

# ---------- per episode ----------
def restore(show, idx, ep, a, models):
    slug = re.sub(r"[^A-Za-z0-9]+", "", ep[0])
    base = f"{show['id']}_{cat_iso(ep[1]) or idx}_{slug}"
    wd = os.path.join(a.out, base); os.makedirs(wd, exist_ok=True); cache = os.path.join(a.out, "_cache"); os.makedirs(cache, exist_ok=True)
    rep = {"show": show["id"], "epIndex": idx, "title": ep[0], "date": ep[1], "catalog_runtime": ep[2], "pipeline": "demucs htdemucs + mossformer2 + apbwe", "started": time.strftime("%Y-%m-%d %H:%M")}
    log(f"[{base}] finding sources")
    best, cands = pick_source(find_sources(show, ep, cache), cache)
    rep["sources"] = cands; rep["chosen"] = best["url"]
    log(f"[{base}] best source {best['bw_khz']} kHz, floor {best['floor_db']} dB: {best['item']}/{best['file']}")
    src = os.path.join(wd, "source" + os.path.splitext(best["file"])[1].lower())
    if not os.path.exists(src): urllib.request.urlretrieve(best["url"], src)
    t0, dur = (None, None)
    if a.clip: t0, dur = (float(v) for v in a.clip.split(":"))
    x44 = decode(src, 44100, t0, dur); sf.write(os.path.join(wd, "src44.wav"), x44, 44100)

    log(f"[{base}] separating dialogue ({len(x44)/44100/60:.1f} min)")
    sep = os.path.join(wd, "sep")
    if not os.path.exists(os.path.join(sep, "htdemucs", "src44", "vocals.wav")):
        subprocess.run([sys.executable, "-m", "demucs", "--two-stems=vocals", "-n", "htdemucs", "-d", a.device, "-o", sep, os.path.join(wd, "src44.wav")], check=True)
    voc = decode(os.path.join(sep, "htdemucs", "src44", "vocals.wav"), 48000)
    rest = decode(os.path.join(sep, "htdemucs", "src44", "no_vocals.wav"), 48000)

    log(f"[{base}] dialogue: denoise"); dn, _ = chunked(via_file(models["denoise"].denoise), voc, 48000, 20); models.done("denoise")
    log(f"[{base}] dialogue: bandwidth extension"); bwe, _ = chunked(via_file(models["bwe"].upscale), dn, 48000, 10); models.done("bwe")
    with tempfile.TemporaryDirectory() as td:
        sf.write(os.path.join(td, "r.wav"), rest, 48000)
        ff("-i", os.path.join(td, "r.wav"), "-af", "adeclick,afftdn=nr=6:nf=-45", os.path.join(td, "rc.wav"))
        rest_c = decode(os.path.join(td, "rc.wav"), 48000)
    n = min(len(bwe), len(rest_c), len(voc))
    g = np.sqrt(np.mean(voc[:n] ** 2) / (np.mean(bwe[:n] ** 2) + 1e-12))
    mix = bwe[:n] * g + rest_c[:n]; mix /= max(1.0, float(np.abs(mix).max()) / 0.98)
    mixw = os.path.join(wd, "mix48.wav"); sf.write(mixw, mix, 48000)
    nice = re.sub(r'[\\/:*?"<>|]+', " ", f"{show['name']} {cat_iso(ep[1])} {ep[0]} (AI enhanced)").strip()
    final = os.path.join(wd, nice + ".mp3")     # date + spaced title: the harvest matcher keys on both
    ff("-i", mixw, "-af", "loudnorm=I=-18:TP=-1.5:LRA=11", "-ar", "48000", "-ac", "1", "-b:a", "128k",
       "-metadata", f"title={ep[0]} (AI enhanced)", "-metadata", f"artist={show['name']}", "-metadata", f"date={cat_iso(ep[1])}", final)

    log(f"[{base}] QA")
    s48 = decode(src, 48000, t0, dur)[:n]; o48 = decode(final, 48000)[:n]
    es, eo = envelope(s48, 48000), envelope(o48, 48000); m = min(len(es), len(eo))
    corr = float(np.corrcoef(np.log(es[:m] + 1e-6), np.log(eo[:m] + 1e-6))[0, 1])
    rep["qa"] = {"envelope_corr": round(corr, 3), "envelope_ok": corr > 0.75, "duration_s": round(n / 48000, 1)}
    off = max(0.0, n / 48000 / 2 - 22)                       # same 45 s window from the middle of both
    src_m = measure_file(src, (t0 or 0) + off); out_m = measure_file(final, off)
    rep["qa"]["bandwidth_khz"] = {"source": src_m[0], "output": out_m[0]}; rep["qa"]["floor_db"] = {"source": src_m[1], "output": out_m[1]}
    if models.get("asr"):
        ts, tw = transcribe(models["asr"], s48), transcribe(models["asr"], o48); models.done("asr")
        rep["qa"]["transcript_diff"] = word_diff(ts, tw)
        open(os.path.join(wd, "transcripts.txt"), "w").write("SOURCE\n" + " ".join(w for w, _ in ts) + "\n\nOUTPUT\n" + " ".join(w for w, _ in tw) + "\n")
    # 60 s A/B clips from the middle (loudness matched)
    mid = max(0, n / 48000 / 2 - 30)
    for tag, p in [("A_source", src), ("B_ai", final)]:
        ff("-ss", str((t0 or 0) + mid if tag == "A_source" else mid), "-i", p, "-t", "60", "-af", "loudnorm=I=-18:TP=-1.5", "-ac", "1", "-b:a", "128k", os.path.join(wd, f"clip_{tag}.mp3"))
    rep["output"] = final; rep["finished"] = time.strftime("%Y-%m-%d %H:%M")
    json.dump(rep, open(os.path.join(wd, "report.json"), "w"), indent=1)
    write_md(rep, os.path.join(wd, "report.md"))
    log(f"[{base}] done: envelope {corr:.2f}, bandwidth {src_m[0]} -> {out_m[0]} kHz, {len(rep['qa'].get('transcript_diff', {}).get('flags', []))} transcript flags")
    for f in ["src44.wav", "mix48.wav"]:
        try: os.remove(os.path.join(wd, f))
        except OSError: pass
    return rep

def measure_file(p, start):
    x = decode(p, 44100, start, 45)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f: sf.write(f.name, x, 44100); q = f.name
    try:
        n = 4096; w = np.hanning(n)
        P = 10 * np.log10(np.mean([np.abs(np.fft.rfft(x[i:i + n] * w)) ** 2 for i in range(0, len(x) - n, n // 2)], axis=0) + 1e-12)
        fr = np.fft.rfftfreq(n, 1 / 44100); ref = np.mean(P[(fr > 300) & (fr < 3000)])
        e = np.array([10 * np.log10(np.mean(x[i:i + 2048] ** 2) + 1e-12) for i in range(0, len(x) - 2048, 2048)])
        return round(float(fr[np.where(P > ref - 45)[0].max()] / 1000), 1), round(float(np.median(e) - np.percentile(e, 5)), 1)
    finally: os.unlink(q)

def transcribe(model, x48):
    x16 = np.interp(np.arange(0, len(x48), 3), np.arange(len(x48)), x48).astype(np.float32)
    segs, _ = model.transcribe(x16, beam_size=1, word_timestamps=True, vad_filter=True, condition_on_previous_text=False)
    return [(re.sub(r"[^a-z']", "", w.word.lower()), round(w.start, 1)) for s in segs for w in s.words if re.sub(r"[^a-z']", "", w.word.lower())]

def word_diff(ts, tw):
    a, b = [w for w, _ in ts], [w for w, _ in tw]; sm = difflib.SequenceMatcher(None, a, b, autojunk=False); flags = []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal": continue
        at = tw[j1][1] if j1 < len(tw) else (ts[i1][1] if i1 < len(ts) else 0)
        flags.append({"at_s": at, "source": " ".join(a[i1:i2]), "output": " ".join(b[j1:j2])})
    return {"agreement_pct": round(sm.ratio() * 100, 1), "flags": flags}

def write_md(rep, p):
    q = rep["qa"]; L = [f"# {rep['title']} ({rep['date']})", "", f"Source: {rep['chosen']}", "",
        f"- envelope correlation {q['envelope_corr']} ({'OK' if q['envelope_ok'] else 'BROKEN OUTPUT, do not publish'})",
        f"- bandwidth {q['bandwidth_khz']['source']} -> {q['bandwidth_khz']['output']} kHz, quiet floor {q['floor_db']['source']} -> {q['floor_db']['output']} dB"]
    td = q.get("transcript_diff")
    if td:
        L += [f"- transcript agreement {td['agreement_pct']}%  (listen at each flag; speech recognition itself can misfire, especially repeated words)", ""]
        L += [f"  - {int(f['at_s']//60)}:{int(f['at_s']%60):02d}  source: '{f['source']}'  ->  output: '{f['output']}'" for f in td["flags"][:60]]
    L += ["", "Candidates considered:"] + [f"- {c.get('bw_khz')} kHz / {c.get('floor_db')} dB  {c.get('kbps', '?')} kbps  {c['item']}/{c['file']}" for c in rep["sources"]]
    open(p, "w").write("\n".join(L) + "\n")

class Lazy:
    """Load each model on first use. On CPU boxes, unload it again after the step that used it."""
    def __init__(self, makers, keep): self.makers, self.keep, self.cache = makers, keep, {}
    def get(self, k, default=None):
        if k not in self.makers: return default
        if k not in self.cache: self.cache[k] = self.makers[k]()
        return self.cache[k]
    def __getitem__(self, k): return self.get(k)
    def done(self, k):
        if not self.keep: self.cache.pop(k, None); import gc; gc.collect()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--show", default="lights-out"); ap.add_argument("--episodes", default="1", help="comma list of catalog indexes, or 'all'")
    ap.add_argument("--out", default="otr_restore_out"); ap.add_argument("--device", default=None, help="cuda or cpu (auto)")
    ap.add_argument("--clip", default=None, help="START:DUR seconds, for quick trials"); ap.add_argument("--asr", default=None, help="faster-whisper model (default medium.en on GPU, base.en on CPU, 'none' to skip)")
    a = ap.parse_args()
    if a.device is None:
        try: import torch; a.device = "cuda" if torch.cuda.is_available() else "cpu"
        except ImportError: a.device = "cpu"
    cat = json.load(open(CATALOG)); show = next(s for s in cat["shows"] if s["id"] == a.show)
    idxs = range(len(show["eps"])) if a.episodes == "all" else [int(i) for i in a.episodes.split(",")]
    from audiosronnx import load_denoise, load_sr
    prov = ["CUDAExecutionProvider", "CPUExecutionProvider"] if a.device == "cuda" else None
    asr = a.asr or ("medium.en" if a.device == "cuda" else "base.en")
    def whisper():
        from faster_whisper import WhisperModel
        return WhisperModel(asr, device=a.device, compute_type="float16" if a.device == "cuda" else "int8")
    models = Lazy({"denoise": lambda: load_denoise("mossformer2", providers=prov), "bwe": lambda: load_sr("apbwe", providers=prov),
                   **({"asr": whisper} if asr != "none" else {})}, keep=(a.device == "cuda"))
    log(f"device {a.device}, asr {asr}, {len(list(idxs))} episode(s) -> {a.out}")
    os.makedirs(a.out, exist_ok=True); summary = []
    for i in idxs:
        try: summary.append(restore(show, i, show["eps"][i], a, models))
        except Exception as ex: log(f"episode {i} FAILED: {ex}"); summary.append({"epIndex": i, "error": str(ex)})
    json.dump(summary, open(os.path.join(a.out, "summary.json"), "w"), indent=1, default=str)

if __name__ == "__main__":
    main()
