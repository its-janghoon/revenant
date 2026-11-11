// Audit log (flow2.js S.audit): every admin change, newest first, 50 per page.
import Link from "next/link";
import { listAudit, type AuditDetail } from "@/lib/audit";
import { displayName } from "../cognito";

export const dynamic = "force-dynamic";

const PAGE = 50;

function when(at: string): string {
  const d = new Date(at);
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  const sameDay = d.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
  return sameDay ? time : `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} ${time}`;
}

const who = (actor: string) => (actor.includes("@") ? displayName(actor).split(" ")[0] ?? actor : actor);

const show = (v: unknown) => (v === null ? "off" : typeof v === "string" ? v : JSON.stringify(v));

function detail(d: AuditDetail | null): string {
  if (!d) return "";
  if (typeof d.text === "string") return d.text;
  if ("from" in d && "to" in d) return `${show(d.from)} → ${show(d.to)}`;
  return Object.entries(d)
    .filter(([k]) => k !== "userId" && k !== "projectId")
    .map(([, v]) => show(v))
    .join(" · ");
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ before?: string }> }) {
  const raw = (await searchParams).before;
  const before = raw && !Number.isNaN(Date.parse(raw)) ? raw : undefined;
  const rows = await listAudit({ limit: PAGE, before });
  const last = rows.at(-1);
  return (
    <>
      <div className="h title" style={{ marginBottom: 16 }}>Audit log</div>
      <div className="card" style={{ padding: "4px 8px" }}>
        <table>
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Detail</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono muted" title={`${r.at} UTC`}>{when(r.at)}</td>
                <td title={r.actor}>{who(r.actor)}</td>
                <td className="mono">{r.action}</td>
                <td className="muted">{detail(r.detail)}</td>
              </tr>
            ))}
            {rows.length ? null : <tr><td colSpan={4} className="muted">No changes yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        {before ? <Link className="ghost" href="/admin/audit">Newest</Link> : null}
        {rows.length === PAGE && last ? <Link className="ghost" href={`/admin/audit?before=${encodeURIComponent(last.at)}`}>Older ›</Link> : null}
      </div>
    </>
  );
}
