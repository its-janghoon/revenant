---
description: Build, publish and check apps on the user's own AWS account with Revenant. Use when the user says "build me X", asks to ship, publish or deploy a Revenant app, or asks how a Revenant project, build, deploy or repair is doing.
always: false
---

# Revenant

Revenant is the user's self-hosted app builder on their own AWS account. A Kiro
agent writes a spec (requirements, design, tasks), builds the app into a preview,
publishes it to production, and repairs builds and deploys that fail. These tools
are on the `revenant` MCP server of the Revenant app.

## Which tool

| The user says | Call | Then |
|---|---|---|
| "build me X", "make an app that...", "I need a site for..." | `create_project(request)` with their words, unedited | Reply with the project name and the `specUrl`. Ask them to read the spec. Do not build yet. |
| "looks good, build it", "go ahead" (after the spec) | `build(project)` | Say the build started and that a notification comes when it finishes. Give the preview link if the answer has one. |
| "ship it", "publish", "put it live" | `publish(project)` | Give the production link. On `approval_required`, give the user the link from the error and stop. |
| "how is X doing?", "is it live?", "why did it fail?" | `status(project)` | Report status, task progress, the last build, deploy or repair (with its cause), and cost. |

`project` is the id or name from `create_project` or `status`. If you do not know
which project the user means and more than one could fit, ask.

## Rules

- One tool call per user step. Never chain `create_project`, `build` and `publish`
  in one turn: the user reviews the spec before a build and tries the preview
  before a publish.
- Do not poll `status` in a loop. The `revenant-monitor` schedule sends a
  notification when a build, deploy or repair finishes.
- Repairs are automatic (up to 3 tries per failure). Do not start a new build to
  fix a failed one; report the repair the status shows.
- A tool error that names `REVENANT_URL` or `REVENANT_API_TOKEN` means the app is
  not set up. Point the user to the Setup section of the Revenant app README
  and stop.
- Never print or ask for the API token in chat.
- Cost fields are US dollars for the current month; `creditUsd` is the part paid
  by AWS credits.
