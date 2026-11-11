// Log gathering helpers: trim, redact, and read runner lines (lib/contracts.ts format) of a run.
// No runner/ import: runner/log.ts has side effects on process.env meant for the runner only.
import { parseLine, type RunnerLine } from "../contracts";

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
  lines: RunnerLine[];
  cause: string | null; // the agent's `Cause:` sentence (repair runs)
  files: string[];
  error: { step: string; text: string } | null; // last error line
  noRepair: boolean; // exit 3 (time or credits limit), stopped, or bad input / Kiro key: never repair
  text: string; // plain text of the run's lines for the next prompt
}

const NO_REPAIR_STEPS = new Set(["limit", "stopped", "input", "secret"]);
const NO_REPAIR_CODES = new Set([2, 3, 143]); // bad input, time or credits limit, stopped (runner/README.md)

export function summarize(messages: string[]): RunSummary {
  const lines = messages.map((m) => parseLine(m.trim())).filter((l): l is RunnerLine => l !== null);
  let cause: string | null = null;
  let error: RunSummary["error"] = null;
  let noRepair = false;
  const files = new Set<string>();
  const text: string[] = [];
  for (const l of lines) {
    if (l.t === "message") {
      if (l.cause) cause = l.cause;
      if (l.from !== "agent") text.push(l.text);
    } else if (l.t === "file_changed") {
      files.add(l.path);
    } else if (l.t === "error") {
      error = { step: l.step, text: l.text };
      if (NO_REPAIR_STEPS.has(l.step)) noRepair = true;
      text.push(`error (${l.step}): ${l.text}`);
    } else if (l.t === "run_done" && NO_REPAIR_CODES.has(l.code)) {
      noRepair = true;
    }
  }
  return { lines, cause, files: [...files], error, noRepair, text: tail(text.join("\n"), 120) };
}
