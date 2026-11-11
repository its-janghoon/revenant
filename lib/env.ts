// Server environment, validated once. Values are ARNs and names, never secrets:
// secrets live in Secrets Manager and are read at use time with the compute role.
import "server-only";
import { z } from "zod";
import outputs from "../amplify_outputs.json";

const schema = z.object({
  AWS_REGION: z.string().min(1),
  RV_KIRO_SECRET_ARN: z.string().startsWith("arn:aws:secretsmanager:"),
  RV_APP_SECRET_ARN: z.string().startsWith("arn:aws:secretsmanager:"),
  RV_BUDGET_USD: z.coerce.number().positive().default(100),
  RV_DEMO: z.enum(["on", "off"]).default("off"),
  RV_DB_CLUSTER_ARN: z.string().startsWith("arn:aws:rds:"),
  RV_DB_SECRET_ARN: z.string().startsWith("arn:aws:secretsmanager:"),
  RV_DB_NAME: z.string().min(1),
});

const db = (outputs as { custom?: { db?: { clusterArn: string; secretArn: string; database: string } } }).custom?.db;

export const env = schema.parse({
  ...process.env,
  AWS_REGION: process.env.AWS_REGION ?? outputs.auth.aws_region,
  RV_DB_CLUSTER_ARN: process.env.RV_DB_CLUSTER_ARN ?? db?.clusterArn,
  RV_DB_SECRET_ARN: process.env.RV_DB_SECRET_ARN ?? db?.secretArn,
  RV_DB_NAME: process.env.RV_DB_NAME ?? db?.database,
});
export type Env = z.infer<typeof schema>;
