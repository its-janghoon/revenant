// Users (flow2.js S.users): everyone in the pool with role, Kiro payer, SQL, apps and this month's cost.
import { getSettings, ownKeyArn, userSqlAll } from "@/lib/policy";
import { listUsers } from "../cognito";
import { monthStart, ownerStats } from "../data";
import { currentAdmin } from "../guard";
import { Users, type UserRow } from "./table";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const [me, users, sql, stats, settings] = await Promise.all([
    currentAdmin(), listUsers(), userSqlAll(), ownerStats(monthStart()), getSettings(),
  ]);
  const own = await Promise.all(users.map((u) => (settings.kiroMode === "company" ? null : ownKeyArn(u.id).catch(() => null))));
  const rows: UserRow[] = users.map((u, i) => {
    const s = stats.get(u.id);
    const kiro = settings.kiroMode === "company" ? "company" : own[i] ? "own" : settings.kiroMode === "both" ? "company" : "not connected";
    return {
      id: u.id, name: u.name, email: u.email, admin: u.admin, status: u.status, kiro,
      sql: sql.get(u.id) ?? null, apps: s?.apps ?? 0, usd: s?.usd ?? 0, credits: s?.credits ?? 0, me: u.id === me?.sub,
    };
  });
  return <Users rows={rows} installSql={settings.sqlAllowed} />;
}
