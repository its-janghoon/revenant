import { needUser } from "@/app/_lib/auth";
import { route } from "@/app/_lib/http";
import { syncRuns } from "@/app/_lib/runs";
import { findProject, projectRuns } from "@/app/_lib/store";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (_req, { id }) => {
  const u = await needUser();
  const p = await findProject(u, id, { read: true });
  await syncRuns(p.id);
  return { runs: await projectRuns(p.id) };
});
