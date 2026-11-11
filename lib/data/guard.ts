// Data part of the guardrail check (Requirement 6.4-6.6, 7.6). lib/guard.ts calls
// checkData({ repo, base }) and adds the findings; `approvals` become an approval request
// with the record counts from lib/data/records.ts.
//
// Compares amplify/data/resource.ts at `base` (main) with the working tree:
//   - a model's identifier changed           -> rejected (the table would be replaced)
//   - a new or newly required field with no `.default(...)` and no backfill file
//     amplify/data/backfill/<Model>.<field>.ts                        -> rejected
//   - a model or field removed (a rename is a removal plus an add)     -> needs approval
//   - a field's type changed                                           -> needs approval
// and the SQL migrations: an applied migration (drizzle/*.sql on base) edited or deleted -> rejected.
//
// Runs in the runner image: node: modules and relative imports only.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { backfillPath } from "../guard/model";

export type Finding = { rule: string; resource?: string; message: string };
export type Approval = { kind: "model-removed" | "field-removed" | "field-type"; model: string; field?: string; message: string };
export type DataGuardResult = { ok: boolean; findings: Finding[]; approvals: Approval[] };

export const SCHEMA = "amplify/data/resource.ts";
// One place for the backfill path (amplify/data/backfill/<Model>.<field>.ts): lib/guard/model.ts.
export { backfillPath };

type Field = { type: string; required: boolean; defaulted: boolean };
type Model = { identifier: string[]; fields: Record<string, Field> };

const OPEN: Record<string, string> = { "(": ")", "[": "]", "{": "}" };

/** Index of the bracket that closes src[at], skipping strings and comments. */
function close(src: string, at: number): number {
  const stack: string[] = [];
  for (let i = at; i < src.length; i++) {
    const c = src[i]!;
    if (c === "/" && src[i + 1] === "/") { i = src.indexOf("\n", i); if (i < 0) return -1; continue; }
    if (c === "/" && src[i + 1] === "*") { i = src.indexOf("*/", i + 2) + 1; if (i <= 0) return -1; continue; }
    if (c === '"' || c === "'" || c === "`") {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === "\\") i++;
      continue;
    }
    if (OPEN[c]) stack.push(OPEN[c]!);
    else if (c === ")" || c === "]" || c === "}") {
      if (stack.pop() !== c) return -1;
      if (!stack.length) return i;
    }
  }
  return -1;
}

/** Splits at top-level commas. */
function split(body: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    if (OPEN[c] || c === '"' || c === "'" || c === "`" || (c === "/" && (body[i + 1] === "/" || body[i + 1] === "*"))) {
      const end = OPEN[c] ? close(body, i) : skip(body, i);
      if (end < 0) break;
      i = end;
    } else if (c === ",") {
      out.push(body.slice(start, i));
      start = i + 1;
    }
  }
  out.push(body.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}

