// Who is calling a cost route: a signed-in person (Cognito session cookie) or a machine
// caller (runner, Kiro Crew app, the daily scheduler) with the app key in `x-rv-key`.
import "server-only";
import { timingSafeEqual } from "node:crypto";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { fetchAuthSession } from "aws-amplify/auth/server";
import { cookies } from "next/headers";
import { runWithAmplifyServerContext } from "../amplify";
import { env } from "../env";

export type Caller =
  | { kind: "user"; sub: string; admin: boolean }
  | { kind: "machine" };

const secrets = new SecretsManagerClient({ region: env.AWS_REGION });
let appKey: Promise<string> | null = null;

function key(): Promise<string> {
  appKey ??= secrets.send(new GetSecretValueCommand({ SecretId: env.RV_APP_SECRET_ARN })).then((r) => r.SecretString ?? "");
  appKey.catch(() => { appKey = null; });
  return appKey;
}

async function isMachine(req: Request): Promise<boolean> {
  const given = req.headers.get("x-rv-key");
  if (!given) return false;
  const want = await key();
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return want.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

export async function caller(req: Request): Promise<Caller | null> {
  if (await isMachine(req)) return { kind: "machine" };
  const session = await runWithAmplifyServerContext({
    nextServerContext: { cookies },
    operation: (ctx) => fetchAuthSession(ctx),
  }).catch(() => null);
  const p = session?.tokens?.idToken?.payload;
  if (!p?.sub) return null;
  const groups = p["cognito:groups"];
  return { kind: "user", sub: String(p.sub), admin: Array.isArray(groups) && groups.includes("admin") };
}

export const unauthorized = () => Response.json({ error: "unauthorized" }, { status: 401 });
export const forbidden = () => Response.json({ error: "forbidden" }, { status: 403 });
