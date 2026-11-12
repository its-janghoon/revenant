"use client";
// Design tab (design/mockups/look.html option C): pick a look, tune its colors and corners,
// watch it on a mini preview, then Apply look starts a Kiro run that restyles every screen.
import { ChevronDown, ChevronRight, Loader, Lock, Upload } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";
import type { DesignCheck, Look, ProjectLook } from "@/lib/contracts";
import { CheckLine, Mini, readDrop, useLooks } from "../look/mini";
import { api } from "../api";

interface Applied { run: { id: string }; commit: string; branch: string; check: DesignCheck }

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const HEX = /^#[0-9a-f]{6}$/i;

/** Lines of the YAML frontmatter, or null when the file has none. */
function front(md: string): { lines: string[]; end: number } | null {
  const lines = md.split("\n");
  if (lines[0]?.trim() !== "---") return null;
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  return end > 0 ? { lines, end } : null;
}

/** Rewrites `  name: "#xxxxxx"` under colors: in the frontmatter. */
function setColor(md: string, name: string, hex: string): string {
  const f = front(md);
  if (!f) return md;
  const at = f.lines.findIndex((l, i) => i > 0 && i < f.end && /^colors:/.test(l));
  if (at < 0) return md;
  const re = new RegExp(`^(\\s+["']?${esc(name)}["']?:\\s*)("[^"]*"|'[^']*'|[^\\s#]+|#[0-9a-fA-F]+)`);
  for (let i = at + 1; i < f.end && /^\s+\S/.test(f.lines[i]!); i++) {
    if (re.test(f.lines[i]!)) { f.lines[i] = f.lines[i]!.replace(re, `$1"${hex}"`); return f.lines.join("\n"); }
  }
  return md;
}

/** Rewrites rounded.md (or the first rounded value) in either `rounded: { md: 8px }` or block form. */
function setRadius(md: string, px: number): string {
  const f = front(md);
  if (!f) return md;
  const at = f.lines.findIndex((l, i) => i > 0 && i < f.end && /^rounded:/.test(l));
  if (at < 0) return md;
  const v = `${px}px`;
  const line = f.lines[at]!;
  if (line.includes("{")) {
    f.lines[at] = /\bmd:/.test(line) ? line.replace(/(\bmd:\s*)[^,}\s]+/, `$1${v}`) : line.replace(/(\{\s*[\w-]+:\s*)[^,}\s]+/, `$1${v}`);
    return f.lines.join("\n");
  }
  const block: number[] = [];
  for (let i = at + 1; i < f.end && /^\s+\S/.test(f.lines[i]!); i++) block.push(i);
  const i = block.find((j) => /^\s+md:/.test(f.lines[j]!)) ?? block[0];
  if (i === undefined) return md;
  f.lines[i] = f.lines[i]!.replace(/^(\s+[\w-]+:\s*)\S+/, `$1${v}`);
  return f.lines.join("\n");
}

/** "Primary" from "on-primary" style token names. */
const title = (k: string) => k.charAt(0).toUpperCase() + k.slice(1).replace(/-/g, " ");

