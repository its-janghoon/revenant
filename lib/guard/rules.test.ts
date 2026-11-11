// Property tests for the guardrail rules (design.md, Testing). Run: npx tsx --test lib/guard/*.test.ts
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import fc from "fast-check";
import { check } from "../guard";
import { rules } from "./rules";
import type { Resource, Stacks } from "./types";

const id = fc.stringMatching(/^[A-Z][A-Za-z0-9]{0,15}$/);
const plain = fc.stringMatching(/^[a-z0-9-]{0,20}$/);
const arn = id.map((n) => `arn:aws:dynamodb:us-east-1:111122223333:table/${n}`);
const scoped = fc.constantFrom("dynamodb:GetItem", "dynamodb:PutItem", "s3:GetObject", "sqs:SendMessage", "bedrock:InvokeModel");

const policy = (statement: Record<string, unknown>): Resource => ({
  Type: "AWS::IAM::Policy",
  Properties: { PolicyName: "p", PolicyDocument: { Version: "2012-10-17", Statement: [statement] }, Roles: [{ Ref: "Role" }] },
});

/** Resources that break no rule. */
const safe: fc.Arbitrary<Resource> = fc.oneof(
  fc.record({ actions: fc.array(scoped, { minLength: 1, maxLength: 4 }), res: fc.array(arn, { minLength: 1, maxLength: 3 }) })
    .map(({ actions, res }) => policy({ Effect: "Allow", Action: actions, Resource: res })),
  fc.constantFrom("TABLE_NAME", "BUCKET", "STAGE", "SECRET_ARN", "API_KEY_SECRET_ARN").chain((name) =>
    plain.map((v): Resource => ({ Type: "AWS::Lambda::Function", Properties: { Environment: { Variables: { [name]: v } } } }))),
  fc.constantFrom("AWS::DynamoDB::Table", "AWS::S3::Bucket", "Custom::AmplifyDynamoDBTable")
    .map((Type): Resource => ({ Type, DeletionPolicy: "Retain", Properties: {} })),
  fc.constantFrom("Retain", "Snapshot").map((p): Resource => ({ Type: "AWS::RDS::DBCluster", DeletionPolicy: p, Properties: {} })),
  fc.constant<Resource>({ Type: "AWS::SQS::Queue", Properties: {} }),
);

const stacks = (r: fc.Arbitrary<Resource> = safe): fc.Arbitrary<Stacks> =>
  fc.dictionary(fc.constantFrom("root", "data", "auth", "function"), fc.record({ Resources: fc.dictionary(id, r, { maxKeys: 8 }) }), { minKeys: 1 });

/** Puts `bad` into a random stack of `s` under a fresh id. */
const withBad = (bad: fc.Arbitrary<Resource>) =>
  fc.tuple(stacks(), bad).map(([g, r]) => {
    const s = structuredClone(g);
    const key = Object.keys(s)[0]!;
    const t = s[key]!;
    t.Resources = { ...(t.Resources ?? {}), ZZBad: r };
    return s;
  });

test("templates with no bad resource pass", () => {
  fc.assert(fc.property(stacks(), (s) => assert.deepEqual(rules(s), [])));
});

test('any Allow with "Action": "*" is rejected', () => {
  const star = fc.record({
    form: fc.constantFrom<unknown>("*", ["*"], "*:*"),
    res: fc.oneof(fc.constant<unknown>("*"), arn),
    cond: fc.boolean(),
  }).map(({ form, res, cond }) => policy({ Effect: "Allow", Action: form, Resource: res, ...(cond ? { Condition: { Bool: { "aws:SecureTransport": "true" } } } : {}) }));
  fc.assert(fc.property(withBad(star), (s) => {
    const f = rules(s);
    assert.ok(f.some((x) => x.rule === "iam.action" && x.level === "error" && x.resource?.endsWith("/ZZBad")));
  }));
});

test('"Resource": "*" needs a Condition unless AWS requires it', () => {
  fc.assert(fc.property(withBad(scoped.map((a) => policy({ Effect: "Allow", Action: a, Resource: "*" }))), (s) => {
    assert.ok(rules(s).some((x) => x.rule === "iam.resource"));
  }));
  fc.assert(fc.property(withBad(scoped.map((a) => policy({ Effect: "Allow", Action: a, Resource: "*", Condition: { StringEquals: { "aws:ResourceTag/app": "x" } } }))), (s) => {
    assert.deepEqual(rules(s), []);
  }));
  const ok = policy({ Effect: "Allow", Action: ["xray:PutTraceSegments", "cloudwatch:PutMetricData"], Resource: "*" });
  assert.deepEqual(rules({ root: { Resources: { Tracing: ok } } }), []);
});

