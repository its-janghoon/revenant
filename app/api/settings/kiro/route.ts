import { kiroKeyBody } from "@/lib/contracts";
import { needUser } from "@/app/_lib/auth";
import { body, route } from "@/app/_lib/http";
import { deleteOwnKey, saveOwnKey } from "@/app/_lib/keys";
import { db, schema } from "@/lib/db/client";

export const dynamic = "force-dynamic";

// The key goes straight to Secrets Manager; it is never stored elsewhere or sent back.
export const PUT = route(async (req) => {
  const u = await needUser();
  const k = await saveOwnKey(u, (await body(req, kiroKeyBody)).key.trim());
  await db.insert(schema.audit).values({ actor: u.sub, action: "kiro.own_key_set", detail: { user: u.email } });
  return { set: true, updatedAt: k.updatedAt };
});

export const DELETE = route(async () => {
  const u = await needUser();
  await deleteOwnKey(u);
  await db.insert(schema.audit).values({ actor: u.sub, action: "kiro.own_key_removed", detail: { user: u.email } });
  return { set: false, updatedAt: null };
});
