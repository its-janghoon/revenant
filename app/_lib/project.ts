// Projects: create (repo, runner role, spec run), detail for the studio, cards for home.
import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import type { Deploy, Preview, Repair, Run, Task, createProjectBody } from "@/lib/contracts";
import { db, schema } from "@/lib/db/client";
import { settleAll } from "@/lib/deploy";
import { region } from "./aws";
import type { User } from "./auth";
import { readEvent, lastAgentText } from "./events";
import { HttpError } from "./http";
import { byNumber, createRepo, head, parseTasks, readFile, specPath } from "./repo";
import { ensureRunnerRole, startRun, stopRun, syncRuns } from "./runs";
import { parseParts, summarize } from "./spec";
import {
  SPEC_BRANCH, listProjects, livePreviews, monthCosts, monthCredits, projectDeploys, projectPreviews, projectRepairs,
  projectRuns, sqlAllowedFor, toProject, workBranch, type ProjectRow,
} from "./store";
import { listEvents } from "./timeline";
import type { Detail, ProjectCard, SpecView } from "./types";

const { projects, runs, tasks } = schema;

export const FINEPRINT =
  "Build me a contract signing site where an AI flags toxic clauses before you sign. " +
  "Upload a PDF; the AI marks each clause safe, watch or toxic, with a fairer rewrite. " +
  "Send it to signers by email; they read the review before they sign. Signed PDFs are sealed so anyone can check they never changed.";

const STOP = new Set(["build", "me", "a", "an", "the", "for", "my", "with", "where", "that", "site", "app", "make", "create", "please", "and", "of", "to", "i", "want", "simple", "small"]);

export function nameFrom(request: string): string {
  const words = request.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));
  const n = words.slice(0, 2).join("-").replace(/^[^a-z]+/, "").slice(0, 24).replace(/-+$/, "");
  return n.length >= 2 ? n : "app";
}

async function freeName(base: string): Promise<string> {
  const taken = new Set((await db.select({ name: projects.name }).from(projects)).map((r) => r.name));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const n = `${base.slice(0, 27)}-${i}`;
    if (!taken.has(n)) return n;
  }
  throw new HttpError(409, "Pick another name", "name_taken");
}

export async function createProject(u: User, b: z.infer<typeof createProjectBody>): Promise<ProjectRow> {
  const request = b.example === "fineprint" && b.request.trim().length < 20 ? FINEPRINT : b.request.trim();
  const name = b.name ? b.name : await freeName(b.example === "fineprint" ? "fineprint" : nameFrom(request));
  if (b.name) {
    const [clash] = await db.select({ id: projects.id }).from(projects).where(eq(projects.name, b.name));
    if (clash) throw new HttpError(409, `The name ${b.name} is taken`, "name_taken");
  }
  const repo = `rv-${name}`;
  const [p] = await db.insert(projects).values({ owner: u.sub, name, request, repo, status: "spec" }).returning();
  if (!p) throw new Error("project insert failed");
  await createRepo(repo, { "revenant:project": p.id, "revenant:app": name, "revenant:owner": u.sub });
  await ensureRunnerRole(name, u.sub);
  await startRun({ project: p, user: u, mode: "spec", branch: SPEC_BRANCH, base: "main", prompt: request, attachments: b.attachments });
  return p;
}

export async function deleteProject(p: ProjectRow): Promise<void> {
  const open = await db.select().from(runs).where(and(eq(runs.projectId, p.id), inArray(runs.status, ["queued", "running"])));
  for (const r of open) await stopRun(r);
  // Marks the app deleted; lib/cleanup (L6) removes its Amplify app, previews and repo.
  await db.update(projects).set({ status: "deleted", expiresAt: new Date().toISOString() }).where(eq(projects.id, p.id));
}

export const previewUrl = (appId: string | null, branch: string) =>
  appId && branch !== SPEC_BRANCH ? `https://${branch.replace(/[^A-Za-z0-9-]/g, "-")}.${appId}.amplifyapp.com` : null;

