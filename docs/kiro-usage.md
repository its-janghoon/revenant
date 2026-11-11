# How we used Kiro

Text for the Devpost "How we used Kiro" section. Every fact comes from this repository:
the git history, `.kiro/`, `docs/credits.md` and the code. Slots marked **TODO (AWS run)**
need numbers that only the first real run on AWS can give; nothing is estimated in their place.

## Two Kiros, two jobs

Revenant uses Kiro twice:

1. **Kiro built Revenant.** The whole repository, from the first spec to the screens, was
   written by Kiro agents orchestrated by Kiro Crew.
2. **Kiro is Revenant's engine.** Every app a user asks for is specced, built, changed and
   repaired by Kiro CLI running headless inside the user's own AWS account.

## Spec-driven development

Revenant's spec lives in `.kiro/specs/revenant/`:

- `requirements.md`: 17 requirement sections (1 to 16, plus 4b for the studio) in EARS
  style (`WHEN ... THEN ... SHALL`), from install to the Devpost submission itself.
- `design.md`: architecture, tables, the runner, repair, guardrails and the test plan.
- `tasks.md`: the build split into wave 0 (skeleton), wave 1 (nine parallel lanes, each with
  the folders it owns and a "done when"), wave 2 (integration on AWS) and wave 3 (submission).

The spec changed many times on the first day: the project was renamed from BloodOath to
Lazarus to Revenant, moved from Vercel and Neon to all-AWS, and switched from Aurora to
Amplify Data by default with SQL as an admin opt-in. Each change was a spec edit with a
`docs:` commit before any code changed, so the spec, not a long prompt history, is the
record of what was decided.

Revenant does the same for its users. The first Kiro run on a new app writes
`.kiro/specs/<app>/` (requirements, design, tasks, with the AWS parts and an estimated
monthly cost). The spec screen shows the three files, and nothing is built until the user
presses "Build it". The build run then works the task list with one commit per task.

## Steering

`.kiro/steering/` holds four short files, all `inclusion: always`:

| File | What it fixes |
|---|---|
| `product.md` | Whose problem, the four differences from Lovable, the demo story, theme rules (no purple, orange or ghost icons), hackathon rules |
| `tech.md` | The stack and its rules: IAM roles only, Secrets Manager only, zod at every route, `prefers-reduced-motion` |
| `structure.md` | Which folder each kind of code goes in |
| `git.md` | Commit identity set per command, the `Co-authored-by: Kiro` trailer, conventional subjects, the push guard, branch rules, the Pulse logo |

`git.md` mattered most for parallel work: every lane agent committed with the same identity
and trailer, pushed only its own `feat/<lane>` branch, and ran the push guard first, without
those rules being repeated in each prompt.

Revenant ships a second steering set, `steering/` (`revenant.md`, `aws.md`, `data.md`), that
the runner copies into every generated app's `.kiro/steering/` before each run: Amplify Gen 2
only, only the tested building blocks in `blocks/`, Amplify Data by default, never change a
model identifier, a migration in the same commit when SQL is allowed. It is kept short on
purpose, because it is sent on every run and costs credits.

## Kiro CLI headless (the engine)

`runner/` is one CodeBuild run of Kiro CLI on one app repo. It clones from CodeCommit (or
starts from `templates/starter`), copies `steering/` in, runs
`kiro-cli chat --v3 --no-interactive` with a mode prompt from `runner/prompts/`, runs the
checks as scripts, and pushes.

| Mode | What the agent does |
|---|---|
| `spec` | Turns the request into `.kiro/specs/<app>/requirements.md`, `design.md`, `tasks.md` |
| `build` | Works the task list, one commit per task with the task number |
| `change` | Applies a chat request, a Select edit or a Code-tab commit on the preview branch |
| `repair` | Reads the failing step's logs and the last diff, states the cause in one sentence, fixes it on `revenant/fix-<n>` |

Ways it saves Kiro credits:

- Install, lint, synth, cfn-lint and the guardrail check run in `runner/check.sh`, not as
  agent turns.
- `lib/repair/rules.ts` fixes common failures (a missing environment variable, a missing
  Amplify secret) before any agent runs, at no Kiro cost.
