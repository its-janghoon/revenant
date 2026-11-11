// A small Markdown renderer for spec files: headings, paragraphs, lists with checkboxes,
// tables, fenced code, inline code, bold, italic and links. Builds React nodes (no raw HTML).
import type { ReactNode } from "react";

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (m[1]) out.push(<code key={k}>{t.slice(1, -1)}</code>);
    else if (m[2]) out.push(<b key={k}>{inline(t.slice(2, -2), k)}</b>);
    else if (m[3]) out.push(<i key={k}>{inline(t.slice(1, -1), k)}</i>);
    else {
      const l = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(t)!;
      const href = /^(https?:|\/|#)/.test(l[2]!) ? l[2]! : "#";
      out.push(<a key={k} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">{l[1]}</a>);
    }
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let n = 0;
  while (i < lines.length) {
    const l = lines[i]!;
    const k = `b${n++}`;
    if (!l.trim()) { i++; continue; }
    const fence = /^```/.exec(l);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i]!)) body.push(lines[i++]!);
      i++;
      out.push(<pre key={k}><code>{body.join("\n")}</code></pre>);
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(l);
    if (h) {
      const level = Math.min(h[1]!.length, 4);
      const H = (`h${level}` as "h1" | "h2" | "h3" | "h4");
      out.push(<H key={k}>{inline(h[2]!, k)}</H>);
      i++;
      continue;
    }
    if (/^\s*\|/.test(l) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1]!)) {
      const head = cells(l);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i]!)) rows.push(cells(lines[i++]!));
      out.push(
        <table key={k}>
          <thead><tr>{head.map((c, j) => <th key={j}>{inline(c, `${k}h${j}`)}</th>)}</tr></thead>
          <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j}>{inline(c, `${k}r${ri}c${j}`)}</td>)}</tr>)}</tbody>
        </table>,
      );
      continue;
    }
    const li = /^(\s*)([-*+]|\d+\.)\s+(.*)$/;
    if (li.test(l)) {
      const ordered = /^\s*\d+\./.test(l);
      const items: ReactNode[] = [];
      while (i < lines.length && li.test(lines[i]!)) {
        const m = li.exec(lines[i]!)!;
        const indent = m[1]!.length;
        const box = /^\[([ xX-])\]\s+(.*)$/.exec(m[3]!);
        const cls = box ? (box[1] === " " ? "todo" : box[1] === "-" ? "todo run" : "todo done") : undefined;
        items.push(<li key={i} className={cls} style={indent ? { marginLeft: indent * 8 } : undefined}>{inline(box ? box[2]! : m[3]!, `${k}l${i}`)}</li>);
        i++;
      }
      out.push(ordered ? <ol key={k}>{items}</ol> : <ul key={k}>{items}</ul>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^(#{1,6}\s|```|\s*[-*+]\s|\s*\d+\.\s|\s*\|)/.test(lines[i]!)) para.push(lines[i++]!.trim());
    if (!para.length) { para.push(l.trim()); i++; }
    out.push(<p key={k}>{inline(para.join(" "), k)}</p>);
  }
  return <div className="md">{out}</div>;
}
