// Property tests for the Amplify Data model guard (Requirement 6.4-6.6). Run: npx tsx --test lib/guard/*.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import fc from "fast-check";
import { backfillKeys, diffSchemas, modelFindings, parseSchema, type Model, type Schema } from "./model";

const KINDS = ["string", "integer", "float", "boolean", "datetime", "id", "email", "json"] as const;
const fieldName = fc.stringMatching(/^[a-z][A-Za-z0-9]{0,8}$/).filter((n) => n !== "id");
const modelName = fc.stringMatching(/^[A-Z][A-Za-z0-9]{0,8}$/);
const field = fc.record({ kind: fc.constantFrom(...KINDS), required: fc.boolean() });

const model: fc.Arbitrary<Model> = fc.dictionary(fieldName, field, { minKeys: 1, maxKeys: 6 }).map((d) => JSON.parse(JSON.stringify(d)) as Model["fields"]).chain((fields) =>
  fc.oneof(fc.constant<string[]>(["id"]), fc.subarray(Object.keys(fields), { minLength: 1, maxLength: Math.min(2, Object.keys(fields).length) })).map((identifier) => ({ identifier, fields })),
);
const schema: fc.Arbitrary<Schema> = fc.dictionary(modelName, model, { minKeys: 1, maxKeys: 4 }).map((d) => JSON.parse(JSON.stringify(d)) as Schema);

/** Writes a schema the way the agent writes amplify/data/resource.ts, with noise the scanner must skip. */
function render(s: Schema, style: number): string {
  const models = Object.entries(s).map(([name, m]) => {
    const fields = Object.entries(m.fields)
      .map(([f, x]) => `      ${style % 2 ? `"${f}"` : f}: a.${x.kind}()${x.required ? ".required()" : ""}, // {not a field}`)
      .join("\n");
    const id = m.identifier.length === 1 && m.identifier[0] === "id" && style % 3 === 0 ? "" : `\n    .identifier([${m.identifier.map((x) => `'${x}'`).join(", ")}])`;
    return `  /* ${name} } */\n  ${name}: a\n    .model({\n${fields}\n    })${id}\n    .authorization((allow) => [allow.owner(), allow.guest().to(["read"])]),`;
  });
  return [
    "import { a, defineData, type ClientSchema } from '@aws-amplify/backend';",
    "const note = `a.schema({ Fake: a.model({}) }) ${'}'}`;",
    "const schema = a.schema({",
    ...models,
    "});",
    "export type Schema = ClientSchema<typeof schema>;",
    "export const data = defineData({ schema, authorizationModes: { defaultAuthorizationMode: 'userPool' } });",
  ].join("\n");
}

test("parseSchema reads back what was written", () => {
  fc.assert(fc.property(schema, fc.nat(5), (s, style) => assert.deepEqual(parseSchema(render(s, style)), s)));
});

test("parseSchema follows models declared as constants", () => {
  const src = "const Todo = a\n  .model({ title: a.string().required(), done: a.boolean() })\n  .identifier(['title']);\nconst schema = a.schema({ Todo });";
  assert.deepEqual(parseSchema(src), { Todo: { identifier: ["title"], fields: { title: { kind: "string", required: true }, done: { kind: "boolean", required: false } } } });
});

test("an identifier change of an existing model is rejected", () => {
  fc.assert(fc.property(schema, fc.nat(), (base, i) => {
    const head = structuredClone(base);
    const name = Object.keys(head)[i % Object.keys(head).length]!;
    const m = head[name]!;
    m.identifier = m.identifier.join() === "id" ? [Object.keys(m.fields)[0]!] : ["id"];
    const f = modelFindings(diffSchemas(base, head, new Set()));
    assert.ok(f.some((x) => x.rule === "data.identifier" && x.level === "error" && x.resource === name));
  }));
});

test("a new required field needs a backfill in the same change", () => {
  fc.assert(fc.property(schema, fc.nat(), fc.constantFrom(...KINDS), (base, i, kind) => {
    const head = structuredClone(base);
    const name = Object.keys(head)[i % Object.keys(head).length]!;
    head[name]!.fields.z_new = { kind, required: true };
    const without = modelFindings(diffSchemas(base, head, new Set()));
    assert.ok(without.some((x) => x.rule === "data.required" && x.resource === `${name}.z_new`));
    const fill = backfillKeys([`amplify/data/backfill/${name}.z_new.ts`]);
    const withFill = modelFindings(diffSchemas(base, head, fill));
    assert.ok(!withFill.some((x) => x.level === "error"));
    head[name]!.fields.z_new = { kind, required: false };
    assert.ok(!modelFindings(diffSchemas(base, head, new Set())).some((x) => x.level === "error"));
  }));
});

test("removing a field or a model needs approval and is not an error", () => {
  fc.assert(fc.property(schema, fc.nat(), fc.boolean(), (base, i, whole) => {
    const head = structuredClone(base);
    const name = Object.keys(head)[i % Object.keys(head).length]!;
    const m = head[name]!;
    const fields = Object.keys(m.fields).filter((f) => !m.identifier.includes(f));
    if (whole || !fields.length) delete head[name];
    else delete m.fields[fields[i % fields.length]!];
    const f = modelFindings(diffSchemas(base, head, new Set()));
    assert.ok(f.some((x) => x.rule === "data.remove" && x.level === "approval"));
    assert.ok(!f.some((x) => x.level === "error"));
  }));
});

test("new models and unchanged schemas pass", () => {
  fc.assert(fc.property(schema, schema, (base, extra) => {
    const head = structuredClone(base);
    for (const [n, m] of Object.entries(extra)) if (!(n in head)) head[n] = m;
    assert.deepEqual(modelFindings(diffSchemas(base, head, new Set())), []);
  }));
});
