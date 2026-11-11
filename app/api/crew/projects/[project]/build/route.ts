import { needCrew } from "@/app/_lib/auth";
import { crewDetail, crewProject, origin } from "@/app/_lib/crew";
import { HttpError, accepted, route } from "@/app/_lib/http";
import { head } from "@/app/_lib/repo";
import { assertIdle, resume, startRun } from "@/app/_lib/runs";
import { SPEC_BRANCH, findProject, livePreviews, toProject } from "@/app/_lib/store";
import { nextPreview } from "@/lib/deploy";

export const dynamic = "force-dynamic";

export const POST = route<{ project: string }>(async (req, { project }) => {
  const u = await needCrew(req);
  const p = await findProject(u, project);
  const base = origin(req);
  if (!p.repo || !(await head(p.repo, SPEC_BRANCH))) throw new HttpError(409, "The spec is not written yet", "no_spec", `${base}/p/${p.id}/spec`);
  await assertIdle(p.id);
  const [cur] = await livePreviews(p.id);
  const branch = cur?.branch ?? (await nextPreview(toProject(p))).branch;
  // A preview whose first build failed has no git branch yet: continue the last saved work.
  const live = cur && (await head(p.repo, cur.branch));
  const back = live ? null : await resume(p);
  const from = live ? branch : back?.base ?? SPEC_BRANCH;
  try {
    const run = await startRun({ project: p, user: u, mode: "build", branch, base: from, prompt: back?.why || undefined });
    const d = await crewDetail(base, u, p);
    return accepted({ project: crewProject(d), run: d.lastRun ?? { id: run.id, mode: run.mode, status: "running", startedAt: run.startedAt, endedAt: null } });
  } catch (e) {
    if (e instanceof HttpError && e.url?.startsWith("/")) e.url = base + e.url;
    throw e;
  }
});
