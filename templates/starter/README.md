# App

Started by Revenant: Next.js on Amplify Gen 2, deployed from this CodeCommit repository
into your own AWS account. `main` is production; `preview/<n>` branches are previews.

- Backend: `amplify/backend.ts`, built from `blocks/` (see `blocks/README.md`).
- Spec: `.kiro/specs/`. Rules for the agent: `.kiro/steering/`.

Work locally:

```
npm install
npm run dev
```
