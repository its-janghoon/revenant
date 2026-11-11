// Settings the deploy flow needs beyond lib/env.ts. ARNs only, never secrets.
import "server-only";
import { z } from "zod";

const schema = z.object({
  AWS_REGION: z.string().min(1).default("us-east-1"),
  // Amplify service role for generated apps (reads their CodeCommit repo, deploys their backend).
  RV_APPS_SERVICE_ROLE_ARN: z.string().startsWith("arn:aws:iam::").optional(),
  // SSR compute role for generated apps; per app roles can be passed to ensureApp instead.
  RV_APPS_COMPUTE_ROLE_ARN: z.string().startsWith("arn:aws:iam::").optional(),
  // Seconds the health check keeps trying after Amplify reports a deploy done.
  RV_HEALTH_WAIT_S: z.coerce.number().int().positive().default(20),
});

export const deployEnv = schema.parse(process.env);
