// Property tests: any runner log line round-trips to the same structured event (design.md, Testing).
// Run with: node --import tsx --test lib/timeline/line.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import fc from "fast-check";
import { formatLine, lineToEvent, parseLine, type RunnerLine } from "../contracts";
import { toEvents } from "./writer";

const at = fc
  .date({ min: new Date("2026-01-01T00:00:00Z"), max: new Date("2030-12-31T23:59:59Z"), noInvalidDate: true })
  .map((d) => d.toISOString());
const id = fc.string({ minLength: 1, maxLength: 40 });
const text = fc.string({ maxLength: 200 });
const task = fc.array(fc.integer({ min: 1, max: 99 }), { minLength: 1, maxLength: 3 }).map((a) => a.join("."));

const line: fc.Arbitrary<RunnerLine> = fc.record({ v: fc.constant(1 as const), project: id, run: id, at }).chain((b) =>
  fc.oneof(
    fc.record({ t: fc.constant("task_started" as const), task, title: text }).map((x) => ({ ...b, ...x })),
    fc.record({ t: fc.constant("task_done" as const), task, title: text, commit: text }).map((x) => ({ ...b, ...x })),
    fc.record({ t: fc.constant("file_changed" as const), path: text, change: fc.constantFrom("add" as const, "modify" as const, "delete" as const) }).map((x) => ({ ...b, ...x })),
    fc.record({ t: fc.constant("message" as const), text }).map((x) => ({ ...b, ...x })),
  ),
) as fc.Arbitrary<RunnerLine>;

test("formatLine then parseLine gives the same line", () => {
  fc.assert(fc.property(line, (l) => assert.deepEqual(parseLine(formatLine(l)), l)));
});

test("parseLine finds the line after a CloudWatch timestamp prefix", () => {
  fc.assert(fc.property(line, fc.string({ maxLength: 30 }).filter((s) => !s.includes("rv: ")), (l, pre) =>
    assert.deepEqual(parseLine(pre + formatLine(l)), l)));
});

test("toEvents turns each runner line into its timeline event and skips other output", async () => {
  await fc.assert(fc.asyncProperty(fc.array(line, { maxLength: 8 }), fc.array(fc.string({ maxLength: 40 }).filter((s) => !s.includes("rv: ")), { maxLength: 4 }), async (ls, noise) => {
    const events = await toEvents("stream", [...noise, ...ls.map(formatLine)]);
    assert.deepEqual(events, ls.map(lineToEvent));
  }));
});
