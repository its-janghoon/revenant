import { specBody } from "@/lib/contracts";
import { needUser } from "@/app/_lib/auth";
import { HttpError, body, route } from "@/app/_lib/http";
import { specView } from "@/app/_lib/project";
import { commit, head, specPath } from "@/app/_lib/repo";
import { findProject, workBranch } from "@/app/_lib/store";
import { event, putEvents } from "@/app/_lib/timeline";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (_req, { id }) => {
  const u = await needUser();
  return specView(await findProject(u, id));
});

// Saves one spec file on the work branch. The next run reads it.
export const PUT = route<{ id: string }>(async (req, { id }) => {
  const u = await needUser();
  const p = await findProject(u, id);
  const b = await body(req, specBody);
  if (!p.repo) throw new HttpError(409, "This app has no repository yet", "no_repo");
  const branch = await workBranch(p.id);
  const parent = await head(p.repo, branch);
  if (!parent) throw new HttpError(409, "The spec is still being written", "no_spec");
  const path = specPath(p.name, b.file);
  const sha = await commit(p.repo, branch, parent, `spec: edit ${b.file}.md`, [{ path, content: b.markdown }], { name: u.name, email: u.email });
  await putEvents([event(p.id, "file_changed", { from: "user", path, change: "modify", commit: sha, branch })]);
  return { commit: sha, branch };
});
