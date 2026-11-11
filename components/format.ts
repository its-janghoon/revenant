// Formatting for numbers and times. Plain functions: usable in server and client components.

export const usd = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined ? "--" : `$${n.toLocaleString("en-US", { minimumFractionDigits: n >= 1000 ? 0 : digits, maximumFractionDigits: n >= 1000 ? 0 : digits })}`;

export function ago(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} d`;
}

/** "5 min ago", "just now" */
export const since = (iso: string | null | undefined) => {
  const a = ago(iso);
  return a === "now" ? "just now" : a ? `${a} ago` : "";
};

export const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function dur(s: number | null | undefined): string {
  if (s === null || s === undefined) return "--";
  const m = Math.floor(s / 60);
  return m ? `${m}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`;
}
