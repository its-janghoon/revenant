import { changeBody } from "@/lib/contracts";
import { needUser } from "@/app/_lib/auth";
import { accepted, body, route } from "@/app/_lib/http";
import { startRun } from "@/app/_lib/runs";
import { SPEC_BRANCH, findProject, livePreviews, nextPreviewBranch } from "@/app/_lib/store";
import { event, putEvents } from "@/app/_lib/timeline";

export const dynamic = "force-dynamic";

// One request in plain words. Before the first build it changes the spec (spec run on rv/spec);
// after that every change gets its own preview branch (design.md, "Deploy").
export const POST = route<{ id: string }>(async (req, { id }) => {
  const u = await needUser();
  const p = await findProject(u, id);
  const b = await body(req, changeBody);
  const prompt = b.select ? `${b.text}\n\nThe user selected the element at ${b.select.file}:${b.select.line}.` : b.text;
  const [cur] = await livePreviews(p.id);
  const specOnly = !cur && p.status === "spec";
  const run = specOnly
    ? await startRun({ project: p, user: u, mode: "spec", branch: SPEC_BRANCH, base: "main", prompt })
    : await startRun({
        project: p, user: u, mode: "change", prompt,
        branch: await nextPreviewBranch(p.id),
        base: p.status === "live" ? "main" : cur ? cur.branch : SPEC_BRANCH,
      });
  await putEvents([event(p.id, "message", { from: "user", text: b.text, run: run.id, ...(b.select ? { select: b.select } : {}) })]);
  return accepted({ run });
});
