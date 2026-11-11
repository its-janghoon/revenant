"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { Icon } from "../icons";
import { call } from "../call";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  admin: boolean;
  status: "active" | "invited" | "disabled";
  kiro: "company" | "own" | "not connected";
  sql: boolean | null;
  apps: number;
  usd: number;
  credits: number;
  me: boolean;
}

const AV = ["#4f46e5", "#0891b2", "#b45309", "#7c3aed", "#475569"];
const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";

function role(u: UserRow): [string, string] {
  if (u.status === "disabled") return ["Disabled", "c-bad"];
  if (u.admin) return ["Admin", "c-warn"];
  if (u.status === "invited") return ["Invited", "c-n"];
  return ["Member", "c-n"];
}

export function Users({ rows, installSql }: { rows: UserRow[]; installSql: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [admin, setAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? rows.filter((r) => r.name.toLowerCase().includes(s) || r.email.toLowerCase().includes(s)) : rows;
  }, [rows, q]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function invite(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      await call("/admin/api/users", "POST", { email: email.trim(), admin });
      setEmail("");
      setAdmin(false);
      setInviting(false);
    });
  }

  const patch = (u: UserRow, body: object) => run(() => call(`/admin/api/users/${encodeURIComponent(u.id)}`, "PATCH", body));
  const remove = (u: UserRow) => {
    if (!window.confirm(`Delete ${u.email}? Their apps keep running; their own Kiro key is removed.`)) return;
    void run(() => call(`/admin/api/users/${encodeURIComponent(u.id)}`, "DELETE"));
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
        <div className="h title">Users</div>
        <span className="sp" />
        <label className="input search">
          <Icon n="search" s={14} />
          <input placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" />
        </label>
        <button type="button" className="btn" onClick={() => setInviting((v) => !v)}><Icon n="user-plus" s={15} /> Invite</button>
      </div>

      {inviting ? (
        <form className="card invite" onSubmit={invite}>
          <input className="input" type="email" required placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)}
            style={{ width: 280 }} aria-label="Email" autoFocus />
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} /> Admin
          </label>
          <span className="sp" />
          <span className="muted" style={{ fontSize: 12 }}>Cognito emails the invite.</span>
          <button type="submit" className="btn" disabled={busy}>Send invite</button>
          <button type="button" className="ghost" onClick={() => setInviting(false)}>Cancel</button>
        </form>
      ) : null}
      {err ? <div className="err" role="alert" style={{ marginBottom: 10 }}>{err}</div> : null}

      <div className="card" style={{ padding: "4px 8px" }}>
        <table>
          <thead>
            <tr><th>Person</th><th>Role</th><th>Kiro</th><th>SQL</th><th>Apps</th><th>AWS / mo</th><th>Credits / mo</th><th /></tr>
          </thead>
          <tbody>
            {shown.map((u, i) => {
              const [r, rc] = role(u);
              const sql = u.sql === null ? "policy" : u.sql ? "on" : "off";
              return (
                <tr key={u.id}>
                  <td>
                    <div className="who">
                      <span className="av" style={{ background: AV[i % AV.length] }}>{initials(u.name)}</span>
                      <div><b>{u.name}</b><div className="muted" style={{ fontSize: 11.5 }}>{u.email}</div></div>
                    </div>
                  </td>
                  <td><span className={`chip ${rc}`}>{r}</span></td>
                  <td className="muted">{u.kiro}</td>
                  <td><span className={`chip ${u.sql ? "c-ok" : "c-n"}`} title={u.sql === null ? `follows the install: ${installSql ? "on" : "off"}` : undefined}>{sql}</span></td>
                  <td className="mono">{u.apps}</td>
                  <td className="mono">{usd(u.usd)}</td>
                  <td className="mono">{Math.round(u.credits).toLocaleString("en-US")}</td>
                  <td>
                    <details className="menu">
                      <summary aria-label={`Actions for ${u.email}`}><Icon n="more-horizontal" s={15} /></summary>
                      <div className="pop">
                        <div className="lbl">SQL databases</div>
                        {([[null, `Follow policy (${installSql ? "on" : "off"})`], [true, "Allow SQL"], [false, "No SQL"]] as const).map(([v, t]) => (
                          <button key={String(v)} type="button" aria-pressed={u.sql === v} disabled={busy} onClick={() => patch(u, { sqlAllowed: v })}>
                            {u.sql === v ? "✓ " : ""}{t}
                          </button>
                        ))}
                        {u.me ? null : (
                          <>
                            <hr />
                            <button type="button" disabled={busy} onClick={() => patch(u, { disabled: u.status !== "disabled" })}>
                              {u.status === "disabled" ? "Enable" : "Disable"}
                            </button>
                            <button type="button" className="danger" disabled={busy} onClick={() => remove(u)}>Delete</button>
                          </>
                        )}
                      </div>
                    </details>
                  </td>
                </tr>
              );
            })}
            {shown.length ? null : <tr><td colSpan={8} className="muted">No one matches.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
