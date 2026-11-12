// The company DESIGN.md new apps start with. No linter import, so run code stays light.
import type { Settings } from "../contracts";

/** The company DESIGN.md, or null when the admin has none or it is off. */
export function seedDesign(s: Pick<Settings, "companyDesign" | "companyDesignMode">): string | null {
  return s.companyDesign?.trim() && s.companyDesignMode !== "off" ? s.companyDesign : null;
}
