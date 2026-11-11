#!/usr/bin/env bash
# Block a push that would publish something dangerous. Revenant is open source.
# Usage: scripts/guard-push.sh [base]   (default base: origin/develop)
# Also runs as .git/hooks/pre-push.
base="${1:-origin/develop}"
git rev-parse --verify -q "$base" >/dev/null || base="$(git rev-list --max-parents=0 HEAD | tail -1)"
fail=0
say() { echo "guard-push: $*" >&2; fail=1; }

# 1. files that must never be committed
files=$(git diff --name-only --diff-filter=AM "$base"...HEAD)
echo "$files" | grep -E '(^|/)\.env($|\.)|\.pem$|\.p12$|\.key$|id_rsa|credentials$|\.tfstate$' | grep -v '\.env\.example$' | while read -r f; do say "secret-like file: $f"; done
[ -n "$(echo "$files" | grep -E '(^|/)\.env($|\.)|\.pem$|\.p12$|\.key$|id_rsa|credentials$|\.tfstate$' | grep -v '\.env\.example$')" ] && fail=1

# 2. secret-looking content in added lines
added=$(git diff "$base"...HEAD -U0 -- . ':(exclude)scripts/guard-push.sh' | grep -E '^\+[^+]' || true)
check() { echo "$added" | grep -nE -e "$1" >/dev/null && say "$2"; }
check 'AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}' "AWS access key id"
check 'aws_secret_access_key' "AWS secret key"
check 'BEGIN [A-Z ]*PRIVATE KEY' "private key"
check 'gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}' "GitHub token"
check 'sk-[A-Za-z0-9]{32,}|sk-ant-[A-Za-z0-9-]{20,}' "API key"
check 'xox[abpr]-[A-Za-z0-9-]{10,}' "Slack token"
# Private deny list (real emails, account ids, names) lives outside the repo, never committed:
# $(git rev-parse --git-common-dir)/guard-deny, one extended regex per line.
deny="$(git rev-parse --git-common-dir)/guard-deny"
if [ -f "$deny" ]; then
  while IFS= read -r pat; do
    [ -z "$pat" ] && continue
    echo "$added" | grep -qE -e "$pat" && say "matches a private deny pattern (see guard-deny)"
  done < "$deny"
fi

# 3. author and committer must be noreply
git log --format='%ae %ce' "$base"..HEAD | tr ' ' '\n' | sort -u | grep -v 'users.noreply.github.com$' | grep -v '^$' | while read -r e; do say "non-noreply author or committer: $e"; done
[ -n "$(git log --format='%ae %ce' "$base"..HEAD | tr ' ' '\n' | grep -v 'users.noreply.github.com$' | grep -v '^$')" ] && fail=1

[ "$fail" = 0 ] && echo "guard-push: ok" >&2
exit "$fail"
