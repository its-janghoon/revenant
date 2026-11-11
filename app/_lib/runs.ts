// Start, follow and stop runner runs (CodeBuild, runner/README.md).
import "server-only";
import { BatchGetBuildsCommand, StartBuildCommand, StopBuildCommand, type Build } from "@aws-sdk/client-codebuild";
import { CreateRoleCommand, GetRoleCommand, PutRolePolicyCommand } from "@aws-sdk/client-iam";
import { CopyObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { and, eq, inArray } from "drizzle-orm";
import type { RunMode, RunStatus } from "@/lib/contracts";
import { db, schema } from "@/lib/db/client";
import { env } from "@/lib/env";
import { policy, roleName, trust } from "@/runner/role";
import { account, codebuild, iam, names, partition, region, s3 } from "./aws";
import type { User } from "./auth";
import { HttpError, busy } from "./http";
import { kiroFor } from "./keys";
import { getSettings, sqlAllowedFor, type ProjectRow, type RunRow } from "./store";
import { event, putEvents } from "./timeline";

const { runs, projects, previews } = schema;

const roleArn = (app: string) => `arn:${partition}:iam::${account}:role/${roleName(app)}`;

/** The per-app runner role (runner/role.ts), created once per app. */
export async function ensureRunnerRole(app: string, owner: string): Promise<void> {
  const name = roleName(app);
  try {
    await iam.send(new GetRoleCommand({ RoleName: name }));
    return;
  } catch (e) {
    if ((e as Error).name !== "NoSuchEntityException") throw e;
  }
  await iam.send(new CreateRoleCommand({
    RoleName: name,
    AssumeRolePolicyDocument: JSON.stringify(trust(account)),
    Description: `Revenant runner for ${app}`,
    Tags: [{ Key: "revenant:project", Value: app }, { Key: "revenant:app", Value: "revenant" }],
  }));
  await iam.send(new PutRolePolicyCommand({
    RoleName: name,
    PolicyName: "runner",
    PolicyDocument: JSON.stringify(policy({
      partition, region, account, app, repo: names.repo(app), owner,
      companySecretArn: env.RV_KIRO_SECRET_ARN,
      promptBucket: names.promptBucket,
      logGroup: names.runnerLogGroup,
    })),
  }));
}

function needBucket(): string {
  if (!names.promptBucket) throw new HttpError(503, "RV_PROMPT_BUCKET is not set on this install", "no_bucket");
  return names.promptBucket;
}

/** Copies uploads (uploads/<sub>/...) under runs/<app>/<run>/attach/ where the runner may read them. */
async function copyAttachments(app: string, runId: string, u: User, keys: { key: string; name: string }[]): Promise<string | null> {
  if (!keys.length) return null;
  const bucket = needBucket();
  const prefix = `runs/${app}/${runId}/attach/`;
  for (const k of keys) {
    if (!k.key.startsWith(`uploads/${u.sub}/`)) throw new HttpError(400, "Attachment not found", "attachment");
    const safe = k.name.replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 120) || "file";
    await s3.send(new CopyObjectCommand({ Bucket: bucket, CopySource: `${bucket}/${encodeURI(k.key)}`, Key: prefix + safe }));
  }
  return prefix;
}

const ACTIVE: RunStatus[] = ["queued", "running"];

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
  await syncRuns(p.id);
  const [going] = await db.select({ id: runs.id }).from(runs).where(and(eq(runs.projectId, p.id), inArray(runs.status, ACTIVE)));
  if (going) throw busy(`/p/${p.id}`);

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
    const r = await codebuild.send(new StartBuildCommand({
      projectName: names.runnerProject,
      serviceRoleOverride: roleArn(p.name),
      environmentVariablesOverride: Object.entries(vars).map(([name, value]) => ({ name, value, type: "PLAINTEXT" })),
      logsConfigOverride: { cloudWatchLogs: { status: "ENABLED", groupName: names.runnerLogGroup } },
    }));
    const [started] = await db.update(runs).set({ codebuildId: r.build?.id ?? null, status: "running" }).where(eq(runs.id, run.id)).returning();
    if (i.mode !== "spec") await db.update(projects).set({ status: "building" }).where(eq(projects.id, p.id));
    if (i.branch.startsWith("preview/")) {
      const [has] = await db.select({ id: previews.id }).from(previews).where(and(eq(previews.projectId, p.id), eq(previews.branch, i.branch)));
      if (!has) {
        await db.insert(previews).values({ projectId: p.id, branch: i.branch });
        await putEvents([event(p.id, "preview_created", { branch: i.branch })]);
      }
    }
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
    await endRun(run, status, b.endTime?.toISOString());
  }
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
    const next = status === "succeeded" ? "preview" : status === "stopped" || status === "timeout" ? "stopped" : "dead";
    await db.update(projects).set({ status: next }).where(and(eq(projects.id, run.projectId), eq(projects.status, "building")));
  }
  await putEvents([event(run.projectId, "run_done", { run: run.id, mode: run.mode, status, credits: extra.credits ?? null })]);
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
