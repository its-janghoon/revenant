// Screen words that change with the theme and are not in lib/theme/copy.ts yet.
// <W k="..."/> renders both; tokens.css shows the one for the current mode.
import type { ProjectStatus } from "@/lib/contracts";

export const WORDS = {
  signin: ["Sign in", "Enter the crypt"],
  signinSub: ["We email you an 8-digit code. No password.", "We send an 8-digit code by raven. No password."],
  sendCode: ["Email me a code", "Send the raven"],
  welcome: ["You're in. Let's make your first app.", "You're in. Let's raise your first app."],
  buildThis: ["Build this", "Raise this"],
  homeTitle: ["What should we build?", "What shall we raise tonight?"],
  homeSub: ["Kiro writes the spec, builds it, and deploys it to your AWS.", "Kiro writes the spell, raises it, and buries it in your AWS."],
  writeSpec: ["Write the spec", "Write the spell"],
  yourApps: ["Your apps", "Your graves"],
  plan: ["Here is the plan", "The grimoire"],
  askPlan: ["Ask for a change to the plan…", "Whisper a change to the spell…"],
  parts: ["AWS parts", "Bones"],
  estCost: ["Estimated cost", "Blood price"],
  buildIt: ["Build it", "Summon it"],
  askAny: ["Ask Revenant to change anything…", "Whisper a change…"],
  working: ["Working", "Summoning"],
  publishTitle: ["Publish {branch} to production", "Raise {branch} for the living"],
  approve: ["Approve and publish", "Seal the pact"],
  publishNow: ["Publish", "Raise it"],
  live: ["live", "risen"],
  previews: ["Previews", "Restless spirits"],
  repaired: ["repaired by agent", "raised by agent"],
  avgTtr: ["avg time to recover", "avg time in grave"],
  cost: ["Cost", "The toll"],
  creditsLabel: ["AWS credits", "Credits in the crypt"],
  thisMonth: ["this month", "bled"],
  settings: ["Settings", "The ledger"],
  writingSpec: ["Kiro is writing the spec", "Kiro is writing the spell"],
} as const satisfies Record<string, readonly [string, string]>;

export type WordKey = keyof typeof WORDS;

const fill = (s: string, vars?: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars?.[k] ?? ""));

export function W({ k, vars }: { k: WordKey; vars?: Record<string, string | number> }) {
  const [l, h] = WORDS[k];
  return (
    <>
      <span className="rv-l">{fill(l, vars)}</span>
      <span className="rv-h">{fill(h, vars)}</span>
    </>
  );
}

/** For attributes (placeholders) where both words cannot be rendered. */
export const pick = (k: WordKey, haunted: boolean) => WORDS[k][haunted ? 1 : 0];

const STATUS: Record<ProjectStatus, [string, string, string]> = {
  spec: ["Spec", "Grimoire", "c-n"],
  building: ["Building", "Summoning", "c-warn"],
  preview: ["Preview", "Restless", "c-warn"],
  live: ["Live", "Risen", "c-ok"],
  dead: ["Failed", "Dead", "c-bad"],
  repairing: ["Repairing", "Ritual", "c-bad"],
  stopped: ["Stopped", "Laid to rest", "c-n"],
  deleted: ["Deleted", "Buried", "c-n"],
};

export function StatusChip({ status }: { status: ProjectStatus }) {
  const [l, h, c] = STATUS[status];
  return (
    <span className={`chip ${c}`}>
      <span className="rv-l">{l}</span>
      <span className="rv-h">{h}</span>
    </span>
  );
}
