import { runReportBody } from "@/lib/contracts";
import { needMachine } from "@/app/_lib/auth";
import { body, route } from "@/app/_lib/http";
import { findRun } from "@/app/_lib/run";
import { endRun } from "@/app/_lib/runs";

export const dynamic = "force-dynamic";

// The runner (x-rv-key) reports how a run ended, with the Kiro credits it used.
export const POST = route<{ id: string }>(async (req, { id }) => {
  await needMachine(req);
  const b = await body(req, runReportBody);
  const r = await findRun(null, id);
  await endRun(r, b.status, undefined, { credits: b.credits, commit: b.commit });
  return { run: await findRun(null, id) };
});
