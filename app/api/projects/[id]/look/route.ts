import { lookBody, type ProjectLook } from "@/lib/contracts";
import { needUser } from "@/app/_lib/auth";
import { HttpError, accepted, body, route } from "@/app/_lib/http";
import { commit, createBranch, head, readFile } from "@/app/_lib/repo";
import { assertIdle, startRun } from "@/app/_lib/runs";
import { findProject, livePreviews, toProject, workBranch } from "@/app/_lib/store";
import { event, putEvents } from "@/app/_lib/timeline";
import { nextPreview } from "@/lib/deploy";
import { getSettings } from "@/lib/policy";
import { DESIGN_PATH, checkDesign, which } from "@/lib/looks";

export const dynamic = "force-dynamic";

const RESTYLE = `Restyle every screen to follow ${DESIGN_PATH} at the repository root: use its colors, fonts, corner radius, spacing and component rules, and follow its do and don't notes. Change only styling and layout, not behaviour, data or copy. Keep text contrast readable.`;

const locked = (s: Awaited<ReturnType<typeof getSettings>>) => s.companyDesignMode === "required" && !!s.companyDesign?.trim();

// The app's DESIGN.md on its work branch (the latest preview, or rv/spec before the first build).
export const GET = route<{ id: string }>(async (_req, { id }) => {
  const u = await needUser();
  const p = await findProject(u, id, { read: true });
  const s = await getSettings();
  const branch = await workBranch(p.id);
  const f = p.repo ? await readFile(p.repo, branch, DESIGN_PATH) : null;
  const markdown = f?.content ?? null;
  const out: ProjectLook = { branch, look: which(markdown, s), markdown, check: markdown ? checkDesign(markdown) : null, locked: locked(s) };
  return out;
});

// Saves DESIGN.md (lint errors block, warnings pass). With apply, also starts a change run that restyles the app.
export const PUT = route<{ id: string }>(async (req, { id }) => {
  const u = await needUser();
  const p = await findProject(u, id);
  const b = await body(req, lookBody);
  const check = checkDesign(b.markdown);
  if (b.dry) return { check };
  if (!check.ok) throw new HttpError(400, check.findings.find((f) => f.severity === "error")?.message ?? "DESIGN.md has errors", "design_invalid");
  const s = await getSettings();
  if (locked(s) && !u.admin) throw new HttpError(403, "Your admin requires the company design for every app", "design_locked");
  if (!p.repo) throw new HttpError(409, "This app has no repository yet", "no_repo");
  const [cur] = await livePreviews(p.id);
  // Before the first build the build itself follows DESIGN.md (steering), so there is nothing to restyle yet.
  const restyle = b.apply && !(!cur && p.status === "spec");
  if (restyle) await assertIdle(p.id);
  const author = { name: u.name, email: u.email };
  const message = `look: ${check.name ?? "custom"} DESIGN.md`;
  if (!restyle) {
    const branch = await workBranch(p.id);
    const parent = await head(p.repo, branch);
    if (!parent) throw new HttpError(409, "The spec is still being written", "no_spec");
    const sha = await commit(p.repo, branch, parent, message, [{ path: DESIGN_PATH, content: b.markdown }], author);
    await putEvents([event(p.id, "file_changed", { from: "user", path: DESIGN_PATH, change: "modify", commit: sha, branch })]);
    return { commit: sha, branch, check };
  }
  // Restyle: same base as a change request, with DESIGN.md committed first on the new preview branch.
  // The runner reuses a branch that already exists, so Kiro starts from this commit.
  const base = p.status === "live" ? "main" : cur ? cur.branch : await workBranch(p.id);
  const parent = await head(p.repo, base);
  if (!parent) throw new HttpError(409, `Branch ${base} not found`, "no_base");
  const branch = (await nextPreview(toProject(p))).branch;
  await createBranch(p.repo, branch, parent);
  const sha = await commit(p.repo, branch, parent, message, [{ path: DESIGN_PATH, content: b.markdown }], author);
  await putEvents([event(p.id, "file_changed", { from: "user", path: DESIGN_PATH, change: "modify", commit: sha, branch })]);
  const run = await startRun({ project: p, user: u, mode: "change", prompt: RESTYLE, branch, base });
  await putEvents([event(p.id, "message", { from: "user", text: `Apply look: ${check.name ?? "custom DESIGN.md"}`, run: run.id })]);
  return accepted({ run, commit: sha, branch, check });
});
