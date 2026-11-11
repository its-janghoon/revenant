"use client";
// Studio chat (flow2.js chatPane): your requests, and per run the agent's words, a plan card,
// file-diff cards and preview cards. Built from runs, tasks, deploys, repairs and the timeline.
import {
  ArrowUp, Brain, Check, ChevronDown, ChevronRight, CircleX, ExternalLink, FileCode2, HeartPulse, ListChecks, Loader,
  MousePointer2, Paperclip, Rocket, Square, X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Deploy, Repair, Run } from "@/lib/contracts";
import type { Detail, FileBody, InspectOut } from "@/app/_lib/types";
import type { Ev } from "@/app/_lib/events";
import { Word, useTheme } from "@/lib/theme";
import { api, dur } from "../api";
import { W, pick } from "../words";
import { diffLines } from "./diff";
import { activeRun, baseOf, deployNo } from "./state";

type Item =
  | { t: "me"; at: string; text: string; select?: { file: string; line: number } | null }
  | { t: "run"; at: string; run: Run; until: string }
  | { t: "deploy"; at: string; deploy: Deploy }
  | { t: "repair"; at: string; repair: Repair };

export interface ChatProps {
  d: Detail;
  events: Ev[];
  selection: InspectOut | null;
  clearSelection: () => void;
  selectOn: boolean;
  setSelectOn: (on: boolean) => void;
  openFile: (path: string) => void;
  onSent: () => void;
}

const MODE: Record<Run["mode"], string> = { spec: "Writing the spec", build: "Building", change: "Changing", repair: "Repairing" };

export function Chat(p: ChatProps) {
  const { d, events } = p;
  const t = useTheme();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const going = activeRun(d);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [{ t: "me", at: d.project.createdAt, text: d.project.request }];
    for (const e of events) if (e.kind === "message" && e.from === "user" && e.text) out.push({ t: "me", at: e.at, text: e.text, select: e.select });
    const runs = [...d.runs].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    runs.forEach((r, i) => out.push({ t: "run", at: r.startedAt, run: r, until: runs[i + 1]?.startedAt ?? "9999" }));
    for (const x of d.deploys) out.push({ t: "deploy", at: x.createdAt, deploy: x });
    for (const x of d.repairs) out.push({ t: "repair", at: x.createdAt, repair: x });
    // a request is written just before its run starts: keep it above the run
    return out.sort((a, b) => a.at.localeCompare(b.at) || (a.t === "me" ? -1 : b.t === "me" ? 1 : 0));
  }, [d, events]);

  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [items.length, events.length]);
  useEffect(() => { if (p.selection) area.current?.focus(); }, [p.selection]);

  async function send() {
    const v = text.trim();
    if (!v) return;
    setErr(""); setBusy(true);
    try {
      await api(`/api/projects/${d.project.id}/change`, { body: { text: v, ...(p.selection ? { select: { file: p.selection.file, line: p.selection.line } } : {}) } });
      setText("");
      p.clearSelection();
      p.onSent();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    if (!going) return;
    await api(`/api/runs/${going.id}/stop`, { body: {} }).catch((e: Error) => setErr(e.message));
    p.onSent();
  }

  return (
    <div className="chat">
      <div className="msgs" aria-live="polite">
        {items.map((it, i) => {
          if (it.t === "me") return (
            <div key={`m${i}`} className="me">{it.text}{it.select ? <span className="selref">{it.select.file}:{it.select.line}</span> : null}</div>
          );
          if (it.t === "run") return <RunBlock key={it.run.id} d={d} run={it.run} until={it.until} events={events} openFile={p.openFile} />;
          if (it.t === "deploy") return <DeployCard key={it.deploy.id} d={d} x={it.deploy} />;
          return <RepairCard key={it.repair.id} x={it.repair} />;
        })}
        <div ref={end} />
      </div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        {p.selection ? (
          <div className="pill on" style={{ marginBottom: 8 }}>
            <MousePointer2 size={12} aria-hidden /> {p.selection.label} · {p.selection.file.split("/").pop()}:{p.selection.line}
            <button type="button" aria-label="Clear selection" style={{ all: "unset", cursor: "pointer", display: "flex" }} onClick={p.clearSelection}><X size={12} aria-hidden /></button>
          </div>
        ) : null}
        <textarea ref={area} value={text} rows={2} aria-label="Ask Revenant to change anything"
          placeholder={pick("askAny", t.mode === "haunted")}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
        <div className="tools">
          <span className="pill" title="Attachments go with a new app from the home screen"><Paperclip size={13} aria-hidden /> Attach</span>
          <button type="button" className="pill" aria-pressed={p.selectOn} onClick={() => p.setSelectOn(!p.selectOn)}><MousePointer2 size={13} aria-hidden /> Select</button>
          <span className="pill"><Brain size={13} aria-hidden /> {going?.model && going.model !== "auto" ? going.model : "Auto"}</span>
          <span className="sp" />
          {going ? <button type="button" className="ghost" style={{ padding: "6px 10px" }} onClick={stop} aria-label="Stop the run"><Square size={13} aria-hidden /></button> : null}
          <button type="submit" className="btn" style={{ padding: "7px 10px" }} disabled={busy || !text.trim() || Boolean(going)} aria-label="Send">
            {busy ? <Loader size={15} className="spin" aria-hidden /> : <ArrowUp size={15} aria-hidden />}
          </button>
        </div>
        {going ? <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>Kiro is working; you can send the next change when this run ends.</div> : null}
        {err ? <div className="err" role="alert">{err}</div> : null}
      </form>
    </div>
  );
}

