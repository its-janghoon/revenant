// Runner log lines -> timeline events.
// The runner (runner/log.ts) prints `RV {"kind","at","data"}` lines that carry no project or
// run id. CloudWatch names the log stream after the CodeBuild build id, so the writer looks the
// run up by `runs.codebuild_id`, turns each line into a contracts RunnerLine and then into a
// TimelineEvent with lib/contracts lineToEvent. Lines already in the contracts format
// (`rv: {...}`, with project and run) go straight through parseLine.
import { lineToEvent, parseLine, type RunnerLine, type TimelineEvent } from "../contracts";
import { parse as parseRunner, type Line } from "../../runner/log";

export interface RunRef {
  projectId: string;
  runId: string;
  credits?: number | null; // runs.credits, used when the batch has no `credits` line
}

/** Finds the run for a CodeBuild build id or log stream name. */
export type Lookup = (codebuildId: string) => Promise<RunRef | null>;

/** CodeBuild ids look like `rv-runner:<uuid>`; log streams are `<uuid>` or `<prefix>/<uuid>`. */
export function buildUuid(idOrStream: string): string {
  return idOrStream.split("/").pop()!.split(":").pop()!;
}

const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const int = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null);
const OPS = { add: "add", edit: "modify", modify: "modify", delete: "delete" } as const;

/** One runner line -> zero, one or two contracts lines. `credits` carries the session total. */
export function convert(line: Line, ref: RunRef, credits: { used: number }): RunnerLine[] {
  const base = { v: 1 as const, project: ref.projectId, run: ref.runId, at: line.at };
  const d = line.data;
  switch (line.kind) {
    case "task_started": {
      const task = int(d.number);
      return task ? [{ ...base, t: "task_started", task, title: str(d.title) }] : [];
    }
    case "task_done": {
      const task = int(d.number);
      return task ? [{ ...base, t: "task_done", task, commit: str(d.commit) }] : [];
    }
    case "file_changed": {
      const change = OPS[str(d.op) as keyof typeof OPS];
      return change && d.path ? [{ ...base, t: "file_changed", path: str(d.path), change }] : [];
    }
    case "credits": {
      if (typeof d.used === "number" && d.used >= 0) credits.used = d.used;
      return [];
    }
    case "message": {
      const out: RunnerLine[] = [{ ...base, t: "message", text: str(d.text) }];
      if (d.status === "ok") {
        out.push({ ...base, at: later(line.at), t: "run_done", status: "succeeded", credits: credits.used, commit: d.commit ? str(d.commit) : null });
      }
      return out;
    }
    case "error": {
      const step = str(d.step);
      const status = step === "limit" ? "timeout" : step === "stopped" ? "stopped" : "failed";
      return [
        { ...base, t: "message", text: `${step || "run"} failed: ${str(d.text)}` },
        { ...base, at: later(line.at), t: "run_done", status, credits: credits.used, commit: null },
      ];
    }
  }
}

// The timeline key is (projectId, at): a second event from the same line needs its own instant.
function later(at: string): string {
  return new Date(Date.parse(at) + 1).toISOString();
}

/** Messages of one log stream -> timeline events, in order. Unknown runs write nothing. */
export async function toEvents(stream: string, messages: string[], lookup: Lookup): Promise<TimelineEvent[]> {
  const out: TimelineEvent[] = [];
  let ref: RunRef | null | undefined;
  let credits: { used: number } | undefined;
  for (const raw of messages) {
    const text = raw.trim();
    const own = parseLine(text);
    if (own) {
      out.push(lineToEvent(own));
      continue;
    }
    const line = parseRunner(text);
    if (!line) continue;
    if (ref === undefined) {
      ref = await lookup(buildUuid(stream));
      credits = { used: ref?.credits ?? 0 };
    }
    if (!ref || !credits) continue;
    for (const l of convert(line, ref, credits)) out.push(lineToEvent(l));
  }
  return out;
}

/** CloudWatch Logs subscription payload (already gunzipped and parsed). */
export interface LogsPayload {
  messageType: string;
  logStream: string;
  logEvents: { id: string; timestamp: number; message: string }[];
}

export function fromLogs(p: LogsPayload, lookup: Lookup): Promise<TimelineEvent[]> {
  if (p.messageType !== "DATA_MESSAGE") return Promise.resolve([]);
  return toEvents(p.logStream, p.logEvents.map((e) => e.message), lookup);
}
