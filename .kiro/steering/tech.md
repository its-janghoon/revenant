---
inclusion: always
---

# Tech

| Part | Choice |
|---|---|
| Revenant app (control plane) | Next.js (App Router) + TypeScript on Amplify Hosting (`WEB_COMPUTE`), installed into the user's own AWS account by one CloudFormation stack |
| Revenant DB | Aurora Serverless v2 Postgres (scales to 0) via the RDS Data API, Drizzle ORM |
| Agent engine | Kiro CLI headless (`kiro-cli chat --no-interactive`) in a CodeBuild container, with Revenant's steering and the project's `.kiro/` |
| Live log stream | CodeBuild -> CloudWatch Logs -> Revenant API -> server-sent events |
| Generated apps | One CodeCommit repo + one CloudFormation stack each (GitHub optional), built from tested building blocks in `blocks/` |
| Previews | One Amplify branch per change (`preview/<n>`), production on `main` |
| Credits and cost | Cost Explorer (`RecordType` Credit and Usage) and per-app cost allocation tags |
| Secrets | Secrets Manager only: Kiro API key, generated app keys |
| Kiro Crew app | `crew-app/`: MCP tools, agent, skill, page, monitor |
| Demo video | Playwright recording of the real app + Remotion composition |

## Rules

- Keep it small. Prefer the platform and the standard library before a new dependency.
- Every AWS resource lives in a CloudFormation template. No click-ops.
- The server's AWS access comes only from IAM roles. No AWS keys in env vars.
- Never commit `.env*`. Never log secrets, tokens or prompt contents with personal data.
- Validate every request body with zod at the route boundary.
- Respect `prefers-reduced-motion` for every animation.
