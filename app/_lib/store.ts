// Revenant's own data for the screens, always scoped to the owner.
import "server-only";
import { and, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import type { Project, Settings } from "@/lib/contracts";
import { getSettings as policySettings, isSqlAllowed } from "@/lib/policy";
import { db, schema } from "@/lib/db/client";
import type { User } from "./auth";
import { byNumber, head } from "./repo";
import { HttpError, notFound } from "./http";

const { projects, runs, tasks, deploys, previews, costs, settings } = schema;

export type ProjectRow = typeof projects.$inferSelect;
export type RunRow = typeof runs.$inferSelect;

export function toProject(r: ProjectRow): Project {
  return {
    id: r.id, owner: r.owner, name: r.name, request: r.request, repo: r.repo, amplifyAppId: r.amplifyAppId,
    prodUrl: r.prodUrl, status: r.status, createdAt: r.createdAt, expiresAt: r.expiresAt,
  };
}

// The install policy is lib/policy.ts (L9); these keep the screens' call sites short.
export const getSettings = (): Promise<Settings> => policySettings();
export const sqlAllowedFor = (u: User, _s?: Settings): Promise<boolean> => isSqlAllowed(u.sub);

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

/** Projects the owner can see: not deleted, and not handed to the cleanup job (expires_at passed). */
const visible = sql`${projects.status} <> 'deleted' and (${projects.expiresAt} is null or ${projects.expiresAt} > now())`;


/** Sample apps every signed-in user may open but not change: settings key "showcase", a list of project ids. */
export async function showcaseIds(): Promise<string[]> {
  const [r] = await db.select().from(settings).where(eq(settings.key, "showcase"));
  return Array.isArray(r?.value) ? (r.value as unknown[]).filter((v): v is string => typeof v === "string" && UUID.test(v)) : [];
}

/**
 * By id or by name, only the owner's, never deleted or expired ones. With `read`, a showcase app
 * opens for anyone; without it, a showcase app that is not yours answers 403 (view only).
 */
export async function findProject(u: User, idOrName: string, opts: { read?: boolean } = {}): Promise<ProjectRow> {
  const by = UUID.test(idOrName) ? eq(projects.id, idOrName) : eq(projects.name, idOrName);
  const [p] = await db.select().from(projects).where(and(by, visible));
  if (!p) throw notFound("No such app");
  if (p.owner === u.sub) return p;
  if (!(await showcaseIds()).includes(p.id)) throw notFound("No such app");
  if (opts.read) return p;
  throw new HttpError(403, "This sample app is view only. Build your own from Home.", "view_only");
}

export async function listProjects(u: User): Promise<ProjectRow[]> {
  const ids = await showcaseIds();
  return db.select().from(projects)
    .where(and(ids.length ? or(eq(projects.owner, u.sub), inArray(projects.id, ids)) : eq(projects.owner, u.sub), visible))
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
  return (await db.select().from(tasks).where(eq(tasks.projectId, id))).sort(byNumber);
}
export async function projectDeploys(id: string, limit = 30) {
  return db.select().from(deploys).where(eq(deploys.projectId, id)).orderBy(desc(deploys.createdAt)).limit(limit);
}

export async function livePreviews(id: string) {
  return db.select().from(previews).where(and(eq(previews.projectId, id), isNull(previews.deletedAt))).orderBy(desc(previews.createdAt));
}

/** The branch the agent and the Code tab work on: newest live preview, else the spec branch.
 * A preview whose first build failed has no git branch yet (the work stayed on the run's hold
 * branch), so until it exists the spec branch is still the work branch. */
export async function workBranch(id: string): Promise<string> {
  const [p] = await livePreviews(id);
  if (!p) return SPEC_BRANCH;
  const [row] = await db.select({ repo: projects.repo }).from(projects).where(eq(projects.id, id));
  if (row?.repo && !(await head(row.repo, p.branch))) return SPEC_BRANCH;
  return p.branch;
}

// Spec runs push here; Amplify does not build rv/* branches.
export const SPEC_BRANCH = "rv/spec";
