// AWS clients and names for the screens lane. Credentials come from the compute role only.
import "server-only";
import { CodeBuildClient } from "@aws-sdk/client-codebuild";
import { CodeCommitClient } from "@aws-sdk/client-codecommit";
import { IAMClient } from "@aws-sdk/client-iam";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { S3Client } from "@aws-sdk/client-s3";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { env } from "@/lib/env";
import { outputs } from "@/lib/amplify";

const custom = (outputs as { custom?: { name?: string; runnerLogGroup?: string; timelineFunction?: string } }).custom ?? {};

export const region = env.AWS_REGION;
// arn:aws:secretsmanager:<region>:<account>:secret:...
export const account = env.RV_KIRO_SECRET_ARN.split(":")[4] ?? "";
export const partition = env.RV_KIRO_SECRET_ARN.split(":")[1] ?? "aws";

export const names = {
  install: custom.name ?? "rv-revenant-dev",
  // The shared runner CodeBuild project (runner/). Lane X creates it; override with RV_RUNNER_PROJECT.
  runnerProject: process.env.RV_RUNNER_PROJECT ?? "rv-runner",
  runnerLogGroup: custom.runnerLogGroup ?? `/rv/${custom.name ?? "rv-revenant-dev"}/runner`,
  // Prompts and attachments: runs/<app>/..., uploads/<user>/...
  promptBucket: process.env.RV_PROMPT_BUCKET ?? "",
  timelineFunction: custom.timelineFunction ?? `${custom.name ?? "rv-revenant-dev"}-timeline`,
  repo: (app: string) => `rv-${app}`,
  runnerRole: (app: string) => `rv-${app}-runner`,
  ownKey: (sub: string) => `rv/kiro/${sub}`,
};

export const codecommit = new CodeCommitClient({ region });
export const codebuild = new CodeBuildClient({ region });
export const secrets = new SecretsManagerClient({ region });
export const s3 = new S3Client({ region });
export const lambda = new LambdaClient({ region });
export const iam = new IAMClient({ region });
