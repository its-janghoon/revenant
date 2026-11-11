---
inclusion: always
---

# Structure

```
app/            Next.js routes (UI + route handlers under app/api)
lib/            server logic: pdf, review, seal (OpenTimestamps), mail, db
crew-app/       Kiro Crew app: manifest, agent, skill, MCP server, cron
video/          Remotion project for the demo video
docs/           submission notes and the Kiro usage log
.kiro/          specs, steering, hooks (must stay committed, never gitignored)
```

- One word kebab-case names for files and routes where possible (`seal.ts`, `/verify`).
- Every notable Kiro or Kiro Crew use goes into `docs/kiro-usage.md` the same day,
  with date, tool and what it produced. This file feeds the Devpost write-up.
