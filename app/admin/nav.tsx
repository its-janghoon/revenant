"use client";
// Side nav (flow2.js adminNav). Kiro and Budget jump to their cards on the policy page.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "./icons";

type Item = [label: string, icon: IconName, href: string];
const GROUPS: [string, Item[]][] = [
  ["Workspace", [["Overview", "layout-dashboard", "/admin"], ["Users", "users", "/admin/users"], ["Apps", "boxes", "/admin/apps"]]],
  ["Rules", [["Policy", "shield-check", "/admin/policy"], ["Kiro", "brain", "/admin/policy#kiro"], ["Budget", "wallet", "/admin/policy#budget"]]],
  ["Records", [["Audit log", "scroll-text", "/admin/audit"]]],
];

export function Nav({ install }: { install: { version: string; region: string; account: string } }) {
  const path = usePathname();
  const [hash, setHash] = useState("");
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    on();
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, [path]);
  const here = path + (path === "/admin/policy" && (hash === "#kiro" || hash === "#budget") ? hash : "");
  return (
    <aside>
      {GROUPS.map(([g, items]) => (
        <div key={g} style={{ display: "contents" }}>
          <div className="grp">{g}</div>
          {items.map(([label, icon, href]) => (
            <Link key={href} href={href} className={href === here ? "on" : ""} aria-current={href === here ? "page" : undefined}
              onClick={() => setHash(href.includes("#") ? href.slice(href.indexOf("#")) : "")}>
              <Icon n={icon} /> {label}
            </Link>
          ))}
        </div>
      ))}
      <span className="sp" />
      <div className="card" style={{ padding: 12, fontSize: 12 }}>
        <b>Install</b>
        <div className="muted mono">v{install.version} · {install.region}</div>
        {install.account ? <div className="muted mono">acct {install.account}</div> : null}
      </div>
    </aside>
  );
}
