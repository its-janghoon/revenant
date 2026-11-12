// Grants to a role made outside the app (Revenant's shared build and compute roles).
// Role.fromRoleArn(...).addToPrincipalPolicy gives the inline policy the same generated name in
// every branch stack, so a second preview fails with "Policy resource was already managed by
// another stack". Here the policy is named per app and environment: rv-<app>-<env>-<part>.
import { Policy, Role, type PolicyStatement } from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';
import { name } from './name';

export function grant(scope: Construct, part: string, roleArn: string, statements: PolicyStatement[]): void {
  const id = part.replace(/(^|-)([a-z])/g, (_, _d, c: string) => c.toUpperCase());
  new Policy(scope, `Rv${id}Grant`, {
    policyName: name(scope, part),
    roles: [Role.fromRoleArn(scope, `Rv${id}Role`, roleArn)],
    statements,
  });
}
