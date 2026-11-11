// Runner log lines: one JSON object per line, prefixed with "RV ".
// A CloudWatch subscription turns these lines into timeline events.

export const PREFIX = 'RV ';

export const KINDS = ['task_started', 'task_done', 'file_changed', 'message', 'error', 'credits'] as const;
export type Kind = (typeof KINDS)[number];

export type Line = { kind: Kind; at: string; data: Record<string, unknown> };

const MAX_TEXT = 4000;

function clip(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = typeof v === 'string' && v.length > MAX_TEXT ? `${v.slice(0, MAX_TEXT)}…` : v;
  }
  return out;
}

export function format(kind: Kind, data: Record<string, unknown> = {}, at = new Date()): string {
  const line: Line = { kind, at: at.toISOString(), data: clip(data) };
  return PREFIX + JSON.stringify(line);
}

export function emit(kind: Kind, data: Record<string, unknown> = {}): void {
  process.stdout.write(`${format(kind, data)}\n`);
}

export function parse(text: string): Line | null {
  if (!text.startsWith(PREFIX)) return null;
  try {
    const v: unknown = JSON.parse(text.slice(PREFIX.length));
    if (!v || typeof v !== 'object') return null;
    const { kind, at, data } = v as Record<string, unknown>;
    if (typeof kind !== 'string' || !(KINDS as readonly string[]).includes(kind)) return null;
    if (typeof at !== 'string' || Number.isNaN(Date.parse(at))) return null;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    return { kind: kind as Kind, at, data: data as Record<string, unknown> };
  } catch {
    return null;
  }
}
