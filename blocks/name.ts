// Resource names: rv-<app>-<prod|dev|pv<n>>[-<part>] (Requirement 11.3).
// The app name comes from RV_APP; the environment from the Amplify branch being deployed.
import type { Construct } from 'constructs';

export type Env = 'prod' | 'dev' | `pv${number}`;

export function sandbox(scope: Construct): boolean {
  return scope.node.tryGetContext('amplify-backend-type') === 'sandbox';
}

export function env(scope: Construct): Env {
  if (sandbox(scope)) return 'dev';
  const branch = String(scope.node.tryGetContext('amplify-backend-name') ?? '');
  if (branch === 'main') return 'prod';
  const pv = /^preview[-/]?(\d+)$/.exec(branch);
  return pv ? `pv${Number(pv[1])}` : 'dev';
}

export function app(): string {
  const v = process.env.RV_APP?.trim();
  if (!v || !/^[a-z][a-z0-9-]{1,30}$/.test(v)) throw new Error('RV_APP must be set to the app name (lowercase kebab-case)');
  return v;
}

export function name(scope: Construct, part?: string): string {
  const n = [`rv-${app()}-${env(scope)}`, part].filter(Boolean).join('-').toLowerCase();
  return n.replace(/[^a-z0-9-]/g, '-').slice(0, 63).replace(/-+$/, '');
}
