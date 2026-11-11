# Requirements: Revenant

## Introduction

Revenant is a self-hosted, Lovable-style app builder that runs in the user's own AWS
account. A Kiro agent turns a plain request into a spec, builds the app, deploys it with
CloudFormation, and repairs failed builds and deploys by itself. Costs come out of the
user's AWS credits.

## Requirement 1: Install

**User story:** As a startup founder, I want Revenant in my own AWS account in one click, so that I own everything and spend my credits.

1. The README SHALL offer a CloudFormation quick-create link that installs Revenant.
2. The install stack SHALL ask only for: a Kiro API key, a GitHub token (or GitHub App install), an admin email, and a monthly budget.
3. WHEN the stack finishes THEN the output SHALL be the Revenant URL and the admin SHALL get a sign-in email.
4. The install stack SHALL create an AWS Budgets alarm at the chosen monthly budget.
5. WHEN Revenant is uninstalled THEN every generated app SHALL keep running (separate stacks and repos).
6. The default install SHALL be public (Amplify Hosting, email sign-in). `docs/self-host.md` SHALL describe the private layout (ECS Fargate, internal ALB, Route 53 private zone, Verified Access or Client VPN).

## Requirement 2: Ask

**User story:** As a user, I want to say what I need in plain words, so that I don't write code.

1. The home screen SHALL show one prompt box, example requests, AWS credits left and this month's spend.
2. WHEN a user sends a request THEN Revenant SHALL create a project with a GitHub repo in the user's account or org.
3. The user MAY attach images or files (logo, a screenshot, a sample PDF) to the request.

## Requirement 3: Spec first

**User story:** As a user, I want to see and change the plan before code, so that I get what I meant.

1. WHEN a project is created THEN the agent SHALL write `.kiro/specs/<app>/requirements.md`, `design.md` and `tasks.md` in the repo.
2. The spec screen SHALL show the three files as tabs with plain summaries on top and the raw markdown underneath.
3. The spec SHALL list the AWS building blocks the app will use and the estimated monthly cost.
4. WHEN the user edits the spec or asks for a change in chat THEN the agent SHALL update the spec files and show the diff.
5. Nothing SHALL be built until the user presses "Build it".

## Requirement 4: Build

**User story:** As a user, I want to watch the app being built, so that I trust it.

1. WHEN the user presses "Build it" THEN Revenant SHALL start a run of Kiro CLI headless in CodeBuild on the project repo.
2. WHILE a run is going THE workspace SHALL stream the agent's messages, the task list with each task's state, and changed files.
3. WHEN a task finishes THEN the agent SHALL commit it with the task number in the message.
4. WHEN the run finishes THEN Revenant SHALL deploy a preview (Requirement 5) and show it in the workspace.
5. WHILE a preview exists THE user MAY ask for changes in chat; each change SHALL run as a new build on a new commit.
6. The user SHALL be able to stop a run at any time; stopping keeps the commits made so far.

## Requirement 5: Deploy

**User story:** As a user, I want push-to-deploy on my own AWS, so that it feels like Vercel.

1. The agent SHALL write the app's `infra/stack.yaml` by joining building blocks from `blocks/`; it SHALL NOT invent resources outside them unless the spec says why.
2. Each change SHALL deploy to a preview branch URL; "Publish" SHALL deploy to production.
3. Revenant SHALL create a CloudFormation change set and apply it without asking IF it only adds or updates resources.
4. IF a change set replaces or deletes any resource THEN Revenant SHALL wait for the user's approval and show what would be lost.
5. WHEN a deploy succeeds THEN Revenant SHALL check the URL returns 2xx.
6. The user MAY add a custom domain; Revenant SHALL show the DNS records to add.

## Requirement 6: Fix itself

**User story:** As a user, I want broken builds and deploys repaired for me, so that I never read AWS logs.

