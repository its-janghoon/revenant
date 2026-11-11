import { account, region } from "@/app/_lib/aws";
import { needUser } from "@/app/_lib/auth";
import { route } from "@/app/_lib/http";
import { companyKeySet, ownKey } from "@/app/_lib/keys";
import { getSettings, sqlAllowedFor } from "@/app/_lib/store";
import type { SettingsView } from "@/app/_lib/types";

export const dynamic = "force-dynamic";

// The install's policy as it applies to the caller, and the state of their own Kiro key.
export const GET = route(async () => {
  const u = await needUser();
  const settings = await getSettings();
  const [own, company, sqlAllowed] = await Promise.all([ownKey(u), companyKeySet(), sqlAllowedFor(u, settings)]);
  const out: SettingsView = { settings, sqlAllowed, ownKey: { set: Boolean(own), updatedAt: own?.updatedAt ?? null }, companyKey: company, account, region };
  return out;
});
