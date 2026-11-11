# Tasks: Revenant

Built as a loop: wave 0 alone, then parallel lanes, then integration on a real AWS
account. Each lane owns its folders and works on its own branch from `develop`
(made with `wt-new revenant feat/<lane>`). A lane merges into `develop` when its
"done when" holds. Builds and tests run once per lane at merge, and once at integration.

## Wave 0: skeleton (one worker, before any lane)

- [ ] 0.1 Next.js app, TypeScript, Drizzle on the Data API, zod env schema, Cognito sign-in
- [ ] 0.2 DB schema: projects, runs, tasks, deploys, repairs, events, costs
- [ ] 0.3 API contracts in `lib/contracts.ts` (types every lane codes against) and the runner log-line format
- [ ] 0.4 Shell layout and the theme module from `design/mockups/live.html` (Light / Haunted, Calm, copy map, no-flash head script)
- [ ] 0.5 `infra/install.yaml` from today's `infra/stack.yaml` (public mode)
- _Done when: the app runs locally, the schema migrates, the shell renders in both themes._
- _Requirements: 1, 10.1-10.8_

## Wave 1: lanes in parallel

| Lane | Owns | Tasks | Done when |
|---|---|---|---|
| L1 runner | `runner/`, `steering/`, `blocks/` | image + buildspec, Kiro CLI headless, mode prompts (spec, build, change, repair), structured log lines, building blocks, generated-app steering | a CodeBuild job turns the BloodOath request into a spec, then into a built repo |
| L2 deploy | `lib/deploy/`, `lib/guard.ts`, `infra/deployer.yaml` | Step Functions deployer, change set classifier, approval wait, guardrail check, preview branches, publish, health check, custom domain records | a repo with `infra/stack.yaml` deploys to a preview URL and to production |
| L3 repair | `lib/repair/`, `infra/watch.yaml` | EventBridge failure rules, log gathering, repair loop (max 3), merge + redeploy, time to recover | each of the 3 planted breaks recovers by itself |
| L4 screens | `app/` (except `/api/cost`) | home + ask, spec screen with tabs and "Build it", workspace (stream, tasks, preview, chat, stop), timeline with heartbeat, settings | every screen works on live data in Light and Haunted |
| L5 cost | `lib/cost/`, `app/api/cost` | Cost Explorer job by `revenant:project` tag, credits, forecast, budget warning | the home screen shows real credits and spend |
| L6 crew | `crew-app/` | MCP tools (create, build, publish, status), monitor, page, skill | "build me X" in Kiro Crew creates a project and reports back |
| L7 haunt | `lib/haunt/` | port the storm from the mockup: rain, thunder, sound, blood, tombstone, dirt; the 6-step scare (Req 10.11) | Haunted Full matches the mockup and the scare runs in order; Calm and Light show none of it |

## Wave 2: integration (real AWS)

- [ ] 2.1 Install Revenant into the target account with `infra/install.yaml`
- [ ] 2.2 Build FinePrint end to end from the request, publish it
- [ ] 2.3 Run the 3 planted breaks; record time to recover for each
- [ ] 2.4 Fix whatever the run finds; repeat until 2.2 and 2.3 pass in one go
- [ ] 2.5 Judge account

## Wave 3: submission

- [ ] 3.1 Demo storyboard (Janghoon approves before any recording)
- [ ] 3.2 Record with Playwright, compose with Remotion, under 3 minutes, baked storm sound
- [ ] 3.3 README, `docs/kiro-usage.md` write-up, `docs/self-host.md`
- [ ] 3.4 Blog post, `#KiroweenHackathon26` post
- [ ] 3.5 Devpost form: Frankenstein, Startup (McKinley Rice), Kiro Crew App, judge credentials
