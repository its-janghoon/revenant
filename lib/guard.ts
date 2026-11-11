// Guardrail check (Requirements 5.4, 6.4-6.6, 10). Called by the runner after synth:
//   tsx runner/guard.ts --cdk-out .amplify/artifacts/cdk.out --repo . [--base origin/main]
// which imports check() from here. Node built-ins and relative imports only.
//   1. rules on every synthesized template (retain, IAM, secrets)
//   2. the Amplify Data model guard: amplify/data/resource.ts at `base` against the working tree
// ok is false when any finding is an error. Approval findings pass here and are asked at publish.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readCdkOut } from "./guard/cdkout";
import { backfillKeys, BACKFILL_DIR, diffSchemas, modelFindings, parseSchema, type Schema } from "./guard/model";
import { rules } from "./guard/rules";
import type { Finding, GuardInput, GuardResult, Stacks } from "./guard/types";

export { classify, describe, destructive, normalize, type Action, type Change } from "./guard/classify";
export { backfillKeys, backfillPath, diffSchemas, modelFindings, parseSchema, type ModelChange, type Schema } from "./guard/model";
export { isData, keepsData, rules } from "./guard/rules";
export type { Finding, GuardInput, GuardResult, Level, Resource, Stacks, Template } from "./guard/types";

export const DATA_FILE = "amplify/data/resource.ts";

function git(repo: string, args: string[]): string | null {
  try {
    return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 16 << 20 });
  } catch {
    return null;
  }
}

/** Data model findings for the change from `base` to the working tree. */
export function dataCheck(repo: string, base?: string): Finding[] {
  const file = join(repo, DATA_FILE);
  const headSrc = existsSync(file) ? readFileSync(file, "utf8") : null;
  const head: Schema | null = headSrc === null ? null : parseSchema(headSrc);
  if (headSrc !== null && head === null) {
    return [{ rule: "data.parse", resource: DATA_FILE, level: "error", message: `${DATA_FILE} has no a.schema({...}) the guard can read` }];
  }
  if (!base) return [];
  const baseSrc = git(repo, ["show", `${base}:${DATA_FILE}`]);
  const before = baseSrc === null ? null : parseSchema(baseSrc);

  const dir = join(repo, BACKFILL_DIR);
  const now = existsSync(dir) ? readdirSync(dir).map((n) => `${BACKFILL_DIR}/${n}`) : [];
  const had = new Set((git(repo, ["ls-tree", "-r", "--name-only", base, "--", BACKFILL_DIR]) ?? "").split("\n").filter(Boolean));
  const added = backfillKeys(now.filter((p) => !had.has(p)));

  return modelFindings(diffSchemas(before, head, added));
}

export function check(input: GuardInput): GuardResult {
  const findings: Finding[] = [];
  let stacks: Stacks;
  try {
    stacks = readCdkOut(input.cdkOut);
  } catch (e) {
    stacks = {};
    findings.push({ rule: "synth", level: "error", message: `cannot read ${input.cdkOut}: ${(e as Error).message}` });
  }
  if (!Object.keys(stacks).length && !findings.length) {
    findings.push({ rule: "synth", level: "error", message: `no templates in ${input.cdkOut}; synth produced nothing to check` });
  }
  findings.push(...rules(stacks), ...dataCheck(input.repo, input.base));
  return { ok: !findings.some((f) => f.level === "error"), findings };
}

export default check;
