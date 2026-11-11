import { listApps, monthStart, repairStats, spendByProject } from "../../data";
import { adminRoute } from "../../guard";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async () => {
  const [apps, spend, repairs] = await Promise.all([listApps(), spendByProject(monthStart()), repairStats()]);
  return Response.json(apps.map((a) => ({
    ...a,
    monthUsd: spend.get(a.id) ?? 0,
    repairs: repairs.get(a.id) ?? { ok: 0, lost: 0, avgS: null },
  })));
});
