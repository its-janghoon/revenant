// Response shapes of the deploy routes, beyond lib/contracts.ts.
import type { Deploy, Preview, PublishPlan } from "../contracts";
import type { Change, Finding } from "../guard";
import type { Affected } from "./count";

/** GET /api/projects/:id/publish. Superset of PublishPlan. */
export interface PublishDetail extends PublishPlan {
  branch: string; // the preview being published
  commit: string;
  changes: Change[]; // every resource change prod -> preview
  data: Affected[]; // removed models and fields with the records they hold in prod
  findings: Finding[]; // errors here block the publish
  needsApproval: boolean; // destructive is not empty
  blocked: string | null; // why publish cannot start now
}

/** GET /api/projects/:id/previews */
export interface PreviewInfo extends Preview {
  deploy: Deploy | null; // latest deploy of the branch
}

export interface DnsRecord {
  type: "CNAME" | "ALIAS";
  name: string; // fully qualified, no trailing dot
  value: string;
  purpose: "certificate" | "site";
  note?: string;
}

/** GET/PUT /api/projects/:id/domain */
export interface DomainState {
  domain: string | null;
  status: string | null; // Amplify DomainStatus: PENDING_VERIFICATION, AVAILABLE, FAILED...
  reason: string | null;
  records: DnsRecord[];
  url: string | null;
}
