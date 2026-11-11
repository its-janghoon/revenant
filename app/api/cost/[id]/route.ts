import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db/client";
import { caller, forbidden, unauthorized } from "@/lib/cost/access";
import { projectCost } from "@/lib/cost/summary";

export const dynamic = "force-dynamic";

// One project's month-to-date AWS cost from its tags, plus its Kiro credits.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await caller(req);
  if (!who) return unauthorized();
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return Response.json({ error: "bad id" }, { status: 400 });

  const [p] = await db.select({ owner: schema.projects.owner }).from(schema.projects).where(eq(schema.projects.id, id.data));
  if (!p) return Response.json({ error: "not found" }, { status: 404 });
  if (who.kind === "user" && !who.admin && who.sub !== p.owner) return forbidden();

  return Response.json(await projectCost(id.data));
}
