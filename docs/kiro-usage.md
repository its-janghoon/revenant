# How we used Kiro

DRAFT for the Devpost "How we used Kiro" section. Facts come from this repository's git
history and `docs/credits.md`. Parts marked *planned* are in the spec but not built yet;
they are rewritten from the real run before submission.

## Two Kiros, two jobs

Revenant uses Kiro twice:

1. **Kiro builds Revenant.** The whole repository, from the first spec to the screens, is
   written by Kiro agents orchestrated by Kiro Crew.
2. **Kiro is Revenant's engine.** Every app a user asks for is specced, built and repaired
   by Kiro CLI running headless inside the user's own AWS account.

## Kiro CLI headless in CodeBuild (the engine)

*Planned (lane L1, `runner/`).* A shared CodeBuild project (ARM, medium) runs
`kiro-cli chat --no-interactive` on the app's CodeCommit repo. One run per mode:

| Mode | What the agent does |
|---|---|
| `spec` | Turns the request into `.kiro/specs/<app>/requirements.md`, `design.md`, `tasks.md` |
| `build` | Works the task list, one commit per task with the task number |
| `change` | Applies a chat request or a Select edit on the preview branch |
| `repair` | Reads the failing step's logs and the last diff, states the cause in one sentence, fixes it on `revenant/fix-<n>` |

