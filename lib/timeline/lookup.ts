// runs.codebuild_id lookup for the timeline writer. Takes the db instead of importing
// lib/db/client, which is "server-only" and cannot load inside a Lambda function.
import { eq, like, or } from "drizzle-orm";
import type { AwsDataApiPgDatabase } from "drizzle-orm/aws-data-api/pg";
import * as schema from "../db/schema";
import { buildUuid, type Lookup } from "./writer";

export type Db = AwsDataApiPgDatabase<typeof schema>;

export function runLookup(db: Db): Lookup {
  const cache = new Map<string, Awaited<ReturnType<Lookup>>>();
  return async (id) => {
    const uuid = buildUuid(id);
    if (cache.has(uuid)) return cache.get(uuid)!;
    const { runs } = schema;
    const [row] = await db
      .select({ projectId: runs.projectId, runId: runs.id, credits: runs.credits })
      .from(runs)
      .where(or(eq(runs.codebuildId, uuid), like(runs.codebuildId, `%:${uuid}`)))
      .limit(1);
    const ref = row ?? null;
    cache.set(uuid, ref);
    return ref;
  };
}
