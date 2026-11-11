import { account, region } from "@/app/_lib/aws";
import { needUser } from "@/app/_lib/auth";
import { companyKeySet, ownKey } from "@/app/_lib/keys";
import { getSettings } from "@/app/_lib/store";
import { Welcome } from "@/components/welcome";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const u = await needUser();
  const s = await getSettings();
  const [own, company] = await Promise.all([ownKey(u), s.kiroMode === "own" ? Promise.resolve(false) : companyKeySet()]);
  const ok = Boolean(own) || company;
  const text = own ? "Your Kiro connected" : company ? "Kiro connected" : s.kiroMode === "own" ? "Connect your Kiro key" : "Kiro key missing";
  return <Welcome account={account} region={region} kiro={{ ok, text }} budgetUsd={s.budgetUsd} />;
}
