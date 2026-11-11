import { listAudit } from "@/lib/audit";
import { adminRoute } from "../../guard";

export const dynamic = "force-dynamic";

// ?limit=50&before=<at of the last row>
export const GET = adminRoute(async (req) => {
  const q = new URL(req.url).searchParams;
  const before = q.get("before");
  return Response.json(await listAudit({
    limit: Number(q.get("limit")) || 50,
    before: before && !Number.isNaN(Date.parse(before)) ? before : undefined,
  }));
});
