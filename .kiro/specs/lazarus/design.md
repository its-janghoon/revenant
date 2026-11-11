# Design: Lazarus

## Overview

```
GitHub push --> Lazarus API --> change set --> CloudFormation (user's account)
                    |                               |
                    |                    Amplify build / app health
                    |                               | fail
                    +<-------- repair run <---------+
                    |   logs -> cause -> fix branch -> CodeBuild check -> PR -> redeploy
                    v
              timeline UI  /  Kiro Crew app (MCP)
```

Lazarus runs as a second Next.js app in this repo (`apps/lazarus`), deployed by its own
stack the same way. BloodOath moves to `apps/sign`. Shared theme and UI in `packages/ui`.

## Parts

| Part | Where | What |
|---|---|---|
| Connect stack | `lazarus/connect.yaml` | IAM role with external id, Budgets alarm |
| GitHub App | Lazarus API | webhooks for push and PR merge, repo read, branch and PR write |
| Detector | `lazarus/detect.ts` | reads `package.json`, `next.config.*`, `process.env.*` uses, imports (`@aws-sdk/*`, `drizzle-orm`, `pdf-lib`...) |
| Stack writer | agent + templates | starts from tested building blocks (hosting, db, files, mail, ai, cron), agent fills and joins them |
| Deployer | Step Functions | change set -> approve if destructive -> execute -> wait -> Amplify job -> health check |
| Watcher | EventBridge | stack status changes and Amplify job state changes trigger a repair run |
| Repair agent | CodeBuild job | clone, read logs, fix, build, validate, push branch, open PR |
| Timeline | Lazarus UI | server-sent events from a `events` table |

## Repair agent

Runs in CodeBuild in Lazarus's own account, with a short-lived session into the user's
role (read logs only) and a GitHub token scoped to the repo.

Loop (max 3 runs per failure, max 20 tool calls per run):

1. **Gather.** Failed stack events (`describe-stack-events`), Amplify job log, the last 200
   CloudWatch lines of the app, the diff of the commit that broke it.
2. **Diagnose.** Bedrock (Claude) with tools: `read_file`, `grep`, `list_files`,
   `aws_docs_search`. Output: cause (one sentence), files to change.
3. **Fix.** `write_file` on a branch. Guardrail check (Requirement 7) runs on the result;
   a violation sends the run back to step 2 with the reason.
4. **Check.** `npm ci && npm run build`; for stack changes `cfn-lint` and
   `validate-template`. Fail -> back to step 2 with the new error.
5. **Ship.** PR with cause, diff and check log. Auto-merge if the repo allows it.

Kiro CLI is the preferred engine for steps 2-4 if it can run headless in CodeBuild with
our steering; otherwise the Bedrock tool loop above. Decide in task 2.1.

## Data

| Table | Key columns |
|---|---|
| `accounts` | id, user_id, aws_account_id, role_arn, external_id, budget_usd |
| `projects` | id, account_id, repo, branch, stack_name, app_url, auto_merge |
| `deploys` | id, project_id, commit, change_set, status, started_at, ended_at |
| `repairs` | id, deploy_id, attempt, cause, branch, pr_url, check_status, outcome |
| `events` | id, deploy_id, at, kind, text (timeline) |

## Planted breaks for the demo

| Break | Expected repair |
|---|---|
| Remove `REVIEW_MODEL` from the stack env vars | Add it back with the default model id |
| `EngineVersion: "13.4"` (no auto-pause) | Bump to a version that supports MinCapacity 0 |
| Migration with a typo in a column type | Fix the migration SQL |
