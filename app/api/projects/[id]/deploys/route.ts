import { desc, eq } from "drizzle-orm";
import type { Deploy } from "@/lib/contracts";
import { db, schema } from "@/lib/db/client";
import { settleAll } from "@/lib/deploy";
import { guardProject } from "@/lib/deploy/access";

export const dynamic = "force-dynamic";

// Deploys of the project, newest first. Open deploys are moved on before the list is read.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardProject((await params).id);
  if ("error" in g) return g.error;
  await settleAll(g.project);
  const rows = await db.select().from(schema.deploys).where(eq(schema.deploys.projectId, g.project.id)).orderBy(desc(schema.deploys.createdAt)).limit(50);
  return Response.json(rows as Deploy[]);
}
