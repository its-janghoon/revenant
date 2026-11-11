# Revenant for Kiro Crew

A Kiro Crew app that drives a Revenant install from chat. Say "build me a
contract signing site" and the Revenant agent creates the project and gives you
the spec link. Build, publish and status follow from chat, a notification arrives
when a build, deploy or repair finishes, and a dashboard page lists every project
with its status and cost.

## What is in it

| Path | What it is |
|---|---|
| `app.json` | Manifest ([App Kit manifest reference](https://github.com/kirodotdev/KiroCrew/blob/main/docs/app-kit/manifest-reference.md)) |
| `mcp/server.py` | MCP server `revenant` (stdio): `create_project`, `build`, `publish`, `status` |
| `revenant_api.py` | Revenant HTTP client shared by the server and the monitor (standard library only) |
| `crons/monitor.py` | Schedule `revenant-monitor`: a no-model script cron, every 60 s |
| `skills/revenant/SKILL.md` | When to use each tool |
| `agents/revenant.json` | The `revenant` agent |
| `ui/` | Dashboard page `/apps/revenant` (React, built with Vite into `ui/dist/index.mjs`) |

Nothing needs installing at run time: the MCP server and the monitor run on the
gateway's own Python. Only the page needs a build.

## Setup

1. In Revenant, open **Settings -> Kiro Crew** and create an API token.
2. In Kiro Crew, open **Settings -> Secrets** and add two entries:
   - `REVENANT_URL`: your Revenant address, for example `https://revenant.example.com`
   - `REVENANT_API_TOKEN`: the token from step 1
3. Build the page and install the app:

   ```bash
   cd crew-app/ui && npm install && npm run build
   kirocrew app install /absolute/path/to/crew-app
   ```

   Enable it from **Apps -> Library** and confirm trust for this app.
4. Open **Schedule**, find `revenant-monitor` (it is installed paused), grant it
   the two secrets with the same env names (`REVENANT_URL`, `REVENANT_API_TOKEN`),
   and resume it.
5. MCP tools: the manifest maps both env vars to `secret://` references. Kiro
   Crew does not yet resolve vault references for an app's own MCP server; it
   passes the literal text ([KiroCrew #10641](https://github.com/kirodotdev/KiroCrew/issues/10641)).
   Until that lands, the tools answer "reached this process as a vault
   reference". The server never reads the vault itself.

## Revenant API

The routes this app calls. Revenant implements them under `app/api/crew/`.

- Auth: `Authorization: Bearer <REVENANT_API_TOKEN>` on every request. Missing or
  wrong token: `401`. Every request and answer is JSON.
- Errors: `{ "error": string, "code"?: string, "url"?: string }`. `url` points to
  the page in Revenant where the user can act.
- `:project` is a project id or its name; Revenant resolves either, scoped to the
  token's owner.

| Method | Path | Body | Answer |
|---|---|---|---|
| `POST` | `/api/crew/projects` | `{ request: string }` (1-4000 chars) | `201 { project: Project }`, status `spec`; the spec run has started |
| `GET` | `/api/crew/projects` | | `{ projects: Project[] }`, newest first |
| `GET` | `/api/crew/projects/:project` | | `ProjectDetail` |
| `POST` | `/api/crew/projects/:project/build` | `{}` | `202 { project: Project, run: Run }`; `409 { code: "busy" }` if a run is going |
| `POST` | `/api/crew/projects/:project/publish` | `{}` | `202 { project: Project, deploy: Deploy }`; `409 { code: "approval_required", url }` for a destructive change; `409 { code: "no_preview" }` before a preview exists |
| `GET` | `/api/crew/events?since=<cursor>` | | `{ events: Event[], cursor: string }`: finished builds, deploys and repairs after `cursor`, oldest first, at most 100. Without `since`, no events and the current cursor |

Types (ISO 8601 times, US dollars):

```ts
type Status = 'spec' | 'building' | 'preview' | 'publishing' | 'live' | 'dead' | 'repairing'

interface Project {
  id: string
  name: string
  status: Status
  url: string            // the project in Revenant (/p/:id)
  specUrl: string        // /p/:id/spec
  previewUrl: string | null
  prodUrl: string | null
  costUsd: number | null   // month to date
  creditUsd: number | null // part of costUsd paid by AWS credits
  updatedAt: string
}

interface Run {
  id: string
  mode: 'spec' | 'build' | 'change' | 'repair'
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  startedAt: string | null
  endedAt: string | null
}

interface Deploy {
  id: string
  branch: string   // main or preview/<n>
  status: 'running' | 'succeeded' | 'failed'
  url: string | null
}

interface Repair {
  id: string
  attempt: number  // 1-3
  cause: string
  outcome: 'running' | 'recovered' | 'gave_up'
  recoveredS: number | null
}

interface ProjectDetail extends Project {
  tasks: { done: number; total: number }
  lastRun: Run | null
  lastDeploy: Deploy | null
  lastRepair: Repair | null
}

interface Event {
  id: string
  projectId: string
  projectName: string
  kind: 'build' | 'deploy' | 'repair'
  outcome: 'succeeded' | 'failed' | 'recovered' | 'gave_up'
  at: string
  url: string      // where to look in Revenant
  detail?: string  // one line, e.g. the repair's cause
}
```

## How the parts talk

- Chat: the agent (or any agent given `@revenant:revenant`) calls the MCP tools;
  each tool is one request above. `status` is auto-approved because it only reads.
- Monitor: each run reads `/api/crew/events` from its saved cursor and sends one
  notification per event, then stores `/api/crew/projects` in the app's
  `config.json` with `checkedAt`. Its first run only sets the cursor.
- Page: reads that `config.json` through `GET /api/apps/revenant/config` every
  30 s. It never calls Revenant itself, so the token never reaches the browser.

## License

MIT, as the rest of Revenant.
