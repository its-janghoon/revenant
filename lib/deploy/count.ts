// Records a model change touches in production (Requirement 6.6): a removed model counts its
// items, a removed or renamed field counts the items that have a value for it.
import "server-only";
import { ScanCommand, type ScanCommandInput } from "@aws-sdk/client-dynamodb";
import type { ModelChange } from "../guard";
import { dynamo } from "./aws";
import type { Deployed } from "./stacks";

const TABLE_TYPES = new Set(["Custom::AmplifyDynamoDBTable", "AWS::DynamoDB::Table"]);
const MAX_PAGES = 200;

/** Prod table of an Amplify Data model: Gen 2 names it <Model>-<apiId>-NONE. */
export function tableOf(prod: Deployed, model: string): string | null {
  const t = prod.physical.find((r) => TABLE_TYPES.has(r.type) && r.physicalId.startsWith(`${model}-`));
  if (t) return t.physicalId;
  const api = prod.physical.find((r) => r.type === "AWS::AppSync::GraphQLApi");
  const id = api?.physicalId.split("/").pop();
  return id ? `${model}-${id}-NONE` : null;
}

/** Item count, exact up to MAX_PAGES scan pages; `capped` when it stopped early. */
export async function countItems(table: string, field?: string): Promise<{ count: number; capped: boolean }> {
  let count = 0;
  let start: ScanCommandInput["ExclusiveStartKey"];
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await dynamo.send(new ScanCommand({
      TableName: table,
      Select: "COUNT",
      ExclusiveStartKey: start,
      ...(field ? { FilterExpression: "attribute_exists(#f)", ExpressionAttributeNames: { "#f": field } } : {}),
    }));
    count += r.Count ?? 0;
    start = r.LastEvaluatedKey;
    if (!start) return { count, capped: false };
  }
  return { count, capped: true };
}

export interface Affected { change: ModelChange; table: string | null; records: number | null; capped: boolean }

export async function affected(prod: Deployed | null, changes: ModelChange[]): Promise<Affected[]> {
  const out: Affected[] = [];
  for (const c of changes) {
    if (c.kind !== "removeModel" && c.kind !== "removeField") continue;
    const table = prod ? tableOf(prod, c.model) : null;
    if (!table) {
      out.push({ change: c, table: null, records: prod ? null : 0, capped: false });
      continue;
    }
    try {
      const r = await countItems(table, c.kind === "removeField" ? c.field : undefined);
      out.push({ change: c, table, records: r.count, capped: r.capped });
    } catch (e) {
      if ((e as Error).name !== "ResourceNotFoundException") throw e;
      out.push({ change: c, table, records: 0, capped: false });
    }
  }
  return out;
}
