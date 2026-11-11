---
inclusion: always
---

# Structure

```
app/            Next.js routes (UI + route handlers under app/api)
lib/            server logic: pdf, review, seal (OpenTimestamps), mail, db
crew-app/       Kiro Crew app: manifest, agent, skill, MCP server, cron
video/          Remotion project for the demo video
infra/          CloudFormation stack and deploy script (all AWS resources)
scripts/        small helper scripts (credits.py)
docs/           submission notes, the Kiro usage log, the credits log
.kiro/          specs, steering, hooks (must stay committed, never gitignored)
```

- One word kebab-case names for files and routes where possible (`seal.ts`, `/verify`).
- Every notable Kiro or Kiro Crew use goes into `docs/kiro-usage.md` the same day,
  with date, tool and what it produced. This file feeds the Devpost write-up.
- At the start of every message, run `python3 scripts/credits.py` and commit
  `docs/credits.md`, so the credits used per message stay on record.
