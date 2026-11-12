// SQL for the app, only when the admin allows SQL for its owner (Requirement 6.7-6.12).
//
//   amplify/backend.ts:  db(backend, { functions: [backend.api] });
//   app server code:     import { client } from '../blocks/db/client'; const sql = client(outputs.custom.db);
//   functions:           const sql = client();   // reads DB_CLUSTER_ARN, DB_SECRET_ARN, DB_NAME
//   migrations:          npx drizzle-kit generate  (folder ./drizzle, same commit as the table change)
//
// The clusters are not created here. Revenant owns them in separate stacks (blocks/db/cluster.ts)
// so a branch deploy can never replace or delete a database, and sets these Amplify app env vars:
//   RV_DB_PROD_CLUSTER_ARN, RV_DB_PROD_SECRET_ARN   prod cluster, used by the `main` branch only
//   RV_DB_DEV_CLUSTER_ARN, RV_DB_DEV_SECRET_ARN     dev cluster: <app>_dev and the previews <app>_pv<n>
// This block picks the database for the branch being deployed (main -> <app>_prod,
// preview/<n> -> <app>_pv<n>, anything else -> <app>_dev), lets the listed functions and the
// server call the Data API on that cluster only, and writes it to amplify_outputs.json as custom.db.
// Run `npx tsx blocks/db/migrate.ts` in amplify.yml right after `ampx pipeline-deploy`.
import { Annotations, Stack } from 'aws-cdk-lib';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import type { Fn } from '../fn';
import { grant } from '../grant';
import { app, env, sandbox, type Env } from '../name';

export type DbConfig = { clusterArn: string; secretArn: string; database: string };

export function database(appName: string, e: Env): string {
  return `${appName.replace(/-/g, '_')}_${e}`;
}

function config(scope: Stack): DbConfig {
  const e = env(scope);
  const side = e === 'prod' ? 'PROD' : 'DEV';
  const clusterArn = process.env[`RV_DB_${side}_CLUSTER_ARN`]?.trim();
  const secretArn = process.env[`RV_DB_${side}_SECRET_ARN`]?.trim();
  if (!clusterArn?.startsWith('arn:') || !secretArn?.startsWith('arn:')) {
    const msg = `RV_DB_${side}_CLUSTER_ARN and RV_DB_${side}_SECRET_ARN must be set; SQL is on only when the admin allows it`;
    if (!sandbox(scope)) throw new Error(msg);
    Annotations.of(scope).addWarning(msg);
  }
  return { clusterArn: clusterArn ?? '', secretArn: secretArn ?? '', database: database(app(), e) };
}

export function statements(c: DbConfig): PolicyStatement[] {
  return [
    new PolicyStatement({
      actions: ['rds-data:ExecuteStatement', 'rds-data:BatchExecuteStatement', 'rds-data:BeginTransaction', 'rds-data:CommitTransaction', 'rds-data:RollbackTransaction'],
      resources: [c.clusterArn],
    }),
    new PolicyStatement({ actions: ['secretsmanager:GetSecretValue'], resources: [c.secretArn] }),
  ];
}

export function db(backend: { stack: Stack; addOutput(o: { custom: Record<string, unknown> }): void }, opts: { functions?: Fn[] } = {}): DbConfig {
  const c = config(backend.stack);
  if (!c.clusterArn) return c; // sandbox without a cluster: warned above
  const grants = statements(c);

  for (const fn of opts.functions ?? []) {
    for (const s of grants) fn.resources.lambda.addToRolePolicy(s);
    fn.addEnvironment('DB_CLUSTER_ARN', c.clusterArn);
    fn.addEnvironment('DB_SECRET_ARN', c.secretArn);
    fn.addEnvironment('DB_NAME', c.database);
  }

  const compute = process.env.RV_COMPUTE_ROLE_ARN?.trim();
  if (compute) grant(backend.stack, 'db', compute, grants);

  backend.addOutput({ custom: { db: c } });
  return c;
}
