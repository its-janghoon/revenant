// AWS clients and names for the screens lane. Credentials come from the compute role only.
import "server-only";
import { CloudWatchLogsClient } from "@aws-sdk/client-cloudwatch-logs";
import { CodeBuildClient } from "@aws-sdk/client-codebuild";
import { CodeCommitClient } from "@aws-sdk/client-codecommit";
import { IAMClient } from "@aws-sdk/client-iam";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { S3Client } from "@aws-sdk/client-s3";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { env } from "@/lib/env";
import { outputs } from "@/lib/amplify";

interface Custom {
  name?: string;
  runnerLogGroup?: string;
  timelineFunction?: string;
  runner?: { project?: string; promptBucket?: string; basePolicyArn?: string; boundaryArn?: string };
}
const custom = (outputs as { custom?: Custom }).custom ?? {};

export const region = env.AWS_REGION;
// arn:aws:secretsmanager:<region>:<account>:secret:...
export const account = env.RV_KIRO_SECRET_ARN.split(":")[4] ?? "";
export const partition = env.RV_KIRO_SECRET_ARN.split(":")[1] ?? "aws";

export const names = {
  install: custom.name ?? "rv-revenant-dev",
  // The shared runner CodeBuild project (runner/), from amplify/backend.ts.
  runnerProject: process.env.RV_RUNNER_PROJECT ?? custom.runner?.project ?? `${custom.name ?? "rv-revenant-dev"}-runner`,
  // Every rv-<app>-runner role gets the base policy and must carry the boundary.
  runnerBasePolicy: custom.runner?.basePolicyArn ?? "",
  runnerBoundary: custom.runner?.boundaryArn ?? "",
  runnerLogGroup: custom.runnerLogGroup ?? `/rv/${custom.name ?? "rv-revenant-dev"}/runner`,
  // Prompts and attachments: runs/<app>/<run>/..., uploads under runs/_uploads/<user>/...
  promptBucket: process.env.RV_PROMPT_BUCKET ?? custom.runner?.promptBucket ?? "",
  timelineFunction: process.env.RV_TIMELINE_FUNCTION ?? custom.timelineFunction ?? `${custom.name ?? "rv-revenant-dev"}-timeline`,
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
export const logs = new CloudWatchLogsClient({ region });
