import { gunzipSync } from "node:zlib";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { env } from "$amplify/env/timeline";
import type { Schema } from "../../data/resource";
import { lineToEvent, parseLine, type TimelineEvent } from "../../../lib/contracts";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

interface LogsEvent { awslogs: { data: string } }
interface LogsPayload { messageType: string; logEvents: { message: string }[] }

// Input: a CloudWatch Logs subscription event, or `{ events: TimelineEvent[] }` from the app.
export const handler = async (input: LogsEvent | { events: TimelineEvent[] }) => {
  let events: TimelineEvent[];
  if ("awslogs" in input) {
    const p = JSON.parse(gunzipSync(Buffer.from(input.awslogs.data, "base64")).toString("utf8")) as LogsPayload;
    if (p.messageType !== "DATA_MESSAGE") return { written: 0 };
    events = p.logEvents.map((e) => parseLine(e.message)).filter((l) => l !== null).map(lineToEvent);
  } else {
    events = input.events;
  }
  for (const e of events) {
    const { errors } = await client.models.Event.create(e);
    // the same line delivered twice has the same key: skip it
    if (errors?.length && !errors.every((x) => /ConditionalCheckFailed/.test(x.errorType ?? x.message))) {
      throw new Error(errors.map((x) => x.message).join("; "));
    }
  }
  return { written: events.length };
};
