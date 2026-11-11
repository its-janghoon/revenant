// Resource names and tags for generated apps (Requirement 11.2, 11.3).
// Same rules as blocks/name.ts, for code that runs in Revenant instead of in CDK:
// rv-<app>-<prod|dev|pv<n>>[-<part>].
import { appName } from "../contracts";

export type Env = "prod" | "dev" | `pv${number}`;

/** "main" -> prod, "preview/3" -> pv3, anything else -> dev. */
export function envOf(branch: string): Env {
  if (branch === "main") return "prod";
  const pv = /^preview[-/]?(\d+)$/.exec(branch);
  return pv ? `pv${Number(pv[1])}` : "dev";
}

/** rv-<app>-<env>[-<part>], lowercase, at most 63 characters. */
export function rvName(app: string, env: Env, part?: string): string {
  appName.parse(app);
  const n = [`rv-${app}-${env}`, part].filter(Boolean).join("-").toLowerCase();
  return n.replace(/[^a-z0-9-]/g, "-").slice(0, 63).replace(/-+$/, "");
}

/** Name of the app's resource group: rv-<app>. */
export function applicationName(app: string): string {
  return `rv-${appName.parse(app)}`;
}

export interface AppRef {
  id: string; // project id
  name: string; // app name
}

/** Tags for a resource Revenant creates outside CDK (CodeCommit repo, Amplify app, CodeBuild project). */
export function appTags(p: AppRef, env: Env): Record<string, string> {
  return {
    "revenant:app": p.name,
    "revenant:env": env,
    "revenant:name": rvName(p.name, env),
    "revenant:project": p.id,
  };
}
