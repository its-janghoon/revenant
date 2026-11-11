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
  useEffect(() => {
    api<DomainAnswer>(`/api/projects/${projectId}/domain`).then(setA).catch(() => setA({ domain: null }));
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
      ) : (
        <>
          <div className="t sp"><b>{a?.domain ?? "No custom domain"}</b><span>{a?.domain ? `custom domain · ${ok ? "DNS ok" : a.status ?? "checking DNS"}` : "Point your own domain at this app"}</span></div>
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

export function Export({ projectId }: { projectId: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go() {
    setBusy(true); setErr("");
    try {
      const r = await api<{ url?: string }>(`/api/projects/${projectId}/dump`, { body: { branch: "main" } });
      if (r.url) window.open(r.url, "_blank", "noopener");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button type="button" className="ghost" style={{ padding: "4px 10px" }} onClick={go} disabled={busy}>{busy ? <Loader size={13} className="spin" aria-hidden /> : <Download size={13} aria-hidden />} Export</button>
      {err ? <span className="err" style={{ marginTop: 0 }}>{err}</span> : null}
    </>
  );
}
