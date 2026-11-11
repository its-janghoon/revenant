// Admin shell (flow2.js `adm`): header with the admin chip, side nav, body. Admins only:
// signed-out people go to sign in, signed-in members get a 404 (the area stays invisible).
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSettings } from "@/lib/policy";
import { Logo } from "@/lib/theme/logo";
import { ThemeSwitch } from "@/lib/theme/switch";
import { install, monthStart, spendByDay, usd } from "./data";
import { viewer } from "./guard";
import { Nav } from "./nav";
import "./admin.css";

export const dynamic = "force-dynamic";

const initials = (email: string) =>
  (email.split("@")[0] ?? "").split(/[._-]+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const v = await viewer();
  if (!v) redirect("/");
  if (!v.admin) notFound();
  const [days, settings] = await Promise.all([spendByDay(monthStart()), getSettings()]);
  const spent = days.reduce((a, d) => a + d.v, 0);
  return (
    <div className="rv-shell rv-admin">
      <header className="rv-header">
        <Logo />
        <span className="chip c-n">admin</span>
        <div className="rv-sp" />
        <span className="credits">
          <span className="rv-l">AWS this month</span><span className="rv-h">Bled this month</span> <b>{usd(spent)}</b> · budget {usd(settings.budgetUsd)}
        </span>
        <ThemeSwitch />
        <div className="avatar" title={v.email}>{initials(v.email)}</div>
      </header>
      <main className="rv-main adm">
        <Nav install={install()} />
        <div className="body">{children}</div>
      </main>
    </div>
  );
}
