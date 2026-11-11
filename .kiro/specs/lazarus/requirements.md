# Requirements: Lazarus (working name)

## Introduction

Lazarus is an open, self-hosted "Vercel for your own AWS account". Many teams use Vercel
because doing the same on AWS (Amplify, databases, mail, cron, IAM) is hard. Lazarus
closes that gap with an agent: it reads a repository, writes a CloudFormation stack,
deploys it into the user's own AWS account, watches it, and **fixes failures by itself**.

First supported stack: Next.js on Amplify Hosting with the AWS services in
`infra/stack.yaml`. First app: BloodOath (this repo), the PoC.

Halloween mode: a failed deploy "dies" (tombstone), the agent "resurrects" it.
Category fit: Frankenstein together with BloodOath (Vercel-style DX + CloudFormation +
an LLM repair agent + e-signature + Bitcoin).

## Requirement 1: Connect an AWS account

**User story:** As a developer, I want to connect my AWS account once, so that Lazarus can deploy for me.

1. WHEN a user clicks "Connect AWS" THEN Lazarus SHALL open the CloudFormation console with a quick-create link for a connect stack.
2. The connect stack SHALL create one IAM role that Lazarus assumes with an external id unique to the user.
3. The role SHALL allow only CloudFormation, the services the generated stacks use, and reading their logs. It SHALL NOT allow IAM user or access key creation.
4. WHEN the connect stack finishes THEN Lazarus SHALL verify the role with `sts:AssumeRole` and show the account id.

## Requirement 2: Connect a repository

**User story:** As a developer, I want to pick a GitHub repo, so that Lazarus knows what to deploy.

1. WHEN a user installs the Lazarus GitHub App on a repo THEN Lazarus SHALL list its branches.
2. WHEN a repo is picked THEN the agent SHALL detect the framework, package manager, env vars read by the code, and AWS needs (database, files, mail, AI, cron).
3. IF the framework is not supported THEN Lazarus SHALL say so and stop.

## Requirement 3: Write the stack

**User story:** As a developer, I want the infrastructure written for me, so that I don't learn CloudFormation.

1. WHEN detection finishes THEN the agent SHALL write `infra/stack.yaml` and open a pull request with it and a plain summary of each resource.
2. The generated stack SHALL follow the guardrails in Requirement 7.
3. IF the repo already has `infra/stack.yaml` THEN the agent SHALL reuse it and only propose changes.

## Requirement 4: Deploy

**User story:** As a developer, I want push-to-deploy, so that it feels like Vercel.

1. WHEN the stack PR is merged or a commit lands on the deploy branch THEN Lazarus SHALL create a CloudFormation change set and show it.
2. IF the change set only adds or updates resources THEN Lazarus SHALL apply it without asking.
3. IF the change set replaces or deletes any resource THEN Lazarus SHALL wait for the user's approval.
4. WHILE a deploy runs THE UI SHALL stream stack events and build log lines in one timeline.
5. WHEN a deploy succeeds THEN Lazarus SHALL check the app URL returns 2xx and show it.

## Requirement 5: Fix failures by itself

**User story:** As a developer, I want broken deploys repaired for me, so that I don't read AWS logs.

1. WHEN a stack event fails, an Amplify build fails, or the health check fails THEN the agent SHALL start a repair run.
2. The agent SHALL collect the failing step's logs (stack events, build log, CloudWatch logs of the app) and name the cause in one plain sentence.
3. The agent SHALL write a fix to the code or the stack on a branch `lazarus/fix-<n>`.
4. Before proposing the fix, the agent SHALL check it in a sandbox build (CodeBuild): install, build, and `aws cloudformation validate-template` for stack changes.
5. WHEN the check passes THEN the agent SHALL open a pull request with the cause, the fix and the evidence, and (if auto-merge is on for the repo) merge it and redeploy.
6. IF the fix fails THEN the agent SHALL try again with the new error, up to 3 runs per failure, then stop and show what it tried.
7. The agent SHALL never fix a failure by weakening guardrails (Requirement 7), deleting data, or removing a failing test or check.
8. Every repair run SHALL appear in the timeline: cause, files changed, check result, outcome.

## Requirement 6: Kiro Crew app

**User story:** As a Kiro Crew user, I want to deploy from chat.

1. The Crew app SHALL provide MCP tools `deploy(repo, branch)`, `deploy_status(id)` and `repair(id)`.
2. WHEN the user says "deploy this" in a repo THEN the crew agent SHALL call `deploy` and report the URL or the repair outcome.
3. A Crew monitor SHALL notify the user when a repair run finishes.

## Requirement 7: Guardrails

1. Data resources (databases, buckets) SHALL have `DeletionPolicy: Snapshot` or `Retain`.
2. No IAM policy SHALL use `"Action": "*"` or `"Resource": "*"` except where AWS requires it (for example SES send), with a condition.
3. No secret SHALL be a plain parameter or env var; secrets are generated in Secrets Manager.
4. Lazarus SHALL set an AWS Budgets alarm on the connect stack at a user-chosen monthly amount.
5. All agent actions SHALL be logged with who, what and when.

## Requirement 8: PoC

1. Lazarus SHALL deploy BloodOath from this repo into a fresh AWS account with no manual step except DNS and the SES production request.
2. The demo SHALL include at least 3 real repair runs on BloodOath, each from a planted break: a missing env var, a wrong Aurora engine version, and a failing DB migration.

## Requirement 9: Theme

1. Lazarus SHALL use the same light/dark and Halloween toggles as BloodOath (BloodOath Requirement 8).
