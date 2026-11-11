// One resource group per generated app, so the console shows the app's resources in one
// place (Requirement 11.2). AppRegistry is closed to new accounts since 2026-07-30, so the
// group is a tag query on revenant:project; every resource already carries that tag
// (blocks/tags.ts for CDK, tagResources() for resources made outside CDK).
import "server-only";
import {
  BadRequestException,
  CreateGroupCommand,
  DeleteGroupCommand,
  GetGroupCommand,
  NotFoundException,
  ResourceGroupsClient,
} from "@aws-sdk/client-resource-groups";
import { ResourceGroupsTaggingAPIClient, TagResourcesCommand } from "@aws-sdk/client-resource-groups-tagging-api";
import { env as serverEnv } from "../env";
import { applicationName, appTags, type AppRef, type Env } from "./name";

const groups = new ResourceGroupsClient({ region: serverEnv.AWS_REGION });
const tagging = new ResourceGroupsTaggingAPIClient({ region: serverEnv.AWS_REGION });

export interface Application {
  arn: string;
}

const exists = (e: unknown) => e instanceof BadRequestException && /already exists/i.test(e.message);

/** Creates the rv-<app> group once; later calls return the same group. */
export async function ensureApplication(p: AppRef): Promise<Application> {
  const name = applicationName(p.name);
  try {
    const r = await groups.send(new CreateGroupCommand({
      Name: name,
      Description: `Revenant app ${p.name}`.replace(/[^\sa-zA-Z0-9_.-]/g, "-"),
      ResourceQuery: {
        Type: "TAG_FILTERS_1_0",
        Query: JSON.stringify({
          ResourceTypeFilters: ["AWS::AllSupported"],
          TagFilters: [{ Key: "revenant:project", Values: [p.id] }],
        }),
      },
      Tags: { "revenant:app": p.name, "revenant:project": p.id },
    }));
    if (!r.Group?.GroupArn) throw new Error("Resource Groups returned no group ARN");
    return { arn: r.Group.GroupArn };
  } catch (e) {
    if (!exists(e)) throw e;
    const g = await groups.send(new GetGroupCommand({ Group: name }));
    if (!g.Group?.GroupArn) throw new Error(`resource group ${name} has no ARN`);
    return { arn: g.Group.GroupArn };
  }
}

/** Env vars every Amplify app of a generated project needs (read by blocks/ and runner/). */
export function appEnv(p: AppRef, computeRoleArn?: string): Record<string, string> {
  const v: Record<string, string> = { RV_APP: p.name, RV_PROJECT_ID: p.id };
  if (computeRoleArn) v.RV_COMPUTE_ROLE_ARN = computeRoleArn;
  return v;
}

/** Adds the revenant:* tags to resources made outside CDK. */
export async function tagResources(arns: string[], p: AppRef, env: Env): Promise<void> {
  const tags = appTags(p, env);
  for (let i = 0; i < arns.length; i += 20) {
    const r = await tagging.send(new TagResourcesCommand({ ResourceARNList: arns.slice(i, i + 20), Tags: tags }));
    const failed = Object.entries(r.FailedResourcesMap ?? {});
    if (failed.length) throw new Error(`tagging failed: ${failed.map(([arn, f]) => `${arn} ${f.ErrorCode}`).join("; ")}`);
  }
}

/** Removes the rv-<app> group; a missing group is fine. */
export async function deleteApplication(app: string): Promise<void> {
  try {
    await groups.send(new DeleteGroupCommand({ Group: applicationName(app) }));
  } catch (e) {
    if (!(e instanceof NotFoundException)) throw e;
  }
}
