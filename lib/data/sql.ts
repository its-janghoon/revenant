// Raw statements on an app's cluster through the RDS Data API, as the cluster's master user.
// Used for database admin work only (create/drop databases, roles, counts); app tables are
// changed only by the app's Drizzle migrations.
import "server-only";
import { ExecuteStatementCommand, RDSDataClient, type Field } from "@aws-sdk/client-rds-data";

export type Target = { clusterArn: string; secretArn: string; database: string };

let rds: RDSDataClient | undefined;
const client = () => (rds ??= new RDSDataClient({}));

const RETRY = /DatabaseResuming|ServiceUnavailable|being accessed by other users/;

/** Runs one statement (autocommit). Retries while a paused cluster wakes up (min 0 ACU). */
export async function exec(t: Target, sql: string, tries = 10): Promise<Field[][]> {
  for (let i = 1; ; i++) {
    try {
      const r = await client().send(new ExecuteStatementCommand({
        resourceArn: t.clusterArn,
        secretArn: t.secretArn,
        database: t.database,
        sql,
      }));
      return r.records ?? [];
    } catch (e) {
      const err = e as { name?: string; message?: string };
      if (i >= tries || !RETRY.test(`${err.name} ${err.message}`)) throw e;
      await new Promise((r) => setTimeout(r, Math.min(15_000, 2_000 * i)));
    }
  }
}

export const str = (f: Field | undefined): string => (f && "stringValue" in f ? (f.stringValue ?? "") : "");
export const num = (f: Field | undefined): number => (f && "longValue" in f ? Number(f.longValue ?? 0) : 0);

/** A single-quoted SQL literal for values we built ourselves (checked names only). */
export const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
