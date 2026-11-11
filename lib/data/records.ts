// Record counts: for the approval of a rename or removal (Requirement 6.6, "with the number
// of records affected") and for GET /api/projects/:id/data (the studio's Data tab).
import "server-only";
import { DynamoDBClient, ScanCommand, type AttributeValue } from "@aws-sdk/client-dynamodb";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { clusterOf, dbName, type DbEnv } from "./names";
import { info } from "./cluster";
import { exec, num, str } from "./sql";
import type { Approval } from "./guard";

export type TableCount = { name: string; rows: number };
export type DataSummary = { env: DbEnv; models: TableCount[]; sql: TableCount[] | null };

let ddb: DynamoDBClient | undefined;
let ssm: SSMClient | undefined;
const dynamo = () => (ddb ??= new DynamoDBClient({}));
const params = () => (ssm ??= new SSMClient({}));

/** Amplify Data model -> table name, written by blocks/data at deploy time. */
export async function modelTables(app: string, env: DbEnv): Promise<Record<string, string>> {
  try {
    const r = await params().send(new GetParameterCommand({ Name: `/rv/${app}/${env}/tables` }));
    return JSON.parse(r.Parameter?.Value ?? "{}") as Record<string, string>;
  } catch (e) {
    if ((e as { name?: string }).name === "ParameterNotFound") return {};
    throw e;
  }
}

/** Exact item count (paged COUNT scan; the apps are small). */
export async function countTable(table: string): Promise<number> {
  let n = 0;
  let start: Record<string, AttributeValue> | undefined;
  do {
    const r = await dynamo().send(new ScanCommand({ TableName: table, Select: "COUNT", ExclusiveStartKey: start }));
    n += r.Count ?? 0;
    start = r.LastEvaluatedKey;
  } while (start);
  return n;
}

/** Records on prod each approval touches (model removed: all rows; field: rows that have it). */
export async function affected(app: string, approvals: Approval[]): Promise<(Approval & { records: number })[]> {
  const tables = await modelTables(app, "prod");
  return Promise.all(approvals.map(async (a) => {
    const t = tables[a.model];
    if (!t) return { ...a, records: 0 };
    if (!a.field) return { ...a, records: await countTable(t) };
    let n = 0;
    let start: Record<string, AttributeValue> | undefined;
    do {
      const r = await dynamo().send(new ScanCommand({
        TableName: t,
        Select: "COUNT",
        FilterExpression: "attribute_exists(#f)",
        ExpressionAttributeNames: { "#f": a.field },
        ExclusiveStartKey: start,
      }));
      n += r.Count ?? 0;
      start = r.LastEvaluatedKey;
    } while (start);
    return { ...a, records: n };
  }));
}

const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;

export async function sqlTables(app: string, env: DbEnv): Promise<TableCount[] | null> {
  const i = await info(app, clusterOf(env));
  if (!i) return null;
  const t = { clusterArn: i.clusterArn, secretArn: i.secretArn, database: dbName(app, env) };
  const rows = await exec(t, `SELECT schemaname, relname FROM pg_stat_user_tables WHERE schemaname <> 'drizzle' ORDER BY 1, 2 LIMIT 100`);
  return Promise.all(rows.map(async (r) => {
    const schema = str(r[0]);
    const table = str(r[1]);
    const [c] = await exec(t, `SELECT count(*) FROM ${quote(schema)}.${quote(table)}`);
    return { name: schema === "public" ? table : `${schema}.${table}`, rows: num(c?.[0]) };
  }));
}

export async function summary(app: string, env: DbEnv = "prod"): Promise<DataSummary> {
  const tables = await modelTables(app, env);
  const [models, sql] = await Promise.all([
    Promise.all(Object.entries(tables).map(async ([name, t]) => ({ name, rows: await countTable(t) }))),
    sqlTables(app, env),
  ]);
  return { env, models, sql };
}
