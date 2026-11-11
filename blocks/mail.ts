// Sends mail with Amazon SES from one verified address (SES sandbox: recipients must be
// verified too, until the account leaves the sandbox). SES emails the address a link to verify it.
//
//   mail(backend, { from: 'hello@example.com', senders: [backend.notify] });
//
// Each sender function gets MAIL_FROM and may send only as that address.
import { Stack } from 'aws-cdk-lib';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { EmailIdentity, Identity } from 'aws-cdk-lib/aws-ses';
import type { Fn } from './fn';

type Backend = { createStack(name: string): Stack };

export function mail(backend: Backend, opts: { from: string; senders: Fn[] }): EmailIdentity {
  const stack = backend.createStack('mail');
  const identity = new EmailIdentity(stack, 'Sender', { identity: Identity.email(opts.from) });
  const arn = stack.formatArn({ service: 'ses', resource: 'identity', resourceName: opts.from });

  for (const fn of opts.senders) {
    fn.addEnvironment('MAIL_FROM', opts.from);
    fn.resources.lambda.addToRolePolicy(
      new PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: [arn],
        conditions: { StringEquals: { 'ses:FromAddress': opts.from } },
      }),
    );
  }
  return identity;
}
