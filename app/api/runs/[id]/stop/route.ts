import { needUser } from "@/app/_lib/auth";
import { route } from "@/app/_lib/http";
import { findRun } from "@/app/_lib/run";
import { stopRun } from "@/app/_lib/runs";

export const dynamic = "force-dynamic";

export const POST = route<{ id: string }>(async (_req, { id }) => {
  const u = await needUser();
  await stopRun(await findRun(u, id));
  return { run: await findRun(u, id) };
});
