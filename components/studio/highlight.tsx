// Tiny syntax colors for the Code tab (k keyword, s string, f function or component, c comment).
import type { ReactNode } from "react";

const KW = new Set("import export from default const let var function return async await if else for while of in new class extends type interface as typeof null undefined true false try catch finally throw switch case break continue".split(" "));
const TOKEN = /(\/\/.*$|\/\*[^]*?\*\/|#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(<\/?[A-Z][\w.]*)|\b([A-Za-z_$][\w$]*)(?=\s*\()|\b([a-z]+)\b/gm;

export function highlight(code: string, lang: string): ReactNode[] {
  if (code.length > 200_000) return [code];
  const hash = lang === "py" || lang === "sh" || lang === "yml" || lang === "yaml" || lang === "toml";
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of code.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    let cls = "";
    const text = m[0];
    if (m[1]) {
      if (m[1].startsWith("#") && !hash) continue;
      cls = "c";
    } else if (m[2]) cls = "s";
    else if (m[3]) {
      // keep "<" or "</" plain, color the name
      const p = m[3].startsWith("</") ? 2 : 1;
      if (at > last) out.push(code.slice(last, at));
      out.push(m[3].slice(0, p));
      out.push(<span key={n++} className="f">{m[3].slice(p)}</span>);
      last = at + m[0].length;
      continue;
    } else if (m[4]) cls = KW.has(m[4]) ? "k" : "f";
    else if (m[5] && KW.has(m[5])) cls = "k";
    if (!cls) continue;
    if (at > last) out.push(code.slice(last, at));
    out.push(<span key={n++} className={cls}>{text}</span>);
    last = at + text.length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

export const langOf = (path: string) => path.split(".").pop()?.toLowerCase() ?? "";
