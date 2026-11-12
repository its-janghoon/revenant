import { needUser } from "@/app/_lib/auth";
import { route } from "@/app/_lib/http";
import { findProject } from "@/app/_lib/store";
import { listEvents } from "@/app/_lib/timeline";

export const dynamic = "force-dynamic";

// ?since=<ISO time> returns only newer events, oldest first.
export const GET = route<{ id: string }>(async (req, { id }) => {
  const u = await needUser();
  const p = await findProject(u, id, { read: true });
  const since = new URL(req.url).searchParams.get("since") ?? undefined;
  return { events: await listEvents(p.id, since && !Number.isNaN(Date.parse(since)) ? since : undefined) };
});
