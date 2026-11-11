#!/usr/bin/env python3
"""Rebuild docs/credits.md: Kiro credits used per message for this project.

Reads Kiro Crew's per-turn usage records (~/.kiro/crew/usage/tokens/*.jsonl) for the
chat sessions listed in SLOTS. A turn is recorded when it ends, so the message running
right now shows up on the next run.

    python3 scripts/credits.py
"""
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

SLOTS = {"chat-180-1794367657"}  # Kiro Crew chat sessions that worked on BloodOath
START = "2026-11-11"  # first day of work on BloodOath
KST = timezone(timedelta(hours=9))

src = Path.home() / ".kiro/crew/usage/tokens"
rows = []
for shard in sorted(src.glob("*.jsonl")):
    if shard.stem < START:
        continue
    for line in shard.read_text(encoding="utf-8").splitlines():
        try:
            r = json.loads(line)
        except ValueError:
            continue
        if r.get("slot") in SLOTS and r.get("credits"):
            rows.append(r)

rows.sort(key=lambda r: r["ts"])
total = 0.0
out = [
    "# Kiro credits used",
    "",
    "One row per message to Kiro Crew. Rebuilt by `scripts/credits.py`.",
    "",
    "| # | Time (KST) | Model | Credits | Total | Duration |",
    "|---|---|---|---|---|---|",
]
for i, r in enumerate(rows, 1):
    total += r["credits"]
    ts = datetime.fromisoformat(r["ts"]).astimezone(KST).strftime("%Y-%m-%d %H:%M")
    secs = round((r.get("duration_ms") or 0) / 1000)
    out.append(f"| {i} | {ts} | {r.get('model', '')} | {r['credits']:.2f} | {total:.2f} | {secs}s |")
out += ["", f"**Total: {total:.2f} credits over {len(rows)} messages.**", ""]

dest = Path(__file__).resolve().parent.parent / "docs/credits.md"
dest.write_text("\n".join(out), encoding="utf-8")
print(f"{len(rows)} messages, {total:.2f} credits")
