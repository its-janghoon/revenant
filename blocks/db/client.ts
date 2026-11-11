// Drizzle over the RDS Data API for app code. No VPC, no connection pool, no password.
//
//   server (Next.js):  import outputs from '@/amplify_outputs.json'; const sql = client(outputs.custom.db);
//   function (Lambda): const sql = client();   // env set by db(backend, { functions })
//   with a schema:     const sql = client(undefined, schema);
import { RDSDataClient } from '@aws-sdk/client-rds-data';
import { drizzle } from 'drizzle-orm/aws-data-api/pg';
import type { DbConfig } from './index';

export function client<S extends Record<string, unknown> = Record<string, never>>(config?: DbConfig, schema?: S) {
  const c = config ?? {
    clusterArn: process.env.DB_CLUSTER_ARN ?? '',
    secretArn: process.env.DB_SECRET_ARN ?? '',
    database: process.env.DB_NAME ?? '',
  };
  if (!c.clusterArn || !c.secretArn || !c.database) throw new Error('db: no database config (custom.db in amplify_outputs.json or DB_* env)');
  return drizzle(new RDSDataClient({}), { resourceArn: c.clusterArn, secretArn: c.secretArn, database: c.database, schema });
}
