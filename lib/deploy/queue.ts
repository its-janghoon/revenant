// Waiting line for preview deploys that cannot create their Amplify app yet. Amplify allows 25
// app creations an hour per account and region (fixed by AWS) and 25 apps per region (raised on
// request). A deploy that hits either limit waits here as a "queued" deploy row; the 5-minute
// tick (POST /api/cost/daily?job=tick) and the project's page polls start it again, oldest first.
// The row's created_at is the time of the last try.
import "server-only";
import { and, asc, eq, lt } from "drizzle-orm";
import type { Project } from "../contracts";
import { db, schema } from "../db/client";
import { event } from "./events";
import { deployPreview } from "./preview";

const { deploys, projects } = schema;
const RETRY_MS = 5 * 60_000;
const PER_TICK = 5;

/** True for Amplify's app-creation limits: wait and try again, do not fail the deploy. */
export function throttled(e: unknown): boolean {
  const x = e as { name?: string; message?: string };
  return /Rate exceeded|LimitExceeded|limit exceeded/i.test(`${x?.name ?? ""} ${x?.message ?? ""}`);
}

/** Puts the deploy in line (once per branch) and tells the user why it waits. */
export async function enqueue(project: Project, branch: string, commit: string): Promise<void> {
  const [waiting] = await db.select({ id: deploys.id }).from(deploys)
    .where(and(eq(deploys.projectId, project.id), eq(deploys.branch, branch), eq(deploys.status, "queued")));
  if (waiting) {
    await db.update(deploys).set({ commit, createdAt: new Date().toISOString() }).where(eq(deploys.id, waiting.id));
    return;
  }
  await db.insert(deploys).values({ projectId: project.id, branch, commit, status: "queued" });
  await event(project.id, "message", {
    from: "runner", branch,
    text: "Waiting for AWS: Amplify creates at most 25 new apps an hour in this account. The deploy starts by itself in a few minutes.",
  });
}

/** Starts queued deploys whose last try is older than 5 minutes. Stops at the first new limit hit. */
export async function drain(projectId?: string, now = new Date()): Promise<{ started: number; waiting: number }> {
  const due = new Date(now.getTime() - RETRY_MS).toISOString();
  const rows = await db.select().from(deploys)
    .where(and(eq(deploys.status, "queued"), lt(deploys.createdAt, due), ...(projectId ? [eq(deploys.projectId, projectId)] : [])))
    .orderBy(asc(deploys.createdAt)).limit(PER_TICK);
  let started = 0;
  for (const row of rows) {
    const [p] = await db.select().from(projects).where(eq(projects.id, row.projectId));
    if (!p || p.status === "deleted") {
      await db.update(deploys).set({ status: "failed" }).where(eq(deploys.id, row.id));
      continue;
    }
    // Claim the row: two instances draining at once must not create two apps.
    const [mine] = await db.update(deploys).set({ createdAt: now.toISOString() })
      .where(and(eq(deploys.id, row.id), eq(deploys.status, "queued"), lt(deploys.createdAt, due))).returning({ id: deploys.id });
    if (!mine) continue;
    try {
      await deployPreview({
        id: p.id, owner: p.owner, name: p.name, request: p.request, repo: p.repo, amplifyAppId: p.amplifyAppId,
        prodUrl: p.prodUrl, status: p.status, createdAt: p.createdAt, expiresAt: p.expiresAt,
      }, row.branch, row.commit);
      await db.delete(deploys).where(eq(deploys.id, row.id));
      started++;
    } catch (e) {
      if (throttled(e)) break; // still limited: keep the line as it is
      await db.update(deploys).set({ status: "failed" }).where(eq(deploys.id, row.id));
      await event(p.id, "deploy_failed", { deploy: row.id, branch: row.branch, step: "start", error: (e as Error).message });
    }
  }
  const left = await db.select({ id: deploys.id }).from(deploys).where(eq(deploys.status, "queued"));
  return { started, waiting: left.length };
}
