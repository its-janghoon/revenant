// EventBridge events that drive the repair loop, parsed into one small union.
// Patterns live in construct.ts; this file only reads what those rules deliver.

export const HEALTH_SOURCE = "revenant.deploy";
export const HEALTH_FAILED = "Health Check Failed";

/** Detail of the health-check event L2 puts on the default bus when a deployed app is unhealthy. */
export interface HealthDetail {
  projectId: string;
  branch: string; // "main" or "preview/<n>"
  url: string;
  status: number | null; // HTTP status, null when the request did not complete
  text: string; // first lines of the response or the network error
}

/** PutEvents entry for L2's health check. */
export function healthFailedEntry(d: HealthDetail, bus = "default") {
  return { Source: HEALTH_SOURCE, DetailType: HEALTH_FAILED, Detail: JSON.stringify(d), EventBusName: bus };
}

export type Signal =
  | { kind: "amplify"; appId: string; branch: string; jobId: string; status: "FAILED" | "SUCCEED"; at: string }
  | { kind: "stack"; stackId: string; stackName: string; status: string; reason: string; at: string }
  | { kind: "build"; buildId: string; status: "FAILED" | "SUCCEEDED"; env: Record<string, string>; at: string }
  | ({ kind: "health"; at: string } & HealthDetail);

interface Ev {
  source?: string;
  "detail-type"?: string;
  time?: string;
  detail?: Record<string, unknown>;
}

const s = (v: unknown) => (typeof v === "string" ? v : "");

export function toSignal(e: Ev): Signal | null {
  const d = e.detail ?? {};
  const at = e.time ?? new Date().toISOString();
  switch (e.source) {
    case "aws.amplify": {
      const status = s(d.jobStatus);
      if (status !== "FAILED" && status !== "SUCCEED") return null;
      return { kind: "amplify", appId: s(d.appId), branch: s(d.branchName), jobId: s(d.jobId), status, at };
    }
    case "aws.cloudformation": {
      const stackId = s(d["stack-id"]);
      const sd = (d["status-details"] ?? {}) as Record<string, unknown>;
      const stackName = stackId.split(":stack/")[1]?.split("/")[0] ?? "";
      return { kind: "stack", stackId, stackName, status: s(sd.status), reason: s(sd["status-reason"]), at };
    }
    case "aws.codebuild": {
      const status = s(d["build-status"]);
      if (status !== "FAILED" && status !== "SUCCEEDED") return null;
      const info = (d["additional-information"] ?? {}) as { environment?: { "environment-variables"?: { name: string; value: string }[] } };
      const env: Record<string, string> = {};
      for (const v of info.environment?.["environment-variables"] ?? []) env[v.name] = v.value;
      // build-id is an ARN: arn:aws:codebuild:<region>:<account>:build/<project>:<uuid>
      const buildId = s(d["build-id"]).split(":build/").pop() ?? "";
      return { kind: "build", buildId, status, env, at };
    }
    case HEALTH_SOURCE: {
      if (e["detail-type"] !== HEALTH_FAILED) return null;
      const h = d as unknown as HealthDetail;
      if (!h.projectId || !h.branch) return null;
      return { kind: "health", at, projectId: h.projectId, branch: h.branch, url: s(h.url), status: typeof h.status === "number" ? h.status : null, text: s(h.text) };
    }
  }
  return null;
}

/** Gen 2 branch stacks are named amplify-<appId>-<branch, alphanumerics only>-branch-<hash>. */
export function stackApp(stackName: string): { appId: string; branchKey: string } | null {
  const m = /^amplify-([a-z0-9]+)-(.+?)-branch-[0-9a-f]+/i.exec(stackName);
  return m ? { appId: m[1]!, branchKey: m[2]!.toLowerCase() } : null;
}

export const branchKey = (branch: string) => branch.replace(/[^a-z0-9]/gi, "").toLowerCase();

/** Branches Revenant itself makes for runs and repairs; their builds never start a repair. */
export const internalBranch = (b: string) => b.startsWith("rv/") || b.startsWith("revenant/");
