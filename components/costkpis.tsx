"use client";
// Cost page KPIs from the cost lane's GET /api/cost (CostSummary in lib/contracts.ts).
import { useEffect, useState } from "react";
import type { CostSummary } from "@/lib/contracts";
import { Word } from "@/lib/theme/word";
import { api } from "./api";
import { usd } from "./format";

export function CostKpis({ kiroCredits, monthUsd }: { kiroCredits: number; monthUsd: number }) {
  const [c, setC] = useState<CostSummary | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { api<CostSummary>("/api/cost").then(setC).catch(() => setErr(true)); }, []);
  const items: [string, string][] = [
    [usd(c?.creditsLeftUsd ?? null, 0), "AWS credits left"],
    [usd(c?.monthUsd ?? monthUsd), "spent this month"],
    [usd(c?.forecastUsd ?? null, 0), `forecast · budget ${usd(c?.budgetUsd ?? null, 0)}`],
    [Math.round(kiroCredits).toLocaleString(), "Kiro credits this month"],
  ];
  return (
    <>
      <div className="grid4" style={{ marginBottom: 18 }}>
        {items.map(([n, t]) => <div key={t} className="card kpi"><div className="n">{n}</div><div className="t">{t}</div></div>)}
      </div>
      {err ? <div className="muted" style={{ marginTop: -8, marginBottom: 14, fontSize: 12 }}>Cost Explorer data is not ready yet; the table shows what Revenant recorded.</div> : null}
      {c?.overBudget ? <div className="card c-warn" style={{ marginBottom: 14 }}><Word k="overBudget" />. New builds stop at 100%.</div> : null}
    </>
  );
}
