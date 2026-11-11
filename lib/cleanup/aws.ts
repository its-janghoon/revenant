// AWS calls for cleanup. Everything is found by the tags blocks/tags.ts puts on every
// resource (revenant:project, revenant:env), so nothing outside a generated app is touched.
import "server-only";
import { AmplifyClient, DeleteAppCommand, DeleteBranchCommand, NotFoundException } from "@aws-sdk/client-amplify";
import { CloudFormationClient, DeleteStackCommand, DescribeStacksCommand } from "@aws-sdk/client-cloudformation";
import {
  BranchDoesNotExistException,
  CodeCommitClient,
  DeleteRepositoryCommand,
  GetBranchCommand,
  GetDifferencesCommand,
  GetMergeOptionsCommand,
} from "@aws-sdk/client-codecommit";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { DescribeDBClustersCommand, RDSClient } from "@aws-sdk/client-rds";
import { ExecuteStatementCommand, RDSDataClient } from "@aws-sdk/client-rds-data";
import { GetResourcesCommand, ResourceGroupsTaggingAPIClient, type TagFilter } from "@aws-sdk/client-resource-groups-tagging-api";
import outputs from "../../amplify_outputs.json";
import type { TimelineEvent } from "../contracts";
import { env } from "../env";

const region = { region: env.AWS_REGION };
const amplify = new AmplifyClient(region);
const cfn = new CloudFormationClient(region);
const git = new CodeCommitClient(region);
const lambda = new LambdaClient(region);
const rds = new RDSClient(region);
const rdsData = new RDSDataClient(region);
const tagging = new ResourceGroupsTaggingAPIClient(region);

async function tagged(type: string, filters: TagFilter[]): Promise<string[]> {
  const arns: string[] = [];
  let token: string | undefined;
  do {
    const r = await tagging.send(new GetResourcesCommand({ ResourceTypeFilters: [type], TagFilters: filters, PaginationToken: token }));
    for (const m of r.ResourceTagMappingList ?? []) if (m.ResourceARN) arns.push(m.ResourceARN);
    token = r.PaginationToken || undefined;
  } while (token);
  return arns;
}

// ---------- CloudFormation (Amplify branch backends) ----------

/** Deletes every live root stack with these tags. Returns how many are still there. */
export async function deleteStacks(filters: TagFilter[]): Promise<number> {
  let left = 0;
  for (const arn of await tagged("cloudformation:stack", filters)) {
    let stack;
    try {
      [stack] = (await cfn.send(new DescribeStacksCommand({ StackName: arn }))).Stacks ?? [];
    } catch (e) {
      if (/does not exist/.test((e as Error).message)) continue;
      throw e;
    }
    if (!stack || stack.ParentId || stack.StackStatus === "DELETE_COMPLETE") continue;
    left++;
    if (stack.StackStatus !== "DELETE_IN_PROGRESS") await cfn.send(new DeleteStackCommand({ StackName: arn }));
  }
  return left;
}

export const projectTag = (projectId: string): TagFilter => ({ Key: "revenant:project", Values: [projectId] });
export const envTag = (e: string): TagFilter => ({ Key: "revenant:env", Values: [e] });

// ---------- Amplify ----------

export async function deleteBranch(appId: string, branch: string): Promise<void> {
  try {
    await amplify.send(new DeleteBranchCommand({ appId, branchName: branch }));
  } catch (e) {
    if (!(e instanceof NotFoundException)) throw e;
  }
}

export async function deleteApp(appId: string): Promise<void> {
  try {
    await amplify.send(new DeleteAppCommand({ appId }));
  } catch (e) {
    if (!(e instanceof NotFoundException)) throw e;
  }
}

// ---------- CodeCommit ----------

export type BranchState = "open" | "merged" | "closed";

/**
 * closed: the branch is gone. merged: its tip is in main (fast-forward or merge commit),
 * or main has exactly its tree (squash publish). Otherwise open.
 */
export async function branchState(repo: string, branch: string): Promise<BranchState> {
  let tip: string | undefined;
  try {
    tip = (await git.send(new GetBranchCommand({ repositoryName: repo, branchName: branch }))).branch?.commitId;
  } catch (e) {
    if (e instanceof BranchDoesNotExistException) return "closed";
    throw e;
  }
  if (!tip) return "closed";
  const main = (await git.send(new GetBranchCommand({ repositoryName: repo, branchName: "main" }))).branch?.commitId;
  if (!main) return "open";
  if (tip === main) return "merged";
  try {
    const m = await git.send(new GetMergeOptionsCommand({ repositoryName: repo, sourceCommitSpecifier: tip, destinationCommitSpecifier: main }));
    if (m.baseCommitId === tip) return "merged";
  } catch {
    // no common history or not mergeable: fall through to the tree check
  }
  const d = await git.send(new GetDifferencesCommand({ repositoryName: repo, beforeCommitSpecifier: tip, afterCommitSpecifier: main, MaxResults: 1 }));
  return d.differences?.length ? "open" : "merged";
}

/** Deletes the repo; CodeCommit returns no error when it is already gone. */
export async function deleteRepo(repo: string): Promise<void> {
  await git.send(new DeleteRepositoryCommand({ repositoryName: repo }));
}

// ---------- preview databases (SQL apps only) ----------

const PREVIEW_DB = /^[a-z][a-z0-9_]*_pv\d+$/;

/**
 * Drops <app>_pv<n> in the app's preview cluster: the cluster tagged with the project whose
 * revenant:env is not prod. Refuses any name that is not a preview database.
 */
export async function dropPreviewDb(projectId: string, dbName: string): Promise<void> {
  if (!PREVIEW_DB.test(dbName)) throw new Error(`refusing to drop ${dbName}: not a preview database`);
  const arns = await tagged("rds:cluster", [projectTag(projectId)]);
  for (const arn of arns) {
    const [c] = (await rds.send(new DescribeDBClustersCommand({ DBClusterIdentifier: arn }))).DBClusters ?? [];
    if (!c || c.TagList?.some((t) => t.Key === "revenant:env" && t.Value === "prod")) continue;
    const e = c.TagList?.find((t) => t.Key === "revenant:env")?.Value;
    const secretArn = c.MasterUserSecret?.SecretArn
      ?? (await tagged("secretsmanager:secret", [projectTag(projectId), ...(e ? [envTag(e)] : [])]))[0];
    if (!secretArn) throw new Error(`no secret for preview cluster ${c.DBClusterIdentifier}`);
    await rdsData.send(new ExecuteStatementCommand({
      resourceArn: arn,
      secretArn,
      database: "postgres",
      sql: `DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`,
    }));
    return;
  }
  // no preview cluster left (already deleted with the app): nothing to drop
}

// ---------- timeline ----------

const timelineFn = (outputs as { custom?: { timelineFunction?: string } }).custom?.timelineFunction;

/** Best effort: a timeline write never blocks cleanup. */
export async function timeline(events: TimelineEvent[]): Promise<void> {
  if (!timelineFn || !events.length) return;
  try {
    await lambda.send(new InvokeCommand({ FunctionName: timelineFn, Payload: Buffer.from(JSON.stringify({ events })) }));
  } catch {
    // ignored
  }
}
