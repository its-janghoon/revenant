// CloudFormation template for one Aurora Serverless v2 Postgres cluster of a SQL app
// (Requirement 6.7-6.12). Revenant deploys it as its own stack, `rv-<app>-<prod|dev>-db`,
// when the admin allows SQL for the app's owner: the prod cluster holds `<app>_prod`, the dev
// cluster holds `<app>_dev` and every preview database `<app>_pv<n>`.
//
// - Minimum 0 ACU (pauses when idle), Data API on, IAM database auth on, encrypted.
// - Isolated subnets: no internet gateway, no NAT, not publicly accessible. Apps reach it only
//   through the Data API, which needs no network path.
// - pg_dump export: a CodeBuild project inside the VPC (the only thing allowed to reach port
//   5432) dumps one database to a private bucket through a free S3 gateway endpoint.
// - DeletionPolicy Snapshot on the cluster; deletion protection on prod.
//
// Pure function, no CDK: the same JSON is used by Revenant (lib/data/cluster.ts) and can be
// read by the guardrail check.

export type ClusterInput = {
  name: string; // rv-<app>-<prod|dev>
  prod: boolean;
  maxAcu?: number; // default 4
  engineVersion?: string; // default 16.15 (min 0 ACU needs 16.3 or later)
  dumpUser: string; // read-only role pg_dump signs in as
};

type Json = Record<string, unknown>;

const sub = (s: string) => ({ 'Fn::Sub': s });
const ref = (r: string) => ({ Ref: r });
const att = (r: string, a: string) => ({ 'Fn::GetAtt': [r, a] });

// One database per build; CodeBuild passes PGPASSWORD (a 15-minute IAM token) and PGDATABASE.
const BUILDSPEC = [
  'version: 0.2',
  'phases:',
  '  build:',
  '    commands:',
  '      - pg_dump --format=custom --no-owner --no-privileges --file "$PGDATABASE.dump"',
  '      - ls -l "$PGDATABASE.dump"',
  'artifacts:',
  '  files:',
  "    - '*.dump'",
].join('\n');

