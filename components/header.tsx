"use client";
// Header from the mockups: Pulse logo, Home / Apps / Cost, AWS credits, Light / Haunted, avatar menu.
import { signOut } from "aws-amplify/auth";
import { Boxes, Home, LogOut, Settings, Shield, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CostSummary } from "@/lib/contracts";
import { Logo, ThemeSwitch, Word } from "@/lib/theme";
import { api, usd } from "./api";
import { W } from "./words";

export interface HeaderUser { email: string; name: string; admin: boolean }

const initials = (u: HeaderUser) =>
  (u.name || u.email).split(/[\s._@-]+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join("") || "?";

export function Header({ user }: { user: HeaderUser }) {
  const path = usePathname();
  const [cost, setCost] = useState<CostSummary | null>(null);
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctl = new AbortController();
    api<CostSummary>("/api/cost", { signal: ctl.signal }).then(setCost).catch(() => setCost(null));
    return () => ctl.abort();
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const on = (href: string) => (href === "/" ? path === "/" : path.startsWith(href) || (href === "/apps" && path.startsWith("/p/")));
  const items = [["/", "Home", Home], ["/apps", "Apps", Boxes], ["/cost", "Cost", Wallet]] as const;

  return (
    <>
      <header className="rv-header">
        <Logo />
        <nav className="nav" aria-label="Main">
          {items.map(([href, label, Icon]) => (
            <Link key={href} href={href} className={on(href) ? "on" : ""} aria-current={on(href) ? "page" : undefined}>
              <Icon size={14} aria-hidden /> {label}
            </Link>
          ))}
        </nav>
        <div className="rv-sp" />
        {cost ? (
          <span className="credits">
            <W k="creditsLabel" /> <b>{usd(cost.creditsLeftUsd, 0)}</b> · {usd(cost.monthUsd)} <W k="thisMonth" />
          </span>
        ) : null}
        <ThemeSwitch />
        <div ref={menu} style={{ position: "relative" }}>
          <button type="button" className="avatar" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} title={user.email}>
            {initials(user)}
          </button>
          {open ? (
            <div className="menu" role="menu">
              <div className="who">{user.email}</div>
              <Link role="menuitem" href="/settings" onClick={() => setOpen(false)}><Settings size={14} aria-hidden /> Settings</Link>
              {user.admin ? <a role="menuitem" href="/admin"><Shield size={14} aria-hidden /> Admin</a> : null}
              <button role="menuitem" type="button" onClick={async () => { await signOut().catch(() => undefined); window.location.href = "/signin"; }}>
                <LogOut size={14} aria-hidden /> Sign out
              </button>
            </div>
          ) : null}
        </div>
      </header>
      {cost?.overBudget ? <div className="warnbar" role="status"><Word k="overBudget" />: {usd(cost.forecastUsd)} of the {usd(cost.budgetUsd, 0)} budget. New builds stop at 100%.</div> : null}
    </>
  );
}
