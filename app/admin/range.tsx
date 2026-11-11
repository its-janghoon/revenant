"use client";
// "Last 30 days ▾" on the overview: sets ?days= and reloads the server data.
import { usePathname, useRouter } from "next/navigation";

const RANGES = [7, 30, 90];

export function Range({ days }: { days: number }) {
  const router = useRouter();
  const path = usePathname();
  return (
    <select className="pill" aria-label="Period" value={days} onChange={(e) => router.push(`${path}?days=${e.target.value}`)}>
      {RANGES.map((d) => <option key={d} value={d}>Last {d} days</option>)}
    </select>
  );
}
