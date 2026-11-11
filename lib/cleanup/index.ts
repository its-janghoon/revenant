// Cleanup (Requirement 11.4, design "Cleanup"). Run once a day or more often; every step is
// idempotent, so a run that stops halfway finishes on the next one.
// - previews whose branch is merged or closed, or older than PREVIEW_MAX_AGE_DAYS:
//   delete the Amplify branch, its backend stacks and its database.
// - projects past expires_at (24 h judge projects on the demo install): delete everything.
import "server-only";
import { and, asc, eq, gt, isNotNull, isNull, lt, ne } from "drizzle-orm";
import { PREVIEW_MAX_AGE_DAYS, type TimelineEvent } from "../contracts";
import { deleteApplication } from "../console/registry";
import { envOf } from "../console/name";
import { db, schema } from "../db/client";
import {
  branchState, deleteApp, deleteBranch, deleteRepo, deleteStacks, dropPreviewDb, envTag, projectTag, timeline,
} from "./aws";

const DAY = 86_400_000;
const RETRY_DAYS = 3; // keep retrying stack deletes this long after a delete
const MAX_PREVIEWS = 25; // per run, to stay inside one request
const MAX_PROJECTS = 5;

export type PreviewReason = "merged" | "closed" | "expired";
export interface CleanupResult {
  previews: { id: string; branch: string; reason: PreviewReason }[];
  projects: { id: string; name: string }[];
  stacksLeft: number; // backend stacks still deleting
  errors: string[];
}

interface PreviewRow {
  id: string;
  projectId: string;
  branch: string;
  dbName: string | null;
  createdAt: string;
  repo: string | null;
  amplifyAppId: string | null;
}

/** expires_at for a new project from the admin's auto-delete setting (null = off). */
export function expiryFor(createdAt: Date, autoDeleteHours: number | null): string | null {
  return autoDeleteHours ? new Date(createdAt.getTime() + autoDeleteHours * 3_600_000).toISOString() : null;
}

async function reasonFor(p: PreviewRow, now: Date): Promise<PreviewReason | null> {
  if (now.getTime() - Date.parse(p.createdAt) > PREVIEW_MAX_AGE_DAYS * DAY) return "expired";
  if (!p.repo) return null;
  const s = await branchState(p.repo, p.branch);
  return s === "open" ? null : s;
}

/** Deletes one preview's Amplify branch, backend stacks and database, then marks it deleted. */
export async function deletePreview(p: PreviewRow, reason: PreviewReason, now = new Date()): Promise<number> {
  const env = envOf(p.branch);
  if (!env.startsWith("pv")) throw new Error(`${p.branch} is not a preview branch`); // never touch prod or dev
  if (p.amplifyAppId) await deleteBranch(p.amplifyAppId, p.branch);
  const left = await deleteStacks([projectTag(p.projectId), envTag(env)]);
  if (p.dbName) await dropPreviewDb(p.projectId, p.dbName);
  await db.update(schema.previews).set({ deletedAt: now.toISOString() }).where(eq(schema.previews.id, p.id));
  const ev: TimelineEvent = { projectId: p.projectId, at: now.toISOString(), kind: "preview_deleted", text: `${p.branch} deleted (${reason})` };
  await timeline([ev]);
  return left;
}

/** Deletes a whole generated app: Amplify app, every tagged stack, repo, resource group. */
export async function deleteProject(
  p: { id: string; name: string; repo: string | null; amplifyAppId: string | null },
  actor = "cleanup",
  now = new Date(),
): Promise<number> {
  if (p.amplifyAppId) await deleteApp(p.amplifyAppId);
  const left = await deleteStacks([projectTag(p.id)]);
  if (p.repo) await deleteRepo(p.repo);
  await deleteApplication(p.name);
  const at = now.toISOString();
  await db.update(schema.previews).set({ deletedAt: at }).where(and(eq(schema.previews.projectId, p.id), isNull(schema.previews.deletedAt)));
  await db.update(schema.projects).set({ status: "deleted" }).where(eq(schema.projects.id, p.id));
  await db.insert(schema.audit).values({ actor, action: "project.delete", detail: { project: p.id, name: p.name }, at });
  return left;
}

const message = (what: string, e: unknown) => `${what}: ${(e as Error).name}: ${(e as Error).message}`;

export async function cleanup(now = new Date()): Promise<CleanupResult> {
  const out: CleanupResult = { previews: [], projects: [], stacksLeft: 0, errors: [] };
  const retrySince = new Date(now.getTime() - RETRY_DAYS * DAY).toISOString();
  const nowIso = now.toISOString();

  // previews
  const previewCols = {
    id: schema.previews.id,
    projectId: schema.previews.projectId,
    branch: schema.previews.branch,
    dbName: schema.previews.dbName,
    createdAt: schema.previews.createdAt,
    repo: schema.projects.repo,
    amplifyAppId: schema.projects.amplifyAppId,
  };
  const open = await db.select(previewCols).from(schema.previews)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.previews.projectId))
    .where(and(isNull(schema.previews.deletedAt), ne(schema.projects.status, "deleted")))
    .orderBy(asc(schema.previews.createdAt));
  for (const p of open) {
    if (out.previews.length >= MAX_PREVIEWS) break;
    try {
      const reason = await reasonFor(p, now);
      if (!reason) continue;
      out.stacksLeft += await deletePreview(p, reason, now);
      out.previews.push({ id: p.id, branch: p.branch, reason });
    } catch (e) {
      out.errors.push(message(`preview ${p.id}`, e));
    }
  }

  // stacks of recently deleted previews that were still deleting or failed to delete
  const recent = await db.select({ projectId: schema.previews.projectId, branch: schema.previews.branch }).from(schema.previews)
    .where(and(isNotNull(schema.previews.deletedAt), gt(schema.previews.deletedAt, retrySince), lt(schema.previews.deletedAt, nowIso)));
  for (const p of recent) {
    const env = envOf(p.branch);
    if (!env.startsWith("pv")) continue;
    try {
      out.stacksLeft += await deleteStacks([projectTag(p.projectId), envTag(env)]);
    } catch (e) {
      out.errors.push(message(`preview stacks ${p.projectId} ${p.branch}`, e));
    }
  }

  // expired projects (expires_at), then stacks of recently expired ones
  const projectCols = { id: schema.projects.id, name: schema.projects.name, repo: schema.projects.repo, amplifyAppId: schema.projects.amplifyAppId };
  const expired = await db.select(projectCols).from(schema.projects)
    .where(and(isNotNull(schema.projects.expiresAt), lt(schema.projects.expiresAt, nowIso), ne(schema.projects.status, "deleted")))
    .orderBy(asc(schema.projects.expiresAt))
    .limit(MAX_PROJECTS);
  for (const p of expired) {
    try {
      out.stacksLeft += await deleteProject(p, "cleanup", now);
      out.projects.push({ id: p.id, name: p.name });
    } catch (e) {
      out.errors.push(message(`project ${p.id}`, e));
    }
  }
  const gone = await db.select({ id: schema.projects.id }).from(schema.projects)
    .where(and(eq(schema.projects.status, "deleted"), isNotNull(schema.projects.expiresAt), gt(schema.projects.expiresAt, retrySince)));
  for (const p of gone) {
    if (out.projects.some((x) => x.id === p.id)) continue;
    try {
      out.stacksLeft += await deleteStacks([projectTag(p.id)]);
    } catch (e) {
      out.errors.push(message(`project stacks ${p.id}`, e));
    }
  }
  return out;
}
