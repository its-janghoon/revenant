import { account, region } from "@/app/_lib/aws";
import { needUser } from "@/app/_lib/auth";
import { companyKeySet, ownKey } from "@/app/_lib/keys";
import { getSettings, sqlAllowedFor } from "@/app/_lib/store";
import type { SettingsView } from "@/app/_lib/types";
import { SettingsScreen } from "@/components/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const u = await needUser();
  const settings = await getSettings();
  const [own, company, sqlAllowed] = await Promise.all([ownKey(u), companyKeySet(), sqlAllowedFor(u, settings)]);
  const view: SettingsView = { settings, sqlAllowed, ownKey: { set: Boolean(own), updatedAt: own?.updatedAt ?? null }, companyKey: company, account, region };
  return <SettingsScreen initial={view} />;
}
