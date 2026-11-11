// The repair loop (Requirement 7). Event driven: every EventBridge signal advances the
// project's open repair by one step, so nothing waits inside a function.
//
//   failure -> rule fix (env var, secret) -> redeploy
//           -> or repair run (runner, MODE=repair) on revenant/fix-<n>
//   repair run SUCCEEDED (build, synth, guard passed) -> merge into the failed branch (L2) -> redeploy
//   redeploy SUCCEED + health ok -> recovered, time to recover recorded
//   anything fails again -> next attempt with the new error, at most MAX_REPAIR_ATTEMPTS
//
// A run that ended on the time or credits limit (runner exit code 3) is never repaired.
// One repair at a time per project; signals for a project that is already repairing are
// ignored unless they are the outcome of the current step.
import { MAX_REPAIR_ATTEMPTS, type Project, type Repair, type TimelineEvent, type TimelineKind } from "../contracts";
import { branchKey, internalBranch, stackApp, type Signal } from "./events";
import { focus, summarize } from "./logs";
import type { Deps } from "./ports";
import { apply, detect } from "./rules";

interface Failure {
  project: Project;
  target: string; // branch that failed and receives the fix
  base: string; // where the first fix branch starts
  deployId: string | null;
  runId: string | null;
  what: string; // one line: what failed
  log: string; // gathered, redacted logs
  commit: string | null;
}

interface Open {
  project: Project;
  rows: Repair[];
  last: Repair;
  target: string;
  base: string;
  deploying: boolean; // the fix is merged or applied; waiting for the redeploy
}

export async function handle(sig: Signal, d: Deps): Promise<string> {
  switch (sig.kind) {
    case "amplify": return onAmplify(sig, d);
    case "stack": return onStack(sig, d);
    case "build": return onBuild(sig, d);
    case "health": return onHealth(sig, d);
  }
}

// ---------- signals ----------

async function onAmplify(sig: Extract<Signal, { kind: "amplify" }>, d: Deps): Promise<string> {
  if (internalBranch(sig.branch)) return "internal branch";
  const project = await d.store.projectByApp(sig.appId);
  if (!project) return "not a Revenant app";
  const open = await openRepair(project, d);
  if (sig.status === "SUCCEED") {
    if (!open?.deploying || open.target !== sig.branch) return "no repair waiting";
    const h = await d.deployer.health({ projectId: project.id, branch: sig.branch });
    if (h.ok) return recover(open, d);
    return next(open, `The redeploy finished but the health check failed:\n${focus(h.text, 40)}`, d);
  }
  const job = await d.aws.job(sig.appId, sig.branch, sig.jobId);
  if (open) {
    if (open.deploying && open.target === sig.branch) return next(open, `The redeploy failed:\n${focus(job.log)}`, d);
    return "already repairing";
  }
  return start(await deployFailure(project, sig.branch, job.commit, `The Amplify deploy of ${sig.branch} failed.`, focus(job.log), d), d);
}

async function onStack(sig: Extract<Signal, { kind: "stack" }>, d: Deps): Promise<string> {
  const s = stackApp(sig.stackName);
  if (!s) return "not a Gen 2 branch stack";
  const project = await d.store.projectByApp(s.appId);
  if (!project) return "not a Revenant app";
  const branch = (await d.aws.branches(s.appId)).find((b) => {
    const k = branchKey(b);
    return k === s.branchKey || k.startsWith(s.branchKey) || s.branchKey.startsWith(k);
  });
  if (!branch || internalBranch(branch)) return "unknown branch";
  // During an Amplify job the job's own FAILED event follows with the full log; let it lead.
  const job = await d.aws.latestJob(s.appId, branch);
  if (job && ["PENDING", "PROVISIONING", "RUNNING"].includes(job.status)) return "amplify job will report";
  if (await openRepair(project, d)) return "already repairing";
  const log = `${sig.status}: ${sig.reason}\n${await d.aws.stackErrors(sig.stackName)}`;
  return start(await deployFailure(project, branch, null, `The backend stack of ${branch} failed (${sig.status}).`, focus(log), d), d);
}

