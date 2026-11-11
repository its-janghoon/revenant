// App shell: header (logo, breadcrumb, slot for credits, theme switches) over the page.
// Screens render inside: <Shell crumb={<b>fineprint</b>} right={<Credits />}>...</Shell>
import type { ReactNode } from "react";
import { Logo } from "./logo";
import { ThemeSwitch } from "./switch";

export function Shell({ crumb, right, children }: { crumb?: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="rv-shell">
      <header className="rv-header">
        <Logo />
        {crumb ? <div className="rv-crumb">/ {crumb}</div> : null}
        <div className="rv-sp" />
        {right}
        <ThemeSwitch />
      </header>
      <main className="rv-main">{children}</main>
    </div>
  );
}
