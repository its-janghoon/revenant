import { needUser } from "@/app/_lib/auth";
import { route } from "@/app/_lib/http";
import { findRun } from "@/app/_lib/run";
import { syncRuns } from "@/app/_lib/runs";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (_req, { id }) => {
  const u = await needUser();
  const r = await findRun(u, id, { read: true });
  if (r.status === "queued" || r.status === "running") {
    await syncRuns(r.projectId);
    return { run: await findRun(u, id, { read: true }) };
  }
  return { run: r };
});
