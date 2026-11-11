import { z } from "zod";
import { cleanup } from "@/lib/cleanup";
import { caller, forbidden, unauthorized } from "@/lib/cost/access";
import { costJob } from "@/lib/cost/job";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const query = z.enum(["all", "cost", "cleanup"]).default("all");

// Scheduled jobs, called with the app key (x-rv-key). Once a day: ?job=all (Cost Explorer
// job + cleanup). Cleanup alone may run hourly (?job=cleanup) to keep the 24 h judge
// auto-delete on time; the cost job costs $0.02 per run, so keep it daily.
export async function POST(req: Request) {
  const who = await caller(req);
  if (!who) return unauthorized();
  if (who.kind !== "machine") return forbidden();
  const job = query.safeParse(new URL(req.url).searchParams.get("job") ?? undefined);
  if (!job.success) return Response.json({ error: "job must be all, cost or cleanup" }, { status: 400 });

  const run = (name: "cost" | "cleanup") => job.data === "all" || job.data === name;
  const [cost, clean] = await Promise.allSettled([run("cost") ? costJob() : null, run("cleanup") ? cleanup() : null]);
  const value = <T,>(r: PromiseSettledResult<T>) => (r.status === "fulfilled" ? r.value : { error: (r.reason as Error).message });
  const ok = cost.status === "fulfilled" && clean.status === "fulfilled" && !clean.value?.errors.length;
  return Response.json({ cost: value(cost), cleanup: value(clean) }, { status: ok ? 200 : 500 });
}
