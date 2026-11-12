"use client";
// Shared look pieces (design/mockups/look.html): a mini app preview drawn from a DesignCheck,
// colour swatches, the lint status line, and a hook for GET /api/looks.
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { DesignCheck, LooksView } from "@/lib/contracts";
import { api } from "../api";
import "./look.css";

/** CSS variables for .mini from a look's tokens; missing tokens fall back to Plain. */
export function miniVars(c: DesignCheck | null): CSSProperties {
  const k = c?.colors ?? {};
  const v: Record<string, string> = {};
  const set = (name: string, val: string | null | undefined) => { if (val) v[name] = val; };
  set("--m-bg", k.background ?? k.surface);
  set("--m-fg", k.ink ?? k["on-surface"] ?? k["on-background"]);
  set("--m-mut", k.muted);
  set("--m-line", k.line ?? k.outline);
  set("--m-acc", k.primary);
  set("--m-on", k["on-primary"]);
  set("--m-badge", k.surface);
  set("--m-badgefg", k.success);
  set("--m-r", c?.rounded);
  // The font may be missing on this machine: fall back to the same kind (serif or sans).
  const stack = (f: string) => `"${f}", ${/georgia|times|serif|garamond|playfair|merriweather|lora|baskerville/i.test(f) ? "Georgia, serif" : "system-ui, sans-serif"}`;
  if (c?.fonts.heading) v["--m-head"] = stack(c.fonts.heading);
  if (c?.fonts.body) v["--m-body"] = stack(c.fonts.body);
  return v as CSSProperties;
}

/** A small fake app screen in the look. `big` is the studio preview size. */
export function Mini({ check, app = "Your app", title = "Read before you sign", button = "Get started", big, style }: {
  check: DesignCheck | null; app?: string; title?: string; button?: string; big?: boolean; style?: CSSProperties;
}) {
  return (
    <div className={`mini${big ? " big" : ""}`} style={{ ...miniVars(check), ...style }} aria-hidden>
      <div className="mh"><i />{app}</div>
      <div className="mt">{title}</div>
      <div className="ms" /><div className="ms s" />
      <span className="mb">{button}</span><span className="mg">OK</span>
    </div>
  );
}

/** First three colours of a look, for compact lists. */
export function Dots({ check }: { check: DesignCheck | null }) {
  const k = check?.colors ?? {};
  const cs = [k.background ?? k.surface, k.ink, k.primary].filter(Boolean) as string[];
  return <span className="dots">{cs.map((c, i) => <i key={i} style={{ background: c }} />)}</span>;
}

/** "valid · 2 warnings" or the first error. */
export function CheckLine({ check, prefix = "DESIGN.md" }: { check: DesignCheck | null; prefix?: ReactNode }) {
  if (!check) return <span className="mono muted">{prefix} · none yet</span>;
  const errs = check.findings.filter((f) => f.severity === "error");
  const warns = check.findings.filter((f) => f.severity === "warning");
  if (errs.length) return <span className="mono" style={{ color: "var(--bad)" }} title={errs.map((f) => f.message).join("\n")}>{prefix} · {errs[0]!.message}</span>;
  return (
    <span className="mono muted" title={warns.map((f) => f.message).join("\n") || undefined}>
      {prefix} · valid{warns.length ? ` · ${warns.length} warning${warns.length > 1 ? "s" : ""}` : ""}
    </span>
  );
}

export function useLooks(): { looks: LooksView | null; error: string | null } {
  const [looks, setLooks] = useState<LooksView | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const ac = new AbortController();
    api<LooksView>("/api/looks", { signal: ac.signal }).then(setLooks, (e: Error) => { if (!ac.signal.aborted) setError(e.message); });
    return () => ac.abort();
  }, []);
  return { looks, error };
}

/** Reads a dropped or picked .md file as text. */
export function readDrop(files: FileList | null): Promise<string | null> {
  const f = files?.[0];
  return f ? f.text() : Promise.resolve(null);
}
