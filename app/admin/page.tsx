// Admin overview (flow2.js S.admin): 4 KPI cards with spark bars, top apps by cost, needs attention.
import Link from "next/link";
import { getSettings } from "@/lib/policy";
import { listUsers } from "./cognito";
import {
  creditsByDay, int, lastRepairs, listApps, monthStart, openPreviews, repairStats, repairsByDay, sinceDay, spark,
  spendByDay, spendByProject, today, usd,
} from "./data";
import { Icon, type IconName } from "./icons";
import { Range } from "./range";

export const dynamic = "force-dynamic";

const duration = (s: number) => `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, "0")}s`;
const model = (m: string) => (m === "auto" ? "Auto" : m);
const PAYER = { company: "company key", own: "own keys", both: "own or company key" } as const;

export default async function Overview({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const asked = Number((await searchParams).days);
  const days = [7, 30, 90].includes(asked) ? asked : 30;
  const since = sinceDay(days);

  const [settings, spend, credits, apps, previews, repairs, repairDays, byApp, monthDays, last, users] = await Promise.all([
    getSettings(), spendByDay(since), creditsByDay(since), listApps(), openPreviews(), repairStats(since), repairsByDay(since),
    spendByProject(since), spendByDay(monthStart()), lastRepairs(since), listUsers(),
  ]);
  const names = new Map(users.map((u) => [u.id, u.name]));
  const sum = (r: { v: number }[]) => r.reduce((a, x) => a + x.v, 0);

  // KPI: apps live, spark = apps that existed in each bucket
  const live = apps.filter((a) => a.status === "live").length;
  const created = apps.map((a) => ({ day: a.createdAt.slice(0, 10), v: 1 }));
  const appBars = (() => {
    const start = Date.parse(since);
    const pts = Array.from({ length: days }, (_, i) => {
      const day = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
      return { day, v: created.filter((c) => c.day <= day).length / days };
    });
    return spark(pts, days);
  })();

  // KPI: repairs
  let ok = 0, lost = 0, secs = 0;
  for (const r of repairs.values()) {
    ok += r.ok;
    lost += r.lost;
    secs += (r.avgS ?? 0) * r.ok;
  }

  const kpis: [string, IconName, string, string, number[]][] = [
    ["AWS spend", "dollar-sign", usd(sum(spend)), `of ${usd(settings.budgetUsd)} budget`, spark(spend, days)],
    ["Kiro credits", "brain", int(sum(credits)), `${model(settings.model)} · ${PAYER[settings.kiroMode]}`, spark(credits, days)],
    ["Apps live", "boxes", String(live), `${previews} preview${previews === 1 ? "" : "s"}`, appBars],
    ["Auto-repairs", "heart-pulse", ok + lost ? `${ok} / ${ok + lost}` : "0",
      ok ? `avg ${duration(secs / ok)} to recover` : "no repairs yet", spark(repairDays, days)],
  ];

  // Top apps by cost
  const top = apps
    .map((a) => ({ ...a, usd: byApp.get(a.id) ?? 0 }))
    .sort((a, b) => b.usd - a.usd)
    .slice(0, 4);
  const max = Math.max(...top.map((t) => t.usd), 0);

  // Needs attention
  const attention: [IconName, string, string, string][] = [];
  const month = monthDays.reduce((a, d) => a + d.v, 0);
  const now = today();
  const dayOfMonth = Number(now.slice(8, 10));
  const daysInMonth = new Date(Date.UTC(Number(now.slice(0, 4)), Number(now.slice(5, 7)), 0)).getUTCDate();
  const rate = month / dayOfMonth;
  const warnAt = settings.budgetUsd * 0.8;
  if (month >= settings.budgetUsd) attention.push(["alert-triangle", "c-bad", `Spend passed the budget: ${usd(month)} of ${usd(settings.budgetUsd)}. New builds are paused.`, "/admin/policy#budget"]);
  else if (month >= warnAt) attention.push(["alert-triangle", "c-warn", `Spend is at ${Math.round((month / settings.budgetUsd) * 100)}% of the budget`, "/admin/policy#budget"]);
  else if (rate * daysInMonth >= warnAt && rate > 0) {
    const hit = new Date(Date.parse(monthStart()) + (Math.ceil(warnAt / rate) - 1) * 86_400_000);
    attention.push(["alert-triangle", "c-warn", `Forecast hits 80% of budget on ${hit.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`, "/admin/policy#budget"]);
  }
  const invited = users.filter((u) => u.status === "invited").length;
  if (invited) attention.push(["user-plus", "c-n", `${invited} invite${invited === 1 ? "" : "s"} not accepted yet`, "/admin/users"]);
  for (const a of apps) {
    const r = last.get(a.id);
    if (r?.outcome === "gave_up") attention.push(["skull", "c-bad", `${a.name}: repair ${r.attempt} of 3 failed`, "/admin/apps"]);
    else if (a.status === "dead") attention.push(["skull", "c-bad", `${a.name}: deploy failed`, "/admin/apps"]);
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
        <div className="h title">Overview</div>
        <span className="sp" />
        <Range days={days} />
      </div>
      <div className="grid4" style={{ marginBottom: 16 }}>
        {kpis.map(([t, i, n, s, bars]) => (
          <div key={t} className="card kpi2">
            <div className="t"><Icon n={i} s={14} /> {t}</div>
            <div className="n">{n}</div>
            <div className="muted" style={{ fontSize: 12 }}>{s}</div>
            <div className="spark" aria-hidden="true">{bars.map((v, k) => <i key={k} style={{ height: `${v}%` }} />)}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        <div className="card" style={{ padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
            <b>Top apps by cost</b><span className="sp" /><Link href="/admin/apps" className="muted">View all ›</Link>
          </div>
          {top.length ? (
            <table>
              <tbody>
                {top.map((a) => (
                  <tr key={a.id}>
                    <td><b>{a.name}</b><div className="muted" style={{ fontSize: 11.5 }}>{names.get(a.owner) ?? "system"}</div></td>
                    <td style={{ width: "45%" }}><div className="bar"><i style={{ width: `${max ? Math.round((a.usd / max) * 100) : 0}%` }} /></div></td>
                    <td className="mono" style={{ textAlign: "right" }}>{usd(a.usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="muted" style={{ padding: "14px 0" }}>No apps yet.</div>}
        </div>
        <div className="card" style={{ padding: "16px 18px" }}>
          <b>Needs attention</b>
          {attention.length ? attention.map(([i, c, t, href]) => (
            <Link key={t} href={href} className="row">
              <span className={`chip ${c}`} style={{ padding: 5 }}><Icon n={i} s={13} /></span>
              <div className="t sp">{t}</div>
              <span className="muted">›</span>
            </Link>
          )) : <div className="row"><div className="t sp muted">Nothing needs you.</div></div>}
        </div>
      </div>
    </>
  );
}