/** tasks.md on the work branch is the truth; the tasks table follows it. */
export async function syncTasks(p: ProjectRow, branch: string): Promise<Task[]> {
  const have = (await db.select().from(tasks).where(eq(tasks.projectId, p.id))).sort(byNumber);
  if (!p.repo) return have;
  const f = await readFile(p.repo, branch, specPath(p.name, "tasks"));
  if (!f) return have;
  const parsed = parseTasks(f.content);
  const same = parsed.length === have.length && parsed.every((t, i) => have[i]?.number === t.number && have[i]?.title === t.title && have[i]?.state === t.state);
  if (same) return have;
  for (const t of parsed) {
    await db.insert(tasks).values({ projectId: p.id, number: t.number, title: t.title, state: t.state })
      .onConflictDoUpdate({ target: [tasks.projectId, tasks.number], set: { title: t.title, state: t.state } });
  }
  const keep = new Set(parsed.map((t) => t.number));
  for (const t of have) if (!keep.has(t.number)) await db.delete(tasks).where(eq(tasks.id, t.id));
  return (await db.select().from(tasks).where(eq(tasks.projectId, p.id))).sort(byNumber);
}

export async function detail(u: User, p: ProjectRow): Promise<Detail> {
  await syncRuns(p.id);
  await settleAll(toProject(p)).catch(() => undefined);
  const [fresh] = await db.select().from(projects).where(eq(projects.id, p.id));
  const proj = fresh ?? p;
  const branch = await workBranch(p.id);
  const [runRows, deployRows, previewRows, repairRows, taskRows, cost, credits, sqlAllowed] = await Promise.all([
    projectRuns(p.id), projectDeploys(p.id), projectPreviews(p.id), projectRepairs(p.id), syncTasks(proj, branch),
    monthCosts([p.id]), monthCredits([p.id]), sqlAllowedFor(u),
  ]);
  const live = deployRows.find((d) => d.branch === branch && d.url);
  return {
    project: toProject(proj),
    branch,
    previewUrl: live?.url ?? previewUrl(proj.amplifyAppId, branch),
    runs: runRows as Run[],
    tasks: taskRows as Task[],
    deploys: deployRows as Deploy[],
    previews: previewRows as Preview[],
    repairs: repairRows as Repair[],
    costUsd: cost.get(p.id)?.usage ?? 0,
    creditUsd: cost.get(p.id)?.credit ?? 0,
    kiroCredits: credits.get(p.id) ?? 0,
    region,
    sqlAllowed,
  };
}

export async function cards(u: User): Promise<ProjectCard[]> {
  const ps = await listProjects(u);
  const ids = ps.map((p) => p.id);
  if (!ids.length) return [];
  const [cost, credits, taskRows, prevRows, repRows] = await Promise.all([
    monthCosts(ids), monthCredits(ids),
    db.select().from(tasks).where(inArray(tasks.projectId, ids)),
    db.select().from(schema.previews).where(inArray(schema.previews.projectId, ids)),
    Promise.all(ps.filter((p) => p.status === "repairing").map(async (p) => [p.id, (await projectRepairs(p.id, 1))[0]] as const)),
  ]);
  const rep = new Map(repRows);
  return ps.map((p) => {
    const t = taskRows.filter((x) => x.projectId === p.id);
    return {
      ...toProject(p),
      costUsd: cost.get(p.id)?.usage ?? 0,
      creditUsd: cost.get(p.id)?.credit ?? 0,
      kiroCredits: credits.get(p.id) ?? 0,
      tasksDone: t.filter((x) => x.state === "done").length,
      tasksTotal: t.length,
      previews: prevRows.filter((x) => x.projectId === p.id && !x.deletedAt).length,
      repairAttempt: rep.get(p.id)?.outcome === "running" ? rep.get(p.id)!.attempt : null,
    };
  });
}

export async function specView(p: ProjectRow, withSummary = true): Promise<SpecView> {
  const branch = await workBranch(p.id);
  const read = async (f: "requirements" | "design" | "tasks") => (p.repo ? (await readFile(p.repo, branch, specPath(p.name, f)))?.content ?? null : null);
  const [requirements, design, tasksMd, commit] = await Promise.all([
    read("requirements"), read("design"), read("tasks"), p.repo ? head(p.repo, branch) : Promise.resolve(null),
  ]);
  let agent: string | null = null;
  if (withSummary) {
    const [spec] = (await projectRuns(p.id, 20)).filter((r) => r.mode === "spec" && r.status === "succeeded");
    if (spec) {
      try {
        agent = lastAgentText((await listEvents(p.id, spec.startedAt)).map(readEvent), spec.startedAt);
      } catch {
        agent = null;
      }
    }
  }
  return { branch, commit, requirements, design, tasks: tasksMd, summary: summarize(agent, requirements), ...parseParts(design) };
}

export async function previewBranches(p: ProjectRow): Promise<string[]> {
  return (await livePreviews(p.id)).map((x) => x.branch);
}
