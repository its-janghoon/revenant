# Design: Revenant

## Overview

```
          user's AWS account (everything below runs here, on their credits)
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ Revenant app (Amplify + Aurora)                                          │
 │   ask -> spec -> build -> preview -> publish        timeline / cost      │
 │      |        ^            |                              ^              │
 │      v        |            v                              |              │
 │ CodeBuild runner: kiro-cli headless on the project repo ---+ (logs)       │
 │      |                                                                    │
 │      v                                                                    │
 │ project repo (GitHub) -> CloudFormation stack per app -> Amplify branch   │
 │                                  | fail                                   │
 │                                  v                                        │
 │                     EventBridge -> repair run (runner again)              │
 └──────────────────────────────────────────────────────────────────────────┘
 Kiro Crew app (MCP) -> Revenant API
```

## Install stack (`infra/install.yaml`)

Amplify app (Revenant itself, from this public repo), Aurora Serverless v2 with Data
API, Secrets Manager entries (Kiro API key, GitHub token, app key), the CodeBuild runner
project and its ECR image, EventBridge rules for failure events, a Budgets alarm, and
IAM roles (compute, build, runner). The current `infra/stack.yaml` becomes the first
set of building blocks under `blocks/`.

## Runner (`runner/`)

- Image: Node LTS, git, AWS CLI, `cfn-lint`, Kiro CLI.
- Inputs (env): `PROJECT_ID`, `REPO`, `BRANCH`, `MODE` (`spec`, `build`, `change`, `repair`),
  `PROMPT_S3_KEY`. Secrets read at start from Secrets Manager.
- Steps: clone -> copy `steering/` into the repo's `.kiro/steering/` (kept in git) ->
  `kiro-cli chat --no-interactive` with the mode prompt -> push -> report.
- Each mode is a prompt file in `runner/prompts/`: `spec.md`, `build.md`, `change.md`,
  `repair.md`. The repair prompt includes the collected logs and the cause template.
- Output lines go to CloudWatch with a JSON prefix for structured events
  (`task_started`, `task_done`, `file_changed`, `message`), which the UI streams.

## Generated app steering (`steering/`)

Tells Kiro how Revenant apps are built: Next.js on Amplify, Drizzle on the Data API, S3
presigned URLs, SES, Bedrock, use only `blocks/`, guardrails, commit per task.

## Building blocks (`blocks/`)

| Block | Resources |
|---|---|
| `hosting` | Amplify app + branch, compute role |
| `db` | Aurora Serverless v2 (min 0), Data API, managed secret |
| `files` | S3 private bucket, CORS for presigned upload |
| `mail` | SES identity, DKIM outputs |
| `ai` | Bedrock invoke permissions on the compute role |
| `cron` | EventBridge rule -> API destination with generated key |

The agent copies the blocks it needs into the app's `infra/stack.yaml`. `cfn-lint` and
the guardrail check (`lib/guard.ts`) run on every stack before deploy.

## Deploy

Step Functions: create change set -> classify (add/update vs replace/delete) -> wait for
approval if needed -> execute -> wait -> start Amplify job -> health check -> record.

## Repair

EventBridge rules on CloudFormation `Stack Status Change` (failed), Amplify job state
`FAILED`, CodeBuild build `FAILED`, plus the health check, start a repair run with the
gathered logs. Max 3 runs per failure; each run is a runner job in `repair` mode.

## Cost

A daily job reads Cost Explorer `GetCostAndUsage` grouped by the `revenant:project` tag,
with `RecordType` filters for Usage and Credit, and caches the result. The home screen
also shows `GetCostForecast`.

## Data

| Table | Key columns |
|---|---|
| `projects` | id, name, request, repo, stack_name, prod_url, status, created_at |
| `runs` | id, project_id, mode, commit, codebuild_id, status, started_at, ended_at |
| `tasks` | id, project_id, number, title, state |
| `deploys` | id, project_id, branch, commit, change_set, status, url |
| `repairs` | id, deploy_id or run_id, attempt, cause, branch, check_status, outcome, recovered_s |
| `events` | id, project_id, at, kind, text (timeline) |
| `costs` | project_id, day, usage_usd, credit_usd |

## UI

Routes: `/` (ask + credits), `/p/:id/spec`, `/p/:id` (workspace: chat and tasks on the
left, preview on the right, deploy status on top), `/p/:id/timeline`, `/settings`.

Themes: `data-mode="light|haunted"` and `data-calm="on|off"` on `<html>`, CSS variables
per mode, a head script sets both before first paint, one copy map for words. Effects
(flashlight, grain, flash, flicker, shake, glitch) live in one module that does nothing in
Light or Calm. Reference: `design/mockups/live.html`.

## Testing

Property-based tests (fast-check) where they pay:
- Guardrail check: any stack with `"Action": "*"` or a data resource without a deletion
  policy is rejected.
- Change set classifier: any replace or delete is marked destructive.
- Event parser: any runner log line round-trips to the same structured event.
