// Read models for the admin screens: one place for the SQL, the screens only format.
import "server-only";
import { and, desc, eq, gte, isNull, ne, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { ProjectStatus } from "@/lib/contracts";
import { db, schema } from "@/lib/db/client";
import { env } from "@/lib/env";
import pkg from "@/package.json";

const { projects, runs, deploys, repairs, previews, costs } = schema;

// ---------- dates (UTC, the same days Cost Explorer uses) ----------

const DAY = 86_400_000;
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
export const today = () => isoDay(Date.now());
export const sinceDay = (days: number) => isoDay(Date.now() - (days - 1) * DAY);
export const monthStart = () => today().slice(0, 8) + "01";

export const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
export const int = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n));
/** timestamptz column on or after a UTC day; the day goes in as text and is cast in SQL. */
const after = (col: AnyPgColumn, day: string) => sql`${col} >= ${day}::date`;
export const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v) || 0);

/** Splits `days` days ending today into `n` buckets and returns bar heights in percent. */
export function spark(rows: { day: string; v: number }[], days: number, n = 12): number[] {
  const start = Date.parse(sinceDay(days));
  const b = Array<number>(n).fill(0);
  for (const r of rows) {
    const i = Math.floor(((Date.parse(r.day) - start) / DAY) * (n / days));
    if (i >= 0 && i < n) b[i] = (b[i] ?? 0) + r.v;
  }
  const max = Math.max(...b);
  return b.map((v) => (max > 0 ? Math.max(Math.round((v / max) * 100), v > 0 ? 6 : 0) : 0));
}

// ---------- install ----------

export function install() {
  const account = env.RV_DB_CLUSTER_ARN.split(":")[4] ?? "";
  return { version: pkg.version, region: env.AWS_REGION, account: account.replace(/(\d{4})(?=\d)/g, "$1-") };
}

// ---------- spend and credits ----------

export async function spendByDay(since: string) {
  const rows = await db
    .select({ day: costs.day, usd: sql<string>`sum(${costs.usageUsd})` })
    .from(costs)
    .where(gte(costs.day, since))
    .groupBy(costs.day);
  return rows.map((r) => ({ day: r.day, v: num(r.usd) }));
}

export async function spendByProject(since: string) {
  const rows = await db
    .select({ projectId: costs.projectId, usd: sql<string>`sum(${costs.usageUsd})` })
    .from(costs)
    .where(gte(costs.day, since))
    .groupBy(costs.projectId);
  return new Map(rows.map((r) => [r.projectId, num(r.usd)]));
}

export async function creditsByDay(since: string) {
  const day = sql<string>`to_char(${runs.startedAt}, 'YYYY-MM-DD')`;
  const rows = await db
    .select({ day, credits: sql<string>`sum(${runs.credits})` })
    .from(runs)
    .where(after(runs.startedAt, since))
    .groupBy(day);
  return rows.map((r) => ({ day: r.day, v: num(r.credits) }));
}

/** Per owner since `since`: apps, AWS spend, Kiro credits. */
export async function ownerStats(since: string) {
  const [apps, spend, credits] = await Promise.all([
    db.select({ owner: projects.owner, n: sql<number>`count(*)::int` }).from(projects).where(ne(projects.status, "deleted")).groupBy(projects.owner),
    db
      .select({ owner: projects.owner, usd: sql<string>`sum(${costs.usageUsd})` })
      .from(costs)
      .innerJoin(projects, eq(costs.projectId, projects.id))
      .where(gte(costs.day, since))
      .groupBy(projects.owner),
    db
      .select({ owner: projects.owner, credits: sql<string>`sum(${runs.credits})` })
      .from(runs)
      .innerJoin(projects, eq(runs.projectId, projects.id))
      .where(after(runs.startedAt, since))
      .groupBy(projects.owner),
  ]);
  const m = new Map<string, { apps: number; usd: number; credits: number }>();
  const get = (o: string) => m.get(o) ?? (m.set(o, { apps: 0, usd: 0, credits: 0 }), m.get(o)!);
  for (const r of apps) get(r.owner).apps = num(r.n);
  for (const r of spend) get(r.owner).usd = num(r.usd);
  for (const r of credits) get(r.owner).credits = num(r.credits);
  return m;
}

