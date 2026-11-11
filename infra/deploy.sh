#!/usr/bin/env bash
# Create or update every AWS resource BloodOath needs, then start the first Amplify build.
#
#   GITHUB_TOKEN=... MAIL_FROM=oath@example.com ./infra/deploy.sh [region] [stack-name]
#
# Needs: AWS CLI v2 with credentials for the target account.
set -euo pipefail

REGION="${1:-us-east-1}"
STACK="${2:-blood-oath}"
: "${GITHUB_TOKEN:?set GITHUB_TOKEN (repo read access)}"
: "${MAIL_FROM:?set MAIL_FROM, for example oath@example.com}"

cd "$(dirname "$0")"

aws cloudformation deploy \
  --region "$REGION" \
  --stack-name "$STACK" \
  --template-file stack.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides "GitHubToken=$GITHUB_TOKEN" "MailFrom=$MAIL_FROM"

APP_ID=$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='AppId'].OutputValue" --output text)

aws amplify start-job --region "$REGION" --app-id "$APP_ID" --branch-name main --job-type RELEASE >/dev/null

aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query "Stacks[0].Outputs" --output table
