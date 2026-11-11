import { needCrew } from "@/app/_lib/auth";
import { crewDetail, crewProject, origin } from "@/app/_lib/crew";
import { HttpError, accepted, route } from "@/app/_lib/http";
import { head } from "@/app/_lib/repo";
import { startRun } from "@/app/_lib/runs";
import { SPEC_BRANCH, findProject, livePreviews, nextPreviewBranch } from "@/app/_lib/store";

export const dynamic = "force-dynamic";

export const POST = route<{ project: string }>(async (req, { project }) => {
  const u = await needCrew(req);
  const p = await findProject(u, project);
  const base = origin(req);
  if (!p.repo || !(await head(p.repo, SPEC_BRANCH))) throw new HttpError(409, "The spec is not written yet", "no_spec", `${base}/p/${p.id}/spec`);
  const [cur] = await livePreviews(p.id);
  const branch = cur?.branch ?? (await nextPreviewBranch(p.id));
  try {
    const run = await startRun({ project: p, user: u, mode: "build", branch, base: cur ? branch : SPEC_BRANCH });
    const d = await crewDetail(base, u, p);
    return accepted({ project: crewProject(d), run: d.lastRun ?? { id: run.id, mode: run.mode, status: "running", startedAt: run.startedAt, endedAt: null } });
  } catch (e) {
    if (e instanceof HttpError && e.url?.startsWith("/")) e.url = base + e.url;
    throw e;
  }
});
