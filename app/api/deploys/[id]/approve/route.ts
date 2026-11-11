import { eq } from "drizzle-orm";
import { z } from "zod";
import { approveBody, type Deploy } from "@/lib/contracts";
import { db, schema } from "@/lib/db/client";
import { approve } from "@/lib/deploy";
import { fail, guardProject } from "@/lib/deploy/access";

export const dynamic = "force-dynamic";

// Approve or reject a publish that would replace or delete resources or data.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  if (!z.string().uuid().safeParse(id).success) return fail(404, "deploy not found");
  const body = approveBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail(400, "body must be { approve: boolean }");
  const [d] = await db.select().from(schema.deploys).where(eq(schema.deploys.id, id)).limit(1);
  if (!d) return fail(404, "deploy not found");
  const g = await guardProject(d.projectId);
  if ("error" in g) return fail(404, "deploy not found");
  if (d.status !== "waiting_approval") return fail(409, `deploy is ${d.status}, not waiting for approval`);
  const out = await approve(g.project, d as Deploy, body.data.approve, g.caller.sub);
  if (!out) return fail(409, "deploy was already decided");
  return Response.json(out);
}