- A time or credits limit stops a run with exit code 3, and a stopped run never starts a repair.
- The model is the admin's choice, **Auto** by default, and each run records the credits it
  used and whose Kiro paid (the company key or the user's own key).

Results from the real run:

- Kiro credits per FinePrint run (spec, build, repair): **TODO (AWS run)**
- Time to recover for each of the three planted breaks: **TODO (AWS run)**

## Kiro Crew (how Revenant itself was built)

- **Lanes as parallel subagents.** Each lane in `tasks.md` (runner, deploy, data, repair,
  screens, admin, cost and console, crew app, haunt, plus docs and wiring) ran as a Kiro Crew
  subagent in its own git worktree on its own `feat/<lane>` branch, and owned its own folders,
  so no two lanes edited the same file. One shared brief gave every lane the commit, push and
  safety rules. Shared types lived in one file, `lib/contracts.ts`, written by wave 0 first.
- **Loops in batches.** Batch 1 built the skeleton, runner, crew app, haunt and docs. Batch 2
  built the remaining lanes on top. Batch 3 had every lane read the merged code and make it
  consistent: every import resolves, every route in `lib/contracts.ts` has one handler.
- **Merging by evidence.** The parent session read each lane's pushed branch, not its claimed
  result, and merged it into `develop` with `scripts/merge-lane.sh` when its "done when" held.
  Several `fix:` commits on 2026-11-11 came from this cross-reading (one runner line format,
  repair connected to deploy, task numbers as text).
- **Hourly credits cron.** A Kiro Crew cron runs `scripts/credits-sync.sh` every hour. It
  rebuilds `docs/credits.md` from Kiro Crew's per-turn usage records with `scripts/credits.py`
  and pushes it, so the log keeps up without anyone sending a message. Subagent slots that
  count toward Revenant are listed in `docs/credit-slots.txt`.
- **Learned lessons.** Kiro Crew keeps lessons from past mistakes and injects them into every
  agent. Rules this repo relies on came from there: write the commit message to a file before
  `git commit -F`, never run commit and push in one batch, check `git ls-remote` after a push,
  never put real emails or account ids in a public repo.
- **A Kiro Crew app.** `crew-app/` ships Revenant as a Kiro Crew app: an MCP server with
  `create_project`, `build`, `publish` and `status`, a no-model script cron
  (`revenant-monitor`, every 60 s) that sends a notification when a build, deploy or repair
  finishes, a `revenant` agent and skill, and a dashboard page listing every project with its
  status and cost.

## MCP

- Kiro Crew's own MCP tools drove the build: subagents, crons, memory and lessons.
- `crew-app/mcp/server.py` exposes Revenant itself as MCP tools, so "build me X" in Kiro Crew
  chat creates a Revenant project and answers with the spec link. It calls the
  `/api/crew/*` routes with a token made under Settings -> Kiro Crew.

## Hooks

- `scripts/guard-push.sh` runs before every push, by hand and as the git `pre-push` hook. It
  blocks secret-like files, AWS keys, private keys, GitHub, API and Slack tokens, non-noreply
  commit authors, and a private deny list kept outside the repository.
- No Kiro IDE hooks (`.kiro/hooks/`) are used; agents ran headless in Kiro CLI and Kiro Crew.

## Property-based tests

Written with fast-check and `node:test`, from the design's test plan:

| File | Properties |
|---|---|
| `lib/guard/rules.test.ts` | Templates with no bad resource pass; any `Allow` with `"Action": "*"` is rejected; `"Resource": "*"` needs a condition unless AWS requires it; any data resource without retain or snapshot is rejected; a secret in a plain env var or parameter is rejected |
| `lib/guard/classify.test.ts` | Identical templates have no changes; any replace or delete is marked destructive and nothing else is; every removed resource or stack is a destructive delete; additions alone are never destructive |
| `lib/guard/model.test.ts` | The schema parser reads back what was written; changing an existing model's identifier is rejected; a new required field needs a backfill; removing a field or model needs approval |
| `lib/timeline/line.test.ts` | Any runner log line round-trips through `formatLine` and `parseLine`; it is found after a CloudWatch timestamp; other output is skipped |

The fourth property in the design (a Drizzle schema change without a migration is rejected)
is not written yet. The tests run once at integration; what they caught: **TODO (AWS run)**.

## Log

One row per notable use. Times in KST, from the commit dates.

| Date (KST) | Tool | What it did |
|---|---|---|
| 2026-11-11 12:40 | Kiro Crew | Read the Kiroween 2026 rules, picked the Frankenstein category and bonus prizes, created this repo, wrote the steering files and the first spec (BloodOath) |
| 2026-11-11 12:45 | Kiro Crew | Wrote one CloudFormation stack for all AWS services and `scripts/credits.py` for the per-turn credits log |
| 2026-11-11 13:04 | Kiro Crew | Respecced as Lazarus, a self-healing deploy tool with a toggleable Halloween theme |
| 2026-11-11 13:10 | Kiro Crew | Renamed to Revenant; added the hourly credits cron |
| 2026-11-11 13:15-13:38 | Kiro Crew | Three theme mockups, the respec as a Lovable-style builder on your own AWS, a live animated mockup |
| 2026-11-11 13:51-14:47 | Kiro Crew | One Light/Haunted switch with Calm, flashlight, browser-made rain and thunder, the 6-step scare |
| 2026-11-11 14:49-15:35 | Kiro Crew | Spec decisions: CodeCommit, Cognito, the FinePrint demo app, Amplify Gen 2, preview databases, clean console |
| 2026-11-11 15:54-16:07 | Kiro Crew | Amplify Data by default with SQL opt-in, admin dashboard, Kiro Auto, the full screen flow, email-code sign-in, bring your own Kiro |
| 2026-11-11 16:16 | Kiro Crew | `git.md` steering, push guard, Pulse logo |
| 2026-11-11 16:19-16:59 | Kiro Crew subagents | Batch 1 in parallel worktrees: Amplify Gen 2 skeleton and `lib/contracts.ts`, runner with headless Kiro CLI, building blocks and generated-app steering, Kiro Crew app, haunt effects, docs; merged into `develop` at 16:59 |
| 2026-11-11 17:00-17:16 | Kiro Crew subagents | Batch 2: AppRegistry and naming, timeline writer, cost, cleanup, data, admin, repair loop, API routes; merged at 17:14-17:16 |
| 2026-11-11 17:17-17:36 | Kiro Crew subagents | Screens, deploy flow, guardrail check and change classifier, property tests, studio with Select and Code, publish and cost screens; cross-lane fixes; merged at 17:22 and 17:34 |
| 2026-11-11 17:41 | Kiro Crew subagents | Batch 3: lanes read the merged code for consistency; submission docs (this file, README, blog, social, Devpost, storyboard) |
| TODO (AWS run) | Kiro CLI | First install on a dedicated AWS account, FinePrint built end to end, three planted breaks repaired |

At 2026-11-11 17:36 KST, `develop` had 81 commits, all from that day. Kiro credits used to
build Revenant up to 2026-11-11 17:03 KST: 531.24 over 50 turns (`docs/credits.md`, which
the hourly cron keeps current).
