// The Deployer port the repair Lambda uses (lib/repair/ports.ts).
// It runs outside Next.js, so it must not import "server-only" modules from lib/deploy;
// it talks to CodeCommit, Amplify and Revenant's DB directly. Branch names: fixes come from
// revenant/fix-<n> and merge into the failed branch (main or preview/<n>).
import {
  AmplifyClient, GetAppCommand, GetBranchCommand as GetAmplifyBranch, NotFoundException, StartJobCommand,
} from "@aws-sdk/client-amplify";
import { CodeCommitClient, GetBranchCommand, MergeBranchesByThreeWayCommand } from "@aws-sdk/client-codecommit";
import { RDSDataClient } from "@aws-sdk/client-rds-data";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/aws-data-api/pg";
import * as schema from "../db/schema";
import type { Deployer } from "../repair/ports";
import { health } from "./health";

const region = process.env.AWS_REGION;
const codecommit = new CodeCommitClient({ region });
const amplify = new AmplifyClient({ region });

const db = () =>
  drizzle(new RDSDataClient({ region }), {
    database: process.env.RV_DB_NAME ?? "revenant",
    resourceArn: process.env.RV_DB_CLUSTER_ARN ?? "",
    secretArn: process.env.RV_DB_SECRET_ARN ?? "",
    schema,
  });

async function target(projectId: string): Promise<{ repo: string; appId: string }> {
  const [p] = await db().select().from(schema.projects).where(eq(schema.projects.id, projectId)).limit(1);
  if (!p?.repo || !p?.amplifyAppId) throw new Error(`project ${projectId} has no repo or Amplify app yet`);
  return { repo: p.repo, appId: p.amplifyAppId };
}

// Same identity as lib/deploy/repo.ts merge and the runner's commits.
const AUTHOR = { authorName: "Revenant", email: "revenant@example.com" };

async function amplifyBranch(appId: string, branch: string) {
  try {
    return (await amplify.send(new GetAmplifyBranch({ appId, branchName: branch }))).branch ?? null;
  } catch (e) {
    if (e instanceof NotFoundException || (e as Error).name === "NotFoundException") return null;
    throw e;
  }
}

/** Auto build is off on every generated app (lib/deploy/amplify.ts): Revenant starts each job. */
async function startJob(appId: string, branch: string, commit: string | undefined, reason: string): Promise<void> {
  await amplify.send(new StartJobCommand({ appId, branchName: branch, jobType: "RELEASE", commitId: commit, jobReason: reason }));
}

export const deployer: Deployer = {
  async merge({ projectId, from, into }) {
    const { repo, appId } = await target(projectId);
    const r = await codecommit.send(new MergeBranchesByThreeWayCommand({
      repositoryName: repo,
      sourceCommitSpecifier: from,
      destinationCommitSpecifier: into,
      targetBranch: into,
      ...AUTHOR,
      commitMessage: `fix: merge ${from} into ${into} (Revenant repair)\n\nCo-authored-by: Kiro <noreply@kiro.dev>\n`,
    }));
    if (!r.commitId) throw new Error(`merge ${from} -> ${into} returned no commit`);
    // A branch Amplify deploys gets its redeploy now; the loop waits for its SUCCEED or FAILED event.
    if (await amplifyBranch(appId, into)) await startJob(appId, into, r.commitId, `Revenant repair ${from}`);
    return { commit: r.commitId };
  },

  async redeploy({ projectId, branch }) {
    const { repo, appId } = await target(projectId);
    const head = await codecommit.send(new GetBranchCommand({ repositoryName: repo, branchName: branch }));
    await startJob(appId, branch, head.branch?.commitId, "Revenant repair");
  },

  async health({ projectId, branch }) {
    const { appId } = await target(projectId);
    const [b, { app }] = await Promise.all([amplifyBranch(appId, branch), amplify.send(new GetAppCommand({ appId }))]);
    // Same URL as lib/deploy/amplify.ts branchUrl.
    const host = b?.displayName || branch.replace(/[^A-Za-z0-9-]/g, "-");
    const url = `https://${host}.${app?.defaultDomain ?? `${appId}.amplifyapp.com`}`;
    const h = await health(url, Number(process.env.RV_HEALTH_WAIT_S ?? 20) || 20);
    return { ok: h.ok, text: `${url} ${h.status ?? h.error ?? "no answer"}` };
  },
};
