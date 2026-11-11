# Revenant for Platforms (not built for Kiroween)

Revenant installs into one company's AWS account and serves that company's own teams.
A business that wants to host apps for outside customers, the way Vercel or Lovable do,
needs one more level of isolation. This note records the plan.

## How others isolate

| Company | Compute | Data |
|---|---|---|
| Vercel | Functions and Sandbox run in Firecracker microVMs per workload | A database per project from Neon or Supabase |
| Lovable | Shared frontend hosting | A Supabase instance per project (Lovable Cloud) |

AWS names three models: silo (an account or DB instance per tenant), bridge (a schema per
tenant), pool (row-level security in shared tables).

## What Revenant already isolates

Inside one install, each generated app is already its own unit:

- its own CodeCommit repository and its own Amplify Gen 2 app;
- its own data: Amplify Data tables per Amplify branch (default), or, where the admin
  allows SQL, its own Aurora dev and prod databases and a preview cluster;
- its own runner role, which reaches only that app's repo, backend, dev and preview
  databases, and logs;
- its own AppRegistry application and `revenant:project` tag, so cost is per app.

## Plan

```
management account: Revenant dashboard, Revenant DB (Aurora), Cognito
  -> customer account A: CodeCommit repos, Amplify apps, previews, data
  -> customer account B: ...
runner assumes a role that exists only in that customer's account
```

- One AWS Organizations member account per customer (silo). The account boundary is
  enforced by AWS, which is stronger than process or VM isolation alone.
- Revenant's own data is split by customer organization, with authorization on every query.
- Each customer's users sign in with Cognito email codes into their own organization.
- Kiro: each customer brings their own Kiro key ("bring your own Kiro"), stored in
  Secrets Manager and used only for that customer's runs. A platform can also pay with
  its own company key and rebill.
- Admin policy (SQL on/off, model, budget, auto-delete) applies per customer organization.
- Cost per customer account (Cost Explorer, Usage and Credit) feeds rebilling.
- Optional for single companies: one account per app, using the same mechanism.
