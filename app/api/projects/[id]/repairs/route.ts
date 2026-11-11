import { needUser } from "@/app/_lib/auth";
import { route } from "@/app/_lib/http";
import { findProject, projectRepairs } from "@/app/_lib/store";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (_req, { id }) => {
  const u = await needUser();
  const p = await findProject(u, id);
  return { repairs: await projectRepairs(p.id) };
});
