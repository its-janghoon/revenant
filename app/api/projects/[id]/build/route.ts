import { z } from "zod";
import { needUser } from "@/app/_lib/auth";
import { HttpError, accepted, optionalBody, route } from "@/app/_lib/http";
import { head } from "@/app/_lib/repo";
import { assertIdle, resume, startRun } from "@/app/_lib/runs";
import { SPEC_BRANCH, findProject, livePreviews, toProject } from "@/app/_lib/store";
import { nextPreview } from "@/lib/deploy";

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
  const branch = cur?.branch ?? (await nextPreview(toProject(p))).branch;
  // A preview whose first build failed has no git branch yet: continue the last saved work
  // (with the error that stopped it), or start again from the spec.
  const live = cur && (await head(p.repo, cur.branch));
  const back = live ? null : await resume(p);
  const base = live ? branch : back?.base ?? SPEC_BRANCH;
  const prompt = [back?.why, b.notes].filter(Boolean).join("\n\n") || undefined;
  const run = await startRun({ project: p, user: u, mode: "build", branch, base, prompt });
  return accepted({ project: { ...toProject(p), status: "building" }, run });
});
