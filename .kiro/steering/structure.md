---
inclusion: always
---

# Structure

```
app/            Revenant Next.js app (UI + route handlers under app/api)
lib/            server logic: projects, builds, deploys, repairs, cost, github, aws
runner/         CodeBuild image and buildspec that run Kiro CLI headless
blocks/         CloudFormation building blocks for generated apps (hosting, db, files, mail, ai, cron)
steering/       steering files Revenant gives Kiro CLI inside generated projects
infra/          install stack for Revenant itself + deploy script
crew-app/       Kiro Crew app
video/          Remotion project for the demo video
design/         mockups
docs/           submission notes, Kiro usage log, credits log
.kiro/          specs, steering, hooks (must stay committed, never gitignored)
```

- One word kebab-case names for files and routes where possible (`repair.ts`, `/projects`).
- Every notable Kiro or Kiro Crew use goes into `docs/kiro-usage.md` the same day,
  with date, tool and what it produced. This file feeds the Devpost write-up.
- `docs/credits.md` is rebuilt hourly by a Kiro Crew cron (`scripts/credits-sync.sh`).
