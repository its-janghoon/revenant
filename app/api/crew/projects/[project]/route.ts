import { needCrew } from "@/app/_lib/auth";
import { crewDetail, origin } from "@/app/_lib/crew";
import { route } from "@/app/_lib/http";
import { findProject } from "@/app/_lib/store";

export const dynamic = "force-dynamic";

export const GET = route<{ project: string }>(async (req, { project }) => {
  const u = await needCrew(req);
  return crewDetail(origin(req), u, await findProject(u, project));
});
