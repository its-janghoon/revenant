// Calls the broker Lambda (lib/broker/ops.ts) from the Revenant server. A refused or failed
// op comes back as an Error with the AWS error name, so callers handle it as before.
import "server-only";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { outputs } from "../amplify";
import { env } from "../env";
import type { Op, Reply } from "./ops";

const custom = (outputs as { custom?: { name?: string; broker?: string } }).custom ?? {};
const fn = process.env.RV_BROKER_FUNCTION ?? custom.broker ?? `${custom.name ?? "rv-revenant-dev"}-broker`;
const lambda = new LambdaClient({ region: env.AWS_REGION });

export async function broker<T = unknown>(op: Op): Promise<T> {
  const r = await lambda.send(new InvokeCommand({ FunctionName: fn, Payload: new TextEncoder().encode(JSON.stringify(op)) }));
  const text = r.Payload ? new TextDecoder().decode(r.Payload) : "";
  if (r.FunctionError) throw new Error(`broker ${op.op} crashed: ${text.slice(0, 300)}`);
  const out = JSON.parse(text) as Reply;
  if (!out.ok) {
    const e = new Error(out.message);
    e.name = out.name;
    throw e;
  }
  return out.value as T;
}
