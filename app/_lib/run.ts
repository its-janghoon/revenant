// One run by id, checked against its project's owner.
import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import type { User } from "./auth";
import { notFound } from "./http";
import { findProject, type RunRow } from "./store";

const UUID = /^[0-9a-f-]{36}$/i;

export async function findRun(u: User | null, id: string, opts: { read?: boolean } = {}): Promise<RunRow> {
  if (!UUID.test(id)) throw notFound("No such run");
  const [r] = await db.select().from(schema.runs).where(eq(schema.runs.id, id));
  if (!r) throw notFound("No such run");
  if (u) await findProject(u, r.projectId, opts);
  return r;
}
