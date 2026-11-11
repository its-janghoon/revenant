import { needCrew } from "@/app/_lib/auth";
import { crewEvents, origin } from "@/app/_lib/crew";
import { route } from "@/app/_lib/http";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const u = await needCrew(req);
  return crewEvents(origin(req), u, new URL(req.url).searchParams.get("since"));
});
