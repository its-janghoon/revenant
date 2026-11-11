// Who is the signed-in admin? Admin = member of the Cognito group "admin" (amplify/auth/resource.ts).
import "server-only";
import { fetchAuthSession } from "aws-amplify/auth/server";
import { cookies } from "next/headers";
import type { z, ZodTypeAny } from "zod";
import { runWithAmplifyServerContext } from "@/lib/amplify";

export interface Admin {
  sub: string;
  email: string;
}

export interface Viewer extends Admin {
  admin: boolean;
}

export async function viewer(): Promise<Viewer | null> {
  try {
    const s = await runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: (ctx) => fetchAuthSession(ctx),
    });
    const p = s.tokens?.idToken?.payload;
    if (!p?.sub) return null;
    const groups = p["cognito:groups"];
    return { sub: String(p.sub), email: String(p.email ?? ""), admin: Array.isArray(groups) && groups.includes("admin") };
  } catch {
    return null;
  }
}

export async function currentAdmin(): Promise<Admin | null> {
  const v = await viewer();
  return v?.admin ? { sub: v.sub, email: v.email } : null;
}

const json = (status: number, body: unknown) => Response.json(body, { status });
export const fail = (status: number, error: string) => json(status, { error });

type Ctx<P> = { params: Promise<P> };

/** Route handler wrapper: 404 for anyone who is not an admin (the admin area stays invisible). */
export function adminRoute<P = Record<string, string>>(
  fn: (req: Request, admin: Admin, params: P) => Promise<Response>,
) {
  return async (req: Request, ctx: Ctx<P>): Promise<Response> => {
    const admin = await currentAdmin();
    if (!admin) return fail(404, "not found");
    try {
      return await fn(req, admin, await ctx.params);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.status, e.message);
      console.error("admin route failed", (e as Error).name);
      return fail(500, "something went wrong");
    }
  };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Parse a JSON body with zod; 400 on failure. */
export async function body<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "body must be JSON");
  }
  const r = schema.safeParse(raw);
  if (!r.success) throw new HttpError(400, r.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
  return r.data;
}
