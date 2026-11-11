// Runs an Amplify function on a schedule with an EventBridge rule.
//
//   cron(backend.digest, { id: 'digest', schedule: 'cron(0 9 * * ? *)' });   // 09:00 UTC daily
//   cron(backend.sweep, { id: 'sweep', schedule: 'rate(1 hour)', input: { dryRun: false } });
import { Stack } from 'aws-cdk-lib';
import { Rule, RuleTargetInput, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import type { Fn } from './fn';
import { name } from './name';

export function cron(fn: Fn, opts: { id: string; schedule: string; input?: Record<string, unknown> }): Rule {
  if (!/^(rate|cron)\(.+\)$/.test(opts.schedule)) throw new Error('cron(): schedule is rate(...) or cron(...)');
  const lambda = fn.resources.lambda;
  // The rule lives next to the function so the stacks do not depend on each other.
  const stack = Stack.of(lambda);
  const rule = new Rule(stack, `RvCron-${opts.id}`, {
    ruleName: name(stack, opts.id),
    schedule: Schedule.expression(opts.schedule),
  });
  rule.addTarget(new LambdaFunction(lambda, opts.input ? { event: RuleTargetInput.fromObject(opts.input) } : {}));
  return rule;
}
