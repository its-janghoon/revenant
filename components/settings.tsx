"use client";
// Settings: look, passkeys, your own Kiro key, Kiro Crew tokens.
import { associateWebAuthnCredential, deleteWebAuthnCredential, listWebAuthnCredentials } from "aws-amplify/auth";
import { Bot, Brain, Copy, KeyRound, Loader, Palette, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { CrewToken, SettingsView } from "@/app/_lib/types";
import { ThemeSwitch } from "@/lib/theme";
import { api, since } from "./api";
import { W } from "./words";

interface Passkey { credentialId?: string; friendlyCredentialName?: string; createdAt?: Date }

function Section({ icon, title, sub, children }: { icon: ReactNode; title: string; sub: string; children: ReactNode }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="row-f" style={{ marginBottom: 6 }}><div className="ic">{icon}</div><div><b style={{ fontSize: 14 }}>{title}</b><div className="muted">{sub}</div></div></div>
      {children}
    </div>
  );
}

export function SettingsScreen({ initial }: { initial: SettingsView }) {
  const [s, setS] = useState(initial);
  return (
    <div className="page">
      <div className="wrap" style={{ maxWidth: 820 }}>
        <h1 className="h" style={{ fontSize: 30, marginBottom: 18 }}><W k="settings" /></h1>
        <Section icon={<Palette size={16} aria-hidden />} title="Look" sub="Light is plain. Haunted is dark, with rain and thunder; Calm turns the effects off.">
          <div className="row-f" style={{ marginTop: 10 }}><ThemeSwitch /></div>
        </Section>
        <Passkeys />
        <KiroKey s={s} onChange={setS} />
        <Crew />
      </div>
    </div>
  );
}

