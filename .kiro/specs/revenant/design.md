# Design: Revenant

## Overview

```
 AWS account (ideally a dedicated member account)
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │ Revenant (Amplify Gen 2: Next.js + Cognito + Aurora/Data API + timeline DDB) │
 │   ask -> spec -> build -> preview -> publish       timeline / cost           │
 │      |                     ^                            ^                    │
 │      v                     |                            | events             │
 │ CodeBuild runner: kiro-cli headless on the app repo ----+                    │
 │      | push                                                                  │
 │      v                                                                       │
 │ app repo (CodeCommit) -> app's Amplify Gen 2 (frontend + backend.ts)         │
 │                            |  main = prod, preview/<n> = previews            │
 │                            |  Aurora: <app>_prod | <app>_dev | <app>_pv<n>   │
 │                            v fail                                            │
 │                 EventBridge -> repair run (runner, mode=repair)              │
 └──────────────────────────────────────────────────────────────────────────────┘
 Kiro Crew app (MCP) -> Revenant API
```

## Install

`infra/install.yaml` (plain CloudFormation, so a quick-create link works):
- IAM roles for Amplify (service and compute) and the runner.
- Secrets Manager: Kiro API key (from the parameter), app key (generated).
- Amplify app for Revenant, source = this public repository, branch `main`.
- Budgets alarm, admin email as output target.

The first Amplify build runs `npx ampx pipeline-deploy` and creates Revenant's backend
(`amplify/backend.ts`): Cognito, the Aurora cluster with Data API, the timeline table,
the CodeBuild runner project, EventBridge rules, and the AppRegistry application.
To verify in task 0.5: whether a first Gen 2 deploy in a fresh account bootstraps CDK by
itself, or the install template must do it.

CloudShell one-liner (same template):
`aws cloudformation deploy --template-url <url> --stack-name revenant --capabilities CAPABILITY_IAM --parameter-overrides KiroApiKey=... AdminEmail=... Budget=...`

## Kiro keys

`settings.kiro_mode` is `company`, `own` or `both`. Company key: one Secrets Manager
secret. Own keys: `rv/kiro/<user_id>` secrets, written from Settings, read only by the
runner role for runs started by that user (the run passes the secret ARN; the runner
role's policy allows `rv/kiro/*` with a tag condition matching the run's owner).

## Studio

Select mode injects a small script into preview builds only (`NEXT_PUBLIC_RV_INSPECT`)
that maps clicked elements to `file:line` using React dev source info, and posts it to
the parent frame. Code tab reads and writes through the CodeCommit API
(`GetFile`, `CreateCommit`) on the preview branch.

## Runner (`runner/`)

- Image: Node LTS, git with the CodeCommit credential helper, AWS CLI, `cfn-lint`, Kiro CLI.
- Inputs: `PROJECT_ID`, `REPO`, `BRANCH`, `MODE` (`spec`, `build`, `change`, `repair`), `PROMPT_S3_KEY`.
- Steps: clone -> copy `steering/` into the repo's `.kiro/steering/` -> `kiro-cli chat --no-interactive`
  with the mode prompt -> `npx ampx` synth + guardrail check -> push -> report.
- Output lines go to CloudWatch with a JSON prefix (`task_started`, `task_done`,
  `file_changed`, `message`); a log subscription writes them to the timeline table.
- One runner role per app (Requirement 10.4), assumed by the shared CodeBuild project.

## Generated app steering (`steering/`)

How Revenant apps are built: Next.js on Amplify Gen 2, Drizzle on the Data API,
migrations in the same commit, never edit an applied migration, use only `blocks/`,
guardrails, commit per task, names `rv-<app>-<env>`, `awsApplication` tag.

## Building blocks (`blocks/`)

TypeScript functions the agent calls from `backend.ts`:

