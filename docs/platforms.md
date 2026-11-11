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

## Plan

```
management account: Revenant UI, Revenant DB
  -> customer account A: apps, previews, databases
  -> customer account B: ...
runner assumes a role that exists only in that customer's account
```

- One AWS Organizations member account per customer (silo). The account boundary is
  enforced by AWS, which is stronger than process or VM isolation alone.
- Revenant's own data is split by customer organization, with authorization on every query.
- Cost per customer account feeds rebilling.
- Optional for single companies: one account per app, using the same mechanism.
