"use client";
// Spec screen (flow.html S.spec): tabs, plain summary, AWS parts, estimated cost, Build it.
import { ArrowUp, Loader, Pencil, RotateCcw, Save, Square } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Detail, SpecView } from "@/app/_lib/types";
import { Heartbeat } from "@/lib/haunt";
import { useTheme } from "@/lib/theme";
import { api } from "./api";
import { Markdown } from "./markdown";
import { usePoll } from "./poll";
import { W, pick } from "./words";

type File = "requirements" | "design" | "tasks";

export function Spec({ initial, spec: spec0 }: { initial: Detail; spec: SpecView }) {
  const router = useRouter();
  const t = useTheme();
  const id = initial.project.id;
  const det = usePoll<Detail>(`/api/projects/${id}`, initial, (d) => (running(d) ? 3000 : 15000));
  const sp = usePoll<SpecView>(`/api/projects/${id}/spec`, spec0, () => (running(det.data) ? 5000 : 30000));
  const d = det.data;
  const s = sp.data;
  const [tab, setTab] = useState<File>("requirements");
  const [edit, setEdit] = useState<string | null>(null);
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState<"" | "build" | "save" | "ask" | "stop">("");
  const [err, setErr] = useState("");

  const run = d.runs[0];
  const writing = running(d);
  const tasks = (s.tasks ?? "").split("\n").filter((l) => /^\s*[-*]\s+\[[ xX-]\]\s+\d+\.?\s/.test(l)).length;
  const body = s[tab];
  const hasSpec = Boolean(s.requirements || s.design || s.tasks);

  async function act<T>(k: typeof busy, fn: () => Promise<T>) {
    setErr(""); setBusy(k);
    try {
      return await fn();
    } catch (e) {
      setErr((e as Error).message);
      return null;
    } finally {
      setBusy("");
    }
  }

  const build = () => act("build", async () => {
    await api(`/api/projects/${id}/build`, { body: {} });
    router.push(`/p/${id}`);
  });
  const save = () => act("save", async () => {
    await api(`/api/projects/${id}/spec`, { method: "PUT", body: { file: tab, markdown: edit ?? "" } });
    setEdit(null);
    await sp.refresh();
  });
  const send = () => act("ask", async () => {
    if (!ask.trim()) return;
    await api(`/api/projects/${id}/change`, { body: { text: ask.trim() } });
    setAsk("");
    await det.refresh();
  });
  const stop = () => run && act("stop", async () => {
    await api(`/api/runs/${run.id}/stop`, { body: {} });
    await det.refresh();
  });

  return (
    <div className="page">
      <div className="wrap" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 24 }}>
        <div>
          <div className="crumbs"><Link href="/apps">Apps</Link> / {d.project.name}</div>
          <h1 className="h" style={{ fontSize: 26, marginBottom: 14 }}><W k="plan" /></h1>
          {writing ? (
            <div className="card" style={{ marginBottom: 14 }} data-haunt-focus>
              <div className="row-f"><Loader size={14} className="spin" aria-hidden /><b><W k="writingSpec" /></b><span className="sp" />
                <button type="button" className="ghost" onClick={stop} disabled={busy !== ""}><Square size={13} aria-hidden /> Stop</button></div>
              <Heartbeat state="building" />
              <div className="muted mono">Kiro {run?.model ?? "auto"} · requirements, design and tasks · about 3 min</div>
            </div>
          ) : null}
          {!writing && !hasSpec ? (
            <div className="card" style={{ marginBottom: 14 }}>
              <b>No spec yet.</b>
              <div className="muted" style={{ margin: "6px 0 12px" }}>{run && run.status !== "succeeded" ? `The last spec run ${run.status}.` : "Kiro has not written it yet."} Say what you want below to write it again.</div>
            </div>
          ) : null}
          <div className="tabs" role="tablist">
            {(["requirements", "design", "tasks"] as const).map((f) => (
              <button key={f} type="button" role="tab" aria-selected={tab === f} onClick={() => { setTab(f); setEdit(null); }}>
                {f === "requirements" ? "Requirements" : f === "design" ? "Design" : `Tasks${tasks ? ` · ${tasks}` : ""}`}
              </button>
            ))}
          </div>
          <div className="card">
            {s.summary.length && tab === "requirements" && edit === null ? (
              <>
                <div className="label">In plain words</div>
                <ul style={{ marginLeft: 18, lineHeight: 1.9, marginBottom: 14 }}>{s.summary.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </>
            ) : null}
            <div className="row-f" style={{ marginBottom: 8 }}>
              <span className="mono muted">.kiro/specs/{d.project.name}/{tab}.md · {s.branch}</span><span className="sp" />
              {edit === null ? (
                <button type="button" className="ghost" style={{ padding: "4px 10px" }} disabled={!body || writing} onClick={() => setEdit(body ?? "")}><Pencil size={13} aria-hidden /> Edit</button>
              ) : (
                <>
                  <button type="button" className="ghost" style={{ padding: "4px 10px" }} onClick={() => setEdit(null)}><RotateCcw size={13} aria-hidden /> Discard</button>
                  <button type="button" className="btn" style={{ padding: "5px 10px" }} onClick={save} disabled={busy !== ""}>{busy === "save" ? <Loader size={13} className="spin" aria-hidden /> : <Save size={13} aria-hidden />} Save</button>
                </>
              )}
            </div>
            {edit !== null ? (
              <textarea className="mdedit" value={edit} onChange={(e) => setEdit(e.target.value)} aria-label={`${tab}.md`} spellCheck={false} />
            ) : body ? <Markdown text={body} /> : <div className="empty">{writing ? "Being written…" : "Empty"}</div>}
          </div>
          <form className="card" style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", padding: "10px 12px" }} onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <input className="input" style={{ border: 0, padding: 4 }} value={ask} onChange={(e) => setAsk(e.target.value)} placeholder={pick("askPlan", t.mode === "haunted")} aria-label="Ask for a change to the plan" disabled={writing} />
            <button type="submit" className="ghost" disabled={busy !== "" || writing || !ask.trim()}>{busy === "ask" ? <Loader size={13} className="spin" aria-hidden /> : <ArrowUp size={13} aria-hidden />} Send</button>
          </form>
          {err ? <div className="err" role="alert">{err}</div> : null}
        </div>
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="label"><W k="parts" /></div>
            {s.parts.length ? s.parts.map((p, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "4px 0" }}>
                <span>{p.part}</span><span className="mono muted" style={{ textAlign: "right" }}>{p.service !== p.part ? p.service : ""}{p.cost ? ` · ${p.cost}` : ""}</span>
              </div>
            )) : <div className="muted">{writing ? "Listed when the design is written." : "Not in design.md yet."}</div>}
            <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>SQL database: {d.sqlAllowed ? "allowed" : "off"} (admin policy)</div>
          </div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="label"><W k="estCost" /></div>
            <div className="kpi"><div className="n">{s.totalUsd ? `~${s.totalUsd} / mo` : "--"}</div><div className="t">from your AWS credits first</div></div>
          </div>
          <button type="button" className="btn wide" style={{ padding: 12 }} onClick={build} disabled={busy !== "" || writing || !s.tasks}>
            {busy === "build" ? <Loader size={15} className="spin" aria-hidden /> : null}<W k="buildIt" />
          </button>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 8, textAlign: "center" }}>
            Kiro {run?.model === "auto" || !run ? "Auto" : run.model} · {tasks ? `${tasks} tasks` : "tasks pending"}
          </div>
        </div>
      </div>
    </div>
  );
}

function running(d: Detail): boolean {
  const r = d.runs[0];
  return Boolean(r && r.mode === "spec" && (r.status === "queued" || r.status === "running"));
}
