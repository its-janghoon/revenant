// An SQL app's two Aurora clusters (Requirement 6.7-6.8): rv-<app>-prod-db holds <app>_prod,
// rv-<app>-dev-db holds <app>_dev and the preview databases. Revenant owns these stacks; the
// app's Amplify branches only reference them (blocks/db). Creating a cluster takes about ten
// minutes, so `ensure` starts it and `ready` finishes the setup once the stack is complete.
//
// Callers: project creation (when sqlAllowed(owner)) calls ensure() for both clusters and,
// when both are ready, sets appEnv() on the Amplify app. createPreview() calls ready("dev").
import "server-only";
import {
  CloudFormationClient, CreateStackCommand, DescribeStacksCommand, UpdateStackCommand, type Stack,
} from "@aws-sdk/client-cloudformation";
import { template } from "../../blocks/db/cluster";
import { clusterName, DUMP_USER, dbName, stackName, type Cluster } from "./names";
import { exec, lit, type Target } from "./sql";

export type ClusterInfo = {
  clusterArn: string;
  clusterResourceId: string;
  secretArn: string;
  host: string;
  dumpProject: string;
  dumpBucket: string;
};

export type StackState = "missing" | "creating" | "ready" | "failed";

let cfn: CloudFormationClient | undefined;
const client = () => (cfn ??= new CloudFormationClient({}));
const cache = new Map<string, { at: number; info: ClusterInfo }>();

async function describe(app: string, c: Cluster): Promise<Stack | null> {
  try {
    const r = await client().send(new DescribeStacksCommand({ StackName: stackName(app, c) }));
    return r.Stacks?.[0] ?? null;
  } catch (e) {
    if (/does not exist/.test((e as Error).message ?? "")) return null;
    throw e;
  }
}

function state(s: Stack | null): StackState {
  const v = s?.StackStatus ?? "";
  if (!s || v === "DELETE_COMPLETE") return "missing";
  if (v.endsWith("_IN_PROGRESS")) return "creating";
  if (v === "CREATE_COMPLETE" || v === "UPDATE_COMPLETE") return "ready";
  return "failed";
}

function outputs(s: Stack): ClusterInfo {
  const o = Object.fromEntries((s.Outputs ?? []).map((x) => [x.OutputKey ?? "", x.OutputValue ?? ""]));
  return {
    clusterArn: o.ClusterArn ?? "",
    clusterResourceId: o.ClusterResourceId ?? "",
    secretArn: o.SecretArn ?? "",
    host: o.Host ?? "",
    dumpProject: o.DumpProject ?? "",
    dumpBucket: o.DumpBucket ?? "",
  };
}

const body = (app: string, c: Cluster) =>
  JSON.stringify(template({ name: clusterName(app, c), prod: c === "prod", dumpUser: DUMP_USER }));

/** Starts creating (or updating) the cluster stack. Tags go on every resource:
 * revenant:app, revenant:env, revenant:project (lib/cost owns the values). */
export async function ensure(app: string, c: Cluster, tags: Record<string, string>): Promise<StackState> {
  const s = await describe(app, c);
  const now = state(s);
  const common = {
    StackName: stackName(app, c),
    TemplateBody: body(app, c),
    Capabilities: ["CAPABILITY_IAM" as const],
    Tags: Object.entries({ ...tags, "revenant:app": app, "revenant:env": c }).map(([Key, Value]) => ({ Key, Value })),
    // Optional install-provided role that CloudFormation uses to create the stack.
    RoleARN: process.env.RV_DB_STACK_ROLE_ARN || undefined,
  };
  if (now === "missing") {
    await client().send(new CreateStackCommand({ ...common, EnableTerminationProtection: c === "prod" }));
    return "creating";
  }
  if (now === "ready") {
    try {
      await client().send(new UpdateStackCommand(common));
      return "creating";
    } catch (e) {
      if (/No updates are to be performed/.test((e as Error).message ?? "")) return "ready";
      throw e;
    }
  }
  return now;
}

/** Stack outputs once the cluster exists; null while it is missing or still creating. */
export async function info(app: string, c: Cluster): Promise<ClusterInfo | null> {
  const key = stackName(app, c);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 300_000) return hit.info;
  const s = await describe(app, c);
  if (state(s) !== "ready" || !s) return null;
  const v = outputs(s);
  cache.set(key, { at: Date.now(), info: v });
  return v;
}

/** True when the app is on the SQL path (its dev cluster stack exists). */
export async function isSql(app: string): Promise<boolean> {
  return state(await describe(app, "dev")) !== "missing";
}

export const admin = (i: ClusterInfo): Target => ({ clusterArn: i.clusterArn, secretArn: i.secretArn, database: "postgres" });

/** Finishes setup on a complete cluster: creates <app>_prod or <app>_dev and the read-only
 * pg_dump role (IAM auth). Idempotent. Returns null while the stack is not ready. */
export async function ready(app: string, c: Cluster): Promise<ClusterInfo | null> {
  const i = await info(app, c);
  if (!i) return null;
  const t = admin(i);
  const name = dbName(app, c);
  const rows = await exec(t, `SELECT 1 FROM pg_database WHERE datname = ${lit(name)}`);
  if (!rows.length) await exec(t, `CREATE DATABASE "${name}"`);
  await exec(t, `DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = ${lit(DUMP_USER)}) THEN CREATE ROLE ${DUMP_USER} LOGIN; END IF;
  END $$`);
  await exec(t, `GRANT rds_iam TO ${DUMP_USER}`);
  await exec(t, `GRANT pg_read_all_data TO ${DUMP_USER}`);
  return i;
}

/** Env vars Revenant sets on the app's Amplify app for blocks/db. ARNs only, no secrets. */
export function appEnv(prod: ClusterInfo, dev: ClusterInfo): Record<string, string> {
  return {
    RV_DB_PROD_CLUSTER_ARN: prod.clusterArn,
    RV_DB_PROD_SECRET_ARN: prod.secretArn,
    RV_DB_DEV_CLUSTER_ARN: dev.clusterArn,
    RV_DB_DEV_SECRET_ARN: dev.secretArn,
  };
}
