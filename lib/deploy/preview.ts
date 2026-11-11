// Preview branches (Requirement 5.3): every change gets its own Amplify branch preview/<n> with
// its own backend (own tables, seeded), so a preview never replaces data anyone relies on.
// Destructive changes are judged against production at publish.
//   1. nextPreview(project)  -> branch name for the runner's BRANCH (and the SQL preview database)
//   2. the runner pushes the branch after its checks pass (runner/check.sh runs the guard)
//   3. deployPreview(project, branch, commit) -> Amplify job; settle() follows it to live or failed
import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Deploy, Preview, Project } from "../contracts";
import { db, schema } from "../db/client";
import { ensureApp, ensureBranch, previewBranch, previewNumber, startJob } from "./amplify";
import { event } from "./events";
import { sqlFor } from "./hooks";

export async function previewsOf(projectId: string): Promise<Preview[]> {
  return (await db.select().from(schema.previews).where(eq(schema.previews.projectId, projectId)).orderBy(desc(schema.previews.createdAt))) as Preview[];
}

/** Reserves the next preview number. For SQL apps it also creates <app>_pv<n> from <app>_dev. */
export async function nextPreview(project: Project): Promise<{ n: number; branch: string; dbName: string | null }> {
  const all = await previewsOf(project.id);
  const n = 1 + Math.max(0, ...all.map((p) => previewNumber(p.branch) ?? 0));
  const branch = previewBranch(n);
  const sql = await sqlFor(project);
  const dbName = sql ? await sql.previewDb(project, n) : null;
  await db.insert(schema.previews).values({ projectId: project.id, branch, dbName });
  await event(project.id, "preview_created", { branch, dbName });
  return { n, branch, dbName };
}

/** Deploys `commit` of preview/<n> (already pushed). Returns the deploy row, status running. */
export async function deployPreview(project: Project, branch: string, commit: string): Promise<Deploy> {
  if (previewNumber(branch) === null) throw new Error(`not a preview branch: ${branch}`);
  const [known] = await db.select().from(schema.previews)
    .where(and(eq(schema.previews.projectId, project.id), eq(schema.previews.branch, branch), isNull(schema.previews.deletedAt)))
    .limit(1);
  if (!known) await db.insert(schema.previews).values({ projectId: project.id, branch, dbName: null });

  const appId = await ensureApp(project);
  await ensureBranch(project, appId, branch);
  const [row] = await db.insert(schema.deploys).values({ projectId: project.id, branch, commit, status: "pending" }).returning();
  try {
    await startJob(appId, branch, commit);
  } catch (e) {
    await db.update(schema.deploys).set({ status: "failed" }).where(eq(schema.deploys.id, row!.id));
    await event(project.id, "deploy_failed", { deploy: row!.id, branch, step: "start", error: (e as Error).message });
    throw e;
  }
  const [running] = await db.update(schema.deploys).set({ status: "running" }).where(eq(schema.deploys.id, row!.id)).returning();
  await event(project.id, "deploy_started", { deploy: row!.id, branch, commit });
  return running as Deploy;
}
