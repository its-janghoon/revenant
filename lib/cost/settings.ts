// Install settings the cost screens need, read from the settings table (key, JSON value).
// The admin lane writes these rows.
import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client";
import { env } from "../env";

async function positive(key: string): Promise<number | null> {
  const [row] = await db.select({ value: schema.settings.value }).from(schema.settings).where(eq(schema.settings.key, key));
  const v = Number(row?.value);
  return row && Number.isFinite(v) && v > 0 ? v : null;
}

/** Admin budget, else the install parameter. */
export async function budgetUsd(): Promise<number> {
  return (await positive("budgetUsd")) ?? env.RV_BUDGET_USD;
}

/**
 * AWS credits granted to the account (key "creditsUsd", set by the admin). Cost Explorer
 * reports credits applied but not the balance, so "credits left" needs this number.
 */
export async function creditsGrantedUsd(): Promise<number | null> {
  return positive("creditsUsd");
}
