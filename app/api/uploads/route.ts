import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import { names, s3 } from "@/app/_lib/aws";
import { needUser } from "@/app/_lib/auth";
import { HttpError, body, route } from "@/app/_lib/http";
import { UPLOADS } from "@/app/_lib/runs";

export const dynamic = "force-dynamic";

const MAX = 20 * 1024 * 1024;

// A presigned PUT for one attachment of a request. The file is copied under runs/<app>/ when a run starts.
export const POST = route(async (req) => {
  const u = await needUser();
  const b = await body(req, z.object({ name: z.string().min(1).max(200), type: z.string().max(100), size: z.number().int().positive().max(MAX) }));
  if (!names.promptBucket) throw new HttpError(503, "Attachments need RV_PROMPT_BUCKET on this install", "no_bucket");
  const safe = b.name.replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 120) || "file";
  const key = `${UPLOADS}${u.sub}/${randomUUID()}/${safe}`;
  const url = await getSignedUrl(s3, new PutObjectCommand({ Bucket: names.promptBucket, Key: key, ContentType: b.type || "application/octet-stream", ContentLength: b.size }), { expiresIn: 600 });
  return { key, url, name: b.name, type: b.type || "application/octet-stream" };
});