function RunBlock({ d, run, until, events, openFile }: { d: Detail; run: Run; until: string; events: Ev[]; openFile: (p: string) => void }) {
  const mine = events.filter((e) => e.at >= run.startedAt && e.at < until && e.from !== "user");
  const said = mine.filter((e) => e.kind === "message" && e.text && (e.from === "agent" || e.from === null)).map((e) => e.text!);
  const problems = mine.filter((e) => e.kind === "message" && e.text && (e.from === "runner" || e.from === "guard") && /fail|error|not /i.test(e.text));
  const files = new Map<string, Ev>();
  for (const e of mine) if (e.kind === "file_changed" && e.path) files.set(e.path, e);
  const open = run.status === "queued" || run.status === "running";
  const done = d.tasks.filter((x) => x.state === "done").length;
  const current = d.tasks.find((x) => x.state === "running") ?? d.tasks.find((x) => x.state === "todo");
  const secs = run.endedAt ? (Date.parse(run.endedAt) - Date.parse(run.startedAt)) / 1000 : null;
  const branch = d.previews.find((x) => x.createdAt >= run.startedAt && x.createdAt < until)?.branch ?? d.branch;

  return (
    <div className="ai">
      <div className="think">
        {open ? <Loader size={13} className="spin" aria-hidden /> : run.status === "succeeded" ? <Check size={13} aria-hidden /> : <CircleX size={13} aria-hidden style={{ color: "var(--bad)" }} />}
        {open ? <><W k="working" /> · {MODE[run.mode].toLowerCase()}{run.mode !== "spec" && current && d.tasks.length ? ` · task ${current.number} / ${d.tasks.length}` : ""}</>
          : <>{MODE[run.mode]} · {run.status}{secs !== null ? ` in ${dur(secs)}` : ""}</>}
        <span> · Kiro {run.model === "auto" ? "Auto" : run.model}{run.credits !== null ? ` · ${Math.round(run.credits)} credits` : ""}</span>
      </div>
      {said.map((s, i) => <div key={i} className="say">{s}</div>)}
      {(run.mode === "build" || run.mode === "change") && d.tasks.length && run === d.runs[0] ? (
        <div className="edit">
          <div className="eh"><ListChecks size={14} aria-hidden /><b>Plan</b><span className="sp" /><span className="muted">{done} / {d.tasks.length}</span></div>
          <div className="eb tasks">
            {d.tasks.map((x) => (
              <div key={x.id} className="task"><span className={`box ${x.state === "done" ? "done" : x.state === "running" ? "run" : x.state === "failed" ? "failed" : ""}`} />{x.number}. {x.title}</div>
            ))}
          </div>
        </div>
      ) : null}
      {[...files.values()].map((e) => <FileCard key={e.path!} d={d} ev={e} branch={e.branch ?? branch} openFile={openFile} />)}
      {problems.slice(-2).map((e, i) => <div key={`p${i}`} className="mono del">{e.text}</div>)}
    </div>
  );
}

