import { z } from "zod";
import { cleanup } from "@/lib/cleanup";
import { drain } from "@/lib/deploy/queue";
import { caller, forbidden, unauthorized } from "@/lib/cost/access";
import { costJob } from "@/lib/cost/job";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const query = z.enum(["all", "cost", "cleanup", "tick"]).default("all");

// Scheduled jobs, called with the app key (x-rv-key). The tick function (amplify/functions/tick)
// calls ?job=tick every 5 minutes: it starts queued deploys (lib/deploy/queue), runs cleanup in
// the first tick of each hour (judge auto-delete stays on time) and the cost job once a day
// ($0.02 per Cost Explorer run). ?job=all|cost|cleanup run those jobs by hand.
export async function POST(req: Request) {
  const who = await caller(req);
  if (!who) return unauthorized();
  if (who.kind !== "machine") return forbidden();
  const job = query.safeParse(new URL(req.url).searchParams.get("job") ?? undefined);
  if (!job.success) return Response.json({ error: "job must be all, cost, cleanup or tick" }, { status: 400 });

  const now = new Date();
  const hourly = now.getUTCMinutes() < 5;
  const daily = hourly && now.getUTCHours() === 0;
  const run = (name: "cost" | "cleanup") =>
    job.data === "all" || job.data === name || (job.data === "tick" && (name === "cleanup" ? hourly : daily));
  const [queue, cost, clean] = await Promise.allSettled([
    job.data === "tick" ? drain() : null,
    run("cost") ? costJob() : null,
    run("cleanup") ? cleanup() : null,
  ]);
  const value = <T,>(r: PromiseSettledResult<T>) => (r.status === "fulfilled" ? r.value : { error: (r.reason as Error).message });
  const ok = queue.status === "fulfilled" && cost.status === "fulfilled" && clean.status === "fulfilled" && !clean.value?.errors.length;
  return Response.json({ queue: value(queue), cost: value(cost), cleanup: value(clean) }, { status: ok ? 200 : 500 });
}
