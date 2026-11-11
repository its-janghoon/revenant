// pg_dump export of an SQL app's database (Requirement 6.11), for POST /api/projects/:id/dump.
// The cluster stack has a CodeBuild project inside the database VPC (the only thing that can
// reach port 5432). It signs in as the read-only rv_dump role with a 15-minute IAM auth token
// and writes `<db>.dump` (pg_dump custom format, restore with pg_restore) to a private
// bucket that expires objects after 7 days. The user downloads it with a presigned URL.
import "server-only";
import { BatchGetBuildsCommand, CodeBuildClient, StartBuildCommand } from "@aws-sdk/client-codebuild";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Signer } from "@aws-sdk/rds-signer";
import { info } from "./cluster";
import { clusterOf, dbName, DUMP_USER, type DbEnv } from "./names";

export type DumpStatus =
  | { status: "running" }
  | { status: "failed"; reason: string }
  | { status: "done"; url: string; file: string };

let cb: CodeBuildClient | undefined;
let s3: S3Client | undefined;
const codebuild = () => (cb ??= new CodeBuildClient({}));
const storage = () => (s3 ??= new S3Client({}));

/** Starts a dump of <app>_<env> (default prod) and returns the CodeBuild build id. */
export async function startDump(app: string, env: DbEnv = "prod"): Promise<string> {
  const i = await info(app, clusterOf(env));
  if (!i) throw new Error(`${app} has no ${clusterOf(env)} database`);
  const database = dbName(app, env);
  const region = await codebuild().config.region();
  // The token is a SigV4 signature made here with the compute role (needs rds-db:connect
  // on dbuser:<cluster resource id>/rv_dump); it expires in 15 minutes and is read-only.
  const token = await new Signer({ hostname: i.host, port: 5432, username: DUMP_USER, region }).getAuthToken();
  const r = await codebuild().send(new StartBuildCommand({
    projectName: i.dumpProject,
    environmentVariablesOverride: [
      { name: "PGDATABASE", value: database, type: "PLAINTEXT" },
      { name: "PGPASSWORD", value: token, type: "PLAINTEXT" },
    ],
  }));
  const id = r.build?.id;
  if (!id) throw new Error("dump: CodeBuild returned no build id");
  return id;
}

export async function dumpStatus(app: string, buildId: string, env: DbEnv = "prod"): Promise<DumpStatus> {
  const i = await info(app, clusterOf(env));
  if (!i) return { status: "failed", reason: "database not found" };
  const r = await codebuild().send(new BatchGetBuildsCommand({ ids: [buildId] }));
  const b = r.builds?.[0];
  if (!b || b.projectName !== i.dumpProject) return { status: "failed", reason: "dump not found" };
  if (b.buildStatus === "IN_PROGRESS") return { status: "running" };
  if (b.buildStatus !== "SUCCEEDED") return { status: "failed", reason: `pg_dump ${String(b.buildStatus).toLowerCase()}` };

  // arn:aws:s3:::<bucket>/dumps/<build>/out
  const loc = (b.artifacts?.location ?? "").replace(/^arn:[^:]+:s3:::/, "");
  const slash = loc.indexOf("/");
  const bucket = loc.slice(0, slash);
  if (slash < 0 || bucket !== i.dumpBucket) return { status: "failed", reason: "dump file not found" };
  const file = `${dbName(app, env)}.dump`;
  const url = await getSignedUrl(
    storage(),
    new GetObjectCommand({ Bucket: bucket, Key: `${loc.slice(slash + 1)}/${file}`, ResponseContentDisposition: `attachment; filename="${file}"` }),
    { expiresIn: 3600 },
  );
  return { status: "done", url, file };
}
