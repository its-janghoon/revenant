# Pending spec changes (decided, not yet written into requirements/design/tasks)

Decided by Janghoon on 2026-11-11. Fold all of these into the spec in one pass.

## 1. Stack: Amplify Gen 2 for Revenant and for generated apps

- Both Revenant and every generated app use Amplify Gen 2 (`amplify/backend.ts`, CDK under the hood).
- Anything Amplify does not cover (CodeBuild runner, EventBridge rules, Aurora) goes into `backend.ts` as CDK.
- Replaces the plain CloudFormation YAML plan and most of the Step Functions deployer.
- Guardrail checks run on the synthesized template (`cdk.out`).

## 2. Data: option B

- Source of truth in SQL: Aurora Serverless v2 Postgres with the Data API, defined in `backend.ts`.
- Access from Next.js server code or Amplify Functions with Drizzle (`aws-data-api` driver); migrations with `drizzle-kit`, run in the build.
- No public DB, no VPC Lambda, no NAT.
- Only the append-only timeline lives in Amplify Data (DynamoDB) for realtime subscriptions.
- Generated apps follow the same rule: every table change ships with a migration file.

## 3. Safe data, learned from Lovable, Bolt, v0, Replit, Firebase

1. Postgres by default.
2. Separate dev and prod databases: previews use dev, only published apps use prod.
3. Publish shows the SQL migration diff and takes a snapshot before applying it to prod.
4. The runner has dev DB access only; only the publish step writes to prod.
5. Plain Postgres, exportable with `pg_dump`.

## 4. A DB copy per preview

- One shared preview Aurora cluster per app account.
- Each preview gets its own database: `CREATE DATABASE <app>_pv<n> TEMPLATE <app>_dev`.
- Copies dev data, not prod data. A masked prod copy is a later option.

## 5. Keep the AWS console clean

1. **Separate account**: Revenant creates (or is installed into) a dedicated AWS Organizations member account; all apps and previews live there. Check whether the user's AWS credits apply to that account.
2. **Per-app grouping**: one AppRegistry application per app, `awsApplication` tag on every resource, so the console's myApplications shows each app with its cost.
3. **One preview cluster**: see section 4.
4. **Auto cleanup**: when a preview branch is merged or closed, or after 7 days, delete its database, Amplify branch and stack.
- Naming: every resource is `rv-<app>-<prod|dev|pv<n>>`.
