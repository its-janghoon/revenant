import { needUser } from "@/app/_lib/auth";
import { HttpError, notFound, route } from "@/app/_lib/http";
import { readFile, readFolder } from "@/app/_lib/repo";
import { findProject, workBranch } from "@/app/_lib/store";
import type { FileBody, FileNode } from "@/app/_lib/types";

export const dynamic = "force-dynamic";

const ref = /^[A-Za-z0-9._/-]{1,200}$/;

// ?branch=&path=          a folder lists its entries, a file returns its text and the commit it was read at
// ?branch=&path=&against= also returns the file on another branch, for the chat's diff cards
export const GET = route<{ id: string }>(async (req, { id }) => {
  const u = await needUser();
  const p = await findProject(u, id);
  if (!p.repo) throw new HttpError(409, "This app has no repository yet", "no_repo");
  const q = new URL(req.url).searchParams;
  const branch = q.get("branch") || (await workBranch(p.id));
  const path = (q.get("path") ?? "").replace(/^\/+|\/+$/g, "");
  const against = q.get("against");
  if (!ref.test(branch) || (against && !ref.test(against)) || path.includes("..")) throw new HttpError(400, "Bad branch or path");

  if (path) {
    const f = await readFile(p.repo, branch, path);
    if (f) {
      const out: FileBody = { type: "file", commit: f.commit, path, content: f.content };
      if (against) out.before = (await readFile(p.repo, against, path))?.content ?? null;
      return out;
    }
  }
  const d = await readFolder(p.repo, branch, path);
  if (!d) throw notFound(path ? `No file or folder ${path} on ${branch}` : `No branch ${branch} yet`);
  const out: FileNode = { type: "folder", ...d };
  return out;
});
