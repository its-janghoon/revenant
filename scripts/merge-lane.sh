#!/usr/bin/env bash
# Merge one lane branch into the current branch with the repo's git rules.
#   scripts/merge-lane.sh feat/<lane>
set -u
lane="$1"
cd "$(git rev-parse --show-toplevel)" || exit 1
export GIT_AUTHOR_NAME="Janghoon Lee" GIT_AUTHOR_EMAIL=44862514+savagemanage@users.noreply.github.com
export GIT_COMMITTER_NAME="Janghoon Lee" GIT_COMMITTER_EMAIL=44862514+savagemanage@users.noreply.github.com
msg="$(git rev-parse --git-dir)/MERGE_LANE_MSG"
printf 'chore: merge %s into develop\n\nCo-authored-by: Kiro <noreply@kiro.dev>\n' "$lane" > "$msg"
git merge --no-ff --no-edit -F "$msg" "$lane"
