import { lookCheckBody } from "@/lib/contracts";
import { needUser } from "@/app/_lib/auth";
import { body, route } from "@/app/_lib/http";
import { getSettings } from "@/lib/policy";
import { checkDesign, listLooks } from "@/lib/looks";

export const dynamic = "force-dynamic";

// The looks a user can pick: built-in presets and, when the admin set one, the company design.
export const GET = route(async () => {
  await needUser();
  return listLooks(await getSettings());
});

// Checks a DESIGN.md without saving it. Returns a DesignCheck.
export const POST = route(async (req) => {
  await needUser();
  return checkDesign((await body(req, lookCheckBody)).markdown);
});
