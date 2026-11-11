// Own Kiro keys: one Secrets Manager secret per user, rv/kiro/<sub>, tagged with the owner
// so the runner role of that user's apps may read it (design.md, "Kiro keys").
import "server-only";
import {
  CreateSecretCommand, DeleteSecretCommand, DescribeSecretCommand, GetSecretValueCommand, PutSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { env } from "@/lib/env";
import type { KiroPayer, Settings } from "@/lib/contracts";
import { kiroKeyFor } from "@/lib/policy";
import { names, secrets } from "./aws";
import type { User } from "./auth";
import { HttpError } from "./http";

export interface OwnKey { arn: string; updatedAt: string | null }

export async function ownKey(u: User): Promise<OwnKey | null> {
  try {
    const r = await secrets.send(new DescribeSecretCommand({ SecretId: names.ownKey(u.sub) }));
    if (r.DeletedDate || !r.ARN) return null;
    return { arn: r.ARN, updatedAt: (r.LastChangedDate ?? r.CreatedDate)?.toISOString() ?? null };
  } catch (e) {
    if ((e as Error).name === "ResourceNotFoundException") return null;
    throw e;
  }
}

export async function saveOwnKey(u: User, key: string): Promise<OwnKey> {
  const id = names.ownKey(u.sub);
  try {
    await secrets.send(new PutSecretValueCommand({ SecretId: id, SecretString: key }));
  } catch (e) {
    if ((e as Error).name !== "ResourceNotFoundException") throw e;
    await secrets.send(new CreateSecretCommand({
      Name: id,
      SecretString: key,
      Description: "Kiro API key of one Revenant user",
      Tags: [{ Key: "revenant:owner", Value: u.sub }, { Key: "revenant:app", Value: "revenant" }],
    }));
  }
  const k = await ownKey(u);
  if (!k) throw new Error("own key not found after save");
  return k;
}

export async function deleteOwnKey(u: User): Promise<void> {
  try {
    await secrets.send(new DeleteSecretCommand({ SecretId: names.ownKey(u.sub), ForceDeleteWithoutRecovery: true }));
  } catch (e) {
    if ((e as Error).name !== "ResourceNotFoundException") throw e;
  }
}

/** Whether the company key has a value. The value is never returned. */
export async function companyKeySet(): Promise<boolean> {
  try {
    const r = await secrets.send(new GetSecretValueCommand({ SecretId: env.RV_KIRO_SECRET_ARN }));
    return Boolean(r.SecretString?.trim());
  } catch {
    return false;
  }
}

/** Which key pays for this user's run. `own` mode without a key is a 409 that points to Settings. */
export async function kiroFor(u: User, _s?: Settings): Promise<{ arn: string; payer: KiroPayer }> {
  const k = await kiroKeyFor(u.sub);
  if (!k) throw new HttpError(409, "Connect your own Kiro key first", "no_kiro_key", "/settings");
  return { arn: k.secretArn, payer: k.payer };
}
