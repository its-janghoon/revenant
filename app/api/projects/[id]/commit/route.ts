import { commitBody } from "@/lib/contracts";
import { checkCommit, previewNumber } from "@/lib/deploy";
import { needUser } from "@/app/_lib/auth";
import { HttpError, body, route } from "@/app/_lib/http";
import { commit } from "@/app/_lib/repo";
import { findProject, toProject } from "@/app/_lib/store";
import { event, putEvents } from "@/app/_lib/timeline";

export const dynamic = "force-dynamic";

// Code tab: commit the user's edits through the CodeCommit API. Never on main: publish merges main.
// On preview/<n> the commit then goes through the runner's checks (lib/deploy/check.ts) before
// Amplify deploys it; rv/* branches never build.
export const POST = route<{ id: string }>(async (req, { id }) => {
  const u = await needUser();
  const p = await findProject(u, id);
  const b = await body(req, commitBody);
  if (!p.repo) throw new HttpError(409, "This app has no repository yet", "no_repo");
  if (b.branch === "main") throw new HttpError(400, "Commit to a preview branch; Publish updates main", "main");
  if (b.files.some((f) => f.path.includes("..") || f.path.startsWith("/"))) throw new HttpError(400, "Bad file path");
  const sha = await commit(p.repo, b.branch, b.parent, b.message, b.files, { name: u.name, email: u.email });
  await putEvents(b.files.map((f) => event(p.id, "file_changed", { from: "user", path: f.path, change: f.content === null ? "delete" : "modify", commit: sha, branch: b.branch })));
  const deploy = previewNumber(b.branch) === null ? null : await checkCommit(toProject(p), b.branch, sha);
  return { commit: sha, deploy };
});
