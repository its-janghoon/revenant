import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

const secrets = new SecretsManagerClient({});
let key: string | null = null;

// POST <RV_URL>/api/cost/daily?job=tick with the app key (app/api/cost/daily/route.ts).
export const handler = async (): Promise<{ status: number; body: string }> => {
  const url = process.env.RV_URL;
  const arn = process.env.RV_APP_SECRET_ARN;
  if (!url || !arn) throw new Error("RV_URL and RV_APP_SECRET_ARN must be set");
  key ??= (await secrets.send(new GetSecretValueCommand({ SecretId: arn }))).SecretString ?? "";
  const r = await fetch(`${url}/api/cost/daily?job=tick`, {
    method: "POST",
    headers: { "x-rv-key": key },
    signal: AbortSignal.timeout(80_000),
  });
  const body = (await r.text()).slice(0, 2000);
  if (!r.ok) throw new Error(`tick ${r.status}: ${body}`);
  return { status: r.status, body };
};