export function template(i: ClusterInput): Json {
  if (!/^rv-[a-z][a-z0-9-]{1,30}-(prod|dev)$/.test(i.name)) throw new Error(`bad cluster name: ${i.name}`);
  const keep = { DeletionPolicy: 'Snapshot', UpdateReplacePolicy: 'Snapshot' };
  const retain = { DeletionPolicy: 'Retain', UpdateReplacePolicy: 'Retain' };
  const subnet = (n: number) => ({
    Type: 'AWS::EC2::Subnet',
    Properties: {
      VpcId: ref('Vpc'),
      CidrBlock: `10.40.${n}.0/24`,
      AvailabilityZone: { 'Fn::Select': [n, { 'Fn::GetAZs': '' }] },
      MapPublicIpOnLaunch: false,
      Tags: [{ Key: 'Name', Value: `${i.name}-db-${n}` }],
    },
  });
  const assoc = (s: string) => ({
    Type: 'AWS::EC2::SubnetRouteTableAssociation',
    Properties: { SubnetId: ref(s), RouteTableId: ref('Routes') },
  });

  return {
    AWSTemplateFormatVersion: '2010-09-09',
    Description: `Revenant SQL database ${i.name} (Aurora Serverless v2, Data API, no public access)`,
    Resources: {
      Vpc: {
        Type: 'AWS::EC2::VPC',
        Properties: { CidrBlock: '10.40.0.0/16', EnableDnsSupport: true, EnableDnsHostnames: true, Tags: [{ Key: 'Name', Value: i.name }] },
      },
      SubnetA: subnet(0),
      SubnetB: subnet(1),
      Routes: { Type: 'AWS::EC2::RouteTable', Properties: { VpcId: ref('Vpc') } },
      RoutesA: assoc('SubnetA'),
      RoutesB: assoc('SubnetB'),
      S3Endpoint: {
        Type: 'AWS::EC2::VPCEndpoint',
        Properties: {
          VpcId: ref('Vpc'),
          ServiceName: sub('com.amazonaws.${AWS::Region}.s3'),
          VpcEndpointType: 'Gateway',
          RouteTableIds: [ref('Routes')],
        },
      },
      DumpSg: {
        Type: 'AWS::EC2::SecurityGroup',
        Properties: { GroupDescription: `${i.name} pg_dump`, VpcId: ref('Vpc') },
      },
      DbSg: {
        Type: 'AWS::EC2::SecurityGroup',
        Properties: {
          GroupDescription: `${i.name} database (pg_dump only)`,
          VpcId: ref('Vpc'),
          SecurityGroupIngress: [{ IpProtocol: 'tcp', FromPort: 5432, ToPort: 5432, SourceSecurityGroupId: ref('DumpSg') }],
        },
      },
      Subnets: {
        Type: 'AWS::RDS::DBSubnetGroup',
        Properties: { DBSubnetGroupDescription: i.name, SubnetIds: [ref('SubnetA'), ref('SubnetB')] },
      },
      Secret: {
        Type: 'AWS::SecretsManager::Secret',
        ...retain,
        Properties: {
          Name: `${i.name}-db`,
          Description: `Master user of ${i.name}; used by the Data API only`,
          GenerateSecretString: {
            SecretStringTemplate: JSON.stringify({ username: 'rvadmin' }),
            GenerateStringKey: 'password',
            PasswordLength: 32,
            ExcludeCharacters: '"@/\\\' `',
          },
        },
      },
      Cluster: {
        Type: 'AWS::RDS::DBCluster',
        ...keep,
        Properties: {
          DBClusterIdentifier: i.name,
          Engine: 'aurora-postgresql',
          EngineVersion: i.engineVersion ?? '16.15',
          MasterUsername: sub('{{resolve:secretsmanager:${Secret}:SecretString:username}}'),
          MasterUserPassword: sub('{{resolve:secretsmanager:${Secret}:SecretString:password}}'),
          EnableHttpEndpoint: true,
          EnableIAMDatabaseAuthentication: true,
          ServerlessV2ScalingConfiguration: { MinCapacity: 0, MaxCapacity: i.maxAcu ?? 4, SecondsUntilAutoPause: 300 },
          StorageEncrypted: true,
          DeletionProtection: i.prod,
          BackupRetentionPeriod: i.prod ? 7 : 1,
          CopyTagsToSnapshot: true,
          DBSubnetGroupName: ref('Subnets'),
          VpcSecurityGroupIds: [ref('DbSg')],
        },
      },
      Writer: {
        Type: 'AWS::RDS::DBInstance',
        Properties: {
          DBInstanceIdentifier: `${i.name}-writer`,
          DBClusterIdentifier: ref('Cluster'),
          DBInstanceClass: 'db.serverless',
          Engine: 'aurora-postgresql',
          PubliclyAccessible: false,
        },
      },
      SecretTarget: {
        Type: 'AWS::SecretsManager::SecretTargetAttachment',
        Properties: { SecretId: ref('Secret'), TargetId: ref('Cluster'), TargetType: 'AWS::RDS::DBCluster' },
      },
      DumpBucket: {
        Type: 'AWS::S3::Bucket',
        ...retain,
        Properties: {
          BucketEncryption: { ServerSideEncryptionConfiguration: [{ ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } }] },
          PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true },
          OwnershipControls: { Rules: [{ ObjectOwnership: 'BucketOwnerEnforced' }] },
          LifecycleConfiguration: { Rules: [{ Id: 'expire', Status: 'Enabled', ExpirationInDays: 7 }] },
        },
      },
      DumpRole: {
        Type: 'AWS::IAM::Role',
        Properties: {
          AssumeRolePolicyDocument: {
            Version: '2012-10-17',
            Statement: [{
              Effect: 'Allow',
              Principal: { Service: 'codebuild.amazonaws.com' },
              Action: 'sts:AssumeRole',
              Condition: { StringEquals: { 'aws:SourceAccount': ref('AWS::AccountId') } },
            }],
          },
          Policies: [{
            PolicyName: 'dump',
            PolicyDocument: {
              Version: '2012-10-17',
              Statement: [
                { Effect: 'Allow', Action: ['s3:PutObject', 's3:GetBucketAcl', 's3:GetBucketLocation'], Resource: [att('DumpBucket', 'Arn'), sub('${DumpBucket.Arn}/*')] },
                {
                  Effect: 'Allow',
                  Action: ['ec2:CreateNetworkInterface', 'ec2:DescribeDhcpOptions', 'ec2:DescribeNetworkInterfaces', 'ec2:DeleteNetworkInterface', 'ec2:DescribeSubnets', 'ec2:DescribeSecurityGroups', 'ec2:DescribeVpcs'],
                  Resource: '*',
                },
                {
                  Effect: 'Allow',
                  Action: 'ec2:CreateNetworkInterfacePermission',
                  Resource: sub('arn:${AWS::Partition}:ec2:${AWS::Region}:${AWS::AccountId}:network-interface/*'),
                  Condition: {
                    StringEquals: { 'ec2:AuthorizedService': 'codebuild.amazonaws.com' },
                    ArnEquals: { 'ec2:Subnet': [
                      sub('arn:${AWS::Partition}:ec2:${AWS::Region}:${AWS::AccountId}:subnet/${SubnetA}'),
                      sub('arn:${AWS::Partition}:ec2:${AWS::Region}:${AWS::AccountId}:subnet/${SubnetB}'),
                    ] },
                  },
                },
              ],
            },
          }],
        },
      },
      Dump: {
        Type: 'AWS::CodeBuild::Project',
        Properties: {
          Name: `${i.name}-dump`,
          Description: `pg_dump of one ${i.name} database to the dump bucket`,
          ServiceRole: att('DumpRole', 'Arn'),
          Source: { Type: 'NO_SOURCE', BuildSpec: BUILDSPEC },
          Environment: {
            Type: 'ARM_CONTAINER',
            ComputeType: 'BUILD_GENERAL1_SMALL',
            Image: 'public.ecr.aws/docker/library/postgres:16',
            ImagePullCredentialsType: 'CODEBUILD',
            EnvironmentVariables: [
              { Name: 'PGHOST', Value: att('Cluster', 'Endpoint.Address') },
              { Name: 'PGPORT', Value: '5432' },
              { Name: 'PGUSER', Value: i.dumpUser },
              { Name: 'PGSSLMODE', Value: 'require' },
            ],
          },
          VpcConfig: { VpcId: ref('Vpc'), Subnets: [ref('SubnetA'), ref('SubnetB')], SecurityGroupIds: [ref('DumpSg')] },
          Artifacts: { Type: 'S3', Location: ref('DumpBucket'), Path: 'dumps', NamespaceType: 'BUILD_ID', Name: 'out', Packaging: 'NONE' },
          // No CloudWatch Logs endpoint in the VPC: logs go to the bucket through the gateway endpoint.
          LogsConfig: { CloudWatchLogs: { Status: 'DISABLED' }, S3Logs: { Status: 'ENABLED', Location: sub('${DumpBucket}/logs') } },
          TimeoutInMinutes: 30,
        },
      },
    },
    Outputs: {
      ClusterArn: { Value: sub(`arn:\${AWS::Partition}:rds:\${AWS::Region}:\${AWS::AccountId}:cluster:${i.name}`) },
      ClusterResourceId: { Value: att('Cluster', 'DBClusterResourceId') },
      SecretArn: { Value: ref('Secret') },
      Host: { Value: att('Cluster', 'Endpoint.Address') },
      DumpProject: { Value: ref('Dump') },
      DumpBucket: { Value: ref('DumpBucket') },
    },
  };
}
