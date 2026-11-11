// Code tab commits (Requirement 5.4): a commit a person makes on preview/<n> goes through the
// same checks as an agent's push before Amplify deploys it. checkCommit() records a pending
// deploy and starts the shared runner with MODE=check (clone, install, lint, synth, cfn-lint,
// guard; no Kiro, no push). settle() follows the check build: passed -> the preview deploy
// starts; failed -> the deploy is failed with the step that broke. The live preview stays.
import "server-only";
import { BatchGetBuildsCommand, CodeBuildClient, ListBuildsForProjectCommand, StartBuildCommand, type Build } from "@aws-sdk/client-codebuild";
import { and, eq } from "drizzle-orm";
import { roleName } from "../../runner/role";
import type { Deploy, Project } from "../contracts";
import { outputs } from "../amplify";
import { db, schema } from "../db/client";
import { env } from "../env";
import { ensureApp, ensureBranch, previewNumber, startJob } from "./amplify";
import { region } from "./aws";
import { event } from "./events";
import { getHooks } from "./hooks";

const codebuild = new CodeBuildClient({ region });

interface Custom { name?: string; runnerLogGroup?: string; runner?: { project?: string } }
const custom = (outputs as { custom?: Custom }).custom ?? {};
const runnerProject = process.env.RV_RUNNER_PROJECT ?? custom.runner?.project ?? `${custom.name ?? "rv-revenant-dev"}-runner`;
const logGroup = custom.runnerLogGroup ?? `/rv/${custom.name ?? "rv-revenant-dev"}/runner`;
// arn:<partition>:secretsmanager:<region>:<account>:secret:...
const [, partition = "aws", , , account = ""] = env.RV_KIRO_SECRET_ARN.split(":");

const CHECK_MIN = 20;
/** RUN_ID of the check build of a deploy; the runner's log lines carry it as `run`. */
export const checkRunId = (deployId: string) => `check-${deployId}`;

/**
 * Starts the checks for `commit` (already on `branch`, a preview branch) and returns the deploy
 * row, status pending. Call it right after the Code tab commit; settle()/settleAll() do the rest.
 */
export async function checkCommit(project: Project, branch: string, commit: string): Promise<Deploy> {
  if (previewNumber(branch) === null) throw new Error(`not a preview branch: ${branch}`);
  if (!project.repo) throw new Error(`project ${project.name} has no repository yet`);
  const [row] = await db.insert(schema.deploys).values({ projectId: project.id, branch, commit, status: "pending" }).returning();
  const deploy = row as Deploy;
  const vars: Record<string, string> = {
    MODE: "check", APP: project.name, REPO: project.repo, BRANCH: branch, COMMIT: commit,
    RUN_ID: checkRunId(deploy.id), RV_PROJECT_ID: project.id, TIME_LIMIT_MIN: String(CHECK_MIN),
    ...(project.amplifyAppId ? { RV_AMPLIFY_APP_ID: project.amplifyAppId } : {}),
  };
  try {
    await codebuild.send(new StartBuildCommand({
      projectName: runnerProject,
      serviceRoleOverride: `arn:${partition}:iam::${account}:role/${roleName(project.name)}`,
      timeoutInMinutesOverride: CHECK_MIN + 5,
      environmentVariablesOverride: Object.entries(vars).map(([name, value]) => ({ name, value, type: "PLAINTEXT" })),
      logsConfigOverride: { cloudWatchLogs: { status: "ENABLED", groupName: logGroup } },
    }));
  } catch (e) {
    return fail(project, deploy, "start", (e as Error).message);
  }
  await event(project.id, "message", { from: "runner", deploy: deploy.id, branch, commit, text: "checking your commit: install, lint, synth, guardrails" });
  return deploy;
}

async function fail(project: Project, d: Deploy, step: string, error: string): Promise<Deploy> {
  const [row] = await db.update(schema.deploys).set({ status: "failed" })
    .where(and(eq(schema.deploys.id, d.id), eq(schema.deploys.status, "pending"))).returning();
  if (!row) return d;
  await event(project.id, "deploy_failed", { deploy: d.id, branch: d.branch, commit: d.commit, step, error });
  return row as Deploy;
}

/** The check build of a deploy, among the runner project's latest builds. */
async function buildOf(deployId: string): Promise<Build | null> {
  const { ids = [] } = await codebuild.send(new ListBuildsForProjectCommand({ projectName: runnerProject, sortOrder: "DESCENDING" }));
  const want = checkRunId(deployId);
  for (let i = 0; i < Math.min(ids.length, 100); i += 50) {
    const { builds = [] } = await codebuild.send(new BatchGetBuildsCommand({ ids: ids.slice(i, i + 50) }));
    const b = builds.find((x) => x.environment?.environmentVariables?.some((v) => v.name === "RUN_ID" && v.value === want));
    if (b) return b;
  }
  return null;
}

/** Moves a pending preview deploy on: waits for its check, then starts the Amplify job. Safe to call again. */
export async function followCheck(project: Project, d: Deploy): Promise<Deploy> {
  if (d.status !== "pending" || previewNumber(d.branch) === null) return d;
  const b = await buildOf(d.id);
  if (!b) {
    // deployPreview() rows are pending for a moment too; only an old row without a build is lost
    return Date.now() - Date.parse(d.createdAt) > 10 * 60_000 ? fail(project, d, "check", "the check build was not found") : d;
  }
  if (b.buildStatus === "IN_PROGRESS") return d;
  if (b.buildStatus !== "SUCCEEDED") {
    const phase = (b.phases ?? []).find((p) => p.phaseStatus && p.phaseStatus !== "SUCCEEDED");
    const why = phase?.contexts?.map((c) => c.message).filter(Boolean).join(" ") || `check ${b.buildStatus?.toLowerCase() ?? "failed"}`;
    return fail(project, d, "check", why);
  }
  const [claimed] = await db.update(schema.deploys).set({ status: "running" })
    .where(and(eq(schema.deploys.id, d.id), eq(schema.deploys.status, "pending"))).returning();
  if (!claimed) return d;
  try {
    const appId = await ensureApp(project);
    await ensureBranch(project, appId, d.branch);
    await startJob(appId, d.branch, d.commit);
  } catch (e) {
    const [row] = await db.update(schema.deploys).set({ status: "failed" }).where(eq(schema.deploys.id, d.id)).returning();
    await event(project.id, "deploy_failed", { deploy: d.id, branch: d.branch, step: "start", error: (e as Error).message });
    return row as Deploy;
  }
  await event(project.id, "deploy_started", { deploy: d.id, branch: d.branch, commit: d.commit, checked: true });
  return claimed as Deploy;
}
