import { getPolicy, policyBody, putPolicy } from "@/lib/policy";
import { adminRoute, body } from "../../guard";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async () => Response.json(await getPolicy()));

// Partial update; each changed key writes one audit row.
export const PUT = adminRoute(async (req, admin) => Response.json(await putPolicy(await body(req, policyBody), admin.email)));
