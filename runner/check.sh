#!/usr/bin/env bash
# Deterministic checks before a push: install, lint, synth, cfn-lint, guard.
# Usage: bash runner/check.sh <app-repo-dir> <branch>
# Prints "RV-STEP <name>" before each step so the runner can name the failing one.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
cd "$1"
branch="$2"
out=.amplify/artifacts/cdk.out

echo "RV-STEP install"
if [ -f package-lock.json ]; then
  # Agents often add packages with an npm that writes a slightly different lock, and npm ci
  # then refuses ("not in sync"). Resync the lock only (no install); run.ts commits it.
  npm install --package-lock-only --no-audit --no-fund --ignore-scripts >/dev/null
  npm ci --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi

echo "RV-STEP lint"
# The frontend imports amplify_outputs.json, which only exists after a deploy.
[ -f amplify_outputs.json ] || echo '{"version":"1.4"}' > amplify_outputs.json
npm run lint --if-present

# DESIGN.md (the app's look) is checked with Google's linter. Warn only: a look never blocks a deploy.
if [ -f DESIGN.md ] && command -v designmd >/dev/null; then
  designmd lint DESIGN.md || echo "RV-WARN DESIGN.md has lint findings (not blocking)"
fi

echo "RV-STEP synth"
rm -rf "$out"
export RV_PROJECT_ID="${RV_PROJECT_ID:-unknown}"
# Synth as prod (main): the guard checks what prod would get, for example that data is retained.
# Preview stacks keep nothing on purpose (blocks/data), and nothing synthesized here is deployed.
npx cdk synth --quiet --no-notices \
  --app 'npx tsx amplify/backend.ts' \
  --context amplify-backend-namespace="${RV_AMPLIFY_APP_ID:-rv-$RV_APP}" \
  --context amplify-backend-name=main \
  --context amplify-backend-type=branch \
  --output "$out"

echo "RV-STEP cfnlint"
cfn-lint --non-zero-exit-code error -- "$out"/*.template.json

echo "RV-STEP guard"
basearg=()
git rev-parse -q --verify origin/main >/dev/null && basearg=(--base origin/main)
tsx "$here/guard.ts" --cdk-out "$out" --repo . "${basearg[@]}"
