// Server-side timeline events: the timeline function takes `{ events }` (amplify/functions/timeline).
import "server-only";
import { InvokeCommand } from "@aws-sdk/client-lambda";
import type { TimelineEvent, TimelineKind } from "../contracts";
import { outputs } from "../amplify";
import { lambda } from "./aws";

const fn = (outputs as { custom?: { timelineFunction?: string } }).custom?.timelineFunction;

let last = 0;
/** ISO time with ms that never repeats in this process, so two events never share a key. */
function at(): string {
  last = Math.max(Date.now(), last + 1);
  return new Date(last).toISOString();
}

/** Writes one event. A failure to log never fails the deploy step that called it. */
export async function event(projectId: string, kind: TimelineKind, body: string | Record<string, unknown>): Promise<void> {
  if (!fn) return;
  const e: TimelineEvent = { projectId, at: at(), kind, text: typeof body === "string" ? body : JSON.stringify(body) };
  try {
    await lambda.send(new InvokeCommand({ FunctionName: fn, InvocationType: "Event", Payload: new TextEncoder().encode(JSON.stringify({ events: [e] })) }));
  } catch (err) {
    console.error("timeline event not written", kind, (err as Error).name);
  }
}
