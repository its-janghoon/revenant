"use client";
// One-screen onboarding (flow2.js S.welcome): pick a look, start with FinePrint or a blank prompt.
import { ArrowRight, CheckCircle2, CircleAlert, FileSignature, Loader, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { Project } from "@/lib/contracts";
import { setMode, useTheme } from "@/lib/theme";
import { api, usd } from "./api";
import { W } from "./words";

export interface WelcomeProps { account: string; region: string; kiro: { ok: boolean; text: string }; budgetUsd: number }

export function Welcome(p: WelcomeProps) {
  const router = useRouter();
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const seen = () => api("/api/me", { body: { onboarded: true } });

  async function fineprint() {
    setErr(""); setBusy(true);
    try {
      await seen();
      const r = await api<{ project: Project }>("/api/projects", { body: { request: "FinePrint", example: "fineprint" } });
      router.push(`/p/${r.project.id}/spec`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  async function blank() {
    await seen().catch(() => undefined);
    router.push("/");
    router.refresh();
  }

  const Ok = ({ ok, children }: { ok: boolean; children: ReactNode }) => (
    <span>{ok ? <CheckCircle2 size={13} aria-hidden /> : <CircleAlert size={13} aria-hidden style={{ color: "var(--bad)" }} />} {children}</span>
  );

  return (
    <div className="page">
      <div className="ob">
        <h1 className="big"><W k="welcome" /></h1>
        <div className="muted" style={{ marginTop: 10, fontSize: 14 }}>Pick a look. You can change it any time.</div>
        <div className="pick" role="radiogroup" aria-label="Look">
          <button type="button" role="radio" aria-checked={t.mode === "light"} className={t.mode === "light" ? "on" : ""} onClick={() => setMode("light")}>
            <div className="pv" style={{ background: "#fbfbfa", borderBottom: "1px solid #e7e6e2", padding: 14 }}>
              <div style={{ height: 10, width: "60%", background: "#e7e6e2", borderRadius: 4 }} />
              <div style={{ height: 46, marginTop: 12, border: "1px solid #e7e6e2", borderRadius: 8, background: "#fff" }} />
            </div>
            <div className="tx"><b><Sun size={15} aria-hidden /> Light</b><div className="muted">Plain. No effects.</div></div>
          </button>
          <button type="button" role="radio" aria-checked={t.mode === "haunted"} className={t.mode === "haunted" ? "on" : ""} onClick={() => setMode("haunted")}>
            <div className="pv" style={{ background: "radial-gradient(circle at 30% 30%,#2a2522,#060607 70%)", borderBottom: "1px solid #241f1b", padding: 14, color: "#e9e2d2", font: "italic 700 20px var(--serif)" }}>It has risen.</div>
            <div className="tx"><b><Moon size={15} aria-hidden /> Haunted</b><div className="muted">Rain, thunder, deploys that die and rise.</div></div>
          </button>
        </div>
        <div className="label" style={{ textAlign: "left" }}>Start with</div>
        <div className="card" style={{ textAlign: "left", display: "flex", gap: 14, alignItems: "center", padding: "14px 16px" }}>
          <div className="ic"><FileSignature size={17} aria-hidden /></div>
          <div className="sp"><b>FinePrint</b><div className="muted">A contract signing site that flags toxic clauses. Ready in about 20 min.</div></div>
          <button type="button" className="btn" onClick={fineprint} disabled={busy || !p.kiro.ok}>
            {busy ? <Loader size={15} className="spin" aria-hidden /> : null}<W k="buildThis" /> <ArrowRight size={15} aria-hidden />
          </button>
        </div>
        {err ? <div className="err" role="alert">{err}</div> : null}
        <div style={{ marginTop: 12 }}>
          <span className="muted">or </span>
          <button type="button" className="link" onClick={blank}>start from a blank prompt</button>
        </div>
        <div className="ok-line">
          <Ok ok={Boolean(p.account)}>AWS {p.account.replace(/(\d{4})(\d{4})(\d{4})/, "$1-$2-$3")} · {p.region}</Ok>
          <Ok ok={p.kiro.ok}>{p.kiro.ok ? p.kiro.text : <a href="/settings">{p.kiro.text}</a>}</Ok>
          <Ok ok>Budget {usd(p.budgetUsd, 0)}/mo</Ok>
        </div>
      </div>
    </div>
  );
}
