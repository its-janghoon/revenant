// Lets the app call Amazon Bedrock models, and only the models listed.
//
//   ai(backend, { models: ['us.anthropic.claude-sonnet-4-5-20250929-v1:0'], functions: [backend.review] });
//
// The Next.js server (Amplify Hosting compute role) gets the same permission when Revenant sets
// RV_COMPUTE_ROLE_ARN on the Amplify app. Ids with a geography prefix (us., eu., apac., global.)
// are cross-region inference profiles.
import { Stack } from 'aws-cdk-lib';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import type { Fn } from './fn';
import { grant } from './grant';

const PROFILE = /^(us|eu|apac|global|us-gov|jp|au|ca)\./;

export function arns(stack: Stack, models: string[]): string[] {
  const out: string[] = [];
  for (const id of models) {
    if (PROFILE.test(id)) {
      out.push(stack.formatArn({ service: 'bedrock', resource: 'inference-profile', resourceName: id }));
      // A profile routes to the base model in any region of its geography.
      out.push(`arn:${stack.partition}:bedrock:*::foundation-model/${id.replace(PROFILE, '')}`);
    } else {
      out.push(`arn:${stack.partition}:bedrock:${stack.region}::foundation-model/${id}`);
    }
  }
  return out;
}

export function ai(backend: { stack: Stack }, opts: { models: string[]; functions?: Fn[] }): void {
  if (!opts.models.length) throw new Error('ai(): list the Bedrock model ids the app uses');
  const statement = new PolicyStatement({
    actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
    resources: arns(backend.stack, opts.models),
  });

  for (const fn of opts.functions ?? []) {
    fn.resources.lambda.addToRolePolicy(statement);
    fn.addEnvironment('AI_MODELS', opts.models.join(','));
  }

  const compute = process.env.RV_COMPUTE_ROLE_ARN?.trim();
  if (compute) grant(backend.stack, 'ai', compute, [statement]);
}
