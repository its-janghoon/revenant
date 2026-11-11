import { redirect } from "next/navigation";
import { needUser } from "@/app/_lib/auth";
import { cards } from "@/app/_lib/project";
import { getFlag } from "@/app/_lib/store";
import { AppCard } from "@/components/appcard";
import { Ask } from "@/components/ask";
import { W } from "@/components/words";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const u = await needUser();
  const apps = await cards(u);
  if (!apps.length && !(await getFlag(u, "onboarded"))) redirect("/welcome");
  return (
    <div className="page">
      <div className="wrap" style={{ maxWidth: 900, paddingTop: 56 }}>
        <h1 className="h" style={{ fontSize: 38, textAlign: "center", marginBottom: 6 }}><W k="homeTitle" /></h1>
        <div className="muted" style={{ textAlign: "center", marginBottom: 22 }}><W k="homeSub" /></div>
        <Ask />
        <div className="label" id="apps"><W k="yourApps" /></div>
        {apps.length ? (
          <div className="grid3">{apps.map((p) => <AppCard key={p.id} p={p} />)}</div>
        ) : (
          <div className="card empty">No apps yet. Describe one above, or pick an example.</div>
        )}
      </div>
    </div>
  );
}
