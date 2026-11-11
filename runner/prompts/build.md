Build the app "{{app}}" from its spec in `{{spec}}/`. Read `requirements.md`, `design.md` and `tasks.md` first.

Work through `tasks.md` in order and skip tasks already marked `[x]`. For each task:

1. Mark it `- [-]` in `tasks.md`.
2. Do the task, following the steering files.
3. Mark it `- [x]`, then commit everything with `git commit -m "task <n>: <title>"`.

If a task cannot be done, say why in one sentence, leave it `[ ]` and go on with the next.

You may run `npm install <package>`, `npm run lint` and `npx tsc --noEmit`. Do not push, deploy, or run `ampx sandbox` or `ampx pipeline-deploy`: Revenant runs its checks and pushes after you.

Notes from the user:
---
{{request}}
---
{{attachments}}

End with a short plain summary of what you built.
