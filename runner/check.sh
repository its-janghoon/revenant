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
  npm ci --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi

echo "RV-STEP lint"
# The frontend imports amplify_outputs.json, which only exists after a deploy.
[ -f amplify_outputs.json ] || echo '{"version":"1.4"}' > amplify_outputs.json
npm run lint --if-present

echo "RV-STEP synth"
rm -rf "$out"
# blocks/tags.ts needs the AppRegistry ARN on a branch synth. Runs before the first deploy have
# none yet; a placeholder is fine because this output is only checked, never deployed.
export RV_AWS_APPLICATION="${RV_AWS_APPLICATION:-arn:aws:servicecatalog:${AWS_REGION:-us-east-1}:111122223333:/applications/synth-only}"
export RV_PROJECT_ID="${RV_PROJECT_ID:-unknown}"
name="$(printf '%s' "$branch" | tr -c 'A-Za-z0-9-' '-')"
npx cdk synth --quiet --no-notices \
  --app 'npx tsx amplify/backend.ts' \
  --context amplify-backend-namespace="${RV_AMPLIFY_APP_ID:-rv-$RV_APP}" \
  --context amplify-backend-name="$name" \
  --context amplify-backend-type=branch \
  --output "$out"

echo "RV-STEP cfnlint"
cfn-lint --non-zero-exit-code error -- "$out"/*.template.json

echo "RV-STEP guard"
basearg=()
git rev-parse -q --verify origin/main >/dev/null && basearg=(--base origin/main)
tsx "$here/guard.ts" --cdk-out "$out" --repo . "${basearg[@]}"
