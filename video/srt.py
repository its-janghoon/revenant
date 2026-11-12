#!/usr/bin/env python3
"""Writes out/revenant-demo.ko.srt and .en.srt from the compose plan, the segment lengths and the voice lengths."""
import json, os, re, subprocess, importlib.util

D = os.path.dirname(os.path.abspath(__file__))
src = open(f"{D}/compose.py").read().split("segs, clock0 = [], {}")[0]  # plan and helpers only
ns = {"__file__": f"{D}/compose.py"}
exec(compile(src, "compose", "exec"), ns)
PLAN, vlen = ns["PLAN"], ns["vlen"]

def dur(p): return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p]))
segs = sorted(f for f in os.listdir(f"{D}/out/seg") if re.match(r"\d\d-", f))
segs = [f"{D}/out/seg/{f}" for f in segs if int(f[:2]) < len(PLAN) and f[3:-4] == PLAN[int(f[:2])][0]]
assert len(segs) == len(PLAN), (len(segs), len(PLAN))

ko = json.load(open(f"{D}/ko.json"))
en = json.load(open(f"{D}/lines.json"))

def ts(t):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

def split_en(t): return [x.strip() for x in re.split(r"(?<=[.!?:])\s+", t) if x.strip()]

for lang, lines in (("ko", ko), ("en", {k: split_en(v) for k, v in en.items()})):
    out, n, start = [], 0, 0.0
    for (clip, a, b, speed, voices, cap, o), seg in zip(PLAN, segs):
        for v, at in voices:
            parts, L = lines[v], vlen(v)
            total = sum(len(p) for p in parts)
            t = start + at
            for p in parts:
                d = L * len(p) / total
                n += 1
                out.append(f"{n}\n{ts(t)} --> {ts(t + d - 0.05)}\n{p}\n")
                t += d
        start += dur(seg)
    open(f"{D}/out/revenant-demo.{lang}.srt", "w").write("\n".join(out))
    print(lang, n, "cues, ends", ts(start))