function skip(s: string, i: number): number {
  const c = s[i]!;
  if (c === "/" && s[i + 1] === "/") { const n = s.indexOf("\n", i); return n < 0 ? s.length - 1 : n; }
  if (c === "/") { const n = s.indexOf("*/", i + 2); return n < 0 ? s.length - 1 : n + 1; }
  for (i++; i < s.length && s[i] !== c; i++) if (s[i] === "\\") i++;
  return i;
}

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/** Models of an Amplify Data schema: `Name: a.model({ ... }).identifier([...])...`. */
export function models(src: string): Record<string, Model> {
  const out: Record<string, Model> = {};
  const re = /["']?([A-Za-z_]\w*)["']?\s*:\s*a\s*\.\s*model\s*\(/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const open = m.index + m[0].length - 1;
    const end = close(src, open);
    if (end < 0) continue;
    const inner = src.slice(open + 1, end).trim();
    const fields: Record<string, Field> = {};
    if (inner.startsWith("{")) {
      for (const entry of split(inner.slice(1, close(inner, 0)))) {
        const f = /^["']?([A-Za-z_]\w*)["']?\s*:\s*([\s\S]+)$/.exec(strip(entry).trim());
        if (!f) continue;
        const expr = f[2]!;
        fields[f[1]!] = {
          type: /a\s*\.\s*(\w+)/.exec(expr)?.[1] ?? expr.split("(")[0]!.trim(),
          required: /\.\s*required\s*\(\s*\)/.test(expr),
          defaulted: /\.\s*default\s*\(/.test(expr),
        };
      }
    }
    // The chain after a.model(...): up to the next top-level "," or "}" of the schema object.
    let chainEnd = end + 1;
    for (; chainEnd < src.length; chainEnd++) {
      const c = src[chainEnd]!;
      if (c === "," || c === "}") break;
      if (OPEN[c]) { const e = close(src, chainEnd); if (e < 0) break; chainEnd = e; }
    }
    const chain = strip(src.slice(end + 1, chainEnd));
    const id = /\.\s*identifier\s*\(\s*\[([^\]]*)\]/.exec(chain);
    const identifier = id ? id[1]!.split(",").map((s) => s.trim().replace(/^["'`]|["'`]$/g, "")).filter(Boolean) : ["id"];
    out[m[1]!] = { identifier, fields };
    re.lastIndex = chainEnd;
  }
  return out;
}

function git(repo: string, args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 16 << 20 });
  } catch {
    return null;
  }
}

/** Pure comparison, for tests and for callers that already have both files. */
export function compare(before: string, after: string, hasBackfill: (model: string, field: string) => boolean): DataGuardResult {
  const findings: Finding[] = [];
  const approvals: Approval[] = [];
  const a = models(before);
  const b = models(after);

  for (const [name, old] of Object.entries(a)) {
    const now = b[name];
    if (!now) {
      approvals.push({ kind: "model-removed", model: name, message: `model ${name} is removed or renamed; its table and records go away` });
      continue;
    }
    if (old.identifier.join(",") !== now.identifier.join(",")) {
      findings.push({
        rule: "data-identifier",
        resource: name,
        message: `model ${name} changed its identifier from [${old.identifier}] to [${now.identifier}]; that replaces the table and loses its data. Keep the identifier.`,
      });
    }
    for (const [field, f] of Object.entries(old.fields)) {
      const g = now.fields[field];
      if (!g) approvals.push({ kind: "field-removed", model: name, field, message: `field ${name}.${field} is removed or renamed` });
      else if (g.type !== f.type) approvals.push({ kind: "field-type", model: name, field, message: `field ${name}.${field} changes type from ${f.type} to ${g.type}` });
    }
    for (const [field, g] of Object.entries(now.fields)) {
      const f = old.fields[field];
      const newlyRequired = g.required && !g.defaulted && (!f || !f.required);
      if (newlyRequired && !hasBackfill(name, field)) {
        findings.push({
          rule: "data-required-field",
          resource: `${name}.${field}`,
          message: `${name}.${field} is required but existing records have no value. Make it optional, give it .default(...), or add ${backfillPath(name, field)} in the same commit.`,
        });
      }
    }
  }
  return { ok: findings.length === 0, findings, approvals };
}

export function checkData(input: { repo: string; base?: string }): DataGuardResult {
  const result: DataGuardResult = { ok: true, findings: [], approvals: [] };
  if (!input.base) return result; // first build: nothing deployed yet

  const before = git(input.repo, ["show", `${input.base}:${SCHEMA}`]);
  const file = join(input.repo, SCHEMA);
  if (before !== null && existsSync(file)) {
    const r = compare(before, readFileSync(file, "utf8"), (m, f) => existsSync(join(input.repo, backfillPath(m, f))));
    result.findings.push(...r.findings);
    result.approvals.push(...r.approvals);
  } else if (before !== null) {
    result.approvals.push({ kind: "model-removed", model: "*", message: `${SCHEMA} is deleted; every Amplify Data table goes away` });
  }

  // Applied SQL migrations never change (working tree vs base, committed or not).
  const diff = git(input.repo, ["diff", "--name-status", "--no-renames", input.base, "--", "drizzle"]) ?? "";
  for (const line of diff.split("\n")) {
    const [status, path] = line.split("\t");
    if (path?.endsWith(".sql") && (status === "M" || status === "D")) {
      result.findings.push({
        rule: "migration-edited",
        resource: path,
        message: `${path} is already applied; never edit or delete it. Revert it and add a new migration.`,
      });
    }
  }
  result.ok = result.findings.length === 0;
  return result;
}
