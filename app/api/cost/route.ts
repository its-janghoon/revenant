import { caller, unauthorized } from "@/lib/cost/access";
import { costSummary } from "@/lib/cost/summary";

export const dynamic = "force-dynamic";

// Home screen: AWS credits left, month to date, forecast, budget, and Kiro credits this
// month (the caller's own runs; machine callers and admins get every run).
export async function GET(req: Request) {
  const who = await caller(req);
  if (!who) return unauthorized();
  const owner = who.kind === "user" && !who.admin ? who.sub : undefined;
  try {
    return Response.json(await costSummary(new Date(), owner));
  } catch (e) {
    return Response.json({ error: (e as Error).name }, { status: 502 });
  }
}
