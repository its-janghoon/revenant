---
inclusion: always
---

# AWS rules

Revenant's guardrail check rejects a push that breaks these.

- Names: `rv-<app>-<prod|dev|pv<n>>`, made with `name(scope, part)` from `blocks/name.ts`.
- `tags(backend)` stays the last line of `amplify/backend.ts`. It adds `awsApplication` and the
  `revenant:*` tags to every resource.
- Buckets, tables and databases are retained or snapshotted on delete.
- IAM: never `"Action": "*"`. `"Resource": "*"` only where AWS requires it, and then with a condition.
  Grant to the one function or role that needs it.
- Secrets live in Secrets Manager and are read at run time. Never in env vars, parameters or code.
- No public database, no Lambda in a VPC, no NAT gateway.
