// Log gathering helpers: trim, redact, and read runner lines (runner/log.ts) of a run.
import { parse, type Line } from "../../runner/log";

const REDACT: [RegExp, string][] = [
  [/\b(AKIA|ASIA)[A-Z0-9]{16}\b/g, "<aws-key>"],
  [/\b(Bearer|token|Basic)\s+[A-Za-z0-9._~+/=-]{16,}/gi, "$1 <redacted>"],
  [/\b([A-Za-z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|API_KEY|PRIVATE_KEY)[A-Za-z0-9_]*)\s*[=:]\s*\S+/gi, "$1=<redacted>"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "<private-key>"],
  [/https:\/\/[^\s"']*X-Amz-Signature=[^\s"']*/g, "<signed-url>"],
];

export function redact(text: string): string {
  return REDACT.reduce((t, [re, to]) => t.replace(re, to), text);
}

/** Last `n` lines, redacted. ANSI colors removed. */
export function tail(text: string, n = 150): string {
  // eslint-disable-next-line no-control-regex
  const lines = text.replace(/\x1b\[[0-9;]*m/g, "").trimEnd().split("\n");
  return redact(lines.slice(-n).join("\n"));
}

/** Lines around the first error marker, then the tail: build logs put the cause before the noise. */
export function focus(text: string, n = 150): string {
  const lines = text.split("\n");
  const i = lines.findIndex((l) => /\b(error|failed|exception)\b/i.test(l) && !/0 errors?/i.test(l));
  if (i < 0 || i >= lines.length - n) return tail(text, n);
  return `${tail(lines.slice(Math.max(0, i - 10), i + 40).join("\n"), 50)}\n...\n${tail(text, n - 50)}`;
}

export interface RunSummary {
  lines: Line[];
  cause: string | null; // the agent's `Cause:` sentence (repair runs)
  files: string[];
  error: { step: string; text: string } | null; // last error line
  noRepair: boolean; // exit 3 (time or credits limit), stopped, or bad input / Kiro key: never repair
  text: string; // plain text of the run's lines for the next prompt
}

const NO_REPAIR_STEPS = new Set(["limit", "stopped", "input", "secret"]);

export function summarize(messages: string[]): RunSummary {
  const lines = messages.map((m) => parse(m.trim())).filter((l): l is Line => l !== null);
  let cause: string | null = null;
  let error: RunSummary["error"] = null;
  const files = new Set<string>();
  for (const l of lines) {
    const d = l.data;
    if (l.kind === "message" && typeof d.cause === "string") cause = d.cause;
    if (l.kind === "file_changed" && typeof d.path === "string") files.add(d.path);
    if (l.kind === "error") error = { step: String(d.step ?? ""), text: String(d.text ?? "") };
  }
  const noRepair = lines.some((l) => l.kind === "error" && NO_REPAIR_STEPS.has(String(l.data.step)));
  const text = lines
    .filter((l) => l.kind === "error" || (l.kind === "message" && l.data.from !== "agent"))
    .map((l) => (l.kind === "error" ? `error (${String(l.data.step)}): ${String(l.data.text)}` : String(l.data.text)))
    .join("\n");
  return { lines, cause, files: [...files], error, noRepair, text: tail(text, 120) };
}