function FileCard({ d, ev, branch, openFile }: { d: Detail; ev: Ev; branch: string; openFile: (p: string) => void }) {
  const [open, setOpen] = useState(false);
  const [diff, setDiff] = useState<ReturnType<typeof diffLines> | "big" | "error" | null>(null);
  const path = ev.path!;

  useEffect(() => {
    if (!open || diff) return;
    const q = new URLSearchParams({ branch, path, against: baseOf(d, branch) });
    api<FileBody>(`/api/projects/${d.project.id}/files?${q}`)
      .then((f) => setDiff(f.type === "file" ? diffLines(f.before ?? "", f.content) ?? "big" : "error"))
      .catch(() => setDiff(ev.op === "delete" ? diffLines("(deleted)", "") : "error"));
  }, [open, diff, d, branch, path, ev.op]);

  const counts = diff && typeof diff === "object" ? diff : null;
  return (
    <div className="edit">
      <button type="button" className="eh" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={13} aria-hidden /> : <ChevronRight size={13} aria-hidden />}
        <FileCode2 size={14} aria-hidden /><b style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{path}</b><span className="sp" />
        {counts ? <><span className="add">+{counts.add}</span> <span className="del">−{counts.del}</span></> : <span className="muted">{ev.op === "add" ? "new" : ev.op === "delete" ? "deleted" : "edited"}</span>}
      </button>
      {open ? (
        <div className="eb">
          {diff === null ? <span className="muted">Loading…</span>
            : diff === "big" ? <span className="muted">Too large to show here.</span>
            : diff === "error" ? <span className="muted">Not on {branch} any more.</span>
            : diff.lines.map((l, i) => <div key={i} className={l.op === "+" ? "add" : l.op === "-" ? "del" : "muted"}>{l.op === "…" ? "…" : `${l.op} ${l.text}`}</div>)}
          {ev.op !== "delete" ? <div style={{ marginTop: 6 }}><button type="button" className="link muted" onClick={() => openFile(path)}>Open in Code</button></div> : null}
        </div>
      ) : null}
    </div>
  );
}

function DeployCard({ d, x }: { d: Detail; x: Deploy }) {
  const n = deployNo(d, x.id);
  const prod = x.branch === "main";
  const icon = x.status === "live" ? <Check size={14} aria-hidden /> : x.status === "failed" ? <CircleX size={14} aria-hidden style={{ color: "var(--bad)" }} /> : <Loader size={14} className="spin" aria-hidden />;
  const what = prod ? "Production" : `Preview ${x.branch.replace("preview/", "#")}`;
  const state = x.status === "live" ? "deployed" : x.status === "failed" ? "failed" : x.status === "waiting_approval" ? "waits for your approval" : "deploying";
  return (
    <div className="ai">
      <div className="edit">
        <div className="eh">{prod ? <Rocket size={14} aria-hidden /> : icon}<span>{what} {state} · deploy #{n}</span><span className="sp" />
          {x.url && x.status === "live" ? <a href={x.url} target="_blank" rel="noreferrer" className="muted" aria-label="Open"><ExternalLink size={13} aria-hidden /></a> : null}
          {x.status === "waiting_approval" ? <a href={`/p/${d.project.id}/publish`} className="muted">Review</a> : null}
        </div>
      </div>
    </div>
  );
}

function RepairCard({ x }: { x: Repair }) {
  return (
    <div className="ai">
      <div className="edit">
        <div className="eh"><HeartPulse size={14} aria-hidden /><b><Word k="repair" /> {x.attempt} / 3</b><span className="sp" />
          <span className={x.outcome === "recovered" ? "add" : x.outcome === "gave_up" ? "del" : "muted"}>{x.outcome === "recovered" ? `recovered in ${dur(x.recoveredS)}` : x.outcome === "gave_up" ? "gave up" : x.checkStatus}</span></div>
        {x.cause ? <div className="eb" style={{ whiteSpace: "normal" }}>{x.cause}</div> : null}
      </div>
    </div>
  );
}
