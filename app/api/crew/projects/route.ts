import { z } from "zod";
import { needCrew } from "@/app/_lib/auth";
import { crewDetail, crewProject, origin } from "@/app/_lib/crew";
import { body, created, route } from "@/app/_lib/http";
import { createProject } from "@/app/_lib/project";
import { listProjects } from "@/app/_lib/store";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const u = await needCrew(req);
  const base = origin(req);
  const ps = await listProjects(u);
  return { projects: (await Promise.all(ps.map((p) => crewDetail(base, u, p)))).map(crewProject) };
});

export const POST = route(async (req) => {
  const u = await needCrew(req);
  const b = await body(req, z.object({ request: z.string().trim().min(1).max(4000) }));
  const p = await createProject(u, { request: b.request.length < 3 ? `${b.request} app` : b.request, attachments: [] });
  return created({ project: crewProject(await crewDetail(origin(req), u, p)) });
});
