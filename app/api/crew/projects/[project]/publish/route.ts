import type { Deploy, PublishPlan } from "@/lib/contracts";
import { href } from "@/lib/contracts";
import { appKeyHeader, needCrew } from "@/app/_lib/auth";
import { crewDetail, crewProject, origin } from "@/app/_lib/crew";
import { HttpError, accepted, route } from "@/app/_lib/http";
import { findProject, livePreviews } from "@/app/_lib/store";

export const dynamic = "force-dynamic";

// Publish from chat goes through the deploy lane's own route (machine key + the owner),
// and never approves a destructive change: that needs a person on the publish screen.
export const POST = route<{ project: string }>(async (req, { project }) => {
  const u = await needCrew(req);
  const p = await findProject(u, project);
  const base = origin(req);
  if (!(await livePreviews(p.id)).length) throw new HttpError(409, "There is no preview to publish yet", "no_preview", `${base}/p/${p.id}`);

  const url = base + href("publish", { id: p.id });
  const headers = { ...(await appKeyHeader()), "x-rv-user": u.sub, "content-type": "application/json", accept: "application/json" };
  const planRes = await fetch(url, { headers, cache: "no-store" });
  if (!planRes.ok) throw new HttpError(502, `Publish plan failed (${planRes.status})`, "plan", `${base}/p/${p.id}/publish`);
  const plan = (await planRes.json()) as PublishPlan;
  if (plan.destructive?.length) {
    throw new HttpError(409, `This publish removes data (${plan.destructive.join("; ")}). Approve it in Revenant.`, "approval_required", `${base}/p/${p.id}/publish`);
  }
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ approve: false }), cache: "no-store" });
  const out = (await res.json().catch(() => ({}))) as { deploy?: Deploy; error?: string; code?: string };
  if (res.status === 409 && out.code === "approval_required") throw new HttpError(409, out.error ?? "Needs approval", "approval_required", `${base}/p/${p.id}/publish`);
  if (!res.ok || !out.deploy) throw new HttpError(res.status >= 400 ? res.status : 502, out.error ?? "Publish failed", out.code);
  const d = out.deploy;
  return accepted({
    project: { ...crewProject(await crewDetail(base, u, p)), status: "publishing" },
    deploy: { id: d.id, branch: d.branch, url: d.url, status: d.status === "live" ? "succeeded" : d.status === "failed" ? "failed" : "running" },
  });
});
