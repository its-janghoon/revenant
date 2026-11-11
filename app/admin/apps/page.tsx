// Apps (flow2.js S.apps): every app with owner, data store, health, previews, this month's cost, repairs.
import { listUsers } from "../cognito";
import { listApps, monthStart, repairStats, spendByProject } from "../data";
import { Apps, type AppItem } from "./table";

export const dynamic = "force-dynamic";

export default async function AppsPage() {
  const [apps, users, spend, repairs] = await Promise.all([listApps(), listUsers(), spendByProject(monthStart()), repairStats()]);
  const names = new Map(users.map((u) => [u.id, u.name]));
  const now = Date.now();
  const items: AppItem[] = apps.map((a) => {
    const r = repairs.get(a.id);
    const left = a.expiresAt ? Date.parse(a.expiresAt) - now : null;
    const health: AppItem["health"] =
      left !== null && left <= 0 ? ["deleting", "c-n", "expiring"]
        : left !== null ? [`deletes in ${Math.max(1, Math.round(left / 3_600_000))} h`, "c-n", "expiring"]
          : a.status === "live" ? ["live", "c-ok", "live"]
            : a.status === "dead" ? ["failing", "c-bad", "failing"]
              : a.status === "stopped" ? ["stopped", "c-n", null]
                : [a.status, "c-warn", null];
    return {
      id: a.id, name: a.name, owner: names.get(a.owner) ?? "system", sql: a.sql, health, previews: a.previews,
      usd: spend.get(a.id) ?? 0, repairs: r && r.ok + r.lost ? `${r.ok} / ${r.ok + r.lost}` : "0", url: a.prodUrl,
    };
  });
  return <Apps items={items} />;
}
