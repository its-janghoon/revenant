// Reads the spec for the spec screen: plain summary, AWS parts and the cost estimate.
// No server-only import: the parsers are plain functions, tested by eye in the spec screen.

export interface Part { part: string; service: string; cost: string | null }

const money = /\$\s?\d[\d,]*(?:\.\d+)?/;

/** The "AWS parts and cost" section of design.md (a table or a list), as rows plus the total. */
export function parseParts(design: string | null): { parts: Part[]; totalUsd: string | null } {
  if (!design) return { parts: [], totalUsd: null };
  const lines = design.split("\n");
  const start = lines.findIndex((l) => /^#{1,4}\s.*aws parts/i.test(l));
  if (start < 0) return { parts: [], totalUsd: null };
  const level = /^(#+)/.exec(lines[start]!)?.[1]?.length ?? 2;
  const body: string[] = [];
  for (const l of lines.slice(start + 1)) {
    const h = /^(#+)\s/.exec(l);
    if (h && h[1]!.length <= level) break;
    body.push(l);
  }
  const parts: Part[] = [];
  let totalUsd: string | null = null;
  for (const raw of body) {
    const l = raw.trim();
    let cells: string[] = [];
    if (l.startsWith("|")) {
      cells = l.split("|").slice(1, -1).map((c) => c.trim().replace(/\*\*/g, ""));
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      if (cells.some((c) => /^(part|service|what|aws service)$/i.test(c))) continue; // header row
    } else {
      const m = /^[-*]\s+(?:\*\*)?([^:*]+?)(?:\*\*)?\s*[:—–-]\s+(.+)$/.exec(l);
      if (!m) {
        const t = /total[^$]*(\$\s?\d[\d,]*(?:\.\d+)?)/i.exec(l);
        if (t) totalUsd = t[1]!.replace(/\s/g, "");
        continue;
      }
      const rest = m[2]!;
      const cost = money.exec(rest)?.[0] ?? null;
      cells = [m[1]!, rest.replace(/\(?~?\s*\$\s?\d[\d,]*(?:\.\d+)?[^)]*\)?/, "").replace(/[,;·]\s*$/, "").trim(), cost ?? ""];
    }
    if (cells.length < 2) continue;
    const [a, b, ...more] = cells;
    const costCell = more.find((c) => money.test(c)) ?? (money.test(b!) ? b! : "");
    if (/^total/i.test(a!)) {
      totalUsd = money.exec(cells.join(" "))?.[0]?.replace(/\s/g, "") ?? totalUsd;
      continue;
    }
    parts.push({ part: a!, service: money.test(b!) && !more.length ? a! : b!, cost: money.exec(costCell)?.[0]?.replace(/\s/g, "") ?? null });
  }
  if (!totalUsd) {
    const t = body.map((l) => /total[^$]*(\$\s?\d[\d,]*(?:\.\d+)?)/i.exec(l)).find(Boolean);
    if (t) totalUsd = t[1]!.replace(/\s/g, "");
  }
  if (!totalUsd && parts.length) {
    const sum = parts.reduce((s, p) => s + Number((p.cost ?? "0").replace(/[$,]/g, "")), 0);
    if (sum > 0) totalUsd = `$${sum.toFixed(sum < 10 ? 2 : 0)}`;
  }
  return { parts, totalUsd };
}

/** Up to three plain sentences: the agent's own closing words, else the requirements' introduction. */
export function summarize(agentText: string | null, requirements: string | null): string[] {
  const sentences = (t: string) =>
    t.replace(/[#*`_>]/g, "").split(/\n+/).flatMap((l) => l.split(/(?<=[.!?])\s+/)).map((s) => s.trim()).filter((s) => s.length > 12);
  if (agentText) {
    const s = sentences(agentText);
    if (s.length) return s.slice(-3);
  }
  if (!requirements) return [];
  const lines = requirements.split("\n");
  const i = lines.findIndex((l) => /^#{1,3}\s*(introduction|overview|summary)/i.test(l));
  const from = i >= 0 ? lines.slice(i + 1) : lines.filter((l) => !/^#/.test(l));
  const para: string[] = [];
  for (const l of from) {
    if (/^#/.test(l)) break;
    if (l.trim()) para.push(l);
    if (para.length > 6) break;
  }
  return sentences(para.join("\n")).slice(0, 3);
}
