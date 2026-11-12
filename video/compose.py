#!/usr/bin/env python3
"""Builds out/revenant-demo.mp4 from clips/*.webm, voice/*.mp3 and the plan below."""
import json, os, subprocess

D = os.path.dirname(os.path.abspath(__file__))
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
os.makedirs(f"{D}/out/seg", exist_ok=True)

def marks(c): return json.load(open(f"{D}/clips/{c}.json"))
def vlen(v): return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f"{D}/voice/{v}.mp3"]))

# (clip, start mark or seconds, end mark or seconds, speed, [(voice, at seconds)], caption, extra filter at 1440 size)
ACCT = "drawbox=x=16:y=754:w=170:h=26:color=white@1:t=fill,drawtext=fontfile=%s:text='acct 1111-2222-3333':x=20:y=760:fontsize=13:fontcolor=0x6c6c68" % MONO
PLAN = [
    ("intro", 0, "end", 1, [("v01", 1.2)], "", ""),
    ("install", "ready", "end", 1, [("v02", 0.3)], "Install: one CloudFormation stack", ""),
    ("ask", "ready", "end", 1, [("v03", 0.6)], "Ask in plain words", ""),
    ("spec", "ready", "end", 1, [("v04", 0.4)], "Spec first. Pick a look.", ""),
    ("studio", "ready", "end", 1, [("v05", 0.3)], "Click anything: see its file and line", ""),
    ("look", "ready", "end", 1, [("v06", 0.5)], "Restyle with a DESIGN.md", ""),
    ("code", "ready", 31.5, 1, [("v07", 8.0), ("v08", 18.6)], "Edit the code, commit", ""),
    ("death", "planted", "end", 70, [("v09", 0.4)], "A planted break: the deploy dies, Revenant fixes it", "clock"),
    ("tl", "ready", "end", 1, [("v10", 0.6)], "It has risen: 5m 58s to recover, 0 Kiro credits", ""),
    ("admin", "ready", "end", 1, [("v11", 0.4)], "One policy. Every change audited.", ACCT),
    ("outro", 0, "end", 1, [("v12", 0.5)], "", ""),
]

def esc(t): return t.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\u2019")

segs = []
for i, (clip, a, b, speed, voices, cap, extra) in enumerate(PLAN):
    m = marks(clip)
    s = m[a] if isinstance(a, str) else a
    e = m[b] if isinstance(b, str) else b
    if b == "end": e -= 0.3
    vdur = (e - s) / speed
    need = max(at + vlen(v) + 0.7 for v, at in voices)
    dur = max(vdur, need)
    f = []
    if extra and extra != "clock": f.append(extra)
    f.append(f"setpts=(PTS-STARTPTS)/{speed}")
    f.append("scale=1920:1080:flags=lanczos,fps=30")
    if dur > vdur: f.append(f"tpad=stop_mode=clone:stop_duration={dur - vdur + 0.1:.2f}")
    if extra == "clock":
        # Real elapsed time, so the sped-up part never looks faster than it was.
        f.append("drawbox=x=1580:y=36:w=300:h=64:color=black@0.6:t=fill")
        f.append(f"drawtext=fontfile={MONO}:text='real time %{{eif\\:trunc(t*{speed}/60)\\:d}}m %{{eif\\:mod(trunc(t*{speed})\\,60)\\:d\\:2}}s':x=1600:y=52:fontsize=30:fontcolor=white")
        f.append(f"drawtext=fontfile={FONT}:text='x{speed}':x=1800:y=110:fontsize=22:fontcolor=white@0.8")
    if cap:
        f.append("drawbox=x=0:y=968:w=1920:h=80:color=black@0.62:t=fill")
        f.append(f"drawtext=fontfile={FONT}:text='{esc(cap)}':x=(w-text_w)/2:y=990:fontsize=38:fontcolor=white")
    f.append("format=yuv420p")
    out = f"{D}/out/seg/{i:02d}-{clip}.mp4"
    cmd = ["ffmpeg", "-v", "error", "-y", "-ss", f"{s:.3f}", "-to", f"{e:.3f}", "-i", f"{D}/clips/{clip}.webm"]
    for v, _ in voices: cmd += ["-i", f"{D}/voice/{v}.mp3"]
    mix = "".join(f"[{k+1}:a]adelay={int(at*1000)}|{int(at*1000)},aformat=sample_rates=48000:channel_layouts=stereo[a{k}];" for k, (v, at) in enumerate(voices))
    mix += "".join(f"[a{k}]" for k in range(len(voices))) + f"amix=inputs={len(voices)}:normalize=0,apad,atrim=0:{dur:.3f}[a]"
    cmd += ["-filter_complex", f"[0:v]{','.join(f)},trim=0:{dur:.3f}[v];{mix}", "-map", "[v]", "-map", "[a]",
            "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", out]
    subprocess.run(cmd, check=True)
    segs.append(out)
    print(f"{i:02d} {clip:8s} {dur:6.2f}s")

with open(f"{D}/out/list.txt", "w") as fh:
    for p in segs: fh.write(f"file '{p}'\n")
final = f"{D}/out/revenant-demo.mp4"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", f"{D}/out/list.txt", "-c", "copy", "-movflags", "+faststart", final], check=True)
print("total", subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", final]).decode().strip())
