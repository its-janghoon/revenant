import { domainBody } from "@/lib/contracts";
import { getDomain, setDomain } from "@/lib/deploy";
import { fail, guardProject } from "@/lib/deploy/access";
import { hostname } from "@/lib/deploy/domain";

export const dynamic = "force-dynamic";

// GET: the custom domain, its status and the DNS records to add.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardProject((await params).id);
  if ("error" in g) return g.error;
  return Response.json(await getDomain(g.project));
}

// PUT { domain }: point the domain at production.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardProject((await params).id);
  if ("error" in g) return g.error;
  const body = domainBody.safeParse(await req.json().catch(() => null));
  const name = hostname.safeParse(body.success ? body.data.domain : "");
  if (!name.success) return fail(400, "domain must be a name like example.com");
  if (!g.project.amplifyAppId) return fail(409, "publish the app before adding a domain");
  return Response.json(await setDomain(g.project, name.data));
}
