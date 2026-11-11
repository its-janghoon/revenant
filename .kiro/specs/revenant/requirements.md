# Requirements: Revenant

## Introduction

Revenant is a self-hosted, Lovable-style app builder that runs in the user's own AWS
account. A Kiro agent turns a plain request into a spec, builds the app on Amplify Gen 2,
deploys it, and repairs failed builds and deploys by itself. Code lives in CodeCommit,
data in Aurora Postgres, everything in AWS. There are no seats; the user pays their own
AWS bill (and spends their AWS credits).

### In scope for Kiroween

One company installs Revenant into its own AWS account and uses it for its own apps,
plus one demo install for judges.

### Out of scope (documented only)

- Private dashboard in a VPC (`docs/self-host.md`).
- One AWS account per app, and one AWS account per customer for platforms that resell
  hosting ("Revenant for Platforms", `docs/platforms.md`).
- GitHub as the code host (CodeCommit only).

## Requirement 1: Install

**User story:** As a founder, I want Revenant in my own AWS account in one step, so that I own everything.

1. The README SHALL offer two equal ways to install: a CloudFormation quick-create link (one click) and a one-line command for AWS CloudShell. Both deploy the same template.
2. The install SHALL ask only for: a Kiro API key, an admin email, and a monthly budget. No GitHub token and no mail domain.
3. The install template SHALL create the Amplify app for Revenant from this public repository; the first Amplify build SHALL deploy Revenant's Amplify Gen 2 backend.
4. WHEN the install finishes THEN the output SHALL be the Revenant URL and the admin SHALL get a Cognito invite email (Cognito's own sender).
5. The install SHALL create an AWS Budgets alarm at the chosen monthly budget.
6. WHEN Revenant is uninstalled THEN every generated app SHALL keep running (separate Amplify apps, repos and databases).
7. The default install SHALL be public (Amplify Hosting, Cognito sign-in).
8. WHEN a user signs in for the first time THEN Revenant SHALL show one onboarding screen: pick Light or Haunted, and start from the FinePrint example or a blank prompt. Account, Kiro and budget checks run in the background and show as one line of ticks.
9. Sign-in SHALL use Amazon Cognito with an email one-time code (no password) and MAY offer passkeys. Users join by invite only.

## Requirement 2: Ask

**User story:** As a user, I want to say what I need in plain words, so that I don't write code.

1. The home screen SHALL show one prompt box, example requests, AWS credits left and this month's spend.
2. WHEN a user sends a request THEN Revenant SHALL create a project with an AWS CodeCommit repository.
3. The user MAY attach images or files (logo, a screenshot, a sample PDF) to the request.
4. Each user SHALL see only their own projects.

## Requirement 3: Spec first

**User story:** As a user, I want to see and change the plan before code, so that I get what I meant.

1. WHEN a project is created THEN the agent SHALL write `.kiro/specs/<app>/requirements.md`, `design.md` and `tasks.md` in the repo.
2. The spec screen SHALL show the three files as tabs with plain summaries on top and the raw markdown underneath.
3. The spec SHALL list the AWS parts the app will use and the estimated monthly cost.
4. WHEN the user edits the spec or asks for a change in chat THEN the agent SHALL update the spec files and show the diff.
5. Nothing SHALL be built until the user presses "Build it".

## Requirement 4: Build

**User story:** As a user, I want to watch the app being built, so that I trust it.

1. WHEN the user presses "Build it" THEN Revenant SHALL start a run of Kiro CLI headless in CodeBuild (ARM, medium) on the project repo, with the model the admin picked (default Auto).
2. WHILE a run is going THE workspace SHALL stream the agent's messages, the task list with each task's state, and changed files.
3. WHEN a task finishes THEN the agent SHALL commit it with the task number in the message.
4. WHEN the run finishes THEN the push SHALL start an Amplify preview build (Requirement 5) and the workspace SHALL show the preview.
5. WHILE a preview exists THE user MAY ask for changes in chat; each change SHALL run as a new build on a new commit.
6. The user SHALL be able to stop a run at any time; stopping keeps the commits made so far.

## Requirement 4b: Studio (edit like Lovable or v0)

**User story:** As a user, I want to change my app by talking, by clicking, or by editing code, so that I can work the way I like.

1. The workspace SHALL have a chat on the left and tabs on the right: Preview, Code, Spec, Data, Timeline.
2. Each agent reply SHALL show what it did as cards: a short plan, each file it changed with a diff, and the preview it deployed with time and credits.
3. In Preview, a **Select** mode SHALL let the user click an element; Revenant SHALL show the element and its source file and line, and offer "Edit with AI" plus quick style controls (text, color, size).
4. In Code, the user SHALL browse the repo, edit files, and commit to the current preview branch. The next agent run SHALL start from the user's commit.
5. The Code tab SHALL show the `git clone` command for the CodeCommit repo, so the user can also work locally.
6. Preview SHALL switch between desktop and mobile widths.

## Requirement 5: Deploy

**User story:** As a user, I want push-to-deploy on my own AWS, so that it feels like Vercel.

1. Every generated app SHALL be an Amplify Gen 2 app: frontend plus `amplify/backend.ts`. Anything Amplify does not cover SHALL be added in `backend.ts` as CDK.
2. The agent SHALL build the backend from Revenant's tested building blocks (`blocks/`); it SHALL NOT add other resources unless the spec says why.
3. Each change SHALL deploy to a preview branch with its own URL; "Publish" SHALL merge to `main` and deploy production.
4. Before a deploy, Revenant SHALL synthesize the backend and run the guardrail check (Requirement 10) on the synthesized templates.
5. IF the change replaces or deletes any resource THEN Revenant SHALL wait for the user's approval and show what would be lost.
6. WHEN a deploy succeeds THEN Revenant SHALL check the URL returns 2xx.
7. The user MAY add a custom domain; Revenant SHALL show the DNS records to add.

## Requirement 6: Data

**User story:** As a user, I want my app's data to stay correct while the agent keeps changing the app.

Revenant's own data:

1. Revenant SHALL keep its own records in Aurora Serverless v2 Postgres (minimum 0 ACU) with the Data API and Drizzle migrations. Its append-only timeline MAY live in Amplify Data for realtime.

Generated apps, default (**Amplify Data**):

2. A generated app SHALL use Amplify Data (DynamoDB through AppSync) and deploy nothing else for data.
3. Each Amplify branch SHALL get its own backend, so every preview has its own tables. The agent SHALL write a seed script that fills preview tables with sample data.
4. The agent SHALL NOT change a model's identifier (it replaces the table and loses data).
5. A new field SHALL be optional or come with a backfill function in the same commit.
6. Renaming or removing a field or model SHALL wait for the user's approval, with the number of records affected.

Generated apps, only WHERE the admin allows SQL (**Aurora Postgres**):

7. The app SHALL get Aurora Serverless v2 Postgres with the Data API from `blocks/db`, and Drizzle migrations in the same commit as every table change.
8. The app SHALL have a dev database and a prod database; each preview SHALL get its own database copied from dev (`CREATE DATABASE <app>_pv<n> TEMPLATE <app>_dev`) in one preview cluster per app.
9. WHEN the user presses Publish THEN Revenant SHALL show the SQL migration diff, take a prod snapshot, and only then apply it.
10. The runner SHALL reach dev and preview databases only; only the publish step SHALL write to prod.
11. A user SHALL be able to export the app's data with `pg_dump`.

Both:

12. There SHALL be no public database, no VPC Lambda and no NAT gateway.

## Requirement 7: Fix itself

**User story:** As a user, I want broken builds and deploys repaired for me, so that I never read AWS logs.

1. WHEN a Kiro run fails, an Amplify build fails, a backend deploy fails, or the health check fails THEN Revenant SHALL start a repair run.
2. The repair run SHALL collect the failing step's logs and the last commit's diff, and the agent SHALL state the cause in one plain sentence.
3. The agent SHALL fix the code, the backend or a migration on a branch `revenant/fix-<n>`, and check it with a build, a synth and the guardrail check.
4. WHEN the check passes THEN Revenant SHALL merge the fix and redeploy.
5. IF it fails THEN the agent SHALL retry with the new error, up to 3 runs per failure, then stop and show what it tried.
6. The agent SHALL never fix a failure by removing a check or test, weakening a guardrail, editing an applied migration, or deleting data.
7. Every repair SHALL appear in the timeline: cause, files changed, check result, outcome, time to recover.

## Requirement 8: Credits and cost

**User story:** As a founder, I want to see what my apps cost, so that I am never surprised.

1. The home screen SHALL show AWS credits left (when Cost Explorer reports credits), month-to-date spend and forecast.
2. Each project SHALL show its own month-to-date cost from its tags.
3. WHEN forecast spend passes the budget THEN Revenant SHALL warn on every screen.
4. Each run SHALL record the Kiro credits it used and whose Kiro paid; the timeline and the admin dashboard SHALL show them.
5. To save credits: a request that matches an example app SHALL copy that app's repo instead of building it again; new apps SHALL start from a starter template with `blocks/`; lint, synth, migrations and guardrail checks SHALL run as scripts, not as agent turns; common failures (for example a missing env var) SHALL be fixed by rules before calling the agent; steering files SHALL stay short; every run SHALL have a time limit.

## Requirement 9: Kiro Crew app

**User story:** As a Kiro Crew user, I want to build and deploy from chat.

1. The Crew app SHALL provide MCP tools `create_project(request)`, `build(project)`, `publish(project)`, `status(project)`.
2. WHEN the user says "build me X" in Kiro Crew THEN the crew agent SHALL create the project and return the spec link.
3. A Crew monitor SHALL notify the user when a build, deploy or repair finishes.
4. The Crew app SHALL provide a dashboard page listing projects with status and cost.

## Requirement 10: Guardrails

1. Data resources (databases, buckets) SHALL be retained or snapshotted on delete.
2. No IAM policy SHALL use `"Action": "*"`; `"Resource": "*"` only where AWS requires it, with a condition.
3. No secret SHALL be a plain parameter or env var; secrets live in Secrets Manager.
4. Each app's runner role SHALL reach only that app's repo, backend, dev and preview databases, and logs.
5. Every agent action SHALL be logged with project, run, time and outcome.

## Requirement 11: Clean AWS console

**User story:** As an AWS user, I want Revenant's resources out of my way, so that my console stays readable.

1. Revenant SHALL support installing into a dedicated AWS Organizations member account, and the README SHALL recommend it.
2. Each app SHALL get one AppRegistry application, and every resource of the app SHALL carry its `awsApplication` tag, so the console's myApplications shows the app with its cost.
3. Every resource name SHALL follow `rv-<app>-<prod|dev|pv<n>>`.
4. WHEN a preview branch is merged or closed, or 7 days pass, THEN Revenant SHALL delete the preview's database, Amplify branch and backend.

## Requirement 12: Theme

1. The header SHALL have one switch on every page: **Light** or **Haunted**. Light is the default.
2. The theme SHALL NOT follow the OS light/dark setting.
3. Light SHALL be a plain light UI with no effects. A failure shows a red state and a flat heartbeat only.
4. Haunted SHALL be dark with the Halloween words (died, ritual, risen, tombstone) and effects: a flashlight that follows the mouse (before any mouse move it lights the active area), film grain, flicker, a red flash and shake when a deploy dies, a glitch on the state word, a tombstone over the dead preview, and a light bloom when it rises.
5. Inside Haunted, a **Full / Calm** switch SHALL turn every effect off while keeping the dark look and words. Calm SHALL be on by default WHEN `prefers-reduced-motion` is set.
6. The app's health SHALL be drawn as a heartbeat line in both themes: beats while live, flat while dead.
7. Both choices SHALL be remembered per browser and rendered on first paint with no flash.
8. Text contrast SHALL meet WCAG AA in Light and in Haunted Calm.
9. Haunted Full SHALL include a storm: rain (picture and sound), random thunder (light first, sound 0.3-1 s later), blood dripping from the top of the screen and from the tombstone when a deploy dies, a weathered tombstone with soil, and dirt and grain on the screen.
10. Sound SHALL be made in the browser (no audio files), start muted, and play only after the user presses Sound.
11. When a deploy dies, Haunted Full SHALL play the scare, in this order:
    1. **Silence**: rain sound cuts to zero for about 1 s.
    2. **Delay**: the strike lands 2-4 s after the death, at a random moment.
    3. **Strike**: white, black, white flash, a big quake and a close thunder crack.
    4. **Silhouette**: a human shadow shows only during the 2 lightning frames, and is gone when the flashlight looks there.
    5. **Moved**: after the strike, the tombstone stands a little closer than before.
    6. **Breath**: a very quiet breath plays when the failure log line appears.
12. Lightning SHALL light the whole screen for its flash, past the flashlight.

## Requirement 13: Admin

**User story:** As the admin, I want to set the rules for everyone in one place.

1. Revenant SHALL have an admin dashboard at `/admin`, visible only to admins.
2. The admin SHALL be able to turn SQL databases (Aurora) on or off for the whole install, and per user. Default: off.
3. The admin SHALL be able to pick the Kiro model for runs. Default: **Auto**.
4. The admin SHALL choose who pays for Kiro: **company key** (one Kiro account for everyone), **bring your own Kiro** (each user connects their own Kiro account in Settings; their runs use their credits), or both (own key if connected, else company key).
5. A user's own Kiro key SHALL be stored in Secrets Manager under that user, used only for that user's runs, and removable by the user at any time.
6. The admin SHALL be able to set the monthly budget and an auto-delete period for apps (default: off).
7. The admin SHALL see every user, every app, and each app's AWS cost and Kiro credits, and SHALL be able to invite, disable or delete users and delete apps.
8. Every admin change SHALL be written to an audit log shown on the dashboard.

## Requirement 14: Demo install for judges

1. A demo Revenant SHALL run in a dedicated AWS account owned by Janghoon, installed with the same one-step install as customers.
2. FinePrint SHALL be built in advance on the demo install, so judges can open it at once; judges MAY also build their own app.
7. On the demo install, SQL SHALL be off, so judge apps use Amplify Data only.
3. Each judge SHALL get an account and see only their own projects.
4. Apps built by judges SHALL be deleted automatically 24 hours after creation (the admin auto-delete period).
5. The demo account SHALL have a Budgets alarm.
6. The demo install SHALL stay up until the results are announced (2027-02-04 KST) and SHALL then be deleted by removing its stacks.

## Requirement 15: Demo video

1. The video SHALL show the one-step install into a fresh AWS account within 30 seconds.
2. The demo SHALL build FinePrint from the request: "Build me a contract signing site where an AI flags toxic clauses before you sign." In Haunted mode FinePrint is subtitled "Blood Oath".
3. The demo SHALL include one real repair on a planted break and show the time to recover.
4. The video SHALL be under 3 minutes, show the differences from Lovable in the first 20 seconds, and contain no unlicensed trademarks or music. Storm sound is rendered by the app itself.
5. The storyboard SHALL be approved by Janghoon before rendering.

## Requirement 16: Submission

1. Revenant's own repository SHALL be public on GitHub with an OSI license in the About section, and `/.kiro` committed.
2. `docs/kiro-usage.md` SHALL cover Kiro CLI headless, Kiro Crew (subagents, crons, monitors, memory), specs, steering, hooks, MCP and property-based tests.
3. The judge account and demo URL SHALL be given in the private Devpost field.