| Block | Adds |
|---|---|
| `data` | Amplify Data models and a seed script (default) |
| `db` | only when SQL is allowed: Aurora Serverless v2 (min 0), Data API, `<app>_prod` and `<app>_dev`, preview cluster with `<app>_pv<n>` databases |
| `files` | S3 private bucket, presigned upload |
| `mail` | SES sender identity (sandbox, verified address) |
| `ai` | Bedrock invoke permission on the compute role |
| `cron` | EventBridge schedule -> function |
| `tags` | AppRegistry application + `awsApplication` and `revenant:*` tags on everything |

## Deploy

Amplify branch per preview (`preview/<n>`), `main` for production. Before Amplify picks
up a push, the runner has already run synth and the guardrail check (`lib/guard.ts`) on
`.amplify/artifacts/cdk.out`. A diff of the synthesized templates against the deployed
ones classifies the change; replace or delete waits for approval in the UI.

Publish: show the Drizzle migration SQL -> create prod snapshot -> merge to `main` ->
Amplify runs migrations against `<app>_prod` -> health check.

## Repair

EventBridge rules on Amplify job `FAILED`, CloudFormation stack failures from the Gen 2
deploy, and CodeBuild `FAILED`, plus the health check, start a repair run with the
gathered logs. Max 3 runs per failure.

## Data

Generated apps use Amplify Data by default (DynamoDB per branch, so previews are isolated
for free; a seed script fills them). The guardrail check also diffs `amplify/data/resource.ts`
against `main`: an identifier change is rejected, a required new field without a backfill is
rejected, a rename or removal needs approval. Aurora (`blocks/db`) is added only when the
admin allows SQL for the owner.

Revenant's own tables (Drizzle, Aurora):

| Table | Key columns |
|---|---|
| `projects` | id, owner, name, request, repo, amplify_app_id, prod_url, status, created_at, expires_at |
| `runs` | id, project_id, mode, model, kiro_payer, commit, codebuild_id, status, credits, started_at, ended_at |
| `tasks` | id, project_id, number, title, state |
| `deploys` | id, project_id, branch, commit, status, url |
| `repairs` | id, deploy_id or run_id, attempt, cause, branch, check_status, outcome, recovered_s |
| `previews` | id, project_id, branch, db_name, created_at, deleted_at |
| `costs` | project_id, day, usage_usd, credit_usd |
| `settings` | key, value, updated_by, updated_at (sql_allowed, model, kiro_mode, budget_usd, credits_per_build, auto_delete_hours) |
| `user_policies` | user_id, sql_allowed |
| `audit` | id, actor, action, detail, at |

Timeline (Amplify Data, DynamoDB, append-only, realtime): `event(project_id, at, kind, text)`.

`projects.expires_at` is set for judge projects on the demo install (24 h).

## Cleanup

A daily function deletes previews whose branch is merged or closed or older than 7 days
(drop database, delete Amplify branch and its backend), and expired judge projects.

## Cost

A daily job reads Cost Explorer `GetCostAndUsage` grouped by the `revenant:project` tag,
with `RecordType` filters for Usage and Credit; the home screen also shows `GetCostForecast`.

## UI

Routes: `/welcome` (onboarding), `/` (ask + credits), `/p/:id/spec`, `/p/:id` (workspace:
chat and tasks on the left, preview on the right, heartbeat on top), `/p/:id/timeline`,
`/p/:id/publish`, `/p/:id/app` (live app: URL, domain, cost), `/cost`, `/settings`, and admin:
`/admin`, `/admin/users`, `/admin/apps`, `/admin/policy`, `/admin/audit`. Screens: `design/mockups/flow.html`.

Themes: `data-mode="light|haunted"`, `data-calm="on|off"`, `data-snd="on|off"` on
`<html>`, a head script sets them before first paint, one copy map for words. Effects and
sound live in `lib/haunt/` and do nothing in Light or Calm. Reference:
`design/mockups/live.html` and `design/mockups/haunt.js`.

## Testing

Property-based tests (fast-check) where they pay:
- Guardrail check: any template with `"Action": "*"` or a data resource without retain or snapshot is rejected.
- Change classifier: any replace or delete is marked destructive.
- Event parser: any runner log line round-trips to the same structured event.
- Migration check: a commit that changes the Drizzle schema without a new migration is rejected.
