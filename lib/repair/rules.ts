// Rule-based fixes for common failures, tried before the agent so they cost no Kiro credits
// (Requirement 8.5). Today: a missing environment variable or a missing Gen 2 secret.
// Values are copied between AWS settings and never logged or written to the timeline.
import type { Project } from "../contracts";
import type { Aws } from "./ports";

export type Finding = { kind: "env" | "secret"; name: string };

const NAME = "([A-Z][A-Z0-9_]{1,63})";
const ENV: RegExp[] = [
  new RegExp(`missing (?:required )?environment variables?:?\\s*["'\`]?${NAME}`, "i"),
  new RegExp(`environment variable ["'\`]?${NAME}["'\`]? (?:is )?(?:not set|missing|required|undefined|not defined|not found)`, "i"),
  new RegExp(`process\\.env\\.${NAME}\\b[^\\n]{0,60}(?:undefined|not set|missing|required)`),
  new RegExp(`\\b${NAME} (?:is not set|must be set|is required)\\b`),
  // zod: { "path": ["RV_APP"], "message": "Required" }
  new RegExp(`"path":\\s*\\[\\s*"${NAME}"\\s*\\],\\s*"message":\\s*"Required"`),
];
const SECRET_NAME = "([A-Za-z][A-Za-z0-9_-]{0,127})";
const SECRET: RegExp[] = [
  new RegExp(`backend secret ["'\`]?${SECRET_NAME}["'\`]?`, "i"),
  new RegExp(`ParameterNotFound[^\\n]*?/amplify/[^\\s"']+/${SECRET_NAME}`),
  new RegExp(`secret ["'\`]?${SECRET_NAME}["'\`]? (?:was )?not found`, "i"),
];

export function detect(log: string): Finding | null {
  for (const re of SECRET) {
    const m = re.exec(log);
    if (m?.[1]) return { kind: "secret", name: m[1] };
  }
  for (const re of ENV) {
    const m = re.exec(log);
    if (m?.[1]) return { kind: "env", name: m[1] };
  }
  return null;
}

export type RuleResult = { fixed: boolean; cause: string };

/** Gen 2 secret parameter names (Parameter Store, SecureString). */
export const secretParam = (appId: string, branch: string, name: string) => `/amplify/${appId}/${branch}/${name}`;
export const sharedParam = (appId: string, name: string) => `/amplify/shared/${appId}/${name}`;

/**
 * Applies the fix for a finding on `branch`. `fixed: false` means no value is known: a person has
 * to set it, and the agent cannot help either, so the loop stops instead of spending credits.
 * null means the rule does not apply after all; the agent takes it.
 */
export async function apply(f: Finding, p: Project, branch: string, aws: Aws): Promise<RuleResult | null> {
  const appId = p.amplifyAppId!;
  if (f.kind === "env") {
    const known: Record<string, string | undefined> = {
      RV_APP: p.name,
      RV_PROJECT_ID: p.id,
      RV_AMPLIFY_APP_ID: appId,
    };
    const app = await aws.appEnv(appId);
    const current = (await aws.branchEnv(appId, branch)) ?? {};
    // Set already (branches inherit app variables): the failure is something else.
    if (current[f.name] || app[f.name]) return null;
    const main = branch === "main" ? null : await aws.branchEnv(appId, "main");
    const value = known[f.name] ?? main?.[f.name];
    if (value === undefined) {
      return { fixed: false, cause: `The app needs the environment variable ${f.name} and its value is not set anywhere; set it in Amplify for ${branch}.` };
    }
    await aws.setBranchEnv(appId, branch, { ...current, [f.name]: value });
    return { fixed: true, cause: `The environment variable ${f.name} was not set on ${branch}; Revenant set it and redeployed.` };
  }
  // Set already: the failure is something else, leave it to the agent.
  if (await aws.param(sharedParam(appId, f.name))) return null;
  if (await aws.param(secretParam(appId, branch, f.name))) return null;
  const fromMain = branch === "main" ? null : await aws.param(secretParam(appId, "main", f.name));
  if (fromMain === null) {
    return { fixed: false, cause: `The app needs the secret ${f.name}, which is not set; add it in Amplify secrets for ${branch}.` };
  }
  await aws.putParam(secretParam(appId, branch, f.name), fromMain);
  return { fixed: true, cause: `The secret ${f.name} was missing on ${branch}; Revenant copied it from main and redeployed.` };
}
