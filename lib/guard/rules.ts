// Guardrail rules on synthesized CloudFormation templates (Requirement 10.1-10.3).
//   retain:  data resources (databases, buckets, tables) are retained or snapshotted on delete.
//   iam:     no Allow with "Action": "*"; "Resource": "*" only for actions AWS offers no
//            resource ARN for, or with a Condition.
//   secret:  no secret as a template parameter or a plain environment variable.
import type { Finding, Resource, Stacks } from "./types";

/** Types that hold user data. */
export const DATA_TYPES = new Set([
  "AWS::DynamoDB::Table",
  "AWS::DynamoDB::GlobalTable",
  "Custom::AmplifyDynamoDBTable",
  "Custom::ImportedAmplifyDynamoDBTable",
  "AWS::S3::Bucket",
  "AWS::RDS::DBCluster",
  "AWS::RDS::DBInstance",
  "AWS::EFS::FileSystem",
  "AWS::DocDB::DBCluster",
  "AWS::Neptune::DBCluster",
  "AWS::Redshift::Cluster",
  "AWS::EC2::Volume",
]);

/** Types where CloudFormation supports DeletionPolicy: Snapshot. */
const SNAPSHOT_TYPES = new Set([
  "AWS::RDS::DBCluster",
  "AWS::RDS::DBInstance",
  "AWS::DocDB::DBCluster",
  "AWS::Neptune::DBCluster",
  "AWS::Redshift::Cluster",
  "AWS::EC2::Volume",
]);

const RETAIN = new Set(["Retain", "RetainExceptOnCreate"]);

/** True when deleting the resource from the stack keeps its data. */
export function keepsData(r: Resource): boolean {
  const p = r.DeletionPolicy;
  if (p && RETAIN.has(p)) return true;
  return p === "Snapshot" && SNAPSHOT_TYPES.has(r.Type);
}

export function isData(r: Resource): boolean {
  if (!DATA_TYPES.has(r.Type)) return false;
  // A cluster member holds no data of its own: the cluster is checked instead.
  if (r.Type === "AWS::RDS::DBInstance" && r.Properties?.DBClusterIdentifier !== undefined) return false;
  return true;
}

/** Actions that have no resource-level permissions, so AWS requires "Resource": "*". */
export const STAR_ACTIONS = new Set([
  "xray:PutTraceSegments", "xray:PutTelemetryRecords", "xray:GetSamplingRules", "xray:GetSamplingTargets",
  "xray:GetSamplingStatisticSummaries", "cloudwatch:PutMetricData", "logs:DescribeLogGroups",
  "ec2:CreateNetworkInterface", "ec2:DescribeNetworkInterfaces", "ec2:DeleteNetworkInterface",
  "ec2:AssignPrivateIpAddresses", "ec2:UnassignPrivateIpAddresses", "ec2:DescribeSubnets",
  "ec2:DescribeSecurityGroups", "ec2:DescribeVpcs", "sts:GetCallerIdentity", "s3:ListAllMyBuckets",
  "tag:GetResources", "ssm:DescribeParameters", "secretsmanager:GetRandomPassword", "secretsmanager:ListSecrets",
  "ecr:GetAuthorizationToken", "bedrock:ListFoundationModels", "cloudformation:ListStacks",
  "cloudformation:ValidateTemplate", "lambda:ListFunctions", "dynamodb:ListTables", "sqs:ListQueues",
  "sns:ListTopics", "appsync:ListGraphqlApis", "cognito-idp:ListUserPools", "ses:GetSendQuota",
  "ce:GetCostAndUsage", "ce:GetCostForecast", "route53:ListHostedZones",
]);

type Statement = {
  Effect?: unknown;
  Action?: unknown;
  NotAction?: unknown;
  Resource?: unknown;
  NotResource?: unknown;
  Condition?: unknown;
};

const list = (v: unknown): unknown[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const strings = (v: unknown): string[] => list(v).filter((x): x is string => typeof x === "string");

function statements(doc: unknown): Statement[] {
  if (!doc || typeof doc !== "object") return [];
  return list((doc as { Statement?: unknown }).Statement).filter((s): s is Statement => !!s && typeof s === "object");
}

/** Identity policy documents on a resource (policies attached to roles, users, groups). */
function identityDocs(r: Resource): unknown[] {
  const p = r.Properties ?? {};
  switch (r.Type) {
    case "AWS::IAM::Policy":
    case "AWS::IAM::ManagedPolicy":
    case "AWS::IAM::RolePolicy":
    case "AWS::IAM::UserPolicy":
    case "AWS::IAM::GroupPolicy":
      return [p.PolicyDocument];
    case "AWS::IAM::Role":
    case "AWS::IAM::User":
    case "AWS::IAM::Group":
      return list(p.Policies).map((x) => (x as { PolicyDocument?: unknown } | null)?.PolicyDocument);
    default:
      return [];
  }
}

/** Resource policies (bucket, queue, topic, key...): checked for "Action": "*" only. */
function resourceDocs(r: Resource): unknown[] {
  const p = r.Properties ?? {};
  if (r.Type.startsWith("AWS::IAM::")) return [];
  return [p.PolicyDocument, p.KeyPolicy].filter((d) => d !== undefined);
}

const wild = (a: string) => a === "*" || a === "*:*";
const hasCondition = (s: Statement) => !!s.Condition && typeof s.Condition === "object" && Object.keys(s.Condition).length > 0;

function iam(at: string, r: Resource): Finding[] {
  const out: Finding[] = [];
  const bad = (rule: string, message: string) => out.push({ rule, resource: at, message, level: "error" });
  for (const doc of resourceDocs(r)) {
    for (const s of statements(doc)) {
      if (s.Effect !== "Allow") continue;
      if (strings(s.Action).some(wild)) bad("iam.action", `${r.Type} allows "Action": "*"; list the actions it needs`);
    }
  }
  for (const doc of identityDocs(r)) {
    for (const s of statements(doc)) {
      if (s.Effect !== "Allow") continue;
      const actions = strings(s.Action);
      if (actions.some(wild)) {
        bad("iam.action", `policy allows "Action": "*"; list the actions it needs`);
        continue;
      }
      if (s.NotAction !== undefined) {
        bad("iam.action", "policy uses Allow with NotAction, which allows every other action");
        continue;
      }
      const star = strings(s.Resource).includes("*") || s.NotResource !== undefined;
      if (!star || hasCondition(s)) continue;
      const loose = actions.filter((a) => !STAR_ACTIONS.has(a));
      // Intrinsic actions cannot be checked, so they count as loose.
      if (loose.length || actions.length !== list(s.Action).length) {
        bad("iam.resource", `"Resource": "*" without a Condition for ${loose.join(", ") || "computed actions"}; scope it to ARNs`);
      }
    }
  }
  return out;
}

const SECRET_NAME = /(secret|passw(or)?d|token|api[_-]?key|private[_-]?key|credential|client[_-]?secret)/i;
const POINTER_NAME = /(arn|name|id|url|uri|region|path|prefix|ttl|expiry|expires)$/i;
const SECRET_VALUE = [
  /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9_-]{20,}/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/,
];

