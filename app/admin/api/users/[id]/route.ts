import { audit } from "@/lib/audit";
import { userPatchBody } from "@/lib/contracts";
import { clearUser, deleteOwnKey, setUserSql } from "@/lib/policy";
import { deleteUser, findUser, setDisabled } from "../../../cognito";
import { adminRoute, body, HttpError } from "../../../guard";

export const dynamic = "force-dynamic";

type P = { id: string };

// { disabled } turns sign-in off or on; { sqlAllowed: true | false | null } sets the per-user SQL override.
export const PATCH = adminRoute<P>(async (req, admin, { id }) => {
  const b = await body(req, userPatchBody);
  const u = await findUser(id);
  if (b.disabled !== undefined && u.id === admin.sub) throw new HttpError(400, "you cannot disable yourself");
  if (b.sqlAllowed !== undefined) await setUserSql(u.id, b.sqlAllowed, admin.email, u.email);
  if (b.disabled !== undefined && b.disabled !== (u.status === "disabled")) {
    await setDisabled(u, b.disabled);
    await audit(admin.email, b.disabled ? "user.disabled" : "user.enabled", { user: u.email, userId: u.id });
  }
  return Response.json({ ok: true });
});

// Deletes the Cognito user, their SQL override and their own Kiro key. Their apps keep running.
export const DELETE = adminRoute<P>(async (_req, admin, { id }) => {
  const u = await findUser(id);
  if (u.id === admin.sub) throw new HttpError(400, "you cannot delete yourself");
  await deleteUser(u);
  await Promise.all([clearUser(u.id), deleteOwnKey(u.id)]);
  await audit(admin.email, "user.deleted", { user: u.email, userId: u.id });
  return Response.json({ ok: true });
});
