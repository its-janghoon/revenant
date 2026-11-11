// Preview databases of an SQL app (Requirement 6.8): each preview/<n> branch gets
// <app>_pv<n>, a copy of <app>_dev made with CREATE DATABASE ... TEMPLATE in the app's
// dev (preview) cluster. lib/deploy calls createPreview before the branch's first build and
// stores the name in previews.db_name; cleanup calls dropPreview.
import "server-only";
import { admin, info, ready } from "./cluster";
import { dbName, ident, previewEnv } from "./names";
import { exec, lit } from "./sql";

/** Creates <app>_pv<n> from <app>_dev. Returns the database name, or null while the dev
 * cluster is still being created. Safe to call again for the same branch. */
export async function createPreview(app: string, branch: string): Promise<string | null> {
  const i = await ready(app, "dev");
  if (!i) return null;
  const t = admin(i);
  const name = dbName(app, previewEnv(branch));
  const dev = dbName(app, "dev");

  if ((await exec(t, `SELECT 1 FROM pg_database WHERE datname = ${lit(name)}`)).length) return name;

  // TEMPLATE needs the source database to have no other sessions. Data API sessions are
  // pooled and short, so close any that are left and retry (exec retries "being accessed").
  await exec(t, `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${lit(dev)} AND pid <> pg_backend_pid()`);
  await exec(t, `CREATE DATABASE ${ident(name)} TEMPLATE ${ident(dev)}`, 6);
  return name;
}

/** Drops <app>_pv<n>. Never touches dev or prod: the name must be a preview name. */
export async function dropPreview(app: string, branch: string): Promise<void> {
  const i = await info(app, "dev");
  if (!i) return;
  const name = dbName(app, previewEnv(branch));
  await exec(admin(i), `DROP DATABASE IF EXISTS ${ident(name)} WITH (FORCE)`);
}
