---
inclusion: always
---

# Tech

| Part | Choice |
|---|---|
| Web app | Next.js (App Router) + TypeScript on AWS Amplify Hosting (`WEB_COMPUTE`) |
| DB | Aurora Serverless v2 Postgres (scales to 0) through the RDS Data API, Drizzle ORM `aws-data-api` driver |
| Files | S3, private, presigned upload and download (original PDF, signed PDF, OTS proof) |
| PDF | `pdf-lib` for stamping signatures and the audit page; `pdfjs-dist` for text extraction and rendering |
| Review agent | Amazon Bedrock (Anthropic Claude) through the AI SDK Bedrock provider, structured output with zod schemas |
| Blockchain | OpenTimestamps (`javascript-opentimestamps`), anchored to Bitcoin via public calendars |
| Email | Amazon SES, signing links with single-use tokens |
| Cron | EventBridge rule (every 30 min) -> API destination -> `POST /api/cron` with `x-cron-key` |
| Infra | One CloudFormation stack: `infra/stack.yaml`, deployed by `infra/deploy.sh` |
| Kiro Crew app | `crew-app/` in this repo: page, agent, skill, MCP server, cron |
| Demo video | Playwright recording of the real app + Remotion composition, scripted by Kiro |

## Rules

- Keep it small. Prefer the platform and the standard library before a new dependency.
- Every AWS resource lives in `infra/stack.yaml`. No click-ops in the console.
- The server gets AWS access only from the Amplify compute role. No AWS keys in env vars.
- Secrets are generated in Secrets Manager by the stack and read at runtime by ARN.
  Never commit `.env*`. Never log document text or tokens.
- Validate every request body with zod at the route boundary.
- The hash that gets anchored is the hash of the exact bytes the user downloads.
- Respect `prefers-reduced-motion` for every animation (candles, ink, seal).
