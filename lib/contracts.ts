// Shared contracts for every lane. Entities, request bodies, the runner log-line format
// and the HTTP routes. Only lane W0 edits this file; other lanes import from it.
import { z } from "zod";

// ---------- entities (rows of Revenant's own tables, see lib/db/schema.ts) ----------

export type ProjectStatus = "spec" | "building" | "preview" | "live" | "dead" | "repairing" | "stopped" | "deleted";
export type RunMode = "spec" | "build" | "change" | "repair";
export type RunStatus = "queued" | "running" | "succeeded" | "failed" | "stopped" | "timeout";
export type KiroPayer = "company" | "own";
export type KiroMode = "company" | "own" | "both";
export type TaskState = "todo" | "running" | "done" | "failed";
export type DeployStatus = "pending" | "waiting_approval" | "running" | "live" | "failed";
export type RepairOutcome = "running" | "recovered" | "gave_up";
export type CheckStatus = "pending" | "passed" | "failed";

export interface Project {
  id: string;
  owner: string; // Cognito sub
  name: string; // kebab-case app name, used in rv-<app>-<env>
  request: string;
  repo: string | null; // CodeCommit repository name
  amplifyAppId: string | null;
  prodUrl: string | null;
  status: ProjectStatus;
  createdAt: string; // ISO 8601
  expiresAt: string | null; // judge projects on the demo install
}

export interface Run {
  id: string;
  projectId: string;
  mode: RunMode;
  model: string; // "auto" unless the admin picked another
  kiroPayer: KiroPayer;
  commit: string | null; // last commit the run pushed
  codebuildId: string | null;
  status: RunStatus;
  credits: number | null; // Kiro credits used
  startedAt: string;
  endedAt: string | null;
}

export interface Task {
  id: string;
  projectId: string;
  number: string; // "3" or "3.1", from tasks.md, also in the commit message
  title: string;
  state: TaskState;
}

export interface Deploy {
  id: string;
  projectId: string;
  branch: string; // "main" or "preview/<n>"
  commit: string;
  status: DeployStatus;
  url: string | null;
  createdAt: string;
}

export interface Repair {
  id: string;
  deployId: string | null; // one of deployId or runId is set
  runId: string | null;
  attempt: number; // 1..MAX_REPAIR_ATTEMPTS
  cause: string | null; // one plain sentence from the agent
  branch: string; // revenant/fix-<n>
  checkStatus: CheckStatus;
  outcome: RepairOutcome;
  recoveredS: number | null; // time to recover, seconds
  createdAt: string;
}

export interface Preview {
  id: string;
  projectId: string;
  branch: string; // preview/<n>
  dbName: string | null; // <app>_pv<n>, only when SQL is allowed
  createdAt: string;
  deletedAt: string | null;
}

export interface Cost {
  projectId: string;
  day: string; // YYYY-MM-DD
  usageUsd: number;
  creditUsd: number;
}

export interface Settings {
  sqlAllowed: boolean; // install-wide default, per-user override in user_policies
  model: string; // "auto" by default
  kiroMode: KiroMode;
  budgetUsd: number;
  creditsPerBuild: number; // Kiro credit limit per run
  autoDeleteHours: number | null; // null = off; 24 on the demo install
}

export const DEFAULT_SETTINGS: Settings = {
  sqlAllowed: false,
  model: "auto",
  kiroMode: "company",
  budgetUsd: 100,
  creditsPerBuild: 50,
  autoDeleteHours: null,
};

export const MAX_REPAIR_ATTEMPTS = 3;
export const PREVIEW_MAX_AGE_DAYS = 7;

// ---------- timeline (Amplify Data model `Event`, append-only, realtime) ----------

export const TIMELINE_KINDS = [
  "task_started", "task_done", "file_changed", "message", "run_done",
  "deploy_started", "deploy_failed", "deploy_live", "approval_needed",
  "repair_started", "repair_done", "preview_created", "preview_deleted", "published",
  "error", "credits",
] as const;
export type TimelineKind = (typeof TIMELINE_KINDS)[number];

export interface TimelineEvent {
  projectId: string;
  at: string; // ISO 8601 with milliseconds; sort key
  kind: TimelineKind;
  text: string; // one line; for structured kinds a JSON body of the runner line
}

// ---------- runner log lines ----------
// The runner prints one line per event to stdout. CodeBuild sends it to CloudWatch,
// a log subscription parses lines that start with RUNNER_PREFIX and writes timeline events.
// Format: `rv: {"v":1,"t":"task_done","project":"...","run":"...","build":"...","at":"...", ...}`

// `run` is RUN_ID (Revenant passes runs.id) or, without it, the CodeBuild build id. `build` is the
// CodeBuild build id (runs.codebuild_id), null outside CodeBuild. `at` is strictly increasing
// within a run, so (project, at) is unique. Strings are cut to 4000 characters.
// The runner (runner/log.ts) cannot import zod; it builds these objects typed as RunnerLine.

export const RUNNER_PREFIX = "rv: ";

