// What the studio shows for a project right now.
import type { Detail } from "@/app/_lib/types";
import type { Pulse } from "@/lib/haunt";

export const activeRun = (d: Detail) => d.runs.find((r) => r.status === "queued" || r.status === "running") ?? null;

export function pulse(d: Detail): Pulse {
  if (d.project.status === "dead") return "dead";
  if (d.project.status === "repairing") return "repair";
  if (activeRun(d) || d.project.status === "building") return "building";
  if (d.deploys[0] && (d.deploys[0].status === "running" || d.deploys[0].status === "pending")) return "deploying";
  if (d.project.status === "preview" || d.project.status === "live") return "alive";
  return "building";
}

/** Deploys are numbered in creation order, as on the Amplify console. */
export const deployNo = (d: Detail, id: string) => d.deploys.length - d.deploys.findIndex((x) => x.id === id);

export const previewNo = (branch: string) => /^preview\/(\d+)$/.exec(branch)?.[1] ?? null;

/** The branch a preview branch started from, for diffs: the previous preview, else the spec branch. */
export function baseOf(d: Detail, branch: string): string {
  const n = Number(previewNo(branch) ?? 0);
  if (!n) return "main";
  const older = d.previews.map((p) => Number(previewNo(p.branch) ?? 0)).filter((x) => x && x < n).sort((a, b) => b - a)[0];
  return older ? `preview/${older}` : "rv/spec";
}

export const fast = (d: Detail) => Boolean(activeRun(d)) || ["building", "repairing"].includes(d.project.status) || pulse(d) === "deploying";