function Passkeys() {
  const [list, setList] = useState<Passkey[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const load = useCallback(() => listWebAuthnCredentials().then((r) => setList(r.credentials as Passkey[])).catch((e: Error) => { setList([]); setErr(e.message); }), []);
  useEffect(() => { void load(); }, [load]);

  async function add() {
    setBusy(true); setErr("");
    try {
      await associateWebAuthnCredential();
      await load();
    } catch (e) {
      setErr((e as Error).name === "NotAllowedError" ? "The passkey prompt was closed." : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (!confirm("Remove this passkey?")) return;
    await deleteWebAuthnCredential({ credentialId: id }).catch((e: Error) => setErr(e.message));
    await load();
  }

  return (
    <Section icon={<KeyRound size={16} aria-hidden />} title="Sign-in" sub="You sign in with a code we email you. A passkey is faster: Touch ID, Windows Hello or your phone.">
      {list === null ? <div className="muted"><Loader size={12} className="spin" aria-hidden /> Loading…</div> : list.map((k) => (
        <div key={k.credentialId} className="row">
          <div className="t sp"><b>{k.friendlyCredentialName ?? "Passkey"}</b><span>added {k.createdAt ? since(new Date(k.createdAt).toISOString()) : ""}</span></div>
          <button type="button" className="ghost" style={{ padding: "4px 10px" }} onClick={() => k.credentialId && remove(k.credentialId)} aria-label="Remove passkey"><Trash2 size={13} aria-hidden /></button>
        </div>
      ))}
      <div style={{ marginTop: 10 }}>
        <button type="button" className="ghost" onClick={add} disabled={busy}>{busy ? <Loader size={13} className="spin" aria-hidden /> : <Plus size={13} aria-hidden />} Add a passkey</button>
      </div>
      {err ? <div className="err">{err}</div> : null}
    </Section>
  );
}

function KiroKey({ s, onChange }: { s: SettingsView; onChange: (v: SettingsView) => void }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const mode = s.settings.kiroMode;

  async function save() {
    setBusy(true); setErr("");
    try {
      const r = await api<{ set: boolean; updatedAt: string | null }>("/api/settings/kiro", { method: "PUT", body: { key: key.trim() } });
      onChange({ ...s, ownKey: r });
      setKey("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!confirm("Remove your Kiro key? Your builds use the company key, if the install has one.")) return;
    setBusy(true); setErr("");
    try {
      onChange({ ...s, ownKey: await api<{ set: boolean; updatedAt: string | null }>("/api/settings/kiro", { method: "DELETE" }) });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const who = mode === "company" ? "This install pays for Kiro with one company key." : mode === "own" ? "This install asks each person to connect their own Kiro." : "Your own Kiro pays when it is connected; otherwise the company key does.";
  return (
    <Section icon={<Brain size={16} aria-hidden />} title="Kiro" sub={`${who} Model: ${s.settings.model === "auto" ? "Auto" : s.settings.model}.`}>
      <div className="row">
        <div className="t sp"><b>Your Kiro key</b><span>{s.ownKey.set ? `connected${s.ownKey.updatedAt ? ` · updated ${since(s.ownKey.updatedAt)}` : ""} · stored in Secrets Manager` : "not connected"}</span></div>
        <span className={`chip ${s.ownKey.set ? "c-ok" : "c-n"}`}>{s.ownKey.set ? "ok" : "off"}</span>
        {s.ownKey.set ? <button type="button" className="ghost" style={{ padding: "4px 10px" }} onClick={remove} disabled={busy}><Trash2 size={13} aria-hidden /> Remove</button> : null}
      </div>
      {mode !== "company" ? (
        <form className="row-f" style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <input className="input" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder={s.ownKey.set ? "Paste a new key to replace it" : "Paste your Kiro API key"} aria-label="Kiro API key" />
          <button type="submit" className="btn" disabled={busy || key.trim().length < 10}>{busy ? <Loader size={13} className="spin" aria-hidden /> : null}{s.ownKey.set ? "Replace" : "Connect"}</button>
        </form>
      ) : <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Your admin can let people bring their own key under Admin → Policy.</div>}
      {mode === "own" && !s.ownKey.set ? <div className="err">Builds need your key on this install.</div> : null}
      {!s.companyKey && mode !== "own" && !s.ownKey.set ? <div className="err">The company Kiro key is empty. Ask your admin.</div> : null}
      {err ? <div className="err">{err}</div> : null}
    </Section>
  );
}

function Crew() {
  const [list, setList] = useState<CrewToken[] | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [label, setLabel] = useState("Kiro Crew");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");
  const load = useCallback(() => api<{ tokens: CrewToken[] }>("/api/settings/crew").then((r) => setList(r.tokens)).catch((e: Error) => { setList([]); setErr(e.message); }), []);
  useEffect(() => { void load(); }, [load]);
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  async function create() {
    setBusy(true); setErr("");
    try {
      const r = await api<{ token: string }>("/api/settings/crew", { body: { label: label.trim() || "Kiro Crew" } });
      setFresh(r.token);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id: string) {
    if (!confirm("Revoke this token? Kiro Crew stops reaching Revenant until you add a new one.")) return;
    await api("/api/settings/crew", { method: "DELETE", body: { id } }).catch((e: Error) => setErr(e.message));
    await load();
  }
  const copy = (k: string, v: string) => { void navigator.clipboard.writeText(v).then(() => { setCopied(k); setTimeout(() => setCopied(""), 1500); }); };

  return (
    <Section icon={<Bot size={16} aria-hidden />} title="Kiro Crew" sub="Build and publish from chat with the Revenant app for Kiro Crew. It calls Revenant with an API token.">
      {list?.map((t) => (
        <div key={t.id} className="row">
          <div className="t sp"><b>{t.label}</b><span className="mono">rvc_…{t.id.slice(0, 6)} · created {since(t.createdAt)} · {t.lastUsedAt ? `used ${since(t.lastUsedAt)}` : "never used"}</span></div>
          <button type="button" className="ghost" style={{ padding: "4px 10px" }} onClick={() => revoke(t.id)}><Trash2 size={13} aria-hidden /> Revoke</button>
        </div>
      ))}
      {fresh ? (
        <div className="card" style={{ background: "var(--sunk)", margin: "10px 0" }}>
          <b>Copy the token now. It is shown once.</b>
          <div className="row-f" style={{ marginTop: 8 }}>
            <code className="mono" style={{ wordBreak: "break-all", flex: 1 }}>{fresh}</code>
            <button type="button" className="ghost" style={{ padding: "4px 10px" }} onClick={() => copy("t", fresh)}><Copy size={13} aria-hidden /> {copied === "t" ? "Copied" : "Copy"}</button>
          </div>
        </div>
      ) : null}
      <form className="row-f" style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); void create(); }}>
        <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Token name" style={{ maxWidth: 260 }} />
        <button type="submit" className="btn" disabled={busy}>{busy ? <Loader size={13} className="spin" aria-hidden /> : <Plus size={13} aria-hidden />} Create token</button>
      </form>
      <ol className="muted" style={{ margin: "14px 0 0 18px", lineHeight: 1.9, fontSize: 12.5 }}>
        <li>In Kiro Crew, open Settings → Secrets.</li>
        <li>Add <code className="mono">REVENANT_URL</code> = <code className="mono">{origin}</code> <button type="button" className="link" onClick={() => copy("u", origin)}>{copied === "u" ? "copied" : "copy"}</button></li>
        <li>Add <code className="mono">REVENANT_API_TOKEN</code> = the token above.</li>
        <li>Install the app from <code className="mono">crew-app/</code> and resume the <code className="mono">revenant-monitor</code> schedule.</li>
      </ol>
      {err ? <div className="err">{err}</div> : null}
    </Section>
  );
}
