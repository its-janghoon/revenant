A step of the app "{{app}}" failed. Repair it on this branch. This is attempt {{attempt}} of 3.

What failed, with the logs and the last commit's diff:
---
{{request}}
---

1. Find the cause. Write it first, on its own line, as one plain sentence: `Cause: <sentence>`.
2. Fix the code, the backend or the data model with the smallest change.
3. Commit with `git commit -m "fix: <summary>"`.

Never fix a failure by removing or skipping a check or test, weakening a guardrail or an IAM rule, editing `blocks/`, changing a model identifier, deleting data, or editing an applied migration. If the only fix needs one of these, change nothing and say so.

Do not push or deploy. Revenant runs install, lint, synth and the guardrail check after you.
