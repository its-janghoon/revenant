# Tasks: Revenant

Built as a loop: wave 0 alone, then parallel lanes, then integration on a real AWS
account. Each lane owns its folders and works on its own branch from `develop`
(made with `wt-new revenant feat/<lane>`). A lane merges into `develop` when its
"done when" holds. Builds and tests run once per lane at merge, and once at integration.

## Wave 0: skeleton (one worker, before any lane)

- [ ] 0.1 Amplify Gen 2 app: Next.js, TypeScript, Cognito auth, zod env schema
- [ ] 0.2 `blocks/db` and Revenant's own Aurora + Data API + Drizzle schema and first migration; timeline model in Amplify Data
- [ ] 0.3 API contracts in `lib/contracts.ts` and the runner log-line format
- [ ] 0.4 Shell layout and the theme module from `design/mockups/live.html` (Light / Haunted, Calm, Sound, copy map, no-flash head script)
- [ ] 0.5 `infra/install.yaml` (quick-create) and the CloudShell one-liner; settle CDK bootstrap on a fresh account
- _Done when: the app runs in an Amplify sandbox, migrations apply, the shell renders in both themes._
- _Requirements: 1, 6.1-6.4, 12.1-12.8_

## Wave 1: lanes in parallel

| Lane | Owns | Tasks | Done when |
|---|---|---|---|
| L1 runner | `runner/`, `steering/`, `blocks/` (except `db`) | image + buildspec, Kiro CLI headless, mode prompts, log lines, building blocks, generated-app steering, per-app runner role | a CodeBuild job turns the FinePrint request into a spec, then into a built CodeCommit repo |
| L2 deploy | `lib/deploy/`, `lib/guard.ts` | synth + guardrail check, change classifier, approval wait, preview branches, publish with migration diff and snapshot, health check, custom domain records | a generated app deploys to a preview URL and publishes to production |
| L3 data | `lib/data/`, `blocks/db` previews | dev/prod split, preview cluster, `TEMPLATE` copies per preview, runner DB scope, `pg_dump` export | each preview has its own DB; the runner cannot reach prod |
| L4 repair | `lib/repair/` | EventBridge failure rules, log gathering, repair loop (max 3), merge + redeploy, time to recover | each of the 3 planted breaks recovers by itself |
| L5 screens | `app/` (except `/api/cost`) | home + ask, spec screen, workspace, publish screen, timeline with heartbeat, settings | every screen works on live data in Light and Haunted |
| L6 cost + console | `lib/cost/`, `lib/cleanup/`, `app/api/cost` | Cost Explorer job, budget warning, AppRegistry + tags, naming, 7-day preview cleanup, 24 h judge-project cleanup | the home screen shows real spend; myApplications shows each app; expired previews disappear |
| L7 crew | `crew-app/` | MCP tools, monitor, page, skill | "build me X" in Kiro Crew creates a project and reports back |
| L8 haunt | `lib/haunt/` | storm (rain, thunder, sound, blood, tombstone, dirt) and the 6-step scare | Haunted Full matches the mockup and the scare runs in order; Calm and Light show none of it |

## Wave 2: integration (Janghoon's personal AWS, dedicated account; on hold)

- [ ] 2.1 Install Revenant with the one-step install
- [ ] 2.2 Build FinePrint end to end from the request, publish it
- [ ] 2.3 Run the 3 planted breaks; record time to recover for each
- [ ] 2.4 Fix whatever the run finds; repeat until 2.2 and 2.3 pass in one go
- [ ] 2.5 Judge accounts, FinePrint prebuilt, Budgets alarm

## Wave 3: submission

- [ ] 3.1 Demo storyboard (Janghoon approves before any recording)
- [ ] 3.2 Record with Playwright, compose with Remotion, under 3 minutes, baked storm sound
- [ ] 3.3 README (two install ways), `docs/kiro-usage.md`, `docs/self-host.md`, `docs/platforms.md`
- [ ] 3.4 Blog post, `#KiroweenHackathon26` post
- [ ] 3.5 Devpost form: Frankenstein, Startup (McKinley Rice), Kiro Crew App, judge credentials

## After results (2027-02-04 KST)

- [ ] 4.1 Delete the demo install's stacks and apps
