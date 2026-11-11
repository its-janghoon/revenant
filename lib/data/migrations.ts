// Publish plan for an SQL app (Requirement 6.9): the Drizzle migrations that `main` does not
// have yet, which of their statements destroy data, and a refusal when a migration that is
// already on `main` (applied to prod) was edited or deleted.
//
// lib/deploy's publish route: GET -> plan(); POST -> snapshot() (lib/data/snapshot.ts), then
// merge to main; the main build runs blocks/db/migrate.ts against <app>_prod.
import type { PublishPlan } from "../contracts";
import { MIGRATIONS } from "./names";

/** Read access to the app's repository at a ref. lib/deploy passes its CodeCommit reader. */
export interface RepoReader {
  /** File names directly under `dir` at `ref` ([] when the folder does not exist). */
  list(ref: string, dir: string): Promise<string[]>;
  /** File content at `ref`. */
  read(ref: string, path: string): Promise<string>;
}

export class EditedMigrationError extends Error {
  constructor(public files: string[]) {
    super(`applied migrations were changed: ${files.join(", ")}. Add a new migration instead.`);
  }
}

const DESTRUCTIVE = [
  /\bDROP\s+(TABLE|SCHEMA|COLUMN|VIEW|MATERIALIZED\s+VIEW|TYPE|SEQUENCE)\b/i,
  /\bALTER\s+COLUMN\s+\S+\s+(SET\s+DATA\s+)?TYPE\b/i,
  /\bRENAME\b/i,
  /\bTRUNCATE\b/i,
  /\bDELETE\s+FROM\b/i,
  /^\s*UPDATE\s/i,
];

/** Drizzle separates statements with `--> statement-breakpoint`. */
export function statements(sql: string): string[] {
  return sql.split(/-->\s*statement-breakpoint/).map((s) => s.trim()).filter(Boolean);
}

export const destructive = (stmt: string) => DESTRUCTIVE.some((r) => r.test(stmt.replace(/--[^\n]*/g, "")));

/** Migrations on `head` that `base` (main) does not have, in file order. */
export async function plan(repo: RepoReader, head: string, base = "main"): Promise<PublishPlan> {
  const sqlFiles = async (ref: string) => (await repo.list(ref, MIGRATIONS)).filter((f) => f.endsWith(".sql")).sort();
  const [had, has] = await Promise.all([sqlFiles(base), sqlFiles(head)]);
  const now = new Set(has);

  const changed: string[] = had.filter((f) => !now.has(f));
  await Promise.all(had.filter((f) => now.has(f)).map(async (f) => {
    const [a, b] = await Promise.all([repo.read(base, `${MIGRATIONS}/${f}`), repo.read(head, `${MIGRATIONS}/${f}`)]);
    if (a !== b) changed.push(f);
  }));
  if (changed.length) throw new EditedMigrationError(changed.sort());

  const old = new Set(had);
  const migrationSql: string[] = [];
  for (const f of has.filter((x) => !old.has(x))) {
    migrationSql.push(...statements(await repo.read(head, `${MIGRATIONS}/${f}`)));
  }
  return { migrationSql, destructive: migrationSql.filter(destructive), snapshotId: null };
}
