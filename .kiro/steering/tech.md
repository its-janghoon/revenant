---
inclusion: always
---

# Tech

| Part | Choice |
|---|---|
| Web app | Next.js (App Router) + TypeScript, deployed on Vercel |
| DB | Postgres (Neon) through Drizzle ORM |
| Files | Vercel Blob (original PDF, signed PDF, OTS proof) |
| PDF | `pdf-lib` for stamping signatures and the audit page; `pdfjs-dist` for text extraction and rendering |
| Review agent | Amazon Bedrock (Anthropic Claude) through the Vercel AI SDK, structured output with zod schemas |
| Blockchain | OpenTimestamps (`javascript-opentimestamps`), anchored to Bitcoin via public calendars |
| Email | Resend, signing links with single-use tokens |
| Kiro Crew app | `crew-app/` in this repo: page, agent, skill, MCP server, cron |
| Demo video | Playwright recording of the real app + Remotion composition, scripted by Kiro |

## Rules

- Keep it small. Prefer the platform and the standard library before a new dependency.
- Secrets live in env vars only. Never commit `.env*`. Never log document text or tokens.
- Validate every request body with zod at the route boundary.
- The hash that gets anchored is the hash of the exact bytes the user downloads.
- Respect `prefers-reduced-motion` for every animation (candles, ink, seal).