async function onBuild(sig: Extract<Signal, { kind: "build" }>, d: Deps): Promise<string> {
  const run = await d.store.runByBuild(sig.buildId);
  if (!run) return "not a Revenant run";
  const project = await d.store.project(run.projectId);
  if (!project) return "project gone";
  const build = await d.aws.build(sig.buildId);
  const env = Object.keys(sig.env).length ? sig.env : (build?.env ?? {});
  const sum = summarize(build?.log ?? []);

  if (run.mode === "repair") {
    const open = await openRepair(project, d);
    if (!open || open.last.id !== env.RV_REPAIR || open.deploying) return "stale repair run";
    if (sig.status === "SUCCEEDED") {
      // The runner pushes the fix branch only after install, lint, synth, cfn-lint and the guard pass.
      await d.store.updateRepair(open.last.id, { cause: sum.cause ?? open.last.cause, checkStatus: "passed" });
      await emit(d, open.project, "message", { repair: fixNo(open.last.branch), text: `Fix checked: build, synth and guardrails passed. ${sum.files.length} file(s) changed.`, files: sum.files });
      await d.deployer.merge({ projectId: project.id, from: open.last.branch, into: open.target });
      // A run's branch that Amplify does not build (no deploy follows): merged is recovered.
      const built = project.amplifyAppId ? (await d.aws.branches(project.amplifyAppId)).includes(open.target) : false;
      if (!built) return recover({ ...open, last: { ...open.last, cause: sum.cause ?? open.last.cause, checkStatus: "passed" }, deploying: true }, d);
      return "merged";
    }
    await d.store.updateRepair(open.last.id, { cause: sum.cause ?? open.last.cause, checkStatus: "failed" });
    if (sum.noRepair) return stop(open, `The repair run stopped (${sum.error?.text ?? "limit reached"}).`, d);
    return next(open, `The repair run failed:\n${sum.text}`, d);
  }

  if (sig.status === "SUCCEEDED") return "run ok";
  if (sum.noRepair) {
    await emit(d, project, "message", { text: `Run not repaired: ${sum.error?.text ?? "stopped"}.` });
    return "no repair for this exit";
  }
  if (await openRepair(project, d)) return "already repairing";
  const target = env.BRANCH;
  if (!target || !project.repo) return "run without branch";
  const base = await runBase(project, sig.buildId, env, target, d);
  return start({
    project, target, base, deployId: null, runId: run.id, commit: run.commit,
    what: `The ${run.mode} run on ${target} failed at ${sum.error?.step ?? "a step"}.`, log: sum.text,
  }, d);
}

async function onHealth(sig: Extract<Signal, { kind: "health" }>, d: Deps): Promise<string> {
  const project = await d.store.project(sig.projectId);
  if (!project) return "project gone";
  const text = `${sig.url} answered ${sig.status ?? "nothing"}:\n${focus(sig.text, 40)}`;
  const open = await openRepair(project, d);
  if (open) {
    if (open.deploying && open.target === sig.branch) return next(open, `The health check failed after the redeploy: ${text}`, d);
    return "already repairing";
  }
  return start(await deployFailure(project, sig.branch, null, `The health check of ${sig.branch} failed.`, text, d), d);
}

// ---------- steps ----------

async function deployFailure(project: Project, branch: string, commit: string | null, what: string, log: string, d: Deps): Promise<Failure> {
  let deploy = await d.store.deployFor(project.id, branch);
  if (!deploy) deploy = await d.store.addDeploy({ projectId: project.id, branch, commit: commit ?? "unknown", status: "failed" });
  else await d.store.setDeployStatus(deploy.id, "failed");
  return { project, target: branch, base: branch, deployId: deploy.id, runId: null, what, log, commit: commit ?? deploy.commit };
}

async function start(f: Failure, d: Deps): Promise<string> {
  const n = await d.store.fixNumber(f.project.id);
  await d.store.setProjectStatus(f.project.id, "repairing");
  return attempt(f, `revenant/fix-${n}`, 1, [], d);
}

