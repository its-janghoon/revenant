// May this owner's next app use SQL (blocks/db)? The per-user override in user_policies wins,
// else the install setting `sqlAllowed` (default off). L9 (lib/policy.ts, admin screens)
// writes both; this reads them through PolicySource so L9 can pass its own reader.
import "server-only";
import { eq } from "drizzle-orm";
import { DEFAULT_SETTINGS } from "../contracts";

export interface PolicySource {
  /** Install-wide `sqlAllowed` from the settings table; undefined when never set. */
  installSqlAllowed(): Promise<boolean | undefined>;
  /** Per-user override from user_policies; null or undefined = follow the install setting. */
  userSqlAllowed(userId: string): Promise<boolean | null | undefined>;
}

/** Reads Revenant's own tables directly. */
export const tables: PolicySource = {
  async installSqlAllowed() {
    const { db, schema } = await import("../db/client");
    const [row] = await db.select({ value: schema.settings.value }).from(schema.settings).where(eq(schema.settings.key, "sqlAllowed")).limit(1);
    return typeof row?.value === "boolean" ? row.value : undefined;
  },
  async userSqlAllowed(userId) {
    const { db, schema } = await import("../db/client");
    const [row] = await db.select({ v: schema.userPolicies.sqlAllowed }).from(schema.userPolicies).where(eq(schema.userPolicies.userId, userId)).limit(1);
    return row?.v;
  },
};

export async function sqlAllowed(owner: string, src: PolicySource = tables): Promise<boolean> {
  const user = await src.userSqlAllowed(owner);
  if (typeof user === "boolean") return user;
  return (await src.installSqlAllowed()) ?? DEFAULT_SETTINGS.sqlAllowed;
}
