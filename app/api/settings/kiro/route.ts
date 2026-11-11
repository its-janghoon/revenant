import { audit } from "@/lib/audit";
import { kiroKeyBody } from "@/lib/contracts";
import { needUser } from "@/app/_lib/auth";
import { body, route } from "@/app/_lib/http";
import { deleteOwnKey, saveOwnKey } from "@/app/_lib/keys";

export const dynamic = "force-dynamic";

// The key goes straight to Secrets Manager; it is never stored elsewhere or sent back.
export const PUT = route(async (req) => {
  const u = await needUser();
  const k = await saveOwnKey(u, (await body(req, kiroKeyBody)).key.trim());
  await audit(u.email || u.sub, "kiro.own_key_set", { user: u.email, userId: u.sub });
  return { set: true, updatedAt: k.updatedAt };
});

export const DELETE = route(async () => {
  const u = await needUser();
  await deleteOwnKey(u);
  await audit(u.email || u.sub, "kiro.own_key_removed", { user: u.email, userId: u.sub });
  return { set: false, updatedAt: null };
});
