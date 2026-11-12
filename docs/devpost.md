# Devpost submission (Kiroween 2026)

Every field of the Devpost form, ready to paste. Placeholders in `ANGLE_CAPS` are filled in
after the AWS run; the judge URL and account go only in the private testing field.

## Project name

Revenant

## Elevator pitch (tagline, 200 characters max)

Lovable on your own AWS account. Kiro writes the spec, builds the app on Amplify Gen 2 in
your account, and fixes it when a deploy dies.

## Thumbnail and gallery

- Thumbnail: the Pulse logo on a rounded square (`design/mockups/logos.html`, option A)
- Gallery: `docs/img/light-03-home.jpg`, `light-04-spec.jpg`, `light-05-studio.jpg`,
  `light-06-code.jpg`, `haunted-07-repair.jpg`, `haunted-09-app.jpg`, `light-12-policy.jpg`
  (replace with screenshots of the real install after the AWS run)

## Video demo link

`VIDEO_URL` (YouTube, public, under 3 minutes; storyboard in `docs/storyboard.md`)

## Category

Frankenstein

## Bonus prizes

- Best Startup Project
- Best Kiro Crew App
- Bonus Blog Prize (post: `BLOG_URL`, draft in `docs/blog.md`)
- Social Blitz (posts: `SOCIAL_URL_1`, `SOCIAL_URL_2`, `SOCIAL_URL_3`, drafts in `docs/social.md`)

## Repository

https://github.com/its-janghoon/revenant (public, MIT in the About section, `/.kiro` committed)

## Try it out links

- Repository: https://github.com/its-janghoon/revenant
- Demo install: given in the private testing field below
- Kiro Crew app: https://github.com/its-janghoon/revenant/tree/develop/crew-app

## Built with

kiro, kiro-cli, kiro-crew, aws, aws-amplify, amplify-gen-2, aws-cloudformation, aws-cdk,
aws-codebuild, aws-codecommit, amazon-cognito, amazon-eventbridge, aws-lambda,
amazon-aurora, aws-secrets-manager, aws-cost-explorer, aws-resource-groups, next.js, react,
typescript, drizzle, zod, fast-check, python, mcp

## About the project

### Inspiration

Companies that run everything on AWS still pay per seat for hosted app builders, and hand
those vendors their code, data and infrastructure. That means a security review, a second
cloud to audit, and lock-in. We wanted the "say what you want, get a live app" experience
inside the company's own AWS account, on its own bill and its own AWS credits.

### What it does

Revenant is a self-hosted, open-source app builder that installs into your AWS account with
one CloudFormation stack (a Kiro API key, an admin email, a monthly budget).

- **Ask** in plain words. Revenant creates a CodeCommit repo for the project.
- **Spec first.** Kiro writes requirements, design and tasks, with the AWS parts and the
  estimated monthly cost. Nothing is built until you press "Build it".
- **Build.** Kiro CLI runs headless in CodeBuild, one commit per task. Every change gets an
  Amplify Gen 2 preview with its own URL and its own data.
- **Edit** like Lovable or v0: chat, Select any element in the preview to see its file and
  line, or edit and commit in the Code tab.
- **Publish** to production; a replace or delete waits for approval.
- **Fix itself.** When a run, build, deploy or health check fails, a repair run reads the
  logs, states the cause, fixes it on a branch, checks it and redeploys, up to 3 tries.
- **Admin policy**: SQL on or off, Kiro model (Auto by default), who pays for Kiro (company
  key, bring your own Kiro, or both), budget, auto-delete, all audited.
- **Light or Haunted.** Haunted is a horror-film theme: a flashlight, browser-made rain and
  thunder, a heartbeat that flatlines when a deploy dies and a tombstone over the preview
  until it rises. Calm turns the effects off. The theme never changes behaviour.

Every generated app is a plain Amplify Gen 2 app; uninstalling Revenant leaves it running.
Revenant also ships as a Kiro Crew app: "build me X" in Kiro Crew chat creates a project,
and a monitor reports when a build, deploy or repair finishes.

