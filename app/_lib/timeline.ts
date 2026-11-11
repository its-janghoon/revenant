// Timeline (Amplify Data `Event`): written through the timeline function, read with the
// signed-in user's session after the owner check.
import "server-only";
import { InvokeCommand } from "@aws-sdk/client-lambda";
import { generateServerClientUsingCookies } from "@aws-amplify/adapter-nextjs/data";
import { cookies } from "next/headers";
import type { TimelineEvent, TimelineKind } from "@/lib/contracts";
import { outputs } from "@/lib/amplify";
import type { Schema } from "@/amplify/data/resource";
import { lambda, names } from "./aws";

export async function putEvents(events: TimelineEvent[]): Promise<void> {
  if (!events.length) return;
  try {
    await lambda.send(new InvokeCommand({
      FunctionName: names.timelineFunction,
      InvocationType: "Event",
      Payload: new TextEncoder().encode(JSON.stringify({ events })),
    }));
  } catch (e) {
    // The timeline is a record, not a gate: never fail the request over it.
    console.error("timeline write failed", (e as Error).name);
  }
}

let last = 0;
/** Unique, increasing ISO times (the timeline key is projectId + at). */
export function stamp(): string {
  const now = Math.max(Date.now(), last + 1);
  last = now;
  return new Date(now).toISOString();
}

export function event(projectId: string, kind: TimelineKind, body: Record<string, unknown>): TimelineEvent {
  return { projectId, at: stamp(), kind, text: JSON.stringify(body) };
}

export async function listEvents(projectId: string, since?: string): Promise<TimelineEvent[]> {
  const client = generateServerClientUsingCookies<Schema>({ config: outputs, cookies });
  const out: TimelineEvent[] = [];
  let nextToken: string | null | undefined;
  do {
    const r = await client.models.Event.list({
      projectId,
      ...(since ? { at: { gt: since } } : {}),
      sortDirection: "ASC",
      limit: 500,
      nextToken,
    });
    for (const e of r.data) out.push({ projectId: e.projectId, at: e.at, kind: (e.kind ?? "message") as TimelineKind, text: e.text });
    nextToken = r.nextToken;
  } while (nextToken && out.length < 2000);
  return out;
}
