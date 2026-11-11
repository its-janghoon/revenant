// Who is calling, and which project they may touch. People use the Cognito session; a user
// reaches only their own projects (Requirement 2.4), an admin reaches every project.
import "server-only";
import { fetchAuthSession } from "aws-amplify/auth/server";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";
import type { ApiError, Project } from "../contracts";
import { runWithAmplifyServerContext } from "../amplify";
import { db, schema } from "../db/client";

export interface Caller { sub: string; admin: boolean }

export async function caller(): Promise<Caller | null> {
  try {
    const s = await runWithAmplifyServerContext({ nextServerContext: { cookies }, operation: (ctx) => fetchAuthSession(ctx) });
    const p = s.tokens?.idToken?.payload;
    if (!p?.sub) return null;
    const groups = p["cognito:groups"];
    return { sub: String(p.sub), admin: Array.isArray(groups) && groups.includes("admin") };
  } catch {
    return null;
  }
}

export const fail = (status: number, error: string) => Response.json({ error } satisfies ApiError, { status });

const uuid = z.string().uuid();

export async function loadProject(id: string): Promise<Project | null> {
  if (!uuid.safeParse(id).success) return null;
  const [row] = await db.select().from(schema.projects).where(eq(schema.projects.id, id)).limit(1);
  return (row as Project | undefined) ?? null;
}

/** The project when the signed-in caller may use it, else the error response to return. */
export async function guardProject(id: string): Promise<{ project: Project; caller: Caller } | { error: Response }> {
  const c = await caller();
  if (!c) return { error: fail(401, "sign in first") };
  const project = await loadProject(id);
  if (!project || project.status === "deleted" || (project.owner !== c.sub && !c.admin)) return { error: fail(404, "project not found") };
  return { project, caller: c };
}
