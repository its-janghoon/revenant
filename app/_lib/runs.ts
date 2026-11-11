// Start, follow and stop runner runs (CodeBuild, runner/README.md).
import "server-only";
import { FilterLogEventsCommand } from "@aws-sdk/client-cloudwatch-logs";
import { BatchGetBuildsCommand, StopBuildCommand, type Build } from "@aws-sdk/client-codebuild";
import { CopyObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { and, eq, inArray } from "drizzle-orm";
import { parseLine, type RunMode, type RunStatus } from "@/lib/contracts";
import { broker } from "@/lib/broker/client";
import { db, schema } from "@/lib/db/client";
import { deployPreview } from "@/lib/deploy";
import { codebuild, logs, names, s3 } from "./aws";
import type { User } from "./auth";
import { HttpError, busy } from "./http";
import { kiroFor } from "./keys";
import { head } from "./repo";
import { getSettings, projectRuns, sqlAllowedFor, toProject, workBranch, type ProjectRow, type RunRow } from "./store";
import { event, putEvents } from "./timeline";

const { runs, projects } = schema;

/** The per-app runner role (runner/role.ts), created once per app by the broker Lambda. */
export async function ensureRunnerRole(app: string, owner: string): Promise<void> {
  await broker({ op: "role", app, owner });
}

function needBucket(): string {
  if (!names.promptBucket) throw new HttpError(503, "RV_PROMPT_BUCKET is not set on this install", "no_bucket");
  return names.promptBucket;
}

/** Copies uploads (runs/_uploads/<sub>/...) under runs/<app>/<run>/attach/ where the run may read them. */
async function copyAttachments(app: string, runId: string, u: User, keys: { key: string; name: string }[]): Promise<string | null> {
  if (!keys.length) return null;
  const bucket = needBucket();
  const prefix = `runs/${app}/${runId}/attach/`;
  for (const k of keys) {
    if (!k.key.startsWith(`${UPLOADS}${u.sub}/`)) throw new HttpError(400, "Attachment not found", "attachment");
    const safe = k.name.replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 120) || "file";
    await s3.send(new CopyObjectCommand({ Bucket: bucket, CopySource: `${bucket}/${encodeURI(k.key)}`, Key: prefix + safe }));
  }
  return prefix;
}

// App names start with a letter, so this prefix never meets runs/<app>/.
export const UPLOADS = "runs/_uploads/";

const ACTIVE: RunStatus[] = ["queued", "running"];

/** 409 busy while a run of this project is going. Call before reserving a preview branch. */
export async function assertIdle(projectId: string): Promise<void> {
  await syncRuns(projectId);
  const [going] = await db.select({ id: runs.id }).from(runs).where(and(eq(runs.projectId, projectId), inArray(runs.status, ACTIVE)));
  if (going) throw busy(`/p/${projectId}`);
}

export interface StartInput {
  project: ProjectRow;
  user: User;
  mode: Exclude<RunMode, "repair">;
  branch: string;
  base?: string;
  prompt?: string;
  attachments?: { key: string; name: string }[];
}

