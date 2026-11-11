// What the deploy flow needs from other lanes, as one interface each. lib/deploy/wire.ts
// registers the real ones when lib/deploy is imported; tests can replace them with setHooks().
import type { Deploy, Project } from "../contracts";

/** L3 (lib/data): the SQL path, only for apps that got Aurora from blocks/db. */
export interface SqlHooks {
  /** True when the app has Aurora (the admin allowed SQL for its owner). */
  enabled(project: Project): Promise<boolean>;
  /** Migration SQL that publishing `branch` would apply to <app>_prod, in order. */
  migrationDiff(project: Project, branch: string): Promise<string[]>;
  /** Starts a manual snapshot of the prod database named `id` (idempotent: a second call with the same id does nothing). */
  snapshot(project: Project, id: string): Promise<void>;
  /** True once snapshot `id` is available. */
  snapshotReady(project: Project, id: string): Promise<boolean>;
  /** Creates <app>_pv<n> from <app>_dev and returns its name. Throws while the dev cluster is still being created. */
  previewDb(project: Project, n: number): Promise<string>;
  /** RV_DB_* variables for blocks/db on the Amplify app ({} until both clusters are ready). */
  appEnv(project: Project): Promise<Record<string, string>>;
}

export interface DeployHooks {
  sql?: SqlHooks;
  /** L6 (lib/cost): makes sure the app's resource group exists and returns its ARN. */
  application?(project: Project): Promise<string>;
  /** L6: per app SSR compute role ARN, when the app has one. */
  computeRole?(project: Project): Promise<string | null>;
  /**
   * L4 (lib/repair): called when a deploy fails in a way the EventBridge rules do not see
   * (health check, merge, snapshot). Amplify job failures reach repair through EventBridge.
   */
  failed?(deploy: Deploy, reason: string): Promise<void>;
}

let hooks: DeployHooks = {};

export function setHooks(h: DeployHooks): void {
  hooks = { ...hooks, ...h };
}

export const getHooks = (): DeployHooks => hooks;

export async function sqlFor(project: Project): Promise<SqlHooks | null> {
  const s = hooks.sql;
  return s && (await s.enabled(project)) ? s : null;
}
