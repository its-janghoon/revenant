import { needUser } from "@/app/_lib/auth";
import { route } from "@/app/_lib/http";
import { deleteProject, detail } from "@/app/_lib/project";
import { findProject } from "@/app/_lib/store";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (_req, { id }) => {
  const u = await needUser();
  return detail(u, await findProject(u, id));
});

export const DELETE = route<{ id: string }>(async (_req, { id }) => {
  const u = await needUser();
  await deleteProject(await findProject(u, id));
  return { ok: true };
});
