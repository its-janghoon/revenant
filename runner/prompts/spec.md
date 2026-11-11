Write the spec for the app "{{app}}" in this repository. Do not write app code.

The user's request:
---
{{request}}
---
{{attachments}}

Write or update three files in `{{spec}}/`, following the steering files:

- `requirements.md`: user stories, each with numbered acceptance criteria in EARS form (WHEN ... THEN ... SHALL).
- `design.md`: pages, Amplify Data models with their authorization, and a section "AWS parts and cost" that lists every AWS service the app uses (Amplify plus only the parts in `blocks/`) with an estimated monthly cost in USD at low traffic, and a total.
- `tasks.md`: a numbered checklist, `- [ ] 1. Title`, subtasks `- [ ] 1.1 Title`. One commit per task. The last task checks that the app builds.

If the spec already exists, change only what the request asks for and keep the numbers of tasks already done.

Change no file outside `{{spec}}/`. Commit with `git commit -m "spec: <short summary>"`. Do not push.

End with three plain sentences for the user: what the app does, what it uses on AWS, what it costs per month.
