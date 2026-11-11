"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { call } from "../call";
import { Icon } from "../icons";

type Group = "live" | "failing" | "expiring";

export interface AppItem {
  id: string;
  name: string;
  owner: string;
  sql: boolean;
  health: [label: string, chip: string, group: Group | null];
  previews: number;
  usd: number;
  repairs: string;
  url: string | null;
}

const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const FILTERS: [Group | "all", string][] = [["all", "All"], ["live", "Live"], ["failing", "Failing"], ["expiring", "Expiring"]];

export function Apps({ items }: { items: AppItem[] }) {
  const router = useRouter();
  const [f, setF] = useState<Group | "all">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const shown = f === "all" ? items : items.filter((a) => a.health[2] === f);
  const count = (g: Group | "all") => (g === "all" ? items.length : items.filter((a) => a.health[2] === g).length);

  async function remove(a: AppItem) {
    if (!window.confirm(`Delete ${a.name}? Its Amplify app, previews and repository are removed by the cleanup job.`)) return;
    setBusy(a.id);
    setErr(null);
    try {
      await call(`/admin/api/apps/${encodeURIComponent(a.id)}`, "DELETE");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
        <div className="h title">Apps</div>
        <span className="sp" />
        {FILTERS.map(([g, t]) => (
          <button key={g} type="button" className={`pill ${f === g ? "on" : ""}`} aria-pressed={f === g} onClick={() => setF(g)}>
            {t} {count(g)}
          </button>
        ))}
      </div>
      {err ? <div className="err" role="alert" style={{ marginBottom: 10 }}>{err}</div> : null}
      <div className="card" style={{ padding: "4px 8px" }}>
        <table>
          <thead>
            <tr><th>App</th><th>Owner</th><th>Data</th><th>Health</th><th>Previews</th><th>AWS / mo</th><th>Repairs</th><th /></tr>
          </thead>
          <tbody>
            {shown.map((a) => (
              <tr key={a.id}>
                <td><div className="who"><span className="ic" style={{ width: 28, height: 28 }}><Icon n="box" s={14} /></span><b>{a.name}</b></div></td>
                <td>{a.owner}</td>
                <td className="muted">{a.sql ? "Aurora (SQL)" : "Amplify Data"}</td>
                <td><span className={`chip ${a.health[1]}`}>{a.health[0]}</span></td>
                <td className="mono">{a.previews}</td>
                <td className="mono">{usd(a.usd)}</td>
                <td className="mono">{a.repairs}</td>
                <td className="muted" style={{ whiteSpace: "nowrap" }}>
                  {a.url ? <a className="iconbtn" href={a.url} target="_blank" rel="noreferrer" aria-label={`Open ${a.name}`}><Icon n="external-link" s={14} /></a> : null}
                  &nbsp;
                  <button type="button" className="iconbtn" disabled={busy === a.id || a.health[0] === "deleting"} onClick={() => remove(a)} aria-label={`Delete ${a.name}`}>
                    <Icon n="trash-2" s={14} />
                  </button>
                </td>
              </tr>
            ))}
            {shown.length ? null : <tr><td colSpan={8} className="muted">No apps here.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
