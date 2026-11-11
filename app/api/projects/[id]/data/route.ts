import { needUser } from "@/app/_lib/auth";
import { envOf } from "@/lib/console/name";
import { bad, route } from "@/app/_lib/http";
import { findProject, workBranch } from "@/app/_lib/store";
import { summary } from "@/lib/data/records";

export const dynamic = "force-dynamic";

// Data tab: record counts per Amplify Data model, and per SQL table when the app has Aurora.
// ?branch= picks the database: main -> prod, preview/<n> -> that preview, else dev.
export const GET = route<{ id: string }>(async (req, { id }) => {
  const u = await needUser();
  const p = await findProject(u, id);
  const branch = new URL(req.url).searchParams.get("branch") || (await workBranch(p.id));
  if (!/^[A-Za-z0-9._/-]{1,100}$/.test(branch)) throw bad("Bad branch");
  return { branch, ...(await summary(p.name, envOf(branch))) };
});
