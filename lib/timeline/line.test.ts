// Property tests: any runner log line round-trips to the same structured event (design.md, Testing).
// Run with: node --import tsx --test lib/timeline/line.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import fc from "fast-check";
import { formatLine, parseLine, runnerLine, type RunnerLine } from "../contracts";
import { format as formatRunner, parse as parseRunner, type Line } from "../../runner/log";
import { toEvents, type RunRef } from "./writer";

const at = fc
  .date({ min: new Date("2026-01-01T00:00:00Z"), max: new Date("2030-12-31T23:59:59Z"), noInvalidDate: true })
  .map((d) => d.toISOString());
const id = fc.string({ minLength: 1, maxLength: 40 });
const text = fc.string({ maxLength: 200 });
const task = fc.integer({ min: 1, max: 999 });

const contractsLine: fc.Arbitrary<RunnerLine> = fc.record({ v: fc.constant(1 as const), project: id, run: id, at }).chain((b) =>
  fc.oneof(
    fc.record({ t: fc.constant("task_started" as const), task, title: text }).map((x) => ({ ...b, ...x })),
    fc.record({ t: fc.constant("task_done" as const), task, commit: text }).map((x) => ({ ...b, ...x })),
    fc.record({ t: fc.constant("file_changed" as const), path: text, change: fc.constantFrom("add" as const, "modify" as const, "delete" as const) }).map((x) => ({ ...b, ...x })),
    fc.record({ t: fc.constant("message" as const), text }).map((x) => ({ ...b, ...x })),
    fc
      .record({
        t: fc.constant("run_done" as const),
        status: fc.constantFrom("succeeded" as const, "failed" as const, "stopped" as const, "timeout" as const),
        credits: fc.double({ min: 0, max: 1e6, noNaN: true }),
        commit: fc.option(text, { nil: null }),
      })
      .map((x) => ({ ...b, ...x })),
  ),
);

const runnerData: fc.Arbitrary<Pick<Line, "kind" | "data">> = fc.oneof(
  fc.record({ kind: fc.constant("task_started" as const), data: fc.record({ number: task, title: text }) }),
  fc.record({ kind: fc.constant("task_done" as const), data: fc.record({ number: task, title: text, commit: text }) }),
  fc.record({ kind: fc.constant("file_changed" as const), data: fc.record({ path: fc.string({ minLength: 1, maxLength: 80 }), op: fc.constantFrom("add", "edit", "delete") }) }),
  fc.record({ kind: fc.constant("message" as const), data: fc.record({ from: fc.constantFrom("agent", "runner", "guard"), text }) }),
  fc.record({ kind: fc.constant("message" as const), data: fc.record({ from: fc.constant("runner"), text, branch: text, commit: fc.hexaString({ minLength: 7, maxLength: 40 }), status: fc.constant("ok"), seconds: fc.nat() }) }),
  fc.record({ kind: fc.constant("error" as const), data: fc.record({ step: fc.constantFrom("kiro", "lint", "synth", "guard", "push", "limit", "stopped"), text }) }),
  fc.record({ kind: fc.constant("credits" as const), data: fc.record({ used: fc.nat({ max: 10_000 }), limit: fc.option(fc.nat(), { nil: null }), payer: fc.constantFrom("company", "own"), model: fc.constant("auto") }) }),
);

test("contracts line: formatLine then parseLine gives the same line", () => {
  fc.assert(fc.property(contractsLine, (line) => assert.deepEqual(parseLine(formatLine(line)), line)));
});

test("contracts line: parseLine finds the line after a CloudWatch timestamp prefix", () => {
  fc.assert(fc.property(contractsLine, fc.string({ maxLength: 30 }).filter((s) => !s.includes("rv: ")), (line, pre) =>
    assert.deepEqual(parseLine(pre + formatLine(line)), line)));
});

test("runner line: format then parse gives the same line", () => {
  fc.assert(
    fc.property(runnerData, at, ({ kind, data }, when) => {
      const raw = formatRunner(kind, data, new Date(when));
      assert.deepEqual(parseRunner(raw), { kind, at: when, data });
    }),
  );
});

test("runner line -> timeline event carries the run's project and a valid contracts body", async () => {
  const ref: RunRef = { projectId: "p-1", runId: "r-1", credits: 0 };
  await fc.assert(
    fc.asyncProperty(runnerData, at, async ({ kind, data }, when) => {
      const events = await toEvents("rv-runner:abc", [formatRunner(kind, data, new Date(when))], async (bid) => {
        assert.equal(bid, "abc");
        return ref;
      });
      if (kind === "credits") return assert.equal(events.length, 0);
      assert.ok(events.length >= 1);
      for (const e of events) {
        assert.equal(e.projectId, ref.projectId);
        const body = runnerLine.parse(JSON.parse(e.text));
        assert.equal(body.t, e.kind);
        assert.equal(body.at, e.at);
        assert.equal(body.run, ref.runId);
        // and the body itself round-trips through the contracts format
        assert.deepEqual(parseLine(formatLine(body)), body);
      }
      assert.equal(new Set(events.map((e) => e.at)).size, events.length);
    }),
  );
});

test("lines that are not runner lines write nothing", async () => {
  await fc.assert(
    fc.asyncProperty(fc.string({ maxLength: 200 }).filter((s) => !s.includes("rv: ") && !s.trimStart().startsWith("RV ")), async (raw) => {
      assert.deepEqual(await toEvents("s", [raw], async () => ({ projectId: "p", runId: "r" })), []);
    }),
  );
});
