// Revenant's own data for the screens, always scoped to the owner.
import "server-only";
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { DEFAULT_SETTINGS, type Project, type Settings } from "@/lib/contracts";
import { db, schema } from "@/lib/db/client";
import type { User } from "./auth";
import { notFound } from "./http";

const { projects, runs, tasks, deploys, repairs, previews, costs, settings, userPolicies } = schema;

export type ProjectRow = typeof projects.$inferSelect;
export type RunRow = typeof runs.$inferSelect;

export function toProject(r: ProjectRow): Project {
  return {
    id: r.id, owner: r.owner, name: r.name, request: r.request, repo: r.repo, amplifyAppId: r.amplifyAppId,
    prodUrl: r.prodUrl, status: r.status, createdAt: r.createdAt, expiresAt: r.expiresAt,
  };
}

export async function getSettings(): Promise<Settings> {
  const rows = await db.select().from(settings).where(inArray(settings.key, Object.keys(DEFAULT_SETTINGS)));
  const out: Settings = { ...DEFAULT_SETTINGS };
  for (const r of rows) (out as unknown as Record<string, unknown>)[r.key] = r.value;
  return out;
}

export async function sqlAllowedFor(u: User, s?: Settings): Promise<boolean> {
  const [p] = await db.select().from(userPolicies).where(eq(userPolicies.userId, u.sub));
  return p?.sqlAllowed ?? (s ?? (await getSettings())).sqlAllowed;
}

// Per-user flags live in the settings table as "user:<sub>:<flag>" (no migration needed).
export async function getFlag(u: User, flag: string): Promise<unknown> {
  const [r] = await db.select().from(settings).where(eq(settings.key, `user:${u.sub}:${flag}`));
  return r?.value ?? null;
}
export async function setFlag(u: User, flag: string, value: unknown): Promise<void> {
  const key = `user:${u.sub}:${flag}`;
  await db.insert(settings).values({ key, value, updatedBy: u.sub })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date().toISOString() } });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** By id or by name, only the owner's, never deleted ones. */
export async function findProject(u: User, idOrName: string): Promise<ProjectRow> {
  const by = UUID.test(idOrName) ? eq(projects.id, idOrName) : eq(projects.name, idOrName);
  const [p] = await db.select().from(projects).where(and(by, eq(projects.owner, u.sub)));
  if (!p || p.status === "deleted") throw notFound("No such app");
  return p;
}

export async function listProjects(u: User): Promise<ProjectRow[]> {
  return db.select().from(projects)
    .where(and(eq(projects.owner, u.sub), sql`${projects.status} <> 'deleted'`))
    .orderBy(desc(projects.createdAt));
}

export const monthStart = () => new Date().toISOString().slice(0, 8) + "01";

export async function monthCosts(ids: string[]): Promise<Map<string, { usage: number; credit: number }>> {
  const out = new Map<string, { usage: number; credit: number }>();
  if (!ids.length) return out;
  const rows = await db.select({
    projectId: costs.projectId,
    usage: sql<string>`coalesce(sum(${costs.usageUsd}), 0)`,
    credit: sql<string>`coalesce(sum(${costs.creditUsd}), 0)`,
  }).from(costs).where(and(inArray(costs.projectId, ids), gte(costs.day, monthStart()))).groupBy(costs.projectId);
  for (const r of rows) out.set(r.projectId, { usage: Number(r.usage), credit: Number(r.credit) });
  return out;
}

export async function monthCredits(ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!ids.length) return out;
  const rows = await db.select({ projectId: runs.projectId, credits: sql<string>`coalesce(sum(${runs.credits}), 0)` })
    .from(runs).where(and(inArray(runs.projectId, ids), gte(runs.startedAt, monthStart()))).groupBy(runs.projectId);
  for (const r of rows) out.set(r.projectId, Number(r.credits));
  return out;
}

export async function projectRuns(id: string, limit = 50) {
  return db.select().from(runs).where(eq(runs.projectId, id)).orderBy(desc(runs.startedAt)).limit(limit);
}
export async function projectTasks(id: string) {
  return db.select().from(tasks).where(eq(tasks.projectId, id)).orderBy(tasks.number);
}
export async function projectDeploys(id: string, limit = 30) {
  return db.select().from(deploys).where(eq(deploys.projectId, id)).orderBy(desc(deploys.createdAt)).limit(limit);
}
export async function projectPreviews(id: string) {
  return db.select().from(previews).where(eq(previews.projectId, id)).orderBy(desc(previews.createdAt));
}
export async function projectRepairs(id: string, limit = 30) {
  const rows = await db.select({ r: repairs }).from(repairs)
    .leftJoin(deploys, eq(repairs.deployId, deploys.id))
    .leftJoin(runs, eq(repairs.runId, runs.id))
    .where(sql`coalesce(${deploys.projectId}, ${runs.projectId}) = ${id}`)
    .orderBy(desc(repairs.createdAt)).limit(limit);
  return rows.map((x) => x.r);
}

export async function livePreviews(id: string) {
  return db.select().from(previews).where(and(eq(previews.projectId, id), isNull(previews.deletedAt))).orderBy(desc(previews.createdAt));
}

/** "preview/12" -> 12 */
export const previewNumber = (branch: string) => Number(/^preview\/(\d+)$/.exec(branch)?.[1] ?? 0);

export async function nextPreviewBranch(id: string): Promise<string> {
  const all = await projectPreviews(id);
  const n = all.reduce((m, p) => Math.max(m, previewNumber(p.branch)), 0);
  return `preview/${n + 1}`;
}

/** The branch the agent and the Code tab work on: newest live preview, else the spec branch. */
export async function workBranch(id: string): Promise<string> {
  const [p] = await livePreviews(id);
  return p?.branch ?? SPEC_BRANCH;
}

// Spec runs push here; Amplify does not build rv/* branches.
export const SPEC_BRANCH = "rv/spec";
