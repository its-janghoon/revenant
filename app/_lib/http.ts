// Route handler helpers: one error type, zod bodies, JSON answers.
import "server-only";
import { ZodError, type ZodType } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string, public url?: string) {
    super(message);
  }
}

export const bad = (msg: string, code?: string) => new HttpError(400, msg, code);
export const notFound = (what = "Not found") => new HttpError(404, what, "not_found");
export const busy = (url?: string) => new HttpError(409, "A run is already going for this app", "busy", url);

export async function body<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw bad("The body must be JSON");
  }
  return schema.parse(raw);
}

/** Like body(), but an empty body counts as {}. */
export async function optionalBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const text = await req.text();
  if (!text.trim()) return schema.parse({});
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw bad("The body must be JSON");
  }
  return schema.parse(raw);
}

type Ctx<P> = { params: Promise<P> };

/** Wraps a handler: HttpError and ZodError become JSON answers, anything else a 500 without details. */
export function route<P = Record<string, string>>(fn: (req: Request, params: P) => Promise<Response | unknown>) {
  return async (req: Request, ctx: Ctx<P>): Promise<Response> => {
    try {
      const out = await fn(req, await ctx.params);
      return out instanceof Response ? out : Response.json(out);
    } catch (e) {
      if (e instanceof HttpError) {
        return Response.json({ error: e.message, ...(e.code ? { code: e.code } : {}), ...(e.url ? { url: e.url } : {}) }, { status: e.status });
      }
      if (e instanceof ZodError) {
        return Response.json({ error: e.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "), code: "invalid" }, { status: 400 });
      }
      console.error("route failed", (e as Error).name, (e as Error).message);
      return Response.json({ error: "Something went wrong on the server" }, { status: 500 });
    }
  };
}

export const created = (data: unknown) => Response.json(data, { status: 201 });
export const accepted = (data: unknown) => Response.json(data, { status: 202 });
