import { needUser } from "@/app/_lib/auth";
import { route } from "@/app/_lib/http";
import { getSettings } from "@/lib/policy";
import { listLooks } from "@/lib/looks";

export const dynamic = "force-dynamic";

// The looks a user can pick: built-in presets and, when the admin set one, the company design.
export const GET = route(async () => {
  await needUser();
  return listLooks(await getSettings());
});
