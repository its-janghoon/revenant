// The Deployer port the repair Lambda uses (lib/repair/ports.ts).
// It runs outside Next.js, so it must not import "server-only" modules from lib/deploy;
// it talks to CodeCommit, Amplify and Revenant's DB directly.
import { AmplifyClient, GetBranchCommand as GetAmplifyBranch, StartJobCommand } from "@aws-sdk/client-amplify";
import { CodeCommitClient, GetBranchCommand, MergeBranchesByThreeWayCommand } from "@aws-sdk/client-codecommit";
import { RDSDataClient } from "@aws-sdk/client-rds-data";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/aws-data-api/pg";
import * as schema from "../db/schema";
import type { Deployer } from "../repair/ports";

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

const AUTHOR = { authorName: "Revenant", email: "44862514+savagemanage@users.noreply.github.com" };

export const deployer: Deployer = {
  async merge({ projectId, from, into }) {
    const { repo } = await target(projectId);
    const r = await codecommit.send(new MergeBranchesByThreeWayCommand({
      repositoryName: repo,
      sourceCommitSpecifier: from,
      destinationCommitSpecifier: into,
      targetBranch: into,
      ...AUTHOR,
      commitMessage: `fix: merge ${from} into ${into} (Revenant repair)\n\nCo-authored-by: Kiro <noreply@kiro.dev>\n`,
    }));
    if (!r.commitId) throw new Error(`merge ${from} -> ${into} returned no commit`);
    return { commit: r.commitId };
  },

  async redeploy({ projectId, branch }) {
    const { repo, appId } = await target(projectId);
    const head = await codecommit.send(new GetBranchCommand({ repositoryName: repo, branchName: branch }));
    await amplify.send(new StartJobCommand({
      appId, branchName: branch, jobType: "RELEASE", commitId: head.branch?.commitId, jobReason: "Revenant repair",
    }));
  },

  async health({ projectId, branch }) {
    const { appId } = await target(projectId);
    const b = await amplify.send(new GetAmplifyBranch({ appId, branchName: branch }));
    const host = b.branch?.displayName ?? branch.replace(/[^a-z0-9-]/gi, "-");
    const url = `https://${host}.${appId}.amplifyapp.com`;
    const until = Date.now() + 20_000;
    let text = "no answer";
    while (Date.now() < until) {
      try {
        const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(8000), headers: { "user-agent": "revenant-health" } });
        if (r.ok) return { ok: true, text: `${url} ${r.status}` };
        text = `${url} ${r.status}`;
      } catch (e) {
        text = `${url} ${(e as Error).message}`;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    return { ok: false, text };
  },
};
