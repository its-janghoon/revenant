// Looks: the built-in presets plus the company DESIGN.md the admin set (Settings.companyDesign).
// A project's look is simply the DESIGN.md at its repo root; `which` names it for the UI.
import type { Look, LooksView, Settings } from "../contracts";
import { checkDesign } from "./check";
import { PRESETS } from "./presets";

export { checkDesign } from "./check";
export { PRESETS, presetById } from "./presets";
export { seedDesign } from "./seed";

export const DESIGN_PATH = "DESIGN.md";

const presetLooks: Look[] = PRESETS.map((p) => ({ ...p, check: checkDesign(p.markdown) }));

export function listLooks(s: Pick<Settings, "companyDesign" | "companyDesignMode">): LooksView {
  const md = s.companyDesign?.trim() ? s.companyDesign : null;
  const company = md && s.companyDesignMode !== "off"
    ? { id: "company", name: checkDesign(md).name ?? "Company", blurb: "Set by your admin", markdown: md, check: checkDesign(md), mode: s.companyDesignMode }
    : null;
  return { presets: presetLooks, company };
}


const norm = (t: string) => t.replace(/\r\n/g, "\n").trim();

/** Names a DESIGN.md: "company" when it is the company file, a preset id when it is that preset unchanged, else "own". */
export function which(markdown: string | null, s: Pick<Settings, "companyDesign">): string | null {
  if (!markdown?.trim()) return null;
  const m = norm(markdown);
  if (s.companyDesign && norm(s.companyDesign) === m) return "company";
  return PRESETS.find((p) => norm(p.markdown) === m)?.id ?? "own";
}
