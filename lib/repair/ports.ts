// What the repair loop needs from the rest of Revenant. loop.ts depends only on these, so it
// runs in a Lambda function (handler.ts) and in tests with fakes.
import type {
  CheckStatus, Deploy, DeployStatus, KiroPayer, Project, ProjectStatus, Repair, RepairOutcome, Run, Settings, TimelineEvent,
} from "../contracts";

/**
 * Lane L2 (lib/deploy) provides this. Merging into a branch that Amplify auto-builds
 * (main, preview/<n>) starts the redeploy; on main it is the publish path (snapshot, migrations).
 */
export interface Deployer {
  merge(i: { projectId: string; from: string; into: string }): Promise<{ commit: string }>;
  /** Starts a new Amplify job on the branch without a code change (after a rule fix). */
  redeploy(i: { projectId: string; branch: string }): Promise<void>;
  /** The health check L2 runs after a deploy. */
  health(i: { projectId: string; branch: string }): Promise<{ ok: boolean; text: string }>;
}

export interface Store {
  project(id: string): Promise<Project | null>;
  projectByApp(amplifyAppId: string): Promise<Project | null>;
  setProjectStatus(id: string, status: ProjectStatus): Promise<void>;
  run(id: string): Promise<Run | null>;
  runByBuild(codebuildId: string): Promise<Run | null>;
  lastRun(projectId: string): Promise<Run | null>;
  addRun(r: { projectId: string; mode: "repair"; model: string; kiroPayer: KiroPayer }): Promise<Run>;
  setRunBuild(id: string, codebuildId: string): Promise<void>;
  deploy(id: string): Promise<Deploy | null>;
  deployFor(projectId: string, branch: string): Promise<Deploy | null>;
  addDeploy(d: { projectId: string; branch: string; commit: string; status: DeployStatus }): Promise<Deploy>;
  setDeployStatus(id: string, status: DeployStatus): Promise<void>;
  /** Rows of the project's latest repair (one branch), attempt ascending; [] if none. */
  latestRepair(projectId: string): Promise<Repair[]>;
  /** n for the next revenant/fix-<n> of this project. */
  fixNumber(projectId: string): Promise<number>;
  addRepair(r: {
    deployId: string | null; runId: string | null; attempt: number; cause: string | null;
    branch: string; checkStatus: CheckStatus; outcome: RepairOutcome;
  }): Promise<Repair>;
  updateRepair(id: string, p: Partial<Pick<Repair, "cause" | "checkStatus" | "outcome" | "recoveredS">>): Promise<void>;
  setting<K extends keyof Settings>(key: K): Promise<Settings[K]>;
}

export interface StartRun {
  app: string;
  repo: string;
  branch: string; // revenant/fix-<n>
  base: string; // where a new fix branch starts
  runId: string;
  attempt: number;
  prompt: string;
  model: string;
  payer: KiroPayer;
  kiroSecret: string;
  creditsLimit: number;
  env: Record<string, string>; // RV_* for synth, RV_REPAIR, RV_TARGET
}

/** AWS reads and writes (aws.ts). */
export interface Aws {
  job(appId: string, branch: string, jobId: string): Promise<{ log: string; commit: string | null }>;
  latestJob(appId: string, branch: string): Promise<{ jobId: string; status: string } | null>;
  branches(appId: string): Promise<string[]>;
  stackErrors(stackName: string): Promise<string>;
  build(buildId: string): Promise<{ env: Record<string, string>; log: string[] } | null>;
  changed(repo: string, commit: string): Promise<string[]>;
  branchExists(repo: string, branch: string): Promise<boolean>;
  appEnv(appId: string): Promise<Record<string, string>>;
  branchEnv(appId: string, branch: string): Promise<Record<string, string> | null>;
  setBranchEnv(appId: string, branch: string, vars: Record<string, string>): Promise<void>;
  param(name: string): Promise<string | null>;
  putParam(name: string, value: string): Promise<void>;
  startRun(i: StartRun): Promise<string>; // CodeBuild build id
}

export interface Timeline {
  write(events: TimelineEvent[]): Promise<void>;
}

export interface Deps {
  store: Store;
  aws: Aws;
  deployer: Deployer;
  timeline: Timeline;
  kiroSecretArn: string; // company Kiro key
  now?: () => Date;
}
