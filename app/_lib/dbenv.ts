// Which of the app's databases a branch uses (lib/data/names.ts): main -> prod, preview/<n> -> pv<n>, else dev.
import "server-only";
import { previewEnv, type DbEnv } from "@/lib/data/names";

export function envOf(branch: string): DbEnv {
  if (branch === "main") return "prod";
  return /^preview\/\d+$/.test(branch) ? previewEnv(branch) : "dev";
}