export function DesignPane({ projectId, app, url, onApplied }: { projectId: string; app: string; url: string | null; onApplied: () => void }) {
  const { looks, error: looksErr } = useLooks();
  const [pl, setPl] = useState<ProjectLook | null>(null);
  const [md, setMd] = useState<string | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [check, setCheck] = useState<DesignCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [edit, setEdit] = useState(false);
  const [drag, setDrag] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const dirty = useRef(false);

  useEffect(() => {
    const ac = new AbortController();
    api<ProjectLook>(`/api/projects/${projectId}/look`, { signal: ac.signal }).then(setPl, (e: Error) => { if (!ac.signal.aborted) setErr(e.message); });
    return () => ac.abort();
  }, [projectId]);

  // First working copy: the app's DESIGN.md, else the company design, else Plain.
  useEffect(() => {
    if (md !== null || !pl || !looks) return;
    const plain = looks.presets.find((p) => p.id === "plain") ?? looks.presets[0];
    if (pl.markdown) { setMd(pl.markdown); setCheck(pl.check); setFrom(pl.look); }
    else if (looks.company) { setMd(looks.company.markdown); setCheck(looks.company.check); setFrom("company"); }
    else if (plain) { setMd(plain.markdown); setCheck(plain.check); setFrom(plain.id); }
  }, [pl, looks, md]);

  // After each edit, a dry PUT checks the working copy (nothing is saved).
  useEffect(() => {
    if (md === null || !dirty.current) return;
    const ac = new AbortController();
    const t = setTimeout(() => {
      setChecking(true);
      api<{ check: DesignCheck }>(`/api/projects/${projectId}/look`, { method: "PUT", body: { markdown: md, dry: true }, signal: ac.signal })
        .then((r) => setCheck(r.check), (e: Error) => { if (!ac.signal.aborted) setErr(e.message); })
        .finally(() => { if (!ac.signal.aborted) setChecking(false); });
    }, 400);
    return () => { clearTimeout(t); ac.abort(); };
  }, [md, projectId]);

  const locked = !!pl?.locked;
  const ro = locked || saving;
  const change = (next: string, src: string | null = "own") => { dirty.current = true; setMd(next); setFrom(src); setErr(""); setDone(null); };
  const pick = (l: Look, id: string) => { dirty.current = false; setMd(l.markdown); setCheck(l.check); setFrom(id); setErr(""); setDone(null); };
  const upload = async (files: FileList | null) => {
    if (ro) return;
    const text = await readDrop(files);
    if (text?.trim()) change(text, "upload");
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); void upload(e.dataTransfer.files); };

  const errors = check?.findings.some((f) => f.severity === "error") ?? true;
  const r = parseInt(check?.rounded ?? "", 10);

  async function apply() {
    if (md === null) return;
    setSaving(true); setErr(""); setDone(null);
    try {
      const out = await api<Applied | { commit: string; branch: string; check: DesignCheck }>(`/api/projects/${projectId}/look`, { method: "PUT", body: { markdown: md, apply: true } });
      setCheck(out.check);
      setDone("run" in out ? `Kiro is restyling every screen on ${out.branch}` : `Saved DESIGN.md on ${out.branch}. The build will follow it.`);
      onApplied();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const pills: [string, string, Look][] = [
    ...(looks?.company ? [["company", "Company", looks.company] as [string, string, Look]] : []),
    ...(looks?.presets ?? []).map((p) => [p.id, p.name, p] as [string, string, Look]),
  ];
  const host = url ? url.replace(/^https?:\/\//, "").replace(/\/$/, "") : "no preview yet";

  return (
    <div className="lookstudio">
      <div className={`left${drag ? " drag" : ""}`} onDragOver={(e) => { if (!ro) { e.preventDefault(); setDrag(true); } }} onDragLeave={() => setDrag(false)} onDrop={onDrop}>
        <div className="lookbar">
          <CheckLine check={check} prefix={checking ? "checking…" : "DESIGN.md"} />
          <span className="sp" />
          <button type="button" className="btn" style={{ padding: "7px 12px" }} disabled={ro || md === null || errors || checking} onClick={() => void apply()}>
            {saving ? <Loader size={13} className="spin" aria-hidden /> : null}Apply look
          </button>
        </div>
        {locked ? <div className="warnbar" role="status"><Lock size={12} aria-hidden /> Your admin requires the company design</div> : null}
        {done ? <div className="okline" role="status">{done}</div> : null}
        {err || looksErr ? <div className="err" role="alert">{err || looksErr}</div> : null}

        <span className="label">Start from</span>
        <div className="lookpills">
          {pills.map(([id, name, l]) => (
            <button key={id} type="button" className="pill" aria-pressed={from === id} disabled={ro} onClick={() => pick(l, id)}>{name}</button>
          ))}
          <button type="button" className="pill" aria-pressed={from === "upload"} disabled={ro} onClick={() => file.current?.click()}><Upload size={11} aria-hidden /> Upload</button>
          <input ref={file} type="file" accept=".md,text/markdown,text/plain" hidden onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
        </div>
        <div className="muted" style={{ fontSize: 11.5, margin: "-6px 0 12px" }}>or drop a DESIGN.md here</div>

        {md === null ? <div className="muted"><Loader size={13} className="spin" aria-hidden /> Loading the design…</div> : (
          <>
            <span className="label">Colors</span>
            {Object.entries(check?.colors ?? {}).map(([k, v]) => (
              <label key={k} className="tok">
                {HEX.test(v) ? (
                  <input type="color" className="sq" value={v.toLowerCase()} disabled={ro} aria-label={`${title(k)} color`}
                    onChange={(e) => change(setColor(md, k, e.target.value))} />
                ) : <span className="sq" style={{ background: v }} aria-hidden />}
                <span>{title(k)}</span><span className="v">{v}</span>
              </label>
            ))}
            {check && !Object.keys(check.colors).length ? <div className="muted">No colors in this DESIGN.md.</div> : null}

            <span className="label" style={{ marginTop: 12 }}>Type</span>
            <div className="tok"><span>Headings</span><span className="v">{check?.fonts.heading ?? "not set"}</span></div>
            <div className="tok"><span>Body</span><span className="v">{check?.fonts.body ?? "not set"}</span></div>

            <span className="label" style={{ marginTop: 12 }}>Corners</span>
            <div className="tok">
              <input type="range" min={0} max={24} step={1} value={Number.isFinite(r) ? Math.min(24, r) : 8} disabled={ro || !Number.isFinite(r)}
                aria-label="Corner radius" aria-valuetext={`${r}px`} onChange={(e) => change(setRadius(md, Number(e.target.value)))} style={{ flex: 1 }} />
              <span className="v">{check?.rounded ?? "not set"}</span>
            </div>

            <button type="button" className="ghost" style={{ marginTop: 14, padding: "6px 10px" }} aria-expanded={edit} onClick={() => setEdit(!edit)}>
              {edit ? <ChevronDown size={13} aria-hidden /> : <ChevronRight size={13} aria-hidden />} Edit DESIGN.md
            </button>
            {edit ? (
              <textarea className="lookedit" style={{ marginTop: 8 }} value={md} readOnly={ro} spellCheck={false} aria-label="DESIGN.md"
                onChange={(e) => change(e.target.value)} />
            ) : null}
          </>
        )}
      </div>
      <div className="right">
        <div className="lookbrowser">
          <div className="bar"><i /><i /><i /><span className="mono muted" style={{ marginLeft: 8 }}>{host}</span></div>
          <Mini big check={check} app={app} title={`${app}, in the ${check?.name ?? "new"} look`} />
        </div>
      </div>
    </div>
  );
}
