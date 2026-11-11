// Registers the hooks the deploy flow needs from the other lanes (lib/deploy/hooks.ts):
//   application  lib/console: the app's resource group (rv-<app>)
//   sql          lib/data: Aurora clusters, preview databases, migration diff, prod snapshot
//   failed       lib/repair: a health-check event on the default bus, which the repair rules take
// Imported for its side effect by lib/deploy/index.ts, so every caller of lib/deploy gets them.
import "server-only";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import type { Project } from "../contracts";
import { appTags, ensureApplication, envOf } from "../console";
import { appEnv, ensure, isSql, ready } from "../data/cluster";
import { plan } from "../data/migrations";
import { sqlAllowed } from "../data/policy";
import { createPreview } from "../data/preview";
import { ensureSnapshot, snapshotStatus } from "../data/snapshot";
import { healthFailedEntry } from "../repair/events";
import { region } from "./aws";
import { setHooks } from "./hooks";
import { listFolder, readFile } from "./repo";

const events = new EventBridgeClient({ region });
const ref = (p: Project) => ({ id: p.id, name: p.name });

/** The SQL path starts when the owner may use SQL: both cluster stacks are created once and stay. */
async function sqlOn(p: Project): Promise<boolean> {
  if (await isSql(p.name)) return true;
  if (!(await sqlAllowed(p.owner))) return false;
  await ensureApplication(ref(p));
  await Promise.all((["prod", "dev"] as const).map((c) => ensure(p.name, c, appTags(ref(p), c))));
  return true;
}

setHooks({
  application: async (p) => (await ensureApplication(ref(p))).arn,

  sql: {
    enabled: sqlOn,
    async migrationDiff(p, branch) {
      if (!p.repo) return [];
      const repo = p.repo;
      // An edited applied migration throws EditedMigrationError; publish.plan() shows it as the block reason.
      const r = await plan({
        list: async (at, dir) => (await listFolder(repo, at, dir)).map((f) => f.split("/").pop()!),
        read: async (at, path) => {
          const s = await readFile(repo, at, path);
          if (s === null) throw new Error(`${path} not found at ${at}`);
          return s;
        },
      }, branch, "main");
      return r.migrationSql;
    },
    snapshot: (p, id) => ensureSnapshot(p.name, id),
    async snapshotReady(_p, id) {
      const s = await snapshotStatus(id);
      if (s === "failed") throw new Error(`snapshot ${id} failed`);
      return s === "available";
    },
    async previewDb(p, n) {
      const name = await createPreview(p.name, `preview/${n}`);
      if (!name) throw new Error("the app's preview database cluster is still being created; try again in a few minutes");
      return name;
    },
    async appEnv(p) {
      const [prod, dev] = await Promise.all([ready(p.name, "prod"), ready(p.name, "dev")]);
      return prod && dev ? appEnv(prod, dev) : {};
    },
  },

  async failed(deploy, reason) {
    try {
      await events.send(new PutEventsCommand({
        Entries: [healthFailedEntry({ projectId: deploy.projectId, branch: deploy.branch, url: deploy.url ?? "", status: null, text: reason.slice(0, 2000) })],
      }));
    } catch (e) {
      console.error("repair signal not sent", envOf(deploy.branch), (e as Error).name);
    }
  },
});