// ---------- repairs ----------

const repairProject = sql<string>`coalesce(${deploys.projectId}, ${runs.projectId})`;

/** Finished repair incidents per project: recovered vs gave up, average time to recover. */
export async function repairStats(since?: string) {
  const rows = await db
    .select({
      projectId: repairProject,
      ok: sql<number>`(count(*) filter (where ${repairs.outcome} = 'recovered'))::int`,
      lost: sql<number>`(count(*) filter (where ${repairs.outcome} = 'gave_up'))::int`,
      avgS: sql<number | null>`(avg(${repairs.recoveredS}) filter (where ${repairs.outcome} = 'recovered'))::float8`,
    })
    .from(repairs)
    .leftJoin(deploys, eq(repairs.deployId, deploys.id))
    .leftJoin(runs, eq(repairs.runId, runs.id))
    .where(since ? after(repairs.createdAt, since) : undefined)
    .groupBy(repairProject);
  return new Map(rows.map((r) => [r.projectId, { ok: num(r.ok), lost: num(r.lost), avgS: r.avgS === null ? null : num(r.avgS) }]));
}

export async function repairsByDay(since: string) {
  const day = sql<string>`to_char(${repairs.createdAt}, 'YYYY-MM-DD')`;
  const rows = await db
    .select({ day, n: sql<number>`count(*)::int` })
    .from(repairs)
    .where(and(after(repairs.createdAt, since), ne(repairs.outcome, "running")))
    .groupBy(day);
  return rows.map((r) => ({ day: r.day, v: num(r.n) }));
}

/** The latest repair attempt per project, for "needs attention". */
export async function lastRepairs(since: string) {
  const rows = await db
    .select({ projectId: repairProject, attempt: repairs.attempt, outcome: repairs.outcome })
    .from(repairs)
    .leftJoin(deploys, eq(repairs.deployId, deploys.id))
    .leftJoin(runs, eq(repairs.runId, runs.id))
    .where(after(repairs.createdAt, since))
    .orderBy(desc(repairs.createdAt));
  const m = new Map<string, { attempt: number; outcome: string }>();
  for (const r of rows) if (!m.has(r.projectId)) m.set(r.projectId, { attempt: r.attempt, outcome: r.outcome });
  return m;
}

// ---------- apps ----------

export interface AppRow {
  id: string;
  name: string;
  owner: string;
  status: ProjectStatus;
  prodUrl: string | null;
  createdAt: string;
  expiresAt: string | null;
  previews: number;
  sql: boolean;
}

export async function listApps(): Promise<AppRow[]> {
  const [rows, pv] = await Promise.all([
    db.select().from(projects).where(ne(projects.status, "deleted")).orderBy(desc(projects.createdAt)),
    db
      .select({
        projectId: previews.projectId,
        open: sql<number>`(count(*) filter (where ${previews.deletedAt} is null))::int`,
        sql: sql<boolean>`bool_or(${previews.dbName} is not null)`,
      })
      .from(previews)
      .groupBy(previews.projectId),
  ]);
  const p = new Map(pv.map((r) => [r.projectId, r]));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    owner: r.owner,
    status: r.status,
    prodUrl: r.prodUrl,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    previews: num(p.get(r.id)?.open),
    sql: Boolean(p.get(r.id)?.sql),
  }));
}

export async function openPreviews(): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(previews).where(isNull(previews.deletedAt));
  return num(r?.n);
}

export async function getApp(id: string) {
  const [r] = await db.select().from(projects).where(and(eq(projects.id, id), ne(projects.status, "deleted")));
  return r ?? null;
}

/**
 * Deleting an app hands it to the cleanup job (lib/cleanup, lane L6): expires_at = now, and the
 * job removes the Amplify app, its branches, previews and repo like any expired judge project.
 */
export async function expireApp(id: string): Promise<void> {
  await db.update(projects).set({ expiresAt: sql`now()` }).where(eq(projects.id, id));
}
