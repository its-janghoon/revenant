// Custom domain on production (Requirement 5.7): Amplify issues the certificate; the user adds
// the DNS records we show. example.com maps the root and www to main; app.example.com maps
// only that name.
import "server-only";
import {
  CreateDomainAssociationCommand, DeleteDomainAssociationCommand, ListDomainAssociationsCommand, type DomainAssociation,
} from "@aws-sdk/client-amplify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Project } from "../contracts";
import { db, schema } from "../db/client";
import { PROD, branchUrl } from "./amplify";
import { amplify } from "./aws";
import type { DnsRecord, DomainState } from "./types";

export const hostname = z.string().toLowerCase().max(253)
  .regex(/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, "a domain name like example.com");

/** Second-level suffixes where the registrable domain has three labels. */
const SUFFIX2 = new Set(["co.uk", "org.uk", "ac.uk", "com.au", "net.au", "org.au", "co.nz", "co.jp", "ne.jp", "co.kr", "or.kr", "com.br", "com.cn", "com.tw", "co.in", "co.za", "com.mx", "com.sg"]);

/** Root domain and prefixes for Amplify: example.com -> ["", "www"], app.example.com -> ["app"]. */
export function split(domain: string): { root: string; prefixes: string[] } {
  const labels = domain.split(".");
  const size = SUFFIX2.has(labels.slice(-2).join(".")) ? 3 : 2;
  if (labels.length <= size) return { root: domain, prefixes: ["", "www"] };
  return { root: labels.slice(1).join("."), prefixes: [labels[0]!] };
}

const fqdn = (prefix: string, root: string) => (prefix ? `${prefix}.${root}` : root);
const bare = (s: string) => s.replace(/\.$/, "");

export function records(a: DomainAssociation): DnsRecord[] {
  const out: DnsRecord[] = [];
  const cert = a.certificateVerificationDNSRecord?.trim().split(/\s+/);
  if (cert && cert.length >= 3) out.push({ type: "CNAME", name: bare(cert[0]!), value: bare(cert[2]!), purpose: "certificate" });
  for (const s of a.subDomains ?? []) {
    const prefix = s.subDomainSetting?.prefix ?? "";
    const parts = (s.dnsRecord ?? "").trim().split(/\s+/);
    const value = bare(parts[parts.length - 1] ?? "");
    if (!value) continue;
    const name = fqdn(prefix, a.domainName!);
    out.push(prefix
      ? { type: "CNAME", name, value, purpose: "site" }
      : { type: "ALIAS", name, value, purpose: "site", note: "the root of a domain cannot be a CNAME: use ALIAS, ANAME or CNAME flattening at your DNS host" });
  }
  return out;
}

async function current(appId: string): Promise<DomainAssociation | null> {
  const r = await amplify.send(new ListDomainAssociationsCommand({ appId }));
  return r.domainAssociations?.[0] ?? null;
}

async function state(project: Project, a: DomainAssociation | null, want?: string): Promise<DomainState> {
  if (!a) return { domain: null, status: null, reason: null, records: [], url: null };
  const prefixes = (a.subDomains ?? []).map((s) => s.subDomainSetting?.prefix ?? "");
  const main = want ?? fqdn(prefixes.includes("") ? "" : (prefixes[0] ?? ""), a.domainName!);
  const url = `https://${main}`;
  if (a.domainStatus === "AVAILABLE" && project.prodUrl !== url) {
    await db.update(schema.projects).set({ prodUrl: url }).where(eq(schema.projects.id, project.id));
    project.prodUrl = url;
  }
  return { domain: main, status: a.domainStatus ?? null, reason: a.statusReason ?? null, records: records(a), url: a.domainStatus === "AVAILABLE" ? url : null };
}

export async function getDomain(project: Project): Promise<DomainState> {
  if (!project.amplifyAppId) return { domain: null, status: null, reason: null, records: [], url: null };
  return state(project, await current(project.amplifyAppId));
}

/** Points `domain` at production. Replaces a different domain set before. */
export async function setDomain(project: Project, domain: string): Promise<DomainState> {
  if (!project.amplifyAppId) throw new Error("publish the app before adding a domain");
  const { root, prefixes } = split(domain);
  const old = await current(project.amplifyAppId);
  if (old && old.domainName === root) {
    const have = new Set((old.subDomains ?? []).map((s) => s.subDomainSetting?.prefix ?? ""));
    if (prefixes.every((p) => have.has(p))) return state(project, old, domain);
  }
  if (old) await amplify.send(new DeleteDomainAssociationCommand({ appId: project.amplifyAppId, domainName: old.domainName! }));
  const r = await amplify.send(new CreateDomainAssociationCommand({
    appId: project.amplifyAppId,
    domainName: root,
    enableAutoSubDomain: false,
    subDomainSettings: prefixes.map((prefix) => ({ prefix, branchName: PROD })),
  }));
  if (old && project.prodUrl && !project.prodUrl.includes(".amplifyapp.com")) {
    // until the new domain is verified, production answers on its Amplify URL
    const url = await branchUrl(project.amplifyAppId, PROD);
    await db.update(schema.projects).set({ prodUrl: url }).where(eq(schema.projects.id, project.id));
    project.prodUrl = url;
  }
  return state(project, r.domainAssociation ?? null, domain);
}
