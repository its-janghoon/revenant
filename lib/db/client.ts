// Drizzle over the RDS Data API. No VPC, no connection pool: every query is an HTTPS call
// signed with the compute role.
import "server-only";
import { RDSDataClient } from "@aws-sdk/client-rds-data";
import { drizzle } from "drizzle-orm/aws-data-api/pg";
import { env } from "../env";
import * as schema from "./schema";
import { wake } from "./wake";
import { times } from "./times";

export const db = drizzle(times(wake(new RDSDataClient({ region: env.AWS_REGION }))), {
  database: env.RV_DB_NAME,
  resourceArn: env.RV_DB_CLUSTER_ARN,
  secretArn: env.RV_DB_SECRET_ARN,
  schema,
});
export { schema };
