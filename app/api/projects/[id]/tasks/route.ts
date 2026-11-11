import { needUser } from "@/app/_lib/auth";
import { route } from "@/app/_lib/http";
import { syncTasks } from "@/app/_lib/project";
import { findProject, workBranch } from "@/app/_lib/store";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (_req, { id }) => {
  const u = await needUser();
  const p = await findProject(u, id);
  return { tasks: await syncTasks(p, await workBranch(p.id)) };
});
