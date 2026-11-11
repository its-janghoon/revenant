// Amplify Data model guard (Requirement 6.4-6.6), on amplify/data/resource.ts before and after.
//   identifier change of an existing model     -> error (it replaces the table and loses data)
//   new required field on an existing model,
//   or an optional field made required         -> error unless a backfill is added in the same change
//   field or model removed (a rename is one)   -> approval at publish, with the number of records
// A backfill is the file amplify/data/backfill/<Model>.<field>.ts, added in the change.
// No TypeScript compiler here (the runner image has no node_modules): a small scanner that
// understands strings, comments and brackets reads the `a.schema({...})` literal.
import type { Finding } from "./types";

export interface Field { kind: string; required: boolean }
export interface Model { identifier: string[]; fields: Record<string, Field> }
export type Schema = Record<string, Model>;

export const BACKFILL_DIR = "amplify/data/backfill";
export const backfillPath = (model: string, field: string) => `${BACKFILL_DIR}/${model}.${field}.ts`;

/** Fields that store nothing in the model's own table. */
const VIRTUAL = new Set(["hasMany", "hasOne", "belongsTo"]);

// ---------- scanner ----------

const OPEN: Record<string, string> = { "(": ")", "[": "]", "{": "}" };

/** Index just past a string, template literal or comment that starts at i, or i when none does. */
function skip(s: string, i: number): number {
  const c = s[i];
  if (c === "/" && s[i + 1] === "/") {
    const n = s.indexOf("\n", i);
    return n < 0 ? s.length : n;
  }
  if (c === "/" && s[i + 1] === "*") {
    const n = s.indexOf("*/", i + 2);
    return n < 0 ? s.length : n + 2;
  }
  if (c === '"' || c === "'") {
    let j = i + 1;
    while (j < s.length && s[j] !== c) j += s[j] === "\\" ? 2 : 1;
    return j + 1;
  }
  if (c === "`") {
    let j = i + 1;
    while (j < s.length && s[j] !== "`") {
      if (s[j] === "\\") j += 2;
      else if (s[j] === "$" && s[j + 1] === "{") j = close(s, j + 1) + 1;
      else j++;
    }
    return j + 1;
  }
  return i;
}

/** Index of the bracket that closes the one at `open`; s.length when it never closes. */
export function close(s: string, open: number): number {
  const stack: string[] = [OPEN[s[open]!]!];
  let i = open + 1;
  while (i < s.length) {
    const j = skip(s, i);
    if (j !== i) {
      i = j;
      continue;
    }
    const c = s[i]!;
    if (OPEN[c]) stack.push(OPEN[c]!);
    else if (c === stack[stack.length - 1]) {
      stack.pop();
      if (!stack.length) return i;
    }
    i++;
  }
  return s.length;
}

/** Splits s[from, to) at top-level commas. */
function split(s: string, from: number, to: number): string[] {
  const parts: string[] = [];
  let start = from;
  let i = from;
  while (i < to) {
    const j = skip(s, i);
    if (j !== i) {
      i = j;
      continue;
    }
    const c = s[i]!;
    if (OPEN[c]) {
      i = close(s, i) + 1;
      continue;
    }
    if (c === ",") {
      parts.push(s.slice(start, i));
      start = i + 1;
    }
    i++;
  }
  parts.push(s.slice(start, to));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Strips comments so regexes see only code. Strings stay. */
function code(s: string): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    const j = skip(s, i);
    if (j === i) {
      out += s[i];
      i++;
    } else {
      out += s[i] === "/" ? " " : s.slice(i, j);
      i = j;
    }
  }
  return out;
}

/** First match of `re` that starts outside strings and comments. */
function find(s: string, re: RegExp): RegExpExecArray | null {
  const y = new RegExp(re.source, "y");
  let i = 0;
  while (i < s.length) {
    const j = skip(s, i);
    if (j !== i) {
      i = j;
      continue;
    }
    y.lastIndex = i;
    const m = y.exec(s);
    if (m) return m;
    i++;
  }
  return null;
}

