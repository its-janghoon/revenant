import { pageProject } from "@/app/_lib/page";
import { detail, specView } from "@/app/_lib/project";
import { Spec } from "@/components/spec";

export const dynamic = "force-dynamic";

export default async function SpecPage({ params }: { params: Promise<{ id: string }> }) {
  const { u, p } = await pageProject((await params).id);
  const [d, s] = await Promise.all([detail(u, p), specView(p)]);
  return <Spec initial={d} spec={s} />;
}
