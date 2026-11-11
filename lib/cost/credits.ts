// Kiro credits per run, rolled up (Requirement 8.4). Each run row holds the credits it
// used (runs.credits, from the runner's run_done line) and whose Kiro paid (kiro_payer):
// "company" is the install's key, "own" is the project owner's key.
import "server-only";
import { and, eq, gte, sql, type SQL } from "drizzle-orm";
import type { KiroPayer } from "../contracts";
import { db, schema } from "../db/client";

export interface KiroSplit { total: number; company: number; own: number; runs: number }
export interface KiroCredits extends KiroSplit {
  byProject: Record<string, KiroSplit>;
  byOwner: Record<string, KiroSplit>; // Cognito sub of the project owner
}

const empty = (): KiroSplit => ({ total: 0, company: 0, own: 0, runs: 0 });
function add(s: KiroSplit, payer: KiroPayer, credits: number, runs: number) {
  s.total += credits;
  s[payer] += credits;
  s.runs += runs;
}

export async function kiroCredits(filter: { projectId?: string; owner?: string; since?: string } = {}): Promise<KiroCredits> {
  const where: SQL[] = [];
  if (filter.projectId) where.push(eq(schema.runs.projectId, filter.projectId));
  if (filter.owner) where.push(eq(schema.projects.owner, filter.owner));
  if (filter.since) where.push(gte(schema.runs.startedAt, filter.since));

  const rows = await db
    .select({
      projectId: schema.runs.projectId,
      owner: schema.projects.owner,
      payer: schema.runs.kiroPayer,
      credits: sql<string>`coalesce(sum(${schema.runs.credits}), 0)`,
      runs: sql<string>`count(*)`,
    })
    .from(schema.runs)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.runs.projectId))
    .where(where.length ? and(...where) : undefined)
    .groupBy(schema.runs.projectId, schema.projects.owner, schema.runs.kiroPayer);

  const out: KiroCredits = { ...empty(), byProject: {}, byOwner: {} };
  for (const r of rows) {
    const credits = Number(r.credits);
    const runs = Number(r.runs);
    add(out, r.payer, credits, runs);
    add((out.byProject[r.projectId] ??= empty()), r.payer, credits, runs);
    add((out.byOwner[r.owner] ??= empty()), r.payer, credits, runs);
  }
  return out;
}
