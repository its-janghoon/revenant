import { ExternalLink, Plus } from "lucide-react";
import Link from "next/link";
import { PREVIEW_MAX_AGE_DAYS } from "@/lib/contracts";
import { Heartbeat } from "@/lib/haunt";
import { pageProject } from "@/app/_lib/page";
import { detail } from "@/app/_lib/project";
import { ago, dur, usd } from "@/components/format";
import { Domain, Export } from "@/components/live";
import { StatusChip, W } from "@/components/words";

export const dynamic = "force-dynamic";

async function health(url: string | null): Promise<{ ok: boolean; code: number | null; ms: number | null }> {
  if (!url) return { ok: false, code: null, ms: null };
  const t = Date.now();
  try {
    const r = await fetch(url, { method: "GET", cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(5000) });
    return { ok: r.ok, code: r.status, ms: Date.now() - t };
  } catch {
    return { ok: false, code: null, ms: null };
  }
}

// Live app page (flow.html S.app): production, health, repairs, cost, previews.
export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const { u, p } = await pageProject((await params).id);
  const d = await detail(u, p);
  const amplifyUrl = d.project.amplifyAppId ? `https://main.${d.project.amplifyAppId}.amplifyapp.com` : null;
  const prod = d.project.prodUrl ?? amplifyUrl;
  const h = await health(prod);
  const ended = d.repairs.filter((r) => r.outcome !== "running");
  const recovered = ended.filter((r) => r.outcome === "recovered");
  const avg = recovered.length ? recovered.reduce((s, r) => s + (r.recoveredS ?? 0), 0) / recovered.length : null;
  const awsConsole = d.project.amplifyAppId ? `https://${d.region}.console.aws.amazon.com/amplify/apps/${d.project.amplifyAppId}/overview` : null;
  const status = (branch: string) => d.deploys.find((x) => x.branch === branch);
  const live = d.project.status === "live";

  return (
    <div className="page">
      <div className="wrap">
        <div className="crumbs"><Link href="/apps">Apps</Link> / {d.project.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
          <h1 className="h" style={{ fontSize: 30 }}>{d.project.name}</h1>
          {live ? <span className="chip c-ok"><W k="live" /></span> : <StatusChip status={d.project.status} />}
          <span className="sp" />
          <Link href={`/p/${p.id}/spec`} className="ghost">Open spec</Link>
          {awsConsole ? <a href={awsConsole} target="_blank" rel="noreferrer" className="ghost"><ExternalLink size={13} aria-hidden /> Open in AWS console</a> : null}
          <Link href={`/p/${p.id}`} className="btn"><Plus size={14} aria-hidden /> New change</Link>
        </div>
        <div className="grid4" style={{ marginBottom: 18 }}>
          <div className="card kpi"><div className="n">{usd(d.costUsd)}</div><div className="t">this month{d.creditUsd ? ` · ${usd(d.creditUsd)} from credits` : ""}</div></div>
          <div className="card kpi"><div className="n">{h.code ?? "--"}</div><div className="t">{h.ms !== null ? `health · ${h.ms} ms` : prod ? "health · no answer" : "not published"}</div></div>
          <div className="card kpi"><div className="n">{recovered.length} / {ended.length}</div><div className="t"><W k="repaired" /></div></div>
          <div className="card kpi"><div className="n">{dur(avg)}</div><div className="t"><W k="avgTtr" /></div></div>
        </div>
        <div className="grid2">
          <div className="card">
            <div className="label">Production</div>
            <Heartbeat state={!prod ? "building" : h.ok ? "alive" : "dead"} />
            <Domain projectId={p.id} />
            {prod ? (
              <div className="row"><div className="t sp"><b><a href={prod} target="_blank" rel="noreferrer">{prod.replace(/^https:\/\//, "")}</a></b><span>{prod === amplifyUrl ? "Amplify default" : "production URL"}</span></div>
                <span className={`chip ${h.ok ? "c-ok" : "c-bad"}`}>{h.ok ? "ok" : "down"}</span></div>
            ) : <div className="row"><div className="t sp"><b>Not published yet</b><span>Publish a preview to go live</span></div><Link href={`/p/${p.id}/publish`} className="ghost" style={{ padding: "4px 10px" }}>Publish</Link></div>}
            {amplifyUrl && prod !== amplifyUrl ? <div className="row"><div className="t sp"><b>{amplifyUrl.replace(/^https:\/\//, "")}</b><span>Amplify default</span></div></div> : null}
            <div className="row"><div className="t sp"><b>Data</b><span>{d.sqlAllowed ? "Amplify Data, Aurora when the spec needs SQL" : "Amplify Data"}</span></div><Export projectId={p.id} /></div>
          </div>
          <div className="card">
            <div className="label"><W k="previews" /></div>
            {d.previews.filter((x) => !x.deletedAt).length ? (
              <table>
                <thead><tr><th>Branch</th><th>Status</th><th>Age</th><th /></tr></thead>
                <tbody>
                  {d.previews.filter((x) => !x.deletedAt).map((x) => {
                    const dep = status(x.branch);
                    const left = PREVIEW_MAX_AGE_DAYS - (Date.now() - Date.parse(x.createdAt)) / 86_400_000;
                    const [c, s] = !dep ? ["c-n", "not deployed"] : dep.status === "live" ? (left < 1.5 ? ["c-n", `expires in ${Math.max(0, Math.ceil(left))} d`] : ["c-ok", "ready"]) : dep.status === "failed" ? ["c-bad", "failed"] : ["c-warn", "building"];
                    return (
                      <tr key={x.id}>
                        <td className="mono">{x.branch}</td>
                        <td><span className={`chip ${c}`}>{s}</span></td>
                        <td className="muted">{ago(x.createdAt)}</td>
                        <td className="muted">{dep?.url ? <a href={dep.url} target="_blank" rel="noreferrer">Open ›</a> : <Link href={`/p/${p.id}`}>Studio ›</Link>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : <div className="muted">No previews.</div>}
            <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>Previews are deleted {PREVIEW_MAX_AGE_DAYS} days after creation, or when merged.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
