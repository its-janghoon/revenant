---
inclusion: always
---

# How this app is built

- Next.js (App Router) and TypeScript strict on Amplify Gen 2. The backend is `amplify/backend.ts`.
- Auth: Amplify Auth (Cognito). Data: Amplify Data (`amplify/data/resource.ts`).
- Other AWS parts come only from `blocks/`, called in `amplify/backend.ts`. Add a resource outside
  `blocks/` only when the spec says why. Never edit `blocks/` or `.kiro/steering/`.
- Keep it small: the platform and the standard library before a new dependency.
- One task, one commit: mark the task `[-]` in `tasks.md`, do it, mark it `[x]`, then
  `git commit -m "task <n>: <title>"`.
- Never push, deploy, or run `ampx sandbox` or `ampx pipeline-deploy`. Revenant checks and pushes.
- Never put secrets in code, `.env*` files or logs, and never commit `.env*`.
- Look: when `DESIGN.md` is at the repo root, every screen follows it (its colors, fonts, corner
  radius, spacing, components, and do and don't notes); put its tokens in one place, such as CSS
  variables. Without it, use the `frontend-design` skill in `.kiro/skills/`. Never edit `.kiro/skills/`.
  Edit `DESIGN.md` only when the user asks to change the look.