async function next(open: Open, error: string, d: Deps): Promise<string> {
  await d.store.updateRepair(open.last.id, { outcome: "gave_up" });
  const first = open.rows[0]!;
  const f: Failure = {
    project: open.project, target: open.target, base: open.base, deployId: first.deployId, runId: first.runId,
    what: `Attempt ${open.last.attempt} did not fix it.`, log: error, commit: null,
  };
  return attempt(f, open.last.branch, open.last.attempt + 1, open.rows, d);
}

async function attempt(f: Failure, branch: string, n: number, tried: Repair[], d: Deps): Promise<string> {
  const p = f.project;
  if (n > MAX_REPAIR_ATTEMPTS) {
    const last = tried[tried.length - 1]!;
    return stop({ project: p, rows: tried, last, target: f.target, base: f.base, deploying: false }, `Stopped after ${MAX_REPAIR_ATTEMPTS} attempts.`, d);
  }
  const row = (r: Pick<Repair, "cause" | "checkStatus" | "outcome">) =>
    d.store.addRepair({ deployId: f.deployId, runId: f.runId, attempt: n, branch, ...r });

  // 1. rules: no agent, no credits. Deploy failures only; the same rule is not tried twice.
  const finding = f.deployId && p.amplifyAppId ? detect(f.log) : null;
  const rule = finding && !tried.some((t) => t.cause?.includes(` ${finding.name} `)) ? await apply(finding, p, f.target, d.aws) : null;
  if (rule) {
    const r = await row({ cause: rule.cause, checkStatus: rule.fixed ? "passed" : "failed", outcome: rule.fixed ? "running" : "gave_up" });
    await emit(d, p, "repair_started", { repair: fixNo(branch), attempt: n, by: "rule", branch, target: f.target, cause: rule.cause });
    if (!rule.fixed) return stop({ project: p, rows: [...tried, r], last: r, target: f.target, base: f.base, deploying: false }, rule.cause, d);
    await d.deployer.redeploy({ projectId: p.id, branch: f.target });
    return "rule fix applied";
  }

  // 2. the agent: a repair run on the fix branch.
  if (!p.repo) return stop(await rowOpen(p, f, tried, await row({ cause: null, checkStatus: "failed", outcome: "gave_up" })), "The project has no repository.", d);
  const r = await row({ cause: null, checkStatus: "pending", outcome: "running" });
  const last = await d.store.lastRun(p.id);
  const payer = last?.kiroPayer ?? "company";
  const model = await d.store.setting("model");
  const run = await d.store.addRun({ projectId: p.id, mode: "repair", model, kiroPayer: payer });
  const changed = f.commit && f.commit !== "unknown" ? await d.aws.changed(p.repo, f.commit).catch(() => []) : [];
  const appEnv = p.amplifyAppId ? await d.aws.appEnv(p.amplifyAppId) : {};
  const buildId = await d.aws.startRun({
    app: p.name, repo: p.repo, branch,
    base: f.base,
    runId: run.id, attempt: n, model, payer,
    prompt: prompt(f, changed, tried),
    kiroSecret: payer === "own" ? `rv/kiro/${p.owner}` : d.kiroSecretArn,
    creditsLimit: await d.store.setting("creditsPerBuild"),
    env: {
      RV_REPAIR: r.id, RV_TARGET: f.target, RV_PROJECT_ID: p.id,
      ...(p.amplifyAppId ? { RV_AMPLIFY_APP_ID: p.amplifyAppId } : {}),
    },
  });
  await d.store.setRunBuild(run.id, buildId);
  await emit(d, p, "repair_started", { repair: fixNo(branch), attempt: n, by: "agent", branch, target: f.target, what: f.what });
  return "repair run started";
}

async function rowOpen(project: Project, f: Failure, tried: Repair[], r: Repair): Promise<Open> {
  return { project, rows: [...tried, r], last: r, target: f.target, base: f.base, deploying: false };
}

