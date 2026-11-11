import { needCrew } from "@/app/_lib/auth";
import { crewDetail, crewProject, origin } from "@/app/_lib/crew";
import { HttpError, accepted, route } from "@/app/_lib/http";
import { findProject, livePreviews, toProject } from "@/app/_lib/store";
import { plan, publish } from "@/lib/deploy";

export const dynamic = "force-dynamic";

// Publish from chat through the deploy lane. It never approves a destructive change:
// that needs a person on the publish screen.
export const POST = route<{ project: string }>(async (req, { project }) => {
  const u = await needCrew(req);
  const p = await findProject(u, project);
  const base = origin(req);
  const screen = `${base}/p/${p.id}/publish`;
  if (!(await livePreviews(p.id)).length) throw new HttpError(409, "There is no preview to publish yet", "no_preview", `${base}/p/${p.id}`);
  const pr = toProject(p);
  const pl = await plan(pr);
  if (pl.blocked) throw new HttpError(409, pl.blocked, /no live preview|no preview/.test(pl.blocked) ? "no_preview" : "blocked", screen);
  if (pl.needsApproval) throw new HttpError(409, `This publish removes data (${pl.destructive.join("; ")}). Approve it in Revenant.`, "approval_required", screen);
  const r = await publish(pr, u.sub, pl.branch);
  if ("error" in r) {
    if (r.plan?.needsApproval) throw new HttpError(409, r.error, "approval_required", screen);
    throw new HttpError(r.status, r.error, r.status === 409 ? "busy" : undefined, screen);
  }
  const d = r.deploy;
  if (d.status === "waiting_approval") throw new HttpError(409, "This publish needs your approval in Revenant", "approval_required", screen);
  return accepted({
    project: { ...crewProject(await crewDetail(base, u, p)), status: "publishing" },
    deploy: { id: d.id, branch: d.branch, url: d.url, status: d.status === "live" ? "succeeded" : d.status === "failed" ? "failed" : "running" },
  });
});
