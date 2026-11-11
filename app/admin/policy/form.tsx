"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import type { KiroMode } from "@/lib/contracts";
import type { Policy } from "@/lib/policy";
import { call } from "../call";
import { Icon, type IconName } from "../icons";

interface Person {
  id: string;
  email: string;
  sql: boolean | null;
}

const MODELS: [string, string][] = [
  ["auto", "Auto (recommended)"],
  ["claude-sonnet-4.5", "Claude Sonnet 4.5"],
  ["claude-sonnet-4", "Claude Sonnet 4"],
  ["claude-haiku-4.5", "Claude Haiku 4.5"],
  ["claude-opus-4.5", "Claude Opus 4.5"],
];
const PREVIEW_DAYS = [3, 7, 14, 30];
const APP_HOURS: [number | null, string][] = [[null, "Never"], [24, "24 hours"], [72, "3 days"], [168, "7 days"], [720, "30 days"]];
const KIRO: [KiroMode, string, string][] = [
  ["company", "Company key", "One Kiro account pays for everyone."],
  ["own", "Bring your own", "Each person connects their own Kiro."],
  ["both", "Both", "Own Kiro if connected, else the company key."],
];

function Card({ id, icon, title, sub, children }: { id?: string; icon: IconName; title: string; sub?: string; children: ReactNode }) {
  return (
    <section id={id} className="card pcard">
      <div className="hd"><div className="ic"><Icon n={icon} s={16} /></div><b>{title}</b></div>
      {sub ? <div className="muted">{sub}</div> : null}
      {children}
    </section>
  );
}

function Radio<T extends string | boolean>({ value, items, set, label }: { value: T; items: [T, string, string][]; set: (v: T) => void; label: string }) {
  return (
    <div className="radio" role="group" aria-label={label}>
      {items.map(([v, t, s]) => (
        <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => set(v)}><b>{t}</b>{s}</button>
      ))}
    </div>
  );
}

