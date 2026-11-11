// Change classifier (Requirement 5.5): what a deploy does to each resource, from the templates
// before and after. replace and delete are destructive and wait for the user's approval.
import { isData, keepsData } from "./rules";
import type { Resource, Stacks, Template } from "./types";

export type Action = "add" | "modify" | "replace" | "delete";

export interface Change {
  stack: string;
  id: string; // logical id
  type: string;
  action: Action;
  destructive: boolean; // replace or delete
  data: boolean; // the resource holds user data
  retained: boolean; // for a delete: DeletionPolicy keeps the data
  props: string[]; // properties that force the replacement, or that changed
}

/** Properties whose change makes CloudFormation replace the resource (create new, delete old). */
const REPLACE: Record<string, string[]> = {
  "AWS::DynamoDB::Table": ["TableName", "KeySchema", "LocalSecondaryIndexes"],
  "AWS::DynamoDB::GlobalTable": ["TableName", "KeySchema", "LocalSecondaryIndexes"],
  "Custom::AmplifyDynamoDBTable": ["tableName", "keySchema", "localSecondaryIndexes"],
  "AWS::S3::Bucket": ["BucketName", "ObjectLockEnabled"],
  "AWS::RDS::DBCluster": [
    "DBClusterIdentifier", "Engine", "EngineMode", "DatabaseName", "MasterUsername", "StorageEncrypted",
    "KmsKeyId", "DBSubnetGroupName", "SnapshotIdentifier", "SourceDBClusterIdentifier", "AvailabilityZones",
  ],
  "AWS::RDS::DBInstance": [
    "DBInstanceIdentifier", "Engine", "DBName", "MasterUsername", "StorageEncrypted", "KmsKeyId",
    "DBClusterIdentifier", "AvailabilityZone", "DBSnapshotIdentifier", "CharacterSetName",
  ],
  "AWS::EFS::FileSystem": ["Encrypted", "KmsKeyId", "PerformanceMode", "AvailabilityZoneName"],
  "AWS::Cognito::UserPool": ["UserPoolName", "UsernameAttributes", "AliasAttributes", "Schema"],
  "AWS::Cognito::UserPoolClient": ["UserPoolId", "GenerateSecret"],
  "AWS::AppSync::GraphQLApi": ["Name"],
  "AWS::SQS::Queue": ["QueueName", "FifoQueue"],
  "AWS::SNS::Topic": ["TopicName", "FifoTopic"],
  "AWS::Lambda::Function": ["FunctionName", "PackageType"],
  "AWS::IAM::Role": ["RoleName", "Path"],
  "AWS::Logs::LogGroup": ["LogGroupName"],
  "AWS::SecretsManager::Secret": ["Name"],
  "AWS::Events::Rule": ["Name", "EventBusName"],
  "AWS::KMS::Key": ["KeySpec", "MultiRegion"],
};

/** Any top-level "...Name" or "...Identifier" property counts as replacing for types not listed. */
const NAMED = /(Name|Identifier)$/;
const NOT_NAMED = new Set(["DisplayName", "FriendlyName", "Description"]);

const json = (v: unknown) => JSON.stringify(v ?? null);

function forcing(type: string, before: Resource, after: Resource): string[] {
  const a = before.Properties ?? {};
  const b = after.Properties ?? {};
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  const listed = REPLACE[type];
  const lower = listed?.map((k) => k.toLowerCase());
  return keys
    .filter((k) => (lower ? lower.includes(k.toLowerCase()) : NAMED.test(k) && !NOT_NAMED.has(k)))
    .filter((k) => json(a[k]) !== json(b[k]))
    .sort();
}

function changed(before: Resource, after: Resource): string[] {
  const a = before.Properties ?? {};
  const b = after.Properties ?? {};
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => json(a[k]) !== json(b[k])).sort();
  for (const k of ["DeletionPolicy", "UpdateReplacePolicy", "Condition"] as const) {
    if (json(before[k]) !== json(after[k])) keys.push(k);
  }
  return keys;
}

const resources = (t: Template | undefined) => t?.Resources ?? {};

/** Changes from `before` to `after`, sorted by stack and logical id. Unchanged resources are left out. */
export function classify(before: Stacks, after: Stacks): Change[] {
  const out: Change[] = [];
  const stacks = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  for (const stack of stacks) {
    const a = resources(before[stack]);
    const b = resources(after[stack]);
    const ids = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    for (const id of ids) {
      const x = a[id];
      const y = b[id];
      const base = { stack, id };
      if (x && !y) {
        out.push({ ...base, type: x.Type, action: "delete", destructive: true, data: isData(x), retained: keepsData(x), props: [] });
      } else if (!x && y) {
        out.push({ ...base, type: y.Type, action: "add", destructive: false, data: isData(y), retained: false, props: [] });
      } else if (x && y) {
        if (x.Type !== y.Type) {
          out.push({ ...base, type: y.Type, action: "replace", destructive: true, data: isData(x) || isData(y), retained: keepsData(x), props: ["Type"] });
          continue;
        }
        const force = forcing(y.Type, x, y);
        if (force.length) {
          out.push({ ...base, type: y.Type, action: "replace", destructive: true, data: isData(x), retained: keepsData(x), props: force });
          continue;
        }
        const props = changed(x, y);
        if (props.length) out.push({ ...base, type: y.Type, action: "modify", destructive: false, data: isData(y), retained: false, props });
      }
    }
  }
  return out;
}

export const destructive = (changes: Change[]) => changes.filter((c) => c.destructive);

/** One line per destructive change, for the approval screen ("what would be lost"). */
export function describe(c: Change): string {
  const what = `${c.type} ${c.id}${c.stack === "root" ? "" : ` (${c.stack})`}`;
  const loss = !c.data ? "" : c.retained ? "; its data is kept but no longer used" : "; its data is lost";
  if (c.action === "delete") return `deletes ${what}${loss}`;
  if (c.action === "replace") return `replaces ${what} because ${c.props.join(", ")} changed${loss}`;
  return `${c.action} ${what}`;
}

/**
 * Replaces environment-specific strings (branch names, env names, stack names) with one
 * placeholder, so templates of two branches of the same app compare by what differs in code.
 * A token matches only between non-alphanumeric characters ("main" does not match "domain").
 */
export function normalize(stacks: Stacks, tokens: string[]): Stacks {
  const list = [...new Set(tokens.filter((t) => t.length >= 2))].sort((a, b) => b.length - a.length);
  if (!list.length) return stacks;
  const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?<![A-Za-z0-9])(?:${list.map(esc).join("|")})(?![A-Za-z0-9])`, "g");
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return v.replace(re, "{{env}}");
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(stacks) as Stacks;
}
