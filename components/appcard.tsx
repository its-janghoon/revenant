// One app on the home and apps screens: name, status, cost this month, what it is doing.
import Link from "next/link";
import type { ProjectCard } from "@/app/_lib/types";
import { usd } from "./api";
import { StatusChip } from "./words";

function line(p: ProjectCard): string {
  if (p.status === "building" && p.tasksTotal) return `task ${Math.min(p.tasksDone + 1, p.tasksTotal)} / ${p.tasksTotal}`;
  if (p.status === "repairing" && p.repairAttempt) return `repair ${p.repairAttempt} / 3`;
  if (p.status === "spec") return "spec";
  return `${p.previews} preview${p.previews === 1 ? "" : "s"}`;
}

export function AppCard({ p }: { p: ProjectCard }) {
  const href = p.status === "spec" ? `/p/${p.id}/spec` : p.status === "live" ? `/p/${p.id}/app` : `/p/${p.id}`;
  return (
    <Link href={href} className="card appcard">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <b style={{ fontSize: 14 }}>{p.name}</b>
        <StatusChip status={p.status} />
      </div>
      <div className="mono muted" style={{ marginTop: 8 }}>{usd(p.costUsd)} this month · {line(p)}</div>
    </Link>
  );
}
