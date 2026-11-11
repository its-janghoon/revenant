---
inclusion: always
---

# Tech

| Part | Choice |
|---|---|
| Revenant app | Amplify Gen 2: Next.js (App Router) + TypeScript, Cognito auth, `amplify/backend.ts` |
| Revenant DB | Aurora Serverless v2 Postgres (min 0 ACU) via the RDS Data API, Drizzle ORM and `drizzle-kit` migrations |
| Timeline | Amplify Data (DynamoDB) model, append-only, realtime subscriptions |
| Install | `infra/install.yaml` (CloudFormation quick-create) or the same template from a CloudShell one-liner |
| Agent engine | Kiro CLI headless (`kiro-cli chat --no-interactive`) in CodeBuild ARM medium, model Auto unless the admin picks another |
| Generated apps | One CodeCommit repo + one Amplify Gen 2 app each, built from `blocks/`; data in Amplify Data by default, Aurora only when the admin allows SQL |
| Previews | One Amplify branch (own backend and tables) per change, `preview/<n>`; production on `main` |
| Credits and cost | Cost Explorer (`RecordType` Credit and Usage), `revenant:project` tags, AppRegistry per app |
| Secrets | Secrets Manager only: Kiro API key, generated app keys |
| Kiro Crew app | `crew-app/`: MCP tools, agent, skill, page, monitor |
| Demo video | Playwright recording of the real app + Remotion composition |

## Rules

- Keep it small. Prefer the platform and the standard library before a new dependency.
- Every AWS resource is code: `amplify/backend.ts` (CDK) or `infra/install.yaml`. No click-ops.
- Revenant's own data: SQL is the source of truth; every schema change ships with a migration; never edit an applied migration.
- Generated apps on Amplify Data: never change a model identifier; new fields are optional or backfilled; renames and removals need approval.
- The server's AWS access comes only from IAM roles. No AWS keys in env vars.
- Name resources `rv-<app>-<prod|dev|pv<n>>` and tag them with `awsApplication`.
- Never commit `.env*`. Never log secrets, tokens or prompt contents with personal data.
- Validate every request body with zod at the route boundary.
- Respect `prefers-reduced-motion` for every animation.
