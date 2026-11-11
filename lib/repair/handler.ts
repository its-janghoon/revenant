// Lambda entry for the repair rules (construct.ts). The deploy side comes from lane L2:
//
//   // amplify/functions/repair/handler.ts
//   import { makeHandler } from "../../../lib/repair/handler";
//   import { deployer } from "../../../lib/deploy/...";
//   export const handler = makeHandler(deployer);
//
// Environment: RV_DB_CLUSTER_ARN, RV_DB_SECRET_ARN, RV_DB_NAME, RV_RUNNER_PROJECT,
// RV_PROMPT_BUCKET, RV_TIMELINE_FUNCTION, RV_KIRO_SECRET_ARN (AWS_REGION is set by Lambda).
import { RDSDataClient } from "@aws-sdk/client-rds-data";
import type { Context, EventBridgeEvent } from "aws-lambda";
import { drizzle } from "drizzle-orm/aws-data-api/pg";
import { z } from "zod";
import * as schema from "../db/schema";
import { times } from "../db/times";
import { wake } from "../db/wake";
import { awsPort, lambdaTimeline } from "./aws";
import { toSignal } from "./events";
import { handle } from "./loop";
import type { Deployer, Deps } from "./ports";
import { dbStore } from "./store";

const Env = z.object({
  AWS_REGION: z.string().min(1),
  RV_DB_CLUSTER_ARN: z.string().startsWith("arn:"),
  RV_DB_SECRET_ARN: z.string().startsWith("arn:"),
  RV_DB_NAME: z.string().min(1),
  RV_RUNNER_PROJECT: z.string().min(1),
  RV_PROMPT_BUCKET: z.string().min(1),
  RV_TIMELINE_FUNCTION: z.string().min(1),
  RV_KIRO_SECRET_ARN: z.string().startsWith("arn:"),
});

export function makeHandler(deployer: Deployer) {
  let deps: Deps | undefined;
  return async (event: EventBridgeEvent<string, Record<string, unknown>>, ctx: Context) => {
    if (!deps) {
      const env = Env.parse(process.env);
      const [, partition = "aws", , , account = ""] = ctx.invokedFunctionArn.split(":");
      const db = drizzle(times(wake(new RDSDataClient({ region: env.AWS_REGION }))), {
        database: env.RV_DB_NAME, resourceArn: env.RV_DB_CLUSTER_ARN, secretArn: env.RV_DB_SECRET_ARN, schema,
      });
      deps = {
        store: dbStore(db),
        aws: awsPort({ region: env.AWS_REGION, account, partition, runnerProject: env.RV_RUNNER_PROJECT, promptBucket: env.RV_PROMPT_BUCKET }),
        deployer,
        timeline: lambdaTimeline(env.AWS_REGION, env.RV_TIMELINE_FUNCTION),
        kiroSecretArn: env.RV_KIRO_SECRET_ARN,
      };
    }
    const sig = toSignal(event);
    if (!sig) return { result: "ignored" };
    const result = await handle(sig, deps);
    // ids and statuses only; no log contents
    console.log(JSON.stringify({ source: event.source, kind: sig.kind, result }));
    return { result };
  };
}
