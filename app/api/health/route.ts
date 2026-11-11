import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";

// 200 when the app and its database answer. ?db=0 skips the database (it may be paused at 0 ACU).
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("db") === "0") return Response.json({ ok: true });
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, db: true });
  } catch (e) {
    return Response.json({ ok: false, db: false, error: (e as Error).name }, { status: 503 });
  }
}
