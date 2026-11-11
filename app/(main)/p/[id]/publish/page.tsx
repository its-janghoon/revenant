import { pageProject } from "@/app/_lib/page";
import { detail } from "@/app/_lib/project";
import { Publish } from "@/components/publish";

export const dynamic = "force-dynamic";

export default async function PublishPage({ params }: { params: Promise<{ id: string }> }) {
  const { u, p } = await pageProject((await params).id);
  return <Publish d={await detail(u, p)} />;
}
