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

ROOT = Path(__file__).resolve().parent.parent
SLOTS = {"chat-180-1794367657"}  # Kiro Crew chat sessions that worked on Revenant
# Subagent and other slots that worked on Revenant, one per line (added as they are spawned).
extra = ROOT / "docs/credit-slots.txt"
if extra.exists():
    SLOTS |= {l.strip() for l in extra.read_text().splitlines() if l.strip() and not l.startswith("#")}
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
    "One row per Kiro turn (chat message, loop cycle or subagent turn). Rebuilt by `scripts/credits.py`.",
    "",
    "| # | Time (KST) | Who | Model | Credits | Total | Duration |",
    "|---|---|---|---|---|---|---|",
]
for i, r in enumerate(rows, 1):
    total += r["credits"]
    ts = datetime.fromisoformat(r["ts"]).astimezone(KST).strftime("%Y-%m-%d %H:%M")
    secs = round((r.get("duration_ms") or 0) / 1000)
    who = "subagent" if r["slot"].startswith("subagent:") else "chat"
    out.append(f"| {i} | {ts} | {who} | {r.get('model', '')} | {r['credits']:.2f} | {total:.2f} | {secs}s |")
out += ["", f"**Total: {total:.2f} credits over {len(rows)} turns.**", ""]

dest = Path(__file__).resolve().parent.parent / "docs/credits.md"
dest.write_text("\n".join(out), encoding="utf-8")
print(f"{len(rows)} messages, {total:.2f} credits")
