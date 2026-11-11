// Work the Revenant server may not do itself. Amplify Hosting gives the SSR session a policy
// that denies IAM, so creating runner roles and passing roles to CodeBuild, Amplify and
// CloudFormation runs in the broker Lambda (amplify/functions/broker). Every op checks its
// input against the install's fixed names before it calls AWS.
import { AmplifyClient, CreateAppCommand, UpdateAppCommand, type CreateAppCommandInput, type UpdateAppCommandInput } from "@aws-sdk/client-amplify";
import { CloudFormationClient, CreateStackCommand, UpdateStackCommand, type CreateStackCommandInput, type UpdateStackCommandInput } from "@aws-sdk/client-cloudformation";
import { CodeBuildClient, StartBuildCommand } from "@aws-sdk/client-codebuild";
import { AttachRolePolicyCommand, CreateRoleCommand, GetRoleCommand, IAMClient, PutRolePolicyCommand } from "@aws-sdk/client-iam";
import { policy, roleName, trust } from "../../runner/role";

export type Op =
  | { op: "role"; app: string; owner: string }
  | { op: "build"; app: string; vars: Record<string, string>; minutes?: number }
  | { op: "createApp"; input: CreateAppCommandInput }
  | { op: "updateApp"; input: UpdateAppCommandInput }
  | { op: "createStack"; input: CreateStackCommandInput }
  | { op: "updateStack"; input: UpdateStackCommandInput };

export type Reply = { ok: true; value: unknown } | { ok: false; name: string; message: string };

export interface Config {
  partition: string;
  region: string;
  account: string;
  runnerProject: string;
  runnerLogGroup: string;
  promptBucket: string;
  kiroSecretArn?: string;
  boundary: string;
  basePolicy?: string;
  appsServiceRole?: string;
  appsComputeRole?: string;
  dbStackRole?: string;
  ownAppId?: string;
}

export class Refused extends Error {
  override name = "BrokerRefused";
}

const APP = /^[a-z][a-z0-9-]{0,40}$/;
const OWNER = /^[A-Za-z0-9-]{1,64}$/;
const VAR = /^[A-Z_][A-Z0-9_]{0,63}$/;

function need(ok: unknown, why: string): asserts ok {
  if (!ok) throw new Refused(why);
}

const sameOrNone = (v: string | undefined, want: string | undefined, what: string) =>
  need(v === undefined || (want !== undefined && v === want), `${what} must be the install's role`);

export function check(op: Op, c: Config): void {
  switch (op.op) {
    case "role":
      need(APP.test(op.app), "bad app name");
      need(OWNER.test(op.owner), "bad owner");
      return;
    case "build":
      need(APP.test(op.app), "bad app name");
      need(Object.entries(op.vars).every(([k, v]) => VAR.test(k) && typeof v === "string"), "bad build variables");
      need(op.minutes === undefined || (Number.isInteger(op.minutes) && op.minutes >= 5 && op.minutes <= 480), "bad build timeout");
      return;
    case "createApp":
      need(op.input.name?.startsWith("rv-"), "app name must start with rv-");
      need(op.input.tags?.["revenant:project"], "app needs a revenant:project tag");
      need(op.input.iamServiceRoleArn !== undefined && op.input.iamServiceRoleArn === c.appsServiceRole, "service role must be the install's role");
      sameOrNone(op.input.computeRoleArn, c.appsComputeRole, "compute role");
      return;
    case "updateApp":
      need(op.input.appId && op.input.appId !== c.ownAppId, "not this app");
      sameOrNone(op.input.iamServiceRoleArn, c.appsServiceRole, "service role");
      sameOrNone(op.input.computeRoleArn, c.appsComputeRole, "compute role");
      return;
    case "createStack":
    case "updateStack":
      need(op.input.StackName?.startsWith("rv-"), "stack name must start with rv-");
      sameOrNone(op.input.RoleARN, c.dbStackRole, "stack role");
      return;
    default:
      throw new Refused("unknown op");
  }
}

const strip = <T extends { $metadata?: unknown }>(o: T) => {
  const { $metadata: _, ...rest } = o;
  return rest;
};

export async function run(op: Op, c: Config): Promise<unknown> {
  check(op, c);
  switch (op.op) {
    case "role":
      return ensureRole(op.app, op.owner, c);
    case "build": {
      const r = await new CodeBuildClient({ region: c.region }).send(new StartBuildCommand({
        projectName: c.runnerProject,
        serviceRoleOverride: `arn:${c.partition}:iam::${c.account}:role/${roleName(op.app)}`,
        ...(op.minutes ? { timeoutInMinutesOverride: op.minutes } : {}),
        environmentVariablesOverride: Object.entries(op.vars).map(([name, value]) => ({ name, value, type: "PLAINTEXT" })),
        logsConfigOverride: { cloudWatchLogs: { status: "ENABLED", groupName: c.runnerLogGroup } },
      }));
      return { id: r.build?.id ?? null };
    }
    case "createApp":
      return strip(await new AmplifyClient({ region: c.region }).send(new CreateAppCommand(op.input)));
    case "updateApp":
      return strip(await new AmplifyClient({ region: c.region }).send(new UpdateAppCommand(op.input)));
    case "createStack":
      return strip(await new CloudFormationClient({ region: c.region }).send(new CreateStackCommand(op.input)));
    case "updateStack":
      return strip(await new CloudFormationClient({ region: c.region }).send(new UpdateStackCommand(op.input)));
  }
}

/** The per-app runner role (runner/role.ts), created once per app. */
async function ensureRole(app: string, owner: string, c: Config): Promise<{ created: boolean }> {
  const iam = new IAMClient({ region: c.region });
  const name = roleName(app);
  try {
    await iam.send(new GetRoleCommand({ RoleName: name }));
    return { created: false };
  } catch (e) {
    if ((e as Error).name !== "NoSuchEntityException") throw e;
  }
  await iam.send(new CreateRoleCommand({
    RoleName: name,
    AssumeRolePolicyDocument: JSON.stringify(trust(c.account)),
    PermissionsBoundary: c.boundary,
    Description: `Revenant runner for ${app}`,
    Tags: [{ Key: "revenant:project", Value: app }, { Key: "revenant:app", Value: "revenant" }],
  }));
  await iam.send(new PutRolePolicyCommand({
    RoleName: name,
    PolicyName: "runner",
    PolicyDocument: JSON.stringify(policy({
      partition: c.partition, region: c.region, account: c.account, app, repo: `rv-${app}`, owner,
      companySecretArn: c.kiroSecretArn,
      promptBucket: c.promptBucket,
      logGroup: c.runnerLogGroup,
    })),
  }));
  if (c.basePolicy) await iam.send(new AttachRolePolicyCommand({ RoleName: name, PolicyArn: c.basePolicy }));
  return { created: true };
}