1. WHEN a build fails, a stack event fails, an Amplify job fails, or the health check fails THEN Revenant SHALL start a repair run.
2. The repair run SHALL collect the failing step's logs and the last commit's diff, and the agent SHALL state the cause in one plain sentence.
3. The agent SHALL fix the code or the stack on a branch `revenant/fix-<n>` and check it with a build and `cfn-lint` / `validate-template`.
4. WHEN the check passes THEN Revenant SHALL merge the fix and redeploy.
5. IF it fails THEN the agent SHALL retry with the new error, up to 3 runs per failure, then stop and show what it tried.
6. The agent SHALL never fix a failure by removing a check or test, weakening a guardrail (Requirement 9), or deleting data.
7. Every repair SHALL appear in the timeline: cause, files changed, check result, outcome, time to recover.

## Requirement 7: Credits and cost

**User story:** As a founder, I want to see what my apps cost against my credits, so that I am never surprised.

1. The home screen SHALL show AWS credits left (when Cost Explorer reports credits), month-to-date spend and forecast.
2. Each project SHALL show its own month-to-date cost from its cost allocation tag.
3. WHEN forecast spend passes the budget THEN Revenant SHALL warn on every screen.

## Requirement 8: Kiro Crew app

**User story:** As a Kiro Crew user, I want to build and deploy from chat.

1. The Crew app SHALL provide MCP tools `create_project(request)`, `build(project)`, `publish(project)`, `status(project)`.
2. WHEN the user says "build me X" in Kiro Crew THEN the crew agent SHALL create the project and return the spec link.
3. A Crew monitor SHALL notify the user when a build, deploy or repair finishes.
4. The Crew app SHALL provide a dashboard page listing projects with status and cost.

## Requirement 9: Guardrails

1. Data resources (databases, buckets) SHALL have `DeletionPolicy: Snapshot` or `Retain`.
2. No IAM policy SHALL use `"Action": "*"`; `"Resource": "*"` only where AWS requires it, with a condition.
3. No secret SHALL be a plain parameter or env var; generated apps use Secrets Manager.
4. The CodeBuild runner role SHALL reach only the project's repo, its stack and its logs.
5. Every agent action SHALL be logged with project, run, time and outcome.

## Requirement 10: Theme

1. The header SHALL have one switch on every page: **Light** or **Haunted**. Light is the default.
2. The theme SHALL NOT follow the OS light/dark setting.
3. Light SHALL be a plain light UI with no effects. A failure shows a red state and a flat heartbeat only.
4. Haunted SHALL be dark with the Halloween words (died, ritual, risen, tombstone) and effects: a flashlight that follows the mouse (before any mouse move it lights the active area), film grain, flicker, a red flash and shake when a deploy dies, a glitch on the state word, a tombstone over the dead preview, and a light bloom when it rises.
5. Inside Haunted, a **Full / Calm** switch SHALL turn every effect off while keeping the dark look and words. Calm SHALL be on by default WHEN `prefers-reduced-motion` is set.
6. The app's health SHALL be drawn as a heartbeat line in both themes: beats while live, flat while dead.
7. Both choices SHALL be remembered per browser and rendered on first paint with no flash.
8. Text contrast SHALL meet WCAG AA in Light and in Haunted Calm.

## Requirement 11: Demo

1. The demo SHALL build BloodOath from the request: "Build me a contract signing site where an AI flags toxic clauses before you sign."
2. The demo SHALL include one real repair on a planted break and show the time to recover.
3. The video SHALL be under 3 minutes, show the three differences from Lovable in the first 20 seconds, and contain no unlicensed trademarks or music.
4. The storyboard SHALL be approved by Janghoon before rendering.

## Requirement 12: Submission

1. The repository SHALL be public with an OSI license in the About section, and `/.kiro` committed.
2. `docs/kiro-usage.md` SHALL cover Kiro CLI headless, Kiro Crew (subagents, crons, monitors, memory), specs, steering, hooks, MCP and property-based tests.
3. A judge account on a live Revenant install SHALL be provided in the private Devpost field.
