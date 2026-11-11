// Types shared by the guard (runner side) and the deploy flow (server side).
// Node built-ins and relative imports only: lib/guard runs in the runner image without node_modules.

export interface Resource {
  Type: string;
  Properties?: Record<string, unknown>;
  DeletionPolicy?: string;
  UpdateReplacePolicy?: string;
  Condition?: string;
  DependsOn?: unknown;
  Metadata?: unknown;
}

export interface Template {
  Parameters?: Record<string, { Type?: string; NoEcho?: boolean | string; Default?: unknown }>;
  Resources?: Record<string, Resource>;
  Outputs?: unknown;
}

/** Templates keyed by stack: "root" or the nested stack path ("data7552DF31/Todo..."), or the cdk.out file name. */
export type Stacks = Record<string, Template>;

/** error blocks the push or the publish; approval lets it through and asks the user at publish. */
export type Level = "error" | "approval";

export interface Finding {
  rule: string;
  resource?: string;
  message: string;
  level: Level;
}

/** Input from runner/guard.ts: `tsx runner/guard.ts --cdk-out <dir> --repo <dir> [--base <ref>]`. */
export interface GuardInput {
  cdkOut: string;
  repo: string;
  base?: string;
}

export interface GuardResult {
  ok: boolean;
  findings: Finding[];
}
