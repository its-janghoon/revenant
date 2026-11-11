import { z } from "zod";
import { needUser } from "@/app/_lib/auth";
import { HttpError, accepted, optionalBody, route } from "@/app/_lib/http";
import { head } from "@/app/_lib/repo";
import { assertIdle, startRun } from "@/app/_lib/runs";
import { SPEC_BRANCH, findProject, livePreviews, nextPreviewBranch, toProject } from "@/app/_lib/store";

export const dynamic = "force-dynamic";

const buildBody = z.object({ notes: z.string().max(4000).optional() });

// Build the app from its spec: continues the newest preview, or starts preview/1 from the spec branch.
export const POST = route<{ id: string }>(async (req, { id }) => {
  const u = await needUser();
  const p = await findProject(u, id);
  const b = await optionalBody(req, buildBody);
  if (!p.repo || !(await head(p.repo, SPEC_BRANCH))) throw new HttpError(409, "The spec is not written yet", "no_spec", `/p/${p.id}/spec`);
  await assertIdle(p.id);
  const [cur] = await livePreviews(p.id);
  const branch = cur?.branch ?? (await nextPreviewBranch(p));
  const run = await startRun({ project: p, user: u, mode: "build", branch, base: cur ? branch : SPEC_BRANCH, prompt: b.notes });
  return accepted({ project: { ...toProject(p), status: "building" }, run });
});
