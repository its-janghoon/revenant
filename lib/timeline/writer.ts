// Runner log lines -> timeline events.
// The runner (runner/log.ts) prints lines in the lib/contracts format (`rv: {...}` with project,
// run and build), so each line goes straight through parseLine and lineToEvent.
import { lineToEvent, parseLine, type TimelineEvent } from "../contracts";

export interface RunRef {
  projectId: string;
  runId: string;
  credits?: number | null; // runs.credits
}

/** Finds the run for a CodeBuild build id or log stream name. */
export type Lookup = (codebuildId: string) => Promise<RunRef | null>;

/** CodeBuild ids look like `rv-runner:<uuid>`; log streams are `<uuid>` or `<prefix>/<uuid>`. */
export function buildUuid(idOrStream: string): string {
  return idOrStream.split("/").pop()!.split(":").pop()!;
}

/** Messages of one log stream -> timeline events, in order. Lines that are not runner lines are skipped. */
export async function toEvents(_stream: string, messages: string[], _lookup?: Lookup): Promise<TimelineEvent[]> {
  const out: TimelineEvent[] = [];
  for (const raw of messages) {
    const line = parseLine(raw.trim());
    if (line) out.push(lineToEvent(line));
  }
  return out;
}

/** CloudWatch Logs subscription payload (already gunzipped and parsed). */
export interface LogsPayload {
  messageType: string;
  logStream: string;
  logEvents: { id: string; timestamp: number; message: string }[];
}

export function fromLogs(p: LogsPayload, lookup?: Lookup): Promise<TimelineEvent[]> {
  if (p.messageType !== "DATA_MESSAGE") return Promise.resolve([]);
  return toEvents(p.logStream, p.logEvents.map((e) => e.message), lookup);
}
