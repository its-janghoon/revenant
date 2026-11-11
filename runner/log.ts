// Runner log lines in the format of lib/contracts.ts (RUNNER_PREFIX + RunnerLine as JSON).
// CodeBuild sends stdout to CloudWatch; the timeline function parses the lines with parseLine.
// The runner image has no node_modules, so this file imports only types from the contract
// and repeats the prefix; the type annotation fails the typecheck if the two ever differ.

import type { RUNNER_PREFIX as ContractPrefix, RunnerLine } from '../lib/contracts.ts';

export const RUNNER_PREFIX: typeof ContractPrefix = 'rv: ';

type Base = 'v' | 'project' | 'run' | 'build' | 'at';
type Body<L> = L extends unknown ? Omit<L, Base> : never;
/** One line without the fields the runner fills in itself. */
export type Event = Body<RunnerLine>;
export type ErrorStep = Extract<Event, { t: 'error' }>['step'];

const env = process.env;
const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, '-');

/** CodeBuild build id (runs.codebuild_id), null outside CodeBuild. */
export const build = env.CODEBUILD_BUILD_ID?.trim() || null;
/** RUN_ID (runs.id) or the CodeBuild build id. Exported to child processes so their lines match. */
export const run = safe(env.RUN_ID?.trim() || build?.split(':').pop() || String(Date.now()));
env.RUN_ID = run;
const project = env.RV_PROJECT_ID?.trim() || 'unknown';

const MAX_TEXT = 4000;

// (project, at) is the timeline key: two lines in the same millisecond would collide.
let last = 0;
function stamp(): string {
  last = Math.max(Date.now(), last + 1);
  return new Date(last).toISOString();
}

function clip<T extends object>(e: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(e)) {
    out[k] = typeof v === 'string' && v.length > MAX_TEXT ? `${v.slice(0, MAX_TEXT)}…` : v;
  }
  return out as T;
}

export function format(e: Event): string {
  const line = { v: 1, project, run, build, at: stamp(), ...clip(e) } as RunnerLine;
  return RUNNER_PREFIX + JSON.stringify(line);
}

export function emit(e: Event): void {
  process.stdout.write(`${format(e)}\n`);
}

/** A line from a child process (guard): give runner lines a fresh `at` so they keep the order. */
export function relay(line: string): string {
  if (!line.startsWith(RUNNER_PREFIX)) return line;
  try {
    const j = JSON.parse(line.slice(RUNNER_PREFIX.length)) as Record<string, unknown>;
    return RUNNER_PREFIX + JSON.stringify({ ...j, at: stamp() });
  } catch {
    return line;
  }
}

/** kiro.ts and git report `edit`; the contract says `modify`. */
export const change = (op: 'add' | 'edit' | 'delete') => (op === 'edit' ? 'modify' : op);
