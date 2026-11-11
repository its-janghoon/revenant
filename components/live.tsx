"use client";
// Live app page parts that act: custom domain (deploy lane's /domain route) and data export.
import { Check, Download, Globe, Loader } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "./api";

interface DomainAnswer { domain: string | null; status?: string; records?: { name: string; type: string; value: string }[] }

export function Domain({ projectId }: { projectId: string }) {
  const [a, setA] = useState<DomainAnswer | null>(null);
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [loadErr, setLoadErr] = useState("");
  useEffect(() => {
    api<DomainAnswer>(`/api/projects/${projectId}/domain`).then(setA).catch((e: Error) => { setA({ domain: null }); setLoadErr(e.message); });
  }, [projectId]);

  async function save() {
    setBusy(true); setErr("");
    try {
      setA(await api<DomainAnswer>(`/api/projects/${projectId}/domain`, { method: "PUT", body: { domain: v.trim() } }));
      setEdit(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const ok = a?.status === "AVAILABLE" || a?.status === "ok";
  return (
    <div className="row" style={{ flexWrap: "wrap" }}>
      {edit ? (
        <form className="row-f sp" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <input className="input" autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder="app.example.com" aria-label="Custom domain" />
          <button type="submit" className="btn" disabled={busy || v.trim().length < 3}>{busy ? <Loader size={13} className="spin" aria-hidden /> : <Check size={13} aria-hidden />} Save</button>
          <button type="button" className="ghost" onClick={() => setEdit(false)}>Cancel</button>
        </form>
      ) : a === null ? (
        <div className="t sp muted"><Loader size={12} className="spin" aria-hidden /> Reading the domain…</div>
      ) : (
        <>
          <div className="t sp"><b>{a.domain ?? "No custom domain"}</b><span>{a.domain ? `custom domain · ${ok ? "DNS ok" : a.status ?? "checking DNS"}` : loadErr ? `Could not read the domain: ${loadErr}` : "Point your own domain at this app"}</span></div>
          {a?.domain ? <span className={`chip ${ok ? "c-ok" : "c-warn"}`}>{ok ? "ok" : "pending"}</span> : null}
          <button type="button" className="ghost" style={{ padding: "4px 10px" }} onClick={() => { setV(a?.domain ?? ""); setEdit(true); }}><Globe size={13} aria-hidden /> {a?.domain ? "Change" : "Add"}</button>
        </>
      )}
      {a?.records?.length && !ok ? (
        <div className="diff" style={{ width: "100%" }}>{a.records.map((r) => `${r.name}  ${r.type}  ${r.value}`).join("\n")}</div>
      ) : null}
      {err ? <div className="err" style={{ width: "100%" }}>{err}</div> : null}
    </div>
  );
}

type Dump = { status: "running"; build?: string } | { status: "failed"; reason: string } | { status: "done"; url: string; file: string };

/** pg_dump of an SQL app's database (POST /api/projects/:id/dump), then a presigned download. */
export function Export({ projectId, branch = "main" }: { projectId: string; branch?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go() {
    setBusy(true); setErr("");
    try {
      const url = `/api/projects/${projectId}/dump`;
      const start = await api<Dump>(url, { body: { branch } });
      const build = start.status === "running" ? start.build : undefined;
      let r: Dump = start;
      for (let i = 0; build && r.status === "running" && i < 120; i++) {
        await new Promise((ok) => setTimeout(ok, 5000));
        r = await api<Dump>(url, { body: { branch, build } });
      }
      if (r.status === "done") window.location.href = r.url;
      else if (r.status === "failed") setErr(r.reason);
      else setErr("The export is still running; try again in a minute.");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button type="button" className="ghost" style={{ padding: "4px 10px" }} onClick={go} disabled={busy}>{busy ? <Loader size={13} className="spin" aria-hidden /> : <Download size={13} aria-hidden />} {busy ? "Exporting…" : "Export"}</button>
      {err ? <span className="err" style={{ marginTop: 0 }}>{err}</span> : null}
    </>
  );
}
