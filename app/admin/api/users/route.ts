import { audit } from "@/lib/audit";
import { inviteBody } from "@/lib/contracts";
import { userSqlAll } from "@/lib/policy";
import { inviteUser, listUsers } from "../../cognito";
import { adminRoute, body } from "../../guard";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async () => {
  const [users, sql] = await Promise.all([listUsers(), userSqlAll()]);
  return Response.json(users.map(({ username: _, ...u }) => ({ ...u, sqlAllowed: sql.get(u.id) ?? null })));
});

// Invite: Cognito creates the user and emails the invite; admins also join the "admin" group.
export const POST = adminRoute(async (req, admin) => {
  const b = await body(req, inviteBody);
  const email = b.email.trim().toLowerCase();
  const { username: _, ...u } = await inviteUser(email, b.admin);
  await audit(admin.email, "user.invited", { user: email, admin: b.admin, userId: u.id });
  return Response.json(u, { status: 201 });
});
