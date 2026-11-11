import { redirect } from "next/navigation";
import { pageProject } from "@/app/_lib/page";
import { detail } from "@/app/_lib/project";
import { listEvents } from "@/app/_lib/timeline";
import { Studio, type Tab } from "@/components/studio/studio";

export const dynamic = "force-dynamic";

const TABS = new Set<Tab>(["preview", "code", "spec", "data", "timeline"]);

export default async function StudioPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { u, p } = await pageProject((await params).id);
  const d = await detail(u, p);
  // before the first build the spec screen is the place to be
  if (d.project.status === "spec" && !d.runs.some((r) => r.mode !== "spec")) redirect(`/p/${p.id}/spec`);
  const events = await listEvents(p.id).catch(() => []);
  const t = (await searchParams).tab as Tab | undefined;
  return <Studio initial={d} events={events} tab={t && TABS.has(t) ? t : "preview"} />;
}
