import Link from "next/link";
import { Plus } from "lucide-react";
import { needUser } from "@/app/_lib/auth";
import { cards } from "@/app/_lib/project";
import { AppCard } from "@/components/appcard";
import { W } from "@/components/words";

export const dynamic = "force-dynamic";

export default async function AppsPage() {
  const u = await needUser();
  const apps = await cards(u);
  return (
    <div className="page">
      <div className="wrap">
        <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
          <h1 className="h" style={{ fontSize: 30 }}><W k="yourApps" /></h1>
          <span className="sp" />
          <Link href="/" className="btn"><Plus size={15} aria-hidden /> New app</Link>
        </div>
        {apps.length ? (
          <div className="grid3">{apps.map((p) => <AppCard key={p.id} p={p} />)}</div>
        ) : (
          <div className="card empty">No apps yet.</div>
        )}
      </div>
    </div>
  );
}
