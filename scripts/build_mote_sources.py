#!/usr/bin/env python3
"""Write Mote's three shipped sources.

Original audio for this project, dedicated CC0 in sources/README.md.
16-bit mono WAV, 44.1 kHz, about two seconds, peak under full scale.
"""
import math
import os
import struct
import wave

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "synth", "sources")


def write(name, samples):
    peak = max(1e-9, max(abs(x) for x in samples))
    scale = 0.89 / peak
    path = os.path.join(OUT, name)
    os.makedirs(OUT, exist_ok=True)
    with wave.open(path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = b"".join(struct.pack("<h", max(-32767, min(32767, int(x * scale * 32767)))) for x in samples)
        w.writeframes(frames)
    print(name, len(samples), "peak", round(peak, 4))


def glass():
    n = int(SR * 2.2)
    fs = [523.25, 659.25, 783.99, 1046.5]
    am = [0.46, 0.30, 0.22, 0.12]
    out = []
    for i in range(n):
        t = i / SR
        e = min(1.0, t / 0.012) * math.exp(-t * 1.15)
        y = 0.0
        for k in range(4):
            y += am[k] * math.sin(2 * math.pi * fs[k] * t)
        out.append(y * e)
    return out


def air():
    n = int(SR * 2.4)
    out = []
    lp = 0.0
    state = 0xA17C0DE
    for i in range(n):
        state = (state * 1664525 + 1013904223) & 0xFFFFFFFF
        noise = ((state >> 8) / 16777215.0) * 2 - 1
        lp += (noise - lp) * 0.035
        t = i / SR
        trem = 0.65 + 0.35 * math.sin(2 * math.pi * 0.27 * t)
        env = min(1.0, t / 0.08) * (0.85 + 0.15 * math.sin(2 * math.pi * 0.07 * t))
        out.append(lp * trem * env)
    return out


def bell():
    n = int(SR * 2.6)
    f0 = 392.0
    ratios = [1.0, 2.76, 5.40, 8.93]
    amps = [0.55, 0.28, 0.14, 0.07]
    decays = [1.6, 2.4, 3.3, 4.5]
    out = []
    for i in range(n):
        t = i / SR
        att = min(1.0, t / 0.004)
        y = 0.0
        for k in range(4):
            y += amps[k] * math.exp(-t * decays[k]) * math.sin(2 * math.pi * f0 * ratios[k] * t)
        out.append(y * att)
    return out


if __name__ == "__main__":
    write("glass.wav", glass())
    write("air.wav", air())
    write("bell.wav", bell())
