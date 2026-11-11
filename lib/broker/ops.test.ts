import assert from "node:assert/strict";
import { test } from "node:test";
import { check, type Config, type Op } from "./ops";

const c: Config = {
  partition: "aws", region: "us-east-1", account: "111122223333",
  runnerProject: "rv-revenant-prod-runner", runnerLogGroup: "/rv/rv-revenant-prod/runner", promptBucket: "b",
  boundary: "arn:aws:iam::111122223333:policy/rv-revenant-prod-runner-boundary",
  appsServiceRole: "arn:aws:iam::111122223333:role/rv-apps-service-us-east-1",
  appsComputeRole: "arn:aws:iam::111122223333:role/rv-apps-compute-us-east-1",
  dbStackRole: "arn:aws:iam::111122223333:role/rv-db-stack",
  ownAppId: "own",
};
const ok = (op: Op) => assert.doesNotThrow(() => check(op, c));
const no = (op: Op) => assert.throws(() => check(op, c), { name: "BrokerRefused" });

test("role and build take only app names and plain variables", () => {
  ok({ op: "role", app: "fineprint", owner: "abc-123" });
  no({ op: "role", app: "../x", owner: "abc" });
  ok({ op: "build", app: "fineprint", vars: { MODE: "build" }, minutes: 25 });
  no({ op: "build", app: "fineprint", vars: { "bad key": "x" } });
  no({ op: "build", app: "fineprint", vars: {}, minutes: 9999 });
});

test("apps must use the install's roles and not touch Revenant itself", () => {
  const input = { name: "rv-fineprint", iamServiceRoleArn: c.appsServiceRole, tags: { "revenant:project": "p1" } };
  ok({ op: "createApp", input });
  no({ op: "createApp", input: { ...input, iamServiceRoleArn: "arn:aws:iam::111122223333:role/admin" } });
  no({ op: "createApp", input: { ...input, computeRoleArn: "arn:aws:iam::111122223333:role/admin" } });
  no({ op: "createApp", input: { ...input, name: "other" } });
  ok({ op: "updateApp", input: { appId: "a1", computeRoleArn: c.appsComputeRole } });
  no({ op: "updateApp", input: { appId: "own" } });
});

test("stacks are rv-* and use only the install's stack role", () => {
  ok({ op: "createStack", input: { StackName: "rv-fineprint-prod-db", RoleARN: c.dbStackRole } });
  no({ op: "createStack", input: { StackName: "other", RoleARN: c.dbStackRole } });
  no({ op: "updateStack", input: { StackName: "rv-x", RoleARN: "arn:aws:iam::111122223333:role/admin" } });
});
