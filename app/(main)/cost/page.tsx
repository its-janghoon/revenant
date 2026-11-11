import Link from "next/link";
import { needUser } from "@/app/_lib/auth";
import { cards } from "@/app/_lib/project";
import { CostKpis } from "@/components/costkpis";
import { usd } from "@/components/format";
import { W } from "@/components/words";

export const dynamic = "force-dynamic";

// Cost page (flow.html S.cost): credits, spend, forecast, and each app's share this month.
export default async function CostPage() {
  const u = await needUser();
  const apps = (await cards(u)).sort((a, b) => b.costUsd - a.costUsd);
  const top = Math.max(...apps.map((a) => a.costUsd), 0.0001);
  const month = apps.reduce((s, a) => s + a.costUsd, 0);
  const credits = apps.reduce((s, a) => s + a.kiroCredits, 0);
  return (
    <div className="page">
      <div className="wrap">
        <h1 className="h" style={{ fontSize: 30, marginBottom: 18 }}><W k="cost" /></h1>
        <CostKpis kiroCredits={credits} monthUsd={month} />
        <div className="card">
          {apps.length ? (
            <table>
              <thead><tr><th>App</th><th>AWS this month</th><th style={{ width: "34%" }}>Share</th><th>Kiro credits</th><th>Paid by credits</th></tr></thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id}>
                    <td><Link href={`/p/${a.id}/app`} style={{ textDecoration: "none" }}><b>{a.name}</b></Link></td>
                    <td className="mono">{usd(a.costUsd)}</td>
                    <td><div className="bar"><i style={{ width: `${(a.costUsd / top) * 100}%` }} /></div></td>
                    <td className="mono">{Math.round(a.kiroCredits).toLocaleString()}</td>
                    <td className="muted mono">{usd(a.creditUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="empty">No apps yet.</div>}
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>From Cost Explorer, grouped by the revenant:project tag. Updated daily.</div>
      </div>
    </div>
  );
}
