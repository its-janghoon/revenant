// Shapes and events for the Kiro Crew app (crew-app/README.md, "Revenant API").
import "server-only";
import { and, desc, eq, gt, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import type { User } from "./auth";
import { detail } from "./project";
import { listProjects, type ProjectRow } from "./store";

type Status = "spec" | "building" | "preview" | "publishing" | "live" | "dead" | "repairing";

export interface CrewProject {
  id: string; name: string; status: Status; url: string; specUrl: string; previewUrl: string | null; prodUrl: string | null;
  costUsd: number | null; creditUsd: number | null; updatedAt: string;
}
interface CrewRun { id: string; mode: "spec" | "build" | "change" | "repair"; status: "queued" | "running" | "succeeded" | "failed"; startedAt: string | null; endedAt: string | null }
interface CrewDeploy { id: string; branch: string; status: "running" | "succeeded" | "failed"; url: string | null }
interface CrewRepair { id: string; attempt: number; cause: string; outcome: "running" | "recovered" | "gave_up"; recoveredS: number | null }
export interface CrewDetail extends CrewProject {
  tasks: { done: number; total: number }; lastRun: CrewRun | null; lastDeploy: CrewDeploy | null; lastRepair: CrewRepair | null;
}
interface CrewEvent {
  id: string; projectId: string; projectName: string; kind: "build" | "deploy" | "repair";
  outcome: "succeeded" | "failed" | "recovered" | "gave_up"; at: string; url: string; detail?: string;
}

/** Absolute base URL of this Revenant, from the request (Amplify sits behind CloudFront). */
export function origin(req: Request): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}

const crewStatus = (s: ProjectRow["status"], publishing: boolean): Status =>
  publishing ? "publishing" : s === "stopped" || s === "deleted" ? "dead" : s;

const runOut = (r: typeof schema.runs.$inferSelect): CrewRun => ({
  id: r.id, mode: r.mode,
  status: r.status === "queued" || r.status === "running" || r.status === "succeeded" ? r.status : "failed",
  startedAt: r.startedAt, endedAt: r.endedAt,
});
const deployOut = (d: typeof schema.deploys.$inferSelect): CrewDeploy => ({
  id: d.id, branch: d.branch, url: d.url, status: d.status === "live" ? "succeeded" : d.status === "failed" ? "failed" : "running",
});

export async function crewDetail(base: string, u: User, p: ProjectRow): Promise<CrewDetail> {
  const d = await detail(u, p);
  const lastRun = d.runs[0];
  const lastDeploy = d.deploys[0];
  const lastRepair = d.repairs[0];
  const publishing = Boolean(lastDeploy && lastDeploy.branch === "main" && lastDeploy.status !== "live" && lastDeploy.status !== "failed");
  const times = [d.project.createdAt, lastRun?.endedAt, lastRun?.startedAt, lastDeploy?.createdAt, lastRepair?.createdAt].filter((x): x is string => Boolean(x)).sort();
  return {
    id: p.id, name: p.name, status: crewStatus(d.project.status, publishing),
    url: `${base}/p/${p.id}`, specUrl: `${base}/p/${p.id}/spec`,
    previewUrl: d.previewUrl, prodUrl: d.project.prodUrl,
    costUsd: d.costUsd, creditUsd: d.creditUsd, updatedAt: times[times.length - 1] ?? d.project.createdAt,
    tasks: { done: d.tasks.filter((t) => t.state === "done").length, total: d.tasks.length },
    lastRun: lastRun ? runOut(lastRun as typeof schema.runs.$inferSelect) : null,
    lastDeploy: lastDeploy ? deployOut(lastDeploy as typeof schema.deploys.$inferSelect) : null,
    lastRepair: lastRepair ? { id: lastRepair.id, attempt: lastRepair.attempt, cause: lastRepair.cause ?? "", outcome: lastRepair.outcome, recoveredS: lastRepair.recoveredS } : null,
  };
}

export function crewProject(d: CrewDetail): CrewProject {
  const { tasks: _t, lastRun: _r, lastDeploy: _d, lastRepair: _p, ...p } = d;
  return p;
}

// ---------- events ----------

// A repair belongs to a project through its deploy or its run.
const owner = sql<string>`coalesce(${schema.deploys.projectId}, ${schema.runs.projectId})::text`;
// The cursor is opaque: the time of the last read plus the deploys and repairs that were still
// going then, so one that finishes later is still reported exactly once.

