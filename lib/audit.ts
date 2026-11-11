// Append-only audit log. Every admin change calls audit(); other lanes may record their own
// actions too (repair.merged, publish.approved, preview.expired). Never update or delete rows.
import "server-only";
import { desc, sql } from "drizzle-orm";
import { db, schema } from "./db/client";

export type AuditDetail = Record<string, unknown>;

export interface AuditEntry {
  id: string;
  actor: string; // admin email, "system", or "kiro · repair"
  action: string; // dotted, e.g. policy.sql_user_on
  detail: AuditDetail | null;
  at: string;
}

export async function audit(actor: string, action: string, detail?: AuditDetail): Promise<void> {
  await db.insert(schema.audit).values({ actor, action, detail: detail ?? null });
}

/** Newest first. Pass the `at` of the last row as `before` for the next page. */
export async function listAudit(opts: { limit?: number; before?: string } = {}): Promise<AuditEntry[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const rows = await db
    .select()
    .from(schema.audit)
    .where(opts.before ? sql`${schema.audit.at} < ${opts.before}::timestamptz` : undefined)
    .orderBy(desc(schema.audit.at))
    .limit(limit);
  return rows.map((r) => ({ ...r, detail: (r.detail as AuditDetail | null) ?? null }));
}
