// Property tests for the change classifier (design.md, Testing). Run: npx tsx --test lib/guard/*.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import fc from "fast-check";
import { classify, normalize } from "./classify";
import type { Resource, Stacks } from "./types";

const id = fc.stringMatching(/^[A-Z][A-Za-z0-9]{0,11}$/);
const type = fc.constantFrom(
  "AWS::DynamoDB::Table", "AWS::S3::Bucket", "AWS::Lambda::Function", "AWS::IAM::Role", "AWS::SQS::Queue",
  "Custom::AmplifyDynamoDBTable", "AWS::RDS::DBCluster", "AWS::AppSync::GraphQLApi",
);
const value = fc.oneof(fc.string({ maxLength: 8 }), fc.integer(), fc.boolean(), fc.array(fc.string({ maxLength: 4 }), { maxLength: 3 }));
const props = fc.dictionary(fc.constantFrom("TableName", "BucketName", "FunctionName", "Timeout", "MemorySize", "Tags", "KeySchema", "Handler", "tableName", "Description"), value, { maxKeys: 4 });
const resource: fc.Arbitrary<Resource> = fc.record({
  Type: type,
  Properties: props,
  DeletionPolicy: fc.constantFrom("Retain", "Delete", "Snapshot"),
});
const stacks: fc.Arbitrary<Stacks> = fc.dictionary(
  fc.constantFrom("root", "data", "data/Note", "auth"),
  fc.record({ Resources: fc.dictionary(id, resource, { minKeys: 1, maxKeys: 6 }) }),
  { minKeys: 1 },
);

/** Pairs of random stacks, plus an "after" derived from "before" by random edits. */
const pair = fc.oneof(
  fc.tuple(stacks, stacks),
  fc.tuple(stacks, fc.array(fc.tuple(fc.nat(), resource, fc.constantFrom("drop", "edit", "add")), { maxLength: 6 })).map(([before, edits]) => {
    const after = structuredClone(before);
    for (const [i, r, op] of edits) {
      const keys = Object.keys(after);
      const t = after[keys[i % keys.length]!]!;
      const ids = Object.keys(t.Resources ?? {});
      if (op === "add" || !ids.length) t.Resources = { ...t.Resources, [`New${i}`]: r };
      else if (op === "drop") delete t.Resources![ids[i % ids.length]!];
      else t.Resources![ids[i % ids.length]!] = r;
    }
    return [before, after] as [Stacks, Stacks];
  }),
);

test("identical templates have no changes", () => {
  fc.assert(fc.property(stacks, (s) => assert.deepEqual(classify(s, structuredClone(s)), [])));
});

test("any replace or delete is marked destructive, and nothing else is", () => {
  fc.assert(fc.property(pair, ([a, b]) => {
    for (const c of classify(a, b)) assert.equal(c.destructive, c.action === "replace" || c.action === "delete");
  }));
});

test("every removed resource is a destructive delete", () => {
  fc.assert(fc.property(stacks, fc.nat(), (before, i) => {
    const after = structuredClone(before);
    const key = Object.keys(after)[i % Object.keys(after).length]!;
    const ids = Object.keys(after[key]!.Resources!);
    const gone = ids[i % ids.length]!;
    delete after[key]!.Resources![gone];
    const c = classify(before, after).find((x) => x.stack === key && x.id === gone);
    assert.ok(c);
    assert.equal(c.action, "delete");
    assert.equal(c.destructive, true);
  }));
});

test("a removed stack deletes all its resources", () => {
  fc.assert(fc.property(stacks, (before) => {
    const key = Object.keys(before)[0]!;
    const after = structuredClone(before);
    delete after[key];
    const deleted = classify(before, after).filter((c) => c.stack === key);
    assert.equal(deleted.length, Object.keys(before[key]!.Resources!).length);
    assert.ok(deleted.every((c) => c.action === "delete" && c.destructive));
  }));
});

test("a type change or a replacing property change is a destructive replace", () => {
  fc.assert(fc.property(id, fc.string({ minLength: 1, maxLength: 8 }), (name, n) => {
    const before: Stacks = { root: { Resources: { [name]: { Type: "AWS::DynamoDB::Table", Properties: { TableName: "a" } } } } };
    const renamed: Stacks = { root: { Resources: { [name]: { Type: "AWS::DynamoDB::Table", Properties: { TableName: `a${n}` } } } } };
    const retyped: Stacks = { root: { Resources: { [name]: { Type: "AWS::S3::Bucket", Properties: { TableName: "a" } } } } };
    for (const after of [renamed, retyped]) {
      const [c] = classify(before, after);
      assert.equal(c?.action, "replace");
      assert.equal(c?.destructive, true);
    }
  }));
});

test("only additions are never destructive", () => {
  fc.assert(fc.property(stacks, stacks, (before, extra) => {
    const after = structuredClone(before);
    for (const [k, t] of Object.entries(extra)) {
      const prefixed = Object.fromEntries(Object.entries(t.Resources ?? {}).map(([i, r]) => [`Add_${i}`, r]));
      after[k] = { Resources: { ...(after[k]?.Resources ?? {}), ...prefixed } };
    }
    assert.ok(classify(before, after).every((c) => !c.destructive && c.action === "add"));
  }));
});

test("normalize replaces whole tokens only", () => {
  const s: Stacks = { root: { Resources: { F: { Type: "AWS::Lambda::Function", Properties: { FunctionName: "rv-app-main-fn", Description: "domain main" } } } } };
  const n = normalize(s, ["main"]);
  assert.deepEqual(n.root!.Resources!.F!.Properties, { FunctionName: "rv-app-{{env}}-fn", Description: "domain {{env}}" });
  const a = normalize({ root: { Resources: { T: { Type: "AWS::S3::Bucket", Properties: { BucketName: "rv-app-prod-files" } } } } }, ["prod"]);
  const b = normalize({ root: { Resources: { T: { Type: "AWS::S3::Bucket", Properties: { BucketName: "rv-app-pv3-files" } } } } }, ["pv3"]);
  assert.deepEqual(classify(a, b), []);
});
