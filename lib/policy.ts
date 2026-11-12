// Install policy: the Settings rows and per-user SQL overrides, written only by the admin.
// Other lanes read it through isSqlAllowed(userId), kiroKeyFor(userId) and getSettings().
import "server-only";
import { DeleteSecretCommand, DescribeSecretCommand, ResourceNotFoundException, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { DEFAULT_SETTINGS, PREVIEW_MAX_AGE_DAYS, settingsBody, type KiroPayer, type Settings } from "./contracts";
import { audit } from "./audit";
import { db, schema } from "./db/client";
import { env } from "./env";

/** Settings plus the admin-only preview cleanup age (stored as one more `settings` row). */
export interface Policy extends Settings {
  previewDays: number;
}

export const policyBody = settingsBody.extend({ previewDays: z.number().int().min(1).max(90).optional() });
export type PolicyPatch = z.infer<typeof policyBody>;

const KEYS = ["sqlAllowed", "model", "kiroMode", "budgetUsd", "creditsPerBuild", "autoDeleteHours", "companyDesign", "companyDesignMode", "previewDays"] as const;
type Key = (typeof KEYS)[number];

function defaults(): Policy {
  return {
    ...DEFAULT_SETTINGS,
    budgetUsd: env.RV_BUDGET_USD,
    autoDeleteHours: env.RV_DEMO === "on" ? 24 : DEFAULT_SETTINGS.autoDeleteHours,
    previewDays: PREVIEW_MAX_AGE_DAYS,
  };
}

export async function getPolicy(): Promise<Policy> {
  const p = defaults();
  const rows = await db.select().from(schema.settings);
  for (const r of rows) {
    if (!(KEYS as readonly string[]).includes(r.key)) continue;
    const one = policyBody.safeParse({ [r.key]: r.value });
    if (one.success) Object.assign(p, one.data);
  }
  return p;
}

export async function getSettings(): Promise<Settings> {
  const { previewDays: _, ...s } = await getPolicy();
  return s;
}

/** Previews older than this many days are deleted by the cleanup job. */
export async function getPreviewDays(): Promise<number> {
  return (await getPolicy()).previewDays;
}

const ACTION: Record<Key, string> = {
  sqlAllowed: "policy.sql",
  model: "policy.model",
  kiroMode: "policy.kiro_mode",
  budgetUsd: "policy.budget",
  creditsPerBuild: "policy.credits_per_build",
  autoDeleteHours: "policy.auto_delete",
  companyDesign: "policy.company_design",
  companyDesignMode: "policy.company_design_mode",
  previewDays: "policy.preview_days",
};

/** Writes the changed keys, one audit row each. Returns the new policy. */
export async function putPolicy(patch: PolicyPatch, actor: string): Promise<Policy> {
  const before = await getPolicy();
  const next: Policy = { ...before };
  for (const k of KEYS) {
    const v = patch[k];
    if (v === undefined || v === before[k]) continue;
    const value = v === null ? sql`'null'::jsonb` : v; // a JSON null, not SQL NULL (the column is not null)
    await db
      .insert(schema.settings)
      .values({ key: k, value, updatedBy: actor })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedBy: actor, updatedAt: sql`now()` } });
    await audit(actor, ACTION[k], k === "companyDesign"
      ? { from: before[k] ? `${String(before[k]).length} chars` : null, to: v ? `${String(v).length} chars` : null }
      : { from: before[k], to: v });
    Object.assign(next, { [k]: v });
  }
  return next;
}

// ---------- per-user SQL ----------

/** null = follows the install setting. */
export async function userSql(userId: string): Promise<boolean | null> {
  const [row] = await db.select().from(schema.userPolicies).where(eq(schema.userPolicies.userId, userId));
  return row?.sqlAllowed ?? null;
}

export async function userSqlAll(): Promise<Map<string, boolean | null>> {
  const rows = await db.select().from(schema.userPolicies);
  return new Map(rows.map((r) => [r.userId, r.sqlAllowed]));
}

/** `label` is what the audit log shows for the user (their email). */
export async function setUserSql(userId: string, value: boolean | null, actor: string, label = userId): Promise<void> {
  const before = await userSql(userId);
  if (before === value) return;
  if (value === null) await db.delete(schema.userPolicies).where(eq(schema.userPolicies.userId, userId));
  else
    await db
      .insert(schema.userPolicies)
      .values({ userId, sqlAllowed: value })
      .onConflictDoUpdate({ target: schema.userPolicies.userId, set: { sqlAllowed: value } });
  const action = value === null ? "policy.sql_user_policy" : value ? "policy.sql_user_on" : "policy.sql_user_off";
  await audit(actor, action, { user: label, userId });
}

export async function clearUser(userId: string): Promise<void> {
  await db.delete(schema.userPolicies).where(eq(schema.userPolicies.userId, userId));
}

/** May this user's next app get Aurora Postgres? Per-user override, else the install setting. */
export async function isSqlAllowed(userId: string): Promise<boolean> {
  const own = await userSql(userId);
  return own ?? (await getSettings()).sqlAllowed;
}

// ---------- Kiro key ----------

const sm = new SecretsManagerClient({ region: env.AWS_REGION });

/** Secrets Manager name of a user's own Kiro key (runner/role.ts grants `rv/kiro/<owner>-*`). */
export const kiroSecretName = (userId: string) => `rv/kiro/${userId}`;

/** ARN of the user's own Kiro key, or null when they have not connected one. */
export async function ownKeyArn(userId: string): Promise<string | null> {
  try {
    const s = await sm.send(new DescribeSecretCommand({ SecretId: kiroSecretName(userId) }));
    return s.DeletedDate || !s.ARN ? null : s.ARN;
  } catch (e) {
    if (e instanceof ResourceNotFoundException) return null;
    throw e;
  }
}

/** Removes a user's own Kiro key (when the admin deletes the user). No-op when there is none. */
export async function deleteOwnKey(userId: string): Promise<void> {
  try {
    await sm.send(new DeleteSecretCommand({ SecretId: kiroSecretName(userId), ForceDeleteWithoutRecovery: true }));
  } catch (e) {
    if (!(e instanceof ResourceNotFoundException)) throw e;
  }
}

export interface KiroKey {
  payer: KiroPayer;
  secretArn: string;
}

/**
 * Which Kiro key pays for this user's next run. company: the company key. own: the user's
 * key, or null when they have none (the run must not start; ask them to connect Kiro in
 * Settings). both: the user's key if connected, else the company key.
 */
export async function kiroKeyFor(userId: string): Promise<KiroKey | null> {
  const { kiroMode } = await getSettings();
  if (kiroMode !== "company") {
    const own = await ownKeyArn(userId);
    if (own) return { payer: "own", secretArn: own };
    if (kiroMode === "own") return null;
  }
  return { payer: "company", secretArn: env.RV_KIRO_SECRET_ARN };
}