Before each run the runner copies Revenant's generated-app steering (`steering/`) into the
repo's `.kiro/steering/`, so every app follows the same rules: Amplify Gen 2, only the
tested building blocks in `blocks/`, Amplify Data by default, never change a model
identifier, migrations in the same commit when SQL is allowed. The model is the one the
admin picked, **Auto** by default. Each run records the Kiro credits it used and whose Kiro
paid (company key or the user's own key).

Lint, synth, migrations and the guardrail check run as scripts, not agent turns, so a
run spends credits only on the parts that need the agent.

## Kiro Crew (how Revenant itself was built)

- **Parallel lane subagents.** `tasks.md` splits the build into wave 0 (skeleton, one
  worker) and nine wave-1 lanes (runner, deploy, data, repair, screens, admin, cost and
  console, crew app, haunt), plus a docs lane. Each lane is a Kiro Crew subagent with
  its own git worktree, its own branch `feat/<lane>` and its own folders, so lanes never
  edit the same file. One shared brief tells every lane the commit, push and safety rules.
- **Monitor loop.** The parent session watches the lanes, reads each lane's pushed branch
  (not its claimed result), and merges a lane into `develop` when its "done when" holds.
- **Hourly credits cron.** A Kiro Crew cron runs `scripts/credits-sync.sh` every hour. It
  rebuilds `docs/credits.md` from Kiro Crew's per-turn usage records with
  `scripts/credits.py` and pushes it, so the credit log keeps up even when nobody sends a
  message. Subagent slots that count toward Revenant are listed in `docs/credit-slots.txt`.
- **Memory and learned lessons.** Kiro Crew keeps lessons from past mistakes across
  sessions and injects them into every agent. Rules this repo relies on came from there:
  write the commit message to a file before `git commit -F`, never batch commit and push,
  check `git ls-remote` after a push, never put real emails or account ids in a public
  repo.
- **Crew app.** *Planned (lane L7, `crew-app/`).* Revenant ships as a Kiro Crew app: MCP
  tools `create_project`, `build`, `publish`, `status`, a monitor that reports when a
  build, deploy or repair finishes, and a dashboard page of projects with status and cost.

## Specs

Revenant's spec lives in `.kiro/specs/revenant/`: 16 requirements in EARS style
(`WHEN ... THEN ... SHALL`), a design with the architecture, tables and test plan, and a
task list split into waves and lanes. The spec changed many times on the first day
(rename from BloodOath to Lazarus to Revenant, Vercel and Neon to all-AWS, Aurora to
Amplify Data by default). Each change was a spec edit first and a commit with a `docs:`
subject, never a long prompt history. Revenant does the same for its users: the spec
screen shows the three files, and nothing is built until the user presses "Build it".

## Steering

`.kiro/steering/` holds four short files, all `inclusion: always`:

| File | What it fixes |
|---|---|
| `product.md` | Whose problem, the four differences from Lovable, the demo story, the theme rules (no purple, orange or ghost icons) |
| `tech.md` | The stack table and rules: IAM roles only, Secrets Manager only, zod at every route, `prefers-reduced-motion` |
| `structure.md` | Where each folder's code goes |
| `git.md` | Commit identity, the Kiro co-author trailer, the push guard, the Pulse logo |

Steering kept nine parallel agents consistent without repeating the rules in every prompt.
Revenant's own generated-app steering (`steering/`) is kept short on purpose, because it
is sent on every run and costs credits.

## Hooks

- `scripts/guard-push.sh` runs before every push (and as the git `pre-push` hook). It
  blocks secret-like files, AWS keys, private keys, GitHub and API tokens, non-noreply
  authors, and a private deny list kept outside the repo.
- *Planned:* Kiro hooks for the generated apps (a hook that runs the guardrail check on
  save of `amplify/backend.ts`). Written up from what is built.

## MCP

- Kiro Crew's own MCP tools drive the build: subagents, crons, monitors, memory.
- *Planned:* Revenant's Crew app exposes Revenant itself as MCP tools, so "build me X" in
  Kiro Crew creates a Revenant project and reports back with the spec link.

## Property-based tests

*Planned (fast-check), from the design's test plan:*

| Property | Requirement |
|---|---|
| Any template with `"Action": "*"`, or a data resource without retain or snapshot, is rejected | 10.1, 10.2 |
| Any replace or delete is marked destructive | 5.5 |
| Any runner log line round-trips to the same structured event | 4.2 |
| A commit that changes the Drizzle schema without a new migration is rejected | 6.7 |

What each property caught is added here after the tests run.

## Log

One row per notable use. Times in KST, from the commit dates.

| Date (KST) | Tool | What it did |
|---|---|---|
| 2026-11-11 12:40 | Kiro Crew | Read the Kiroween 2026 rules, picked the Frankenstein category and bonus prizes, created this repo, wrote the steering files and the first spec (BloodOath) |
| 2026-11-11 12:45 | Kiro Crew | Wrote one CloudFormation stack for all AWS services and `scripts/credits.py` for the per-message credits log |
| 2026-11-11 13:04 | Kiro Crew | Respecced as Lazarus, a self-healing deploy tool with a toggleable Halloween theme |
| 2026-11-11 13:10 | Kiro Crew | Renamed to Revenant; added the hourly credits sync |
| 2026-11-11 13:15-13:38 | Kiro Crew | Three theme mockups, then the respec as a Lovable-style builder on your own AWS, and a live animated mockup |
| 2026-11-11 13:51-14:47 | Kiro Crew | One Light/Haunted switch with Calm, flashlight, storm with browser-made rain and thunder sound, the 6-step scare |
| 2026-11-11 14:49-15:35 | Kiro Crew | Spec decisions: CodeCommit, Cognito, FinePrint demo app, Amplify Gen 2, preview databases, clean console, platforms note |
| 2026-11-11 15:54-16:07 | Kiro Crew | Amplify Data by default with SQL opt-in, admin dashboard, Kiro Auto, credit savings, full screen flow, email-code sign-in, bring your own Kiro |
| 2026-11-11 16:16 | Kiro Crew | Git rules, push guard, Pulse logo; credits log per turn |
| 2026-11-11 16:19 | Kiro Crew | Wave 1 started: lane subagents in parallel worktrees, each on `feat/<lane>` |

Kiro credits so far: 289.34 over 38 main-chat turns, up to 2026-11-11 16:08 KST
(`docs/credits.md`; subagent turns are added as their slots are listed).
