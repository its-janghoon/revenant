# Revenant: Lovable on your own AWS account, built in a day by a crew of Kiro agents

*DRAFT for the Kiroween 2026 Bonus Blog Prize. This post was written for Kiroween 2026, the
Kiro hackathon on Devpost, about our Frankenstein-category entry. Numbers marked TODO come
from the first real run on AWS and are filled in before publishing.*

## The problem

Hosted app builders are great until a company that runs everything on AWS tries to adopt one.
Two things go wrong. The bill is per seat, so it grows with the team. And to get the
convenience, the company hands its code, its data and a slice of its infrastructure to
another vendor, which means another security review, another place where data lives, and
another cloud to audit.

We wanted the same "say what you want, get a live app" experience, but inside the company's
own AWS account, on its own bill, spending its own AWS credits.

## What Revenant does

Revenant installs into your AWS account with one CloudFormation stack: three fields (a Kiro
API key, an admin email, a monthly budget). Invited users sign in with an email code and ask
for an app in plain words. Our demo request is:

> Build me a contract signing site where an AI flags toxic clauses before you sign.

Then:

1. **Kiro writes the spec first.** Requirements, design and tasks, plus which AWS parts the
   app needs and what it will cost per month. You edit the spec. Nothing is built until you
   press "Build it".
2. **Kiro CLI builds it in CodeBuild**, headless, in your account, one commit per task, into
   a CodeCommit repo you own. Each change gets an Amplify Gen 2 preview with its own data.
3. **You edit it like Lovable or v0.** Chat, or turn on Select and click any element in the
   preview to see its file and line, or open the Code tab and commit yourself.
4. **Publish** merges to `main` and deploys production. Anything that would replace or delete
   a resource waits for your approval.
5. **When a deploy dies, it fixes itself.** EventBridge catches the failure, a repair run reads
   the logs, states the cause in one sentence, fixes it on a `revenant/fix-<n>` branch, checks
   it and redeploys. Time to recover on our planted breaks: 342 s (missing env var, fixed by a
   rule), 478 s (retired Node 16 runtime) and 579 s (required field with no backfill).

Every generated app is a plain Amplify Gen 2 app. Uninstall Revenant and the apps keep running.

## Why Frankenstein

Revenant stitches together parts that were never meant to meet: a Lovable-style builder UI,
Kiro CLI running headless inside AWS CodeBuild, a CloudFormation installer, and a repair agent
wired to EventBridge. The joins were the hard part. The runner prints one log-line format that
the timeline parses back into events; the guardrail check reads the synthesized CloudFormation
and rejects `"Action": "*"`, data without retain or snapshot, and secrets in plain environment
variables before anything deploys.

## The haunted part

There is one switch in the header: Light or Haunted. Light is plain. Haunted borrows from
horror films instead of Halloween clip art: no purple, no orange, no ghosts. The screen goes
dark, a flashlight follows your cursor, rain and thunder are synthesized in the browser. When
a deploy dies, the app's heartbeat flatlines, lightning strikes close, and a tombstone settles
over the preview. The repair is a ritual. When it is fixed, the app has risen. A Calm option
keeps the look and drops every effect, and the theme never changes behaviour.

## How Kiro built it

Kiro shows up twice in Revenant: it is the engine inside every install, and it wrote the
repository.

**Spec first, for us too.** `.kiro/specs/revenant/` has 17 requirement sections in EARS style,
a design and a task list. On day one the project was renamed twice (BloodOath, Lazarus,
Revenant), moved from another cloud to all-AWS, and switched its default database. Each time
we edited the spec before any code, so the spec is the record of every decision.

**Steering kept a crowd consistent.** Four short steering files (`product`, `tech`,
`structure`, `git`) apply to every agent. `git.md` fixes the commit identity, the Kiro
co-author trailer and the push guard, so every parallel agent contributed to one clean history
without repeating those rules in every prompt.

**Kiro Crew ran the build as lanes.** `tasks.md` splits the work into lanes that each own
their folders: runner, deploy, data, repair, screens, admin, cost, the Kiro Crew app, the haunt
effects, docs. Each lane ran as a Kiro Crew subagent in its own git worktree and branch. The
parent session merged a lane only after reading its pushed branch, not its report. An hourly
Kiro Crew cron rebuilt our credits log from Kiro Crew's usage records, and Kiro Crew's
learned lessons carried rules from earlier mistakes into every agent (write the commit message
to a file first; check the remote after every push; never put a real email in a public repo).

**Property-based tests where they pay.** fast-check properties check the guardrail rules, the
change classifier (any replace or delete is destructive, additions never are), the data-model
guard and the runner log format round trip.

**Revenant is also a Kiro Crew app.** Its MCP tools let you say "build me X" in Kiro Crew chat,
and a monitor tells you when a build died and when it rose again.

By 17:36 KST on 2026-11-11, the first day, `develop` had 81 commits, and building it had used
531.24 Kiro credits (logged per turn in `docs/credits.md`).

## What is next

- The first end-to-end run on a dedicated AWS account: install, FinePrint built from the
  request, three planted breaks repaired. One FinePrint build: 13 tasks, 15 minutes, 18 Kiro
  credits; each repair run under 1 credit; recovery in 342-579 s.
- A judge install where each judge gets an account and their apps delete themselves after 24 hours.

Revenant is open source under MIT: https://github.com/its-janghoon/revenant

*Written for Kiroween 2026. #KiroweenHackathon26*
