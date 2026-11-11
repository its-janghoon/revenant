import { desc, eq } from "drizzle-orm";
import type { Deploy } from "@/lib/contracts";
import { db, schema } from "@/lib/db/client";
import { previewsOf, type PreviewInfo } from "@/lib/deploy";
import { guardProject } from "@/lib/deploy/access";

export const dynamic = "force-dynamic";

// Preview branches of the project with the latest deploy of each.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardProject((await params).id);
  if ("error" in g) return g.error;
  const [previews, deploys] = await Promise.all([
    previewsOf(g.project.id),
    db.select().from(schema.deploys).where(eq(schema.deploys.projectId, g.project.id)).orderBy(desc(schema.deploys.createdAt)).limit(200),
  ]);
  const latest = new Map<string, Deploy>();
  for (const d of deploys) if (!latest.has(d.branch)) latest.set(d.branch, d as Deploy);
  const out: PreviewInfo[] = previews.map((p) => ({ ...p, deploy: latest.get(p.branch) ?? null }));
  return Response.json(out);
}
