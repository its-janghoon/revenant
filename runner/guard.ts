// CLI stub for the guardrail check (Requirement 10). The rules live in lib/guard.ts.
// Usage: tsx runner/guard.ts --cdk-out <dir> [--repo <dir>] [--base <git ref>]
// Exit 0 when the check passes, 1 when it finds a problem, 2 when the check cannot run.
//
// Contract with lib/guard.ts (node: modules and relative imports only, it runs in the runner image):
//   export function check(input: GuardInput): GuardResult | Promise<GuardResult>

import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { emit } from './log.ts';

export type GuardInput = { cdkOut: string; repo: string; base?: string };
export type Finding = { rule: string; resource?: string; message: string };
export type GuardResult = { ok: boolean; findings: Finding[] };
type Check = (input: GuardInput) => GuardResult | Promise<GuardResult>;

const { values } = parseArgs({
  options: {
    'cdk-out': { type: 'string' },
    repo: { type: 'string', default: '.' },
    base: { type: 'string' },
  },
});

const cdkOut = values['cdk-out'];
if (!cdkOut) {
  emit({ t: 'error', step: 'guard', text: '--cdk-out is required' });
  process.exit(2);
}

let check: Check | undefined;
try {
  const m = (await import('../lib/guard.ts')) as { check?: Check; default?: Check };
  check = m.check ?? m.default;
} catch {
  check = undefined;
}
// Fail closed: no guard, no push.
if (typeof check !== 'function') {
  emit({ t: 'error', step: 'guard', text: 'lib/guard.ts is missing or exports no check(); refusing to continue' });
  process.exit(2);
}

const r = await check({ cdkOut: resolve(cdkOut), repo: resolve(values.repo ?? '.'), base: values.base });
for (const f of r.findings) {
  const at = { rule: f.rule, ...(f.resource ? { resource: f.resource } : {}), text: f.message };
  emit(r.ok ? { t: 'message', from: 'guard', ...at } : { t: 'error', step: 'guard', ...at });
}
process.exit(r.ok ? 0 : 1);
