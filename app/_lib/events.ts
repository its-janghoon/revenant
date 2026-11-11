// Timeline events as the screens read them. The text is JSON in either of two shapes:
// lib/contracts.ts runner lines ({ t, ... }) or runner/log.ts lines ({ kind, data }),
// and server events ({ from, text, ... }). Plain text is a message.
import type { TimelineEvent } from "@/lib/contracts";

export interface Ev {
  at: string;
  kind: string;
  from: string | null; // user, agent, runner, guard
  text: string | null;
  path: string | null;
  op: "add" | "modify" | "delete" | null;
  task: string | null; // "3" or "3.1"
  title: string | null;
  branch: string | null;
  url: string | null;
  cause: string | null;
  status: string | null;
  select: { file: string; line: number } | null;
}

const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function readEvent(e: TimelineEvent): Ev {
  let o: Record<string, unknown> = {};
  try {
    const v: unknown = JSON.parse(e.text);
    if (v && typeof v === "object" && !Array.isArray(v)) o = v as Record<string, unknown>;
    else o = { text: e.text };
  } catch {
    o = { text: e.text };
  }
  const d = o.data && typeof o.data === "object" ? { ...o, ...(o.data as Record<string, unknown>) } : o;
  const kind = str(d.t) ?? str(d.kind) ?? e.kind;
  const change = str(d.change) ?? str(d.op);
  const sel = d.select && typeof d.select === "object" ? (d.select as Record<string, unknown>) : null;
  return {
    at: e.at,
    // error lines name the failed step; they read as runner messages
    kind: kind === "error" ? "message" : kind,
    from: str(d.from) ?? (kind === "error" ? "runner" : null),
    text: kind === "error" ? `${str(d.step) ?? "run"} failed: ${str(d.text) ?? ""}` : str(d.text),
    path: str(d.path),
    op: change === "edit" ? "modify" : change === "add" || change === "modify" || change === "delete" ? change : null,
    task: str(d.task) ?? (num(d.task) ?? num(d.number))?.toString() ?? null,
    title: str(d.title),
    branch: str(d.branch),
    url: str(d.url),
    cause: str(d.cause),
    status: str(d.status),
    select: sel && typeof sel.file === "string" && typeof sel.line === "number" ? { file: sel.file, line: sel.line } : null,
  };
}

/** The agent's last words after `since`, for the spec summary and the chat. */
export function lastAgentText(events: Ev[], since: string): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!;
    if (e.at < since) break;
    if (e.kind === "message" && (e.from === "agent" || e.from === null) && e.text) return e.text;
  }
  return null;
}
