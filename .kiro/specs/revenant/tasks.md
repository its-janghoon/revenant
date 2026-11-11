# Tasks: Revenant

- [ ] 1. Skeleton
  - [ ] 1.1 Next.js app, Drizzle on the Data API, auth (email link), env schema
  - [ ] 1.2 Theme: Light / Haunted (+ Calm), no-flash head script, copy map, effects module, heartbeat line
  - [ ] 1.3 `infra/install.yaml` (from today's `infra/stack.yaml`) and `infra/deploy.sh`
  - _Requirements: 1, 10_

- [ ] 2. Runner (the engine)
  - [ ] 2.1 Runner image and buildspec, Kiro CLI headless, structured log lines
  - [ ] 2.2 Mode prompts: spec, build, change, repair
  - [ ] 2.3 Generated-app steering and `blocks/`
  - [ ] 2.4 Property test: log line <-> event round-trip
  - _Requirements: 3, 4, 5.1_

- [ ] 3. Ask and spec screens
  - [ ] 3.1 Home with prompt, examples, credits
  - [ ] 3.2 Project creation with GitHub repo
  - [ ] 3.3 Spec screen with tabs, summaries, diff on change, "Build it"
  - _Requirements: 2, 3_

- [ ] 4. Workspace
  - [ ] 4.1 Live stream: messages, tasks, files (SSE from CloudWatch)
  - [ ] 4.2 Preview pane, change requests in chat, stop
  - _Requirements: 4_

- [ ] 5. Deploy
  - [ ] 5.1 Step Functions deployer, change set classifier, approval
  - [ ] 5.2 Guardrail check and its property tests
  - [ ] 5.3 Preview branches, publish, health check, custom domain records
  - _Requirements: 5, 9_

- [ ] 6. Repair
  - [ ] 6.1 EventBridge failure rules, log gathering
  - [ ] 6.2 Repair loop (max 3), merge and redeploy
  - [ ] 6.3 Timeline with time to recover
  - [ ] 6.4 Resurrect 3 planted breaks on BloodOath (env var, engine version, migration)
  - _Requirements: 6_

- [ ] 7. Cost: Cost Explorer job, home and project cost, budget warning
  - _Requirements: 7_

- [ ] 8. Kiro Crew app: MCP tools, monitor, page
  - _Requirements: 8_

- [ ] 9. Demo: build BloodOath end to end on a fresh account, storyboard, recording, Remotion
  - _Requirements: 11_

- [ ] 10. Submission: README, usage write-up, blog, social post, Devpost form, judge account
  - _Requirements: 12_
