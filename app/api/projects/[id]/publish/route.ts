import { z } from "zod";
import { plan, publish } from "@/lib/deploy";
import { fail, guardProject } from "@/lib/deploy/access";

export const dynamic = "force-dynamic";

const branch = z.string().regex(/^preview\/\d+$/).optional();
const publishBody = z.object({ branch }).default({});

// GET: what publishing would do (migration SQL, what would be lost, guardrail findings).
// ?branch=preview/<n> picks a preview; default is the latest live one.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardProject((await params).id);
  if ("error" in g) return g.error;
  const b = branch.safeParse(new URL(req.url).searchParams.get("branch") ?? undefined);
  if (!b.success) return fail(400, "branch must be preview/<n>");
  return Response.json(await plan(g.project, b.data));
}

// POST { branch? }: start the publish. 202 with the deploy; waiting_approval when destructive.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardProject((await params).id);
  if ("error" in g) return g.error;
  const text = await req.text();
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : undefined;
  } catch {
    return fail(400, "body must be JSON");
  }
  const body = publishBody.safeParse(raw);
  if (!body.success) return fail(400, "body must be { branch?: \"preview/<n>\" }");
  const r = await publish(g.project, g.caller.sub, body.data.branch);
  if ("error" in r) return Response.json({ error: r.error, plan: r.plan ?? null }, { status: r.status });
  return Response.json(r, { status: 202 });
}
