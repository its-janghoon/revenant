// Publish (Requirements 5.3-5.5, 6.6, 6.9): merge a live preview to main and deploy production.
//   plan     guardrail rules on the preview's deployed templates, prod -> preview classification
//            (replace and delete are destructive), the data model diff with prod record counts,
//            and for SQL apps the migration SQL
//   publish  a main deploy row: waiting_approval when anything is destructive, else pending
//   approve  waiting_approval -> pending (or failed when rejected)
//   advance  pending: SQL apps snapshot prod first; then merge to main and start the job
// A deploy row moves only by a conditional update, so two callers never both act on it.
import "server-only";
import { and, desc, eq, inArray, like } from "drizzle-orm";
import type { Deploy, Project } from "../contracts";
import { db, schema } from "../db/client";
import {
  BACKFILL_DIR, DATA_FILE, backfillKeys, classify, describe, destructive, diffSchemas, modelFindings, normalize, parseSchema, rules,
  type Finding,
} from "../guard";
import { PROD, ensureApp, ensureBranch, envOf, startJob } from "./amplify";
import { affected, type Affected } from "./count";
import { event } from "./events";
import { getHooks, sqlFor } from "./hooks";
import { head, listFolder, merge, readFile } from "./repo";
import { deployed, type Deployed } from "./stacks";
import type { PublishDetail } from "./types";

const OPEN = ["waiting_approval", "pending", "running"] as const;

export const snapshotId = (project: Project, deployId: string) => `rv-${project.name}-prod-${deployId.slice(0, 8)}`;

