import { z } from "zod";
import { createCrewToken, listCrewTokens, needUser, revokeCrewToken } from "@/app/_lib/auth";
import { body, created, notFound, route } from "@/app/_lib/http";

export const dynamic = "force-dynamic";

// API tokens for the Kiro Crew app (crew-app/README.md, "Setup"). The token is shown once.
export const GET = route(async () => {
  const u = await needUser();
  return { tokens: await listCrewTokens(u) };
});

export const POST = route(async (req) => {
  const u = await needUser();
  const b = await body(req, z.object({ label: z.string().trim().min(1).max(60).default("Kiro Crew") }));
  return created(await createCrewToken(u, b.label));
});

export const DELETE = route(async (req) => {
  const u = await needUser();
  const b = await body(req, z.object({ id: z.string() }));
  if (!(await revokeCrewToken(u, b.id))) throw notFound("No such token");
  return { ok: true };
});
