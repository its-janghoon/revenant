// Who is calling: a person (Cognito session in cookies), the Kiro Crew app (Bearer token
// from Settings -> Kiro Crew) or a machine (runner, other lanes) with the app key in x-rv-key.
import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { and, eq, like } from "drizzle-orm";
import { fetchAuthSession } from "aws-amplify/auth/server";
import { cookies } from "next/headers";
import { runWithAmplifyServerContext } from "@/lib/amplify";
import { db, schema } from "@/lib/db/client";
import { env } from "@/lib/env";
import { secrets } from "./aws";
import { HttpError } from "./http";

export interface User { sub: string; email: string; name: string; admin: boolean }

export async function currentUser(): Promise<User | null> {
  try {
    const s = await runWithAmplifyServerContext({ nextServerContext: { cookies }, operation: (ctx) => fetchAuthSession(ctx) });
    const p = s.tokens?.idToken?.payload;
    if (!p?.sub) return null;
    const email = typeof p.email === "string" ? p.email : "";
    const groups = Array.isArray(p["cognito:groups"]) ? (p["cognito:groups"] as unknown[]) : [];
    const name = typeof p.name === "string" && p.name ? p.name : email.split("@")[0] ?? "";
    return { sub: String(p.sub), email, name, admin: groups.includes("admin") };
  } catch {
    return null;
  }
}

export async function needUser(): Promise<User> {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "Sign in first", "signin", "/signin");
  return u;
}

// ---------- machine key (x-rv-key) ----------

let appKey: string | null = null;
async function key(): Promise<string> {
  if (appKey) return appKey;
  const r = await secrets.send(new GetSecretValueCommand({ SecretId: env.RV_APP_SECRET_ARN }));
  appKey = r.SecretString ?? "";
  return appKey;
}

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export async function isMachine(req: Request): Promise<boolean> {
  const got = req.headers.get("x-rv-key");
  if (!got) return false;
  const want = await key();
  return want.length > 0 && same(got, want);
}

export async function needMachine(req: Request): Promise<void> {
  if (!(await isMachine(req))) throw new HttpError(401, "Missing or wrong x-rv-key", "key");
}

export async function appKeyHeader(): Promise<Record<string, string>> {
  return { "x-rv-key": await key() };
}

// ---------- Kiro Crew tokens ----------
// Stored in the settings table (no migration): key "crew:<sha256 of token>", value below.
// The token itself is shown once and never stored.

export interface CrewToken { id: string; owner: string; email: string; label: string; createdAt: string; lastUsedAt: string | null }
const PREFIX = "crew:";
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createCrewToken(u: User, label: string): Promise<{ token: string; info: CrewToken }> {
  const token = `rvc_${randomBytes(32).toString("base64url")}`;
  const h = hash(token);
  const info: CrewToken = { id: h.slice(0, 12), owner: u.sub, email: u.email, label, createdAt: new Date().toISOString(), lastUsedAt: null };
  await db.insert(schema.settings).values({ key: PREFIX + h, value: info, updatedBy: u.sub });
  return { token, info };
}

export async function listCrewTokens(u: User): Promise<CrewToken[]> {
  const rows = await db.select().from(schema.settings).where(and(like(schema.settings.key, `${PREFIX}%`), eq(schema.settings.updatedBy, u.sub)));
  return rows.map((r) => r.value as CrewToken).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function revokeCrewToken(u: User, id: string): Promise<boolean> {
  if (!/^[0-9a-f]{12}$/.test(id)) return false;
  const r = await db.delete(schema.settings)
    .where(and(like(schema.settings.key, `${PREFIX}${id}%`), eq(schema.settings.updatedBy, u.sub)))
    .returning({ key: schema.settings.key });
  return r.length > 0;
}

/** The owner of a Bearer token, or a 401. */
export async function needCrew(req: Request): Promise<User> {
  const m = /^Bearer\s+(rvc_[A-Za-z0-9_-]{20,})$/.exec(req.headers.get("authorization") ?? "");
  if (!m?.[1]) throw new HttpError(401, "Missing or wrong token. Create one in Revenant under Settings -> Kiro Crew.", "token", "/settings");
  const k = PREFIX + hash(m[1]);
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, k));
  if (!row) throw new HttpError(401, "Missing or wrong token. Create one in Revenant under Settings -> Kiro Crew.", "token", "/settings");
  const info = row.value as CrewToken;
  const now = new Date();
  if (!info.lastUsedAt || now.getTime() - Date.parse(info.lastUsedAt) > 60_000) {
    await db.update(schema.settings).set({ value: { ...info, lastUsedAt: now.toISOString() }, updatedAt: now.toISOString() }).where(eq(schema.settings.key, k));
  }
  return { sub: info.owner, email: info.email, name: info.email.split("@")[0] ?? "", admin: false };
}
