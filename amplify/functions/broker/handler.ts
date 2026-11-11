import type { Context } from "aws-lambda";
import { run, type Config, type Op, type Reply } from "../../../lib/broker/ops";

const env = (k: string) => process.env[k] || undefined;

export const handler = async (op: Op, ctx: Context): Promise<Reply> => {
  // arn:<partition>:lambda:<region>:<account>:function:<name>
  const [, partition = "aws", , region = process.env.AWS_REGION ?? "us-east-1", account = ""] = ctx.invokedFunctionArn.split(":");
  const c: Config = {
    partition, region, account,
    runnerProject: process.env.RV_RUNNER_PROJECT ?? "",
    runnerLogGroup: process.env.RV_RUNNER_LOG_GROUP ?? "",
    promptBucket: process.env.RV_PROMPT_BUCKET ?? "",
    kiroSecretArn: env("RV_KIRO_SECRET_ARN"),
    boundary: process.env.RV_RUNNER_BOUNDARY ?? "",
    basePolicy: env("RV_RUNNER_BASE_POLICY"),
    appsServiceRole: env("RV_APPS_SERVICE_ROLE_ARN"),
    appsComputeRole: env("RV_APPS_COMPUTE_ROLE_ARN"),
    dbStackRole: env("RV_DB_STACK_ROLE_ARN"),
    ownAppId: env("RV_OWN_APP_ID"),
  };
  try {
    return { ok: true, value: await run(op, c) };
  } catch (e) {
    const err = e as Error;
    console.error("broker", op.op, err.name, err.message);
    return { ok: false, name: err.name || "Error", message: err.message || "broker failed" };
  }
};
