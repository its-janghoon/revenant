# Design: BloodOath

## Overview

```
upload -> review agent -> place fields -> send -> sign -> final PDF -> OpenTimestamps -> sealed
                                                                              |
                                              /verify (browser hash) <--------+
Kiro Crew app (MCP tools, Notary agent, page, cron) -> same API
```

One Next.js app holds UI and API. The Kiro Crew app is a thin client of that API,
so the web app and the crew show the same documents.

## AWS (one CloudFormation stack, `infra/stack.yaml`)

| Resource | Use |
|---|---|
| Amplify Hosting (`WEB_COMPUTE`) | Builds from GitHub `main`, runs the Next.js server |
| Compute role | The server's only AWS access: Data API, S3, SES, Bedrock, its secrets |
| Build role | Data API access for `npm run db:migrate` during the build |
| Aurora Serverless v2 Postgres | Min 0 ACU, pauses after 10 idle minutes. Reached only through the Data API; private subnets, no inbound |
| S3 | Documents and proofs, private, versioned, presigned URLs |
| SES | Signing mail from `MAIL_FROM`; DKIM records are a stack output |
| Secrets Manager | DB password (managed by RDS), app key, cron key: all generated |
| EventBridge | Every 30 min, `POST /api/cron` through an API destination |

`infra/deploy.sh` deploys the stack and starts the first build. Manual once: add the 3
DKIM CNAMEs, request SES production access, and accept the Anthropic model terms in Bedrock.

## Data model (Postgres)

| Table | Key columns |
|---|---|
| `documents` | id, owner_id, title, status (`draft`, `sent`, `signed`, `sealing`, `sealed`, `declined`), original_hash, final_hash, S3 keys, created_at |
| `signers` | id, document_id, email, name, order, status, token_hash, token_expires_at, signed_at, ip, user_agent, decline_reason |
| `fields` | id, document_id, signer_id, kind, page, x, y, w, h, value |
| `reviews` | id, document_id, perspective, model, summary json, created_at |
| `findings` | id, review_id, clause_no, page, quote, rating, category, reason, rewrite |
| `seals` | id, document_id, hash, ots_s3_key, status (`pending`, `confirmed`), block_height, block_time |
| `events` | id, document_id, actor, kind, detail json, at (audit trail, append-only) |

Signing tokens are stored only as SHA-256 hashes.

## Review agent

Steps, each a separate model call with a zod schema:

1. **Split.** `pdfjs-dist` extracts text with page and position. A deterministic splitter
   cuts on headings and numbering; the model only fixes merges and splits it got wrong.
2. **Rate.** Clauses go to the model in batches of ~10 with the rubric below and the
   chosen perspective. Output per clause: rating, category, reason, rewrite, quote.
3. **Check.** Each quote must be a substring of the clause text after whitespace
   normalisation. Findings that fail are dropped (Req 2.6).
4. **Summarise.** Counts and top 3 risks from the checked findings.

Results stream to the client over a route handler (`/api/documents/:id/review`).

Rubric (in `lib/review/rubric.ts`): for each category, what `watch` and `toxic` look like,
with one short example each. The rubric is data, so it can be tuned without code changes.

## Seal (OpenTimestamps)

- `lib/seal.ts` `stamp(hash)` submits to the public calendars and returns the pending
  `.ots` bytes. `upgrade(ots)` asks calendars for the Bitcoin attestation.
- Bitcoin confirmation takes about 1 to 6 hours. An EventBridge rule calls
  `POST /api/cron` every 30 min with the `x-cron-key` header; the route upgrades pending
  proofs and sends signer reminders (every 3 days per signer). The Crew app cron does the
  same for crew users.
- The `.ots` file is a standard OpenTimestamps proof: `ots verify final.pdf.ots` works
  without BloodOath.

## Final PDF

`pdf-lib` stamps signature images and field values, then appends an audit certificate
page: title, original hash, each signer with time, IP and email, and a QR code to
`/verify`. The final hash is computed over the saved bytes, after the audit page.

## Kiro Crew app (`crew-app/`)

Scaffolded with `kirocrew app init`, field names taken from the App Kit docs.

| Part | What |
|---|---|
| MCP server | `review_contract(path, perspective)`, `send_for_signature(document_id, signers)`, `document_status(document_id)`, `verify_document(path)` -> BloodOath API with a user API key |
| Agent | Notary: reviews, explains, sends, checks status. Never signs on the user's behalf |
| Skill | When to use each tool, how to present findings |
| Page | Document list with status and wax-seal icon |
| Cron | Every 3 days: remind unsigned signers. Every 30 min: upgrade pending seals |

API keys: users create one in BloodOath settings; the Crew app stores it in the Crew
secrets vault.

## UI

Routes: `/` (landing), `/documents`, `/documents/:id` (review + fields), `/sign/:token`,
`/verify`, `/settings`.

Themes: two switches on `<html>`: `data-scheme="light|dark"` and `data-halloween="on|off"`.
All colors are CSS variables keyed by those two attributes, so 4 themes come from one
stylesheet. A tiny inline script in `<head>` reads `localStorage` and sets both before
first paint. Wording that changes ("Sign" -> "Swear the oath") comes from one copy map
keyed by `halloween`, so no component branches on the theme.

Halloween tokens: near-black or parchment background, blood red `#8a0303` accent
(contrast checked for text use), candle amber for focus, serif headings. Normal tokens:
neutral grays, one blue accent, sans everywhere. Motion (Halloween only): candle flicker
on the landing, ink drawing on signature, seal press on `sealed`; all off under reduced
motion.

## Demo video

1. `video/storyboard.md`: scenes, length, camera, captions. Janghoon approves first.
2. Playwright scripts in `video/record/` drive the deployed app with seed data and
   record each scene.
3. Remotion in `video/` composes clips, captions and a royalty-free or generated track.
4. Target 2:45.

## Error handling

- Model call fails: retry once, then show the clauses done so far and a retry button.
- Calendar submit fails: try the next calendar; if all fail, keep status `signed` and
  retry from the cron.
- Email fails: show the signing link to the sender to share by hand.

## Testing

Property-based tests (fast-check) on the parts where they pay:

- Splitter: joining the clauses gives back the source text (modulo whitespace).
- Quote check: a finding is kept only if its quote is in its clause.
- Hash: the anchored hash equals the hash of the downloaded bytes.
- Tokens: a used or expired token never opens a signing page.
