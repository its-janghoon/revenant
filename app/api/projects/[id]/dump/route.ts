import { z } from "zod";
import { needUser } from "@/app/_lib/auth";
import { envOf } from "@/app/_lib/dbenv";
import { HttpError, optionalBody, route } from "@/app/_lib/http";
import { findProject } from "@/app/_lib/store";
import { dumpStatus, startDump } from "@/lib/data/dump";

export const dynamic = "force-dynamic";

const dumpBody = z.object({ branch: z.string().regex(/^[A-Za-z0-9._/-]{1,100}$/).default("main"), build: z.string().max(200).optional() });

// pg_dump of an SQL app's database. { branch } starts one and answers { build };
// { build } answers its status: running, failed, or done with a presigned download url.
export const POST = route<{ id: string }>(async (req, { id }) => {
  const u = await needUser();
  const p = await findProject(u, id);
  const b = await optionalBody(req, dumpBody);
  const env = envOf(b.branch);
  if (b.build) return dumpStatus(p.name, b.build, env);
  try {
    return { status: "running", build: await startDump(p.name, env) };
  } catch (e) {
    if (/has no .* database/.test((e as Error).message)) throw new HttpError(409, "This app keeps its data in Amplify Data; export it from the AWS console (DynamoDB export).", "no_sql");
    throw e;
  }
});
