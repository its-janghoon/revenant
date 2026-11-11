"use client";
// Code tab (flow2.js S.code): file tree, editor, commit through the CodeCommit API on the
// preview branch. Kiro reads your commits on the next request: one codebase for both.
import {
  ChevronDown, ChevronRight, File, FileCode2, Folder, FolderOpen, GitBranch, GitCommitHorizontal, Loader, RotateCcw, Terminal, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FileBody, FileNode } from "@/app/_lib/types";
import { api } from "../api";
import { highlight, langOf } from "./highlight";

interface Open { path: string; content: string; original: string; commit: string }

export interface CodeProps { projectId: string; repo: string | null; region: string; branch: string; openPath: string | null; onOpened: () => void }

const CODE = /\.(tsx?|jsx?|mjs|cjs|css|json|md|ya?ml|sh|py|sql|html|toml|txt|env\.example)$/i;

export function Code(p: CodeProps) {
  const [tree, setTree] = useState<Map<string, FileNode>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set([""]));
  const [files, setFiles] = useState<Open[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [committing, setCommitting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const base = `/api/projects/${p.projectId}/files`;

  const load = useCallback(async (path: string) => {
    const q = new URLSearchParams({ branch: p.branch, path });
    const r = await api<FileNode | FileBody>(`${base}?${q}`);
    if (r.type === "folder") setTree((m) => new Map(m).set(path, r));
    return r;
  }, [base, p.branch]);

  useEffect(() => {
    setTree(new Map()); setFiles([]); setActive(null); setExpanded(new Set([""])); setErr("");
    load("").catch((e: Error) => setErr(e.message));
  }, [load]);

  const open = useCallback(async (path: string) => {
    setErr("");
    const have = files.find((f) => f.path === path);
    if (have) { setActive(path); return; }
    try {
      const r = await load(path);
      if (r.type !== "file") return;
      setFiles((x) => [...x, { path, content: r.content, original: r.content, commit: r.commit }]);
      setActive(path);
      // show the file's folders in the tree
      const parts = path.split("/").slice(0, -1);
      const dirs = parts.map((_, i) => parts.slice(0, i + 1).join("/"));
      setExpanded((s) => new Set([...s, ...dirs]));
      for (const d of dirs) if (!tree.has(d)) await load(d).catch(() => undefined);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [files, load, tree]);

  useEffect(() => {
    if (p.openPath) { void open(p.openPath); p.onOpened(); }
  }, [p.openPath]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(dir: string) {
    const s = new Set(expanded);
    if (s.has(dir)) s.delete(dir);
    else {
      s.add(dir);
      if (!tree.has(dir)) await load(dir).catch((e: Error) => setErr(e.message));
    }
    setExpanded(s);
  }

  const cur = files.find((f) => f.path === active) ?? null;
  const dirty = files.filter((f) => f.content !== f.original);
  const setContent = (v: string) => setFiles((x) => x.map((f) => (f.path === active ? { ...f, content: v } : f)));

  async function commit() {
    if (!dirty.length) return;
    setBusy(true); setErr("");
    try {
      const parent = dirty.map((f) => f.commit).sort().pop()!;
      const message = msg.trim() || `edit ${dirty.map((f) => f.path.split("/").pop()).join(", ")}`;
      const r = await api<{ commit: string }>(`/api/projects/${p.projectId}/commit`, {
        body: { branch: p.branch, message, parent, files: dirty.map((f) => ({ path: f.path, content: f.content })) },
      });
      setFiles((x) => x.map((f) => ({ ...f, original: f.content, commit: r.commit })));
      setMsg(""); setCommitting(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function close(path: string) {
    const f = files.find((x) => x.path === path);
    if (f && f.content !== f.original && !confirm(`Discard your edits to ${path}?`)) return;
    const rest = files.filter((x) => x.path !== path);
    setFiles(rest);
    if (active === path) setActive(rest[rest.length - 1]?.path ?? null);
  }

  const Dir = ({ path, depth }: { path: string; depth: number }) => {
    const node = tree.get(path);
    if (!node) return depth ? <div className="muted" style={{ paddingLeft: 20 + depth * 14 }}>…</div> : null;
    const join = (n: string) => (path ? `${path}/${n}` : n);
    return (
      <>
        {node.folders.filter((f) => f !== ".git").map((f) => {
          const full = join(f);
          const isOpen = expanded.has(full);
          return (
            <div key={full}>
              <button type="button" style={{ paddingLeft: 6 + depth * 14 }} onClick={() => toggle(full)} aria-expanded={isOpen}>
                {isOpen ? <ChevronDown size={11} aria-hidden /> : <ChevronRight size={11} aria-hidden />}
                {isOpen ? <FolderOpen size={13} aria-hidden /> : <Folder size={13} aria-hidden />} {f}
              </button>
              {isOpen ? <Dir path={full} depth={depth + 1} /> : null}
            </div>
          );
        })}
        {node.files.map((f) => {
          const full = join(f);
          const d = files.find((x) => x.path === full);
          return (
            <button key={full} type="button" className={active === full ? "on" : ""} style={{ paddingLeft: 23 + depth * 14 }} onClick={() => open(full)} title={full}>
              {CODE.test(f) ? <FileCode2 size={12} aria-hidden /> : <File size={12} aria-hidden />} {f}{d && d.content !== d.original ? " •" : ""}
            </button>
          );
        })}
      </>
    );
  };

  return (
    <div className="code">
      <div className="tree" aria-label="Files">
        {tree.size ? <Dir path="" depth={0} /> : err ? <div className="err">{err}</div> : <div className="muted"><Loader size={12} className="spin" aria-hidden /> Loading files…</div>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}>
        <div className="tabs2" style={{ padding: "6px 12px" }}>
          {files.map((f) => (
            <span key={f.path} className={`t${f.path === active ? " on" : ""}`} style={{ paddingRight: 6 }}>
              <button type="button" style={{ all: "unset", cursor: "pointer", display: "flex", gap: 6, alignItems: "center" }} onClick={() => setActive(f.path)}>
                <FileCode2 size={13} aria-hidden /> {f.path.split("/").pop()}{f.content !== f.original ? " •" : ""}
              </button>
              <button type="button" aria-label={`Close ${f.path}`} style={{ all: "unset", cursor: "pointer", display: "flex" }} onClick={() => close(f.path)}><X size={11} aria-hidden /></button>
            </span>
          ))}
          <span className="sp" />
          {dirty.length ? <span className="mono muted">edited by you · not saved</span> : null}
          <button type="button" className="ghost" style={{ padding: "5px 10px" }} disabled={!cur || cur.content === cur.original}
            onClick={() => cur && setFiles((x) => x.map((f) => (f.path === cur.path ? { ...f, content: f.original } : f)))}>
            <RotateCcw size={13} aria-hidden /> Discard
          </button>
          {committing ? (
            <form style={{ display: "flex", gap: 6 }} onSubmit={(e) => { e.preventDefault(); void commit(); }}>
              <input className="input" style={{ padding: "5px 8px", width: 220 }} autoFocus value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="What did you change?" aria-label="Commit message" />
              <button type="submit" className="btn" style={{ padding: "6px 11px" }} disabled={busy}>{busy ? <Loader size={13} className="spin" aria-hidden /> : <GitCommitHorizontal size={14} aria-hidden />} Commit {dirty.length}</button>
            </form>
          ) : (
            <button type="button" className="btn" style={{ padding: "6px 11px" }} disabled={!dirty.length || p.branch === "main"} onClick={() => setCommitting(true)}>
              <GitCommitHorizontal size={14} aria-hidden /> Commit
            </button>
          )}
        </div>
        {cur ? <Editor key={cur.path} path={cur.path} value={cur.content} original={cur.original} onChange={setContent} onSave={() => setCommitting(true)} />
          : <div className="editor"><div className="empty">Pick a file on the left.</div></div>}
        {err && tree.size ? <div className="err" style={{ padding: "0 14px" }} role="alert">{err}</div> : null}
        <div className="foot mono muted">
          <span><GitBranch size={12} aria-hidden /> {p.branch}</span>
          <span>CodeCommit {p.repo ?? "--"}</span>
          <span className="sp" />
          {p.repo ? <span><Terminal size={12} aria-hidden /> git clone codecommit::{p.region}://{p.repo}</span> : null}
        </div>
      </div>
    </div>
  );
}

function Editor({ path, value, original, onChange, onSave }: { path: string; value: string; original: string; onChange: (v: string) => void; onSave: () => void }) {
  const lines = value.split("\n").length;
  const colored = useMemo(() => highlight(value, langOf(path)), [value, path]);
  const changed = useMemo(() => {
    const a = original.split("\n");
    return new Set(value.split("\n").map((l, i) => (l !== a[i] ? i : -1)).filter((i) => i >= 0));
  }, [value, original]);
  return (
    <div className="editor">
      <div style={{ position: "relative", display: "inline-block", minWidth: "100%", minHeight: "100%" }}>
        {changed.size ? (
          <div aria-hidden style={{ position: "absolute", left: 0, right: 0, top: 12, pointerEvents: "none" }}>
            {Array.from({ length: lines }, (_, i) => <div key={i} style={{ height: "1.75em", background: changed.has(i) ? "color-mix(in srgb, var(--ok) 12%, transparent)" : undefined }} />)}
          </div>
        ) : null}
        <div className="gut" aria-hidden>{Array.from({ length: lines }, (_, i) => i + 1).join("\n")}</div>
        <pre aria-hidden>{colored}{"\n "}</pre>
        <textarea value={value} spellCheck={false} aria-label={path} autoCapitalize="off" autoCorrect="off"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); onSave(); return; }
            if (e.key === "Tab" && !e.shiftKey) {
              e.preventDefault();
              const el = e.currentTarget;
              const { selectionStart: a, selectionEnd: b } = el;
              onChange(value.slice(0, a) + "  " + value.slice(b));
              requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = a + 2; });
            }
          }} />
      </div>
    </div>
  );
}