export async function startRun(i: StartInput): Promise<RunRow> {
  const { project: p, user: u } = i;
  if (!p.repo) throw new HttpError(409, "This app has no repository yet", "no_repo");
  await assertIdle(p.id);

  const s = await getSettings();
  const kiro = await kiroFor(u, s);
  const sql = await sqlAllowedFor(u, s);
  const [run] = await db.insert(runs).values({ projectId: p.id, mode: i.mode, model: s.model, kiroPayer: kiro.payer, status: "queued" }).returning();
  if (!run) throw new Error("run insert failed");

  try {
    const vars: Record<string, string> = {
      MODE: i.mode, APP: p.name, REPO: p.repo, BRANCH: i.branch, BASE_BRANCH: i.base ?? "main", RUN_ID: run.id,
      KIRO_SECRET_ARN: kiro.arn, KIRO_PAYER: kiro.payer, MODEL: s.model, CREDITS_LIMIT: String(s.creditsPerBuild),
      RV_PROJECT_ID: p.id, RV_SQL: sql ? "on" : "off",
    };
    if (p.amplifyAppId) vars.RV_AMPLIFY_APP_ID = p.amplifyAppId;
    if (i.prompt !== undefined || i.mode !== "build" || i.attachments?.length) {
      const bucket = needBucket();
      const key = `runs/${p.name}/${run.id}/prompt.md`;
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: i.prompt ?? "", ContentType: "text/markdown" }));
      vars.PROMPT_BUCKET = bucket;
      vars.PROMPT_S3_KEY = key;
      const attach = await copyAttachments(p.name, run.id, u, i.attachments ?? []);
      if (attach) vars.ATTACH_S3_PREFIX = attach;
    }
    const r = await broker<{ id: string | null }>({ op: "build", app: p.name, vars });
    const [started] = await db.update(runs).set({ codebuildId: r.id, status: "running" }).where(eq(runs.id, run.id)).returning();
    if (i.mode !== "spec") await db.update(projects).set({ status: "building" }).where(eq(projects.id, p.id));
    return started ?? run;
  } catch (e) {
    await db.update(runs).set({ status: "failed", endedAt: new Date().toISOString() }).where(eq(runs.id, run.id));
    throw e;
  }
}

function statusOf(b: Build): RunStatus {
  switch (b.buildStatus) {
    case "SUCCEEDED": return "succeeded";
    case "STOPPED": return "stopped";
    case "TIMED_OUT": return "timeout";
    case "FAILED":
    case "FAULT": return "failed";
    default: return "running";
  }
}

/** Reads CodeBuild for the project's open runs and records the ones that ended. */
export async function syncRuns(projectId: string): Promise<void> {
  const open = await db.select().from(runs).where(and(eq(runs.projectId, projectId), inArray(runs.status, ACTIVE)));
  const ids = open.map((r) => r.codebuildId).filter((x): x is string => Boolean(x));
  if (!ids.length) return;
  const r = await codebuild.send(new BatchGetBuildsCommand({ ids }));
  for (const b of r.builds ?? []) {
    const run = open.find((x) => x.codebuildId === b.id);
    const st = statusOf(b);
    if (!run || st === "running") continue;
    // Exit code 3 (time or credits limit) shows up as FAILED with this phase message.
    const limit = (b.phases ?? []).some((ph) => /exit status 3\b/.test((ph.contexts ?? []).map((c) => c.message).join(" ")));
    const status: RunStatus = limit ? "timeout" : st;
    await endRun(run, status, b.endTime?.toISOString(), await reported(b));
  }
}

/** Runner lines of a build that match `pattern` (a CloudWatch filter pattern), oldest first. */
async function runnerLines(b: Build, pattern: string) {
  const group = b.logs?.groupName;
  const stream = b.logs?.streamName;
  if (!group || !stream) return [];
  const r = await logs.send(new FilterLogEventsCommand({ logGroupName: group, logStreamNames: [stream], filterPattern: pattern, limit: 20 }));
  return (r.events ?? []).map((e) => parseLine((e.message ?? "").trim())).filter((l) => l !== null);
}

/** Credits and last commit from the run's `run_done` line; the runner only writes them to its log. */
async function reported(b: Build): Promise<{ credits?: number; commit?: string | null }> {
  try {
    const line = (await runnerLines(b, '"run_done"')).filter((l) => l.t === "run_done").pop();
    if (line?.t === "run_done") return { ...(typeof line.credits === "number" ? { credits: line.credits } : {}), ...(line.commit ? { commit: line.commit } : {}) };
  } catch (e) {
    console.error("run credits not read", (e as Error).name, (e as Error).message);
  }
  return {};
}

