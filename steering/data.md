---
inclusion: always
---

# Data rules

The app's data must stay correct while the app keeps changing.

- Use Amplify Data. Add no other database unless `blocks/db` is already in `amplify/backend.ts`.
- Never change a model's name or its identifier (`.identifier([...])`): that replaces the table and loses its data.
- A new field is optional, or the same commit adds a backfill that fills it for existing records.
- Rename or remove a field or model only when the user asked for it. Revenant then asks the user
  to approve, with the number of records affected.
- Every model has an authorization rule; the default is `allow.owner()`.
- Every preview has its own empty tables. Sample data goes in the seed script, never in app code.
- With `blocks/db` (SQL): every table change ships with a Drizzle migration in the same commit,
  never edit an applied migration, and never connect to the prod database.
