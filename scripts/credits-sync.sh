#!/usr/bin/env bash
# Rebuild docs/credits.md and push it to develop when it changed.
# Run by a Kiro Crew cron (hourly), so credit use keeps adding up without a message.
cd /home/ubuntu/workplace/revenant || exit 1
[ "$(git branch --show-current)" = develop ] || { echo "not on develop, skipped"; exit 0; }
python3 scripts/credits.py || exit 1
git diff --quiet -- docs/credits.md && { echo "no change"; exit 0; }
git add docs/credits.md
git commit -q -m "docs: update credits log" -- docs/credits.md || exit 1
git push -q origin develop
