"use client";
// Publish screen (flow.html S.publish): what changes, approval for destructive changes, checks.
// The plan and the publish itself come from the deploy lane: GET/POST /api/projects/:id/publish.
import { Loader, Rocket } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Deploy, PublishPlan } from "@/lib/contracts";
import type { Detail, FileBody } from "@/app/_lib/types";
import { api } from "./api";
import { diffLines } from "./studio/diff";
import { W } from "./words";

type Kind = "add" | "update" | "remove";
const chip: Record<Kind, string> = { add: "c-ok", update: "c-warn", remove: "c-bad" };

function kindOf(sql: string): Kind {
  if (/\b(drop|delete|truncate)\b/i.test(sql)) return "remove";
  if (/^\s*(create|insert)\b|\badd\s+(column|constraint)?\b/i.test(sql)) return "add";
  return "update";
}

const DATA_FILE = "amplify/data/resource.ts";

export function Publish({ d }: { d: Detail }) {
  const router = useRouter();
  const id = d.project.id;
  const branch = d.previews.find((p) => !p.deletedAt)?.branch ?? null;
  const [plan, setPlan] = useState<PublishPlan | null>(null);
  const [dataDiff, setDataDiff] = useState<ReturnType<typeof diffLines>>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<"" | "publish" | "keep">("");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!branch) return;
    api<PublishPlan>(`/api/projects/${id}/publish`).then(setPlan).catch((e: Error) => setErr(e.message));
    const q = new URLSearchParams({ branch, path: DATA_FILE, against: "main" });
    api<FileBody>(`/api/projects/${id}/files?${q}`).then((f) => {
      if (f.type === "file" && f.before !== undefined && f.before !== null && f.before !== f.content) setDataDiff(diffLines(f.before, f.content, 1, 40));
    }).catch(() => undefined);
  }, [id, branch]);

  const destructive = plan?.destructive ?? [];
  const changes: [Kind, string][] = [
    ...(plan?.migrationSql ?? []).map((s) => [kindOf(s), s.trim()] as [Kind, string]),
    ...destructive.filter((x) => !(plan?.migrationSql ?? []).some((s) => s.includes(x))).map((x) => ["remove", x] as [Kind, string]),
  ];
  const n = branch?.replace("preview/", "#") ?? "";
  const lastRun = d.runs.find((r) => r.mode !== "spec");
  const lastDeploy = d.deploys.find((x) => x.branch === branch);

  async function publish() {
    setErr(""); setBusy("publish");
    try {
      await api<{ deploy?: Deploy }>(`/api/projects/${id}/publish`, { body: { approve: destructive.length > 0 } });
      router.push(`/p/${id}/app`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy("");
    }
  }

  async function keep() {
    setErr(""); setBusy("keep");
    try {
      await api(`/api/projects/${id}/change`, { body: { text: `Do not remove anything that holds data. Keep: ${destructive.join("; ")}.` } });
      router.push(`/p/${id}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy("");
    }
  }

  if (!branch) {
    return (
      <div className="page"><div className="wrap" style={{ maxWidth: 980 }}>
        <div className="crumbs"><Link href="/apps">Apps</Link> / {d.project.name}</div>
        <div className="card empty" style={{ marginTop: 18 }}>There is no preview to publish yet. <Link href={`/p/${id}`}>Back to the studio</Link></div>
      </div></div>
    );
  }

  return (
    <div className="page">
      <div className="wrap" style={{ maxWidth: 980 }}>
        <div className="crumbs"><Link href="/apps">Apps</Link> / <Link href={`/p/${id}`}>{d.project.name}</Link></div>
        <h1 className="h" style={{ fontSize: 28, margin: "4px 0 18px" }}><W k="publishTitle" vars={{ branch: `preview ${n}` }} /></h1>
        <div className={destructive.length ? "grid2" : ""}>
          <div className="card">
            <div className="label">What changes</div>
            {!plan && !err ? <div className="muted"><Loader size={12} className="spin" aria-hidden /> Reading the change…</div> : null}
            {plan && !changes.length ? <div className="muted">No data changes. Code and pages only.</div> : null}
            {changes.map(([k, t], i) => (
              <div key={i} className="row"><span className={`chip ${chip[k]}`} style={{ width: 62, textAlign: "center" }}>{k}</span><div className="t sp mono" style={{ whiteSpace: "pre-wrap" }}>{t}</div></div>
            ))}
            {!destructive.length && plan ? (
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button type="button" className="btn" onClick={publish} disabled={busy !== ""}>{busy === "publish" ? <Loader size={14} className="spin" aria-hidden /> : <Rocket size={14} aria-hidden />} <W k="publishNow" /></button>
                <Link href={`/p/${id}`} className="ghost">Cancel</Link>
              </div>
            ) : null}
          </div>
          {destructive.length ? (
            <div className="card" style={{ borderColor: "var(--bad)" }}>
              <div className="label" style={{ color: "var(--bad)" }}>Needs your approval</div>
              <div style={{ fontSize: 14, marginBottom: 10 }}><b>{destructive.length === 1 ? destructive[0] : `${destructive.length} changes remove or replace data.`}</b></div>
              {destructive.length > 1 ? <ul style={{ margin: "0 0 10px 18px" }}>{destructive.map((x) => <li key={x}>{x}</li>)}</ul> : null}
              <div className="muted" style={{ marginBottom: 14 }}>Kiro asked for this because the new spec needs it. A backup is taken before publish{plan?.snapshotId ? ` (${plan.snapshotId})` : ""}.</div>
              {dataDiff?.lines.length ? (
                <div className="diff" style={{ marginBottom: 14 }}>
                  <span className="muted">{DATA_FILE}</span>{"\n"}
                  {dataDiff.lines.map((l, i) => <span key={i} className={l.op === "+" ? "add" : l.op === "-" ? "del" : "muted"}>{l.op === "…" ? "…" : `${l.op} ${l.text}`}{"\n"}</span>)}
                </div>
              ) : null}
              <label className="row-f" style={{ marginBottom: 14 }}>
                <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> I understand this data is removed in production.
              </label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" className="btn danger" onClick={publish} disabled={!ok || busy !== ""}>{busy === "publish" ? <Loader size={14} className="spin" aria-hidden /> : null}<W k="approve" /></button>
                <button type="button" className="ghost" onClick={keep} disabled={busy !== ""}>{busy === "keep" ? <Loader size={14} className="spin" aria-hidden /> : null}Keep the data</button>
              </div>
            </div>
          ) : null}
        </div>
        {err ? <div className="err" role="alert">{err}</div> : null}
        <div className="card" style={{ marginTop: 18, display: "flex", gap: 28, flexWrap: "wrap" }}>
          {[
            ["Backup", plan?.snapshotId ? "snapshot ✓" : "before publish"],
            ["Guard", lastRun ? (lastRun.status === "succeeded" ? "passed" : lastRun.status) : "--"],
            ["Build", lastDeploy ? (lastDeploy.status === "live" ? "passed" : lastDeploy.status.replace("_", " ")) : "--"],
            ["Health check", "after publish"],
          ].map(([a, b]) => <div key={a}><div className="label" style={{ marginBottom: 2 }}>{a}</div><b>{b}</b></div>)}
        </div>
      </div>
    </div>
  );
}
