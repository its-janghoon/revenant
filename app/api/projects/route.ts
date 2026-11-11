import { createProjectBody } from "@/lib/contracts";
import { needUser } from "@/app/_lib/auth";
import { body, created, route } from "@/app/_lib/http";
import { cards, createProject } from "@/app/_lib/project";
import { toProject } from "@/app/_lib/store";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const u = await needUser();
  return { projects: await cards(u) };
});

export const POST = route(async (req) => {
  const u = await needUser();
  const p = await createProject(u, await body(req, createProjectBody));
  return created({ project: toProject(p) });
});
