// Applies ./drizzle migrations to this branch's database. Runs in the Amplify build right
// after `npx ampx pipeline-deploy` (amplify.yml backend phase):
//   - npx tsx blocks/db/migrate.ts
// main writes <app>_prod (this is the publish step, after Revenant took a snapshot);
// every other branch writes <app>_dev or its own <app>_pv<n>. Nothing else writes prod.
import { readFileSync } from 'node:fs';
import { RDSDataClient } from '@aws-sdk/client-rds-data';
import { drizzle } from 'drizzle-orm/aws-data-api/pg';
import { migrate } from 'drizzle-orm/aws-data-api/pg/migrator';
import type { DbConfig } from './index';

const outputs = JSON.parse(readFileSync(process.argv[2] ?? 'amplify_outputs.json', 'utf8')) as { custom?: { db?: DbConfig } };
const c = outputs.custom?.db;
if (!c?.clusterArn) {
  console.log('migrate: no custom.db in amplify_outputs.json, nothing to do');
  process.exit(0);
}

const branch = process.env.AWS_BRANCH ?? '';
const prod = c.database.endsWith('_prod');
if (prod !== (branch === 'main')) {
  console.error(`migrate: branch "${branch}" may not write ${c.database}`);
  process.exit(1);
}

const sql = drizzle(new RDSDataClient({}), { resourceArn: c.clusterArn, secretArn: c.secretArn, database: c.database });

// At 0 ACU the cluster is paused; the first call wakes it and fails until it has resumed.
for (let i = 1; ; i++) {
  try {
    await migrate(sql, { migrationsFolder: 'drizzle' });
    console.log(`migrate: ${c.database} is up to date`);
    break;
  } catch (e) {
    const name = (e as { name?: string }).name ?? '';
    const msg = (e as { message?: string }).message ?? '';
    if (/database .* does not exist/.test(msg)) {
      console.error(`migrate: ${c.database} does not exist; Revenant creates it with the preview`);
      throw e;
    }
    if (i >= 10 || !/DatabaseResuming|ServiceUnavailable|StatementTimeout/.test(name + msg)) throw e;
    console.log(`migrate: database waking up (${name}), retry ${i}`);
    await new Promise((r) => setTimeout(r, 15_000));
  }
}