interface Cursor { t: string; open: string[] }
const enc = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString("base64url");
function dec(s: string): Cursor | null {
  try {
    const v = JSON.parse(Buffer.from(s, "base64url").toString("utf8")) as Cursor;
    return typeof v.t === "string" && Array.isArray(v.open) ? { t: v.t, open: v.open.filter((x) => typeof x === "string").slice(0, 500) } : null;
  } catch {
    return null;
  }
}

export async function crewEvents(base: string, u: User, since: string | null): Promise<{ events: CrewEvent[]; cursor: string }> {
  const ps = await listProjects(u);
  const byId = new Map(ps.map((p) => [p.id, p]));
  const ids = ps.map((p) => p.id);
  const now = new Date().toISOString();
  const start = since ? dec(since) : null;
  const openRows = async () => {
    if (!ids.length) return [] as string[];
    const d = await db.select({ id: schema.deploys.id }).from(schema.deploys)
      .where(and(inArray(schema.deploys.projectId, ids), inArray(schema.deploys.status, ["pending", "waiting_approval", "running"])));
    const r = await db.select({ id: schema.repairs.id }).from(schema.repairs)
      .leftJoin(schema.deploys, eq(schema.repairs.deployId, schema.deploys.id))
      .leftJoin(schema.runs, eq(schema.repairs.runId, schema.runs.id))
      .where(and(eq(schema.repairs.outcome, "running"), inArray(owner, ids)));
    return [...d.map((x) => `d:${x.id}`), ...r.map((x) => `r:${x.id}`)];
  };
  if (!start || !ids.length) return { events: [], cursor: enc({ t: now, open: await openRows() }) };

  const events: CrewEvent[] = [];
  const openD = start.open.filter((x) => x.startsWith("d:")).map((x) => x.slice(2));
  const openR = start.open.filter((x) => x.startsWith("r:")).map((x) => x.slice(2));

  const runRows = await db.select().from(schema.runs).where(and(
    inArray(schema.runs.projectId, ids), inArray(schema.runs.mode, ["build", "change"]),
    isNotNull(schema.runs.endedAt), gt(schema.runs.endedAt, start.t),
  )).orderBy(schema.runs.endedAt).limit(100);
  for (const r of runRows) {
    const p = byId.get(r.projectId)!;
    events.push({ id: `run:${r.id}`, projectId: p.id, projectName: p.name, kind: "build", outcome: r.status === "succeeded" ? "succeeded" : "failed", at: r.endedAt!, url: `${base}/p/${p.id}`, ...(r.status !== "succeeded" ? { detail: `${r.mode} run ${r.status}` } : {}) });
  }

  const depRows = await db.select().from(schema.deploys).where(and(
    inArray(schema.deploys.projectId, ids), inArray(schema.deploys.status, ["live", "failed"]),
    or(gt(schema.deploys.createdAt, start.t), openD.length ? inArray(schema.deploys.id, openD) : sql`false`),
  )).orderBy(desc(schema.deploys.createdAt)).limit(100);
  for (const d of depRows) {
    const p = byId.get(d.projectId)!;
    events.push({ id: `deploy:${d.id}`, projectId: p.id, projectName: p.name, kind: "deploy", outcome: d.status === "live" ? "succeeded" : "failed", at: d.createdAt, url: d.branch === "main" ? `${base}/p/${p.id}/app` : `${base}/p/${p.id}`, detail: d.url ? `${d.branch} · ${d.url}` : d.branch });
  }

  const repRows = await db.select({ r: schema.repairs, projectId: owner }).from(schema.repairs)
    .leftJoin(schema.deploys, eq(schema.repairs.deployId, schema.deploys.id))
    .leftJoin(schema.runs, eq(schema.repairs.runId, schema.runs.id))
    .where(and(
      inArray(schema.repairs.outcome, ["recovered", "gave_up"]),
      inArray(owner, ids),
      or(gt(schema.repairs.createdAt, start.t), openR.length ? inArray(schema.repairs.id, openR) : sql`false`),
    )).limit(100);
  for (const { r, projectId } of repRows) {
    const p = byId.get(projectId);
    if (!p) continue;
    const at = r.outcome === "recovered" && r.recoveredS !== null ? new Date(Date.parse(r.createdAt) + r.recoveredS * 1000).toISOString() : r.createdAt;
    events.push({ id: `repair:${r.id}`, projectId: p.id, projectName: p.name, kind: "repair", outcome: r.outcome as "recovered" | "gave_up", at, url: `${base}/p/${p.id}/timeline`, ...(r.cause ? { detail: r.cause } : {}) });
  }

  events.sort((a, b) => a.at.localeCompare(b.at));
  return { events: events.slice(0, 100), cursor: enc({ t: now, open: await openRows() }) };
}