const lineBase = {
  v: z.literal(1),
  project: z.string().min(1),
  run: z.string().min(1),
  build: z.string().nullable(),
  at: z.string().datetime(),
};
const taskNumber = z.string().regex(/^\d+(\.\d+)*$/); // "3" or "3.1", as in tasks.md
const finding = { rule: z.string().optional(), resource: z.string().optional() };

export const ERROR_STEPS = [
  "input", "secret", "prompt", "clone", "seed", "commit", "kiro", "spec", "check", "install", "lint",
  "synth", "cfnlint", "guard", "push", "limit", "stopped", "runner",
] as const;

export const runnerLine = z.discriminatedUnion("t", [
  z.object({ ...lineBase, t: z.literal("task_started"), task: taskNumber, title: z.string() }),
  z.object({ ...lineBase, t: z.literal("task_done"), task: taskNumber, title: z.string(), commit: z.string() }),
  z.object({ ...lineBase, t: z.literal("file_changed"), path: z.string(), change: z.enum(["add", "modify", "delete"]) }),
  z.object({
    ...lineBase,
    t: z.literal("message"),
    from: z.enum(["agent", "runner", "guard"]),
    text: z.string(),
    cause: z.string().optional(), // repair runs: the agent's one-sentence cause
    ...finding, // guard warnings
  }),
  z.object({ ...lineBase, t: z.literal("error"), step: z.enum(ERROR_STEPS), text: z.string(), ...finding }),
  z.object({
    ...lineBase,
    t: z.literal("credits"),
    used: z.number().nonnegative(), // session total so far
    limit: z.number().positive().nullable(),
    payer: z.enum(["company", "own"]),
    model: z.string(),
  }),
  // Last line of every run. code: 0 pushed, 1 a step failed, 2 bad input,
  // 3 time or credits limit (status "timeout"; never start a repair for it), 143 stopped.
  z.object({
    ...lineBase,
    t: z.literal("run_done"),
    status: z.enum(["succeeded", "failed", "stopped", "timeout"]),
    code: z.number().int(),
    credits: z.number().nonnegative(),
    commit: z.string().nullable(),
    branch: z.string().nullable(), // BRANCH on success, rv/run-<run> when work was saved, else null
    seconds: z.number().nonnegative(),
  }),
]);
export type RunnerLine = z.infer<typeof runnerLine>;

export function formatLine(line: RunnerLine): string {
  return RUNNER_PREFIX + JSON.stringify(line);
}

