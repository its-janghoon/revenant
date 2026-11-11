// Line diff (LCS) for the chat's file cards, with a few lines of context around each change.

export type DLine = { op: " " | "+" | "-" | "…"; text: string };

export function diffLines(before: string, after: string, context = 2, max = 240): { lines: DLine[]; add: number; del: number } | null {
  const a = before.split("\n");
  const b = after.split("\n");
  // trim the common head and tail first so the table stays small
  let s = 0;
  while (s < a.length && s < b.length && a[s] === b[s]) s++;
  let ea = a.length;
  let eb = b.length;
  while (ea > s && eb > s && a[ea - 1] === b[eb - 1]) { ea--; eb--; }
  const A = a.slice(s, ea);
  const B = b.slice(s, eb);
  if (A.length * B.length > 4_000_000) return null;
  const n = A.length;
  const m = B.length;
  const L: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i]![j] = A[i] === B[j] ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!);
  const mid: DLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) { mid.push({ op: " ", text: A[i]! }); i++; j++; }
    else if (j < m && (i >= n || L[i]![j + 1]! >= L[i + 1]![j]!)) { mid.push({ op: "+", text: B[j]! }); j++; }
    else { mid.push({ op: "-", text: A[i]! }); i++; }
  }
  const all: DLine[] = [...a.slice(0, s).map((t) => ({ op: " " as const, text: t })), ...mid, ...a.slice(ea).map((t) => ({ op: " " as const, text: t }))];
  const keep = new Array<boolean>(all.length).fill(false);
  all.forEach((l, k) => {
    if (l.op === " ") return;
    for (let x = Math.max(0, k - context); x <= Math.min(all.length - 1, k + context); x++) keep[x] = true;
  });
  const lines: DLine[] = [];
  let gap = false;
  all.forEach((l, k) => {
    if (keep[k]) { lines.push(l); gap = false; }
    else if (!gap) { lines.push({ op: "…", text: "" }); gap = true; }
  });
  if (lines[0]?.op === "…") lines.shift();
  if (lines[lines.length - 1]?.op === "…") lines.pop();
  return {
    lines: lines.slice(0, max),
    add: mid.filter((l) => l.op === "+").length,
    del: mid.filter((l) => l.op === "-").length,
  };
}
