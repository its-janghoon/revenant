// Per-app runner role (Requirement 10.4). Revenant creates `rv-<app>-runner` when a project
// is created and passes it to CodeBuild StartBuild as `serviceRoleOverride`.
// The role reaches only that app's repo, its prompts, its owner's Kiro key and the runner logs.
// Database access for dev and preview (SQL apps) is added through `extra`.

export type Statement = {
  Sid?: string;
  Effect: 'Allow' | 'Deny';
  Action: string[];
  Resource: string[];
  Condition?: Record<string, Record<string, string | string[]>>;
};

export type Doc = { Version: '2012-10-17'; Statement: Statement[] };

export type RoleInput = {
  partition?: string;
  region: string;
  account: string;
  app: string;
  repo: string;
  owner: string; // Revenant user id; own Kiro keys live at rv/kiro/<owner>
  companySecretArn?: string; // company Kiro key, when the install allows it
  promptBucket: string; // prompts and attachments under runs/<app>/
  logGroup: string; // the shared runner project's log group, e.g. /aws/codebuild/rv-runner
  extra?: Statement[];
};

export const roleName = (app: string) => `rv-${app}-runner`;

export function trust(account: string): Record<string, unknown> {
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { Service: 'codebuild.amazonaws.com' },
        Action: 'sts:AssumeRole',
        Condition: { StringEquals: { 'aws:SourceAccount': account } },
      },
    ],
  };
}

export function policy(i: RoleInput): Doc {
  const p = i.partition ?? 'aws';
  const at = `${i.region}:${i.account}`;
  const secrets = [`arn:${p}:secretsmanager:${at}:secret:rv/kiro/${i.owner}-*`];
  if (i.companySecretArn) secrets.push(i.companySecretArn);

  return {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'Repo',
        Effect: 'Allow',
        Action: ['codecommit:GitPull', 'codecommit:GitPush', 'codecommit:GetRepository', 'codecommit:GetBranch'],
        Resource: [`arn:${p}:codecommit:${at}:${i.repo}`],
      },
      {
        Sid: 'Prompts',
        Effect: 'Allow',
        Action: ['s3:GetObject'],
        Resource: [`arn:${p}:s3:::${i.promptBucket}/runs/${i.app}/*`],
      },
      {
        Sid: 'PromptList',
        Effect: 'Allow',
        Action: ['s3:ListBucket'],
        Resource: [`arn:${p}:s3:::${i.promptBucket}`],
        Condition: { StringLike: { 's3:prefix': [`runs/${i.app}/*`] } },
      },
      {
        Sid: 'KiroKey',
        Effect: 'Allow',
        Action: ['secretsmanager:GetSecretValue'],
        Resource: secrets,
      },
      {
        Sid: 'Logs',
        Effect: 'Allow',
        Action: ['logs:CreateLogStream', 'logs:PutLogEvents'],
        Resource: [`arn:${p}:logs:${at}:log-group:${i.logGroup}:*`],
      },
      ...(i.extra ?? []),
    ],
  };
}
