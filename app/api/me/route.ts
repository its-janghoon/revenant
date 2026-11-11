import { z } from "zod";
import { needUser } from "@/app/_lib/auth";
import { body, route } from "@/app/_lib/http";
import { getFlag, setFlag } from "@/app/_lib/store";
import type { Me } from "@/app/_lib/types";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const u = await needUser();
  const me: Me = { ...u, onboarded: Boolean(await getFlag(u, "onboarded")) };
  return me;
});

// Marks the one-screen onboarding as seen.
export const POST = route(async (req) => {
  const u = await needUser();
  const b = await body(req, z.object({ onboarded: z.literal(true) }));
  await setFlag(u, "onboarded", b.onboarded);
  return { ok: true };
});
