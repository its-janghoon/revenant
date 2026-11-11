import { pageProject } from "@/app/_lib/page";
import { detail } from "@/app/_lib/project";
import { listEvents } from "@/app/_lib/timeline";
import { Studio } from "@/components/studio/studio";

export const dynamic = "force-dynamic";

// /p/:id/timeline (design.md, "UI"): the studio opened on its Timeline tab.
export default async function TimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { u, p } = await pageProject((await params).id);
  const [d, events] = await Promise.all([detail(u, p), listEvents(p.id).catch(() => [])]);
  return <Studio initial={d} events={events} tab="timeline" />;
}