/** Returns null for lines that are not runner lines or do not match the schema. */
export function parseLine(raw: string): RunnerLine | null {
  const i = raw.indexOf(RUNNER_PREFIX);
  if (i < 0) return null;
  try {
    const r = runnerLine.safeParse(JSON.parse(raw.slice(i + RUNNER_PREFIX.length).trim()));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export function lineToEvent(line: RunnerLine): TimelineEvent {
  return { projectId: line.project, at: line.at, kind: line.t, text: JSON.stringify(line) };
}

// ---------- HTTP routes ----------
// Typed path patterns. `owner` is the lane whose lib/ holds the logic; route handlers under
// app/api are written by L5 (screens) unless the folder belongs to another lane
// (app/api/cost -> L6, app/admin -> L9). Machine callers (runner, Crew app) send the app key
// in the `x-rv-key` header; people use the Cognito session.

export const ROUTES = {
  health: { path: "/api/health", methods: ["GET"], owner: "W0" },
  me: { path: "/api/me", methods: ["GET", "POST"], owner: "L5" }, // POST marks onboarding done
  uploads: { path: "/api/uploads", methods: ["POST"], owner: "L5" }, // attachments before a run

  projects: { path: "/api/projects", methods: ["GET", "POST"], owner: "L5" },
  project: { path: "/api/projects/:id", methods: ["GET", "DELETE"], owner: "L5" },
  spec: { path: "/api/projects/:id/spec", methods: ["GET", "PUT"], owner: "L1" },
  build: { path: "/api/projects/:id/build", methods: ["POST"], owner: "L1" },
  change: { path: "/api/projects/:id/change", methods: ["POST"], owner: "L1" },
  runs: { path: "/api/projects/:id/runs", methods: ["GET"], owner: "L1" },
  run: { path: "/api/runs/:id", methods: ["GET"], owner: "L1" },
  stopRun: { path: "/api/runs/:id/stop", methods: ["POST"], owner: "L1" },
  runReport: { path: "/api/runs/:id/report", methods: ["POST"], owner: "L1" },
  tasks: { path: "/api/projects/:id/tasks", methods: ["GET"], owner: "L1" },
  files: { path: "/api/projects/:id/files", methods: ["GET"], owner: "L5" }, // ?branch=&path=
  commit: { path: "/api/projects/:id/commit", methods: ["POST"], owner: "L5" },
  timeline: { path: "/api/projects/:id/timeline", methods: ["GET"], owner: "L5" },

  deploys: { path: "/api/projects/:id/deploys", methods: ["GET"], owner: "L2" },
  approve: { path: "/api/deploys/:id/approve", methods: ["POST"], owner: "L2" },
  previews: { path: "/api/projects/:id/previews", methods: ["GET"], owner: "L2" },
  publish: { path: "/api/projects/:id/publish", methods: ["GET", "POST"], owner: "L2" }, // GET = migration diff
  domain: { path: "/api/projects/:id/domain", methods: ["GET", "PUT"], owner: "L2" },

  data: { path: "/api/projects/:id/data", methods: ["GET"], owner: "L3" },
  dump: { path: "/api/projects/:id/dump", methods: ["POST"], owner: "L3" },

  repairs: { path: "/api/projects/:id/repairs", methods: ["GET"], owner: "L4" },

  cost: { path: "/api/cost", methods: ["GET"], owner: "L6" },
  projectCost: { path: "/api/cost/:id", methods: ["GET"], owner: "L6" },
  costDaily: { path: "/api/cost/daily", methods: ["POST"], owner: "L6" }, // app key; ?job=all|cost|cleanup

  settings: { path: "/api/settings", methods: ["GET"], owner: "L5" },
  kiroKey: { path: "/api/settings/kiro", methods: ["PUT", "DELETE"], owner: "L5" },
  crewTokens: { path: "/api/settings/crew", methods: ["GET", "POST", "DELETE"], owner: "L5" },

  // Kiro Crew app (crew-app/), called with a crew token
  crewProjects: { path: "/api/crew/projects", methods: ["GET", "POST"], owner: "L7" },
  crewProject: { path: "/api/crew/projects/:project", methods: ["GET"], owner: "L7" },
  crewBuild: { path: "/api/crew/projects/:project/build", methods: ["POST"], owner: "L7" },
  crewPublish: { path: "/api/crew/projects/:project/publish", methods: ["POST"], owner: "L7" },
  crewEvents: { path: "/api/crew/events", methods: ["GET"], owner: "L7" }, // ?since=

  adminSettings: { path: "/admin/api/settings", methods: ["GET", "PUT"], owner: "L9" },
  adminUsers: { path: "/admin/api/users", methods: ["GET", "POST"], owner: "L9" },
  adminUser: { path: "/admin/api/users/:id", methods: ["PATCH", "DELETE"], owner: "L9" },
  adminApps: { path: "/admin/api/apps", methods: ["GET"], owner: "L9" },
  adminApp: { path: "/admin/api/apps/:id", methods: ["DELETE"], owner: "L9" },
  adminAudit: { path: "/admin/api/audit", methods: ["GET"], owner: "L9" },
} as const;

export type RouteName = keyof typeof ROUTES;
type Params<P extends string> = P extends `${string}:${infer K}/${infer R}`
  ? { [k in K]: string } & Params<`/${R}`>
  : P extends `${string}:${infer K}`
    ? { [k in K]: string }
    : Record<never, never>;

/** href("project", { id }) -> "/api/projects/<id>" */
export function href<N extends RouteName>(name: N, params: Params<(typeof ROUTES)[N]["path"]>): string {
  return ROUTES[name].path.replace(/:(\w+)/g, (_, k: string) => encodeURIComponent((params as Record<string, string>)[k] ?? ""));
}

// ---------- request bodies (validate with .parse at the route boundary) ----------

export const appName = z.string().regex(/^[a-z][a-z0-9-]{1,30}$/);

export const createProjectBody = z.object({
  request: z.string().min(3).max(4000),
  name: appName.optional(),
  attachments: z.array(z.object({ key: z.string(), name: z.string(), type: z.string() })).max(10).default([]),
  example: z.enum(["fineprint"]).optional(),
});
export const specBody = z.object({ file: z.enum(["requirements", "design", "tasks"]), markdown: z.string() });
export const changeBody = z.object({ text: z.string().min(1).max(4000), select: z.object({ file: z.string(), line: z.number().int() }).optional() });
export const commitBody = z.object({
  branch: z.string(),
  message: z.string().min(1),
  parent: z.string(),
  files: z.array(z.object({ path: z.string(), content: z.string().nullable() })).min(1), // null deletes
});
export const runReportBody = z.object({ status: z.enum(["succeeded", "failed", "stopped", "timeout"]), credits: z.number().nonnegative(), commit: z.string().nullable() });
export const approveBody = z.object({ approve: z.boolean() });
export const domainBody = z.object({ domain: z.string().min(3) });
export const kiroKeyBody = z.object({ key: z.string().min(10) });
export const settingsBody = z.object({
  sqlAllowed: z.boolean(),
  model: z.string().min(1),
  kiroMode: z.enum(["company", "own", "both"]),
  budgetUsd: z.number().positive(),
  creditsPerBuild: z.number().positive(),
  autoDeleteHours: z.number().int().positive().nullable(),
}).partial();
export const inviteBody = z.object({ email: z.string().email(), admin: z.boolean().default(false) });
export const userPatchBody = z.object({ disabled: z.boolean().optional(), sqlAllowed: z.boolean().nullable().optional() });

// ---------- responses ----------

export interface ApiError { error: string }
export interface CostSummary { creditsLeftUsd: number | null; monthUsd: number; forecastUsd: number | null; budgetUsd: number; overBudget: boolean }
export interface PublishPlan { migrationSql: string[]; destructive: string[]; snapshotId: string | null }
