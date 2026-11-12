import { needUser } from "@/app/_lib/auth";
import { route } from "@/app/_lib/http";
import { findProject } from "@/app/_lib/store";
import { db } from "@/lib/db/client";
import { repairsFor } from "@/lib/repair/store";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (_req, { id }) => {
  const u = await needUser();
  const p = await findProject(u, id, { read: true });
  return { repairs: (await repairsFor(db, p.id)).slice(0, 30) };
});