test("any data resource without retain or snapshot is rejected", () => {
  const bad = fc.oneof(
    fc.record({
      Type: fc.constantFrom("AWS::DynamoDB::Table", "AWS::S3::Bucket", "Custom::AmplifyDynamoDBTable", "AWS::EFS::FileSystem"),
      DeletionPolicy: fc.constantFrom<string | undefined>(undefined, "Delete", "Snapshot"),
    }),
    fc.record({ Type: fc.constantFrom("AWS::RDS::DBCluster", "AWS::DocDB::DBCluster"), DeletionPolicy: fc.constantFrom<string | undefined>(undefined, "Delete") }),
  ).map((r): Resource => (r.DeletionPolicy === undefined ? { Type: r.Type } : { Type: r.Type, DeletionPolicy: r.DeletionPolicy }));
  fc.assert(fc.property(withBad(bad), (s) => {
    assert.ok(rules(s).some((x) => x.rule === "retain" && x.resource?.endsWith("/ZZBad")));
  }));
});

test("Amplify's own build buckets may be deleted; a user bucket may not", () => {
  const b: Resource = { Type: "AWS::S3::Bucket", DeletionPolicy: "Delete" };
  const s = { "data.nested.template.json": { Resources: {
    amplifyDataAmplifyCodegenAssetsAmplifyCodegenAssetsBucket9CCB4ACA: b,
    modelIntrospectionSchemaBucketF566B665: b,
    UploadsBucketA1B2C3D4: b,
  } } };
  const hits = rules(s).filter((x) => x.rule === "retain").map((x) => x.resource);
  assert.deepEqual(hits, ["data.nested.template.json/UploadsBucketA1B2C3D4"]);
});

test("a secret in a plain env var or parameter is rejected", () => {
  const name = fc.constantFrom("API_KEY", "STRIPE_SECRET", "DB_PASSWORD", "GITHUB_TOKEN", "OPENAI_API_KEY");
  const value = fc.stringMatching(/^[A-Za-z0-9]{1,30}$/);
  const env = fc.tuple(name, value).map(([n, v]): Resource => ({ Type: "AWS::Lambda::Function", Properties: { Environment: { Variables: { [n]: v } } } }));
  fc.assert(fc.property(withBad(env), (s) => assert.ok(rules(s).some((x) => x.rule === "secret.env"))));
  const resolved: Resource = { Type: "AWS::Lambda::Function", Properties: { Environment: { Variables: { DB: "{{resolve:secretsmanager:rv-db:SecretString:password}}" } } } };
  assert.ok(rules({ root: { Resources: { F: resolved } } }).some((x) => x.rule === "secret.env"));
  fc.assert(fc.property(name, (n) => {
    assert.ok(rules({ root: { Parameters: { [n]: { Type: "String", NoEcho: true } }, Resources: {} } }).some((x) => x.rule === "secret.parameter"));
  }));
});

test("check() reads root and nested assemblies, skips assets, fails closed on an empty cdk.out", () => {
  const dir = mkdtempSync(join(tmpdir(), "rv-guard-"));
  const out = join(dir, "cdk.out");
  mkdirSync(join(out, "assembly-x"), { recursive: true });
  mkdirSync(join(out, "asset.abc"), { recursive: true });
  writeFileSync(join(out, "root.template.json"), JSON.stringify({ Resources: { Q: { Type: "AWS::SQS::Queue" } } }));
  writeFileSync(join(out, "assembly-x", "data.nested.template.json"), JSON.stringify({ Resources: { T: { Type: "AWS::DynamoDB::Table" } } }));
  writeFileSync(join(out, "asset.abc", "ignored.template.json"), JSON.stringify({ Resources: { P: policy({ Effect: "Allow", Action: "*", Resource: "*" }) } }));
  const r = check({ cdkOut: out, repo: dir });
  assert.equal(r.ok, false);
  assert.deepEqual(r.findings.map((f) => f.rule), ["retain"]);

  const empty = join(dir, "empty");
  mkdirSync(empty);
  const e = check({ cdkOut: empty, repo: dir });
  assert.equal(e.ok, false);
  assert.equal(e.findings[0]?.rule, "synth");
});
