// Policy (flow2.js S.policy): Databases, Kiro, Budget, Cleanup. Changes apply to the next build.
import { getPolicy, userSqlAll } from "@/lib/policy";
import { listUsers } from "../cognito";
import { PolicyForm } from "./form";

export const dynamic = "force-dynamic";

export default async function PolicyPage() {
  const [policy, users, sql] = await Promise.all([getPolicy(), listUsers(), userSqlAll()]);
  const people = users.map((u) => ({ id: u.id, email: u.email, sql: sql.get(u.id) ?? null }));
  return <PolicyForm policy={policy} people={people} />;
}
