// One AppRegistry application per generated app, so myApplications shows the app and its
// cost (Requirement 11.2). The deploy lane calls ensureApplication() before the first
// Amplify build and puts appEnv() on the Amplify app; blocks/tags.ts then tags every
// CDK resource with awsApplication. tagResources() covers resources made outside CDK.
import "server-only";
import {
  ConflictException,
  CreateApplicationCommand,
  DeleteApplicationCommand,
  GetApplicationCommand,
  ResourceNotFoundException,
  ServiceCatalogAppRegistryClient,
} from "@aws-sdk/client-service-catalog-appregistry";
import { ResourceGroupsTaggingAPIClient, TagResourcesCommand } from "@aws-sdk/client-resource-groups-tagging-api";
import { env as serverEnv } from "../env";
import { applicationName, appTags, type AppRef, type Env } from "./name";

const registry = new ServiceCatalogAppRegistryClient({ region: serverEnv.AWS_REGION });
const tagging = new ResourceGroupsTaggingAPIClient({ region: serverEnv.AWS_REGION });

export interface Application {
  arn: string;
  /** Value of the awsApplication tag (the application ARN). */
  tag: string;
}

function toApplication(a: { arn?: string; applicationTag?: Record<string, string> } | undefined): Application {
  if (!a?.arn) throw new Error("AppRegistry returned no application ARN");
  return { arn: a.arn, tag: a.applicationTag?.awsApplication ?? a.arn };
}

/** Creates rv-<app> once; later calls return the same application. */
export async function ensureApplication(p: AppRef): Promise<Application> {
  const name = applicationName(p.name);
  try {
    const r = await registry.send(new CreateApplicationCommand({
      name,
      description: `Revenant app ${p.name}`,
      tags: { "revenant:app": p.name, "revenant:project": p.id },
      clientToken: p.id,
    }));
    return toApplication(r.application);
  } catch (e) {
    if (!(e instanceof ConflictException)) throw e;
    return toApplication(await registry.send(new GetApplicationCommand({ application: name })));
  }
}

/** Env vars every Amplify app of a generated project needs (read by blocks/ and runner/). */
export function appEnv(p: AppRef, application: Application, computeRoleArn?: string): Record<string, string> {
  const v: Record<string, string> = { RV_APP: p.name, RV_PROJECT_ID: p.id, RV_AWS_APPLICATION: application.tag };
  if (computeRoleArn) v.RV_COMPUTE_ROLE_ARN = computeRoleArn;
  return v;
}

/** Adds awsApplication and revenant:* tags to resources made outside CDK. */
export async function tagResources(arns: string[], p: AppRef, env: Env, application: Application): Promise<void> {
  const tags = appTags(p, env, application.tag);
  for (let i = 0; i < arns.length; i += 20) {
    const r = await tagging.send(new TagResourcesCommand({ ResourceARNList: arns.slice(i, i + 20), Tags: tags }));
    const failed = Object.entries(r.FailedResourcesMap ?? {});
    if (failed.length) throw new Error(`tagging failed: ${failed.map(([arn, f]) => `${arn} ${f.ErrorCode}`).join("; ")}`);
  }
}

/** Removes rv-<app>; a missing application is fine. */
export async function deleteApplication(app: string): Promise<void> {
  try {
    await registry.send(new DeleteApplicationCommand({ application: applicationName(app) }));
  } catch (e) {
    if (!(e instanceof ResourceNotFoundException)) throw e;
  }
}