### How we built it

Spec first, with Kiro. `.kiro/specs/revenant/` (17 requirement sections in EARS style, a
design and a task list) came first, and every big change (two renames, a move to all-AWS, a
new default database) was a spec edit before any code. Four steering files kept every agent
on the same rules. Kiro Crew ran the build as parallel lanes: each lane a subagent in its own
git worktree and branch, owning its own folders, merged into `develop` only after the parent
read its pushed branch. An hourly Kiro Crew cron kept the Kiro credits log current.
Property-based tests (fast-check) cover the guardrail rules, the change classifier, the
data-model guard and the runner log format. Full write-up: `docs/kiro-usage.md`.

Inside Revenant, Kiro CLI is the engine: `kiro-cli chat --no-interactive` in CodeBuild, with
four modes (spec, build, change, repair) and Revenant's own steering copied into every app.

### Challenges we ran into

- Stitching parts that were never meant to meet: a builder UI, a headless agent in
  CodeBuild, a CloudFormation installer and EventBridge-driven repairs. One log-line format,
  shared through `lib/contracts.ts`, ties the runner to the timeline.
- Making a self-healing agent safe in a customer's account: guardrails reject `"Action": "*"`,
  data without retain or snapshot, and secrets in plain environment variables before deploy;
  destructive changes wait for a human.
- Keeping Kiro credit use low: checks run as scripts, common failures are fixed by rules
  before any agent runs, and limit hits never trigger a repair.

### Accomplishments that we're proud of

- A one-step install into a fresh AWS account, with no GitHub token and no mail domain.
- A repair loop with the cause, the fix and the time to recover on record.
  Time to recover on the planted breaks (FinePrint preview, 2026-11-11, measured from the
  failed deploy or check to the live redeploy):

  | Planted break | Fixed by | Time to recover | Kiro credits |
  |---|---|---|---|
  | Required env var `RV_APP` removed from the Amplify app | rule (no agent) | 342 s | 0 |
  | Lambda pinned to Node 16, a runtime AWS retired | Kiro repair run | 478 s | 0.9 |
  | Code tab commit adds a required field to an existing model with no backfill | guard stopped it before deploy, Kiro repair run made it optional | 579 s | 0.6 |

  The first FinePrint deploy also failed on its own (the seed step had no table access);
  repair found and fixed that unprompted in 847 s.
- A Haunted theme built from horror-film grammar instead of Halloween clip art.

### What we learned

Specs and steering scale better than prompts. With the rules in steering and the plan in
`tasks.md`, parallel agents produced one consistent codebase, and checking each lane's
pushed branch, not its report, caught the joins that did not fit.

### What's next for Revenant

- Generated-app hooks that run the guardrail check on save.
- More rule-based repairs, so fewer failures need an agent run.
- Hosting for outside customers (`docs/platforms.md`).

## Testing instructions (private field)

- Demo install: `JUDGE_URL` (for example `https://revenant.example.com`)
- Account: `JUDGE_EMAIL` with password `JUDGE_PASSWORD` (one account per judge). On the sign-in
  page press **Have a password? Sign in with it**. No email is needed.
- What to try:
  1. Open **Apps -> FinePrint** (prebuilt). Open its preview and the live URL.
  2. Open the **Timeline** tab to see a repaired deploy: the failure, the cause, the fix and
     the time to recover.
  3. Switch the header from **Light** to **Haunted** (turn Sound on for rain and thunder).
  4. Build your own: on Home, ask for a small app, read the spec, press **Build it**. A build
     takes about 15 minutes (FinePrint: 13 tasks, 15 minutes, 18 Kiro credits).
  5. In the studio, turn on **Select** and click an element to see its file and line.
- Limits on this install: SQL is off (Amplify Data only), you see only your own projects,
  and apps you build are deleted automatically 24 hours after creation.
- Self-install: README "Install", one CloudFormation stack in your own AWS account.
- Kiro Crew app: `crew-app/README.md` (needs a token from Settings -> Kiro Crew on the demo install).
