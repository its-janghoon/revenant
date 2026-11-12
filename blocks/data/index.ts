// Amplify Data (DynamoDB through AppSync), the default data layer of every app (Requirement 6.2-6.6).
// Each Amplify branch deploys its own backend, so each preview has its own tables.
//
//   amplify/backend.ts:   const backend = defineBackend({ auth, data }); data(backend);   (before tags(backend))
//   amplify/data/seed.ts: sample rows for previews, see blocks/data/seed.ts
//   amplify.yml:          - npx tsx blocks/data/seed.ts   (right after ampx pipeline-deploy)
//
// On prod (`main`) the tables are retained, deletion protected and have point-in-time recovery.
// Preview tables go away with their branch. The table names are written to amplify_outputs.json
// (custom.tables) and to SSM `/rv/<app>/<env>/tables`, where Revenant reads them to count
// the records a rename or removal would touch.
//
// Model rules (checked by Revenant's guard on every push): never change a model name or its
// `.identifier([...])`; a new `.required()` field needs `.default(...)` or a backfill in
// `amplify/data/backfill/<Model>.<field>.ts` in the same commit; renames and removals wait
// for the user's approval.
import { RemovalPolicy, type Stack } from 'aws-cdk-lib';
import type { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { grant } from '../grant';
import { app, env } from '../name';

type TableWrapper = {
  applyRemovalPolicy(p: RemovalPolicy): void;
  pointInTimeRecoveryEnabled: boolean;
  deletionProtectionEnabled: boolean;
};

type WithData = {
  stack: Stack;
  data: { resources: { tables: Record<string, ITable>; cfnResources: { amplifyDynamoDbTables: Record<string, TableWrapper> } } };
  addOutput(o: { custom: Record<string, unknown> }): void;
};

export function data(backend: WithData): Record<string, string> {
  const e = env(backend.stack);
  const { tables, cfnResources } = backend.data.resources;

  if (e === 'prod') {
    for (const t of Object.values(cfnResources.amplifyDynamoDbTables)) {
      t.applyRemovalPolicy(RemovalPolicy.RETAIN);
      t.deletionProtectionEnabled = true;
      t.pointInTimeRecoveryEnabled = true;
    }
  }

  const names: Record<string, string> = {};
  for (const [model, t] of Object.entries(tables)) names[model] = t.tableName;

  new StringParameter(backend.stack, 'RvTables', {
    parameterName: `/rv/${app()}/${e}/tables`,
    stringValue: backend.stack.toJsonString(names), // table names are tokens until deploy
    description: 'Amplify Data model -> DynamoDB table',
  });
  backend.addOutput({ custom: { tables: names } });

  // The Amplify build role runs the seed script; it may write preview and dev tables, never prod.
  const build = process.env.RV_BUILD_ROLE_ARN?.trim();
  if (build && e !== 'prod' && Object.keys(tables).length) {
    grant(backend.stack, 'seed', build, [new PolicyStatement({
      actions: ['dynamodb:BatchWriteItem', 'dynamodb:Scan'],
      resources: Object.values(tables).map((t) => t.tableArn),
    })]);
  }
  return names;
}
