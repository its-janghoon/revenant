// Names for the SQL path of a generated app (Requirement 6.7-6.8).
// Two Aurora clusters per app, each in its own CloudFormation stack that Revenant owns:
//   rv-<app>-prod-db  holds <app>_prod
//   rv-<app>-dev-db   holds <app>_dev and every preview database <app>_pv<n> (the preview cluster)
// Postgres names use "_" where the app name has "-".
// Plain module (no server-only, no SDK) so runner code and blocks can import it too.

export type DbEnv = "prod" | "dev" | `pv${number}`;
export type Cluster = "prod" | "dev";

const APP = /^[a-z][a-z0-9-]{1,30}$/;
const DB = /^[a-z][a-z0-9_]{1,62}$/;

export function check(app: string): string {
  if (!APP.test(app)) throw new Error(`bad app name: ${app}`);
  return app;
}

/** The cluster that holds a database: prod alone, dev with all previews. */
export const clusterOf = (env: DbEnv): Cluster => (env === "prod" ? "prod" : "dev");

/** rv-<app>-<prod|dev>: cluster identifier, secret name prefix, dump project name. */
export const clusterName = (app: string, c: Cluster) => `rv-${check(app)}-${c}`;

/** CloudFormation stack that owns the cluster. Kept out of the Amplify branch stacks, so
 * deleting or replacing a branch can never take the database with it. */
export const stackName = (app: string, c: Cluster) => `${clusterName(app, c)}-db`;

/** <app>_prod, <app>_dev, <app>_pv<n>. */
export function dbName(app: string, env: DbEnv): string {
  if (!/^(prod|dev|pv[1-9][0-9]{0,5})$/.test(env)) throw new Error(`bad database env: ${env}`);
  const n = `${check(app).replace(/-/g, "_")}_${env}`;
  if (!DB.test(n)) throw new Error(`bad database name: ${n}`);
  return n;
}

/** preview/<n> or preview-<n> -> pv<n>. */
export function previewEnv(branch: string): `pv${number}` {
  const m = /^preview[-/]?([1-9][0-9]{0,5})$/.exec(branch);
  if (!m) throw new Error(`not a preview branch: ${branch}`);
  return `pv${Number(m[1])}`;
}

/** Quotes a checked database name as a Postgres identifier. */
export function ident(name: string): string {
  if (!DB.test(name)) throw new Error(`bad identifier: ${name}`);
  return `"${name}"`;
}

/** Read-only role that pg_dump signs in as, with an IAM auth token. */
export const DUMP_USER = "rv_dump";

/** Drizzle migrations folder in a generated app. */
export const MIGRATIONS = "drizzle";