/** "key: value" (key may be quoted) or a shorthand "key". */
function entry(part: string): [string, string] | null {
  const m = /^(?:(["'])(.+?)\1|([A-Za-z_$][\w$]*))\s*(?::\s*([\s\S]*))?$/.exec(part);
  if (!m) return null;
  const key = m[2] ?? m[3]!;
  return [key, m[4] ?? key];
}

const literals = (s: string) => [...s.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2]!);

/** Resolves `Name` to the expression of `const Name = ...;` when the value is an identifier. */
function resolve(src: string, value: string): string {
  if (!/^[A-Za-z_$][\w$]*$/.test(value)) return value;
  const m = find(src, new RegExp(`\\b(?:const|let|var)\\s+${value}\\b\\s*(?::[^=]+)?=\\s*`));
  if (!m) return value;
  const start = m.index + m[0].length;
  let i = start;
  while (i < src.length && src[i] !== ";") {
    const j = skip(src, i);
    if (j !== i) i = j;
    else if (OPEN[src[i]!]) i = close(src, i) + 1;
    else if (src[i] === "\n" && !/[.(\[{,]\s*$/.test(src.slice(start, i)) && !/^\s*\./.test(src.slice(i + 1))) break;
    else i++;
  }
  return src.slice(start, i).trim();
}

function field(expr: string): Field {
  const kind = /^a\s*\.\s*(\w+)/.exec(expr)?.[1] ?? "unknown";
  return { kind, required: /\.\s*required\s*\(\s*\)/.test(expr) };
}

function model(src: string, expr: string): Model | null {
  const m = /^a\s*\.\s*model\s*\(/.exec(expr);
  if (!m) return null;
  const open = m[0].length - 1;
  const end = close(expr, open);
  const args = expr.slice(open + 1, end).trim();
  const fields: Record<string, Field> = {};
  if (args.startsWith("{")) {
    const body = close(args, 0);
    for (const part of split(args, 1, body)) {
      const e = entry(part);
      if (e) fields[e[0]] = field(resolve(src, e[1]));
    }
  }
  const rest = expr.slice(end + 1);
  const id = /\.\s*identifier\s*\(\s*\[([^\]]*)\]/.exec(rest);
  return { identifier: id ? literals(id[1]!) : ["id"], fields };
}

/** Models in an Amplify Data resource file, or null when it has no `a.schema({...})`. */
export function parseSchema(source: string): Schema | null {
  const src = code(source);
  const m = find(src, /\ba\s*\.\s*schema\s*\(\s*\{/);
  if (!m) return null;
  const open = m.index + m[0].length - 1;
  const end = close(src, open);
  const out: Schema = {};
  for (const part of split(src, open + 1, end)) {
    const e = entry(part);
    if (!e) continue;
    const md = model(src, resolve(src, e[1]));
    if (md) out[e[0]] = md;
  }
  return out;
}

// ---------- diff ----------

export type ModelChange =
  | { kind: "identifier"; model: string; from: string[]; to: string[] }
  | { kind: "required"; model: string; field: string; backfill: boolean; existing: boolean }
  | { kind: "removeModel"; model: string; renamedTo?: string }
  | { kind: "removeField"; model: string; field: string; renamedTo?: string };

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Changes between two schemas. `backfills` holds "Model.field" for every backfill file the
 * change adds. A null base (no schema yet) has no existing data, so nothing is checked.
 */
export function diffSchemas(base: Schema | null, head: Schema | null, backfills: Set<string>): ModelChange[] {
  if (!base) return [];
  const after = head ?? {};
  const out: ModelChange[] = [];
  const has = (o: object, k: string) => Object.hasOwn(o, k);
  const added = Object.keys(after).filter((m) => !has(base, m));
  for (const [name, b] of Object.entries(base)) {
    const h = has(after, name) ? after[name] : undefined;
    if (!h) {
      const keys = Object.keys(b.fields).sort().join(",");
      const renamedTo = added.find((m) => Object.keys(after[m]!.fields).sort().join(",") === keys);
      out.push({ kind: "removeModel", model: name, ...(renamedTo ? { renamedTo } : {}) });
      continue;
    }
    if (!same(b.identifier, h.identifier)) out.push({ kind: "identifier", model: name, from: b.identifier, to: h.identifier });
    const gone = Object.entries(b.fields).filter(([f, x]) => !VIRTUAL.has(x.kind) && !has(h.fields, f));
    const fresh = Object.entries(h.fields).filter(([f, x]) => !VIRTUAL.has(x.kind) && !has(b.fields, f));
    for (const [f, x] of gone) {
      const twins = fresh.filter(([, y]) => y.kind === x.kind);
      const renamedTo = gone.filter(([, y]) => y.kind === x.kind).length === 1 && twins.length === 1 ? twins[0]![0] : undefined;
      out.push({ kind: "removeField", model: name, field: f, ...(renamedTo ? { renamedTo } : {}) });
    }
    for (const [f, x] of Object.entries(h.fields)) {
      if (VIRTUAL.has(x.kind) || !x.required) continue;
      const was = has(b.fields, f) ? b.fields[f] : undefined;
      if (was && was.required) continue;
      out.push({ kind: "required", model: name, field: f, backfill: backfills.has(`${name}.${f}`), existing: !!was });
    }
  }
  return out;
}

export function modelFindings(changes: ModelChange[]): Finding[] {
  const out: Finding[] = [];
  for (const c of changes) {
    switch (c.kind) {
      case "identifier":
        out.push({
          rule: "data.identifier",
          resource: c.model,
          level: "error",
          message: `the identifier of ${c.model} changed from [${c.from.join(", ")}] to [${c.to.join(", ")}]; that replaces the table and loses its data. Keep the identifier and add a new model instead`,
        });
        break;
      case "required":
        if (!c.backfill) {
          out.push({
            rule: "data.required",
            resource: `${c.model}.${c.field}`,
            level: "error",
            message: `${c.existing ? "field made required" : "new required field"} ${c.model}.${c.field} without a backfill; make it optional or add ${backfillPath(c.model, c.field)} in the same change`,
          });
        }
        break;
      case "removeModel":
        out.push({
          rule: "data.remove",
          resource: c.model,
          level: "approval",
          message: c.renamedTo
            ? `model ${c.model} looks renamed to ${c.renamedTo}; its records stay in the old table. Needs approval at publish`
            : `model ${c.model} is removed; its records are lost. Needs approval at publish`,
        });
        break;
      case "removeField":
        out.push({
          rule: "data.remove",
          resource: `${c.model}.${c.field}`,
          level: "approval",
          message: c.renamedTo
            ? `field ${c.model}.${c.field} looks renamed to ${c.renamedTo}; existing values stay under the old name. Needs approval at publish`
            : `field ${c.model}.${c.field} is removed; its values are no longer readable. Needs approval at publish`,
        });
        break;
    }
  }
  return out;
}

/** "Model.field" for each backfill file path, e.g. amplify/data/backfill/Note.title.ts -> Note.title. */
export function backfillKeys(paths: string[]): Set<string> {
  const out = new Set<string>();
  for (const p of paths) {
    const m = /^amplify\/data\/backfill\/([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\.ts$/.exec(p.replace(/\\/g, "/"));
    if (m) out.add(`${m[1]}.${m[2]}`);
  }
  return out;
}
