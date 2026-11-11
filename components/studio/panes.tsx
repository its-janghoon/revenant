"use client";
// Studio tabs Spec, Data and Timeline.
import { Download, ExternalLink, Loader } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { Detail, SpecView } from "@/app/_lib/types";
import type { Ev } from "@/app/_lib/events";
import { Heartbeat, type Pulse } from "@/lib/haunt";
import { Word, type CopyKey } from "@/lib/theme";
import { api, clock, dur } from "../api";
import { Markdown } from "../markdown";
import { activeRun, deployNo } from "./state";

export function SpecPane({ d }: { d: Detail }) {
  const [s, setS] = useState<SpecView | null>(null);
  const [tab, setTab] = useState<"requirements" | "design" | "tasks">("tasks");
  const [err, setErr] = useState("");
  useEffect(() => {
    api<SpecView>(`/api/projects/${d.project.id}/spec`).then(setS).catch((e: Error) => setErr(e.message));
  }, [d.project.id, d.runs[0]?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="scroll">
      <div className="tabs" role="tablist">
        {(["requirements", "design", "tasks"] as const).map((f) => (
          <button key={f} type="button" role="tab" aria-selected={tab === f} onClick={() => setTab(f)}>{f[0]!.toUpperCase() + f.slice(1)}</button>
        ))}
        <span className="sp" />
        <Link href={`/p/${d.project.id}/spec`} className="ghost" style={{ padding: "4px 10px", alignSelf: "center" }}>Edit the spec</Link>
      </div>
      {err ? <div className="err">{err}</div> : !s ? <div className="muted"><Loader size={12} className="spin" aria-hidden /> Loading…</div>
        : s[tab] ? <Markdown text={s[tab]!} /> : <div className="empty">Not written yet.</div>}
    </div>
  );
}

type Rows = Record<string, unknown>[];
interface DataModel { name: string; count?: number; rows?: Rows }
interface DataAnswer { engine?: string; branch?: string; models?: DataModel[]; tables?: DataModel[] }

const show = (v: unknown) => (v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));