/**
 * Where a new build continues after a failed one: the newest run whose work was saved on its hold
 * branch rv/run-<id> (repair gave up or the user stopped it), with the error that stopped it.
 * Null when there is nothing to continue, so the build starts from the spec.
 */
export async function resume(p: ProjectRow): Promise<{ base: string; why: string } | null> {
  if (!p.repo) return null;
  for (const r of await projectRuns(p.id, 10)) {
    if (r.mode === "spec" || r.status === "queued" || r.status === "running") continue;
    if (r.status === "succeeded") return null;
    const hold = `rv/run-${r.id}`;
    if (!(await head(p.repo, hold))) continue;
    let why = "";
    if (r.codebuildId) {
      try {
        const { builds = [] } = await codebuild.send(new BatchGetBuildsCommand({ ids: [r.codebuildId] }));
        const err = builds[0] ? (await runnerLines(builds[0], '"step"')).filter((l) => l.t === "error").pop() : undefined;
        if (err?.t === "error") why = `The last run stopped at ${err.step}:\n${err.text}`;
      } catch (e) {
        console.error("run error not read", (e as Error).name, (e as Error).message);
      }
    }
    return { base: hold, why };
  }
  return null;
}

export async function endRun(run: RunRow, status: RunStatus, at?: string, extra: { credits?: number; commit?: string | null } = {}): Promise<void> {
  const ended = await db.update(runs)
    .set({ status, endedAt: at ?? new Date().toISOString(), ...(extra.credits !== undefined ? { credits: extra.credits } : {}), ...(extra.commit !== undefined ? { commit: extra.commit } : {}) })
    .where(and(eq(runs.id, run.id), inArray(runs.status, ACTIVE)))
    .returning();
  if (!ended.length) {
    // CodeBuild was read first: keep its status, still record what the runner reported.
    if (extra.credits !== undefined || extra.commit !== undefined) {
      await db.update(runs).set({ ...(extra.credits !== undefined ? { credits: extra.credits } : {}), ...(extra.commit !== undefined ? { commit: extra.commit } : {}) }).where(eq(runs.id, run.id));
    }
    return;
  }
  if (run.mode === "build" || run.mode === "change") {
    // Only move a project that is still "building": repair (L4) and deploy (L2) own the other states.
    // A good run stays "building" while its preview deploys; settle() then makes it preview or dead.
    if (status !== "succeeded") {
      const next = status === "stopped" || status === "timeout" ? "stopped" : "dead";
      await db.update(projects).set({ status: next }).where(and(eq(projects.id, run.projectId), eq(projects.status, "building")));
    } else {
      await deployAfter(run, extra.commit ?? run.commit);
    }
  }
  await putEvents([event(run.projectId, "run_done", { run: run.id, mode: run.mode, status, credits: extra.credits ?? null })]);
}

/** The runner pushed the newest preview branch: hand it to the deploy lane. */
async function deployAfter(run: RunRow, commit: string | null): Promise<void> {
  const [p] = await db.select().from(projects).where(eq(projects.id, run.projectId));
  if (!p?.repo) return;
  const branch = await workBranch(p.id);
  if (!branch.startsWith("preview/")) return;
  const sha = commit ?? (await head(p.repo, branch));
  if (!sha) return;
  const [known] = await db.select({ id: schema.deploys.id }).from(schema.deploys)
    .where(and(eq(schema.deploys.projectId, p.id), eq(schema.deploys.branch, branch), eq(schema.deploys.commit, sha)));
  if (known) return;
  try {
    await deployPreview(toProject(p), branch, sha);
  } catch (e) {
    console.error("preview deploy failed to start", (e as Error).name);
  }
}

export async function stopRun(run: RunRow): Promise<void> {
  if (!ACTIVE.includes(run.status)) return;
  if (run.codebuildId) {
    try {
      await codebuild.send(new StopBuildCommand({ id: run.codebuildId }));
    } catch (e) {
      if ((e as Error).name !== "InvalidInputException") throw e;
    }
  }
  await endRun(run, "stopped");
}
