// Checks a DESIGN.md with Google's linter (@google/design.md) and pulls out what previews need.
// Pure and server-safe; the Look tab, the Design panel and the admin page all call it.
import { lint } from "@google/design.md/linter";
import type { DesignCheck, DesignFinding } from "../contracts";

type Token = Record<string, unknown>;

// The linter returns Maps; accept plain objects too.
const obj = (v: unknown): Token => (v instanceof Map ? Object.fromEntries(v) : ((v ?? {}) as Token));

// Orphaned-token warnings fire for every palette colour no component names; app-wide palettes are meant to be used by screens, so they are noise here.
const QUIET = new Set(["orphaned-tokens"]);

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : null);

function color(v: unknown): string | null {
  if (typeof v === "string") return v;
  const o = v as { hex?: string; value?: string; original?: string } | null;
  return o?.original ?? o?.hex ?? o?.value ?? null;
}

function family(v: unknown): string | null {
  const o = v as { fontFamily?: unknown } | null;
  return str(o?.fontFamily);
}

function dim(v: unknown): string | null {
  if (typeof v === "string" || typeof v === "number") return String(v);
  const o = v as { value?: number; unit?: string; original?: string } | null;
  return o?.original ?? (o?.value !== undefined ? `${o.value}${o.unit ?? "px"}` : null);
}

export function checkDesign(markdown: string): DesignCheck {
  let r: ReturnType<typeof lint>;
  try {
    r = lint(markdown);
  } catch (e) {
    return { ok: false, name: null, colors: {}, fonts: { heading: null, body: null }, rounded: null, findings: [{ severity: "error", message: `DESIGN.md could not be read: ${(e as Error).message}` }] };
  }
  const ds = (r.designSystem ?? {}) as { name?: unknown; colors?: unknown; typography?: unknown; rounded?: unknown };
  const colors: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj(ds.colors))) {
    const c = color(v);
    if (c) colors[k] = c;
  }
  const t = obj(ds.typography);
  const heading = family(t.h1 ?? t["headline-lg"] ?? t.display ?? Object.values(t)[0]);
  const body = family(t.body ?? t["body-md"] ?? t.text);
  const rd = obj(ds.rounded);
  const findings: DesignFinding[] = (r.findings ?? [])
    .filter((f: { severity: string; rule?: string }) => (f.severity === "error" || f.severity === "warning") && !QUIET.has(f.rule ?? ""))
    .map((f: { severity: string; path?: string; message: string }) => ({ severity: f.severity as DesignFinding["severity"], ...(f.path ? { path: f.path } : {}), message: f.message }));
  return {
    ok: !findings.some((f) => f.severity === "error"),
    name: str(ds.name),
    colors,
    fonts: { heading, body },
    rounded: dim(rd.md ?? Object.values(rd)[0]),
    findings,
  };
}
