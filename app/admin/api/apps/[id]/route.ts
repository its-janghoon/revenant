import { audit } from "@/lib/audit";
import { expireApp, getApp } from "../../../data";
import { adminRoute, HttpError } from "../../../guard";

export const dynamic = "force-dynamic";

// Marks the app expired now; the cleanup job (lib/cleanup) removes its AWS resources.
export const DELETE = adminRoute<{ id: string }>(async (_req, admin, { id }) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "no such app");
  const app = await getApp(id);
  if (!app) throw new HttpError(404, "no such app");
  await expireApp(app.id);
  await audit(admin.email, "app.deleted", { app: app.name, projectId: app.id });
  return Response.json({ ok: true }, { status: 202 });
});