async function recover(open: Open, d: Deps): Promise<string> {
  const now = (d.now ?? (() => new Date()))();
  const recoveredS = Math.max(0, Math.round((now.getTime() - Date.parse(open.rows[0]!.createdAt)) / 1000));
  await d.store.updateRepair(open.last.id, { outcome: "recovered", recoveredS });
  const deploy = await d.store.deployFor(open.project.id, open.target);
  if (deploy) await d.store.setDeployStatus(deploy.id, "live");
  await d.store.setProjectStatus(open.project.id, open.target === "main" ? "live" : "preview");
  await emit(d, open.project, "repair_done", {
    repair: fixNo(open.last.branch), outcome: "recovered", cause: open.last.cause, check: "passed",
    attempts: open.rows.length, branch: open.last.branch, target: open.target, recoveredS,
  });
  return "recovered";
}

async function stop(open: Open, why: string, d: Deps): Promise<string> {
  if (open.last.outcome !== "gave_up") await d.store.updateRepair(open.last.id, { outcome: "gave_up" });
  await d.store.setProjectStatus(open.project.id, "dead");
  await emit(d, open.project, "repair_done", {
    repair: fixNo(open.last.branch), outcome: "gave_up", why, target: open.target,
    tried: open.rows.map((r) => ({ attempt: r.attempt, cause: r.cause, check: r.checkStatus })),
  });
  return "gave up";
}

// ---------- state ----------

async function openRepair(project: Project, d: Deps): Promise<Open | null> {
  const rows = await d.store.latestRepair(project.id);
  const last = rows[rows.length - 1];
  if (!last || last.outcome !== "running") return null;
  const first = rows[0]!;
  let target: string | undefined;
  let base: string | undefined;
  if (first.deployId) base = target = (await d.store.deploy(first.deployId))?.branch;
  else if (first.runId) {
    const run = await d.store.run(first.runId);
    const env = run?.codebuildId ? (await d.aws.build(run.codebuildId))?.env : undefined;
    target = env?.BRANCH;
    if (target && run?.codebuildId) base = await runBase(project, run.codebuildId, env ?? {}, target, d);
  }
  if (!target || !base) return null;
  return { project, rows, last, target, base, deploying: last.checkStatus === "passed" };
}

/** A failed run keeps its commits on rv/run-<RUN_ID>; the fix starts there when it exists. */
async function runBase(project: Project, buildId: string, env: Record<string, string>, target: string, d: Deps): Promise<string> {
  const hold = `rv/run-${env.RUN_ID ?? buildId.split(":").pop()}`;
  if (project.repo && (await d.aws.branchExists(project.repo, hold))) return hold;
  return env.BASE_BRANCH || target;
}

const fixNo = (branch: string) => Number(branch.split("-").pop());

function prompt(f: Failure, changed: string[], tried: Repair[]): string {
  const parts = [f.what, `Branch: ${f.target}${f.commit && f.commit !== "unknown" ? `, commit ${f.commit}` : ""}.`, "", "Logs:", f.log];
  if (f.commit && f.commit !== "unknown") {
    parts.push("", `Last commit ${f.commit} changed: ${changed.length ? changed.join(", ") : "(unknown)"}.`, `Read its diff with \`git show ${f.commit}\`.`);
  }
  if (tried.length) {
    parts.push("", "Earlier attempts (do not repeat them):");
    for (const t of tried) parts.push(`- attempt ${t.attempt}: ${t.cause ?? "no cause stated"}; check ${t.checkStatus}`);
  }
  return parts.join("\n");
}

// Timeline: JSON bodies, strictly increasing `at` (the key is projectId + at).
let lastAt = 0;
async function emit(d: Deps, p: Project, kind: TimelineKind, body: Record<string, unknown>): Promise<void> {
  const t = Math.max((d.now ?? (() => new Date()))().getTime(), lastAt + 1);
  lastAt = t;
  const e: TimelineEvent = { projectId: p.id, at: new Date(t).toISOString(), kind, text: JSON.stringify(body) };
  await d.timeline.write([e]);
}