export function PolicyForm({ policy, people }: { policy: Policy; people: Person[] }) {
  const router = useRouter();
  const [p, setP] = useState<Policy>(policy);
  const [sql, setSql] = useState<Map<string, boolean | null>>(() => new Map(people.map((u) => [u.id, u.sql])));
  const [budget, setBudget] = useState(String(policy.budgetUsd));
  const [credits, setCredits] = useState(String(policy.creditsPerBuild));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof Policy>(k: K, v: Policy[K]) => setP((x) => ({ ...x, [k]: v }));

  // People whose override differs from the install choice: the exceptions.
  const exceptions = people.filter((u) => {
    const v = sql.get(u.id);
    return v !== null && v !== undefined && v !== p.sqlAllowed;
  });
  const others = people.filter((u) => !exceptions.includes(u));
  const setOne = (id: string, v: boolean | null) => setSql((m) => new Map(m).set(id, v));

  const changes = useMemo(() => {
    const patch: Partial<Policy> = {};
    const b = Number(budget), c = Number(credits);
    const next: Policy = { ...p, budgetUsd: b, creditsPerBuild: c };
    for (const k of Object.keys(next) as (keyof Policy)[]) if (next[k] !== policy[k]) Object.assign(patch, { [k]: next[k] });
    const users = people.filter((u) => (sql.get(u.id) ?? null) !== u.sql).map((u) => ({ id: u.id, sqlAllowed: sql.get(u.id) ?? null }));
    return { patch, users, valid: b > 0 && c > 0 && Number.isFinite(b) && Number.isFinite(c) };
  }, [p, budget, credits, sql, policy, people]);
  const dirty = Object.keys(changes.patch).length > 0 || changes.users.length > 0;

  async function save() {
    if (!changes.valid) return setMsg({ ok: false, text: "Budget and credits must be more than 0." });
    setBusy(true);
    setMsg(null);
    try {
      if (Object.keys(changes.patch).length) await call("/admin/api/settings", "PUT", changes.patch);
      for (const u of changes.users) await call(`/admin/api/users/${encodeURIComponent(u.id)}`, "PATCH", { sqlAllowed: u.sqlAllowed });
      setMsg({ ok: true, text: "Saved." });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setP(policy);
    setBudget(String(policy.budgetUsd));
    setCredits(String(policy.creditsPerBuild));
    setSql(new Map(people.map((u) => [u.id, u.sql])));
    setMsg(null);
  }

  const models = MODELS.some(([m]) => m === p.model) ? MODELS : [...MODELS, [p.model, p.model] as [string, string]];

  return (
    <>
      <div className="h title" style={{ marginBottom: 4 }}>Policy</div>
      <div className="muted" style={{ marginBottom: 18 }}>Rules for every app built on this install. Changes apply to the next build.</div>
      <div className="grid2">
        <Card id="databases" icon="database" title="Databases" sub="What new apps may use to store data.">
          <Radio label="Databases" value={p.sqlAllowed} set={(v) => set("sqlAllowed", v)} items={[
            [false, "Amplify Data only", "No extra database. Cheapest, fastest."],
            [true, "Allow SQL", "Kiro may add Aurora Postgres when the spec needs it."],
          ]} />
          <div className="row" style={{ marginTop: 6, flexWrap: "wrap" }}>
            <div className="t sp"><b>SQL {p.sqlAllowed ? "blocked" : "allowed"} for</b><span>Overrides the choice above</span></div>
            {exceptions.map((u) => (
              <button key={u.id} type="button" className="pill" onClick={() => setOne(u.id, null)} aria-label={`Remove ${u.email}`}>
                {u.email.split("@")[0]}@ <Icon n="x" s={11} />
              </button>
            ))}
            {others.length ? (
              <select className="pill" aria-label="Add a person" value="" onChange={(e) => e.target.value && setOne(e.target.value, !p.sqlAllowed)}>
                <option value="">+ Add</option>
                {others.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
              </select>
            ) : null}
          </div>
        </Card>

        <Card id="kiro" icon="brain" title="Kiro" sub="Who pays for agent work, and which model runs it.">
          <Radio label="Who pays for Kiro" value={p.kiroMode} set={(v) => set("kiroMode", v)} items={KIRO} />
          <div className="row" style={{ marginTop: 6 }}>
            <div className="t sp"><b>Model</b><span>Auto picks per step at 1× credits</span></div>
            <select className="input" style={{ width: 190 }} aria-label="Model" value={p.model} onChange={(e) => set("model", e.target.value)}>
              {models.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </div>
        </Card>

        <Card id="budget" icon="wallet" title="Budget">
          <div className="row">
            <div className="t sp"><b>Monthly AWS budget</b><span>Warn at 80%, pause new builds at 100%</span></div>
            <label className="input mono" style={{ width: 110, display: "flex", gap: 2 }}>
              $<input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal" aria-label="Monthly AWS budget in USD"
                style={{ all: "unset", width: "100%" }} />
            </label>
          </div>
          <div className="row">
            <div className="t sp"><b>Kiro credits per build</b><span>Stop a build that goes over</span></div>
            <input className="input mono" style={{ width: 110 }} value={credits} onChange={(e) => setCredits(e.target.value)} inputMode="numeric"
              aria-label="Kiro credits per build" />
          </div>
        </Card>

        <Card id="cleanup" icon="timer" title="Cleanup">
          <div className="row">
            <div className="t sp"><b>Delete previews after</b><span>Also when merged</span></div>
            <select className="input" style={{ width: 130 }} aria-label="Delete previews after" value={p.previewDays}
              onChange={(e) => set("previewDays", Number(e.target.value))}>
              {(PREVIEW_DAYS.includes(p.previewDays) ? PREVIEW_DAYS : [...PREVIEW_DAYS, p.previewDays]).map((d) => <option key={d} value={d}>{d} days</option>)}
            </select>
          </div>
          <div className="row">
            <div className="t sp"><b>Delete apps after</b><span>For demos and trials</span></div>
            <select className="input" style={{ width: 130 }} aria-label="Delete apps after" value={p.autoDeleteHours ?? ""}
              onChange={(e) => set("autoDeleteHours", e.target.value ? Number(e.target.value) : null)}>
              {(APP_HOURS.some(([h]) => h === p.autoDeleteHours) ? APP_HOURS : [...APP_HOURS, [p.autoDeleteHours, `${p.autoDeleteHours} hours`] as [number, string]])
                .map(([h, t]) => <option key={String(h)} value={h ?? ""}>{t}</option>)}
            </select>
          </div>
        </Card>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 16, alignItems: "center" }}>
        <button type="button" className="btn" disabled={busy || !dirty} onClick={save}>Save changes</button>
        <button type="button" className="ghost" disabled={busy || !dirty} onClick={cancel}>Cancel</button>
        <span className="muted"><Icon n="scroll-text" s={13} /> Saved to the audit log</span>
        {msg ? <span className={msg.ok ? "muted" : "err"} role="status">{msg.text}</span> : null}
      </div>
    </>
  );
}
