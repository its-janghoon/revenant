// Prod snapshot before a publish migrates <app>_prod (Requirement 6.9).
// lib/deploy: const id = await snapshot(app); then merge to main. A publish without a
// finished snapshot must not go on.
import "server-only";
import {
  CreateDBClusterSnapshotCommand, DescribeDBClusterSnapshotsCommand, RDSClient, waitUntilDBClusterSnapshotAvailable,
} from "@aws-sdk/client-rds";
import { clusterName } from "./names";

let rds: RDSClient | undefined;
const client = () => (rds ??= new RDSClient({}));

const stamp = () => new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14); // yyyymmddhhmmss

/** Starts a manual snapshot of the prod cluster and returns its id. */
export async function startSnapshot(app: string, reason = "publish"): Promise<string> {
  const cluster = clusterName(app, "prod");
  const id = `${cluster}-${reason.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 12) || "publish"}-${stamp()}`;
  await client().send(new CreateDBClusterSnapshotCommand({
    DBClusterIdentifier: cluster,
    DBClusterSnapshotIdentifier: id,
    Tags: [{ Key: "revenant:app", Value: app }, { Key: "revenant:reason", Value: reason }],
  }));
  return id;
}

export async function snapshotStatus(id: string): Promise<"creating" | "available" | "failed"> {
  const r = await client().send(new DescribeDBClusterSnapshotsCommand({ DBClusterSnapshotIdentifier: id }));
  const s = r.DBClusterSnapshots?.[0]?.Status ?? "";
  return s === "available" ? "available" : s === "creating" || s === "copying" ? "creating" : "failed";
}

/** Takes the snapshot and waits until it is available (default up to 15 minutes). */
export async function snapshot(app: string, maxWaitS = 900): Promise<string> {
  const id = await startSnapshot(app);
  await waitUntilDBClusterSnapshotAvailable({ client: client(), maxWaitTime: maxWaitS }, { DBClusterSnapshotIdentifier: id });
  return id;
}
