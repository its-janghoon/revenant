import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { currentUser } from "@/app/_lib/auth";
import { Header } from "@/components/header";
import { HauntLayer } from "@/lib/haunt";
import "@/components/ui.css";

export const dynamic = "force-dynamic";

// Every signed-in screen: header over the page, haunt overlays once (no-ops in Light and Calm).
export default async function MainLayout({ children }: { children: ReactNode }) {
  const u = await currentUser();
  if (!u) redirect("/signin");
  return (
    <div className="shell">
      <Header user={{ email: u.email, name: u.name, admin: u.admin }} />
      <main className="rv-main">{children}</main>
      <HauntLayer />
    </div>
  );
}
