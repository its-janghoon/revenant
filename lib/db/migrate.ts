// Applies lib/db/migrations to Revenant's database. Runs in the Amplify backend build
// right after `ampx pipeline-deploy` (see amplify.yml), with the Amplify service role.
// Usage: tsx lib/db/migrate.ts [path/to/amplify_outputs.json]
import { readFileSync } from "node:fs";
import { RDSDataClient } from "@aws-sdk/client-rds-data";
import { drizzle } from "drizzle-orm/aws-data-api/pg";
import { migrate } from "drizzle-orm/aws-data-api/pg/migrator";

const outputs = JSON.parse(readFileSync(process.argv[2] ?? "amplify_outputs.json", "utf8"));
const c = outputs.custom?.db as { clusterArn: string; secretArn: string; database: string } | undefined;
if (!c) throw new Error("amplify_outputs.json has no custom.db; did the backend deploy?");

const db = drizzle(new RDSDataClient({ region: outputs.auth.aws_region }), {
  database: c.database,
  resourceArn: c.clusterArn,
  secretArn: c.secretArn,
});

// Aurora at 0 ACU is paused; the first Data API call wakes it and may fail while it resumes.
for (let i = 1; ; i++) {
  try {
    await migrate(db, { migrationsFolder: "lib/db/migrations" });
    console.log("migrations applied");
    break;
  } catch (e) {
    const name = (e as { name?: string }).name ?? "";
    if (i >= 10 || !/DatabaseResuming|DatabaseNotFound|ServiceUnavailable|BadRequest/.test(name)) throw e;
    console.log(`database waking up (${name}), retry ${i}`);
    await new Promise((r) => setTimeout(r, 15_000));
  }
}
