// Preview builds only (NEXT_PUBLIC_RV_INSPECT=1): tag every plain HTML element in app/ and
// components/ with data-rv="<file>:<line>", so Select mode in Revenant can show where an element
// comes from. Runs on the build machine's copy; nothing is committed.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

if (process.env.NEXT_PUBLIC_RV_INSPECT !== "1") process.exit(0);

const ROOTS = ["app", "components"].filter((d) => { try { return statSync(d).isDirectory(); } catch { return false; } });
const TAGS = "div|section|main|header|footer|nav|aside|article|form|button|a|span|p|h1|h2|h3|h4|h5|h6|img|input|textarea|select|label|ul|ol|li|table|tr|td|th";
const OPEN = new RegExp(`<(${TAGS})(?=[\\s>/])(?![^>]*\\bdata-rv=)`, "g");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|jsx)$/.test(name)) out.push(p);
  }
  return out;
}

let n = 0;
for (const file of ROOTS.flatMap((d) => walk(d))) {
  const rel = relative(process.cwd(), file);
  const lines = readFileSync(file, "utf8").split("\n");
  const out = lines.map((line, i) => line.replace(OPEN, (_m, tag) => { n++; return `<${tag} data-rv="${rel}:${i + 1}"`; }));
  writeFileSync(file, out.join("\n"));
}
console.log(`rv-annotate: tagged ${n} elements`);
