// One Amplify Gen 2 app per generated app (Requirement 5.1), source = its CodeCommit repo.
// Revenant starts every job itself: auto build and auto branch creation are off, so pushes to
// rv/* hold branches (and any other branch) never build; only preview/<n> and main are deployed.
import "server-only";
import {
  CreateAppCommand, CreateBranchCommand, GetAppCommand, GetBranchCommand, ListJobsCommand, NotFoundException,
  StartJobCommand, UpdateAppCommand, UpdateBranchCommand, type JobSummary, type Stage,
} from "@aws-sdk/client-amplify";
import { eq } from "drizzle-orm";
import type { Project } from "../contracts";
import { db, schema } from "../db/client";
import { amplify, region } from "./aws";
import { deployEnv } from "./env";
import { getHooks } from "./hooks";

export const PROD = "main";
export const previewBranch = (n: number) => `preview/${n}`;
export const previewNumber = (branch: string) => {
  const m = /^preview\/(\d+)$/.exec(branch);
  return m ? Number(m[1]) : null;
};
/** rv-<app>-<prod|pv<n>|dev> environment of a branch, as blocks/name.ts computes it. */
export const envOf = (branch: string) => (branch === PROD ? "prod" : previewNumber(branch) ? `pv${previewNumber(branch)}` : "dev");

const notFound = (e: unknown) => e instanceof NotFoundException || (e as Error).name === "NotFoundException";

async function vars(project: Project, appId?: string): Promise<Record<string, string>> {
  const h = getHooks();
  if (!h.application) throw new Error("no AppRegistry hook: setHooks({ application }) must be registered (lib/cost)");
  const out: Record<string, string> = {
    RV_APP: project.name,
    RV_PROJECT_ID: project.id,
    RV_AWS_APPLICATION: await h.application(project),
  };
  const compute = (await h.computeRole?.(project)) ?? deployEnv.RV_APPS_COMPUTE_ROLE_ARN;
  if (compute) out.RV_COMPUTE_ROLE_ARN = compute;
  if (appId) out.RV_AMPLIFY_APP_ID = appId;
  return out;
}

/** Creates the app's Amplify app when missing, and keeps its RV_* variables and build flags right. Returns the app id. */
export async function ensureApp(project: Project): Promise<string> {
  if (!project.repo) throw new Error(`project ${project.name} has no repository yet`);
  const compute = (await getHooks().computeRole?.(project)) ?? deployEnv.RV_APPS_COMPUTE_ROLE_ARN;
  if (project.amplifyAppId) {
    try {
      const { app } = await amplify.send(new GetAppCommand({ appId: project.amplifyAppId }));
      await amplify.send(new UpdateAppCommand({
        appId: project.amplifyAppId,
        environmentVariables: { ...(app?.environmentVariables ?? {}), ...(await vars(project, project.amplifyAppId)) },
        enableBranchAutoBuild: false,
        enableAutoBranchCreation: false,
        ...(compute ? { computeRoleArn: compute } : {}),
      }));
      return project.amplifyAppId;
    } catch (e) {
      if (!notFound(e)) throw e;
    }
  }
  const role = deployEnv.RV_APPS_SERVICE_ROLE_ARN;
  if (!role) throw new Error("RV_APPS_SERVICE_ROLE_ARN is not set; the install creates it");
  const { app } = await amplify.send(new CreateAppCommand({
    name: `rv-${project.name}`,
    repository: `https://git-codecommit.${region}.amazonaws.com/v1/repos/${project.repo}`,
    iamServiceRoleArn: role,
    platform: "WEB_COMPUTE",
    enableBranchAutoBuild: false,
    enableAutoBranchCreation: false,
    environmentVariables: await vars(project),
    ...(compute ? { computeRoleArn: compute } : {}),
    tags: { "revenant:app": project.name, "revenant:project": project.id },
  }));
  const appId = app!.appId!;
  await amplify.send(new UpdateAppCommand({ appId, environmentVariables: await vars(project, appId) }));
  await db.update(schema.projects).set({ amplifyAppId: appId }).where(eq(schema.projects.id, project.id));
  project.amplifyAppId = appId;
  return appId;
}

/** Creates or updates the Amplify branch: auto build off, RV_* variables set. */
export async function ensureBranch(project: Project, appId: string, branch: string): Promise<void> {
  const env = { ...(await vars(project, appId)), RV_ENV: envOf(branch) };
  const stage: Stage = branch === PROD ? "PRODUCTION" : "DEVELOPMENT";
  try {
    const { branch: b } = await amplify.send(new GetBranchCommand({ appId, branchName: branch }));
    await amplify.send(new UpdateBranchCommand({
      appId,
      branchName: branch,
      enableAutoBuild: false,
      stage,
      environmentVariables: { ...(b?.environmentVariables ?? {}), ...env },
    }));
  } catch (e) {
    if (!notFound(e)) throw e;
    await amplify.send(new CreateBranchCommand({
      appId,
      branchName: branch,
      stage,
      framework: "Next.js - SSR",
      enableAutoBuild: false,
      environmentVariables: env,
    }));
  }
}

/** Starts a release job of `commit` on the branch. */
export async function startJob(appId: string, branch: string, commit: string): Promise<string> {
  const r = await amplify.send(new StartJobCommand({ appId, branchName: branch, jobType: "RELEASE", commitId: commit, jobReason: `Revenant deploy ${commit.slice(0, 8)}` }));
  return r.jobSummary!.jobId!;
}

/** The latest job of the branch that built `commit`, if any. */
export async function jobFor(appId: string, branch: string, commit: string): Promise<JobSummary | null> {
  const r = await amplify.send(new ListJobsCommand({ appId, branchName: branch, maxResults: 25 }));
  return (r.jobSummaries ?? []).find((j) => j.commitId === commit) ?? null;
}

/** https://<branch display name>.<app default domain> */
export async function branchUrl(appId: string, branch: string): Promise<string> {
  const [{ app }, { branch: b }] = await Promise.all([
    amplify.send(new GetAppCommand({ appId })),
    amplify.send(new GetBranchCommand({ appId, branchName: branch })),
  ]);
  const name = b?.displayName || branch.replace(/[^A-Za-z0-9-]/g, "-");
  return `https://${name}.${app!.defaultDomain}`;
}

/** Root CloudFormation stack of the branch's Gen 2 backend, when it has been deployed. */
export async function backendStack(appId: string, branch: string): Promise<string | null> {
  try {
    const { branch: b } = await amplify.send(new GetBranchCommand({ appId, branchName: branch }));
    return b?.backend?.stackArn ?? null;
  } catch (e) {
    if (notFound(e)) return null;
    throw e;
  }
}
