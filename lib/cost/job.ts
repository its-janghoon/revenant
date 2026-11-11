// Daily cost job (Requirement 8.2): Cost Explorer usage and credits per revenant:project
// tag, written to the costs table. It re-reads the month so far (and at least the last 3
// days, since AWS revises recent days), so a missed day heals on the next run.
import "server-only";
import { inArray, sql } from "drizzle-orm";
import { db, schema } from "../db/client";
import { activateTag, addDays, byProject, day, monthStart, type Range } from "./explorer";

export interface CostJobResult { range: Range; rows: number; tagActive: boolean }

export async function costJob(now = new Date()): Promise<CostJobResult> {
  const end = day(now);
  const back = day(addDays(now, -3));
  const first = day(monthStart(now));
  const range = { start: first < back ? first : back, end };

  const tagActive = await activateTag();
  const [usage, credit] = await Promise.all([byProject(range, "Usage"), byProject(range, "Credit")]);

  const ids = [...new Set([...usage.keys(), ...credit.keys()])].filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  const known = ids.length
    ? new Set((await db.select({ id: schema.projects.id }).from(schema.projects).where(inArray(schema.projects.id, ids))).map((r) => r.id))
    : new Set<string>();

  const rows: (typeof schema.costs.$inferInsert)[] = [];
  for (const projectId of known) {
    const u = usage.get(projectId) ?? new Map<string, number>();
    const c = credit.get(projectId) ?? new Map<string, number>();
    for (const d of new Set([...u.keys(), ...c.keys()])) {
      rows.push({ projectId, day: d, usageUsd: (u.get(d) ?? 0).toFixed(4), creditUsd: (c.get(d) ?? 0).toFixed(4) });
    }
  }

  for (let i = 0; i < rows.length; i += 200) {
    await db.insert(schema.costs).values(rows.slice(i, i + 200)).onConflictDoUpdate({
      target: [schema.costs.projectId, schema.costs.day],
      set: { usageUsd: sql`excluded.usage_usd`, creditUsd: sql`excluded.credit_usd` },
    });
  }
  return { range, rows: rows.length, tagActive };
}