export const secretName = (n: string) => SECRET_NAME.test(n) && !POINTER_NAME.test(n);
export const secretValue = (v: string) => SECRET_VALUE.some((re) => re.test(v)) || v.includes("{{resolve:secretsmanager:");

/** [name, value] pairs of environment variables a resource sets. */
function envVars(r: Resource): [string, unknown][] {
  const p = r.Properties ?? {};
  const pairs = (v: unknown) =>
    list(v)
      .filter((x): x is { Name?: unknown; Value?: unknown; Type?: unknown } => !!x && typeof x === "object")
      .filter((x) => x.Type === undefined || x.Type === "PLAINTEXT")
      .map((x) => [String(x.Name ?? ""), x.Value] as [string, unknown]);
  switch (r.Type) {
    case "AWS::Lambda::Function":
    case "AWS::Serverless::Function": {
      const vars = (p.Environment as { Variables?: Record<string, unknown> } | undefined)?.Variables ?? {};
      return Object.entries(vars);
    }
    case "AWS::ECS::TaskDefinition":
      return list(p.ContainerDefinitions).flatMap((c) => pairs((c as { Environment?: unknown } | null)?.Environment));
    case "AWS::CodeBuild::Project":
      return pairs((p.Environment as { EnvironmentVariables?: unknown } | undefined)?.EnvironmentVariables);
    case "AWS::Amplify::App":
    case "AWS::Amplify::Branch":
      return pairs(p.EnvironmentVariables);
    case "AWS::AppRunner::Service": {
      const c = (p.SourceConfiguration as { CodeRepository?: { CodeConfiguration?: { CodeConfigurationValues?: { RuntimeEnvironmentVariables?: unknown } } }; ImageRepository?: { ImageConfiguration?: { RuntimeEnvironmentVariables?: unknown } } } | undefined);
      return [
        ...pairs(c?.CodeRepository?.CodeConfiguration?.CodeConfigurationValues?.RuntimeEnvironmentVariables),
        ...pairs(c?.ImageRepository?.ImageConfiguration?.RuntimeEnvironmentVariables),
      ];
    }
    default:
      return [];
  }
}

function secrets(at: string, r: Resource): Finding[] {
  const out: Finding[] = [];
  for (const [name, value] of envVars(r)) {
    const literal = typeof value === "string" ? value : null;
    const resolved = JSON.stringify(value ?? "").includes("{{resolve:secretsmanager:");
    if ((literal !== null && literal !== "" && secretName(name)) || (literal !== null && secretValue(literal)) || resolved) {
      out.push({
        rule: "secret.env",
        resource: `${at}.${name}`,
        message: `environment variable ${name} carries a secret; store it in Secrets Manager and pass ${name}_ARN instead`,
        level: "error",
      });
    }
  }
  return out;
}

function retain(at: string, r: Resource): Finding[] {
  if (!isData(r) || keepsData(r)) return [];
  const want = SNAPSHOT_TYPES.has(r.Type) ? "Retain or Snapshot" : "Retain";
  return [{
    rule: "retain",
    resource: at,
    message: `${r.Type} has DeletionPolicy ${r.DeletionPolicy ?? "Delete"}; data resources need ${want}`,
    level: "error",
  }];
}

/** Every guardrail finding in the templates. Pure: no file system, no network. */
export function rules(stacks: Stacks): Finding[] {
  const out: Finding[] = [];
  for (const [stack, t] of Object.entries(stacks)) {
    for (const [name, p] of Object.entries(t.Parameters ?? {})) {
      if (secretName(name)) {
        out.push({
          rule: "secret.parameter",
          resource: `${stack}/${name}`,
          message: `template parameter ${name} looks like a secret; read it from Secrets Manager at runtime`,
          level: "error",
        });
      } else if (typeof p?.Default === "string" && secretValue(p.Default)) {
        out.push({ rule: "secret.parameter", resource: `${stack}/${name}`, message: `parameter ${name} has a secret as its default`, level: "error" });
      }
    }
    for (const [id, r] of Object.entries(t.Resources ?? {})) {
      if (!r || typeof r !== "object" || typeof r.Type !== "string") continue;
      const at = `${stack}/${id}`;
      out.push(...retain(at, r), ...iam(at, r), ...secrets(at, r));
    }
  }
  return out;
}
