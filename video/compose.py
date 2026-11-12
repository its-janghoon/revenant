#!/usr/bin/env python3
"""Builds out/revenant-demo.mp4 from clips/*.webm (+ clips/*.audio0.webm, the app's own sound),
voice/*.mp3 and the plan below."""
import json, os, subprocess

D = os.path.dirname(os.path.abspath(__file__))
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
os.makedirs(f"{D}/out/seg", exist_ok=True)

def marks(c): return json.load(open(f"{D}/clips/{c}.json"))
def vlen(v): return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f"{D}/voice/{v}.mp3"]))

ACCT = "drawbox=x=16:y=754:w=170:h=26:color=white@1:t=fill,drawtext=fontfile=%s:text='acct 1111-2222-3333':x=20:y=760:fontsize=13:fontcolor=0x6c6c68" % MONO

# clip, start, end (mark name, seconds, or (mark, offset)), speed, voices [(name, at)], caption,
# options: clock (show real time), app (app sound volume, 0 = none), extra (filter at 1440x810)
PLAN = [
    ("intro", 0, "end", 1, [("v01", 1.2)], "", {}),
    ("install", "ready", "end", 1, [("v02", 0.6)], "Install: one CloudFormation stack", {}),
    ("ask", "ready", "end", 1, [("v03", 0.6)], "Ask in plain words", {}),
    ("spec", "ready", "end", 1, [("v04", 0.4)], "Spec first. Pick a look.", {}),
    ("studio", "ready", "end", 1, [("v05", 0.3)], "Click anything: see its file and line", {}),
    ("look", "ready", "end", 1, [("v06", 0.5)], "Restyle with a DESIGN.md", {}),
    ("code", "ready", 31.5, 1, [("v07", 8.0), ("v08", 18.6)], "Edit the code, commit", {}),
    # the planted break: wait (fast), the death (real time, the app's sound only), repair (fast), the rise
    ("death", "ready", ("dead", -3), "auto:6", [("v09a", 0.4)], "A planted break", {"clock": 1, "app": 0.15}),
    ("death", ("dead", -3), ("dead", 9), 1, [], "", {"app": 0.4}),
    ("death", ("dead", 9), ("rose", -2), "auto:7", [("v09b", 0.3)], "Revenant repairs it", {"clock": 1, "app": 0.15}),
    ("death", ("rose", -2), "end", 1, [("v10", 3.0)], "It has risen: 6m 9s to recover, 0 Kiro credits", {"app": 0.3}),
    ("admin", "ready", "end", 1, [("v11", 0.4)], "One policy. Every change audited.", {"extra": ACCT}),
    ("outro", 0, "end", 1, [("v12", 0.5)], "", {}),
]

def esc(t): return t.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\u2019")

def at(m, x):
    if isinstance(x, tuple): return m[x[0]] + x[1]
    return m[x] if isinstance(x, str) else x

segs, clock0 = [], {}
for i, (clip, a, b, speed, voices, cap, o) in enumerate(PLAN):
    m = marks(clip)
    s, e = at(m, a), at(m, b)
    if b == "end": e -= 0.3
    if isinstance(speed, str):  # auto:N = fit into N seconds
        speed = max(1.0, (e - s) / float(speed.split(":")[1]))
    vdur = (e - s) / speed
    need = max([t + vlen(v) + 0.7 for v, t in voices] or [0])
    dur = max(vdur, need)
    f = []
    if o.get("extra"): f.append(o["extra"])
    f.append(f"setpts=(PTS-STARTPTS)/{speed:.4f}")
    f.append("scale=1920:1080:flags=lanczos,fps=30")
    if dur > vdur: f.append(f"tpad=stop_mode=clone:stop_duration={dur - vdur + 0.1:.2f}")
    if o.get("clock"):
        # Real elapsed time since the break was planted, so the fast parts never look faster than they were.
        base = s - m.get("planted", s)
        f.append("drawbox=x=1560:y=36:w=330:h=96:color=black@0.6:t=fill")
        f.append(f"drawtext=fontfile={MONO}:text='real time %{{eif\\:trunc(({base:.1f}+t*{speed:.3f})/60)\\:d}}m %{{eif\\:mod(trunc({base:.1f}+t*{speed:.3f})\\,60)\\:d\\:2}}s':x=1580:y=52:fontsize=30:fontcolor=white")
        f.append(f"drawtext=fontfile={FONT}:text='{speed:.0f}x faster':x=1580:y=94:fontsize=22:fontcolor=white@0.8")
    if cap:
        f.append("drawbox=x=0:y=968:w=1920:h=80:color=black@0.62:t=fill")
        f.append(f"drawtext=fontfile={FONT}:text='{esc(cap)}':x=(w-text_w)/2:y=990:fontsize=38:fontcolor=white")
    f.append("format=yuv420p")

    inputs = ["-ss", f"{s:.3f}", "-to", f"{e:.3f}", "-i", f"{D}/clips/{clip}.webm"]
    labels, k = [], 1
    for v, t in voices:
        inputs += ["-i", f"{D}/voice/{v}.mp3"]
        labels.append(f"[{k}:a]adelay={int(t*1000)}|{int(t*1000)},aformat=sample_rates=48000:channel_layouts=stereo[a{k}];")
        k += 1
    app = o.get("app", 0)
    afile = f"{D}/clips/{clip}.audio0.wav"  # decoded once; the webm has a bad packet that can stall amix
    if app and os.path.exists(afile) and m.get("audio"):
        # The app's sound at real speed from the segment start (fast parts get the ambience, not a chipmunk).
        off = s - m["audio"][0]
        lead = max(0.0, -off)
        inputs += ["-ss", f"{max(0.0, off):.3f}", "-i", afile]
        labels.append(f"[{k}:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay={int(lead*1000)}|{int(lead*1000)},volume={app}[a{k}];")
        k += 1
    n = k - 1
    if n:
        mix = "".join(labels) + "".join(f"[a{j}]" for j in range(1, k)) + f"amix=inputs={n}:normalize=0,apad,atrim=0:{dur:.3f}[a]"
    else:
        mix = f"anullsrc=r=48000:cl=stereo,atrim=0:{dur:.3f}[a]"
    out = f"{D}/out/seg/{i:02d}-{clip}.mp4"
    cmd = ["ffmpeg", "-nostdin", "-v", "error", "-y", *inputs, "-filter_complex", f"[0:v]{','.join(f)},trim=0:{dur:.3f}[v];{mix}",
           "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", out]
    subprocess.run(cmd, check=True, stdin=subprocess.DEVNULL, timeout=300)
    segs.append(out)
    print(f"{i:02d} {clip:8s} {dur:6.2f}s  speed {speed:.1f}")

with open(f"{D}/out/list.txt", "w") as fh:
    for p in segs: fh.write(f"file '{p}'\n")
raw = f"{D}/out/raw.mp4"
subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", f"{D}/out/list.txt", "-c", "copy", raw], check=True)
final = f"{D}/out/revenant-demo.mp4"
subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", raw, "-c:v", "copy", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-movflags", "+faststart", final], check=True)
print("total", subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", final]).decode().strip())