// Shape of GET /api/projects/:id/data (L3): { engine?, branch?, models|tables: [{ name, count?, rows? }] }
export function DataPane({ d, branch }: { d: Detail; branch: string }) {
  const [a, setA] = useState<DataAnswer | null>(null);
  const [err, setErr] = useState("");
  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setA(null); setErr("");
    api<DataAnswer>(`/api/projects/${d.project.id}/data?branch=${encodeURIComponent(branch)}`).then(setA).catch((e: Error) => setErr(e.message));
  }, [d.project.id, branch]);
  const models = a?.models ?? a?.tables ?? [];
  const cur = models.find((m) => m.name === pick) ?? models[0];
  const cols = cur?.rows ? [...new Set(cur.rows.flatMap((r) => Object.keys(r)))].slice(0, 12) : [];

  async function exportData() {
    setBusy(true); setErr("");
    try {
      const r = await api<{ url?: string }>(`/api/projects/${d.project.id}/dump`, { body: { branch } });
      if (r.url) window.open(r.url, "_blank", "noopener");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="scroll">
      <div className="row-f" style={{ marginBottom: 12 }}>
        <b>{a?.engine ?? (d.sqlAllowed ? "Amplify Data or Aurora" : "Amplify Data")}</b><span className="mono muted">{branch}</span><span className="sp" />
        <button type="button" className="ghost" style={{ padding: "4px 10px" }} onClick={exportData} disabled={busy}>{busy ? <Loader size={13} className="spin" aria-hidden /> : <Download size={13} aria-hidden />} Export</button>
      </div>
      {err ? <div className="err">{err}</div> : !a ? <div className="muted"><Loader size={12} className="spin" aria-hidden /> Loading…</div> : !models.length ? <div className="empty">No data models yet.</div> : (
        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 14 }}>
          <div className="tree" style={{ border: 0, padding: 0 }}>
            {models.map((m) => (
              <button key={m.name} type="button" className={cur?.name === m.name ? "on" : ""} onClick={() => setPick(m.name)}>
                {m.name}<span className="sp" />{m.count !== undefined ? <span className="mono">{m.count.toLocaleString()}</span> : null}
              </button>
            ))}
          </div>
          <div className="card" style={{ padding: "4px 8px", overflow: "auto" }}>
            {cur?.rows?.length ? (
              <table className="mono">
                <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>{cur.rows.slice(0, 100).map((r, i) => <tr key={i}>{cols.map((c) => <td key={c} style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{show(r[c])}</td>)}</tr>)}</tbody>
              </table>
            ) : <div className="empty">No records.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

const TITLE: Record<Pulse, CopyKey> = { building: "building", deploying: "deploying", repair: "repair", alive: "alive", dead: "dead" };

function evView(d: Detail, e: Ev): { chip: string; title: ReactNode; sub: string } | null {
  const n = d.deploys.length;
  switch (e.kind) {
    case "deploy_failed": return { chip: "c-bad", title: <Word k="evFail" vars={{ n }} />, sub: e.text ?? e.cause ?? "" };
    case "deploy_live": return { chip: "c-ok", title: <Word k="evLive" vars={{ n }} />, sub: e.url ?? e.branch ?? "" };
    case "deploy_started": return { chip: "c-warn", title: `Deploy ${e.branch ?? ""}`, sub: "running" };
    case "repair_started": return { chip: "c-warn", title: <Word k="evFix" vars={{ n: d.repairs.length || 1 }} />, sub: e.cause ?? e.text ?? "" };
    case "repair_done": return { chip: e.status === "gave_up" ? "c-bad" : "c-ok", title: e.status === "gave_up" ? "Repair gave up" : <Word k="evOk" />, sub: e.text ?? "" };
    case "approval_needed": return { chip: "c-warn", title: "Needs your approval", sub: e.text ?? "" };
    case "published": return { chip: "c-ok", title: "Published", sub: e.url ?? "" };
    case "preview_created": return { chip: "c-n", title: `Preview ${e.branch ?? ""}`, sub: "branch created" };
    case "preview_deleted": return { chip: "c-n", title: `Preview ${e.branch ?? ""} deleted`, sub: "" };
    case "task_started": return { chip: "c-warn", title: `Task ${e.task ?? ""} started`, sub: e.title ?? "" };
    case "task_done": return { chip: "c-ok", title: `Task ${e.task ?? ""} done`, sub: e.title ?? "" };
    case "run_done": return { chip: e.status === "succeeded" ? "c-ok" : "c-bad", title: `Run ${e.status ?? "ended"}`, sub: "" };
    case "file_changed": return { chip: "c-n", title: e.path ?? "file", sub: `${e.from === "user" ? "you" : "kiro"} · ${e.op ?? "edit"}` };
    case "message": return e.text ? { chip: "c-n", title: e.from === "user" ? "You" : e.from ?? "kiro", sub: e.text } : null;
    default: return null;
  }
}

export function TimelinePane({ d, events, state }: { d: Detail; events: Ev[]; state: Pulse }) {
  const [all, setAll] = useState(false);
  const run = activeRun(d) ?? d.runs[0];
  const repair = d.repairs[0];
  const lastDeploy = d.deploys[0];
  const view = [...events].reverse().map((e) => [e, evView(d, e)] as const).filter((x) => x[1] && (all || x[0].kind !== "file_changed"));
  return (
    <div className="scroll" data-haunt-focus>
      <div className="row-f" style={{ gap: 12 }}>
        <div className="h" style={{ fontSize: 28 }}><Word k={TITLE[state]} /></div>
        <span className="mono muted">
          {state === "repair" && repair ? <Word k="subRepair" vars={{ n: repair.attempt }} />
            : state === "dead" && lastDeploy ? <Word k="subDead" vars={{ n: deployNo(d, lastDeploy.id), reason: repair?.cause ?? "failed" }} />
            : state === "alive" && lastDeploy ? <Word k="subAlive" vars={{ n: deployNo(d, lastDeploy.id) }} />
            : state === "deploying" && lastDeploy ? <Word k="subDeploying" vars={{ n: deployNo(d, lastDeploy.id) }} />
            : <Word k="subBuilding" vars={{ n: Math.min(d.tasks.filter((t) => t.state === "done").length + 1, d.tasks.length || 1), total: d.tasks.length || "?" }} />}
        </span>
      </div>
      <Heartbeat state={state} />
      <div className="grid2" style={{ margin: "14px 0 18px" }}>
        <div className="card kpi"><div className="n">{repair ? dur(repair.recoveredS) : "--"}</div><div className="t"><Word k="ttr" /></div></div>
        <div className="card kpi"><div className="n">{run?.credits !== null && run?.credits !== undefined ? Math.round(run.credits) : "--"}</div><div className="t">Kiro credits this {run?.mode ?? "run"}</div></div>
      </div>
      <div className="row-f" style={{ marginBottom: 10 }}>
        <div className="label" style={{ margin: 0 }}><Word k="timeline" /></div><span className="sp" />
        <button type="button" className="pill" aria-pressed={all} onClick={() => setAll(!all)}>Show file changes</button>
      </div>
      {view.length ? view.map(([e, v], i) => (
        <div key={`${e.at}${i}`} className="ev">
          <span className={`chip ${v!.chip}`}>●</span>
          <div style={{ minWidth: 0 }}>
            <b>{v!.title}</b>
            <div className="mono muted" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{clock(e.at)}{v!.sub ? ` · ${v!.sub.slice(0, 400)}` : ""}</div>
          </div>
          {e.url ? <a href={e.url} target="_blank" rel="noreferrer" className="muted" aria-label="Open"><ExternalLink size={13} aria-hidden /></a> : null}
        </div>
      )) : <div className="empty">Nothing yet.</div>}
    </div>
  );
}
