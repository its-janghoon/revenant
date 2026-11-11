// Applies lib/db/migrations to Revenant's database. Runs in the Amplify backend build
// right after `ampx pipeline-deploy` (see amplify.yml), with the Amplify service role.
// Usage: tsx lib/db/migrate.ts [path/to/amplify_outputs.json]
import { readFileSync } from "node:fs";
import { RDSDataClient } from "@aws-sdk/client-rds-data";
import { drizzle } from "drizzle-orm/aws-data-api/pg";
import { migrate } from "drizzle-orm/aws-data-api/pg/migrator";
import { wake } from "./wake";

const outputs = JSON.parse(readFileSync(process.argv[2] ?? "amplify_outputs.json", "utf8"));
const c = outputs.custom?.db as { clusterArn: string; secretArn: string; database: string } | undefined;
if (!c) throw new Error("amplify_outputs.json has no custom.db; did the backend deploy?");

const db = drizzle(wake(new RDSDataClient({ region: outputs.auth.aws_region })), {
  database: c.database,
  resourceArn: c.clusterArn,
  secretArn: c.secretArn,
});

// wake() retries while a paused cluster resumes.
await migrate(db, { migrationsFolder: "lib/db/migrations" });
console.log("migrations applied");
