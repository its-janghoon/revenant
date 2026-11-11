// Follows open deploys to their end: reads the Amplify job, runs the health check when it
// succeeded (Requirement 5.6), and records live or failed. Called when deploys are listed and
// from any scheduler; every step is a conditional update, so calling it twice is harmless.
import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import type { Deploy, Project } from "../contracts";
import { db, schema } from "../db/client";
import { PROD, branchUrl, jobFor } from "./amplify";
import { deployEnv } from "./env";
import { event } from "./events";
import { health } from "./health";
import { getHooks } from "./hooks";
import { advance } from "./publish";

const RUNNING = new Set(["PENDING", "PROVISIONING", "RUNNING", "CANCELLING"]);

async function finish(project: Project, d: Deploy, status: "live" | "failed", url: string | null, detail: Record<string, unknown>): Promise<Deploy> {
  const [row] = await db.update(schema.deploys)
    .set({ status, url })
    .where(and(eq(schema.deploys.id, d.id), eq(schema.deploys.status, "running")))
    .returning();
  if (!row) return d;
  const prod = d.branch === PROD;
  if (status === "live") {
    const custom = project.prodUrl && !project.prodUrl.includes(".amplifyapp.com");
    await db.update(schema.projects)
      .set(prod ? { status: "live", ...(custom ? {} : { prodUrl: url }) } : { status: project.status === "live" ? "live" : "preview" })
      .where(eq(schema.projects.id, project.id));
    await event(project.id, "deploy_live", { deploy: d.id, branch: d.branch, url, ...detail });
    if (prod) await event(project.id, "published", { deploy: d.id, commit: d.commit, url });
  } else {
    await db.update(schema.projects).set({ status: "dead" }).where(eq(schema.projects.id, project.id));
    await event(project.id, "deploy_failed", { deploy: d.id, branch: d.branch, ...detail });
  }
  return row as Deploy;
}

export async function settle(project: Project, d: Deploy): Promise<Deploy> {
  if (d.status === "pending") return advance(project, d);
  if (d.status !== "running" || !project.amplifyAppId) return d;
  const job = await jobFor(project.amplifyAppId, d.branch, d.commit);
  const s = job?.status;
  if (!s || RUNNING.has(s)) return d;
  if (s !== "SUCCEED") return finish(project, d, "failed", null, { step: "amplify", job: job?.jobId, status: s });

  const url = await branchUrl(project.amplifyAppId, d.branch);
  const h = await health(url, deployEnv.RV_HEALTH_WAIT_S);
  if (h.ok) return finish(project, d, "live", url, { health: h.status });
  const out = await finish(project, d, "failed", url, { step: "health", status: h.status, error: h.error ?? null });
  if (out.status === "failed") await getHooks().failed?.(out, `health check of ${url} returned ${h.status ?? h.error}`);
  return out;
}

/** Settles every open deploy of the project. */
export async function settleAll(project: Project): Promise<void> {
  const open = await db.select().from(schema.deploys)
    .where(and(eq(schema.deploys.projectId, project.id), inArray(schema.deploys.status, ["pending", "running"])));
  for (const d of open) {
    try {
      await settle(project, d as Deploy);
    } catch (e) {
      console.error("settle failed", d.id, (e as Error).name);
    }
  }
}