function tokens(project: Project, branch: string, d: Deployed | null): string[] {
  const env = envOf(branch);
  const t = [branch, branch.replace(/\//g, "-"), branch.replace(/[^A-Za-z0-9]/g, ""), env, `rv-${project.name}-${env}`];
  return [...t, ...(d?.tokens ?? [])];
}

function affectedLine(a: Affected): string {
  const n = a.records === null ? "an unknown number of" : `${a.records}${a.capped ? "+" : ""}`;
  const c = a.change;
  if (c.kind === "removeModel") return `${c.renamedTo ? `renames model ${c.model} to ${c.renamedTo}` : `removes model ${c.model}`}: ${n} records in production`;
  if (c.kind === "removeField") return `${c.renamedTo ? `renames ${c.model}.${c.field} to ${c.renamedTo}` : `removes ${c.model}.${c.field}`}: ${n} records have a value`;
  return "";
}

/** The latest live preview deploy, or the given branch's. */
async function source(project: Project, branch?: string): Promise<Deploy | null> {
  const [d] = await db.select().from(schema.deploys)
    .where(and(
      eq(schema.deploys.projectId, project.id),
      eq(schema.deploys.status, "live"),
      branch ? eq(schema.deploys.branch, branch) : like(schema.deploys.branch, "preview/%"),
    ))
    .orderBy(desc(schema.deploys.createdAt))
    .limit(1);
  return (d as Deploy | undefined) ?? null;
}

export async function openPublish(project: Project): Promise<Deploy | null> {
  const [d] = await db.select().from(schema.deploys)
    .where(and(eq(schema.deploys.projectId, project.id), eq(schema.deploys.branch, PROD), inArray(schema.deploys.status, [...OPEN])))
    .limit(1);
  return (d as Deploy | undefined) ?? null;
}

export async function plan(project: Project, branch?: string): Promise<PublishDetail> {
  const empty: PublishDetail = {
    branch: branch ?? "", commit: "", migrationSql: [], destructive: [], snapshotId: null,
    changes: [], data: [], findings: [], needsApproval: false, blocked: null,
  };
  if (!project.repo || !project.amplifyAppId) return { ...empty, blocked: "the app has no preview yet" };
  const src = await source(project, branch);
  if (!src) return { ...empty, blocked: "no live preview to publish; deploy a preview first" };
  const tip = await head(project.repo, src.branch);
  if (tip && tip !== src.commit) {
    return { ...empty, branch: src.branch, commit: src.commit, blocked: `${src.branch} has commits that are not deployed yet; wait for its preview` };
  }

  const [prod, pv] = await Promise.all([deployed(project.amplifyAppId, PROD), deployed(project.amplifyAppId, src.branch)]);
  const findings: Finding[] = [];
  if (!pv) findings.push({ rule: "synth", level: "error", message: `${src.branch} has no deployed backend to check` });
  else findings.push(...rules(pv.stacks));

  const changes = prod && pv
    ? classify(normalize(prod.stacks, tokens(project, PROD, prod)), normalize(pv.stacks, tokens(project, src.branch, pv)))
    : [];

  const [baseSrc, headSrc, baseFill, headFill] = await Promise.all([
    readFile(project.repo, PROD, DATA_FILE),
    readFile(project.repo, src.commit, DATA_FILE),
    listFolder(project.repo, PROD, BACKFILL_DIR),
    listFolder(project.repo, src.commit, BACKFILL_DIR),
  ]);
  const before = baseSrc === null ? null : parseSchema(baseSrc);
  const after = headSrc === null ? null : parseSchema(headSrc);
  if (headSrc !== null && after === null) findings.push({ rule: "data.parse", resource: DATA_FILE, level: "error", message: `${DATA_FILE} has no a.schema({...}) the guard can read` });
  const had = new Set(baseFill);
  const model = diffSchemas(before, after, backfillKeys(headFill.filter((p) => !had.has(p))));
  findings.push(...modelFindings(model).filter((f) => f.level === "error"));
  const data = await affected(prod, model);

  const sql = await sqlFor(project);
  const migrationSql = sql ? await sql.migrationDiff(project, src.branch) : [];

  const lost = [...destructive(changes).map(describe), ...data.map(affectedLine)];
  const errors = findings.filter((f) => f.level === "error");
  return {
    branch: src.branch,
    commit: src.commit,
    migrationSql,
    destructive: lost,
    snapshotId: null,
    changes,
    data,
    findings,
    needsApproval: lost.length > 0,
    blocked: errors.length ? `the guardrail check failed: ${errors.map((f) => f.message).join("; ")}` : null,
  };
}

export type PublishResult = { deploy: Deploy; plan: PublishDetail } | { error: string; status: number; plan?: PublishDetail };

export async function publish(project: Project, by: string, branch?: string): Promise<PublishResult> {
  const busy = await openPublish(project);
  if (busy) return { error: `a publish is already ${busy.status.replace("_", " ")}`, status: 409 };
  const p = await plan(project, branch);
  if (p.blocked) return { error: p.blocked, status: 409, plan: p };
  const status = p.needsApproval ? "waiting_approval" : "pending";
  const [row] = await db.insert(schema.deploys).values({ projectId: project.id, branch: PROD, commit: p.commit, status }).returning();
  const deploy = row as Deploy;
  if (p.needsApproval) {
    await event(project.id, "approval_needed", { deploy: deploy.id, from: p.branch, commit: p.commit, destructive: p.destructive, by });
    return { deploy, plan: p };
  }
  await event(project.id, "deploy_started", { deploy: deploy.id, branch: PROD, from: p.branch, commit: p.commit, by });
  return { deploy: await advance(project, deploy), plan: p };
}

export async function approve(project: Project, deploy: Deploy, yes: boolean, by: string): Promise<Deploy | null> {
  const [row] = await db.update(schema.deploys)
    .set({ status: yes ? "pending" : "failed" })
    .where(and(eq(schema.deploys.id, deploy.id), eq(schema.deploys.status, "waiting_approval")))
    .returning();
  if (!row) return null;
  await event(project.id, "message", { deploy: deploy.id, text: yes ? "publish approved" : "publish rejected", by });
  return yes ? advance(project, row as Deploy) : (row as Deploy);
}

async function fail(project: Project, deploy: Deploy, step: string, error: string): Promise<Deploy> {
  const [row] = await db.update(schema.deploys).set({ status: "failed" }).where(eq(schema.deploys.id, deploy.id)).returning();
  await event(project.id, "deploy_failed", { deploy: deploy.id, branch: deploy.branch, step, error });
  await db.update(schema.projects).set({ status: "dead" }).where(eq(schema.projects.id, project.id));
  await getHooks().failed?.(row as Deploy, `${step}: ${error}`);
  return row as Deploy;
}

/** Moves a pending main deploy on: snapshot (SQL apps), merge, start the job. Safe to call again. */
export async function advance(project: Project, deploy: Deploy): Promise<Deploy> {
  if (deploy.status !== "pending" || deploy.branch !== PROD) return deploy;
  const sql = await sqlFor(project);
  if (sql) {
    const id = snapshotId(project, deploy.id);
    try {
      await sql.snapshot(project, id);
      if (!(await sql.snapshotReady(project, id))) return deploy;
    } catch (e) {
      return fail(project, deploy, "snapshot", (e as Error).message);
    }
  }
  const [claimed] = await db.update(schema.deploys)
    .set({ status: "running" })
    .where(and(eq(schema.deploys.id, deploy.id), eq(schema.deploys.status, "pending")))
    .returning();
  if (!claimed) return deploy;
  try {
    const merged = await merge(project.repo!, deploy.commit, PROD, `chore: publish ${deploy.commit.slice(0, 8)}`);
    const [row] = await db.update(schema.deploys).set({ commit: merged }).where(eq(schema.deploys.id, deploy.id)).returning();
    const appId = await ensureApp(project);
    await ensureBranch(project, appId, PROD);
    await startJob(appId, PROD, merged);
    await event(project.id, "message", { deploy: deploy.id, text: `merged to main as ${merged.slice(0, 8)}`, ...(sql ? { snapshot: snapshotId(project, deploy.id) } : {}) });
    return row as Deploy;
  } catch (e) {
    return fail(project, claimed as Deploy, "merge", (e as Error).message);
  }
}
