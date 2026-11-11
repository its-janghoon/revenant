The user wants a change to the app "{{app}}". The app is built; its spec is in `{{spec}}/`.

The change:
---
{{request}}
---
{{attachments}}

1. If the change alters what the app does, update `requirements.md` and `design.md`, and add tasks to `tasks.md` with the next free numbers.
2. Make the change with the smallest diff, following the steering files. Mark each task `- [-]` when you start it and `- [x]` when it is done.
3. Commit each task with `git commit -m "task <n>: <title>"`. A small change with no task: `git commit -m "change: <summary>"`.

Do not push, deploy, or run `ampx sandbox` or `ampx pipeline-deploy`: Revenant runs its checks and pushes after you.

End with a short plain summary of what changed.
